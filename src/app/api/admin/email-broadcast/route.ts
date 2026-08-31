import { NextRequest, NextResponse } from 'next/server'
import { db, isDatabaseAvailable } from '@/lib/db'
import { sendEmail, getUnverifiedBulkReminderHtml, getVerificationPromoEmailHtml, getPromotionalEmailHtml } from '@/lib/email'
import { requireAdmin } from '@/lib/admin-auth'
import { edgeCrypto } from '@/lib/edge-crypto'

function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'
}
const BATCH_SIZE = 50
// Resend free tier: max 2 requests/second.
// Sending sequentially with 600ms delay = ~1.67 req/s — safely under the limit.
const EMAIL_DELAY_MS = 600

// GET handler: Send test email to admin
export async function GET(request: NextRequest) {
  try {
    const { error, user } = await requireAdmin(request)
    if (error) return error

    const subject = request.nextUrl.searchParams.get('subject') || 'Test Email — LuxTrade'
    const htmlBody = request.nextUrl.searchParams.get('htmlBody') || '<p>Ini email test dari Admin Panel LuxTrade.</p>'

    const adminEmail = user!.email || 'admin'

    const personalizedSubject = subject.replace(/\{\{name\}\}/g, 'Admin').replace(/\{\{email\}\}/g, adminEmail)
    const personalizedBody = htmlBody.replace(/\{\{name\}\}/g, 'Admin').replace(/\{\{email\}\}/g, adminEmail)

    // Wrap with professional email template (full HTML with header, footer, branding)
    const fullHtml = getPromotionalEmailHtml('Admin', personalizedSubject, personalizedBody)

    const result = await sendEmail({
      to: adminEmail,
      subject: personalizedSubject,
      html: fullHtml,
      replyTo: 'luxtradee@gmail.com',
    })

    if (result.success) {
      return NextResponse.json({ success: true, message: 'Test email terkirim!' })
    } else {
      return NextResponse.json({ success: false, error: 'Gagal mengirim test email' }, { status: 500 })
    }
  } catch (error: unknown) {
    console.error('[API /admin/email-broadcast GET] Error:', error)
    return NextResponse.json({ error: 'Gagal mengirim test email' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error, user } = await requireAdmin(request)
    if (error) return error

    const body = await request.json()
    const { target, subject, htmlBody, customText, promoCode } = body

    const adminEmail = user!.email || 'admin'

    // Auto-sync users from Supabase Auth → profiles DB before broadcast
    // This ensures all Auth users exist in the DB for targeting
    let syncStats = { totalAuth: 0, existingDb: 0, syncedNew: 0, syncFailed: 0, error: '' as string }
    try {
      const { getAdminAuth } = await import('@/lib/supabase-admin-alt')
      const authAdmin = getAdminAuth()
      if (authAdmin && isDatabaseAvailable()) {
        const { data: { users } } = await authAdmin.listUsers({ perPage: 500 })
        if (users && users.length > 0) {
          syncStats.totalAuth = users.length
          const existingIds = new Set(
            (await db.profile.findMany({ select: { id: true } })).map((p: any) => p.id)
          )
          syncStats.existingDb = existingIds.size
          for (const u of users) {
            if (!existingIds.has(u.id)) {
              try {
                await db.profile.create({
                  data: {
                    id: u.id,
                    email: u.email,
                    full_name: u.user_metadata?.full_name || u.user_metadata?.name || null,
                    emailVerified: u.email_confirmed_at != null,
                  },
                })
                syncStats.syncedNew++
              } catch (_e) {
                syncStats.syncFailed++
              }
            }
          }
          console.log(`📊 [email-broadcast] Sync: ${syncStats.totalAuth} auth users, ${syncStats.existingDb} in DB, ${syncStats.syncedNew} newly synced, ${syncStats.syncFailed} failed`)
        }
      }
    } catch (_syncErr: any) {
      const errMsg = _syncErr instanceof Error ? _syncErr.message : String(_syncErr)
      syncStats.error = errMsg
      console.error(`❌ [email-broadcast] Auth→profiles sync FAILED: ${errMsg}`)
    }

    // Validate required fields
    if (!target || !subject) {
      return NextResponse.json(
        { error: 'Target dan subject wajib diisi' },
        { status: 400 }
      )
    }

    const validTargets = ['unverified', 'verified', 'pro', 'free', 'all']
    if (!validTargets.includes(target)) {
      return NextResponse.json(
        { error: 'Target tidak valid' },
        { status: 400 }
      )
    }

    // For non-unverified targets, htmlBody is required
    if (target !== 'unverified' && !htmlBody) {
      return NextResponse.json(
        { error: 'Konten email (HTML) wajib diisi untuk target ini' },
        { status: 400 }
      )
    }

    // Build query based on target
    const whereClause: Record<string, unknown> = {}
    switch (target) {
      case 'unverified':
        whereClause.emailVerified = false
        whereClause.email = { not: null }
        break
      case 'verified':
        whereClause.emailVerified = true
        whereClause.email = { not: null }
        break
      case 'pro':
        whereClause.is_pro = true
        whereClause.email = { not: null }
        break
      case 'free':
        whereClause.is_pro = false
        whereClause.emailVerified = true
        whereClause.email = { not: null }
        break
      case 'all':
        whereClause.email = { not: null }
        break
    }

    // Fetch ALL matching profiles (no limit — broadcast to everyone)
    const profiles = await db.profile.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        full_name: true,
      },
    })

    if (profiles.length === 0) {
      return NextResponse.json({
        sent: 0,
        failed: 0,
        errors: ['Tidak ada user yang cocok dengan target ini'],
        sync: syncStats,
        targetUserCount: 0,
      })
    }

    // Log recipient count BEFORE sending, so admin can see it
    console.log(`📢 [email-broadcast] Target "${target}": ${profiles.length} users will receive. Sync stats: auth=${syncStats.totalAuth}, db=${syncStats.existingDb}, new=${syncStats.syncedNew}${syncStats.error ? `, ERROR: ${syncStats.error}` : ''}`)

    // Send emails in parallel with concurrency limit
    let sent = 0
    let failed = 0
    const errors: string[] = []

    const sendBatch = async (
      profile: { id: string; email: string | null; full_name: string | null },
      idx: number
    ) => {
      const userEmail = profile.email
      if (!userEmail) return

      const name = profile.full_name || userEmail.split('@')[0]

      try {
        if (target === 'unverified') {
          // Generate new verification token for each unverified user
          const newToken = edgeCrypto.randomBytesHex(32)
          const newExpAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

          await db.profile.update({
            where: { id: profile.id },
            data: {
              emailVerifyToken: newToken,
              emailVerifyExpAt: newExpAt,
            },
          })

          const confirmationUrl = `${getSiteUrl()}/auth/verify?token=${newToken}`
          const reminderSubject = subject || `${name}, akun LuxTrade kamu belum diverifikasi nih ⏳`

          // Use promo template if promoCode is provided, otherwise use default reminder
          const html = promoCode
            ? getVerificationPromoEmailHtml(name, confirmationUrl, promoCode)
            : getUnverifiedBulkReminderHtml(name, confirmationUrl)

          const result = await sendEmail({
            to: userEmail,
            subject: reminderSubject,
            html,
            replyTo: 'luxtradee@gmail.com',
          })

          if (result.success) {
            sent++
          } else {
            failed++
            errors.push(`[${idx}] ${userEmail}: Gagal mengirim`)
          }
        } else {
          // Use custom HTML body (replace {{name}} placeholder if present)
          const personalizedBody = htmlBody.replace(/\{\{name\}\}/g, name).replace(/\{\{email\}\}/g, userEmail)
          const personalizedSubject = subject.replace(/\{\{name\}\}/g, name).replace(/\{\{email\}\}/g, userEmail)

          // Wrap with professional email template (full HTML with header, footer, branding)
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
            errors.push(`[${idx}] ${userEmail}: Gagal mengirim`)
          }
        }
      } catch (err: unknown) {
        failed++
        const msg = err instanceof Error ? err.message : 'Unknown error'
        errors.push(`[${idx}] ${userEmail}: ${msg}`)
      }
    }

    // Process sequentially with delay to respect Resend rate limit (2 req/s)
    for (let i = 0; i < profiles.length; i++) {
      await sendBatch(profiles[i], i + 1)
      if (i < profiles.length - 1) {
        await new Promise(r => setTimeout(r, EMAIL_DELAY_MS))
      }
    }

    // Save broadcast record (non-critical — don't fail the whole broadcast if table missing)
    try {
      await db.emailBroadcast.create({
        data: {
          target,
          subject,
          sentCount: sent,
          failedCount: failed,
          sentBy: adminEmail,
        },
      })
    } catch (_saveErr: any) {
      // Could not save broadcast record — non-critical
    }

    return NextResponse.json({
      sent,
      failed,
      errors,
      sync: syncStats,
      targetUserCount: profiles.length,
    })
  } catch (error: unknown) {
    console.error('[API /admin/email-broadcast POST] Error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}