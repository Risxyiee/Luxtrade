'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import {
  Mail, Send, Loader2, Users, ShieldCheck, Crown, UserX,
  CheckCircle, XCircle, Clock, AlertTriangle, Eye, EyeOff,
  ArrowLeft, BarChart3, FileText, Megaphone, Settings,
  Code, Paintbrush, Vibrate, FlaskConical, ChevronDown,
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

const ReactQuill = dynamic(() => import('react-quill-new'), {
  ssr: false,
  loading: () => (
    <div className="h-64 bg-white/[0.03] border border-white/[0.08] rounded-lg flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
    </div>
  ),
})

const ADMIN_EMAIL = 'luxtradee@gmail.com'

// Quill toolbar modules
const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link', 'image'],
    [{ align: [] }],
    ['clean'],
  ],
}

const QUILL_FORMATS = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'color', 'background', 'list', 'link', 'image', 'align',
]

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

const BROADCAST_TEMPLATES: BroadcastTemplate[] = [
  {
    value: 'custom',
    label: 'Custom',
    icon: FileText,
    subject: '',
    body: '',
  },
  {
    value: 'verify-promo',
    label: 'Verifikasi + Promo PRO',
    icon: Crown,
    subject: '🎁 Verifikasi Akun & Dapat PRO Gratis 3 Bulan — LuxTrade',
    body: '', // Empty — uses server-side promo template
    promoCode: true,
  },
  {
    value: 'promo-pro',
    label: 'Promo PRO',
    icon: Crown,
    subject: '🔥 Promo Spesial: Upgrade ke PRO LuxTrade Sekarang!',
    body: `<h2 style="color: #f59e0b; margin-bottom: 16px;">Upgrade ke PRO & Raih Keuntungan Lebih Banyak!</h2>
<p style="color: #555770; line-height: 1.7; margin-bottom: 16px;">Halo {{name}},</p>
<p style="color: #555770; line-height: 1.7; margin-bottom: 16px;">Kami punya <strong>penawaran spesial</strong> buat kamu! Upgrade ke akun PRO LuxTrade sekarang dan nikmatin semua fitur premium:</p>
<ul style="color: #555770; line-height: 2; margin-bottom: 16px; padding-left: 20px;">
  <li>📊 Analisa AI yang lebih mendalam</li>
  <li>📈 Unlimited trading journal entries</li>
  <li>🎯 Personalized trading insights</li>
  <li>⚡ Priority support</li>
</ul>
<p style="color: #555770; line-height: 1.7; margin-bottom: 16px;">Jangan lewatkan kesempatan ini! Promo terbatas hanya untuk pengguna setia LuxTrade.</p>
<p style="margin-top: 20px;"><a href="https://luxtradee.web.id/dashboard" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #f59e0b, #d97706); color: white; text-decoration: none; border-radius: 12px; font-weight: 700;">Upgrade ke PRO Sekarang →</a></p>`,
  },
  {
    value: 'maintenance',
    label: 'Maintenance Notice',
    icon: Settings,
    subject: '🔧 Pemberitahuan Maintenance LuxTrade',
    body: `<h2 style="color: #dc2626; margin-bottom: 16px;">Pemeliharaan Sistem Terjadwal</h2>
<p style="color: #555770; line-height: 1.7; margin-bottom: 16px;">Halo {{name}},</p>
<p style="color: #555770; line-height: 1.7; margin-bottom: 16px;">Kami akan melakukan <strong>pemeliharaan sistem</strong> pada LuxTrade untuk meningkatkan performa dan keamanan layanan kami.</p>
<div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
  <p style="color: #92400e; margin: 0;"><strong>⏰ Waktu:</strong> [Tanggal dan jam maintenance]</p>
  <p style="color: #92400e; margin: 8px 0 0 0;"><strong>⏱️ Estimasi durasi:</strong> [Durasi maintenance]</p>
</div>
<p style="color: #555770; line-height: 1.7; margin-bottom: 16px;">Selama maintenance, beberapa fitur mungkin tidak tersedia sementara. Data kamu akan <strong>aman dan terlindungi</strong>.</p>
<p style="color: #555770; line-height: 1.7;">Terima kasih atas pengertiannya. 🙏</p>`,
  },
  {
    value: 'new-feature',
    label: 'New Feature',
    icon: Megaphone,
    subject: '🚀 Fitur Baru di LuxTrade!',
    body: `<h2 style="color: #059669; margin-bottom: 16px;">Fitur Baru Telah Hadir!</h2>
<p style="color: #555770; line-height: 1.7; margin-bottom: 16px;">Halo {{name}},</p>
<p style="color: #555770; line-height: 1.7; margin-bottom: 16px;">Kami dengan senang hati memperkenalkan <strong>fitur terbaru</strong> di LuxTrade!</p>
<div style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 20px; border-radius: 12px; margin-bottom: 16px;">
  <h3 style="color: #059669; margin: 0 0 12px 0;">✨ [Nama Fitur Baru]</h3>
  <p style="color: #555770; line-height: 1.7; margin: 0;">[Deskripsi singkat fitur baru dan manfaatnya untuk pengguna]</p>
</div>
<p style="color: #555770; line-height: 1.7; margin-bottom: 16px;">Coba fitur baru ini sekarang dan rasakan pengalaman trading yang lebih baik bersama LuxTrade!</p>
<p style="margin-top: 20px;"><a href="https://luxtradee.web.id/dashboard" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #f59e0b, #d97706); color: white; text-decoration: none; border-radius: 12px; font-weight: 700;">Coba Sekarang →</a></p>`,
  },
]

