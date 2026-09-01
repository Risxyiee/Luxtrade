import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { getServerClient } from '@/lib/supabase'

/**
 * Sync Supabase Auth user to the users table
 * Call this on login/register to ensure user exists in database
 */
export async function syncUserToDatabase(authUserId: string, email: string, displayName?: string | null) {
  try {
    console.log('🔄 Syncing user to database:', email)

    // Check if user already exists (use admin client)
    const admin = getSupabaseAdmin()
    if (admin) {
      const { data: existingUser } = await admin
        .from('users')
        .select('*')
        .eq('id', authUserId)
        .single()

      if (existingUser) {
        console.log('✅ User already exists in database:', email)
        return { success: true, user: existingUser, action: 'skipped' }
      }
    }

    // Get user from Supabase Auth to get fresh metadata
    // MUST use admin client (service_role) for auth.admin API — anon client will fail
    const adminClient = getSupabaseAdmin()
    if (!adminClient) {
      console.error('❌ No Supabase admin client available for auth lookup')
      return { success: false, error: 'No Supabase admin client available' }
    }

    const { data: authUser, error: authErr } = await (adminClient.auth as any).admin.getUserById(authUserId).catch((e: any) => ({ data: null, error: e }))

    if (authErr || !authUser?.user) {
      console.error('❌ User not found in Supabase Auth:', authUserId, authErr)
      return { success: false, error: 'User not found in Supabase Auth' }
    }

    // Extract display name from Supabase Auth metadata
    const finalDisplayName = displayName ||
                            authUser.user.user_metadata?.display_name ||
                            authUser.user.user_metadata?.name ||
                            authUser.user.user_metadata?.full_name ||
                            null

    // Create new user in database with same UUID as Supabase Auth
    if (!admin) {
      console.error('❌ Admin client not available for user creation')
      return { success: false, error: 'Admin client not available' }
    }

    const { data: newUser, error: insertError } = await admin
      .from('users')
      .insert({
        id: authUserId,
        email,
        name: finalDisplayName,
      })
      .select('*')
      .single()

    if (insertError || !newUser) {
      console.error('❌ Error creating user:', insertError)
      return { success: false, error: insertError?.message || 'Failed to create user' }
    }

    console.log('✅ User synced to database:', email)
    return { success: true, user: newUser, action: 'created' }
  } catch (error) {
    console.error('❌ Error syncing user to database:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Get user from Supabase Auth and sync to database
 * Call this after authentication
 */
export async function syncCurrentUser() {
  try {
    const supabase = getServerClient()
    if (!supabase) {
      return { success: false, error: 'Supabase client not available' }
    }

    // Get current session from Supabase
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError) {
      console.error('❌ Error getting session:', sessionError)
      return { success: false, error: 'Failed to get session' }
    }

    if (!session?.user) {
      return { success: false, error: 'No active session' }
    }

    // Sync user to database
    const result = await syncUserToDatabase(
      session.user.id,
      session.user.email!,
      session.user.user_metadata?.display_name || session.user.user_metadata?.name
    )

    return result
  } catch (error) {
    console.error('❌ Error in syncCurrentUser:', error)
    return { success: false, error: String(error) }
  }
}
