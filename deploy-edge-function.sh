#!/usr/bin/env bash
# Deploy Supabase Edge Functions and set secrets
# Prerequisites: Supabase CLI installed (npm install -g supabase)
set -e

echo "=== JobBridge Edge Function Deployment ==="
echo ""

# ── Configuration ────────────────────────────────────────────────
PROJECT_REF="gtstcstmezfiepzlvndt"
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
echo "Enter your RESEND_API_KEY for welcome emails (press Enter to skip):"
echo "  Get one free at https://resend.com"
read -s RESEND_KEY
if [ -n "$RESEND_KEY" ]; then
  npx supabase secrets set RESEND_API_KEY="$RESEND_KEY"
fi

echo ""
echo "4/4 — Deploying Edge Functions..."
npx supabase functions deploy kora-webhook --no-verify-jwt
npx supabase functions deploy send-welcome-email --no-verify-jwt
npx supabase functions deploy send-email --no-verify-jwt

echo ""
echo "=== ✅ Deployment Complete ==="
echo ""
echo "Your webhook URL:"
echo "  https://$PROJECT_REF.supabase.co/functions/v1/kora-webhook"
echo ""
echo "Configure this URL in your KoraPay dashboard under Webhook Settings:"
echo "  https://dashboard.korapay.com/settings/webhooks"
echo ""
echo "Then verify the webhook sends a test ping — KoraPay will display"
echo "a green checkmark if your endpoint responds correctly."
