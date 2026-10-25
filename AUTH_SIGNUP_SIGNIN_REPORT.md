# JobBridge Sign-up and Sign-in Implementation Report

## Scope and confidence

This report describes the authentication implementation in the current JobBridge workspace. It is based on source code and the profile-provisioning migration, not a live production test. The repository history available for this task does not contain a verified original build prompt. The prompt at the end is therefore a reconstruction of the requirements reflected in the code; it is not represented as the exact historical prompt.

## Components and responsibilities

| Area | Implementation |
|---|---|
| Public registration | [`src/pages/Signup.tsx`](./src/pages/Signup.tsx) |
| Password sign-in and forgot-password UI | [`src/pages/Login.tsx`](./src/pages/Login.tsx) |
| Auth API calls, session/profile state and profile provisioning fallback | [`src/contexts/AuthContext.tsx`](./src/contexts/AuthContext.tsx) |
| Email-confirmation and recovery callback | [`src/pages/AuthCallback.tsx`](./src/pages/AuthCallback.tsx) |
| New-password form | [`src/pages/ResetPassword.tsx`](./src/pages/ResetPassword.tsx) |
| Authentication gate | [`src/components/ProtectedRoute.tsx`](./src/components/ProtectedRoute.tsx) |
| Supabase client initialization | [`src/lib/supabase.ts`](./src/lib/supabase.ts) |
| Auth error messages | [`src/lib/authErrors.ts`](./src/lib/authErrors.ts) |
| Signup-triggered profile/provider records | [`supabase/migrations/20260929_001_provision_provider_accounts.sql`](./supabase/migrations/20260929_001_provision_provider_accounts.sql) |
| Password-reset email endpoint | [`api/send-email.ts`](./api/send-email.ts) |
| Signup modal alternate entry point | [`src/components/Modal.tsx`](./src/components/Modal.tsx) |

## Sign-up flow

1. **Choose an account type.** The full signup page offers job seeker, recruiter, and service provider roles. The public flow does not offer administrator registration. `AuthContext.signUp` also rejects an `admin` role, and the database trigger only accepts the recruiter, provider, and job-seeker roles from auth metadata; other values are stored as `job_seeker`.
2. **Enter account and profile details.** The form collects name, email, password, and role-dependent details. Provider registration has a profile step for service details, followed by plan selection and a checkout summary.
3. **Validate in the browser.** The page checks name length, email format, password length (at least six characters), provider fields, terms acceptance, and a client-side attempt limit. These validations are useful for feedback but are not substitutes for server-side validation or Supabase Auth protections.
4. **Create the Supabase Auth user.** `AuthContext.signUp` calls `supabase.auth.signUp`, supplies the `/auth/callback` redirect, and includes name, role, company, service category, and applicable provider metadata. The password is passed to Supabase Auth; JobBridge application code does not write it to its profile table.
5. **Provision application records.** The SQL `handle_new_user` trigger creates a `profiles` row and, for provider users, a `service_providers` row. The client also attempts an upsert of those records as a recovery/provisioning path. A client upsert failure is logged, but it does not roll back an Auth user that has already been created.
6. **Send onboarding messages.** The client starts welcome and profile-reminder emails in the background, and also notifies the admin address for recruiter signups. Email delivery is not awaited as a condition for creating the account.
7. **Handle the Auth confirmation setting.**
   - If Supabase returns a session immediately, the page routes non-providers to `/profile`. Providers are routed to `/payment?plan=...`.
   - If email confirmation is required and no session is returned, the page shows a confirmation-instructions view. After confirmation, `/auth/callback` processes the session and routes a provider to payment setup or another user to `/profile`.
8. **Restore profile state after authentication.** `AuthContext` listens for Supabase auth events, sets session and user state, then loads or heals the profile and fetches subscription/application data.

### Provider-specific signup behavior visible in the current source

Provider registration creates the account first, then routes the selected service plan through `/payment` to the dedicated `ServiceSubscriptionSetup` UI. The setup page requires explicit consent for monthly Direct Debit after the 21-day trial and separately requires acknowledgment of KoraPay's ₦50 NIBSS mandate-verification payment. The trial begins only after KoraPay confirms the mandate; the monthly subscription amount is not charged during the trial. The exact first charge date is available in Manage Subscription after authorization is active. JobBridge stores only safe bank details such as bank name and account last four digits, not the full account number.

## Sign-in flow

1. The login page collects email and password, validates basic input shape, and calls `AuthContext.signIn`, which uses `supabase.auth.signInWithPassword`.
2. The login page applies a browser-side attempt limit of five attempts per minute. Supabase Auth and server-side policy remain the authoritative controls.
3. On success, the page shows a success toast and navigates to the `redirect` query parameter if present, otherwise `/`.
4. `AuthContext` updates user/session state via Supabase auth events, loads or heals the profile, and fetches subscription data. It also starts a sign-in notification email and profile-completion reminder work in the background.
5. Auth errors are normalized for common cases such as invalid credentials, unconfirmed email, weak password, expired session, network failures, and rate limiting. Some API-provided messages are preserved and displayed.

## Session persistence and “Keep me signed in”

The login UI defaults “Keep me signed in” to checked. Supabase is initialized with its default client options, which persist sessions by default. When the user unchecks the box, the application stores a `sessionStorage` marker and attempts to call `signOut()` during `beforeunload`.

