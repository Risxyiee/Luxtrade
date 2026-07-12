import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { isUserPro } from '@/lib/pro-check'
import { extractTradeData, saveTrade, uploadScreenshot } from '@/lib/extractTradeData'
import { checkAchievementsAfterTrade } from '@/lib/achievement-checker'
import { analyzeImageWithAiml, analyzeTextWithZyloo } from '@/lib/aiml-vision'

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

// ==================== HELPERS ====================

/**
 * Generate journal content using Gemini 2.5 Flash Vision with OpenRouter fallback
 */
async function generateJournalContent(
  tradeData: any,
  imageBuffer: Buffer
): Promise<GeneratedJournal> {
  const journalPrompt = `Based on this trading screenshot with the following extracted data:
- Symbol: ${tradeData.symbol}
- Type: ${tradeData.type}
- Open Price: ${tradeData.openPrice}
- Close Price: ${tradeData.closePrice}
- Profit/Loss: ${tradeData.profitLoss}
- Open Time: ${tradeData.openTime}
- Close Time: ${tradeData.closeTime}
- Stop Loss: ${tradeData.stopLoss || 'N/A'}
- Take Profit: ${tradeData.takeProfit || 'N/A'}
- Volume: ${tradeData.volume || 'N/A'}

Create a detailed trading journal entry including:
1. Setup/strategy used
2. Market condition analysis
3. Trading psychology/emotions
4. Risk management assessment
5. Lessons learned
6. What went well
7. What could be improved

Format as:
Title: [Short descriptive title]
Content: [Detailed analysis in paragraphs]
Mood: [confident/nervous/calm/fearful/greedy/neutral]
Market Condition: [trending/ranging/volatile/bullish/bearish]
Tags: [comma-separated relevant tags]
Setup Type: [strategy name like breakout/pullback/momentum etc.]`

  let journalContent = ''

  // Try Gemini Vision first (image + prompt)
  try {
    const journalResponse = await analyzeImageWithAiml(imageBuffer, journalPrompt, {
      timeout: 90000,
      maxRetries: 2
    })
    journalContent = journalResponse.text || ''
    console.log('📝 [Auto Journal] Journal analysis completed (Gemini Vision)')
  } catch (visionError: any) {
    console.warn(`⚠️ [Auto Journal] Vision failed for journal: ${visionError.message}. Trying text-only...`)
  }

  // Fallback to text-only (Gemini → OpenRouter)
  if (!journalContent.trim()) {
    try {
      const textResponse = await analyzeTextWithZyloo(journalPrompt, {
        timeout: 60000,
        maxRetries: 2
      })
      journalContent = textResponse.text || ''
      console.log('📝 [Auto Journal] Journal analysis completed (text fallback via OpenRouter)')
    } catch (textError: any) {
      console.error('❌ [Auto Journal] Both vision and text failed for journal generation')
      // Generate a basic journal entry as last resort
      journalContent = `Title: ${tradeData.symbol} ${tradeData.type} Trade
Content: ${tradeData.type === 'buy' ? 'Long' : 'Short'} position on ${tradeData.symbol}. Entry at ${tradeData.openPrice}, exit at ${tradeData.closePrice}. P/L: ${tradeData.profitLoss}.
Mood: neutral
Market Condition: ranging
Tags: ${tradeData.symbol.toLowerCase()}, ${tradeData.type}
Setup Type: manual`
    }
  }

  // Parse journal response
  const journal = parseJournalResponse(journalContent)

  // Calculate risk-reward ratio if SL and TP exist
  if (tradeData.stopLoss && tradeData.takeProfit) {
    const risk = Math.abs(tradeData.openPrice - tradeData.stopLoss)
    const reward = Math.abs(tradeData.closePrice - tradeData.openPrice)
    journal.risk_reward_ratio = reward > 0 ? reward / risk : 0
  }

  return journal
}

/**
 * Parse journal text response into structured format
 */
function parseJournalResponse(text: string): GeneratedJournal {
  const lines = text.split('\n')
  const journal: Partial<GeneratedJournal> = {
    title: 'Trading Entry',
    content: text,
    mood: 'neutral',
    market_condition: 'ranging',
    tags: ['trade'],
    setup_type: ''
  }

  let currentSection = ''
  let contentLines: string[] = []

  for (const line of lines) {
    const lowerLine = line.toLowerCase().trim()

    if (lowerLine.startsWith('title:')) {
      journal.title = line.replace(/^title:\s*/i, '').trim()
    } else if (lowerLine.startsWith('mood:')) {
      journal.mood = line.replace(/^mood:\s*/i, '').trim().toLowerCase()
    } else if (lowerLine.startsWith('market condition:')) {
      journal.market_condition = line.replace(/^market condition:\s*/i, '').trim().toLowerCase()
    } else if (lowerLine.startsWith('tags:')) {
      const tagsStr = line.replace(/^tags:\s*/i, '').trim()
      journal.tags = tagsStr.split(',').map(t => t.trim().toLowerCase()).filter(t => t)
    } else if (lowerLine.startsWith('setup type:')) {
      journal.setup_type = line.replace(/^setup type:\s*/i, '').trim()
    } else if (lowerLine.includes('##') || lowerLine.includes('content:')) {
      currentSection = 'content'
    } else if (currentSection === 'content' && line.trim()) {
      contentLines.push(line.trim())
    }
  }

  if (contentLines.length > 0) {
    journal.content = contentLines.join('\n')
  }

  // Add symbol to tags
  if (!journal.tags!.includes('trade')) {
    journal.tags!.push('trade')
  }

  return journal as GeneratedJournal
}

