import { NextRequest, NextResponse } from 'next/server'
import { getEnvVar } from '@/lib/cloudflare-bindings'
import { getCronAdmin, isMissingTableError } from '@/lib/cron-supabase'
import { sendAdminNotification } from '@/lib/admin-notify'

/**
 * ============================================================
 * GET /api/cron/ig-niche-research — Riset niche IG mingguan
 * ============================================================
 * Tujuan (Bos 17-11: "riset niche mingguan auto-scan kompetitor"):
 * setiap MINGGU (Senin 10:00 WIB, numpang slot cron laporan mingguan
 * '0 3 * * 1' — nol slot cron baru, CF Free maks 5 trigger/akun)
 * riset pasar gold-trading Indonesia dijalankan otomatis dan hasilnya
 * disimpan untuk dibaca Sinta (CMO) saat menyusun konten mingguan.
 *
 * Mesin riset: Exa hosted MCP (https://mcp.exa.ai/mcp — gratis, tanpa
 * key) dengan tool `web_search_exa`. Persis backend yang dipakai CLI
 * Agent Reach (github.com/Panniantong/Agent-Reach, audited 17-11) —
 * hanya replikasi JSON-RPC-nya di sini karena CLI Python tidak bisa
 * jalan di CF Workers. Read-only: tidak menyentuh IG, tidak posting.
 *
 * Query (dari ~/.claude/instagram/niche-research.md):
 *   1. Pasar      — akun trader gold XAUUSD Indonesia terpopuler
 *   2. Jurnal     — segmen jurnal trading (posisi Luxtradee)
 *   3. Hashtag    — tren hashtag/konten viral niche
 *   4-6. Kompetitor top (Andre Rizky, Andy Senjaya, Bitorex) — update
 *        angka followers/perubahan.
 *
 * Penyimpanan: agent_kv (tabel sudah ada — NOL migrasi baru):
 *   niche_research:latest   → JSON riset minggu berjalan (dibaca
 *                             /api/ig/niche-research oleh Sinta)
 *   niche_research:<week>   → arsip per minggu ISO (2026-W47)
 *   niche_research:state    → penanda dedup {week, item_count}
 *
 * Idempotent per minggu: dipanggil ulang di minggu yang sama
 * (round-robin/retry) → skipped tanpa boros panggilan Exa.
 * ?force=1 → jalankan ulang paksa (dua nilai diterima: 1 & true).
 *
 * Auth: Bearer/x-cron-secret = CRON_SECRET (fail-closed di produksi).
 */

export const dynamic = 'force-dynamic'

const EXA_MCP = 'https://mcp.exa.ai/mcp'
const EXA_TIMEOUT_MS = 25_000
const MAX_RESULTS_PER_QUERY = 6
const SNIPPET_CHARS = 700

const RESEARCH_QUERIES = [
  {
    key: 'pasar',
    label: 'Pasar gold-trading ID',
    query: 'akun Instagram trader gold XAUUSD Indonesia terpopuler 2026',
  },
  {
    key: 'jurnal',
    label: 'Segmen jurnal trading',
    query: 'jurnal trading gold XAUUSD pemula Indonesia aplikasi',
  },
  {
    key: 'hashtag',
    label: 'Tren hashtag/viral',
    query: 'hashtag trading gold Indonesia viral reels pemula',
  },
  {
    key: 'komp-andre',
    label: 'Kompetitor: Andre Rizky',
    query: 'Andre Rizky Investasi andrerizkyinvestasi Instagram followers terbaru',
  },
  {
    key: 'komp-andy',
    label: 'Kompetitor: Andy Senjaya',
    query: 'Andy Senjaya andysenjaya Instagram followers terbaru',
  },
  {
    key: 'komp-bitorex',
    label: 'Kompetitor: Bitorex',
    query: 'bitorexpost Bitorex Instagram followers terbaru',
  },
] as const

interface ExaItem {
  title: string
  url: string
  published: string
  author: string
  snippet: string
}

