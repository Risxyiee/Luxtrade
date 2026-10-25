/**
 * Discord webhook notifications — replaces Telegram (bot token was revoked → "Unauthorized").
 *
 * Why Discord webhook instead of Telegram bot:
 *  - Only ONE secret needed: DISCORD_WEBHOOK_URL (no bot token, no chat ID)
 *  - No auth handshake, no getUpdates — just a POST with JSON
 *  - Works natively on Cloudflare Workers (plain fetch)
 *
 * Setup (admin):
 *  1. Discord server → Channel settings → Integrations → Webhooks → New Webhook
 *  2. Copy Webhook URL
 *  3. Cloudflare dashboard → Workers & Pages → luxtradee → Settings →
 *     Variables & Secrets → add DISCORD_WEBHOOK_URL (Production + Preview)
 *
 * All failures are non-critical: console.warn only, never thrown.
 */

function getDiscordWebhookUrl(): string | null {
  // 1. process.env (local dev + OpenNext populated env)
  if (process.env.DISCORD_WEBHOOK_URL) return process.env.DISCORD_WEBHOOK_URL

  // 2. CF Workers env (secrets via wrangler secret put / dashboard)
  try {
    const sym = Symbol.for('__cloudflare-context__')
    const ctx = (globalThis as Record<symbol, unknown>)[sym] as { env?: Record<string, string> } | undefined
    if (ctx?.env?.DISCORD_WEBHOOK_URL) return ctx.env.DISCORD_WEBHOOK_URL
  } catch {}

  return null
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
  const webhookUrl = getDiscordWebhookUrl()
  if (!webhookUrl) {
    console.warn(
      '[Discord] DISCORD_WEBHOOK_URL not set — notification skipped. ' +
      'Add it: Cloudflare → Workers & Pages → luxtradee → Settings → Variables & Secrets.'
    )
    return { ok: false, error: 'DISCORD_WEBHOOK_URL not configured' }
  }

  try {
    // Discord hard limit: 2000 chars for content
    const content = htmlToDiscordMarkdown(message).slice(0, 2000)
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'LuxTradee Bot',
        content,
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      // 429 rate-limit / 404 deleted webhook / 401 invalid — all non-critical
      console.warn('[Discord] Notification skipped:', res.status, errText.slice(0, 120))
      return { ok: false, error: `HTTP ${res.status}` }
    }

    return { ok: true }
  } catch (error) {
    console.warn('[Discord] Notification error:', error)
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
