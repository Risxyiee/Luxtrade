'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Trophy, Lock, CheckCircle2, Gift, Sparkles, 
  TrendingUp, CalendarDays, Target, Users, Star,
  ArrowRight, ExternalLink, Filter, Search, X,
  Zap, Flame, Crown, Gem, Award
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { ACHIEVEMENTS, RARITY_COLORS, type Achievement } from '@/lib/achievements-data'

interface AchievementProgress {
  id: string
  title: string
  progress: number
  target: number
  isCompleted: boolean
  isClaimed: boolean
  canClaim: boolean
}

interface AchievementCenterProps {
  userId: string
}

export default function AchievementCenter({ userId }: AchievementCenterProps) {
  const [achievements, setAchievements] = useState<AchievementProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'trading' | 'engagement' | 'social'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [claiming, setClaiming] = useState<string | null>(null)
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null)
  const [proofUrl, setProofUrl] = useState('')

  const fetchAchievements = useCallback(async () => {
    if (!userId) return

    try {
      const response = await fetch(`/api/missions/claim?userId=${userId}`)
      if (response.ok) {
        const data = await response.json()
        setAchievements(data.achievements || [])
      }
    } catch (error) {
      console.error('Failed to fetch achievements:', error)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchAchievements()
  }, [fetchAchievements])

  const handleClaim = async (achievementId: string) => {
    setClaiming(achievementId)
    try {
      const achievement = ACHIEVEMENTS.find(a => a.id === achievementId)
      if (!achievement) return

      const body: any = {
        missionId: achievementId,
        userId
      }

      if (achievement.type === 'manual') {
        if (!proofUrl) {
          toast.error('Please provide proof URL')
          return
        }
        body.proofUrl = proofUrl
      }

      const response = await fetch('/api/missions/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (data.success) {
        toast.success(data.message)
        setProofUrl('')
        setSelectedAchievement(null)
        fetchAchievements()
      } else {
        toast.error(data.error || 'Failed to claim achievement')
      }
    } catch (error) {
      toast.error('Failed to claim achievement')
    } finally {
      setClaiming(null)
    }
  }

  const filteredAchievements = ACHIEVEMENTS.filter(achievement => {
    const matchesFilter = filter === 'all' || achievement.category === filter
    const matchesSearch = achievement.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        achievement.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const stats = {
    total: achievements.length,
    claimed: achievements.filter(a => a.isClaimed).length,
    available: achievements.filter(a => a.canClaim).length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full"
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0612] via-[#110a1f] to-[#0a0612] p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="flex items-center justify-center gap-3">
            <Trophy className="w-12 h-12 text-yellow-400" />
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-yellow-200 via-yellow-400 to-orange-400 bg-clip-text text-transparent">
              Achievement Center
            </h1>
          </div>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Complete missions, unlock achievements, and earn rewards to level up your trading journey!
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <StatCard
            icon={Award}
            label="Total Achievements"
            value={stats.total}
            color="from-purple-500 to-violet-600"
          />
          <StatCard
            icon={CheckCircle2}
            label="Claimed Rewards"
            value={stats.claimed}
            color="from-emerald-500 to-teal-600"
          />
          <StatCard
            icon={Sparkles}
            label="Available to Claim"
            value={stats.available}
            color="from-amber-500 to-orange-600"
            highlight
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-4 items-center justify-between"
        >
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Search className="w-5 h-5 text-white/40" />
            <Input
              placeholder="Search achievements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/40 w-full sm:w-64"
            />
          </div>

          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-full sm:w-auto">
            <TabsList className="bg-white/5 border-white/10">
              <TabsTrigger value="all" className="data-[state=active]:bg-purple-500/20">
                All
              </TabsTrigger>
              <TabsTrigger value="trading" className="data-[state=active]:bg-purple-500/20">
                Trading
              </TabsTrigger>
              <TabsTrigger value="engagement" className="data-[state=active]:bg-purple-500/20">
                Engagement
              </TabsTrigger>
              <TabsTrigger value="social" className="data-[state=active]:bg-purple-500/20">
                Social
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </motion.div>

        <motion.div
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.1
              }
            }
          }}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredAchievements.map((achievement) => {
            const progress = achievements.find(a => a.id === achievement.id)
            const isCompleted = progress?.isCompleted || false
            const isClaimed = progress?.isClaimed || false
            const canClaim = progress?.canClaim || false
            const currentProgress = progress?.progress || 0

            return (
              <AchievementCard
                key={achievement.id}
                achievement={achievement}
                isCompleted={isCompleted}
                isClaimed={isClaimed}
                canClaim={canClaim}
                currentProgress={currentProgress}
                onClick={() => setSelectedAchievement(achievement)}
                onClaim={() => handleClaim(achievement.id)}
                claiming={claiming === achievement.id}
              />
            )
          })}
        </motion.div>

        <AchievementDetailDialog
          achievement={selectedAchievement}
          progress={selectedAchievement ? achievements.find(a => a.id === selectedAchievement.id) : null}
          open={!!selectedAchievement}
          onClose={() => {
            setSelectedAchievement(null)
            setProofUrl('')
          }}
          proofUrl={proofUrl}
          onProofUrlChange={setProofUrl}
          onClaim={() => selectedAchievement && handleClaim(selectedAchievement.id)}
          claiming={claiming === selectedAchievement?.id}
        />
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color, highlight }: any) {
  return (
    <Card className={`bg-gradient-to-br ${color} border-white/10 ${highlight ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-[#0a0612]' : ''}`}>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <Icon className="w-8 h-8 text-white" />
          <div>
            <div className="text-3xl font-bold text-white">{value}</div>
            <div className="text-sm text-white/80">{label}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function AchievementCard({
  achievement,
  isCompleted,
  isClaimed,
  canClaim,
  currentProgress,
  onClick,
  onClaim,
  claiming
}: {
  achievement: Achievement
  isCompleted: boolean
  isClaimed: boolean
  canClaim: boolean
  currentProgress: number
  onClick: () => void
  onClaim: () => void
  claiming: boolean
}) {
  const rarity = RARITY_COLORS[achievement.rarity]

  return (
    <motion.div
      layout
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card
        onClick={onClick}
        className={`
          relative overflow-hidden cursor-pointer transition-all duration-300
          ${!isCompleted 
            ? 'bg-white/5 border-white/10 grayscale opacity-60' 
            : canClaim 
              ? `bg-gradient-to-br ${rarity.bg} ${rarity.border} animate-pulse-glow` 
              : `bg-gradient-to-br ${rarity.bg} ${rarity.border}`
          }
        `}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.5 }}
                className="text-4xl"
              >
                {achievement.icon}
              </motion.div>
              <div>
                <CardTitle className="text-lg text-white mb-1">
                  {achievement.title}
                </CardTitle>
                <Badge className={rarity.badge}>
                  {achievement.rarity}
                </Badge>
              </div>
            </div>
            {isClaimed && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-1 text-emerald-400 bg-emerald-500/20 px-3 py-1 rounded-full text-xs font-semibold"
              >
                <CheckCircle2 className="w-3 h-3" />
                COMPLETED
              </motion.div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-white/60">
            {achievement.description}
          </p>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-white/60">
              <span>Progress</span>
              <span>{currentProgress} / {achievement.criteria.target}</span>
            </div>
            <Progress 
              value={(currentProgress / achievement.criteria.target) * 100} 
              className="h-2"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-amber-300">
            <Gift className="w-4 h-4" />
            <span>{achievement.reward.label}</span>
          </div>

          {canClaim && !isClaimed && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Button
                onClick={(e) => {
                  e.stopPropagation()
                  onClaim()
                }}
                disabled={claiming}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold"
              >
                {claiming ? 'Claiming...' : 'CLAIM REWARD 🎁'}
              </Button>
            </motion.div>
          )}

          {isCompleted && !isClaimed && !canClaim && (
            <div className="text-xs text-center text-white/40">
              Achievement submitted for review
            </div>
          )}
        </CardContent>

        {!isCompleted && (
          <div className="absolute top-4 right-4">
            <Lock className="w-4 h-4 text-white/40" />
          </div>
        )}
      </Card>
    </motion.div>
  )
}

