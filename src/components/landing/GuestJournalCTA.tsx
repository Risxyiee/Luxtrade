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
 * FITUR AUTO JURNAL (permintaan Bos 22 Nov: "upload foto nanti langsung
 * muncul hasil kaya yang di dashboard — jadi fitur"):
 *   - Tab "Auto Jurnal (AI)" punya 2 input: UPLOAD FOTO screenshot trade
 *     (utama) & tempel teks (jalur lama).
 *   - Setelah diparse → KARTU HASIL gaya dashboard muncul LANGSUNG di
 *     landing (pair, BUY/SELL, entry/SL/TP/lot, RR, profit) — persis
 *     pengalaman dashboard, tapi tanpa akun.
 *   - Dari kartu: "Simpan ke Jurnal Tamu" (langsung masuk daftar) atau
 *     "Isi form manual" (review kolom per kolom dulu).
 *   - Foto diproses di memori server, TIDAK disimpan (privasi tamu).
 *
 * SSR-safe: akses localStorage hanya di useEffect / handler.
 * ============================================================
 */

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { PenLine, CheckCircle2, Trash2, Lock, Sparkles, Loader2, Upload, ImageIcon, X, Activity } from 'lucide-react'

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
  /** Ekstra dari Auto Jurnal FOTO (dashboard-style) — opsional. */
  profit?: string
  exit?: string
  createdAt: string
}

type AutoResult = {
  fields: { pair: string; direction: 'BUY' | 'SELL'; entry: string; sl: string; tp: string; lot: string; note: string }
  extra: { exit: string; profit: string }
  missing: string[]
  note: string
  source: 'image' | 'text'
}

const STORAGE_KEY = 'luxtradee_guest_journal'

/** Pilihan pair form tamu — Auto Jurnal bisa MENAMBAH pair dinamis
 *  kalau AI mendeteksi pair lain dari teks/screenshot. */
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

/** RR sederhana: reward(risiko) dari entry/SL/TP — tampil di kartu
 *  hasil & daftar trade gaya dashboard. Null kalau angka tak lengkap. */
function rrOf(entry: string, sl: string, tp: string): string | null {
  const e = Number(entry), s = Number(sl), t = Number(tp)
  if (!isFinite(e) || !isFinite(s) || !isFinite(t) || !e || e === s) return null
  const risk = Math.abs(e - s)
  if (!risk) return null
  const reward = Math.abs(t - e)
  return `1:${(reward / risk).toFixed(1).replace('.', ',')}`
}

