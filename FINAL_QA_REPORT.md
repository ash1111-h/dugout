# Dugout — final code and release-readiness audit

**Review date:** November 20, 2026  
**Release status:** The standalone game and Supabase account integration are implemented and pass the listed local/automated checks. The bundle is ready for owner configuration and a private test deployment. It is **not yet a live login service or a fully production-secure public competition** until the Supabase project, email delivery, live policies, and deployment are configured and verified.

## Release files

- `index.html` — complete standalone game and email/password account interface. It contains placeholders for the owner’s Supabase Project URL and public publishable key.
- `supabase-schema.sql` — required Supabase tables, row-level security policies, and the authenticated opt-in leaderboard function.
- `README.md` — setup, Supabase configuration, hosting, and acceptance-test steps.

## Changes made in the final pass

### Daily schedule and puzzle generation

- Audited all 1,100 prebuilt daily puzzles against the actual embedded player graph.
- Found 11 schedule entries that violated the intended 24-day player cooldown. Replaced those pairs with alternatives that preserve the day’s difficulty range and route length while avoiding players used in the surrounding 24-day window: June 24, July 24, and August 13, 2027; October 28, 2027; June 24, August 9, November 7, and December 5, 2028; May 5, August 26, and September 2, 2029.
- Added regression assertions for the 24-day cooldown across all 1,100 prebuilt puzzles and the 200 generated follow-on puzzles tested.
- Kept daily generation deterministic by date and Pacific time. Generated pairs are checked against the prebuilt and earlier generated matchups; the generator never silently reuses a pair.
- Generated puzzles preserve the assigned weekday difficulty band in the 200-day verification window. The generator can relax its player cooldown only if the available graph cannot satisfy it; it does not relax the no-reused-pair check.
- Kept Easy, Medium, and Hard Unlimited puzzles, plus a recent-pair and recent-player cooldown.
- Corrected player career display so separated stints with the same club are not presented as one continuous span.
- Kept Pacific-midnight rollover and added/retained DST-aware countdown calculations.

### Accounts and cloud data

- Implemented a Supabase email/password account flow: create account, email confirmation, sign in, resend confirmation, request a password reset, set a new password after recovery, update display name, choose leaderboard opt-in, and sign out.
- Passwords are sent to Supabase Auth and are not written to Dugout local storage.
- Guest and signed-in saves use separate browser storage namespaces.
- Added clearer handling for expired email links, missing database tables, storage failures, and cloud-sync errors. A valid sign-in remains usable even if the Dugout tables have not yet been installed; the page explains the missing setup and keeps sign-out available.
- Validates local and cloud daily game states before restoring them. Malformed or mismatched cloud saves are ignored rather than treated as valid progress.
- Improved two-device conflict messaging so it does not falsely claim that the most recent save always wins.
- Added/retained Supabase row-level security so account rows are scoped to the authenticated user. Daily save rows are limited to the current Pacific date, and leaderboard result writes reject future dates.
- Leaderboard display is opt-in. The leaderboard RPC returns display names and scores rather than email addresses or other users’ account UUIDs. It is available to signed-in users and returns up to 100 rows.

### Interface and accessibility

- Improved mobile touch targets, form labels, input autocomplete semantics, and screen-reader live status announcements.
- Kept keyboard navigation for player autocomplete and made the suggestion list report its active item.
- Improved the missing-configuration and guest states so the game remains playable without accounts.
- Added clear warning text if browser local storage is blocked or a saved file is malformed.

## Verification completed

### Player graph and puzzle tests

| Check | Result |
|---|---:|
| Curated player records | 3,691 |
| Team-season records | 2,942 |
| Team identifiers | 136 |
| Undirected teammate edges | 213,973 |
| Adjacency asymmetry | 0 |
| Missing shared-season explanations | 0 |
| Prebuilt daily puzzles | 1,100 / 1,100 valid |
| Prebuilt daily 24-day player cooldown | 0 violations after repair |
| Generated daily puzzles (days 1,101–1,300) | 200 / 200 valid |
| Generated daily 24-day player cooldown | 0 violations in tested window |
| Repeated unordered daily pairs in tested range | 0 |
| Shortest-route distance in tested daily set | 2–5 links |
| Unlimited puzzles | 60 each for Easy, Medium, and Hard |
| Pacific DST countdown | Passed: 23-hour spring day and 25-hour fall day |
| Future-dated results excluded from local stats | Passed |

