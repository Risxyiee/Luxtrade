/**
 * ============================================================
 * pine-protected — Protected Custom Pine Script® (server-side)
 * ============================================================
 * ATURAN KEAMANAN (keinginan Bos, Task 41):
 *   1. Source Pine master script TIDAK PERNAH dikirim ke browser.
 *   2. Script master disimpan di tabel `protected_scripts`
 *      (Supabase, RLS tanpa policy → hanya service role).
 *   3. Server menjalankan engine PineTS (yang sama dengan chart)
 *      secara HEADLESS terhadap candle server (TradingView →
 *      TwelveData → Yahoo — keyless, tanpa API key),
 *      lalu HANYA mengembalikan hasil plot {time, value} + sinyal.
 *   4. Alert Entry/SL/TP terdeteksi server (event `alert()` engine
 *      + alert_rules declaratif), di-dedupe per-bar, lalu diteruskan
 *      ke Telegram user Pro (profiles.telegram_chat_id).
 *
 * File ini WAJIB hanya diimpor dari server (API route).
 */

import { fetchServerCandles, intervalSeconds } from '@/lib/market/server-candles'

/* ============================================================
   1) HEADLESS PINE ENGINE — compute plots tanpa browser
   ============================================================ */

export interface PlotSeries {
  key: string
  title: string
  kind: 'line'
  color: string
  /** {time: epoch ms, value} — value null = gap */
  data: Array<{ time: number; value: number | null }>
}

export interface PineRunResult {
  ok: boolean
  error?: string
  title?: string
  overlay?: boolean
  plots?: PlotSeries[]
  /** Alert bawaan engine (script memakai alert()/alertcondition) */
  engineAlerts?: Array<{ message: string; time: number; barIndex: number }>
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
function scanPlotColors(source: string): Record<string, string> {
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
 * Jalankan source Pine di server (headless) atas `bars`.
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
           skrip strategy() Bos ikut memicu alert Telegram. */
        const snap = await session?.getContext?.(['plots', 'meta', 'trades'])
        const plotsRaw: Record<string, any> = snap?.plots || {}
        const keys = Object.keys(plotsRaw)
        if (!keys.length) {
          resolve({ ok: false, error: 'Skrip berjalan, tetapi tidak menghasilkan plot (tambahkan plot(...))' })
          return
        }

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
        const plots: PlotSeries[] = keys.map((k, i) => {
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
        resolve({
          ok: true,
          title: String(snap?.meta?.title || 'Luxtradee Pro Script'),
          overlay: snap?.meta?.overlay !== false,
          plots,
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
   2) ALERT RULES DECLARATIF — fallback utk skrip tanpa alert()
   ============================================================
   Format alert_rules (jsonb di protected_scripts):
   [{ "type": "cross_above" | "cross_below" | "above" | "below",
      "a": "<plotKey|last>",          // series A (plot key atau harga close)
      "b": <number | "<plotKey>">,    // level / series B
      "signal": "ENTRY_LONG" | "ENTRY_SHORT" | "SL" | "TP" | (bebas),
      "message": "opsional, keterangan manusiawi" }]
   Evaluasi pada bar TERAKHIR (sedang berjalan) + bar penutupan terakhir. */

export interface AlertRule {
  type: 'cross_above' | 'cross_below' | 'above' | 'below'
  a: string
  b: number | string
  signal: string
  message?: string
}

interface Trigger {
  signal: string
  message: string
  time: number // epoch detik (open time bar pemicu)
  price: number
}

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
): Trigger[] {
  if (!Array.isArray(rules) || !rules.length || !bars.length) return []
  const plotsMap: Record<string, PlotSeries> = {}
  for (let i = 0; i < plots.length; i++) {
    plotsMap[plots[i].key] = plots[i]
    /* Alias stabil per-indeks: rule bisa pakai "plot_0", "plot_1", …
       tanpa bergantung pada penamaan internal engine */
    if (!plotsMap[`plot_${i}`]) plotsMap[`plot_${i}`] = plots[i]
  }
  const triggers: Trigger[] = []
  const lastIdx = bars.length - 1
  const lastBar = bars[lastIdx]

  for (const rule of rules) {
    try {
      const a = seriesA(rule, plotsMap, bars)
      if (!a) continue
      const isNumber = typeof rule.b === 'number'
      const b: Array<number | null> = isNumber
        ? bars.map(() => rule.b as number)
        : (rule.b === 'close' ? bars.map((x) => x.close) : (plotsMap[String(rule.b)]?.data.map((d) => d.value) ?? []))
      if (!b.length) continue

      let fire = false
      if (rule.type === 'cross_above') fire = crossed(a, b, lastIdx, true)
      else if (rule.type === 'cross_below') fire = crossed(a, b, lastIdx, false)
      else if (rule.type === 'above') fire = a[lastIdx] != null && b[lastIdx] != null && a[lastIdx]! > b[lastIdx]!
      else if (rule.type === 'below') fire = a[lastIdx] != null && b[lastIdx] != null && a[lastIdx]! < b[lastIdx]!
      if (!fire) continue

      triggers.push({
        signal: String(rule.signal || 'SIGNAL').toUpperCase(),
        message: String(rule.message || rule.signal || 'Sinyal indikator'),
        time: lastBar.time,
        price: lastBar.close,
      })
    } catch { /* rule rusak — lewati, jangan bunuh run */ }
  }
  return triggers
}

/* ============================================================
   3) TELEGRAM — kirim sinyal ke user Pro (chat_id dari profiles)
   ============================================================ */

export async function sendTelegramToUser(chatId: string, html: string): Promise<boolean> {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim()
  if (!token || !chatId) return false
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: html.slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true }),
      cache: 'no-store',
    })
    return res.ok
  } catch {
    return false
  }
}

export function formatSignalMessage(opts: {
  scriptName: string
  symbol: string
  interval: string
  signal: string
  price: number
  barTimeSec: number
  extra?: string
}): string {
  const d = new Date(opts.barTimeSec * 1000)
  const wib = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short',
  }).format(d)
  const icon =
    /ENTRY_?LONG|BUY|LONG/i.test(opts.signal) ? '🟢' :
    /ENTRY_?SHORT|SELL|SHORT/i.test(opts.signal) ? '🔴' :
    /TP|TAKE/i.test(opts.signal) ? '🎯' :
    /SL|STOP/i.test(opts.signal) ? '🛑' : '🔔'
  return [
    `${icon} <b>LUXTRADEE PRO SIGNAL</b>`,
    ``,
    `📐 Script: <b>${opts.scriptName}</b>`,
    `💱 Pair: <b>${opts.symbol}</b> (${opts.interval})`,
    `⚡ Sinyal: <b>${opts.signal.replace(/_/g, ' ')}</b>`,
    `💲 Harga: <b>${opts.price}</b>`,
    `⏰ Bar: ${wib} WIB`,
    opts.extra ? `\n${opts.extra}` : '',
    ``,
    `<i>Alert otomatis indikator terproteksi Luxtradee — jangan dibagikan.</i>`,
  ].join('\n')
}

/* Re-export agar route tidak impor dua lib */
export { fetchServerCandles, intervalSeconds }
