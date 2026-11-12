'use strict';
/**
 * ============================================================
 *  CHAMPION XAUUSD H1 v6  ->  port Pine Script ke Node.js
 * ============================================================
 *  Cara pakai (ringkas):
 *
 *    const { ChampionEngine } = require('./champion-signal');
 *    const engine = new ChampionEngine({ qtyOz: 7 });
 *
 *    // 1. (sekali) warm-up pakai 300+ candle H1 historis yang SUDAH close
 *    history.forEach(c => engine.onCandleClosed(c));   // abaikan event-nya
 *
 *    // 2. tiap candle H1 close:
 *    engine.setPositionOpen(brokerSaysPositionOpen);   // status dari broker, WAJIB sebelum onCandleClosed
 *    const events = engine.onCandleClosed(candle);     // candle = { time, open, high, low, close }
 *    for (const ev of events) sendToExecution(ev);     // ev adalah JSON eksplisit (lihat bawah)
 *
 *  Format candle:
 *    time  = waktu OPEN candle, milidetik UTC (contoh: 1731384000000)
 *    HANYA kirim candle yang sudah CLOSE. Jangan kirim candle yang masih jalan.
 *
 *  Event yang dikeluarkan (field "event"):
 *    PLACE_LIMIT     -> pasang order limit baru (BUY/SELL) lengkap dengan SL & TP
 *    REPLACE_LIMIT   -> sudah ada order pending, ganti dengan yang baru (ID order sama)
 *    CANCEL_PENDING  -> batalkan order limit yang belum keisi (alasan: EXPIRED / OUT_OF_SESSION)
 *    CLOSE_POSITION  -> tutup posisi (hanya kalau endSess = true)
 * ============================================================
 */

const DEFAULT_CONFIG = {
  strategyName: 'ChampionXAUUSD_H1_v6',
  symbol: 'XAUUSD',
  timeframe: 'H1',

  // --- Sinyal ---
  bodyMin: 83,        // body minimal (% dari range candle)
  adxLen: 10,         // panjang DI+ / DI-
  adxSmooth: 14,      // smoothing ADX (Wilder)
  adxMin: 17,         // ADX minimal
  allowLong: true,    // BUY aktif
  allowShort: false,  // SELL mati (resep final BUY saja)

  // --- Fractal ---
  useFractal: true,
  frLen: 3,           // bar kiri = bar kanan

  // --- Entry retest ---
  retestMode: 'CLOSE', // 'OPEN' | 'MID' | 'CLOSE'  (Open sinyal / 50% sinyal / Close sinyal)
  retestBars: 9,       // maks bar nunggu retest (dihitung dalam JUMLAH BAR, bukan jam)

  // --- Trading ---
  slUsd: 20,
  tpUsd: 40,
  qtyOz: 7,            // 7 oz = lot 0.07
  session: '0730-2200',// WIB, format HHMM-HHMM
  utcOffsetMin: 420,   // WIB = UTC+7 = 420 menit
  endSess: false,      // tutup paksa posisi di luar sesi
};

// ------------------------------------------------------------
//  Wilder RMA (sama dengan ta.rma di Pine)
//  Nilai awal = SMA dari `len` data pertama, sesudahnya Wilder smoothing
// ------------------------------------------------------------
class Rma {
  constructor(len) {
    this.len = len;
    this.n = 0;
    this.sum = 0;
    this.value = null;
  }
  update(x) {
    if (this.value === null) {
      this.sum += x;
      this.n += 1;
      if (this.n === this.len) this.value = this.sum / this.len;
      return this.value;
    }
    this.value = (this.value * (this.len - 1) + x) / this.len;
    return this.value;
  }
}

// "0730-2200" -> { start: 450, end: 1320 } (menit dari 00:00)
function parseSession(str) {
  const m = /^(\d{2})(\d{2})-(\d{2})(\d{2})$/.exec(str);
  if (!m) throw new Error('Format session salah, contoh: 0730-2200');
  return {
    start: Number(m[1]) * 60 + Number(m[2]),
    end: Number(m[3]) * 60 + Number(m[4]),
  };
}

const round2 = (x) => Number(x.toFixed(2));

