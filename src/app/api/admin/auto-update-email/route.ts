import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getAdminAuth } from '@/lib/supabase-admin-alt'
import { sendEmail, getPromotionalEmailHtml } from '@/lib/email'
import { requireAdmin } from '@/lib/admin-auth'

const EMAIL_DELAY_MS = 600
const DEFAULT_SUBJECT = '✨ Pembaruan LuxTrade — Fitur Baru & Perbaikan Bug'

/**
 * Sync users from Supabase Auth → profiles DB before broadcast.
 * This ensures emailVerified is up-to-date (same logic as email-broadcast).
 */
async function syncAuthUsersToProfiles(): Promise<{ totalAuth: number; existingDb: number; syncedNew: number; syncFailed: number }> {
  const stats = { totalAuth: 0, existingDb: 0, syncedNew: 0, syncFailed: 0 }
  try {
    const admin = getSupabaseAdmin()
    const authAdmin = getAdminAuth()
    if (!admin || !authAdmin) return stats

    const { data: { users } } = await authAdmin.listUsers({ perPage: 500 })
    if (!users || users.length === 0) return stats

    stats.totalAuth = users.length

    // Get all existing profile IDs
    const { data: existingProfiles } = await admin
      .from('profiles')
      .select('id')

    const existingIds = new Set((existingProfiles || []).map((p: any) => p.id))
    stats.existingDb = existingIds.size

    // Batch insert new users (max 100 at a time for Supabase)
    const newUsers = users.filter(u => !existingIds.has(u.id))
    for (let i = 0; i < newUsers.length; i += 100) {
      const batch = newUsers.slice(i, i + 100)
      const inserts = batch.map(u => ({
        id: u.id,
        email: u.email,
        full_name: u.user_metadata?.full_name || u.user_metadata?.name || null,
        email_verified: u.email_confirmed_at != null,
      }))

      const { error: insertErr } = await admin
        .from('profiles')
        .upsert(inserts, { onConflict: 'id' })

      if (insertErr) {
        stats.syncFailed += batch.length
      } else {
        stats.syncedNew += batch.length
      }
    }

    // Also update emailVerified for existing profiles that might be stale
    const usersToCheck = users.filter(u => existingIds.has(u.id))
    if (usersToCheck.length > 0) {
      // Fetch current email_verified for these users
      const batchSize = 100
      for (let i = 0; i < usersToCheck.length; i += batchSize) {
        const batch = usersToCheck.slice(i, i + batchSize)
        const batchIds = batch.map(u => u.id)

        const { data: currentProfiles } = await admin
          .from('profiles')
          .select('id, email_verified')
          .in('id', batchIds)

        if (currentProfiles) {
          const updates: { id: string; email_verified: boolean }[] = []
          for (const profile of currentProfiles) {
            const authUser = batch.find(u => u.id === profile.id)
            if (authUser) {
              const shouldBeVerified = authUser.email_confirmed_at != null
              if (profile.email_verified !== shouldBeVerified) {
                updates.push({ id: profile.id, email_verified: shouldBeVerified })
              }
            }
          }

          // Update in batch
          for (const upd of updates) {
            try {
              await admin
                .from('profiles')
                .update({ email_verified: upd.email_verified })
                .eq('id', upd.id)
            } catch {
              // non-critical
            }
          }
        }
      }
    }

    console.log(`📊 [auto-update-email] Sync: ${stats.totalAuth} auth users, ${stats.existingDb} in DB, ${stats.syncedNew} newly synced, ${stats.syncFailed} failed`)
  } catch (err) {
    console.error('❌ [auto-update-email] Auth→profiles sync FAILED:', err)
  }
  return stats
}

/**
 * Generate the email HTML body using the same table layout style
 * as the existing "Update & Perbaikan" template.
 */
