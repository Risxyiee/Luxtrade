/**
 * ============================================================
 * pine-alert-groups — Pembentukan grup alert dari langganan
 * ============================================================
 * Dipakai DUA route supaya logika identik (tidak ada duplikasi):
 *   - /api/cron/pine-alerts          (cron Cloudflare 15 menit — BACKUP)
 *   - /api/cron/pine-alerts/payload  (GHA runner — JALUR UTAMA)
 *
 * Alur: langganan enabled → saring skrip aktif + user Pro →
 * grup per (script, symbol, timeframe) dengan watermark anti-replay
 * `sinceSec` dari created_at langganan (sinyal sebelum user
 * mengaktifkan tidak di-replay).
 */

import {
  sanitizeSymbol,
  type RunnerScript, type RunnerUser,
} from '@/lib/pine-alert-runner'
import { DEFAULT_PINE_SLUG } from '@/lib/pine-default-meta'

type SupabaseClient = any

export interface AlertGroup {
  script: RunnerScript
  symbol: string
  interval: string
  users: RunnerUser[]
}

function isProRow(p: { is_pro?: boolean; subscription_until?: string | null; pro_expiry?: string | null }): boolean {
  if (p.is_pro !== true) return false
  const until = p.subscription_until || p.pro_expiry
  if (until && new Date(String(until)).getTime() < Date.now()) return false
  return true
}

export async function buildAlertGroups(
  supabase: SupabaseClient,
  opts?: { maxSubs?: number },
): Promise<{ groups: AlertGroup[]; checked: number; skippedNoScript: number; skippedNoPro: number }> {
  const maxSubs = opts?.maxSubs ?? 200

  /* 1) LANGGANAN AKTIF — created_at = watermark anti-replay sinyal
     historis utk langganan baru. script_kind: 'protected' | 'pine'
     (pine = Pine milik user sendiri — docs/PINE_ALERT_PINE_SCRIPTS.sql). */
  const { data: subs, error: subErr } = await supabase
    .from('pine_alert_subscriptions')
    .select('id, user_id, script_id, script_kind, symbol, timeframe, created_at')
    .eq('enabled', true)
    .limit(maxSubs)
  if (subErr) throw new Error(subErr.message.slice(0, 160))
  if (!subs?.length) return { groups: [], checked: 0, skippedNoScript: 0, skippedNoPro: 0 }

  const userIds = [...new Set(subs.map((s: any) => s.user_id))]
  /* Pisah sumber skrip per script_kind (FIX 2026-11-05). Pine
     DEFAULT dihapus — langganan lama ke default dilewati saja. */
  const protectedIds = [...new Set(subs.filter((s: any) => (s.script_kind || 'protected') === 'protected').map((s: any) => s.script_id))]
  const pineIds = [...new Set(subs.filter((s: any) => s.script_kind === 'pine').map((s: any) => s.script_id))]

  /* 2) SKRIP AKTIF + PROFIL (pro) — sekali query per run.
     Sumber 'pine' diambil dari pine_scripts (source milik user). */
  const [scriptsRes, pineScriptsRes, profRes] = await Promise.all([
    protectedIds.length
      ? supabase.from('protected_scripts')
          .select('id, slug, name, source, alert_rules')
          .eq('is_active', true)
          .in('id', protectedIds)
      : Promise.resolve({ data: [] as any[] | null }),
    pineIds.length
      ? supabase.from('pine_scripts')
          .select('id, name, source')
          .in('id', pineIds)
      : Promise.resolve({ data: [] as any[] | null }),
    supabase.from('profiles')
      .select('id, is_pro, subscription_until, pro_expiry')
      .in('id', userIds),
  ])

  const scripts = new Map<string, RunnerScript>()
  for (const r of scriptsRes.data || []) {
    if ((r as any).slug === DEFAULT_PINE_SLUG) continue // default dihapus — skip
    scripts.set(r.id, r as RunnerScript)
  }
  for (const r of pineScriptsRes.data || []) {
    scripts.set(r.id, { id: r.id, name: r.name, source: r.source, alert_rules: null })
  }

  const users = new Map<string, RunnerUser>()
  for (const p of profRes.data || []) {
    if (isProRow(p as any)) users.set(p.id, { userId: p.id })
  }

  /* 3) GRUP per (script, symbol, timeframe) — sejakSec dari created_at
     langganan: sinyal sebelum user mengaktifkan tidak di-replay */
  let skippedNoScript = 0
  let skippedNoPro = 0
  const groups = new Map<string, AlertGroup>()
  for (const s of subs as Array<Record<string, any>>) {
    const script = scripts.get(s.script_id)
    if (!script) { skippedNoScript++; continue } // skrip dinonaktifkan/dihapus → lewati
    const u = users.get(s.user_id)
    if (!u) { skippedNoPro++; continue } // bukan Pro → lewati
    const sym = sanitizeSymbol(String(s.symbol || ''))
    if (sym.length < 3) continue
    const tf = String(s.timeframe || '1h')
    const sinceSec = s.created_at ? Math.floor(new Date(String(s.created_at)).getTime() / 1000) || undefined : undefined
    const key = `${script.id}|${sym}|${tf}`
    const g = groups.get(key) || { script, symbol: sym, interval: tf, users: [] as RunnerUser[] }
    if (!g.users.some((x) => x.userId === u.userId)) {
      /* Satu langganan per (user,script,symbol,tf) — unique index;
         ambil watermark PALING LUAR (min) bila ada duplikat data */
      const existing = g.users.find((x) => x.userId === u.userId)
      if (!existing) g.users.push({ userId: u.userId, sinceSec })
      else if (sinceSec && (!existing.sinceSec || sinceSec < existing.sinceSec)) existing.sinceSec = sinceSec
    }
    groups.set(key, g)
  }

  return { groups: [...groups.values()], checked: subs.length, skippedNoScript, skippedNoPro }
}
