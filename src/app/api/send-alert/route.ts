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
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
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
      // CATATAN (2026-10-30): chatBound belum di-wire ke checkAlertQuota (getQuotaRow
      // cuma select 5 kolom kuota) → selalu false saat ini; cast menjaga perilaku
      // persis sama sampai fitur binding telegram di-wire beneran.
      chatBound: (q as { chatBound?: boolean }).chatBound === true,
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

    /* 2) KIRIM ke Telegram Bot API
       Tujuan (Task 37): body.chatId (override manual) > profiles.telegram_chat_id
       (halaman /dashboard/settings/telegram) > env TELEGRAM_CHAT_ID (default Bos) */
    const token = envOr('TELEGRAM_BOT_TOKEN')
    let chatId = String(body?.chatId || '').trim()
    if (!chatId) {
      try {
        const supabase = getSupabaseAdmin()
        if (supabase) {
          const { data } = await supabase.from('profiles').select('telegram_chat_id').eq('id', userId).maybeSingle()
          chatId = String(data?.telegram_chat_id || '').trim()
        }
      } catch { /* kolom belum ada / admin null → lanjut ke env */ }
    }
    if (!chatId) chatId = envOr('TELEGRAM_CHAT_ID')
    if (!token || !chatId) {
      return NextResponse.json(
        { error: 'Chat ID Telegram belum terpasang — atur di /dashboard/settings/telegram (atau set env TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID untuk default semua user)' },
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
