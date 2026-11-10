/**
 * Uji fix anti-spam sinyal VIP — ekstrak fungsi ASLI dari source
 * (pola Bun.Transpiler, sama seperti test marketListener sebelumnya).
 * Jalankan: bun scripts/test-vip-fix.ts
 */
import { readFileSync } from 'node:fs'

// Transpiler: kupas tipe TS sebelum masuk new Function (body-nya JS murni)
const tp = new Bun.Transpiler({ loader: 'ts' })
const js = (src: string): string => tp.transformSync(src)

const mlSrc = readFileSync('src/services/marketListener.ts', 'utf8')
const mlFrom = mlSrc.indexOf('export function emaSeries')
const mlTo = mlSrc.indexOf('export function evaluateCustomIndicator')
const brainSrc = mlSrc.slice(mlFrom, mlTo).replaceAll('export function', 'function')

const routeSrc = readFileSync('src/app/api/cron/vip-signals/route.ts', 'utf8')
const constsFrom = routeSrc.indexOf('const CANDLE_INTERVAL')
const constsTo = routeSrc.indexOf('async function fetchCandles')
const constsSrc = routeSrc.slice(constsFrom, constsTo)
const fnFrom = routeSrc.indexOf('async function fetchCandles')
const fnTo = routeSrc.indexOf('async function handle')
const fetchCandlesSrc = routeSrc.slice(fnFrom, fnTo)

let passed = 0
let failed = 0
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`  ✅ ${name}`) }
  else { failed++; console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`) }
}

// Bangun modul: fetchCandles + evaluateCloses pakai fetch mock global
const sandbox = new Function(
  'createFetch',
  `
  const fetch = createFetch();
  const getSelfFetch = async () => null; // jalur fetch biasa
  const SITE_URL = 'https://x.test';
  const SYMBOL = 'XAUUSD'; // didefinisikan route di atas blok konstanta yang diekstrak
  ${js(constsSrc)}
  ${js(fetchCandlesSrc)}
  ${js(brainSrc)}
  return { fetchCandles, evaluateCloses, getConsts: () => ({ STALE: STALE_CLOSED_BAR_SEC, INTERVAL_MIN: CANDLE_INTERVAL_MIN }) };
  `
)

const makeMockFetch = (payloadFn: () => unknown) => () =>
  (_url: string, _init?: RequestInit) =>
    Promise.resolve(new Response(JSON.stringify(payloadFn()), { status: 200 }))

// ── Skenario 1: Minggu, candle beku + bar hidup berisik ──
// 79 bar tutup Jumat (cross SELL jelas di 2 bar tutup terakhir) + 1 bar hidup overlay
const FROZEN: number[] = []
for (let i = 0; i < 79; i++) FROZEN.push(4050 + Math.sin(i / 6) * 6)
FROZEN[77] = 4062; FROZEN[78] = 4055
const FRIDAY_CLOSE_SEC = 1_794_050_000 // lampau jauh (weekend)
const closedBars = FROZEN.map((c, i) => ({
  time: FRIDAY_CLOSE_SEC - (79 - i) * 900,
  open: c, high: c + 1, low: c - 1, close: c,
}))

function makePayload(liveOverlay: number) {
  return {
    ok: true,
    data: [...closedBars, { time: FRIDAY_CLOSE_SEC + 900, open: liveOverlay, high: liveOverlay + 1, low: liveOverlay - 1, close: liveOverlay }],
  }
}

let flipState = 0
const mod = sandbox(() =>
  (_url: string, _init?: RequestInit) => {
    flipState = flipState === 0 ? 1 : 0
    // bar hidup nilainya FLIP antar panggilan (simulasi overlay spot ganti sumber)
    return Promise.resolve(new Response(JSON.stringify(makePayload(flipState ? 4070 : 4045)), { status: 200 }))
  }
) as { fetchCandles: () => Promise<Record<string, unknown>>, evaluateCloses: (s: string, c: number[], p?: number) => Record<string, unknown>, getConsts: () => { STALE: number, INTERVAL_MIN: number } }

console.log('── Skenario 1: bar hidup (overlay flip) TIDAK boleh ikut keputusan ──')
const r1 = await mod.fetchCandles()
check('fetchCandles sukses', !!r1)
check('closes = 79 (bar hidup dibuang)', (r1.closes as number[]).length === 79, `dapat ${(r1.closes as number[]).length}`)
check('closes stabil walau overlay flip', JSON.stringify(r1.closes) === JSON.stringify(FROZEN))
check('lastClosedAtSec = bar tutup Jumat', r1.lastClosedAtSec === FRIDAY_CLOSE_SEC - 900, `dapat ${r1.lastClosedAtSec}`)

console.log('── Skenario 2: gate pasar tutup (bar basi → SKIP evaluasi) ──')
const { STALE } = mod.getConsts()
check('STALE_CLOSED_BAR_SEC = 2700 (45 mnt)', STALE === 2700)
const nowSec = Math.floor(Date.now() / 1000)
const barAge = nowSec - Number(r1.lastClosedAtSec)
check('umur bar Jumat jauh > STALE (weekend terdeteksi)', barAge > STALE, `umur ${barAge}s`)
const s1 = mod.evaluateCloses('XAU/USD', r1.closes as number[], 4060)
const s2 = mod.evaluateCloses('XAU/USD', r1.closes as number[], 4060)
check('otak deterministik pada data beku', JSON.stringify(s1) === JSON.stringify(s2))

console.log('── Skenario 3: pasar BUKA — bar tutup segar TIDAK kena gate ──')
const freshClosed = closedBars.map((b, i) => ({ ...b, time: nowSec - (79 - i) * 900 }))
const mod2 = sandbox(() => {
  let f2 = 0
  return (_u: string, _i?: RequestInit) => {
    f2 ^= 1
    const live = f2 ? 4070 : 4045 // overlay tetap berisik
    return Promise.resolve(new Response(JSON.stringify({
      ok: true,
      data: [...freshClosed, { time: nowSec - 300, open: live, high: live + 1, low: live - 1, close: live }],
    }), { status: 200 }))
  }
}) as any
const r3 = await mod2.fetchCandles()
const age3 = nowSec - Number(r3.lastClosedAtSec)
check('bar tutup segar (≤45 mnt) lolos gate', age3 <= STALE, `umur ${age3}s`)
check('closes tetap = 79 bar tutup', (r3.closes as number[]).length === 79)

console.log('── Skenario 4: jeda global min-gap 45 mnt (anti ping-pong arah) ──')
const COOLDOWN = 60_000, MIN_GAP = 45 * 60_000, REARM = 4 * 60 * 60_000
function cooldownActive(lastAge: number, sameAction: boolean): boolean {
  if (lastAge < COOLDOWN) return true
  if (lastAge < MIN_GAP) return true // ← ATURAN BARU
  if (sameAction && lastAge < REARM) return true
  return false
}
check('SELL 30 mnt setelah BUY → DITAHAN (pola spam asli BUY 10:00→SELL 10:30 mati)', cooldownActive(30 * 60_000, false) === true)
check('SELL 46 mnt setelah BUY → lolos (jeda lewat)', cooldownActive(46 * 60_000, false) === false)
check('BUY 1 jam setelah BUY → ditahan (re-arm 4 jam)', cooldownActive(60 * 60_000, true) === true)
check('SELL 5 jam setelah BUY → lolos', cooldownActive(5 * 60 * 60_000, false) === false)

console.log(`\n${passed} lulus, ${failed} gagal`)
process.exit(failed ? 1 : 0)
