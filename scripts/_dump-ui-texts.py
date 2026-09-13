import re
from pathlib import Path

path = Path(".tmp-uidump.xml")
if not path.exists():
    print("NO_DUMP")
    raise SystemExit(1)
text = path.read_text(encoding="utf-8")
for value in re.findall(r'text="([^"]+)"', text):
    if value.strip():
        print(value)
