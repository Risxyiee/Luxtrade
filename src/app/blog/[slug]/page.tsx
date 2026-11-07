'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowLeft, ArrowRight, Calendar, Clock, BookOpen, Eye,
  Bot, TrendingUp
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useLanguage } from '@/contexts/LanguageContext'
import LanguageSwitcher from '@/components/LanguageSwitcher'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DETAIL ARTIKEL BLOG — SEKARANG BACA ARTIKEL RIIL dari blog_posts
 * (via API /api/blog/posts/[slug] — HTML sudah di-sanitize server-side).
 * ═══════════════════════════════════════════════════════════════════════════
 *  - slug ketemu di DB  → render artikel riil Farhan (views, keyword, FAQ,
 *                          link internal, CTA signup)
 *  - slug salah satu 6
 *    artikel klasik     → konten statis lama (tetap bisa dibaca)
 *  - selain itu         → UI "artikel tidak ditemukan"
 * API gagal → fallback statis/notfound (degrade gracefully).
 * ═══════════════════════════════════════════════════════════════════════════
 */

interface RealPost {
  id: string
  slug: string
  title: string
  html: string
  excerpt: string
  meta_description: string
  keyword: string
  author: string
  created_at: string
  views: number
  readMinutes: number
  wordCount: number
}

const STATIC_SLUGS = new Set([
  'cara-menggunakan-jurnal-trading-untuk-menjadi-trader-konsisten',
  '5-kesalahan-psikologi-trading-paling-umum',
  'manajemen-risiko-trading-pemula',
  'analisis-ai-dalam-trading-modern',
  'membangun-strategi-trading-yang-teruji',
  'mengapa-95-persen-trader-gagal',
])

type PageState = 'loading' | 'real' | 'static' | 'notfound'

function formatDate(iso: string, lang: string): string {
  try {
    return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-US' : 'id-ID', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch {
    return ''
  }
}

