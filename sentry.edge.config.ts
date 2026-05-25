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

    // Mask sensitive data
    if (event.request) {
      if (event.request.headers) {
        delete event.request.headers['authorization']
        delete event.request.headers['cookie']
      }
    }

    if (event.user) {
      event.user = {
        id: event.user.id,
        email: event.user.email?.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
      }
    }

    return event
  },
})
