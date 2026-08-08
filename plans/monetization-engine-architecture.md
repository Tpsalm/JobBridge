# JobBridge Monetization Engine — Architecture Specification

**Version:** 1.0
**Product:** JobBridge (jobbridge.com.ng) — dual-sided marketplace
**Stack:** Supabase (Postgres + RLS + Edge Functions) · Vercel Cron · **KoraPay (NGN) — the sole payment gateway**
**Related implementation:**
- [`supabase/migrations/20260807_002_monetization_engine.sql`](../supabase/migrations/20260807_002_monetization_engine.sql:1)
- [`supabase/functions/billing-daily/index.ts`](../supabase/functions/billing-daily/index.ts:1)
- [`supabase/functions/_shared/korapay-recurring.ts`](../supabase/functions/_shared/korapay-recurring.ts:1)
- [`supabase/functions/_shared/paystack.ts`](../supabase/functions/_shared/paystack.ts:1)
- [`api/billing-cron.ts`](../api/billing-cron.ts:1)

---

## 0. Scope & Design Goals

The platform sells two product lines through one billing core:

| Line | Model | Products | Renewal |
|------|-------|----------|---------|
| **A — Job Board** | Pay-Per-Post | `job_basic` ₦2,000/7d, `job_standard` ₦3,500/14d | One-time, soft-hide on expiry |
| **A — Job Board** | Recurring | `job_premium` ₦5,000/30d | Auto-debit every 30d |
| **B — Service Marketplace** | Recurring | `svc_basic` ₦1,500, `svc_verified` ₦3,000, `svc_featured` ₦5,000 (30d each) | Auto-debit every 30d |

**Phase 1 launch rule:** every tier is priced at ₦0 ("Free at Launch") via a server-side `is_launch_free` flag on the `plans` catalogue, while **preserving** the configured duration, expiry and feature limits. A `promo_codes` table provides a secondary override for future campaigns.

Core invariants:
1. The `plans` table is the **single source of truth** for price, cycle, duration, and limits.
2. The `subscriptions` table is the **single source of truth** for recurring lifecycle state.
3. **Query-time filtering** (not just cron) guarantees expired/hidden content is never served to public feeds.
4. All money mutations are **idempotent** via unique `idempotency_key` / `reference`.

---

## 1. Database Architecture & ERD

### 1.1 ERD

```
auth.users (existing, Supabase)
   │ 1
   │
   ├────< public.subscriptions  ──>── public.plans (catalogue)
   │        │ id, user_id, plan_key, product_line, status,
   │        │ current_period_start, current_period_end,
   │        │ paystack_token_key, kora_card_token_key,
   │        │ auto_renew, launch_free_period, grace_ends_at,
   │        │ failed_retries, next_attempt_at, last_attempt_ref,
   │        │ canceled_at, cancel_reason
   │        │
   │        ├──< public.payments  (billing_phase, failure_code,
   │        │                      idempotency_key, subscription_id)
   │        │
   │        ├──< public.jobs  (post_plan, post_paid, billing_mode,
   │        │                 post_expires_at, grace_ends_at, subscription_id)
   │        │
   │        └──< public.profiles  (is_verified, is_featured,
   │                              service_subscription_id, visibility_until)
   │
   └────< public.profiles (existing) ──< public.service_providers (listing)

public.promo_codes  (admin-managed discount override)
```

Relationships:
- `subscriptions.user_id → auth.users.id` (CASCADE)
- `subscriptions.plan_key → plans.key`
- `payments.subscription_id → subscriptions.id` (SET NULL)
- `jobs.subscription_id → subscriptions.id` (SET NULL)
- `payments.idempotency_key UNIQUE` (idempotency enforcement)

