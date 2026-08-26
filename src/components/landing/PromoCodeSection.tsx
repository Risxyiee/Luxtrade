'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'

export default function PromoCodeSection({ language, promoCode, promoRemaining, promoMax, promoActive }: {
  language: 'id' | 'en'
  promoCode: string
  promoRemaining: number | null
  promoMax: number
  promoActive: boolean | null
}) {
  const [copied, setCopied] = useState(false)

  if (promoActive === false) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promoCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* noop */ }
  }

  return (
    <section id="promo" className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="border border-blue-500/20 rounded-2xl bg-blue-500/[0.03] p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div>
            <p className="text-[13px] font-medium text-blue-400 mb-1">
              {language === 'id' ? 'Kode Promo' : 'Promo Code'}
            </p>
            <p className="text-[14px] text-[#f0f2ff] font-medium">
              {promoCode}
            </p>
            {promoRemaining !== null && promoMax > 0 && (
              <p className="text-[12px] text-[#8892b0] mt-1">
                {language === 'id'
                  ? `${promoRemaining} dari ${promoMax} slot tersisa`
                  : `${promoRemaining} of ${promoMax} slots remaining`}
              </p>
            )}
          </div>
          <button
            onClick={handleCopy}
            className="shrink-0 inline-flex items-center gap-2 bg-blue-500 text-white text-[12px] font-medium px-4 py-2 rounded-full hover:bg-blue-600 active:scale-[0.97] transition-all duration-200"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? (language === 'id' ? 'Tersalin' : 'Copied') : 'Copy'}
          </button>
        </motion.div>
      </div>
    </section>
  )
}
