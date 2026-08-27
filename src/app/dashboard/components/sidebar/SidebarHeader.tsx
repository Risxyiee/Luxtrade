'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'

interface SidebarHeaderProps {
  sidebarOpen: boolean
  mobileSidebarOpen: boolean
}

export default function SidebarHeader({
  sidebarOpen,
  mobileSidebarOpen
}: SidebarHeaderProps) {
  return (
    <div className="relative p-4 pb-3 border-b border-lux-border dark:border-blue-500/20 shrink-0">
      <Link href="/" className="flex items-center gap-3 group">
        <motion.div
          className="relative flex-shrink-0"
          whileHover={{ scale: 1.1, rotate: 5 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <div className="absolute inset-[-6px] bg-gradient-to-br from-blue-500/60 via-cyan-400/40 to-blue-600/60 rounded-2xl blur-xl opacity-50 group-hover:opacity-80 transition-opacity duration-300" />
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />
          <Image
            src="/logo.png"
            alt="LuxTrade Logo"
            width={40}
            height={40}
            className="relative object-contain"
          />
        </motion.div>
        {(sidebarOpen || mobileSidebarOpen) && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-200 via-blue-400 to-cyan-300 bg-clip-text text-transparent">
              LuxTrade
            </h1>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-blue-500/50 dark:text-blue-400/40">Trading Journal</p>
          </motion.div>
        )}
      </Link>
    </div>
  )
}
