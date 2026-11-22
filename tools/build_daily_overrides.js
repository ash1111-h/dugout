#!/usr/bin/env node
// Writes D.ovr into index.html: deterministic modern-era swaps for a share of prebuilt daily puzzles.
// D.sch (the original 1,100 pairs) is never touched; days 1-4 are always modern-era (the Dugout 2.0 launch week) and so are ~35% of later days;
// the original pairs 1-4 were already served on the previous site, so they are relocated to D.ext instead of replayed.
// Displaced original pairs are kept in D.ext and play on days 1101+, so no original puzzle is discarded.
// Usage: node tools/build_daily_overrides.js index.html [share=0.35]
const fs = require('fs'), path = require('path');
const file = process.argv[2], share = +(process.argv[3] || 0.35);
const H = require(path.join(__dirname, '..', 'tests', 'harness'))(file);
const { P, D } = H, FIRST_DAY = 1, FORCED_DAYS = 4, COOLDOWN = 24;
const eff = n => H.scheduledPair(n);
const used = new Set(); // unordered pairs already in the schedule or overrides
for (const [a, b] of D.sch) used.add(a < b ? a + '|' + b : b + '|' + a);
const ovr = {}; delete D.ext; D.ovr = ovr; // rebuild from scratch so reruns are idempotent
for (let n = FIRST_DAY; n <= D.sch.length; n++) {
  const ds = H.dateForDayNum(n), rng = H.mulberry32(H.xmur3('dugout-modern-swap-v1-' + ds)());
  const forced = n <= FORCED_DAYS;
  if (!forced && rng() >= share) continue;
  const lane = forced ? (n % 2 ? 'rookie' : 'veteran') : (rng() < 0.5 ? 'rookie' : 'veteran'), cfg = H.recipeFor(ds);
  const avoid = new Set();
  for (let d = Math.max(1, n - COOLDOWN); d <= Math.min(D.sch.length, n + COOLDOWN); d++) if (d !== n) { const p = H.scheduledPair(d); avoid.add(H.IDX.get(p[0])); avoid.add(H.IDX.get(p[1])); }
  const avoidPairs = used;
  const pz = H.genModernPuzzle(rng, cfg, lane, avoidPairs, avoid, forced ? 4 : 0); // launch week: only multi-season regulars
  if (!pz) continue;
  const a = P[pz.start].i, b = P[pz.target].i; ovr[n] = [a, b]; D.ovr = ovr; used.add(a < b ? a + '|' + b : b + '|' + a);
}
const html = fs.readFileSync(file, 'utf8'), m = html.match(/const D = (\{.*?\});\s*\n\(function \(\) \{/s);
// Order the displaced originals so the 24-day player cooldown holds across the whole effective schedule.
const effective = []; for (let n = 1; n <= D.sch.length; n++) effective.push(ovr[n] || D.sch[n - 1]);
const pool = Object.keys(ovr).map(Number).sort((a, b) => a - b).map(n => D.sch[n - 1]), ext = []; let relaxed = 0;
while (pool.length) {
  const recent = new Set(); for (const e of effective.slice(-COOLDOWN)) { recent.add(e[0]); recent.add(e[1]); }
  let k = pool.findIndex(e => !recent.has(e[0]) && !recent.has(e[1]));
  if (k < 0) { k = 0; relaxed++; }
  const [e] = pool.splice(k, 1); ext.push(e); effective.push(e);
}
console.log('relocated originals:', ext.length, '; placed with cooldown relaxed:', relaxed);
const data = JSON.parse(m[1]); data.ovr = ovr; data.ext = ext;
fs.writeFileSync(file, html.slice(0, m.index + 'const D = '.length) + JSON.stringify(data) + html.slice(m.index + 'const D = '.length + m[1].length));
console.log('overrides written:', Object.keys(ovr).length, 'of', D.sch.length - FIRST_DAY + 1, 'eligible days');
