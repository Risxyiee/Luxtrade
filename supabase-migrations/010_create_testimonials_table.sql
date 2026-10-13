-- Testimonials table for user-submitted reviews
CREATE TABLE IF NOT EXISTS public.testimonials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_email TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text TEXT NOT NULL,
  role TEXT,
  profile_image_url TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
  trades_logged INTEGER DEFAULT 0,
  prop_firms_passed INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_testimonials_user_id ON public.testimonials(user_id);
CREATE INDEX IF NOT EXISTS idx_testimonials_status ON public.testimonials(status);
CREATE INDEX IF NOT EXISTS idx_testimonials_rating ON public.testimonials(rating);
CREATE INDEX IF NOT EXISTS idx_testimonials_created_at ON public.testimonials(created_at DESC);

-- RLS Policies
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read approved testimonials
CREATE POLICY "Public read approved testimonials"
  ON public.testimonials FOR SELECT
  USING (status = 'approved');

-- Allow authenticated users to insert their own testimonials
CREATE POLICY "Users can insert testimonials"
  ON public.testimonials FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    status = 'approved'
  );

-- Allow users to update their own testimonials
CREATE POLICY "Users can update own testimonials"
  ON public.testimonials FOR UPDATE
  USING (auth.uid() = user_id);

-- Allow users to delete their own testimonials
CREATE POLICY "Users can delete own testimonials"
  ON public.testimonials FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_testimonials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE TRIGGER trigger_update_testimonials_updated_at
  BEFORE UPDATE ON public.testimonials
  FOR EACH ROW
  EXECUTE FUNCTION update_testimonials_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.testimonials TO authenticated;
GRANT SELECT ON public.testimonials TO anon;

COMMENT ON TABLE public.testimonials IS 'User-submitted testimonials and reviews';
COMMENT ON COLUMN public.testimonials.rating IS '1-5 star rating';
COMMENT ON COLUMN public.testimonials.status IS 'pending: awaiting moderation, approved: visible to public, rejected: hidden';
COMMENT ON COLUMN public.testimonials.is_featured IS 'Featured testimonials are prioritized in display';