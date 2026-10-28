/**
 * ============================================================
 * POST /api/send-alert — kirim ALERT ke Telegram Bot utama Bos
 * (Task 36 — freemium quota)
 * ============================================================
 * Body : { message: string, chatId?: string }
 * Auth : session cookie / Bearer (getAuthenticatedUser) — WAJIB login
 *
 * Aturan kuota (SOP Bos):
 *   - Free (is_pro false): maks 2×/HARI. Ke-3 kalinya → 429 dengan
 *     pesan khusus upgrade. Counter di tabel `user_quotas`
 *     (lazy reset harian pakai tanggal WIB — tanpa cron).
 *   - Pro  (is_pro true) : tanpa batas — pengecekan dilewati.
 *
 * Kuota hanya dihitung bila Telegram BENAR-BENAR menerima pesan
 * (gagal jaringan tidak membakar kuota user).
 *
 * Env (Cloudflare → Settings → Variables & Secrets):
 *   TELEGRAM_BOT_TOKEN  — token dari @BotFather (wajib)
 *   TELEGRAM_CHAT_ID    — chat tujuan default (wajib; bisa dioverride
 *                         per-request via body.chatId)
 *
 * GET /api/send-alert → status kuota hari ini (badge UI).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import {
  checkAlertQuota, commitAlertQuota,
  alertQuotaExceededMessage,
  FREE_ALERT_LIMIT_PER_DAY,
} from '@/lib/user-quota'

export const dynamic = 'force-dynamic'

const TG_MAX_LEN = 4000 // Telegram hard limit 4096 — sisakan ruang footer

function envOr(name: string): string {
  const v = process.env[name]
  return typeof v === 'string' ? v.trim() : ''
}

/* ---------- GET: status kuota (badge UI) ---------- */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const q = await checkAlertQuota(auth.user.id)
    return NextResponse.json({
      isPro: q.isPro,
      used: q.isPro ? 0 : q.alerts_today_count,
      limit: q.isPro ? null : FREE_ALERT_LIMIT_PER_DAY,
      remaining: q.isPro ? null : Math.max(0, FREE_ALERT_LIMIT_PER_DAY - q.alerts_today_count),
    })
  } catch (x: any) {
    return NextResponse.json({ error: String(x?.message || x).slice(0, 140) }, { status: 500 })
  }
}

/* ---------- POST: kirim alert ---------- */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = auth.user.id

    const body = await request.json().catch(() => null) as { message?: string; chatId?: string } | null
    const message = String(body?.message || '').trim()
    if (!message) return NextResponse.json({ error: 'message wajib diisi' }, { status: 400 })

    /* 1) KUOTA — hanya untuk FREE (Pro lewati pengecekan sepenuhnya) */
    const q = await checkAlertQuota(userId)
    if (!q.isPro && q.alerts_today_count >= FREE_ALERT_LIMIT_PER_DAY) {
      return NextResponse.json(
        { error: alertQuotaExceededMessage(), used: q.alerts_today_count, limit: FREE_ALERT_LIMIT_PER_DAY },
        { status: 429 },
      )
    }

    /* 2) KIRIM ke Telegram Bot API */
    const token = envOr('TELEGRAM_BOT_TOKEN')
    const chatId = String(body?.chatId || '').trim() || envOr('TELEGRAM_CHAT_ID')
    if (!token || !chatId) {
      return NextResponse.json(
        { error: 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID belum diset — Cloudflare → Workers & Pages → Settings → Variables & Secrets → Add (Token dari @BotFather, Chat ID dari @userinfobot) → Deploy ulang' },
        { status: 503 },
      )
    }

    const text = message.length > TG_MAX_LEN ? message.slice(0, TG_MAX_LEN) + '…' : message
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: AbortSignal.timeout(12_000),
    })
    const tgBody: any = await tgRes.json().catch(() => null)
    if (!tgRes.ok || tgBody?.ok !== true) {
      const desc = String(tgBody?.description || `HTTP ${tgRes.status}`).slice(0, 140)
      return NextResponse.json({ error: `Telegram menolak: ${desc}` }, { status: 502 })
    }

    /* 3) KUOTA CONSUME — hanya FREE & hanya karena kirim sukses */
    if (!q.isPro) await commitAlertQuota(userId)

    return NextResponse.json({
      ok: true,
      isPro: q.isPro,
      used: q.isPro ? 0 : q.alerts_today_count + 1,
      limit: q.isPro ? null : FREE_ALERT_LIMIT_PER_DAY,
      remaining: q.isPro ? null : Math.max(0, FREE_ALERT_LIMIT_PER_DAY - (q.alerts_today_count + 1)),
    })
  } catch (x: any) {
    return NextResponse.json({ error: String(x?.message || x).slice(0, 160) }, { status: 500 })
  }
}
