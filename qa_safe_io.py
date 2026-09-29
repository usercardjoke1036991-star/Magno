"""Rutas de I/O del kit QA limitadas al directorio del proyecto Magno."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
_ALLOWED_WRITE = frozenset({"CONTEXTO.md", "MEMORIA.md", "memoria.json", "zap-health.html"})


def confine(path: Path | str, root: Path | None = None) -> Path:
    base_s = os.path.realpath(os.fspath(root or ROOT))
    raw = os.fspath(path)
    if "\x00" in raw:
        raise ValueError("ruta invalida")
    joined = raw if os.path.isabs(raw) else os.path.join(base_s, raw)
    resolved = os.path.realpath(joined)
    prefix = base_s if base_s.endswith(os.sep) else base_s + os.sep
    if resolved != base_s and not resolved.startswith(prefix):
        raise ValueError("ruta fuera del proyecto")
    rel = os.path.relpath(resolved, base_s)
    if rel.startswith(".."):
        raise ValueError("ruta fuera del proyecto")
    safe = base_s
    for part in rel.split(os.sep):
        if part in ("", "."):
            continue
        if part == ".." or os.sep in part or "/" in part or "\\" in part:
            raise ValueError("ruta invalida")
        safe = os.path.realpath(os.path.join(safe, part))
        if safe != base_s and not safe.startswith(prefix):
            raise ValueError("ruta fuera del proyecto")
    return Path(safe)


def confine_read(path: Path | str, encoding: str = "utf-8", errors: str = "replace") -> str:
    target = confine(path)
    name = os.path.basename(os.fspath(target))
    folder = os.path.dirname(os.fspath(target))
    with open(os.path.join(folder, name), encoding=encoding, errors=errors) as fh:
        return fh.read()


def confine_write(path: Path | str, text: str, encoding: str = "utf-8") -> None:
    target = confine(path)
    name = os.path.basename(os.fspath(target))
    folder = os.path.dirname(os.fspath(target))
    if not name or name in (".", ".."):
        raise ValueError("ruta invalida")
    with open(os.path.join(folder, name), "w", encoding=encoding, newline="\n") as fh:
        fh.write(text)


def write_under(directory: Path | str, filename: str, text: str, encoding: str = "utf-8") -> Path:
    name = os.path.basename(filename)
    if name != filename or name not in _ALLOWED_WRITE:
        raise ValueError("archivo no permitido")
    folder = os.fspath(confine(directory))
    dest = os.path.join(folder, name)
    with open(dest, "w", encoding=encoding, newline="\n") as fh:
        fh.write(text)
    return Path(dest)
