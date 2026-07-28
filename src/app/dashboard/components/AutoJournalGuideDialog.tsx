'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { BookOpen, ChevronRight, X, Camera, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react'

type Language = 'id' | 'en'

interface AutoJournalGuideDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  language: Language
}

// ============================================================
// TRANSLATIONS — all text follows the user's language toggle
// ============================================================
const t = (lang: Language) => ({
  title: lang === 'id'
    ? 'Panduan Auto-Journal'
    : 'Auto-Journal Guide',
  subtitle: lang === 'id'
    ? 'Cara upload screenshot MT4/MT5 agar AI bisa auto-journal'
    : 'How to upload MT4/MT5 screenshot for AI auto-journal',
  close: lang === 'id' ? 'Tutup' : 'Close',

  steps: [
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
        ? 'Buka LuxTrade, klik "Auto-Journal (AI Lengkap)", upload screenshot tadi. AI otomatis isi semua data + buat jurnal.'
        : 'Open LuxTrade, click "Auto-Journal (AI Complete)", upload the screenshot. AI automatically fills all data + creates journal.',
    },
  ],

  exampleTitle: lang === 'id' ? 'Contoh Screenshot yang Benar' : 'Correct Screenshot Example',
  exampleDesc: lang === 'id'
    ? 'Screenshot detail trade seperti ini yang paling bagus untuk auto-journal. Semua data (symbol, harga, lot, profit, waktu, SL/TP) terlihat jelas.'
    : 'A trade detail screenshot like this is best for auto-journal. All data (symbol, price, lot, profit, time, SL/TP) is clearly visible.',

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
})

export default function AutoJournalGuideDialog({ open, onOpenChange, language }: AutoJournalGuideDialogProps) {
  const translations = t(language)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-lux-bg-card dark:bg-[#0f0b18] border-lux-border dark:border-purple-900/30 text-lux-text-primary dark:text-white max-w-md w-[95vw] max-h-[88vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="shrink-0 px-5 pt-5 pb-3 border-b border-lux-border dark:border-purple-900/20">
          <DialogTitle className="text-lg flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div>
              {translations.title}
              <p className="text-xs text-lux-text-secondary dark:text-gray-400 font-normal mt-0.5">
                {translations.subtitle}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 custom-scrollbar space-y-5">

          {/* Step-by-step */}
          <div className="space-y-2.5">
            <p className="text-sm font-semibold text-lux-text-primary dark:text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              {language === 'id' ? 'Langkah-langkah' : 'Steps'}
            </p>
            {translations.steps.map((step, idx) => (
              <div key={idx} className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-xs font-bold text-purple-300">
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
            <div className="flex-1 h-px bg-lux-border dark:bg-purple-900/20" />
            <Camera className="w-3.5 h-3.5 text-lux-text-muted dark:text-gray-500 flex-shrink-0" />
            <div className="flex-1 h-px bg-lux-border dark:bg-purple-900/20" />
          </div>

          {/* Example Screenshot */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-lux-text-primary dark:text-white flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-purple-400" />
              {translations.exampleTitle}
            </p>
            <p className="text-xs text-lux-text-secondary dark:text-gray-400">{translations.exampleDesc}</p>
            <div className="relative rounded-xl overflow-hidden border border-lux-border dark:border-purple-900/30 bg-black/40">
              <Image
                src="/images/guide/auto-journal-example.jpeg"
                alt={language === 'id' ? 'Contoh screenshot MT5 untuk auto-journal' : 'Example MT5 screenshot for auto-journal'}
                width={400}
                height={500}
                className="w-full h-auto object-contain"
              />
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-lux-border dark:bg-purple-900/20" />
            <div className="flex-1 h-px bg-lux-border dark:bg-purple-900/20" />
          </div>

          {/* Do's and Don'ts */}
          <div className="grid grid-cols-2 gap-3">
            {/* Do's */}
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 space-y-2">
              <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {translations.doTitle}
              </p>
              <ul className="space-y-1.5">
                {translations.doList.map((item, idx) => (
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
                {translations.dontTitle}
              </p>
              <ul className="space-y-1.5">
                {translations.dontList.map((item, idx) => (
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
