#!/usr/bin/env python3
"""Render 《学生实用英汉大词典》辨析框 cards to PNG."""

import html
import re
import subprocess
import sys
from pathlib import Path

from proofread import fix_sources, normalize

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
DICT_DIR = Path(__file__).resolve().parent.parent
JSON_PATH = DICT_DIR / "学生实用英汉大词典1999_辨析框原始数据.json"
MD_PATH = DICT_DIR / "学生实用英汉大词典1999_辨析框索引.md"
OUT = Path(__file__).resolve().parent
WORK = Path("/tmp/dict-cards")
HTML_DIR = WORK / "html"
RAW_DIR = WORK / "raw"

FALLBACK_SLUG = {
    275: "juzi-de-shuofa-zhongzhong",
    276: "keting-zhongzhong",
    277: "butong-de-he",
    278: "biaoshi-shiqing-de-mingci",
    279: "biaoshi-xuke-de-qingtai-dongci",
}

COMMON = {
    "the", "and", "for", "that", "this", "with", "from", "have", "has", "had",
    "been", "were", "was", "are", "not", "but", "you", "his", "her", "their",
    "she", "they", "into", "over", "after", "before", "about", "room", "back",
    "high", "other", "important", "useful", "there", "their", "which", "would",
    "could", "should", "than", "then", "them", "your", "our", "out", "all",
    "any", "can", "may", "its", "it's", "don't", "does", "did", "just", "very",
    "also", "only", "when", "what", "where", "who", "how", "why", "each",
    "such", "some", "more", "most", "much", "many", "like", "make", "made",
    "take", "time", "people", "because", "while", "those", "these", "here",
}

CJK_RE = re.compile(r"[\u4e00-\u9fff]")
LAT_RE = re.compile(r"[A-Za-z]")
POINT_RE = re.match  # placeholder to keep linters calm
POINT_MARK = re.compile(r"^([①②③④⑤⑥⑦⑧⑨⑩])\s*(.*)$")
CONT_END = tuple("是的了与和或在把被从对而并及其之所等也就都还很更")

CSS = r"""
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #000; margin: 0; padding: 16px; }
.sheet {
  width: 920px;
  background: #e4efe8;
  padding: 28px;
  font-family: "PingFang SC", "Hiragino Sans GB", "Heiti SC", sans-serif;
  color: #241f1a;
  -webkit-font-smoothing: antialiased;
}
.card { background: #fff9f3; border-radius: 18px; overflow: hidden; }
.header {
  background: #1f4e45;
  color: #f6f1e7;
  padding: 22px 28px 20px;
  border-bottom: 3px solid #c4a574;
}
.meta {
  display: flex; justify-content: space-between; align-items: baseline;
  font-size: 13px; letter-spacing: 0.04em; color: #c9ddd4;
}
h1 {
  margin-top: 8px; font-size: 30px; line-height: 1.25;
  font-weight: 600; letter-spacing: 0.01em;
}
.body { padding: 22px 26px 26px; }
.body > * + * { margin-top: 14px; }
.label {
  font-size: 13px; font-weight: 600; letter-spacing: 0.14em; color: #1f4e45;
}
.rule { height: 1px; background: #e6dfd4; }
.point { display: flex; gap: 10px; align-items: flex-start; }
.num {
  flex: 0 0 22px; font-size: 15px; font-weight: 600; color: #1f4e45; line-height: 1.55;
}
.point-body { flex: 1; min-width: 0; }
.point-body > * + * { margin-top: 8px; }
.prose, .lead {
  font-size: 16px; line-height: 1.6; font-weight: 400;
}
.lead { font-weight: 550; }
.hw { font-weight: 650; }
.ex { background: #f4eee6; border-radius: 10px; padding: 10px 14px; }
.en {
  font-family: "Iowan Old Style", Palatino, "Songti SC", "STSong", serif;
  font-size: 17px; line-height: 1.45; color: #1c1916;
}
.zh { margin-top: 4px; font-size: 14px; line-height: 1.5; color: #6a635b; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.panel, .col { border-radius: 12px; padding: 12px 14px 14px; }
.panel > * + *, .col > * + * { margin-top: 8px; }
.warm { background: #f6f0e6; }
.cool { background: #e5f1eb; }
.panel .ex, .col .ex { background: rgba(255, 255, 255, 0.72); }
.note {
  background: #f3f7f4; border-radius: 10px; padding: 10px 14px;
  font-size: 14.5px; line-height: 1.6; color: #3e4a45;
}
.judge { border-radius: 10px; padding: 8px 14px; font-size: 16px; line-height: 1.5; }
.judge.ok { background: #e7f2ec; }
.judge.bad { background: #f8efe9; }
.tag { font-weight: 650; margin-right: 6px; }
.judge.ok .tag { color: #1f4e45; }
.judge.bad .tag { color: #9a4d3c; }
.judge .en { display: inline; font-size: 16px; }
"""


