import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

export async function POST(req: NextRequest) {
  try {
    const { error } = await requireAdmin(req)
    if (error) return error

    const { email, plan, proExpiry } = await req.json()
    
    if (!email || !plan || !proExpiry) {
      return NextResponse.json({ error: 'Email, plan, and proExpiry are required' }, { status: 400 })
    }
    
    const updatedUser = await db.profile.update({
      where: { email },
      data: {
        plan,
        proExpiry: new Date(proExpiry)
      }
    })
    
    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Manual update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}