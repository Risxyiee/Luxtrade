/**
 * Keyboard Shortcuts Handler
 */

export type ShortcutAction = 'save' | 'print' | 'search' | 'new-entry' | 'export' | 'escape'

interface ShortcutConfig {
  key: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  action: ShortcutAction
}

const SHORTCUTS: ShortcutConfig[] = [
  { key: 's', ctrl: true, action: 'save' },
  { key: 'p', ctrl: true, action: 'print' },
  { key: 'f', ctrl: true, action: 'search' },
  { key: 'n', ctrl: true, action: 'new-entry' },
  { key: 'e', ctrl: true, shift: true, action: 'export' },
  { key: 'Escape', action: 'escape' }
]

/**
 * Register keyboard shortcut listener
 */
export function registerKeyboardShortcuts(onAction: (action: ShortcutAction) => void) {
  const handleKeyDown = (event: KeyboardEvent) => {
    for (const shortcut of SHORTCUTS) {
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
      const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey
      const altMatch = shortcut.alt ? event.altKey : !event.altKey
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey

      if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
        event.preventDefault()
        onAction(shortcut.action)
        break
      }
    }
  }

  window.addEventListener('keydown', handleKeyDown)

  return () => {
    window.removeEventListener('keydown', handleKeyDown)
  }
}

/**
 * Get all shortcuts as readable list
 */
export function getShortcutsList(): Array<{ combo: string; action: string }> {
  return SHORTCUTS.map(s => {
    const parts: string[] = []
    if (s.ctrl) parts.push('Ctrl')
    if (s.alt) parts.push('Alt')
    if (s.shift) parts.push('Shift')
    parts.push(s.key.toUpperCase())
    
    return {
      combo: parts.join(' + '),
      action: formatActionName(s.action)
    }
  })
}

function formatActionName(action: ShortcutAction): string {
  const names: Record<ShortcutAction, string> = {
    save: 'Save',
    print: 'Print',
    search: 'Search',
    'new-entry': 'New Entry',
    export: 'Export',
    escape: 'Close/Escape'
  }
  return names[action]
}
