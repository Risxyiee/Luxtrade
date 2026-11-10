'use client'
// ============================================================
// ArtifactsQueue — "ANTREAN ACC — ARTEFAK KARYAWAN AI"
//
// Spec perbaikan kantor AI: tiap run karyawan harus menghasilkan
// BARANG JADI (kalender konten, artikel SEO, paket outbound,
// rancangan onboarding, titik impas, audit SEO teknis, eksperimen,
// community seeding) — bukan laporan teks yang itu-itu mulu.
// Artefak disimpan di agent_kv (art:index + art:body:<id>) oleh
// lib/ceo-phase.ts runDailyWork; panel inilah yang bikin semuanya
// TERLIHAT & BISA DISALIN Bos untuk dipakai manual.
//
// Sumber data: GET /api/ceo-agent?action=art-list (Bearer token Bos)
//              GET /api/ceo-agent?action=art-body&id=<id>
// Jalankan manual: GET /api/ceo-agent?action=work
// ============================================================
import { useCallback, useEffect, useState } from 'react'
import { Copy, FileText, Play, RefreshCw } from 'lucide-react'
import { getClientBrowserAsync } from '@/lib/supabase-browser'

interface ArtifactMeta {
  id: string
  role: string
  kind: string
  label: string
  title: string
  preview: string
  at: string
  who: string
}

const ROLE_META: Record<string, { label: string; cls: string }> = {
  cmo: { label: 'Sinta · CMO', cls: 'text-pink-200 border-pink-300/30 bg-pink-300/10' },
  coo: { label: 'Bagas · COO', cls: 'text-sky-200 border-sky-300/30 bg-sky-300/10' },
  cso: { label: 'Maya · CSO', cls: 'text-amber-200 border-amber-300/30 bg-amber-300/10' },
  cto: { label: 'Raka · CTO', cls: 'text-cyan-200 border-cyan-300/30 bg-cyan-300/10' },
  cfo: { label: 'Putri · CFO', cls: 'text-emerald-200 border-emerald-300/30 bg-emerald-300/10' },
  gh: { label: 'Farhan · Growth', cls: 'text-orange-200 border-orange-300/30 bg-orange-300/10' },
  kevin: { label: 'Kevin · Seeding', cls: 'text-lime-200 border-lime-300/30 bg-lime-300/10' },
}

function wibTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' WIB'
  } catch { return iso }
}

