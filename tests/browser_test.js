// Headless-Chromium interaction tests (Playwright). Usage: node tests/browser_test.js [outDir]
// Supabase/CDN requests are blocked on purpose: this verifies the guest experience AND that the page
// degrades gracefully when Supabase is unavailable. It does NOT test live Supabase.
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const html = path.join(__dirname, '..', 'index.html');
const H = require('./harness')(html);
const outDir = process.argv[2] || path.join(require('os').tmpdir(), 'dugout-shots'); fs.mkdirSync(outDir, { recursive: true });
const results = []; let failed = 0;
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); };
const NOW = new Date('2026-11-23T12:00:00-08:00');
const day2 = H.dailyPuzzleFor('2026-11-23');
const nameOf = i => H.P[i].n;

async function type(page, text) { await page.fill('#q', ''); await page.type('#q', text, { delay: 0 }); }
async function guessIdx(page, i) { // type the full name and click the matching option
  const p = H.P[i]; await type(page, p.n);
  const li = page.locator('#opts li[data-i="' + i + '"]');
  if (!(await li.count())) throw new Error('option not offered for ' + p.n);
  await li.first().click();
}
async function playRoute(page, path) { for (const i of path.slice(1, -1)) await guessIdx(page, i); }

async function runViewport(browser, label, ctxOpts) {
  const ctx = await browser.newContext({ ...ctxOpts, permissions: ['clipboard-read', 'clipboard-write'] });
  await ctx.route(/cdn\.jsdelivr\.net|supabase\.co/, r => r.abort());
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|net::/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.clock.install({ time: NOW });
  const t0 = Date.now(); await page.goto('file://' + html); await page.waitForSelector('#top .card.start');
  check(`[${label}] page loads and renders the daily board`, true, (Date.now() - t0) + ' ms');
  check(`[${label}] no JavaScript errors on load (Supabase blocked)`, errors.length === 0, errors.join(' | '));
  // date-based consistency: UI shows the same puzzle the deterministic schedule gives for 2026-11-20 (day 2)
  const sn = await page.textContent('#top .card.start .nm'), tn = await page.textContent('#bottom .card.target .nm');
  check(`[${label}] Daily (2026-11-23, shown as #1) matches schedule`, sn === nameOf(day2.start) && tn === nameOf(day2.target), `${sn} -> ${tn}`);
  check(`[${label}] puzzle number shown`, /Puzzle #1/.test(await page.textContent('#pips')));
  // layout
  const ov = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  check(`[${label}] no horizontal overflow`, ov.sw <= ov.iw + 1, `${ov.sw} vs ${ov.iw}`);
  const box = await page.locator('#q').boundingBox();
  check(`[${label}] search input visible and >=40px tall`, box && box.height >= 40 && box.width > 150, JSON.stringify(box));
  await page.screenshot({ path: path.join(outDir, `${label}-daily.png`), fullPage: true });
  // autocomplete: modern + historical players are findable
  for (const [q, want] of [['aaron judge', 'Aaron Judge'], ['skenes', 'Paul Skenes'], ['ohtani', 'Shohei Ohtani'], ['roman anthony', 'Roman Anthony'], ['hank aaron', 'Hank Aaron'], ['zzzzqq', null]]) {
    await type(page, q); const names = await page.locator('#opts li span:first-child').allTextContents();
    const hidden = await page.locator('#opts').isHidden(); const ok = want ? names.includes(want) : hidden;
    check(`[${label}] autocomplete "${q}"`, ok, want ? `got ${names.slice(0, 4).join(', ')}` : 'no matches + message: ' + (await page.textContent('#msg')));
  }
  // in-browser search latency (headless Chromium on this machine; NOT a phone)
  const lat = await page.evaluate(() => { const q = document.getElementById('q'), qs = ['smith', 'jo', 'rodriguez', 'mike tr', 'garcia', 'ju', 'sanchez', 'will']; const ts = []; for (let r = 0; r < 5; r++) for (const s of qs) { q.value = s; const t = performance.now(); q.dispatchEvent(new Event('input', { bubbles: true })); ts.push(performance.now() - t); } ts.sort((a, b) => a - b); return { avg: ts.reduce((a, b) => a + b, 0) / ts.length, p95: ts[Math.floor(ts.length * .95)], max: ts[ts.length - 1] }; });
  check(`[${label}] autocomplete latency on 21,227 players (headless Chromium, not a phone)`, lat.p95 < 50, `avg ${lat.avg.toFixed(2)} ms, p95 ${lat.p95.toFixed(2)} ms, max ${lat.max.toFixed(2)} ms`);
  await page.fill('#q', ''); await page.keyboard.press('Escape');
  // wrong guess then correct route
  const route = H.pathBetween(day2.start, day2.target);
  const adj = H.adjA(day2.start); let wrong = -1; for (let i = 0; i < H.N; i++) if (H.P[i].n === 'Babe Ruth' && !adj.has(i)) wrong = i;
  await guessIdx(page, wrong);
  check(`[${label}] incorrect guess shows a miss and one bad pip`, (await page.locator('#top .miss').count()) === 1 && (await page.locator('#pips .pip.bad').count()) === 1, await page.textContent('#top .miss'));
  await playRoute(page, route);
  await page.waitForSelector('#resultBox .result.win');
  check(`[${label}] daily completes with a win`, true, `${route.length - 1}-link route: ` + route.map(nameOf).join(' > '));
  const ratA = await page.textContent('#resultBox .rarity-line');
  check(`[${label}] rarity card shown`, /\d+\/99/.test(ratA), ratA);
  await page.click('#bShare'); await page.waitForTimeout(150);
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => '')) || await page.inputValue('#shareTxt');
  check(`[${label}] share text has puzzle #, score, rarity and grid`, /^Dugout #1 \d\/6 \| .+ path \(\d+\/99\)\n/.test(clip) && clip.includes('🟥') && clip.includes('🏠'), JSON.stringify(clip));
  await page.screenshot({ path: path.join(outDir, `${label}-result.png`), fullPage: true });
  // rarity ignores failed guesses: replay the identical route with extra wrong guesses -> same score
  await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForSelector('#top .card.start');
  const wrongs = []; for (let i = 0; i < H.N && wrongs.length < 2; i++) if (['Babe Ruth', 'Ted Williams'].includes(H.P[i].n) && !adj.has(i)) wrongs.push(i);
  await guessIdx(page, wrongs[0]); await guessIdx(page, route[1]); await guessIdx(page, wrongs[1]).catch(() => { }); 
  for (const i of route.slice(2, -1)) await guessIdx(page, i);
  await page.waitForSelector('#resultBox .result');
  const won = await page.locator('#resultBox .result.win').count();
  const ratB = await page.textContent('#resultBox .rarity-line');
  check(`[${label}] rarity identical with and without failed guesses (same route)`, won === 1 && ratA === ratB, `${ratA} vs ${ratB}`);
  // short-stint (cameo) label: pick a cameo-only teammate of the start player and guess it
  await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForSelector('#top .card.start');
  const adjS = H.adjS(day2.start); let cameo = -1; for (const j of adj) if (!adjS.has(j) && !adj.has(day2.target) && j !== day2.target && H.P[j].n.length < 30) { if (!H.adjA(j).has(day2.target)) { cameo = j; break; } }
  if (cameo >= 0) { await guessIdx(page, cameo); const via = await page.textContent('#top .via'); check(`[${label}] short-stint (cameo) link is labeled`, /\(short stint\)/.test(via), via); }
  else check(`[${label}] short-stint (cameo) link is labeled`, false, 'no cameo teammate found for test');
  // invalid player handling: unknown text -> message, Enter with no match doesn't crash, no guess logged
  await type(page, 'qqqq not a player'); await page.keyboard.press('Enter');
  check(`[${label}] invalid player text rejected without error`, /Pick a player|No matching/.test(await page.textContent('#msg')) && errors.length === 0);
  // Unlimited: start, play, stats persist across reload and are guest-scoped
  await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForSelector('#top .card.start');
  await page.evaluate(() => { try { localStorage.setItem('dugout-v3-someaccount-unlimited-stats-v1', JSON.stringify({ v: 1, played: 99, wins: 99, losses: 0, current: 9, best: 9, distribution: [99, 0, 0, 0, 0, 0] })); } catch (e) { } });
  await page.click('#mFree'); await page.waitForSelector('#freeCtl:not([hidden])');
  async function idxFromDom() { const sn = await page.textContent('#top .card.start .nm'), sy = await page.textContent('#top .card.start .yrs'), tn = await page.textContent('#bottom .card.target .nm'), ty = await page.textContent('#bottom .card.target .yrs'); const f = (n, y) => H.P.findIndex(p => p.n === n && (p.a === p.b ? String(p.a) : p.a + '–' + p.b) === y); return [f(sn, sy), f(tn, ty)]; }
  async function solveFree() { const [s, t] = await idxFromDom(); const r = H.pathBetween(s, t); await playRoute(page, r); await page.waitForSelector('#resultBox .result'); return r; }
  const r1 = await solveFree();
  check(`[${label}] Unlimited puzzle is solvable and completes`, (await page.locator('#resultBox .result.win').count()) === 1, r1.map(nameOf).join(' > '));
  await page.click('#bAgain'); await page.waitForSelector('#resultBox .result', { state: 'detached' });
  // lose one: six wrong guesses
  const [s2, t2] = await idxFromDom(); const a2 = H.adjA(s2); const wr = []; for (let i = 0; i < H.N && wr.length < 6; i++) if (!a2.has(i) && i !== s2 && i !== t2 && H.P[i].f > 15) wr.push(i);
  for (const i of wr) await guessIdx(page, i);
  await page.waitForSelector('#resultBox .result.loss');
  check(`[${label}] six wrong guesses ends the game as a loss`, true);
  await page.reload(); await page.waitForSelector('#top .card.start'); await page.click('#bStats');
  const st = await page.textContent('#statsP'); const m = st.match(/Unlimited stats(\d+)Played(\d+)Win %(\d+)Current run(\d+)Best run/);
  check(`[${label}] Unlimited stats persist after reload (1 win, 1 loss)`, !!m && m[1] === '2' && m[2] === '50' && m[3] === '0', m ? `played ${m[1]}, win% ${m[2]}, run ${m[3]}` : st.slice(0, 200));
  check(`[${label}] guest stats are isolated from another profile's stored stats`, !/99/.test(st.replace(/Puzzle.*/, '').match(/Unlimited stats.*/)[0]));
  const raw = await page.evaluate(() => localStorage.getItem('dugout-v3-guest-unlimited-stats-v1')); const js = JSON.parse(raw);
  check(`[${label}] stored guest stats record`, js.played === 2 && js.wins === 1 && js.losses === 1 && js.best === 1 && js.current === 0 && js.distribution.reduce((a, b) => a + b, 0) === 1, raw);
  // In-browser Unlimited generation: era mix + latency over 60 puzzles, all solvable
  await page.click('#mFree').catch(() => { }); let act = 0, deb = 0, any = 0, n = 0, times = [], badRoute = 0;
  for (let k = 0; k < 60; k++) {
    const t = await page.evaluate(() => { const s = performance.now(); document.getElementById('bNew').click(); return performance.now() - s; }); times.push(t);
    const [s, tt] = await idxFromDom(); if (s < 0 || tt < 0) { badRoute++; continue; }
    const d = H.bfsS(s)[tt]; if (d < 2) badRoute++;
    const m = [H.P[s].b >= 2020, H.P[tt].b >= 2020]; n++; if (m[0] || m[1]) any++; if (H.P[s].a >= 2020 || H.P[tt].a >= 2020) deb++;
  }
  times.sort((a, b) => a - b);
  check(`[${label}] 60 in-browser Unlimited puzzles all valid`, badRoute === 0 && n === 60, `${any}/60 had a 2020+ player, ${deb}/60 had a 2020+ debut`);
  check(`[${label}] Unlimited generation latency (headless Chromium, not a phone)`, times[Math.floor(times.length * .95)] < 2000, `median ${times[30].toFixed(0)} ms, p95 ${times[Math.floor(times.length * .95)].toFixed(0)} ms, max ${times[59].toFixed(0)} ms`);
  await page.screenshot({ path: path.join(outDir, `${label}-unlimited.png`), fullPage: true });

  // ---- 3.0 features: Players/Era controls, challenge links, share image
  await page.selectOption('#era', 'historical'); let histOk = 0, histN = 12;
  for (let k = 0; k < histN; k++) { if (k) await page.click('#bNew'); const [s, t] = await idxFromDom(); if (H.P[s].b < 2000 && H.P[t].b < 2000) histOk++; }
  check(`[${label}] Era = Pre-2000 gives only pre-2000 players`, histOk === histN, `${histOk}/${histN}`);
  await page.selectOption('#era', 'modern'); let modOk = 0, modDeb = 0;
  for (let k = 0; k < histN; k++) { if (k) await page.click('#bNew'); const [s, t] = await idxFromDom(); if (H.P[s].b >= 2020 && H.P[t].b >= 2020 || H.P[s].b >= 2020 || H.P[t].b >= 2020) modOk++; if (H.P[s].a >= 2020 || H.P[t].a >= 2020) modDeb++; }
  check(`[${label}] Era = Since 2020 always includes a 2020+ player`, modOk === histN, `${modOk}/${histN}; ${modDeb} with a 2020+ debut`);
  await page.selectOption('#era', 'mixed'); await page.selectOption('#pool', 'famous');
  let famOk = 0; for (let k = 0; k < 10; k++) { if (k) await page.click('#bNew'); const [s, t] = await idxFromDom(); if (H.P[s].m >= 10 && H.P[t].m >= 10) famOk++; }
  check(`[${label}] Players = Famous keeps familiarity high`, famOk === 10, `${famOk}/10 puzzles with both endpoints familiarity>=10`);
  await page.selectOption('#pool', 'mixed');
  const [cs, ct] = await idxFromDom(); const croute = H.pathBetween(cs, ct); await playRoute(page, croute); await page.waitForSelector('#resultBox .result.win');
  const dl = page.waitForEvent('download'); await page.click('#bImg'); const download = await dl;
  const buf = await new Promise((res, rej) => { const ch = []; download.createReadStream().then(st => { st.on('data', d => ch.push(d)); st.on('end', () => res(Buffer.concat(ch))); st.on('error', rej); }); });
  check(`[${label}] Save image downloads a 1080x1080 PNG`, buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a' && buf.readUInt32BE(16) === 1080 && buf.readUInt32BE(20) === 1080 && buf.length > 5000, `${download.suggestedFilename()}, ${buf.length} bytes`);
  fs.writeFileSync(path.join(outDir, `${label}-share-image.png`), buf);
  await page.click('#bChal'); await page.waitForTimeout(150);
  const link = await page.evaluate(() => navigator.clipboard.readText().catch(() => '')) || await page.inputValue('#shareTxt');
  check(`[${label}] challenge link carries the exact pair`, link.includes('?c=' + H.P[cs].i + '.' + H.P[ct].i), link);
  const p2 = await ctx.newPage(); await p2.route(/cdn\.jsdelivr\.net|supabase\.co/, r => r.abort()); await p2.clock.install({ time: NOW });
  await p2.goto(link); await p2.waitForSelector('#top .card.start');
  check(`[${label}] opening the challenge link loads that puzzle in Unlimited`, (await p2.textContent('#top .card.start .nm')) === nameOf(cs) && (await p2.textContent('#bottom .card.target .nm')) === nameOf(ct) && !(await p2.locator('#freeCtl').isHidden()), '');
  await p2.goto('file://' + html + '?c=zzzzz.yyyyy'); await p2.waitForSelector('#top .card.start');
  check(`[${label}] invalid challenge link falls back to today's Daily with a message`, (await p2.textContent('#top .card.start .nm')) === nameOf(day2.start) && /not valid/.test(await p2.textContent('#msg')), '');
  await p2.goto('file://' + html + '?c=' + H.P[cs].i + '.' + H.P[cs].i); await p2.waitForSelector('#top .card.start');
  check(`[${label}] challenge with identical players is rejected`, (await p2.textContent('#top .card.start .nm')) === nameOf(day2.start), '');
  await p2.close();
  // accessibility affordances
  check(`[${label}] skip link + combobox labelling present`, (await page.locator('a[href="#main"]').count()) >= 1 && (await page.getAttribute('#q', 'aria-labelledby')) === 'gLbl' && (await page.getAttribute('#q', 'role')) === 'combobox');
  check(`[${label}] attribution visible in footer`, /SABR Lahman Database/.test(await page.textContent('.foot')) && /Sean Lahman/.test(await page.textContent('.foot')) && /CC BY-SA 3\.0/.test(await page.textContent('.foot')));
  check(`[${label}] no JavaScript errors after full session`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch();
  await runViewport(browser, 'desktop-1280x800', { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await runViewport(browser, 'iphone-390x844', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  await browser.close();
  console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED'); fs.writeFileSync(path.join(outDir, 'browser-results.json'), JSON.stringify(results, null, 1));
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
