import { NextRequest, NextResponse } from 'next/server'
import { PRICING, formatRupiah } from '@/lib/pricing'

/**
 * GET - Get all pricing plans
 * Returns pricing information for frontend consumption
 */
export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      pricing: {
        lifetimeUltra: {
          name: 'Lifetime Ultra',
          price: PRICING.PRO_LIFETIME,
          priceFormatted: formatRupiah(PRICING.PRO_LIFETIME),
          description: 'Akses seumur hidup ke semua fitur PRO (Promo)',
          isPromo: true,
        },
        pro: {
          '30-days': {
            name: 'PRO 30 Hari',
            price: PRICING.PRO_30_DAYS,
            priceFormatted: formatRupiah(PRICING.PRO_30_DAYS),
            duration: 30,
            description: 'Akses PRO selama 30 hari (Promo)',
            isPromo: true,
          },
          '180-days': {
            name: 'PRO 180 Hari',
            price: PRICING.PRO_180_DAYS,
            priceFormatted: formatRupiah(PRICING.PRO_180_DAYS),
            duration: 180,
            description: 'Akses PRO selama 180 hari',
            isPromo: false,
          },
        },
      },
      message: 'Pricing retrieved successfully',
    })
  } catch (error) {
    console.error('Error fetching pricing:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch pricing',
      },
      { status: 500 }
    )
  }
}
