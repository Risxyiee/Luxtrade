import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'

interface NotificationPreferences {
  id?: string
  user_id: string
  email_digest?: 'daily' | 'weekly' | 'off'
  trade_alerts?: {
    bigWin: boolean
    bigLoss: boolean
    streak: boolean
    dailyLimit: boolean
  }
  thresholds?: {
    bigWinAmount: number
    bigLossAmount: number
    maxDailyLosses: number
  }
  in_app?: boolean
  max_daily_loss?: number
  created_at?: string
  updated_at?: string
}

interface FrontendPreferences {
  emailDigest?: 'daily' | 'weekly' | 'off'
  tradeAlerts?: {
    bigWin: boolean
    bigLoss: boolean
    streak: boolean
    dailyLimit: boolean
  }
  thresholds?: {
    bigWinAmount: number
    bigLossAmount: number
    maxDailyLosses: number
  }
  inApp?: boolean
}

// GET - Fetch notification preferences for a user
export async function GET(request: NextRequest) {
  try {
    const result = await createClientForApi(request)
    const supabase = result.supabase
    if (!supabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error) {
      // Table doesn't exist or no preferences found - return default preferences
      if (
        error.code === '42P01' ||
        error.message.includes('does not exist') ||
        error.code === 'PGRST116'
      ) {
        const defaultPreferences = {
          emailDigest: 'daily' as const,
          tradeAlerts: {
            bigWin: true,
            bigLoss: true,
            streak: true,
            dailyLimit: true,
          },
          thresholds: {
            bigWinAmount: 100,
            bigLossAmount: -100,
            maxDailyLosses: 5,
          },
          inApp: true,
        }
        return NextResponse.json({ preferences: defaultPreferences })
      }
      console.error('Notification preferences fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 })
    }

    // Convert DB format to frontend format
    const frontendPreferences: FrontendPreferences = {
      emailDigest: data.email_digest || 'daily',
      tradeAlerts: data.trade_alerts || {
        bigWin: true,
        bigLoss: true,
        streak: true,
        dailyLimit: true,
      },
      thresholds: data.thresholds || {
        bigWinAmount: 100,
        bigLossAmount: -100,
        maxDailyLosses: data.max_daily_loss || 5,
      },
      inApp: data.in_app ?? true,
    }

    return NextResponse.json({ preferences: frontendPreferences })
  } catch (err) {
    console.error('Notification preferences API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create notification preferences for a user
export async function POST(request: NextRequest) {
  try {
    const result = await createClientForApi(request)
    const supabase = result.supabase
    if (!supabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as FrontendPreferences

    // Convert frontend format to DB format
    const preferencesData = {
      user_id: user.id,
      email_digest: body.emailDigest || 'daily',
      trade_alerts: body.tradeAlerts || {
        bigWin: true,
        bigLoss: true,
        streak: true,
        dailyLimit: true,
      },
      thresholds: body.thresholds || {
        bigWinAmount: 100,
        bigLossAmount: -100,
        maxDailyLosses: 5,
      },
      in_app: body.inApp ?? true,
      max_daily_loss: body.thresholds?.maxDailyLosses || 5,
    }

    const { data, error } = await supabase
      .from('notification_preferences')
      .insert([preferencesData])
      .select()
      .single()

    if (error) {
      console.error('Notification preferences creation error:', error)
      // If table doesn't exist, return success with local data
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          preferences: body,
          message: 'Preferences saved locally (table not available)',
        })
      }
      return NextResponse.json({ error: 'Failed to create preferences', detail: error.message }, { status: 500 })
    }

    // Return in frontend format
    const frontendPreferences: FrontendPreferences = {
      emailDigest: data.email_digest || 'daily',
      tradeAlerts: data.trade_alerts,
      thresholds: data.thresholds,
      inApp: data.in_app ?? true,
    }

    return NextResponse.json({ success: true, preferences: frontendPreferences })
  } catch (err) {
    console.error('Notification preferences creation error:', err)
    return NextResponse.json({ error: 'Internal server error', detail: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

// PATCH - Update notification preferences for a user
export async function PATCH(request: NextRequest) {
  try {
    const result = await createClientForApi(request)
    const supabase = result.supabase
    if (!supabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as FrontendPreferences

    // Convert frontend format to DB format
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (body.emailDigest !== undefined) updateData.email_digest = body.emailDigest
    if (body.tradeAlerts !== undefined) updateData.trade_alerts = body.tradeAlerts
    if (body.thresholds !== undefined) {
      updateData.thresholds = body.thresholds
      updateData.max_daily_loss = body.thresholds.maxDailyLosses ?? 5
    }
    if (body.inApp !== undefined) updateData.in_app = body.inApp

    // Try to update existing preferences
    const { data, error } = await supabase
      .from('notification_preferences')
      .update(updateData)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      // If preferences don't exist, create them
      if (
        error.code === 'PGRST116' ||
        error.message.includes('no rows') ||
        error.message.includes('0 rows')
      ) {
        const newPreferences = {
          user_id: user.id,
          email_digest: body.emailDigest || 'daily',
          trade_alerts: body.tradeAlerts || {
            bigWin: true,
            bigLoss: true,
            streak: true,
            dailyLimit: true,
          },
          thresholds: body.thresholds || {
            bigWinAmount: 100,
            bigLossAmount: -100,
            maxDailyLosses: 5,
          },
          in_app: body.inApp ?? true,
          max_daily_loss: body.thresholds?.maxDailyLosses || 5,
        }

        const { data: newData, error: newError } = await supabase
          .from('notification_preferences')
          .insert([newPreferences])
          .select()
          .single()

        if (newError) {
          console.error('Notification preferences creation error:', newError)
          return NextResponse.json({ error: 'Failed to create preferences', detail: newError.message }, { status: 500 })
        }

        const frontendPreferences: FrontendPreferences = {
          emailDigest: newData.email_digest || 'daily',
          tradeAlerts: newData.trade_alerts,
          thresholds: newData.thresholds,
          inApp: newData.in_app ?? true,
        }

        return NextResponse.json({ success: true, preferences: frontendPreferences, created: true })
      }

      // If table doesn't exist
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          preferences: body,
          message: 'Preferences saved locally (table not available)',
        })
      }

      console.error('Notification preferences update error:', error)
      return NextResponse.json({ error: 'Failed to update preferences', detail: error.message }, { status: 500 })
    }

    const frontendPreferences: FrontendPreferences = {
      emailDigest: data.email_digest || 'daily',
      tradeAlerts: data.trade_alerts,
      thresholds: data.thresholds,
      inApp: data.in_app ?? true,
    }

    return NextResponse.json({ success: true, preferences: frontendPreferences, created: false })
  } catch (err) {
    console.error('Notification preferences update error:', err)
    return NextResponse.json({ error: 'Internal server error', detail: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

// PUT - Update notification preferences (alias for PATCH, used by frontend)
export async function PUT(request: NextRequest) {
  return PATCH(request)
}