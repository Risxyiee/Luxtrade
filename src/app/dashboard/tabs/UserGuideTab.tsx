'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  LayoutDashboard, 
  BookOpen, 
  Settings, 
  PlusCircle, 
  TrendingUp,
  Brain,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Lightbulb,
  Target,
  Award
} from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'

export default function UserGuideTab() {
  const { t, language, setLanguage } = useLanguage()

  const content = {
    id: {
      title: "Selamat Datang di LuxTrade! Panduan Kilat Menguasai Dashboard Trading Journal Milikmu",
      subtitle: "Panduan lengkap untuk memaksimalkan pengalaman jurnal trading Anda",
      sections: [
        {
          icon: LayoutDashboard,
          title: "Mengenal 3 Menu Utama",
          description: "Pahami struktur dashboard untuk navigasi yang efektif",
          items: [
            "Dashboard Analitik - Melihat performa trading, statistik win rate, dan grafik profit/loss",
            "Jurnal Mandiri - Mencatat dan mengelola semua transaksi trading secara manual",
            "Pengaturan Akun - Mengelola profil, preferensi bahasa, dan subscription"
          ]
        },
        {
          icon: PlusCircle,
          title: "Cara Mencatat Trade Pertama",
          description: "Langkah demi langkah input transaksi trading pertama Anda",
          items: [
            "Klik tombol 'Tambah Transaksi' di menu Jurnal",
            "Isi informasi dasar: Pair (contoh: EUR/USD), Lot Size, dan Tipe (BUY/SELL)",
            "Masukkan Entry Price dan Exit Price dengan akurat",
            "Input Profit/Loss (gunakan angka negatif untuk loss)",
            "Tambahkan catatan psikologi, screenshot chart, atau analisis Anda",
            "Klik 'Simpan' dan transaksi Anda akan muncul di jurnal"
          ]
        },
        {
          icon: Lightbulb,
          title: "3 Tips Emas",
          description: "Praktik terbaik untuk jurnal trading yang efektif",
          items: [
            "Catat Loss Secara Jujur - Jangan manipulasi data loss, itu kunci untuk improvement",
            "Evaluasi Setiap Weekend - Review semua trade minggu ini, identifikasi pola dan kesalahan",
            "Konsisten - Catat setiap trade, baik win maupun loss, untuk data yang akurat"
          ]
        }
      ],
      features: [
        { icon: TrendingUp, title: "Analitik Mendalam", desc: "Statistik lengkap performa trading Anda" },
        { icon: Brain, title: "AI-Powered Insights", desc: "Analisis psikologi trading dengan AI" },
        { icon: Target, title: "Goal Tracking", desc: "Set dan pantau target mingguan/bulanan" },
        { icon: Award, title: "Streak Tracking", desc: "Monitor win/loss streak Anda" }
      ],
      cta: {
        primary: "Mulai Jurnal Sekarang",
        secondary: "Lihat Demo Video"
      }
    },
    en: {
      title: "Welcome to LuxTrade! Quick Guide to Mastering Your Trading Journal Dashboard",
      subtitle: "Complete guide to maximize your trading journal experience",
      sections: [
        {
          icon: LayoutDashboard,
          title: "Understand the 3 Main Menus",
          description: "Learn the dashboard structure for effective navigation",
          items: [
            "Analytical Dashboard - View trading performance, win rate stats, and profit/loss charts",
            "Manual Journal - Record and manage all trading transactions manually",
            "Account Settings - Manage profile, language preferences, and subscription"
          ]
        },
        {
          icon: PlusCircle,
          title: "How to Log Your First Trade",
          description: "Step-by-step guide to input your first trading transaction",
          items: [
            "Click the 'Add Transaction' button in the Journal menu",
            "Fill in basic info: Pair (e.g., EUR/USD), Lot Size, and Type (BUY/SELL)",
            "Enter Entry Price and Exit Price accurately",
            "Input Profit/Loss (use negative numbers for losses)",
            "Add psychological notes, chart screenshots, or analysis",
            "Click 'Save' and your transaction will appear in the journal"
          ]
        },
        {
          icon: Lightbulb,
          title: "3 Golden Tips",
          description: "Best practices for effective trading journaling",
          items: [
            "Be Honest with Losses - Don't manipulate loss data, it's key to improvement",
            "Evaluate Every Weekend - Review all weekly trades, identify patterns and mistakes",
            "Stay Consistent - Log every trade, win or loss, for accurate data"
          ]
        }
      ],
      features: [
        { icon: TrendingUp, title: "Deep Analytics", desc: "Complete statistics of your trading performance" },
        { icon: Brain, title: "AI-Powered Insights", desc: "AI-powered trading psychology analysis" },
        { icon: Target, title: "Goal Tracking", desc: "Set and track weekly/monthly targets" },
        { icon: Award, title: "Streak Tracking", desc: "Monitor your win/loss streaks" }
      ],
      cta: {
        primary: "Start Journaling Now",
        secondary: "Watch Demo Video"
      }
    }
  }

  const currentContent = content[language]

  return (
    <div className="space-y-6">
      {/* Language Toggle */}
      <div className="flex justify-end items-center gap-2">
        <Button
          variant={language === 'id' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setLanguage('id')}
          className={language === 'id' ? 'bg-amber-600 hover:bg-amber-700' : ''}
        >
          🇮🇩 ID
        </Button>
        <Button
          variant={language === 'en' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setLanguage('en')}
          className={language === 'en' ? 'bg-amber-600 hover:bg-amber-700' : ''}
        >
          🇬🇧 EN
        </Button>
      </div>

      {/* Hero Section */}
      <Card className="bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-white p-8 md:p-12 border-0 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-6 w-6" />
            <span className="text-sm font-medium bg-white/20 px-3 py-1 rounded-full">
              {language === 'id' ? 'Panduan Baru' : 'New Guide'}
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">
            {currentContent.title}
          </h1>
          <p className="text-lg md:text-xl opacity-90 max-w-2xl">
            {currentContent.subtitle}
          </p>
        </div>
      </Card>

      {/* Main Sections */}
      <div className="space-y-8">
        {currentContent.sections.map((section, index) => {
          const Icon = section.icon
          return (
            <Card key={index} className="p-6 md:p-8 border-2 border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl">
                  <Icon className="h-8 w-8 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl md:text-3xl font-bold mb-2">
                    {section.title}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    {section.description}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {section.items.map((item, itemIndex) => (
                  <div 
                    key={itemIndex} 
                    className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex-shrink-0 mt-1">
                      <CheckCircle2 className="h-5 w-5 text-amber-600" />
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )
        })}
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {currentContent.features.map((feature, index) => {
          const Icon = feature.icon
          return (
            <Card key={index} className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-2 border-amber-200 dark:border-amber-800">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl">
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-bold text-lg">{feature.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {feature.desc}
                </p>
              </div>
            </Card>
          )
        })}
      </div>

      {/* CTA Section */}
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8 md:p-12 border-0">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-2">
              {language === 'id' ? 'Siap Meningkatkan Trading Anda?' : 'Ready to Improve Your Trading?'}
            </h2>
            <p className="text-gray-300">
              {language === 'id' 
                ? 'Mulai jurnal trading Anda sekarang dan lihat perbedaannya dalam 30 hari'
                : 'Start your trading journal now and see the difference in 30 days'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button size="lg" className="bg-amber-600 hover:bg-amber-700">
              {currentContent.cta.primary}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="border-2 border-white/20 text-white hover:bg-white/10">
              {currentContent.cta.secondary}
            </Button>
          </div>
        </div>
      </Card>

      {/* Footer Note */}
      <div className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
        <p>
          {language === 'id' 
            ? '💡 Pro Tip: Gunakan fitur Reminder untuk mengingatkan Anda mencatat setiap trade'
            : '💡 Pro Tip: Use the Reminder feature to remind yourself to log every trade'}
        </p>
      </div>
    </div>
  )
}
