#!/usr/bin/env python3
"""Write the frozen Daily schedule (data/daily-schedule-v1.json: ovr + ext) into a page's embedded data.
Usage: apply_schedule.py page.html data/daily-schedule-v1.json"""
import json, re, sys
pat = r"const D = (\{.*?\});\s*\n\(function \(\) \{"
page, sched = sys.argv[1:3]
h = open(page, encoding="utf-8").read(); m = re.search(pat, h, re.S)
d = json.loads(m.group(1)); s = json.load(open(sched, encoding="utf-8"))
def norm(x):  # match JavaScript's JSON.stringify: 5.0 is written as 5
    if isinstance(x, float) and x.is_integer(): return int(x)
    if isinstance(x, list): return [norm(v) for v in x]
    if isinstance(x, dict): return {k: norm(v) for k, v in x.items()}
    return x
d["ovr"], d["ext"] = s["ovr"], s["ext"]; d = norm(d)
open(page, "w", encoding="utf-8").write(h[:m.start(1)] + json.dumps(d, ensure_ascii=False, separators=(",", ":")) + h[m.end(1):])
print("applied frozen schedule:", len(s["ovr"]), "swaps,", len(s["ext"]), "relocated")
