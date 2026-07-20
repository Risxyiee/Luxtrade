/**
 * HEIC/HEIF to JPEG conversion utility
 * Uses heic2any library for client-side conversion before upload.
 * This prevents sharp crashes on Vercel serverless (HEIC not built-in).
 */

import heic2any from 'heic2any'

/**
 * HEIC/HEIF magic byte signatures.
 * A file starting with "ftyp" box followed by one of these brands = HEIC/HEIF.
 * This is more reliable than file name or MIME type because some files
 * are named .jpeg but actually contain HEIC data internally.
 */
const HEIC_BRANDS = ['heic', 'heix', 'mif1', 'heim', 'hevc', 'hevx']

/**
 * Check if a file is HEIC/HEIF by reading magic bytes.
 * Falls back to name/MIME check if file reading fails.
 */
export async function isHeicFile(file: File): Promise<boolean> {
  try {
    const slice = file.slice(0, 32)
    const buffer = await slice.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    // Convert to string for pattern matching (ASCII-safe portion)
    const header = new TextDecoder('ascii', { fatal: false }).decode(bytes)

    // Look for "ftyp" marker at offset 4
    const ftypIndex = header.indexOf('ftyp')
    if (ftypIndex !== -1) {
      // Brand starts right after "ftyp" (4 chars)
      const brand = header.slice(ftypIndex + 4, ftypIndex + 8).toLowerCase()
      if (HEIC_BRANDS.includes(brand)) {
        console.log(`[heic-detector] Magic bytes match: ftyp/${brand}`)
        return true
      }
    }
  } catch (err) {
    console.warn('[heic-detector] Failed to read magic bytes, falling back to name/MIME check:', err)
  }

  // Fallback: name/MIME check (less reliable but covers edge cases)
  const name = file.name.toLowerCase()
  const type = (file.type || '').toLowerCase()
  const nameMatch = name.endsWith('.heic') || name.endsWith('.heif')
  const mimeMatch = type === 'image/heic' || type === 'image/heif'
    || type.includes('heic') || type.includes('heif')

  return nameMatch || mimeMatch
}

/**
 * Convert a HEIC/HEIF file to JPEG Blob.
 * Wrapped with 15-second timeout to prevent infinite hang.
 *
 * @throws Error with clear message if conversion times out or fails.
 */
export async function convertHeicToJpeg(file: File): Promise<File | Blob> {
  const isHeic = await isHeicFile(file)
  if (!isHeic) {
    return file
  }

  const CONVERSION_TIMEOUT_MS = 15_000

  try {
    const blob = await Promise.race([
      heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.92,
      }),
      new Promise<never>((_resolve, reject) =>
        setTimeout(
          () => reject(new Error(
            'Konversi foto terlalu lama (>15 detik). Coba upload foto lain atau export manual ke JPEG.'
          )),
          CONVERSION_TIMEOUT_MS
        )
      ),
    ])

    // heic2any may return a single Blob or Blob[]
    const result = Array.isArray(blob) ? blob[0] : blob

    // Return as a new File with .jpg extension
    const fileName = file.name.replace(/\.(heic|heif)$/i, '.jpg')
    return new File([result], fileName, { type: 'image/jpeg' })
  } catch (err: any) {
    console.error('[heic2any] Conversion failed:', err.message)
    // Re-throw with user-friendly message (preserves timeout message if that was the cause)
    throw new Error(err.message || 'Gagal mengkonversi foto HEIC ke JPEG. Silakan export foto sebagai JPEG/PNG secara manual, lalu coba upload lagi.')
  }
}