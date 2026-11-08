/**
 * comment-hunter.ts — OTAK "PEMBURU KOMENTAR" (karyawan AI pemantau komentar IG)
 * ==============================================================================
 * Tugas karyawan ini: memantau KOMENTAR di postingan Instagram milik
 * SENDIRI (patuh ToS — hanya via Graph API resmi, bukan scraping, bukan
 * komentar ke akun orang lain), mengklasifikasi niat pengomentar, membalas
 * otomatis yang aman, dan menandai propek (minat beli) untuk Bos.
 *
 * FILE INI OTAK MURNI:
 *   - TANPA import apa pun (diekstrak Bun.Transpiler untuk diuji langsung
 *     dari kode asli — pola scripts/test-growth-sentinel.mjs).
 *   - Tanpa akses DB/network/env — pemanggil (route cron) yang menyediakan.
 *   - CF Workers safe: operasi string murni saja.
 *
 * Kontrak utama:
 *   classifyComment(text)                 → niat + lead + boleh dibalas otomatis
 *   buildAutoReply(intent, ctx)           → draf balasan IG singkat | null
 *   pickHuntTargets(media, seen, maxNew)  → komentar baru yang layak diproses
 *   summarizeHunt(results)                → teks laporan ringkas Discord
 * ==============================================================================
 */

/* ── OTAK PEMBURU KOMENTAR (MURNI) ── */

/** Niat komentar — hasil klasifikasi longgar bahasa Indonesia. */
export type CommentIntent =
  | 'tanya-cara'
  | 'minat-harga'
  | 'tanya-sinyal'
  | 'sapa-halo'
  | 'pujian'
  | 'negatif-spam'
  | 'lain'

/** Konteks bisnis untuk merangkai balasan (diisi route cron dari data riil). */
export interface HuntContext {
  /** Kalimat social proof singkat, mis. "1.200+ trader sudah ikut" (boleh kosong). */
  socialProof: string
  /** URL signup produk, mis. https://luxtradee.web.id/auth/signup */
  signupUrl: string
  /** true bila saat ini ada trial/premium gratisan yang boleh disebut. */
  hasTrial: boolean
}

/** Satu komentar IG hasil flatten dari Graph API. */
export interface HuntComment {
  mediaId: string
  commentId: string
  username?: string
  text: string
  permalink?: string
}

/** Satu baris hasil proses — bahan laporan Discord. */
export interface HuntResult {
  intent: CommentIntent
  /** 'auto_replied' | 'drafted' | 'skipped' | 'failed' */
  status: string
  /** true = propek minat beli (intent 'minat-harga'). */
  lead: boolean
  username?: string
  text: string
}

/** Hasil klasifikasi satu komentar. */
export interface CommentClass {
  intent: CommentIntent
  /** true hanya untuk 'minat-harga' (propek). */
  lead: boolean
  /**
   * true = BOLEH dibalas otomatis (intent aman & ada template).
   * false untuk 'negatif-spam' (jangan beri perhatian) dan 'lain'
   * (tidak ada template — opsidal via LLM, tetap tidak dibalas otomatis).
   */
  autoReplySafe: boolean
}

/* ── Kamus keyword longgar (Indonesia, sudah dinormalisasi lowercase tanpa tanda baca) ── */

/** negatif-spam: caci merah + indikasi penipuan (dicek PALING DULU). */
const NEGATIF_WORDS = ['scam', 'bohong', 'tipu', 'penipuan', 'penipu', 'hoax', 'hos']

/** minat-harga: calon pembeli → LEAD. */
const MINAT_HARGA_WORDS = [
  'harga', 'berapa', 'biaya', 'premium', 'upgrade', 'berlangganan', 'langganan',
  'bayar', 'price', 'pinjol', 'gratis selamanya',
]

/** tanya-cara: bingung cara mulai/daftar. */
const TANYA_CARA_WORDS = [
  'gimana', 'gmn', 'bagaimana', 'bgmn', 'cara', 'daftar', 'gabung', 'join',
  'download', 'downloadnya', 'unduh', 'apk', 'install', 'instal', 'masuknya',
]

/** tanya-sinyal: soal sinyal/entry (dicek per token utk kata pendek agar tak salah tangkap). */
const TANYA_SINYAL_WORDS = ['sinyal', 'signal', 'entry', 'enter', 'akurat', 'notifikasi']

/** pujian: apresiasi. */
const PUJIAN_WORDS = [
  'keren', 'mantap', 'mantul', 'makasih', 'makasi', 'terima kasih', 'thanks',
  'thank', 'good', 'bagus', 'jos', 'gokil', 'luar biasa', 'helpful',
]

