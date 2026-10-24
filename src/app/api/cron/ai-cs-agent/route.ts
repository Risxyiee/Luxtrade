import { NextRequest, NextResponse } from 'next/server'
import { getCronAdmin, fetchAllRows, isMissingTableError } from '@/lib/cron-supabase'
import { getEnvVar } from '@/lib/cloudflare-bindings'
import { callLLM, extractJson, getLLMProviderName } from '@/lib/ai-llm'
import { sendTelegramNotification } from '@/lib/telegram'

/**
 * GET /api/cron/ai-cs-agent
 *
 * 🤖 Karyawan AI — Customer Success (Human-in-the-Loop)
 *
 * Flow:
 *   1. Cari max 5 user yang belum pernah trading (0 trades) & belum dikontak hari ini
 *   2. LLM meracik email follow-up personal (gaya kasual anak trader SMC/ICT)
 *   3. Simpan draf ke `ai_pending_tasks` status 'pending' (TIDAK langsung kirim)
 *   4. Notif Telegram ke owner: "ada N draf menunggu approval"
 *
 * Eksekusi final (kirim email via Resend) HANYA terjadi setelah admin
 * approve di /admin/ai-staff — human-in-the-loop.
 *
 * Auth: Bearer CRON_SECRET (skip jika secret belum diset — konsisten
 * dengan route cron lain). Params: ?dry=true untuk preview tanpa menulis DB.
 */

export const dynamic = 'force-dynamic'

const MAX_USERS_PER_RUN = 5

interface CsCandidate {
  id: string
  email: string
  fullName: string
  createdAt: string
}

interface CsDraft {
  subject: string
  body: string
  provider: string
  model?: string
  generatedAt: string
}

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const auth = request.headers.get('authorization')
  const cronSecret = (await getEnvVar('CRON_SECRET')) || process.env.CRON_SECRET
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true
  if (process.env.NODE_ENV === 'development') return true
  return false
}

// ─── AI: racik email follow-up ─────────────────────────────────────────────
const CS_SYSTEM_PROMPT = `Kamu adalah karyawan Customer Success (CS) di Luxtradee — aplikasi trading journal untuk trader forex/prop firm Indonesia.

Tugasmu: menulis email follow-up PERSONAL untuk user yang sudah mendaftar tapi BELUM PERNAH upload trading journal sama sekali.

Gaya bahasa WAJIB:
- Bahasa Indonesia kasual khas anak trader SMC/ICT (pakai istilah seperti "entry", "setup", "killzone", "journal", "backtest" secara natural)
- Santai, friendly, kayak teman satu komunitas — BUKAN marketing kaku
- Singkat & padat (maksimal 120 kata di body)
- Boleh pakai 1-2 emoji yang relevan, jangan berlebihan

Poin yang harus masuk (dibungkus natural, bukan bullet):
1. Sapa personal pakai nama depan user
2. Sadar bahwa mereka belum mulai journalling
3. Angkat pain point: trader paling sering loss karena tidak disiplin mencatat & tidak review setup
4. SOLUSI UTAMA: cukup upload screenshot trade MT4/MT5/Prop firm ke Luxtradee, sistem auto-extract jadi journal rapi (entry, RR, setup, hasil) — nggak perlu input manual
5. CTA lembut: ajak coba upload 1 screenshot hari ini di dashboard

Format output WAJIB JSON murni (tanpa markdown fence):
{"subject": "...", "body": "..."}

body dalam plain text (boleh newline \\n untuk paragraf).`

function buildCsUserPrompt(c: CsCandidate): string {
  const firstName = (c.fullName || c.email.split('@')[0] || 'Trader').split(' ')[0]
  return `Data user:
- Nama: ${firstName}
- Email: ${c.email}
- Total trades di Luxtradee: 0 (belum pernah jurnal)
- Bergabung: ${c.createdAt ? new Date(c.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'baru saja'}

Tulis 1 email follow-up untuk user ini sekarang. Output JSON murni {"subject": "...", "body": "..."}.`
}