def slug_for(index, title):
    t = title.replace("(s)", "s")
    t = CJK_RE.sub(" ", t)
    t = t.replace("'", "'")
    t = re.sub(r"[^A-Za-z0-9']+", "-", t)
    t = re.sub(r"-+", "-", t).strip("-").lower()
    t = re.sub(r"-s-", "-", t)
    t = re.sub(r"-s$", "", t)
    if not t:
        t = FALLBACK_SLUG.get(index, f"entry-{index:03d}")
    return f"{index:03d}-{t}.png"


def headwords(title):
    t = re.sub(r"[\u4e00-\u9fff]+", "\n", title)
    t = t.replace("...", " ").replace("…", " ")
    t = t.replace("(", " ").replace(")", " ")
    parts = re.split(r"[\n,，、;；/]| and ", t)
    out = []
    for p in parts:
        p = re.sub(r"\s+", " ", p).strip(" \"“”‘’'?？.。:：[]（）")
        if LAT_RE.search(p or ""):
            out.append(p)
    # longest first when matching
    return out


def cjk_n(s):
    return len(CJK_RE.findall(s))


def lat_n(s):
    return len(LAT_RE.findall(s))


def mostly_en(s):
    return lat_n(s) >= 8 and lat_n(s) > cjk_n(s)


def mostly_zh(s):
    return cjk_n(s) >= 2 and cjk_n(s) >= lat_n(s)


def ends_zh(s):
    return s.endswith(("。", "！", "？", "；", "：", "…"))


def ends_en(s):
    t = s.rstrip("”\"'）)〕]")
    return t.endswith((".", "?", "!", ";", ":"))


def starts_with_hw(text, hw):
    if len(hw) < 2:
        return False
    if not text.lower().startswith(hw.lower()):
        return False
    rest = text[len(hw):]
    if rest[:1].isascii() and rest[:1].isalpha():
        return False
    if " " not in hw.strip() and len(hw) <= 3:
        rest2 = rest.lstrip(" \t,，:：")
        if not rest2 or (rest2[:1].isascii() and rest2[:1].isalpha()):
            return False
        if not CJK_RE.search(rest2[:16]):
            return False
    return True


def is_overview(text, hws):
    """A sentence that names several headwords at once is an introduction."""
    if "：" in text or text.endswith(":"):
        return False
    hits = 0
    for hw in hws:
        if re.search(r"(?<![A-Za-z])" + re.escape(hw) + r"(?![A-Za-z])", text, re.I):
            hits += 1
    return hits >= 2


def is_panel_start(text, hws):
    t = text.lstrip("▲ \t")
    if POINT_MARK.match(t):
        return False
    if mostly_en(t) and not CJK_RE.search(t[:30]):
        return False
    if is_overview(t, hws):
        return False
    for hw in sorted(hws, key=len, reverse=True):
        if starts_with_hw(t, hw):
            return True
    return False


def normalize_line(s):
    s = s.strip().replace("\u3000", " ")
    s = s.rstrip("|｜")
    if s.startswith("〔") and cjk_n(s) >= 2:
        s = "①" + s[1:]
    return s.strip()


def merge_lines(cur, nxt):
    m = re.match(r"([A-Za-z]+)", nxt)
    frag = re.search(r"([A-Za-z]+)-$", cur)
    if cur.endswith("-") and m and frag:
        token = m.group(1)
        fragw = frag.group(1)
        low = token.lower()
        if low.startswith(fragw.lower()) and len(token) > len(fragw):
            return cur[: -len(fragw) - 1] + nxt
        if low in COMMON and len(fragw) > 2:
            return cur + nxt
        if low in COMMON and len(fragw) <= 2:
            return cur[:-1] + nxt
        return cur[:-1] + nxt
    if CJK_RE.search(cur[-1:]) and CJK_RE.match(nxt):
        return cur + nxt
    if cur.endswith(("-", "——", "—")) and CJK_RE.match(nxt.lstrip()):
        return cur + nxt
    return cur.rstrip() + " " + nxt.lstrip()