This is explicitly best-effort, not a true session-only storage implementation: `beforeunload` is not a reliable place to finish an asynchronous network request, and the standard Supabase client session is still persisted. The checkbox should not be described as guaranteeing that the session is removed when the browser closes.

The auth provider also has an inactivity timer that signs out an authenticated user after its configured inactivity duration.

## Email confirmation and callback handling

`/auth/callback` supports:

- Supabase PKCE `code` exchange via `exchangeCodeForSession`.
- Implicit-flow access tokens found in the URL hash, which the Supabase client processes.
- Signup, invite, and password-recovery callback types.

After callback handling, the page checks for an active session with brief retries. A recovery callback routes to `/reset-password`; a provider signup routes to payment; other confirmed signups route to `/profile`. If a session cannot be established, the callback shows an error asking the user to sign in. A timeout provides a fallback to `/login`.

## Password recovery

1. The login page validates the entered email and calls `AuthContext.resetPassword`.
2. The client requests a recovery email through the application email endpoint.
3. The endpoint can generate a one-time Supabase recovery link using the server-side service-role credential and send the email through the configured mail provider. The service credential is intended to remain server-side.
4. The recovery link returns through `/auth/callback?type=recovery`; the callback detects recovery and routes to `/reset-password`.
5. The reset page waits for a recovery session, supports both direct PKCE code exchange and an already-created recovery session, validates matching passwords with a minimum of eight characters, and calls Supabase `updateUser` through `AuthContext.updatePassword`.

The UI uses a generic success pattern for unknown accounts in the email endpoint to avoid revealing whether a submitted email is registered.

## Protected pages and authorization boundaries

`ProtectedRoute` waits for auth initialization and then allows any authenticated user through; if the visitor is not signed in, it opens the signup modal. This is an authentication gate, not a role/authorization check. Administrative permissions and other sensitive data access must be enforced separately by server-side policies (for example, Supabase RLS) and role-aware application checks. A client-side route guard alone is not an authorization boundary.

The `/signup` and `/login` pages are full-page forms. A separate `SignupModal` in `src/components/Modal.tsx` is another entry point, so any future behavior changes should be checked against both flows.

## Known limitations requiring attention

1. **Signup confirmation resend uses sign-up again.** `Signup.tsx` implements “Resend confirmation email” by calling `signUp` again with the entered email and password. That is not the dedicated Supabase resend-confirmation operation and may fail or report success without actually resending. Replace this with the supported resend API and test the configured confirmation flow.
2. **“Remember me” is not reliable session-only persistence.** The current implementation relies on a best-effort sign-out during page unload while default Supabase persistence remains enabled. If this distinction matters, implement and test an actual storage strategy rather than relying on unload.
3. **Production authentication flows have not been exercised with a real account.** Site and endpoint smoke checks were performed, but email confirmation, callback routing, signup email delivery, and password recovery still need end-to-end validation using a test account.
4. **Signup data completeness must be enforced by trusted backend policy.** Client checks and metadata are user-controlled input. Database constraints, RLS, and trusted server-side validation must govern role, provider status, and account permissions.
5. **Some behavior is configuration-dependent.** Confirm the deployed Supabase Auth URL/redirect allow-list, confirmation-email template, and email provider configuration before relying on signup confirmation and password recovery in production.

## Reconstructed build prompt (not the verified original)

> Implement a reliable sign-up and sign-in experience for JobBridge using the existing React, TypeScript, React Router, and Supabase setup. Follow the project’s existing UI and component conventions.
>
> Provide a public registration page for job seekers, recruiters, and service providers. Do not allow public administrator registration. Validate required fields and email format, apply clear password requirements, show accessible inline and form-level errors, and avoid duplicate submissions. Include provider profile details and plan selection where applicable without granting verified status merely because a paid plan is selected.
>
> Create accounts with Supabase Auth using `signUp`, store only necessary profile metadata, and provision the application profile and provider record through a database trigger with an idempotent client-side recovery path. Never store plaintext passwords. Handle both Supabase configurations: immediate authenticated session and email-confirmation-required registration. Configure the confirmation redirect to a dedicated auth callback and route users to the correct next step based on their role.
>
> Build email/password sign-in with field validation, useful normalized authentication errors, loading states, a post-login redirect parameter, and a password-reset entry point. Integrate with a shared auth context that restores persisted sessions, listens for auth-state changes, loads the corresponding profile, and clears user/profile state on sign-out. Any role-sensitive access must be enforced by trusted backend policies and not only by frontend routing.
>
> Implement email confirmation and password recovery callbacks for the Supabase flows configured by the project, including PKCE code exchange, recovery-session handling, expired/invalid-link states, and a dedicated new-password form. Send recovery messages through the project’s approved server-side email integration; keep service-role credentials on the server, avoid revealing whether an email address exists, and never place secrets in client code.
>
> Use server-side rate limits and Supabase Auth protections as the security boundary; client-side throttling is only supplemental UX. Do not claim “remember me” provides session-only behavior unless session storage and restoration actually implement that guarantee. Add or update tests for registration, duplicate accounts, confirmation-required and immediate-session outcomes, callback success/failure, sign-in errors, protected access, password recovery, session restoration, and role restrictions. Run the focused test suite, typecheck, and production build, and document any deployment configuration needed to make the flow work on jobbridge.com.ng.
