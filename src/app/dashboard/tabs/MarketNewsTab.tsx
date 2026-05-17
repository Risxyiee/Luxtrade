'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Newspaper, RefreshCw, AlertTriangle, Zap, Sparkles, ExternalLink } from 'lucide-react'

// Interface
interface FullNewsItem {
  title: string
  source: string
  url: string
  snippet: string
  date: string
  type: 'high' | 'medium' | 'low'
}

interface MarketNewsTabProps {
  language: 'id' | 'en'
}

// Component
function MarketNewsTab({ language }: MarketNewsTabProps) {
  // News state
  const [news, setNews] = useState<FullNewsItem[]>([])
  const [newsLoading, setNewsLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<string>('')

  // Fetch news
  const fetchNews = useCallback(async () => {
    setNewsLoading(true)
    try {
      const res = await fetch('/api/news?format=full')
      if (res.ok) {
        const data = await res.json()
        setNews(data.news || [])
        setLastFetched(data.fetchedAt || '')
      }
    } catch { /* keep existing */ } finally { setNewsLoading(false) }
  }, [])

  useEffect(() => {
    fetchNews()
    const interval = setInterval(fetchNews, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchNews])

  // News filtering
  const highImpact = news.filter(n => n.type === 'high')
  const mediumImpact = news.filter(n => n.type === 'medium')
  const lowImpact = news.filter(n => n.type === 'low')
  const filtered = filter === 'all' ? news :
    filter === 'high' ? highImpact : filter === 'medium' ? mediumImpact : lowImpact

  const labels = {
    id: {
      newsTitle: 'Berita Pasar Forex',
      newsSub: 'Berita berdampak tinggi dari Investing.com untuk keputusan trading Anda',
      high: 'Dampak Tinggi', medium: 'Dampak Sedang', low: 'Dampak Rendah',
      all: 'Semua', noNews: 'Tidak ada berita untuk kategori ini',
      noNewsAll: 'Belum ada berita yang dimuat',
      refresh: 'Refresh', lastUpdated: 'Terakhir diperbarui',
      clickToRead: 'Klik untuk baca selengkapnya',
      source: 'Sumber', investingSource: 'Data dari Investing.com & sumber terpercaya',
    },
    en: {
      newsTitle: 'Forex Market News',
      newsSub: 'High-impact news from Investing.com for your trading decisions',
      high: 'High Impact', medium: 'Medium Impact', low: 'Low Impact',
      all: 'All', noNews: 'No news for this category',
      noNewsAll: 'No news loaded yet',
      refresh: 'Refresh', lastUpdated: 'Last updated',
      clickToRead: 'Click to read more',
      source: 'Source', investingSource: 'Data from Investing.com & trusted sources',
    }
  }

  const t = labels[language]

  const impactConfig = {
    high: { bg: 'bg-red-500/10 border-red-500/30', badge: 'bg-red-500/20 text-red-400', dot: 'bg-red-500', icon: AlertTriangle, label: t.high },
    medium: { bg: 'bg-amber-500/10 border-amber-500/30', badge: 'bg-amber-500/20 text-amber-400', dot: 'bg-amber-500', icon: Zap, label: t.medium },
    low: { bg: 'bg-emerald-500/10 border-emerald-500/30', badge: 'bg-emerald-500/20 text-emerald-400', dot: 'bg-emerald-500', icon: Sparkles, label: t.low },
  }

  return (
    <div className="space-y-6">
      {/* Source Badge */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] w-fit">
        <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
        <span className="text-xs text-gray-500">{t.investingSource}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-purple-400" />
            {t.newsTitle}
          </h2>
          <p className="text-sm text-gray-500 mt-1">{t.newsSub}</p>
        </div>
        <div className="flex items-center gap-3">
          {lastFetched && (
            <span className="text-xs text-gray-600 hidden sm:inline">
              {t.lastUpdated}: {new Date(lastFetched).toLocaleTimeString(language === 'id' ? 'id-ID' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={fetchNews} disabled={newsLoading} className="border-purple-900/30 hover:bg-purple-500/10">
            <RefreshCw className={`w-4 h-4 mr-1.5 ${newsLoading ? 'animate-spin' : ''}`} />
            {t.refresh}
          </Button>
        </div>
      </div>

      {/* Summary Badges */}
      {!newsLoading && news.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-medium text-red-400">{highImpact.length} {t.high}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-sm font-medium text-amber-400">{mediumImpact.length} {t.medium}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium text-emerald-400">{lowImpact.length} {t.low}</span>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'high', 'medium', 'low'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              filter === f
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'bg-white/[0.03] text-gray-400 border border-white/[0.06] hover:bg-white/[0.06] hover:text-gray-300'
            }`}
          >
            {f === 'all' ? t.all : impactConfig[f].label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {newsLoading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
          <span className="text-sm text-gray-500">{language === 'id' ? 'Mengambil berita dari Investing.com...' : 'Fetching news from Investing.com...'}</span>
        </div>
      )}

      {/* Empty */}
      {!newsLoading && filtered.length === 0 && (
        <div className="text-center py-16">
          <Newspaper className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">{filter === 'all' ? t.noNewsAll : t.noNews}</p>
        </div>
      )}

      {/* News Cards */}
      {!newsLoading && filtered.length > 0 && (
        <div className="grid gap-3">
          {filtered.map((item, index) => {
            const cfg = impactConfig[item.type]
            const Icon = cfg.icon
            const isExpanded = expandedId === `${item.url}-${index}`
            const isInvesting = item.source?.toLowerCase().includes('investing')
            return (
              <motion.a
                key={`${item.url}-${index}`}
                href={item.url || '#'}
                target={item.url ? '_blank' : undefined}
                rel={item.url ? 'noopener noreferrer' : undefined}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
                onClick={() => setExpandedId(isExpanded ? null : `${item.url}-${index}`)}
                className={`block rounded-xl border p-4 transition-all hover:scale-[1.005] ${isInvesting ? 'bg-purple-500/5 border-purple-500/20' : cfg.bg} ${!item.url ? 'pointer-events-none' : 'cursor-pointer'}`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <Icon className={`w-4 h-4 ${item.type === 'high' ? 'text-red-400' : item.type === 'medium' ? 'text-amber-400' : 'text-emerald-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <Badge variant="outline" className={`${cfg.badge} text-[10px] px-2 py-0 border-0`}>{cfg.label}</Badge>
                      <span className="text-[11px] text-gray-500 font-medium">{item.source}</span>
                      {isInvesting && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-medium">INVESTING</span>
                      )}
                      {item.date && (
                        <span className="text-[11px] text-gray-600">
                          • {new Date(item.date).toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                    <h3 className={`font-semibold text-sm leading-snug ${item.type === 'high' ? 'text-white' : 'text-gray-200'}`}>{item.title}</h3>
                    {item.snippet && (
                      <p className={`mt-2 text-xs leading-relaxed text-gray-400 transition-all ${isExpanded ? '' : 'line-clamp-2'}`}>{item.snippet}</p>
                    )}
                    {item.url && (
                      <span className="inline-flex items-center gap-1 mt-2 text-[11px] text-purple-400/70 hover:text-purple-400">
                        {t.clickToRead} <ExternalLink className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>
              </motion.a>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default MarketNewsTab
