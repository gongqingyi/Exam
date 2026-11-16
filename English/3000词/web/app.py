"""Vocabulary multiple-choice practice API."""

from __future__ import annotations

import threading
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, Form, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from choices import CHUNK_SIZE, build_all_choices
from report import big_category_from_batch, build_summary, index_entry, write_report
from stats import build_error_stats
from store import list_history, load_session, save_session, upsert_index

ROOT = Path(__file__).resolve().parent
VOCAB_ROOT = ROOT.parent
STATIC = ROOT / "static"
REPORTS = ROOT / "reports"
DATA = ROOT / "data"
REPORTS.mkdir(parents=True, exist_ok=True)
DATA.mkdir(parents=True, exist_ok=True)
(DATA / "sessions").mkdir(parents=True, exist_ok=True)

# First batch generated synchronously so the user can start immediately.
PREFETCH_COUNT = 5
CHOICE_WAIT_SEC = 45.0

app = FastAPI(title="3000词选择题练习")
SESSIONS: Dict[str, Dict[str, Any]] = {}
_SESSION_LOCKS: Dict[str, threading.Lock] = {}
_SESSION_LOCKS_GUARD = threading.Lock()


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="milliseconds")


def parse_client_dt(value: Optional[str]) -> datetime:
    """Parse client/server ISO times. Python 3.9 needs Z → +00:00."""
    if not value:
        return datetime.now().astimezone()
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return datetime.now().astimezone()
    if dt.tzinfo is None:
        dt = dt.astimezone()  # treat naive as local
    return dt


def parse_client_time(value: Optional[str]) -> str:
    return parse_client_dt(value).isoformat(timespec="milliseconds")


def _session_lock(session_id: str) -> threading.Lock:
    with _SESSION_LOCKS_GUARD:
        lock = _SESSION_LOCKS.get(session_id)
        if lock is None:
            lock = threading.Lock()
            _SESSION_LOCKS[session_id] = lock
        return lock


def _public_choices(choices: Dict[str, Any]) -> Dict[str, Any]:
    return {
        k: {"options": v["options"], "source": v.get("source")}
        for k, v in (choices or {}).items()
    }


def list_batches() -> List[Dict[str, Any]]:
    """Discover words.json under <大类>/<批次>/默写/ (and legacy <批次>/默写/)."""
    batches: List[Dict[str, Any]] = []
    seen = set()  # type: set
    paths = list(VOCAB_ROOT.glob("*/*/默写/words.json")) + list(
        VOCAB_ROOT.glob("*/默写/words.json")
    )
    for words_path in sorted(paths):
        rel = words_path.parent.parent.relative_to(VOCAB_ROOT).as_posix()
        if rel in seen:
            continue
        seen.add(rel)
        data = __import__("json").loads(words_path.read_text(encoding="utf-8"))
        days = []
        for day in data.get("days") or []:
            items = day.get("items") or []
            words = [it for it in items if it.get("type") == "w"]
            days.append({"day": day.get("day"), "word_count": len(words)})
        if days:
            category = big_category_from_batch(rel)
            batches.append(
                {
                    "batch": rel,
                    "category": category,
                    "title": data.get("title") or rel,
                    "days": days,
                }
            )
    return batches


def load_day_words(batch: str, day: int) -> List[Dict[str, Any]]:
    # batch is "<大类>/<批次>" or legacy "<批次>"
    path = VOCAB_ROOT / batch / "默写" / "words.json"
    if not path.is_file():
        raise HTTPException(404, f"batch not found: {batch}")
    data = __import__("json").loads(path.read_text(encoding="utf-8"))
    for block in data.get("days") or []:
        if int(block.get("day")) == int(day):
            section = ""
            words: List[Dict[str, Any]] = []
            for it in block.get("items") or []:
                if it.get("type") == "sec":
                    section = it.get("text") or ""
                    continue
                if it.get("type") == "w":
                    words.append(
                        {
                            "en": it.get("en") or "",
                            "zh": it.get("zh") or "",
                            "section": section,
                        }
                    )
            return words
    raise HTTPException(404, f"day not found: {batch} day {day}")


def quiz_prompts(words: List[Dict[str, Any]], direction: str) -> List[Dict[str, Any]]:
    out = []
    for i, w in enumerate(words):
        prompt = w["en"] if direction == "en_zh" else w["zh"]
        out.append({"id": i, "prompt": prompt, "section": w.get("section") or ""})
    return out


