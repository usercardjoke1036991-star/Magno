from pathlib import Path

xml = Path(".tmp-uidump.xml").read_text(encoding="utf-8")
for raw in xml.split(">"):
    if "bounds=" not in raw or "text=" not in raw:
        continue
    text = ""
    desc = ""
    bounds = ""
    for piece in raw.split('"'):
        pass
    try:
        t0 = raw.index('text="') + 6
        t1 = raw.index('"', t0)
        text = raw[t0:t1]
    except ValueError:
        continue
    try:
        d0 = raw.index('content-desc="') + 14
        d1 = raw.index('"', d0)
        desc = raw[d0:d1]
    except ValueError:
        desc = ""
    try:
        b0 = raw.index('bounds="') + 8
        b1 = raw.index('"', b0)
        bounds = raw[b0:b1]
    except ValueError:
        continue
    coords = bounds.replace("[", "").replace("]", ",").split(",")
    nums = [c for c in coords if c]
    if len(nums) < 4:
        continue
    x1, y1, x2, y2 = nums[0], nums[1], nums[2], nums[3]
    if text.strip() or desc.strip():
        extra = f" | {desc}" if desc.strip() else ""
        print(f"{x1},{y1}-{x2},{y2} | {text}{extra}")
