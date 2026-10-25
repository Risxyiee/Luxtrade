'use client'

/**
 * AppInstallBanner — banner install aplikasi di atas Dashboard.
 *
 * • Deteksi OS via navigator.userAgent (Android / iOS / Desktop) → UI dinamis.
 * • Android  : tombol "Download APK" (file /luxtradee.apk, sudah signed).
 * • iOS      : panduan 2 langkah "Add to Home Screen" (tanpa tombol download —
 *              iOS tidak mengizinkan instal APK/APPA).
 * • Desktop  : arahan membuka luxtradee.web.id di HP.
 * • Dismiss  : tersimpan di localStorage (key: hideInstallBannerLuxtrade),
 *              tidak muncul lagi setelah ditutup.
 * • Tidak tampil jika aplikasi sudah berjalan dalam mode standalone (sudah terinstal).
 * • 100% CSS/Tailwind + Lucide — 0 gambar, ringan untuk semua device.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  X, Smartphone, Apple, Share, MonitorSmartphone, Download, Info,
} from 'lucide-react'

type OsType = 'android' | 'ios' | 'desktop' | null

const STORAGE_KEY = 'hideInstallBannerLuxtrade'

/** Deteksi OS dari userAgent — jalan di client saja (aman hydration). */
function detectOs(): OsType {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent

  // iPadOS 13+ melapor sebagai "Macintosh" — bedakan lewat layar sentuh.
  const isIOS = /iPad|iPhone|iPod/.test(ua)
    || (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1)
  if (isIOS) return 'ios'
  if (/android/i.test(ua)) return 'android'
  return 'desktop'
}

/** Sudah terinstal sebagai app (bukan tab browser)? → banner tidak perlu. */
function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return window.matchMedia?.('(display-mode: standalone)').matches || iosStandalone
}

export default function AppInstallBanner() {
  const [osType, setOsType] = useState<OsType>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Sudah pernah ditutup user? → jangan ganggu lagi.
    let dismissed = false
    try {
      dismissed = window.localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      // localStorage bisa gagal (private mode) — tetap tampilkan di sesi ini saja.
    }
    if (dismissed || isRunningStandalone()) return

    setOsType(detectOs())
    setVisible(true)
  }, [])

  const handleDismiss = useCallback(() => {
    setVisible(false)
    try {
      window.localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // ignore — banner tetap hilang untuk sesi ini.
    }
  }, [])

  if (!visible) return null

  return (
    <section
      aria-label={osType === 'ios' ? 'Panduan instal aplikasi di iOS' : 'Instal aplikasi LuxTradee'}
      className="relative mx-3 mt-3 sm:mx-4 sm:mt-4"
    >
      {/* Kartu glassmorphism */}
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40 backdrop-blur-md">
        {/* Aksen glow ungu — pure CSS */}
        <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 h-32 w-32 rounded-full bg-purple-900/30 blur-2xl" />

        {/* Tombol tutup */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Tutup banner instal"
          className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-white/10 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3 p-3.5 pr-9 sm:items-center sm:gap-4 sm:p-4">
          {/* Ikon OS */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-purple-500/30 bg-purple-900/40 sm:h-11 sm:w-11">
            {osType === 'android' && <Smartphone className="h-5 w-5 text-purple-300" aria-hidden />}
            {osType === 'ios' && <Apple className="h-5 w-5 text-purple-300" aria-hidden />}
            {osType === 'desktop' && <MonitorSmartphone className="h-5 w-5 text-purple-300" aria-hidden />}
          </div>

          {/* Konten dinamis per OS */}
          <div className="min-w-0 flex-1">
            {osType === 'android' && (
              <>
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">Akses Luxtradee Lebih Cepat!</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-gray-400 sm:text-xs">
                      Install aplikasi Android resmi — ringan, langsung buka journal tanpa buka browser.
                      <span className="ml-1 rounded border border-white/10 bg-white/5 px-1 py-px font-mono text-[10px] text-gray-500">v1.2.0 · 1,5 MB</span>
                    </p>
                  </div>
                  <a
                    href="/luxtradee.apk"
                    download="LuxTradee.apk"
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-900/60 px-4 py-2 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-800/70 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    Download APK
                  </a>
                </div>
                <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-gray-500">
                  <Info className="mt-px h-3 w-3 shrink-0" aria-hidden />
                  Pastikan mengizinkan &lsquo;Install from Unknown Sources&rsquo; di pengaturan HP kamu.
                </p>
              </>
            )}

            {osType === 'ios' && (
              <>
                <p className="text-sm font-semibold text-white">Instal Luxtradee di iOS</p>
                <ol className="mt-1.5 space-y-1.5">
                  <li className="flex items-start gap-2 text-[11px] leading-relaxed text-gray-400 sm:text-xs">
                    <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-purple-500/40 bg-purple-900/40 text-[9px] font-bold text-purple-300">1</span>
                    <span>
                      Tekan tombol <Share className="mx-0.5 inline h-3.5 w-3.5 -translate-y-px text-purple-300" aria-hidden /> <strong className="font-semibold text-gray-200">Share</strong> (kotak dengan panah) di bawah browser.
                    </span>
                  </li>
                  <li className="flex items-start gap-2 text-[11px] leading-relaxed text-gray-400 sm:text-xs">
                    <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-purple-500/40 bg-purple-900/40 text-[9px] font-bold text-purple-300">2</span>
                    <span>
                      Pilih <strong className="font-semibold text-gray-200">&lsquo;Add to Home Screen&rsquo;</strong>.
                    </span>
                  </li>
                </ol>
              </>
            )}

            {osType === 'desktop' && (
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">Bawa Trading Journal Kamu ke HP</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-gray-400 sm:text-xs">
                    Buka <span className="rounded border border-white/10 bg-white/5 px-1.5 py-px font-mono text-[10px] text-purple-300">luxtradee.web.id</span> di browser HP kamu untuk menginstal aplikasi (mendukung iOS &amp; Android).
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
