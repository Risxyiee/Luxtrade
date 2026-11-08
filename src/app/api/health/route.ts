import { NextResponse } from 'next/server'
import { getLLMChainStatus, getLastLLMDiag } from '@/lib/ai-llm'
import { getMarketListenerStatus } from '@/services/marketListener'

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
 *
 * 8 Nov 2026 (v2): tambah `lastDiag` — catatan rotasi panggilan callLLM
 * TERAKHIR (model dicoba, HTTP status, auto-discover, cooldown). Inilah
 * jawaban "kok karyawan jatuh ke templat?" TANPA harus login: kalau ada
 * baris `mortera model claude-haiku-5-5 mati → coba cadangan` berarti
 * model-ID salah (auto-discover langsung menyembuhkan); `402` = saldo;
 * `429` = rate-limit. Tanpa nilai key / data user — aman publik.
 */
export async function GET() {
  let llm: { provider: string; ok: boolean; reason?: string }[] | null = null
  try {
    // Fail-open: kalau pembacaan env gagal, health tetap healthy —
    // llm: null artinya "diagnostik tidak tersedia", bukan "down".
    llm = await getLLMChainStatus()
  } catch { /* diagnostik opsional */ }
  let lastDiag: string[] = []
  try { lastDiag = getLastLLMDiag() } catch { /* diagnostik opsional */ }

  // 9 Nov 2026: status Real-time Alert Engine (Sinyal VIP) — state
  // listener WS/mode cron, konfigurasi cooldown. Tanpa secret, aman publik.
  let vipSignals: ReturnType<typeof getMarketListenerStatus> | null = null
  try { vipSignals = getMarketListenerStatus() } catch { /* diagnostik opsional */ }

  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0',
    message: 'Server is running',
    llm,
    lastDiag: lastDiag.length ? lastDiag : ['(belum ada panggilan LLM di isolate ini)'],
    vipSignals,
  })
}
