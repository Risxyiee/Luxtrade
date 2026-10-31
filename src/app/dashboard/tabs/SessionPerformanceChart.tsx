'use client'

/**
 * PERF (F1): chart Performa Sesi dipisah dari DashboardTab supaya recharts
 * (~100KB gz beserta dependensi d3-nya) TIDAK masuk chunk awal dashboard —
 * hanya di-load (lazy) ketika tab dashboard benar-benar dirender.
 */

import {
  BarChart, Bar, Cell, CartesianGrid, Tooltip, ResponsiveContainer, XAxis, YAxis
} from 'recharts'
import { formatCurrency } from '@/lib/utils-currency'

interface SessionPerformanceChartProps {
  data: { session: string; pl: number }[]
}

export default function SessionPerformanceChart({ data }: SessionPerformanceChartProps) {
  const chartTooltipStyle = {
    background: '#0a0c12',
    border: '1px solid rgba(59,130,246,0.3)',
    borderRadius: 8,
  }

  return (
    <div className="h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="session" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
          <Tooltip contentStyle={chartTooltipStyle} formatter={(value: number) => formatCurrency(value)} />
          <Bar dataKey="pl" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: 'rgba(255,255,255,0.5)', fontSize: 10, formatter: (v: number) => v >= 0 ? `+$${v}` : `-$${Math.abs(v)}` }}>
            {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.pl >= 0 ? '#22c55e' : '#ef4444'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
