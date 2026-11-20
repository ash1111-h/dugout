# Dugout — setup and launch guide

This package contains:

- `index.html` — the ready-to-publish standalone game and email/password account interface.
- `supabase-schema.sql` — the database tables, row-level security rules, and opt-in leaderboard function.

The game can run as a guest without any account configuration. Email/password accounts, cloud saves, and the shared leaderboard become active after the Supabase steps below.

## 1. Create the backend project

1. Create a project in Supabase: <https://supabase.com/dashboard>.
2. Choose a strong database password and keep it private.
3. Open **SQL Editor**, create a new query, paste all of `supabase-schema.sql`, and run it.
4. Confirm that these tables exist under **Table Editor**: `dugout_profiles`, `dugout_daily_saves`, and `dugout_daily_results`.
5. Confirm the `dugout_leaderboard` function exists under **Database → Functions**.

The SQL enables Row Level Security, restricts each player to their own saved games and results, and only returns display names and scores from profiles that explicitly opt in. It does not expose email addresses or other players' Supabase account IDs through the leaderboard.

## 2. Enable email/password authentication

1. In Supabase, open **Authentication → Sign In / Providers** (the menu label may vary) and ensure Email is enabled.
2. Keep email confirmation enabled for real users. This makes new players verify their address before their first sign-in.
3. Open **Authentication → URL Configuration**.
4. After deploying the site, set **Site URL** to its final public URL.
5. Add the exact deployed URL to **Redirect URLs**. Also add your local development address if you test locally, such as `http://localhost:8000/**`.

Supabase sends confirmation and password-reset emails. Important for a public launch: Supabase's built-in SMTP service is not a general public mail sender. Current Supabase documentation says it only delivers to pre-authorized addresses associated with the project's team. Before inviting anyone outside that team, configure a custom SMTP provider under Authentication → SMTP Settings, then test confirmation and password-reset emails to an ordinary non-team address. See the official [custom SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp).

## 3. Connect Dugout to Supabase

Use the project's **publishable** key for the browser. Current Supabase guidance recommends the `sb_publishable_...` key for shipped browser code; legacy `anon` keys remain compatible for now but are being deprecated by the end of 2026. Never use the secret key in a web page.

1. In the Supabase dashboard, open **Settings → API Keys** or the project's **Connect** dialog.
2. Copy the **Project URL** shown for the project.
3. Copy the public **publishable key** (`sb_publishable_...`). If your project only shows the legacy `anon` key, that can work during migration, but prefer the publishable key for a new setup.
4. The configured `index.html` supplied in this package already contains the Project URL and publishable key provided during setup. No further key editing is needed unless you regenerate either value in Supabase.
5. Confirm the URL is the project root (`https://odulayjarrfqaggemftw.supabase.co`), not the REST endpoint ending in `/rest/v1/`.

Only use the public browser key here. **Never paste a `sb_secret_...` key, `service_role` key, database password, SMTP password, or any other secret into the HTML or a public repository.** The publishable key is designed to be public; the SQL security policies are what restrict database access. Supabase's current documentation says the older `anon` / `service_role` key pair is being deprecated by the end of 2026, so use the publishable key for a new project.

## 4. Put the site online (GitHub Pages)

1. Sign in to GitHub and create a **public** repository named `dugout` (GitHub Pages on the free plan is simplest with a public repository).
2. Upload the package’s `index.html` file to the repository root.
3. Commit the file to the `main` branch.
4. Open the repository's **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**, select `main`, choose `/ (root)`, and save.
6. Wait for GitHub Pages to publish the site. GitHub will show the public URL, usually `https://YOUR-USERNAME.github.io/dugout/`.
7. Copy that exact URL into Supabase **Authentication → URL Configuration** as both the Site URL and an allowed Redirect URL. Save.
8. The app sends that URL as the confirmation and password-reset redirect. If you customize Supabase email templates, make sure they honor the redirect destination (Supabase documents using `{{ .RedirectTo }}` where appropriate).
9. Open the published URL over HTTPS. Test the game as a guest first, then create a test account.

