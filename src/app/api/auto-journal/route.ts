import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { isUserPro } from '@/lib/pro-check'
import { uploadScreenshot } from '@/lib/extractTradeData'
import { checkAchievementsAfterTrade } from '@/lib/achievement-checker'
import {
  analyzeImageBase64WithAiml,
  buildTradeAndJournalPrompt,
} from '@/lib/aiml-vision'
import sharp from 'sharp'

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
  // Trade data
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
  // Journal data
  journalTitle?: string
  journalContent?: string
  mood?: string
  marketCondition?: string
  tags?: string
  setupType?: string
}

// ==================== MAIN API ====================

export async function POST(request: NextRequest) {
  const t0 = performance.now()

  // Helper: log every step with timing so Vercel logs always show WHERE it stops
  const log = (emoji: string, msg: string) => {
    const elapsed = ((performance.now() - t0) / 1000).toFixed(1)
    console.log(`${emoji} [AutoJournal ${elapsed}s] ${msg}`)
  }

  try {
    log('🚀', 'POST /api/auto-journal — request received')

    // ── STEP 1: Auth ──
    log('🔐', 'Checking authentication...')
    const authUser = await getAuthUser(request)
    if (!authUser) {
      log('⛔', 'AUTH FAILED — no valid session/cookie found')
      return NextResponse.json(
        { error: 'Unauthorized', detail: 'Tidak ada session login. Coba logout lalu login ulang.', step: 'auth' },
        { status: 401 }
      )
    }
    log('✅', `Auth OK: userId=${authUser.id}, email=${authUser.email}`)

    // ── STEP 2: PRO check ──
    log('💎', 'Checking PRO status...')
    let pro: boolean
    try {
      pro = await isUserPro(authUser.id)
    } catch (err: any) {
      log('⛔', `PRO CHECK CRASHED: ${err.message}`)
      return NextResponse.json(
        { error: 'PRO check gagal', detail: err.message, step: 'pro_check' },
        { status: 500 }
      )
    }

    if (!pro) {
      log('⛔', `User is NOT PRO — auto-journal blocked`)
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
      log('⛔', 'No image file in FormData — field name must be "image"')
      return NextResponse.json(
        { error: 'File gambar tidak ditemukan. Pastikan field upload bernama "image".', step: 'form_parse' },
        { status: 400 }
      )
    }
    log('📷', `Image received: ${imageFile.name}, ${imageFile.size} bytes, type=${imageFile.type || 'unknown'}`)

    // ── STEP 3b: Extract & validate account_id ──
    const accountId = formData.get('account_id') as string | null
    if (!accountId) {
      log('⛔', 'No account_id provided — required for auto-journal')
      return NextResponse.json(
        { error: 'Pilih akun trading terlebih dahulu sebelum auto-journal.', step: 'validation' },
        { status: 400 }
      )
    }
    log('✅', `account_id: ${accountId}`)

    // ── STEP 3c: Extract language preference (default: Indonesian) ──
    // Frontend sends the current language toggle value ('id' | 'en').
    // Default to 'id' (Bahasa Indonesia) because that's the app's primary audience.
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

    // ── STEP 5: Sharp optimization ──
    log('🔧', 'Running sharp image optimization...')
    const t1 = performance.now()
    let optimizedBuffer: Buffer
    let base64Image: string
    try {
      const bytes = await imageFile.arrayBuffer()
      const buffer = Buffer.from(bytes)
      optimizedBuffer = await sharp(buffer)
        .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer()
      base64Image = optimizedBuffer.toString('base64')
    } catch (err: any) {
      log('⛔', `Sharp error: ${err.message}`)
      return NextResponse.json(
        { error: 'Gagal memproses gambar', detail: err.message, step: 'sharp' },
        { status: 400 }
      )
    }
    log('✅', `Sharp done in ${(performance.now() - t1).toFixed(0)}ms, base64=${base64Image.length} chars`)

    // ── STEP 6: Ensure profile exists in local DB ──
    log('👤', 'Checking/creating profile in trade DB...')
    try {
      const existingProfile = await db.profile.findUnique({
        where: { id: authUser.id },
        select: { id: true }
      })
      if (!existingProfile) {
        await db.profile.create({
          data: {
            id: authUser.id,
            email: authUser.email,
          }
        })
        log('👤', 'Profile created (was missing)')
      } else {
        log('👤', 'Profile exists')
      }
    } catch (err: any) {
      log('⛔', `Profile DB error: ${err.message}`)
      return NextResponse.json(
        { error: 'Database error saat mengecek profile', detail: err.message, step: 'profile_db' },
        { status: 500 }
      )
    }

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

    // ── STEP 10: Build journal object — language-aware fallbacks ──
    const tradeTypeLabel = ai.type === 'sell' ? 'Short' : 'Long'
    const tradeTypeLabelId = ai.type === 'sell' ? 'Short' : 'Long'
    const journal: GeneratedJournal = {
      title: ai.journalTitle || (lang === 'id'
        ? `${ai.symbol || 'Trade'} ${tradeTypeLabelId} di ${ai.openPrice ?? '?'}`
        : `${ai.symbol || 'Trade'} ${tradeTypeLabel} Entry at ${ai.openPrice ?? '?'}`),
      content: ai.journalContent || (lang === 'id'
        ? `${tradeTypeLabelId} ${ai.symbol || 'unknown'}. Entry di ${ai.openPrice ?? '?'}, exit di ${ai.closePrice ?? '?'}. P/L: ${ai.profitLoss ?? 0}.`
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

    // ── STEP 10b: Calculate session from trade open time + broker GMT offset ──
    // broker_gmt_offset is optional on the account (default 0). If user didn't set it,
    // session calc falls back to treating trade time as UTC.
    log('🌐', 'Fetching trading account for broker_gmt_offset...')

    const tradingAccount = await db.tradingAccount.findUnique({
      where: { id: accountId },
      select: { broker_gmt_offset: true },
    })
    const gmtOffset = tradingAccount?.broker_gmt_offset ?? 0
    log('✅', `broker_gmt_offset: ${gmtOffset}`)

    const openTime = ai.openTime ? new Date(ai.openTime) : new Date()
    const closeTime = ai.closeTime ? new Date(ai.closeTime) : new Date()

    // Calculate session: convert broker time to UTC by subtracting GMT offset.
    function calculateSession(ot: Date, gmtOff: number): string {
      const utcHour = (ot.getUTCHours() + ot.getUTCMinutes() / 60) - gmtOff
      const normalizedHour = ((utcHour % 24) + 24) % 24
      if (normalizedHour >= 0 && normalizedHour < 7) return 'Asia'
      if (normalizedHour >= 7 && normalizedHour < 15) return 'London'
      if (normalizedHour >= 15 && normalizedHour < 24) return 'New York'
      return 'Unknown'
    }

    const session = calculateSession(openTime, gmtOffset)
    const tradeDuration = Math.round((closeTime.getTime() - openTime.getTime()) / 60000) // minutes
    log('✅', `Session: ${session}, Duration: ${tradeDuration}min`)

    // ── STEP 11: Save trade + journal to DB ──
    log('💾', 'Saving trade to database...')
    const t4 = performance.now()

    let tradeRecord: any
    try {
      tradeRecord = await db.trade.create({
        data: {
          user_id: authUser.id,
          account_id: accountId,
          symbol: (ai.symbol || 'UNKNOWN').toUpperCase(),
          type: (ai.type || 'buy').toUpperCase(),
          open_price: ai.openPrice ?? 0,
          close_price: ai.closePrice ?? 0,
          profit_loss: ai.profitLoss ?? 0,
          open_time: openTime,
          close_time: closeTime,
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
        }
      })
    } catch (err: any) {
      log('⛔', `Trade create FAILED: ${err.message}`)
      return NextResponse.json(
        { error: 'Gagal menyimpan trade ke database', detail: err.message, step: 'trade_db' },
        { status: 500 }
      )
    }
    log('✅', `Trade saved: id=${tradeRecord.id}`)

    log('📝', 'Saving journal entry...')
    let journalRecord: any
    try {
      journalRecord = await db.journalEntry.create({
        data: {
          user_id: authUser.id,
          title: journal.title,
          content: journal.content,
          mood: journal.mood,
          market_condition: journal.market_condition,
          tags: journal.tags.join(','),
        }
      })
    } catch (err: any) {
      log('⛔', `Journal create FAILED: ${err.message}`)
      return NextResponse.json(
        { error: 'Gagal menyimpan journal ke database', detail: err.message, step: 'journal_db' },
        { status: 500 }
      )
    }
    log('✅', `Journal saved: id=${journalRecord.id}`)

    log('🔗', 'Linking trade → journal...')
    try {
      await db.trade.update({
        where: { id: tradeRecord.id },
        data: { linked_journal_id: journalRecord.id }
      })
    } catch (err: any) {
      log('⚠️', `Link trade→journal failed (non-critical): ${err.message}`)
      // Don't fail the whole request for this
    }

    log('✅', `DB save total: ${(performance.now() - t4).toFixed(0)}ms`)

    // ── STEP 12: Background tasks ──
    const tradeId = tradeRecord.id
    const userId = authUser.id
    after(async () => {
      if (optimizedBuffer.length > 0) {
        try {
          const url = await uploadScreenshot(optimizedBuffer, userId)
          await db.trade.update({
            where: { id: tradeId },
            data: { screenshot_url: url }
          })
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