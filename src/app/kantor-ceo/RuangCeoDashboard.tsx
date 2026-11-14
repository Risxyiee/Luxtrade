'use client'
// ============================================================
// RuangCeoDashboard — "Apple Vision Pro / Spatial UI" overlay
// untuk kantor 3D CEO (LUXTRADE SUPER AI AGENT).
//
// Filosofi: kanvas 3D adalah panggung utama — UI hanya FLOATING GLASS:
//   Wujud 1 (standby)  : SATU floating pill di tengah bawah (jam WIB ikut di dalam pill)
//                        — bagian atas layar 100% bersih, kanvas 3D penuh tanpa panel.
//   Wujud 2 (aktif)    : glass bottom sheet (maks 50% layar) berisi
//                        Horizontal Agent Dock (scroll menyamping, snap)
//                        + panel ruangan yang dipilih (dark glass).
//
// Aturan tampilan (permintaan Bos): KANTOR AI BEBAS EMOJI.
//   - Label, tombol, status & catatan sistem pakai teks polos berwarna.
//   - Teks dinamis dari API (briefing, memori, insight) difilter noEmoji().
//   - Draf konten (TikTok/skrip/email) TETAP apa adanya — itu barang jadi
//     yang Bos salin ke media sosial, bukan kerangka UI.
//
// Detail karyawan (baru): kartu akordeon per karyawan kini punya STATUS
// KERJA LIVE (dari data agen nyata) + MEMORI KARYAWAN (riwayat kerja
// pribadi dari action=mem-agent) + model AI resminya.
//
// Semua logika bisnis (state, call API, antrean COO, bahan TikTok)
// tetap tinggal di KantorCeo3D.tsx — komponen ini presentational + toggle sheet.
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Sparkles, Trash2, X } from 'lucide-react'
import PendingActionsQueue from './PendingActionsQueue'
/* PATCH C (tambalan fase bisnis): panel fase + artefak karyawan per ruangan */
import { PhasePanel, RoleArtifacts, PRE_LAUNCH_TUGAS, ROOM_ROLE, usePhaseData, LoopBelajarPanel } from './PhasePanels'
import ArtifactsQueue from './ArtifactsQueue'
/* Roadmap #4 — Laporan KPI karyawan: angka nyata per karyawan (read-only) */
import KpiPanel from './KpiPanel'
import { getClientBrowserAsync } from '@/lib/supabase-browser'

/* ============================================================
   STRUKTUR & JABATAN TIM AI — data lengkap untuk Ruang Struktur.
   Sumber kebenaran: kode /api/ceo-agent & worker-entry.ts (jadwal cron Cloudflare).
   Tim ramping 15-11: Alexander (CEO), Raka (CTO), Maya & Sinta (divisi Luxtradee Growth).
   Batas kemampuan ditulis JUJUR supaya Bos bisa menilai gap tim.
   ============================================================ */
const TEAM_DETAIL = [
  {
    id: 'CTO', name: 'Raka', jabatan: 'CTO · Chief Technology Officer', divisi: 'IT, QA & Keamanan', color: '#0d9488',
    model: 'Claude Haiku 5.5 (Mortera) → Nemotron 3.5 Lightning (OpenRouter) → templat',
    shift: 'Watchdog tiap 15 menit 24/7 · QA sweep + laporan di briefing 08:00 WIB',
    baca: 'Ping https://luxtradee.web.id · bug_reports · riwayat uptime (agent_kv) · env diagnostik',
    tugas: [
      'Ping situs tiap 15 menit — DOWN → alarm Discord instan (dedup 30 mnt), pulih → kabari sekali',
      'Bug baru masuk → triage pakai model resminya: 3 bug terakhir diringkas jadi diagnosa + prioritas P1/P2/P3',
      'QA otomatis 15 route utama tiap briefing pagi — 12 halaman + 3 ENDPOINT KRITIS API (jurnal trades, evaluasi AI screenshot, CS chat): 401/405 = hidup & terjaga, 5xx/timeout dilaporkan',
      'Diagnostik env & tes query Supabase (tombol Diagnostik di Ruang CTO)',
    ],
    lapor: 'Alarm instan ke Discord · baris QA & bug di Morning Briefing 08:00 · uptime % di laporan mingguan',
    batas: [
      'QA = HTTP GET — tidak bisa login lalu klik-klik dashboard seperti manusia (tidak ada browser di Workers)',
      'Tidak bisa memperbaiki bug sendiri — cuma laporkan & tebak penyebabnya',
      'Bug di fitur berbayar tak terlihat kalau user tidak lapor lewat form bug',
    ],
    ide: 'QA route butuh-login pakai token uji beneran · rollback otomatis kalau QA gagal parah (butuh pipeline deploy baru)',
  },
  {
    id: 'CSO', name: 'Maya', jabatan: 'CSO · Luxtradee Growth (Retensi & Customer Success)', divisi: 'Divisi Luxtradee Growth — merger CSO+CMO', color: '#be185d',
    model: 'Claude Haiku 5.5 (Mortera) → Gemma 4 26B (OpenRouter) → templat',
    shift: 'Hitung user di briefing 08:00 · email pasif otomatis 1x/hari (kalau AUTO-ACC on) · rapat dengan CMO 1x/hari',
    baca: 'profiles (total pendaftar) · trades 24 jam (siapa aktif) · agent_kv csmailed: (siapa sudah di-email) · bug_reports 7 hari (keluhan)',
    tugas: [
      'Hitung pendaftar / aktif 24 jam / pasif tiap pagi — tampil di briefing & panel Ruang CSO',
      'SKOR RISIKO CHURN: hitung user yang pernah aktif 30 hari tapi 3 hari terakhir diam → kandidat win-back dilaporkan tiap pagi (briefing + panel Ruang CSO)',
      'Kirim EMAIL PERSONAL ke maks 50 user pasif — 2 GRUP, masing-masing draf beda: (A) user vakum yang pernah upload → nada kangen & nilai jurnalnya, (B) user yang belum pernah upload 1 trade pun → nada ajakan pertama. Nada email diracik model resminya (Gemma via OpenRouter, rotasi 3 variasi), pembuka per user dari data trading asli (nama, jumlah trade, pair favorit, win rate catatan, berapa hari lalu upload)',
      'Ukur feedback: besoknya hitung berapa dari yang di-email yang balik upload (dilaporkan di briefing)',
      'Bawa data nyata ke meja rapat sama Sinta (CMO): kenapa user daftar tapi males upload jurnal → jadi skrip konten',
    ],
    lapor: 'Angka user + risiko churn di briefing 08:00 · hasil rapat CSO×CMO dikirim Discord (pesan terpisah) · ACC EMAIL & AUTO-ACC di panel Ruang CSO',
    batas: [
      '"Aktif" = upload trades dalam 24 jam — user yang cuma login dihitung pasif',
      'Email cuma ke 50 pendaftar terbaru yang pasif per hari (sisa nunggu besok)',
      'Tidak bisa survey user langsung / membalas chat user (itu tugas CS bot /api/chat)',
    ],
    ide: 'Prediksi churn per user pakai model ML (butuh histori lebih panjang) · A/B subject email otomatis (butuh open-rate dari Resend) · segmen email per tingkat risiko',
  },
  {
    id: 'CMO', name: 'Sinta', jabatan: 'CMO · Luxtradee Growth (Konten & Akuisisi)', divisi: 'Divisi Luxtradee Growth — merger CSO+CMO', color: '#7c3aed',
    model: 'Claude Haiku 5.5 (Mortera) → Gemma 4 31B (OpenRouter) → templat',
    shift: 'Shift pagi: LAPORAN RISET TikTok + draf skrip di briefing 08:00 · Shift sore: produksi & posting video 20:00 WIB (prime time FYP)',
    baca: 'tiktok_posts (top 5 konten Bos urut views) · hasil rapat Maya×Sinta (alasan churn) · env TIKTOK_REFERENCE (cadangan) · histori 5 draf terakhir',
    tugas: [
      'LAPORAN RISET TIKTOK/hari (analisis pasar, bukan cuma bahan konten): pola hook yang works, topik berpeluang FYP, jadwal posting terbaik, risiko — dibagikan ke SELURUH kantor (briefing Alexander, panel Memori Kantor)',
      'Analisis pola konten TikTok asli yang paling perform (hook, topik, gaya) → tiru polanya di draf baru',
      '3 DRAF PILIHAN/hari via 1 panggilan model resminya (Gemma 4 31B via OpenRouter) — 3 pendekatan berbeda, WAJIB selaras hasil risetnya sendiri; Bos tinggal pilih yang paling pas di Ruang CMO',
      'INSTAGRAM ANALISIS (Tahap T): bikin 1 caption IG educational berbasis data REAL komunitas 24 jam (win rate agregat, pair favorit, total trade) — terpisah dari draf TikTok. Caption otomatis diposting ke Instagram via Meta Graph API (token INSTAGRAM_ACCESS_TOKEN + INSTAGRAM_USER_ID di Cloudflare Secrets). Tanpa token → status jujur "belum diset", tidak ada simulasi sukses.',
      'Draf wajib menjawab alasan churn dari rapat Maya (bukan sekadar ikut angle rotasi)',
      'Rantai model: Gemma 4 31B → Nemotron Lightning → Gemma 4 26B → Gemini → templat statis (draf tidak pernah kosong)',
      'Ikut rapat harian sama Maya: ubah akar masalah churn jadi skrip konten anti-churn',
      'SHIFT SORE (20:00 WIB): produksi video TikTok utuh — skrip dari studio-nya → render Remotion 9:16 + voiceover Indonesia → posting otomatis via API resmi TikTok (job "sinta-video")',
    ],
    lapor: 'LAPORAN RISET di briefing 08:00 + panel Memori Kantor · 3 draf di panel Ruang CMO (pilih → salin) · video harian masuk TikTok 20:00 WIB (atau diambil Bos dari artifact kalau app belum approved) · skrip rapat di Ruang CSO',
    batas: [
      'Tidak tahu performa SETELAH posting — views/likes berubah hanya kalau Bos update manual di Ruang CMO',
      'App TikTok belum di-approve & secret TIKTOK_* belum diset → video belum bisa auto-posting: hasil produksi diambil Bos dari artifact GitHub Actions (video-tiktok-sinta) & diposting manual — begitu approved, auto-posting nyala sendiri',
      'Setelah approved pun: mode sandbox → postingan masih SELF_ONLY (privat) sampai lolos audit produksi TikTok',
    ],
    ide: 'Refresh views otomatis via oEmbed mingguan · bank hook yang terbukti FYP · pakai draf pilihan Bos sebagai skrip video besok',
  },
  {
    id: 'CEO', name: 'Alexander', jabatan: 'CEO · Kepala Semua Agen', divisi: 'Eksekutif', color: '#94a3b8',
    model: 'Claude Haiku 5.5 (Mortera) → Nemotron 3.5 Lightning (OpenRouter) → templat',
    shift: 'Briefing 08:00 WIB harian · laporan mingguan Senin 10:00 WIB',
    baca: 'Semua laporan agen (CTO Raka + divisi Luxtradee Growth: Maya & Sinta) + status AUTO-ACC + Memori Kantor',
    tugas: [
      'Kumpulkan laporan semua karyawan jadi Morning Briefing satu pesan → dirapikan model resminya (Nemotron 3.5 Lightning via OpenRouter, anti-429 — tidak berebut kuota dengan divisi Growth) → kirim ke Discord 08:00',
      'Pilih 1 NEXT BEST ACTION tiap pagi pakai modelnya sendiri — prioritas tunggal yang HANYA Bos bisa kerjakan hari ini (Discord pesan terpisah)',
      'Ingatkan PRIORITAS KEMARIN di briefing — akuntabilitas: dilakukan, atau ganti dengan alasan jelas',
      'NBA OKE/NOT OKE: Bos jawab prioritas hari ini via tombol Ruang Rapat ATAU slash command Discord /nba-oke · /nba-not → dicatat ke memori & briefing besok menghormati jawaban itu',
      'CHAT 2 ARAH Discord: Bos ketik /bos <pesan> → Alexander jawab langsung (route /api/discord-interactions, mode Interactions — bukan Gateway, kompatibel Workers) dengan konteks briefing terakhir',
      'RINGKASAN SUARA: tombol Bacakan Briefing di Ruang Rapat — laporan pagi dibacakan suara browser (TTS lokal, tanpa API key)',
      'Catat keputusan & kesimpulan penting ke Memori Kantor — semua karyawan membaca catatan ini (tim belajar bersama)',
      'Jalankan AUTO-ACC email pasif (Maya) otomatis tiap pagi (default ON — toggle AUTO-ACC untuk mematikan)',
    ],
    lapor: 'Semua laporan mendarat di channel Discord (webhook) — satu tempat, tinggal baca · memori bisa dibaca di Ruang Rapat · chat balik via /bos di Discord',
    batas: [
      'Cuma bisa LAPOR & SARAN — keputusan besar (harga, fitur, anggaran) tetap di tangan Bos',
      'Briefing gagal kirim ke Discord → dicoba ulang OTOMATIS oleh watchdog (self-heal) + dikirim email cadangan ke Bos',
      'Chat /bos jalan setelah 3 secret dipasang (DISCORD_APP_ID, DISCORD_BOT_TOKEN, DISCORD_PUBLIC_KEY) + Interactions Endpoint URL diisi di Discord Developer Portal',
      'TTS pakai suara bawaan browser (kualitas tergantung perangkat) — bukan suara natural API',
    ],
    ide: 'TTS suara natural via API (butuh provider berbayar) · bot Discord jawab semua karyawan (bukan cuma CEO) · eksekusi NBA penuh otomatis (butuh izin aksi langsung)',
  },
]

