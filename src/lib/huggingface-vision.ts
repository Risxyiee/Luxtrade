/**
 * Hugging Face Vision Model Integration
 * Provides FREE vision analysis using Hugging Face Inference API
 * Models: Qwen2-VL-2B-Instruct (FREE, fast, accurate)
 */

interface VisionAnalysisResult {
  text: string
  raw?: any
}

interface HuggingFaceVisionOptions {
  model?: string
  timeout?: number
  maxRetries?: number
}

// ==================== CONFIGURATION ====================

// Default model: Qwen2-VL-2B-Instruct (FREE, fast, good for images)
// Alternative models (all FREE):
// - llava-hf/llava-v1.6-mistral-7b (very good, slower)
// - llava-hf/bakllava-v1-vicuna-7b (fast, good)
const DEFAULT_MODEL = 'Qwen/Qwen2-VL-2B-Instruct'

const HF_API_URL = 'https://api-inference.huggingface.co/models'

// ==================== MAIN FUNCTION ====================

/**
 * Analyze image using Hugging Face Vision Model
 * @param base64Image - Base64 encoded image (without data URL prefix)
 * @param prompt - Text prompt for the vision model
 * @param options - Optional configuration
 * @returns Analyzed text response
 */
export async function analyzeImageWithHuggingFace(
  base64Image: string,
  prompt: string,
  options: HuggingFaceVisionOptions = {}
): Promise<VisionAnalysisResult> {
  const {
    model = DEFAULT_MODEL,
    timeout = 30000, // 30 seconds
    maxRetries = 3
  } = options

  // Get API key from multiple sources
  let apiKey = process.env.HUGGING_FACE_API_TOKEN

  // If not in process.env, try to read from .env file
  if (!apiKey) {
    try {
      const fs = await import('fs')
      const path = await import('path')
      const envPath = path.join(process.cwd(), '.env')
      const envContent = fs.readFileSync(envPath, 'utf-8')
      const match = envContent.match(/HUGGING_FACE_API_TOKEN=([^\s\n]+)/)
      if (match && match[1]) {
        apiKey = match[1]
        console.log('📝 [Hugging Face Vision] Loaded token from .env file')
      }
    } catch (error) {
      console.log('⚠️ [Hugging Face Vision] Could not read .env file')
    }
  }

  if (!apiKey) {
    throw new Error('HUGGING_FACE_API_TOKEN environment variable is not set')
  }

  // Prepare image data - create base64 data URL
  const imageDataUrl = `data:image/jpeg;base64,${base64Image}`

  console.log(`🤖 [Hugging Face Vision] Analyzing image with model: ${model}`)
  console.log(`🤖 [Hugging Face Vision] Prompt length: ${prompt.length}`)

  // Retry logic
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(`${HF_API_URL}/${model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: {
            image: imageDataUrl,
            question: prompt,
          },
          parameters: {
            max_new_tokens: 2048,
            temperature: 0.1, // Low temperature for more deterministic JSON output
            return_full_text: false,
          },
        }),
        signal: AbortSignal.timeout(timeout),
      })

      // Handle specific error cases
      if (!response.ok) {
        const errorText = await response.text()

        // Model loading
        if (response.status === 503) {
          console.log(`⏳ [Hugging Face Vision] Model loading (attempt ${attempt + 1}/${maxRetries})`)
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)))
            continue
          }
          throw new Error('Model is loading, please try again in a moment')
        }

        // Rate limiting
        if (response.status === 429) {
          console.log(`⚠️ [Hugging Face Vision] Rate limited (attempt ${attempt + 1}/${maxRetries})`)
          if (attempt < maxRetries - 1) {
            const waitTime = 5000 * (attempt + 1)
            await new Promise(resolve => setTimeout(resolve, waitTime))
            continue
          }
          throw new Error('Rate limited by Hugging Face API. Please try again later.')
        }

        // Authentication error
        if (response.status === 401) {
          throw new Error('Invalid HUGGING_FACE_API_TOKEN. Please check your API key.')
        }

        // Other errors
        throw new Error(`Hugging Face API error (${response.status}): ${errorText}`)
      }

      // Parse response
      const data = await response.json()

      // Handle different response formats
      let analyzedText = ''

      if (Array.isArray(data)) {
        // Some models return array with generated_text
        analyzedText = data[0]?.generated_text || data[0]?.text || ''
      } else if (typeof data === 'object') {
        // Some models return object with specific fields
        analyzedText = data.generated_text || data.text || data.answer || JSON.stringify(data)
      } else if (typeof data === 'string') {
        analyzedText = data
      }

      if (!analyzedText || analyzedText.trim().length === 0) {
        throw new Error('Empty response from Hugging Face model')
      }

      console.log(`✅ [Hugging Face Vision] Analysis completed: ${analyzedText.length} chars`)

      return {
        text: analyzedText,
        raw: data,
      }

    } catch (error: any) {
      // Handle timeout
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        console.error(`⏰ [Hugging Face Vision] Timeout on attempt ${attempt + 1}/${maxRetries}`)
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000))
          continue
        }
        throw new Error('Analysis timeout. The image might be too complex or the server is busy.')
      }

      // Don't retry on certain errors
      if (error.message?.includes('HUGGING_FACE_API_TOKEN') ||
          error.message?.includes('Invalid')) {
        throw error
      }

      // Log error and retry if not last attempt
      console.error(`❌ [Hugging Face Vision] Error on attempt ${attempt + 1}/${maxRetries}:`, error.message)

      if (attempt === maxRetries - 1) {
        throw error
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)))
    }
  }

  throw new Error('All retry attempts failed')
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Check if Hugging Face Vision service is available
 */
export async function checkHuggingFaceVisionHealth(): Promise<boolean> {
  try {
    const apiKey = process.env.HUGGING_FACE_API_TOKEN
    if (!apiKey) return false

    // Simple health check - try to access the API
    const response = await fetch(`${HF_API_URL}/${DEFAULT_MODEL}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(5000),
    })

    return response.ok || response.status === 404 // 404 means API is reachable
  } catch {
    return false
  }
}

/**
 * Get available vision models list
 */
export function getAvailableVisionModels(): string[] {
  return [
    'Qwen/Qwen2-VL-2B-Instruct', // Fast, good for trading screenshots
    'llava-hf/llava-v1.6-mistral-7b', // Very accurate, slower
    'llava-hf/bakllava-v1-vicuna-7b', // Fast, decent
    'llava-hf/llava-v1.5-7b', // Balanced
  ]
}