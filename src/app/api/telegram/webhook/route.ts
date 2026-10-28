/**
 * ============================================================
 * POST /api/telegram/webhook — Webhook Bot Telegram (Task 37)
 * ============================================================
 * Fitur "Hubungkan Telegram" (deep linking) — user TIDAK perlu
 * mencari Chat ID manual:
 *   1. User klik tombol di /dashboard/settings/telegram
 *      → membuka https://t.me/luxtradeebot?start=<USER_ID>
 *   2. User tekan START di Telegram → Telegram POST update ke
 *      route ini dengan text "/start <USER_ID>"
 *   3. Route ini menyimpan message.chat.id ke kolom
 *      profiles.telegram_chat_id milik USER_ID
 *      → alert dari /api/send-alert otomatis masuk chat user.
 *
 * KEAMANAN (wajib — jangan dilonggarkan):
 *   - Telegram mengirim header `X-Telegram-Bot-Api-Secret-Token`
 *     pada SETIAP request webhook (diset saat setWebhook via
 *     parameter secret_token). Header ini dibandingkan dengan env
 *     TELEGRAM_WEBHOOK_SECRET → 401 bila beda/kosong. Tanpa ini
 *     siapa pun bisa memalsukan update.
 *   - USER_ID divalidasi format UUID (id auth.users Supabase)
 *     SEBELUM menyentuh database; payload aneh dibalas pesan
 *     generik (tidak membocorkan apa pun).
 *   - Tulis DB HANYA lewat service role (getSupabaseAdmin) —
 *     RLS profiles tidak bisa dilewati dari client.
 *   - Bila akun dipindah ke chat Telegram BERBEDA, chat lama
 *     dikirimi notifikasi keamanan (best effort).
 *
 * SETUP SEKALI (di browser Bos):
 *   1. Cloudflare → Secrets: TELEGRAM_BOT_TOKEN (dari @BotFather)
 *      + TELEGRAM_WEBHOOK_SECRET (string acak, `openssl rand -hex 32`).
 *   2. Buka URL (ganti <TOKEN> & <SECRET>):
 *      https://api.telegram.org/bot<TOKEN>/setWebhook
 *        ?url=https://luxtradee.web.id/api/telegram/webhook
 *        &secret_token=<SECRET>
 *      → harus menjawab {"ok":true}.
 *
 * GET / → cek route hidup (untuk browser, bukan webhook Telegram).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

export const dynamic = 'force-dynamic'

/* id auth.users Supabase selalu UUID */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function envOr(name: string): string {
  const v = process.env[name]
  return typeof v === 'string' ? v.trim() : ''
}

/** Balas pesan ke chat Telegram (best effort — tidak pernah throw). */
async function reply(token: string, chatId: number | string, text: string): Promise<void> {
  if (!token || !chatId) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch { /* diam — jangan ganggu alur webhook */ }
}

/* ---------- GET: healthcheck route ---------- */
export async function GET() {
  return NextResponse.json({ ok: true, service: 'telegram-webhook', method: 'POST (Telegram only)' })
}

