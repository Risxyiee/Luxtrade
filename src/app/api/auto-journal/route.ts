import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { isUserPro } from '@/lib/pro-check'
import { uploadScreenshot } from '@/lib/extractTradeData'
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

    // ── Step 1: Convert + optimize image with sharp (single pass) ──
    const t1 = performance.now()
    const bytes = await imageFile.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const optimizedBuffer = await sharp(buffer)
      .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer()
    const base64Image = optimizedBuffer.toString('base64')
    console.log(`⏱️ [Auto Journal] Sharp + base64: ${(performance.now() - t1).toFixed(0)}ms`)

    // ── Step 2: Ensure profile exists (parallel with AI call would be ideal but needs auth) ──
    const t1b = performance.now()
    const existingProfile = await db.profile.findUnique({
      where: { id: authUser.id },
      select: { id: true }
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
    console.log(`⏱️ [Auto Journal] Profile check: ${(performance.now() - t1b).toFixed(0)}ms`)

    // ═══════════════════════════════════════════════════════════
    // SINGLE AI CALL — trade data extraction + journal analysis
    // ═══════════════════════════════════════════════════════════
    const t2 = performance.now()
    console.log('🤖 [Auto Journal] Single combined AI call (extract + journal)...')

    const aiResult = await analyzeImageBase64WithAiml(
      base64Image,
      TRADE_AND_JOURNAL_PROMPT,
      { timeout: 20000, maxRetries: 1 }  // 1 attempt only — no time for retries on Vercel Hobby
    )
    console.log(`⏱️ [Auto Journal] AI call: ${(performance.now() - t2).toFixed(0)}ms (${aiResult.provider})`)

    // Parse the combined JSON response
    const t3 = performance.now()
    const jsonMatch = aiResult.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'AI failed to return valid JSON from screenshot.' },
        { status: 400 }
      )
    }

    const ai: CombinedAIResponse = JSON.parse(jsonMatch[0])
    console.log(`⏱️ [Auto Journal] JSON parse: ${(performance.now() - t3).toFixed(0)}ms`)

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

    // ── Parse journal fields from the same response ──
    const journal: GeneratedJournal = {
      title: ai.journalTitle || `${ai.symbol || 'Trade'} ${ai.type || ''} Entry`,
      content: ai.journalContent || `${ai.type === 'sell' ? 'Short' : 'Long'} position on ${ai.symbol || 'unknown'}. Entry at ${ai.openPrice ?? '?'}, exit at ${ai.closePrice ?? '?'}. P/L: ${ai.profitLoss ?? 0}.`,
      mood: ai.mood || 'neutral',
      market_condition: ai.marketCondition || 'ranging',
      tags: ai.tags ? ai.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : ['trade'],
      setup_type: ai.setupType || '',
    }
    if (!journal.tags.includes('trade')) journal.tags.push('trade')

    // Calculate risk-reward ratio if SL and TP exist
    if (ai.stopLoss && ai.takeProfit && ai.openPrice) {
      const risk = Math.abs(ai.openPrice - ai.stopLoss)
      const reward = Math.abs((ai.closePrice ?? ai.openPrice) - ai.openPrice)
      journal.risk_reward_ratio = risk > 0 ? reward / risk : 0
    }

    // ── Step 3: Save to database — use Prisma for EVERYTHING (single DB provider) ──
    const t4 = performance.now()

    const tradeRecord = await db.trade.create({
      data: {
        user_id: authUser.id,
        symbol: (ai.symbol || 'UNKNOWN').toUpperCase(),
        type: (ai.type || 'buy').toUpperCase(),
        open_price: ai.openPrice ?? 0,
        close_price: ai.closePrice ?? 0,
        profit_loss: ai.profitLoss ?? 0,
        open_time: ai.openTime ? new Date(ai.openTime) : new Date(),
        close_time: ai.closeTime ? new Date(ai.closeTime) : new Date(),
        stop_loss: ai.stopLoss ?? null,
        take_profit: ai.takeProfit ?? null,
        lot_size: ai.volume ?? 0,
        ticket_number: ai.ticketNumber || null,
        emotion: journal.mood,
        setup_type: journal.setup_type,
        tags: journal.tags.join(','),
        risk_reward_ratio: journal.risk_reward_ratio,
        notes: journal.content,
      }
    })

    // Create journal entry + link in one conceptual step
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

    // Link trade → journal (FK on Trade model)
    await db.trade.update({
      where: { id: tradeRecord.id },
      data: { linked_journal_id: journalRecord.id }
    })

    console.log(`⏱️ [Auto Journal] DB save (3 ops): ${(performance.now() - t4).toFixed(0)}ms`)

    // ── Step 4: Background tasks (using Next.js `after()` for serverless safety) ──
    // These run AFTER the response is sent but are guaranteed to complete
    // (unlike plain fire-and-forget which Vercel may freeze).
    const tradeId = tradeRecord.id
    after(async () => {
      // Screenshot upload + link to trade
      if (optimizedBuffer.length > 0) {
        try {
          const url = await uploadScreenshot(optimizedBuffer, authUser.id)
          await db.trade.update({
            where: { id: tradeId },
            data: { screenshot_url: url }
          })
          console.log(`✅ [Auto Journal BG] Screenshot uploaded + linked`)
        } catch (err: any) {
          console.warn('⚠️ [Auto Journal BG] Screenshot upload failed:', err.message)
        }
      }

      // Achievement check (non-critical)
      try {
        const achievements = await checkAchievementsAfterTrade(authUser.id)
        if (achievements && achievements.length > 0) {
          console.log(`🏆 [Auto Journal BG] Achievements unlocked:`, achievements.map((a: any) => a.key))
        }
      } catch (achErr) {
        console.warn('[Auto Journal BG] Achievement check failed (non-critical):', achErr)
      }
    })

    const totalTime = ((performance.now() - t0) / 1000).toFixed(2)
    console.log(`🏁 [Auto Journal] Total time: ${totalTime}s`)

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