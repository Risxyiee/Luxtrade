/**
 * ============================================================
 * pine-engine-core — Mesin Pine headless MURNI (tanpa dep CF)
 * ============================================================
 * Dieksekusi di DUA runtime:
 *   1. Cloudflare Workers (src/app/api/cron/pine-alerts) — DI SINI
 *      engine PineTS TIDAK BISA jalan (workerd melarang code
 *      generation → "new Function" = EvalError). Jalur ini hanya
 *      untuk replika TS default + fallback.
 *   2. GitHub Actions runner Node penuh (scripts/pine-alerts-engine.ts)
 *      — eval diizinkan → engine PineTS jalan normal. INI jalur
 *      eksekusi resmi untuk Pine milik user + skrip protected.
 *
 * ATURAN: file ini WAJIB bebas impor berat (hanya dynamic-import
 * @luxalgo/vela-pinets) supaya aman diimpor worker DAN script GHA.
 * Jangan tambah import @/lib/* di sini!
 */

/* ============================================================
   TIPE DASAR
   ============================================================ */

export interface PlotSeries {
  key: string
  title: string
  kind: 'line'
  color: string
  /** {time: epoch ms, value} — value null = gap */
  data: Array<{ time: number; value: number | null }>
}

/** Visual non-garis hasil engine (plotshape/plotchar/bgcolor/label.new)
 *  — server mengirim agar chart client bisa menggambar penuh ala
 *  TradingView (dulu SEMUA dibuang → sinyal BUY/SELL tabel dsb.
 *  hilang dari chart skrip terproteksi). */
export interface PineVisuals {
  /** plotshape/plotchar true → marker segitiga/cross di atas/bawah bar */
  markers: Array<{ time: number; location: string; shape: string; char?: string; color?: string; text?: string; size?: string }>
  /** bgcolor → tint per bar (time→color) */
  backgrounds: Array<{ time: number; color: string }>
  /** label.new → label berteks di harga */
  labels: Array<{ time: number; price: number; text: string; color?: string; textColor?: string; style?: string; size?: string; above?: boolean }>
}

export interface PineRunResult {
  ok: boolean
  error?: string
  title?: string
  overlay?: boolean
  plots?: PlotSeries[]
  /** Visual non-garis (plotshape/bgcolor/label.new) — dikirim ke client */
  visuals?: PineVisuals
  /** Trade strategy (HANYA skrip default): bahan visual chart ala
      TradingView — garis entry→exit dotted + label TP/SL + panah
      entry (replika line.new/label.new Pine Bos, digambar client).
      time dalam ms; exit null = posisi masih terbuka. */
  trades?: Array<{
    side: 'long' | 'short'
    entryTime: number
    entryPrice: number
    exitTime: number | null
    exitPrice: number | null
    pnl: number
    reason: 'sl' | 'tp' | 'session' | 'daily_dd' | 'open'
  }>
  /** Alert bawaan engine (script memakai alert()/alertcondition) */
  engineAlerts?: Array<{ message: string; time: number; barIndex: number }>
  /** Statistik performa strategy (HANYA skrip default — tabel khas
      TradingView utk chart: Net P&L, win rate, PF, streak, DD, dst.) */
  stats?: Record<string, string | number | boolean | null>
}

/** Sinyal alert terklasifikasi — time epoch DETIK (open time bar pemicu) */
export interface AlertTrigger {
  signal: string
  message: string
  time: number
  price: number
}

export interface AlertRule {
  type: 'cross_above' | 'cross_below' | 'above' | 'below'
  a: string
  b: number | string
  signal: string
  message?: string
}

const PALETTE = ['#a78bfa', '#f472b6', '#34d399', '#fbbf24', '#38bdf8', '#fb7185']

