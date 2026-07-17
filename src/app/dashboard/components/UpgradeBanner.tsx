'use client'

import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Crown } from 'lucide-react'

interface UpgradeBannerProps {
  isPro: boolean
  language: 'id' | 'en'
  onUpgrade?: () => void
}

export const UpgradeBanner: React.FC<UpgradeBannerProps> = ({
  isPro,
  language,
  onUpgrade
}) => {
  // Don't show banner if already PRO
  if (isPro) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <Card className="relative overflow-hidden bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-orange-500/20 border-amber-500/30 backdrop-blur-md">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl" />
        <CardContent className="relative p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                <Crown className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-amber-800 dark:text-amber-200 mb-1">
                {language === 'id' ? 'Upgrade ke PRO' : 'Upgrade to PRO'}
              </h3>
              <p className="text-sm text-amber-800/70 dark:text-amber-100/80">
                {language === 'id'
                  ? 'Buka fitur premium tanpa batas - analisis AI lanjutan, unlimited trades, dan banyak lagi!'
                  : 'Unlock unlimited premium features - advanced AI analytics, unlimited trades, and more!'}
              </p>
            </div>
            {onUpgrade && (
              <motion.button
                onClick={onUpgrade}
                className="flex-shrink-0 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg text-sm font-semibold text-white shadow-lg hover:shadow-amber-500/30 hover:scale-105 transition-all"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {language === 'id' ? 'Upgrade Sekarang' : 'Upgrade Now'}
              </motion.button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