Alternative: use Netlify's static-site deploy flow. Upload the package folder containing the configured `index.html`; then set the Netlify URL as the Supabase Site URL and Redirect URL.

## 5. Test before sharing

- Create an account using an email address you can access. Complete the confirmation email.
- Sign in and check that the account label changes.
- Finish today's puzzle. Refresh the page and make sure the result remains.
- Open Dugout in another browser or device, sign in to the same account, and verify today's progress and stats appear.
- Sign out. Confirm guest play works and the guest save is separate from the signed-in save.
- Test the password-reset link and set a new password.
- In Account, change the display name and check **Show my display name and scores on the public leaderboard**. Save. Confirm the name appears in the board. Uncheck it and save; it should disappear from public results.
- Try a separate guest browser. It should be able to play without an account and should not see private saves.

Use a nickname on the public leaderboard rather than your full name. Do not use a school name, phone number, home location, or other identifying detail. The signed-in community leaderboard reveals only that nickname and the scores you opt into sharing; it does not display email addresses or persistent account IDs.

## 6. Known limitations before a public launch

- **The player graph is still based on Lahman 2021.2 and data through the 2020 MLB season.** The app footer says this. A Lahman release with statistics through 2025 now exists, but the embedded graph and puzzle schedule have not yet been rebuilt against it.
- **Leaderboard scores are client-reported.** Row Level Security prevents one player from editing another player's records and blocks future-dated rows, but it cannot prove that a player's browser really played the puzzle fairly. The leaderboard function returns up to 100 opted-in users per view. Do not advertise this as a cheat-proof competitive ranking. A true anti-cheat leaderboard requires server-side puzzle secrecy and result verification.
- **The game schedule and answer graph are embedded in the HTML.** A technically curious user can inspect them. Server-side puzzle delivery would be needed to hide answers.
- **Supabase configuration is required for accounts.** The included files cannot create a Supabase project or obtain your project keys automatically. Until you complete steps 1–3, the website works in guest mode and the account panel explains what is missing. Live authentication, email delivery, SQL policy behavior, and cross-device sync must be verified in your own Supabase project.
- **Custom email delivery is required before accepting signups from the general public.** Supabase's built-in SMTP service currently only sends to pre-authorized project-team addresses. Configure custom SMTP and test a non-team mailbox before sharing the signup page widely. Add a self-service account-deletion process before a broad public launch; this starter currently provides sign-in, sign-out, profile, and recovery, but not in-app account deletion.

## Security notes

- The game never writes passwords to local storage.
- Guest data and each signed-in account use separate local-storage keys on a shared browser.
- The database stores each user's save and result rows under their own Supabase Auth user ID.
- Leaderboard visibility is opt-in and defaults to off. The leaderboard RPC returns an `is_self` flag rather than exposing other players' account UUIDs.
- Emails are used by Supabase Auth and are not returned by the leaderboard function.
- The browser contains only the public project key; never add a service-role secret.

## Attribution

The roster snapshot embedded in this version originated from Lahman Baseball Databank release 2021.2. Dugout's player selection and connection graph were packaged for this game. The source website should continue to credit the Lahman Baseball Databank and Sean Lahman. For a roster refresh, use SABR's official database release and retain its attribution/license notice: <https://sabr.org/lahman-database/>.


## Official documentation

- GitHub Pages quickstart: <https://docs.github.com/en/pages/quickstart>
- Supabase JavaScript library pinned in this build: `@supabase/supabase-js` 2.119.2 (the HTML uses a version-pinned CDN URL; npm lists 2.119.2 as the current published version as of this guide's review).
- Supabase JavaScript client releases: <https://github.com/supabase/supabase-js/releases>
- Supabase API keys and browser security: <https://supabase.com/docs/guides/getting-started/api-keys>
- Supabase email/password authentication: <https://supabase.com/docs/guides/auth/passwords>
- Supabase redirect URL configuration: <https://supabase.com/docs/guides/auth/redirect-urls>
