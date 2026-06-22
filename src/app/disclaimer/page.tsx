'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { ArrowLeft, AlertTriangle, ShieldCheck, Scale } from 'lucide-react'

export default function DisclaimerPage() {
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
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-8 h-8 text-amber-400" />
            <h1 className="text-4xl font-bold">Disclaimer</h1>
          </div>
          <p className="text-white/40 mb-8">Terakhir diperbarui: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

          {/* CRITICAL DISCLAIMER BANNER */}
          <div className="bg-gradient-to-r from-red-500/10 via-amber-500/10 to-red-500/10 border border-red-500/25 rounded-2xl p-6 mb-8">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-red-500/20 flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-red-300 mb-2">Penegasan Penting</h2>
                <p className="text-white/80 leading-relaxed">
                  <strong>LuxTrade BUKAN broker sekuritas, BUKAN pialang berjangka, BUKAN pengelola dana (investment manager), 
                  dan BUKAN penasihat investasi terdaftar.</strong> LuxTrade adalah platform perangkat lunak berbasis web 
                  (Software-as-a-Service) yang menyediakan dashboard analisis data untuk trader ritel. 
                  Kami <strong>TIDAK menerima simpanan dana, TIDAK mengeksekusi transaksi, dan TIDAK memberikan 
                  rekomendasi beli/jual instrumen keuangan apapun.</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="prose prose-invert max-w-none space-y-8">
            {/* Section 1 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                <h2 className="text-2xl font-semibold text-white">1. Identitas Layanan</h2>
              </div>
              <div className="space-y-4">
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
                  <h3 className="text-lg font-medium text-amber-400 mb-2">Apa Itu LuxTrade?</h3>
                  <p className="text-white/70 leading-relaxed">
                    LuxTrade adalah platform SaaS (Software-as-a-Service) yang menyediakan dashboard dan perangkat 
                    analisis data untuk membantu trader ritel dalam mencatat, memantau, dan mengevaluasi performa 
                    perdagangan mereka. Layanan kami berfokus pada penyediaan tools teknologi informasi, 
                    <strong className="text-white"> BUKAN pada penyelenggaraan kegiatan perdagangan.</strong>
                  </p>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
                  <h3 className="text-lg font-medium text-amber-400 mb-2">Yang Tidak Kami Lakukan</h3>
                  <ul className="space-y-3 text-white/70">
                    <li className="flex items-start gap-3">
                      <span className="text-red-400 mt-1.5">✕</span>
                      <span>Menyediakan platform trading atau fasilitas jual-beli instrumen keuangan</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-red-400 mt-1.5">✕</span>
                      <span>Menjadi perantara, broker, atau pialang dalam transaksi keuangan</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-red-400 mt-1.5">✕</span>
                      <span>Mengelola, menyimpan, atau menginvestasikan dana nasabah</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-red-400 mt-1.5">✕</span>
                      <span>Memberikan saran investasi atau rekomendasi transaksi</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-red-400 mt-1.5">✕</span>
                      <span>Menjamin profit atau hasil positif dari aktivitas trading pengguna</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-red-400 mt-1.5">✕</span>
                      <span>Terdaftar atau diawasi oleh OJK, Bappebti, Bursa Efek Indonesia, atau regulator pasar modal lainnya</span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 2 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
                <h2 className="text-2xl font-semibold text-white">2. Risiko Perdagangan (Trading)</h2>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5">
                <p className="text-white/80 leading-relaxed">
                  <strong className="text-amber-300">Perdagangan valas (forex), saham, kripto, dan instrumen 
                  keuangan lainnya memiliki risiko tinggi.</strong> Nilai investasi dapat naik maupun turun dan 
                  pengguna mungkin mengalami kerugian melebihi modal awal yang diinvestasikan. 
                  Performa masa lalu <strong>BUKAN</strong> merupakan indikator pasti dari hasil di masa mendatang.
                </p>
              </div>
              <p className="text-white/70 leading-relaxed mt-4">
                Seluruh keputusan untuk membeli, menjual, atau memegang instrumen keuangan sepenuhnya merupakan 
                keputusan independen pengguna. Pengguna bertanggung jawab penuh atas risiko finansial yang timbul 
                dari kegiatan perdagangan mereka.
              </p>
            </section>

            {/* Section 3 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Scale className="w-6 h-6 text-emerald-400" />
                <h2 className="text-2xl font-semibold text-white">3. Batasan Tanggung Jawab</h2>
              </div>
              <p className="text-white/70 leading-relaxed mb-4">
                LuxTrade secara tegas menolak segala bentuk tanggung jawab atas:
              </p>
              <ul className="space-y-3 text-white/70">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                  <span>Kerugian finansial, baik langsung maupun tidak langsung, yang timbul dari kegiatan 
                  perdagangan yang dilakukan oleh pengguna</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                  <span>Ketidakakuratan data, signal, atau analisis yang ditampilkan di platform. 
                  Data bersumber dari pihak ketiga dan mungkin memiliki delay atau kesalahan</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                  <span>Gangguan teknis, downtime, kegagalan server, atau masalah konektivitas yang 
                  mengakibatkan keterlambatan data atau ketidaktersediaan layanan</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                  <span>Tindakan pengguna berdasarkan informasi yang ditampilkan di platform</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                  <span>Kehilangan data akibat force majeure, bencana alam, atau kejadian di luar kendali kami</span>
                </li>
              </ul>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">4. Sifat Informatif Layanan</h2>
              <p className="text-white/70 leading-relaxed mb-4">
                Seluruh informasi, data chart, statistik, fitur analitik, dan konten yang disediakan oleh 
                LuxTrade bersifat <strong className="text-white">informatif dan edukatif</strong>. Informasi 
                tersebut <strong className="text-white">BUKAN</strong> merupakan:
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/70">
                <li>Saran investasi (investment advice)</li>
                <li>Rekomendasi jual-beli (trade recommendation)</li>
                <li>Jaminan keuntungan di masa depan</li>
                <li>Analisis fundamental atau teknikal yang disahkan oleh ahli keuangan</li>
                <li>Persetujuan atau penolakan atas keputusan trading pengguna</li>
              </ul>
              <p className="text-white/70 leading-relaxed mt-4">
                Pengguna dianjurkan untuk selalu melakukan riset mandiri (DYOR - Do Your Own Research) dan 
                berkonsultasi dengan penasihat keuangan profesional yang terdaftar sebelum mengambil 
                keputusan investasi.
              </p>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">5. Perjanjian Pengguna</h2>
              <p className="text-white/70 leading-relaxed">
                Dengan menggunakan LuxTrade, Anda mengakui dan menyetujui bahwa:
              </p>
              <ul className="space-y-3 text-white/70 mt-4">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                  <span>Anda memahami risiko yang melekat pada perdagangan instrumen keuangan</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                  <span>Anda bertanggung jawab sepenuhnya atas keputusan trading Anda</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                  <span>LuxTrade bukan merupakan substitute untuk konsultasi profesional</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                  <span>Anda tidak akan menuntut LuxTrade atas kerugian yang timbul dari trading</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                  <span>Anda menggunakan platform ini atas kehendak sendiri (voluntary basis)</span>
                </li>
              </ul>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">6. Data Pihak Ketiga</h2>
              <p className="text-white/70 leading-relaxed">
                LuxTrade menampilkan data pasar keuangan yang bersumber dari penyedia data pihak ketiga 
                (third-party data providers). Meskipun kami berupaya menyajikan data yang akurat, kami tidak 
                menjamin keakuratan, kelengkapan, atau kekinian data tersebut. Pengguna disarankan untuk 
                memverifikasi informasi penting dari sumber resmi sebelum mengambil keputusan trading.
              </p>
            </section>

            {/* Section 7 */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">7. Hukum yang Berlaku</h2>
              <p className="text-white/70 leading-relaxed">
                Disclaimer ini diatur oleh dan ditafsirkan sesuai dengan hukum Republik Indonesia. 
                Segala sengketa yang timbul dari atau terkait dengan disclaimer ini akan diselesaikan 
                melalui musyawarah terlebih dahulu, dan apabila tidak tercapai kesepakatan, akan 
                diselesaikan melalui Badan Arbitrase Nasional Indonesia (BANI) di Jakarta.
              </p>
            </section>

            {/* Section 8 */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">8. Hubungi Kami</h2>
              <p className="text-white/70 leading-relaxed">
                Jika Anda memiliki pertanyaan mengenai disclaimer ini, silakan hubungi kami:
              </p>
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5 mt-4 space-y-2">
                <p className="text-white/70"><strong className="text-amber-400">Email:</strong> luxtradee@gmail.com</p>
                <p className="text-white/70"><strong className="text-amber-400">Telegram:</strong> <a href="https://t.me/Risxyiee" target="_blank" rel="noopener noreferrer" className="text-[#0088cc] hover:underline">@Risxyiee</a></p>
                <p className="text-white/70"><strong className="text-amber-400">Website:</strong> <a href="https://luxtradee.web.id" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">luxtradee.web.id</a></p>
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
            <Link href="/disclaimer" className="hover:text-white transition-colors">Disclaimer</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
