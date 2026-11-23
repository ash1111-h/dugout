#!/usr/bin/env python3
"""Build the Dugout football dataset from nflverse (roster_YYYY.csv + players.csv).
Usage: build_nfl.py <dir with roster_*.csv and players.csv> <out.json>
Link rules (documented in the UI): "solid" = on the team's active or injured-reserve roster at season end;
"cameo" = only on the practice squad or listed as cut/other."""
import csv, json, sys, collections, os, re
src, out = sys.argv[1], sys.argv[2]
CODE = {'ARZ':'ARI','BLT':'BAL','CLV':'CLE','HST':'HOU','SL':'STL'}
def team_name(code, y):
    code = CODE.get(code, code)
    if code == 'OAK' or (code == 'LV'): return 'Oakland Raiders' if y < 2020 else 'Las Vegas Raiders'
    if code in ('SD','LAC'): return 'San Diego Chargers' if y < 2017 else 'Los Angeles Chargers'
    if code in ('STL','LA'): return 'St. Louis Rams' if y < 2016 else 'Los Angeles Rams'
    if code == 'WAS': return 'Washington Redskins' if y < 2020 else ('Washington Football Team' if y < 2022 else 'Washington Commanders')
    if code == 'NE' and False: return ''
    names = {'ARI':'Arizona Cardinals','ATL':'Atlanta Falcons','BAL':'Baltimore Ravens','BUF':'Buffalo Bills','CAR':'Carolina Panthers','CHI':'Chicago Bears','CIN':'Cincinnati Bengals','CLE':'Cleveland Browns','DAL':'Dallas Cowboys','DEN':'Denver Broncos','DET':'Detroit Lions','GB':'Green Bay Packers','HOU':'Houston Texans','IND':'Indianapolis Colts','JAX':'Jacksonville Jaguars','JAC':'Jacksonville Jaguars','KC':'Kansas City Chiefs','MIA':'Miami Dolphins','MIN':'Minnesota Vikings','NE':'New England Patriots','NO':'New Orleans Saints','NYG':'New York Giants','NYJ':'New York Jets','PHI':'Philadelphia Eagles','PIT':'Pittsburgh Steelers','SEA':'Seattle Seahawks','SF':'San Francisco 49ers','TB':'Tampa Bay Buccaneers','TEN':'Tennessee Titans'}
    return names.get(code)
players = {}
with open(os.path.join(src,'players.csv'), encoding='utf-8') as f:
    for r in csv.DictReader(f):
        if r['gsis_id']: players[r['gsis_id']] = r
# ---- career impact from nflverse player stats (regular season) ----
impact = collections.defaultdict(float); peak = collections.defaultdict(float); games_by = collections.defaultdict(dict)
def fl(x):
    try: return float(x)
    except: return 0.0
sdir = os.path.join(src, 'stats')
if os.path.isdir(sdir):
    for fn in sorted(os.listdir(sdir)):
        m0 = re.match(r's(\d{4})\.csv', fn)
        if not m0: continue
        y0 = int(m0.group(1))
        with open(os.path.join(sdir, fn), encoding='utf-8') as f:
            for r in csv.DictReader(f):
                g = r['player_id']
                v = (fl(r['passing_yards'])/25 + fl(r['passing_tds'])*4 - fl(r['passing_interceptions'])*2
                     + fl(r['rushing_yards'])/10 + fl(r['rushing_tds'])*6
                     + fl(r['receiving_yards'])/10 + fl(r['receiving_tds'])*6 + fl(r['receptions'])*0.5
                     + fl(r['def_sacks'])*5 + fl(r['def_interceptions'])*6 + fl(r['def_tackles_solo'])*0.6
                     + fl(r['def_tackles_for_loss'])*1.5 + fl(r['def_pass_defended'])*1.0 + fl(r['def_fumbles_forced'])*2)
                impact[g] += max(v, 0); peak[g] = max(peak[g], v)
                games_by[g][y0] = games_by[g].get(y0, 0) + fl(r['games'])
ROSTER = {'ACT','RES','PUP','NWT','SUS','RSN'}  # on a roster slot (active, injured reserve, etc.)
stints = collections.defaultdict(lambda: collections.defaultdict(lambda: [set(), set()]))  # gsis -> (year,team) -> [weeks_on_roster, weeks_other]
names = {}; pos = {}
unmapped = collections.Counter()
for fn in sorted(os.listdir(src)):
    m = re.match(r'roster_(\d{4})\.csv', fn)
    if not m: continue
    y = int(m.group(1))
    with open(os.path.join(src,fn), encoding='utf-8') as f:
        for r in csv.DictReader(f):
            g = r['gsis_id']
            if not g: continue
            t = team_name(r['team'], y)
            if not t: unmapped[r['team']] += 1; continue
            wk = r.get('week') or '0'
            gt = r.get('game_type') or 'REG'
            if gt not in ('REG',''): continue
            s = stints[g][(y,t)]
            (s[0] if r['status'] in ROSTER else s[1]).add(wk)
            names.setdefault(g, r['full_name']); pos.setdefault(g, r['position'])
