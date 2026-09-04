'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Shield, ArrowLeft, Users, Crown, Mail, Calendar,
  Loader2, Check, X, RefreshCw, Search, AlertCircle,
  Clock, Ban, CheckCircle, XCircle, Share2, Wallet,
  AlertTriangle, Bug, Info, DatabaseBackup,
  Tag, Send, UserPen, ChevronDown, ChevronLeft, ChevronRight,
  Link2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/api-fetch'

// Admin credentials - MUST match backend @/lib/admin-auth.ts
const ADMIN_IDS: string[] = []
const ADMIN_EMAILS = ['luxtradee@gmail.com', 'riskiakbarp123@gmail.com']

function checkIsAdmin(userId: string | undefined, email: string | undefined): boolean {
  if (userId && ADMIN_IDS.includes(userId)) return true
  if (email && ADMIN_EMAILS.includes(email.toLowerCase())) return true
  return false
}

// Extended interface with affiliate fields
interface UserProfile {
  id: string
  email: string
  full_name: string | null
  subscription_status: string
  is_pro: boolean
  subscription_until: string | null
  created_at: string
  device_id: string | null
  has_ever_been_pro: boolean
  my_referral_code?: string | null
  referred_by?: {
    email: string
  } | null
  referred_by_code?: string | null
  has_duplicate_device?: boolean
  referral_status?: string | null
  commission_paid?: boolean
  display_name?: string | null
}

// Quick action links configuration
const quickActions = [
  { href: '/admin-email', label: 'Email Broadcast', icon: Mail },
  { href: '/dashboard/admin/affiliate', label: 'Affiliate', icon: Share2 },
  { href: '/dashboard/admin/promo-codes', label: 'Promo Codes', icon: Tag },
  { href: '/dashboard/admin/social-links', label: 'Social Links', icon: Link2 },
]

