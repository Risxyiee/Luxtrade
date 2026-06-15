import { NextRequest, NextResponse } from 'next/server'

/**
 * Proxy API for HuggingFace Vision to bypass DNS issues on Vercel
 * This endpoint acts as a middleman between client and HuggingFace API
 */
export async function POST(request: NextRequest) {
  try {
    const { model, inputs, parameters } = await request.json()

    console.log(`🌉 [Proxy] Request to HuggingFace API: ${model}`)

    // Get API token
    const apiKey = process.env.HUGGING_FACE_API_TOKEN
    if (!apiKey) {
      console.error('❌ [Proxy] HUGGING_FACE_API_TOKEN not configured')
      return NextResponse.json(
        { error: 'HUGGING_FACE_API_TOKEN not configured' },
        { status: 500 }
      )
    }

    // Prepare request to HuggingFace
    const hfUrl = `https://api-inference.huggingface.co/models/${model}`

    console.log(`🌉 [Proxy] Fetching from: ${hfUrl}`)

    const response = await fetch(hfUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs, parameters }),
      signal: AbortSignal.timeout(60000), // 60 seconds timeout
    })

    const data = await response.json()

    console.log(`🌉 [Proxy] Response status: ${response.status}`)

    if (!response.ok) {
      console.error(`❌ [Proxy] HuggingFace API error:`, data)

      // Handle specific error cases
      if (response.status === 503) {
        return NextResponse.json(
          { error: 'Model is loading, please try again in a moment', details: data },
          { status: 503 }
        )
      }

      if (response.status === 429) {
        return NextResponse.json(
          { error: 'Rate limited by HuggingFace API. Please try again later.', details: data },
          { status: 429 }
        )
      }

      if (response.status === 401) {
        return NextResponse.json(
          { error: 'Invalid HUGGING_FACE_API_TOKEN. Please check your API key.', details: data },
          { status: 401 }
        )
      }

      return NextResponse.json(
        { error: data.error || 'HuggingFace API error', details: data },
        { status: response.status }
      )
    }

    console.log(`✅ [Proxy] Request successful`)

    return NextResponse.json(data)

  } catch (error: any) {
    console.error('❌ [Proxy] Proxy error:', error)

    // Handle DNS resolution error
    if (error.cause?.code === 'ENOTFOUND' || error.cause?.errno === -3007 || error.code === 'ENOTFOUND') {
      console.error(`🌐 [Proxy] DNS resolution failed for ${error.cause?.hostname}`)
      return NextResponse.json(
        { error: 'DNS resolution failed. Cannot connect to HuggingFace API.' },
        { status: 503 }
      )
    }

    // Handle timeout
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      console.error(`⏰ [Proxy] Request timeout`)
      return NextResponse.json(
        { error: 'Request timeout. The image might be too complex.' },
        { status: 504 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Proxy error occurred' },
      { status: 500 }
    )
  }
}