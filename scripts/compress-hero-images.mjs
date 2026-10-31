#!/usr/bin/env node
/**
 * compress-hero-images.mjs — PERF F1
 * Re-encode screenshot landing yang berat (>700KB–1.1MB) jadi WebP q80
 * pada lebar tampilan 2× (mockup hero hanya 256–320px → 600–720px cukup).
 * Nama file TIDAK berubah → semua referensi (hero/manifest) tetap valid.
 */
import sharp from 'sharp'
import { statSync, writeFileSync } from 'fs'

const jobs = [
  // Hero desktop mockups (tampil di w-64/w-48 = 256/192px → 2x DPR = ~512)
  ['public/screenshot-dashboard-v2.webp', 600],
  ['public/screenshot-trades-v2.webp', 600],
  // PWA manifest screenshots (public/manifest.webmanifest)
  ['public/screenshot-dashboard.webp', 720],
  ['public/screenshot-trades.webp', 720],
]

console.log('🖼  Kompresi hero/PWA screenshots (WebP q80)...\n')
for (const [file, width] of jobs) {
  try {
    const before = statSync(file).size
    const buf = await sharp(file)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 80, effort: 4 })
      .toBuffer()
    writeFileSync(file, buf)
    console.log(`✅ ${file}: ${(before / 1024).toFixed(0)}KB → ${(buf.length / 1024).toFixed(0)}KB (-${(100 - (buf.length / before) * 100).toFixed(1)}%)`)
  } catch (err) {
    console.error(`❌ ${file}:`, err.message)
    process.exitCode = 1
  }
}
