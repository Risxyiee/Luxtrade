/**
 * Discord notifications — mendukung DUA mode (auto-terdeteksi dari isi env):
 *
 *  MODE A — BOT (dipakai Bos): env `DISCORD_BOT` (atau `DISCORD_BOT_TOKEN`)
 *    berisi bot token (Bukan URL). Pesan dikirim via Discord API:
 *      POST https://discord.com/api/v10/channels/{CHANNEL_ID}/messages
 *    Butuh 1 env tambahan: `DISCORD_CHANNEL_ID` (ID channel tujuan —
 *    aktifkan Developer Mode di Discord → klik kanan channel → Copy ID).
 *
 *  MODE B — WEBHOOK (legacy): env `DISCORD_WEBHOOK_URL` berisi URL webhook
 *    (https://discord.com/api/webhooks/...) → POST langsung, tanpa channel ID.
 *
 * Urutan pembacaan env: DISCORD_BOT → DISCORD_BOT_TOKEN → DISCORD_WEBHOOK_URL
 * (process.env dulu, lalu CF Workers context env).
 *
 * All failures are non-critical: console.warn only, never thrown.
 */

interface DiscordTarget {
  kind: 'bot' | 'webhook'
  tokenOrUrl: string
  channelId: string
}

function cfEnv(): Record<string, string> {
  try {
    const sym = Symbol.for('__cloudflare-context__')
    const ctx = (globalThis as Record<symbol, unknown>)[sym] as { env?: Record<string, string> } | undefined
    return ctx?.env || {}
  } catch {
    return {}
  }
}

function readEnv(...names: string[]): string {
  const cf = cfEnv()
  for (const n of names) {
    if (process.env[n]) return String(process.env[n]).trim()
    if (cf[n]) return String(cf[n]).trim()
  }
  return ''
}

/** Resolve target Discord: bot token (butuh channel id) atau webhook URL. */
function getDiscordTarget(): DiscordTarget | null {
  const val = readEnv('DISCORD_BOT', 'DISCORD_BOT_TOKEN', 'DISCORD_WEBHOOK_URL')
  if (!val) return null

  if (/^https:\/\/(discord\.com|discordapp\.com|ptb\.discord\.com|canary\.discord\.com)\/api\/webhooks\//i.test(val)) {
    return { kind: 'webhook', tokenOrUrl: val, channelId: '' }
  }
  // Bukan URL → anggap bot token (format khas: panjang + mengandung titik)
  const channelId = readEnv('DISCORD_CHANNEL_ID')
  return { kind: 'bot', tokenOrUrl: val, channelId }
}

/**
 * Convert Telegram-style HTML markup → Discord markdown.
 * Existing notification helpers build messages with <b>/<i>/<code> tags.
 */
export function htmlToDiscordMarkdown(text: string): string {
  return text
    .replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<i>([\s\S]*?)<\/i>/gi, '_$1_')
    .replace(/<em>([\s\S]*?)<\/em>/gi, '_$1_')
    .replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<pre>([\s\S]*?)<\/pre>/gi, '```\n$1\n```')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '') // strip any other tags
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Send a notification to the admin Discord channel. Never throws. */
export async function sendDiscordNotification(message: string): Promise<{ ok: boolean; error?: string }> {
  const target = getDiscordTarget()
  if (!target) {
    console.warn(
      '[Discord] DISCORD_BOT (token bot) atau DISCORD_WEBHOOK_URL belum diset — notification skipped. ' +
      'Add it: Cloudflare → Workers & Pages → luxtradee → Settings → Variables & Secrets.'
    )
    return { ok: false, error: 'DISCORD_BOT belum diset' }
  }

  // Discord hard limit: 2000 chars for content
  const content = htmlToDiscordMarkdown(message).slice(0, 2000)

  try {
    let res: Response

    if (target.kind === 'webhook') {
      // MODE B — webhook: satu POST, selesai
      res = await fetch(target.tokenOrUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'LuxTradee Bot', content }),
        signal: AbortSignal.timeout(15_000),
      })
    } else {
      // MODE A — bot token: POST ke channel tujuan
      if (!target.channelId) {
        console.warn('[Discord] Token bot terbaca tapi DISCORD_CHANNEL_ID belum diset — skipped. ' +
          'Aktifkan Developer Mode → klik kanan channel → Copy Channel ID.')
        return { ok: false, error: 'DISCORD_CHANNEL_ID belum diset (token bot butuh channel tujuan)' }
      }
      res = await fetch(`https://discord.com/api/v10/channels/${encodeURIComponent(target.channelId)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bot ${target.tokenOrUrl}` },
        body: JSON.stringify({ content }),
        signal: AbortSignal.timeout(15_000),
      })
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      // 429 rate-limit / 404 invalid target / 401 invalid token — all non-critical
      console.warn('[Discord] Notification skipped:', res.status, errText.slice(0, 120))
      return { ok: false, error: `HTTP ${res.status}` }
    }

    return { ok: true }
  } catch (error) {
    console.warn('[Discord] Notification error:', error)
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