function generateUpdateEmailHtml(
  features: string[],
  fixes: string[],
  improvements: string[],
): string {
  let html = `<h2 style="color: #1a1a2e; font-size: 20px; margin: 0 0 8px 0; font-weight: 700;">Kami Terus Berkembang untuk Kamu! 🚀</h2>
<p style="color: #555770; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;">Halo {{name}},</p>
<p style="color: #555770; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;">Tim LuxTrade terus bekerja keras buat bikin pengalaman trading kamu makin baik. Kali ini kami sudah merilis beberapa <strong style="color: #1a1a2e;">pembaruan fitur dan perbaikan bug</strong> yang penting:</p>`

  // Features section (blue #f0f4ff, bullet ✦)
  if (features.length > 0) {
    const items = features
      .map(f => `        <tr>
          <td style="padding: 3px 0; color: #555770; font-size: 14px; line-height: 1.8;">
            <span style="color: #3b82f6; margin-right: 8px; font-size: 16px;">✦</span> ${f}
          </td>
        </tr>`)
      .join('\n')

    html += `

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 20px 0;">
  <tr>
    <td style="background-color: #f0f4ff; border-radius: 12px; padding: 22px 22px;">
      <p style="color: #1e40af; font-size: 14px; font-weight: 700; margin: 0 0 14px 0;">🆕 Fitur Baru</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
${items}
      </table>
    </td>
  </tr>
</table>`
  }

  // Fixes section (green #ecfdf5, bullet ✓)
  if (fixes.length > 0) {
    const items = fixes
      .map(f => `        <tr>
          <td style="padding: 3px 0; color: #555770; font-size: 14px; line-height: 1.8;">
            <span style="color: #059669; margin-right: 8px; font-size: 16px;">✓</span> ${f}
          </td>
        </tr>`)
      .join('\n')

    html += `

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 20px 0;">
  <tr>
    <td style="background-color: #ecfdf5; border-radius: 12px; padding: 22px 22px;">
      <p style="color: #059669; font-size: 14px; font-weight: 700; margin: 0 0 14px 0;">🔧 Perbaikan</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
${items}
      </table>
    </td>
  </tr>
</table>`
  }

  // Improvements section (amber #fef3c7, bullet ⚡)
  if (improvements.length > 0) {
    const items = improvements
      .map(i => `        <tr>
          <td style="padding: 3px 0; color: #555770; font-size: 14px; line-height: 1.8;">
            <span style="color: #d97706; margin-right: 8px; font-size: 16px;">⚡</span> ${i}
          </td>
        </tr>`)
      .join('\n')

    html += `

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
  <tr>
    <td style="background-color: #fef3c7; border-radius: 12px; padding: 18px 22px;">
      <p style="color: #92400e; font-size: 14px; font-weight: 700; margin: 0 0 14px 0;">⚡ Peningkatan & Optimasi</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
${items}
      </table>
    </td>
  </tr>
</table>`
  }

  // Footer CTA
  html += `

<p style="color: #555770; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0;">Masih banyak ide dan fitur yang sedang kami kerjakan. Kalau kamu punya <strong style="color: #1a1a2e;">saran atau feedback</strong>, jangan ragu buat kasih tau kami ya!</p>

<table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
  <tr>
    <td style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 12px;">
      <a href="https://luxtradee.web.id/dashboard" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700;">Buka Dashboard Sekarang →</a>
    </td>
  </tr>
</table>

<p style="color: #8b8da0; font-size: 13px; line-height: 1.6; margin: 24px 0 0 0; text-align: center;">Terima kasih sudah setia pakai LuxTrade. Happy trading! 📈</p>`

  return html
}

/**
 * GET: Return a preview of how many users would receive the email.
 * Query params: target (default 'verified')
 */
export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdmin(request)
    if (error) return error

    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 500 })
    }

    // Sync Auth users first so emailVerified is accurate
    const syncStats = await syncAuthUsersToProfiles()

    const target = request.nextUrl.searchParams.get('target') || 'verified'
    const validTargets = ['verified', 'all', 'pro']
    if (!validTargets.includes(target)) {
      return NextResponse.json({ error: `Target tidak valid. Gunakan: ${validTargets.join(', ')}` }, { status: 400 })
    }

    // Build query
    let query = admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .not('email', 'is', null)

    if (target === 'verified') {
      query = query.eq('email_verified', true)
    }
    if (target === 'pro') {
      query = query.eq('is_pro', true)
    }

    const { count } = await query

    return NextResponse.json({
      target,
      recipientCount: count || 0,
      sync: syncStats,
      message: `Email akan dikirim ke ${count || 0} user (${target})`,
    })
  } catch (error: unknown) {
    console.error('[API /admin/auto-update-email GET] Error:', error)
    return NextResponse.json({ error: 'Gagal menghitung penerima' }, { status: 500 })
  }
}

