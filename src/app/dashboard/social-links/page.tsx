'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Link2, Plus, ExternalLink, Loader2, Clock, CheckCircle, XCircle, AlertCircle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

type Status = 'PENDING' | 'APPROVED' | 'REJECTED'

interface SocialLink {
  id: string
  platform: string
  url: string
  username?: string | null
  status: Status
  rejectionReason?: string | null
  createdAt: string
  reviewedAt?: string | null
}

const PLATFORMS = [
  'instagram',
  'twitter',
  'youtube',
  'tiktok',
  'linkedin',
  'facebook',
  'telegram',
  'discord'
] as const

export default function SocialLinksPage() {
  const { language, t } = useLanguage()
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    platform: '',
    url: '',
    username: ''
  })

  const content = {
    title: language === 'id' ? 'Link Sosial Media' : 'Social Media Links',
    subtitle: language === 'id'
      ? 'Kelola tautan sosial media Anda dan minta persetujuan admin'
      : 'Manage your social media links and request admin approval',
    addNew: language === 'id' ? 'Tambah Link Baru' : 'Add New Link',
    myLinks: language === 'id' ? 'Link Saya' : 'My Links',
    platform: language === 'id' ? 'Platform' : 'Platform',
    url: language === 'id' ? 'URL Link' : 'Link URL',
    username: language === 'id' ? 'Username (Opsional)' : 'Username (Optional)',
    selectPlatform: language === 'id' ? 'Pilih platform' : 'Select platform',
    platformPlaceholder: language === 'id' ? 'Pilih platform sosial media' : 'Select social media platform',
    urlPlaceholder: language === 'id' ? 'https://...' : 'https://...',
    usernamePlaceholder: language === 'id' ? '@username' : '@username',
    submit: language === 'id' ? 'Kirim untuk Persetujuan' : 'Submit for Approval',
    submitting: language === 'id' ? 'Mengirim...' : 'Submitting...',
    status: {
      PENDING: language === 'id' ? 'Menunggu Persetujuan' : 'Pending Approval',
      APPROVED: language === 'id' ? 'Disetujui' : 'Approved',
      REJECTED: language === 'id' ? 'Ditolak' : 'Rejected'
    },
    submittedAt: language === 'id' ? 'Dikirim pada' : 'Submitted on',
    rejectionReason: language === 'id' ? 'Alasan Penolakan' : 'Rejection Reason',
    visitLink: language === 'id' ? 'Kunjungi' : 'Visit',
    delete: language === 'id' ? 'Hapus' : 'Delete',
    confirmDelete: language === 'id' ? 'Hapus link ini?' : 'Delete this link?',
    success: {
      submitted: language === 'id' ? 'Link berhasil dikirim untuk persetujuan' : 'Link submitted for approval successfully',
      deleted: language === 'id' ? 'Link berhasil dihapus' : 'Link deleted successfully'
    },
    error: {
      load: language === 'id' ? 'Gagal memuat link' : 'Failed to load links',
      submit: language === 'id' ? 'Gagal mengirim link' : 'Failed to submit link',
      delete: language === 'id' ? 'Gagal menghapus link' : 'Failed to delete link',
      invalidUrl: language === 'id' ? 'URL tidak valid' : 'Invalid URL'
    },
    noLinks: language === 'id' ? 'Belum ada link sosial media' : 'No social media links yet',
    noLinksHint: language === 'id'
      ? 'Tambahkan link sosial media Anda dan kirim untuk persetujuan admin'
      : 'Add your social media links and submit for admin approval'
  }

  // Fetch social links
  const fetchSocialLinks = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/social-links', {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch social links')
      }

      const data = await response.json()
      setSocialLinks(data.data || [])
    } catch (error) {
      console.error('Error fetching social links:', error)
      toast.error(content.error.load)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSocialLinks()
  }, [])

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.platform || !formData.url) {
      toast.error(language === 'id' ? 'Mohon lengkapi semua field yang diperlukan' : 'Please fill in all required fields')
      return
    }

    // Validate URL
    try {
      new URL(formData.url)
    } catch (e) {
      toast.error(content.error.invalidUrl)
      return
    }

    try {
      setSubmitting(true)
      const response = await fetch('/api/social-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          platform: formData.platform,
          url: formData.url,
          username: formData.username || null
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit')
      }

      toast.success(content.success.submitted)

      // Reset form
      setFormData({ platform: '', url: '', username: '' })

      // Refresh list
      fetchSocialLinks()
    } catch (error: any) {
      console.error('Error submitting social link:', error)
      toast.error(error.message || content.error.submit)
    } finally {
      setSubmitting(false)
    }
  }

  // Handle delete
  const handleDelete = async (linkId: string) => {
    if (!confirm(content.confirmDelete)) return

    try {
      const response = await fetch(`/api/social-links/${linkId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (!response.ok) throw new Error('Failed to delete')

      toast.success(content.success.deleted)
      fetchSocialLinks()
    } catch (error) {
      console.error('Error deleting link:', error)
      toast.error(content.error.delete)
    }
  }

  // Get status badge
  const getStatusBadge = (status: Status) => {
    switch (status) {
      case 'PENDING':
        return (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
            <Clock className="w-3 h-3 mr-1" />
            {content.status.PENDING}
          </Badge>
        )
      case 'APPROVED':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            {content.status.APPROVED}
          </Badge>
        )
      case 'REJECTED':
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <XCircle className="w-3 h-3 mr-1" />
            {content.status.REJECTED}
          </Badge>
        )
    }
  }

  return (
    <div className="min-h-screen bg-[#0f051d] text-white p-6">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600">
            <Link2 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-white to-purple-300 bg-clip-text text-transparent">
            {content.title}
          </h1>
        </div>
        <p className="text-white/60 text-lg">{content.subtitle}</p>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Add New Link Form */}
        <Card className="bg-[#1a1025] border border-purple-500/30">
          <CardHeader className="bg-gradient-to-r from-purple-500/10 to-violet-500/10 border-b border-purple-500/30">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Plus className="w-5 h-5 text-purple-400" />
              {content.addNew}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Platform Selection */}
              <div className="space-y-2">
                <Label className="text-white/90 font-medium">{content.platform} *</Label>
                <Select
                  value={formData.platform}
                  onValueChange={(value) => setFormData({ ...formData, platform: value })}
                >
                  <SelectTrigger className="bg-[#0a0712] border-purple-900/30 text-white h-12">
                    <SelectValue placeholder={content.selectPlatform} />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0f0b18] border-purple-900/30">
                    {PLATFORMS.map((platform) => (
                      <SelectItem key={platform} value={platform} className="capitalize">
                        {platform}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* URL Input */}
              <div className="space-y-2">
                <Label className="text-white/90 font-medium">{content.url} *</Label>
                <Input
                  type="url"
                  placeholder={content.urlPlaceholder}
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="bg-[#0a0712] border-purple-900/30 text-white h-12 placeholder:text-white/30"
                  required
                />
              </div>

              {/* Username Input */}
              <div className="space-y-2">
                <Label className="text-white/90 font-medium">{content.username}</Label>
                <Input
                  type="text"
                  placeholder={content.usernamePlaceholder}
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="bg-[#0a0712] border-purple-900/30 text-white h-12 placeholder:text-white/30"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={submitting || !formData.platform || !formData.url}
                className="w-full h-12 bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white font-semibold"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {content.submitting}
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    {content.submit}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* My Links List */}
        <Card className="bg-[#1a1025] border border-purple-500/30">
          <CardHeader className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-b border-purple-500/30">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Link2 className="w-5 h-5 text-emerald-400" />
              {content.myLinks}
              <Badge className="ml-auto bg-purple-500/20 text-purple-400 border-purple-500/30">
                {socialLinks.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
              </div>
            ) : socialLinks.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-white/30 mx-auto mb-4" />
                <p className="text-white/50 mb-2">{content.noLinks}</p>
                <p className="text-sm text-white/30">{content.noLinksHint}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {socialLinks.map((link) => (
                  <div
                    key={link.id}
                    className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.08] hover:border-purple-500/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Left Side - Link Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="bg-purple-500/10 border-purple-500/30 text-purple-300 capitalize">
                            {link.platform}
                          </Badge>
                          {getStatusBadge(link.status)}
                        </div>

                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-1 hover:underline truncate"
                        >
                          {link.url}
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>

                        {link.username && (
                          <p className="text-sm text-white/60 mt-1">@{link.username}</p>
                        )}

                        <div className="flex items-center gap-2 mt-2 text-xs text-white/40">
                          <Clock className="w-3 h-3" />
                          {content.submittedAt} {new Date(link.createdAt).toLocaleDateString()}
                          {link.reviewedAt && (
                            <>
                              <span>•</span>
                              <span>{new Date(link.reviewedAt).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>

                        {/* Rejection Reason */}
                        {link.status === 'REJECTED' && link.rejectionReason && (
                          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <p className="text-xs text-red-400">
                              <strong>{content.rejectionReason}:</strong> {link.rejectionReason}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Right Side - Actions */}
                      <div className="flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(link.id)}
                          className="bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
