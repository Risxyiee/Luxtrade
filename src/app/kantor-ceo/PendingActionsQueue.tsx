'use client'
// ============================================================
// PendingActionsQueue — "ANTREAN EKSEKUSI (Pending Actions)"
// Task 34 — Human-in-the-Loop: agen mengusulkan, CEO memutuskan.
//
// Fetch GET /api/agent-proposals (khusus Bos via Bearer token),
// render tiap proposal jadi card elegan + dua tombol besar:
//   [✅ ACC & Eksekusi] → POST /api/execute-action {decision:'approve'}
//   [❌ Tolak]          → POST /api/execute-action {decision:'reject'}
// Eksekusi native dilakukan server (Resend/Meta/blog/Discord/flag).
//
// Task 34-c (FASE 3) — transparansi error total:
//   - GAGAL MEMUAT antrean → error TAMPIL (tidak pernah pura-pura
//     "tidak ada proposal" — itu bohong yang berbahaya).
//   - Tombol [🧹 Sweep 7 Agen]: jalankan semua detektor SEKARANG
//     + tampilkan status per-agen (kerja/trigger/error) secara jujur.
// ============================================================
import { useCallback, useEffect, useState } from 'react'
import { Check, RefreshCw, X, Zap } from 'lucide-react'
import { getClientBrowserAsync } from '@/lib/supabase-browser'

interface PendingAction {
  id: string
  agent_name: string
  action_type: string
  action_payload: Record<string, any>
  status: string
  created_at: string
}

/* Identitas agen — warna badge per karyawan */
const AGENT_META: Record<string, { emoji: string; color: string }> = {
  Sinta: { emoji: '📸', color: 'text-pink-300 border-pink-300/30 bg-pink-300/10' },
  Maya: { emoji: '💛', color: 'text-amber-200 border-amber-200/30 bg-amber-200/10' },
  Farhan: { emoji: '🚀', color: 'text-orange-200 border-orange-200/30 bg-orange-200/10' },
  Bagas: { emoji: '📞', color: 'text-sky-200 border-sky-200/30 bg-sky-200/10' },
  Raka: { emoji: '🛠️', color: 'text-cyan-200 border-cyan-200/30 bg-cyan-200/10' },
  Dewi: { emoji: '📊', color: 'text-violet-200 border-violet-200/30 bg-violet-200/10' },
  Putri: { emoji: '💰', color: 'text-emerald-200 border-emerald-200/30 bg-emerald-200/10' },
}

/* Label manusiawi per jenis aksi */
const TYPE_LABEL: Record<string, string> = {
  PUBLISH_CONTENT: 'Publikasikan Konten',
  SEND_WINBACK_EMAIL: 'Kirim Email Winback',
  UPDATE_AB_TEST: 'Update A/B Test Landing',
  SEND_UPGRADE_OFFER: 'Kirim Offer Upgrade PRO',
  BROADCAST_MAINTENANCE: 'Broadcast Maintenance',
  TRIGGER_INTERNAL_TASK: 'Task Internal untuk Karyawan',
  TOGGLE_FREE_FEATURES: 'Matikan Fitur Gratis (Kuota)',
}

