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
 *   PUBLISH_CONTENT  → Meta Graph API (IG/FB) ATAU tabel blog_posts
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
import {
  envGet, sbConfig, ownerEmail, getActionById, decideAction, kvSetKey, kvIncrKey,
  fetchAllUserEmails, wibDay,
} from '@/lib/agent-proposals'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

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

async function executePayload(actionType: string, payload: Record<string, any>): Promise<{ ok: boolean; detail: string }> {
  switch (actionType) {
    /* ── EMAIL personal (Maya winback / Bagas upgrade offer) ── */
    case 'SEND_WINBACK_EMAIL':
    case 'SEND_UPGRADE_OFFER': {
      const emails: string[] = (payload.target_emails || []).map((e: unknown) => String(e)).filter(e => e.includes('@')).slice(0, 50)
      if (emails.length === 0) return { ok: false, detail: 'payload.target_emails kosong' }
      let okCount = 0, failCount = 0
      const errs: string[] = []
      for (const to of emails) {
        const name = to.split('@')[0].replace(/[._-]/g, ' ')
        const subject = String(payload.subject || (actionType === 'SEND_UPGRADE_OFFER' ? 'Penawaran khusus untuk trader aktif' : 'Balik lagi yuk — jurnalmu menunggu'))
        const html = actionType === 'SEND_WINBACK_EMAIL'
          ? String(payload.html_body || simpleHtml('Jurnal tradingmu menunggu. Upload 1 screenshot di https://luxtradee.web.id — AI evaluasi dalam 2 menit.'))
          : simpleHtml(String(payload.personalized_message || 'Versi PRO membuka evaluasi AI tanpa batas: https://luxtradee.web.id'))
        const r = await sendEmail({ to, subject, html })
        if (r.success) { okCount++; await kvIncrKey(sbConfig(), `resend_sent:${wibDay()}`) } else { failCount++; errs.push(`${to}: ${r.error || '?'}`) }
        await sleep(250) // throttle Resend free tier (2 req/detik)
      }
      if (okCount === 0) return { ok: false, detail: `Semua pengiriman gagal (${failCount}): ${errs.slice(0, 3).join(' | ')}` }
      return { ok: true, detail: `Terkirim ${okCount}/${emails.length} email${failCount ? ` — gagal ${failCount}: ${errs.slice(0, 2).join(' | ')}` : ''}` }
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
          headers: { apikey: cfg.anon, Authorization: `Bearer ${cfg.service}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify({ title: title || 'Update Market', content_body: body, media_url: String(payload.media_url || '') || null, author: 'Sinta (CMO — AI Agent)', status: 'published' }),
          signal: AbortSignal.timeout(15_000),
        })
        if (!res.ok) return { ok: false, detail: `Insert blog_posts gagal HTTP ${res.status}` }
        return { ok: true, detail: `Artikel blog dipublikasikan: "${title}"` }
      }
      // ig / instagram / facebook / fb → Meta Graph API nyata
      const caption = [title, body].filter(Boolean).join('\n\n')
      const r = await metaAutoPost(caption, String(payload.media_url || '') || undefined)
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

    /* ── Broadcast maintenance (Raka) → semua user via Resend ── */
    case 'BROADCAST_MAINTENANCE': {
      const cfg = sbConfig()
      const emails = await fetchAllUserEmails(cfg, 200)
      if (emails.length === 0) return { ok: false, detail: 'Tidak ada email user (admin API gagal / kosong)' }
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
      return { ok: true, detail: `Broadcast terkirim ke ${okCount}/${emails.length} user${failCount ? ` (gagal ${failCount})` : ''}` }
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
  const result = await executePayload(row.action_type, row.action_payload || {})
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
