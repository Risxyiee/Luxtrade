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
            &ldquo;SL Kena Dulu, Baru Harga Jalan&rdquo; v2 — 32 detik, 9:16 — candle TradingView + VO Indonesia native
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Revisi Bos: (1) candle sekarang gaya <span className="text-amber-300">TradingView</span> (teal #26a69a / merah #ef5350,
            wick tegas, chip harga live di axis); (2) voice-over <span className="text-amber-300">edge-tts id-ID-ArdiNeural</span> —
            pelankan Bahasa Indonesia asli, bukan logat asing. Tekan play — <span className="text-gray-300">volume nyala</span>.
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
        <div className="flex flex-col gap-2">
          <video
            src="/review/luxtrade-sl-pain-v2.mp4"
            controls
            playsInline
            preload="metadata"
            className="w-full max-w-[300px] rounded-xl border border-white/10 bg-black"
          />
          {/* Unduh langsung MP4 buat dipindah ke HP / dikirim ulang */}
          <a
            href="/review/luxtrade-sl-pain-v2.mp4"
            download="luxtrade-sl-kena-v2.mp4"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-300 transition-colors"
          >
            &#8681; Unduh Video v2 (MP4, 5.8 MB)
          </a>
        </div>
        <ul className="text-sm text-gray-300 space-y-2 flex-1">
          <li>&bull; Scene 1 (0-5s): Hook — candle TradingView muncul berurutan, teks besar</li>
          <li>&bull; Scene 2 (5-13s): Terminal TV + EQH/LIQUIDITY/SWEEP/DEMAND digambar sinkron VO</li>
          <li>&bull; Scene 3 (13-21s): SL+ATR di bawah zone, chip harga live TV, target path</li>
          <li>&bull; Scene 4 (21-32s): CTA &ldquo;STOP FEELING, IKUTI SISTEM&rdquo; + CEK LINK DI BIO</li>
          <li className="text-gray-400">
            Musik latar bebas-copyright sudah ter-bake (level 0.16 di bawah VO).
          </li>
        </ul>
      </div>
    </section>
  )
}