DANGLE = set("是的了与和或在把被从对而并及其之所等也就都还很更非关只上下中里们者着过")


def can_join(cur, nxt, full, hws):
    if re.match(r"^[①②③④⑤⑥⑦⑧⑨⑩▲［\[]", nxt):
        return False
    if re.match(r"^(正|误)[:：]", nxt):
        return False
    if cur.endswith(("：", ":")) and not cur.endswith(("（=", "(=")):
        return False
    if cur.endswith("]"):
        return False
    if cur.endswith("-") and re.match(r"[A-Za-z（(]", nxt):
        return True
    if (cur.count("（") > cur.count("）") or cur.count("［") > cur.count("］") or cur.count("(") > cur.count(")")) and not re.match(r"^[①②③▲]", nxt):
        return True
    unfinished_en = lat_n(cur) > cjk_n(cur) and not ends_en(cur) and re.match(r"[a-z]", nxt or "")
    if (
        cjk_n(cur) >= 1
        and re.match(r"[A-Za-z]", nxt)
        and not cur.endswith(("-", "，", ",", "、", "与", "和", "或", "（", "("))
        and not unfinished_en
    ):
        return False
    if is_panel_start(nxt, hws) and not cur.endswith(("与", "和", "或")):
        return False
    if lat_n(cur) >= 6 and cjk_n(cur) <= 1 and not ends_en(cur):
        if re.match(r"[a-z(\[]", nxt):
            return True
        if lat_n(nxt) > cjk_n(nxt) and len(cur) >= max(18, int(full * 0.7)):
            return True
    if ends_zh(cur):
        return False
    if cur.endswith(("，", "、", "；")):
        return True
    if cur[-1:] in DANGLE and not nxt.startswith("用"):
        return True
    if nxt[:1] in "的了之上中里们者着过与和或之意其于洲":
        return True
    if (
        CJK_RE.search(cur[-1:])
        and cjk_n(nxt) >= 1
        and len(nxt) <= 10
        and not nxt.startswith("用")
        and not is_panel_start(nxt, hws)
    ):
        return True
    nxt_body = nxt.lstrip("“\"‘'「『")
    if CJK_RE.search(cur[-1:]) and CJK_RE.match(nxt_body) and not is_panel_start(nxt_body, hws):
        if len(cur) >= max(14, int(full * 0.45)) and not nxt_body.startswith("用"):
            return True
    if ends_en(cur):
        return False
    if cur.endswith(("——", "—", "…")) and cjk_n(nxt) >= 1:
        return True
    if re.search(r"[;；，,]\s*[A-Za-z][A-Za-z ']{0,24}$", cur) and CJK_RE.match(nxt):
        return True
    if (
        cjk_n(nxt) >= 1
        and len(nxt) <= 8
        and not nxt.startswith("用")
        and not is_panel_start(nxt, hws)
        and not cur.endswith(("：", ":"))
    ):
        return True
    return False


def join_lines(raw, hws):
    lines = [normalize_line(x) for x in raw.splitlines()]
    lines = [x for x in lines if x]
    if not lines:
        return []
    maxlen = max(len(x) for x in lines)
    full = max(16, int(maxlen * 0.78))
    out = [lines[0]]
    for nxt in lines[1:]:
        if can_join(out[-1], nxt, full, hws):
            out[-1] = merge_lines(out[-1], nxt)
        else:
            out.append(nxt)
    return [tidy_gap(x) for x in out]


def tidy_gap(s):
    s = re.sub(r"([\u4e00-\u9fff”\"）)])\s+([\u4e00-\u9fff])", r"\1\2", s)
    s = re.sub(r"([\u4e00-\u9fff])\s+([，。；：、])", r"\1\2", s)
    s = re.sub(r"([，、；])\s+", r"\1", s)
    return s


