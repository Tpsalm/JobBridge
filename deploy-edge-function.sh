#!/usr/bin/env bash
# Deploy Supabase Edge Functions and set secrets
# Prerequisites: Supabase CLI installed (npm install -g supabase)
set -e

echo "=== JobBridge Edge Function Deployment ==="
echo ""

# ── Configuration ────────────────────────────────────────────────
PROJECT_REF="ppramomuckkjzssrfghi"
# ────────────────────────────────────────────────────────────────

echo "1/4 — Logging into Supabase..."
npx supabase login

echo ""
echo "2/4 — Linking to project $PROJECT_REF..."
npx supabase link --project-ref "$PROJECT_REF"

echo ""
echo "3/4 — Setting secrets..."
echo ""
echo "Enter your KoraPay SECRET KEY (starts with sk_live_):"
echo "  Get it at https://dashboard.korapay.com/settings/api-keys"
read -s KORA_SECRET
npx supabase secrets set VITE_KORA_SECRET_KEY="$KORA_SECRET"

echo ""
echo "Enter your RESEND_API_KEY for emails (press Enter to skip):"
echo "  Get one free at https://resend.com"
read -s RESEND_KEY
if [ -n "$RESEND_KEY" ]; then
  npx supabase secrets set RESEND_API_KEY="$RESEND_KEY"
fi

echo ""
echo "Enter your DEEPSEEK_API_KEY for AI Resume & Cover Letter (press Enter to skip):"
echo "  Get one at https://platform.deepseek.com/api_keys"
read -s DEEPSEEK_KEY
if [ -n "$DEEPSEEK_KEY" ]; then
  npx supabase secrets set DEEPSEEK_API_KEY="$DEEPSEEK_KEY"
fi

echo ""
echo "4/4 — Deploying all 9 Edge Functions..."
echo ""

# Payment & processing
npx supabase functions deploy kora-webhook --no-verify-jwt
npx supabase functions deploy verify-payment --no-verify-jwt

# Email system
npx supabase functions deploy send-welcome-email --no-verify-jwt
npx supabase functions deploy send-email --no-verify-jwt
npx supabase functions deploy process-email-queue --no-verify-jwt

# Email tracking
npx supabase functions deploy track-click --no-verify-jwt
npx supabase functions deploy track-open --no-verify-jwt

# AI operations
npx supabase functions deploy ai-operations --no-verify-jwt

# Admin
npx supabase functions deploy admin-create-user --no-verify-jwt

echo ""
echo "=== ✅ Deployment Complete ==="
echo ""
echo "Deployed 9 functions to project $PROJECT_REF"
echo ""
echo "Your webhook URL:"
echo "  https://$PROJECT_REF.supabase.co/functions/v1/kora-webhook"
echo ""
echo "Configure this URL in your KoraPay dashboard under Webhook Settings:"
echo "  https://dashboard.korapay.com/settings/webhooks"
echo ""
echo "Then verify the webhook sends a test ping — KoraPay will display"
echo "a green checkmark if your endpoint responds correctly."
echo ""
echo "Functions deployed:"
echo "  - kora-webhook         (payment webhook from KoraPay)"
echo "  - verify-payment       (verify payment status)"
echo "  - send-welcome-email   (welcome email on signup)"
echo "  - send-email           (general email sender with tracking)"
echo "  - process-email-queue  (email queue processor with retry)"
echo "  - track-click          (email link click tracking)"
echo "  - track-open           (email open tracking pixel)"
echo "  - ai-operations        (AI chat, resume, cover letter)"
echo "  - admin-create-user    (admin user creation)"
echo ""
echo "Pending database migrations (run in Supabase SQL Editor):"
echo "  - supabase/migrations/20260728_001_add_profile_sections.sql"
echo "  - supabase/migrations/20260728_002_add_advertisements_rls_policy.sql"
