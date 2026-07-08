# JobBridge Release Runbook & Checklist

**Release:** Realtime Notifications, Server-Verified Payments, and Secured Admin Console
**Target Environment:** `jobbridge.com.ng` (Production)

---

## Phase 1: Pre-Release & Setup (Owner Notes)
Before beginning the deployment, fill out the release owner notes and perform initial access confirmation.

- [ ] **1.1 Record Release Info:** Fill out the blank spots below:
  - **Production Supabase Project Ref:** `ppramomuckkjzssrfghi` (or verify if different: ____________________)
  - **Vercel Project Name:** `jobbridge` (or verify if different: ____________________)
  - **Commit SHA being deployed:** ____________________
  - **Previous working Vercel deployment ID:** ____________________
  - **Previous working function version/SHA:** ____________________
  - **Release Owner / Deployer:** ____________________
  - **Rollback Approver:** ____________________
- [ ] **1.2 Verify Environment & Access:** Check off each of the following:
  - [ ] I understand that the current fixes are still local and not yet live.
  - [ ] I confirmed that `jobbridge.com.ng` is currently served by **Vercel**.
  - [ ] I confirmed the correct production Supabase project ref is `ppramomuckkjzssrfghi`.
  - [ ] I have write/deploy access to the **GitHub repository**.
  - [ ] I have write/deploy access to the **Vercel project**.
  - [ ] I have access to the **Supabase Dashboard** for the production project.
  - [ ] I have **Supabase CLI** installed locally and logged in.
  - [ ] I have access to all required production keys (anon keys, service-role keys, Korapay secret keys).

---

## Phase 2: Local Configuration & Review
- [ ] **2.1 Configure `admin-config.js`:**
  - [ ] Open the local copy of `admin-config.js`
  - [ ] Verify/Set the production Supabase URL to `https://ppramomuckkjzssrfghi.supabase.co`
  - [ ] Verify/Set the production **anon** key (do NOT place a service-role key here)
  - [ ] Save the file and confirm the content looks like this:
    ```js
    window.__JOBBRIDGE_SUPABASE_URL__ =
      window.__JOBBRIDGE_SUPABASE_URL__ ||
      "https://ppramomuckkjzssrfghi.supabase.co";

    window.__JOBBRIDGE_SUPABASE_ANON_KEY__ =
      window.__JOBBRIDGE_SUPABASE_ANON_KEY__ || "YOUR_REAL_SUPABASE_ANON_KEY";
    ```
- [ ] **2.2 Inspect Risky Local Deletions:**
  - [ ] Check if any of these files were accidentally deleted in your local changes:
    - `public/MrVictor.jpeg`
    - `public/MrVictor1.jpeg.png`
    - `public/data/faq.json`
    - `public/data/site_knowledge.json`
    - `public/images/jobbridge-logo.jpeg`
    - `public/manifest.json`
  - [ ] If any deletions were accidental, restore them using:
    ```sh
    git checkout -- public/MrVictor.jpeg public/MrVictor1.jpeg.png public/data/faq.json public/data/site_knowledge.json public/images/jobbridge-logo.jpeg public/manifest.json
    ```
- [ ] **2.3 Local Build & Typecheck Validation:**
  - [ ] Run typescript compiler check:
    ```sh
    npm run typecheck
    ```
  - [ ] Run local build script:
    ```sh
    npm run build
    ```
  - [ ] Confirm both commands completed successfully without errors.
  - [ ] Verify `admin.html` script references and configs look correct in the built output.

---

## Phase 3: Git Staging, Commit & Push
- [ ] **3.1 Stage Required Files:** Run the command to stage only the necessary changes:
  ```sh
  git add admin.html admin-config.js admin_console_auth_migration.sql notification_events_migration.sql notifications_realtime_migration.sql payment_activation.sql security_rls_migration.sql src/components/Header.tsx src/contexts/AuthContext.tsx src/lib/profileValidation.ts src/lib/supabase.ts src/lib/supabaseQueries.ts src/pages/Notifications.tsx src/pages/Payment.tsx src/pages/Profile.tsx src/pages/Signup.tsx supabase/functions/admin-create-user/index.ts supabase/functions/kora-webhook/index.ts
  ```
- [ ] **3.2 Stage Optional Files (If Desired):**
  - [ ] If you wish to commit the homepage video montage brief:
    ```sh
    git add homepage_video_montage_brief.md
    ```
- [ ] **3.3 Verify Staged Files:** Run this command to inspect the staging area:
  ```sh
  git --no-pager diff --cached --stat
  ```
  - [ ] Confirm that no extraneous files (e.g., `scripts/public/` or env files) are staged.
- [ ] **3.4 Commit and Push:** Run the following commands:
  ```sh
  git commit -m "Ship realtime notifications and secure admin console"
  git push origin main
  ```
