'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import {
  Sparkles, TrendingUp, Shield, Users, Target,
  ArrowRight, Instagram, MessageCircle, Send, Check,
  Heart, Zap, Award, Globe
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

  const values = [
    {
      icon: Shield,
      title: isEnglish ? 'Trust & Security' : 'Kepercayaan & Keamanan',
      description: isEnglish
        ? 'Your data is our top priority. We use bank-level encryption to protect your trading data.'
        : 'Data Anda adalah prioritas utama kami. Kami menggunakan enkripsi tingkat bank untuk melindungi data trading Anda.',
      color: 'from-purple-500 to-violet-600'
    },
    {
      icon: Target,
      title: isEnglish ? 'Trader-First Approach' : 'Pendekatan Berpusat pada Trader',
      description: isEnglish
        ? 'Every feature is built by traders, for traders. We understand your pain points.'
        : 'Setiap fitur dibuat oleh trader, untuk trader. Kami memahami masalah yang Anda hadapi.',
      color: 'from-blue-500 to-cyan-600'
    },
    {
      icon: Zap,
      title: isEnglish ? 'Continuous Innovation' : 'Inovasi Terus-Menerus',
      description: isEnglish
        ? 'We constantly improve based on your feedback. New features are released every month.'
        : 'Kami terus memperbaiki berdasarkan feedback Anda. Fitur baru dirilis setiap bulan.',
      color: 'from-amber-500 to-orange-600'
    },
    {
      icon: Users,
      title: isEnglish ? 'Community Driven' : 'Berbasis Komunitas',
      description: isEnglish
        ? 'We build with our community. Your suggestions shape our roadmap.'
        : 'Kami membangun bersama komunitas. Saran Anda membentuk peta jalan kami.',
      color: 'from-emerald-500 to-teal-600'
    }
  ]

  const timeline = [
    {
      year: '2024',
      title: isEnglish ? 'LuxTrade is Born' : 'LuxTrade Lahir',
      description: isEnglish
        ? 'Started with a simple mission: help traders improve through data-driven insights.'
        : 'Dimulai dengan misi sederhana: membantu trader meningkat melalui wawasan berbasis data.'
    },
    {
      year: '2024 Q2',
      title: isEnglish ? 'AI Integration' : 'Integrasi AI',
      description: isEnglish
        ? 'Launched Smart AI Analysis to help traders identify mistakes and improve strategies.'
        : 'Meluncurkan Analisis AI Pintar untuk membantu trader mengidentifikasi kesalahan dan meningkatkan strategi.'
    },
    {
      year: '2024 Q3',
      title: isEnglish ? 'Multilingual Support' : 'Dukungan Multibahasa',
      description: isEnglish
        ? 'Added Indonesian and English support to reach more traders globally.'
        : 'Menambahkan dukungan Bahasa Indonesia dan Inggris untuk menjangkau lebih banyak trader secara global.'
    },
    {
      year: '2024 Q4',
      title: isEnglish ? 'Global Expansion' : 'Ekspansi Global',
      description: isEnglish
        ? 'Growing community of traders from Indonesia, Malaysia, Singapore, and beyond.'
        : 'Komunitas trader yang terus bertumbuh dari Indonesia, Malaysia, Singapura, dan lainnya.'
    }
  ]

  return (
    <div className="min-h-screen bg-[#0f051d] text-white">
      {/* Partikel Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-10">
        <div className="absolute w-3 h-3 bg-purple-500/40 rounded-full animate-ping" style={{ top: '5%', left: '3%', animationDuration: '3s' }} />
        <div className="absolute w-2 h-2 bg-purple-400/50 rounded-full animate-pulse" style={{ top: '12%', left: '8%', animationDuration: '4s' }} />
        <div className="absolute w-4 h-4 bg-blue-500/30 rounded-full animate-ping" style={{ top: '8%', left: '15%', animationDuration: '3.5s' }} />
        <div className="absolute w-2 h-2 bg-purple-300/60 rounded-full animate-pulse" style={{ top: '18%', left: '20%', animationDuration: '2.5s' }} />
        <div className="absolute w-3 h-3 bg-purple-500/35 rounded-full animate-ping" style={{ top: '70%', left: '10%', animationDuration: '4.2s' }} />
        <div className="absolute w-4 h-4 bg-purple-400/35 rounded-full animate-ping" style={{ top: '72%', left: '6%', animationDuration: '4.5s' }} />
        <div className="absolute w-2 h-2 bg-blue-400/40 rounded-full animate-pulse" style={{ top: '82%', left: '93%', animationDuration: '3.5s' }} />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div className="backdrop-blur-xl bg-[#0f051d]/80 border-b border-white/[0.08]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link href="/" className="flex items-center gap-3">
                <Image
                  src="/logo.png"
                  alt="LuxTrade Logo"
                  width={40}
                  height={40}
                  className="rounded-xl shadow-lg"
                />
                <div>
                  <span className="text-xl font-extrabold bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
                    LuxTrade
                  </span>
                  <span className="hidden sm:inline text-[10px] text-purple-400/70 ml-2 tracking-[0.2em] font-bold">PREMIUM</span>
                </div>
              </Link>

              <div className="flex items-center gap-3">
                <LanguageSwitcher />
                <Link href="/auth/login">
                  <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10 transition-all font-semibold">
                    {isEnglish ? 'Login' : 'Masuk'}
                  </Button>
                </Link>
                <Link href="/auth/signup">
                  <Button className="h-10 px-6 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white font-extrabold shadow-lg shadow-purple-500/30 transition-all">
                    {isEnglish ? 'Sign Up' : 'Daftar'}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            className="mb-8"
          >
            <Badge className="mb-6 bg-gradient-to-r from-purple-500 to-blue-500 text-white border-0 px-4 py-1.5">
              {isEnglish ? 'About Us' : 'Tentang Kami'}
            </Badge>
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ delay: 0.1 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-extrabold mb-6 leading-tight"
          >
            {isEnglish ? (
              <>
                <span className="text-white">Empowering Traders</span>
                <br />
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400 bg-clip-text text-transparent">
                  to Trade Smarter
                </span>
              </>
            ) : (
              <>
                <span className="text-white">Memberdayakan Trader</span>
                <br />
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400 bg-clip-text text-transparent">
                  untuk Trading Lebih Pintar
                </span>
              </>
            )}
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ delay: 0.2 }}
            className="text-xl text-white/60 max-w-3xl mx-auto mb-12 leading-relaxed"
          >
            {isEnglish
              ? 'LuxTrade is more than a trading journal. It\'s your partner in achieving consistent profitability through data-driven insights and AI-powered analysis.'
              : 'LuxTrade lebih dari sekadar jurnal trading. Ini adalah partner Anda untuk mencapai profitabilitas konsisten melalui wawasan berbasis data dan analisis bertenaga AI.'}
          </motion.p>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/auth/signup">
              <Button size="lg" className="h-14 px-10 text-xl bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white font-extrabold shadow-lg shadow-purple-500/30 transition-all">
                {isEnglish ? 'Start Trading Smarter' : 'Mulai Trading Lebih Pintar'}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" size="lg" className="h-14 px-10 text-xl border-2 border-white/10 text-white hover:bg-white/5 transition-all">
                {isEnglish ? 'Back to Home' : 'Kembali ke Beranda'}
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl font-extrabold mb-6">
              <span className="text-white">{isEnglish ? 'Our' : 'Misi'}</span>
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                {isEnglish ? ' Mission' : ' Kami'}
              </span>
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="backdrop-blur-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-3xl p-8 md:p-12"
          >
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                  <Target className="w-8 h-8 text-white" />
                </div>
              </div>
              <div>
                <p className="text-xl text-white/90 leading-relaxed">
                  {isEnglish
                    ? 'To democratize professional-grade trading analytics and make it accessible to every trader, regardless of their account size or experience level. We believe that with the right tools and insights, anyone can become a consistently profitable trader.'
                    : 'Mendemokratisasikan analisis trading tingkat profesional dan membuatnya dapat diakses oleh setiap trader, terlepas dari ukuran akun atau tingkat pengalaman mereka. Kami percaya bahwa dengan alat dan wawasan yang tepat, siapa pun bisa menjadi trader yang konsisten profit.'}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl font-extrabold mb-6">
              <span className="text-white">{isEnglish ? 'Our' : 'Nilai-Nilai'}</span>
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                {isEnglish ? ' Values' : ' Kami'}
              </span>
            </h2>
            <p className="text-xl text-white/60 max-w-2xl mx-auto">
              {isEnglish
                ? 'The principles that guide everything we do'
                : 'Prinsip yang memandu segala yang kami lakukan'}
            </p>
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
                <Card className="h-full backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-purple-500/30 hover:shadow-[0_0_40px_rgba(139,92,246,0.2)] transition-all duration-300 group">
                  <CardContent className="p-8">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${value.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg`}>
                      <value.icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-extrabold text-white mb-4">{value.title}</h3>
                    <p className="text-white/60 leading-relaxed">{value.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Story/Storytelling Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl font-extrabold mb-6">
              <span className="text-white">{isEnglish ? 'Our' : 'Cerita'}</span>
              <span className="bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent">
                {isEnglish ? ' Story' : ' Kami'}
              </span>
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] rounded-3xl p-8 md:p-12"
          >
            <div className="space-y-6 text-lg text-white/80 leading-relaxed">
              <p>
                {isEnglish
                  ? 'LuxTrade was born from a simple frustration: why is professional trading analysis so expensive and complicated? As traders ourselves, we knew there had to be a better way.'
                  : 'LuxTrade lahir dari rasa frustrasi yang sederhana: mengapa analisis trading profesional begitu mahal dan rumit? Sebagai trader sendiri, kami tahu harus ada cara yang lebih baik.'}
              </p>
              <p>
                {isEnglish
                  ? 'We built LuxTrade to bridge that gap – to bring institutional-grade analytics to everyday traders without the institutional price tag. We believe every trader deserves access to tools that can help them improve and become consistently profitable.'
                  : 'Kami membangun LuxTrade untuk menjembatani kesenjangan itu – membawa analisis tingkat institusional ke trader sehari-hari tanpa label harga institusional. Kami percaya setiap trader berhak mendapatkan akses ke alat yang dapat membantu mereka meningkat dan menjadi konsisten profit.'}
              </p>
              <p>
                {isEnglish
                  ? 'Today, LuxTrade is used by traders in Indonesia, Malaysia, Singapore, and beyond. Our community continues to grow, and we\'re committed to building the best trading journal on the planet.'
                  : 'Hari ini, LuxTrade digunakan oleh trader di Indonesia, Malaysia, Singapura, dan sekitarnya. Komunitas kami terus bertumbuh, dan kami berkomitmen untuk membangun jurnal trading terbaik di planet ini.'}
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl font-extrabold mb-6">
              <span className="text-white">{isEnglish ? 'Our' : 'Perjalanan'}</span>
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                {isEnglish ? ' Journey' : ' Kami'}
              </span>
            </h2>
          </motion.div>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-500 via-blue-500 to-emerald-500" />

            {timeline.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                className={`relative flex items-center mb-12 ${index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}
              >
                {/* Timeline dot */}
                <div className="absolute left-8 md:left-1/2 w-4 h-4 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 shadow-lg shadow-purple-500/50 -translate-x-1/2 z-10" />

                <div className="ml-20 md:ml-0 md:w-1/2 md:px-12">
                  <Card className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-purple-500/30 transition-all duration-300">
                    <CardContent className="p-6">
                      <Badge className="mb-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white border-0">
                        {item.year}
                      </Badge>
                      <h3 className="text-xl font-extrabold text-white mb-3">{item.title}</h3>
                      <p className="text-white/60 leading-relaxed">{item.description}</p>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="backdrop-blur-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-3xl p-12 text-center"
          >
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-purple-500/30">
                <Heart className="w-10 h-10 text-white" />
              </div>
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold mb-6">
              <span className="text-white">{isEnglish ? 'Join Our' : 'Bergabung dengan'}</span>
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                {isEnglish ? ' Community' : ' Komunitas Kami'}
              </span>
            </h2>
            <p className="text-xl text-white/70 mb-8 max-w-2xl mx-auto">
              {isEnglish
                ? 'Ready to take your trading to the next level? Join thousands of traders who are already using LuxTrade to improve their performance.'
                : 'Siap untuk meningkatkan trading Anda ke level berikutnya? Bergabunglah dengan ribuan trader yang sudah menggunakan LuxTrade untuk meningkatkan performa mereka.'}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <Link href="/auth/signup">
                <Button size="lg" className="h-14 px-10 text-xl bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white font-extrabold shadow-lg shadow-purple-500/30 transition-all">
                  {isEnglish ? 'Get Started Free' : 'Mulai Gratis Sekarang'}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>

            {/* Social Links */}
            <div className="flex items-center justify-center gap-4">
              <a
                href="https://www.instagram.com/luxtrade.web"
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 rounded-xl backdrop-blur-sm bg-white/5 border border-white/[0.08] flex items-center justify-center hover:bg-gradient-to-br hover:from-purple-500 hover:to-pink-500 hover:border-0 transition-all duration-300 group"
              >
                <Instagram className="w-5 h-5 text-white/60 group-hover:text-white transition-colors" />
              </a>
              <a
                href="https://www.tiktok.com/@luxtradeee"
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 rounded-xl backdrop-blur-sm bg-white/5 border border-white/[0.08] flex items-center justify-center hover:bg-gradient-to-br hover:from-purple-500 hover:to-pink-500 hover:border-0 transition-all duration-300 group"
              >
                <MessageCircle className="w-5 h-5 text-white/60 group-hover:text-white transition-colors" />
              </a>
              <a
                href="https://t.me/Risxyiee"
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 rounded-xl backdrop-blur-sm bg-white/5 border border-white/[0.08] flex items-center justify-center hover:bg-gradient-to-br hover:from-blue-500 hover:to-cyan-500 hover:border-0 transition-all duration-300 group"
              >
                <Send className="w-5 h-5 text-white/60 group-hover:text-white transition-colors" />
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] py-12 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-white/40 text-sm font-medium">
            © 2024 LuxTrade. {isEnglish ? 'All rights reserved.' : 'Hak cipta dilindungi.'}
          </p>
        </div>
      </footer>
    </div>
  )
}
