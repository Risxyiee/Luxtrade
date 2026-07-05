'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { authFetch } from '@/lib/api-fetch'
import { CheckCircle, XCircle, Eye, ExternalLink, User, Clock, Shield, Loader2, Filter } from 'lucide-react'
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
  reviewedBy?: string | null
  user: {
    id: string
    email: string
    name?: string | null
    role: string
  }
}

export default function AdminSocialLinksPage() {
  const { language, t } = useLanguage()
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Status | 'ALL'>('ALL')
  const [selectedLink, setSelectedLink] = useState<SocialLink | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)

  const content = {
    title: language === 'id' ? 'Manajemen Link Sosial' : 'Social Links Management',
    subtitle: language === 'id'
      ? 'Setujui atau tolak pengajuan link sosial media dari pengguna'
      : 'Approve or reject social media link submissions from users',
    status: {
      PENDING: language === 'id' ? 'Menunggu' : 'Pending',
      APPROVED: language === 'id' ? 'Disetujui' : 'Approved',
      REJECTED: language === 'id' ? 'Ditolak' : 'Rejected',
      ALL: language === 'id' ? 'Semua' : 'All'
    },
    user: language === 'id' ? 'Pengguna' : 'User',
    platform: language === 'id' ? 'Platform' : 'Platform',
    submittedAt: language === 'id' ? 'Dikirim' : 'Submitted',
    reviewedAt: language === 'id' ? 'Direview' : 'Reviewed',
    reviewedBy: language === 'id' ? 'Direview oleh' : 'Reviewed by',
    rejectionReason: language === 'id' ? 'Alasan Penolakan' : 'Rejection Reason',
    approve: language === 'id' ? 'Setujui' : 'Approve',
    reject: language === 'id' ? 'Tolak' : 'Reject',
    view: language === 'id' ? 'Lihat' : 'View',
    visitLink: language === 'id' ? 'Kunjungi Link' : 'Visit Link',
    confirmReject: language === 'id' ? 'Konfirmasi Penolakan' : 'Confirm Rejection',
    rejectReasonPlaceholder: language === 'id'
      ? 'Jelaskan mengapa link ini ditolak...'
      : 'Explain why this link is being rejected...',
    cancel: language === 'id' ? 'Batal' : 'Cancel',
    confirm: language === 'id' ? 'Konfirmasi' : 'Confirm',
    success: {
      approved: language === 'id' ? 'Link berhasil disetujui' : 'Link approved successfully',
      rejected: language === 'id' ? 'Link berhasil ditolak' : 'Link rejected successfully',
      deleted: language === 'id' ? 'Link berhasil dihapus' : 'Link deleted successfully'
    },
    error: {
      load: language === 'id' ? 'Gagal memuat data' : 'Failed to load data',
      action: language === 'id' ? 'Gagal melakukan aksi' : 'Failed to perform action'
    },
    noResults: language === 'id' ? 'Tidak ada data link sosial' : 'No social links found'
  }

  // Fetch social links
  const fetchSocialLinks = async () => {
    try {
      setLoading(true)
      const url = filter === 'ALL'
        ? '/api/admin/social-links'
        : `/api/admin/social-links?status=${filter}`

      const response = await fetch(url, {
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
  }, [filter])

  // Handle approve
  const handleApprove = async (linkId: string) => {
    try {
      setProcessing(linkId)
      const response = await authFetch(`/api/admin/social-links/${linkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'approve' })
      })

      if (!response.ok) throw new Error('Failed to approve')

      toast.success(content.success.approved)
      fetchSocialLinks()
    } catch (error) {
      console.error('Error approving link:', error)
      toast.error(content.error.action)
    } finally {
      setProcessing(null)
    }
  }

  // Handle reject
  const handleReject = async () => {
    if (!selectedLink || !rejectReason.trim()) return

    try {
      setProcessing(selectedLink.id)
      const response = await authFetch(`/api/admin/social-links/${selectedLink.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'reject',
          rejectionReason: rejectReason
        })
      })

      if (!response.ok) throw new Error('Failed to reject')

      toast.success(content.success.rejected)
      setSelectedLink(null)
      setRejectReason('')
      fetchSocialLinks()
    } catch (error) {
      console.error('Error rejecting link:', error)
      toast.error(content.error.action)
    } finally {
      setProcessing(null)
    }
  }

  // Handle delete
  const handleDelete = async (linkId: string) => {
    if (!confirm(language === 'id' ? 'Hapus link ini?' : 'Delete this link?')) return

    try {
      setProcessing(linkId)
      const response = await authFetch(`/api/admin/social-links/${linkId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (!response.ok) throw new Error('Failed to delete')

      toast.success(content.success.deleted)
      fetchSocialLinks()
    } catch (error) {
      console.error('Error deleting link:', error)
      toast.error(content.error.action)
    } finally {
      setProcessing(null)
    }
  }

  // Get status badge color
  const getStatusBadge = (status: Status) => {
    switch (status) {
      case 'PENDING':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">{content.status.PENDING}</Badge>
      case 'APPROVED':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{content.status.APPROVED}</Badge>
      case 'REJECTED':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{content.status.REJECTED}</Badge>
    }
  }

  return (
    <div className="min-h-screen bg-[#0f051d] text-white p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-white to-purple-300 bg-clip-text text-transparent">
            {content.title}
          </h1>
        </div>
        <p className="text-white/60 text-lg">{content.subtitle}</p>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Filter */}
        <Card className="bg-[#1a1025] border border-purple-500/30 mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-white/70 mr-2">{language === 'id' ? 'Filter:' : 'Filter:'}</span>
              {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((status) => (
                <Button
                  key={status}
                  variant={filter === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(status)}
                  className={
                    filter === status
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                  }
                >
                  {content.status[status]}
                  {status !== 'ALL' && (
                    <span className="ml-1.5 text-xs opacity-70">
                      ({socialLinks.filter(l => l.status === status).length})
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Social Links List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : socialLinks.length === 0 ? (
          <Card className="bg-[#1a1025] border border-purple-500/30">
            <CardContent className="p-12 text-center">
              <p className="text-white/50">{content.noResults}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {socialLinks.map((link) => (
              <Card key={link.id} className="bg-[#1a1025] border border-purple-500/30">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left Side - User Info & Link Details */}
                    <div className="flex-1 space-y-3">
                      {/* User Info */}
                      <div className="flex items-center gap-2 text-sm">
                        <User className="w-4 h-4 text-purple-400" />
                        <span className="text-white/90 font-medium">
                          {link.user.name || link.user.email}
                        </span>
                        <span className="text-white/40">({link.user.email})</span>
                      </div>

                      {/* Platform & URL */}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="bg-purple-500/10 border-purple-500/30 text-purple-300">
                            {link.platform.toUpperCase()}
                          </Badge>
                          {link.username && (
                            <span className="text-sm text-white/60">@{link.username}</span>
                          )}
                        </div>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-1 hover:underline"
                        >
                          {link.url}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      {/* Metadata */}
                      <div className="flex items-center gap-4 text-xs text-white/50">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {content.submittedAt}: {new Date(link.createdAt).toLocaleDateString()}
                        </div>
                        {link.reviewedAt && (
                          <>
                            <span>•</span>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {content.reviewedAt}: {new Date(link.reviewedAt).toLocaleDateString()}
                            </div>
                          </>
                        )}
                        {link.reviewedBy && (
                          <>
                            <span>•</span>
                            <span>{content.reviewedBy}: {link.reviewedBy}</span>
                          </>
                        )}
                      </div>

                      {/* Rejection Reason */}
                      {link.status === 'REJECTED' && link.rejectionReason && (
                        <div className="mt-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                          <p className="text-xs text-red-400">
                            <strong>{content.rejectionReason}:</strong> {link.rejectionReason}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Right Side - Status & Actions */}
                    <div className="flex flex-col items-end gap-3">
                      {getStatusBadge(link.status)}

                      <div className="flex gap-2">
                        {link.status === 'PENDING' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleApprove(link.id)}
                              disabled={processing === link.id}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              {processing === link.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle className="w-4 h-4 mr-1" />
                              )}
                              {content.approve}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedLink(link)}
                              disabled={processing === link.id}
                              className="bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                            >
                              {processing === link.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <XCircle className="w-4 h-4 mr-1" />
                              )}
                              {content.reject}
                            </Button>
                          </>
                        )}
                        {link.status !== 'PENDING' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(link.id)}
                            disabled={processing === link.id}
                            className="bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                          >
                            {processing === link.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <XCircle className="w-4 h-4 mr-1" />
                            )}
                            {language === 'id' ? 'Hapus' : 'Delete'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Reject Dialog */}
      <Dialog open={!!selectedLink} onOpenChange={(open) => !open && setSelectedLink(null)}>
        <DialogContent className="bg-[#1a1025] border border-purple-500/30 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-400" />
              {content.confirmReject}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-white/5 rounded-lg">
              <p className="text-sm text-white/70">
                <strong>{content.platform}:</strong> {selectedLink?.platform}<br />
                <strong>URL:</strong> {selectedLink?.url}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rejectReason">{content.rejectionReason}</Label>
              <Textarea
                id="rejectReason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={content.rejectReasonPlaceholder}
                className="bg-[#0a0712] border-purple-900/30 text-white min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedLink(null)
                setRejectReason('')
              }}
              className="bg-white/5 border-white/10 text-white hover:bg-white/10"
            >
              {content.cancel}
            </Button>
            <Button
              onClick={handleReject}
              disabled={!rejectReason.trim() || processing === selectedLink?.id}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {processing === selectedLink?.id ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {content.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
