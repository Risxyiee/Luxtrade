import type { Metadata } from 'next'
import Link from 'next/link'
import LotCalculator from './LotCalculator'

/**
 * HALAMAN TOOL GRATIS PUBLIK — Kalkulator Lot Size XAUUSD (Tugas 1,
 * strategi user baru aktif 18-11): trader Indonesia mencari "kalkulator
 * lot xauusd" di Google hampir setiap hari. Tool gratis tanpa login =
 * magnet trafik organik + warm lead (pakai tool → kenal jurnal → daftar).
 *
 * SEO: page ini SERVER component (tanpa 'use client') sehingga seluruh
 * konten edukatif + FAQ ada di HTML mentah — terbaca crawler tanpa JS.
 * Metadata unik + canonical (fix audit SEO 2026-11-12 dipertahankan).
 * FAQ pakai <details>/<summary> native — tanpa JavaScript.
 */

export const metadata: Metadata = {
  title: 'Kalkulator Lot XAUUSD — Hitung Ukuran Lot & Risk',
  description:
    'Kalkulator lot XAUUSD gratis tanpa daftar: hitung ukuran lot, risiko USD, nilai per pip, dan risk-reward dari saldo, % risiko, entry, dan stop loss kamu.',
  alternates: { canonical: '/kalkulator-lot-xauusd' },
  openGraph: {
    title: 'Kalkulator Lot Size XAUUSD Gratis — LuxTradee',
    description:
      'Hitung ukuran lot, risiko USD, nilai per pip, dan rasio risk-reward XAUUSD dari saldo dan stop loss kamu. Gratis, tanpa daftar.',
    type: 'website',
    siteName: 'LuxTradee',
    locale: 'id_ID',
    url: '/kalkulator-lot-xauusd',
  },
}

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: 'Berapa nilai 1 pip XAUUSD?',
    a: 'Untuk 1 lot standar (100 oz), pergerakan 1 pip gold ($0,10) bernilai $10, dan 1 point ($0,01) bernilai $1. Jadi kalau kamu pegang 0,10 lot, setiap pip bernilai $1. Nilai ini berlaku untuk mayoritas broker standar dengan kontrak 100 oz.',
  },
  {
    q: 'Bagaimana rumus menghitung lot size XAUUSD?',
    a: 'Rumusnya: Lot = Risiko USD ÷ (jarak stop loss × 100). Contoh: saldo $1.000, risiko 2% = $20, entry $2.000 dengan SL $1.995 (jarak $5). Lot = 20 ÷ (5 × 100) = 0,04 lot. Kalkulator di atas melakukan hitungan ini otomatis, termasuk pembulatan aman ke bawah.',
  },
  {
    q: 'Berapa risiko ideal per trade?',
    a: 'Mayoritas trader profesional dan buku manajemen risiko menyarankan 1–2% dari saldo per trade. Dengan 1–2%, satu rangkaian loss beruntun (misalnya 10 kali) masih menyisakan sebagian besar modal untuk pulih. Di atas 5% per trade, 5–6 loss beruntun sudah menghapus 25–30% akun.',
  },
  {
    q: 'Apakah hasil kalkulator berlaku di semua broker?',
    a: 'Berlaku untuk broker standar dengan kontrak 100 oz per lot (umumnya broker MT4/MT5 untuk akun standar). Untuk akun cent atau micro lot, nilai kontraknya lebih kecil — cek spesifikasi kontrak "XAUUSD" di MT4/MT5 broker kamu (kolom Contract Size) sebelum dipakai trading nyata.',
  },
  {
    q: 'Apakah kalkulator ini gratis dan perlu daftar?',
    a: 'Gratis 100% dan tanpa daftar. Kalau kamu ingin langkah lebih jauh — mencatat setiap trade, mendeteksi pola kesalahan dengan AI, dan melihat equity curve otomatis — itu fitur utama jurnal trading LuxTradee yang bisa dicoba gratis.',
  },
]

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
}

const appJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Kalkulator Lot Size XAUUSD LuxTradee',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  description:
    'Kalkulator ukuran lot, risiko USD, nilai per pip, dan rasio risk-reward untuk trading XAUUSD (gold). Gratis tanpa daftar.',
}

