'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { AlertCircle, ArrowDownRight, ArrowUpRight } from 'lucide-react'

/**
 * KALKULATOR LOT XAUUSD (client) — dipakai halaman publik
 * /kalkulator-lot-xauusd. Tanpa login, tanpa API: semua hitungan lokal
 * di browser supaya instan dan tetap jalan walau lambat jaringan.
 *
 * Konvensi XAUUSD (kontrak standar 100 oz):
 *   - 1 lot = 100 oz → pergerakan $1 = $100 per lot
 *   - 1 pip  = $0,10 → $10 per pip per lot
 *   - 1 point = $0,01 → $1 per point per lot
 *   - Lot = Risiko USD ÷ (jarak SL × 100), dibulatkan KE BAWAH ke 0,01
 *     supaya risiko aktual tidak pernah melebihi target.
 *
 * Parser angka toleran format Indonesia & US: "2.000,5", "2,000.5",
 * "2000.5", "2000" semuanya valid.
 */

/** Parse angka toleran: koma/titik desimal, titik ribuan pola 2.000 / 2.000.000 */
function parseNum(raw: string): number {
  const s = raw.trim().replace(/\s/g, '')
  if (!s) return NaN
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  let t = s
  if (hasComma && hasDot) {
    // Terakhir mana yang jadi desimal: "2.000,5" vs "2,000.5"
    t =
      s.lastIndexOf(',') > s.lastIndexOf('.')
        ? s.replace(/\./g, '').replace(',', '.')
        : s.replace(/,/g, '')
  } else if (hasComma) {
    // Koma tunggal = desimal ("2000,5"), kecuali pola ribuan "2,000" / "2,000,000"
    t = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.')
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    // Titik ribuan "2.000" / "2.000.000" (tanpa desimal lain)
    t = s.replace(/\./g, '')
  }
  return Number(t)
}

const usd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
const price = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const RR_OPTIONS = [1, 1.5, 2, 2.5, 3, 4]

type CalcResult =
  | {
      ok: true
      dir: 'BUY' | 'SELL'
      dist: number
      pips: number
      points: number
      riskTarget: number
      lot: number
      riskActual: number
      pipValue: number
      tp: number
      reward: number
      lotCapped: boolean
    }
  | { ok: false; err: string }

