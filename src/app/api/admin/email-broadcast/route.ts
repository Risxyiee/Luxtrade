import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendEmail, getReminderVerificationEmailHtml } from '@/lib/email'
import crypto from 'crypto'

const ADMIN_EMAILS = ['luxtradee@gmail.com']
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://luxtradee.web.id'
const BATCH_SIZE = 50
const CONCURRENT_LIMIT = 5

export async function POST(request: NextRequest) {
  try {
    // Admin check
    const adminEmail = request.headers.get('x-admin-email')
    if (!adminEmail || !ADMIN_EMAILS.includes(adminEmail.toLowerCase())) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    const body = await request.json()
    const { target, subject, htmlBody, customText } = body

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

    // Fetch profiles (limit batch size)
    const profiles = await db.profile.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        full_name: true,
      },
      take: BATCH_SIZE,
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
          const reminderSubject = subject || `Hei ${name}, akun kamu belum diverifikasi nih 😅`
          const html = getReminderVerificationEmailHtml(name, confirmationUrl)

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

    // Save broadcast record
    await db.emailBroadcast.create({
      data: {
        target,
        subject,
        sentCount: sent,
        failedCount: failed,
        sentBy: adminEmail,
      },
    })

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
