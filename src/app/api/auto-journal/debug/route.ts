export const runtime = 'edge'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { isUserPro } from '@/lib/pro-check'
import { db } from '@/lib/db'

/**
 * GET /api/auto-journal/debug
 *
 * Diagnostic endpoint — check every step of the auto-journal pipeline.
 * Buka di browser setelah login, atau tambahkan ?withAI=true untuk test AI.
 *
 * Tidak perlu upload gambar. Cek aja response JSON-nya — lihat step mana yang FAIL.
 */
export async function GET(request: NextRequest) {
  const results: { step: string; status: 'ok' | 'fail' | 'skip'; detail: string; ms?: number }[] = []

  const check = async (step: string, fn: () => Promise<string>) => {
    const start = performance.now()
    try {
      const detail = await fn()
      results.push({ step, status: 'ok', detail, ms: Math.round(performance.now() - start) })
      return true
    } catch (err: any) {
      results.push({ step, status: 'fail', detail: err.message, ms: Math.round(performance.now() - start) })
      return false
    }
  }

  // ── 1. Auth ──
  let authUser: { id: string; email: string } | null = null
  const authOk = await check('1_auth', async () => {
    authUser = await getAuthUser(request)
    if (!authUser) throw new Error('Tidak ada session login. Cookie/Bearer token expired atau tidak ada.')
    return `Login OK: ${authUser.email}`
  })
  if (!authOk) {
    return NextResponse.json({
      ok: false,
      blockedAt: 'auth',
      results,
      fix: 'Logout lalu login ulang. Pastikan cookies tidak di-block.',
    }, { status: 401 })
  }

  // ── 2. PRO check ──
  const proOk = await check('2_pro_check', async () => {
    const pro = await isUserPro(authUser!.id)
    if (!pro) throw new Error('User BUKAN PRO. isUserPro() returned false. Auto-journal butuh PRO.')
    return 'User is PRO'
  })
  if (!proOk) {
    return NextResponse.json({
      ok: false,
      blockedAt: 'pro_check',
      results,
      fix: 'Gunakan kode promo untuk upgrade ke PRO, atau cek apakah subscription sudah expired.',
    }, { status: 403 })
  }

  // ── 3. Database (Prisma/PostgreSQL) ──
  const dbOk = await check('3_database', async () => {
    const count = await db.profile.count()
    return `DB connected. Total profiles: ${count}`
  })
  if (!dbOk) {
    return NextResponse.json({
      ok: false,
      blockedAt: 'database',
      results,
      fix: 'DATABASE_URL mungkin salah atau DB down.',
    }, { status: 500 })
  }

  // ── 4. User profile in trade DB ──
  await check('4_profile_in_db', async () => {
    const profile = await db.profile.findUnique({
      where: { id: authUser!.id },
      select: { id: true, plan: true, role: true }
    })
    if (!profile) throw new Error(`Profile tidak ada di trade DB untuk user ${authUser!.id}`)
    return `plan=${profile.plan}, role=${profile.role}`
  })

  // ── 5. AI API keys ──
  await check('5_ai_keys', async () => {
    const gemini = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY
    const openrouter = process.env.OPENROUTER_API_KEY
    if (!gemini && !openrouter) throw new Error('GEMINI_API_KEY dan OPENROUTER_API_KEY keduanya TIDAK ADA di environment.')
    const parts: string[] = []
    if (gemini) parts.push(`GEMINI=${gemini.slice(0, 8)}...`)
    if (openrouter) parts.push(`OPENROUTER=${openrouter.slice(0, 8)}...`)
    return parts.join(' | ')
  })

  // ── 6. AI test call (optional) ──
  const withAI = request.nextUrl.searchParams.get('withAI') === 'true'
  if (withAI) {
    await check('6_ai_test_call', async () => {
      const { analyzeImageBase64WithAiml } = await import('@/lib/aiml-vision')
      // Tiny 1x1 white JPEG
      const testB64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAIBAQIBAQICAgICAgICAwUDAwMDAwYEBAMFBwYHBwcGBwcICQsJCAgKCAcHCg0KCgsMDAwMBAYODw0ODg4NDAwMDAwMD/2wBDAQICAgMDAwYEBAYGBgYHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc/3QAEAAj/2gAMAwEAAhEDEQA/APf6KKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD//Z'
      const result = await analyzeImageBase64WithAiml(testB64, 'Reply OK', { timeout: 15000, maxRetries: 1 })
      return `AI works via ${result.provider}: "${result.text.slice(0, 80)}"`
    })
  } else {
    results.push({
      step: '6_ai_test_call',
      status: 'skip',
      detail: 'Tambahkan ?withAI=true di URL untuk test AI (butuh 10-20 detik).',
    })
  }

  // ── 7. Trade CRUD test ──
  await check('7_trade_crud', async () => {
    const t = await db.trade.create({
      data: {
        user_id: authUser!.id,
        symbol: '__TEST__',
        type: 'BUY',
        open_price: 0,
        close_price: 0,
        profit_loss: 0,
        lot_size: 0,
        open_time: new Date(),
        close_time: new Date(),
      }
    })
    await db.trade.delete({ where: { id: t.id } })
    return 'Trade create + delete OK'
  })

  // ── 8. Journal CRUD test ──
  await check('8_journal_crud', async () => {
    const j = await db.journalEntry.create({
      data: {
        user_id: authUser!.id,
        title: '__TEST__',
        content: 'test',
        mood: 'neutral',
        market_condition: 'ranging',
        tags: 'test',
      }
    })
    await db.journalEntry.delete({ where: { id: j.id } })
    return 'Journal create + delete OK'
  })

  const allOk = results.every(r => r.status === 'ok' || r.status === 'skip')

  return NextResponse.json({
    ok: allOk,
    blockedAt: allOk ? null : results.find(r => r.status === 'fail')?.step,
    results,
  })
}