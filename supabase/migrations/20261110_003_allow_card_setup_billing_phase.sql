-- Card setup is a persisted payment phase in the provider card-subscription
-- flow. Keep the existing phases valid while allowing that setup charge.
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_billing_phase_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_billing_phase_check
  CHECK (
    billing_phase IS NULL
    OR billing_phase IN ('initial', 'renewal', 'retry', 'manual', 'card_setup')
  );
