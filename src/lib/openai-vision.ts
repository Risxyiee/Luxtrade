/**
 * OpenAI API Helper
 * Includes Vision (image analysis) and Chat (text generation) capabilities
 * Direct implementation without ZAI SDK wrapper
 */

export interface OpenAIVisionResponse {
  content: string
  model?: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface OpenAIChatResponse {
  content: string
  model?: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * Create AbortController with timeout
 */
function createTimeoutController(timeoutMs: number): AbortController {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  ;(controller as any)._timeoutId = timeoutId
  return controller
}

/**
 * Analyze an image using OpenAI Vision API (GPT-4 Vision)
 * @param base64Image - Base64 encoded image (without data URL prefix)
 * @param mimeType - MIME type of the image (e.g., 'image/jpeg', 'image/png')
 * @param prompt - Text prompt to guide the analysis
 * @param model - Model to use (default: 'gpt-4o')
 * @returns Analyzed content as text
 */
export async function analyzeImageWithOpenAI(
  base64Image: string,
  mimeType: string,
  prompt: string,
  model: string = 'gpt-4o'
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }

  // Validate base64Image
  if (!base64Image || base64Image.length === 0) {
    throw new Error('Invalid image data: base64Image is empty')
  }

  // Build data URL
  const dataUrl = `data:${mimeType};base64,${base64Image}`

  // Calculate image size (approximate)
  const imageSizeKB = Math.round((base64Image.length * 0.75) / 1024)
  console.log(`📷 [OpenAI Vision] Analyzing image: ${mimeType}, ~${imageSizeKB}KB`)

  // Create AbortController with 120s timeout
  const controller = createTimeoutController(120000) // 120 seconds

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
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
                  url: dataUrl,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 4000,
        temperature: 0.3
      }),
      signal: controller.signal
    })

    clearTimeout((controller as any)._timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ [OpenAI Vision] API error:', response.status, errorText)

      // Handle specific error codes
      if (response.status === 401) {
        throw new Error('Invalid OpenAI API key')
      } else if (response.status === 429) {
        throw new Error('OpenAI API rate limit exceeded. Please try again later.')
      } else if (response.status === 500 || response.status === 502 || response.status === 503) {
        throw new Error('OpenAI API server error. Please try again later.')
      } else {
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
      }
    }

    const data = await response.json()
    console.log('✅ [OpenAI Vision] Analysis successful')

    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('No content returned from OpenAI Vision API')
    }

    // Log token usage if available
    if (data.usage) {
      console.log('📊 [OpenAI Vision] Token usage:', {
        prompt: data.usage.prompt_tokens,
        completion: data.usage.completion_tokens,
        total: data.usage.total_tokens
      })
    }

    return content

  } catch (error: any) {
    clearTimeout((controller as any)._timeoutId)

    // Handle AbortError (timeout)
    if (error.name === 'AbortError') {
      console.error('❌ [OpenAI Vision] Request timeout after 120s')
      throw new Error('Request timeout. The image analysis took too long. Please try with a simpler image.')
    }

    // Handle network errors
    if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED')) {
      console.error('❌ [OpenAI Vision] Network error:', error.message)
      throw new Error('Network error. Could not connect to OpenAI API. Please check your internet connection.')
    }

    // Re-throw other errors
    console.error('❌ [OpenAI Vision] Error:', error.message)
    throw error
  }
}

/**
 * Generate text using OpenAI Chat API (GPT-4)
 * @param messages - Array of message objects with role and content
 * @param model - Model to use (default: 'gpt-4o')
 * @param temperature - Temperature for randomness (0-2, default: 0.7)
 * @returns Generated content as text
 */
export async function chatWithOpenAI(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  model: string = 'gpt-4o',
  temperature: number = 0.7
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }

  // Validate messages
  if (!messages || messages.length === 0) {
    throw new Error('Messages array is empty')
  }

  console.log(`🤖 [OpenAI Chat] Generating response with ${messages.length} messages`)

  // Create AbortController with 60s timeout
  const controller = createTimeoutController(60000) // 60 seconds

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: 2000,
        temperature: temperature
      }),
      signal: controller.signal
    })

    clearTimeout((controller as any)._timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ [OpenAI Chat] API error:', response.status, errorText)

      if (response.status === 401) {
        throw new Error('Invalid OpenAI API key')
      } else if (response.status === 429) {
        throw new Error('OpenAI API rate limit exceeded. Please try again later.')
      } else if (response.status === 500 || response.status === 502 || response.status === 503) {
        throw new Error('OpenAI API server error. Please try again later.')
      } else {
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
      }
    }

    const data = await response.json()
    console.log('✅ [OpenAI Chat] Response generated')

    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('No content returned from OpenAI Chat API')
    }

    // Log token usage if available
    if (data.usage) {
      console.log('📊 [OpenAI Chat] Token usage:', {
        prompt: data.usage.prompt_tokens,
        completion: data.usage.completion_tokens,
        total: data.usage.total_tokens
      })
    }

    return content

  } catch (error: any) {
    clearTimeout((controller as any)._timeoutId)

    if (error.name === 'AbortError') {
      console.error('❌ [OpenAI Chat] Request timeout after 60s')
      throw new Error('Request timeout. The chat request took too long.')
    }

    if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED')) {
      console.error('❌ [OpenAI Chat] Network error:', error.message)
      throw new Error('Network error. Could not connect to OpenAI API. Please check your internet connection.')
    }

    console.error('❌ [OpenAI Chat] Error:', error.message)
    throw error
  }
}

/**
 * Generate image using OpenAI DALL-E API
 * @param prompt - Text description of the image to generate
 * @param size - Image size (default: '1024x1024')
 * @returns Image URL or base64 data
 */
export async function generateImageWithOpenAI(
  prompt: string,
  size: '256x256' | '512x512' | '1024x1024' = '1024x1024'
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }

  if (!prompt || prompt.trim().length === 0) {
    throw new Error('Prompt is empty')
  }

  console.log(`🎨 [OpenAI Image] Generating image: ${prompt.substring(0, 50)}...`)

  // Create AbortController with 60s timeout
  const controller = createTimeoutController(60000) // 60 seconds

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: size,
        quality: 'standard',
        response_format: 'url'
      }),
      signal: controller.signal
    })

    clearTimeout((controller as any)._timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ [OpenAI Image] API error:', response.status, errorText)

      if (response.status === 401) {
        throw new Error('Invalid OpenAI API key')
      } else if (response.status === 429) {
        throw new Error('OpenAI API rate limit exceeded. Please try again later.')
      } else if (response.status === 500 || response.status === 502 || response.status === 503) {
        throw new Error('OpenAI API server error. Please try again later.')
      } else {
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
      }
    }

    const data = await response.json()
    console.log('✅ [OpenAI Image] Image generated')

    const imageUrl = data.data?.[0]?.url

    if (!imageUrl) {
      throw new Error('No image URL returned from OpenAI Image API')
    }

    return imageUrl

  } catch (error: any) {
    clearTimeout((controller as any)._timeoutId)

    if (error.name === 'AbortError') {
      console.error('❌ [OpenAI Image] Request timeout after 60s')
      throw new Error('Request timeout. Image generation took too long.')
    }

    if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED')) {
      console.error('❌ [OpenAI Image] Network error:', error.message)
      throw new Error('Network error. Could not connect to OpenAI API. Please check your internet connection.')
    }

    console.error('❌ [OpenAI Image] Error:', error.message)
    throw error
  }
}