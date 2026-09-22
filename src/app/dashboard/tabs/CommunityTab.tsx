'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  Trophy, Flame, Crown, Medal, Users, Share2, Link2, Copy,
  Eye, EyeOff, Loader2, Lock, CheckCircle2, XCircle,
  TrendingUp, TrendingDown, BarChart3, ChevronRight, Star
} from 'lucide-react'
import type { Trade, Analytics } from '@/types'

// ==================== TYPES ====================

interface CommunityTabProps {
  trades: Trade[]
  analytics: Analytics | null
  language: 'id' | 'en'
  isPro: boolean
  profile?: any
  onAddTradeOpen: (open: boolean) => void
  onPublicProfileToggled?: () => void
}

interface LeaderboardEntry {
  rank: number
  userId: string
  displayName: string | null
  winRate: number
  totalPL: number
  totalTrades: number
  streak: number
  isPro: boolean
  avatarUrl: string | null
}

interface SharedTradeResponse {
 shareCode: string
  message?: string
}

interface SharedTradeView {
 trade: {
    symbol: string
    type: string
    plPercent: number
    plAmount: number
    session: string | null
    setupType: string | null
    closeTime: string
  }
  owner: {
    displayName: string | null
    isPro: boolean
    streak: number
    bestStreak: number
  } | null
  ownerStats: {
    totalTrades: number
    winRate: number
    totalPL: number
  } | null
}

// ==================== i18n ====================

const t = (key: string, lang: 'id' | 'en') => {
  const map: Record<string, { id: string; en: string }> = {
    community: { id: 'Komunitas', en: 'Community' },
    leaderboard: { id: 'Papan Peringkat', en: 'Leaderboard' },
    shareTrade: { id: 'Bagikan Trade', en: 'Share Trade' },
    myPublicProfile: { id: 'Profil Publik Saya', en: 'My Public Profile' },
    period: { id: 'Periode', en: 'Period' },
    week: { id: 'Minggu', en: 'Week' },
    month: { id: 'Bulan', en: 'Month' },
    all: { id: 'Semua', en: 'All' },
    sortBy: { id: 'Urutkan', en: 'Sort By' },
    winRate: { id: 'Win Rate', en: 'Win Rate' },
    totalPL: { id: 'Total P/L', en: 'Total P/L' },
    totalTrades: { id: 'Total Trade', en: 'Total Trades' },
    rank: { id: 'Peringkat', en: 'Rank' },
    trader: { id: 'Trader', en: 'Trader' },
    streak: { id: 'Streak', en: 'Streak' },
    trades: { id: 'Trade', en: 'Trades' },
    noData: { id: 'Belum ada data', en: 'No data yet' },
    leaderboardEmpty: {
      id: 'Belum ada trader yang tampil di leaderboard. Aktifkan profil publik untuk bergabung!',
      en: 'No traders on the leaderboard yet. Enable your public profile to join!',
    },
    shareYourBest: {
      id: 'Bagikan trade terbaikmu ke komunitas',
      en: 'Share your best trade with the community',
    },
    shareLatest: { id: 'Bagikan Trade Terbaru', en: 'Share Latest Trade' },
    shareSelected: { id: 'Bagikan Trade Ini', en: 'Share This Trade' },
    shareProOnly: {
      id: 'Fitur berbagi trade hanya tersedia untuk pengguna PRO',
      en: 'Trade sharing is a PRO feature',
    },
    upgrade: { id: 'Upgrade ke PRO', en: 'Upgrade to PRO' },
    includeAnalytics: { id: 'Sertakan statistik', en: 'Include analytics' },
    linkCopied: { id: 'Link berhasil disalin!', en: 'Link copied!' },
    copyLink: { id: 'Salin Link', en: 'Copy Link' },
    shareLink: { id: 'Link Berbagi', en: 'Share Link' },
    noTrades: {
      id: 'Belum ada trade untuk dibagikan',
      en: 'No trades to share yet',
    },
    publicProfileOn: {
      id: 'Profil publik Anda AKTIF. Statistik trading Anda akan muncul di leaderboard.',
      en: 'Your public profile is ON. Your trading stats will appear on the leaderboard.',
    },
    publicProfileOff: {
      id: 'Profil publik Anda NONAKTIF. Aktifkan untuk tampil di leaderboard.',
      en: 'Your public profile is OFF. Enable it to appear on the leaderboard.',
    },
    togglePublic: { id: 'Tampilkan di Leaderboard', en: 'Show on Leaderboard' },
    preview: { id: 'Pratinjau Publik', en: 'Public Preview' },
    howOthersSee: {
      id: 'Cara orang lain melihat profil Anda:',
      en: 'How others see your profile:',
    },
    anonymous: { id: 'Anonim', en: 'Anonymous' },
    loading: { id: 'Memuat...', en: 'Loading...' },
    error: { id: 'Terjadi kesalahan', en: 'An error occurred' },
    pro: { id: 'PRO', en: 'PRO' },
    viewSharedTrade: { id: 'Lihat Trade yang Dibagikan', en: 'View Shared Trade' },
    enterShareCode: { id: 'Masukkan kode berbagi', en: 'Enter share code' },
    lookup: { id: 'Cari', en: 'Lookup' },
    invalidCode: { id: 'Kode tidak valid', en: 'Invalid code' },
    pair: { id: 'Pasangan', en: 'Pair' },
    direction: { id: 'Arah', en: 'Direction' },
    result: { id: 'Hasil', en: 'Result' },
    setup: { id: 'Setup', en: 'Setup' },
    ownerStats: { id: 'Statistik Pemilik', en: 'Owner Stats' },
    noSharedTrade: {
      id: 'Trade yang dibagikan tidak ditemukan',
      en: 'Shared trade not found',
    },
  }
  return map[key]?.[lang] || key
}

