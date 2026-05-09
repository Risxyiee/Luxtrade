'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  Shield, Users, Crown, CheckCircle, XCircle, 
  Loader2, ArrowLeft, Mail, Calendar, Clock,
  RefreshCw, UserCheck, UserX, Search, AlertTriangle,
  TrendingUp, DollarSign, Activity, LogOut
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

// Admin email whitelist
const ADMIN_EMAILS = ['luxtradee@gmail.com']

interface UserProfile {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  email_confirmed: boolean
  is_pro: boolean
  subscription_status: string
  subscription_end: string | null
  full_name: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentUser, setCurrentUser] = useState<{ email: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Stats
  const stats = {
    totalUsers: users.length,
    proUsers: users.filter(u => u.is_pro).length,
    freeUsers: users.filter(u => !u.is_pro).length,
    confirmedUsers: users.filter(u => u.email_confirmed).length,
  }

  // Check auth and admin status
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session?.user) {
          router.push('/auth/login')
          return
        }
        
        if (!ADMIN_EMAILS.includes(session.user.email || '')) {
          toast.error('Access denied. Admin only.')
          router.push('/dashboard')
          return
        }
        
        setCurrentUser({ email: session.user.email! })
        setIsAdmin(true)
        fetchUsers(session.access_token)
      } catch (error) {
        console.error('Auth check error:', error)
        router.push('/auth/login')
      }
    }
    
    checkAuth()
  }, [router])

  // Fetch users
  const fetchUsers = async (token?: string) => {
    if (!token) {
      const { data: { session } } = await supabase.auth.getSession()
      token = session?.access_token
    }
    
    if (!token) return
    
    setRefreshing(true)
    try {
      const res = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch users')
      }
      
      const data = await res.json()
      setUsers(data.users || [])
    } catch (error) {
      console.error('Fetch users error:', error)
      toast.error('Failed to fetch users')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Toggle PRO status
  const toggleProStatus = async (user: UserProfile, makePro: boolean) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    
    setUpdatingUserId(user.id)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.id,
          isPro: makePro,
          subscriptionStatus: makePro ? 'PRO' : 'FREE'
        })
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update user')
      }
      
      // Update local state
      setUsers(prev => prev.map(u => 
        u.id === user.id 
          ? { ...u, is_pro: makePro, subscription_status: makePro ? 'PRO' : 'FREE' }
          : u
      ))
      
      toast.success(`${user.email} successfully ${makePro ? 'upgraded to' : 'revoked from'} PRO!`)
    } catch (error) {
      console.error('Update user error:', error)
      toast.error('Failed to update user status')
    } finally {
      setUpdatingUserId(null)
    }
  }

  // Handle sign out
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  // Filter users by search
  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateStr))
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a0a2e] via-[#16082a] to-[#0d0618] flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="w-12 h-12 text-violet-500 mx-auto mb-4" />
          </motion.div>
          <p className="text-white/60">Verifying admin access...</p>
        </div>
      </div>
    )
  }

  // Not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a0a2e] via-[#16082a] to-[#0d0618] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-white/60 mb-6">You don&apos;t have permission to access this page.</p>
          <Link href="/dashboard">
            <Button className="bg-violet-600 hover:bg-violet-700">
              Go to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a0a2e] via-[#16082a] to-[#0d0618]">
      {/* Background Effects */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0a2e] via-[#16082a] to-[#0d0618]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(139,92,246,0.2)_0%,_transparent_50%)]" />
        <div className="absolute top-[20%] left-[20%] w-[400px] h-[400px] rounded-full bg-gradient-to-r from-violet-600/20 to-purple-600/20 blur-[100px]" />
        <div className="absolute bottom-[20%] right-[20%] w-[300px] h-[300px] rounded-full bg-gradient-to-r from-purple-600/15 to-fuchsia-600/15 blur-[80px]" />
      </div>

      {/* Header */}
      <header className="border-b border-violet-500/20 bg-[#1a0a2e]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-3">
                <Image 
                  src="/logo-premium.png" 
                  alt="LuxTrade Logo" 
                  width={40} 
                  height={40}
                  className="rounded-xl"
                />
                <div className="flex flex-col">
                  <span className="text-lg font-bold bg-gradient-to-r from-violet-200 to-purple-300 bg-clip-text text-transparent">
                    LuxTrade
                  </span>
                  <span className="text-[10px] text-violet-400 tracking-widest">ADMIN</span>
                </div>
              </Link>
              <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 ml-2">
                <Shield className="w-3 h-3 mr-1" />
                Admin Panel
              </Badge>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-sm text-white/60 hidden sm:inline">
                {currentUser?.email}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchUsers()}
                disabled={refreshing}
                className="text-white/60 hover:text-white hover:bg-white/10"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-white/60 hover:text-white hover:bg-white/10"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link href="/dashboard" className="text-white/60 hover:text-white text-sm flex items-center gap-2 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Shield className="w-8 h-8 text-violet-400" />
            Admin Dashboard
          </h1>
          <p className="text-white/40 mt-2">Manage users and subscription status</p>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <Card className="bg-white/[0.03] border-violet-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
                  <p className="text-xs text-white/40">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/[0.03] border-violet-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.proUsers}</p>
                  <p className="text-xs text-white/40">PRO Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/[0.03] border-violet-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.freeUsers}</p>
                  <p className="text-xs text-white/40">Free Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/[0.03] border-violet-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.confirmedUsers}</p>
                  <p className="text-xs text-white/40">Verified</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
            <Input
              placeholder="Search by email or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 bg-white/[0.03] border-violet-500/20 text-white placeholder:text-white/30 focus:border-violet-500/50"
            />
          </div>
        </motion.div>

        {/* Users Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-white/[0.02] border-violet-500/20 overflow-hidden">
            <CardHeader className="border-b border-violet-500/10">
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-violet-400" />
                User Management
                <Badge className="ml-2 bg-violet-500/20 text-violet-300">
                  {filteredUsers.length} users
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-violet-500/10 bg-white/[0.02]">
                      <th className="text-left p-4 text-white/40 font-medium text-sm">User</th>
                      <th className="text-left p-4 text-white/40 font-medium text-sm">Join Date</th>
                      <th className="text-left p-4 text-white/40 font-medium text-sm">Last Login</th>
                      <th className="text-left p-4 text-white/40 font-medium text-sm">Status</th>
                      <th className="text-left p-4 text-white/40 font-medium text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-violet-500/10">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-white/40">
                          {searchQuery ? 'No users found' : 'No users yet'}
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                                {user.email?.charAt(0).toUpperCase() || 'U'}
                              </div>
                              <div>
                                <p className="text-white font-medium flex items-center gap-2">
                                  {user.email}
                                  {user.email_confirmed ? (
                                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-red-400" />
                                  )}
                                </p>
                                <p className="text-white/40 text-sm">{user.full_name || 'No name'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2 text-white/60 text-sm">
                              <Calendar className="w-4 h-4" />
                              {formatDate(user.created_at)}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2 text-white/60 text-sm">
                              <Clock className="w-4 h-4" />
                              {formatDate(user.last_sign_in_at)}
                            </div>
                          </td>
                          <td className="p-4">
                            {user.is_pro ? (
                              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                                <Crown className="w-3 h-3 mr-1" />
                                PRO
                              </Badge>
                            ) : (
                              <Badge className="bg-white/10 text-white/60 border-white/10">
                                FREE
                              </Badge>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              {user.is_pro ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => toggleProStatus(user, false)}
                                  disabled={updatingUserId === user.id}
                                  className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                                >
                                  {updatingUserId === user.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      <UserX className="w-4 h-4 mr-1" />
                                      Revoke PRO
                                    </>
                                  )}
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => toggleProStatus(user, true)}
                                  disabled={updatingUserId === user.id}
                                  className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-500/25"
                                >
                                  {updatingUserId === user.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      <UserCheck className="w-4 h-4 mr-1" />
                                      Activate PRO
                                    </>
                                  )}
                                </Button>
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

        {/* Footer */}
        <div className="mt-8 text-center text-white/30 text-sm">
          <p>© 2026 LuxTrade Admin Panel - Secret Route</p>
        </div>
      </main>
    </div>
  )
}
