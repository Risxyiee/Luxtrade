'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function TestPromoPage() {
  const [promoCode, setPromoCode] = useState('TRADERCEPAT')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const testApply = async () => {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch('/api/promo/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promoCode: promoCode,
          plan: 'PRO'
        })
      })

      const data = await res.json()
      setResult(data)

      if (!res.ok || !data.success) {
        setError(data.message || data.error || 'Gagal')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-md mx-auto mt-10">
        <h1 className="text-2xl font-bold text-white mb-6">Test Promo Code</h1>

        <div className="space-y-4">
          <div>
            <label className="text-white/60 text-sm mb-2 block">Promo Code</label>
            <Input
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="TRADERCEPAT"
              className="bg-white/5 border-white/10 text-white"
            />
          </div>

          <Button
            onClick={testApply}
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600"
          >
            {loading ? 'Loading...' : 'Apply Promo'}
          </Button>

          {error && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400 text-sm whitespace-pre-wrap">{error}</p>
            </div>
          )}

          {result && (
            <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-lg p-4">
              <p className="text-emerald-400 font-semibold mb-2">Result:</p>
              <pre className="text-white/80 text-xs whitespace-pre-wrap overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}