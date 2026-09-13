import sqlite3
import subprocess
from pathlib import Path

adb = Path.home() / "AppData/Local/Android/Sdk/platform-tools/adb.exe"
db = Path(".tmp-rkstorage.db")
con = sqlite3.connect(db)
con.execute(
    "INSERT OR REPLACE INTO catalystLocalStorage(key, value) VALUES (?, ?)",
    ("quatrivium.appMode.v2", "demo"),
)
con.commit()
con.close()
print("local db set to demo")

subprocess.check_call([str(adb), "-s", "5d2f7ff0", "push", str(db), "/data/local/tmp/RKStorage.db"])
# run-as can often read /data/local/tmp
copied = subprocess.run(
    [
        str(adb),
        "-s",
        "5d2f7ff0",
        "shell",
        "run-as",
        "com.quatrivium.credit",
        "cp",
        "/data/local/tmp/RKStorage.db",
        "databases/RKStorage",
    ],
    capture_output=True,
    text=True,
)
print("copy", copied.returncode, copied.stdout, copied.stderr)
