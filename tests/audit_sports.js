// Data checks for the football and basketball datasets. Usage: node tests/audit_sports.js
const fs = require('fs'), path = require('path');
let failed = 0; const ck = (n, ok, d = '') => { if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? ' — ' + d : '')); };
for (const [name, file, minPlayers, yMin, yMax] of [['football', 'nfl.json', 9000, 1999, 2025], ['basketball', 'nba.json', 3000, 1950, 2026]]) {
  const d = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'sports', file), 'utf8')); const { p, ts, tn } = d;
  ck(`[${name}] enough players`, p.length >= minPlayers, p.length + ' players');
  ck(`[${name}] unique IDs`, new Set(p.map(x => x.i)).size === p.length);
  ck(`[${name}] team-season refs valid`, p.every(x => x.t.concat(x.x).every(t => Number.isInteger(t) && t >= 0 && t < ts.length)) && ts.every(([y, t]) => t >= 0 && t < tn.length));
  ck(`[${name}] solid and cameo sets disjoint, every player has a solid season`, p.every(x => x.t.length > 0 && !x.t.some(t => x.x.includes(t))));
  ck(`[${name}] season range`, ts.every(([y]) => y >= yMin && y <= yMax), `${Math.min(...ts.map(t => t[0]))}-${Math.max(...ts.map(t => t[0]))}`);
  ck(`[${name}] fame/familiarity fields in range`, p.every(x => x.f >= 0 && x.f <= 20 && Number.isInteger(x.m) && x.m >= 0 && x.m <= 100 && x.a <= x.b));
  // connectivity over solid links
  const roster = new Map(); p.forEach((x, i) => x.t.forEach(t => { (roster.get(t) || roster.set(t, []).get(t)).push(i); }));
  const seen = new Int8Array(p.length); let best = 0;
  for (let s = 0; s < p.length; s++) { if (seen[s]) continue; let q = [s], n = 0; seen[s] = 1; while (q.length) { const u = q.pop(); n++; for (const t of p[u].t) for (const v of roster.get(t)) if (!seen[v]) { seen[v] = 1; q.push(v); } } best = Math.max(best, n); }
  ck(`[${name}] one connected component holds >= 99% of players`, best / p.length >= 0.99, (100 * best / p.length).toFixed(2) + '%');
  const dup = {}; p.forEach(x => dup[x.n] = (dup[x.n] || 0) + 1); console.log(`  info: ${Object.values(dup).filter(c => c > 1).length} shared names (shown with career years in the game)`);
}
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED'); process.exit(failed ? 1 : 0);
