/**
 * ============================================================
 * POST /api/webhooks/pine-signal — Webhook sinyal Pine Lab
 * (jalur REALTIME dari watcher VPS, tanpa menunggu cron jam-an)
 * ============================================================
 * Alur:
 *   VPS (pine-watcher) pantau candle H1 -> engine Lux -> ada event
 *   baru -> POST ke sini -> route ini:
 *     1. cek header x-webhook-secret == env PINE_WEBHOOK_SECRET
 *     2. cari script di pine_scripts (id harus ada & aktif)
 *     3. hitung event_id dengan makeEventId() yang SAMA dengan cron
 *     4. upsert pine_events_sent (ignoreDuplicates) SEBELUM push —
 *        event yang sudah dikirim cron jam-an (backup) ditolak 409,
 *        jadi tidak pernah dobel
 *     5. pushToUser ke pemilik script (pola persis cron)
 *     6. catat pine_runs trigger='webhook' (best-effort)
 *
 * Kode status:
 *   200 = diterima & dipush (atau diterima tapi tidak dipush, lihat
 *         field pushed/reason) · 400 = payload tidak valid ·
 *   401 = secret salah/kosong · 404 = script_id tidak dikenal ·
 *   409 = event sudah pernah dikirim (duplikat) · 500 = server error
 *
 * DEPLOY: letakkan file ini di repo sebagai
 *   src/app/api/webhooks/pine-signal/route.ts
 * lalu deploy seperti biasa (bun run build && npx wrangler deploy).
 * Secret:  npx wrangler secret put PINE_WEBHOOK_SECRET
 *   (atau Dashboard -> Settings -> Variables -> Encrypt).
 *   Nilai yang SAMA dipakai di /root/pine-watcher/.env di VPS.
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { pushToUser } from '@/lib/push-notify'
import { makeEventId } from '@/lib/pine-lab/runner'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/* id pine_scripts selalu UUID */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isAuthorized(request: NextRequest): boolean {
  const secret = String(process.env.PINE_WEBHOOK_SECRET || '').trim()
  if (!secret) return false
  const provided = String(request.headers.get('x-webhook-secret') || '').trim()
  return provided.length > 0 && provided === secret
}

interface WebhookBody {
  script_id?: unknown
  time?: unknown
  title?: unknown
  message?: unknown
  price?: unknown
  source?: unknown
  duration_ms?: unknown
  bars?: unknown
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: 'pine-signal',
    usage: 'POST {script_id, time, title, message} + header x-webhook-secret',
  })
}

