'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Users,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Edit,
  Shield,
  Crown,
  Plus,
  RefreshCw,
  Wifi,
  Mail,
  UserCircle
} from 'lucide-react'

interface Subscription {
  id: string
  userId: string | null
  userEmail: string
  userName: string | null
  planId: string
  startDate: string
  endDate: string | null
  isActive: boolean
  paymentStatus: string
  amountPaid: number | null
  paymentMethod: string | null
  adminNote: string | null
  plan: Plan
}

interface Plan {
  id: string
  name: string
  description: string | null
  price: number
  currency: string
  durationMonths: number | null
  isLifetime: boolean
  maxSlots: number | null
}

interface SlotInfo {
  totalSlots: number
  usedSlots: number
  availableSlots: number
  isSoldOut: boolean
}

interface User {
  id: string
  email: string
  name: string | null
  createdAt: string
  updatedAt: string
  subscriptionCount: number
}

interface AffiliateStats {
  affiliateId: string
  myReferralCode: string
  email: string
  name: string
  affiliateBalance: number
  totalReferred: number
  activePro: number
  totalCommission: number
  totalCommissionPending: number
  createdAt: string
}

export default function AdminSubscriptionsPanel() {
  const [activeTab, setActiveTab] = useState('users')

  // User state
  const [users, setUsers] = useState<User[]>([])

  // Subscription state
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [slotInfo, setSlotInfo] = useState<SlotInfo | null>(null)

  // Affiliate state
  const [affiliateStats, setAffiliateStats] = useState<AffiliateStats[]>([])

  // Common state
  const [loading, setLoading] = useState(true)
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [newSubscriptionDialogOpen, setNewSubscriptionDialogOpen] = useState(false)
  const [newUserDialogOpen, setNewUserDialogOpen] = useState(false)
  const [isRealTimeConnected, setIsRealTimeConnected] = useState(false)
  const [cancellingUserId, setCancellingUserId] = useState<string | null>(null)

  // Edit form state
  const [editEndDate, setEditEndDate] = useState('')
  const [editDuration, setEditDuration] = useState('')
  const [editDurationType, setEditDurationType] = useState<'months' | 'years'>('months')
  const [editAdminNote, setEditAdminNote] = useState('')

  // New subscription form state
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserName, setNewUserName] = useState('')
  const [newPlanId, setNewPlanId] = useState('')

  // New user form state
  const [createUserEmail, setCreateUserEmail] = useState('')
  const [createUserName, setCreateUserName] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)

  const handleSyncAuthUsers = async () => {
    if (!confirm('Sinkronisasi user dari Supabase Auth ke database Prisma. Lanjutkan?')) {
      return
    }

    setIsSyncing(true)
    try {
      console.log('🔄 Starting manual sync...')

      const res = await fetch('/api/admin/sync-auth-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      console.log('📥 Sync response status:', res.status)

      const data = await res.json()
      console.log('📥 Sync response data:', data)

      if (res.ok) {
        fetchData()
        alert(`✅ Sinkronisasi Berhasil!\n\n${data.syncedCount} user baru disinkronkan\n${data.skippedCount} user dilewati (sudah ada)\n\nTotal user di Prisma: ${data.totalPrismaUsers}`)
      } else {
        console.error('❌ Sync failed:', data)
        alert(`❌ Gagal sinkronisasi: ${data.error}`)
      }
    } catch (error) {
      console.error('❌ Error syncing auth users:', error)
      alert('Gagal sinkronisasi user')
    } finally {
      setIsSyncing(false)
    }
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    console.log('🔄 Fetching data from admin panel...')
    try {
      // Fetch users
      console.log('📥 Fetching users from /api/admin/users')
      const userRes = await fetch('/api/admin/users')
      console.log('📥 User response status:', userRes.status)

      const userData = await userRes.json()
      console.log('📥 User data response:', userData)

      if (userData.error) {
        console.error('❌ API returned error:', userData.error)
        const errorMsg = userData.details
          ? `${userData.error}\n\nDetails: ${userData.details}`
          : userData.error

        if (userData.debug) {
          console.error('Debug info:', userData.debug)
          alert(`Error fetching users:\n${errorMsg}\n\nDebug: ${JSON.stringify(userData.debug, null, 2)}`)
        } else {
          alert(`Error fetching users: ${errorMsg}`)
        }
      }

      setUsers(userData.users || [])
      console.log(`✅ Set ${userData.users?.length || 0} users to state`)

      // Fetch subscriptions
      console.log('📥 Fetching subscriptions...')
      const subRes = await fetch('/api/admin/subscriptions')
      const subData = await subRes.json()
      setSubscriptions(subData.subscriptions || [])

      // Fetch plans
      console.log('📥 Fetching plans...')
      const planRes = await fetch('/api/admin/plans')
      const planData = await planRes.json()
      setPlans(planData.plans || [])

      // Fetch slot info for Lifetime Ultra
      const lifetimeUltraPlan = planData.plans?.find((p: Plan) => p.name === 'Lifetime Ultra')
      if (lifetimeUltraPlan) {
        const slotRes = await fetch(`/api/lifetime/subscriptions?planId=${lifetimeUltraPlan.id}`)
        const slotData = await slotRes.json()
        if (slotData.slotInfo) {
          setSlotInfo(slotData.slotInfo)
        }
      }

      // Fetch affiliate stats
      const affiliateRes = await fetch('/api/admin/affiliate-stats')
      const affiliateData = await affiliateRes.json()
      setAffiliateStats(affiliateData.data || [])
    } catch (error) {
      console.error('❌ Error fetching data in admin panel:', error)
      console.error('Full error details:', JSON.stringify(error, null, 2))
      alert('Failed to fetch data. Check console for details.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Background fetch - does NOT show loading state
  const fetchDataBackground = useCallback(async () => {
    console.log('🔄 Background fetch (no loading state)...')
    try {
      // Fetch users
      const userRes = await fetch('/api/admin/users')
      const userData = await userRes.json()
      setUsers(userData.users || [])

      // Fetch subscriptions
      const subRes = await fetch('/api/admin/subscriptions')
      const subData = await subRes.json()
      setSubscriptions(subData.subscriptions || [])

      // Fetch plans
      const planRes = await fetch('/api/admin/plans')
      const planData = await planRes.json()
      setPlans(planData.plans || [])

      // Fetch slot info for Lifetime Ultra
      const lifetimeUltraPlan = planData.plans?.find((p: Plan) => p.name === 'Lifetime Ultra')
      if (lifetimeUltraPlan) {
        const slotRes = await fetch(`/api/lifetime/subscriptions?planId=${lifetimeUltraPlan.id}`)
        const slotData = await slotRes.json()
        if (slotData.slotInfo) {
          setSlotInfo(slotData.slotInfo)
        }
      }

      // Fetch affiliate stats
      const affiliateRes = await fetch('/api/admin/affiliate-stats')
      const affiliateData = await affiliateRes.json()
      setAffiliateStats(affiliateData.data || [])
    } catch (error) {
      console.error('❌ Background fetch error:', error)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Real-time updates with polling (60 seconds, no loading state)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDataBackground().catch(err => console.error('Polling error:', err))
      setIsRealTimeConnected(true)
    }, 60000) // 60 seconds

    return () => clearInterval(interval)
  }, [fetchDataBackground])

  const handleCreateUser = async () => {
    if (!createUserEmail) {
      alert('Please enter user email')
      return
    }

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: createUserEmail,
          name: createUserName || null
        })
      })

      if (res.ok) {
        fetchData()
        setNewUserDialogOpen(false)
        setCreateUserEmail('')
        setCreateUserName('')
      } else {
        const errorData = await res.json()
        alert(errorData.error || 'Failed to create user')
      }
    } catch (error) {
      console.error('Error creating user:', error)
      alert('Failed to create user')
    }
  }

  const handleDeleteUser = async (id: string, email: string) => {
    if (!confirm(`Are you sure you want to delete user ${email}?`)) return

    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        fetchData()
      } else {
        const errorData = await res.json()
        alert(errorData.error || 'Failed to delete user')
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('Failed to delete user')
    }
  }

  const handleActivatePro = async (userId: string, planType: 'MONTHLY' | 'LIFETIME') => {
    console.log('🎯 handleActivatePro called')
    console.log('   userId:', userId)
    console.log('   planType:', planType)

    alert(`Sistem sedang mencoba mengaktifkan ${planType === 'MONTHLY' ? 'Monthly' : 'Lifetime'} untuk user: ${userId}`)

    if (!userId || !planType) {
      console.log('❌ Cannot activate - missing userId or planType')
      alert('Missing userId or planType')
      return
    }

    try {
      console.log('🚀 Calling API to activate Pro for user:', userId, 'with planType:', planType)

      const res = await fetch('/api/admin/activate-pro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, planType })
      })

      console.log('📥 API response status:', res.status)

      const data = await res.json()
      console.log('📥 API response data:', data)

      if (!res.ok) {
        console.error('❌ API Error:', data)
        const errorMsg = data.details ? `${data.error}\n\nDetails: ${data.details}` : data.error
        alert(`❌ Gagal mengaktifkan:\n${errorMsg}`)
        return
      }

      fetchDataBackground() // No loading state
      alert(`✅ User Berhasil Diaktifkan ${planType === 'MONTHLY' ? 'Monthly' : 'Lifetime'}!\n\nEmail: ${data.data.userEmail}`)
    } catch (error) {
      console.error('❌ Error Detail:', error)
      console.error('   Error type:', error?.constructor?.name)
      console.error('   Error message:', error instanceof Error ? error.message : String(error))
      const errorMsg = error instanceof Error ? error.message : String(error)
      alert(`Gagal mengaktifkan Pro subscription:\n${errorMsg}\n\nCek console browser untuk detail error (F12 -> Console)`)
    }
  }

  const handleActivate = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/subscriptions/${id}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endDate: editEndDate || null,
          paymentMethod: 'manual',
          adminNote: 'Activated by admin'
        })
      })

      if (res.ok) {
        fetchData()
        setEditDialogOpen(false)
      }
    } catch (error) {
      console.error('Error activating subscription:', error)
      alert('Failed to activate subscription')
    }
  }

  const handleDeactivate = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this subscription?')) return

    try {
      const res = await fetch(`/api/admin/subscriptions/${id}/deactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Deactivated by admin' })
      })

      if (res.ok) {
        fetchData()
      }
    } catch (error) {
      console.error('Error deactivating subscription:', error)
      alert('Failed to deactivate subscription')
    }
  }

  const handleUpdateSubscription = async () => {
    if (!selectedSubscription) return

    try {
      // Calculate end date based on duration
      let calculatedEndDate = null
      if (editDuration) {
        const duration = parseInt(editDuration)
        const startDate = new Date(selectedSubscription.startDate)
        const months = editDurationType === 'years' ? duration * 12 : duration
        calculatedEndDate = new Date(startDate.setMonth(startDate.getMonth() + months)).toISOString()
      } else if (editEndDate) {
        calculatedEndDate = editEndDate
      }

      const res = await fetch(`/api/admin/subscriptions/${selectedSubscription.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endDate: calculatedEndDate,
          adminNote: editAdminNote
        })
      })

      if (res.ok) {
        fetchData()
        setEditDialogOpen(false)
      }
    } catch (error) {
      console.error('Error updating subscription:', error)
      alert('Failed to update subscription')
    }
  }

  const handleCreateSubscription = async () => {
    if (!newUserEmail || !newPlanId) {
      alert('Please fill in all required fields')
      return
    }

    try {
      const res = await fetch('/api/admin/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: null,
          userEmail: newUserEmail,
          userName: newUserName || null,
          planId: newPlanId,
          paymentStatus: 'pending'
        })
      })

      if (res.ok) {
        fetchData()
        setNewSubscriptionDialogOpen(false)
        setNewUserEmail('')
        setNewUserName('')
        setNewPlanId('')
      } else {
        const errorData = await res.json()
        alert(errorData.error || 'Failed to create subscription')
      }
    } catch (error) {
      console.error('Error creating subscription:', error)
      alert('Failed to create subscription')
    }
  }

  const openEditDialog = (subscription: Subscription) => {
    setSelectedSubscription(subscription)
    setEditEndDate(subscription.endDate || '')
    setEditAdminNote(subscription.adminNote || '')
    setEditDuration('')
    setEditDialogOpen(true)
  }

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-emerald-500/20 text-emerald-400">Paid</Badge>
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-400">Pending</Badge>
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-400">Failed</Badge>
      default:
        return <Badge className="bg-gray-500/20 text-gray-400">{status}</Badge>
    }
  }

  const getPlanBadge = (plan: Plan) => {
    if (plan.isLifetime) {
      return <Badge className="bg-amber-500/20 text-amber-400"><Crown className="w-3 h-3 mr-1" />Lifetime</Badge>
    }
    return <Badge className="bg-purple-500/20 text-purple-400">{plan.durationMonths} months</Badge>
  }

  const handleCancelSubscription = async (userId: string) => {
    if (!confirm('Are you sure you want to cancel this subscription?')) return

    setCancellingUserId(userId)
    try {
      const res = await fetch('/api/admin/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })

      if (res.ok) {
        window.alert('✅ Paket Berhasil Dibatalkan!')
        await fetchDataBackground() // No loading state, data updates in background
      } else {
        const errorData = await res.json()
        alert(`Failed: ${errorData.error}`)
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error)
      alert('Failed to cancel subscription')
    } finally {
      setCancellingUserId(null)
    }
  }

  const handleMarkAsPaid = async (affiliateId: string) => {
    const res = await fetch('/api/admin/mark-as-paid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ affiliateId })
    })

    if (res.ok) {
      const data = await res.json()
      alert(`✅ Komisi berhasil dibayarkan ke ${data.data.email}`)
      fetchDataBackground() // Refresh data without loading state
    } else {
      const errorData = await res.json()
      alert(`Gagal: ${errorData.error}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0612]">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0612] text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
              <div className="flex items-center gap-2 text-white/60">
                <p>Manage users and subscriptions</p>
                {isRealTimeConnected && (
                  <Badge className="bg-emerald-500/20 text-emerald-400 text-xs flex items-center gap-1">
                    <Wifi className="w-3 h-3" />
                    Live
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleSyncAuthUsers}
                variant="outline"
                size="sm"
                disabled={isSyncing}
                className="bg-amber-500/20 border-amber-500/30 text-amber-300 hover:bg-amber-500/30 hover:text-amber-200"
              >
                {isSyncing ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Sync Auth
              </Button>
              <Button onClick={fetchData} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-white/[0.02] border-white/[0.05]">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/20">
                    <UserCircle className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{users.length}</div>
                    <div className="text-xs text-white/40">Total Users</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/[0.02] border-white/[0.05]">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/20">
                    <Users className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {subscriptions.filter(s => s.isActive).length}
                    </div>
                    <div className="text-xs text-white/40">Total Subscriptions</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/[0.02] border-white/[0.05]">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/20">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {subscriptions.filter(s => s.isActive).length}
                    </div>
                    <div className="text-xs text-white/40">Active Subscriptions</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/[0.02] border-white/[0.05]">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/20">
                    <TrendingUp className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {subscriptions
                        .filter(s => s.isActive && s.paymentStatus === 'completed')
                        .reduce((sum, s) => sum + (s.amountPaid || 0), 0)}
                    </div>
                    <div className="text-xs text-white/40">Total Revenue</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white/5 w-full md:w-auto">
            <TabsTrigger value="users">
              <UserCircle className="w-4 h-4 mr-2" />
              Users ({users.length})
            </TabsTrigger>
            <TabsTrigger value="subscriptions">
              <Users className="w-4 h-4 mr-2" />
              Subscriptions ({subscriptions.length})
            </TabsTrigger>
            <TabsTrigger value="affiliates">
              <TrendingUp className="w-4 h-4 mr-2" />
              Affiliate Tracking ({affiliateStats.length})
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="mt-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">User Management</h2>
                <Dialog open={newUserDialogOpen} onOpenChange={setNewUserDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      New User
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-[#1a0f2e] border-white/10 text-white">
                    <DialogHeader>
                      <DialogTitle>Create New User</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label htmlFor="userEmail">User Email *</Label>
                        <Input
                          id="userEmail"
                          type="email"
                          value={createUserEmail}
                          onChange={(e) => setCreateUserEmail(e.target.value)}
                          className="bg-white/5 border-white/10"
                          placeholder="user@example.com"
                        />
                      </div>
                      <div>
                        <Label htmlFor="userName">User Name</Label>
                        <Input
                          id="userName"
                          value={createUserName}
                          onChange={(e) => setCreateUserName(e.target.value)}
                          className="bg-white/5 border-white/10"
                          placeholder="John Doe"
                        />
                      </div>
                      <Button onClick={handleCreateUser} className="w-full">
                        Create User
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <Card className="bg-white/[0.02] border-white/[0.05]">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/5">
                          <th className="text-left p-4 text-white/40 font-medium text-sm">User</th>
                          <th className="text-left p-4 text-white/40 font-medium text-sm">Email</th>
                          <th className="text-left p-4 text-white/40 font-medium text-sm">Subscriptions</th>
                          <th className="text-left p-4 text-white/40 font-medium text-sm">Created</th>
                          <th className="text-left p-4 text-white/40 font-medium text-sm">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-white/40">
                              No users found. Create a new user to get started.
                            </td>
                          </tr>
                        ) : (
                          users.map((user) => (
                            <tr key={user.id} className="border-b border-white/5 hover:bg-white/[0.02] py-4">
                              <td className="p-4 sm:py-6">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 rounded-full bg-blue-500/20">
                                    <UserCircle className="w-5 h-5 text-blue-400" />
                                  </div>
                                  <div className="font-medium">{user.name || 'No name'}</div>
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <Mail className="w-4 h-4 text-white/40" />
                                  {user.email}
                                </div>
                              </td>
                              <td className="p-4">
                                <Badge className="bg-purple-500/20 text-purple-400">
                                  {user.subscriptionCount}
                                </Badge>
                              </td>
                              <td className="p-4">
                                <div className="text-sm text-white/60">
                                  {new Date(user.createdAt).toLocaleDateString()}
                                </div>
                              </td>
                              <td className="p-4 sm:py-6">
                                <div className="flex flex-col sm:flex-row gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleActivatePro(user.id, 'MONTHLY')}
                                    className="h-10 sm:h-10 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-xs sm:text-sm"
                                  >
                                    <Crown className="w-3 h-3 mr-1" />
                                    Monthly
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleActivatePro(user.id, 'LIFETIME')}
                                    className="h-10 sm:h-10 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-xs sm:text-sm"
                                  >
                                    <Crown className="w-3 h-3 mr-1" />
                                    Lifetime
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleCancelSubscription(user.id)}
                                    className="h-10 sm:h-10 hover:bg-red-500/20 hover:text-red-400 text-xs sm:text-sm"
                                    disabled={cancellingUserId === user.id}
                                  >
                                    {cancellingUserId === user.id ? (
                                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                    ) : (
                                      <XCircle className="w-3 h-3 mr-1" />
                                    )}
                                    {cancellingUserId === user.id ? 'Cancelling...' : 'Cancel'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDeleteUser(user.id, user.email)}
                                    className="h-10 sm:h-10 hover:bg-red-500/20 hover:text-red-400 text-xs sm:text-sm"
                                    disabled={user.subscriptionCount > 0}
                                  >
                                    <XCircle className="w-3 h-3" />
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
            </motion.div>
          </TabsContent>

          {/* Subscriptions Tab */}
          <TabsContent value="subscriptions" className="mt-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Slot Tracking Card */}
              {slotInfo && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="mb-6"
                >
                  <Card className="bg-white/[0.02] border-white/[0.05]">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-amber-400" />
                        Lifetime Ultra Slot Tracking
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-4">
                        <div className="text-sm text-white/60 mb-2">
                          {slotInfo.isSoldOut ? (
                            <span className="text-red-400 font-semibold">All 30 slots taken</span>
                          ) : (
                            <span className="text-amber-300 font-semibold">
                              {slotInfo.availableSlots} of {slotInfo.totalSlots} slots available
                            </span>
                          )}
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-4 mb-4">
                          <div
                            className={`h-full rounded-full transition-all ${
                              slotInfo.isSoldOut
                                ? 'bg-red-500'
                                : 'bg-gradient-to-r from-amber-500 to-orange-500'
                            }`}
                            style={{
                              width: `${(slotInfo.usedSlots / slotInfo.totalSlots) * 100}%`
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-white/40">
                          <span>{slotInfo.usedSlots} used</span>
                          <span>{slotInfo.totalSlots} total</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Subscription Management</h2>
                <Dialog open={newSubscriptionDialogOpen} onOpenChange={setNewSubscriptionDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      New Subscription
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-[#1a0f2e] border-white/10 text-white">
                    <DialogHeader>
                      <DialogTitle>Create New Subscription</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label htmlFor="userEmail">User Email *</Label>
                        <Input
                          id="userEmail"
                          type="email"
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          className="bg-white/5 border-white/10"
                        />
                      </div>
                      <div>
                        <Label htmlFor="userName">User Name</Label>
                        <Input
                          id="userName"
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          className="bg-white/5 border-white/10"
                        />
                      </div>
                      <div>
                        <Label htmlFor="plan">Plan *</Label>
                        <Select value={newPlanId} onValueChange={setNewPlanId}>
                          <SelectTrigger className="bg-white/5 border-white/10">
                            <SelectValue placeholder="Select a plan" />
                          </SelectTrigger>
                          <SelectContent>
                            {plans.map((plan) => (
                              <SelectItem key={plan.id} value={plan.id}>
                                {plan.name} - {plan.currency} {plan.price.toLocaleString()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleCreateSubscription} className="w-full">
                        Create Subscription
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <Card className="bg-white/[0.02] border-white/[0.05]">
                <CardHeader>
                  <CardTitle>Subscriptions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/5">
                          <th className="text-left p-4 text-white/40 font-medium text-sm">User</th>
                          <th className="text-left p-4 text-white/40 font-medium text-sm">Plan</th>
                          <th className="text-left p-4 text-white/40 font-medium text-sm">Status</th>
                          <th className="text-left p-4 text-white/40 font-medium text-sm">Payment</th>
                          <th className="text-left p-4 text-white/40 font-medium text-sm">Period</th>
                          <th className="text-left p-4 text-white/40 font-medium text-sm">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subscriptions.map((sub) => (
                          <tr key={sub.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                            <td className="p-4">
                              <div>
                                <div className="font-medium">{sub.userName || sub.userEmail}</div>
                                <div className="text-xs text-white/40">{sub.userEmail}</div>
                              </div>
                            </td>
                            <td className="p-4">
                              <div>
                                <div className="font-medium">{sub.plan.name}</div>
                                <div className="text-xs text-white/40">
                                  {sub.plan.currency} {sub.plan.price.toLocaleString()}
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                {sub.isActive ? (
                                  <Badge className="bg-emerald-500/20 text-emerald-400">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Active
                                  </Badge>
                                ) : (
                                  <Badge className="bg-red-500/20 text-red-400">
                                    <XCircle className="w-3 h-3 mr-1" />
                                    Inactive
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="p-4">
                              {getPaymentStatusBadge(sub.paymentStatus)}
                              {sub.amountPaid && (
                                <div className="text-xs text-white/40 mt-1">
                                  {sub.plan.currency} {sub.amountPaid.toLocaleString()}
                                </div>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="text-sm text-white/60">
                                {sub.endDate ? new Date(sub.endDate).toLocaleDateString() : 'Lifetime'}
                              </div>
                              <div className="text-xs text-white/40">
                                {new Date(sub.startDate).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openEditDialog(sub)}
                                  className="h-8"
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                {sub.isActive ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDeactivate(sub.id)}
                                    className="h-8 hover:bg-red-500/20 hover:text-red-400"
                                  >
                                    <XCircle className="w-3 h-3" />
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={() => handleActivate(sub.id)}
                                    className="h-8"
                                  >
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Activate
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Affiliate Tracking Tab */}
          <TabsContent value="affiliates" className="mt-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Affiliate Tracking</h2>
              </div>

              <Card className="bg-white/[0.02] border-white/[0.05]">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/5">
                          <th className="text-left p-4 text-white/40 font-medium text-sm">Affiliate</th>
                          <th className="text-left p-4 text-white/40 font-medium text-sm">Referral Code</th>
                          <th className="text-left p-4 text-white/40 font-medium text-sm">Total Referred</th>
                          <th className="text-left p-4 text-white/40 font-medium text-sm">Active PRO</th>
                          <th className="text-left p-4 text-white/40 font-medium text-sm">Total Commission</th>
                          <th className="text-left p-4 text-white/40 font-medium text-sm">Pending Commission</th>
                          <th className="text-left p-4 text-white/40 font-medium text-sm">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {affiliateStats.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-white/40">
                              No affiliate data found.
                            </td>
                          </tr>
                        ) : (
                          affiliateStats.map((affiliate) => (
                            <tr key={affiliate.affiliateId} className="border-b border-white/5 hover:bg-white/[0.02]">
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 rounded-full bg-emerald-500/20">
                                    <UserCircle className="w-5 h-5 text-emerald-400" />
                                  </div>
                                  <div>
                                    <div className="font-medium">{affiliate.name}</div>
                                    <div className="text-xs text-white/40">{affiliate.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4">
                                <Badge className="bg-cyan-500/20 text-cyan-400">
                                  {affiliate.myReferralCode}
                                </Badge>
                              </td>
                              <td className="p-4">
                                <Badge className="bg-blue-500/20 text-blue-400">
                                  {affiliate.totalReferred}
                                </Badge>
                              </td>
                              <td className="p-4">
                                <Badge className="bg-purple-500/20 text-purple-400">
                                  {affiliate.activePro}
                                </Badge>
                              </td>
                              <td className="p-4">
                                <div className="text-sm text-emerald-400 font-semibold">
                                  Rp {affiliate.totalCommission.toLocaleString('id-ID')}
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="text-sm text-yellow-400 font-semibold">
                                  Rp {affiliate.totalCommissionPending.toLocaleString('id-ID')}
                                </div>
                              </td>
                              <td className="p-4">
                                {affiliate.totalCommissionPending > 0 && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleMarkAsPaid(affiliate.affiliateId)}
                                    className="h-8 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600"
                                  >
                                    Mark as Paid
                                  </Button>
                                )}
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
          </TabsContent>
        </Tabs>

        {/* Edit Subscription Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="bg-[#1a0f2e] border-white/10 text-white">
            <DialogHeader>
              <DialogTitle>Edit Subscription</DialogTitle>
            </DialogHeader>
            {selectedSubscription && (
              <div className="space-y-4 py-4">
                <div className="bg-white/5 p-4 rounded-lg">
                  <div className="font-semibold mb-2">{selectedSubscription.plan.name}</div>
                  <div className="text-sm text-white/60">
                    {selectedSubscription.userName || selectedSubscription.userEmail}
                  </div>
                </div>

                <Tabs defaultValue="date">
                  <TabsList className="bg-white/5">
                    <TabsTrigger value="date">Set End Date</TabsTrigger>
                    <TabsTrigger value="duration">Set Duration</TabsTrigger>
                  </TabsList>
                  <TabsContent value="date" className="space-y-4 pt-4">
                    <div>
                      <Label htmlFor="endDate">End Date</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={editEndDate}
                        onChange={(e) => setEditEndDate(e.target.value)}
                        className="bg-white/5 border-white/10"
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="duration" className="space-y-4 pt-4">
                    <div>
                      <Label htmlFor="duration">Duration</Label>
                      <div className="flex gap-2">
                        <Input
                          id="duration"
                          type="number"
                          value={editDuration}
                          onChange={(e) => setEditDuration(e.target.value)}
                          className="bg-white/5 border-white/10"
                          placeholder="e.g. 6"
                        />
                        <Select value={editDurationType} onValueChange={(v) => setEditDurationType(v as 'months' | 'years')}>
                          <SelectTrigger className="bg-white/5 border-white/10 w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="months">Months</SelectItem>
                            <SelectItem value="years">Years</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                <div>
                  <Label htmlFor="adminNote">Admin Note</Label>
                  <Input
                    id="adminNote"
                    value={editAdminNote}
                    onChange={(e) => setEditAdminNote(e.target.value)}
                    className="bg-white/5 border-white/10"
                    placeholder="Add a note..."
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleUpdateSubscription} className="flex-1">
                    Save Changes
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditDialogOpen(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