/* ---------- SKILL TINGKAT DEWA — keahlian andalan tiap karyawan ----------
   Ringkasan satu baris keunggulan ekstrem masing-masing agen (bukan daftar
   tugas harian — itu ada di Ruang Struktur). Dipakai chip di tiap ruangan
   + baris di kartu akordeon. Otaknya kini rantai baru: Mortera (Claude
   Haiku 5.5) dulu → OpenRouter → templat — karyawan tidak pernah manggung. */
const GOD_SKILL: Record<string, string> = {
  CEO: 'Neural Command — orkestrasi tim ramping, NBA harian, akuntabilitas & memori kantor',
  CTO: 'Self-Healing Infra — watchdog 15 menit, QA 15 route + E2E login beneran, alarm sendiri ke Discord',
  CSO: 'Mind-Reader Retensi — skor churn harian, email personal 2 grup dari data trading asli, rapat data × CMO',
  CMO: 'Viral Script Engine — riset TikTok harian buat seluruh kantor + 3 draf pilihan + video Remotion prime time 20:00',
}
function GodChip({ id }: { id: string }) {
  return (
    <div className="mb-3 rounded-xl border border-amber-300/25 bg-amber-400/10 px-2.5 py-1.5 leading-relaxed">
      <span className="text-[9px] font-bold uppercase tracking-wider text-amber-200/90">Skill Tingkat Dewa</span>
      <span className="text-white/75 text-[11px]"> · {GOD_SKILL[id]}</span>
    </div>
  )
}

/* Warna aksen versi TERANG — terbaca di atas glass gelap */
const BRIGHT: Record<string, string> = {
  '#059669': '#34d399', '#0d9488': '#2dd4bf', '#be185d': '#f472b6', '#7c3aed': '#a78bfa',
  '#b45309': '#fbbf24', '#0891b2': '#22d3ee', '#ea580c': '#fb923c', '#334155': '#cbd5e1', '#94a3b8': '#cbd5e1',
  '#d97706': '#fbbf24',
}

/* ---------- filter emoji untuk teks DINAMIS dari API ----------
   Briefing, memori, insight & status dari server kadang membawa emoji
   (format Discord) — kantor AI harus bersih, jadi disaring di tampilan.
   Draf konten (TikTok/skrip/email) sengaja TIDAK difilter: itu barang jadi. */
const EMOJI_RE = /[\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F000}-\u{1FAFF}\u{FE0F}\u{200D}]/gu
function noEmoji(s: unknown): string {
  return String(s ?? '').replace(EMOJI_RE, '').replace(/ {2,}/g, ' ').trim()
}

/* ---------- Jam WIB nyata — komponen TERPISAH: interval 1 detik hanya
   me-render kapsul ini, bukan seluruh sheet (pelajaran performa lama) ---------- */
function ClockWib() {
  const [t, setT] = useState('')
  useEffect(() => {
    const f = () => setT(new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date()))
    f()
    const iv = setInterval(f, 1000)
    return () => clearInterval(iv)
  }, [])
  return (
    <div className="flex items-baseline gap-1 tabular-nums shrink-0">
      <span className="text-[13px] font-semibold text-white/90 tracking-wide">{t}</span>
      <span className="text-[8.5px] font-medium text-white/45">WIB</span>
    </div>
  )
}

/* ---------- TTS BRIEFING — ringkasan laporan bentuk suara (bonus Alexander).
   100% browser (Web Speech API) — tanpa API key, tanpa kuota. ---------- */
