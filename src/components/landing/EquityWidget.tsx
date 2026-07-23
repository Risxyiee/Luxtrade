'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface EquityPoint {
  time: number;
  value: number;
  change: number;
}

function generateEquityData(points: number): EquityPoint[] {
  const data: EquityPoint[] = []
  let equity = 10500
  for (let i = 0; i < points; i++) {
    const change = (Math.random() - 0.45) * 150
    equity = Math.max(9500, Math.min(12000, equity + change))
    data.push({ time: i, value: equity, change })
  }
  return data
}

export default function EquityWidget() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dataRef = useRef<EquityPoint[]>(generateEquityData(50))
  const [currentValue, setCurrentValue] = useState(10500)
  const [isUp, setIsUp] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const drawChart = (chartData: EquityPoint[]) => {
      const width = canvas.width
      const height = canvas.height
      ctx.clearRect(0, 0, width, height)
      const values = chartData.map(d => d.value)
      const minVal = Math.min(...values)
      const maxVal = Math.max(...values)
      const range = maxVal - minVal || 1

      const gradient = ctx.createLinearGradient(0, 0, 0, height)
      const isPositive = chartData[chartData.length - 1].value >= chartData[0].value
      if (isPositive) {
        gradient.addColorStop(0, 'rgba(147, 51, 234, 0.3)')
        gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.2)')
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)')
      } else {
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.2)')
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0)')
      }

      // Area fill
      ctx.beginPath()
      ctx.moveTo(0, height)
      chartData.forEach((point, i) => {
        const x = (i / (chartData.length - 1)) * width
        const y = height - ((point.value - minVal) / range) * height * 0.8 - height * 0.1
        ctx.lineTo(x, y)
      })
      ctx.lineTo(width, height)
      ctx.closePath()
      ctx.fillStyle = gradient
      ctx.fill()

      // Line
      ctx.beginPath()
      chartData.forEach((point, i) => {
        const x = (i / (chartData.length - 1)) * width
        const y = height - ((point.value - minVal) / range) * height * 0.8 - height * 0.1
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })

      const lineGradient = ctx.createLinearGradient(0, 0, width, 0)
      lineGradient.addColorStop(0, '#9333ea')
      lineGradient.addColorStop(0.5, '#3b82f6')
      lineGradient.addColorStop(1, '#06b6d4')
      ctx.strokeStyle = isPositive ? lineGradient : '#ef4444'
      ctx.lineWidth = 2
      ctx.stroke()
    }

    drawChart(dataRef.current)

    // Update every 2s instead of 1s to reduce CPU usage
    const interval = setInterval(() => {
      const prevData = dataRef.current
      const newData = [...prevData.slice(1)]
      const lastPoint = prevData[prevData.length - 1]
      const change = (Math.random() - 0.45) * 80
      const newValue = Math.max(9500, Math.min(12000, lastPoint.value + change))
      setCurrentValue(newValue)
      setIsUp(newValue >= lastPoint.value)
      newData.push({ time: lastPoint.time + 1, value: newValue, change })
      dataRef.current = newData
      drawChart(newData)
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  const changeAmount = currentValue - 10500
  const changePercent = ((changeAmount / 10500) * 100).toFixed(2)

  return (
    <div className="rounded-2xl backdrop-blur-xl bg-[var(--lux-inline-hover-bg)] border border-[var(--lux-inline-border)] p-6 hover:shadow-[0_0_40px_rgba(139,92,246,0.3)] transition-shadow duration-500">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-purple-300/80 font-semibold tracking-wide uppercase text-xs">Portfolio Equity</p>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-[var(--lux-text-primary)] tracking-tight">
              ${currentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`flex items-center gap-1 text-sm font-bold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
              {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {isUp ? '+' : ''}{changePercent}%
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${isUp ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'} backdrop-blur-sm`}>
            DEMO
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      </div>
      <canvas ref={canvasRef} width={500} height={160} className="w-full h-40" />
      <div className="flex items-center justify-between mt-4 text-xs text-purple-500/60 dark:text-purple-300/60 font-medium">
        <span>Start: $10,500.00</span>
        <span>Updated just now</span>
      </div>
    </div>
  )
}