/* Warna Pine umum → hex (agar plot terproteksi tampil sesuai niat skrip Bos) */
const PINE_COLORS: Record<string, string> = {
  orange: '#ff9800', teal: '#26a69a', red: '#ef5350', green: '#22ab94',
  purple: '#ab47bc', aqua: '#26c6da', blue: '#42a5f5', yellow: '#ffee58',
  white: '#f5f5f5', gray: '#9e9e9e', lime: '#c6ff00', fuchsia: '#e040fb',
  maroon: '#8b3a62', navy: '#3f51b5', olive: '#9e9d24', silver: '#bdbdbd',
}

/** Peta judul-plot → hex dari source: plot(x, title="EMA 21", color=color.orange) */
export function scanPlotColors(source: string): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    const re = /plot\s*\(([^)]*)\)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(source))) {
      const args = m[1]
      const tM = args.match(/title\s*=\s*"([^"]+)"/)
      const cM = args.match(/color\s*=\s*color\.([a-z_]+)/)
      const hM = args.match(/color\s*=\s*color\.rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
      if (tM) {
        if (hM) out[tM[1]] = `#${[1, 2, 3].map((i) => Number(hM[i]).toString(16).padStart(2, '0')).join('')}`
        else if (cM && PINE_COLORS[cM[1]]) out[tM[1]] = PINE_COLORS[cM[1]]
      }
    }
  } catch { /* dekoratif saja — gagal diam */ }
  return out
}

/**
 * Sintesis segmen Entry/SL/TP dari TRADES strategy() — Permintaan Bos:
 * "itu ganti pine ke ini baru namain Luxtradee Candle Impulsif" — source
 * default sekarang strategy() VERBATIM (tanpa plot()), jadi chart perlu
 * menggambar "log entry sl tp" dari daftar trade engine:
 *   - Entry      (hijau)  : harga entry, dari bar entry s.d. bar exit
 *   - Stop Loss  (merah)  : harga exit utk trade rugi (pnl < 0)
 *   - Take Profit (aqua)  : harga exit utk trade untung (pnl >= 0)
 * Posisi masih terbuka → garis Entry menjulur ke bar terakhir.
 * Mirip line.new + label TP/SL di TradingView, tapi server-side.
 */
export function synthesizeTradePlots(
  bars: Array<{ time: number }>,
  trades: any[],
): PlotSeries[] {
  const idxOf = new Map<number, number>()
  bars.forEach((b, i) => idxOf.set(Number(b.time), i))
  const n = bars.length
  const entry = new Array<number | null>(n).fill(null)
  const loss = new Array<number | null>(n).fill(null)
  const win = new Array<number | null>(n).fill(null)
  for (const tr of trades) {
    try {
      const eT = Number(tr?.entry?.time)
      const eP = Number(tr?.entry?.price)
      const start = idxOf.get(eT)
      if (start == null || !Number.isFinite(eP)) continue
      let end = tr?.exit?.time != null ? idxOf.get(Number(tr.exit.time)) : null
      if (end == null) end = n - 1 // posisi masih terbuka
      const s = Math.min(start, end)
      const t = Math.max(start, end)
      for (let i = s; i <= t; i++) entry[i] = eP
      const xP = Number(tr?.exit?.price)
      if (Number.isFinite(xP)) {
        const target = Number(tr?.pnl) < 0 ? loss : win
        for (let i = s; i <= t; i++) target[i] = xP
      }
    } catch { /* trade aneh — lewati */ }
  }
  const toSeries = (arr: Array<number | null>, key: string, title: string, color: string): PlotSeries => ({
    key, title, kind: 'line', color,
    data: bars.map((b, i) => ({ time: Number(b.time), value: arr[i] })),
  })
  return [
    toSeries(entry, 'Entry', 'Entry', '#22ab94'),
    toSeries(loss, 'StopLoss', 'Stop Loss', '#ef5350'),
    toSeries(win, 'TakeProfit', 'Take Profit', '#26c6da'),
  ]
}

