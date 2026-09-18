"""Libera espacio: Temp residual, caches de sandbox y artefactos de Magno no usados por el APK en curso."""
from __future__ import annotations

import os
import shutil
import stat
import time
from pathlib import Path

FREED = 0
SKIPPED = 0
ERRORS = 0

KEEP_NAMES = {
    "quatrivium-release.keystore",
    "keystore.properties",
    "debug.keystore",
}


def on_rm_error(func, path, _exc):
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except OSError:
        global ERRORS
        ERRORS += 1


def size_of(path: Path) -> int:
    if path.is_file() or path.is_symlink():
        try:
            return path.stat().st_size
        except OSError:
            return 0
    total = 0
    try:
        for root, dirs, files in os.walk(path, topdown=True, onerror=lambda _e: None):
            for name in files:
                fp = Path(root) / name
                try:
                    total += fp.stat().st_size
                except OSError:
                    pass
    except OSError:
        return 0
    return total


def remove_path(path: Path, reason: str) -> None:
    global FREED, SKIPPED, ERRORS
    if not path.exists() and not path.is_symlink():
        return
    if path.name in KEEP_NAMES:
        SKIPPED += 1
        print(f"SKIP keep {path}")
        return
    nbytes = size_of(path)
    try:
        if path.is_dir() and not path.is_symlink():
            shutil.rmtree(path, onerror=on_rm_error)
        else:
            path.unlink(missing_ok=True)
        FREED += nbytes
        print(f"DEL {nbytes / (1024 * 1024):8.1f} MB  {reason}  {path}")
    except OSError as err:
        ERRORS += 1
        SKIPPED += 1
        print(f"BUSY {path} ({err})")


def main() -> None:
    temp = Path(os.environ.get("TEMP") or os.environ.get("TMP") or r"C:\Users\Vexor\AppData\Local\Temp")
    local_temp = Path(os.environ.get("LOCALAPPDATA", "")) / "Temp"
    magno = Path(r"C:\CURSORPLANTILLA-BASE\Magno")
    now = time.time()
    day = 24 * 3600

    android_app_build = magno / "android" / "app" / "build"
    targets = [
        temp / "cursor-sandbox-cache",
        temp / "hsperfdata_Vexor",
        magno / "artifacts",
        magno / "cache",
        magno / "forge-out",
        magno / "forge-cache",
        magno / ".expo",
        magno / "coverage",
        magno / "typechain-types",
        magno / "android" / "build",
        magno / "android" / "app" / ".cxx",
        magno / "android" / ".gradle",
        android_app_build / "intermediates",
        android_app_build / "tmp",
        android_app_build / "generated",
        android_app_build / "kotlin",
        magno / "node_modules" / ".cache",
        Path(r"C:\Users\Vexor\.cursor\projects\c-CURSORPLANTILLA-BASE-Magno\agent-tools"),
        Path(os.environ.get("LOCALAPPDATA", "")) / "npm-cache",
    ]
    for item in targets:
        remove_path(item, "cache")

    # Gradle sandbox leftover under Temp (the failed 260-char path). Do NOT wipe %USERPROFILE%\.gradle.
    for child in temp.iterdir() if temp.exists() else []:
        name = child.name.lower()
        if name.startswith("cursor-sandbox") or name.startswith("gradle-") or name == "kotlin-compiler":
            remove_path(child, "temp-gradle")
            continue
        if name.startswith("npm-") or name.startswith("yarn-") or name.startswith("metro-"):
            remove_path(child, "temp-tool")
            continue
        if name.startswith("vscode-") or name.startswith("is-") or name.startswith("jna-"):
            remove_path(child, "temp-installer")
            continue
        if name in {"diagoutputdir", "node-compile-cache", "v8-compile-cache"}:
            remove_path(child, "temp-cache")
            continue
        if name.endswith((".apk", ".log", ".dump", ".js")):
            remove_path(child, "temp-file")
            continue
        # Windows GUID extract leftovers (installer/update staging)
        if len(name) == 36 and name.count("-") == 4:
            remove_path(child, "temp-guid")
            continue
        # Old unlocked files > 1 day
        try:
            age = now - child.stat().st_mtime
        except OSError:
            continue
        if child.is_file() and age > day and child.suffix.lower() in {".tmp", ".log", ".etl", ".dmp", ".zip"}:
            remove_path(child, "stale-temp")

    if local_temp.exists() and local_temp.resolve() != temp.resolve():
        sand = local_temp / "cursor-sandbox-cache"
        remove_path(sand, "localapp-sandbox")

    print(f"FREED_MB {FREED / (1024 * 1024):.1f}")
    print(f"SKIPPED {SKIPPED}")
    print(f"ERRORS {ERRORS}")
    try:
        import shutil as sh

        usage = sh.disk_usage("C:\\")
        print(f"C_FREE_MB {usage.free / (1024 * 1024):.0f}")
    except OSError:
        pass


if __name__ == "__main__":
    main()
