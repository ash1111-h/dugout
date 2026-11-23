// Exercises the signed-in client paths with a stubbed Supabase library (no network):
// result sync, path-pick recording, "most-used players" panel, and the universal "My Dugout" panel, on all three pages.
const path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
let failed = 0; const check = (n, ok, d = '') => { if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? ' — ' + d : '')); };
const NOW = new Date('2026-11-23T12:00:00-08:00');
const STUB = `window.supabase = { createClient() {
  const S = window.__stub, calls = window.__calls = [];
  const user = { id: 'u1', email: 't@example.com', user_metadata: { display_name: 'Tester' } };
  const chain = table => { const c = {
    select() { return c; }, eq() { return c; }, order() { return c; }, range() { return c; }, update() { return c; },
    maybeSingle() { return Promise.resolve({ data: table === 'dugout_profiles' ? { user_id: 'u1', display_name: 'Tester', show_on_leaderboard: false } : null, error: null }); },
    single() { return c.maybeSingle(); },
    upsert(rows, opt) { calls.push({ kind: 'upsert', table, rows, opt }); return Promise.resolve({ error: null }); },
    insert(rows) { calls.push({ kind: 'insert', table, rows }); return Promise.resolve({ error: null }); },
    then(ok, bad) { return Promise.resolve({ data: [], error: null }).then(ok, bad); } }; return c; };
  return { auth: { getSession: async () => ({ data: { session: { user } }, error: null }), onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; }, signOut: async () => ({ error: null }) },
    from: chain, rpc: async (name, args) => { calls.push({ kind: 'rpc', name, args }); return { data: S[name] === undefined ? [] : S[name], error: null }; } };
} };`;
(async () => {
  const browser = await chromium.launch();
  for (const key of ['baseball', 'football', 'basketball']) {
    const file = key === 'baseball' ? 'index.html' : key + '.html'; const html = path.join(root, file); const H = require('./harness')(html);
    const day = H.dailyPuzzleFor('2026-11-23'); const route = H.pathBetween(day.start, day.target); const mids = route.slice(1, -1);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.route(/cdn\.jsdelivr\.net/, r => r.fulfill({ contentType: 'application/javascript', body: STUB }));
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    const popular = mids.slice(0, 2).map((i, k) => ({ player_id: H.P[i].i, picks: 5 - k, finishers: 8 }));
    await page.addInitScript(([pop, key]) => { window.__stub = { dugout_popular_picks: pop, dugout_my_dugout: { record: [{ sport: 'baseball', played: 4, wins: 3, best: 2, current: 1 }, { sport: 'football', played: 2, wins: 2, best: 2, current: 2 }], favorites: [] } };
      window.__stub.dugout_my_dugout.favorites = pop.map((r, k) => ({ sport: key, player_id: r.player_id, uses: 3 - k })); }, [popular, key]);
    await page.clock.install({ time: NOW });
    await page.goto('file://' + html); await page.waitForSelector('#top .card.start');
    await page.waitForFunction(() => document.getElementById('acctName') && !/Checking/.test(document.getElementById('acctName').textContent));
    for (const i of mids) { await page.fill('#q', ''); await page.type('#q', H.P[i].n, { delay: 0 }); await page.locator('#opts li[data-i="' + i + '"]').first().click(); }
    await page.waitForSelector('#resultBox .result.win'); await page.waitForSelector('#popBox ol.pop', { timeout: 5000 });
    const calls = await page.evaluate(() => window.__calls);
    const resTable = key === 'baseball' ? 'dugout_daily_results' : 'dugout_sport_results';
    check(`[${key}] result synced to ${resTable}`, calls.some(c => c.kind === 'upsert' && c.table === resTable && c.rows.won === true));
    const pk = calls.find(c => c.kind === 'upsert' && c.table === 'dugout_path_picks');
    const want = mids.map(i => H.P[i].i).sort().join();
    check(`[${key}] path picks recorded (middle players only, ignore duplicates, correct sport)`, !!pk && pk.rows.map(r => r.player_id).sort().join() === want && pk.rows.every(r => r.sport === key && r.puzzle_date === '2026-11-23') && pk.opt.ignoreDuplicates === true && !pk.rows.some(r => r.player_id === H.P[day.start].i || r.player_id === H.P[day.target].i), JSON.stringify(pk && pk.rows.map(r => r.player_id)));
    const rpcPop = calls.find(c => c.kind === 'rpc' && c.name === 'dugout_popular_picks');
    check(`[${key}] popular picks requested for this sport and date`, !!rpcPop && rpcPop.args.p_sport === key && rpcPop.args.p_puzzle_date === '2026-11-23');
    const popText = await page.textContent('#popBox');
    check(`[${key}] most-used players shown with percentages and "you" tag`, popText.includes(H.P[mids[0]].n) && /63%/.test(popText) && /you/.test(popText), popText.replace(/\s+/g, ' ').slice(0, 140));
    await page.click('#bAuth'); await page.waitForSelector('#myDugout .md-card');
    const md = await page.textContent('#myDugout');
    check(`[${key}] My Dugout shows all three sports and records`, /Baseball/.test(md) && /Football/.test(md) && /Basketball/.test(md) && /3 won of 4/.test(md) && /2 won of 2/.test(md) && /Not played yet/.test(md), md.replace(/\s+/g, ' ').slice(0, 200));
    check(`[${key}] My Dugout lists most-used players for this sport`, md.includes(H.P[mids[0]].n) && /3×/.test(md));
    check(`[${key}] no JS errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  await browser.close(); console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED'); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
