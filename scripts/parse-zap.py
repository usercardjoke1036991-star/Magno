from pathlib import Path
import re
p = Path("/root/cyber-scans/2026-09-16-validate/zap-health.html")
t = p.read_text(encoding="utf-8", errors="replace")
print("size", p.stat().st_size)
for m in re.finditer(r"<td[^>]*>(High|Medium|Low|Informational)</td>\s*<td[^>]*>(\d+)</td>", t, re.I):
    print("ROW", m.group(1), m.group(2))
idx = t.find("Summary of Alerts")
if idx < 0:
    idx = t.find("Alerts")
print(t[idx:idx + 1800] if idx >= 0 else t[t.find("<body"): t.find("<body") + 1800])
