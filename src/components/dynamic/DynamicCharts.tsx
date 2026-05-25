'use client'

import dynamic from 'next/dynamic'

/**
 * Dynamic imports for heavy chart components to improve initial load performance
 * These components will be code-split and loaded on-demand
 */

export const PerformanceChart = dynamic(
  () => import('@/app/dashboard/components/PerformanceChart'),
  {
    loading: () => (
      <div className="h-64 bg-gray-800/50 rounded-xl animate-pulse flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading chart...</div>
      </div>
    ),
    ssr: false
  }
)

export const MarketHeatmap = dynamic(
  () => import('@/app/dashboard/tabs/HeatmapTab'),
  {
    loading: () => (
      <div className="h-64 bg-gray-800/50 rounded-xl animate-pulse flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading heatmap...</div>
      </div>
    ),
    ssr: false
  }
)

export const TradingScoreChart = dynamic(
  () => import('@/components/TradingScore'),
  {
    loading: () => (
      <div className="h-64 bg-gray-800/50 rounded-xl animate-pulse flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading score...</div>
      </div>
    ),
    ssr: false
  }
)

export const CandlestickChart = dynamic(
  () => import('@/components/CandlestickChart'),
  {
    loading: () => (
      <div className="h-64 bg-gray-800/50 rounded-xl animate-pulse flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading chart...</div>
      </div>
    ),
    ssr: false
  }
)

export const TradingStreaks = dynamic(
  () => import('@/components/TradingStreaks'),
  {
    loading: () => (
      <div className="h-64 bg-gray-800/50 rounded-xl animate-pulse flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading streaks...</div>
      </div>
    ),
    ssr: false
  }
)

export const LuxtradeMiniChart = dynamic(
  () => import('@/components/LuxtradeMiniChart'),
  {
    loading: () => (
      <div className="h-16 w-32 bg-gray-800/50 rounded-lg animate-pulse" />
    ),
    ssr: false
  }
)
