'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Settings, Shield, Crown, Zap, AlertCircle, Menu, X,
  Gift, Send, Loader2, Users
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface SidebarFooterProps {
  sidebarOpen: boolean
  mobileSidebarOpen: boolean
  isPro: boolean
  isFreeUser: boolean
  tradeCount: number
  FREE_TRADE_LIMIT: number
  language: 'id' | 'en'
  user: any
  profile: any
  isAdmin: boolean
  userInitials: string
  setPlanSelectionModalOpen: (open: boolean) => void
  handleSignOut: () => void
  setSidebarOpen: (open: boolean) => void
  setMobileSidebarOpen: (open: boolean) => void
}

export default function SidebarFooter({
  sidebarOpen,
  mobileSidebarOpen,
  isPro,
  isFreeUser,
  tradeCount,
  FREE_TRADE_LIMIT,
  language,
  user,
  profile,
  isAdmin,
  userInitials,
  setPlanSelectionModalOpen,
  handleSignOut,
  setSidebarOpen,
  setMobileSidebarOpen
}: SidebarFooterProps) {
  const [promoDialogOpen, setPromoDialogOpen] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)

  return (
    <>
      <div className="relative p-3 pt-2 lg:pt-3 border-t border-purple-500/20 space-y-1.5 lg:space-y-2 pb-safe">
        {/* Promo Code Claim Button */}
        {!isPro && (sidebarOpen || mobileSidebarOpen) && (
          <motion.button
            onClick={() => { setPromoDialogOpen(true); setPromoCode('') }}
            className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-green-600/20 to-emerald-600/20 text-green-300 border border-green-500/30 hover:from-green-600/30 hover:to-emerald-600/30 transition-all flex items-center justify-center gap-2 text-xs font-semibold shadow-lg shadow-green-500/10 group"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            aria-label="Klaim kode promo"
          >
            <Gift className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{language === 'id' ? 'Klaim Kode Promo' : 'Claim Promo Code'}</span>
          </motion.button>
        )}

        {!isPro && (sidebarOpen || mobileSidebarOpen) && (
          <motion.button
            onClick={() => setPlanSelectionModalOpen(true)}
            className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-pink-600 text-xs font-bold text-white shadow-lg shadow-purple-500/30 relative overflow-hidden group"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
            <span className="relative z-10 flex items-center justify-center gap-2">
              <Zap className="w-3.5 h-3.5" />
              {language === 'id' ? 'Upgrade ke PRO' : 'Upgrade to PRO'}
            </span>
          </motion.button>
        )}

        {isPro && (sidebarOpen || mobileSidebarOpen) && (
          <motion.div
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-purple-500/20 via-violet-500/10 to-pink-500/20 border border-purple-500/30 shadow-lg shadow-purple-500/20"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            >
              <Zap className="w-4 h-4 text-purple-400" />
            </motion.div>
            <span className="text-xs font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent overflow-hidden whitespace-nowrap">
              ELITE PRO
            </span>
          </motion.div>
        )}

        <Link href="/affiliate" className="block relative">
          <motion.button
            className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-amber-500/10 text-purple-300 border border-purple-500/20 hover:from-purple-500/20 hover:to-amber-500/20 hover:border-purple-500/30 transition-all flex items-center justify-center gap-2 text-xs font-semibold relative overflow-hidden group"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
            />
            <Users className="w-3.5 h-3.5 relative z-10 group-hover:text-purple-400 transition-colors flex-shrink-0" />
            {(sidebarOpen || mobileSidebarOpen) && <span className="relative z-10 overflow-hidden whitespace-nowrap">{language === 'id' ? 'Program Referral' : 'Referral Program'}</span>}
          </motion.button>
        </Link>

        <Link href="/settings" className="block relative">
          <motion.button
            className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-white/5 to-white/10 text-gray-300 border border-white/10 hover:from-white/10 hover:to-white/15 hover:border-white/20 transition-all flex items-center justify-center gap-2 text-xs font-semibold relative overflow-hidden group"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
            />
            <Settings className="w-3.5 h-3.5 relative z-10 group-hover:text-purple-400 transition-colors flex-shrink-0" />
            {(sidebarOpen || mobileSidebarOpen) && <span className="relative z-10 overflow-hidden whitespace-nowrap">{language === 'id' ? 'Pengaturan' : 'Settings'}</span>}
          </motion.button>
        </Link>

        {(sidebarOpen || mobileSidebarOpen) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="relative bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl p-2.5 border border-white/10 overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-purple-500/5 to-pink-500/5 opacity-0 hover:opacity-100 transition-opacity" />
            <div className="relative flex items-center gap-3">
              <motion.div
                className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-lg shadow-purple-500/30"
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                {userInitials}
              </motion.div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold truncate text-white">
                    {profile?.full_name || user?.email || 'User'}
                  </span>
                  {isPro ? (
                    <Badge className="bg-gradient-to-r from-purple-500/40 to-pink-500/40 text-white border-purple-500/30 text-[10px] px-1.5 py-0 flex-shrink-0">
                      PRO
                    </Badge>
                  ) : (
                    <Badge className="bg-white/10 text-gray-400 border-white/10 text-[10px] px-1.5 py-0 flex-shrink-0">
                      Free
                    </Badge>
                  )}
                </div>
                <Link href="/settings" className="text-[11px] text-gray-500 hover:text-purple-400 transition-colors">
                  {language === 'id' ? 'Pengaturan' : 'Settings'}
                </Link>
              </div>
            </div>
          </motion.div>
        )}

        {isAdmin && (sidebarOpen || mobileSidebarOpen) && (
          <Link href="/dashboard/admin" className="block">
            <motion.button
              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600/20 to-violet-600/20 text-purple-300 border border-purple-500/30 hover:from-purple-600/30 hover:to-violet-600/30 transition-all flex items-center justify-center gap-2 text-sm font-bold shadow-lg shadow-purple-500/10"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Shield className="w-4 h-4" />
              <span className="flex items-center gap-1">
                {language === 'id' ? 'Panel Admin' : 'Admin Panel'}
                <Crown className="w-3 h-3 text-purple-400" />
              </span>
            </motion.button>
          </Link>
        )}

        {isAdmin && (sidebarOpen || mobileSidebarOpen) && (
          <Link href="/admin-email" className="block mt-2">
            <motion.button
              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-600/20 to-orange-600/20 text-amber-300 border border-amber-500/30 hover:from-amber-600/30 hover:to-orange-600/30 transition-all flex items-center justify-center gap-2 text-sm font-medium"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Send className="w-4 h-4" />
              <span>{language === 'id' ? 'Broadcast Email' : 'Email Broadcast'}</span>
            </motion.button>
          </Link>
        )}

        {isFreeUser && (sidebarOpen || mobileSidebarOpen) && (
          <motion.div
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="text-xs text-amber-300 overflow-hidden whitespace-nowrap">
              {tradeCount}/{FREE_TRADE_LIMIT} {language === 'id' ? 'trade digunakan' : 'trades used'}
            </span>
          </motion.div>
        )}

        {/* Discord Community Banner */}
        {(sidebarOpen || mobileSidebarOpen) && (
          <motion.a
            href="https://discord.gg/HDUNAsnW2R"
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="block rounded-xl bg-gradient-to-br from-[#5865F2]/20 to-[#5865F2]/5 border border-[#5865F2]/30 p-2 lg:p-3 hover:from-[#5865F2]/30 hover:to-[#5865F2]/10 hover:border-[#5865F2]/50 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2 mb-1 lg:mb-1.5">
              <svg className="w-4 h-4 lg:w-5 lg:h-5 text-[#5865F2] flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              <span className="text-[11px] lg:text-xs font-bold text-[#5865F2] group-hover:text-[#7B8CFF] transition-colors">
                Komunitas Discord
              </span>
            </div>
            <p className="text-[10px] lg:text-[11px] text-white/50 leading-relaxed">
              Beri masukan & dapatkan insentif. Gabung komunitas riset kami!
            </p>
          </motion.a>
        )}

        <motion.button
          onClick={() => {
            if (typeof window !== 'undefined' && window.innerWidth < 1024) {
              setMobileSidebarOpen(false)
            }
            setSidebarOpen(!sidebarOpen)
            // Add haptic feedback on mobile
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              navigator.vibrate(10)
            }
          }}
          aria-label={sidebarOpen ? (language === 'id' ? 'Tutup sidebar' : 'Collapse sidebar') : (language === 'id' ? 'Buka sidebar' : 'Expand sidebar')}
          className="relative w-full flex items-center justify-center py-2 text-gray-400 hover:text-white transition-colors rounded-xl hover:bg-white/5 active:bg-white/10 group"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <motion.div
            animate={{ rotate: sidebarOpen ? 180 : 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </motion.div>
        </motion.button>
      </div>

      {/* Promo Code Dialog */}
      <Dialog open={promoDialogOpen} onOpenChange={setPromoDialogOpen}>
        <DialogContent className="bg-[#0f0b18] border-purple-900/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2 text-green-400">
              <Gift className="w-5 h-5" />
              Klaim Kode Promo
            </DialogTitle>
            <DialogDescription className="text-gray-400 mt-2">
              Masukkan kode promo untuk mendapatkan akses PRO gratis.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              placeholder="Masukkan kode promo"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-purple-500/30 text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const btn = e.currentTarget.closest('[role="dialog"]')?.querySelector<HTMLButtonElement>('[data-promo-submit]')
                  btn?.click()
                }
              }}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setPromoDialogOpen(false)}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Batal
            </Button>
            <Button
              data-promo-submit
              onClick={async () => {
                if (!promoCode.trim()) return
                setPromoLoading(true)
                try {
                  const res = await fetch('/api/promo/apply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ promoCode: promoCode.trim(), plan: 'PRO' })
                  })
                  const data = await res.json()
                  if (data.success) {
                    toast.success(`🎉 ${data.message}`)
                    setPromoDialogOpen(false)
                    setTimeout(() => { window.location.reload() }, 1500)
                  } else {
                    toast.error(data.message || data.error || 'Kode promo tidak valid')
                  }
                } catch {
                  toast.error('Gagal mengklaim kode promo')
                } finally {
                  setPromoLoading(false)
                }
              }}
              disabled={promoLoading || !promoCode.trim()}
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              {promoLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Klaim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}