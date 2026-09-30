import { NextRequest, NextResponse } from 'next/server'
import { geminiChat, isGeminiAvailable } from '@/lib/gemini'
import { createClientForApi } from '@/lib/supabase/server'
import { isUserPro } from '@/lib/pro-check'
import { checkAIQuota, incrementAIQuota, getAIQuotaInfo } from '@/lib/ai-quota'
import { fetchLiveMarketContext, fetchLivePrice } from '@/lib/live-market'

// In-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute
const RATE_LIMIT_MAX = 10 // 10 chat requests per minute

function checkRateLimit(identifier: string): boolean {
  const now = Date.now()
  let entry = rateLimitMap.get(identifier)
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS }
    rateLimitMap.set(identifier, entry)
  }
  entry.count++
  return entry.count <= RATE_LIMIT_MAX
}

/**
 * Detect if user message is asking about a specific asset price
 * Returns matched symbols or null
 */
function detectPriceQuery(message: string): string[] | null {
  const upper = message.toUpperCase()
  const symbols: string[] = []

  // Common forex pairs
  const forexPairs = ['XAUUSD', 'XAGUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'NZDUSD', 'USDCAD', 'USDCHF', 'EURGBP', 'EURJPY', 'GBPJPY']
  for (const pair of forexPairs) {
    if (upper.includes(pair) || upper.includes(pair.slice(0, 3) + '/' + pair.slice(3))) {
      symbols.push(pair)
    }
  }

  // Common crypto
  const cryptoBases = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'DOT', 'AVAX', 'MATIC', 'LINK', 'LTC']
  for (const base of cryptoBases) {
    if (upper.includes(base) && !symbols.some(s => s.includes(base))) {
      symbols.push(base + 'USDT')
    }
  }

  // Keywords that suggest price query
  const priceKeywords = ['HARGA', 'PRICE', 'BERAPA', 'HOW MUCH', 'QUOTES', 'RATE', 'KURS', 'NOW', 'SEKARANG', 'CURRENT', 'LATEST', 'TERKINI', 'LIVE', 'REALTIME', 'REAL-TIME']
  const isPriceQuery = priceKeywords.some(kw => upper.includes(kw))

  // Also detect generic "gold", "silver", "bitcoin", "ethereum"
  if (upper.includes('GOLD') || upper.includes('EMAS')) symbols.push('XAUUSD')
  if (upper.includes('SILVER') || upper.includes('PERAK')) symbols.push('XAGUSD')
  if (upper.includes('BITCOIN') || upper.includes('BTC')) { if (!symbols.includes('BTCUSDT')) symbols.push('BTCUSDT') }
  if (upper.includes('ETHEREUM') || upper.includes('ETH')) { if (!symbols.includes('ETHUSDT')) symbols.push('ETHUSDT') }

  return symbols.length > 0 ? symbols : null
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authResult = await createClientForApi(request)
    const supabase = authResult.supabase
    if (!supabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check Gemini availability
    if (!isGeminiAvailable()) {
      return NextResponse.json({ error: 'AI service not configured (GEMINI_API_KEY missing)' }, { status: 503 })
    }

    // Check AI quota (PRO users have unlimited, free users have 3 trials)
    const quotaCheck = await checkAIQuota(user.id)
    if (quotaCheck.requiresUpgrade) {
      const quotaInfo = await getAIQuotaInfo(user.id)
      return NextResponse.json({
        error: 'Kamu sudah memakai 3 free trial AI. Upgrade ke PRO untuk akses unlimited AI!',
        code: 'QUOTA_EXCEEDED',
        requiresUpgrade: true,
        quotaInfo
      }, { status: 403 })
    }

    // Rate limit by user ID
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in a minute.' },
        { status: 429 }
      )
    }

    const { message, history } = await request.json()

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // ── Fetch live market data for AI context ──
    let liveMarketContext = ''
    const detectedSymbols = detectPriceQuery(message)

    if (detectedSymbols && detectedSymbols.length > 0) {
      // User is asking about specific prices — fetch those
      console.log(`[AI Chat] Price query detected for: ${detectedSymbols.join(', ')}`)
      const priceLines: string[] = []
      const now = new Date()
      priceLines.push(`⏰ Data harga live diambil pada: ${now.toISOString()} (UTC)`)

      for (const symbol of detectedSymbols) {
        const data = await fetchLivePrice(symbol)
        if (data) {
          const changeStr = data.change24h != null ? ` (${data.change24h >= 0 ? '+' : ''}${data.change24h.toFixed(2)}% 24h)` : ''
          priceLines.push(`- ${symbol}: ${data.price}${changeStr} [sumber: ${data.source}]`)
        } else {
          priceLines.push(`- ${symbol}: DATA LIVE TIDAK TERSEDIA — jangan tebak atau gunakan data lama. Katakan jujur bahwa data tidak bisa diakses.`)
        }
      }

      liveMarketContext = priceLines.join('\n')
    } else {
      // General chat — fetch major pairs for background context
      liveMarketContext = await fetchLiveMarketContext()
    }

    // Build system instruction with live data
    const systemInstruction = `You are a professional AI Financial Assistant and Trading Analyst for LuxTradee.

[STRICT RULES — NEVER VIOLATE]
1. ANTI-DUMMY DATA: DILARANG KERAS menggunakan data sampel, data fiktif, atau hardcode untuk harga aset. Jika data live tidak tersedia, katakan dengan JUJUR bahwa data sedang tidak bisa diakses — JANGAN pernah menebak atau menggunakan data lama.
2. REAL-TIME PRICING: Saat pengguna menanyakan harga aset, gunakan data live yang disediakan di bawah. Jika data live untuk aset tersebut tidak ada, katakan: "Data live untuk [ASSET] sedang tidak dapat diakses. Coba beberapa menit lagi."
3. TRANSPARANSI: Selalu cantumkan sumber data dan waktu pengambilan data.
4. Bahasa: Respons dalam Bahasa Indonesia jika user berbahasa Indonesia, English jika user berbahasa Inggris.

[LIVE MARKET DATA — REAL-TIME]
${liveMarketContext}

[END LIVE DATA]

Jika user bertanya harga aset yang TIDAK ada di data live di atas, katakan jujur bahwa data live untuk aset tersebut belum terintegrasi dan sarankan user untuk mengecek di platform trading langsung.`

    // Build messages array for Gemini (no system role in contents)
    const geminiMessages = [
      ...(history || []).map((msg: any) => ({
        role: (msg.role === 'user' ? 'user' : 'model') as 'user' | 'model',
        parts: [{ text: msg.content }]
      })),
      {
        role: 'user' as const,
        parts: [{ text: message }]
      }
    ]

    // Use Gemini with live market data context
    const geminiResult = await geminiChat(geminiMessages, {
      systemInstruction,
      maxTokens: 4096,
    })

    // Increment AI quota after successful response
    await incrementAIQuota(user.id)

    const quotaInfo = await getAIQuotaInfo(user.id)

    return NextResponse.json({
      success: true,
      response: geminiResult.text,
      quotaInfo,
      liveDataUsed: true,
      fetchedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[AI /chat] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    )
  }
}
