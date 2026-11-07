'use client'

/**
 * ============================================================
 * PineAlertShowcase — "video" animasi fitur Pine Script® + Alert
 * ============================================================
 * Storyboard 11 detik (loop = remount panel tiap 11s):
 *   0.0–5.6s  candle TERBENTUK LIVE tick-demi-tick (random-walk,
 *             wick memanjang, volume tumbuh, harga axis ikut) —
 *             FIX Bos: "dilandingpage gerakan candle nya kurang
 *             realistis" → dulu candle statis muncul bergiliran,
 *             sekarang bergerak seperti chart sungguhan. Tiap
 *             loop = data BARU (seed acak per siklus).
 *   2.0–5.0s  editor Pine — kode ngetik sendiri (typewriter)
 *   4.95s     tombol Compile "ditekan"
 *   5.3–7.0s  garis indikator MENGGAMBAR DIRINYA (+ komet biru
 *             mengikuti ujung garis, SMIL animateMotion)
 *   5.6–5.9s  candle BREAKOUT terbentuk live menembus resistance
 *             → garis flash biru
 *   6.9s      crosshair + push notif terbang masuk
 *   10.3s     fadeout → 11s remount
 *
 * TEKNIS (penting — ini bukan file video):
 *   - Murni SVG + JS interval (setInterval 76ms) — tanpa canvas,
 *     tajam di retina/4K, ~0 KB asset.
 *   - Candle di-GENERASI (random walk ber-drift dengan pullback +
 *     mean-reversion di resistance) bukan array statis → gerakan
 *     berbeda tiap loop, terasa "live" seperti data sungguhan.
 *   - Cerita tetap terkontrol: uptrend → konsolidasi → BREAKOUT
 *     (posisi & timing breakout dipatok supaya sinkron dengan
 *     flash/indikator/push).
 *   - Tag harga di axis kanan UPDAT SETIAP TICK mengikuti harga
 *     terakhir (hijau/merah mengikuti arah candle) + garis
 *     last-price putus-putus bergerak.
 *   - IntersectionObserver → animasi hanya saat terlihat; pause
 *     otomatis saat keluar viewport (hemat CPU/baterai).
 *   - prefers-reduced-motion → langsung state akhir (aksesibilitas).
 */

import { useEffect, useMemo, useRef, useState } from 'react'

const CYCLE_MS = 11_000

/* ---------- Kode Pine yang di-typewriter (visual demo) ---------- */
const PINE_LINES = [
  '//@version=6',
  'indicator("Luxtradee Breakout")',
  'break = ta.crossover(close, high[1])',
  'plot(break ? close : na)',
]

const ID = {
  badge: 'BARU · FITUR PRO',
  title: 'Pine Script® + Auto Alerts,',
  titleAccent: 'Right on Your Chart',
  sub: 'Tulis indikatormu sendiri, compile dalam sekejap, dan biarkan sinyal Entry/SL/TP mendarat di HP kamu — bahkan saat aplikasi tertutup.',
  compile: 'Compile',
  pushTitle: '🚀 ENTRY_LONG — XAUUSD · 1h',
  pushBody: 'Luxtradee Breakout · Price ~2,406.0',
  pushApp: 'LuxTradee · now',
  cta: 'Coba Gratis Sekarang',
  ctaNote: 'Gratis — tanpa kartu kredit',
  scene: [
    'Chart live, data real-time',
    'Tulis Pine Script®-mu',
    'Compile → indikator muncul',
    'Alert langsung ke HP kamu',
  ],
}

const EN = {
  badge: 'NEW · PRO FEATURE',
  title: 'Pine Script® + Auto Alerts,',
  titleAccent: 'Right on Your Chart',
  sub: 'Write your own indicator, compile it in a snap, and let Entry/SL/TP signals land on your phone — even with the app closed.',
  compile: 'Compile',
  pushTitle: '🚀 ENTRY_LONG — XAUUSD · 1h',
  pushBody: 'Luxtradee Breakout · Price ~2,406.0',
  pushApp: 'LuxTradee · now',
  cta: 'Try It Free Now',
  ctaNote: 'Free — no credit card required',
  scene: [
    'Live chart, real-time data',
    'Write your Pine Script®',
    'Compile → indicator appears',
    'Alerts straight to your phone',
  ],
}

