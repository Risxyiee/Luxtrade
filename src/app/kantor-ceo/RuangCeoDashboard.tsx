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
// Semua logika bisnis (state, call API, antrean COO, bahan TikTok)
// tetap tinggal di KantorCeo3D.tsx — komponen ini presentational + toggle sheet.
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { Sparkles, X } from 'lucide-react'

/* ============================================================
   STRUKTUR & JABATAN TIM AI — data lengkap untuk Ruang Struktur.
   Sumber kebenaran: kode /api/ceo-agent, /api/cron/ai-coo-agent,
   /api/admin/ai-staff & worker-entry.ts (jadwal cron Cloudflare).
   Batas kemampuan ditulis JUJUR supaya Bos bisa menilai gap tim.
   ============================================================ */
const TEAM_DETAIL = [
  {
    id: 'COO', emoji: '💼', name: 'Bagas', jabatan: 'COO · Chief Operating Officer', divisi: 'Divisi Jualan & Monetisasi', color: '#059669',
    shift: 'Cron harian 08:00 WIB (slot 0 1 * * * UTC) · ACC Bos kapan pun di Ruang COO',
    baca: 'profiles (free user + email) · trades 7 hari per user · ai_pending_tasks (riwayat kontak)',
    tugas: [
      'Pilih maks 3 free user paling aktif 7 hari = hot lead (sudah ketagihan produk, paling siap upgrade)',
      'Racik email penawaran PRO personal via model resminya: Llama 3.1 8B (OpenRouter) → Groq/Gemini cadangan → templat',
      'Simpan draf sebagai task PENDING → tunggu ACC Bos di Ruang COO (human-in-the-loop)',
      'Setelah ACC: email terkirim via Resend, status dicatat untuk pengukuran konversi',
      '⭐ FOLLOW-UP OPEN-RATE: lead yang BUKA email tapi belum PRO (deteksi via webhook Resend /api/webhooks/resend) otomatis dapat draf follow-up berisi kupon diskon terkontrol (env COUPON_PERCENT, default 20%) — anti-spam 1×/7 hari, bounce tidak di-email lagi',
    ],
    lapor: 'Ringkasan 24 jam di briefing 08:00 · % konversi penawaran→PRO & open-rate email di laporan mingguan Senin 10:00',
    batas: [
      'Maks 3 lead/hari & 1 lead cuma dikontak 1× per 7 hari (anti-spam)',
      'Tidak bisa membalas reply dari lead — itu tetap tangan Bos',
      'Open-rate cuma terlihat setelah webhook dipasang: resend.com → Webhooks → https://luxtradee.web.id/api/webhooks/resend',
    ],
    ide: 'A/B subject email otomatis (butuh volume pengiriman lebih besar) · skor lead dari jumlah klik · diskon bertingkat per tingkat ketertarikan',
  },
  {
    id: 'CTO', emoji: '🖥️', name: 'Raka', jabatan: 'CTO · Chief Technology Officer', divisi: 'IT, QA & Keamanan', color: '#0d9488',
    shift: 'Watchdog tiap 15 menit 24/7 · QA sweep + laporan di briefing 08:00 WIB',
    baca: 'Ping https://luxtradee.web.id · bug_reports · riwayat uptime (agent_kv) · env diagnostik',
    tugas: [
      'Ping situs tiap 15 menit — DOWN → alarm Discord instan (dedup 30 mnt), pulih → kabari sekali',
      'Bug baru masuk → triage pakai model resminya (Qwen 2.5 Coder via OpenRouter): 3 bug terakhir diringkas jadi diagnosa + prioritas P1/P2/P3',
      'QA otomatis 15 route utama tiap briefing pagi — 12 halaman + 3 ENDPOINT KRITIS API (jurnal trades, evaluasi AI screenshot, CS chat): 401/405 = hidup & terjaga, 5xx/timeout dilaporkan',
      'Diagnostik env & tes query Supabase (tombol 🩺 Diagnostik di Ruang CTO)',
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
    id: 'CSO', emoji: '👥', name: 'Maya', jabatan: 'CSO · Chief Customer Success Officer', divisi: 'Customer Success & Retensi', color: '#be185d',
    shift: 'Hitung user di briefing 08:00 · email pasif otomatis 1×/hari (kalau AUTO-ACC on) · rapat dengan CMO 1×/hari',
    baca: 'profiles (total pendaftar) · trades 24 jam (siapa aktif) · agent_kv csmailed: (siapa sudah di-email) · bug_reports 7 hari (keluhan)',
    tugas: [
      'Hitung pendaftar / aktif 24 jam / pasif tiap pagi — tampil di briefing & panel Ruang CSO',
      '⭐ SKOR RISIKO CHURN: hitung user yang pernah aktif 30 hari tapi 3 hari terakhir diam → kandidat win-back dilaporkan tiap pagi (briefing + panel Ruang CSO)',
      'Kirim EMAIL PERSONAL ke maks 50 user pasif: nada email diracik model resminya (Gemma 2 9B via OpenRouter, rotasi 3 variasi), pembuka per user dari data trading asli (nama, jumlah trade, pair favorit, win rate catatan, berapa hari lalu upload)',
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
    id: 'CMO', emoji: '📣', name: 'Sinta', jabatan: 'CMO · Chief Marketing Officer', divisi: 'Marketing & Konten', color: '#7c3aed',
    shift: 'Draf TikTok di briefing 08:00 atau kapan pun tombol "Buat Draf Baru" ditekan',
    baca: 'tiktok_posts (top 5 konten Bos urut views) · hasil rapat Maya×Sinta (alasan churn) · env TIKTOK_REFERENCE (cadangan) · histori 5 draf terakhir',
    tugas: [
      'Analisis pola konten TikTok asli yang paling perform (hook, topik, gaya) → tiru polanya di draf baru',
      '⭐ 3 DRAF PILIHAN/hari via 1 panggilan model resminya GLM-4.7-Flash (OpenRouter) — 3 pendekatan berbeda, Bos tinggal pilih yang paling pas di Ruang CMO',
      'Draf wajib menjawab alasan churn dari rapat Maya (bukan sekadar ikut angle rotasi)',
      'Rantai model: GLM-4.7-Flash → GLM-4-Flash → Gemini → templat statis (draf tidak pernah kosong)',
      'Ikut rapat harian sama Maya: ubah akar masalah churn jadi skrip konten anti-churn',
    ],
    lapor: '3 draf di panel Ruang CMO (pilih → salin) + draf utama & sumber analisis di briefing 08:00 · skrip rapat di Ruang CSO',
    batas: [
      'Tidak tahu performa SETELAH posting — views/likes berubah hanya kalau Bos update manual di Ruang CMO',
      'Tidak bisa posting ke TikTok otomatis (butuh API resmi TikTok)',
    ],
    ide: 'Refresh views otomatis via oEmbed mingguan · bank hook yang terbukti FYP · draf video lengkap dengan ide visual per scene',
  },
  {
    id: 'CFO', emoji: '💰', name: 'Putri', jabatan: 'CFO · Chief Financial Officer', divisi: 'Anggaran API & Biaya', color: '#b45309',
    shift: 'Cek kuota di briefing 08:00 + watchdog 15 menit (alarm di 80%)',
    baca: 'agent_kv quota: (Gemini Vision) · email: (Resend) · quota429: (event rate-limit) · profiles is_pro (pendapatan)',
    tugas: [
      'Satu-satunya karyawan TANPA LLM — 100% matematika hardcoded (SOP Bos): tidak bisa halusinasi angka',
      'Pantau kuota Gemini Vision harian (limit ±1.400) & kuota email Resend (100/hari)',
      'Gerbang quota-track: setiap evaluasi upload user dicek dulu — kuota habis → ditunda (anti-429)',
      'Alarm Discord 1×/hari kalau pemakaian ≥80%',
      '⭐ LAPORAN PENDAPATAN: hitung user PRO (is_pro) × harga paket bulanan (env PRO_PRICE_IDR, default 49.000) → estimasi MRR bulanan + progres target (env MRR_TARGET_IDR) — tampil di briefing & Ruang CFO',
      'Laporan pemakaian 7 hari di laporan mingguan',
    ],
    lapor: 'Baris kuota + pendapatan MRR di briefing & panel Ruang CFO · alarm instan di 80% · rekap 7 hari mingguan',
    batas: [
      'Pendapatan = estimasi (PRO × harga paket bulanan) — belum hitung paket 6 bulanan/lifetime & biaya server',
      'Limit & harga diambil dari env, bukan dibaca langsung dari billing Gemini/Resend/Supabase',
    ],
    ide: 'Baca billing asli Gemini/Resend/Supabase (butuh API billing masing-masing) · banding biaya API vs revenue per bulan · laporan pajak dasar',
  },
  {
    id: 'DA', emoji: '📊', name: 'Dewi', jabatan: 'Data Analyst · Analis Pola Trading', divisi: 'Data & Insight', color: '#0891b2',
    shift: 'Analisis mendalam tiap Senin 10:00 WIB (cron mingguan) · kapan pun lewat tombol di Ruang Data Analyst',
    baca: 'trades 30 hari terakhir (maks 1.000 terbaru): symbol, profit_loss, session, user_id, created_at, emotion (self-report user)',
    tugas: [
      'Hitung statistik NYATA: total upload, trader unik, win rate agregat, pair favorit, sesi & jam tersibuk',
      '⭐ KORELASI EMOSI vs PROFIT: win rate per emosi (self-report saat upload, min 5 sampel/emosi) — emosi paling untung & paling rugi → bahan edukasi psikologi trading',
      'Ubah angka mentah jadi insight 2 kalimat + 3 pola yang tidak terlihat kasat mata',
      'Beri 3 rekomendasi konkret yang bisa dieksekusi Bos minggu ini (produk/konten/retensi)',
      'Evaluasi rekomendasi minggu lalu dengan data terbaru — learning loop, bukan analisis amnesia',
    ],
    lapor: 'Pesan Discord terpisah tiap Senin 10:00 WIB + panel Ruang Data Analyst (insight + emosi dipakai CMO & Growth Hacker)',
    batas: [
      'Data cuma 30 hari terakhir, maks 1.000 trade terbaru — bukan seluruh sejarah',
      'Tidak menyentuh data pribadi sensitif — hanya pola agregat',
      'Rekomendasi tetap usulan — eksekusi di tangan Bos & karyawan lain',
    ],
    ide: 'Prediksi trader yang mau churn (butuh histori lebih panjang) · skor kualitas setup (butuh label setup yang konsisten)',
  },
  {
    id: 'GH', emoji: '🚀', name: 'Farhan', jabatan: 'Growth Hacker · Eksperimen Pertumbuhan', divisi: 'Growth & Eksperimen', color: '#ea580c',
    shift: 'Rancang eksperimen tiap Senin 10:00 WIB (cron mingguan) · kapan pun lewat tombol di Ruang Growth',
    baca: 'Funnel profiles: pendaftar, PRO, pendaftar 7 hari, user dari referral (referred_by_code), onboarding selesai, aktivasi (upload trade) + insight Dewi (DA)',
    tugas: [
      'Ukur funnel nyata: pendaftar → aktivasi (upload trade pertama) → PRO → referral',
      '⭐ A/B TEST CTA LANDING OTOMATIS: pengunjung dibagi 50/50 ke 2 varian teks tombol CTA (localStorage bucket), view & klik terukur via /api/ab-track → pemenang mingguan dilaporkan CEO & tampil di panel ini',
      'Temukan titik bocor terbesar (mis. aktivasi rendah, referral sepi)',
      'Usulkan 3 eksperimen minggu ini: nama, langkah konkret, metrik keberhasilan, estimasi effort',
      'Selipkan angle promosi program affiliate/referral ke eksperimennya',
    ],
    lapor: 'Pesan Discord terpisah tiap Senin 10:00 WIB + panel Ruang Growth (funnel + hasil A/B live)',
    batas: [
      'A/B cuma 2 varian teks CTA di landing — varian baru = edit kode (keputusan tetap lewat ACC Bos)',
      'Metrik terbatas data yang ada (open-rate email di sisi Bagas; belum ada analitik landing mendetail)',
      'Tidak mengubah landing/harga sendiri — semua lewat ACC Bos',
    ],
    ide: 'Integrasi analitik landing lengkap (butuh analytics engine) · A/B di halaman lain (pricing, blog) · program reward referral 2 arah · notifikasi win-back',
  },
  {
    id: 'CEO', emoji: '👔', name: 'Alexander', jabatan: 'CEO · Kepala Semua Agen', divisi: 'Eksekutif', color: '#94a3b8',
    shift: 'Briefing 08:00 WIB harian · laporan mingguan Senin 10:00 WIB',
    baca: 'Semua laporan agen (CTO/CSO/CMO/CFO/COO + Dewi DA & Farhan GH) + status AUTO-ACC + 🧠 Memori Kantor',
    tugas: [
      'Kumpulkan laporan semua karyawan jadi Morning Briefing satu pesan → dirapikan model resminya (Llama 3.1 8B via OpenRouter) → kirim ke Discord 08:00',
      'Pilih 1 NEXT BEST ACTION tiap pagi pakai modelnya sendiri — prioritas tunggal yang HANYA Bos bisa kerjakan hari ini (Discord pesan terpisah)',
      'Ingatkan PRIORITAS KEMARIN di briefing — akuntabilitas: dilakukan, atau ganti dengan alasan jelas',
      '⭐ NBA OKE/NOT OKE: Bos jawab prioritas hari ini via tombol Ruang Rapat ATAU slash command Discord /nba-oke · /nba-not → dicatat ke memori & briefing besok menghormati jawaban itu',
      '⭐ CHAT 2 ARAH Discord: Bos ketik /bos <pesan> → Alexander jawab langsung (route /api/discord-interactions, mode Interactions — bukan Gateway, kompatibel Workers) dengan konteks briefing terakhir',
      '⭐ RINGKASAN SUARA: tombol 🔊 Bacakan Briefing di Ruang Rapat — laporan pagi dibacakan suara browser (TTS lokal, tanpa API key)',
      'Catat keputusan & kesimpulan penting ke 🧠 Memori Kantor — semua karyawan membaca catatan ini (tim belajar bersama)',
      'Jalankan AUTO-ACC email CSO otomatis tiap pagi (default ON — toggle AUTO-ACC untuk mematikan) · Dewi & Farhan lapor HARIAN jam 08:00 (dulu cuma Senin)',
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

/* Warna aksen versi TERANG — terbaca di atas glass gelap */
const BRIGHT: Record<string, string> = {
  '#059669': '#34d399', '#0d9488': '#2dd4bf', '#be185d': '#f472b6', '#7c3aed': '#a78bfa',
  '#b45309': '#fbbf24', '#0891b2': '#22d3ee', '#ea580c': '#fb923c', '#334155': '#cbd5e1', '#94a3b8': '#cbd5e1',
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

/* ============================================================
   🔊 TTS BRIEFING — ringkasan laporan bentuk suara (bonus Alexander).
   100% browser (Web Speech API) — tanpa API key, tanpa kuota.
   ============================================================ */
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
const INPUT = 'bg-white/10 border border-white/15 rounded-lg text-white placeholder-white/35 text-[11.5px] px-2 py-1.5 outline-none focus:border-white/35 transition-colors'
const PANEL = 'bg-white/5 border border-white/10 rounded-2xl'

/* titik status kecil bercahaya */
function Dot({ tone }: { tone: 'ok' | 'busy' | 'idle' }) {
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${tone === 'ok' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.8)]' : tone === 'busy' ? 'bg-amber-300 animate-pulse shadow-[0_0_8px_rgba(252,211,77,.8)]' : 'bg-white/25'}`} />
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
  cooTasks: any[]
  cooLoading: boolean
  cooDrafts: Record<string, { subject: string; body: string }>
  setCooDrafts: (fn: (p: Record<string, { subject: string; body: string }>) => Record<string, { subject: string; body: string }>) => void
  cooActing: string | null
  cooAct: (t: any, kind: 'approve' | 'reject') => void
  cooLoad: (silent?: boolean) => void
}

export default function RuangCeoDashboard(P: RuangCeoDashboardProps) {
  const { room, setRoom, busy, data, call } = P
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [cmoVar, setCmoVar] = useState(0)
  const [speaking, setSpeaking] = useState(false)
  const dockRef = useRef<HTMLDivElement>(null)

  /* 🔊 Bacakan/berhentikan briefing (suara browser, lang id-ID) */
  const toggleSpeak = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return }
    const u = new SpeechSynthesisUtterance(stripMarkdownForSpeech(String(data?.text || '')).slice(0, 3200))
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

  const cto = data?.cto, cso = data?.cso, cmo = data?.cmo, cfo = data?.cfo
  const coo = data?.coo, talk = data?.talk, da = data?.da, gh = data?.gh
  const daError = data?.daError, ghError = data?.ghError
  const autoacc = data?.autoacc
  const fmtIdr = (n: number) => Number(n || 0).toLocaleString('id-ID')
  /* Draf CMO aktif — dukung 3 draf pilihan (baru) & 1 draf (cache lama) */
  const cmoDrafts: string[] = Array.isArray(cmo?.drafts) && cmo.drafts.length ? cmo.drafts : cmo?.draft ? [cmo.draft] : []
  const cmoCur = cmoDrafts[Math.min(cmoVar, cmoDrafts.length - 1)] || ''

  /* ---------- Horizontal Agent Dock — status langsung dari data agen ---------- */
  const trunc = (s: string, n: number) => (s && s.length > n ? s.slice(0, n) + '…' : s)
  const DOCK = [
    { id: 'rapat', emoji: '👔', name: 'Alexander', role: 'CEO · Ruang Rapat', live: data?.nba?.text ? '🎯 NBA hari ini siap' : data?.mem?.length ? `🧠 ${data.mem.length} catatan memori kantor` : 'Briefing 08:00 WIB otomatis', has: !!(data?.nba || data?.mem) },
    { id: 'CTO', emoji: '🖥️', name: 'Raka', role: 'CTO · IT & QA', live: cto ? `Web ${cto.siteOk ? '✅' : '❌'} · Bug 24 jam ${cto.bugs24h >= 0 ? cto.bugs24h : '?'}` : 'Watchdog tiap 15 menit', has: !!cto },
    { id: 'CSO', emoji: '👥', name: 'Maya', role: 'CSO · Customer Success', live: cso ? `Total ${cso.total ?? '—'} · Aktif ${cso.active ?? '—'} · ⚠️ churn ${cso.churnRisk ?? 0}` : 'Email pasif + riset churn', has: !!cso },
    { id: 'CMO', emoji: '📣', name: 'Sinta', role: 'CMO · Konten TikTok', live: cmo?.drafts?.length > 1 ? '3 draf hari ini siap ✅ — Bos tinggal pilih' : cmo?.draft ? 'Draf hari ini siap ✅' : 'Belum ada draf hari ini', has: !!cmo },
    { id: 'CFO', emoji: '💰', name: 'Putri', role: 'CFO · Kuota & Pendapatan', live: cfo ? `${cfo.usedToday ?? '—'}/${cfo.limit} hari ini · est. MRR Rp${fmtIdr(cfo.estMRR || 0)}` : 'Gerbang anti-429 + laporan MRR', has: !!cfo },
    { id: 'COO', emoji: '💼', name: 'Bagas', role: 'COO · Jualan', live: coo ? (coo.pending > 0 ? `${coo.pending} draf nunggu ACC ⏳` : 'Antrean jualan bersih ✅') : 'Hot lead → email PRO', has: !!coo },
    { id: 'DA', emoji: '📊', name: 'Dewi', role: 'Data Analyst', live: da?.insight ? trunc(String(da.insight), 64) : 'Insight tiap Senin 10:00', has: !!da },
    { id: 'GH', emoji: '🚀', name: 'Farhan', role: 'Growth Hacker', live: gh?.experiments?.length ? `${gh.experiments.length} eksperimen siap dieksekusi` : 'Eksperimen tiap Senin 10:00', has: !!gh },
    { id: 'struktur', emoji: '📋', name: 'Tim AI', role: 'Struktur & Jabatan', live: '8 karyawan · tugas, jadwal & batas kemampuan', has: true },
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
              SUPER AI AGENT · 👤 luxtradee@gmail.com{busy ? <span className="text-amber-200/90"> · ⏳ memproses…</span> : null}
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
            <div className={`${PANEL} p-4 flex flex-col gap-2`}>
              <b className="text-teal-200 text-[13px]">🏢 Kantor CEO — 8 karyawan AI siap</b>
              <div className="text-white/65 text-[11.5px] leading-relaxed">
                Pilih karyawan di dock bawah untuk masuk ruangannya · klik karakter di kantor 3D juga bisa — kamera langsung terbang ke meja dia.
              </div>
              <div className="rounded-xl bg-emerald-400/10 border border-emerald-300/20 px-2.5 py-2 text-[10.5px] leading-relaxed text-emerald-100/90">
                🤖 <b>Karyawan AI tetap kerja 24/7 walau kantor ini tidak dibuka</b> — cron otomatis: briefing 08:00 WIB, watchdog tiap 15 mnt, laporan Senin 10:00. Semua hasil masuk Discord.
              </div>
              <div className="text-white/40 text-[10.5px]">Bagas (COO) · Raka (CTO) · Maya (CSO) · Sinta (CMO) · Putri (CFO) · Dewi (DA) · Farhan (GH) · Alexander (CEO)</div>
            </div>
          ) : room === 'rapat' ? (
            /* ============ RUANG RAPAT — CEO Suite ============ */
            <div className={`${PANEL} p-4 text-[12px] text-white/85 leading-relaxed`}>
              <div className="text-[15px] font-bold text-teal-200 mb-0.5">🌅 RUANG RAPAT</div>
              <div className="text-white/50 text-[11px] mb-3">CEO Suite · Briefing &amp; kontrol utama</div>
              <div className="flex flex-wrap gap-1.5">
                <button className={BTN} disabled={busy} onClick={() => call('briefing', 'POST')}>{busy ? '⏳ Jalan…' : '🌅 Briefing + Discord'}</button>
                <button className={BTN} onClick={() => call('briefing-last')}>📜 Terakhir</button>
                <button className={BTNO} onClick={() => call('discord-test')}>🧪 Tes Discord</button>
                <button className={BTNO} onClick={() => call('email-test')}>🧪 Tes Email</button>
                <button className={BTN} onClick={() => call('watchdog')}>🕵️ Jalankan Watchdog</button>
                <button className={BTNP} onClick={() => call('weekly')}>📊 Laporan Mingguan</button>
                <button className={BTNP} onClick={() => call('discord-setup', 'POST')}>🤖 Daftarkan /bos</button>
              </div>
              {(data && data.ok !== undefined && !data.cto && !data.cso) && (
                <div className={data.ok ? OKS : ERR}>
                  {String(data.message || '').startsWith('Perintah')
                    ? <>🤖 Discord Bot: {data.message}</>
                    : data.id
                      ? <>📬 Tes Email: {data.message} ✅</>
                      : <>🧪 Tes Discord: {data.ok ? 'berhasil — cek channel Discord ✅' : String(data.error || 'gagal').slice(0, 140)}</>}
                  {data.error && Array.isArray(data.setup) && data.setup.length > 0 && (
                    <div className="mt-1 text-[10px] text-white/55 leading-relaxed">
                      {data.setup.map((s: string, i: number) => <div key={i}>{s}</div>)}
                    </div>)}
                </div>)}
              {data?.watch && (
                <div className={OKS}>
                  🕵️ Watchdog: situs {data.siteOk ? '✅ OK' : '❌ DOWN'}{data.quota ? ` · kuota ${data.quota}` : ''} · {data.alerts && data.alerts.length ? `🔔 ${data.alerts.length} alert dikirim ke Discord` : 'semua aman — tanpa alarm'}
                </div>)}
              {data?.nba?.text && (
                <div className="mt-3 rounded-xl bg-violet-400/10 border border-violet-300/20 px-2.5 py-2 text-[11.5px] leading-relaxed">
                  <b className="text-violet-200">🎯 Next Best Action hari ini — pilihan Alexander:</b><br />{data.nba.text}
                  <div className="flex gap-1.5 mt-2">
                    <button className={BTN} onClick={() => call('nba-verdict&verdict=oke', 'POST')}>✅ Oke, dieksekusi</button>
                    <button className={BTNR} onClick={() => call('nba-verdict&verdict=not', 'POST')}>❌ Not oke — ganti</button>
                  </div>
                  {data.verdict ? <div className="text-white/50 text-[10px] mt-1">Jawaban Bos hari ini: {data.verdict === 'oke' ? '✅ OKE — dicatat ke memori & Discord' : '❌ NOT OKE — besok Alexander pilih prioritas baru'}</div> : null}
                </div>)}
              {Array.isArray(data?.mem) && data.mem.length > 0 && (
                <div className="mt-3 rounded-xl bg-cyan-400/10 border border-cyan-300/20 px-2.5 py-2 text-[11px] leading-relaxed">
                  <b className="text-cyan-200">🧠 Memori Kantor — {data.mem.length} catatan terakhir</b>
                  <div className="mt-1 max-h-36 overflow-y-auto kscroll">
                    {data.mem.map((m: any, i: number) => (
                      <div key={i} className="mb-1 pl-2 border-l-2 border-cyan-300/25">
                        <span className="text-white/50">[{String(m.at || '').slice(5, 10)}] <b>{m.who}</b>:</span> {m.text}
                      </div>))}
                  </div>
                  <div className="text-white/40 text-[9.5px] mt-1">Semua karyawan membaca memori ini di tugas berikutnya — tim belajar bersama, bukan kerja amnesia.</div>
                </div>)}
              {data?.text && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <b>Discord:</b> {data.notifySent ? '✅ terkirim' : `❌ ${data.notifyErr || 'gagal — klik 🧪 Tes Discord'}`}
                    <button className={BTNP + ' ml-auto'} onClick={toggleSpeak}>{speaking ? '⏹ Berhenti' : '🔊 Bacakan Briefing'}</button>
                  </div>
                  <div className="whitespace-pre-wrap mt-1.5 text-white/75 text-[11.5px] max-h-52 overflow-y-auto kscroll rounded-lg bg-white/5 border border-white/10 p-2">{data.text}</div>
                </div>)}
              {data?.error && data.text === undefined && data.ok === undefined && <div className={ERR}>⚠️ {String(data.error).slice(0, 200)}</div>}
              <div className={SEP}>
                <b>⚙️ Jadwal Kerja Karyawan — OTOMATIS ✅</b>
                <div className="text-white/60 text-[10.5px] mt-1 leading-relaxed">
                  🌅 <b>Laporan kerja pagi</b> 08:00 WIB tiap hari — QA + CSO + CMO + CFO + COO + AUTO-ACC + 💬 diskusi CSO×CMO + 🎯 NBA + akuntabilitas prioritas kemarin<br />
                  📊 <b>Dewi & Farhan lapor HARIAN</b> 08:00 WIB — analisis trades + eksperimen growth, pesan Discord terpisah<br />
                  🕵️ <b>Watchdog CTO</b> tiap 15 menit 24/7 — situs DOWN / bug baru / kuota 80% → alarm Discord INSTAN<br />
                  📈 <b>Laporan mingguan Senin 10:00 WIB</b> — rekap 7 hari versi CEO — pesan Discord terpisah<br />
                  ⚡ Semua jalan lewat <b>Cloudflare Cron bawaan</b> — tanpa cron-job.org, tanpa setup manual.<br />
                  🏢 Semua karyawan sekarang di kantor ini — halaman /admin/ai-staff sudah pensiun.
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
              <div className="text-[15px] font-bold text-teal-300 mb-0.5">🖥️ RUANG CTO</div>
              <div className="text-white/50 text-[11px] mb-3">IT &amp; QA · Monitor sistem, bug &amp; tes fitur otomatis</div>
              {cto ? (
                <div>
                  <div className="flex gap-2.5 items-center">
                    <span className="text-[22px]">{cto.siteOk ? '✅' : '❌'}</span>
                    <div>
                      <b className="text-white">Website luxtradee.web.id</b><br />
                      <span className="text-white/70">{cto.siteOk ? `${cto.status} OK · ${cto.latencyMs} ms` : `DOWN (${cto.status || 'timeout'})`}</span>
                    </div>
                  </div>
                  <div className={SEP}>
                    <b>Bug 24 jam terakhir</b><br />
                    {cto.bugs24h >= 0
                      ? <span className={`text-[18px] font-bold ${cto.bugs24h > 0 ? 'text-red-300' : 'text-emerald-300'}`}>{cto.bugs24h}</span>
                      : <span className="text-red-300">gagal diambil ⚠️</span>}
                  </div>
                  {cto.upToday !== undefined && (cto.upToday + cto.downToday) > 0 ? (
                    <div className="text-white/65 text-[11px] mt-1">🤖 Watchdog hari ini: <b className="text-emerald-300">{cto.upToday}× OK</b> · <b className={cto.downToday > 0 ? 'text-red-300' : 'text-white/35'}>{cto.downToday}× gagal</b></div>
                  ) : cto.upToday === 0 && cto.downToday === 0 ? <div className="text-white/45 text-[11px] mt-1">🤖 Watchdog belum jalan hari ini — cron 15 mnt (cek Ruang Rapat)</div> : null}
                  {cto.err ? <div className="text-white/45 text-[11px] mt-1">📝 {String(cto.err).slice(0, 130)}</div> : null}
                </div>
              ) : <div className="text-white/50 mt-1">Belum ada data — klik tombol di bawah</div>}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button className={BTN} onClick={() => call('agents&only=cto')}>🔄 Cek Ulang</button>
                <button className={BTNP} onClick={() => call('diag')}>🩺 Diagnostik</button>
                <button className={BTNP} onClick={() => call('qa')}>🧪 Tes Semua Fitur (QA)</button>
                <button className={BTNP} onClick={() => call('e2e')}>🤖 Tes Login + E2E</button>
              </div>
              {data && data.total !== undefined && data.results && (
                <div className={`mt-3 text-[11px] leading-relaxed ${SEP}`}>
                  <b className="text-teal-200">🧪 QA {data.total} fitur — {data.fails && data.fails.length ? `${data.fails.length} MASALAH ⚠️` : 'SEMUA OK ✅'} · rata-rata {data.avgMs} ms</b>
                  <div className="max-h-36 overflow-y-auto kscroll mt-1">
                    {(data.results || []).map((r: any) => (
                      <div key={r.path}>{r.ok ? '✅' : '❌'} <b>{r.path}</b> — {r.label} · {r.status || 'timeout'} ({r.ms} ms){r.err ? <span className="text-red-300"> {r.err}</span> : null}</div>
                    ))}
                  </div>
                  <div className="text-white/40 mt-1">QA jalan otomatis tiap briefing 08:00 WIB — hasilnya ikut laporan Discord.</div>
                </div>)}
              {data && data.e2eSteps && data.e2eSteps.length > 0 && (
                <div className={`mt-3 text-[11px] leading-relaxed ${SEP}`}>
                  <b className="text-teal-200">🤖 E2E AUTO-TEST (LOGIN SUNGGUHAN) — {data.e2eFailed ? `${data.e2ePassed}/${data.e2eTotal} LOLOS ⚠️` : `LOGIN + ${data.e2eTotal} LANGKAH OK ✅`} · {((data.e2eDurMs || 0) / 1000).toFixed(1)}s</b>
                  <div className="max-h-36 overflow-y-auto kscroll mt-1">
                    {(data.e2eSteps || []).map((s: any) => (
                      <div key={s.id}>{s.ok ? '✅' : '❌'} <b>{s.label}</b> · {s.ms} ms{s.detail ? <span className="text-white/65"> — {s.detail}</span> : null}</div>
                    ))}
                  </div>
                  <div className="text-white/40 mt-1">Akun tes: {data.e2eAccount || '—'} · trade tes dihapus otomatis · jalan otomatis tiap briefing 08:00 WIB.</div>
                </div>)}
              {data && data.env && data.profiles && (
                <div className={`mt-3 text-[11px] leading-relaxed ${SEP}`}>
                  <b className="text-violet-200">🩺 Hasil Diagnostik</b><br />
                  {['profiles', 'trades', 'bug_reports', 'agent_kv'].map(k => { const r = data[k] || {}; return (
                    <div key={k}>{r.ok ? '✅' : '❌'} <b>{k}</b>{r.ok ? '' : <span className="text-red-300"> — {String(r.error || '').slice(0, 90)}</span>}</div>) })}
                  <div className="text-white/40 mt-1">{Object.entries(data.env).map(([k, v]: any) => `${k} ${v ? '✅' : '❌'}`).join(' · ')}</div>
                  {data.setup && (
                    <div className="mt-2 rounded-lg bg-amber-400/10 border border-amber-300/20 px-2 py-1.5 text-[10.5px] leading-relaxed text-amber-100/90 max-h-40 overflow-y-auto kscroll">
                      <b>🔧 Cara memasang yang belum ada:</b>
                      {Object.entries(data.setup).map(([k, v]: any) => (!data.env?.[k]
                        ? <div key={k} className="mt-1">• <b className="text-amber-200">{k}</b> — {v}</div>
                        : null))}
                    </div>)}
                  <div className="text-white/40 mt-1">Tes kirim beneran: tombol 🧪 Tes Discord &amp; 🧪 Tes Email di Ruang Rapat.</div>
                </div>)}
            </div>
          ) : room === 'CSO' ? (
            /* ============ RUANG CSO — Customer Success ============ */
            <div className={`${PANEL} p-4 text-[12px] text-white/85 leading-relaxed`}>
              <div className="text-[15px] font-bold text-pink-300 mb-0.5">👥 RUANG CSO</div>
              <div className="text-white/50 text-[11px] mb-3">Customer Success · User, email retensi &amp; riset churn</div>
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
                      ⚠️ <b>{cso.churnRisk} user berisiko churn</b> — pernah upload dalam 30 hari tapi 3 hari terakhir diam. Kandidat email win-back Maya (ACC EMAIL / AUTO-ACC).
                    </div>
                  ) : null}
                  {cso.error ? <div className={ERR}>⚠️ {String(cso.error).slice(0, 130)}</div> : null}
                </div>
              ) : <div className="text-white/50 mt-1">Belum ada data — klik tombol di bawah</div>}
              <div className={SEP}>
                <b className="text-pink-200">📧 ACC EMAIL</b>
                <div className="text-white/60 text-[11px] mt-0.5">Kirim email sapaan ke user pasif hari ini</div>
                <button className={`${BTNR} w-full mt-1.5`} style={{ opacity: P.acc === 'busy' ? 0.5 : 1 }} disabled={P.acc === 'busy'}
                  onClick={async () => { P.setAcc('busy'); const r = await call('acc-email', 'POST'); P.setAcc(r) }}>
                  {P.acc === 'busy' ? '⏳ Mengirim…' : '📧 ACC EMAIL ke User Pasif'}
                </button>
                {P.acc && P.acc !== 'busy' && (P.acc.dup
                  ? <div className={OKS}>ℹ️ ACC EMAIL sudah dicatat hari ini — besok lagi.</div>
                  : P.acc.ok ? <div className={OKS}>✅ ACC tercatat{typeof P.acc.emailsSent === 'number' && P.acc.emailsSent >= 0 ? ` — ${P.acc.emailsSent} email terkirim (Resend)` : ' — set RESEND_API_KEY utk kirim otomatis'}.</div>
                  : <div className={ERR}>❌ {String(P.acc.error || 'gagal').slice(0, 140)}</div>)}
              </div>
              <div className={SEP}>
                <b className="text-teal-200">🤖 Mode Otomatis (AUTO-ACC)</b>
                <div className="text-white/60 text-[11px] mt-0.5">
                  {autoacc === undefined ? 'memuat status…' : autoacc
                    ? 'AKTIF ✅ — CSO kirim email ke user pasif OTOMATIS tiap briefing 08:00. Kamu nggak perlu klik apa-apa.'
                    : 'OFF — kamu harus klik ACC EMAIL manual tiap hari. Nyalakan biar karyawan kerja sendiri.'}
                </div>
                <button className={`w-full mt-1.5 text-[12px] px-3 py-2 rounded-xl cursor-pointer border transition-colors ${autoacc ? 'border-emerald-300/40 bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/25' : 'border-white/15 bg-white/5 text-white/60 hover:bg-white/10'}`} disabled={busy}
                  onClick={async () => { await call('auto-acc&on=' + (autoacc ? '0' : '1'), 'POST') }}>
                  {autoacc ? '🔴 Matikan AUTO-ACC' : '🟢 Nyalakan AUTO-ACC (sekali klik, permanen)'}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button className={BTN} onClick={() => call('agents&only=cso')}>🔄 Hitung Ulang</button>
              </div>
              <div className={SEP}>
                <b className="text-pink-200">💬 Diskusi CSO × CMO</b>
                <div className="text-white/60 text-[11px] mt-0.5 leading-relaxed">
                  Maya ngobrol sama Sinta (CMO) bawa data nyata: kenapa user daftar tapi males upload jurnal → langsung jadi skrip konten TikTok.
                </div>
                <button className={`${BTNR} w-full mt-1.5`} disabled={busy}
                  onClick={async () => { const r = await call('talk', 'POST'); if (r?.talkError) (window as any).__kceo?.toast?.('⚠️ ' + String(r.talkError).slice(0, 90)) }}>
                  🗣️ Ngobrol sama CMO &amp; Bikin Skrip
                </button>
                {talk && talk.diagnosis ? (
                  <div className="mt-2">
                    <div className="rounded-xl bg-pink-400/10 border border-pink-300/20 px-2 py-1.5 text-[11px] leading-relaxed">
                      🔍 <b>Diagnosa:</b> {talk.diagnosis}
                    </div>
                    {talk.intel && (
                      <div className="mt-1 text-[10px] leading-relaxed text-white/70 bg-white/5 rounded-lg px-1.5 py-1">
                        📊 <b>Data nyata yang Maya bawa ke meja rapat:</b> {talk.intel.total} pendaftar · {talk.intel.active7d} aktif 7 hr · {talk.intel.passive} pasif · <b className="text-pink-300">{talk.intel.baruTakAktif} pendaftar baru belum pernah upload</b>{(talk.intel.bug7d ?? -1) >= 0 ? <span> · {talk.intel.bug7d} bug 7 hr</span> : null}
                      </div>)}
                    {talk.dupToday ? <div className="text-white/40 text-[9.5px] mt-0.5">udah diskusi hari ini — ini hasil terakhir (briefing 08:00 juga jalanin otomatis)</div> : null}
                    {Array.isArray(talk.reasons) && talk.reasons.length > 0 && (
                      <div className="mt-1 text-[10.5px] leading-relaxed text-white/75">
                        <b>Alasan teratas user:</b>
                        <ul className="m-0 mt-0.5 pl-4 list-disc">{talk.reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>
                      </div>)}
                    <div className="mt-1.5 max-h-44 overflow-y-auto kscroll flex flex-col gap-1">
                      {(talk.dialog || []).map((d: any, i: number) => (
                        <div key={i} className={`max-w-[90%] rounded-lg px-2 py-1 text-[10.8px] leading-relaxed ${d.who === 'CSO' ? 'self-start bg-pink-400/10' : 'self-end bg-violet-400/10'}`}>
                          <b className={`text-[9.5px] ${d.who === 'CSO' ? 'text-pink-300' : 'text-violet-300'}`}>{d.who === 'CSO' ? '👩‍💼 Maya · CSO' : '📣 Sinta · CMO'}</b><br />{d.text}
                        </div>))}
                    </div>
                    {talk.script?.hook && (
                      <div className="mt-1.5 border border-dashed border-violet-300/35 rounded-lg px-2 py-1.5 text-[10.8px] leading-relaxed">
                        <b className="text-violet-300">🎬 Skrip Konten Hasil Rapat</b><br />
                        <b>HOOK:</b> {talk.script.hook}<br />
                        <b>ISI:</b> {talk.script.body}<br />
                        <b>CTA:</b> {talk.script.cta}
                        <div className="mt-1 flex gap-1.5 items-center">
                          <button className={`${BTN} text-[10px] px-2 py-1`} onClick={async () => { try { await navigator.clipboard.writeText(`HOOK: ${talk.script.hook}\n\nISI: ${talk.script.body}\n\nCTA: ${talk.script.cta}`); P.setTalkCopied(true); setTimeout(() => P.setTalkCopied(false), 1800) } catch { } }}>📋 Salin Skrip</button>
                          {P.talkCopied ? <span className="text-emerald-300 text-[10px]">tersalin ✅</span> : null}
                        </div>
                      </div>)}
                    {talk.provider === 'openrouter' ? <div className="text-white/40 text-[9.5px] mt-0.5">⚡ via OpenRouter (model resmi Maya)</div> : talk.provider === 'fallback' ? <div className="text-white/40 text-[9.5px] mt-0.5">📦 templat cadangan (semua model gagal)</div> : talk.provider === 'gemini' ? <div className="text-white/40 text-[9.5px] mt-0.5">✅ via Gemini (cadangan)</div> : null}
                  </div>
                ) : <div className="text-white/45 text-[10.5px] mt-1.5">Belum ada diskusi — klik tombol di atas. Hasil juga otomatis dibuat tiap briefing 08:00 &amp; dikirim ke Discord.</div>}
              </div>
            </div>
          ) : room === 'CMO' ? (
            /* ============ RUANG CMO — Marketing & Copywriter ============ */
            <div className={`${PANEL} p-4 text-[12px] text-white/85 leading-relaxed`}>
              <div className="text-[15px] font-bold text-violet-300 mb-0.5">📣 RUANG CMO</div>
              <div className="text-white/50 text-[11px] mb-3">Marketing &amp; Copywriter AI · Draf TikTok</div>
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
                  {cmo.usedFallback ? <div className="text-white/40 mt-1 text-[11px]">(fallback — semua model gagal, revisi manual)</div> : null}
                  {cmo.provider === 'openrouter' ? <div className="text-amber-300 mt-1 text-[11px]">⚡ OpenRouter — model resmi Sinta{cmo.model ? `: ${cmo.model}` : ' (GLM-4.7-Flash)'}</div> : null}
                  {cmo.provider === 'gemini' ? <div className="text-white/40 mt-0.5 text-[10.5px]">✅ Gemini (cadangan terakhir)</div> : null}
                  {cmo.basedOn === 'tiktok' ? <div className="text-violet-300 text-[10.5px] mt-0.5">📚 Dianalisis dari {cmo.analyzedPosts} konten TikTok asli lo — pola pemenang ditiru</div> : null}
                </div>
              ) : <div className="text-white/50 mt-1">Belum ada draf — klik ✍️ untuk generate</div>}
              <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                <button className={BTNP} onClick={() => call('agents&only=cmo')}>✍️ Buat 3 Draf Baru</button>
                <button className={BTN} disabled={!cmoCur} onClick={async () => { try { await navigator.clipboard.writeText(cmoCur); P.setCopied(true); setTimeout(() => P.setCopied(false), 1800) } catch { } }}>📋 Salin Draf Ini</button>
                {P.copied ? <span className="text-emerald-300 text-[11px]">tersalin ✅</span> : null}
              </div>
              <div className="mt-3 pt-3 border-t border-violet-300/15">
                <b className="text-violet-200 text-[12px]">📚 Bahan Analisis TikTok ({P.tt.length})</b>
                <div className="text-white/50 text-[10.5px] mt-0.5 leading-relaxed">Paste link TikTok lo + views/likes — caption diambil OTOMATIS. CMO pelajari 5 konten terbaik tiap bikin draf: makin banyak bahan, makin pintar.</div>
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  <input value={P.ttUrl} onChange={e => P.setTtUrl(e.target.value)} placeholder="Link TikTok (vt.tiktok.com/… atau www.tiktok.com/@lo/video/…)" className={`${INPUT} flex-1 min-w-0`} style={{ flex: '1 1 150px' }} />
                  <input value={P.ttViews} onChange={e => P.setTtViews(e.target.value)} placeholder="views" inputMode="numeric" className={INPUT} style={{ width: 62 }} />
                  <input value={P.ttLikes} onChange={e => P.setTtLikes(e.target.value)} placeholder="likes" inputMode="numeric" className={INPUT} style={{ width: 62 }} />
                  <button className={`${BTNP} text-[11.5px]`} style={{ opacity: P.ttBusy ? 0.5 : 1 }} disabled={P.ttBusy || !P.ttUrl.trim()} onClick={P.ttAdd}>{P.ttBusy ? '⏳' : '➕ Tambah'}</button>
                </div>
                {P.ttMsg ? <div className={`text-[10.5px] mt-1 ${P.ttMsg.startsWith('⚠️') ? 'text-red-300' : 'text-emerald-300'}`}>{P.ttMsg}</div> : null}
                {P.tt.length ? (
                  <div className="mt-1.5 max-h-36 overflow-y-auto kscroll flex flex-col gap-1">
                    {P.tt.map((p) => (
                      <div key={p.id} className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1">
                        <div className="flex-1 min-w-0">
                          <div className="text-[10.5px] text-white/85 whitespace-nowrap overflow-hidden text-ellipsis">{p.caption || p.url}</div>
                          <div className="text-[9.5px] text-white/45">👁 {Number(p.views || 0).toLocaleString('id-ID')} · ❤️ {Number(p.likes || 0).toLocaleString('id-ID')}</div>
                        </div>
                        <button className={`${BTN} text-[10px] px-2 py-1`} disabled={P.ttBusy} onClick={() => P.ttDel(p.id)}>🗑</button>
                      </div>
                    ))}
                  </div>
                ) : <div className="text-[10.5px] text-white/40 mt-1">Belum ada bahan — CMO masih pakai referensi statis TIKTOK_REFERENCE.</div>}
              </div>
              <div className="text-white/40 text-[10.5px] mt-3 leading-relaxed">
                3 draf pilihan/hari (1 panggilan model — Bos pilih yang paling pas) · Rotasi angle harian<br />
                Histori 5 draf utama terakhir disimpan (anti repetisi)<br />
                📚 Bahan TikTok lo = acuan utama — isi terus biar draf makin mirin konten yang FYP
              </div>
            </div>
          ) : room === 'CFO' ? (
            /* ============ RUANG CFO — API Quota Manager ============ */
            <div className={`${PANEL} p-4 text-[12px] text-white/85 leading-relaxed`}>
              <div className="text-[15px] font-bold text-amber-300 mb-0.5">💰 RUANG CFO</div>
              <div className="text-white/50 text-[11px] mb-3">API Quota Manager · Anti-429 Gemini Vision</div>
              {cfo ? (
                <div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-2 text-center">
                      <div className="text-[10px] text-white/50">Hari Ini</div>
                      <div className="text-[20px] font-bold text-amber-200">{cfo.usedToday ?? '—'}</div>
                      <div className="text-[10px] text-white/40">dari {cfo.limit}</div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-2 text-center">
                      <div className="text-[10px] text-white/50">Kemarin</div>
                      <div className="text-[20px] font-bold text-white/80">{cfo.usedYesterday ?? '—'}</div>
                      <div className="text-[10px] text-white/40">dari {cfo.limit}</div>
                    </div>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className={`h-full rounded-full transition-[width] duration-500 ${cfo.status && String(cfo.status).indexOf('KRITIS') === 0 ? 'bg-red-400' : cfo.status && String(cfo.status).indexOf('WASPADA') === 0 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${Math.min(100, Math.round(((cfo.usedToday || 0) / (cfo.limit || 1)) * 100))}%` }} />
                  </div>
                  <div className="mt-2 text-[11.5px] text-white/75">
                    Event 429 kemarin: <b className="text-white">{cfo.quota429 ?? '—'}</b><br />
                    Email hari ini: <b className="text-white">{cfo.emailToday ?? '—'}/{cfo.emailLimit ?? 100}</b> (Resend)<br />
                    Status: <b className={cfo.status && String(cfo.status).indexOf('KRITIS') === 0 ? 'text-red-300' : cfo.status && String(cfo.status).indexOf('WASPADA') === 0 ? 'text-amber-300' : 'text-emerald-300'}>{cfo.status ?? ''}</b>
                  </div>
                  {cfo.error ? <div className={ERR}>⚠️ {String(cfo.error).slice(0, 120)}</div> : null}
                </div>
              ) : <div className="text-white/50 mt-1">Belum ada data — klik tombol di bawah</div>}
              {cfo?.proCount >= 0 && (
                <div className="mt-2 rounded-xl bg-emerald-400/10 border border-emerald-300/20 p-2.5">
                  <div className="text-[10px] text-white/50">💵 Estimasi pendapatan (Putri — hitung is_pro × harga, tanpa LLM)</div>
                  <div className="text-[20px] font-bold text-emerald-200 leading-tight">Rp{fmtIdr(cfo.estMRR || 0)}<span className="text-[10px] font-normal text-white/45"> /bulan MRR</span></div>
                  <div className="text-[10.5px] text-white/60">{cfo.proCount} user PRO × Rp{fmtIdr(cfo.proPrice)} (paket bulanan)</div>
                  {cfo.mrrTarget > 0 ? (
                    <div className="mt-1.5">
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-400 transition-[width] duration-500" style={{ width: `${Math.min(100, Math.round(((cfo.estMRR || 0) / cfo.mrrTarget) * 100))}%` }} />
                      </div>
                      <div className="text-[9.5px] text-white/45 mt-0.5">{Math.round(((cfo.estMRR || 0) / cfo.mrrTarget) * 100)}% dari target MRR Rp{fmtIdr(cfo.mrrTarget)} · target diubah via env MRR_TARGET_IDR</div>
                    </div>
                  ) : null}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button className={BTN} onClick={() => call('quota')}>🔄 Refresh Kuota</button>
                <button className={BTNO} onClick={() => call('agents&only=cfo')}>📊 Cek Ulang</button>
              </div>
            </div>
          ) : room === 'COO' ? (
            /* ============ RUANG COO — Jualan & Monetisasi ============ */
            <div className={`${PANEL} p-4 text-[12px] text-white/85 leading-relaxed`}>
              <div className="text-[15px] font-bold text-emerald-300 mb-0.5">💼 RUANG COO</div>
              <div className="text-white/50 text-[11px] mb-2.5">Jualan &amp; Monetisasi · Hot lead → email tawaran PRO (ACC dulu, baru kirim)</div>
              <div className="rounded-xl bg-emerald-400/10 border border-emerald-300/20 px-2.5 py-2 text-[10.5px] leading-relaxed text-emerald-100/90">
                🎯 Target: free user paling aktif 7 hari (udah ketagihan, tinggal ditawarin upgrade)<br />
                ⏰ Cron harian 08:00 WIB · 🛡️ Anti-spam: 1 lead maks 1× per 7 hari<br />
                📬 Email terkirim via Resend SETELAH Bos ACC — human-in-the-loop<br />
                🔄 FOLLOW-UP: lead yang BUKA email (webhook Resend) tapi belum PRO → otomatis dapat draf follow-up + kupon diskon terkontrol
              </div>
              {P.cooLoading && P.cooTasks.length === 0 ? (
                <div className="text-white/55 mt-2.5 text-[11.5px]">⏳ Memuat antrean jualan…</div>
              ) : P.cooTasks.length === 0 ? (
                <div className="mt-2.5 text-white/65 text-[11.5px] leading-relaxed">
                  ✅ Tidak ada draf yang menunggu ACC.<br />
                  Bagas buru lead baru lagi besok pagi 08:00 — nggak ada yang perlu kamu proses sekarang.
                </div>
              ) : (
                <div className="mt-2.5 flex flex-col gap-2.5 max-h-60 overflow-y-auto kscroll pr-0.5">
                  {P.cooTasks.map((t: any) => {
                    const draft = P.cooDrafts[t.id] || { subject: t.generated_content?.subject || '', body: t.generated_content?.body || '' }
                    const acting = P.cooActing === t.id
                    return (
                      <div key={t.id} className="rounded-xl border border-emerald-300/25 bg-emerald-400/5 p-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-emerald-400/15 border border-emerald-300/40 grid place-items-center text-[12px] font-bold text-emerald-200 shrink-0">
                            {(t.context_data?.fullName || t.context_data?.email || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[12px] font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis">{t.context_data?.fullName || 'Tanpa nama'}</div>
                            <div className="text-[10px] text-white/50 whitespace-nowrap overflow-hidden text-ellipsis">{t.context_data?.email}</div>
                          </div>
                          <span className="text-[9.5px] bg-emerald-400/15 text-emerald-200 rounded-full px-1.5 py-0.5 whitespace-nowrap shrink-0">
                            {t.context_data?.followup
                              ? `🔄 FOLLOW-UP · buka email${t.context_data?.coupon ? ` · ${t.context_data.coupon}` : ''}`
                              : `🔥 ${t.context_data?.totalTrades ?? '?'} trades/7hr`}
                          </span>
                        </div>
                        <input value={draft.subject} onChange={e => P.setCooDrafts(p => ({ ...p, [t.id]: { ...draft, subject: e.target.value } }))}
                          placeholder="Subjek email penawaran…"
                          className={`${INPUT} w-full box-border mt-1.5`} />
                        <textarea value={draft.body} onChange={e => P.setCooDrafts(p => ({ ...p, [t.id]: { ...draft, body: e.target.value } }))}
                          rows={6} placeholder="Isi email penawaran dari Bagas…"
                          className={`${INPUT} w-full box-border mt-1.5 leading-relaxed resize-y font-[inherit]`} />
                        <div className="text-white/35 text-[9.5px] text-right mt-0.5">{draft.body.length} karakter · bisa diedit sebelum ACC</div>
                        <div className="flex gap-1.5 mt-1.5">
                          <button className={`${BTN} flex-1 bg-emerald-400/20 font-semibold`} disabled={acting} onClick={() => P.cooAct(t, 'approve')}>
                            {acting ? '⏳ Mengirim…' : '💸 ACC & Kirim Email'}
                          </button>
                          <button className={BTNR} disabled={acting} onClick={() => P.cooAct(t, 'reject')}>✖ Tolak</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="mt-2.5 flex flex-wrap gap-1.5 items-center">
                <button className={BTN} onClick={() => P.cooLoad()}>🔄 Muat Ulang Antrean</button>
                {P.cooLoading ? <span className="text-[10px] text-white/50">memuat…</span> : null}
              </div>
              <div className="text-white/40 text-[10px] mt-2.5 leading-relaxed">
                Draf dibuat otomatis oleh Bagas (cron 08:00 WIB) — Bos bisa revisi dulu sebelum ACC.<br />
                Persentase konversi penawaran → PRO dilaporkan CEO tiap Senin 10:00.
              </div>
            </div>
          ) : room === 'DA' ? (
            /* ============ RUANG DATA ANALYST — Dewi ============ */
            <div className={`${PANEL} p-4 text-[12px] text-white/85 leading-relaxed`}>
              <div className="text-[15px] font-bold text-cyan-300 mb-0.5">📊 RUANG DATA ANALYST</div>
              <div className="text-white/50 text-[11px] mb-3">Dewi · Pola trading user → insight &amp; rekomendasi mingguan</div>
              {da ? (
                <div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-2 text-center">
                      <div className="text-[10px] text-white/50">Upload 30 hari</div>
                      <div className="text-[18px] font-bold text-cyan-200">{da.stats?.uploads30 ?? '—'}</div>
                      <div className="text-[9.5px] text-white/40">{da.stats?.uploads7 ?? '—'} dalam 7 hari terakhir</div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-2 text-center">
                      <div className="text-[10px] text-white/50">Win rate agregat</div>
                      <div className="text-[18px] font-bold text-cyan-200">{da.stats?.winRate ?? '—'}%</div>
                      <div className="text-[9.5px] text-white/40">{da.stats?.traders30 ?? '—'} trader unik</div>
                    </div>
                  </div>
                  <div className="text-white/65 text-[10.5px] mt-1.5 leading-relaxed">
                    🥇 Pair favorit: <b className="text-white">{da.stats?.topSymbol || '—'}</b> · Sesi: <b className="text-white">{da.stats?.topSession || '—'}</b> · Puncak jam: <b className="text-white">{da.stats?.bestHour || '—'}</b>
                  </div>
                  {da.stats?.emotion ? (
                    <div className="text-white/65 text-[10.5px] mt-1 leading-relaxed">
                      😤 Emosi (self-report user): <b className="text-emerald-300">"{da.stats.emotion.best}" WR {da.stats.emotion.bestWr}%</b> paling profit · <b className="text-red-300">"{da.stats.emotion.worst}" WR {da.stats.emotion.worstWr}%</b> paling rugi
                    </div>
                  ) : null}
                  <div className="mt-2 rounded-xl bg-cyan-400/10 border border-cyan-300/20 px-2.5 py-2 text-[11px] leading-relaxed">
                    🔍 {da.insight}
                  </div>
                  {Array.isArray(da.patterns) && da.patterns.length > 0 && (
                    <div className="mt-1.5 text-[10.5px] leading-relaxed text-white/75">
                      <b>Pola yang Dewi temukan:</b>
                      <ul className="m-0 mt-0.5 pl-4 list-disc">{da.patterns.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul>
                    </div>)}
                  {Array.isArray(da.recommendations) && da.recommendations.length > 0 && (
                    <div className="mt-1.5 border border-dashed border-cyan-300/40 rounded-lg px-2 py-1.5 text-[10.8px] leading-relaxed">
                      <b className="text-cyan-200">💡 Rekomendasi minggu ini:</b>
                      <ol className="m-0 mt-0.5 pl-4 list-decimal">{da.recommendations.map((r: string, i: number) => <li key={i} className="mb-0.5">{r}</li>)}</ol>
                    </div>)}
                  {da.dupToday ? <div className="text-white/40 text-[9.5px] mt-0.5">sudah dianalisis hari ini — ini hasil terakhir (Senin 10:00 jalan otomatis)</div> : null}
                  {da.provider === 'openrouter' ? <div className="text-white/40 text-[9.5px] mt-0.5">⚡ via OpenRouter (model resmi Dewi)</div> : da.provider === 'fallback' ? <div className="text-white/40 text-[9.5px] mt-0.5">📦 rangkuman dari angka nyata (LLM gagal)</div> : da.provider === 'gemini' ? <div className="text-white/40 text-[9.5px] mt-0.5">✅ via Gemini (cadangan)</div> : null}
                </div>
              ) : <div className="text-white/50 mt-1 text-[11px]">Belum ada analisis — klik tombol di bawah. Jalan otomatis tiap Senin 10:00 WIB.</div>}
              {daError ? <div className={ERR}>⚠️ {String(daError).slice(0, 140)}</div> : null}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button className={BTN} disabled={busy} onClick={() => call('analyst', 'POST')}>🔍 Analisis Data Sekarang</button>
              </div>
              <div className="text-white/40 text-[10px] mt-2.5 leading-relaxed">
                Sumber: tabel trades 30 hari terakhir (maks 1.000 trade terbaru) — win rate, pair, sesi, jam ramai.<br />
                Insight ini dipakai CMO (konten relevan) &amp; Growth Hacker (eksperimen) — data jadi makanan seluruh tim.
              </div>
            </div>
          ) : room === 'GH' ? (
            /* ============ RUANG GROWTH — Farhan ============ */
            <div className={`${PANEL} p-4 text-[12px] text-white/85 leading-relaxed`}>
              <div className="text-[15px] font-bold text-orange-300 mb-0.5">🚀 RUANG GROWTH</div>
              <div className="text-white/50 text-[11px] mb-3">Farhan · Funnel nyata → 3 eksperimen pertumbuhan / minggu</div>
              {gh ? (
                <div>
                  {gh.funnel && (
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div className="bg-white/5 border border-white/10 rounded-xl py-1.5">
                        <div className="text-[16px] font-bold text-orange-200">{gh.funnel.total ?? '—'}</div>
                        <div className="text-[9.5px] text-white/50">Pendaftar</div>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-xl py-1.5">
                        <div className="text-[16px] font-bold text-orange-200">{gh.funnel.pro ?? '—'}</div>
                        <div className="text-[9.5px] text-white/50">PRO</div>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-xl py-1.5">
                        <div className="text-[16px] font-bold text-orange-200">{gh.funnel.baru7 ? Math.round((gh.funnel.activated7 / gh.funnel.baru7) * 100) + '%' : '—'}</div>
                        <div className="text-[9.5px] text-white/50">Aktivasi baru</div>
                      </div>
                    </div>)}
                  {gh.funnel && (
                    <div className="text-white/60 text-[10px] mt-1.5 leading-relaxed">
                      {gh.funnel.activated7 ?? 0}/{gh.funnel.baru7 ?? 0} pendaftar baru aktif upload · {gh.funnel.referred ?? 0} user dari referral · {gh.funnel.onboarded ?? 0} selesai onboarding
                    </div>)}
                  {gh.ab && (
                    <div className="mt-2 rounded-xl bg-orange-400/10 border border-orange-300/20 px-2.5 py-2 text-[10.5px] leading-relaxed">
                      <b className="text-orange-200">🧪 A/B CTA Landing — eksperimen otomatis (7 hari):</b><br />
                      A: {gh.ab.A?.views ?? 0} lihat · {gh.ab.A?.clicks ?? 0} klik ({gh.ab.A?.cr ?? 0}%) · B: {gh.ab.B?.views ?? 0} lihat · {gh.ab.B?.clicks ?? 0} klik ({gh.ab.B?.cr ?? 0}%)<br />
                      🏆 Pemenang sementara: <b>{gh.ab.winner}</b>
                    </div>)}
                  <div className="mt-2 rounded-xl bg-orange-400/10 border border-orange-300/20 px-2.5 py-2 text-[11px] leading-relaxed">
                    🔍 {gh.insight}
                  </div>
                  {Array.isArray(gh.experiments) && gh.experiments.length > 0 && (
                    <div className="mt-1.5 flex flex-col gap-1.5">
                      {gh.experiments.map((x: any, i: number) => (
                        <div key={i} className="border border-dashed border-orange-300/35 rounded-lg px-2 py-1.5 text-[10.8px] leading-relaxed">
                          <b className="text-orange-200">🧪 {i + 1}. {x.name}</b>
                          <span className="text-[9px] bg-orange-400/15 text-orange-200 rounded-full px-1.5 py-0.5 ml-1.5 whitespace-nowrap">effort {x.effort || 'sedang'}</span><br />
                          {x.how}<br />
                          <span className="text-white/50">📏 Ukur: {x.metric}</span>
                        </div>))}
                    </div>)}
                  {gh.dupToday ? <div className="text-white/40 text-[9.5px] mt-0.5">sudah dirancang hari ini — ini hasil terakhir (Senin 10:00 jalan otomatis)</div> : null}
                  {gh.provider === 'openrouter' ? <div className="text-white/40 text-[9.5px] mt-0.5">⚡ via OpenRouter (model resmi Farhan)</div> : gh.provider === 'fallback' ? <div className="text-white/40 text-[9.5px] mt-0.5">📦 templat dari funnel nyata (LLM gagal)</div> : gh.provider === 'gemini' ? <div className="text-white/40 text-[9.5px] mt-0.5">✅ via Gemini (cadangan)</div> : null}
                </div>
              ) : <div className="text-white/50 mt-1 text-[11px]">Belum ada eksperimen — klik tombol di bawah. Jalan otomatis tiap Senin 10:00 WIB.</div>}
              {ghError ? <div className={ERR}>⚠️ {String(ghError).slice(0, 140)}</div> : null}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button className={BTN} disabled={busy} onClick={() => call('growth', 'POST')}>🚀 Rancang Eksperimen Sekarang</button>
              </div>
              <div className="text-white/40 text-[10px] mt-2.5 leading-relaxed">
                Sumber: funnel profiles (pendaftar, PRO, referral, onboarding, aktivasi) + insight Dewi.<br />
                Eksperimen = usulan — Bos yang pilih mana yang dieksekusi minggu ini.
              </div>
            </div>
          ) : room === 'struktur' ? (
            /* ============ RUANG STRUKTUR — Jabatan & Pekerjaan Tiap Karyawan ============ */
            <div className={`${PANEL} p-4 text-[12px] text-white/85 leading-relaxed`}>
              <div className="text-[15px] font-bold text-white mb-0.5">📋 STRUKTUR TIM AI</div>
              <div className="text-white/50 text-[11px] mb-3 leading-relaxed">
                Jabatan, pekerjaan &amp; jadwal tiap karyawan — plus <b className="text-amber-300">batas kemampuan yang jujur</b>, biar Bos bisa menilai apa yang kurang dan layak ditambah.
              </div>
              <div className="max-h-[30vh] overflow-y-auto kscroll pr-0.5">
                {TEAM_DETAIL.map(m => (
                  <div key={m.id} className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 mb-2">
                    <div className="text-[12.5px] font-bold" style={{ color: BRIGHT[m.color] || m.color }}>{m.emoji} {m.name} — {m.jabatan}</div>
                    <div className="text-[9.5px] text-white/40 mb-1 uppercase tracking-wider">{m.divisi}</div>
                    <div className="text-[10.5px] leading-relaxed">
                      <b>🕐 Jam kerja:</b> {m.shift}<br />
                      <b>📥 Baca data:</b> {m.baca}
                      <div className="mt-1"><b>📋 Tugas:</b>
                        <ul className="m-0 mt-0.5 pl-4 list-disc">{m.tugas.map((t, i) => <li key={i}>{t}</li>)}</ul>
                      </div>
                      <div className="mt-1"><b>📤 Laporan:</b> {m.lapor}</div>
                      <div className="mt-1"><b className="text-amber-300">⚠️ Belum bisa:</b>
                        <ul className="m-0 mt-0.5 pl-4 list-disc">{m.batas.map((t, i) => <li key={i}>{t}</li>)}</ul>
                      </div>
                      <div className="mt-1 text-white/75"><b className="text-teal-300">💡 Bisa ditambah:</b> {m.ide}</div>
                    </div>
                  </div>
                ))}
                <div className="rounded-xl border border-dashed border-amber-300/40 bg-amber-400/5 px-2.5 py-2 text-[10.5px] leading-relaxed mb-1">
                  <b className="text-amber-300">🧩 Sisa kursi kosong (opini jujur):</b>
                  <ul className="m-0 mt-0.5 pl-4 list-disc">
                    <li><b>Support Closer</b> — CS bot chat (/api/chat) sudah jawab pertanyaan user, tapi belum ada yang follow-up penyelesaian bug ke user pelapor sampai tuntas</li>
                    <li><b>Eksekusi A/B test otomatis</b> — Farhan sudah merancang eksperimen tiap Senin, tapi pelaksanaannya masih tangan Bos (belum ada mesin A/B otomatis)</li>
                  </ul>
                  <div className="mt-1 text-white/70">✅ Kursi <b>Data Analyst</b> (Dewi) &amp; <b>Growth Hacker</b> (Farhan) yang dulu kosong — kini SUDAH DIISI. Promosi affiliate masuk ke eksperimen mingguan Farhan.</div>
                </div>
                <div className="text-white/40 text-[10px] leading-relaxed">
                  Semua jadwal jalan otomatis via Cloudflare Cron bawaan — tanpa cron-job.org.<br />
                  Mau pindahkan tugas antar karyawan, ubah jadwal, atau tambah kursi baru? Bilang saja, Bos.
                </div>
              </div>
            </div>
          ) : null}
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
                  <div className="w-10 h-10 rounded-full bg-white/10 border border-white/15 grid place-items-center text-xl shrink-0">{a.emoji}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-white text-sm font-semibold leading-tight truncate">{a.name}</div>
                    <div className="text-white/50 text-[11px] leading-tight truncate">{a.role}</div>
                  </div>
                  <Dot tone={a.has ? 'ok' : 'idle'} />
                </div>
                <div className="text-white/70 text-xs leading-relaxed">{a.live}</div>
                <div className={`text-[11px] flex items-center gap-1 ${active ? 'text-white' : 'text-white/40'}`}>
                  {active ? '✓ Ruangan ini terbuka' : <>Masuk Ruangan <span aria-hidden="true">→</span></>}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
