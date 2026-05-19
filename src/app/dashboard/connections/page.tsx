'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/contexts/LanguageContext'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sparkles, Link2, Lock, Server, Shield, CheckCircle, XCircle, Loader2, Zap, Trophy, Star, Award, TrendingUp, Database, Trash2, Bug } from 'lucide-react'
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
  const router = useRouter()
  const { user, loading: authLoading, session } = useAuth()
  const { language, t } = useLanguage()

  // Redirect to login if not authenticated (with delay to prevent flicker)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!authLoading && !user && !session) {
        console.log('🔴 [DEBUG] Not authenticated, redirecting to login')
        router.push('/auth/login')
      }
    }, 1000) // Wait 1 second before redirecting

    return () => clearTimeout(timer)
  }, [user, authLoading, session, router])

  // Show loading while checking auth
  if (authLoading || (!user && !session)) {
    return (
      <div className="min-h-screen bg-[#0f051d] text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-white/60">Loading...</p>
        </div>
      </div>
    )
  }

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
  const [isAutoFixing, setIsAutoFixing] = useState(false)
  const [isCleaningOrphan, setIsCleaningOrphan] = useState(false)
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [showDebug, setShowDebug] = useState(false)

  // Helper: Get auth headers for API calls
  const getAuthHeaders = useCallback(() => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
    return headers
  }, [session?.access_token])

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
    console.log('🚀 [DEBUG] ConnectionsPage mounted')
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
      console.log('🔍 [fetchConnectedAccounts] Starting fetch...')
      setLoadingAccounts(true)
      const response = await fetch('/api/trading-accounts', {
        headers: getAuthHeaders()
      })

      console.log('📡 [fetchConnectedAccounts] Response status:', response.status)

      if (!response.ok) {
        // Just log the error, don't show toast - user might not be authenticated yet
        console.error('🔴 [fetchConnectedAccounts] Failed to fetch accounts:', response.status)
        setConnectedAccounts([])
        setUserPlan('free')
        return
      }

      const data = await response.json()
      console.log('📋 [fetchConnectedAccounts] Response data:', data)
      console.log('📊 [fetchConnectedAccounts] Accounts count:', data.data?.length || 0)

      setConnectedAccounts(data.data || [])
      setUserPlan(data.quota?.maxAllowed === 1 ? 'free' : data.quota?.maxAllowed === 3 ? 'pro' : 'ultra')

      console.log('✅ [fetchConnectedAccounts] State updated. Connected accounts:', data.data?.length || 0)

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
      console.error('🔴 [fetchConnectedAccounts] Error fetching accounts:', error)
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
      console.log('🔵 [DEBUG] Checking quota with session:', !!session)
      const response = await fetch('/api/trading-accounts/quota', {
        headers: getAuthHeaders()
      })

      if (response.status === 401) {
        // User not authenticated - don't redirect immediately, just show error
        console.error('🔴 [DEBUG] Not authenticated during quota check')
        toast.error(language === 'id' ? 'Sesi Anda telah berakhir. Silakan login kembali.' : 'Your session has expired. Please login again.')
        return false
      }

      if (!response.ok) {
        console.error('🔴 [DEBUG] Quota check failed:', response.status)
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
    console.log('🔵 [DEBUG] handleConnect called', { formData, isConnecting, event: e })

    // Prevent double submission
    if (isConnecting) {
      console.log('🔴 [DEBUG] Already connecting, ignoring click')
      return
    }

    // Validate form
    if (!formData.accountNumber || !formData.password || !formData.brokerServer) {
      console.log('🔴 [DEBUG] Validation failed - missing fields', { formData })
      toast.error(content.missingFields)
      return
    }

    console.log('🟢 [DEBUG] Validation passed, checking quota...')
    setIsConnecting(true)

    try {
      // Check quota before proceeding
      const canProceed = await checkQuotaAndProceed()
      console.log('🟡 [DEBUG] Quota check result:', canProceed)
      if (!canProceed) {
        return
      }

      console.log('🟣 [DEBUG] Starting connection process...')

      // Step 1: Create trading account record
      console.log('🔵 [DEBUG] Creating trading account record...')
      const createResponse = await fetch('/api/trading-accounts', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          account_number: formData.accountNumber,
          broker_server: formData.brokerServer,
          platform: formData.platform,
        }),
      })

      console.log('🔵 [DEBUG] Create response status:', createResponse.status)
      const createData = await createResponse.json()
      console.log('🔵 [DEBUG] Create response data:', createData)

      if (!createResponse.ok) {
        console.log('🔴 [DEBUG] Create failed:', createResponse.status, createData)
        if (createResponse.status === 403) {
          // Quota exceeded
          setIsConnecting(false)
          setShowPaywall(true)
          return
        }
        if (createResponse.status === 409) {
          // Duplicate account
          setIsConnecting(false)
          toast.error(
            language === 'id'
              ? 'Akun ini sudah terhubung!'
              : 'This account is already connected!'
          )
          return
        }
        throw new Error(createData.error || 'Failed to create trading account')
      }

      const tradingAccountId = createData.data.id
      console.log('🟢 [DEBUG] Trading account created, ID:', tradingAccountId)

      // Step 2: Connect to MetaApi
      console.log('🔵 [DEBUG] Connecting to MetaApi...')
      const metaApiResponse = await fetch('/api/metaapi/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          tradingAccountId,
          accountNumber: formData.accountNumber,
          password: formData.password,
          brokerServer: formData.brokerServer,
          platform: formData.platform,
        }),
      })

      console.log('🔵 [DEBUG] MetaApi response status:', metaApiResponse.status)
      const metaApiData = await metaApiResponse.json()
      console.log('🔵 [DEBUG] MetaApi response data:', metaApiData)

      if (!metaApiResponse.ok) {
        console.log('🔴 [DEBUG] MetaApi connect failed:', metaApiResponse.status, metaApiData)

        // Extract detailed error message
        let errorMessage = language === 'id'
          ? 'Gagal menghubungkan ke MetaApi'
          : 'Failed to connect to MetaApi'

        if (metaApiData.details?.message) {
          errorMessage = metaApiData.details.message
        } else if (metaApiData.message) {
          errorMessage = metaApiData.message
        } else if (metaApiData.error) {
          errorMessage = metaApiData.error
        }

        // Show specific error toast
        toast.error(errorMessage, {
          description: language === 'id'
            ? 'Silakan periksa kredensial Anda dan coba lagi.'
            : 'Please check your credentials and try again.',
          duration: 5000
        })

        setIsConnecting(false)
        return
      }

      // Success!
      console.log('✅ [DEBUG] Connection successful!')
      console.log('✅ [DEBUG] MetaApi response data:', metaApiData)

      // Show success toast with details
      toast.success(content.successMessage, {
        description: language === 'id'
          ? `Akun ${accountNumber} berhasil terhubung!`
          : `Account ${accountNumber} successfully connected!`,
        duration: 5000
      })

      // Reset form
      setFormData({
        platform: 'MT5',
        accountNumber: '',
        password: '',
        brokerServer: ''
      })

      // Refresh accounts list explicitly
      console.log('🔄 [DEBUG] Refreshing accounts list...')
      await fetchConnectedAccounts()
      console.log('✅ [DEBUG] Accounts list refreshed, current count:', connectedAccounts.length)
    } catch (error: any) {
      console.error('🔴 [DEBUG] Error connecting account:', error)

      // Extract error message
      let errorMessage = content.errorMessage
      if (error?.message) {
        errorMessage = error.message
      }

      // Show error toast with details
      toast.error(errorMessage, {
        description: language === 'id'
          ? 'Terjadi kesalahan saat menghubungkan akun. Silakan coba lagi.'
          : 'An error occurred while connecting the account. Please try again.',
        duration: 5000
      })
    } finally {
      console.log('🔄 [DEBUG] Resetting isConnecting to false')
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

  const handleFixStatus = async (accountId: string) => {
    try {
      const response = await fetch('/api/trading-accounts/fix-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ accountId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fix status')
      }

      toast.success(data.message || 'Status berhasil diperbaiki')
      await fetchConnectedAccounts()
    } catch (error: any) {
      console.error('Error fixing status:', error)
      toast.error(error.message || 'Gagal memperbaiki status')
    }
  }

  const handleCheckDebug = async () => {
    try {
      const response = await fetch('/api/debug/check-env', {
        headers: getAuthHeaders()
      })
      const data = await response.json()
      setDebugInfo(data)
      setShowDebug(true)
      console.log('🔍 Debug info:', data)
    } catch (error) {
      console.error('Error fetching debug info:', error)
      toast.error('Gagal mengambil info debug')
    }
  }

  const handleCleanupOrphan = async () => {
    setIsCleaningOrphan(true)
    try {
      const response = await fetch('/api/trading-accounts/cleanup-orphan', {
        method: 'DELETE',
        headers: getAuthHeaders()
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cleanup orphan accounts')
      }

      if (data.deleted > 0) {
        toast.success(`✅ Berhasil menghapus ${data.deleted} akun gagal`)
      } else {
        toast.info('ℹ️ Tidak ada akun gagal yang ditemukan')
      }

      await fetchConnectedAccounts()
    } catch (error: any) {
      console.error('Error cleaning up orphan accounts:', error)
      toast.error(error.message || 'Gagal menghapus akun gagal')
    } finally {
      setIsCleaningOrphan(false)
    }
  }

  const handleAutoFixAll = async () => {
    setIsAutoFixing(true)
    try {
      console.log('🔵 [DEBUG] Starting auto fix all...')

      // First, debug what accounts we have
      const debugResponse = await fetch('/api/debug/accounts-detail', {
        headers: getAuthHeaders()
      })
      const debugData = await debugResponse.json()
      console.log('📊 [DEBUG] Account details:', debugData)

      const response = await fetch('/api/trading-accounts/auto-fix-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
      })

      const data = await response.json()
      console.log('📋 [DEBUG] Auto fix response:', data)

      if (!response.ok) {
        console.error('🔴 [DEBUG] Auto fix failed:', data)
        throw new Error(data.error || 'Failed to auto fix')
      }

      // Display detailed results
      const { fixed, skipped, total } = data
      console.log('✅ [DEBUG] Fix complete:', { fixed, skipped, total })

      if (fixed && fixed.length > 0) {
        const fixedList = fixed.map((f: any) => `${f.accountNumber} (${f.before} → ${f.after})`).join(', ')
        toast.success(`✅ Fixed ${fixed.length} account(s): ${fixedList}`)
      } else {
        toast.warning(`⚠️ No accounts needed fixing. Total: ${total} account(s)`)
      }

      // Show details about skipped accounts if any
      if (skipped && skipped.length > 0) {
        console.log('ℹ️ Skipped accounts:', skipped)
      }

      await fetchConnectedAccounts()
    } catch (error: any) {
      console.error('🔴 [DEBUG] Error auto fixing:', error)
      toast.error(error.message || 'Gagal auto fix')
    } finally {
      setIsAutoFixing(false)
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
      <div
        
        
        
        className={`p-4 rounded-xl border transition-all ${
          achievement.unlocked
            ? 'bg-gradient-to-br from-purple-500/20 to-violet-500/20 border-purple-500/30'
            : 'bg-white/[0.03] border-white/[0.08] opacity-60'
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`p-2.5 rounded-lg transition-all ${
              achievement.unlocked
                ? 'bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg shadow-purple-500/30'
                : 'bg-white/5'
            }`}
          >
            <Icon className={`w-5 h-5 ${achievement.unlocked ? 'text-white' : 'text-white/30'}`} />
          </div>
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
      </div>
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
      <div
        
        
        className="max-w-6xl mx-auto mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <div
            className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600"
            
            
          >
            <Link2 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-white to-purple-300 bg-clip-text text-transparent">
            {content.title}
          </h1>
          {connectedAccounts.length > 0 && (
            <div
              
              
              className="ml-auto"
            >
              <Badge className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30">
                <CheckCircle className="w-3 h-3 mr-1" />
                {connectedAccounts.length} {connectedAccounts.length === 1 ? 'Account' : 'Accounts'}
              </Badge>
            </div>
          )}
        </div>
        <p className="text-white/60 text-lg">{content.subtitle}</p>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connection Form */}
        <div className="relative z-10">
          <Card className="bg-[#1a1025] border border-purple-500/30">
            <CardHeader className="bg-gradient-to-r from-purple-500/10 to-violet-500/10 border-b border-purple-500/30">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Sparkles className="w-5 h-5 text-purple-400" />
                {language === 'id' ? 'Tambah Koneksi Baru' : 'Add New Connection'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 relative">
              <form onSubmit={handleConnect} className="space-y-5 relative">
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
                    className={`w-full h-14 font-extrabold shadow-lg transition-all duration-300 text-base pointer-events-auto ${
                      isConnecting
                        ? 'bg-purple-900/50 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] cursor-pointer'
                    } text-white`}
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
          <Card className="bg-[#1a1025] border border-purple-500/30 mt-6">
            <CardHeader className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-purple-500/30">
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
        </div>

        {/* Connected Accounts List */}
        <div>
          <Card className="bg-[#1a1025] border border-purple-500/30 h-full">
            <CardHeader className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-b border-purple-500/30">
              <CardTitle className="flex items-center gap-2 text-xl">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                {content.connectedAccounts}
                <span className="text-sm font-normal text-white/60 ml-auto">
                  {connectedAccounts.length}/
                  {userPlan === 'free' ? 1 : userPlan === 'pro' ? 3 : 5}
                </span>
              </CardTitle>
              {connectedAccounts.some(acc => acc.status === 'PENDING') && (
                <div className="mt-3 space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAutoFixAll}
                    disabled={isAutoFixing}
                    className="w-full bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300"
                  >
                    {isAutoFixing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {language === 'id' ? 'Memperbaiki...' : 'Fixing...'}
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        {language === 'id' ? 'Auto Fix Status Pending' : 'Auto Fix Pending Status'}
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCheckDebug}
                    className="w-full bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300"
                  >
                    <Bug className="w-4 h-4 mr-2" />
                    Debug Environment
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCleanupOrphan}
                    disabled={isCleaningOrphan}
                    className="w-full bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                  >
                    {isCleaningOrphan ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {language === 'id' ? 'Menghapus...' : 'Deleting...'}
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        {language === 'id' ? 'Hapus Akun Gagal' : 'Delete Failed Accounts'}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-6">
              {loadingAccounts ? (
                <LoadingSkeleton />
              ) : connectedAccounts.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <Link2 className="w-8 h-8 text-white/30" />
                  </div>
                  <p className="text-white/40 mb-4">{content.noAccounts}</p>
                  <div className="inline-flex items-center gap-2 text-xs text-white/30 bg-white/5 px-3 py-2 rounded-full">
                    <Zap className="w-3 h-3" />
                    {language === 'id' ? 'Hubungkan akun pertama Anda' : 'Connect your first account'}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {connectedAccounts.map((account, index) => (
                    <div
                      key={account.id}
                      className={`p-4 rounded-xl bg-white/[0.03] border border-purple-500/20 hover:border-purple-500/30 hover:bg-white/[0.06] transition-all ${
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
                      {syncingAccountId === account.id && (
                        <div className="mb-3">
                          <div className="flex items-center gap-2 text-xs text-purple-300 mb-1.5">
                            <Database className="w-3 h-3 animate-pulse" />
                            <span>{language === 'id' ? 'Menarik data trading...' : 'Fetching trading data...'}</span>
                            <span className="ml-auto">{Math.round(syncProgress)}%</span>
                          </div>
                          <Progress value={syncProgress} className="h-1.5 bg-purple-900/30" />
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <p className="text-xs text-white/40">
                          {new Date(account.created_at).toLocaleDateString()}
                        </p>
                        <div className="flex gap-2">
                          {account.status === 'PENDING' && account.metaapi_account_id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleFixStatus(account.id)}
                              className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 h-8"
                              title="Fix status to CONNECTED"
                            >
                              <Zap className="w-3 h-3 mr-1" />
                              Fix
                            </Button>
                          )}
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
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cleanup Button - Only show in development or if there are stuck accounts */}
          <div className="mt-4">
            <Button
              variant="ghost"
              onClick={() => router.push('/dashboard/connections/cleanup')}
              className="w-full text-white/50 hover:text-white/80 hover:bg-white/5 text-xs py-2"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              {language === 'id' ? 'Cleanup Akun Terjebak' : 'Cleanup Stuck Accounts'}
            </Button>
          </div>
        </div>
      </div>

      {/* Debug Dialog */}
      <Dialog open={showDebug} onOpenChange={setShowDebug}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-zinc-950 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Bug className="w-5 h-5" />
              Debug Environment Info
            </DialogTitle>
          </DialogHeader>
          {debugInfo && (
            <div className="space-y-4">
              {/* User Info */}
              {debugInfo.user && (
                <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800">
                  <h3 className="text-sm font-medium text-zinc-300 mb-2">User Info</h3>
                  <pre className="text-xs text-green-400 overflow-x-auto">
                    {JSON.stringify(debugInfo.user, null, 2)}
                  </pre>
                </div>
              )}

              {/* Environment */}
              <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800">
                <h3 className="text-sm font-medium text-zinc-300 mb-2">Environment Variables</h3>
                <pre className="text-xs text-blue-400 overflow-x-auto">
                  {JSON.stringify(debugInfo.environment, null, 2)}
                </pre>
              </div>

              {/* Clients */}
              <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800">
                <h3 className="text-sm font-medium text-zinc-300 mb-2">Database Clients</h3>
                <pre className="text-xs text-yellow-400 overflow-x-auto">
                  {JSON.stringify(debugInfo.clients, null, 2)}
                </pre>
              </div>

              {/* Accounts */}
              {debugInfo.accounts && (
                <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800">
                  <h3 className="text-sm font-medium text-zinc-300 mb-2">
                    Trading Accounts ({debugInfo.accounts.count})
                  </h3>
                  {debugInfo.accounts.accounts.length > 0 ? (
                    <pre className="text-xs text-purple-400 overflow-x-auto">
                      {JSON.stringify(debugInfo.accounts, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-sm text-zinc-500">No accounts found</p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
