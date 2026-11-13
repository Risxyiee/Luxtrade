'use client'

/**
 * ============================================================
 * /pine-lab — LABORATORIUM LUX SCRIPT (feature-flag: pine_lab)
 * ============================================================
 * Spek revisi Bos: halaman DALAM Luxtradee, autentikasi & gaya
 * Luxtradee, hanya user ber-flag `pine_lab` (awalnya akun admin).
 *
 * Fitur:
 *   - Editor script (subset Pine Script — "Lux Script") + kuota.
 *   - Run test manual (dengan rate-limit 20/jam di server).
 *   - Script aktif = ikut siklus cron jam-an: candle H1 → event
 *     BARU → push ke subscription push milik user (fitur push
 *     yang sudah ada — aktifkan lewat dashboard).
 *   - Disclaimer + label sumber data + link /terms (spek item 8).
 * ============================================================
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  FlaskConical, Play, Save, Trash2, Loader2, ShieldAlert,
  Database, FileText, Plus, Power, CheckCircle2, XCircle, ArrowLeft,
} from 'lucide-react'
import SignalChart, { type ChartMarker } from '@/components/pine-lab/SignalChart'

interface ScriptRow {
  id: string
  name: string
  symbol: string
  active: boolean
  created_at: string
  updated_at: string
  last_run_at: string | null
  last_run_ms: number | null
  last_error: string | null
}

interface RunEvent {
  time: number
  bar: number
  title: string
  message: string
  price?: number
}

interface RunResp {
  ok: boolean
  error?: string | null
  errorCode?: string | null
  bars?: number
  durationMs?: number
  candleCount?: number
  /** Epoch detik candle pertama & terakhir rentang data run (info history). */
  dataFrom?: number | null
  dataTo?: number | null
  events?: RunEvent[]
  /** Candle PENUH [time, open, high, low, close][] untuk chart Strategy Tester. */
  candles?: number[][]
}

/* Format tanggal-jam WIB singkat utk histori sinyal. */
const fmtWib = (sec: number) =>
  new Date(sec * 1000).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
const fmtTanggal = (sec: number) =>
  new Date(sec * 1000).toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

const TEMPLATE = `//@version=5
indicator('Strategi Pertamaku', overlay=true)

// Panjang EMA bisa diubah
fastLen = input.int(9, 'EMA Cepat')
slowLen = input.int(30, 'EMA Lambat')

emaFast = ta.ema(close, fastLen)
emaSlow = ta.ema(close, slowLen)

longCond = ta.crossover(emaFast, emaSlow)
shortCond = ta.crossunder(emaFast, emaSlow)

plot(emaFast, title='EMA Cepat')
plot(emaSlow, title='EMA Lambat')

alertcondition(longCond, title='LONG', message='BUY: EMA cepat cross ke atas')
alertcondition(shortCond, title='SHORT', message='SELL: EMA cepat cross ke bawah')`

