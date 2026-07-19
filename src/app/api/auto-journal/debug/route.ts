import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { isUserPro } from '@/lib/pro-check'
import { db } from '@/lib/db'

/**
 * GET /api/auto-journal/debug
 *
 * Diagnostic endpoint — traces every step of the auto-journal pipeline
 * so you can see EXACTLY where it fails.
 *
 * Query params:
 *   ?withAI=true   → also test the AI call (takes ~10-20s)
 */
export async function GET(request: NextRequest) {
  const steps: { step: string; status: 'ok' | 'fail' | 'skip'; detail: string; ms?: number }[] = []
  const t = (label: string) => {
    const start = performance.now()
    return {
      ok(detail: string) {
        steps.push({ step: label, status: 'ok', detail, ms: Math.round(performance.now() - start) })
      },
      fail(detail: string) {
        steps.push({ step: label, status: 'fail', detail, ms: Math.round(performance.now() - start) })
      },
      skip(detail: string) {
        steps.push({ step: label, status: 'skip', detail })
      },
    }
  }

  // ── 1. Auth check ──
  const s1 = t('1_auth')
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      s1.fail('No authenticated user found. Cookie/Bearer token missing or expired.')
      return NextResponse.json({
        ok: false,
        blockedAt: 'auth',
        steps,
        hint: 'Pastikan kamu sudah login. Coba logout lalu login ulang.',
      }, { status: 401 })
    }
    s1.ok(`User authenticated: ${authUser.id} (${authUser.email})`)
  } catch (err: any) {
    s1.fail(`Auth error: ${err.message}`)
    return NextResponse.json({ ok: false, blockedAt: 'auth', steps }, { status: 500 })
  }

  // Re-fetch user for remaining checks
  const authUser = (await getAuthUser(request))!

  // ── 2. PRO check ──
  const s2 = t('2_pro_check')
  try {
    const pro = await isUserPro(authUser.id)
    if (!pro) {
      s2.fail(`User is NOT PRO. Auto-journal requires PRO subscription.`)
      return NextResponse.json({
        ok: false,
        blockedAt: 'pro_check',
        steps,
        hint: 'Auto-journal adalah fitur PRO. Gunakan kode promo atau upgrade.',
      }, { status: 403 })
    }
    s2.ok('User is PRO ✅')
  } catch (err: any) {
    s2.fail(`PRO check error: ${err.message}`)
    return NextResponse.json({
      ok: false,
      blockedAt: 'pro_check',
      steps,
      hint: 'Gagal mengecek status PRO. Kemungkinan koneksi database bermasalah.',
    }, { status: 500 })
  }

  // ── 3. Database connectivity ──
  const s3 = t('3_db_connect')
  try {
    const userCount = await db.profile.count()
    const tradeCount = await db.trade.count()
    s3.ok(`DB connected. Profiles: ${userCount}, Trades: ${tradeCount}`)
  } catch (err: any) {
    s3.fail(`DB error: ${err.message}`)
    return NextResponse.json({
      ok: false,
      blockedAt: 'database',
      steps,
      hint: 'Database tidak bisa diakses. Cek DATABASE_URL di .env.local',
    }, { status: 500 })
  }

  // ── 4. User profile in DB ──
  const s4 = t('4_user_profile')
  try {
    const profile = await db.profile.findUnique({
      where: { id: authUser.id },
      select: { id: true, email: true, plan: true, role: true }
    })
    if (!profile) {
      s4.fail(`No profile record in DB for user ${authUser.id}`)
    } else {
      s4.ok(`Profile found: plan=${profile.plan}, role=${profile.role}`)
    }
  } catch (err: any) {
    s4.fail(`Profile query error: ${err.message}`)
  }

  // ── 5. Check user's existing trades ──
  const s5 = t('5_user_trades')
  try {
    const tradeCount = await db.trade.count({ where: { user_id: authUser.id } })
    s5.ok(`User has ${tradeCount} trade(s) in DB`)
  } catch (err: any) {
    s5.fail(`Trade count error: ${err.message}`)
  }

  // ── 6. AI API keys ──
  const s6 = t('6_ai_keys')
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY
  const openrouterKey = process.env.OPENROUTER_API_KEY
  const keyStatus: string[] = []
  keyStatus.push(`GEMINI_API_KEY: ${geminiKey ? 'SET (' + geminiKey.slice(0, 8) + '...)' : 'NOT SET ❌'}`)
  keyStatus.push(`OPENROUTER_API_KEY: ${openrouterKey ? 'SET (' + openrouterKey.slice(0, 8) + '...)' : 'NOT SET ❌'}`)
  if (geminiKey || openrouterKey) {
    s6.ok(keyStatus.join(' | '))
  } else {
    s6.fail('No AI API keys configured at all!')
  }

  // ── 7. AI test call (optional, slow) ──
  const withAI = request.nextUrl.searchParams.get('withAI') === 'true'
  if (withAI) {
    const s7 = t('7_ai_test_call')
    try {
      const { analyzeImageBase64WithAiml } = await import('@/lib/aiml-vision')

      // Create a tiny 1x1 white pixel JPEG as test image
      const testBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////w8ALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='

      const result = await analyzeImageBase64WithAiml(
        testBase64,
        'Reply with just the word "ok"',
        { timeout: 15000, maxRetries: 1 }
      )
      s7.ok(`AI responded via ${result.provider}: "${result.text.slice(0, 100)}"`)
    } catch (err: any) {
      s7.fail(`AI test failed: ${err.message}`)
    }
  } else {
    steps.push({
      step: '7_ai_test_call',
      status: 'skip',
      detail: 'Skipped. Add ?withAI=true to test AI connectivity (takes 10-20s).'
    })
  }

  // ── 8. Trade model check ──
  const s8 = t('8_trade_model')
  try {
    // Try a dry run: create and immediately delete a minimal trade
    const testTrade = await db.trade.create({
      data: {
        user_id: authUser.id,
        symbol: '__DEBUG__',
        type: 'BUY',
        open_price: 0,
        close_price: 0,
        profit_loss: 0,
        open_time: new Date(),
        close_time: new Date(),
        notes: 'Debug trade - will be deleted',
      }
    })
    await db.trade.delete({ where: { id: testTrade.id } })
    s8.ok('Trade CRUD works (created + deleted test trade)')
  } catch (err: any) {
    s8.fail(`Trade CRUD error: ${err.message}`)
  }

  // ── 9. Journal model check ──
  const s9 = t('9_journal_model')
  try {
    const testJournal = await db.journalEntry.create({
      data: {
        user_id: authUser.id,
        title: '__DEBUG__',
        content: 'Debug journal - will be deleted',
        mood: 'neutral',
        market_condition: 'ranging',
        tags: 'debug',
      }
    })
    await db.journalEntry.delete({ where: { id: testJournal.id } })
    s9.ok('Journal CRUD works (created + deleted test journal)')
  } catch (err: any) {
    s9.fail(`Journal CRUD error: ${err.message}`)
  }

  // ── Summary ──
  const allOk = steps.every(s => s.status === 'ok' || s.status === 'skip')

  return NextResponse.json({
    ok: allOk,
    blockedAt: allOk ? null : steps.find(s => s.status === 'fail')?.step,
    steps,
    environment: {
      NODE_ENV: process.env.NODE_ENV || 'unknown',
      DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET ❌',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET ❌',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET ❌',
      GEMINI_API_KEY: geminiKey ? 'SET' : 'NOT SET',
      OPENROUTER_API_KEY: openrouterKey ? 'SET' : 'NOT SET',
    },
    totalMs: 0,
  })
}