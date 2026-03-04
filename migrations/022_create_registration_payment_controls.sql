-- Migration 022: Registration payment controls for enrollments and composer requests.

CREATE TABLE IF NOT EXISTS public.registration_regulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
  composer_request_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
  bank_name VARCHAR(120) NOT NULL DEFAULT 'I&M Bank',
  bank_account_number VARCHAR(64) NOT NULL DEFAULT '0030 7335 5161 50',
  account_name VARCHAR(160) NOT NULL DEFAULT 'Murekefu Music Hub',
  controlling_admin_identifier VARCHAR(120) NOT NULL DEFAULT 'fredrickmakori102',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_registration_regulations_single_active
  ON public.registration_regulations(is_active)
  WHERE is_active = TRUE;

CREATE OR REPLACE FUNCTION public.update_registration_regulations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS registration_regulations_updated_at_trigger ON public.registration_regulations;
CREATE TRIGGER registration_regulations_updated_at_trigger
BEFORE UPDATE ON public.registration_regulations
FOR EACH ROW
EXECUTE FUNCTION public.update_registration_regulations_updated_at();

CREATE TABLE IF NOT EXISTS public.registration_payment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  registration_type VARCHAR(40) NOT NULL
    CHECK (registration_type IN ('enrollment', 'composer_request')),
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
  payment_ref VARCHAR(96) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT,
  is_consumed BOOLEAN NOT NULL DEFAULT FALSE,
  consumed_for VARCHAR(40)
    CHECK (consumed_for IN ('enrollment', 'composer_request') OR consumed_for IS NULL),
  consumed_target_id UUID,
  consumed_at TIMESTAMP WITH TIME ZONE,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registration_payment_submissions_requester
  ON public.registration_payment_submissions(requester_id);
CREATE INDEX IF NOT EXISTS idx_registration_payment_submissions_status
  ON public.registration_payment_submissions(status);
CREATE INDEX IF NOT EXISTS idx_registration_payment_submissions_type
  ON public.registration_payment_submissions(registration_type);
CREATE INDEX IF NOT EXISTS idx_registration_payment_submissions_submitted_at
  ON public.registration_payment_submissions(submitted_at DESC);

-- One pending submission per user per registration type.
CREATE UNIQUE INDEX IF NOT EXISTS idx_registration_payment_submissions_pending_unique
  ON public.registration_payment_submissions(requester_id, registration_type)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.update_registration_payment_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS registration_payment_submissions_updated_at_trigger ON public.registration_payment_submissions;
CREATE TRIGGER registration_payment_submissions_updated_at_trigger
BEFORE UPDATE ON public.registration_payment_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_registration_payment_submissions_updated_at();

ALTER TABLE public.registration_regulations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_payment_submissions DISABLE ROW LEVEL SECURITY;

INSERT INTO public.registration_regulations (
  enrollment_fee,
  composer_request_fee,
  bank_name,
  bank_account_number,
  account_name,
  controlling_admin_identifier,
  is_active
)
SELECT
  0,
  0,
  'I&M Bank',
  '0030 7335 5161 50',
  'Murekefu Music Hub',
  'fredrickmakori102',
  TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM public.registration_regulations
);

COMMENT ON TABLE public.registration_regulations IS
  'Admin-managed configuration for enrollment/composer registration fees and payout account details.';
COMMENT ON TABLE public.registration_payment_submissions IS
  'Manual payment submissions for enrollment and composer registration fees.';
COMMENT ON COLUMN public.registration_payment_submissions.payment_ref IS
  'Payment confirmation/reference code supplied by the requester.';
