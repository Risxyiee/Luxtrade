'use client'

import React, { useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { ImageUp, Terminal, Keyboard } from 'lucide-react'

interface AIVisionSimulatorProps {
  language?: 'id' | 'en'
}

interface TradeResult {
  pair: string
  type: string
  lot: number
  entry: number
  exit: number
  pl: number
  session: string
}

const simData: Record<string, { pair: string; type: string; lot: number; entry: number; exit: number; pl: number; session: string }> = {
  xauusd: { pair: 'XAUUSD', type: 'BUY', lot: 0.10, entry: 2034.50, exit: 2041.20, pl: 670.0, session: 'New York' },
  eurusd: { pair: 'EURUSD', type: 'BUY', lot: 0.50, entry: 1.0850, exit: 1.0885, pl: 175.0, session: 'London' },
  gbpusd: { pair: 'GBPUSD', type: 'SELL', lot: 0.20, entry: 1.2720, exit: 1.2690, pl: 60.0, session: 'Asian' },
}

const btnLabels: Record<string, string> = { xauusd: 'XAUUSD Buy', eurusd: 'EURUSD Breakout', gbpusd: 'GBPUSD Sell' }

/** Kontrak kasar: XAUUSD 1 lot = 100 oz (±$100 per $1 move); forex std 1 lot = 100.000 (±$10/pip). */
function computePl(pair: string, direction: string, entry: number, exit: number, lot: number): number {
  const move = exit - entry
  const dir = direction === 'BUY' ? 1 : -1
  if (pair.toUpperCase().includes('XAU') || pair.toUpperCase().includes('GOLD')) {
    return move * 100 * lot * dir
  }
  const pipSize = Math.abs(entry) >= 20 ? 0.01 : 0.0001
  return (move / pipSize) * 10 * lot * dir
}

export default function AIVisionSimulator({ language = 'id' }: AIVisionSimulatorProps) {
  const [mode, setMode] = useState<'sample' | 'manual'>('manual')
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<TradeResult | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Form input manual (Bos: simulator harus benar-benar bisa diisi)
  const [mPair, setMPair] = useState('XAUUSD')
  const [mType, setMType] = useState<'BUY' | 'SELL'>('BUY')
  const [mEntry, setMEntry] = useState('')
  const [mExit, setMExit] = useState('')
  const [mLot, setMLot] = useState('0.01')
  const [mError, setMError] = useState('')

  const runSim = useCallback((key: string) => {
    if (scanning) return
    setScanning(true)
    setActiveKey(key)
    setResult(null)

    setTimeout(() => {
      setScanning(false)
      setResult(simData[key])
    }, 1500)
  }, [scanning])

  const runManual = useCallback(() => {
    if (scanning) return
    setMError('')
    const entry = parseFloat((mEntry || '').replace(',', '.'))
    const exit = parseFloat((mExit || '').replace(',', '.'))
    const lot = parseFloat((mLot || '0.01').replace(',', '.'))
    const pair = (mPair || '').trim().toUpperCase()
    if (!pair) { setMError(language === 'en' ? 'Pair is required.' : 'Pair wajib diisi.'); return }
    if (Number.isNaN(entry) || entry <= 0) { setMError(language === 'en' ? 'Entry price must be a number.' : 'Harga entry harus angka.'); return }
    if (Number.isNaN(exit) || exit <= 0) { setMError(language === 'en' ? 'Exit price must be a number.' : 'Harga exit harus angka.'); return }
    if (Number.isNaN(lot) || lot <= 0) { setMError(language === 'en' ? 'Lot size must be a number.' : 'Ukuran lot harus angka.'); return }

    setScanning(true)
    setResult(null)
    setActiveKey(null)
    setTimeout(() => {
      setScanning(false)
      setResult({ pair, type: mType, lot, entry, exit, pl: computePl(pair, mType, entry, exit, lot), session: language === 'en' ? 'Your input' : 'Input kamu' })
    }, 1200)
  }, [scanning, mPair, mType, mEntry, mExit, mLot, language])

  const jsonOutput = result
    ? `{
  "status": "Success",
  "pair": "${result.pair}",
  "type": "${result.type}",
  "lot": ${result.lot},
  "entry": ${result.entry},
  "exit": ${result.exit},
  "session": "${result.session}",
  "pl": "${result.pl >= 0 ? '+' : '-'}$${Math.abs(result.pl).toFixed(2)}"
}`
    : scanning
      ? `{
  "status": "Scanning image...",
  "progress": "Detecting OCR patterns"
}`
      : `{
  "status": "Waiting for input...",
  "message": "${language === 'en' ? 'Enter a trade below, or pick a sample screenshot.' : 'Isi trade di bawah, atau pilih contoh screenshot.'}"
}`

  const plColor = (pl: number) => (pl >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30')
  const plText = (pl: number) => (pl >= 0 ? 'text-emerald-400' : 'text-red-400')

  return (
    <section id="simulator" className="py-24 relative z-10 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <span className="font-mono text-cyan-400 text-sm">{language === 'en' ? 'INTERACTIVE SIMULATOR' : 'SIMULATOR INTERAKTIF'}</span>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mt-2 mb-4 text-white">{language === 'en' ? 'Try AI Vision Simulator' : 'Coba AI Vision Simulator'}</h2>
          <p className="text-gray-400 max-w-2xl mx-auto">{language === 'en' ? 'Enter your own sample trade and get the result instantly — no sign-up needed.' : 'Masukkan contoh trade kamu sendiri dan dapatkan hasilnya langsung — tanpa daftar.'}</p>
        </motion.div>

        {/* Mode switch: input manual / contoh screenshot */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex gap-1 rounded-xl bg-white/5 border border-white/10 p-1" role="tablist" aria-label={language === 'en' ? 'Simulator mode' : 'Mode simulator'}>
            <button
              role="tab"
              aria-selected={mode === 'manual'}
              onClick={() => setMode('manual')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${mode === 'manual' ? 'bg-cyan-500/20 text-cyan-300' : 'text-gray-400 hover:text-gray-200'}`}
            >
              <Keyboard className="w-3.5 h-3.5" /> {language === 'en' ? 'Enter your own trade' : 'Isi trade sendiri'}
            </button>
            <button
              role="tab"
              aria-selected={mode === 'sample'}
              onClick={() => setMode('sample')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${mode === 'sample' ? 'bg-cyan-500/20 text-cyan-300' : 'text-gray-400 hover:text-gray-200'}`}
            >
              <ImageUp className="w-3.5 h-3.5" /> {language === 'en' ? 'Sample screenshots' : 'Contoh screenshot'}
            </button>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid md:grid-cols-2 gap-8 items-stretch"
        >
          {/* Left: Input + Visual */}
          <div className="glass-lux p-6 flex flex-col gap-6">
            {mode === 'manual' ? (
              <div className="flex-1 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="sim-pair" className="block text-[11px] font-mono text-gray-500 mb-1">{language === 'en' ? 'PAIR' : 'PAIR'}</label>
                    <input
                      id="sim-pair"
                      value={mPair}
                      onChange={(e) => setMPair(e.target.value)}
                      placeholder="XAUUSD"
                      className="w-full h-10 rounded-lg bg-[#0a0f1d] border border-white/10 px-3 text-sm text-white font-mono placeholder:text-white/25 focus:outline-none focus:border-cyan-400/50"
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] font-mono text-gray-500 mb-1">{language === 'en' ? 'TYPE' : 'ARAH'}</span>
                    <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label={language === 'en' ? 'Type' : 'Arah'}>
                      {(['BUY', 'SELL'] as const).map((d) => (
                        <button
                          key={d}
                          type="button"
                          role="radio"
                          aria-checked={mType === d}
                          onClick={() => setMType(d)}
                          className={`h-10 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                            mType === d
                              ? d === 'BUY' ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300' : 'bg-red-500/20 border-red-400/40 text-red-300'
                              : 'bg-[#0a0f1d] border-white/10 text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="sim-entry" className="block text-[11px] font-mono text-gray-500 mb-1">{language === 'en' ? 'ENTRY' : 'ENTRY'}</label>
                    <input
                      id="sim-entry"
                      inputMode="decimal"
                      value={mEntry}
                      onChange={(e) => setMEntry(e.target.value)}
                      placeholder="2034.50"
                      className="w-full h-10 rounded-lg bg-[#0a0f1d] border border-white/10 px-3 text-sm text-white font-mono placeholder:text-white/25 focus:outline-none focus:border-cyan-400/50"
                    />
                  </div>
                  <div>
                    <label htmlFor="sim-exit" className="block text-[11px] font-mono text-gray-500 mb-1">{language === 'en' ? 'EXIT' : 'EXIT'}</label>
                    <input
                      id="sim-exit"
                      inputMode="decimal"
                      value={mExit}
                      onChange={(e) => setMExit(e.target.value)}
                      placeholder="2041.20"
                      className="w-full h-10 rounded-lg bg-[#0a0f1d] border border-white/10 px-3 text-sm text-white font-mono placeholder:text-white/25 focus:outline-none focus:border-cyan-400/50"
                    />
                  </div>
                  <div>
                    <label htmlFor="sim-lot" className="block text-[11px] font-mono text-gray-500 mb-1">{language === 'en' ? 'LOT' : 'LOT'}</label>
                    <input
                      id="sim-lot"
                      inputMode="decimal"
                      value={mLot}
                      onChange={(e) => setMLot(e.target.value)}
                      placeholder="0.01"
                      className="w-full h-10 rounded-lg bg-[#0a0f1d] border border-white/10 px-3 text-sm text-white font-mono placeholder:text-white/25 focus:outline-none focus:border-cyan-400/50"
                    />
                  </div>
                </div>
                {mError && (
                  <p role="alert" className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{mError}</p>
                )}
                <button
                  onClick={runManual}
                  disabled={scanning}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
                >
                  {scanning ? (language === 'en' ? 'Analyzing…' : 'Menganalisis…') : language === 'en' ? 'Analyze This Trade' : 'Analisis Trade Ini'}
                </button>
                <p className="text-[10px] text-gray-600 leading-relaxed">
                  {language === 'en'
                    ? 'Sample numbers only. P/L uses standard contracts (XAUUSD: 100 oz/lot, forex: 100k units/lot).'
                    : 'Angka contoh saja. P/L pakai kontrak standar (XAUUSD: 100 oz/lot, forex: 100 ribu unit/lot).'}
                </p>
              </div>
            ) : (
              <>
                <div
                  ref={containerRef}
                  className={`relative flex-1 min-h-[300px] bg-[#0a0f1d] rounded-xl border border-white/5 flex items-center justify-center overflow-hidden ${scanning ? 'scanning' : ''}`}
                >
                  <div className="scan-line-anim" />

                  {!activeKey && !result && (
                    <div className="text-center text-gray-600 p-8">
                      <ImageUp className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p className="font-mono text-sm">{language === 'en' ? 'Select a sample screenshot to start the AI Vision simulation...' : 'Pilih contoh screenshot untuk memulai simulasi AI Vision...'}</p>
                    </div>
                  )}

                  {result && (
                    <div className="absolute inset-0 p-6 flex flex-col justify-between">
                      <div className="bg-[#0a0f1d]/90 p-4 rounded-lg border border-white/10">
                        <div className="flex justify-between items-center mb-4">
                          <span className="font-mono text-sm text-white">{result.pair}</span>
                          <span className={`font-mono text-xs px-2 py-1 rounded ${result.type === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{result.type}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                          <div><p className="text-gray-500">Entry</p><p className="text-white">{result.entry}</p></div>
                          <div><p className="text-gray-500">Exit</p><p className="text-white">{result.exit}</p></div>
                          <div><p className="text-gray-500">Lot</p><p className="text-white">{result.lot}</p></div>
                          <div><p className="text-gray-500">Session</p><p className="text-cyan-400">{result.session}</p></div>
                        </div>
                      </div>
                      <div className={`p-3 rounded-lg border flex items-center justify-between ${plColor(result.pl)}`}>
                        <span className="text-xs text-gray-400 font-mono">Profit / Loss</span>
                        <span className={`text-lg font-bold font-mono ${plText(result.pl)}`}>
                          {result.pl >= 0 ? '+' : '-'}${Math.abs(result.pl).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  {Object.keys(simData).map((key) => (
                    <button
                      key={key}
                      onClick={() => runSim(key)}
                      disabled={scanning}
                      className={`px-3 py-2.5 rounded-xl text-xs font-mono transition-colors cursor-pointer ${
                        activeKey === key
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : 'bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300'
                      }`}
                    >
                      {btnLabels[key]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Right: JSON Output */}
          <div className="glass-lux p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/50" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                <div className="w-3 h-3 rounded-full bg-green-500/50" />
              </div>
              <span className="text-xs font-mono text-gray-500 flex items-center gap-2">
                <Terminal className="w-3 h-3" /> {language === 'en' ? 'AI Extract Output' : 'Output AI Extract'}
              </span>
            </div>
            <pre className="text-sm font-mono text-gray-300 flex-1 overflow-auto leading-relaxed">
              <code>{jsonOutput}</code>
            </pre>
            {result && (
              <div className={`mt-4 p-3 rounded-lg border flex items-center justify-between ${plColor(result.pl)}`}>
                <span className="text-xs text-gray-400 font-mono">{language === 'en' ? 'Result' : 'Hasil'}</span>
                <span className={`text-lg font-bold font-mono ${plText(result.pl)}`}>
                  {result.pl >= 0 ? '+' : '-'}${Math.abs(result.pl).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
