import { NextRequest, NextResponse } from 'next/server'
import { db, ensureSchema, isDatabaseAvailable } from '@/lib/db'
import { sendEmail, getUnverifiedBulkReminderHtml, getVerificationPromoEmailHtml } from '@/lib/email'
import crypto from 'crypto'

const ADMIN_EMAILS = ['luxtradee@gmail.com']
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'
const BATCH_SIZE = 50
const CONCURRENT_LIMIT = 5

// GET handler: Send test email to admin
export async function GET(request: NextRequest) {
  try {
    const adminEmail = request.headers.get('x-admin-email')
    if (!adminEmail || !ADMIN_EMAILS.includes(adminEmail.toLowerCase())) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    const subject = request.nextUrl.searchParams.get('subject') || 'Test Email — LuxTrade'
    const htmlBody = request.nextUrl.searchParams.get('htmlBody') || '<p>Ini email test dari Admin Panel LuxTrade.</p>'

    const personalizedSubject = subject.replace(/\{\{name\}\}/g, 'Admin').replace(/\{\{email\}\}/g, adminEmail)
    const personalizedHtml = htmlBody.replace(/\{\{name\}\}/g, 'Admin').replace(/\{\{email\}\}/g, adminEmail)

    const result = await sendEmail({
      to: adminEmail,
      subject: personalizedSubject,
      html: personalizedHtml,
    })

    if (result.success) {
      return NextResponse.json({ success: true, message: 'Test email terkirim!' })
    } else {
      return NextResponse.json({ success: false, error: 'Gagal mengirim test email' }, { status: 500 })
    }
  } catch (error: unknown) {
    console.error('❌ Test email error:', error)
    const msg = error instanceof Error ? error.message : 'Terjadi kesalahan server'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Admin check
    const adminEmail = request.headers.get('x-admin-email')
    if (!adminEmail || !ADMIN_EMAILS.includes(adminEmail.toLowerCase())) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    const body = await request.json()
    const { target, subject, htmlBody, customText, promoCode } = body

    // Auto-migrate: ensure email_broadcasts table exists
    await ensureSchema()

    // Auto-sync users from Supabase Auth → profiles DB before broadcast
    // This ensures all Auth users exist in the DB for targeting
    try {
      const { supabaseAdmin: sa } = await import('@/lib/supabase-admin-alt')
      if (sa && isDatabaseAvailable()) {
        const { data: { users } } = await sa.auth.admin.listUsers({ perPage: 500 })
        if (users && users.length > 0) {
          const existingIds = new Set(
            (await db.profile.findMany({ select: { id: true } })).map((p: any) => p.id)
          )
          let created = 0
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
                created++
              } catch (_e) { /* skip duplicates */ }
            }
          }
          if (created > 0) console.log(`✅ [BROADCAST] Auto-synced ${created} new users before broadcast`)
        }
      }
    } catch (syncErr) {
      console.warn('⚠️ [BROADCAST] Auto-sync failed (non-critical, continuing):', syncErr)
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
      })
    }

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
          const newToken = crypto.randomBytes(32).toString('hex')
          const newExpAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

          await db.profile.update({
            where: { id: profile.id },
            data: {
              emailVerifyToken: newToken,
              emailVerifyExpAt: newExpAt,
            },
          })

          const confirmationUrl = `${SITE_URL}/auth/verify?token=${newToken}`
          const reminderSubject = subject || `${name}, akun LuxTrade kamu belum diverifikasi nih ⏳`

          // Use promo template if promoCode is provided, otherwise use default reminder
          const html = promoCode
            ? getVerificationPromoEmailHtml(name, confirmationUrl, promoCode)
            : getUnverifiedBulkReminderHtml(name, confirmationUrl)

          const result = await sendEmail({
            to: userEmail,
            subject: reminderSubject,
            html,
          })

          if (result.success) {
            sent++
          } else {
            failed++
            errors.push(`[${idx}] ${userEmail}: Gagal mengirim`)
          }
        } else {
          // Use custom HTML body (replace {{name}} placeholder if present)
          const personalizedHtml = htmlBody.replace(/\{\{name\}\}/g, name).replace(/\{\{email\}\}/g, userEmail)
          const personalizedSubject = subject.replace(/\{\{name\}\}/g, name).replace(/\{\{email\}\}/g, userEmail)

          const result = await sendEmail({
            to: userEmail,
            subject: personalizedSubject,
            html: personalizedHtml,
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

    // Process with concurrency limit
    for (let i = 0; i < profiles.length; i += CONCURRENT_LIMIT) {
      const batch = profiles.slice(i, i + CONCURRENT_LIMIT)
      await Promise.all(batch.map((p, j) => sendBatch(p, i + j + 1)))
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
    } catch (saveErr: any) {
      console.warn('⚠️ [BROADCAST] Could not save broadcast record (table may not exist):', saveErr?.message)
    }

    return NextResponse.json({
      sent,
      failed,
      errors,
    })
  } catch (error: unknown) {
    console.error('❌ Email broadcast error:', error)
    const msg = error instanceof Error ? error.message : 'Terjadi kesalahan server'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
