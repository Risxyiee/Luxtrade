CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS "profiles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "email" TEXT,
    "streakCount" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "achievements" JSONB NOT NULL DEFAULT '[]',
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "proExpiry" TIMESTAMP(3),
    "role" TEXT NOT NULL DEFAULT 'USER',
    "full_name" TEXT,
    "is_pro" BOOLEAN NOT NULL DEFAULT false,
    "subscription_until" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "trading_accounts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "broker" TEXT,
    "account_type" TEXT NOT NULL DEFAULT 'STANDARD',
    "account_number" TEXT,
    "initial_balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "current_balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "leverage" INTEGER NOT NULL DEFAULT 100,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "trading_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "trades" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "account_id" UUID,
    "symbol" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "open_price" DOUBLE PRECISION NOT NULL,
    "close_price" DOUBLE PRECISION NOT NULL,
    "lot_size" DOUBLE PRECISION NOT NULL,
    "profit_loss" DOUBLE PRECISION NOT NULL,
    "open_time" TIMESTAMP(3) NOT NULL,
    "close_time" TIMESTAMP(3) NOT NULL,
    "session" TEXT,
    "notes" TEXT,
    "image_url" TEXT,
    "screenshot_url" TEXT,
    "emotion" TEXT,
    "setup_type" TEXT,
    "tags" TEXT,
    "risk_reward_ratio" DOUBLE PRECISION,
    "trade_duration" INTEGER,
    "linked_journal_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);