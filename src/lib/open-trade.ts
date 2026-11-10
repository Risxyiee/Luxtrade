// ==================== KONVENSI "POSISI TERBUKA" (OPEN TRADE) ====================
// Laporan Bos (2026-11): "csv jurnal dah bisa tapi open trade belum ikut
// masuk jadinya 0 terus" — CSV jurnal berisi posisi yang MASIH JALAN (belum
// close, belum ada PnL) dan posisi itu tidak pernah masuk jurnal.
//
// Batasan: tabel `trades` produksi TIDAK punya kolom `status` (terverifikasi
// via probe PostgREST: 42703 column trades.status does not exist) dan tidak
// ada akses DDL dari repo → status open disimpan lewat KONVENSI pada kolom
// `notes` yang sudah ada: catatan diawali sentinel `#OPEN#`.
//
// Kenapa `#OPEN#`: aman untuk SQL LIKE (tanda `#` bukan wildcard, beda dengan
// `[`/`%`), jadi `.like('notes', '#OPEN#%')` bisa dipakai Supabase tanpa
// migrasi. NULL-notes otomatis gak kena like → tiga-nilai SQL aman di jalur
// pencarian positif; penyaringan negatif (exclude open) dilakukan di JS.

export const OPEN_TRADE_NOTE = '#OPEN#'

/** True bila notes diawali sentinel open (#OPEN# persis, atau #OPEN# catatan). */
export function isOpenTrade(t: { notes?: string | null } | null | undefined): boolean {
  return typeof t?.notes === 'string' && t.notes.startsWith(OPEN_TRADE_NOTE)
}

/** Bangun notes untuk posisi terbuka (sentinel + catatan user opsional). */
export function buildOpenNote(extra?: string | null): string {
  const rest = (extra || '').trim()
  return rest ? `${OPEN_TRADE_NOTE} ${rest}` : OPEN_TRADE_NOTE
}

/** Catatan tampilan: sentinel dibuang supaya user tidak lihat "#OPEN#". */
export function displayNotes(notes?: string | null): string {
  if (!notes) return ''
  return notes.startsWith(OPEN_TRADE_NOTE) ? notes.slice(OPEN_TRADE_NOTE.length).trim() : notes
}
