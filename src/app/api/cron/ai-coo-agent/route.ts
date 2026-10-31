import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCronAdmin, fetchAllRows, isMissingTableError } from '@/lib/cron-supabase'
import { callLLM, extractJson, getLLMProviderName, type LLMResult } from '@/lib/ai-llm'
import { getEnvVar } from '@/lib/cloudflare-bindings'
import { sendTelegramNotification } from '@/lib/telegram'
import {
  BAGAS_COOLDOWN_DAYS,
  bagasCooldownSince,
  bagasCooldownOrExpr,
  emailsFromActionRows,
} from '@/lib/bagas-cooldown'

/**
 * GET /api/cron/ai-coo-agent
 *
 * 🤖 Karyawan AI — COO (Chief Operating Officer) · Divisi JUALAN
 * (Pengganti CS Agent + Marketing Agent yang dipensiunkan — biar
 *  nggak bentrok dengan karyawan Kantor CEO: CSO & CMO.)
 *
 * Fokus: MONETISASI — konversi free user paling aktif jadi PRO.
 *
 * Flow harian (08.00 WIB, Cloudflare cron):
 *   1. Hitung trades 7 hari terakhir per user → cari free user
 *      (is_pro=false) paling aktif = HOT LEADS (sudah ketagihan
 *      pakai product, tinggal ditawarin upgrade)
 *   2. Exclude lead yang baru dikontak/diusulkan Bagas dalam 7 hari
 *      terakhir di SALAH SATU antrean (🔗 unifikasi cooldown lintas
 *      tabel @/lib/bagas-cooldown — penutup temuan "DOBEL BAGAS":
 *      ai_pending_tasks COO + ai_pending_actions Bagas)
 *   3. LLM racik email penawaran PRO personal per lead
 *   4. Simpan draf ke `ai_pending_tasks` agent_type='COO' status
 *      'pending' (TIDAK langsung kirim)
 *   5. Notif Telegram: "N hot leads menunggu ACC"
 *
 * Eksekusi final (kirim email via Resend) HANYA setelah Bos ACC
 * di Ruang COO (/kantor-ceo) — human-in-the-loop.
 *
 * Auth: Bearer CRON_SECRET (skip jika secret belum diset).
 * Params: ?dry=true untuk preview tanpa menulis DB.
 */

export const dynamic = 'force-dynamic'

const MAX_LEADS_PER_RUN = 3
/* 🔗 Satu sumber kebenaran window cooldown — dipakai juga sweep &
   master-autonomous (lihat @/lib/bagas-cooldown). */
const RECONTACT_COOLDOWN_DAYS = BAGAS_COOLDOWN_DAYS

/* ⭐ FOLLOW-UP "yang buka email" — butuh webhook Resend aktif
   (resend.com → Webhooks → https://luxtradee.web.id/api/webhooks/resend).
   Webhook itu menulis agent_kv: open:{email} → lead yang BUKA email
   penawaran tapi belum jadi PRO mendapat 1 email follow-up berisi
   kupon diskon terkontrol. Anti-spam: 1× per 7 hari per lead,
   maks 2 follow-up per hari. */
const FOLLOWUP_MAX_PER_RUN = 2
const FOLLOWUP_COOLDOWN_DAYS = 7

interface CooLead {
  id: string
  email: string
  fullName: string
  createdAt: string
  trades7d: number
}

interface CooDraft {
  subject: string
  body: string
  provider: string
  model?: string
  generatedAt: string
}

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization')?.replace('Bearer ', '')
  const cronSecret = (await getEnvVar('CRON_SECRET')) || process.env.CRON_SECRET
  // P0 hardening: FAIL-CLOSED — tanpa secret, DITOLAK di produksi (dulu: allow).
  if (!cronSecret) return process.env.NODE_ENV === 'development'
  return authHeader === cronSecret
}

