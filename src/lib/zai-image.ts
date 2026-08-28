/**
 * Z.ai Image Generation (FREE)
 * Uses z-ai-web-dev-sdk for image generation
 */

import { createZAI } from '@/lib/zai'
import type { CreateImageGenerationBody } from 'z-ai-web-dev-sdk'

export async function generateImageWithZAI(
  prompt: string,
  options: { size?: string; model?: string } = {}
): Promise<string> {
  const { size = '1024x1024', model = 'flux-schnell' } = options

  console.log(`🎨 [Z.ai Image] Generating image: ${prompt.substring(0, 50)}...`)

  try {
    const zai = await createZAI()

    const requestBody: CreateImageGenerationBody = {
      prompt: prompt,
      model: model,
      size: size as CreateImageGenerationBody['size']
    }

    const response = await zai.images.generations.create(requestBody)

    console.log('✅ [Z.ai Image] Image generated successfully')

    const imageUrl = response.data?.[0]?.url

    if (!imageUrl) {
      throw new Error('No image URL returned from Z.ai Image API')
    }

    return imageUrl
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('❌ [Z.ai Image] Error:', message)
    throw error
  }
}