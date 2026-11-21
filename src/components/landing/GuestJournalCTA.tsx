'use client'

/**
 * ============================================================
 * GuestJournalCTA — jurnal tamu tanpa akun (landing)
 * ============================================================
 * FIX kejujuran CTA (arahan Bos): visitor harus bisa MENCOBA inti
 * produk — mencatat trade — sebelum diminta daftar. Signup tidak
 * pernah diminta duluan:
 *   1. Tamu isi form trade (pair, BUY/SELL, entry, SL, TP, lot, catatan)
 *   2. Tersimpan di browser (localStorage) → langsung tampil di daftar
 *   3. BARU setelah trade tercatat muncul CTA "Simpan permanen — Daftar"
 *
 * SSR-safe: akses localStorage hanya di useEffect / handler.
 * Catatan jujur: data localStorage TIDAK otomatis pindah ke akun —
 * CTA di bawah tidak pernah menjanjikan migrasi otomatis.
 * ============================================================
 */

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { PenLine, CheckCircle2, Trash2, Lock, Sparkles, Loader2 } from 'lucide-react'

interface GuestJournalCTAProps {
  language?: 'id' | 'en'
}

type GuestTrade = {
  id: string
  pair: string
  direction: 'BUY' | 'SELL'
  entry: string
  sl: string
  tp: string
  lot: string
  note: string
  createdAt: string
}

const STORAGE_KEY = 'luxtradee_guest_journal'

/** Pilihan pair form tamu — Auto Jurnal bisa MENAMBAH pair dinamis
 *  kalau AI mendeteksi pair lain dari teks yang ditempel. */
