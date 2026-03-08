-- Migration 023: Create buyer preferences table for marketplace recommendations.

CREATE TABLE IF NOT EXISTS public.buyer_preferences (
  id BIGSERIAL PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category_id BIGINT NOT NULL,
  weight NUMERIC(10, 2) NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT buyer_preferences_unique_buyer_category UNIQUE (buyer_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_buyer_preferences_buyer_id
  ON public.buyer_preferences(buyer_id);

CREATE INDEX IF NOT EXISTS idx_buyer_preferences_category_id
  ON public.buyer_preferences(category_id);

ALTER TABLE public.buyer_preferences DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_buyer_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS buyer_preferences_updated_at_trigger ON public.buyer_preferences;
CREATE TRIGGER buyer_preferences_updated_at_trigger
BEFORE UPDATE ON public.buyer_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_buyer_preferences_updated_at();

COMMENT ON TABLE public.buyer_preferences IS
  'Stored category weighting preferences used to improve buyer marketplace recommendations.';
