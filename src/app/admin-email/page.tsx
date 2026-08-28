'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail, Send, Loader2, Users, ShieldCheck, Crown, UserX,
  CheckCircle, XCircle, Clock, AlertTriangle, Eye, EyeOff,
  ArrowLeft, BarChart3, FileText, Megaphone, Settings,
  Code, Paintbrush, Vibrate, FlaskConical, ChevronDown, DatabaseBackup,
  Sparkles, GitBranch, RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { authFetch } from '@/lib/api-fetch'

const ADMIN_EMAIL = 'luxtradee@gmail.com'


interface EmailStats {
  total: number
  verified: number
  unverified: number
  pro: number
  free: number
  recentBroadcasts: {
    id: string
    target: string
    subject: string
    sentCount: number
    failedCount: number
    sentBy: string | null
    createdAt: string
  }[]
}

interface BroadcastTemplate {
  value: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  subject: string
  body: string
}

interface AutoUpdatePreview {
  features: string[]
  fixes: string[]
  improvements: string[]
  totalCommits: number
}

const AUTO_UPDATE_TARGET_OPTIONS = [
  { value: 'verified', label: 'Sudah Verifikasi' },
  { value: 'pro', label: 'User PRO' },
  { value: 'all', label: 'Semua User' },
]

const AUTO_UPDATE_DEFAULT_SUBJECT = '✨ Pembaruan LuxTrade — Fitur Baru & Perbaikan Bug'

