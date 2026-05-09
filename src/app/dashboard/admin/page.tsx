'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Shield, ArrowLeft, Users, Crown, Mail, Calendar, 
  Loader2, Check, X, RefreshCw, Search, AlertCircle,
  Clock, Ban, CheckCircle, XCircle, Share2, Wallet,
  AlertTriangle, Copy,
  BarChart3, Eye, Monitor, Smartphone, Tablet,
  Globe, TrendingUp, TrendingDown, Activity,
  FileText, ExternalLink
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'

// Admin credentials - MUST match backend
const ADMIN_IDS = ['8f7fe295-2df0-412d-ba91-8e6060f3ab08']
const ADMIN_EMAILS = ['luxtradee@gmail.com']

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
  my_referral_code: string | null
  referred_by_code: string | null
  referred_by: { email: string; name: string | null } | null
  affiliate_balance: number
  referral_status: string | null
  has_ever_been_pro: boolean
  commission_paid: boolean
  has_duplicate_device: boolean
  referral_code_changes: number
}

// Traffic analytics types
interface TrafficData {
  totalPageViews: number
  uniqueVisitors: number
  todayPageViews: number
  todayUniqueVisitors: number
  yesterdayPageViews: number
  growthPercent: number
  dailyChart: { date: string; views: number; unique: number }[]
  topPages: { path: string; count: number }[]
  devices: [string, number][]
  browsers: [string, number][]
  os: [string, number][]
  referrers: [string, number][]
}

function MiniBarChart({ data, maxValue, color = 'bg-purple-500' }: { data: number[]; maxValue: number; color?: string }) {
  return (
    <div className="flex items-end gap-[3px] h-8">
      {data.map((val, i) => (
        <motion.div
          key={i}
          initial={{ height: 0 }}
          animate={{ height: `${maxValue > 0 ? (val / maxValue) * 100 : 0}%` }}
          transition={{ delay: i * 0.03, duration: 0.4 }}
          className={`flex-1 rounded-t-sm ${color} min-w-[3px]`}
        />
      ))}
    </div>
  )
}

