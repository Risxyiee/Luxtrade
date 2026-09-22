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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const MAX_INPUT_LENGTH = 500

  // Welcome message
  const welcomeMessage = language === 'id'
    ? 'Halo! 👋 Ada yang bisa dibantu? Tanya apa aja tentang LuxTrade.'
    : 'Hi! 👋 How can I help? Ask anything about LuxTrade.'

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

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    // Dismiss welcome on first user message
    if (showWelcome) setShowWelcome(false)

    const userMsg: ChatMessage = { role: 'user', content: trimmed }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: trimmed, language }),
      })

      const data = await res.json()

      if (data.error) {
        toast.error(language === 'en' ? 'Failed to send message' : 'Gagal mengirim pesan')
        return
      }

      const botMsg: ChatMessage = { role: 'assistant', content: data.response }
      setMessages(prev => [...prev, botMsg])

      if (data.limited) {
        toast.warning(language === 'en' ? 'Chat limit reached' : 'Batas chat tercapai')
      }
    } catch {
      toast.error(language === 'en' ? 'Connection error. Please try again.' : 'Gangguan koneksi. Coba lagi ya.')
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, sessionId, language, showWelcome])

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
                CS LuxTrade 🤖
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
          onClick={() => setIsOpen(true)}
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
