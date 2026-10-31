import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { kvGet, kvSet } from '@/lib/kv-cache'
import { checkRateLimit } from '@/lib/rate-limit'

/**
 * POST /api/push/received — BUKTI PENERIMAAN dari device (FASE 5 debug).
 *
 * Latar: server kirim push → Apple balas 201 ("diterima") — tapi itu belum
 * berarti notif TAMPIL di HP. Satu-satunya yang bisa membuktikannya adalah
 * DEVICE ITU SENDIRI: sw.js memanggil endpoint ini tepat setelah
 * showNotification() sukses → simpan bukti di KV (TTL 120 detik).
 *
 * GET /api/push/received?tag=push-test — client (tombol tes) bertanya:
 * "sampai gak di HP?" → { received, at }.
 *
 * Kenapa KV: serverless multi-isolate — bukti harus terbaca lintas isolate,
 * dan TTL otomatis membereskan sampahnya. Tanpa data sensitif.
 */

const RECEIPT_TTL = 120 // detik

function sanitizeTag(tag: string | null | undefined): string {
  const t = (tag || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60)
  return t || 'default'
}

export async function POST(request: NextRequest) {
  const limited = checkRateLimit(request, 'push-received', {
    maxRequests: 30,
    windowMs: 60_000,
    message: 'Terlalu banyak laporan — tunggu sebentar.',
  }, 'ip')
  if (limited) return limited

  try {
    const { user } = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const tag = sanitizeTag(body?.tag)
    const type = sanitizeTag(body?.type)

    await kvSet(`pushrecv:${user.id}:${tag}`, { at: Date.now(), type }, { ttl: RECEIPT_TTL })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('[push/received] POST error:', error?.message)
    return NextResponse.json({ error: 'Gagal mencatat bukti penerimaan' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const limited = checkRateLimit(request, 'push-received', {
    maxRequests: 30,
    windowMs: 60_000,
    message: 'Terlalu banyak cek — tunggu sebentar.',
  }, 'ip')
  if (limited) return limited

  try {
    const { user } = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tag = sanitizeTag(new URL(request.url).searchParams.get('tag'))
    const receipt = await kvGet<{ at: number; type?: string }>(`pushrecv:${user.id}:${tag}`)
    return NextResponse.json({
      received: !!receipt,
      at: receipt?.at ?? null,
      note: receipt ? undefined : 'Belum ada laporan dari device (TTL 120s)',
    })
  } catch (error: any) {
    console.error('[push/received] GET error:', error?.message)
    return NextResponse.json({ error: 'Gagal membaca bukti penerimaan' }, { status: 500 })
  }
}
