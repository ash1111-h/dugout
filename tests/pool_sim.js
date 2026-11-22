// Compares Unlimited pool/era settings. Usage: node tests/pool_sim.js [html] [puzzlesPerCell=150]
const path = require('path');
const H = require('./harness')(process.argv[2] || path.join(__dirname, '..', 'index.html')), P = H.P;
const n = +(process.argv[3] || 150), pct = (a, b) => +(100 * a / b).toFixed(1);
const med = a => { a = a.slice().sort((x, y) => x - y); return a[a.length >> 1]; };
const rows = [];
for (const pool of ['famous', 'mixed', 'deep']) for (const era of ['mixed', 'modern', 'historical']) {
  const rng = H.mulberry32(99), hist = []; let any = 0, deb = 0, deb2425 = 0, obsc = 0, slots = 0, ok = 0; const ms = [];
  for (let k = 0; k < n; k++) {
    const pz = H.unlimitedPuzzle(rng, H.DIFF.medium, hist, { pool, era }); hist.push(pz); if (hist.length > 30) hist.shift();
    const e = [P[pz.start], P[pz.target]];
    if (H.bfsS(pz.start)[pz.target] >= 2) ok++;
    if (e.some(p => p.b >= 2020)) any++; if (e.some(p => p.a >= 2020)) deb++; if (e.some(p => p.a >= 2024)) deb2425++;
    for (const p of e) { slots++; ms.push(p.m); if (p.m < 10) obsc++; }
  }
  rows.push({ pool, era, puzzles: n, 'solvable %': pct(ok, n), '>=1 active 2020+ %': pct(any, n), '>=1 recent debut %': pct(deb, n), '>=1 debut 2024-25 %': pct(deb2425, n), 'median endpoint familiarity (0-100)': med(ms), 'endpoints with familiarity <10 %': pct(obsc, slots) });
}
console.table(rows); console.log(JSON.stringify(rows));
