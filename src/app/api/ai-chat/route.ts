import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

// In-memory conversation store (per session)
const conversations = new Map<string, { role: 'user' | 'assistant' | 'system'; content: string }[]>()

const SYSTEM_PROMPT = `Kamu adalah LuxTrade AI Assistant — asisten trading profesional yang ramah dan berpengetahuan luas.

PERSONALITAS:
- Ramah, profesional, dan informatif
- Bicara dalam Bahasa Indonesia secara default, tapi bisa Bahasa Inggris jika user pakai Inggris
- Menggunakan emoji yang relevan untuk membuat percakapan lebih hidup
- Memberikan jawaban yang terstruktur dan mudah dipahami

KEAHLIAN:
1. **Trading Forex**: EUR/USD, GBP/USD, XAU/USD, USD/JPY, dll
2. **Analisis Teknikal**: Support/Resistance, Trend Line, Candlestick Pattern, Indikator (RSI, MACD, Moving Average, Bollinger Bands)
3. **Manajemen Risiko**: Risk-Reward Ratio, Position Sizing, Stop Loss, Take Profit
4. **Psikologi Trading**: Disiplin, mengatasi emosi, trading plan
5. **Strategi Trading**: Scalping, Day Trading, Swing Trading, Position Trading
6. **Platform Trading**: MetaTrader 4/5, TradingView, cTrader
7. **LuxTrade Platform**: Fitur-fitur LuxTrade, cara menggunakan journal, analytics, dll

ATURAN:
- Selalu ingatkan bahwa trading memiliki risiko tinggi
- Jangan pernah memberikan saran spesifik untuk buy/sell pada pair tertentu saat ini
- Fokus pada edukasi dan analisis umum
- Jika user bertanya di luar kemampuan, jelaskan dengan jujur
- Jawaban harus singkat tapi informatif (maks 3-4 paragraf)
- Gunakan format markdown untuk list atau poin-poin penting`

let zaiInstance: InstanceType<typeof ZAI> | null = null

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, sessionId = 'default', context } = body

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Get or create conversation
    let history = conversations.get(sessionId)
    if (!history) {
      history = [
        { role: 'system', content: SYSTEM_PROMPT }
      ]
      conversations.set(sessionId, history)
    }

    // Build context-aware message if trading data is provided
    let userMessage = message
    if (context) {
      userMessage = `${message}\n\n[Context Data: ${JSON.stringify(context).substring(0, 500)}]`
    }

    // Add user message
    history.push({ role: 'user', content: userMessage })

    // Trim old messages to avoid token limits (keep system + last 20 messages)
    if (history.length > 21) {
      history = [history[0], ...history.slice(-20)]
      conversations.set(sessionId, history)
    }

    // Get AI completion
    const zai = await getZAI()
    const completion = await zai.chat.completions.create({
      messages: history,
      thinking: { type: 'disabled' }
    })

    const aiResponse = completion.choices[0]?.message?.content || 'Maaf, saya tidak bisa menjawab saat ini. Coba lagi nanti ya.'

    // Add AI response to history
    history.push({ role: 'assistant', content: aiResponse })

    // Save updated history
    conversations.set(sessionId, history)

    return NextResponse.json({
      success: true,
      response: aiResponse,
      messageCount: history.length - 1
    })
  } catch (error) {
    console.error('AI Chat API error:', error)
    return NextResponse.json(
      { error: 'Failed to get AI response', success: false },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId') || 'default'
    conversations.delete(sessionId)
    return NextResponse.json({ success: true, message: 'Conversation cleared' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to clear conversation' }, { status: 500 })
  }
}
