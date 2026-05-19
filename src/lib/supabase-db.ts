import { supabase } from '@/lib/supabase'

// Helper functions for Supabase database operations

// Profile operations
export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Error fetching profile:', error)
    return null
  }

  return data
}

export async function createProfile(userId: string, email?: string) {
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      email: email || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating profile:', error)
    return null
  }

  return data
}

export async function updateProfile(userId: string, updates: any) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    console.error('Error updating profile:', error)
    return null
  }

  return data
}

export async function ensureProfileExists(userId: string, email?: string) {
  let profile = await getProfile(userId)

  if (!profile) {
    console.log('Profile not found, creating new one...')
    profile = await createProfile(userId, email)
  }

  return profile
}

// User submission operations
export async function getUserSubmissions(userId: string) {
  const { data, error } = await supabase
    .from('user_submissions')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    console.error('Error fetching user submissions:', error)
    return []
  }

  return data || []
}

export async function createUserSubmission(submission: {
  userId: string
  achievementKey: string
  proofUrl?: string
  status?: string
  reviewedBy?: string
  reviewedAt?: Date
}) {
  const { data, error } = await supabase
    .from('user_submissions')
    .insert({
      user_id: submission.userId,
      achievement_key: submission.achievementKey,
      proof_url: submission.proofUrl || null,
      status: submission.status || 'PENDING',
      reviewed_by: submission.reviewedBy || null,
      reviewed_at: submission.reviewedBy ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating user submission:', error)
    return null
  }

  return data
}

export async function updateUserSubmission(id: number, updates: any) {
  const { data, error } = await supabase
    .from('user_submissions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating user submission:', error)
    return null
  }

  return data
}

// Mission progress operations
export async function getMissionProgress(userId: string) {
  const { data, error } = await supabase
    .from('mission_progress')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    console.error('Error fetching mission progress:', error)
    return []
  }

  return data || []
}

export async function getMissionProgressByKey(userId: string, missionKey: string) {
  const { data, error } = await supabase
    .from('mission_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('mission_key', missionKey)
    .single()

  if (error) {
    // If not found, return null
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('Error fetching mission progress by key:', error)
    return null
  }

  return data
}

export async function upsertMissionProgress(progress: {
  userId: string
  missionKey: string
  progress?: number
  target?: number
  completed?: boolean
  claimed?: boolean
}) {
  const { data, error } = await supabase
    .from('mission_progress')
    .upsert({
      user_id: progress.userId,
      mission_key: progress.missionKey,
      progress: progress.progress ?? 0,
      target: progress.target ?? 1,
      completed: progress.completed ?? false,
      claimed: progress.claimed ?? false,
    }, {
      onConflict: 'user_id,mission_key',
    })
    .select()
    .single()

  if (error) {
    console.error('Error upserting mission progress:', error)
    return null
  }

  return data
}

// Achievement list operations
export async function addAchievementToProfile(userId: string, achievementId: string) {
  const profile = await getProfile(userId)

  if (!profile) {
    return null
  }

  const achievements = (profile.achievements as string[]) || []
  if (!achievements.includes(achievementId)) {
    achievements.push(achievementId)

    return await updateProfile(userId, {
      achievements: achievements as any,
    })
  }

  return profile
}
