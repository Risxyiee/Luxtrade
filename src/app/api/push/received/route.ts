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
 * FIX PER-DEVICE: dulu bukti disimpan per-USER (pushrecv:<uid>:<tag>) —
 * padahal /api/push/test kirim ke SEMUA perangkat user sekaligus. Device
 * pertama yang lapor (mis. DESKTOP yang kebetulan online) menimpa bukti →
 * UI bilang "Sampai di HP kamu!" padahal HP tidak pernah menerima.
 * Sekarang bukti berbentuk MAP per endpoint: { [epTail]: {at, ok, reason} }
 * → UI bisa bilang persis: "desktop ✓, iPhone ✗ belum lapor".
 *
 * Kenapa KV: serverless multi-isolate — bukti harus terbaca lintas isolate,
 * dan TTL otomatis membereskan sampahnya. Tanpa data sensitif.
 */

const RECEIPT_TTL = 120 // detik

interface DeviceReceipt {
  at: number
  type?: string
  ok?: boolean
  reason?: string
}

type ReceiptMap = Record<string, DeviceReceipt>

function sanitizeKey(key: string | null | undefined, fallback: string, max = 60): string {
  const t = (key || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, max)
  return t || fallback
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
    const tag = sanitizeKey(body?.tag, 'default')
    const type = sanitizeKey(body?.type, 'general')
    const ep = sanitizeKey(body?.ep, 'device', 40)
    /* ok:false = push SAMPAI di SW tapi showNotification GAGAL (reason=kenapa).
       Dulu hanya sukses yang dilaporkan → tombol tes gak bisa membedakan
       "gak sampai" vs "sampai tapi gagal tampil" (iOS Settings/Focus dsb). */
    const ok = body?.ok !== false
    const reason = typeof body?.reason === 'string' ? body.reason.slice(0, 160) : undefined

    // MAP per device — merge, jangan timpa laporan device lain
    const key = `pushrecv:${user.id}:${tag}`
    const existing = (await kvGet<ReceiptMap>(key)) || {}
    existing[ep] = { at: Date.now(), type, ok, ...(reason ? { reason } : {}) }
    await kvSet(key, existing, { ttl: RECEIPT_TTL })

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

    const tag = sanitizeKey(new URL(request.url).searchParams.get('tag'), 'default')
    const receipts = (await kvGet<ReceiptMap>(`pushrecv:${user.id}:${tag}`)) || {}
    const eps = Object.keys(receipts)

    return NextResponse.json({
      // Backward-compat: received = ada minimal 1 laporan masuk
      received: eps.length > 0,
      at: eps.length ? receipts[eps[0]].at : null,
      ok: eps.length ? receipts[eps[0]].ok !== false : undefined,
      reason: eps.length ? receipts[eps[0]].reason : undefined,
      // BARU: laporan per perangkat → UI bedakan "desktop ✓ / HP ✗"
      count: eps.length,
      receipts,
      note: eps.length ? undefined : 'Belum ada laporan dari device (TTL 120s)',
    })
  } catch (error: any) {
    console.error('[push/received] GET error:', error?.message)
    return NextResponse.json({ error: 'Gagal membaca bukti penerimaan' }, { status: 500 })
  }
}
