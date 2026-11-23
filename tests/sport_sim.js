// Generic puzzle simulation for the football/basketball pages (and baseball).
// Usage: node tests/sport_sim.js <html> [unlimitedPerDifficulty=150] [dailyDays=200]
const load = require('./harness');
const html = process.argv[2], nPer = +(process.argv[3] || 150), nDaily = +(process.argv[4] || 200);
const H = load(html), P = H.P;
const MODERN = +(require('fs').readFileSync(html, 'utf8').match(/const MODERN_FROM = (\d+)/)[1]);
const pct = (a, b) => +(100 * a / b).toFixed(1);
const med = a => { a = a.slice().sort((x, y) => x - y); return a[a.length >> 1]; };
function tally(pzs) {
  let n = pzs.length, solv = 0, act = 0, deb = 0, anyModern = 0; const ms = [], links = {}, years = [];
  for (const pz of pzs) {
    const A = P[pz.start], B = P[pz.target];
    for (const p of [A, B]) { ms.push(p.m || 0); if (p.b >= MODERN) act++; if (p.a >= MODERN) deb++; years.push(p.a); }
    if (A.b >= MODERN || B.b >= MODERN) anyModern++;
    const dS = H.bfsS(pz.start)[pz.target], dA = H.bfsA(pz.start)[pz.target];
    if (dS >= 2 && dA >= 2) { solv++; links[dS] = (links[dS] || 0) + 1; }
  }
  return { puzzles: n, 'solvable (%)': pct(solv, n), 'puzzles with a modern player (%)': pct(anyModern, n), 'endpoints active in modern era (%)': pct(act, 2 * n), 'endpoints that debuted modern (%)': pct(deb, 2 * n), 'median endpoint familiarity m': med(ms), 'endpoints with m<10 (%)': pct(ms.filter(x => x < 10).length, 2 * n), 'median endpoint debut year': med(years), 'route lengths': links };
}
const out = { page: html, players: P.length, modernFrom: MODERN, unlimited: {} };
const rng = H.mulberry32(777); const t0 = Date.now();
for (const d of ['easy', 'medium', 'hard']) {
  const hist = [], pzs = []; let fails = 0;
  for (let k = 0; k < nPer; k++) { const pz = H.unlimitedPuzzle(rng, H.DIFF[d], hist); if (!pz) { fails++; continue; } hist.push(pz); if (hist.length > 30) hist.shift(); pzs.push(pz); }
  out.unlimited[d] = Object.assign({ failures: fails }, tally(pzs));
}
const first = (H.D.sch.length + H.D.ext.length) + 1, dp = []; let dnull = 0; const sample = [];
for (let n = first; n < first + nDaily; n++) { const pz = H.dailyPuzzleFor(H.dateForDayNum(n)); if (!pz) { dnull++; continue; } dp.push(pz); if (sample.length < 8) sample.push([H.dateForDayNum(n), P[pz.start].n + ' (' + P[pz.start].a + '-' + P[pz.start].b + ')', P[pz.target].n + ' (' + P[pz.target].a + '-' + P[pz.target].b + ')', pz.lane]); }
out.daily = Object.assign({ nullDays: dnull }, tally(dp)); out.dailySample = sample; out.seconds = (Date.now() - t0) / 1000;
console.log(JSON.stringify(out, null, 1));
