import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCronAdmin, isMissingTableError } from '@/lib/cron-supabase'
import { getEnvVar } from '@/lib/cloudflare-bindings'
import { sendDiscordNotification } from '@/lib/discord'
import { callLLM } from '@/lib/ai-llm'
import { ensureFreshToken, resolveIgUserId } from '@/lib/instagram'
import {
  classifyComment, buildAutoReply, pickHuntTargets, summarizeHunt,
  type HuntComment, type HuntResult, type HuntContext, type CommentClass,
} from '@/lib/comment-hunter'

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 💬 COMMENT HUNTER — "PEMBURU KOMENTAR" (karyawan AI pemantau komentar IG)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * PATUH ToS Instagram: HANYA memantau komentar pada POSTINGAN MILIK
 * SENDIRI lewat Graph API resmi (/{ig-user-id}/media → /{media-id}/comments
 * → /{comment-id}/replies). Tidak ada scraping, tidak menyentuh akun
 * orang lain, tidak automasi di luar endpoint resmi.
 *
 * SLOT CRON: numpang slot 15-menit yang sudah penuh (CF Free max 5
 * trigger) dengan THROTTLE INTERNAL via agent_kv 'comment-hunter:state':
 *   - Hunt beneran (panggil Graph API) MAKS tiap 2 jam.
 *   - Balasan otomatis MAKS 5/run dan 15/hari WIB (Asia/Jakarta).
 * Run di luar itu balas 'cooldown' tanpa menyentuh Graph API (hemat CPU
 * plan FREE 10ms).
 *
 * ALUR SATU HUNT:
 *   1. Gate tabel ig_comment_hunts (migrasi 045) — belum ada → skip jujur.
 *   2. Token IG: ensureFreshToken() (DB ig_token_state → env fallback) —
 *      kosong → skip jujur.
 *   3. Graph API: 5 media terakhir → 20 komentar terbaru per media
 *      (AbortSignal.timeout(10s) per call; satu media gagal → lanjut).
 *   4. Dedupe comment_id vs DB (limit 2000) → otak murni
 *      classifyComment/pickHuntTargets → insert jejak hunt.
 *   5. Yang aman + ada template + kuota sisa → POST /{comment-id}/replies
 *      → 'auto_replied' (gagal → 'failed', reply_text tetap draf).
 *   6. Intent 'lain' (tanpa template) → OPSIONAL 1 panggilan LLM buat
 *      draf balasan ramah → reply_text terisi, status 'drafted' (TIDAK
 *      pernah dibalas otomatis — nunggu ACC Bos).
 *   7. summarizeHunt → Discord HANYA bila ada komentar baru/lead.
 *
 * AUTH: Bearer/x-cron-secret = CRON_SECRET ATAU PINE_ALERT_CRON_SECRET
 * (fail-closed produksi; dev lokal tanpa secret diizinkan) — pola
 * growth-sentinel + price-alerts.
 *
 * OTAK MURNI di @/lib/comment-hunter (dites langsung dari kode asli via
 * Bun.Transpiler — marker blok MURNI).
 * ═══════════════════════════════════════════════════════════════════════
 */

export const dynamic = 'force-dynamic'

const RUN_VERSION = 'comment-hunter@1-pemburu'
/** Slot cron 15 menit, tapi hunt beneran maks tiap 2 jam (hemat CPU CF Free). */
const HUNT_COOLDOWN_MS = 2 * 60 * 60 * 1000
/** Kuota balasan otomatis — ketat biar tidak dianggap spam oleh IG. */
const MAX_REPLIES_PER_RUN = 5
const MAX_REPLIES_PER_DAY = 15
/** Cap komentar baru yang diproses per hunt. */
const MAX_NEW_PER_HUNT = 20
/** Media terakhir yang diperiksa + komentar per media. */
const MEDIA_LIMIT = 5
const COMMENTS_PER_MEDIA = 20
/** Timeout per panggilan Graph API (spesifikasi: 10 detik). */
const GRAPH_TIMEOUT_MS = 10_000
/** Produk URL signup (jangan hardcode di template otak — lewat HuntContext). */
const SIGNUP_URL = 'https://luxtradee.web.id/auth/signup'
const STATE_KEY = 'comment-hunter:state'

const GRAPH_VERSION = 'v19.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

/** Lock in-memory anti dobel-jalan (pola price-alerts/vip-signals). */
let running = false
let lastRunStart = 0

interface HunterState {
  lastRunAt?: string
  lastHuntAt?: string
  repliesToday?: number
  todayWib?: string
}

