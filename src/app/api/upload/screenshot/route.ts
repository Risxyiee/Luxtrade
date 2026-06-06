import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * API Route: Upload Screenshot to Supabase Storage
 * Uploads trading screenshots to 'trade-screenshots' bucket
 */

// Initialize Supabase admin client with service role key for uploads
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

const BUCKET_NAME = 'trade-screenshots'

export async function POST(request: NextRequest) {
  try {
    console.log('📤 [Upload Screenshot] Starting upload to Supabase Storage...')

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      console.error('❌ [Upload Screenshot] No file provided')
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      console.error('❌ [Upload Screenshot] Invalid file type:', file.type)
      return NextResponse.json(
        { error: 'File must be an image (JPEG, PNG, WebP)' },
        { status: 400 }
      )
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      console.error('❌ [Upload Screenshot] File too large:', file.size)
      return NextResponse.json(
        { error: 'File size must be less than 5MB' },
        { status: 400 }
      )
    }

    // Generate unique file name with timestamp
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 10)
    const fileExt = file.name.split('.').pop()
    const fileName = `${timestamp}_${randomString}.${fileExt}`

    console.log(`📁 [Upload Screenshot] Bucket: ${BUCKET_NAME}, File: ${fileName}`)

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Check if bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
    if (bucketsError) {
      console.error('❌ [Upload Screenshot] Error listing buckets:', bucketsError)
      return NextResponse.json(
        { error: 'Failed to access Supabase Storage' },
        { status: 500 }
      )
    }

    const bucketExists = buckets?.some(b => b.name === BUCKET_NAME)
    if (!bucketExists) {
      console.error(`❌ [Upload Screenshot] Bucket "${BUCKET_NAME}" does not exist`)
      return NextResponse.json(
        { error: `Storage bucket "${BUCKET_NAME}" not found. Please create it in Supabase Dashboard.` },
        { status: 404 }
      )
    }

    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, buffer, {
        contentType: file.type,
        cacheControl: '31536000', // 1 year cache
        upsert: false
      })

    if (uploadError) {
      console.error('❌ [Upload Screenshot] Upload error:', uploadError)
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      )
    }

    console.log('✅ [Upload Screenshot] File uploaded successfully:', uploadData.path)

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName)

    const publicUrl = urlData.publicUrl

    console.log(`🔗 [Upload Screenshot] Public URL: ${publicUrl}`)

    return NextResponse.json({
      success: true,
      url: publicUrl,
      path: fileName,
      bucket: BUCKET_NAME
    })

  } catch (error: any) {
    console.error('❌ [Upload Screenshot] Error:', error)

    // Handle specific errors
    if (error.message?.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json(
        { error: 'Supabase Storage is not configured properly. Please check environment variables.' },
        { status: 503 }
      )
    }

    if (error.message?.includes('bucket does not exist')) {
      return NextResponse.json(
        { error: `Storage bucket "${BUCKET_NAME}" not found. Please create it in Supabase Dashboard.` },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Failed to upload screenshot' },
      { status: 500 }
    )
  }
}