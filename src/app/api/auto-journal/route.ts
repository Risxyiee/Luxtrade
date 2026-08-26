import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { createClientForApi } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { isUserPro } from '@/lib/pro-check'
import { uploadScreenshot } from '@/lib/extractTradeData'
import { checkAchievementsAfterTrade } from '@/lib/achievement-checker'
import {
  analyzeImageBase64WithAiml,
  buildTradeAndJournalPrompt,
} from '@/lib/aiml-vision'
import { randomUUID } from 'crypto'

// ==================== AUTH HELPER ====================

function getClientWithAuth(request: NextRequest) {
  const { supabase: cookieClient } = createClientForApi(request)
  const authHeader = request.headers.get('Authorization')
  let bearerClient: ReturnType<typeof createClient> | null = null
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    bearerClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    ;(bearerClient as any)._bearerToken = token
  }
  return { cookieClient, bearerClient }
}

async function getUserWithSession(request: NextRequest) {
  const { cookieClient, bearerClient } = getClientWithAuth(request)
  let { data: { user }, error } = await cookieClient.auth.getUser()
  if (user) return { user, client: cookieClient }
  if (bearerClient) {
    const token = (bearerClient as any)._bearerToken
    const result = await bearerClient.auth.getUser(token)
    if (result.data.user) return { user: result.data.user, client: bearerClient }
  }
  return { user: null, client: cookieClient }
}

// ==================== TYPES ====================

interface GeneratedJournal {
  title: string
  content: string
  mood: string
  market_condition: string
  tags: string[]
  setup_type: string
  risk_reward_ratio?: number
}

/** Combined AI response — trade data + journal in one object */
interface CombinedAIResponse {
  symbol?: string
  type?: string
  openPrice?: number
  closePrice?: number
  profitLoss?: number
  openTime?: string
  closeTime?: string
  stopLoss?: number | null
  takeProfit?: number | null
  volume?: number | null
  ticketNumber?: string | null
  journalTitle?: string
  journalContent?: string
  mood?: string
  marketCondition?: string
  tags?: string
  setupType?: string
}

// ==================== IMAGE OPTIMIZATION (no sharp) ====================

/**
 * Convert image to JPEG and resize using Canvas API (built-in, no native deps).
 * Falls back to raw base64 if canvas is unavailable.
 */
async function optimizeImage(buffer: Buffer): Promise<{ optimizedBase64: string; optimizedBuffer: Buffer }> {
  // canvas package not available in serverless/edge — return raw base64 directly
  return {
    optimizedBase64: buffer.toString('base64'),
    optimizedBuffer: buffer,
  }
}

