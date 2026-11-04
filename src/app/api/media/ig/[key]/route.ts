import { getCloudflareEnv } from '@/lib/cloudflare-bindings'

// ══════════════════════════════════════════════════════════════════════════
// GET /api/media/ig/<key> — sajikan media dari KV (pasangan ig-media-store).
// PUBLIC (tanpa auth) — server Instagram harus bisa fetch tanpa cookie.
//
// Wajib: Content-Type benar (video/mp4 dsb), 200 langsung, TANPA redirect —
// tiga syarat yang bikin fetcher IG gagal (error 2207082) di host publik.
// ══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

function guessCt(key: string): string {
  if (key.endsWith('.png')) return 'image/png'
  if (key.endsWith('.jpg') || key.endsWith('.jpeg')) return 'image/jpeg'
  if (key.endsWith('.webp')) return 'image/webp'
  if (key.endsWith('.webm')) return 'video/webm'
  if (key.endsWith('.mov')) return 'video/quicktime'
  return 'video/mp4'
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params
    if (!key || key.length > 200) {
      return new Response('Bad key', { status: 400 })
    }

    const kv = (await getCloudflareEnv()).luxtradee_kv
    if (!kv) return new Response('KV unavailable', { status: 503 })

    // getWithMetadata tidak ada di deklarasi CFKVNamespace — pakai cast.
    const { value, metadata } = await (kv as any).getWithMetadata(key, {
      type: 'arrayBuffer',
    })
    if (!value) return new Response('Not found / expired', { status: 404 })

    const ct =
      (metadata && typeof metadata === 'object' && (metadata as any).ct) ||
      guessCt(key)

    return new Response(value as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': ct,
        'Content-Length': String((value as ArrayBuffer).byteLength),
        'Cache-Control': 'public, max-age=86400',
        'Accept-Ranges': 'none',
      },
    })
  } catch (err: any) {
    console.error('[media/ig] error:', err?.message)
    return new Response('Internal error', { status: 500 })
  }
}
