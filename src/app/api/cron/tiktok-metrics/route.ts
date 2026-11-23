import { NextRequest, NextResponse } from 'next/server'
import { getEnvVar } from '@/lib/cloudflare-bindings'
import { getCronAdmin } from '@/lib/cron-supabase'
import { getTiktokAccessToken } from '@/lib/tiktok'

/**
 * ============================================================
 * GET /api/cron/tiktok-metrics — SINTA BELAJAR PERFORMA TIKTOK
 * ============================================================
 * PERMINTAAN BOS (23 Nov 2026, saat app TikTok approved):
 * "bisa upload ke tiktok langsung dan analisis videoku".
 *
 * Cron ini menarik daftar video akun TikTok Bos (≤20 terbaru) via
 * TikTok Display API — POST /v2/video/list/ (field performa publik:
 * view_count, like_count, comment_count + share_url & cover) — lalu
 * UPSERT ke katalog `tiktok_posts` (url = permalink, UNIQUE).
 *
 * Efeknya di otak konten Sinta:
 *   • /api/cron/video-bot → fetchTopTikToks() kini PUNYA angka views/
 *     likes/komentar RIIL (dulu kolomnya 0 terus karena Display API
 *     belum diizinkan) → riset hook & pilihan topik berbasis performa.
 *   • Blok "PERFORMA KONTEN" di prompt LLM ikut akurat.
 *
 * Scope TikTok yang dibutuhkan: `video.list` — sudah ditambahkan ke
 * default scope di /api/tiktok/connect. Kalau token lama di-authorized
 * SEBELUM scope ini ada, Bos cukup buka ulang:
 *   https://luxtradee.web.id/api/tiktok/connect?key=<CRON_SECRET>
 *
 * Jadwal: numpang cron 01:00 UTC (08:00 WIB) di worker-entry.ts —
 * CF Free maks 5 cron trigger (slot penuh), pola sama dgn ig-metrics.
 * Auth: Bearer CRON_SECRET (fail-closed — pola master).
 */

export const dynamic = 'force-dynamic'

const VIDEO_LIST_URL = 'https://open.tiktokapis.com/v2/video/list/'
const VIDEO_FIELDS = [
  'id',
  'title',
  'share_url',
  'cover_image_url',
  'create_time',
  'view_count',
  'like_count',
  'comment_count',
].join(',')

interface TiktokVideoRow {
  id?: string
  title?: string
  share_url?: string
  cover_image_url?: string
  create_time?: number
  view_count?: number
  like_count?: number
  comment_count?: number
}

export async function GET(request: NextRequest) {
  const secret =
    (await getEnvVar('CRON_SECRET', { quiet: true })) || process.env.CRON_SECRET || ''
  const provided = request.headers.get('authorization')?.replace('Bearer ', '') || ''
  if (!secret || provided !== secret) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const admin = await getCronAdmin()
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Database not available' }, { status: 503 })
  }

  // ── 1. Access token fresh (refresh otomatis oleh lib, terenkripsi di KV) ──
  const tok = await getTiktokAccessToken()
  if (!tok.ok || !tok.token?.accessToken) {
    return NextResponse.json(
      { success: false, error: 'Token TikTok tidak tersedia — authorize dulu via /api/tiktok/connect', detail: tok.error || null },
      { status: 409 },
    )
  }
  const access = tok.token.accessToken

  // ── 2. Tarik ≤20 video terbaru akun (field performa publik) ──
  let videos: TiktokVideoRow[] = []
  try {
    const res = await fetch(VIDEO_LIST_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({ fields: VIDEO_FIELDS, max_count: 20 }),
      signal: AbortSignal.timeout(25_000),
    })
    const body = (await res.json().catch(() => null)) as
      | { data?: { videos?: TiktokVideoRow[] }; error?: { code?: string; message?: string } }
      | null
    if (!res.ok || body?.error?.code) {
      const msg = body?.error?.message || `HTTP ${res.status}`
      // error.code 'scope_not_authorized' = token lama belum punya video.list
      return NextResponse.json(
        { success: false, error: `video/list gagal: ${msg}`, code: body?.error?.code || null },
        { status: res.status === 403 ? 403 : 502 },
      )
    }
    videos = body?.data?.videos || []
  } catch (err) {
    return NextResponse.json(
      { success: false, error: `video/list error: ${String((err as Error)?.message || err).slice(0, 120)}` },
      { status: 502 },
    )
  }

  if (!videos.length) {
    return NextResponse.json({ success: true, synced: 0, note: 'Belum ada video di akun TikTok' })
  }

  // ── 3. UPSERT ke katalog tiktok_posts (url UNIQUE → anti baris kembar) ──
  const rows = videos
    .filter((v) => v.id)
    .map((v) => ({
      url: v.share_url || `https://www.tiktok.com/video/${v.id}`,
      caption: (v.title || '').trim().slice(0, 2200) || null,
      thumbnail_url: v.cover_image_url || null,
      views: Number.isFinite(v.view_count) ? Math.max(0, v.view_count as number) : 0,
      likes: Number.isFinite(v.like_count) ? Math.max(0, v.like_count as number) : 0,
      comments: Number.isFinite(v.comment_count) ? Math.max(0, v.comment_count as number) : 0,
      posted_at: v.create_time ? new Date(v.create_time * 1000).toISOString() : null,
    }))

  const { error: upErr } = await admin
    .from('tiktok_posts')
    .upsert(rows, { onConflict: 'url' })
  if (upErr) {
    return NextResponse.json({ success: false, error: `upsert gagal: ${upErr.message}` }, { status: 500 })
  }

  const totViews = rows.reduce((a, r) => a + r.views, 0)
  const totLikes = rows.reduce((a, r) => a + r.likes, 0)
  return NextResponse.json({
    success: true,
    synced: rows.length,
    totalViews: totViews,
    totalLikes: totLikes,
    source: tok.token.rotated ? 'refreshed' : 'cache/env',
  })
}
