'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { 
  User, Mail, Lock, Eye, EyeOff, Loader2, CheckCircle, 
  AlertCircle, ArrowLeft, Save, Trash2, Download, FileText
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { toast } from 'sonner'

export default function SettingsPage() {
  const { user, profile, signOut } = useAuth()
  const router = useRouter()
  
  // Profile form
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  
  // Password form
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  
  // Delete account
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '')
    }
    if (user) {
      setEmail(user.email || '')
    }
  }, [profile, user])

  // Password strength check
  const hasMinLength = newPassword.length >= 8
  const hasUppercase = /[A-Z]/.test(newPassword)
  const hasLowercase = /[a-z]/.test(newPassword)
  const hasNumber = /[0-9]/.test(newPassword)
  const passwordsMatch = newPassword === confirmPassword && newPassword !== ''

  // Update profile
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      // Update display name in Supabase auth
      const { error: updateError } = await supabase.auth.updateUser({
        data: { full_name: fullName }
      })
      
      if (updateError) {
        toast.error(updateError.message)
      } else {
        toast.success('Profil berhasil diperbarui!')
      }
    } catch (error) {
      toast.error('Gagal memperbarui profil')
    } finally {
      setLoading(false)
    }
  }

  // Change password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!hasMinLength || !hasUppercase || !hasLowercase || !hasNumber) {
      toast.error('Password tidak memenuhi syarat')
      return
    }
    
    if (newPassword !== confirmPassword) {
      toast.error('Password baru tidak cocok')
      return
    }
    
    setPasswordLoading(true)
    
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })
      
      if (updateError) {
        toast.error(updateError.message)
      } else {
        toast.success('Password berhasil diubah!')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch (error) {
      toast.error('Gagal mengubah password')
    } finally {
      setPasswordLoading(false)
    }
  }

  // Export data
  const handleExportData = async () => {
    try {
      // Fetch all user data
      const [tradesRes, journalRes, watchlistRes] = await Promise.all([
        fetch('/api/trades'),
        fetch('/api/journal'),
        fetch('/api/watchlist'),
      ])
      
      const trades = tradesRes.ok ? (await tradesRes.json()).trades : []
      const journals = journalRes.ok ? (await journalRes.json()).entries : []
      const watchlist = watchlistRes.ok ? (await watchlistRes.json()).items : []
      
      const exportData = {
        exportedAt: new Date().toISOString(),
        user: { email: user?.email, fullName },
        trades,
        journals,
        watchlist
      }
      
      // Create download
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `luxtrade-data-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      
      toast.success('Data berhasil diekspor!')
    } catch (error) {
      toast.error('Gagal mengekspor data')
    }
  }

  // Delete account
  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') {
      toast.error('Ketik DELETE untuk konfirmasi')
      return
    }
    
    setDeleteLoading(true)
    
    try {
      // In production, this would call a server-side function
      // For now, just sign out
      await signOut()
      router.push('/')
      toast.success('Akun berhasil dihapus')
    } catch (error) {
      toast.error('Gagal menghapus akun')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0612] text-white">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0612] via-[#110a1f] to-[#0a0612]" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header className="border-b border-white/5 bg-[#0a0612]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="inline-flex items-center gap-3">
              <Image 
                src="/logo-premium.png" 
                alt="LuxTrade Logo" 
                width={36} 
                height={36}
                className="rounded-lg"
              />
              <span className="text-lg font-bold bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">
                LuxTrade
              </span>
            </Link>
          </div>
          <Link href="/dashboard">
            <Button variant="ghost" className="text-white/60 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Kembali ke Dashboard
            </Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          <div>
            <h1 className="text-3xl font-bold">Pengaturan</h1>
            <p className="text-white/40 mt-2">Kelola profil dan keamanan akun Anda</p>
          </div>

          {/* Profile Section */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-amber-400" />
              Profil
            </h2>
            
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white/70">Nama Lengkap</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10 h-12 bg-white/[0.03] border-white/10 text-white"
                      placeholder="Nama Anda"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <Input
                      value={email}
                      disabled
                      className="pl-10 h-12 bg-white/[0.03] border-white/10 text-white/50"
                    />
                  </div>
                  <p className="text-xs text-white/30">Email tidak dapat diubah</p>
                </div>
              </div>
              
              <Button
                type="submit"
                disabled={loading}
                className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Simpan Perubahan
              </Button>
            </form>
          </div>

          {/* Password Section */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-400" />
              Ubah Password
            </h2>
            
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-white/70">Password Baru</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10 pr-10 h-12 bg-white/[0.03] border-white/10 text-white"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                
                {/* Password Strength */}
                {newPassword && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className={`flex items-center gap-1.5 text-xs ${hasMinLength ? 'text-emerald-400' : 'text-white/30'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${hasMinLength ? 'bg-emerald-400' : 'bg-white/20'}`} />
                      Min. 8 karakter
                    </div>
                    <div className={`flex items-center gap-1.5 text-xs ${hasUppercase ? 'text-emerald-400' : 'text-white/30'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${hasUppercase ? 'bg-emerald-400' : 'bg-white/20'}`} />
                      Huruf besar
                    </div>
                    <div className={`flex items-center gap-1.5 text-xs ${hasLowercase ? 'text-emerald-400' : 'text-white/30'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${hasLowercase ? 'bg-emerald-400' : 'bg-white/20'}`} />
                      Huruf kecil
                    </div>
                    <div className={`flex items-center gap-1.5 text-xs ${hasNumber ? 'text-emerald-400' : 'text-white/30'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${hasNumber ? 'bg-emerald-400' : 'bg-white/20'}`} />
                      Angka
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <Label className="text-white/70">Konfirmasi Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 h-12 bg-white/[0.03] border-white/10 text-white"
                    placeholder="••••••••"
                  />
                </div>
                {confirmPassword && (
                  <p className={`text-xs ${passwordsMatch ? 'text-emerald-400' : 'text-red-400'}`}>
                    {passwordsMatch ? '✓ Password cocok' : '✗ Password tidak cocok'}
                  </p>
                )}
              </div>
              
              <Button
                type="submit"
                disabled={passwordLoading}
                className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
              >
                {passwordLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4 mr-2" />
                )}
                Ubah Password
              </Button>
            </form>
          </div>

          {/* Export Data */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Download className="w-5 h-5 text-amber-400" />
              Export Data
            </h2>
            
            <p className="text-white/60 mb-4">
              Download semua data trading, journal, dan watchlist Anda dalam format JSON.
            </p>
            
            <Button
              onClick={handleExportData}
              variant="outline"
              className="border-white/10 text-white hover:bg-white/5"
            >
              <FileText className="w-4 h-4 mr-2" />
              Export Semua Data
            </Button>
          </div>

          {/* Danger Zone */}
          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
            <h2 className="text-xl font-semibold mb-2 text-red-400">Zona Berbahaya</h2>
            <p className="text-white/60 mb-6">
              Hapus akun Anda secara permanen. Tindakan ini tidak dapat dibatalkan.
            </p>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-white/70">Ketik &quot;DELETE&quot; untuk konfirmasi</Label>
                <Input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  className="h-12 bg-white/[0.03] border-red-500/20 text-white"
                  placeholder="DELETE"
                />
              </div>
              
              <Button
                onClick={handleDeleteAccount}
                disabled={deleteLoading || deleteConfirm !== 'DELETE'}
                variant="destructive"
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Hapus Akun
              </Button>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