function TrafficTab() {
  const [data, setData] = useState<TrafficData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState('7d')

  const fetchTraffic = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/analytics/traffic?range=${range}`)
      const json = await res.json()
      if (res.ok) {
        setData(json)
      } else {
        setError(json.error || `HTTP ${res.status}`)
      }
    } catch (err) {
      setError('Gagal terhubung ke server')
      console.error('Traffic fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTraffic() }, [range])

  const maxChartValue = data ? Math.max(...data.dailyChart.map(d => d.views), 1) : 1

  const deviceIcons: Record<string, React.ReactNode> = {
    Desktop: <Monitor className="w-3.5 h-3.5" />,
    Mobile: <Smartphone className="w-3.5 h-3.5" />,
    Tablet: <Tablet className="w-3.5 h-3.5" />,
  }

  const formatNumber = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
    return n.toString()
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-12 h-12 text-red-400/50 mx-auto mb-4" />
        <p className="text-white/60 mb-2">Gagal memuat data traffic</p>
        <p className="text-white/30 text-sm mb-4">Error: {error}</p>
        <p className="text-white/30 text-xs mb-4">Jika pertama kali deploy, table database belum tersedia. Coba akses halaman web lain dulu, lalu refresh ini.</p>
        <Button onClick={fetchTraffic} variant="outline" className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10">
          <RefreshCw className="w-4 h-4 mr-2" />
          Coba Lagi
        </Button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-12 h-12 text-white/20 mx-auto mb-4" />
        <p className="text-white/60">Tidak ada data traffic</p>
        <p className="text-white/30 text-sm mt-1">Data akan muncul setelah ada visitor yang mengakses web</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-500/20">
            <BarChart3 className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Traffic Analytics</h2>
            <p className="text-xs text-white/40">Live visitor tracking</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[100px] bg-[#0d0820] border-purple-500/20 text-white/60 text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 Hari</SelectItem>
              <SelectItem value="30d">30 Hari</SelectItem>
              <SelectItem value="90d">90 Hari</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={fetchTraffic}
            variant="outline"
            size="sm"
            className="border-purple-500/30 text-white/60 hover:text-white hover:bg-purple-500/10 h-8"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-[#1a0f2e]/50 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/50">Total Page Views</span>
              <Eye className="w-4 h-4 text-purple-400/50" />
            </div>
            <p className="text-2xl font-bold text-white">{formatNumber(data.totalPageViews)}</p>
            <div className="flex items-center gap-1 mt-1">
              {data.growthPercent >= 0 ? (
                <TrendingUp className="w-3 h-3 text-emerald-400" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-400" />
              )}
              <span className={`text-[11px] ${data.growthPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {data.growthPercent >= 0 ? '+' : ''}{data.growthPercent}% vs kemarin
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1a0f2e]/50 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/50">Unique Visitors</span>
              <Users className="w-4 h-4 text-blue-400/50" />
            </div>
            <p className="text-2xl font-bold text-white">{formatNumber(data.uniqueVisitors)}</p>
            <p className="text-[11px] text-white/30 mt-1">IP unik dalam {range === '90d' ? '90' : range === '30d' ? '30' : '7'} hari</p>
          </CardContent>
        </Card>

        <Card className="bg-[#1a0f2e]/50 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/50">Hari Ini</span>
              <Activity className="w-4 h-4 text-emerald-400/50" />
            </div>
            <p className="text-2xl font-bold text-white">{formatNumber(data.todayPageViews)}</p>
            <p className="text-[11px] text-white/30 mt-1">{data.todayUniqueVisitors} visitor unik</p>
          </CardContent>
        </Card>

        <Card className="bg-[#1a0f2e]/50 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/50">Kemarin</span>
              <Clock className="w-4 h-4 text-orange-400/50" />
            </div>
            <p className="text-2xl font-bold text-white">{formatNumber(data.yesterdayPageViews)}</p>
            <p className="text-[11px] text-white/30 mt-1">Kemarin</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Chart */}
      <Card className="bg-[#1a0f2e]/50 border-purple-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            Page Views Harian
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {data.dailyChart.map((d, i) => {
              const dayName = new Date(d.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' })
              const isToday = d.date === new Date().toISOString().split('T')[0]
              return (
                <div key={d.date} className="flex items-center gap-3">
                  <span className={`text-[11px] w-16 text-right flex-shrink-0 ${isToday ? 'text-purple-400 font-bold' : 'text-white/40'}`}>
                    {dayName}
                    {isToday && ' *'}
                  </span>
                  <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${maxChartValue > 0 ? (d.views / maxChartValue) * 100 : 0}%` }}
                      transition={{ delay: i * 0.02, duration: 0.5 }}
                      className={`h-full rounded-full ${isToday ? 'bg-gradient-to-r from-purple-500 to-violet-500' : 'bg-purple-500/60'}`}
                    />
                  </div>
                  <span className="text-[11px] text-white/60 w-10 text-right flex-shrink-0 font-mono">{d.views}</span>
                  <span className="text-[10px] text-white/30 w-8 text-right flex-shrink-0">
                    <span className="inline-flex items-center gap-0.5">
                      <Users className="w-2.5 h-2.5" />
                      {d.unique}
                    </span>
                  </span>
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-white/30">
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-500/60" /> Page Views</span>
            <span className="flex items-center gap-1"><Users className="w-2.5 h-2.5" /> Unique Visitors</span>
            <span>* Hari ini</span>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Grid: Top Pages + Devices + Browsers */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Top Pages */}
        <Card className="bg-[#1a0f2e]/50 border-purple-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-400" />
              Halaman Populer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topPages.length === 0 ? (
                <p className="text-white/30 text-xs text-center py-4">Belum ada data</p>
              ) : (
                data.topPages.map((p, i) => (
                  <div key={p.path} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] text-white/30 w-4">{i + 1}</span>
                      <span className="text-xs text-white/70 truncate">{p.path}</span>
                    </div>
                    <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px] h-5 flex-shrink-0 ml-2">
                      {p.count}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Devices */}
        <Card className="bg-[#1a0f2e]/50 border-purple-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-white flex items-center gap-2">
              <Monitor className="w-4 h-4 text-purple-400" />
              Perangkat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.devices.map(([name, count]) => {
                const total = data.devices.reduce((s, [, c]) => s + c, 0)
                const pct = Math.round((count / total) * 100)
                return (
                  <div key={name} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-purple-400">{deviceIcons[name] || <Monitor className="w-3.5 h-3.5" />}</span>
                        <span className="text-xs text-white/70">{name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-white/60">{count}</span>
                        <span className="text-[10px] text-white/30">{pct}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6 }}
                        className="h-full rounded-full bg-gradient-to-r from-purple-500 to-violet-500"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Browsers + Referrers */}
        <div className="space-y-4">
          <Card className="bg-[#1a0f2e]/50 border-purple-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-purple-400" />
                Browser
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.browsers.map(([name, count]) => {
                  const total = data.browsers.reduce((s, [, c]) => s + c, 0)
                  const pct = Math.round((count / total) * 100)
                  return (
                    <div key={name} className="flex items-center justify-between">
                      <span className="text-xs text-white/70">{name}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500/60 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-white/40 w-8 text-right">{pct}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1a0f2e]/50 border-purple-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-white flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-purple-400" />
                Sumber Trafik
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.referrers.length === 0 ? (
                  <p className="text-white/30 text-xs text-center py-2">Belum ada data</p>
                ) : (
                  data.referrers.map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between">
                      <span className="text-xs text-white/70 truncate max-w-[120px]">{name}</span>
                      <Badge className="bg-white/5 text-white/50 text-[10px] h-5">{count}</Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* OS Breakdown - small */}
      <Card className="bg-[#1a0f2e]/50 border-purple-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-white flex items-center gap-2">
            <Monitor className="w-4 h-4 text-purple-400" />
            Sistem Operasi
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {data.os.map(([name, count]) => {
              const total = data.os.reduce((s, [, c]) => s + c, 0)
              const pct = Math.round((count / total) * 100)
              return (
                <div key={name} className="px-3 py-2 rounded-lg bg-white/5 border border-white/5 flex items-center gap-2">
                  <span className="text-xs text-white/70">{name}</span>
                  <span className="text-[10px] text-purple-400 font-mono">{pct}%</span>
                  <span className="text-[10px] text-white/30">({count})</span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AdminPanel() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [activeTab, setActiveTab] = useState<'users' | 'traffic'>('users')
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

  // Fetch users
  const fetchUsers = async () => {
    if (!isAdminUser) return

    setLoading(true)
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token

      if (!token) {
        toast.error('Session expired. Please login again.')
        return
      }

      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      const data = await res.json()

      if (res.ok) {
        setUsers(data.users || [])
      } else {
        console.error('Admin fetch error:', data.error)
        setUsers([])
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdminUser) {
      fetchUsers()
    }
  }, [isAdminUser])

  // Activate 30 Days PRO
  const activatePRO = async (userId: string) => {
    setUpdatingId(userId)
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      
      if (!token) {
        toast.error('Session expired')
        return
      }

      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId })
      })

      const data = await res.json()
      
      if (res.ok) {
        toast.success(data.message || 'PRO activated for 30 days!')
        
        if (data.commission?.paid) {
          toast.success(`Commission Rp ${data.commission.amount.toLocaleString('id-ID')} paid to referrer!`)
        }
        
        fetchUsers()
      } else {
        toast.error(data.error || 'Failed to activate PRO')
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
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      
      if (!token) {
        toast.error('Session expired')
        return
      }

      const res = await fetch(`/api/admin/users?userId=${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      const data = await res.json()
      
      if (res.ok) {
        toast.success('PRO status revoked')
        fetchUsers()
      } else {
        toast.error(data.error || 'Failed to revoke PRO')
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
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u.my_referral_code?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u.referred_by_code?.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const totalUsers = users.length
  const proUsers = users.filter(u => u.is_pro && !isExpired(u.subscription_until)).length
  const expiredUsers = users.filter(u => u.subscription_until && isExpired(u.subscription_until)).length
  const totalReferrals = users.filter(u => u.referred_by_code).length
  const totalAffiliateBalance = users.reduce((sum, u) => sum + (u.affiliate_balance || 0), 0)
  const fraudDetected = users.filter(u => u.referral_status === 'fraud').length

  // Show loading while checking auth
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#080510] flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="w-10 h-10 text-purple-500 mx-auto mb-4" />
          </motion.div>
          <p className="text-white/60">Verifying admin access...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0a1a] via-[#1a0f2e] to-[#0d0820]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#150a25]/90 backdrop-blur-xl border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="text-white/60 hover:text-white hover:bg-white/10">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <Shield className="w-6 h-6 text-purple-400" />
                <h1 className="text-xl font-bold text-white">Admin Panel</h1>
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">v2.0</Badge>
              </div>
            </div>
            <Button 
              onClick={activeTab === 'users' ? fetchUsers : () => {}}
              variant="outline"
              size="sm"
              className="border-purple-500/30 text-white/60 hover:text-white hover:bg-purple-500/10"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Switcher */}
        <div className="flex gap-2 mb-6">
          <Button
            onClick={() => setActiveTab('users')}
            variant={activeTab === 'users' ? 'default' : 'outline'}
            className={activeTab === 'users'
              ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white'
              : 'border-purple-500/30 text-white/50 hover:text-white hover:bg-purple-500/10'
            }
          >
            <Users className="w-4 h-4 mr-2" />
            Users & Affiliate
            <Badge className="ml-2 bg-white/20 text-white h-5 text-[10px] px-1.5">{totalUsers}</Badge>
          </Button>
          <Button
            onClick={() => setActiveTab('traffic')}
            variant={activeTab === 'traffic' ? 'default' : 'outline'}
            className={activeTab === 'traffic'
              ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white'
              : 'border-purple-500/30 text-white/50 hover:text-white hover:bg-purple-500/10'
            }
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Traffic Analytics
            <span className="ml-2 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </Button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'users' ? (
            <motion.div key="users" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                <Card className="bg-[#1a0f2e]/50 border-purple-500/20 backdrop-blur-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-500/20">
                        <Users className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-white/60 text-xs">Total Users</p>
                        <p className="text-xl font-bold text-white">{totalUsers}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-[#1a0f2e]/50 border-purple-500/20 backdrop-blur-sm">
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
                <Card className="bg-[#1a0f2e]/50 border-purple-500/20 backdrop-blur-sm">
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
                <Card className="bg-[#1a0f2e]/50 border-purple-500/20 backdrop-blur-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/20">
                        <Share2 className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-white/60 text-xs">Referrals</p>
                        <p className="text-xl font-bold text-blue-400">{totalReferrals}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-[#1a0f2e]/50 border-purple-500/20 backdrop-blur-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-yellow-500/20">
                        <Wallet className="w-5 h-5 text-yellow-400" />
                      </div>
                      <div>
                        <p className="text-white/60 text-xs">Commission</p>
                        <p className="text-lg font-bold text-yellow-400">Rp {(totalAffiliateBalance / 1000).toFixed(0)}K</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-[#1a0f2e]/50 border-purple-500/20 backdrop-blur-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-orange-500/20">
                        <AlertTriangle className="w-5 h-5 text-orange-400" />
                      </div>
                      <div>
                        <p className="text-white/60 text-xs">Fraud</p>
                        <p className="text-xl font-bold text-orange-400">{fraudDetected}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* User Management Table */}
              <Card className="bg-[#1a0f2e]/50 border-purple-500/20 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <CardTitle className="text-white flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      User Management
                    </CardTitle>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                      <Input
                        placeholder="Search users..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-[#0d0820] border-purple-500/20 pl-9 w-full sm:w-64 focus:border-purple-500/50"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-12">
                      <AlertCircle className="w-12 h-12 text-white/20 mx-auto mb-4" />
                      <p className="text-white/60">No users found</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-purple-500/20">
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
                            {filteredUsers.map((u) => {
                              const expired = u.subscription_until ? isExpired(u.subscription_until) : true
                              const daysLeft = getDaysRemaining(u.subscription_until)
                              const isActivePRO = u.is_pro && !expired
                              
                              return (
                                <motion.tr
                                  key={u.id}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="border-b border-purple-500/10 hover:bg-purple-500/5 transition-colors"
                                >
                                  <td className="py-3 px-2">
                                    <div className="flex items-center gap-2">
                                      <Mail className="w-4 h-4 text-white/40 flex-shrink-0" />
                                      <span className="text-white truncate max-w-[150px]">{u.email}</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-2 text-white/60 truncate max-w-[100px]">
                                    {u.full_name || '-'}
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
                                    {u.my_referral_code ? (
                                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs font-mono">
                                        {u.my_referral_code}
                                      </Badge>
                                    ) : (
                                      <span className="text-white/40">-</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-2">
                                    {u.referred_by ? (
                                      <div className="flex flex-col">
                                        <span className="text-white text-xs truncate">{u.referred_by.email}</span>
                                        <span className="text-white/40 text-xs">({u.referred_by_code})</span>
                                      </div>
                                    ) : u.referred_by_code ? (
                                      <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs font-mono">
                                        {u.referred_by_code}
                                      </Badge>
                                    ) : (
                                      <span className="text-white/40">-</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-2">
                                    <div className="flex flex-col gap-1">
                                      {u.has_duplicate_device ? (
                                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                                          <AlertTriangle className="w-3 h-3 mr-1" />
                                          DUPLICATE
                                        </Badge>
                                      ) : u.device_id ? (
                                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">OK</Badge>
                                      ) : (
                                        <span className="text-white/40 text-xs">No device</span>
                                      )}
                                      {u.referral_status === 'fraud' && (
                                        <Badge className="bg-red-600/20 text-red-400 border-red-600/30 text-xs">FRAUD</Badge>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 px-2">
                                    {u.commission_paid ? (
                                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                                        <Check className="w-3 h-3 mr-1" />Paid
                                      </Badge>
                                    ) : u.referred_by_code && !u.has_ever_been_pro ? (
                                      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">Pending</Badge>
                                    ) : (
                                      <span className="text-white/40 text-xs">-</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-2 text-white/60">
                                    <div className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      <span className="text-xs">{formatDate(u.subscription_until)}</span>
                                    </div>
                                    {isActivePRO && (
                                      <span className="text-emerald-400 text-xs">{daysLeft}d left</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-2 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      {isActivePRO ? (
                                        <Button
                                          onClick={() => revokePRO(u.id)}
                                          disabled={updatingId === u.id}
                                          size="sm"
                                          variant="destructive"
                                          className="bg-red-600 hover:bg-red-700 h-7 text-xs px-2"
                                        >
                                          {updatingId === u.id ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                          ) : (
                                            <><X className="w-3 h-3 mr-1" />Revoke</>
                                          )}
                                        </Button>
                                      ) : (
                                        <Button
                                          onClick={() => activatePRO(u.id)}
                                          disabled={updatingId === u.id}
                                          size="sm"
                                          className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 h-7 text-xs px-2"
                                        >
                                          {updatingId === u.id ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                          ) : (
                                            <><Crown className="w-3 h-3 mr-1" />PRO</>
                                          )}
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </motion.tr>
                              )
                            })}
                          </AnimatePresence>
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Info Cards */}
              <div className="grid md:grid-cols-2 gap-6 mt-6">
                <Card className="bg-[#1a0f2e]/50 border-purple-500/20 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-2 rounded-lg bg-purple-500/20"><Shield className="w-5 h-5 text-purple-400" /></div>
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
                <Card className="bg-[#1a0f2e]/50 border-purple-500/20 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-2 rounded-lg bg-yellow-500/20"><Wallet className="w-5 h-5 text-yellow-400" /></div>
                      <div>
                        <h3 className="text-white font-semibold mb-2">Affiliate System</h3>
                        <ul className="text-white/60 text-sm space-y-1">
                          <li>• Pro Price: <span className="text-yellow-400">Rp 49.000</span></li>
                          <li>• Commission: <span className="text-yellow-400">30% (Rp 14.700)</span></li>
                          <li>• Only for <span className="text-emerald-400">first-time PRO</span> activation</li>
                          <li>• <span className="text-red-400">DUPLICATE</span> = Same device detected</li>
                          <li>• <span className="text-red-400">FRAUD</span> = Self-referral detected</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          ) : (
            <motion.div key="traffic" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <TrafficTab />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
