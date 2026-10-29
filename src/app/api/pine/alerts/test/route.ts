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
import { sendTelegramToUserVerbose } from '@/lib/pine-protected'
import { ensureDefaultScript, DEFAULT_PINE_SOURCE } from '@/lib/pine-default-script'
import { DEFAULT_PINE_SLUG, DEFAULT_PINE_NAME } from '@/lib/pine-default-meta'

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

    /* 2) BODY — scriptId boleh UUID skrip ATAU slug default
       "impulsive-breakout-xauusd" (fix: chip default dengan id slug
       sebelumnya ditolak 400 → tes alert Pine tidak pernah sampai
       Telegram bila daftar skrip dari DB gagal). */
    const body = await request.json().catch(() => null) as
      { scriptId?: string; symbol?: string; timeframe?: string; interval?: string } | null
    const scriptIdRaw = String(body?.scriptId || '').trim()
    const isDefaultSlug = scriptIdRaw === DEFAULT_PINE_SLUG
    if (!UUID_RE.test(scriptIdRaw) && !isDefaultSlug) return NextResponse.json({ error: 'scriptId tidak valid' }, { status: 400 })
    const symbol = sanitizeSymbol(String(body?.symbol || ''))
    if (symbol.length < 3) return NextResponse.json({ error: 'Simbol tidak valid — contoh: XAUUSD, BTCUSDT, US100' }, { status: 400 })
    const interval = normalizePineInterval(String(body?.timeframe || body?.interval || '1h'))

    /* 3) MUAT SKRIP (service role — source tetap di server)
       Slug default → ensureDefaultScript() (auto-seed, dapat UUID);
       bila Supabase sedang tidak terjangkau, pakai baris sintetis
       dari kode — replika TS default TIDAK butuh DB untuk jalan. */
    const supabase = getSupabaseAdmin()
    if (!supabase) return NextResponse.json({ error: 'Server belum terhubung Supabase (service role)' }, { status: 500 })
    let script: RunnerScript | null = null
    if (isDefaultSlug) {
      const seeded = await ensureDefaultScript().catch(() => null)
      if (seeded?.id) {
        const { data } = await supabase
          .from('protected_scripts')
          .select('id, slug, name, source, alert_rules')
          .eq('id', seeded.id)
          .eq('is_active', true)
          .maybeSingle()
        if (data) script = data as RunnerScript
      }
      if (!script) {
        script = {
          id: DEFAULT_PINE_SLUG, slug: DEFAULT_PINE_SLUG, name: DEFAULT_PINE_NAME,
          source: DEFAULT_PINE_SOURCE, alert_rules: [],
        }
      }
    } else {
      const { data, error: sErr } = await supabase
        .from('protected_scripts')
        .select('id, slug, name, source, alert_rules')
        .eq('id', scriptIdRaw)
        .eq('is_active', true)
        .maybeSingle()
      if (sErr || !data) return NextResponse.json({ error: 'Skrip terproteksi tidak ditemukan / tidak aktif' }, { status: 404 })
      script = data as RunnerScript
    }

    /* 4) TELEGRAM USER — bila belum terhubung, evaluasi tetap jalan
       (hasil pemicu dilaporkan ke UI, tanpa kirim/log).
       FIX "tes tele pine ga berfungsi" (Bos): dulu test HANYA pakai
       profiles.telegram_chat_id — profile kosong = DIAM TOTAL walau
       tes ke /api/send-alert normal (itu punya fallback env).
       Sekarang: pesan TES boleh pakai chat default server (env
       TELEGRAM_CHAT_ID — sama seperti send-alert); ALERT OTOMATIS
       tetap WAJIB telegram pribadi terhubung. */
    const { data: prof } = await supabase
      .from('profiles').select('telegram_chat_id').eq('id', userId).maybeSingle()
    const profileChat = String((prof as any)?.telegram_chat_id || '').trim()
    const envChat = String(process.env.TELEGRAM_CHAT_ID || '').trim()
    const chatId = profileChat || envChat
    const telegramBound = !!profileChat
    const testViaDefault = !profileChat && !!envChat

    /* 5) RUN — send/writeLog hanya bila Telegram terhubung */
    const out = await runAlertGroup(
      script as RunnerScript, symbol, interval,
      [{ userId, chatId: chatId || '0' }],
      { send: telegramBound, writeLog: telegramBound },
    )

    /* 5b) JUJUR — kegagalan pipeline TIDAK dibungkus "berjalan normal".
       Dulu: run gagal (candle kosong / engine error) tetap 200 ok → UI
       menampilkan "✅ Berjalan normal — belum ada sinyal" padahal
       TIDAK ADA pengecekan yang jalan (keluhan Bos: tes tele tidak
       muncul apa-apa). Sekarang: error = HTTP 502 + alasan jelas. */
    if (!out.ok) {
      return NextResponse.json({
        ok: false,
        error: out.error || 'Evaluasi alert gagal',
        telegramBound,
        candleSource: out.candleSource,
        evaluatedAt: new Date().toISOString(),
      }, { status: 502 })
    }

    /* 6) JAMINAN TES (fix: "tes alert pine ga ada notif") —
       Evaluasi bar terakhir hampir selalu TANPA sinyal (entry hanya
       sesekali), jadi tombol Tes dulu sering diam total. Sekarang:
       bila TIDAK ADA pesan yang terkirim dari langkah 5, kirim pesan
       TES eksplisit 🧪 — pipeline Pine→Telegram terbukti langsung.
       Pesan tes TIDAK masuk dedupe/log (bukan sinyal — cron 5 menit
       tidak akan terganggu).
       JUJUR (fix kedua): dulu kirim tes GAGAL = respons tetap "berjalan
       normal" — Bos tidak tahu pipeline-nya mati. Sekarang alasan
       penolakan Telegram (Unauthorized / chat not found / dst.)
       diteruskan apa adanya sebagai HTTP 502. */
    let testMessage = false
    if ((telegramBound || testViaDefault) && out.ok && out.sent === 0) {
      const nTrig = out.triggers.length
      const note = nTrig > 0
        ? `ada ${nTrig} sinyal di bar ini tapi sudah pernah dikirim (dedupe anti-spam per-bar)`
        : 'belum ada sinyal di bar terakhir — alert tetap berjalan otomatis 24 jam (GHA tiap 5 menit + cron CF tiap 15 menit)'
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
      const tg = await sendTelegramToUserVerbose(chatId, html)
      if (tg.ok) { out.sent = 1; testMessage = true }
      else {
        return NextResponse.json({
          ok: false,
          error: `Telegram menolak pesan tes: ${tg.description || 'alasan tidak diketahui'}${testViaDefault ? ' (dikirim ke chat default server — Telegram pribadi belum terhubung)' : ''}`,
          telegramBound,
          testViaDefault,
          triggers: [],
          sent: 0,
          candleSource: out.candleSource,
          evaluatedAt: new Date().toISOString(),
        }, { status: 502 })
      }
    }

    return NextResponse.json({
      ok: out.ok,
      error: out.error,
      triggers: out.triggers.map((t) => ({ signal: t.signal, price: t.price, time: t.time, message: t.message })),
      sent: out.sent,
      testMessage,
      testViaDefault,
      telegramBound,
      perUser: out.perUser,
      candleSource: out.candleSource,
      evaluatedAt: new Date().toISOString(),
    })
  } catch (x: any) {
    console.error('[pine-alerts-test] unhandled:', x)
    return NextResponse.json({ error: String(x?.message || x).slice(0, 140) }, { status: 500 })
  }
}
