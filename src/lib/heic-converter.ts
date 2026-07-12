/**
 * HEIC/HEIF to JPEG conversion utility
 * Uses heic2any library for client-side conversion before upload.
 * This prevents sharp crashes on Vercel serverless (HEIC not built-in).
 */

import heic2any from 'heic2any'

/**
 * Check if a file is HEIC/HEIF format
 */
export function isHeicFile(file: File): boolean {
  const name = file.name.toLowerCase()
  const type = (file.type || '').toLowerCase()
  return (
    name.endsWith('.heic') || name.endsWith('.heif') ||
    type === 'image/heic' || type === 'image/heif' ||
    type.includes('heic') || type.includes('heif')
  )
}

/**
 * Convert a HEIC/HEIF file to JPEG Blob
 * Returns the converted Blob (JPEG) or the original File if no conversion needed
 */
export async function convertHeicToJpeg(file: File): Promise<File | Blob> {
  if (!isHeicFile(file)) {
    return file
  }

  try {
    const blob = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.92,
    })

    // heic2any may return a single Blob or Blob[]
    const result = Array.isArray(blob) ? blob[0] : blob

    // Return as a new File with .jpg extension
    const fileName = file.name.replace(/\.(heic|heif)$/i, '.jpg')
    return new File([result], fileName, { type: 'image/jpeg' })
  } catch (err) {
    console.error('[heic2any] Conversion failed:', err)
    throw new Error(
      'Gagal mengkonversi foto HEIC ke JPEG. Silakan export foto sebagai JPEG/PNG secara manual, lalu coba upload lagi.'
    )
  }
}