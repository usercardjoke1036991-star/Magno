from pathlib import Path
import re
import sys
from qa_safe_io import ROOT, confine

if len(sys.argv) > 1:
    raw = Path(sys.argv[1])
    try:
        p = confine(raw)
    except ValueError:
        text = str(raw.resolve()).replace("\\", "/")
        if not text.startswith("/root/cyber-scans/"):
            raise
        p = raw
else:
    p = ROOT / "zap-health.html"
t = p.read_text(encoding="utf-8", errors="replace")
print("size", p.stat().st_size)
for m in re.finditer(r"<td[^>]*>(High|Medium|Low|Informational)</td>\s*<td[^>]*>(\d+)</td>", t, re.I):
    print("ROW", m.group(1), m.group(2))
idx = t.find("Summary of Alerts")
if idx < 0:
    idx = t.find("Alerts")
print(t[idx:idx + 1800] if idx >= 0 else t[t.find("<body"): t.find("<body") + 1800])