/* ── ENV helpers (pola growth-sentinel: CF binding → process.env) ────── */
async function envVal(name: string, fallback = ''): Promise<string> {
  try {
    const v = (await getEnvVar(name, { quiet: true })) || process.env[name] || ''
    return v || fallback
  } catch {
    return process.env[name] || fallback
  }
}

/** AUTH fail-closed — Bearer/x-cron-secret cocok CRON_SECRET atau PINE_ALERT_CRON_SECRET. */
async function isAuthorized(request: NextRequest): Promise<boolean> {
  const provided = String(
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
      request.headers.get('x-cron-secret') ||
      '',
  ).trim()
  const validSecrets = [
    await envVal('CRON_SECRET'),
    await envVal('PINE_ALERT_CRON_SECRET'),
  ].map((s) => s.trim()).filter(Boolean)
  if (!validSecrets.length) return process.env.NODE_ENV === 'development'
  return !!provided && validSecrets.includes(provided)
}

function clip(s: unknown, n: number): string {
  const t = String(s ?? '')
  return t.length <= n ? t : t.slice(0, n) + '…'
}

/** Tanggal hari ini versi WIB (Asia/Jakarta) — YYYY-MM-DD, utk reset kuota harian. */
function wibDateStr(d = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(d) // en-CA → YYYY-MM-DD
  } catch {
    return new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10)
  }
}

/* ── KV kecil (agent_kv — pola growth-sentinel) ──────────────────────── */
async function kvGet(admin: SupabaseClient, key: string): Promise<string | null> {
  try {
    const { data } = await admin.from('agent_kv').select('value').eq('key', key).maybeSingle()
    return (data as { value?: string } | null)?.value ?? null
  } catch { return null }
}
async function kvSet(admin: SupabaseClient, key: string, value: string): Promise<void> {
  try { await admin.from('agent_kv').upsert({ key, value }, { onConflict: 'key' }) } catch { /* non-kritis */ }
}

/* ── Klien Graph (fetch murni — graphCall instagram.ts tidak diekspor) ── */
function graphErrMsg(data: unknown, httpStatus: number): string {
  const g = (data as { error?: { message?: string; code?: number } } | null)?.error
  if (!g?.message) return `HTTP ${httpStatus}`
  let msg = String(g.message).slice(0, 220)
  if (g.code === 190) msg = `Token IG tidak valid/kedaluwarsa (code 190): ${msg}`
  return msg
}

async function graphGet(
  path: string, params: Record<string, string>, token: string,
): Promise<{ ok: boolean; data: Record<string, unknown> | null; error?: string }> {
  const qs = new URLSearchParams({ ...params, access_token: token })
  try {
    const res = await fetch(`${GRAPH_BASE}/${path}?${qs.toString()}`, {
      signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
    })
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
    if (!res.ok || (data as { error?: unknown } | null)?.error) {
      return { ok: false, data, error: graphErrMsg(data, res.status) }
    }
    return { ok: true, data }
  } catch (e) {
    return { ok: false, data: null, error: e instanceof Error ? e.message : String(e) }
  }
}

