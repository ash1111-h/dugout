#!/usr/bin/env python3
"""Build a backward-compatible Dugout database from SABR Lahman CSVs.

Default: MLB major-league leagues only (NA, NL, AA, UA, PL, FL, AL).
Other/Negro leagues are opt-in with --include-other-leagues.
Preserves existing player IDs, team-season indices, and the entire daily schedule.
Always writes a separate output file; never overwrites the input HTML.
"""
from __future__ import annotations
import argparse, csv, json, math, re
from collections import defaultdict
from pathlib import Path

MLB_LEAGUE_IDS = {"NA", "NL", "AA", "UA", "PL", "FL", "AL"}

def rows(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))

def fame_score(games, seasons, allstars=0, awards=0, hof=False):
    score = 1.2 + 1.65 * math.log1p(max(0, games)) + 0.45 * math.sqrt(max(1, seasons))
    score += min(5.0, allstars * 0.8) + min(5.0, awards * 1.2)
    if hof: score += 8.0
    return round(min(34.1, score), 2)

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("index", type=Path); ap.add_argument("people", type=Path)
    ap.add_argument("appearances", type=Path); ap.add_argument("teams", type=Path)
    ap.add_argument("--allstar"); ap.add_argument("--awards"); ap.add_argument("--hof")
    ap.add_argument("--include-other-leagues", action="store_true")
    ap.add_argument("--output", type=Path, default=Path("index-updated.html"))
    a = ap.parse_args()
    if a.output.resolve() == a.index.resolve(): ap.error("Output must differ from input index.html.")
    html = a.index.read_text(encoding="utf-8")
    m = re.search(r"const D = (\{.*?\});\\s*\\n\\(function \\(\\) \\{", html, re.S)
    if not m: raise SystemExit("Could not locate embedded Dugout data; no file changed.")
    data = json.loads(m.group(1))
    if not all(k in data for k in ("p","ts","tn","sch")): raise SystemExit("Unexpected data schema.")
    people = {r["playerID"]:r for r in rows(a.people) if r.get("playerID")}
    teams = {}
    for r in rows(a.teams):
        if not r.get("teamID") or not r.get("yearID"): continue
        league = (r.get("lgID") or "").strip().upper()
        if not a.include_other_leagues and league not in MLB_LEAGUE_IDS: continue
        year = int(r["yearID"]); name = (r.get("name") or r["teamID"]).strip()
        label = name if league in ("AL","NL") or not league else f"{name} ({league})"
        teams[(year,r["teamID"])] = label
    appearances = defaultdict(list); max_year = 0
    for r in rows(a.appearances):
        pid,tid,yr = r.get("playerID"),r.get("teamID"),r.get("yearID")
        if not pid or not tid or not yr: continue
        year = int(yr)
        if (year,tid) not in teams: continue
        games = int(float(r.get("G_all") or 0))
        if games <= 0: continue
        max_year = max(max_year,year); appearances[pid].append((year,teams[(year,tid)],games))
    if max_year < 2025: raise SystemExit(f"Filtered data only reaches {max_year}; expected MLB data through 2025.")
    def optional(path): return rows(path) if path else []
    allstars=defaultdict(int)
    for r in optional(a.allstar):
        if r.get("playerID"): allstars[r["playerID"]]+=1
    awards=defaultdict(int)
    for r in optional(a.awards):
        if r.get("playerID"): awards[r["playerID"]]+=1
    hof={r["playerID"] for r in optional(a.hof) if r.get("playerID") and (r.get("inducted") or "").strip().upper()=="Y"}
    names=data["tn"]; name_idx={n:i for i,n in enumerate(names)}
    ts=data["ts"]; ts_idx={(int(y),int(t)):i for i,(y,t) in enumerate(ts)}
    pending=sorted({(y,n) for vals in appearances.values() for y,n,_ in vals})
    for y,n in pending:
        if n not in name_idx: name_idx[n]=len(names); names.append(n)
        if (y,name_idx[n]) not in ts_idx:
            ts_idx[(y,name_idx[n])]=len(ts); ts.append([y,name_idx[n]])
    players=data["p"]; pidx={p["i"]:p for p in players}
    if len(pidx)!=len(players): raise SystemExit("Existing duplicate player IDs; no file changed.")
    new_ids=sorted(pid for pid in appearances if pid not in pidx)
    for pid in new_ids:
        person=people.get(pid,{})
        name=((person.get("nameFirst") or "").strip()+" "+(person.get("nameLast") or "").strip()).strip() or pid
        vals=appearances[pid]
        players.append({"i":pid,"n":name,"a":min(y for y,_,_ in vals),"b":max(y for y,_,_ in vals),
          "f":fame_score(sum(g for _,_,g in vals),len({y for y,_,_ in vals}),allstars[pid],awards[pid],pid in hof),"t":[],"x":[]})
        pidx[pid]=players[-1]
    for pid,vals in appearances.items():
        p=pidx[pid]; solid=set(); cameo=set()
        for y,n,g in vals:
            t=ts_idx[(y,name_idx[n])]
            (solid if g>=10 else cameo).add(t)
        p["a"]=min(y for y,_,_ in vals); p["b"]=max(y for y,_,_ in vals)
        p["t"]=sorted(solid); p["x"]=sorted(cameo-solid)
    ids=[p["i"] for p in players]
    if len(ids)!=len(set(ids)): raise SystemExit("Duplicate player IDs after merge.")
    for p in players:
        if set(p["t"])&set(p["x"]) or len(p["t"])!=len(set(p["t"])) or len(p["x"])!=len(set(p["x"])):
            raise SystemExit(f"Duplicate/overlapping team seasons for {p['i']}.")
        if any(not isinstance(t,int) or t<0 or t>=len(ts) for t in p["t"]+p["x"]):
            raise SystemExit(f"Invalid team-season index for {p['i']}.")
    schedule=json.dumps(data["sch"],separators=(",",":"),ensure_ascii=False)
    data["p"],data["ts"],data["tn"]=players,ts,names
    if json.dumps(data["sch"],separators=(",",":"),ensure_ascii=False)!=schedule:
        raise SystemExit("Daily schedule changed unexpectedly.")
    updated=html[:m.start(1)]+json.dumps(data,separators=(",",":"),ensure_ascii=False)+html[m.end(1):]
    footer=re.compile(r'<div class="foot">This build uses a Lahman 2021\\.2 roster snapshot.*?</div>',re.S)
    replacement=('<div class="foot">Baseball data: SABR Lahman Database, created by Sean Lahman and maintained by '
      'the Society for American Baseball Research (CC BY-SA 3.0). This MLB-only roster includes data through '
      'the 2025 season. Standard links use 10+ games for a team-season; shorter stints count and are labeled. '
      'The 1,100 published daily puzzles are preserved; future dates are generated deterministically.</div>')
    if footer.search(updated): updated=footer.sub(replacement,updated,count=1)
    elif "SABR Lahman Database" not in updated: updated=updated.replace("</body>",replacement+"\\n</body>")
    a.output.write_text(updated,encoding="utf-8")
    print(f"Players: {len(players):,} (+{len(new_ids):,}); team-seasons: {len(ts):,}; latest MLB season: {max_year}; preserved daily pairs: {len(data['sch']):,}")
    print(f"League filter: {'all leagues' if a.include_other_leagues else ', '.join(sorted(MLB_LEAGUE_IDS))}; wrote {a.output}")

if __name__=="__main__": main()
