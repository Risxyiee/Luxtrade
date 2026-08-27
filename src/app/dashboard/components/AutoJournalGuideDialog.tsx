'use client'

import Image from 'next/image'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { BookOpen, Camera, Sparkles, CheckCircle2, AlertTriangle, Edit } from 'lucide-react'

type Language = 'id' | 'en'

interface JournalGuideDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  language: Language
  /** 'auto' = Auto-Journal guide, 'manual' = Screenshot AI Isi Otomatis guide */
  mode: 'auto' | 'manual'
}

// ============================================================
// TRANSLATIONS — all text follows the user's language toggle
// ============================================================
const getTranslations = (lang: Language, mode: 'auto' | 'manual') => ({
  title: mode === 'auto'
    ? (lang === 'id' ? 'Panduan Auto-Journal' : 'Auto-Journal Guide')
    : (lang === 'id' ? 'Panduan Upload Screenshot' : 'Screenshot Upload Guide'),

  subtitle: mode === 'auto'
    ? (lang === 'id'
        ? 'Cara upload screenshot MT4/MT5 agar AI bisa auto-journal'
        : 'How to upload MT4/MT5 screenshot for AI auto-journal')
    : (lang === 'id'
        ? 'Cara upload screenshot agar AI auto-isi data trade'
        : 'How to upload screenshot so AI auto-fills trade data'),

  steps: mode === 'auto'
    ? [
        {
          title: lang === 'id' ? 'Buka MT4/MT5' : 'Open MT4/MT5',
          desc: lang === 'id'
            ? 'Buka aplikasi MetaTrader 4 atau 5 di HP atau PC kamu.'
            : 'Open MetaTrader 4 or 5 app on your phone or PC.',
        },
        {
          title: lang === 'id' ? 'Pergi ke Tab History' : 'Go to History Tab',
          desc: lang === 'id'
            ? 'Tap tab "History" di bagian bawah untuk melihat daftar trade yang sudah close.'
            : 'Tap the "History" tab at the bottom to see your closed trades list.',
        },
        {
          title: lang === 'id' ? 'Tap Trade yang Mau di-Journal' : 'Tap the Trade to Journal',
          desc: lang === 'id'
            ? 'Tap salah satu trade yang sudah close. Nanti muncul detail trade (symbol, harga, profit, dll).'
            : 'Tap a closed trade. The trade detail screen will appear (symbol, price, profit, etc.).',
        },
        {
          title: lang === 'id' ? 'Screenshot' : 'Take Screenshot',
          desc: lang === 'id'
            ? 'Screenshot layar detail trade tersebut. Pastikan semua data terlihat jelas.'
            : 'Take a screenshot of the trade detail screen. Make sure all data is clearly visible.',
        },
        {
          title: lang === 'id' ? 'Upload di LuxTrade' : 'Upload on LuxTrade',
          desc: lang === 'id'
            ? 'Klik "Auto-Journal (AI Lengkap)", upload screenshot tadi. AI otomatis isi semua data + buat jurnal.'
            : 'Click "Auto-Journal (AI Complete)", upload the screenshot. AI automatically fills all data + creates journal.',
        },
      ]
    : [
        {
          title: lang === 'id' ? 'Buka MT4/MT5' : 'Open MT4/MT5',
          desc: lang === 'id'
            ? 'Buka aplikasi MetaTrader 4 atau 5 di HP atau PC kamu.'
            : 'Open MetaTrader 4 or 5 app on your phone or PC.',
        },
        {
          title: lang === 'id' ? 'Pergi ke Tab History' : 'Go to History Tab',
          desc: lang === 'id'
            ? 'Tap tab "History" di bagian bawah untuk melihat daftar trade yang sudah close.'
            : 'Tap the "History" tab at the bottom to see your closed trades list.',
        },
        {
          title: lang === 'id' ? 'Tap Trade → Screenshot' : 'Tap Trade → Screenshot',
          desc: lang === 'id'
            ? 'Tap salah satu trade yang sudah close, lalu screenshot detail trade-nya (symbol, harga, profit).'
            : 'Tap a closed trade, then screenshot its detail (symbol, price, profit).',
        },
        {
          title: lang === 'id' ? 'Upload Screenshot di LuxTrade' : 'Upload Screenshot on LuxTrade',
          desc: lang === 'id'
            ? 'Klik "Screenshot (AI Isi Otomatis)", upload gambar tadi. AI akan otomatis isi data symbol, harga, lot, dll di form.'
            : 'Click "Screenshot (AI Auto-fill)", upload the image. AI will auto-fill symbol, price, lot, etc. in the form.',
        },
        {
          title: lang === 'id' ? 'Cek Hasilnya di Form' : 'Check the Form',
          desc: lang === 'id'
            ? 'Data trade sudah keisi otomatis. Tinggal cek, lengkapi catatan/notes, lalu klik "Simpan Trade".'
            : 'Trade data is auto-filled. Just verify, complete notes, then click "Save Trade".',
        },
      ],

  // --- Example images ---
  examples: mode === 'auto'
    ? [
        {
          title: lang === 'id' ? 'Contoh Screenshot yang Benar' : 'Correct Screenshot Example',
          desc: lang === 'id'
            ? 'Screenshot detail trade seperti ini yang paling bagus. Semua data terlihat jelas.'
            : 'A trade detail screenshot like this is best. All data is clearly visible.',
          image: '/images/guide/auto-journal-example.jpeg',
          alt: lang === 'id'
            ? 'Contoh screenshot MT5 untuk auto-journal'
            : 'Example MT5 screenshot for auto-journal',
        },
      ]
    : [
        {
          title: lang === 'id' ? '1. Screenshot dari MT5' : '1. Screenshot from MT5',
          desc: lang === 'id'
            ? 'Screenshot detail trade dari MT4/MT5. Ini yang kamu upload.'
            : 'Screenshot trade detail from MT4/MT5. This is what you upload.',
          image: '/images/guide/auto-journal-example.jpeg',
          alt: lang === 'id'
            ? 'Screenshot MT5 yang di-upload'
            : 'MT5 screenshot to upload',
        },
        {
          title: lang === 'id' ? '2. Hasilnya di Form LuxTrade' : '2. Result in LuxTrade Form',
          desc: lang === 'id'
            ? 'Setelah upload, AI otomatis isi data di form LuxTrade. Tinggal cek dan simpan.'
            : 'After upload, AI auto-fills data in LuxTrade form. Just verify and save.',
          image: '/images/guide/manual-trade-example.jpeg',
          alt: lang === 'id'
            ? 'Hasil form LuxTrade setelah AI isi otomatis'
            : 'LuxTrade form result after AI auto-fill',
        },
      ],

  doTitle: lang === 'id' ? 'Yang Bikin AI Akurat' : 'What Makes AI Accurate',
  doList: lang === 'id'
    ? [
        'Screenshot detail trade (bukan chart kosong)',
        'Symbol, harga, lot, profit terlihat jelas',
        'Waktu open & close terlihat',
        'Resolusi tinggi, tidak blur',
      ]
    : [
        'Screenshot of trade detail (not empty chart)',
        'Symbol, price, lot, profit clearly visible',
        'Open & close time visible',
        'High resolution, not blurry',
      ],

  dontTitle: lang === 'id' ? 'Yang Harus Dihindari' : 'What to Avoid',
  dontList: lang === 'id'
    ? [
        'Screenshot chart kosong tanpa data',
        'Foto layar dari jauh / blur',
        'Screenshot yang dipotong / tidak utuh',
        'Format HEIC / HEIF (pakai JPG/PNG)',
      ]
    : [
        'Empty chart screenshot without data',
        'Blurry / far-away screen photo',
        'Cropped / incomplete screenshot',
        'HEIC / HEIF format (use JPG/PNG)',
      ],

  stepsLabel: lang === 'id' ? 'Langkah-langkah' : 'Steps',
})