### 1.2 `plans` — Pricing Catalogue

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PK` | |
| `product_line` | `TEXT` | `job_post` \| `service` |
| `key` | `TEXT UNIQUE` | `job_basic`, `job_standard`, `job_premium`, `svc_basic`, `svc_verified`, `svc_featured` |
| `name` | `TEXT` | |
| `base_price_ngn` | `INTEGER ≥ 0` | base price in Naira |
| `billing_cycle` | `TEXT` | `one_time` \| `recurring` |
| `duration_days` | `INTEGER > 0` | visibility/validity length |
| `is_recurring` | `BOOLEAN` | auto-renew flag |
| `is_launch_free` | `BOOLEAN` | **Phase-1 override** → price forced to ₦0 server-side |
| `is_active` | `BOOLEAN` | retired plans hidden from public reads |
| `product_config` | `JSONB` | `{visibility_days, post_allowance, expire_behavior, grace_days, verified, featured}` |

**Pricing catalogue:**

| key | line | price ₦ | cycle | days | recurring | launch_free | config |
|---|---|---|---|---|---|---|---|
| `job_basic` | job_post | 2,000 | one_time | 7 | ✗ | ✓ | soft_hide_immediate |
| `job_standard` | job_post | 3,500 | one_time | 14 | ✗ | ✓ | soft_hide_immediate |
| `job_premium` | job_post | 5,000 | recurring | 30 | ✓ | ✓ | soft_hide_grace (3d) |
| `svc_basic` | service | 1,500 | recurring | 30 | ✓ | ✓ | grace 3d |
| `svc_verified` | service | 3,000 | recurring | 30 | ✓ | ✓ | verified, grace 3d |
| `svc_featured` | service | 5,000 | recurring | 30 | ✓ | ✓ | verified+featured, grace 3d |

### 1.3 `subscriptions` — Recurring Lifecycle Source of Truth

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PK` | |
| `user_id` | `UUID FK → auth.users` | |
| `plan_key` | `TEXT FK → plans.key` | |
| `product_line` | `TEXT` | denormalized for fast filtering |
| `status` | `TEXT` | `active` \| `trialing` \| `past_due` \| `canceled` \| `expired` \| `paused` |
| `current_period_start` / `current_period_end` | `TIMESTAMPTZ` | billing window |
| `paystack_token_key` | `TEXT` | **Paystack** `authorization_code` for NGN recurring debits |
| `kora_card_token_key` | `TEXT` | **KoraPay** saved-card token |
| `auto_renew` | `BOOLEAN` | opt-in/out |
| `launch_free_period` | `BOOLEAN` | while true → skip charge, roll period |
| `leftover_price_ngn` | `INTEGER` | unused; reserved for proration |
| `grace_ends_at` | `TIMESTAMPTZ` | when grace window closes → hide + cancel |
| `failed_retries` | `INTEGER` | 0,1,2,3 |
| `last_attempt_at` / `next_attempt_at` | `TIMESTAMPTZ` | retry scheduling |
| `last_attempt_ref` | `TEXT` | gateway reference |
| `canceled_at` / `cancel_reason` | `TIMESTAMPTZ`/`TEXT` | |
| `metadata` | `JSONB` | |

**Key index:** `(status, current_period_end)` — drives the daily due-scan.

### 1.4 `payments` — Ledger (extends existing)

New recurring columns:
- `subscription_id UUID FK → subscriptions(id) ON DELETE SET NULL`
- `billing_phase TEXT` → `initial` \| `renewal` \| `retry` \| `manual`
- `failure_code TEXT`
- `idempotency_key TEXT UNIQUE` (equals gateway `reference`)

### 1.5 `jobs` — Pay-Per-Post (extends existing)

| Column | Purpose |
|---|---|
| `post_plan TEXT FK → plans.key` | tier purchased |
| `post_paid BOOLEAN` | gates public visibility |
| `billing_mode TEXT` | `one_time` \| `recurring` |
| `post_expires_at TIMESTAMPTZ` | hard expiry for one-time posts |
| `grace_ends_at TIMESTAMPTZ` | grace window for recurring posts |
| `subscription_id UUID FK` | link to auto-renewal |

### 1.6 `profiles` + `service_providers` — Provider Visibility

- `profiles.is_verified`, `profiles.is_featured` — listing badges.
- `profiles.service_subscription_id` — current active provider sub.
- `profiles.visibility_until` — feeds filter `WHERE visibility_until > now()`.
- `service_providers.is_active` — flip hidden when sub lapses.

### 1.7 RLS Summary

- `plans`: public `SELECT` where `is_active = true`; admins full control.
- `promo_codes`: admins only.
- `subscriptions`: owner read/insert/cancel; admins full.
- `payments`/`jobs`/`profiles`: existing policies + admin overrides; public job/provider feeds are `SECURITY DEFINER` RPCs or service-role reads that apply billing filters server-side.

---

## 2. API Endpoint Specifications (RESTful)

Auth header: `Authorization: Bearer <JWT>` (anon for public reads; service-role for cron/webhooks).

