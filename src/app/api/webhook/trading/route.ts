import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Universal Trading Webhook Endpoint
 * Menerima data transaksi dari berbagai sumber (FxBlue, Myfxbook, dll)
 * dan menyimpannya ke database Supabase
 */

// Initialize Supabase Admin Client (bypasses RLS for trusted webhooks)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

/**
 * FxBlue webhook format
 */
interface FxBlueTrade {
  accountNumber: string
  ticket: string
  symbol: string
  type: 'buy' | 'sell'
  lot: number
  openPrice: number
  closePrice: number | null
  openTime: string
  closeTime: string | null
  profit: number
  commission: number
  swap: number
  comment: string
}

/**
 * Myfxbook webhook format
 */
interface MyfxbookTrade {
  accountId: string
  tradeId: string
  symbol: string
  action: 'buy' | 'sell'
  lots: number
  openPrice: number
  closePrice: number | null
  openDate: string
  closeDate: string | null
  profit: number
  comment?: string
}

/**
 * Generic trade format for database
 */
interface TradeData {
  user_id: string
  account_number: string
  ticket: string
  symbol: string
  type: string
  lot: number
  open_price: number
  close_price: number | null
  open_time: string
  close_time: string | null
  profit: number
  commission: number
  swap: number
  comment: string
  source: 'fxblue' | 'myfxbook' | 'custom'
  status: 'open' | 'closed'
}

/**
 * Parser untuk FxBlue format
 */
function parseFxBlueTrade(data: any): TradeData {
  return {
    user_id: data.userId || '', // Harus dikirim dari FxBlue sebagai custom field
    account_number: data.accountNumber || data.account || '',
    ticket: data.ticket || data.tradeId || Date.now().toString(),
    symbol: data.symbol || '',
    type: data.type?.toLowerCase() === 'buy' ? 'buy' : 'sell',
    lot: parseFloat(data.lot || data.lots || '0'),
    open_price: parseFloat(data.openPrice || data.openPrice || '0'),
    close_price: data.closePrice ? parseFloat(data.closePrice) : null,
    open_time: data.openTime || data.openDate || new Date().toISOString(),
    close_time: data.closeTime || data.closeDate || null,
    profit: parseFloat(data.profit || '0'),
    commission: parseFloat(data.commission || '0'),
    swap: parseFloat(data.swap || '0'),
    comment: data.comment || '',
    source: 'fxblue',
    status: data.closeTime || data.closePrice ? 'closed' : 'open'
  }
}

/**
 * Parser untuk Myfxbook format
 */
function parseMyfxbookTrade(data: any): TradeData {
  return {
    user_id: data.userId || '', // Harus dikirim dari Myfxbook sebagai custom field
    account_number: data.accountId || data.account || '',
    ticket: data.tradeId || data.ticket || Date.now().toString(),
    symbol: data.symbol || '',
    type: data.action?.toLowerCase() === 'buy' ? 'buy' : 'sell',
    lot: parseFloat(data.lots || data.lot || '0'),
    open_price: parseFloat(data.openPrice || '0'),
    close_price: data.closePrice ? parseFloat(data.closePrice) : null,
    open_time: data.openDate || data.openTime || new Date().toISOString(),
    close_time: data.closeDate || data.closeTime || null,
    profit: parseFloat(data.profit || '0'),
    commission: 0,
    swap: 0,
    comment: data.comment || '',
    source: 'myfxbook',
    status: data.closeDate || data.closePrice ? 'closed' : 'open'
  }
}

/**
 * Parser untuk format custom/generic
 */
