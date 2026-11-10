'use client'

// ==================== WIDGET POSISI TERBUKA ====================
// Laporan Bos (2026-11): "csv jurnal dah bisa tapi open trade belum ikut
// masuk jadinya 0 terus" — posisi yang masih jalan dari import CSV kini
// masuk jurnal (konvensi notes '#OPEN#') dan ditampilkan di sini supaya
// kelihatan: simbol, arah, lot, entry, SL/TP, waktu buka.
// PnL posisi terbuka BELUM dihitung di Total P/L / Win Rate (belum final).

import { motion } from 'framer-motion'
import { useMotionSafe } from '@/hooks/use-motion-safe'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Radio } from 'lucide-react'
import { isOpenTrade, displayNotes } from '@/lib/open-trade'
import type { Trade } from '@/types'

function fmtPrice(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v) || v === 0) return '-'
  return v.toLocaleString('en-US', { maximumFractionDigits: v < 10 ? 5 : 2 })
}

function fmtDate(iso: string | null | undefined, language: 'id' | 'en'): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', { day: '2-digit', month: 'short' }) +
    ' ' + d.toLocaleTimeString(language === 'id' ? 'id-ID' : 'en-US', { hour: '2-digit', minute: '2-digit' })
}

interface OpenPositionsCardProps {
  trades: Trade[]
  language: 'id' | 'en'
}

export default function OpenPositionsCard({ trades, language }: OpenPositionsCardProps) {
  const { repeatCount } = useMotionSafe()
  const openTrades = trades.filter(t => isOpenTrade(t))

  if (openTrades.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 }}
    >
      <Card className="relative overflow-hidden bg-lux-bg-card dark:bg-gradient-to-br dark:from-[#0a0c12] dark:via-[#0c0a08] dark:to-[#080a14] border border-lux-border dark:border-amber-500/20 transition-all duration-300 hover:border-amber-500/40 hover:shadow-2xl hover:shadow-amber-500/5">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-amber-500/[0.05] rounded-full blur-3xl" />
        </div>

        <CardHeader className="relative z-10 pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20">
                  <Radio className="w-4 h-4 text-amber-400" />
                </div>
                <motion.div
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 2, repeat: repeatCount }}
                />
              </div>
              <div>
                <CardTitle className="text-base font-bold bg-gradient-to-r from-white via-amber-200 to-amber-100 bg-clip-text text-transparent">
                  {language === 'id' ? 'Posisi Terbuka' : 'Open Positions'}
                </CardTitle>
                <p className="text-[10px] text-lux-text-muted dark:text-gray-500 mt-0.5">
                  {language === 'id'
                    ? 'Masih jalan — belum dihitung di Total P/L & Win Rate'
                    : 'Still running — not counted in Total P/L & Win Rate yet'}
                </p>
              </div>
            </div>
            <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-bold px-2.5 py-1">
              {openTrades.length} {language === 'id' ? 'posisi' : 'positions'}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="relative z-10">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {openTrades.map((t, idx) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25, delay: Math.min(idx * 0.04, 0.3) }}
                className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-amber-500/30 transition-all"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-bold text-sm truncate">{t.symbol}</span>
                    <Badge
                      variant={t.type === 'BUY' ? 'default' : 'destructive'}
                      className="text-[10px] px-1.5 py-0 h-4 shrink-0"
                    >
                      {t.type}
                    </Badge>
                  </div>
                  <span className="text-[10px] font-semibold text-amber-400 shrink-0">
                    ×{t.lot_size ?? 0.01}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                  <div>
                    <p className="text-lux-text-muted dark:text-gray-500 uppercase tracking-wide">
                      {language === 'id' ? 'Entry' : 'Entry'}
                    </p>
                    <p className="font-bold text-lux-text-primary dark:text-white/90">{fmtPrice(t.open_price)}</p>
                  </div>
                  <div>
                    <p className="text-lux-text-muted dark:text-gray-500 uppercase tracking-wide">SL</p>
                    <p className="font-bold text-red-400/90">{fmtPrice(t.stop_loss)}</p>
                  </div>
                  <div>
                    <p className="text-lux-text-muted dark:text-gray-500 uppercase tracking-wide">TP</p>
                    <p className="font-bold text-emerald-400/90">{fmtPrice(t.take_profit)}</p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-white/[0.05] flex items-center justify-between text-[10px] text-lux-text-muted dark:text-gray-500">
                  <span>{fmtDate(t.open_time, language)}</span>
                  {displayNotes(t.notes) && (
                    <span className="truncate max-w-[45%] italic">{displayNotes(t.notes)}</span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-lux-text-muted dark:text-gray-500">
            <Loader2 className="w-3 h-3 animate-none" />
            {language === 'id'
              ? 'Saat posisi ditutup, edit trade ini lalu isi hasilnya — otomatis masuk statistik.'
              : 'When the position closes, edit this trade and fill the result — it will enter the stats automatically.'}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
