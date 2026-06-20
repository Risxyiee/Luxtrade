import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');

    if (code) {
      // Check specific promo code
      const promoCode = await db.promoCode.findUnique({
        where: { code: code.trim().toUpperCase() }
      });

      if (!promoCode) {
        return NextResponse.json({
          success: false,
          message: 'Kode promo tidak ditemukan',
          code: code.trim().toUpperCase()
        });
      }

      return NextResponse.json({
        success: true,
        promoCode: {
          id: promoCode.id,
          code: promoCode.code,
          description: promoCode.description,
          discountPercent: promoCode.discountPercent,
          maxQuota: promoCode.maxQuota,
          usedQuota: promoCode.usedQuota,
          remainingQuota: promoCode.maxQuota - promoCode.usedQuota,
          durationMonths: promoCode.durationMonths,
          isActive: promoCode.isActive,
          startDate: promoCode.startDate,
          endDate: promoCode.endDate
        }
      });
    }

    // List all promo codes
    const promoCodes = await db.promoCode.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      success: true,
      count: promoCodes.length,
      promoCodes: promoCodes.map(pc => ({
        id: pc.id,
        code: pc.code,
        description: pc.description,
        discountPercent: pc.discountPercent,
        maxQuota: pc.maxQuota,
        usedQuota: pc.usedQuota,
        remainingQuota: pc.maxQuota - pc.usedQuota,
        durationMonths: pc.durationMonths,
        isActive: pc.isActive,
        startDate: pc.startDate,
        endDate: pc.endDate
      }))
    });
  } catch (error: any) {
    console.error('❌ [Debug Promo Code] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}