export default function PineLabPage() {
  const [phase, setPhase] = useState<'loading' | 'ok' | 'forbidden' | 'anon' | 'server'>('loading')
  const [email, setEmail] = useState('')
  const [quotas, setQuotas] = useState<{ maxActiveScripts: number; maxManualRunsPerHour: number; maxSourceKb: number } | null>(null)
  const [symbols, setSymbols] = useState<string[]>(['XAUUSD'])

  const [scripts, setScripts] = useState<ScriptRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState('Strategi Pertamaku')
  const [symbol, setSymbol] = useState('XAUUSD')
  const [active, setActive] = useState(false)
  const [source, setSource] = useState(TEMPLATE)
  const [listLoading, setListLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<RunResp | null>(null)
  const [msg, setMsg] = useState<{ kind: 'err' | 'ok'; text: string } | null>(null)
  const dirtyRef = useRef(false)

  // ── Gate check ──
  useEffect(() => {
    fetch('/api/pine-lab/access', { credentials: 'include' })
      .then(async (r) => {
        if (r.status === 401) return setPhase('anon')
        if (r.status === 403) return setPhase('forbidden')
        // 500/502 = server bermasalah (mis. environment lokal tanpa secret
        // service-role) — jangan tampilkan lab setengah rusak, tunjukkan
        // gerbang khusus dengan petunjuk buka versi production.
        if (!r.ok) return setPhase('server')
        const j = await r.json()
        if (j?.allowed !== true) return setPhase('server')
        setQuotas(j.quotas ?? null)
        setSymbols(j.symbols ?? ['XAUUSD'])
        setEmail(j.email ?? '')
        setPhase('ok')
      })
      .catch(() => setPhase('anon'))
  }, [])

  const loadScripts = useCallback(async () => {
    setListLoading(true)
    try {
      const r = await fetch('/api/pine-lab/scripts', { credentials: 'include' })
      if (r.ok) {
        const j = await r.json()
        setScripts(j.items ?? [])
      }
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    if (phase === 'ok') void loadScripts()
  }, [phase, loadScripts])

  const pick = (s: ScriptRow) => {
    setSelectedId(s.id)
    setName(s.name)
    setSymbol(s.symbol)
    setActive(s.active)
    setRunResult(null)
    setMsg(null)
    dirtyRef.current = false
    // Detail (termasuk source) milik user sendiri — endpoint GET [id]
    fetch(`/api/pine-lab/scripts/${s.id}`, { credentials: 'include' })
      .then(async (r) => (r.ok ? (await r.json()).script : null))
      .then((sc) => setSource(sc && typeof sc.source === 'string' ? sc.source : ''))
      .catch(() => setSource(''))
  }

  const newScript = () => {
    setSelectedId(null)
    setName('Script Baru')
    setSymbol(symbols[0] ?? 'XAUUSD')
    setActive(false)
    setSource(TEMPLATE)
    setRunResult(null)
    setMsg(null)
  }

  const save = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const method = selectedId ? 'PATCH' : 'POST'
      const url = selectedId ? `/api/pine-lab/scripts/${selectedId}` : '/api/pine-lab/scripts'
      const r = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, symbol, source, active }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setMsg({ kind: 'err', text: j.error ?? 'Gagal menyimpan.' })
        return
      }
      const saved = j.script as ScriptRow
      setSelectedId(saved.id)
      setMsg({ kind: 'ok', text: selectedId ? 'Perubahan disimpan.' : 'Script dibuat.' })
      dirtyRef.current = false
      await loadScripts()
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async () => {
    if (!selectedId) {
      setActive(!active)
      setMsg({ kind: 'ok', text: 'Tekan Simpan untuk menyimpan status aktif.' })
      return
    }
    setSaving(true)
    try {
      const r = await fetch(`/api/pine-lab/scripts/${selectedId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ active: !active, source }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) setMsg({ kind: 'err', text: j.error ?? 'Gagal mengubah status.' })
      else {
        setActive(!active)
        await loadScripts()
      }
    } finally {
      setSaving(false)
    }
  }

  const run = async () => {
    if (!selectedId) {
      setMsg({ kind: 'err', text: 'Simpan script dulu sebelum run test.' })
      return
    }
    setRunning(true)
    setRunResult(null)
    setMsg(null)
    try {
      // pastikan source terbaru tersimpan sebelum run
      await fetch(`/api/pine-lab/scripts/${selectedId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, symbol, source }),
      })
      const r = await fetch(`/api/pine-lab/scripts/${selectedId}/run`, { method: 'POST', credentials: 'include' })
      const j = (await r.json().catch(() => ({}))) as RunResp & { error?: string }
      if (!r.ok) {
        setMsg({ kind: 'err', text: j.error ?? 'Run gagal.' })
        return
      }
      setRunResult(j)
      await loadScripts()
    } finally {
      setRunning(false)
    }
  }

  const remove = async (id: string) => {
    setSaving(true)
    try {
      const r = await fetch(`/api/pine-lab/scripts/${id}`, { method: 'DELETE', credentials: 'include' })
      if (r.ok) {
        if (selectedId === id) newScript()
        await loadScripts()
      }
    } finally {
      setSaving(false)
    }
  }

  /* ─────────── GATE UI ─────────── */
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-[#050507] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-white/50 text-sm">Memuat Pine Lab…</p>
        </div>
      </div>
    )
  }

  if (phase === 'anon') {
    return (
      <GateShell icon={<ShieldAlert className="w-8 h-8 text-amber-400" />} title="Login dulu, ya">
        <p className="text-white/60 text-sm">Pine Lab hanya untuk user Luxtradee yang sudah masuk akun.</p>
        <div className="flex gap-3 justify-center mt-2">
          <Link href="/auth/login" className="rounded-xl bg-cyan-600 hover:bg-cyan-500 px-5 py-2.5 text-sm font-bold text-white transition-colors">Masuk</Link>
          <Link href="/" className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/5">Beranda</Link>
        </div>
      </GateShell>
    )
  }

  if (phase === 'forbidden') {
    return (
      <GateShell icon={<ShieldAlert className="w-8 h-8 text-amber-400" />} title="Akses terbatas">
        <p className="text-white/60 text-sm">
          Pine Lab sedang dalam tahap uji privat dan belum dibuka untuk akun ini. Hubungi admin jika kamu merasa ini keliru.
        </p>
        <Link href="/dashboard" className="mt-2 inline-flex rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/5">Ke Dashboard</Link>
      </GateShell>
    )
  }

  if (phase === 'server') {
    return (
      <GateShell icon={<ShieldAlert className="w-8 h-8 text-amber-400" />} title="Server Pine Lab belum siap di environment ini">
        <p className="text-white/60 text-sm">
          API Pine Lab membutuhkan secret server yang hanya terpasang di versi production. Buka lewat domain utama Luxtradee untuk memakai Pine Lab secara penuh (editor, run test, chart, histori sinyal).
        </p>
        <div className="flex gap-3 justify-center mt-2 flex-wrap">
          <a href="https://luxtradee.web.id/pine-lab" className="rounded-xl bg-cyan-600 hover:bg-cyan-500 px-5 py-2.5 text-sm font-bold text-white transition-colors">Buka Pine Lab Production</a>
          <Link href="/" className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/5">Beranda</Link>
        </div>
      </GateShell>
    )
  }

  /* ─────────── MAIN LAB UI ─────────── */
  const activeCount = scripts.filter((s) => s.active).length

  /* Marker chart dari histori sinyal ( LONG/SHORT dari pesan engine ). */
  const chartMarkers: ChartMarker[] = useMemo(() => {
    const evs = runResult?.events ?? []
    return evs.map((ev) => {
      const isLong = /^LONG\b/.test(ev.message) || /LONG\b/.test(ev.message.toUpperCase().slice(0, 12))
      const isShort = /^SHORT\b/.test(ev.message) || /SHORT\b/.test(ev.message.toUpperCase().slice(0, 14))
      return {
        bar: ev.bar,
        dir: isLong ? 'long' as const : isShort ? 'short' as const : 'info' as const,
        title: ev.title,
        price: ev.price,
        message: ev.message,
      }
    })
  }, [runResult])

  return (
    <div className="min-h-screen bg-[#050507] text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-white/5 sticky top-0 z-20 bg-[#050507]/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="rounded-lg border border-white/10 p-2 hover:bg-white/5" aria-label="Kembali ke dashboard">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <FlaskConical className="w-5 h-5 text-cyan-400" />
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sm sm:text-base leading-tight">Pine Lab — Lux Engine</h1>
            <p className="text-[11px] text-white/40 truncate">Mode privat · {email}</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[10px] text-white/50">
            <span className="rounded-full border border-white/10 px-2 py-1">Aktif {activeCount}/{quotas?.maxActiveScripts ?? 3}</span>
            <span className="rounded-full border border-white/10 px-2 py-1">Run {quotas?.maxManualRunsPerHour ?? 20}/jam</span>
            <span className="rounded-full border border-white/10 px-2 py-1">Source ≤ {quotas?.maxSourceKb ?? 50} KB</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-4 grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* ── Sidebar: daftar script ── */}
        <aside className="space-y-3">
          <button
            type="button"
            onClick={newScript}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-4 py-2.5 text-sm font-bold text-white transition-colors min-h-[44px]"
          >
            <Plus className="w-4 h-4" /> Script Baru
          </button>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-2 max-h-[420px] overflow-y-auto lux-scroll">
            {listLoading ? (
              <div className="flex items-center justify-center py-8 text-white/40"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : scripts.length === 0 ? (
              <p className="text-white/40 text-xs text-center py-8 px-3">Belum ada script. Buat yang pertama — mulai dari template.</p>
            ) : (
              <ul className="space-y-1">
                {scripts.map((s) => (
                  <li key={s.id}>
                    <div
                      className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors cursor-pointer border ${
                        selectedId === s.id
                          ? 'bg-cyan-500/15 border-cyan-400/40'
                          : 'bg-white/[0.02] border-transparent hover:bg-white/[0.06]'
                      }`}
                      onClick={() => pick(s)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') pick(s) }}
                    >
                      <div className="flex items-center gap-2">
                        {s.active
                          ? <Power className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          : <Power className="w-3.5 h-3.5 text-white/25 shrink-0" />}
                        <span className="text-[13px] font-semibold truncate flex-1">{s.name}</span>
                        <button
                          type="button"
                          aria-label={`Hapus ${s.name}`}
                          className="text-white/25 hover:text-red-400 p-1"
                          onClick={(e) => { e.stopPropagation(); void remove(s.id) }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-white/35">
                        <span className="rounded bg-white/5 px-1.5 py-px font-mono">{s.symbol}</span>
                        {s.last_run_ms !== null && <span>{s.last_run_ms} ms</span>}
                        {s.last_error && <span className="text-amber-400/80 truncate max-w-[120px]">{s.last_error}</span>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-[10px] text-white/30 leading-relaxed px-1">
            Script <span className="text-emerald-400 font-semibold">AKTIF</span> dijalankan otomatis tiap jam pada candle H1 oleh server. Sinyal baru dikirim sebagai push notification ke HP kamu.
          </p>
        </aside>

        {/* ── Editor + hasil ── */}
        <section className="space-y-4 min-w-0">
          {/* Meta */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 grid gap-2 sm:grid-cols-[1fr_130px_auto_auto]">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama script"
              aria-label="Nama script"
              maxLength={80}
              className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:border-cyan-400/50 min-h-[44px]"
            />
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              aria-label="Simbol data"
              className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:border-cyan-400/50 min-h-[44px]"
            >
              {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              type="button"
              onClick={toggleActive}
              className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-colors min-h-[44px] border ${
                active
                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/30'
                  : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
              }`}
              title="Script aktif dijalankan otomatis tiap jam (maks 3 aktif)"
            >
              <Power className="w-3.5 h-3.5" />
              {active ? 'AKTIF' : 'NONAKTIF'}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 px-4 py-2 text-xs font-bold text-white transition-colors min-h-[44px]"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Simpan
            </button>
          </div>

          {/* Editor */}
          <div className="rounded-2xl border border-white/10 bg-[#0a0a12] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 text-[10px] text-white/40">
              <span className="font-mono">lux_script · subset Pine Script v5</span>
              <span>{(new TextEncoder().encode(source).length / 1024).toFixed(1)} / {quotas?.maxSourceKb ?? 50} KB</span>
            </div>
            <textarea
              value={source}
              onChange={(e) => { setSource(e.target.value); dirtyRef.current = true }}
              spellCheck={false}
              aria-label="Source script"
              className="w-full h-[46vh] min-h-[320px] bg-transparent p-4 font-mono text-[13px] leading-relaxed text-cyan-100/90 outline-none resize-y lux-scroll"
            />
          </div>

          {/* Run + pesan */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              type="button"
              onClick={run}
              disabled={running || !selectedId}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 px-6 py-2.5 text-sm font-bold text-white transition-colors min-h-[44px]"
              title={selectedId ? 'Jalankan pada candle H1 terakhir' : 'Simpan dulu untuk run'}
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Run Test
            </button>
            {msg && (
              <span className={`text-xs font-semibold px-3 py-2 rounded-lg border ${msg.kind === 'err' ? 'bg-red-500/10 border-red-400/30 text-red-300' : 'bg-emerald-500/10 border-emerald-400/30 text-emerald-300'}`}>
                {msg.text}
              </span>
            )}
          </div>

          {/* Hasil run */}
          {runResult && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
                {runResult.ok
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  : <XCircle className="w-4 h-4 text-red-400" />}
                {runResult.ok ? 'Run selesai' : 'Run gagal'}
                <span className="text-[10px] font-normal text-white/40">
                  {runResult.bars ?? 0} bar H1 · {runResult.durationMs ?? 0} ms
                  {runResult.dataFrom && runResult.dataTo
                    ? ` · data ${fmtTanggal(runResult.dataFrom)} – ${fmtTanggal(runResult.dataTo)}`
                    : ''}
                </span>
              </div>
              {!runResult.ok && (
                <p className="text-xs text-red-300/90 font-mono bg-red-500/5 rounded-lg p-3">{runResult.error}</p>
              )}
              {runResult.ok && (runResult.candles?.length ?? 0) > 0 && (
                <SignalChart candles={runResult.candles!} markers={chartMarkers} />
              )}
              {runResult.ok && (runResult.events?.length ?? 0) === 0 && (
                <p className="text-xs text-white/40">Tidak ada sinyal pada rentang data ini — normal bila kondisi strategi belum terpenuhi.</p>
              )}
              {runResult.ok && (runResult.events?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-white/10 overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-1.5 px-3 py-2 bg-white/[0.03] border-b border-white/5">
                    <span className="text-[11px] font-bold text-white/70">Histori Sinyal ({runResult.events!.length})</span>
                    <span className="text-[10px] text-white/35">Waktu WIB · harga close candle sinyal · histori penuh, tidak terpotong</span>
                  </div>
                  <div className="max-h-96 overflow-y-auto overflow-x-auto lux-scroll">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-[#0a0a12]">
                        <tr className="text-[10px] uppercase tracking-wide text-white/35">
                          <th className="px-3 py-1.5 font-semibold whitespace-nowrap">Waktu (WIB)</th>
                          <th className="px-3 py-1.5 font-semibold">Sinyal</th>
                          <th className="px-3 py-1.5 font-semibold text-right whitespace-nowrap">Harga</th>
                          <th className="px-3 py-1.5 font-semibold">Pesan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {runResult.events!.map((ev, i) => (
                          <tr key={`${ev.bar}-${i}`} className="border-t border-white/5 align-top">
                            <td className="px-3 py-2 text-[11px] font-mono text-white/50 whitespace-nowrap">{fmtWib(ev.time)}</td>
                            <td className="px-3 py-2">
                              <span className="rounded bg-cyan-500/15 text-cyan-300 px-1.5 py-px font-bold text-[10px] whitespace-nowrap">{ev.title}</span>
                            </td>
                            <td className="px-3 py-2 text-[11px] font-mono text-emerald-300/80 text-right whitespace-nowrap">
                              {typeof ev.price === 'number' ? ev.price.toLocaleString('en-US', { maximumFractionDigits: 5 }) : '—'}
                            </td>
                            <td className="px-3 py-2 text-[11px] text-white/70 min-w-[140px]">{ev.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="px-3 py-2 text-[10px] text-white/30 border-t border-white/5">
                    Histori lengkap semua sinyal pada 1.500 bar H1 terakhir (± 3 bulan) — selalu menampilkan yang terbaru. Push notification hanya dikirim untuk sinyal BARU saat script AKTIF — bukan push ulang sinyal lama.
                  </p>
                  <p className="px-3 py-2 text-[10px] text-white/30 border-t border-white/5">
                    <strong className="text-white/50">Beda dengan Strategy Tester TradingView:</strong> TradingView menyimulasikan eksekusi order — order limit menggantung sampai harga menyentuhnya, lalu tercatat sebagai &ldquo;trade&rdquo; di tanggal TERISI (bisa berminggu setelah sinyal). Pine Lab bekerja mode SINYAL: entry/exit dipancarkan sebagai alert pada bar saat kondisi terpicu — tanggal di tabel ini = tanggal sinyal terpasang, bukan tanggal order terisi.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Disclaimer + sumber data (spek item 8) */}
          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.04] p-3.5 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed text-amber-100/70 space-y-1">
              <p><strong className="text-amber-300">Disclaimer:</strong> sinyal dari Pine Lab bukan nasihat keuangan — keputusan dan risiko trading sepenuhnya milik kamu. Sintaks Lux Script kompatibel sebagian dengan Pine Script v5 (fungsi &amp; fitur tertentu belum didukung).</p>
              <p className="flex items-center gap-1.5 text-white/40">
                <Database className="w-3 h-3" />
                Sumber data: candle H1 internal Luxtradee — TradingView (utama, spot-grade OANDA) → Twelve Data (cadangan), zona waktu Asia/Jakarta.
              </p>
              <p className="flex items-center gap-1.5 text-white/40">
                <FileText className="w-3 h-3" />
                Dengan memakai Pine Lab kamu menyetujui <Link href="/terms" className="text-cyan-400 underline underline-offset-2">Syarat Penggunaan</Link>.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-auto border-t border-white/5 py-3 text-center text-[10px] text-white/25">
        Luxtradee Pine Lab · mode privat
      </footer>
    </div>
  )
}

function GateShell({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#050507] text-white flex items-center justify-center px-4">
      <div className="max-w-sm text-center space-y-3">
        <div className="flex justify-center">{icon}</div>
        <h1 className="text-lg font-bold">{title}</h1>
        {children}
      </div>
    </div>
  )
}
