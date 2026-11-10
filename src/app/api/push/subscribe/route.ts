import { NextRequest, NextResponse } from 'next/server'

/* ═══════════════════════════════════════════════════════════════════════════
   POST /api/push/subscribe — simpan subscription Web Push user.

   ⚡ REWRITE TANPA supabase-js (insiden exceededCpu 10 Nov 2026, 23:10 WIB):
   Versi lama meng-import createAdminClientAsync + isUserPro + api-auth +
   require-admin → graph modulnya menyematkan @supabase/supabase-js + ssr
   4 lapis. Di isolate Workers DINGIN (first hit), evaluasi bundle itu saja
   melampaui batas CPU 10ms paket FREE Cloudflare → HTTP 503
   "Worker exceeded CPU time limit" (ray 945e4f7c, outcome=exceededCpu,
   cpuTimeMs=10/wallTimeMs=13).

   Kini route ini ZERO heavy import — hanya next/server. Semua kerja lewat
   raw fetch ke Supabase (network wait TIDAK mengonsumsi CPU):
     1. Auth   : GET  /auth/v1/user          (Bearer token dari cookie sesi)
     2. Pro    : GET  /rest/v1/profiles      (service key, mirror isUserPro)
     3. Upsert : POST /rest/v1/push_subscriptions?on_conflict=endpoint
     4. Cleanup: DELETE /rest/v1/push_subscriptions?user_id&user_agent&endpoint=neq
                (sekali fetch — dulu select dulu baru delete = 2 roundtrip)

   Parser cookie sesi = SALIN persis dari middleware.ts (teruji produksi:
   format base64-, chunk .0/.1, dan JWT mentah). Verifikasi identitas tetap
   KRIPTOGRAFIS di server Supabase (/auth/v1/user memvalidasi JWT) — bukan
   verifikasi lokal.

   Kontrak error DIPERTAHANKAN identik dengan versi lama (400/401/403/500 +
   pesan sama) supaya client PWA tidak perlu berubah.
   ═══════════════════════════════════════════════════════════════════════ */

export const dynamic = 'force-dynamic'

/** Admin fallback — mirror ADMIN_EMAILS di lib/admin-auth (satu-satunya
 *  pengecualian "subscribe untuk orang lain"; ADMIN_IDS memang kosong). */
const ADMIN_EMAILS = ['luxtradee@gmail.com']

/** Fallback publishable key — dipakai bila env hilang/legacy (lihat client.ts). */
const PUB_KEY_FALLBACK = 'sb_publishable_gYf7ekooCy36EmIv8_PKzw_ixj0zKhE'
const SUPA_URL_FALLBACK = 'https://klxkdrfsfcoankbaoejn.supabase.co'
const REF_FALLBACK = 'klxkdrfsfcoankbaoejn'

/** Baca env: CF Workers secret lewat globalThis context dulu, lalu process.env
 *  (pola sama dengan lib/supabase/admin.ts, tanpa import apa pun). */
function env(name: string): string {
  try {
    const ctx = (globalThis as unknown as Record<symbol, { env?: Record<string, unknown> }>)[
      Symbol.for('__cloudflare-context__')
    ]
    const v = ctx?.env?.[name]
    if (typeof v === 'string' && v.length > 0) return v
  } catch { /* bukan runtime CF */ }
  try {
    const v = process.env?.[name]
    if (typeof v === 'string' && v.length > 0) return v
  } catch { /* tanpa process */ }
  return ''
}

/** Decode base64URL → string (normalisasi alphabet URL-safe utk workerd atob). */
function fromBase64URL(s: string): string | null {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
    return atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  } catch { return null }
}

/** Ambil access token JWT dari cookie sesi Supabase (@supabase/ssr v0.9):
 *  `sb-<ref>-auth-token` = `base64-` + base64URL(JSON sesi), atau chunk
 *  `.0 .1 ...`, atau JWT mentah. SALIN dari middleware.ts (teruji). */
function extractAccessToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  const cookies: Record<string, string> = {}
  for (const part of cookieHeader.split(';')) {
    const i = part.indexOf('=')
    if (i <= 0) continue
    const k = part.slice(0, i).trim()
    try { cookies[k] = decodeURIComponent(part.slice(i + 1).trim()) } catch { cookies[k] = part.slice(i + 1).trim() }
  }

  // Nama chunk (`-auth-token.0`) juga mengandung `-auth-token` — dikecualikan.
  const baseName = Object.keys(cookies).find(
    (n) => n.startsWith('sb-') && n.includes('-auth-token') && !/-auth-token\.\d+$/.test(n),
  )
  let raw: string | null = baseName ? cookies[baseName] : null

  if (raw == null) {
    const chunkNames = Object.keys(cookies)
      .filter((n) => n.startsWith('sb-') && n.includes('-auth-token.'))
      .sort((a, b) => Number(a.split('.').pop()) - Number(b.split('.').pop()))
    if (chunkNames.length > 0) raw = chunkNames.map((n) => cookies[n]).join('')
  }
  if (!raw) return null

  let value = raw
  if (value.startsWith('base64-')) {
    const decoded = fromBase64URL(value.slice(7))
    if (decoded == null) return null
    value = decoded
  }
  if (value.startsWith('eyJ')) return value // JWT mentah
  try {
    const session = JSON.parse(value) as { access_token?: unknown }
    return typeof session.access_token === 'string' ? session.access_token : null
  } catch { return null }
}

