'use client'

/**
 * ============================================================
 * AlertCreatorModal — "Alert ala TradingView/Pine" versi Luxtradee
 * ============================================================
 * Direktif Bos (2026-11-11): "saya butuh alert yang di pine script,
 * mau bikin solusi buat orang yg bayar mahal TradingView biar ke
 * websiteku" + "alert strategi dan indikator yang kita pasang…
 * alertnya lewat fitur luxtradee sendiri, numpang di chart
 * TradingView untuk visualnya aja."
 *
 * DUA JENIS ALERT (tab):
 *   1. HARGA — level harga mentah → watchlist.target_price → cron
 *      /api/cron/price-alerts (sudah LIVE sejak 11.12)
 *   2. INDIKATOR (ala Pine) — kondisi RSI/cross EMA/harga×EMA/MACD
 *      → /api/strategy-alerts → cron /api/cron/strategy-alerts
 *      menghitung indikator di server dari candle TradingView dan
 *      push HP saat kondisi kena (dedupe Once Per Bar).
 *
 * Pengganti alert Pine TradingView yang wajib langganan Essential
 * ±$13/bln (20 alert) / Plus $29.95 (100 alert). Luxtradee: kuota
 * 20 alert, GRATIS dari biaya TradingView.
 * ============================================================
 */