// ==================== RANK MEDAL ====================

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <Medal className="w-6 h-6 text-yellow-400 fill-yellow-400" />
  if (rank === 2) return <Medal className="w-6 h-6 text-gray-300 fill-gray-300" />
  if (rank === 3) return <Medal className="w-6 h-6 text-amber-600 fill-amber-600" />
  return (
    <span className="w-6 h-6 flex items-center justify-center text-xs font-bold text-slate-400">
      {rank}
    </span>
  )
}

// ==================== SUB-TAB BAR ====================

const subTabs = [
  { id: 'leaderboard', icon: Trophy },
  { id: 'share', icon: Share2 },
  { id: 'profile', icon: Eye },
] as const

type SubTabId = typeof subTabs[number]['id']

function SubTabBar({
  active,
  onChange,
  language,
}: {
  active: SubTabId
  onChange: (id: SubTabId) => void
  language: 'id' | 'en'
}) {
  return (
    <div className="flex gap-1 p-1 rounded-lg bg-slate-800/50 border border-slate-700/50">
      {subTabs.map(({ id, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
            active === id
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
          }`}
        >
          <Icon className="w-4 h-4" />
          <span className="hidden sm:inline">{t(id, language)}</span>
        </button>
      ))}
    </div>
  )
}

// ==================== LEADERBOARD SECTION ====================

function LeaderboardSection({ language, refreshKey }: { language: 'id' | 'en'; refreshKey?: number }) {
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('month')
  const [sortBy, setSortBy] = useState<'winRate' | 'totalPL' | 'totalTrades'>('totalPL')
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ period, sortBy, refresh: '1' })
      const res = await fetch(`/api/community/leaderboard?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLeaderboard(data.leaderboard || [])
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [period, sortBy])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard, refreshKey])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Period filter */}
        <div className="flex gap-1 p-1 rounded-lg bg-slate-800/50 border border-slate-700/50">
          {(['week', 'month', 'all'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t(p, language)}
            </button>
          ))}
        </div>

        {/* Sort by */}
        <div className="flex gap-1 p-1 rounded-lg bg-slate-800/50 border border-slate-700/50">
          {(['totalPL', 'winRate', 'totalTrades'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                sortBy === s
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t(s, language)}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard Table */}
      <Card className="bg-[#0d1117] border-slate-700/50 dark:bg-[#0a0c12]">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
              <Users className="w-10 h-10 opacity-30" />
              <p className="text-sm">{t('leaderboardEmpty', language)}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50 text-slate-400 text-xs">
                    <th className="py-3 px-4 text-left font-medium">#{t('rank', language)}</th>
                    <th className="py-3 px-4 text-left font-medium">{t('trader', language)}</th>
                    <th className="py-3 px-4 text-left font-medium">{t('winRate', language)}</th>
                    <th className="py-3 px-4 text-right font-medium">{t('totalPL', language)}</th>
                    <th className="py-3 px-4 text-right font-medium hidden sm:table-cell">{t('totalTrades', language)}</th>
                    <th className="py-3 px-4 text-center font-medium">{t('streak', language)}</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, idx) => (
                    <motion.tr
                      key={entry.userId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${
                        entry.rank <= 3 ? 'bg-slate-800/20' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <RankMedal rank={entry.rank} />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                            {entry.avatarUrl ? (
                              <img src={entry.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                            ) : (
                              (entry.displayName || 'A').charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-200">
                              {entry.displayName || t('anonymous', language)}
                            </span>
                            {entry.isPro && (
                              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-[10px] px-1.5 py-0 h-4 border-0">
                                <Crown className="w-2.5 h-2.5 mr-0.5" />
                                {t('pro', language)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                entry.winRate >= 60
                                  ? 'bg-emerald-500'
                                  : entry.winRate >= 40
                                    ? 'bg-amber-500'
                                    : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(entry.winRate, 100)}%` }}
                            />
                          </div>
                          <span
                            className={`text-xs font-mono font-medium ${
                              entry.winRate >= 60
                                ? 'text-emerald-400'
                                : entry.winRate >= 40
                                  ? 'text-amber-400'
                                  : 'text-red-400'
                            }`}
                          >
                            {entry.winRate}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`text-sm font-mono font-medium ${
                            entry.totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {entry.totalPL >= 0 ? '+' : ''}{entry.totalPL.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right hidden sm:table-cell">
                        <span className="text-sm text-slate-400">{entry.totalTrades}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {entry.streak > 0 && <Flame className="w-3.5 h-3.5 text-orange-400" />}
                          <span className="text-sm text-slate-300 font-medium">{entry.streak}</span>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ==================== SHARE TRADE SECTION ====================

function ShareTradeSection({
  trades,
  analytics,
  isPro,
  language,
  onAddTradeOpen,
}: {
  trades: Trade[]
  analytics: Analytics | null
  isPro: boolean
  language: 'id' | 'en'
  onAddTradeOpen: (open: boolean) => void
}) {
  const [includeAnalytics, setIncludeAnalytics] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [shareCode, setShareCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // View shared trade
  const [lookupCode, setLookupCode] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [sharedView, setSharedView] = useState<SharedTradeView | null>(null)
  const [lookupError, setLookupError] = useState('')

  const latestTrade = trades.length > 0
    ? [...trades].sort((a, b) => new Date(b.close_time).getTime() - new Date(a.close_time).getTime())[0]
    : null

  const handleShare = async (tradeId: string) => {
    if (!isPro) return
    setSharing(true)
    setShareCode(null)
    try {
      const res = await fetch('/api/community/share-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeId, includeAnalytics }),
      })
      if (res.ok) {
        const data: SharedTradeResponse = await res.json()
        setShareCode(data.shareCode)
        toast.success(t('linkCopied', language))
      }
    } catch {
      toast.error(t('error', language))
    } finally {
      setSharing(false)
    }
  }

  const handleCopyLink = () => {
    if (!shareCode) return
    navigator.clipboard.writeText(`${window.location.origin}/shared/${shareCode}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success(t('linkCopied', language))
  }

  const handleLookup = async () => {
    if (!lookupCode.trim()) return
    setLookupLoading(true)
    setLookupError('')
    setSharedView(null)
    try {
      const res = await fetch(`/api/community/share-trade?code=${lookupCode.trim().toUpperCase()}`)
      if (res.ok) {
        const data = await res.json()
        setSharedView(data)
      } else {
        setLookupError(t('invalidCode', language))
      }
    } catch {
      setLookupError(t('error', language))
    } finally {
      setLookupLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* PRO Gate */}
      {!isPro ? (
        <Card className="bg-[#0d1117] border-slate-700/50 dark:bg-[#0a0c12]">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center">
              <Lock className="w-6 h-6 text-slate-500" />
            </div>
            <div className="text-center">
              <p className="text-slate-300 font-medium">{t('shareTrade', language)}</p>
              <p className="text-sm text-slate-500 mt-1">{t('shareProOnly', language)}</p>
            </div>
            <Button
              onClick={() => onAddTradeOpen(false)}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0"
            >
              <Crown className="w-4 h-4 mr-2" />
              {t('upgrade', language)}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Share Latest Trade */}
          <Card className="bg-[#0d1117] border-slate-700/50 dark:bg-[#0a0c12]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-slate-200">
                <Share2 className="w-4 h-4 text-blue-400" />
                {t('shareTrade', language)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!latestTrade ? (
                <div className="flex flex-col items-center py-8 text-slate-500 gap-2">
                  <BarChart3 className="w-8 h-8 opacity-30" />
                  <p className="text-sm">{t('noTrades', language)}</p>
                </div>
              ) : (
                <>
                  {/* Analytics toggle */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                    <span className="text-sm text-slate-300">{t('includeAnalytics', language)}</span>
                    <Switch
                      checked={includeAnalytics}
                      onCheckedChange={setIncludeAnalytics}
                    />
                  </div>

                  {/* Latest trade preview card */}
                  <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={latestTrade.type === 'BUY' ? 'default' : 'destructive'}
                          className={latestTrade.type === 'BUY'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-red-500/20 text-red-400 border-red-500/30'
                          }
                        >
                          {latestTrade.type}
                        </Badge>
                        <span className="text-sm font-medium text-slate-200">{latestTrade.symbol}</span>
                      </div>
                      <span
                        className={`text-sm font-mono font-bold ${
                          latestTrade.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {latestTrade.profit_loss >= 0 ? '+' : ''}{latestTrade.profit_loss.toFixed(2)}
                      </span>
                    </div>
                    {latestTrade.setup_type && (
                      <Badge variant="outline" className="text-xs text-slate-400 border-slate-600">
                        {latestTrade.setup_type}
                      </Badge>
                    )}
                    <Button
                      onClick={() => handleShare(latestTrade.id)}
                      disabled={sharing}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white border-0"
                    >
                      {sharing ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Share2 className="w-4 h-4 mr-2" />
                      )}
                      {t('shareLatest', language)}
                    </Button>
                  </div>

                  {/* Share link result */}
                  <AnimatePresence>
                    {shareCode && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                          <Link2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <Input
                            readOnly
                            value={`${typeof window !== 'undefined' ? window.location.origin : ''}/shared/${shareCode}`}
                            className="bg-transparent border-0 text-sm text-emerald-300 p-0 h-auto font-mono"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCopyLink}
                            className="shrink-0 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20"
                          >
                            {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </CardContent>
          </Card>

          {/* View Shared Trade */}
          <Card className="bg-[#0d1117] border-slate-700/50 dark:bg-[#0a0c12]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-slate-200">
                <Eye className="w-4 h-4 text-blue-400" />
                {t('viewSharedTrade', language)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder={t('enterShareCode', language)}
                  value={lookupCode}
                  onChange={(e) => setLookupCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                  className="bg-slate-800/50 border-slate-700/50 text-slate-200 placeholder:text-slate-500 uppercase font-mono"
                  maxLength={12}
                />
                <Button
                  onClick={handleLookup}
                  disabled={lookupLoading || !lookupCode.trim()}
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:bg-slate-700 shrink-0"
                >
                  {lookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                </Button>
              </div>

              {lookupError && (
                <p className="text-sm text-red-400 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> {lookupError}
                </p>
              )}

              <AnimatePresence>
                {sharedView && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={
                            sharedView.trade.type === 'BUY'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              : 'bg-red-500/20 text-red-400 border-red-500/30'
                          }
                        >
                          {sharedView.trade.type}
                        </Badge>
                        <span className="text-sm font-medium text-slate-200">{sharedView.trade.symbol}</span>
                      </div>
                      <span
                        className={`text-sm font-mono font-bold ${
                          sharedView.trade.plAmount >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {sharedView.trade.plPercent >= 0 ? '+' : ''}{sharedView.trade.plPercent}%
                      </span>
                    </div>
                    {sharedView.trade.setupType && (
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>{t('setup', language)}:</span>
                        <Badge variant="outline" className="text-xs border-slate-600">
                          {sharedView.trade.setupType}
                        </Badge>
                      </div>
                    )}
                    {sharedView.owner && (
                      <div className="pt-2 border-t border-slate-700/50">
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <Users className="w-3.5 h-3.5" />
                          <span>{sharedView.owner.displayName || t('anonymous', language)}</span>
                          {sharedView.owner.isPro && (
                            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-[10px] px-1.5 py-0 h-4 border-0">
                              <Crown className="w-2.5 h-2.5 mr-0.5" /> PRO
                            </Badge>
                          )}
                          {sharedView.owner.streak > 0 && (
                            <span className="flex items-center gap-0.5 text-orange-400">
                              <Flame className="w-3 h-3" /> {sharedView.owner.streak}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {sharedView.ownerStats && (
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-700/50">
                        <div className="text-center">
                          <p className="text-xs text-slate-500">{t('totalTrades', language)}</p>
                          <p className="text-sm font-mono text-slate-300">{sharedView.ownerStats.totalTrades}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-slate-500">{t('winRate', language)}</p>
                          <p className="text-sm font-mono text-emerald-400">{sharedView.ownerStats.winRate}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-slate-500">{t('totalPL', language)}</p>
                          <p className={`text-sm font-mono ${sharedView.ownerStats.totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {sharedView.ownerStats.totalPL >= 0 ? '+' : ''}{sharedView.ownerStats.totalPL}
                          </p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </>
      )}
    </motion.div>
  )
}

// ==================== PUBLIC PROFILE SECTION ====================

function PublicProfileSection({
  trades,
  analytics,
  profile,
  language,
  onPublicProfileToggled,
}: {
  trades: Trade[]
  analytics: Analytics | null
  profile?: any
  language: 'id' | 'en'
  onPublicProfileToggled?: () => void
}) {
  const [isPublic, setIsPublic] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/community/public-profile')
        if (res.ok) {
          const data = await res.json()
          setIsPublic(data.publicProfile)
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false)
      }
    }
    fetchStatus()
  }, [])

  const handleToggle = async (checked: boolean) => {
    setToggling(true)
    try {
      const res = await fetch('/api/community/public-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicProfile: checked }),
      })
      if (res.ok) {
        const data = await res.json()
        setIsPublic(data.publicProfile)
        toast.success(checked
          ? (language === 'id' ? 'Profil publik diaktifkan!' : 'Public profile enabled!')
          : (language === 'id' ? 'Profil publik dinonaktifkan' : 'Public profile disabled')
        )
        onPublicProfileToggled?.()
      }
    } catch {
      toast.error(t('error', language))
    } finally {
      setToggling(false)
    }
  }

  const displayName = profile?.full_name || profile?.email || 'Trader'
  const totalTrades = trades.length
  const wins = trades.filter((t) => t.profit_loss > 0).length
  const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 1000) / 10 : 0
  const totalPL = trades.reduce((sum, t) => sum + t.profit_loss, 0)
  const currentStreak = profile?.streak_count || 0
  const bestStreak = profile?.best_streak || 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Toggle Card */}
      <Card className="bg-[#0d1117] border-slate-700/50 dark:bg-[#0a0c12]">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                isPublic ? 'bg-emerald-500/20' : 'bg-slate-800'
              }`}>
                {isPublic
                  ? <Eye className="w-5 h-5 text-emerald-400" />
                  : <EyeOff className="w-5 h-5 text-slate-500" />
                }
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200">{t('togglePublic', language)}</p>
                <p className={`text-xs mt-0.5 ${isPublic ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {isPublic ? t('publicProfileOn', language) : t('publicProfileOff', language)}
                </p>
              </div>
            </div>
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            ) : (
              <Switch
                checked={isPublic}
                onCheckedChange={handleToggle}
                disabled={toggling}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Public Preview Card */}
      <Card className="bg-[#0d1117] border-slate-700/50 dark:bg-[#0a0c12]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-slate-200">
            <Star className="w-4 h-4 text-blue-400" />
            {t('preview', language)}
          </CardTitle>
          <p className="text-xs text-slate-500">{t('howOthersSee', language)}</p>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-sm font-bold text-white">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-200">{displayName}</span>
                  {profile?.is_pro && (
                    <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-[10px] px-1.5 py-0 h-4 border-0">
                      <Crown className="w-2.5 h-2.5 mr-0.5" /> PRO
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Flame className="w-3 h-3 text-orange-400" />
                  <span>{currentStreak} {t('streak', language).toLowerCase()}</span>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center p-2 rounded-lg bg-slate-800/50">
                <p className="text-xs text-slate-500">{t('totalTrades', language)}</p>
                <p className="text-lg font-mono font-bold text-slate-200">{totalTrades}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-slate-800/50">
                <p className="text-xs text-slate-500">{t('winRate', language)}</p>
                <p className={`text-lg font-mono font-bold ${
                  winRate >= 50 ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {winRate}%
                </p>
              </div>
              <div className="text-center p-2 rounded-lg bg-slate-800/50">
                <p className="text-xs text-slate-500">{t('totalPL', language)}</p>
                <p className={`text-lg font-mono font-bold ${
                  totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {totalPL >= 0 ? '+' : ''}{totalPL.toFixed(0)}
                </p>
              </div>
              <div className="text-center p-2 rounded-lg bg-slate-800/50">
                <p className="text-xs text-slate-500">Best {t('streak', language)}</p>
                <p className="text-lg font-mono font-bold text-orange-400">{bestStreak}</p>
              </div>
            </div>

            {/* Win rate bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-500">
                <span>{t('winRate', language)}</span>
                <span>{winRate}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    winRate >= 60
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                      : winRate >= 40
                        ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                        : 'bg-gradient-to-r from-red-500 to-red-400'
                  }`}
                  style={{ width: `${Math.min(winRate, 100)}%` }}
                />
              </div>
            </div>

            {!isPublic && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <EyeOff className="w-4 h-4 text-amber-400 shrink-0" />
                <p className="text-xs text-amber-400">
                  {language === 'id'
                    ? 'Profil Anda saat ini privat dan tidak terlihat oleh orang lain.'
                    : 'Your profile is currently private and not visible to others.'
                  }
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ==================== MAIN COMMUNITY TAB ====================

export default function CommunityTab({
  trades,
  analytics,
  language,
  isPro,
  profile,
  onAddTradeOpen,
  onPublicProfileToggled,
}: CommunityTabProps) {
  const [activeSection, setActiveSection] = useState<SubTabId>('leaderboard')
  const [refreshKey, setRefreshKey] = useState(0)

  const handlePublicProfileToggled = useCallback(() => {
    setRefreshKey(prev => prev + 1)
    onPublicProfileToggled?.()
  }, [onPublicProfileToggled])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
          <Users className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-100">{t('community', language)}</h2>
          <p className="text-xs text-slate-500">{language === 'id' ? 'Bandingkan, bagikan, dan bersaing' : 'Compare, share, and compete'}</p>
        </div>
      </div>

      {/* Sub Tab Bar */}
      <SubTabBar active={activeSection} onChange={setActiveSection} language={language} />

      {/* Sections */}
      <AnimatePresence mode="wait">
        {activeSection === 'leaderboard' && (
          <LeaderboardSection key="leaderboard" language={language} refreshKey={refreshKey} />
        )}
        {activeSection === 'share' && (
          <ShareTradeSection
            key="share"
            trades={trades}
            analytics={analytics}
            isPro={isPro}
            language={language}
            onAddTradeOpen={onAddTradeOpen}
          />
        )}
        {activeSection === 'profile' && (
          <PublicProfileSection
            key="profile"
            trades={trades}
            analytics={analytics}
            profile={profile}
            language={language}
            onPublicProfileToggled={handlePublicProfileToggled}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
