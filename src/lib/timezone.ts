/**
 * Timezone Utilities for MT5 Trading Data
 * Converts between EET (European Eastern Time) and WIB (UTC+7)
 */

/**
 * Detect if a time string is in EET (Eastern European Time)
 * EET is typically UTC+2 or UTC+3 (summer)
 */
export function isEETTime(isoDate: string): boolean {
  try {
    const date = new Date(isoDate)
    const hours = date.getUTCHours()

    // EET trading hours typically 07:00-19:00 UTC (09:00-21:00 EET)
    return hours >= 7 && hours <= 19
  } catch {
    return false
  }
}

/**
 * Detect if a time string is already in WIB (UTC+7)
 */
export function isWIBTime(isoDate: string): boolean {
  try {
    const date = new Date(isoDate)
    const hours = date.getUTCHours()

    // WIB trading hours typically 14:00-22:00 UTC (21:00-05:00 WIB next day)
    // But for simplicity, we check if the UTC time suggests WIB offset
    return hours >= 14 || hours < 5
  } catch {
    return false
  }
}

/**
 * Detect the timezone of the input time
 * Returns 'EET', 'WIB', or 'UNKNOWN'
 */
export function detectTimezone(isoDate: string): 'EET' | 'WIB' | 'UNKNOWN' {
  if (isEETTime(isoDate)) return 'EET'
  if (isWIBTime(isoDate)) return 'WIB'
  return 'UNKNOWN'
}

/**
 * Convert EET time to WIB
 * EET is UTC+2/UTC+3, WIB is UTC+7
 */
export function convertEETToWIB(isoDate: string): string {
  try {
    const date = new Date(isoDate)
    const hours = date.getUTCHours()

    // Detect if DST (summer time) - UTC+3
    // Winter time (standard) - UTC+2
    const isSummerTime = hours >= 8 && hours <= 20
    const eetOffset = isSummerTime ? 3 : 2

    // Convert to WIB (UTC+7)
    // WIB = EET + (7 - eetOffset)
    const wibOffsetHours = 7 - eetOffset
    const wibDate = new Date(date.getTime() + (wibOffsetHours * 60 * 60 * 1000))

    return wibDate.toISOString()
  } catch (error) {
    console.error('Error converting EET to WIB:', error)
    return isoDate
  }
}

/**
 * Convert any MT5 server time to WIB
 * Automatically detects timezone and converts if needed
 */
export function convertToWIB(isoDate: string): string {
  try {
    const timezone = detectTimezone(isoDate)

    // If already WIB, return as-is
    if (timezone === 'WIB') {
      return isoDate
    }

    // If EET, convert to WIB
    if (timezone === 'EET') {
      return convertEETToWIB(isoDate)
    }

    // Unknown timezone - try to infer from hour
    const date = new Date(isoDate)
    const hours = date.getUTCHours()

    // If hour suggests European trading, assume EET
    if (hours >= 7 && hours <= 19) {
      return convertEETToWIB(isoDate)
    }

    // Default: assume GMT+0, convert to WIB (+7 hours)
    const wibDate = new Date(date.getTime() + (7 * 60 * 60 * 1000))
    return wibDate.toISOString()
  } catch (error) {
    console.error('Error converting to WIB:', error)
    return isoDate
  }
}

/**
 * Format date to display in WIB
 */
export function formatWIBDate(isoDate: string): string {
  try {
    const date = new Date(isoDate)

    // Format: DD/MM/YYYY HH:mm WIB
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')

    return `${day}/${month}/${year} ${hours}:${minutes} WIB`
  } catch {
    return isoDate
  }
}

/**
 * Get timezone info for logging/debugging
 */
export function getTimezoneInfo(isoDate: string): {
  timezone: 'EET' | 'WIB' | 'UNKNOWN'
  isConverted: boolean
  original: string
  converted: string
} {
  const timezone = detectTimezone(isoDate)
  const isConverted = timezone !== 'WIB'

  return {
    timezone,
    isConverted,
    original: isoDate,
    converted: isConverted ? convertToWIB(isoDate) : isoDate
  }
}