'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import {
  Shield, Users, Crown, Clock, Mail, Calendar,
  RefreshCw, CheckCircle, XCircle, AlertTriangle,
  TrendingUp, UserCheck, UserX, ChevronDown, Edit, Eye, LogOut, Search
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

// Admin email - hardcoded for security
const ADMIN_EMAIL = 'luxtradee@gmail.com'

interface AdminUser {
  id: string
  email: string
  full_name: string
  subscription_status: string
  is_pro: boolean
  subscription_until: string | null
  my_referral_code: string | null
  referred_by_code: string | null
  affiliate_balance: number
  referral_status: string | null
  has_ever_been_pro: boolean
  commission_paid: boolean
  created_at: string
}

// PRO price constants
const PRO_PRICE_30_DAYS = 48000
const PRO_PRICE_180_DAYS = 749000
const PRO_PRICE_365_DAYS = 1499000

export default function AdminPanel() {
  const { user, profile, loading, signOut } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [filteredUsers, setFilteredUsers] = useState<AdminUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activating, setActivating] = useState<string | null>(null)
  const [showDropdown, setShowDropdown] = useState<string | null>(null)

  // Filter & Search states
  const [statusFilter, setStatusFilter] = useState<'all' | 'pro' | 'free' | 'expired'>('all')
  const [searchEmail, setSearchEmail] = useState('')

  // Edit User Modal
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [editingPlan, setEditingPlan] = useState<'PRO' | 'FREE'>('PRO')
  const [editingDuration, setEditingDuration] = useState<30 | 180 | 365>(30)
  const [processingEdit, setProcessingEdit] = useState(false)

  // Impersonation Modal
  const [impersonationEmail, setImpersonationEmail] = useState('')

  // Redirect if not admin
  useEffect(() => {
    if (!loading && user) {
      if (user.email !== ADMIN_EMAIL) {
        toast.error('Access denied. Admin only.')
        router.push('/dashboard')
      } else {
        fetchUsers()
      }
    }
    if (!loading && !user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

  // Real-time auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading && user && user.email === ADMIN_EMAIL) {
        fetchUsers()
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [user, loading])

  // Apply filters
  useEffect(() => {
    let filtered = users

    // Apply status filter
    if (statusFilter === 'pro') {
      filtered = filtered.filter(u => u.is_pro && !isExpired(u.subscription_until))
    } else if (statusFilter === 'free') {
      filtered = filtered.filter(u => !u.is_pro)
    } else if (statusFilter === 'expired') {
      filtered = filtered.filter(u => isExpired(u.subscription_until))
    }

    // Apply email search
    if (searchEmail.trim()) {
      const searchLower = searchEmail.toLowerCase()
      filtered = filtered.filter(u => u.email.toLowerCase().includes(searchLower))
    }

    setFilteredUsers(filtered)
  }, [users, statusFilter, searchEmail])

  const fetchUsers = async () => {
    setIsLoading(true)
    try {
      // Get session token for admin API auth
      const { supabase } = await import('@/lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const usersRes = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      const usersData = await usersRes.json()

      // Users API returns { users, count } directly
      const usersList = usersData.users || []
      setUsers(usersList)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to fetch data')
    } finally {
      setIsLoading(false)
    }
  }

  const openEditModal = (user: AdminUser) => {
    setEditingUser(user)
    setEditingPlan(user.is_pro ? 'PRO' : 'FREE')
    setEditingDuration(30)
    setEditModalOpen(true)
  }

  const handleUserUpdate = async () => {
    if (!editingUser) return
    setProcessingEdit(true)
    try {
      const res = await fetch('/api/admin/manual-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editingUser.id,
          planType: editingPlan,
          duration: editingDuration,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`User ${editingUser.email} successfully updated to ${editingPlan} plan!`)
        setEditModalOpen(false)
        setEditingUser(null)
        fetchUsers()
      } else {
        toast.error(data.error || 'Gagal mengupdate user')
      }
    } catch (error) {
      console.error('Error updating user:', error)
      toast.error('Terjadi kesalahan saat mengupdate user')
    } finally {
      setProcessingEdit(false)
    }
  }

  const handleImpersonation = async () => {
    if (!impersonationEmail.trim()) {
      toast.error('Masukkan email user yang ingin dilihat')
      return
    }

    const targetUser = users.find(u => u.email.toLowerCase() === impersonationEmail.toLowerCase())
    if (!targetUser) {
      toast.error('User tidak ditemukan')
      return
    }

    // Save impersonation session
    localStorage.setItem('admin_impersonating', targetUser.id)
    localStorage.setItem('admin_impersonating_email', targetUser.email)

    toast.success(`Mengalihkan ke view user: ${targetUser.email}`)
    router.push('/dashboard')
  }

  const formatRupiah = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
  const freeUsers = totalUsers - proUsers
  const expiredUsers = users.filter(u => isExpired(u.subscription_until)).length

  // Estimate revenue (simplified calculation)
  const estimateRevenue = users
    .filter(u => u.has_ever_been_pro)
    .reduce((sum, u) => {
      if (!u.subscription_until) return sum
      const daysUsed = getDaysRemaining(u.subscription_until)
      if (!daysUsed || daysUsed < 0) return sum
      // Simplified: assume all PRO users paid for at least 30 days
      return sum + PRO_PRICE_30_DAYS
    }, 0)

  if (loading || !user || user.email !== ADMIN_EMAIL) {
    return (
      <div className="min-h-screen bg-[#0a0712] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Verifying admin access...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0712] text-white">
      {/* Header */}
      <header className="border-b border-purple-900/30 bg-[#0f0b18]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-lg shadow-red-500/30">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Admin Secret Panel</h1>
              <p className="text-xs text-gray-500">LuxTrade Owner Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-red-500/30 text-red-400">
              <Shield className="w-3 h-3 mr-1" /> Admin
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImpersonationEmail('')}
              className="border-purple-500/30 text-purple-400"
            >
              <Eye className="w-4 h-4 mr-2" />
              View As User
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/dashboard')}
              className="text-gray-400 hover:text-white"
            >
              Back to Dashboard
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="text-gray-400 hover:text-red-400"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Users</p>
                  <p className="text-2xl font-bold">{totalUsers}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">PRO Users</p>
                  <p className="text-2xl font-bold text-amber-400">{proUsers}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-500/20 flex items-center justify-center">
                  <UserX className="w-5 h-5 text-gray-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Free Users</p>
                  <p className="text-2xl font-bold">{freeUsers}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Est. Revenue</p>
                  <p className="text-lg font-bold text-emerald-400">{formatRupiah(estimateRevenue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
          <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-purple-900/30">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              User Management
            </CardTitle>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Search */}
              <div className="relative flex-1 md:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  placeholder="Cari email..."
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  className="bg-[#0a0712] border-purple-900/30 pl-9 text-sm w-full md:w-64"
                />
              </div>

              {/* Status Filter */}
              <div className="flex gap-1">
                <Button
                  variant={statusFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('all')}
                  className={statusFilter === 'all' ? 'bg-purple-600' : 'border-purple-500/30 text-purple-400'}
                >
                  All
                </Button>
                <Button
                  variant={statusFilter === 'pro' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('pro')}
                  className={statusFilter === 'pro' ? 'bg-amber-600' : 'border-purple-500/30 text-amber-400'}
                >
                  PRO
                </Button>
                <Button
                  variant={statusFilter === 'free' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('free')}
                  className={statusFilter === 'free' ? 'bg-gray-600' : 'border-purple-500/30 text-gray-400'}
                >
                  FREE
                </Button>
                <Button
                  variant={statusFilter === 'expired' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('expired')}
                  className={statusFilter === 'expired' ? 'bg-red-600' : 'border-purple-500/30 text-red-400'}
                >
                  Expired
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchUsers}
                disabled={isLoading}
                className="border-purple-500/30 text-purple-400"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-purple-900/30 text-left text-xs text-gray-500 uppercase tracking-wider">
                    <th className="p-4">Email</th>
                    <th className="p-4">Name</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Sisa Hari</th>
                    <th className="p-4">Expired</th>
                    <th className="p-4">Registered</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-900/20">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center">
                        <div className="flex items-center justify-center">
                          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mr-2" />
                          Loading users...
                        </div>
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-500">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr
                        key={user.id}
                        className="hover:bg-white/5 transition-colors"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-500" />
                            <span className="font-mono text-sm">{user.email}</span>
                          </div>
                        </td>
                        <td className="p-4 text-gray-300">
                          {user.full_name}
                        </td>
                        <td className="p-4">
                          {user.is_pro && !isExpired(user.subscription_until) ? (
                            <div className="flex items-center gap-2">
                              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                                <Crown className="w-3 h-3 mr-1" /> PRO
                              </Badge>
                              {isExpiringSoon(user.subscription_until) && (
                                <AlertTriangle className="w-4 h-4 text-yellow-500" title="Expiring soon" />
                              )}
                            </div>
                          ) : (
                            <Badge variant="outline" className="border-gray-500/30 text-gray-400">
                              {isExpired(user.subscription_until) ? 'Expired' : 'FREE'}
                            </Badge>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="text-sm">
                            {getDaysRemaining(user.subscription_until) !== null && getDaysRemaining(user.subscription_until) >= 0 ? (
                              <p className={isExpired(user.subscription_until) ? 'text-red-400' : 'text-gray-300'}>
                                {getDaysRemaining(user.subscription_until)} hari
                              </p>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-sm text-gray-400">
                          {formatDate(user.subscription_until)}
                        </td>
                        <td className="p-4 text-sm text-gray-400">
                          {formatDateTime(user.created_at)}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditModal(user)}
                              className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                              title="Edit User Subscription"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
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
      </main>

      {/* Edit User Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="bg-[#0f0b18] border-purple-900/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User Subscription</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editingUser && (
              <div className="space-y-3 text-sm">
                <div className="p-3 bg-[#0a0712] rounded-lg border border-purple-900/20">
                  <p><span className="text-gray-500">Email:</span> {editingUser.email}</p>
                  <p><span className="text-gray-500">Name:</span> {editingUser.full_name}</p>
                  <p><span className="text-gray-500">Current Plan:</span>
                    <span className={editingUser.is_pro ? 'text-amber-400' : 'text-gray-400'}>
                      {editingUser.is_pro ? 'PRO' : 'FREE'}
                    </span>
                  </p>
                  {editingUser.subscription_until && (
                    <p><span className="text-gray-500">Current Expiry:</span> {formatDate(editingUser.subscription_until)}</p>
                  )}
                </div>
                <div>
                  <Label className="mb-2 block">Plan Type</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={editingPlan === 'PRO' ? 'default' : 'outline'}
                      className={editingPlan === 'PRO' ? 'bg-amber-500 hover:bg-amber-600' : 'border-purple-500/30 text-purple-400'}
                      onClick={() => setEditingPlan('PRO')}
                    >
                      <Crown className="w-4 h-4 mr-2" /> PRO
                    </Button>
                    <Button
                      type="button"
                      variant={editingPlan === 'FREE' ? 'default' : 'outline'}
                      className={editingPlan === 'FREE' ? 'bg-gray-500 hover:bg-gray-600' : 'border-purple-500/30 text-purple-400'}
                      onClick={() => setEditingPlan('FREE')}
                    >
                      <UserX className="w-4 h-4 mr-2" /> FREE
                    </Button>
                  </div>
                </div>
                {editingPlan === 'PRO' && (
                  <>
                    <div>
                      <Label className="mb-2 block">Duration</Label>
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          type="button"
                          variant={editingDuration === 30 ? 'default' : 'outline'}
                          className={editingDuration === 30 ? 'bg-blue-500 hover:bg-blue-600' : 'border-purple-500/30 text-purple-400'}
                          onClick={() => setEditingDuration(30)}
                        >
                          30 Days
                        </Button>
                        <Button
                          type="button"
                          variant={editingDuration === 180 ? 'default' : 'outline'}
                          className={editingDuration === 180 ? 'bg-emerald-500 hover:bg-emerald-600' : 'border-purple-500/30 text-purple-400'}
                          onClick={() => setEditingDuration(180)}
                        >
                          180 Days
                        </Button>
                        <Button
                          type="button"
                          variant={editingDuration === 365 ? 'default' : 'outline'}
                          className={editingDuration === 365 ? 'bg-purple-500 hover:bg-purple-600' : 'border-purple-500/30 text-purple-400'}
                          onClick={() => setEditingDuration(365)}
                        >
                          365 Days
                        </Button>
                      </div>
                    </div>
                    <div className="p-3 bg-[#0a0712] rounded-lg border border-purple-900/20">
                      <p className="text-xs text-gray-500 mb-1">Harga:</p>
                      <p className="text-lg font-bold text-amber-400">
                        {editingDuration === 30 ? formatRupiah(PRO_PRICE_30_DAYS) :
                         editingDuration === 180 ? formatRupiah(PRO_PRICE_180_DAYS) :
                         formatRupiah(PRO_PRICE_365_DAYS)}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditModalOpen(false)} className="border-purple-900/30">Batal</Button>
            <Button
              onClick={handleUserUpdate}
              disabled={processingEdit}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {processingEdit ? 'Memproses...' : 'Update User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Impersonation Modal */}
      <Dialog open={impersonationEmail !== ''} onOpenChange={(open) => !open && setImpersonationEmail('')}>
        <DialogContent className="bg-[#0f0b18] border-purple-900/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>View As User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Masukkan Email User</Label>
              <Input
                value={impersonationEmail}
                onChange={(e) => setImpersonationEmail(e.target.value)}
                placeholder="user@example.com"
                className="bg-[#0a0712] border-purple-900/30 mt-1"
              />
            </div>
            <p className="text-xs text-gray-500">
              Anda akan melihat dashboard dari perspektif user tersebut.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setImpersonationEmail('')} className="border-purple-900/30">Batal</Button>
            <Button
              onClick={handleImpersonation}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Eye className="w-4 h-4 mr-2" />
              Lihat sebagai User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
