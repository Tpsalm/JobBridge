PR Checklist & Deployment Instructions

1) Summary
- This PR adds server-side fallbacks for email and provider listing, web-push (service worker + client helpers + server endpoints), and a profile UI toggle to subscribe/unsubscribe to browser notifications.

2) Environment variables to configure in Vercel (Production)
- SUPABASE_URL: https://<your>.supabase.co
- SUPABASE_SERVICE_ROLE_KEY: <service_role_key> (server-side only)
- RESEND_API_KEY: <resend_api_key> (server-side only)
- VITE_SUPABASE_URL: same as SUPABASE_URL
- VITE_SUPABASE_ANON_KEY: <anon_key> (client-safe)
- VITE_SUPABASE_FUNCTIONS_URL: optional, e.g., https://<your>.supabase.co/functions/v1
- VAPID_PUBLIC_KEY: <base64url public VAPID key> (used by client)
- VAPID_PRIVATE_KEY: <base64url private VAPID key> (server-side only)

3) Required repo changes already included
- Added `api/get-providers.ts` and `api/send-email.ts` (Vercel serverless functions)
- Added `api/register-push.ts` and `api/send-push.ts` for push subscription storage and send
- Added `public/sw.js` (service worker)
- Added `src/lib/push.ts` (client helpers) and wired registration in `src/main.tsx`
- Added profile toggle in `src/pages/Profile.tsx`
- Updated `src/lib/email.ts` and `src/lib/supabaseQueries.ts` with fallbacks
- Added `web-push` dependency in `package.json`

4) Local testing steps
- Install deps:

```bash
npm ci
```

- Build and serve locally (Vite preview):

```bash
npm run build
npm run preview
# or for dev with fast refresh
npm run dev
```

- Generate VAPID keys (if you don't have them):

```bash
npx web-push generate-vapid-keys --json
```

- Set the generated keys into your local `.env` / Vercel env. For local dev, create `.env` with the VITE_ and non-VITE vars as needed (do NOT commit secrets):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

- Register service worker by opening the site in a browser (production build recommended). Use the Profile page to subscribe/unsubscribe for push.

- Test sending a push via API (replace with real subscription object captured from browser):

```bash
curl -X POST https://<your-vercel-project>.vercel.app/api/send-push \
  -H "Content-Type: application/json" \
  -d '{"subscription": <SUBSCRIPTION_JSON>, "payload": {"title":"Test", "body":"Hello"}}'
```

- Test signup + email delivery:
  - Ensure `RESEND_API_KEY` is set in Vercel.
  - Sign up a new user and verify welcome/profile emails are received.

5) Deployment steps (Vercel)
- Commit and push the branch to GitHub.
- Open Vercel dashboard for the project and add the environment variables listed above under Project Settings → Environment Variables (set on Production and Preview as appropriate).
- Vercel will auto-deploy on push to `main` (or merge PR).
- Once deployed, verify:
  - Signup flow sends welcome email (check Resend dashboard and Vercel logs for `/api/send-email` or Supabase function logs if used).
  - Anonymous users can view Providers listing.
  - Profile page shows Notifications card and subscribe flow works.

6) Post-deploy verification checklist
- [ ] New signup receives welcome email and profile reminder
- [ ] Providers list loads when not signed in
- [ ] Web push subscribe/unsubscribe works and a test push arrives
- [ ] Server logs show no errors for API endpoints

7) Security notes
- Keep `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, and `VAPID_PRIVATE_KEY` server-only (do not expose to clients or commit them)
- Vercel environment variables marked as `Environment` → `Production/Preview` are safe; do not put these in client-side code.

8) Next steps I can implement on request
- Full FCM/APNs integration for Android/iOS/macOS (requires credentials)
- Background job to deliver newsletter and job alerts
- Admin UI to view push subscriptions and send manual notifications

If you want, I can open a PR branch and push these changes, or prepare a GitHub PR patch for you to review. Let me know which you prefer.
