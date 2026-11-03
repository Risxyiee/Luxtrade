import { NextRequest, NextResponse } from 'next/server'
import { getEnvVar } from '@/lib/cloudflare-bindings'
import { getCronAdmin } from '@/lib/cron-supabase'
import { sendAdminNotification } from '@/lib/admin-notify'
import {
  getIgConfig,
  refreshPageToken,
  TOKEN_REFRESH_AFTER_MS,
} from '@/lib/instagram'

/**
 * ============================================================
 * GET/POST /api/cron/ig-token-refresh — Refresh token IG 60 hari
 * ============================================================
 * Token Facebook Page umur ±60 hari. Cron ini jalan HARIAN:
 *   - usia token ≤ 55 hari → tidak ada yang dilakukan (lapor sisa hari)
 *   - usia > 55 hari (atau ?force=true) → fb_exchange_token
 *     (FACEBOOK_APP_ID + FACEBOOK_APP_SECRET) → token baru disimpan
 *     ke ig_token_state (DB) → semua cron IG otomatis pakai token baru.
 *   - Sukses/gagal → notifikasi Discord admin (jangan sampai token mati
 *     diam-diam dan posting IG berhenti tanpa kabar).
 *
 * Auth: Bearer/x-cron-secret = CRON_SECRET (fail-closed di produksi).
 * Cron: GitHub Actions instagram-cron.yml — 07:00 WIB harian.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return handle(request)
}
export async function POST(request: NextRequest) {
  return handle(request)
}

async function handle(request: NextRequest) {
  /* ── Auth cron (sama pola daily-reminder — fail-closed produksi) ── */
  const cronSecret = request.headers.get('authorization')?.replace('Bearer ', '')
    || request.headers.get('x-cron-secret') || ''
  const expectedSecret = (await getEnvVar('CRON_SECRET')) || process.env.CRON_SECRET
  if (!expectedSecret) {
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'CRON_SECRET not configured — endpoint disabled (fail-closed)' }, { status: 403 })
    }
  } else if (cronSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = await getCronAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 })
  }

  const force = new URL(request.url).searchParams.get('force') === 'true'

  try {
    const cfg = await getIgConfig(admin)
    if (!cfg) {
      return NextResponse.json({
        ok: true,
        skipped: 'FACEBOOK_PAGE_ID / FACEBOOK_PAGE_TOKEN belum diset — fitur IG nonaktif',
      })
    }

    const ageMs = cfg.issuedAt ? Date.now() - cfg.issuedAt : null
    const ageDays = ageMs != null ? Math.floor(ageMs / 86_400_000) : null
    const daysLeft = ageMs != null ? Math.max(0, 60 - Math.floor(ageMs / 86_400_000)) : null

    /* Belum waktunya refresh (dan tidak dipaksa) → lapor saja */
    const needsRefresh = force || ageMs == null || ageMs > TOKEN_REFRESH_AFTER_MS
    if (!needsRefresh) {
      return NextResponse.json({
        ok: true,
        refreshed: false,
        tokenSource: cfg.tokenSource,
        ageDays,
        daysLeft,
        message: `Token masih segar (${ageDays} hari) — refresh saat > 55 hari`,
      })
    }

    /* Refresh sekarang */
    const r = await refreshPageToken(admin, cfg)
    if (r.ok) {
      await sendAdminNotification(
        `📸🔁 <b>Token Instagram di-refresh</b>\n` +
        `Token baru aktif ±60 hari (tersimpan di ig_token_state).\n` +
        (daysLeft != null ? `Usia token lama: ${ageDays} hari.\n` : '') +
        `⏰ ${new Date().toLocaleString('id-ID')}`
      ).catch(() => {})
      return NextResponse.json({
        ok: true,
        refreshed: true,
        tokenSource: 'db',
        expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null,
        message: 'Token baru tersimpan — posting IG lanjut tanpa jeda',
      })
    }

    /* Gagal refresh → JANGAN diam-diam, alarm admin sekarang */
    await sendAdminNotification(
      `📸🚨 <b>REFRESH TOKEN INSTAGRAM GAGAL</b>\n` +
      `Usia token: ${ageDays ?? '?'} hari (batas 60).\n` +
      `Error: ${r.error}\n\n` +
      `⚡ Segera perbarui FACEBOOK_PAGE_TOKEN di dashboard Cloudflare/DB sebelum token mati!`
    ).catch(() => {})
    return NextResponse.json({ ok: false, refreshed: false, ageDays, error: r.error }, { status: 502 })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e).slice(0, 200) }, { status: 500 })
  }
}