export default function PineAlertShowcase({ language = 'id' }: { language?: 'id' | 'en' }) {
  const t = language === 'en' ? EN : ID
  const hostRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  /* Loop: remount panel tiap 11 detik → semua animasi restart akurat */
  const [cycle, setCycle] = useState(0)

  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => setInView(e.isIntersecting)),
      { threshold: 0.2 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!inView) return
    const id = setInterval(() => setCycle((c) => c + 1), CYCLE_MS)
    return () => clearInterval(id)
  }, [inView])

  /* ============================================================
     MESIN CANDLE LIVE (random-walk + tick realistis)
     - seed acak per siklus (remount) → gerakan beda tiap loop.
     - seed=0 saat SSR/hidrasi → deterministik, bebas mismatch.
     ============================================================ */
  const [seed, setSeed] = useState(0)
  const [tick, setTick] = useState(0)
  const reduceRef = useRef(false)

  useEffect(() => {
    /* sesi browser: randomize seed + hormati reduced-motion */
    setSeed(Math.floor(Math.random() * 2 ** 30))
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        reduceRef.current = true
        setTick(TOTAL_TICKS)
      }
    } catch { /* diam */ }
  }, [])

  /* FIX "gerakannya kurang": dulu tick TIDAK PERNAH direset saat siklus
     baru mulai → setelah putaran pertama candle BEKU di frame akhir dan
     hanya efek CSS yang replay. Sekarang: tiap siklus = data baru +
     animasi candle jalan lagi dari nol. */
  useEffect(() => {
    if (cycle === 0) return
    setSeed(Math.floor(Math.random() * 2 ** 30))
    setTick(reduceRef.current ? TOTAL_TICKS : 0)
  }, [cycle])

  useEffect(() => {
    if (!inView) return
    if (tick >= TOTAL_TICKS) return
    const id = setInterval(() => setTick((v) => Math.min(v + 1, TOTAL_TICKS)), TICK_MS)
    return () => clearInterval(id)
  }, [inView, tick >= TOTAL_TICKS])

  const candles = useMemo(() => genCandles(mulberry32(seed)), [seed])

  /* indikator EMA "lagging" dari closes yang digenerate — selalu
     nyambung dengan candle (dulu: path statis manual) */
  const ind = useMemo(() => {
    const ema: number[] = []
    let e = candles[0].c
    for (const c of candles) {
      e = e * 0.72 + c.c * 0.28
      ema.push(e)
    }
    const pts: [number, number][] = [0, 2, 4, 6, 8, 10, 12, 14].map((i) => [candles[i].x + BW / 2, ema[i]])
    const path = smoothPath(pts)
    const len = Math.round(
      pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0) * 1.06,
    )
    return { path, len, last: pts[pts.length - 1] }
  }, [candles])

  /* state live: candle selesai + candle yang sedang terbentuk */
  const done = Math.min(Math.floor(tick / TICKS_PER_CANDLE), candles.length)
  const prog = ((tick % TICKS_PER_CANDLE) + 1) / TICKS_PER_CANDLE
  const view: Array<Candle & { live?: boolean }> = candles.slice(0, done).map((c) => ({ ...c }))
  if (done < candles.length) view.push({ ...liveCandle(candles[done], prog, tick, seed), live: true })
  const last = view[view.length - 1]
  const lpBull = last ? last.c < last.o : true // y kecil = harga tinggi → bullish
  const lpY = last ? last.c : RES_Y
  const lpText = priceFromY(lpY)

  return (
    <section className="relative py-16 md:py-24 px-4 overflow-hidden" aria-label="Demo fitur Pine Script dan alert otomatis">
      {/* Glow latar lembut */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[420px] rounded-full bg-blue-600/[0.08] blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto text-center">
        <span className="inline-block text-[11px] font-bold tracking-widest px-3 py-1 rounded-full border border-blue-400/30 bg-blue-400/10 text-blue-200 mb-5">
          {t.badge}
        </span>
        <h2 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight">
          {t.title}{' '}
          <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-300 bg-clip-text text-transparent">
            {t.titleAccent}
          </span>
        </h2>
        <p className="mt-4 text-blue-100/50 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">{t.sub}</p>

        {/* ============ "VIDEO" ANIMASI ============ */}
        <div ref={hostRef} className={`lxs mt-10 md:mt-14 ${inView ? 'lxs-run' : ''}`}>
          <style>{LXS_CSS}</style>

          {/* key={cycle} → remount tiap siklus, animasi restart bersih */}
          <div
            key={cycle}
            className={`relative rounded-2xl border border-white/10 bg-[#070a12] shadow-[0_30px_80px_-20px_rgba(34,211,238,0.22)] overflow-hidden text-left ${inView ? '' : 'lxs-paused'}`}
          >
            {/* Bar jendela terminal */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" aria-hidden="true" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-300/70" aria-hidden="true" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" aria-hidden="true" />
              <span className="ml-3 text-[11px] text-blue-200/50 font-medium tracking-wide">
                LuxTradee Terminal — XAUUSD · 1h
              </span>
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-blue-400/10 border border-blue-400/25 text-blue-300 flex items-center gap-1">
                <span className="lxs-live-dot w-1.5 h-1.5 rounded-full bg-blue-400" aria-hidden="true" /> LIVE
              </span>
            </div>

            <div className="relative grid md:grid-cols-[1fr_260px]">
              {/* ---- CHART (SVG candle HIDUP — random walk tick-per-tick) ---- */}
              <div className="relative aspect-[16/10] md:h-[420px]">
                <svg viewBox="0 0 720 400" className="absolute inset-0 w-full h-full" aria-hidden="true">
                  <defs>
                    {/* gradient area di bawah garis indikator */}
                    <linearGradient id="lxs-ind-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(59,130,246,0.28)" />
                      <stop offset="100%" stopColor="rgba(59,130,246,0)" />
                    </linearGradient>
                    {/* gradient garis indikator biru → cyan */}
                    <linearGradient id="lxs-ind-line" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#22d3ee" />
                    </linearGradient>
                    {/* glow flash saat breakout */}
                    <radialGradient id="lxs-break-glow">
                      <stop offset="0%" stopColor="rgba(147,197,253,0.55)" />
                      <stop offset="100%" stopColor="rgba(147,197,253,0)" />
                    </radialGradient>
                  </defs>

                  {/* grid halus — sejajar level harga & label waktu */}
                  {PRICE_LEVELS.map((lvl) => (
                    <line key={`h${lvl.y}`} x1="0" x2="648" y1={lvl.y} y2={lvl.y} stroke="rgba(255,255,255,0.045)" strokeWidth="1" />
                  ))}
                  {TIME_LABELS.map((tm) => (
                    <line key={`v${tm.x}`} y1="14" y2="372" x1={tm.x} x2={tm.x} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                  ))}

                  {/* watermark ala TradingView */}
                  <text x="340" y="228" textAnchor="middle" fontSize="44" fontWeight="800" letterSpacing="10" fill="rgba(96,165,250,0.05)">
                    LUXTRADEE
                  </text>

                  {/* level resistance (garis putus biru) */}
                  <line className="lxs-level" x1="0" x2="648" y1={RES_Y} y2={RES_Y} stroke="rgba(147,197,253,0.45)" strokeWidth="1.5" strokeDasharray="7 6" />
                  <text x="8" y={RES_Y - 8} fill="rgba(147,197,253,0.55)" fontSize="11">Resistance 2.400</text>

                  {/* sumbu harga kanan + label waktu bawah */}
                  {PRICE_LEVELS.map((lvl) => (
                    <text key={`p${lvl.y}`} x="656" y={lvl.y + 3.5} fill="rgba(147,197,253,0.35)" fontSize="10">{lvl.label}</text>
                  ))}
                  {TIME_LABELS.map((tm) => (
                    <text key={`t${tm.x}`} x={tm.x} y="391" textAnchor="middle" fill="rgba(147,197,253,0.3)" fontSize="9">{tm.label}</text>
                  ))}
                  <line x1="0" x2="648" y1="372" y2="372" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />

                  {/* ===== CANDLE + VOLUME + HARGA LIVE (tick realistis) ===== */}
                  <g className="lxs-live-wrap">
                    {/* bar volume — tumbuh bareng candle */}
                    {view.map((c, i) => (
                      <rect
                        key={`vol${i}`}
                        x={c.x} width={BW}
                        y={VOL_BASE - c.vol} height={c.vol} rx="2"
                        fill={candleColor(c)} fillOpacity={i === candles.length - 1 ? 0.55 : 0.22}
                      />
                    ))}

                    {/* candles — wick memanjang & body tumbuh tiap tick */}
                    {view.map((c, i) => {
                      const isBreak = i === candles.length - 1
                      const bull = c.c < c.o
                      return (
                        <g key={`cd${i}`}>
                          <line x1={c.x + BW / 2} x2={c.x + BW / 2} y1={c.wt} y2={c.wb} stroke={isBreak ? '#4ade80' : candleColor(c)} strokeWidth="1.6" />
                          <rect
                            x={c.x} width={BW}
                            y={Math.min(c.o, c.c)}
                            height={Math.max(2, Math.abs(c.c - c.o))}
                            rx="2"
                            fill={isBreak ? '#4ade80' : candleColor(c)}
                            style={c.live
                              ? { filter: bull ? 'drop-shadow(0 0 6px rgba(74,222,128,0.6))' : 'drop-shadow(0 0 6px rgba(248,113,113,0.6))' }
                              : undefined}
                          />
                        </g>
                      )
                    })}

                    {/* garis last-price putus-putus + tag harga axis kanan
                        (UPDAT SETIAP TICK — ala TradingView sungguhan) */}
                    <line x1="0" x2="648" y1={lpY} y2={lpY} stroke="rgba(147,197,253,0.3)" strokeWidth="1" strokeDasharray="3 4" />
                    <rect x="652" y={lpY - 9} width="56" height="18" rx="4" fill={lpBull ? '#10b981' : '#ef4444'} />
                    <text x="680" y={lpY + 3.5} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#ffffff">{lpText}</text>
                  </g>

                  {/* area di bawah indikator (fade-in setelah garis selesai) */}
                  <path className="lxs-ind-area" d={`${ind.path} L ${ind.last[0]} 372 L ${candles[0].x + BW / 2} 372 Z`} fill="url(#lxs-ind-area)" />

                  {/* garis indikator — menggambar dirinya setelah "compile" */}
                  <path
                    className="lxs-indicator"
                    d={ind.path}
                    fill="none"
                    stroke="url(#lxs-ind-line)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    style={{
                      strokeDasharray: ind.len,
                      strokeDashoffset: ind.len,
                      '--lxs-ind-len': ind.len,
                    } as React.CSSProperties}
                  />

                  {/* titik ujung garis (nyala setelah gambar selesai) */}
                  <circle className="lxs-end-dot" cx={ind.last[0]} cy={ind.last[1]} r="8" fill="rgba(96,165,250,0.25)" />
                  <circle className="lxs-end-dot" cx={ind.last[0]} cy={ind.last[1]} r="3.5" fill="#93c5fd" />

                  {/* komet biru mengikuti ujung garis saat menggambar (SMIL) */}
                  {inView && (
                    <g className="lxs-comet">
                      <circle r="9" fill="rgba(96,165,250,0.3)" />
                      <circle r="3.5" fill="#dbeafe" />
                      <animateMotion
                        dur="1.7s" begin="5.3s" fill="freeze"
                        calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1"
                        path={ind.path}
                      />
                    </g>
                  )}

                  {/* flash glow saat breakout (5.7s — pas candle breakout live) */}
                  <circle className="lxs-break-glow" cx={candles[candles.length - 1].x + BW / 2} cy={candles[candles.length - 1].c} r="26" fill="url(#lxs-break-glow)" />

                  {/* crosshair vertikal (ala TradingView, 7.0s) */}
                  <line className="lxs-cross" x1={candles[candles.length - 1].x + BW / 2} x2={candles[candles.length - 1].x + BW / 2} y1="14" y2="372" stroke="rgba(96,165,250,0.35)" strokeWidth="1" strokeDasharray="4 4" />
                </svg>

                {/* caption scene — baris subtitle di bawah chart */}
                <div className="absolute bottom-2.5 left-2.5 right-2.5 flex flex-wrap items-center justify-center gap-1.5 pointer-events-none">
                  {t.scene.map((s, i) => (
                    <span
                      key={i}
                      className={`lxs-scene lxs-scene-${i + 1} text-[11px] md:text-xs px-2.5 py-1 rounded-full border backdrop-blur ${
                        i === 3
                          ? 'border-blue-400/45 bg-blue-400/10 text-blue-200'
                          : 'border-blue-400/20 bg-[#0a1524]/70 text-blue-100/80'
                      }`}
                    >
                      {['①', '②', '③', '④'][i]} {s}
                    </span>
                  ))}
                </div>

                {/* ---- PUSH NOTIF (terbang masuk — di area chart saja) ---- */}
                <div className="lxs-push absolute top-3 right-3 w-[calc(100%-24px)] max-w-[240px] md:max-w-[300px] rounded-xl border border-blue-400/25 bg-[#0c1526]/95 backdrop-blur shadow-2xl p-2.5 md:p-3 flex gap-2.5 md:gap-3 items-start z-10">
                  <span className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-blue-400/15 border border-blue-400/30 grid place-items-center text-base md:text-lg shrink-0" aria-hidden="true">⚡</span>
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold tracking-wide text-blue-200 truncate">{t.pushApp}</span>
                      <span className="text-[9.5px] text-blue-200/40 shrink-0">1s</span>
                    </div>
                    <div className="text-[11.5px] font-semibold text-blue-100 truncate">{t.pushTitle}</div>
                    <div className="text-[10.5px] text-blue-200/55 truncate">{t.pushBody}</div>
                  </div>
                </div>
              </div>

              {/* ---- EDITOR PINE (typewriter) ---- */}
              <div className="relative border-t md:border-t-0 md:border-l border-white/[0.06] bg-black/40">
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
                  <span className="text-[10.5px] uppercase tracking-widest text-blue-200/45">Pine Editor®</span>
                  {/* tombol compile "ditekan" pada siklus */}
                  <span className="lxs-compile text-[10.5px] font-semibold px-2.5 py-1 rounded-md bg-gradient-to-r from-blue-500 to-cyan-400 text-white">
                    ▶ {t.compile}
                  </span>
                </div>
                <pre className="lxs-code px-3 py-3 text-[10.5px] md:text-[11px] leading-[1.75] font-mono text-blue-300/90 min-h-[150px] md:min-h-[360px] whitespace-pre-wrap">
                  <TypeWriter text={PINE_LINES.join('\n')} />
                  <span className="lxs-caret" aria-hidden="true">▌</span>
                </pre>
              </div>
            </div>

            {/* CTA di bawah "video" */}
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="/auth/signup"
                className="lxs-cta inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 text-white font-bold text-sm hover:opacity-90 transition-opacity min-h-[48px]"
              >
                {t.cta} <span aria-hidden="true">→</span>
              </a>
              <span className="text-xs text-blue-200/40">{t.ctaNote}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------- Typewriter: 1 span per karakter, reveal berdelay ---------- */
function TypeWriter({ text }: { text: string }) {
  /* Mulai ngetik di detik ke-2 (2.0s), selesai ±5.0s (pas sebelum Compile) */
  return (
    <>
      {text.split('').map((ch, i) => (
        <span key={i} className="lxs-ch" style={{ animationDelay: `${2 + i * 0.028}s` }}>
          {ch}
        </span>
      ))}
    </>
  )
}

/* ============================================================
   MESIN DATA CHART — random-walk REALISTIS (bukan array statis)
   KOORDINAT SVG: y KECIL = harga LEBIH TINGGI.
   Bullish = close di atas open = c.c < c.o (angka y) → HIJAU.
   Harga ↔ y: 1 USD = 10px; resistance 2400 = y 122.
   ============================================================ */
const RES_Y = 122      // y garis resistance (= harga 2.400)
const X0 = 24          // x candle pertama
const DX = 42          // jarak antar candle
const BW = 18          // lebar badan candle
const VOL_BASE = 372   // garis dasar bar volume

/* Live tick engine: 6 tick per candle × 15 candle. 15×6×63ms ≈ 5.7s →
   timing flash breakout (5.7s), indikator (5.3s) & push notif (6.9s)
   tetap sinkron — tiap candle terbentuk 6 langkah dgn path bridge
   noise + wick flicker (lihat liveCandle). */
const TICK_MS = 63
const TICKS_PER_CANDLE = 6
const PRE_COUNT = 14
const CANDLE_COUNT = PRE_COUNT + 1 // + breakout
const TOTAL_TICKS = CANDLE_COUNT * TICKS_PER_CANDLE

type Candle = { x: number; o: number; c: number; wt: number; wb: number; vol: number }

/* RNG deterministik (mulberry32) — seed per siklus */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const priceToY = (p: number) => RES_Y - (p - 2400) * 10
const priceFromY = (y: number) => (2400 + (RES_Y - y) / 10).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/* Generate 15 candle: uptrend dengan pullback BERANTAI (momentum:
   kadang 2 merah berturut) + doji konsolidasi sesekali + wick
   ASIMETRIS (kadang sumbu panjang — rejection ala chart asli),
   ditutup candle BREAKOUT besar menembus 2400. */
function genCandles(rnd: () => number): Candle[] {
  const cs: Candle[] = []
  let p = 2377 + rnd() * 9 // mulai 2377–2386 (y 292–217)
  let redRun = 0 // rantai candle turun — momentum pullback natural
  for (let i = 0; i < PRE_COUNT; i++) {
    let drift: number
    if (p > 2393.5) drift = -(1.5 + rnd() * 3) // mentok resistance → tertolak
    else if (p < 2372) drift = 1.2 + rnd() * 2 // lantai — jangan jatuh terlalu dalam
    else if (i % 5 === 3 || (redRun > 0 && rnd() < 0.38)) drift = -(1.6 + rnd() * 2.2) // pullback / lanjut turun
    else drift = 0.9 + rnd() * 2.1
    const o = p
    /* kadang doji — harga ragu (body nyaris nol) */
    const doji = drift > 0 && rnd() < 0.14
    const cRaw = doji ? o + (rnd() - 0.5) * 0.4 : o + drift + (rnd() - 0.5) * 1.6
    const c = Math.min(2395.5, Math.max(2369, cRaw))
    /* wick ASIMETRIS — 16% kemungkinan sumbu panjang (rejection) */
    const upW = rnd() < 0.16 ? 1.1 + rnd() * 2.1 : rnd() * 1.2
    const dnW = rnd() < 0.16 ? 1.1 + rnd() * 2.1 : rnd() * 1.2
    const hi = Math.max(o, c) + upW
    const lo = Math.min(o, c) - dnW
    const vol = 13 + Math.abs(c - o) * 2.4 + rnd() * 9
    cs.push({ x: X0 + i * DX, o: priceToY(o), c: priceToY(c), wt: priceToY(hi), wb: priceToY(lo), vol })
    redRun = c < o ? redRun + 1 : 0 // harga turun = candle merah
    p = c
  }
  /* BREAKOUT: open dari harga terakhir, menembus resistance sampai
     ±2.406–2.408, volume raksasa (timing live: tick ke-70..74 ≈ 5.6s) */
  const o = p
  const c = 2406.2 + rnd() * 1.4
  const hi = c + 1.2 + rnd() * 1.3
  const lo = o - 0.8 - rnd() * 1.2
  cs.push({ x: X0 + PRE_COUNT * DX, o: priceToY(o), c: priceToY(c), wt: priceToY(hi), wb: priceToY(lo), vol: 62 + rnd() * 12 })
  return cs
}

/* Candle yang sedang TERBENTUK — gerakan tick ala chart asli (dipoles
   permintaan Bos: "lumayan tapi dipoles dikit untuk candle & gerakannya"):
   - PATH: ease-out open→close + BRIDGE NOISE — derau acak yang meluruh
     ke 0 saat candle close (price bridge sungguhan: harga boleh
     menyimpang di tengah jalan tapi SELALU sampai di close).
   - VOLATILITAS PER-CANDLE: body besar (apalagi breakout) → tick
     lebih liar; candle doji → tick tenang. Ala volatility cluster.
   - WICK FLICKER: tick yang mendorong lebih tinggi/rendah memanjangkan
     sumbu sesaat — tapi TIDAK PERNAH melewati wick final datanya.
   - VOLUME: menumpuk tidak rata (ada tick sepi & sibuk) ala order flow.
   Semua deterministik (seed+tick) → SSR/hidrasi aman, gerak beda tiap
   siklus (seed baru per remount). */
function liveCandle(c: Candle, prog: number, tick: number, seed: number): Candle {
  const pe = 1 - (1 - prog) * (1 - prog) // ease-out
  const env = Math.sin(Math.PI * prog) // 0 di ujung → derau hilang saat close
  /* RNG per-tick deterministik — 3 putaran: path, flicker, volume */
  const rr = mulberry32((seed ^ Math.imul(tick + 1, 2654435761)) >>> 0)
  const n1 = rr() - 0.5
  const n2 = rr()
  const n3 = rr()
  /* volatilitas ikut tubuh candle (px) — breakout jauh lebih hidup */
  const vola = 2.0 + Math.min(9, Math.abs(c.c - c.o) * 0.14)
  const base = c.o + (c.c - c.o) * pe + n1 * 2 * vola * (1 - pe) * env
  /* wick live: tumbuh ease-out + flicker per-tick (clamp ke wick final) */
  const bodyTop = Math.min(c.o, base)
  const bodyBot = Math.max(c.o, base)
  const fUp = Math.max(0, n2 - 0.55) * 5.2 * env
  const fDn = Math.max(0, 0.45 - n2) * 5.2 * env
  const wt = Math.max(c.wt, bodyTop - (bodyTop - c.wt) * pe - fUp)
  const wb = Math.min(c.wb, bodyBot + (c.wb - bodyBot) * pe + fDn)
  const cur = Math.min(wb, Math.max(wt, base))
  const vol = Math.min(c.vol, c.vol * prog * (0.82 + n3 * 0.36))
  return { x: c.x, o: c.o, c: cur, wt, wb, vol }
}

const BULL = '#34d399'
const BEAR = '#f87171'
const candleColor = (c: Candle) => (c.c < c.o ? BULL : BEAR)

/* Sumbu harga (kanan) & label waktu (bawah) — sejajar grid */
const PRICE_LEVELS = [
  { label: '2.410', y: 72 },
  { label: '2.400', y: 122 },
  { label: '2.390', y: 172 },
  { label: '2.380', y: 222 },
  { label: '2.370', y: 272 },
]
/* label waktu di candle ke-0,3,6,9,12,14 (x = center candle) */
const TIME_LABELS = [
  { label: '08:00', x: X0 + 0 * DX + BW / 2 },
  { label: '09:00', x: X0 + 3 * DX + BW / 2 },
  { label: '10:00', x: X0 + 6 * DX + BW / 2 },
  { label: '11:00', x: X0 + 9 * DX + BW / 2 },
  { label: '12:00', x: X0 + 12 * DX + BW / 2 },
  { label: '13:00', x: X0 + 14 * DX + BW / 2 },
]

/* ---------- Indikator EMA mulus (Catmull-Rom → bezier) ---------- */
function smoothPath(pts: [number, number][]): string {
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0]} ${p2[1]}`
  }
  return d
}

/* ---------- CSS (scoped prefix lxs-) — semua ONE-SHOT, loop via remount ---------- */
const LXS_CSS = `
/* karakter kode muncul (delay per karakter di style inline) */
.lxs .lxs-ch { opacity: 0; }
.lxs-run .lxs-ch { animation: lxs-char-in 0.01s linear both; }
@keyframes lxs-char-in { from { opacity: 0 } to { opacity: 1 } }

