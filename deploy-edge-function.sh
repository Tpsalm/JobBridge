#!/usr/bin/env bash
# Run this once to deploy the welcome email edge function
# Prerequisites: Supabase CLI installed, RESEND_API_KEY set as supabase secret
set -e

echo "Deploying send-welcome-email edge function..."

# Login (runs browser-based auth)
npx supabase login

# Link to project (replace with your project ref)
npx supabase link --project-ref ppramomuckkjzssrfghi

# Set Resend API key secret
echo "Enter your Resend API key (get one free at resend.com):"
read -s RESEND_KEY
npx supabase secrets set RESEND_API_KEY="$RESEND_KEY"

# Deploy
npx supabase functions deploy send-welcome-email --no-verify-jwt

echo "Done! Welcome emails will now be sent on signup."
