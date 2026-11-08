/**
 * Jam pasar berdasar KALENDER — anti alert/notif saat pasar TUTUP.
 *
 * Insiden 8 Nov 2026 (Minggu, XAU tutup): sinyal VIP + notif Pine tetap
 * menembak dari data beku harga close Jumat:
 *   - vip-signals: gerbang "bar basi" hanya melindungi bila upstream
 *     menyediakan timestamp bar; kalau tidak (lastClosedAtSec = 0),
 *     evaluasi jalan atas data beku → EMA9×21 cross palsu berulang
 *     (BUY 10:00 WIB → SELL 10:30 WIB padahal pasar tutup).
 *   - pine-alerts (cron CF 15 menit + runner GHA 5 menit): evaluasi
 *     data beku → kondisi skrip "terpicu" palsu → push ke HP user.
 *
 * Jadwal XAU/USD (spot, mengikuti New York 17:00 close):
 *   BUKA   Minggu 18:00 ET  (WIB: Senin 06:00 saat EST / 07:00 saat EDT)
 *   TUTUP  Jumat 17:00 ET   (WIB: Sabtu 05:00 saat EST / 04:00 saat EDT)
 *   JEDA   Senin–Kamis 17:00–17:59 ET (1 jam rollover harian)
 * Dihitung dengan Intl timeZone "America/New_York" → otomatis ikut DST,
 * tidak peduli jam server (Workers = UTC).
 */

/** Jam dinding New York untuk satu saat: { wd: 'Sun'|'Mon'|..., hour: 0-23 } */
function newYorkParts(now: Date): { wd: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return { wd: get('weekday'), hour: Number(get('hour')) % 24 }
}

/** XAU/USD (dan logam OTC satu jadwal, mis. XAG) sedang buka? */
export function isXauMarketOpen(now: Date = new Date()): boolean {
  const { wd, hour } = newYorkParts(now)
  if (wd === 'Sat') return false        // Sabtu: tutup sejak Jumat 17:00 ET
  if (wd === 'Sun') return hour >= 18   // Minggu: baru buka 18:00 ET
  if (wd === 'Fri') return hour < 17    // Jumat: tutup tepat 17:00 ET
  return hour !== 17                    // Senin–Kamis: jeda 17:00–17:59 ET
}

/** Symbol yang mengikuti jadwal XAU (gold/silver OTC). Crypto (BTC dll.)
 *  24/7 → selalu buka, TIDAK boleh masuk gerbang ini. */
export function isXauLikeSymbol(symbol: string): boolean {
  return /XAU|GOLD|XAG|SILVER/i.test(String(symbol || ''))
}
