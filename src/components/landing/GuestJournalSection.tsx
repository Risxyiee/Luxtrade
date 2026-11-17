'use client'

/**
 * SECTION JURNAL TAMU — "Mulai Jurnal Gratis" (Bos, perbaikan konversi)
 * ────────────────────────────────────────────────────────────────────
 * Pengunjung BARU bisa mencatat trade TANPA daftar & TANPA login.
 * Entri tersimpan di localStorage (per browser), tampil di daftar
 * di bawah form. Baru SETELAH mencoba, tawarkan "Simpan ke akun"
 * → /auth/signup. Tidak ada gerbang signup sebelum user merasakan
 * produk (aturan Bos: label janji = perilaku).
 *
 * Kalkulasi lokal (rule-based, tanpa server):
 *   • Jarak SL/TP → Risk:Reward ratio
 *   • Estimasi P/L: XAUUSD 1 lot = 100 oz (±$100 per $1 move),
 *     forex standar 1 lot = 100.000 (±$10 per pip). Estimasi kasar —
 *     kenyataan tergantung broker/kontrak.
 */

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { NotebookPen, Trash2, ArrowRight, Info, ListOrdered } from 'lucide-react'

interface GuestJournalSectionProps {
  language?: 'id' | 'en'
}

interface GuestEntry {
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
const MAX_ENTRIES = 50

function loadEntries(): GuestEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.slice(0, MAX_ENTRIES)
  } catch {
    return []
  }
}

function saveEntries(entries: GuestEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)))
  } catch { /* localStorage bisa penuh/blokir — abaikan */ }
}

/** Kontrak size kasar: XAUUSD 100 oz/lot; forex standar 100.000 unit/lot. */
function estimatePl(pair: string, direction: 'BUY' | 'SELL', entry: number, target: number, lot: number): number | null {
  if (!entry || !target || !lot || Number.isNaN(entry) || Number.isNaN(target) || Number.isNaN(lot)) return null
  const move = target - entry
  const dir = direction === 'BUY' ? 1 : -1
  if (pair.toUpperCase().includes('XAU') || pair.toUpperCase().includes('GOLD')) {
    return move * 100 * lot * dir
  }
  // Forex: pip = 0.0001 (atau 0.01 utk pair JPY), nilai pip std ±$10 per lot
  const pipSize = Math.abs(entry) >= 20 ? 0.01 : 0.0001
  return (move / pipSize) * 10 * lot * dir
}

