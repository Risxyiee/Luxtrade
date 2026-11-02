'use client'

/**
 * ============================================================
 * PineAlertShowcase — "video" animasi fitur Pine Script® + Alert
 * ============================================================
 * Konsep 1 "Kode → Chart Hidup" (disetujui Bos):
 *   0–2s   chart gelap, candle hidup
 *   2–5s   editor Pine — kode ngetik sendiri (typewriter)
 *   5–7s   tombol Compile → garis indikator MENGGAMBAR DIRINYA
 *   7–9s   harga tembus level → push notif terbang ke layar HP
 *   9–11s  CTA
 *
 * TEKNIS (penting — ini bukan file video):
 *   - Murni CSS keyframes + SVG. Tajam di retina/4K, ~0 KB asset,
 *     gampang edit teks/warna.
 *   - Loop = remount panel tiap 11 detik (React key) → SEMUA delay
 *     akurat di setiap siklus (delay CSS murni cuma akurat di
 *     iterasi pertama — makanya pakai cara ini).
 *   - Animasi hanya jalan saat section terlihat (IntersectionObserver),
 *     pause otomatis saat keluar viewport — hemat CPU/baterai.
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
  pushBody: 'Luxtradee Breakout · Harga ~2.403,2',
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
  pushBody: 'Luxtradee Breakout · Price ~2,403.2',
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
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[420px] rounded-full bg-purple-500/[0.07] blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto text-center">
        <span className="inline-block text-[11px] font-bold tracking-widest px-3 py-1 rounded-full border border-purple-400/30 bg-purple-400/10 text-purple-200 mb-5">
          {t.badge}
        </span>
        <h2 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight">
          {t.title}{' '}
          <span className="bg-gradient-to-r from-purple-400 via-fuchsia-300 to-emerald-300 bg-clip-text text-transparent">
            {t.titleAccent}
          </span>
        </h2>
        <p className="mt-4 text-white/50 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">{t.sub}</p>

        {/* ============ "VIDEO" ANIMASI ============ */}
        <div ref={hostRef} className={`lxs mt-10 md:mt-14 ${inView ? 'lxs-run' : ''}`}>
          <style>{LXS_CSS}</style>

          {/* key={cycle} → remount tiap siklus, animasi restart bersih */}
          <div
            key={cycle}
            className={`relative rounded-2xl border border-white/10 bg-[#070a12] shadow-[0_30px_80px_-20px_rgba(124,58,237,0.25)] overflow-hidden text-left ${inView ? '' : 'lxs-paused'}`}
          >
            {/* Bar jendela terminal */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" aria-hidden="true" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-300/70" aria-hidden="true" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" aria-hidden="true" />
              <span className="ml-3 text-[11px] text-white/40 font-medium tracking-wide">
                LuxTradee Terminal — XAUUSD · 1h
              </span>
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/10 border border-emerald-400/25 text-emerald-300 flex items-center gap-1">
                <span className="lxs-live-dot w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden="true" /> LIVE
              </span>
            </div>

            <div className="relative grid md:grid-cols-[1fr_260px]">
              {/* ---- CHART (SVG candle hidup) ---- */}
              <div className="relative aspect-[16/10] md:aspect-auto md:h-[380px]">
                <svg viewBox="0 0 600 380" className="absolute inset-0 w-full h-full" aria-hidden="true">
                  {/* grid halus */}
                  {Array.from({ length: 7 }).map((_, i) => (
                    <line key={`h${i}`} x1="0" x2="600" y1={40 + i * 50} y2={40 + i * 50} stroke="rgba(255,255,255,0.045)" strokeWidth="1" />
                  ))}
                  {Array.from({ length: 11 }).map((_, i) => (
                    <line key={`v${i}`} y1="0" y2="380" x1={30 + i * 55} x2={30 + i * 55} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                  ))}

                  {/* level resistance (garis putus putih) */}
                  <line className="lxs-level" x1="0" x2="600" y1="118" y2="118" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeDasharray="7 6" />
                  <text x="10" y="110" fill="rgba(255,255,255,0.4)" fontSize="11">Resistance 2.400</text>

                  {/* candles: 14 baris, naik-turun, terakhir "hidup" */}
                  {CANDLES.map((c, i) => (
                    <g key={i} className={`lxs-candle ${i === CANDLES.length - 1 ? 'lxs-candle-live' : ''}`} style={{ animationDelay: `${0.2 + i * 0.1}s` }}>
                      <rect
                        x={c.x} width="14"
                        y={c.o < c.c ? c.c : c.o}
                        height={Math.max(6, Math.abs(c.c - c.o))}
                        rx="2"
                        fill={c.c >= c.o ? '#34d399' : '#f87171'}
                      />
                      <line x1={c.x + 7} x2={c.x + 7} y1={c.wickTop} y2={c.wickBot} stroke={c.c >= c.o ? '#34d399' : '#f87171'} strokeWidth="1.6" />
                    </g>
                  ))}

                  {/* garis indikator — menggambar dirinya setelah "compile" */}
                  <path
                    className="lxs-indicator"
                    d={INDICATOR_PATH}
                    fill="none"
                    stroke="#a78bfa"
                    strokeWidth="3"
                    strokeLinecap="round"
                    style={{ strokeDasharray: INDICATOR_LEN, strokeDashoffset: INDICATOR_LEN }}
                  />
                </svg>

                {/* caption scene */}
                <div className="absolute left-3 bottom-3 flex flex-col gap-1.5 items-start">
                  {t.scene.map((s, i) => (
                    <span
                      key={i}
                      className={`lxs-scene lxs-scene-${i + 1} text-[11px] md:text-xs px-2.5 py-1 rounded-full border backdrop-blur ${
                        i === 3
                          ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
                          : 'border-white/10 bg-black/40 text-white/70'
                      }`}
                    >
                      {['①', '②', '③', '④'][i]} {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* ---- EDITOR PINE (typewriter) ---- */}
              <div className="relative border-t md:border-t-0 md:border-l border-white/[0.06] bg-black/40">
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
                  <span className="text-[10.5px] uppercase tracking-widest text-white/35">Pine Editor®</span>
                  {/* tombol compile "ditekan" pada siklus */}
                  <span className="lxs-compile text-[10.5px] font-semibold px-2.5 py-1 rounded-md bg-gradient-to-r from-purple-500 to-fuchsia-400 text-black">
                    ▶ {t.compile}
                  </span>
                </div>
                <pre className="lxs-code px-3 py-3 text-[10.5px] md:text-[11px] leading-[1.75] font-mono text-emerald-200/90 min-h-[150px] md:min-h-[300px] whitespace-pre-wrap">
                  <TypeWriter text={PINE_LINES.join('\n')} />
                  <span className="lxs-caret" aria-hidden="true">▌</span>
                </pre>
              </div>
            </div>

            {/* ---- PUSH NOTIF (terbang masuk) ---- */}
            <div className="lxs-push absolute top-16 right-3 md:right-5 w-[calc(100%-24px)] max-w-[320px] rounded-xl border border-white/15 bg-[#10141d]/95 backdrop-blur shadow-2xl p-3 flex gap-3 items-start z-10">
              <span className="w-9 h-9 rounded-lg bg-emerald-400/15 border border-emerald-400/30 grid place-items-center text-lg shrink-0" aria-hidden="true">⚡</span>
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold tracking-wide text-white/85 truncate">{t.pushApp}</span>
                  <span className="text-[9.5px] text-white/35 shrink-0">1s</span>
                </div>
                <div className="text-[11.5px] font-semibold text-white truncate">{t.pushTitle}</div>
                <div className="text-[10.5px] text-white/50 truncate">{t.pushBody}</div>
              </div>
            </div>
          </div>

          {/* CTA di bawah "video" */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="/auth/signup"
              className="lxs-cta inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-purple-500 to-cyan-400 text-black font-bold text-sm hover:opacity-90 transition-opacity min-h-[48px]"
            >
              {t.cta} <span aria-hidden="true">→</span>
            </a>
            <span className="text-xs text-white/35">{t.ctaNote}</span>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------- Typewriter: 1 span per karakter, reveal berdelay ---------- */
function TypeWriter({ text }: { text: string }) {
  /* Mulai ngetik di detik ke-2 (2.0s), 45ms per karakter */
  return (
    <>
      {text.split('').map((ch, i) => (
        <span key={i} className="lxs-ch" style={{ animationDelay: `${2 + i * 0.045}s` }}>
          {ch}
        </span>
      ))}
    </>
  )
}

/* ---------- Data bentuk candle + path indikator ---------- */
const CANDLES = Array.from({ length: 14 }).map((_, i) => {
  const x = 24 + i * 42
  const wave = Math.sin(i * 0.7) * 26 + Math.sin(i * 0.23) * 18
  const base = 250 - i * 9 // tren naik perlahan ke resistance
  const o = base - wave * 0.4
  const c = base - wave
  const top = Math.min(o, c)
  const bot = Math.max(o, c)
  return { x, o, c, wickTop: top - 12, wickBot: bot + 12 }
})
/* Titik terakhir nembus resistance 118 */
CANDLES[CANDLES.length - 1] = { ...CANDLES[CANDLES.length - 1], o: 160, c: 96, wickTop: 84, wickBot: 172 }

const INDICATOR_PATH =
  'M 30 300 C 90 290, 120 310, 170 280 S 260 250, 300 235 S 380 205, 420 180 S 500 140, 560 105'
const INDICATOR_LEN = 640

/* ---------- CSS (scoped prefix lxs-) — semua ONE-SHOT, loop via remount ---------- */
const LXS_CSS = `
/* karakter kode muncul (delay per karakter di style inline) */
.lxs .lxs-ch { opacity: 0; }
.lxs-run .lxs-ch { animation: lxs-char-in 0.01s linear both; }
@keyframes lxs-char-in { from { opacity: 0 } to { opacity: 1 } }

/* caret berkedip */
.lxs .lxs-caret { color: #34d399; opacity: 0; }
.lxs-run .lxs-caret { animation: lxs-caret-blink 0.9s steps(2, jump-none) infinite; }
@keyframes lxs-caret-blink { 0%, 100% { opacity: 1 } 50% { opacity: 0.15 } }

/* candle muncul bergiliran */
.lxs .lxs-candle { opacity: 0; }
.lxs-run .lxs-candle { animation: lxs-candle-in 0.5s ease-out both; }
@keyframes lxs-candle-in { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: translateY(0) } }
.lxs-run .lxs-candle-live { animation: lxs-candle-live 1.2s ease-out both, lxs-fadeout 0.7s ease-in 10.2s both; }
@keyframes lxs-candle-live {
  0% { opacity: 0; transform: translateY(10px) scale(0.9) }
  55% { opacity: 1; transform: translateY(0) scale(1) }
  75% { transform: scale(1.14) }
  100% { opacity: 1; transform: scale(1) }
}
@keyframes lxs-fadeout { from { opacity: 1 } to { opacity: 0 } }

/* titik LIVE berdenyut */
.lxs .lxs-live-dot { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.6); }
.lxs-run .lxs-live-dot { animation: lxs-ping 1.8s infinite; }
@keyframes lxs-ping { 70% { box-shadow: 0 0 0 7px rgba(52, 211, 153, 0) } 100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0) } }

/* garis resistance menyala hijau saat ditembus (5.6s) */
.lxs-run .lxs-level { animation: lxs-level 1.6s ease-in-out 5.6s both; }
@keyframes lxs-level {
  0% { opacity: 0.55; stroke: rgba(255, 255, 255, 0.35) }
  40% { opacity: 1; stroke: rgba(52, 211, 153, 0.9) }
  100% { opacity: 0.55; stroke: rgba(255, 255, 255, 0.35) }
}

/* tombol compile "ditekan" (5.0s) */
.lxs-run .lxs-compile { animation: lxs-compile 0.9s ease-in-out 5s both; }
@keyframes lxs-compile {
  0% { transform: scale(1); filter: brightness(1) }
  35% { transform: scale(0.9); filter: brightness(1.6) }
  100% { transform: scale(1); filter: brightness(1.25) }
}

/* indikator menggambar dirinya (5.4s → 7s) */
.lxs-run .lxs-indicator { animation: lxs-draw 1.7s cubic-bezier(0.4, 0, 0.2, 1) 5.4s both; }
@keyframes lxs-draw { from { stroke-dashoffset: 640; opacity: 1 } to { stroke-dashoffset: 0; opacity: 1 } }

/* push notif terbang masuk (6.8s) + getar + hilang (10.4s) */
.lxs .lxs-push { opacity: 0; }
.lxs-run .lxs-push { animation: lxs-push-in 0.55s cubic-bezier(0.34, 1.4, 0.5, 1) 6.8s both, lxs-fadeout 0.6s ease-in 10.4s both; }
@keyframes lxs-push-in {
  0% { opacity: 0; transform: translate(44px, -30px) scale(0.9) }
  70% { opacity: 1; transform: translate(-5px, 3px) scale(1.03) }
  85% { transform: translate(3px, -2px) scale(0.995) }
  100% { opacity: 1; transform: translate(0, 0) scale(1) }
}

/* scene caption menyala bergantian */
.lxs .lxs-scene { opacity: 0.4; }
.lxs-run .lxs-scene-1 { animation: lxs-scene-on 0.4s ease-out 0.4s both, lxs-fadeout 0.5s ease-in 9.9s both; }
.lxs-run .lxs-scene-2 { animation: lxs-scene-on 0.4s ease-out 2.2s both, lxs-fadeout 0.5s ease-in 9.9s both; }
.lxs-run .lxs-scene-3 { animation: lxs-scene-on 0.4s ease-out 5.3s both, lxs-fadeout 0.5s ease-in 9.9s both; }
.lxs-run .lxs-scene-4 { animation: lxs-scene-on 0.4s ease-out 6.9s both, lxs-fadeout 0.5s ease-in 9.9s both; }
@keyframes lxs-scene-on { from { opacity: 0.4; transform: translateX(-6px) } to { opacity: 1; transform: translateX(0) } }

/* CTA berdenyut lembut */
.lxs-run .lxs-cta { animation: lxs-cta 2.6s ease-in-out infinite; }
@keyframes lxs-cta { 0%, 100% { transform: scale(1) } 50% { transform: scale(1.035) } }

/* pause saat keluar viewport */
.lxs-paused, .lxs-paused * { animation-play-state: paused !important; }

/* aksesibilitas: hormati reduce-motion (tampilkan state akhir) */
@media (prefers-reduced-motion: reduce) {
  .lxs *, .lxs-run * { animation: none !important; }
  .lxs .lxs-ch { opacity: 1; }
  .lxs .lxs-candle { opacity: 1; }
  .lxs .lxs-push { opacity: 0; }
  .lxs .lxs-indicator { stroke-dashoffset: 0 !important; }
}
`
