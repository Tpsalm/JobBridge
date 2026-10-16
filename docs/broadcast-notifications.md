# Admin broadcast notification campaigns

Broadcast campaigns use the existing Supabase Auth accounts, profiles, notifications table, and browser push subscriptions. The campaign API and background worker are Vercel Node serverless functions. The frontend does not contain privileged database keys or SMS credentials.

## Database setup

`supabase/migrations/20261017_001_admin_broadcast_campaigns.sql` has been applied to the linked Supabase project. The campaign and per-recipient delivery ledgers, queue and statistics RPCs, retry/cancel RPCs, in-app notification linkage, and SMS consent/verification safeguards are present. No notification campaign was sent.

The migration also repairs the missing provider-signup column and auth-user trigger from `20260929_001_provision_provider_accounts.sql`, because those effects were absent in the linked schema. Do not mark migration `20260929` as applied until those effects have actually been applied and verified.

The `20260929` and `20261017` migration versions were recorded as applied after verifying their schema effects. The linked migration ledger still has older local migrations missing from remote history. Do not use `--include-all` as a shortcut: reconcile and verify each historical migration before applying or repairing its history entry. This remaining ledger issue does not undo the broadcast schema already applied.

Phone verification defaults to false and is protected against client-side changes. This repository does not currently provide a trusted phone-verification workflow; therefore SMS recipients remain ineligible until a trusted verification process is configured. SMS consent defaults to false and must only be enabled by explicit user opt-in. SMS delivery is never reported as delivered until an authenticated provider receipt confirms it.

## Vercel server environment

Configure these server-only Vercel environment variables for the API deployment:

| Variable | Required | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | Yes | Existing Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Validates a user's Supabase Auth access token |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side campaign queue/database access; never use a `VITE_`-prefixed service-role key |
| `CRON_SECRET` | Yes | Secret shared with the scheduled worker workflow |
| `VAPID_PUBLIC_KEY` | For push | Existing Web Push public key |
| `VAPID_PRIVATE_KEY` | For push | Existing Web Push private key; server-side only |

The browser push code reuses the project's existing VAPID/Web Push service worker. It does not require FCM or an installed mobile app. Push registration now requires a signed-in account and binds a subscription to the authenticated user.

## Scheduled worker

Configure GitHub repository secrets:

| Secret | Value |
| --- | --- |
| `BROADCAST_WORKER_URL` | The deployed Vercel URL ending in `/api/process-broadcasts` |
| `BROADCAST_CRON_SECRET` | The same high-entropy value as Vercel's `CRON_SECRET` |

The `Process notification campaigns` workflow invokes the authenticated worker every five minutes and can also be run manually. Each invocation claims a bounded batch; database row locks prevent concurrent workers from claiming the same recipient. Ensure the site's `/api/*` routes reach this Vercel deployment; GitHub Pages alone cannot execute these API functions.

## Optional SMS gateway contract

SMS stays disabled unless every setting below is present and the configured HTTPS health-check URL returns a successful response:

| Variable | Purpose |
| --- | --- |
| `SMS_GATEWAY_URL` | HTTPS endpoint accepting the JSON batch request below |
| `SMS_GATEWAY_HEALTHCHECK_URL` | HTTPS GET health endpoint, called by admin configuration/preview |
| `SMS_GATEWAY_API_KEY` | Server-only bearer credential for the SMS endpoint and health check |
| `SMS_GATEWAY_SENDER_ID` | Sender name (1-11 supported alphanumeric/space/`_.-` characters) |
| `SMS_GATEWAY_WEBHOOK_SECRET` | Random shared secret of at least 32 characters for delivery receipts |
| `SMS_GATEWAY_COST_PER_SEGMENT_NGN` | Non-negative NGN amount used for the preview estimate |
| `SMS_GATEWAY_BATCH_SIZE` | Optional batch size, 10-50 (default `50`) |
| `SMS_GATEWAY_REQUESTS_PER_SECOND` | Optional request rate, 1-10 (default `1`) |

The worker POSTs `{ "sender": "...", "messages": [{ "to": "+...", "message": "...", "client_reference": "<delivery UUID>" }] }`. The provider must return a JSON object with a `messages` array containing one `{ "client_reference": "...", "accepted": true, "message_id": "unique-provider-id" }` result for each accepted recipient. The provider should treat `client_reference` as an idempotency key and return unique message IDs. Acceptance is recorded as `sent`, not `delivered`. If supported, the provider should POST `{ "message_id": "...", "status": "delivered" | "failed" }` to `/api/broadcast-sms-receipt` with the `x-broadcast-webhook-secret` header. Configure sender identity and gateway policies to meet Nigerian messaging and privacy requirements, and obtain consent before enabling opted-in verified recipients. SMS is a paid provider service; it is not included or represented as free.

## Admin workflow and delivery semantics

Admins can preview the resolved audience, channels, push coverage, SMS eligibility/estimated segments and cost; send now or schedule up to 30 days ahead; search campaign history; cancel queued campaigns; and retry failures. Every all-user campaign requires an explicit confirmation and a successful test campaign to five or fewer selected users on each requested channel. Admin APIs verify the authenticated Supabase user and `profiles.role = 'admin'`; campaign history and delivery data are never available to non-admin callers. Delivery records do not store phone numbers.

In-app notifications and web push are marked `sent` when accepted by the database or push service. Web Push does not provide reliable device display receipts, so it is not marked `delivered`. Expired push subscriptions are removed. Delivery retries use bounded exponential backoff and deduplicated in-app notification IDs.

Do not create a production campaign until the migration, server environment, API routing, and scheduled worker are configured and verified with a small test audience. This change does not apply the migration, deploy code, or send any campaign.
