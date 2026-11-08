import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { edgeCrypto } from '@/lib/edge-crypto'
import { analyzeImageWithZAIVision } from '@/lib/zai-vision'

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024
// Allowed file types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']

/* ============================================================
   VLM AUTO-FILL (best-effort) — AI baca screenshot platform
   trading (MT4/MT5/TradingView/Exness/dll) dan ekstrak field
   jurnal. Jangan pernah gagalkan upload kalau AI-nya gagal —
   user selalu review hasil sebelum simpan (anti-halusinasi).
   ============================================================ */
function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export interface ExtractedTrade {
  symbol: string | null
  type: 'BUY' | 'SELL' | null
  open_price: string | null
  close_price: string | null
  profit_loss: string | null
}

export async function extractTradeFromImage(
  base64Image: string,
  _mimeType: string
): Promise<ExtractedTrade | null> {
  try {
    const raw = await analyzeImageWithZAIVision(
      base64Image,
      'Ini screenshot platform trading (MT4/MT5/TradingView/Exness/broker lain). ' +
        'Ekstrak data SATU trade paling utama/terbaru yang terlihat. ' +
        'Balas HANYA JSON tanpa penjelasan, format persis: ' +
        '{"symbol":"XAUUSD","type":"BUY","open_price":2345.6,"close_price":2350.2,"profit_loss":-12.5} ' +
        'Gunakan null untuk field yang tidak terbaca. profit_loss boleh negatif. ' +
        'Type = arah posisi (BUY/SELL), bukan profit/rugi.'
    )

    const m = (raw.text || '').match(/\{[\s\S]*\}/)
    if (!m) return null
    const obj = JSON.parse(m[0])
    const num = (v: unknown): string | null => {
      if (v === null || v === undefined || v === '') return null
      const n = Number(v)
      return Number.isFinite(n) ? String(n) : null
    }
    return {
      symbol: typeof obj.symbol === 'string' && obj.symbol.trim() ? obj.symbol.trim().toUpperCase().slice(0, 12) : null,
      type: obj.type === 'BUY' || obj.type === 'SELL' ? obj.type : null,
      open_price: num(obj.open_price),
      close_price: num(obj.close_price),
      profit_loss: num(obj.profit_loss),
    }
  } catch (err: any) {
    console.warn('[trade-upload] VLM extraction gagal (non-fatal):', err?.message || err)
    return null
  }
}

// POST - Upload trade image to Supabase Storage
export async function POST(request: NextRequest) {
  try {
    console.log('🟢 [API /api/trade-upload] Starting image upload to Supabase Storage...')

    // Step 1: Authenticate user
    const authResult = await getAuthenticatedUser(request)
    const authUser = authResult.user

    if (!authUser) {
      console.log('❌ [API] Unauthorized - no valid user')
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      )
    }

    const userId = authUser.id

    // Step 2: Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      console.log('❌ [API] No file provided')
      return NextResponse.json(
        { error: 'No file provided. Please upload an image.' },
        { status: 400 }
      )
    }

    // Step 3: Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      console.log('❌ [API] Invalid file type:', file.type)
      return NextResponse.json(
        { error: `Invalid file type "${file.type}". Only JPEG, PNG, and WebP images are supported.` },
        { status: 400 }
      )
    }

    // Step 4: Validate file size
    if (file.size > MAX_FILE_SIZE) {
      console.log('❌ [API] File too large:', file.size, 'bytes')
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` },
        { status: 400 }
      )
    }

    console.log(`📷 [API] Processing file: ${file.name} (${file.type}, ${file.size} bytes)`)

    // Step 5: Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = new Uint8Array(bytes)

    // Step 6: Generate unique filename with user folder structure
    const fileExtension = file.name.split('.').pop() || 'jpg'
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const filename = `${userId}/${timestamp}-${randomSuffix}.${fileExtension}`

    console.log('📦 [API] Uploading to Supabase Storage bucket: trade-screenshots')
    console.log('📦 [API] File path:', filename)

    // Step 7: Upload to Supabase Storage using admin client
    const supabaseAdmin = createAdminClient()

    if (!supabaseAdmin) {
      console.log('❌ [API] Supabase admin client not available')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from('trade-screenshots')
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      console.error('❌ [API] Supabase Storage upload error:', uploadError)
      return NextResponse.json(
        {
          error: 'Failed to upload image to storage',
          details: uploadError.message
        },
        { status: 500 }
      )
    }

    console.log('✅ [API] File uploaded successfully to Supabase Storage:', uploadData.path)

    // Step 8: Generate signed URL (valid for 7 days for private bucket)
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin
      .storage
      .from('trade-screenshots')
      .createSignedUrl(filename, 60 * 60 * 24 * 7) // 7 days

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('❌ [API] Failed to generate signed URL:', signedUrlError)
      return NextResponse.json(
        { error: 'Failed to generate signed URL for uploaded image' },
        { status: 500 }
      )
    }

    console.log('✅ [API] Signed URL generated (valid for 7 days)')

    // Step 9: VLM auto-fill (best-effort) — ekstrak field jurnal dari
    // screenshot. Gagal AI → tetap sukses upload, field kosong.
    let extracted: ExtractedTrade | null = null
    try {
      extracted = await extractTradeFromImage(toBase64(buffer), file.type)
    } catch (e: any) {
      console.warn('[trade-upload] extraction skipped:', e?.message || e)
    }

    // Step 10: Return success response
    return NextResponse.json({
      success: true,
      url: signedUrlData.signedUrl,
      path: filename,
      size: file.size,
      type: file.type,
      bucket: 'trade-screenshots',
      extracted,
    })

  } catch (err) {
    console.error('❌ [API /api/trade-upload POST] Error:', err)
    console.error('Error stack:', err instanceof Error ? err.stack : 'No stack trace')

    return NextResponse.json(
      {
        error: 'Failed to upload image',
        details: err instanceof Error ? err.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}