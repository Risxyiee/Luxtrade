'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const APK_URL = '/LuxTradee-v1.1.0-debug.apk'
const APK_SIZE = '5.5 MB'
const APK_VERSION = 'v1.1.0'
const APP_NAME = 'LuxTradee'

interface Feature {
  icon: string
  title_id: string
  title_en: string
  desc_id: string
  desc_en: string
}

const features: Feature[] = [
  {
    icon: '⚡',
    title_id: 'Dashboard Super Cepat',
    title_en: 'Blazing Fast Dashboard',
    desc_id: 'WebView dioptimasi dengan hardware acceleration & smart caching',
    desc_en: 'WebView optimized with hardware acceleration & smart caching',
  },
  {
    icon: '🔔',
    title_id: 'Notifikasi Push Real',
    title_en: 'Real Push Notifications',
    desc_id: 'Notifikasi heads-up seperti WhatsApp untuk user Pro',
    desc_en: 'Heads-up notifications like WhatsApp for Pro users',
  },
  {
    icon: '🛡️',
    title_id: 'TWA Native Experience',
    title_en: 'Native TWA Experience',
    desc_id: 'Trusted Web Activity — performa native, tanpa browser chrome',
    desc_en: 'Trusted Web Activity — native performance, no browser chrome',
  },
  {
    icon: '📱',
    title_id: 'Offline Fallback',
    title_en: 'Offline Fallback',
    desc_id: 'Tetap bisa akses meski koneksi lambat atau offline',
    desc_en: 'Still accessible even with slow or no connection',
  },
]

const steps_id = [
  'Tap tombol download di bawah',
  'Buka file APK yang terdownload',
  'Izinkan install dari sumber tidak dikenal',
  'Install & buka LuxTradee!',
]

const steps_en = [
  'Tap the download button below',
  'Open the downloaded APK file',
  'Allow install from unknown sources',
  'Install & open LuxTradee!',
]