// ------------------------------------------------------------
//  ENGINE
// ------------------------------------------------------------
class ChampionEngine {
  constructor(userCfg = {}) {
    this.cfg = { ...DEFAULT_CONFIG, ...userCfg };
    this.sess = parseSession(this.cfg.session);

    // state indikator DMI/ADX
    this.rmaTR = new Rma(this.cfg.adxLen);
    this.rmaPlus = new Rma(this.cfg.adxLen);
    this.rmaMinus = new Rma(this.cfg.adxLen);
    this.rmaAdx = new Rma(this.cfg.adxSmooth);
    this.diPlus = null;
    this.diMinus = null;
    this.adx = null;
    this.prev = null; // candle sebelumnya (untuk DMI)

    // state fractal
    this.lastPH = null;
    this.lastPL = null;

    // state umum
    this.hist = [];        // candle terakhir (untuk breakout & pivot)
    this.barIndex = -1;    // counter bar (sama seperti bar_index di Pine)
    this.lastTime = null;
    this.positionOpen = false;

    // order pending (null = tidak ada)
    // { side:'BUY'|'SELL', level, signalTime, barIndex }
    this.pending = null;
  }

  /** Dipanggil dari sisi broker/eksekusi: apakah ada posisi terbuka sekarang? */
  setPositionOpen(isOpen) {
    this.positionOpen = !!isOpen;
  }

  // sesi: cek berdasarkan waktu OPEN candle (sama dengan time() di Pine)
  _inSession(timeMs) {
    const minuteOfDay =
      (((Math.floor(timeMs / 60000) + this.cfg.utcOffsetMin) % 1440) + 1440) % 1440;
    const { start, end } = this.sess;
    return start <= end
      ? minuteOfDay >= start && minuteOfDay < end
      : minuteOfDay >= start || minuteOfDay < end; // sesi lewat tengah malam
  }