const TARGET_OPTIONS = [
  { value: 'unverified', label: 'Belum Verifikasi', icon: UserX, color: 'text-orange-400', badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  { value: 'verified', label: 'Sudah Verifikasi', icon: ShieldCheck, color: 'text-green-400', badge: 'bg-green-500/10 text-green-400 border-green-500/20' },
  { value: 'pro', label: 'User PRO', icon: Crown, color: 'text-amber-400', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  { value: 'free', label: 'User Free', icon: Users, color: 'text-purple-400', badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
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
  const [promoCode, setPromoCode] = useState('')
  const [dbSyncing, setDbSyncing] = useState(false)
  const [dbNotice, setDbNotice] = useState<string | null>(null)

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
        const res = await fetch('/api/admin/email-stats', {
          headers: { 'x-admin-email': ADMIN_EMAIL },
        })
        if (res.ok) {
          const data = await res.json()
          setStats(data)
          if (data.notice) {
            setDbNotice(data.notice)
          } else {
            setDbNotice(null)
          }
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      }
    }
    fetchStats()
  }, [isAdmin])

  // Sync database tables
  const syncDatabase = async () => {
    setDbSyncing(true)
    try {
      const res = await fetch('/api/admin/db-sync', {
        method: 'POST',
        headers: { 'x-admin-email': ADMIN_EMAIL },
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || 'Database sync berhasil!')
        setDbNotice(null)
        // Re-fetch stats after sync
        const statsRes = await fetch('/api/admin/email-stats', {
          headers: { 'x-admin-email': ADMIN_EMAIL },
        })
        if (statsRes.ok) {
          const statsData = await statsRes.json()
          setStats(statsData)
        }
      } else {
        toast.error(data.error || 'Gagal sync database', { duration: 5000 })
      }
    } catch (err) {
      toast.error('Gagal menghubungi server', { duration: 5000 })
    } finally {
      setDbSyncing(false)
    }
  }

  // Update default subject when target changes
  useEffect(() => {
    if (selectedTarget === 'unverified') {
      setSubject('Hei {{name}}, akun kamu belum diverifikasi nih 😅')
      setHtmlBody('')
      setPromoCode('')
    } else {
      if (selectedTemplate === 'custom') {
        setSubject('')
        setHtmlBody('')
        setPromoCode('')
      }
    }
    setResult(null)
  }, [selectedTarget, selectedTemplate])

  // Apply template
  const handleTemplateChange = (templateValue: string) => {
    setSelectedTemplate(templateValue)
    const tmpl = BROADCAST_TEMPLATES.find(t => t.value === templateValue)
    if (tmpl && templateValue !== 'custom') {
      setSubject(tmpl.subject)
      setHtmlBody(tmpl.body)
      // Auto-set target and promo code for verify-promo template
      if (tmpl.value === 'verify-promo') {
        setSelectedTarget('unverified')
        setPromoCode('TRADERCEPAT')
      }
    } else if (templateValue === 'custom') {
      setSubject('')
      setHtmlBody('')
      setPromoCode('')
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
      const res = await fetch(`/api/admin/email-broadcast?${params.toString()}`, {
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
      const res = await fetch('/api/admin/email-broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': ADMIN_EMAIL,
        },
        body: JSON.stringify({
          target: selectedTarget,
          subject,
          htmlBody,
          ...(promoCode ? { promoCode } : {}),
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setResult(data)
        toast.success(`Email terkirim! ${data.sent} berhasil, ${data.failed} gagal`)
        const statsRes = await fetch('/api/admin/email-stats', {
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
      <div className="min-h-screen bg-[#0a0612] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  if (!isAdmin) return null

  const currentTarget = TARGET_OPTIONS.find(t => t.value === selectedTarget)
  const recipientCount = stats ? (stats[currentTarget?.value as keyof EmailStats] as number) : 0
  const estimatedMinutes = Math.ceil(recipientCount / (5 * 10)) // ~10 emails/sec with 5 concurrent

  return (
    <div className="min-h-screen bg-[#0a0612]">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0d0a18]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/admin')}
            className="text-white/60 hover:text-white hover:bg-white/5"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </Button>
          <div className="h-6 w-px bg-white/10" />
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center border border-amber-500/20">
              <Mail className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Email Broadcast</h1>
              <p className="text-xs text-white/40">Kirim email massal ke user LuxTrade</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
        >
          {stats && (
            <>
              <StatCard label="Total User" value={stats.total} icon={Users} color="text-white" />
              <StatCard label="Belum Verifikasi" value={stats.unverified} icon={UserX} color="text-orange-400" />
              <StatCard label="Sudah Verifikasi" value={stats.verified} icon={ShieldCheck} color="text-green-400" />
              <StatCard label="User PRO" value={stats.pro} icon={Crown} color="text-amber-400" />
              <StatCard label="User Free" value={stats.free} icon={Users} color="text-purple-400" />
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
            <Card className="bg-[#1a0f2e]/50 border-white/[0.06] backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Send className="w-5 h-5 text-amber-400" />
                  Kirim Email Broadcast
                </CardTitle>
                <CardDescription className="text-white/40">
                  Pilih target user, tulis subject dan konten, lalu kirim
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Target Selection */}
                <div className="space-y-3">
                  <Label className="text-white/70 text-sm font-medium">Target Penerima</Label>
                  <Tabs value={selectedTarget} onValueChange={setSelectedTarget} className="w-full">
                    <TabsList className="w-full bg-white/[0.03] border border-white/[0.06] h-auto p-1 flex flex-wrap gap-1">
                      {TARGET_OPTIONS.map(opt => {
                        const Icon = opt.icon
                        return (
                          <TabsTrigger
                            key={opt.value}
                            value={opt.value}
                            className="flex-1 min-w-[120px] py-2 px-3 data-[state=active]:bg-white/[0.08] data-[state=active]:text-white text-white/50 rounded-md text-xs sm:text-sm transition-all"
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
                      <span className="text-white/40">
                        akan menerima email ini (maks 50/batch)
                        {estimatedMinutes > 0 && (
                          <span className="ml-1">· est. ~{estimatedMinutes} menit</span>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* Template Selection (non-unverified targets) */}
                {selectedTarget !== 'unverified' && (
                  <div className="space-y-2">
                    <Label className="text-white/70 text-sm font-medium">Template</Label>
                    <div className="relative">
                      <select
                        value={selectedTemplate}
                        onChange={(e) => handleTemplateChange(e.target.value)}
                        className="w-full appearance-none bg-white/[0.03] border border-white/[0.08] text-white text-sm rounded-lg px-3 py-2.5 pr-10 focus:outline-none focus:border-amber-500/40 focus:ring-amber-500/20"
                      >
                        {BROADCAST_TEMPLATES.map(tmpl => (
                          <option key={tmpl.value} value={tmpl.value} className="bg-[#1a0f2e] text-white">
                            {tmpl.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                    </div>
                  </div>
                )}

                {/* Subject */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="subject" className="text-white/70 text-sm font-medium">
                      Subject Email
                    </Label>
                    <span className="text-[11px] text-white/30">
                      {subject.length} karakter
                    </span>
                  </div>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder={selectedTarget === 'unverified' ? 'Hei {{name}}, akun kamu belum diverifikasi nih 😅' : 'Masukkan subject email...'}
                    className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/25 focus:border-amber-500/40 focus:ring-amber-500/20"
                  />
                  <p className="text-xs text-white/30">
                    Gunakan {'{{name}}'} dan {'{{email}}'} sebagai placeholder
                  </p>
                </div>

                {/* Rich Text Editor (non-unverified) */}
                {selectedTarget !== 'unverified' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-white/70 text-sm font-medium">
                        Konten Email
                      </Label>
                      <div className="flex items-center gap-2">
                        {/* Editor mode toggle */}
                        <div className="flex items-center bg-white/[0.03] border border-white/[0.06] rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => setEditorMode('visual')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all ${
                              editorMode === 'visual'
                                ? 'bg-white/[0.08] text-white'
                                : 'text-white/40 hover:text-white/60'
                            }`}
                          >
                            <Paintbrush className="w-3.5 h-3.5" />
                            Visual
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditorMode('html')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all ${
                              editorMode === 'html'
                                ? 'bg-white/[0.08] text-white'
                                : 'text-white/40 hover:text-white/60'
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
                          className="text-white/40 hover:text-white/70 text-xs h-8 px-2"
                        >
                          {showPreview ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                          {showPreview ? 'Tutup' : 'Preview'}
                        </Button>
                      </div>
                    </div>

                    {/* Quill Editor (visual mode) */}
                    {editorMode === 'visual' && (
                      <div className="email-editor-wrapper rounded-lg overflow-hidden border border-white/[0.08]">
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
                            color: #fbbf24 !important;
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
                            background: #1a0f2e !important;
                            border-color: rgba(255,255,255,0.1) !important;
                            border-radius: 8px !important;
                            padding: 4px !important;
                          }
                          .email-editor-wrapper .ql-snow .ql-picker-item {
                            color: rgba(255,255,255,0.6) !important;
                          }
                          .email-editor-wrapper .ql-snow .ql-picker-item:hover,
                          .email-editor-wrapper .ql-snow .ql-picker-item.ql-selected {
                            color: #fbbf24 !important;
                          }
                          .email-editor-wrapper .ql-snow .ql-active .ql-stroke {
                            stroke: #f59e0b !important;
                          }
                          .email-editor-wrapper .ql-snow .ql-active .ql-fill {
                            fill: #f59e0b !important;
                          }
                          .email-editor-wrapper .ql-snow .ql-active {
                            color: #f59e0b !important;
                          }
                          .email-editor-wrapper .ql-toolbar .ql-formats button:hover .ql-stroke {
                            stroke: #fbbf24 !important;
                          }
                          .email-editor-wrapper .ql-toolbar .ql-formats button:hover .ql-fill {
                            fill: #fbbf24 !important;
                          }
                          .email-editor-wrapper .ql-snow .ql-tooltip {
                            background: #1a0f2e !important;
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
                        <ReactQuill
                          theme="snow"
                          value={htmlBody}
                          onChange={setHtmlBody}
                          modules={QUILL_MODULES}
                          formats={QUILL_FORMATS}
                          placeholder="Tulis konten email broadcast..."
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
                        className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/25 focus:border-amber-500/40 focus:ring-amber-500/20 font-mono text-sm"
                      />
                    )}

                    {/* Character count */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-white/30">
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
                          className="border border-white/[0.06] rounded-lg overflow-hidden"
                        >
                          <div className="px-4 py-2 bg-white/[0.02] border-b border-white/[0.06] flex items-center justify-between">
                            <span className="text-xs text-white/40 font-medium">Preview Output</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-white/[0.02] border-white/[0.06] text-white/30">
                              Desktop
                            </Badge>
                          </div>
                          <div
                            className="p-4 bg-white/[0.01] text-white/80 text-sm max-h-80 overflow-y-auto prose prose-invert prose-sm max-w-none [&_a]:text-amber-400"
                            dangerouslySetInnerHTML={{
                              __html: htmlBody.replace(/\{\{name\}\}/g, 'John').replace(/\{\{email\}\}/g, 'john@example.com'),
                            }}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Promo Code Input — only for unverified target */}
                {selectedTarget === 'unverified' && (
                  <div className="space-y-2">
                    <Label className="text-white/70 text-sm font-medium">
                      Kode Promo (opsional — untuk template Verifikasi + Promo PRO)
                    </Label>
                    <Input
                      value={promoCode}
                      onChange={e => setPromoCode(e.target.value.toUpperCase())}
                      placeholder="Contoh: TRADERCEPAT"
                      className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/25 focus:border-amber-500/40 focus:ring-amber-500/20 font-mono tracking-wider"
                    />
                    {promoCode && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="border border-green-500/20 rounded-lg bg-green-500/[0.04] p-3"
                      >
                        <div className="flex items-start gap-2">
                          <Crown className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                          <div className="text-xs text-green-300/70">
                            <p className="font-medium text-green-300/80 mb-1">Template Verifikasi + Promo PRO</p>
                            <p>Email akan berisi link verifikasi + kode promo <strong className="text-green-300">{promoCode}</strong> untuk akses PRO gratis. Pastikan promo sudah aktif di database.</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Built-in Template Notice for Unverified */}
                {selectedTarget === 'unverified' && !promoCode && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border border-amber-500/20 rounded-lg bg-amber-500/[0.04] p-4"
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                      <div className="text-sm text-amber-200/70">
                        <p className="font-medium text-amber-300/80 mb-1">Template Otomatis</p>
                        <p>
                          Tanpa kode promo: sistem mengirim email reminder biasa.
                          <strong>Isi kode promo</strong> (misal: TRADERCEPAT) untuk mengirim email verifikasi
                          + tawaran PRO gratis sekaligus.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Test Email Button */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendTestEmail}
                    disabled={sendingTest || sending || !subject.trim()}
                    className="flex-1 sm:flex-none border-white/[0.08] text-white/70 hover:text-white hover:bg-white/[0.04]"
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
                    className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold py-6 text-base disabled:opacity-40 disabled:cursor-not-allowed"
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
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/[0.06] border border-green-500/20">
                          <CheckCircle className="w-5 h-5 text-green-400" />
                          <div>
                            <p className="text-green-400 font-semibold text-lg">{result.sent}</p>
                            <p className="text-green-300/50 text-xs">Berhasil Terkirim</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/[0.06] border border-red-500/20">
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
            <Card className="bg-[#1a0f2e]/50 border-white/[0.06] backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-amber-400" />
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
                          className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] space-y-2"
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
                    <Clock className="w-8 h-8 text-white/10 mx-auto mb-2" />
                    <p className="text-xs text-white/30">Belum ada riwayat broadcast</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="bg-[#1a0f2e]/50 border-white/[0.06] backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm">Info Penting</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2 text-xs text-white/40">
                  <span className="text-amber-400 mt-0.5">•</span>
                  <span>Maksimal <strong className="text-white/60">50 email</strong> per batch</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-white/40">
                  <span className="text-amber-400 mt-0.5">•</span>
                  <span>Dikirim paralel (maks 5 concurrent)</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-white/40">
                  <span className="text-amber-400 mt-0.5">•</span>
                  <span>Unverified: token baru otomatis 24 jam</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-white/40">
                  <span className="text-amber-400 mt-0.5">•</span>
                  <span>Placeholder: {'{{name}}'} dan {'{{email}}'}</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-white/40">
                  <span className="text-amber-400 mt-0.5">•</span>
                  <span>From: LuxTrade &lt;noreply@luxtradee.web.id&gt;</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="bg-[#1a0f2e] border-white/[0.08] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-amber-400" />
              Konfirmasi Kirim Broadcast
            </DialogTitle>
            <DialogDescription className="text-white/50">
              Pastikan subject dan konten email sudah benar sebelum mengirim.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <p className="text-[11px] text-white/40 mb-1">Target</p>
                <p className="text-sm text-white font-medium">{currentTarget?.label}</p>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <p className="text-[11px] text-white/40 mb-1">Jumlah Penerima</p>
                <p className="text-sm text-white font-medium">{recipientCount} user</p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <p className="text-[11px] text-white/40 mb-1">Subject</p>
              <p className="text-sm text-white/80 truncate">{subject}</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/[0.06] border border-amber-500/15">
              <p className="text-xs text-amber-300/70 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Email akan dikirim ke <strong className="text-amber-300">{recipientCount}</strong> user secara bersamaan. Tindakan ini tidak bisa dibatalkan.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button variant="ghost" className="text-white/60 hover:text-white hover:bg-white/5">
                Batal
              </Button>
            </DialogClose>
            <Button
              onClick={handleSend}
              disabled={sending}
              className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold"
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
    <Card className="bg-[#1a0f2e]/40 border-white/[0.05] backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className={`w-4 h-4 ${color}`} />
          <span className="text-xs text-white/40">{label}</span>
        </div>
        <p className="text-2xl font-bold text-white">{value}</p>
      </CardContent>
    </Card>
  )
}
