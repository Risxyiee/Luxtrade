/**
 * Z.ai Image Generation (FREE)
 * Uses z-ai-web-dev-sdk for image generation
 */

import { createZAI } from '@/lib/zai'

export async function generateImageWithZAI(
  prompt: string,
  options: { size?: string; model?: string } = {}
): Promise<string> {
  const { size = '1024x1024', model = 'flux-schnell' } = options

  console.log(`🎨 [Z.ai Image] Generating image: ${prompt.substring(0, 50)}...`)

  try {
    const zai = await createZAI()

    const response = await zai.images.generations.create({
      prompt: prompt,
      model: model,
      size: size as any
    })

    console.log('✅ [Z.ai Image] Image generated successfully')

    const imageUrl = response.data?.[0]?.url

    if (!imageUrl) {
      throw new Error('No image URL returned from Z.ai Image API')
    }

    return imageUrl
  } catch (error: any) {
    console.error('❌ [Z.ai Image] Error:', error.message)
    throw error
  }
}