def try_split_gloss(s):
    """Split 'English phrase 中文释义' into a pair. Keep definitions intact."""
    m = CJK_RE.search(s)
    if not m or not re.match(r"[A-Za-z(]", s):
        return None
    en = s[: m.start()].strip(" \t")
    zh = s[m.start() :].strip()
    if len(en) < 2 or cjk_n(zh) < 1:
        return None
    if CJK_RE.search(en):
        return None
    # A headword plus a Chinese definition stays prose.
    if lat_n(zh) > lat_n(en):
        return None
    # Sentence plus translation, or a short phrase gloss.
    # A headword followed by a definition stays one prose line.
    words = [w for w in en.split() if w]
    if re.search(r"[.?!]$", en):
        return en, zh
    # Headword plus a definition, not a phrase gloss.
    if len(words) <= 3 and (
        cjk_n(zh) > 12 or re.search(r"(意思|含有|表示|指|用于|多指|主要)", zh)
    ):
        return None
    if len(words) >= 2:
        return en, zh
    return None


def classify(line):
    s = line.strip()
    if s in ("相同处", "不同处"):
        return {"kind": "label", "text": s}
    if s.startswith("▲"):
        return {"kind": "note", "text": s.lstrip("▲").strip()}
    if s.startswith("［") or s.startswith("["):
        return {"kind": "note", "text": s}
    m = POINT_MARK.match(s)
    if m:
        return {"kind": "point", "n": m.group(1), "text": m.group(2).strip()}
    jm = re.match(r"^(正|误)[:：]\s*(.*)$", s)
    if jm:
        return {"kind": "judge", "ok": jm.group(1) == "正", "text": jm.group(2).strip()}
    if "[" in s and lat_n(s) >= 4 and cjk_n(s) <= 8:
        return {"kind": "example", "en": tidy_en(s), "zh": ""}
    split = try_split_gloss(s)
    if split:
        return {"kind": "example", "en": tidy_en(split[0]), "zh": split[1]}
    if mostly_en(s) and cjk_n(s) <= 2:
        return {"kind": "example", "en": tidy_en(s), "zh": ""}
    return {"kind": "prose", "text": s}


def tidy_en(s):
    s = re.sub(r"\s+", " ", s).strip()
    s = s.replace(" ,", ",").replace(" .", ".")
    return s


def pair_glosses(units, hws):
    out = []
    i = 0
    while i < len(units):
        u = units[i]
        if (
            u["kind"] == "example"
            and not u.get("zh")
            and i + 1 < len(units)
            and units[i + 1]["kind"] == "prose"
            and is_gloss(units[i + 1]["text"], hws)
        ):
            u = dict(u)
            u["zh"] = units[i + 1]["text"]
            out.append(u)
            i += 2
            continue
        out.append(u)
        i += 1
    return out


def is_gloss(text, hws):
    if len(text) > 150:
        return False
    if is_panel_start(text, hws):
        return False
    if text.startswith(("但是", "但", "注意", "一般", "以下", "如果", "不过", "另外", "其中")):
        return False
    if text.count("。") > 2:
        return False
    return True


def group_units(units, hws):
    blocks = []
    i = 0
    while i < len(units):
        u = units[i]
        if u["kind"] == "label":
            blocks.append(u)
            i += 1
            continue
        if u["kind"] == "point":
            kids = []
            i += 1
            while i < len(units) and units[i]["kind"] not in ("point", "label"):
                if is_panel_start(units[i].get("text", ""), hws) and units[i]["kind"] == "prose":
                    break
                kids.append(units[i])
                i += 1
            blocks.append({"kind": "point", "n": u["n"], "text": u["text"], "children": kids})
            continue
        if u["kind"] == "prose" and is_panel_start(u["text"], hws):
            kids = [u]
            i += 1
            while i < len(units) and units[i]["kind"] not in ("label", "point"):
                nxt = units[i]
                if nxt["kind"] == "prose" and is_panel_start(nxt["text"], hws):
                    break
                kids.append(nxt)
                i += 1
            blocks.append({"kind": "panel", "children": kids})
            continue
        blocks.append(u)
        i += 1
    return blocks


def panel_is_short(panel):
    text_len = 0
    examples = 0
    longest = 0
    for c in panel["children"]:
        if c["kind"] == "example":
            examples += 1
            longest = max(longest, len(c.get("en") or ""))
            text_len += len(c.get("zh") or "")
        elif c["kind"] == "prose":
            text_len += len(c.get("text") or "")
        elif c["kind"] == "note":
            return False
        else:
            text_len += len(c.get("text") or "")
    return text_len <= 90 and examples <= 2 and longest <= 78


def esc(s):
    return html.escape(s or "", quote=False)


