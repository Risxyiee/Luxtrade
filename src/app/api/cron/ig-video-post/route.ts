import { NextRequest, NextResponse } from 'next/server'
import { getEnvVar } from '@/lib/cloudflare-bindings'
import { getCronAdmin } from '@/lib/cron-supabase'
import { sendAdminNotification } from '@/lib/admin-notify'
import {
  ensureFreshToken,
  postToInstagram,
  validateIgPostInput,
  IG_DAILY_CAP,
} from '@/lib/instagram'
import { crossPostToFacebook, fbMetaEntry } from '@/lib/facebook-post'

/**
 * ============================================================
 * POST /api/cron/ig-video-post — Sinta (CMO) → Instagram Reels
 * ============================================================
 * Meja posting video karyawan Sinta: video Reels hasil render
 * Remotion (runner GitHub Actions upload MP4-nya ke host publik
 * dulu, mis. litterbox 72 jam) diposting ke IG sebagai REELS via
 * Facebook Page Graph API:
 *   POST /{page-id}/media?media_type=REELS&video_url=&caption=
 *   → poll FINISHED (1–5 menit) → /media_publish?creation_id=
 *
 * ATURAN JADWAL + MODE (update terakhir 19-11, arahan Bos: "auto acc
 *   konten aja" — capek ACC manual tiap hari, draft cuma numpuk di
 *   Antrean Eksekusi sementara host video ber-TTL 3 hari busuk duluan):
 *   • Runner video-bot-cron jalan 18:50 WIB (Senin–Jumat), render
 *     ±2–3 menit → POST ke sini ±19:00 WIB.
 *   • DEFAULT MODE = AUTO-ACC — konten TIDAK menunggu ACC manual lagi:
 *       – Di window 18–20 WIB + cadence aman → publish inline (±19:00).
 *       – Di luar window / cadence → diantrekan otomatis tayang ±19:00
 *         WIB berikutnya (Senin–Jumat) oleh ig-auto-post. Konten tidak
 *         hangus, tidak ditahan, tidak minta ACC.
 *     Bos tetap dapat notifikasi Discord (dengan permalink) tiap tayang.
 *   • Mode APPROVAL jadi OPT-IN: set env IG_AUTO_POST="approval" untuk
 *     balik ke gerbang ACC manual (draft → Kantor CEO → Antrean Eksekusi
 *     → /api/execute-action → publish REELS).
 *   • Cadence: 1x/hari (guard: Reels published terakhir ≥ 20 jam lalu)
 *   • Rotasi platform dikelola runner: semua hari → IG dulu (TikTok
 *     auto-fallback ke IG sampai app TikTok approved — perilaku sama,
 *     cuma penjelasan yang diperbarui)
 *   ?force=true → lewati window + cadence (publish inline paksa)
 *
 * FIX 2026-11-07 "auto post IG error": GitHub Actions sering MENUNDA
 * scheduled runs berjam-jam (run nyata: jadwal 12:10 UTC = 19:10 WIB
 * dieksekusi 19:18 UTC = 02:18 WIB). Dulu: window check di paling atas
 * → video hasil render DIBUANG → antrean kosong terus ("Antrean
 * kosong" di ig-auto-post) → IG tak pernah kebagian konten.
 * Sekarang: window + cadence HANYA membatasi mode AUTO (publish
 * langsung). Mode APPROVAL selalu menyimpan draft — timing ditentukan
 * momen ACC Bos, bukan momen runner jalan.
 *
 * Flow:
 *   1. Auth CRON_SECRET (fail-closed produksi)
 *   2. Validasi input
 *   3. Mode APPROVAL (opt-in IG_AUTO_POST=approval): draft disimpan di
 *      ai_pending_actions — timing ditentukan ACC Bos, bukan runner
 *   4. Mode AUTO (default): window 18–20 WIB + cadence 20 jam terpenuhi
 *      → publish inline; di luar itu → antrean 19:00 WIB berikutnya
 *      (konten tidak pernah dibuang)
 *   5. ensureFreshToken (token > 55 hari → refresh otomatis 60 hari)
 *   6. Enqueue instagram_posts (media_type REELS, source sinta-video)
 *   7. Publish inline (poll sampai 6 menit). Timeout → row 'publishing'
 *      di-reclaim ig-auto-post (09:00/19:00/20:30 WIB) — tidak hilang.
 *   8. Sukses/gagal → Discord admin (dengan permalink).
 *
 * GET → status cepat: kredensial, Reels terakhir, jadwal berikutnya.
 */
