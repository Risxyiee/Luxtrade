/**
 * ============================================================
 * user-quota.ts — Kuota freemium Luxtradee (Task 36)
 * ============================================================
 * Sumber kebenaran: tabel Supabase `user_quotas` (lihat
 * docs/SUPABASE_QUOTA_TABLES.sql). SEMUA operasi lewat service
 * role (getSupabaseAdmin) — count tidak bisa diakali dari client.
 *
 * Reset otomatis TANPA cron (lazy reset):
 *   - alert  : kalau `alerts_reset_date` ≠ tanggal hari ini (WIB) → 0
 *   (kuota edit Pine DIHAPUS — direktif Bos 2026-11-11: "vela lab hapus
 *   aja, ganti semuanya ke tradingview". Kolom lama di tabel dibiarkan,
 *   tidak lagi dibaca/ditulis.)
 * Tanggal pembanding dihitung di server, jadi user yang menunggu
 * lewat tengah malam WIB otomatis dapat kuota baru.
 *
 * Aturan (SOP Bos):
 *   - Free : alert maks 2×/hari
 *   - Pro  : tanpa batas (is_pro === true → pengecekan dilewati)
 */

import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

/* ---------- WIB helpers (UTC+7) — selaras dengan wibDay di ceo-agent ---------- */

/** Tanggal hari ini zona WIB, format YYYY-MM-DD. */
export function wibDay(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
}

/** Bulan ini zona WIB, format YYYY-MM. */
export function wibMonth(): string {
  return wibDay().slice(0, 7)
}

/* ---------- Batas freemium (satu tempat, mudah diubah) ---------- */
export const FREE_ALERT_LIMIT_PER_DAY = 2

/* ---------- Tipe ---------- */
export interface QuotaRow {
  user_id: string
  alerts_today_count: number
  alerts_reset_date: string | null
}

export type QuotaResult =
  | { ok: true; used: number; limit: number | null; isPro: boolean }
  | { ok: false; status: number; error: string; used: number; limit: number | null; isPro: boolean }

/* ---------- Internal ---------- */

function admin() {
  const supabase = getSupabaseAdmin()
  if (!supabase) throw new Error('SUPABASE_SERVICE_ROLE_KEY belum diset — kuota tidak bisa dibaca (cek Cloudflare → Variables & Secrets)')
  return supabase
}

/** Baca (dan lazy-reset bila perlu) baris kuota milik `userId`. Selalu mengembalikan baris. */
async function getQuotaRow(userId: string): Promise<QuotaRow> {
  const supabase = admin()
  const today = wibDay()

  const { data, error } = await supabase
    .from('user_quotas')
    .select('user_id, alerts_today_count, alerts_reset_date')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(`user_quotas read gagal: ${error.message} (pastikan SQL docs/SUPABASE_QUOTA_TABLES.sql sudah dijalankan)`)

  let row: QuotaRow = data ?? {
    user_id: userId,
    alerts_today_count: 0,
    alerts_reset_date: null,
  }

  /* Lazy reset — tanggal WIB sudah berganti? nolkan dan simpan. */
  const alertsStale = row.alerts_reset_date !== today
  if (!data || alertsStale) {
    row = {
      user_id: userId,
      alerts_today_count: alertsStale ? 0 : row.alerts_today_count,
      alerts_reset_date: today,
    }
    const { error: upErr } = await supabase
      .from('user_quotas')
      .upsert(row, { onConflict: 'user_id' })
    if (upErr) throw new Error(`user_quotas upsert gagal: ${upErr.message}`)
  }
  return row
}

/** is_pro dari tabel profiles (service role — bebas RLS). Default false bila kolom belum ada/gagal. */
export async function readIsPro(userId: string): Promise<boolean> {
  try {
    const supabase = admin()
    const { data, error } = await supabase
      .from('profiles')
      .select('is_pro, subscription_until, pro_expiry')
      .eq('id', userId)
      .maybeSingle()
    if (error || !data) return false
    if (data.is_pro !== true) return false
    /* PRO berbatas waktu? sudah lewat → hitung free (patroli ganda di atas
       patroli downgrade-expired yang sudah ada). */
    const until = data.subscription_until || data.pro_expiry
    if (until && new Date(String(until)).getTime() < Date.now()) return false
    return true
  } catch {
    return false
  }
}

/* ============================================================
   ALERT — free 2×/hari
   ============================================================
   CATATAN FIX (2026-11-05): tiga fungsi ini LUPA dibuat —
   /api/send-alert import checkAlertQuota / commitAlertQuota /
   alertQuotaExceededMessage sejak 2026-10-30, tapi belum pernah
   ada di file ini → webpack warning "Attempted import error" saat
   build dan 500 (TypeError) di production setiap /api/send-alert
   dipanggil. Trio kuota edit Pine yang lama DIHAPUS (Bos 2026-11-11). */

export async function checkAlertQuota(userId: string): Promise<QuotaRow & { isPro: boolean }> {
  const [row, isPro] = await Promise.all([getQuotaRow(userId), readIsPro(userId)])
  return { ...row, isPro }
}

export async function commitAlertQuota(userId: string): Promise<void> {
  const supabase = admin()
  const row = await getQuotaRow(userId)
  const { error } = await supabase
    .from('user_quotas')
    .update({ alerts_today_count: row.alerts_today_count + 1, alerts_reset_date: wibDay(), updated_at: new Date().toISOString() })
    .eq('user_id', userId)
  if (error) throw new Error(`user_quotas update gagal: ${error.message}`)
}

export function alertQuotaExceededMessage(): string {
  return 'Batas kirim alert gratis hari ini habis (2x/hari). Upgrade ke Pro (Rp49rb/bulan) untuk kirim alert sepuasnya!'
}
