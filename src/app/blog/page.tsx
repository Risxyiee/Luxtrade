'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import {
  Calendar, Clock, ArrowRight, TrendingUp, Brain,
  Shield, Target, Zap, BookOpen, Eye
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useLanguage } from '@/contexts/LanguageContext'
import LanguageSwitcher from '@/components/LanguageSwitcher'

export default function BlogPage() {
  const { language, t } = useLanguage()
  const isEnglish = language === 'en'

  const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0 }
  }

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }

  const blogPosts = [
    {
      id: 1,
      slug: 'cara-menggunakan-jurnal-trading-untuk-menjadi-trader-konsisten',
      title: isEnglish
        ? 'How to Use a Trading Journal to Become a Consistently Profitable Trader'
        : 'Cara Menggunakan Jurnal Trading untuk Menjadi Trader yang Konsisten Profit',
      excerpt: isEnglish
        ? 'Discover the proven strategies that top traders use to analyze their trades, identify patterns, and eliminate costly mistakes. Learn how to transform your trading results through disciplined journaling.'
        : 'Temukan strategi terbukti yang digunakan trader top untuk menganalisis transaksi mereka, mengidentifikasi pola, dan menghilangkan kesalahan mahal. Pelajari cara mengubah hasil trading Anda melalui journaling yang disiplin.',
      category: isEnglish ? 'Trading Tips' : 'Tips Trading',
      readTime: isEnglish ? '8 min read' : '8 bacaan',
      date: 'December 2024',
      icon: BookOpen,
      gradient: 'from-purple-500 to-violet-600'
    },
    {
      id: 2,
      slug: '5-kesalahan-psikologi-trading-paling-umum',
      title: isEnglish
        ? '5 Most Common Trading Psychology Mistakes (And How to Fix Them)'
        : '5 Kesalahan Psikologi Trading Paling Umum (Dan Cara Memperbaikinya)',
      excerpt: isEnglish
        ? 'From overtrading to revenge trading, explore the psychological pitfalls that destroy trading accounts. Practical solutions to master your emotions and trade with discipline.'
        : 'Dari overtrading hingga revenge trading, telusuri jebakan psikologis yang menghancurkan akun trading. Solusi praktis untuk menguasai emosi Anda dan trading dengan disiplin.',
      category: isEnglish ? 'Psychology' : 'Psikologi',
      readTime: isEnglish ? '6 min read' : '6 bacaan',
      date: 'December 2024',
      icon: Brain,
      gradient: 'from-pink-500 to-rose-600'
    },
    {
      id: 3,
      slug: 'manajemen-risiko-trading-pemula',
      title: isEnglish
        ? 'Risk Management for Beginners: Protect Your Capital Like a Pro'
        : 'Manajemen Risiko untuk Pemula: Lindungi Modal Anda Seperti Pro',
      excerpt: isEnglish
        ? 'Learn the essential risk management rules every trader must know. Position sizing, stop loss strategies, and the 1% rule that keeps professional traders in the game.'
        : 'Pelajari aturan manajemen risiko esensial yang harus diketahui setiap trader. Penentuan ukuran posisi, strategi stop loss, dan aturan 1% yang menjaga trader profesional tetap dalam permainan.',
      category: isEnglish ? 'Risk Management' : 'Manajemen Risiko',
      readTime: isEnglish ? '7 min read' : '7 bacaan',
      date: 'December 2024',
      icon: Shield,
      gradient: 'from-emerald-500 to-teal-600'
    },
    {
      id: 4,
      slug: 'analisis-ai-dalam-trading-modern',
      title: isEnglish
        ? 'The Power of AI in Modern Trading: How Technology is Changing the Game'
        : 'Kekuatan AI dalam Trading Modern: Bagaimana Teknologi Mengubah Permainan',
      excerpt: isEnglish
        ? 'Explore how artificial intelligence is revolutionizing trading journals and analysis. From pattern recognition to predictive insights, discover the future of trading intelligence.'
        : 'Jelajahi bagaimana kecerdasan buatan merevolusi jurnal dan analisis trading. Dari pengenalan pola hingga wawasan prediktif, temukan masa depan kecerdasan trading.',
      category: isEnglish ? 'Technology' : 'Teknologi',
      readTime: isEnglish ? '10 min read' : '10 bacaan',
      date: 'December 2024',
      icon: Zap,
      gradient: 'from-amber-500 to-orange-600'
    },
    {
      id: 5,
      slug: 'membangun-strategi-trading-yang-teruji',
      title: isEnglish
        ? 'Building a Tested Trading Strategy: From Backtesting to Live Trading'
        : 'Membangun Strategi Trading yang Teruji: Dari Backtesting hingga Live Trading',
      excerpt: isEnglish
        ? 'Step-by-step guide to developing, testing, and implementing a profitable trading strategy. Learn backtesting techniques, optimization, and real-world application.'
        : 'Panduan langkah demi langkah untuk mengembangkan, menguji, dan mengimplementasikan strategi trading yang menguntungkan. Pelajari teknik backtesting, optimasi, dan aplikasi dunia nyata.',
      category: isEnglish ? 'Strategy' : 'Strategi',
      readTime: isEnglish ? '12 min read' : '12 bacaan',
      date: 'December 2024',
      icon: Target,
      gradient: 'from-blue-500 to-cyan-600'
    },
    {
      id: 6,
      slug: 'mengapa-95-persen-trader-gagal',
      title: isEnglish
        ? 'Why 95% of Traders Fail (And How to Be in the Top 5%)'
        : 'Mengapa 95% Trader Gagal (Dan Cara Menjadi di 5% Teratas)',
      excerpt: isEnglish
        ? 'The hard truth about trading failure and the path to success. Understand the common pitfalls, develop the right mindset, and build habits that separate winners from losers.'
        : 'Kebenaran pahit tentang kegagalan trading dan jalan menuju kesuksesan. Pahami jebakan umum, kembangkan mindset yang tepat, dan bangun kebiasaan yang membedakan pemenang dari pecundang.',
      category: isEnglish ? 'Mindset' : 'Mindset',
      readTime: isEnglish ? '9 min read' : '9 bacaan',
      date: 'December 2024',
      icon: TrendingUp,
      gradient: 'from-indigo-500 to-purple-600'
    }
  ]

  const categories = [
    { name: isEnglish ? 'All Posts' : 'Semua Artikel', count: 6 },
    { name: isEnglish ? 'Trading Tips' : 'Tips Trading', count: 1 },
    { name: isEnglish ? 'Psychology' : 'Psikologi', count: 1 },
    { name: isEnglish ? 'Risk Management' : 'Manajemen Risiko', count: 1 },
    { name: isEnglish ? 'Technology' : 'Teknologi', count: 1 },
    { name: isEnglish ? 'Strategy' : 'Strategi', count: 1 },
    { name: isEnglish ? 'Mindset' : 'Mindset', count: 1 }
  ]

  return (
    <div className="min-h-screen bg-[#0f051d] text-white overflow-x-hidden">
      {/* Partikel Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-10">
        <div className="absolute w-3 h-3 bg-purple-500/40 rounded-full animate-ping" style={{ top: '5%', left: '3%', animationDuration: '3s' }} />
        <div className="absolute w-2 h-2 bg-purple-400/50 rounded-full animate-pulse" style={{ top: '12%', left: '8%', animationDuration: '4s' }} />
        <div className="absolute w-4 h-4 bg-blue-500/30 rounded-full animate-ping" style={{ top: '8%', left: '15%', animationDuration: '3.5s' }} />
        <div className="absolute w-2 h-2 bg-purple-300/60 rounded-full animate-pulse" style={{ top: '18%', left: '20%', animationDuration: '2.5s' }} />
        <div className="absolute w-3 h-3 bg-purple-500/35 rounded-full animate-ping" style={{ top: '25%', left: '5%', animationDuration: '4.5s' }} />
        <div className="absolute w-2 h-2 bg-blue-400/40 rounded-full animate-pulse" style={{ top: '35%', left: '12%', animationDuration: '3s' }} />
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

            <div className="hidden md:flex items-center gap-8">
              {[
                { key: 'home', label: isEnglish ? 'Home' : 'Beranda', href: '/' },
                { key: 'features', label: isEnglish ? 'Features' : 'Fitur', href: '/#features' },
                { key: 'pricing', label: isEnglish ? 'Pricing' : 'Harga', href: '/#pricing' },
                { key: 'about', label: 'About', href: '/about' },
                { key: 'contact', label: isEnglish ? 'Contact' : 'Kontak', href: '/contact' }
              ].map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className="text-sm text-white/60 hover:text-white hover:text-purple-300 transition-all duration-300 font-medium relative group"
                >
                  {item.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 group-hover:w-full transition-all duration-300" />
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <Link href="/auth/login">
                <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10 hover:shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all duration-300 font-semibold backdrop-blur-sm">
                  {isEnglish ? 'Login' : 'Masuk'}
                </Button>
              </Link>
              <Link href="/auth/signup">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
                  <Button className="h-10 px-6 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white font-extrabold shadow-lg shadow-purple-500/30 hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-all duration-300 backdrop-blur-sm">
                    {isEnglish ? 'Sign Up' : 'Daftar'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </motion.div>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            <motion.div variants={fadeInUp} className="text-center mb-8">
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 mb-6">
                <BookOpen className="w-3.5 h-3.5 mr-2" />
                {isEnglish ? 'Trading Blog' : 'Blog Trading'}
              </Badge>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold mb-6 leading-tight tracking-tight">
                <span className="bg-gradient-to-r from-white to-purple-400 bg-clip-text text-transparent">
                  {isEnglish ? 'Trading Insights' : 'Wawasan Trading'}
                </span>
                <br />
                <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                  {isEnglish ? '& Strategies' : '& Strategi'}
                </span>
              </h1>
              <p className="text-xl sm:text-2xl text-white/60 max-w-3xl mx-auto mb-12 leading-relaxed font-light">
                {isEnglish
                  ? 'Expert tips, proven strategies, and actionable insights to help you become a consistently profitable trader.'
                  : 'Tips ahli, strategi terbukti, dan wawasan yang dapat ditindaklanjuti untuk membantu Anda menjadi trader yang konsisten profit.'}
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Blog Content */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar - Categories */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="lg:col-span-1"
            >
              <Card className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] p-6 sticky top-24">
                <h3 className="text-lg font-extrabold text-white mb-4 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-purple-400" />
                  {isEnglish ? 'Categories' : 'Kategori'}
                </h3>
                <div className="space-y-2">
                  {categories.map((cat, index) => (
                    <button
                      key={index}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-white/5 hover:bg-purple-500/20 hover:border-purple-500/30 border border-transparent text-left transition-all duration-300 group"
                    >
                      <span className="text-white/70 group-hover:text-white font-medium text-sm">{cat.name}</span>
                      <Badge variant="outline" className="text-xs border-white/10 text-white/50 group-hover:border-purple-500/30 group-hover:text-purple-300">
                        {cat.count}
                      </Badge>
                    </button>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* Blog Posts Grid */}
            <div className="lg:col-span-3">
              <motion.div
                initial="hidden"
                animate="visible"
                variants={staggerContainer}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                {blogPosts.map((post, index) => (
                  <motion.div
                    key={post.id}
                    variants={fadeInUp}
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Link href={`/blog/${post.slug}`}>
                      <Card className="h-full backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-purple-500/30 hover:shadow-[0_0_40px_rgba(139,92,246,0.2)] transition-all duration-300 overflow-hidden">
                        <div className={`p-6`}>
                          {/* Category Badge */}
                          <div className="flex items-center justify-between mb-4">
                            <Badge className={`bg-gradient-to-r ${post.gradient} text-white border-0 text-xs font-bold`}>
                              {post.category}
                            </Badge>
                            <div className="flex items-center gap-3 text-white/40 text-xs">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {post.date}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {post.readTime}
                              </span>
                            </div>
                          </div>

                          {/* Icon */}
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${post.gradient} flex items-center justify-center mb-4 shadow-lg`}>
                            <post.icon className="w-6 h-6 text-white" />
                          </div>

                          {/* Title */}
                          <h2 className="text-xl font-extrabold text-white mb-3 line-clamp-2 hover:text-purple-300 transition-colors">
                            {post.title}
                          </h2>

                          {/* Excerpt */}
                          <p className="text-white/60 text-sm leading-relaxed mb-4 line-clamp-3">
                            {post.excerpt}
                          </p>

                          {/* Read More */}
                          <div className="flex items-center gap-2 text-purple-400 text-sm font-semibold group-hover:gap-3 transition-all">
                            {isEnglish ? 'Read Article' : 'Baca Artikel'}
                            <ArrowRight className="w-4 h-4" />
                          </div>
                        </div>
                      </Card>
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent via-purple-900/10 to-transparent">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Card className="backdrop-blur-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/30 p-12 text-center">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-purple-500/30">
                  <BookOpen className="w-10 h-10 text-white" />
                </div>
              </div>
              <h2 className="text-4xl sm:text-5xl font-extrabold mb-6">
                <span className="text-white">{isEnglish ? 'Get Weekly' : 'Dapatkan'}</span>
                <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                  {isEnglish ? ' Trading Tips' : ' Tips Trading Mingguan'}
                </span>
              </h2>
              <p className="text-xl text-white/60 mb-8 max-w-2xl mx-auto leading-relaxed">
                {isEnglish
                  ? 'Join 50+ traders receiving our weekly newsletter with proven strategies, market insights, and trading psychology tips.'
                  : 'Bergabung dengan 50+ trader yang menerima newsletter mingguan kami dengan strategi terbukti, wawasan pasar, dan tips psikologi trading.'}
              </p>
              <Link href="/auth/signup">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
                  <Button className="h-14 px-8 text-lg bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white font-extrabold shadow-lg shadow-purple-500/30 hover:shadow-[0_0_40px_rgba(168,85,247,0.5)] transition-all duration-300 backdrop-blur-xl">
                    {isEnglish ? 'Subscribe for Free' : 'Berlangganan Gratis'}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </motion.div>
              </Link>
            </Card>
          </motion.div>
        </div>
      </section>

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
