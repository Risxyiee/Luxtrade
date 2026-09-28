'use client'

import { useState, useEffect } from 'react'

/**
 * Hook to safely use framer-motion animations on mobile.
 * Returns `repeatCount: 0` on mobile (disables infinite loops)
 * and `repeatCount: Infinity` on desktop.
 *
 * Usage:
 * ```tsx
 * const { repeatCount } = useMotionSafe()
 * <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: repeatCount, duration: 2 }} />
 * ```
 */
export function useMotionSafe() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    const mql = window.matchMedia('(max-width: 767px)')
    mql.addEventListener('change', check)
    return () => mql.removeEventListener('change', check)
  }, [])

  return {
    isMobile,
    repeatCount: isMobile ? 0 : Infinity,
    /** Whether to show animations at all */
    shouldAnimate: !isMobile,
  }
}