def get_session(session_id: str) -> Dict[str, Any]:
    session = SESSIONS.get(session_id)
    if session:
        return session
    try:
        session = load_session(session_id)
        SESSIONS[session_id] = session
        return session
    except FileNotFoundError:
        raise HTTPException(404, "session not found")


def _merge_choices(session: Dict[str, Any], packs: Dict[str, Any]) -> None:
    if not packs:
        return
    lock = _session_lock(session["session_id"])
    with lock:
        choices = session.setdefault("choices", {})
        choices.update(packs)
        save_session(session)


def _fill_choices_background(session_id: str, start_index: int) -> None:
    """Generate remaining ABCD packs in CHUNK_SIZE batches after prefetch."""
    session = SESSIONS.get(session_id)
    if not session:
        return
    words = session.get("words") or []
    direction = session.get("direction") or "en_zh"
    total = len(words)
    i = start_index
    while i < total:
        if session.get("ended_at"):
            return
        end = min(i + CHUNK_SIZE, total)
        missing = [
            idx
            for idx in range(i, end)
            if str(idx) not in (session.get("choices") or {})
        ]
        if missing:
            try:
                packs = build_all_choices(
                    direction=direction,
                    words=words,
                    use_ai=True,
                    indices=missing,
                )
            except Exception:
                packs = build_all_choices(
                    direction=direction,
                    words=words,
                    use_ai=False,
                    indices=missing,
                )
            # Session may have finished while AI ran
            if session.get("ended_at"):
                return
            live = SESSIONS.get(session_id)
            if live is not session:
                return
            _merge_choices(session, packs)
        i = end


class StartBody(BaseModel):
    batch: str
    day: int
    direction: str = Field(pattern="^(en_zh|zh_en)$")


class FinishBody(BaseModel):
    session_id: str
    reason: str = Field(pattern="^(completed|aborted)$")


@app.get("/api/days")
def api_days():
    return {"batches": list_batches()}


@app.post("/api/session/start")
def api_session_start(body: StartBody):
    words = load_day_words(body.batch, body.day)
    if not words:
        raise HTTPException(400, "no words for this day")

    prefetch_n = min(PREFETCH_COUNT, len(words))
    choices = build_all_choices(
        direction=body.direction,
        words=words,
        use_ai=True,
        indices=list(range(prefetch_n)),
    )
    sid = uuid.uuid4().hex
    started = now_iso()
    SESSIONS[sid] = {
        "session_id": sid,
        "batch": body.batch,
        "category": big_category_from_batch(body.batch),
        "day": body.day,
        "direction": body.direction,
        "started_at": started,
        "ended_at": None,
        "finish_reason": None,
        "words": words,
        "choices": choices,
        "results": [],
        "report_path": None,
        "summary": None,
    }
    save_session(SESSIONS[sid])

    if prefetch_n < len(words):
        threading.Thread(
            target=_fill_choices_background,
            args=(sid, prefetch_n),
            daemon=True,
            name=f"choices-{sid[:8]}",
        ).start()

    return {
        "session_id": sid,
        "started_at": started,
        "day": body.day,
        "day_label": f"第{body.day}天",
        "count": len(words),
        "choices_ready": prefetch_n,
        "items": quiz_prompts(words, body.direction),
        "choices": _public_choices(choices),
    }


@app.get("/api/choices")
def api_choices(session_id: str, index: int):
    session = get_session(session_id)
    if session.get("ended_at"):
        raise HTTPException(400, "session already finished")
    words = session["words"]
    if index < 0 or index >= len(words):
        raise HTTPException(400, "index out of range")

    deadline = time.time() + CHOICE_WAIT_SEC
    while time.time() < deadline:
        cached = (session.get("choices") or {}).get(str(index))
        if cached:
            return {
                "index": index,
                "options": cached["options"],
                "source": cached.get("source"),
                "ready": True,
            }
        time.sleep(0.25)
    raise HTTPException(503, "choices still generating; retry shortly")


