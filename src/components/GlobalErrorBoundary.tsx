'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

export default class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    console.error('🔴 [GLOBAL ERROR] getDerivedStateFromError:', error)
    return { hasError: true, error }
  }

  /* ----------------------------------------------------------
     AUTO-RECOVERY ChunkLoadError (fix "chart kadang ilang"):
     setelah deploy baru, browser yang memegang HTML/chunk lama
     (cache service worker / tab terbuka) mencoba memuat chunk
     versi lama yang sudah tidak ada → ChunkLoadError → crash
     sampai user reload MANUAL. Sekarang: reload OTOMATIS SEKALI
     (loop-guard sessionStorage 15 detik) supaya aplikasi pulih
     sendiri tanpa campur tangan user.
     ---------------------------------------------------------- */
  private isChunkError(e?: Error): boolean {
    if (!e) return false
    const name = e.name || ''
    const msg = e.message || ''
    return (
      name === 'ChunkLoadError' ||
      /Loading (chunk|CSS chunk)/i.test(msg) ||
      /dynamically imported module/i.test(msg) ||
      /Importing a module script failed/i.test(msg) ||
      /error loading dynamically imported module/i.test(msg)
    )
  }

  private autoReloadOnce() {
    try {
      const KEY = 'ltx_chunkload_auto_reload'
      const now = Date.now()
      const last = Number(sessionStorage.getItem(KEY) || 0)
      if (now - last < 15000) return // anti-loop: maks 1× per 15 detik
      sessionStorage.setItem(KEY, String(now))
      console.warn('♻️ [GLOBAL ERROR] ChunkLoadError terdeteksi → auto-reload (cache lama pasca deploy)')
      window.location.reload()
    } catch { /* private mode — biarkan UI manual */ }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🔴 [GLOBAL ERROR] componentDidCatch:', { error, errorInfo })
    this.setState({ error, errorInfo })
    if (this.isChunkError(error)) {
      this.autoReloadOnce()
      return // reload segera — jangan tunggu render fallback
    }
  }

  render() {
    if (this.state.hasError) {
      /* ChunkLoadError → kemungkinan besar cache lama pasca deploy;
         auto-reload sudah dipicu di componentDidCatch — tampilkan
         fallback minimal (bukan layar merah menyeramkan). */
      if (this.isChunkError(this.state.error)) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-[#05070d] p-6">
            <div className="text-center space-y-2">
              <div className="w-7 h-7 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto" aria-hidden="true" />
              <div className="text-white/60 text-xs">Memuat versi terbaru Luxtradee…</div>
            </div>
          </div>
        )
      }
      return (
        <div className="min-h-screen bg-red-950 flex items-center justify-center p-6">
          <div className="max-w-2xl w-full bg-red-900/50 border border-red-500 rounded-xl p-8">
            <h1 className="text-3xl font-bold text-white mb-4">⚠️ Application Error</h1>
            <p className="text-red-200 mb-6">
              Something went wrong. The application encountered an error and couldn't recover.
            </p>

            {this.state.error && (
              <div className="bg-black/50 rounded-lg p-4 mb-4">
                <h2 className="text-lg font-semibold text-red-400 mb-2">Error Message:</h2>
                <pre className="text-red-300 text-sm overflow-auto max-h-40">
                  {this.state.error.toString()}
                </pre>
              </div>
            )}

            {this.state.errorInfo && (
              <div className="bg-black/50 rounded-lg p-4 mb-6">
                <h2 className="text-lg font-semibold text-red-400 mb-2">Component Stack:</h2>
                <pre className="text-red-300 text-xs overflow-auto max-h-60">
                  {this.state.errorInfo.componentStack}
                </pre>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-colors"
              >
                Reload Page
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
              >
                Try Again
              </button>
            </div>

            <p className="text-red-400/70 text-sm mt-6 text-center">
              If this error persists, please check the browser console for more details.
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
