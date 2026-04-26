'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  MessageSquare, X, Send, Bot, User, Trash2, 
  Sparkles, Minimize2, Maximize2, ChevronDown,
  TrendingUp, BarChart3, BookOpen, Target, Brain,
  Shield, Clock
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// Quick suggestion buttons
const QUICK_SUGGESTIONS = [
  { icon: TrendingUp, text: 'Tips trading harian', color: 'from-emerald-500 to-teal-600' },
  { icon: Target, text: 'Cara setting Stop Loss', color: 'from-rose-500 to-pink-600' },
  { icon: Brain, text: 'Mengatasi Fear & Greed', color: 'from-purple-500 to-violet-600' },
  { icon: BarChart3, text: 'Analisis EUR/USD', color: 'from-cyan-500 to-blue-600' },
]

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: `Halo! 👋 Saya **LuxTrade AI Assistant**, asisten trading kamu.

Saya bisa bantu kamu dengan:

📊 **Analisis Teknikal** — Support/Resistance, Candlestick, Indikator
🎯 **Manajemen Risiko** — Position Sizing, Stop Loss, R:R Ratio
🧠 **Psikologi Trading** — Disiplin, mengatasi emosi
📈 **Strategi Trading** — Scalping, Day Trading, Swing Trading
🔧 **LuxTrade** — Cara pakai fitur-fitur platform

Mau tanya apa hari ini? 😊`,
  timestamp: new Date()
}

export default function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId] = useState(() => `chat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen, isMinimized])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          sessionId
        })
      })

      const data = await res.json()

      if (data.success) {
        const aiMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: data.response,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, aiMessage])
        
        // Increment unread if minimized
        if (!isOpen || isMinimized) {
          setUnreadCount(prev => prev + 1)
        }
      } else {
        setMessages(prev => [...prev, {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: '⚠️ Maaf, terjadi kesalahan. Coba lagi nanti ya.',
          timestamp: new Date()
        }])
      }
    } catch {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: '⚠️ Gagal terhubung ke AI. Periksa koneksi internet kamu.',
        timestamp: new Date()
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const clearChat = async () => {
    setMessages([WELCOME_MESSAGE])
    try {
      await fetch(`/api/ai-chat?sessionId=${sessionId}`, { method: 'DELETE' })
    } catch {
      // Silent fail
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  }

  // Render markdown-like bold and list
  const renderContent = (content: string) => {
    const parts = content.split(/(\*\*[^*]+\*\*|\n)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-purple-200">{part.slice(2, -2)}</strong>
      }
      if (part === '\n') {
        return <br key={i} />
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <>
      {/* Floating Chat Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              setIsOpen(true)
              setIsMinimized(false)
              setUnreadCount(0)
            }}
            className="fixed bottom-6 left-6 z-[100] w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-violet-700 shadow-lg shadow-purple-500/30 flex items-center justify-center group"
          >
            <MessageSquare className="w-6 h-6 text-white" />
            
            {/* Ping animation */}
            <span className="absolute inset-0 rounded-full bg-purple-500/30 animate-ping" style={{ animationDuration: '2s' }} />
            
            {/* Unread badge */}
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-[#0a0612]"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}

            {/* Tooltip */}
            <div className="absolute left-full ml-3 px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <span className="text-xs text-white/80">Chat dengan AI</span>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
              height: isMinimized ? 'auto' : undefined
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`fixed bottom-6 left-6 z-[100] w-[380px] max-w-[calc(100vw-48px)] rounded-2xl overflow-hidden shadow-2xl shadow-purple-500/20 border border-purple-500/30 ${
              isMinimized ? '' : 'h-[560px] max-h-[calc(100vh-120px)]'
            }`}
          >
            <div className="h-full flex flex-col bg-[#0a0612]/95 backdrop-blur-xl">
              
              {/* Header */}
              <div className="relative flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-900/50 to-violet-900/50 border-b border-purple-500/20">
                {/* Animated gradient line */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500" />
                
                <div className="flex items-center gap-3">
                  <motion.div
                    className="relative"
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 4, repeat: Infinity }}
                  >
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0a0612]" />
                  </motion.div>
                  <div>
                    <h3 className="text-sm font-bold text-white">LuxTrade AI</h3>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="text-[10px] text-emerald-400/80">Online • Siap membantu</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={clearChat}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white"
                    title="Bersihkan chat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setIsMinimized(!isMinimized)}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white"
                    title={isMinimized ? 'Perbesar' : 'Perkecil'}
                  >
                    {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white"
                    title="Tutup"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Chat Body */}
              {!isMinimized && (
                <>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                    {/* Messages */}
                    {messages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                      >
                        {/* Avatar */}
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                          msg.role === 'assistant' 
                            ? 'bg-gradient-to-br from-purple-500 to-violet-600' 
                            : 'bg-gradient-to-br from-pink-500 to-rose-600'
                        }`}>
                          {msg.role === 'assistant' 
                            ? <Bot className="w-3.5 h-3.5 text-white" />
                            : <User className="w-3.5 h-3.5 text-white" />
                          }
                        </div>

                        {/* Message Bubble */}
                        <div className={`max-w-[78%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                          <div className={`px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
                            msg.role === 'user'
                              ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-tr-sm'
                              : 'bg-white/[0.06] text-gray-200 rounded-tl-sm border border-white/[0.05]'
                          }`}>
                            {renderContent(msg.content)}
                          </div>
                          <div className={`flex items-center gap-1 mt-1 px-1 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <span className="text-[10px] text-white/20">{formatTime(msg.timestamp)}</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}

                    {/* Typing Indicator */}
                    {isLoading && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex gap-2.5"
                      >
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="bg-white/[0.06] border border-white/[0.05] px-4 py-3 rounded-2xl rounded-tl-sm">
                          <div className="flex gap-1.5">
                            {[0, 1, 2].map(i => (
                              <motion.span
                                key={i}
                                className="w-2 h-2 bg-purple-400 rounded-full"
                                animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                              />
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    <div ref={chatEndRef} />
                  </div>

                  {/* Quick Suggestions (only show at start) */}
                  {messages.length <= 1 && (
                    <div className="px-4 pb-2">
                      <div className="grid grid-cols-2 gap-2">
                        {QUICK_SUGGESTIONS.map((suggestion, i) => (
                          <motion.button
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 + i * 0.1 }}
                            onClick={() => sendMessage(suggestion.text)}
                            disabled={isLoading}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-all text-left group disabled:opacity-50"
                          >
                            <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${suggestion.color} flex items-center justify-center flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity`}>
                              <suggestion.icon className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-[11px] text-white/60 group-hover:text-white/80 transition-colors leading-tight">
                              {suggestion.text}
                            </span>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Input Area */}
                  <div className="px-4 pb-4 pt-2">
                    <div className="relative flex items-center gap-2">
                      <div className="flex-1 relative">
                        <input
                          ref={inputRef}
                          type="text"
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="Ketik pesan..."
                          disabled={isLoading}
                          className="w-full px-4 py-3 pr-10 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-sm placeholder-white/30 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all disabled:opacity-50"
                        />
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => sendMessage(input)}
                        disabled={!input.trim() || isLoading}
                        className="w-11 h-11 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-500/20 disabled:opacity-30 disabled:shadow-none transition-all"
                      >
                        {isLoading ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 text-white" />
                        )}
                      </motion.button>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between mt-2 px-1">
                      <div className="flex items-center gap-1.5">
                        <Shield className="w-3 h-3 text-white/20" />
                        <span className="text-[10px] text-white/20">End-to-end encrypted</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-purple-400/40" />
                        <span className="text-[10px] text-white/20">Powered by AI</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