/**
 * Ekstraksi visual non-garis dari snapshot plots engine.
 * Konteks engine per plot: { data:[{time,value,options?}], options:{style,...}, title }.
 * Style yang dikenal: 'shape'/'char' (plotshape/plotchar), 'background'
 * (bgcolor), 'label' (label.new). Selebihnya = series garis (jalur lama).
 * Semua dicap (cap) supaya respons tetap ringan di mobile.
 */
const VISUAL_CAPS = { markers: 800, backgrounds: 1500, labels: 400 }

function extractPineVisuals(plotsRaw: Record<string, any>): PineVisuals | undefined {
  const markers: PineVisuals['markers'] = []
  const backgrounds: PineVisuals['backgrounds'] = []
  const labels: PineVisuals['labels'] = []
  try {
    for (const key of Object.keys(plotsRaw)) {
      const plot = plotsRaw[key]
      const pts: Array<any> = Array.isArray(plot?.data) ? plot.data : []
      const style = String(plot?.options?.style || '')
      if (style === 'shape' || style === 'char') {
        const loc = String(plot?.options?.location || '')
        for (const p of pts) {
          if (markers.length >= VISUAL_CAPS.markers) break
          const v = p?.value
          const truthy = v === true || (typeof v === 'number' && Number.isFinite(v) && v !== 0)
          if (!truthy) continue
          const o = (p?.options && typeof p?.options === 'object' ? p.options : plot?.options) || {}
          const shape = String(o.shape || (style === 'shape' ? 'triangleup' : ''))
          const char = style === 'char' ? String(o.char ?? plot?.options?.char ?? '') : undefined
          markers.push({
            time: Number(p.time),
            location: String(o.location ?? (loc || 'abovebar')),
            shape: shape || 'triangleup',
            ...(char ? { char } : {}),
            ...(o.color ? { color: String(o.color) } : {}),
            ...(o.text ? { text: String(o.text) } : {}),
            ...(o.size ? { size: String(o.size) } : {}),
          })
        }
      } else if (style === 'background') {
        for (const p of pts) {
          if (backgrounds.length >= VISUAL_CAPS.backgrounds) break
          const c = p?.options?.color
          if (typeof c === 'string' && c.trim() && !/^(na|nan)$/i.test(c.trim()) && !/rgba?\([^)]*,\s*0(?:\.0+)?\s*\)$/i.test(c)) {
            backgrounds.push({ time: Number(p.time), color: c.trim() })
          }
        }
      } else if (style === 'label') {
        for (const p of pts) {
          if (labels.length >= VISUAL_CAPS.labels) break
          const o = (p?.options && typeof p?.options === 'object' ? p.options : {}) || {}
          const v = p?.value
          const price = typeof v === 'number' && Number.isFinite(v) ? v : Number((v as any)?.y ?? (v as any)?.price)
          const text = String((v as any)?.text ?? o.text ?? '')
          if (!Number.isFinite(price) || !text) continue
          labels.push({
            time: Number(p.time),
            price,
            text: text.slice(0, 120),
            ...(o.color ? { color: String(o.color) } : {}),
            ...(o.textcolor || o.textColor ? { textColor: String(o.textcolor ?? o.textColor) } : {}),
            ...(o.style ? { style: String(o.style) } : {}),
            ...(o.size ? { size: String(o.size) } : {}),
            ...(o.yloc === 'abovebar' ? { above: true } : {}),
          })
        }
      }
    }
  } catch { /* dekoratif — jangan bunuh run */ }
  if (!markers.length && !backgrounds.length && !labels.length) return undefined
  return { markers, backgrounds, labels }
}

/**
 * bars: epoch DETIK (bentuk server-candles) — dikonversi ke ms
 * (kontrak Vela OHLCV time = Millis).
 */
