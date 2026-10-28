/**
 * ============================================================
 * /api/pine/alerts — Langganan alert otomatis Pine (Task 44)
 * ============================================================
 * UI klik: ikon 🔔 di chip indikator "Eksklusif" → pilih simbol +
 * timeframe → Aktifkan. TANPA SQL/JSON manual.
 *
 * GET     → { isPro, telegramBound, subscriptions: [...] }
 * POST    { scriptId, symbol, timeframe, enabled } → upsert langganan
 *           (toggle on/off = update baris yang sama)
 * DELETE  ?id=... → hapus langganan sendiri
 *
 * Gate: otomatisasi alert = fitur PRO (Free → 403 + upgrade:true).
 * Tabel: pine_alert_subscriptions (docs/PINE_ALERT_SUBSCRIPTIONS.sql)
 * Dedupe sinyal per-bar tetap via pine_alert_log di runner.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { readIsPro } from '@/lib/user-quota'
import { normalizePineInterval, sanitizeSymbol } from '@/lib/pine-alert-runner'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function admin() {
  const supabase = getSupabaseAdmin()
  if (!supabase) throw new Error('SUPABASE_SERVICE_ROLE_KEY belum diset — cek Cloudflare → Variables & Secrets')
  return supabase
}

/* ============================================================
   GET — daftar langganan user + status Telegram + status Pro
   ============================================================ */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = auth.user.id

    const supabase = getSupabaseAdmin()
    if (!supabase) return NextResponse.json({ error: 'Server belum terhubung Supabase (service role)' }, { status: 500 })

    const [subsRes, profRes, isPro] = await Promise.all([
      supabase
        .from('pine_alert_subscriptions')
        .select('id, script_id, symbol, timeframe, enabled, created_at, protected_scripts(name)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('profiles').select('telegram_chat_id').eq('id', userId).maybeSingle(),
      readIsPro(userId),
    ])

    if (subsRes.error) {
      const msg = /pine_alert_subscriptions/i.test(subsRes.error.message)
        ? 'Tabel pine_alert_subscriptions belum ada — jalankan docs/PINE_ALERT_SUBSCRIPTIONS.sql di Supabase SQL Editor'
        : subsRes.error.message.slice(0, 140)
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    const subscriptions = (subsRes.data || []).map((r: any) => ({
      id: r.id,
      scriptId: r.script_id,
      scriptName: r.protected_scripts?.name || 'Script',
      symbol: r.symbol,
      interval: r.timeframe,
      enabled: r.enabled === true,
      createdAt: r.created_at,
    }))

    return NextResponse.json({
      isPro,
      telegramBound: !!String((profRes.data as any)?.telegram_chat_id || '').trim(),
      subscriptions,
    })
  } catch (x: any) {
    return NextResponse.json({ error: String(x?.message || x).slice(0, 160) }, { status: 500 })
  }
}

/* ============================================================
   POST — aktifkan / toggle langganan (upsert)
   ============================================================ */
export async function POST(request: NextRequest) {
  try {
    /* 1) AUTH + GATE PRO (alert otomatis = fitur Pro) */
    const auth = await getAuthenticatedUser(request)
    if (!auth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = auth.user.id
    const isPro = await readIsPro(userId)
    if (!isPro) {
      return NextResponse.json({
        error: 'Alert otomatis 24 jam (Entry/SL/TP langsung ke Telegram tanpa buka chart) khusus member Pro. Upgrade untuk mengaktifkannya!',
        upgrade: true,
      }, { status: 403 })
    }

    /* 2) BODY */
    const body = await request.json().catch(() => null) as
      { scriptId?: string; symbol?: string; timeframe?: string; interval?: string; enabled?: boolean } | null
    const scriptId = String(body?.scriptId || '').trim()
    if (!UUID_RE.test(scriptId)) return NextResponse.json({ error: 'scriptId tidak valid' }, { status: 400 })

    const symbol = sanitizeSymbol(String(body?.symbol || ''))
    if (symbol.length < 3) return NextResponse.json({ error: 'Simbol tidak valid — contoh: XAUUSD, BTCUSDT, US100' }, { status: 400 })

    const timeframe = normalizePineInterval(String(body?.timeframe || body?.interval || '1h'))
    const enabled = body?.enabled !== false // default aktif

    /* 3) SKRIP HARUS ADA & AKTIF (source tak pernah dikirim ke client) */
    const supabase = admin()
    const { data: script, error: sErr } = await supabase
      .from('protected_scripts')
      .select('id, name')
      .eq('id', scriptId)
      .eq('is_active', true)
      .maybeSingle()
    if (sErr || !script) return NextResponse.json({ error: 'Skrip terproteksi tidak ditemukan / tidak aktif' }, { status: 404 })

    /* 4) UPSERT — toggle = update baris yang sama (unique index) */
    const { data, error } = await supabase
      .from('pine_alert_subscriptions')
      .upsert(
        { user_id: userId, script_id: scriptId, symbol, timeframe, enabled, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,script_id,symbol,timeframe' },
      )
      .select('id, symbol, timeframe, enabled')
      .single()
    if (error) {
      const msg = /pine_alert_subscriptions/i.test(error.message)
        ? 'Tabel pine_alert_subscriptions belum ada — jalankan docs/PINE_ALERT_SUBSCRIPTIONS.sql di Supabase SQL Editor'
        : error.message.slice(0, 140)
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      scriptName: script.name,
      subscription: { id: data.id, scriptId, symbol: data.symbol, interval: data.timeframe, enabled: data.enabled },
    })
  } catch (x: any) {
    return NextResponse.json({ error: String(x?.message || x).slice(0, 160) }, { status: 500 })
  }
}

/* ============================================================
   DELETE — hapus langganan sendiri
   ============================================================ */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (!auth?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const id = new URL(request.url).searchParams.get('id') || ''
    if (!UUID_RE.test(id)) return NextResponse.json({ error: 'id wajib (uuid)' }, { status: 400 })
    const { error } = await admin()
      .from('pine_alert_subscriptions')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.user.id)
    if (error) return NextResponse.json({ error: error.message.slice(0, 140) }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (x: any) {
    return NextResponse.json({ error: String(x?.message || x).slice(0, 160) }, { status: 500 })
  }
}
