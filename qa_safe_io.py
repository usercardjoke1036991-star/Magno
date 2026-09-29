"""Rutas de I/O del kit QA limitadas al directorio del proyecto Magno."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def confine(path: Path | str, root: Path | None = None) -> Path:
    base = (root or ROOT).resolve()
    raw = Path(path)
    target = raw if raw.is_absolute() else base / raw
    resolved = target.resolve()
    if not resolved.is_relative_to(base):
        raise ValueError("ruta fuera del proyecto")
    return resolved


def confine_read(path: Path | str, encoding: str = "utf-8", errors: str = "replace") -> str:
    return confine(path).read_text(encoding=encoding, errors=errors)


def confine_write(path: Path | str, text: str, encoding: str = "utf-8") -> None:
    confine(path).write_text(text, encoding=encoding)
