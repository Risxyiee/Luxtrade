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
            Sample Review — Gaya Baru Konten v3 (Full-Bleed Terminal)
          </p>
          <h2 className="text-lg md:text-xl font-bold text-white mt-1">
            &ldquo;SL Kena Dulu, Baru Harga Jalan&rdquo; v3 — 32 detik, 9:16 — layar trading FULL-SCREEN kayak reel referensi
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Revisi Bos &ldquo;masih teks aja + animasi biasa&rdquo;: sekarang <span className="text-amber-300">chart memenuhi seluruh layar sejak detik 0</span> —
            candle streaming, SL ditembus (flash + shake + stamp &ldquo;SL KENA!&rdquo;), harga rally lagi, CTA jadi mockup app.
            Tekan play — <span className="text-gray-300">volume nyala</span>.
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
            src="/review/luxtrade-sl-pain-v3.mp4"
            controls
            playsInline
            preload="metadata"
            className="w-full max-w-[300px] rounded-xl border border-white/10 bg-black"
          />
          {/* Unduh langsung MP4 buat dipindah ke HP / dikirim ulang */}
          <a
            href="/review/luxtrade-sl-pain-v3.mp4"
            download="luxtrade-sl-kena-v3.mp4"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-300 transition-colors"
          >
            &#8681; Unduh Video v3 (MP4, 6.8 MB)
          </a>
        </div>
        <ul className="text-sm text-gray-300 space-y-2 flex-1">
          <li>&bull; Scene 1 (0-5s): Hook — terminal full-bleed, candle streaming rally &rarr; tembus SL (flash merah + shake + stamp) &rarr; rally &ldquo;HARGA JALAN&rdquo;</li>
          <li>&bull; Scene 2 (5-14s): EQH/LIQUIDITY/SWEEP/DEMAND digambar sinkron VO + chip LANGKAH</li>
          <li>&bull; Scene 3 (14-22s): DEMAND zone + SL+ATR di bawahnya + target path, kamera push pelan</li>
          <li>&bull; Scene 4 (22-32s): CTA mockup app — kartu sinyal XAUUSD BUY, TP1 hit, +$187.50 count-up, FOLLOW</li>
          <li className="text-gray-400">
            VO edge-tts id-ID-ArdiNeural (Indonesia native) + musik latar ter-bake.
          </li>
        </ul>
      </div>
    </section>
  )
}
