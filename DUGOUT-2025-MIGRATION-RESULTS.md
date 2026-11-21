# Dugout 2.0 — Lahman 2025 migration results

**Status:** Successful preview build and graph audit. Not merged to main or published.

## Source

- Official database: SABR Lahman Database, 1871–2025 CSV release.
- Official page: https://sabr.org/lahman-database/
- Retrieval: pinned GitHub mirror commit `0377e0b8d3f1b8f6710cc4faee7d842d0e81f344`, whose README states that it is an unedited byte-for-byte copy of SABR's official CSV release.
- Attribution: Sean Lahman and the Society for American Baseball Research (SABR), CC BY-SA 3.0.
- MLB major-league league IDs included: NA, NL, AA, UA, PL, FL, AL. Negro Leagues and other non-MLB leagues are excluded from this game's default roster.

## Migration output

| Metric | Result |
|---|---:|
| People.csv source rows | 24,270 |
| Appearances.csv source rows | 128,512 |
| Teams.csv source rows | 3,614 |
| Players in Dugout | 21,227 |
| Players added vs. previous embedded database | 17,536 |
| Team-seasons | 3,264 |
| Team labels | 221 |
| Latest player season | 2025 |
| Published daily puzzles preserved | 1,100 |

## Graph and puzzle audit

- 21,227 unique player IDs; no duplicates.
- No invalid team-season indices, duplicate player team-season references, or standard/cameo overlaps.
- All 1,100 original daily pairs preserved byte-for-byte.
- No invalid daily player references or duplicate unordered matchups.
- Every existing daily puzzle still has a standard path between 2 and 5 links.

| Shortest route | Puzzles |
|---:|---:|
| 2 links | 308 |
| 3 links | 463 |
| 4 links | 300 |
| 5 links | 29 |
| **Total** | **1,100** |

## Additional checks

- Migrated HTML: 2,318,516 bytes.
- Embedded JSON parsed successfully.
- Inline JavaScript passed `node --check`.
- Autocomplete's current full scan was benchmarked against the 21,227-player database: representative queries averaged approximately 0.4–0.7 ms/search in the Node test environment. This is not a physical iPhone benchmark.
- The 1,100 daily puzzles remain unchanged; no attempt was made to regenerate historical puzzle dates.

## Preview artifact

The GitHub Actions workflow produced `dugout-2025-migration-preview` (artifact ID 14679912920, 14-day retention), containing:
- `index-updated.html`
- `People.csv`
- `Appearances.csv`
- `Teams.csv`
- `readme2025.txt`

The artifact is also available in the current ChatGPT session as `dugout-2025-migration-preview.zip`.

## Still required before release

- Real browser testing of the migrated game, including mobile devices.
- Test all new features (rarity, Unlimited stats, account switching).
- Verify live Supabase SQL/RLS, email delivery, and cross-device account sync.
- Add self-service account deletion before public signup.
- Review anti-cheat/leaderboard assumptions.
- Only after those checks pass, merge the development branch into main.


## Addendum (2026-11-21): corrections after integration

- **Counts.** The 3,264 team-seasons / 221 labels above included duplicate league-suffixed labels for 19th-century teams that already existed in the game. The builder now keeps the original label, giving **3,104 team-seasons (3,102 referenced) and 148 labels**. Players (21,227), career span (1871-2025) and the 1,100 pairs/route distribution (308/463/300/29) are unchanged.
- **Fame calibration.** New players' fame is mapped onto the game's existing scale using the 3,325 legacy players whose careers are unchanged; 366 legacy players with extended careers were raised (never lowered). The previous builder output used an incompatible scale.
- **New `r` field** on every player (regular seasons) and a `D.ovr`/`D.ext` daily override/relocation table written by `tools/build_daily_overrides.js`. `D.sch` is unchanged.
- **Reproduce:** `python tools/build_dugout_database.py <main index.html> ... --output out.html`, then `python tools/splice_data.py out.html index.html rebuilt.html`, then `node tools/build_daily_overrides.js rebuilt.html 0.35`; the data object must equal the one in `index.html` (CI checks this).
