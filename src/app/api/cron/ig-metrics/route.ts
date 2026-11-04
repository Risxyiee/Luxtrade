import { NextRequest, NextResponse } from 'next/server'
import { getEnvVar } from '@/lib/cloudflare-bindings'
import { getCronAdmin } from '@/lib/cron-supabase'
import { ensureFreshToken } from '@/lib/instagram'
import { aggregatePerf } from '@/lib/sinta-brain'

/**
 * ============================================================
 * GET /api/cron/ig-metrics — SINTA BELAJAR "MANA YANG RAME"
 * ============================================================
 * Permintaan Bos (Nov 2026): "dicoba mana yang rame mana yang ga".
 *
 * Cron ini menarik performa Reels IG yang sudah published (14 hari
 * terakhir) dari Graph API:
 *   • GET /{ig-media-id}?fields=like_count,comment_count
 *   • GET /{ig-media-id}/insights?metric=plays,reach,saved,shares
 *       (fallback bertahap kalau metric tidak tersedia)
 * lalu menyimpannya ke instagram_posts.meta.metrics.
 *
 * /api/cron/video-bot membaca meta.metrics tsb → rata-rata views per
 * template (tip/promo) → template pemenang dipakai 70% + 30% eksperimen,
 * dan blok "PERFORMA KONTEN" diinjeksi ke prompt LLM.
 *
 * Ditambah: satu pelajaran performa ditulis ke office_memory Sinta
 * supaya run berikutnya sadar angkanya (belajar dari data, bukan feeling).
 *
 * Jadwal: numpang cron 01:00 UTC (08:00 WIB) di worker-entry.ts —
 * CF Free hanya boleh 5 cron triggers (slot penuh).
 * Auth: Bearer CRON_SECRET (fail-closed).
 */

export const dynamic = 'force-dynamic'

const GRAPH_BASE = 'https://graph.facebook.com/v19.0'
/** Reels butuh 24-48 jam agar insight stabil — jangan tarik yang terlalu muda. */
const MIN_AGE_MS = 20 * 60 * 60 * 1000
const WINDOW_MS = 14 * 24 * 60 * 60 * 1000
const MAX_FETCH = 12

interface IgPostRow {
  id: string
  ig_post_id: string | null
  meta: Record<string, unknown> | null
  published_at: string | null
}

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const provided = request.headers.get('authorization')?.replace('Bearer ', '')
    || request.headers.get('x-cron-secret') || ''
  const expected = (await getEnvVar('CRON_SECRET')) || process.env.CRON_SECRET
  if (!expected) return process.env.NODE_ENV === 'development'
  return provided === expected
}

async function graphGet(path: string): Promise<{ ok: boolean; data?: Record<string, unknown> }> {
  try {
    const res = await fetch(`${GRAPH_BASE}${path}`, { signal: AbortSignal.timeout(12_000) })
    if (!res.ok) return { ok: false }
    return { ok: true, data: (await res.json()) as Record<string, unknown> }
  } catch {
    return { ok: false }
  }
}

