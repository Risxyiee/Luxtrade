'use client'

import React, { useSyncExternalStore, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Moon, Sun } from 'lucide-react'
import { toggleTheme, getCurrentTheme, type Theme } from '@/lib/theme-utils'

function subscribeToTheme(callback: () => void) {
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

export function ThemeToggle() {
  const getSnapshot = useCallback((): Theme => getCurrentTheme(), [])
  const getServerSnapshot = useCallback((): Theme => 'dark', [])

  const theme = useSyncExternalStore(subscribeToTheme, getSnapshot, getServerSnapshot)

  const handleToggle = () => {
    toggleTheme()
  }

  return (
    <Button
      onClick={handleToggle}
      variant="ghost"
      size="icon"
      className="text-gray-400 hover:text-white hover:bg-white/5"
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </Button>
  )
}