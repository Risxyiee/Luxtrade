'use client'

import { useState, useEffect, useRef } from 'react'
import { Brain, Sparkles, TrendingUp, MessageCircle, Bot, User, Send, Lock, AlertCircle, Loader2, Mic, Upload, BarChart3, FileText, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { motion } from 'framer-motion'

export interface Analytics {
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  totalPL: number
  avgProfit: number
  avgLoss: number
  profitFactor: number
  maxDrawdown: number
  sharpeRatio: number
  equityCurve: { date: string; equity: number }[]
  sessionPerformance: { session: string; trades: number; pl: number; winRate: number }[]
  monthlyPerformance: { month: string; pl: number; trades: number }[]
}

export interface Trade {
  id: string
  symbol: string
  type: 'BUY' | 'SELL'
  open_price: number
  close_price: number
  lot_size: number
  profit_loss: number
  open_time: string
  close_time: string
  session: string | null
  notes?: string
  image_url?: string | null
}

interface AITabProps {
  analytics: Analytics | null
  trades: Trade[]
  insight: string
  loading: boolean
  onGetTips: () => void
  onGetMarket: () => void
  chatMessages: { role: 'user' | 'assistant'; content: string }[]
  chatInput: string
  onChatChange: (v: string) => void
  onSendChat: () => void
  isPro: boolean
  onUpgrade: () => void
  onAnalyzeTrade?: (tradeId: string) => void
  onVoiceJournal?: () => void
  onAnalyzeChart?: (imageData: string) => void
}

export default function AITab({
  analytics,
  trades,
  insight,
  loading,
  onGetTips,
  onGetMarket,
  chatMessages,
  chatInput,
  onChatChange,
  onSendChat,
  isPro,
  onUpgrade,
  onAnalyzeTrade,
  onVoiceJournal,
  onAnalyzeChart
}: AITabProps) {
  const hasEnoughTrades = analytics && analytics.totalTrades >= 5
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const [selectedTradeForAnalysis, setSelectedTradeForAnalysis] = useState<Trade | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [chartImage, setChartImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chatMessages])

  return (
    <div className="space-y-6">
      {/* PRO Paywall */}
      {!isPro && (
        <Card className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 border-purple-500/30">
          <CardContent className="py-8 text-center">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Lock className="w-12 h-12 mx-auto mb-4 text-purple-400" />
            </motion.div>
            <h3 className="text-lg font-bold text-purple-400 mb-2">AI Insights - PRO Feature</h3>
            <p className="text-gray-400 mb-4">Unlock AI-powered trading insights and recommendations</p>
            <Button onClick={onUpgrade} className="bg-gradient-to-r from-purple-500 to-violet-600">
              <Sparkles className="w-4 h-4 mr-2" /> Upgrade to PRO
            </Button>
          </CardContent>
        </Card>
      )}

      {/* AI Header */}
      <Card className={`bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30 ${!isPro ? 'blur-sm pointer-events-none' : ''}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl">
            <motion.div
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-violet-500/20 flex items-center justify-center"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              <Brain className="w-5 h-5 text-purple-400" />
            </motion.div>
            AI Trading Assistant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400 mb-4">
            Get personalized insights powered by AI to improve your trading performance.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <Button
              onClick={onGetTips}
              disabled={loading || !hasEnoughTrades}
              className="bg-gradient-to-r from-purple-500/20 to-violet-500/20 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30 justify-start"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Get Performance Tips
            </Button>
            <Button
              onClick={onGetMarket}
              disabled={loading}
              className="bg-gradient-to-r from-purple-500/20 to-violet-500/20 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30 justify-start"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TrendingUp className="w-4 h-4 mr-2" />}
              Market Insights
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* AI Trade Analysis */}
            <Button
              onClick={() => {
                if (trades.length > 0) {
                  setSelectedTradeForAnalysis(trades[0])
                  onAnalyzeTrade?.(trades[0].id)
                }
              }}
              disabled={loading || trades.length === 0}
              className="bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 justify-start"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BarChart3 className="w-4 h-4 mr-2" />}
              Analyze Trade
            </Button>
            {/* Voice Journal Entry */}
            <Button
              onClick={() => {
                setIsRecording(!isRecording)
                onVoiceJournal?.()
              }}
              disabled={loading || isRecording}
              className={`bg-gradient-to-r ${
                isRecording 
                  ? 'from-red-500/20 to-rose-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30' 
                  : 'from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400 hover:bg-amber-500/30'
              } justify-start`}
            >
              {isRecording ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Recording...</>
              ) : (
                <><Mic className="w-4 h-4 mr-2" /> Voice Journal
              </>)}
            </Button>
            {/* Chart Image Analysis */}
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30 justify-start"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImageIcon className="w-4 h-4 mr-2" />}
              Analyze Chart
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  const reader = new FileReader()
                  reader.onloadend = () => {
                    const imageData = reader.result as string
                    setChartImage(imageData)
                    onAnalyzeChart?.(imageData)
                  }
                  reader.readAsDataURL(file)
                }
              }}
            />
          </div>

          {!hasEnoughTrades && (
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 mt-4">
              <p className="text-sm text-purple-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Add at least 5 closed trades to unlock AI-powered performance tips.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chart Analysis Result */}
      {chartImage && (
        <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ImageIcon className="w-5 h-5 text-cyan-400" />
              Chart Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="relative">
                <img src={chartImage} alt="Chart" className="w-full rounded-lg border border-white/10" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setChartImage(null)}
                  className="absolute top-2 right-2 bg-black/50 border-white/20 text-white hover:bg-black/70"
                >
                  <Upload className="w-4 h-4" />
                </Button>
              </div>
              <div className="bg-black/20 rounded-lg p-4 border border-purple-500/20">
                <p className="text-sm text-gray-400 mb-2">AI Analysis:</p>
                <p className="text-gray-200 text-sm leading-relaxed">
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing chart patterns...
                    </div>
                  ) : (
                    "Chart analysis is powered by AI vision capabilities. Upload a chart screenshot to identify patterns, support/resistance levels, and potential trading opportunities."
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Response */}
      {insight && (
        <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">AI Insight</p>
                <p className="text-gray-200 whitespace-pre-wrap">{insight}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Chat Section */}
      {isPro && (
        <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageCircle className="w-5 h-5 text-purple-400" />
              Chat with AI Coach
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Chat Messages */}
            <div
              ref={chatContainerRef}
              className="h-64 overflow-y-auto space-y-3 mb-4 p-3 rounded-lg bg-black/20 border border-purple-900/20"
            >
              {chatMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                  <div className="text-center">
                    <Bot className="w-8 h-8 mx-auto mb-2 text-purple-400/50" />
                    <p>Ask me anything about your trading!</p>
                    <p className="text-xs mt-1 text-gray-600">e.g., &quot;What&apos;s my best trading session?&quot;</p>
                  </div>
                </div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-purple-400" />
                      </div>
                    )}
                    <div className={`max-w-[80%] p-3 rounded-xl text-sm ${
                      msg.role === 'user'
                        ? 'bg-purple-500/20 text-purple-100 rounded-br-none'
                        : 'bg-gray-800/50 text-gray-200 rounded-bl-none'
                    }`}>
                      {msg.content}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-7 h-7 rounded-full bg-purple-500/30 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-purple-300" />
                      </div>
                    )}
                  </motion.div>
                ))
              )}
              {loading && chatMessages.length > 0 && chatMessages[chatMessages.length - 1]?.role === 'user' && (
                <div className="flex gap-2 justify-start">
                  <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="bg-gray-800/50 p-3 rounded-xl rounded-bl-none">
                    <div className="flex gap-1">
                      <motion.span
                        className="w-2 h-2 bg-purple-400 rounded-full"
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                      />
                      <motion.span
                        className="w-2 h-2 bg-purple-400 rounded-full"
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                      />
                      <motion.span
                        className="w-2 h-2 bg-purple-400 rounded-full"
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => onChatChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    onSendChat()
                  }
                }}
                placeholder="Ask about your trading performance..."
                className="bg-black/30 border-purple-900/30 focus:border-purple-500/50 text-gray-200 placeholder-gray-500"
                disabled={loading}
              />
              <Button
                onClick={onSendChat}
                disabled={loading || !chatInput.trim()}
                className="bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
