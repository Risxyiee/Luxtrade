'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  User, Mail, Lock, Eye, EyeOff, Loader2, CheckCircle,
  AlertCircle, ArrowLeft, Save, Trash2, Download, FileText, MailIcon,
  Shield, ChevronRight, Settings as SettingsIcon, Clock, LogOut
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

  // Email backup
  const [emailBackupLoading, setEmailBackupLoading] = useState(false)

  // Delete account
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteEmailConfirm, setDeleteEmailConfirm] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (profile) setFullName(profile.full_name || '')
    if (user) setEmail(user.email || '')
  }, [profile, user])

  const handleEmailBackup = async () => {
    setEmailBackupLoading(true)
    try {
      const res = await fetch('/api/email-backup', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.success) toast.success('Backup berhasil dikirim ke email Anda!')
      else toast.error(data.error || 'Gagal mengirim backup email')
    } catch {
      toast.error('Gagal mengirim backup email')
    } finally { setEmailBackupLoading(false) }
  }

  const hasMinLength = newPassword.length >= 8
  const hasUppercase = /[A-Z]/.test(newPassword)
  const hasLowercase = /[a-z]/.test(newPassword)
  const hasNumber = /[0-9]/.test(newPassword)
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"|<>,.?\/`~]/.test(newPassword)
  const passwordsMatch = newPassword === confirmPassword && newPassword !== ''

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ data: { full_name: fullName } })
      if (updateError) toast.error(updateError.message)
      else toast.success('Profil berhasil diperbarui!')
    } catch { toast.error('Gagal memperbarui profil') }
    finally { setLoading(false) }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword) { toast.error('Masukkan password saat ini'); return }
    if (!hasMinLength || !hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) { toast.error('Password tidak memenuhi syarat (perlu simbol seperti !@#)'); return }
    if (newPassword !== confirmPassword) { toast.error('Password baru tidak cocok'); return }
    setPasswordLoading(true)
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user?.email || '', password: currentPassword })
      if (verifyError) { toast.error('Password saat ini salah'); setPasswordLoading(false); return }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) toast.error(updateError.message)
      else { toast.success('Password berhasil diubah!'); setCurrentPassword(''); setNewPassword(''); setConfirmPassword('') }
    } catch { toast.error('Gagal mengubah password') }
    finally { setPasswordLoading(false) }
  }

  const handleExportData = async () => {
    try {
      const [tradesRes, journalRes, watchlistRes] = await Promise.all([fetch('/api/trades'), fetch('/api/journal'), fetch('/api/watchlist')])
      const trades = tradesRes.ok ? (await tradesRes.json()).trades : []
      const journals = journalRes.ok ? (await journalRes.json()).entries : []
      const watchlist = watchlistRes.ok ? (await watchlistRes.json()).items : []
      const exportData = { exportedAt: new Date().toISOString(), user: { email: user?.email, fullName }, trades, journals, watchlist }
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `luxtrade-data-${new Date().toISOString().split('T')[0]}.json`; a.click()
      URL.revokeObjectURL(url)
      toast.success('Data berhasil diekspor!')
    } catch { toast.error('Gagal mengekspor data') }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') { toast.error('Ketik DELETE untuk konfirmasi'); return }
    if (!deleteEmailConfirm || deleteEmailConfirm !== user?.email) { toast.error('Email tidak cocok. Masukkan email Anda dengan benar.'); return }
    setDeleteLoading(true)
    try {
      const res = await fetch('/api/delete-account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation: deleteConfirm, email: deleteEmailConfirm }) })
      const data = await res.json()
      if (res.ok && data.success) { toast.success('Akun berhasil dihapus'); await signOut(); router.push('/') }
      else toast.error(data.error || 'Gagal menghapus akun')
    } catch { toast.error('Gagal menghapus akun. Silakan coba lagi.') }
    finally { setDeleteLoading(false) }
  }

  // Settings sections
  const sections = [
    { id: 'profile', icon: User, label: 'Profil', desc: 'Nama dan informasi profil' },
    { id: 'password', icon: Lock, label: 'Ubah Password', desc: 'Keamanan akun' },
    { id: 'export', icon: Download, label: 'Export Data', desc: 'Download data trading' },
    { id: 'backup', icon: MailIcon, label: 'Data Backup', desc: 'Kirim backup ke email' },
  ]

  const [activeSection, setActiveSection] = useState('profile')

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-lux-bg-sidebar, #050507)' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b" style={{ background: 'var(--color-lux-bg-sidebar, #050507)', borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-sm hover:text-white/80 transition-colors" style={{ color: 'var(--sidebar-foreground, #F0F2F5)' }}>
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
            <div className="w-px h-5 bg-white/10" />
            <div className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5" style={{ color: 'var(--sidebar-primary, #3b82f6)' }} />
              <h1 className="text-lg font-semibold" style={{ color: 'var(--sidebar-foreground, #F0F2F5)' }}>Pengaturan</h1>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Navigation - Desktop */}
          <nav className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-24 space-y-1">
              {sections.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setActiveSection(s.id); setShowDeleteConfirm(false) }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 text-left group ${
                    activeSection === s.id && !showDeleteConfirm
                      ? 'bg-white/5 text-white'
                      : 'text-white/40 hover:text-white/60 hover:bg-white/[0.02]'
                  }`}
                >
                  <s.icon className={`w-4 h-4 transition-colors ${activeSection === s.id && !showDeleteConfirm ? 'text-blue-400' : 'text-white/30 group-hover:text-white/50'}`} />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{s.label}</div>
                    <div className="text-[10px] text-white/20 truncate">{s.desc}</div>
                  </div>
                </button>
              ))}
              <button
                onClick={() => { setActiveSection('danger'); setShowDeleteConfirm(true) }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 text-left ${
                  showDeleteConfirm
                    ? 'bg-red-500/10 text-red-400'
                    : 'text-red-400/50 hover:text-red-400 hover:bg-red-500/5'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                <div className="min-w-0">
                  <div className="font-medium truncate">Hapus Akun</div>
                  <div className="text-[10px] opacity-50 truncate">Zona berbahaya</div>
                </div>
              </button>
            </div>
          </nav>

          {/* Mobile Section Selector */}
          <div className="lg:hidden">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              {sections.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setActiveSection(s.id); setShowDeleteConfirm(false) }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs whitespace-nowrap transition-all shrink-0 ${
                    activeSection === s.id && !showDeleteConfirm
                      ? 'bg-white/5 text-white border border-white/10'
                      : 'text-white/40 hover:text-white/60 border border-transparent'
                  }`}
                >
                  <s.icon className="w-3.5 h-3.5" />
                  {s.label}
                </button>
              ))}
              <button
                onClick={() => { setActiveSection('danger'); setShowDeleteConfirm(true) }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs whitespace-nowrap transition-all shrink-0 ${
                  showDeleteConfirm ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'text-red-400/50 border border-transparent'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus Akun
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={showDeleteConfirm ? 'danger' : activeSection}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {/* Profile Section */}
                {activeSection === 'profile' && !showDeleteConfirm && (
                  <div className="space-y-6">
                    <div className="rounded-2xl p-6" style={{ background: 'var(--lux-card-surface, rgba(255,255,255,0.03))', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.1)' }}>
                          <User className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <h2 className="text-base font-semibold" style={{ color: 'var(--lux-text-on-surface, rgba(240,242,245,0.9))' }}>Profil</h2>
                          <p className="text-[11px] text-white/30">Kelola nama tampilan Anda</p>
                        </div>
                      </div>

                      <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[11px] text-white/50 uppercase tracking-wider font-[JetBrains_Mono,monospace]">Nama Lengkap</Label>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                              <Input
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="pl-10 h-11 text-sm"
                                style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)', color: 'var(--lux-text-on-surface, #F0F2F5)' }}
                                placeholder="Nama Anda"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[11px] text-white/50 uppercase tracking-wider font-[JetBrains_Mono,monospace]">Email</Label>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                              <Input
                                value={email}
                                disabled
                                className="pl-10 h-11 text-sm opacity-50"
                                style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)', color: 'var(--lux-text-on-surface, #F0F2F5)' }}
                              />
                            </div>
                            <p className="text-[10px] text-white/20 font-[JetBrains_Mono,monospace]">Email tidak dapat diubah</p>
                          </div>
                        </div>

                        <div className="flex justify-end pt-2">
                          <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                            style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}
                          >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Simpan Perubahan
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* Password Section */}
                {activeSection === 'password' && !showDeleteConfirm && (
                  <div className="space-y-6">
                    <div className="rounded-2xl p-6" style={{ background: 'var(--lux-card-surface, rgba(255,255,255,0.03))', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.1)' }}>
                          <Lock className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <h2 className="text-base font-semibold" style={{ color: 'var(--lux-text-on-surface, rgba(240,242,245,0.9))' }}>Ubah Password</h2>
                          <p className="text-[11px] text-white/30">Pastikan password Anda kuat dan aman</p>
                        </div>
                      </div>

                      <form onSubmit={handleChangePassword} className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-[11px] text-white/50 uppercase tracking-wider font-[JetBrains_Mono,monospace]">Password Saat Ini</Label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                            <Input
                              type={showPassword ? 'text' : 'password'}
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              className="pl-10 h-11 text-sm"
                              style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)', color: 'var(--lux-text-on-surface, #F0F2F5)' }}
                              placeholder="••••••••"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[11px] text-white/50 uppercase tracking-wider font-[JetBrains_Mono,monospace]">Password Baru</Label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                            <Input
                              type={showPassword ? 'text' : 'password'}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="pl-10 pr-10 h-11 text-sm"
                              style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)', color: 'var(--lux-text-on-surface, #F0F2F5)' }}
                              placeholder="Min. 8 karakter"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {newPassword && (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              {[{ ok: hasMinLength, l: 'Min. 8 karakter' }, { ok: hasUppercase, l: 'Huruf besar' }, { ok: hasLowercase, l: 'Huruf kecil' }, { ok: hasNumber, l: 'Angka' }, { ok: hasSpecial, l: 'Simbol (!@#)' }].map(i => (
                                <div key={i.l} className={`flex items-center gap-1.5 text-[11px] ${i.ok ? 'text-emerald-400' : 'text-white/20'}`}>
                                  <div className={`w-1.5 h-1.5 rounded-full ${i.ok ? 'bg-emerald-400' : 'bg-white/10'}`} />{i.l}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[11px] text-white/50 uppercase tracking-wider font-[JetBrains_Mono,monospace]">Konfirmasi Password</Label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                            <Input
                              type={showPassword ? 'text' : 'password'}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="pl-10 h-11 text-sm"
                              style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)', color: 'var(--lux-text-on-surface, #F0F2F5)' }}
                              placeholder="Ulangi password"
                            />
                          </div>
                          {confirmPassword && (
                            <p className={`text-[11px] ${passwordsMatch ? 'text-emerald-400' : 'text-red-400'}`}>
                              {passwordsMatch ? '✓ Password cocok' : '✗ Password tidak cocok'}
                            </p>
                          )}
                        </div>

                        <div className="flex justify-end pt-2">
                          <button
                            type="submit"
                            disabled={passwordLoading}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                            style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}
                          >
                            {passwordLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                            Ubah Password
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* Export Section */}
                {activeSection === 'export' && !showDeleteConfirm && (
                  <div className="space-y-6">
                    <div className="rounded-2xl p-6" style={{ background: 'var(--lux-card-surface, rgba(255,255,255,0.03))', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.1)' }}>
                          <Download className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <h2 className="text-base font-semibold" style={{ color: 'var(--lux-text-on-surface, rgba(240,242,245,0.9))' }}>Export Data</h2>
                          <p className="text-[11px] text-white/30">Download semua data trading Anda</p>
                        </div>
                      </div>

                      <p className="text-sm text-white/40 mb-4 leading-relaxed">
                        Download semua data trading, journal, dan watchlist Anda dalam format JSON.
                      </p>

                      <button
                        onClick={handleExportData}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
                        style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--lux-text-on-surface, #F0F2F5)', border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        <FileText className="w-4 h-4" />
                        Export Semua Data
                      </button>
                    </div>
                  </div>
                )}

                {/* Backup Section */}
                {activeSection === 'backup' && !showDeleteConfirm && (
                  <div className="space-y-6">
                    <div className="rounded-2xl p-6" style={{ background: 'var(--lux-card-surface, rgba(255,255,255,0.03))', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.1)' }}>
                          <MailIcon className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <h2 className="text-base font-semibold" style={{ color: 'var(--lux-text-on-surface, rgba(240,242,245,0.9))' }}>Data Backup</h2>
                          <p className="text-[11px] text-white/30">Kirim backup ke email Anda</p>
                        </div>
                      </div>

                      <p className="text-sm text-white/40 mb-4 leading-relaxed">
                        Kirim backup data trading ke email Anda / Send a backup of your trading data to your email.
                      </p>

                      <button
                        onClick={handleEmailBackup}
                        disabled={emailBackupLoading}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                        style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--lux-text-on-surface, #F0F2F5)', border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        {emailBackupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                        {emailBackupLoading ? 'Mengirim...' : 'Email My Data'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Danger Zone */}
                {showDeleteConfirm && (
                  <div className="rounded-2xl p-6" style={{ background: 'rgba(239,68,68,0.03)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/10">
                        <AlertCircle className="w-5 h-5 text-red-400" />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-red-400">Hapus Akun</h2>
                        <p className="text-[11px] text-red-400/50">Tindakan ini tidak dapat dibatalkan</p>
                      </div>
                    </div>

                    <p className="text-sm text-white/40 mb-6 leading-relaxed">
                      Hapus akun Anda secara permanen. Semua data (trades, journals, watchlist, dll) akan dihapus.
                    </p>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-[11px] text-white/50 uppercase tracking-wider font-[JetBrains_Mono,monospace]">Email Anda</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                          <Input
                            value={email}
                            disabled
                            className="pl-10 h-11 text-sm opacity-50"
                            style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)', color: 'var(--lux-text-on-surface, #F0F2F5)' }}
                          />
                        </div>
                        <p className="text-[10px] text-white/20 font-[JetBrains_Mono,monospace]">Masukkan email yang tertera di atas</p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[11px] text-white/50 uppercase tracking-wider font-[JetBrains_Mono,monospace]">Konfirmasi Email</Label>
                        <Input
                          value={deleteEmailConfirm}
                          onChange={(e) => setDeleteEmailConfirm(e.target.value)}
                          className="h-11 text-sm"
                          style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(239,68,68,0.2)', color: 'var(--lux-text-on-surface, #F0F2F5)' }}
                          placeholder={email}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[11px] text-white/50 uppercase tracking-wider font-[JetBrains_Mono,monospace]">Ketik &quot;DELETE&quot; untuk konfirmasi</Label>
                        <Input
                          value={deleteConfirm}
                          onChange={(e) => setDeleteConfirm(e.target.value)}
                          className="h-11 text-sm"
                          style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(239,68,68,0.2)', color: 'var(--lux-text-on-surface, #F0F2F5)' }}
                          placeholder="DELETE"
                        />
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          onClick={handleDeleteAccount}
                          disabled={deleteLoading || deleteConfirm !== 'DELETE' || deleteEmailConfirm !== user?.email}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-30"
                          style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}
                        >
                          {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          Hapus Akun Secara Permanen
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  )
}
