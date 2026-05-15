// ============================================
// ACHIEVEMENT SYSTEM INTEGRATION GUIDE
// ============================================
// 
// This file shows you how to integrate the Achievement System
// into your LuxTrade dashboard.
// ============================================

// ============================================
// STEP 1: Import the Achievement Components
// ============================================
import AchievementProgress from '@/components/AchievementProgress'
import AchievementCenter from '@/components/AchievementCenter'

// ============================================
// STEP 2: Get User ID from Auth Context
// ============================================
import { useAuth } from '@/lib/auth-context'

function YourComponent() {
  const { user, profile } = useAuth()
  const userId = user?.id || profile?.id

  // ============================================
  // STEP 3A: Add Compact Progress Bar to Sidebar
  // ============================================
  // Place this in your Sidebar component (SidebarMewah.tsx)
  // Add it in the footer section before the collapse button

  return (
    <>
      {/* In SidebarMewah.tsx - Footer Section */}
      {userId && (
        <div className="p-3 border-t border-white/5">
          <AchievementProgress 
            userId={userId} 
            compact={true} 
            showInView={true}
          />
        </div>
      )}
    </>
  )

  // ============================================
  // STEP 3B: Add Full Progress Card to Dashboard
  // ============================================
  // Place this in your dashboard page (dashboard/page.tsx)
  // Add it in the stats section or as a standalone card

  return (
    <>
      {/* In dashboard - stats section */}
      {userId && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="col-span-12 md:col-span-6 lg:col-span-4"
        >
          <AchievementProgress 
            userId={userId} 
            compact={false}
            showInView={true}
          />
        </motion.div>
      )}
    </>
  )

  // ============================================
  // STEP 4: Add Achievement Center Tab/Menu Item
  // ============================================
  // Add achievement center as a new menu item in SidebarMewah.tsx

  // Add to menuItems array:
  const menuItems: MenuItem[] = [
    // ... existing items ...
    { 
      id: 'achievements', 
      labelId: 'Pencapaian', 
      icon: Trophy, 
      proOnly: false, 
      category: 'main' 
    },
    // ... rest of items ...
  ]

  // Add Achievement icon import:
  import {
    // ... existing imports ...
    Trophy,
  } from 'lucide-react'

  // In the main component, handle the achievements tab:
  const [activeTab, setActiveTab] = useState('dashboard')

  // Render AchievementCenter when activeTab === 'achievements':
  {activeTab === 'achievements' && userId && (
    <AchievementCenter userId={userId} />
  )}

  // ============================================
  // STEP 5: Database Migration (IMPORTANT!)
  // ============================================
  // Run this command in your terminal:
  //
  //   cd /home/z/my-project/Luxtrade
  //   bun run db:push
  //
  // This will update your database schema with the new
  // gamification fields.

  // ============================================
  // STEP 6: Testing the Achievement System
  // ============================================
  // 
  // After integrating:
  // 
  // 1. Login to your dashboard
  // 2. Look for the Achievement Progress bar/card
  // 3. Click "View Achievement Center" to see all achievements
  // 4. Try completing achievements:
  //    - Add a trade (check "First Trade" achievement)
  //    - Login multiple days (check "Daily Warrior" achievement)
  // 5. Claim completed achievements
  // 6. Check if rewards are applied (PRO days extension)
  //
  // ============================================

  // ============================================
  // STEP 7: Customizing Achievements
  // ============================================
  // Edit src/lib/achievements-data.ts to:
  //
  // - Add new achievements
  // - Modify existing achievement criteria
  // - Change reward values
  // - Adjust rarity levels
  //
  // Example of adding a new achievement:
  /*
  {
    id: 'custom_achievement',
    title: 'Custom Achievement Name',
    description: 'Description of what user needs to do',
    category: 'trading' | 'engagement' | 'social',
    type: 'automatic' | 'manual',
    icon: '🎯',
    rarity: 'common' | 'rare' | 'epic' | 'legendary',
    reward: {
      type: 'pro_days' | 'badge' | 'special_feature',
      value: number | string,
      label: 'Reward description'
    },
    criteria: {
      type: 'trade_count' | 'profit' | 'win_streak' | 'login_streak' | 'manual_proof',
      target: number,
      description: 'Human-readable description'
    }
  }
  */

  // ============================================
  // STEP 8: API Endpoint Testing
  // ============================================
  // 
  // Test the achievement API:
  //
  // GET endpoint (fetch progress):
  //   GET /api/missions/claim?userId={USER_ID}
  //
  // POST endpoint (claim achievement):
  //   POST /api/missions/claim
  //   Body: {
  //     missionId: "achievement_id",
  //     userId: "user_id",
  //     proofUrl: "https://..." // for manual achievements only
  //   }
  //
  // ============================================

  // ============================================
  // STEP 9: Styling Customization
  // ============================================
  // 
  // Customize colors and styles in:
  // - src/lib/achievements-data.ts (RARITY_COLORS)
  // - src/components/AchievementCenter.tsx (card styles)
  // - src/components/AchievementProgress.tsx (progress styles)
  //
  // Current color themes:
  // - Common: Gray
  // - Rare: Blue
  // - Epic: Purple
  // - Legendary: Amber/Gold
  //
  // ============================================

  return null // This is just a guide file
}

export default YourComponent