@app.post("/api/attempt")
async def api_attempt(
    session_id: str = Form(...),
    index: int = Form(...),
    item_started_at: Optional[str] = Form(None),
    ended_reason: str = Form("scored"),
    choice_key: Optional[str] = Form(None),
    client_response_ms: Optional[int] = Form(None),
):
    session = get_session(session_id)
    if session.get("ended_at"):
        raise HTTPException(400, "session already finished")
    words = session["words"]
    if index < 0 or index >= len(words):
        raise HTTPException(400, "index out of range")

    word = words[index]
    direction = session["direction"]
    started_dt = parse_client_dt(item_started_at)
    ended_dt = datetime.now().astimezone()
    started_at = started_dt.isoformat(timespec="milliseconds")
    ended_at = ended_dt.isoformat(timespec="milliseconds")
    prompt = word["en"] if direction == "en_zh" else word["zh"]
    expected_answer = word["zh"] if direction == "en_zh" else word["en"]

    transcript = ""
    note = ""
    score = 0
    verdict = "wrong"

    if ended_reason == "skipped":
        note = "未作答，直接下一题"
    else:
        pack = (session.get("choices") or {}).get(str(index))
        if not pack:
            raise HTTPException(400, "choices not ready; call /api/choices first")
        key = (choice_key or "").strip().upper()
        chosen = None
        for opt in pack["options"]:
            if opt["key"] == key:
                chosen = opt["text"]
                break
        if chosen is None:
            note = "无效选项"
            transcript = key or ""
        else:
            transcript = chosen
            if key == pack["correct_key"]:
                score = 100
                verdict = "correct"
            else:
                score = 0
                verdict = "wrong"

    # Prefer client elapsed (load → submit/next); fall back to server clock.
    if client_response_ms is not None and int(client_response_ms) >= 0:
        response_ms = int(client_response_ms)
    else:
        response_ms = max(
            0, int((ended_dt - started_dt.astimezone()).total_seconds() * 1000)
        )

    row = {
        "index": index,
        "prompt": prompt,
        "expected_answer": expected_answer,
        "en": word["en"],
        "zh": word["zh"],
        "transcript": transcript,
        "choice_key": (choice_key or "").strip().upper() or None,
        "score": score,
        "verdict": verdict,
        "judge_source": "choice",
        "item_started_at": started_at,
        "item_ended_at": ended_at,
        "response_ms": response_ms,
        "ended_reason": ended_reason,
        "note": note,
    }
    session["results"].append(row)
    save_session(session)

    return {
        "transcript": transcript,
        "choice_key": row["choice_key"],
        "score": score,
        "verdict": verdict,
        "expected_answer": expected_answer,
        "response_ms": response_ms,
        "note": note,
    }


@app.post("/api/session/finish")
def api_session_finish(body: FinishBody):
    session = get_session(body.session_id)
    if not session.get("ended_at"):
        session["ended_at"] = now_iso()
        session["finish_reason"] = body.reason
    summary = build_summary(session)
    path = write_report(summary)
    rel = str(path.relative_to(ROOT))
    session["report_path"] = rel
    session["summary"] = summary
    save_session(session)
    session_rel = f"data/sessions/{session['session_id']}.json"
    entry = index_entry(summary, rel, session_rel)
    upsert_index(entry)
    summary["report_path"] = rel
    summary["session_path"] = session_rel
    return summary


@app.get("/api/history")
def api_history():
    return {"items": list_history()}


@app.get("/api/history/{session_id}")
def api_history_detail(session_id: str):
    try:
        session = load_session(session_id)
    except FileNotFoundError:
        raise HTTPException(404, "session not found")
    if session.get("summary"):
        summary = session["summary"]
    else:
        summary = build_summary(session)
    summary["report_path"] = session.get("report_path")
    summary["session_path"] = f"data/sessions/{session_id}.json"
    return summary


@app.get("/api/stats/errors")
def api_stats_errors(
    category: str = "高频常用",
    direction: str = "en_zh",
    day: Optional[int] = None,
):
    if direction not in ("en_zh", "zh_en"):
        raise HTTPException(400, "direction must be en_zh or zh_en")
    items = build_error_stats(category=category, direction=direction, day=day)
    return {
        "category": category,
        "direction": direction,
        "day": day,
        "items": items,
    }


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


app.mount("/static", StaticFiles(directory=STATIC), name="static")
app.mount("/reports", StaticFiles(directory=REPORTS), name="reports")
app.mount("/data", StaticFiles(directory=DATA), name="data")