/* Deskripsi singkat dari payload RIIL — tiap jenis aksi beda tampilan */
function describe(a: PendingAction): { lines: string[] } {
  const p = a.action_payload || {}
  const lines: string[] = []
  switch (a.action_type) {
    case 'PUBLISH_CONTENT': {
      lines.push(`Platform: ${String(p.platform || 'ig').toUpperCase()} · Judul: "${String(p.title || '-').slice(0, 80)}"`)
      if (p.content_body) lines.push(String(p.content_body).slice(0, 160) + (String(p.content_body).length > 160 ? '…' : ''))
      break
    }
    case 'SEND_WINBACK_EMAIL': {
      const n = Array.isArray(p.target_emails) ? p.target_emails.length : 0
      lines.push(`${n} user aktif yang tidak login ≥3 hari akan menerima email.`)
      if (p.subject) lines.push(`Subjek: "${String(p.subject).slice(0, 90)}"`)
      if (p.discount_code) lines.push(`Kode diskon: ${String(p.discount_code)}`)
      break
    }
    case 'SEND_UPGRADE_OFFER': {
      const n = Array.isArray(p.target_emails) ? p.target_emails.length : 0
      lines.push(`${n} free user TERAKTIF minggu ini akan menerima penawaran PRO personal.`)
      if (p.personalized_message) lines.push(String(p.personalized_message).slice(0, 140) + '…')
      break
    }
    case 'UPDATE_AB_TEST': {
      lines.push(`Komponen: ${String(p.component || '-')} · Split: ${String(p.traffic_split || '50/50')}`)
      if (p.new_text_variant) lines.push(`Varian baru: "${String(p.new_text_variant).slice(0, 110)}"`)
      if (p.analysis) lines.push(`Konteks: signup 7 hari ${p.analysis.signups_7d} vs minggu lalu ${p.analysis.signups_prev_7d} (−${p.analysis.drop_pct}%)`)
      break
    }
    case 'BROADCAST_MAINTENANCE': {
      lines.push(`${p.urgent ? '🚨 URGENT — ' : ''}Email maintenance akan dikirim ke SEMUA user.`)
      if (p.email_body) lines.push(String(p.email_body).slice(0, 150) + '…')
      break
    }
    case 'TRIGGER_INTERNAL_TASK': {
      lines.push(`Assign ke: ${String(p.assign_to || '-')}`)
      if (p.task_instruction) lines.push(String(p.task_instruction).slice(0, 170))
      break
    }
    case 'TOGGLE_FREE_FEATURES': {
      lines.push(`Fitur "${String(p.feature || '-')}" akan ${p.action === 'disable' ? 'DIMATIKAN' : 'diaktifkan'} untuk free user.`)
      lines.push(`Alasan: ${String(p.reason || '-')}${p.evidence ? ` · Bukti: Gemini 429 hari ini ${p.evidence.gemini_429_today}, email terkirim ${p.evidence.resend_sent_today}` : ''}`)
      break
    }
    default:
      lines.push(JSON.stringify(p).slice(0, 180))
  }
  return { lines }
}

function wibTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' WIB'
  } catch { return iso }
}

interface SweepStep { agent: string; actionType: string; triggered: boolean; inserted?: boolean; note?: string }

