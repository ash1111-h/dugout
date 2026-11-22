// Database + graph audit. Usage: node tests/audit_db.js [html] [baseRef=origin/main]
// Compares the embedded data against the base ref's index.html (published schedule must be identical).
const fs = require('fs'), path = require('path'), cp = require('child_process');
const html = process.argv[2] || path.join(__dirname, '..', 'index.html');
const ref = process.argv[3] || 'origin/main';
const parse = s => JSON.parse(s.match(/const D = (\{.*?\});\s*\n\(function \(\) \{/s)[1]);
const D = parse(fs.readFileSync(html, 'utf8'));
const O = parse(cp.execSync(`git show ${ref}:index.html`, { cwd: path.join(__dirname, '..'), maxBuffer: 1 << 29 }).toString());
const res = []; let fail = 0;
const check = (name, ok, detail = '') => { res.push({ name, ok, detail }); if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); };
const P = D.p, TS = D.ts;
const ids = P.map(p => p.i), idset = new Set(ids), idx = new Map(ids.map((i, k) => [i, k]));
check('player IDs unique', idset.size === ids.length, ids.length + ' players');
check('every legacy player ID preserved', O.p.every(p => idset.has(p.i)), O.p.length + ' legacy IDs');
check('legacy team-season index table is a prefix of the new one', O.ts.every((t, k) => TS[k] && TS[k][0] === t[0] && D.tn[TS[k][1]] === O.tn[t[1]]), O.ts.length + ' entries');
let bad = 0;
for (const p of P) {
  const all = p.t.concat(p.x);
  if (new Set(p.t).size !== p.t.length || new Set(p.x).size !== p.x.length || p.t.some(t => p.x.includes(t))) bad++;
  else if (all.some(t => !Number.isInteger(t) || t < 0 || t >= TS.length)) bad++;
  else if (!(p.a <= p.b) || !(p.f >= 0 && p.f <= 38.9) || !Number.isInteger(p.r) || p.r < 0) bad++;
  else if (all.length === 0) bad++;
  else { const ys = all.map(t => TS[t][0]); if (Math.min(...ys) !== p.a || Math.max(...ys) !== p.b) bad++; }
}
check('team-season references valid; no duplicates/overlap; a/b match seasons; f,r sane; no empty careers', bad === 0, bad + ' bad players');
check('latest season is 2025', Math.max(...P.map(p => p.b)) === 2025);
check('team-season names valid', TS.every(t => D.tn[t[1]] !== undefined));
// legacy connections: any legacy player who lost a (year,team) season they had before?
const key = t => TS[t][0] + '|' + D.tn[TS[t][1]], okey = (t, d) => d.ts[t][0] + '|' + d.tn[d.ts[t][1]];
const np = new Map(P.map(p => [p.i, p])); let lost = 0, lostPlayers = 0, solidToCameo = 0, ex = [];
for (const o of O.p) {
  const n = np.get(o.i), have = new Set(n.t.concat(n.x).map(key)); let l = 0;
  for (const t of o.t.concat(o.x)) if (!have.has(okey(t, O))) { l++; }
  const nSolid = new Set(n.t.map(key));
  for (const t of o.t) if (have.has(okey(t, O)) && !nSolid.has(okey(t, O))) solidToCameo++;
  if (l) { lostPlayers++; lost += l; if (ex.length < 5) ex.push(o.n); }
}
check('no legacy team-season dropped by migration', lost === 0, `${lost} dropped across ${lostPlayers} players ${ex.join(', ')}; ${solidToCameo} legacy solid seasons now cameo (data revisions)`);
// schedule
const S = D.sch;
check('published schedule length is 1,100', S.length === 1100);
check('published schedule identical to ' + ref, JSON.stringify(S) === JSON.stringify(O.sch));
check('schedule references valid players', S.every(([a, b]) => idset.has(a) && idset.has(b)));
const pk = S.map(([a, b]) => a < b ? a + '|' + b : b + '|' + a);
check('no duplicate scheduled pairs', new Set(pk).size === pk.length);
// graph: solid adjacency, early-exit BFS capped at depth 5
const rosterS = new Map();
P.forEach((p, i) => p.t.forEach(t => { (rosterS.get(t) || rosterS.set(t, []).get(t)).push(i); }));
const adjCache = new Array(P.length);
const adj = i => { let s = adjCache[i]; if (s) return s; s = new Set(); for (const t of P[i].t) for (const j of rosterS.get(t)) if (j !== i) s.add(j); return adjCache[i] = s; };
function dist(src, dst, cap = 5) {
  const d = new Map([[src, 0]]); let q = [src];
  for (let depth = 1; depth <= cap && q.length; depth++) { const nq = []; for (const u of q) for (const v of adj(u)) if (!d.has(v)) { d.set(v, depth); if (v === dst) return depth; nq.push(v); } q = nq; }
  return null;
}
const t0 = Date.now(), len = {}; let badRoute = 0;
for (const [a, b] of S) { const d = dist(idx.get(a), idx.get(b)); if (d === null || d < 2) badRoute++; else len[d] = (len[d] || 0) + 1; }
check('every published puzzle has a 2-5 link solid route', badRoute === 0, JSON.stringify(len) + ` in ${Date.now() - t0}ms`);
const exp = JSON.stringify({ 2: 308, 3: 463, 4: 300, 5: 29 });
check('route distribution matches migration report (308/463/300/29)', JSON.stringify(len) === exp);

// ---- effective schedule (after modern-era shuffle) ----
const OV = D.ovr || {}, EXT = D.ext || [], L = S.length;
const eff = []; for (let n = 1; n <= L; n++) eff.push(OV[n] || S[n - 1]); for (const e of EXT) eff.push(e);
check('launch days 1-4 are modern-era swaps; the originals already served on the old site (old days 1-4) are not replayed before day 1101', [1, 2, 3, 4].every(n => OV[n]) && S.slice(0, 4).every(p => eff.slice(0, L).every(q => q[0] !== p[0] || q[1] !== p[1])));
check('overrides only on days 1..1100', Object.keys(OV).every(k => +k >= 1 && +k <= L));
const displaced = Object.keys(OV).map(k => S[+k - 1]);
check('every displaced original pair is kept in D.ext (nothing discarded)', JSON.stringify(displaced.slice().sort()) === JSON.stringify(EXT.slice().sort()), `${Object.keys(OV).length} swaps, ${EXT.length} relocated`);
check('every original pair still plays exactly once', (() => { const c = new Map(); [...eff].forEach(([a, b]) => { const k = a < b ? a + '|' + b : b + '|' + a; c.set(k, (c.get(k) || 0) + 1); }); return pk.every(k => c.get(k) === 1); })());
const ek = eff.map(([a, b]) => a < b ? a + '|' + b : b + '|' + a);
check('effective schedule: no duplicate pairs', new Set(ek).size === ek.length, eff.length + ' prebuilt days');
check('effective schedule: valid player IDs', eff.every(([a, b]) => idset.has(a) && idset.has(b)));
let badE = 0, lenE = {}; for (const [a, b] of Object.values(OV)) { const d = dist(idx.get(a), idx.get(b)); if (d === null || d < 2) badE++; else lenE[d] = (lenE[d] || 0) + 1; }
check('every override has a 2-5 link solid route', badE === 0, JSON.stringify(lenE));
let cool = 0; for (let n = 0; n < eff.length; n++) for (let m = Math.max(0, n - 24); m < n; m++) if (eff[n].some(x => eff[m].includes(x))) { cool++; break; }
check('24-day player cooldown holds across the effective schedule (<=5 unavoidable exceptions at the end of the relocated block)', cool <= 5, cool + ' days relax it');
// connectivity of solid graph
const comp = new Int32Array(P.length).fill(-1); let nc = 0; const sizes = [];
for (let i = 0; i < P.length; i++) { if (comp[i] >= 0) continue; let c = 0, st = [i]; comp[i] = nc; while (st.length) { const u = st.pop(); c++; for (const v of adj(u)) if (comp[v] < 0) { comp[v] = nc; st.push(v); } } sizes.push(c); nc++; }
sizes.sort((a, b) => b - a);
const isolated = P.filter((p, i) => adj(i).size === 0).length;
check('every player with a solid link is in one connected component', sizes[0] === P.length - isolated, `largest component ${sizes[0]} of ${P.length - isolated} players with solid links; ${isolated} cameo-only players (no 10+ game season) can only be guessed, never used as endpoints`);
// modern data present
check('2020-2025 data present', TS.filter(t => t[0] >= 2020).length > 150 && P.filter(p => p.a >= 2020).length > 1000, `${TS.filter(t => t[0] >= 2020).length} team-seasons 2020+, ${P.filter(p => p.b >= 2020).length} active 2020+, ${P.filter(p => p.a >= 2020).length} debuts 2020+`);
console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED');
process.exit(fail ? 1 : 0);
