'use client'
// ============================================================
// SourceCapture — penangkap SUMBER KUNJUNGAN di SEMUA halaman.
// (Adopsi patch "Loop Belajar" dari Bos, adaptasi API repo:
//  repo memakai GET /api/src-track?src=... + dedup per hari via
//  cookie lux_src_day di server — bukan POST JSON.)
//
// Kenapa perlu: beacon landing (src/app/page.tsx) hanya jalan di
// halaman depan. Pengunjung yang mendarat LANGSUNG di /blog atau
// /faq dari Google/TikTok/IG tidak tercatat sama sekali.
//
// Cara kerja (fire-and-forget, 1× per sesi tab):
//   1. deteksi sumber: ?src= → ?utm_source= → ?ref= → referrer
//      (dipetakan ke label pendek: google, ig, tiktok, fb, tg, yt, x)
//   2. FIRST-TOUCH: sumber pertama disimpan di localStorage (lx_src)
//      dan dipakai kalau halaman ini tak punya petunjuk sumber
//   3. panggil GET /api/src-track?src=<label> — server yang
//      mendeuplikasi per hari (cookie) & memasang cookie lux_src
//      (dipakai atribusi pendaftar oleh /api/auth/register)
//
// Tanpa data pribadi di browser selain label sumber. Gagal = diam.
// ============================================================

import { useEffect } from 'react'

const KEY = 'lx_src' // first-touch (patch Bos)
const SESS = 'lux_src_hit' // SAMA dgn beacon landing — supaya keduanya saling dedup 1×/sesi

const norm = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '').slice(0, 32)

function fromReferrer(): string {
  try {
    if (!document.referrer) return ''
    const host = new URL(document.referrer).hostname.replace(/^www\./, '')
    if (host.endsWith('luxtradee.web.id')) return ''
    if (host.includes('google.')) return 'google'
    if (host.includes('instagram.')) return 'ig'
    if (host.includes('tiktok.')) return 'tiktok'
    if (host.includes('facebook.') || host === 'fb.com' || host === 'l.facebook.com') return 'fb'
    if (host === 't.me' || host.includes('telegram.')) return 'tg'
    if (host.includes('youtube.') || host === 'youtu.be') return 'yt'
    if (host === 'x.com' || host === 't.co' || host.includes('twitter.')) return 'x'
    if (host.includes('bing.')) return 'bing'
    if (host.includes('duckduckgo.')) return 'ddg'
    if (host.includes('reddit.')) return 'reddit'
    return norm('ref-' + host.split('.')[0])
  } catch { return '' }
}

function detect(qs: URLSearchParams): string {
  const raw = qs.get('src') || qs.get('utm_source') || qs.get('ref') || ''
  return raw ? norm(raw) : fromReferrer()
}

export default function SourceCapture() {
  useEffect(() => {
    try {
      /* Beacon landing mungkin sudah lari di sesi ini → cukup satu. */
      if (sessionStorage.getItem(SESS)) return
      sessionStorage.setItem(SESS, '1')

      const qs = new URLSearchParams(window.location.search)
      const detected = detect(qs)
      let src = detected
      if (!src) {
        try { src = localStorage.getItem(KEY) || '' } catch { /* diblokir → direct */ }
      } else {
        try { if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, src) } catch { /* diam */ }
      }

      void fetch(`/api/src-track?src=${encodeURIComponent(src || 'direct')}`, { keepalive: true }).catch(() => {})
    } catch { /* sessionStorage bisa diblokir — atribusi opsional */ }
  }, [])
  return null
}