function parseCustomTrade(data: any): TradeData {
  return {
    user_id: data.userId || data.user_id || '',
    account_number: data.accountNumber || data.account_number || data.account || '',
    ticket: data.ticket || data.tradeId || Date.now().toString(),
    symbol: data.symbol || '',
    type: data.type?.toLowerCase() === 'buy' ? 'buy' : 'sell',
    lot: parseFloat(data.lot || data.lots || '0'),
    open_price: parseFloat(data.openPrice || data.open_price || '0'),
    close_price: data.closePrice || data.close_price ? parseFloat(data.closePrice || data.close_price) : null,
    open_time: data.openTime || data.open_time || new Date().toISOString(),
    close_time: data.closeTime || data.close_time || null,
    profit: parseFloat(data.profit || '0'),
    commission: parseFloat(data.commission || '0'),
    swap: parseFloat(data.swap || '0'),
    comment: data.comment || '',
    source: 'custom',
    status: data.closeTime || data.close_time || data.closePrice ? 'closed' : 'open'
  }
}

/**
 * Mendeteksi source dan memilih parser yang tepat
 */
function detectAndParseTrade(data: any): TradeData | null {
  if (!data) return null

  try {
    // Deteksi FxBlue
    if (data.accountNumber && data.ticket && data.type && data.lot) {
      return parseFxBlueTrade(data)
    }

    // Deteksi Myfxbook
    if (data.accountId && data.tradeId && data.action && data.lots) {
      return parseMyfxbookTrade(data)
    }

    // Gunakan parser custom untuk format lain
    if (data.symbol && data.profit !== undefined) {
      return parseCustomTrade(data)
    }

    return null
  } catch (error) {
    console.error('[WEBHOOK] Parse error:', error)
    return null
  }
}

/**
 * Validasi data sebelum disimpan
 */
function validateTrade(trade: TradeData): { valid: boolean; error?: string } {
  if (!trade.user_id) {
    return { valid: false, error: 'Missing userId' }
  }

  if (!trade.account_number) {
    return { valid: false, error: 'Missing account number' }
  }

  if (!trade.symbol) {
    return { valid: false, error: 'Missing symbol' }
  }

  if (!trade.ticket) {
    return { valid: false, error: 'Missing ticket/trade ID' }
  }

  if (trade.lot <= 0) {
    return { valid: false, error: 'Invalid lot size' }
  }

  return { valid: true }
}

/**
 * GET - Verifikasi webhook endpoint aktif
 */
export async function GET(req: NextRequest) {
  return NextResponse.json({
    status: 'active',
    message: 'Trading webhook endpoint is ready',
    timestamp: new Date().toISOString(),
    sources: ['fxblue', 'myfxbook', 'custom']
  })
}

/**
 * POST - Terima data transaksi dari webhook
 */
