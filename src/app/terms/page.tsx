'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[#0a0612] text-white">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0612] via-[#110a1f] to-[#0a0612]" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <header className="border-b border-white/5 bg-[#0a0612]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image 
              src="/logo-premium.png" 
              alt="LuxTrade Logo" 
              width={36} 
              height={36}
              className="rounded-lg"
            />
            <span className="text-lg font-bold bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">
              LuxTrade
            </span>
          </Link>
          <Link href="/">
            <Button variant="ghost" className="text-white/60 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Kembali
            </Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
          <p className="text-white/40 mb-8">Terakhir diperbarui: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

          <div className="prose prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">1. Penerimaan Ketentuan</h2>
              <p className="text-white/70 leading-relaxed">
                Dengan mengakses atau menggunakan LuxTrade, Anda menyetujui untuk terikat dengan Ketentuan Layanan ini. Jika Anda tidak menyetujui ketentuan ini, mohon untuk tidak menggunakan layanan kami.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">2. Deskripsi Layanan</h2>
              <p className="text-white/70 leading-relaxed">
                LuxTrade adalah platform trading journal yang membantu trader mencatat, menganalisis, dan memperbaiki performa trading mereka. Layanan mencakup:
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/70 mt-4">
                <li>Pencatatan dan manajemen data trading</li>
                <li>Analitik dan statistik performa</li>
                <li>Insight AI untuk pembelajaran</li>
                <li>Tools kalkulator risiko</li>
                <li>Fitur berbagi hasil trading</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">3. Akun Pengguna</h2>
              <div className="space-y-4">
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
                  <h3 className="text-lg font-medium text-amber-400 mb-2">Registrasi</h3>
                  <p className="text-white/70">Anda harus memberikan informasi yang akurat dan lengkap saat mendaftar. Anda bertanggung jawab menjaga kerahasiaan password akun Anda.</p>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
                  <h3 className="text-lg font-medium text-amber-400 mb-2">Keamanan Akun</h3>
                  <p className="text-white/70">Anda bertanggung jawab atas semua aktivitas yang terjadi di akun Anda. Segera laporkan jika mencurigai penggunaan tidak sah.</p>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
                  <h3 className="text-lg font-medium text-amber-400 mb-2">Penghapusan Akun</h3>
                  <p className="text-white/70">Anda dapat menghapus akun kapan saja. Penghapusan akun akan menghasilkan penghapusan semua data Anda.</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">4. Penggunaan yang Dilarang</h2>
              <p className="text-white/70 leading-relaxed mb-4">Anda dilarang untuk:</p>
              <ul className="list-disc list-inside space-y-2 text-white/70">
                <li>Menggunakan layanan untuk tujuan ilegal</li>
                <li>Mencoba mengakses sistem atau data pengguna lain tanpa izin</li>
                <li>Mengganggu atau merusak operasi layanan</li>
                <li>Menggunakan bot atau sistem otomatis tanpa izin</li>
                <li>Menyebarkan malware atau kode berbahaya</li>
                <li>Menjual atau mentransfer akun Anda</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">5. Langganan dan Pembayaran</h2>
              <div className="space-y-4">
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
                  <h3 className="text-lg font-medium text-amber-400 mb-2">Paket Gratis</h3>
                  <p className="text-white/70">Fitur dasar tersedia gratis dengan batasan jumlah trades per bulan.</p>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
                  <h3 className="text-lg font-medium text-amber-400 mb-2">Paket Pro (Rp 49.000/bulan)</h3>
                  <p className="text-white/70">Akses penuh ke semua fitur premium tanpa batasan.</p>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
                  <h3 className="text-lg font-medium text-amber-400 mb-2">Garansi Uang Kembali</h3>
                  <p className="text-white/70">7 hari garansi uang kembali tanpa pertanyaan untuk paket Pro.</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">6. Kepemilikan Intelektual</h2>
              <p className="text-white/70 leading-relaxed">
                Semua konten, fitur, dan fungsionalitas LuxTrade adalah milik LuxTrade dan dilindungi oleh hukum hak cipta internasional. Data trading yang Anda input tetap menjadi milik Anda.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">7. Batasan Tanggung Jawab</h2>
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5">
                <p className="text-white/70 leading-relaxed">
                  <strong className="text-red-400">Penting:</strong> LuxTrade adalah tools jurnal trading, BUKAN platform trading atau saran investasi. Keputusan trading sepenuhnya tanggung jawab Anda. Kami tidak bertanggung jawab atas kerugian finansial yang mungkin terjadi dari aktivitas trading Anda.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">8. Penolakan Jaminan</h2>
              <p className="text-white/70 leading-relaxed">
                Layanan disediakan &quot;sebagaimana adanya&quot; tanpa jaminan apapun. Kami tidak menjamin bahwa layanan akan bebas dari error, aman, atau tersedia tanpa gangguan.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">9. Penghentian Layanan</h2>
              <p className="text-white/70 leading-relaxed">
                Kami berhak untuk menangguhkan atau menghentikan akun Anda jika melanggar ketentuan ini. Kami juga dapat menghentikan layanan secara keseluruhan dengan pemberitahuan 30 hari.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">10. Perubahan Ketentuan</h2>
              <p className="text-white/70 leading-relaxed">
                Kami dapat mengubah ketentuan ini sewaktu-waktu. Perubahan akan diberitahukan melalui email atau notifikasi di platform. Penggunaan berlanjut setelah perubahan berarti Anda menyetujui ketentuan baru.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">11. Hukum yang Berlaku</h2>
              <p className="text-white/70 leading-relaxed">
                Ketentuan ini diatur oleh dan ditafsirkan sesuai dengan hukum Republik Indonesia. Sengketa akan diselesaikan melalui arbitrase di Jakarta.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">12. Hubungi Kami</h2>
              <p className="text-white/70 leading-relaxed">
                Jika Anda memiliki pertanyaan tentang Ketentuan Layanan ini, silakan hubungi kami di:
              </p>
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5 mt-4">
                <p className="text-white/70"><strong className="text-amber-400">Email:</strong> support@luxtrade.id</p>
              </div>
            </section>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center text-white/40 text-sm">
          <p>© {new Date().getFullYear()} LuxTrade. All rights reserved.</p>
          <div className="flex justify-center gap-6 mt-4">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