/** GET dengan timeout — network wait tidak makan CPU, tapi hang tetap dibatasi. */
async function getJson(url: string, headers: Record<string, string>, timeoutMs = 12_000): Promise<{ status: number; json: unknown } | null> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) })
    const json = await res.json().catch(() => null)
    return { status: res.status, json }
  } catch { return null }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null
    const userId = typeof body?.userId === 'string' ? body.userId : ''
    const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : ''
    const p256dh = typeof body?.p256dh === 'string' ? body.p256dh : ''
    const auth = typeof body?.auth === 'string' ? body.auth : ''
    const userAgent = typeof body?.userAgent === 'string' ? body.userAgent : ''

    if (!userId || !endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    /* P0 HARDENING (dipertahankan): hanya boleh untuk diri sendiri, kecuali
       admin. Verifikasi = Supabase Auth memvalidasi JWT kriptografis. */
    const token = extractAccessToken(req.headers.get('cookie'))
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized — login dulu untuk mengaktifkan notifikasi' }, { status: 401 })
    }

    const supaUrl = env('NEXT_PUBLIC_SUPABASE_URL') || SUPA_URL_FALLBACK
    const ref = supaUrl.replace(/^https?:\/\//, '').split('.')[0] || REF_FALLBACK
    let pubKey = env('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    if (!pubKey || pubKey.startsWith('eyJ')) pubKey = PUB_KEY_FALLBACK // legacy = disabled Supabase

    const authRes = await getJson(`${supaUrl}/auth/v1/user`, {
      apikey: pubKey,
      Authorization: `Bearer ${token}`,
    })
    const authUser = (authRes?.json as { id?: string; email?: string } | null) ?? null
    if (!authRes || authRes.status !== 200 || !authUser?.id) {
      return NextResponse.json({ error: 'Unauthorized — login dulu untuk mengaktifkan notifikasi' }, { status: 401 })
    }
    if (authUser.id !== userId) {
      const email = String(authUser.email || '').toLowerCase()
      if (!ADMIN_EMAILS.includes(email)) {
        return NextResponse.json({ error: 'Forbidden — hanya bisa subscribe untuk akun sendiri' }, { status: 403 })
      }
    }

    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceKey) {
      console.error('[push/subscribe] SUPABASE_SERVICE_ROLE_KEY tidak tersedia')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    const restHeaders: Record<string, string> = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    }

    /* Verify user is Pro — mirror persis logika lib/pro-check.ts
       (is_pro === true DAN (subscription_until || pro_expiry) > sekarang). */
    const proRes = await getJson(
      `${supaUrl}/rest/v1/profiles?select=is_pro,subscription_until,pro_expiry&id=eq.${encodeURIComponent(userId)}`,
      restHeaders,
    )
    const rows = Array.isArray(proRes?.json) ? (proRes.json as Record<string, unknown>[]) : []
    const profile = rows[0]
    let isPro = false
    if (profile && profile.is_pro === true) {
      const untilStr = (profile.subscription_until || profile.pro_expiry) as string | null
      if (untilStr) {
        const until = new Date(untilStr)
        isPro = until > new Date()
        if (!isPro) console.log(`[push/subscribe] User ${userId} PRO expired at ${untilStr}`)
      }
    }
    if (!proRes || proRes.status !== 200) {
      console.error('[push/subscribe] Gagal query profiles (HTTP ' + (proRes?.status ?? 'timeout') + ')')
    }
    if (!isPro) {
      return NextResponse.json({ error: 'Push notifications require a Pro account' }, { status: 403 })
    }

    /* Upsert — PostgREST native: on_conflict=endpoint + merge-duplicates. */
    const upsertRes = await fetch(`${supaUrl}/rest/v1/push_subscriptions?on_conflict=endpoint`, {
      method: 'POST',
      headers: { ...restHeaders, Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: userAgent || null,
        updated_at: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(12_000),
    })
    if (!upsertRes.ok) {
      const detail = (await upsertRes.text().catch(() => '')).slice(0, 180)
      console.error('[push/subscribe] Upsert failed:', upsertRes.status, detail)
      return NextResponse.json({ error: 'Failed to save subscription', detail }, { status: 500 })
    }
    const upsertRows = (await upsertRes.json().catch(() => [])) as { id?: string }[]
    const savedId = upsertRows?.[0]?.id ?? null

    /* FIX STALE-DUPLICATE (rotasi token iOS): endpoint lama milik user_agent
       yang persis sama dibuang — SEKALI fetch DELETE berfilter (dulu select
       dulu baru delete = 2 roundtrip). PostgREST menerima DELETE+filter. */
    if (userAgent) {
      try {
        const delUrl =
          `${supaUrl}/rest/v1/push_subscriptions` +
          `?user_id=eq.${encodeURIComponent(userId)}` +
          `&user_agent=eq.${encodeURIComponent(userAgent)}` +
          `&endpoint=neq.${encodeURIComponent(endpoint)}`
        await fetch(delUrl, {
          method: 'DELETE',
          headers: { ...restHeaders, Prefer: 'return=representation' },
          signal: AbortSignal.timeout(12_000),
        })
      } catch { /* best-effort — jangan gagalkan subscribe karena cleanup */ }
    }

    return NextResponse.json({ success: true, id: savedId })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[push/subscribe] Error:', msg)
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
  }
}
