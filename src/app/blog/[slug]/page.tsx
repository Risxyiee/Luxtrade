'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowLeft, Calendar, Clock, BookOpen, Share2,
  Bookmark, TrendingUp, CheckCircle, AlertCircle,
  Lightbulb, Target, Shield, Brain
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useLanguage } from '@/contexts/LanguageContext'
import LanguageSwitcher from '@/components/LanguageSwitcher'

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const { language } = useLanguage()
  const isEnglish = language === 'en'

  // Sample blog post data (in production, this would be fetched from database/API)
  const blogPost = {
    title: isEnglish
      ? 'How to Use a Trading Journal to Become a Consistently Profitable Trader'
      : 'Cara Menggunakan Jurnal Trading untuk Menjadi Trader yang Konsisten Profit',
    category: isEnglish ? 'Trading Tips' : 'Tips Trading',
    readTime: isEnglish ? '8 min read' : '8 bacaan',
    date: 'December 15, 2024',
    author: isEnglish ? 'LuxTrade Team' : 'Tim LuxTrade',
    gradient: 'from-purple-500 to-violet-600'
  }

  const content = isEnglish ? {
    intro: 'Every successful trader will tell you the same secret: journaling is not optional—it\'s essential. A trading journal is your roadmap to consistent profitability, your accountability partner, and your most powerful learning tool.',
    sections: [
      {
        title: 'Why Trading Journaling Matters',
        icon: Target,
        points: [
          'Pattern Recognition: Identify recurring mistakes and winning patterns in your trading',
          'Emotional Tracking: Understand how emotions affect your decision-making',
          'Performance Analysis: Know exactly which strategies work and which don\'t',
          'Accountability: Keep yourself honest about your trading discipline'
        ]
      },
      {
        title: 'What to Record in Your Journal',
        icon: BookOpen,
        points: [
          'Entry and exit prices with timestamps',
          'Trade size and risk per trade',
          'Market conditions and session (London, New York, Asia)',
          'Reasoning behind the trade setup',
          'Emotional state before and during the trade',
          'Outcome and lessons learned'
        ]
      },
      {
        title: 'The 3-Step Review Process',
        icon: CheckCircle,
        points: [
          'Daily Review: Spend 5 minutes after each trading session reviewing that day\'s trades',
          'Weekly Review: Analyze patterns, win rate, and biggest mistakes of the week',
          'Monthly Review: Evaluate overall strategy performance and adjust accordingly'
        ]
      },
      {
        title: 'Common Journaling Mistakes to Avoid',
        icon: AlertCircle,
        points: [
          'Not being honest about losing trades',
          'Recording only trades but not emotions',
          'Skipping journal entries on busy days',
          'Not reviewing past entries regularly',
          'Making entries too vague or detailed'
        ]
      },
      {
        title: 'How LuxTrade Makes Journaling Easy',
        icon: Lightbulb,
        points: [
          'AI-powered mistake detection and solutions',
          'Automatic performance calculations and charts',
          'One-click trade import from MT4/MT5',
          'Mobile-friendly for on-the-go logging',
          'Smart insights based on your trading patterns'
        ]
      }
    ],
    conclusion: 'The journey to consistent profitability starts with awareness, and awareness starts with journaling. Whether you\'re using a notebook, spreadsheet, or a modern platform like LuxTrade, the key is consistency. Start today—your future profitable self will thank you.',
    cta: 'Ready to transform your trading with professional journaling?'
  } : {
    intro: 'Setiap trader sukses akan memberitahu Anda rahasia yang sama: journaling bukan opsional—ini esensial. Jurnal trading adalah peta jalan menuju profitabilitas konsisten, partner akuntabilitas Anda, dan alat pembelajaran paling kuat Anda.',
    sections: [
      {
        title: 'Mengapa Journaling Trading Penting',
        icon: Target,
        points: [
          'Pengenalan Pola: Identifikasi kesalahan berulang dan pola kemenangan dalam trading Anda',
          'Pelacakan Emosi: Pahami bagaimana emosi mempengaruhi pengambilan keputusan Anda',
          'Analisis Performa: Tahu persis strategi mana yang berhasil dan mana yang tidak',
          'Akuntabilitas: Jujurlah pada diri sendiri tentang disiplin trading Anda'
        ]
      },
      {
        title: 'Apa yang Harus Dicatat dalam Jurnal',
        icon: BookOpen,
        points: [
          'Harga masuk dan keluar dengan timestamp',
          'Ukuran trade dan risiko per trade',
          'Kondisi pasar dan sesi (London, New York, Asia)',
          'Alasan di balik setup trade',
          'Keadaan emosional sebelum dan selama trade',
          'Hasil dan pelajaran yang dipetik'
        ]
      },
      {
        title: 'Proses Review 3 Langkah',
        icon: CheckCircle,
        points: [
          'Review Harian: Luangkan 5 menit setelah setiap sesi trading untuk meninjau trade hari itu',
          'Review Mingguan: Analisis pola, win rate, dan kesalahan terbesar minggu itu',
          'Review Bulanan: Evaluasi performa strategi keseluruhan dan sesuaikan sesuai kebutuhan'
        ]
      },
      {
        title: 'Kesalahan Journaling Umum yang Harus Dihindari',
        icon: AlertCircle,
        points: [
          'Tidak jujur tentang trade yang kalah',
          'Mencatat hanya trade tetapi bukan emosi',
          'Melewatkan entri jurnal di hari sibuk',
          'Tidak mereview entri masa lalu secara teratur',
          'Membuat entri terlalu samar atau terlalu detail'
        ]
      },
      {
        title: 'Cara LuxTrade Memudahkan Journaling',
        icon: Lightbulb,
        points: [
          'Deteksi kesalahan dan solusi bertenaga AI',
          'Perhitungan dan grafik performa otomatis',
          'Impor trade satu klik dari MT4/MT5',
          'Ramah mobile untuk logging di mana saja',
          'Wawasan cerdas berdasarkan pola trading Anda'
        ]
      }
    ],
    conclusion: 'Perjalanan menuju profitabilitas konsisten dimulai dengan kesadaran, dan kesadaran dimulai dengan journaling. Apakah Anda menggunakan buku catatan, spreadsheet, atau platform modern seperti LuxTrade, kuncinya adalah konsistensi. Mulai hari ini—diri Anda yang profitable di masa depan akan berterima kasih.',
    cta: 'Siap untuk mengubah trading Anda dengan journaling profesional?'
  }

  const relatedPosts = [
    {
      id: 2,
      title: isEnglish
        ? '5 Most Common Trading Psychology Mistakes'
        : '5 Kesalahan Psikologi Trading Paling Umum',
      category: isEnglish ? 'Psychology' : 'Psikologi',
      gradient: 'from-pink-500 to-rose-600'
    },
    {
      id: 3,
      title: isEnglish
        ? 'Risk Management for Beginners'
        : 'Manajemen Risiko untuk Pemula',
      category: isEnglish ? 'Risk Management' : 'Manajemen Risiko',
      gradient: 'from-emerald-500 to-teal-600'
    }
  ]

  return (
    <div className="min-h-screen bg-[#0f051d] text-white overflow-x-hidden">
      {/* Partikel Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-10">
        <div className="absolute w-3 h-3 bg-purple-500/40 rounded-full animate-ping" style={{ top: '5%', left: '3%', animationDuration: '3s' }} />
        <div className="absolute w-2 h-2 bg-purple-400/50 rounded-full animate-pulse" style={{ top: '12%', left: '8%', animationDuration: '4s' }} />
        <div className="absolute w-4 h-4 bg-blue-500/30 rounded-full animate-ping" style={{ top: '8%', left: '15%', animationDuration: '3.5s' }} />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0f051d]/80 border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="LuxTrade Logo"
                width={40}
                height={40}
                className="rounded-xl shadow-lg"
              />
              <div>
                <Link href="/" className="text-xl font-extrabold bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
                  LuxTrade
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <Link href="/blog">
                <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10 hover:shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all duration-300 font-semibold backdrop-blur-sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {isEnglish ? 'Back to Blog' : 'Kembali ke Blog'}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Blog Post Content */}
      <article className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Link href="/blog" className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 mb-6 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              {isEnglish ? 'Back to Blog' : 'Kembali ke Blog'}
            </Link>

            <Badge className={`bg-gradient-to-r ${blogPost.gradient} text-white border-0 mb-6`}>
              {blogPost.category}
            </Badge>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-white to-purple-400 bg-clip-text text-transparent">
                {blogPost.title}
              </span>
            </h1>

            <div className="flex flex-wrap items-center gap-6 text-white/60 text-sm mb-8">
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {blogPost.date}
              </span>
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {blogPost.readTime}
              </span>
              <span className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                {blogPost.author}
              </span>
            </div>

            <div className="flex items-center gap-3 mb-12">
              <Button variant="outline" className="border-white/10 text-white/60 hover:text-white hover:bg-white/5">
                <Share2 className="w-4 h-4 mr-2" />
                {isEnglish ? 'Share' : 'Bagikan'}
              </Button>
              <Button variant="outline" className="border-white/10 text-white/60 hover:text-white hover:bg-white/5">
                <Bookmark className="w-4 h-4 mr-2" />
                {isEnglish ? 'Save' : 'Simpan'}
              </Button>
            </div>
          </motion.div>

          {/* Featured Image Placeholder */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-12 rounded-2xl overflow-hidden bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 h-80 flex items-center justify-center"
          >
            <div className="text-center">
              <TrendingUp className="w-20 h-20 text-purple-400/50 mx-auto mb-4" />
              <p className="text-white/40 text-sm">
                {isEnglish ? 'Trading Journal Concept' : 'Konsep Jurnal Trading'}
              </p>
            </div>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="prose prose-invert max-w-none"
          >
            {/* Introduction */}
            <p className="text-xl text-white/80 leading-relaxed mb-12">
              {content.intro}
            </p>

            {/* Sections */}
            {content.sections.map((section, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
                className="mb-12"
              >
                <Card className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${blogPost.gradient} flex items-center justify-center shadow-lg`}>
                      <section.icon className="w-6 h-6 text-white" />
                    </div>
                    <h2 className="text-2xl font-extrabold text-white">
                      {section.title}
                    </h2>
                  </div>
                  <ul className="space-y-4">
                    {section.points.map((point, pointIndex) => (
                      <li key={pointIndex} className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span className="text-white/70 leading-relaxed">{point}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </motion.div>
            ))}

            {/* Conclusion */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.8 }}
              className="mb-12"
            >
              <Card className="backdrop-blur-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/30 p-8">
                <h3 className="text-2xl font-extrabold text-white mb-4 flex items-center gap-3">
                  <Brain className="w-6 h-6 text-purple-400" />
                  {isEnglish ? 'Key Takeaway' : 'Poin Utama'}
                </h3>
                <p className="text-white/80 text-lg leading-relaxed">
                  {content.conclusion}
                </p>
              </Card>
            </motion.div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.9 }}
              className="text-center"
            >
              <Card className="backdrop-blur-xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 p-12">
                <h3 className="text-3xl font-extrabold text-white mb-4">
                  {content.cta}
                </h3>
                <p className="text-white/60 mb-8 max-w-2xl mx-auto">
                  {isEnglish
                    ? 'Start your free trial today and join 50+ traders who are already using LuxTrade to improve their trading results.'
                    : 'Mulai trial gratis Anda hari ini dan bergabung dengan 50+ trader yang sudah menggunakan LuxTrade untuk meningkatkan hasil trading mereka.'}
                </p>
                <Link href="/auth/signup">
                  <Button className="h-14 px-8 text-lg bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700 text-white font-extrabold shadow-lg shadow-emerald-500/30 hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] transition-all duration-300">
                    {isEnglish ? 'Start Free Trial' : 'Mulai Gratis Sekarang'}
                    <TrendingUp className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </Card>
            </motion.div>
          </motion.div>

          {/* Related Posts */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1 }}
            className="mt-16"
          >
            <h3 className="text-2xl font-extrabold text-white mb-8">
              {isEnglish ? 'Related Articles' : 'Artikel Terkait'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {relatedPosts.map((post) => (
                <Link key={post.id} href="/blog">
                  <Card className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-purple-500/30 hover:shadow-[0_0_30px_rgba(139,92,246,0.2)] transition-all duration-300 p-6">
                    <Badge className={`bg-gradient-to-r ${post.gradient} text-white border-0 mb-4`}>
                      {post.category}
                    </Badge>
                    <h4 className="text-lg font-extrabold text-white mb-2 hover:text-purple-300 transition-colors">
                      {post.title}
                    </h4>
                    <div className="flex items-center gap-2 text-purple-400 text-sm font-semibold">
                      {isEnglish ? 'Read More' : 'Baca Selengkapnya'}
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </motion.div>
        </div>
      </article>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] py-16 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <p className="text-white/40 text-sm font-medium">
              © 2024 LuxTrade. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