// ─── AI: racik email jualan PRO ────────────────────────────────────────────
/* ═══ SOP MULTI-AGENT — model resmi BAGAS (COO) ═══
/* ═══ SOP MULTI-AGENT — model resmi BAGAS (COO) ═══
   Task 35: llama-3.1-8b:free & glm-4-flash MATI di OpenRouter (404) —
   dulu inilah penyebab email Bagas selalu templat. Kini: Gemma 4 MoE
   (utama) → rantai cadangan model gratis hidup → templat statis
   buildTemplateDraft (fail-safe tetap ada). */
const OR_URL = 'https://openrouter.ai/api/v1/chat/completions'
const BAGAS_MODEL = 'google/gemma-4-26b-a4b-it:free'
const BAGAS_FALLBACK_MODELS = [
  'nvidia/nemotron-3.5-lightning:free',
  'google/gemma-4-31b-it:free',
  /* Task 35c: inkling DIBUANG (403 policy-blocked, verifikasi diag live Bos)
     → diganti Nemotron Ultra 550B (terbukti hidup 333 ms) */
  'nvidia/nemotron-3-ultra-550b-a55b:free',
]

async function getOpenRouterKey(): Promise<string> {
  try { return (await getEnvVar('OPENROUTER_API_KEY', { quiet: true })) || process.env.OPENROUTER_API_KEY || '' } catch { return process.env.OPENROUTER_API_KEY || '' }
}

async function callBagas(systemPrompt: string, userPrompt: string, maxTokens = 600): Promise<LLMResult | null> {
  const key = (await getOpenRouterKey()).trim()
  if (!key) return null
  for (const model of [process.env.OR_MODEL_COO?.trim() || BAGAS_MODEL, ...BAGAS_FALLBACK_MODELS]) {
    try {
      const res = await fetch(OR_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.8,
          max_tokens: maxTokens,
        }),
        signal: AbortSignal.timeout(45_000),
      })
      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        console.error(`[ai-coo-agent] OpenRouter ${model} ${res.status}: ${errBody.substring(0, 160)}`)
        continue
      }
      const result: { choices?: Array<{ message?: { content?: string } }> } = await res.json()
      const text = result?.choices?.[0]?.message?.content?.trim()
      if (!text) {
        console.error(`[ai-coo-agent] OpenRouter ${model} returned empty content`)
        continue
      }
      return { text, provider: 'openrouter', model }
    } catch (err: any) {
      console.error(`[ai-coo-agent] OpenRouter ${model} error:`, err?.message || err)
    }
  }
  return null
}

const COO_SYSTEM_PROMPT = `Kamu adalah COO (Chief Operating Officer) Luxtradee — divisi jualan. Misi kamu: konversi free user paling aktif jadi pelanggan PRO.

Kamu menulis email penawaran upgrade PERSONAL untuk user yang SUDAH RAJIN upload jurnal trading (bukan user baru!) tapi masih pakai versi gratis.

Gaya bahasa WAJIB:
- Bahasa Indonesia kasual khas anak trader SMC/ICT (istilah "entry", "setup", "RR", "killzone", "journal" secara natural)
- seperti senior sales yang paham trader — BUKAN marketing kaku, BUKAN spam
- Singkat & padat (maksimal 130 kata di body)
- 1-2 emoji relevan, jangan berlebihan

Strategi jualan (dibungkus natural, bukan bullet):
1. Sapa personal pakai nama depan, akui kerajinan mereka (sebut angka trades minggu ini — kasih respect dulu)
2. Sadar kerja bagus: mereka udah disiplin, data mereka udah banyak
3. Angkat pain point: makin banyak trade manual-nyatet, makin banyak waktu terbuang; analisa manual susah scale
4. PENAWARAN: PRO buka fitur analisa mendalam + unlimited insight dari jurnal yang udah mereka kumpulin (tanpa sebut harga spesifik — arahkan ke halaman pricing)
5. CTA tegas tapi sopan: cek halaman pricing, upgrade 2 menit selesai

Format output WAJIB JSON murni (tanpa markdown fence):
{"subject": "...", "body": "..."}

body dalam plain text (boleh newline \\n untuk paragraf).`

