"""Local JSON storage under web/data/."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
SESSIONS_DIR = DATA / "sessions"
INDEX_PATH = DATA / "index.json"


def ensure_dirs() -> None:
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
    if not INDEX_PATH.is_file():
        _write_json(INDEX_PATH, [])


def _read_json(path: Path, default: Any) -> Any:
    if not path.is_file():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, data: Any) -> None:
    """Atomic write: temp file in same dir, then os.replace."""
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(payload, encoding="utf-8")
    os.replace(tmp, path)


def session_path(session_id: str) -> Path:
    return SESSIONS_DIR / f"{session_id}.json"


def save_session(session: Dict[str, Any]) -> Path:
    ensure_dirs()
    path = session_path(session["session_id"])
    payload = {k: v for k, v in session.items() if k != "words"}
    payload["words"] = [
        {"en": w.get("en"), "zh": w.get("zh"), "section": w.get("section")}
        for w in (session.get("words") or [])
    ]
    _write_json(path, payload)
    return path


def load_session(session_id: str) -> Dict[str, Any]:
    path = session_path(session_id)
    if not path.is_file():
        raise FileNotFoundError(session_id)
    return _read_json(path, {})


def list_session_ids() -> List[str]:
    ensure_dirs()
    return sorted(p.stem for p in SESSIONS_DIR.glob("*.json") if p.is_file())


def read_index() -> List[Dict[str, Any]]:
    ensure_dirs()
    data = _read_json(INDEX_PATH, [])
    return data if isinstance(data, list) else []


def upsert_index(entry: Dict[str, Any]) -> None:
    ensure_dirs()
    rows = read_index()
    sid = entry.get("session_id")
    rows = [r for r in rows if r.get("session_id") != sid]
    rows.append(entry)
    rows.sort(key=lambda r: r.get("started_at") or "", reverse=True)
    _write_json(INDEX_PATH, rows)


def list_history() -> List[Dict[str, Any]]:
    rows = read_index()
    rows.sort(key=lambda r: r.get("started_at") or "", reverse=True)
    return rows