- [ ] **3.5 Confirm Remote Head:** Run:
  ```sh
  git rev-parse HEAD
  git rev-parse origin/main
  ```
  - [ ] Confirm that the local `HEAD` matches `origin/main`.

---

## Phase 4: Supabase Database SQL Deployment
- [ ] **4.1 Open Supabase SQL Editor:** Navigate to the SQL Editor in your production Supabase dashboard.
- [ ] **4.2 Confirm Target Database:** Verify that you are connected to the production project `ppramomuckkjzssrfghi`.
- [ ] **4.3 (Prerequisites Check) Apply Base Migrations (If Not Already Applied):**
  - [ ] Check if `supabase_migration.sql` has been run. If not, apply it now.
  - [ ] Check if `profile_migration.sql` has been run. If not, apply it now.
- [ ] **4.4 Apply SQL Migrations in Order:** Copy and run each SQL script in this exact sequence:
  - [ ] Run `security_rls_migration.sql` in the SQL Editor.
  - [ ] Run `payment_activation.sql` in the SQL Editor.
  - [ ] Run `notifications_realtime_migration.sql` in the SQL Editor.
  - [ ] Run `notification_events_migration.sql` in the SQL Editor.
  - [ ] Run `admin_console_auth_migration.sql` in the SQL Editor.
- [ ] **4.5 Verify Execution:** Confirm that all SQL migrations executed successfully with no syntax or constraint errors.

---

## Phase 5: Supabase Edge Functions Deployment
- [ ] **5.1 Link Supabase CLI:** Run this command to link to the production project:
  ```sh
  npx supabase link --project-ref ppramomuckkjzssrfghi
  ```
- [ ] **5.2 Deploy the `kora-webhook` function:** Run:
  ```sh
  npx supabase functions deploy kora-webhook
  ```
- [ ] **5.3 Deploy the `admin-create-user` function:** Run:
  ```sh
  npx supabase functions deploy admin-create-user
  ```
- [ ] **5.4 Verify Function Deployment:** Confirm in the Supabase Dashboard under "Edge Functions" that both functions are active.

---

## Phase 6: Supabase Secrets Configuration
- [ ] **6.1 Configure Environment Secrets for Edge Functions:** Run the command:
  ```sh
  npx supabase secrets set SUPABASE_URL=https://ppramomuckkjzssrfghi.supabase.co SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY KORA_SECRET_KEY=YOUR_KORA_SECRET_KEY
  ```
- [ ] **6.2 Verify Secrets presence for `kora-webhook`:** Check that the function has access to:
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `KORA_SECRET_KEY`
- [ ] **6.3 Verify Secrets presence for `admin-create-user`:** Check that the function has access to:
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`

---

## Phase 7: Vercel Environment Variables Configuration
- [ ] **7.1 Open Vercel Project Settings:** Go to your Vercel Dashboard, select the project for `jobbridge.com.ng`, and navigate to Environment Variables.
- [ ] **7.2 Add/Update Production Env Vars:** Verify that the following keys are set correctly:
  - [ ] `VITE_SUPABASE_URL` = `https://ppramomuckkjzssrfghi.supabase.co`
  - [ ] `VITE_SUPABASE_ANON_KEY` = `YOUR_SUPABASE_ANON_KEY`
  - [ ] `VITE_SUPABASE_FUNCTIONS_URL` = `https://ppramomuckkjzssrfghi.supabase.co/functions/v1`
  - [ ] `VITE_KORA_PUBLIC_KEY` = `YOUR_KORA_PUBLIC_KEY`
- [ ] **7.3 Configure Turnstile Env Var:**
  - [ ] `VITE_TURNSTILE_SITE_KEY` = `YOUR_TURNSTILE_SITE_KEY`
- [ ] **7.4 Review Optional Envs (If Configured):**
  - [ ] `VITE_CHATBASE_ID`
  - [ ] `VITE_OPENAI_API_KEY`
  - [ ] `VITE_DEEPSEEK_API_KEY`
  - [ ] Confirm `VITE_LOCAL_API_URL` is empty or correctly configured for production.
- [ ] **7.5 Save Environment Variables:** Confirm all changes are saved.

---

## Phase 8: Vercel Frontend Deployment
- [ ] **8.1 Trigger Deployment:**
  - [ ] Confirm Vercel auto-deployment has started from the `main` branch push.
  - [ ] If auto-deploy did not trigger, manually initiate a redeploy of the latest commit on the Vercel dashboard.
- [ ] **8.2 Monitor Build Progress:** Wait for the Vercel build to complete.
- [ ] **8.3 Verify Deployment Success:** Confirm the deployment status is "Ready" on Vercel.

---

