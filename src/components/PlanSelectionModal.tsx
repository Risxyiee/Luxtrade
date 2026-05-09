'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, Crown, Sparkles, Zap, Clock, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import PaymentConfirmationModal from './PaymentConfirmationModal'

interface Plan {
  id: string
  name: string
  description: string
  price: number
  duration: string
  durationValue: number
  durationType: 'month' | 'year' | 'lifetime'
  features: string[]
  popular?: boolean
  highlight?: boolean
}

interface PlanSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectPlan: (plan: Plan) => void
}

const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Perfect for getting started',
    price: 0,
    duration: 'forever',
    durationValue: 0,
    durationType: 'lifetime',
    features: [
      'Up to 5 trades',
      'Basic trade tracking',
      'Trade journal',
      'Basic analytics'
    ]
  },
  {
    id: 'pro-1-month',
    name: 'Elite Pro',
    description: 'Best for serious traders',
    price: 49000,
    duration: '1 month',
    durationValue: 1,
    durationType: 'month',
    features: [
      'Unlimited trades',
      'All Free features',
      'Advanced analytics',
      'Export to PDF/CSV',
      'AI trade insights',
      'Custom indicators',
      'Email support'
    ],
    popular: true
  },
  {
    id: 'pro-6-months',
    name: 'Elite Pro',
    description: 'Save 20% with 6-month plan',
    price: 235000,
    duration: '6 months',
    durationValue: 6,
    durationType: 'month',
    features: [
      'Unlimited trades',
      'All 1-month features',
      'Priority support',
      'Early access to new features',
      'Detailed trade analysis'
    ]
  },
  {
    id: 'pro-1-year',
    name: 'Elite Pro',
    description: 'Best value - Save 40%',
    price: 588000,
    duration: '1 year',
    durationValue: 1,
    durationType: 'year',
    features: [
      'Unlimited trades',
      'All 6-month features',
      '1-on-1 support session',
      'Custom dashboard setup',
      'API access'
    ]
  },
  {
    id: 'lifetime-ultra',
    name: 'Lifetime Ultra',
    description: 'Limited to 30 slots only',
    price: 100000,
    duration: 'Lifetime',
    durationValue: 999,
    durationType: 'lifetime',
    features: [
      'All Elite Pro features',
      'LIFETIME access (no renewal)',
      'Exclusive trading signals',
      '1-on-1 coaching session',
      'Private community access',
      'Priority feature requests',
      'VIP WhatsApp support'
    ],
    highlight: true
  }
]

export default function PlanSelectionModal({ isOpen, onClose, onSelectPlan }: PlanSelectionModalProps) {
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(price)
  }

  const handlePlanSelect = (plan: Plan) => {
    // For Elite Pro and Lifetime Ultra plans, show payment confirmation modal
    if (plan.name === 'Elite Pro' || plan.name === 'Lifetime Ultra') {
      setSelectedPlan(plan)
      setShowPaymentModal(true)
    } else {
      // For Free plan, just select it directly
      onSelectPlan(plan)
    }
  }

  const handlePaymentModalClose = () => {
    setShowPaymentModal(false)
    setSelectedPlan(null)
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-6xl max-h-[90vh] overflow-y-auto"
        >
          {/* Main Card */}
          <div className="relative bg-gradient-to-br from-[#0A0612] via-[#1A0F2E] to-[#0D0715] border border-purple-500/30 rounded-3xl overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 backdrop-blur-xl border-b border-purple-500/30">
              <div className="relative p-6">
                {/* Animated gradient */}
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/30 to-pink-500/30 animate-pulse" />
                
                <div className="relative flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                      <Sparkles className="w-8 h-8 text-amber-300" />
                      Choose Your Plan
                    </h2>
                    <p className="text-purple-200 text-sm mt-1">
                      Unlock all premium features
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    <X className="w-6 h-6 text-white" />
                  </button>
                </div>
              </div>
            </div>

            {/* Plans Grid */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {plans.map((plan, index) => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.4 }}
                  onMouseEnter={() => setHoveredPlan(plan.id)}
                  onMouseLeave={() => setHoveredPlan(null)}
                  onClick={() => handlePlanSelect(plan)}
                  className={`
                    relative rounded-2xl border-2 p-6 cursor-pointer transition-all duration-300
                    ${
                      hoveredPlan === plan.id
                        ? 'border-purple-400 scale-105 shadow-2xl shadow-purple-500/30'
                        : 'border-purple-500/20 hover:border-purple-500/50 hover:shadow-lg'
                    }
                    ${
                      plan.highlight
                        ? 'bg-gradient-to-b from-amber-500/10 to-transparent'
                        : 'bg-white/[0.02]'
                    }
                    ${
                      plan.popular
                        ? 'bg-gradient-to-b from-purple-500/10 to-transparent'
                        : ''
                    }
                  `}
                >
                  {/* Popular Badge */}
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-3 py-1 shadow-lg">
                        POPULAR
                      </Badge>
                    </div>
                  )}

                  {/* Lifetime Badge */}
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold px-3 py-1 shadow-lg flex items-center gap-1">
                        <Crown className="w-3 h-3" />
                        LIMITED
                      </Badge>
                    </div>
                  )}

                  {/* Plan Name */}
                  <div className="text-center mb-4">
                    <h3 className="text-xl font-bold text-white mb-1">
                      {plan.name}
                    </h3>
                    <p className="text-white/60 text-xs">
                      {plan.description}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="text-center mb-4">
                    {plan.price === 0 ? (
                      <div className="text-3xl font-bold text-white">FREE</div>
                    ) : (
                      <div>
                        <div className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                          {formatPrice(plan.price)}
                        </div>
                        <div className="text-sm text-white/60 mt-1 flex items-center justify-center gap-1">
                          <Clock className="w-3 h-3" />
                          / {plan.duration}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  <div className="space-y-2 mb-6">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span className="text-white/80">{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`
                      w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all
                      ${
                        plan.highlight
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'
                          : plan.popular
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'
                          : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300'
                      }
                    `}
                  >
                    {plan.price === 0 ? 'Get Started' : 'Choose Plan'}
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </motion.div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6">
              <div className="flex items-center justify-center gap-2 text-white/40 text-sm">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Instant activation after payment</span>
                <span className="mx-2">•</span>
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Payment Confirmation Modal */}
      {selectedPlan && (
        <PaymentConfirmationModal
          isOpen={showPaymentModal}
          onClose={handlePaymentModalClose}
          planName={selectedPlan.name}
          planPrice={selectedPlan.price}
        />
      )}
    </AnimatePresence>
  )
}
