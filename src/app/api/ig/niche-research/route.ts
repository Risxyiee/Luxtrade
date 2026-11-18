import { NextRequest, NextResponse } from 'next/server'
import { getEnvVar } from '@/lib/cloudflare-bindings'
import { getCronAdmin } from '@/lib/cron-supabase'

/**
 * ============================================================
 * GET /api/ig/niche-research — Baca hasil riset niche mingguan
 * ============================================================
 * Pembaca hasil riset /api/cron/ig-niche-research (dipasang Senin
 * 10:00 WIB dari slot cron laporan mingguan). Dipakai:
 *   • Sinta (CMO) saat menyusun konten mingguan — posisi kompetitor,
 *     tren hashtag, dan celah pasar gold-trading Indonesia.
 *   • Dashboard admin.
 *
 * Respons:
 *   { ok, week, item_count, research }      — tanpa ?week=
 *   { ok, week, research, archives: [...] } — ?weeks=1
 *   { ok, week, research }                  — ?week=2026-W47 (arsip)
 *
 * Data bersumber agent_kv (service-role): niche_research:latest /
 * niche_research:<ISO week>. Isi = hasil pencarian publik (Exa) soal
 * akun/hashtag kompetitor — tanpa data pribadi user Luxtradee.
 *
 * Auth (dua jalur, pola ceo-agent):
 *   • Bearer/x-cron-secret = CRON_SECRET (cron & Sinta server-side)
 *   • ?key = ADMIN_SECRET atau CRON_SECRET (dashboard/admin manual)
 * Fail-closed di produksi (tidak ada kunci → 401).
 */

export const dynamic = 'force-dynamic'

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const provided =
    request.headers.get('authorization')?.replace('Bearer ', '') ||
    request.headers.get('x-cron-secret') ||
    request.nextUrl.searchParams.get('key') ||
    ''
  const cronSecret = (await getEnvVar('CRON_SECRET')) || process.env.CRON_SECRET
  const adminSecret = (await getEnvVar('ADMIN_SECRET')) || process.env.ADMIN_SECRET
  const allowed = new Set([cronSecret, adminSecret].filter(Boolean))
  if (allowed.size === 0) return process.env.NODE_ENV === 'development'
  return allowed.has(provided)
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const admin = await getCronAdmin()
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: 'Supabase admin client tidak tersedia (env produksi wajib)' },
      { status: 503 },
    )
  }

  const sp = request.nextUrl.searchParams
  const wantList = sp.get('weeks') === '1'
  const wantedWeek = sp.get('week')
  const key = wantedWeek ? `niche_research:${wantedWeek}` : 'niche_research:latest'

  try {
    const { data } = await admin.from('agent_kv').select('key, value, updated_at').eq('key', key).maybeSingle()
    if (!data?.value) {
      return NextResponse.json({
        ok: true,
        week: wantedWeek || null,
        research: null,
        note: 'Belum ada riset tersimpan — tunggu cron Senin 10:00 WIB atau jalankan GET /api/cron/ig-niche-research?force=1',
      })
    }

    let research: Record<string, unknown> | null = null
    try {
      research = JSON.parse(data.value as string)
    } catch {
      return NextResponse.json({ ok: false, error: 'Payload riset korup (bukan JSON)' }, { status: 500 })
    }

    const week = (research?.week as string) || wantedWeek || null
    const resp: Record<string, unknown> = {
      ok: true,
      week,
      item_count: research?.item_count ?? null,
      updated_at: data.updated_at,
      research,
    }

    /* ?weeks=1 → daftar minggu arsip yang tersedia (tanpa payload berat). */
    if (wantList) {
      const { data: archiveRows } = await admin
        .from('agent_kv')
        .select('key, updated_at')
        .like('key', 'niche_research:20%')
        .order('key', { ascending: false })
      resp.archives = (archiveRows || []).map((r: { key: string; updated_at: string }) => ({
        week: r.key.replace('niche_research:', ''),
        updated_at: r.updated_at,
      }))
    }

    return NextResponse.json(resp)
  } catch (err: unknown) {
    /* agent_kv belum ada di produksi → jawab empty, bukan crash. */
    const msg = (err as Error)?.message || String(err)
    if (msg.includes('does not exist') || msg.includes('PGRST205')) {
      return NextResponse.json({ ok: true, week: null, research: null, note: 'Tabel agent_kv belum ada di produksi' })
    }
    console.error('[niche-research] baca gagal:', msg)
    return NextResponse.json({ ok: false, error: 'Gagal membaca riset' }, { status: 500 })
  }
}
