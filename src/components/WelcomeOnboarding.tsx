'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Camera,
  Database,
  Loader2,
  ArrowRight,
  Brain,
  BarChart3,
  Upload,
  Zap,
  Trophy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface WelcomeOnboardingProps {
  isOpen: boolean
  onClose: () => void
  onAddFirstTrade: () => void
  onLoadSampleData: () => void
  onUpgrade?: () => void
  language?: 'id' | 'en'
}

/* ------------------------------------------------------------------ */
/*  Confetti CSS (pure keyframes, no library)                         */
/* ------------------------------------------------------------------ */
const CONFETTI_COLORS = [
  '#f59e0b', '#f97316', '#a855f7', '#ec4899', '#22d3ee', '#10b981', '#e11d48', '#6366f1',
]

function ConfettiParticles() {
  const [particles] = useState(() =>
    Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 2.5,
      duration: 2.5 + Math.random() * 2,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 6 + Math.random() * 8,
      rotation: Math.random() * 360,
      sway: (Math.random() - 0.5) * 200,
    }))
  )

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-20px) rotate(0deg) translateX(0px);
            opacity: 1;
          }
          25% {
            transform: translateY(25vh) rotate(${90 + Math.random() * 90}deg) translateX(40px);
            opacity: 1;
          }
          50% {
            transform: translateY(50vh) rotate(${180 + Math.random() * 90}deg) translateX(-30px);
            opacity: 0.8;
          }
          75% {
            transform: translateY(75vh) rotate(${270 + Math.random() * 90}deg) translateX(20px);
            opacity: 0.6;
          }
          100% {
            transform: translateY(105vh) rotate(360deg) translateX(-10px);
            opacity: 0;
          }
        }
      `}</style>
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute top-0"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size * 0.6}px`,
            backgroundColor: p.color,
            borderRadius: '2px',
            animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s both`,
          }}
        />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Feature Card                                                       */
/* ------------------------------------------------------------------ */
function FeatureCard({
  icon,
  title,
  desc,
  gradient,
  delay,
  lang,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  gradient: string
  delay: number
  lang: 'id' | 'en'
}) {
  const t = (id: string, en: string) => (lang === 'id' ? id : en)
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className="relative rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 text-left"
    >
      <div
        className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${gradient}`}
      >
        {icon}
      </div>
      <h4 className="text-sm font-semibold text-white mb-1">{title}</h4>
      <p className="text-xs leading-relaxed text-gray-400">{desc}</p>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Step Indicators                                                    */