export default function ArtifactsQueue() {
  const [items, setItems] = useState<ArtifactMeta[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [loadingBody, setLoadingBody] = useState(false)
  const [working, setWorking] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; msg: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    try {
      const sb = await getClientBrowserAsync()
      if (sb) {
        const { data } = await sb.auth.getSession()
        const token = data?.session?.access_token || ''
        if (token) return { Authorization: `Bearer ${token}` }
      }
    } catch { /* tanpa sesi — endpoint tetap bisa lewat noSecrets mode */ }
    return {}
  }, [])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/ceo-agent?action=art-list', { headers: await authHeaders(), cache: 'no-store' })
      const js = await res.json()
      setItems(Array.isArray(js?.artifacts) ? js.artifacts : [])
      if (!res.ok) setNotice({ ok: false, msg: String(js?.error || `HTTP ${res.status}`) })
    } catch {
      setItems([])
      setNotice({ ok: false, msg: 'Gagal memuat artefak — cek koneksi lalu buka ulang panel.' })
    }
  }, [authHeaders])

  useEffect(() => { load() }, [load])

  const open = async (a: ArtifactMeta) => {
    if (openId === a.id) { setOpenId(null); setBody(''); return }
    setOpenId(a.id)
    setBody('')
    setCopied(false)
    setLoadingBody(true)
    try {
      const res = await fetch(`/api/ceo-agent?action=art-body&id=${encodeURIComponent(a.id)}`, { headers: await authHeaders(), cache: 'no-store' })
      const js = await res.json()
      if (res.ok) setBody(String(js?.body || ''))
      else setNotice({ ok: false, msg: String(js?.error || `HTTP ${res.status}`) })
    } catch {
      setNotice({ ok: false, msg: 'Gagal memuat isi artefak' })
    } finally {
      setLoadingBody(false)
    }
  }

  const runToday = async () => {
    setWorking(true)
    setNotice(null)
    try {
      const res = await fetch('/api/ceo-agent?action=work', { headers: await authHeaders(), cache: 'no-store' })
      const js = await res.json()
      const made: string[] = Array.isArray(js?.made) ? js.made : []
      const failed: string[] = Array.isArray(js?.failed) ? js.failed : []
      setNotice({
        ok: res.ok,
        msg: !res.ok
          ? String(js?.error || `HTTP ${res.status}`)
          : made.length
            ? `Kerja hari ini selesai — ${made.length} artefak baru ada di daftar bawah.${failed.length ? ` (${failed.length} gagal)` : ''}`
            : 'Tidak ada tugas terjadwal hari ini (cek jadwal mingguan per karyawan) — atau semuanya sudah dikerjakan tadi.',
      })
      await load()
    } catch {
      setNotice({ ok: false, msg: 'Gagal menjalankan kerja hari ini' })
    } finally {
      setWorking(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* clipboard ditolak browser */ }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 mt-1">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-white/70">Antrean ACC — Artefak Karyawan</div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={runToday}
            disabled={working}
            className="inline-flex items-center gap-1 text-[10.5px] px-2.5 py-1.5 rounded-xl border border-emerald-300/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play size={12} /> {working ? 'Kerja…' : 'Jalankan Kerja Hari Ini'}
          </button>
          <button
            onClick={load}
            className="inline-flex items-center gap-1 text-[10.5px] px-2 py-1.5 rounded-xl border border-white/15 bg-white/5 text-white/60 hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Muat ulang daftar artefak"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>
      <div className="text-[9.5px] text-white/40 mt-0.5 leading-relaxed">
        Barang jadi mingguan karyawan AI: kalender konten (Minggu) · onboarding + titik impas (Selasa) · outbound + eksperimen (Rabu) · artikel SEO (Kamis) · audit SEO teknis (Jumat) · community seeding (Sabtu). Salin & pakai manual.
      </div>

      {notice && (
        <div className={`mt-2 text-[10.5px] ${notice.ok ? 'text-emerald-300' : 'text-red-300'}`}>{notice.msg}</div>
      )}

      {items === null ? (
        <div className="text-[11px] text-white/40 mt-2">Memuat artefak…</div>
      ) : items.length === 0 ? (
        <div className="text-[11px] text-white/40 mt-2">
          Belum ada artefak. Klik &quot;Jalankan Kerja Hari Ini&quot; atau tunggu briefing pagi (fase-2 otomatis mengerjakan jadwal hari itu).
        </div>
      ) : (
        <div className="mt-2 space-y-1.5 max-h-72 overflow-y-auto kscroll pr-0.5">
          {items.map((a) => (
            <div key={a.id} className="rounded-xl border border-white/10 bg-white/[0.03]">
              <button
                onClick={() => open(a)}
                className="w-full text-left px-2.5 py-2 flex items-start gap-2 hover:bg-white/5 transition-colors cursor-pointer"
                aria-expanded={openId === a.id}
              >
                <FileText size={13} className="mt-0.5 shrink-0 text-white/35" />
                <span className="flex-1 min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border shrink-0 ${ROLE_META[a.role]?.cls || 'text-white/60 border-white/20 bg-white/5'}`}>
                      {ROLE_META[a.role]?.label || a.role}
                    </span>
                    <span className="text-[11px] text-white/80 font-medium leading-snug">{a.title}</span>
                  </span>
                  <span className="block text-[9.5px] text-white/35 mt-0.5">{a.label} · {wibTime(a.at)}</span>
                </span>
              </button>
              {openId === a.id && (
                <div className="border-t border-white/10 px-2.5 py-2">
                  {loadingBody ? (
                    <div className="text-[10.5px] text-white/40">Memuat isi artefak…</div>
                  ) : (
                    <>
                      <pre className="whitespace-pre-wrap break-words text-[10.5px] leading-relaxed text-white/75 max-h-64 overflow-y-auto kscroll font-sans">{body || '(isi kosong)'}</pre>
                      <button
                        onClick={copy}
                        className="mt-1.5 inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white/70 transition-colors cursor-pointer"
                      >
                        <Copy size={11} /> {copied ? 'Tersalin' : 'Salin untuk dipakai'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
