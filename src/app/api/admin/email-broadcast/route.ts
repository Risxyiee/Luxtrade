import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin-alt'
import { sendEmail, getUnverifiedBulkReminderHtml, getVerificationPromoEmailHtml, getPromotionalEmailHtml } from '@/lib/email'
import { requireAdmin } from '@/lib/admin-auth'
import { edgeCrypto } from '@/lib/edge-crypto'

function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'
}

// Cloudflare Workers free tier limit: 50 subrequests per invocation
// Auth→DB sync uses subrequests for each new user (INSERT to DB)
// Each email send is 1 subrequest to Resend
// Each profile UPDATE (for unverified tokens) is 1 subrequest
// We'll use batch size of 15 to stay safely under limit
const BATCH_SIZE = 15
// Delay between batches to avoid hitting rate limits
const BATCH_DELAY_MS = 3000

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
    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    const { error, user } = await requireAdmin(request)
    if (error) return error

    const body = await request.json()
    const { target, subject, htmlBody, promoCode, offset = 0, limit = 40 } = body

    const adminEmail = user!.email || 'admin'

    // Check Resend API key is available BEFORE doing anything else
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) {
      return NextResponse.json({
        sent: 0,
        failed: 0,
        errors: ['RESEND_API_KEY tidak ditemukan di environment variables'],
        targetUserCount: 0,
      }, { status: 500 })
    }

    // Sync stats tracking
    let syncStats = { totalAuth: 0, existingDb: 0, syncedNew: 0, syncFailed: 0, error: '' as string }

    // Auto-sync users from Supabase Auth → profiles DB before broadcast
    // Skip sync if targeting 'unverified' to save subrequests (they already exist in DB)
    if (target !== 'unverified') {
      try {
        const { getAdminAuth } = await import('@/lib/supabase-admin-alt')
        const authAdmin = getAdminAuth()
        if (authAdmin) {
          let allAuthUsers: any[] = []
          let page = 1
          const perPage = 500
          while (true) {
            const { data: pageData } = await authAdmin.listUsers({ page, perPage })
            if (!pageData?.users?.length) break
            allAuthUsers.push(...pageData.users)
            if (pageData.users.length < perPage) break
            page++
          }
          if (allAuthUsers.length > 0) {
            syncStats.totalAuth = allAuthUsers.length
            const { data: existingProfiles } = await admin.from('profiles').select('id')
            const existingIds = new Set((existingProfiles || []).map((p: any) => p.id))
            syncStats.existingDb = existingIds.size
            for (const u of allAuthUsers) {
              if (!existingIds.has(u.id)) {
                try {
                  await admin.from('profiles').insert({
                    id: u.id,
                    email: u.email,
                    full_name: u.user_metadata?.full_name || u.user_metadata?.name || null,
                    email_verified: u.email_confirmed_at != null,
                  }).single()
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

    // Build Supabase query based on target
    let query = admin.from('profiles').select('id, email, full_name').not('email', 'is', null)
    switch (target) {
      case 'unverified':
        query = query.eq('email_verified', false)
        break
      case 'verified':
        query = query.eq('email_verified', true)
        break
      case 'pro':
        query = query.eq('is_pro', true)
        break
      case 'free':
        query = query.eq('is_pro', false).eq('email_verified', true)
        break
      case 'all':
        // no additional filters — already has .not('email', 'is', null)
        break
    }

    // Fetch ALL matching profiles (no limit — broadcast to everyone)
    const { data: profiles } = await query
    const profileList = profiles || []

    if (profileList.length === 0) {
      return NextResponse.json({
        sent: 0,
        failed: 0,
        errors: ['Tidak ada user yang cocok dengan target ini'],
        sync: syncStats,
        targetUserCount: 0,
        totalBatches: 0,
        currentBatch: 0,
      })
    }

    // Apply offset and limit for batch processing
    const batchSize = limit
    const batchStart = offset
    const batchEnd = Math.min(offset + limit, profileList.length)
    const currentBatch = profileList.slice(batchStart, batchEnd)
    const totalBatches = Math.ceil(profileList.length / batchSize)

    console.log(`📢 [email-broadcast] Target "${target}": batch ${Math.floor(offset / batchSize) + 1}/${totalBatches} (${currentBatch.length} users, offset ${offset}). Total users: ${profileList.length}. Sync stats: auth=${syncStats.totalAuth}, db=${syncStats.existingDb}, new=${syncStats.syncedNew}${syncStats.error ? `, ERROR: ${syncStats.error}` : ''}`)

    // Track results with detailed errors for failed emails
    let sent = 0
    let failed = 0
    const errors: Map<string, string> = new Map() // Use Map to avoid duplicate error messages

    // Process profiles in this batch only
    for (let i = 0; i < currentBatch.length; i++) {
        const profile = currentBatch[i]
        const globalIdx = batchStart + i + 1

        const userEmail = profile.email
        if (!userEmail) {
          console.log(`[email-broadcast] [${globalIdx}] Skipping - no email for user ${profile.id}`)
          continue
        }

        const name = profile.full_name || userEmail.split('@')[0]

        try {
          if (target === 'unverified') {
            // Generate new verification token for each unverified user
            const newToken = edgeCrypto.randomBytesHex(32)
            const newExpAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

            await admin.from('profiles').update({
              email_verify_token: newToken,
              email_verify_exp_at: newExpAt.toISOString(),
            }).eq('id', profile.id)

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
              console.log(`[email-broadcast] [${globalIdx}] ✅ Sent to ${userEmail}`)
            } else {
              const errDetail = result.error
                ? typeof result.error === 'string'
                  ? result.error
                  : JSON.stringify(result.error, null, 2)
                : 'Unknown error'
              console.error(`[email-broadcast] [${globalIdx}] ❌ Failed to send to ${userEmail}:`, errDetail)

              // Store error
              errors.set(userEmail, errDetail)
              failed++

              // No retry - batch processing already reduces subrequests
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
              console.log(`[email-broadcast] [${globalIdx}] ✅ Sent to ${userEmail}`)
            } else {
              const errDetail = result.error
                ? typeof result.error === 'string'
                  ? result.error
                  : JSON.stringify(result.error, null, 2)
                : 'Unknown error'
              console.error(`[email-broadcast] [${globalIdx}] ❌ Failed to send to ${userEmail}:`, errDetail)

              // Store error
              errors.set(userEmail, errDetail)
              failed++

              // No retry - batch processing already reduces subrequests
            }
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Unknown error'
          console.error(`[email-broadcast] [${globalIdx}] ❌ Exception for ${userEmail}:`, err)

          // Store error
          errors.set(userEmail, msg)
          failed++

          // No retry - batch processing already reduces subrequests
        }

        // Small delay between emails to avoid hitting rate limits
        if (i < currentBatch.length - 1) {
          await new Promise(r => setTimeout(r, 600))
        }
    }

    // Save broadcast record (non-critical — don't fail the whole broadcast if table missing)
    try {
      await admin.from('email_broadcasts').insert({
        target,
        subject,
        sent_count: sent,
        failed_count: failed,
        sent_by: adminEmail,
      }).single()
    } catch (_saveErr: any) {
      // Could not save broadcast record — non-critical
    }

    // Convert errors Map to array format for response
    const errorsArray = Array.from(errors.entries()).map(([email, error]) => `${email}: ${error}`)

    return NextResponse.json({
      sent,
      failed,
      errors: errorsArray,
      sync: syncStats,
      targetUserCount: profileList.length,
      totalBatches,
      currentBatch: Math.floor(offset / batchSize) + 1,
      batchSize: currentBatch.length,
    })
  } catch (error: unknown) {
    console.error('[API /admin/email-broadcast POST] Error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}