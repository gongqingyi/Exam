"""Session summary + Markdown report writer."""

from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

REPORTS_DIR = Path(__file__).resolve().parent / "reports"

DIRECTION_LABEL = {
    "en_zh": "英 → 中",
    "zh_en": "中 → 英",
}

# Folder names under reports/<big_category>/<date>/
BIG_CATEGORIES = ("高频常用", "重点必背", "拓展补充")


def big_category_from_batch(batch: Optional[str]) -> str:
    """`1.高频常用/1-5d` → `高频常用`."""
    head = (batch or "").split("/")[0].strip()
    name = re.sub(r"^\d+\.", "", head).strip()
    if name in BIG_CATEGORIES:
        return name
    return name or "未分类"

VERDICT_MARK = {
    "correct": "✓",
    "wrong": "✗",
    "related": "✗",  # legacy rows count as wrong in mark
}


def _fmt_dt(iso: Optional[str]) -> str:
    if not iso:
        return "—"
    try:
        dt = datetime.fromisoformat(iso)
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except ValueError:
        return iso


def _fmt_ms(ms: Optional[int]) -> str:
    if ms is None:
        return "—"
    if ms < 1000:
        return f"{ms} ms"
    return f"{ms / 1000:.2f} s"


def _fmt_duration_zh(started: Optional[str], ended: Optional[str], total_ms: Optional[int] = None) -> str:
    sec = None
    if started and ended:
        try:
            a = datetime.fromisoformat(started.replace("Z", "+00:00"))
            b = datetime.fromisoformat(ended.replace("Z", "+00:00"))
            sec = int(round((b - a).total_seconds()))
        except ValueError:
            sec = None
    if sec is None and total_ms is not None:
        sec = int(round(total_ms / 1000.0))
    if sec is None:
        return "—"
    if sec < 0:
        sec = 0
    h = sec // 3600
    m = (sec % 3600) // 60
    s = sec % 60
    if h > 0:
        return f"{h}小时{m}分{s}秒"
    if m > 0:
        return f"{m}分{s}秒"
    return f"{s}秒"


def build_summary(session: Dict[str, Any]) -> Dict[str, Any]:
    items = list(session.get("results") or [])
    by_index = {}  # type: Dict[int, Dict[str, Any]]
    order = []  # type: list
    for row in items:
        idx = int(row["index"])
        if idx not in by_index:
            order.append(idx)
        by_index[idx] = row
    detail = [by_index[i] for i in order]

    times = [int(r["response_ms"]) for r in detail if r.get("response_ms") is not None]
    correct_n = sum(1 for r in detail if r.get("verdict") == "correct")
    wrong_n = len(detail) - correct_n
    started = session.get("started_at")
    ended = session.get("ended_at")
    total_ms = None
    if started and ended:
        try:
            total_ms = int(
                (datetime.fromisoformat(ended) - datetime.fromisoformat(started)).total_seconds()
                * 1000
            )
        except ValueError:
            total_ms = None

    avg_ms = int(sum(times) / len(times)) if times else None
    max_ms = max(times) if times else None
    min_ms = min(times) if times else None
    rate = (correct_n / len(detail)) if detail else 0.0
    day = session["day"]
    day_label = f"第{day}天"
    batch = session["batch"]
    category = session.get("category") or big_category_from_batch(batch)

    return {
        "session_id": session.get("session_id"),
        "batch": batch,
        "category": category,
        "day": day,
        "day_label": day_label,
        "direction": session["direction"],
        "direction_label": DIRECTION_LABEL.get(session["direction"], session["direction"]),
        "started_at": started,
        "ended_at": ended,
        "finish_reason": session.get("finish_reason"),
        "total_ms": total_ms,
        "item_count": len(detail),
        "avg_response_ms": avg_ms,
        "max_response_ms": max_ms,
        "min_response_ms": min_ms,
        "correct_count": correct_n,
        "wrong_count": wrong_n,
        "accuracy": rate,
        "detail": detail,
    }


