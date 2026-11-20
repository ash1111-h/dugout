# Dugout — setup and launch guide

This package contains:

- `index.html` — the standalone game and email/password account interface.
- `supabase-schema.sql` — a combined, one-paste database setup script (tables, row-level security, and opt-in leaderboard function).
- `supabase-step1-tables-and-security.sql` and `supabase-step2-leaderboard-compact.sql` — the same SQL split into two scripts for staged setup.

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
4. The current development build already contains the project's URL and public publishable key. If you deploy this exact build, do not replace them with placeholders. If you create a different Supabase project, replace only those two constants in `index.html` with that project's URL and public publishable key.
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

## 5A. Optional roster refresh to Lahman 2025

The current embedded graph is still the original Lahman 2021.2 snapshot through 2020. The repository includes a migration builder at `tools/build_dugout_database.py`, but the migration has **not** been run on the live dataset yet.

1. Download the official SABR/Lahman 2025 CSV release from <https://sabr.org/lahman-database/>.
2. Extract `People.csv`, `Appearances.csv`, and `Teams.csv`. Optional files: `AllstarFull.csv`, `AwardsPlayers.csv`, and `HallOfFame.csv`.
3. Run from the repository folder:

   ```bash
   python tools/build_dugout_database.py index.html People.csv Appearances.csv Teams.csv --allstar AllstarFull.csv --awards AwardsPlayers.csv --hof HallOfFame.csv --output index-updated.html
   ```

4. The default import includes MLB historical major-league league IDs only (NA, NL, AA, UA, PL, FL, AL). Negro Leagues and other league records are excluded by default; only use `--include-other-leagues` if you intentionally want a broader, separately explained historical dataset.
5. Run the audit and graph/schedule checks against `index-updated.html`. Keep the original `index.html` and all 1,100 published daily puzzles unchanged until the migrated output passes the browser and puzzle regression tests.

The builder preserves existing player IDs, team-season indices, and the published schedule. It writes a separate output file and will refuse to overwrite the source HTML. It does not replace browser QA or the manual release steps.

## 5B. Latest migration results

The pinned 2025 data migration completed successfully in GitHub Actions. The MLB-only preview contains 21,227 unique players (+17,536), 3,264 team-seasons, 221 team labels, and data through 2025. All 1,100 published daily puzzles were preserved and checked to retain a 2–5-link standard route. The route distribution is 308 at 2 links, 463 at 3, 300 at 4, and 29 at 5.

- [Migration QA report](DUGOUT-2025-MIGRATION-RESULTS.md)
- [Download preview artifact](https://github.com/ash1111-h/dugout/actions/runs/44839480607/artifacts/14679912920)

The artifact contains `index-updated.html` and the CSV source files. It is not yet the committed `index.html`, and it has not been deployed to GitHub Pages. Keep `main` unchanged until browser, Supabase, and mobile acceptance tests pass.

## 6. Known limitations before a public launch

- **The player graph in the source `index.html` is still based on Lahman 2021.2 and data through the 2020 MLB season.** A separate 2025 migration preview has now been built and audited successfully: 21,227 unique players, 3,264 team-seasons, and all 1,100 published puzzles preserved. The preview is an Actions artifact, not yet merged into the app's source HTML. [Download the preview artifact](https://github.com/ash1111-h/dugout/actions/runs/44839480607/artifacts/14679912920). The existing 1,100-puzzle schedule is preserved.
- **Leaderboard scores are client-reported.** Row Level Security prevents one player from editing another player's records and blocks future-dated rows, but it cannot prove that a player's browser really played the puzzle fairly. The leaderboard function returns up to 100 opted-in users per view. Do not advertise this as a cheat-proof competitive ranking. A true anti-cheat leaderboard requires server-side puzzle secrecy and result verification.
- **The game schedule and answer graph are embedded in the HTML.** A technically curious user can inspect them. Server-side puzzle delivery would be needed to hide answers.
- **Supabase configuration is required for accounts.** The current branch already contains a configured project URL and public publishable key, but the SQL scripts must be installed in that project. Live authentication, email delivery, SQL policy behavior, and cross-device sync must still be verified in the real project.
- **Unlimited statistics are currently stored locally per guest/account browser profile.** They persist on that browser but are not part of the Supabase cloud-sync tables, so they do not follow the account to a second device.
- **Custom email delivery is required before accepting signups from the general public.** Supabase's built-in SMTP service currently only sends to pre-authorized project-team addresses. Configure custom SMTP and test a non-team mailbox before sharing the signup page widely. Add a self-service account-deletion process before a broad public launch; this starter currently provides sign-in, sign-out, profile, and recovery, but not in-app account deletion.

## Current branch upgrades

- Completed-game rarity is calculated from the actual successful player sequence, not the example shortest route. Failed guesses are excluded; when the final successful player is adjacent to the target, the target is included as the last route node.
- Rarity combines player connectivity, the existing player fame score, number of shared team-seasons, and a capped route-length factor. It is an estimate based on the embedded graph, not a live popularity ranking.
- Unlimited played/win/loss totals, streaks, and guess distribution now persist in local storage, separated between guest and signed-in browser profiles. These stats are not cloud-synced.
- Added a keyboard skip link and explicit accessible naming/description for the player autocomplete input.

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
