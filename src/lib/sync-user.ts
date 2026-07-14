import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'

/**
 * Sync Supabase Auth user to Prisma User table
 * Call this on login/register to ensure user exists in database
 */
export async function syncUserToDatabase(authUserId: string, email: string, displayName?: string | null) {
  try {
    console.log('🔄 Syncing user to database:', email)

    // Check if user already exists in Prisma
    const existingUser = await db.user.findUnique({
      where: { id: authUserId }
    })

    if (existingUser) {
      console.log('✅ User already exists in database:', email)
      return { success: true, user: existingUser, action: 'skipped' }
    }

    // Get user from Supabase Auth to get fresh metadata
    const { data: authUser } = await supabase.auth.admin.getUser(authUserId)

    if (!authUser?.user) {
      console.error('❌ User not found in Supabase Auth:', authUserId)
      return { success: false, error: 'User not found in Supabase Auth' }
    }

    // Extract display name from Supabase Auth metadata
    const finalDisplayName = displayName ||
                            authUser.user.user_metadata?.display_name ||
                            authUser.user.user_metadata?.name ||
                            authUser.user.user_metadata?.full_name ||
                            null

    // Create new user in Prisma with same UUID as Supabase Auth
    const newUser = await db.user.create({
      data: {
        id: authUserId, // Use same UUID as Supabase Auth
        email,
        name: finalDisplayName
      }
    })

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