function buildCooUserPrompt(l: CooLead): string {
  const firstName = (l.fullName || l.email.split('@')[0] || 'Trader').split(' ')[0]
  return `Data lead:
- Nama: ${firstName}
- Email: ${l.email}
- Status akun: FREE (belum PRO)
- Trades 7 hari terakhir: ${l.trades7d} (sangat aktif!)
- Bergabung sejak: ${l.createdAt ? new Date(l.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'beberapa waktu lalu'}

Tulis 1 email penawaran upgrade PRO untuk lead ini sekarang. Output JSON murni {"subject": "...", "body": "..."}.`
}

/** Fallback template jika LLM tidak tersedia — tetap personal & jualan. */
function buildTemplateDraft(l: CooLead): CooDraft {
  const firstName = (l.fullName || l.email.split('@')[0] || 'Trader').split(' ')[0]
  return {
    subject: `${firstName}, ${l.trades7d} trades minggu ini — siap analisa otomatis? 💸`,
    body: `Yo ${firstName}!\n\nGila sih — ${l.trades7d} trades dalam 7 hari terakhir. Disiplin level ini jarang ada 👏\n\nCuma satu yang bikin aku kasihan: data segitu dianalisa manual? Lama bro. Di versi PRO, semua jurnal kamu yang udah terkumpul langsung dianalisa otomatis — pola entry terbaik, RR konsisten, jam killzone paling nguntungin kamu.\n\nTrader yang profit konsisten itu bukan yang paling banyak trade — tapi yang paling cepet belajar dari datanya sendiri.\n\nUpgrade ke PRO cuma 2 menit 👇\n${process.env.NEXT_PUBLIC_APP_URL || 'https://luxtradee.web.id'}/#pricing\n\nBalas email ini kalau mau aku tunjukin dulu fiturnya.\n\nClosing mode: ON,\nTim Luxtradee`,
    provider: 'template',
    generatedAt: new Date().toISOString(),
  }
}

async function generateCooDraft(l: CooLead): Promise<CooDraft> {
  /* SOP Multi-Agent: model resmi Bagas dulu (OpenRouter Llama 3.1 8B) →
     rantai lama Groq → Gemini → templat statis. */
  const llm = (await callBagas(COO_SYSTEM_PROMPT, buildCooUserPrompt(l), 600))
    ?? (await callLLM(COO_SYSTEM_PROMPT, buildCooUserPrompt(l), 600))
  if (llm) {
    const parsed = extractJson<{ subject?: string; body?: string }>(llm.text)
    if (parsed?.subject && parsed?.body) {
      return {
        subject: String(parsed.subject).substring(0, 150),
        body: String(parsed.body),
        provider: llm.provider,
        model: llm.model,
        generatedAt: new Date().toISOString(),
      }
    }
    return {
      subject: 'Penawaran khusus buat trader rajin kayak kamu 🤝',
      body: llm.text.substring(0, 2000),
      provider: llm.provider,
      model: llm.model,
      generatedAt: new Date().toISOString(),
    }
  }
  return buildTemplateDraft(l)
}

// ─── KV kecil di tabel agent_kv (dibaca juga oleh route webhook Resend) ────
async function kvAgentGet(admin: SupabaseClient, key: string): Promise<string | null> {
  try {
    const { data } = await admin.from('agent_kv').select('value').eq('key', key).maybeSingle()
    return (data as { value?: string } | null)?.value ?? null
  } catch { return null }
}
async function kvAgentSet(admin: SupabaseClient, key: string, value: string): Promise<void> {
  try { await admin.from('agent_kv').upsert({ key, value }, { onConflict: 'key' }) } catch { /* non-kritis */ }
}

// ─── ⭐ FOLLOW-UP: lead yang BUKA email tapi belum PRO ─────────────────────
const COO_FOLLOWUP_SYSTEM_PROMPT =
  `Kamu Bagas, COO Luxtradee (jurnal trading XAUUSD) yang jago closing. KONTEKS: lead ini sudah MEMBUKA email penawaran PRO sebelumnya tapi belum upgrade — dia tertarik tapi ragu. TUGAS: tulis 1 email follow-up singkat (maks 150 kata) yang ramah bukan nagih: (1) akui dia buka email kemarin, (2) tawarkan bantuan menjawab keraguan, (3) sebut kupon diskon terkontrol dengan kode yang diberikan (berlaku terbatas), (4) 1 ajakan jelas klik link upgrade. Jangan Janji berlebihan. Output JSON murni {"subject": "...", "body": "..."} — body plain text.`

