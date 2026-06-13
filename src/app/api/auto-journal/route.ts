import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import ZAI from 'z-ai-web-dev-sdk'
import fs from 'fs/promises'
import path from 'path'

// ==================== TYPES ====================
interface ExtractedTrade {
  symbol: string
  type: string
  entry_price: number
  exit_price: number
  lot_size: number
  profit_loss: number
  open_time: string
  close_time: string
  stop_loss?: number
  take_profit?: number
}

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
 * Convert base64 to file and analyze with VLM
 */
async function analyzeImage(base64Image: string) {
  try {
    // Create ZAI instance
    const zai = await ZAI.create()

    // Extract trading data
    const tradePrompt = `Analyze this trading platform screenshot and extract all trading information in JSON format:
{
  "symbol": "Trading symbol (e.g., XAUUSD, EURUSD)",
  "type": "BUY or SELL",
  "entry_price": "Entry price as number",
  "exit_price": "Exit price as number",
  "lot_size": "Lot size as number",
  "profit_loss": "Profit/loss as number",
  "open_time": "Open time in format YYYY.MM.DD HH:MM:SS",
  "close_time": "Close time in format YYYY.MM.DD HH:MM:SS",
  "stop_loss": "Stop loss price as number (if visible)",
  "take_profit": "Take profit price as number (if visible)"
}

Return ONLY valid JSON, no other text.`

    const tradeResponse = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: tradePrompt
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      thinking: { type: 'disabled' }
    })

    const tradeContent = tradeResponse.choices?.[0]?.message?.content || ''
    console.log('📊 [Auto Journal] Trade data:', tradeContent)

    // Parse JSON
    const tradeData: ExtractedTrade = JSON.parse(tradeContent)

    // Generate journal entry
    const journalPrompt = `Based on this trading screenshot, create a detailed trading journal entry including:
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

    const journalResponse = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: journalPrompt
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      thinking: { type: 'disabled' }
    })

    const journalContent = journalResponse.choices?.[0]?.message?.content || ''
    console.log('📝 [Auto Journal] Journal analysis completed')

    // Parse journal response
    const journal = parseJournalResponse(journalContent)

    // Calculate risk-reward ratio if SL and TP exist
    if (tradeData.stop_loss && tradeData.take_profit) {
      const risk = Math.abs(tradeData.entry_price - tradeData.stop_loss)
      const reward = Math.abs(tradeData.exit_price - tradeData.entry_price)
      journal.risk_reward_ratio = reward > 0 ? reward / risk : 0
    }

    return {
      trade: tradeData,
      journal
    }
  } catch (error: any) {
    console.error('❌ [Auto Journal] Analysis error:', error)
    throw error
  }
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

    // Convert image to base64
    const bytes = await imageFile.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Image = buffer.toString('base64')

    console.log('🤖 [Auto Journal] Analyzing image with AI...')

    // Analyze image with VLM
    const { trade, journal } = await analyzeImage(base64Image)

    console.log('✅ [Auto Journal] AI analysis completed')
    console.log('📊 [Auto Journal] Trade:', JSON.stringify(trade))
    console.log('📝 [Auto Journal] Journal:', JSON.stringify(journal))

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

    // Create trade record
    const tradeRecord = await db.trade.create({
      data: {
        user_id: authUser.id,
        symbol: trade.symbol.toUpperCase(),
        type: trade.type.toUpperCase(),
        open_price: trade.entry_price,
        close_price: trade.exit_price,
        lot_size: trade.lot_size,
        profit_loss: trade.profit_loss,
        open_time: new Date(trade.open_time.replace(/\./g, '-')),
        close_time: new Date(trade.close_time.replace(/\./g, '-')),
        notes: journal.content,
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
        journal: journalRecord
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