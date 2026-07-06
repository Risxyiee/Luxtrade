'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, FileText, RotateCcw, HelpCircle, Phone, Mail, Send, MapPin, Clock, AlertCircle, Globe, Shield } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

export type LegalPageTab = 'terms' | 'refund' | 'faq' | 'contact' | 'privacy'

interface LegalPagesModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: LegalPageTab
}

const TABS: { id: LegalPageTab; label: string; icon: React.ReactNode }[] = [
  { id: 'terms', label: 'Syarat & Ketentuan', icon: <FileText className="w-4 h-4" /> },
  { id: 'refund', label: 'Refund Policy', icon: <RotateCcw className="w-4 h-4" /> },
  { id: 'faq', label: 'FAQ', icon: <HelpCircle className="w-4 h-4" /> },
  { id: 'contact', label: 'Kontak', icon: <Phone className="w-4 h-4" /> },
  { id: 'privacy', label: 'Privasi', icon: <Shield className="w-4 h-4" /> },
]

export default function LegalPagesModal({ isOpen, onClose, initialTab = 'terms' }: LegalPagesModalProps) {
  const [activeTab, setActiveTab] = useState<LegalPageTab>(initialTab)
  const contentRef = useRef<HTMLDivElement>(null)
  const prevIsOpenRef = useRef(false)

  const handleTabChange = (tab: LegalPageTab) => {
    setActiveTab(tab)
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Sync tab when modal opens with a different initial tab
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      // Using requestAnimationFrame to defer the state update
      const raf = requestAnimationFrame(() => {
        setActiveTab(initialTab)
      })
      return () => cancelAnimationFrame(raf)
    }
    prevIsOpenRef.current = isOpen
  }, [isOpen, initialTab])

  const handleClose = () => {
    onClose()
  }

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    if (isOpen) window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-2 sm:inset-4 md:inset-8 lg:inset-y-8 lg:inset-x-[10%] z-50 flex flex-col bg-[#0d0814] rounded-2xl border border-white/[0.08] shadow-2xl shadow-purple-500/10 overflow-hidden"
          >
            {/* Header with Tabs */}
            <div className="flex-shrink-0 border-b border-white/[0.08]">
              {/* Title row */}
              <div className="flex items-center justify-between px-4 sm:px-6 pt-4 pb-2">
                <h2 className="text-lg sm:text-xl font-bold text-white">Informasi Legal</h2>
                <button
                  onClick={handleClose}
                  className="w-9 h-9 rounded-xl bg-white/5 border border-white/[0.08] flex items-center justify-center hover:bg-white/10 hover:border-purple-500/30 transition-all"
                  aria-label="Tutup"
                >
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>

              {/* Tab Bar */}
              <div className="flex gap-1 px-4 sm:px-6 pb-3 overflow-x-auto no-scrollbar">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                      activeTab === tab.id
                        ? 'bg-[#8a2be2] text-white shadow-lg shadow-purple-500/30'
                        : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70'
                    }`}
                  >
                    {tab.icon}
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div ref={contentRef} className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 py-6 no-scrollbar">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2 }}
                  className="max-w-3xl mx-auto"
                >
                  {activeTab === 'terms' && <TermsContent />}
                  {activeTab === 'refund' && <RefundContent />}
                  {activeTab === 'faq' && <FAQContent />}
                  {activeTab === 'contact' && <ContactContent />}
                  {activeTab === 'privacy' && <PrivacyContent />}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer inside modal */}
            <div className="flex-shrink-0 border-t border-white/[0.08] px-4 sm:px-6 py-3">
              <p className="text-center text-white/30 text-xs">© {new Date().getFullYear()} LuxTrade. All rights reserved.</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ─── Section helper ─── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="text-base sm:text-lg font-bold text-white mb-3 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#8a2be2]" />
        {title}
      </h3>
      <div className="text-white/60 text-sm leading-relaxed space-y-2 pl-4">
        {children}
      </div>
    </div>
  )
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <p className="text-white/60 text-sm leading-relaxed">{children}</p>
}

/* ═══════════════════════════════════════════════════════
   Syarat & Ketentuan
   ═══════════════════════════════════════════════════════ */
function TermsContent() {
  const lastUpdated = '1 Januari 2025'

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">Syarat & Ketentuan</h2>
        <p className="text-white/40 text-sm">Terakhir diperbarui: {lastUpdated}</p>
      </div>

      <Section title="1. Ketentuan Umum">
        <Paragraph>
          LuxTrade adalah layanan jurnal trading digital yang dirancang untuk membantu trader mencatat, menganalisis, dan memperbaiki performa trading mereka. Dengan menggunakan layanan LuxTrade, Anda menyetujui seluruh syarat dan ketentuan yang berlaku.
        </Paragraph>
        <Paragraph>
          Layanan ini disediakan &quot;sebagaimana adanya&quot; dan ditujukan untuk keperluan edukasi serta pencatatan personal. LuxTrade bukan merupakan penasihat keuangan, broker, atau penyedia sinyal trading.
        </Paragraph>
      </Section>

      <Section title="2. Akun & Registrasi">
        <Paragraph>
          Untuk menggunakan LuxTrade, Anda wajib berusia minimal 17 tahun atau lebih sesuai hukum yang berlaku di wilayah Anda. Anda bertanggung jawab untuk memberikan informasi yang akurat, terkini, dan lengkap saat mendaftar.
        </Paragraph>
        <Paragraph>
          Setiap pengguna hanya diperbolehkan memiliki satu akun. LuxTrade berhak menangguhkan atau menghapus akun yang melanggar ketentuan ini. Anda bertanggung jawab menjaga keamanan akun dan password Anda.
        </Paragraph>
        <Paragraph>
          Dengan mendaftar, Anda menyetujui untuk tidak menggunakan LuxTrade untuk aktivitas ilegal atau melanggar hukum yang berlaku.
        </Paragraph>
      </Section>

      <Section title="3. Layanan Berlangganan">
        <Paragraph>
          LuxTrade menyediakan dua paket layanan:
        </Paragraph>
        <ul className="list-disc list-inside space-y-1 text-white/60 text-sm">
          <li><strong className="text-white/80">Free</strong> — Akses terbatas ke fitur dasar jurnal trading.</li>
          <li><strong className="text-white/80">PRO</strong> — Akses penuh ke seluruh fitur termasuk analitik lanjutan, AI insight, dan lainnya.</li>
        </ul>
        <Paragraph>
          Harga dan detail paket dapat berubah sewaktu-waktu. Perubahan harga akan diinformasikan kepada pengguna sebelum berlaku efektif. Pengguna yang sudah berlangganan akan tetap mendapatkan akses dengan harga lama hingga periode berlangganan berakhir.
        </Paragraph>
      </Section>

      <Section title="4. Batasan Tanggung Jawab">
        <Paragraph>
          LuxTrade menyediakan tools analisis dan pencatatan trading. LuxTrade <strong className="text-white/80">BUKAN</strong> penasihat keuangan dan <strong className="text-white/80">TIDAK</strong> memberikan rekomendasi atau sinyal trading dalam bentuk apa pun.
        </Paragraph>
        <Paragraph>
          Keputusan trading sepenuhnya merupakan tanggung jawab pengguna. LuxTrade tidak bertanggung jawab atas kerugian finansial yang timbul dari keputusan trading yang diambil oleh pengguna.
        </Paragraph>
        <Paragraph>
          LuxTrade tidak menjamin ketersediaan layanan 100% setiap saat. Maintenance yang terencana akan diinformasikan sebelumnya.
        </Paragraph>
      </Section>

      <Section title="5. Hak Kekayaan Intelektual">
        <Paragraph>
          Seluruh konten, desain, kode, grafis, logo, dan materi lainnya yang terdapat di LuxTrade merupakan milik LuxTrade dan dilindungi oleh hukum hak kekayaan intelektual yang berlaku.
        </Paragraph>
        <Paragraph>
          Pengguna dilarang menyalin, mendistribusikan, memodifikasi, atau membuat karya turunan dari konten LuxTrade tanpa izin tertulis dari LuxTrade.
        </Paragraph>
      </Section>

      <Section title="6. Pembayaran">
        <Paragraph>
          Pembayaran berlangganan PRO dilakukan melalui metode QRIS. Setelah pembayaran berhasil, aktivasi akun dilakukan secara manual oleh tim LuxTrade.
        </Paragraph>
        <Paragraph>
          Proses aktivasi membutuhkan waktu maksimal 1x24 jam kerja setelah pembayaran dikonfirmasi. Pengguna akan menerima notifikasi setelah akun diaktifkan.
        </Paragraph>
        <Paragraph>
          LuxTrade berhak menolak atau membatalkan transaksi yang dicurigai sebagai penipuan atau pembayaran tidak sah.
        </Paragraph>
      </Section>

      <Section title="7. Privasi & Data">
        <Paragraph>
          Penggunaan data pribadi Anda mengikuti Kebijakan Privasi yang berlaku di LuxTrade. Kami berkomitmen untuk melindungi data pengguna dan hanya menggunakan data sesuai tujuan yang disebutkan dalam kebijakan privasi.
        </Paragraph>
        <Paragraph>
          Data trading yang dicatat oleh pengguna sepenuhnya merupakan milik pengguna masing-masing dan tidak akan dibagikan kepada pihak ketiga tanpa persetujuan.
        </Paragraph>
      </Section>

      <Section title="8. Perubahan Ketentuan">
        <Paragraph>
          LuxTrade berhak mengubah syarat dan ketentuan ini kapan saja. Perubahan akan diinformasikan melalui platform atau email. Penggunaan layanan yang berkelanjutan setelah perubahan ketentuan dianggap sebagai persetujuan terhadap ketentuan yang telah diperbarui.
        </Paragraph>
      </Section>

      <Section title="9. Kontak">
        <Paragraph>
          Jika Anda memiliki pertanyaan mengenai syarat dan ketentuan ini, silakan hubungi kami melalui:
        </Paragraph>
        <div className="space-y-1.5 mt-1">
          <p className="text-white/80 text-sm">
            Email: <a href="mailto:luxtradee@gmail.com" className="text-[#8a2be2] hover:underline">luxtradee@gmail.com</a>
          </p>
          <p className="text-white/80 text-sm">
            Telepon: <a href="tel:+6285712054394" className="text-[#8a2be2] hover:underline">+62 857-1205-4394</a>
          </p>
          <p className="text-white/80 text-sm">
            Alamat: Kebumen, Jawa Tengah, Indonesia
          </p>
        </div>
      </Section>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Refund Policy
   ═══════════════════════════════════════════════════════ */
function RefundContent() {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">Refund Policy</h2>
        <p className="text-white/40 text-sm">Kebijakan pengembalian dana LuxTrade</p>
      </div>

      <Section title="1. Produk Digital">
        <div className="bg-[#2a1b3d]/40 border border-violet-500/20 rounded-xl p-4 mb-3">
          <p className="text-amber-400 text-sm font-semibold flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4" />
            Penting
          </p>
          <Paragraph>
            LuxTrade adalah produk digital berupa layanan berlangganan (subscription). Setelah akun PRO diaktifkan, layanan yang telah diakses tidak dapat dikembalikan (non-refundable).
          </Paragraph>
        </div>
        <Paragraph>
          Hal ini sesuai dengan ketentuan produk digital di Indonesia di mana pengembalian dana tidak dapat dilakukan setelah layanan digital telah dikonsumsi atau diakses.
        </Paragraph>
      </Section>

      <Section title="2. Kebijakan Trial 7 Hari">
        <Paragraph>
          LuxTrade menyediakan masa trial gratis selama 7 hari untuk semua pengguna baru. Selama periode trial:
        </Paragraph>
        <ul className="list-disc list-inside space-y-1 text-white/60 text-sm">
          <li>Anda dapat mengakses seluruh fitur PRO tanpa biaya.</li>
          <li>Anda dapat membatalkan trial kapan saja tanpa dikenakan charge apapun.</li>
          <li>Jika tidak membatalkan, trial akan berakhir otomatis setelah 7 hari.</li>
          <li>Tidak ada penagihan otomatis setelah trial berakhir.</li>
        </ul>
        <Paragraph>
          Kami menyarankan Anda untuk memanfaatkan periode trial ini sepenuhnya sebelum memutuskan untuk berlangganan.
        </Paragraph>
      </Section>

      <Section title="3. Kesalahan Pembayaran">
        <Paragraph>
          Jika terjadi kesalahan pada proses pembayaran seperti:
        </Paragraph>
        <ul className="list-disc list-inside space-y-1 text-white/60 text-sm">
          <li><strong className="text-white/80">Double charge</strong> — Pembayaran terpotong dua kali untuk satu pesanan.</li>
          <li><strong className="text-white/80">Salah nominal</strong> — Jumlah yang dibayarkan tidak sesuai dengan harga yang tertera.</li>
          <li><strong className="text-white/80">Pembayaran gagal namun dana terpotong</strong> — Status pembayaran gagal tetapi saldo berkurang.</li>
        </ul>
        <Paragraph>
          Segera hubungi tim admin LuxTrade melalui Discord <span className="text-[#5865F2] font-semibold">LuxTrade Server</span> atau email <a href="mailto:luxtradee@gmail.com" className="text-[#8a2be2] hover:underline">luxtradee@gmail.com</a> dengan menyertakan bukti pembayaran (screenshot).
        </Paragraph>
      </Section>

      <Section title="4. Proses Refund">
        <Paragraph>
          Jika pengajuan refund Anda memenuhi syarat (kesalahan pembayaran yang terverifikasi), proses pengembalian dana akan dilakukan dalam waktu <strong className="text-white/80">3-5 hari kerja</strong> melalui metode yang sama dengan pembayaran asli (QRIS/e-wallet).
        </Paragraph>
        <Paragraph>
          LuxTrade berhak menolak pengajuan refund yang tidak sesuai dengan kebijakan ini atau yang tidak dilengkapi dengan bukti yang memadai.
        </Paragraph>
      </Section>

      <Section title="5. Cara Mengajukan Refund">
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl">
            <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-[#8a2be2]/20 flex items-center justify-center text-[#8a2be2] font-bold text-sm">1</span>
            <div>
              <p className="text-white/80 text-sm font-semibold">Kirim bukti pembayaran</p>
              <p className="text-white/50 text-xs mt-0.5">Screenshot bukti transfer/bayar yang jelas dan tidak terpotong.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl">
            <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-[#8a2be2]/20 flex items-center justify-center text-[#8a2be2] font-bold text-sm">2</span>
            <div>
              <p className="text-white/80 text-sm font-semibold">Hubungi admin via Discord atau Email</p>
              <p className="text-white/50 text-xs mt-0.5">
                Discord: <span className="text-[#5865F2]">LuxTrade Server</span> atau Email: <a href="mailto:luxtradee@gmail.com" className="text-[#8a2be2] hover:underline">luxtradee@gmail.com</a>
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl">
            <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-[#8a2be2]/20 flex items-center justify-center text-[#8a2be2] font-bold text-sm">3</span>
            <div>
              <p className="text-white/80 text-sm font-semibold">Tunggu proses verifikasi</p>
              <p className="text-white/50 text-xs mt-0.5">Tim kami akan memverifikasi dan memproses refund dalam 3-5 hari kerja.</p>
            </div>
          </div>
        </div>
      </Section>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   FAQ
   ═══════════════════════════════════════════════════════ */
function FAQContent() {
  const faqs = [
    {
      q: 'Apa itu LuxTrade?',
      a: 'LuxTrade adalah platform jurnal trading digital yang dirancang khusus untuk trader Indonesia. Dengan LuxTrade, kamu bisa mencatat setiap trade, menganalisis performa dengan grafik detail, mendapatkan insight dari AI, dan memantau equity curve secara real-time. Tujuannya membantu trader lebih konsisten dan disiplin.',
    },
    {
      q: 'Bagaimana cara kerja trial 7 hari?',
      a: 'Setelah mendaftar, kamu akan langsung mendapatkan akses penuh ke semua fitur PRO selama 7 hari secara gratis. Kamu bisa mencatat trade, menggunakan AI analysis, dan menikmati seluruh fitur tanpa batas. Setelah trial berakhir, akun akan kembali ke versi free. Tidak ada penagihan otomatis — kamu perlu upgrade secara manual jika ingin melanjutkan.',
    },
    {
      q: 'Metode pembayaran apa yang tersedia?',
      a: 'Saat ini LuxTrade menerima pembayaran melalui QRIS, yang mencakup hampir semua e-wallet populer di Indonesia seperti GoPay, OVO, DANA, ShopeePay, LinkAja, dan juga transfer bank melalui QR code.',
    },
    {
      q: 'Bagaimana cara upgrade ke PRO?',
      a: 'Untuk upgrade ke PRO, kamu bisa klik tombol "Upgrade ke PRO" di dashboard atau halaman pricing. Setelah melakukan pembayaran melalui QRIS, kirim bukti pembayaran ke admin LuxTrade. Tim kami akan mengaktifkan akun PRO kamu secara manual dalam waktu maksimal 1x24 jam.',
    },
    {
      q: 'Berapa lama aktivasi setelah bayar?',
      a: 'Proses aktivasi dilakukan secara manual oleh tim LuxTrade. Setelah pembayaran dikonfirmasi, akun PRO kamu akan aktif dalam waktu maksimal 1x24 jam kerja. Biasanya prosesnya lebih cepat, tergantung antrian.',
    },
    {
      q: 'Apakah data saya aman?',
      a: 'Ya, keamanan data adalah prioritas kami. LuxTrade menggunakan enkripsi end-to-end untuk melindungi data kamu. Data trading yang kamu catat sepenuhnya milik kamu dan tidak akan dibagikan kepada pihak ketiga. Kami juga tidak mengakses data trading pribadi pengguna.',
    },
    {
      q: 'Bisa refund setelah berlangganan?',
      a: 'Karena LuxTrade adalah produk digital, setelah akun PRO diaktifkan, layanan yang telah diakses bersifat non-refundable. Namun, kami menyediakan trial 7 hari gratis agar kamu bisa mencoba semua fitur sebelum memutuskan untuk berlangganan. Untuk kesalahan pembayaran (double charge, dsb.), silakan hubungi admin untuk diproses.',
    },
    {
      q: 'Platform apa yang didukung?',
      a: 'LuxTrade adalah web app yang sepenuhnya responsive. Kamu bisa mengaksesnya dari browser di laptop, tablet, maupun smartphone tanpa perlu menginstal aplikasi tambahan. Data trading bisa diimpor dari berbagai platform trading populer seperti MetaTrader 4, MetaTrader 5, dan TradingView.',
    },
    {
      q: 'Apakah LuxTrade memberikan sinyal trading?',
      a: 'TIDAK. LuxTrade adalah platform jurnal trading, bukan penyedia sinyal. Kami tidak memberikan rekomendasi beli/jual atau sinyal trading dalam bentuk apa pun. LuxTrade membantu kamu menganalisis performa trading kamu sendiri agar bisa menjadi trader yang lebih konsisten dan disiplin.',
    },
  ]

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">Pertanyaan yang Sering Diajukan</h2>
        <p className="text-white/40 text-sm">Temukan jawaban untuk pertanyaan umum tentang LuxTrade</p>
      </div>

      <Accordion type="single" collapsible className="space-y-2">
        {faqs.map((faq, index) => (
          <AccordionItem
            key={index}
            value={`faq-${index}`}
            className="bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 data-[state=open]:bg-white/[0.04] data-[state=open]:border-[#8a2be2]/30 transition-all"
          >
            <AccordionTrigger className="text-left text-sm sm:text-base font-semibold text-white/90 hover:text-white hover:no-underline py-4">
              {faq.q}
            </AccordionTrigger>
            <AccordionContent className="text-white/60 text-sm leading-relaxed pb-4">
              {faq.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <div className="mt-8 p-5 bg-[#2a1b3d]/40 border border-violet-500/20 rounded-xl text-center">
        <p className="text-white/70 text-sm mb-2">Masih punya pertanyaan?</p>
        <p className="text-white/40 text-xs mb-4">Hubungi kami langsung melalui Discord atau Email</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="https://discord.gg/HDUNAsnW2R"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold transition-all shadow-lg shadow-[#5865F2]/20"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            Discord LuxTrade
          </a>
          <a
            href="mailto:luxtradee@gmail.com"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/[0.08] hover:bg-white/10 text-white text-sm font-semibold transition-all"
          >
            <Mail className="w-4 h-4" />
            Email Kami
          </a>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Kontak
   ═══════════════════════════════════════════════════════ */
function ContactContent() {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">Hubungi Kami</h2>
        <p className="text-white/40 text-sm">Kami siap membantu kamu</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 mb-8">
        {/* Email */}
        <a
          href="mailto:luxtradee@gmail.com"
          className="group flex items-start gap-4 p-5 bg-white/[0.02] border border-white/[0.06] rounded-xl hover:bg-white/[0.05] hover:border-[#8a2be2]/30 transition-all"
        >
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#8a2be2]/10 border border-[#8a2be2]/20 flex items-center justify-center group-hover:bg-[#8a2be2]/20 transition-all">
            <Mail className="w-5 h-5 text-[#8a2be2]" />
          </div>
          <div>
            <h4 className="font-semibold text-white text-sm mb-1">Email</h4>
            <p className="text-[#8a2be2] text-sm break-all">luxtradee@gmail.com</p>
            <p className="text-white/40 text-xs mt-1">Respon dalam 1x24 jam</p>
          </div>
        </a>

        {/* Discord */}
        <a
          href="https://discord.gg/HDUNAsnW2R"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-start gap-4 p-5 bg-white/[0.02] border border-white/[0.06] rounded-xl hover:bg-white/[0.05] hover:border-[#5865F2]/30 transition-all"
        >
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#5865F2]/10 border border-[#5865F2]/20 flex items-center justify-center group-hover:bg-[#5865F2]/20 transition-all">
            <svg className="w-5 h-5 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-white text-sm mb-1">Discord</h4>
            <p className="text-[#5865F2] text-sm">LuxTrade Server</p>
            <p className="text-white/40 text-xs mt-1">Respon tercepat</p>
          </div>
        </a>

        {/* Phone */}
        <a
          href="https://wa.me/6285712054394"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-start gap-4 p-5 bg-white/[0.02] border border-white/[0.06] rounded-xl hover:bg-white/[0.05] hover:border-[#8a2be2]/30 transition-all"
        >
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#8a2be2]/10 border border-[#8a2be2]/20 flex items-center justify-center group-hover:bg-[#8a2be2]/20 transition-all">
            <Phone className="w-5 h-5 text-[#8a2be2]" />
          </div>
          <div>
            <h4 className="font-semibold text-white text-sm mb-1">Telepon / WhatsApp</h4>
            <p className="text-[#8a2be2] text-sm">+62 857-1205-4394</p>
            <p className="text-white/40 text-xs mt-1">Senin — Sabtu, 09:00 — 21:00 WIB</p>
          </div>
        </a>

        {/* Discord */}
        <a
          href="https://discord.gg/HDUNAsnW2R"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-start gap-4 p-5 bg-white/[0.02] border border-white/[0.06] rounded-xl hover:bg-white/[0.05] hover:border-[#5865F2]/30 transition-all"
        >
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#5865F2]/10 border border-[#5865F2]/20 flex items-center justify-center group-hover:bg-[#5865F2]/20 transition-all">
            <svg className="w-5 h-5 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-white text-sm mb-1">Discord</h4>
            <p className="text-[#5865F2] text-sm">Komunitas LuxTrade</p>
            <p className="text-white/40 text-xs mt-1">Beri masukan & dapatkan insentif</p>
          </div>
        </a>

        {/* Address */}
        <div className="group flex items-start gap-4 p-5 bg-white/[0.02] border border-white/[0.06] rounded-xl">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#8a2be2]/10 border border-[#8a2be2]/20 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-[#8a2be2]" />
          </div>
          <div>
            <h4 className="font-semibold text-white text-sm mb-1">Alamat Usaha</h4>
            <p className="text-white/60 text-sm leading-relaxed">
              Kebumen, Jawa Tengah,<br />
              Indonesia
            </p>
          </div>
        </div>

        {/* Website */}
        <div className="group flex items-start gap-4 p-5 bg-white/[0.02] border border-white/[0.06] rounded-xl">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#8a2be2]/10 border border-[#8a2be2]/20 flex items-center justify-center">
            <Globe className="w-5 h-5 text-[#8a2be2]" />
          </div>
          <div>
            <h4 className="font-semibold text-white text-sm mb-1">Website</h4>
            <p className="text-[#8a2be2] text-sm">luxtrade.id</p>
            <p className="text-white/40 text-xs mt-1">Platform jurnal trading digital</p>
          </div>
        </div>

        {/* Operating Hours */}
        <div className="group flex items-start gap-4 p-5 bg-white/[0.02] border border-white/[0.06] rounded-xl sm:col-span-2">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#8a2be2]/10 border border-[#8a2be2]/20 flex items-center justify-center">
            <Clock className="w-5 h-5 text-[#8a2be2]" />
          </div>
          <div>
            <h4 className="font-semibold text-white text-sm mb-1">Jam Operasional</h4>
            <p className="text-white/60 text-sm">
              Senin — Sabtu, 09:00 — 21:00 WIB
            </p>
            <p className="text-white/40 text-xs mt-1">Hari Minggu & hari libur nasional: libur</p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="p-6 bg-gradient-to-br from-[#8a2be2]/10 to-transparent border border-[#8a2be2]/20 rounded-xl text-center">
        <h3 className="text-lg font-bold text-white mb-2">Butuh bantuan lebih cepat?</h3>
        <p className="text-white/50 text-sm mb-4 max-w-md mx-auto">
          Untuk respon tercepat, hubungi kami langsung melalui Discord. Kami biasanya membalas dalam hitungan menit.
        </p>
        <a
          href="https://discord.gg/HDUNAsnW2R"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-sm transition-all shadow-lg shadow-[#5865F2]/20 active:scale-95"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
          Chat di Discord
        </a>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Kebijakan Privasi
   ═══════════════════════════════════════════════════════ */
function PrivacyContent() {
  const lastUpdated = '1 Januari 2025'

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">Kebijakan Privasi</h2>
        <p className="text-white/40 text-sm">Terakhir diperbarui: {lastUpdated}</p>
      </div>

      <Section title="1. Informasi yang Kami Kumpulkan">
        <Paragraph>
          LuxTrade mengumpulkan informasi yang Anda berikan secara langsung saat mendaftar, seperti nama, email, dan data trading yang Anda catat di platform. Kami juga mengumpulkan data penggunaan secara otomatis seperti alamat IP, jenis browser, dan perilaku navigasi untuk meningkatkan layanan.
        </Paragraph>
      </Section>

      <Section title="2. Penggunaan Informasi">
        <Paragraph>
          Informasi yang dikumpulkan digunakan untuk: menyediakan dan meningkatkan layanan jurnal trading, menganalisis data trading Anda dengan AI untuk memberikan insight, mengirimkan notifikasi terkait akun, memproses pembayaran langganan, dan meningkatkan pengalaman pengguna secara keseluruhan.
        </Paragraph>
      </Section>

      <Section title="3. Perlindungan Data">
        <Paragraph>
          Kami menerapkan langkah-langkah keamanan teknis dan organisasional yang wajar untuk melindungi data pribadi Anda. Semua data disimpan secara terenkripsi dan hanya diakses oleh personil yang berwenang. Namun, tidak ada metode transmisi data melalui internet yang 100% aman.
        </Paragraph>
      </Section>

      <Section title="4. Berbagi Data dengan Pihak Ketiga">
        <Paragraph>
          LuxTrade tidak menjual, memperdagangkan, atau menyewakan data pribadi Anda kepada pihak ketiga. Kami hanya membagikan data yang diperlukan dengan penyedia layanan pihak ketiga (seperti Midtrans untuk pemrosesan pembayaran) untuk menjalankan layanan kami.
        </Paragraph>
      </Section>

      <Section title="5. Cookie & Pelacakan">
        <Paragraph>
          Kami menggunakan cookie dan teknologi pelacakan serupa untuk meningkatkan pengalaman browsing Anda. Anda dapat mengatur preferensi cookie melalui pengaturan browser Anda. Menonaktifkan cookie tertentu dapat mempengaruhi fungsionalitas platform.
        </Paragraph>
      </Section>

      <Section title="6. Hak Anda">
        <Paragraph>
          Anda memiliki hak untuk mengakses, memperbarui, atau menghapus data pribadi Anda kapan saja melalui pengaturan akun atau dengan menghubungi kami. Permintaan penghapusan data akan diproses dalam waktu 14 hari kerja.
        </Paragraph>
      </Section>

      <Section title="7. Perubahan Kebijakan">
        <Paragraph>
          Kami dapat memperbarui kebijakan privasi ini dari waktu ke waktu. Perubahan signifikan akan diberitahukan melalui email atau notifikasi di platform. Penggunaan berkelanjutan atas layanan kami setelah perubahan berarti Anda menyetujui kebijakan yang diperbarui.
        </Paragraph>
      </Section>

      <div className="mt-8 p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl">
        <h4 className="text-sm font-bold text-white mb-2">Pertanyaan tentang privasi?</h4>
        <p className="text-white/40 text-sm">
          Hubungi kami di <a href="mailto:support@luxtrade.id" className="text-[#8a2be2] hover:underline">support@luxtrade.id</a> atau melalui <a href="https://discord.gg/HDUNAsnW2R" target="_blank" rel="noopener noreferrer" className="text-[#5865F2] hover:underline">Discord</a>.
        </p>
      </div>
    </div>
  )
}