'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { 
  Shield, Users, Crown, Clock, Mail, Calendar, 
  RefreshCw, LogOut, CheckCircle, XCircle, AlertTriangle,
  TrendingUp, UserCheck, UserX, ChevronDown, Wallet, Banknote
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
  subscription_status: 'FREE' | 'PRO'
  pro_status: 'active' | 'inactive' | 'expired'
  pro_expiry_date: string | null
  referral_code: string
  referral_count: number
  created_at: string
}

interface AdminWithdrawal {
  id: string
  userId: string
  email: string
  fullName: string | null
  amount: number
  bankName: string
  bankAccount: string
  bankHolder: string
  status: string
  adminNote: string | null
  createdAt: string
  updatedAt: string
}

export default function AdminPanel() {
  const { user, profile, loading, signOut } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activating, setActivating] = useState<string | null>(null)
  const [showDropdown, setShowDropdown] = useState<string | null>(null)

  // Withdrawal modal
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false)
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<AdminWithdrawal | null>(null)
  const [withdrawAction, setWithdrawAction] = useState<'approve' | 'reject' | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [processingWithdrawal, setProcessingWithdrawal] = useState(false)
  const [activeTab, setActiveTab] = useState<'users' | 'withdrawals'>('users')

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

  const fetchUsers = async () => {
    setIsLoading(true)
    try {
      const [usersRes, withdrawalsRes] = await Promise.all([
        fetch(`/api/admin/users?email=${encodeURIComponent(user?.email || '')}`),
        fetch(`/api/admin/withdrawals?adminEmail=${encodeURIComponent(user?.email || '')}`),
      ])
      const usersData = await usersRes.json()
      const withdrawalsData = await withdrawalsRes.json()
      
      if (usersData.success) setUsers(usersData.users)
      if (withdrawalsData.success) setWithdrawals(withdrawalsData.withdrawals)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to fetch data')
    } finally {
      setIsLoading(false)
    }
  }

  const activatePro = async (userId: string, months: number) => {
    setActivating(userId)
    setShowDropdown(null)
    
    try {
      const response = await fetch('/api/admin/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminEmail: user?.email,
          userId,
          months,
        }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast.success(`PRO activated for ${months} month(s)!`)
        fetchUsers() // Refresh list
      } else {
        toast.error(data.error || 'Failed to activate PRO')
      }
    } catch (error) {
      console.error('Error activating PRO:', error)
      toast.error('Failed to activate PRO')
    } finally {
      setActivating(null)
    }
  }

  const deactivatePro = async (userId: string) => {
    if (!confirm('Are you sure you want to deactivate PRO for this user?')) return
    
    setActivating(userId)
    
    try {
      const response = await fetch(`/api/admin/activate?adminEmail=${encodeURIComponent(user?.email || '')}&userId=${userId}`, {
        method: 'DELETE',
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast.success('PRO status deactivated')
        fetchUsers() // Refresh list
      } else {
        toast.error(data.error || 'Failed to deactivate PRO')
      }
    } catch (error) {
      console.error('Error deactivating PRO:', error)
      toast.error('Failed to deactivate PRO')
    } finally {
      setActivating(null)
    }
  }

  const handleWithdrawalAction = async () => {
    if (!selectedWithdrawal || !withdrawAction) return
    setProcessingWithdrawal(true)
    try {
      const res = await fetch('/api/admin/withdrawals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminEmail: user?.email,
          withdrawalId: selectedWithdrawal.id,
          status: withdrawAction,
          adminNote: adminNote || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(withdrawAction === 'approve' ? 'Penarikan disetujui!' : 'Penarikan ditolak.')
        setWithdrawModalOpen(false)
        setSelectedWithdrawal(null)
        setAdminNote('')
        setWithdrawAction(null)
        fetchUsers()
      } else {
        toast.error(data.error || 'Gagal')
      }
    } catch { toast.error('Terjadi kesalahan') }
    finally { setProcessingWithdrawal(false) }
  }

  const openWithdrawalModal = (w: AdminWithdrawal, action: 'approve' | 'reject') => {
    setSelectedWithdrawal(w)
    setWithdrawAction(action)
    setAdminNote('')
    setWithdrawModalOpen(true)
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
  const proUsers = users.filter(u => u.subscription_status === 'PRO').length
  const freeUsers = totalUsers - proUsers
  const totalReferrals = users.reduce((sum, u) => sum + (u.referral_count || 0), 0)
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending').length

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
              <h1 className="font-bold text-lg">Admin Panel</h1>
              <p className="text-xs text-gray-500">LuxTrade Owner Dashboard</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-red-500/30 text-red-400">
              <Shield className="w-3 h-3 mr-1" /> Admin
            </Badge>
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
                  <p className="text-xs text-gray-500">Total Referrals</p>
                  <p className="text-2xl font-bold text-emerald-400">{totalReferrals}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'users' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
          >
            <Users className="w-4 h-4" /> Users
          </button>
          <button
            onClick={() => setActiveTab('withdrawals')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all relative ${activeTab === 'withdrawals' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
          >
            <Wallet className="w-4 h-4" /> Penarikan Saldo
            {pendingWithdrawals > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-[10px] text-white font-bold flex items-center justify-center">
                {pendingWithdrawals}
              </span>
            )}
          </button>
        </div>

        {/* Users Table */}
        {activeTab === 'users' && (
        <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
          <CardHeader className="flex flex-row items-center justify-between border-b border-purple-900/30">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              User Management
            </CardTitle>
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
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-purple-900/30 text-left text-xs text-gray-500 uppercase tracking-wider">
                    <th className="p-4">Email</th>
                    <th className="p-4">Name</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Expiry</th>
                    <th className="p-4">Referrals</th>
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
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-500">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
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
                          {user.subscription_status === 'PRO' ? (
                            <div className="flex items-center gap-2">
                              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                                <Crown className="w-3 h-3 mr-1" /> PRO
                              </Badge>
                              {isExpiringSoon(user.pro_expiry_date) && (
                                <AlertTriangle className="w-4 h-4 text-yellow-500" title="Expiring soon" />
                              )}
                              {isExpired(user.pro_expiry_date) && (
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
                          {user.pro_expiry_date ? (
                            <div className="text-sm">
                              <p>{formatDate(user.pro_expiry_date)}</p>
                              {getDaysRemaining(user.pro_expiry_date) !== null && (
                                <p className={`text-xs ${
                                  isExpired(user.pro_expiry_date) ? 'text-red-400' :
                                  isExpiringSoon(user.pro_expiry_date) ? 'text-yellow-400' :
                                  'text-gray-500'
                                }`}>
                                  {isExpired(user.pro_expiry_date) 
                                    ? 'Expired' 
                                    : `${getDaysRemaining(user.pro_expiry_date)} days left`}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            <span className="font-semibold">{user.referral_count}</span>
                            {user.referral_code && user.referral_code !== '-' && (
                              <span className="text-xs text-gray-500 font-mono">({user.referral_code})</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-sm text-gray-400">
                          {formatDateTime(user.created_at)}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-2">
                            {user.subscription_status === 'PRO' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deactivatePro(user.id)}
                                disabled={activating === user.id}
                                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                              >
                                {activating === user.id ? (
                                  <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <>
                                    <UserX className="w-4 h-4 mr-1" /> Deactivate
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
                                    <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <>
                                      <Crown className="w-4 h-4 mr-1" /> Activate PRO
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
                                      className="absolute right-0 top-full mt-2 bg-[#1a1225] border border-purple-500/30 rounded-lg shadow-xl overflow-hidden z-10 min-w-[160px]"
                                    >
                                      <button
                                        onClick={() => activatePro(user.id, 1)}
                                        className="w-full px-4 py-2 text-left text-sm hover:bg-purple-500/10 transition-colors flex items-center gap-2"
                                      >
                                        <Clock className="w-4 h-4 text-amber-400" />
                                        1 Bulan
                                      </button>
                                      <button
                                        onClick={() => activatePro(user.id, 3)}
                                        className="w-full px-4 py-2 text-left text-sm hover:bg-purple-500/10 transition-colors flex items-center gap-2"
                                      >
                                        <Clock className="w-4 h-4 text-emerald-400" />
                                        3 Bulan
                                      </button>
                                      <button
                                        onClick={() => activatePro(user.id, 6)}
                                        className="w-full px-4 py-2 text-left text-sm hover:bg-purple-500/10 transition-colors flex items-center gap-2"
                                      >
                                        <Clock className="w-4 h-4 text-blue-400" />
                                        6 Bulan
                                      </button>
                                      <button
                                        onClick={() => activatePro(user.id, 12)}
                                        className="w-full px-4 py-2 text-left text-sm hover:bg-purple-500/10 transition-colors flex items-center gap-2"
                                      >
                                        <Clock className="w-4 h-4 text-purple-400" />
                                        12 Bulan
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
        )}

        {/* Withdrawals Table */}
        {activeTab === 'withdrawals' && (
        <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
          <CardHeader className="flex flex-row items-center justify-between border-b border-purple-900/30">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-amber-400" />
              Penarikan Saldo
              {pendingWithdrawals > 0 && (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 ml-2">
                  {pendingWithdrawals} pending
                </Badge>
              )}
            </CardTitle>
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
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-purple-900/30 text-left text-xs text-gray-500 uppercase tracking-wider">
                    <th className="p-4">User</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Bank</th>
                    <th className="p-4">Account</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Date</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-900/20">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center">
                        <div className="flex items-center justify-center">
                          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mr-2" />
                          Loading...
                        </div>
                      </td>
                    </tr>
                  ) : withdrawals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-500">
                        No withdrawal requests
                      </td>
                    </tr>
                  ) : (
                    withdrawals.map((w) => (
                      <tr key={w.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4">
                          <div>
                            <p className="text-sm font-medium">{w.fullName || w.email}</p>
                            <p className="text-xs text-gray-500 font-mono">{w.email}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="font-semibold text-amber-400">{formatRupiah(w.amount)}</span>
                        </td>
                        <td className="p-4 text-sm text-gray-300">{w.bankName}</td>
                        <td className="p-4 text-sm text-gray-300">
                          <p>{w.bankAccount}</p>
                          <p className="text-xs text-gray-500">{w.bankHolder}</p>
                        </td>
                        <td className="p-4">
                          <Badge className={
                            w.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                            w.status === 'rejected' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                            'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                          }>
                            {w.status === 'approved' ? 'Disetujui' : w.status === 'rejected' ? 'Ditolak' : 'Pending'}
                          </Badge>
                        </td>
                        <td className="p-4 text-sm text-gray-400">{formatDateTime(w.createdAt)}</td>
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-1">
                            {w.status === 'pending' && (
                              <>
                                <Button size="sm" variant="outline" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" onClick={() => openWithdrawalModal(w, 'approve')}>
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => openWithdrawalModal(w, 'reject')}>
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            {w.adminNote && (
                              <span className="text-xs text-gray-500 max-w-[100px] truncate" title={w.adminNote}>{w.adminNote}</span>
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
        )}

        {/* Withdrawal Action Modal */}
        <Dialog open={withdrawModalOpen} onOpenChange={setWithdrawModalOpen}>
          <DialogContent className="bg-[#0f0b18] border-purple-900/30 text-white max-w-md">
            <DialogHeader>
              <DialogTitle>
                {withdrawAction === 'approve' ? 'Setujui Penarikan' : 'Tolak Penarikan'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedWithdrawal && (
                <div className="space-y-2 text-sm">
                  <p><span className="text-gray-500">User:</span> {selectedWithdrawal.fullName || selectedWithdrawal.email}</p>
                  <p><span className="text-gray-500">Amount:</span> <span className="text-amber-400 font-semibold">{formatRupiah(selectedWithdrawal.amount)}</span></p>
                  <p><span className="text-gray-500">Bank:</span> {selectedWithdrawal.bankName} - {selectedWithdrawal.bankAccount}</p>
                </div>
              )}
              <div>
                <Label>Catatan Admin (opsional)</Label>
                <Input
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Tambahkan catatan..."
                  className="bg-[#0a0712] border-purple-900/30 mt-1"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setWithdrawModalOpen(false)} className="border-purple-900/30">Batal</Button>
              <Button
                onClick={handleWithdrawalAction}
                disabled={processingWithdrawal}
                className={withdrawAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}
              >
                {processingWithdrawal ? 'Memproses...' : withdrawAction === 'approve' ? 'Setujui' : 'Tolak'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
