import { NextRequest, NextResponse } from 'next/server'
import { getAIQuotaInfo } from '@/lib/ai-quota'
import { auth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const quotaInfo = await getAIQuotaInfo(session.user.id)

    return NextResponse.json(quotaInfo)
  } catch (error) {
    console.error('[AI Quota API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}