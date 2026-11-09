import { NextResponse } from 'next/server'
import { getCloudflareEnv, getEnvVar } from '@/lib/cloudflare-bindings'

// ══════════════════════════════════════════════════════════════════════════
// POST /api/cron/ig-media-store — simpan media (video Reels / slide carousel)
// ke KV worker sendiri, lalu kembalikan URL publik yang BISA diambil server IG.
//
// KENAPA ADA:
//   Hosting publik (tmpfiles/0x0.st/litterbox) terbukti bikin IG gagal
//   error 2207082 "Media upload has failed" — tmpfiles malah redirect 302
//   + cookie + halaman HTML, bukan file video. Self-host = respons 200
//   langsung, Content-Type benar, tanpa redirect.
//
//   KV free tier: value maks 25MB (video ±5MB aman), TTL dipakai agar
//   otomatis bersih. 7 hari (dulu 3): draft Reels menunggu ACC Bos di
//   Antrean Eksekusi bisa berhari-hari — dulu file hilang sebelum diACC
//   → publish IG gagal misterius. 7 hari + pre-flight cek execute-action.
//
// Auth: Bearer CRON_SECRET (fail-closed bila secret belum diset).
// Body : binary mentah, Content-Type mis. video/mp4 / image/png.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const MAX_BYTES = 24 * 1024 * 1024 // 24MB (KV limit 25MB — sisakan ruang)
const TTL_SECONDS = 7 * 24 * 60 * 60 // 7 hari (draft ACC bisa nunggu lama)

function extFor(ct: string): string {
  const c = ct.toLowerCase()
  if (c.includes('png')) return 'png'
  if (c.includes('jpeg') || c.includes('jpg')) return 'jpg'
  if (c.includes('webp')) return 'webp'
  if (c.includes('webm')) return 'webm'
  if (c.includes('mov')) return 'mov'
  return 'mp4' // default video/mp4
}

export async function POST(request: Request) {
  try {
    /* ── Auth (pola sama dengan ig-auto-post) ── */
    const expectedSecret = (await getEnvVar('CRON_SECRET')) || process.env.CRON_SECRET
    if (!expectedSecret) {
      return NextResponse.json(
        { ok: false, error: 'CRON_SECRET not configured — endpoint disabled (fail-closed)' },
        { status: 503 }
      )
    }
    const auth = request.headers.get('authorization') || ''
    if (auth !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    /* ── KV binding ── */
    const kv = (await getCloudflareEnv()).luxtradee_kv
    if (!kv) {
      return NextResponse.json(
        { ok: false, error: 'KV binding luxtradee_kv tidak tersedia' },
        { status: 503 }
      )
    }

    /* ── Baca body ── */
    const contentType = (request.headers.get('content-type') || 'video/mp4').split(';')[0].trim()
    const buf = await request.arrayBuffer()
    if (!buf || buf.byteLength === 0) {
      return NextResponse.json({ ok: false, error: 'Body kosong' }, { status: 400 })
    }
    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: `Terlalu besar: ${buf.byteLength}B (maks ${MAX_BYTES}B — limit KV)` },
        { status: 413 }
      )
    }

    /* ── Simpan ke KV ── */
    const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    const key = `ig-media-${Date.now()}-${rand}.${extFor(contentType)}`
    await kv.put(key, buf, {
      expirationTtl: TTL_SECONDS,
      metadata: { ct: contentType },
    })

    /* ── Susun URL publik ── */
    const base =
      (await getEnvVar('NEXT_PUBLIC_SITE_URL')) ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      new URL(request.url).origin
    const url = `${base.replace(/\/+$/, '')}/api/media/ig/${key}`

    console.log('[ig-media-store] stored:', key, buf.byteLength, 'B as', contentType)
    return NextResponse.json({ ok: true, key, url, bytes: buf.byteLength, contentType })
  } catch (err: any) {
    console.error('[ig-media-store] error:', err?.message)
    return NextResponse.json({ ok: false, error: err?.message || 'Internal error' }, { status: 500 })
  }
}