## Phase 9: Live URL Verification (Smoke Test)
- [ ] **9.1 Test DNS & HTTP Statuses:** Run the following commands:
  ```sh
  curl -I https://jobbridge.com.ng
  curl -I https://www.jobbridge.com.ng
  curl -I https://www.jobbridge.com.ng/admin.html
  ```
  - [ ] Confirm `https://jobbridge.com.ng` returns `200 OK` or `301/308` redirecting to `www`.
  - [ ] Confirm `https://www.jobbridge.com.ng` returns `200 OK`.
  - [ ] Confirm `/admin.html` is reachable and returns `200 OK`.

---

## Phase 10: Frontend Verification on Live Site
Navigate to the production site and complete the following user-story checks:
- [ ] **10.1 Realtime Notifications:**
  - [ ] Sign in as a test applicant.
  - [ ] Check if the header unread badge loads from Supabase.
  - [ ] Go to `/notifications` page and verify it displays actual notification records.
  - [ ] Test marking a single notification as read.
  - [ ] Test marking all notifications as read.
  - [ ] Test deleting a notification.
- [ ] **10.2 Job Alerts:**
  - [ ] Check that job alerts load successfully from the `public.job_alerts` table.
  - [ ] Register a new test user and verify default alerts seed automatically.
  - [ ] Toggle alert enabled/disabled and refresh the page to verify it persists.
  - [ ] Verify that realtime subscription works when alert changes are made.
- [ ] **10.3 Profile Validation:**
  - [ ] Go to the profile page and attempt to update the phone number.
  - [ ] Attempt to update the date of birth.
  - [ ] Attempt to update gender.
  - [ ] Verify that fields are validated and saved correctly to Supabase.
- [ ] **10.4 Korapay Payment Flow:**
  - [ ] Initiate a plan purchase.
  - [ ] Verify a `pending` payment row is created in `public.payments`.
  - [ ] Confirm that the frontend DOES NOT auto-activate the plan upon payment start.
  - [ ] Complete payment, and verify that verification only succeeds when authorized via the server-side callback.
  - [ ] Confirm a verified payment automatically generates a success notification.

---

## Phase 11: Backend Event Verification
- [ ] **11.1 Application Notifications:**
  - [ ] Submit a test application for a job.
  - [ ] Log in as the applicant and verify receipt of an "Application submitted" notification.
  - [ ] Log in as the recruiter/admin and verify receipt of a "New application received" notification.
- [ ] **11.2 Status Change Notifications:**
  - [ ] Change the status of a test application (e.g., from `applied` to `shortlisted`).
  - [ ] Log in as the applicant and verify receipt of the status change notification.
- [ ] **11.3 Job Match Alerts:**
  - [ ] Create or activate a job matching a test user's active job alerts.
  - [ ] Log in as the matching user and verify receipt of a "New job match" notification.
- [ ] **11.4 Profile Completion Milestones:**
  - [ ] Fill out user profile fields to cross the 80% completion mark, and verify a milestone notification is sent.
  - [ ] Complete the profile to 100%, and verify a milestone notification is sent.
  - [ ] Check notifications to ensure NO duplicate milestone notifications are created.
- [ ] **11.5 Webhook Payment Verification:**
  - [ ] Send a mock valid webhook request to `kora-webhook` or trigger a live test payment.
  - [ ] Verify that the webhook changes the payment state to `verified` in `public.payments`.
  - [ ] Verify that the database trigger auto-activates the subscription plan for the user.
  - [ ] Verify that a corresponding notification is created.

---

## Phase 12: Admin Console Verification
- [ ] **12.1 Authenticated Sign-In:**
  - [ ] Navigate to `/admin.html`.
  - [ ] Verify the page requests email/password via a secure auth form.
  - [ ] Confirm that no old hardcoded admin bypass flows are present.
  - [ ] Try logging in with a non-admin account and confirm access is denied.
  - [ ] Log in with a valid admin account and confirm access is granted.
- [ ] **12.2 Dashboard Data Loading:**
  - [ ] Verify that the dashboard loads all relevant tables: Users, Jobs, Applications, Payments, Notifications, Blog Subscribers, and Audit Logs.
- [ ] **12.3 Admin Actions:**
  - [ ] Test creating a user using the `admin-create-user` Edge Function form.
  - [ ] Test drafting a custom notification in the composer.
  - [ ] Test broadcasting a notification.
  - [ ] Test deleting a notification from the dashboard.
  - [ ] Test manually toggling payment status (Verify/Fail/Refund actions).
  - [ ] Test moderating (approving/archiving) a job post.

---

