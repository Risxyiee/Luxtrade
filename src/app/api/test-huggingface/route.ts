import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.HUGGING_FACE_API_TOKEN

    const result = {
      hasToken: !!apiKey,
      tokenPreview: apiKey ? apiKey.substring(0, 10) + '...' : 'none',
      message: apiKey ? 'Token is set, checking API connectivity...' : 'No token found',
      token: apiKey ? apiKey.substring(0, 15) + '...' : undefined
    }

    // Try to connect to Hugging Face API
    if (apiKey) {
      try {
        const response = await fetch('https://api-inference.huggingface.co/models', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          signal: AbortSignal.timeout(10000),
        })

        result.apiStatus = response.status
        result.apiOk = response.ok

        if (response.ok) {
          result.message = '✅ Hugging Face API is working!'
        } else if (response.status === 401) {
          result.message = '❌ Invalid API token'
        } else if (response.status === 403) {
          result.message = '❌ Forbidden - Check API permissions'
        } else {
          result.message = `⚠️ API returned status ${response.status}`
        }
      } catch (error: any) {
        result.apiError = error.message
        result.message = '❌ Could not connect to Hugging Face API'
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: 'Test failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}