'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Play, Check, AlertCircle, TrendingUp, Target, FileText, Zap, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface DemoTrade {
  id: string
  pair: string
  direction: 'BUY' | 'SELL'
  entry: number
  exit: number
  pips: number
  profit: number
  risk: number
  rr: number
  setup: string
  emotionalState: 'CALM' | 'IMPATIENT' | 'FEARFUL' | 'GREEDY'
  note: string
}

interface DemoChallenge {
  balance: number
  equity: number
  dailyDrawdown: number
  maxDrawdown: number
  dailyDrawdownLimit: number
  maxDrawdownLimit: number
  profitTarget: number
  profitTargetCurrent: number
  tradesCount: number
}

const demoTrades: DemoTrade[] = [
  {
    id: '1',
    pair: 'XAUUSD',
    direction: 'SELL',
    entry: 2650.50,
    exit: 2643.20,
    pips: 73,
    profit: 730,
    risk: 200,
    rr: 3.65,
    setup: 'Trendline Break + NFP News',
    emotionalState: 'CALM',
    note: 'Tunggu close di daily sebelum entry. Good discipline.'
  },
  {
    id: '2',
    pair: 'EURUSD',
    direction: 'BUY',
    entry: 1.0850,
    exit: 1.0832,
    pips: -18,
    profit: -180,
    risk: 150,
    rr: -1.2,
    setup: 'Support Bounce',
    emotionalState: 'IMPATIENT',
    note: 'Entry terlalu cepat, belum ada konfirmasi candle rejection.'
  },
  {
    id: '3',
    pair: 'GBPJPY',
    direction: 'SELL',
    entry: 189.50,
    exit: 188.90,
    pips: 60,
    profit: 450,
    risk: 180,
    rr: 2.5,
    setup: 'Double Top',
    emotionalState: 'CALM',
    note: 'Perfect setup, harga rejection di neckline. RR bagus.'
  },
  {
    id: '4',
    pair: 'XAUUSD',
    direction: 'BUY',
    entry: 2645.00,
    exit: 2638.50,
    pips: -65,
    profit: -650,
    risk: 200,
    rr: -3.25,
    setup: 'Deep Pullback',
    emotionalState: 'GREEDY',
    note: 'Overtrading setelah profit besar tadi. Seharusnya cut di BEP.'
  },
  {
    id: '5',
    pair: 'USDCHF',
    direction: 'SELL',
    entry: 0.8850,
    exit: 0.8805,
    pips: 45,
    profit: 405,
    risk: 150,
    rr: 2.7,
    setup: 'Resistance Rejection',
    emotionalState: 'CALM',
    note: 'Follow plan. SL ketat di high baru. Result ok.'
  }
]

const initialChallenge: DemoChallenge = {
  balance: 100000,
  equity: 100000,
  dailyDrawdown: 0,
  maxDrawdown: 0,
  dailyDrawdownLimit: 5000,
  maxDrawdownLimit: 10000,
  profitTarget: 10000,
  profitTargetCurrent: 0,
  tradesCount: 0
}

interface InteractiveTutorialProps {
  language?: 'id' | 'en'
  onGetStarted?: () => void
}

