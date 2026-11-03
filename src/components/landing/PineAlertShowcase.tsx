'use client'

/**
 * ============================================================
 * PineAlertShowcase — "video" animasi fitur Pine Script® + Alert
 * ============================================================
 * Storyboard 11 detik (loop = remount panel tiap 11s):
 *   0.3–1.6s  chart menyala — candle + volume muncul bergiliran
 *   2.0–5.0s  editor Pine — kode ngetik sendiri (typewriter)
 *   4.95s     tombol Compile "ditekan"
 *   5.3–7.0s  garis indikator MENGGAMBAR DIRINYA (+ komet biru
 *             mengikuti ujung garis, SMIL animateMotion)
 *   5.6s      candle breakout menembus resistance → garis flash biru
 *   6.9s      crosshair + label harga + push notif terbang masuk
 *   10.3s     fadeout → 11s remount
 *
 * TEKNIS (penting — ini bukan file video):
 *   - Murni CSS keyframes + SVG. Tajam di retina/4K, ~0 KB asset.
 *   - Chart didesain manual (bukan random) → cerita uptrend jelas:
 *     naik bertahap dengan pullback → konsolidasi → BREAKOUT.
 *   - Detail ala TradingView: sumbu harga, label waktu, bar volume,
 *     watermark, crosshair + tag harga di axis kanan.
 *   - Semua teks & aksen = tema biru landing page (blue/cyan family).
 *   - IntersectionObserver → animasi hanya saat terlihat; pause
 *     otomatis saat keluar viewport (hemat CPU/baterai).
 *   - prefers-reduced-motion → animasi dimatikan (aksesibilitas).
 */

