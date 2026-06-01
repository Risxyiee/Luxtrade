import ExifReader from 'exifreader'
import { readFile } from 'fs/promises'

/**
 * Indonesia Timezone Definitions
 */
export const INDONESIA_TIMEZONES = {
  WIB: 'Asia/Jakarta',  // UTC+7
  WITA: 'Asia/Makassar', // UTC+8
  WIT: 'Asia/Jayapura'  // UTC+9
} as const

export type IndonesiaTimezone = keyof typeof INDONESIA_TIMEZONES

/**
 * EXIF Data Interface
 */
export interface PhotoMetadata {
  originalDateTime?: Date
  timezoneOffset?: number
  originalTimezone?: string
  indonesiaDateTime?: Date
  indonesiaTimezone?: IndonesiaTimezone
  gpsCoordinates?: {
    latitude: number
    longitude: number
  }
  location?: string
  originalDateStr?: string
}

/**
 * Read EXIF metadata from image file
 */
export async function readPhotoMetadata(filePath: string): Promise<PhotoMetadata> {
  try {
    console.log(`📷 [EXIF Reader] Reading metadata from: ${filePath}`)

    // Read file buffer
    const buffer = await readFile(filePath)

    // Parse EXIF data
    const tags = ExifReader.load(buffer)

    console.log('📋 [EXIF Reader] Available tags:', Object.keys(tags))

    const metadata: PhotoMetadata = {}

    // Try to get DateTimeOriginal (when photo was taken)
    const dateTimeOriginal = tags.DateTimeOriginal || tags.DateTime
    if (dateTimeOriginal && dateTimeOriginal.description) {
      try {
        const dateStr = dateTimeOriginal.description
        metadata.originalDateStr = dateStr

        // EXIF format: "YYYY:MM:DD HH:MM:SS"
        // Extract and parse
        const match = dateStr.match(/(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/)
        if (match) {
          const [, year, month, day, hour, minute, second] = match
          metadata.originalDateTime = new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            parseInt(hour),
            parseInt(minute),
            parseInt(second)
          )
          console.log(`✅ [EXIF Reader] Original datetime: ${metadata.originalDateTime.toISOString()}`)
        }
      } catch (error) {
        console.warn('⚠️ [EXIF Reader] Could not parse DateTimeOriginal:', error)
      }
    }

    // Try to get GPS coordinates
    if (tags.GPSLatitude && tags.GPSLongitude) {
      try {
        const lat = convertDMSToDD(tags.GPSLatitude)
        const lon = convertDMSToDD(tags.GPSLongitude)
        metadata.gpsCoordinates = { latitude: lat, longitude: lon }
        console.log(`📍 [EXIF Reader] GPS: ${lat}, ${lon}`)

        // Detect timezone from coordinates
        const detectedTimezone = detectTimezoneFromCoordinates(lat, lon)
        if (detectedTimezone) {
          metadata.timezoneOffset = detectedTimezone.offset
          metadata.originalTimezone = detectedTimezone.name
          metadata.indonesiaTimezone = detectedTimezone.indonesiaZone
          console.log(`🌍 [EXIF Reader] Detected timezone: ${detectedTimezone.name} (UTC${detectedTimezone.offset >= 0 ? '+' : ''}${detectedTimezone.offset})`)

          // Convert to Indonesia timezone
          if (metadata.originalDateTime) {
            const indoOffset = getTimezoneOffset(detectedTimezone.indonesiaZone)
            const originalOffset = detectedTimezone.offset

            // Calculate time difference
            const diffHours = indoOffset - originalOffset
            const indoDate = new Date(metadata.originalDateTime.getTime() + diffHours * 60 * 60 * 1000)
            metadata.indonesiaDateTime = indoDate
            console.log(`✅ [EXIF Reader] Indonesia time (${detectedTimezone.indonesiaZone}): ${indoDate.toISOString()}`)
          }
        }
      } catch (error) {
        console.warn('⚠️ [EXIF Reader] Could not parse GPS data:', error)
      }
    }

    // If no GPS, check if photo was taken in Indonesia
    if (!metadata.indonesiaDateTime && metadata.originalDateTime) {
      const isInIndonesia = checkIfInIndonesia(tags)
      if (isInIndonesia) {
        metadata.indonesiaDateTime = new Date(metadata.originalDateTime)
        metadata.indonesiaTimezone = 'WIB' // Default to WIB
        console.log('✅ [EXIF Reader] Photo taken in Indonesia (detected from metadata)')
      }
    }

    return metadata
  } catch (error) {
    console.error('❌ [EXIF Reader] Error reading metadata:', error)
    return {}
  }
}