export default function PendingActionsQueue() {
  const [items, setItems] = useState<PendingAction[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; msg: string } | null>(null)
  const [tableReady, setTableReady] = useState(true)
  const [sweeping, setSweeping] = useState(false)
  const [sweepSteps, setSweepSteps] = useState<SweepStep[] | null>(null)
  const [authDenied, setAuthDenied] = useState(false)

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    try {
      const sb = await getClientBrowserAsync()
      const { data } = await sb.auth.getSession()
      const token = data?.session?.access_token
      return token ? { Authorization: `Bearer ${token}` } : {}
    } catch { return {} }
  }, [])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const headers = await authHeaders()
      const res = await fetch('/api/agent-proposals', { headers, cache: 'no-store' })
      const data = await res.json()
      if (res.ok && data?.ok) {
        setItems(Array.isArray(data.actions) ? data.actions : [])
        setTableReady(data.tableReady !== false)
        setAuthDenied(false)
        if (!silent) setNotice(null)
      } else if (res.status === 401) {
        setAuthDenied(true)
        setItems([])
        setNotice({ ok: false, msg: '🔐 Antrean khusus CEO — login sebagai Bos (alexander@luxtradee) untuk melihat & menyetujui.' })
      } else if (data?.tableReady === false) {
        // tabel belum ada — jujur, arahkan ke migration
        setTableReady(false)
        setItems([])
        setAuthDenied(false)
      } else {
        // GAGAL MEMUAT → WAJIB tampil, tidak boleh pura-pura kosong (SOP Bos)
        setNotice({ ok: false, msg: `⚠️ Gagal memuat antrean: ${data?.error || `HTTP ${res.status}`} — coba muat ulang.` })
      }
    } catch (x: any) {
      if (!silent) setNotice({ ok: false, msg: `⚠️ Gagal memuat antrean (jaringan): ${String(x?.message || x)}` })
    } finally { setLoading(false) }
  }, [authHeaders])

  /** Jalankan semua detektor agen SEKARANG — status per-agen tampil jujur. */
  const sweep = async () => {
    setSweeping(true)
    setNotice(null)
    try {
      const headers = await authHeaders()
      const res = await fetch('/api/agent-proposals?run=sweep', { method: 'POST', headers })
      const data = await res.json()
      if (res.ok && data?.ok) {
        setSweepSteps(Array.isArray(data.steps) ? data.steps : [])
        if ((data.created || 0) > 0) load(true) // ada proposal baru → refresh list
      } else if (res.status === 401) {
        setNotice({ ok: false, msg: '🔐 Sweep khusus CEO — login sebagai Bos.' })
      } else {
        setNotice({ ok: false, msg: `⚠️ Sweep gagal: ${data?.error || `HTTP ${res.status}`}` })
      }
    } catch (x: any) {
      setNotice({ ok: false, msg: `⚠️ Sweep gagal (jaringan): ${String(x?.message || x)}` })
    } finally { setSweeping(false) }
  }

  /** Format 1 langkah sweep jadi baris status manusiawi. */
  function stepLine(s: SweepStep): { icon: string; text: string; bad?: boolean } {
    if (s.note?.startsWith('error')) return { icon: '❌', text: `${s.agent}: ${String(s.note).slice(0, 110)}`, bad: true }
    if (s.inserted) return { icon: '🆕', text: `${s.agent}: proposal BARU masuk antrean (${TYPE_LABEL[s.actionType] || s.actionType})` }
    if (s.triggered) return { icon: '♻️', text: `${s.agent}: sudah ada di antrean (dedup — tidak dobel)` }
    return { icon: '✅', text: `${s.agent}: ${s.note || 'tidak ada trigger'}${s.note?.includes('TABLE_MISSING') ? ' — jalankan migration 015b!' : ''}` }
  }

  useEffect(() => {
    load()
    const t = setInterval(() => load(true), 60_000) // auto-refresh tiap 1 menit
    return () => clearInterval(t)
  }, [load])

  const decide = async (a: PendingAction, decision: 'approve' | 'reject') => {
    setActing(a.id + decision)
    setNotice(null)
    try {
      const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' }
      const res = await fetch('/api/execute-action', { method: 'POST', headers, body: JSON.stringify({ id: a.id, decision }) })
      const data = await res.json()
      if (res.ok && data?.ok) {
        setNotice({ ok: true, msg: decision === 'approve' ? `✅ Dieksekusi: ${data.detail || 'sukses'}` : '❌ Proposal ditolak — agen tidak mengusulkan hal sama dalam 24 jam.' })
      } else {
        setNotice({ ok: false, msg: `Gagal: ${data?.error || `HTTP ${res.status}`}` })
      }
    } catch (x: any) {
      setNotice({ ok: false, msg: `Gagal: ${String(x?.message || x)}` })
    } finally {
      setActing(null)
      load(true)
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 flex flex-col gap-3">
      {/* header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Zap size={14} className="text-amber-300 shrink-0" />
          <b className="text-amber-200 text-[12.5px] truncate">Antrean Eksekusi (Pending Actions)</b>
          {items.length > 0 && (
            <span className="shrink-0 rounded-full bg-amber-300/20 border border-amber-300/30 px-1.5 py-0.5 text-[9.5px] text-amber-100">{items.length} menunggu</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={sweep}
            disabled={sweeping || loading}
            className="shrink-0 rounded-lg border border-amber-300/25 bg-amber-300/10 hover:bg-amber-300/20 disabled:opacity-50 px-2 py-1.5 text-amber-200 text-[10px] font-medium inline-flex items-center gap-1 transition-colors"
            aria-label="Jalankan sweep semua agen sekarang"
            title="Jalankan semua detektor agen SEKARANG (biasanya otomatis tiap 15 menit)"
          >
            🧹 {sweeping ? 'Menyapu…' : 'Sweep 7 Agen'}
          </button>
          <button
            onClick={() => load()}
            className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Muat ulang antrean"
            title="Muat ulang"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {notice && (
        <div className={`rounded-xl px-2.5 py-2 text-[10.5px] leading-relaxed border ${notice.ok ? 'bg-emerald-400/10 border-emerald-300/20 text-emerald-100' : 'bg-rose-400/10 border-rose-300/20 text-rose-100'}`}>
          {notice.msg}
        </div>
      )}

      {/* hasil sweep per-agen — status kerja & ERROR tampil jujur */}
      {sweepSteps && (
        <div className="rounded-xl bg-white/[0.03] border border-white/10 px-2.5 py-2 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <b className="text-[10px] text-white/70">🧹 Hasil sweep 7 agen (baru saja):</b>
            <button onClick={() => setSweepSteps(null)} className="text-white/35 hover:text-white/80 text-[10px]" aria-label="Tutup hasil sweep">✕</button>
          </div>
          {sweepSteps.map((s, i) => {
            const l = stepLine(s)
            return (
              <div key={i} className={`text-[9.5px] leading-relaxed ${l.bad ? 'text-rose-200' : 'text-white/55'}`}>
                {l.icon} {l.text}
              </div>
            )
          })}
        </div>
      )}

      {/* konten */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1].map(i => <div key={i} className="h-20 rounded-xl bg-white/[0.04] animate-pulse" />)}
        </div>
      ) : !tableReady ? (
        <div className="rounded-xl bg-white/[0.03] border border-white/10 px-2.5 py-3 text-[10.5px] text-white/55 leading-relaxed">
          Tabel <code className="text-white/80">ai_pending_actions</code> belum ada di Supabase. Jalankan{' '}
          <code className="text-white/80">supabase-migrations/015_create_ai_pending_actions.sql</code> di SQL Editor, lalu muat ulang.
        </div>
      ) : authDenied ? (
        <div className="rounded-xl bg-amber-400/10 border border-amber-300/20 px-2.5 py-3 text-[10.5px] leading-relaxed text-amber-100/90">
          🔐 <b>Belum login sebagai CEO.</b> Antrean tidak bisa dimuat (bukan berarti kosong) — login dengan akun Bos (alexander@luxtradee) untuk melihat proposal & menyetujui eksekusi karyawan AI.
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl bg-white/[0.03] border border-white/10 px-2.5 py-3 text-[10.5px] text-white/45 leading-relaxed">
          ✅ Tidak ada proposal menunggu — semua karyawan AI tenang. Mereka akan melapor di sini otomatis saat menemukan momen/trigger (dicek tiap 15 menit).
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto kscroll pr-0.5">
          {items.map(a => {
            const meta = AGENT_META[a.agent_name] || { emoji: '🤖', color: 'text-white border-white/20 bg-white/10' }
            const { lines } = describe(a)
            const busy = acting === a.id + 'approve' || acting === a.id + 'reject'
            return (
              <div key={a.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-medium ${meta.color}`}>
                    {meta.emoji} {a.agent_name}
                  </span>
                  <span className="text-[10.5px] text-white/85 font-medium">{TYPE_LABEL[a.action_type] || a.action_type}</span>
                  {/* Task 35 — transparansi sumber draf: AI mikir sendiri vs templat */}
                  {(() => {
                    const aiSrc = String(a.action_payload?.ai_source || '')
                    const aiErr = String(a.action_payload?.ai_error || '')
                    if (aiSrc.startsWith('llm')) {
                      return (
                        <span className="rounded-full border border-violet-300/25 bg-violet-300/10 px-1.5 py-0.5 text-[9px] text-violet-200" title={`Draf ditulis oleh ${aiSrc.slice(4)}`}>
                          🤖 Draf AI
                        </span>
                      )
                    }
                    if (aiSrc === 'template') {
                      return (
                        <span className="rounded-full border border-rose-300/30 bg-rose-300/10 px-1.5 py-0.5 text-[9px] text-rose-200" title={aiErr || 'AI gagal menyusun draf'}>
                          ⚠️ Templat (AI gagal)
                        </span>
                      )
                    }
                    return null
                  })()}
                  <span className="ml-auto text-[9px] text-white/35">{wibTime(a.created_at)}</span>
                </div>
                <div className="flex flex-col gap-1">
                  {lines.map((l, i) => (
                    <div key={i} className="text-[10px] leading-relaxed text-white/60">{l}</div>
                  ))}
                  {String(a.action_payload?.ai_error || '') && (
                    <div className="text-[10px] leading-relaxed text-rose-200/90">💬 Alasan AI gagal: {String(a.action_payload.ai_error).slice(0, 150)}</div>
                  )}
                </div>
                <div className="flex gap-2 pt-0.5">
                  <button
                    disabled={busy}
                    onClick={() => decide(a, 'approve')}
                    className="flex-1 min-h-[38px] rounded-lg bg-emerald-400/90 hover:bg-emerald-300 disabled:opacity-50 text-emerald-950 text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Check size={13} /> {acting === a.id + 'approve' ? 'Mengeksekusi…' : '✅ ACC & Eksekusi'}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => decide(a, 'reject')}
                    className="flex-1 min-h-[38px] rounded-lg border border-rose-300/30 bg-rose-400/10 hover:bg-rose-400/20 disabled:opacity-50 text-rose-200 text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <X size={13} /> ❌ Tolak
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
