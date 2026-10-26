import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/webhooks/resend
 *
 * 📬 RECEIVER WEBHOOK RESEND — mata Bagas COO (open-rate email)
 *
 * Resend mengirim event di sini setelah email terkirim:
 *   - email.delivered → email masuk inbox penerima
 *   - email.opened    → lead BUKA email (ini yang dipakai follow-up!)
 *   - email.clicked   → lead KLIK link di email (sinyal paling kuat)
 *   - email.bounced   → email gagal (alamat salah/bounce)
 *
 * Setiap event.opened/clicked dicatat ke tabel agent_kv:
 *   open:{email}      → JSON { last, count, clicks, bounced }  ← dibaca COO cron
 *   opens:{tanggal}   → angka total open hari itu (laporan CFO/CEO)
 *
 * SETUP SEKALI (Bos):
 *   1. resend.com → Webhooks → Add Endpoint → URL:
 *      https://luxtradee.web.id/api/webhooks/resend
 *   2. Centang event: email.delivered, email.opened, email.clicked, email.bounced
 *   3. (Disarankan) Copy Signing Secret → Cloudflare → Variables & Secrets →
 *      tambah RESEND_WEBHOOK_SECRET (verifikasi tanda tangan aktif otomatis)
 *
 * GET → panduan setup (dipakai saat lupa).
 */

export const dynamic = 'force-dynamic'

/* ---------- Supabase REST helpers (agent_kv sama dengan ceo-agent) ---------- */
function sbUrl() {
  return (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
}
function sbKey() {
  // service role dulu (bypass RLS), fallback anon (agent_kv memang terbuka untuk anon)
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
}
function sbH(): Record<string, string> {
  const key = sbKey()
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
}

async function kvGetRaw(key: string): Promise<string | null> {
  const url = sbUrl(); if (!url || !sbKey()) return null
  try {
    const res = await fetch(`${url}/rest/v1/agent_kv?select=value&key=eq.${encodeURIComponent(key)}`, {
      headers: sbH(), signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const rows = (await res.json()) as { value?: string }[]
    return rows[0]?.value ?? null
  } catch { return null }
}

async function kvSetRaw(key: string, value: string): Promise<void> {
  const url = sbUrl(); if (!url || !sbKey()) return
  try {
    await fetch(`${url}/rest/v1/agent_kv?on_conflict=key`, {
      method: 'POST',
      headers: { ...sbH(), Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ key, value }),
      signal: AbortSignal.timeout(8000),
    })
  } catch { /* webhook jangan meledak — Resend retry kalau 5xx, tapi kita pilih diam */ }
}

async function kvIncrRaw(key: string): Promise<void> {
  const cur = parseInt((await kvGetRaw(key)) || '0', 10)
  await kvSetRaw(key, String(cur + 1))
}

/* ---------- verifikasi tanda tangan svix (Resend pakai svix) ----------
   signedContent = "{svix_id}.{svix_timestamp}.{body}"
   secret = base64 di belakang prefiks "whsec_"
   HMAC-SHA256 → base64 → cocokkan dengan entri "v1,..." di svix-signature   */
async function verifySvix(req: NextRequest, rawBody: string): Promise<{ ok: boolean; reason?: string }> {
  const secretRaw = process.env.RESEND_WEBHOOK_SECRET || ''
  if (!secretRaw) return { ok: true, reason: 'RESEND_WEBHOOK_SECRET tidak diset — verifikasi dilewati' }

  const id = req.headers.get('svix-id') || ''
  const ts = req.headers.get('svix-timestamp') || ''
  const sigHeader = req.headers.get('svix-signature') || ''
  if (!id || !ts || !sigHeader) return { ok: false, reason: 'header svix hilang' }

  // anti-replay: timestamp maks 5 menit
  const age = Math.abs(Date.now() / 1000 - parseInt(ts, 10))
  if (!Number.isFinite(age) || age > 300) return { ok: false, reason: 'timestamp svix kadaluarsa' }

  const secretB64 = secretRaw.startsWith('whsec_') ? secretRaw.slice(6) : secretRaw
  const enc = new TextEncoder()
  let keyBytes: Uint8Array
  try {
    const bin = atob(secretB64)
    keyBytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) keyBytes[i] = bin.charCodeAt(i)
  } catch { keyBytes = enc.encode(secretB64) }

  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes as unknown as ArrayBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(`${id}.${ts}.${rawBody}`))
  const b64 = btoa(String.fromCharCode(...new Uint8Array(mac)))

  const provided = sigHeader.split(' ').map(s => s.trim()).filter(Boolean)
  const valid = provided.some(s => {
    const [, sig] = s.split(',')
    return sig === b64
  })
  return valid ? { ok: true } : { ok: false, reason: 'tanda tangan svix tidak cocok' }
}