## Phase 13: Final Sign-Off
- [ ] **13.1 Deployment Verification Checklist:**
  - [ ] Git repository contains the release commit on `main`.
  - [ ] Production Supabase database has all 5 SQL migrations applied.
  - [ ] Both Edge Functions are running in production.
  - [ ] Supabase CLI secrets are fully configured.
  - [ ] Vercel environment variables are correct.
  - [ ] Vercel deployed the latest release commit.
  - [ ] `jobbridge.com.ng` loads the new code successfully.
  - [ ] No browser-exposed service-role keys are present in any source files or configurations.
  - [ ] Realtime notifications and job alert functions are fully operational on production.
  - [ ] Server-authoritative payment verification is functional.

---

## Phase 14: Rollback Strategy & Standard Procedures
If any major features fail smoke testing, execute the appropriate rollback procedure below:

### 14.1 Frontend Rollback (If Vercel build/page is broken)
- [ ] **Step 1:** Open Vercel Dashboard.
- [ ] **Step 2:** Select the previous successful deployment and click "Promote to Production" (Rollback).
- [ ] **Step 3:** Verify public site is functional by testing the homepage and basic routes.

### 14.2 Admin Console Rollback (If Admin auth/actions are broken)
- [ ] **Step 1:** Revert frontend deployment in Vercel to previous version.
- [ ] **Step 2:** (If policies are causing DB access issues) Drop the added policies in the SQL Editor:
  ```sql
  DROP POLICY IF EXISTS "Admins can read all notifications" ON public.notifications;
  DROP POLICY IF EXISTS "Admins can read providers" ON public.service_providers;
  DROP POLICY IF EXISTS "Admins can read ads" ON public.advertisements;
  DROP POLICY IF EXISTS "Admins can insert ads" ON public.advertisements;
  DROP POLICY IF EXISTS "Admins can read conversations" ON public.conversations;
  ```

### 14.3 Notifications Rollback (If database triggers/realtime fail)
- [ ] **Step 1:** Revert frontend deployment in Vercel to previous version.
- [ ] **Step 2:** Drop the event triggers to stop notification generation:
  ```sql
  DROP TRIGGER IF EXISTS on_application_created_notify ON public.applications;
  DROP TRIGGER IF EXISTS on_application_status_changed_notify ON public.applications;
  DROP TRIGGER IF EXISTS on_job_created_notify_alerts ON public.jobs;
  DROP TRIGGER IF EXISTS on_job_published_notify_alerts ON public.jobs;
  DROP TRIGGER IF EXISTS on_profile_completion_notify ON public.profiles;
  ```
- [ ] **Step 3:** (Only if realtime subscription is unstable) Remove notifications/alerts from publications:
  ```sql
  ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications;
  ALTER PUBLICATION supabase_realtime DROP TABLE public.job_alerts;
  ```

### 14.4 Job Alerts Rollback
- [ ] **Step 1:** Revert frontend deployment in Vercel.
- [ ] **Step 2:** Drop the job alert notification triggers:
  ```sql
  DROP TRIGGER IF EXISTS on_job_created_notify_alerts ON public.jobs;
  DROP TRIGGER IF EXISTS on_job_published_notify_alerts ON public.jobs;
  ```

### 14.5 Payment Verification Rollback
- [ ] **Step 1:** Roll back the `kora-webhook` Edge Function using the Supabase CLI to deploy the previous working version.
- [ ] **Step 2:** Revert the frontend deployment in Vercel.
- [ ] **Step 3:** Drop the payment activation trigger if it blocks manual reconciliation:
  ```sql
  DROP TRIGGER IF EXISTS on_payment_verified ON public.payments;
  ```

### 14.6 Profile Validation Rollback
- [ ] **Step 1:** Revert frontend deployment in Vercel.
- [ ] **Step 2:** Keep database tables intact to avoid data loss. Prepare a hotfix to relax frontend validation checks in `profileValidation.ts`.

---

## Phase 15: Emergency Rollback & Recovery Checklist
- [ ] **15.1 Quick Rollback Execution:**
  - [ ] Promote previous working deployment on Vercel.
  - [ ] Rollback Edge Functions on Supabase CLI if necessary.
  - [ ] Drop only the affected triggers or policies in SQL Editor (DO NOT run destructive table drops).
- [ ] **15.2 Verify Post-Rollback Site Health:**
  - [ ] Confirm public site homepage loads successfully.
  - [ ] Confirm existing users can sign in.
  - [ ] Verify admin console is either restored to previous version or access is disabled.
- [ ] **15.3 Identify Failing Component:**
  - Check Vercel build logs, Edge Function logs, and database postgres logs to pinpoint if the failure was in the:
    - [ ] Frontend code
    - [ ] SQL trigger/policy logic
    - [ ] Edge Function configuration
    - [ ] Environment variable mismatch
- [ ] **15.4 Plan Hotfix:** Create a separate branch with the fix, validate locally, and repeat the release sequence.
