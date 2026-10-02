-- ============================================================================
-- Create push_subscriptions table (if not exists)
-- Run in Supabase SQL Editor
-- ============================================================================

DO $func$ BEGIN
  CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id          text    PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id     text    NOT NULL,
    endpoint    text    NOT NULL UNIQUE,
    p256dh      text    NOT NULL,
    auth        text    NOT NULL,
    user_agent  text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
  );

  -- Index on user_id for fast lookups
  CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions (user_id);

  -- FK to profiles
  BEGIN
    ALTER TABLE public.push_subscriptions
      ADD CONSTRAINT fk_push_subscriptions_user_id
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skip FK push_subscriptions→profiles: %', SQLERRM;
  END;

  -- Enable RLS
  ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

  -- RLS policies
  DROP POLICY IF EXISTS "Users can view own push subscriptions" ON public.push_subscriptions;
  DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON public.push_subscriptions;
  DROP POLICY IF EXISTS "Users can update own push subscriptions" ON public.push_subscriptions;
  DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;

  CREATE POLICY "Users can view own push subscriptions" ON public.push_subscriptions
    FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can insert own push subscriptions" ON public.push_subscriptions
    FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
  CREATE POLICY "Users can update own push subscriptions" ON public.push_subscriptions
    FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);
  CREATE POLICY "Users can delete own push subscriptions" ON public.push_subscriptions
    FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

  -- Grants
  GRANT ALL ON TABLE public.push_subscriptions TO service_role;
  GRANT ALL ON TABLE public.push_subscriptions TO authenticated;

  RAISE NOTICE 'push_subscriptions table created successfully!';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error creating push_subscriptions: %', SQLERRM;
END; $func$;
