# Accounts and cloud saves setup

The application uses Google OAuth or email/password authentication and private Supabase saves. Public game data stays in `public/data`; the database contains only each user's selections, inventory, QP, ordering, display name, and theme. Guest mode works without Supabase environment variables.

## 1. Create the database tables

Open the [project SQL editor](https://supabase.com/dashboard/project/vsrqiqsvwmvhvaiqvgnh/sql/new). Paste and run `supabase/migrations/202609250001_accounts.sql` once. It creates two private tables and the revision-checked save/read functions. Keep row-level security enabled. Do not add public read policies or direct client write grants.

Then run `supabase/migrations/202609260001_game_profiles.sql` once. It adds game profiles (one progress row per FGO account, up to 10 per user, each with its own revision), copies every existing save into a profile named **Main**, and closes the old `save_user_progress` function so tabs running older code show **Not synced** instead of saving to the retired table. Run it before deploying the profiles release. The old `user_progress` table stays as a backup.

Then run `supabase/migrations/202609270001_profile_server.sql` once. It marks each game profile as NA or JP (existing profiles become NA) for JP planning. The previous release keeps working: its two-argument create still makes NA profiles.

The supplied publishable key supports application requests; it cannot install migrations or configure authentication. No service-role key is needed in the website.

## 2. Configure Google sign-in

1. Open [Google Auth Platform](https://console.cloud.google.com/auth/overview), select or create your project, and configure Branding and Audience. Use **External** for public users. While in testing, add the Google accounts you want to test with.
2. Configure only basic identity scopes: `openid`, email, and profile.
3. Create an OAuth client with type **Web application**. Add `http://localhost:3000` and your deployed website origin to authorized JavaScript origins.
4. Add this exact authorized redirect URI:
   `https://vsrqiqsvwmvhvaiqvgnh.supabase.co/auth/v1/callback`
5. In [Supabase Auth providers](https://supabase.com/dashboard/project/vsrqiqsvwmvhvaiqvgnh/auth/providers), enable Google and enter the Google client ID and client secret. The Google secret belongs here, not in the frontend or repository.
6. In Supabase **Authentication → URL Configuration**, set Site URL to your deployed website origin. Allow `http://localhost:3000/auth/callback` and `https://YOUR_DEPLOYED_DOMAIN/auth/callback`. Add preview origins explicitly if you need preview logins.
7. When ready for public access, change the Google audience from testing to production and complete any branding requirements shown by Google.

Google redirects to Supabase; Supabase then redirects to the application's `/auth/callback` route. These two callback addresses are deliberately different.

See [Supabase Google OAuth documentation](https://supabase.com/docs/guides/auth/social-login/auth-google).

## 3. Configure the application

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Local settings for the supplied project have already been added to the implementation worktree's ignored `.env.local`.

Set those same variables in your hosting project's Production and Preview environment settings, then redeploy. Next.js embeds public environment variables at build time. Restart the local development server after changing them.

Run the database migration before deploying the configured application. If the service or schema is unavailable, account saves show an error and remain pending; they are never replaced with empty guest data.

## 4. Verify before launch

- Sign in with Google on localhost. Cancel once and verify the error is recoverable.
- Start with guest servants, materials, and QP. Decline import and confirm cloud progress remains unchanged; import later from Account and confirm the replacement preview.
- Use a second browser session to sign into the same account and confirm progress, ordering, QP, and theme restore.
- Make changes in two sessions from the same revision. Confirm the second save prompts for a choice instead of overwriting the first.
- Go offline, edit progress, reload, reconnect, and choose **Sync now**. Unsynced state must stay visible until saved.
- Sign out and into another account. Guest and each account's data must stay separate.

`supabase/test-policies.sql` verifies two-user isolation, anonymous denial, direct-write denial, invalid-save rejection, per-profile revision conflicts, name rules, the 10-profile cap, refusing to delete the last profile, and the **Main** backfill. Run it after the migration in an isolated PostgreSQL/Supabase test database. It inserts two dummy Auth users and rolls back all fixtures. Never use production accounts for testing.

## Save behavior and recovery

Progress saves after a 700 ms debounce. Saves combine inventory, QP, and servant changes in one transaction; profile changes participate in the same revision. Focus/reconnect refreshes cloud state. The application does not subscribe to live updates.

Local account caches use `chaldea:account:USER_ID`; guest data keeps its legacy key. Pending changes survive reloads and sign-out. Before explicit replacement, recovery copies are stored under `chaldea:account:USER_ID:recovery:*`. These copies contain the compact document and profile and can be inspected in browser storage; v1 does not include a recovery browser UI. Do not clear browser storage while a save is marked **Not synced**.

Existing guest exports remain accepted. Cloud saves omit game metadata and load it from the current static servant files. Unsupported or missing data produces a retryable error rather than dropping servants silently.

### Automated browser checks

With the configured app running on localhost:3000, run `npx playwright install chromium` once, then `npm run test:accounts`. To use installed Chrome instead, run `PLAYWRIGHT_CHANNEL=chrome npm run test:accounts`. Set `PLAYWRIGHT_BASE_URL` for another local port. These tests use isolated browser profiles and mock authenticated cloud responses; they cover guest persistence, responsive layout, profile saves, failed upload/retry, import choices, conflict recovery, and sign-out. They do not validate Google's live OAuth configuration.

## Email/password accounts

The Account page also supports email signup/sign-in, confirmation resend, and password reset. Enable **Email** in Supabase Authentication → Providers and keep **Confirm email** enabled. Passwords are handled by Supabase Auth and are not stored in the application's tables or browser save data.

For production, configure **Authentication → SMTP Settings** with your email delivery provider. Supabase's built-in email service has delivery restrictions and low rate limits; it is not a substitute for production SMTP.

The default confirmation links work with the PKCE callback in the browser that initiated the request. For links that also work in another browser/device, configure these link URLs in **Authentication → Email Templates**:

- Confirm signup: `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`
- Reset password: `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery`

The application supplies `.RedirectTo` as `/auth/callback?next=...` on the current site. Keep the site's callback URL allowed in Supabase URL Configuration. Recovery links lead to `/account/password`; expired or invalid links return to Account with a recoverable error. The password form remains available even if the progress database has not been configured.

Verify a real signup, confirmation email, sign-in, and password reset using your own test email after SMTP is configured. Automated browser tests mock these requests and do not send email. See [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords).
