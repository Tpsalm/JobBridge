# AI Services Setup & Configuration Guide

## Important Security Notice ⚠️

**NEVER expose API keys to the frontend!** This is a critical security vulnerability.

JobBridge uses the same-origin Vercel `/api/broadcast?endpoint=ai` endpoint and the Supabase `ai-operations` Edge Function as a fallback. Both use the official Google Gemini API. Provider API keys are stored **server-side only** and never exposed to the browser.

---

## Architecture

```
User Browser
   ↓
Vercel /api/broadcast?endpoint=ai
   ├─ Validates request type and size
   ├─ Enforces AI subscription access for resume and cover-letter generation
   ├─ Proxies Joba and resume requests to Gemini Flash
   └─ Returns results to browser

If the Vercel endpoint is unavailable:
User Browser → Supabase Edge Function (ai-operations) → Gemini Flash
```

---

## Setup Steps

### 1. Get Your API Key

#### Google Gemini (Recommended)

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign up or log in
3. Create an API key
4. Keep it **SAFE** — treat it like a password. Gemini free-tier quotas and model availability are controlled by Google and may change.

### 2. Set Up Supabase Secrets

Your API key goes into **Supabase Secrets** (for the Edge Function) and/or a server-only **Vercel Environment Variable** (for the fallback). Never use a `VITE_` prefix for a provider key or commit a key to `.env`.

#### For Local Development:

1. Create a `.env.local` file in your project root (or add to existing one):

```bash
# .env.local (DO NOT COMMIT THIS FILE)
GEMINI_API_KEY=your_google_ai_studio_key
GEMINI_MODEL=gemini-flash-lite-latest
```

2. Run Supabase locally (if testing Edge Functions locally):

```bash
supabase start
```

#### For Production:

1. Set `GEMINI_API_KEY` and `GEMINI_MODEL=gemini-flash-lite-latest` as **server-only** Vercel environment variables for the consolidated `/api/broadcast` endpoint. Do not prefix the key with `VITE_`.
2. Set `SUPABASE_SERVICE_ROLE_KEY` as a server-only Vercel variable. The handler also needs `SUPABASE_URL` and `SUPABASE_ANON_KEY`; it accepts the existing public `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` values when the server-only aliases are not set.
3. For the Edge Function fallback, confirm it will be deployed to the same Supabase project configured in the live website, then set `GEMINI_API_KEY` and `GEMINI_MODEL=gemini-flash-lite-latest` and deploy `ai-operations` and `ai-resume`.
4. Set `OPENAI_API_KEY` as a server-side variable only if embedding requests are needed.
5. Keep browser configuration limited to the public Supabase URL and anon/publishable key.

Set Supabase secrets via CLI or dashboard:

**Option 1: Using Supabase Dashboard**

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Settings** → **Secrets**
4. Click **Add new secret**
5. Name: `OPENAI_API_KEY`
6. Value: `sk_live_...` (your actual key)
7. **Save**

**Option 2: Using Supabase CLI**

```bash
# Install/update Supabase CLI
npm install -g supabase

# Link your project
supabase link --project-ref your_project_ref

# Set the secret
supabase secrets set OPENAI_API_KEY=sk_live_your_key

# Verify it was set
supabase secrets list
```

### 3. Deploy Edge Functions

The AI operations edge function is pre-configured at:
```
supabase/functions/ai-operations/index.ts
```

To deploy it:

```bash
# Push functions to Supabase
supabase functions deploy ai-operations
```

### 4. Verify Setup

Test that the AI service is working:

