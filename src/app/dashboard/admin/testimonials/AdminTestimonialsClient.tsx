'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Star, Check, X, Trash2, Pin, PinOff, Shield, ShieldOff,
  RefreshCw, Eye, Clock, CheckCircle2, XCircle, Award,
  FileCheck, ChevronDown, ArrowLeft, Search
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface Testimonial {
  id: string
  user_name: string
  user_email: string | null
  rating: number
  text: string
  role: string | null
  profile_image_url: string | null
  is_verified: boolean
  is_featured: boolean
  status: string
  trades_logged: number
  prop_firms_passed: number
  created_at: string
  updated_at: string
}

interface Counts {
  total: number
  pending: number
  approved: number
  rejected: number
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected'

export default function AdminTestimonialsClient() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([])
  const [counts, setCounts] = useState<Counts>({ total: 0, pending: 0, approved: 0, rejected: 0 })
  const [filter, setFilter] = useState<StatusFilter>('pending')
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  const fetchTestimonials = useCallback(async () => {
    setIsLoading(true)
    try {
      const statusParam = filter === 'all' ? '' : `&status=${filter}`
      const res = await fetch(`/api/admin/testimonials?limit=100${statusParam}`)
      const data = await res.json()
      if (data.success) {
        setTestimonials(data.testimonials)
        setCounts(data.counts)
      }
    } catch (err) {
      console.error('Failed to fetch testimonials:', err)
    } finally {
      setIsLoading(false)
    }
  }, [filter])

  useEffect(() => { fetchTestimonials() }, [fetchTestimonials])