### 2.1 Public / Pricing

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/plans?product_line=job_post` | anon | List active plans; server returns `price_ngn = is_launch_free ? 0 : base_price_ngn` |
| `GET` | `/jobs` | anon | Public feed — **only** `post_paid = true`, `is_active = true`, `post_expires_at > now()` (or within grace for premium) |
| `GET` | `/providers` | anon | Public marketplace — only profiles with `visibility_until > now()` |

### 2.2 Pay-Per-Post (Product Line A)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/job-posts` | user | Create draft job, consume credit OR attach unpaid plan |
| `POST` | `/job-posts/:id/pay` | user | Initiate one-time checkout (KoraPay inline) |
| `POST` | `/webhooks/korapay` | service-role | Verify payment → `post_paid=true`, set `post_expires_at`, publish |
| `POST` | `/webhooks/paystack` | service-role | *Optional/future* — only if Paystack is ever enabled |
| `PATCH` | `/job-posts/:id` | owner | Edit while active |
| `DELETE` | `/job-posts/:id` | owner | Soft-delete (`is_active=false`) |

**Pay-per-post activation payload (after webhook):**
```json
{
  "post_paid": true,
  "post_plan": "job_standard",
  "billing_mode": "one_time",
  "post_expires_at": "2026-08-21T10:00:00Z",
  "is_active": true
}
```

### 2.3 Subscriptions (Product Lines A-premium + B)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/subscriptions/me` | user | List own subscriptions + plan + period + status |
| `POST` | `/subscriptions` | user | Subscribe → create `subscriptions` row (`status=active`, `launch_free_period=<plan.is_launch_free>`) |
| `PATCH` | `/subscriptions/:id` | owner | Toggle `auto_renew`, update payment token |
| `POST` | `/subscriptions/:id/cancel` | owner | Set `status=canceled`, `auto_renew=false`, hide listing after grace |
| `POST` | `/checkout` | user | KoraPay inline checkout; capture saved-card token |
| `POST` | `/payment-methods` | user | Save tokenized card (`kora_card_token_key`) |

**Subscribe request:**
```json
{ "plan_key": "svc_verified", "auto_renew": true }
```

**Subscribe response (launch-free):**
```json
{
  "id": "6f2b…",
  "plan_key": "svc_verified",
  "status": "active",
  "current_period_start": "2026-08-07T00:00:00Z",
  "current_period_end": "2026-09-06T00:00:00Z",
  "charged_ngn": 0,
  "launch_free_period": true
}
```

### 2.4 Cron / Webhook (server)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/billing-cron` | Vercel cron | Triggers `billing-daily` edge function (`?dryRun=1` for dry-run) |
| `POST` | `/functions/v1/billing-daily` | service-role | Full daily sweep (expiry + renewals + retries + grace cancel) |
| `POST` | `/functions/v1/kora-webhook` | provider signature | Charge result reconciliation |
| `POST` | `/functions/v1/verify-payment` | service-role | Verify one-time checkout via gateway |

---

## 3. The Automated Billing State Machine

### 3.1 States

```
            ┌─────────────┐
            │   active    │◄────────────┐  payment recovered
            └──────┬──────┘             │
                   │ period_end reached (auto_renew)        │
                   │ + token present   │
                   ▼                   │
            ┌─────────────┐   retry 1..2 fail   ┌─────────────┐
            │  charging   │────────────────────►│  past_due   │
            └──────┬──────┘                     └──────┬──────┘
                   │ charge ok                        │ retry 3 fail
                   ▼                                   ▼ (grace_ends_at set)
            (roll period)                    ┌──────────────────┐
                                             │ past_due + grace │
                                             │ grace_ends_at ≤ now
                                             └────────┬─────────┘
                                                      ▼
                                             ┌─────────────┐
                                             │  canceled   │  (auto_renew=false,
                                             └─────────────┘   hide listing)
```

### 3.2 Success Path (day 30 → renewal)

1. Cron hits `list_due_subscriptions()` → returns subs where `status='active' AND auto_renew=true AND current_period_end <= now()`.
2. If `launch_free_period=true` → **skip charge**, roll `current_period_start/end` forward 30d, clear flag, notify "free period renewed". *(Phase 1)*
3. Load `kora_card_token_key` (KoraPay saved-card token) + user email.
4. Build idempotent `reference = JB-<subId>-<planKey>-<attempt>`.
5. Call `chargeSavedCard` (KoraPay) with the NGN amount.
6. **Success:** set `status=active`, `failed_retries=0`, roll period 30d, `grace_ends_at=NULL`, insert `payments` row (`billing_phase='renewal'`, `idempotency_key=reference`), re-publish job/provider.
7. Notify: "Renewal successful — active until <date>".