/* ---------- handler ---------- */
function recipient(data: Record<string, unknown>): string {
  const to = data?.to
  if (typeof to === 'string') return to.toLowerCase().trim()
  if (Array.isArray(to) && to.length && typeof to[0] === 'string') return String(to[0]).toLowerCase().trim()
  return ''
}

export async function POST(req: NextRequest) {
  const raw = await req.text()

  const svix = await verifySvix(req, raw)
  if (!svix.ok) return NextResponse.json({ error: 'signature invalid — ' + svix.reason }, { status: 401 })

  let evt: { type?: string; data?: Record<string, unknown> }
  try { evt = JSON.parse(raw) } catch { return NextResponse.json({ error: 'body bukan JSON' }, { status: 400 }) }

  const type = evt.type || ''
  const email = recipient(evt.data || {})
  if (!email) return NextResponse.json({ ok: true, ignored: 'penerima tidak terbaca' })
  if (!/^(email\.(delivered|opened|clicked|bounced|complaint))$/.test(type))
    return NextResponse.json({ ok: true, ignored: type })

  /* Buka/klik dicatat per penerima — inilah yang dibaca Bagas COO saat cron pagi */
  if (type === 'email.opened' || type === 'email.clicked') {
    const prev = JSON.parse((await kvGetRaw(`open:${email}`)) || '{}') as { count?: number; clicks?: number; last?: string }
    const next = {
      last: new Date().toISOString(),
      count: (prev.count || 0) + (type === 'email.opened' ? 1 : 0),
      clicks: (prev.clicks || 0) + (type === 'email.clicked' ? 1 : 0),
    }
    await kvSetRaw(`open:${email}`, JSON.stringify(next))
    await kvIncrRaw(type === 'email.opened' ? `opens:${new Date().toISOString().slice(0, 10)}` : `clicks:${new Date().toISOString().slice(0, 10)}`)
  }

  /* Bounce/complaint dicatat juga — lead yang bounce jangan di-email lagi */
  if (type === 'email.bounced' || type === 'email.complaint') {
    const prev = JSON.parse((await kvGetRaw(`open:${email}`)) || '{}') as Record<string, unknown>
    await kvSetRaw(`open:${email}`, JSON.stringify({ ...prev, bounced: true, lastEvent: type, last: new Date().toISOString() }))
  }

  return NextResponse.json({ ok: true, type, email })
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Endpoint webhook Resend aktif — pasang URL ini di resend.com → Webhooks',
    setup: [
      '1. resend.com → Webhooks → Add Endpoint',
      '2. URL: https://luxtradee.web.id/api/webhooks/resend',
      '3. Events: email.delivered, email.opened, email.clicked, email.bounced',
      '4. (Disarankan) Signing Secret → Cloudflare secret RESEND_WEBHOOK_SECRET',
    ],
    tracking: 'event opened/clicked dicatat ke agent_kv: open:{email} & opens:{tanggal} — dibaca Bagas COO untuk follow-up lead yang buka email tapi belum PRO',
  })
}
