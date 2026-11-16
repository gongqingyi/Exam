"""Aggregate wrong-word stats from finished session JSON files."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from report import big_category_from_batch, build_summary
from store import list_session_ids, load_session


def _parse_iso(iso: str) -> Optional[datetime]:
    if not iso:
        return None
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return None


def _session_detail(session: Dict[str, Any]) -> List[Dict[str, Any]]:
    summary = session.get("summary")
    if isinstance(summary, dict) and summary.get("detail"):
        return list(summary["detail"])
    if not session.get("ended_at"):
        return []
    return list(build_summary(session).get("detail") or [])


def build_error_stats(
    *,
    category: str,
    direction: str,
    day: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Return wrong-word rows for category+direction(+day), sorted by error_rate desc."""
    buckets = {}  # type: Dict[Tuple[int, str, str], Dict[str, Any]]

    for sid in list_session_ids():
        try:
            session = load_session(sid)
        except FileNotFoundError:
            continue
        if not session.get("ended_at"):
            continue
        cat = session.get("category") or big_category_from_batch(session.get("batch"))
        if cat != category:
            continue
        if (session.get("direction") or "") != direction:
            continue
        report_day = int(session.get("day") or 0)
        if day is not None and report_day != int(day):
            continue

        started = session.get("started_at") or ""
        started_dt = _parse_iso(started)
        for att in _session_detail(session):
            prompt = att.get("prompt") or ""
            expected = att.get("expected_answer") or ""
            key = (report_day, prompt, expected)
            row = buckets.get(key)
            if row is None:
                row = {
                    "day": report_day,
                    "day_label": f"第{report_day}天",
                    "prompt": prompt,
                    "expected_answer": expected,
                    "attempt_count": 0,
                    "wrong_count": 0,
                    "last_started_at": started,
                    "last_started_dt": started_dt,
                }
                buckets[key] = row
            row["attempt_count"] += 1
            if att.get("verdict") != "correct":
                row["wrong_count"] += 1
            if started_dt and (
                row["last_started_dt"] is None or started_dt > row["last_started_dt"]
            ):
                row["last_started_dt"] = started_dt
                row["last_started_at"] = started

    items = []
    for row in buckets.values():
        if row["wrong_count"] <= 0:
            continue
        attempts_n = row["attempt_count"] or 1
        items.append(
            {
                "day": row["day"],
                "day_label": row["day_label"],
                "prompt": row["prompt"],
                "expected_answer": row["expected_answer"],
                "attempt_count": row["attempt_count"],
                "wrong_count": row["wrong_count"],
                "error_rate": row["wrong_count"] / attempts_n,
                "last_started_at": row["last_started_at"],
            }
        )

    items.sort(key=lambda r: (-r["error_rate"], r["prompt"]))
    return items
