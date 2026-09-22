'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface LiveActivityFeedProps {
  language?: 'id' | 'en'
}

interface Activity {
  text_id: string
  text_en: string
  time: string
}

const SHOW_DURATION = 4000
const PAUSE_DURATION = 8000

export default function LiveActivityFeed({ language = 'id' }: LiveActivityFeedProps) {
  const [dismissed, setDismissed] = useState(true)
  const [visible, setVisible] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [activities, setActivities] = useState<Activity[]>([])
  const [hasScrolledEnough, setHasScrolledEnough] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const phaseRef = useRef<'showing' | 'pausing'>('showing')

  // Fetch real activity from API
  useEffect(() => {
    try {
      const stored = localStorage.getItem('lux-live-feed-dismissed')
      if (stored === 'true') {
        setDismissed(true)
        return
      }
    } catch {}

    setDismissed(false)

    fetch('/api/recent-activity')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.activities?.length > 0) {
          setActivities(data.activities)
        }
      })
      .catch(() => {})
  }, [])

  // Scroll listener
  useEffect(() => {
    if (dismissed || activities.length === 0) return

    const handleScroll = () => {
      if (window.scrollY > window.innerHeight * 0.5) {
        setHasScrolledEnough(true)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [dismissed, activities.length])

  // Main cycle
  useEffect(() => {
    if (dismissed || !hasScrolledEnough || activities.length === 0) return

    setVisible(true)
    phaseRef.current = 'showing'

    const cycle = () => {
      if (phaseRef.current === 'showing') {
        setVisible(false)
        phaseRef.current = 'pausing'
        timerRef.current = setTimeout(cycle, PAUSE_DURATION)
      } else {
        setCurrentIndex((prev) => (prev + 1) % activities.length)
        setVisible(true)
        phaseRef.current = 'showing'
        timerRef.current = setTimeout(cycle, SHOW_DURATION)
      }
    }

    timerRef.current = setTimeout(cycle, SHOW_DURATION)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [dismissed, hasScrolledEnough, activities.length])

  const handleDismiss = useCallback(() => {
    setDismissed(true)
    setVisible(false)
    try {
      localStorage.setItem('lux-live-feed-dismissed', 'true')
    } catch {}
  }, [])

  if (dismissed || activities.length === 0) return null

  const currentActivity = activities[currentIndex]
  const currentText = currentActivity ? (language === 'id' ? currentActivity.text_id : currentActivity.text_en) : ''

  return (
    <div className="fixed bottom-20 sm:bottom-6 left-4 sm:left-6 z-30 pointer-events-none">
      <AnimatePresence mode="wait">
        {visible && currentText && (
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="pointer-events-auto max-w-xs rounded-xl bg-white/[0.06] border border-white/[0.1] backdrop-blur-xl px-4 py-3 shadow-2xl shadow-black/40"
          >
            <div className="flex items-start gap-3">
              <span className="relative flex h-2.5 w-2.5 mt-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <p className="text-[13px] leading-snug text-gray-300 flex-1">
                {currentText}
              </p>
              <button
                onClick={handleDismiss}
                className="shrink-0 mt-0.5 p-0.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
