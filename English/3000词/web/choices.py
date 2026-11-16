"""Batch-generate ABCD distractors via parallel JSON AI calls."""

from __future__ import annotations

import json
import random
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional, Sequence, Tuple

import httpx

from keys import load_key

# Smaller chunks + limited parallelism: ~1 small-batch latency, fewer API drops.
CHUNK_SIZE = 10
MAX_WORKERS = 4

BATCH_SYSTEM_EN_ZH = """英语词汇四选一命题助手（英→中）。
输入 JSON：direction 与 questions（每题 i、prompt=英文原词、answer=本题正确中文释义）。
只输出 JSON：{"items":[{"i":0,"distractors":["a","b","c"]},...]}
覆盖全部 i；每题恰好 3 个中文干扰项；不要输出其它文字。

干扰项原则（相近但必须有区分度）：
1) 可与 prompt/answer 同领域、易混淆，但选了就必须算错——不能与 answer 同义、近义到“也能算对”。
2) 禁止高度相似近义词/换说法：如 comfortable→answer「舒适的」时，勿用「舒服的」「安逸的」等仍可译 comfortable 的词。
3) 禁止 prompt 的其它合法义项或引申译法：如 colour/color→answer「颜色」时，勿用「着色」「上色」「颜料」等 colour 本身也可表示的意思。
4) 优先：形近字、同范畴但不同指称、常见错译；避免只差一个字、语气强弱不同的同义改写。
反例（禁止）：comfortable/舒适的←舒服的；colour/颜色←着色；happy/快乐的←高兴的（若几乎可互换）。
正例（可用）：comfortable/舒适的←方便的、常见的、完整的；colour/颜色←形状、声音、味道。"""

BATCH_SYSTEM_ZH_EN = """英语词汇四选一命题助手（中→英）。
输入 JSON：direction 与 questions（每题 i、prompt=中文提示、answer=本题正确英文词）。
只输出 JSON：{"items":[{"i":0,"distractors":["a","b","c"]},...]}
覆盖全部 i；每题恰好 3 个英文干扰项；不要输出其它文字。

干扰项原则（相近但必须有区分度）：
1) 选了就必须算错——不能与 answer 同义、近义到“也能算对”（含英美拼写变体 colour/color、口语/书面同义 father/dad、mum/mom 等）。
2) 禁止 prompt 的其它合法英文对应：如「父亲」→answer father 时，勿用 dad、papa、parent（若在本题也可算父亲/家长）。
3) 优先级：
   a) 优先形近异义（拼写很像、词义不同）：adapt↔adopt、weather↔whether、angel↔angle、affect↔effect、principal↔principle、desert↔dessert、quiet↔quite；
   b) 不够再补「同范畴但不同词」且有区分度的词，勿用高度相似近义词（big/large、start/begin、happy/glad 这类可互换对）。
尽量每题至少 1 个形近干扰项（有则优先）。
反例（禁止）：父亲/father←dad；开始/start←begin；快乐/happy←glad。
正例（可用）：父亲/father←farther、feather、farmer；适应/adapt←adopt、adept、adjust（adjust 仅当明显不能替代本题答案时）。"""


def _batch_system(direction: str) -> str:
    return BATCH_SYSTEM_ZH_EN if direction == "zh_en" else BATCH_SYSTEM_EN_ZH


def _normalize(s: str) -> str:
    return re.sub(r"\s+", "", (s or "").strip().lower()).replace("our", "or")


def _heuristic_distractors(direction: str, answer: str) -> List[str]:
    if direction == "en_zh":
        pool = [
            "红色", "蓝色", "黄色", "黑色", "白色", "灰色",
            "紫色", "粉色", "褐色", "橙色", "绿色", "金色",
        ]
    else:
        pool = [
            "red", "blue", "yellow", "black", "white", "grey",
            "purple", "pink", "brown", "orange", "green", "gold",
        ]
    ans_n = _normalize(answer)
    out = [p for p in pool if _normalize(p) != ans_n]
    random.shuffle(out)
    while len(out) < 3:
        out.append("%s?" % answer)
    return out[:3]


def _filter_unique(answer: str, distractors: List[str]) -> List[str]:
    ans_n = _normalize(answer)
    seen = {ans_n}
    cleaned = []
    for d in distractors:
        n = _normalize(d)
        if not n or n in seen:
            continue
        seen.add(n)
        cleaned.append(d.strip())
    return cleaned


def _pack_options(answer: str, distractors: List[str], source: str) -> Dict[str, Any]:
    distractors = _filter_unique(answer, distractors)[:3]
    while len(distractors) < 3:
        distractors.append("（干扰%d）" % (len(distractors) + 1))
    options = [answer] + distractors
    random.shuffle(options)
    labels = ["A", "B", "C", "D"]
    items = []
    correct_key = "A"
    for i, text in enumerate(options):
        key = labels[i]
        items.append({"key": key, "text": text})
        if _normalize(text) == _normalize(answer):
            correct_key = key
    return {
        "answer": answer,
        "correct_key": correct_key,
        "options": items,
        "source": source,
    }


