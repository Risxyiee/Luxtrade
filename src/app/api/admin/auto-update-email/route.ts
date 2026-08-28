import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { db, isDatabaseAvailable } from '@/lib/db'
import { sendEmail, getPromotionalEmailHtml } from '@/lib/email'
import { requireAdmin } from '@/lib/admin-auth'

const BATCH_SIZE = 50
const EMAIL_DELAY_MS = 600
const DEFAULT_SUBJECT = '✨ Pembaruan LuxTrade — Fitur Baru & Perbaikan Bug'

// ── Commit categorization keywords ──────────────────────────────────────────
const FEATURE_KEYWORDS = /(?:feat|add|new|fitur|tambah|implement)/i
const FIX_KEYWORDS = /(?:fix|bug|perbaiki|perbaikan|repair|patch|hotfix)/i
const IMPROVE_KEYWORDS = /(?:perf|optim|improve|peningkatan|refactor|redesign|upgrade|enhance|faster|speed)/i

interface CategorizedCommits {
  features: string[]
  fixes: string[]
  improvements: string[]
  totalCommits: number
}

/**
 * Read git log for the last N days and categorize commits.
 */
function getCommits(days: number): CategorizedCommits {
  const result: CategorizedCommits = {
    features: [],
    fixes: [],
    improvements: [],
    totalCommits: 0,
  }

  try {
    const raw = execSync(`git log --oneline --since="${days} days ago"`, {
      cwd: '/home/z/my-project',
      encoding: 'utf-8',
    })

    const lines = raw
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)

    for (const line of lines) {
      // Remove hash prefix (e.g. "abc1234 commit message" → "commit message")
      const message = line.replace(/^\S+\s+/, '').trim()
      if (!message) continue

      if (FEATURE_KEYWORDS.test(message)) {
        result.features.push(message)
      } else if (FIX_KEYWORDS.test(message)) {
        result.fixes.push(message)
      } else {
        result.improvements.push(message)
      }
    }

    result.totalCommits = result.features.length + result.fixes.length + result.improvements.length
  } catch {
    // No commits found or git error
  }

  return result
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
 * GET: Return categorized commits WITHOUT sending.
 * Query params: days (default 7)
 */
export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdmin(request)
    if (error) return error

    const daysParam = request.nextUrl.searchParams.get('days')
    const days = daysParam ? Math.max(1, Math.min(90, parseInt(daysParam, 10) || 7)) : 7

    const commits = getCommits(days)

    return NextResponse.json(commits)
  } catch (error: unknown) {
    console.error('[API /admin/auto-update-email GET] Error:', error)
    return NextResponse.json({ error: 'Gagal membaca commit' }, { status: 500 })
  }
}

/**
 * POST: Read commits, generate email, send to target users.
 * Body: { days?: number, target?: string, subject?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { error, user } = await requireAdmin(request)
    if (error) return error

    const body = await request.json()
    const days = Math.max(1, Math.min(90, parseInt(String(body.days), 10) || 7))
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

    // Read and categorize commits
    const commits = getCommits(days)

    if (commits.totalCommits === 0) {
      return NextResponse.json({
        success: false,
        error: `Tidak ada commit ditemukan dalam ${days} hari terakhir`,
        features: [],
        fixes: [],
        improvements: [],
        sent: 0,
        failed: 0,
      })
    }

    // Generate email HTML body
    const htmlBody = generateUpdateEmailHtml(commits.features, commits.fixes, commits.improvements)

    // Build query based on target
    if (!isDatabaseAvailable()) {
      return NextResponse.json({ error: 'Database tidak tersedia' }, { status: 500 })
    }

    const whereClause: Record<string, unknown> = { email: { not: null } }
    switch (target) {
      case 'verified':
        whereClause.emailVerified = true
        break
      case 'pro':
        whereClause.is_pro = true
        break
      // 'all' — no additional filter
    }

    const profiles = await db.profile.findMany({
      where: whereClause,
      select: { id: true, email: true, full_name: true },
    })

    if (profiles.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Tidak ada user yang cocok dengan target ini',
        features: commits.features,
        fixes: commits.fixes,
        improvements: commits.improvements,
        sent: 0,
        failed: 0,
      })
    }

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
      await db.emailBroadcast.create({
        data: {
          target,
          subject,
          sentCount: sent,
          failedCount: failed,
          sentBy: adminEmail,
        },
      })
    } catch {
      // Non-critical
    }

    return NextResponse.json({
      success: true,
      features: commits.features,
      fixes: commits.fixes,
      improvements: commits.improvements,
      sent,
      failed,
    })
  } catch (error: unknown) {
    console.error('[API /admin/auto-update-email POST] Error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
