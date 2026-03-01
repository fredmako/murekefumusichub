-- Create compositions table with proper relationships
-- This table stores all compositions and relates to composers
CREATE TABLE IF NOT EXISTS public.compositions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  composer_id UUID NOT NULL REFERENCES public.composers(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) DEFAULT 0,
  difficulty VARCHAR(50),
  duration VARCHAR(50),
  language VARCHAR(50),
  accompaniment VARCHAR(255),
  voice_parts TEXT[], -- Array of voice parts
  pdf_url TEXT, -- URL to the PDF file in Supabase Storage
  is_published BOOLEAN DEFAULT TRUE,
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_compositions_composer_id ON public.compositions(composer_id);
CREATE INDEX IF NOT EXISTS idx_compositions_deleted ON public.compositions(deleted);
CREATE INDEX IF NOT EXISTS idx_compositions_is_published ON public.compositions(is_published);
CREATE INDEX IF NOT EXISTS idx_compositions_created_at ON public.compositions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compositions_title ON public.compositions(title);

-- Disable RLS (backend uses service role key)
ALTER TABLE public.compositions DISABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON TABLE public.compositions IS 'Stores all compositions uploaded by composers.';
COMMENT ON COLUMN public.compositions.composer_id IS 'Foreign key to composers table. Establishes one-to-many relationship.';
COMMENT ON COLUMN public.compositions.voice_parts IS 'Array of voice parts e.g., [''Soprano'', ''Alto'', ''Tenor'', ''Bass'']';
COMMENT ON COLUMN public.compositions.pdf_url IS 'Public URL to PDF stored in Supabase Storage under compositions bucket';