def _extract_json_obj(content: str) -> Dict[str, Any]:
    content = (content or "").strip()
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content)
    try:
        obj = json.loads(content)
        if isinstance(obj, dict):
            return obj
    except Exception:
        pass
    m = re.search(r"\{[\s\S]*\}", content)
    if not m:
        raise ValueError("no JSON object in model output")
    obj = json.loads(m.group(0))
    if not isinstance(obj, dict):
        raise ValueError("JSON root must be object")
    return obj


def _parse_batch(content: str) -> Dict[int, List[str]]:
    obj = _extract_json_obj(content)
    out = {}
    for row in obj.get("items") or []:
        if not isinstance(row, dict):
            continue
        try:
            i = int(row.get("i"))
        except Exception:
            continue
        raw = row.get("distractors") or []
        ds = [str(x).strip() for x in raw if str(x).strip()]
        out[i] = ds
    return out


def _chat_batch_json(
    *,
    direction: str,
    chunk: List[Tuple[int, str, str]],
) -> Dict[int, List[str]]:
    """chunk: (index, prompt, answer). Slim JSON in → JSON out."""
    cfg = load_key()
    payload_in = {
        "direction": direction,
        "questions": [
            {"i": i, "prompt": prompt, "answer": answer}
            for i, prompt, answer in chunk
        ],
    }
    user = json.dumps(payload_in, ensure_ascii=False)
    url = f"{cfg['api_base']}/v1/chat/completions"
    body = {
        "model": cfg["model"],
        "messages": [
            {"role": "system", "content": _batch_system(direction)},
            {"role": "user", "content": user},
        ],
        "temperature": 0.5,
        "response_format": {"type": "json_object"},
    }
    headers = {
        "Authorization": f"Bearer {cfg['api_key']}",
        "Content-Type": "application/json",
    }
    with httpx.Client(timeout=60.0) as client:
        resp = client.post(url, headers=headers, json=body)
        if resp.status_code >= 400:
            body.pop("response_format", None)
            resp = client.post(url, headers=headers, json=body)
        resp.raise_for_status()
        data = resp.json()
    return _parse_batch(data["choices"][0]["message"]["content"])


def _run_chunks(
    *,
    direction: str,
    chunks: List[List[Tuple[int, str, str]]],
) -> Dict[int, List[str]]:
    if not chunks:
        return {}
    if len(chunks) == 1:
        try:
            return _chat_batch_json(direction=direction, chunk=chunks[0])
        except Exception:
            return {}

    ai_map = {}  # type: Dict[int, List[str]]
    workers = min(MAX_WORKERS, len(chunks))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futs = [
            pool.submit(_chat_batch_json, direction=direction, chunk=ch)
            for ch in chunks
        ]
        for fut in as_completed(futs):
            try:
                ai_map.update(fut.result())
            except Exception:
                continue
    return ai_map


def _fetch_all_distractors(
    *,
    direction: str,
    jobs: List[Tuple[int, str, str]],
) -> Dict[int, List[str]]:
    """Parallel chunk requests; wall time ≈ slowest chunk. Repair missing once."""
    chunks = [jobs[i : i + CHUNK_SIZE] for i in range(0, len(jobs), CHUNK_SIZE)]
    ai_map = _run_chunks(direction=direction, chunks=chunks)

    missing = [
        (i, prompt, ans)
        for i, prompt, ans in jobs
        if i not in ai_map or len(ai_map.get(i) or []) < 3
    ]
    if missing:
        repair_chunks = [
            missing[i : i + CHUNK_SIZE] for i in range(0, len(missing), CHUNK_SIZE)
        ]
        ai_map.update(_run_chunks(direction=direction, chunks=repair_chunks))
    return ai_map


def build_all_choices(
    *,
    direction: str,
    words: List[Dict[str, Any]],
    use_ai: bool = True,
    indices: Optional[Sequence[int]] = None,
) -> Dict[str, Dict[str, Any]]:
    """Build ABCD packs. Keys are str(index). Optional indices = subset only."""
    if indices is None:
        index_list = list(range(len(words)))
    else:
        index_list = [int(i) for i in indices]
    jobs = []  # type: List[Tuple[int, str, str]]
    for i in index_list:
        if i < 0 or i >= len(words):
            continue
        w = words[i]
        en = w.get("en") or ""
        zh = w.get("zh") or ""
        if direction == "en_zh":
            prompt, answer = en, zh
        else:
            prompt, answer = zh, en
        jobs.append((i, prompt, answer))

    ai_map = {}  # type: Dict[int, List[str]]
    if use_ai and jobs:
        ai_map = _fetch_all_distractors(direction=direction, jobs=jobs)

    result = {}
    for i, _prompt, answer in jobs:
        distractors = list(ai_map.get(i) or [])
        source = "ai" if distractors else "heuristic"
        distractors = _filter_unique(answer, distractors)
        if len(distractors) < 3:
            distractors = _filter_unique(
                answer, distractors + _heuristic_distractors(direction, answer)
            )
            source = "ai+heuristic" if source == "ai" else "heuristic"
        result[str(i)] = _pack_options(answer, distractors, source)
    return result


def build_choices(
    *,
    direction: str,
    en: str,
    zh: str,
    use_ai: bool = True,
) -> Dict[str, Any]:
    packs = build_all_choices(
        direction=direction,
        words=[{"en": en, "zh": zh}],
        use_ai=use_ai,
    )
    return packs["0"]
