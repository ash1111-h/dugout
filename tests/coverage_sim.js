// Modern-player coverage simulation using the real generator code from index.html.
// Usage: node tests/coverage_sim.js [html] [unlimitedPerDifficulty=400] [dailyDays=1100]
const load = require('./harness');
const html = process.argv[2] || require('path').join(__dirname, '..', 'index.html');
const nPer = +(process.argv[3] || 400), nDaily = +(process.argv[4] || 1100);
const H = load(html), P = H.P;
const pct = (a, b) => +(100 * a / b).toFixed(1);
function tally(pzs) {
  let n = pzs.length, act = 0, deb = 0, deb2425 = 0, any = 0, two = 0, anyDeb = 0, bothDeb = 0, players = 0, solvable = 0, anyDeb2425 = 0;
  const lanes = {}, eras = { 'pre-2000 only': 0, '2000-2019 (no 2020+ player)': 0, 'has 2020+ player': 0 }, links = {};
  for (const pz of pzs) {
    const A = P[pz.start], B = P[pz.target];
    const m = [A, B].map(p => p.b >= 2020), d = [A, B].map(p => p.a >= 2020), d2 = [A, B].map(p => p.a >= 2024);
    for (let k = 0; k < 2; k++) { players++; if (m[k]) act++; if (d[k]) deb++; if (d2[k]) deb2425++; }
    if (m[0] || m[1]) any++; if (m[0] && m[1]) two++;
    if (d[0] || d[1]) anyDeb++; if (d[0] && d[1]) bothDeb++; if (d2[0] || d2[1]) anyDeb2425++;
    const latest = Math.max(A.b, B.b);
    eras[latest >= 2020 ? 'has 2020+ player' : (latest >= 2000 ? '2000-2019 (no 2020+ player)' : 'pre-2000 only')]++;
    lanes[pz.lane || '?'] = (lanes[pz.lane || '?'] || 0) + 1;
    const dS = H.bfsS(pz.start)[pz.target], dA = H.bfsA(pz.start)[pz.target];
    if (dS >= 2 && dA >= 2) { solvable++; links[dS] = (links[dS] || 0) + 1; }
  }
  return {
    puzzles: n,
    'solvable with a valid 2-5 link route (%)': pct(solvable, n),
    'puzzles with >=1 player active 2020-2025 (%)': pct(any, n),
    'puzzles with 2 players active 2020-2025 (%)': pct(two, n),
    'endpoint slots active 2020-2025 (%)': pct(act, players),
    'puzzles with >=1 first-appearance 2020+ ("recent debut") (%)': pct(anyDeb, n),
    'puzzles with 2 recent debuts (%)': pct(bothDeb, n),
    'endpoint slots that are recent debuts (%)': pct(deb, players),
    'puzzles with >=1 debut in 2024-2025 (%)': pct(anyDeb2425, n),
    'endpoint slots debuting 2024-2025 (%)': pct(deb2425, players),
    'era of the most recent endpoint (%)': Object.fromEntries(Object.entries(eras).map(([k, v]) => [k, pct(v, n)])),
    'lane drawn (%)': Object.fromEntries(Object.entries(lanes).map(([k, v]) => [k, pct(v, n)])),
    'shortest solid route length (counts)': links
  };
}
const out = { source: html, unlimited: {}, daily: null };
const t0 = Date.now();
let seed = 12345; const rng = H.mulberry32(seed);
for (const d of ['easy', 'medium', 'hard']) {
  const hist = [], pzs = [];
  for (let k = 0; k < nPer; k++) { const pz = H.unlimitedPuzzle(rng, H.DIFF[d], hist); if (!pz) throw new Error('no puzzle'); hist.push(pz); if (hist.length > 30) hist.shift(); pzs.push(pz); }
  out.unlimited[d] = tally(pzs);
}
// Daily: all generated days after the 1,100 published pairs
const first = H.D.sch.length + (H.D.ext || []).length + 1, dpz = [], rows = [];
for (let n = first; n < first + nDaily; n++) {
  const pz = H.dailyPuzzleFor(H.dateForDayNum(n)); if (!pz) throw new Error('daily null day ' + n);
  dpz.push(pz); rows.push([n, H.dateForDayNum(n), P[pz.start].n + ' (' + P[pz.start].a + '-' + P[pz.start].b + ')', P[pz.target].n + ' (' + P[pz.target].a + '-' + P[pz.target].b + ')', pz.lane]);
}
out.daily = tally(dpz);
out.dailyFirstDay = first; out.dailyFirstDate = H.dateForDayNum(first); out.dailyLastDate = H.dateForDayNum(first + nDaily - 1);
out.dailySample = rows.slice(0, 20);
// Effective prebuilt schedule (originals + modern swaps + relocated originals) vs original D.sch
const effPz = []; for (let n = 1; n <= H.D.sch.length + (H.D.ext || []).length; n++) { const p = H.scheduledPair(n); effPz.push({ start: H.IDX.get(p[0]), target: H.IDX.get(p[1]), lane: (H.D.ovr && H.D.ovr[n]) ? 'modern swap' : 'original' }); }
out.effectivePrebuilt = tally(effPz);
out.modernSwaps = Object.entries(H.D.ovr || {}).map(([n, [a, b]]) => [+n, H.dateForDayNum(+n), P[H.IDX.get(a)].n + ' (' + P[H.IDX.get(a)].a + '-' + P[H.IDX.get(a)].b + ')', P[H.IDX.get(b)].n + ' (' + P[H.IDX.get(b)].a + '-' + P[H.IDX.get(b)].b + ')']);
out.firstGeneratedDay = H.D.sch.length + (H.D.ext || []).length + 1;
// Published schedule (days 1..1100) for reference
const pub = H.D.sch.map(([a, b]) => ({ start: H.IDX.get(a), target: H.IDX.get(b), lane: 'published' }));
out.publishedSchedule = tally(pub);
out.seconds = (Date.now() - t0) / 1000;
console.log(JSON.stringify(out, null, 1));