export default function DownloadPage() {
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [lang, setLang] = useState<'id' | 'en'>('id')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('luxtrade_language') as 'id' | 'en'
      if (saved === 'id' || saved === 'en') setLang(saved)
    } catch {}
    setMounted(true)
  }, [])

  const t_id = lang === 'id'
  const handleDownload = () => {
    setDownloading(true)
    setProgress(0)

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          setTimeout(() => {
            setDownloading(false)
            // Trigger actual download
            const a = document.createElement('a')
            a.href = APK_URL
            a.download = `${APP_NAME}-${APK_VERSION}-debug.apk`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
          }, 300)
          return 100
        }
        return prev + Math.random() * 15 + 5
      })
    }, 80)
  }

  return (
    <div className="min-h-screen bg-[#050507] text-white flex flex-col">
      {/* Nav */}
      <nav className="w-full px-4 sm:px-6 py-4 flex items-center justify-between border-b border-white/5 bg-[#050507]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="LuxTradee" className="w-9 h-9 rounded-lg" />
          <span className="font-bold text-lg tracking-tight">{APP_NAME}</span>
        </div>
        <button
          onClick={() => {
            const newLang = lang === 'id' ? 'en' : 'id'
            setLang(newLang)
            try { localStorage.setItem('luxtrade_language', newLang) } catch {}
          }}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition cursor-pointer"
        >
          {lang === 'id' ? '🇬🇧 EN' : '🇮🇩 ID'}
        </button>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12 sm:py-20">
        {/* Hero Section */}
        <div className="w-full max-w-lg flex flex-col items-center text-center gap-8">
          {/* App Icon */}
          <div className="relative">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-[2rem] overflow-hidden border-2 border-cyan-400/30 shadow-[0_0_40px_rgba(79,195,247,0.15)] bg-[#0a0a0f]">
              <img src="/logo-hd-1024.png" alt="LuxTradee" className="w-full h-full object-contain p-3" />
            </div>
            <div className="absolute -bottom-1 -right-1">
              <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-400/30 text-[10px] px-2">
                {APK_VERSION}
              </Badge>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              {t_id ? 'Download ' : 'Download '}{APP_NAME}
            </h1>
            <p className="text-white/50 text-sm sm:text-base max-w-sm mx-auto leading-relaxed">
              {t_id
                ? 'Install aplikasi LuxTradee di Android untuk pengalaman trading terbaik dengan notifikasi real-time.'
                : 'Install the LuxTradee app on Android for the best trading experience with real-time notifications.'}
            </p>
          </div>

          {/* Download Button */}
          <div className="w-full space-y-3">
            <Button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full h-14 text-base font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white shadow-[0_0_30px_rgba(79,195,247,0.25)] rounded-xl transition-all cursor-pointer disabled:opacity-80"
            >
              {downloading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t_id ? 'Mendownload...' : 'Downloading...'} {Math.min(Math.round(progress), 100)}%
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {t_id ? 'Download APK' : 'Download APK'} — {APK_SIZE}
                </span>
              )}
            </Button>

            {/* Progress bar */}
            {downloading && (
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-100"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            )}

            <p className="text-white/30 text-xs text-center">
              {t_id
                ? 'Package: web.id.luxtradee.twa • Android 7.0+ • Debug Build'
                : 'Package: web.id.luxtradee.twa • Android 7.0+ • Debug Build'}
            </p>
          </div>

          {/* Install Steps */}
          <div className="w-full bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 sm:p-6 text-left space-y-4">
            <h2 className="font-semibold text-sm text-white/80 flex items-center gap-2">
              <span className="text-cyan-400">📋</span>
              {t_id ? 'Cara Install' : 'How to Install'}
            </h2>
            <ol className="space-y-3">
              {(t_id ? steps_id : steps_en).map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-white/60">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Features */}
          <div className="w-full space-y-3">
            <h2 className="font-semibold text-sm text-white/80 text-left flex items-center gap-2">
              <span className="text-cyan-400">✨</span>
              {t_id ? 'Fitur Aplikasi' : 'App Features'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {features.map((f, i) => (
                <div
                  key={i}
                  className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-1.5 hover:border-cyan-400/20 hover:bg-cyan-400/[0.03] transition-all"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{f.icon}</span>
                    <span className="font-medium text-sm text-white/90">
                      {t_id ? f.title_id : f.title_en}
                    </span>
                  </div>
                  <p className="text-xs text-white/40 leading-relaxed">
                    {t_id ? f.desc_id : f.desc_en}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Pro Badge */}
          <div className="w-full bg-gradient-to-r from-amber-500/10 to-cyan-500/10 border border-amber-400/20 rounded-2xl p-5 text-center space-y-2">
            <div className="text-2xl">👑</div>
            <h3 className="font-semibold text-sm text-amber-300">
              {t_id ? 'Pro = Notifikasi Aktif' : 'Pro = Notifications On'}
            </h3>
            <p className="text-xs text-white/40 leading-relaxed max-w-xs mx-auto">
              {t_id
                ? 'Upgrade ke Pro untuk aktifkan push notification heads-up real-time seperti WhatsApp.'
                : 'Upgrade to Pro to enable real-time heads-up push notifications like WhatsApp.'}
            </p>
          </div>

          {/* Security Notice */}
          <div className="flex items-center gap-2 text-white/20 text-xs">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.5 6c0 2.372.647 4.598 1.776 6.497M12 21a8.966 8.966 0 01-5.982-2.396 12.006 12.006 0 01-1.776-6.497M12 21c2.372 0 4.598-.647 6.497-1.776M12 21a8.966 8.966 0 005.982-2.396 12.006 12.006 0 001.776-6.497" />
            </svg>
            {t_id
              ? 'APK ini debug build untuk testing. Build release akan tersedia di Play Store.'
              : 'This APK is a debug build for testing. Release build will be on Play Store.'}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full px-4 py-6 border-t border-white/5 text-center mt-auto">
        <p className="text-white/20 text-xs">
          © 2025 {APP_NAME}. {t_id ? 'Semua hak dilindungi.' : 'All rights reserved.'}
        </p>
      </footer>
    </div>
  )
}