export default function InteractiveTutorial({ language = 'id', onGetStarted }: InteractiveTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null)
  const [challengeState, setChallengeState] = useState<DemoChallenge>(initialChallenge)
  const [showAIModal, setShowAIModal] = useState(false)

  const steps = [
    {
      id: 'overview',
      title: language === 'en' ? 'Overview' : 'Gambaran Fitur',
      description: language === 'en'
        ? 'LuxTrade helps prop firm traders avoid drawdown breaches and pass challenges consistently.'
        : 'LuxTrade membantu trader prop firm menghindari drawdown breach dan lulus challenge konsisten.',
      icon: <Target className="w-5 h-5" />
    },
    {
      id: 'trades',
      title: language === 'en' ? 'Trade Logging' : 'Catat Trade',
      description: language === 'en'
        ? 'Log your trades with setup type, emotional state, and notes. Track what works.'
        : 'Catat trade dengan tipe setup, emosi, dan catatan. Lacak apa yang berhasil.',
      icon: <FileText className="w-5 h-5" />
    },
    {
      id: 'challenge',
      title: language === 'en' ? 'Prop Firm Guard' : 'Proteksi Prop Firm',
      description: language === 'en'
        ? 'Real-time drawdown tracking for FTMO, TFT, MFF, and other prop firms. Get alerts before breach.',
        : 'Tracking drawdown realtime untuk FTMO, TFT, MFF. Dapat peringatan sebelum breach.',
      icon: <TrendingUp className="w-5 h-5" />
    },
    {
      id: 'ai',
      title: language === 'en' ? 'AI Analysis' : 'Analisis AI',
      description: language === 'en'
        ? 'AI identifies patterns in your trading, highlights weaknesses, and suggests improvements.'
        : 'AI mengidentifikasi pola trading, highlight kelemahan, dan sarankan perbaikan.',
      icon: <Zap className="w-5 h-5" />
    }
  ]

  const selectedTrade = demoTrades.find(t => t.id === selectedTradeId)

  const handleNextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
      setActiveTab(steps[currentStep + 1].id)
    }
  }

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
      setActiveTab(steps[currentStep - 1].id)
    }
  }

  const handleTradeClick = (tradeId: string) => {
    setSelectedTradeId(tradeId)
    if (tradeId === '4') {
      setTimeout(() => setShowAIModal(true), 300)
    }
  }

  const getEmotionalColor = (state: string) => {
    switch (state) {
      case 'CALM': return 'text-green-400'
      case 'IMPATIENT': return 'text-yellow-400'
      case 'FEARFUL': return 'text-orange-400'
      case 'GREEDY': return 'text-red-400'
      default: return 'text-gray-400'
    }
  }

  const getDirectionColor = (direction: string) => {
    return direction === 'BUY' ? 'text-green-400' : 'text-red-400'
  }

  const updateChallengeWithTrades = () => {
    const newChallenge = { ...initialChallenge }
    demoTrades.forEach(trade => {
      newChallenge.profitTargetCurrent += trade.profit
      newChallenge.tradesCount += 1
    })
    newChallenge.equity = newChallenge.balance + newChallenge.profitTargetCurrent
    setChallengeState(newChallenge)
  }

  React.useEffect(() => {
    if (activeTab === 'challenge') {
      updateChallengeWithTrades()
    }
  }, [activeTab])

  return (
    <section className="py-20 bg-gradient-to-b from-[#050507] to-[#0a0a12]">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-sm font-mono">
            <Play className="w-3 h-3" />
            {language === 'en' ? 'INTERACTIVE DEMO' : 'DEMO INTERAKTIF'}
          </span>
          <h2 className="text-3xl md:text-4xl font-bold mt-6 mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-600">
            {language === 'en' ? 'Try It Yourself - No Sign Up Required' : 'Coba Sendiri - Tanpa Daftar'}
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            {language === 'en'
              ? 'Experience LuxTrade with real demo data. See how we help prop firm traders pass challenges.'
              : 'Rasakan LuxTrade dengan data demo asli. Lihat bagaimana kami membantu trader prop firm lulus challenge.'}
          </p>
        </motion.div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  index === currentStep
                    ? 'bg-blue-500/20 border border-blue-500/30 text-blue-400'
                    : index < currentStep
                    ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                    : 'bg-white/5 border border-white/10 text-gray-500'
                }`}
              >
                {index < currentStep ? <Check className="w-4 h-4" /> : step.icon}
                <span className="text-sm font-medium hidden sm:inline">{step.title}</span>
              </motion.div>
              {index < steps.length - 1 && (
                <div className={`h-px w-8 ${index < currentStep ? 'bg-green-500/50' : 'bg-white/10'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Main Tutorial Content */}
        <Card className="bg-[#0a0a12]/80 backdrop-blur-xl border border-white/10 overflow-hidden">
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-white/5 p-1 rounded-lg">
                {steps.map((step, index) => (
                  <TabsTrigger
                    key={step.id}
                    value={step.id}
                    className={`data-[state=active]:bg-blue-500 data-[state=active]:text-white transition-all ${
                      index === currentStep ? '' : 'text-gray-400'
                    }`}
                  >
                    {step.icon}
                    <span className="ml-2 hidden sm:inline">{step.title}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* Step 1: Overview */}
              <TabsContent value="overview" className="mt-6">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <div className="text-center py-8">
                    <h3 className="text-2xl font-semibold mb-3">{steps[0].title}</h3>
                    <p className="text-gray-400 mb-6">{steps[0].description}</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                      <div className="p-4 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl border border-blue-500/20">
                        <TrendingUp className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                        <h4 className="font-semibold text-white mb-1">{language === 'en' ? 'Drawdown Guard' : 'Proteksi Drawdown'}</h4>
                        <p className="text-sm text-gray-400">{language === 'en' ? 'Track daily & max drawdown in real-time' : 'Tracking drawdown harian & maksimal realtime'}</p>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/20">
                        <Zap className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                        <h4 className="font-semibold text-white mb-1">{language === 'en' ? 'AI Insights' : 'Analisis AI'}</h4>
                        <p className="text-sm text-gray-400">{language === 'en' ? 'Get personalized trading insights' : 'Dapat insight trading personal'}</p>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/20">
                        <FileText className="w-8 h-8 text-green-400 mx-auto mb-2" />
                        <h4 className="font-semibold text-white mb-1">{language === 'en' ? 'Smart Journal' : 'Jurnal Cerdas'}</h4>
                        <p className="text-sm text-gray-400">{language === 'en' ? 'Auto-import from MT5 history' : 'Auto-import dari history MT5'}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </TabsContent>

              {/* Step 2: Trade Logging */}
              <TabsContent value="trades" className="mt-6">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold">{language === 'en' ? 'Demo Trade Log' : 'Log Trade Demo'}</h3>
                    <span className="text-sm text-gray-400">{language === 'en' ? 'Click a trade to see details' : 'Klik trade untuk lihat detail'}</span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Trade List */}
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                      {demoTrades.map((trade) => (
                        <motion.div
                          key={trade.id}
                          whileHover={{ scale: 1.02 }}
                          onClick={() => handleTradeClick(trade.id)}
                          className={`p-4 rounded-xl border cursor-pointer transition-all ${
                            selectedTradeId === trade.id
                              ? 'bg-blue-500/20 border-blue-500/30'
                              : trade.profit > 0
                              ? 'bg-green-500/10 border-green-500/20 hover:bg-green-500/20'
                              : 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{trade.pair}</span>
                              <span className={`text-sm font-medium ${getDirectionColor(trade.direction)}`}>
                                {trade.direction}
                              </span>
                            </div>
                            <span className={`font-semibold ${trade.profit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {trade.profit > 0 ? '+' : ''}${trade.profit}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-400">
                            <span>RR: {trade.rr.toFixed(2)}</span>
                            <span className={getEmotionalColor(trade.emotionalState)}>
                              {trade.emotionalState}
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Trade Details */}
                    {selectedTrade && (
                      <Card className="bg-[#0a0a12]/60 border border-white/10">
                        <CardHeader>
                          <CardTitle className="flex items-center justify-between">
                            <span>{selectedTrade.pair} Details</span>
                            <span className={`text-lg font-bold ${selectedTrade.profit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {selectedTrade.profit > 0 ? '+' : ''}${selectedTrade.profit}
                            </span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-gray-500">{language === 'en' ? 'Direction' : 'Arah'}: </span>
                              <span className={`font-medium ${getDirectionColor(selectedTrade.direction)}`}>
                                {selectedTrade.direction}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Setup: </span>
                              <span className="font-medium">{selectedTrade.setup}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">{language === 'en' ? 'Entry' : 'Masuk'}: </span>
                              <span className="font-medium">{selectedTrade.entry}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">{language === 'en' ? 'Exit' : 'Keluar'}: </span>
                              <span className="font-medium">{selectedTrade.exit}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">{language === 'en' ? 'Risk' : 'Risiko'}: </span>
                              <span className="font-medium">${selectedTrade.risk}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">{language === 'en' ? 'Emotion' : 'Emosi'}: </span>
                              <span className={`font-medium ${getEmotionalColor(selectedTrade.emotionalState)}`}>
                                {selectedTrade.emotionalState}
                              </span>
                            </div>
                          </div>
                          <div className="pt-3 border-t border-white/10">
                            <p className="text-sm text-gray-400">
                              <span className="text-gray-500">{language === 'en' ? 'Note' : 'Catatan'}: </span>
                              {selectedTrade.note}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </motion.div>
              </TabsContent>

              {/* Step 3: Challenge Tracking */}
              <TabsContent value="challenge" className="mt-6">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-semibold mb-2">{language === 'en' ? 'Prop Firm Challenge Tracker' : 'Tracker Challenge Prop Firm'}</h3>
                    <p className="text-sm text-gray-400">{language === 'en' ? 'Example: FTMO $100K Challenge' : 'Contoh: FTMO $100K Challenge'}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Challenge Stats */}
                    <Card className="bg-[#0a0a12]/60 border border-white/10">
                      <CardHeader>
                        <CardTitle className="text-sm text-gray-400">{language === 'en' ? 'Challenge Status' : 'Status Challenge'}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-500">{language === 'en' ? 'Balance' : 'Saldo'}</span>
                            <span className="font-semibold">${challengeState.balance.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-500">Equity</span>
                            <span className="font-semibold text-blue-400">${challengeState.equity.toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="space-y-3 pt-3 border-t border-white/10">
                          {/* Daily Drawdown */}
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-500">{language === 'en' ? 'Daily Drawdown' : 'Drawdown Harian'}</span>
                              <span className="text-yellow-400">${challengeState.dailyDrawdown.toLocaleString()} / ${challengeState.dailyDrawdownLimit.toLocaleString()}</span>
                            </div>
                            <Progress
                              value={(challengeState.dailyDrawdown / challengeState.dailyDrawdownLimit) * 100}
                              className="h-2"
                            />
                          </div>

                          {/* Max Drawdown */}
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-500">{language === 'en' ? 'Max Drawdown' : 'Drawdown Maksimal'}</span>
                              <span className="text-orange-400">${challengeState.maxDrawdown.toLocaleString()} / ${challengeState.maxDrawdownLimit.toLocaleString()}</span>
                            </div>
                            <Progress
                              value={(challengeState.maxDrawdown / challengeState.maxDrawdownLimit) * 100}
                              className="h-2"
                            />
                          </div>

                          {/* Profit Target */}
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-500">{language === 'en' ? 'Profit Target' : 'Target Profit'}</span>
                              <span className="text-green-400">${challengeState.profitTargetCurrent.toLocaleString()} / ${challengeState.profitTarget.toLocaleString()}</span>
                            </div>
                            <Progress
                              value={(challengeState.profitTargetCurrent / challengeState.profitTarget) * 100}
                              className="h-2"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Alerts */}
                    <Card className="bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/20">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-400">
                          <AlertCircle className="w-5 h-5" />
                          {language === 'en' ? 'AI Alert' : 'Peringatan AI'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                            <p className="text-sm text-red-300 font-medium">
                              {language === 'en' ? '⚠️ Overtrading Pattern Detected' : '⚠️ Pola Overtrading Terdeteksi'}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {language === 'en'
                                ? 'You took 2 trades on XAUUSD within 1 hour after a big win. This pattern often leads to giving back profits.'
                                : 'Anda ambil 2 trade XAUUSD dalam 1 jam setelah profit besar. Pola ini sering menyebabkan profit tergerus kembali.'}
                            </p>
                          </div>
                          <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                            <p className="text-sm text-yellow-300 font-medium">
                              {language === 'en' ? '💡 Suggestion' : '💡 Saran'}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {language === 'en'
                                ? 'Set a "max 1 trade per pair per day" rule. Take a break after a 3R+ win.'
                                : 'Buat aturan "maksimal 1 trade per pair per hari". Istirahat setelah profit 3R+.'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </motion.div>
              </TabsContent>

              {/* Step 4: AI Analysis */}
              <TabsContent value="ai" className="mt-6">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-semibold mb-2">{language === 'en' ? 'AI-Powered Analysis' : 'Analisis Berbasis AI'}</h3>
                    <p className="text-sm text-gray-400">{language === 'en' ? 'Click "Analyze with AI" to see sample insights' : 'Klik "Analisis dengan AI" untuk melihat contoh insight'}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20">
                      <CardContent className="p-6 text-center">
                        <div className="text-3xl font-bold text-purple-400 mb-2">3.65</div>
                        <div className="text-sm text-gray-400 mb-1">{language === 'en' ? 'Avg Risk:Reward' : 'Rata-rata RR'}</div>
                        <div className="text-xs text-green-400">{language === 'en' ? 'Above 1.5 threshold' : 'Di atas threshold 1.5'}</div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20">
                      <CardContent className="p-6 text-center">
                        <div className="text-3xl font-bold text-yellow-400 mb-2">40%</div>
                        <div className="text-sm text-gray-400 mb-1">{language === 'en' ? 'Win Rate' : 'Win Rate'}</div>
                        <div className="text-xs text-orange-400">{language === 'en' ? 'Below 50% target' : 'Di bawah target 50%'}</div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20">
                      <CardContent className="p-6 text-center">
                        <div className="text-3xl font-bold text-green-400 mb-2">+$755</div>
                        <div className="text-sm text-gray-400 mb-1">{language === 'en' ? 'Net Profit' : 'Profit Bersih'}</div>
                        <div className="text-xs text-green-400">{language === 'en' ? 'Positive expectancy' : 'Expectancy positif'}</div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="bg-[#0a0a12]/60 border border-white/10">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-purple-400" />
                        {language === 'en' ? 'Key Insights' : 'Insight Utama'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex gap-3 p-4 bg-red-500/5 rounded-lg border border-red-500/10">
                          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-red-300 mb-1">{language === 'en' ? 'Critical Issue: Revenge Trading' : 'Masalah Kritis: Revenge Trading'}</p>
                            <p className="text-sm text-gray-400">
                              {language === 'en'
                                ? 'After losses on EURUSD, you entered XAUUSD trade #4 without proper setup. Loss: -$650. This pattern caused 60% of your losses.'
                                : 'Setelah loss di EURUSD, Anda masuk trade XAUUSD #4 tanpa setup yang tepat. Loss: -$650. Pola ini menyebabkan 60% total loss Anda.'}
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-3 p-4 bg-green-500/5 rounded-lg border border-green-500/10">
                          <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-green-300 mb-1">{language === 'en' ? 'Strength: Emotional Discipline' : 'Kelebihan: Disiplin Emosi'}</p>
                            <p className="text-sm text-gray-400">
                              {language === 'en'
                                ? 'When trading CALM, your win rate is 75% with avg RR of 2.95. Maintain this state for best results.'
                                : 'Saat trading dengan emosi CALM, win rate Anda 75% dengan rata-rata RR 2.95. Pertahankan kondisi ini untuk hasil terbaik.'}
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-3 p-4 bg-blue-500/5 rounded-lg border border-blue-500/10">
                          <TrendingUp className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-blue-300 mb-1">{language === 'en' ? 'Action Plan' : 'Rencana Aksi'}</p>
                            <ul className="text-sm text-gray-400 space-y-1">
                              <li>• {language === 'en' ? 'Mandatory 30-min break after any loss' : 'Wajib istirahat 30 menit setelah loss'}</li>
                              <li>• {language === 'en' ? 'Skip next trade when emotion is IMPATIENT or GREEDY' : 'Lewati trade berikutnya saat emosi IMPATIENT atau GREEDY'}</li>
                              <li>• {language === 'en' ? 'Focus on Trendline Break setups (best RR for you)' : 'Fokus pada setup Trendline Break (RR terbaik untuk Anda)'}</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>
            </Tabs>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-white/10">
              <Button
                variant="outline"
                onClick={handlePrevStep}
                disabled={currentStep === 0}
                className="border-white/20 text-white hover:bg-white/10"
              >
                {language === 'en' ? 'Previous' : 'Sebelumnya'}
              </Button>

              {currentStep < steps.length - 1 ? (
                <Button
                  onClick={handleNextStep}
                  className="bg-gradient-to-r from-blue-500 to-cyan-400 text-white hover:opacity-90"
                >
                  {language === 'en' ? 'Next' : 'Lanjut'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={onGetStarted}
                  className="bg-gradient-to-r from-blue-500 to-cyan-400 text-white hover:opacity-90"
                >
                  {language === 'en' ? 'Get Started Free' : 'Mulai Gratis Sekarang'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}