/** Fallback template jika LLM tidak tersedia — tetap personal & useful. */
function buildTemplateDraft(c: CsCandidate): CsDraft {
  const firstName = (c.fullName || c.email.split('@')[0] || 'Trader').split(' ')[0]
  return {
    subject: `${firstName}, setup bagus tanpa journal itu sayang 📓`,
    body: `Yo ${firstName}!\n\nLihat akun kamu masih kosong nih di Luxtradee. Sudah ada setup bagus yang terlewat belum dicatat?\n\nCoba deh fitur paling gampang dari kita: tinggal UPLOAD SCREENSHOT trade kamu (MT4/MT5/prop firm), sistem otomatis extract jadi journal rapi — entry, RR, setup, hasil. Nggak perlu input manual satu-satu.\n\nTrader SMC/ICT yang konsisten profit rata-rata punya 1 kebiasaan sama: journaling disiplin. Mulai dari 1 screenshot hari ini aja 👇\n\n${process.env.NEXT_PUBLIC_APP_URL || 'https://luxtradee.web.id'}/dashboard\n\nKalau ada yang bingung, balas email ini aja — aku bantu.\n\nPeace,\nTim Luxtradee`,
    provider: 'template',
    generatedAt: new Date().toISOString(),
  }
}

async function generateCsDraft(c: CsCandidate): Promise<CsDraft> {
  const llm = await callLLM(CS_SYSTEM_PROMPT, buildCsUserPrompt(c), 600)
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
    // LLM merespons tapi format tidak valid → pakai raw text sebagai body
    return {
      subject: 'Masih nunggu trade pertama kamu nih 👀',
      body: llm.text.substring(0, 2000),
      provider: llm.provider,
      model: llm.model,
      generatedAt: new Date().toISOString(),
    }
  }
  return buildTemplateDraft(c)
}

