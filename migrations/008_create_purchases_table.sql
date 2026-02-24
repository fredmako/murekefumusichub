-- Create purchases table to track composition purchases
CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  composition_id UUID NOT NULL REFERENCES public.compositions(id) ON DELETE CASCADE,
  price_paid DECIMAL(10, 2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_purchases_buyer_id ON public.purchases(buyer_id);
CREATE INDEX IF NOT EXISTS idx_purchases_composition_id ON public.purchases(composition_id);
CREATE INDEX IF NOT EXISTS idx_purchases_is_active ON public.purchases(is_active);
CREATE INDEX IF NOT EXISTS idx_purchases_purchased_at ON public.purchases(purchased_at DESC);

-- Disable RLS
ALTER TABLE public.purchases DISABLE ROW LEVEL SECURITY;

-- Add comments
COMMENT ON TABLE public.purchases IS 'Tracks all purchases of compositions by users.';
COMMENT ON COLUMN public.purchases.buyer_id IS 'Foreign key to users table. The user who purchased the composition.';
COMMENT ON COLUMN public.purchases.composition_id IS 'Foreign key to compositions table. The composition being purchased.';
COMMENT ON COLUMN public.purchases.price_paid IS 'The amount paid for the composition.';
COMMENT ON COLUMN public.purchases.is_active IS 'Whether the purchase is still active/valid.';
