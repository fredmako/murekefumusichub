-- Migration 014: Manual M-Pesa checkout approval flow
-- Adds payment reference support to purchases and introduces pending payment submissions.

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS payment_ref TEXT;

COMMENT ON COLUMN public.purchases.payment_ref IS
  'External payment reference code (e.g., M-Pesa transaction code).';

CREATE TABLE IF NOT EXISTS public.payment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_batch_id UUID NOT NULL DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  composition_id UUID NOT NULL REFERENCES public.compositions(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  mpesa_code VARCHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  purchase_id UUID REFERENCES public.purchases(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_submissions_buyer_id
  ON public.payment_submissions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_composition_id
  ON public.payment_submissions(composition_id);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_status
  ON public.payment_submissions(status);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_submitted_at
  ON public.payment_submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_checkout_batch_id
  ON public.payment_submissions(checkout_batch_id);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_mpesa_code
  ON public.payment_submissions(mpesa_code);

-- Avoid duplicate pending requests for the same composition by the same buyer.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_submissions_pending_unique
  ON public.payment_submissions(buyer_id, composition_id)
  WHERE status = 'pending';

-- Ensure one purchase can only be linked to one submission row.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_submissions_purchase_unique
  ON public.payment_submissions(purchase_id)
  WHERE purchase_id IS NOT NULL;

ALTER TABLE public.payment_submissions DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.payment_submissions IS
  'Manual payment submissions awaiting admin review/approval before purchase activation.';
COMMENT ON COLUMN public.payment_submissions.checkout_batch_id IS
  'Groups multiple composition submissions from the same checkout action.';
COMMENT ON COLUMN public.payment_submissions.mpesa_code IS
  'M-Pesa transaction code entered by the buyer.';
COMMENT ON COLUMN public.payment_submissions.status IS
  'Approval state of the submitted payment: pending, approved, or rejected.';
