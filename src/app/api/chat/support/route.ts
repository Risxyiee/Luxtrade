import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { callLLM, getLLMChainStatus, getLLMProviderName, type ConversationTurn } from '@/lib/ai-llm'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// System prompt for LuxTradee Dashboard CS bot (enhanced with user context)
const getSystemPrompt = (userContext: string) => `Kamu adalah asisten customer service LuxTradee — jurnal trading AI untuk trader Indonesia.

KONTEKS USER SAAT INI:
${userContext}

TUGASMU:
- Jawab pertanyaan tentang LuxTradee dengan ramah dan profesional
- Bisa bahasa Indonesia dan English
- Bantu user yang sudah login dengan masalah teknis, billing, fitur, atau pertanyaan umum
- Kalau user tanya tentang fitur PRO, jelaskan manfaat dan cara upgrade
- Kalau user free plan minta fitur PRO, arahkan ke upgrade
- Jangan pernah kasih harga pasti kalau ga yakin, arahkan ke halaman pricing
- Kalau ditanya hal di luar LuxTradee/trading, bilang kamu cuma CS LuxTradee

ESCALATION KE ADMIN:
- Kalau user minta bicara admin, minta bantuan manusia/live agent, atau pertanyaan yang kamu ga bisa jawab (misal: masalah teknis serius, billing dispute, bug report, permintaan khusus) → WAJIB arahkan ke Telegram @Risxyiee
- Contoh: "Kalau butuh bantuan langsung dari admin, silakan chat Telegram @Risxyiee ya — mereka bisa bantu lebih lanjut! 📱"
- JANGAN pernah bilang kamu bisa handle masalah teknis/billing sendiri — selalu escalate ke Telegram untuk hal serius

INFO PRODUK:
- LuxTradee = jurnal trading AI untuk prop firm traders
- Paket Gratis: 10 trade/bulan, 10 AI queries/bulan, analitik dasar
- Paket PRO: Rp49K/bulan, unlimited trades, AI pattern detection, auto extract screenshot MT5/TV, equity curve, export CSV/PDF, psychology tracking
- AI Vision: upload screenshot MT5/TradingView → auto extract data trade
- AI Pattern Detection: deteksi pola loss berulang (FOMO, overtrading, dll)
- Payment: Midtrans (QRIS, Virtual Account, e-wallet — via Midtrans Snap)
- Support: Telegram @Risxyiee, email luxtradee@gmail.com, Discord
- Bisa import dari MT4/MT5/cTrader via CSV atau screenshot
- Data aman, terenkripsi, nggak dijual ke pihak ketiga
- No auto-renew, bisa cancel kapan pun
- Non-refundable (produk digital)

FITUR DASHBOARD YANG BISA DIBANTU:
- Tab Dashboard: overview stats, equity curve, recent trades
- Tab Trades: add/edit/delete/duplicate trades, import CSV/screenshot
- Tab Accounts: manage multiple trading accounts
- Tab Journal: catatan jurnal harian
- Tab Watchlist: pantau pair forex/crypto
- Tab Analytics: performance analysis, win rate, PnL
- Tab AI Insights: AI coach chat, recommendations, chart analysis, voice journal (PRO)
- Tab Psychology: emotional tracking per trade
- Tab Heatmap: trading heatmap by day/hour
- Tab Calendar: trading calendar
- Tab Risk Calculator: hitung risk per trade
- Tab Targets: set trading goals
- Tab Market News: berita pasar + sentiment
- Tab Community: leaderboard, share trades

GAYA JAWAB:
- Singkat, to the point, tapi ramah
- Pakai emoji secukupnya
- Kalau ga yakin, arahkan ke Telegram @Risxyiee atau Discord
- Karena user udah login, kamu bisa pakai nama mereka kalau ada di konteks`

// In-memory conversation store (separate from landing page CS bot)
const conversations = new Map<string, Array<{role: 'user' | 'model'; content: string}>>()
const MAX_MESSAGES = 30 // Dashboard users get more messages