export default function AdminPanel() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const router = useRouter()

  // Check auth and admin status
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        toast.error('Please login first')
        router.push('/auth/login')
        return
      }

      // Admin check — must match ADMIN_EMAILS in @/lib/admin-auth.ts
      if (!checkIsAdmin(user.id, user.email)) {
        toast.error('Access denied. Admin only.')
        router.push('/dashboard')
        return
      }

      setIsAdminUser(true)
      setCheckingAuth(false)
    }

    checkAuth()
  }, [router])

  // Track data source for notice display
  const [dataSource, setDataSource] = useState<string | null>(null)
  const [dataNotice, setDataNotice] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Fetch users
  const fetchUsers = async (showErrorToast = false) => {
    if (!isAdminUser) return

    setLoading(true)
    setFetchError(null)
    try {
      const res = await authFetch('/api/admin/users', {
        credentials: 'include'
      })

      const data = await res.json()

      if (res.ok) {
        setUsers(data.users || [])
        setDataSource(data.source || null)
        setDataNotice(data.notice || null)
      } else {
        console.error('Admin fetch error:', data.error, data.details)
        setUsers([])
        setFetchError(data.details || data.error || 'Gagal memuat data user')
        if (showErrorToast) {
          toast.error(data.details || data.error || 'Gagal memuat data user', { duration: 8000 })
        }
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      setUsers([])
      setFetchError('Network error - gagal terhubung ke server')
      if (showErrorToast) {
        toast.error('Network error - gagal terhubung ke server')
      }
    } finally {
      setLoading(false)
    }
  }

  // Sync users from Supabase Auth → DB
  const [syncing, setSyncing] = useState(false)
  const syncUsers = async () => {
    if (syncing) return
    setSyncing(true)
    try {
      const res = await authFetch('/api/admin/sync-users', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message, { duration: 6000 })
        fetchUsers() // refresh user list
      } else {
        toast.error(data.error || 'Gagal sinkronisasi', { duration: 6000 })
      }
    } catch (err) {
      toast.error('Network error saat sinkronisasi')
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    if (isAdminUser) {
      fetchUsers(true) // Show toast on first load error
    }
  }, [isAdminUser])

  // Activate PRO with specific plan type
  const activateWithPlan = async (userId: string, planType: string, planLabel: string, email: string) => {
    if (!confirm(`Yakin upgrade ${email} ke ${planLabel}?`)) return

    setUpdatingId(userId)
    try {
      console.log(`🔧 [ADMIN PANEL] Activating ${planLabel} for user: ${email} (${userId})`)

      const res = await authFetch('/api/admin/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, planType }),
        credentials: 'include',
      })
      const data = await res.json()

      console.log(`🔧 [ADMIN PANEL] Activate response:`, { status: res.status, data })

      if (res.ok) {
        toast.success(`${planLabel} activated for ${email}`)
        if (data.warnings) {
          console.warn(`⚠️ [ADMIN PANEL] Activate warnings:`, data.warnings)
        }
        fetchUsers()
      } else {
        console.error(`🔧 [ADMIN PANEL] Activate failed (${res.status}):`, data)
        toast.error(data.error || data.details || `Gagal mengaktifkan ${planLabel}`, { duration: 8000 })
      }
    } catch (error) {
      console.error('Error activating plan:', error)
      toast.error('Network error saat upgrade')
    } finally {
      setUpdatingId(null)
    }
  }

  // Auto-refresh every 60 seconds (only when tab is visible)
  useEffect(() => {
    const interval = setInterval(() => {
      if (isAdminUser && document.visibilityState === 'visible') {
        fetchUsers()
      }
    }, 60000)

    return () => clearInterval(interval)
  }, [isAdminUser])

  // Activate 30 Days PRO
  const activatePRO = async (userId: string) => {
    setUpdatingId(userId)
    try {
      console.log('🔧 [ADMIN PANEL] Activating PRO for user:', userId)

      const res = await authFetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId, action: 'activate', days: 30 }),
        credentials: 'include'
      })

      const data = await res.json()

      console.log('🔧 [ADMIN PANEL] Activation response:', data)

      if (res.ok) {
        toast.success(data.message || 'PRO activated for 30 days!')
        fetchUsers()
      } else {
        console.error('🔧 [ADMIN PANEL] Activation failed:', data)
        const errorMessage = data.details || data.error || 'Failed to activate PRO'
        if (data.solution) {
          toast.error(`${errorMessage}. ${data.solution}`, { duration: 8000 })
        } else {
          toast.error(errorMessage)
        }
      }
    } catch (error) {
      console.error('Error activating PRO:', error)
      toast.error('Failed to activate PRO')
    } finally {
      setUpdatingId(null)
    }
  }

  // Revoke PRO
  const revokePRO = async (userId: string) => {
    if (!confirm('Revoke PRO status for this user?')) return

    setUpdatingId(userId)
    try {
      console.log('🔧 [ADMIN PANEL] Revoking PRO for user:', userId)

      // Use PATCH with action: revoke instead of DELETE
      const res = await authFetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId, action: 'revoke' }),
        credentials: 'include'
      })

      const data = await res.json()

      console.log('🔧 [ADMIN PANEL] Revoke response:', { status: res.status, data })

      if (res.ok) {
        toast.success('PRO status revoked')
        if (data.warnings) {
          console.warn('⚠️ [ADMIN PANEL] Revoke warnings:', data.warnings)
        }
        fetchUsers()
      } else {
        console.error('🔧 [ADMIN PANEL] Revoke failed:', data)
        const errorMessage = data.details || data.error || 'Failed to revoke PRO'
        toast.error(errorMessage, { duration: 8000 })
      }
    } catch (error) {
      console.error('Error revoking PRO:', error)
      toast.error('Failed to revoke PRO')
    } finally {
      setUpdatingId(null)
    }
  }

  const isExpired = (subscriptionUntil: string | null): boolean => {
    if (!subscriptionUntil) return true
    return new Date(subscriptionUntil) < new Date()
  }

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const getDaysRemaining = (subscriptionUntil: string | null): number => {
    if (!subscriptionUntil) return 0
    const now = new Date()
    const until = new Date(subscriptionUntil)
    const diff = until.getTime() - now.getTime()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  const filteredUsers = users.filter(u =>
    (u?.email?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (u?.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  )

  const ITEMS_PER_PAGE = 20
  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE)
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const totalUsers = users.length
  const proUsers = users.filter(u => u?.is_pro && !isExpired(u?.subscription_until)).length
  const expiredUsers = users.filter(u => u?.subscription_until && isExpired(u?.subscription_until)).length

  // Show loading while checking auth
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#050507] flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="w-10 h-10 text-blue-500 mx-auto mb-4" />
          </motion.div>
          <p className="text-white/60">Verifying admin access...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050507] relative">
      {/* Ambient glow blob */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[60%] h-[40%] pointer-events-none" aria-hidden="true" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, rgba(6,182,212,0.08) 30%, rgba(16,185,129,0.04) 50%, transparent 70%)' }} />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#050507]/90 backdrop-blur-xl border-b border-white/[0.06] relative">
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="text-white/60 hover:text-white hover:bg-white/10 h-8 px-2">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-cyan-400" />
                <h1 className="text-lg font-bold text-white">Admin Panel</h1>
                <Badge className="bg-blue-500/20 text-cyan-300 border-blue-500/30 text-[10px] px-1.5 h-5">v2.0</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => fetchUsers()}
                variant="outline"
                size="sm"
                className="border-white/[0.06] text-[#8892b0] hover:text-[#f0f2ff] hover:bg-white/[0.03] h-8 px-2.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Button
                onClick={async () => {
                  try {
                    const res = await authFetch('/api/admin/debug')
                    const data = await res.json()
                    console.log('🔍 Debug Info:', data)
                    alert(JSON.stringify(data, null, 2))
                  } catch (err) {
                    alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'))
                  }
                }}
                variant="outline"
                size="sm"
                className="border-amber-500/30 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 h-8 px-2.5"
                title="Check environment and API status"
              >
                <Bug className="w-3.5 h-3.5 mr-1.5" />
                <span className="hidden sm:inline">Debug</span>
              </Button>
              <Badge className="bg-emerald-500/20 text-emerald-400 text-xs flex items-center gap-1.5 h-7">
                Live <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Quick Actions Bar */}
        <div className="flex flex-wrap gap-2 mb-6">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}>
              <Button
                variant="outline"
                size="sm"
                className="border-white/[0.06] text-[#8892b0] hover:text-[#f0f2ff] hover:bg-white/[0.03] h-8 text-xs gap-1.5"
              >
                <action.icon className="w-3.5 h-3.5" />
                {action.label}
              </Button>
            </Link>
          ))}
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6"
        >
          <Card className="bg-[#0e1117]/80 backdrop-blur-xl border-white/[0.06]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 border-blue-500/20">
                  <Users className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-white/60 text-xs">Total Users</p>
                  <p className="text-xl font-bold text-white">{totalUsers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-[#0e1117]/80 backdrop-blur-xl border-white/[0.06]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <Crown className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-white/60 text-xs">Active PRO</p>
                  <p className="text-xl font-bold text-emerald-400">{proUsers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-[#0e1117]/80 backdrop-blur-xl border-white/[0.06]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/20">
                  <Clock className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-white/60 text-xs">Expired</p>
                  <p className="text-xl font-bold text-red-400">{expiredUsers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Notice / Error Banner */}
        {dataNotice && !fetchError && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{dataNotice}</span>
          </div>
        )}
        {fetchError && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Gagal memuat data user</p>
              <p className="text-red-400/80 mt-1 text-xs break-all">{fetchError}</p>
            </div>
          </div>
        )}

        {/* User Management Table */}
        <Card className="bg-[#0e1117]/80 backdrop-blur-xl border-white/[0.06]">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="w-5 h-5" />
                User Management
                {dataSource === 'prisma-only' && (
                  <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-normal">DB</span>
                )}
                {dataSource === 'prisma+auth' && (
                  <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-normal">Full Sync</span>
                )}
              </CardTitle>
              <div className="flex items-center gap-2 flex-1 sm:flex-none justify-end">
                <Button
                  onClick={syncUsers}
                  disabled={syncing}
                  variant="outline"
                  size="sm"
                  className="border-blue-500/20 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 disabled:opacity-50 h-8"
                  title="Sinkronkan user dari Supabase Auth ke Database"
                >
                  <DatabaseBackup className={`w-3.5 h-3.5 mr-1.5 ${syncing ? 'animate-pulse' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync Users dari Auth'}
                </Button>
                <div className="relative flex-1 sm:flex-none">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-white/[0.03] border-white/[0.06] pl-9 w-full sm:w-64 focus:border-blue-500/50"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-white/20 mx-auto mb-4" />
                <p className="text-white/60">No users found</p>
              </div>
            ) : (
              <>
                {/* ═══ MOBILE: Card List ═══ */}
                <div className="md:hidden space-y-3">
                  {paginatedUsers.map((u) => {
                    const expired = u?.subscription_until ? isExpired(u.subscription_until) : true
                    const daysLeft = getDaysRemaining(u?.subscription_until)
                    const isActivePRO = u?.is_pro && !expired
                    return (
                      <motion.div
                        key={u?.id || 'unknown'}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-3"
                      >
                        {/* Row 1: Email + Status Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-white font-medium truncate">{u?.email || '-'}</p>
                            <p className="text-xs text-white/40 truncate mt-0.5">{u?.full_name || u?.display_name || 'No Name'}</p>
                          </div>
                          {isActivePRO ? (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs flex-shrink-0">
                              <CheckCircle className="w-3 h-3 mr-1" />PRO
                            </Badge>
                          ) : u.subscription_until && expired ? (
                            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs flex-shrink-0">
                              <XCircle className="w-3 h-3 mr-1" />Expired
                            </Badge>
                          ) : (
                            <Badge className="bg-white/10 text-white/60 border-white/10 text-xs flex-shrink-0">FREE</Badge>
                          )}
                        </div>

                        {/* Row 2: Info grid */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-white/40">Referral: </span>
                            <span className="text-blue-400 font-mono">{u?.my_referral_code || '-'}</span>
                          </div>
                          <div>
                            <span className="text-white/40">Device: </span>
                            {u?.has_duplicate_device ? (
                              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] px-1 py-0 ml-1">
                                <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />DUP
                              </Badge>
                            ) : u?.device_id ? (
                              <span className="text-emerald-400">OK</span>
                            ) : (
                              <span className="text-white/30">-</span>
                            )}
                          </div>
                          {u?.referred_by_code && (
                            <div className="col-span-2">
                              <span className="text-white/40">Referred by: </span>
                              <span className="text-cyan-300 font-mono">{u?.referred_by_code}</span>
                              {u?.referred_by?.email && (
                                <span className="text-white/30 ml-1">({u.referred_by.email})</span>
                              )}
                            </div>
                          )}
                          {u?.subscription_until && (
                            <div className="col-span-2">
                              <span className="text-white/40">Expires: </span>
                              <span className="text-white/60">{formatDate(u.subscription_until)}</span>
                              {isActivePRO && <span className="text-emerald-400 ml-1">({daysLeft}d left)</span>}
                            </div>
                          )}
                        </div>

                        {/* Row 3: Action Button — full width, 44px+ tap target */}
                        <div className="pt-1 border-t border-white/[0.06]">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                disabled={updatingId === u?.id}
                                variant="outline"
                                className={`w-full h-11 min-h-[44px] text-sm gap-2 justify-center ${isActivePRO ? 'border-red-500/30 text-red-400 hover:text-red-300 hover:bg-red-500/10' : 'border-blue-500/30 text-cyan-400 hover:text-cyan-300 hover:bg-blue-500/10'}`}
                                style={{ touchAction: 'manipulation' }}
                              >
                                {updatingId === u?.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <Crown className="w-4 h-4" />
                                    {isActivePRO ? 'Kelola PRO' : 'Upgrade ke PRO'}
                                    <ChevronDown className="w-4 h-4 ml-auto" />
                                  </>
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="center" className="bg-[#0e1117] border-white/[0.06] min-w-[220px]">
                              {isActivePRO && (
                                <DropdownMenuItem
                                  onClick={() => revokePRO(u?.id || '')}
                                  className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer py-2.5"
                                >
                                  <Ban className="w-4 h-4 mr-2" />
                                  Downgrade ke Free
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator className="bg-white/[0.06]" />
                              <DropdownMenuItem
                                onClick={() => activateWithPlan(u?.id || '', 'PRO_30_DAYS', 'PRO 30 Hari', u?.email || '')}
                                className="text-cyan-300 focus:text-cyan-200 focus:bg-blue-500/10 cursor-pointer py-2.5"
                              >
                                <Crown className="w-4 h-4 mr-2" />
                                Upgrade PRO — 30 Hari
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => activateWithPlan(u?.id || '', 'PRO_180_DAYS', 'PRO 180 Hari', u?.email || '')}
                                className="text-cyan-300 focus:text-cyan-200 focus:bg-blue-500/10 cursor-pointer py-2.5"
                              >
                                <Crown className="w-4 h-4 mr-2" />
                                Upgrade PRO — 180 Hari
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => activateWithPlan(u?.id || '', 'PRO_LIFETIME', 'PRO Lifetime', u?.email || '')}
                                className="text-amber-300 focus:text-amber-200 focus:bg-amber-500/10 cursor-pointer py-2.5"
                              >
                                <Crown className="w-4 h-4 mr-2" />
                                Upgrade PRO — Lifetime
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>

                {/* ═══ DESKTOP: Table ═══ */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left py-3 px-2 text-white/60 font-medium">Email</th>
                        <th className="text-left py-3 px-2 text-white/60 font-medium">Name</th>
                        <th className="text-left py-3 px-2 text-white/60 font-medium">Status</th>
                        <th className="text-left py-3 px-2 text-white/60 font-medium">Referral</th>
                        <th className="text-left py-3 px-2 text-white/60 font-medium">Referred By</th>
                        <th className="text-left py-3 px-2 text-white/60 font-medium">Device</th>
                        <th className="text-left py-3 px-2 text-white/60 font-medium">Commission</th>
                        <th className="text-left py-3 px-2 text-white/60 font-medium">Expires</th>
                        <th className="text-right py-3 px-2 text-white/60 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence>
                        {paginatedUsers.map((u) => {
                          const expired = u?.subscription_until ? isExpired(u.subscription_until) : true
                          const daysLeft = getDaysRemaining(u?.subscription_until)
                          const isActivePRO = u?.is_pro && !expired

                          return (
                            <motion.tr
                              key={u?.id || 'unknown'}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="border-b border-white/[0.04] hover:bg-blue-500/5 transition-colors"
                            >
                              <td className="py-3 px-2">
                                <div className="flex items-center gap-2">
                                  <Mail className="w-4 h-4 text-white/40 flex-shrink-0" />
                                  <span className="text-white truncate max-w-[150px]">{u?.email || '-'}</span>
                                </div>
                              </td>
                              <td className="py-3 px-2 text-white/60 truncate max-w-[100px]">
                                {u?.full_name || u?.display_name || 'No Name'}
                              </td>
                              <td className="py-3 px-2">
                                {isActivePRO ? (
                                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    PRO
                                  </Badge>
                                ) : u.subscription_until && expired ? (
                                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                                    <XCircle className="w-3 h-3 mr-1" />
                                    Expired
                                  </Badge>
                                ) : (
                                  <Badge className="bg-white/10 text-white/60 border-white/10 text-xs">FREE</Badge>
                                )}
                              </td>
                              <td className="py-3 px-2">
                                {u?.my_referral_code ? (
                                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs font-mono">
                                    {u?.my_referral_code}
                                  </Badge>
                                ) : (
                                  <span className="text-white/40">-</span>
                                )}
                              </td>
                              <td className="py-3 px-2">
                                {u?.referred_by ? (
                                  <div className="flex flex-col">
                                    <span className="text-white text-xs truncate">{u?.referred_by?.email || '-'}</span>
                                    <span className="text-white/40 text-xs">({u?.referred_by_code || '-'})</span>
                                  </div>
                                ) : u?.referred_by_code ? (
                                  <Badge className="bg-blue-500/20 text-cyan-300 border-blue-500/30 text-xs font-mono">
                                    {u?.referred_by_code}
                                  </Badge>
                                ) : (
                                  <span className="text-white/40">-</span>
                                )}
                              </td>
                              <td className="py-3 px-2">
                                <div className="flex flex-col gap-1">
                                  {u?.has_duplicate_device ? (
                                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                                      <AlertTriangle className="w-3 h-3 mr-1" />
                                      DUPLICATE
                                    </Badge>
                                  ) : u?.device_id ? (
                                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">OK</Badge>
                                  ) : (
                                    <span className="text-white/40 text-xs">No device</span>
                                  )}
                                  {u?.referral_status === 'fraud' && (
                                    <Badge className="bg-red-600/20 text-red-400 border-red-600/30 text-xs">FRAUD</Badge>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-2">
                                {u?.commission_paid ? (
                                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                                    <Check className="w-3 h-3 mr-1" />Paid
                                  </Badge>
                                ) : u?.referred_by_code && !u?.has_ever_been_pro ? (
                                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">Pending</Badge>
                                ) : (
                                  <span className="text-white/40 text-xs">-</span>
                                )}
                              </td>
                              <td className="py-3 px-2 text-white/60">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  <span className="text-xs">{formatDate(u?.subscription_until)}</span>
                                </div>
                                {isActivePRO && (
                                  <span className="text-emerald-400 text-xs">{daysLeft}d left</span>
                                )}
                              </td>
                              <td className="py-3 px-2 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {/* Upgrade/Downgrade Dropdown */}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        disabled={updatingId === u?.id}
                                        size="sm"
                                        variant="outline"
                                        style={{ touchAction: 'manipulation' }}
                                        className={`h-7 text-xs px-2 gap-1 ${isActivePRO ? 'border-red-500/30 text-red-400 hover:text-red-300 hover:bg-red-500/10' : 'border-blue-500/30 text-cyan-400 hover:text-cyan-300 hover:bg-blue-500/10'}`}
                                      >
                                        {updatingId === u?.id ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <>
                                            <Crown className="w-3 h-3" />
                                            {isActivePRO ? 'PRO' : 'Upgrade'}
                                            <ChevronDown className="w-3 h-3 ml-0.5" />
                                          </>
                                        )}
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-[#0e1117] border-white/[0.06] min-w-[200px]">
                                      {isActivePRO && (
                                        <DropdownMenuItem
                                          onClick={() => revokePRO(u?.id || '')}
                                          className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer"
                                        >
                                          <Ban className="w-4 h-4 mr-2" />
                                          Downgrade ke Free
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuSeparator className="bg-white/[0.06]" />
                                      <DropdownMenuItem
                                        onClick={() => activateWithPlan(u?.id || '', 'PRO_30_DAYS', 'PRO 30 Hari', u?.email || '')}
                                        className="text-cyan-300 focus:text-cyan-200 focus:bg-blue-500/10 cursor-pointer"
                                      >
                                        <Crown className="w-4 h-4 mr-2" />
                                        Upgrade PRO — 30 Hari
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => activateWithPlan(u?.id || '', 'PRO_180_DAYS', 'PRO 180 Hari', u?.email || '')}
                                        className="text-cyan-300 focus:text-cyan-200 focus:bg-blue-500/10 cursor-pointer"
                                      >
                                        <Crown className="w-4 h-4 mr-2" />
                                        Upgrade PRO — 180 Hari
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => activateWithPlan(u?.id || '', 'PRO_LIFETIME', 'PRO Lifetime', u?.email || '')}
                                        className="text-amber-300 focus:text-amber-200 focus:bg-amber-500/10 cursor-pointer"
                                      >
                                        <Crown className="w-4 h-4 mr-2" />
                                        Upgrade PRO — Lifetime
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </td>
                            </motion.tr>
                          )
                        })}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/[0.04]">
                <p className="text-xs text-white/40">
                  Menampilkan {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredUsers.length)} dari {filteredUsers.length} user
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 border-white/[0.06] text-[#8892b0] hover:text-[#f0f2ff] hover:bg-white/[0.03] disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Prev
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                    const isNearCurrent = Math.abs(page - currentPage) <= 1
                    const isEdge = page === 1 || page === totalPages
                    const showPage = isNearCurrent || isEdge

                    if (!showPage) {
                      // Show ellipsis
                      const prevPage = page - 1
                      if (prevPage === currentPage || (Math.abs(prevPage - currentPage) <= 1 && isNearCurrent)) {
                        return <span key={`ellipsis-${page}`} className="px-1 text-white/30 text-xs">...</span>
                      }
                      return null
                    }

                    return (
                      <Button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        variant={currentPage === page ? 'default' : 'outline'}
                        size="sm"
                        className={`h-7 w-7 p-0 text-xs ${
                          currentPage === page
                            ? 'bg-blue-500/15 text-[#f0f2ff] border-blue-500/30'
                            : 'border-white/[0.06] text-[#8892b0] hover:text-[#f0f2ff] hover:bg-white/[0.03]'
                        }`}
                      >
                        {page}
                      </Button>
                    )
                  })}
                  <Button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 border-white/[0.06] text-[#8892b0] hover:text-[#f0f2ff] hover:bg-white/[0.03] disabled:opacity-30"
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Cards */}
        <div className="grid md:grid-cols-2 gap-6 mt-6">
          <Card className="bg-[#0e1117]/80 backdrop-blur-xl border-white/[0.06]">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-blue-500/10 border-blue-500/20"><Shield className="w-5 h-5 text-cyan-400" /></div>
                <div>
                  <h3 className="text-white font-semibold mb-2">Subscription Logic</h3>
                  <ul className="text-white/60 text-sm space-y-1">
                    <li>• <span className="text-emerald-400">Active PRO</span>: Full access to all features</li>
                    <li>• <span className="text-red-400">Expired</span>: Auto-locks to FREE limits</li>
                    <li>• <span className="text-white/40">FREE</span>: Limited to 5 trades max</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
