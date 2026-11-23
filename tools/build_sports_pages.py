#!/usr/bin/env python3
"""Generate football.html and basketball.html from the baseball page (index.html), using the same
game engine with different data and settings. Every replacement is asserted so a drift in index.html fails loudly.
Usage: build_sports_pages.py [repo_root]"""
import json, re, sys, os
root = sys.argv[1] if len(sys.argv) > 1 else '.'
src = open(os.path.join(root, 'index.html'), encoding='utf-8').read()

def rep(s, old, new, count=1):
    assert s.count(old) >= 1, 'pattern missing: ' + old[:80]
    return s.replace(old, new) if count == 0 else s.replace(old, new, count)

SPORTS = {
 'football': dict(
   file='football.html', data='data/sports/nfl.json', title='Dugout Football', emoji='🏈', key='football',
   tag='Link two NFL players through teammates', desc='A daily NFL puzzle: connect two football players through shared teammates and seasons.',
   anchor='Date.UTC(2026, 10, 23)', modern=2023, newest=2025,
   diff=dict(easy=(10, 2000, 2, 3), medium=(8, 1995, 3, 4), hard=(6, 1985, 4, 5)),
   week_top=(12, 1990, 4, 5), week=[(10, 2000, 2, 3), (10, 2000, 2, 3), (8, 1995, 3, 3), (8, 1995, 3, 4), (8, 1990, 4, 4), (8, 1990, 3, 5)],
   hist_floor=1980, hist_maxb=2012, finale='overtime',
   rule='The puzzle\'s standard links use players who were on the team\'s active or injured-reserve roster at the end of that season. Practice-squad and short stays still count as guesses and are marked on the link.',
   short='(short stay)', solid_cmt='on the active or injured-reserve roster at season end',
   foot='Football data: nflverse (nflreadr / nflverse-data on GitHub; CC BY 4.0). Rosters cover 1999–2025, so players who retired earlier do not appear. Rosters are end-of-season snapshots, so a player traded mid-season may show only for the team he finished with. Standard links use players on a team\'s active or injured-reserve roster; practice-squad stays count and are labeled. Daily puzzles are generated deterministically from 2026-11-23. “Recent debut” means a first NFL season in 2023 or later.',
   season_label="TS[t][0] + ' '"),
 'basketball': dict(
   file='basketball.html', data='data/sports/nba.json', title='Dugout Basketball', emoji='🏀', key='basketball',
   tag='Link two NBA players through teammates', desc='A daily NBA puzzle: connect two basketball players through shared teammates and seasons.',
   anchor='Date.UTC(2026, 10, 23)', modern=2023, newest=2025,
   diff=dict(easy=(10, 1990, 2, 3), medium=(8, 1975, 3, 4), hard=(6, 1960, 4, 5)),
   week_top=(12, 1950, 4, 5), week=[(10, 1990, 2, 3), (10, 1990, 2, 3), (8, 1975, 3, 3), (8, 1975, 3, 4), (8, 1960, 4, 4), (8, 1960, 3, 5)],
   hist_floor=1946, hist_maxb=1999, finale='overtime',
   rule='The puzzle\'s standard links use players with 20+ games for that team-season. Shorter stints still count as guesses and are marked on the link.',
   short='(short stint)', solid_cmt='appeared in at least 20 games that season',
   foot='Basketball data: seasons through 2016-17 come from the public “The NBA CSV” dataset (peasant98/TheNBACSV, from Basketball-Reference); seasons from 2017-18 on come from public NBA tracking tables (gabriel1200/site_Data). From 2017-18 on the source lists only a player\'s final team each season, so mid-season trades are missing from those years. Players are matched across sources by name and age, which can occasionally split or merge two people. Standard links use 20+ games for a team-season. Daily puzzles are generated deterministically from 2026-11-23. Seasons are labeled by the years they span, and “recent debut” means a first season ending in 2023 or later.',
   season_label="(TS[t][0] - 1) + '-' + String(TS[t][0]).slice(2) + ' '"),
}

