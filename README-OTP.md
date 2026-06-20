OTP feature - deployment guide

This project includes an OTP system to verify Service Providers and Recruiters on signup.

Files added:
- `supabase/migrations/20260612_007_otps_table.sql` - DB table for OTP storage
- `supabase/functions/send-otp/index.ts` - Supabase Edge Function (Deno) that stores OTP and sends via SendGrid or Twilio
- `src/lib/supabase.ts` - `requestOtp` helper (already added)
- `src/contexts/AuthContext.tsx` - `signUp` now calls `requestOtp` for `recruiter` and `provider`

Deploy steps summary:
1. Apply the migration to your Supabase project (via SQL editor or CLI). This creates `profiles` trigger and `otps` table.
2. Deploy the Edge Functions (`send-otp`, `verify-otp`, `send-welcome`) and set environment variables. See `.env.example` for required vars.
	- Using Supabase CLI example:
	  ```bash
	  npm install -g supabase
	  supabase login
	  cd supabase/functions/send-otp
	  supabase functions deploy send-otp --project-ref <PROJECT_REF> --env-file .env
	  cd ../verify-otp
	  supabase functions deploy verify-otp --project-ref <PROJECT_REF> --env-file .env
	  cd ../send-welcome
	  supabase functions deploy send-welcome --project-ref <PROJECT_REF> --env-file .env
	  ```
3. Configure frontend env variables in your Vite app (see `.env.example`). Ensure `VITE_SUPABASE_FUNCTIONS_URL` and `VITE_SUPABASE_ANON_KEY` are set.
4. Start the frontend and test signup flows for `recruiter` and `provider`:
	- After signup you'll be redirected to `/verify-otp`.
	- Enter the OTP sent via email (SendGrid) or SMS (Twilio).
	- You can click "Resend code" (60s cooldown) to request another OTP.

If you want, I automated the following in the repo:
- `verify-otp` function to validate and mark OTPs used.
- `send-welcome` function to deliver a welcome HTML email (with dashboard CTA).
- Frontend `VerifyOTP` page with resend button (60s cooldown).

Next steps (optional):
- I can prepare a deployment-ready `.env` file with placeholders filled if you provide the secret values.
- I can add HTML templates for SendGrid with branding and images.
- I can add rate-limiting and analytics for OTP sends.