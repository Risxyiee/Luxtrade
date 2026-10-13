/**
 * Shared webhook alert checker.
 * Called by webhook handlers (trading, fxblue, myfxbook) after inserting a trade.
 *
 * Checks if the user has active PropFirm rules with webhook alerts enabled,
 * and sends notifications if drawdown is in danger zone.
 */

import { SupabaseClient } from '@supabase/supabase-js'

/**
 * After a trade is inserted via webhook, check PropFirm alerts for the user.
 * Only checks if the user has any rules with alert_webhook_enabled = true.
 * Sends push notifications for danger/breach alerts.
 *
 * This is fire-and-forget — errors are logged but don't fail the webhook.
 */
export async function checkWebhookAlerts(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<void> {
  try {
    // Check if user has any rules with webhook alerts enabled
    const { data: rulesWithWebhook } = await supabaseAdmin
      .from('prop_firm_rules')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('alert_webhook_enabled', true)
      .limit(1)

    if (!rulesWithWebhook || rulesWithWebhook.length === 0) {
      return // No rules with webhook alerts — skip
    }

    // Run the alert check (with push notifications)
    const { checkPropFirmAlerts } = await import('@/app/api/prop-firm/_lib/check-alerts')
    const result = await checkPropFirmAlerts(supabaseAdmin, userId, true)

    if (result.alerts.length > 0) {
      console.log(`[webhook-alerts] User ${userId}: ${result.alerts.length} alert(s) triggered —`,
        result.alerts.map(a => `${a.type}:${a.firmName}`).join(', '))
    }
  } catch (err) {
    console.warn('[webhook-alerts] Alert check failed (non-fatal):', err)
  }
}
