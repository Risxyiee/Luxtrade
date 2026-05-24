'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, X, Gift, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'

interface AchievementNotificationProps {
  unlockedAchievements: Array<{
    id: string
    title: string
    reward: string
  }>
  userId: string
  onClose: () => void
}

export default function AchievementNotification({
  unlockedAchievements,
  userId,
  onClose
}: AchievementNotificationProps) {
  const [claiming, setClaiming] = useState<string | null>(null)

  const handleClaim = async (achievementId: string) => {
    setClaiming(achievementId)
    try {
      const response = await fetch('/api/missions/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          missionId: achievementId,
          userId
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success(`Achievement claimed! ${data.message}`)
        onClose()
      } else {
        toast.error(data.error || 'Failed to claim achievement')
      }
    } catch (error) {
      toast.error('Failed to claim achievement')
    } finally {
      setClaiming(null)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-4 right-4 z-50 max-w-sm w-full"
      >
        <Card className="bg-gradient-to-br from-amber-500/20 to-orange-600/20 border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="flex-shrink-0"
              >
                <Trophy className="w-8 h-8 text-amber-400" />
              </motion.div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">
                    Achievement Unlocked!
                  </h3>
                  <button
                    onClick={onClose}
                    className="ml-auto text-white/60 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  {unlockedAchievements.map((achievement) => (
                    <div
                      key={achievement.id}
                      className="bg-white/5 rounded-lg p-3 space-y-2"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {achievement.title}
                        </p>
                        <p className="text-xs text-white/60 flex items-center gap-1">
                          <Gift className="w-3 h-3" />
                          {achievement.reward}
                        </p>
                      </div>

                      <Button
                        onClick={() => handleClaim(achievement.id)}
                        disabled={claiming === achievement.id}
                        size="sm"
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs"
                      >
                        {claiming === achievement.id ? 'Claiming...' : 'Claim Reward 🎁'}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  )
}
