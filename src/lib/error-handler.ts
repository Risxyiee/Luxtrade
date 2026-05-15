// Global error handler for unhandled errors

export function setupGlobalErrorHandlers() {
  if (typeof window === 'undefined') return

  console.log('[Error Handler] Setting up global error handlers...')

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Unhandled Rejection]', event.reason)
    console.error('[Stack Trace]', event.reason?.stack || 'No stack trace available')

    // Log detailed error info
    if (event.reason) {
      console.error('[Rejection Details]', {
        type: typeof event.reason,
        message: event.reason.message,
        name: event.reason.name,
      })
    }
    // Prevent default to avoid console spam, but log the error
    // event.preventDefault()
  })

  // Handle global errors
  window.addEventListener('error', (event) => {
    console.error('[Global Error]', event.error)
    console.error('[Error Message]', event.message)
    console.error('[Source]', event.filename)
    console.error('[Line]', event.lineno)
    console.error('[Column]', event.colno)
    console.error('[Stack Trace]', event.error?.stack || 'No stack trace available')

    // Log detailed error info
    if (event.error) {
      console.error('[Error Details]', {
        type: typeof event.error,
        name: event.error.name,
        message: event.error.message,
      })
    }
  })
}

// Call this on app initialization
if (typeof window !== 'undefined') {
  setupGlobalErrorHandlers()
}