def render_markdown(summary: Dict[str, Any]) -> str:
    acc = f"{summary['accuracy'] * 100:.1f}%"
    lines = [
        "---",
        f"session_id: {summary.get('session_id')}",
        f"batch: {summary['batch']}",
        f"category: {summary.get('category') or big_category_from_batch(summary.get('batch'))}",
        f"day: {summary['day']}",
        f"day_label: {summary['day_label']}",
        f"direction: {summary['direction']}",
        f"started_at: {summary['started_at']}",
        f"ended_at: {summary['ended_at']}",
        f"finish_reason: {summary.get('finish_reason')}",
        f"item_count: {summary['item_count']}",
        f"correct_count: {summary['correct_count']}",
        f"wrong_count: {summary['wrong_count']}",
        f"accuracy: {summary['accuracy']:.4f}",
        "---",
        "",
        f"# 测评报告 · {summary.get('category') or ''} · {summary['day_label']} · {summary['direction_label']}",
        "",
        "## 汇总",
        "",
        "| 项目 | 内容 |",
        "| --- | --- |",
        f"| 大类 | {summary.get('category') or '—'} |",
        f"| 测评内容 | {summary['day_label']} |",
        f"| 方向 | {summary['direction_label']} |",
        f"| 开始时间 | {_fmt_dt(summary['started_at'])} |",
        f"| 结束时间 | {_fmt_dt(summary['ended_at'])} |",
        f"| 用时 | {_fmt_duration_zh(summary.get('started_at'), summary.get('ended_at'), summary.get('total_ms'))} |",
        f"| 词条数量 | {summary['item_count']} |",
        f"| 平均响应 | {_fmt_ms(summary['avg_response_ms'])} |",
        f"| 最大响应 | {_fmt_ms(summary['max_response_ms'])} |",
        f"| 最短响应 | {_fmt_ms(summary['min_response_ms'])} |",
        f"| 正确 | {summary['correct_count']} |",
        f"| 错误 | {summary['wrong_count']} |",
        f"| 正确率 | {acc} |",
        f"| 结束原因 | {summary.get('finish_reason') or '—'} |",
        "",
        "## 详单",
        "",
        "| 序号 | 原词条 | 正确答案 | 用户选择 | 判别结果 | 用户响应时间 |",
        "| ---: | --- | --- | --- | :---: | ---: |",
    ]
    for i, row in enumerate(summary["detail"], start=1):
        transcript = (row.get("transcript") or "").replace("|", "\\|") or "（空）"
        prompt = (row.get("prompt") or "").replace("|", "\\|")
        expected = (row.get("expected_answer") or "").replace("|", "\\|")
        mark = VERDICT_MARK.get(row.get("verdict"), "✗")
        lines.append(
            f"| {i} | {prompt} | {expected} | {transcript} | "
            f"{mark} | {_fmt_ms(row.get('response_ms'))} |"
        )
    lines.append("")
    return "\n".join(lines)


def write_report(summary: Dict[str, Any]) -> Path:
    """Write to reports/<大类>/<测评日期>/dayN_en_zh_HHMMSS.md."""
    started = summary.get("started_at") or datetime.now().isoformat()
    try:
        dt = datetime.fromisoformat(started.replace("Z", "+00:00"))
    except ValueError:
        dt = datetime.now().astimezone()
    category = summary.get("category") or big_category_from_batch(summary.get("batch"))
    date_dir = REPORTS_DIR / category / dt.strftime("%Y-%m-%d")
    date_dir.mkdir(parents=True, exist_ok=True)
    name = f"day{summary['day']}_{summary['direction']}_{dt.strftime('%H%M%S')}.md"
    path = date_dir / name
    path.write_text(render_markdown(summary), encoding="utf-8")
    return path


def index_entry(summary: Dict[str, Any], report_path: str, session_json: str) -> Dict[str, Any]:
    started = summary.get("started_at") or ""
    try:
        date = datetime.fromisoformat(started.replace("Z", "+00:00")).strftime("%Y-%m-%d")
    except ValueError:
        date = started[:10] if started else ""
    category = summary.get("category") or big_category_from_batch(summary.get("batch"))
    return {
        "session_id": summary.get("session_id"),
        "date": date,
        "started_at": summary.get("started_at"),
        "ended_at": summary.get("ended_at"),
        "batch": summary.get("batch"),
        "category": category,
        "day": summary.get("day"),
        "day_label": summary.get("day_label"),
        "direction": summary.get("direction"),
        "direction_label": summary.get("direction_label"),
        "item_count": summary.get("item_count"),
        "accuracy": summary.get("accuracy"),
        "finish_reason": summary.get("finish_reason"),
        "report_path": report_path,
        "session_path": session_json,
    }