interface QueryResult {
  key: string
  label: string
  query: string
  ok: boolean
  error?: string
  items: ExaItem[]
}

/** Header blok Exa: "Title: …" / "URL: …" / "Published: …" / "Author: …" */
const EXA_HEADER_RE = /^(Title|URL|Published|Author):\s*(.*)$/

/* ── KV kecil (pola seo-factory: agent_kv value text = JSON string) ── */
async function kvGet(admin: { from: Function }, key: string): Promise<unknown> {
  const { data } = await admin.from('agent_kv').select('value').eq('key', key).maybeSingle()
  if (!data?.value) return null
  try {
    return JSON.parse(data.value as string)
  } catch {
    return null
  }
}

async function kvSet(admin: { from: Function }, key: string, value: unknown): Promise<void> {
  try {
    await admin.from('agent_kv').upsert({ key, value: JSON.stringify(value) }, { onConflict: 'key' })
  } catch {
    /* non-kritis — arsip gagal tidak boleh menggagalkan riset */
  }
}

/** ISO week key berdasar kalender WIB, mis. "2026-W47". */
function weekKeyWib(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value || 0)
  const date = new Date(Date.UTC(get('year'), get('month') - 1, get('day')))
  const dayNum = (date.getUTCDay() + 6) % 7 // Senin = 0
  date.setUTCDate(date.getUTCDate() - dayNum + 3) // Kamis minggu ISO ini
  const isoYear = date.getUTCFullYear()
  const jan4 = new Date(Date.UTC(isoYear, 0, 4))
  const week =
    1 +
    Math.round(((date.getTime() - jan4.getTime()) / 86_400_000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7)
  return `${isoYear}-W${String(week).padStart(2, '0')}`
}

/** Pecah teks Exa jadi blok item "Title:/URL:/Published:/Author: + body". */
function parseExaText(text: string): ExaItem[] {
  const items: ExaItem[] = []
  for (const block of ('\n' + text.trim()).split(/\n(?=Title: )/)) {
    const lines = block.trim().split('\n')
    if (!lines[0]?.startsWith('Title:')) continue
    const fields: Record<string, string> = {}
    let i = 0
    while (i < lines.length) {
      const m = EXA_HEADER_RE.exec(lines[i])
      if (!m) break
      fields[m[1].toLowerCase()] = m[2].trim()
      i++
    }
    const body = lines
      .slice(i)
      .filter((l) => l.trim() !== 'Highlights:' && l.trim() !== 'Text:')
      .join('\n')
    items.push({
      title: (fields.title || '').replace(/^N\/A$/, ''),
      url: (fields.url || '').replace(/^N\/A$/, ''),
      published: (fields.published || '').replace(/^N\/A$/, ''),
      author: (fields.author || '').replace(/^N\/A$/, ''),
      snippet: body.slice(0, SNIPPET_CHARS),
    })
  }
  return items
}

