'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  ArrowRight, ExternalLink, PartyPopper, SkipForward,
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
  const isId = language === 'id'

  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  const [activeStepId, setActiveStepId] = useState<string | null>(null)
  const [celebrationStep, setCelebrationStep] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Cermin state utk closure — toggleStep ga perlu param dep, anti stale-closure
  const completedRef = useRef<Set<string>>(new Set())

  // Load progress from API first, then fall back to localStorage
  useEffect(() => {
    const loadProgress = async () => {
      // Try API first (server-side persistence)
      try {
        const res = await fetch('/api/onboarding/progress', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          if (data.steps && Array.isArray(data.steps) && data.steps.length > 0) {
            const s = new Set<string>(data.steps)
            completedRef.current = s
            setCompletedSteps(s)
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
          const s = new Set<string>(parsed)
          completedRef.current = s
          setCompletedSteps(s)
        }
      } catch {}
      setLoaded(true)
    }
    loadProgress()
  }, [])

  // ============================================================================
  // AUTO-DETECT (laporan Bos: "onboarding kurang interactive") — step yang
  // user BENERAN sudah kerjain otomatis tercentang, tanpa diklik manual:
  //   • punya akun trading        → 'add-account'
  //   • punya trade di jurnal     → 'add-trade'
  //   • pernah import file        → 'import-trades'
  //   • nulis jurnal              → 'write-journal'
  //   • isi watchlist             → 'set-watchlist'
  //   • pernah buka tab terkait   → 'view-dashboard' / 'check-analytics' /
  //                                 'try-ai' / 'risk-calc' / 'psychology'
  // Cek jalan tiap tab Onboarding kebuka (user balik dari fitur → update).
  // ============================================================================
  const autoToastShownRef = useRef(false)
  useEffect(() => {
    if (!loaded) return

    const applyAuto = (ids: string[]) => {
      const fresh = ids.filter(id => !completedRef.current.has(id))
      if (fresh.length === 0) return
      const next = new Set(completedRef.current)
      fresh.forEach(id => next.add(id))
      completedRef.current = next
      setCompletedSteps(next)
      void persistSteps(next)
      if (!autoToastShownRef.current) {
        autoToastShownRef.current = true
        toast.success(isId ? 'Beberapa step otomatis selesai karena kamu udah kerjain! 🎉' : 'Some steps auto-completed — you already did them! 🎉')
      }
      // Semua selesai lewat auto-detect → tandai onboarding done di DB
      if (next.size >= steps.length) {
        fetch('/api/onboarding', { method: 'POST', credentials: 'include' }).catch(() => {})
      }
    }

    // 1) Data nyata dari server (akun / trade / jurnal / watchlist)
    fetch('/api/onboarding/status', { credentials: 'include' })
      .then(res => (res.ok ? res.json() : null))
      .then(s => {
        if (!s) return
        const auto: string[] = []
        if ((s.accounts ?? 0) > 0) auto.push('add-account')
        if ((s.trades ?? 0) > 0) auto.push('add-trade')
        if ((s.journal ?? 0) > 0) auto.push('write-journal')
        if ((s.watchlist ?? 0) > 0) auto.push('set-watchlist')
        applyAuto(auto)
      })
      .catch(() => {})

    // 2) Tab yang pernah dibuka (explorasi = progress juga)
    try {
      const visited: string[] = JSON.parse(localStorage.getItem('luxtrade-visited-tabs') || '[]')
      const visitedMap: Record<string, string> = {
        dashboard: 'view-dashboard',
        analytics: 'check-analytics',
        ai: 'try-ai',
        risk: 'risk-calc',
        psychology: 'psychology',
      }
      const auto = Object.entries(visitedMap)
        .filter(([tab]) => visited.includes(tab))
        .map(([, id]) => id)
      applyAuto(auto)
    } catch {}
  }, [loaded, isId, persistSteps])

  // Save progress to both localStorage and API.
  // Laporan Bos: "progresnya ga jalan" — selain UX klik, persist ke DB dulu
  // selalu gagal karena kolom profiles.onboarding_steps belum ada (42703).
  // Sekarang: localStorage tetap instan, POST jalan best-effort, dan kalau
  // server bilang gagal persist → toast SEKALI (jangan spam tiap klik).
  const persistWarnedRef = useRef(false)
  const persistSteps = useCallback(async (steps: Set<string>) => {
    try {
      localStorage.setItem('luxtrade-onboarding-progress', JSON.stringify([...steps]))
    } catch {}

    try {
      setSyncing(true)
      const res = await fetch('/api/onboarding/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ steps: [...steps] }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.persisted === false && !persistWarnedRef.current) {
        persistWarnedRef.current = true
        console.warn('[OnboardingTab] Progress tersimpan lokal saja — jalankan SQL migrasi onboarding_steps agar persist ke server')
      }
    } catch (err) {
      console.warn('[OnboardingTab] Failed to sync progress to server:', err)
    } finally {
      setSyncing(false)
    }
  }, [])

  // Toggle step — side effects (toast/celebration/persist) DI LUAR updater
  // (dulu side-effect di dalam setState updater = anti-pattern React 18).
  const toggleStep = useCallback((stepId: string) => {
    const next = new Set(completedRef.current)
    const wasCompleted = next.has(stepId)
    if (wasCompleted) {
      next.delete(stepId)
    } else {
      next.add(stepId)
      setCelebrationStep(stepId)
      setTimeout(() => setCelebrationStep(null), 1500)
      toast.success(isId ? 'Step diselesaikan! 🎉' : 'Step completed! 🎉')
    }
    completedRef.current = next
    setCompletedSteps(next)
    void persistSteps(next)

    // 10/10 → tandai onboarding selesai di DB (auto stop buka tab ini tiap login)
    if (!wasCompleted && next.size >= steps.length) {
      fetch('/api/onboarding', { method: 'POST', credentials: 'include' }).catch(() => {})
      toast.success(isId ? 'Semua step selesai! Selamat trading! 🚀' : 'All steps done! Happy trading! 🚀')
    }
  }, [isId, persistSteps])

  // Aksi ("Buka Tab Akun" dll) → otomatis tandai step selesai + pindah tab.
  // Laporan Bos: user klik tombol aksi tapi progres diam — sekarang progress
  // jalan sendiri begitu user benar-benar gerak ke fiturnya.
  const handleAction = useCallback((step: OnboardingStep) => {
    if (!completedRef.current.has(step.id)) {
      toggleStep(step.id)
    }
    if (step.action === 'add-trade') {
      setAddTradeOpen?.(true)
    } else if (step.action && setActiveTab) {
      setActiveTab(step.action)
    }
  }, [toggleStep, setAddTradeOpen, setActiveTab])

  const resetProgress = useCallback(() => {
    completedRef.current = new Set()
    setCompletedSteps(new Set())
    localStorage.removeItem('luxtrade-onboarding-progress')
  }, [])

  // Lewati panduan (laporan Bos: user baru ga boleh dipaksa tour tiap login)
  // → tandai onboarding selesai di DB + localStorage, balik ke dashboard.
  const handleSkip = useCallback(() => {
    const id = language === 'id'
    try { localStorage.setItem('luxtrade_onboarding_done', 'true') } catch {}
    fetch('/api/onboarding', { method: 'POST', credentials: 'include' })
      .catch(() => {})
    toast.success(id ? 'Panduan dilewati. Kamu bisa buka lagi dari menu kapan aja.' : 'Guide skipped. You can reopen it from the menu anytime.')
    setActiveTab?.('dashboard')
  }, [language, setActiveTab])

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
            {/* Skip button (laporan Bos: onboarding jangan maksa) */}
            <button
              onClick={handleSkip}
              className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-xs font-medium transition-colors"
            >
              <SkipForward className="w-3.5 h-3.5" />
              {isId ? 'Lewati' : 'Skip'}
            </button>
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
                        transition-all duration-200 overflow-hidden
                        ${isCompleted
                          ? 'bg-emerald-500/5 border-emerald-500/20'
                          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-blue-500/30'
                        }
                      `}
                    >
                      {/* Baris utama = SATU target klik besar utk toggle selesai.
                          Laporan Bos: dulu cuma lingkaran kecil (24px) yang bisa
                          dicentang — di HP susah kena, klik kartu cuma buka detail
                          → "progresnya ga jalan". Sekarang klik di mana pun = centang. */}
                      <div
                        role="button"
                        tabIndex={0}
                        aria-pressed={isCompleted}
                        aria-label={isCompleted ? (isId ? 'Tandai belum selesai' : 'Mark incomplete') : (isId ? 'Tandai selesai' : 'Mark complete')}
                        onClick={() => toggleStep(step.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            toggleStep(step.id)
                          }
                        }}
                        className="flex items-center gap-3 p-4 cursor-pointer select-none min-h-[64px] active:scale-[0.99] transition-transform"
                      >
                        {/* Checkbox (visual — toggle ada di seluruh baris) */}
                        <span
                          className={`
                            flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center
                            transition-all duration-200
                            ${isCompleted
                              ? 'bg-emerald-500 border-emerald-500'
                              : 'border-gray-300 dark:border-gray-600'
                            }
                          `}
                          aria-hidden="true"
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          ) : (
                            <Circle className="w-4 h-4 text-transparent" />
                          )}
                        </span>

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

                        {/* Expand arrow — TERPISAH dari toggle: klik di sini buka
                            detail (deskripsi + tombol aksi), ga ikut mencentang */}
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? (isId ? 'Tutup detail' : 'Hide details') : (isId ? 'Lihat detail' : 'Show details')}
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveStepId(isExpanded ? null : step.id)
                          }}
                          className="flex-shrink-0 p-2 -m-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 dark:hover:bg-white/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                        >
                          <ChevronRight className={`
                            w-4 h-4 transition-transform duration-200
                            ${isExpanded ? 'rotate-90' : ''}
                          `} />
                        </button>
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

                                {/* Action Button — klik = auto-tandai selesai + pindah tab.
                                    Udah selesai → tampilkan status, bukan tombol (anti dobel) */}
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
