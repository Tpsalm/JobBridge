-- =========================================================================
-- JobBridge: Add AI usage tracking column to profiles
-- =========================================================================
-- Adds ai_uses column to track how many AI resume generations a user has
-- used. Each subscription period grants 2 uses. Column is decremented on
-- each AI resume generation or cover letter generation.
-- =========================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_uses INTEGER DEFAULT 2;

-- Update existing active AI subscribers to have 2 uses
UPDATE public.profiles
SET ai_uses = 2
WHERE subscription_tier = 'ai_tools'
  AND is_premium = true
  AND (subscription_expires_at IS NULL OR subscription_expires_at > now())
  AND (ai_uses IS NULL OR ai_uses < 0);