/* ---------- POST: update dari Telegram ---------- */
export async function POST(request: NextRequest) {
  /* 0) SECRET TOKEN — kunci utama anti-pemalsuan */
  const secret = envOr('TELEGRAM_WEBHOOK_SECRET')
  const got = request.headers.get('x-telegram-bot-api-secret-token') || ''
  if (!secret || got !== secret) {
    console.warn('[tg-webhook] secret token salah/absen — tolak')
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const update = (await request.json().catch(() => null)) as any
  const msg = update?.message
  const text = typeof msg?.text === 'string' ? msg.text.trim() : ''
  const chatId: number | undefined = msg?.chat?.id
  if (!msg || !chatId || !text) {
    /* edited_message / callback_query / channel_post dll. — abaikan tenang */
    return NextResponse.json({ ok: true, handled: false })
  }

  const token = envOr('TELEGRAM_BOT_TOKEN')

  /* 1) Command /start — izinkan bentuk "/start@luxtradeebot <payload>" (grup) */
  const m = text.match(/^\/start(?:@([A-Za-z0-9_]+))?(?:\s+(\S+))?$/i)
  if (!m) {
    await reply(token, chatId,
      '🤖 Bot <b>Luxtradee</b> di sini.\n\nUntuk menerima alert, buka dashboard Luxtradee → <b>Pengaturan → Telegram</b>, lalu tekan tombol <b>"Hubungkan ke Telegram"</b>.')
    return NextResponse.json({ ok: true, handled: false })
  }

  /* 2) Payload = USER_ID dari halaman settings (UUID) */
  const userId = String(m[2] || '')
  if (!UUID_RE.test(userId)) {
    await reply(token, chatId,
      '👋 Selamat datang di <b>Luxtradee</b>!\n\nHubungkan akunmu lewat tombol <b>"Hubungkan ke Telegram"</b> di halaman Pengaturan → Telegram pada dashboard Luxtradee. Jangan kirim ID manual — cukup satu tombol 😉')
    return NextResponse.json({ ok: true, handled: false })
  }

  /* 3) BINDING — simpan chat.id ke profiles.telegram_chat_id (service role) */
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    /* Konfigurasi server belum lengkap → 503 agar Telegram mencoba lagi nanti */
    console.error('[tg-webhook] SUPABASE_SERVICE_ROLE_KEY belum diset')
    return NextResponse.json({ ok: false, error: 'service role belum diset' }, { status: 503 })
  }

  const newChatId = String(chatId)
  const { data: prev, error: readErr } = await supabase
    .from('profiles')
    .select('telegram_chat_id')
    .eq('id', userId)
    .maybeSingle()
  if (readErr) {
    console.error('[tg-webhook] read profiles gagal:', readErr.message)
    return NextResponse.json({ ok: false, error: 'db read gagal' }, { status: 500 })
  }
  if (!prev) {
    /* UUID valid tapi tidak ada profil — balas generik, jangan bocorkan */
    await reply(token, chatId,
      '❌ Link ini tidak dikenal.\n\nBuka dashboard Luxtradee → Pengaturan → Telegram dan gunakan tombol di sana agar terhubung dengan akunmu sendiri.')
    return NextResponse.json({ ok: true, handled: false })
  }

  const oldChat = String((prev as any)?.telegram_chat_id || '').trim()
  const { error: updErr } = await supabase
    .from('profiles')
    .update({ telegram_chat_id: newChatId, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (updErr) {
    const colMissing = updErr.code === 'PGRST204' || /column/i.test(updErr.message || '')
    console.error('[tg-webhook] update profiles gagal:', updErr.message)
    await reply(token, chatId, colMissing
      ? '⚙️ Fitur sedang diaktifkan (migrasi database belum dijalankan) — coba lagi beberapa jam, atau hubungi admin.'
      : '⚠️ Gagal menyimpan koneksi. Coba lagi sebentar.')
    /* Tetap 200 — user sudah diberi tahu; 500 hanya bikin Telegram spam retry */
    return NextResponse.json({ ok: true, handled: false })
  }

  /* 4) Sukses — konfirmasi + notifikasi keamanan ke chat lama bila pindah */
  if (oldChat && oldChat !== newChatId) {
    await reply(token, oldChat,
      '⚠️ <b>Pemberitahuan keamanan</b>\n\nAkun Luxtradee ini sekarang terhubung ke chat Telegram yang lain. Bukan kamu yang melakukannya? Segera ganti password akun Luxtradee-mu.')
  }
  await reply(token, chatId,
    '✅ <b>Telegram berhasil terhubung!</b>\n\nAlert dari chart Luxtradee akan masuk ke chat ini.\n• Paket gratis: 2 alert/hari\n• Pro: tanpa batas\n\nCoba tes sekarang: dashboard → Chart → tombol 🔔 Alert TG.')

  /* Log tanpa data sensitif penuh */
  console.log('[tg-webhook] bound user=', userId.slice(0, 8), '… chat=', newChatId.slice(0, 3), '…')
  return NextResponse.json({ ok: true, handled: true })
}
