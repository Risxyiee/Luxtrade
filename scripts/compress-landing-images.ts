/**
 * Script kompasi gambar landing (jalankan sekali via bun).
 * Timpa file .webp "palsu" (PNG di-rename, ukuran byte identik dengan .png)
 * dengan WebP ASLI hasil sharp — payload turun ±90%.
 * PNG asli TIDAK disentuh (fallback + riwayat aman).
 *
 * Usage: bun scripts/compress-landing-images.ts
 */
import sharp from 'sharp'
import { stat } from 'fs/promises'

const FILES = [
  'screenshot-dashboard-v2',
  'screenshot-calendar-v2',
  'screenshot-trades-v2',
  'screenshot-dashboard-mobile-v2',
]

const BONUS = [
  // poster demo video — kalau terpakai akan ikut ringan
  'demo-video-poster',
  'demo-video-poster-2',
]

async function kb(path: string): Promise<string> {
  try {
    const s = await stat(path)
    return `${(s.size / 1024).toFixed(0)}KB`
  } catch {
    return 'N/A'
  }
}

async function main() {
  const targets = [...FILES, ...BONUS]
  for (const name of targets) {
    const src = `public/${name}.png`
    const out = `public/${name}.webp`
    const before = await kb(src)
    const outBefore = await kb(out)
    await sharp(src)
      .resize({ width: 1080, withoutEnlargement: true })
      .webp({ quality: 78, effort: 4 })
      .toFile(out)
    const after = await kb(out)
    console.log(`✅ ${name}: png=${before} | webp lama(palsu)=${outBefore} → webp baru=${after}`)
  }
}

main().catch((e) => {
  console.error('❌ Gagal kompres:', e)
  process.exit(1)
})
