import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 0.1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  replaysOnErrorSampleRate: 1.0,

  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here, for example:
      maskAllText: false,
      blockAllMedia: true,
    }),
  ],

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
      }

      // Remove sensitive query parameters
      if (event.request.url) {
        event.request.url = event.request.url.replace(/token=[^&]+/g, 'token=[REDACTED]')
        event.request.url = event.request.url.replace(/api_key=[^&]+/g, 'api_key=[REDACTED]')
      }
    }

    // Mask user data
    if (event.user) {
      // Keep only essential user info, remove sensitive data
      event.user = {
        id: event.user.id,
        email: event.user.email?.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // Mask email
      }
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

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Release
  release: process.env.NEXT_PUBLIC_APP_VERSION || 'latest',

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
