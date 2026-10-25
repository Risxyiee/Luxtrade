import { NextRequest, NextResponse } from 'next/server'

/**
 * GET/POST /api/ab-track
 *
 * 🧪 MESIN A/B TEST CTA LANDING — eksperimen otomatis Farhan (Growth Hacker)
 *
 * Landing page membagi pengunjung 50/50 ke varian A/B teks tombol CTA
 * (bucket disimpan di localStorage → pengunjung sama selalu lihat varian sama).
 * Event "view" & "click" dicatat di sini ke tabel agent_kv:
 *   ab:views:A:2025-11-03 · ab:clicks:A:2025-11-03 · ab:views:B:... dst.
 *
 * POST { variant: 'A'|'B', event: 'view'|'click' }  → catat 1 event
 * GET  → statistik 7 hari terakhir + conversion rate per varian
 *        (dipakai panel Ruang Growth, laporan mingguan Farhan & briefing CEO)
 *
 * Tanpa tabel baru, tanpa secret — angka agregat saja (aman publik).
 */

export const dynamic = 'force-dynamic'

const VARIANTS = ['A', 'B'] as const
const EVENTS = ['view', 'click'] as const

function sbUrl() {
  return (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
}
function sbKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
}
function sbH(): Record<string, string> {
  const key = sbKey()
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
}

async function kvGetRaw(key: string): Promise<string | null> {
  const url = sbUrl(); if (!url || !sbKey()) return null
  try {
    const res = await fetch(`${url}/rest/v1/agent_kv?select=value&key=eq.${encodeURIComponent(key)}`, {
      headers: sbH(), signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const rows = (await res.json()) as { value?: string }[]
    return rows[0]?.value ?? null
  } catch { return null }
}

async function kvIncrRaw(key: string): Promise<void> {
  const cur = parseInt((await kvGetRaw(key)) || '0', 10)
  const url = sbUrl(); if (!url || !sbKey()) return
  try {
    await fetch(`${url}/rest/v1/agent_kv?on_conflict=key`, {
      method: 'POST',
      headers: { ...sbH(), Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ key, value: String(cur + 1) }),
      signal: AbortSignal.timeout(8000),
    })
  } catch { /* tracking jangan bikin landing gagal */ }
}

export async function POST(req: NextRequest) {
  let body: { variant?: string; event?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'body bukan JSON' }, { status: 400 }) }

  const variant = String(body.variant || '').toUpperCase()
  const event = String(body.event || '').toLowerCase()
  if (!VARIANTS.includes(variant as 'A' | 'B')) return NextResponse.json({ ok: false, error: 'variant harus A atau B' }, { status: 400 })
  if (!EVENTS.includes(event as 'view' | 'click')) return NextResponse.json({ ok: false, error: 'event harus view atau click' }, { status: 400 })

  const day = new Date().toISOString().slice(0, 10)
  await kvIncrRaw(`ab:${event}:${variant}:${day}`)
  return NextResponse.json({ ok: true })
}

export async function GET() {
  const days: string[] = []
  for (let i = 0; i < 7; i++) days.push(new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10))

  const out: Record<string, { views: number; clicks: number; cr: string }> = {}
  try {
    for (const v of VARIANTS) {
      let views = 0, clicks = 0
      const rows = await Promise.all(days.flatMap(d => [kvGetRaw(`ab:view:${v}:${d}`), kvGetRaw(`ab:click:${v}:${d}`)]))
      rows.forEach((val, i) => {
        const n = parseInt(val || '0', 10) || 0
        if (i % 2 === 0) views += n; else clicks += n
      })
      out[v] = { views, clicks, cr: views ? `${Math.round((clicks / views) * 1000) / 10}%` : '—' }
    }
  } catch { /* fallback kosong */ }

  const a = out.A, b = out.B
  const winner = !a || !b || (a.views < 20 && b.views < 20) ? 'belum cukup data'
    : parseFloat(b.cr) > parseFloat(a.cr) ? 'B'
    : parseFloat(a.cr) > parseFloat(b.cr) ? 'A' : 'imbang'

  return NextResponse.json({
    ok: true,
    window: '7 hari terakhir',
    variants: out,
    winner,
    note: 'Statistik agregat CTA landing — dibaca Farhan (GH) untuk laporan mingguan & briefing CEO',
  })
}
