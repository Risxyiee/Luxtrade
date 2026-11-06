'use client'

// Tombol "Perbarui Aplikasi" (PWA) — dipindah dari Header ke Sidebar
// (laporan Bos: di header ada DUA ikon panah melingkar berdempet —
// RefreshCw "muat ulang data" & RotateCw "perbarui aplikasi" — kelihatan
// seperti tombol refresh dobel). Fitur PWA tetap ada, lokasi rapi:
// bersihkan cache + update service worker + reload halaman.

import { useState } from 'react'
import { RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import { useLanguage } from '@/contexts/LanguageContext'

export default function AppUpdateButton() {
  const [updating, setUpdating] = useState(false)
  const { language } = useLanguage()
  const id = language === 'id'

  const handleAppUpdate = async () => {
    if (updating) return
    setUpdating(true)
    toast.loading(id ? 'Memperbarui aplikasi…' : 'Updating app…', { id: 'app-update', duration: 5000 })
    try {
      if (typeof caches !== 'undefined') {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k)))
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map(r => r.update().catch(() => {})))
        // beri jeda singkat biar SW baru sempat take-over sebelum reload
        await new Promise(r => setTimeout(r, 500))
      }
    } catch {
      // best effort — reload tetap jalan
    }
    window.location.reload()
  }

  return (
    <button
      onClick={handleAppUpdate}
      disabled={updating}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-150 group
        text-lux-text-secondary dark:text-gray-400 hover:text-emerald-400 dark:hover:text-emerald-300 hover:bg-lux-surface-hover dark:hover:bg-white/5
        disabled:opacity-50"
      aria-label={id ? 'Perbarui aplikasi' : 'Update app'}
      title={id ? 'Perbarui aplikasi ke versi terbaru' : 'Update app to latest version'}
    >
      <RotateCw className={`w-5 h-5 flex-shrink-0 ${updating ? 'animate-spin' : ''} group-hover:text-emerald-400 transition-colors`} />
      <span className="text-sm font-medium flex-1 text-left truncate">
        {id ? 'Perbarui Aplikasi' : 'Update App'}
      </span>
    </button>
  )
}
