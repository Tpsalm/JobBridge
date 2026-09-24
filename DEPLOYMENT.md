# JobBridge Deployment Guide

## Architecture

```
Browser ───► Supabase (Auth, Database, Storage)
               │
               ├── OpenAI API (optional, for AI features)
               └── WebSocket service (persistent notification fan-out)
```

The Express backend is **no longer needed**. The frontend uses Supabase directly, while notifications use a separate persistent Node WebSocket service.

## WebSocket notification service

Deploy the repository as a persistent Railway service using `railway.json`. Set these Railway variables:

| Variable | Value |
|---|---|
| `NOTIFICATION_WS_PORT` | `3001` |
| `JOBBRIDGE_WS_ADMIN_KEY` | A long random value shared only with Vercel |
| `JOBBRIDGE_WS_SHARED_SECRET` | A long random value used by authenticated clients |

Expose the service at `https://ws.jobbridge.com.ng` with WebSocket upgrade support. The public endpoints are `wss://ws.jobbridge.com.ng/ws/notifications` and `https://ws.jobbridge.com.ng/health`.

---

## Step 1: Run the SQL Migration

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard) → SQL Editor
2. Open and run `supabase_migration.sql`
3. This creates: `profiles`, `jobs`, `applications`, `payments`, `blog_subscribers` tables + storage bucket `resumes`

## Step 2: Deploy Frontend to Vercel

1. Push repo to GitHub
2. Go to [Vercel Dashboard](https://vercel.com) → Add New → Project
3. Connect your GitHub repo
4. **Framework Preset:** Vite
5. **Build Command:** `npm run build`
6. **Output Directory:** `dist`

7. Add these **Environment Variables**:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://gtstcstmezfiepzlvndt.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key (already in `.env`) |
| `VITE_PAYSTACK_PUBLIC_KEY` | (Optional) Paystack public key for payments |
| `VITE_WS_URL` | `wss://ws.jobbridge.com.ng/ws/notifications` |
| `NOTIFICATION_WS_URL` | `https://ws.jobbridge.com.ng` |
| `JOBBRIDGE_WS_ADMIN_KEY` | The same admin key configured on the WebSocket service |

**Important:** Do NOT add OpenAI API key to Vercel environment variables. Instead, set it as a Supabase secret. See [AI_SETUP.md](./AI_SETUP.md) for details.

8. Deploy and redeploy after changing any environment variable.

Never commit private keys or production secrets. Use Vercel and Railway environment settings for server-side secrets.

## Step 3: Set up Supabase Auth

1. Go to Supabase Dashboard → Authentication → Providers
2. Ensure **Email** provider is enabled
3. (Optional) Enable **Phone** or **Magic Link** as needed
4. Under Authentication → Settings, set **Site URL** to your Vercel URL
5. Add your Vercel URL to **Redirect URLs** (e.g. `https://job-bridgee.vercel.app/**`)

## Step 5: Enable AI Features (Optional but Recommended)

To enable the AI Resume Builder, Cover Letter Generator, and AI Assistant:

1. Get an OpenAI API key from [platform.openai.com](https://platform.openai.com/api-keys)
2. Set it as a Supabase secret (NOT in Vercel environment variables):
   - Via Dashboard: Supabase → Settings → Secrets → Add `OPENAI_API_KEY`
   - Via CLI: `supabase secrets set OPENAI_API_KEY=sk_live_...`
3. Deploy the AI function: `supabase functions deploy ai-operations`

**Important:** Never expose API keys to the client. See [AI_SETUP.md](./AI_SETUP.md) for complete details.

## Step 6: Enable MFA (Optional)

1. Supabase Dashboard → Authentication → Providers → MFA
2. Toggle on **Enable MFA**
3. Users can manage authenticator apps from their Settings page

## Step 7: Verify

1. Visit your Vercel URL
2. Sign up, log in, post jobs, apply to jobs — all flows go directly through Supabase
3. No Express backend required

## Troubleshooting

**"relation 'profiles' does not exist"** → Run the SQL migration in Supabase SQL Editor
**"Auth session not found"** → Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in Vercel
**File upload fails** → Confirm the `resumes` storage bucket was created by the migration
