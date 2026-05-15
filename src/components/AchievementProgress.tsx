'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Sparkles, CheckCircle2, TrendingUp, Flame, CalendarDays, X } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import AchievementCenter from './AchievementCenter'

interface AchievementProgressProps {
  userId: string
  compact?: boolean
  showInView?: boolean
}

interface AchievementData {
  id: string
  title: string
  progress: number
  target: number
  isCompleted: boolean
  isClaimed: boolean
  canClaim: boolean
}

export default function AchievementProgress({ 
  userId, 
  compact = false,
  showInView = true 
}: AchievementProgressProps) {
  const [achievements, setAchievements] = useState<AchievementData[]>([])
  const [loading, setLoading] = useState(true)
  const [showCenter, setShowCenter] = useState(false)
  const [totalCompleted, setTotalCompleted] = useState(0)
  const [totalClaimed, setTotalClaimed] = useState(0)
  const [nextAchievement, setNextAchievement] = useState<AchievementData | null>(null)

  const fetchProgress = async () => {
    if (!userId) return

    try {
      const response = await fetch(`/api/missions/claim?userId=${userId}`)
      if (response.ok) {
        const data = await response.json()
        setAchievements(data.achievements || [])
        setTotalCompleted(data.totalCompleted || 0)
        setTotalClaimed(data.totalClaimed || 0)

        // Find next achievable achievement
        const next = (data.achievements || [])
          .filter((a: AchievementData) => !a.isClaimed)
          .sort((a: AchievementData, b: AchievementData) => {
            const aProgress = (a.progress / a.target) * 100
            const bProgress = (b.progress / b.target) * 100
            return bProgress - aProgress
          })[0]

        setNextAchievement(next || null)
      }
    } catch (error) {
      console.error('Failed to fetch achievement progress:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProgress()
  }, [userId])

  if (!showInView) return null

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-2 bg-white/10 rounded w-full" />
        <div className="h-1.5 bg-white/5 rounded w-3/4" />
      </div>
    )
  }

  // Compact version - just a progress bar
  if (compact) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-amber-300">
            <Trophy className="w-3.5 h-3.5" />
            <span className="font-semibold">Achievements</span>
          </div>
          <span className="text-white/60">
            {totalClaimed} / {achievements.length}
          </span>
        </div>
        <Progress 
          value={(totalClaimed / achievements.length) * 100} 
          className="h-1.5"
        />
        {nextAchievement && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1.5 text-[10px] text-white/40"
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>
              Next: {nextAchievement.title} ({nextAchievement.progress}/{nextAchievement.target})
            </span>
          </motion.div>
        )}
      </div>
    )
  }

  // Full version - detailed card
  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-purple-500/10 to-violet-600/10 border border-purple-500/20 rounded-xl p-4 space-y-3"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <Trophy className="w-5 h-5 text-yellow-400" />
            </motion.div>
            <div>
              <div className="text-sm font-bold text-white">Achievement Progress</div>
              <div className="text-[10px] text-white/40">
                {totalClaimed} of {achievements.length} completed
              </div>
            </div>
          </div>
          <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs">
            {Math.round((totalClaimed / achievements.length) * 100)}%
          </Badge>
        </div>

        {/* Overall Progress Bar */}
        <Progress 
          value={(totalClaimed / achievements.length) * 100} 
          className="h-2"
        />

        {/* Next Achievement */}
        <AnimatePresence>
          {nextAchievement && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white/5 rounded-lg p-3 border border-white/5"
            >
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-white">Next Achievement</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/80">{nextAchievement.title}</span>
                  <span className="text-amber-300 font-semibold">
                    {nextAchievement.progress} / {nextAchievement.target}
                  </span>
                </div>
                <Progress 
                  value={(nextAchievement.progress / nextAchievement.target) * 100} 
                  className="h-1"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2">
          <StatItem 
            icon={CheckCircle2} 
            label="Claimed" 
            value={totalClaimed}
            color="text-emerald-400"
          />
          <StatItem 
            icon={Flame} 
            label="Progress" 
            value={achievements.length - totalClaimed}
            color="text-orange-400"
          />
          <StatItem 
            icon={TrendingUp} 
            label="Ready" 
            value={achievements.filter(a => a.canClaim).length}
            color="text-amber-400"
          />
        </div>

        {/* View All Button */}
        <Button
          onClick={() => setShowCenter(true)}
          className="w-full bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white font-semibold text-sm"
        >
          <Trophy className="w-4 h-4 mr-2" />
          View Achievement Center
        </Button>
      </motion.div>

      {/* Achievement Center Modal */}
      <Dialog open={showCenter} onOpenChange={setShowCenter}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-[#110a1f] to-[#0a0612] border-purple-500/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-400" />
              <DialogTitle className="text-2xl font-bold text-white">
                Achievement Center
              </DialogTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowCenter(false)}
              className="text-white hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          <AchievementCenter userId={userId} />
        </DialogContent>
      </Dialog>
    </>
  )
}

function StatItem({ 
  icon: Icon, 
  label, 
  value, 
  color 
}: { 
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  color: string
}) {
  return (
    <div className="bg-white/5 rounded-lg p-2 text-center">
      <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-[9px] text-white/40 uppercase tracking-wide">{label}</div>
    </div>
  )
}