/**
 * Convert DMS (Degrees Minutes Seconds) to Decimal Degrees
 */
function convertDMSToDD(gpsTag: any): number {
  try {
    if (!gpsTag || !gpsTag.value) return 0

    const degrees = gpsTag.value[0] || 0
    const minutes = gpsTag.value[1] || 0
    const seconds = gpsTag.value[2] || 0

    const dd = degrees + minutes / 60 + seconds / 3600
    return dd
  } catch (error) {
    console.warn('⚠️ [EXIF Reader] Could not convert DMS to DD:', error)
    return 0
  }
}

/**
 * Detect timezone from GPS coordinates
 */
interface TimezoneInfo {
  name: string
  offset: number
  indonesiaZone?: IndonesiaTimezone
}

function detectTimezoneFromCoordinates(lat: number, lon: number): TimezoneInfo | null {
  // Check if coordinates are in Indonesia
  if (isInIndonesiaBounds(lat, lon)) {
    // Determine which Indonesia timezone
    const indonesiaZone = getIndonesiaTimezone(lat, lon)
    const offset = getTimezoneOffset(indonesiaZone)

    return {
      name: INDONESIA_TIMEZONES[indonesiaZone],
      offset: offset,
      indonesiaZone: indonesiaZone
    }
  }

  // For other countries, detect approximate timezone
  const approximateOffset = Math.round(lon / 15)
  return {
    name: `UTC${approximateOffset >= 0 ? '+' : ''}${approximateOffset}`,
    offset: approximateOffset
  }
}

/**
 * Check if coordinates are within Indonesia bounds
 */
function isInIndonesiaBounds(lat: number, lon: number): boolean {
  // Indonesia bounds (approximate)
  const bounds = {
    minLat: -11.0,
    maxLat: 6.0,
    minLon: 95.0,
    maxLon: 141.0
  }

  return lat >= bounds.minLat && lat <= bounds.maxLat &&
         lon >= bounds.minLon && lon <= bounds.maxLon
}

/**
 * Get Indonesia timezone based on coordinates
 */
function getIndonesiaTimezone(lat: number, lon: number): IndonesiaTimezone {
  // Western Indonesia (Sumatra, Java, Kalimantan Barat)
  if (lon < 110.0) {
    return 'WIB' // UTC+7
  }

  // Central Indonesia (Kalimantan Tengah, Sulawesi, Bali, Nusa Tenggara)
  if (lon < 125.0) {
    return 'WITA' // UTC+8
  }

  // Eastern Indonesia (Maluku, Papua)
  return 'WIT' // UTC+9
}

/**
 * Get timezone offset in hours for Indonesia zones
 */
function getTimezoneOffset(zone: IndonesiaTimezone): number {
  switch (zone) {
    case 'WIB':
      return 7
    case 'WITA':
      return 8
    case 'WIT':
      return 9
    default:
      return 7
  }
}

/**
 * Check if photo was taken in Indonesia (from metadata, not GPS)
 */
function checkIfInIndonesia(tags: any): boolean {
  // Check GPSAreaInformation
  if (tags.GPSAreaInformation && tags.GPSAreaInformation.description) {
    const info = tags.GPSAreaInformation.description.toLowerCase()
    if (info.includes('indonesia') || info.includes('jakarta') || info.includes('bali')) {
      return true
    }
  }

  // Check other location-related tags
  const locationTags = [
    'Location', 'City', 'Province', 'Country',
    'GPSAreaInformation', 'GPSProcessingMethod'
  ]

  for (const tag of locationTags) {
    if (tags[tag] && tags[tag].description) {
      const desc = tags[tag].description.toLowerCase()
      if (desc.includes('indonesia') ||
          desc.includes('jakarta') ||
          desc.includes('bali') ||
          desc.includes('surabaya') ||
          desc.includes('medan') ||
          desc.includes('makassar')) {
        return true
      }
    }
  }

  return false
}

/**
 * Format date to Indonesian format
 */
export function formatDateIndo(date: Date, timezone: IndonesiaTimezone = 'WIB'): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: INDONESIA_TIMEZONES[timezone]
  }

  const formatter = new Intl.DateTimeFormat('id-ID', options)
  return formatter.format(date)
}

/**
 * Format time to Indonesian format (time only)
 */
export function formatTimeIndo(date: Date, timezone: IndonesiaTimezone = 'WIB'): string {
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: INDONESIA_TIMEZONES[timezone]
  }

  const formatter = new Intl.DateTimeFormat('id-ID', options)
  return formatter.format(date)
}