const BASE_PAIRS = ['XAUUSD', 'XAGUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'NZDUSD', 'USDCAD', 'BTCUSD', 'ETHUSD']

/** Batas jurnal tamu (permintaan Bos: "batasin 2 atau 3 kali kalau udah
 *  ketiga suruh orang buat daftar") — tamu bebas mencatat 3 trade;
 *  pas catatan ke-3 tersimpan, form dikunci dan tamu disuruh daftar. */
const MAX_GUEST_TRADES = 3

const EMPTY_FORM = {
  pair: 'XAUUSD',
  direction: 'BUY' as 'BUY' | 'SELL',
  entry: '',
  sl: '',
  tp: '',
  lot: '',
  note: '',
}

export default function GuestJournalCTA({ language = 'id' }: GuestJournalCTAProps) {
  const isEn = language === 'en'
  const [trades, setTrades] = useState<GuestTrade[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [justSaved, setJustSaved] = useState(false)

  /* ── AUTO JURNAL (permintaan Bos): tempel teks trade → AI isi form ──
     Dua tab: "Isi Manual" (form lama) & "Auto Jurnal" (tempel teks).
     Hasil parse AI MENGISI form manual — tamu tetap review & simpan
     sendiri (angka tidak pernah langsung disimpan tanpa lihat). */
  const [mode, setMode] = useState<'manual' | 'auto'>('manual')
  const [rawText, setRawText] = useState('')
  const [autoLoading, setAutoLoading] = useState(false)
  const [autoError, setAutoError] = useState('')
  const [autoNote, setAutoNote] = useState('')
  const [pairOptions, setPairOptions] = useState<string[]>(BASE_PAIRS)

  /* ── Batas jurnal tamu: 3 catatan, habis → form dikunci + CTA daftar ── */
  const limitReached = trades.length >= MAX_GUEST_TRADES
  const remaining = Math.max(0, MAX_GUEST_TRADES - trades.length)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setTrades(parsed)
      }
    } catch {
      /* storage diblok — form tetap jalan, cuma tidak persist */
    }
  }, [])

  const persist = (next: GuestTrade[]) => {
    setTrades(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* abaikan — private mode */
    }
  }

  const isNumeric = (v: string) => v.trim() !== '' && isFinite(Number(v))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (trades.length >= MAX_GUEST_TRADES) {
      setError(
        isEn
          ? 'Guest journal is full (3 trades) — sign up free to keep journaling.'
          : 'Jurnal tamu penuh (3 trade) — daftar gratis untuk lanjut mencatat.'
      )
      return
    }
    if (!isNumeric(form.entry) || !isNumeric(form.sl) || !isNumeric(form.tp)) {
      setError(
        isEn
          ? 'Entry, Stop Loss, and Take Profit are required and must be valid numbers.'
          : 'Entry, Stop Loss, dan Take Profit wajib diisi dengan angka yang valid.'
      )
      return
    }
    setError('')
    const trade: GuestTrade = {
      ...form,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    }
    persist([trade, ...trades])
    setJustSaved(true)
    setForm(EMPTY_FORM)
  }

  const clearAll = () => {
    persist([])
    setJustSaved(false)
  }

  /* ── AUTO JURNAL: kirim teks ke /api/journal/auto-parse → isi form.
     Jujur: gagal AI / rate limit / teks tidak jelas → pesan jelas,
     form TIDAK diisi sebagian. Sukses → tamu diarahkan ke form manual
     untuk review sebelum simpan. */
  const handleAutoParse = async () => {
    if (autoLoading) return
    if (trades.length >= MAX_GUEST_TRADES) {
      setAutoError(
        isEn
          ? 'Guest journal is full (3 trades) — sign up free to keep journaling.'
          : 'Jurnal tamu penuh (3 trade) — daftar gratis untuk lanjut mencatat.'
      )
      return
    }
    const text = rawText.trim()
    if (text.length < 2) {
      setAutoError(isEn ? 'Paste your trade text first.' : 'Tempel teks trade-nya dulu ya.')
      return
    }
    setAutoError('')
    setAutoNote('')
    setAutoLoading(true)
    try {
      const res = await fetch('/api/journal/auto-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok || !data?.fields) {
        setAutoError(
          String(
            data?.error ||
              (isEn
                ? 'AI could not read that text — try writing it differently or fill the form manually.'
                : 'AI belum bisa baca teks itu — coba tulis ulang atau isi manual.')
          )
        )
        return
      }
      const f = data.fields as {
        pair?: string
        direction?: 'BUY' | 'SELL'
        entry?: string
        sl?: string
        tp?: string
        lot?: string
        note?: string
      }
      setForm({
        pair: String(f.pair || 'XAUUSD'),
        direction: f.direction === 'SELL' ? 'SELL' : 'BUY',
        entry: String(f.entry || ''),
        sl: String(f.sl || ''),
        tp: String(f.tp || ''),
        lot: String(f.lot || ''),
        note: String(f.note || ''),
      })
      const p = String(f.pair || '')
      if (p && !BASE_PAIRS.includes(p)) {
        setPairOptions((prev) => (prev.includes(p) ? prev : [...prev, p]))
      }
      setAutoNote(String(data.note || ''))
      setJustSaved(false)
      setMode('manual') // review & simpan di form
    } catch {
      setAutoError(
        isEn
          ? 'Connection problem — try again or fill the form manually.'
          : 'Masalah koneksi — coba lagi atau isi form manual.'
      )
    } finally {
      setAutoLoading(false)
    }
  }

  const fillSample = () => {
    setAutoError('')
    setAutoNote('')
    setRawText(
      isEn
        ? 'buy gold 2034.5, sl 2030, tp 2050, lot 0.10 — london breakout, RR 1:2'
        : 'buy gold 2034.5, sl 2030, tp 2050, lot 0.10 — breakout london, RR 1:2'
    )
  }

  const inputCls =
    'w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-400/40 transition-colors'

  return (
    <section id="jurnal-tamu" className="py-20 md:py-24 px-4 relative z-10" aria-labelledby="guest-journal-title">
      <div className="max-w-6xl mx-auto">
        {/* ---------- Header ---------- */}
        <div className="text-center max-w-3xl mx-auto mb-10 md:mb-14">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold tracking-wider text-emerald-300">
            <PenLine className="w-3.5 h-3.5" />
            {isEn ? 'NO SIGN UP NEEDED' : 'TANPA DAFTAR'}
          </span>
          <h2 id="guest-journal-title" className="mt-4 text-3xl md:text-4xl font-extrabold leading-tight">
            {isEn ? 'Log Your First Trade — Right Now' : 'Catat Trade Pertamamu — Sekarang Juga'}
          </h2>
          <p className="mt-4 text-white/60 text-sm md:text-base leading-relaxed">
            {isEn
              ? 'Fill the form below — your trade is saved in your own browser instantly. No account, no email, no credit card. Sign up is only offered afterwards, if you want to keep your journal permanently.'
              : 'Isi form di bawah — trade kamu langsung tersimpan di browser sendiri. Tanpa akun, tanpa email, tanpa kartu kredit. Daftar hanya ditawarkan setelahnya, kalau kamu ingin jurnal tersimpan permanen.'}
          </p>
          <p className="mt-2 text-white/40 text-xs md:text-sm">
            {isEn
              ? 'Too lazy to type numbers? Use the “Auto Journal (AI)” tab — paste your trade text and AI fills the form for you.'
              : 'Males ngetik angka? Pakai tab “Auto Jurnal (AI)” — tempel teks trade, AI isiin formnya.'}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 items-start">
          {/* ---------- Form ---------- */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
            {limitReached ? (
              /* ── BATAS TERCAPAI (permintaan Bos): catatan ke-3 tersimpan →
                 form dikunci, tamu disuruh daftar. Jujur: data tetap di
                 browser, tidak ada yang hilang. ── */
              <div className="flex flex-col items-center text-center gap-3 py-8" role="status">
                <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-cyan-500/15 border border-cyan-400/30">
                  <Lock className="w-5 h-5 text-cyan-300" aria-hidden="true" />
                </span>
                <p className="text-sm font-bold text-white">
                  {isEn ? 'Guest journal full — 3 of 3 trades' : 'Jurnal tamu penuh — 3 dari 3 trade'}
                </p>
                <p className="text-xs text-white/50 leading-relaxed max-w-[320px]">
                  {isEn
                    ? 'Your 3 trades stay safe in this browser. Create a free account to journal without limits — saved permanently, plus AI analysis of every trade.'
                    : '3 trade kamu tetap aman di browser ini. Daftar gratis untuk catat tanpa batas — tersimpan permanen, plus analisis AI tiap trade.'}
                </p>
                <Link
                  href="/auth/signup"
                  prefetch={false}
                  className="mt-1 inline-flex items-center justify-center gap-2 min-h-[48px] w-full max-w-[320px] rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 text-white text-sm font-bold hover:opacity-90 transition-all"
                >
                  {isEn ? 'Sign Up Free — Keep Journaling' : 'Daftar Gratis — Lanjut Catat'}
                </Link>
                <button
                  type="button"
                  onClick={clearAll}
                  className="min-h-[44px] px-2 text-[11px] text-white/35 hover:text-white/60 underline underline-offset-2 cursor-pointer"
                >
                  {isEn
                    ? 'Or clear the guest journal — 3 free slots again (all guest data deleted)'
                    : 'Atau hapus jurnal tamu — 3 slot bebas lagi (semua data tamu terhapus)'}
                </button>
              </div>
            ) : (
            <>
            {/* ── Cara isi: manual atau AUTO JURNAL (AI) ── */}
            <div className="grid grid-cols-2 gap-2 mb-5" role="group" aria-label={isEn ? 'Input method' : 'Cara isi form'}>
              <button
                type="button"
                onClick={() => setMode('manual')}
                aria-pressed={mode === 'manual'}
                className={`min-h-[44px] rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                  mode === 'manual'
                    ? 'bg-white/10 text-white border border-white/30'
                    : 'bg-white/[0.04] text-gray-400 border border-white/10 hover:bg-white/[0.07]'
                }`}
              >
                {isEn ? 'Fill Manually' : 'Isi Manual'}
              </button>
              <button
                type="button"
                onClick={() => setMode('auto')}
                aria-pressed={mode === 'auto'}
                className={`min-h-[44px] rounded-xl text-sm font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  mode === 'auto'
                    ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-400/40'
                    : 'bg-white/[0.04] text-gray-400 border border-white/10 hover:bg-white/[0.07]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                {isEn ? 'Auto Journal (AI)' : 'Auto Jurnal (AI)'}
              </button>
            </div>

            {mode === 'auto' ? (
              /* ── Panel AUTO JURNAL: tempel teks → AI isi form ── */
              <div className="flex flex-col gap-3">
                <label htmlFor="gj-raw" className="block text-xs font-medium text-white/60">
                  {isEn
                    ? 'Paste your raw trade text — MT4/MT5 history, broker notification, or just write it freely'
                    : 'Tempel teks trade mentah kamu — history MT4/MT5, notifikasi broker, atau tulisan bebas'}
                </label>
                <textarea
                  id="gj-raw"
                  rows={5}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={
                    isEn
                      ? 'e.g. buy gold 2034.5, sl 2030, tp 2050, lot 0.10 — london breakout, RR 1:2'
                      : 'mis. buy gold 2034.5, sl 2030, tp 2050, lot 0.10 — breakout london, RR 1:2'
                  }
                  className={`${inputCls} resize-y`}
                />
                <button
                  type="button"
                  onClick={fillSample}
                  className="self-start min-h-[44px] py-2 px-1 text-[11px] text-cyan-300/80 hover:text-cyan-200 underline underline-offset-2 cursor-pointer"
                >
                  {isEn ? 'Try an example' : 'Coba contoh'}
                </button>

                {autoError && (
                  <p role="alert" className="text-xs text-red-300 bg-red-500/10 border border-red-400/20 rounded-lg px-3 py-2">
                    {autoError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleAutoParse}
                  disabled={autoLoading}
                  className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-400 text-white text-sm font-bold hover:opacity-90 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {autoLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="w-4 h-4" aria-hidden="true" />
                  )}
                  {autoLoading
                    ? isEn
                      ? 'AI is reading your trade…'
                      : 'AI sedang membaca trade…'
                    : isEn
                      ? 'Auto-Fill the Form'
                      : 'Isi Form Otomatis'}
                </button>

                <p className="text-[11px] text-white/40 flex items-start gap-1.5">
                  <Lock className="w-3 h-3 shrink-0 mt-0.5" aria-hidden="true" />
                  {isEn
                    ? 'AI only uses numbers found in your text — nothing is invented. After auto-fill you review everything before saving.'
                    : 'AI hanya memakai angka yang ada di teks kamu — tidak ada yang dikarang. Setelah form terisi, kamu review dulu sebelum simpan.'}
                </p>
              </div>
            ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-label={isEn ? 'Guest trade journal form' : 'Form jurnal trade tamu'}>
              {/* Pair (fixed) + Direction */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="gj-pair" className="block text-xs font-medium text-white/60 mb-1.5">
                    {isEn ? 'Pair' : 'Pair'}
                  </label>
                  <select
                    id="gj-pair"
                    value={form.pair}
                    onChange={(e) => setForm({ ...form, pair: e.target.value })}
                    className={inputCls}
                  >
                    {pairOptions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="block text-xs font-medium text-white/60 mb-1.5">{isEn ? 'Direction' : 'Arah'}</span>
                  <div className="grid grid-cols-2 gap-2" role="group" aria-label={isEn ? 'Trade direction' : 'Arah trade'}>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, direction: 'BUY' })}
                      aria-pressed={form.direction === 'BUY'}
                      className={`min-h-[44px] rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                        form.direction === 'BUY'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                          : 'bg-white/[0.04] text-gray-400 border border-white/10 hover:bg-white/[0.07]'
                      }`}
                    >
                      BUY
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, direction: 'SELL' })}
                      aria-pressed={form.direction === 'SELL'}
                      className={`min-h-[44px] rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                        form.direction === 'SELL'
                          ? 'bg-red-500/20 text-red-300 border border-red-400/40'
                          : 'bg-white/[0.04] text-gray-400 border border-white/10 hover:bg-white/[0.07]'
                      }`}
                    >
                      SELL
                    </button>
                  </div>
                </div>
              </div>

              {/* Entry / SL / TP */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="gj-entry" className="block text-xs font-medium text-white/60 mb-1.5">
                    {isEn ? 'Entry' : 'Entry'}
                  </label>
                  <input
                    id="gj-entry"
                    inputMode="decimal"
                    placeholder="2034.50"
                    value={form.entry}
                    onChange={(e) => setForm({ ...form, entry: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="gj-sl" className="block text-xs font-medium text-white/60 mb-1.5">
                    {isEn ? 'Stop Loss' : 'Stop Loss'}
                  </label>
                  <input
                    id="gj-sl"
                    inputMode="decimal"
                    placeholder="2030.00"
                    value={form.sl}
                    onChange={(e) => setForm({ ...form, sl: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="gj-tp" className="block text-xs font-medium text-white/60 mb-1.5">
                    {isEn ? 'Take Profit' : 'Take Profit'}
                  </label>
                  <input
                    id="gj-tp"
                    inputMode="decimal"
                    placeholder="2050.00"
                    value={form.tp}
                    onChange={(e) => setForm({ ...form, tp: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Lot + Note */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="gj-lot" className="block text-xs font-medium text-white/60 mb-1.5">
                    {isEn ? 'Lot size' : 'Ukuran lot'}
                  </label>
                  <input
                    id="gj-lot"
                    inputMode="decimal"
                    placeholder="0.10"
                    value={form.lot}
                    onChange={(e) => setForm({ ...form, lot: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div className="col-span-2">
                  <label htmlFor="gj-note" className="block text-xs font-medium text-white/60 mb-1.5">
                    {isEn ? 'Short note' : 'Catatan singkat'}
                  </label>
                  <input
                    id="gj-note"
                    placeholder={isEn ? 'e.g. London breakout, RR 1:2' : 'mis. Breakout London, RR 1:2'}
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              {autoNote && (
                <p role="status" className="text-xs text-cyan-200 bg-cyan-500/10 border border-cyan-400/20 rounded-lg px-3 py-2 flex items-start gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    <strong className="font-semibold">{isEn ? 'Auto-filled by AI. ' : 'Form terisi otomatis oleh AI. '}</strong>
                    {autoNote}
                  </span>
                </p>
              )}

              {error && (
                <p role="alert" className="text-xs text-red-300 bg-red-500/10 border border-red-400/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              {justSaved && !error && (
                <p role="status" className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-400/20 rounded-lg px-3 py-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  {isEn ? 'Trade saved to your guest journal (browser).' : 'Trade tersimpan di jurnal tamu (browser kamu).'}
                </p>
              )}

              <p className="text-[11px] text-white/40" aria-live="polite">
                {isEn
                  ? `Guest slots: ${remaining} of 3 left — signup is free when it's full`
                  : `Sisa catatan tamu: ${remaining} dari 3 — pas penuh tinggal daftar gratis`}
              </p>

              <button
                type="submit"
                className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 text-white text-sm font-bold hover:opacity-90 transition-all cursor-pointer"
              >
                <PenLine className="w-4 h-4" />
                {isEn ? 'Save to Guest Journal' : 'Simpan ke Jurnal Tamu'}
              </button>

              <p className="text-[11px] text-white/40 flex items-center gap-1.5">
                <Lock className="w-3 h-3 shrink-0" />
                {isEn
                  ? 'Saved in your own browser (localStorage). No account needed yet.'
                  : 'Tersimpan di browser kamu sendiri (localStorage). Belum perlu akun.'}
              </p>
            </form>
            )}
            </>
            )}
          </div>

          {/* ---------- Saved list + honest signup CTA ---------- */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6 flex flex-col gap-4 max-h-[560px]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white/80">
                {isEn ? 'Your guest journal' : 'Jurnal tamu kamu'}{' '}
                <span className="text-white/40 font-medium">({trades.length})</span>
              </h3>
              {/* tombol "hapus semua" — Aksesibilitas: hit area min 44px (mobile), visual tetap kecil */}
              {trades.length > 0 && (
                <button
                  onClick={clearAll}
                  className="inline-flex items-center gap-1 min-h-[44px] px-3 -my-3 -mr-3 text-[11px] text-white/40 hover:text-red-300 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  {isEn ? 'Clear all' : 'Hapus semua'}
                </button>
              )}
            </div>

            {trades.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10 rounded-xl border border-dashed border-white/10">
                <PenLine className="w-8 h-8 text-white/20 mb-3" />
                <p className="text-sm text-white/40 max-w-[240px]">
                  {isEn
                    ? 'Still empty. Save your first trade from the form — it will appear here.'
                    : 'Masih kosong. Simpan trade pertamamu dari form — akan muncul di sini.'}
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2.5 overflow-y-auto pr-1 max-h-[340px]" aria-label={isEn ? 'Saved guest trades' : 'Trade tamu tersimpan'}>
                {trades.slice(0, 5).map((t) => (
                  <li
                    key={t.id}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-xs text-white/70 leading-relaxed"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-mono font-bold px-1.5 py-0.5 rounded ${t.direction === 'BUY' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                        {t.direction}
                      </span>
                      <span className="font-semibold text-white/90">{t.pair}</span>
                      <span className="text-white/30 font-mono">
                        {new Date(t.createdAt).toLocaleString(isEn ? 'en-US' : 'id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                    <span className="font-mono">
                      {isEn ? 'entry' : 'entry'} {t.entry} · SL {t.sl} · TP {t.tp}
                      {t.lot ? ` · ${t.lot} lot` : ''}
                    </span>
                    {t.note && <div className="text-white/50 mt-1">— {t.note}</div>}
                  </li>
                ))}
                {trades.length > 5 && (
                  <li className="text-[11px] text-white/30 text-center py-1">
                    +{trades.length - 5} {isEn ? 'more trades in your browser' : 'trade lain di browser kamu'}
                  </li>
                )}
              </ul>
            )}

            {trades.length > 0 && (
              <div className="mt-auto pt-2 border-t border-white/10">
                <p className={`text-[11px] mb-2.5 ${limitReached ? 'text-cyan-200 font-semibold' : 'text-white/50'}`}>
                  {limitReached
                    ? isEn
                      ? 'Guest limit reached (3 trades) — sign up free to save them permanently & journal without limits.'
                      : 'Batas jurnal tamu tercapai (3 trade) — daftar gratis untuk simpan permanen & catat tanpa batas.'
                    : isEn
                      ? 'Want this saved permanently with AI analysis? Sign up — takes a minute.'
                      : 'Ingin tersimpan permanen lengkap dengan analisis AI? Daftar — cuma sebentar.'}
                </p>
                <Link
                  href="/auth/signup"
                  prefetch={false}
                  className="flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 text-white text-sm font-bold hover:opacity-90 transition-all"
                >
                  {isEn ? 'Keep It Forever — Sign Up Free' : 'Simpan Permanen — Daftar Gratis'}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
