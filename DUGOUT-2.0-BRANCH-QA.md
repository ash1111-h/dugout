# Dugout 2.0 branch — implementation and verification status

**Branch:** `dugout-2.0-upgrade` · **Last verified:** 2026-11-22 · **Status: code-complete and tested offline; live Supabase, SMTP, account deletion and real-device checks are still open, see below.**
The Daily schedule was restarted so that **2026-11-22 is puzzle #1**.

## Completed in this branch (earlier work, preserved)

- [x] Actual-play-path rarity (failed guesses excluded), shown in results and share text; bands calibrated on the 1,100 published routes.
- [x] Persistent local Unlimited stats (played/wins/losses/current/best run/distribution), separate keys for guest and each account. Local only; not cloud-synced.
- [x] Skip-to-game link; accessible name/description on the player combobox.
- [x] Combined `supabase-schema.sql` plus the two staged scripts.
- [x] Lahman migration builder (MLB-only by default) and CI workflow.

## Completed in this round

- [x] **2025 roster integrated into the playable `index.html`**: 21,227 players, 3,104 team-seasons, 148 team labels, 1871–2025. (The earlier report's 3,264 / 221 counted duplicate league-suffixed labels; see the migration report addendum.)
- [x] **Builder fame fix.** Fame for new players was on a different scale from the game's existing fame (legacy median 1.7 vs about 15), which would have made about 95% of generated endpoints obscure journeymen. Fame is now calibrated onto the legacy scale; 366 legacy players with extended careers were refreshed upward only (Ohtani 0.3 to 6.3, Soto 0.4 to 5.4).
- [x] **Builder label fix.** Original team-season labels are reused instead of gaining a league suffix, so no legacy team-season changes name (audit: 0 dropped).
- [x] **New `r` field** (regular seasons: 100+ G, 20+ GS or 50+ pitching appearances in a season). Fame accumulates over a career, so the old `minF`/`minA` floors can never admit a rookie; the modern lanes use `r` instead.
- [x] **Era-lane generator** used by Unlimited and generated Daily puzzles: classic (original recipes, unchanged), historical (career ended by 1999), veteran (active 2020+, debuted earlier), rookie (first MLB appearance 2020+). Unlimited mix 35/15/20/30; Daily 60/15/10/15.
- [x] **Daily restart and shuffle.** `D.sch` (the original 1,100 pairs) is untouched, but the start date moved to 2026-11-22 (day 1). Days 1–4 are forced modern-era puzzles (multi-season regulars paired with well-known players); 412 modern-era pairs in total were swapped into days 1–1100 (`D.ovr`). The 412 displaced originals, including the four already served on the previous site (Nov 19–22), were relocated to days 1101–1512 (`D.ext`); nothing was discarded. Generated days start at day 1513 (2031-01-12).
- [x] Tests added in `tests/` and CI updated (see below).

## Test results (all run on 2026-11-21 against this branch)

| Check | Result |
|---|---|
| Player IDs unique; all 3,691 legacy IDs preserved | PASS |
| Team-season refs valid, no overlap, a/b match seasons, no empty careers | PASS |
| No legacy team-season dropped | PASS (0 dropped) |
| Original schedule identical to `main` (1,100 pairs); no duplicates; valid refs | PASS |
| Original routes 308/463/300/29 (2/3/4/5 links) | PASS |
| Effective schedule (1,512 days): no duplicate pairs, every original pair plays once, all overrides routable (2-5 links), launch-week originals not replayed before day 1101 | PASS |
| 24-day player cooldown across effective schedule | PASS with 2 unavoidable exceptions at the end of the relocated block |
| All 16,454 players with a solid link in one connected component | PASS (4,773 cameo-only players can be guessed but never appear as endpoints) |
| Embedded data reproduces byte-for-byte from the pinned Lahman CSVs plus `tools/` | PASS (run locally; CI step added, not yet run on GitHub) |
| JavaScript syntax (`node --check` on inline script, tests, tools) | PASS |
| Headless Chromium, desktop 1280x800 and iPhone-sized 390x844 (touch emulation): load with no JS errors, Daily #2 matches schedule, autocomplete (incl. modern players), wrong guess, full win, rarity card, share text, rarity identical with and without failed guesses, short-stint label, invalid input, Unlimited win and loss, stats persistence after reload, guest isolation from another profile key, 60 in-browser Unlimited puzzles valid, skip link and combobox attributes, attribution | PASS (all assertions, both viewports) |
| No horizontal overflow at 390 px; screenshots reviewed by eye | PASS |
| No secret/service-role key in `index.html` (only the publishable key) | PASS |

### Modern-player coverage (real simulation output, `node tests/coverage_sim.js index.html 400 1100`)

"Active 2020-2025" = last MLB season 2020 or later. "Recent debut" = first MLB appearance in 2020 or later; this is a games-based proxy, **not** an official MLB rookie designation.

| 400 Unlimited puzzles per difficulty | Easy | Medium | Hard |
|---|---|---|---|
| Solvable, valid route | 100% | 100% | 100% |
| At least one player active 2020-2025 | 60.8% | 69.5% | 55.0% |
| Two players active 2020-2025 | 44.5% | 4.8% | 0.0% |
| At least one recent debut | 36.5% | 31.5% | 27.8% |
| Two recent debuts | 9.0% | 4.0% | 0.0% |
| At least one debut in 2024-2025 | 9.8% | 10.3% | 4.3% |
| Endpoint slots that are recent debuts | 22.8% | 17.8% | 13.9% |
| Pre-2000-only puzzles | 21.3% | 13.8% | 23.0% |

Daily schedule:

| | Original 1,100 | Effective prebuilt (1,512 days) | Generated days 1513-2612 |
|---|---|---|---|
| At least one player active 2020-2025 | 30.5% | 49.4% | 53.2% |
| At least one recent debut | 0% | 14.9% (225 days) | 18.5% |
| At least one debut in 2024-2025 | 0% | 3.6% | 4.7% |
| Pre-2000-only | 9.5% | 6.9% | 17.9% |

Route lengths are unchanged by difficulty (Easy 2-3, Medium 3-4, Hard 4-5). Easy shows many two-modern puzzles because modern rosters are dense and Easy only allows 2-3 links.

## Known limitations

- Rookie-lane endpoints are chosen by games played, not fame, so some are lesser-known (for example puzzle #10: Junior Guerra to Justin Martinez); launch days 1–4 use a higher bar. Tighten `modernEligible()` if you want more familiar names.
- The modern share is high by design; the original schedule was 30.5% and is now 49.4% on prebuilt days. Tune `ERA_MIX` or the swap share (default 0.35) in `tools/build_daily_overrides.js`.
- The 2020 season was 60 games, so few 2020 players reach the regular-season bar.
- Autocomplete and generation timings were measured in headless Chromium and Node on a server, **not on a phone**.

## Not verified (still open)

- [ ] SQL run against the live Supabase project, RLS behavior, leaderboard reads/writes, auth, email/SMTP, account deletion. The test sandbox cannot reach supabase.co (proxy returned 403), so nothing was run against it. Only the offline-degradation path was tested (Supabase blocked: page loads and guest play works).
- [ ] Guest/account stats separation when actually signing in (only the guest key and an unrelated seeded key were exercised).
- [ ] Cloud sync on a second device; leaderboard opt-in/out.
- [ ] Physical iPhone/iPad, Safari, Firefox and screen-reader testing. Chromium emulation only.
- [ ] Leaderboard remains client-reported and not cheat-proof; the puzzle schedule is embedded in the static page.

GitHub Actions: the migration/audit/coverage workflow passed on GitHub for the 2.0 commit. Changing the start date means players who played the previous Nov 19–21 puzzles keep those results in their stats, but those dates no longer have a puzzle number.

Published with the open items above accepted by the project owner; sign-in, cloud sync and the leaderboard remain unverified.

---

# Dugout 3.0 branch addendum (2026-11-22)

**Verified in this branch:** data/audit (including *LIVE schedule immutable vs main*, `m` field 0-100 on all 21,227 players), exact data reproducibility from the pinned pre-2.0 page plus the frozen schedule, and Playwright tests at 1280x800 and 390x844 covering Era and Players controls, share-image PNG (1080x1080), challenge links (valid, invalid, identical players) plus everything from the 2.0 list.

Unlimited, Mixed pool, 300 puzzles per difficulty (Easy / Medium / Hard): solvable 100/100/100%; at least one player active 2020-25: 66.0/65.3/61.3%; at least one recent debut: 37.7/29.7/33.0%; at least one 2024-25 debut: 8.3/7.3/10.3%; pre-2000-only puzzles: 18.3/16.3/22.7%. Generated Daily days (1513 on): 50.5% any 2020+ player, 17.5% recent debut, 5.0% a 2024-25 debut, all solvable.

Pool comparison (`tests/pool_sim.js`, Medium, 150 puzzles per cell, all 100% solvable). In the *Since 2020* era, endpoints with familiarity below 10 were 0% (Famous), 6.7% (Mixed) and 13.7% (Deep cuts); puzzles with a 2024-25 debut were 24.0%, 14.7% and 19.3% (small samples, so differences between pools in that column are noisy). In the default *Mixed era*, familiarity below 10 was 0% / 4.7% / 3.3% and 2024-25 debuts appeared in 7.3% / 13.3% / 5.3% of puzzles.

**Not verified / limits:** same Supabase items as above (nothing from 3.0 depends on Supabase). The offseason-refresh workflow has not been run. The share image was checked in headless Chromium; the native share sheet on iOS/Android was not tested. Familiarity is a heuristic (it caps at 100, so it does not separate superstars from stars). The prebuilt Daily schedule is unchanged and was not re-scored with `m`.
