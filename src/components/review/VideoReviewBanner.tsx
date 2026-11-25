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
            Sample Review — Konten v4 (TradingView UI + VO Indonesia Native)
          </p>
          <h2 className="text-lg md:text-xl font-bold text-white mt-1">
            &ldquo;SL Kena Terus? Ini Penyebabnya&rdquo; v4 — 25 detik, 9:16 — chart TradingView + motion graphics
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Revisi Bos (3 poin): <span className="text-amber-300">① VO ganti edge-tts id-ID-ArdiNeural (Indonesia native, bukan logat asing)</span> ·{' '}
            <span className="text-amber-300">② candle gaya TradingView asli</span> (#131722, #26A69A/#EF5350, axis, grid){' '}
            <span className="text-amber-300">③ UI dinamis</span> — ticker live, KPI count-up, badge glow, kartu glass.
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
            src="/review/luxtrade-sl-pain-sample.mp4"
            controls
            playsInline
            preload="metadata"
            className="w-full max-w-[300px] rounded-xl border border-white/10 bg-black"
          />
          {/* Unduh langsung MP4 buat dipindah ke HP / dikirim ulang */}
          <a
            href="/review/luxtrade-sl-pain-sample.mp4"
            download="luxtrade-sl-kena-v4.mp4"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-300 transition-colors"
          >
            &#8681; Unduh Video v4 (MP4, 2.6 MB)
          </a>
        </div>
        <ul className="text-sm text-gray-300 space-y-2 flex-1">
          <li>&bull; Scene 1 (0-5s): Hook — panel TradingView, candle streaming naik &rarr; crash candle tembus SL (flash merah + shake + badge &ldquo;SL HIT!&rdquo;)</li>
          <li>&bull; Scene 2 (5-12s): Agitasi — SL kena 3× berturut (badge ✕ beruntun), saldo count-down $1.000 &rarr; $412, chip &ldquo;90% trader pemula&rdquo;</li>
          <li>&bull; Scene 3 (12-19s): Solusi — SAFE ZONE di bawah swing low, SL/TP line, rally ke TP HIT +$86, kartu &ldquo;RUMUS SL ANTI-BAKAR&rdquo; 3 langkah</li>
          <li>&bull; Scene 4 (19-25s): CTA — kartu profil LX + tombol FOLLOW glow + 3 benefit + caption penutup</li>
          <li className="text-gray-400">
            VO edge-tts id-ID-ArdiNeural rate +12% (Indonesia native). Chart: TV dark #131722, bull #26A69A / bear #EF5350.
          </li>
        </ul>
      </div>
    </section>
  )
}
