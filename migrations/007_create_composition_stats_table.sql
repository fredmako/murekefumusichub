-- Create composition_stats table to track views and purchases
CREATE TABLE IF NOT EXISTS public.composition_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  composition_id UUID NOT NULL UNIQUE REFERENCES public.compositions(id) ON DELETE CASCADE,
  views INT DEFAULT 0,
  purchases INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_composition_stats_composition_id ON public.composition_stats(composition_id);

-- Disable RLS
ALTER TABLE public.composition_stats DISABLE ROW LEVEL SECURITY;

-- Add comments
COMMENT ON TABLE public.composition_stats IS 'Tracks statistics (views and purchases) for each composition.';
COMMENT ON COLUMN public.composition_stats.composition_id IS 'Foreign key to compositions table. One-to-one relationship.';