// ==================== MAIN API ====================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const t0 = performance.now()

  const log = (emoji: string, msg: string) => {
    const elapsed = ((performance.now() - t0) / 1000).toFixed(1)
    console.log(`${emoji} [AutoJournal ${elapsed}s] ${msg}`)
  }

  try {
    log('🚀', 'POST /api/auto-journal — request received')

    // ── STEP 1: Auth ──
    log('🔐', 'Checking authentication...')
    const { user, client } = await getUserWithSession(request)
    if (!user) {
      log('⛔', 'AUTH FAILED')
      return NextResponse.json(
        { error: 'Unauthorized', detail: 'Tidak ada session login. Coba logout lalu login ulang.', step: 'auth' },
        { status: 401 }
      )
    }
    log('✅', `Auth OK: userId=${user.id}, email=${user.email}`)

    // ── STEP 2: PRO check ──
    log('💎', 'Checking PRO status...')
    let pro: boolean
    try {
      pro = await isUserPro(user.id)
    } catch (err: any) {
      log('⛔', `PRO CHECK CRASHED: ${err.message}`)
      return NextResponse.json(
        { error: 'PRO check gagal', detail: err.message, step: 'pro_check' },
        { status: 500 }
      )
    }

    if (!pro) {
      log('⛔', `User is NOT PRO`)
      return NextResponse.json(
        {
          error: 'Auto-Journal adalah fitur PRO. Upgrade ke PRO untuk menggunakan AI auto-journal!',
          code: 'PRO_REQUIRED',
          requiresUpgrade: true,
          step: 'pro_check',
        },
        { status: 403 }
      )
    }
    log('✅', 'User is PRO')

    // ── STEP 3: Parse form data ──
    log('📂', 'Parsing form data...')
    let formData: FormData
    try {
      formData = await request.formData()
    } catch (err: any) {
      log('⛔', `FormData parse error: ${err.message}`)
      return NextResponse.json(
        { error: 'Gagal membaca file upload', detail: err.message, step: 'form_parse' },
        { status: 400 }
      )
    }

    const imageFile = formData.get('image') as File
    if (!imageFile) {
      log('⛔', 'No image file in FormData')
      return NextResponse.json(
        { error: 'File gambar tidak ditemukan. Pastikan field upload bernama "image".', step: 'form_parse' },
        { status: 400 }
      )
    }
    log('📷', `Image received: ${imageFile.name}, ${imageFile.size} bytes, type=${imageFile.type || 'unknown'}`)

    // ── STEP 3b: Extract & validate account_id ──
    const accountId = formData.get('account_id') as string | null
    if (!accountId) {
      log('⛔', 'No account_id provided')
      return NextResponse.json(
        { error: 'Pilih akun trading terlebih dahulu sebelum auto-journal.', step: 'validation' },
        { status: 400 }
      )
    }
    log('✅', `account_id: ${accountId}`)

    // ── STEP 3c: Extract language preference ──
    const rawLang = (formData.get('language') as string | null)?.toLowerCase()
    const lang: 'id' | 'en' = rawLang === 'en' ? 'en' : 'id'
    log('🌐', `Journal language: ${lang}`)

    // ── STEP 4: HEIC check ──
    const fileName = imageFile.name.toLowerCase()
    const fileType = (imageFile.type || '').toLowerCase()
    const isHeic = fileName.endsWith('.heic') || fileName.endsWith('.heif')
      || fileType === 'image/heic' || fileType === 'image/heif'
      || fileType.includes('heic') || fileType.includes('heif')
    if (isHeic) {
      log('⛔', 'HEIC format detected — rejected')
      return NextResponse.json({
        error: 'Format HEIC/HEIF belum didukung. Silakan screenshot ulang atau export foto sebagai JPEG/PNG sebelum upload.',
        code: 'HEIC_NOT_SUPPORTED',
        step: 'heic_check',
      }, { status: 400 })
    }

    // ── STEP 5: Image optimization (NO sharp — uses canvas or raw fallback) ──
    log('🔧', 'Optimizing image...')
    const t1 = performance.now()
    const bytes = await imageFile.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const { optimizedBase64: base64Image, optimizedBuffer } = await optimizeImage(buffer)
    log('✅', `Image optimized in ${(performance.now() - t1).toFixed(0)}ms, base64=${base64Image.length} chars`)

    // ── STEP 6: Fetch trading account for broker_gmt_offset ──
    log('🌐', 'Fetching trading account for broker_gmt_offset...')
    const { data: tradingAccount } = await client
      .from('trading_accounts')
      .select('broker_gmt_offset')
      .eq('id', accountId)
      .single()
    const gmtOffset = tradingAccount?.broker_gmt_offset ?? 0
    log('✅', `broker_gmt_offset: ${gmtOffset}`)

    // ── STEP 7: AI call ──
    log('🤖', 'Starting AI vision call (Gemini → OpenRouter fallback)...')
    const t2 = performance.now()
    let aiResult: Awaited<ReturnType<typeof analyzeImageBase64WithAiml>>
    try {
      aiResult = await analyzeImageBase64WithAiml(
        base64Image,
        buildTradeAndJournalPrompt(lang),
        { timeout: 20000, maxRetries: 1 }
      )
    } catch (err: any) {
      log('⛔', `AI call FAILED after ${(performance.now() - t2).toFixed(0)}ms: ${err.message}`)
      return NextResponse.json(
        { error: 'AI gagal menganalisis screenshot', detail: err.message, step: 'ai_call' },
        { status: 500 }
      )
    }
    log('✅', `AI responded in ${(performance.now() - t2).toFixed(0)}ms via ${aiResult.provider}, ${aiResult.text.length} chars`)

    // ── STEP 8: Parse AI JSON response ──
    log('📋', 'Parsing AI JSON response...')
    const jsonMatch = aiResult.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      log('⛔', `AI did not return valid JSON. Raw (first 200): ${aiResult.text.slice(0, 200)}`)
      return NextResponse.json(
        { error: 'AI gagal mengembalikan JSON yang valid dari screenshot.', step: 'json_parse', rawPreview: aiResult.text.slice(0, 300) },
        { status: 400 }
      )
    }

    let ai: CombinedAIResponse
    try {
      ai = JSON.parse(jsonMatch[0])
    } catch (err: any) {
      log('⛔', `JSON.parse failed: ${err.message}. Raw: ${jsonMatch[0].slice(0, 200)}`)
      return NextResponse.json(
        { error: 'AI mengembalikan JSON rusak.', detail: err.message, step: 'json_parse', rawPreview: jsonMatch[0].slice(0, 300) },
        { status: 400 }
      )
    }
    log('✅', `JSON parsed OK. symbol=${ai.symbol}, type=${ai.type}, p/l=${ai.profitLoss}`)

    // ── STEP 9: Validate minimum fields ──
    const validFields = [
      ai.symbol, ai.type, ai.openPrice, ai.closePrice,
      ai.profitLoss, ai.openTime, ai.closeTime,
    ].filter(f => f != null).length
    if (validFields < 3) {
      log('⛔', `Only ${validFields} valid fields extracted (need 3+)`)
      return NextResponse.json(
        { error: 'Data trade yang terekstrak tidak cukup. Upload screenshot yang lebih jelas.', validFieldCount: validFields, step: 'validation' },
        { status: 400 }
      )
    }
    log('✅', `Validation passed: ${validFields} fields extracted`)

    // ── STEP 10: Build journal object ──
    const tradeTypeLabel = ai.type === 'sell' ? 'Short' : 'Long'
    const journal: GeneratedJournal = {
      title: ai.journalTitle || (lang === 'id'
        ? `${ai.symbol || 'Trade'} ${tradeTypeLabel} di ${ai.openPrice ?? '?'}`
        : `${ai.symbol || 'Trade'} ${tradeTypeLabel} Entry at ${ai.openPrice ?? '?'}`),
      content: ai.journalContent || (lang === 'id'
        ? `${tradeTypeLabel} ${ai.symbol || 'unknown'}. Entry di ${ai.openPrice ?? '?'}, exit di ${ai.closePrice ?? '?'}. P/L: ${ai.profitLoss ?? 0}.`
        : `${tradeTypeLabel} position on ${ai.symbol || 'unknown'}. Entry at ${ai.openPrice ?? '?'}, exit at ${ai.closePrice ?? '?'}. P/L: ${ai.profitLoss ?? 0}.`),
      mood: ai.mood || 'neutral',
      market_condition: ai.marketCondition || 'ranging',
      tags: ai.tags ? ai.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : ['trade'],
      setup_type: ai.setupType || '',
    }
    if (!journal.tags.includes('trade')) journal.tags.push('trade')

    if (ai.stopLoss && ai.takeProfit && ai.openPrice) {
      const risk = Math.abs(ai.openPrice - ai.stopLoss)
      const reward = Math.abs((ai.closePrice ?? ai.openPrice) - ai.openPrice)
      journal.risk_reward_ratio = risk > 0 ? reward / risk : 0
    }

    // ── STEP 10b: Calculate session ──
    const openTime = ai.openTime ? new Date(ai.openTime) : new Date()
    const closeTime = ai.closeTime ? new Date(ai.closeTime) : new Date()

    function calculateSession(ot: Date, gmtOff: number): string {
      const utcHour = (ot.getUTCHours() + ot.getUTCMinutes() / 60) - gmtOff
      const normalizedHour = ((utcHour % 24) + 24) % 24
      if (normalizedHour >= 0 && normalizedHour < 7) return 'Asia'
      if (normalizedHour >= 7 && normalizedHour < 15) return 'London'
      if (normalizedHour >= 15 && normalizedHour < 24) return 'New York'
      return 'Unknown'
    }

    const session = calculateSession(openTime, gmtOffset)
    const tradeDuration = Math.round((closeTime.getTime() - openTime.getTime()) / 60000)
    log('✅', `Session: ${session}, Duration: ${tradeDuration}min`)

    // ── STEP 11: Save journal + trade to DB (Supabase) ──
    // Journal FIRST (parent) because trades.linked_journal_id has FK → journal_entries.id
    log('📝', 'Saving journal entry (parent first)...')
    const t4 = performance.now()

    const tradeId = randomUUID()
    const journalId = randomUUID()
    const userId = user.id

    const { data: journalRecord, error: journalErr } = await client
      .from('journal_entries')
      .insert([{
        id: journalId,
        user_id: userId,
        title: journal.title,
        content: journal.content,
        mood: journal.mood,
        market_condition: journal.market_condition,
        tags: journal.tags.join(','),
      }])
      .select()
      .single()

    if (journalErr) {
      log('⛔', `Journal create FAILED: ${journalErr.message}`)
      return NextResponse.json(
        { error: 'Gagal menyimpan journal ke database', detail: journalErr.message, step: 'journal_db' },
        { status: 500 }
      )
    }
    log('✅', `Journal saved: id=${journalId}`)

    // Insert trade (child — references journal via linked_journal_id)
    log('💾', 'Saving trade to database...')
    const { data: tradeRecord, error: tradeErr } = await client
      .from('trades')
      .insert([{
        id: tradeId,
        user_id: userId,
        account_id: accountId,
        symbol: (ai.symbol || 'UNKNOWN').toUpperCase(),
        type: (ai.type || 'buy').toUpperCase(),
        open_price: ai.openPrice ?? 0,
        close_price: ai.closePrice ?? 0,
        profit_loss: ai.profitLoss ?? 0,
        open_time: openTime.toISOString(),
        close_time: closeTime.toISOString(),
        stop_loss: ai.stopLoss ?? null,
        take_profit: ai.takeProfit ?? null,
        lot_size: ai.volume ?? 0,
        ticket_number: ai.ticketNumber || null,
        emotion: journal.mood,
        setup_type: journal.setup_type,
        tags: journal.tags.join(','),
        risk_reward_ratio: journal.risk_reward_ratio,
        notes: journal.content,
        session,
        trade_duration: tradeDuration,
        linked_journal_id: journalId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single()

    if (tradeErr) {
      log('⛔', `Trade create FAILED: ${tradeErr.message}`)
      return NextResponse.json(
        { error: 'Gagal menyimpan trade ke database', detail: tradeErr.message, step: 'trade_db' },
        { status: 500 }
      )
    }
    log('✅', `Trade saved: id=${tradeId}`)

    log('✅', `DB save total: ${(performance.now() - t4).toFixed(0)}ms`)

    // ── STEP 12: Background tasks ──
    after(async () => {
      if (optimizedBuffer.length > 0) {
        try {
          const url = await uploadScreenshot(optimizedBuffer, userId)
          // Update trade with screenshot URL using Supabase
          const { supabase: bgClient } = createClientForApi(request)
          await bgClient.from('trades').update({ screenshot_url: url }).eq('id', tradeId)
          console.log(`✅ [AutoJournal BG] Screenshot uploaded + linked`)
        } catch (err: any) {
          console.warn(`⚠️ [AutoJournal BG] Screenshot upload failed: ${err.message}`)
        }
      }

      try {
        const achievements = await checkAchievementsAfterTrade(userId)
        if (achievements && achievements.length > 0) {
          console.log(`🏆 [AutoJournal BG] Achievements:`, achievements.map((a: any) => a.key))
        }
      } catch (achErr) {
        console.warn(`⚠️ [AutoJournal BG] Achievement check failed:`, achErr)
      }
    })

    const totalTime = ((performance.now() - t0) / 1000).toFixed(2)
    log('🏁', `SUCCESS — total time: ${totalTime}s`)

    return NextResponse.json({
      success: true,
      data: {
        trade: tradeRecord,
        journal: journalRecord,
        timing: {
          totalMs: Math.round(performance.now() - t0),
          aiProvider: aiResult.provider,
        }
      },
      message: 'Auto-journal created successfully!'
    })

  } catch (error: any) {
    const totalTime = ((performance.now() - t0) / 1000).toFixed(2)
    console.error(`❌ [AutoJournal ${totalTime}s] UNHANDLED ERROR:`, error)
    console.error(`❌ [AutoJournal] Error stack:`, error?.stack)
    return NextResponse.json(
      {
        error: 'Failed to create auto-journal',
        timing: { totalMs: Math.round(performance.now() - t0) }
      },
      { status: 500 }
    )
  }
}
