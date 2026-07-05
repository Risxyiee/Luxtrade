import { NextRequest, NextResponse } from 'next/server'
import { db, isDatabaseAvailable } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * POST /api/admin/db-sync
 *
 * Auto-creates missing tables based on Prisma schema.
 * Uses CREATE TABLE IF NOT EXISTS so it's safe to run multiple times.
 * Call this ONCE from the browser after deploying new schema changes.
 */
export async function POST(request: NextRequest) {
  try {
    const { error } = await requireAdmin(request)
    if (error) return error

    if (!isDatabaseAvailable()) {
      return NextResponse.json(
        { error: 'Database tidak tersedia', details: 'DATABASE_URL belum dikonfigurasi dengan benar.' },
        { status: 500 }
      )
    }

    const results: { table: string; status: string; detail?: string }[] = []

    // List of tables that might be missing — only create if not exist
    const tables: { name: string; sql: string }[] = [
      {
        name: 'email_broadcasts',
        sql: `
          CREATE TABLE IF NOT EXISTS "email_broadcasts" (
            "id" TEXT NOT NULL,
            "target" TEXT NOT NULL,
            "subject" TEXT NOT NULL,
            "sent_count" INTEGER NOT NULL DEFAULT 0,
            "failed_count" INTEGER NOT NULL DEFAULT 0,
            "sent_by" TEXT,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "email_broadcasts_pkey" PRIMARY KEY ("id")
          );
        `,
      },
      {
        name: 'promo_codes',
        sql: `
          CREATE TABLE IF NOT EXISTS "promo_codes" (
            "id" TEXT NOT NULL,
            "code" TEXT NOT NULL,
            "description" TEXT,
            "discount_percent" DOUBLE PRECISION NOT NULL,
            "max_quota" INTEGER NOT NULL,
            "used_quota" INTEGER NOT NULL DEFAULT 0,
            "duration_months" INTEGER NOT NULL,
            "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "end_date" TIMESTAMP(3),
            "is_active" BOOLEAN NOT NULL DEFAULT true,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
          );
        `,
      },
      {
        name: 'user_subscriptions',
        sql: `
          CREATE TABLE IF NOT EXISTS "user_subscriptions" (
            "id" TEXT NOT NULL,
            "user_id" TEXT NOT NULL,
            "plan" TEXT NOT NULL,
            "status" TEXT NOT NULL DEFAULT 'active',
            "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "end_date" TIMESTAMP(3),
            "promo_code_id" TEXT,
            "discount_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id")
          );
        `,
      },
      {
        name: 'payment_orders',
        sql: `
          CREATE TABLE IF NOT EXISTS "payment_orders" (
            "id" TEXT NOT NULL,
            "user_id" TEXT NOT NULL,
            "invoice_number" TEXT NOT NULL,
            "amount" DOUBLE PRECISION NOT NULL,
            "currency" TEXT NOT NULL DEFAULT 'IDR',
            "plan" TEXT NOT NULL,
            "duration_months" INTEGER,
            "status" TEXT NOT NULL DEFAULT 'PENDING',
            "payment_method" TEXT,
            "payment_channel" TEXT,
            "doku_transaction_id" TEXT,
            "doku_payment_url" TEXT,
            "customer_name" TEXT NOT NULL,
            "customer_email" TEXT NOT NULL,
            "paid_at" TIMESTAMP(3),
            "expired_at" TIMESTAMP(3),
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id")
          );
        `,
      },
      {
        name: 'bug_reports',
        sql: `
          CREATE TABLE IF NOT EXISTS "bug_reports" (
            "id" TEXT NOT NULL,
            "user_id" TEXT NOT NULL,
            "description" TEXT NOT NULL,
            "screenshot_url" TEXT,
            "status" TEXT NOT NULL DEFAULT 'PENDING',
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "bug_reports_pkey" PRIMARY KEY ("id")
          );
        `,
      },
      {
        name: 'withdrawals',
        sql: `
          CREATE TABLE IF NOT EXISTS "withdrawals" (
            "id" TEXT NOT NULL,
            "user_id" TEXT NOT NULL,
            "amount" DOUBLE PRECISION NOT NULL,
            "bank_name" TEXT NOT NULL,
            "bank_account" TEXT NOT NULL,
            "bank_holder" TEXT NOT NULL,
            "status" TEXT NOT NULL DEFAULT 'pending',
            "admin_note" TEXT,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
          );
        `,
      },
    ]

    // Also add missing columns to profiles table
    const profileColumns = [
      `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false;`,
      `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "email_verify_token" TEXT;`,
      `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "email_verify_exp_at" TIMESTAMP(3);`,
      `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "my_referral_code" TEXT;`,
      `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "referred_by_code" TEXT;`,
      `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "has_ever_been_pro" BOOLEAN NOT NULL DEFAULT false;`,
      `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "commission_paid" BOOLEAN NOT NULL DEFAULT false;`,
      `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "device_id" TEXT;`,
    ]

    // Create missing tables
    for (const tbl of tables) {
      try {
        await db.$executeRawUnsafe(tbl.sql)
        results.push({ table: tbl.name, status: 'created_or_exists' })
      } catch (err: any) {
        // If table already exists, Prisma may still throw — check message
        if (err?.message?.includes('already exists')) {
          results.push({ table: tbl.name, status: 'already_exists' })
        } else {
          results.push({ table: tbl.name, status: 'error', detail: err.message })
          console.error(`❌ [DB-SYNC] Error creating ${tbl.name}:`, err.message)
        }
      }
    }

    // Add missing columns to profiles
    let profileResults = 0
    let profileErrors = 0
    for (const colSql of profileColumns) {
      try {
        await db.$executeRawUnsafe(colSql)
        profileResults++
      } catch (err: any) {
        // "already exists" is fine
        if (!err?.message?.includes('already exists')) {
          profileErrors++
          console.warn('⚠️ [DB-SYNC] Column alter warning:', err.message)
        }
      }
    }

    // Create indexes
    const indexes = [
      `CREATE UNIQUE INDEX IF NOT EXISTS "profiles_email_verify_token_key" ON "profiles"("email_verify_token");`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "profiles_my_referral_code_key" ON "profiles"("my_referral_code");`,
      `CREATE INDEX IF NOT EXISTS "promo_codes_code_key" ON "promo_codes"("code");`,
      `CREATE INDEX IF NOT EXISTS "promo_codes_is_active_start_date_end_date_idx" ON "promo_codes"("is_active", "start_date", "end_date");`,
    ]

    for (const idxSql of indexes) {
      try {
        await db.$executeRawUnsafe(idxSql)
      } catch (err: any) {
        // Ignore index creation errors (might already exist or column missing)
        if (!err?.message?.includes('already exists')) {
          console.warn('⚠️ [DB-SYNC] Index warning:', err.message)
        }
      }
    }

    const errors = results.filter(r => r.status === 'error')
    const created = results.filter(r => r.status === 'created_or_exists' && !r.detail)
    const existed = results.filter(r => r.status === 'already_exists')

    return NextResponse.json({
      success: errors.length === 0,
      message: errors.length === 0
        ? 'Database sync berhasil! Semua tabel & kolom sudah siap.'
        : `${errors.length} error terjadi. Cek detail di bawah.`,
      summary: {
        tablesChecked: tables.length,
        tablesCreated: created.length,
        tablesAlreadyExisted: existed.length,
        profileColumnsAdded: profileResults,
        profileErrors,
      },
      results,
    })
  } catch (error: unknown) {
    console.error('❌ [DB-SYNC] Fatal error:', error)
    const msg = error instanceof Error ? error.message : 'Terjadi kesalahan server'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}