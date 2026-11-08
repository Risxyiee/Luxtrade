import { NextResponse } from 'next/server'
import { getCronAdmin } from '@/lib/cron-supabase'
import { buildHookFallback, socialProofLines, type CsHook, type SocialProof } from '@/lib/growth-sentinel'

/**
 * GET /api/growth/cs-hook — PUBLIK (dipakai widget CS bot landing).
 *
 * Mengembalikan "amunisi" proaktif yang disiapkan Kevin (Growth Sentinel)
 * saat cron jalan: hook sapaan hari ini + angka social proof RIIL.
 * Kalau sentinel belum pernah jalan / agent_kv kosong → fallback
 * deterministik (tanpa angka karangan) — widget tetap hidup.
 *
 * Cache: s-maxage 300 (hook berganti maks tiap 4 jam) + stale-while-revalidate.
 * Endpoint ini TIDAK bocor PII — cuma teks marketing + angka agregat.
 */

export const dynamic = 'force-dynamic'

const STATIC_HOOK: CsHook = {
  greeting: 'Halo! 👋 Mau tahu cara trader jurnal semua entry-nya biar nggak FOMO lagi? Tanya aja di sini.',
  chips: ['Lihat sinyal terbaru 📊', 'Cara mulai gratis? 🆓'],
  note: 'hook statis default (sentinel belum menulis)',
  generatedAt: new Date(0).toISOString(),
  model: 'statis',
}

export async function GET() {
  const admin = await getCronAdmin()

  let hook: CsHook | null = null
  let proof: SocialProof | null = null
  if (admin) {
    try {
      const { data } = await admin
        .from('agent_kv')
        .select('key, value')
        .in('key', ['growth:cs-hook', 'growth:social-proof'])
      for (const row of (data || []) as Array<{ key: string; value: string }>) {
        try {
          if (row.key === 'growth:cs-hook') hook = JSON.parse(row.value) as CsHook
          if (row.key === 'growth:social-proof') proof = JSON.parse(row.value) as SocialProof
        } catch { /* KV korup → abaikan, fallback */ }
      }
    } catch { /* agent_kv belum ada → fallback */ }
  }

  const effectiveHook = hook && typeof hook.greeting === 'string' && hook.greeting.trim().length >= 8
    ? hook
    : STATIC_HOOK

  return NextResponse.json({
    ok: true,
    source: hook ? 'sentinel' : 'fallback',
    hook: {
      greeting: effectiveHook.greeting,
      chips: Array.isArray(effectiveHook.chips) ? effectiveHook.chips.slice(0, 3) : STATIC_HOOK.chips,
      generatedAt: effectiveHook.generatedAt,
    },
    proof: proof
      ? { lines: socialProofLines(proof), generatedAt: proof.generatedAt }
      : null,
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  })
}