export async function POST(request: NextRequest) {
  // ── 0) Secret belum diset di Cloudflare = salah konfigurasi ──
  if (!String(process.env.PINE_WEBHOOK_SECRET || '').trim()) {
    return NextResponse.json(
      { error: 'Webhook belum dikonfigurasi (PINE_WEBHOOK_SECRET kosong)' },
      { status: 500 },
    )
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 1) Validasi payload ──
  let body: WebhookBody
  try {
    body = (await request.json()) as WebhookBody
  } catch {
    return NextResponse.json({ error: 'Body bukan JSON valid' }, { status: 400 })
  }
  const scriptId = String(body?.script_id ?? '').trim()
  const time = Number(body?.time)
  const title = String(body?.title ?? '').trim()
  const message = String(body?.message ?? '').trim()
  const price = body?.price === undefined ? undefined : Number(body.price)
  const source = String(body?.source ?? 'watcher').slice(0, 20)
  const durationMs =
    body?.duration_ms === undefined ? 0 : Math.max(0, Math.floor(Number(body.duration_ms) || 0))
  const bars =
    body?.bars === undefined ? 0 : Math.max(0, Math.floor(Number(body.bars) || 0))

  if (!UUID_RE.test(scriptId)) {
    return NextResponse.json({ error: 'script_id tidak valid (harus UUID)' }, { status: 400 })
  }
  if (!Number.isInteger(time) || time <= 0) {
    return NextResponse.json({ error: 'time tidak valid (epoch detik)' }, { status: 400 })
  }
  const nowSec = Math.floor(Date.now() / 1000)
  if (time > nowSec + 3600 || time < nowSec - 24 * 3600) {
    return NextResponse.json(
      { error: 'time di luar rentang wajar (maks 24 jam ke belakang, 1 jam ke depan)' },
      { status: 400 },
    )
  }
  if (!title || title.length > 120) {
    return NextResponse.json({ error: 'title kosong atau terlalu panjang (maks 120)' }, { status: 400 })
  }
  if (!message || message.length > 500) {
    return NextResponse.json({ error: 'message kosong atau terlalu panjang (maks 500)' }, { status: 400 })
  }
  if (price !== undefined && !Number.isFinite(price)) {
    return NextResponse.json({ error: 'price tidak valid' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  // ── 2) Cari script (pemilik + nama + simbol + status aktif) ──
  const { data: script, error: sErr } = await admin
    .from('pine_scripts')
    .select('id, user_id, name, symbol, active')
    .eq('id', scriptId)
    .single()
  if (sErr || !script) {
    return NextResponse.json({ error: 'script_id tidak dikenal' }, { status: 404 })
  }
  const userId = String(script.user_id)
  const symbol = String(script.symbol || 'XAUUSD')
  const scriptName = String(script.name || scriptId).slice(0, 60)

  // ── 3) event_id — hitung di server dengan fungsi YANG SAMA dengan cron ──
  const eventId = makeEventId(scriptId, { time, title })

  // ── 4) Dedupe DB SEBELUM push (upsert ignoreDuplicates) ──
  // Baris yang balik HANYA bila benar-benar baru; kalau kosong berarti
  // event ini sudah dikirim (oleh cron jam-an atau webhook sebelumnya).
  const { data: inserted, error: dErr } = await admin
    .from('pine_events_sent')
    .upsert(
      [{ user_id: userId, script_id: scriptId, event_id: eventId }],
      { ignoreDuplicates: true, onConflict: 'user_id,script_id,event_id' },
    )
    .select('event_id')
  if (dErr) {
    console.error('[webhook/pine-signal] dedupe gagal:', dErr.message)
    return NextResponse.json({ error: 'Gagal dedupe event' }, { status: 500 })
  }
  if (!inserted || inserted.length === 0) {
    return NextResponse.json({ ok: false, duplicate: true, event_id: eventId }, { status: 409 })
  }

  // Script nonaktif: event dicatat (supaya tidak diproses lagi) tapi
  // tidak dipush — pemilik sengaja mematikannya.
  if (!script.active) {
    return NextResponse.json({
      ok: true,
      event_id: eventId,
      pushed: false,
      sent: 0,
      duplicate: false,
      reason: 'script_inactive',
    })
  }

  // ── 5) Push ke pemilik script (pola persis cron pine-lab) ──
  const res = await pushToUser(
    admin,
    userId,
    {
      title: `Lux Lab · ${scriptName}`,
      body: `[${symbol} H1] ${title}: ${message}`.slice(0, 220),
      tag: 'pine-lab',
      url: '/pine-lab',
      type: 'pine-lab',
    },
    { dedupe: false }, // dedupe SUDAH oleh pine_events_sent DB-level
  )

  // ── 6) Catat run (best-effort — gagal catat tidak menggagalkan push) ──
  try {
    await admin.from('pine_runs').insert({
      user_id: userId,
      script_id: scriptId,
      trigger: 'webhook',
      ok: true,
      duration_ms: durationMs,
      bars,
      events: 1,
      error_code: null,
      error_message: null,
    })
    await admin
      .from('pine_scripts')
      .update({ last_run_at: new Date().toISOString(), last_run_ms: durationMs })
      .eq('id', scriptId)
      .eq('user_id', userId)
  } catch (e) {
    console.warn('[webhook/pine-signal] catat run gagal (non-kritis):', e)
  }

  if (res.skipped === 'no-subs') {
    return NextResponse.json({
      ok: true,
      event_id: eventId,
      pushed: false,
      sent: 0,
      duplicate: false,
      reason: 'no-subs',
    })
  }
  return NextResponse.json({
    ok: true,
    event_id: eventId,
    pushed: res.sent > 0,
    sent: res.sent,
    duplicate: false,
    ...(res.error ? { push_error: res.error } : {}),
  })
}
