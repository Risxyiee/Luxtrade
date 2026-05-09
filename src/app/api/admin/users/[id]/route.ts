import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// DELETE a user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    console.log(`🗑️ Attempting to delete user with ID: ${id}`)

    // Check if user has subscriptions first (try profiles table)
    const { count: profileSubCount } = await supabase
      .from('user_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', id)

    if (profileSubCount && profileSubCount > 0) {
      console.log('⚠️ User has subscriptions, cannot delete')
      return NextResponse.json(
        { error: 'Cannot delete user with active subscriptions. Please delete subscriptions first.' },
        { status: 400 }
      )
    }

    // Try deleting from profiles table first
    const { error: profileDeleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id)

    if (profileDeleteError) {
      console.error('❌ Error deleting from profiles:', profileDeleteError)

      // Try deleting from users table
      const { error: userDeleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', id)

      if (userDeleteError) {
        console.error('❌ Error deleting from users:', userDeleteError)
        console.error('Full error details:', JSON.stringify(userDeleteError, null, 2))
        return NextResponse.json(
          { error: 'Failed to delete user' },
          { status: 500 }
        )
      }

      console.log('✅ User deleted successfully from users table')
      return NextResponse.json({ success: true })
    }

    console.log('✅ User deleted successfully from profiles table')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ Unexpected error deleting user:', error)
    console.error('Full error details:', JSON.stringify(error, null, 2))
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}
