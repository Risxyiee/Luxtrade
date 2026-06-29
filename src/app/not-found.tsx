'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f051d]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="flex flex-col items-center text-center px-6"
      >
        <Image
          src="/logo.png"
          alt="LuxTrade Logo"
          width={80}
          height={80}
          className="rounded-xl shadow-lg mb-8"
        />

        <h1 className="text-8xl font-extrabold bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent mb-6">
          404
        </h1>

        <p className="text-white/70 text-lg mb-2 font-medium">
          Halaman yang kamu cari tidak ditemukan
        </p>
        <p className="text-white/50 text-lg mb-10 font-light">
          The page you&apos;re looking for doesn&apos;t exist
        </p>

        <div className="flex gap-4 flex-wrap justify-center">
          <Link href="/">
            <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-6 py-3 font-semibold rounded-xl transition-all duration-300">
              Kembali ke Beranda
            </Button>
          </Link>
          <Link href="mailto:luxtradee@gmail.com">
            <Button variant="outline" className="border-white/20 text-white/80 hover:bg-white/10 hover:text-white px-6 py-3 font-semibold rounded-xl transition-all duration-300">
              Hubungi Support
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  )
}