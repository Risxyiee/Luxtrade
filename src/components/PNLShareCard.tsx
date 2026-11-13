'use client'

import { memo, useCallback } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

/* Font stack sistem — dipaksa inline pada root card supaya hasil PNG
   (html-to-image) TIDAK jatuh ke font serif ketika embed font web gagal
   (laporan Bos 13-11: hasil share card jadi Times New Roman). Font
   sistem selalu tersedia saat SVG foreignObject dirasterisasi. */
export const SHARE_CARD_FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

/* FIX LOGO KOSONG (laporan Bos 14-11: "sharecard trade juga sama masih
   kosong logo nya"): dulu pakai <img src="/logo.png"> — html-to-image
   sering gagal inline gambar EKSTERNAL saat merasterisasi (fetch/URL
   blob gagal diam-diam) → kotak logo kosong di hasil PNG. Sekarang logo
   digambar sebagai SVG INLINE di dalam DOM card — pasti ikut terklon &
   terekspor, tanpa request network, identik antara preview & PNG. */
function LuxLogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0 }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="lux-logo-gold" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fbbf24" />
          <stop offset="0.55" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
      </defs>
      {/* badge emas membulat */}
      <rect x="1" y="1" width="46" height="46" rx="12" fill="url(#lux-logo-gold)" />
      <rect x="1" y="1" width="46" height="46" rx="12" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
      {/* candlestick naik — motif trading */}
      <rect x="10" y="26" width="5" height="12" rx="1.5" fill="rgba(255,255,255,0.92)" />
      <rect x="12" y="22" width="1.6" height="4" fill="rgba(255,255,255,0.7)" />
      <rect x="19" y="19" width="5" height="12" rx="1.5" fill="rgba(255,255,255,0.92)" />
      <rect x="21" y="14" width="1.6" height="5" fill="rgba(255,255,255,0.7)" />
      {/* panah naik */}
      <path d="M16 21 L24 13 L29 17.5 L36 10" stroke="#0a0c12" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M31.5 9.5 H36.5 V14.5" stroke="#0a0c12" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

interface PNLShareCardProps {
  symbol: string
  type: string
  entryPrice: number
  exitPrice: number
  lotSize: number
  profitLoss: number
  session: string
  date: string
}

const PNLShareCard = memo(function PNLShareCard({
  symbol,
  type,
  entryPrice,
  exitPrice,
  lotSize,
  profitLoss,
  session,
  date,
}: PNLShareCardProps) {
  const isProfit = profitLoss >= 0
  const isBuy = (type || '').toUpperCase() !== 'SELL'
  const pnlFormatted = Math.abs(profitLoss).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  const fmtPrice = (v: number) => {
    // 0 / null / NaN berarti data kosong (laporan Bos: ENTRY tampil "0") → tampilkan "-"
    if (!v || Number.isNaN(v)) return '-'
    // Show enough precision for forex pairs, trim trailing zeros
    const str = v.toFixed(Math.abs(v) < 10 ? 5 : 2)
    return str.replace(/\.?0+$/, '') || '-'
  }

  const handleDownload = useCallback(async () => {
    const node = document.getElementById('pnl-share-card')
    if (!node) return
    try {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(node, {
        pixelRatio: 3,
        backgroundColor: '#0a0c12',
        cacheBust: true,
        skipFonts: true, // jangan embed @font-face web — paksa font sistem inline, anti serif
      })
      const link = document.createElement('a')
      const safeSymbol = (symbol || 'trade').replace(/[^A-Za-z0-9]/g, '')
      link.download = `luxtradee-${safeSymbol}-pnl.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('[ShareCard] PNG download failed:', err)
    }
  }, [symbol])

  return (
    <div
      id="pnl-share-card"
      style={{ fontFamily: SHARE_CARD_FONT }}
      className="w-[340px] rounded-2xl overflow-hidden bg-gradient-to-br from-[#0a0c12] via-[#0d1018] to-[#0f1219] border border-white/10 shadow-2xl select-none"
    >
      {/* Header — branding + session */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <LuxLogoMark size={38} />
          <div className="leading-tight">
            <span className="text-[15px] font-bold text-white tracking-wide">LuxTradee</span>
            <div className="text-[9px] text-gray-500 uppercase tracking-[0.18em]">Jurnal Trading</div>
          </div>
        </div>
        {session && (
          <span className="px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-semibold text-blue-300 uppercase tracking-wider">
            {session}
          </span>
        )}
      </div>

      {/* Symbol + direction */}
      <div className="px-5 pt-5">
        <div className="flex items-center gap-3">
          <span className="text-[28px] font-extrabold text-white tracking-tight leading-none">{symbol}</span>
          <span
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${
              isBuy
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                : 'bg-red-500/15 text-red-400 border border-red-500/25'
            }`}
          >
            {isBuy ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {isBuy ? 'BUY' : 'SELL'}
          </span>
        </div>
      </div>

      {/* P&L hero — the main visual */}
      <div className="px-5 py-6 text-center">
        <div
          className={`inline-flex items-center gap-3 px-6 py-4 rounded-2xl border ${
            isProfit
              ? 'bg-emerald-500/10 border-emerald-500/25'
              : 'bg-red-500/10 border-red-500/25'
          }`}
        >
          {isProfit ? (
            <TrendingUp className="w-8 h-8 text-emerald-400" />
          ) : (
            <TrendingDown className="w-8 h-8 text-red-400" />
          )}
          <span
            className={`text-[36px] font-extrabold tracking-tight tabular-nums ${
              isProfit ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {isProfit ? '+' : '-'}${pnlFormatted}
          </span>
        </div>
        <div className="mt-2.5 text-[10px] text-gray-500 uppercase tracking-[0.25em]">
          Laba &amp; Rugi
        </div>
      </div>

      {/* Trade details — 3-column grid */}
      <div className="px-5 pb-5">
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl bg-white/[0.04] border border-white/5 px-2.5 py-3 text-center">
            <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Entry</div>
            <div className="text-[13px] font-semibold text-white font-mono">{fmtPrice(entryPrice)}</div>
          </div>
          <div className="rounded-xl bg-white/[0.04] border border-white/5 px-2.5 py-3 text-center">
            <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Exit</div>
            <div className="text-[13px] font-semibold text-white font-mono">{fmtPrice(exitPrice)}</div>
          </div>
          <div className="rounded-xl bg-white/[0.04] border border-white/5 px-2.5 py-3 text-center">
            <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Lot</div>
            <div className="text-[13px] font-semibold text-white font-mono">{lotSize ? String(lotSize) : '-'}</div>
          </div>
        </div>
      </div>

      {/* Footer — date + website + download */}
      <div className="px-5 py-3.5 bg-white/[0.03] border-t border-white/5 flex items-center justify-between">
        <span className="text-[11px] text-gray-400">{date}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
            luxtradee.web.id
          </span>
        </div>
      </div>
    </div>
  )
})

export default PNLShareCard
