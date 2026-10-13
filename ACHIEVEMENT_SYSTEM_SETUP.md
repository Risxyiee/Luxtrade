# 🏆 Achievement System - Quick Setup Guide

## 📦 Files Created (5 Files)

### 1. Database Schema
**File:** `prisma/schema.prisma`
- Added `bestStreak` and `achievements` (JSON) fields to Profile
- Created `MissionProgress` model
- Created relations between Profile, UserSubmission, MissionProgress

### 2. Achievement Data
**File:** `src/lib/achievements-data.ts`
- Achievement definitions and types
- Rarity color system
- Helper functions for filtering

### 3. API Endpoints
**File:** `src/app/api/missions/claim/route.ts`
- **POST /api/missions/claim** - Claim/submit achievement
- **GET /api/missions/claim?userId=X** - Get achievement progress

### 4. Main UI Component
**File:** `src/components/AchievementCenter.tsx`
- Full achievement center with grid layout
- Achievement cards with 3 states (locked, ready, completed)
- Filtering, search, and detail modal
- Claim functionality

### 5. Progress Tracker
**File:** `src/components/AchievementProgress.tsx`
- Compact version (for sidebar/header)
- Full version (for dashboard)
- Next achievement preview
- Stats display

---

## 🎮 Achievement Categories

### Trading (Automatic)
- 🚀 **First Trade** - Complete 1 trade → Reward: 3 Days PRO
- 💰 **Profit Hunter** - Earn $100+ profit → Reward: 7 Days PRO
- 🔥 **Win Streak** - 3 consecutive wins → Reward: 7 Days PRO
- 👑 **Profit Master** - Earn $500+ profit → Reward: 30 Days PRO
- ⚡ **Trading Veteran** - 100 trades → Reward: 30 Days PRO

### Engagement (Automatic)
- 🎯 **Daily Warrior** - 7 day login streak → Reward: 7 Days PRO
- 💎 **Dedicated** - 50 trades → Reward: 14 Days PRO
- 📅 **Monthly Streak** - 30 day login streak → Reward: 60 Days PRO

### Social (Manual)
- 📱 **TikTok Influencer** - Share on TikTok → Reward: 30 Days PRO
- 🎥 **YouTube Reviewer** - Review on YouTube → Reward: 60 Days PRO
- 📸 **Instagram Sharer** - Post on Instagram → Reward: 14 Days PRO
- 🐦 **Twitter Mention** - Mention @LuxTrade → Reward: 7 Days PRO

---

## 🔧 Setup Instructions

### 1. Database Migration
```bash
cd /home/z/my-project/Luxtrade
bun run db:push
```

### 2. Import Components
```tsx
import AchievementProgress from '@/components/AchievementProgress'
import AchievementCenter from '@/components/AchievementCenter'
```

### 3. Add to Dashboard Sidebar
In `src/components/SidebarMewah.tsx`, add before collapse button:
```tsx
{userId && (
  <div className="p-3 border-t border-white/5">
    <AchievementProgress userId={userId} compact />
  </div>
)}
```

### 4. Add Achievement Center Menu Item
In `src/components/SidebarMewah.tsx`, add to menuItems:
```tsx
{
  id: 'achievements',
  labelId: 'Pencapaian',
  icon: Trophy,
  proOnly: false,
  category: 'main'
}
```

Import Trophy icon:
```tsx
import { Trophy, /* ... */ } from 'lucide-react'
```

---

## 🎨 Visual States

### Locked (Not Completed)
- Grayscale appearance
- 60% opacity
- Lock icon displayed
- No interactivity

### Ready to Claim (Completed but Not Claimed)
- Full colors based on rarity
- Glowing/pulsing animation
- "CLAIM REWARD 🎁" button
- Clickable

### Claimed
- Full colors
- "COMPLETED ✅" badge
- No action buttons
- Checkmark icon

---

## 🎁 Reward System

### PRO Days Extension
- Automatically extends user's PRO subscription
- Adds days from current expiry (or today if expired)
- Updates user plan to "PRO"

### Badges
- Added to user's achievements array
- Displayed in achievement center
- Persistent tracking

---

## 📊 API Examples

### Get Progress
```typescript
const response = await fetch(`/api/missions/claim?userId=${userId}`)
const data = await response.json()
// Returns: { achievements, totalCompleted, totalClaimed, streakCount, bestStreak }
```

### Claim Automatic Achievement
```typescript
const response = await fetch('/api/missions/claim', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    missionId: 'first_trade',
    userId: 'user-id-here'
  })
})
```

### Submit Manual Achievement
```typescript
const response = await fetch('/api/missions/claim', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    missionId: 'tiktok_influencer',
    userId: 'user-id-here',
    proofUrl: 'https://tiktok.com/...'
  })
})
```

---

## 🎯 Customization

### Add New Achievement
Edit `src/lib/achievements-data.ts`:
```typescript
{
  id: 'custom_achievement',
  title: 'Custom Achievement',
  description: 'Your description here',
  category: 'trading',
  type: 'automatic',
  icon: '🎯',
  rarity: 'epic',
  reward: {
    type: 'pro_days',
    value: 7,
    label: '7 Days PRO Access'
  },
  criteria: {
    type: 'profit',
    target: 250,
    description: 'Earn $250+ in profit'
  }
}
```

### Change Rarity Colors
Edit `RARITY_COLORS` in `src/lib/achievements-data.ts`:
```typescript
export const RARITY_COLORS = {
  common: {
    bg: 'from-gray-500/20 to-gray-600/20',
    border: 'border-gray-500/30',
    text: 'text-gray-300',
    badge: 'bg-gray-500 text-white'
  },
  // ... edit other rarities
}
```

---

## ⚡ Quick Test Checklist

- [ ] Database schema migrated (`bun run db:push`)
- [ ] Components imported in dashboard
- [ ] Progress bar showing in sidebar
- [ ] Achievement Center accessible from menu
- [ ] Can view achievement details
- [ ] Can claim achievements
- [ ] Rewards applied correctly
- [ ] Login streak tracking works
- [ ] Trade achievements trigger correctly
- [ ] Manual achievements can be submitted

---

## 🐛 Troubleshooting

### Progress Not Showing
- Check userId is passed correctly
- Verify database connection
- Check browser console for errors
- Ensure API endpoint is accessible

### Achievement Not Completing
- Check criteria calculation in API
- Verify database queries
- Check achievement data definitions
- Review validation logic

### Rewards Not Applied
- Check applyReward function in API
- Verify user profile update
- Check PRO expiry calculation
- Review database mutation

---

## 📞 Support

For issues or questions:
1. Check console logs
2. Review API responses
3. Verify database schema
4. Test with demo mode enabled

---

## ✅ Implementation Complete!

All components are ready to use. Follow the setup instructions above to integrate the achievement system into your LuxTrade dashboard.