export default function JournalGuideDialog({ open, onOpenChange, language, mode }: JournalGuideDialogProps) {
  const tr = getTranslations(language, mode)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-lux-bg-card dark:bg-[#080b12] border-lux-border dark:border-blue-900/30 text-lux-text-primary dark:text-white max-w-md w-[95vw] max-h-[88vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="shrink-0 px-5 pt-5 pb-3 border-b border-lux-border dark:border-blue-900/20">
          <DialogTitle className="text-lg flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center flex-shrink-0 ${
              mode === 'auto'
                ? 'from-blue-500 to-cyan-600'
                : 'from-emerald-500 to-teal-600'
            }`}>
              {mode === 'auto' ? <Sparkles className="w-4 h-4 text-white" /> : <BookOpen className="w-4 h-4 text-white" />}
            </div>
            <div>
              {tr.title}
              <p className="text-xs text-lux-text-secondary dark:text-gray-400 font-normal mt-0.5">
                {tr.subtitle}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 custom-scrollbar space-y-5">

          {/* Step-by-step */}
          <div className="space-y-2.5">
            <p className="text-sm font-semibold text-lux-text-primary dark:text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              {tr.stepsLabel}
            </p>
            {tr.steps.map((step, idx) => (
              <div key={idx} className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-cyan-300">
                  {idx + 1}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-lux-text-primary dark:text-gray-200">{step.title}</p>
                  <p className="text-xs text-lux-text-secondary dark:text-gray-400 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-lux-border dark:bg-blue-900/20" />
            <Camera className="w-3.5 h-3.5 text-lux-text-muted dark:text-gray-500 flex-shrink-0" />
            <div className="flex-1 h-px bg-lux-border dark:bg-blue-900/20" />
          </div>

          {/* Example Screenshots */}
          {tr.examples.map((ex, idx) => (
            <div key={idx} className="space-y-2">
              <p className="text-sm font-semibold text-lux-text-primary dark:text-white flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-cyan-400" />
                {ex.title}
              </p>
              <p className="text-xs text-lux-text-secondary dark:text-gray-400">{ex.desc}</p>
              <div className="relative rounded-xl overflow-hidden border border-lux-border dark:border-blue-900/30 bg-black/40">
                <Image
                  src={ex.image}
                  alt={ex.alt}
                  width={400}
                  height={500}
                  className="w-full h-auto object-contain"
                />
              </div>
            </div>
          ))}

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-lux-border dark:bg-blue-900/20" />
            <div className="flex-1 h-px bg-lux-border dark:bg-blue-900/20" />
          </div>

          {/* Do's and Don'ts */}
          <div className="grid grid-cols-2 gap-3">
            {/* Do's */}
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 space-y-2">
              <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {tr.doTitle}
              </p>
              <ul className="space-y-1.5">
                {tr.doList.map((item, idx) => (
                  <li key={idx} className="text-xs text-emerald-300/80 leading-relaxed flex items-start gap-1.5">
                    <span className="text-emerald-400 mt-0.5 flex-shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Don'ts */}
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 space-y-2">
              <p className="text-xs font-semibold text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {tr.dontTitle}
              </p>
              <ul className="space-y-1.5">
                {tr.dontList.map((item, idx) => (
                  <li key={idx} className="text-xs text-red-300/80 leading-relaxed flex items-start gap-1.5">
                    <span className="text-red-400 mt-0.5 flex-shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
