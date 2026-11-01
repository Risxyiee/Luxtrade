/**
 * push-notify.ts — SATU PINTU pengiriman push otomatis (cron & event).
 *
 * Semua notifikasi yang HARUS tampil otomatis di layar user lewat sini:
 *   🚨 guard prop firm     (check-alerts.ts — sudah ada, tak diubah)
 *   📅 kalender ekonomi    (econ-calendar-notify — sudah ada, tak diubah)
 *   📈 sinyal Pine         (pine-alert-runner.ts → pushToUser)
 *   🎯 price alert         (/api/cron/price-alerts → pushToUser)
 *   💥 big win/loss dll    (/api/notifications/send-alert → pushToUser)
 *   🌅 reminder harian     (/api/cron/daily-reminder → pushToUser)
 *   📊 rekap mingguan      (/api/cron/weekly-summary → pushToUser)
 *
 * PAKAI:
 *   - Supabase service-role (getSupabaseAdmin) — Prisma mati diam-diam
 *     di CF Workers (temuan audit push PropFirm).
 *   - sendPushToUser (src/lib/web-push.ts) — jalur Node + CF-native.
 *   - Bersih-bersih OTOMATIS: endpoint balik 410/404 → hapus dari DB.
 *   - Dedupe in-memory 90s per (user+tag) — tameng tik cron ganda;
 *     dedupe lintas-bar tetap di DB (pine_alert_log, watchlist_price_alerts).
 *
 * CF-safe: tanpa API Node, tanpa Prisma.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendPushToUser, type PushPayload } from '@/lib/web-push'

export type PushNotifyPayload = PushPayload

export interface PushNotifyResult {
  sent: number
  /** Punya minimal 1 subscription tersimpan */
  hadSubs: boolean
  /** Endpoint mati (410/404) yang dihapus dari DB */
  removedExpired: number
  skipped?: 'dedupe' | 'no-subs'
  error?: string
}

const DEFAULT_ICON = '/icon-192x192.png'

/* ── Dedupe in-memory ───────────────────────────────────────────────────── */
const recent = new Map<string, number>()

export function pushDedupeOk(key: string, windowMs = 90_000): boolean {
  const now = Date.now()
  const last = recent.get(key)
  if (last !== undefined && now - last < windowMs) return false
  recent.set(key, now)
  // Housekeeping ringan — jangan biarkan Map tumbuh tanpa batas
  if (recent.size > 5000) {
    for (const [k, t] of recent) {
      if (now - t > windowMs) recent.delete(k)
    }
  }
  return true
}

/* ── Ambil subscription user (service-role) ─────────────────────────────── */
export async function getPushSubs(
  admin: SupabaseClient,
  userId: string
): Promise<{ endpoint: string; p256dh: string; auth: string }[]> {
  try {
    const { data, error } = await admin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId)
    if (error) return []
    return ((data ?? []) as { endpoint: string; p256dh: string; auth: string }[])
  } catch {
    return []
  }
}

/* ── Push ke SATU user ──────────────────────────────────────────────────── */
export async function pushToUser(
  admin: SupabaseClient,
  userId: string,
  payload: PushNotifyPayload,
  opts?: { dedupe?: boolean }
): Promise<PushNotifyResult> {
  try {
    if (opts?.dedupe !== false) {
      const key = `${userId}:${payload.tag || payload.title}`
      if (!pushDedupeOk(key)) {
        return { sent: 0, hadSubs: true, removedExpired: 0, skipped: 'dedupe' }
      }
    }

    const subs = await getPushSubs(admin, userId)
    if (!subs.length) {
      return { sent: 0, hadSubs: false, removedExpired: 0, skipped: 'no-subs' }
    }

    const res = await sendPushToUser(subs, { icon: DEFAULT_ICON, ...payload })

    // Hygiene: endpoint mati (410/404) langsung dibuang — token basi
    // jangan menumpuk (pelajaran FASE 5.3: akumulasi subscription basi).
    let removedExpired = 0
    if (res.expired.length) {
      const dels = await Promise.allSettled(
        res.expired.map((ep) =>
          admin.from('push_subscriptions').delete().eq('endpoint', ep)
        )
      )
      removedExpired = dels.filter((d) => d.status === 'fulfilled').length
    }

    return {
      sent: res.sent,
      hadSubs: true,
      removedExpired,
      error: res.failed.length ? res.errors[0] : undefined,
    }
  } catch (e) {
    return {
      sent: 0,
      hadSubs: false,
      removedExpired: 0,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

/* ── Push ke BANYAK user (cron) ─────────────────────────────────────────── */
export async function pushToUsers(
  admin: SupabaseClient,
  userIds: string[],
  payload: PushNotifyPayload | ((userId: string) => PushNotifyPayload),
  opts?: { delayMs?: number; dedupe?: boolean }
): Promise<PushNotifyResult[]> {
  const out: PushNotifyResult[] = []
  const delayMs = opts?.delayMs ?? 60
  for (let i = 0; i < userIds.length; i++) {
    const p = typeof payload === 'function' ? payload(userIds[i]) : payload
    out.push(await pushToUser(admin, userIds[i], p, opts))
    if (delayMs > 0 && i < userIds.length - 1) {
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  return out
}

/* ── Emoji sinyal Pine berdasarkan arah ─────────────────────────────────── */
export function signalEmoji(signal: string): string {
  const s = signal.toLowerCase()
  if (/sell|short|bear|down|put/.test(s)) return '🔴'
  if (/buy|long|bull|up|call/.test(s)) return '🟢'
  return '🧭'
}
