import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024
// Allowed file types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']

// Helper: Get authenticated user from request
async function getAuthUser(request: NextRequest): Promise<{ id: string; email: string } | null> {
  try {
    const { supabase } = createClientForApi(request)
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) {
      console.error('❌ [API] Supabase auth error:', error.message)
      return null
    }

    if (!user) {
      console.log('❌ [API] No user found in session')
      return null
    }

    console.log('✅ [API] Authenticated user:', { id: user.id, email: user.email })
    return { id: user.id, email: user.email || '' }
  } catch (error) {
    console.error('❌ [API] Auth error:', error)
    return null
  }
}

// POST - Upload trade image
export async function POST(request: NextRequest) {
  try {
    console.log('🟢 [API /api/trade-upload] Starting image upload...')

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
    const buffer = Buffer.from(bytes)

    // Step 6: Generate unique filename
    const fileExtension = path.extname(file.name) || '.jpg'
    const filename = `${userId}-${randomUUID()}${fileExtension}`

    // Step 7: Create uploads directory if not exists
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'trades')
    await mkdir(uploadsDir, { recursive: true })

    // Step 8: Write file to disk
    const filePath = path.join(uploadsDir, filename)
    await writeFile(filePath, buffer)

    console.log('✅ [API] File saved:', filePath)

    // Step 9: Return public URL
    const publicUrl = `/uploads/trades/${filename}`

    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename,
      size: file.size,
      type: file.type
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