export async function POST(req: NextRequest) {
  try {
    // Rate limit anti-scan biaya AI: endpoint ini terbuka utk tamu
    // (chat dukungan landing) → 15 pesan/menit per IP
    const limited = checkRateLimit(req, 'chat-support', {
      maxRequests: 15,
      windowMs: 60_000,
      message: 'Terlalu banyak pesan. Istirahat sebentar ya 😊',
    })
    if (limited) return limited

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

    // ── OTAK: RANTAI SELF-HEALING (fix Gemini 429 free tier — sama dgn /api/chat) ──
    if ((await getLLMProviderName()) === 'template') {
      console.error('[chat/support API] Tidak ada LLM API key (MORTERA/GROQ/GEMINI/OPENROUTER)')
      return NextResponse.json({
        response: language === 'en'
          ? "Sorry, AI service is not configured. Please contact Telegram @Risxyiee."
          : "Maaf, layanan AI belum dikonfigurasi. Hubungi Telegram @Risxyiee."
      }, { status: 503 })
    }

    // Try to get user context from auth
    let userContext = 'User belum login (guest)'
    try {
      const { supabase } = await createClientForApi(req)
      
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          // Get profile for more context
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, subscription_status, is_pro')
            .eq('id', user.id)
            .single()

          const name = profile?.full_name || user.email?.split('@')[0] || 'User'
          const plan = profile?.is_pro ? 'PRO' : 'Gratis'
          const email = user.email || 'unknown'
          
          userContext = `User SUDAH LOGIN
- Nama: ${name}
- Email: ${email}
- Plan: ${plan}
- Subscription: ${profile?.subscription_status || 'FREE'}`
        }
      }
    } catch (err) {
      // Auth check failed — treat as guest (non-blocking)
      console.warn('[chat/support API] Auth check failed, treating as guest:', err)
    }

    // Rate limit: max 30 messages per session (60 entries)
    const history = conversations.get(sessionId) || []
    if (history.length > MAX_MESSAGES * 2) {
      return NextResponse.json({
        response: language === 'en'
          ? "You've reached the chat limit. Please contact us on Telegram @Risxyiee for further assistance."
          : "Kamu udah cap batas chat. Hubungi kami di Telegram @Risxyiee untuk bantuan lebih lanjut.",
        limited: true
      })
    }

    // Build system prompt with user context
    const systemPrompt = getSystemPrompt(userContext)

    // Riwayat chat → ConversationTurn untuk rantai LLM (bukan Gemini doang)
    const turns: ConversationTurn[] = [
      ...history.map((msg): ConversationTurn => ({
        role: msg.role === 'model' ? 'assistant' : 'user',
        content: msg.content,
      })),
      { role: 'user', content: message },
    ]

    // Panggil rantai LLM self-healing: Mortera → Groq → Gemini → OpenRouter
    const result = await callLLM(systemPrompt, turns, 1024)

    if (!result || !result.text?.trim()) {
      console.error('[chat/support API] Semua provider LLM gagal:', (result?.notes || []).join(' | '))
      return NextResponse.json({
        response: language === 'en'
          ? "Sorry, our AI assistant is resting for a moment. Try again soon or contact Telegram @Risxyiee."
          : "Maaf, asisten AI kami lagi istirahat sebentar. Coba lagi beberapa saat atau hubungi Telegram @Risxyiee.",
        aiUnavailable: true,
      }, { status: 503 })
    }

    const aiResponse = result.text

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

    return NextResponse.json({ response: aiResponse, via: `${result.provider}/${result.model}` })
  } catch (error: any) {
    console.error('[chat/support API] Error:', {
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

// Health check — status rantai provider
export async function GET() {
  let chain: Awaited<ReturnType<typeof getLLMChainStatus>> = []
  try { chain = await getLLMChainStatus() } catch { /* diagnostik opsional */ }
  return NextResponse.json({
    status: chain.some((c) => c.ok) ? 'ok' : 'no_provider_available',
    provider: 'chain: mortera → groq → gemini → openrouter (self-healing)',
    type: 'dashboard-support',
    chain,
  })
}