export default function LotCalculator() {
  const [balance, setBalance] = useState('1000')
  const [riskPct, setRiskPct] = useState(2)
  const [entry, setEntry] = useState('2000')
  const [sl, setSl] = useState('1995')
  const [rr, setRr] = useState(2)

  const result: CalcResult = useMemo(() => {
    const bal = parseNum(balance)
    const e = parseNum(entry)
    const s = parseNum(sl)
    if (!isFinite(bal) || bal <= 0) return { ok: false, err: 'Isi saldo akun dengan angka yang valid (dalam USD).' }
    if (!isFinite(e) || e <= 0) return { ok: false, err: 'Isi harga entry dengan angka yang valid.' }
    if (!isFinite(s) || s <= 0) return { ok: false, err: 'Isi harga stop loss dengan angka yang valid.' }
    if (e === s) return { ok: false, err: 'Harga stop loss tidak boleh sama dengan harga entry.' }
    if (riskPct <= 0 || riskPct > 100) return { ok: false, err: 'Risiko per trade harus di antara 0,1% dan 100%.' }

    const dir: 'BUY' | 'SELL' = s < e ? 'BUY' : 'SELL'
    const dist = Math.abs(e - s)
    const riskTarget = (bal * riskPct) / 100
    const rawLot = riskTarget / (dist * 100)
    // Floor ke 0,01 — risiko aktual tidak pernah melebihi target
    const lot = Math.floor(rawLot * 100) / 100
    if (lot < 0.01)
      return {
        ok: false,
        err: `Risiko ${usd(riskTarget)} terlalu kecil untuk jarak SL ${usd(dist)} — butuh lot di bawah 0,01. Perbesar risiko atau perkecil jarak SL.`,
      }
    const riskActual = lot * dist * 100
    const pipValue = lot * 10
    const tp = dir === 'BUY' ? e + dist * rr : e - dist * rr
    const reward = riskActual * rr
    return {
      ok: true,
      dir,
      dist,
      pips: dist / 0.1,
      points: dist / 0.01,
      riskTarget,
      lot,
      riskActual,
      pipValue,
      tp,
      reward,
      lotCapped: lot >= 100,
    }
  }, [balance, riskPct, entry, sl, rr])

  return (
    <Card className="border-amber-500/20">
      <CardContent className="p-4 sm:p-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* ===== INPUT ===== */}
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="calc-balance">Saldo akun (USD)</Label>
              <Input
                id="calc-balance"
                inputMode="decimal"
                value={balance}
                onChange={(ev) => setBalance(ev.target.value)}
                placeholder="contoh: 1000"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="calc-risk">Risiko per trade</Label>
                <span className="text-sm font-semibold text-amber-500" aria-live="polite">
                  {riskPct.toLocaleString('id-ID')}%
                </span>
              </div>
              <Slider
                id="calc-risk"
                min={0.1}
                max={10}
                step={0.1}
                value={[riskPct]}
                onValueChange={(v) => setRiskPct(v[0] ?? 2)}
                aria-label="Persentase risiko per trade"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0,1%</span>
                <span>10%</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="calc-entry">Harga entry</Label>
                <Input
                  id="calc-entry"
                  inputMode="decimal"
                  value={entry}
                  onChange={(ev) => setEntry(ev.target.value)}
                  placeholder="contoh: 2000"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="calc-sl">Harga stop loss</Label>
                <Input
                  id="calc-sl"
                  inputMode="decimal"
                  value={sl}
                  onChange={(ev) => setSl(ev.target.value)}
                  placeholder="contoh: 1995"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Rasio risk-reward</Label>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Pilih rasio risk-reward">
                {RR_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setRr(opt)}
                    aria-pressed={rr === opt}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                      rr === opt
                        ? 'border-amber-500 bg-amber-500/15 text-amber-500'
                        : 'hover:bg-muted'
                    }`}
                  >
                    1:{opt.toLocaleString('id-ID')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ===== HASIL ===== */}
          <div
            className="flex flex-col rounded-lg border bg-muted/30 p-4 sm:p-5"
            aria-live="polite"
          >
            {!result.ok ? (
              <div className="flex flex-1 items-center justify-center text-center">
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                  {result.err}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Arah posisi (dari SL)</span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      result.dir === 'BUY'
                        ? 'bg-emerald-500/15 text-emerald-500'
                        : 'bg-red-500/15 text-red-500'
                    }`}
                  >
                    {result.dir === 'BUY' ? (
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {result.dir}
                  </span>
                </div>

                <div className="mt-3 text-center">
                  <p className="text-sm text-muted-foreground">Ukuran lot yang tepat</p>
                  <p className="mt-1 text-5xl font-bold tracking-tight text-amber-500">
                    {result.lot.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  {result.lotCapped && (
                    <p className="mt-1 text-xs text-amber-500">
                      Lot sangat besar — pastikan sesuai leverage & margin broker kamu.
                    </p>
                  )}
                </div>

                <dl className="mt-5 space-y-2 text-sm">
                  {[
                    ['Jarak stop loss', `${usd(result.dist)} (${result.pips.toFixed(0)} pip)`],
                    ['Risiko target', usd(result.riskTarget)],
                    ['Risiko aktual (lot dibulatkan)', usd(result.riskActual)],
                    ['Nilai per pip posisi ini', usd(result.pipValue)],
                    [
                      `Take profit saran (1:${rr.toLocaleString('id-ID')})`,
                      usd(result.tp),
                    ],
                    ['Potensi profit', usd(result.reward)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-3">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>

                <p className="mt-4 border-t pt-3 text-xs leading-relaxed text-muted-foreground">
                  Dibulatkan ke bawah ke 0,01 lot supaya risiko aktual tidak pernah melebihi
                  target. Kontrak standar 100 oz — cek Contract Size broker untuk akun cent/micro.
                </p>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
