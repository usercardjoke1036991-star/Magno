import sqlite3
import subprocess
from pathlib import Path

adb = Path.home() / "AppData/Local/Android/Sdk/platform-tools/adb.exe"
raw = subprocess.check_output(
    [str(adb), "-s", "5d2f7ff0", "exec-out", "run-as", "com.quatrivium.credit", "cat", "databases/RKStorage"]
)
path = Path(".tmp-rkstorage.db")
path.write_bytes(raw)
print("bytes", len(raw), "header", raw[:16])
con = sqlite3.connect(path)
tables = con.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
print("tables", tables)
for table, in tables:
    cols = [r[1] for r in con.execute(f"PRAGMA table_info({table})")]
    print("cols", table, cols)
    if "key" in cols:
        for key, value in con.execute(f"SELECT key, value FROM {table}"):
            text = str(key)
            if any(part in text.lower() for part in ("mode", "world", "lang", "chosen")):
                print(text, "=", repr(value)[:200])
