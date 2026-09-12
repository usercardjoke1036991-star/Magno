#!/usr/bin/env python3
"""Dump current Android UI texts via uiautomator."""
import subprocess
import sys
import xml.etree.ElementTree as ET

DEV = sys.argv[1] if len(sys.argv) > 1 else "5d2f7ff0"
LOCAL = r"C:\CURSORPLANTILLA-BASE\Magno\.tmp-uidump.xml"

subprocess.run(
    ["adb", "-s", DEV, "shell", "uiautomator", "dump", "/sdcard/uidump.xml"],
    capture_output=True,
    check=False,
)
subprocess.run(
    ["adb", "-s", DEV, "pull", "/sdcard/uidump.xml", LOCAL],
    capture_output=True,
    check=False,
)
tree = ET.parse(LOCAL)
print("--- UI ---")
for node in tree.iter():
    text = (node.attrib.get("text") or "").strip()
    desc = (node.attrib.get("content-desc") or "").strip()
    click = node.attrib.get("clickable")
    bounds = node.attrib.get("bounds") or ""
    label = text or (f"[{desc}]" if desc else "")
    if label:
        print(f"{click} {bounds} | {label[:140]}")
