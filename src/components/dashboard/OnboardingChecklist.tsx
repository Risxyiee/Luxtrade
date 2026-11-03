'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  BarChart3, CheckCircle2, Crown, PenLine, Upload, X,
  type LucideIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'

// ==================== PERSISTENCE KEYS ====================

const STEPS_KEY = 'lux_onboarding_steps' // JSON array of done step ids
const DISMISS_KEY = 'lux_onboarding_dismissed' // 'true' setelah ditutup

// ==================== STEPS ====================

type StepAction = { kind: 'tab'; tab: string } | { kind: 'add-trade' } | { kind: 'upgrade' }

interface ChecklistStep {
  id: string
  label: string
  hint: string
  cta: string
  icon: LucideIcon
  action: StepAction
}

const STEPS: ChecklistStep[] = [
  {
    id: 'upload-screenshot',
    label: 'Upload screenshot chart MT5/TradingView',
    hint: 'AI bisa ekstrak data trade dari screenshot.',
    cta: 'Buka Trades',
    icon: Upload,
    action: { kind: 'tab', tab: 'trades' },
  },
  {
    id: 'add-manual-trade',
    label: 'Catat trade manual pertamamu',
    hint: 'Isi pair, lot, entry/exit, dan P/L.',
    cta: 'Catat Trade',
    icon: PenLine,
    action: { kind: 'add-trade' },
  },
  {
    id: 'view-analytics',
    label: 'Lihat analitik & equity curve',
    hint: 'Win rate, profit factor, kurva ekuitas.',
    cta: 'Buka Analitik',
    icon: BarChart3,
    action: { kind: 'tab', tab: 'analytics' },
  },
  {
    id: 'upgrade-pro',
    label: 'Upgrade ke PRO',
    hint: 'Semua fitur premium tanpa batas.',
    cta: 'Lihat Paket',
    icon: Crown,
    action: { kind: 'upgrade' },
  },
]

// ==================== HELPERS ====================

function readStringArray(key: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

function readDismissed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(DISMISS_KEY) === 'true'
  } catch {
    return false
  }
}

// ==================== COMPONENT ====================

interface OnboardingChecklistProps {
  /** Navigasi ke tab dashboard yang sudah ada (trades, analytics, dll). */
  onNavigate: (tab: string) => void
  /** Buka wizard catat trade manual. */
  onAddTrade: () => void
  /** Buka modal pilih paket (upgrade PRO). */
  onUpgrade: () => void
  /** User PRO — step upgrade disembunyikan. */
  isPro?: boolean
}

export default function OnboardingChecklist({
  onNavigate,
  onAddTrade,
  onUpgrade,
  isPro = false,
}: OnboardingChecklistProps) {
  // Parent dashboard dirender client-only (ssr: false), jadi aman baca
  // localStorage langsung di initializer — tanpa risiko hydration mismatch.
  const [doneSteps, setDoneSteps] = useState<string[]>(() => readStringArray(STEPS_KEY))
  const [dismissed, setDismissed] = useState<boolean>(() => readDismissed())
  const reduceMotion = useReducedMotion()

  const visibleSteps = useMemo(
    () => STEPS.filter(step => !(isPro && step.id === 'upgrade-pro')),
    [isPro]
  )
  const totalSteps = visibleSteps.length
  const doneCount = useMemo(
    () => visibleSteps.filter(step => doneSteps.includes(step.id)).length,
    [visibleSteps, doneSteps]
  )
  const progressPct = totalSteps > 0 ? Math.round((doneCount / totalSteps) * 100) : 0
  const isComplete = totalSteps > 0 && doneCount === totalSteps

  const dismiss = useCallback(() => {
    setDismissed(true)
    try {
      window.localStorage.setItem(DISMISS_KEY, 'true')
    } catch { /* private mode — biarkan sesi ini saja */ }
  }, [])

  // Semua langkah selesai → auto-dismiss setelah delay singkat.
  useEffect(() => {
    if (dismissed || !isComplete) return
    const timer = window.setTimeout(dismiss, 2000)
    return () => window.clearTimeout(timer)
  }, [dismissed, isComplete, dismiss])

  // Persist progres checklist (dipanggil tiap doneSteps berubah).
  useEffect(() => {
    try {
      window.localStorage.setItem(STEPS_KEY, JSON.stringify(doneSteps))
    } catch { /* private mode */ }
  }, [doneSteps])

  const toggleStep = useCallback((id: string) => {
    setDoneSteps(prev =>
      prev.includes(id) ? prev.filter(stepId => stepId !== id) : [...prev, id]
    )
  }, [])

  const runStepAction = useCallback(
    (step: ChecklistStep) => {
      if (step.action.kind === 'tab') onNavigate(step.action.tab)
      else if (step.action.kind === 'add-trade') onAddTrade()
      else onUpgrade()
    },
    [onNavigate, onAddTrade, onUpgrade]
  )

  if (dismissed) return null

  return (
    <motion.section
      aria-label="Panduan memulai LuxTradee"
      initial={reduceMotion ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="mx-3 mt-3 sm:mx-4 sm:mt-4"
    >
      {/* Override --primary → emerald agar Checkbox & Progress shadcn hijau (bukan biru) */}
      <Card
        className="gap-0 rounded-xl border bg-card p-4 text-card-foreground shadow-sm sm:p-6"
        style={{ '--primary': '#10b981' } as CSSProperties}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground sm:text-lg">
              Selamat datang di LuxTradee 👋
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Lengkapi langkah cepat berikut untuk mulai melacak trading-mu.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Tutup panduan"
            onClick={dismiss}
            className="-mr-1.5 -mt-1.5 h-11 w-11 shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <Progress
            value={progressPct}
            className="h-2 flex-1"
            aria-label={`Progres onboarding ${progressPct} persen`}
          />
          <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
            {doneCount}/{totalSteps} selesai
          </span>
        </div>

        {isComplete ? (
          <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
            <p className="text-sm font-medium text-foreground">
              Mantap, semua langkah selesai! Selamat trading.
            </p>
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {visibleSteps.map(step => {
              const done = doneSteps.includes(step.id)
              const Icon = step.icon
              return (
                <li key={step.id} className="flex items-center gap-3 py-2">
                  <Checkbox
                    id={`lux-onboarding-${step.id}`}
                    checked={done}
                    onCheckedChange={() => toggleStep(step.id)}
                    aria-label={`Tandai selesai: ${step.label}`}
                    className="size-5 shrink-0"
                  />
                  <label
                    htmlFor={`lux-onboarding-${step.id}`}
                    className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 py-1"
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        done
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`block text-sm font-medium ${
                          done ? 'text-muted-foreground line-through' : 'text-foreground'
                        }`}
                      >
                        {step.label}
                      </span>
                      <span className="block text-xs text-muted-foreground">{step.hint}</span>
                    </span>
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runStepAction(step)}
                    aria-label={`${step.cta} — ${step.label}`}
                    className="h-11 shrink-0 text-xs sm:h-9 sm:text-sm"
                  >
                    {step.cta}
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </motion.section>
  )
}
