/**
 * Hugging Face Vision Model Integration
 * Provides FREE vision analysis using Hugging Face Inference API
 * Models: Qwen2-VL-2B-Instruct (FREE, fast, accurate)
 *
 * Updated: Added proxy support for Vercel to bypass DNS issues
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

// Use proxy for Vercel (production) to bypass DNS issues
const USE_PROXY = process.env.NODE_ENV === 'production'
const PROXY_URL = '/api/proxy/huggingface-vision'

// Edge function as fallback
const USE_EDGE_FUNCTION = process.env.NODE_ENV === 'production'
const EDGE_FUNCTION_URL = '/api/edge/huggingface'

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

  if (!apiKey && !USE_PROXY) {
    throw new Error('HUGGING_FACE_API_TOKEN environment variable is not set')
  }

  // Prepare image data - create base64 data URL
  const imageDataUrl = `data:image/jpeg;base64,${base64Image}`

  console.log(`🤖 [Hugging Face Vision] Analyzing image with model: ${model}`)
  console.log(`🤖 [Hugging Face Vision] Prompt length: ${prompt.length}`)
  console.log(`🤖 [Hugging Face Vision] Using proxy: ${USE_PROXY}`)
  console.log(`🤖 [Hugging Face Vision] Using edge function fallback: ${USE_EDGE_FUNCTION}`)

  // Prepare inputs
  const inputs = {
    image: imageDataUrl,
    question: prompt,
  }

  const parameters = {
    max_new_tokens: 2048,
    temperature: 0.1, // Low temperature for more deterministic JSON output
    return_full_text: false,
  }

  // Retry logic
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      let response: Response
      let data: any

      if (USE_PROXY) {
        // Use proxy API (for production/Vercel)
        console.log(`🌉 [Hugging Face Vision] Using proxy API (attempt ${attempt + 1}/${maxRetries})`)

        const proxyResponse = await fetch(PROXY_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            inputs,
            parameters
          }),
        })

        data = await proxyResponse.json()

        if (!proxyResponse.ok) {
          // Handle specific error cases from proxy
          if (proxyResponse.status === 503 && data.error?.includes('Model is loading')) {
            console.log(`⏳ [Hugging Face Vision] Model loading (attempt ${attempt + 1}/${maxRetries})`)
            if (attempt < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)))
              continue
            }
            throw new Error('Model is loading, please try again in a moment')
          }

          if (proxyResponse.status === 429) {
            console.log(`⚠️ [Hugging Face Vision] Rate limited (attempt ${attempt + 1}/${maxRetries})`)
            if (attempt < maxRetries - 1) {
              const waitTime = 5000 * (attempt + 1)
              await new Promise(resolve => setTimeout(resolve, waitTime))
              continue
            }
            throw new Error('Rate limited by HuggingFace API. Please try again later.')
          }

          if (proxyResponse.status === 503 && data.error?.includes('DNS resolution failed')) {
            console.error(`🌐 [Hugging Face Vision] DNS resolution failed via proxy`)
            console.log(`🔄 [Hugging Face Vision] Trying edge function fallback...`)

            // Try edge function as fallback
            try {
              const edgeResponse = await fetch(EDGE_FUNCTION_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model,
                  imageDataUrl,
                  prompt,
                  parameters
                }),
                signal: AbortSignal.timeout(timeout),
              })

              const edgeData = await edgeResponse.json()

              if (!edgeResponse.ok) {
                throw new Error(edgeData.error || `Edge function error (${edgeResponse.status})`)
              }

              let analyzedText = ''
              if (Array.isArray(edgeData)) {
                analyzedText = edgeData[0]?.generated_text || edgeData[0]?.text || ''
              } else if (typeof edgeData === 'object') {
                analyzedText = edgeData.text || edgeData.generated_text || edgeData.answer || ''
              } else if (typeof edgeData === 'string') {
                analyzedText = edgeData
              }

              if (!analyzedText || analyzedText.trim().length === 0) {
                throw new Error('Empty response from HuggingFace model via edge function')
              }

              console.log(`✅ [Hugging Face Vision] Edge function fallback succeeded`)
              return { text: analyzedText, raw: edgeData.raw }

            } catch (edgeError: any) {
              console.error(`❌ [Hugging Face Vision] Edge function fallback failed:`, edgeError.message)
              throw new Error('Cannot connect to HuggingFace API. Both proxy and edge function failed. DNS resolution failed.')
            }
          }

          throw new Error(data.error || `Proxy error (${proxyResponse.status})`)
        }

        // Proxy returns the data directly
        response = proxyResponse
      } else {
        // Direct API call (for development)
        console.log(`🔗 [Hugging Face Vision] Using direct API (attempt ${attempt + 1}/${maxRetries})`)

        response = await fetch(`${HF_API_URL}/${model}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs,
            parameters
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
            throw new Error('Rate limited by HuggingFace API. Please try again later.')
          }

          // Authentication error
          if (response.status === 401) {
            throw new Error('Invalid HUGGING_FACE_API_TOKEN. Please check your API key.')
          }

          // Other errors
          throw new Error(`Hugging Face API error (${response.status}): ${errorText}`)
        }

        // Parse response
        data = await response.json()
      }

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

      // Handle DNS resolution error (ENOTFOUND)
      if (error.cause?.code === 'ENOTFOUND' || error.cause?.errno === -3007 || error.code === 'ENOTFOUND') {
        console.error(`🌐 [Hugging Face Vision] DNS resolution failed for ${error.cause?.hostname || 'HuggingFace API'}`)
        console.error(`🌐 [Hugging Face Vision] This might be a network/firewall issue on the server`)
        if (attempt === 0) {
          console.error(`🌐 [Hugging Face Vision] API URL: ${HF_API_URL}`)
        }
        throw new Error('Cannot connect to HuggingFace API. DNS resolution failed. Please check your network connection or try again later.')
      }

      // Don't retry on certain errors
      if (error.message?.includes('HUGGING_FACE_API_TOKEN') ||
          error.message?.includes('Invalid') ||
          error.message?.includes('DNS resolution failed')) {
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
    if (!apiKey && !USE_PROXY) return false

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