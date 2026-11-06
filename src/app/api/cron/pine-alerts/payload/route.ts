/**
 * ============================================================
 * GET /api/cron/pine-alerts/payload — paket evaluasi GHA runner
 * ============================================================
 * JALUR UTAMA alert Pine (fix "engine PineTS 422 di produksi"):
 * runtime Cloudflare Workers melarang code generation, jadi engine
 * PineTS dieksekusi di GitHub Actions runner (Node penuh). Endpoint
 * ini menyusun PAKET per grup langganan: sumber skrip + candle
 * server + daftar user + watermark.
 *
 * Response: { ok, generatedAt, groupsTotal, groups: [{
 *   scriptId, scriptName, source, alertRules, symbol, interval,
 *   candleSource, candleError?, bars: [{time,open,high,low,close}],
 *   users: [{userId, sinceSec?}] }] }
 *
 * Auth: x-cron-secret / ?secret= / Bearer — PINE_ALERT_CRON_SECRET
 * ATAU CRON_SECRET (fail-closed; dev lokal tanpa secret diizinkan).
 * Source Pine tetap TIDAK pernah keluar ke browser — hanya ke
 * runner GHA (secret-gated).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminAsync } from '@/lib/supabase-admin-alt'
import { buildAlertGroups } from '@/lib/pine-alert-groups'
import { fetchServerCandles } from '@/lib/market/server-candles'

export const dynamic = 'force-dynamic'

const MAX_GROUPS = 30

function isAuthorized(request: NextRequest): boolean {
  const validSecrets = [
    String(process.env.PINE_ALERT_CRON_SECRET || '').trim(),
    String(process.env.CRON_SECRET || '').trim(),
  ].filter(Boolean)
  if (!validSecrets.length) return process.env.NODE_ENV === 'development'
  const provided = String(
    request.headers.get('x-cron-secret')
    || new URL(request.url).searchParams.get('secret')
    || (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    || '',
  ).trim()
  return !!provided && validSecrets.includes(provided)
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const started = Date.now()
  const supabase = await getSupabaseAdminAsync()
  if (!supabase) return NextResponse.json({ error: 'Supabase service role tidak tersedia' }, { status: 503 })

  const built = await buildAlertGroups(supabase)
  const groups = []
  for (const g of built.groups.slice(0, MAX_GROUPS)) {
    let bars: Array<{ time: number; open: number; high: number; low: number; close: number }> = []
    let candleSource: string | null = null
    let candleError: string | undefined
    try {
      const cd = await fetchServerCandles(g.symbol, g.interval, 300)
      if (cd?.bars?.length) {
        bars = cd.bars
        candleSource = cd.source
      } else {
        candleError = `Data candle ${g.symbol} ${g.interval} tidak tersedia dari semua sumber server`
      }
    } catch (e: any) {
      candleError = `Candle gagal: ${String(e?.message || e).slice(0, 120)}`
    }
    groups.push({
      scriptId: g.script.id,
      scriptName: g.script.name,
      source: g.script.source,
      alertRules: g.script.alert_rules ?? null,
      symbol: g.symbol,
      interval: g.interval,
      candleSource,
      ...(candleError ? { candleError } : {}),
      bars,
      users: g.users,
    })
  }

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    checked: built.checked,
    groupsTotal: built.groups.length,
    // DIAGNOSTIK (fix "grup: 0 · langganan: 1" misterius): sebelumnya
    // alasan langganan di-skip tidak pernah keluar ke mana pun — log
    // engine malah bilang "tidak ada langganan aktif" padahal ada 1.
    skippedNoScript: built.skippedNoScript,
    skippedNoPro: built.skippedNoPro,
    groupsCapped: built.groups.length > MAX_GROUPS,
    groups,
    durationMs: Date.now() - started,
  })
}

export async function GET(request: NextRequest) { return handle(request) }
export async function POST(request: NextRequest) { return handle(request) }