export default function GuestJournalSection({ language = 'id' }: GuestJournalSectionProps) {
  const [mounted, setMounted] = useState(false)
  const [entries, setEntries] = useState<GuestEntry[]>([])
  const [pair, setPair] = useState('XAUUSD')
  const [direction, setDirection] = useState<'BUY' | 'SELL'>('BUY')
  const [entry, setEntry] = useState('')
  const [sl, setSl] = useState('')
  const [tp, setTp] = useState('')
  const [lot, setLot] = useState('0.01')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    setEntries(loadEntries())
    setMounted(true)
  }, [])

  const numEntry = parseFloat(entry.replace(',', '.'))
  const numSl = parseFloat(sl.replace(',', '.'))
  const numTp = parseFloat(tp.replace(',', '.'))
  const numLot = parseFloat(lot.replace(',', '.'))

  const slDistance = !Number.isNaN(numEntry) && !Number.isNaN(numSl) ? Math.abs(numEntry - numSl) : null
  const tpDistance = !Number.isNaN(numEntry) && !Number.isNaN(numTp) ? Math.abs(numTp - numEntry) : null
  const rr = slDistance && tpDistance && slDistance > 0 ? tpDistance / slDistance : null
  const estProfit = estimatePl(pair, direction, numEntry, numTp, numLot)
  const estLoss = estimatePl(pair, direction, numEntry, numSl, numLot)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!pair.trim()) { setError(language === 'en' ? 'Pair is required.' : 'Pair wajib diisi.'); return }
    if (Number.isNaN(numEntry) || numEntry <= 0) { setError(language === 'en' ? 'Entry price must be a number.' : 'Harga entry harus angka.'); return }
    if (Number.isNaN(numSl) || numSl <= 0) { setError(language === 'en' ? 'Stop loss must be a number.' : 'Stop loss harus angka.'); return }
    if (Number.isNaN(numTp) || numTp <= 0) { setError(language === 'en' ? 'Take profit must be a number.' : 'Take profit harus angka.'); return }
    if (numSl === numEntry) { setError(language === 'en' ? 'Stop loss cannot equal entry.' : 'Stop loss tidak boleh sama dengan entry.'); return }

    const newEntry: GuestEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      pair: pair.trim().toUpperCase(),
      direction,
      entry,
      sl,
      tp,
      lot: lot || '0.01',
      note: note.trim(),
      createdAt: new Date().toISOString(),
    }
    const next = [newEntry, ...loadEntries()].slice(0, MAX_ENTRIES)
    saveEntries(next)
    setEntries(next)
    setEntry(''); setSl(''); setTp(''); setNote('')
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2500)
  }

  const handleDelete = (id: string) => {
    const next = entries.filter((en) => en.id !== id)
    saveEntries(next)
    setEntries(next)
  }

  const fmtUsd = (v: number | null) =>
    v === null ? '—' : `${v >= 0 ? '+' : '-'}$${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 2 })}`

  return (
    <section id="jurnal-gratis" className="relative py-20 md:py-24 z-10 scroll-mt-20" aria-labelledby="guest-journal-title">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[640px] h-[640px] rounded-full bg-emerald-500/[0.05] blur-3xl pointer-events-none" aria-hidden="true" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold tracking-wider text-emerald-300">
            <NotebookPen className="w-3.5 h-3.5" />
            {language === 'en' ? 'FREE — NO ACCOUNT NEEDED' : 'GRATIS — TANPA AKUN'}
          </span>
          <h2 id="guest-journal-title" className="mt-4 text-3xl md:text-4xl font-extrabold leading-tight text-white">
            {language === 'en' ? 'Start Your Journal Free — Right Now' : 'Mulai Jurnal Gratis — Sekarang'}
          </h2>
          <p className="mt-4 text-white/60 text-sm md:text-base leading-relaxed">
            {language === 'en'
              ? 'Fill in a trade below — no sign-up, no login. It is saved in your own browser, and you can move it into an account later.'
              : 'Isi satu trade di bawah — tanpa daftar, tanpa login. Tersimpan di browser kamu sendiri, dan bisa dipindah ke akun nanti.'}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-10 grid lg:grid-cols-5 gap-6 items-start"
        >
          {/* ── Form ── */}
          <form onSubmit={handleSubmit} className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="gj-pair" className="block text-[13px] font-medium text-white/70 mb-1.5">
                  {language === 'en' ? 'Pair' : 'Pair'} <span className="text-emerald-400">*</span>
                </label>
                <input
                  id="gj-pair"
                  value={pair}
                  onChange={(e) => setPair(e.target.value)}
                  placeholder="XAUUSD"
                  className="w-full h-11 rounded-xl bg-[#0b0b12] border border-white/10 px-3.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-emerald-400/50"
                />
              </div>
              <div>
                <span className="block text-[13px] font-medium text-white/70 mb-1.5">
                  {language === 'en' ? 'Direction' : 'Arah'} <span className="text-emerald-400">*</span>
                </span>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={language === 'en' ? 'Direction' : 'Arah'}>
                  {(['BUY', 'SELL'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      role="radio"
                      aria-checked={direction === d}
                      onClick={() => setDirection(d)}
                      className={`h-11 rounded-xl text-sm font-bold border transition-colors cursor-pointer ${
                        direction === d
                          ? d === 'BUY'
                            ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                            : 'bg-red-500/20 border-red-400/50 text-red-300'
                          : 'bg-[#0b0b12] border-white/10 text-white/50 hover:text-white/80'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="gj-entry" className="block text-[13px] font-medium text-white/70 mb-1.5">
                  {language === 'en' ? 'Entry price' : 'Harga entry'} <span className="text-emerald-400">*</span>
                </label>
                <input
                  id="gj-entry"
                  inputMode="decimal"
                  value={entry}
                  onChange={(e) => setEntry(e.target.value)}
                  placeholder="2034.50"
                  className="w-full h-11 rounded-xl bg-[#0b0b12] border border-white/10 px-3.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-emerald-400/50"
                />
              </div>
              <div>
                <label htmlFor="gj-lot" className="block text-[13px] font-medium text-white/70 mb-1.5">
                  {language === 'en' ? 'Lot size' : 'Ukuran lot'}
                </label>
                <input
                  id="gj-lot"
                  inputMode="decimal"
                  value={lot}
                  onChange={(e) => setLot(e.target.value)}
                  placeholder="0.01"
                  className="w-full h-11 rounded-xl bg-[#0b0b12] border border-white/10 px-3.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-emerald-400/50"
                />
              </div>
              <div>
                <label htmlFor="gj-sl" className="block text-[13px] font-medium text-white/70 mb-1.5">
                  {language === 'en' ? 'Stop loss' : 'Stop loss'} <span className="text-emerald-400">*</span>
                </label>
                <input
                  id="gj-sl"
                  inputMode="decimal"
                  value={sl}
                  onChange={(e) => setSl(e.target.value)}
                  placeholder="2040.00"
                  className="w-full h-11 rounded-xl bg-[#0b0b12] border border-white/10 px-3.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-emerald-400/50"
                />
              </div>
              <div>
                <label htmlFor="gj-tp" className="block text-[13px] font-medium text-white/70 mb-1.5">
                  {language === 'en' ? 'Take profit' : 'Take profit'} <span className="text-emerald-400">*</span>
                </label>
                <input
                  id="gj-tp"
                  inputMode="decimal"
                  value={tp}
                  onChange={(e) => setTp(e.target.value)}
                  placeholder="2020.00"
                  className="w-full h-11 rounded-xl bg-[#0b0b12] border border-white/10 px-3.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-emerald-400/50"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="gj-note" className="block text-[13px] font-medium text-white/70 mb-1.5">
                  {language === 'en' ? 'Short note' : 'Catatan singkat'}
                </label>
                <textarea
                  id="gj-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder={language === 'en' ? 'Why did you enter this trade?' : 'Kenapa entry trade ini?'}
                  className="w-full rounded-xl bg-[#0b0b12] border border-white/10 px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-emerald-400/50 resize-none"
                />
              </div>
            </div>

            {/* Hasil hitungan langsung (jujur: estimasi kasar) */}
            {(slDistance !== null || tpDistance !== null || rr !== null) && (
              <div className="mt-4 grid grid-cols-3 gap-3 text-center" aria-live="polite">
                <div className="rounded-xl bg-[#0b0b12] border border-white/10 px-2 py-2.5">
                  <p className="text-[10px] text-white/40 font-mono uppercase">{language === 'en' ? 'SL distance' : 'Jarak SL'}</p>
                  <p className="text-sm font-bold text-white">{slDistance !== null ? slDistance.toFixed(slDistance < 5 ? 2 : 1) : '—'}</p>
                </div>
                <div className="rounded-xl bg-[#0b0b12] border border-white/10 px-2 py-2.5">
                  <p className="text-[10px] text-white/40 font-mono uppercase">R:R</p>
                  <p className={`text-sm font-bold ${rr !== null ? (rr >= 1.5 ? 'text-emerald-400' : 'text-amber-400') : 'text-white'}`}>
                    {rr !== null ? `1 : ${rr.toFixed(2)}` : '—'}
                  </p>
                </div>
                <div className="rounded-xl bg-[#0b0b12] border border-white/10 px-2 py-2.5">
                  <p className="text-[10px] text-white/40 font-mono uppercase">{language === 'en' ? 'Est. P/L' : 'Estimasi P/L'}</p>
                  <p className="text-sm font-bold">
                    <span className={estLoss !== null && estLoss < 0 ? 'text-red-400' : 'text-white/60'}>{fmtUsd(estLoss)}</span>
                    <span className="text-white/30"> / </span>
                    <span className={estProfit !== null && estProfit > 0 ? 'text-emerald-400' : 'text-white/60'}>{fmtUsd(estProfit)}</span>
                  </p>
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="mt-3 text-[13px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="submit"
                className="flex-1 h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-[#05100c] font-bold text-sm hover:opacity-90 transition-opacity min-h-[48px] cursor-pointer"
              >
                {language === 'en' ? 'Save Entry (in this browser)' : 'Simpan Entri (di browser ini)'}
              </button>
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-white/5 border border-white/10 px-5 text-sm font-medium text-white/80 hover:bg-white/10 transition-colors min-h-[48px]"
              >
                {language === 'en' ? 'Save to account' : 'Simpan ke akun'} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-[11px] text-white/40 leading-relaxed">
              <Info className="w-3 h-3 mt-0.5 shrink-0" />
              {language === 'en'
                ? 'Entries are stored only in this browser (localStorage). "Save to account" takes you to sign-up, where a real account keeps entries across devices. P/L numbers are rough estimates (standard contracts).'
                : 'Entri disimpan hanya di browser ini (localStorage). "Simpan ke akun" membawa kamu ke pendaftaran, di mana akun asli menyimpan entri lintas perangkat. Angka P/L estimasi kasar (kontrak standar).'}
            </p>
          </form>

          {/* ── Daftar entri ── */}
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-emerald-400" />
                {language === 'en' ? 'Your guest journal' : 'Jurnal tamu kamu'}
              </h3>
              <span className="text-[11px] text-white/40 font-mono">{entries.length}/{MAX_ENTRIES}</span>
            </div>
            {!mounted ? (
              <div className="py-8 text-center text-xs text-white/30 font-mono">…</div>
            ) : entries.length === 0 ? (
              <div className="py-10 text-center">
                <NotebookPen className="w-10 h-10 mx-auto mb-3 text-white/15" />
                <p className="text-[13px] text-white/40 leading-relaxed">
                  {language === 'en' ? 'No entries yet. Log your first trade on the left — it will appear here.' : 'Belum ada entri. Catat trade pertamamu di kiri — nanti muncul di sini.'}
                </p>
              </div>
            ) : (
              <ul className="space-y-2.5 max-h-[430px] overflow-y-auto pr-1.5" aria-live="polite">
                {entries.map((en) => (
                  <li key={en.id} className="rounded-xl bg-[#0b0b12] border border-white/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${en.direction === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                          {en.direction}
                        </span>
                        <span className="text-[13px] font-bold text-white truncate">{en.pair}</span>
                        <span className="text-[11px] text-white/40 font-mono">{en.lot || '0.01'} lot</span>
                      </span>
                      <button
                        onClick={() => handleDelete(en.id)}
                        aria-label={language === 'en' ? `Delete entry ${en.pair}` : `Hapus entri ${en.pair}`}
                        className="text-white/30 hover:text-red-400 transition-colors p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-[11px] font-mono">
                      <span className="text-white/60">E {en.entry}</span>
                      <span className="text-red-400/80">SL {en.sl}</span>
                      <span className="text-emerald-400/80">TP {en.tp}</span>
                    </div>
                    {en.note && <p className="mt-1.5 text-[11px] text-white/40 leading-snug line-clamp-2">{en.note}</p>}
                    <p className="mt-1 text-[10px] text-white/25 font-mono">
                      {new Date(en.createdAt).toLocaleString(language === 'en' ? 'en-US' : 'id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {mounted && entries.length > 0 && (
              <Link
                href="/auth/signup"
                className="mt-4 inline-flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 text-white text-[13px] font-bold hover:opacity-90 transition-opacity min-h-[44px]"
              >
                {language === 'en' ? 'Save these entries to an account' : 'Simpan entri ini ke akun'} <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
