#!/usr/bin/env node
/**
 * ============================================================
 * patch-cf-worker-cron.mjs — Post-build Cloudflare cron patch
 * ============================================================
 * MASALAH YANG DIPERBAIKI (log produksi Bos):
 *   "Handler does not export a scheduled() function"
 *   → cron trigger (0 1/3 harian + tiap-15-menit) fire tapi worker
 *     tidak punya handler scheduled().
 *
 * PENYEBAB: deploy bisa lewat 2 jalur main yang berbeda:
 *   1. wrangler.jsonc  → main: worker-entry.ts  (punya scheduled ✅)
 *   2. worker generated OpenNext (.open-next/worker.js) sebagai main
 *      (template OpenNext HANYA export fetch — TANPA scheduled ❌)
 * Jalur 2 membuat cron mati senyap walau trigger terpasang.
 *
 * SOLUSI: script ini dijalankan SETELAH `opennextjs-cloudflare build`
 * (dari package.json "build"). Ia menyuntikkan handler scheduled()
 * yang sama (mapping CRON_ROUTES → panggil /api/cron/* & /api/ceo-agent)
 * ke default export .open-next/worker.js — IDEMPOTENT (aman dipanggil
 * berulang; kalau sudah ada scheduled, tidak diubah).
 *
 * Hasilnya: JALUR DEPLOY MANA PUN selalu punya cron handler.
 * ============================================================
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const workerPath = join(root, '.open-next', 'worker.js')

const MARKER = '__LTX_CRON_SCHEDULED__'

/* Handler scheduled — identik dengan worker-entry.ts (single source:
   worker-entry.ts tetap ada; salinan ini hanya untuk jalur deploy yang
   memakai worker generated sebagai main). */
const SCHEDULED_CODE = `
  /* ==== ${MARKER} (injected by scripts/patch-cf-worker-cron.mjs) ====
     Cron trigger CF → panggil route API Next.js (identik worker-entry.ts).
     - 0 1 harian  = 08:00 WIB (daily-reminder + downgrade + COO + CEO briefing/analyst/growth + AUTO-ACC)
     - 0 3 harian  = 10:00 WIB (re-engage + downgrade)
     - 0 3 Senin   = 10:00 WIB (weekly-summary + CEO weekly)
     - tiap 15 menit = econ-calendar + watchdog + agent sweep + pine-alerts (backup GHA 5 menit) */
  async scheduled(event, env, ctx) {
    const CRON_ROUTES = {
      '0 1 * * *': ['/api/cron/daily-reminder', '/api/cron/downgrade-expired-pro', '/api/cron/ai-coo-agent', '/api/ceo-agent?action=briefing', '/api/ceo-agent?action=analyst', '/api/ceo-agent?action=growth'],
      '0 3 * * *': ['/api/cron/re-engage', '/api/cron/downgrade-expired-pro'],
      '0 3 * * 1': ['/api/cron/weekly-summary', '/api/ceo-agent?action=weekly'],
      '*/15 * * * *': ['/api/cron/econ-calendar-notify', '/api/ceo-agent?action=watchdog', '/api/agent-proposals?run=sweep', '/api/cron/pine-alerts'],
    }
    const routes = CRON_ROUTES[event.cron]
    if (!routes) { console.warn('[cron] No routes mapped for:', event.cron); return }
    const siteUrl = String(env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id').replace(/\\/+$/, '')
    const cronSecret = env.CRON_SECRET || env.VAPID_PRIVATE_KEY || ''
    console.log('[cron] Triggered:', event.cron, '→', routes.join(', '))
    for (const route of routes) {
      ctx.waitUntil((async () => {
        try {
          const isCeo = route.startsWith('/api/ceo-agent') || route.startsWith('/api/agent-proposals')
          const ceoKey = env.CRON_SECRET || env.ADMIN_SECRET
          let path = route
          if (isCeo && ceoKey) path += (path.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(ceoKey)
          const headers = { 'Content-Type': 'application/json' }
          if (cronSecret) headers['Authorization'] = 'Bearer ' + cronSecret
          const res = await fetch(siteUrl + path, {
            method: 'GET', headers,
            signal: AbortSignal.timeout(isCeo ? 120000 : 30000),
          })
          if (!res.ok) console.error('[cron]', route, '→', res.status)
          else console.log('[cron]', route, 'OK:', (await res.text()).slice(0, 200))
        } catch (err) {
          console.error('[cron]', route, 'error:', err && err.message ? err.message : err)
        }
      })())
    }
  },
`

if (!existsSync(workerPath)) {
  console.error('❌ patch-cf-worker-cron: .open-next/worker.js tidak ditemukan — jalankan build dulu (bun run build)')
  process.exit(0) // jangan gagalkan build (mis. build Capacitor tanpa .open-next)
}

let src = readFileSync(workerPath, 'utf8')

if (src.includes(MARKER)) {
  console.log('✅ patch-cf-worker-cron: scheduled() sudah ada di .open-next/worker.js (idempotent — skip)')
  process.exit(0)
}

if (src.includes('scheduled(') && /default\s+export\s*\{[\s\S]*scheduled/.test(src)) {
  console.log('✅ patch-cf-worker-cron: worker.js sudah export scheduled sendiri — skip')
  process.exit(0)
}

/* Template worker OpenNext: `export default {` diikuti `async fetch(...)`.
   Suntikkan scheduled sebagai properti pertama default export. */
const anchor = 'export default {'
const idx = src.indexOf(anchor)
if (idx === -1) {
  console.error('⚠️ patch-cf-worker-cron: anchor `export default {` tidak ditemukan di .open-next/worker.js — struktur worker berubah? SKIP (worker-entry.ts tetap punya scheduled)')
  process.exit(0)
}

src = src.slice(0, idx + anchor.length) + '\n' + SCHEDULED_CODE + src.slice(idx + anchor.length)
writeFileSync(workerPath, src)
console.log('✅ patch-cf-worker-cron: scheduled() DISUNTAMPUKAN ke .open-next/worker.js — cron 0 1/3 * * * + */15 siap jalan di jalur deploy mana pun')
