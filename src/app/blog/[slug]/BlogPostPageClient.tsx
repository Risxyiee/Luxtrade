'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowLeft, ArrowRight, Calendar, Clock, BookOpen, Share2,
  Bookmark, TrendingUp, CheckCircle, AlertCircle,
  Lightbulb, Target, Shield, Brain
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useLanguage } from '@/contexts/LanguageContext'
import LanguageSwitcher from '@/components/LanguageSwitcher'

interface BlogPostPageClientProps {
  slug: string
}

export default function BlogPostPageClient({ slug }: BlogPostPageClientProps) {
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
    author: isEnglish ? 'LuxTradee Team' : 'Tim LuxTradee',
    gradient: 'from-blue-500 to-cyan-600'
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
        title: 'How LuxTradee Makes Journaling Easy',
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
    conclusion: 'The journey to consistent profitability starts with awareness, and awareness starts with journaling. Whether you\'re using a notebook, spreadsheet, or a modern platform like LuxTradee, the key is consistency. Start today—your future profitable self will thank you.',
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
          'Analisis Kinerja: Tahu persis strategi mana yang berhasil dan mana yang tidak',
          'Akuntabilitas: Jujur pada diri sendiri tentang disiplin trading Anda'
        ]
      },
      {
        title: 'Apa yang Harus Dicatat dalam Jurnal',
        icon: BookOpen,
        points: [
          'Harga entry dan exit dengan timestamp',
          'Ukuran trade dan risiko per trade',
          'Kondisi pasar dan sesi (London, New York, Asia)',
          'Alasan di balik setup trade',
          'Kondisi emosional sebelum dan selama trade',
          'Hasil dan pelajaran yang dipetik'
        ]
      },
      {
        title: 'Proses Review 3 Langkah',
        icon: CheckCircle,
        points: [
          'Review Harian: Luangkan 5 menit setelah sesi trading untuk mereview trade hari itu',
          'Review Mingguan: Analisis pola, win rate, dan kesalahan terbesar minggu ini',
          'Review Bulanan: Evaluasi kinerja strategi keseluruhan dan sesuaikan'
        ]
      },
      {
        title: 'Kesalahan Journaling Umum yang Harus Dihindari',
        icon: AlertCircle,
        points: [
          'Tidak jujur tentang trade yang rugi',
          'Merekam hanya trade tapi tidak emosi',
          'Melewatkan entri jurnal di hari sibuk',
          'Tidak mereview entri masa lalu secara teratur',
          'Membuat entri terlalu singkat atau terlalu detail'
        ]
      },
      {
        title: 'Bagaimana LuxTradee Memudahkan Journaling',
        icon: Lightbulb,
        points: [
          'Deteksi dan solusi kesalahan berbasis AI',
          'Perhitungan dan chart kinerja otomatis',
          'Import trade satu klik dari MT4/MT5',
          'Ramah mobile untuk logging saat bepergian',
          'Insight cerdas berdasarkan pola trading Anda'
        ]
      }
    ],
    conclusion: 'Perjalanan menuju profitabilitas konsisten dimulai dengan kesadaran, dan kesadaran dimulai dengan journaling. Apakah Anda menggunakan buku catatan, spreadsheet, atau platform modern seperti LuxTradee, kuncinya adalah konsistensi. Mulai hari ini—diri Anda yang profitable di masa depan akan berterima kasih.',
    cta: 'Siap untuk mengubah trading Anda dengan journaling profesional?'
  }

  const relatedPosts = [
    {
      id: 1,
      title: isEnglish ? 'The Psychology of Losing Trades' : 'Psikologi Trade yang Rugi',
      excerpt: isEnglish ? 'Understanding why we hold onto losses...' : 'Memahami mengapa kita memegang kerugian...',
      date: 'Dec 10, 2024',
      readTime: '6 min'
    },
    {
      id: 2,
      title: isEnglish ? 'Building a Consistent Trading Routine' : 'Membangun Rutinitas Trading yang Konsisten',
      excerpt: isEnglish ? 'Creating habits that lead to success...' : 'Membuat kebiasaan yang mengarah ke sukses...',
      date: 'Dec 8, 2024',
      readTime: '7 min'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-50 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              <span className="font-bold text-xl bg-gradient-to-r from-primary to-cyan-600 bg-clip-text text-transparent">
                LuxTradee
              </span>
            </Link>
            <LanguageSwitcher />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className={`relative pt-24 pb-16 bg-gradient-to-br ${blogPost.gradient}`}>
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Link href="/blog" className="inline-flex items-center gap-2 text-white/90 hover:text-white mb-6 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              {isEnglish ? 'Back to Blog' : 'Kembali ke Blog'}
            </Link>

            <div className="flex flex-wrap gap-3 mb-4">
              <Badge className="bg-white/20 text-white hover:bg-white/30 border-white/30">
                {blogPost.category}
              </Badge>
              <div className="flex items-center gap-2 text-white/90">
                <Clock className="h-4 w-4" />
                <span className="text-sm">{blogPost.readTime}</span>
              </div>
              <div className="flex items-center gap-2 text-white/90">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">{blogPost.date}</span>
              </div>
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6 leading-tight">
              {blogPost.title}
            </h1>

            <div className="flex items-center gap-4 text-white/90">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">{blogPost.author}</p>
                <p className="text-sm text-white/80">{isEnglish ? 'Expert Trader' : 'Trader Ahli'}</p>
              </div>
            </div>
          </motion.div>
        </div>
      </header>

      {/* Content Section */}
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="prose prose-lg dark:prose-invert max-w-none"
        >
          <p className="text-xl text-slate-600 dark:text-slate-300 leading-relaxed mb-12">
            {content.intro}
          </p>

          {content.sections.map((section, index) => {
            const Icon = section.icon
            return (
              <Card key={index} className="mb-8 border-l-4 border-l-primary hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {section.title}
                    </h2>
                  </div>
                  <ul className="space-y-3">
                    {section.points.map((point, pointIndex) => (
                      <li key={pointIndex} className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-slate-700 dark:text-slate-300">{point}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )
          })}

          <div className="bg-gradient-to-r from-primary to-cyan-600 rounded-2xl p-8 text-white my-12">
            <Brain className="h-12 w-12 mb-4" />
            <h3 className="text-2xl font-bold mb-4">
              {isEnglish ? 'Key Takeaway' : 'Poin Utama'}
            </h3>
            <p className="text-lg leading-relaxed">
              {content.conclusion}
            </p>
          </div>

          <div className="text-center my-12">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              {content.cta}
            </h3>
            <Link href="/auth/signup">
              <Button size="lg" className="bg-gradient-to-r from-primary to-cyan-600 hover:from-primary/90 hover:to-cyan-600/90">
                {isEnglish ? 'Start Your Free Trial' : 'Mulai Trial Gratis Anda'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </article>

      {/* Related Posts */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-8">
          {isEnglish ? 'Related Articles' : 'Artikel Terkait'}
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {relatedPosts.map((post) => (
            <Card key={post.id} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  {post.title}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">{post.excerpt}</p>
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  <span>{post.date}</span>
                  <span>•</span>
                  <span>{post.readTime}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Share & Actions */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="flex flex-wrap gap-4 justify-center">
          <Button variant="outline" className="gap-2">
            <Share2 className="h-4 w-4" />
            {isEnglish ? 'Share' : 'Bagikan'}
          </Button>
          <Button variant="outline" className="gap-2">
            <Bookmark className="h-4 w-4" />
            {isEnglish ? 'Save' : 'Simpan'}
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl text-white">LuxTradee</span>
          </Link>
          <p className="text-sm">
            {isEnglish ? '© 2024 LuxTradee. All rights reserved.' : '© 2024 LuxTradee. Hak cipta dilindungi.'}
          </p>
        </div>
      </footer>
    </div>
  )
}