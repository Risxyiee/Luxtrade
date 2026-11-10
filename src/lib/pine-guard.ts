/**
 * pine-guard.ts — Tameng anti-BEKU untuk engine Pine di chart web (@luxalgo/vela).
 *
 * Masalah nyata (laporan Bos): "abis masang pine di chart, website fresh
 * gabisa dipencet apa apa". Akarnya: vela-pinets mengompilasi & menjalankan
 * Pine di MAIN THREAD browser — skrip dengan loop while yang tidak pernah
 * selesai / for dengan batas raksasa / skrip raksasa membuat seluruh halaman
 * hang (klik apa pun mati, tombol tutup editor pun ikut mati).
 *
 * Solusi: pre-flight SEBELUM source diserahkan ke chart.runIndicator() —
 * skrip berbahaya DITOLAK dengan pesan manusiawi, halaman tetap hidup.
 * Satu choke point di runOnChart mencakup semua jalur: simpan, preset,
 * restore fresh-load, dan tambah dari daftar skrip tersimpan.
 */

export interface PineGuardResult { ok: boolean; reason?: string }

/* Angka batas — ketat untuk mencegah hang, longgar untuk 99% skrip trading normal */
const MAX_CHARS = 80_000
const MAX_LINES = 1_200
const MAX_FOR_BOUND = 5_000
const MAX_SECURITY_CALLS = 10

/* Buang komentar // dan isi string "..." / '...' supaya kata while/for di
   dalam komentar/teks tidak salah menuduh */
function stripNoise(s: string): string {
  return s
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/"[^"\n]*"/g, '""')
    .replace(/'[^'\n]*'/g, "''")
}

export function pineGuardCheck(source: string): PineGuardResult {
  const src = String(source || '')
  if (!src.trim()) return { ok: false, reason: 'Skrip kosong — tulis dulu kode Pinenya.' }

  if (src.length > MAX_CHARS)
    return { ok: false, reason: `Skrip ${(src.length / 1000).toFixed(0)} ribu karakter — maksimal ${MAX_CHARS / 1000} ribu. Skrip raksasa bisa membekukan seluruh halaman chart.` }

  const lineCount = src.split('\n').length
  if (lineCount > MAX_LINES)
    return { ok: false, reason: `Skrip ${lineCount} baris — maksimal ${MAX_LINES}. Pecah jadi beberapa indikator atau sederhanakan.` }

  const code = stripNoise(src)

  /* 1) while — penyebab hang #1 (kondisi tak pernah false = halaman beku selamanya) */
  if (/\bwhile\b/i.test(code))
    return { ok: false, reason: 'Pine di chart web TIDAK boleh memakai loop "while" — kalau kondisinya tidak pernah selesai, seluruh halaman membeku (tidak bisa diklik apa pun). Ganti dengan "for" yang batasnya angka pasti, misal: for i = 0 to 100.' }

  /* 2) for dengan batas literal raksasa — penyebab hang #2 */
  for (const m of code.matchAll(/\bfor\b[^=\n]*=\s*\w+\s+to\s+(\d+)/gi)) {
    const bound = parseInt(m[1], 10)
    if (Number.isFinite(bound) && bound > MAX_FOR_BOUND)
      return { ok: false, reason: `Loop "for … to ${bound}" terlalu besar (maksimal ${MAX_FOR_BOUND}). Batas sebesar itu bisa membekukan halaman — kurangi rentangnya.` }
  }

  /* 3) request.security berlebihan — sangat berat (tiap call = fetch data ekstra) */
  const secCalls = (code.match(/\brequest\.security(?:_lower_tf)?\s*\(/gi) || []).length
  if (secCalls > MAX_SECURITY_CALLS)
    return { ok: false, reason: `Skrip memakai request.security ${secCalls}× — maksimal ${MAX_SECURITY_CALLS}. Tiap panggilan menarik data timeframe lain dan bisa membuat chart web tersendat.` }

  return { ok: true }
}
