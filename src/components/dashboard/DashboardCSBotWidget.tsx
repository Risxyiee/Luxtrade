'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Headphones, X, Send, Minus, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

interface DashboardCSBotWidgetProps {
  language: 'id' | 'en'
  userName?: string | null
  isPro?: boolean
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

function generateSessionId(): string {
  return 'ds_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
}

export default function DashboardCSBotWidget({ language, userName, isPro }: DashboardCSBotWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId] = useState(generateSessionId)
  const [showWelcome, setShowWelcome] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const MAX_INPUT_LENGTH = 500

  // Welcome message — personalized if user is logged in
  const welcomeMessage = userName
    ? (language === 'id'
      ? `Halo ${userName}! 👋 Ada yang bisa dibantu? Tanya apa aja tentang LuxTradee, fitur, billing, atau teknis.`
      : `Hi ${userName}! 👋 How can I help? Ask about LuxTradee features, billing, or technical issues.`)
    : (language === 'id'
      ? 'Halo! 👋 Ada yang bisa dibantu? Tanya apa aja tentang LuxTradee.'
      : 'Hi! 👋 How can I help? Ask anything about LuxTradee.')

  // Quick action suggestions
  const quickActions = language === 'id'
    ? [
        { label: '💬 Cara upgrade PRO', message: 'Bagaimana cara upgrade ke paket PRO?' },
        { label: '🔧 Masalah teknis', message: 'Saya mengalami masalah teknis' },
        { label: '💳 Pertanyaan billing', message: 'Saya punya pertanyaan tentang billing' },
        { label: '📊 Fitur apa saja', message: 'Fitur apa saja yang tersedia di LuxTradee?' },
      ]
    : [
        { label: '💬 How to upgrade PRO', message: 'How do I upgrade to PRO plan?' },
        { label: '🔧 Technical issue', message: 'I am experiencing a technical issue' },
        { label: '💳 Billing question', message: 'I have a billing question' },
        { label: '📊 Available features', message: 'What features are available in LuxTradee?' },
      ]

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading])

  // Focus input when opening
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, isMinimized])

  // Re-focus input after loading completes
  useEffect(() => {
    if (!isLoading && isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isLoading, isOpen, isMinimized])

  const sendMessage = useCallback(async (messageText?: string) => {
    const trimmed = (messageText || input).trim()
    if (!trimmed || isLoading) return

    // Dismiss welcome on first user message
    if (showWelcome) setShowWelcome(false)

    const userMsg: ChatMessage = { role: 'user', content: trimmed }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      let res: Response
      try {
        res = await fetch('/api/chat/support', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, message: trimmed, language }),
          signal: controller.signal,
        })
      } catch (fetchErr) {
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
      let data: { response?: string; error?: string; limited?: boolean }
      try {
        data = await res.json()
      } catch {
        toast.error(language === 'en' ? 'Invalid response from server.' : 'Respon server tidak valid.')
        return
      }

      // Handle HTTP errors
      if (!res.ok) {
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

      // Success — add assistant reply
      const botMsg: ChatMessage = { role: 'assistant', content: data.response || '...' }
      setMessages(prev => [...prev, botMsg])

      // Track unread if minimized
      if (isMinimized) {
        setUnreadCount(prev => prev + 1)
      }

      if (data.limited) {
        toast.warning(language === 'en' ? 'Chat limit reached' : 'Batas chat tercapai')
      }
    } catch (err) {
      console.error('[DashboardCSBotWidget] Unexpected error:', err)
      toast.error(language === 'en' ? 'Something went wrong. Please try again.' : 'Terjadi kesalahan. Coba lagi ya.')
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, sessionId, language, showWelcome, isMinimized])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleOpen = () => {
    setIsOpen(true)
    setIsMinimized(false)
    setUnreadCount(0)
  }

  const handleMinimize = () => {
    setIsMinimized(true)
  }

  const handleRestore = () => {
    setIsMinimized(false)
    setUnreadCount(0)
  }

  const handleClose = () => {
    setIsOpen(false)
    setIsMinimized(false)
  }

  return (
    <>
      {/* Chat Panel */}
      {isOpen && !isMinimized && (
        <div
          ref={panelRef}
          className="fixed bottom-4 right-4 z-50 w-80 sm:w-[360px] rounded-2xl bg-[#0d1117]/98 border border-white/[0.08] backdrop-blur-xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300"
          style={{ maxHeight: 'min(480px, calc(100vh - 80px))' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-gradient-to-r from-blue-500/5 to-cyan-500/5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Headphones className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="text-sm font-semibold text-white block leading-tight">
                  {language === 'id' ? 'Bantuan LuxTradee' : 'LuxTradee Support'}
                </span>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {language === 'id' ? 'Online' : 'Online'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleMinimize}
                className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Minimize chat"
              >
                <Minus className="w-3.5 h-3.5 text-white/60" />
              </button>
              <button
                onClick={handleClose}
                className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close chat"
              >
                <X className="w-3.5 h-3.5 text-white/60" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 custom-scrollbar" style={{ maxHeight: '280px' }}>
            {/* Welcome message */}
            {showWelcome && messages.length === 0 && (
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Headphones className="w-3 h-3 text-white" />
                  </div>
                  <div className="bg-white/[0.06] text-gray-200 text-sm px-3 py-2 rounded-2xl rounded-bl-sm max-w-[85%]">
                    {welcomeMessage}
                  </div>
                </div>
                {/* Quick action buttons */}
                <div className="flex flex-wrap gap-1.5 pl-8">
                  {quickActions.map((action, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(action.message)}
                      className="text-[11px] px-2.5 py-1.5 rounded-full bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 border border-blue-500/20 transition-colors cursor-pointer"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'items-start gap-2'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Headphones className="w-3 h-3 text-white" />
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
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Headphones className="w-3 h-3 text-white" />
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

          {/* Telegram escalation link */}
          <div className="px-4 py-1.5 border-t border-white/[0.04]">
            <a
              href="https://t.me/Risxyiee"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[10px] text-white/30 hover:text-white/50 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              {language === 'id' ? 'Chat langsung admin via Telegram' : 'Chat admin directly via Telegram'}
            </a>
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
                className="flex-1 bg-white/[0.04] border border-white/[0.08] text-white text-sm rounded-xl px-3 py-2.5 placeholder:text-white/30 focus:outline-none focus:border-blue-500/30 transition-colors disabled:opacity-50"
              />
              <button
                onClick={() => sendMessage()}
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

      {/* Minimized bar */}
      {isOpen && isMinimized && (
        <button
          onClick={handleRestore}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#0d1117]/98 border border-white/[0.08] backdrop-blur-xl shadow-2xl shadow-black/40 hover:border-blue-500/30 transition-all cursor-pointer group"
        >
          <div className="w-7 h-7 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 flex items-center justify-center">
            <Headphones className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-xs font-medium text-white/80 group-hover:text-white transition-colors">
            {language === 'id' ? 'Bantuan' : 'Support'}
          </span>
          {unreadCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-bold">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Floating Button — only show when chat is closed */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="fixed bottom-4 right-4 z-50 w-11 h-11 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/20 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer group"
          aria-label={language === 'id' ? 'Buka bantuan' : 'Open support chat'}
        >
          <Headphones className="w-5 h-5 text-white" />
          {/* Pulse ring */}
          <span className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 animate-ping opacity-20" />
          {/* Tooltip */}
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-[#0d1117]/95 border border-white/[0.08] text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {language === 'id' ? '💬 Butuh bantuan?' : '💬 Need help?'}
          </span>
        </button>
      )}
    </>
  )
}
