import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

let zaiInstance: any = null

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}

export async function POST(request: NextRequest) {
  try {
    const { query, num = 10, recency_days } = await request.json()

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    const zai = await getZAI()

    const args: any = {
      query,
      num
    }

    // Add recency filter if provided
    if (recency_days) {
      args.recency_days = recency_days
    }

    const results = await zai.functions.invoke('web_search', args)

    return NextResponse.json({
      success: true,
      results: results || []
    })
  } catch (error) {
    console.error('Search Error:', error)
    return NextResponse.json(
      { error: 'Failed to perform search' },
      { status: 500 }
    )
  }
}
