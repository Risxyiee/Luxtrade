'use client'

import { useState, useEffect } from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { 
  X, 
  Crown, 
  Check, 
  Sparkles, 
  Zap,
  Shield,
  HeadphonesIcon,
  TrendingUp,
  Star,
  Gem,
  Award,
  Infinity,
  Brain,
  AlertTriangle
} from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'

interface PaywallModalProps {
  isOpen: boolean
  onClose: () => void
  feature?: string
}

export default function PaywallModal({ isOpen, onClose, feature }: PaywallModalProps) {
  const { language } = useLanguage()
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    requestAnimationFrame(() => setMounted(true))
  }, [])

  const content = {
    id: {
      title: "Buka Potensi Trading Terbaikmu!",
      subtitle: feature 
        ? `Fitur "${feature}" hanya tersedia untuk pengguna PRO`
        : "Kamu telah mencapai batas 10 trade/bulan. Upgrade ke PRO untuk unlimited trades dan semua fitur premium.",
      description: "Upgrade ke PRO untuk unlimited trades, analitik mendalam, AI auto-journal, deteksi pola kerugian, dan watchlist prop firm.",
      features: [
        { icon: Infinity, title: "Unlimited Trade Entries", desc: "Tidak ada batas jurnal trading per bulan" },
        { icon: TrendingUp, title: "Advanced Analytics & Equity Curve", desc: "Analitik mendalam dengan grafik dan statistik lengkap" },
        { icon: Brain, title: "AI Pattern Detection & Guard", desc: "Deteksi pola kerugian otomatis dan watchlist prop firm" },
        { icon: Shield, title: "AI Vision Auto-Journal", desc: "Upload screenshot MT5/TradingView, AI otomatis extract data" },
        { icon: Zap, title: "AI Trading Psychology", desc: "Laporan psikologi trading yang dianalisis oleh AI" },
        { icon: Star, title: "All Premium Features", desc: "Akses ke semua fitur premium dan eksklusif" }
      ],
      price: {
        monthly: "Rp39.000",
        yearly: "Rp390.000",
        yearlySave: "Hemat 2 bulan"
      },
      cta: {
        primary: "Upgrade ke Pro Sekarang",
        secondary: "Mungkin Nanti",
        guarantee: "Produk Digital — Non-Refundable"
      },
      testimonials: [
        { name: "Rizky", role: "Forex Trader", text: "Win rate saya naik dari 45% ke 67% dalam 2 bulan!" },
        { name: "Sarah", role: "Crypto Trader", text: "Fitur AI psychology-nya sangat membantu mengontrol emosi" }
      ]
    },
    en: {
      title: "Unlock Your Ultimate Trading Potential!",
      subtitle: feature
        ? `The "${feature}" feature is only available for PRO users`
        : "You've hit the 10 trades/month limit. Upgrade to PRO for unlimited trades and all premium features.",
      description: "Upgrade to PRO for unlimited trades, deep analytics, AI auto-journal, loss pattern detection, and prop firm watchlist.",
      features: [
        { icon: Infinity, title: "Unlimited Trade Entries", desc: "No limit on trading journals per month" },
        { icon: TrendingUp, title: "Advanced Analytics & Equity Curve", desc: "Deep analytics with complete charts and statistics" },
        { icon: Brain, title: "AI Pattern Detection & Guard", desc: "Automatic loss pattern detection and prop firm watchlist" },
        { icon: Shield, title: "AI Vision Auto-Journal", desc: "Upload MT5/TradingView screenshot, AI auto-extracts data" },
        { icon: Zap, title: "AI Trading Psychology", desc: "AI-analyzed trading psychology reports" },
        { icon: Star, title: "All Premium Features", desc: "Access to all premium and exclusive features" }
      ],
      price: {
        monthly: "$2.49",
        yearly: "$24.99",
        yearlySave: "Save 2 months"
      },
      cta: {
        primary: "Upgrade to Pro Now",
        secondary: "Maybe Later",
        guarantee: "Digital Product — Non-Refundable"
      },
      testimonials: [
        { name: "Rizky", role: "Forex Trader", text: "My win rate increased from 45% to 67% in 2 months!" },
        { name: "Sarah", role: "Crypto Trader", text: "The AI psychology feature really helps control emotions" }
      ]
    }
  }

  const currentContent = content[language]

  if (!mounted) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 bg-gradient-to-br from-slate-100 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 text-lux-text-primary dark:text-white border-0">
        <div className="relative">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Decorative Elements */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl" />

          {/* Header */}
          <div className="relative p-8 md:p-12 text-center border-b border-white/10">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl">
                <Crown className="h-8 w-8 text-white" />
              </div>
            </div>
            <DialogTitle className="text-3xl md:text-4xl font-bold mb-3 bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
              {currentContent.title}
            </DialogTitle>
            {feature && (
              <Badge className="mb-3 bg-amber-600 hover:bg-amber-700">
                <Sparkles className="h-3 w-3 mr-1" />
                Premium Feature
              </Badge>
            )}
            <p className="text-lux-text-secondary dark:text-gray-300 text-lg max-w-2xl mx-auto">
              {feature ? currentContent.subtitle : currentContent.description}
            </p>
          </div>

          {/* Features Grid */}
          <div className="relative p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {currentContent.features.map((feature, index) => {
                const Icon = feature.icon
                return (
                  <Card 
                    key={index} 
                    className="p-4 bg-white/5 border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all hover:scale-105"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg">
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1 text-amber-400">
                          {feature.title}
                        </h3>
                        <p className="text-sm text-gray-400">
                          {feature.desc}
                        </p>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>

            {/* Pricing Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {/* Monthly Plan */}
              <Card className="p-6 bg-white/5 border-white/10 backdrop-blur-sm">
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-2">
                    {language === 'id' ? 'Bulanan' : 'Monthly'}
                  </h3>
                  <div className="text-4xl font-bold mb-1">
                    {currentContent.price.monthly}
                  </div>
                  <p className="text-sm text-gray-400 mb-4">
                    /{language === 'id' ? 'bulan' : 'month'}
                  </p>
                  <Button className="w-full bg-lux-surface-hover dark:bg-white/10 hover:bg-lux-inline-hover-bg-2 dark:hover:bg-white/20 text-lux-text-primary dark:text-white border border-lux-border dark:border-white/20">
                    {currentContent.cta.primary}
                  </Button>
                </div>
              </Card>

              {/* Yearly Plan - Highlighted */}
              <Card className="p-6 bg-gradient-to-br from-amber-600 to-orange-600 border-2 border-amber-400 relative overflow-hidden">
                <div className="absolute top-4 right-4">
                  <Badge className="bg-white text-amber-600 font-semibold">
                    {currentContent.price.yearlySave}
                  </Badge>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Gem className="h-5 w-5" />
                    <h3 className="text-lg font-semibold">
                      {language === 'id' ? 'Tahunan' : 'Yearly'}
                    </h3>
                  </div>
                  <div className="text-4xl font-bold mb-1">
                    {currentContent.price.yearly}
                  </div>
                  <p className="text-sm text-lux-text-secondary dark:text-white/80 mb-4">
                    /{language === 'id' ? 'tahun' : 'year'}
                  </p>
                  <Button className="w-full bg-white text-amber-600 hover:bg-gray-100 font-semibold">
                    <Sparkles className="mr-2 h-4 w-4" />
                    {currentContent.cta.primary}
                  </Button>
                </div>
              </Card>
            </div>

            {/* Testimonials */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {currentContent.testimonials.map((testimonial, index) => (
                <Card key={index} className="p-4 bg-white/5 border-white/10">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center font-bold">
                        {testimonial.name[0]}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-300 mb-2 italic">
                        "{testimonial.text}"
                      </p>
                      <div>
                        <p className="font-semibold text-amber-400">{testimonial.name}</p>
                        <p className="text-xs text-gray-500">{testimonial.role}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Guarantee */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <span className="text-sm text-gray-300">
                  {currentContent.cta.guarantee}
                </span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" className="flex-1 max-w-md bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold">
                <Award className="mr-2 h-5 w-5" />
                {currentContent.cta.primary}
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="flex-1 max-w-md border-lux-border dark:border-white/20 text-lux-text-primary dark:text-white hover:bg-lux-surface-hover dark:hover:bg-white/10"
                onClick={onClose}
              >
                {currentContent.cta.secondary}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