export async function POST(req: NextRequest) {
  try {
    // Webhook secret verification
    const webhookSecret = process.env.WEBHOOK_SECRET
    if (webhookSecret) {
      const authHeader = req.headers.get('authorization') || req.headers.get('x-webhook-secret')
      if (authHeader !== `Bearer ${webhookSecret}`) {
        return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 })
      }
    }

    // Log incoming request
    console.log('[WEBHOOK] Received POST request')

    // Get source from query parameter or header
    const source = req.nextUrl.searchParams.get('source') ||
                   req.headers.get('X-Webhook-Source') ||
                   'custom'

    // Parse request body
    let rawData
    const contentType = req.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      rawData = await req.json()
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData()
      rawData = {}
      formData.forEach((value, key) => {
        rawData[key] = value
      })
    } else {
      // Coba parse sebagai JSON jika tidak ada content-type
      const text = await req.text()
      rawData = text ? JSON.parse(text) : {}
    }

    console.log('[WEBHOOK] Raw data:', JSON.stringify(rawData, null, 2))

    // Handle single trade
    if (!Array.isArray(rawData)) {
      const parsedTrade = detectAndParseTrade({ ...rawData, source })
      if (!parsedTrade) {
        return NextResponse.json(
          { error: 'Unable to parse trade data', rawData },
          { status: 400 }
        )
      }

      // Validasi
      const validation = validateTrade(parsedTrade)
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error, trade: parsedTrade },
          { status: 400 }
        )
      }

      // Cek apakah trade sudah ada (based on ticket + account)
      const { data: existingTrade, error: checkError } = await supabaseAdmin
        .from('trades')
        .select('id')
        .eq('ticket', parsedTrade.ticket)
        .eq('account_number', parsedTrade.account_number)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('[WEBHOOK] Database check error:', checkError)
        return NextResponse.json(
          { error: 'Database error', details: checkError.message },
          { status: 500 }
        )
      }

      // Insert atau update trade
      let result
      if (existingTrade) {
        // Update jika trade sudah ada (untuk update profit/price yang berubah)
        const { data, error } = await supabaseAdmin
          .from('trades')
          .update({
            close_price: parsedTrade.close_price,
            close_time: parsedTrade.close_time,
            profit: parsedTrade.profit,
            status: parsedTrade.status,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingTrade.id)
          .select()
          .single()

        if (error) throw error
        result = data
        console.log('[WEBHOOK] Trade updated:', result.id)
      } else {
        // Insert baru
        const { data, error } = await supabaseAdmin
          .from('trades')
          .insert({
            user_id: parsedTrade.user_id,
            account_number: parsedTrade.account_number,
            ticket: parsedTrade.ticket,
            symbol: parsedTrade.symbol,
            type: parsedTrade.type,
            lot: parsedTrade.lot,
            open_price: parsedTrade.open_price,
            close_price: parsedTrade.close_price,
            open_time: parsedTrade.open_time,
            close_time: parsedTrade.close_time,
            profit: parsedTrade.profit,
            commission: parsedTrade.commission,
            swap: parsedTrade.swap,
            comment: parsedTrade.comment,
            source: parsedTrade.source,
            status: parsedTrade.status,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (error) throw error
        result = data
        console.log('[WEBHOOK] Trade created:', result.id)
      }

      return NextResponse.json({
        success: true,
        message: 'Trade processed successfully',
        trade: result
      })
    }

    // Handle batch of trades (array)
    const results = []
    const errors = []

    for (const item of rawData) {
      const parsedTrade = detectAndParseTrade({ ...item, source })
      if (!parsedTrade) {
        errors.push({ error: 'Unable to parse', data: item })
        continue
      }

      const validation = validateTrade(parsedTrade)
      if (!validation.valid) {
        errors.push({ error: validation.error, trade: parsedTrade })
        continue
      }

      // Cek duplikat
      const { data: existingTrade } = await supabaseAdmin
        .from('trades')
        .select('id')
        .eq('ticket', parsedTrade.ticket)
        .eq('account_number', parsedTrade.account_number)
        .single()

      let result
      if (existingTrade) {
        const { data } = await supabaseAdmin
          .from('trades')
          .update({
            close_price: parsedTrade.close_price,
            close_time: parsedTrade.close_time,
            profit: parsedTrade.profit,
            status: parsedTrade.status,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingTrade.id)
          .select()
          .single()

        result = data
      } else {
        const { data, error } = await supabaseAdmin
          .from('trades')
          .insert({
            user_id: parsedTrade.user_id,
            account_number: parsedTrade.account_number,
            ticket: parsedTrade.ticket,
            symbol: parsedTrade.symbol,
            type: parsedTrade.type,
            lot: parsedTrade.lot,
            open_price: parsedTrade.open_price,
            close_price: parsedTrade.close_price,
            open_time: parsedTrade.open_time,
            close_time: parsedTrade.close_time,
            profit: parsedTrade.profit,
            commission: parsedTrade.commission,
            swap: parsedTrade.swap,
            comment: parsedTrade.comment,
            source: parsedTrade.source,
            status: parsedTrade.status,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (error) {
          errors.push({ error: error.message, trade: parsedTrade })
          continue
        }

        result = data
      }

      results.push(result)
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} trades successfully`,
      processed: results.length,
      errors: errors.length,
      trades: results,
      errorDetails: errors
    })

  } catch (error: any) {
    console.error('[WEBHOOK] Error processing webhook:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