### 3.3 Insufficient-Funds Path (detailed)

| Day | Attempt | Action |
|---|---|---|
| **30** | 1 | Charge fails (`insufficient_funds` / declined / `no_card_on_file`). → `status=past_due`, `failed_retries=1`, `next_attempt_at = day 31`. **Listing stays visible.** Notify: "Renewal failed — retrying automatically." |
| **31** | 2 | Retry fails. → `failed_retries=2`, `next_attempt_at = day 33`. Still visible. Notify again. |
| **33** | 3 | Retry fails. → `failed_retries=3`, `next_attempt_at=NULL`, `grace_ends_at = day 36`. **Grace period starts** (listing remains visible through grace). Notify: "Final renewal notice — listing hidden after grace." |
| **36** | — | `grace_ends_at <= now` → `status=canceled`, `auto_renew=false`, `canceled_at` set, job/provider hidden via `enforce_billing_visibility()`. Notify + email: "Subscription ended." |

**Grace-period decision:** we keep listings visible through **3 days of past-due + a 3-day final grace** (≈6 days total) to maximize recovery while bounding revenue leakage. One-time posts (`job_basic`/`job_standard`) hide **immediately** at `post_expires_at` — no grace (discrete, time-bound product).

**Notification triggers:**

| Event | Channel | Copy (condensed) |
|---|---|---|
| Charge fail (retry 1–2) | push + email | "Renewal failed — retrying automatically." |
| Final fail (retry 3) | push + email | "Final renewal notice — will hide after grace." |
| Grace recovered | push | "Subscription recovered — listing active again." |
| Grace elapsed → canceled | push + email | "Subscription ended after grace period." |
| Launch-free rollover | push | "Your free period was renewed." |

### 3.4 Failure Modes & Idempotency

- **Network error / timeout:** do not count a retry without a confirmed `reference`; schedule `next_attempt_at` for next cron so the charge can be reconciled by `kora-webhook`/`verify-payment` before re-charging.
- **Duplicate webhook:** upsert `payments` on `idempotency_key`; never roll the period twice for the same `reference`.
- **No card on file:** short-circuit to `past_due` + "Add a card" notification (no fake gateway call).

---

## 4. Cron Job Pseudocode

### 4.1 Job-Post Expiration (one-time posts) — `expire_job_posts()`

```sql
-- Runs daily (and on every marketplace read via query-time filter).
UPDATE public.jobs
SET is_active = false, updated_at = now()
WHERE is_active = true
  AND billing_mode = 'one_time'
  AND post_expires_at IS NOT NULL
  AND post_expires_at <= now();
```

### 4.2 Grace Visibility Enforcement — `enforce_billing_visibility()`

```sql
-- Hide recurring jobs past grace:
UPDATE public.jobs SET is_active = false
WHERE billing_mode = 'recurring'
  AND grace_ends_at IS NOT NULL AND grace_ends_at <= now();

-- Hide provider profiles past grace:
UPDATE public.profiles SET visibility_until = NULL
WHERE visibility_until <= now()
  AND subscription status IN ('canceled','expired','past_due')
  AND grace_ends_at <= now();
```

### 4.3 Daily Billing Sweep — `billing-daily`

```
1. expire_job_posts()                     → hide one-time posts past expiry
2. enforce_billing_visibility()           → hide recurring listings past grace
3. due = list_due_subscriptions()
   for sub in due:
     if dryRun: record predicted action; continue
     if sub.launch_free_period:
         roll period 30d; clear flag; notify; continue
     if sub.status == 'past_due' and sub.grace_ends_at <= now():
         finalizeCanceled(sub); continue
     attempt = sub.failed_retries + 1
     if no token on file: markFailed(attempt=1); continue
     ref = "JB-{sub.id}-{plan}-{attempt}"
     ok = chargeSavedCard(amount=plan.base_price_ngn, reference=ref)
     if ok: success(sub, ref)   # roll period, reset retries, re-publish
     else:  markFailed(sub, attempt)
             # next_attempt_at = day+1, day+2, then grace_ends_at=day+3
```

### 4.4 Scheduling

