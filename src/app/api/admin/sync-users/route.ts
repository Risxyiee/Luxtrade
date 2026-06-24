import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getAdminStatus } from '@/lib/supabase-admin-alt'
import { db, isDatabaseAvailable, ensureSchema } from '@/lib/db'

const ADMIN_EMAILS = ['luxtradee@gmail.com']

/**
 * POST /api/admin/sync-users
 * Sync all users from Supabase Auth → Prisma profiles table.
 * - Creates missing profiles (users in Auth but not in DB)
 * - Updates email & full_name for existing profiles
 * - Returns stats about what was synced
 */
export async function POST(request: NextRequest) {
  try {
    // Admin check
    const adminEmail = request.headers.get('x-admin-email')
    if (!adminEmail || !ADMIN_EMAILS.includes(adminEmail.toLowerCase())) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase Admin tidak tersedia', details: 'SUPABASE_SERVICE_ROLE_KEY missing' },
        { status: 500 }
      )
    }

    if (!isDatabaseAvailable()) {
      return NextResponse.json(
        { error: 'Database tidak tersedia', hint: 'DATABASE_URL belum di-set atau salah format.' },
        { status: 500 }
      )
    }

    // Ensure schema is up to date before writing
    await ensureSchema()

    // ── Step 1: Fetch ALL users from Supabase Auth (paginated) ──
    const allAuthUsers: any[] = []
    let page = 1
    const perPage = 50

    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      })

      if (error) {
        console.error('❌ [SYNC] Auth listUsers error:', error.message)
        return NextResponse.json({ error: 'Gagal mengambil data dari Supabase Auth', details: error.message }, { status: 500 })
      }

      const users = data.users || []
      allAuthUsers.push(...users)

      if (users.length < perPage) break // last page
      page++
    }

    console.log(`✅ [SYNC] Fetched ${allAuthUsers.length} users from Supabase Auth (${page} pages)`)

    if (allAuthUsers.length === 0) {
      return NextResponse.json({ synced: 0, created: 0, updated: 0, auth_total: 0, message: 'Tidak ada user di Supabase Auth' })
    }

    // ── Step 2: Get existing profile IDs from DB ──
    const existingProfiles = await db.profile.findMany({
      select: { id: true, email: true, full_name: true, emailVerified: true },
    })

    const existingMap = new Map(existingProfiles.map((p: any) => [p.id, p]))
    console.log(`✅ [SYNC] Found ${existingProfiles.length} existing profiles in DB`)

    // ── Step 3: Upsert — create missing, update email/name for existing ──
    let created = 0
    let updated = 0
    let skipped = 0
    const errors: string[] = []

    for (const authUser of allAuthUsers) {
      const metadata = authUser.user_metadata || {}
      const userId = authUser.id
      const authEmail = authUser.email || null
      const authName = metadata.full_name || metadata.name || null
      const emailVerified = authUser.email_confirmed_at != null
      const existing = existingMap.get(userId)

      try {
        if (existing) {
          // Check if update is needed
          const needsUpdate =
            existing.email !== authEmail ||
            existing.full_name !== authName ||
            existing.emailVerified !== emailVerified

          if (needsUpdate) {
            await db.profile.update({
              where: { id: userId },
              data: {
                ...(authEmail !== existing.email ? { email: authEmail } : {}),
                ...(authName !== existing.full_name ? { full_name: authName } : {}),
                ...(emailVerified !== existing.emailVerified ? { emailVerified } : {}),
              },
            })
            updated++
          } else {
            skipped++
          }
        } else {
          // Create new profile for user that exists in Auth but not in DB
          await db.profile.create({
            data: {
              id: userId,
              email: authEmail,
              full_name: authName,
              emailVerified,
            },
          })
          created++
        }
      } catch (err: any) {
        const msg = err?.message?.substring(0, 100) || 'Unknown error'
        errors.push(`${authEmail || userId}: ${msg}`)
        console.warn(`⚠️ [SYNC] Failed for ${authEmail || userId}:`, msg)
      }
    }

    const synced = created + updated
    console.log(`✅ [SYNC] Done! Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors.length}`)

    return NextResponse.json({
      success: true,
      message: `Sinkronisasi selesai! ${created} user baru ditambahkan, ${updated} diperbarui.`,
      auth_total: allAuthUsers.length,
      db_total: existingProfiles.length + created,
      created,
      updated,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('❌ [SYNC] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Gagal sinkronisasi', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}