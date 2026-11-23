#!/usr/bin/env python3
"""Build the Dugout basketball dataset.
Sources (both read-only, public):
  A) peasant98/TheNBACSV nbaNew.csv  - one row per player/team/season, 1950-51..2016-17 (no player IDs)
  B) gabriel1200/site_Data  YYYY/player_tracking/touches.csv, 2017-18 onward (NBA IDs; ONE row per player per
     season, listing the player's final team only, so mid-season stops before that are missing from 2017-18 on)
  Awards from site_Data/awards/*.csv drive fame.
Usage: build_nba.py <nbaNew.csv> <site_Data dir> <out.json>"""
import csv, json, sys, os, re, unicodedata, collections, bisect
nba_csv, sd, out = sys.argv[1:4]
def norm(s):
    s = unicodedata.normalize('NFD', s); s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = re.sub(r'[.\'’*]', '', s.lower()); s = re.sub(r'\b(jr|sr|ii|iii|iv)\b', '', s)
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]', ' ', s)).strip()
def team_name(code, y):  # y = season END year (2024 = the 2023-24 season)
    c = {'BRK':'BKN','CHO':'CHA','PHX':'PHO','NOP':'NOP'}.get(code, code)
    if c == 'CHA': return 'Charlotte Bobcats' if 2005 <= y <= 2014 else ('Charlotte Hornets' if y >= 2015 else 'Charlotte Hornets')
    if c == 'CHH': return 'Charlotte Hornets'
    if c == 'NOH': return 'New Orleans Hornets' if y < 2014 else 'New Orleans Pelicans'
    if c == 'NOP': return 'New Orleans Pelicans'
    if c == 'OKC': return 'Oklahoma City Thunder'
    if c == 'WAS': return 'Washington Wizards'
    if c == 'DET': return 'Detroit Pistons'
    if c == 'LAC': return 'Los Angeles Clippers'
    if c == 'GSW': return 'Golden State Warriors'
    names = {'ATL':'Atlanta Hawks','BOS':'Boston Celtics','NYK':'New York Knicks','PHI':'Philadelphia 76ers','LAL':'Los Angeles Lakers','CHI':'Chicago Bulls','MIL':'Milwaukee Bucks','CLE':'Cleveland Cavaliers','PHO':'Phoenix Suns','HOU':'Houston Rockets','POR':'Portland Trail Blazers','SAS':'San Antonio Spurs','DEN':'Denver Nuggets','IND':'Indiana Pacers','DAL':'Dallas Mavericks','SEA':'Seattle SuperSonics','NJN':'New Jersey Nets','UTA':'Utah Jazz','SAC':'Sacramento Kings','MIA':'Miami Heat','ORL':'Orlando Magic','MIN':'Minnesota Timberwolves','TOR':'Toronto Raptors','WSB':'Washington Bullets','MEM':'Memphis Grizzlies','CIN':'Cincinnati Royals','STL':'St. Louis Hawks','SYR':'Syracuse Nationals','BAL':'Baltimore Bullets','KCK':'Kansas City Kings','MNL':'Minneapolis Lakers','BUF':'Buffalo Braves','SFW':'San Francisco Warriors','PHW':'Philadelphia Warriors','FTW':'Fort Wayne Pistons','VAN':'Vancouver Grizzlies','BLB':'Baltimore Bullets','SDC':'San Diego Clippers','BKN':'Brooklyn Nets','ROC':'Rochester Royals','NOJ':'New Orleans Jazz','MLH':'Milwaukee Hawks','INO':'Indianapolis Olympians','SDR':'San Diego Rockets','KCO':'Kansas City-Omaha Kings','TRI':'Tri-Cities Blackhawks','NOK':'New Orleans/Oklahoma City Hornets','WSC':'Washington Capitols','WAT':'Waterloo Hawks','CHS':'Chicago Stags','DNN':'Denver Nuggets','PIT':'Pittsburgh Ironmen','CLR':'Cleveland Rebels','DTF':'Detroit Falcons','TOT':None}
    return names.get(c)
SOLID_G = 20
# ---- gather stints: key (pid_key) -> {(year, team): games} ; people: pid_key -> info
people = {}
def person(key, name, birth):
    return people.setdefault(key, {'n': name, 'birth': birth, 'st': collections.defaultdict(int), 'ws': 0.0})
by_name = collections.defaultdict(list)   # norm name -> [keys]
A_LAST = 0
with open(nba_csv, encoding='utf-8') as f:
    for r in csv.DictReader(f):
        try: y = int(r['SeasonStart']); age = int(float(r['Age'])); g = int(float(r['G'] or 0))
        except: continue
        if r['Tm'] == 'TOT': continue
        t = team_name(r['Tm'], y)
        if not t: continue
        name = r['PlayerName'].strip().rstrip('*')
        birth = y - age
        nk = norm(name)
        key = None
        for k in by_name[nk]:
            if abs(people[k]['birth'] - birth) <= 2: key = k; break
        if key is None:
            key = 'A:%s:%d' % (nk.replace(' ', '-'), birth); n = 2
            while key in people: key = '%s#%d' % (key, n); n += 1
            person(key, name, birth); by_name[nk].append(key)
        people[key]['st'][(y, t)] += g
        try: people[key]['ws'] += float(r['WS'] or 0)
        except: pass
        A_LAST = max(A_LAST, y)
