import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PUT update a subscription plan
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { id } = params
    const { name, description, price, currency, durationMonths, isLifetime, maxSlots, isActive } = body

    const plan = await db.subscriptionPlan.update({
      where: { id },
      data: {
        name,
        description,
        price: price ? parseInt(price) : undefined,
        currency: currency || undefined,
        durationMonths: durationMonths ? parseInt(durationMonths) : null,
        isLifetime: isLifetime !== undefined ? isLifetime : undefined,
        maxSlots: maxSlots ? parseInt(maxSlots) : null,
        isActive: isActive !== undefined ? isActive : undefined
      }
    })

    // Update slot tracking if plan has slots
    if (maxSlots) {
      const existingSlotTracking = await db.slotTracking.findUnique({
        where: { planId: id }
      })

      if (existingSlotTracking) {
        await db.slotTracking.update({
          where: { id: existingSlotTracking.id },
          data: { totalSlots: parseInt(maxSlots) }
        })
      } else {
        await db.slotTracking.create({
          data: {
            planId: id,
            totalSlots: parseInt(maxSlots),
            usedSlots: 0
          }
        })
      }
    }

    return NextResponse.json({ plan })
  } catch (error) {
    console.error('Error updating plan:', error)
    return NextResponse.json(
      { error: 'Failed to update plan' },
      { status: 500 }
    )
  }
}

// DELETE a subscription plan
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    await db.subscriptionPlan.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting plan:', error)
    return NextResponse.json(
      { error: 'Failed to delete plan' },
      { status: 500 }
    )
  }
}
