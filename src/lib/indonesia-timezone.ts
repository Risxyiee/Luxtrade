/**
 * Province → GMT offset mapping for Indonesia.
 *
 * Indonesia has 3 time zones:
 *   WIB  (UTC+7) — Sumatera, Jawa, Kalimantan Barat/Kalimantan Tengah
 *   WITA (UTC+8) — Bali, Nusa Tenggara, Kalimantan Selatan/Timur, Sulawesi
 *   WIT  (UTC+9) — Maluku, Papua
 *
 * Source: https://en.wikipedia.org/wiki/Time_in_Indonesia
 *
 * The mapping uses lowercase canonical keys (strip diacritics, collapse spaces).
 * Callers pass any of: province name (e.g. "Jawa Barat"), normalized key,
 * or timezone label ("WIB"/"WITA"/"WIT") — all resolve to the integer offset.
 */

export type IndonesiaTimezone = 'WIB' | 'WITA' | 'WIT'

/** Province name → timezone label. Keys are normalized (lowercase, no spaces/diacritics). */
const PROVINCE_TO_TZ: Record<string, IndonesiaTimezone> = {
  // ── WIB (UTC+7) — Sumatera ────────────────────────────────────────────────
  aceh: 'WIB',
  sumaterautara: 'WIB',
  sumaterabarat: 'WIB',
  riau: 'WIB',
  kepulauanriau: 'WIB',
  jambi: 'WIB',
  sumateraselatan: 'WIB',
  bangkabelitung: 'WIB',
  bengkulu: 'WIB',
  lampung: 'WIB',

  // ── WIB (UTC+7) — Jawa ────────────────────────────────────────────────────
  jakarta: 'WIB',
  jabodetabek: 'WIB',
  dkijakarta: 'WIB',
  jawabarat: 'WIB',
  jateng: 'WIB',
  jawatengah: 'WIB',
  diy: 'WIB',
  yogyakarta: 'WIB',
  daerahistimewayogyakarta: 'WIB',
  jatim: 'WIB',
  jawatimur: 'WIB',
  banten: 'WIB',

  // ── WIB (UTC+7) — Kalimantan Barat & Tengah ──────────────────────────────
  kalimantanbarat: 'WIB',
  kalimantantengah: 'WIB',

  // ── WITA (UTC+8) — Kalimantan Selatan/Timur/Utara ────────────────────────
  kalimantanselatan: 'WITA',
  kalimantantimur: 'WITA',
  kalimantanutara: 'WITA',

  // ── WITA (UTC+8) — Bali & Nusa Tenggara ──────────────────────────────────
  bali: 'WITA',
  nusatenggarabarat: 'WITA',
  ntb: 'WITA',
  nusatenggaratimur: 'WITA',
  ntt: 'WITA',

  // ── WITA (UTC+8) — Sulawesi ──────────────────────────────────────────────
  sulawesiutara: 'WITA',
  gorontalo: 'WITA',
  sulawesitengah: 'WITA',
  sulawesibarat: 'WITA',
  sulawesiselatan: 'WITA',
  sulawesitenggara: 'WITA',

  // ── WIT (UTC+9) — Maluku & Papua ─────────────────────────────────────────
  maluku: 'WIT',
  malukuutara: 'WIT',
  papuabarat: 'WIT',
  papuabaratdaya: 'WIT',
  papua: 'WIT',
  papuaselatan: 'WIT',
  papuatengah: 'WIT',
  papuapegunungan: 'WIT',
}

/** Timezone label → integer GMT offset (in hours). */
const TZ_TO_OFFSET: Record<IndonesiaTimezone, number> = {
  WIB: 7,
  WITA: 8,
  WIT: 9,
}

