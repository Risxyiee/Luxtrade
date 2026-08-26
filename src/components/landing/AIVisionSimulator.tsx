'use client'

import React, { useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { ImageUp, Terminal, CheckCircle2, XCircle } from 'lucide-react'

const simData: Record<string, { pair: string; type: string; lot: number; entry: number; exit: number; pl: string; session: string }> = {
  xauusd: { pair: 'XAUUSD', type: 'BUY', lot: 0.10, entry: 2034.50, exit: 2041.20, pl: '+$670.00', session: 'New York' },
  eurusd: { pair: 'EURUSD', type: 'BUY', lot: 0.50, entry: 1.0850, exit: 1.0885, pl: '+$175.00', session: 'London' },
  gbpusd: { pair: 'GBPUSD', type: 'SELL', lot: 0.20, entry: 1.2720, exit: 1.2690, pl: '+$60.00', session: 'Asian' },
}

const btnLabels: Record<string, string> = { xauusd: 'XAUUSD Buy', eurusd: 'EURUSD Breakout', gbpusd: 'GBPUSD Sell' }

export default function AIVisionSimulator() {
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<{ pair: string; type: string; lot: number; entry: number; exit: number; pl: string; session: string } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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

  const jsonOutput = result
    ? `{
  "status": "Success",
  "pair": "${result.pair}",
  "type": "${result.type}",
  "lot": ${result.lot},
  "entry": ${result.entry},
  "exit": ${result.exit},
  "session": "${result.session}",
  "pl": "${result.pl}"
}`
    : scanning
      ? `{
  "status": "Scanning image...",
  "progress": "Detecting OCR patterns"
}`
      : `{
  "status": "Waiting for input...",
  "message": "Select a screenshot to extract data."
}`

  return (
    <section id="simulator" className="py-32 relative z-10">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="font-mono text-cyan-400 text-sm">INTERACTIVE DEMO</span>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mt-2 mb-4 text-white">Coba AI Vision Simulator</h2>
          <p className="text-gray-400 max-w-2xl mx-auto">Lihat bagaimana AI kami mengekstrak data dari screenshot MT5/TradingView dalam hitungan detik.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid md:grid-cols-2 gap-8 items-stretch"
        >
          {/* Left: Screenshot + Buttons */}
          <div className="glass-lux p-6 flex flex-col gap-6">
            <div
              ref={containerRef}
              className={`relative flex-1 min-h-[300px] bg-[#0a0f1d] rounded-xl border border-white/5 flex items-center justify-center overflow-hidden ${scanning ? 'scanning' : ''}`}
            >
              <div className="scan-line-anim" />

              {!activeKey && !result && (
                <div className="text-center text-gray-600 p-8">
                  <ImageUp className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="font-mono text-sm">Pilih sample screenshot untuk memulai simulasi AI Vision...</p>
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
                  <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-lg flex items-center justify-between">
                    <span className="text-xs text-gray-400 font-mono">Profit / Loss</span>
                    <span className="text-lg font-bold text-emerald-400 font-mono">{result.pl}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {Object.keys(simData).map((key) => (
                <button
                  key={key}
                  onClick={() => runSim(key)}
                  disabled={scanning}
                  className={`px-3 py-2.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
                    activeKey === key
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300'
                  }`}
                >
                  {btnLabels[key]}
                </button>
              ))}
            </div>
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
                <Terminal className="w-3 h-3" /> AI Extract Output
              </span>
            </div>
            <pre className="text-sm font-mono text-gray-300 flex-1 overflow-auto leading-relaxed">
              <code>{jsonOutput}</code>
            </pre>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
