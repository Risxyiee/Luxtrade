'use client'

/**
 * ============================================================
 * DownloadArticlePdf — tombol unduh artikel jadi PDF bermerek
 * ============================================================
 * Permintaan Bos: "tambah tombol download di artikel konten ke
 * pdf biar user bisa download dan kasi wm".
 *
 * Cara kerja:
 *  - jsPDF dimuat DINAMIS saat tombol ditekan (import()) — bundle
 *    halaman tetap ringan, hanya user yang unduh yang membayar biaya.
 *  - Konten diambil dari artikel yang SUDAH dirender di halaman
 *    (sourceSelector, default #article-body) → heading, paragraf,
 *    list, blockquote, table diubah jadi blok teks rapi A4.
 *    Fallback: staticBlocks (untuk 6 artikel klasik statis).
 *  - WATERMARK di setiap halaman: teks diagonal "LuxTradee"
 *    berulang (abu sangat muda, teks tetap terbaca) + footer
 *    "© LuxTradee · luxtradee.web.id" + nomor halaman + link
 *    sumber artikel — branding ikut menyebar tiap PDF dibagikan.
 *  - Tanpa dependensi server — murni client, aman di CF Workers.
 * ============================================================
 */

import { useCallback, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'

/* ── Blok konten hasil ekstraksi ── */
interface PdfBlock {
  type: 'h2' | 'h3' | 'p' | 'li' | 'quote' | 'img'
  text: string
}

export interface DownloadArticlePdfProps {
  /** Nama file PDF (tanpa .pdf). */
  fileName: string
  title: string
  /** Ringkasan/meta description — tampil italic di bawah judul. */
  subtitle?: string
  author?: string
  /** Label tanggal sudah terformat (mis. "12 Desember 2024"). */
  dateLabel?: string
  /** Label waktu baca (mis. "6 menit baca"). */
  readLabel?: string
  /** URL sumber lengkap untuk kredit di PDF. */
  sourceUrl?: string
  /** Selector elemen artikel yang sudah dirender di halaman. */
  sourceSelector?: string
  /** Konten cadangan bila elemen artikel tidak ada (artikel statis). */
  staticBlocks?: PdfBlock[]
  className?: string
}

const PAGE_W = 210
const PAGE_H = 297
const M = { left: 18, right: 18, top: 20, bottom: 22 }
const CONTENT_W = PAGE_W - M.left - M.right

/* Warna palet PDF (RGB) — selaras brand LuxTradee */
const C = {
  brand: [14, 165, 164] as [number, number, number], // cyan (bukan indigo/biru default)
  dark: [15, 23, 42] as [number, number, number],
  body: [51, 65, 85] as [number, number, number],
  muted: [122, 132, 150] as [number, number, number],
  wm: [225, 229, 238] as [number, number, number], // watermark sangat muda
  line: [203, 213, 225] as [number, number, number],
}

/** Rapatkan whitespace agar layout PDF rapi. */
const clean = (s: string) => (s ?? '').replace(/\s+/g, ' ').trim()

/**
 * Ekstrak blok konten dari artikel yang SUDAH dirender di DOM.
 * Menangani h1-h4, p, ul/ol, blockquote, pre/code, table, figure/img.
 */
function extractBlocks(root: Element | null): PdfBlock[] {
  if (!root) return []
  const blocks: PdfBlock[] = []

  const push = (type: PdfBlock['type'], text: string) => {
    const t = clean(text)
    if (t) blocks.push({ type, text: t })
  }

  const walk = (node: Element): void => {
    for (const child of Array.from(node.children)) {
      const tag = child.tagName.toLowerCase()
      if (/^h[1-3]$/.test(tag)) {
        push(tag === 'h1' ? 'h2' : (tag as 'h2' | 'h3'), child.textContent ?? '')
      } else if (tag === 'h4') {
        push('h3', child.textContent ?? '')
      } else if (tag === 'p') {
        // gambar tunggal di dalam <p> jadi placeholder gambar
        const imgs = child.querySelectorAll('img')
        if (imgs.length && clean(child.textContent ?? '').length < 40) {
          imgs.forEach((im) => push('img', im.getAttribute('alt') ?? 'gambar'))
          continue
        }
        push('p', child.textContent ?? '')
      } else if (tag === 'ul' || tag === 'ol') {
        const items = Array.from(child.children).filter((c) => c.tagName.toLowerCase() === 'li')
        items.forEach((li, i) => {
          const prefix = tag === 'ol' ? `${i + 1}. ` : '•  '
          push('li', prefix + (li.textContent ?? ''))
        })
      } else if (tag === 'blockquote') {
        push('quote', `"${clean(child.textContent ?? '')}"`)
      } else if (tag === 'pre' || tag === 'code') {
        push('p', child.textContent ?? '')
      } else if (tag === 'img' || tag === 'figure') {
        push('img', child.getAttribute('alt') ?? child.querySelector('figcaption')?.textContent ?? 'gambar')
      } else if (tag === 'table') {
        child.querySelectorAll('tr').forEach((tr) => {
          const cells = Array.from(tr.children).map((c) => clean(c.textContent ?? ''))
          const line = cells.filter(Boolean).join('  |  ')
          if (line) push('li', line)
        })
      } else if (/^(div|section|article|main|span)$/.test(tag)) {
        walk(child)
      }
    }
  }

  walk(root)
  return blocks
}

export default function DownloadArticlePdf({
  fileName,
  title,
  subtitle,
  author,
  dateLabel,
  readLabel,
  sourceUrl,
  sourceSelector = '#article-body',
  staticBlocks,
  className = '',
}: DownloadArticlePdfProps) {
  const { language } = useLanguage()
  const isEn = language === 'en'
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const label = isEn ? 'Download PDF' : 'Unduh PDF'
  const loadingLabel = isEn ? 'Preparing PDF…' : 'Menyiapkan PDF…'

  const generate = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setErr(null)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })

      /* ── Kumpulkan konten ── */
      const domRoot = sourceSelector ? document.querySelector(sourceSelector) : null
      const blocks: PdfBlock[] = domRoot ? extractBlocks(domRoot) : []
      if (!blocks.length && staticBlocks?.length) blocks.push(...staticBlocks)

      const mm = (pt: number) => pt * 0.352778 // pt → mm

      let y = M.top

      const ensure = (need: number) => {
        if (y + need > PAGE_H - M.bottom) {
          doc.addPage()
          y = M.top
        }
      }

      const writeLines = (
        lines: string[],
        opts: { size: number; style: 'normal' | 'bold' | 'italic'; color: [number, number, number]; lineFactor?: number; indent?: number },
      ) => {
        doc.setFont('helvetica', opts.style)
        doc.setFontSize(opts.size)
        doc.setTextColor(...opts.color)
        const lh = mm(opts.size) * (opts.lineFactor ?? 1.5)
        const x = M.left + (opts.indent ?? 0)
        const w = CONTENT_W - (opts.indent ?? 0)
        for (const line of lines) {
          ensure(lh)
          doc.text(line, x, y + mm(opts.size))
          y += lh
        }
      }

      /* ── Header branding (halaman 1) ── */
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(...C.brand)
      doc.text('LuxTradee', M.left, y + 5)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...C.muted)
      doc.text('luxtradee.web.id', M.left + 34, y + 5)
      y += 10

      doc.setDrawColor(...C.line)
      doc.setLineWidth(0.5)
      doc.line(M.left, y, PAGE_W - M.right, y)
      y += 8

      /* Judul */
      doc.setFont('helvetica', 'bold')
      const titleLines = doc.splitTextToSize(title, CONTENT_W) as string[]
      writeLines(titleLines, { size: 19, style: 'bold', color: C.dark, lineFactor: 1.3 })
      y += 3

      /* Meta: tanggal · baca · penulis */
      const metaBits = [dateLabel, readLabel, author].filter(Boolean) as string[]
      if (metaBits.length) {
        writeLines([metaBits.join('  ·  ')], { size: 9.5, style: 'normal', color: C.muted })
        y += 2
      }

      /* Subjudul / ringkasan */
      if (subtitle) {
        y += 2
        writeLines(doc.splitTextToSize(subtitle, CONTENT_W) as string[], { size: 10.5, style: 'italic', color: C.body, lineFactor: 1.45 })
        y += 2
      }

      /* URL sumber */
      if (sourceUrl) {
        writeLines([`${isEn ? 'Source' : 'Sumber'}: ${sourceUrl}`], { size: 8.5, style: 'normal', color: C.muted })
      }

      y += 6

      /* ── Isi artikel ── */
      for (const b of blocks) {
        switch (b.type) {
          case 'h2':
            y += 4
            writeLines(doc.splitTextToSize(b.text, CONTENT_W) as string[], { size: 14.5, style: 'bold', color: C.dark, lineFactor: 1.3 })
            y += 2
            break
          case 'h3':
            y += 3
            writeLines(doc.splitTextToSize(b.text, CONTENT_W) as string[], { size: 12, style: 'bold', color: C.brand, lineFactor: 1.3 })
            y += 1.5
            break
          case 'quote':
            y += 2
            {
              const lines = doc.splitTextToSize(b.text, CONTENT_W - 8) as string[]
              const lh = mm(10.5) * 1.45
              ensure(lh * lines.length + 3)
              doc.setDrawColor(...C.brand)
              doc.setLineWidth(1.2)
              doc.line(M.left, y, M.left, y + lh * lines.length - lh * 0.4)
              writeLines(lines, { size: 10.5, style: 'italic', color: C.body, lineFactor: 1.45, indent: 8 })
            }
            y += 2
            break
          case 'li':
            writeLines(doc.splitTextToSize(b.text, CONTENT_W) as string[], { size: 10.5, style: 'normal', color: C.body, lineFactor: 1.45 })
            y += 0.5
            break
          case 'img':
            y += 2
            writeLines([`[ ${isEn ? 'Image' : 'Gambar'}: ${b.text} ]`], { size: 9, style: 'italic', color: C.muted })
            y += 2
            break
          default:
            writeLines(doc.splitTextToSize(b.text, CONTENT_W) as string[], { size: 10.5, style: 'normal', color: C.body, lineFactor: 1.5 })
            y += 1.5
        }
      }

      if (!blocks.length) {
        writeLines([isEn ? '(Article content is empty.)' : '(Konten artikel kosong.)'], { size: 10.5, style: 'italic', color: C.muted })
      }

      /* ── Penutup branding ── */
      y += 6
      ensure(16)
      doc.setDrawColor(...C.line)
      doc.line(M.left, y, PAGE_W - M.right, y)
      y += 6
      writeLines(
        [isEn
          ? 'Share freely — this article carries the LuxTradee watermark on every page.'
          : 'Bebas dibagikan — artikel ini membawa watermark LuxTradee di setiap halaman.'],
        { size: 8.5, style: 'italic', color: C.muted },
      )

      /* ── WATERMARK + footer di SEMUA halaman ── */
      const total = doc.getNumberOfPages()
      for (let i = 1; i <= total; i++) {
        doc.setPage(i)

        // Watermark diagonal berulang
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(30)
        doc.setTextColor(...C.wm)
        const spots: Array<[number, number]> = [
          [52, 74], [158, 108], [48, 168], [162, 204], [96, 258],
        ]
        for (const [wx, wy] of spots) {
          doc.text('LuxTradee', wx, wy, { angle: 45, align: 'center' })
        }

        // Footer
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(...C.muted)
        doc.text('© LuxTradee · luxtradee.web.id', M.left, PAGE_H - 10)
        doc.text(`${isEn ? 'Page' : 'Halaman'} ${i}/${total}`, PAGE_W - M.right, PAGE_H - 10, { align: 'right' })
      }

      doc.save(`${fileName}.pdf`)
    } catch (e) {
      setErr(isEn ? 'Failed to generate PDF. Please try again.' : 'Gagal membuat PDF. Coba lagi.')
      console.error('[DownloadArticlePdf]', e)
    } finally {
      setBusy(false)
    }
  }, [busy, fileName, title, subtitle, author, dateLabel, readLabel, sourceUrl, sourceSelector, staticBlocks, isEn])

  return (
    <div className={className}>
      <button
        type="button"
        onClick={generate}
        disabled={busy}
        aria-label={busy ? loadingLabel : label}
        className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/10 hover:bg-cyan-500/20 disabled:opacity-50 px-4 py-2.5 text-sm font-bold text-cyan-300 transition-colors min-h-[44px]"
        title={isEn ? 'Download this article as a watermarked PDF' : 'Unduh artikel ini sebagai PDF ber-watermark'}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {busy ? loadingLabel : label}
      </button>
      {err && <p className="mt-2 text-xs text-red-300">{err}</p>}
    </div>
  )
}

/* ── Helper publik: bangun staticBlocks dari struktur artikel klasik ── */
export function buildStaticBlocks(
  intro: string,
  sections: Array<{ title: string; points: string[] }>,
  conclusion: string,
): PdfBlock[] {
  const out: PdfBlock[] = [{ type: 'p', text: intro }]
  for (const s of sections) {
    out.push({ type: 'h2', text: s.title })
    for (const p of s.points) out.push({ type: 'li', text: `•  ${p}` })
  }
  out.push({ type: 'h2', text: 'Key Takeaway' })
  out.push({ type: 'p', text: conclusion })
  return out
}
