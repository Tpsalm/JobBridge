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

# Deploy Kora webhook handler
echo "Deploying kora-webhook edge function..."
echo "Enter your KoraPay Secret Key (starts with sk_):"
read -s KORA_SECRET
npx supabase secrets set VITE_KORA_SECRET_KEY="$KORA_SECRET"
npx supabase functions deploy kora-webhook --no-verify-jwt

echo "Done! Welcome emails and Kora webhooks are deployed."