import { useEffect, useRef, useState } from 'react'

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
  title: 'Pine Script® + Alert Otomatis,',
  titleAccent: 'Langsung dari Chart Kamu',
  sub: 'Tulis indikator kamu sendiri, compile dalam sekejap, dan biarkan sinyal Entry/SL/TP datang ke layar HP — walau app lagi ditutup.',
  compile: 'Compile',
  pushTitle: '🚀 ENTRY_LONG — XAUUSD · 1h',
  pushBody: 'Luxtradee Breakout · Harga ~2.406,0',
  pushApp: 'LuxTradee · sekarang',
  cta: 'Coba Gratis Sekarang',
  ctaNote: 'Gratis — tanpa kartu kredit',
  scene: [
    'Chart hidup, data real-time',
    'Tulis Pine Script® kamu',
    'Compile → indikator muncul',
    'Alert otomatis ke layar HP',
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
              {/* ---- CHART (SVG candle hidup ala TradingView) ---- */}
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

                  {/* area di bawah indikator (fade-in setelah garis selesai) */}
                  <path className="lxs-ind-area" d={`${INDICATOR_PATH} L 633 372 L 33 372 Z`} fill="url(#lxs-ind-area)" />

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

                  {/* bar volume — warna mengikuti arah candle */}
                  {CANDLES.map((c, i) => {
                    const isBreak = i === CANDLES.length - 1
                    return (
                      <rect
                        key={`vol${i}`}
                        className={isBreak ? 'lxs-vol lxs-vol-break' : 'lxs-vol'}
                        x={c.x} width={BW}
                        y={VOL_BASE - c.vol} height={c.vol} rx="2"
                        fill={candleColor(c)} fillOpacity={isBreak ? 0.6 : 0.22}
                        style={isBreak ? undefined : { animationDelay: `${0.3 + i * 0.085}s` }}
                      />
                    )
                  })}

                  {/* candles — uptrend dengan pullback, terakhir = breakout */}
                  {CANDLES.map((c, i) => {
                    const isBreak = i === CANDLES.length - 1
                    return (
                      <g
                        key={`cd${i}`}
                        className={isBreak ? 'lxs-candle lxs-candle-break' : 'lxs-candle'}
                        style={isBreak ? undefined : { animationDelay: `${0.3 + i * 0.085}s` }}
                      >
                        <line x1={c.x + BW / 2} x2={c.x + BW / 2} y1={c.wt} y2={c.wb} stroke={isBreak ? '#4ade80' : candleColor(c)} strokeWidth="1.6" />
                        <rect
                          x={c.x} width={BW}
                          y={Math.min(c.o, c.c)}
                          height={Math.max(6, Math.abs(c.c - c.o))}
                          rx="2"
                          fill={isBreak ? '#4ade80' : candleColor(c)}
                        />
                      </g>
                    )
                  })}

                  {/* garis indikator — menggambar dirinya setelah "compile" */}
                  <path
                    className="lxs-indicator"
                    d={INDICATOR_PATH}
                    fill="none"
                    stroke="url(#lxs-ind-line)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    style={{
                      strokeDasharray: INDICATOR_LEN,
                      strokeDashoffset: INDICATOR_LEN,
                      '--lxs-ind-len': INDICATOR_LEN,
                    } as React.CSSProperties}
                  />

                  {/* titik ujung garis (nyala setelah gambar selesai) */}
                  <circle className="lxs-end-dot" cx="633" cy="128" r="8" fill="rgba(96,165,250,0.25)" />
                  <circle className="lxs-end-dot" cx="633" cy="128" r="3.5" fill="#93c5fd" />

                  {/* komet biru mengikuti ujung garis saat menggambar (SMIL) */}
                  {inView && (
                    <g className="lxs-comet">
                      <circle r="9" fill="rgba(96,165,250,0.3)" />
                      <circle r="3.5" fill="#dbeafe" />
                      <animateMotion
                        dur="1.7s" begin="5.3s" fill="freeze"
                        calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1"
                        path={INDICATOR_PATH}
                      />
                    </g>
                  )}

                  {/* flash glow saat breakout (5.7s) */}
                  <circle className="lxs-break-glow" cx="633" cy="92" r="26" fill="url(#lxs-break-glow)" />

                  {/* crosshair + tag harga di axis kanan (ala TradingView) */}
                  <line className="lxs-cross" x1="633" x2="633" y1="14" y2="372" stroke="rgba(96,165,250,0.35)" strokeWidth="1" strokeDasharray="4 4" />
                  <g className="lxs-price-tag">
                    <rect x="652" y="83" width="56" height="18" rx="4" fill="#3b82f6" />
                    <text x="680" y="96" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#ffffff">2.406</text>
                  </g>
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
   DATA CHART — didesain manual (bukan random) supaya cerita
   uptrend → konsolidasi → BREAKOUT terbaca jelas.
   KOORDINAT SVG: y KECIL = harga LEBIH TINGGI.
   Bullish = close di atas open = c.c < c.o (angka y) → HIJAU.
   ============================================================ */
const RES_Y = 122      // y garis resistance (= harga 2.400)
const X0 = 24          // x candle pertama
const DX = 40          // jarak antar candle
const BW = 18          // lebar badan candle
const VOL_BASE = 372   // garis dasar bar volume

type Candle = { x: number; o: number; c: number; wt: number; wb: number; vol: number }

