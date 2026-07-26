import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

/**
 * Upload file to server local disk.
 * Files are stored with random unique names (not user-supplied names) to prevent path traversal.
 * GET method is disabled for security — no cross-tenant file listing.
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      )
    }

    // Get form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type (strict allowlist)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' },
        { status: 400 }
      )
    }

    // Validate file extension (defense in depth)
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp']
    const fileExtension = path.extname(file.name).toLowerCase()
    if (!allowedExtensions.includes(fileExtension)) {
      return NextResponse.json(
        { error: 'Invalid file extension.' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      )
    }

    // Create upload directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), 'upload')
    await mkdir(uploadDir, { recursive: true })

    // Generate unique filename — DO NOT use user-supplied filename to prevent path traversal
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 12)
    const uniqueFileName = `${timestamp}_${randomString}${fileExtension}`
    const filePath = path.join(uploadDir, uniqueFileName)

    // SECURITY: Ensure resolved path is still within uploadDir (prevent escape)
    const resolvedPath = path.resolve(filePath)
    const resolvedUploadDir = path.resolve(uploadDir)
    if (!resolvedPath.startsWith(resolvedUploadDir + path.sep)) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 400 }
      )
    }

    // Save file to server
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(resolvedPath, buffer)

    // Return file info — do NOT expose full server path
    return NextResponse.json({
      success: true,
      file: {
        name: uniqueFileName,
        size: file.size,
        type: file.type
      },
      message: 'File uploaded successfully'
    })

  } catch (error) {
    console.error('[File Upload] Error:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}

/**
 * GET method disabled — listing all files would expose cross-tenant data.
 * Use Supabase Storage for per-user file management instead.
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Method Not Allowed' },
    { status: 405 }
  )
}
