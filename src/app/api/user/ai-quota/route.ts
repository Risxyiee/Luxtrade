import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { getAIQuotaInfo } from '@/lib/ai-quota'

export async function GET(request: NextRequest) {
  try {
    const authResult = await createClientForApi(request)
    const supabase = authResult.supabase
    if (!supabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const quotaInfo = await getAIQuotaInfo(user.id)
    return NextResponse.json(quotaInfo)
  } catch (error: any) {
    console.error('[/api/user/ai-quota] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch AI quota' }, { status: 500 })
  }
}