const BROADCAST_TEMPLATES: BroadcastTemplate[] = [
  {
    value: 'custom',
    label: 'Custom',
    icon: FileText,
    subject: '',
    body: '',
  },
  {
    value: 'auto-update',
    label: 'Auto Update',
    icon: GitBranch,
    subject: AUTO_UPDATE_DEFAULT_SUBJECT,
    body: '',
  },
  {
    value: 'promo-pro',
    label: 'Promo PRO',
    icon: Crown,
    subject: '🔥 Promo Spesial: Upgrade ke PRO LuxTrade Sekarang!',
    body: `<h2 style="color: #1a1a2e; font-size: 20px; margin: 0 0 8px 0; font-weight: 700;">Upgrade ke PRO & Raih Keuntungan Lebih Banyak!</h2>
<p style="color: #555770; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;">Halo {{name}},</p>
<p style="color: #555770; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;">Kami punya <strong style="color: #1a1a2e;">penawaran spesial</strong> buat kamu! Upgrade ke akun PRO LuxTrade sekarang dan nikmatin semua fitur premium:</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 20px 0;">
  <tr>
    <td style="background-color: #f0f4ff; border-radius: 12px; padding: 20px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding: 4px 0; color: #555770; font-size: 14px; line-height: 1.8;">
            <span style="color: #3b82f6; margin-right: 8px; font-size: 16px;">📊</span> Analisa AI yang lebih mendalam
          </td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #555770; font-size: 14px; line-height: 1.8;">
            <span style="color: #3b82f6; margin-right: 8px; font-size: 16px;">📈</span> Unlimited trading journal entries
          </td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #555770; font-size: 14px; line-height: 1.8;">
            <span style="color: #3b82f6; margin-right: 8px; font-size: 16px;">🎯</span> Personalized trading insights
          </td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #555770; font-size: 14px; line-height: 1.8;">
            <span style="color: #3b82f6; margin-right: 8px; font-size: 16px;">⚡</span> Priority support
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
<p style="color: #555770; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0;">Jangan lewatkan kesempatan ini! Promo terbatas hanya untuk pengguna setia LuxTrade.</p>
<table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
  <tr>
    <td style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 12px;">
      <a href="https://luxtradee.web.id/dashboard" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700;">Upgrade ke PRO Sekarang →</a>
    </td>
  </tr>
</table>`,
  },
  {
    value: 'maintenance',
    label: 'Maintenance Notice',
    icon: Settings,
    subject: '🔧 Pemberitahuan Maintenance LuxTrade',
    body: `<h2 style="color: #1a1a2e; font-size: 20px; margin: 0 0 8px 0; font-weight: 700;">Pemeliharaan Sistem Terjadwal</h2>
<p style="color: #555770; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;">Halo {{name}},</p>
<p style="color: #555770; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;">Kami akan melakukan <strong style="color: #1a1a2e;">pemeliharaan sistem</strong> pada LuxTrade untuk meningkatkan performa dan keamanan layanan kami.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 20px 0;">
  <tr>
    <td style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 0 12px 12px 0; padding: 18px 20px;">
      <p style="color: #92400e; font-size: 14px; font-weight: 700; margin: 0 0 8px 0;">⏰ Detail Maintenance</p>
      <p style="color: #92400e; font-size: 14px; line-height: 1.7; margin: 0 0 4px 0;"><strong>Waktu:</strong> [Tanggal dan jam maintenance]</p>
      <p style="color: #92400e; font-size: 14px; line-height: 1.7; margin: 0;"><strong>Estimasi durasi:</strong> [Durasi maintenance]</p>
    </td>
  </tr>
</table>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 20px 0;">
  <tr>
    <td style="background-color: #f0f4ff; border-radius: 12px; padding: 18px 20px;">
      <p style="color: #1e40af; font-size: 14px; font-weight: 700; margin: 0 0 6px 0;">🔒 Keamanan Data</p>
      <p style="color: #555770; font-size: 14px; line-height: 1.7; margin: 0;">Selama maintenance, beberapa fitur mungkin tidak tersedia sementara. Data kamu akan <strong>aman dan terlindungi</strong>.</p>
    </td>
  </tr>
</table>
<p style="color: #8b8da0; font-size: 13px; line-height: 1.6; margin: 0; text-align: center;">Terima kasih atas pengertiannya. 🙏</p>`,
  },
  {
    value: 'new-feature',
    label: 'New Feature',
    icon: Megaphone,
    subject: '🚀 Fitur Baru di LuxTrade!',
    body: `<h2 style="color: #1a1a2e; font-size: 20px; margin: 0 0 8px 0; font-weight: 700;">Fitur Baru Telah Hadir!</h2>
<p style="color: #555770; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;">Halo {{name}},</p>
<p style="color: #555770; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;">Kami dengan senang hati memperkenalkan <strong style="color: #1a1a2e;">fitur terbaru</strong> di LuxTrade!</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 20px 0;">
  <tr>
    <td style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 22px 22px;">
      <p style="color: #059669; font-size: 16px; font-weight: 700; margin: 0 0 10px 0;">✨ [Nama Fitur Baru]</p>
      <p style="color: #555770; font-size: 14px; line-height: 1.7; margin: 0;">[Deskripsi singkat fitur baru dan manfaatnya untuk pengguna]</p>
    </td>
  </tr>
</table>
<p style="color: #555770; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0;">Coba fitur baru ini sekarang dan rasakan pengalaman trading yang lebih baik bersama LuxTrade!</p>
<table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
  <tr>
    <td style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 12px;">
      <a href="https://luxtradee.web.id/dashboard" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700;">Coba Sekarang →</a>
    </td>
  </tr>
</table>`,
  },
  {
    value: 'update-fix',
    label: 'Update & Perbaikan',
    icon: Sparkles,
    subject: '✨ Pembaruan LuxTrade — Fitur Baru & Perbaikan Bug',
    body: `<h2 style="color: #1a1a2e; font-size: 20px; margin: 0 0 8px 0; font-weight: 700;">Kami Terus Berkembang untuk Kamu! 🚀</h2>
<p style="color: #555770; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;">Halo {{name}},</p>
<p style="color: #555770; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;">Tim LuxTrade terus bekerja keras buat bikin pengalaman trading kamu makin baik. Kali ini kami sudah merilis beberapa <strong style="color: #1a1a2e;">pembaruan fitur dan perbaikan bug</strong> yang penting:</p>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 20px 0;">
  <tr>
    <td style="background-color: #f0f4ff; border-radius: 12px; padding: 22px 22px;">
      <p style="color: #1e40af; font-size: 14px; font-weight: 700; margin: 0 0 14px 0;">🆕 Fitur Baru</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding: 3px 0; color: #555770; font-size: 14px; line-height: 1.8;">
            <span style="color: #3b82f6; margin-right: 8px; font-size: 16px;">✦</span> [Nama fitur baru 1] — [deskripsi singkat manfaatnya]
          </td>
        </tr>
        <tr>
          <td style="padding: 3px 0; color: #555770; font-size: 14px; line-height: 1.8;">
            <span style="color: #3b82f6; margin-right: 8px; font-size: 16px;">✦</span> [Nama fitur baru 2] — [deskripsi singkat manfaatnya]
          </td>
        </tr>
        <tr>
          <td style="padding: 3px 0; color: #555770; font-size: 14px; line-height: 1.8;">
            <span style="color: #3b82f6; margin-right: 8px; font-size: 16px;">✦</span> [Nama fitur baru 3] — [deskripsi singkat manfaatnya]
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 20px 0;">
  <tr>
    <td style="background-color: #ecfdf5; border-radius: 12px; padding: 22px 22px;">
      <p style="color: #059669; font-size: 14px; font-weight: 700; margin: 0 0 14px 0;">🔧 Perbaikan</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding: 3px 0; color: #555770; font-size: 14px; line-height: 1.8;">
            <span style="color: #059669; margin-right: 8px; font-size: 16px;">✓</span> [Perbaikan 1 — masalah apa yang diperbaiki]
          </td>
        </tr>
        <tr>
          <td style="padding: 3px 0; color: #555770; font-size: 14px; line-height: 1.8;">
            <span style="color: #059669; margin-right: 8px; font-size: 16px;">✓</span> [Perbaikan 2 — masalah apa yang diperbaiki]
          </td>
        </tr>
        <tr>
          <td style="padding: 3px 0; color: #555770; font-size: 14px; line-height: 1.8;">
            <span style="color: #059669; margin-right: 8px; font-size: 16px;">✓</span> [Perbaikan 3 — masalah apa yang diperbaiki]
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
  <tr>
    <td style="background-color: #fef3c7; border-radius: 12px; padding: 18px 22px;">
      <p style="color: #92400e; font-size: 14px; font-weight: 700; margin: 0 0 6px 0;">⚡ Peningkatan Performa</p>
      <p style="color: #555770; font-size: 14px; line-height: 1.7; margin: 0;">[Deskripsi peningkatan performa — misalnya: Kami sudah mengoptimalkan kecepatan loading dashboard hingga 2x lebih cepat, dan memperbaiki stabilitas koneksi database untuk pengalaman yang lebih mulus.]</p>
    </td>
  </tr>
</table>

<p style="color: #555770; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0;">Masih banyak ide dan fitur yang sedang kami kerjakan. Kalau kamu punya <strong style="color: #1a1a2e;">saran atau feedback</strong>, jangan ragu buat kasih tau kami ya!</p>

<table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
  <tr>
    <td style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 12px;">
      <a href="https://luxtradee.web.id/dashboard" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700;">Buka Dashboard Sekarang →</a>
    </td>
  </tr>
</table>

<p style="color: #8b8da0; font-size: 13px; line-height: 1.6; margin: 24px 0 0 0; text-align: center;">Terima kasih sudah setia pakai LuxTrade. Happy trading! 📈</p>`,
  },
]