/** sapa-halo: cuman menyapa (dicek per token — kata pendek rawan false positive). */
const SAPA_TOKENS = [
  'halo', 'hallo', 'helo', 'hai', 'hay', 'kak', 'kaka', 'kakak', 'sist',
  'min', 'mimin', 'admin', 'gan', 'bro', 'pagi', 'siang', 'malam', 'selamat',
  'assalamualaikum', 'met',
]

/**
 * Normalisasi longgar: lowercase, tanda baca & simbol → spasi,
 * rapatkan spasi. Link "https://x.com" jadi token "https" + host —
 * deteksi link tetap jalan lewat token/kata "http"/"www".
 */
function normalizeCommentText(text: string): string {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Potongan komentar ≤ 40 char utk laporan (rapatkan whitespace dulu). */
export function snippetForReport(text: string, max = 40): string {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim()
  return t.length <= max ? t : t.slice(0, max) + '…'
}

/**
 * Klasifikasi niat komentar. Urutan cek SENGAJA begini (spesifikasi Bos):
 *   negatif-spam → minat-harga → tanya-cara → tanya-sinyal → pujian →
 *   sapa-halo → lain.
 * (minat-harga didahulukan agar "daftar harga"/"berapa biayanya" tidak
 *  tertelan tanya-cara; spam didahulukan agar link/promo tidak dibalas.)
 */
export function classifyComment(text: string): CommentClass {
  const norm = normalizeCommentText(text)
  if (!norm) return { intent: 'lain', lead: false, autoReplySafe: false }
  const tokens = norm.split(' ')

  /* 1) negatif-spam: caci merah, link keluar, atau minta/jual follower */
  const hasLink = norm.includes('http') || tokens.includes('www')
  const isFollowerSpam =
    norm.includes('folback') || norm.includes('followback') || norm.includes('follower')
  const isNegative = NEGATIF_WORDS.some((w) => norm.includes(w))
  if (isNegative || hasLink || isFollowerSpam) {
    return { intent: 'negatif-spam', lead: false, autoReplySafe: false }
  }

  /* 2) minat-harga — LEAD (propek beli) */
  if (MINAT_HARGA_WORDS.some((w) => norm.includes(w)) || tokens.includes('brp')) {
    return { intent: 'minat-harga', lead: true, autoReplySafe: true }
  }

  /* 3) tanya-cara */
  if (TANYA_CARA_WORDS.some((w) => norm.includes(w))) {
    return { intent: 'tanya-cara', lead: false, autoReplySafe: true }
  }

  /* 4) tanya-sinyal (kata pendek tp/sl/buy/sell hanya sebagai token utuh —
        substring 2 huruf rawan salah tangkap, mis. "slot" mengandung "sl") */
  const shortSignal = tokens.some(
    (t) =>
      t === 'buy' || t === 'sell' || t === 'tp' || t === 'sl' ||
      /^tp\d+$/.test(t) || /^sl\d+$/.test(t),
  )
  if (TANYA_SINYAL_WORDS.some((w) => norm.includes(w)) || shortSignal) {
    return { intent: 'tanya-sinyal', lead: false, autoReplySafe: true }
  }

  /* 5) pujian */
  if (PUJIAN_WORDS.some((w) => norm.includes(w)) || tokens.includes('top')) {
    return { intent: 'pujian', lead: false, autoReplySafe: true }
  }

  /* 6) sapa-halo */
  if (tokens.some((t) => SAPA_TOKENS.includes(t))) {
    return { intent: 'sapa-halo', lead: false, autoReplySafe: true }
  }

  /* 7) sisanya */
  return { intent: 'lain', lead: false, autoReplySafe: false }
}

/**
 * Rakit balasan otomatis utk intent yang aman. Aturan copywriting:
 *   - Bahasa Indonesia hangat, gaya komentar IG (bukan email), maks ±200 char.
 *   - TANPA janji profit/pasti, TANPA kata "garansi"/"pasti profit".
 *   - minat-harga TIDAK menyebut angka harga (harga bisa berubah —
 *     jangan hardcode); cukup info ada plan gratis + link.
 * Return null untuk negatif-spam & lain (tidak dibalas otomatis).
 */
export function buildAutoReply(intent: CommentIntent, ctx: HuntContext): string | null {
  const url = String(ctx?.signupUrl || '').trim() || 'https://luxtradee.web.id/auth/signup'
  switch (intent) {
    case 'tanya-cara':
      return `Halo! 😊 Tinggal signup gratis di ${url}, sinyal & jurnal otomatis masuk notif HP 📲`
    case 'minat-harga': {
      let msg = ctx?.hasTrial
        ? `Ada plan GRATIS + trial premium kak 😊 Coba dulu di ${url}, upgrade kapan saja kalau sudah cocok ya!`
        : `Ada plan GRATIS kok kak 😊 Coba dulu di ${url}, upgrade premium kapan saja kalau sudah cocok ya!`
      const proof = String(ctx?.socialProof || '').trim()
      if (proof && msg.length + proof.length + 3 <= 200) msg += ` (${proof})`
      return msg
    }
    case 'tanya-sinyal':
      return `Sinyal terbaru tayang live di dashboard Luxtradee kak 📈 Daftar gratis di ${url} biar bisa langsung lihat ya!`
    case 'sapa-halo':
      return `Halo kak! 😄 Senang kamu mampir — yuk coba jurnal & sinyal Luxtradee gratis di ${url}!`
    case 'pujian':
      return `Terima kasih kak! 🙏 Semangat tradingnya — kapan-kapan coba juga fitur gratis di ${url} ya!`
    default:
      return null // 'negatif-spam' & 'lain' tidak dibalas otomatis
  }
}

/**
 * Pilih komentar yang layak diproses dari hasil flatten media:
 *   - commentId belum ada di existingCommentIds (dedupe antar-run),
 *   - text tidak kosong,
 *   - dedupe dalam batch yang sama,
 *   - MAKS maxNew, TERBARU DULU (array diasumsikan sudah terbaru-dulu
 *     dari Graph API — TIDAK di-sort ulang, cukup ambil urut + slice).
 */
export function pickHuntTargets(
  media: Array<{ id: string; comments?: HuntComment[] }>,
  existingCommentIds: Set<string>,
  maxNew: number,
): HuntComment[] {
  const out: HuntComment[] = []
  if (!Array.isArray(media) || maxNew <= 0) return out
  const seenInBatch = new Set<string>()
  for (const m of media) {
    if (!m || !Array.isArray(m.comments)) continue
    for (const c of m.comments) {
      if (out.length >= maxNew) return out
      if (!c || !String(c.commentId || '').trim()) continue
      const text = String(c.text ?? '')
      if (!text.trim()) continue
      const commentId = String(c.commentId)
      if (existingCommentIds.has(commentId) || seenInBatch.has(commentId)) continue
      seenInBatch.add(commentId)
      out.push({
        mediaId: String(c.mediaId || m.id || ''),
        commentId,
        ...(c.username ? { username: String(c.username) } : {}),
        text,
        ...(c.permalink ? { permalink: String(c.permalink) } : {}),
      })
    }
  }
  return out
}

/**
 * Ringkasan laporan Discord: total diperiksa, per-intent, jumlah
 * auto_replied, jumlah lead, dan daftar maks 5 komentar lead
 * (username + potongan teks 40 char).
 */
export function summarizeHunt(results: HuntResult[]): string {
  const list = Array.isArray(results) ? results : []
  const autoReplied = list.filter((r) => r.status === 'auto_replied').length
  const leads = list.filter((r) => r.lead)

  const counts = new Map<CommentIntent, number>()
  for (const r of list) counts.set(r.intent, (counts.get(r.intent) || 0) + 1)
  const INTENT_LABEL: Record<CommentIntent, string> = {
    'tanya-cara': 'tanya-cara',
    'minat-harga': 'minat-harga',
    'tanya-sinyal': 'tanya-sinyal',
    'sapa-halo': 'sapa-halo',
    pujian: 'pujian',
    'negatif-spam': 'negatif/spam',
    lain: 'lain',
  }
  const perIntent =
    [...counts.entries()].map(([k, v]) => `${INTENT_LABEL[k]} ${v}`).join(' · ') || '-'

  const lines: string[] = []
  const skipped = list.filter((r) => r.status === 'skipped').length
  lines.push('💬 **PEMBURU KOMENTAR IG** — laporan hunt')
  lines.push(`Komentar baru: ${list.length} · Auto-replied: ${autoReplied} · Lead: ${leads.length}${skipped > 0 ? ` · Dilewati (spam/lain): ${skipped}` : ''}`)
  lines.push(`Niat: ${perIntent}`)
  if (leads.length > 0) {
    lines.push('🔥 Propek minat-harga (untuk ACC manual Bos):')
    for (const l of leads.slice(0, 5)) {
      lines.push(`${l.username ? `@${l.username}` : '(tanpa nama)'} — "${snippetForReport(l.text, 40)}"`)
    }
    if (leads.length > 5) lines.push(`… dan ${leads.length - 5} lead lainnya`)
  } else {
    lines.push('Belum ada propek minat-harga kali ini.')
  }
  return lines.join('\n')
}

/* ── AKHIR OTAK MURNI ── */