function buildFollowupUserPrompt(l: CooLead, openedAt: string, coupon: string, percent: number): string {
  const firstName = (l.fullName || l.email.split('@')[0] || 'Trader').split(' ')[0]
  const tgl = openedAt ? new Date(openedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : 'beberapa hari lalu'
  return `Data lead:
- Nama: ${firstName}
- Email: ${l.email}
- Status akun: FREE (belum PRO)
- Aktivitas terakhir: ${l.trades7d} trades dalam 7 hari
- Membuka email penawaran pada: ${tgl}
- Kupon yang boleh ditawarkan: kode ${coupon} (diskon ${percent}% paket PRO bulanan)

Tulis 1 email follow-up sekarang. Output JSON murni {"subject": "...", "body": "..."}.`
}

function buildFollowupTemplate(l: CooLead, coupon: string, percent: number): CooDraft {
  const firstName = (l.fullName || l.email.split('@')[0] || 'Trader').split(' ')[0]
  return {
    subject: `${firstName}, kupon ${coupon} khusus buat kamu ⏳`,
    body: `Yo ${firstName}!

Aku lihat kamu sempat buka email penawaran PRO kemarin — tapi belum jalan. Rumit atau ragu? Wajar banget.

Biar makin ringan: pakai kode <b>${coupon}</b> — diskon ${percent}% paket PRO bulanan. Berlaku terbatas, cuma buat lead yang beneran serius kayak kamu.

PRO = semua jurnal kamu dianalisa otomatis: pola entry terbaik, RR konsisten, jam killzone paling untung. Upgrade 2 menit 👇
${process.env.NEXT_PUBLIC_APP_URL || 'https://luxtradee.web.id'}/#pricing

Balas email ini kalau ada yang mau ditanya dulu — aku jawab langsung.

Bagas,
COO Luxtradee`,
    provider: 'template',
    generatedAt: new Date().toISOString(),
  }
}

async function generateFollowupDraft(l: CooLead, openedAt: string, coupon: string, percent: number): Promise<CooDraft> {
  const llm = (await callBagas(COO_FOLLOWUP_SYSTEM_PROMPT, buildFollowupUserPrompt(l, openedAt, coupon, percent), 600))
    ?? (await callLLM(COO_FOLLOWUP_SYSTEM_PROMPT, buildFollowupUserPrompt(l, openedAt, coupon, percent), 600))
  if (llm) {
    const parsed = extractJson<{ subject?: string; body?: string }>(llm.text)
    if (parsed?.subject && parsed?.body) {
      return {
        subject: String(parsed.subject).substring(0, 150),
        body: String(parsed.body),
        provider: llm.provider,
        model: llm.model,
        generatedAt: new Date().toISOString(),
      }
    }
  }
  return buildFollowupTemplate(l, coupon, percent)
}

type FollowupResult = { email: string; name: string; subject: string; openedAt: string }

/** Pass 2: cari lead yang buka email penawaran (webhook Resend → agent_kv
 *  open:{email}) tapi masih FREE → buat draf follow-up (PENDING, ACC Bos).
 *  Anti-spam: kupon kupon:{email} cooldown 7 hari; bounce → jangan email lagi. */
async function runFollowUpPass(
  admin: SupabaseClient,
  profiles: Array<{ id: string; email: string | null; is_pro?: boolean | null; full_name?: string | null }>,
): Promise<FollowupResult[]> {
  const percent = parseInt((await getEnvVar('COUPON_PERCENT')) || process.env.COUPON_PERCENT || '20', 10) || 20
  const coupon = `DISKON${percent}`
  const since = new Date(Date.now() - 14 * 24 * 3600_000).toISOString()

  // 1. Email penawaran yang terkirim 14 hari ke belakang
  const { data: sentTasks } = await admin
    .from('ai_pending_tasks')
    .select('target_user_id, context_data, executed_at')
    .eq('agent_type', 'COO')
    .eq('status', 'approved')
    .gte('executed_at', since)
    .limit(150)
  if (!sentTasks?.length) return []

  const byId = new Map(profiles.map(p => [p.id, p]))
  const seen = new Set<string>()
  const results: FollowupResult[] = []

  for (const t of sentTasks as Array<{ target_user_id: string | null; context_data: { email?: string; fullName?: string; totalTrades?: number } | null; executed_at: string | null }>) {
    if (results.length >= FOLLOWUP_MAX_PER_RUN) break
    const email = (t.context_data?.email || '').toLowerCase().trim()
    if (!email || seen.has(email)) continue
    seen.add(email)

    const prof = t.target_user_id ? byId.get(t.target_user_id) : undefined
    if (prof?.is_pro) continue // sudah PRO → selamat, bukan target follow-up

    const stat = JSON.parse((await kvAgentGet(admin, `open:${email}`)) || '{}') as { count?: number; clicks?: number; bounced?: boolean; last?: string }
    if (stat.bounced) continue // alamat bounce — jangan ganggu lagi
    if (!(stat.count || 0) && !(stat.clicks || 0)) continue // belum buka → bukan kandidat follow-up

    // Anti-spam: 1 follow-up per 7 hari
    const lastFu = await kvAgentGet(admin, `followup:${email}`)
    if (lastFu && Date.now() - new Date(lastFu).getTime() < FOLLOWUP_COOLDOWN_DAYS * 24 * 3600_000) continue

    const lead: CooLead = {
      id: t.target_user_id || '',
      email,
      fullName: prof?.full_name || t.context_data?.fullName || '',
      createdAt: '',
      trades7d: t.context_data?.totalTrades || 0,
    }
    const draft = await generateFollowupDraft(lead, t.executed_at || stat.last || '', coupon, percent)

    const { error: insErr } = await admin.from('ai_pending_tasks').insert({
      agent_type: 'COO',
      target_user_id: t.target_user_id,
      context_data: {
        email, fullName: lead.fullName, totalTrades: lead.trades7d,
        followup: true, openedAt: t.executed_at || stat.last || '', coupon,
      },
      generated_content: draft,
      status: 'pending',
    })
    if (insErr) {
      console.error('[ai-coo-agent] Insert followup gagal:', insErr.message)
      continue
    }
    await kvAgentSet(admin, `followup:${email}`, new Date().toISOString())
    results.push({ email, name: lead.fullName, subject: draft.subject, openedAt: t.executed_at || stat.last || '' })
  }
  return results
}

// ─── Main handler ───────────────────────────────────────────────────────────
async function handleRequest(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const dry = searchParams.get('dry') === 'true'

  const admin = await getCronAdmin()
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Database unavailable (Supabase admin client gagal dibuat)' }, { status: 503 })
  }

  // 0. Guard: tabel harus sudah ada (migrasi 011)
  const tableCheck = await admin.from('ai_pending_tasks').select('id').limit(1)
  if (tableCheck.error) {
    if (isMissingTableError(tableCheck.error)) {
      return NextResponse.json({
        success: false,
        error: 'Tabel ai_pending_tasks belum ada di Supabase — jalankan supabase-migrations/011_create_ai_pending_tasks.sql dulu',
      }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'DB check failed: ' + tableCheck.error.message }, { status: 500 })
  }

  // 1. Trades 7 hari terakhir → hitung aktivitas per user
  const since7 = new Date(Date.now() - 7 * 24 * 3600_000).toISOString()
  const tradeCounts = new Map<string, number>()
  try {
    const tradeRows = await fetchAllRows<{ user_id: string | null }>((from, to) =>
      admin.from('trades').select('user_id').gte('created_at', since7).range(from, to)
    )
    for (const r of tradeRows) {
      if (!r.user_id) continue
      tradeCounts.set(r.user_id, (tradeCounts.get(r.user_id) || 0) + 1)
    }
  } catch (err: any) {
    console.error('[ai-coo-agent] Failed to load trades 7d:', err?.message)
  }

  // 2. Free user paling aktif = hot leads
  let profiles: Array<{ id: string; email: string | null; full_name?: string | null; created_at?: string | null; is_pro?: boolean | null }> = []
  try {
    profiles = await fetchAllRows((from, to) =>
      admin.from('profiles').select('id, email, full_name, created_at, is_pro').range(from, to)
    )
  } catch (err: any) {
    if (String(err?.message || '').includes('full_name') || err?.code === 'PGRST204') {
      profiles = await fetchAllRows((from, to) =>
        admin.from('profiles').select('id, email, created_at, is_pro').range(from, to)
      )
    } else if (String(err?.message || '').includes('is_pro') || err?.code === 'PGRST204') {
      profiles = await fetchAllRows((from, to) =>
        admin.from('profiles').select('id, email, full_name, created_at').range(from, to)
      )
    } else {
      return NextResponse.json({ success: false, error: 'Gagal load profiles: ' + (err?.message || err) }, { status: 500 })
    }
  }

  const hotLeads: CooLead[] = profiles
    .filter(p => p.email && !p.is_pro && (tradeCounts.get(p.id) || 0) > 0)
    .map(p => ({
      id: p.id,
      email: p.email as string,
      fullName: (p as { full_name?: string | null }).full_name || '',
      createdAt: p.created_at || '',
      trades7d: tradeCounts.get(p.id) || 0,
    }))
    .sort((a, b) => b.trades7d - a.trades7d)

  // 3. Exclude yang baru dikontak/diusulkan Bagas 7 hari terakhir (anti-spam,
  //     🔗 LINTAS ANTREAN — unifikasi cooldown @/lib/bagas-cooldown)
  const sinceCooldown = bagasCooldownSince()
  const recentlyContacted = new Set<string>()
  const crossActionEmails = new Set<string>()
  if (hotLeads.length > 0) {
    // Semua task COO 7 hari ke belakang dihitung (pending/approved/rejected
    // sama-sama berarti "udah pernah ditawarin"); window ikut executed_at —
    // draf lama yang di-ACC telat tetap menghitung dari saat email terkirim.
    const { data: recent } = await admin
      .from('ai_pending_tasks')
      .select('target_user_id')
      .eq('agent_type', 'COO')
      .or(bagasCooldownOrExpr(sinceCooldown))
    for (const row of recent || []) {
      if (row.target_user_id) recentlyContacted.add(row.target_user_id)
    }

    // 🔗 Arah sebaliknya (penutup "DOBEL BAGAS"): proposal Bagas di antrean
    // Kantor CEO (ai_pending_actions — sweep & master-autonomous) juga dihitung;
    // kuncinya EMAIL karena tabel itu tak menyimpan user_id.
    try {
      const { data: recentActions } = await admin
        .from('ai_pending_actions')
        .select('action_payload')
        .eq('agent_name', 'Bagas')
        .or(bagasCooldownOrExpr(sinceCooldown))
        .limit(200) // dulu 60 — volume Bagas 7 hari bisa lewat 60 → silent truncation
      for (const e of emailsFromActionRows(recentActions || [])) crossActionEmails.add(e)
    } catch { /* tabel opsional (migrasi 015 belum jalan) — fail-open */ }
  }

  const targets = hotLeads
    .filter(l => !recentlyContacted.has(l.id) && !crossActionEmails.has(l.email.toLowerCase()))
    .slice(0, MAX_LEADS_PER_RUN)

  if (targets.length === 0) {
    return NextResponse.json({
      success: true,
      created: 0,
      message: 'Tidak ada hot lead baru (free user aktif sudah pernah ditawarin dalam 7 hari / belum ada yang trading minggu ini)',
      stats: { totalProfiles: profiles.length, activeFreeUsers: hotLeads.length, inCooldown: recentlyContacted.size, inCooldownActions: crossActionEmails.size },
    })
  }

  // 4. LLM racik draf jualan — paralel (model resmi Bagas via OpenRouter)
  const drafts = await Promise.all(
    targets.map(async (l): Promise<{ lead: CooLead; draft: CooDraft; error?: string }> => {
      try {
        return { lead: l, draft: await generateCooDraft(l) }
      } catch (err: any) {
        return { lead: l, draft: buildTemplateDraft(l), error: err?.message || String(err) }
      }
    })
  )

  if (dry) {
    return NextResponse.json({
      success: true,
      dryRun: true,
      llmProvider: [...new Set(drafts.map(d => d.draft.provider))].join(', ') || await getLLMProviderName(),
      wouldCreate: drafts.map(d => ({ email: d.lead.email, name: d.lead.fullName, trades7d: d.lead.trades7d, subject: d.draft.subject, provider: d.draft.provider })),
      stats: { totalProfiles: profiles.length, activeFreeUsers: hotLeads.length, inCooldown: recentlyContacted.size, inCooldownActions: crossActionEmails.size },
    })
  }

  // 5. Simpan draf ke antrean approval — status 'pending', BELUM dikirim
  const rows = drafts.map(d => ({
    agent_type: 'COO' as const,
    target_user_id: d.lead.id,
    context_data: {
      email: d.lead.email,
      fullName: d.lead.fullName,
      totalTrades: d.lead.trades7d,
      joinedAt: d.lead.createdAt,
    },
    generated_content: d.draft,
    status: 'pending' as const,
  }))

  const { data: inserted, error: insertErr } = await admin
    .from('ai_pending_tasks')
    .insert(rows)
    .select('id')

  if (insertErr) {
    const m = insertErr.message || ''
    if (m.includes('agent_type') && m.includes('check')) {
      return NextResponse.json({
        success: false,
        error: 'Constraint agent_type menolak COO — jalankan supabase-migrations/013_add_coo_agent_type.sql di Supabase SQL Editor dulu',
      }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'Gagal insert draft: ' + m }, { status: 500 })
  }

  // 5b. ⭐ FOLLOW-UP PASS — lead yang BUKA email (webhook Resend) tapi belum PRO
  let followups: FollowupResult[] = []
  try {
    followups = await runFollowUpPass(admin, profiles)
  } catch (err: any) {
    console.error('[ai-coo-agent] Follow-up pass gagal (non-fatal):', err?.message)
  }

  // 6. Notif Telegram ke Bos — draf jualan + follow-up nunggu ACC
  const draftList = drafts
    .map(d => `• ${d.lead.fullName || d.lead.email} (${d.lead.trades7d} trades/7hr) → "${d.draft.subject}"`)
    .join('\n')
  const provs = [...new Set(drafts.map(d => d.draft.provider))].join(', ') || await getLLMProviderName()
  const fuList = followups
    .map(f => `• 🔄 FOLLOW-UP ${f.name || f.email} (buka email) → "${f.subject}"`)
    .join('\n')
  await sendTelegramNotification(
    `🤖 <b>AI COO — Divisi Jualan</b>\n\n💰 ${drafts.length} hot lead ditarget, draf penawaran PRO siap (status: PENDING)\nProvider LLM: <b>${provs}</b>\n\n${draftList}${fuList ? `\n\n📬 ${followups.length} FOLLOW-UP lead yang buka email tapi belum PRO:\n${fuList}` : ''}\n\n👉 Review & ACC di Ruang COO: ${process.env.NEXT_PUBLIC_APP_URL || 'https://luxtradee.web.id'}/kantor-ceo`
  )

  return NextResponse.json({
    success: true,
    created: inserted?.length ?? rows.length,
    llmProvider: [...new Set(drafts.map(d => d.draft.provider))].join(', '),
    drafts: drafts.map(d => ({ email: d.lead.email, trades7d: d.lead.trades7d, subject: d.draft.subject, provider: d.draft.provider })),
    followups,
    errors: drafts.filter(d => d.error).map(d => ({ email: d.lead.email, error: d.error })),
  })
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    return await handleRequest(request)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[ai-coo-agent] Fatal:', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
