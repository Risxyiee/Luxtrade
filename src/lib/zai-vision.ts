/**
 * Z.ai Vision Model Integration
 * Uses z-ai-web-dev-sdk for image analysis (GLM-4.6v model)
 * Singleton pattern — no file I/O on hot path
 */

import ZAI from 'z-ai-web-dev-sdk'

interface VisionAnalysisResult {
  text: string
  raw?: any
}

interface ZAIVisionOptions {
  model?: string
}

const DEFAULT_MODEL = 'glm-4.6v'

// ==================== SINGLETON ====================

let _zaiInstance: InstanceType<typeof ZAI> | null = null

function getZAIInstance(): InstanceType<typeof ZAI> {
  if (_zaiInstance) return _zaiInstance

  const baseUrl = process.env.ZAI_BASE_URL
  const apiKey = process.env.ZAI_API_KEY

  if (!baseUrl || !apiKey) {
    throw new Error('ZAI_BASE_URL and ZAI_API_KEY environment variables are required')
  }

  _zaiInstance = new ZAI({ baseUrl, apiKey })
  return _zaiInstance
}

// ==================== MAIN FUNCTION ====================

/**
 * Analyze image using Z.ai Vision Model (GLM-4.6v)
 */
export async function analyzeImageWithZAIVision(
  base64Image: string,
  prompt: string,
  options: ZAIVisionOptions = {}
): Promise<VisionAnalysisResult> {
  const { model = DEFAULT_MODEL } = options

  const zai = getZAIInstance()

  // Auto-detect MIME type from base64 header
  let mimeType = 'image/jpeg'
  if (base64Image.startsWith('/9j/')) mimeType = 'image/jpeg'
  else if (base64Image.startsWith('iVBOR')) mimeType = 'image/png'
  else if (base64Image.startsWith('R0lGOD')) mimeType = 'image/gif'
  else if (base64Image.startsWith('UklGR')) mimeType = 'image/webp'

  const imageDataUrl = `data:${mimeType};base64,${base64Image}`

  const response = await zai.chat.completions.createVision({
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageDataUrl } }
        ]
      }
    ],
    thinking: { type: 'disabled' }
  })

  const content = response.choices?.[0]?.message?.content || ''
  if (!content.trim()) {
    throw new Error('Empty response from Z.ai Vision model')
  }

  return { text: content, raw: response }
}

export function getAvailableVisionModels(): string[] {
  return ['glm-4.6v']
}