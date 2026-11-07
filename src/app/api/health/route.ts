import { NextResponse } from 'next/server'
import { getLLMChainStatus } from '@/lib/ai-llm'

/**
 * GET /api/health — health check PUBLIK (dipakai uptime monitor + probe
 * manual Bos).
 *
 * 8 Nov 2026: kini ikut melaporkan STATUS RANTAI LLM karyawan AI — nama
 * provider + model + apakah key terbaca di runtime (reason: 'no key' /
 * cooldown). SENGJAJA tidak mengekspos nilai key / user data — hanya
 * kehadiran konfigurasi, supaya Bos bisa verifikasi dari luar bahwa
 * secret baru (mis. MORTERA_API_KEY di Cloudflare) benar-benar terbaca
 * tanpa harus membuka dashboard.
 */
export async function GET() {
  let llm: { provider: string; ok: boolean; reason?: string }[] | null = null
  try {
    // Fail-open: kalau pembacaan env gagal, health tetap healthy —
    // llm: null artinya "diagnostik tidak tersedia", bukan "down".
    llm = await getLLMChainStatus()
  } catch { /* diagnostik opsional */ }

  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0',
    message: 'Server is running',
    llm,
  })
}