export default function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = React.use(params) as { slug: string }
  const { language } = useLanguage()
  const isEnglish = language === 'en'

  const [state, setState] = useState<PageState>('loading')
  const [post, setPost] = useState<RealPost | null>(null)
  const [related, setRelated] = useState<Array<{ slug: string; title: string; keyword: string }>>([])

  useEffect(() => {
    let alive = true
    setState('loading')
    fetch(`/api/blog/posts/${encodeURIComponent(slug)}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(d => {
        if (!alive) return
        const p = d?.post
        if (p?.html) {
          setPost(p as RealPost)
          setState('real')
          fetch('/api/blog/posts')
            .then(r => (r.ok ? r.json() : null))
            .then(l => {
              if (!alive || !l?.posts) return
              setRelated(
                (l.posts as Array<{ slug: string; title: string; keyword: string }>)
                  .filter(x => x.slug !== p.slug)
                  .slice(0, 3),
              )
            })
            .catch(() => {})
        } else {
          setState(STATIC_SLUGS.has(slug) ? 'static' : 'notfound')
        }
      })
      .catch(() => { if (alive) setState(STATIC_SLUGS.has(slug) ? 'static' : 'notfound') })
    return () => { alive = false }
  }, [slug])

  // ── Konten statis klasik (fallback 6 artikel lama) ──
  const isEnglishStatic = isEnglish
  const staticPost = {
    title: isEnglishStatic
      ? 'How to Use a Trading Journal to Become a Consistently Profitable Trader'
      : 'Cara Menggunakan Jurnal Trading untuk Menjadi Trader yang Konsisten Profit',
    category: isEnglishStatic ? 'Trading Tips' : 'Tips Trading',
    readTime: isEnglishStatic ? '8 min read' : '8 bacaan',
    date: 'December 15, 2024',
    author: isEnglishStatic ? 'LuxTradee Team' : 'Tim LuxTradee',
  }

  const staticSections = isEnglishStatic
    ? [
        { title: 'Why Trading Journaling Matters', points: ['Pattern Recognition: Identify recurring mistakes and winning patterns in your trading', 'Emotional Tracking: Understand how emotions affect your decision-making', 'Performance Analysis: Know exactly which strategies work and which don\'t', 'Accountability: Keep yourself honest about your trading discipline'] },
        { title: 'What to Record in Your Journal', points: ['Entry and exit prices with timestamps', 'Trade size and risk per trade', 'Market conditions and session (London, New York, Asia)', 'Reasoning behind the trade setup', 'Emotional state before and during the trade', 'Outcome and lessons learned'] },
        { title: 'The 3-Step Review Process', points: ['Daily Review: Spend 5 minutes after each trading session reviewing that day\'s trades', 'Weekly Review: Analyze patterns, win rate, and biggest mistakes of the week', 'Monthly Review: Evaluate overall strategy performance and adjust accordingly'] },
        { title: 'Common Journaling Mistakes to Avoid', points: ['Not being honest about losing trades', 'Recording only trades but not emotions', 'Skipping journal entries on busy days', 'Not reviewing past entries regularly', 'Making entries too vague or detailed'] },
        { title: 'How LuxTradee Makes Journaling Easy', points: ['AI-powered mistake detection and solutions', 'Automatic performance calculations and charts', 'One-click trade import from MT4/MT5', 'Mobile-friendly for on-the-go logging', 'Smart insights based on your trading patterns'] },
      ]
    : [
        { title: 'Mengapa Journaling Trading Penting', points: ['Pengenalan Pola: Identifikasi kesalahan berulang dan pola kemenangan dalam trading Anda', 'Pelacakan Emosi: Pahami bagaimana emosi mempengaruhi pengambilan keputusan Anda', 'Analisis Performa: Tahu persis strategi mana yang berhasil dan mana yang tidak', 'Akuntabilitas: Jujurlah pada diri sendiri tentang disiplin trading Anda'] },
        { title: 'Apa yang Harus Dicatat dalam Jurnal', points: ['Harga masuk dan keluar dengan timestamp', 'Ukuran trade dan risiko per trade', 'Kondisi pasar dan sesi (London, New York, Asia)', 'Alasan di balik setup trade', 'Keadaan emosional sebelum dan selama trade', 'Hasil dan pelajaran yang dipetik'] },
        { title: 'Proses Review 3 Langkah', points: ['Review Harian: Luangkan 5 menit setelah setiap sesi trading untuk meninjau trade hari itu', 'Review Mingguan: Analisis pola, win rate, dan kesalahan terbesar minggu itu', 'Review Bulanan: Evaluasi performa strategi keseluruhan dan sesuaikan seperlunya'] },
        { title: 'Kesalahan Journaling Umum yang Harus Dihindari', points: ['Tidak jujur tentang trade yang kalah', 'Mencatat hanya trade tetapi bukan emosi', 'Melewatkan entri jurnal di hari sibuk', 'Tidak mereview entri masa lalu secara teratur', 'Membuat entri terlalu samar atau terlalu detail'] },
        { title: 'Cara LuxTradee Memudahkan Journaling', points: ['Deteksi kesalahan dan solusi bertenaga AI', 'Perhitungan dan grafik performa otomatis', 'Impor trade satu klik dari MT4/MT5', 'Ramah mobile untuk logging di mana saja', 'Wawasan cerdas berdasarkan pola trading Anda'] },
      ]
  const staticIntro = isEnglishStatic
    ? 'Every successful trader will tell you the same secret: journaling is not optional—it\'s essential. A trading journal is your roadmap to consistent profitability, your accountability partner, and your most powerful learning tool.'
    : 'Setiap trader sukses akan memberitahu Anda rahasia yang sama: journaling bukan opsional—ini esensial. Jurnal trading adalah peta jalan menuju profitabilitas konsisten, partner akuntabilitas Anda, dan alat pembelajaran paling kuat Anda.'
  const staticConclusion = isEnglishStatic
    ? 'The journey to consistent profitability starts with awareness, and awareness starts with journaling. Whether you\'re using a notebook, spreadsheet, or a modern platform like LuxTradee, the key is consistency. Start today—your future profitable self will thank you.'
    : 'Perjalanan menuju profitabilitas konsisten dimulai dengan kesadaran, dan kesadaran dimulai dengan journaling. Apakah Anda menggunakan buku catatan, spreadsheet, atau platform modern seperti LuxTradee, kuncinya adalah konsistensi. Mulai hari ini—diri Anda yang profitable di masa depan akan berterima kasih.'
  const staticCta = isEnglishStatic
    ? 'Ready to transform your trading with professional journaling?'
    : 'Siap untuk mengubah trading Anda dengan journaling profesional?'

  /* ── STYLE ARTIKEL RIIL (dangerouslySetInnerHTML — html sudah di-whitelist
     server-side; styling via arbitrary variants Tailwind, tanpa plugin prose) ── */
  const articleStyles = [
    '[&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:sm:text-3xl [&_h2]:font-extrabold [&_h2]:text-white',
    '[&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-cyan-300',
    '[&_h4]:mt-6 [&_h4]:mb-2 [&_h4]:text-lg [&_h4]:font-bold [&_h4]:text-white',
    '[&_p]:mb-4 [&_p]:leading-relaxed [&_p]:text-white/70 [&_p]:text-[15px]',
    '[&_ul]:mb-5 [&_ul]:space-y-2 [&_ul]:list-disc [&_ul]:pl-6',
    '[&_ol]:mb-5 [&_ol]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-6',
    '[&_li]:text-white/70 [&_li]:leading-relaxed [&_li]:text-[15px]',
    '[&_strong]:text-white [&_strong]:font-semibold',
    '[&_a]:text-cyan-300 [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-cyan-200',
    '[&_blockquote]:border-l-4 [&_blockquote]:border-cyan-400/50 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-white/80 [&_blockquote]:my-6',
    '[&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-cyan-200 [&_code]:text-sm',
    '[&_pre]:bg-white/5 [&_pre]:p-4 [&_pre]:rounded-xl [&_pre]:overflow-x-auto [&_pre]:my-5',
  ].join(' ')

  return (
    <div className="min-h-screen flex flex-col bg-[#0f051d] text-white overflow-x-hidden">
      {/* Partikel Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-10">
        <div className="absolute w-3 h-3 bg-blue-500/40 rounded-full animate-ping" style={{ top: '5%', left: '3%', animationDuration: '3s' }} />
        <div className="absolute w-2 h-2 bg-cyan-400/50 rounded-full animate-pulse" style={{ top: '12%', left: '8%', animationDuration: '4s' }} />
        <div className="absolute w-4 h-4 bg-blue-500/30 rounded-full animate-ping" style={{ top: '8%', left: '15%', animationDuration: '3.5s' }} />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0f051d]/80 border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="LuxTradee Logo"
                width={40}
                height={40}
                className="object-contain"
              />
              <div>
                <Link prefetch={false} href="/" className="text-xl font-extrabold bg-gradient-to-r from-white via-cyan-200 to-cyan-400 bg-clip-text text-transparent">
                  LuxTradee
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <Link prefetch={false} href="/blog">
                <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all duration-300 font-semibold backdrop-blur-sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {isEnglish ? 'Back to Blog' : 'Kembali ke Blog'}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ── LOADING ── */}
      {state === 'loading' && (
        <main className="flex-1 flex items-center justify-center pt-32 pb-20">
          <div className="flex flex-col items-center gap-4" aria-busy="true">
            <div className="w-10 h-10 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
            <p className="text-white/40 text-sm">{isEnglish ? 'Loading article…' : 'Memuat artikel…'}</p>
          </div>
        </main>
      )}

      {/* ── NOT FOUND ── */}
      {state === 'notfound' && (
        <main className="flex-1 flex items-center justify-center pt-32 pb-20 px-4">
          <Card className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] p-12 text-center max-w-md w-full">
            <BookOpen className="w-14 h-14 text-cyan-400/40 mx-auto mb-5" />
            <h1 className="text-2xl font-extrabold text-white mb-3">
              {isEnglish ? 'Article not found' : 'Artikel tidak ditemukan'}
            </h1>
            <p className="text-white/50 text-sm mb-8">
              {isEnglish
                ? 'The article may have been moved or is still being written by our AI team.'
                : 'Artikel mungkin dipindah atau sedang ditulis oleh tim AI kita.'}
            </p>
            <Link prefetch={false} href="/blog">
              <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {isEnglish ? 'Browse all articles' : 'Lihat semua artikel'}
              </Button>
            </Link>
          </Card>
        </main>
      )}

      {/* ── ARTIKEL RIIL (dari Farhan / blog_posts) ── */}
      {state === 'real' && post && (
        <main className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 flex-1">
          <div className="max-w-3xl mx-auto">
            <Link prefetch={false} href="/blog" className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 mb-6 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              {isEnglish ? 'Back to Blog' : 'Kembali ke Blog'}
            </Link>

            <Badge className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-0 mb-6">
              <Bot className="w-3 h-3 mr-1.5" />
              {post.keyword ? (post.keyword.length > 32 ? `${post.keyword.slice(0, 32)}…` : post.keyword) : (isEnglish ? 'AI Insight' : 'Insight AI')}
            </Badge>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-white to-cyan-400 bg-clip-text text-transparent">
                {post.title}
              </span>
            </h1>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-white/60 text-sm mb-8">
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {formatDate(post.created_at, language)}
              </span>
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {post.readMinutes} {isEnglish ? 'min read' : 'menit baca'}
              </span>
              <span className="flex items-center gap-2">
                <Bot className="w-4 h-4" />
                {post.author}
              </span>
              {post.views > 0 && (
                <span className="flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  {post.views} {isEnglish ? 'reads' : 'dibaca'}
                </span>
              )}
            </div>

            {post.meta_description && (
              <p className="text-lg text-white/80 leading-relaxed mb-10 border-l-4 border-cyan-400/50 pl-5 italic">
                {post.meta_description}
              </p>
            )}

            {/* Isi artikel — HTML sudah di-whitelist di API (tag aman saja) */}
            <article className={articleStyles} dangerouslySetInnerHTML={{ __html: post.html }} />

            {/* CTA */}
            <Card className="backdrop-blur-xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 p-8 sm:p-12 mt-14 text-center">
              <TrendingUp className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-4">
                {isEnglish ? 'Put insight into practice' : 'Praktikkan langsung insight-nya'}
              </h2>
              <p className="text-white/60 mb-8 max-w-xl mx-auto">
                {isEnglish
                  ? 'Track every XAUUSD trade with AI-powered journaling — free to start, PRO from Rp49.000/month.'
                  : 'Catat setiap trade XAUUSD dengan jurnal bertenaga AI — gratis mulai, PRO dari Rp49.000/bulan.'}
              </p>
              <Link prefetch={false} href="/auth/signup">
                <Button className="h-14 px-8 text-lg bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700 text-white font-extrabold shadow-lg shadow-emerald-500/30 hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] transition-all duration-300">
                  {isEnglish ? 'Start Free Today' : 'Mulai Gratis Sekarang'}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </Card>

            {/* Related */}
            {related.length > 0 && (
              <div className="mt-16">
                <h2 className="text-2xl font-extrabold text-white mb-8">
                  {isEnglish ? 'More Articles' : 'Artikel Lainnya'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {related.map(r => (
                    <Link prefetch={false} key={r.slug} href={`/blog/${r.slug}`}>
                      <Card className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] hover:border-cyan-400/40 hover:shadow-[0_0_30px_rgba(34,211,238,0.15)] transition-all duration-300 p-6 h-full">
                        <Badge className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-0 text-xs font-bold mb-4">
                          <Bot className="w-3 h-3 mr-1" />
                          {r.keyword ? (r.keyword.length > 24 ? `${r.keyword.slice(0, 24)}…` : r.keyword) : (isEnglish ? 'AI Insight' : 'Insight AI')}
                        </Badge>
                        <h3 className="text-lg font-extrabold text-white mb-2 hover:text-cyan-300 transition-colors">
                          {r.title}
                        </h3>
                        <div className="flex items-center gap-2 text-cyan-400 text-sm font-semibold">
                          {isEnglish ? 'Read More' : 'Baca Selengkapnya'}
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {/* ── ARTIKEL KLASIK STATIS (6 pustaka lama) ── */}
      {state === 'static' && (
        <main className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 flex-1">
          <div className="max-w-4xl mx-auto">
            <Link prefetch={false} href="/blog" className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 mb-6 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              {isEnglish ? 'Back to Blog' : 'Kembali ke Blog'}
            </Link>

            <Badge className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white border-0 mb-6">
              {staticPost.category}
            </Badge>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-white to-cyan-400 bg-clip-text text-transparent">
                {staticPost.title}
              </span>
            </h1>

            <div className="flex flex-wrap items-center gap-6 text-white/60 text-sm mb-8">
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {staticPost.date}
              </span>
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {staticPost.readTime}
              </span>
              <span className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                {staticPost.author}
              </span>
            </div>

            <p className="text-xl text-white/80 leading-relaxed mb-12">
              {staticIntro}
            </p>

            {staticSections.map((section) => (
              <div key={section.title} className="mb-12">
                <Card className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] p-8">
                  <h2 className="text-2xl font-extrabold text-white mb-6">
                    {section.title}
                  </h2>
                  <ul className="space-y-4">
                    {section.points.map((point, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0 mt-2" />
                        <span className="text-white/70 leading-relaxed">{point}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            ))}

            <Card className="backdrop-blur-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/30 p-8 mb-12">
              <h2 className="text-2xl font-extrabold text-white mb-4">
                {isEnglish ? 'Key Takeaway' : 'Poin Utama'}
              </h2>
              <p className="text-white/80 text-lg leading-relaxed">
                {staticConclusion}
              </p>
            </Card>

            <Card className="backdrop-blur-xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 p-8 sm:p-12 text-center">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-4">
                {staticCta}
              </h2>
              <p className="text-white/60 mb-8 max-w-2xl mx-auto">
                {isEnglish
                  ? 'Start your free trial today and join 50+ traders who are already using LuxTradee to improve their trading results.'
                  : 'Mulai trial gratis Anda hari ini dan bergabung dengan 50+ trader yang sudah menggunakan LuxTradee untuk meningkatkan hasil trading mereka.'}
              </p>
              <Link prefetch={false} href="/auth/signup">
                <Button className="h-14 px-8 text-lg bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700 text-white font-extrabold shadow-lg shadow-emerald-500/30 hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] transition-all duration-300">
                  {isEnglish ? 'Start Free Trial' : 'Mulai Gratis Sekarang'}
                  <TrendingUp className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </Card>
          </div>
        </main>
      )}

      {/* Footer */}
      <footer className="border-t border-white/[0.08] py-16 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <p className="text-white/40 text-sm font-medium">
              © 2024 LuxTradee. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
