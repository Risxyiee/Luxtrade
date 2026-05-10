// Global error handler for unhandled errors

export function setupGlobalErrorHandlers() {
  if (typeof window === 'undefined') return

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason)
    // Prevent default to avoid console spam, but log the error
    // event.preventDefault()
  })

  // Handle global errors
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error)
  })
}

// Call this on app initialization
if (typeof window !== 'undefined') {
  setupGlobalErrorHandlers()
}
