/**
 * Theme Management Utilities
 */

export type Theme = 'dark' | 'light'

/**
 * Get current theme from localStorage
 */
export function getCurrentTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  
  const stored = localStorage.getItem('luxtrade-theme')
  if (stored === 'light' || stored === 'dark') return stored
  
  // Check system preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  
  return 'dark' // Default to dark
}

/**
 * Set theme and apply to document
 */
export function setTheme(theme: Theme) {
  if (typeof window === 'undefined') return
  
  localStorage.setItem('luxtrade-theme', theme)
  
  const html = document.documentElement
  if (theme === 'dark') {
    html.classList.add('dark')
    html.classList.remove('light')
  } else {
    html.classList.add('light')
    html.classList.remove('dark')
  }

  // Dispatch a storage event so useSyncExternalStore subscribers re-render
  window.dispatchEvent(new StorageEvent('storage', { key: 'luxtrade-theme' }))
}

/**
 * Toggle between dark and light
 */
export function toggleTheme(): Theme {
  const current = getCurrentTheme()
  const next = current === 'dark' ? 'light' : 'dark'
  setTheme(next)
  return next
}

/**
 * Initialize theme on app load
 */
export function initTheme() {
  if (typeof window !== 'undefined') {
    const theme = getCurrentTheme()
    setTheme(theme)
  }
}
