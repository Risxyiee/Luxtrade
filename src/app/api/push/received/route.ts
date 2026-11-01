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
 * FIX PER-DEVICE + TANPA AUTH (v3): dulu (1) bukti per-USER → device pertama
 * yang lapor (mis. desktop online) dianggap "Sampai di HP" padahal HP tidak
 * nerima; (2) laporan pakai cookie sesi → saat push datang malam hari sesi
 * sering EXPIRED → 401 → bukti hilang → UI selalu "belum ada laporan"
 * walau notif sebenarnya tampil. Sekarang 2 mode:
 *   MODE BARU (sw kirim `ep`): simpan per-ENDPOINT tanpa auth
 *     `pushrecv:ep:<tail>:<tag>` — tidak ada data sensitif (tail 16 char +
 *     tag + ok + reason), TTL 120 dtk, rate-limit ketat. Sesi expired tidak
 *     pengaruh → laporan notif malam hari pun terbaca.
 *   MODE LAMA (sw cached tanpa `ep`): per-user pakai cookie (backward-compat).
 *
 * GET ?tag=X&eps=a,b,c — UI tes bertanya: "device mana yang sudah lapor?"
 * GET ?tag=X (tanpa eps) — mode lama per-user.
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
    const body = await request.json().catch(() => ({}))
    const tag = sanitizeKey(body?.tag, 'default')
    const type = sanitizeKey(body?.type, 'general')
    /* ok:false = push SAMPAI di SW tapi showNotification GAGAL (reason=kenapa).
       Dulu hanya sukses yang dilaporkan → tombol tes gak bisa membedakan
       "gak sampai" vs "sampai tapi gagal tampil" (iOS Settings/Focus dsb). */
    const ok = body?.ok !== false
    const reason = typeof body?.reason === 'string' ? body.reason.slice(0, 160) : undefined

    // ── MODE BARU: per-endpoint, TANPA auth (sesi expired tetap bisa lapor) ──
    const ep = typeof body?.ep === 'string' ? body.ep.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) : ''
    if (ep) {
      const key = `pushrecv:ep:${ep}:${tag}`
      await kvSet(key, { at: Date.now(), type, ok, ...(reason ? { reason } : {}) }, { ttl: RECEIPT_TTL })
      return NextResponse.json({ ok: true })
    }

    // ── MODE LAMA: per-user (sw cached tanpa ep) — butuh cookie sesi ──
    const { user } = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Merge map per device ('device' = sw lama tanpa ep) — jangan timpa laporan lain
    const key = `pushrecv:${user.id}:${tag}`
    const existing = (await kvGet<ReceiptMap>(key)) || {}
    existing['device'] = { at: Date.now(), type, ok, ...(reason ? { reason } : {}) }
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
    const tag = sanitizeKey(new URL(request.url).searchParams.get('tag'), 'default')
    const epsParam = new URL(request.url).searchParams.get('eps')

    // ── MODE BARU: UI kirim daftar ep yang dituju → baca per-endpoint ──
    if (epsParam !== null) {
      const eps = epsParam.split(',').map((s) => sanitizeKey(s, '', 40)).filter(Boolean).slice(0, 20)
      const receipts: ReceiptMap = {}
      await Promise.all(
        eps.map(async (ep) => {
          const r = await kvGet<DeviceReceipt>(`pushrecv:ep:${ep}:${tag}`)
          if (r) receipts[ep] = r
        })
      )
      // SW lama (tanpa ep) selalu jatuh ke bucket 'device'
      const legacy = await kvGet<DeviceReceipt>(`pushrecv:ep:device:${tag}`)
      if (legacy) receipts['device'] = legacy

      const count = Object.keys(receipts).length
      return NextResponse.json({
        received: count > 0,
        at: count ? receipts[Object.keys(receipts)[0]].at : null,
        ok: count ? receipts[Object.keys(receipts)[0]].ok !== false : undefined,
        reason: count ? receipts[Object.keys(receipts)[0]].reason : undefined,
        count,
        receipts,
        note: count ? undefined : 'Belum ada laporan dari device (TTL 120s)',
      })
    }

    // ── MODE LAMA: per-user ──
    const { user } = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const receipts = (await kvGet<ReceiptMap>(`pushrecv:${user.id}:${tag}`)) || {}
    const eps2 = Object.keys(receipts)
    return NextResponse.json({
      received: eps2.length > 0,
      at: eps2.length ? receipts[eps2[0]].at : null,
      ok: eps2.length ? receipts[eps2[0]].ok !== false : undefined,
      reason: eps2.length ? receipts[eps2[0]].reason : undefined,
      count: eps2.length,
      receipts,
      note: eps2.length ? undefined : 'Belum ada laporan dari device (TTL 120s)',
    })
  } catch (error: any) {
    console.error('[push/received] GET error:', error?.message)
    return NextResponse.json({ error: 'Gagal membaca bukti penerimaan' }, { status: 500 })
  }
}
