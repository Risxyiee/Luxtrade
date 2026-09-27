import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getAdminAuth, getSupabaseAdmin } from '@/lib/supabase-admin-alt'

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

    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 500 })
    }

    // Delete subscriptions first (user_subscriptions table)
    try {
      await admin.from('user_subscriptions').delete().eq('user_id', id)
    } catch (subErr) {
      console.error('⚠️ user_subscriptions cleanup error (non-blocking):', subErr)
    }

    // Delete profile (non-blocking)
    try {
      await admin.from('profiles').delete().eq('id', id)
    } catch (profileErr) {
      console.error('⚠️ profiles cleanup error (non-blocking):', profileErr)
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