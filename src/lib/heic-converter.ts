/**
 * HEIC converter stub.
 * sharp (native binary) doesn't work on Cloudflare Workers.
 * Returns the original file as-is — HEIC support disabled on Edge.
 */

export async function isHeicFile(_file: File): Promise<boolean> {
  return false
}

export async function convertHeicToJpeg(file: File): Promise<File> {
  return file
}
