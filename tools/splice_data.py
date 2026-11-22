#!/usr/bin/env python3
"""Copy the embedded `const D = {...}` data object from one Dugout HTML file into another file's code.
Usage: splice_data.py data_source.html code_file.html output.html"""
import re, sys
pat = r"const D = (\{.*?\});\s*\n\(function \(\) \{"
src, code, out = sys.argv[1:4]
d = re.search(pat, open(src, encoding="utf-8").read(), re.S)
c = open(code, encoding="utf-8").read(); m = re.search(pat, c, re.S)
if not d or not m: raise SystemExit("Embedded data not found")
open(out, "w", encoding="utf-8").write(c[:m.start(1)] + d.group(1) + c[m.end(1):])
print("spliced", len(d.group(1)), "bytes of data into", out)
