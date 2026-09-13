import re
from pathlib import Path

xml = Path(".tmp-uidump.xml").read_text(encoding="utf-8")
nodes = re.findall(
    r'text="([^"]*)"[^>]*content-desc="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',
    xml,
)
if not nodes:
    nodes = re.findall(
        r'text="([^"]*)".*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',
        xml,
    )
    for text, x1, y1, x2, y2 in nodes:
        if text.strip():
            print(f"{x1},{y1}-{x2},{y2} | {text}")
else:
    for text, desc, x1, y1, x2, y2 in nodes:
        if text.strip() or desc.strip():
            print(f"{x1},{y1}-{x2},{y2} | {text} | {desc}")
