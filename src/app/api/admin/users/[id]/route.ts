export const runtime = 'edge'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminAuth, getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { db } from '@/lib/db'

// DELETE a user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAdmin(request)
    if (error) return error

    const { id } = await params

    // Delete from Supabase Auth (primary source of truth)
    const authAdmin = getAdminAuth()
    if (authAdmin) {
      try {
        const { error: deleteAuthError } = await authAdmin.deleteUser(id)
        if (deleteAuthError) {
          console.error('⚠️ Failed to delete user from Auth:', deleteAuthError.message)
          // Don't fail — continue with DB cleanup
        }
      } catch (err) {
        console.error('⚠️ Auth delete error (non-blocking):', err)
      }
    }

    // Also clean up Prisma profile (non-blocking)
    try {
      // Check if user has subscriptions
      const subscriptionCount = await db.userSubscription.count({
        where: { userId: id }
      })

      if (subscriptionCount > 0) {
        // Delete subscriptions first
        await db.userSubscription.deleteMany({ where: { userId: id } })
      }

      // Try delete profile (may fail if doesn't exist)
      await db.profile.delete({ where: { id } }).catch(() => {})
    } catch (prismaErr) {
      console.error('⚠️ Prisma cleanup error (non-blocking):', prismaErr)
    }

    // Clean up Supabase profiles table (non-blocking)
    try {
      const svc = getSupabaseAdmin()
      if (svc) {
        await svc.from('profiles').delete().eq('id', id)
      }
    } catch (supabaseErr) {
      console.error('⚠️ Supabase profiles cleanup error (non-blocking):', supabaseErr)
    }

    return NextResponse.json({ success: true, message: 'User deleted successfully' })
  } catch (error) {
    console.error('❌ Error deleting user:', error)
    return NextResponse.json(
      { error: 'Failed to delete user', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}