/* ------------------------------------------------------------------ */
function StepIndicators({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <motion.div
          key={i}
          className="rounded-full"
          animate={
            i === current
              ? { width: 28, backgroundColor: '#f59e0b' }
              : i < current
                ? { width: 28, backgroundColor: 'rgba(249,115,22,0.4)' }
                : { width: 8, backgroundColor: 'rgba(255,255,255,0.1)' }
          }
          transition={{ duration: 0.35 }}
          style={{ height: 6 }}
        />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function WelcomeOnboarding({
  isOpen,
  onClose,
  onAddFirstTrade,
  onLoadSampleData,
  onUpgrade,
  language = 'id',
}: WelcomeOnboardingProps) {
  const [step, setStep] = useState(0) // 0=welcome, 1=action, 2=reward
  const [loadingSample, setLoadingSample] = useState(false)
  const [actionTaken, setActionTaken] = useState<'screenshot' | 'sample' | null>(null)


  const t = (id: string, en: string) => (language === 'id' ? id : en)

  const finish = () => {
    localStorage.setItem('luxtrade_onboarding_done', 'true')
    onClose()
  }

  const handleScreenshot = () => {
    setActionTaken('screenshot')
    setTimeout(() => {
      setStep(2)
    }, 400)
    setTimeout(() => {
      finish()
      onAddFirstTrade()
    }, 3500)
  }

  const handleLoadSample = async () => {
    setLoadingSample(true)
    try {
      await onLoadSampleData()
      setActionTaken('sample')
      setTimeout(() => setStep(2), 400)
      setTimeout(() => finish(), 4500)
    } catch {
      setLoadingSample(false)
    }
  }

  const handleGoToDashboard = () => {
    finish()
  }

  /* ---- Animation Variants ---- */
  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 120 : -120,
      opacity: 0,
      scale: 0.95,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -120 : 120,
      opacity: 0,
      scale: 0.95,
    }),
  }

  const [direction, setDirection] = useState(0)

  const goNext = () => {
    setDirection(1)
    setStep((s) => s + 1)
  }

  if (!isOpen) return null

  const showClose = step === 2

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        {/* Backdrop — only clickable on step 2 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
          onClick={showClose ? finish : undefined}
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.88, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.88, y: 30 }}
          transition={{ type: 'spring', damping: 22, stiffness: 260 }}
          className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/[0.08] bg-[#080b12] shadow-2xl shadow-blue-500/10"
          style={{ minHeight: 520 }}
        >
          {/* Top accent glow */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-amber-500/10 via-orange-500/5 to-transparent" />

          {/* Close button — only on step 2 */}
          {showClose && (
            <button
              onClick={finish}
              className="absolute right-4 top-4 z-20 rounded-xl p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              <span className="sr-only">Close</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          )}

          {/* Step Indicators */}
          <div className="relative z-10 px-8 pt-6">
            <StepIndicators current={step} total={3} />
          </div>

          {/* ==================== STEP CONTENT ==================== */}
          <div className="relative overflow-hidden">
            <AnimatePresence mode="wait" custom={direction}>
              {/* ---------- STEP 1: WELCOME ---------- */}
              {step === 0 && (
                <motion.div
                  key="welcome"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="px-8 pb-8 pt-4"
                >
                  {/* Big Sparkles Icon */}
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{
                      type: 'spring',
                      damping: 12,
                      stiffness: 180,
                      delay: 0.15,
                    }}
                    className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/30"
                  >
                    <Sparkles className="h-10 w-10 text-white" />
                  </motion.div>

                  {/* Heading */}
                  <motion.h2
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25, duration: 0.45 }}
                    className="mb-2 text-center text-3xl font-extrabold tracking-tight text-white"
                  >
                    {t(
                      '🎉 Selamat Datang, Trader!',
                      '🎉 Welcome, Trader!'
                    )}
                  </motion.h2>

                  <motion.p
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35, duration: 0.45 }}
                    className="mb-8 text-center text-sm text-gray-400"
                  >
                    {t(
                      'LuxTrade siap jadi partner trading kamu. Lihat apa yang bisa kamu lakukan:',
                      "LuxTrade is ready to be your trading partner. Here's what you can do:"
                    )}
                  </motion.p>

                  {/* 3 Feature Cards */}
                  <div className="mb-8 flex flex-col gap-3">
                    <FeatureCard
                      icon={<Camera className="h-5 w-5 text-white" />}
                      title={t('Screenshot → Trade Otomatis', 'Screenshot → Auto Trade')}
                      desc={t(
                        'Upload screenshot trade, AI langsung baca & simpan datanya.',
                        'Upload a trade screenshot, AI reads & saves the data instantly.'
                      )}
                      gradient="from-amber-400 to-orange-500"
                      delay={0.4}
                      lang={language}
                    />
                    <FeatureCard
                      icon={<Brain className="h-5 w-5 text-white" />}
                      title={t('AI Deteksi Kesalahan', 'AI Error Detection')}
                      desc={t(
                        'AI menganalisis pola & mendeteksi kesalahan trading berulang.',
                        'AI analyzes patterns & detects recurring trading mistakes.'
                    )}
                      gradient="from-blue-500 to-cyan-600"
                      delay={0.5}
                      lang={language}
                    />
                    <FeatureCard
                      icon={<BarChart3 className="h-5 w-5 text-white" />}
                      title={t('Analitik Mendalam', 'Deep Analytics')}
                      desc={t(
                        'Dashboard lengkap: win rate, equity curve, laporan mingguan.',
                        'Full dashboard: win rate, equity curve, weekly reports.'
                      )}
                      gradient="from-emerald-400 to-teal-500"
                      delay={0.6}
                      lang={language}
                    />
                  </div>

                  {/* CTA */}
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7, duration: 0.45 }}
                  >
                    <Button
                      onClick={goNext}
                      className="h-14 w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-base font-bold text-white shadow-lg shadow-amber-500/25 transition-all hover:from-amber-400 hover:to-orange-400 hover:shadow-amber-500/40"
                    >
                      {t('Lanjut — Ayo Mulai!', "Let's Go!")}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </motion.div>
                </motion.div>
              )}

              {/* ---------- STEP 2: QUICK WIN ---------- */}
              {step === 1 && (
                <motion.div
                  key="action"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="px-8 pb-8 pt-4"
                >
                  {/* Heading */}
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    className="mb-2 text-center"
                  >
                    <h2 className="text-2xl font-extrabold tracking-tight text-white">
                      {t(
                      '🚀 Trade Pertama Kamu',
                      '🚀 Your First Trade'
                      )}
                    </h2>
                    <p className="mt-2 text-sm text-gray-400">
                      {t(
                        'Pilih cara tercepat untuk mulai. Keduanya equally awesome!',
                        'Pick the fastest way to start. Both are equally awesome!'
                      )}
                    </p>
                  </motion.div>

                  {/* Two Big Action Cards */}
                  <div className="mt-6 flex flex-col gap-4">
                    {/* Option A: Upload Screenshot */}
                    <motion.button
                      initial={{ opacity: 0, x: -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2, duration: 0.5 }}
                      onClick={handleScreenshot}
                      className="group relative w-full overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent p-5 text-left transition-all hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/10"
                    >
                      {/* Glow on hover */}
                      <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-br from-amber-500/0 to-orange-500/0 transition-all group-hover:from-amber-500/10 group-hover:to-orange-500/10" />

                      <div className="relative flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/30">
                          <Upload className="h-7 w-7 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-bold text-white">
                            {t('Upload Screenshot Trade', 'Upload Trade Screenshot')}
                          </h3>
                          <p className="mt-1 text-xs leading-relaxed text-gray-400">
                            {t(
                              'Upload 1 screenshot → AI baca datanya → trade tersimpan otomatis. Cepat & instan!',
                              'Upload 1 screenshot → AI reads the data → trade saved automatically. Fast & instant!'
                            )}
                          </p>
                          <div className="mt-3 flex items-center gap-1.5 text-amber-400 text-xs font-semibold">
                            <Zap className="h-3.5 w-3.5" />
                            {t('Paling Direkomendasikan', 'Most Recommended')}
                          </div>
                        </div>
                      </div>
                    </motion.button>

                    {/* Divider */}
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-white/[0.06]" />
                      <span className="text-[11px] font-medium uppercase tracking-widest text-gray-500">
                        {t('atau', 'or')}
                      </span>
                      <div className="h-px flex-1 bg-white/[0.06]" />
                    </div>

                    {/* Option B: Load Sample Data */}
                    <motion.button
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3, duration: 0.5 }}
                      onClick={handleLoadSample}
                      disabled={loadingSample}
                      className="group relative w-full overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent p-5 text-left transition-all hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/10 disabled:opacity-60 disabled:pointer-events-none"
                    >
                      <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-br from-blue-500/0 to-blue-500/0 transition-all group-hover:from-blue-500/10 group-hover:to-blue-500/10" />

                      <div className="relative flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg shadow-blue-500/30">
                          {loadingSample ? (
                            <Loader2 className="h-7 w-7 text-white animate-spin" />
                          ) : (
                            <Database className="h-7 w-7 text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-bold text-white">
                            {loadingSample
                              ? t('Memuat data...', 'Loading data...')
                              : t('Muat Data Contoh', 'Load Sample Data')
                            }
                          </h3>
                          <p className="mt-1 text-xs leading-relaxed text-gray-400">
                            {t(
                              'Langsung lihat bagaimana dashboard terisi data. Demo 15 trade realistis.',
                              'Instantly see how the dashboard looks with data. 15 realistic demo trades.'
                            )}
                          </p>
                          <div className="mt-3 flex items-center gap-1.5 text-cyan-400 text-xs font-semibold">
                            <Sparkles className="h-3.5 w-3.5" />
                            {t('Instan — 1 klik', 'Instant — 1 click')}
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  </div>

                  {/* Upgrade link */}
                  {onUpgrade && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="mt-5 text-center text-xs text-gray-500"
                    >
                      {t('Ingin langsung full akses?', 'Want full access right away?')}{' '}
                      <button
                        onClick={() => {
                          localStorage.setItem('luxtrade_onboarding_done', 'true')
                          onUpgrade()
                        }}
                        className="font-semibold text-amber-400 transition-colors hover:text-amber-300"
                      >
                        {t('Upgrade ke PRO →', 'Upgrade to PRO →')}
                      </button>
                    </motion.p>
                  )}
                </motion.div>
              )}

              {/* ---------- STEP 3: REWARD ---------- */}
              {step === 2 && (
                <motion.div
                  key="reward"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="relative px-8 pb-8 pt-4"
                >
                  {/* Confetti */}
                  <ConfettiParticles />

                  {/* Content */}
                  <div className="relative z-20 flex flex-col items-center text-center">
                    {/* Trophy icon */}
                    <motion.div
                      initial={{ scale: 0, rotate: -15 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{
                        type: 'spring',
                        damping: 10,
                        stiffness: 160,
                        delay: 0.15,
                      }}
                      className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 shadow-2xl shadow-amber-500/40"
                    >
                      <Trophy className="h-12 w-12 text-white" />
                    </motion.div>

                    {/* Celebration text */}
                    <motion.h2
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.5 }}
                      className="mb-2 text-2xl font-extrabold text-white"
                    >
                      {t(
                        'Trade pertama kamu sudah tersimpan! 🎉',
                        'Your first trade has been saved! 🎉'
                      )}
                    </motion.h2>

                    <motion.p
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4, duration: 0.45 }}
                      className="mb-6 text-sm text-gray-400"
                    >
                      {t(
                        'Kamu telah membuka kunci hadiah spesial:',
                        "You've unlocked a special reward:"
                      )}
                    </motion.p>

                    {/* Reward Badge */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8, y: 12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{
                        type: 'spring',
                        damping: 14,
                        stiffness: 200,
                        delay: 0.5,
                      }}
                      className="mb-8 flex items-center gap-3 rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 px-6 py-4"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500">
                        <Zap className="h-6 w-6 text-white" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-medium text-amber-400/80">
                          {t('Hadiah Selamat Datang', 'Welcome Reward')}
                        </p>
                        <p className="text-lg font-extrabold text-white">
                          1 {t('hari', 'day')} PRO{' '}
                          <span className="text-amber-400">GRATIS</span>
                        </p>
                      </div>
                    </motion.div>

                    {/* CTA: Go to Dashboard */}
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.65, duration: 0.45 }}
                      className="w-full"
                    >
                      <Button
                        onClick={handleGoToDashboard}
                        className="h-14 w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-base font-bold text-white shadow-lg shadow-amber-500/25 transition-all hover:from-amber-400 hover:to-orange-400 hover:shadow-amber-500/40"
                      >
                        {t('Buka Dashboard', 'Open Dashboard')}
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                    </motion.div>

                    {/* Skip / close hint */}
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.85 }}
                      onClick={finish}
                      className="mt-4 text-xs text-gray-500 transition-colors hover:text-gray-300"
                    >
                      {t('Tutup', 'Close')}
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