### Browser and account-flow tests

- Guest play, daily puzzle completion, share-card fallback, hints, and Unlimited mode passed in Chromium.
- A test route from Jim Bunning to Miguel Cabrera completed in four links.
- Mobile layout tested at a 390px viewport; document width remained 390px with no horizontal overflow.
- Mocked Supabase flows passed for signup/confirmation messaging, resend confirmation, sign-in, sign-out, password-reset request, password update, profile display-name changes, leaderboard opt-in/opt-out, expired recovery link, and missing-schema warning.
- No JavaScript page errors were reported in the browser test runs.

### Static HTML and SQL checks

- HTML doctype, language, and title checked.
- No duplicate element IDs.
- All text/email/password inputs have associated labels.
- Both inline JavaScript blocks pass `node --check`.
- SQL structure checked for RLS on all three tables, per-user ownership policies, Pacific-current-day save restrictions, future-date result restrictions, a fixed `search_path` on the security-definer leaderboard function, authenticated-only execute grant, and safe policy re-creation. Every created policy has a matching drop-before-create statement.

## What could not be verified here

1. **No live Supabase project was connected.** The page still has placeholder values for `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. The SQL was structurally inspected but not executed against a real PostgreSQL/Supabase instance. Live signup, message delivery, RLS enforcement, and cross-device sync remain owner acceptance tests.
2. **The final browser environment did not provide a normal deployed HTTPS origin.** A true refresh-persistence and two-device test must be performed on the deployed site. The release checklist includes both.
3. **Email confirmation needs custom SMTP before public signup.** Supabase’s built-in mail service is restricted to pre-authorized project-team addresses. Test confirmation and password-reset messages to a non-team inbox after setting custom SMTP.
4. **The leaderboard is not cheat-proof.** A signed-in browser can submit its own score. RLS prevents editing another player’s rows, but it cannot prove a reported score was earned honestly. Use it as a friendly community board, not for prizes or high-stakes competition.
5. **Puzzle answers are embedded in the static HTML.** A curious player can inspect the graph and scheduled answers. Hiding them requires server-side puzzle delivery and result verification.
6. **The roster snapshot is still Lahman 2021.2, covering MLB through 2020.** The embedded roster contains 3,691 selected players and is not complete for every MLB player. A Lahman release through 2025 is now available, but this game’s graph, selection rules, puzzle schedule, and route QA have not been rebuilt against it.
7. **There is no in-app account deletion workflow yet.** Add a verified account-deletion process before broad public signup.
8. **The visual QA was desktop/mobile Chromium emulation, not hands-on testing on a physical phone or tablet.**

## Go-live checklist

1. Create a Supabase project.
2. Run `supabase-schema.sql` in Supabase **SQL Editor** and confirm the three tables and `dugout_leaderboard` function exist.
3. Enable Email authentication and keep email confirmation on.
4. Configure custom SMTP and test confirmation plus password-reset delivery to a non-team email address.
5. In the HTML, replace only the two Supabase placeholders with the project URL and the public `sb_publishable_...` key. Never put a `sb_secret_...`, `service_role`, database password, SMTP password, or other secret in the HTML or repository.
6. Publish `index.html` through GitHub Pages or Netlify.
7. Set the final HTTPS URL as Supabase **Site URL** and add the exact URL under **Redirect URLs**. If email templates are customized, preserve the supplied redirect destination.
8. Test signup, email verification, sign-in, sign-out, password recovery, daily save after refresh, same-account sync on a second device, and leaderboard opt-in/opt-out.
9. Use a non-identifying nickname on the public leaderboard. Do not display a full name, email, school, phone number, or home location.
10. Keep broad public promotion on hold until those live tests pass and an account-deletion process is available.