/**
 * POST: Send update email to users.
 * Body: {
 *   features?: string[],    // list of feature descriptions
 *   fixes?: string[],       // list of fix descriptions
 *   improvements?: string[],// list of improvement descriptions
 *   target?: string,        // 'verified' | 'all' | 'pro'
 *   subject?: string        // email subject
 * }
 *
 * Admin provides the change descriptions directly — no git dependency.
 */
export async function POST(request: NextRequest) {
  try {
    const { error, user } = await requireAdmin(request)
    if (error) return error

    const body = await request.json()
    const features: string[] = Array.isArray(body.features) ? body.features.filter((s: string) => s.trim()) : []
    const fixes: string[] = Array.isArray(body.fixes) ? body.fixes.filter((s: string) => s.trim()) : []
    const improvements: string[] = Array.isArray(body.improvements) ? body.improvements.filter((s: string) => s.trim()) : []
    const target = body.target || 'verified'
    const subject = body.subject || DEFAULT_SUBJECT
    const adminEmail = user!.email || 'admin'

    // Validate target
    const validTargets = ['verified', 'all', 'pro']
    if (!validTargets.includes(target)) {
      return NextResponse.json(
        { error: `Target tidak valid. Gunakan: ${validTargets.join(', ')}` },
        { status: 400 },
      )
    }

    // Must have at least one item
    const totalItems = features.length + fixes.length + improvements.length
    if (totalItems === 0) {
      return NextResponse.json({
        success: false,
        error: 'Tambahkan minimal 1 item (fitur, perbaikan, atau peningkatan)',
        sent: 0,
        failed: 0,
      })
    }

    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 500 })
    }

    // Sync Auth users first so emailVerified is accurate
    const syncStats = await syncAuthUsersToProfiles()
    console.log(`📊 [auto-update-email POST] Sync done. Target: ${target}`)

    // Build query based on target
    let query = admin
      .from('profiles')
      .select('id, email, full_name')
      .not('email', 'is', null)

    switch (target) {
      case 'verified':
        query = query.eq('email_verified', true)
        break
      case 'pro':
        query = query.eq('is_pro', true)
        break
    }

    const { data: profiles, error: queryError } = await query

    if (queryError || !profiles || profiles.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Tidak ada user yang cocok dengan target ini',
        features,
        fixes,
        improvements,
        sent: 0,
        failed: 0,
        sync: syncStats,
      })
    }

    console.log(`📢 [auto-update-email] Target "${target}": ${profiles.length} users will receive.`)

    // Generate email HTML body
    const htmlBody = generateUpdateEmailHtml(features, fixes, improvements)

    // Send emails sequentially with delay
    let sent = 0
    let failed = 0

    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i]
      const userEmail = profile.email
      if (!userEmail) continue

      const name = profile.full_name || userEmail.split('@')[0]

      try {
        const personalizedBody = htmlBody.replace(/\{\{name\}\}/g, name).replace(/\{\{email\}\}/g, userEmail)
        const personalizedSubject = subject.replace(/\{\{name\}\}/g, name).replace(/\{\{email\}\}/g, userEmail)

        const fullHtml = getPromotionalEmailHtml(name, personalizedSubject, personalizedBody)

        const result = await sendEmail({
          to: userEmail,
          subject: personalizedSubject,
          html: fullHtml,
          replyTo: 'luxtradee@gmail.com',
        })

        if (result.success) {
          sent++
        } else {
          failed++
        }
      } catch {
        failed++
      }

      // Delay between emails for Resend rate limit
      if (i < profiles.length - 1) {
        await new Promise(r => setTimeout(r, EMAIL_DELAY_MS))
      }
    }

    // Save broadcast record
    try {
      await admin
        .from('email_broadcasts')
        .insert({
          target,
          subject,
          sent_count: sent,
          failed_count: failed,
          sent_by: adminEmail,
          created_at: new Date().toISOString(),
        })
    } catch {
      // Non-critical
    }

    return NextResponse.json({
      success: true,
      features,
      fixes,
      improvements,
      sent,
      failed,
      sync: syncStats,
    })
  } catch (error: unknown) {
    console.error('[API /admin/auto-update-email POST] Error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
