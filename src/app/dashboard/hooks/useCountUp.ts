import { useState, useEffect, useRef } from 'react'

// Number counter animation hook with smooth easing
export function useCountUp(end: number, duration: number = 1500, start: number = 0, decimals: number = 2) {
  const [count, setCount] = useState(start)
  const countRef = useRef(start)
  const startTimeRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const prevEndRef = useRef(end)

  useEffect(() => {
    // Reset animation when end value changes
    if (prevEndRef.current !== end) {
      startTimeRef.current = null
      prevEndRef.current = end
    }

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1)

      // Smooth easing function
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      const current = start + (end - start) * easeOutQuart

      countRef.current = current
      setCount(current)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [end, duration, start])

  return count
}
