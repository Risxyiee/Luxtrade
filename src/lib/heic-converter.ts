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

/** Timeout for reading file header bytes (iCloud offload can be slow) */
const HEADER_READ_TIMEOUT_MS = 8_000

/**
 * Check if a file is HEIC/HEIF by reading magic bytes.
 * Falls back to name/MIME check if file reading fails or times out.
 *
 * The file.slice().arrayBuffer() call is wrapped in a timeout because
 * on iOS with "Optimize iPhone Storage", selecting a photo that lives
 * only in iCloud triggers a download — this can take many seconds and
 * blocks the arrayBuffer() read. The timeout ensures we don't hang forever;
 * if it fires, we fall through to the name/MIME check and treat it as non-HEIC.
 */
export async function isHeicFile(file: File): Promise<boolean> {
  // Quick synchronous check: if file name/type clearly say HEIC and the file
  // was already fully loaded by the browser, we can skip the arrayBuffer read.
  // This avoids hitting the slow path for the common case.
  const name = file.name.toLowerCase()
  const type = (file.type || '').toLowerCase()
  const nameMatch = name.endsWith('.heic') || name.endsWith('.heif')
  const mimeMatch = type === 'image/heic' || type === 'image/heif'
    || type.includes('heic') || type.includes('heif')

  try {
    const buffer = await Promise.race([
      file.slice(0, 32).arrayBuffer(),
      new Promise<ArrayBuffer>((_resolve, reject) =>
        setTimeout(
          () => reject(new Error('HEADER_READ_TIMEOUT')),
          HEADER_READ_TIMEOUT_MS
        )
      ),
    ])

    const bytes = new Uint8Array(buffer)
    const header = new TextDecoder('ascii', { fatal: false }).decode(bytes)

    // Look for "ftyp" marker
    const ftypIndex = header.indexOf('ftyp')
    if (ftypIndex !== -1) {
      const brand = header.slice(ftypIndex + 4, ftypIndex + 8).toLowerCase()
      if (HEIC_BRANDS.includes(brand)) {
        console.log(`[heic-detector] Magic bytes match: ftyp/${brand}`)
        return true
      }
    }

    // Magic bytes say NOT heic — even if name/MIME say heic, trust the bytes
    return false
  } catch (err: any) {
    if (err.message === 'HEADER_READ_TIMEOUT') {
      // Timeout: file read hung (iCloud offload, Safari bug, etc.)
      // CRITICAL: return false, do NOT fall through to name/MIME check.
      // If we returned true here, convertHeicToJpeg would try heic2any
      // on a file whose bytes can't even be read — that would hang too.
      console.warn('[heic-detector] File header read timed out (8s). Assuming non-HEIC to avoid hang.')
      return false
    }
    // Other read errors (not timeout) — fall through to name/MIME check
    console.warn('[heic-detector] Failed to read magic bytes, falling back to name/MIME check:', err.message)
  }

  // Fallback: name/MIME check (only reached on non-timeout read errors)
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
    throw new Error(err.message || 'Gagal mengkonversi foto HEIC ke JPEG. Silakan export foto sebagai JPEG/PNG secara manual, lalu coba upload lagi.')
  }
}