export async function runPineHeadless(
  source: string,
  symbol: string,
  timeframe: string,
  barsSec: Array<{ time: number; open: number; high: number; low: number; close: number; volume?: number }>,
): Promise<PineRunResult> {
  if (!barsSec.length) return { ok: false, error: 'Tidak ada candle untuk dieksekusi' }
  const bars = barsSec.map((b) => ({ ...b, time: b.time * 1000 }))

  let PineEngineCtor: any
  try {
    ;({ PineEngine: PineEngineCtor } = await import('@luxalgo/vela-pinets'))
  } catch (x: any) {
    return { ok: false, error: `Engine PineTS gagal dimuat di server: ${String(x?.message || x).slice(0, 120)}` }
  }

  const engine = new PineEngineCtor()
  const colorMap = scanPlotColors(source)
  let prepared: any
  try {
    prepared = await engine.prepare(source, `protected-${symbol}-${timeframe}`)
  } catch (x: any) {
    return { ok: false, error: `Skrip gagal dikompilasi: ${String(x?.message || x).replace(/https?:\/\/\S+/g, '').slice(0, 160)}` }
  }

  return await new Promise<PineRunResult>((resolve) => {
    let settled = false
    let session: any = null
    const engineAlerts: Array<{ message: string; time: number; barIndex: number }> = []

    const finish = async (failMsg?: string) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (failMsg) { try { session?.stop?.() } catch {} ; resolve({ ok: false, error: failMsg }); return }
      try {
        /* getContext → snapshot plots + trades: Record<key, {time,value}[]>
           TRADES (adaptasi strategy() — probe terverifikasi): engine
           TIDAK memicu onAlert utk strategy.entry/exit, tapi setiap
           trade tersedia di context. Dipetakan jadi engineAlerts
           (ENTRY_LONG/ENTRY_SHORT/STOP_LOSS/TAKE_PROFIT) sehingga
           skrip strategy() Bos ikut memicu alert push HP. */
        const snap = await session?.getContext?.(['plots', 'meta', 'trades'])
        const plotsRaw: Record<string, any> = snap?.plots || {}
        const keys = Object.keys(plotsRaw)

        /* ---- strategy() trades → sinyal ala alert() ----
           Klasifikasi pesan mengikuti regex collectTriggers:
           TP|TAKE PROFIT → TAKE_PROFIT, SL|STOP LOSS → STOP_LOSS,
           BUY|LONG → ENTRY_LONG, SELL|SHORT → ENTRY_SHORT.
           Kata sisi (BUY/SELL) taruh PALING DEPAN; entry.id hanya
           dekorasi & dibersihkan dari kata arah agar tidak mengubah
           klasifikasi regex. */
        const trades: any[] = Array.isArray(snap?.trades) ? snap.trades : []
        for (const tr of trades) {
          try {
            const side = String(tr?.side || 'long').toLowerCase()
            const isShort = side === 'short'
            const e = tr?.entry
            if (e && Number.isFinite(Number(e.time))) {
              const idx = bars.findIndex((b) => b.time === Number(e.time))
              const idSafe = String(e.id || '').replace(/buy|sell|long|short/gi, '').trim()
              engineAlerts.push({
                message: `STRATEGY ${isShort ? 'SELL SHORT' : 'BUY LONG'} entry ${idSafe ? `(${idSafe}) ` : ''}@ ${String(e.price ?? '')}`,
                time: Number(e.time),
                barIndex: idx,
              })
            }
            const ex = tr?.exit
            if (ex && Number.isFinite(Number(ex.time))) {
              const idx = bars.findIndex((b) => b.time === Number(ex.time))
              const isLoss = Number(tr?.pnl) < 0
              const idSafe = String(ex.id || '').replace(/buy|sell|long|short|stop|take|profit|loss/gi, '').trim()
              engineAlerts.push({
                message: `STRATEGY ${isLoss ? 'STOP LOSS' : 'TAKE PROFIT'} exit ${idSafe ? `(${idSafe}) ` : ''}@ ${String(ex.price ?? '')}`,
                time: Number(ex.time),
                barIndex: idx,
              })
            }
          } catch { /* trade aneh — lewati */ }
        }
        let plots: PlotSeries[]
        /* Style NON-GARIS (shape/char/background/label/table/drawing_*) tidak
           boleh dijadikan garis (true/false → garis 0/1 aneh di chart).
           Semua sudah diekstrak jadi `visuals` — buang dari daftar series. */
        const NON_LINE_STYLES = new Set(['shape', 'char', 'background', 'label', 'table', 'drawing_line', 'drawing_box', 'drawing_polyline', 'linefill', 'barcolor', 'fill', 'hline', 'bar', 'candle', 'arrow'])
        const lineKeys = keys.filter((k) => {
          const st = String(plotsRaw[k]?.options?.style || '')
          return !st || !NON_LINE_STYLES.has(st)
        })
        if (lineKeys.length) {
          plots = lineKeys.map((k, i) => {
            const pts = Array.isArray(plotsRaw[k]) ? plotsRaw[k] : []
            /* Judul = title Pine (kunci engine biasanya memakainya);
               kunci generik plot_N → "Plot n". Warna ikut deklarasi Pine. */
            const isGenericKey = /^plot_?\d*$/i.test(k)
            const title = isGenericKey ? `Plot ${i + 1}` : k
            return {
              key: k,
              title,
              kind: 'line' as const,
              color: colorMap[k] || PALETTE[i % PALETTE.length],
              data: pts
                .map((p: any) => ({ time: Number(p?.time), value: p?.value == null ? null : Number(p.value) }))
                .filter((p: any) => Number.isFinite(p.time))
                .map((p: any) => ({ time: p.time, value: Number.isFinite(p.value) ? p.value : null })),
            }
          })
        } else if (trades.length) {
          /* strategy() VERBATIM tanpa plot() → segmen Entry/SL/TP dari trades
             (Luxtradee Candle Impulsif — permintaan Bos). */
          plots = synthesizeTradePlots(bars, trades)
        } else {
          /* Skrip murni visual (plotshape/label saja, tanpa plot angka)
             → sah: plots kosong + visuals terisi (route/client menangani). */
          const visuals = extractPineVisuals(plotsRaw)
          if (visuals) {
            resolve({ ok: true, title: String(snap?.meta?.title || 'Luxtradee Pro Script'), overlay: snap?.meta?.overlay !== false, plots: [], visuals, engineAlerts })
            return
          }
          resolve({ ok: false, error: 'Skrip berjalan, tetapi tidak menghasilkan plot (tambahkan plot(...))' })
          return
        }
        resolve({
          ok: true,
          title: String(snap?.meta?.title || 'Luxtradee Pro Script'),
          overlay: snap?.meta?.overlay !== false,
          plots,
          visuals: extractPineVisuals(plotsRaw),
          engineAlerts,
        })
      } catch (x: any) {
        resolve({ ok: false, error: `Gagal membaca hasil engine: ${String(x?.message || x).slice(0, 140)}` })
      } finally {
        try { session?.stop?.() } catch {}
      }
    }

    const timer = setTimeout(() => finish('Timeout: engine Pine tidak selesai dalam 15 detik'), 15000)

    try {
      session = engine.execute(
        {
          prepared,
          market: { symbol, timeframe },
          bars,
          mode: 'static',
        } as any,
        {
          onModel: () => { /* model penuh tidak dipakai — kita baca via getContext */ },
          onAlert: (a: any) => {
            engineAlerts.push({ message: String(a?.message || ''), time: Number(a?.time) || Date.now(), barIndex: Number(a?.barIndex) || 0 })
          },
          onError: (e: any) => finish(`Engine error: ${String(e?.message || e).replace(/https?:\/\/\S+/g, '').slice(0, 160)}`),
          onDone: () => finish(),
        } as any,
      )
      /* Beberapa engine versi lama tak memanggil onDone untuk static run —
         poll getContext sampai plots terisi (maks timeout di atas). */
      if (session && typeof session.getContext === 'function') {
        const poll = setInterval(async () => {
          if (settled) { clearInterval(poll); return }
          try {
            const snap = await session.getContext(['plots'])
            if (snap?.plots && Object.keys(snap.plots).length) {
              clearInterval(poll)
              finish()
            }
          } catch { /* engine belum siap — coba lagi */ }
        }, 400)
        const clearPoll = setTimeout(() => { try { clearInterval(poll) } catch {} }, 15000)
        ;(session as any).__ltxClearPoll = clearPoll
      }
    } catch (x: any) {
      finish(`execute gagal: ${String(x?.message || x).slice(0, 140)}`)
    }
  })
}

