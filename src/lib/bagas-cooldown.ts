/**
 * 🔗 UNIFIKASI COOLDOWN BAGAS (COO) — penutup temuan audit E2E sistem
 * karyawan AI (2026-10-30): "DOBEL BAGAS — dua jalur tak saling tahu;
 * lead sama bisa dikontak 2x kalau Bos ACC dua-duanya."
 *
 * TIGA jalur Bagas kini berbagi SATU aturan cooldown (7 hari, LINTAS TABEL):
 *   ① /api/cron/ai-coo-agent      → draf ke `ai_pending_tasks` (agent_type='COO')
 *                                   → kini JUGA cek `ai_pending_actions`
 *   ② /api/agent-proposals sweep  → proposal ke `ai_pending_actions`
 *                                   (Bagas/SEND_UPGRADE_OFFER)
 *                                   → kini JUGA cek `ai_pending_tasks`
 *   ③ /api/cron/master-autonomous → proposal ke `ai_pending_actions`
 *                                   (sudah lintas tabel; kini pakai konstanta
 *                                   + parser yang sama dari modul ini)
 *
 * Kunci identitas lead:
 *   - EMAIL = kunci lintas tabel (ai_pending_actions tidak menyimpan user_id,
 *     hanya target_emails di action_payload JSONB).
 *   - user_id = kunci dalam ai_pending_tasks (target_user_id).
 *
 * Window cooldown mengikuti GREATEST(created_at, executed_at) via filter
 * PostgREST `or=(created_at.gte.X,executed_at.gte.X)` — proposal yang di-ACC
 * Bos telat tetap menghitung cooldown dari saat email BENERAN terkirim,
 * bukan cuma dari saat draf dibuat.
 *
 * FAIL-OPEN (pola rollback-safe): kalau salah satu tabel belum ada
 * (migrasi 011/015 belum jalan), query balik error → caller lanjut dengan
 * set kosong → perilaku lama. Tidak ada breakage.
 */

/** Window cooldown bersama semua jalur Bagas (hari). Dulu: cron COO 7 hari
 *  (ai_pending_tasks) vs sweep cuma dedup 24 jam (agent+action_type) —
 *  tidak saling tahu → inilah akar "DOBEL BAGAS". */
export const BAGAS_COOLDOWN_DAYS = 7

/** ISO timestamp batas cooldown: now − N hari. */
export function bagasCooldownSince(days: number = BAGAS_COOLDOWN_DAYS): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

/** Filter PostgREST (REST raw / sbSelect): baris dianggap "masih menyangkut
 *  lead" jika dibuat ATAU dieksekusi dalam window cooldown. */
export function bagasCooldownOrFilter(since: string): string {
  return `or=(created_at.gte.${since},executed_at.gte.${since})`
}

/** Ekspresi untuk supabase-js v2: .or(bagasCooldownOrExpr(since)). */
export function bagasCooldownOrExpr(since: string): string {
  return `created_at.gte.${since},executed_at.gte.${since}`
}

/** Normalisasi email: trim + lowercase (kunci pembanding lintas jalur). */
export function normEmail(e: unknown): string {
  return String(e ?? '').trim().toLowerCase()
}

/**
 * Baris `ai_pending_actions` (agent_name='Bagas') → kumpulan EMAIL target.
 * Membaca action_payload.target_emails (kontrak sweep + master-autonomous)
 * DAN action_payload.context[].email (master-autonomous menyimpan konteks
 * per-lead di sana) — dua bentuk payload, satu parser.
 */
export function emailsFromActionRows(rows: ReadonlyArray<unknown>): Set<string> {
  const out = new Set<string>()
  for (const row of rows) {
    const payload = (row as { action_payload?: { target_emails?: unknown; context?: unknown } } | null)?.action_payload
    if (!payload) continue
    if (Array.isArray(payload.target_emails)) {
      for (const e of payload.target_emails) {
        const n = normEmail(e)
        if (n.includes('@')) out.add(n)
      }
    }
    if (Array.isArray(payload.context)) {
      for (const c of payload.context) {
        const n = normEmail((c as { email?: unknown } | null)?.email)
        if (n.includes('@')) out.add(n)
      }
    }
  }
  return out
}

/**
 * Baris `ai_pending_tasks` (agent_type='COO') → { emails, userIds }.
 * emails  = context_data.email (draf penawaran & follow-up cron COO selalu
 *           mengisi ini), userIds = target_user_id.
 */
export function contactsFromTaskRows(rows: ReadonlyArray<unknown>): { emails: Set<string>; userIds: Set<string> } {
  const emails = new Set<string>()
  const userIds = new Set<string>()
  for (const row of rows) {
    const r = row as { target_user_id?: string | null; context_data?: { email?: unknown } | null } | null
    if (r?.target_user_id) userIds.add(r.target_user_id)
    const n = normEmail(r?.context_data?.email)
    if (n.includes('@')) emails.add(n)
  }
  return { emails, userIds }
}