```bash
# Test with curl (or use Postman)
curl -X POST https://your-project.supabase.co/functions/v1/ai-operations \
  -H "Authorization: Bearer your-anon-key" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "chat",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

The website uses `/api/broadcast?endpoint=ai` as its primary same-origin endpoint and falls back to Supabase Edge Functions when appropriate. Both backends validate request types and payload sizes, and neither returns provider credentials. Resume and cover-letter requests require an authenticated user with a currently active AI Career Tools subscription. A missing server key produces a visible setup error rather than a fake successful response.

Expected response:
```json
{
  "ok": true,
  "result": "Hello! How can I help..."
}
```

---

## What Gets Enabled

Once configured, these features automatically work:

✅ **AI Resume Builder** - Generate tailored resumes
✅ **Cover Letter Generator** - Create customized cover letters
✅ **AI Chat Assistant** - Get career guidance
✅ **Skills Extraction** - AI analyzes your background
✅ **Resume Optimization** - Keyword matching for ATS

All without users ever seeing or providing an API key.

---

## Environment Variables Explained

### Frontend (Safe to expose - `.env` or Vercel):
- `VITE_SUPABASE_URL` - Your Supabase URL
- `VITE_SUPABASE_ANON_KEY` - Public anon key
- `VITE_PAYSTACK_PUBLIC_KEY` - Paystack public key (if using payments)

### Backend/Supabase Secrets (NEVER expose):
- `GEMINI_API_KEY` - Google Gemini key (server-side only; AI Studio free-tier quotas apply)
- `GEMINI_MODEL` - Gemini model ID (defaults to `gemini-flash-lite-latest`)
- `OPENAI_API_KEY` - Optional embeddings key (server-side only)
- `RESEND_API_KEY` - Email service key (server-side only)

---

## Troubleshooting

### "AI service not configured" error

**Cause:** Gemini key not set in Vercel or Supabase secrets

**Fix:**
1. Verify `GEMINI_API_KEY` exists in the server environment without printing its value.
2. Set `GEMINI_MODEL=gemini-flash-lite-latest` and configure the key in Vercel and Supabase.
3. Redeploy both functions: `supabase functions deploy ai-operations` and `supabase functions deploy ai-resume`
4. Wait 1-2 minutes for the function to update

### "403 Forbidden" error

**Cause:** User doesn't have permission to call the function

**Fix:**
- Ensure VITE_SUPABASE_ANON_KEY is correct in frontend `.env`
- Check Supabase RLS (Row Level Security) policies allow the function call

### "Invalid API key" or unavailable model

**Fix:**
1. Create or rotate the key at [Google AI Studio](https://aistudio.google.com/apikey).
2. Set it as `GEMINI_API_KEY` in both server environments.
3. Confirm the model supports `generateContent`; the default is `gemini-flash-lite-latest`.

---

## Cost Management

### OpenAI Pricing (as of 2024)
- **GPT-4o mini chat:** ~$0.0015 per 1K input tokens
- **Embeddings:** ~$0.02 per 1M tokens
- **Typical resume generation:** $0.01-0.05

### How to Monitor
1. Visit [OpenAI Usage Dashboard](https://platform.openai.com/account/usage/overview)
2. Set spending limits: Account → Billing → Usage limits
3. Enable notifications for overage

### Cost-Saving Tips
- Use smaller models for embeddings (text-embedding-3-small)
- Batch requests when possible
- Cache frequently used embeddings
- Set rate limits on frontend

---

## Local Development

To test AI features locally:

```bash
# 1. Start Supabase locally
supabase start

# 2. Create .env.local with your API key
echo 'OPENAI_API_KEY=sk_live_your_key' > .env.local

# 3. Start Vite dev server
npm run dev

# 4. Test features in http://localhost:5173
```

---

## Security Best Practices

1. **Rotate keys regularly** (every 90 days minimum)
2. **Use API key restrictions** in OpenAI dashboard:
   - Set spending limits
   - Restrict to specific API endpoints
   - Restrict to your IP if possible
3. **Monitor usage** for suspicious activity
4. **Never commit secrets** to git (use `.env.local` and `.gitignore`)
5. **Use separate keys** for dev/staging/production

---

## Support

If you encounter issues:

1. Check logs: `supabase functions fetch ai-operations --logs`
2. Test function: `supabase functions test ai-operations`
3. Contact: jobbridgesupport@gmail.com
