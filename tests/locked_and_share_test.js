// Already-played days are final (all three pages), missed days stay playable, and the share image carries the played path.
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..'); const outDir = process.argv[2] || path.join(require('os').tmpdir(), 'dugout-share'); fs.mkdirSync(outDir, { recursive: true });
let failed = 0; const check = (n, ok, d = '') => { if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d ? ' — ' + d : '')); };
(async () => {
  const browser = await chromium.launch();
  for (const [key, file] of [['baseball', 'index.html'], ['football', 'football.html'], ['basketball', 'basketball.html']]) {
    const html = path.join(root, file); const H = require('./harness')(html);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.route(/cdn\.jsdelivr\.net|supabase\.co/, r => r.abort());
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.clock.install({ time: new Date('2026-11-23T12:00:00-08:00') });
    await page.goto('file://' + html); await page.waitForSelector('#top .card.start');
    const day = H.dailyPuzzleFor('2026-11-23'); const route = H.pathBetween(day.start, day.target);
    for (const i of route.slice(1, -1)) { await page.fill('#q', ''); await page.type('#q', H.P[i].n, { delay: 0 }); await page.locator('#opts li[data-i="' + i + '"]').first().click(); }
    await page.waitForSelector('#resultBox .result.win');
    // share image: saved via the real button (headless Chromium has no native share sheet, so it downloads)
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#bImg')]);
    const out = path.join(outDir, key + '-share.png'); await dl.saveAs(out); const buf = fs.readFileSync(out);
    check(`[${key}] share image saved as a 1080x1080 PNG`, buf.readUInt32BE(16) === 1080 && buf.readUInt32BE(20) === 1080 && buf.length > 20000, buf.length + ' bytes');
    // next day: the played day is locked in the Puzzle menu
    await page.clock.setSystemTime(new Date('2026-11-24T12:00:00-08:00')); await page.reload(); await page.waitForSelector('#top .card.start');
    const opt = await page.locator('#arch option[value="2026-11-23"]').textContent();
    check(`[${key}] menu marks the played day`, /played: \d\/6/.test(opt), opt);
    await page.selectOption('#arch', '2026-11-23'); await page.waitForSelector('#resultBox .result');
    check(`[${key}] played day shows "Already played", no guess box`, (await page.textContent('#resultBox h2')) === 'Already played' && !(await page.locator('#guessBox').isVisible()));
    // today (11-24) not played yet: playable. Skip it, then on 11-25 the missed 11-24 is replayable from the menu
    await page.clock.setSystemTime(new Date('2026-11-25T12:00:00-08:00')); await page.reload(); await page.waitForSelector('#top .card.start');
    await page.selectOption('#arch', '2026-11-24'); await page.waitForSelector('#top .card.start');
    check(`[${key}] a missed day can still be played`, await page.locator('#guessBox').isVisible() && !(await page.locator('#resultBox .result').count()));
    check(`[${key}] no JS errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  await browser.close(); console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED'); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
