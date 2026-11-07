import { NextRequest, NextResponse } from 'next/server'
import { getEnvVar } from '@/lib/cloudflare-bindings'
import { getCronAdmin } from '@/lib/cron-supabase'

/**
 * 📝 POST /api/tiktok/report — katalog video TikTok yang SINTA posting.
 *
 * FIX kekurangan Sinta (7 Nov): tabel `tiktok_posts` (migration 014) yang
 * jadi "DATA RIIL" miliknya — dibaca tiap pagi untuk belajar pola hook &
 * oleh studio video sore — TIDAK PERNAH diisi pipeline mana pun, jadi
 * Sinta selalu "belum ada referensi TikTok tersimpan". Kini runner GitHub
 * Actions (video-bot-cron.yml) melapor balik ke sini setelah video sukses
 * di-upload ke TikTok → katalog terisi otomatis (caption asli yang di-
 * posting; views/likes menyusul kalau TikTok Display API sudah diizinkan).
 *
 * Body JSON:
 *   { "caption": "caption video", "publishId": "id dari TikTok API",
 *     "videoUrl": "https://www.tiktok.com/@.../video/..." (opsional) }
 *
 * Dedupe: kolom url UNIQUE — publishId yang sama di-report ulang tidak
 * membuat baris kembar (upsert on_conflict=url, update caption/posted_at).
 *
 * Auth: Bearer CRON_SECRET (fail-closed — pola master-autonomous).
 */
export const dynamic = 'force-dynamic'

async function handle(request: NextRequest) {
  const secret = (await getEnvVar('CRON_SECRET', { quiet: true })) || process.env.CRON_SECRET || ''
  if (!secret) {
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ success: false, error: 'CRON_SECRET belum diset di server' }, { status: 503 })
    }
  } else {
    const provided = request.headers.get('authorization')?.replace('Bearer ', '') || ''
    if (provided !== secret) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
  }

  const body = (await request.json().catch(() => ({}))) as {
    caption?: string
    publishId?: string
    videoUrl?: string
    status?: string
  }

  const caption = String(body.caption || '').slice(0, 2000)
  const publishId = String(body.publishId || '').trim()
  const videoUrl = String(body.videoUrl || '').trim()
  if (!caption && !publishId) {
    return NextResponse.json({ success: false, error: 'body butuh caption atau publishId' }, { status: 400 })
  }

  const admin = await getCronAdmin()
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Database unavailable (Supabase admin client gagal dibuat)' }, { status: 503 })
  }

  // url wajib-unique: pakai URL publik kalau ada, kalau tidak pakai penanda publishId
  const url = videoUrl || (publishId ? `tiktok:publish:${publishId}` : `tiktok:manual:${Date.now()}`)

  const { error } = await admin.from('tiktok_posts').upsert(
    {
      url,
      caption: caption || '(tanpa caption)',
      posted_at: new Date().toISOString(),
    },
    { onConflict: 'url' },
  )
  if (error) {
    return NextResponse.json({ success: false, error: `Insert tiktok_posts gagal: ${error.message}` }, { status: 502 })
  }

  return NextResponse.json({ success: true, stored: url, note: 'Katalog TikTok terisi — Sinta belajar dari caption ini besok pagi.' })
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