  // ta.dmi(adxLen, adxSmooth)
  _updateDmi(c) {
    if (!this.prev) {
      this.prev = c;
      return;
    }
    const p = this.prev;
    const up = c.high - p.high;
    const down = p.low - c.low;
    const plusDM = up > down && up > 0 ? up : 0;
    const minusDM = down > up && down > 0 ? down : 0;
    const tr = Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));

    const trR = this.rmaTR.update(tr);
    const plusR = this.rmaPlus.update(plusDM);
    const minusR = this.rmaMinus.update(minusDM);

    if (trR !== null && trR > 0) {
      this.diPlus = (100 * plusR) / trR;
      this.diMinus = (100 * minusR) / trR;
      const sum = this.diPlus + this.diMinus;
      const dx = Math.abs(this.diPlus - this.diMinus) / (sum === 0 ? 1 : sum);
      const a = this.rmaAdx.update(dx);
      this.adx = a === null ? null : 100 * a;
    }
    this.prev = c;
  }

  // ta.pivothigh / ta.pivotlow (konfirmasi di bar ke-frLen setelah pivot, tidak repaint)
  _updatePivots() {
    const L = this.cfg.frLen;
    const h = this.hist;
    const n = h.length;
    if (n < 2 * L + 1) return;
    const center = h[n - 1 - L];
    let isHigh = true;
    let isLow = true;
    for (let i = 1; i <= L; i++) {
      const left = h[n - 1 - L - i];
      const right = h[n - 1 - L + i];
      // kiri harus lebih rendah (strict), kanan lebih rendah atau sama
      if (!(center.high > left.high) || !(center.high >= right.high)) isHigh = false;
      if (!(center.low < left.low) || !(center.low <= right.low)) isLow = false;
    }
    if (isHigh) this.lastPH = center.high;
    if (isLow) this.lastPL = center.low;
  }

  _retestLevel(c) {
    switch (this.cfg.retestMode) {
      case 'OPEN': return c.open;
      case 'MID': return (c.open + c.close) / 2;
      default: return c.close;
    }
  }

  _event(type, c, extra) {
    return {
      event: type,
      strategy: this.cfg.strategyName,
      symbol: this.cfg.symbol,
      timeframe: this.cfg.timeframe,
      candleTime: c.time,
      candleTimeISO: new Date(c.time).toISOString(),
      ...extra,
    };
  }

  /**
   * Proses 1 candle H1 yang sudah close.
   * @returns {Array<object>} daftar event untuk dieksekusi (bisa kosong)
   */
  onCandleClosed(c) {
    const cfg = this.cfg;
    const events = [];

    // validasi & anti-duplikat / out-of-order
    if (![c.time, c.open, c.high, c.low, c.close].every(Number.isFinite)) return events;
    if (this.lastTime !== null && c.time <= this.lastTime) return events;
    this.lastTime = c.time;
    this.barIndex += 1;

    // 1) update indikator
    this.hist.push(c);
    if (this.hist.length > 30) this.hist.shift();
    this._updateDmi(c);
    this._updatePivots(); // lastPH/lastPL diupdate DULU, baru dipakai cek breakout (urutan sama dgn Pine)

    const h = this.hist;
    const n = h.length;
    const inSess = this._inSession(c.time);

    // 2) hitung kondisi sinyal
    let longSig = false;
    let shortSig = false;
    const rng = c.high - c.low;
    const bodyPct = rng > 0 ? (Math.abs(c.close - c.open) / rng) * 100 : 0;

    if (n >= 3 && this.adx !== null) {
      const p1 = h[n - 2];
      const p2 = h[n - 3];
      const bodyOk = bodyPct >= cfg.bodyMin;
      const adxOk = this.adx >= cfg.adxMin;
      const brkUp = c.close > Math.max(p1.high, p2.high);
      const brkDn = c.close < Math.min(p1.low, p2.low);
      const fracUp = !cfg.useFractal || this.lastPH === null || c.close > this.lastPH;
      const fracDn = !cfg.useFractal || this.lastPL === null || c.close < this.lastPL;
      const diUp = this.diPlus > this.diMinus;
      const diDn = this.diMinus > this.diPlus;

      longSig = cfg.allowLong && c.close > c.open && brkUp && bodyOk && adxOk && diUp && fracUp && inSess;
      shortSig = cfg.allowShort && c.close < c.open && brkDn && bodyOk && adxOk && diDn && fracDn && inSess;
    }

    // 3) manajemen order pending (urutan SAMA dengan Pine)
    //    a. posisi sudah kebuka -> pending dianggap selesai
    if (this.positionOpen) this.pending = null;

    //    b. kedaluwarsa: tidak keisi dalam retestBars bar
    if (this.pending && this.barIndex - this.pending.barIndex >= cfg.retestBars) {
      events.push(this._event('CANCEL_PENDING', c, {
        reason: 'EXPIRED',
        side: this.pending.side,
        orderRef: this._orderRef(this.pending),
      }));
      this.pending = null;
    }

    //    c. keluar sesi -> pending dibatalin
    if (!inSess && this.pending) {
      events.push(this._event('CANCEL_PENDING', c, {
        reason: 'OUT_OF_SESSION',
        side: this.pending.side,
        orderRef: this._orderRef(this.pending),
      }));
      this.pending = null;
    }

    // 4) pasang order limit retest (hanya kalau flat)
    const flat = !this.positionOpen;
    const side = longSig ? 'BUY' : shortSig ? 'SELL' : null;
    if (side && flat) {
      const level = this._retestLevel(c);
      const dir = side === 'BUY' ? 1 : -1;
      const isReplace = !!this.pending;

      // kalau ada pending arah lawan, batalkan dulu
      if (this.pending && this.pending.side !== side) {
        events.push(this._event('CANCEL_PENDING', c, {
          reason: 'OPPOSITE_SIGNAL',
          side: this.pending.side,
          orderRef: this._orderRef(this.pending),
        }));
      }
      const replacing = isReplace && this.pending.side === side;

      this.pending = { side, level, signalTime: c.time, barIndex: this.barIndex };

      events.push(this._event(replacing ? 'REPLACE_LIMIT' : 'PLACE_LIMIT', c, {
        id: `${cfg.strategyName}:${c.time}:${side}`, // kunci anti-duplikat di website
        orderRef: this._orderRef(this.pending),      // sama untuk entry baru/replace dengan arah sama
        side,                                        // "BUY" | "SELL"
        orderType: 'LIMIT',
        entry: round2(level),                        // harga limit
        sl: round2(level - dir * cfg.slUsd),         // harga mutlak
        tp: round2(level + dir * cfg.tpUsd),         // harga mutlak
        qtyOz: cfg.qtyOz,
        lot: round2(cfg.qtyOz / 100),                // 7 oz = 0.07 lot
        maxBarsToFill: cfg.retestBars,
        meta: {
          adx: round2(this.adx),
          diPlus: round2(this.diPlus),
          diMinus: round2(this.diMinus),
          bodyPct: round2(bodyPct),
          lastFractalHigh: this.lastPH === null ? null : round2(this.lastPH),
          lastFractalLow: this.lastPL === null ? null : round2(this.lastPL),
          retestMode: cfg.retestMode,
        },
      }));
    }

    // 5) tutup paksa di akhir sesi (opsional)
    if (cfg.endSess && !inSess && this.positionOpen) {
      events.push(this._event('CLOSE_POSITION', c, { reason: 'END_OF_SESSION' }));
    }

    return events;
  }

  _orderRef(p) {
    return `${this.cfg.strategyName}:${p.side === 'BUY' ? 'ChampLong' : 'ChampShort'}`;
  }
}

module.exports = { ChampionEngine, DEFAULT_CONFIG, Rma, parseSession };
