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
 *   - pine   : kalau `pine_reset_month`  ≠ bulan ini    (WIB) → 0
 * Tanggal pembanding dihitung di server, jadi user yang menunggu
 * lewat tengah malam WIB otomatis dapat kuota baru.
 *
 * Aturan (SOP Bos):
 *   - Free : alert maks 2×/hari · edit Pine maks 2×/bulan
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
export const FREE_PINE_EDITS_PER_MONTH = 2

/* ---------- Tipe ---------- */
export interface QuotaRow {
  user_id: string
  alerts_today_count: number
  alerts_reset_date: string | null
  pine_edits_month_count: number
  pine_reset_month: string | null
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
  const month = wibMonth()

  const { data, error } = await supabase
    .from('user_quotas')
    .select('user_id, alerts_today_count, alerts_reset_date, pine_edits_month_count, pine_reset_month')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(`user_quotas read gagal: ${error.message} (pastikan SQL docs/SUPABASE_QUOTA_TABLES.sql sudah dijalankan)`)

  let row: QuotaRow = data ?? {
    user_id: userId,
    alerts_today_count: 0,
    alerts_reset_date: null,
    pine_edits_month_count: 0,
    pine_reset_month: null,
  }

  /* Lazy reset — tanggal/bulan WIB sudah berganti? nolkan dan simpan. */
  const alertsStale = row.alerts_reset_date !== today
  const pineStale = row.pine_reset_month !== month
  if (!data || alertsStale || pineStale) {
    row = {
      user_id: userId,
      alerts_today_count: alertsStale ? 0 : row.alerts_today_count,
      alerts_reset_date: today,
      pine_edits_month_count: pineStale ? 0 : row.pine_edits_month_count,
      pine_reset_month: month,
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
   ALERT TELEGRAM — free 2×/hari
   ============================================================ */

/**
 * Cek + konsumsi 1 kuota alert. Panggil SEBELUM mengirim bila ingin
 * gagal-cepat, ATAU pakai pola `checkAlertQuota` + `commitAlertQuota`
 * (konsumsi HANYA saat Telegram sukses — jangan buang kuota user
 * karena error jaringan kita).
 */
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
  return 'Kuota alert gratis habis (maksimal 2x sehari). Upgrade ke Pro untuk alert tanpa batas!'
}

/* ============================================================
   PINE SCRIPT — free 2×/bulan
   ============================================================ */

export async function checkPineQuota(userId: string): Promise<QuotaRow & { isPro: boolean }> {
  const [row, isPro] = await Promise.all([getQuotaRow(userId), readIsPro(userId)])
  return { ...row, isPro }
}

export async function commitPineQuota(userId: string): Promise<void> {
  const supabase = admin()
  const row = await getQuotaRow(userId)
  const { error } = await supabase
    .from('user_quotas')
    .update({ pine_edits_month_count: row.pine_edits_month_count + 1, pine_reset_month: wibMonth(), updated_at: new Date().toISOString() })
    .eq('user_id', userId)
  if (error) throw new Error(`user_quotas update gagal: ${error.message}`)
}

export function pineQuotaExceededMessage(): string {
  return 'Batas edit skrip gratis bulan ini habis (2x/bulan). Upgrade ke Pro (Rp39rb/bulan) untuk edit sepuasnya!'
}
