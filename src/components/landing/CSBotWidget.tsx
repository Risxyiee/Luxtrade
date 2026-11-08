'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send } from 'lucide-react'
import { toast } from 'sonner'

interface CSBotWidgetProps {
  language: 'id' | 'en'
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface GrowthHook {
  greeting: string
  chips: string[]
  generatedAt?: string
}

/** Amunisi proaktif dari Growth Sentinel (karyawan Kevin) — fallback statis. */
const FALLBACK_HOOK: GrowthHook = {
  greeting: '',
  chips: ['Lihat sinyal terbaru 📊', 'Cara mulai gratis? 🆓'],
}

const TEASER_DELAY_MS = 12_000 // sapa visitor setelah 12 detik menjelajah
const TEASER_SESSION_KEY = 'cs_teaser_done_v1'

function generateSessionId(): string {
  return 'cs_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
}

export default function CSBotWidget({ language }: CSBotWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId] = useState(generateSessionId)
  const [showWelcome, setShowWelcome] = useState(true)
  const [mobileCtaVisible, setMobileCtaVisible] = useState(false)
  // ── GROWTH: hook proaktif + teaser bubble ──
  const [hook, setHook] = useState<GrowthHook | null>(null)
  const [showTeaser, setShowTeaser] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const MAX_INPUT_LENGTH = 500

  // Welcome message — pakai hook sentinel kalau sudah ada (pintu depan hidup)
  const welcomeMessage = (language === 'id'
    ? (hook?.greeting || 'Halo! 👋 Ada yang bisa dibantu? Tanya apa aja tentang LuxTradee.')
    : (hook?.greeting || 'Hi! 👋 How can I help? Ask anything about LuxTradee.'))

  const chips = hook?.chips?.length ? hook.chips : FALLBACK_HOOK.chips

