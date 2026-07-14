'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Shield, Users, Crown, Clock, Mail, Calendar, 
  RefreshCw, LogOut, CheckCircle, XCircle, AlertTriangle,
  TrendingUp, UserX, ChevronDown, Wallet, Sparkles,
  ArrowLeft, Search, Zap, Lock, Activity
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/lib/auth-context'

// Admin email - hardcoded for security
const ADMIN_EMAIL = 'luxtradee@gmail.com'

interface AdminUser {
  id: string
  email: string
  full_name: string
  subscription_status: string
  is_pro: boolean
  subscription_until: string | null
  created_at: string
  role: string
}

export default function AdminSecurePage() {
  const { user, loading: authLoading, signOut } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activating, setActivating] = useState<string | null>(null)
  const [showDropdown, setShowDropdown] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isVerified, setIsVerified] = useState(false)

  // Redirect if not admin
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/auth/login')
        return
      }

      if (user.email !== ADMIN_EMAIL) {
        toast.error('Akses Ditolak: Hanya admin yang boleh mengakses halaman ini')
        router.push('/dashboard')
        return
      }

      setIsVerified(true)
      fetchUsers()
    }
  }, [user, authLoading, router])

  // Real-time auto-refresh every 15 seconds
  useEffect(() => {
    if (!isVerified) return

    const interval = setInterval(() => {
      fetchUsers()
    }, 15000)

    return () => clearInterval(interval)
  }, [isVerified])

  const fetchUsers = async () => {
    if (!isVerified) return

    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/users')

      if (!res.ok) {
        const error = await res.json()
        console.error('Admin API Error:', error)
        throw new Error(error.error || 'Failed to fetch users')
      }

      const data = await res.json()
      console.log('Admin users data:', data)

      setUsers(data.users || [])
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('Gagal mengambil data user')
    } finally {
      setIsLoading(false)
    }
  }

  const activatePro = async (userId: string, months: number) => {
    setActivating(userId)
    setShowDropdown(null)

    try {
      // Use new API that uses Supabase Auth
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          action: 'activate',
          days: months === 0 ? 3650 : months * 30, // Lifetime = 10 years
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(`✅ PRO berhasil diaktifkan untuk ${months === 0 ? 'lifetime' : months + ' bulan'}!`)
        fetchUsers()
      } else {
        toast.error(data.details || data.error || 'Gagal mengaktifkan PRO')
      }
    } catch (error) {
      console.error('Error activating PRO:', error)
      toast.error('Gagal mengaktifkan PRO')
    } finally {
      setActivating(null)
    }
  }

  const deactivatePro = async (userId: string) => {
    if (!confirm('Apakah Anda yakin ingin menonaktifkan PRO untuk user ini?')) return

    setActivating(userId)

    try {
      // Use new API that uses Supabase Auth
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          action: 'revoke',
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('✅ Status PRO berhasil dinonaktifkan')
        fetchUsers()
      } else {
        toast.error(data.details || data.error || 'Gagal menonaktifkan PRO')
      }
    } catch (error) {
      console.error('Error deactivating PRO:', error)
      toast.error('Gagal menonaktifkan PRO')
    } finally {
      setActivating(null)
    }
  }

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { 
      style: 'currency', 
      currency: 'IDR',
      minimumFractionDigits: 0 
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const isExpiringSoon = (expiryDate: string | null) => {
    if (!expiryDate) return false
    const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return days > 0 && days <= 7
  }

  const isExpired = (expiryDate: string | null) => {
    if (!expiryDate) return false
    return new Date(expiryDate) < new Date()
  }

  const getDaysRemaining = (expiryDate: string | null) => {
    if (!expiryDate) return null
    const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return days
  }

  // Stats
  const totalUsers = users.length
  const proUsers = users.filter(u => u.is_pro && !isExpired(u.subscription_until)).length
  const expiredUsers = users.filter(u => u.subscription_until && isExpired(u.subscription_until)).length
  const freeUsers = totalUsers - proUsers

  // Filter users
  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.full_name && user.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Loading state
  if (authLoading || !isVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0515] via-[#150a25] to-[#0d0820] flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Shield className="w-12 h-12 text-purple-500 mx-auto mb-4" />
          </motion.div>
          <p className="text-white/60">Verifying admin access...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0515] via-[#150a25] to-[#0d0820] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#150a25]/90 backdrop-blur-xl border-b border-purple-500/20 shadow-2xl shadow-purple-900/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/dashboard')}
                className="text-white/60 hover:text-white hover:bg-white/10"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-violet-500/20 border border-purple-500/30">
                  <Shield className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text text-transparent">
                    Admin Panel Secure
                  </h1>
                  <p className="text-xs text-gray-500">Protected Access</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs flex items-center gap-1">
                Live <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchUsers}
                disabled={isLoading}
                className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="text-white/60 hover:text-red-400"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="relative overflow-hidden bg-gradient-to-br from-purple-500/10 via-purple-600/5 to-transparent border-purple-500/20 backdrop-blur-sm hover:border-purple-500/40 transition-all group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl group-hover:bg-purple-500/20 transition-all" />
              <CardContent className="p-6 relative">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-purple-300/80">Total Pengguna</p>
                    <p className="text-3xl font-bold text-white">{totalUsers}</p>
                    <p className="text-xs text-purple-400/60">{proUsers} aktif PRO</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform border border-purple-500/20">
                    <Users className="w-6 h-6 text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="relative overflow-hidden bg-gradient-to-br from-amber-500/10 via-amber-600/5 to-transparent border-amber-500/20 backdrop-blur-sm hover:border-amber-500/40 transition-all group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/20 transition-all" />
              <CardContent className="p-6 relative">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-amber-300/80">Pengguna Premium</p>
                    <p className="text-3xl font-bold text-amber-400">{proUsers}</p>
                    <p className="text-xs text-amber-400/60">{totalUsers > 0 ? Math.round((proUsers / totalUsers) * 100) : 0}% dari total</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center group-hover:scale-110 transition-transform border border-amber-500/20">
                    <Crown className="w-6 h-6 text-amber-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="relative overflow-hidden bg-gradient-to-br from-gray-500/10 via-gray-600/5 to-transparent border-gray-500/20 backdrop-blur-sm hover:border-gray-500/40 transition-all group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gray-500/10 rounded-full blur-3xl group-hover:bg-gray-500/20 transition-all" />
              <CardContent className="p-6 relative">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-300/80">Pengguna Free</p>
                    <p className="text-3xl font-bold text-gray-300">{freeUsers}</p>
                    <p className="text-xs text-gray-400/60">Siap upgrade</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-gray-500/20 flex items-center justify-center group-hover:scale-110 transition-transform border border-gray-500/20">
                    <UserX className="w-6 h-6 text-gray-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="relative overflow-hidden bg-gradient-to-br from-red-500/10 via-red-600/5 to-transparent border-red-500/20 backdrop-blur-sm hover:border-red-500/40 transition-all group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl group-hover:bg-red-500/20 transition-all" />
              <CardContent className="p-6 relative">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-red-300/80">Expired</p>
                    <p className="text-3xl font-bold text-red-400">{expiredUsers}</p>
                    <p className="text-xs text-red-400/60">Perlu renewal</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center group-hover:scale-110 transition-transform border border-red-500/20">
                    <Clock className="w-6 h-6 text-red-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* User Management Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="bg-gradient-to-br from-[#1a0f2e]/50 via-[#150a25]/50 to-transparent border-purple-500/20 backdrop-blur-sm">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-purple-500/20">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  Manajemen Pengguna
                </CardTitle>
                <p className="text-xs text-gray-500 mt-1">Kelola akses dan status PRO pengguna</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    type="text"
                    placeholder="Cari email atau nama..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-[#0d0820] border-purple-500/20 text-white placeholder:text-gray-600 w-full sm:w-64 focus:border-purple-500/50"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-purple-500/20 text-left text-xs text-gray-500 uppercase tracking-wider">
                      <th className="p-4">Email</th>
                      <th className="p-4">Nama</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Berakhir</th>
                      <th className="p-4">Terdaftar</th>
                      <th className="p-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-500/10">
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center">
                          <div className="flex items-center justify-center">
                            <RefreshCw className="w-6 h-6 text-purple-500 animate-spin mr-2" />
                            <span className="text-gray-500">Memuat data...</span>
                          </div>
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-500">
                          {searchQuery ? 'Tidak ada user yang cocok dengan pencarian' : 'Belum ada pengguna terdaftar'}
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <tr
                          key={user.id}
                          className="hover:bg-purple-500/5 transition-colors"
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-gray-500" />
                              <span className="font-mono text-sm">{user.email}</span>
                            </div>
                          </td>
                          <td className="p-4 text-gray-300">
                            {user.full_name || '-'}
                          </td>
                          <td className="p-4">
                            {user.is_pro ? (
                              <div className="flex items-center gap-2">
                                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                                  <Crown className="w-3 h-3 mr-1" /> PRO
                                </Badge>
                                {isExpiringSoon(user.subscription_until) && (
                                  <AlertTriangle className="w-4 h-4 text-yellow-500" title="Expiring soon" />
                                )}
                                {isExpired(user.subscription_until) && (
                                  <XCircle className="w-4 h-4 text-red-500" title="Expired" />
                                )}
                              </div>
                            ) : (
                              <Badge variant="outline" className="border-gray-500/30 text-gray-400">
                                FREE
                              </Badge>
                            )}
                          </td>
                          <td className="p-4">
                            {user.subscription_until ? (
                              <div className="text-sm">
                                <p>{formatDate(user.subscription_until)}</p>
                                {getDaysRemaining(user.subscription_until) !== null && (
                                  <p className={`text-xs ${
                                    isExpired(user.subscription_until) ? 'text-red-400' :
                                    isExpiringSoon(user.subscription_until) ? 'text-yellow-400' :
                                    'text-gray-500'
                                  }`}>
                                    {isExpired(user.subscription_until)
                                      ? 'Expired'
                                      : `${getDaysRemaining(user.subscription_until)} hari tersisa`}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                          <td className="p-4 text-sm text-gray-400">
                            {formatDateTime(user.created_at)}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-end gap-2">
                              {user.is_pro ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => deactivatePro(user.id)}
                                  disabled={activating === user.id}
                                  className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                                >
                                  {activating === user.id ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      <UserX className="w-4 h-4 mr-1" /> Downgrade
                                    </>
                                  )}
                                </Button>
                              ) : (
                                <div className="relative">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowDropdown(showDropdown === user.id ? null : user.id)}
                                    disabled={activating === user.id}
                                    className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                                  >
                                    {activating === user.id ? (
                                      <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <>
                                        <Crown className="w-4 h-4 mr-1" /> Ubah ke Elite Pro
                                        <ChevronDown className="w-4 h-4 ml-1" />
                                      </>
                                    )}
                                  </Button>

                                  <AnimatePresence>
                                    {showDropdown === user.id && (
                                      <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute right-0 top-full mt-2 bg-[#1a1225] border border-purple-500/30 rounded-lg shadow-xl overflow-hidden z-50 min-w-[180px]"
                                      >
                                        <button
                                          onClick={() => activatePro(user.id, 1)}
                                          className="w-full px-4 py-3 text-left text-sm hover:bg-purple-500/10 transition-colors flex items-center gap-3 border-b border-purple-500/10"
                                        >
                                          <Clock className="w-4 h-4 text-amber-400" />
                                          <div>
                                            <div className="font-semibold">1 Bulan</div>
                                            <div className="text-xs text-gray-500">Rp 49.000</div>
                                          </div>
                                        </button>
                                        <button
                                          onClick={() => activatePro(user.id, 6)}
                                          className="w-full px-4 py-3 text-left text-sm hover:bg-purple-500/10 transition-colors flex items-center gap-3 border-b border-purple-500/10"
                                        >
                                          <Clock className="w-4 h-4 text-emerald-400" />
                                          <div>
                                            <div className="font-semibold">6 Bulan</div>
                                            <div className="text-xs text-gray-500">Rp 294.000</div>
                                          </div>
                                        </button>
                                        <button
                                          onClick={() => activatePro(user.id, 0)}
                                          className="w-full px-4 py-3 text-left text-sm hover:bg-purple-500/10 transition-colors flex items-center gap-3 bg-gradient-to-r from-purple-500/10 to-violet-500/10"
                                        >
                                          <Sparkles className="w-4 h-4 text-purple-400" />
                                          <div>
                                            <div className="font-semibold text-purple-300">Lifetime</div>
                                            <div className="text-xs text-purple-400/60">Akses Selamanya</div>
                                          </div>
                                        </button>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  )
}
