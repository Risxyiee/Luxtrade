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
            Sample Review — Konten Baru (pilihan Sinta): Pain Point #3 FOMO — v3
          </p>
          <h2 className="text-lg md:text-xl font-bold text-white mt-1">
            &ldquo;Liat Candle Hijau, Langsung Ikut? Itu FOMO&rdquo; — ±59 detik, 9:16 — suara Bos + zoom analisa entry
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Revisi Bos 28-11: <span className="text-amber-300">① logat VO Indonesia murni + dikonversi suara Bos (OpenVoice, verifikasi kemiripan 0.87-0.91)</span> ·{' '}
            <span className="text-amber-300">② zoom area entry + kandel BERHENTI saat penjelasan</span> ·{' '}
            <span className="text-amber-300">③ detail kenapa entry disitu</span>. Tekan play — <span className="text-gray-300">volume nyala</span>.
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
            download="luxtrade-fomo-zona-v3.mp4"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-300 transition-colors"
          >
            &#8681; Unduh Video FOMO (MP4)
          </a>
        </div>
        <ul className="text-sm text-gray-300 space-y-2 flex-1">
          <li>&bull; Scene 1 (0-9s): HOOK — candle rally&rarr;dump tembus SL &rarr; stamp &ldquo;SL KENA!&rdquo; &rarr; ticket merah -$96, stickman shock</li>
          <li>&bull; Scene 2 (9-26s): ANALISA BARU — candle streaming satu-satu &rarr; BERHENTI di zona (badge ⏸ ANALISA) &rarr; KAMERA ZOOM ke area entry &rarr; detail berurutan: ZONA ENTRY &rarr; BERHENTI &rarr; MOMENTUM ABIS &rarr; PENGAMAN &rarr; zoom-out &rarr; panah SASARAN — semua sinkron VO</li>
          <li>&bull; Scene 3 (26-36s): INSIGHT — kartu &ldquo;GAK BALIK KE ZONA?&rdquo; + strip candle mini (gada setup, gada trade)</li>
          <li>&bull; Scene 4 (36-59s): CTA branding — rekap 3 aturan &ldquo;YANG KAMU BAWA PULANG&rdquo; + chip SABAR/DISIPLIN + FOLLOW @luxtradee (tanpa jualan website, arahan Bos)</li>
          <li className="text-gray-400">
            VO: teks Indonesia murni (tanpa istilah Inggris) diucapkan id-ID-ArdiNeural rate +0%, lalu tone-color dikonversi ke suara Bos via OpenVoice (SE gabungan sampel Bos, tau 0.2) — pelafalan Indonesia diverifikasi ASR. Chart TradingView full-bleed + DATA ILUSTRASI.
          </li>
        </ul>
      </div>
    </section>
  )
}