const TARGET_OPTIONS = [
  { value: 'unverified', label: 'Belum Verifikasi', icon: UserX, color: 'text-orange-400', badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  { value: 'verified', label: 'Sudah Verifikasi', icon: ShieldCheck, color: 'text-emerald-400', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  { value: 'pro', label: 'User PRO', icon: Crown, color: 'text-blue-400', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { value: 'free', label: 'User Free', icon: Users, color: 'text-cyan-400', badge: 'bg-blue-500/10 text-cyan-400 border-blue-500/20' },
  { value: 'all', label: 'Semua User', icon: Mail, color: 'text-blue-400', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
]

export default function AdminEmailPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState<EmailStats | null>(null)
  const [selectedTarget, setSelectedTarget] = useState('unverified')
  const [subject, setSubject] = useState('')
  const [htmlBody, setHtmlBody] = useState('')
  const [sending, setSending] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [editorMode, setEditorMode] = useState<'visual' | 'html'>('visual')
  const [selectedTemplate, setSelectedTemplate] = useState('custom')
  const [result, setResult] = useState<{ sent: number; failed: number; errors: string[] } | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // Auto Update state
  const [autoDays, setAutoDays] = useState(7)
  const [autoSubject, setAutoSubject] = useState(AUTO_UPDATE_DEFAULT_SUBJECT)
  const [autoTarget, setAutoTarget] = useState('verified')
  const [autoPreview, setAutoPreview] = useState<AutoUpdatePreview | null>(null)
  const [autoPreviewLoading, setAutoPreviewLoading] = useState(false)
  const [autoSending, setAutoSending] = useState(false)

  // Sync users from Auth → DB then refresh stats
  const syncAndRefresh = async () => {
    if (syncing) return
    setSyncing(true)
    try {
      const res = await authFetch('/api/admin/sync-users', {
        method: 'POST',
        headers: { 'x-admin-email': ADMIN_EMAIL },
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message, { duration: 6000 })
        // Refresh stats
        const statsRes = await authFetch('/api/admin/email-stats', {
          headers: { 'x-admin-email': ADMIN_EMAIL },
        })
        if (statsRes.ok) setStats(await statsRes.json())
      } else {
        toast.error(data.error || 'Gagal sinkronisasi', { duration: 6000 })
      }
    } catch {
      toast.error('Network error saat sinkronisasi')
    } finally {
      setSyncing(false)
    }
  }

  // Admin check
  useEffect(() => {
    async function checkAdmin() {
      try {
        const { supabase } = await import('@/lib/supabase')
        if (!supabase) {
          router.push('/')
          return
        }
        const { data: { session } } = await supabase.auth.getSession()
        const email = session?.user?.email?.toLowerCase()
        if (email === ADMIN_EMAIL) {
          setIsAdmin(true)
        } else {
          router.push('/')
        }
      } catch {
        router.push('/')
      } finally {
        setIsLoading(false)
      }
    }
    checkAdmin()
  }, [router])

  // Fetch stats
  useEffect(() => {
    if (!isAdmin) return
    async function fetchStats() {
      try {
        const res = await authFetch('/api/admin/email-stats', {
          headers: { 'x-admin-email': ADMIN_EMAIL },
        })
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      }
    }
    fetchStats()
  }, [isAdmin])

  // Update default subject when target changes
  useEffect(() => {
    if (selectedTemplate === 'auto-update') return
    if (selectedTarget === 'unverified') {
      setSubject('Hei {{name}}, akun kamu belum diverifikasi nih 😅')
      setHtmlBody('')
    } else {
      if (selectedTemplate === 'custom') {
        setSubject('')
        setHtmlBody('')
      }
    }
    setResult(null)
  }, [selectedTarget, selectedTemplate])

  // Fetch auto-update commit preview when days changes
  const fetchAutoPreview = useCallback(async () => {
    if (selectedTemplate !== 'auto-update') return
    setAutoPreviewLoading(true)
    try {
      const res = await authFetch(`/api/admin/auto-update-email?days=${autoDays}`, {
        headers: { 'x-admin-email': ADMIN_EMAIL },
      })
      if (res.ok) {
        setAutoPreview(await res.json())
      } else {
        setAutoPreview(null)
      }
    } catch {
      setAutoPreview(null)
    } finally {
      setAutoPreviewLoading(false)
    }
  }, [selectedTemplate, autoDays])

  useEffect(() => {
    if (selectedTemplate === 'auto-update') {
      fetchAutoPreview()
    }
  }, [selectedTemplate, fetchAutoPreview])

  // Handle auto-update send
  const handleAutoUpdateSend = async () => {
    if (autoSending) return
    setAutoSending(true)
    setResult(null)
    try {
      const res = await authFetch('/api/admin/auto-update-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-email': ADMIN_EMAIL },
        body: JSON.stringify({ days: autoDays, target: autoTarget, subject: autoSubject }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ sent: data.sent, failed: data.failed, errors: [] })
        toast.success(`Auto update terkirim! ${data.sent} berhasil, ${data.failed} gagal`)
        const statsRes = await authFetch('/api/admin/email-stats', {
          headers: { 'x-admin-email': ADMIN_EMAIL },
        })
        if (statsRes.ok) setStats(await statsRes.json())
      } else {
        toast.error(data.error || 'Gagal mengirim auto update')
      }
    } catch {
      toast.error('Terjadi kesalahan saat mengirim auto update')
    } finally {
      setAutoSending(false)
    }
  }

  // Apply template
  const handleTemplateChange = (templateValue: string) => {
    setSelectedTemplate(templateValue)
    const tmpl = BROADCAST_TEMPLATES.find(t => t.value === templateValue)
    if (tmpl && templateValue !== 'custom') {
      setSubject(tmpl.subject)
      setHtmlBody(tmpl.body)
    } else if (templateValue === 'custom') {
      setSubject('')
      setHtmlBody('')
    }
    setResult(null)
  }

  const handleSendTestEmail = async () => {
    if (!subject.trim()) {
      toast.error('Subject email wajib diisi')
      return
    }
    if (selectedTarget !== 'unverified' && !htmlBody.trim()) {
      toast.error('Konten email wajib diisi')
      return
    }

    setSendingTest(true)
    try {
      const params = new URLSearchParams({
        subject: subject,
        htmlBody: selectedTarget === 'unverified'
          ? '<p>Ini adalah test email untuk template reminder verifikasi.</p><p>Teks ini hanya untuk preview.</p>'
          : htmlBody,
      })
      const res = await authFetch(`/api/admin/email-broadcast?${params.toString()}`, {
        headers: { 'x-admin-email': ADMIN_EMAIL },
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('✅ Test email terkirim ke inbox kamu!')
      } else {
        toast.error(data.error || 'Gagal mengirim test email')
      }
    } catch (err) {
      console.error('Test email error:', err)
      toast.error('Terjadi kesalahan saat mengirim test email')
    } finally {
      setSendingTest(false)
    }
  }

  const handleOpenConfirmDialog = () => {
    if (!subject.trim()) {
      toast.error('Subject email wajib diisi')
      return
    }
    if (selectedTarget !== 'unverified' && !htmlBody.trim()) {
      toast.error('Konten email wajib diisi')
      return
    }
    setShowConfirmDialog(true)
  }

  const handleSend = async () => {
    setShowConfirmDialog(false)
    setSending(true)
    setResult(null)

    try {
      const res = await authFetch('/api/admin/email-broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': ADMIN_EMAIL,
        },
        body: JSON.stringify({
          target: selectedTarget,
          subject,
          htmlBody,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setResult(data)
        toast.success(`Email terkirim! ${data.sent} berhasil, ${data.failed} gagal`)
        const statsRes = await authFetch('/api/admin/email-stats', {
          headers: { 'x-admin-email': ADMIN_EMAIL },
        })
        if (statsRes.ok) {
          setStats(await statsRes.json())
        }
      } else {
        toast.error(data.error || 'Gagal mengirim email')
      }
    } catch (err) {
      console.error('Send error:', err)
      toast.error('Terjadi kesalahan saat mengirim email')
    } finally {
      setSending(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050507] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    )
  }

  if (!isAdmin) return null

  const currentTarget = TARGET_OPTIONS.find(t => t.value === selectedTarget)
  const recipientCount = stats ? (stats[currentTarget?.value as keyof EmailStats] as number) : 0
  const estimatedMinutes = Math.ceil(recipientCount / (5 * 10)) // ~10 emails/sec with 5 concurrent

  return (
    <div className="min-h-screen bg-[#050507] landing-noise">
      {/* Ambient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[60%] h-[40%] pointer-events-none" aria-hidden="true" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, rgba(6,182,212,0.08) 30%, rgba(16,185,129,0.04) 50%, transparent 70%)' }} />
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-[#050507]/90 backdrop-blur-xl sticky top-0 z-50 relative">
        {/* Subtle bottom glow line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/')}
            className="text-[#8892b0] hover:text-[#f0f2ff] hover:bg-white/5"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span className="text-[13px]">Kembali</span>
          </Button>
          <div className="h-5 w-px bg-white/10" />
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <Mail className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h1 className="text-[15px] font-medium text-[#f0f2ff] tracking-tight">Email Broadcast</h1>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              onClick={syncAndRefresh}
              disabled={syncing}
              variant="outline"
              size="sm"
              className="border-blue-500/20 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 disabled:opacity-50 text-xs"
              title="Sinkronkan user dari Auth ke DB sebelum broadcast"
            >
              <DatabaseBackup className={`w-3.5 h-3.5 mr-1.5 ${syncing ? 'animate-pulse' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Users'}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 relative z-10">
        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-white/[0.04] rounded-2xl overflow-hidden border border-white/[0.06]"
        >
          {stats && (
            <>
              <StatCard label="Total User" value={stats.total} icon={Users} color="text-[#f0f2ff]" />
              <StatCard label="Belum Verifikasi" value={stats.unverified} icon={UserX} color="text-orange-400" />
              <StatCard label="Sudah Verifikasi" value={stats.verified} icon={ShieldCheck} color="text-emerald-400" />
              <StatCard label="User PRO" value={stats.pro} icon={Crown} color="text-blue-400" />
              <StatCard label="User Free" value={stats.free} icon={Users} color="text-cyan-400" />
            </>
          )}
        </motion.div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Broadcast Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-2 space-y-4"
          >
            <Card className="bg-[#0e1117]/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl">
              <CardHeader className="pb-5">
                <p className="text-[11px] font-medium tracking-[0.16em] uppercase text-blue-400 mb-2">BROADCAST</p>
                <CardTitle className="text-[#f0f2ff] text-xl font-medium tracking-tight flex items-center gap-2">
                  <Send className="w-5 h-5 text-blue-400" />
                  Kirim Email Broadcast
                </CardTitle>
                <CardDescription className="text-[#8892b0] text-[14px]">
                  Pilih target user, tulis subject dan konten, lalu kirim
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Target Selection */}
                <div className="space-y-3">
                  <Label className="text-[#f0f2ff]/70 text-sm font-medium">Target Penerima</Label>
                  <Tabs value={selectedTarget} onValueChange={setSelectedTarget} className="w-full">
                    <TabsList className="w-full bg-white/[0.03] border border-white/[0.06] h-auto p-1 flex flex-wrap gap-1">
                      {TARGET_OPTIONS.map(opt => {
                        const Icon = opt.icon
                        return (
                          <TabsTrigger
                            key={opt.value}
                            value={opt.value}
                            className="flex-1 min-w-[120px] py-2 px-3 data-[state=active]:bg-blue-500/15 data-[state=active]:text-[#f0f2ff] data-[state=active]:border-blue-500/30 text-[#8892b0] rounded-lg text-xs sm:text-sm transition-all border border-transparent"
                          >
                            <Icon className={`w-4 h-4 mr-1.5 ${opt.color}`} />
                            <span className="hidden sm:inline">{opt.label}</span>
                            <span className="sm:hidden">{opt.label.split(' ')[0]}</span>
                          </TabsTrigger>
                        )
                      })}
                    </TabsList>
                  </Tabs>

                  {/* Show target count & estimated time */}
                  {stats && currentTarget && (
                    <div className="flex items-center gap-3 text-sm">
                      <Badge variant="outline" className={currentTarget.badge}>
                        {recipientCount} user
                      </Badge>
                      <span className="text-[#8892b0]">
                        akan menerima email ini (maks 50/batch)
                        {estimatedMinutes > 0 && (
                          <span className="ml-1">· est. ~{estimatedMinutes} menit</span>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* Template Selection (non-unverified) */}
                {selectedTarget !== 'unverified' && (
                  <div className="space-y-2">
                    <Label className="text-[#f0f2ff]/70 text-sm font-medium">Template</Label>
                    <div className="relative">
                      <select
                        value={selectedTemplate}
                        onChange={(e) => handleTemplateChange(e.target.value)}
                        className="w-full appearance-none bg-white/[0.03] border border-white/[0.06] text-[#f0f2ff] text-sm rounded-xl px-3 py-2.5 pr-10 focus:outline-none focus:border-blue-500/40 focus:ring-blue-500/20"
                      >
                        {BROADCAST_TEMPLATES.map(tmpl => (
                          <option key={tmpl.value} value={tmpl.value} className="bg-[#0e1117] text-[#f0f2ff]">
                            {tmpl.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8892b0] pointer-events-none" />
                    </div>
                  </div>
                )}

                {/* ─── Auto Update Form ─── */}
                {selectedTemplate === 'auto-update' && selectedTarget !== 'unverified' && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    {/* Info banner */}
                    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-blue-500/[0.06] border border-blue-500/20">
                      <GitBranch className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
                      <div className="text-sm text-[#8892b0]">
                        <p className="font-medium text-blue-300/80 mb-1">Auto Update Email</p>
                        <p>Sistem akan membaca commit git terbaru dan menghasilkan email update secara otomatis. Kamu hanya perlu atur jangka waktu, target, dan subject.</p>
                      </div>
                    </div>

                    {/* Controls row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Days input */}
                      <div className="space-y-1.5">
                        <Label className="text-[#f0f2ff]/70 text-sm font-medium">Jumlah hari terakhir</Label>
                        <div className="relative">
                          <Input
                            type="number"
                            min={1}
                            max={90}
                            value={autoDays}
                            onChange={e => setAutoDays(Math.max(1, Math.min(90, parseInt(e.target.value) || 7)))}
                            className="bg-white/[0.03] border border-white/[0.06] text-[#f0f2ff] placeholder:text-[#8892b0]/50 focus:border-blue-500/40 focus:ring-blue-500/20 rounded-xl pr-16"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8892b0] pointer-events-none">hari</span>
                        </div>
                      </div>

                      {/* Target select */}
                      <div className="space-y-1.5">
                        <Label className="text-[#f0f2ff]/70 text-sm font-medium">Target Penerima</Label>
                        <div className="relative">
                          <select
                            value={autoTarget}
                            onChange={e => setAutoTarget(e.target.value)}
                            className="w-full appearance-none bg-white/[0.03] border border-white/[0.06] text-[#f0f2ff] text-sm rounded-xl px-3 py-2.5 pr-10 focus:outline-none focus:border-blue-500/40 focus:ring-blue-500/20"
                          >
                            {AUTO_UPDATE_TARGET_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value} className="bg-[#0e1117] text-[#f0f2ff]">
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8892b0] pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    {/* Subject input */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-[#f0f2ff]/70 text-sm font-medium">Subject Email</Label>
                        <span className="text-[11px] text-[#8892b0]">{autoSubject.length} karakter</span>
                      </div>
                      <Input
                        value={autoSubject}
                        onChange={e => setAutoSubject(e.target.value)}
                        placeholder="Subject email auto update..."
                        className="bg-white/[0.03] border border-white/[0.06] text-[#f0f2ff] placeholder:text-[#8892b0]/50 focus:border-blue-500/40 focus:ring-blue-500/20 rounded-xl"
                      />
                    </div>

                    {/* Commit Preview */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[#f0f2ff]/70 text-sm font-medium">Preview Commit</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={fetchAutoPreview}
                          disabled={autoPreviewLoading}
                          className="text-blue-400 hover:text-blue-300 text-xs h-7 px-2"
                        >
                          <RefreshCw className={`w-3 h-3 mr-1 ${autoPreviewLoading ? 'animate-spin' : ''}`} />
                          Refresh
                        </Button>
                      </div>

                      {autoPreviewLoading ? (
                        <div className="flex items-center justify-center py-8 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                          <span className="ml-2 text-sm text-[#8892b0]">Membaca commit...</span>
                        </div>
                      ) : autoPreview && autoPreview.totalCommits > 0 ? (
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.06] overflow-hidden">
                          {/* Total */}
                          <div className="px-4 py-2.5 flex items-center justify-between">
                            <span className="text-xs text-[#8892b0]">Total commit ditemukan</span>
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px] px-1.5 py-0">
                              {autoPreview.totalCommits}
                            </Badge>
                          </div>

                          {/* Features */}
                          {autoPreview.features.length > 0 && (
                            <div className="px-4 py-3">
                              <div className="flex items-center gap-1.5 mb-2">
                                <span className="text-blue-400 text-xs">✦</span>
                                <span className="text-xs font-medium text-blue-300/80">Fitur Baru ({autoPreview.features.length})</span>
                              </div>
                              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                {autoPreview.features.map((f, i) => (
                                  <div key={i} className="flex items-start gap-2 text-xs text-[#8892b0]">
                                    <span className="text-blue-400/60 mt-0.5 shrink-0">•</span>
                                    <span className="break-words">{f}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Fixes */}
                          {autoPreview.fixes.length > 0 && (
                            <div className="px-4 py-3">
                              <div className="flex items-center gap-1.5 mb-2">
                                <span className="text-emerald-400 text-xs">✓</span>
                                <span className="text-xs font-medium text-emerald-300/80">Perbaikan ({autoPreview.fixes.length})</span>
                              </div>
                              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                {autoPreview.fixes.map((f, i) => (
                                  <div key={i} className="flex items-start gap-2 text-xs text-[#8892b0]">
                                    <span className="text-emerald-400/60 mt-0.5 shrink-0">•</span>
                                    <span className="break-words">{f}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Improvements */}
                          {autoPreview.improvements.length > 0 && (
                            <div className="px-4 py-3">
                              <div className="flex items-center gap-1.5 mb-2">
                                <span className="text-amber-400 text-xs">⚡</span>
                                <span className="text-xs font-medium text-amber-300/80">Peningkatan & Optimasi ({autoPreview.improvements.length})</span>
                              </div>
                              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                {autoPreview.improvements.map((item, i) => (
                                  <div key={i} className="flex items-start gap-2 text-xs text-[#8892b0]">
                                    <span className="text-amber-400/60 mt-0.5 shrink-0">•</span>
                                    <span className="break-words">{item}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : autoPreview && autoPreview.totalCommits === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                          <GitBranch className="w-8 h-8 text-[#8892b0]/20 mb-2" />
                          <span className="text-sm text-[#8892b0]/50">Tidak ada commit dalam {autoDays} hari terakhir</span>
                        </div>
                      ) : null}
                    </div>

                    {/* Send Auto Update Button */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        type="button"
                        onClick={handleAutoUpdateSend}
                        disabled={autoSending || !autoPreview || autoPreview.totalCommits === 0 || !autoSubject.trim()}
                        className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-600 hover:to-cyan-500 text-white font-medium py-6 text-base disabled:opacity-40 disabled:cursor-not-allowed rounded-xl"
                      >
                        {autoSending ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Sedang Mengirim Auto Update...
                          </>
                        ) : (
                          <>
                            <Send className="w-5 h-5 mr-2" />
                            Kirim Auto Update
                          </>
                        )}
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* Subject (hidden for auto-update, has its own) */}
                {selectedTemplate !== 'auto-update' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="subject" className="text-[#f0f2ff]/70 text-sm font-medium">
                        Subject Email
                      </Label>
                      <span className="text-[11px] text-[#8892b0]">
                        {subject.length} karakter
                      </span>
                    </div>
                    <Input
                      id="subject"
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      placeholder={selectedTarget === 'unverified' ? 'Hei {{name}}, akun kamu belum diverifikasi nih 😅' : 'Masukkan subject email...'}
                      className="bg-white/[0.03] border border-white/[0.06] text-[#f0f2ff] placeholder:text-[#8892b0]/50 focus:border-blue-500/40 focus:ring-blue-500/20 rounded-xl"
                    />
                    <p className="text-xs text-[#8892b0]">
                      Gunakan {'{{name}}'} dan {'{{email}}'} sebagai placeholder
                    </p>
                  </div>
                )}

                {/* Rich Text Editor (non-unverified, non-auto-update) */}
                {selectedTarget !== 'unverified' && selectedTemplate !== 'auto-update' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[#f0f2ff]/70 text-sm font-medium">
                        Konten Email
                      </Label>
                      <div className="flex items-center gap-2">
                        {/* Editor mode toggle */}
                        <div className="flex items-center bg-white/[0.03] border border-white/[0.06] rounded-xl p-0.5">
                          <button
                            type="button"
                            onClick={() => setEditorMode('visual')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                              editorMode === 'visual'
                                ? 'bg-blue-500/15 text-[#f0f2ff]'
                                : 'text-[#8892b0] hover:text-[#f0f2ff]'
                            }`}
                          >
                            <Paintbrush className="w-3.5 h-3.5" />
                            Visual
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditorMode('html')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                              editorMode === 'html'
                                ? 'bg-blue-500/15 text-[#f0f2ff]'
                                : 'text-[#8892b0] hover:text-[#f0f2ff]'
                            }`}
                          >
                            <Code className="w-3.5 h-3.5" />
                            HTML
                          </button>
                        </div>
                        {/* Preview toggle */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowPreview(!showPreview)}
                          className="text-[#8892b0] hover:text-[#f0f2ff] text-xs h-8 px-2"
                        >
                          {showPreview ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                          {showPreview ? 'Tutup' : 'Preview'}
                        </Button>
                      </div>
                    </div>

                    {/* Quill Editor (visual mode) */}
                    {editorMode === 'visual' && (
                      <div className="email-editor-wrapper rounded-xl overflow-hidden border border-white/[0.06]">
                        <style jsx global>{`
                          .email-editor-wrapper .ql-toolbar {
                            background: rgba(255,255,255,0.03) !important;
                            border-bottom: 1px solid rgba(255,255,255,0.06) !important;
                            padding: 8px !important;
                          }
                          .email-editor-wrapper .ql-container {
                            border: none !important;
                            min-height: 200px;
                            max-height: 400px;
                            overflow-y: auto;
                          }
                          .email-editor-wrapper .ql-editor {
                            min-height: 200px;
                            color: rgba(255,255,255,0.8) !important;
                            font-size: 14px;
                            line-height: 1.7;
                            padding: 16px !important;
                          }
                          .email-editor-wrapper .ql-editor.ql-blank::before {
                            color: rgba(255,255,255,0.25) !important;
                            font-style: normal !important;
                          }
                          .email-editor-wrapper .ql-editor a {
                            color: #60a5fa !important;
                          }
                          .email-editor-wrapper .ql-snow .ql-stroke {
                            stroke: rgba(255,255,255,0.4) !important;
                          }
                          .email-editor-wrapper .ql-snow .ql-fill {
                            fill: rgba(255,255,255,0.4) !important;
                          }
                          .email-editor-wrapper .ql-snow .ql-picker-label {
                            color: rgba(255,255,255,0.4) !important;
                          }
                          .email-editor-wrapper .ql-snow .ql-picker-options {
                            background: #0e1117 !important;
                            border-color: rgba(255,255,255,0.1) !important;
                            border-radius: 8px !important;
                            padding: 4px !important;
                          }
                          .email-editor-wrapper .ql-snow .ql-picker-item {
                            color: rgba(255,255,255,0.6) !important;
                          }
                          .email-editor-wrapper .ql-snow .ql-picker-item:hover,
                          .email-editor-wrapper .ql-snow .ql-picker-item.ql-selected {
                            color: #60a5fa !important;
                          }
                          .email-editor-wrapper .ql-snow .ql-active .ql-stroke {
                            stroke: #3b82f6 !important;
                          }
                          .email-editor-wrapper .ql-snow .ql-active .ql-fill {
                            fill: #3b82f6 !important;
                          }
                          .email-editor-wrapper .ql-snow .ql-active {
                            color: #3b82f6 !important;
                          }
                          .email-editor-wrapper .ql-toolbar .ql-formats button:hover .ql-stroke {
                            stroke: #60a5fa !important;
                          }
                          .email-editor-wrapper .ql-toolbar .ql-formats button:hover .ql-fill {
                            fill: #60a5fa !important;
                          }
                          .email-editor-wrapper .ql-snow .ql-tooltip {
                            background: #0e1117 !important;
                            border-color: rgba(255,255,255,0.1) !important;
                            border-radius: 8px !important;
                            color: rgba(255,255,255,0.8) !important;
                            box-shadow: 0 8px 32px rgba(0,0,0,0.4) !important;
                          }
                          .email-editor-wrapper .ql-snow .ql-tooltip input[type=text] {
                            background: rgba(255,255,255,0.05) !important;
                            border-color: rgba(255,255,255,0.1) !important;
                            color: white !important;
                            border-radius: 4px !important;
                          }
                          .email-editor-wrapper .ql-editor img {
                            max-width: 100% !important;
                            border-radius: 8px;
                          }
                          .email-editor-wrapper .ql-editor h1 { font-size: 1.5em; color: white; }
                          .email-editor-wrapper .ql-editor h2 { font-size: 1.3em; color: white; }
                          .email-editor-wrapper .ql-editor h3 { font-size: 1.15em; color: white; }
                          .email-editor-wrapper ::-webkit-scrollbar { width: 6px; }
                          .email-editor-wrapper ::-webkit-scrollbar-track { background: transparent; }
                          .email-editor-wrapper ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
                        `}</style>
                        <Textarea
                          value={htmlBody}
                          onChange={e => setHtmlBody(e.target.value)}
                          placeholder="Tulis konten email broadcast... (support HTML tags)"
                          rows={10}
                          className="bg-white/[0.03] border-white/[0.06] text-[#f0f2ff] placeholder:text-[#8892b0]/50 focus:border-blue-500/40 focus:ring-blue-500/20 text-sm min-h-[200px]"
                        />
                      </div>
                    )}

                    {/* Raw HTML Editor */}
                    {editorMode === 'html' && (
                      <Textarea
                        value={htmlBody}
                        onChange={e => setHtmlBody(e.target.value)}
                        placeholder={`<h1>Halo {{name}}!</h1>\n<p>Ini adalah email broadcast dari LuxTrade...</p>\n<a href="https://luxtradee.web.id">Kunjungi LuxTrade</a>`}
                        rows={12}
                        className="bg-white/[0.03] border border-white/[0.06] text-[#f0f2ff] placeholder:text-[#8892b0]/50 focus:border-blue-500/40 focus:ring-blue-500/20 font-mono text-sm rounded-xl"
                      />
                    )}

                    {/* Character count */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#8892b0]">
                        {htmlBody.length} karakter · {htmlBody.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length} kata (tanpa HTML)
                      </span>
                    </div>

                    {/* Preview */}
                    <AnimatePresence>
                      {showPreview && htmlBody && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="border border-white/[0.06] rounded-xl overflow-hidden"
                        >
                          <div className="px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.06] flex items-center justify-between">
                            <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-blue-400">Preview</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-white/[0.02] border-white/[0.06] text-[#8892b0]">
                              Desktop
                            </Badge>
                          </div>
                          {/* Email client simulation */}
                          <div className="p-4 bg-[#f4f4f7]">
                            <div className="max-w-[600px] mx-auto bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                              {/* Email header bar */}
                              <div className="px-6 py-4 border-b border-gray-100">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                                    <span className="text-lg">👑</span>
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-gray-900">LuxTrade</p>
                                    <p className="text-[11px] text-gray-400">noreply@luxtradee.web.id</p>
                                  </div>
                                </div>
                                <p className="text-xs text-gray-500 mt-2 font-medium">{subject.replace(/\{\{name\}\}/g, 'John').replace(/\{\{email\}\}/g, 'john@example.com')}</p>
                              </div>
                              {/* Email body */}
                              <div
                                className="px-10 py-6 text-sm max-h-80 overflow-y-auto"
                                style={{ color: '#555770' }}
                                dangerouslySetInnerHTML={{
                                  __html: htmlBody.replace(/\{\{name\}\}/g, 'John').replace(/\{\{email\}\}/g, 'john@example.com'),
                                }}
                              />
                              {/* Email footer */}
                              <div className="px-10 py-4 border-t border-gray-100 text-center">
                                <p className="text-[11px] text-gray-400">© {new Date().getFullYear()} LuxTrade. All rights reserved.</p>
                                <p className="text-[10px] text-gray-300 mt-1">Email ini dikirim dari noreply@luxtradee.web.id</p>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Built-in Template Notice for Unverified */}
                {selectedTarget === 'unverified' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border border-blue-500/20 rounded-xl bg-blue-500/[0.06] p-4"
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
                      <div className="text-sm text-[#8892b0]">
                        <p className="font-medium text-blue-300/80 mb-1">Template Otomatis</p>
                        <p>
                          Untuk target &quot;Belum Verifikasi&quot;, sistem akan otomatis mengirim email reminder dengan
                          link verifikasi baru yang berlaku 24 jam. Kamu cukup atur subject-nya saja.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Action Buttons (hidden for auto-update, has its own) */}
                {selectedTemplate !== 'auto-update' && (
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Test Email Button */}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSendTestEmail}
                      disabled={sendingTest || sending || !subject.trim()}
                      className="flex-1 sm:flex-none border-white/[0.06] text-[#8892b0] hover:text-[#f0f2ff] hover:bg-white/[0.04] rounded-xl"
                    >
                      {sendingTest ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <FlaskConical className="w-4 h-4 mr-2" />
                          Kirim Test Email
                        </>
                      )}
                    </Button>

                    {/* Send Broadcast Button */}
                    <Button
                      onClick={handleOpenConfirmDialog}
                      disabled={sending || !subject.trim() || (selectedTarget !== 'unverified' && !htmlBody.trim())}
                      className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-600 hover:to-cyan-500 text-white font-medium py-6 text-base disabled:opacity-40 disabled:cursor-not-allowed rounded-xl"
                    >
                      {sending ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Sedang Mengirim...
                        </>
                      ) : (
                        <>
                          <Send className="w-5 h-5 mr-2" />
                          Kirim Broadcast
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Result */}
                <AnimatePresence>
                  {result && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-3"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/[0.08] border border-green-500/20">
                          <CheckCircle className="w-5 h-5 text-green-400" />
                          <div>
                            <p className="text-green-400 font-semibold text-lg">{result.sent}</p>
                            <p className="text-green-300/50 text-xs">Berhasil Terkirim</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/[0.08] border border-red-500/20">
                          <XCircle className="w-5 h-5 text-red-400" />
                          <div>
                            <p className="text-red-400 font-semibold text-lg">{result.failed}</p>
                            <p className="text-red-300/50 text-xs">Gagal Terkirim</p>
                          </div>
                        </div>
                      </div>

                      {result.errors.length > 0 && (
                        <div className="border border-white/[0.06] rounded-lg p-3 max-h-40 overflow-y-auto">
                          <p className="text-xs text-white/40 font-medium mb-2">Detail Error:</p>
                          {result.errors.map((err, i) => (
                            <p key={i} className="text-xs text-red-400/70 mb-1">{err}</p>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>

          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-4"
          >
            {/* Recent Broadcasts */}
            <Card className="bg-[#0e1117]/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl hover:bg-[#0e1117] transition-colors duration-300">
              <CardHeader className="pb-3">
                <p className="text-[11px] font-medium tracking-[0.16em] uppercase text-blue-400 mb-1">HISTORY</p>
                <CardTitle className="text-[#f0f2ff] text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-400" />
                  Riwayat Broadcast
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats && stats.recentBroadcasts.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {stats.recentBroadcasts.map(broadcast => {
                      const target = TARGET_OPTIONS.find(t => t.value === broadcast.target)
                      const Icon = target?.icon || Mail
                      return (
                        <div
                          key={broadcast.id}
                          className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] space-y-2"
                        >
                          <div className="flex items-center gap-2 text-xs text-white/40">
                            <Icon className={`w-3.5 h-3.5 ${target?.color}`} />
                            <Badge variant="outline" className={`${target?.badge || ''} text-[10px] px-1.5 py-0`}>
                              {target?.label || broadcast.target}
                            </Badge>
                            <span className="ml-auto">
                              {new Date(broadcast.createdAt).toLocaleDateString('id-ID', {
                                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <p className="text-xs text-white/60 truncate">{broadcast.subject}</p>
                          <div className="flex items-center gap-3 text-[11px]">
                            <span className="text-green-400/70">
                              <CheckCircle className="w-3 h-3 inline mr-1" />
                              {broadcast.sentCount}
                            </span>
                            <span className="text-red-400/70">
                              <XCircle className="w-3 h-3 inline mr-1" />
                              {broadcast.failedCount}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Clock className="w-8 h-8 text-[#8892b0]/20 mx-auto mb-2" />
                    <p className="text-xs text-[#8892b0]/50">Belum ada riwayat broadcast</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="bg-[#0e1117]/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl hover:bg-[#0e1117] transition-colors duration-300">
              <CardHeader className="pb-3">
                <p className="text-[11px] font-medium tracking-[0.16em] uppercase text-blue-400 mb-1">INFO</p>
                <CardTitle className="text-[#f0f2ff] text-sm">Info Penting</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2 text-xs text-[#8892b0]">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>Maksimal <strong className="text-[#f0f2ff]/70">50 email</strong> per batch</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-[#8892b0]">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>Dikirim paralel (maks 5 concurrent)</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-[#8892b0]">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>Unverified: token baru otomatis 24 jam</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-[#8892b0]">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>Placeholder: {'{{name}}'} dan {'{{email}}'}</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-[#8892b0]">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>From: LuxTrade &lt;noreply@luxtradee.web.id&gt;</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="bg-[#0e1117] backdrop-blur-xl border border-white/[0.06] rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#f0f2ff] flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-400" />
              Konfirmasi Kirim Broadcast
            </DialogTitle>
            <DialogDescription className="text-[#8892b0]">
              Pastikan subject dan konten email sudah benar sebelum mengirim.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                <p className="text-[11px] text-[#8892b0] mb-1">Target</p>
                <p className="text-sm text-[#f0f2ff] font-medium">{currentTarget?.label}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                <p className="text-[11px] text-[#8892b0] mb-1">Jumlah Penerima</p>
                <p className="text-sm text-[#f0f2ff] font-medium">{recipientCount} user</p>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <p className="text-[11px] text-[#8892b0] mb-1">Subject</p>
              <p className="text-sm text-[#f0f2ff]/80 truncate">{subject}</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/[0.08] border border-blue-500/20">
              <p className="text-xs text-blue-300/70 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Email akan dikirim ke <strong className="text-blue-300">{recipientCount}</strong> user secara bersamaan. Tindakan ini tidak bisa dibatalkan.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button variant="ghost" className="text-[#8892b0] hover:text-[#f0f2ff] hover:bg-white/5">
                Batal
              </Button>
            </DialogClose>
            <Button
              onClick={handleSend}
              disabled={sending}
              className="bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-600 hover:to-cyan-500 text-white font-semibold rounded-xl"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Mengirim...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Ya, Kirim Sekarang
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color }: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  color: string
}) {
  return (
    <div className="bg-white/[0.02] hover:bg-white/[0.04] backdrop-blur-sm transition-colors duration-300 p-6">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-[#8892b0]">{label}</span>
      </div>
      <p className="text-2xl font-bold text-[#f0f2ff]">{value}</p>
    </div>
  )
}
