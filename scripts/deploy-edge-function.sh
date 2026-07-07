#!/bin/bash
# Deploy Supabase Edge Functions
#
# Prerequisites:
#   1. Install Supabase CLI: npm install -g supabase
#   2. Login: supabase login
#   3. Link project: supabase link --project-ref gtstcstmezfiepzlvndt
#   4. Set secrets: supabase secrets set VITE_KORA_SECRET_KEY=sk_live_xxxxxxxxxxxx
#
# Usage:
#   chmod +x scripts/deploy-edge-function.sh
#   ./scripts/deploy-edge-function.sh

set -e

echo "🚀 Deploying kora-webhook Edge Function..."

# Navigate to project root
cd "$(dirname "$0")/.."

# Deploy the kora-webhook function
npx supabase functions deploy kora-webhook --no-verify-jwt

echo ""
echo "✅ kora-webhook deployed successfully!"
echo ""
echo "📝 Next steps:"
echo "  1. Set the KORA_SECRET_KEY secret:"
echo "     npx supabase secrets set VITE_KORA_SECRET_KEY=sk_live_YOUR_SECRET_KEY"
echo ""
echo "  2. Your webhook URL will be:"
echo "     https://gtstcstmezfiepzlvndt.supabase.co/functions/v1/kora-webhook"
echo ""
echo "  3. Configure this URL in your KoraPay dashboard webhook settings"
echo "     https://dashboard.korapay.com/settings/webhooks"
