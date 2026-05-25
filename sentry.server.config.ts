import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 0.1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Release
  release: process.env.NEXT_PUBLIC_APP_VERSION || 'latest',

  // Filter out sensitive data
  beforeSend(event, hint) {
    // Don't send events from localhost in development
    if (process.env.NODE_ENV === 'development') {
      return null
    }

    // Mask sensitive data in the event
    if (event.request) {
      // Remove sensitive headers
      if (event.request.headers) {
        delete event.request.headers['authorization']
        delete event.request.headers['cookie']
        delete event.request.headers['x-api-key']
      }

      // Remove sensitive query parameters
      if (event.request.url) {
        event.request.url = event.request.url.replace(/token=[^&]+/g, 'token=[REDACTED]')
        event.request.url = event.request.url.replace(/api_key=[^&]+/g, 'api_key=[REDACTED]')
        event.request.url = event.request.url.replace(/password=[^&]+/g, 'password=[REDACTED]')
      }
    }

    // Mask user data
    if (event.user) {
      event.user = {
        id: event.user.id,
        email: event.user.email?.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
      }
    }

    // Mask sensitive data in breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
        if (breadcrumb.data) {
          // Remove sensitive data from breadcrumb data
          const { password, token, apiKey, ...safeData } = breadcrumb.data
          breadcrumb.data = safeData
        }
        return breadcrumb
      })
    }

    // Filter out specific error types
    if (event.exception) {
      const errorMessage = event.exception.values?.[0]?.value
      // Don't report expected errors
      if (errorMessage?.includes('PGRST116') || errorMessage?.includes('42501')) {
        return null
      }
    }

    return event
  },

  // Ignore specific errors
  ignoreErrors: [
    // Random plugins/extensions
    'top.GLOBALS',
    // Facebook flakiness
    'fb_xd_fragment',
    // Chrome extensions
    /chrome-extension:\/\//i,
    // Firefox extensions
    /moz-extension:\/\//i,
    // Network errors that are user's fault
    'Network request failed',
    'Failed to fetch',
    // Database connection errors (usually temporary)
    /Connection.*timeout/i,
  ],

  // Deny URLs
  denyUrls: [
    // Facebook flakiness
    /graph\.facebook\.com/i,
    // Facebook blocked
    /connect\.facebook\.net\/en_US\/all\.js/i,
    // Chrome extensions
    /chrome-extension:\/\//i,
    // Firefox extensions
    /moz-extension:\/\//i,
  ],
})
