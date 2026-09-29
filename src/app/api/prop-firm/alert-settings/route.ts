import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/prop-firm/alert-settings?ruleId=xxx
 * Fetch alert thresholds for a specific prop firm rule.
 *
 * POST /api/prop-firm/alert-settings
 * Save alert thresholds for a prop firm rule.
 *
 * Body: { ruleId, alert_threshold_warning, alert_threshold_danger, alert_push_enabled, alert_webhook_enabled }
 *
 * Thresholds are stored directly on the prop_firm_rules row:
 *   - alert_threshold_warning (default 80): % of max DD that triggers WARNING
 *   - alert_threshold_danger (default 95): % of max DD that triggers DANGER
 *   - alert_push_enabled (default true): whether to send push for danger/breach
 *   - alert_webhook_enabled (default true): whether to check alerts on webhook trade insert
 */

export async function GET(request: NextRequest) {
  try {
    const result = await createClientForApi(request)
    const supabase = result.supabase

    if (!supabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ruleId = request.nextUrl.searchParams.get('ruleId')
    if (!ruleId) {
      return NextResponse.json({ error: 'ruleId query parameter is required' }, { status: 400 })
    }

    const { data: rule, error: ruleError } = await supabase
      .from('prop_firm_rules')
      .select('id, alert_threshold_warning, alert_threshold_danger, alert_push_enabled, alert_webhook_enabled')
      .eq('id', ruleId)
      .eq('user_id', user.id)
      .single()

    if (ruleError || !rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    return NextResponse.json({
      settings: {
        ruleId: rule.id,
        alertThresholdWarning: rule.alert_threshold_warning ?? 80,
        alertThresholdDanger: rule.alert_threshold_danger ?? 95,
        alertPushEnabled: rule.alert_push_enabled ?? true,
        alertWebhookEnabled: rule.alert_webhook_enabled ?? true,
      },
    })
  } catch (err) {
    console.error('[prop-firm/alert-settings GET] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch alert settings' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await createClientForApi(request)
    const supabase = result.supabase

    if (!supabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rawBody = await request.text()
    const body = JSON.parse(rawBody)

    if (!body.ruleId) {
      return NextResponse.json({ error: 'ruleId is required' }, { status: 400 })
    }

    // Verify ownership
    const { data: existing, error: findError } = await supabase
      .from('prop_firm_rules')
      .select('id, user_id')
      .eq('id', String(body.ruleId))
      .eq('user_id', user.id)
      .single()

    if (findError || !existing) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    // Build update
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (body.alert_threshold_warning !== undefined) {
      const val = Number(body.alert_threshold_warning)
      if (val < 0 || val > 100) {
        return NextResponse.json({ error: 'alert_threshold_warning must be 0-100' }, { status: 400 })
      }
      updateData.alert_threshold_warning = val
    }

    if (body.alert_threshold_danger !== undefined) {
      const val = Number(body.alert_threshold_danger)
      if (val < 0 || val > 100) {
        return NextResponse.json({ error: 'alert_threshold_danger must be 0-100' }, { status: 400 })
      }
      updateData.alert_threshold_danger = val
    }

    if (body.alert_push_enabled !== undefined) {
      updateData.alert_push_enabled = Boolean(body.alert_push_enabled)
    }

    if (body.alert_webhook_enabled !== undefined) {
      updateData.alert_webhook_enabled = Boolean(body.alert_webhook_enabled)
    }

    const { data: rule, error: updateError } = await supabase
      .from('prop_firm_rules')
      .update(updateData)
      .eq('id', String(body.ruleId))
      .select('id, alert_threshold_warning, alert_threshold_danger, alert_push_enabled, alert_webhook_enabled')
      .single()

    if (updateError) {
      console.error('[prop-firm/alert-settings POST] Update error:', updateError)
      return NextResponse.json({ error: 'Failed to update alert settings' }, { status: 500 })
    }

    return NextResponse.json({
      settings: {
        ruleId: rule.id,
        alertThresholdWarning: rule.alert_threshold_warning ?? 80,
        alertThresholdDanger: rule.alert_threshold_danger ?? 95,
        alertPushEnabled: rule.alert_push_enabled ?? true,
        alertWebhookEnabled: rule.alert_webhook_enabled ?? true,
      },
    })
  } catch (err) {
    console.error('[prop-firm/alert-settings POST] Error:', err)
    return NextResponse.json(
      { error: 'Failed to save alert settings' },
      { status: 500 }
    )
  }
}
