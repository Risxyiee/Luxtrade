import { NextRequest, NextResponse } from 'next/server'
import { geminiChat, isGeminiAvailable } from '@/lib/gemini'

// Force dynamic rendering — prevent CF Workers from caching/stale response
export const dynamic = 'force-dynamic'

// System prompt for LuxTrade CS bot
const SYSTEM_PROMPT = `Kamu adalah asisten customer service LuxTrade — jurnal trading AI untuk trader Indonesia.

TUGASMU:
- Jawab pertanyaan tentang LuxTrade dengan ramah dan profesional
- Bisa bahasa Indonesia dan English
- Jangan pernah kasih harga pasti kalau ga yakin, arahkan ke halaman pricing (#pricing)
- Kalau ditanya hal di luar LuxTrade/trading, bilang kamu cuma CS LuxTrade

ESCALATION KE ADMIN:
- Kalau user minta bicara admin, minta bantuan manusia/live agent, atau pertanyaan yang kamu ga bisa jawab (misal: masalah teknis serius, billing dispute, bug report, permintaan khusus) → WAJIB arahkan ke Telegram @Risxyiee
- Contoh: "Kalau butuh bantuan langsung dari admin, silakan chat Telegram @Risxyiee ya — mereka bisa bantu lebih lanjut! 📱"
- JANGAN pernah bilang kamu bisa handle masalah teknis/billing sendiri — selalu escalate ke Telegram untuk hal serius

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

// In-memory conversation store
const conversations = new Map<string, Array<{role: 'user' | 'model'; content: string}>>()
const MAX_MESSAGES = 20

export async function POST(req: NextRequest) {
  try {
    // CRITICAL: Use req.text() + JSON.parse() instead of req.json()
    // to avoid "Stream already consumed" error in Cloudflare Workers V8 Isolate
    // on the second+ request in the same session.
    const rawBody = await req.text()
    let sessionId: string
    let message: string
    let language: string

    try {
      const parsed = JSON.parse(rawBody)
      sessionId = parsed.sessionId
      message = parsed.message
      language = parsed.language || 'id'
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message required' }, { status: 400 })
    }

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    // Check Gemini availability
    if (!isGeminiAvailable()) {
      console.error('[chat API] GEMINI_API_KEY not configured')
      return NextResponse.json({
        response: language === 'en'
          ? "Sorry, AI service is not configured. Please contact Telegram @Risxyiee."
          : "Maaf, layanan AI belum dikonfigurasi. Hubungi Telegram @Risxyiee."
      }, { status: 503 })
    }

    // Rate limit: max 20 messages per session (40 entries)
    const history = conversations.get(sessionId) || []
    if (history.length > MAX_MESSAGES * 2) {
      return NextResponse.json({
        response: language === 'en'
          ? "You've reached the chat limit. Please contact us on Telegram @Risxyiee for further assistance."
          : "Kamu udah cap batas chat. Hubungi kami di Telegram @Risxyiee untuk bantuan lebih lanjut.",
        limited: true
      })
    }

    // Build Gemini messages from history
    const geminiMessages = [
      ...history.map(msg => ({
        role: msg.role as 'user' | 'model',
        parts: [{ text: msg.content }]
      })),
      { role: 'user' as const, parts: [{ text: message }] }
    ]

    // Call Gemini
    const result = await geminiChat(geminiMessages, {
      model: 'gemini-2.5-flash',
      temperature: 0.7,
      maxTokens: 1024,
      systemInstruction: SYSTEM_PROMPT,
      timeoutMs: 30000,
    })

    const aiResponse = result.text ||
      (language === 'en' ? "Sorry, I couldn't process that. Please try again." : "Maaf, gagal memproses. Coba lagi ya.")

    // Save to history
    const updatedHistory = [
      ...history,
      { role: 'user' as const, content: message },
      { role: 'model' as const, content: aiResponse }
    ]
    // Trim old messages if too long
    if (updatedHistory.length > MAX_MESSAGES * 2) {
      conversations.set(sessionId, updatedHistory.slice(-MAX_MESSAGES))
    } else {
      conversations.set(sessionId, updatedHistory)
    }

    return NextResponse.json({ response: aiResponse })
  } catch (error: any) {
    // Descriptive error logging for Cloudflare Workers diagnostics
    console.error('[chat API] Error:', {
      name: error?.name || 'Unknown',
      message: error?.message || 'No message',
      code: error?.code || 'N/A',
      stack: error?.stack?.substring(0, 300) || 'No stack',
    })

    const isTimeout = error instanceof Error && (
      error.message.includes('timed out') ||
      error.message.includes('Abort') ||
      error.name === 'TimeoutError'
    )
    const isKeyError = error instanceof Error && (
      error.message.includes('API_KEY') ||
      error.message.includes('not configured')
    )
    const errMsg = isTimeout
      ? 'Maaf, respon terlalu lama. Coba lagi atau hubungi Telegram @Risxyiee.'
      : isKeyError
        ? 'Maaf, layanan AI belum dikonfigurasi. Hubungi Telegram @Risxyiee.'
        : 'Maaf, sedang gangguan. Coba lagi atau hubungi Telegram @Risxyiee.'

    return NextResponse.json({ response: errMsg }, { status: isTimeout ? 504 : isKeyError ? 503 : 500 })
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: isGeminiAvailable() ? 'ok' : 'not_configured',
    provider: 'gemini',
    model: 'gemini-2.5-flash',
  })
}
