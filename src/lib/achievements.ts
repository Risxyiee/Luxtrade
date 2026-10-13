/**
 * Achievement Master Data Configuration
 * This file contains all available achievements/mis with their rewards and requirements
 */

export interface Achievement {
  key: string
  title: string
  description: string
  reward: number // in credits/points
  type: 'AUTO' | 'MANUAL' // AUTO = system checks, MANUAL = requires admin verification
  icon?: string
  requirement?: string
  category?: 'STREAK' | 'SOCIAL' | 'REFERRAL' | 'PRO' | 'OTHER'
}

export const ACHIEVEMENTS: Record<string, Achievement> = {
  // Streak Achievements (AUTO)
  streak_3: {
    key: 'streak_3',
    title: 'Starter Streak',
    description: 'Login 3 days in a row',
    reward: 1,
    type: 'AUTO',
    category: 'STREAK',
    requirement: 'Login 3 consecutive days'
  },
  streak_7: {
    key: 'streak_7',
    title: 'Consistency',
    description: 'Login 7 days in a row',
    reward: 3,
    type: 'AUTO',
    category: 'STREAK',
    requirement: 'Login 7 consecutive days'
  },
  streak_14: {
    key: 'streak_14',
    title: 'Dedicated Trader',
    description: 'Login 14 days in a row',
    reward: 7,
    type: 'AUTO',
    category: 'STREAK',
    requirement: 'Login 14 consecutive days'
  },
  streak_30: {
    key: 'streak_30',
    title: 'Monthly Master',
    description: 'Login 30 days in a row',
    reward: 15,
    type: 'AUTO',
    category: 'STREAK',
    requirement: 'Login 30 consecutive days'
  },

  // Social Media Achievements (MANUAL - needs admin verification)
  tiktok_post: {
    key: 'tiktok_post',
    title: 'TikTok Warrior',
    description: 'Post about Luxtrade on TikTok',
    reward: 3,
    type: 'MANUAL',
    category: 'SOCIAL',
    requirement: 'Create a TikTok post about Luxtrade and submit proof',
    icon: '📱'
  },
  instagram_post: {
    key: 'instagram_post',
    title: 'Instagram Influencer',
    description: 'Post about Luxtrade on Instagram',
    reward: 3,
    type: 'MANUAL',
    category: 'SOCIAL',
    requirement: 'Create an Instagram post about Luxtrade and submit proof',
    icon: '📸'
  },
  twitter_post: {
    key: 'twitter_post',
    title: 'Twitter/X Promoter',
    description: 'Post about Luxtrade on Twitter/X',
    reward: 2,
    type: 'MANUAL',
    category: 'SOCIAL',
    requirement: 'Create a tweet about Luxtrade and submit proof',
    icon: '🐦'
  },
  youtube_review: {
    key: 'youtube_review',
    title: 'YouTube Reviewer',
    description: 'Create a YouTube review of Luxtrade',
    reward: 10,
    type: 'MANUAL',
    category: 'SOCIAL',
    requirement: 'Create a YouTube video reviewing Luxtrade and submit proof',
    icon: '▶️'
  },

  // PRO Achievements (AUTO)
  pro_lifetime: {
    key: 'pro_lifetime',
    title: 'Lifetime VIP',
    description: 'Purchase Lifetime Access',
    reward: 0,
    type: 'AUTO',
    category: 'PRO',
    requirement: 'Purchase Lifetime Access plan'
  },
  pro_monthly: {
    key: 'pro_monthly',
    title: 'Monthly Subscriber',
    description: 'Purchase Monthly PRO',
    reward: 0,
    type: 'AUTO',
    category: 'PRO',
    requirement: 'Purchase Monthly PRO plan'
  },

  // Other Achievements (MANUAL)
  feedback_giver: {
    key: 'feedback_giver',
    title: 'Feedback Champion',
    description: 'Provide valuable feedback',
    reward: 2,
    type: 'MANUAL',
    category: 'OTHER',
    requirement: 'Submit constructive feedback that helps improve Luxtrade',
    icon: '💬'
  },
  bug_hunter: {
    key: 'bug_hunter',
    title: 'Bug Hunter',
    description: 'Find and report a bug',
    reward: 5,
    type: 'MANUAL',
    category: 'OTHER',
    requirement: 'Report a bug that helps improve the platform',
    icon: '🐛'
  },
  feature_suggester: {
    key: 'feature_suggester',
    title: 'Idea Master',
    description: 'Suggest a new feature',
    reward: 3,
    type: 'MANUAL',
    category: 'OTHER',
    requirement: 'Suggest a feature idea that gets implemented',
    icon: '💡'
  }
}

// Helper function to get achievements by category
export function getAchievementsByCategory(category: Achievement['category']): Achievement[] {
  return Object.values(ACHIEVEMENTS).filter(a => a.category === category)
}

// Helper function to get achievements by type
export function getAchievementsByType(type: Achievement['type']): Achievement[] {
  return Object.values(ACHIEVEMENTS).filter(a => a.type === type)
}

// Helper function to get achievements for manual submission (that require proof)
export function getManualAchievements(): Achievement[] {
  return Object.values(ACHIEVEMENTS).filter(a => a.type === 'MANUAL')
}

// Helper function to get auto achievements (system checks)
export function getAutoAchievements(): Achievement[] {
  return Object.values(ACHIEVEMENTS).filter(a => a.type === 'AUTO')
}
