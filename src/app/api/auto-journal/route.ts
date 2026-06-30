import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { extractTradeData, saveTrade, uploadScreenshot } from '@/lib/extractTradeData'
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
 * Generate journal content using AIML GLM-OCR with Zyloo fallback
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

  // Try AIML GLM-OCR first (vision-capable)
  try {
    const journalResponse = await analyzeImageWithAiml(imageBuffer, journalPrompt, {
      timeout: 60000,
      maxRetries: 2
    })
    journalContent = journalResponse.text || ''
    console.log('📝 [Auto Journal] Journal analysis completed (AIML GLM-OCR)')
  } catch (aimlError: any) {
    console.warn(`⚠️ [Auto Journal] AIML failed for journal: ${aimlError.message}. Trying Zyloo fallback...`)
  }

  // Fallback to Zyloo Claude Opus (text-only, no image)
  if (!journalContent.trim()) {
    try {
      const zylooResponse = await analyzeTextWithZyloo(journalPrompt, {
        timeout: 60000,
        maxRetries: 2
      })
      journalContent = zylooResponse.text || ''
      console.log('📝 [Auto Journal] Journal analysis completed (Zyloo Claude Opus fallback)')
    } catch (zylooError: any) {
      console.error('❌ [Auto Journal] Both AIML and Zyloo failed for journal generation')
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

/**
 * Get authenticated user
 */
async function getAuthUser(request: NextRequest) {
  try {
    const { supabase } = createClientForApi(request)
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return null
    }

    return { id: user.id, email: user.email || '' }
  } catch (error) {
    return null
  }
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

    console.log('✅ [Auto Journal] Authenticated user:', authUser.email)

    // Parse form data
    const formData = await request.formData()
    const imageFile = formData.get('image') as File

    if (!imageFile) {
      return NextResponse.json({ error: 'Image file is required' }, { status: 400 })
    }

    console.log('📷 [Auto Journal] Processing image:', imageFile.name, imageFile.size, 'bytes')

    // Convert image to buffer
    const bytes = await imageFile.arrayBuffer()
    const buffer = Buffer.from(bytes)

    console.log('🤖 [Auto Journal] Extracting trade data with AI (AIML GLM-OCR)...')

    // Extract trade data using AIML GLM-OCR
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
    console.log('📊 [Auto Journal] Trade:', JSON.stringify(extractionResult.data))
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
      console.log('✅ [Auto Journal] Screenshot uploaded:', screenshotUrl)
    } catch (uploadError: any) {
      console.warn('⚠️ [Auto Journal] Failed to upload screenshot:', uploadError.message)
      // Continue without screenshot URL
    }

    // Generate journal content using AIML GLM-OCR
    console.log('📝 [Auto Journal] Generating journal content...')
    const journal = await generateJournalContent(extractionResult.data, buffer)

    console.log('✅ [Auto Journal] Journal generated:', JSON.stringify(journal))

    // Ensure profile exists
    try {
      await db.profile.findUnique({
        where: { id: authUser.id }
      })
    } catch {
      await db.profile.create({
        data: {
          id: authUser.id,
          email: authUser.email,
          plan: 'FREE',
          role: 'USER'
        }
      })
    }

    // Save trade to database using the new saveTrade function
    console.log('💾 [Auto Journal] Saving trade to database...')
    const tradeData = {
      userId: authUser.id,
      symbol: extractionResult.data!.symbol.toUpperCase(),
      type: extractionResult.data!.type.toUpperCase(),
      openPrice: extractionResult.data!.openPrice,
      closePrice: extractionResult.data!.closePrice,
      profitLoss: extractionResult.data!.profitLoss,
      openTime: extractionResult.data!.openTime,
      closeTime: extractionResult.data!.closeTime,
      stopLoss: extractionResult.data!.stopLoss,
      takeProfit: extractionResult.data!.takeProfit,
      volume: extractionResult.data!.volume,
      ticketNumber: extractionResult.data!.ticketNumber,
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
        linked_journal_id: tradeRecord.id
      }
    })

    console.log('✅ [Auto Journal] Journal created:', journalRecord.id)

    return NextResponse.json({
      success: true,
      data: {
        trade: tradeRecord,
        journal: journalRecord,
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