'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2, Circle, ChevronRight, Sparkles,
  PlusCircle, CreditCard, BarChart3, BookOpen, Brain,
  Activity, Eye, Target, Flame, Trophy,
  Camera, Upload, Settings, Zap, Rocket,
  ArrowRight, ExternalLink, PartyPopper,
  Lightbulb, Shield, TrendingUp, Loader2
} from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { toast } from 'sonner'

interface OnboardingStep {
  id: string
  icon: React.ElementType
  titleId: string
  titleEn: string
  descId: string
  descEn: string
  actionLabelId?: string
  actionLabelEn?: string
  action?: string // tab to navigate to or 'add-trade' etc
  tipId?: string
  tipEn?: string
  gradient: string
  category: 'setup' | 'explore' | 'pro'
}

const steps: OnboardingStep[] = [
  // SETUP PHASE
  {
    id: 'add-account',
    icon: CreditCard,
    titleId: 'Tambah Akun Trading',
    titleEn: 'Add Trading Account',
    descId: 'Tambahkan akun trading pertama kamu — bisa dari broker manapun (FTMO, ICMarked, Exness, dll). Pilih pair utama dan mata uang.',
    descEn: 'Add your first trading account — from any broker (FTMO, ICMarkets, Exness, etc). Select your main pair and currency.',
    actionLabelId: 'Buka Tab Akun',
    actionLabelEn: 'Open Accounts Tab',
    action: 'accounts',
    tipId: 'Kamu bisa punya banyak akun dari broker berbeda, semuanya dilacak terpisah.',
    tipEn: 'You can have multiple accounts from different brokers, all tracked separately.',
    gradient: 'from-violet-500 to-purple-500',
    category: 'setup',
  },
  {
    id: 'add-trade',
    icon: PlusCircle,
    titleId: 'Catat Trade Pertama',
    titleEn: 'Log Your First Trade',
    descId: 'Catat trade pertama kamu — isi pair, entry/exit price, lot size, dan P/L. Bisa juga tambah screenshot chart dan catatan psikologi.',
    descEn: 'Log your first trade — fill in pair, entry/exit price, lot size, and P/L. You can also add chart screenshots and psychology notes.',
    actionLabelId: 'Catat Trade',
    actionLabelEn: 'Log Trade',
    action: 'add-trade',
    tipId: 'Jujur sama loss — data yang akurat = insight yang berguna.',
    tipEn: 'Be honest with losses — accurate data = useful insights.',
    gradient: 'from-emerald-500 to-teal-500',
    category: 'setup',
  },
  {
    id: 'import-trades',
    icon: Upload,
    titleId: 'Import Trade (Opsional)',
    titleEn: 'Import Trades (Optional)',
    descId: 'Sudah punya history trade? Import dari CSV, screenshot chart (AI extract), atau webhook FxBlue/Myfxbook.',
    descEn: 'Already have trade history? Import from CSV, chart screenshot (AI extract), or FxBlue/Myfxbook webhooks.',
    actionLabelId: 'Buka Tab Trades',
    actionLabelEn: 'Open Trades Tab',
    action: 'trades',
    tipId: 'Screenshot AI bisa baca MT4/MT5 screenshot dan auto-extract trade data!',
    tipEn: 'Screenshot AI can read MT4/MT5 screenshots and auto-extract trade data!',
    gradient: 'from-blue-500 to-cyan-500',
    category: 'setup',
  },
  // EXPLORE PHASE
  {
    id: 'view-dashboard',
    icon: BarChart3,
    titleId: 'Lihat Dashboard Analytics',
    titleEn: 'Check Dashboard Analytics',
    descId: 'Dashboard menampilkan total P/L, win rate, profit factor, streak, dan equity curve. Semua update real-time setelah kamu catat trade.',
    descEn: 'The dashboard shows total P/L, win rate, profit factor, streaks, and equity curve. All update in real-time after you log trades.',
    actionLabelId: 'Buka Dashboard',
    actionLabelEn: 'Open Dashboard',
    action: 'dashboard',
    tipId: 'Equity curve paling penting — kalau trending naik, kamu di jalan yang benar.',
    tipEn: 'Equity curve is most important — if trending up, you\'re on the right track.',
    gradient: 'from-amber-500 to-orange-500',
    category: 'explore',
  },
  {
    id: 'write-journal',
    icon: BookOpen,
    titleId: 'Tulis Jurnal Trading',
    titleEn: 'Write Trading Journal',
    descId: 'Jurnal = secret weapon. Catat emosi (greedy, fearful, disciplined), kondisi market, dan strategi sebelum/during/after trade.',
    descEn: 'Journal = secret weapon. Record emotions (greedy, fearful, disciplined), market conditions, and strategy before/during/after trade.',
    actionLabelId: 'Buka Jurnal',
    actionLabelEn: 'Open Journal',
    action: 'journal',
    tipId: 'Trader pro selalu journal — ini yang bedain trader yang konsisten vs gambler.',
    tipEn: 'Pro traders always journal — this separates consistent traders from gamblers.',
    gradient: 'from-rose-500 to-pink-500',
    category: 'explore',
  },
  {
    id: 'check-analytics',
    icon: Activity,
    titleId: 'Explore Analytics Detail',
    titleEn: 'Explore Detailed Analytics',
    descId: 'Tab Analytics punya breakdown per pair, per session (London/NY/Asia), per hari, win rate by day, dan depth analysis lainnya.',
    descEn: 'The Analytics tab has breakdowns per pair, per session (London/NY/Asia), per day, win rate by day, and other depth analysis.',
    actionLabelId: 'Buka Analytics',
    actionLabelEn: 'Open Analytics',
    action: 'analytics',
    gradient: 'from-cyan-500 to-blue-500',
    category: 'explore',
  },
  {
    id: 'set-watchlist',
    icon: Eye,
    titleId: 'Setup Watchlist',
    titleEn: 'Setup Watchlist',
    descId: 'Tambah pair yang kamu pantau ke watchlist. Set alert harga buat entry point yang kamu tunggu.',
    descEn: 'Add pairs you\'re watching to the watchlist. Set price alerts for entry points you\'re waiting for.',
    actionLabelId: 'Buka Watchlist',
    actionLabelEn: 'Open Watchlist',
    action: 'watchlist',
    gradient: 'from-teal-500 to-emerald-500',
    category: 'explore',
  },
  // PRO PHASE
  {
    id: 'try-ai',
    icon: Brain,
    titleId: 'Coba AI Insights',
    titleEn: 'Try AI Insights',
    descId: 'AI bisa analisis trade pattern kamu, kasih performance tips, market insight, dan rekomendasi setup. Chat langsung sama AI assistant.',
    descEn: 'AI can analyze your trade patterns, give performance tips, market insights, and setup recommendations. Chat directly with the AI assistant.',
    actionLabelId: 'Buka AI',
    actionLabelEn: 'Open AI',
    action: 'ai',
    tipId: 'AI makin pintar kalau data trade kamu makin banyak — catat konsisten!',
    tipEn: 'AI gets smarter with more trade data — log consistently!',
    gradient: 'from-indigo-500 to-violet-500',
    category: 'pro',
  },
  {
    id: 'risk-calc',
    icon: Target,
    titleId: 'Risk Calculator',
    titleEn: 'Risk Calculator',
    descId: 'Hitung position size yang tepat berdasarkan account balance, risk per trade, dan stop loss. Jangan trading tanpa ini!',
    descEn: 'Calculate the correct position size based on account balance, risk per trade, and stop loss. Don\'t trade without this!',
    actionLabelId: 'Buka Risk Calc',
    actionLabelEn: 'Open Risk Calc',
    action: 'risk',
    gradient: 'from-orange-500 to-red-500',
    category: 'pro',
  },
  {
    id: 'psychology',
    icon: Flame,
    titleId: 'Trading Psychology',
    titleEn: 'Trading Psychology',
    descId: 'Track mood, FOMO level, discipline score. Dapatkan coaching tips berdasarkan pattern emosi kamu.',
    descEn: 'Track mood, FOMO level, discipline score. Get coaching tips based on your emotional patterns.',
    actionLabelId: 'Buka Psychology',
    actionLabelEn: 'Open Psychology',
    action: 'psychology',
    gradient: 'from-pink-500 to-rose-500',
    category: 'pro',
  },
]