  const handleAction = async (id: string, action: string) => {
    setActionLoading(id)
    try {
      const res = await fetch('/api/admin/testimonials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      const data = await res.json()
      if (data.success) {
        // Update the local state
        setTestimonials(prev => prev.map(t =>
          t.id === id ? { ...t, ...data.testimonial } : t
        ))
        // Refresh counts
        fetchTestimonials()
      }
    } catch (err) {
      console.error('Action failed:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus testimoni ini? Aksi ini tidak bisa dibatalkan.')) return
    setActionLoading(id)
    try {
      const res = await fetch(`/api/admin/testimonials?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setTestimonials(prev => prev.filter(t => t.id !== id))
        fetchTestimonials()
      }
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const filteredTestimonials = testimonials.filter(t => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      t.user_name?.toLowerCase().includes(q) ||
      t.text?.toLowerCase().includes(q) ||
      t.role?.toLowerCase().includes(q) ||
      t.user_email?.toLowerCase().includes(q)
    )
  })

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"><Clock className="w-3 h-3" />PENDING</span>
      case 'approved':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20"><CheckCircle2 className="w-3 h-3" />APPROVED</span>
      case 'rejected':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20"><XCircle className="w-3 h-3" />REJECTED</span>
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-500/10 text-gray-400">{status}</span>
    }
  }

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#0a0a12]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/dashboard/admin" className="p-2 rounded-lg hover:bg-white/5 transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Award className="w-6 h-6 text-cyan-400" />
                Manajemen Testimoni
              </h1>
              <p className="text-sm text-gray-400 mt-1">Kelola testimoni pengguna — approve, reject, feature, atau hapus</p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            {[
              { label: 'Total', value: counts.total, color: 'text-white', bg: 'bg-white/5' },
              { label: 'Pending', value: counts.pending, color: 'text-yellow-400', bg: 'bg-yellow-500/5' },
              { label: 'Approved', value: counts.approved, color: 'text-green-400', bg: 'bg-green-500/5' },
              { label: 'Rejected', value: counts.rejected, color: 'text-red-400', bg: 'bg-red-500/5' },
            ].map(stat => (
              <div key={stat.label} className={`${stat.bg} border border-white/10 rounded-xl px-4 py-3`}>
                <p className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
            {(['all', 'pending', 'approved', 'rejected'] as StatusFilter[]).map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  filter === s
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {s === 'all' ? 'Semua' : s.charAt(0).toUpperCase() + s.slice(1)}
                {s === 'pending' && counts.pending > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px]">{counts.pending}</span>
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, email, atau teks..."
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/30"
            />
          </div>

          {/* Refresh */}
          <button
            onClick={fetchTestimonials}
            className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Testimonials List */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredTestimonials.length === 0 ? (
          <div className="text-center py-20">
            <Award className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">
              {filter === 'pending' ? 'Tidak ada testimoni yang menunggu review 🎉' : 'Tidak ada testimoni ditemukan'}
            </p>
          </div>
        ) : (
          <AnimatePresence>
            <div className="space-y-4">
              {filteredTestimonials.map(t => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-[#0a0a12] border border-white/10 rounded-xl p-5 hover:border-white/15 transition-all"
                >
                  <div className="flex flex-col lg:flex-row gap-4">
                    {/* Left: Content */}
                    <div className="flex-1 min-w-0">
                      {/* Top Row: Status + Badges */}
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        {statusBadge(t.status)}
                        {t.is_featured && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Pin className="w-3 h-3" />FEATURED
                          </span>
                        )}
                        {t.is_verified && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <Shield className="w-3 h-3" />VERIFIED
                          </span>
                        )}
                        {t.prop_firms_passed > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Award className="w-3 h-3" />{t.prop_firms_passed} Prop Firm{t.prop_firms_passed > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      {/* Stars */}
                      <div className="flex items-center gap-1 mb-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`w-4 h-4 ${i < t.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}`} />
                        ))}
                      </div>

                      {/* Quote */}
                      <p className="text-sm text-gray-300 leading-relaxed mb-3 line-clamp-4">
                        &ldquo;{t.text}&rdquo;
                      </p>

                      {/* Author Info */}
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                          {t.user_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{t.user_name}</p>
                          <p className="text-xs text-gray-500">
                            {t.role || 'Trader'}
                            {t.trades_logged > 0 && ` · ${t.trades_logged} trades`}
                          </p>
                        </div>
                        {t.profile_image_url && (
                          <button
                            onClick={() => setPreviewImage(t.profile_image_url)}
                            className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-400/40 transition-colors"
                          >
                            <FileCheck className="w-3 h-3 text-emerald-400" />
                            <span className="text-[10px] text-emerald-400 font-medium">Sertifikat</span>
                            <Eye className="w-3 h-3 text-emerald-400" />
                          </button>
                        )}
                      </div>

                      {/* Meta */}
                      <p className="text-[10px] text-gray-600 mt-2">
                        {new Date(t.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                        {t.user_email && ` · ${t.user_email}`}
                      </p>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex lg:flex-col gap-2 flex-shrink-0">
                      {t.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleAction(t.id, 'approve')}
                            disabled={actionLoading === t.id}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs"
                          >
                            <Check className="w-3 h-3 mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction(t.id, 'reject')}
                            disabled={actionLoading === t.id}
                            className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs"
                          >
                            <X className="w-3 h-3 mr-1" /> Reject
                          </Button>
                        </>
                      )}
                      {t.status === 'rejected' && (
                        <Button
                          size="sm"
                          onClick={() => handleAction(t.id, 'approve')}
                          disabled={actionLoading === t.id}
                          className="bg-green-600 hover:bg-green-700 text-white text-xs"
                        >
                          <Check className="w-3 h-3 mr-1" /> Approve
                        </Button>
                      )}
                      {t.status === 'approved' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAction(t.id, 'reject')}
                          disabled={actionLoading === t.id}
                          className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs"
                        >
                          <X className="w-3 h-3 mr-1" /> Reject
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction(t.id, t.is_featured ? 'unfeature' : 'feature')}
                        disabled={actionLoading === t.id}
                        className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs"
                      >
                        {t.is_featured ? <PinOff className="w-3 h-3 mr-1" /> : <Pin className="w-3 h-3 mr-1" />}
                        {t.is_featured ? 'Unfeature' : 'Feature'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction(t.id, t.is_verified ? 'unverify' : 'verify')}
                        disabled={actionLoading === t.id}
                        className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 text-xs"
                      >
                        {t.is_verified ? <ShieldOff className="w-3 h-3 mr-1" /> : <Shield className="w-3 h-3 mr-1" />}
                        {t.is_verified ? 'Unverify' : 'Verify'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(t.id)}
                        disabled={actionLoading === t.id}
                        className="border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs"
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> Hapus
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>

      {/* Certificate Image Preview Modal */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setPreviewImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-2xl w-full bg-[#0a0a12] border border-white/10 rounded-xl p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-400" />
                  Bukti Sertifikat ProFirm
                </h3>
                <button
                  onClick={() => setPreviewImage(null)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <img
                src={previewImage}
                alt="Certificate"
                className="w-full rounded-lg object-contain max-h-[70vh]"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
