'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Moon, Sun } from 'lucide-react'
import { setTheme, getCurrentTheme, type Theme } from '@/lib/theme-utils'

function getInitialTheme(): Theme {
  if (typeof window !== 'undefined') {
    return getCurrentTheme()
  }
  return 'dark'
}

export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  // Listen for theme changes (cross-tab sync)
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'luxtrade-theme') {
        const next = e.newValue === 'light' ? 'light' : 'dark'
        setThemeState(next)
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const handleToggle = useCallback(() => {
    const current = getCurrentTheme()
    const next: Theme = current === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setThemeState(next)
  }, [])

  return (
    <Button
      onClick={handleToggle}
      variant="ghost"
      size="icon"
      className="text-lux-text-secondary hover:text-lux-text-primary hover:bg-lux-border"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </Button>
  )
}