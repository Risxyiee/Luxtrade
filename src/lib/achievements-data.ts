// Achievement System Data & Types

export interface Achievement {
  id: string
  title: string
  description: string
  category: 'trading' | 'engagement' | 'social'
  type: 'automatic' | 'manual'
  icon: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  reward: {
    type: 'pro_days' | 'badge' | 'special_feature'
    value: number | string
    label: string
  }
  criteria: {
    type: 'trade_count' | 'profit' | 'win_streak' | 'login_streak' | 'manual_proof'
    target: number
    description: string
  }
}

// Achievement Definitions
export const ACHIEVEMENTS: Achievement[] = [
  // ==================== AUTOMATIC TRADING ====================
  {
    id: 'first_trade',
    title: 'First Trade',
    description: 'Complete your very first trade in LuxTrade',
    category: 'trading',
    type: 'automatic',
    icon: '🚀',
    rarity: 'common',
    reward: {
      type: 'pro_days',
      value: 3,
      label: '3 Days PRO Access'
    },
    criteria: {
      type: 'trade_count',
      target: 1,
      description: 'Complete 1 trade'
    }
  },
  {
    id: 'profit_hunter',
    title: 'Profit Hunter',
    description: 'Accumulate over $100 in total profit',
    category: 'trading',
    type: 'automatic',
    icon: '💰',
    rarity: 'rare',
    reward: {
      type: 'pro_days',
      value: 7,
      label: '7 Days PRO Access'
    },
    criteria: {
      type: 'profit',
      target: 100,
      description: 'Earn $100+ in profit'
    }
  },
  {
    id: 'win_streak_3',
    title: 'Win Streak',
    description: 'Achieve 3 consecutive winning trades',
    category: 'trading',
    type: 'automatic',
    icon: '🔥',
    rarity: 'rare',
    reward: {
      type: 'pro_days',
      value: 7,
      label: '7 Days PRO Access'
    },
    criteria: {
      type: 'win_streak',
      target: 3,
      description: '3 winning trades in a row'
    }
  },
  {
    id: 'profit_master',
    title: 'Profit Master',
    description: 'Reach $500 in total profit',
    category: 'trading',
    type: 'automatic',
    icon: '👑',
    rarity: 'epic',
    reward: {
      type: 'pro_days',
      value: 30,
      label: '30 Days PRO Access'
    },
    criteria: {
      type: 'profit',
      target: 500,
      description: 'Earn $500+ in profit'
    }
  },
  {
    id: 'trading_veteran',
    title: 'Trading Veteran',
    description: 'Log 100 trades in your journal',
    category: 'trading',
    type: 'automatic',
    icon: '⚡',
    rarity: 'epic',
    reward: {
      type: 'pro_days',
      value: 30,
      label: '30 Days PRO Access'
    },
    criteria: {
      type: 'trade_count',
      target: 100,
      description: 'Complete 100 trades'
    }
  },

  // ==================== AUTOMATIC ENGAGEMENT ====================
  {
    id: 'daily_warrior',
    title: 'Daily Warrior',
    description: 'Login to LuxTrade for 7 consecutive days',
    category: 'engagement',
    type: 'automatic',
    icon: '🎯',
    rarity: 'rare',
    reward: {
      type: 'pro_days',
      value: 7,
      label: '7 Days PRO Access'
    },
    criteria: {
      type: 'login_streak',
      target: 7,
      description: 'Login 7 days in a row'
    }
  },
  {
    id: 'dedicated',
    title: 'Dedicated Trader',
    description: 'Log 50 trades in your journal',
    category: 'engagement',
    type: 'automatic',
    icon: '💎',
    rarity: 'rare',
    reward: {
      type: 'pro_days',
      value: 14,
      label: '14 Days PRO Access'
    },
    criteria: {
      type: 'trade_count',
      target: 50,
      description: 'Complete 50 trades'
    }
  },
  {
    id: 'monthly_streak',
    title: 'Monthly Streak',
    description: 'Maintain a 30-day login streak',
    category: 'engagement',
    type: 'automatic',
    icon: '📅',
    rarity: 'epic',
    reward: {
      type: 'pro_days',
      value: 60,
      label: '60 Days PRO Access'
    },
    criteria: {
      type: 'login_streak',
      target: 30,
      description: 'Login 30 days in a row'
    }
  },

  // ==================== MANUAL SOCIAL ====================
  {
    id: 'tiktok_influencer',
    title: 'TikTok Influencer',
    description: 'Share your LuxTrade trading results on TikTok',
    category: 'social',
    type: 'manual',
    icon: '📱',
    rarity: 'legendary',
    reward: {
      type: 'pro_days',
      value: 30,
      label: '30 Days PRO Access'
    },
    criteria: {
      type: 'manual_proof',
      target: 1,
      description: 'Share on TikTok with link'
    }
  },
  {
    id: 'youtube_reviewer',
    title: 'YouTube Reviewer',
    description: 'Create and share a LuxTrade review on YouTube',
    category: 'social',
    type: 'manual',
    icon: '🎥',
    rarity: 'legendary',
    reward: {
      type: 'pro_days',
      value: 60,
      label: '60 Days PRO Access'
    },
    criteria: {
      type: 'manual_proof',
      target: 1,
      description: 'Share review on YouTube'
    }
  },
  {
    id: 'instagram_sharer',
    title: 'Instagram Sharer',
    description: 'Post your trading journey on Instagram with LuxTrade',
    category: 'social',
    type: 'manual',
    icon: '📸',
    rarity: 'epic',
    reward: {
      type: 'pro_days',
      value: 14,
      label: '14 Days PRO Access'
    },
    criteria: {
      type: 'manual_proof',
      target: 1,
      description: 'Share on Instagram'
    }
  },
  {
    id: 'twitter_mention',
    title: 'Twitter Mention',
    description: 'Mention @LuxTrade in your trading tweet',
    category: 'social',
    type: 'manual',
    icon: '🐦',
    rarity: 'rare',
    reward: {
      type: 'pro_days',
      value: 7,
      label: '7 Days PRO Access'
    },
    criteria: {
      type: 'manual_proof',
      target: 1,
      description: 'Mention on Twitter'
    }
  }
]

// Rarity Colors
export const RARITY_COLORS = {
  common: {
    bg: 'from-gray-500/20 to-gray-600/20',
    border: 'border-gray-500/30',
    text: 'text-gray-300',
    badge: 'bg-gray-500 text-white'
  },
  rare: {
    bg: 'from-blue-500/20 to-blue-600/20',
    border: 'border-blue-500/30',
    text: 'text-blue-300',
    badge: 'bg-blue-500 text-white'
  },
  epic: {
    bg: 'from-purple-500/20 to-purple-600/20',
    border: 'border-purple-500/30',
    text: 'text-purple-300',
    badge: 'bg-purple-500 text-white'
  },
  legendary: {
    bg: 'from-amber-500/20 to-orange-600/20',
    border: 'border-amber-500/30',
    text: 'text-amber-300',
    badge: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
  }
}

// Helper functions
export function getAchievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find(a => a.id === id)
}

export function getAchievementsByCategory(category: Achievement['category']): Achievement[] {
  return ACHIEVEMENTS.filter(a => a.category === category)
}

export function getAchievementsByType(type: Achievement['type']): Achievement[] {
  return ACHIEVEMENTS.filter(a => a.type === type)
}
