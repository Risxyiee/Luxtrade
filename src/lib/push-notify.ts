/**
 * push-notify.ts — SATU PINTU pengiriman push otomatis (cron & event).
 *
 * Semua notifikasi yang HARUS tampil otomatis di layar user lewat sini:
 *   🚨 guard prop firm     (check-alerts.ts — sudah ada, tak diubah)
 *   📅 kalender ekonomi    (econ-calendar-notify — sudah ada, tak diubah)
 *   🧪 Pine Lab            (cron pine-lab → pushToUser)
 *   🎯 price alert         (/api/cron/price-alerts → pushToUser)
 *   💥 big win/loss dll    (/api/notifications/send-alert → pushToUser)
 *   🌅 reminder harian     (/api/cron/daily-reminder → pushToUser)
 *   📊 rekap mingguan      (/api/cron/weekly-summary → pushToUser)
 *
 * PAKAI:
 *   - Supabase service-role (getSupabaseAdmin) — Prisma mati diam-diam
 *     di CF Workers (temuan audit push PropFirm).
 *   - sendPushToUser (src/lib/web-push.ts) — jalur Node + CF-native.
 *   - NOTIFIKASI GAYA WHATSAPP: push layar HP muncul otomatis di
 *     notification tray walau app tertutup — satu-satunya jalur chat
 *     alert (integrasi Telegram lama SUDAH DIHAPUS; bot token revoked).
 *   - Bersih-bersih OTOMATIS: endpoint balik 410/404 → hapus dari DB.
 *   - Dedupe in-memory 90s per (user+tag) — tameng tik cron ganda;
 *     dedupe lintas-bar tetap di DB (watchlist_price_alerts).
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

/* ── Log pusat notifikasi (notification_log) ──────────────────────────────
   Setiap notifikasi yang melewati push-notify ikut DISIMPAN → tampil di
   Bell/NotificationCenter dashboard (desktop & user tanpa push tetap
   kebagian riwayat). Best-effort: tabel belum ada = diam saja, push
   utama TIDAK terganggu. Retensi 30 hari (dibersihkan daily-reminder). */
let logTableWarned = false

async function logNotification(
  admin: SupabaseClient,
  userId: string,
  payload: PushNotifyPayload
): Promise<void> {
  try {
    const { error } = await admin.from('notification_log').insert({
      user_id: userId,
      title: payload.title,
      body: payload.body,
      type: payload.type ?? 'general',
      url: payload.url ?? null,
      tag: payload.tag ?? null,
    })
    if (error && !logTableWarned) {
      logTableWarned = true
      console.warn('[push-notify] notification_log gagal (jalankan SQL 20261101_notification_log.sql):', error.message)
    }
  } catch {
    // non-fatal — feed in-app opsional, push utama tetap jalan
  }
}

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

    // Simpan ke feed in-app DULU (tanpa bergantung ada-tidaknya push subs
    // — desktop/user tanpa token tetap kebagian riwayat di Bell).
    await logNotification(admin, userId, payload)

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

/* ── Emoji sinyal berdasarkan arah ──────────────────────────────────────── */
export function signalEmoji(signal: string): string {
  const s = signal.toLowerCase()
  if (/sell|short|bear|down|put/.test(s)) return '🔴'
  if (/buy|long|bull|up|call/.test(s)) return '🟢'
  return '🧭'
}
