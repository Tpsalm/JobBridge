# ✅ Complete Setup Checklist

## Phase 1: Preparation
- [ ] Read `START_HERE.md`
- [ ] Read `QUICK_REFERENCE.md`
- [ ] Understand the problem/solution (optional: `BEFORE_AFTER_VISUAL.md`)
- [ ] Have access to Supabase project
- [ ] Have access to Vercel/deployment environment

## Phase 2: Get API Key
- [ ] Go to https://platform.openai.com/api-keys
- [ ] Create a new API key (or use existing one)
- [ ] Copy the key (starts with `sk_live_`)
- [ ] Verify key is active (test on OpenAI website)
- [ ] Keep key safe (treat like password)

## Phase 3: Set Supabase Secret

### Option A: Using Dashboard (Recommended)
- [ ] Go to https://app.supabase.com
- [ ] Select your JobBridge project
- [ ] Navigate to **Settings** → **Secrets**
- [ ] Click **Add new secret**
- [ ] Name: `OPENAI_API_KEY` (exact spelling)
- [ ] Value: Paste your API key
- [ ] Click **Save**
- [ ] Verify secret appears in list

### Option B: Using CLI
- [ ] Open terminal/command prompt
- [ ] Run: `supabase link --project-ref your_project_id`
- [ ] Run: `supabase secrets set OPENAI_API_KEY=sk_live_your_key`
- [ ] Verify: `supabase secrets list` shows OPENAI_API_KEY
- [ ] Confirm no errors

## Phase 4: Deploy Edge Function
- [ ] Open terminal in project root
- [ ] Run: `supabase functions deploy ai-operations`
- [ ] Wait for deployment to complete
- [ ] Verify: Function shows as deployed in Supabase dashboard
- [ ] Confirm: No errors during deployment
- [ ] (Optional) Check logs: `supabase functions fetch ai-operations --logs`

## Phase 5: Verify Setup

### Quick Test
- [ ] Open your app in browser
- [ ] Navigate to AI Resume Studio
- [ ] **Verify: No "Enter API Key" prompt appears** ← KEY TEST
- [ ] Try clicking "Generate Resume"
- [ ] **Verify: Resume generates without errors** ← KEY TEST
- [ ] Check browser console (F12) for any errors
- [ ] No 401/403/500 errors in console

### Production Test (if deployed to Vercel/production)
- [ ] Visit production URL
- [ ] Repeat quick test steps above
- [ ] Verify on mobile browser
- [ ] Verify on multiple browsers (Chrome, Firefox, Safari)

## Phase 6: Monitor & Optimize

### Monitor Usage
- [ ] Go to https://platform.openai.com/account/usage/overview
- [ ] Verify usage is being recorded
- [ ] Check tokens used (should be low if just testing)
- [ ] Note: May take 5-10 minutes to appear

### Set Limits (Optional but Recommended)
- [ ] Go to https://platform.openai.com/account/billing/limits
- [ ] Set **Usage limits** to cap monthly spend
- [ ] Example: Set to $20-50 depending on expected usage
- [ ] Enable notifications for overage

### Monitor Errors
- [ ] Check Supabase function logs for errors
- [ ] Monitor browser console for client errors
- [ ] Set up alerts (optional)
- [ ] Create runbook for issues

## Phase 7: Document for Team

- [ ] Share `QUICK_REFERENCE.md` with team
- [ ] Share `START_HERE.md` with stakeholders
- [ ] Add to team wiki/docs
- [ ] Update README.md to mention AI setup
- [ ] Document rollback procedure

## Testing Scenarios

### Test 1: Resume Generation
- [ ] Click "AI Resume Studio"
- [ ] Fill in job title and industry
- [ ] Click "Generate Resume"
- [ ] **Verify: Resume is generated** ✅
- [ ] **Verify: No API key prompt** ✅

### Test 2: Cover Letter Generation
- [ ] Try cover letter generator
- [ ] **Verify: Works without key prompt** ✅

### Test 3: Error Handling
- [ ] If API key is wrong:
  - [ ] System shows clear error message
  - [ ] **Does NOT expose the actual key** ✅
  
### Test 4: Rate Limiting
- [ ] Generate multiple resumes quickly
- [ ] **Verify: System responds appropriately** ✅
- [ ] (Optional: Implement rate limiting in frontend)

### Test 5: Offline/Network Issues
- [ ] Simulate network error
- [ ] **Verify: Shows graceful error message** ✅

## Troubleshooting Checks

### If "AI service not configured" error:
- [ ] Verify Supabase secret is set: `supabase secrets list`
- [ ] Verify secret name is exactly: `OPENAI_API_KEY`
- [ ] Verify secret value starts with: `sk_live_`
- [ ] Redeploy function: `supabase functions deploy ai-operations`
- [ ] Wait 1-2 minutes
- [ ] Try again

