import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { isUserPro } from '@/lib/pro-check'
import { saveTrade, uploadScreenshot } from '@/lib/extractTradeData'
import { checkAchievementsAfterTrade } from '@/lib/achievement-checker'
import {
  analyzeImageBase64WithAiml,
  TRADE_AND_JOURNAL_PROMPT,
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
  try {
    console.log('🚀 [Auto Journal] Starting auto-journal creation...')

    // Get authenticated user
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // PRO check - auto-journal is a PRO feature (AI-powered)
    const pro = await isUserPro(authUser.id)
    if (!pro) {
      return NextResponse.json({
        error: 'Auto-Journal adalah fitur PRO. Upgrade ke PRO untuk menggunakan AI auto-journal!',
        code: 'PRO_REQUIRED',
        requiresUpgrade: true
      }, { status: 403 })
    }

    // Parse form data
    const formData = await request.formData()
    const imageFile = formData.get('image') as File

    if (!imageFile) {
      return NextResponse.json({ error: 'Image file is required' }, { status: 400 })
    }

    // Detect HEIC/HEIF format — sharp doesn't support it in serverless environments
    const fileName = imageFile.name.toLowerCase()
    const fileType = (imageFile.type || '').toLowerCase()
    const isHeic = fileName.endsWith('.heic') || fileName.endsWith('.heif')
      || fileType === 'image/heic' || fileType === 'image/heif'
      || fileType.includes('heic') || fileType.includes('heif')
    if (isHeic) {
      return NextResponse.json({
        error: 'Format HEIC/HEIF belum didukung. Silakan screenshot ulang atau export foto sebagai JPEG/PNG sebelum upload.',
        code: 'HEIC_NOT_SUPPORTED',
      }, { status: 400 })
    }

    console.log('📷 [Auto Journal] Processing image:', imageFile.name, imageFile.size, 'bytes', `type: ${imageFile.type || 'unknown'}`)

    // Convert image to buffer
    const t1 = performance.now()
    const bytes = await imageFile.arrayBuffer()
    const buffer = Buffer.from(bytes)
    console.log(`⏱️ [Auto Journal] Buffer conversion: ${(performance.now() - t1).toFixed(0)}ms`)

    // Optimize image ONCE with sharp — reuse base64 for both AI call and upload
    const t2 = performance.now()
    const optimizedBuffer = await sharp(buffer)
      .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer()
    const base64Image = optimizedBuffer.toString('base64')
    console.log(`⏱️ [Auto Journal] Sharp optimize + base64: ${(performance.now() - t2).toFixed(0)}ms`)

    // ═══════════════════════════════════════════════════════════
    // SINGLE AI CALL — trade data extraction + journal analysis
    // ═══════════════════════════════════════════════════════════
    const t3 = performance.now()
    console.log('🤖 [Auto Journal] Single combined AI call (extract + journal)...')

    const aiResult = await analyzeImageBase64WithAiml(
      base64Image,
      TRADE_AND_JOURNAL_PROMPT,
      { timeout: 25000, maxRetries: 1 }  // aggressive: 25s timeout, 1 retry only
    )
    console.log(`⏱️ [Auto Journal] AI call completed: ${(performance.now() - t3).toFixed(0)}ms (${aiResult.provider})`)

    // Parse the combined JSON response
    const t4 = performance.now()
    const jsonMatch = aiResult.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'AI failed to return valid JSON from screenshot.' },
        { status: 400 }
      )
    }

    const ai: CombinedAIResponse = JSON.parse(jsonMatch[0])
    console.log(`⏱️ [Auto Journal] JSON parse: ${(performance.now() - t4).toFixed(0)}ms`)

    // ── Validate trade data (minimum 3 fields: symbol + type + price) ──
    const validFields = [
      ai.symbol, ai.type, ai.openPrice, ai.closePrice,
      ai.profitLoss, ai.openTime, ai.closeTime,
    ].filter(f => f != null).length
    if (validFields < 3) {
      return NextResponse.json(
        {
          error: 'Insufficient trade data extracted. Please upload a clearer screenshot.',
          validFieldCount: validFields,
        },
        { status: 400 }
      )
    }

    console.log('✅ [Auto Journal] Trade data extracted:', {
      symbol: ai.symbol, type: ai.type, pl: ai.profitLoss,
    })

    // ── Parse journal fields from the same response ──
    const journal: GeneratedJournal = {
      title: ai.journalTitle || `${ai.symbol || 'Trade'} ${ai.type || ''} Entry`,
      content: ai.journalContent || `${ai.type === 'sell' ? 'Short' : 'Long'} position on ${ai.symbol || 'unknown'}. Entry at ${ai.openPrice ?? '?'}, exit at ${ai.closePrice ?? '?'}. P/L: ${ai.profitLoss ?? 0}.`,
      mood: ai.mood || 'neutral',
      market_condition: ai.marketCondition || 'ranging',
      tags: ai.tags ? ai.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : ['trade'],
      setup_type: ai.setupType || '',
    }
    // Always ensure 'trade' is in tags
    if (!journal.tags.includes('trade')) journal.tags.push('trade')

    // Calculate risk-reward ratio if SL and TP exist
    if (ai.stopLoss && ai.takeProfit && ai.openPrice) {
      const risk = Math.abs(ai.openPrice - ai.stopLoss)
      const reward = Math.abs((ai.closePrice ?? ai.openPrice) - ai.openPrice)
      journal.risk_reward_ratio = risk > 0 ? reward / risk : 0
    }

    // ── Upload screenshot to Supabase Storage (parallel-ready, but sequential is fine) ──
    const t5 = performance.now()
    let screenshotUrl: string | undefined
    try {
      screenshotUrl = await uploadScreenshot(optimizedBuffer, authUser.id)
      console.log(`⏱️ [Auto Journal] Screenshot upload: ${(performance.now() - t5).toFixed(0)}ms`)
    } catch (uploadError: any) {
      console.warn('⚠️ [Auto Journal] Failed to upload screenshot:', uploadError.message)
    }

    // ── Ensure profile exists ──
    const existingProfile = await db.profile.findUnique({
      where: { id: authUser.id }
    })
    if (!existingProfile) {
      await db.profile.create({
        data: {
          id: authUser.id,
          email: authUser.email,
          plan: 'FREE',
          role: 'USER',
          streakCount: 0,
          bestStreak: 0,
          achievements: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      })
    }

    // ── Save trade to database (all fields null-safe) ──
    const t6 = performance.now()
    const tradeData = {
      userId: authUser.id,
      symbol: (ai.symbol || 'UNKNOWN').toUpperCase(),
      type: (ai.type || 'buy').toUpperCase(),
      openPrice: ai.openPrice ?? 0,
      closePrice: ai.closePrice ?? 0,
      profitLoss: ai.profitLoss ?? 0,
      openTime: ai.openTime || new Date().toISOString(),
      closeTime: ai.closeTime || new Date().toISOString(),
      stopLoss: ai.stopLoss ?? null,
      takeProfit: ai.takeProfit ?? null,
      volume: ai.volume ?? null,
      ticketNumber: ai.ticketNumber || null,
      screenshotUrl: screenshotUrl,
      notes: journal.content,
    }

    const savedTrade = await saveTrade(tradeData)

    // Update the trade record with journal metadata
    const tradeRecord = await db.trade.update({
      where: { id: savedTrade.id },
      data: {
        emotion: journal.mood,
        setup_type: journal.setup_type,
        tags: journal.tags.join(','),
        risk_reward_ratio: journal.risk_reward_ratio
      }
    })
    console.log(`⏱️ [Auto Journal] DB save: ${(performance.now() - t6).toFixed(0)}ms`)

    // ── Create journal entry ──
    const journalRecord = await db.journalEntry.create({
      data: {
        user_id: authUser.id,
        title: journal.title,
        content: journal.content,
        mood: journal.mood,
        market_condition: journal.market_condition,
        tags: journal.tags.join(','),
      }
    })

    // Link trade → journal (FK is on Trade model, not JournalEntry)
    await db.trade.update({
      where: { id: tradeRecord.id },
      data: { linked_journal_id: journalRecord.id }
    })

    // ── Check achievements (non-critical) ──
    let unlockedAchievements: any[] = []
    try {
      unlockedAchievements = await checkAchievementsAfterTrade(authUser.id)
    } catch (achErr) {
      console.warn('[Auto Journal] Achievement check failed (non-critical):', achErr)
    }

    const totalTime = ((performance.now() - t0) / 1000).toFixed(2)
    console.log(`🏁 [Auto Journal] Total time: ${totalTime}s`)

    return NextResponse.json({
      success: true,
      data: {
        trade: tradeRecord,
        journal: journalRecord,
        unlockedAchievements,
        timing: {
          totalMs: Math.round(performance.now() - t0),
          aiProvider: aiResult.provider,
        }
      },
      message: 'Auto-journal created successfully!'
    })

  } catch (error: any) {
    const totalTime = ((performance.now() - t0) / 1000).toFixed(2)
    console.error(`❌ [Auto Journal] Error after ${totalTime}s:`, error)
    return NextResponse.json(
      {
        error: 'Failed to create auto-journal',
        details: error.message,
        timing: { totalMs: Math.round(performance.now() - t0) }
      },
      { status: 500 }
    )
  }
}