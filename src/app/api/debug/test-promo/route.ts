import { NextRequest, NextResponse } from 'next/server';
import { createClientForApi } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('🔍 [Test Promo] Request body:', JSON.stringify(body, null, 2))

    const { promoCode: code, plan } = body
    console.log('🔍 [Test Promo] code:', code, 'plan:', plan)

    // Get authenticated user
    const { supabase } = createClientForApi(request)
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    console.log('🔍 [Test Promo] User:', user ? user.id : 'NO USER')
    console.log('🔍 [Test Promo] Auth Error:', authError)

    return NextResponse.json({
      success: true,
      message: 'Test berhasil!',
      received: { code, plan },
      user: user ? { id: user.id, email: user.email } : null,
      authError: authError?.message
    })
  } catch (error: any) {
    console.error('❌ [Test Promo] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      received: await request.json().catch(() => 'Cannot parse')
    }, { status: 500 })
  }
}