/* ============================================================
   ALERT RULES DECLARATIF — fallback utk skrip tanpa alert()
   ============================================================
   Format alert_rules (jsonb di protected_scripts):
   [{ "type": "cross_above" | "cross_below" | "above" | "below",
      "a": "<plotKey|last>",          // series A (plot key atau harga close)
      "b": <number | "<plotKey>">,    // level / series B
      "signal": "ENTRY_LONG" | "ENTRY_SHORT" | "SL" | "TP" | (bebas),
      "message": "opsional, keterangan manusiawi" }]
   Evaluasi pada bar TERAKHIR (sedang berjalan) + bar penutupan terakhir. */

function valueAt(
  src: string,
  b: number | string | undefined,
  plots: Record<string, PlotSeries>,
  barIdx: number,
  bars: Array<{ close: number }>,
): number | null {
  if (typeof b === 'number') return b
  if (b === 'close' || (src === 'a' && b === 'last')) return bars[barIdx]?.close ?? null
  if (typeof b === 'string' && plots[b]) {
    const v = plots[b].data[barIdx]?.value
    return v == null ? null : v
  }
  if (typeof b === 'string' && plots[b] === undefined && b !== 'close') {
    // coba indeks "plot_0" dkk dengan nama bebas
    return null
  }
  return null
}

