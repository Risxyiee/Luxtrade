/**
 * Z.ai Vision Model Integration
 * Uses z-ai-web-dev-sdk for image analysis (GLM-4.6v model)
 * This is a working alternative to Hugging Face Vision API
 */

import ZAI from 'z-ai-web-dev-sdk'

interface VisionAnalysisResult {
  text: string
  raw?: any
}

interface ZAIVisionOptions {
  model?: string
}

// ==================== CONFIGURATION ====================

const DEFAULT_MODEL = 'glm-4.6v'

// ==================== MAIN FUNCTION ====================

/**
 * Analyze image using Z.ai Vision Model (GLM-4.6v)
 * @param base64Image - Base64 encoded image (without data URL prefix)
 * @param prompt - Text prompt for the vision model
 * @param options - Optional configuration
 * @returns Analyzed text response
 */
export async function analyzeImageWithZAIVision(
  base64Image: string,
  prompt: string,
  options: ZAIVisionOptions = {}
): Promise<VisionAnalysisResult> {
  const {
    model = DEFAULT_MODEL
  } = options

  console.log(`🤖 [Z.ai Vision] Analyzing image with model: ${model}`)
  console.log(`🤖 [Z.ai Vision] Prompt length: ${prompt.length}`)

  try {
    // Initialize Z.ai SDK
    const zai = await ZAI.create()

    // Prepare image data URL
    const imageDataUrl = `data:image/jpeg;base64,${base64Image}`

    // Call Vision API
    const response = await zai.chat.completions.createVision({
      model: model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image_url',
              image_url: {
                url: imageDataUrl
              }
            }
          ]
        }
      ],
      thinking: { type: 'disabled' }
    })

    // Extract content from response
    const content = response.choices?.[0]?.message?.content || ''

    if (!content || content.trim().length === 0) {
      throw new Error('Empty response from Z.ai Vision model')
    }

    console.log(`✅ [Z.ai Vision] Analysis completed: ${content.length} chars`)
    console.log(`📊 [Z.ai Vision] Usage:`, response.usage)

    return {
      text: content,
      raw: response
    }

  } catch (error: any) {
    console.error(`❌ [Z.ai Vision] Error:`, error.message)

    // Handle specific error cases
    if (error.message?.includes('Configuration file not found')) {
      throw new Error('Z.ai config not found. Please ensure .z-ai-config is properly set up.')
    }

    if (error.message?.includes('API request failed')) {
      throw new Error('Z.ai API request failed. Please check network connection.')
    }

    throw error
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Check if Z.ai Vision service is available
 */
export async function checkZAIVisionHealth(): Promise<boolean> {
  try {
    const zai = await ZAI.create()
    // Just try to create - if it works, service is available
    return true
  } catch (error: any) {
    console.log('⚠️ [Z.ai Vision] Health check failed:', error.message)
    return false
  }
}

/**
 * Get available vision models
 */
export function getAvailableVisionModels(): string[] {
  return [
    'glm-4.6v', // Default, good for vision tasks
  ]
}