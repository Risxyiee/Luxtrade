import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

// System prompt for LuxTrade CS bot
const SYSTEM_PROMPT = `Kamu adalah asisten customer service LuxTrade — jurnal trading AI untuk trader Indonesia.

TUGASMU:
- Jawab pertanyaan tentang LuxTrade dengan ramah dan profesional
- Bisa bahasa Indonesia dan English
- Jangan pernah kasih harga pasti kalau ga yakin, arahkan ke halaman pricing (#pricing)
- Kalau ditanya hal di luar LuxTrade/trading, bilang kamu cuma CS LuxTrade

INFO PRODUK:
- LuxTrade = jurnal trading AI untuk prop firm traders
- Paket Gratis: 10 trade/bulan, 10 AI queries/bulan, analitik dasar
- Paket PRO: Rp39K/bulan, unlimited trades, AI pattern detection, auto extract screenshot MT5/TV, equity curve, export CSV/PDF, psychology tracking
- AI Vision: upload screenshot MT5/TradingView → auto extract data trade
- AI Pattern Detection: deteksi pola loss berulang (FOMO, overtrading, dll)
- Payment: Midtrans (IDR), Skrill (USD)
- Support: Telegram @Risxyiee, email luxtradee@gmail.com, Discord
- Ada program afiliasi dan partnership FundingTraders
- Bisa import dari MT4/MT5/cTrader via CSV atau screenshot
- Data aman, terenkripsi, nggak dijual ke pihak ketiga
- No auto-renew, bisa cancel kapan pun
- Non-refundable (produk digital)

GAYA JAWAB:
- Singkat, to the point, tapi ramah
- Pakai emoji secukupnya
- Kalau ga yakin, arahkan ke Telegram @Risxyiee atau Discord`

// In-memory conversation store (simple, no persistence needed for landing page CS)
const conversations = new Map<string, Array<{role: string; content: string}>>()
const MAX_MESSAGES = 20

// Singleton ZAI instance
let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, message, language } = await req.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message required' }, { status: 400 })
    }

    // Rate limit: max 50 messages per session
    const history = conversations.get(sessionId) || []
    if (history.length > MAX_MESSAGES * 2) {
      return NextResponse.json({ 
        response: language === 'en' 
          ? "You've reached the chat limit. Please contact us on Telegram @Risxyiee for further assistance." 
          : "Kamu udah cap batas chat. Hubungi kami di Telegram @Risxyiee untuk bantuan lebih lanjut.",
        limited: true 
      })
    }

    const zai = await getZAI()

    // Build messages array
    const messages = [
      { role: 'assistant', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: message }
    ]

    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: 'disabled' }
    })

    const aiResponse = completion.choices?.[0]?.message?.content || 
      (language === 'en' ? "Sorry, I couldn't process that. Please try again." : "Maaf, gagal memproses. Coba lagi ya.")

    // Save to history
    const updatedHistory = [
      ...history,
      { role: 'user', content: message },
      { role: 'assistant', content: aiResponse }
    ]
    // Trim old messages if too long
    if (updatedHistory.length > MAX_MESSAGES * 2) {
      conversations.set(sessionId, updatedHistory.slice(-MAX_MESSAGES))
    } else {
      conversations.set(sessionId, updatedHistory)
    }

    return NextResponse.json({ response: aiResponse })
  } catch (error) {
    console.error('[chat API] Error:', error)
    return NextResponse.json({ 
      response: 'Maaf, sedang gangguan. Coba lagi atau hubungi Telegram @Risxyiee.' 
    }, { status: 500 })
  }
}