/** Panggil Exa hosted MCP (JSON-RPC tools/call — respons bisa SSE). */
async function exaSearch(
  query: string,
  limit: number,
): Promise<{ ok: boolean; items: ExaItem[]; error?: string }> {
  try {
    const res = await fetch(EXA_MCP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'web_search_exa',
          arguments: { query, objective: query, numResults: limit },
        },
      }),
      signal: AbortSignal.timeout(EXA_TIMEOUT_MS),
    })
    if (!res.ok) return { ok: false, items: [], error: `Exa HTTP ${res.status}` }
    const raw = await res.text()
    const payloads = raw.includes('data:')
      ? raw
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trim())
      : [raw]
    let msg: Record<string, unknown> | null = null
    for (let i = payloads.length - 1; i >= 0; i--) {
      if (!payloads[i]) continue
      try {
        msg = JSON.parse(payloads[i])
        break
      } catch {
        /* coba payload data: sebelumnya */
      }
    }
    if (!msg) return { ok: false, items: [], error: 'Exa respons tidak ter-parse' }
    const rpcErr = (msg as { error?: { message?: string; code?: unknown } }).error
    if (rpcErr) {
      return { ok: false, items: [], error: String(rpcErr.message || rpcErr.code || 'Exa RPC error') }
    }
    const result =
      (msg as { result?: { content?: Array<{ type: string; text?: string }>; isError?: boolean } })
        .result || {}
    const text = (result.content || [])
      .filter((c) => c?.type === 'text' && c.text)
      .map((c) => c.text as string)
      .join('\n')
    if (result.isError) return { ok: false, items: [], error: (text || 'Exa tool error').slice(0, 200) }
    const items = parseExaText(text).slice(0, limit)
    if (!items.length) return { ok: false, items: [], error: 'Exa tanpa hasil ter-parse' }
    return { ok: true, items }
  } catch (err: unknown) {
    return { ok: false, items: [], error: (err as Error)?.message || 'Exa fetch gagal' }
  }
}

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const provided =
    request.headers.get('authorization')?.replace('Bearer ', '') ||
    request.headers.get('x-cron-secret') ||
    ''
  const expected = (await getEnvVar('CRON_SECRET')) || process.env.CRON_SECRET
  if (!expected) return process.env.NODE_ENV === 'development'
  return provided === expected
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

  const week = weekKeyWib()
  const force =
    request.nextUrl.searchParams.get('force') === '1' ||
    request.nextUrl.searchParams.get('force') === 'true'

  /* Dedup mingguan — dipanggil ulang di minggu sama (retry worker) → skip. */
  if (!force) {
    try {
      const state = (await kvGet(admin, 'niche_research:state')) as { week?: string } | null
      if (state?.week === week) {
        return NextResponse.json({
          ok: true,
          skipped: true,
          week,
          note: 'Riset minggu ini sudah ada (agent_kv niche_research:latest)',
        })
      }
    } catch (err: unknown) {
      /* agent_kv belum ada → riset tetap jalan (degrade, bukan crash) */
      if (!isMissingTableError(err)) {
        console.warn('[niche-research] cek state gagal (lanjut):', (err as Error)?.message)
      }
    }
  }

  /* Jalankan semua query paralel — 6 panggilan Exa × ~1-5 dtk. */
  const settled = await Promise.all(
    RESEARCH_QUERIES.map(async ({ key, label, query }) => {
      const r = await exaSearch(query, MAX_RESULTS_PER_QUERY)
      const qr: QueryResult = { key, label, query, ok: r.ok, items: r.items }
      if (!r.ok) qr.error = r.error
      return qr
    }),
  )

  const itemCount = settled.reduce((sum, r) => sum + r.items.length, 0)
  const failed = settled.filter((r) => !r.ok)
  const payload = {
    week,
    created_at: new Date().toISOString(),
    engine: 'exa-mcp web_search_exa (Agent Reach parity)',
    queries: RESEARCH_QUERIES.map((q) => ({ key: q.key, label: q.label, query: q.query })),
    results: settled,
    item_count: itemCount,
  }

  /* Simpan walau sebagian query gagal — sebagian data lebih baik dari tanpa data. */
  await kvSet(admin, 'niche_research:latest', payload)
  await kvSet(admin, `niche_research:${week}`, payload)
  await kvSet(admin, 'niche_research:state', { week, item_count: itemCount, at: payload.created_at })

  if (itemCount > 0) {
    const lines = [
      `🔬 **RISET NICHE MINGGUAN** — ${week}`,
      `${itemCount} temuan dari ${settled.length} query (Sinta baca via /api/ig/niche-research)`,
      ...settled.map((r) => `• ${r.label}: ${r.ok ? `${r.items.length} item` : `GAGAL — ${r.error}`}`),
    ]
    await sendAdminNotification(lines.join('\n'))
  }

  return NextResponse.json({
    ok: true,
    week,
    item_count: itemCount,
    queries_ok: settled.length - failed.length,
    queries_failed: failed.length,
    errors: failed.map((f) => ({ key: f.key, error: f.error })),
    stored: ['niche_research:latest', `niche_research:${week}`, 'niche_research:state'],
  })
}