def emphasize(text, hws):
    raw = text
    for hw in sorted(hws, key=len, reverse=True):
        if raw.lower().startswith(hw.lower()):
            return f'<span class="hw">{esc(raw[: len(hw)])}</span>{esc(raw[len(hw):])}'
    return esc(raw)


def render_example(u):
    zh = f'<div class="zh">{esc(u.get("zh") or "")}</div>' if u.get("zh") else ""
    return f'<div class="ex"><div class="en">{esc(u.get("en") or "")}</div>{zh}</div>'


def render_inline(u, hws, lead=False):
    k = u["kind"]
    if k == "example":
        return render_example(u)
    if k == "note":
        return f'<div class="note">{esc(u.get("text") or "")}</div>'
    if k == "judge":
        cls = "ok" if u.get("ok") else "bad"
        tag = "正" if u.get("ok") else "误"
        body = u.get("text") or ""
        if mostly_en(body):
            inner = f'<span class="en">{esc(body)}</span>'
        else:
            inner = esc(body)
        return f'<div class="judge {cls}"><span class="tag">{tag}</span>{inner}</div>'
    if k == "prose":
        cls = "lead" if lead else "prose"
        return f'<p class="{cls}">{emphasize(u.get("text") or "", hws)}</p>'
    return f'<p class="prose">{esc(u.get("text") or "")}</p>'


def render_kids(children, hws):
    parts = []
    for i, c in enumerate(children):
        lead = i == 0 and c["kind"] == "prose"
        parts.append(render_inline(c, hws, lead=lead))
    return "".join(parts)


def render_point(block, hws):
    bits = []
    if block.get("text"):
        bits.append(f'<p class="lead">{emphasize(block["text"], hws)}</p>')
    bits.append(render_kids(block["children"], hws))
    return (
        '<div class="point"><div class="num">'
        + esc(block["n"])
        + '</div><div class="point-body">'
        + "".join(bits)
        + "</div></div>"
    )


def render_blocks(blocks, hws):
    html_parts = []
    i = 0
    while i < len(blocks):
        b = blocks[i]
        if b["kind"] == "panel":
            run = []
            while i < len(blocks) and blocks[i]["kind"] == "panel":
                run.append(blocks[i])
                i += 1
            if len(run) == 2 and all(panel_is_short(p) for p in run):
                cols = []
                for j, p in enumerate(run):
                    tone = "warm" if j == 0 else "cool"
                    cols.append(f'<div class="col {tone}">{render_kids(p["children"], hws)}</div>')
                html_parts.append('<div class="cols">' + "".join(cols) + "</div>")
            else:
                for j, p in enumerate(run):
                    tone = "warm" if j % 2 == 0 else "cool"
                    html_parts.append(
                        f'<div class="panel {tone}">{render_kids(p["children"], hws)}</div>'
                    )
            continue
        if b["kind"] == "label":
            html_parts.append(f'<div class="label">{esc(b["text"])}</div>')
        elif b["kind"] == "point":
            html_parts.append(render_point(b, hws))
        elif b["kind"] == "example":
            html_parts.append(render_example(b))
        elif b["kind"] == "note":
            html_parts.append(render_inline(b, hws))
        elif b["kind"] == "judge":
            html_parts.append(render_inline(b, hws))
        else:
            html_parts.append(render_inline(b, hws, lead=False))
        i += 1
    return "\n".join(html_parts)


def card_html(title, page, body_html):
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<style>{CSS}</style>
</head>
<body>
  <div class="sheet">
    <div class="card">
      <header class="header">
        <div class="meta">
          <span>学生实用英汉大词典 · 1999</span>
          <span>词典第 {page} 页</span>
        </div>
        <h1>{esc(title)}</h1>
      </header>
      <div class="body">
        {body_html}
      </div>
    </div>
  </div>
