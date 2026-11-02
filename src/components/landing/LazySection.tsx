'use client'

import { useEffect, useRef, useState } from 'react'

interface LazySectionProps {
  children: React.ReactNode
  /** Perkiraan tinggi section sbg placeholder (mencegah layout shift kasar) */
  minHeight?: number
  /** Mulai load N px SEBELUM section terlihat (default 800px ≈ 1 layar) */
  rootMargin?: number
  className?: string
  'aria-label'?: string
  /**
   * ID anchor cadangan saat konten belum termuat — agar link `#id` dari
   * tempat lain tetap berfungsi (begitu di-jump, IO langsung memuat konten).
   * Saat konten sudah tampil, id dilepas ke section asli di dalam children.
   */
  anchorId?: string
}

/**
 * LazySection — tunda mount + fetch chunk JS children sampai user scroll
 * mendekati section (IntersectionObserver, rootMargin ~1 layar).
 *
 * Dipakai utk widget landing yang berat & interaktif (simulator AI,
 * tutorial interaktif) yang di-dynamic import dgn ssr:false — tanpa ini
 * chunk-nya di-fetch + di-parse langsung saat hydration walau user belum
 * scroll ke situ → memperlambat interaktif awal halaman (TTI/INP).
 *
 * SEO aman: hanya utk widget client-only (memang tidak di-SSR).
 */
export default function LazySection({
  children,
  minHeight = 420,
  rootMargin = 800,
  className,
  'aria-label': ariaLabel,
  anchorId,
}: LazySectionProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || show) return

    // Browser tanpa IO (very old) → langsung tampil, jangan pernah blok konten
    if (typeof IntersectionObserver === 'undefined') {
      setShow(true)
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true)
          io.disconnect()
        }
      },
      { rootMargin: `${rootMargin}px 0px` },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [show, rootMargin])

  return (
    <div
      ref={ref}
      className={className}
      aria-label={ariaLabel}
      id={show ? undefined : anchorId}
      style={show ? undefined : { minHeight }}
    >
      {show ? children : null}
    </div>
  )
}
