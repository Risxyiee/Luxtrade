import { NextRequest, NextResponse } from 'next/server'
import { createClientForApi } from '@/lib/supabase/server'

interface NotificationPreferences {
  id?: string
  user_id: string
  email_notifications: boolean
  push_notifications: boolean
  trade_alerts: boolean
  target_reminders: boolean
  daily_summary: boolean
  weekly_summary: boolean
  market_news: boolean
  achievement_notifications: boolean
  created_at?: string
  updated_at?: string
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
        const defaultPreferences: NotificationPreferences = {
          user_id: user.id,
          email_notifications: true,
          push_notifications: false,
          trade_alerts: true,
          target_reminders: true,
          daily_summary: false,
          weekly_summary: true,
          market_news: false,
          achievement_notifications: true,
        }
        return NextResponse.json({ preferences: defaultPreferences })
      }
      console.error('Notification preferences fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 })
    }

    return NextResponse.json({ preferences: data })
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

    const body = await request.json()
    const {
      email_notifications,
      push_notifications,
      trade_alerts,
      target_reminders,
      daily_summary,
      weekly_summary,
      market_news,
      achievement_notifications,
    } = body

    const preferencesData: NotificationPreferences = {
      user_id: user.id,
      email_notifications: email_notifications ?? true,
      push_notifications: push_notifications ?? false,
      trade_alerts: trade_alerts ?? true,
      target_reminders: target_reminders ?? true,
      daily_summary: daily_summary ?? false,
      weekly_summary: weekly_summary ?? true,
      market_news: market_news ?? false,
      achievement_notifications: achievement_notifications ?? true,
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
          preferences: {
            ...preferencesData,
            id: crypto.randomUUID(),
            created_at: new Date().toISOString(),
          },
          message: 'Preferences saved locally (table not available)',
        })
      }
      return NextResponse.json({ error: 'Failed to create preferences' }, { status: 500 })
    }

    return NextResponse.json({ success: true, preferences: data })
  } catch (err) {
    console.error('Notification preferences creation error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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

    const body = await request.json()
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    // Only update fields that are provided
    if (body.email_notifications !== undefined)
      updateData.email_notifications = body.email_notifications
    if (body.push_notifications !== undefined)
      updateData.push_notifications = body.push_notifications
    if (body.trade_alerts !== undefined)
      updateData.trade_alerts = body.trade_alerts
    if (body.target_reminders !== undefined)
      updateData.target_reminders = body.target_reminders
    if (body.daily_summary !== undefined)
      updateData.daily_summary = body.daily_summary
    if (body.weekly_summary !== undefined)
      updateData.weekly_summary = body.weekly_summary
    if (body.market_news !== undefined)
      updateData.market_news = body.market_news
    if (body.achievement_notifications !== undefined)
      updateData.achievement_notifications = body.achievement_notifications

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
        const newPreferences: NotificationPreferences = {
          user_id: user.id,
          email_notifications: body.email_notifications ?? true,
          push_notifications: body.push_notifications ?? false,
          trade_alerts: body.trade_alerts ?? true,
          target_reminders: body.target_reminders ?? true,
          daily_summary: body.daily_summary ?? false,
          weekly_summary: body.weekly_summary ?? true,
          market_news: body.market_news ?? false,
          achievement_notifications: body.achievement_notifications ?? true,
        }

        const { data: newData, error: newError } = await supabase
          .from('notification_preferences')
          .insert([newPreferences])
          .select()
          .single()

        if (newError) {
          console.error('Notification preferences creation error:', newError)
          return NextResponse.json({ error: 'Failed to create preferences' }, { status: 500 })
        }

        return NextResponse.json({ success: true, preferences: newData, created: true })
      }

      // If table doesn't exist
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          preferences: {
            ...updateData,
            user_id: user.id,
          },
          message: 'Preferences saved locally (table not available)',
        })
      }

      console.error('Notification preferences update error:', error)
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 })
    }

    return NextResponse.json({ success: true, preferences: data, created: false })
  } catch (err) {
    console.error('Notification preferences update error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}