def build(name, cfg):
    s = src
    d = json.load(open(os.path.join(root, cfg['data']), encoding='utf-8'))
    d['sch'] = []; d['ovr'] = {}; d['ext'] = []
    # data
    i = s.index('const D = '); j = s.index('\n', i)
    s = s[:i] + 'const D = ' + json.dumps(d, separators=(',', ':'), ensure_ascii=False) + ';' + s[j:].lstrip(';') if s[j-1] == ';' else s[:i] + 'const D = ' + json.dumps(d, separators=(',', ':'), ensure_ascii=False) + ';' + s[j:]
    # head / copy
    s = rep(s, '<title>Dugout</title>', '<title>%s</title>' % cfg['title'])
    s = rep(s, 'A daily MLB puzzle: connect two baseball players through shared teammates and seasons.', cfg['desc'])
    s = rep(s, '<h1>Dugout</h1><div class="tag">Link two MLB players through teammates</div>', '<h1>%s</h1><div class="tag">%s</div>' % (cfg['title'], cfg['tag']))
    s = rep(s, '<a href="index.html" aria-current="page">', '<a href="index.html">')
    s = rep(s, '<a href="%s">' % cfg['file'], '<a href="%s" aria-current="page">' % cfg['file'])
    s = rep(s, "The puzzle's standard links use players with 10+ games for that team-season. Shorter stints still count as guesses and are marked on the link.", cfg['rule'])
    s = rep(s, 'to extra innings on Sunday', 'to overtime on Sunday')
    s = rep(s, 'Extra innings', 'Overtime')
    s = re.sub(r'<div class="foot">.*?</div>', lambda m: '<div class="foot">' + cfg['foot'] + '</div>', s, count=1, flags=re.S)
    s = rep(s, "im.textContent = '⚾'", "im.textContent = '%s'" % cfg['emoji'])
    s = rep(s, "(short stint)", cfg['short'])
    s = rep(s, "dugout-result.png", "dugout-%s-result.png" % cfg['key'], 0)
    s = rep(s, "Dugout ' + (G.mode === 'daily'", "%s ' + (G.mode === 'daily'" % cfg['title'])
    # sport-specific constants
    s = rep(s, 'Solid" players appeared in at least 10 games that season.', 'Solid" players: %s.' % cfg['solid_cmt'])
    s = rep(s, "function tsLabel(t) { return TS[t][0] + ' ' + TN[TS[t][1]]; }", "function tsLabel(t) { return %s + TN[TS[t][1]]; }" % cfg['season_label'])
    for k, (f, a, lo, hi) in cfg['diff'].items():
        s = re.sub(r"(%s: \{ name: '\w+', )minF: \d+, minA: \d+, lo: \d, hi: \d" % k, r"\g<1>minF: %d, minA: %d, lo: %d, hi: %d" % (f, a, lo, hi), s, count=1)
    wk = [cfg['week_top']] + cfg['week']
    m = re.search(r"const WEEK = \[.*?\n\];", s, flags=re.S); assert m
    names = ['Overtime', 'Warm-up', 'Warm-up', 'Regular', 'Regular', 'Tough', 'Tough']
    new = 'const WEEK = [\n' + ',\n'.join("  { name: '%s', minF: %d, minA: %d, lo: %d, hi: %d }" % (n, *w) for n, w in zip(names, wk)) + '\n];'
    s = s[:m.start()] + new + s[m.end():]
    s = rep(s, 'const MODERN_FROM = 2020;', 'const MODERN_FROM = %d;' % cfg['modern'])
    s = rep(s, 'p.a >= 2024 ? bar.newest', 'p.a >= %d ? bar.newest' % cfg['newest'])
    s = rep(s, 'minA: 1900, maxB: 1999', 'minA: %d, maxB: %d' % (cfg['hist_floor'], cfg['hist_maxb']))
    s = rep(s, 'minF: 4, minA: 1900', 'minF: 4, minA: %d' % cfg['hist_floor'])
    s = rep(s, 'const DAILY_ANCHOR = Date.UTC(2026, 10, 22);', 'const DAILY_ANCHOR = %s;' % cfg['anchor'])
    # separate local storage per sport
    s = rep(s, "'dugout-v3-guest'", "'dugout-%s-v3-guest'" % cfg['key'], 0)
    s = rep(s, "'dugout-v3-user-'", "'dugout-%s-v3-user-'" % cfg['key'])
    s = rep(s, "'dugout-seen'", "'dugout-%s-seen'" % cfg['key'], 0)
    s = rep(s, "readStoreKey('dugout-v2')", "null")
    s = rep(s, "localStorage.getItem('dugout-v1')", "null")
    # accounts / leaderboard stay baseball-only for now (their tables have no sport column)
    s = rep(s, "const SUPABASE_URL = 'https://odulayjarrfqaggemftw.supabase.co';", "const SUPABASE_URL = ''; // accounts and the leaderboard are baseball-only in 3.0")
    s = rep(s, '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.2"></script>', '')
    s = rep(s, '</head>', '<style>#acct,#bBoard,#boardP{display:none!important}</style>\n</head>')
    return s

for name, cfg in SPORTS.items():
    out = build(name, cfg)
    open(os.path.join(root, cfg['file']), 'w', encoding='utf-8').write(out)
    left = re.findall(r'MLB|baseball|Lahman|⚾|innings', out.split('/*GEN:BEGIN*/')[0] + out.split('/*GEN:BEGIN*/')[1], flags=re.I)
    print(name, 'written', len(out) // 1024, 'KB; leftover baseball words:', sorted(set(left)))
