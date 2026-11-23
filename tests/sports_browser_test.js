// Headless-Chromium tests for the football and basketball pages (and the sport switcher on all three).
// Usage: node tests/sports_browser_test.js [outDir]
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const outDir = process.argv[2] || path.join(require('os').tmpdir(), 'dugout-sport-shots'); fs.mkdirSync(outDir, { recursive: true });
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); };
const NOW = new Date('2026-11-23T12:00:00-08:00');
const PAGES = [['football', 'Dugout Football', '🏈'], ['basketball', 'Dugout Basketball', '🏀']];
(async () => {
  const browser = await chromium.launch();
  for (const [vp, opts] of [['desktop', { viewport: { width: 1280, height: 800 } }], ['iphone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]]) {
    for (const [key, title, emoji] of PAGES) {
      const html = path.join(root, key + '.html'); const H = require('./harness')(html);
      const label = vp + '/' + key;
      const ctx = await browser.newContext({ ...opts, permissions: ['clipboard-read', 'clipboard-write'] });
      await ctx.route(/cdn\.jsdelivr\.net|supabase\.co/, r => r.abort());
      const page = await ctx.newPage(); const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) errors.push(m.text()); });
      await page.clock.install({ time: NOW });
      await page.goto('file://' + html); await page.waitForSelector('#top .card.start');
      check(`[${label}] loads with no JS errors`, errors.length === 0, errors.join(' | '));
      check(`[${label}] title and heading`, (await page.title()) === title && (await page.textContent('h1')) === title);
      const links = await page.locator('nav.sports a').allTextContents();
      check(`[${label}] sport switcher shows all three, current page marked`, links.length === 3 && (await page.locator('nav.sports a[aria-current="page"]').textContent()).includes(title.split(' ')[1]), links.join(' | '));
      check(`[${label}] account panel and board hidden (baseball-only)`, !(await page.locator('#acct').isVisible()) && !(await page.locator('#bBoard').isVisible()));
      check(`[${label}] no baseball wording on the page`, !/baseball|MLB|Lahman|innings/i.test((await page.evaluate(() => document.body.innerText)).replace('⚾ Baseball', '')));
      const ov = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
      check(`[${label}] no horizontal overflow`, ov.sw <= ov.iw + 1, `${ov.sw} vs ${ov.iw}`);
      const day = H.dailyPuzzleFor('2026-11-23');
      const sn = await page.textContent('#top .card.start .nm'), tn = await page.textContent('#bottom .card.target .nm');
      check(`[${label}] daily #1 matches the deterministic schedule`, sn === H.P[day.start].n && tn === H.P[day.target].n, `${sn} -> ${tn}`);
      await page.screenshot({ path: path.join(outDir, `${label}.png`), fullPage: true });
      // play and win the daily
      const route = H.pathBetween(day.start, day.target);
      for (const i of route.slice(1, -1)) {
        await page.fill('#q', ''); await page.type('#q', H.P[i].n, { delay: 0 });
        const li = page.locator('#opts li[data-i="' + i + '"]'); if (!(await li.count())) throw new Error('not offered: ' + H.P[i].n);
        await li.first().click();
      }
      await page.waitForSelector('#resultBox .result.win');
      check(`[${label}] winning the daily works`, true);
      await page.click('#bShare'); await page.waitForTimeout(150);
      const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => '')) || await page.inputValue('#shareTxt');
      check(`[${label}] share text names the sport and the puzzle`, clip.startsWith(title + ' #1'), clip.split('\n')[0]);
      const keys = await page.evaluate(() => Object.keys(localStorage));
      check(`[${label}] progress stored under its own key`, keys.some(k => k.startsWith('dugout-' + key + '-v3')) && !keys.includes('dugout-v3-guest'), keys.join(','));
      // unlimited
      await page.reload(); await page.waitForSelector('#top .card.start');
      const freeBtn = page.locator('#mFree, button:has-text("Unlimited")').first();
      if (await freeBtn.count()) { await freeBtn.click(); await page.waitForSelector('#top .card.start'); check(`[${label}] Unlimited mode starts`, true); }
      await ctx.close();
    }
  }
  // switcher on baseball page
  const ctx = await browser.newContext(); await ctx.route(/cdn\.jsdelivr\.net|supabase\.co/, r => r.abort());
  const page = await ctx.newPage(); await page.goto('file://' + path.join(root, 'index.html'));
  const hrefs = await page.locator('nav.sports a').evaluateAll(a => a.map(x => x.getAttribute('href')));
  check('[baseball] switcher links to the other two pages', hrefs.join() === 'index.html,football.html,basketball.html', hrefs.join());
  await page.click('nav.sports a[href="football.html"]'); await page.waitForSelector('#top .card.start');
  check('[baseball->football] navigation works', (await page.title()) === 'Dugout Football');
  await browser.close();
  console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED'); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