function seriesA(rule: AlertRule, plots: Record<string, PlotSeries>, bars: Array<{ close: number }>): Array<number | null> | null {
  if (rule.a === 'close' || rule.a === 'last') return bars.map((x) => x.close)
  const p = plots[rule.a]
  if (!p) return null
  return p.data.map((d) => d.value)
}

/** cross_above: A menembus ke ATAS B pada bar `i` (A<=B di i-1, A>B di i) */
function crossed(a: Array<number | null>, b: Array<number | null>, i: number, up: boolean): boolean {
  if (i < 1) return false
  const a0 = a[i - 1], a1 = a[i], b0 = b[i - 1], b1 = b[i]
  if (a0 == null || a1 == null || b0 == null || b1 == null) return false
  return up ? (a0 <= b0 && a1 > b1) : (a0 >= b0 && a1 < b1)
}

export function evaluateAlertRules(
  rules: AlertRule[] | null | undefined,
  plots: PlotSeries[],
  bars: Array<{ time: number; close: number }>,
  lookbackBars = 1,
): AlertTrigger[] {
  if (!Array.isArray(rules) || !rules.length || !bars.length) return []
  const plotsMap: Record<string, PlotSeries> = {}
  for (let i = 0; i < plots.length; i++) {
    plotsMap[plots[i].key] = plots[i]
    /* Alias stabil per-indeks: rule bisa pakai "plot_0", "plot_1", …
       tanpa bergantung pada penamaan internal engine */
    if (!plotsMap[`plot_${i}`]) plotsMap[`plot_${i}`] = plots[i]
  }
  const triggers: AlertTrigger[] = []
  const lastIdx = bars.length - 1

  /* FIX "sinyal lewat": cron bisa telat (GHA 5 menit / CF 15 menit /
     outage). Sinyal EVENT (cross) dievaluasi pada `lookbackBars` bar
     terakhir — duplikasi kirim dicegah dedupe DB per-bar
     (pine_alert_log unique user+script+symbol+signal+bar_time).
     Sinyal STATE (above/below) tetap hanya bar terakhir (state
     berlangsung tiap bar — kalau di-window akan spam). */
  const firstEvalIdx = Math.max(1, lastIdx - Math.max(1, lookbackBars) + 1)

  for (const rule of rules) {
    try {
      const a = seriesA(rule, plotsMap, bars)
      if (!a) continue
      const isNumber = typeof rule.b === 'number'
      const b: Array<number | null> = isNumber
        ? bars.map(() => rule.b as number)
        : (rule.b === 'close' ? bars.map((x) => x.close) : (plotsMap[String(rule.b)]?.data.map((d) => d.value) ?? []))
      if (!b.length) continue

      const isState = rule.type === 'above' || rule.type === 'below'
      const from = isState ? lastIdx : firstEvalIdx
      for (let i = from; i <= lastIdx; i++) {
        let fire = false
        if (rule.type === 'cross_above') fire = crossed(a, b, i, true)
        else if (rule.type === 'cross_below') fire = crossed(a, b, i, false)
        else if (rule.type === 'above') fire = a[i] != null && b[i] != null && a[i]! > b[i]!
        else if (rule.type === 'below') fire = a[i] != null && b[i] != null && a[i]! < b[i]!
        if (!fire) continue

        triggers.push({
          signal: String(rule.signal || 'SIGNAL').toUpperCase(),
          message: String(rule.message || rule.signal || 'Sinyal indikator'),
          time: bars[i].time,
          price: bars[i].close,
        })
      }
    } catch { /* rule rusak — lewati, jangan bunuh run */ }
  }
  return triggers
}

