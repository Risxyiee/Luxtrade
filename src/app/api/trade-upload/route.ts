import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { edgeCrypto } from '@/lib/edge-crypto'

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024
// Allowed file types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']

// POST - Upload trade image to Supabase Storage
export async function POST(request: NextRequest) {
  try {
    console.log('🟢 [API /api/trade-upload] Starting image upload to Supabase Storage...')

    // Step 1: Authenticate user
    const authUser = await getAuthUser(request)

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

    // Step 9: Return success response
    return NextResponse.json({
      success: true,
      url: signedUrlData.signedUrl,
      path: filename,
      size: file.size,
      type: file.type,
      bucket: 'trade-screenshots'
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