function AchievementDetailDialog({
  achievement,
  progress,
  open,
  onClose,
  proofUrl,
  onProofUrlChange,
  onClaim,
  claiming
}: {
  achievement: Achievement | null
  progress: AchievementProgress | null
  open: boolean
  onClose: () => void
  proofUrl: string
  onProofUrlChange: (url: string) => void
  onClaim: () => void
  claiming: boolean
}) {
  if (!achievement) return null

  const rarity = RARITY_COLORS[achievement.rarity]
  const canClaim = progress?.canClaim || false
  const isClaimed = progress?.isClaimed || false

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gradient-to-br from-[#110a1f] to-[#0a0612] border-purple-500/30 text-white max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-4 mb-4">
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 0.5 }}
              className="text-6xl"
            >
              {achievement.icon}
            </motion.div>
            <div>
              <DialogTitle className="text-2xl mb-2">
                {achievement.title}
              </DialogTitle>
              <Badge className={rarity.badge}>
                {achievement.rarity}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <p className="text-white/80 leading-relaxed">
            {achievement.description}
          </p>

          <div className="bg-white/5 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-white/60">Category</span>
              <Badge variant="outline" className="border-white/20 text-white">
                {achievement.category}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/60">Type</span>
              <Badge variant="outline" className="border-white/20 text-white">
                {achievement.type}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/60">Criteria</span>
              <span className="text-white font-semibold">
                {achievement.criteria.description}
              </span>
            </div>
            {progress && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-white/60">
                  <span>Progress</span>
                  <span>{progress.progress} / {progress.target}</span>
                </div>
                <Progress 
                  value={(progress.progress / progress.target) * 100} 
                  className="h-2"
                />
              </div>
            )}
          </div>

          <div className="bg-gradient-to-br from-amber-500/10 to-orange-600/10 rounded-lg p-4 border border-amber-500/30">
            <div className="flex items-center gap-2 text-amber-400 font-semibold mb-2">
              <Gift className="w-5 h-5" />
              <span>Reward</span>
            </div>
            <p className="text-white/80">{achievement.reward.label}</p>
          </div>

          {achievement.type === 'manual' && !isClaimed && (
            <div className="space-y-2">
              <label className="text-sm text-white/60">Proof URL</label>
              <Input
                placeholder="https://..."
                value={proofUrl}
                onChange={(e) => onProofUrlChange(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-white/10 text-white hover:bg-white/5"
              disabled={claiming}
            >
              Close
            </Button>
            {canClaim && !isClaimed && (
              <Button
                onClick={onClaim}
                disabled={claiming}
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold"
              >
                {claiming ? 'Claiming...' : 'CLAIM REWARD 🎁'}
              </Button>
            )}
          </div>

          {achievement.type === 'manual' && isClaimed && (
            <div className="text-center text-emerald-400 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              <span>Submitted for review</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