// ==================== MAIN API ====================

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 [Auto Journal] Starting auto-journal creation...')

    // Get authenticated user
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // User authenticated

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
    const bytes = await imageFile.arrayBuffer()
    const buffer = Buffer.from(bytes)

    console.log('🤖 [Auto Journal] Extracting trade data with AI (Vision + OpenRouter fallback)...')

    // Extract trade data using Gemini Vision
    const extractionResult = await extractTradeData(buffer)

    if (!extractionResult.success) {
      console.error('❌ [Auto Journal] Failed to extract trade data:', extractionResult.errors)
      return NextResponse.json(
        {
          error: 'Failed to extract trade data from screenshot',
          details: extractionResult.errors,
          validFieldCount: extractionResult.validFieldCount,
          confidence: extractionResult.confidence
        },
        { status: 400 }
      )
    }

    console.log('✅ [Auto Journal] Trade data extracted successfully')
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 [Auto Journal] Trade:', JSON.stringify(extractionResult.data))
    }
    console.log('📈 [Auto Journal] Confidence:', extractionResult.confidence.toFixed(1), '%')

    // Check if we have minimum required fields
    if (extractionResult.validFieldCount < 5) {
      return NextResponse.json(
        {
          error: 'Insufficient trade data extracted. Please upload a clearer screenshot showing trade details.',
          details: extractionResult.errors,
          validFieldCount: extractionResult.validFieldCount,
          confidence: extractionResult.confidence
        },
        { status: 400 }
      )
    }

    // Upload screenshot to Supabase Storage
    console.log('📤 [Auto Journal] Uploading screenshot...')
    let screenshotUrl: string | undefined
    try {
      screenshotUrl = await uploadScreenshot(buffer, authUser.id)
      console.log('✅ [Auto Journal] Screenshot uploaded')
    } catch (uploadError: any) {
      console.warn('⚠️ [Auto Journal] Failed to upload screenshot:', uploadError.message)
      // Continue without screenshot URL
    }

    // Generate journal content using Gemini Vision
    console.log('📝 [Auto Journal] Generating journal content...')
    const journal = await generateJournalContent(extractionResult.data, buffer)

    console.log('✅ [Auto Journal] Journal generated')

    // Ensure profile exists
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

    // Save trade to database using the new saveTrade function
    // All fields use null-safe fallbacks — AI extraction may return null for any field
    console.log('💾 [Auto Journal] Saving trade to database...')
    const d = extractionResult.data!
    const tradeData = {
      userId: authUser.id,
      symbol: (d.symbol || 'UNKNOWN').toUpperCase(),
      type: (d.type || 'buy').toUpperCase(),
      openPrice: d.openPrice ?? 0,
      closePrice: d.closePrice ?? 0,
      profitLoss: d.profitLoss ?? 0,
      openTime: d.openTime || new Date().toISOString(),
      closeTime: d.closeTime || new Date().toISOString(),
      stopLoss: d.stopLoss ?? null,
      takeProfit: d.takeProfit ?? null,
      volume: d.volume ?? null,
      ticketNumber: d.ticketNumber || null,
      screenshotUrl: screenshotUrl,
      notes: journal.content,
    }

    const savedTrade = await saveTrade(tradeData)

    // Update the trade record with additional journal data
    const tradeRecord = await db.trade.update({
      where: { id: savedTrade.id },
      data: {
        emotion: journal.mood,
        setup_type: journal.setup_type,
        tags: journal.tags.join(','),
        risk_reward_ratio: journal.risk_reward_ratio
      }
    })

    console.log('✅ [Auto Journal] Trade created:', tradeRecord.id)

    // Create journal entry
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

    console.log('✅ [Auto Journal] Journal created:', journalRecord.id)

    // Check achievements after AI-upload trade (same as manual trade flow)
    let unlockedAchievements: any[] = []
    try {
      unlockedAchievements = await checkAchievementsAfterTrade(authUser.id)
    } catch (achErr) {
      console.warn('[Auto Journal] Achievement check failed (non-critical):', achErr)
    }

    return NextResponse.json({
      success: true,
      data: {
        trade: tradeRecord,
        journal: journalRecord,
        unlockedAchievements,
        extraction: {
          confidence: extractionResult.confidence,
          validFieldCount: extractionResult.validFieldCount,
          errors: extractionResult.errors
        }
      },
      message: 'Auto-journal created successfully!'
    })

  } catch (error: any) {
    console.error('❌ [Auto Journal] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create auto-journal',
        details: error.message
      },
      { status: 500 }
    )
  }
}