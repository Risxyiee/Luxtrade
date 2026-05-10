import { useState } from 'react'
import { Mail, Calendar, Crown, User as UserIcon, Loader2, Check, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { motion } from 'framer-motion'

interface UserFound {
  id: string
  email: string
  name: string | null
  plan: string | null
  proExpiry: string | null
}

export function ManualUpdateUser() {
  const [searchEmail, setSearchEmail] = useState('')
  const [userFound, setUserFound] = useState<UserFound | null>(null)
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [plan, setPlan] = useState<'FREE' | 'PRO'>('FREE')
  const [proExpiry, setProExpiry] = useState('')
  const [updating, setUpdating] = useState(false)

  // Search user by email
  const searchUser = async () => {
    if (!searchEmail.trim()) {
      toast.error('Masukkan email user')
      return
    }

    setSearching(true)
    setUserFound(null)

    try {
      const res = await fetch(`/api/admin/search-user?email=${encodeURIComponent(searchEmail.trim())}`)
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'User tidak ditemukan')
        setUserFound(null)
        return
      }

      // If user found, show it
      if (data.user) {
        setUserFound({
          id: data.user.id,
          email: data.user.email,
          name: data.user.name || data.user.profile?.full_name,
          plan: data.user.plan,
          proExpiry: data.user.proExpiry
        })

        // Set form values to current user data
        setPlan(data.user.plan || 'FREE')
        if (data.user.proExpiry) {
          const expiryDate = new Date(data.user.proExpiry)
          setProExpiry(expiryDate.toISOString().split('T')[0])
        }

        toast.success('User ditemukan!')
      }
    } catch (error) {
      console.error('Error searching user:', error)
      toast.error('Gagal mencari user')
    } finally {
      setSearching(false)
    }
  }

  // Update user plan
  const updateUser = async () => {
    if (!userFound) return

    if (!confirm(`Ubah plan user ${userFound.email} menjadi ${plan}?`)) {
      return
    }

    setUpdating(true)

    try {
      const res = await fetch(`/api/admin/manual-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userFound.email,
          plan,
          proExpiry: plan === 'PRO' ? proExpiry : null,
          adminNote: 'Manual update by admin'
        })
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Gagal mengupdate user')
        return
      }

      toast.success('User berhasil diupdate!')
      
      // Update userFound with new data
      setUserFound({
        ...userFound,
        plan,
        proExpiry: plan === 'PRO' ? proExpiry : null
      })

    } catch (error) {
      console.error('Error updating user:', error)
      toast.error('Gagal mengupdate user')
    } finally {
      setUpdating(false)
    }
  }

  // Calculate days remaining
  const getDaysRemaining = (expiry: string | null): number => {
    if (!expiry) return 0
    const now = new Date()
    const until = new Date(expiry)
    const diff = until.getTime() - now.getTime()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  const formatDate = (date: string | null): string => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  // Predefined expiry options
  const getExpiryDate = (days: number): string => {
    const date = new Date()
    date.setDate(date.getDate() + days)
    return date.toISOString().split('T')[0]
  }

  return (
    <Card className="bg-[#1a0f2e]/50 border-purple-500/20 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <UserIcon className="w-5 h-5 text-purple-400" />
          Manual Update User
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search User */}
        <div>
          <label className="text-xs text-white/60 mb-2 block">Cari User by Email</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <Input
                placeholder="user@email.com"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="bg-[#0d0820] border-purple-500/20 pl-9 text-white focus:border-purple-500/50"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') searchUser()
                }}
              />
            </div>
            <Button
              onClick={searchUser}
              disabled={searching || !searchEmail.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {searching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Cari
                </>
              )}
            </Button>
          </div>
        </div>

        {/* User Found - Show Update Form */}
        {userFound && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 border-t border-purple-500/20 pt-4"
          >
            {/* User Info */}
            <div className="bg-[#0d0820] rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-white/60" />
                  <div>
                    <p className="text-xs text-white/40">Email</p>
                    <p className="text-sm text-white font-medium">{userFound.email}</p>
                  </div>
                </div>
                <Badge className={
                  userFound.plan === 'PRO' 
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                    : 'bg-white/10 text-white/60 border-white/10'
                }>
                  {userFound.plan || 'FREE'}
                </Badge>
              </div>

              {userFound.proExpiry && userFound.plan === 'PRO' && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-white/60" />
                  <div>
                    <p className="text-xs text-white/40">Pro Expiry</p>
                    <p className="text-sm text-white font-medium">
                      {formatDate(userFound.proExpiry)}
                      <span className="ml-2 text-emerald-400">
                        ({getDaysRemaining(userFound.proExpiry)} hari tersisa)
                      </span>
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Update Form */}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/60 mb-2 block">Plan Baru</label>
                <Select value={plan} onValueChange={(value: 'FREE' | 'PRO') => setPlan(value)}>
                  <SelectTrigger className="bg-[#0d0820] border-purple-500/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FREE">FREE</SelectItem>
                    <SelectItem value="PRO">PRO</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {plan === 'PRO' && (
                <div>
                  <label className="text-xs text-white/60 mb-2 block">PRO Expiry Date</label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={proExpiry}
                      onChange={(e) => setProExpiry(e.target.value)}
                      className="bg-[#0d0820] border-purple-500/20 text-white focus:border-purple-500/50"
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
              )}

              {/* Quick Expiry Options */}
              {plan === 'PRO' && (
                <div>
                  <label className="text-xs text-white/60 mb-2 block">Pilih Tanggal Cepat:</label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setProExpiry(getExpiryDate(30))}
                      className="border-purple-500/30 text-white/60 hover:bg-purple-500/10 text-xs"
                    >
                      30 Hari
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setProExpiry(getExpiryDate(90))}
                      className="border-purple-500/30 text-white/60 hover:bg-purple-500/10 text-xs"
                    >
                      90 Hari
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setProExpiry(getExpiryDate(180))}
                      className="border-purple-500/30 text-white/60 hover:bg-purple-500/10 text-xs"
                    >
                      180 Hari
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setProExpiry(getExpiryDate(365))}
                      className="border-purple-500/30 text-white/60 hover:bg-purple-500/10 text-xs"
                    >
                      1 Tahun
                    </Button>
                  </div>
                </div>
              )}

              {/* Update Button */}
              <Button
                onClick={updateUser}
                disabled={updating}
                className="w-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white"
              >
                {updating ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Update User
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}

        {/* No User Found */}
        {!userFound && !searching && searchEmail.trim() && (
          <div className="text-center py-4 text-white/40">
            <UserIcon className="w-8 h-8 text-white/20 mx-auto mb-2" />
            <p className="text-sm">Ketik email user dan klik "Cari"</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
