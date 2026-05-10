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
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { sendTelegramNotification } from '@/lib/telegram'

// Commission rate: 30% of Rp 49,000 = Rp 14,700
const COMMISSION_PER_PRO = 14700

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

export default function AdminSubscriptionsPanel() {
  const [activeTab, setActiveTab] = useState('users')

  // User state
  const [users, setUsers] = useState<User[]>([])

  // Subscription state
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [slotInfo, setSlotInfo] = useState<SlotInfo | null>(null)

  // Common state
  const [loading, setLoading] = useState(true)
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [newSubscriptionDialogOpen, setNewSubscriptionDialogOpen] = useState(false)
  const [newUserDialogOpen, setNewUserDialogOpen] = useState(false)
  const [isRealTimeConnected, setIsRealTimeConnected] = useState(false)

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
    } catch (error) {
      console.error('❌ Error fetching data in admin panel:', error)
      console.error('Full error details:', JSON.stringify(error, null, 2))
      alert('Failed to fetch data. Check console for details.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Real-time updates with polling
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData().catch(err => console.error('Polling error:', err))
      setIsRealTimeConnected(true)
    }, 10000)

    return () => clearInterval(interval)
  }, [fetchData])

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
      console.log('🚀 Activating Pro for user:', userId, 'with planType:', planType)

      // Find user
      const user = await db.user.findUnique({
        where: { id: userId }
      })

      if (!user) {
        alert('User tidak ditemukan!')
        return
      }

      // Get or create plan based on planType
      let planName = ''
      let durationMonths = null
      let isLifetime = false
      let price = 0

      switch (planType) {
        case 'MONTHLY':
          planName = 'Elite Pro'
          durationMonths = 1
          price = 49000
          break
        case 'LIFETIME':
          planName = 'Lifetime Ultra'
          isLifetime = true
          price = 100000
          break
      }

      // Find or create plan
      const existingPlan = await db.subscriptionPlan.findFirst({
        where: {
          name: planName,
          isLifetime,
          durationMonths: isLifetime ? null : durationMonths
        }
      })

      let finalPlanId: string
      if (existingPlan) {
        finalPlanId = existingPlan.id
        console.log(`✅ Found existing plan: ${planName}`)
      } else {
        const newPlan = await db.subscriptionPlan.create({
          data: {
            name: planName,
            durationMonths,
            isLifetime,
            price,
            currency: 'IDR',
            isActive: true,
            maxSlots: isLifetime ? 30 : null
          }
        })
        finalPlanId = newPlan.id
        console.log(`✅ Created new plan: ${planName}`)
      }

      // Calculate end date
      let endDate = null
      if (planType !== 'LIFETIME') {
        const startDate = new Date()
        if (planType === 'MONTHLY') {
          endDate = new Date(startDate.setMonth(startDate.getMonth() + 1))
        }
      }

      // Create subscription
      const subscription = await db.userSubscription.create({
        data: {
          userId,
          userEmail: user.email,
          userName: user.name,
          planId: finalPlanId,
          startDate: new Date(),
          endDate,
          isActive: true,
          paymentStatus: 'completed',
          amountPaid: planType === 'MONTHLY' ? 49000 : 100000,
          paymentMethod: 'manual',
          adminNote: `Activated by admin via Quick Activate (${planType})`
        }
      })

      console.log(`✅ Subscription created successfully: ${subscription.id}`)

      // ============================================
      // UPDATE SUPABASE PROFILES TABLE
      // ============================================
      const subscriptionDuration = planType === 'MONTHLY' ? 1 : null
      const isLifetimePlan = planType === 'LIFETIME'

      // Calculate subscription end date
      let subscriptionUntil: string | null = null
      if (isLifetimePlan) {
        // Lifetime - set far future date (10 years)
        subscriptionUntil = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString()
      } else if (subscriptionDuration && subscriptionDuration > 0) {
        // Monthly plan - calculate end date
        const endDateObj = new Date()
        endDateObj.setMonth(endDateObj.getMonth() + subscriptionDuration)
        subscriptionUntil = endDateObj.toISOString()
      }

      // Update Supabase profiles table
      console.log(`🔄 Updating Supabase profile for email: ${user.email}`)

      const { data: currentProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', user.email)
        .single()

      if (fetchError) {
        console.error('❌ Error fetching profile:', fetchError)
      } else {
        console.log('✅ Current profile found:', currentProfile?.email, 'is_pro:', currentProfile?.is_pro)
      }

      const { error: profileUpdateError, data: updatedData } = await supabase
        .from('profiles')
        .update({
          subscription_status: 'PRO',
          is_pro: true,
          subscription_until: subscriptionUntil,
          pro_status: 'active',
          pro_expiry_date: subscriptionUntil,
          has_ever_been_pro: true,
          updated_at: new Date().toISOString()
        })
        .eq('email', user.email)
        .select()

      if (profileUpdateError) {
        console.error('❌ Failed to update Supabase profile:', profileUpdateError)
        console.error('Error code:', profileUpdateError.code)
        console.error('Error message:', profileUpdateError.message)
        console.error('Error details:', profileUpdateError.details)
        // Non-blocking error - continue execution
      } else {
        console.log('✅ Supabase profile updated to PRO for:', user.email)
        console.log('✅ Updated data:', updatedData)
      }

      // If LIFETIME, update slot tracking
      if (planType === 'LIFETIME') {
        console.log('🔄 Updating slot tracking for LIFETIME plan...')

        const slotTracking = await db.slotTracking.findUnique({
          where: { planId: finalPlanId }
        })

        if (slotTracking) {
          const newUsedSlots = slotTracking.usedSlots + 1
          await db.slotTracking.update({
            where: { planId: finalPlanId },
            data: {
              usedSlots: newUsedSlots
            }
          })
          console.log(`✅ Slot tracking updated: ${newUsedSlots}/${slotTracking.totalSlots}`)
        } else {
          // Create slot tracking if not exists
          await db.slotTracking.create({
            data: {
              planId: finalPlanId,
              totalSlots: 30,
              usedSlots: 1
            }
          })
          console.log('✅ Slot tracking created')
        }
      }

      // ============================================
      // COMMISSION: Update referrer's balance
      // ============================================
      try {
        // Get user's profile to find referrer
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('referred_by_code, my_referral_code, full_name, email')
          .eq('email', user.email)
          .single()

        if (userProfile?.referred_by_code) {
          // Find referrer in Prisma
          const referrer = await db.affiliateProfile.findUnique({
            where: { myReferralCode: userProfile.referred_by_code }
          })

          if (referrer) {
            // Update referrer's balance and commission
            await db.affiliateProfile.update({
              where: { userId: referrer.userId },
              data: {
                affiliateBalance: { increment: COMMISSION_PER_PRO },
                totalCommission: { increment: COMMISSION_PER_PRO },
                totalReferrals: { increment: 1 }
              }
            })

            console.log('✅ Commission added to referrer:', referrer.email, 'Amount: Rp', COMMISSION_PER_PRO)

            // Update referrer's Supabase profile
            console.log(`🔄 Updating referrer profile: ${referrer.email}`)

            // Get current referrer profile first
            const { data: referrerProfileData } = await supabase
              .from('profiles')
              .select('affiliate_balance, referral_count')
              .eq('email', referrer.email)
              .single()

            if (referrerProfileData) {
              const newBalance = (referrerProfileData.affiliate_balance || 0) + COMMISSION_PER_PRO
              const newRefCount = (referrerProfileData.referral_count || 0) + 1

              const { error: referrerUpdateError } = await supabase
                .from('profiles')
                .update({
                  affiliate_balance: newBalance,
                  referral_count: newRefCount,
                  updated_at: new Date().toISOString()
                })
                .eq('email', referrer.email)

              if (referrerUpdateError) {
                console.error('❌ Error updating referrer profile:', referrerUpdateError)
              } else {
                console.log('✅ Referrer profile updated. New balance:', newBalance)
              }
            } else {
              console.error('⚠️ Referrer profile not found in Supabase')
            }

            // Update referral_tracking status to 'paid'
            const { data: trackingRecord } = await supabase
              .from('referral_tracking')
              .select('id')
              .eq('referee_id', userId || user.email)
              .eq('referral_code_used', userProfile.referred_by_code)
              .single()

            if (trackingRecord) {
              await supabase
                .from('referral_tracking')
                .update({
                  status: 'paid',
                  commission_amount: COMMISSION_PER_PRO,
                  updated_at: new Date().toISOString()
                })
                .eq('id', trackingRecord.id)
            }

            // Send Telegram notification to referrer
            try {
              const planName2 = planType === 'LIFETIME' ? 'Lifetime Ultra' : 'Elite Pro'
              const msg = `💰 <b>KOMISI DITERIMA!</b>\n\n🎯 Referal: ${userProfile.full_name || userProfile.email}\n💎 Upgrade ke: ${planName2}\n💰 Komisi: Rp${COMMISSION_PER_PRO.toLocaleString('id-ID')}\n\nSaldo total: Rp${(referrer.affiliateBalance + COMMISSION_PER_PRO).toLocaleString('id-ID')}`
              await sendTelegramNotification(msg)
            } catch (e) {
              console.error('Failed to send Telegram notification:', e)
            }
          }
        }
      } catch (commissionError) {
        console.error('❌ Commission update error (non-blocking):', commissionError)
        // Don't fail activation if commission fails
      }

      fetchData()
      alert(`✅ User Berhasil Diaktifkan ${planType === 'MONTHLY' ? 'Monthly' : 'Lifetime'}!\n\nEmail: ${user.email}`)
    } catch (error) {
      console.error('❌ Error activating Pro:', error)
      alert('Failed to activate Pro subscription. Check console for details.')
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
                    <div className="text-2xl font-bold">{subscriptions.length}</div>
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
                      {subscriptions.reduce((sum, s) => sum + (s.amountPaid || 0), 0)}
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