export default function KalkulatorLotPage() {
  return (
    <main id="main-content" className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd) }}
      />

      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-14">
        {/* Breadcrumb kecil untuk navigasi & internal link */}
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground underline-offset-4 hover:underline">
            LuxTradee
          </Link>
          <span className="mx-2" aria-hidden="true">
            /
          </span>
          <span className="text-foreground font-medium">Kalkulator Lot XAUUSD</span>
        </nav>

        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Kalkulator Lot Size XAUUSD
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Hitung ukuran lot yang tepat untuk trading gold (XAUUSD) berdasarkan saldo akun,
          persentase risiko, dan jarak stop loss kamu — gratis dan tanpa daftar. Kalkulator ini
          memakai kontrak standar 100 oz per lot yang dipakai mayoritas broker MT4/MT5.
        </p>

        {/* Kalkulator interaktif (client component) */}
        <div className="mt-8">
          <LotCalculator />
        </div>

        {/* ===== Konten edukatif server-rendered (SEO) ===== */}
        <section aria-labelledby="cara-pakai" className="mt-14">
          <h2 id="cara-pakai" className="text-2xl font-semibold">
            Cara pakai kalkulator lot ini
          </h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-muted-foreground">
            <li>
              <strong className="text-foreground">Isi saldo akun</strong> — modal kamu dalam USD,
              misalnya 1.000.
            </li>
            <li>
              <strong className="text-foreground">Pilih risiko per trade</strong> — umumnya 1–2%.
              Semakin kecil, semakin tahan terhadap loss beruntun.
            </li>
            <li>
              <strong className="text-foreground">Masukkan harga entry dan stop loss</strong> —
              arah posisi (BUY/SELL) terdeteksi otomatis dari posisi SL kamu.
            </li>
            <li>
              <strong className="text-foreground">Pilih rasio risk-reward</strong> — kalkulator
              menampilkan level take profit dan potensi profit-nya.
            </li>
          </ol>
        </section>

        <section aria-labelledby="formula" className="mt-10">
          <h2 id="formula" className="text-2xl font-semibold">
            Rumus lot size XAUUSD (contoh nyata)
          </h2>
          <div className="mt-4 rounded-lg border bg-muted/40 p-4 font-mono text-sm leading-relaxed">
            Lot = Risiko USD ÷ (jarak SL × 100)
          </div>
          <p className="mt-4 text-muted-foreground">
            Contoh: saldo <strong className="text-foreground">$1.000</strong>, risiko{' '}
            <strong className="text-foreground">2%</strong> = $20. Entry{' '}
            <strong className="text-foreground">$2.000</strong>, SL{' '}
            <strong className="text-foreground">$1.995</strong> → jarak $5. Lot = 20 ÷ (5 × 100) ={' '}
            <strong className="text-foreground">0,04 lot</strong>. Dengan R:R 1:2, take profit di
            $2.010 memberi potensi profit $40 dengan risiko maksimal $20. Angka 100 berasal dari
            kontrak standar gold: 1 lot = 100 oz, sehingga pergerakan harga $1 bernilai $100 per
            lot.
          </p>
        </section>

        <section aria-labelledby="nilai-pip" className="mt-10">
          <h2 id="nilai-pip" className="text-2xl font-semibold">
            Nilai per pip XAUUSD menurut ukuran lot
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Ukuran lot</th>
                  <th className="py-2 pr-4 font-medium">Nilai 1 pip ($0,10)</th>
                  <th className="py-2 font-medium">Nilai 1 point ($0,01)</th>
                </tr>
              </thead>
              <tbody className="text-foreground">
                {[
                  ['0,01 lot', '$0,10', '$0,01'],
                  ['0,10 lot', '$1,00', '$0,10'],
                  ['0,50 lot', '$5,00', '$0,50'],
                  ['1,00 lot', '$10,00', '$1,00'],
                  ['2,00 lot', '$20,00', '$2,00'],
                ].map((row) => (
                  <tr key={row[0]} className="border-b last:border-0">
                    <td className="py-2 pr-4">{row[0]}</td>
                    <td className="py-2 pr-4">{row[1]}</td>
                    <td className="py-2">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="faq" className="mt-10">
          <h2 id="faq" className="text-2xl font-semibold">
            Pertanyaan umum
          </h2>
          <div className="mt-4 space-y-3">
            {FAQS.map((f) => (
              <details
                key={f.q}
                className="group rounded-lg border bg-card p-4 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="cursor-pointer list-none font-medium marker:hidden">
                  <span
                    className="mr-2 inline-block text-amber-500 transition-transform group-open:rotate-90"
                    aria-hidden="true"
                  >
                    ▸
                  </span>
                  {f.q}
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA — tool → jurnal */}
        <section className="mt-14 rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
          <h2 className="text-xl font-semibold">Kalkulator sudah jalan — trade-nya dicatat?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Lot yang tepat adalah setengah pekerjaan. Jurnal trading LuxTradee membaca riwayat
            trade kamu, mendeteksi pola kesalahan dengan AI, dan menampilkan equity curve — gratis
            dimulai.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/auth/signup"
              className="rounded-md bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-amber-400"
            >
              Coba Gratis Sekarang
            </Link>
            <Link
              href="/blog"
              className="rounded-md border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              Baca Panduan Trading
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
