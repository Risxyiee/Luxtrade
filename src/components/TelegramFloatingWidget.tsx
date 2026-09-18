'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function TelegramFloatingWidget() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="fixed bottom-5 right-[88px] z-[999998] flex flex-col items-end gap-3">
      {/* Chat Balloon Popup */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 16, originX: 1, originY: 1 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 16 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="relative w-[320px] max-w-[calc(100vw-120px)]"
          >
            {/* Balloon Arrow */}
            <div
              className="absolute -bottom-2 right-6 w-4 h-4 rotate-45 bg-white rounded-sm shadow-[2px_2px_6px_rgba(0,0,0,0.08)]"
            />

            {/* Card */}
            <div className="relative bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,136,204,0.18),0_2px_12px_rgba(0,0,0,0.08)] overflow-hidden border border-gray-100">
              {/* Top Accent Bar */}
              <div className="h-1 bg-gradient-to-r from-[#0088cc] to-[#00b4d8]" />

              <div className="p-5">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  {/* Telegram Icon Circle */}
                  <div className="flex-shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-[#0088cc] to-[#00a8e8] flex items-center justify-center shadow-md shadow-[#0088cc]/20">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="w-6 h-6 text-white"
                    >
                      <path
                        d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0h-.056zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.492-1.302.48-.428-.012-1.252-.242-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.015 3.332-1.386 4.025-1.627 4.476-1.635z"
                        fill="currentColor"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-bold text-gray-900 leading-tight">
                      Lolos Pro Firm Bareng
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                      Grup Telegram Aktif
                    </p>
                  </div>
                </div>

                {/* Message */}
                <p className="text-[13px] text-gray-600 leading-relaxed mb-5">
                  Halo Trader! 🎯 Mau lolos challenge bareng? Yuk gabung di grup diskusi kita.
                </p>

                {/* CTA Button */}
                <a
                  href="https://t.me/Lolosprofirmbareng"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-gradient-to-r from-[#0088cc] to-[#00a8e8] hover:from-[#0077b3] hover:to-[#0096d6] text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-md shadow-[#0088cc]/25 hover:shadow-lg hover:shadow-[#0088cc]/30 active:scale-[0.97]"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0h-.056zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.492-1.302.48-.428-.012-1.252-.242-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.015 3.332-1.386 4.025-1.627 4.476-1.635z" />
                  </svg>
                  Gabung Grup Sekarang
                </a>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-3.5 right-3.5 w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="1" y1="1" x2="13" y2="13" />
                  <line x1="13" y1="1" x2="1" y2="13" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        className="relative flex-shrink-0 w-14 h-14 rounded-full bg-gradient-to-br from-[#0088cc] to-[#00a8e8] text-white shadow-lg shadow-[#0088cc]/30 hover:shadow-xl hover:shadow-[#0088cc]/40 transition-shadow duration-300 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#0088cc]/40 focus:ring-offset-2"
        aria-label="Telegram"
      >
        {/* Telegram SVG Icon */}
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-7 h-7"
        >
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0h-.056zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.492-1.302.48-.428-.012-1.252-.242-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.015 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>

        {/* Ping Animation Ring */}
        {!isOpen && (
          <span className="absolute inset-0 rounded-full bg-[#0088cc] animate-ping opacity-25" />
        )}

        {/* Unread-style Badge */}
        {!isOpen && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1, type: 'spring', stiffness: 400, damping: 15 }}
            className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full border-2 border-white text-[8px] font-bold flex items-center justify-center"
          >
            1
          </motion.span>
        )}
      </motion.button>
    </div>
  )
}
