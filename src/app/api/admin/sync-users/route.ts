import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getAdminAuth } from '@/lib/supabase-admin-alt'
import { requireAdmin } from '@/lib/admin-auth'
import { createClient } from '@supabase/supabase-js'

function getSupabaseSvc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

/**
 * POST /api/admin/sync-users
 * Sync all users from Supabase Auth → Supabase profiles table.
 * No Prisma — fully Supabase for CF Workers compatibility.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request)
    if (authResult.error) return authResult.error

    const authAdmin = getAdminAuth()
    if (!authAdmin) {
      return NextResponse.json(
        { error: 'Supabase Admin tidak tersedia', details: 'SUPABASE_SERVICE_ROLE_KEY missing' },
        { status: 500 }
      )
    }

    // ── Step 1: Fetch ALL users from Supabase Auth (paginated) ──
    const allAuthUsers: any[] = []
    let page = 1
    const perPage = 50

    while (true) {
      const { data, error: listError } = await authAdmin.listUsers({
        page,
        perPage,
      })

      if (listError) {
        console.error('❌ [SYNC] Auth listUsers error:', listError.message)
        return NextResponse.json({ error: 'Gagal mengambil data dari Supabase Auth', details: listError.message }, { status: 500 })
      }

      const users = data.users || []
      allAuthUsers.push(...users)

      if (users.length < perPage) break
      page++
    }

    console.log(`✅ [SYNC] Fetched ${allAuthUsers.length} users from Supabase Auth (${page} pages)`)

    if (allAuthUsers.length === 0) {
      return NextResponse.json({ synced: 0, created: 0, updated: 0, auth_total: 0, message: 'Tidak ada user di Supabase Auth' })
    }

    // ── Step 2: Get existing profile IDs from Supabase profiles table ──
    const svc = getSupabaseSvc()
    if (!svc) {
      return NextResponse.json({ error: 'Supabase client tidak tersedia' }, { status: 500 })
    }

    const { data: existingProfiles } = await svc
      .from('profiles')
      .select('id, email, full_name, email_verified')

    const existingMap = new Map<string, any>()
    if (existingProfiles) {
      for (const p of existingProfiles) {
        existingMap.set(p.id, p)
      }
    }
    console.log(`✅ [SYNC] Found ${existingMap.size} existing profiles in Supabase`)

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
          const needsUpdate =
            existing.email !== authEmail ||
            existing.full_name !== authName ||
            existing.email_verified !== emailVerified

          if (needsUpdate) {
            await svc.from('profiles').update({
              email: authEmail,
              full_name: authName,
              email_verified: emailVerified,
              updated_at: new Date().toISOString(),
            }).eq('id', userId)
            updated++
          } else {
            skipped++
          }
        } else {
          await svc.from('profiles').insert({
            id: userId,
            email: authEmail,
            full_name: authName,
            email_verified: emailVerified,
            updated_at: new Date().toISOString(),
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
      message: `Sinkronisasi selesai! ${created} user baru, ${updated} diperbarui.`,
      auth_total: allAuthUsers.length,
      db_total: existingMap.size + created,
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
