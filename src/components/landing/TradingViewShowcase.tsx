'use client'

/**
 * ============================================================
 * TradingViewShowcase — PENGganti PineAlertShowcase (landing)
 * ============================================================
 * Direktif Bos 2026-11-11: "vela lab hapus aja, ganti semuanya
 * ke tradingview mulai dari pine alert."
 *
 * Bagian landing yang dulu menjual "Pine Script® + Alert" kini
 * menjual fitur yang BENAR-BENAR ADA: chart resmi TradingView
 * (widget tv.js — data feed langsung dari server TradingView di
 * browser user) + alert native TradingView (dibuat langsung di
 * chart, tanpa engine Pine milik server lagi).
 *
 * Chart demo live di bawah: XAU/USD 15m — data feed TradingView.
 * ============================================================
 */

import dynamic from 'next/dynamic'
import { TrendingUp, Bell, Database, Wrench, Globe } from 'lucide-react'

const TradingViewChart = dynamic(() => import('@/components/tradingview/TradingViewChart'), {
  ssr: false, // tv.js menyentuh window — client-only
  loading: () => (
    <div className="flex items-center justify-center h-full rounded-2xl border border-white/5 bg-white/[0.02]">
      <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
})

interface TradingViewShowcaseProps {
  language?: 'id' | 'en'
}

export default function TradingViewShowcase({ language = 'id' }: TradingViewShowcaseProps) {
  const t = {
    badge: language === 'id' ? 'POWERED BY TRADINGVIEW' : 'POWERED BY TRADINGVIEW',
    title:
      language === 'id'
        ? 'Chart Resmi TradingView — Data & Alert dari Sumbernya Langsung'
        : 'Official TradingView Chart — Data & Alerts Straight from the Source',
    desc:
      language === 'id'
        ? 'XAU/USD, GBP/USD, US100, crypto — semua pair memakai chart & data feed TradingView (OANDA, FX, Binance). Indikator, drawing tools, dan alert dibuat langsung di dalam chart — sama persis dengan yang kamu pakai di tradingview.com.'
        : 'XAU/USD, GBP/USD, US100, crypto — every pair uses the official TradingView chart & data feed (OANDA, FX, Binance). Indicators, drawing tools, and alerts are built right inside the chart — exactly like on tradingview.com.',
    bullets: [
      {
        icon: Database,
        title: language === 'id' ? 'Data feed broker-grade' : 'Broker-grade data feed',
        desc:
          language === 'id'
            ? 'Ditarik langsung oleh chart TradingView di browser kamu — bukan server perantara yang bisa 503.'
            : 'Pulled directly by the TradingView chart in your browser — no middleman server that can 503.',
      },
      {
        icon: Wrench,
        title: language === 'id' ? '100+ indikator & drawing tools' : '100+ indicators & drawing tools',
        desc:
          language === 'id'
            ? 'RSI, MACD, Fibonacci, dsb. — semua tool TradingView bawaan, tanpa paywall tambahan.'
            : 'RSI, MACD, Fibonacci and more — every built-in TradingView tool, no extra paywall.',
      },
      {
        icon: Bell,
        title: language === 'id' ? 'Alert harga & indikator ala Pine — gratis' : 'Price & indicator alerts ala Pine — free',
        desc:
          language === 'id'
            ? 'RSI, cross EMA, MACD, level harga — server kami hitung sendiri tiap 15 menit & push notif ke HP saat kondisi kena. Pengganti alert Pine TradingView yang wajib langganan Essential ±$13/bulan.'
            : 'RSI, EMA crosses, MACD, price levels — our server computes them every 15 minutes and pushes to your phone. Replaces Pine alerts that require a TradingView Essential plan (~$13/mo).',
      },
      {
        icon: Globe,
        title: language === 'id' ? 'Semua pair, satu tempat' : 'Every pair, one place',
        desc:
          language === 'id'
            ? 'Logam, forex, indeks, crypto — cukup ketik simbol apa pun langsung di kotak simbol chart.'
            : 'Metals, forex, indices, crypto — just type any symbol right in the chart symbol box.',
      },
    ],
    cta: language === 'id' ? 'Coba Chart + Alert Gratis' : 'Try Chart + Free Alerts',
    demoLabel: language === 'id' ? 'Demo live — XAU/USD 15m, feed TradingView' : 'Live demo — XAU/USD 15m, TradingView feed',
  }

  return (
    <section className="relative py-16 md:py-24 px-4 overflow-hidden" aria-labelledby="tv-showcase-title">
      {/* latar aksen halus */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[720px] h-[720px] rounded-full bg-blue-500/[0.05] blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto">
        {/* ---------- Header ---------- */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-[11px] font-bold tracking-wider text-blue-300">
            <TrendingUp className="w-3.5 h-3.5" />
            {t.badge}
          </span>
          <h2 id="tv-showcase-title" className="mt-4 text-3xl md:text-4xl font-extrabold leading-tight">
            {t.title}
          </h2>
          <p className="mt-4 text-white/60 text-sm md:text-base leading-relaxed">{t.desc}</p>
        </div>

        {/* ---------- Chart demo live ---------- */}
        <div className="mt-8 md:mt-10 rounded-2xl border border-white/10 bg-[#0b0b12] overflow-hidden shadow-2xl shadow-blue-500/5">
          <div className="h-[420px] md:h-[520px]">
            <TradingViewChart symbol="XAUUSD" interval="15m" />
          </div>
          <div className="border-t border-white/5 px-4 py-2.5 text-[11px] text-white/40 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            {t.demoLabel}
          </div>
        </div>

        {/* ---------- Bullets ---------- */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.bullets.map((b) => (
            <div
              key={b.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:border-blue-400/30 transition-colors"
            >
              <b.icon className="w-5 h-5 text-blue-400" />
              <h3 className="mt-3 font-bold text-sm">{b.title}</h3>
              <p className="mt-1.5 text-white/50 text-xs leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>

        {/* ---------- CTA ---------- */}
        <div className="mt-8 text-center">
          <a
            href="/auth/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-6 py-3 text-sm font-bold text-white transition-colors min-h-[48px]"
          >
            <Bell className="w-4 h-4" />
            {t.cta}
          </a>
          <p className="mt-3 text-[11px] text-white/40">
            Alert harga + indikator (RSI/EMA/MACD) push ke HP —{' '}
            <span className="text-blue-300 font-semibold">hemat ±$13/bulan</span> dibanding alert
            berbayar TradingView.
          </p>
        </div>
      </div>
    </section>
  )
}