  // ── GROWTH: muat hook + jadwalkan teaser proaktif (1× per sesi) ──
  useEffect(() => {
    let cancelled = false
    const alreadyTeased = (() => {
      try { return sessionStorage.getItem(TEASER_SESSION_KEY) === '1' } catch { return true }
    })()

    const timer = setTimeout(async () => {
      if (cancelled) return
      try {
        const res = await fetch('/api/growth/cs-hook')
        if (res.ok && !cancelled) {
          const data = await res.json()
          if (data?.hook?.greeting) {
            setHook({ greeting: data.hook.greeting, chips: data.hook.chips || FALLBACK_HOOK.chips })
          }
        }
      } catch { /* offline — fallback chips tetap jalan */ }
      if (!cancelled && !alreadyTeased && !document.hidden) {
        setShowTeaser(true)
        try { sessionStorage.setItem(TEASER_SESSION_KEY, '1') } catch { /* private mode */ }
        // Teaser menghilang sendiri setelah 25 detik kalau diabaikan
        setTimeout(() => { if (!cancelled) setShowTeaser(false) }, 25_000)
      }
    }, TEASER_DELAY_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  // Check if mobile CTA is visible to adjust positioning
  useEffect(() => {
    const checkMobileCta = () => {
      const mobileCta = document.getElementById('mobile-cta')
      if (mobileCta) {
        const rect = mobileCta.getBoundingClientRect()
        setMobileCtaVisible(rect.bottom > 0 && rect.top < window.innerHeight)
      }
    }
    checkMobileCta()
    window.addEventListener('scroll', checkMobileCta, { passive: true })
    window.addEventListener('resize', checkMobileCta, { passive: true })
    return () => {
      window.removeEventListener('scroll', checkMobileCta)
      window.removeEventListener('resize', checkMobileCta)
    }
  }, [])

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading])

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Also re-focus input after loading completes
  useEffect(() => {
    if (!isLoading && isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isLoading, isOpen])

  /** Kirim teks ke bot (dipakai input manual & chip quick-reply proaktif). */
  const sendText = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return

    // Dismiss welcome & teaser saat visitor mulai ngobrol
    if (showWelcome) setShowWelcome(false)
    setShowTeaser(false)

    const userMsg: ChatMessage = { role: 'user', content: trimmed }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      let res: Response
      try {
        res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, message: trimmed, language }),
          signal: controller.signal,
        })
      } catch (fetchErr) {
        // Network error or abort
        clearTimeout(timeoutId)
        if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
          toast.error(language === 'en' ? 'Response timed out. Please try again.' : 'Waktu habis. Coba lagi ya.')
        } else {
          toast.error(language === 'en' ? 'Connection error. Please try again.' : 'Gangguan koneksi. Coba lagi ya.')
        }
        return
      }

      clearTimeout(timeoutId)

      // Parse response
      let data: { response?: string; error?: string; limited?: boolean; leadCaptured?: boolean }
      try {
        data = await res.json()
      } catch {
        toast.error(language === 'en' ? 'Invalid response from server.' : 'Respon server tidak valid.')
        return
      }

      // Handle HTTP errors
      if (!res.ok) {
        // On 503, show service unavailable message
        if (res.status === 503) {
          const botMsg: ChatMessage = {
            role: 'assistant',
            content: data.response || (language === 'en'
              ? 'AI service is currently unavailable. Try again in a moment.'
              : 'Layanan AI sedang tidak tersedia. Coba lagi sebentar.')
          }
          setMessages(prev => [...prev, botMsg])
          return
        }
        toast.error(data.error || (language === 'en' ? 'Failed to send message' : 'Gagal mengirim pesan'))
        return
      }

      // Handle API-level errors
      if (data.error) {
        toast.error(language === 'en' ? 'Failed to send message' : 'Gagal mengirim pesan')
        return
      }

      // Success — add assistant reply to messages
      const botMsg: ChatMessage = { role: 'assistant', content: data.response || '...' }
      setMessages(prev => [...prev, botMsg])

      // GROWTH: email lead tersimpan → konfirmasi kecil biar visitor yakin
      if (data.leadCaptured) {
        toast.success(language === 'en'
          ? 'Email noted! We\'ll send you free signals 📬'
          : 'Email tercatat! Sinyal & tips gratis segera meluncur 📬')
      }

      if (data.limited) {
        toast.warning(language === 'en' ? 'Chat limit reached' : 'Batas chat tercapai')
      }
    } catch (err) {
      // Catch-all for any unexpected errors
      console.error('[CSBotWidget] Unexpected error:', err)
      toast.error(language === 'en' ? 'Something went wrong. Please try again.' : 'Terjadi kesalahan. Coba lagi ya.')
    } finally {
      // CRITICAL: Always reset isLoading so input is never permanently locked
      setIsLoading(false)
    }
  }, [isLoading, sessionId, language, showWelcome])

  const sendMessage = useCallback(() => sendText(input), [sendText, input])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Bottom position: move up when mobile CTA is visible
  const bottomOffset = mobileCtaVisible ? 'bottom-20 md:bottom-6' : 'bottom-6'

  return (
    <>
      {/* GROWTH: Teaser proaktif — bot menyapa dulu (hook dari Growth Sentinel) */}
      {showTeaser && !isOpen && (
        <div
          className={`fixed ${bottomOffset} right-4 z-40 mb-16 w-72 sm:w-80 rounded-2xl bg-[#0a0a14]/95 border border-white/[0.08] backdrop-blur-xl shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-300`}
          role="status"
          aria-label="Pesan sambutan CS LuxTradee"
        >
          <button
            onClick={() => setShowTeaser(false)}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Tutup pesan"
          >
            <X className="w-3 h-3 text-white/60" />
          </button>
          <div className="px-4 pt-3 pb-2.5">
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                🤖
              </div>
              <p className="text-sm text-gray-200 leading-snug pr-4">
                {hook?.greeting || welcomeMessage}
              </p>
            </div>
            {/* Quick-reply chips — 1 klik = langsung ngobrol */}
            <div className="flex flex-wrap gap-1.5 mt-2.5 pl-8">
              {chips.slice(0, 3).map((chip) => (
                <button
                  key={chip}
                  onClick={() => {
                    setIsOpen(true)
                    setShowTeaser(false)
                    setShowWelcome(false)
                    sendText(chip)
                  }}
                  className="text-xs px-2.5 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.1] text-gray-200 hover:bg-white/[0.12] hover:border-white/[0.2] transition-colors cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div
          className={`fixed ${bottomOffset} right-4 z-40 w-80 sm:w-96 rounded-2xl bg-[#0a0a14]/95 border border-white/[0.08] backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 flex items-center justify-center text-xs">
                🤖
              </div>
              <span className="text-sm font-semibold text-white">
                CS LuxTradee 🤖
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close chat"
            >
              <X className="w-3.5 h-3.5 text-white/60" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 max-h-80 overflow-y-auto px-4 py-3 space-y-3 custom-scrollbar">
            {/* Welcome message */}
            {showWelcome && messages.length === 0 && (
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                  🤖
                </div>
                <div className="bg-white/[0.06] text-gray-200 text-sm px-3 py-2 rounded-2xl rounded-bl-sm max-w-[85%]">
                  {welcomeMessage}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'items-start gap-2'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                    🤖
                  </div>
                )}
                <div
                  className={`text-sm px-3 py-2 max-w-[85%] whitespace-pre-wrap break-words ${
                    msg.role === 'user'
                      ? 'bg-blue-500/20 text-white rounded-2xl rounded-br-sm'
                      : 'bg-white/[0.06] text-gray-200 rounded-2xl rounded-bl-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                  🤖
                </div>
                <div className="bg-white/[0.06] text-gray-200 text-sm px-3 py-2.5 rounded-2xl rounded-bl-sm">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="px-3 py-3 border-t border-white/[0.08]">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT_LENGTH))}
                onKeyDown={handleKeyDown}
                placeholder={language === 'id' ? 'Ketik pesan...' : 'Type a message...'}
                disabled={isLoading}
                className="flex-1 bg-white/[0.04] border border-white/[0.08] text-white text-sm rounded-xl px-3 py-2.5 placeholder:text-white/30 focus:outline-none focus:border-white/[0.15] transition-colors disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="w-9 h-9 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 flex items-center justify-center transition-all hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex-shrink-0"
                aria-label="Send message"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => { setIsOpen(true); setShowTeaser(false) }}
          className={`fixed ${bottomOffset} right-4 z-40 w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer group`}
          aria-label="Open chat"
        >
          <MessageCircle className="w-5 h-5 text-white" />
          {/* Pulse ring */}
          <span className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 animate-ping opacity-20" />
        </button>
      )}
    </>
  )
}
