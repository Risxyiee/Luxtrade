import { NextRequest, NextResponse } from 'next/server'
import { hasFlagshipBinding, isFlagEnabled, getFlagString, getFlagNumber } from '@/lib/cloudflare-bindings'

/**
 * GET /api/flags/status
 * Diagnostik Cloudflare Flagship (feature flags binding `luxtradee`).
 *
 * Tanpa auth:
 *   → { binding: { present } } — cukup untuk memastikan binding hidup di Workers.
 *
 * Dengan auth (Bearer CRON_SECRET / x-cron-secret) + query:
 *   ?key=nama-flag&type=boolean|string|number[&userId=&plan=]
 *   → evaluasi flag nyata dari dashboard + context targeting.
 *     type boolean → default false, string → '', number → 0.
 *
 * Binding hanya ada di runtime CF Workers. Local dev (bun run dev) selalu
 * melaporkan present:false — itu NORMAL, helper otomatis pakai fallback.
 */
export const dynamic = 'force-dynamic'

function isAuthorized(request: NextRequest): boolean {
  const provided = String(
    request.headers.get('authorization')?.replace('Bearer ', '') ||
      request.headers.get('x-cron-secret') ||
      ''
  ).trim()
  const secret = String(process.env.CRON_SECRET || '').trim()
  if (!secret) return process.env.NODE_ENV === 'development'
  return provided === secret
}

export async function GET(request: NextRequest) {
  const present = await hasFlagshipBinding()

  const url = new URL(request.url)
  const key = url.searchParams.get('key')
  const type = (url.searchParams.get('type') || 'boolean').toLowerCase()
  const userId = url.searchParams.get('userId') || undefined
  const plan = url.searchParams.get('plan') || undefined

  // Probe flag nyata → butuh auth (jangan biarkan publik mengintip nama flag)
  if (key) {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const ctx = userId || plan ? { userId, plan } : undefined
    let value: boolean | string | number
    if (type === 'string') value = await getFlagString(key, '', ctx)
    else if (type === 'number') value = await getFlagNumber(key, 0, ctx)
    else value = await isFlagEnabled(key, false, ctx)
    return NextResponse.json({
      source: 'cloudflare-flagship',
      bindingPresent: present,
      probe: { key, type, value, ctx: ctx || null },
      note:
        value === false || value === '' || value === 0
          ? 'Nilai = default. Bisa jadi flag belum dibuat di dashboard, atau memang evaluasinya false.'
          : 'Nilai dari Flagship dashboard.',
    })
  }

  return NextResponse.json({
    source: 'cloudflare-flagship',
    binding: { present, name: 'luxtradee' },
    hint: present
      ? 'Binding hidup. Buat flag di CF dashboard → Flagship → app f60370a9…, lalu probe: /api/flags/status?key=flag-key (auth CRON_SECRET).'
      : process.env.NODE_ENV === 'development'
        ? 'Local dev memang tanpa binding — deploy ke CF Workers lalu cek lagi di sini.'
        : 'Binding tidak terbaca di runtime ini — cek wrangler.jsonc flagship[] dan deploy ulang.',
    usage: 'GET /api/flags/status?key=nama&type=boolean|number|string (+ header Authorization: Bearer CRON_SECRET)',
  })
}