/* ============================================================
   KUMPULKAN PEMICU — JENDELA CATCH-UP (default 6 bar terakhir).
   Dulu HANYA bar terakhir → sinyal yang muncul sesaat sebelum cron
   tick (atau saat candle source belum memuat bar berjalan) hilang
   senyap selamanya. Sekarang event (alert()/entry/SL/TP/cross)
   dicari dalam jendela; kirim-ganda dicegah dedupe DB per-bar
   (pine_alert_log unique) + memDedupe 5 menit.
   ============================================================ */
export const ALERT_LOOKBACK_BARS = 6

export function collectTriggers(opts: {
  engineAlerts: Array<{ message: string; time: number; barIndex: number }>
  rules: AlertRule[] | null | undefined
  plots: PlotSeries[]
  bars: Array<{ time: number; close: number }>
  lookbackBars?: number
}): AlertTrigger[] {
  const { engineAlerts, rules, plots, bars } = opts
  const lookback = Math.max(1, opts.lookbackBars ?? ALERT_LOOKBACK_BARS)
  const triggers: AlertTrigger[] = []
  if (!bars.length) return triggers
  const lastBar = bars[bars.length - 1]
  const cutoffSec = bars[Math.max(0, bars.length - lookback)].time

  /* a) Sinyal dari event engine (alert() / trade entry-exit) —
     semua event dalam jendela catch-up */
  for (const a of engineAlerts) {
    const barSec = Number(a.barIndex) >= 0 && bars[a.barIndex] ? bars[a.barIndex].time : Math.floor(a.time / 1000)
    if (barSec < cutoffSec) continue // di luar jendela → abaikan
    const msg = String(a.message || 'Sinyal indikator')
    const sig = /TP|TAKE.?PROFIT/i.test(msg) ? 'TAKE_PROFIT'
      : /SL|STOP.?LOSS/i.test(msg) ? 'STOP_LOSS'
      : /BUY|LONG|BULL/i.test(msg) ? 'ENTRY_LONG'
      : /SELL|SHORT|BEAR/i.test(msg) ? 'ENTRY_SHORT' : 'SIGNAL'
    triggers.push({ signal: sig, message: msg, time: barSec, price: bars[a.barIndex]?.close ?? lastBar.close })
  }

  /* b) Sinyal dari alert_rules declaratif (skrip tanpa alert()) —
     cross = event (jendela), above/below = state (bar terakhir) */
  triggers.push(...evaluateAlertRules(rules, plots, bars, lookback))
  return triggers
}

/* valueAt masih diekspor utk pemakaian lanjutan (tes rules manual) */
export { valueAt }