const categoryInfo = {
  setup: {
    labelId: 'Setup Dasar',
    labelEn: 'Basic Setup',
    icon: Settings,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  explore: {
    labelId: 'Jelajahi Fitur',
    labelEn: 'Explore Features',
    icon: Zap,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  pro: {
    labelId: 'Level Pro',
    labelEn: 'Pro Level',
    icon: Trophy,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
  },
}

interface OnboardingTabProps {
  language?: 'id' | 'en'
  setActiveTab?: (tab: string) => void
  setAddTradeOpen?: (open: boolean) => void
  userId?: string
}

export default function OnboardingTab({ language: langProp, setActiveTab, setAddTradeOpen, userId }: OnboardingTabProps) {
  const { t, language: ctxLang } = useLanguage()
  const language = langProp || ctxLang

  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  const [activeStepId, setActiveStepId] = useState<string | null>(null)
  const [celebrationStep, setCelebrationStep] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Load progress from API first, then fall back to localStorage
  useEffect(() => {
    const loadProgress = async () => {
      // Try API first (server-side persistence)
      try {
        const res = await fetch('/api/onboarding/progress', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          if (data.steps && Array.isArray(data.steps) && data.steps.length > 0) {
            setCompletedSteps(new Set(data.steps))
            // Also cache to localStorage for offline use
            localStorage.setItem('luxtrade-onboarding-progress', JSON.stringify(data.steps))
            setLoaded(true)
            return
          }
        }
      } catch (err) {
        console.warn('[OnboardingTab] Failed to load from API, falling back to localStorage:', err)
      }

      // Fallback to localStorage
      try {
        const saved = localStorage.getItem('luxtrade-onboarding-progress')
        if (saved) {
          const parsed = JSON.parse(saved) as string[]
          setCompletedSteps(new Set(parsed))
        }
      } catch {}
      setLoaded(true)
    }
    loadProgress()
  }, [])

  // Save progress to both localStorage and API
  const saveProgress = useCallback(async (steps: Set<string>) => {
    // Always save to localStorage immediately
    try {
      localStorage.setItem('luxtrade-onboarding-progress', JSON.stringify([...steps]))
    } catch {}

    // Also persist to API (non-blocking)
    try {
      setSyncing(true)
      const res = await fetch('/api/onboarding/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ steps: [...steps] }),
      })
      if (!res.ok) {
        console.warn('[OnboardingTab] Failed to sync progress to server:', res.status)
      }
    } catch (err) {
      console.warn('[OnboardingTab] Failed to sync progress to server:', err)
    } finally {
      setSyncing(false)
    }
  }, [])

  const toggleStep = useCallback((stepId: string) => {
    setCompletedSteps(prev => {
      const next = new Set(prev)
      const wasCompleted = next.has(stepId)
      if (wasCompleted) {
        next.delete(stepId)
      } else {
        next.add(stepId)
        // Celebration animation
        setCelebrationStep(stepId)
        setTimeout(() => setCelebrationStep(null), 1500)
        // Show toast for completion
        toast.success(isId ? 'Step diselesaikan! 🎉' : 'Step completed! 🎉')
      }
      saveProgress(next)
      return next
    })
  }, [saveProgress, language])

  const handleAction = useCallback((step: OnboardingStep) => {
    if (step.action === 'add-trade') {
      setAddTradeOpen?.(true)
    } else if (step.action && setActiveTab) {
      setActiveTab(step.action)
    }
  }, [setActiveTab, setAddTradeOpen])

  const resetProgress = useCallback(() => {
    setCompletedSteps(new Set())
    localStorage.removeItem('luxtrade-onboarding-progress')
  }, [])

  const totalSteps = steps.length
  const completedCount = completedSteps.size
  const progressPct = Math.round((completedCount / totalSteps) * 100)
  const isAllComplete = completedCount === totalSteps

  const getCategorySteps = (cat: string) => steps.filter(s => s.category === cat)
  const getCategoryProgress = (cat: string) => {
    const catSteps = getCategorySteps(cat)
    const done = catSteps.filter(s => completedSteps.has(s.id)).length
    return { done, total: catSteps.length, pct: Math.round((done / catSteps.length) * 100) }
  }

  const isId = language === 'id'

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="overflow-hidden border-0">
          <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-6 md:p-8 text-white relative">
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <Badge className="bg-white/20 text-white border-0 text-xs">
                  {isId ? 'Panduan Interaktif' : 'Interactive Guide'}
                </Badge>
                {isAllComplete && (
                  <Badge className="bg-emerald-500/80 text-white border-0 text-xs flex items-center gap-1">
                    <PartyPopper className="w-3 h-3" />
                    {isId ? 'Selesai!' : 'Complete!'}
                  </Badge>
                )}
              </div>

              <h1 className="text-2xl md:text-3xl font-bold mb-2">
                {isId ? 'Selamat Datang di LuxTradee! 🚀' : 'Welcome to LuxTradee! 🚀'}
              </h1>
              <p className="text-white/80 text-sm md:text-base mb-4">
                {isId
                  ? 'Selesaikan checklist di bawah untuk menguasai semua fitur. Checklist tiap step biar kamu beneran explore — bukan cuma baca.'
                  : 'Complete the checklist below to master all features. Check each step after you actually explore it — not just read about it.'}
              </p>

              {/* Overall Progress */}
              <div className="bg-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    {isId ? 'Progress Keseluruhan' : 'Overall Progress'}
                  </span>
                  <span className="text-sm font-bold">
                    {completedCount}/{totalSteps} ({progressPct}%)
                  </span>
                </div>
                <Progress value={progressPct} className="h-2 bg-white/20 [&>div]:bg-white" />
                {isAllComplete && (
                  <motion.p
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-emerald-300 text-sm mt-2 font-medium flex items-center gap-1"
                  >
                    <PartyPopper className="w-4 h-4" />
                    {isId ? 'Kamu sudah menguasai semua fitur! Happy trading!' : 'You\'ve mastered all features! Happy trading!'}
                  </motion.p>
                )}
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Category Sections */}
      {(['setup', 'explore', 'pro'] as const).map((category, catIndex) => {
        const info = categoryInfo[category]
        const catSteps = getCategorySteps(category)
        const catProg = getCategoryProgress(category)
        const CatIcon = info.icon

        return (
          <motion.div
            key={category}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: catIndex * 0.1 }}
          >
            {/* Category Header */}
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg ${info.bg}`}>
                <CatIcon className={`w-4 h-4 ${info.color}`} />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-base">
                  {isId ? info.labelId : info.labelEn}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {catProg.done}/{catProg.total} {isId ? 'selesai' : 'done'}
                </p>
              </div>
              {catProg.pct === 100 && (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {isId ? 'Selesai' : 'Done'}
                </Badge>
              )}
            </div>

            {/* Steps */}
            <div className="space-y-2">
              {catSteps.map((step, stepIndex) => {
                const isCompleted = completedSteps.has(step.id)
                const isExpanded = activeStepId === step.id
                const isCelebrating = celebrationStep === step.id
                const StepIcon = step.icon

                return (
                  <motion.div
                    key={step.id}
                    initial={false}
                    animate={isCelebrating ? { scale: [1, 1.02, 1] } : {}}
                    transition={{ duration: 0.3 }}
                  >
                    <Card
                      className={`
                        cursor-pointer transition-all duration-200 overflow-hidden
                        ${isCompleted
                          ? 'bg-emerald-500/5 border-emerald-500/20'
                          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-blue-500/30'
                        }
                      `}
                    >
                      <div
                        className="flex items-center gap-3 p-4"
                        onClick={() => setActiveStepId(isExpanded ? null : step.id)}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleStep(step.id)
                          }}
                          className={`
                            flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center
                            transition-all duration-200
                            ${isCompleted
                              ? 'bg-emerald-500 border-emerald-500'
                              : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                            }
                          `}
                          aria-label={isCompleted ? (isId ? 'Tandai belum selesai' : 'Mark incomplete') : (isId ? 'Tandai selesai' : 'Mark complete')}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          ) : (
                            <Circle className="w-4 h-4 text-transparent" />
                          )}
                        </button>

                        {/* Icon */}
                        <div className={`
                          flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${step.gradient}
                          flex items-center justify-center
                          ${isCompleted ? 'opacity-60' : ''}
                        `}>
                          <StepIcon className="w-5 h-5 text-white" />
                        </div>

                        {/* Title */}
                        <div className="flex-1 min-w-0">
                          <h3 className={`font-medium text-sm ${isCompleted ? 'line-through text-gray-400 dark:text-gray-500' : ''}`}>
                            {isId ? step.titleId : step.titleEn}
                          </h3>
                        </div>

                        {/* Expand arrow */}
                        <ChevronRight className={`
                          w-4 h-4 flex-shrink-0 text-gray-400 transition-transform duration-200
                          ${isExpanded ? 'rotate-90' : ''}
                        `} />
                      </div>

                      {/* Expanded Content */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 pt-0 border-t border-gray-100 dark:border-gray-800 mt-0">
                              <div className="pt-3 space-y-3">
                                {/* Description */}
                                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                  {isId ? step.descId : step.descEn}
                                </p>

                                {/* Tip */}
                                {(step.tipId || step.tipEn) && (
                                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                    <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                                      {isId ? step.tipId! : step.tipEn!}
                                    </p>
                                  </div>
                                )}

                                {/* Action Button */}
                                {step.action && !isCompleted && (
                                  <Button
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleAction(step)
                                    }}
                                    className="gap-1.5 text-xs"
                                  >
                                    {isId ? step.actionLabelId : step.actionLabelEn}
                                    <ExternalLink className="w-3 h-3" />
                                  </Button>
                                )}

                                {step.action && isCompleted && (
                                  <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    {isId ? 'Sudah selesai!' : 'Done!'}
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )
      })}

      {/* Quick Tips Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <Card className="p-6 border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="font-bold text-lg">
              {isId ? 'Tips Penting Buat Trader Baru' : 'Important Tips for New Traders'}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: Shield,
                titleId: 'Jujur Sama Loss',
                titleEn: 'Be Honest with Losses',
                descId: 'Jangan manipulasi data loss. Data jelek yang jujur > data bagus yang palsu.',
                descEn: 'Don\'t manipulate loss data. Honest bad data > fake good data.',
              },
              {
                icon: TrendingUp,
                titleId: 'Review Setiap Weekend',
                titleEn: 'Review Every Weekend',
                descId: 'Buka Analytics + Weekly Report setiap minggu. Cari pattern — apa yang kerja, apa yang ga.',
                descEn: 'Open Analytics + Weekly Report every week. Find patterns — what works, what doesn\'t.',
              },
              {
                icon: Flame,
                titleId: 'Konsisten > Sempurna',
                titleEn: 'Consistent > Perfect',
                descId: 'Catat SETIAP trade. Trader yang konsisten jurnalnya selalu perform lebih baik.',
                descEn: 'Log EVERY trade. Traders who journal consistently always perform better.',
              },
            ].map((tip, i) => {
              const TipIcon = tip.icon
              return (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/50 dark:bg-gray-800/50">
                  <TipIcon className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-sm mb-1">
                      {isId ? tip.titleId : tip.titleEn}
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      {isId ? tip.descId : tip.descEn}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </motion.div>

      {/* Reset / Footer */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {isId
            ? (syncing ? 'Menyimpan ke server...' : 'Progress disimpan otomatis')
            : (syncing ? 'Syncing to server...' : 'Progress saved automatically')}
        </p>
        {completedCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetProgress}
            className="text-xs text-gray-400 hover:text-red-400"
          >
            {isId ? 'Reset Progress' : 'Reset Progress'}
          </Button>
        )}
      </div>
    </div>
  )
}
