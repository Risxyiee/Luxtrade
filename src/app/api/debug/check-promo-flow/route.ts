import { NextRequest, NextResponse } from 'next/server';
import { createClientForApi } from '@/lib/supabase/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code') || 'TRADERCEPAT';

    // Get authenticated user
    const { supabase } = createClientForApi(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // Check promo code
    const promoCode = await db.promoCode.findUnique({
      where: { code: code.trim().toUpperCase() }
    });

    return NextResponse.json({
      status: 'debug-info',
      timestamp: new Date().toISOString(),
      auth: {
        hasUser: !!user,
        userId: user?.id || null,
        userEmail: user?.email || null,
        authError: authError?.message || null
      },
      promo: {
        code: code,
        exists: !!promoCode,
        promoData: promoCode ? {
          code: promoCode.code,
          description: promoCode.description,
          discountPercent: promoCode.discountPercent,
          maxQuota: promoCode.maxQuota,
          usedQuota: promoCode.usedQuota,
          remainingQuota: promoCode.maxQuota - promoCode.usedQuota,
          durationMonths: promoCode.durationMonths,
          isActive: promoCode.isActive
        } : null
      }
    }, { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { promoCode: code, plan } = body;

    // Get authenticated user
    const { supabase } = createClientForApi(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    return NextResponse.json({
      status: 'test-apply',
      timestamp: new Date().toISOString(),
      received: { code, plan },
      auth: {
        hasUser: !!user,
        userId: user?.id || null,
        userEmail: user?.email || null,
        authError: authError?.message || null
      }
    }, { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}