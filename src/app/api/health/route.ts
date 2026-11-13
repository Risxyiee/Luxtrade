import { NextResponse } from 'next/server'
import { getLLMChainStatus, getLastLLMDiag, getLLMRecent, getMorteraWallet } from '@/lib/ai-llm'

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
 *
 * 8 Nov 2026 (v3): tambah `mortera` — SALDO wallet milik key langsung
 * dari Mortera (GET /v1/credits + /v1/key, cache 60 dtk): paygIdr
 * (Rupiah), tokenCredits (paket), billingModes yang diizinkan key.
 * Jawab keluhan Bos "udah isi saldo kok gabisa?" — saldo kosong /
 * salah jenis wallet / key salah akun LANGSUNG kelihatan di sini.
 *
 * 13 Nov 2026 (v4): tambah `llmRecent` — 15 panggilan LLM TERAKHIR
 * lintas-isolate (provider, model, ok/gagal + alasan, durasi) dari KV —
 * bukti nyata provider mana yang melayani karyawan (keluhan Bos:
 * "karyawan ai masih pakai apikey gratis"). Tambah `morteraLow`:
 * true bila saldo payg < Rp 5.000 — saat itu rantai gratis memang akan
 * sering mengambil alih sampai top-up (bukan bug, ini ekonomi saldo).
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

  // 9 Nov 2026: status Real-time Alert Engine (Sinyal VIP) DIHAPUS —
  // engine EMA pensiun (keputusan Bos: "kita kan jurnal, bukan jualan
  // sinyal"). Sinyal = Pine Script milik user (pine-alerts).

  // 8 Nov 2026 (v3): saldo wallet Mortera milik key ini — bukti nyata
  // "udah isi saldo kok gabisa?" tanpa harus buka panel Mortera.
  let mortera: Awaited<ReturnType<typeof getMorteraWallet>> = null
  try { mortera = await getMorteraWallet() } catch { /* diagnostik opsional */ }

  // 13 Nov 2026 (v4): riwayat 15 panggilan LLM terakhir (lintas-isolate).
  let llmRecent: Awaited<ReturnType<typeof getLLMRecent>> = null
  try { llmRecent = await getLLMRecent() } catch { /* diagnostik opsional */ }

  const morteraLow = typeof mortera?.paygIdr === 'number' && mortera.reachable
    ? mortera.paygIdr < 5000
    : undefined

  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.1',
    message: 'Server is running',
    llm,
    lastDiag: lastDiag.length ? lastDiag : ['(belum ada panggilan LLM di isolate ini)'],
    llmRecent,
    mortera,
    morteraLow,
  })
}