/** POST /{comment-id}/replies — balas komentar (Graph API resmi, media milik sendiri). */
async function graphPostReply(
  commentId: string, message: string, token: string,
): Promise<{ ok: boolean; error?: string }> {
  const body = new URLSearchParams({ message, access_token: token })
  try {
    const res = await fetch(`${GRAPH_BASE}/${commentId}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
    })
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
    if (!res.ok || (data as { error?: unknown } | null)?.error) {
      return { ok: false, error: graphErrMsg(data, res.status) }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Pelanggaran unique index (comment_id duplikat — race antar isolate). */
function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null
  return e?.code === '23505' || String(e?.message || '').includes('duplicate key')
}

/** Bersihkan output LLM → satu kalimat balasan siap pakai (atau null). */
function oneLineReply(raw: string | null | undefined): string | null {
  if (!raw) return null
  const firstLine = String(raw)
    .replace(/```[a-z]*\n?/gi, ' ')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .shift() || ''
  const clean = firstLine.replace(/^["'“”]+|["'“”]+$/g, '').trim()
  return clean ? clip(clean, 220) : null
}

const LLM_SYSTEM_PROMPT =
  'Kamu asisten media sosial Luxtradee (jurnal & sinyal trading untuk trader Indonesia). ' +
  'Tulis SATU balasan untuk satu komentar Instagram. ATURAN: 1 kalimat bahasa Indonesia ' +
  'santai & ramah, maksimal 150 karakter, maksimal 1 emoji. TANPA janji profit/keuntungan, ' +
  'TANPA kata "garansi" atau "pasti", TANPA minta DM. Boleh menyarankan coba gratis di ' +
  'https://luxtradee.web.id/auth/signup. Balas HANYA isi komentarnya (tanpa kutip, tanpa penjelasan).'

/* ── HANDLER ─────────────────────────────────────────────────────────── */
async function handle(_request: NextRequest): Promise<NextResponse> {
  if (running && Date.now() - lastRunStart < 10 * 60_000) {
    return NextResponse.json({ ok: true, action: 'skipped', reason: 'run sebelumnya masih jalan' })
  }
  running = true
  lastRunStart = Date.now()

  try {
    /* ── 1. Admin Supabase ── */
    const admin = await getCronAdmin()
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: 'Database unavailable (Supabase admin client gagal dibuat)' },
        { status: 503 },
      )
    }

    /* ── 2. Gate tabel (migrasi 045) — belum ada → skip jujur tanpa crash ── */
    const probe = await admin
      .from('ig_comment_hunts')
      .select('id', { count: 'exact', head: true })
      .limit(1)
    if (probe.error && isMissingTableError(probe.error)) {
      return NextResponse.json({
        ok: true, action: 'skipped',
        reason: 'tabel ig_comment_hunts belum ada — jalankan supabase-migrations/045_ig_comment_hunts.sql',
      })
    }

    /* ── 3. State + throttle (hunt beneran maks tiap 2 jam, kuota harian WIB) ── */
    let state: HunterState = {}
    try { state = JSON.parse((await kvGet(admin, STATE_KEY)) || '{}') as HunterState } catch { state = {} }
    const todayWib = wibDateStr()
    if (state.todayWib !== todayWib) {
      state.todayWib = todayWib
      state.repliesToday = 0
    }
    const lastHuntMs = state.lastHuntAt ? Date.parse(state.lastHuntAt) : 0
    const sinceHuntMs = lastHuntMs > 0 ? Date.now() - lastHuntMs : Number.POSITIVE_INFINITY
    if (sinceHuntMs < HUNT_COOLDOWN_MS) {
      state.lastRunAt = new Date().toISOString()
      await kvSet(admin, STATE_KEY, JSON.stringify(state))
      return NextResponse.json({
        ok: true, action: 'cooldown', checked: 0, newComments: 0, autoReplied: 0, leads: 0,
        reason: `hunt terakhir ${Math.max(1, Math.round(sinceHuntMs / 60_000))} menit lalu — jeda antar hunt 2 jam`,
        repliesToday: state.repliesToday || 0,
      })
    }

    /* ── 4. Token IG (helper yang sudah ada di lib/instagram.ts) ── */
    const fresh = await ensureFreshToken(admin)
    if (!fresh.cfg) {
      return NextResponse.json({
        ok: true, action: 'skipped', checked: 0, newComments: 0, autoReplied: 0, leads: 0,
        reason: 'token IG belum diset',
      })
    }
    if (fresh.refreshError) {
      console.error('[comment-hunter] refresh token IG gagal (lanjut dgn token lama):', clip(fresh.refreshError, 200))
    }
    const igCfg = fresh.cfg
    const igUserId = await resolveIgUserId(igCfg)
    if (!igUserId) {
      return NextResponse.json({
        ok: true, action: 'skipped', checked: 0, newComments: 0, autoReplied: 0, leads: 0,
        reason: 'akun IG profesional belum tertaut ke Halaman Facebook',
      })
    }

    /* ── 5. Graph API: media milik sendiri → komentar per media ── */
    const mediaRes = await graphGet(
      `${igUserId}/media`,
      { fields: 'id,permalink', limit: String(MEDIA_LIMIT) },
      igCfg.pageToken,
    )
    if (!mediaRes.ok) {
      // Sudah menghabiskan panggilan Graph → hitung sebagai hunt (jeda 2 jam juga)
      const nowIso = new Date().toISOString()
      state.lastRunAt = nowIso
      state.lastHuntAt = nowIso
      await kvSet(admin, STATE_KEY, JSON.stringify(state))
      return NextResponse.json({
        ok: false, action: 'skipped', checked: 0, newComments: 0, autoReplied: 0, leads: 0,
        reason: `Graph API daftar media gagal: ${clip(mediaRes.error, 200)}`,
      })
    }
    const mediaRows = ((mediaRes.data?.data as Array<{ id?: string; permalink?: string }> | undefined) || [])
      .filter((m) => m && typeof m.id === 'string' && !!m.id)

    const byMedia = new Map<string, HuntComment[]>()
    let mediaChecked = 0
    let mediaFailed = 0
    for (const m of mediaRows) {
      const mediaId = String(m.id)
      const cRes = await graphGet(
        `${mediaId}/comments`,
        { fields: 'id,text,username,timestamp', limit: String(COMMENTS_PER_MEDIA) },
        igCfg.pageToken,
      )
      if (!cRes.ok) {
        mediaFailed++ // satu media gagal → lanjut media lain
        console.error(`[comment-hunter] komentar media ${mediaId} gagal: ${clip(cRes.error, 160)}`)
        continue
      }
      mediaChecked++
      const rows = (cRes.data?.data as Array<{ id?: string; text?: string; username?: string }> | undefined) || []
      const list: HuntComment[] = byMedia.get(mediaId) || []
      for (const c of rows) {
        if (!c || typeof c.id !== 'string' || !c.id) continue
        list.push({
          mediaId,
          commentId: c.id,
          ...(c.username ? { username: String(c.username) } : {}),
          text: String(c.text ?? ''),
          ...(m.permalink ? { permalink: String(m.permalink) } : {}),
        })
      }
      byMedia.set(mediaId, list)
    }

    /* ── 6. Dedupe: comment_id yang sudah pernah diproses (limit 2000) ── */
    const existing = new Set<string>()
    try {
      const { data: seenRows, error: seenErr } = await admin
        .from('ig_comment_hunts').select('comment_id').limit(2000)
      if (seenErr) {
        console.error('[comment-hunter] baca existing comment_id gagal:', clip(seenErr.message, 160))
      } else {
        for (const r of (seenRows as Array<{ comment_id?: string }> || [])) {
          if (r?.comment_id) existing.add(String(r.comment_id))
        }
      }
    } catch (e) {
      console.error('[comment-hunter] baca existing comment_id error:', e instanceof Error ? e.message : e)
    }

    /* ── 7. Otak murni: pilih target + klasifikasi ── */
    const mediaForPicker = mediaRows.map((m) => ({
      id: String(m.id),
      comments: byMedia.get(String(m.id)) || [],
    }))
    const targets = pickHuntTargets(mediaForPicker, existing, MAX_NEW_PER_HUNT)
    const classByComment = new Map<string, CommentClass>()
    for (const t of targets) classByComment.set(t.commentId, classifyComment(t.text))

    /* Konteks balasan — social proof dari angka riil sentinel (kalau ada). */
    let socialProof = ''
    try {
      const rawProof = JSON.parse((await kvGet(admin, 'growth:social-proof')) || 'null') as { members?: number } | null
      if (rawProof && typeof rawProof.members === 'number' && rawProof.members > 0) {
        socialProof = `${rawProof.members}+ trader sudah ikut`
      }
    } catch { socialProof = '' }
    const huntCtx: HuntContext = { socialProof, signupUrl: SIGNUP_URL, hasTrial: false }

    /* ── 8. Insert jejak hunt + balas otomatis (dengan kuota ketat) ── */
    const repliesUsedToday = Math.max(0, Math.floor(state.repliesToday || 0))
    let repliesLeft = Math.min(MAX_REPLIES_PER_RUN, Math.max(0, MAX_REPLIES_PER_DAY - repliesUsedToday))

    const results: HuntResult[] = []
    const errors: string[] = []
    let autoReplied = 0
    let repliesSkippedByQuota = 0
    let insertsFailed = 0
    let tableGone = false

    for (const t of targets) {
      const cls = classByComment.get(t.commentId) || classifyComment(t.text)
      const template = cls.autoReplySafe ? buildAutoReply(cls.intent, huntCtx) : null
      // 'lain' tanpa template tetap 'drafted' — menunggu ACC Bos (opsional draf LLM di bawah)
      let status = template ? 'drafted' : 'skipped'
      if (cls.intent === 'lain') status = 'drafted'

      try {
        const { error: insErr } = await admin.from('ig_comment_hunts').insert({
          media_id: t.mediaId,
          permalink: t.permalink ?? null,
          comment_id: t.commentId,
          username: t.username ?? null,
          comment_text: t.text,
          intent: cls.intent,
          reply_text: template,
          status,
          lead_flag: cls.lead,
        })
        if (insErr) {
          if (isMissingTableError(insErr)) { tableGone = true; break }
          if (isUniqueViolation(insErr)) continue // isolate lain lebih dulu — abaikan
          insertsFailed++
          errors.push(`insert ${t.commentId}: ${clip(insErr.message, 120)}`)
          console.error('[comment-hunter] insert gagal:', clip(insErr.message, 200))
          continue
        }
      } catch (e) {
        insertsFailed++
        errors.push(`insert ${t.commentId}: ${clip(e instanceof Error ? e.message : String(e), 120)}`)
        continue
      }

      const baseResult = {
        intent: cls.intent, lead: cls.lead,
        ...(t.username ? { username: t.username } : {}), text: t.text,
      }

      if (template && cls.autoReplySafe) {
        if (repliesLeft <= 0) {
          // Kuota habis → draf tersimpan (ACC manual Bos), tidak dibalas otomatis
          repliesSkippedByQuota++
          results.push({ ...baseResult, status: 'drafted' })
          continue
        }
        const rep = await graphPostReply(t.commentId, template, igCfg.pageToken)
        if (rep.ok) {
          repliesLeft--
          autoReplied++
          state.repliesToday = (state.repliesToday || 0) + 1
          try {
            await admin.from('ig_comment_hunts')
              .update({ status: 'auto_replied', replied_at: new Date().toISOString() })
              .eq('comment_id', t.commentId)
          } catch { /* jejak status non-kritis */ }
          results.push({ ...baseResult, status: 'auto_replied' })
        } else {
          // reply_text TETAP draf — error hanya dicatat log + respons (bukan di DB)
          console.error(`[comment-hunter] balas ${t.commentId} gagal: ${clip(rep.error, 200)}`)
          errors.push(`balas ${t.commentId}: ${clip(rep.error, 140)}`)
          try {
            await admin.from('ig_comment_hunts').update({ status: 'failed' }).eq('comment_id', t.commentId)
          } catch { /* non-kritis */ }
          results.push({ ...baseResult, status: 'failed' })
        }
      } else {
        results.push({ ...baseResult, status })
      }
    }
    if (tableGone) {
      return NextResponse.json({
        ok: true, action: 'skipped', checked: mediaChecked, newComments: 0, autoReplied: 0, leads: 0,
        reason: 'tabel ig_comment_hunts hilang di tengah hunt — jalankan ulang supabase-migrations/045_ig_comment_hunts.sql',
      })
    }

    /* ── 9. LLM OPSIONAL (maks 1 panggilan): draf utk SATU komentar 'lain' ──
       Tidak pernah dibalas otomatis — reply_text diisi, status 'drafted',
       muncul di laporan Discord untuk ACC manual Bos. */
    let llmDraftedFor: string | undefined
    const lainTarget = targets.find((t) => classByComment.get(t.commentId)?.intent === 'lain')
    const lainTextSafe =
      !!lainTarget && lainTarget.text.length <= 300 && !/https?:\/\/|www\./i.test(lainTarget.text)
    if (lainTarget && lainTextSafe) {
      try {
        const llm = await callLLM(
          LLM_SYSTEM_PROMPT,
          `Komentar Instagram ${lainTarget.username ? `dari @${lainTarget.username}` : 'dari pengguna anonim'}: "${clip(lainTarget.text, 200)}"\nTulis balasannya.`,
          150,
        )
        const draft = oneLineReply(llm?.text)
        if (draft) {
          llmDraftedFor = lainTarget.commentId
          try {
            await admin.from('ig_comment_hunts')
              .update({ reply_text: draft, status: 'drafted' })
              .eq('comment_id', lainTarget.commentId)
          } catch { /* draf LLM non-kritis */ }
        }
      } catch (e) {
        console.error('[comment-hunter] LLM draf "lain" gagal (skip):', e instanceof Error ? e.message : e)
      }
    }

    /* ── 10. Simpan state hunt ── */
    const nowIso = new Date().toISOString()
    state.lastRunAt = nowIso
    state.lastHuntAt = nowIso
    await kvSet(admin, STATE_KEY, JSON.stringify(state))

    /* ── 11. Laporan Discord — HANYA bila ada komentar baru/lead (jangan spam saat sepi) ── */
    const leads = results.filter((r) => r.lead).length
    let discordSent: boolean | undefined
    if (results.length > 0) {
      const rep = await sendDiscordNotification(summarizeHunt(results))
      discordSent = rep.ok
    }

    /* ── 12. Respons jujur ── */
    return NextResponse.json({
      ok: true,
      action: 'hunted',
      version: RUN_VERSION,
      checked: mediaChecked,
      mediaFetched: mediaRows.length,
      mediaFailed,
      commentsFetched: [...byMedia.values()].reduce((n, l) => n + l.length, 0),
      newComments: targets.length,
      autoReplied,
      leads,
      repliesSkippedByQuota,
      repliesToday: state.repliesToday || 0,
      llmDraftedFor,
      insertsFailed,
      discordSent,
      errors: errors.length ? errors.slice(0, 10) : undefined,
    })
  } finally {
    running = false
  }
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    return await handle(request)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[comment-hunter] Fatal:', clip(msg, 400))
    return NextResponse.json({ ok: false, error: clip(msg, 400) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
