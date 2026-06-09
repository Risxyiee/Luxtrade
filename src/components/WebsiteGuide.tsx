'use client'

import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  BarChart3, Wallet, FileText, Brain, Sparkles, DollarSign,
  Target, Calculator, Newspaper, Trophy, Flame, Shield, BookOpen
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface WebsiteGuideProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  language?: 'id' | 'en'
}

export default function WebsiteGuide({
  open,
  onOpenChange,
  language = 'id'
}: WebsiteGuideProps) {
  const [activeSection, setActiveSection] = useState<string | null>(null)

  const guideSections = [
    {
      id: 'gettingStarted',
      icon: <BookOpen className="w-6 h-6" />,
      title: { id: 'Memulai Penggunaan', en: 'Getting Started' },
      steps: [
        {
          id: 'overview',
          title: { id: 'Tentang LuxTrade', en: 'About LuxTrade' },
          content: {
            id: 'LuxTrade adalah platform trading journal modern yang membantu Anda melacak, menganalisis, dan meningkatkan performa trading Anda. Dengan fitur AI-powered analytics, Anda bisa mendapatkan insight yang mendalam tentang pola trading Anda.',
            en: 'LuxTrade is a modern trading journal platform that helps you track, analyze, and improve your trading performance. With AI-powered analytics, you can get deep insights into your trading patterns.'
          }
        },
        {
          id: 'quickStart',
          title: { id: 'Mulai Cepat', en: 'Quick Start' },
          content: {
            id: 'Untuk memulai: 1) Tambah akun trading Anda, 2) Mulai mencatat setiap trade yang Anda lakukan, 3) Analisis performa menggunakan dashboard, 4) Gunakan fitur AI untuk mendapatkan rekomendasi.',
            en: 'To get started: 1) Add your trading account, 2) Start recording every trade you make, 3) Analyze performance using the dashboard, 4) Use AI features for recommendations.'
          }
        }
      ]
    },
    {
      id: 'accountManagement',
      icon: <Wallet className="w-6 h-6" />,
      title: { id: 'Manajemen Akun', en: 'Account Management' },
      steps: [
        {
          id: 'addAccount',
          title: { id: 'Tambah Akun', en: 'Add Account' },
          content: {
            id: 'Klik tombol "Add Account" (ikon dompet) di header kanan atas website. Masukkan nama akun, broker, tipe akun (MT4/MT5), balance awal, dan currency. Anda bisa membuat multiple akun untuk tracking yang lebih detail.',
            en: 'Click the "Add Account" button (wallet icon) in the top right header of the website. Enter account name, broker, account type (MT4/MT5), initial balance, and currency. You can create multiple accounts for detailed tracking.'
          }
        },
        {
          id: 'manageAccounts',
          title: { id: 'Kelola Akun', en: 'Manage Accounts' },
          content: {
            id: 'Di menu "Trading Accounts", Anda bisa melihat semua akun trading Anda, mengedit detail akun, menghapus akun yang tidak digunakan, dan memilih akun default untuk recording trade baru.',
            en: 'In the "Trading Accounts" menu, you can view all your trading accounts, edit account details, delete unused accounts, and select the default account for recording new trades.'
          }
        }
      ]
    },
    {
      id: 'tradeRecording',
      icon: <DollarSign className="w-6 h-6" />,
      title: { id: 'Mencatat Trade', en: 'Recording Trades' },
      steps: [
        {
          id: 'addTrade',
          title: { id: 'Tambah Trade Manual', en: 'Add Trade Manually' },
          content: {
            id: 'Klik tombol "Add Trade" di header kanan atas. Isi form trade: Symbol, Type (BUY/SELL), Lot Size, Open Price, Close Price, Stop Loss, Take Profit, dan Notes. Trade akan otomatis dihitung P/L-nya.',
            en: 'Click the "Add Trade" button in the top right header. Fill in the trade form: Symbol, Type (BUY/SELL), Lot Size, Open Price, Close Price, Stop Loss, Take Profit, and Notes. P/L will be calculated automatically.'
          }
        },
        {
          id: 'smartImport',
          title: { id: 'Smart Import (AI)', en: 'Smart Import (AI)' },
          content: {
            id: 'Gunakan fitur "Smart Import" untuk import trade dari MT4/MT5. Upload screenshot MT5 atau file laporan (HTML/PDF/CSV). AI akan otomatis mendeteksi dan ekstrak data trade dari file yang Anda upload.',
            en: 'Use the "Smart Import" feature to import trades from MT4/MT5. Upload MT5 screenshot or report file (HTML/PDF/CSV). AI will automatically detect and extract trade data from the file you upload.'
          }
        }
      ]
    },
    {
      id: 'analytics',
      icon: <BarChart3 className="w-6 h-6" />,
      title: { id: 'Analitik & Statistik', en: 'Analytics & Statistics' },
      steps: [
        {
          id: 'dashboard',
          title: { id: 'Dashboard Utama', en: 'Main Dashboard' },
          content: {
            id: 'Dashboard menampilkan ringkasan performa trading Anda: Total P/L, Win Rate, Total Trades, Average R:R, dan chart performa. Semua data real-time dan otomatis diupdate saat Anda menambah trade baru.',
            en: 'The dashboard shows a summary of your trading performance: Total P/L, Win Rate, Total Trades, Average R:R, and performance charts. All data is real-time and automatically updates when you add new trades.'
          }
        },
        {
          id: 'detailedAnalytics',
          title: { id: 'Analitik Lengkap', en: 'Detailed Analytics' },
          content: {
            id: 'Di tab Analytics, Anda bisa melihat analisis lebih mendalam: Performa by symbol, by session, by day of week, drawdown analysis, dan equity curve. Gunakan insight ini untuk mengidentifikasi kekuatan dan kelemahan trading Anda.',
            en: 'In the Analytics tab, you can view deeper analysis: Performance by symbol, by session, by day of week, drawdown analysis, and equity curve. Use these insights to identify your trading strengths and weaknesses.'
          }
        }
      ]
    },
    {
      id: 'journaling',
      icon: <FileText className="w-6 h-6" />,
      title: { id: 'Trading Journal', en: 'Trading Journal' },
      steps: [
        {
          id: 'writeJournal',
          title: { id: 'Menulis Jurnal', en: 'Writing Journal' },
          content: {
            id: 'Klik "Add Journal Entry" untuk mencatat pengalaman trading Anda. Tulis tentang setup yang Anda gunakan, emosi saat trading, lesson learned, dan hal yang bisa diperbaiki. Jurnal membantu Anda belajar dari setiap trade.',
            en: 'Click "Add Journal Entry" to record your trading experience. Write about the setup you used, emotions during trading, lessons learned, and things to improve. Journaling helps you learn from every trade.'
          }
        },
        {
          id: 'reviewJournal',
          title: { id: 'Review Jurnal', en: 'Review Journal' },
          content: {
            id: 'Review jurnal Anda secara berkala untuk melihat progress dan pola. Identifikasi improvement yang sudah Anda buat dan area yang masih perlu dikerjakan. Ini akan membantu Anda menjadi trader yang lebih konsisten.',
            en: 'Review your journal periodically to see progress and patterns. Identify improvements you\'ve made and areas that still need work. This will help you become a more consistent trader.'
          }
        }
      ]
    },
    {
      id: 'riskManagement',
      icon: <Shield className="w-6 h-6" />,
      title: { id: 'Manajemen Risiko', en: 'Risk Management' },
      steps: [
        {
          id: 'riskCalculator',
          title: { id: 'Risk Calculator', en: 'Risk Calculator' },
          content: {
            id: 'Gunakan Risk Calculator untuk menentukan posisi size yang tepat berdasarkan risk per trade. Masukkan account balance, risk percentage, dan stop loss distance untuk mendapatkan rekomendasi lot size.',
            en: 'Use the Risk Calculator to determine the appropriate position size based on risk per trade. Enter account balance, risk percentage, and stop loss distance to get recommended lot size.'
          }
        },
        {
          id: 'settingTargets',
          title: { id: 'Setting Targets', en: 'Setting Targets' },
          content: {
            id: 'Di tab Targets, Anda bisa menetapkan target trading harian, mingguan, dan bulanan. Lacak progress menuju target Anda dan pertahankan disiplin untuk mencapainya.',
            en: 'In the Targets tab, you can set daily, weekly, and monthly trading targets. Track your progress toward your targets and maintain discipline to achieve them.'
          }
        }
      ]
    },
    {
      id: 'aiFeatures',
      icon: <Brain className="w-6 h-6" />,
      title: { id: 'Fitur AI', en: 'AI Features' },
      steps: [
        {
          id: 'aiInsights',
          title: { id: 'AI Insights', en: 'AI Insights' },
          content: {
            id: 'AI akan menganalisis data trading Anda dan memberikan insight tentang pola performa, area yang perlu diperbaiki, dan rekomendasi untuk meningkatkan win rate. Insight AI menjadi lebih akurat seiring bertambahnya data trade.',
            en: 'AI will analyze your trading data and provide insights about performance patterns, areas that need improvement, and recommendations to increase win rate. AI insights become more accurate as trade data grows.'
          }
        },
        {
          id: 'weeklyReport',
          title: { id: 'Weekly Report', en: 'Weekly Report' },
          content: {
            id: 'Dapatkan laporan mingguan otomatis yang merangkum performa trading Anda, highlight trade terbaik, area improvement, dan saran berdasarkan analisis AI. Laporan ini dikirim setiap minggu untuk membantu Anda tetap on track.',
            en: 'Get an automatic weekly report summarizing your trading performance, highlighting best trades, areas for improvement, and suggestions based on AI analysis. This report is sent weekly to help you stay on track.'
          }
        }
      ]
    },
    {
      id: 'tradingScore',
      icon: <Trophy className="w-6 h-6" />,
      title: { id: 'Trading Score', en: 'Trading Score' },
      steps: [
        {
          id: 'scoreOverview',
          title: { id: 'Understanding Score', en: 'Understanding Score' },
          content: {
            id: 'Trading Score mengukur keseluruhan performa trading Anda berdasarkan beberapa faktor: consistency, risk management, win rate, dan journaling habits. Score berkisar dari 0-100.',
            en: 'Trading Score measures your overall trading performance based on several factors: consistency, risk management, win rate, and journaling habits. Score ranges from 0-100.'
          }
        },
        {
          id: 'improveScore',
          title: { id: 'Improve Your Score', en: 'Improve Your Score' },
          content: {
            id: 'Untuk meningkatkan score: 1) Pertahankan consistency dalam trading, 2) Ikuti risk management yang baik, 3) Catat jurnal untuk setiap trade, 4) Review dan belajar dari kesalahan, 5) Fokus pada quality trade bukan quantity.',
            en: 'To improve your score: 1) Maintain consistency in trading, 2) Follow good risk management, 3) Journal every trade, 4) Review and learn from mistakes, 5) Focus on trade quality not quantity.'
          }
        }
      ]
    }
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f0b18] border-purple-900/30 text-white max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-2xl flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-purple-400" />
            {language === 'id' ? 'Panduan Website LuxTrade' : 'LuxTrade Website Guide'}
          </DialogTitle>
          <p className="text-gray-400 mt-2">
            {language === 'id'
              ? 'Panduan lengkap untuk menggunakan semua fitur LuxTrade'
              : 'Complete guide to using all LuxTrade features'
            }
          </p>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden gap-4 mt-4">
          {/* Sidebar - Section List */}
          <ScrollArea className="w-64 shrink-0 border-r border-purple-900/30 pr-2">
            <div className="space-y-2">
              {guideSections.map((section) => (
                <motion.button
                  key={section.id}
                  onClick={() => setActiveSection(activeSection === section.id ? null : section.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                    activeSection === section.id
                      ? 'bg-purple-500/20 border border-purple-500/30 text-purple-300'
                      : 'hover:bg-white/5 text-gray-300'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className={`shrink-0 ${activeSection === section.id ? 'text-purple-400' : 'text-gray-500'}`}>
                    {section.icon}
                  </div>
                  <span className="text-sm font-medium">{section.title[language]}</span>
                </motion.button>
              ))}
            </div>
          </ScrollArea>

          {/* Main Content - Steps */}
          <ScrollArea className="flex-1">
            <div className="space-y-6 pr-4">
              {!activeSection ? (
                <div className="text-center py-12">
                  <BookOpen className="w-16 h-16 mx-auto mb-4 text-purple-400/50" />
                  <p className="text-gray-400">
                    {language === 'id'
                      ? 'Pilih section di kiri untuk melihat panduan'
                      : 'Select a section on the left to view the guide'
                    }
                  </p>
                </div>
              ) : (
                <>
                  {(() => {
                    const section = guideSections.find(s => s.id === activeSection)
                    if (!section) return null

                    return (
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={activeSection}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.3 }}
                          className="space-y-6"
                        >
                          {/* Section Header */}
                          <div className="flex items-center gap-3 pb-4 border-b border-purple-900/30">
                            <div className="text-purple-400">{section.icon}</div>
                            <h3 className="text-xl font-bold">{section.title[language]}</h3>
                          </div>

                          {/* Steps */}
                          {section.steps.map((step, index) => (
                            <motion.div
                              key={step.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className="bg-white/5 rounded-lg p-5 border border-purple-900/20 hover:border-purple-500/30 transition-colors"
                            >
                              <div className="flex items-start gap-3 mb-3">
                                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                                  {index + 1}
                                </Badge>
                                <h4 className="text-lg font-semibold text-white">{step.title[language]}</h4>
                              </div>
                              <p className="text-gray-300 leading-relaxed whitespace-pre-line">
                                {step.content[language]}
                              </p>
                            </motion.div>
                          ))}
                        </motion.div>
                      </AnimatePresence>
                    )
                  })()}
                </>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Footer */}
        <div className="shrink-0 pt-4 mt-4 border-t border-purple-900/30 flex justify-between items-center">
          <p className="text-xs text-gray-500">
            {language === 'id'
              ? 'Tips: Baca panduan secara bertahap dan praktekan langsung'
              : 'Tip: Read the guide step by step and practice immediately'
            }
          </p>
          <Button
            onClick={() => onOpenChange(false)}
            className="bg-purple-500 hover:bg-purple-600"
          >
            {language === 'id' ? 'Tutup' : 'Close'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}