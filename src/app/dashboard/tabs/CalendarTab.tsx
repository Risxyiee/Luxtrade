'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from 'lucide-react'

// Interface
interface Trade {
  id: string
  symbol: string
  type: 'BUY' | 'SELL'
  open_price: number
  close_price: number
  lot_size: number
  profit_loss: number
  open_time: string
  close_time: string
  session: string | null
  notes?: string
  image_url?: string | null
}

interface CalendarTabProps {
  trades: Trade[]
  language: string
}

// Component
function CalendarTab({ trades, language }: CalendarTabProps) {
  const today = new Date()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getDay()

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const emptyDays = Array.from({ length: firstDayOfMonth }, (_, i) => i)

  const tradesByDate = trades.reduce((acc, trade) => {
    const date = new Date(trade.open_time).getDate()
    acc[date] = (acc[date] || 0) + 1
    return acc
  }, {} as Record<number, number>)

  const monthNames = language === "id"
    ? ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
    : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

  const dayNames = language === "id"
    ? ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-400" />
            {monthNames[today.getMonth()]} {today.getFullYear()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-2">
            {dayNames.map(day => (
              <div key={day} className="py-2 font-medium">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {emptyDays.map((_, i) => (
              <div key={"empty-"+i} className="aspect-square" />
            ))}
            {days.map(day => {
              const tradeCount = tradesByDate[day] || 0
              const isToday = day === today.getDate()
              return (
                <motion.div
                  key={day}
                  whileHover={{ scale: 1.1 }}
                  className={"aspect-square flex items-center justify-center rounded-lg text-sm relative cursor-pointer " + (
                    isToday
                      ? "bg-purple-500 text-white font-bold"
                      : tradeCount > 0
                        ? "bg-purple-500/20 text-purple-300"
                        : "hover:bg-white/5"
                  )}
                >
                  {day}
                  {tradeCount > 0 && !isToday && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-purple-400" />
                  )}
                </motion.div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
        <CardHeader>
          <CardTitle>{language === "id" ? "Aktivitas Bulan Ini" : "This Month Activity"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-3xl font-bold text-purple-400">{trades.length}</div>
              <div className="text-xs text-gray-500">{language === "id" ? "Total Transaksi" : "Total Trades"}</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-emerald-400">{trades.filter(t => t.profit_loss >= 0).length}</div>
              <div className="text-xs text-gray-500">{language === "id" ? "Profit" : "Profit"}</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-red-400">{trades.filter(t => t.profit_loss < 0).length}</div>
              <div className="text-xs text-gray-500">{language === "id" ? "Loss" : "Loss"}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default CalendarTab
