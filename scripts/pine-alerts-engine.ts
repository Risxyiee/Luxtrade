/**
 * ============================================================
 * scripts/pine-alerts-engine.ts — PineTS engine di GHA runner
 * ============================================================
 * JALUR UTAMA alert Pine (fix "engine PineTS selalu 422 di
 * produksi"): engine PineTS memakai `new Function` (code
 * generation) yang DILARANG runtime Cloudflare Workers. GitHub
 * Actions runner = Node penuh → engine jalan normal.
 *
 * Alur tiap run (tiap 5 menit):
 *   1. GET  {PROD_URL}/api/cron/pine-alerts/payload  (x-cron-secret)
 *      → grup langganan: sumber skrip + candle server + users.
 *   2. Untuk tiap grup: runPineHeadless (engine PineTS) +
 *      collectTriggers (jendela catch-up 6 bar + alert_rules).
 *   3. POST {PROD_URL}/api/cron/pine-alerts/report
 *      → server: dedupe per-bar (pine_alert_log) + push layar HP.
 *
 * Jalankan manual: npx tsx scripts/pine-alerts-engine.ts
 * Env: PROD_URL (default https://luxtradee.web.id),
 *      PINE_ALERT_CRON_SECRET (atau CRON_SECRET).
 */

import { runPineHeadless, collectTriggers } from '../src/lib/pine-engine-core'

const PROD_URL = (process.env.PROD_URL || 'https://luxtradee.web.id').replace(/\/+$/, '')
const SECRET = String(process.env.PINE_ALERT_CRON_SECRET || process.env.CRON_SECRET || '').trim()
if (!SECRET) {
  console.error('::error::PINE_ALERT_CRON_SECRET kosong — set GitHub secret (samakan dengan CF var)')
  process.exit(1)
}

const HEADERS: Record<string, string> = {
  'x-cron-secret': SECRET,
  'User-Agent': 'luxtradee-pine-alerts-engine',
}

/* Anggaran waktu: workflow timeout 10 menit — mulai wrap-up di 8 mnt */
const DEADLINE_MS = Date.now() + 8 * 60 * 1000

interface PayloadGroup {
  scriptId: string
  scriptName: string
  source: string
  alertRules: any[] | null
  symbol: string
  interval: string
  candleSource?: string | null
  candleError?: string
  bars: Array<{ time: number; open: number; high: number; low: number; close: number }>
  users: Array<{ userId: string; sinceSec?: number }>
}

interface ReportResult {
  scriptId: string
  scriptName: string
  symbol: string
  interval: string
  ok: boolean
  error?: string
  triggers?: Array<{ signal: string; message: string; time: number; price: number }>
  users?: Array<{ userId: string; sinceSec?: number }>
}

async function main() {
  /* 1) PAYLOAD */
  const res = await fetch(`${PROD_URL}/api/cron/pine-alerts/payload`, { headers: HEADERS })
  console.log(`payload → HTTP ${res.status}`)
  if (!res.ok) {
    console.error('::error::payload gagal — ' + (await res.text().catch(() => '')).slice(0, 400))
    process.exit(1)
  }
  const data = await res.json() as { groups?: PayloadGroup[]; groupsTotal?: number; checked?: number; groupsCapped?: boolean }
  const groups = Array.isArray(data.groups) ? data.groups : []
  console.log(`grup: ${groups.length}${data.groupsCapped ? ` (dari total ${data.groupsTotal}, dipotong 30)` : ''} · langganan: ${data.checked ?? '?'} · generatedAt: ${(data as any).generatedAt}`)
  if (!groups.length) {
    console.log('✅ Tidak ada langganan aktif — selesai.')
    return
  }

  /* 2) EVALUASI PER GRUP */
  const results: ReportResult[] = []
  let ran = 0
  for (const g of groups) {
    if (Date.now() > DEADLINE_MS) {
      console.log(`⏰ anggaran waktu habis — sisa ${groups.length - ran} grup dilewati run ini (dedupe aman, run berikutnya lanjut)`)
      break
    }
    const base = { scriptId: g.scriptId, scriptName: g.scriptName, symbol: g.symbol, interval: g.interval }
    try {
      if (!g.bars?.length) {
        results.push({ ...base, ok: false, error: g.candleError || 'payload tanpa candle' })
        console.log(`   ⚠️ ${g.symbol} ${g.interval} "${g.scriptName}": ${g.candleError || 'tanpa candle'}`)
        ran++
        continue
      }
      const run = await runPineHeadless(g.source, g.symbol, g.interval, g.bars)
      if (!run.ok || !run.plots?.length) {
        results.push({ ...base, ok: false, error: run.error || 'Skrip tidak menghasilkan plot', users: g.users })
        console.log(`   ❌ ${g.symbol} ${g.interval} "${g.scriptName}": ${(run.error || 'no plot').slice(0, 140)}`)
        ran++
        continue
      }
      const triggers = collectTriggers({
        engineAlerts: run.engineAlerts || [],
        rules: g.alertRules,
        plots: run.plots,
        bars: g.bars,
      })
      results.push({
        ...base,
        ok: true,
        users: g.users,
        triggers: triggers.map((t) => ({ signal: t.signal, message: t.message, time: t.time, price: t.price })),
      })
      console.log(`   ✅ ${g.symbol} ${g.interval} "${g.scriptName}": ${triggers.length} pemicu (plots ${run.plots.length}, engineAlerts ${(run.engineAlerts || []).length})`)
      ran++
    } catch (e: any) {
      results.push({ ...base, ok: false, error: String(e?.message || e).slice(0, 200), users: g.users })
      console.log(`   ❌ ${g.symbol} ${g.interval} "${g.scriptName}": exception ${String(e?.message || e).slice(0, 120)}`)
      ran++
    }
  }

  /* 3) REPORT */
  const rep = await fetch(`${PROD_URL}/api/cron/pine-alerts/report`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ results }),
  })
  const repBody = await rep.text().catch(() => '')
  console.log(`report → HTTP ${rep.status}`)
  console.log(repBody.slice(0, 1200))
  if (!rep.ok) {
    console.error('::error::report gagal — push sinyal tidak terkirim run ini')
    process.exit(1)
  }
  console.log('✅ Siklus Pine alerts selesai')
}

main().catch((e) => {
  console.error('::error::' + String(e?.stack || e?.message || e).slice(0, 600))
  process.exit(1)
})