export const dynamic = 'force-dynamic'

/** Jeda minimum antar Reels: 20 jam — konten IG max 1x/hari (Senin–Jumat).
 *  Dulu 44 jam (2 hari sekali); Bos minta harian: "1 konten aja sehari". */
const MIN_GAP_MS = 20 * 60 * 60 * 1000
/** Window jam WIB yang diizinkan: 18–20 (FIX Bos 11-11: "kok ga post ig
 *  karyawanku" — mode AUTO dulu cuma [18,19]; runner GitHub sering TELAT
 *  (catatan route sendiri: run terjadwal 19:10 WIB dieksekusi 02:18 WIB),
 *  Reels yang selesai render jam 20:xx langsung DITOLAK window → hanya
 *  dijadwalkan besok → Bos merasa karyawan tidak posting. Kini jam 20
 *  ikut terbuka (senada ig-auto-post CONTENT_WINDOW [18,19,20] v.8) →
 *  Reels telat masih tayang hari itu via inline publish ATAU diambil
 *  jaring pengaman ig-auto-post 20:30 WIB. Di luar window → antrean
 *  besok (konten TIDAK hangus). */
const WINDOW_HOURS_WIB = [18, 19, 20]

/** 19:00 WIB berikutnya (≥ after) — 19:00 WIB = 12:00 UTC.
 *  Target tayang harian (Bos 17-11: "jam 19.00 ajaa"). Antrean yang
 *  gagal window/cadence dijadwalkan tayang 19:00 WIB berikutnya.
 *  Sabtu/Minggu DILEWATI (permintaan Bos: "sabtu minggu libur") —
 *  video buatan Jumat yang telat dieksekusi Sabtu dini hari tetap
 *  tayang Senin 19:00 WIB, bukan Sabtu/Minggu. */
function nextWindowStartWib(after: Date = new Date()): Date {
  const d = new Date(
    Date.UTC(after.getUTCFullYear(), after.getUTCMonth(), after.getUTCDate(), 12, 0, 0)
  )
  if (d.getTime() <= after.getTime()) d.setUTCDate(d.getUTCDate() + 1)
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1)
  return d
}

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const provided = request.headers.get('authorization')?.replace('Bearer ', '')
    || request.headers.get('x-cron-secret') || ''
  const expected = (await getEnvVar('CRON_SECRET')) || process.env.CRON_SECRET
  if (!expected) return process.env.NODE_ENV === 'development'
  return provided === expected
}

