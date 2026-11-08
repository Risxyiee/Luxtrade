/* One-off: potong ruang kosong atas/bawah screenshot panduan supaya
   tampil rapi di phone-mockup landing (CaraKerja STEP 01 & 03).
   - Deteksi baris konten otomatis (pixel terang = teks/border/warna)
   - Sisakan headroom di atas agar notch phone-mockup tidak menutupi tabel
   - File ASLI tidak diubah (dipakai juga di hero + guide dialog) —
     hasil potong disimpan sebagai varian baru di public/images/landing/
   Jalankan: bun scripts/crop-guide-screens.mjs */
import sharp from 'sharp'
import { mkdirSync } from 'fs'

const BRIGHT = 70            // pixel > 70 dianggap konten (teks/border/aksen)
const MIN_PIX = 3            // minimal 3 pixel terang per baris → baris konten
const GAP_MERGE = 60         // gabung celah antar-blok konten < 60px (bg panel)
const NOTCH_RATIO = 24 / 192 // notch phone-mockup (24px) pada lebar render w-48 (192px)
const HEADROOM_PAD = 15      // bantalan tambahan atas (cushion)
const BOTTOM_PAD = 15        // bantalan bawah

async function contentBounds(src) {
  const { data, info } = await sharp(src).greyscale().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const rows = []
  for (let y = 0; y < height; y++) {
    let n = 0
    for (let x = 0; x < width; x++) {
      if (data[y * width * channels + x] > BRIGHT) { n++; if (n >= MIN_PIX) break }
    }
    rows.push(n >= MIN_PIX)
  }
  // gabungkan run konten yang terpisah celah kecil (background panel)
  const runs = []
  let start = -1, gap = 0
  for (let y = 0; y < height; y++) {
    if (rows[y]) {
      if (start < 0) start = y
      gap = 0
    } else if (start >= 0) {
      gap++
      if (gap > GAP_MERGE) { runs.push([start, y - gap]); start = -1; gap = 0 }
    }
  }
  if (start >= 0) runs.push([start, height - 1])
  if (runs.length === 0) throw new Error(`tidak ada konten terdeteksi di ${src}`)
  // ambil blok konten terbesar (tabel utama)
  const [top, bottom] = runs.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a))
  return { top, bottom, width, height }
}

async function tightCrop(src, dest) {
  const { top, bottom, width, height } = await contentBounds(src)
  // headroom atas cukup untuk notch + cushion, sisanya background gelap alami
  const headroom = Math.round(width * NOTCH_RATIO) + HEADROOM_PAD
  const cropTop = Math.max(0, top - headroom)
  const cropBottom = Math.min(height, bottom + BOTTOM_PAD)
  const h = cropBottom - cropTop
  await sharp(src).extract({ left: 0, top: cropTop, width, height: h }).webp({ quality: 82 }).toFile(dest)
  console.log(`${src}  ${width}x${height}  konten y=${top}..${bottom}  →  ${dest}  ${width}x${h}`)
}

mkdirSync('public/images/landing', { recursive: true })
await tightCrop('public/images/guide/auto-journal-example-v2.webp', 'public/images/landing/auto-journal-tight.webp')
await tightCrop('public/screenshot-trades-v2.webp', 'public/images/landing/trade-list-tight.webp')