export default function GuestJournalCTA({ language = 'id' }: GuestJournalCTAProps) {
  const isEn = language === 'en'
  const [trades, setTrades] = useState<GuestTrade[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [justSaved, setJustSaved] = useState(false)

  /* ── AUTO JURNAL (permintaan Bos): upload FOTO atau tempel teks →
     AI membaca → KARTU HASIL gaya dashboard muncul langsung di landing.
     Tamu tetap yang memutuskan: simpan sekali klik, atau isi form manual
     untuk review kolom per kolom (angka tidak pernah diam-diam disimpan). */
  const [mode, setMode] = useState<'manual' | 'auto'>('manual')
  const [autoInput, setAutoInput] = useState<'foto' | 'teks'>('foto')
  const [rawText, setRawText] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [autoLoading, setAutoLoading] = useState(false)
  const [autoError, setAutoError] = useState('')
  const [autoNote, setAutoNote] = useState('')
  const [autoResult, setAutoResult] = useState<AutoResult | null>(null)
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
    /* Bersihkan object URL preview saat unmount (memory hygiene). */
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /* ── Pilih foto (screenshot trade) + preview thumbnail ── */
  const handlePhotoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhoto(f)
    setPhotoPreview(f ? URL.createObjectURL(f) : '')
    setAutoError('')
    setAutoResult(null)
  }

  const clearPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhoto(null)
    setPhotoPreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  /* ── AUTO JURNAL: kirim FOTO / TEKS ke /api/journal/auto-parse.
     Sukses → hasil TIDAK langsung disimpan & TIDAK mengganti form:
     muncul KARTU HASIL gaya dashboard, tamu pilih sendiri
     (simpan sekali klik / isi form manual). */
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
    if (autoInput === 'teks' && rawText.trim().length < 2) {
      setAutoError(isEn ? 'Paste your trade text first.' : 'Tempel teks trade-nya dulu ya.')
      return
    }
    if (autoInput === 'foto' && !photo) {
      setAutoError(isEn ? 'Pick a trade screenshot first.' : 'Pilih screenshot trade-nya dulu ya.')
      return
    }
    setAutoError('')
    setAutoNote('')
    setAutoResult(null)
    setAutoLoading(true)
    try {
      let res: Response
      if (autoInput === 'foto') {
        const fd = new FormData()
        fd.append('image', photo as File)
        res = await fetch('/api/journal/auto-parse', { method: 'POST', body: fd })
      } else {
        res = await fetch('/api/journal/auto-parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: rawText.trim() }),
        })
      }
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok || !data?.fields) {
        setAutoError(
          String(
            data?.error ||
              (isEn
                ? 'AI could not read that — try again or fill the form manually.'
                : 'AI belum bisa membacanya — coba lagi atau isi manual.')
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
      const p = String(f.pair || '')
      if (p && !BASE_PAIRS.includes(p)) {
        setPairOptions((prev) => (prev.includes(p) ? prev : [...prev, p]))
      }
      setAutoResult({
        fields: {
          pair: String(f.pair || 'XAUUSD'),
          direction: f.direction === 'SELL' ? 'SELL' : 'BUY',
          entry: String(f.entry || ''),
          sl: String(f.sl || ''),
          tp: String(f.tp || ''),
          lot: String(f.lot || ''),
          note: String(f.note || ''),
        },
        extra: {
          exit: String(data.extra?.exit || ''),
          profit: String(data.extra?.profit || ''),
        },
        missing: Array.isArray(data.missing) ? data.missing.map(String) : [],
        note: String(data.note || ''),
        source: data.source === 'text' ? 'text' : 'image',
      })
      setAutoNote('')
      setJustSaved(false)
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

  /* ── Dari kartu hasil → simpan langsung ke jurnal tamu (1 klik) ── */
  const saveFromResult = () => {
    if (!autoResult || trades.length >= MAX_GUEST_TRADES) return
    const trade: GuestTrade = {
      ...autoResult.fields,
      profit: autoResult.extra.profit,
      exit: autoResult.extra.exit,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    }
    persist([trade, ...trades])
    setJustSaved(true)
    setAutoResult(null)
    setRawText('')
    clearPhoto()
    setAutoNote(
      isEn
        ? 'Saved from AI result — check the numbers in your journal list.'
        : 'Tersimpan dari hasil AI — cek angkanya di daftar jurnal kamu.'
    )
  }

  /* ── Dari kartu hasil → isi form manual (review kolom per kolom) ── */
  const fillFormFromResult = () => {
    if (!autoResult) return
    setForm({ ...autoResult.fields })
    setAutoNote(
      (autoResult.source === 'image'
        ? (isEn ? 'Auto-filled from your screenshot by AI. ' : 'Form terisi otomatis dari screenshot oleh AI. ')
        : (isEn ? 'Auto-filled by AI. ' : 'Form terisi otomatis oleh AI. ')) + (autoResult.note || '')
    )
    setJustSaved(false)
    setMode('manual')
  }

  const fillSample = () => {
    setAutoError('')
    setAutoNote('')
    setAutoResult(null)
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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-[11px] font-bold tracking-wider text-blue-300">
            <PenLine className="w-3.5 h-3.5" />
            {isEn ? 'NO SIGN UP NEEDED' : 'TANPA DAFTAR'}
          </span>
          <h2 id="guest-journal-title" className="mt-4 text-3xl md:text-4xl font-extrabold leading-tight">
            {isEn ? 'Log Your First Trade — Right Now' : 'Catat Trade Pertamamu — Sekarang Juga'}
          </h2>
          <p className="mt-4 text-white/60 text-sm md:text-base leading-relaxed">
            {isEn
              ? 'Upload a trade screenshot and AI reads it instantly — the result appears right here, just like in the dashboard. No account needed.'
              : 'Upload screenshot trade — AI bacain langsung, hasilnya muncul di sini juga, kaya di dashboard. Tanpa akun.'}
          </p>
          <p className="mt-2 text-white/40 text-xs md:text-sm">
            {isEn
              ? 'Your trade is saved in your own browser instantly. Sign up is only offered afterwards, if you want to keep your journal permanently.'
              : 'Trade kamu langsung tersimpan di browser sendiri. Daftar hanya ditawarkan setelahnya, kalau kamu ingin jurnal tersimpan permanen.'}
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
                <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-blue-500/15 border border-blue-400/30">
                  <Lock className="w-5 h-5 text-blue-300" aria-hidden="true" />
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
                  className="mt-1 inline-flex items-center justify-center gap-2 min-h-[48px] w-full max-w-[320px] rounded-xl bg-gradient-to-r from-blue-500 to-blue-400 text-white text-sm font-bold hover:opacity-90 transition-all"
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
                    ? 'bg-blue-500/15 text-blue-200 border border-blue-400/40'
                    : 'bg-white/[0.04] text-gray-400 border border-white/10 hover:bg-white/[0.07]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                {isEn ? 'Auto Journal (AI)' : 'Auto Jurnal (AI)'}
              </button>
            </div>

            {mode === 'auto' ? (
              /* ── Panel AUTO JURNAL: upload FOTO / tempel teks → kartu hasil ── */
              <div className="flex flex-col gap-3">
                {/* Sub-pilihan input: FOTO (utama — permintaan Bos) / TEKS */}
                <div className="grid grid-cols-2 gap-2" role="group" aria-label={isEn ? 'Auto journal input' : 'Input auto jurnal'}>
                  <button
                    type="button"
                    onClick={() => { setAutoInput('foto'); setAutoError('') }}
                    aria-pressed={autoInput === 'foto'}
                    className={`min-h-[44px] rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      autoInput === 'foto'
                        ? 'bg-blue-500/15 text-blue-200 border border-blue-400/40'
                        : 'bg-white/[0.04] text-gray-400 border border-white/10 hover:bg-white/[0.07]'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                    {isEn ? 'Upload Screenshot' : 'Upload Foto'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAutoInput('teks'); setAutoError('') }}
                    aria-pressed={autoInput === 'teks'}
                    className={`min-h-[44px] rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      autoInput === 'teks'
                        ? 'bg-blue-500/15 text-blue-200 border border-blue-400/40'
                        : 'bg-white/[0.04] text-gray-400 border border-white/10 hover:bg-white/[0.07]'
                    }`}
                  >
                    {isEn ? 'Paste Text' : 'Tempel Teks'}
                  </button>
                </div>

                {autoInput === 'foto' ? (
                  /* ── Upload FOTO: drop-zone + preview ── */
                  <div className="flex flex-col gap-3">
                    <input
                      ref={fileInputRef}
                      id="gj-photo"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhotoPick}
                      className="sr-only"
                      aria-label={isEn ? 'Trade screenshot' : 'Screenshot trade'}
                    />
                    {!photo ? (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="min-h-[96px] w-full rounded-xl border border-dashed border-blue-400/30 bg-blue-500/[0.04] hover:bg-blue-500/[0.08] hover:border-blue-400/50 transition-colors flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-5 h-5 text-blue-300" aria-hidden="true" />
                        <span className="text-xs font-semibold text-blue-200">
                          {isEn ? 'Tap to pick your trade screenshot' : 'Ketuk buat pilih screenshot trade'}
                        </span>
                        <span className="text-[10px] text-white/40">
                          {isEn ? 'MT4 / MT5 / TradingView — JPG, PNG, WebP (max 10 MB)' : 'MT4 / MT5 / TradingView — JPG, PNG, WebP (maks 10 MB)'}
                        </span>
                      </button>
                    ) : (
                      <div className="relative rounded-xl border border-white/15 overflow-hidden bg-black/30">
                        {/* preview thumbnail — tinggi terbatas biar layout aman */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photoPreview}
                          alt={isEn ? 'Selected trade screenshot preview' : 'Pratinjau screenshot trade'}
                          className="max-h-40 w-full object-contain"
                        />
                        <div className="flex items-center justify-between px-3 py-2 bg-black/50">
                          <span className="text-[11px] text-white/60 truncate max-w-[75%]">{photo.name}</span>
                          <button
                            type="button"
                            onClick={clearPhoto}
                            aria-label={isEn ? 'Remove screenshot' : 'Hapus screenshot'}
                            className="inline-flex items-center gap-1 min-h-[44px] py-1 px-2 -my-1 text-[11px] text-white/50 hover:text-blue-300 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            {isEn ? 'Remove' : 'Hapus'}
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleAutoParse}
                      disabled={autoLoading || !photo}
                      className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-400 text-white text-sm font-bold hover:opacity-90 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {autoLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Sparkles className="w-4 h-4" aria-hidden="true" />
                      )}
                      {autoLoading
                        ? isEn
                          ? 'AI is reading your screenshot… usually 5–15s'
                          : 'AI membaca screenshot… biasanya 5–15 detik'
                        : isEn
                          ? 'Read Screenshot with AI'
                          : 'Baca Screenshot dengan AI'}
                    </button>
                  </div>
                ) : (
                  /* ── Tempel TEKS (jalur lama) ── */
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
                      className="self-start min-h-[44px] py-2 px-1 text-[11px] text-blue-300/80 hover:text-blue-200 underline underline-offset-2 cursor-pointer"
                    >
                      {isEn ? 'Try an example' : 'Coba contoh'}
                    </button>
                    <button
                      type="button"
                      onClick={handleAutoParse}
                      disabled={autoLoading}
                      className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-400 text-white text-sm font-bold hover:opacity-90 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
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
                  </div>
                )}

                {autoError && (
                  <p role="alert" className="text-xs text-blue-300 bg-blue-500/10 border border-blue-400/20 rounded-lg px-3 py-2">
                    {autoError}
                  </p>
                )}

                {/* ── KARTU HASIL AI gaya dashboard (muncul langsung setelah baca) ── */}
                {autoResult && (
                  <div
                    className="rounded-xl border border-blue-400/25 bg-gradient-to-b from-blue-500/[0.07] to-white/[0.02] p-4"
                    role="status"
                    aria-label={isEn ? 'AI result — dashboard style' : 'Hasil AI — gaya dashboard'}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-blue-300 uppercase">
                        <Activity className="w-3 h-3" aria-hidden="true" />
                        {isEn ? 'AI result — dashboard preview' : 'Hasil AI — seperti di dashboard'}
                      </span>
                      <span className="text-[10px] text-white/30 font-mono">
                        {autoResult.source === 'image' ? (isEn ? 'from screenshot' : 'dari screenshot') : (isEn ? 'from text' : 'dari teks')}
                      </span>
                    </div>

                    {/* Baris identitas: arah + pair + profit */}
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      {/* Biru menyala = BUY (naik) · biru redup outline = SELL (turun) —
                          tetap 100% keluarga biru (permintaan Bos: landing tanpa warna lain),
                          arah dibedakan lewat ikon panah + intensitas biru. */}
                      <span
                        className={`inline-flex items-center gap-1 font-mono font-bold text-[11px] px-1.5 py-0.5 rounded ${
                          autoResult.fields.direction === 'BUY'
                            ? 'bg-blue-500/30 text-blue-100 border border-blue-400/50'
                            : 'bg-blue-500/[0.08] text-blue-300 border border-blue-400/25'
                        }`}
                      >
                        <span aria-hidden="true">{autoResult.fields.direction === 'BUY' ? '▲' : '▼'}</span>
                        {autoResult.fields.direction}
                      </span>
                      <span className="text-base font-bold text-white font-mono">{autoResult.fields.pair}</span>
                      {autoResult.extra.profit && (
                        <span
                          className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded border ${
                            Number(autoResult.extra.profit) < 0
                              ? 'bg-blue-500/[0.08] text-blue-300/90 border-blue-400/20'
                              : 'bg-blue-500/30 text-blue-100 border-blue-400/50'
                          }`}
                        >
                          {Number(autoResult.extra.profit) < 0 ? '−' : '+'}${Math.abs(Number(autoResult.extra.profit)).toLocaleString('id-ID')}
                        </span>
                      )}
                    </div>

                    {/* Grid harga gaya dashboard */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                      {[
                        { label: isEn ? 'Entry' : 'Entry', value: autoResult.fields.entry, ok: true },
                        { label: isEn ? 'Stop Loss' : 'Stop Loss', value: autoResult.fields.sl, ok: !!autoResult.fields.sl },
                        { label: isEn ? 'Take Profit' : 'Take Profit', value: autoResult.fields.tp, ok: !!autoResult.fields.tp },
                        { label: isEn ? 'Lot' : 'Lot', value: autoResult.fields.lot, ok: !!autoResult.fields.lot },
                      ].map((c) => (
                        <div key={c.label} className="rounded-lg bg-white/[0.04] border border-white/10 px-2.5 py-2">
                          <div className="text-[9px] uppercase tracking-wider text-white/40 font-bold">{c.label}</div>
                          <div className={`font-mono text-sm font-bold ${c.ok ? 'text-white' : 'text-white/30'}`}>
                            {c.value || '—'}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Strip RR + exit (kalau ada) */}
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      {rrOf(autoResult.fields.entry, autoResult.fields.sl, autoResult.fields.tp) && (
                        <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300">
                          RR {rrOf(autoResult.fields.entry, autoResult.fields.sl, autoResult.fields.tp)}
                        </span>
                      )}
                      {autoResult.extra.exit && (
                        <span className="text-[10px] font-mono text-white/50 px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/10">
                          {isEn ? 'exit' : 'keluar'} {autoResult.extra.exit}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-white/50 leading-relaxed mb-3">{autoResult.note}</p>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={saveFromResult}
                        disabled={trades.length >= MAX_GUEST_TRADES}
                        className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-400 text-white text-xs font-bold hover:opacity-90 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        {isEn ? 'Save to Guest Journal' : 'Simpan ke Jurnal Tamu'}
                      </button>
                      <button
                        type="button"
                        onClick={fillFormFromResult}
                        className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs font-bold hover:bg-white/[0.1] transition-colors cursor-pointer"
                      >
                        <PenLine className="w-3.5 h-3.5" aria-hidden="true" />
                        {isEn ? 'Review in Form' : 'Review di Form'}
                      </button>
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-white/40 flex items-start gap-1.5">
                  <Lock className="w-3 h-3 shrink-0 mt-0.5" aria-hidden="true" />
                  {isEn
                    ? 'AI only uses numbers visible in your screenshot/text — nothing is invented. The photo is processed in memory and never stored.'
                    : 'AI hanya memakai angka yang kelihatan di screenshot/teks kamu — tidak ada yang dikarang. Foto diproses di memori dan tidak disimpan.'}
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
                      className={`min-h-[44px] rounded-xl text-sm font-bold transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                        form.direction === 'BUY'
                          ? 'bg-blue-500/25 text-blue-200 border border-blue-400/50'
                          : 'bg-white/[0.04] text-gray-400 border border-white/10 hover:bg-white/[0.07]'
                      }`}
                    >
                      <span aria-hidden="true">▲</span> BUY
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, direction: 'SELL' })}
                      aria-pressed={form.direction === 'SELL'}
                      className={`min-h-[44px] rounded-xl text-sm font-bold transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                        form.direction === 'SELL'
                          ? 'bg-blue-500/25 text-blue-200 border border-blue-400/50'
                          : 'bg-white/[0.04] text-gray-400 border border-white/10 hover:bg-white/[0.07]'
                      }`}
                    >
                      <span aria-hidden="true">▼</span> SELL
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
                <p role="status" className="text-xs text-blue-200 bg-blue-500/10 border border-blue-400/20 rounded-lg px-3 py-2 flex items-start gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    <strong className="font-semibold">{isEn ? 'Auto-filled by AI. ' : 'Form terisi otomatis oleh AI. '}</strong>
                    {autoNote}
                  </span>
                </p>
              )}

              {error && (
                <p role="alert" className="text-xs text-blue-300 bg-blue-500/10 border border-blue-400/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              {justSaved && !error && (
                <p role="status" className="text-xs text-blue-300 bg-blue-500/10 border border-blue-400/20 rounded-lg px-3 py-2 flex items-center gap-1.5">
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
                className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-400 text-white text-sm font-bold hover:opacity-90 transition-all cursor-pointer"
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
                  className="inline-flex items-center gap-1 min-h-[44px] px-3 -my-3 -mr-3 text-[11px] text-white/40 hover:text-blue-300 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  {isEn ? 'Clear all' : 'Hapus semua'}
                </button>
              )}
            </div>

            {trades.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10 rounded-xl border border-dashed border-white/10">
                <ImageIcon className="w-8 h-8 text-white/20 mb-3" aria-hidden="true" />
                <p className="text-sm text-white/40 max-w-[260px]">
                  {isEn
                    ? 'Still empty. Upload a screenshot or save a trade from the form — it will appear here like in the dashboard.'
                    : 'Masih kosong. Upload screenshot atau simpan trade dari form — nanti muncul di sini kaya di dashboard.'}
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2.5 overflow-y-auto pr-1 max-h-[340px]" aria-label={isEn ? 'Saved guest trades' : 'Trade tamu tersimpan'}>
                {trades.slice(0, 5).map((t) => (
                  <li
                    key={t.id}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-xs text-white/70 leading-relaxed"
                  >
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`inline-flex items-center gap-1 font-mono font-bold px-1.5 py-0.5 rounded ${t.direction === 'BUY' ? 'bg-blue-500/30 text-blue-100 border border-blue-400/50' : 'bg-blue-500/[0.08] text-blue-300 border border-blue-400/25'}`}>
                        <span aria-hidden="true">{t.direction === 'BUY' ? '▲' : '▼'}</span>
                        {t.direction}
                      </span>
                      <span className="font-semibold text-white/90 font-mono">{t.pair}</span>
                      {rrOf(t.entry, t.sl, t.tp) && (
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300">
                          RR {rrOf(t.entry, t.sl, t.tp)}
                        </span>
                      )}
                      {t.profit && (
                        <span
                          className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            Number(t.profit) < 0 ? 'bg-blue-500/[0.08] text-blue-300/90 border-blue-400/20' : 'bg-blue-500/30 text-blue-100 border-blue-400/50'
                          }`}
                        >
                          {Number(t.profit) < 0 ? '−' : '+'}${Math.abs(Number(t.profit)).toLocaleString('id-ID')}
                        </span>
                      )}
                      <span className="text-white/30 font-mono ml-auto">
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
                <p className={`text-[11px] mb-2.5 ${limitReached ? 'text-blue-200 font-semibold' : 'text-white/50'}`}>
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
                  className="flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-gradient-to-r from-blue-500 to-blue-400 text-white text-sm font-bold hover:opacity-90 transition-all"
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