import { useCallback, useEffect, useState } from 'react'
import {
  Bell,
  Loader2,
  Trash2,
  Pencil,
  X,
  Smartphone,
  Crown,
  CheckCircle2,
  Activity,
  Gauge,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'

interface WatchItem {
  id: string
  symbol: string
  name: string
  target_price: number | null
  notes: string | null
  created_at: string
}

interface StrategyItem {
  id: string
  symbol: string
  cond_type: string
  timeframe: string
  rsi_period: number | null
  rsi_level: number | null
  ema_fast: number | null
  ema_slow: number | null
  notes: string | null
  active: boolean
  trigger_count: number
  last_triggered_at: string | null
  created_at: string
}

type Tab = 'harga' | 'indikator'

const COND_OPTIONS = [
  { value: 'RSI_ABOVE', label: 'RSI naik di atas level' },
  { value: 'RSI_BELOW', label: 'RSI turun di bawah level' },
  { value: 'EMA_CROSS_UP', label: 'Cross EMA naik (golden cross)' },
  { value: 'EMA_CROSS_DOWN', label: 'Cross EMA turun (death cross)' },
  { value: 'PRICE_X_EMA_ABOVE', label: 'Harga tembus EMA ke atas' },
  { value: 'PRICE_X_EMA_BELOW', label: 'Harga tembus EMA ke bawah' },
  { value: 'MACD_CROSS_UP', label: 'MACD cross naik signal' },
  { value: 'MACD_CROSS_DOWN', label: 'MACD cross turun signal' },
] as const

const TF_OPTIONS = ['5m', '15m', '30m', '1h', '2h', '4h', '1d']

function strategyLabel(a: Pick<StrategyItem, 'cond_type' | 'rsi_period' | 'rsi_level' | 'ema_fast' | 'ema_slow'>): string {
  switch (a.cond_type) {
    case 'RSI_ABOVE': return `RSI${a.rsi_period || 14} > ${a.rsi_level}`
    case 'RSI_BELOW': return `RSI${a.rsi_period || 14} < ${a.rsi_level}`
    case 'EMA_CROSS_UP': return `EMA${a.ema_fast || 9} cross↑ EMA${a.ema_slow || 21}`
    case 'EMA_CROSS_DOWN': return `EMA${a.ema_fast || 9} cross↓ EMA${a.ema_slow || 21}`
    case 'PRICE_X_EMA_ABOVE': return `Harga cross↑ EMA${a.ema_slow || 21}`
    case 'PRICE_X_EMA_BELOW': return `Harga cross↓ EMA${a.ema_slow || 21}`
    case 'MACD_CROSS_UP': return 'MACD cross↑ signal'
    case 'MACD_CROSS_DOWN': return 'MACD cross↓ signal'
    default: return a.cond_type
  }
}

interface AlertCreatorModalProps {
  open: boolean
  onClose: () => void
  /** Simbol aktif di chart — tersinkron dua arah dengan modal */
  symbol: string
  onSymbolChange: (s: string) => void
  symbolOptions: Array<{ id: string; label: string }>
}

export default function AlertCreatorModal({
  open,
  onClose,
  symbol,
  onSymbolChange,
  symbolOptions,
}: AlertCreatorModalProps) {
  const [tab, setTab] = useState<Tab>('harga')

  // --- state tab HARGA ---
  const [items, setItems] = useState<WatchItem[]>([])
  const [target, setTarget] = useState('')
  const [notes, setNotes] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  // --- state tab INDIKATOR ---
  const [stratItems, setStratItems] = useState<StrategyItem[]>([])
  const [condType, setCondType] = useState<string>('RSI_BELOW')
  const [timeframe, setTimeframe] = useState('15m')
  const [rsiPeriod, setRsiPeriod] = useState('14')
  const [rsiLevel, setRsiLevel] = useState('30')
  const [emaFast, setEmaFast] = useState('9')
  const [emaSlow, setEmaSlow] = useState('21')

  // --- state umum ---
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needPro, setNeedPro] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  const loadItems = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const [wRes, sRes] = await Promise.all([
        fetch('/api/watchlist', { signal }),
        fetch('/api/strategy-alerts', { signal }),
      ])
      const wJson = await wRes.json().catch(() => null)
      const sJson = await sRes.json().catch(() => null)
      setItems(Array.isArray(wJson?.items) ? (wJson.items as WatchItem[]) : [])
      setStratItems(Array.isArray(sJson?.items) ? (sJson.items as StrategyItem[]) : [])
    } catch {
      /* abaikan — daftar tampil kosong */
    }
    setLoading(false)
  }, [])

  /* Muat daftar alert tiap modal dibuka */
  useEffect(() => {
    if (!open) return
    const ac = new AbortController()
    void loadItems(ac.signal)
    return () => ac.abort()
  }, [open, loadItems])

  /* Escape = tutup + kunci scroll body */
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  /* Ganti simbol → bersihkan pesan */
  useEffect(() => {
    setError(null)
    setSuccess(null)
    setNeedPro(false)
  }, [symbol])

  const itemsForSymbol = items.filter(
    (i) => String(i.symbol || '').toUpperCase() === String(symbol).toUpperCase()
  )
  const hasTargetForSymbol = itemsForSymbol.some((i) => i.target_price != null)
  const editingItem = editingId ? items.find((i) => i.id === editingId) : null
  const isRsi = condType === 'RSI_ABOVE' || condType === 'RSI_BELOW'
  const isEmaCross = condType === 'EMA_CROSS_UP' || condType === 'EMA_CROSS_DOWN'
  const isPriceXEma = condType === 'PRICE_X_EMA_ABOVE' || condType === 'PRICE_X_EMA_BELOW'
  const isMacd = condType === 'MACD_CROSS_UP' || condType === 'MACD_CROSS_DOWN'

  function resetForm() {
    setTarget('')
    setNotes('')
    setEditingId(null)
  }

  async function submitHarga() {
    setError(null)
    setNeedPro(false)
    setSuccess(null)
    const t = parseFloat(target.replace(',', '.'))
    if (!Number.isFinite(t) || t <= 0) {
      setError('Isi target harga dengan angka yang valid, mis. 2650.50')
      return
    }
    setBusy(true)
    try {
      if (editingId) {
        /* Ubah target alert yang sudah ada */
        const res = await fetch('/api/watchlist', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, target_price: t }),
        })
        if (res.status === 403) {
          setNeedPro(true)
          return
        }
        if (!res.ok) {
          setError('Gagal mengubah alert. Coba lagi.')
          return
        }
        setSuccess('Target alert diperbarui — server push ke HP saat harga kena.')
      } else {
        if (hasTargetForSymbol) {
          setError(
            `Alert ${symbol} sudah terpasang — pakai tombol ubah di daftar bawah untuk mengganti levelnya.`
          )
          return
        }
        const label = symbolOptions.find((o) => o.id === symbol)?.label || symbol
        const res = await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol,
            name: label,
            target_price: t,
            notes: notes.trim() || null,
          }),
        })
        if (res.status === 403) {
          setNeedPro(true)
          return
        }
        if (!res.ok) {
          setError('Gagal memasang alert. Coba lagi.')
          return
        }
        setSuccess('Alert terpasang — server Luxtradee cek tiap 15 menit & push HP saat harga kena.')
        setNotes('')
      }
      setTarget('')
      setEditingId(null)
      await loadItems()
    } finally {
      setBusy(false)
    }
  }

  async function submitIndikator() {
    setError(null)
    setNeedPro(false)
    setSuccess(null)
    setBusy(true)
    try {
      const payload: Record<string, unknown> = {
        symbol,
        cond_type: condType,
        timeframe,
      }
      if (isRsi) {
        payload.rsi_period = parseInt(rsiPeriod) || 14
        payload.rsi_level = parseFloat(rsiLevel.replace(',', '.'))
        if (!Number.isFinite(payload.rsi_level) || (payload.rsi_level as number) <= 0) {
          setError('Isi level RSI dengan angka 1–99, mis. 30')
          return
        }
      } else if (isEmaCross) {
        payload.ema_fast = parseInt(emaFast) || 9
        payload.ema_slow = parseInt(emaSlow) || 21
        if ((payload.ema_slow as number) <= (payload.ema_fast as number)) {
          setError('EMA lambat harus lebih besar dari EMA cepat (mis. 9 & 21)')
          return
        }
      } else if (isPriceXEma) {
        payload.ema_slow = parseInt(emaSlow) || 21
      }
      if (notes.trim()) payload.notes = notes.trim()

      const res = await fetch('/api/strategy-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.status === 403) {
        setNeedPro(true)
        return
      }
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        setError(j?.error || 'Gagal memasang alert indikator. Coba lagi.')
        return
      }
      setSuccess('Alert indikator terpasang — mesin Luxtradee cek tiap 15 menit & push HP saat kondisi kena.')
      setNotes('')
      await loadItems()
    } finally {
      setBusy(false)
    }
  }

  async function removeStrategy(id: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/strategy-alerts?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (res.status === 403) setNeedPro(true)
      else if (!res.ok) setError('Gagal menghapus alert indikator.')
      await loadItems()
    } finally {
      setBusy(false)
    }
  }

  async function toggleStrategy(a: StrategyItem) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/strategy-alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: a.id, active: !a.active }),
      })
      if (res.status === 403) setNeedPro(true)
      else if (!res.ok) setError('Gagal mengubah status alert.')
      await loadItems()
    } finally {
      setBusy(false)
    }
  }

  async function removeItem(id: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/watchlist?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (!res.ok) setError('Gagal menghapus alert.')
      if (editingId === id) resetForm()
      await loadItems()
    } finally {
      setBusy(false)
    }
  }

  function startEdit(item: WatchItem) {
    setTab('harga')
    setEditingId(item.id)
    setTarget(item.target_price != null ? String(item.target_price) : '')
    setSuccess(null)
    setError(null)
  }

  if (!open) return null

  const tvSymbolLabel = symbolOptions.find((o) => o.id === symbol)?.label || symbol

  const inputCls =
    'mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-purple-400/50 focus:outline-none focus:ring-1 focus:ring-purple-400/40'
  const chipOn =
    'rounded-lg border border-purple-400/40 bg-purple-500/20 text-purple-200'
  const chipOff =
    'rounded-lg border border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/10 hover:text-white/90'

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Buat alert"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Tutup"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default"
      />

      {/* Panel */}
      <div className="relative w-full max-w-md max-h-[88vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0d0d15] shadow-2xl shadow-purple-500/10">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0d0d15]/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 border border-purple-400/30">
                <Bell className="h-4 w-4 text-purple-200" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Buat Alert</h2>
                <p className="text-[11px] text-white/50">
                  Mesin alert Luxtradee —{' '}
                  <span className="font-semibold text-blue-300">tanpa langganan TradingView</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup modal"
              className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white/80 min-h-[36px] min-w-[36px]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tab switcher */}
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-1">
            <button
              type="button"
              onClick={() => { setTab('harga'); setError(null); setSuccess(null) }}
              aria-pressed={tab === 'harga'}
              className={`flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-colors ${
                tab === 'harga' ? 'bg-purple-500/20 text-purple-100' : 'text-white/50 hover:text-white/80'
              }`}
            >
              <Gauge className="h-3.5 w-3.5" /> Harga
            </button>
            <button
              type="button"
              onClick={() => { setTab('indikator'); setError(null); setSuccess(null) }}
              aria-pressed={tab === 'indikator'}
              className={`flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-colors ${
                tab === 'indikator' ? 'bg-purple-500/20 text-purple-100' : 'text-white/50 hover:text-white/80'
              }`}
            >
              <Activity className="h-3.5 w-3.5" /> Indikator (ala Pine)
            </button>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* Pilih simbol */}
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Simbol
            </span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {symbolOptions.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    onSymbolChange(o.id)
                    resetForm()
                  }}
                  aria-pressed={symbol === o.id}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors min-h-[32px] ${
                    symbol === o.id
                      ? chipOn
                      : chipOff
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* ============ TAB HARGA ============ */}
          {tab === 'harga' && (
            <>
              <div>
                <label
                  htmlFor="alert-target"
                  className="text-[10px] font-semibold uppercase tracking-wider text-white/40"
                >
                  Target harga {tvSymbolLabel}
                </label>
                <input
                  id="alert-target"
                  inputMode="decimal"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="mis. 2650.50"
                  className={inputCls}
                />
                <p className="mt-1.5 text-[11px] leading-relaxed text-white/40">
                  Notif terkirim saat harga <span className="text-white/70">menyentuh</span> atau{' '}
                  <span className="text-white/70">menyeberang</span> level ini (deteksi otomatis).
                </p>
              </div>

              {/* Catatan (opsional) — hanya saat membuat baru */}
              {!editingId && (
                <div>
                  <label
                    htmlFor="alert-notes"
                    className="text-[10px] font-semibold uppercase tracking-wider text-white/40"
                  >
                    Catatan (opsional)
                  </label>
                  <input
                    id="alert-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="mis. breakout box sesi Asia"
                    maxLength={120}
                    className={inputCls}
                  />
                </div>
              )}

              <button
                type="button"
                onClick={submitHarga}
                disabled={busy}
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-purple-600 text-sm font-bold text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                {editingId ? 'Simpan Target Baru' : 'Pasang Alert Harga'}
              </button>
            </>
          )}

          {/* ============ TAB INDIKATOR (ALA PINE) ============ */}
          {tab === 'indikator' && (
            <>
              <div>
                <label
                  htmlFor="alert-cond"
                  className="text-[10px] font-semibold uppercase tracking-wider text-white/40"
                >
                  Kondisi (seperti alert Pine Script)
                </label>
                <select
                  id="alert-cond"
                  value={condType}
                  onChange={(e) => { setCondType(e.target.value); setError(null); setSuccess(null) }}
                  className={inputCls}
                >
                  {COND_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} className="bg-[#0d0d15]">
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  Timeframe
                </span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {TF_OPTIONS.map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => setTimeframe(tf)}
                      aria-pressed={timeframe === tf}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors min-h-[32px] ${
                        timeframe === tf ? chipOn : chipOff
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              {/* Parameter per kondisi */}
              {isRsi && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="rsi-period" className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      Periode RSI
                    </label>
                    <input
                      id="rsi-period" inputMode="numeric" value={rsiPeriod}
                      onChange={(e) => setRsiPeriod(e.target.value)} placeholder="14" className={inputCls}
                    />
                  </div>
                  <div>
                    <label htmlFor="rsi-level" className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      Level (1–99)
                    </label>
                    <input
                      id="rsi-level" inputMode="decimal" value={rsiLevel}
                      onChange={(e) => setRsiLevel(e.target.value)} placeholder="30" className={inputCls}
                    />
                  </div>
                </div>
              )}
              {isEmaCross && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="ema-fast" className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      EMA cepat
                    </label>
                    <input
                      id="ema-fast" inputMode="numeric" value={emaFast}
                      onChange={(e) => setEmaFast(e.target.value)} placeholder="9" className={inputCls}
                    />
                  </div>
                  <div>
                    <label htmlFor="ema-slow" className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      EMA lambat
                    </label>
                    <input
                      id="ema-slow" inputMode="numeric" value={emaSlow}
                      onChange={(e) => setEmaSlow(e.target.value)} placeholder="21" className={inputCls}
                    />
                  </div>
                </div>
              )}
              {isPriceXEma && (
                <div>
                  <label htmlFor="pxema-slow" className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    Periode EMA
                  </label>
                  <input
                    id="pxema-slow" inputMode="numeric" value={emaSlow}
                    onChange={(e) => setEmaSlow(e.target.value)} placeholder="21" className={inputCls}
                  />
                </div>
              )}
              {isMacd && (
                <p className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-[11px] text-white/50">
                  Memakai setting standar Pine <span className="font-mono text-white/80">MACD(12, 26, 9)</span> — cross
                  garis MACD melawan garis signal.
                </p>
              )}

              <div>
                <label
                  htmlFor="alert-notes-ind"
                  className="text-[10px] font-semibold uppercase tracking-wider text-white/40"
                >
                  Catatan (opsional)
                </label>
                <input
                  id="alert-notes-ind"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="mis. setup scalping sesi London"
                  maxLength={120}
                  className={inputCls}
                />
              </div>

              <button
                type="button"
                onClick={submitIndikator}
                disabled={busy}
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-purple-600 text-sm font-bold text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                Pasang Alert Indikator
              </button>
            </>
          )}

          {/* Error / sukses / upsell */}
          {error && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
              {error}
            </p>
          )}
          {success && (
            <p className="flex items-start gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2.5 text-xs text-blue-200">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {success}
            </p>
          )}
          {needPro && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-xs text-amber-200">
              <p className="flex items-center gap-1.5 font-semibold">
                <Crown className="h-3.5 w-3.5" /> Alert = fitur PRO
              </p>
              <p className="mt-1 leading-relaxed text-amber-200/80">
                Tetap jauh lebih murah dari langganan alert TradingView (±$13/bulan) — upgrade plan
                di menu Plan untuk mengaktifkan.
              </p>
            </div>
          )}

          {/* Daftar alert milik user */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Alert aktif kamu
              </span>
              {loading && <Loader2 className="h-3 w-3 animate-spin text-white/40" />}
            </div>
            <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
              {!loading && items.length === 0 && stratItems.length === 0 && (
                <p className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3 text-xs text-white/40">
                  Belum ada alert. Pasang level harga atau kondisi indikator di atas — notif langsung ke HP.
                </p>
              )}

              {/* Alert harga (watchlist) */}
              {items.map((it) => (
                <div
                  key={`w-${it.id}`}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 ${
                    editingId === it.id
                      ? 'border-purple-400/40 bg-purple-500/10'
                      : 'border-white/10 bg-white/[0.02]'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white">
                      {it.name || it.symbol}
                      {it.target_price != null ? (
                        <span className="ml-1.5 font-mono font-semibold text-blue-300">
                          @ {it.target_price}
                        </span>
                      ) : (
                        <span className="ml-1.5 text-[10px] font-normal text-white/40">
                          tanpa target
                        </span>
                      )}
                    </p>
                    {it.notes && (
                      <p className="truncate text-[11px] text-white/40">{it.notes}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(it)}
                      aria-label={`Ubah target ${it.name || it.symbol}`}
                      title="Ubah target"
                      className="rounded-lg p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white/90 min-h-[32px] min-w-[32px]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(it.id)}
                      aria-label={`Hapus alert ${it.name || it.symbol}`}
                      title="Hapus alert"
                      className="rounded-lg p-2 text-white/50 transition-colors hover:bg-red-500/15 hover:text-red-300 min-h-[32px] min-w-[32px]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Alert indikator (strategy_alerts) */}
              {stratItems.map((a) => (
                <div
                  key={`s-${a.id}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-white">
                      {a.symbol}
                      <span className="rounded bg-white/10 px-1 py-0.5 text-[10px] font-mono text-white/70">
                        {a.timeframe}
                      </span>
                      <span className={`ml-0.5 ${a.active ? 'text-purple-300' : 'text-white/30'}`}>
                        {strategyLabel(a)}
                      </span>
                    </p>
                    <p className="text-[10px] text-white/35">
                      {a.active
                        ? `aktif${a.trigger_count > 0 ? ` · ${a.trigger_count}× terpicu` : ''}`
                        : 'nonaktif'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {/* Toggle aktif */}
                    <button
                      type="button"
                      onClick={() => toggleStrategy(a)}
                      aria-label={a.active ? `Nonaktifkan ${a.symbol}` : `Aktifkan ${a.symbol}`}
                      title={a.active ? 'Nonaktifkan' : 'Aktifkan'}
                      role="switch"
                      aria-checked={a.active}
                      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
                        a.active ? 'bg-purple-500/70' : 'bg-white/15'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                          a.active ? 'left-[18px]' : 'left-0.5'
                        }`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeStrategy(a.id)}
                      aria-label={`Hapus alert indikator ${a.symbol}`}
                      title="Hapus alert"
                      className="rounded-lg p-2 text-white/50 transition-colors hover:bg-red-500/15 hover:text-red-300 min-h-[32px] min-w-[32px]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Info cara kerja */}
          <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
            <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-300" />
            <p className="text-[11px] leading-relaxed text-white/50">
              Server Luxtradee mengecek tiap 15 menit dan mengirim{' '}
              <span className="text-white/80">notifikasi push ke HP</span> — level harga atau kondisi
              indikator, semua gratis dari Luxtradee, tanpa alert berbayar TradingView.
            </p>
          </div>

          {/* Penanda jenis alert */}
          <p className="flex items-center justify-center gap-3 text-center text-[10px] text-white/30">
            <span className="inline-flex items-center gap-1"><Gauge className="h-3 w-3" /> harga</span>
            <span className="inline-flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /><TrendingDown className="-ml-2 h-3 w-3" /> indikator ala Pine
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
