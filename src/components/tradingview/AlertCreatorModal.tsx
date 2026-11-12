'use client'

/**
 * ============================================================
 * AlertCreatorModal — "Alert ala TradingView/Pine" versi Luxtradee
 * ============================================================
 * Direktif Bos (2026-11-11): "saya butuh alert yang di pine script,
 * mau bikin solusi buat orang yg bayar mahal TradingView biar ke
 * websiteku."
 *
 * Konsep: pengguna TradingView harus langganan Essential (±$13/bln)
 * cuma buat alert dari indikator + webhook. Di Luxtradee alert harga
 * cukup pasang LEVEL → engine sendiri (cron /api/cron/price-alerts,
 * cek tiap 15 menit) yang mendeteksi sentuh/nyeberang → push notif
 * ke HP user via web-push. TANPA langganan TradingView.
 *
 * Backend: /api/watchlist (GET/POST/PATCH/DELETE) — tabel `watchlist`
 * (kolom target_price), dedupe alert per (user,item,target) di tabel
 * watchlist_price_alerts. PRO-only di sisi API (403 PRO_REQUIRED).
 * ============================================================
 */

import { useCallback, useEffect, useState } from 'react'
import {
  Bell,
  Loader2,
  Trash2,
  Pencil,
  X,
  ExternalLink,
  Smartphone,
  Crown,
  CheckCircle2,
} from 'lucide-react'

interface WatchItem {
  id: string
  symbol: string
  name: string
  target_price: number | null
  notes: string | null
  created_at: string
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
  const [items, setItems] = useState<WatchItem[]>([])
  const [loading, setLoading] = useState(false)
  const [target, setTarget] = useState('')
  const [notes, setNotes] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needPro, setNeedPro] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  const loadItems = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const res = await fetch('/api/watchlist', { signal })
      const json = await res.json().catch(() => null)
      setItems(Array.isArray(json?.items) ? (json.items as WatchItem[]) : [])
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

  function resetForm() {
    setTarget('')
    setNotes('')
    setEditingId(null)
  }

  async function submit() {
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
    setEditingId(item.id)
    setTarget(item.target_price != null ? String(item.target_price) : '')
    setSuccess(null)
    setError(null)
  }

  if (!open) return null

  const tvSymbolLabel = symbolOptions.find((o) => o.id === symbol)?.label || symbol

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Buat alert harga"
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
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-white/10 bg-[#0d0d15]/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 border border-purple-400/30">
              <Bell className="h-4 w-4 text-purple-200" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Buat Alert Harga</h2>
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
                      ? 'border-purple-400/40 bg-purple-500/20 text-purple-200'
                      : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/10 hover:text-white/90'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Target harga */}
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
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-purple-400/50 focus:outline-none focus:ring-1 focus:ring-purple-400/40"
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
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-purple-400/50 focus:outline-none focus:ring-1 focus:ring-purple-400/40"
              />
            </div>
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
                <Crown className="h-3.5 w-3.5" /> Alert harga = fitur PRO
              </p>
              <p className="mt-1 leading-relaxed text-amber-200/80">
                Tetap jauh lebih murah dari langganan alert TradingView (±$13/bulan) — upgrade plan
                di menu Plan untuk mengaktifkan.
              </p>
            </div>
          )}

          {/* Tombol simpan */}
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-purple-600 text-sm font-bold text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
            {editingId ? 'Simpan Target Baru' : 'Pasang Alert'}
          </button>

          {/* Daftar alert milik user */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Alert aktif kamu
              </span>
              {loading && <Loader2 className="h-3 w-3 animate-spin text-white/40" />}
            </div>
            <div className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
              {!loading && items.length === 0 && (
                <p className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3 text-xs text-white/40">
                  Belum ada alert. Pasang level pertama di atas — notif langsung ke HP.
                </p>
              )}
              {items.map((it) => (
                <div
                  key={it.id}
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
            </div>
          </div>

          {/* Info cara kerja */}
          <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
            <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-300" />
            <p className="text-[11px] leading-relaxed text-white/50">
              Server Luxtradee mengecek harga tiap 15 menit dan mengirim{' '}
              <span className="text-white/80">notifikasi push ke HP</span> saat level kena —
              gratis dari Luxtradee, tanpa alert berbayar TradingView.
            </p>
          </div>

          {/* Jalan pintas ke TradingView (drawing/indikator tetap di sana) */}
          <p className="text-center text-[11px] text-white/35">
            Butuh alert indikator/drawing?{' '}
            <a
              href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(
                symbol === 'US100' ? 'NASDAQ:NDX' : symbol.startsWith('BTC') ||
                  symbol.startsWith('ETH') ||
                  symbol.startsWith('SOL')
                  ? `BINANCE:${symbol}`
                  : `OANDA:${symbol}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-white/60 underline decoration-white/20 underline-offset-2 hover:text-white/90"
            >
              buka chart TradingView <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
