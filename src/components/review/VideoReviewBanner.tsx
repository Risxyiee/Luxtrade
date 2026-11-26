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
            Sample Review — Konten Baru (pilihan Sinta): Pain Point #3 FOMO
          </p>
          <h2 className="text-lg md:text-xl font-bold text-white mt-1">
            &ldquo;Liat Candle Hijau, Langsung Ikut? Itu FOMO&rdquo; — 38 detik, 9:16 — tempo santai + VO natural +0%
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Standar v5 penuh (revisi Bos &ldquo;terlalu cepet&rdquo;): <span className="text-amber-300">① VO rate +0% — pace natural, nggak buru-buru</span> ·{' '}
            <span className="text-amber-300">② jeda napas 1 dtk/scene</span> ·{' '}
            <span className="text-amber-300">③ spring lembut</span> (stiffness 105-150). Tekan play — <span className="text-gray-300">volume nyala</span>.
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
            src="/review/luxtrade-fomo-zona-sample.mp4"
            controls
            playsInline
            preload="metadata"
            className="w-full max-w-[300px] rounded-xl border border-white/10 bg-black"
          />
          {/* Unduh langsung MP4 buat dipindah ke HP / dikirim ulang */}
          <a
            href="/review/luxtrade-fomo-zona-sample.mp4"
            download="luxtrade-fomo-zona-v1.mp4"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-300 transition-colors"
          >
            &#8681; Unduh Video FOMO (MP4, 7.4 MB)
          </a>
        </div>
        <ul className="text-sm text-gray-300 space-y-2 flex-1">
          <li>&bull; Scene 1 (0-8s): HOOK — candle sideways&rarr;rally, garis ENTRY deket puncak (chase), dump tembus SL &rarr; stamp &ldquo;SL KENA!&rdquo; &rarr; harga MASIH TURUN, ticket merah -$96 count-down, stickman shock</li>
          <li>&bull; Scene 2 (8-17s): SOLUSI — step pills sinkron VO: 1 JANGAN KEJAR ✓ (circle merah di puncak) 2 ZONE ENTRY (gradient hijau, pullback masuk zona) 3 SL 4 TARGET (panah), stickman jalan&rarr;point&rarr;celebrate</li>
          <li>&bull; Scene 3 (17-26s): INSIGHT — kartu &ldquo;GAK BALIK KE ZONA?&rdquo; + strip candle mini animasi (gada setup, gada trade)</li>
          <li>&bull; Scene 4 (26-38s): CTA — mockup app sinyal XAUUSD BUY + ENTRY/SL/TP + TP1 HIT + count-up +$187.50 + chip ENTRY HIT/hasil mengapung + FOLLOW glow + domain</li>
          <li className="text-gray-400">
            VO edge-tts id-ID-ArdiNeural rate +0% (Indonesia murni, tempo natural). Chart TradingView #26A69A/#EF5350 full-bleed kartu border teal + DATA ILUSTRASI — gaya reel referensi Bos.
          </li>
        </ul>
      </div>
    </section>
  )
}
