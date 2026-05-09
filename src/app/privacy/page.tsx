'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function PrivacyPolicyPage() {
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
          <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-white/40 mb-8">Terakhir diperbarui: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

          <div className="prose prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">1. Pendahuluan</h2>
              <p className="text-white/70 leading-relaxed">
                LuxTrade (&quot;kami&quot;, &quot;kita&quot;, atau &quot;Platform&quot;) menghargai privasi Anda. Kebijakan Privasi ini menjelaskan bagaimana kami mengumpulkan, menggunakan, mengungkapkan, dan melindungi informasi pribadi Anda saat Anda menggunakan layanan trading journal kami.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">2. Informasi yang Kami Kumpulkan</h2>
              <div className="space-y-4">
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
                  <h3 className="text-lg font-medium text-amber-400 mb-2">Informasi Akun</h3>
                  <p className="text-white/70">Nama lengkap, alamat email, dan informasi profil yang Anda berikan saat mendaftar.</p>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
                  <h3 className="text-lg font-medium text-amber-400 mb-2">Data Trading</h3>
                  <p className="text-white/70">Informasi trading yang Anda input seperti symbol, entry/exit price, profit/loss, dan catatan trading lainnya.</p>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
                  <h3 className="text-lg font-medium text-amber-400 mb-2">Data Penggunaan</h3>
                  <p className="text-white/70">Informasi tentang bagaimana Anda menggunakan platform, termasuk halaman yang dikunjungi dan fitur yang digunakan.</p>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
                  <h3 className="text-lg font-medium text-amber-400 mb-2">Data Perangkat</h3>
                  <p className="text-white/70">Jenis perangkat, sistem operasi, browser, dan alamat IP untuk keamanan dan analitik.</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">3. Penggunaan Informasi</h2>
              <p className="text-white/70 leading-relaxed mb-4">Kami menggunakan informasi yang dikumpulkan untuk:</p>
              <ul className="list-disc list-inside space-y-2 text-white/70">
                <li>Menyediakan dan mengelola layanan LuxTrade</li>
                <li>Menyimpan dan menampilkan data trading journal Anda</li>
                <li>Menghasilkan analitik dan insight trading</li>
                <li>Mengirim notifikasi penting terkait akun Anda</li>
                <li>Meningkatkan pengalaman pengguna platform</li>
                <li>Mendeteksi dan mencegah penipuan atau aktivitas mencurigakan</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">4. Keamanan Data</h2>
              <p className="text-white/70 leading-relaxed">
                Kami menerapkan langkah-langkah keamanan teknis dan organisasi yang tepat untuk melindungi data Anda, termasuk enkripsi SSL/TLS, autentikasi yang aman, dan penyimpanan database yang terlindungi. Namun, tidak ada metode transmisi melalui internet atau penyimpanan elektronik yang 100% aman.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">5. Berbagi Informasi</h2>
              <p className="text-white/70 leading-relaxed mb-4">Kami tidak menjual data pribadi Anda. Kami hanya dapat membagikan informasi Anda dengan:</p>
              <ul className="list-disc list-inside space-y-2 text-white/70">
                <li>Penyedia layanan yang membantu operasi platform (dengan perjanjian kerahasiaan)</li>
                <li>Pihak berwenang jika diwajibkan oleh hukum</li>
                <li>Dengan persetujuan eksplisit Anda</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">6. Hak Anda</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                  <p className="text-white/70"><strong className="text-white">Akses:</strong> Anda dapat meminta salinan data pribadi Anda.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                  <p className="text-white/70"><strong className="text-white">Koreksi:</strong> Anda dapat meminta perbaikan data yang tidak akurat.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                  <p className="text-white/70"><strong className="text-white">Penghapusan:</strong> Anda dapat meminta penghapusan data Anda.</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                  <p className="text-white/70"><strong className="text-white">Portabilitas:</strong> Anda dapat meminta ekspor data dalam format yang dapat dibaca.</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">7. Cookies</h2>
              <p className="text-white/70 leading-relaxed">
                Kami menggunakan cookies untuk autentikasi, preferensi, dan analitik. Anda dapat mengatur browser untuk menolak cookies, namun beberapa fitur mungkin tidak berfungsi dengan baik.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">8. Perubahan Kebijakan</h2>
              <p className="text-white/70 leading-relaxed">
                Kami dapat memperbarui Kebijakan Privasi ini dari waktu ke waktu. Perubahan signifikan akan diberitahukan melalui email atau notifikasi di platform.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">9. Hubungi Kami</h2>
              <p className="text-white/70 leading-relaxed">
                Jika Anda memiliki pertanyaan tentang Kebijakan Privasi ini, silakan hubungi kami di:
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
