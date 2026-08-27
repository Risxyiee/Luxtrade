/**
 * Structured logging untuk production
 * Menghindari leakage error details ke client
 */

export interface LogContext {
  userId?: string
  requestId?: string
  endpoint?: string
  method?: string
  timestamp?: string
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

interface LogEntry {
  level: LogLevel
  message: string
  context?: LogContext
  data?: Record<string, any>
  error?: {
    name: string
    message: string
    stack?: string
  }
  ms?: number // execution time
}

function formatError(err: any) {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    }
  }
  return {
    name: 'Unknown',
    message: String(err),
  }
}

function formatLogEntry(entry: LogEntry): string {
  const timestamp = entry.context?.timestamp || new Date().toISOString()
  const level = entry.level.toUpperCase().padEnd(5)
  const prefix = `[${timestamp}] ${level}`

  let message = `${prefix} ${entry.message}`
  if (entry.context?.userId) message += ` | user:${entry.context.userId}`
  if (entry.context?.endpoint) message += ` | ${entry.context.method} ${entry.context.endpoint}`
  if (entry.ms) message += ` | ${entry.ms}ms`

  if (entry.error) {
    message += `\n  Error: ${entry.error.name}: ${entry.error.message}`
    if (entry.error.stack) message += `\n  Stack: ${entry.error.stack}`
  }

  if (entry.data) {
    message += `\n  Data: ${JSON.stringify(entry.data, null, 2)}`
  }

  return message
}

class Logger {
  private context: LogContext = {}

  setContext(context: Partial<LogContext>) {
    this.context = { ...this.context, ...context }
  }

  private log(entry: LogEntry) {
    entry.context = { ...this.context, ...entry.context }
    const formatted = formatLogEntry(entry)

    // Send to console based on level
    switch (entry.level) {
      case 'debug':
        if (process.env.NODE_ENV === 'development') {
          console.log(formatted)
        }
        break
      case 'info':
        console.log(formatted)
        break
      case 'warn':
        console.warn(formatted)
        break
      case 'error':
      case 'fatal':
        console.error(formatted)
        break
    }

    // TODO: Send to external logging service (e.g., Sentry, Datadog, LogRocket)
    // if (process.env.NODE_ENV === 'production') {
    //   await sendToExternalLogger(entry)
    // }
  }

  debug(message: string, data?: Record<string, any>) {
    this.log({ level: 'debug', message, data })
  }

  info(message: string, data?: Record<string, any>) {
    this.log({ level: 'info', message, data })
  }

  warn(message: string, data?: Record<string, any>) {
    this.log({ level: 'warn', message, data })
  }

  error(message: string, error?: any, data?: Record<string, any>) {
    this.log({
      level: 'error',
      message,
      error: error ? formatError(error) : undefined,
      data,
    })
  }

  fatal(message: string, error?: any, data?: Record<string, any>) {
    this.log({
      level: 'fatal',
      message,
      error: error ? formatError(error) : undefined,
      data,
    })
  }

  /**
   * Time execution of async function
   */
  async timed<T>(
    name: string,
    fn: () => Promise<T>,
    onError?: (err: any) => void
  ): Promise<T | null> {
    const start = performance.now()
    try {
      const result = await fn()
      const ms = Math.round(performance.now() - start)
      this.log({ level: 'debug', message: `✓ ${name}`, ms })
      return result
    } catch (error) {
      const ms = Math.round(performance.now() - start)
      this.error(`✗ ${name}`, error, { ms: String(ms) })
      if (onError) onError(error)
      return null
    }
  }
}

export const logger = new Logger()
