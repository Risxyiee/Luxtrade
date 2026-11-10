/**
 * ============================================================
 * /api/execute-action — TANGAN CEO (Human-in-the-Loop, Task 34)
 * ============================================================
 * Dipanggil saat CEO menekan [✅ ACC & Eksekusi] / [❌ Tolak]
 * di komponen "Antrean Eksekusi" (Dashboard Alexander).
 *
 * POST body: { id: "<uuid>", decision: "approve" | "reject" }
 *
 * AUTH: HANYA CEO — Bearer token Supabase Bos (email = OWNER_EMAIL).
 * Cron tidak boleh mengeksekusi aksi; keputusan manusia wajib.
 *
 * Switch-case eksekusi NYATA per action_type (TANPA mock):
 *   SEND_WINBACK_EMAIL / SEND_UPGRADE_OFFER → Resend (src/lib/email)
 *   PUBLISH_CONTENT  → platform 'blog' → tabel blog_posts; 'tiktok' →
 *                      setor skrip ke studio video Sinta (agent_kv, dipakai
 *                      video sore) + pelajaran selera Bos; ig/fb → Meta Graph API
 *   UPDATE_AB_TEST   → simpan varian ke agent_kv (sistem record A/B)
 *   BROADCAST_MAINTENANCE → email ke semua user via Resend
 *   TRIGGER_INTERNAL_TASK → kirim task ke Discord ops (webhook)
 *   TOGGLE_FREE_FEATURES  → feature flag agent_kv (dibaca auto-jurnal)
 *
 * Setelah aksi native sukses → status 'approved' + hasil eksekusi
 * dicatat di kolom executed_result. Ditolak → 'rejected'.
 * Kalau eksekusi native GAGAL TOTAL → row TETAP 'pending' (CEO bisa
 * coba lagi), response 502 dengan alasan jujur.
 */
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { metaAutoPost } from '@/lib/meta-post'
import { ensureFreshToken, postToInstagram, checkMediaUrlAlive } from '@/lib/instagram'
import { getCronAdmin } from '@/lib/cron-supabase'
import { sendAdminNotification } from '@/lib/admin-notify'
import {
  envGet, sbConfig, ownerEmail, getActionById, decideAction, kvSetKey, kvGetKey, kvIncrKey,
  fetchAllUsers, fetchUnsubscribedUserIds, wibDay,
} from '@/lib/agent-proposals'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/* ═══════════════════════════════════════════════════════════════════
   WINDOW POSTING IG — 18:00–19:59 WIB, Senin–Jumat
   (permintaan Bos 8 Nov 2026: "karyawan yang kerjaan posting konten
   itu jam 18-19 waktu posting wib bukan seenaknya jam berapa — ini
   di acc kontennya langsung diposting")

   DULU: konten di-ACC → langsung publish SAAT ITU (jam berapa pun).
   KINI: ACC di luar window → konten masuk antrean instagram_posts
   (status pending, scheduled_for = 18:00 WIB berikutnya, libur
   Sabtu/Minggu) → dipublish otomatis ig-auto-post (cron 18:45 &
   20:30 WIB). ACC DI DALAM window → tetap langsung tayang.
   ═══════════════════════════════════════════════════════════════ */
const IG_WINDOW_HOURS_WIB = [18, 19]
/** Jeda minimum antar Reels: 20 jam — sama dengan ig-video-post. */
const REELS_MIN_GAP_MS = 20 * 60 * 60 * 1000

/** Jam sekarang dalam WIB (UTC+7), 0–23. */
function wibHourNow(): number {
  return (new Date().getUTCHours() + 7) % 24
}

/** Hari kerja WIB (0=Minggu .. 6=Sabtu) — geser +7 jam lalu baca UTC. */
function wibWeekday(): number {
  return new Date(Date.now() + 7 * 3_600_000).getUTCDay()
}

/** Apakah sekarang masuk window posting 18–19 WIB (Senin–Jumat)? */
function inIgPostWindow(): boolean {
  const day = wibWeekday()
  if (day === 0 || day === 6) return false // Sabtu/Minggu libur
  return IG_WINDOW_HOURS_WIB.includes(wibHourNow())
}

