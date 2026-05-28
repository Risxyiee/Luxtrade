// OpenAI Vision API Integration
// This replaces ZAI SDK with OpenAI GPT-4 Vision API

export async function analyzeImageWithOpenAI(
  base64Image: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }

  const imageUrl = base64Image.startsWith('data:')
    ? base64Image
    : `data:${mimeType};base64,${base64Image}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 120000) // 120 seconds

  try {
    console.log('🤖 [OpenAI Vision] Starting analysis...')

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Using cheaper but still capable model
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 4000,
        temperature: 0.3,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ [OpenAI Vision] API Error:', response.status, errorText)
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('No content returned from OpenAI Vision API')
    }

    console.log('✅ [OpenAI Vision] Analysis completed successfully')
    return content
  } catch (error: any) {
    clearTimeout(timeoutId)

    if (error.name === 'AbortError') {
      console.error('❌ [OpenAI Vision] Request timeout')
      throw new Error('Vision analysis timeout. Please try with a smaller image.')
    }

    console.error('❌ [OpenAI Vision] Error:', error)
    throw error
  }
}