import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

/**
 * Upload file example to server
 * Saves files to /home/z/my-project/upload/{file_name}
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📤 [File Upload] Starting file upload...')

    // Authenticate user
    const { supabase } = createClientForApi(request)
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      console.log('❌ [File Upload] Unauthorized')
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      )
    }

    console.log(`✅ [File Upload] Authenticated user: ${user.email}`)

    // Get form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      console.log('❌ [File Upload] No file provided')
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    console.log(`📷 [File Upload] Processing file: ${file.name} (${file.size} bytes, ${file.type})`)

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      console.log(`❌ [File Upload] Invalid file type: ${file.type}`)
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      console.log(`❌ [File Upload] File too large: ${file.size} bytes`)
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      )
    }

    // Create upload directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), 'upload')
    await mkdir(uploadDir, { recursive: true })

    // Generate unique filename to avoid conflicts
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 8)
    const fileExtension = path.extname(file.name) || '.jpg'
    const uniqueFileName = `${timestamp}_${randomString}${fileExtension}`
    const filePath = path.join(uploadDir, uniqueFileName)

    // Save file to server
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    console.log(`✅ [File Upload] File saved to: ${filePath}`)

    // Return file info
    return NextResponse.json({
      success: true,
      file: {
        name: uniqueFileName,
        originalName: file.name,
        path: filePath,
        size: file.size,
        type: file.type
      },
      message: 'File uploaded successfully'
    })

  } catch (error) {
    console.error('❌ [File Upload] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to upload file',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Get list of uploaded files
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const { supabase } = createClientForApi(request)
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Read upload directory
    const { readdir } = await import('fs/promises')
    const uploadDir = path.join(process.cwd(), 'upload')
    const files = await readdir(uploadDir)

    // Get file stats
    const { stat } = await import('fs/promises')
    const fileList = await Promise.all(
      files.map(async (fileName) => {
        const filePath = path.join(uploadDir, fileName)
        const stats = await stat(filePath)
        return {
          name: fileName,
          path: filePath,
          size: stats.size,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime
        }
      })
    )

    return NextResponse.json({
      success: true,
      files: fileList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    })

  } catch (error) {
    console.error('❌ [File Upload] Error listing files:', error)
    return NextResponse.json(
      {
        error: 'Failed to list files',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}