'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '@/contexts/LanguageContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Sparkles, Link2, Lock, Server, Shield, CheckCircle, XCircle, Loader2, Zap, Trophy, Star, Award, TrendingUp, Database } from 'lucide-react'
import { toast } from 'sonner'
import PaywallModal from '@/components/PaywallModal'
import { TradingAccount } from '@/types/trading-account'

type Platform = 'MT4' | 'MT5'

interface FormData {
  platform: Platform
  accountNumber: string
  password: string
  brokerServer: string
}

interface Achievement {
  id: string
  icon: React.ElementType
  title: string
  titleId: string
  description: string
  descriptionId: string
  unlocked: boolean
  progress: number
  max: number
}

export default function ConnectionsPage() {
  const { language, t } = useLanguage()
  const [formData, setFormData] = useState<FormData>({
    platform: 'MT5',
    accountNumber: '',
    password: '',
    brokerServer: ''
  })
  const [isConnecting, setIsConnecting] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [connectedAccounts, setConnectedAccounts] = useState<TradingAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [userPlan, setUserPlan] = useState<string>('free')
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null)
  const [syncProgress, setSyncProgress] = useState(0)
  const [totalTrades, setTotalTrades] = useState(0)

  // Text content in both languages
  const content = {
    title: language === 'id' ? 'Koneksi Akun Trading' : 'Trading Account Connections',
    subtitle: language === 'id'
      ? 'Hubungkan akun MT4/MT5 Anda untuk sinkronisasi otomatis jurnal trading'
      : 'Connect your MT4/MT5 accounts for automatic trading journal sync',
    platformLabel: language === 'id' ? 'Platform' : 'Platform',
    accountNumberLabel: language === 'id' ? 'Nomor Akun' : 'Account Number',
    passwordLabel: language === 'id' ? 'Password Investor' : 'Investor Password',
    brokerServerLabel: language === 'id' ? 'Nama Server Broker' : 'Broker Server Name',
    platformPlaceholder: language === 'id' ? 'Pilih platform' : 'Select platform',
    accountNumberPlaceholder: language === 'id' ? 'Contoh: 12345678' : 'Example: 12345678',
    passwordPlaceholder: language === 'id' ? 'Masukkan password investor' : 'Enter investor password',
    brokerServerPlaceholder: language === 'id' ? 'Contoh: Exness-Real10' : 'Example: Exness-Real10',
    connectButton: language === 'id' ? '⚡ Hubungkan Akun Otomatis' : '⚡ Connect Account Automatically',
    connectingButton: language === 'id' ? 'Menghubungkan...' : 'Connecting...',
    connectedAccounts: language === 'id' ? 'Akun Terhubung' : 'Connected Accounts',
    noAccounts: language === 'id' ? 'Belum ada akun terhubung' : 'No connected accounts yet',
    statusConnected: language === 'id' ? 'Terhubung' : 'Connected',
    statusPending: language === 'id' ? 'Menunggu' : 'Pending',
    statusError: language === 'id' ? 'Error' : 'Error',
    disconnectButton: language === 'id' ? 'Putuskan' : 'Disconnect',
    syncButton: language === 'id' ? 'Sync Sekarang' : 'Sync Now',
    syncingButton: language === 'id' ? 'Sinkronisasi...' : 'Syncing...',
    syncSuccess: language === 'id' ? 'Sinkronisasi berhasil!' : 'Sync completed successfully!',
    syncError: language === 'id' ? 'Sinkronisasi gagal!' : 'Sync failed!',
    quotaReachedTitle: language === 'id' ? 'Kuota Akun Penuh!' : 'Account Limit Reached!',
    quotaReachedMessageFree: language === 'id'
      ? 'Akun Free maksimal 1 akun. Upgrade ke PRO untuk mengoneksikan hingga 3 akun!'
      : 'Free users can only connect 1 account. Upgrade to PRO to connect up to 3 accounts!',
    quotaReachedMessagePro: language === 'id'
      ? 'Akun PRO maksimal 3 akun. Upgrade ke ULTRA untuk mengoneksikan hingga 5 akun!'
      : 'PRO users can connect up to 3 accounts. Upgrade to ULTRA to connect up to 5 accounts!',
    quotaReachedMessageUltra: language === 'id'
      ? 'Akun ULTRA maksimal 5 akun. Anda sudah mencapai batas maksimal!'
      : 'ULTRA users can connect up to 5 accounts. You have reached the maximum limit!',
    securityNote: language === 'id'
      ? '🔒 Data Anda aman. Kami menggunakan enkripsi end-to-end untuk kredensial akun trading Anda.'
      : '🔒 Your data is secure. We use end-to-end encryption for your trading account credentials.',
    passwordHint: language === 'id'
      ? 'Gunakan password investor, bukan password utama akun trading Anda'
      : 'Use the investor password, not your main trading account password',
    successMessage: language === 'id'
      ? 'Akun berhasil terhubung! Sinkronisasi trading akan dimulai segera.'
      : 'Account successfully connected! Trading sync will start shortly.',
    errorMessage: language === 'id'
      ? 'Gagal menghubungkan akun. Silakan periksa kredensial dan coba lagi.'
      : 'Failed to connect account. Please check your credentials and try again.',
    invalidPlatform: language === 'id' ? 'Platform harus MT4 atau MT5' : 'Platform must be MT4 or MT5',
    missingFields: language === 'id' ? 'Mohon lengkapi semua field yang diperlukan' : 'Please fill in all required fields',
    achievementsTitle: language === 'id' ? 'Pencapaian' : 'Achievements',
    achievementFirstConnection: {
      title: language === 'id' ? 'Koneksi Pertama' : 'First Connection',
      description: language === 'id' ? 'Hubungkan akun MT4/MT5 pertama Anda' : 'Connect your first MT4/MT5 account'
    },
    achievementMultipleAccounts: {
      title: language === 'id' ? 'Trader Multi-Akun' : 'Multi-Account Trader',
      description: language === 'id' ? 'Hubungkan 3 akun trading' : 'Connect 3 trading accounts'
    },
    achievementTradeMaster: {
      title: language === 'id' ? 'Master Trading' : 'Trade Master',
      description: language === 'id' ? 'Sinkronisasi 100+ trades' : 'Sync 100+ trades'
    },
  }

  // Calculate achievements based on current state
  const achievements: Achievement[] = [
    {
      id: 'first-connection',
      icon: Star,
      title: content.achievementFirstConnection.title,
      titleId: content.achievementFirstConnection.title,
      description: content.achievementFirstConnection.description,
      descriptionId: content.achievementFirstConnection.description,
      unlocked: connectedAccounts.length > 0,
      progress: connectedAccounts.length > 0 ? 1 : 0,
      max: 1
    },
    {
      id: 'multiple-accounts',
      icon: Award,
      title: content.achievementMultipleAccounts.title,
      titleId: content.achievementMultipleAccounts.title,
      description: content.achievementMultipleAccounts.description,
      descriptionId: content.achievementMultipleAccounts.description,
      unlocked: connectedAccounts.length >= 3,
      progress: connectedAccounts.length,
      max: 3
    },
    {
      id: 'trade-master',
      icon: Trophy,
      title: content.achievementTradeMaster.title,
      titleId: content.achievementTradeMaster.title,
      description: content.achievementTradeMaster.description,
      descriptionId: content.achievementTradeMaster.description,
      unlocked: totalTrades >= 100,
      progress: totalTrades,
      max: 100
    }
  ]

  // Fetch user's connected accounts on mount
  useEffect(() => {
    fetchConnectedAccounts()
  }, [])

  // Simulate sync progress when syncing
  useEffect(() => {
    if (syncingAccountId) {
      setSyncProgress(0)
      const interval = setInterval(() => {
        setSyncProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval)
            return 90
          }
          return prev + Math.random() * 15
        })
      }, 500)
      return () => clearInterval(interval)
    }
  }, [syncingAccountId])

  const fetchConnectedAccounts = async () => {
    try {
      setLoadingAccounts(true)
      const response = await fetch('/api/trading-accounts')

      if (!response.ok) {
        // Just log the error, don't show toast - user might not be authenticated yet
        console.error('Failed to fetch accounts:', response.status)
        setConnectedAccounts([])
        setUserPlan('free')
        return
      }

      const data = await response.json()
      setConnectedAccounts(data.data || [])
      setUserPlan(data.quota?.maxAllowed === 1 ? 'free' : data.quota?.maxAllowed === 3 ? 'pro' : 'ultra')

      // Fetch total trades count
      try {
        const tradesRes = await fetch('/api/trades')
        if (tradesRes.ok) {
          const tradesData = await tradesRes.json()
          setTotalTrades(tradesData.trades?.length || 0)
        }
      } catch (e) {
        // Ignore trades fetch error
      }
    } catch (error) {
      console.error('Error fetching accounts:', error)
      // Silently fail - just show empty state
      setConnectedAccounts([])
      setUserPlan('free')
    } finally {
      setLoadingAccounts(false)
    }
  }

  // Check quota before connecting
  const checkQuotaAndProceed = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/trading-accounts/quota')

      if (!response.ok) {
        throw new Error('Failed to check quota')
      }

      const data = await response.json()

      if (!data.quota.canAddMore) {
        // Show paywall modal with appropriate message
        setShowPaywall(true)
        return false
      }

      return true
    } catch (error) {
      console.error('Error checking quota:', error)
      return false
    }
  }

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('🔵 [DEBUG] handleConnect called', { formData, isConnecting })

    // Validate form
    if (!formData.accountNumber || !formData.password || !formData.brokerServer) {
      console.log('🔴 [DEBUG] Validation failed - missing fields')
      toast.error(content.missingFields)
      return
    }

    console.log('🟢 [DEBUG] Validation passed, checking quota...')
    // Check quota before proceeding
    const canProceed = await checkQuotaAndProceed()
    console.log('🟡 [DEBUG] Quota check result:', canProceed)
    if (!canProceed) {
      return
    }

    console.log('🟣 [DEBUG] Starting connection process...')
    setIsConnecting(true)

    try {
      // Step 1: Create trading account record
      const createResponse = await fetch('/api/trading-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_number: formData.accountNumber,
          broker_server: formData.brokerServer,
          platform: formData.platform,
        }),
      })

      const createData = await createResponse.json()

      if (!createResponse.ok) {
        if (createResponse.status === 403) {
          // Quota exceeded
          setShowPaywall(true)
          return
        }
        throw new Error(createData.error || 'Failed to create trading account')
      }

      const tradingAccountId = createData.data.id

      // Step 2: Connect to MetaApi
      const metaApiResponse = await fetch('/api/metaapi/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tradingAccountId,
          accountNumber: formData.accountNumber,
          password: formData.password,
          brokerServer: formData.brokerServer,
          platform: formData.platform,
        }),
      })

      const metaApiData = await metaApiResponse.json()

      if (!metaApiResponse.ok) {
        // Update status to ERROR in our database
        await fetch(`/api/trading-accounts/${tradingAccountId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'ERROR' }),
        })

        throw new Error(metaApiData.error || 'Failed to connect to MetaApi')
      }

      // Success!
      toast.success(content.successMessage)

      // Reset form
      setFormData({
        platform: 'MT5',
        accountNumber: '',
        password: '',
        brokerServer: ''
      })

      // Refresh accounts list
      await fetchConnectedAccounts()
    } catch (error) {
      console.error('Error connecting account:', error)
      toast.error(content.errorMessage)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async (accountId: string) => {
    if (!confirm(language === 'id' ? 'Apakah Anda yakin ingin memutus koneksi akun ini?' : 'Are you sure you want to disconnect this account?')) {
      return
    }

    try {
      const response = await fetch(`/api/trading-accounts/${accountId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to disconnect account')
      }

      toast.success(language === 'id' ? 'Akun berhasil diputus' : 'Account successfully disconnected')

      // Refresh accounts list
      await fetchConnectedAccounts()
    } catch (error) {
      console.error('Error disconnecting account:', error)
      toast.error(language === 'id' ? 'Gagal memutus koneksi akun' : 'Failed to disconnect account')
    }
  }

  const handleSync = async (accountId: string) => {
    setSyncingAccountId(accountId)

    try {
      const response = await fetch(`/api/metaapi/deals?tradingAccountId=${accountId}`)

      if (!response.ok) {
        throw new Error('Failed to sync deals')
      }

      const data = await response.json()

      if (data.success) {
        const { synced, skipped, totalFetched, errors } = data.data.sync

        setSyncProgress(100)
        setTotalTrades(prev => prev + synced)

        if (errors && errors.length > 0) {
          toast.warning(
            `${content.syncSuccess} ${synced} synced, ${skipped} skipped. Some errors occurred.`,
            { description: errors.slice(0, 3).join(', ') }
          )
        } else {
          toast.success(
            `${content.syncSuccess} ${synced}/${totalFetched} trades synced.`
          )
        }
      }
    } catch (error) {
      console.error('Error syncing deals:', error)
      toast.error(content.syncError)
    } finally {
      setSyncingAccountId(null)
      setSyncProgress(0)
    }
  }

  // Loading Skeleton Component
  function LoadingSkeleton() {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="h-6 bg-white/10 rounded w-32 mb-2 animate-pulse" />
                <div className="h-4 bg-white/5 rounded w-48 animate-pulse" />
              </div>
              <div className="h-6 bg-white/10 rounded-full w-20 animate-pulse" />
            </div>
            <div className="flex items-center justify-between">
              <div className="h-3 bg-white/5 rounded w-24 animate-pulse" />
              <div className="flex gap-2">
                <div className="h-8 bg-white/10 rounded w-20 animate-pulse" />
                <div className="h-8 bg-white/10 rounded w-16 animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Achievement Card Component
  function AchievementCard({ achievement }: { achievement: Achievement }) {
    const Icon = achievement.icon
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 + achievements.indexOf(achievement) * 0.1 }}
        className={`p-4 rounded-xl border transition-all ${
          achievement.unlocked
            ? 'bg-gradient-to-br from-purple-500/20 to-violet-500/20 border-purple-500/30'
            : 'bg-white/[0.03] border-white/[0.08] opacity-60'
        }`}
      >
        <div className="flex items-start gap-3">
          <motion.div
            className={`p-2.5 rounded-lg ${
              achievement.unlocked
                ? 'bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg shadow-purple-500/30'
                : 'bg-white/5'
            }`}
            animate={achievement.unlocked ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 2, repeat: achievement.unlocked ? Infinity : 0, repeatDelay: 3 }}
          >
            <Icon className={`w-5 h-5 ${achievement.unlocked ? 'text-white' : 'text-white/30'}`} />
          </motion.div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className={`font-semibold text-sm ${achievement.unlocked ? 'text-white' : 'text-white/50'}`}>
                {achievement.title}
              </h4>
              {achievement.unlocked && (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0">
                  ✓
                </Badge>
              )}
            </div>
            <p className="text-xs text-white/40 mb-2">{achievement.description}</p>
            <Progress
              value={(achievement.progress / achievement.max) * 100}
              className={`h-1.5 ${achievement.unlocked ? 'bg-purple-900/30' : 'bg-white/10'}`}
            />
            <p className="text-[10px] text-white/30 mt-1">
              {achievement.progress}/{achievement.max}
            </p>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f051d] text-white p-6">
      {/* Paywall Modal for quota exceeded */}
      {showPaywall && (
        <PaywallModal
          isOpen={showPaywall}
          onClose={() => setShowPaywall(false)}
          onUpgrade={() => {
            setShowPaywall(false)
            // Navigate to pricing or open upgrade modal
            window.location.href = '/#pricing'
          }}
          remainingTrials={0}
          featureName={content.quotaReachedTitle}
        />
      )}

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <motion.div
            className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600"
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          >
            <Link2 className="w-6 h-6 text-white" />
          </motion.div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-white to-purple-300 bg-clip-text text-transparent">
            {content.title}
          </h1>
          {connectedAccounts.length > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="ml-auto"
            >
              <Badge className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30">
                <CheckCircle className="w-3 h-3 mr-1" />
                {connectedAccounts.length} {connectedAccounts.length === 1 ? 'Account' : 'Accounts'}
              </Badge>
            </motion.div>
          )}
        </div>
        <p className="text-white/60 text-lg">{content.subtitle}</p>
      </motion.div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connection Form */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="relative z-10"
        >
          <Card className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] overflow-hidden relative z-10">
            <CardHeader className="bg-gradient-to-r from-purple-500/10 to-violet-500/10 border-b border-white/[0.08]">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Sparkles className="w-5 h-5 text-purple-400" />
                {language === 'id' ? 'Tambah Koneksi Baru' : 'Add New Connection'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 relative z-10">
              <form onSubmit={handleConnect} className="space-y-5 relative z-10">
                {/* Platform Selection */}
                <div className="space-y-2">
                  <Label className="text-white/90 font-medium flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-400" />
                    {content.platformLabel}
                  </Label>
                  <Select
                    value={formData.platform}
                    onValueChange={(value: Platform) => setFormData({ ...formData, platform: value })}
                  >
                    <SelectTrigger className="bg-[#0a0712] border-purple-900/30 text-white h-12">
                      <SelectValue placeholder={content.platformPlaceholder} />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0f0b18] border-purple-900/30">
                      <SelectItem value="MT4">MT4 (MetaTrader 4)</SelectItem>
                      <SelectItem value="MT5">MT5 (MetaTrader 5)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Account Number */}
                <div className="space-y-2">
                  <Label className="text-white/90 font-medium flex items-center gap-2">
                    <Server className="w-4 h-4 text-purple-400" />
                    {content.accountNumberLabel}
                  </Label>
                  <Input
                    type="text"
                    placeholder={content.accountNumberPlaceholder}
                    value={formData.accountNumber}
                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                    className="bg-[#0a0712] border-purple-900/30 text-white h-12 placeholder:text-white/30"
                    required
                  />
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label className="text-white/90 font-medium flex items-center gap-2">
                    <Lock className="w-4 h-4 text-purple-400" />
                    {content.passwordLabel}
                  </Label>
                  <Input
                    type="password"
                    placeholder={content.passwordPlaceholder}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="bg-[#0a0712] border-purple-900/30 text-white h-12 placeholder:text-white/30"
                    required
                  />
                  <p className="text-xs text-white/40 flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    {content.passwordHint}
                  </p>
                </div>

                {/* Broker Server */}
                <div className="space-y-2">
                  <Label className="text-white/90 font-medium">
                    {content.brokerServerLabel}
                  </Label>
                  <Input
                    type="text"
                    placeholder={content.brokerServerPlaceholder}
                    value={formData.brokerServer}
                    onChange={(e) => setFormData({ ...formData, brokerServer: e.target.value })}
                    className="bg-[#0a0712] border-purple-900/30 text-white h-12 placeholder:text-white/30"
                    required
                  />
                </div>

                {/* Security Notice */}
                {/* <Alert className="bg-purple-500/10 border-purple-500/30 relative z-0">
                  <AlertDescription className="text-xs text-purple-200/80">
                    {content.securityNote}
                  </AlertDescription>
                </Alert> */}

                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 relative z-0">
                  <p className="text-xs text-purple-200/80">
                    {content.securityNote}
                  </p>
                </div>

                {/* Connect Button */}
                <div className="relative z-[9999]">
                  <Button
                    type="submit"
                    disabled={isConnecting}
                    onClick={(e) => {
                      console.log('🔴 [DEBUG] Button clicked!', { e, isConnecting, formData })
                    }}
                    className="w-full h-14 bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white font-extrabold shadow-lg shadow-purple-500/30 hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] transition-all duration-300 text-base pointer-events-auto cursor-pointer"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        {content.connectingButton}
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5 mr-2" />
                        {content.connectButton}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Achievements Section */}
          <Card className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] mt-6">
            <CardHeader className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-white/[0.08]">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Trophy className="w-5 h-5 text-amber-400" />
                {content.achievementsTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3">
                {achievements.map((achievement) => (
                  <AchievementCard key={achievement.id} achievement={achievement} />
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Connected Accounts List */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] h-full">
            <CardHeader className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-b border-white/[0:08]">
              <CardTitle className="flex items-center gap-2 text-xl">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                {content.connectedAccounts}
                <span className="text-sm font-normal text-white/60 ml-auto">
                  {connectedAccounts.length}/
                  {userPlan === 'free' ? 1 : userPlan === 'pro' ? 3 : 5}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {loadingAccounts ? (
                <LoadingSkeleton />
              ) : connectedAccounts.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-12"
                >
                  <motion.div
                    className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Link2 className="w-8 h-8 text-white/30" />
                  </motion.div>
                  <p className="text-white/40 mb-4">{content.noAccounts}</p>
                  <div className="inline-flex items-center gap-2 text-xs text-white/30 bg-white/5 px-3 py-2 rounded-full">
                    <Zap className="w-3 h-3" />
                    {language === 'id' ? 'Hubungkan akun pertama Anda' : 'Connect your first account'}
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  {connectedAccounts.map((account, index) => (
                    <motion.div
                      key={account.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-purple-500/30 hover:bg-white/[0.06] transition-all ${
                        syncingAccountId === account.id ? 'ring-2 ring-purple-500/50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg font-bold text-white">{account.account_number}</span>
                            <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold border border-purple-500/30">
                              {account.platform}
                            </span>
                          </div>
                          <p className="text-sm text-white/50">{account.broker_server}</p>
                        </div>
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          account.status === 'CONNECTED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : account.status === 'PENDING'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {account.status === 'CONNECTED' ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : account.status === 'PENDING' ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          {account.status === 'CONNECTED'
                            ? content.statusConnected
                            : account.status === 'PENDING'
                            ? content.statusPending
                            : content.statusError}
                        </div>
                      </div>

                      {/* Sync Progress */}
                      <AnimatePresence>
                        {syncingAccountId === account.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-3 overflow-hidden"
                          >
                            <div className="flex items-center gap-2 text-xs text-purple-300 mb-1.5">
                              <Database className="w-3 h-3 animate-pulse" />
                              <span>{language === 'id' ? 'Menarik data trading...' : 'Fetching trading data...'}</span>
                              <span className="ml-auto">{Math.round(syncProgress)}%</span>
                            </div>
                            <Progress value={syncProgress} className="h-1.5 bg-purple-900/30" />
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="flex items-center justify-between">
                        <p className="text-xs text-white/40">
                          {new Date(account.created_at).toLocaleDateString()}
                        </p>
                        <div className="flex gap-2">
                          {account.status === 'CONNECTED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSync(account.id)}
                              disabled={syncingAccountId === account.id}
                              className={`text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 h-8 ${
                                syncingAccountId === account.id ? 'cursor-not-allowed' : ''
                              }`}
                            >
                              {syncingAccountId === account.id ? (
                                <>
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  {content.syncingButton}
                                </>
                              ) : (
                                <>
                                  <Zap className="w-3 h-3 mr-1" />
                                  {content.syncButton}
                                </>
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDisconnect(account.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8"
                          >
                            {content.disconnectButton}
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
