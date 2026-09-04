import { createAdminClient } from '../supabase/admin'

/**
 * Generate a signed URL for a private storage file
 */
export async function generateSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = 3600
): Promise<string | null> {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn)

    if (error) {
      console.error(`Error generating signed URL for ${bucket}/${path}:`, error)
      return null
    }

    return data.signedUrl
  } catch (error) {
    console.error(`Error in generateSignedUrl for ${bucket}/${path}:`, error)
    return null
  }
}

/**
 * Get signed URL for image
 */
export async function getImageUrl(
  bucket: string,
  path: string,
  expiresIn: number = 3600
): Promise<string | null> {
  return await generateSignedUrl(bucket, path, expiresIn)
}