/** 18:00 WIB berikutnya (≥ after) — 18:00 WIB = 11:00 UTC. Sabtu/Minggu dilewati. */
function nextIgWindowStart(after: Date = new Date()): Date {
  const d = new Date(Date.UTC(after.getUTCFullYear(), after.getUTCMonth(), after.getUTCDate(), 11, 0, 0))
  if (d.getTime() <= after.getTime()) d.setUTCDate(d.getUTCDate() + 1)
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1)
  return d
}

/** Label WIB ramah: "Sen, 9 Nov 18.00 WIB" untuk pesan detail/notif. */
function wibLabel(ms: number): string {
  return (
    new Date(ms).toLocaleString('id-ID', {
      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
    }) + ' WIB'
  )
}

/** Bearer token Bos → Supabase auth → cocokkan OWNER_EMAIL. */
async function isOwner(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return false
  const token = authHeader.slice(7).trim()
  if (!token) return false
  const cfg = sbConfig()
  if (!cfg.url || !cfg.anon) return false
  try {
    const res = await fetch(`${cfg.url}/auth/v1/user`, {
      headers: { apikey: cfg.anon, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return false
    const user = (await res.json()) as { email?: string }
    return (user?.email || '').toLowerCase().trim() === ownerEmail()
  } catch { return false }
}

function simpleHtml(body: string): string {
  return String(body || '')
    .split(/\n{2,}/)
    .map(p => `<p style="margin:0 0 12px">${String(p).replace(/\n/g, '<br/>')}</p>`)
    .join('')
}

/* ---------- eksekusi per action_type ---------- */

async function executePayload(actionType: string, payload: Record<string, any>, actionId?: string): Promise<{ ok: boolean; detail: string }> {
  switch (actionType) {
    /* ── EMAIL personal (Maya winback / Bagas upgrade offer) ──
       🚫 SUPPRESSION (penutup temuan audit M3/M4/B2): user yang pernah
       unsubscribe (re_engagement_emails / daily_reminder_logs) dan alamat
       yang BOUNCED (webhook Resend → agent_kv open:{email}.bounced) tidak
       di-email — gerbang akhir untuk SEMUA jalur (master cron, sweep,
       cron COO). Fail-open: baca gagal → kirim (perilaku lama). */
    case 'SEND_WINBACK_EMAIL':
    case 'SEND_UPGRADE_OFFER': {
      const cfgMail = sbConfig()
      const emails: string[] = (payload.target_emails || []).map((e: unknown) => String(e)).filter(e => e.includes('@')).slice(0, 50)
      if (emails.length === 0) return { ok: false, detail: 'payload.target_emails kosong' }
      let unsubEmails = new Set<string>()
      try {
        const [unsubIds, users] = await Promise.all([
          fetchUnsubscribedUserIds(cfgMail),
          fetchAllUsers(cfgMail, 300),
        ])
        for (const u of users) if (u.email && unsubIds.has(u.id)) unsubEmails.add(u.email.toLowerCase())
      } catch { /* fail-open */ }
      let skippedUnsub = 0, skippedBounce = 0
      let okCount = 0, failCount = 0
      const errs: string[] = []
      for (const to of emails) {
        const toNorm = to.toLowerCase().trim()
        if (unsubEmails.has(toNorm)) { skippedUnsub++; continue }
        try {
          const rawSig = await kvGetKey(cfgMail, `open:${toNorm}`)
          if (rawSig && (JSON.parse(rawSig) as { bounced?: boolean }).bounced) { skippedBounce++; continue }
        } catch { /* fail-open */ }
        const subject = String(payload.subject || (actionType === 'SEND_UPGRADE_OFFER' ? 'Penawaran khusus untuk trader aktif' : 'Balik lagi yuk — jurnalmu menunggu'))
        const html = actionType === 'SEND_WINBACK_EMAIL'
          ? String(payload.html_body || simpleHtml('Jurnal tradingmu menunggu. Upload 1 screenshot di https://luxtradee.web.id — AI evaluasi dalam 2 menit.'))
          : simpleHtml(String(payload.personalized_message || 'Versi PRO membuka evaluasi AI tanpa batas: https://luxtradee.web.id'))
        const r = await sendEmail({ to, subject, html })
        if (r.success) {
          okCount++
          await kvIncrKey(cfgMail, `resend_sent:${wibDay()}`)
          /* M1: cooldown winback MULAI SAAT EMAIL BENERAN TERKIRIM —
             dulu ditulis saat draf dibuat, sehingga draf yang Bos tolak /
             abaikan tetap membekukan lead 14 hari. Phase 'sent' = penuh
             14 hari; phase 'draft' (dari cron) = proteksi antre 3 hari. */
          if (actionType === 'SEND_WINBACK_EMAIL') {
            await kvSetKey(cfgMail, `winback:${toNorm}`, JSON.stringify({ phase: 'sent', at: new Date().toISOString() }))
          }
        } else { failCount++; errs.push(`${to}: ${r.error || '?'}`) }
        await sleep(250) // throttle Resend free tier (2 req/detik)
      }
      if (okCount === 0) {
        if (failCount === 0 && skippedUnsub + skippedBounce > 0) {
          return { ok: true, detail: `Tidak ada yang dikirim — ${skippedUnsub} unsubscribe, ${skippedBounce} bounce (suppression) — tidak gagal, hanya difilter` }
        }
        return { ok: false, detail: `Semua pengiriman gagal (${failCount}): ${errs.slice(0, 3).join(' | ')}` }
      }
      return { ok: true, detail: `Terkirim ${okCount}/${emails.length} email${failCount ? ` — gagal ${failCount}: ${errs.slice(0, 2).join(' | ')}` : ''}${skippedUnsub ? ` — ${skippedUnsub} dilewati (unsubscribe)` : ''}${skippedBounce ? `, ${skippedBounce} dilewati (bounce)` : ''}` }
    }

    /* ── EMAIL welcome lead baru (Kevin/Growth Sentinel — migrasi 043) ──
       Visitor landing yang menitipkan email ke CS bot → draf masuk
       antrean ini. ACC Bos → kirim via Resend → lead status 'emailed'.
       Suppression tetap dihormati (bounce list) — email lead bukan user,
       tapi kalau pernah bounce jangan ganggu lagi. */
    case 'GROWTH_WELCOME_EMAIL': {
      const cfgMail = sbConfig()
      const to = String(payload?.lead?.email || '').toLowerCase().trim()
      const leadId = String(payload?.lead?.leadId || '')
      if (!to.includes('@')) return { ok: false, detail: 'payload.lead.email tidak valid' }
      const subject = String(payload.subject || 'Sinyal & tips trading gratis dari Luxtradee').slice(0, 160)
      const body = String(payload.body || '').trim()
      if (body.length < 20) return { ok: false, detail: 'payload.body terlalu pendek' }
      try {
        const rawSig = await kvGetKey(cfgMail, `open:${to}`)
        if (rawSig && (JSON.parse(rawSig) as { bounced?: boolean }).bounced) {
          return { ok: true, detail: 'Dilewati — email pernah bounce (suppression)' }
        }
      } catch { /* fail-open */ }
      const r = await sendEmail({ to, subject, html: simpleHtml(body) })
      if (!r.success) return { ok: false, detail: `Resend gagal: ${r.error || 'unknown'}` }
      await kvIncrKey(cfgMail, `resend_sent:${wibDay()}`)
      // Tandai lead 'emailed' (tabel opsional — gagal tidak membatalkan email)
      try {
        const sb = await getCronAdmin()
        if (sb && leadId) {
          await sb.from('growth_leads').update({ status: 'emailed', notes: 'email welcome terkirim (ACC Bos)' }).eq('id', leadId)
        }
      } catch { /* non-kritis */ }
      return { ok: true, detail: `Email welcome terkirim ke ${to.replace(/(.{2}).+(@.*)/, '$1***$2')}` }
    }

    /* ── Konten (Sinta) → Instagram/Facebook ATAU blog ── */
    case 'PUBLISH_CONTENT': {
      const platform = String(payload.platform || 'ig').toLowerCase()
      const title = String(payload.title || '').slice(0, 200)
      const body = String(payload.content_body || '')
      if (!body && !title) return { ok: false, detail: 'payload kosong (title & content_body)' }
      if (platform === 'blog') {
        const cfg = sbConfig()
        const res = await fetch(`${cfg.url}/rest/v1/blog_posts`, {
          method: 'POST',
          /* FIX Bos 6 Nov: apikey = service key (dulu apikey=anon) — anon yang
             dirotasi bikin request admin 401 padahal service_role sehat. */
          headers: { apikey: cfg.service, Authorization: `Bearer ${cfg.service}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify({ title: title || 'Update Market', content_body: body, media_url: String(payload.media_url || '') || null, author: 'Sinta (CMO — AI Agent)', status: 'published' }),
          signal: AbortSignal.timeout(15_000),
        })
        if (!res.ok) return { ok: false, detail: `Insert blog_posts gagal HTTP ${res.status}` }
        return { ok: true, detail: `Artikel blog dipublikasikan: "${title}"` }
      }
      /* ── TikTok (draf skrip Sinta pagi) → SETOR ke studio video ──
         FIX kekurangan Sinta (7 Nov): dulu platform 'tiktok' jatuh ke
         cabang Meta di bawah → ACC Bos untuk skrip TikTok mencoba posting
         caption ke IG/FB (salah platform) dan skrip TIDAK PERNAH dipakai.
         Kini: skrip ter-ACC disimpan di agent_kv `sinta:approved_script`
         → video-bot shift sore (19.10 WIB) WAJIB memakainya sebagai inti
         video hari itu + Sinta dapat pelajaran selera Bos di office_memory. */
      if (platform === 'tiktok') {
        const rawDrafts = Array.isArray(payload.drafts) ? payload.drafts : []
        const drafts = rawDrafts
          .map((d: Record<string, unknown>) => ({
            hook: String(d?.hook || '').slice(0, 200),
            script: String(d?.script || '').slice(0, 2200),
            caption: String(d?.caption || '').slice(0, 400),
            cta: String(d?.cta || '').slice(0, 200),
          }))
          .filter((d: { hook: string; script: string }) => d.hook && d.script)
        if (!drafts.length) return { ok: false, detail: 'Draf TikTok kosong (payload.drafts tidak valid)' }
        const cfg = sbConfig()
        const approved = {
          approvedAt: new Date().toISOString(),
          approvedDay: wibDay(),
          actionId: String(actionId || ''),
          title,
          analysis: String(payload.analysis || '').slice(0, 600),
          drafts,
        }
        const kvOk = await kvSetKey(cfg, 'sinta:approved_script', JSON.stringify(approved))
        // Pelajaran selera Bos — Sinta pagi berikutnya belajar hook mana yang disetujui
        try {
          const sb = await getCronAdmin()
          if (sb) {
            await sb.from('office_memory').insert({
              agent_name: 'Sinta',
              run_date: wibDay(),
              memory_type: 'lesson',
              content: {
                lesson: `Bos ACC skrip TikTok hari ini (${drafts.length} skrip, hook pertama: "${drafts[0].hook.slice(0, 90)}") — selera Bos: hook provokatif + CTA jelas. Studio video sore WAJIB pakai ini sebagai inti.`,
                approvedBy: ownerEmail() || 'bos',
                draftCount: drafts.length,
              },
            })
          }
        } catch { /* pelajaran opsional — ACC tetap sukses */ }
        return kvOk
          ? { ok: true, detail: `Skrip TikTok ter-ACC → disetor ke studio Sinta; dipakai sebagai inti video shift sore (hook: "${drafts[0].hook.slice(0, 60)}")` }
          : { ok: false, detail: 'Skrip valid tapi gagal disimpan ke agent_kv (sinta:approved_script)' }
      }
      // ig / instagram / facebook / fb → Meta Graph API nyata
      const caption = [title, body].filter(Boolean).join('\n\n')
      const mediaUrl = String(payload.media_url || '') || undefined

      /* ── WINDOW 18–19 WIB (permintaan Bos): konten foto Meta yang di-ACC
         di luar window tidak langsung tayang — masuk antrean instagram_posts
         (IMAGE) → dipublish ig-auto-post saat 18:00 WIB berikutnya. Tanpa
         media (teks FB saja) tetap langsung — bukan "konten" visual. */
      if (mediaUrl && !inIgPostWindow()) {
        const adminSched = await getCronAdmin()
        if (adminSched) {
          const schedMs = nextIgWindowStart().getTime()
          const { error: schedErr } = await adminSched
            .from('instagram_posts')
            .insert({
              media_type: 'IMAGE',
              image_url: mediaUrl,
              caption,
              status: 'pending',
              source: 'sinta-content',
              meta: {
                approvedBy: ownerEmail(),
                title,
                scheduleNote: `ACC Bos di luar window 18–19 WIB → tayang ${wibLabel(schedMs)} (libur Sabtu/Minggu)`,
              },
              scheduled_for: new Date(schedMs).toISOString(),
            })
          if (!schedErr) {
            await sendAdminNotification(
              `🖼️⏳ <b>Konten feed di-ACC → dijadwalkan tayang ${wibLabel(schedMs)}</b>\n` +
              `(ACC di luar window posting 18–19 WIB — bukan langsung posting)\n` +
              `⏰ ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`
            ).catch(() => {})
            return { ok: true, detail: `Konten di-ACC — dijadwalkan tayang ${wibLabel(schedMs)} (aturan window 18–19 WIB, Senin–Jumat).` }
          }
          /* gagal jadwal → jatuh ke publish langsung di bawah (jangan buang konten) */
        }
      }

      const r = await metaAutoPost(caption, mediaUrl)
      if (!r.posted) return { ok: false, detail: `Posting ${platform} gagal: ${r.reason || 'unknown'}` }
      return { ok: true, detail: `Terposting ke ${r.platform}${r.id ? ` (id ${r.id})` : ''}${r.permalink ? ` — ${r.permalink}` : ''}` }
    }

    /* ── A/B test (Farhan) → sistem record agent_kv ── */
    case 'UPDATE_AB_TEST': {
      const component = String(payload.component || 'hero_cta')
      const variant = String(payload.new_text_variant || '')
      if (!variant) return { ok: false, detail: 'payload.new_text_variant kosong' }
      const cfg = sbConfig()
      const saved = await kvSetKey(cfg, `ab:${component}`, JSON.stringify({ variant, split: String(payload.traffic_split || '50/50'), at: new Date().toISOString(), by: 'CEO-ACC' }))
      return saved
        ? { ok: true, detail: `Varian A/B "${component}" aktif (split ${payload.traffic_split || '50/50'}) — tersimpan di agent_kv:ab:${component}` }
        : { ok: false, detail: 'Gagal simpan varian ke agent_kv' }
    }

    /* ── Broadcast maintenance (Raka) → semua user via Resend ──
       🚫 SUPPRESSION (penutup temuan audit): user yang pernah unsubscribe
       (re_engagement_emails / daily_reminder_logs) tidak di-email lagi.
       Fail-open: tabel gagal dibaca → kirim semua (email operasional). */
    case 'BROADCAST_MAINTENANCE': {
      const cfg = sbConfig()
      const users = await fetchAllUsers(cfg, 250)
      if (users.length === 0) return { ok: false, detail: 'Tidak ada email user (admin API gagal / kosong)' }
      const unsub = await fetchUnsubscribedUserIds(cfg)
      const skippedUnsub = unsub.size ? users.filter(u => unsub.has(u.id)).length : 0
      const emails = [...new Set(users.filter(u => !unsub.has(u.id)).map(u => u.email))]
      if (emails.length === 0) return { ok: false, detail: `Semua ${users.length} user ada di suppression list — tidak ada yang dikirim` }
      const urgent = payload.urgent !== false
      const body = String(payload.email_body || 'Server sedang perbaikan. Coba lagi beberapa saat lagi.')
      const subject = `${urgent ? '[URGENT] ' : ''}Maintenance LuxTradee — mohon coba lagi nanti`
      let okCount = 0, failCount = 0
      for (const to of emails) {
        const r = await sendEmail({ to, subject, html: simpleHtml(body) })
        if (r.success) { okCount++; await kvIncrKey(cfg, `resend_sent:${wibDay()}`) } else { failCount++ }
        await sleep(300)
      }
      if (okCount === 0) return { ok: false, detail: `Broadcast gagal total (${failCount} user)` }
      return { ok: true, detail: `Broadcast terkirim ke ${okCount}/${emails.length} user${failCount ? ` (gagal ${failCount})` : ''}${skippedUnsub ? ` — ${skippedUnsub} dilewati (unsubscribe)` : ''}` }
    }

    /* ── Task internal (Dewi → Sinta dll) → Discord ops ── */
    case 'TRIGGER_INTERNAL_TASK': {
      const webhook = envGet('DISCORD_WEBHOOK_URL')
      if (!webhook) return { ok: false, detail: 'DISCORD_WEBHOOK_URL belum diset — task tidak bisa diteruskan' }
      const assignTo = String(payload.assign_to || 'Tim')
      const instruction = String(payload.task_instruction || '').slice(0, 900)
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: `📋 **TASK INTERNAL — untuk ${assignTo}** (deteksi: Dewi DA · ACC: CEO)\n${instruction}` }),
        signal: AbortSignal.timeout(15_000),
      })
      if (!res.ok) return { ok: false, detail: `Discord webhook HTTP ${res.status}` }
      return { ok: true, detail: `Task diteruskan ke ${assignTo} via Discord` }
    }

    /* ── Feature toggle (Putri) → flag agent_kv, dibaca auto-jurnal ── */
    case 'TOGGLE_FREE_FEATURES': {
      const feature = String(payload.feature || 'auto_journal')
      const action = String(payload.action || 'disable')
      const cfg = sbConfig()
      const a = await kvSetKey(cfg, `feature:${feature}:disabled`, action === 'disable' ? '1' : '0')
      const b = await kvSetKey(cfg, `feature:${feature}:reason`, String(payload.reason || 'ceo_decision'))
      if (!a) return { ok: false, detail: 'Gagal simpan feature flag ke agent_kv' }
      return { ok: true, detail: `Fitur "${feature}" ${action === 'disable' ? 'DINONAKTIFKAN' : 'diaktifkan kembali'} untuk free user (alasan: ${payload.reason || 'ceo_decision'})${b ? '' : ' (reason gagal disimpan)'}` }
    }

    /* ── Reels IG (Sinta, ACC Bos — mode approval default) → publish REELS ──
       Draft dibuat /api/cron/ig-video-post (TANPA row instagram_posts).
       Saat di-ACC: publish via Graph API (poll FINISHED) → baru catat
       riwayat instagram_posts status 'published' (sumber cadence/dedupe). */
    case 'PUBLISH_IG_REEL': {
      const videoUrl = String(payload.videoUrl || '')
      const caption = String(payload.caption || '')
      if (!videoUrl.startsWith('http')) return { ok: false, detail: 'payload.videoUrl tidak valid' }
      /* Pre-flight: file Reels masih ada di host? Media self-hosted KV
         ber-TTL 3 hari — draft yang diACC setelah lewat itu pasti gagal
         di sisi IG (2207082 "Media upload has failed"). Dengan cek ini
         Bos langsung tahu solusinya: render ulang, jadi tidak buang waktu. */
      const alive = await checkMediaUrlAlive(videoUrl)
      if (!alive.alive && alive.status >= 400 && alive.status < 500) {
        return {
          ok: false,
          detail: `Video Reels sudah TIDAK ADA di host (${alive.error}) — file media kedaluwarsa/KV terhapus, jadi tidak mungkin dipublish IG. CARA: jalankan ulang runner video (GitHub Actions "Sinta — Video" → Run workflow) untuk render baru, lalu ACC draft baru di Antrean Eksekusi. Draft lama ini ditolak otomatis.`,
        }
      }
      const admin = await getCronAdmin()
      if (!admin) return { ok: false, detail: 'Database tidak tersedia' }
      const tok = await ensureFreshToken(admin)
      if (!tok.cfg) return { ok: false, detail: 'FACEBOOK_PAGE_ID / FACEBOOK_PAGE_TOKEN belum diset (Cloudflare secrets)' }

      /* ── WINDOW 18–19 WIB (permintaan Bos): ACC di luar window TIDAK
         langsung posting. Konten masuk antrean instagram_posts → tayang
         18:00 WIB berikutnya (Senin–Jumat) via ig-auto-post (18:45 WIB).
         Cadence 20 jam antar Reels ikut dihormati (1 konten/hari). */
      const { data: lastReels } = await admin
        .from('instagram_posts')
        .select('published_at')
        .eq('media_type', 'REELS')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(1)
      const lastMs = lastReels?.[0]?.published_at ? Date.parse(lastReels[0].published_at) : null
      const cadenceOk = lastMs === null || Date.now() - lastMs >= REELS_MIN_GAP_MS

      if (!inIgPostWindow() || !cadenceOk) {
        const base = nextIgWindowStart()
        const cadMs = lastMs ? lastMs + REELS_MIN_GAP_MS : 0
        const schedMs = cadMs > base.getTime()
          ? nextIgWindowStart(new Date(cadMs)).getTime()
          : base.getTime()
        const alasan = !inIgPostWindow()
          ? `ACC di luar window posting (sekarang ${wibHourNow()}:00 WIB — jadwal 18–19 WIB, Senin–Jumat)`
          : 'cadence 1 Reels/hari (jeda 20 jam dari Reels terakhir)'
        const { error: schedErr } = await admin
          .from('instagram_posts')
          .insert({
            media_type: 'REELS',
            video_url: videoUrl,
            caption,
            status: 'pending',
            source: 'sinta-video',
            meta: {
              template: String(payload.template || 'reels'),
              hook: String(payload.hook || ''),
              ...(payload.angle ? { angle: String(payload.angle).slice(0, 40) } : {}),
              ...(payload.topic ? { topic: String(payload.topic).slice(0, 200) } : {}),
              renderBy: 'sinta (cmo) — remotion 9:16',
              approvedBy: ownerEmail(),
              scheduleNote: `ACC Bos → ${alasan} → tayang ${wibLabel(schedMs)} (window 18–19 WIB, libur Sabtu/Minggu)`,
            },
            scheduled_for: new Date(schedMs).toISOString(),
          })
        if (schedErr) return { ok: false, detail: `Gagal menjadwalkan konten: ${schedErr.message}` }
        await sendAdminNotification(
          `📸⏳ <b>Reels di-ACC → dijadwalkan tayang ${wibLabel(schedMs)}</b>\n` +
          `(${alasan} — bukan langsung posting, sesuai aturan window 18–19 WIB)\n` +
          `${caption ? caption.slice(0, 160) + (caption.length > 160 ? '…' : '') + '\n' : ''}` +
          `⏰ ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`
        ).catch(() => {})
        return {
          ok: true,
          detail: `Konten di-ACC — dijadwalkan tayang ${wibLabel(schedMs)} (${alasan}). Bukan langsung posting — aturan window 18–19 WIB.`,
        }
      }

      const r = await postToInstagram(tok.cfg, { mediaType: 'REELS', videoUrl, caption })
      if (!r.ok) return { ok: false, detail: `Publish IG gagal (stage ${r.stage || '?'}): ${r.error || '?'}` }
      // Riwayat publikasi — dipakai guard cadence 20 jam + cap harian ig-video-post
      try {
        await admin
          .from('instagram_posts')
          .insert({
            media_type: 'REELS',
            video_url: videoUrl,
            caption,
            status: 'published',
            source: 'sinta-video',
            ig_post_id: r.postId ?? null,
            permalink: r.permalink ?? null,
            published_at: new Date().toISOString(),
            error: null,
            meta: {
              template: String(payload.template || 'reels'),
              hook: String(payload.hook || ''),
              ...(payload.angle ? { angle: String(payload.angle).slice(0, 40) } : {}),
              ...(payload.topic ? { topic: String(payload.topic).slice(0, 200) } : {}),
              renderBy: 'sinta (cmo) — remotion 9:16',
              approvedBy: ownerEmail(),
            },
            scheduled_for: new Date().toISOString(),
          })
      } catch { /* riwayat gagal disimpan → tidak menggagalkan posting */ }
      await sendAdminNotification(
        `📸🎬 <b>Sinta posting Reels ke Instagram</b> (ACC Bos)\n` +
        `${caption ? caption.slice(0, 200) + (caption.length > 200 ? '…' : '') + '\n' : ''}` +
        (r.permalink ? `🔗 ${r.permalink}\n` : '') +
        `⏰ ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`
      ).catch(() => {})
      return { ok: true, detail: `Reels terposting ke Instagram${r.permalink ? ` — ${r.permalink}` : ''}` }
    }

    default:
      return { ok: false, detail: `Action type tidak dikenal: ${actionType}` }
  }
}

export async function POST(req: NextRequest) {
  if (!(await isOwner(req))) {
    return NextResponse.json({ error: 'Unauthorized — eksekusi khusus CEO (Bos).' }, { status: 401 })
  }
  let body: { id?: string; decision?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Body JSON tidak valid' }, { status: 400 }) }
  const id = String(body?.id || '')
  const decision = String(body?.decision || '')
  if (!id || !['approve', 'reject'].includes(decision)) {
    return NextResponse.json({ error: "Body wajib { id, decision: 'approve' | 'reject' }" }, { status: 400 })
  }

  const cfg = sbConfig()
  const row = await getActionById(cfg, id)
  if (!row) return NextResponse.json({ error: 'Proposal tidak ditemukan' }, { status: 404 })
  if (row.status !== 'pending') {
    return NextResponse.json({ error: `Proposal sudah diputuskan (status: ${row.status})` }, { status: 409 })
  }

  /* ── TOLAK ── */
  if (decision === 'reject') {
    const r = await decideAction(cfg, id, 'rejected', { ok: true, detail: 'Ditolak oleh CEO', decided_by: ownerEmail() })
    if (!r.ok) return NextResponse.json({ error: `Gagal update status: ${r.reason}` }, { status: 502 })
    console.log(`[execute-action] ${row.agent_name}/${row.action_type} DITOLAK CEO`)
    return NextResponse.json({ ok: true, status: 'rejected', detail: 'Proposal ditolak. Agen tidak akan mengusulkan hal sama dalam 24 jam.' })
  }

  /* ── ACC → EKSEKUSI NYATA ── */
  console.log(`[execute-action] CEO ACC ${row.agent_name}/${row.action_type} — mengeksekusi...`)
  const result = await executePayload(row.action_type, row.action_payload || {}, id)
  if (!result.ok) {
    // Eksekusi gagal → row TETAP pending supaya CEO bisa coba lagi; alasan jujur.
    console.error(`[execute-action] eksekusi GAGAL ${row.action_type}: ${result.detail}`)
    return NextResponse.json({ ok: false, error: `Eksekusi gagal: ${result.detail}`, status: 'pending' }, { status: 502 })
  }
  const upd = await decideAction(cfg, id, 'approved', { ok: true, detail: result.detail, decided_by: ownerEmail(), executed_at_real: new Date().toISOString() })
  if (!upd.ok) return NextResponse.json({ ok: true, status: 'approved', detail: `${result.detail} (catatan: gagal update status: ${upd.reason})` })
  console.log(`[execute-action] SUKSES ${row.action_type}: ${result.detail}`)
  return NextResponse.json({ ok: true, status: 'approved', detail: result.detail })
}
