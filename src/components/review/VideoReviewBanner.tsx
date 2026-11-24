'use client'

/* =============================================================
   SAMPLE REVIEW BANNER — LOCAL ONLY (JANGAN COMMIT!)
   Banner review video sampel gaya baru (UI keren + voice-over)
   buat Bos. Hapus file ini + pemanggilannya di (home)/page.tsx
   setelah review selesai. TIDAK untuk produksi.
   ============================================================= */

import React, { useState } from 'react'

export default function VideoReviewBanner() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <section
      aria-label="Review video sampel gaya baru"
      className="relative z-[5] mx-4 mt-4 mb-2 rounded-2xl border border-amber-400/40 bg-amber-50/[0.06] p-4 md:p-6"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[11px] font-bold tracking-[0.18em] text-amber-400 uppercase">
            Sample Review — Gaya Baru Konten (UI + Voice-Over)
          </p>
          <h2 className="text-lg md:text-xl font-bold text-white mt-1">
            &ldquo;SL Kena Dulu, Baru Harga Jalan&rdquo; — 28 detik, 9:16, siap Reels/TikTok
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Tema: pain point trader. Ada voice-over Bahasa Indonesia, caption TikTok-style, chart animasi,
            dan CTA LuxTradee. Tekan play — <span className="text-gray-300">volume nyala</span> untuk dengar vonya.
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Tutup banner review"
          className="shrink-0 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:border-white/30 transition-colors"
        >
          Tutup
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start">
        <video
          src="/review/luxtrade-sl-pain-sample.mp4"
          controls
          playsInline
          preload="metadata"
          className="w-full max-w-[300px] rounded-xl border border-white/10 bg-black"
        />
        <ul className="text-sm text-gray-300 space-y-2 flex-1">
          <li>&bull; Scene 1 (0-6s): Hook — chart live, SL kena, lalu harga jalan (chip merah/hijau)</li>
          <li>&bull; Scene 2 (6-13.6s): Anatomy sweep likuiditas + kartu odometer ENTRY/SL/HARGA JALAN</li>
          <li>&bull; Scene 3 (13.6-20.6s): Perbandingan SL mepet vs SL + buffer ATR (stamp SALAH/BENAR)</li>
          <li>&bull; Scene 4 (20.6-28.4s): Brand LuxTradee + checklist fitur + FOLLOW @luxtradee + disclaimer</li>
          <li className="text-gray-400">
            Catatan: musik latar belum dipasang (butuh katalog musik/sumber) — kalau gaya ini disetujui,
            bisa ditambah + diintegrasikan ke pipeline video otomatis.
          </li>
        </ul>
      </div>
    </section>
  )
}
