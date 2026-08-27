'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-[#0a0612] text-white">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0612] via-[#110a1f] to-[#0a0612]" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[150px]" />
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
              className="object-contain"
            />
            <span className="text-lg font-bold bg-gradient-to-r from-cyan-200 to-cyan-400 bg-clip-text text-transparent">
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
          <h1 className="text-4xl font-bold mb-2">Kebijakan Pengembalian Dana (Refund Policy)</h1>
          <p className="text-white/40 mb-8">Terakhir diperbarui: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

          {/* CRITICAL BANNER */}
          <div className="bg-gradient-to-r from-red-500/10 via-blue-500/10 to-red-500/10 border border-red-500/25 rounded-2xl p-5 mb-8">
            <p className="text-white/80 leading-relaxed text-sm">
              <strong className="text-red-300">⚠️ Penting:</strong> LuxTrade adalah produk digital berupa langganan SaaS (Software-as-a-Service). 
              Ini <strong className="text-red-300">BUKAN barang fisik</strong> yang dapat dikembalikan. 
              Seluruh pembelian langganan bersifat <strong className="text-red-300">FINAL dan TIDAK DAPAT dikembalikan (non-refundable)</strong> secara default, 
              sesuai dengan sifat produk digital yang diakses secara instan setelah pembayaran berhasil.
            </p>
          </div>

          <div className="prose prose-invert max-w-none space-y-8">
            {/* Section 1 */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">1. Sifat Produk Digital</h2>
              <p className="text-white/70 leading-relaxed">
                LuxTrade adalah produk digital berupa layanan SaaS (Software-as-a-Service) yang memberikan akses perangkat lunak 
                berbasis web untuk pencatatan dan analisis data trading. Layanan ini bukan merupakan barang fisik yang dapat 
                dikirim, disimpan, atau dikembalikan secara fisik.
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/70 mt-4">
                <li>Setelah akses premium diaktifkan, produk tersebut tidak dapat &quot;dikembalikan&quot; karena sifatnya adalah hak akses digital</li>
                <li>Pengguna langsung mendapatkan manfaat dari fitur premium sejak saat aktivasi</li>
                <li>Ketentuan ini sejalan dengan <strong className="text-cyan-400">UU No. 11 Tahun 2008 Pasal 4 Ayat 3</strong> tentang Informasi dan Transaksi Elektronik (ITE), 
                  yang memberikan pengecualian atas hak pengembalian untuk konten digital yang telah diakses</li>
              </ul>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">2. Ketentuan Non-Refundable</h2>
              <div className="space-y-4">
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5">
                  <p className="text-white/70 leading-relaxed">
                    <strong className="text-red-300">Semua pembelian langganan bersifat FINAL dan TIDAK DAPAT dikembalikan.</strong>
                  </p>
                </div>
                <ul className="list-disc list-inside space-y-2 text-white/70">
                  <li>Seluruh pembelian paket langganan — termasuk <strong>Elite Pro 1 Bulan</strong>, <strong>Elite Pro 6 Bulan</strong>, dan <strong>Lifetime</strong> — bersifat final dan non-refundable</li>
                  <li>Setelah akun pengguna berhasil di-upgrade ke status <strong className="text-cyan-400">Pro</strong>, tidak ada pengembalian dana yang dapat diproses</li>
                  <li>Kami menyediakan <strong>free trial (uji coba gratis) selama 7 hari</strong> agar pengguna dapat mengevaluasi seluruh fitur premium sebelum memutuskan untuk berlangganan</li>
                  <li>Pengguna disarankan untuk memanfaatkan masa trial secara penuh sebelum melakukan pembelian</li>
                </ul>
              </div>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">3. Pengecualian Refund</h2>
              <p className="text-white/70 leading-relaxed mb-4">
                Pengembalian dana <strong className="text-cyan-400">hanya</strong> dapat diproses dalam kondisi berikut:
              </p>
              <div className="space-y-4">
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
                  <h3 className="text-lg font-medium text-cyan-400 mb-2">Pembayaran Ganda (Double Charge)</h3>
                  <p className="text-white/70">Jika Anda terkena potongan dua kali untuk transaksi yang sama, kami akan mengembalikan dana secara <strong>penuh (full refund)</strong> untuk salah satu transaksi.</p>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
                  <h3 className="text-lg font-medium text-cyan-400 mb-2">Kesalahan Teknis dari Sistem Pembayaran</h3>
                  <p className="text-white/70">Jika terjadi kesalahan teknis dari pihak payment gateway yang menyebabkan transaksi bermasalah, kami akan mengembalikan dana secara <strong>penuh (full refund)</strong>.</p>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
                  <h3 className="text-lg font-medium text-cyan-400 mb-2">Akses Tidak Aktif Setelah Pembayaran Dikonfirmasi</h3>
                  <p className="text-white/70">Jika pembayaran Anda telah berhasil dan terkonfirmasi, namun akses premium tidak kunjung aktif, kami akan melakukan <strong>pengembalian dana penuh (full refund)</strong> atau <strong>reaktivasi manual</strong> akun Anda.</p>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5">
                  <p className="text-white/70 leading-relaxed">
                    <strong className="text-red-300">Batas waktu pengajuan:</strong> Permintaan refund atas pengecualian di atas harus diajukan dalam waktu <strong>maksimal 7 hari</strong> sejak insiden terjadi, melalui Discord <strong className="text-cyan-400">LuxTrade Server</strong> atau email <strong className="text-cyan-400">luxtradee@gmail.com</strong>.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">4. Proses Pengajuan Refund</h2>
              <div className="space-y-4">
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
                  <h3 className="text-lg font-medium text-cyan-400 mb-2">Langkah Pengajuan</h3>
                  <ul className="list-disc list-inside space-y-2 text-white/70">
                    <li>Hubungi kami melalui <strong className="text-cyan-400">Discord (LuxTrade Server)</strong> atau email <strong className="text-cyan-400">luxtradee@gmail.com</strong></li>
                    <li>Sertakan bukti pendukung (screenshot pembayaran ganda, bukti transfer, dll.)</li>
                    <li>Sertakan informasi akun: email terdaftar dan tanggal transaksi</li>
                  </ul>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
                  <h3 className="text-lg font-medium text-cyan-400 mb-2">Waktu Proses</h3>
                  <p className="text-white/70">
                    Pengembalian dana akan diproses dalam waktu <strong>maksimal 7 hari kerja</strong> sejak pengajuan diterima dan diverifikasi.
                  </p>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
                  <h3 className="text-lg font-medium text-cyan-400 mb-2">Metode Pengembalian</h3>
                  <p className="text-white/70">
                    Refund akan dikirimkan ke <strong>metode pembayaran asli</strong> yang digunakan saat transaksi (sumber dana yang sama).
                  </p>
                </div>
              </div>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">5. Free Trial</h2>
              <div className="space-y-4">
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
                  <h3 className="text-lg font-medium text-cyan-400 mb-2">Uji Coba Gratis 7 Hari</h3>
                  <ul className="list-disc list-inside space-y-2 text-white/70">
                    <li>Free trial selama <strong>7 hari</strong> tersedia untuk semua pengguna baru LuxTrade</li>
                    <li>Pengguna disarankan untuk memanfaatkan masa trial secara penuh guna mengevaluasi fitur premium sebelum melakukan pembelian</li>
                    <li>Trial akan aktif setelah pengguna melakukan <strong>verifikasi email</strong></li>
                    <li>Free trial bersifat <strong>sekali pakai</strong> — tidak tersedia bagi pengguna yang sebelumnya sudah pernah memiliki status Pro</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">6. Hubungi Kami</h2>
              <p className="text-white/70 leading-relaxed mb-4">
                Jika Anda memiliki pertanyaan mengenai Kebijakan Pengembalian Dana ini, silakan hubungi kami:
              </p>
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5 space-y-3">
                <p className="text-white/70"><strong className="text-cyan-400">Nama Usaha:</strong> LuxTrade</p>
                <p className="text-white/70"><strong className="text-cyan-400">Email:</strong> luxtradee@gmail.com</p>
                <p className="text-white/70"><strong className="text-cyan-400">Telepon:</strong> +62 857-1205-4394</p>
                <p className="text-white/70"><strong className="text-cyan-400">Alamat Usaha:</strong> Jakarta, Indonesia</p>
                <p className="text-white/70"><strong className="text-cyan-400">Website:</strong> luxtradee.web.id</p>
              </div>
            </section>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center text-white/40 text-sm">
          <p>© {new Date().getFullYear()} LuxTrade. All rights reserved.</p>
          <div className="flex justify-center flex-wrap gap-6 mt-4">
            <Link href="/disclaimer" className="hover:text-white transition-colors">Disclaimer</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link href="/refund-policy" className="hover:text-white transition-colors">Refund Policy</Link>
            <Link href="/faq" className="hover:text-white transition-colors">FAQ</Link>
            <Link href="/kontak" className="hover:text-white transition-colors">Kontak</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}