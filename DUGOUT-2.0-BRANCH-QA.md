# Dugout 2.0 branch — implementation and verification status

**Branch:** `dugout-2.0-upgrade`  
**Base:** the current `main` snapshot as of 2026-11-20  
**Important:** this is a development branch. The live GitHub Pages site and `main` have not been changed.

## Completed in this branch

- [x] Created an isolated upgrade branch; main remains untouched.
- [x] Added actual-play-path rarity to the completed-game screen and share text. It uses successful guesses from the player's log, excludes failed guesses, and appends the target when the win is by adjacency. It does not use the shortest-path example shown elsewhere on the result screen.
- [x] Calibrated rarity score bands against the 1,100 published puzzle shortest paths. The original thresholds put every puzzle in Common or Uncommon; the revised scale produces a more useful five-tier distribution on that reference set. Rarity remains an estimate from graph topology/fame, not a global player popularity statistic.
- [x] Added persistent Unlimited played/win/loss totals, current/best run, and guess-count distribution. Stored separately for guest and each signed-in account's browser profile. These totals are local-only and do not sync to Supabase.
- [x] Added a keyboard skip-to-game link and explicit accessible name/description for the player autocomplete field.
- [x] Added a combined `supabase-schema.sql` so setup can be run in one SQL Editor operation. Kept the two staged SQL scripts and corrected their cross-reference.
- [x] Updated README for the existing project URL/public publishable key and the new game features.
- [x] Improved the Lahman migration builder: MLB-only by default; other/Negro leagues require an explicit opt-in; checks the filtered appearance coverage reaches 2025; preserves IDs and the existing daily schedule; never overwrites its input file.
- [x] Synthetic migration tests passed for both MLB-only default behavior and explicit all-leagues mode.
- [x] Revalidated embedded data: 3,691 players, 2,942 team-seasons, 136 team labels, 1,100 daily pairs; no invalid daily refs, duplicate pairs, unreachable pairs, duplicate IDs, or 24-day cooldown violations.
- [x] Simulated days 1,101–1,300: 200/200 generated; no repeated unordered pair; no cooldown relaxation required.

## Remaining before a public release

- [ ] Download and supply the official SABR/Lahman 2025 CSVs (People, Appearances, Teams; optional AllstarFull, AwardsPlayers, HallOfFame) and run the included migration builder. The 2025 roster migration has **not** been performed.
- [ ] Audit the migrated graph and schedule, and test autocomplete/generation performance with the expanded dataset.
- [ ] Run the SQL in the actual Supabase project and verify tables, RLS policies, function, and grants live.
- [ ] Configure custom SMTP and test signup confirmation and password reset to a non-team email address.
- [ ] Deploy a preview build and test guest play, daily/archive, Unlimited stats, account sign-in/out, refresh persistence, cloud sync on a second device, and leaderboard opt-in/out.
- [ ] Add a secure self-service account deletion flow before public signup.
- [ ] Decide whether Unlimited stats should sync across devices; current implementation is browser-local.
- [ ] Perform physical iPhone/iPad testing and keyboard/screen-reader acceptance checks.
- [ ] Review anti-cheat expectations: answer graph and puzzle schedule remain embedded in the static page, and leaderboard scores are client-reported.
- [ ] Only after all tests pass, merge the development branch into main to publish.

## Verification boundaries

The current puzzle graph and generated-date simulation were checked directly from the repository's embedded data. The local migration-builder implementation passed synthetic CSV tests for both MLB-only default behavior and explicit all-leagues mode. The committed repository copy has been syntax-reviewed and its parsing/footer regex corrected, but still needs to be run against the supplied CSV files. The browser UI changes were statically inspected but not yet exercised in a deployed browser session. The Supabase SQL has not been run against the live project. No real signup email, cross-device sync, account deletion, or physical-device test is claimed.
