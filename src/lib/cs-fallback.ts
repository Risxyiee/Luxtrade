/**
 * cs-fallback.ts — JAWABAN DETERMINISTIK CS BOT saat SEMUA provider LLM tumbang
 * ═════════════════════════════════════════════════════════════════════════════
 * Konteks produksi 2026-11-08: Gemini free tier habis kuota harian, Mortera
 * rate-limit, Groq key 403 → CS bot landing cuma bisa bilang "AI istirahat"
 * ke SEMUA pengunjung. Padahal pertanyaan paling umum (harga, cara daftar,
 * sinyal, kontak admin) bisa dijawab JUJUR tanpa LLM.
 *
 * FILE INI MURNI: tanpa import, tanpa network, tanpa env — CF Workers safe,
 * dites langsung dari kode asli. Aturan:
 *   - Jangan pernah mengarang angka (member, profit, sinyal).
 *   - Jawaban singkat + selalu ada jalan keluar nyata (signup / Telegram).
 *   - Return null kalau tidak yakin → caller pakai pesan "AI istirahat".
 * ═════════════════════════════════════════════════════════════════════════════
 */

export interface CsfFallbackCtx {
  /** URL signup gratis. */
  signupUrl: string
  /** Handle Telegram support, mis. '@Risxyiee'. */
  telegram: string
}

const FallbackDefaults: CsfFallbackCtx = {
  signupUrl: 'https://luxtradee.web.id/auth/signup',
  telegram: '@Risxyiee',
}

/** Grup intent → jawaban deterministik (bahasa sesuai deteksi kasar). */
const FAQ: Array<{ keys: RegExp; id: string; en: string }> = [
  {
    // harga / berapa / premium / bayar / plan / langganan
    keys: /harga|berapa|biaya|premium|bayar|plan|paket|langganan|berlangganan|price|upgrade|pro\??.*(harga|biaya)|murah/i,
    id: 'Luxtradee ada plan GRATIS (10 trade/bulan + 10 tanya AI) dan PRO Rp49.000/bulan (trade unlimited, deteksi pola loss AI, auto-extract screenshot MT5/TV, equity curve, export CSV/PDF). Detail lengkap di halaman pricing ya! 😊',
    en: "Luxtradee has a FREE plan (10 trades/month + 10 AI queries) and PRO at Rp49,000/month (unlimited trades, AI loss-pattern detection, auto screenshot extraction, equity curve, CSV/PDF export). See the pricing page for details! 😊",
  },
  {
    // cara daftar / mulai / gabung / download / install
    keys: /cara (daftar|mulai|gabung|pakai|pake)|daftar|gabung|join|download|unduh|install|instal|apk|mulai dari mana|sign ?up|registrasi/i,
    id: `Tinggal daftar gratis di ${'{{signup}}'} — buat akun, catat trade pertamamu (bisa import CSV MT4/MT5 atau upload screenshot), analitik & insight AI langsung jalan. 📲`,
    en: `Just sign up free at ${'{{signup}}'} — create an account, log your first trade (CSV import from MT4/MT5 or upload a screenshot), and the AI analytics run instantly. 📲`,
  },
  {
    // sinyal / entry / buy / sell / vip
    keys: /sinyal|signal|entry|enter|buy|sell|tp|sl|vip|akurat/i,
    id: 'Sinyal VIP tayang langsung di dashboard (arah, entry, SL, TP) untuk user PRO — setiap ada peluang di XAU/USD. Daftar dulu gratis, nanti bisa upgrade kapan pun mau ikut sinyal. 📈',
    en: 'VIP signals appear live on the dashboard (direction, entry, SL, TP) for PRO users on XAU/USD opportunities. Start free and upgrade anytime to follow the signals. 📈',
  },
  {
    // admin / manusia / cs / bantuan / komplain / refund
    keys: /admin|manusia|cs\b|customer|bantuan|komplain|refund|uang kembali|lupa password|lupa akun|bantu saya|hubungi/i,
    id: `Untuk bantuan langsung dari tim kami, chat Telegram ${'{{tg}}'} ya — dibalas manusia, bukan bot. 📱`,
    en: `For direct help from our team, message Telegram ${'{{tg}}'} — answered by humans, not bots. 📱`,
  },
  {
    // apa itu luxtradee / fitur / buat apa
    keys: /luxtradee (itu|apa)|apa (itu|sih)? ?luxtradee|buat apa|buat apa sih|fungsi|fitur|jurnal|trading journal|aplikasi.*(apa|tentang)/i,
    id: 'Luxtradee itu jurnal trading AI untuk trader Indonesia — catat trade (manual, CSV, atau screenshot MT5/TradingView), AI analisis pola loss-mu (FOMO, overtrading, revenge trading), pantau equity curve & progress prop firm. Ada plan gratis kok! 😊',
    en: 'Luxtradee is an AI trading journal for Indonesian traders — log trades (manual, CSV, or MT5/TradingView screenshots), let AI detect your loss patterns (FOMO, overtrading, revenge trading), track equity curve & prop-firm progress. Free plan available! 😊',
  },
  {
    // aman / scAM / penipuan / data
    keys: /aman|scam|penipuan|tipu|data.*(jual|aman|privat)|privasi|keamanan/i,
    id: 'Data trade kamu tersimpan aman & terenkripsi, tidak dijual ke pihak ketiga, tanpa auto-renew, bisa stop kapan pun. Mau cek dulu? Mulai dari plan gratis — tanpa kartu kredit. 🔒',
    en: 'Your trade data is stored securely & encrypted, never sold, no auto-renew, cancel anytime. Try the free plan first — no credit card needed. 🔒',
  },
]

/** Normalisasi ringan: rapatkan spasi (jangan lowercase mentah-mentah agar regex case-insensitive cukup). */
function norm(text: string): string {
  return String(text ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * Jawab pertanyaan umum TANPA LLM. Return null kalau pesan di luar kamus
 * (jangan paksa — salah jawaban lebih buruk daripada "AI istirahat").
 */
export function csFallbackReply(message: string, language: string, ctx?: Partial<CsfFallbackCtx>): string | null {
  const text = norm(message)
  if (!text || text.length > 400) return null // terlalu panjang/kompleks → jangan nebak
  const c = { ...FallbackDefaults, ...(ctx || {}) }
  const en = String(language || 'id').toLowerCase().startsWith('en')
  for (const f of FAQ) {
    if (f.keys.test(text)) {
      const tpl = en ? f.en : f.id
      return tpl.replace('{{signup}}', c.signupUrl).replace('{{tg}}', c.telegram)
    }
  }
  return null
}
