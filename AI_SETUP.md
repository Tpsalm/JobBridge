# AI Services Setup & Configuration Guide

## Important Security Notice ⚠️

**NEVER expose API keys to the frontend!** This is a critical security vulnerability.

JobBridge uses Supabase Edge Functions as a secure proxy to handle all AI API calls. Your OpenAI (or DeepSeek) API keys are stored **server-side only** and never exposed to the browser.

---

## Architecture

```
User Browser
   ↓
Supabase Edge Function (ai-operations)
   ├─ Handles authentication
   ├─ Proxies to OpenAI/DeepSeek
   └─ Returns results to browser
   ↓
OpenAI API (server-to-server only)
```

---

## Setup Steps

### 1. Get Your API Key

#### Option A: OpenAI (Recommended)

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to **API Keys** → **Create new secret key**
4. Copy your key (starts with `sk_`)
5. Keep it **SAFE** — treat it like a password

#### Option B: DeepSeek

1. Go to [DeepSeek Platform](https://www.deepseek.com/)
2. Sign up or log in
3. Get your API key from account settings
4. Keep it **SAFE**

### 2. Set Up Supabase Secrets

Your API key goes into **Supabase Secrets** (server-side only), NOT into `.env` or Vercel.

#### For Local Development:

1. Create a `.env.local` file in your project root (or add to existing one):

```bash
# .env.local (DO NOT COMMIT THIS FILE)
OPENAI_API_KEY=sk_live_your_actual_key_here
# OR for DeepSeek:
# DEEPSEEK_API_KEY=your_key_here
```

2. Run Supabase locally (if testing Edge Functions locally):

```bash
supabase start
```

#### For Production (Vercel Deployment):

1. Go to your **Supabase Dashboard** → **Settings** → **API**
2. Scroll to **Project API Keys** and copy your API URL and service role key
3. In your **Vercel** project settings → **Environment Variables**:
   - Do **NOT** add OpenAI key here
   - Keep only public variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)

4. Then, set Supabase secrets via CLI or dashboard:

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
- `OPENAI_API_KEY` - OpenAI secret key (server-side only)
- `DEEPSEEK_API_KEY` - DeepSeek secret key (server-side only)
- `RESEND_API_KEY` - Email service key (server-side only)

---

## Troubleshooting

### "AI service not configured" error

**Cause:** OpenAI key not set in Supabase secrets

**Fix:**
1. Verify the key is set: `supabase secrets list`
2. If missing, add it: `supabase secrets set OPENAI_API_KEY=sk_live_...`
3. Redeploy: `supabase functions deploy ai-operations`
4. Wait 1-2 minutes for the function to update

### "403 Forbidden" error

**Cause:** User doesn't have permission to call the function

**Fix:**
- Ensure VITE_SUPABASE_ANON_KEY is correct in frontend `.env`
- Check Supabase RLS (Row Level Security) policies allow the function call

### "Invalid API key" error

**Cause:** OpenAI key is wrong or revoked

**Fix:**
1. Verify key at [OpenAI Platform](https://platform.openai.com/api-keys)
2. Update Supabase secret: `supabase secrets set OPENAI_API_KEY=your_new_key`
3. Redeploy function

### Embedding errors with DeepSeek

DeepSeek doesn't have embeddings API. The system falls back to OpenAI for embeddings even when using DeepSeek for chat.

**Solution:** Set both keys if using DeepSeek:
```bash
supabase secrets set DEEPSEEK_API_KEY=your_deepseek_key
supabase secrets set OPENAI_API_KEY=your_openai_key
```

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
