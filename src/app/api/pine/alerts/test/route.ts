/**
 * ============================================================
 * POST /api/pine/alerts/test — Evaluasi langsung 1× (Task 44)
 * ============================================================
 * Tombol "Aktifkan Alert" di UI memanggil ini SETELAH upsert
 * langganan — supaya user langsung tahu hasilnya:
 *   - 🚀 sinyal ditemukan & terkirim ke Telegram, ATAU
 *   - ✅ berjalan normal, belum ada sinyal di bar terakhir, ATAU
 *   - ⚠️ Telegram belum terhubung.
 *
 * Body { scriptId, symbol, timeframe }
 *   → jalankan grup utk USER INI saja (tanpa menyentuh langganan
 *     lain). Kirim + log HANYA bila chat_id Telegram tersambung —
 *     kalau belum, cukup evaluasi & laporkan pemicu.
 *
 * Gate Pro sama dengan /api/pine/alerts (fitur otomatisasi).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { readIsPro } from '@/lib/user-quota'
import { runAlertGroup, sanitizeSymbol, normalizePineInterval, type RunnerScript } from '@/lib/pine-alert-runner'
import { sendTelegramToUser } from '@/lib/pine-protected'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  try {
    /* 1) AUTH + GATE PRO */
    const auth = await getAuthenticatedUser(request)
    if (!auth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = auth.user.id
    const isPro = await readIsPro(userId)
    if (!isPro) {
      return NextResponse.json({
        error: 'Test alert otomatis khusus member Pro. Upgrade untuk mengaktifkan alert Entry/SL/TP 24 jam ke Telegram.',
        upgrade: true,
      }, { status: 403 })
    }

    /* 2) BODY */
    const body = await request.json().catch(() => null) as
      { scriptId?: string; symbol?: string; timeframe?: string; interval?: string } | null
    const scriptId = String(body?.scriptId || '').trim()
    if (!UUID_RE.test(scriptId)) return NextResponse.json({ error: 'scriptId tidak valid' }, { status: 400 })
    const symbol = sanitizeSymbol(String(body?.symbol || ''))
    if (symbol.length < 3) return NextResponse.json({ error: 'Simbol tidak valid — contoh: XAUUSD, BTCUSDT, US100' }, { status: 400 })
    const interval = normalizePineInterval(String(body?.timeframe || body?.interval || '1h'))

    /* 3) MUAT SKRIP (service role — source tetap di server) */
    const supabase = getSupabaseAdmin()
    if (!supabase) return NextResponse.json({ error: 'Server belum terhubung Supabase (service role)' }, { status: 500 })
    const { data: script, error: sErr } = await supabase
      .from('protected_scripts')
      .select('id, name, source, alert_rules')
      .eq('id', scriptId)
      .eq('is_active', true)
      .maybeSingle()
    if (sErr || !script) return NextResponse.json({ error: 'Skrip terproteksi tidak ditemukan / tidak aktif' }, { status: 404 })

    /* 4) TELEGRAM USER — bila belum terhubung, evaluasi tetap jalan
       (hasil pemicu dilaporkan ke UI, tanpa kirim/log) */
    const { data: prof } = await supabase
      .from('profiles').select('telegram_chat_id').eq('id', userId).maybeSingle()
    const chatId = String((prof as any)?.telegram_chat_id || '').trim()
    const telegramBound = !!chatId

    /* 5) RUN — send/writeLog hanya bila Telegram terhubung */
    const out = await runAlertGroup(
      script as RunnerScript, symbol, interval,
      [{ userId, chatId: chatId || '0' }],
      { send: telegramBound, writeLog: telegramBound },
    )

    /* 6) JAMINAN TES (fix: "tes alert pine ga ada notif") —
       Evaluasi bar terakhir hampir selalu TANPA sinyal (entry hanya
       sesekali), jadi tombol Tes dulu sering diam total. Sekarang:
       bila TIDAK ADA pesan yang terkirim dari langkah 5, kirim pesan
       TES eksplisit 🧪 — pipeline Pine→Telegram terbukti langsung.
       Pesan tes TIDAK masuk dedupe/log (bukan sinyal — cron 5 menit
       tidak akan terganggu). */
    let testMessage = false
    if (telegramBound && out.ok && out.sent === 0) {
      const nTrig = out.triggers.length
      const note = nTrig > 0
        ? `ada ${nTrig} sinyal di bar ini tapi sudah pernah dikirim (dedupe anti-spam per-bar)`
        : 'belum ada sinyal di bar terakhir — alert tetap berjalan otomatis tiap 5 menit, 24 jam'
      const html = [
        `🧪 <b>TES ALERT LUXTRADEE — BERHASIL</b>`,
        ``,
        `📐 Script: <b>${script.name}</b>`,
        `💱 Pair: <b>${symbol}</b> (${interval})`,
        `📡 Sumber candle: ${out.candleSource || 'server'}`,
        `ℹ️ ${note}.`,
        ``,
        `<i>Pesan ini adalah tes pipeline — bukan sinyal trading.</i>`,
      ].join('\n')
      const okTg = await sendTelegramToUser(chatId, html)
      if (okTg) { out.sent = 1; testMessage = true }
    }

    return NextResponse.json({
      ok: out.ok,
      error: out.error,
      triggers: out.triggers.map((t) => ({ signal: t.signal, price: t.price, time: t.time, message: t.message })),
      sent: out.sent,
      testMessage,
      telegramBound,
      candleSource: out.candleSource,
      evaluatedAt: new Date().toISOString(),
    })
  } catch (x: any) {
    console.error('[pine-alerts-test] unhandled:', x)
    return NextResponse.json({ error: String(x?.message || x).slice(0, 140) }, { status: 500 })
  }
}