</body>
</html>
"""


def build_one(index, box):
    title = normalize(box["title"].strip())
    content = normalize(box["content"])
    hws = headwords(title)
    lines = join_lines(content, hws)
    units = [classify(ln) for ln in lines]
    units = pair_glosses(units, hws)
    blocks = group_units(units, hws)
    body = render_blocks(blocks, hws)
    name = slug_for(index, title)
    doc = card_html(title, box["dict_page"], body)
    return name, doc, lines


def crop_black(src: Path, dest: Path) -> tuple:
    from PIL import Image

    im = Image.open(src).convert("RGB")
    box = im.getbbox()
    if not box:
        im.save(dest, "PNG")
        return im.size
    # Drop the antialiased halo against the black page, keep the sage sheet.
    l, t, r, b = box
    l = min(l + 2, r - 1)
    t = min(t + 2, b - 1)
    r = max(r - 2, l + 1)
    b = max(b - 2, t + 1)
    cropped = im.crop((l, t, r, b))
    dest.parent.mkdir(parents=True, exist_ok=True)
    cropped.save(dest, "PNG")
    clipped = b >= im.size[1] - 3
    return cropped.size, clipped


def shot(html_path: Path, raw_path: Path, worker: int, height: int) -> None:
    raw_path.parent.mkdir(parents=True, exist_ok=True)
    last_error = None
    for attempt in (1, 2):
        profile = WORK / f"profile-{worker}" if attempt == 1 else WORK / f"profile-{worker}-retry"
        try:
            subprocess.run(
                [
                    CHROME,
                    "--headless=new",
                    "--disable-gpu",
                    "--hide-scrollbars",
                    "--force-device-scale-factor=2",
                    f"--window-size=1000,{height}",
                    f"--user-data-dir={profile}",
                    f"--screenshot={raw_path}",
                    html_path.as_uri(),
                ],
                check=True,
                timeout=45,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            return
        except subprocess.TimeoutExpired as exc:
            last_error = exc
            print("timeout", raw_path.name, "attempt", attempt, flush=True)
    raise last_error


def render_jobs(jobs, height=5200, workers=4):
    """jobs: list of (html_path, png_path)."""
    import queue
    from concurrent.futures import ThreadPoolExecutor, as_completed

    slots = queue.Queue()
    for i in range(workers):
        slots.put(i)

    def run(item):
        html_path, png_path = item
        slot = slots.get()
        try:
            raw = RAW_DIR / png_path.name
            shot(html_path, raw, worker=slot, height=height)
            size, clipped = crop_black(raw, png_path)
            return png_path.name, size, clipped
        finally:
            slots.put(slot)

    clipped_names = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futs = [pool.submit(run, item) for item in jobs]
        done = 0
        for fut in as_completed(futs):
            name, size, clipped = fut.result()
            done += 1
            if clipped:
                clipped_names.append(name)
            if done % 25 == 0 or done == len(jobs):
                print(f"rendered {done}/{len(jobs)}", flush=True)
    return clipped_names


def rename_samples():
    mapping = {
        "01-a-little-a-bit.png": "001-a-little-a-bit.png",
        "02-a-most-the-most.png": "002-a-most-the-most.png",
    }
    for src, dst in mapping.items():
        a, b = OUT / src, OUT / dst
        if a.exists() and not b.exists():
            a.rename(b)
            print("renamed", src, "->", dst)


def main():
    import json

    data = json.loads(JSON_PATH.read_text())
    boxes = data["boxes"]
    mode = sys.argv[1] if len(sys.argv) > 1 else "preview"
    if mode == "slugs":
        seen = {}
        for i, b in enumerate(boxes, 1):
            name = slug_for(i, b["title"])
            print(f"{name}\t{b['title']}")
            seen.setdefault(name, []).append(i)
        dups = {k: v for k, v in seen.items() if len(v) > 1}
        print("DUPS", dups)
        return

    if mode == "text":
        idxs = [int(x) for x in sys.argv[2:]]
        for i in idxs:
            b = boxes[i - 1]
            _, _, lines = build_one(i, b)
            print("=" * 60)
            print(i, b["title"])
            for ln in lines:
                print(" |", ln)
        return

    if mode == "fix":
        fix_sources(JSON_PATH, MD_PATH)
        return

    if mode == "preview":
        idxs = [int(x) for x in sys.argv[2:]] or [3, 4, 5, 6, 11, 90, 154, 275]
    elif mode == "all":
        rename_samples()
        idxs = list(range(1, len(boxes) + 1))
    else:
        raise SystemExit("usage: fix|preview|all|text|slugs")

    HTML_DIR.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = []
    for i in idxs:
        name, doc, _ = build_one(i, boxes[i - 1])
        html_path = HTML_DIR / f"{i:03d}.html"
        html_path.write_text(doc, encoding="utf-8")
        jobs.append((html_path, OUT / name))
        print(name)
    clipped = render_jobs(jobs, height=5600, workers=4 if mode == "all" else 2)
    if clipped:
        print("CLIPPED", clipped)


if __name__ == "__main__":
    main()