- **Vercel Cron** (`vercel.json`): `"crons": [{ "path": "/api/billing-cron", "schedule": "0 0 * * *" }]` — daily 00:00 UTC.
- `api/billing-cron.ts` forwards to Supabase `billing-daily` with service-role key; supports `?dryRun=1` for safe previews.
- Optional **pg_cron** in Supabase for the DB-level sweeps (`expire_job_posts`, `enforce_billing_visibility`) as a resilience backstop.

---

## 5. Implementation Cross-Check & Deltas

✅ **Already implemented** (aligns with this spec):
- `plans` catalogue incl. `is_launch_free` + all 6 tiers — [`20260807_002_monetization_engine.sql`](../supabase/migrations/20260807_002_monetization_engine.sql:28)
- `subscriptions` lifecycle columns (`status`, `current_period_start/end`, `paystack_token_key`, `kora_card_token_key`, `auto_renew`, `grace_ends_at`, `failed_retries`, `next_attempt_at`) — [line 80](../supabase/migrations/20260807_002_monetization_engine.sql:80)
- `payments` idempotency + `billing_phase` — [line 116](../supabase/migrations/20260807_002_monetization_engine.sql:116)
- `expire_job_posts` / `enforce_billing_visibility` / `list_due_subscriptions` RPCs — [line 200](../supabase/migrations/20260807_002_monetization_engine.sql:200)
- `billing-daily` state machine (launch-free, renew, retry day31/day33, grace, hard cancel, notifications) — [`billing-daily/index.ts`](../supabase/functions/billing-daily/index.ts:101)
- KoraPay saved-card charging + `planKeyFor` mapping — [`korapay-recurring.ts`](../supabase/functions/_shared/korapay-recurring.ts:50)
- Paystack `charge_authorization` + customer ensure — [`paystack.ts`](../supabase/functions/_shared/paystack.ts:46)
- Vercel cron bridge — [`billing-cron.ts`](../api/billing-cron.ts:7)

✅ **Hardening applied 2026-08-08** — [`20260808_001_harden_billing_visibility.sql`](../supabase/migrations/20260808_001_harden_billing_visibility.sql:1):
1. **Missing `is_active` columns fixed.** `service_providers.is_active` and `profiles.is_active` were referenced by [`get-providers`](../api/get-providers.ts:24) and the billing worker but never created (the `20260727_001` migration shipped empty). Both columns are now added idempotently and backfilled; the provider feed no longer 502s.
2. **Lapsed providers now hidden (revenue leak closed).** [`enforce_billing_visibility()`](../supabase/migrations/20260808_001_harden_billing_visibility.sql:47) flips `service_providers.is_active=false` + `profiles.is_active=false` and clears `visibility_until` at grace end, and [`get-providers`](../api/get-providers.ts:22) now filters `visibility_until > now()` on both feed paths.
3. **Duplicate-charge race closed (idempotency).** [`billing-daily`](../supabase/functions/billing-daily/index.ts:157) writes a `pending` `payments` ledger row (idempotency_key = reference) **before** charging; on failure it re-checks the ledger and skips the retry if `kora-webhook` already verified the reference. The webhook reconciles renewals ([`reconcileRenewal`](../supabase/functions/kora-webhook/index.ts:285)) — rolls the period idempotently, resets retries, clears grace, restores visibility. [`activate_plan_on_verify`](../supabase/migrations/20260808_001_harden_billing_visibility.sql:163) now skips `renewal`/`retry` rows so renewals never re-grant credits.
4. **`grace_days`/`duration_days` now come from `plans`** (`list_due_subscriptions` returns both; the worker + `persistKoraCardToken` no longer hardcode 30/3).
5. **Jobs feed enforces billing at query time** (RLS + [`fetchJobs`](../src/lib/supabaseQueries.ts:5)): paid + not-expired + within-grace, with a legacy exemption (`post_plan IS NULL`); recruiters can always read their own posts.
6. **New service subscribers are listed immediately** — `persistKoraCardToken`, `verify-payment` universal activation, and the webhook legacy path all open `visibility_until` + activate the `service_providers` row.

Remaining notes (not blocking):
- **KoraPay is the sole gateway.** `paystack_token_key` is stored for forward-compatibility; wire [`chargeAuthorization`](../supabase/functions/_shared/paystack.ts:46) into the worker only if Paystack is ever enabled.
- Email on recovery/failure uses `send-email` `type: "payment_failed"` (template verified present).
