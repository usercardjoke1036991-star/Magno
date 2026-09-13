import sqlite3
from pathlib import Path

db = Path(".tmp-rkstorage.db")
con = sqlite3.connect(db)
tables = con.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
print("tables", tables)
for table, in tables:
    cols = [r[1] for r in con.execute(f"PRAGMA table_info({table})")]
    print("cols", table, cols)
    if "key" in cols:
        for key, value in con.execute(f"SELECT key, value FROM {table}"):
            text = str(key)
            if any(part in text.lower() for part in ("mode", "world", "lang", "chosen")):
                print(text, "=", repr(value)[:160])
