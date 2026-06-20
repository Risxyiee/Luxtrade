'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Mail, Send, Loader2, Users, ShieldCheck, Crown, UserX,
  CheckCircle, XCircle, Clock, AlertTriangle, Eye, EyeOff,
  ArrowLeft, BarChart3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

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
  const [result, setResult] = useState<{ sent: number; failed: number; errors: string[] } | null>(null)

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
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      }
    }
    fetchStats()
  }, [isAdmin])

  // Update default subject when target changes
  useEffect(() => {
    if (selectedTarget === 'unverified') {
      setSubject('Hei {{name}}, akun kamu belum diverifikasi nih 😅')
      setHtmlBody('')
    } else {
      setSubject('')
      setHtmlBody('')
    }
    setResult(null)
  }, [selectedTarget])

  const handleSend = async () => {
    if (!subject.trim()) {
      toast.error('Subject email wajib diisi')
      return
    }
    if (selectedTarget !== 'unverified' && !htmlBody.trim()) {
      toast.error('Konten email wajib diisi')
      return
    }

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
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setResult(data)
        toast.success(`Email terkirim! ${data.sent} berhasil, ${data.failed} gagal`)
        // Refresh stats
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

  return (
    <div className="min-h-screen bg-[#0a0612]">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0d0a18]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/')}
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
            className="lg:col-span-2"
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

                  {/* Show target count */}
                  {stats && currentTarget && (
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className={currentTarget.badge}>
                        {stats[currentTarget.value as keyof EmailStats] as number} user
                      </Badge>
                      <span className="text-white/40">akan menerima email ini (maks 50 per batch)</span>
                    </div>
                  )}
                </div>

                {/* Subject */}
                <div className="space-y-2">
                  <Label htmlFor="subject" className="text-white/70 text-sm font-medium">
                    Subject Email
                  </Label>
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

                {/* HTML Body (hidden for unverified) */}
                {selectedTarget !== 'unverified' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="htmlBody" className="text-white/70 text-sm font-medium">
                        Konten Email (HTML)
                      </Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPreview(!showPreview)}
                        className="text-white/40 hover:text-white/70 text-xs"
                      >
                        {showPreview ? <EyeOff className="w-3.5 h-3.5 mr-1.5" /> : <Eye className="w-3.5 h-3.5 mr-1.5" />}
                        {showPreview ? 'Tutup Preview' : 'Preview'}
                      </Button>
                    </div>
                    <Textarea
                      id="htmlBody"
                      value={htmlBody}
                      onChange={e => setHtmlBody(e.target.value)}
                      placeholder={`<h1>Halo {{name}}!</h1>\n<p>Ini adalah email broadcast dari LuxTrade...</p>\n<a href="https://luxtradee.web.id">Kunjungi LuxTrade</a>`}
                      rows={12}
                      className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/25 focus:border-amber-500/40 focus:ring-amber-500/20 font-mono text-sm"
                    />

                    {/* Preview */}
                    {showPreview && htmlBody && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="border border-white/[0.06] rounded-lg overflow-hidden"
                      >
                        <div className="px-4 py-2 bg-white/[0.02] border-b border-white/[0.06]">
                          <span className="text-xs text-white/40 font-medium">Preview Output</span>
                        </div>
                        <div
                          className="p-4 bg-white/[0.01] text-white/80 text-sm max-h-64 overflow-y-auto prose prose-invert prose-sm max-w-none [&_a]:text-amber-400"
                          dangerouslySetInnerHTML={{
                            __html: htmlBody.replace(/\{\{name\}\}/g, 'John').replace(/\{\{email\}\}/g, 'john@example.com'),
                          }}
                        />
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Built-in Template Notice for Unverified */}
                {selectedTarget === 'unverified' && (
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
                          Untuk target &quot;Belum Verifikasi&quot;, sistem akan otomatis mengirim email reminder dengan
                          link verifikasi baru yang berlaku 24 jam. Kamu cukup atur subject-nya saja.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Send Button */}
                <Button
                  onClick={handleSend}
                  disabled={sending || !subject.trim() || (selectedTarget !== 'unverified' && !htmlBody.trim())}
                  className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold py-6 text-base disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Sedang Mengirim...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" />
                      Kirim Sekarang
                    </>
                  )}
                </Button>

                {/* Result */}
                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
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
              </CardContent>
            </Card>
          </motion.div>

          {/* Sidebar: Recent Broadcasts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
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
            <Card className="bg-[#1a0f2e]/50 border-white/[0.06] backdrop-blur-sm mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm">Info Penting</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2 text-xs text-white/40">
                  <span className="text-amber-400 mt-0.5">•</span>
                  <span>Maksimal <strong className="text-white/60">50 email</strong> per batch untuk menghindari rate limit</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-white/40">
                  <span className="text-amber-400 mt-0.5">•</span>
                  <span>Email dikirim secara paralel (maks 5 concurrent)</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-white/40">
                  <span className="text-amber-400 mt-0.5">•</span>
                  <span>Untuk unverified: token baru dibuat otomatis berlaku 24 jam</span>
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