print('source A through season ending', A_LAST, 'players', len(people))
# source B
merged = unmatched = 0
for ydir in sorted(os.listdir(sd)):
    if not re.fullmatch(r'20\d\d', ydir): continue
    end = int(ydir); y = end
    fp = os.path.join(sd, ydir, 'player_tracking', 'touches.csv')
    if y <= A_LAST or end > 2026 or not os.path.exists(fp): continue
    ages = {}
    ap = os.path.join(sd, ydir, 'player_shooting', 'open.csv')
    if os.path.exists(ap):
        for r in csv.DictReader(open(ap, encoding='utf-8')):
            try: ages[r['PLAYER_ID']] = int(float(r['AGE']))
            except: pass
    for r in csv.DictReader(open(fp, encoding='utf-8')):
        pid = r['PLAYER_ID']; name = r['Player'].strip()
        try: g = int(float(r['GP']))
        except: continue
        t = team_name(r['Team'], y)
        if not t: continue
        nk = norm(name); birth = (y - ages[pid]) if pid in ages else None
        key = 'B:' + pid
        if key not in people:
            cands = [k for k in by_name[nk] if people[k]['birth'] is not None and (birth is None or abs(people[k]['birth'] - birth) <= 2)
                     and max(yr for yr, _ in people[k]['st']) >= y - 4]
            if len(cands) == 1 and not cands[0].startswith('B:'):
                key = cands[0]; merged += 1
            elif cands: key = cands[0]; merged += 1
            else:
                person(key, name, birth if birth is not None else 0); by_name[nk].append(key)
        # remember the NBA id on merged players so later seasons find them directly
        people.setdefault('B:' + pid, people[key]) if key != 'B:' + pid else None
        people[key]['st'][(y, t)] += g
        people[key]['nbaid'] = pid
print('source B players merged into A careers:', merged)
# unique people (aliases share the object)
uniq = {}
for k, v in people.items(): uniq[id(v)] = (k, v)
# ---- awards -> points
AW = {'mvp':6,'nbamvp':6,'abamvp':6,'dpoy':3,'roy':2,'nbaroy':2,'abaroy':2,'mip':1,'6moy':1,'all-rookie':0.5,'all-defensive':1,'clutch player':1}
aw = collections.defaultdict(float)  # (normname, season_start) -> pts
adir = os.path.join(sd, 'awards')
for fn in os.listdir(adir):
    m = re.match(r'(.+?)(\d{4})\.csv$', fn)
    if not m or m.group(1) not in AW and m.group(1) != 'all-nba': continue
    kind, end = m.group(1), int(m.group(2))
    for r in csv.DictReader(open(os.path.join(adir, fn), encoding='utf-8', errors='replace')):
        nm = r.get('Player');
        if not nm: continue
        if kind == 'all-nba':
            tm = (r.get('# Tm') or r.get('Tm') or '')[:1]
            pts = {'1':4,'2':3,'3':2}.get(tm, 1)
        elif kind in ('mvp','nbamvp','abamvp'):
            try: share = float(r.get('Share') or 0)
            except: share = 0
            pts = 6 if r.get('Rank') == '1' else (2 * share)
        else: pts = AW[kind]
        aw[(norm(nm), end)] += pts
# ---- build outputs
tn = []; tnx = {}; ts = []; tsx = {}
def ts_id(y, t):
    if t not in tnx: tnx[t] = len(tn); tn.append(t)
    k = (y, tnx[t])
    if k not in tsx: tsx[k] = len(ts); ts.append([y, tnx[t]])
    return tsx[k]
P = []; score = []
used = set()
for k, v in uniq.values():
    st = v['st']
    solid = sorted((y, t) for (y, t), g in st.items() if g >= SOLID_G)
    cameo = sorted(set((y, t) for (y, t), g in st.items() if 0 < g < SOLID_G) - set(solid))
    if not solid: continue
    ys = sorted({y for y, _ in solid}); allys = sorted({y for y, _ in st})
    nk = norm(v['n'])
    a_pts = sum(aw.get((nk, y), 0) for y in allys)
    sc = a_pts * 2 + v['ws'] + min(len(ys), 15) * 0.4
    pid = v.get('nbaid') or 'A' + __import__('hashlib').md5(k.encode()).hexdigest()[:10]  # short ids (the database limits ids to 20 chars)
    if pid in used: pid = k
    used.add(pid)
    P.append({'i': pid, 'n': v['n'], 'a': allys[0], 'b': allys[-1], 'f': 0, 't': [ts_id(y, t) for y, t in solid],
              'x': [ts_id(y, t) for y, t in cameo], 'r': len(ys), 'm': 0, '_s': sc})
sc_sorted = sorted(p['_s'] for p in P)
for p in P:
    q = bisect.bisect_left(sc_sorted, p['_s']) / len(sc_sorted)
    p['f'] = round(10 * (q / 0.92) ** 2 if q < 0.92 else 10 + 10 * (q - 0.92) / 0.08, 1)
    p['m'] = int(round(100 * q)); del p['_s']
P.sort(key=lambda p: p['i'])
json.dump({'p': P, 'ts': ts, 'tn': tn}, open(out, 'w'), separators=(',', ':'))
print('players', len(P), 'team-seasons', len(ts), 'team names', len(tn), 'cameo-bearing', sum(1 for p in P if p['x']))