/* [open, close, wickTop, wickBot, volume] — 15 candle pembentuk uptrend */
const RAW: [number, number, number, number, number][] = [
  [272, 282, 264, 290, 20],
  [282, 258, 252, 288, 30],
  [258, 270, 251, 277, 16],
  [270, 244, 237, 276, 34],
  [244, 256, 237, 263, 18],
  [256, 230, 223, 262, 38],
  [230, 244, 223, 251, 21],
  [244, 216, 209, 250, 43],
  [216, 230, 209, 237, 24],
  [230, 200, 193, 236, 47],
  [200, 214, 193, 221, 26],
  [214, 186, 179, 220, 51],
  [186, 198, 179, 205, 27],
  [198, 166, 159, 204, 55],
  [166, 148, 141, 172, 38],
]
const CANDLES: Candle[] = RAW.map(([o, c, wt, wb, vol], i) => ({ x: X0 + i * DX, o, c, wt, wb, vol }))
/* candle breakout terakhir — menembus resistance (122) sampai 92 */
CANDLES.push({ x: X0 + 15 * DX, o: 148, c: 92, wt: 82, wb: 154, vol: 70 })

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
const TIME_LABELS = [
  { label: '08:00', x: 33 },
  { label: '09:00', x: 153 },
  { label: '10:00', x: 273 },
  { label: '11:00', x: 393 },
  { label: '12:00', x: 513 },
  { label: '13:00', x: 633 },
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

/* EMA "lagging" — mengikuti candle tapi lebih halus & terlambat */
const IND_PTS: [number, number][] = [
  [33, 286], [113, 272], [193, 254], [273, 238],
  [353, 224], [433, 208], [513, 190], [593, 162], [633, 128],
]
const INDICATOR_PATH = smoothPath(IND_PTS)
/* Panjang aproksimasi (polyline × faktor kelengkungan) → dasharray */
const INDICATOR_LEN = Math.round(
  IND_PTS.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - IND_PTS[i][0], p[1] - IND_PTS[i][1]), 0) * 1.05,
)

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

/* candle muncul bergiliran */
.lxs .lxs-candle { opacity: 0; }
.lxs-run .lxs-candle { animation: lxs-candle-in 0.45s ease-out both; }
@keyframes lxs-candle-in { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: translateY(0) } }

/* candle breakout — pop dramatis menembus resistance (5.6s) */
.lxs .lxs-candle-break { transform-box: fill-box; transform-origin: 50% 100%; filter: drop-shadow(0 0 7px rgba(74, 222, 128, 0.75)); }
.lxs-run .lxs-candle-break { animation: lxs-break-pop 0.55s cubic-bezier(0.34, 1.56, 0.5, 1) 5.6s both, lxs-fadeout 0.6s ease-in 10.2s both; }
@keyframes lxs-break-pop {
  0% { opacity: 0; transform: translateY(18px) scale(0.6) }
  60% { opacity: 1; transform: translateY(0) scale(1.12) }
  100% { opacity: 1; transform: translateY(0) scale(1) }
}

/* bar volume mengikuti candle-nya */
.lxs .lxs-vol { opacity: 0; }
.lxs-run .lxs-vol { animation: lxs-vol-in 0.5s ease-out both; }
@keyframes lxs-vol-in { from { opacity: 0 } to { opacity: 1 } }
.lxs-run .lxs-vol-break { animation: lxs-vol-in 0.5s ease-out 5.6s both, lxs-fadeout 0.6s ease-in 10.2s both; }

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

/* crosshair vertikal + tag harga di axis (7.0s) */
.lxs .lxs-cross { opacity: 0; }
.lxs-run .lxs-cross { animation: lxs-char-in 0.01s linear 7s both, lxs-fadeout 0.5s ease-in 10.3s both; }
.lxs .lxs-price-tag { opacity: 0; transform-box: fill-box; }
.lxs-run .lxs-price-tag { animation: lxs-tag-in 0.45s cubic-bezier(0.34, 1.4, 0.5, 1) 7s both, lxs-fadeout 0.5s ease-in 10.3s both; }
@keyframes lxs-tag-in { from { opacity: 0; transform: translateX(12px) } to { opacity: 1; transform: translateX(0) } }

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

/* aksesibilitas: hormati reduce-motion (tampilkan state akhir) */
@media (prefers-reduced-motion: reduce) {
  .lxs *, .lxs-run * { animation: none !important; }
  .lxs .lxs-ch, .lxs .lxs-candle, .lxs .lxs-vol, .lxs .lxs-ind-area,
  .lxs .lxs-cross, .lxs .lxs-price-tag, .lxs .lxs-end-dot { opacity: 1; }
  .lxs .lxs-indicator { stroke-dashoffset: 0 !important; }
  .lxs .lxs-push, .lxs .lxs-break-glow, .lxs .lxs-comet { display: none; }
  .lxs .lxs-scene { opacity: 0.85; }
}
`
