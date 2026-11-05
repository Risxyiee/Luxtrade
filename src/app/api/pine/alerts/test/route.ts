/**
 * ============================================================
 * POST /api/pine/alerts/test — Evaluasi langsung 1× (Task 44)
 * ============================================================
 * Tombol "Aktifkan Alert" di UI memanggil ini SETELAH upsert
 * langganan — supaya user langsung tahu hasilnya:
 *   - 🚀 sinyal ditemukan & notifikasi terkirim ke layar HP, ATAU
 *   - ✅ berjalan normal, belum ada sinyal di bar terakhir, ATAU
 *   - ⚠️ notifikasi belum diaktifkan di browser/PWA.
 *
 * Body { scriptId, symbol, timeframe }
 *   → jalankan grup utk USER INI saja (tanpa menyentuh langganan
 *     lain). Kirim + log selalu jalan — pesan TES eksplisit 🧪
 *     dikirim via web push bila tidak ada sinyal di bar terakhir.
 *
 * Gate Pro sama dengan /api/pine/alerts (fitur otomatisasi).
 * (Jalur Telegram dihapus — riwayat git.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { readIsPro } from '@/lib/user-quota'
import { runAlertGroup, sanitizeSymbol, normalizePineInterval, type RunnerScript } from '@/lib/pine-alert-runner'
import { pushToUser } from '@/lib/push-notify'
import { rateLimitByUser } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  try {
    /* 1) AUTH + GATE PRO */
    const auth = await getAuthenticatedUser(request)
    if (!auth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = auth.user.id

    // Rate limit: tes alert mengirim push beneran — 5x/5 menit
    const limited = rateLimitByUser('pine-alert-test', userId, { maxRequests: 5, windowMs: 5 * 60_000 })
    if (limited) return limited

    const isPro = await readIsPro(userId)
    if (!isPro) {
      return NextResponse.json({
        error: 'Test alert otomatis khusus member Pro. Upgrade untuk mengaktifkan alert Entry/SL/TP 24 jam langsung ke layar HP (push notification).',
        upgrade: true,
      }, { status: 403 })
    }

    /* 2) BODY — scriptId = UUID. scriptKind memilih sumber skrip:
       'protected' (default) / 'pine' (Pine milik user sendiri).
       FIX 2026-11-05: Pine default dihapus — slug default tidak
       lagi diterima; tiap user pakai Pine buatannya sendiri. */
    const body = await request.json().catch(() => null) as
      { scriptId?: string; scriptKind?: string; symbol?: string; timeframe?: string; interval?: string } | null
    const scriptIdRaw = String(body?.scriptId || '').trim()
    const kind = body?.scriptKind === 'pine' ? 'pine' : 'protected'
    if (!UUID_RE.test(scriptIdRaw)) return NextResponse.json({ error: 'scriptId tidak valid' }, { status: 400 })
    const symbol = sanitizeSymbol(String(body?.symbol || ''))
    if (symbol.length < 3) return NextResponse.json({ error: 'Simbol tidak valid — contoh: XAUUSD, BTCUSDT, US100' }, { status: 400 })
    const interval = normalizePineInterval(String(body?.timeframe || body?.interval || '1h'))

    /* 3) MUAT SKRIP (service role — source tetap di server) */
    const supabase = getSupabaseAdmin()
    if (!supabase) return NextResponse.json({ error: 'Server belum terhubung Supabase (service role)' }, { status: 500 })
    let script: RunnerScript | null = null
    if (kind === 'pine') {
      const { data, error: pErr } = await supabase
        .from('pine_scripts')
        .select('id, name, source')
        .eq('id', scriptIdRaw)
        .eq('user_id', userId)
        .maybeSingle()
      if (pErr || !data) return NextResponse.json({ error: 'Skrip Pine tidak ditemukan / bukan milikmu' }, { status: 404 })
      script = { id: data.id, name: data.name, source: data.source, alert_rules: null }
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

    /* 4) RUN — send/writeLog selalu jalan (push layar HP) */
    const out = await runAlertGroup(
      script as RunnerScript, symbol, interval,
      [{ userId }],
      { send: true, writeLog: true },
    )

    /* 5b) JUJUR — kegagalan pipeline TIDAK dibungkus "berjalan normal".
       Dulu: run gagal (candle kosong / engine error) tetap 200 ok → UI
       menampilkan "✅ Berjalan normal — belum ada sinyal" padahal
       TIDAK ADA pengecekan yang jalan (keluhan Bos: tes tidak
       muncul apa-apa). Sekarang: error = HTTP 502 + alasan jelas. */
    if (!out.ok) {
      return NextResponse.json({
        ok: false,
        error: out.error || 'Evaluasi alert gagal',
        candleSource: out.candleSource,
        evaluatedAt: new Date().toISOString(),
      }, { status: 502 })
    }

    /* 6) JAMINAN TES (fix: "tes alert pine ga ada notif") —
       Evaluasi bar terakhir hampir selalu TANPA sinyal (entry hanya
       sesekali), jadi tombol Tes dulu sering diam total. Sekarang:
       bila TIDAK ADA pesan yang terkirim dari langkah 4, kirim notif
       TES eksplisit 🧪 via WEB PUSH — pipeline Pine→HP terbukti
       langsung. Pesan tes TIDAK masuk dedupe/log (bukan sinyal —
       cron 5 menit tidak akan terganggu).
       JUJUR: push gagal/belum diaktifkan dilaporkan apa adanya. */
    let testMessage = false
    if (out.ok && out.sent === 0) {
      const nTrig = out.triggers.length
      const note = nTrig > 0
        ? `ada ${nTrig} sinyal di bar ini tapi sudah pernah dikirim (dedupe anti-spam per-bar)`
        : 'belum ada sinyal di bar terakhir — alert tetap berjalan otomatis 24 jam (GHA tiap 5 menit + cron CF tiap 15 menit)'
      const push = await pushToUser(supabase, userId, {
        title: '🧪 Tes Alert LuxTradee — Berhasil',
        body: `📐 ${script.name} · ${symbol} (${interval}) · ${out.candleSource || 'server'}. ${note}.`,
        tag: 'pine-test-alert',
        type: 'trade',
        url: '/dashboard',
        urgency: 'high',
      }, { dedupe: false })
      if (push.sent > 0) { out.sent = 1; testMessage = true }
      else if (push.skipped === 'no-subs') {
        return NextResponse.json({
          ok: false,
          error: 'Notifikasi belum terpasang — izinkan push di browser/PWA (ikon 🔔 di address bar) agar sinyal masuk ke layar HP (gaya WA). Setelah itu tes lagi.',
          triggers: [],
          sent: 0,
          pushSkipped: 'no-subs',
          candleSource: out.candleSource,
          evaluatedAt: new Date().toISOString(),
        }, { status: 502 })
      } else {
        return NextResponse.json({
          ok: false,
          error: `Notifikasi tes gagal terkirim: ${push.error || 'alasan tidak diketahui'} — alert kamu tetap terdaftar & aktif.`,
          triggers: [],
          sent: 0,
          pushError: push.error || null,
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
      perUser: out.perUser,
      candleSource: out.candleSource,
      evaluatedAt: new Date().toISOString(),
    })
  } catch (x: any) {
    console.error('[pine-alerts-test] unhandled:', x)
    return NextResponse.json({ error: String(x?.message || x).slice(0, 140) }, { status: 500 })
  }
}