function stripMarkdownForSpeech(t: string): string {
  return t
    .replace(/[*_`#>]/g, '')
    .replace(/━━+/g, '. ')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/* ---------- kelas utilitas dark-glass ---------- */
const BTN = 'font-[inherit] text-xs px-3 py-2 rounded-xl border border-teal-300/30 bg-teal-400/10 text-teal-200 hover:bg-teal-400/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
const BTNP = 'font-[inherit] text-xs px-3 py-2 rounded-xl border border-violet-300/30 bg-violet-400/10 text-violet-200 hover:bg-violet-400/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
const BTNR = 'font-[inherit] text-xs px-3 py-2 rounded-xl border border-pink-300/30 bg-pink-400/10 text-pink-200 hover:bg-pink-400/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
const BTNO = 'font-[inherit] text-xs px-3 py-2 rounded-xl border border-amber-300/30 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
const SEP = 'mt-3 pt-3 border-t border-white/10'
const ERR = 'mt-2 text-[11.5px] text-red-300'
const OKS = 'mt-2 text-[11.5px] text-emerald-300'

/* env yang BOLEH kosong — di ringkasan diag ditandai "(opsional)",
   bukan gagal, supaya tidak tampak seperti masalah. */
const OPTIONAL_ENV: Record<string, boolean> = {
  OPENROUTER_MODEL: true,        // override model Sinta — default tim sudah jalan
  RESEND_WEBHOOK_SECRET: true,   // statistik email dibuka — nice to have
  OWNER_EMAIL: true,             // default luxtradee@gmail.com sudah benar
  DISCORD_BOT_TOKEN: true,       // hanya chat 2 arah /bos — webhook 1 arah jalan tanpa ini
  DISCORD_APP_ID: true,
  DISCORD_PUBLIC_KEY: true,
}
const INPUT = 'bg-white/10 border border-white/15 rounded-lg text-white placeholder-white/35 text-[11.5px] px-2 py-1.5 outline-none focus:border-white/35 transition-colors'
const PANEL = 'bg-white/5 border border-white/10 rounded-2xl'

/* ============================================================
   TAB OVERVIEW (keluhan Bos 14-11: "daftar kerjaan dan tugas karyawan ai
   tolong dibenerin ya layar penuh bgt terus kek berantakan susah liatnya")
   — dulu SEMUA panel (fase + KPI + keputusan + ACC + artefak) DITUMPUK
   dalam satu scroll panjang di sheet 50vh → layar sesak & sulit dibaca.
   Kini: chip tab di atas, SATU panel tampil per kali.
   ============================================================ */
type OverviewTab = 'progres' | 'kpi' | 'keputusan' | 'acc' | 'artefak'
const OVERVIEW_TABS: { id: OverviewTab; label: string }[] = [
  { id: 'progres', label: 'Progres' },
  { id: 'kpi', label: 'KPI Tim' },
  { id: 'keputusan', label: 'Keputusan' },
  { id: 'acc', label: 'ACC Bos' },
  { id: 'artefak', label: 'Artefak' },
]

/* titik status kecil bercahaya */
function Dot({ tone }: { tone: 'ok' | 'busy' | 'idle' }) {
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${tone === 'ok' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.8)]' : tone === 'busy' ? 'bg-amber-300 animate-pulse shadow-[0_0_8px_rgba(252,211,77,.8)]' : 'bg-white/25'}`} />
}

type TeamMember = typeof TEAM_DETAIL[number]
interface MemEntry { at: string; who: string; text: string }

/* ---------- Memori pribadi karyawan — dimuat lazy saat kartu dibuka.
   Sumber: GET /api/ceo-agent?action=mem-agent&agent=<key> (Bearer token Bos). */
function StaffMemory({ agent }: { agent: string }) {
  const [mem, setMem] = useState<MemEntry[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    let dead = false
    setLoading(true)
    setErr('')
    ;(async () => {
      try {
        const sb = await getClientBrowserAsync()
        let token = ''
        if (sb) {
          const { data } = await sb.auth.getSession()
          token = data?.session?.access_token || ''
        }
        const res = await fetch(`/api/ceo-agent?action=mem-agent&agent=${agent}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: 'no-store',
        })
        const js = await res.json()
        if (!dead) setMem(Array.isArray(js?.mem) ? js.mem : [])
      } catch {
        if (!dead) { setMem([]); setErr('Gagal memuat memori — coba buka kartu lagi.') }
      } finally {
        if (!dead) setLoading(false)
      }
    })()
    return () => { dead = true }
  }, [agent])

  return (
    <div className="rounded-xl bg-cyan-400/5 border border-cyan-300/20 px-2.5 py-2">
      <div className="text-[9px] font-bold uppercase tracking-wider text-cyan-300/80 mb-1">Memori Karyawan</div>
      {loading ? (
        <div className="text-white/45 text-[10px]">Memuat riwayat kerja...</div>
      ) : err ? (
        <div className="text-red-300/80 text-[10px]">{err}</div>
      ) : mem && mem.length ? (
        <div className="max-h-32 overflow-y-auto kscroll">
          {mem.map((mm, i) => (
            <div key={i} className="mb-1 pl-2 border-l-2 border-cyan-300/25 text-[10px] leading-relaxed text-white/70">
              <span className="text-white/40">[{String(mm.at || '').slice(5, 10)}]</span> {mm.text}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-white/45 text-[10px]">Belum ada catatan — terisi otomatis setiap kali karyawan ini menyelesaikan tugasnya.</div>
      )}
      <div className="text-white/35 text-[9px] mt-1">Karyawan membaca catatan ini saat bekerja — dia ingat hasil kerjanya sendiri, tidak mulai dari nol.</div>
    </div>
  )
}

/* ---------- Kartu karyawan Tim AI (akordeon) ----------
   Tertutup = avatar inisial + nama + jabatan + status live.
   Terbuka = detail terstruktur: status kerja, jam kerja, data dibaca,
   model AI, tugas bernomor, laporan, batas jujur, ide — plus memori
   pribadi karyawan (riwayat kerja yang dia ingat). TANPA EMOJI. */
function EmployeeCard({ m, open, onToggle, live, preLaunch }: { m: TeamMember; open: boolean; onToggle: () => void; live: { tone: 'ok' | 'warn' | 'idle'; text: string }; preLaunch?: boolean }) {
  const bright = BRIGHT[m.color] || m.color
  return (
    <div
      className="rounded-2xl border overflow-hidden mb-2 transition-colors duration-200"
      style={{ borderColor: open ? `${bright}66` : 'rgba(255,255,255,0.10)', background: open ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)' }}
    >
      {/* Kepala kartu — selalu terlihat, klik untuk buka/tutup */}
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left cursor-pointer hover:bg-white/5 transition-colors"
      >
        <span
          className="w-9 h-9 rounded-full grid place-items-center text-[15px] font-bold shrink-0"
          style={{ background: `${bright}1f`, border: `1px solid ${bright}59`, color: bright }}
          aria-hidden="true"
        >{m.name.charAt(0)}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[12.5px] font-bold text-white">{m.name}</span>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full tracking-wide"
              style={{ background: `${bright}1a`, color: bright }}
            >{m.id}</span>
          </span>
          <span className="block text-[10px] text-white/45 truncate">{m.jabatan} · {m.divisi}</span>
        </span>
        <ChevronDown
          size={14}
          className={`text-white/35 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {/* Detail — hanya saat terbuka */}
      {open && (
        <div className="px-3 pb-3 pt-0.5 space-y-2 text-[10.5px] leading-relaxed">
          {/* Status kerja LIVE — dari data agen nyata, bukan teks statis */}
          <div className="rounded-xl bg-white/5 border border-white/10 px-2.5 py-2 flex items-start gap-2">
            <span className="pt-0.5"><Dot tone={live.tone === 'ok' ? 'ok' : live.tone === 'warn' ? 'busy' : 'idle'} /></span>
            <span className="text-white/80">
              <b className="text-white/90">Status kerja:</b> {live.text || 'menunggu data'}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-white/70"><b className="text-white/85">Jam kerja:</b> {m.shift}</span>
            <span className="text-white/70"><b className="text-white/85">Data yang dibaca:</b> {m.baca}</span>
            <span className="text-white/70"><b className="text-white/85">Model AI:</b> {m.model}</span>
            <span className="text-white/70"><b className="text-amber-300">Skill tingkat dewa:</b> {GOD_SKILL[m.id]}</span>
          </div>

          <div className="rounded-xl px-2.5 py-2" style={{ background: `${bright}0d`, border: `1px solid ${bright}33` }}>
            <div className="text-[9px] font-bold uppercase tracking-wider mb-1.5" style={{ color: bright }}>Tugas</div>
            <ol className="m-0 p-0 list-none flex flex-col gap-1">
              {m.tugas.map((t, i) => (
                <li key={i} className="flex gap-1.5">
                  <span
                    className="shrink-0 w-4 h-4 mt-px rounded-full grid place-items-center text-[8.5px] font-bold"
                    style={{ background: `${bright}22`, color: bright }}
                    aria-hidden="true"
                  >{i + 1}</span>
                  <span className="text-white/80">{t}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* PATCH C — saat pre-launch: tugas harian karyawan DIGANTI mode hemat
              (lihat PRE_LAUNCH_TUGAS di PhasePanels). Daftar di atas aktif
              kembali otomatis begitu fase naik ke early/growth. */}
          {preLaunch && PRE_LAUNCH_TUGAS[m.id] ? (
            <div className="rounded-xl bg-violet-400/5 border border-violet-300/20 px-2.5 py-2">
              <div className="text-[9px] font-bold uppercase tracking-wider text-violet-300/80 mb-1">Mode pre-launch (aktif sekarang)</div>
              <ul className="m-0 p-0 list-none flex flex-col gap-0.5">
                {PRE_LAUNCH_TUGAS[m.id].map((t, i) => (
                  <li key={i} className="flex gap-1.5 text-white/75"><span className="text-violet-300/70 shrink-0" aria-hidden="true">–</span><span>{t}</span></li>
                ))}
              </ul>
              <div className="text-white/40 text-[9.5px] mt-1">Daftar Tugas di atas aktif kembali otomatis saat fase naik ke early/growth.</div>
            </div>
          ) : null}

          <span className="block text-white/70"><b className="text-white/85">Laporan:</b> {m.lapor}</span>

          <div className="rounded-xl bg-amber-400/5 border border-amber-300/20 px-2.5 py-2">
            <div className="text-[9px] font-bold uppercase tracking-wider text-amber-300/80 mb-1">Belum bisa</div>
            <ul className="m-0 p-0 list-none flex flex-col gap-0.5">
              {m.batas.map((t, i) => (
                <li key={i} className="flex gap-1.5 text-white/70"><span className="text-amber-300/70 shrink-0" aria-hidden="true">–</span><span>{t}</span></li>
              ))}
            </ul>
          </div>

          <span className="block text-white/75"><b className="text-teal-300">Bisa ditambah:</b> {m.ide}</span>

          {/* Memori pribadi — karyawan ingat kerjaannya sendiri */}
          <StaffMemory agent={m.id.toLowerCase()} />
        </div>
      )}
    </div>
  )
}

/* ============================================================ */
export interface RuangCeoDashboardProps {
  room: string
  setRoom: (r: string) => void
  busy: boolean
  data: any
  call: (action: string, method?: string) => Promise<any>
  acc: any
  setAcc: (v: any) => void
  copied: boolean
  setCopied: (v: boolean) => void
  talkCopied: boolean
  setTalkCopied: (v: boolean) => void
  tt: any[]
  ttUrl: string
  setTtUrl: (v: string) => void
  ttViews: string
  setTtViews: (v: string) => void
  ttLikes: string
  setTtLikes: (v: string) => void
  ttMsg: string
  ttBusy: boolean
  ttAdd: () => void
  ttDel: (id: string) => void
}

export default function RuangCeoDashboard(P: RuangCeoDashboardProps) {
  const { room, setRoom, busy, data, call } = P
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [cmoVar, setCmoVar] = useState(0)
  const [speaking, setSpeaking] = useState(false)
  /* Akordeon Tim AI: satu karyawan terbuka pada satu waktu (null = semua tertutup) */
  const [openStaff, setOpenStaff] = useState<string | null>(null)
  /* Tab overview aktif (default: Progres — yang paling sering dicek Bos) */
  const [overviewTab, setOverviewTab] = useState<OverviewTab>('progres')
  const dockRef = useRef<HTMLDivElement>(null)
  /* PATCH C — data fase bisnis + artefak karyawan (reload tiap sheet dibuka) */
  const { data: phaseData, loading: phaseLoading, reload: phaseReload } = usePhaseData(isSheetOpen)
  const preLaunch = phaseData?.phase.phase === 'pre-launch'

  /* Bacakan/berhentikan briefing (suara browser, lang id-ID) */
  const toggleSpeak = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return }
    const u = new SpeechSynthesisUtterance(stripMarkdownForSpeech(noEmoji(String(data?.text || ''))).slice(0, 3200))
    u.lang = 'id-ID'
    u.rate = 1.05
    u.onend = () => setSpeaking(false)
    u.onerror = () => setSpeaking(false)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
    setSpeaking(true)
  }

  /* Jembatan: klik karakter 3D → KantorCeo3D panggil window.__kceo.openSheet()
     supaya sheet ikut terbuka saat Bos menyentuh karyawan di kantor virtual */
  useEffect(() => {
    const w = window as any
    w.__kceo = { ...(w.__kceo || {}), openSheet: () => setIsSheetOpen(true) }
    return () => { if (w.__kceo) delete w.__kceo.openSheet }
  }, [])

  const cto = data?.cto, cso = data?.cso, cmo = data?.cmo
  const talk = data?.talk
  const autoacc = data?.autoacc
  /* Draf CMO aktif — dukung 3 draf pilihan (baru) & 1 draf (cache lama) */
  const cmoDrafts: string[] = Array.isArray(cmo?.drafts) && cmo.drafts.length ? cmo.drafts : cmo?.draft ? [cmo.draft] : []
  const cmoCur = cmoDrafts[Math.min(cmoVar, cmoDrafts.length - 1)] || ''

  const trunc = (s: string, n: number) => (s && s.length > n ? s.slice(0, n) + '…' : s)

  /* ---------- Status live per karyawan — dari data agen NYATA.
     Dipakai kartu detail karyawan (Ruang Struktur) supaya "detail
     karyawan" berisi logika kerja beneran, bukan cuma deskripsi statis. */
  const liveBase = (id: string): { tone: 'ok' | 'warn' | 'idle'; text: string } => {
    switch (id) {
      case 'CTO':
        return cto
          ? { tone: cto.siteOk ? 'ok' : 'warn', text: `Web ${cto.siteOk ? 'OK' : 'DOWN'}${cto.latencyMs ? ` (${cto.latencyMs} ms)` : ''} · bug 24 jam ${cto.bugs24h >= 0 ? cto.bugs24h : '?'}` }
          : { tone: 'idle', text: 'Watchdog tiap 15 menit 24/7' }
      case 'CSO':
        return cso
          ? { tone: (cso.churnRisk ?? 0) > 0 ? 'warn' : 'ok', text: `Total ${cso.total ?? '-'} pendaftar · aktif ${cso.active ?? '-'} · pasif ${cso.passive ?? '-'} · risiko churn ${cso.churnRisk ?? 0}` }
          : { tone: 'idle', text: 'Hitung user + email pasif tiap briefing 08:00' }
      case 'CMO':
        return cmo
          ? { tone: 'ok', text: cmoDrafts.length > 1 ? `${cmoDrafts.length} draf TikTok hari ini siap — Bos tinggal pilih` : cmoDrafts.length === 1 ? 'Draf TikTok hari ini siap' : 'Belum ada draf hari ini' }
          : { tone: 'idle', text: 'Draf TikTok tiap pagi · video 20:00 WIB' }
      case 'CEO':
        return data?.nba?.text
          ? { tone: 'ok', text: `Prioritas hari ini: ${trunc(noEmoji(data.nba.text), 84)}` }
          : { tone: 'idle', text: 'Briefing 08:00 WIB otomatis' }
      default:
        return { tone: 'idle', text: '' }
    }
  }

  /* PATCH C — saat pre-launch, status karyawan ditambah info artefak
     terbarunya (barang jadi terlihat langsung di kartu). */
  const liveOf = (id: string): { tone: 'ok' | 'warn' | 'idle'; text: string } => {
    const b = liveBase(id)
    if (!preLaunch) return b
    const a = phaseData?.artifacts.find((x) => x.role === id.toLowerCase())
    return a ? { ...b, text: `${b.text ? b.text + ' · ' : ''}artefak: ${noEmoji(a.title)}`.slice(0, 220) } : b
  }

  /* ---------- Horizontal Agent Dock — status langsung dari data agen ---------- */
  const DOCK = [
    { id: 'rapat', name: 'Alexander', role: 'CEO · Ruang Rapat', live: data?.nba?.text ? 'Prioritas hari ini siap' : data?.mem?.length ? `${data.mem.length} catatan memori kantor` : 'Briefing 08:00 WIB otomatis', has: !!(data?.nba || data?.mem) },
    { id: 'CTO', name: 'Raka', role: 'CTO · IT & QA', live: cto ? `Web ${cto.siteOk ? 'OK' : 'DOWN'} · Bug 24 jam ${cto.bugs24h >= 0 ? cto.bugs24h : '?'}` : 'Watchdog tiap 15 menit', has: !!cto },
    { id: 'CSO', name: 'Maya', role: 'Luxtradee Growth · Retensi & Email', live: cso ? `Total ${cso.total ?? '-'} · Aktif ${cso.active ?? '-'} · churn ${cso.churnRisk ?? 0}` : 'Email pasif + riset churn', has: !!cso },
    { id: 'CMO', name: 'Sinta', role: 'Luxtradee Growth · Konten & Video', live: cmoDrafts.length > 1 ? '3 draf hari ini siap — Bos tinggal pilih' : cmoDrafts.length === 1 ? 'Draf hari ini siap' : 'Belum ada draf hari ini', has: !!cmo },
    { id: 'struktur', name: 'Tim AI', role: 'Struktur & Jabatan', live: '4 karyawan · tugas, jadwal, memori & batas kemampuan', has: true },
  ] as const

  const pick = (id: string) => {
    setRoom(id)
    /* geser dock supaya kartu ruangan aktif selalu terlihat penuh di tengah */
    requestAnimationFrame(() => {
      dockRef.current?.querySelector(`[data-dock="${id}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
    })
  }

  return (
    <>
      {/* scrollbar halus untuk panel gelap */}
      <style>{`.kscroll::-webkit-scrollbar{width:4px;height:4px}.kscroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.22);border-radius:99px}.kscroll{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.22) transparent}.kdock{scrollbar-width:none}.kdock::-webkit-scrollbar{display:none}`}</style>

      {/* ===== WUJUD 1 — FLOATING PILL (standby): semua kartu tersembunyi ===== */}
      {!isSheetOpen && (
        <button
          onClick={() => setIsSheetOpen(true)}
          aria-label="Buka CEO Command Center"
          className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-30 flex items-center gap-2 px-5 py-2.5 rounded-full bg-black/20 backdrop-blur-2xl border border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.5)] text-white text-sm font-medium whitespace-nowrap cursor-pointer hover:bg-black/30 transition-all active:scale-95"
        >
          <Sparkles size={16} className="text-white/90" />
          <span>CEO Command Center</span>
          <span className="w-px h-4 bg-white/15" aria-hidden="true" />
          <ClockWib />
          {busy && <Dot tone="busy" />}
        </button>
      )}

      {/* ===== penutup lewat ketukan di luar sheet (transparan — 3D tetap terlihat) ===== */}
      {isSheetOpen && (
        <div className="fixed inset-0 z-30" onClick={() => setIsSheetOpen(false)} aria-hidden="true" />
      )}

      {/* ===== WUJUD 2 — GLASS BOTTOM SHEET (maks 50% tinggi layar) ===== */}
      <div
        role="dialog"
        aria-label="CEO Command Center"
        className={`fixed bottom-0 left-0 w-full z-40 transform transition-transform duration-300 ease-out max-h-[50vh] bg-black/40 backdrop-blur-3xl border-t border-white/10 rounded-t-3xl p-5 flex flex-col gap-3 overflow-hidden ${isSheetOpen ? 'translate-y-0 pointer-events-auto' : 'translate-y-full pointer-events-none'}`}
      >
        {/* grabber — ketuk untuk menutup */}
        <button onClick={() => setIsSheetOpen(false)} aria-label="Tutup panel" className="shrink-0 self-center w-12 h-1.5 rounded-full bg-white/25 hover:bg-white/40 transition-colors cursor-pointer" />

        {/* header */}
        <div className="shrink-0 flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-white/10 border border-white/15 grid place-items-center shadow-[0_0_20px_rgba(139,92,246,.25)]">
            <Sparkles size={16} className="text-white/90" />
          </div>
          <div className="min-w-0">
            <div className="text-white text-sm font-semibold leading-tight">CEO Command Center</div>
            <div className="text-white/45 text-[10.5px] leading-tight truncate">
              SUPER AI AGENT · luxtradee@gmail.com{busy ? <span className="text-amber-200/90"> · memproses...</span> : null}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2.5 shrink-0">
            <Dot tone={busy ? 'busy' : 'ok'} />
            <ClockWib />
            <button
              onClick={() => setIsSheetOpen(false)}
              aria-label="Tutup"
              className="w-8 h-8 rounded-full bg-white/10 border border-white/15 text-white/80 hover:bg-white/20 hover:text-white grid place-items-center transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ===== konten tengah: ringkasan (overview) atau panel ruangan ===== */}
        <div className="flex-1 min-h-0 overflow-y-auto kscroll pr-0.5">
          {room === 'overview' ? (
            /* ===== OVERVIEW RAPI — tab, bukan tumpukan (keluhan Bos 14-11) ===== */
            <div className="flex flex-col gap-2">
              <div className="text-white/60 text-[11px] leading-snug">
                Pilih karyawan di dock bawah — atau ketuk karakter di kantor 3D, kamera terbang ke mejanya.
                Semua karyawan tetap kerja 24/7 lewat cron otomatis (briefing 08:00 WIB · laporan Senin 10:00 · hasil masuk Discord).
              </div>
              <div className="flex gap-1.5 overflow-x-auto kdock shrink-0 -mx-0.5 px-0.5 pb-0.5">
                {OVERVIEW_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setOverviewTab(t.id)}
                    aria-pressed={overviewTab === t.id}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold border transition-colors cursor-pointer min-h-[32px] ${
                      overviewTab === t.id
                        ? 'bg-teal-400/20 border-teal-300/40 text-teal-100'
                        : 'bg-white/5 border-white/10 text-white/55 hover:bg-white/10 hover:text-white/85'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="min-h-0">
                {overviewTab === 'progres' && <PhasePanel data={phaseData} loading={phaseLoading} reload={phaseReload} />}
                {overviewTab === 'kpi' && <KpiPanel />}
                {overviewTab === 'keputusan' && <LoopBelajarPanel />}
                {overviewTab === 'acc' && <PendingActionsQueue />}
                {overviewTab === 'artefak' && <ArtifactsQueue />}
              </div>
            </div>
          ) : room === 'rapat' ? (
            /* ============ RUANG RAPAT — CEO Suite ============ */
            <div className={`${PANEL} p-4 text-[12px] text-white/85 leading-relaxed`}>
              <div className="text-[15px] font-bold text-teal-200 mb-0.5">RUANG RAPAT</div>
              <div className="text-white/50 text-[11px] mb-3">CEO Suite · Briefing &amp; kontrol utama</div>
              <GodChip id="CEO" />
              <div className="flex flex-wrap gap-1.5">
                <button className={BTN} disabled={busy} onClick={() => call('briefing', 'POST')}>{busy ? 'Jalan...' : 'Briefing + Discord'}</button>
                <button className={BTN} onClick={() => call('briefing-last')}>Briefing Terakhir</button>
                <button className={BTNR} onClick={async () => { const r = await call('reset-work'); (window as any).__kceo?.toast?.(r?.text ? String(r.text).slice(0, 130) : 'Reset dijalankan') }}>Reset Kerjaan AI</button>
                <button className={BTNO} onClick={() => call('discord-test')}>Tes Discord</button>
                <button className={BTNO} onClick={() => call('email-test')}>Tes Email</button>
                <button className={BTN} onClick={() => call('watchdog')}>Jalankan Watchdog</button>
                <button className={BTNP} onClick={() => call('weekly')}>Laporan Mingguan</button>
                <button className={BTNP} onClick={() => call('discord-setup', 'POST')}>Daftarkan /bos</button>
              </div>
              {(data && data.ok !== undefined && !data.cto && !data.cso) && (
                <div className={data.ok ? OKS : ERR}>
                  {String(data.message || '').startsWith('Perintah')
                    ? <>Discord Bot: {data.message}</>
                    : data.id
                      ? <>Tes Email: {data.message} — berhasil</>
                      : <>Tes Discord: {data.ok ? 'berhasil — cek channel Discord' : String(data.error || 'gagal').slice(0, 140)}</>}
                  {data.error && Array.isArray(data.setup) && data.setup.length > 0 && (
                    <div className="mt-1 text-[10px] text-white/55 leading-relaxed">
                      {data.setup.map((s: string, i: number) => <div key={i}>{s}</div>)}
                    </div>)}
                </div>)}
              {data?.watch && (
                <div className={OKS}>
                  Watchdog: situs {data.siteOk ? <b className="text-emerald-300">OK</b> : <b className="text-red-300">DOWN</b>}{data.quota ? ` · kuota ${data.quota}` : ''} · {data.alerts && data.alerts.length ? `${data.alerts.length} alert dikirim ke Discord` : 'semua aman — tanpa alarm'}
                </div>)}
              {data?.nba?.text && (
                <div className="mt-3 rounded-xl bg-violet-400/10 border border-violet-300/20 px-2.5 py-2 text-[11.5px] leading-relaxed">
                  <b className="text-violet-200">Next Best Action hari ini — pilihan Alexander:</b><br />{noEmoji(data.nba.text)}
                  <div className="flex gap-1.5 mt-2">
                    <button className={BTN} onClick={() => call('nba-verdict&verdict=oke', 'POST')}>Oke, dieksekusi</button>
                    <button className={BTNR} onClick={() => call('nba-verdict&verdict=not', 'POST')}>Not oke — ganti</button>
                  </div>
                  {data.verdict ? <div className="text-white/50 text-[10px] mt-1">Jawaban Bos hari ini: {data.verdict === 'oke' ? 'OKE — dicatat ke memori & Discord' : 'NOT OKE — besok Alexander pilih prioritas baru'}</div> : null}
                </div>)}
              {Array.isArray(data?.mem) && data.mem.length > 0 && (
                <div className="mt-3 rounded-xl bg-cyan-400/10 border border-cyan-300/20 px-2.5 py-2 text-[11px] leading-relaxed">
                  <b className="text-cyan-200">Memori Kantor — {data.mem.length} catatan terakhir</b>
                  <div className="mt-1 max-h-36 overflow-y-auto kscroll">
                    {data.mem.map((m: any, i: number) => (
                      <div key={i} className="mb-1 pl-2 border-l-2 border-cyan-300/25">
                        <span className="text-white/50">[{String(m.at || '').slice(5, 10)}] <b>{m.who}</b>:</span> {noEmoji(m.text)}
                      </div>))}
                  </div>
                  <div className="text-white/40 text-[9.5px] mt-1">Semua karyawan membaca memori ini di tugas berikutnya — tim belajar bersama, bukan kerja amnesia.</div>
                </div>)}
              {data?.text && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <b>Discord:</b> {data.notifySent ? <span className="text-emerald-300">terkirim</span> : <span className="text-red-300">gagal — {noEmoji(data.notifyErr || 'klik Tes Discord')}</span>}
                    <button className={BTNP + ' ml-auto'} onClick={toggleSpeak}>{speaking ? 'Berhenti' : 'Bacakan Briefing'}</button>
                  </div>
                  <div className="whitespace-pre-wrap mt-1.5 text-white/75 text-[11.5px] max-h-52 overflow-y-auto kscroll rounded-lg bg-white/5 border border-white/10 p-2">{noEmoji(data.text)}</div>
                </div>)}
              {data?.error && data.text === undefined && data.ok === undefined && <div className={ERR}>{noEmoji(data.error).slice(0, 200)}</div>}
              <div className={SEP}>
                <b>Jadwal Kerja Karyawan — OTOMATIS</b>
                <div className="text-white/60 text-[10.5px] mt-1 leading-relaxed">
                  <b>Laporan kerja pagi</b> 08:00 WIB tiap hari — QA Raka + divisi Growth (draf TikTok Sinta + email pasif Maya) + AUTO-ACC + diskusi CSO×CMO + NBA + akuntabilitas prioritas kemarin<br />
                  <b>Shift sore Sinta (CMO)</b> 20:00 WIB tiap hari — produksi &amp; posting video TikTok otomatis (prime time FYP)<br />
                  <b>Watchdog CTO</b> tiap 15 menit 24/7 — situs DOWN / bug baru / kuota 80% → alarm Discord instan<br />
                  <b>Laporan mingguan Senin 10:00 WIB</b> — rekap 7 hari versi CEO — pesan Discord terpisah<br />
                  Semua jalan lewat <b>Cloudflare Cron bawaan</b> — tanpa cron-job.org, tanpa setup manual.<br />
                  Semua karyawan sekarang di kantor ini — halaman /admin/ai-staff sudah pensiun.
                </div>
              </div>
              <div className={`${SEP} text-white/45 text-[10.5px] leading-relaxed`}>
                <b>Cron 08:00 WIB:</b> Cloudflare trigger → /api/ceo-agent?action=briefing&amp;key=CRON_SECRET<br />
                <b>Akses:</b> login luxtradee@gmail.com · token JWT otomatis
              </div>
            </div>
          ) : room === 'CTO' ? (
            /* ============ RUANG CTO — IT & QA ============ */
            <div className={`${PANEL} p-4 text-[12px] text-white/85 leading-relaxed`}>
              <div className="text-[15px] font-bold text-teal-300 mb-0.5">RUANG CTO</div>
              <div className="text-white/50 text-[11px] mb-3">IT &amp; QA · Monitor sistem, bug &amp; tes fitur otomatis</div>
              <GodChip id="CTO" />
              {cto ? (
                <div>
                  <div className="flex gap-2.5 items-center">
                    <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${cto.siteOk ? 'bg-emerald-400/15 text-emerald-300' : 'bg-red-400/15 text-red-300'}`}>{cto.siteOk ? 'OK' : 'DOWN'}</span>
                    <div>
                      <b className="text-white">Website luxtradee.web.id</b><br />
                      <span className="text-white/70">{cto.siteOk ? `${cto.status} OK · ${cto.latencyMs} ms` : `DOWN (${cto.status || 'timeout'})`}</span>
                    </div>
                  </div>
                  <div className={SEP}>
                    <b>Bug 24 jam terakhir</b><br />
                    {cto.bugs24h >= 0
                      ? <span className={`text-[18px] font-bold ${cto.bugs24h > 0 ? 'text-red-300' : 'text-emerald-300'}`}>{cto.bugs24h}</span>
                      : <span className="text-red-300">gagal diambil</span>}
                  </div>
                  {cto.upToday !== undefined && (cto.upToday + cto.downToday) > 0 ? (
                    <div className="text-white/65 text-[11px] mt-1">Watchdog hari ini: <b className="text-emerald-300">{cto.upToday}x OK</b> · <b className={cto.downToday > 0 ? 'text-red-300' : 'text-white/35'}>{cto.downToday}x gagal</b></div>
                  ) : cto.upToday === 0 && cto.downToday === 0 ? <div className="text-white/45 text-[11px] mt-1">Watchdog belum jalan hari ini — cron 15 mnt (cek Ruang Rapat)</div> : null}
                  {cto.err ? <div className="text-white/45 text-[11px] mt-1">{noEmoji(cto.err).slice(0, 130)}</div> : null}
                </div>
              ) : <div className="text-white/50 mt-1">Belum ada data — klik tombol di bawah</div>}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button className={BTN} onClick={() => call('agents&only=cto')}>Cek Ulang</button>
                <button className={BTNP} onClick={() => call('diag')}>Diagnostik</button>
                <button className={BTNP} onClick={() => call('qa')}>Tes Semua Fitur (QA)</button>
                <button className={BTNP} onClick={() => call('e2e')}>Tes Login + E2E</button>
              </div>
              {data && data.total !== undefined && data.results && (
                <div className={`mt-3 text-[11px] leading-relaxed ${SEP}`}>
                  <b className="text-teal-200">QA {data.total} fitur — {data.fails && data.fails.length ? <span className="text-red-300">{data.fails.length} MASALAH</span> : <span className="text-emerald-300">SEMUA OK</span>} · rata-rata {data.avgMs} ms</b>
                  <div className="max-h-36 overflow-y-auto kscroll mt-1">
                    {(data.results || []).map((r: any) => (
                      <div key={r.path}><span className={r.ok ? 'text-emerald-300' : 'text-red-300'}>{r.ok ? 'OK' : 'GAGAL'}</span> <b>{r.path}</b> — {r.label} · {r.status || 'timeout'} ({r.ms} ms){r.err ? <span className="text-red-300"> {noEmoji(r.err)}</span> : null}</div>
                    ))}
                  </div>
                  <div className="text-white/40 mt-1">QA jalan otomatis tiap briefing 08:00 WIB — hasilnya ikut laporan Discord.</div>
                </div>)}
              {data && data.e2eSteps && data.e2eSteps.length > 0 && (
                <div className={`mt-3 text-[11px] leading-relaxed ${SEP}`}>
                  <b className="text-teal-200">E2E AUTO-TEST (LOGIN SUNGGUHAN) — {data.e2eFailed ? <span className="text-amber-300">{data.e2ePassed}/{data.e2eTotal} LOLOS</span> : <span className="text-emerald-300">LOGIN + {data.e2eTotal} LANGKAH OK</span>} · {((data.e2eDurMs || 0) / 1000).toFixed(1)}s</b>
                  <div className="max-h-36 overflow-y-auto kscroll mt-1">
                    {(data.e2eSteps || []).map((s: any) => (
                      <div key={s.id}><span className={s.ok ? 'text-emerald-300' : 'text-red-300'}>{s.ok ? 'LOLOS' : 'GAGAL'}</span> <b>{s.label}</b> · {s.ms} ms{s.detail ? <span className="text-white/65"> — {noEmoji(s.detail)}</span> : null}</div>
                    ))}
                  </div>
                  <div className="text-white/40 mt-1">Akun tes: {data.e2eAccount || '—'} · trade tes dihapus otomatis · jalan otomatis tiap briefing 08:00 WIB.</div>
                </div>)}
              {data && data.env && data.profiles && (
                <div className={`mt-3 text-[11px] leading-relaxed ${SEP}`}>
                  <b className="text-violet-200">Hasil Diagnostik</b><br />
                  {['profiles', 'trades', 'bug_reports', 'agent_kv'].map(k => { const r = data[k] || {}; return (
                    <div key={k}><span className={r.ok ? 'text-emerald-300' : 'text-red-300'}>{r.ok ? 'OK' : 'GAGAL'}</span> <b>{k}</b>{r.ok ? '' : <span className="text-red-300"> — {noEmoji(r.error).slice(0, 90)}</span>}</div>) })}
                  <div className="text-white/40 mt-1">{Object.entries(data.env).map(([k, v]: any) => `${k} ${v ? 'OK' : OPTIONAL_ENV[k] ? '(opsional)' : 'KOSONG'}`).join(' · ')}</div>
                  {(() => { const or = data.openrouter?.data || data.openrouter; if (!or) return null; const bad = or.ok === false || or.keyCheck?.ok === false || (or.aliveCount !== undefined ? or.aliveCount === 0 : /SEMUA model gagal/.test(String(or.verdict || ''))); return (
                    <div className={`mt-2 rounded-lg border px-2 py-1.5 text-[10.5px] leading-relaxed ${bad ? 'bg-red-400/10 border-red-300/25 text-red-100/90' : 'bg-emerald-400/10 border-emerald-300/25 text-emerald-100/90'}`}>
                      <b>Tes Otak Karyawan AI (OpenRouter) — {bad ? <span className="text-red-200">ADA MASALAH</span> : <span className="text-emerald-200">HIDUP</span>}</b>
                      {or.ok === false ? (
                        <div className="mt-1">{noEmoji(or.error).slice(0, 220)}</div>
                      ) : (<>
                        <div className="mt-1">
                          {or.keyCheck?.ok
                            ? <>Key valid{or.keyCheck.label ? <b> ({String(or.keyCheck.label).slice(0, 30)})</b> : null} · terpakai ${Number(or.keyCheck.usage || 0).toFixed(3)}{or.keyCheck.limit != null ? <> / batas belanja key ${Number(or.keyCheck.limit).toFixed(2)}</> : ' · tanpa batas kredit'}{or.keyCheck.isFreeTier ? <span className="text-amber-200"> · free-tier (saldo kosong → 20 req/mnt · 50 req/hari)</span> : null}</>
                            : <>Key bermasalah: {or.keyCheck?.hint || or.keyCheck?.error || `HTTP ${or.keyCheck?.status}`}</>}
                        </div>
                        {or.keyCheck?.ok && or.keyCheck?.note ? <div className="mt-0.5 text-white/60">Catatan: {String(or.keyCheck.note)}</div> : null}
                        <div className="mt-1 max-h-32 overflow-y-auto kscroll">
                          {(or.chain || []).map((m: any) => (
                            <div key={m.model}><span className={m.ok ? 'text-emerald-300' : 'text-red-300'}>{m.ok ? 'HIDUP' : 'GAGAL'}</span> <b>{m.model}</b> — {m.ok ? <>({m.ms} ms{m.reply ? ` · balas: "${noEmoji(m.reply)}"` : ''})</> : <>HTTP {m.status ?? '—'} · {noEmoji(m.hint || m.error || m.body).slice(0, 150)}</>}</div>
                          ))}
                        </div>
                        <div className="mt-1 font-semibold">{noEmoji(or.verdict)}</div>
                      </>)}
                    </div>) })()}
                  {data.setup && (
                    <div className="mt-2 rounded-lg bg-amber-400/10 border border-amber-300/20 px-2 py-1.5 text-[10.5px] leading-relaxed text-amber-100/90 max-h-40 overflow-y-auto kscroll">
                      <b>Cara memasang yang belum ada:</b>
                      {/* Yang WAJIB tampil duluan, yang OPSIONAL di bawah + label —
                          dulu bot token opsional tampak se-wajib key utama, Bos bingung */}
                      {Object.entries(data.setup).map(([k, v]: any) => (!data.env?.[k] && !OPTIONAL_ENV[k]
                        ? <div key={k} className="mt-1">• <b className="text-amber-200">{k}</b> — {v}</div>
                        : null))}
                      {Object.entries(data.setup).map(([k, v]: any) => (!data.env?.[k] && OPTIONAL_ENV[k]
                        ? <div key={k} className="mt-1 text-white/55">• <b>{k}</b> (opsional) — {v}</div>
                        : null))}
                      {data.setupHint ? <div className="mt-1.5 text-white/60">{data.setupHint}</div> : null}
                    </div>)}
                  <div className="text-white/40 mt-1">Tes kirim beneran: tombol Tes Discord &amp; Tes Email di Ruang Rapat.</div>
                </div>)}
            </div>
          ) : room === 'CSO' ? (
            /* ============ RUANG CSO — Customer Success ============ */
            <div className={`${PANEL} p-4 text-[12px] text-white/85 leading-relaxed`}>
              <div className="text-[15px] font-bold text-pink-300 mb-0.5">RUANG CSO</div>
              <div className="text-white/50 text-[11px] mb-3">Customer Success · User, email retensi &amp; riset churn</div>
              <GodChip id="CSO" />
              {cso ? (
                <div>
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <div className="bg-white/5 border border-white/10 rounded-xl py-1.5">
                      <div className="text-[18px] font-bold text-pink-200">{cso.total ?? '—'}</div>
                      <div className="text-[10px] text-white/50">Total</div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl py-1.5">
                      <div className="text-[18px] font-bold text-emerald-300">{cso.active ?? '—'}</div>
                      <div className="text-[10px] text-white/50">Aktif</div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl py-1.5">
                      <div className="text-[18px] font-bold text-amber-300">{cso.passive ?? '—'}</div>
                      <div className="text-[10px] text-white/50">Pasif</div>
                    </div>
                  </div>
                  {cso.churnRisk > 0 ? (
                    <div className="mt-1.5 rounded-xl bg-amber-400/10 border border-amber-300/20 px-2 py-1.5 text-[10.5px] leading-relaxed text-amber-100/90">
                      <b>{cso.churnRisk} user berisiko churn</b> — pernah upload dalam 30 hari tapi 3 hari terakhir diam. Kandidat email win-back Maya (ACC EMAIL / AUTO-ACC).
                    </div>
                  ) : null}
                  {cso.error ? <div className={ERR}>{noEmoji(cso.error).slice(0, 130)}</div> : null}
                </div>
              ) : <div className="text-white/50 mt-1">Belum ada data — klik tombol di bawah</div>}
              <div className={SEP}>
                <b className="text-pink-200">ACC EMAIL</b>
                <div className="text-white/60 text-[11px] mt-0.5">2 grup, draf beda: user vakum (pernah upload) &amp; belum pernah upload</div>
                <button className={`${BTNR} w-full mt-1.5`} style={{ opacity: P.acc === 'busy' ? 0.5 : 1 }} disabled={P.acc === 'busy'}
                  onClick={async () => { P.setAcc('busy'); const r = await call('acc-email', 'POST'); P.setAcc(r) }}>
                  {P.acc === 'busy' ? 'Mengirim...' : 'ACC EMAIL ke 2 Grup User'}
                </button>
                {P.acc && P.acc !== 'busy' && (P.acc.dup
                  ? <div className={OKS}>ACC EMAIL sudah dicatat hari ini — besok lagi.</div>
                  : P.acc.ok ? <div className={OKS}>ACC tercatat{typeof P.acc.emailsSent === 'number' && P.acc.emailsSent >= 0 ? ` — ${P.acc.emailsSent} email terkirim${typeof P.acc.sentDormant === 'number' ? ` (${P.acc.sentDormant} vakum + ${P.acc.sentNever} belum upload, draf beda)` : ' (Resend)'}` : ' — set RESEND_API_KEY utk kirim otomatis'}.</div>
                  : <div className={ERR}>{noEmoji(P.acc.error || 'gagal').slice(0, 140)}</div>)}
              </div>
              <div className={SEP}>
                <b className="text-teal-200">Mode Otomatis (AUTO-ACC)</b>
                <div className="text-white/60 text-[11px] mt-0.5">
                  {autoacc === undefined ? 'memuat status...' : autoacc
                    ? 'AKTIF — CSO kirim email ke 2 grup user (vakum & belum upload) OTOMATIS tiap briefing 08:00. Kamu nggak perlu klik apa-apa.'
                    : 'OFF — kamu harus klik ACC EMAIL manual tiap hari. Nyalakan biar karyawan kerja sendiri.'}
                </div>
                <button className={`w-full mt-1.5 text-[12px] px-3 py-2 rounded-xl cursor-pointer border transition-colors ${autoacc ? 'border-emerald-300/40 bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/25' : 'border-white/15 bg-white/5 text-white/60 hover:bg-white/10'}`} disabled={busy}
                  onClick={async () => { await call('auto-acc&on=' + (autoacc ? '0' : '1'), 'POST') }}>
                  {autoacc ? 'Matikan AUTO-ACC' : 'Nyalakan AUTO-ACC (sekali klik, permanen)'}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button className={BTN} onClick={() => call('agents&only=cso')}>Hitung Ulang</button>
              </div>
              <div className={SEP}>
                <b className="text-pink-200">Diskusi CSO × CMO</b>
                <div className="text-white/60 text-[11px] mt-0.5 leading-relaxed">
                  Maya ngobrol sama Sinta (CMO) bawa data nyata: kenapa user daftar tapi males upload jurnal → langsung jadi skrip konten TikTok.
                </div>
                <button className={`${BTNR} w-full mt-1.5`} disabled={busy}
                  onClick={async () => { const r = await call('talk', 'POST'); if (r?.talkError) (window as any).__kceo?.toast?.(String(r.talkError).slice(0, 90)) }}>
                  Ngobrol sama CMO &amp; Bikin Skrip
                </button>
                {talk && talk.diagnosis ? (
                  <div className="mt-2">
                    <div className="rounded-xl bg-pink-400/10 border border-pink-300/20 px-2 py-1.5 text-[11px] leading-relaxed">
                      <b>Diagnosa:</b> {noEmoji(talk.diagnosis)}
                    </div>
                    {talk.intel && (
                      <div className="mt-1 text-[10px] leading-relaxed text-white/70 bg-white/5 rounded-lg px-1.5 py-1">
                        <b>Data nyata yang Maya bawa ke meja rapat:</b> {talk.intel.total} pendaftar · {talk.intel.active7d} aktif 7 hr · {talk.intel.passive} pasif · <b className="text-pink-300">{talk.intel.baruTakAktif} pendaftar baru belum pernah upload</b>{(talk.intel.bug7d ?? -1) >= 0 ? <span> · {talk.intel.bug7d} bug 7 hr</span> : null}
                      </div>)}
                    {talk.dupToday ? <div className="text-white/40 text-[9.5px] mt-0.5">udah diskusi hari ini — ini hasil terakhir (briefing 08:00 juga jalanin otomatis)</div> : null}
                    {Array.isArray(talk.reasons) && talk.reasons.length > 0 && (
                      <div className="mt-1 text-[10.5px] leading-relaxed text-white/75">
                        <b>Alasan teratas user:</b>
                        <ul className="m-0 mt-0.5 pl-4 list-disc">{talk.reasons.map((r: string, i: number) => <li key={i}>{noEmoji(r)}</li>)}</ul>
                      </div>)}
                    <div className="mt-1.5 max-h-44 overflow-y-auto kscroll flex flex-col gap-1">
                      {(talk.dialog || []).map((d: any, i: number) => (
                        <div key={i} className={`max-w-[90%] rounded-lg px-2 py-1 text-[10.8px] leading-relaxed ${d.who === 'CSO' ? 'self-start bg-pink-400/10' : 'self-end bg-violet-400/10'}`}>
                          <b className={`text-[9.5px] ${d.who === 'CSO' ? 'text-pink-300' : 'text-violet-300'}`}>{d.who === 'CSO' ? 'Maya · CSO' : 'Sinta · CMO'}</b><br />{d.text}
                        </div>))}
                    </div>
                    {talk.script?.hook && (
                      <div className="mt-1.5 border border-dashed border-violet-300/35 rounded-lg px-2 py-1.5 text-[10.8px] leading-relaxed">
                        <b className="text-violet-300">Skrip Konten Hasil Rapat</b><br />
                        <b>HOOK:</b> {talk.script.hook}<br />
                        <b>ISI:</b> {talk.script.body}<br />
                        <b>CTA:</b> {talk.script.cta}
                        <div className="mt-1 flex gap-1.5 items-center">
                          <button className={`${BTN} text-[10px] px-2 py-1`} onClick={async () => { try { await navigator.clipboard.writeText(`HOOK: ${talk.script.hook}\n\nISI: ${talk.script.body}\n\nCTA: ${talk.script.cta}`); P.setTalkCopied(true); setTimeout(() => P.setTalkCopied(false), 1800) } catch { } }}>Salin Skrip</button>
                          {P.talkCopied ? <span className="text-emerald-300 text-[10px]">tersalin</span> : null}
                        </div>
                      </div>)}
                    {talk.provider === 'openrouter' ? <div className="text-white/40 text-[9.5px] mt-0.5">via OpenRouter (model resmi Maya)</div> : talk.provider === 'fallback' ? <div className="text-white/40 text-[9.5px] mt-0.5">Maaf Bos, server staf AI sedang sibuk. Laporan riil sudah ditarik, tapi AI gagal merangkai kata. Coba beberapa saat lagi.</div> : talk.provider === 'gemini' ? <div className="text-white/40 text-[9.5px] mt-0.5">via Gemini (cadangan)</div> : null}
                  </div>
                ) : <div className="text-white/45 text-[10.5px] mt-1.5">Belum ada diskusi — klik tombol di atas. Hasil juga otomatis dibuat tiap briefing 08:00 &amp; dikirim ke Discord.</div>}
              </div>
            </div>
          ) : room === 'CMO' ? (
            /* ============ RUANG CMO — Marketing & Copywriter ============ */
            <div className={`${PANEL} p-4 text-[12px] text-white/85 leading-relaxed`}>
              <div className="text-[15px] font-bold text-violet-300 mb-0.5">RUANG CMO</div>
              <div className="text-white/50 text-[11px] mb-3">Marketing &amp; Copywriter AI · Draf TikTok</div>
              <GodChip id="CMO" />
              {cmo ? (
                <div>
                  {cmoDrafts.length > 1 ? (
                    <div className="flex gap-1.5 mb-1.5">
                      {cmoDrafts.map((_: string, i: number) => (
                        <button key={i} onClick={() => setCmoVar(i)} aria-label={`Lihat draf ${i + 1}`}
                          className={`text-[10.5px] px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${cmoVar === i ? 'border-violet-300/50 bg-violet-400/20 text-violet-100' : 'border-white/15 bg-white/5 text-white/55 hover:bg-white/10'}`}>
                          Draf {i + 1}{i === 0 ? ' · utama' : ''}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="rounded-xl bg-violet-400/10 border border-violet-300/20 p-2.5 whitespace-pre-wrap text-[12px] max-h-52 overflow-y-auto kscroll leading-relaxed text-white/90">{cmoCur || cmo.error || '—'}</div>
                  {cmo.usedFallback ? <div className="text-white/40 mt-1 text-[11px]">(server AI sedang sibuk — pakai draf cadangan dari data riil, mohon revisi manual)</div> : null}
                  {cmo.provider === 'openrouter' ? <div className="text-amber-300 mt-1 text-[11px]">OpenRouter — model resmi Sinta{cmo.model ? `: ${cmo.model}` : ''}</div> : null}
                  {cmo.provider === 'gemini' ? <div className="text-white/40 mt-0.5 text-[10.5px]">via Gemini (cadangan terakhir)</div> : null}
                  {cmo.basedOn === 'tiktok' ? <div className="text-violet-300 text-[10.5px] mt-0.5">Dianalisis dari {cmo.analyzedPosts} konten TikTok asli lo — pola pemenang ditiru</div> : null}
                  {cmo.posted ? (cmo.posted.posted
                    ? <div className="text-emerald-300 text-[10.5px] mt-0.5">Tayang NYATA di {cmo.posted.platform === 'instagram' ? 'Instagram' : 'Facebook'} (Graph API)</div>
                    : <div className="text-amber-300/80 text-[10.5px] mt-0.5 leading-relaxed max-w-full break-words" title={String(cmo.posted.reason || '')}>Auto-post belum jalan: {String(cmo.posted.reason || '').slice(0, 260)}</div>) : null}
                </div>
              ) : <div className="text-white/50 mt-1">Belum ada draf — klik tombol Buat Draf di bawah</div>}
              <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                <button className={BTNP} onClick={() => call('agents&only=cmo')}>Buat 3 Draf Baru</button>
                <button className={BTN} disabled={!cmoCur} onClick={async () => { try { await navigator.clipboard.writeText(cmoCur); P.setCopied(true); setTimeout(() => P.setCopied(false), 1800) } catch { } }}>Salin Draf Ini</button>
                <button className={BTN} title="Posting NYATA draf utama hari ini ke Instagram/Facebook via Meta Graph API" onClick={() => call('cmo-post')}>Post IG/FB</button>
                {P.copied ? <span className="text-emerald-300 text-[11px]">tersalin</span> : null}
              </div>
              <div className="mt-3 pt-3 border-t border-violet-300/15">
                <b className="text-violet-200 text-[12px]">Bahan Analisis TikTok ({P.tt.length})</b>
                <div className="text-white/50 text-[10.5px] mt-0.5 leading-relaxed">Paste link TikTok lo + views/likes — caption diambil OTOMATIS. CMO pelajari 5 konten terbaik tiap bikin draf: makin banyak bahan, makin pintar.</div>
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  <input value={P.ttUrl} onChange={e => P.setTtUrl(e.target.value)} placeholder="Link TikTok (vt.tiktok.com/… atau www.tiktok.com/@lo/video/…)" className={`${INPUT} flex-1 min-w-0`} style={{ flex: '1 1 150px' }} />
                  <input value={P.ttViews} onChange={e => P.setTtViews(e.target.value)} placeholder="views" inputMode="numeric" className={INPUT} style={{ width: 62 }} />
                  <input value={P.ttLikes} onChange={e => P.setTtLikes(e.target.value)} placeholder="likes" inputMode="numeric" className={INPUT} style={{ width: 62 }} />
                  <button className={`${BTNP} text-[11.5px]`} style={{ opacity: P.ttBusy ? 0.5 : 1 }} disabled={P.ttBusy || !P.ttUrl.trim()} onClick={P.ttAdd}>{P.ttBusy ? '...' : 'Tambah'}</button>
                </div>
                {P.ttMsg ? <div className={`text-[10.5px] mt-1 ${P.ttMsg.indexOf('gagal') >= 0 ? 'text-red-300' : 'text-emerald-300'}`}>{noEmoji(P.ttMsg)}</div> : null}
                {P.tt.length ? (
                  <div className="mt-1.5 max-h-36 overflow-y-auto kscroll flex flex-col gap-1">
                    {P.tt.map((p) => (
                      <div key={p.id} className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1">
                        <div className="flex-1 min-w-0">
                          <div className="text-[10.5px] text-white/85 whitespace-nowrap overflow-hidden text-ellipsis">{p.caption || p.url}</div>
                          <div className="text-[9.5px] text-white/45">{Number(p.views || 0).toLocaleString('id-ID')} views · {Number(p.likes || 0).toLocaleString('id-ID')} likes</div>
                        </div>
                        <button className="text-white/40 hover:text-red-300 transition-colors cursor-pointer p-1" aria-label="Hapus bahan" disabled={P.ttBusy} onClick={() => P.ttDel(p.id)}><Trash2 size={12} /></button>
                      </div>
                    ))}
                  </div>
                ) : <div className="text-[10.5px] text-white/40 mt-1">Belum ada bahan — CMO masih pakai referensi statis TIKTOK_REFERENCE.</div>}
              </div>
              <div className="text-white/40 text-[10.5px] mt-3 leading-relaxed">
                3 draf pilihan/hari (1 panggilan model — Bos pilih yang paling pas) · Rotasi angle harian<br />
                Histori 5 draf utama terakhir disimpan (anti repetisi)<br />
                Bahan TikTok lo = acuan utama — isi terus biar draf makin mirip konten yang FYP
              </div>
            </div>
          ) : room === 'struktur' ? (
            /* ============ RUANG STRUKTUR — Jabatan & Pekerjaan Tiap Karyawan ============ */
            <div className={`${PANEL} p-4 text-[12px] text-white/85 leading-relaxed`}>
              <div className="text-[15px] font-bold text-white mb-0.5">STRUKTUR TIM AI</div>
              <div className="text-white/50 text-[11px] mb-3 leading-relaxed">
                Jabatan, pekerjaan &amp; jadwal tiap karyawan — plus <b className="text-amber-300">batas kemampuan yang jujur</b>, biar Bos bisa menilai apa yang kurang dan layak ditambah. Klik karyawan untuk status kerja live, detail tugas &amp; memori kerjanya.
              </div>
              <div className="max-h-[34vh] overflow-y-auto kscroll pr-0.5">
                {TEAM_DETAIL.map(m => (
                  <EmployeeCard
                    key={m.id}
                    m={m}
                    open={openStaff === m.id}
                    onToggle={() => setOpenStaff(openStaff === m.id ? null : m.id)}
                    live={liveOf(m.id)}
                    preLaunch={preLaunch}
                  />
                ))}
                <div className="rounded-2xl border border-dashed border-amber-300/40 bg-amber-400/5 px-3 py-2.5 text-[10.5px] leading-relaxed mb-1">
                  <b className="text-amber-300">Sisa kursi kosong (opini jujur):</b>
                  <ul className="m-0 mt-1 p-0 list-none flex flex-col gap-1">
                    <li className="flex gap-1.5"><span className="text-amber-300/70 shrink-0" aria-hidden="true">–</span><span className="text-white/75"><b>Support Closer</b> — CS bot chat (/api/chat) sudah jawab pertanyaan user, tapi belum ada yang follow-up penyelesaian bug ke user pelapor sampai tuntas</span></li>
                    <li className="flex gap-1.5"><span className="text-amber-300/70 shrink-0" aria-hidden="true">–</span><span className="text-white/75"><b>Eksekusi A/B test otomatis</b> — eksperimen landing masih perlu eksekusi tangan Bos (belum ada mesin A/B otomatis)</span></li>
                  </ul>
                  <div className="mt-1.5 text-white/70">Ramping 15-11: kursi DA/GH/CFO/COO/Growth Hunter dipensiunkan — tugas inti menempel ke divisi <b>Luxtradee Growth</b> (Maya+Sinta) &amp; Raka. Kursi bisa dibuka lagi kalau data menunjukkan perlu.</div>
                </div>
                <div className="text-white/40 text-[10px] leading-relaxed">
                  Semua jadwal jalan otomatis via Cloudflare Cron bawaan — tanpa cron-job.org.<br />
                  Mau pindahkan tugas antar karyawan, ubah jadwal, atau tambah kursi baru? Bilang saja, Bos.
                </div>
              </div>
            </div>
          ) : null}
          {/* PATCH C — artefak karyawan ruangan ini (barang jadi, bisa disalin Bos) */}
          {ROOM_ROLE[room] && phaseData ? <RoleArtifacts role={ROOM_ROLE[room]} artifacts={phaseData.artifacts} /> : null}
        </div>

        {/* ===== HORIZONTAL AGENT DOCK — scroll menyamping, snap ===== */}
        <div ref={dockRef} className="kdock shrink-0 flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory -mx-1 px-1 pt-1">
          {DOCK.map(a => {
            const active = room === a.id
            return (
              <button
                key={a.id}
                data-dock={a.id}
                onClick={() => pick(a.id)}
                aria-label={`Masuk ruangan ${a.name}`}
                className={`min-w-[80%] sm:min-w-[340px] snap-center bg-white/5 border rounded-2xl p-4 flex flex-col gap-2 text-left cursor-pointer transition-all duration-200 ${active ? 'border-white/40 bg-white/10 shadow-[0_0_0_1px_rgba(255,255,255,.18),0_10px_34px_rgba(0,0,0,.45)]' : 'border-white/10 hover:bg-white/10 hover:border-white/20'}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/10 border border-white/15 grid place-items-center text-[17px] font-bold text-white/85 shrink-0" aria-hidden="true">{a.name.charAt(0)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-white text-sm font-semibold leading-tight truncate">{a.name}</div>
                    <div className="text-white/50 text-[11px] leading-tight truncate">{a.role}</div>
                  </div>
                  <Dot tone={a.has ? 'ok' : 'idle'} />
                </div>
                <div className="text-white/70 text-xs leading-relaxed">{a.live}</div>
                <div className={`text-[11px] flex items-center gap-1 ${active ? 'text-white' : 'text-white/40'}`}>
                  {active ? 'Ruangan ini terbuka' : <>Masuk Ruangan <span aria-hidden="true">→</span></>}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
