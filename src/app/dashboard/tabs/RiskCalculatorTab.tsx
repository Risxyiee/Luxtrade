'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Lock, Target, Zap } from 'lucide-react'

interface RiskCalculatorTabProps {
  isPro: boolean
  onUpgrade: () => void
  language: string
}

// Component
function RiskCalculatorTab({ isPro, onUpgrade, language }: RiskCalculatorTabProps) {
  const [accountBalance, setAccountBalance] = useState(10000)
  const [riskPercent, setRiskPercent] = useState(2)
  const [stopLossPips, setStopLossPips] = useState(50)
  const [pipValue, setPipValue] = useState(10)

  const riskAmount = (accountBalance * riskPercent) / 100
  const lotSize = stopLossPips > 0 ? riskAmount / (stopLossPips * pipValue) : 0

  if (!isPro) {
    return (
      <Card className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 border-purple-500/30">
        <CardContent className="py-8 text-center">
          <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}>
            <Lock className="w-12 h-12 mx-auto mb-4 text-purple-400" />
          </motion.div>
          <h3 className="text-lg font-bold text-purple-400 mb-2">{language === "id" ? "Kalkulator Risiko - Fitur PRO" : "Risk Calculator - PRO Feature"}</h3>
          <p className="text-gray-400 mb-4">{language === "id" ? "Hitung ukuran lot optimal dengan presisi" : "Calculate optimal lot size with precision"}</p>
          <Button onClick={onUpgrade} className="bg-gradient-to-r from-purple-500 to-violet-600">
            <Zap className="w-4 h-4 mr-2" /> {language === "id" ? "Upgrade ke PRO" : "Upgrade to PRO"}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-[#0f0b18] to-[#12091a] border-purple-900/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-400" />
            {language === "id" ? "Kalkulator Risiko" : "Risk Calculator"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{language === "id" ? "Saldo Akun ($)" : "Account Balance ($)"}</Label>
            <Input type="number" value={accountBalance} onChange={(e) => setAccountBalance(Number(e.target.value))} className="bg-white/5 border-purple-900/30" />
          </div>
          <div>
            <Label>{language === "id" ? "Risiko per Trade (%)" : "Risk per Trade (%)"}</Label>
            <Input type="number" value={riskPercent} onChange={(e) => setRiskPercent(Number(e.target.value))} className="bg-white/5 border-purple-900/30" />
          </div>
          <div>
            <Label>{language === "id" ? "Stop Loss (Pips)" : "Stop Loss (Pips)"}</Label>
            <Input type="number" value={stopLossPips} onChange={(e) => setStopLossPips(Number(e.target.value))} className="bg-white/5 border-purple-900/30" />
          </div>
          <div>
            <Label>{language === "id" ? "Nilai per Pip ($)" : "Pip Value ($)"}</Label>
            <Input type="number" value={pipValue} onChange={(e) => setPipValue(Number(e.target.value))} className="bg-white/5 border-purple-900/30" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 border-purple-500/30">
        <CardContent className="py-6">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-xs text-gray-500 mb-1">{language === "id" ? "Risiko Maksimal" : "Max Risk"}</div>
              <div className="text-2xl font-bold text-red-400">${riskAmount.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">{language === "id" ? "Ukuran Lot" : "Lot Size"}</div>
              <div className="text-2xl font-bold text-emerald-400">{lotSize.toFixed(2)}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default RiskCalculatorTab