/** Jam sekarang dalam WIB (UTC+7), 0–23. */
function wibHourNow(): number {
  return (new Date().getUTCHours() + 7) % 24
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const admin = await getCronAdmin()
  if (!admin) return NextResponse.json({ error: 'Database not available' }, { status: 503 })

  const { data: lastReels } = await admin
    .from('instagram_posts')
    .select('id, caption, status, permalink, published_at, error')
    .eq('media_type', 'REELS')
    .order('created_at', { ascending: false })
    .limit(1)

  const last = lastReels?.[0] ?? null
  const lastMs = last?.published_at ? Date.parse(last.published_at) : null
  const approvalMode = (await getEnvVar('IG_AUTO_POST', { quiet: true }).catch(() => null)) === 'approval'
  return NextResponse.json({
    ok: true,
    postMode: approvalMode
      ? 'approval (nunggu ACC Bos — Kantor CEO → Antrean Eksekusi) — OPT-IN via IG_AUTO_POST=approval'
      : 'auto-acc (default — tayang otomatis ±19:00 WIB, tanpa ACC manual)',
    windowWib: WINDOW_HOURS_WIB,
    wibHourNow: wibHourNow(),
    cadenceHours: Math.round(MIN_GAP_MS / 3_600_000),
    nextEligibleAt: lastMs ? new Date(lastMs + MIN_GAP_MS).toISOString() : null,
    lastReels: last,
  })
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const force = url.searchParams.get('force') === 'true'
  const dry = url.searchParams.get('dry') === 'true'

  const body = await request.json().catch(() => null) as {
    videoUrl?: string
    caption?: string
    template?: string
    hook?: string
    /** id angle konten (mis. "pain-point") + topik — dipakai pembelajar
     *  performa per-angle (ig-metrics → sinta-brain aggregatePerf). */
    angle?: string
    topic?: string
  } | null
  const videoUrl = String(body?.videoUrl || '').trim()
  const caption = String(body?.caption || '').trim().slice(0, 2200)
  const angleMeta = String(body?.angle || '').trim().slice(0, 40)
  const topicMeta = String(body?.topic || '').trim().slice(0, 200)

  /* ── 1) Validasi input (paling awal — input jejak ditolak sebelum apa pun) ── */
  const invalid = validateIgPostInput({ mediaType: 'REELS', videoUrl, caption })
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

  if (dry) {
    return NextResponse.json({ ok: true, dry: true, message: 'Validasi Reels lolos — tidak disimpan (?dry=true)' })
  }

  const admin = await getCronAdmin()
  if (!admin) return NextResponse.json({ error: 'Database not available' }, { status: 503 })

  /* ── 2) MODE APPROVAL (kini OPT-IN: env IG_AUTO_POST=approval) ──
     DEFAULT adalah AUTO-ACC (Bos 19-11: "auto acc konten aja") — blok
     ini hanya jalan kalau Bos sengaja menyalakan gerbang manual.
     Draft SELALU disimpan walau runner jalan di luar window / cadence
     (GHA sering telat berjam-jam — dulu video dibuang sia-sia).
     ACC Bos = gerbang timing sesungguhnya. Draft disimpan di
     ai_pending_actions (PUBLISH_IG_REEL), dipublish oleh
     /api/execute-action setelah ACC. */
  const approvalMode = (await getEnvVar('IG_AUTO_POST', { quiet: true }).catch(() => null)) === 'approval'
  if (approvalMode) {
    const hour = wibHourNow()
    const offWindow = !force && !WINDOW_HOURS_WIB.includes(hour)
    /* Cap harian tetap dihormati */
    const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: pub24 } = await admin
      .from('instagram_posts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .gte('published_at', since24)
    if ((pub24 ?? 0) >= IG_DAILY_CAP) {
      return NextResponse.json({ ok: true, skipped: `cap harian tercapai (${IG_DAILY_CAP}/24 jam)` })
    }

    /* Jangan dobel draft untuk video yang sama */
    const { data: dup } = await admin
      .from('ai_pending_actions')
      .select('id')
      .eq('action_type', 'PUBLISH_IG_REEL')
      .eq('status', 'pending')
      .contains('action_payload', { videoUrl })
      .limit(1)
    if (dup?.length) {
      return NextResponse.json({
        ok: true,
        awaitingApproval: true,
        skipped: 'draft Reels ini sudah ada di Antrean ACC (tidak diduplikat)',
        actionId: dup[0].id,
      })
    }

    const { data: action, error: actErr } = await admin
      .from('ai_pending_actions')
      .insert({
        agent_name: 'Sinta',
        action_type: 'PUBLISH_IG_REEL',
        action_payload: {
          videoUrl,
          caption,
          template: body?.template || 'reels',
          hook: body?.hook || '',
          ...(angleMeta ? { angle: angleMeta } : {}),
          ...(topicMeta ? { topic: topicMeta } : {}),
          renderNote: 'remotion 9:16 + musik latar — ACC Bos → publish REELS',
          requestedWib: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
          ...(offWindow ? { lateRunNote: `Runner jalan di luar window (${hour}:00 WIB, jadwal 18–19 WIB — kemungkinan delay antrean GitHub Actions). Draft tetap disimpan — ACC Bos menentukan momen tayang.` } : {}),
        },
        status: 'pending',
      })
      .select('id')
      .single()
    if (actErr || !action) {
      return NextResponse.json({
        error: `Gagal simpan draft ACC (jalankan migrasi 015_create_ai_pending_actions.sql di Supabase?): ${actErr?.message || '?'}`,
      }, { status: 500 })
    }

    await sendAdminNotification(
      `📸⏳ <b>Sinta: draft Reels siap — menunggu ACC Bos</b>\n` +
      `${caption ? caption.slice(0, 200) + (caption.length > 200 ? '…' : '') + '\n' : ''}` +
      `🎬 Preview: ${videoUrl}\n` +
      `✅ ACC di: Kantor CEO → Antrean Eksekusi\n` +
      `⏰ ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`
    ).catch(() => {})

    return NextResponse.json({
      ok: true,
      awaitingApproval: true,
      mode: 'approval',
      actionId: (action as { id: string }).id,
      ...(offWindow ? { note: `Draft tersimpan walau runner telat (${hour}:00 WIB) — konten tidak hangus. ACC Bos di Kantor CEO → Antrean Eksekusi.` } : {}),
      note2: 'Mode approval aktif (IG_AUTO_POST=approval) — konten TIDAK diposting sampai Bos ACC (Kantor CEO → Antrean Eksekusi). Hapus env itu untuk kembali ke auto-acc (default).',
    })
  }

  /* ── 3) MODE AUTO (default AUTO-ACC): window 18–20 WIB + cadence 1x/hari ──
     FIX "auto post IG error" (lanjutan 2026-11-07): GHA TERBUKTI telat
     2 hari beruntun (jadwal 19:10 WIB dieksekusi 02:18 & 02:52 WIB).
     Dulu: di luar window → skip → video hasil render (±2 menit CPU
     runner) DIBUANG → antrean kosong terus → IG tak pernah kebagian
     konten. Sekarang video TIDAK PERNAH dibuang: di luar window /
     cadence → masuk antrean dgn scheduled_for = window 18:00 WIB
     berikutnya (lewati Sabtu/Minggu) yang memenuhi jeda 20 jam —
     ig-auto-post (09:00/19:00/20:30 WIB) yang publish saat jatuh tempo. */
  const hourAuto = wibHourNow()
  const inWindow = force || WINDOW_HOURS_WIB.includes(hourAuto)

  let lastMs: number | null = null
  if (!force) {
    const { data: recent } = await admin
      .from('instagram_posts')
      .select('id, published_at')
      .eq('media_type', 'REELS')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(1)
    lastMs = recent?.[0]?.published_at ? Date.parse(recent[0].published_at) : null
  }
  const cadenceOk = force || lastMs === null || Date.now() - lastMs >= MIN_GAP_MS

  if (inWindow && cadenceOk) {
    /* Di window + cadence aman → publish inline sekarang (lanjut ke bawah) */
  } else {
    /* Jadwalkan — konten disimpan, bukan dibuang */
    const cadenceMs = lastMs ? lastMs + MIN_GAP_MS : 0
    const base = nextWindowStartWib()
    const schedMs = cadenceMs > base.getTime()
      ? nextWindowStartWib(new Date(cadenceMs)).getTime()
      : base.getTime()
    const alasan = !inWindow
      ? `di luar window (${hourAuto}:00 WIB — jadwal 18:00–20:59 WIB)`
      : `cadence 1x/hari (jeda 20 jam — Reels terakhir ${((Date.now() - (lastMs || 0)) / 3_600_000).toFixed(1)} jam lalu)`
    const { data: sched, error: schedErr } = await admin
      .from('instagram_posts')
      .insert({
        media_type: 'REELS',
        video_url: videoUrl,
        caption,
        status: 'pending',
        source: 'sinta-video',
        meta: {
          template: body?.template || 'reels',
          hook: body?.hook || '',
          ...(angleMeta ? { angle: angleMeta } : {}),
          ...(topicMeta ? { topic: topicMeta } : {}),
          renderBy: 'sinta (cmo) — remotion 9:16',
          scheduledWib: `${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`,
          scheduleNote: `runner ${alasan} → video dijadwalkan tayang ±19:00 WIB (tidak dibuang) — window 18–20 WIB, libur Sabtu/Minggu`,
        },
        scheduled_for: new Date(schedMs).toISOString(),
      })
      .select('id')
      .single()
    if (schedErr || !sched) {
      return NextResponse.json({
        error: `Gagal simpan antrean terjadwal (jalankan migrasi 037 + 038 di Supabase?): ${schedErr?.message || '?'}`,
      }, { status: 500 })
    }
    await sendAdminNotification(
      `📸⏰ <b>Sinta: Reels dijadwalkan (runner di luar window — video tidak hangus)</b>\n` +
      `Alasan: ${alasan}\n` +
      `🗓️ Tayang: ${new Date(schedMs).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB\n` +
      `⏰ ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`
    ).catch(() => {})
    return NextResponse.json({
      ok: true,
      queued: true,
      scheduledFor: new Date(schedMs).toISOString(),
      reason: alasan,
      note: 'Video masuk antrean dgn jadwal 19:00 WIB — cron ig-auto-post yang mempublish saat jatuh tempo (window 18–20 WIB).',
    })
  }

  try {
    /* ── 4) Token segar (auto-refresh > 55 hari) ── */
    const tok = await ensureFreshToken(admin)
    if (!tok.cfg) {
      return NextResponse.json({
        ok: true,
        skipped: 'FACEBOOK_PAGE_ID / FACEBOOK_PAGE_TOKEN belum diset — fitur IG nonaktif (isi di Cloudflare secrets / .env)',
      })
    }

    /* Cap harian keamanan */
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count } = await admin
      .from('instagram_posts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .gte('published_at', since)
    if ((count ?? 0) >= IG_DAILY_CAP) {
      return NextResponse.json({ ok: true, skipped: `cap harian tercapai (${IG_DAILY_CAP}/24 jam)` })
    }

    /* ── 5) Enqueue (riwayat + retry otomatis oleh ig-auto-post) ── */
    const rowMeta = {
      template: body?.template || 'reels',
      hook: body?.hook || '',
      ...(angleMeta ? { angle: angleMeta } : {}),
      ...(topicMeta ? { topic: topicMeta } : {}),
      renderBy: 'sinta (cmo) — remotion 9:16',
      scheduledWib: `${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`,
    }
    const { data: inserted, error: insErr } = await admin
      .from('instagram_posts')
      .insert({
        media_type: 'REELS',
        video_url: videoUrl,
        caption,
        status: 'pending',
        source: 'sinta-video',
        meta: rowMeta,
        scheduled_for: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (insErr || !inserted) {
      return NextResponse.json({
        error: `Gagal simpan antrean (jalankan migrasi 037 + 038 di Supabase?): ${insErr?.message || '?'}`,
      }, { status: 500 })
    }
    const rowId = (inserted as { id: string }).id

    /* ── 6) Publish inline (poll Reels sampai 6 menit) ── */
    await admin
      .from('instagram_posts')
      .update({ status: 'publishing', attempts: 1, error: null })
      .eq('id', rowId)

    const r = await postToInstagram(tok.cfg, { mediaType: 'REELS', videoUrl, caption })

    if (r.ok) {
      await admin
        .from('instagram_posts')
        .update({
          status: 'published',
          ig_post_id: r.postId ?? null,
          permalink: r.permalink ?? null,
          published_at: new Date().toISOString(),
          error: null,
        })
        .eq('id', rowId)

      /* ── Cross-post Facebook (keluhan Bos 19-11: "post IG cuma IG, FB ga
         sekalian gabungin") — Reels yang tayang di IG langsung diposting
         sekalian ke feed Halaman FB (token Halaman sama, tanpa kredensial
         baru). Best-effort: gagal FB TIDAK menggagalkan IG — hasil jujur
         dicatat meta.fb + dilapor. */
      const fb = await crossPostToFacebook(tok.cfg, { mediaType: 'REELS', videoUrl, caption })
      await admin
        .from('instagram_posts')
        .update({ meta: { ...rowMeta, fb: fbMetaEntry(fb) } })
        .eq('id', rowId)

      await sendAdminNotification(
        `📸🎬 <b>Sinta posting Reels ke Instagram${fb.ok ? ' + Facebook' : ''}</b>\n` +
        `${caption ? caption.slice(0, 220) + (caption.length > 220 ? '…' : '') + '\n' : ''}` +
        (r.permalink ? `🔗 IG: ${r.permalink}\n` : '') +
        (fb.ok
          ? (fb.permalink ? `📘 FB: ${fb.permalink}\n` : `📘 FB: tayang (${fb.postId})\n`)
          : `📘 FB gagal (IG tetap tayang): ${(fb.error || '?').slice(0, 200)}\n`) +
        `⏰ ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`
      ).catch(() => {})

      return NextResponse.json({
        ok: true,
        posted: true,
        mediaType: 'REELS',
        postId: r.postId,
        permalink: r.permalink,
        fb: { ok: fb.ok, postId: fb.postId, permalink: fb.permalink, error: fb.ok ? undefined : fb.error },
        tokenRefreshed: tok.refreshed,
      })
    }

    /* Gagal publish → kalau masih bisa di-retry, biarkan ig-auto-post lanjutkan */
    await admin
      .from('instagram_posts')
      .update({ status: 'pending', error: `[stage:${r.stage || '?'}] ${r.error || '?'}`.slice(0, 500) })
      .eq('id', rowId)

    await sendAdminNotification(
      `📸⚠️ <b>Sinta: Reels IG gagal (akan di-retry cron)</b>\n` +
      `Stage: ${r.stage || '?'} — ${r.error || '?'}\n` +
      `⏰ ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`
    ).catch(() => {})

    return NextResponse.json({
      ok: false,
      posted: false,
      stage: r.stage,
      error: r.error,
      queued: true,
      note: 'Baris tetap pending — cron ig-auto-post akan mencoba lagi (09:00/19:00/20:30 WIB)',
    }, { status: 502 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg.slice(0, 200) }, { status: 500 })
  }
}