/** Tarik insight satu media; metric list di-fallback bertahap (API berubah-ubah). */
async function fetchMediaMetrics(mediaId: string, token: string): Promise<Record<string, number> | null> {
  const fields = await graphGet(
    `/${encodeURIComponent(mediaId)}?fields=like_count,comment_count&access_token=${encodeURIComponent(token)}`,
  )
  if (!fields.ok || !fields.data) return null
  const f = fields.data as { like_count?: number; comment_count?: number }
  const out: Record<string, number> = {
    likes: Number(f.like_count ?? 0) || 0,
    comments: Number(f.comment_count ?? 0) || 0,
  }

  const metricSets = ['plays,reach,saved,shares', 'plays,reach', 'reach']
  for (const metric of metricSets) {
    const ins = await graphGet(
      `/${encodeURIComponent(mediaId)}/insights?metric=${metric}&access_token=${encodeURIComponent(token)}`,
    )
    if (!ins.ok || !ins.data) continue
    const rows = (ins.data as { data?: { name?: string; values?: { value?: number }[] }[] }).data || []
    for (const row of rows) {
      const val = Number(row?.values?.[0]?.value ?? 0) || 0
      if (row.name === 'plays') out.views = val
      else if (row.name === 'reach') out.reach = val
      else if (row.name === 'saved') out.saves = val
      else if (row.name === 'shares') out.shares = val
    }
    if (out.views || out.reach) break // set pertama yang valid cukup
  }
  return out
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const admin = await getCronAdmin()
  if (!admin) return NextResponse.json({ error: 'Database not available' }, { status: 503 })

  /* ── 1) Token IG (auto-refresh kalau tua) ── */
  const tok = await ensureFreshToken(admin)
  if (!tok.cfg) {
    return NextResponse.json({
      ok: true,
      skipped: 'FACEBOOK_PAGE_ID / FACEBOOK_PAGE_TOKEN belum diset — sinkron performa IG nonaktif',
    })
  }
  const token = tok.cfg.pageToken

  /* ── 2) Kandidat: Reels published ≤14 hari, belum disinkron baru-baru ini ── */
  const since = new Date(Date.now() - WINDOW_MS).toISOString()
  const { data, error } = await admin
    .from('instagram_posts')
    .select('id,ig_post_id,meta,published_at')
    .eq('status', 'published')
    .eq('media_type', 'REELS')
    .not('ig_post_id', 'is', null)
    .gte('published_at', since)
    .order('published_at', { ascending: false })
    .limit(30)

  if (error) {
    return NextResponse.json({ error: `Query instagram_posts gagal: ${error.message}` }, { status: 500 })
  }

  const rows = ((data || []) as IgPostRow[]).filter((r) => {
    const age = r.published_at ? Date.now() - Date.parse(r.published_at) : Infinity
    if (age < MIN_AGE_MS) return false // terlalu muda — insight belum stabil
    const meta = (r.meta || {}) as Record<string, unknown>
    const syncedAt = meta.metricsSyncedAt ? Date.parse(String(meta.metricsSyncedAt)) : 0
    // sudah pernah disinkron & terakhir <20 jam → skip (hemat kuota Graph)
    return !syncedAt || Date.now() - syncedAt > 20 * 60 * 60 * 1000
  })

  const targets = rows.slice(0, MAX_FETCH)
  const failures: { id: string; error: string }[] = []
  let synced = 0

  for (const row of targets) {
    if (!row.ig_post_id) continue
    const metrics = await fetchMediaMetrics(row.ig_post_id, token)
    if (!metrics || (!metrics.views && !metrics.likes && !metrics.reach)) {
      failures.push({ id: row.id, error: 'insight kosong / media tidak ditemukan (mungkin bukan milik Page ini)' })
      continue
    }
    const meta = (row.meta || {}) as Record<string, unknown>
    const { error: upErr } = await admin
      .from('instagram_posts')
      .update({
        meta: {
          ...meta,
          metrics,
          metricsSyncedAt: new Date().toISOString(),
        },
      })
      .eq('id', row.id)
    if (upErr) failures.push({ id: row.id, error: upErr.message })
    else synced++
  }

  /* ── 3) Ringkasan performa → pelajaran Sinta (office_memory) ── */
  let summary: Record<string, unknown> | null = null
  if (synced > 0) {
    const { data: all } = await admin
      .from('instagram_posts')
      .select('meta,published_at')
      .eq('status', 'published')
      .eq('media_type', 'REELS')
      .gte('published_at', since)
      .limit(60)
    const perf = aggregatePerf((all || []) as { meta?: Record<string, unknown> | null; published_at?: string | null }[])
    if (perf.samplePosts > 0) {
      const parts = Object.entries(perf.byTemplate)
        .map(([tpl, p]) => `${tpl} rata-rata ${p.avgViews.toFixed(0)} views / ${p.avgLikes.toFixed(0)} likes (${p.posts} konten)`)
        .join(' · ')
      const lesson =
        `PERFORMA IG 14 hari (sync ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB): ${parts}.` +
        (perf.winner
          ? ` Pemenang: ${perf.winner.toUpperCase()} — konten berikutnya 70% ikut pemenang, 30% eksperimen.`
          : ' Data belum cukup utk pemenang — lanjut eksperimen A/B.')
      try {
        await admin.from('office_memory').insert({
          agent_name: 'Sinta',
          memory_type: 'lesson',
          content: { lesson, kind: 'ig-performance', synced, perf: perf.byTemplate, runDate: new Date().toISOString() },
        })
      } catch { /* fail-open */ }
      summary = { ...perf, lesson }
    }
  }

  return NextResponse.json({
    ok: true,
    synced,
    considered: rows.length,
    failures,
    summary,
    note: 'Performa tersimpan di instagram_posts.meta.metrics → dibaca /api/cron/video-bot (A/B 70% pemenang / 30% eksperimen).',
  })
}