print('unmapped team codes:', dict(unmapped))
tn = []; tnx = {}; ts = []; tsx = {}
def ts_id(y, t):
    if t not in tnx: tnx[t] = len(tn); tn.append(t)
    k = (y, tnx[t])
    if k not in tsx: tsx[k] = len(ts); ts.append([y, tnx[t]])
    return tsx[k]
POSW = {'QB':1.6,'RB':1.15,'WR':1.15,'TE':1.0,'FB':0.5,'T':0.55,'G':0.55,'C':0.55,'OL':0.55,'OT':0.55,'OG':0.55,'DE':1.0,'DT':0.85,'DL':0.85,'NT':0.7,'LB':0.95,'ILB':0.9,'OLB':0.95,'MLB':0.9,'CB':0.95,'S':0.9,'SS':0.9,'FS':0.9,'DB':0.9,'K':0.55,'P':0.45,'LS':0.1}
P = []
for g, st in stints.items():
    pr = players.get(g, {})
    solid, cameo, solid_years = [], [], set()
    for (y,t), (on, off) in st.items():
        ok = len(on) >= 1  # nflverse rosters are end-of-season snapshots (a few extra playoff-week rows)
        if ok: solid.append((y,t)); solid_years.add(y)
        else: cameo.append((y,t))
    if not solid: continue   # nobody can be a puzzle endpoint without a solid link; cameos alone are skipped in v1
    solid = sorted(set(solid)); cameo = sorted(set(cameo) - set(solid))
    ys = sorted(solid_years)
    def num(x):
        try: return int(float(x))
        except: return None
    a = num(pr.get('rookie_season')) or ys[0]; b = num(pr.get('last_season')) or ys[-1]
    b = max(b, ys[-1]); a = min(a, ys[0])
    seasons = len(ys) + max(0, (ys[0]-a))  # seasons on rosters, plus pre-1999 years implied by a rookie year
    rnd = num(pr.get('draft_round')); pick = num(pr.get('draft_pick'))
    draft = 0
    if rnd == 1: draft = 4 + (3 if pick and pick <= 10 else 1 if pick and pick <= 20 else 0)
    elif rnd == 2: draft = 2
    elif rnd == 3: draft = 1
    p0 = (pr.get('position') or pos.get(g,'') or '').upper()
    w = POSW.get(p0, 0.8)
    if g in impact:
        p_score = impact[g] + 1.5 * peak[g]
        f = None  # set after ranking below
    else:
        f = round(min(5.0, min(seasons, 10) * 0.35 + draft * 0.5), 1)
        p_score = None
    nm = pr.get('display_name') or names.get(g)
    if not nm: continue
    P.append({'i': g, 'n': nm, 'a': a, 'b': b, 'f': f,
              't': [ts_id(y,t) for (y,t) in solid], 'x': [ts_id(y,t) for (y,t) in cameo],
              'r': sum(1 for y0, gm in games_by.get(g, {}).items() if gm >= 8) or len(ys), 'm': 0, '_s': p_score})
# percentile of career impact -> fame f (top ~8% reach 10, top ~18% reach 8, top ~29% reach 6), familiarity m (0-100)
import bisect
sc = sorted(p['_s'] for p in P if p['_s'] is not None)
def pct(x): return bisect.bisect_left(sc, x) / len(sc)
for p in P:
    if p['_s'] is not None:
        q = pct(p['_s'])
        p['f'] = round(10 * (q / 0.92) ** 2 if q < 0.92 else 10 + 10 * (q - 0.92) / 0.08, 1)
        p['m'] = int(round(100 * q))
    else:
        p['m'] = int(round(min(30, p['f'] * 6)))
    del p['_s']
P.sort(key=lambda p: p['i'])
json.dump({'p': P, 'ts': ts, 'tn': tn}, open(out,'w'), separators=(',',':'))
print('players', len(P), 'team-seasons', len(ts), 'teams', len(tn), 'cameo-bearing', sum(1 for p in P if p['x']), 'with stats', len(sc))