/* caret berkedip */
.lxs .lxs-caret { color: #60a5fa; opacity: 0; }
.lxs-run .lxs-caret { animation: lxs-caret-blink 0.9s steps(2, jump-none) infinite; }
@keyframes lxs-caret-blink { 0%, 100% { opacity: 1 } 50% { opacity: 0.15 } }

/* candle + volume + tag harga LIVE — fadeout di akhir siklus
   (gerakannya dari JS tick, bukan CSS stagger — FIX "kurang realistis") */
.lxs-run .lxs-live-wrap { animation: lxs-fadeout 0.6s ease-in 10.2s both; }
@keyframes lxs-fadeout { to { opacity: 0 } }

/* flash glow saat harga menembus resistance (5.7s) */
.lxs .lxs-break-glow { opacity: 0; transform-box: fill-box; transform-origin: center; }
.lxs-run .lxs-break-glow { animation: lxs-flash 1s ease-out 5.7s both; }
@keyframes lxs-flash {
  0% { opacity: 0; transform: scale(0.4) }
  25% { opacity: 0.9 }
  100% { opacity: 0; transform: scale(1.7) }
}

/* titik LIVE berdenyut */
.lxs .lxs-live-dot { box-shadow: 0 0 0 0 rgba(96, 165, 250, 0.6); }
.lxs-run .lxs-live-dot { animation: lxs-ping 1.8s infinite; }
@keyframes lxs-ping { 70% { box-shadow: 0 0 0 7px rgba(96, 165, 250, 0) } 100% { box-shadow: 0 0 0 0 rgba(96, 165, 250, 0) } }

/* garis resistance menyala biru saat ditembus (5.8s) */
.lxs-run .lxs-level { animation: lxs-level 1.4s ease-in-out 5.8s both; }
@keyframes lxs-level {
  0% { opacity: 0.55; stroke: rgba(147, 197, 253, 0.4) }
  40% { opacity: 1; stroke: rgba(96, 165, 250, 0.95) }
  100% { opacity: 0.65; stroke: rgba(147, 197, 253, 0.55) }
}

/* tombol compile "ditekan" (4.95s) */
.lxs-run .lxs-compile { animation: lxs-compile 0.9s ease-in-out 4.95s both; }
@keyframes lxs-compile {
  0% { transform: scale(1); filter: brightness(1) }
  35% { transform: scale(0.9); filter: brightness(1.6) }
  100% { transform: scale(1); filter: brightness(1.25) }
}

/* indikator menggambar dirinya (5.3s → 7.0s) + glow halus */
.lxs .lxs-indicator { filter: drop-shadow(0 0 4px rgba(59, 130, 246, 0.45)); }
.lxs-run .lxs-indicator { animation: lxs-draw 1.7s cubic-bezier(0.4, 0, 0.2, 1) 5.3s both; }
@keyframes lxs-draw { from { stroke-dashoffset: var(--lxs-ind-len); opacity: 1 } to { stroke-dashoffset: 0; opacity: 1 } }

/* area di bawah indikator fade-in setelah garis selesai (6.6s) */
.lxs .lxs-ind-area { opacity: 0; }
.lxs-run .lxs-ind-area { animation: lxs-area-in 1s ease-out 6.6s both, lxs-fadeout 0.5s ease-in 10.3s both; }
@keyframes lxs-area-in { from { opacity: 0 } to { opacity: 1 } }

/* komet biru mengikuti ujung garis (5.3s → 7.2s) */
.lxs .lxs-comet { opacity: 0; }
.lxs-run .lxs-comet { animation: lxs-char-in 0.01s linear 5.3s both, lxs-fadeout 0.5s ease-in 7.2s both; }

/* titik ujung garis menyala setelah gambar selesai (7.0s) */
.lxs .lxs-end-dot { opacity: 0; }
.lxs-run .lxs-end-dot { animation: lxs-char-in 0.01s linear 7s both, lxs-fadeout 0.5s ease-in 10.3s both; }

/* crosshair vertikal (7.0s) */
.lxs .lxs-cross { opacity: 0; }
.lxs-run .lxs-cross { animation: lxs-char-in 0.01s linear 7s both, lxs-fadeout 0.5s ease-in 10.3s both; }

/* push notif terbang masuk (6.9s) + hilang (10.35s) */
.lxs .lxs-push { opacity: 0; }
.lxs-run .lxs-push { animation: lxs-push-in 0.55s cubic-bezier(0.34, 1.4, 0.5, 1) 6.9s both, lxs-fadeout 0.6s ease-in 10.35s both; }
@keyframes lxs-push-in {
  0% { opacity: 0; transform: translate(44px, -30px) scale(0.9) }
  70% { opacity: 1; transform: translate(-5px, 3px) scale(1.03) }
  85% { transform: translate(3px, -2px) scale(0.995) }
  100% { opacity: 1; transform: translate(0, 0) scale(1) }
}

/* scene caption (subtitle) menyala bergantian */
.lxs .lxs-scene { opacity: 0.4; }
.lxs-run .lxs-scene-1 { animation: lxs-scene-on 0.4s ease-out 0.4s both, lxs-fadeout 0.5s ease-in 9.9s both; }
.lxs-run .lxs-scene-2 { animation: lxs-scene-on 0.4s ease-out 2.2s both, lxs-fadeout 0.5s ease-in 9.9s both; }
.lxs-run .lxs-scene-3 { animation: lxs-scene-on 0.4s ease-out 5.3s both, lxs-fadeout 0.5s ease-in 9.9s both; }
.lxs-run .lxs-scene-4 { animation: lxs-scene-on 0.4s ease-out 6.9s both, lxs-fadeout 0.5s ease-in 9.9s both; }
@keyframes lxs-scene-on { from { opacity: 0.4; transform: translateY(5px) } to { opacity: 1; transform: translateY(0) } }

/* CTA berdenyut lembut */
.lxs-run .lxs-cta { animation: lxs-cta 2.6s ease-in-out infinite; }
@keyframes lxs-cta { 0%, 100% { transform: scale(1) } 50% { transform: scale(1.035) } }

/* pause saat keluar viewport */
.lxs-paused, .lxs-paused * { animation-play-state: paused !important; }

/* aksesibilitas: hormati reduce-motion (tampilkan state akhir —
   tick juga di-skip via JS di atas) */
@media (prefers-reduced-motion: reduce) {
  .lxs *, .lxs-run * { animation: none !important; }
  .lxs .lxs-ch, .lxs .lxs-ind-area, .lxs .lxs-cross, .lxs .lxs-end-dot { opacity: 1; }
  .lxs .lxs-indicator { stroke-dashoffset: 0 !important; }
  .lxs .lxs-push, .lxs .lxs-break-glow, .lxs .lxs-comet { display: none; }
  .lxs .lxs-scene { opacity: 0.85; }
}
`
