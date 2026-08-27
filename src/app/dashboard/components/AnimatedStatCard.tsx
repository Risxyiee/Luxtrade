'use client'

import { useState, useEffect, useRef } from 'react'
import { type LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { motion } from 'framer-motion'

// Number counter animation hook with smooth easing
function useCountUp(end: number, duration: number = 1500, start: number = 0, decimals: number = 2) {
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

interface AnimatedStatCardProps {
  title: string
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
  subtitle?: string
  icon?: LucideIcon
  iconColor?: string
  iconBgColor?: string
  gradientBg?: string
  valueColor?: string
  trend?: {
    value: number
    positive: boolean
  }
  color?: 'blue' | 'emerald' | 'red' | 'amber'
}

function AnimatedStatCard({
  title,
  value,
  prefix = '',
  suffix = '',
  decimals = 2,
  subtitle,
  icon: Icon,
  iconColor = 'text-blue-500 dark:text-blue-400',
  iconBgColor = 'bg-blue-500/20',
  valueColor = 'text-lux-text-primary dark:text-white',
  trend,
  color = 'blue'
}: AnimatedStatCardProps) {
  const animatedValue = useCountUp(isFinite(value) ? value : 0, 1500, 0, decimals)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0)
    return () => clearTimeout(timer)
  }, [])

  const gradientColors: Record<string, string> = {
    blue: 'from-blue-500 to-cyan-600',
    emerald: 'from-emerald-500 to-green-600',
    red: 'from-red-500 to-rose-600',
    amber: 'from-amber-500 to-orange-600',
  }

  const gradientColor = gradientColors[color] || gradientColors.blue

  return (
    <Card className="bg-lux-bg-card dark:bg-[#060810] border-lux-border dark:border-blue-900/30 overflow-hidden relative group hover:border-blue-500/50 transition-all duration-300">
      {/* Gradient accent line at top */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradientColor} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-lux-text-secondary dark:text-gray-400">{title}</CardTitle>
          {Icon && (
            <div className={`p-2 rounded-lg ${iconBgColor}`}>
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={mounted ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <div className={`text-2xl font-bold mb-1 ${valueColor}`}>
            {!isFinite(value) ? '∞' : <>{prefix}{animatedValue.toFixed(decimals)}{suffix}</>}
          </div>
          {subtitle && (
            <p className="text-xs text-lux-text-muted dark:text-gray-500">{subtitle}</p>
          )}
          {trend && (
            <div className={`text-xs flex items-center gap-1 ${trend.positive ? 'text-emerald-400' : 'text-red-400'}`}>
              {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </div>
          )}
        </motion.div>
      </CardContent>
    </Card>
  )
}

export default AnimatedStatCard