// ─── Main handler ───────────────────────────────────────────────────────────
async function handleRequest(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const dry = searchParams.get('dry') === 'true'

  const admin = await getCronAdmin()
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Database unavailable (Supabase admin client gagal dibuat)' }, { status: 503 })
  }

  // 0. Guard: tabel harus sudah dibuat (jalankan migrasi 011 dulu)
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

  // 1. Kumpulkan user yang SUDAH pernah trading (untuk dikecualikan)
  //    profiles tidak punya kolom total_trades → hitung dari tabel trades
  let tradedUserIds = new Set<string>()
  try {
    const tradeRows = await fetchAllRows<{ user_id: string | null }>((from, to) =>
      admin.from('trades').select('user_id').range(from, to)
    )
    tradedUserIds = new Set(tradeRows.map(r => r.user_id).filter(Boolean) as string[])
  } catch (err: any) {
    // Tabel trades bermasalah → jangan block, tapi log jelas
    console.error('[ai-cs-agent] Failed to load trades user_ids:', err?.message)
  }

  // 2. Ambil kandidat: profiles + email valid + belum trading
  let profiles: Array<{ id: string; email: string | null; full_name?: string | null; created_at?: string | null }> = []
  try {
    profiles = await fetchAllRows((from, to) =>
      admin.from('profiles').select('id, email, full_name, created_at').range(from, to)
    )
  } catch (err: any) {
    // Fallback tanpa full_name (kalau kolom tidak ada)
    if (String(err?.message || '').includes('full_name') || err?.code === 'PGRST204') {
      profiles = await fetchAllRows((from, to) =>
        admin.from('profiles').select('id, email, created_at').range(from, to)
      )
    } else {
      return NextResponse.json({ success: false, error: 'Gagal load profiles: ' + (err?.message || err) }, { status: 500 })
    }
  }

  const zeroTradeCandidates: CsCandidate[] = profiles
    .filter(p => p.email && !tradedUserIds.has(p.id))
    .map(p => ({
      id: p.id,
      email: p.email as string,
      fullName: (p as { full_name?: string | null }).full_name || '',
      createdAt: p.created_at || '',
    }))
    // Terbaru dulu — signup paling segar = lead paling hangat
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

  // 3. Exclude yang sudah dikontak hari ini (dedup harian via tabel antrean)
  const startOfTodayUtc = new Date()
  startOfTodayUtc.setUTCHours(0, 0, 0, 0)

  const contactedToday = new Set<string>()
  if (zeroTradeCandidates.length > 0) {
    const candidateIds = zeroTradeCandidates.map(c => c.id)
    // .in() aman untuk ≤5 id kandidat (URL pendek)
    const { data: existing } = await admin
      .from('ai_pending_tasks')
      .select('target_user_id')
      .eq('agent_type', 'CS')
      .gte('created_at', startOfTodayUtc.toISOString())
      .in('target_user_id', candidateIds)
    for (const row of existing || []) {
      if (row.target_user_id) contactedToday.add(row.target_user_id)
    }
  }

  const targets = zeroTradeCandidates.filter(c => !contactedToday.has(c.id)).slice(0, MAX_USERS_PER_RUN)

  if (targets.length === 0) {
    return NextResponse.json({
      success: true,
      created: 0,
      message: 'Tidak ada kandidat baru (semua user 0-trades sudah dikontak hari ini / tidak ada yang lolos filter)',
      stats: { totalProfiles: profiles.length, zeroTrade: zeroTradeCandidates.length, contactedToday: contactedToday.size },
    })
  }

  // 4. LLM racik draf — paralel agar total waktu ≈ 1 panggilan LLM
  //    (cron scheduled handler punya fetch timeout 30s di worker-entry)
  const provider = await getLLMProviderName()
  const drafts = await Promise.all(
    targets.map(async (c): Promise<{ candidate: CsCandidate; draft: CsDraft; error?: string }> => {
      try {
        return { candidate: c, draft: await generateCsDraft(c) }
      } catch (err: any) {
        return { candidate: c, draft: buildTemplateDraft(c), error: err?.message || String(err) }
      }
    })
  )

  if (dry) {
    return NextResponse.json({
      success: true,
      dryRun: true,
      llmProvider: provider,
      wouldCreate: drafts.map(d => ({ email: d.candidate.email, name: d.candidate.fullName, subject: d.draft.subject, provider: d.draft.provider })),
      stats: { totalProfiles: profiles.length, zeroTrade: zeroTradeCandidates.length, contactedToday: contactedToday.size },
    })
  }

  // 5. Simpan draf ke antrean approval — status 'pending', BELUM dikirim
  const rows = drafts.map(d => ({
    agent_type: 'CS' as const,
    target_user_id: d.candidate.id,
    context_data: {
      email: d.candidate.email,
      fullName: d.candidate.fullName,
      totalTrades: 0,
      joinedAt: d.candidate.createdAt,
    },
    generated_content: d.draft,
    status: 'pending' as const,
  }))

  const { data: inserted, error: insertErr } = await admin
    .from('ai_pending_tasks')
    .insert(rows)
    .select('id')

  if (insertErr) {
    return NextResponse.json({ success: false, error: 'Gagal insert draft: ' + insertErr.message }, { status: 500 })
  }

  // 6. Notif Telegram ke owner — draf menunggu approval
  const draftList = drafts
    .map(d => `• ${d.candidate.fullName || d.candidate.email} → "${d.draft.subject}"`)
    .join('\n')
  await sendTelegramNotification(
    `🤖 <b>AI CS Agent</b>\n\n✍️ ${drafts.length} draf email follow-up siap (status: PENDING)\nProvider LLM: <b>${provider}</b>\n\n${draftList}\n\n👉 Review & approve di: ${process.env.NEXT_PUBLIC_APP_URL || 'https://luxtradee.web.id'}/admin/ai-staff`
  )

  return NextResponse.json({
    success: true,
    created: inserted?.length ?? rows.length,
    llmProvider: provider,
    drafts: drafts.map(d => ({ email: d.candidate.email, subject: d.draft.subject, provider: d.draft.provider })),
    errors: drafts.filter(d => d.error).map(d => ({ email: d.candidate.email, error: d.error })),
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
    console.error('[ai-cs-agent] Fatal:', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
