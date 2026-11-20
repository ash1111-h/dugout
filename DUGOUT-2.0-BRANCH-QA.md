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

- [x] Retrieve the SABR/Lahman 2025 CSVs (People, Appearances, Teams, AllstarFull, AwardsPlayers, HallOfFame) from a pinned, byte-for-byte mirror of the official release and run the migration builder. The official SABR page identifies the 1871–2025 CSV release; source attribution and CC BY-SA 3.0 are preserved.
- [x] Audit the migrated graph and published schedule: 21,227 unique players, 3,264 team-seasons, 221 team labels, latest season 2025; all 1,100 original pairs preserved and valid. Route distribution after migration: 308 puzzles at 2 links, 463 at 3, 300 at 4, and 29 at 5; no out-of-range routes.
- [x] Check autocomplete search performance against the 21,227-player data in Node: ~0.4–0.7 ms per search for representative queries on this test environment. This is not a real-phone benchmark.
- [ ] Run the SQL in the actual Supabase project and verify tables, RLS policies, function, and grants live.
- [ ] Configure custom SMTP and test signup confirmation and password reset to a non-team email address.
- [ ] Deploy a preview build and test guest play, daily/archive, Unlimited stats, account sign-in/out, refresh persistence, cloud sync on a second device, and leaderboard opt-in/out.
- [ ] Add a secure self-service account deletion flow before public signup.
- [ ] Decide whether Unlimited stats should sync across devices; current implementation is browser-local.
- [ ] Perform physical iPhone/iPad testing and keyboard/screen-reader acceptance checks.
- [ ] Review anti-cheat expectations: answer graph and puzzle schedule remain embedded in the static page, and leaderboard scores are client-reported.
- [ ] Only after all tests pass, merge the development branch into main to publish.

## Verification boundaries

The migrated puzzle graph was checked in GitHub Actions against all 1,100 published pairs, with all routes remaining 2–5 links. The 200-day future-generation simulation and the original graph checks were also completed. The committed migration builder ran successfully against the real 2025 People, Appearances, and Teams files. The pinned mirror commit identifies itself as an unedited byte-for-byte copy of SABR's official 2025 CSV release. The output was audited in GitHub Actions and downloaded for local inspection. The migrated inline JavaScript passed Node syntax checking and autocomplete search was microbenchmarked locally. The browser UI changes have not yet been exercised in a deployed browser session. The Supabase SQL has not been run against the live project. No real signup email, cross-device sync, account deletion, or physical-device test is claimed.
