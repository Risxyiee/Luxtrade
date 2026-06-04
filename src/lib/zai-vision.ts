/**
 * Z.ai Vision Model Integration
 * Uses z-ai-web-dev-sdk for image analysis (GLM-4.6v model)
 * This is a working alternative to Hugging Face Vision API
 */

import ZAI from 'z-ai-web-dev-sdk'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

interface VisionAnalysisResult {
  text: string
  raw?: any
}

interface ZAIVisionOptions {
  model?: string
}

// ==================== CONFIGURATION ====================

const DEFAULT_MODEL = 'glm-4.6v'

/**
 * Create Z.ai instance with config loading from files or environment variables
 * This works in both development (with /etc/.z-ai-config) and production (with env vars)
 */
async function createZAIInstance() {
  // Try file-based config first (development environment)
  const homeDir = os.homedir()
  const configPaths = [
    path.join(process.cwd(), '.z-ai-config'),
    path.join(homeDir, '.z-ai-config'),
    '/etc/.z-ai-config'
  ]

  for (const filePath of configPaths) {
    try {
      const configStr = await fs.readFile(filePath, 'utf-8')
      const config = JSON.parse(configStr)
      if (config.baseUrl && config.apiKey) {
        console.log(`📝 [Z.ai Vision] Loaded config from: ${filePath}`)
        return new ZAI(config)
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.log(`⚠️ [Z.ai Vision] Could not read ${filePath}:`, error.message)
      }
    }
  }

  // Fallback: Use environment variables (production environment)
  console.log('📝 [Z.ai Vision] File config not found, trying environment variables...')

  const baseUrl = process.env.ZAI_BASE_URL
  const apiKey = process.env.ZAI_API_KEY
  const chatId = process.env.ZAI_CHAT_ID
  const userId = process.env.ZAI_USER_ID
  const token = process.env.ZAI_TOKEN

  if (!baseUrl) {
    throw new Error('ZAI_BASE_URL environment variable not set')
  }

  if (!apiKey) {
    throw new Error('ZAI_API_KEY environment variable not set')
  }

  const config = {
    baseUrl,
    apiKey,
    chatId,
    userId,
    token
  }

  console.log(`📊 [Z.ai Vision] Using environment config`)
  console.log(`📊 [Z.ai Vision] Base URL: ${baseUrl}`)
  console.log(`📊 [Z.ai Vision] Has API key: true`)

  return new ZAI(config)
}

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

  console.log(`🤖 [Z.ai Vision] Starting analysis with model: ${model}`)
  console.log(`🤖 [Z.ai Vision] Prompt length: ${prompt.length}`)
  console.log(`🤖 [Z.ai Vision] Image size: ${base64Image.length} chars`)

  try {
    console.log(`🔄 [Z.ai Vision] Creating SDK instance...`)
    const zai = await createZAIInstance()

    console.log(`✅ [Z.ai Vision] SDK instance created`)
    console.log(`📊 [Z.ai Vision] Config baseUrl: ${zai.config.baseUrl}`)
    console.log(`📊 [Z.ai Vision] Has apiKey: ${!!zai.config.apiKey}`)

    // Prepare image data URL
    const imageDataUrl = `data:image/jpeg;base64,${base64Image}`

    console.log(`🔄 [Z.ai Vision] Calling Vision API...`)
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

    console.log(`✅ [Z.ai Vision] API call successful`)

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
    console.error(`❌ [Z.ai Vision] Error name:`, error.name)
    console.error(`❌ [Z.ai Vision] Error code:`, error.code)
    throw error
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