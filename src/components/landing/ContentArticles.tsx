'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { BookOpen, ArrowRight, TrendingUp, AlertTriangle, Target, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Article {
  id: string
  title: string
  titleId: string
  excerpt: string
  excerptId: string
  icon: React.ReactNode
  category: string
  readTime: string
}

const articles: Article[] = [
  {
    id: 'avoid-drawdown-breach',
    title: 'How to Avoid Drawdown Breach in Prop Firm Challenges',
    titleId: 'Cara Menghindari Drawdown Breach di Challenge Prop Firm',
    excerpt: 'Learn the exact strategies top traders use to stay within 5% daily and 10% max drawdown limits. Includes risk management techniques and real-life examples.',
    excerptId: 'Pelajari strategi tepat yang digunakan trader top untuk tetap dalam batas drawdown harian 5% dan maksimal 10%. Termasuk teknik manajemen risiko dan contoh nyata.',
    icon: <AlertTriangle className="w-5 h-5" />,
    category: 'Risk Management',
    readTime: '8 min'
  },
  {
    id: 'pass-ftmo-challenge',
    title: 'Complete Guide to Passing FTMO Challenge on First Try',
    titleId: 'Panduan Lulus FTMO Challenge di Percobaan Pertama',
    excerpt: 'A step-by-step blueprint for passing the FTMO evaluation. From account setup to funded account, we cover everything you need to know.',
    excerptId: 'Blueprint langkah demi langkah untuk lulus evaluasi FTMO. Dari setup akun sampai akun funded, kami membahas semua yang perlu Anda ketahui.',
    icon: <Target className="w-5 h-5" />,
    category: 'Prop Firms',
    readTime: '12 min'
  },
  {
    id: 'emotional-discipline',
    title: 'Mastering Trading Psychology: Stop Revenge Trading',
    titleId: 'Menguasai Psikologi Trading: Berhenti Revenge Trading',
    excerpt: 'Revenge trading is the #1 killer of prop firm accounts. Discover how to identify emotional triggers and build a disciplined trading mindset.',
    excerptId: 'Revenge trading adalah pembunuh nomor satu akun prop firm. Temukan cara mengidentifikasi pemicu emosi dan membangun mindset trading yang terdisiplin.',
    icon: <TrendingUp className="w-5 h-5" />,
    category: 'Psychology',
    readTime: '10 min'
  },
  {
    id: 'setup-prioritization',
    title: 'Which Trading Setups Work Best for Prop Firms?',
    titleId: 'Setup Trading Mana yang Terbaik untuk Prop Firm?',
    excerpt: 'Not all setups are equal in prop firm challenges. We analyze which strategies consistently perform within strict drawdown limits.',
    excerptId: 'Tidak semua setup sama dalam challenge prop firm. Kami analisis strategi mana yang secara konsisten berperforma baik dalam batas drawdown yang ketat.',
    icon: <BookOpen className="w-5 h-5" />,
    category: 'Strategy',
    readTime: '9 min'
  },
  {
    id: 'revenge-patterns',
    title: 'Identifying and Breaking Revenge Trading Patterns',
    titleId: 'Mengidentifikasi dan Menghancurkan Pola Revenge Trading',
    excerpt: 'Use AI-powered analysis to detect revenge trading patterns in your journal. Learn practical techniques to break the cycle and protect your account.',
    excerptId: 'Gunakan analisis berbasis AI untuk mendeteksi pola revenge trading di jurnal Anda. Pelajari teknik praktis untuk menghancurkan siklus dan melindungi akun Anda.',
    icon: <AlertTriangle className="w-5 h-5" />,
    category: 'AI & Analytics',
    readTime: '7 min'
  },
  {
    id: 'daily-routine',
    title: 'Daily Routine of Successful Prop Firm Traders',
    titleId: 'Rutinitas Harian Trader Prop Firm Sukses',
    excerpt: 'What separates traders who consistently pass challenges from those who keep failing? Their daily routine. Build a winning pre-trade checklist.',
    excerptId: 'Apa yang membedakan trader yang konsisten lulus challenge dari yang terus gagal? Rutinitas harian mereka. Bangun checklist pra-trade yang menang.',
    icon: <Clock className="w-5 h-5" />,
    category: 'Lifestyle',
    readTime: '6 min'
  }
]

interface ContentArticlesProps {
  language?: 'id' | 'en'
}

export default function ContentArticles({ language = 'id' }: ContentArticlesProps) {
  const getArticleLink = (articleId: string) => {
    // For now, link to blog (if exists) or dashboard
    return `/dashboard`
  }

  return (
    <section className="py-20 bg-gradient-to-b from-[#0a0a12] to-[#050507]">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-400 text-sm font-mono">
            <BookOpen className="w-3 h-3" />
            {language === 'en' ? 'LEARNING HUB' : 'PUSTA BELAJAR'}
          </span>
          <h2 className="text-3xl md:text-4xl font-bold mt-6 mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-600">
            {language === 'en'
              ? 'Learn How to Pass Prop Firm Challenges'
              : 'Pelajari Cara Lulus Challenge Prop Firm'}
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            {language === 'en'
              ? 'In-depth guides and strategies to help you pass FTMO, TFT, MFF, and other prop firm evaluations consistently.'
              : 'Panduan mendalam dan strategi untuk membantu Anda lulus evaluasi FTMO, TFT, MFF, dan prop firm lain secara konsisten.'}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article, index) => (
            <motion.div
              key={article.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Link href={getArticleLink(article.id)}>
                <Card className="h-full bg-[#0a0a12]/60 backdrop-blur-xl border border-white/10 hover:border-blue-500/30 transition-colors group cursor-pointer">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                        {article.icon}
                        <span className="text-xs text-blue-400">{article.category}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {article.readTime}
                      </div>
                    </div>
                    <CardTitle className="text-lg leading-snug group-hover:text-blue-400 transition-colors">
                      {language === 'en' ? article.title : article.titleId}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      {language === 'en' ? article.excerpt : article.excerptId}
                    </p>
                    <div className="mt-4 flex items-center text-sm text-blue-400 group-hover:text-blue-300 transition-colors">
                      {language === 'en' ? 'Read Article' : 'Baca Artikel'}
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <Link href="/dashboard">
            <span className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 text-white font-medium rounded-xl hover:bg-white/10 border border-white/10 transition-colors">
              {language === 'en' ? 'View All Articles' : 'Lihat Semua Artikel'}
              <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </motion.div>
      </div>
    </section>
  )
}