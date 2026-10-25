'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * /admin/ai-staff — DIPENSIUNKAN.
 *
 * COO Jualan (karyawan AI monetisasi) sekarang tinggal di KANTOR 3D:
 *   /kantor-ceo → klik chip "💼 COO" atau karakter Bagas.
 *
 * Antrean ACC email penawaran PRO, edit draf, ACC & kirim — semuanya
 * ada di Ruang COO. Halaman ini cuma jadi pintu pengarah biar
 * link/notif lama nggak mati.
 */
export default function AiStaffRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/kantor-ceo')
  }, [router])

  return (
    <div className="min-h-screen bg-[#05070d] flex items-center justify-center px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center animate-pulse">
          <span className="text-xl">💼</span>
        </div>
        <p className="text-sm text-gray-300 font-semibold">Halaman AI Staff sudah pindah ke Kantor 3D</p>
        <p className="text-xs text-gray-500 max-w-xs">
          Antrean ACC jualan COO sekarang ada di <b className="text-emerald-400">Ruang COO — /kantor-ceo</b>.
          Mengalihkan…
        </p>
        <a
          href="/kantor-ceo"
          className="mt-2 inline-flex items-center rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 transition-colors"
        >
          Buka Kantor CEO sekarang →
        </a>
      </div>
    </div>
  )
}