### If "403 Forbidden" error:
- [ ] Check `.env` has `VITE_SUPABASE_URL`
- [ ] Check `.env` has `VITE_SUPABASE_ANON_KEY`
- [ ] Verify keys are correct (copy from Supabase)
- [ ] Clear browser cache and hard refresh (Ctrl+Shift+R)

### If "Invalid API key" error:
- [ ] Verify key on OpenAI dashboard
- [ ] Key should show as "Active"
- [ ] Re-copy the key (may have typos)
- [ ] Update Supabase secret with new key
- [ ] Redeploy function

### If "Rate limit exceeded":
- [ ] This means too many requests
- [ ] Verify it's expected (new feature being tested)
- [ ] Can add frontend rate limiting if needed
- [ ] Check OpenAI usage dashboard for cost impact

## Post-Deployment

### Documentation
- [ ] Document setup process for future devs
- [ ] Add to runbook/operations manual
- [ ] Create troubleshooting guide
- [ ] Update DEPLOYMENT.md if needed

### Monitoring
- [ ] Set up daily check of OpenAI usage
- [ ] Set up alerts for errors
- [ ] Monitor user feedback
- [ ] Track feature usage

### Optimization
- [ ] Monitor costs
- [ ] Optimize prompts if needed
- [ ] Add caching if usage is high
- [ ] Consider different models if cost is an issue

## Communication

### Tell Your Team
- [ ] AI Resume feature is now available
- [ ] No API key needed
- [ ] Document any known issues
- [ ] Provide support contact

### Tell Your Users
- [ ] Update feature documentation
- [ ] Announce AI features
- [ ] Include in release notes
- [ ] Highlight in marketing

## Rollback Plan (If Needed)

- [ ] Document how to disable
- [ ] Save old .env files
- [ ] Keep git history clean
- [ ] Can revert with: `git checkout -- src/lib/ragEngine.ts`
- [ ] Can disable with: `supabase functions delete ai-operations --force-delete`

---

## Final Checklist

### Must Have (Before Going Live)
- [ ] ✅ Supabase secret is set
- [ ] ✅ Function is deployed
- [ ] ✅ No "API key" prompts appear
- [ ] ✅ Resume generation works
- [ ] ✅ No errors in console
- [ ] ✅ Tested in production

### Nice to Have (Recommended)
- [ ] ✅ Usage limits are set
- [ ] ✅ Team is trained
- [ ] ✅ Runbook is documented
- [ ] ✅ Monitoring is configured
- [ ] ✅ Users are notified

### Already Done ✅
- [ ] ✅ Backend function created
- [ ] ✅ Frontend updated
- [ ] ✅ Documentation written
- [ ] ✅ Configuration updated
- [ ] ✅ All files in place

---

## Time Estimates

| Task | Time | Notes |
|------|------|-------|
| Read documentation | 5-10 min | Quick version or detailed |
| Get API key | 2 min | Create on OpenAI |
| Set Supabase secret | 2 min | Dashboard or CLI |
| Deploy function | 1 min | Single command |
| Test & verify | 5 min | Quick verification |
| **Total** | **15 min** | End-to-end |

---

## Success Indicators ✅

After completing all steps, you should see:

✅ No API key prompts in AI features
✅ Resume generation works
✅ Cover letter generation works
✅ AI chat assistant works
✅ No errors in browser console
✅ OpenAI usage dashboard shows activity
✅ Features work on mobile
✅ Features work in production
✅ No sensitive keys exposed in code or browser
✅ Cost is under control

---

## Need Help?

1. **Quick Answer:** Check `QUICK_REFERENCE.md`
2. **Setup Issue:** Check `AI_SETUP.md` → Troubleshooting
3. **Understand Solution:** Check `BEFORE_AFTER_VISUAL.md`
4. **Deep Dive:** Check `AI_SETUP.md` (complete guide)
5. **Email Support:** jobbridgesupport@gmail.com

---

## Verification Script (Optional)

Test the setup with this curl command:

```bash
# Set your values
export SUPABASE_URL="https://your-project.supabase.co"
export ANON_KEY="your-anon-key"

# Test the function
curl -X POST "${SUPABASE_URL}/functions/v1/ai-operations" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "chat",
    "messages": [{"role": "user", "content": "Hello"}]
  }'

# Expected response (if working):
# {"ok":true,"result":"Hello! How can I help..."}
```

---

## Sign-Off

When you've completed this checklist:

- [ ] All checks passed ✅
- [ ] System is working ✅
- [ ] Team is informed ✅
- [ ] Documentation is updated ✅
- [ ] Ready for production ✅

**Date Completed:** __________

**Completed By:** __________

**Reviewed By:** __________

---

You're all set! Your AI Resume features are now secure and ready for users! 🎉
