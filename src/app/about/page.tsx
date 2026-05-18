'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import {
  Target, Zap, Shield, Globe, Rocket, Users,
  Heart, Award, TrendingUp, CheckCircle, Star,
  ArrowRight, Calendar, Mail, MessageCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useLanguage } from '@/contexts/LanguageContext'
import LanguageSwitcher from '@/components/LanguageSwitcher'

export default function AboutPage() {
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

  const values = [
    {
      icon: Shield,
      title: isEnglish ? 'Trust First' : 'Kepercayaan Utama',
      description: isEnglish
        ? 'Your data security and privacy are our top priority. Bank-grade encryption and zero data sharing with third parties.'
        : 'Keamanan dan privasi data Anda adalah prioritas utama kami. Enkripsi tingkat bank dan tanpa berbagi data ke pihak ketiga.'
    },
    {
      icon: Zap,
      title: isEnglish ? 'Continuous Innovation' : 'Inovasi Berkelanjutan',
      description: isEnglish
        ? 'We constantly improve our platform with new features based on trader feedback and market needs.'
        : 'Kami terus memperbaiki platform dengan fitur baru berdasarkan masukan trader dan kebutuhan pasar.'
    },
    {
      icon: Users,
      title: isEnglish ? 'Community Driven' : 'Didorong Komunitas',
      description: isEnglish
        ? 'Built by traders, for traders. Our community shapes the future of LuxTrade.'
        : 'Dibuat oleh trader, untuk trader. Komunitas kami membentuk masa depan LuxTrade.'
    },
    {
      icon: Heart,
      title: isEnglish ? 'Trader Success' : 'Kesuksesan Trader',
      description: isEnglish
        ? 'Your success is our success. We provide tools and insights to help you become a consistently profitable trader.'
        : 'Kesuksesan Anda adalah kesuksesan kami. Kami menyediakan alat dan wawasan untuk membantu Anda menjadi trader yang konsisten profit.'
    }
  ]

  const milestones = [
    {
      year: '2024',
      title: isEnglish ? 'LuxTrade Founded' : 'LuxTrade Didirikan',
      description: isEnglish
        ? 'Started with a simple mission: help traders improve through data-driven journaling and AI insights.'
        : 'Dimulai dengan misi sederhana: membantu trader meningkat melalui journaling berbasis data dan wawasan AI.'
    },
    {
      year: 'Q1 2024',
      title: isEnglish ? 'Beta Launch' : 'Peluncuran Beta',
      description: isEnglish
        ? 'Launched beta version with core features: trade logging, basic analytics, and AI-powered insights.'
        : 'Meluncurkan versi beta dengan fitur inti: logging transaksi, analisis dasar, dan wawasan bertenaga AI.'
    },
    {
      year: 'Q2 2024',
      title: isEnglish ? 'Official Launch' : 'Peluncuran Resmi',
      description: isEnglish
        ? 'Official public launch with Elite PRO and Lifetime Ultra plans, supporting Indonesian and English traders.'
        : 'Peluncuran publik resmi dengan paket Elite PRO dan Lifetime Ultra, mendukung trader Indonesia dan Inggris.'
    },
    {
      year: 'Q3 2024',
      title: isEnglish ? 'Community Growth' : 'Pertumbuhan Komunitas',
      description: isEnglish
        ? 'Reached 50+ active traders and built a supportive community on Telegram, Instagram, and TikTok.'
        : 'Mencapai 50+ trader aktif dan membangun komunitas yang suportif di Telegram, Instagram, dan TikTok.'
    },
    {
      year: 'Future',
      title: isEnglish ? 'Global Expansion' : 'Ekspansi Global',
      description: isEnglish
        ? 'Expanding to support more languages, more brokers, and building mobile apps for iOS and Android.'
        : 'Mengembangkan dukungan lebih banyak bahasa, broker lebih banyak, dan membangun aplikasi mobile untuk iOS dan Android.'
    }
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
        <div className="absolute w-3 h-3 bg-purple-500/35 rounded-full animate-ping" style={{ top: '50%', left: '8%', animationDuration: '3.5s' }} />
        <div className="absolute w-2 h-2 bg-purple-500/45 rounded-full animate-pulse" style={{ top: '70%', left: '10%', animationDuration: '4.2s' }} />
        <div className="absolute w-2 h-2 bg-blue-400/45 rounded-full animate-pulse" style={{ top: '78%', left: '20%', animationDuration: '3.5s' }} />
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
                { key: 'blog', label: 'Blog', href: '/blog' },
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
                {isEnglish ? 'About Us' : 'Tentang Kami'}
              </Badge>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold mb-6 leading-tight tracking-tight">
                <span className="bg-gradient-to-r from-white to-purple-400 bg-clip-text text-transparent">
                  {isEnglish ? 'Empowering Traders' : 'Memberdayakan Trader'}
                </span>
                <br />
                <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                  {isEnglish ? 'With Data & AI' : 'Dengan Data & AI'}
                </span>
              </h1>
              <p className="text-xl sm:text-2xl text-white/60 max-w-3xl mx-auto mb-12 leading-relaxed font-light">
                {isEnglish
                  ? 'LuxTrade is a premium trading journal platform built by traders, for traders. We believe that consistent profitability comes from disciplined analysis, not luck.'
                  : 'LuxTrade adalah platform jurnal trading premium yang dibuat oleh trader, untuk trader. Kami percaya bahwa profitabilitas konsisten datang dari analisis yang disiplin, bukan keberuntungan.'}
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Mission */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <Card className="h-full backdrop-blur-xl bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/30 hover:border-purple-500/50 hover:shadow-[0_0_40px_rgba(139,92,246,0.2)] transition-all duration-300">
                <CardContent className="p-8">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center mb-6 shadow-lg shadow-purple-500/30">
                    <Target className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-3xl font-extrabold text-white mb-4">
                    {isEnglish ? 'Our Mission' : 'Misi Kami'}
                  </h2>
                  <p className="text-white/60 text-lg leading-relaxed">
                    {isEnglish
                      ? 'To provide traders worldwide with the most advanced, user-friendly, and affordable trading journal platform. We bridge the gap between amateur trading and professional consistency through data-driven insights and AI-powered analysis.'
                      : 'Untuk menyediakan platform jurnal trading paling canggih, mudah digunakan, dan terjangkau bagi trader di seluruh dunia. Kami menjembatani kesenjangan antara trading amatir dan konsistensi profesional melalui wawasan berbasis data dan analisis bertenaga AI.'}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Vision */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <Card className="h-full backdrop-blur-xl bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/30 hover:border-blue-500/50 hover:shadow-[0_0_40px_rgba(59,130,246,0.2)] transition-all duration-300">
                <CardContent className="p-8">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30">
                    <Rocket className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-3xl font-extrabold text-white mb-4">
                    {isEnglish ? 'Our Vision' : 'Visi Kami'}
                  </h2>
                  <p className="text-white/60 text-lg leading-relaxed">
                    {isEnglish
                      ? 'To become the world\'s leading trading journal platform, empowering millions of traders to achieve consistent profitability. We envision a future where every trader has access to professional-grade analytics and AI insights, regardless of their budget or experience level.'
                      : 'Untuk menjadi platform jurnal trading terkemuka di dunia, memberdayakan jutaan trader untuk mencapai profitabilitas konsisten. Kami membayangkan masa depan di mana setiap trader memiliki akses ke analisis tingkat profesional dan wawasan AI, terlepas dari anggaran atau tingkat pengalaman mereka.'}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent via-purple-900/10 to-transparent">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full backdrop-blur-xl bg-amber-500/10 border border-amber-500/30 mb-6">
              <Star className="w-4.5 h-4.5 text-amber-400" />
              <span className="text-sm text-amber-300 font-semibold">
                {isEnglish ? 'Our Core Values' : 'Nilai Inti Kami'}
              </span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold mb-6">
              <span className="text-white">{isEnglish ? 'What Drives' : 'Yang Mendorong'}</span>
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                {isEnglish ? ' Us Forward' : ' Kami Maju'}
              </span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {values.map((value, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-purple-500/30 hover:shadow-[0_0_40px_rgba(139,92,246,0.2)] transition-all duration-300 p-6">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${
                    index === 0 ? 'from-purple-500 to-violet-600' :
                    index === 1 ? 'from-amber-500 to-orange-600' :
                    index === 2 ? 'from-emerald-500 to-teal-600' :
                    'from-pink-500 to-rose-600'
                  } flex items-center justify-center mb-5 shadow-lg`}>
                    <value.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-extrabold text-white mb-3">{value.title}</h3>
                  <p className="text-white/60 leading-relaxed">{value.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline/Milestones */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full backdrop-blur-xl bg-emerald-500/10 border border-emerald-500/30 mb-6">
              <TrendingUp className="w-4.5 h-4.5 text-emerald-400" />
              <span className="text-sm text-emerald-300 font-semibold">
                {isEnglish ? 'Our Journey' : 'Perjalanan Kami'}
              </span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold mb-6">
              <span className="text-white">{isEnglish ? 'Key' : 'Tonggak'}</span>
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                {isEnglish ? ' Milestones' : ' Penting'}
              </span>
            </h2>
          </motion.div>

          <div className="space-y-6">
            {milestones.map((milestone, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-emerald-500/30 hover:shadow-[0_0_30px_rgba(16,185,129,0.2)] transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-sm font-bold">
                          {milestone.year}
                        </Badge>
                      </div>
                      <div>
                        <h3 className="text-lg font-extrabold text-white mb-2">{milestone.title}</h3>
                        <p className="text-white/60 leading-relaxed">{milestone.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Join Us CTA */}
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
                  <Users className="w-10 h-10 text-white" />
                </div>
              </div>
              <h2 className="text-4xl sm:text-5xl font-extrabold mb-6">
                <span className="text-white">{isEnglish ? 'Join Our' : 'Bergabung dengan'}</span>
                <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                  {isEnglish ? ' Community' : ' Komunitas Kami'}
                </span>
              </h2>
              <p className="text-xl text-white/60 mb-8 max-w-2xl mx-auto leading-relaxed">
                {isEnglish
                  ? 'Connect with fellow traders, share insights, and grow together. Follow us on social media or join our Telegram community for daily tips and updates.'
                  : 'Terhubung dengan trader lain, berbagi wawasan, dan tumbuh bersama. Ikuti kami di media sosial atau bergabung dengan komunitas Telegram kami untuk tips harian dan update terbaru.'}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                <a
                  href="https://www.instagram.com/luxtrade.web"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-12 h-12 rounded-xl backdrop-blur-sm bg-white/5 border border-white/[0.08] flex items-center justify-center hover:bg-white/10 hover:border-purple-500/30 transition-all duration-300 hover:scale-110"
                >
                  <span className="text-sm font-bold text-white/60">I</span>
                </a>
                <a
                  href="https://www.tiktok.com/@luxtradeee"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-12 h-12 rounded-xl backdrop-blur-sm bg-white/5 border border-white/[0.08] flex items-center justify-center hover:bg-white/10 hover:border-purple-500/30 transition-all duration-300 hover:scale-110"
                >
                  <span className="text-sm font-bold text-white/60">T</span>
                </a>
                <a
                  href="https://t.me/Risxyiee"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-12 h-12 rounded-xl backdrop-blur-sm bg-white/5 border border-white/[0.08] flex items-center justify-center hover:bg-white/10 hover:border-purple-500/30 transition-all duration-300 hover:scale-110"
                >
                  <MessageCircle className="w-5 h-5 text-white/60" />
                </a>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/auth/signup">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
                    <Button className="h-14 px-8 text-lg bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white font-extrabold shadow-lg shadow-purple-500/30 hover:shadow-[0_0_40px_rgba(168,85,247,0.5)] transition-all duration-300 backdrop-blur-xl">
                      {isEnglish ? 'Start Free Trial' : 'Mulai Gratis Sekarang'}
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </motion.div>
                </Link>
                <Link href="/contact">
                  <Button variant="outline" className="h-14 px-8 text-lg border-2 border-white/10 hover:border-white/20 text-white hover:bg-white/5 backdrop-blur-xl font-semibold transition-all">
                    <Mail className="w-5 h-5 mr-2" />
                    {isEnglish ? 'Contact Us' : 'Hubungi Kami'}
                  </Button>
                </Link>
              </div>
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
