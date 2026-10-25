import { NextRequest, NextResponse } from 'next/server'
import { getCronAdmin, fetchAllRows, isMissingTableError } from '@/lib/cron-supabase'
import { getEnvVar } from '@/lib/cloudflare-bindings'
import { callLLM, extractJson, getLLMProviderName } from '@/lib/ai-llm'
import { sendTelegramNotification } from '@/lib/telegram'

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
 *   2. Exclude lead yang baru dikontak COO dalam 7 hari terakhir
 *      (anti-spam, beda dengan dedup harian CS lama)
 *   3. LLM racik email penawaran PRO personal per lead
 *   4. Simpan draf ke `ai_pending_tasks` agent_type='COO' status
 *      'pending' (TIDAK langsung kirim)
 *   5. Notif Telegram: "N hot leads menunggu ACC"
 *
 * Eksekusi final (kirim email via Resend) HANYA setelah Bos ACC
 * di /admin/ai-staff — human-in-the-loop.
 *
 * Auth: Bearer CRON_SECRET (skip jika secret belum diset).
 * Params: ?dry=true untuk preview tanpa menulis DB.
 */

export const dynamic = 'force-dynamic'

const MAX_LEADS_PER_RUN = 3
const RECONTACT_COOLDOWN_DAYS = 7

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
  if (cronSecret && authHeader !== cronSecret) return false
  return true
}

// ─── AI: racik email jualan PRO ────────────────────────────────────────────
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
  const llm = await callLLM(COO_SYSTEM_PROMPT, buildCooUserPrompt(l), 600)
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

  // 3. Exclude yang baru dikontak COO 7 hari terakhir (anti-spam)
  const sinceCooldown = new Date(Date.now() - RECONTACT_COOLDOWN_DAYS * 24 * 3600_000).toISOString()
  const recentlyContacted = new Set<string>()
  if (hotLeads.length > 0) {
    // Semua task COO 7 hari ke belakang dihitung (pending/approved/rejected
    // sama-sama berarti "udah pernah ditawarin")
    const { data: recent } = await admin
      .from('ai_pending_tasks')
      .select('target_user_id')
      .eq('agent_type', 'COO')
      .gte('created_at', sinceCooldown)
    for (const row of recent || []) {
      if (row.target_user_id) recentlyContacted.add(row.target_user_id)
    }
  }

  const targets = hotLeads.filter(l => !recentlyContacted.has(l.id)).slice(0, MAX_LEADS_PER_RUN)

  if (targets.length === 0) {
    return NextResponse.json({
      success: true,
      created: 0,
      message: 'Tidak ada hot lead baru (free user aktif sudah pernah ditawarin dalam 7 hari / belum ada yang trading minggu ini)',
      stats: { totalProfiles: profiles.length, activeFreeUsers: hotLeads.length, inCooldown: recentlyContacted.size },
    })
  }

  // 4. LLM racik draf jualan — paralel
  const provider = await getLLMProviderName()
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
      llmProvider: provider,
      wouldCreate: drafts.map(d => ({ email: d.lead.email, name: d.lead.fullName, trades7d: d.lead.trades7d, subject: d.draft.subject, provider: d.draft.provider })),
      stats: { totalProfiles: profiles.length, activeFreeUsers: hotLeads.length, inCooldown: recentlyContacted.size },
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

  // 6. Notif Telegram ke Bos — draf jualan nunggu ACC
  const draftList = drafts
    .map(d => `• ${d.lead.fullName || d.lead.email} (${d.lead.trades7d} trades/7hr) → "${d.draft.subject}"`)
    .join('\n')
  await sendTelegramNotification(
    `🤖 <b>AI COO — Divisi Jualan</b>\n\n💰 ${drafts.length} hot lead ditarget, draf penawaran PRO siap (status: PENDING)\nProvider LLM: <b>${provider}</b>\n\n${draftList}\n\n👉 Review & ACC di: ${process.env.NEXT_PUBLIC_APP_URL || 'https://luxtradee.web.id'}/admin/ai-staff`
  )

  return NextResponse.json({
    success: true,
    created: inserted?.length ?? rows.length,
    llmProvider: provider,
    drafts: drafts.map(d => ({ email: d.lead.email, trades7d: d.lead.trades7d, subject: d.draft.subject, provider: d.draft.provider })),
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
