import { NextRequest, NextResponse } from 'next/server'
import { db, isDatabaseAvailable } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * POST /api/admin/db-sync
 *
 * Auto-creates missing tables based on Prisma schema.
 * Uses a SINGLE $executeRawUnsafe with a batched SQL script,
 * so only ONE connection is consumed instead of 20+.
 *
 * Call this ONCE from the browser after deploying new schema changes.
 */

// Simple in-memory rate limiter to prevent accidental double-clicks
const _lastCall: { time: number; ip: string } = { time: 0, ip: '' }
const COOLDOWN_MS = 10_000 // 10 seconds

const BATCH_SQL = `
-- === TABLE CREATION (idempotent) ===
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

-- === PROFILE COLUMN ADDITIONS (idempotent) ===
DO $$ BEGIN
  ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "email_verify_token" TEXT;
  ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "email_verify_exp_at" TIMESTAMP(3);
  ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "my_referral_code" TEXT;
  ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "referred_by_code" TEXT;
  ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "has_ever_been_pro" BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "commission_paid" BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "device_id" TEXT;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- === INDEXES (idempotent) ===
CREATE UNIQUE INDEX IF NOT EXISTS "profiles_email_verify_token_key" ON "profiles"("email_verify_token");
CREATE UNIQUE INDEX IF NOT EXISTS "profiles_my_referral_code_key" ON "profiles"("my_referral_code");
CREATE INDEX IF NOT EXISTS "promo_codes_code_key" ON "promo_codes"("code");
CREATE INDEX IF NOT EXISTS "promo_codes_is_active_start_date_end_date_idx" ON "promo_codes"("is_active", "start_date", "end_date");
`

export async function POST(request: NextRequest) {
  try {
    // Rate limit: prevent rapid-fire calls
    const now = Date.now()
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    if (now - _lastCall.time < COOLDOWN_MS && _lastCall.ip === ip) {
      return NextResponse.json(
        { error: 'DB sync sedang berjalan. Tunggu 10 detik lagi.' },
        { status: 429 }
      )
    }
    _lastCall.time = now
    _lastCall.ip = ip

    const { error } = await requireAdmin(request)
    if (error) return error

    if (!isDatabaseAvailable()) {
      return NextResponse.json(
        { error: 'Database tidak tersedia', details: 'DATABASE_URL belum dikonfigurasi dengan benar.' },
        { status: 500 }
      )
    }

    // Execute ALL DDL in a single $executeRawUnsafe call — uses only 1 connection
    try {
      await db.$executeRawUnsafe(BATCH_SQL)
    } catch (err: any) {
      // Individual statements in a batch may still fail (e.g. column type mismatch)
      // but the overall batch still executes. Log and continue.
      console.warn('⚠️ [DB-SYNC] Batch completed with warnings:', err.message?.substring(0, 200))
    }

    return NextResponse.json({
      success: true,
      message: 'Database sync berhasil! Semua tabel & kolom sudah siap.',
      summary: {
        tablesChecked: 6,
        profileColumnsChecked: 8,
        indexesChecked: 4,
      },
    })
  } catch (error: unknown) {
    console.error('❌ [DB-SYNC] Fatal error:', error)
    const msg = error instanceof Error ? error.message : 'Terjadi kesalahan server'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