/** All province labels for UI dropdown (display name + canonical key). */
export const PROVINCE_LIST: { label: string; tz: IndonesiaTimezone }[] = [
  // WIB
  { label: 'Aceh', tz: 'WIB' },
  { label: 'Sumatera Utara', tz: 'WIB' },
  { label: 'Sumatera Barat', tz: 'WIB' },
  { label: 'Riau', tz: 'WIB' },
  { label: 'Kepulauan Riau', tz: 'WIB' },
  { label: 'Jambi', tz: 'WIB' },
  { label: 'Sumatera Selatan', tz: 'WIB' },
  { label: 'Bangka Belitung', tz: 'WIB' },
  { label: 'Bengkulu', tz: 'WIB' },
  { label: 'Lampung', tz: 'WIB' },
  { label: 'DKI Jakarta', tz: 'WIB' },
  { label: 'Jawa Barat', tz: 'WIB' },
  { label: 'Jawa Tengah', tz: 'WIB' },
  { label: 'DI Yogyakarta', tz: 'WIB' },
  { label: 'Jawa Timur', tz: 'WIB' },
  { label: 'Banten', tz: 'WIB' },
  { label: 'Kalimantan Barat', tz: 'WIB' },
  { label: 'Kalimantan Tengah', tz: 'WIB' },
  // WITA
  { label: 'Kalimantan Selatan', tz: 'WITA' },
  { label: 'Kalimantan Timur', tz: 'WITA' },
  { label: 'Kalimantan Utara', tz: 'WITA' },
  { label: 'Bali', tz: 'WITA' },
  { label: 'Nusa Tenggara Barat', tz: 'WITA' },
  { label: 'Nusa Tenggara Timur', tz: 'WITA' },
  { label: 'Sulawesi Utara', tz: 'WITA' },
  { label: 'Gorontalo', tz: 'WITA' },
  { label: 'Sulawesi Tengah', tz: 'WITA' },
  { label: 'Sulawesi Barat', tz: 'WITA' },
  { label: 'Sulawesi Selatan', tz: 'WITA' },
  { label: 'Sulawesi Tenggara', tz: 'WITA' },
  // WIT
  { label: 'Maluku', tz: 'WIT' },
  { label: 'Maluku Utara', tz: 'WIT' },
  { label: 'Papua Barat', tz: 'WIT' },
  { label: 'Papua Barat Daya', tz: 'WIT' },
  { label: 'Papua', tz: 'WIT' },
  { label: 'Papua Selatan', tz: 'WIT' },
  { label: 'Papua Tengah', tz: 'WIT' },
  { label: 'Papua Pegunungan', tz: 'WIT' },
]

/**
 * Normalize a province string into canonical key.
 * Lowercase, strip diacritics, remove spaces/dashes/dots.
 * "DI Yogyakarta" → "diyogyakarta", "Jawa Barat" → "jawabarat"
 */
export function normalizeProvince(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[\s\-_.]/g, '')
    .trim()
}

/**
 * Resolve province string → timezone label.
 * Accepts: province name ("Jawa Barat"), label ("WIB"), or canonical key.
 * Returns null if input is empty or unrecognized.
 */
export function provinceToTimezone(province: string | null | undefined): IndonesiaTimezone | null {
  if (!province || !province.trim()) return null
  const key = normalizeProvince(province)

  // Direct timezone label match
  if (key === 'wib') return 'WIB'
  if (key === 'wita') return 'WITA'
  if (key === 'wit') return 'WIT'

  // Province name match
  return PROVINCE_TO_TZ[key] ?? null
}

/**
 * Resolve province → integer GMT offset (in hours).
 * Returns 0 (UTC) if province is unknown or unset (safe default).
 */
export function provinceToGmtOffset(province: string | null | undefined): number {
  const tz = provinceToTimezone(province)
  if (!tz) return 0
  return TZ_TO_OFFSET[tz]
}

/**
 * Human-readable timezone description for a province.
 * Example: "Jawa Barat" → "WIB (UTC+7)"
 */
export function provinceTimezoneLabel(province: string | null | undefined): string {
  const tz = provinceToTimezone(province)
  if (!tz) return 'WIB (UTC+7) — default'
  return `${tz} (UTC+${TZ_TO_OFFSET[tz]})`
}
