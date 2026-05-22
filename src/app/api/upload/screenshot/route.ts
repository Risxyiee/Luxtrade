import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

// Supabase Storage configuration
const BUCKET_NAME = 'trade-screenshots'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://klxkdrfsfcoankbaoejn.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Create admin client for upload operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Helper: Upload image to Supabase Storage
async function uploadToSupabaseStorage(file: File, userId: string): Promise<string> {
  try {
    // Generate unique filename
    const timestamp = Date.now()
    const extension = file.name.split('.').pop() || 'png'
    const filename = `${userId}/${timestamp}.${extension}`

    console.log('📤 Uploading to Supabase Storage:', filename)

    // Upload to bucket
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(filename, file, {
        upsert: true,
        contentType: file.type
      })

    if (error) {
      console.error('❌ Upload error:', error)
      throw error
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filename)

    console.log('✅ Upload successful:', publicUrl)
    return publicUrl

  } catch (error) {
    console.error('❌ Upload to Supabase Storage failed:', error)
    throw new Error('Failed to upload screenshot to storage')
  }
}

// Helper: Get authenticated user
async function getAuthUser(request: NextRequest): Promise<{ id: string } | null> {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return null

    const token = authHeader.replace('Bearer ', '')

    // Use admin client to verify token
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

    if (error || !user) {
      console.error('Auth error:', error)
      return null
    }

    return { id: user.id }
  } catch (error) {
    console.error('Auth verification error:', error)
    return null
  }
}

// POST - Upload screenshot
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'Please login to upload screenshots'
      }, { status: 401 })
    }

    // Check if bucket exists, if not create it
    try {
      const { data: buckets } = await supabaseAdmin.storage.listBuckets()
      const bucketExists = buckets?.some(b => b.name === BUCKET_NAME)

      if (!bucketExists) {
        console.log('📦 Creating bucket:', BUCKET_NAME)
        const { error: createError } = await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
          public: true,
          fileSizeLimit: 5 * 1024 * 1024 // 5MB limit
        })

        if (createError) {
          console.error('❌ Bucket creation error:', createError)
          // Try to continue anyway
        }
      }
    } catch (bucketError) {
      console.warn('⚠️ Bucket check error (continuing):', bucketError)
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({
        error: 'No file provided',
        message: 'Please select a file to upload'
      }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({
        error: 'Invalid file type',
        message: 'Please upload an image file'
      }, { status: 400 })
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({
        error: 'File too large',
        message: 'Maximum file size is 5MB'
      }, { status: 400 })
    }

    // Upload to Supabase Storage
    const publicUrl = await uploadToSupabaseStorage(file, authUser.id)

    return NextResponse.json({
      success: true,
      url: publicUrl,
      message: 'Screenshot uploaded successfully'
    })

  } catch (error) {
    console.error('Screenshot upload error:', error)
    return NextResponse.json({
      error: 'Upload failed',
      message: error instanceof Error ? error.message : 'Failed to upload screenshot'
    }, { status: 500 })
  }
}
