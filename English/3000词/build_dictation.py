#!/usr/bin/env python3
"""Render printable dictation cards from a words JSON file.

Each day becomes two pictures, both filled down the left column first:

  day1_en_cn.png   English given, blank line for Chinese
  day1_cn_en.png   Chinese given, blank line for English

Usage:
  python3 build_dictation.py <words.json> <out-dir> [--days 1,5]

JSON shape:
  {"title": "15天背完初中3500词",
   "days": [{"day": 1, "items": [
     {"type": "sec", "text": "颜色"},
     {"type": "w", "en": "colour", "zh": "颜色"}
   ]}]}

No phonetics are printed. Category bars stay with the words that follow them.
The two columns of a card split the words as evenly as possible. Underlines
in a column share a left and a right edge. Column width and line length follow
the longest prompt so a row does not wrap.
"""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageFont

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
WORK = Path("/tmp/dictation-sheets")

EN_FONT = ImageFont.truetype(
    "/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf", 15
)
ZH_FONT = ImageFont.truetype("/System/Library/Fonts/STHeiti Medium.ttc", 15, index=0)

PAGE_MIN = 794
PAD_X = 26
COL_GAP = 18
ROW_GAP = 8
MIN_LINE = 108
SAFETY = 16  # PIL width is a little narrower than Chrome


def esc(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def prompt_width(text: str, kind: str) -> int:
    font = EN_FONT if kind == "en" else ZH_FONT
    box = font.getbbox(text)
    # 18px index + 5px gap + the prompt itself
    return 18 + 5 + (box[2] - box[0])


def split_columns(items: list) -> tuple[list, list]:
    """First column, then second. Word counts differ by at most one.

    A category bar stays with the next word, so it is not left at the bottom
    of a column by itself.
    """
    words = [it for it in items if it["type"] == "w"]
    left_n = (len(words) + 1) // 2
    cols: list[list] = [[], []]
    seen = 0
    pending: list = []
    for it in items:
        if it["type"] == "sec":
            pending.append(it)
            continue
        col = 0 if seen < left_n else 1
        if pending:
            cols[col].extend(pending)
            pending = []
        cols[col].append(it)
        seen += 1
    if pending:
        cols[1].extend(pending)
    return cols[0], cols[1]


def column_sizes(label_widths: list[int]) -> tuple[int, list[int], list[int]]:
    """Return sheet width, each column's width, and each text-track width."""
    text = [w + SAFETY for w in label_widths]
    lines = [MIN_LINE, MIN_LINE]
    inner = PAGE_MIN - PAD_X * 2
    used = text[0] + lines[0] + COL_GAP + text[1] + lines[1]
    if used < inner:
        extra = inner - used
        lines[0] += extra // 2
        lines[1] += extra - extra // 2
        sheet = PAGE_MIN
    else:
        sheet = used + PAD_X * 2
    cols = [text[i] + ROW_GAP + lines[i] for i in (0, 1)]
    return sheet, cols, text


def css(sheet_w: int) -> str:
    return f"""
@page {{ size: {sheet_w}px auto; margin: 0; }}
* {{ box-sizing: border-box; }}
html, body {{ margin: 0; padding: 0; background: #000; color: #1c1c1c; }}
.sheet {{
  width: {sheet_w}px;
  background: #fff;
  padding: 26px {PAD_X}px 20px;
  font-family: "PingFang SC", "Hiragino Sans GB", "Heiti SC", "Songti SC", sans-serif;
}}
.head {{
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  border-bottom: 2.5px solid #1f4e45;
  padding-bottom: 8px;
  margin-bottom: 10px;
}}
h1 {{
  margin: 0;
  font-size: 24px;
  letter-spacing: 0.04em;
  color: #1f4e45;
  font-weight: 700;
}}
.meta {{ font-size: 13px; color: #5c675f; }}
.cols {{ display: flex; gap: {COL_GAP}px; align-items: flex-start; }}
.col {{ flex: 0 0 auto; }}
.sec {{
  margin: 8px 0 2px;
  padding: 3px 8px;
  background: #e7f0ea;
  color: #1f4e45;
  font-family: "PingFang SC", "Heiti SC", "STHeiti", sans-serif;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
}}
.row {{
  display: grid;
  column-gap: {ROW_GAP}px;
  align-items: end;
  min-height: 30px;
  padding-top: 4px;
}}
.lab {{
  display: flex;
  align-items: baseline;
  gap: 5px;
  white-space: nowrap;
  line-height: 1.2;
}}
.n {{
  flex: 0 0 auto;
  width: 18px;
  font-size: 10px;
  color: #8a918c;
  font-variant-numeric: tabular-nums;
  font-family: "Iowan Old Style", Palatino, "Times New Roman", serif;
}}
.en {{
  font-family: "Iowan Old Style", Palatino, "Times New Roman", serif;
  font-weight: 700;
  font-size: 15px;
}}
.zh {{ font-size: 14px; font-weight: 600; }}
.blank {{
  border-bottom: 1.6px solid #222;
  height: 16px;
}}
.foot {{
  margin-top: 10px;
  font-size: 11px;
  color: #7a827c;
  text-align: right;
}}
"""


def column_html(items: list, kind: str, text_w: int, start_no: int) -> tuple[str, int]:
    parts = []
    n = start_no
    field = "en" if kind == "en" else "zh"
    klass = "en" if kind == "en" else "zh"
    for it in items:
        if it["type"] == "sec":
            parts.append(f'<div class="sec">{esc(it["text"])}</div>')
            continue
        n += 1
        parts.append(
            f'<div class="row" style="grid-template-columns:{text_w}px 1fr">'
            '<div class="lab">'
            f'<span class="n">{n:02d}</span>'
            f'<span class="{klass}">{esc(it[field])}</span>'
            "</div><div class=\"blank\"></div></div>"
        )
    return "\n".join(parts), n


def build_html(title: str, day_no: int, items: list, kind: str) -> str:
    left, right = split_columns(items)
    widths = []
    for col in (left, right):
        prompts = [it["en"] if kind == "en" else it["zh"] for it in col if it["type"] == "w"]
        widths.append(max((prompt_width(t, kind) for t in prompts), default=40))
    sheet_w, col_w, text_w = column_sizes(widths)
    left_html, last = column_html(left, kind, text_w[0], 0)
    right_html, _ = column_html(right, kind, text_w[1], last)
    n_words = sum(1 for it in items if it["type"] == "w")
    if kind == "en":
        heading = f"第 {day_no} 天 · 看英文写中文"
        foot = "先写左列，再写右列。横线左右端对齐。"
    else:
        heading = f"第 {day_no} 天 · 看中文写英文"
        foot = "先写左列，再写右列。横线左右端对齐。"
    return f"""<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><style>{css(sheet_w)}</style></head>
<body><div class="sheet">
  <div class="head">
    <h1>{heading}</h1>
    <div class="meta">{esc(title)} · 共 {n_words} 词</div>
  </div>
  <div class="cols">
    <div class="col" style="width:{col_w[0]}px">{left_html}</div>
    <div class="col" style="width:{col_w[1]}px">{right_html}</div>
  </div>
  <div class="foot">{foot}</div>
</div></body></html>
"""


def shot(html: Path, raw: Path, worker: str) -> None:
    if not Path(CHROME).is_file():
        raise SystemExit(f"Chrome not found: {CHROME}")
    profile = WORK / f"profile-{worker}"
    subprocess.run(
        [
            CHROME,
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--force-device-scale-factor=2",
            "--window-size=1400,8000",
            f"--user-data-dir={profile}",
            f"--screenshot={raw}",
            html.as_uri(),
        ],
        check=True,
        timeout=60,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def crop(raw: Path, dest: Path) -> None:
    im = Image.open(raw).convert("RGB")
    box = im.convert("L").point(lambda p: 255 if p > 12 else 0).getbbox()
    if not box:
        raise SystemExit(f"empty screenshot {raw}")
    if box[3] >= im.size[1] - 4:
        raise SystemExit(f"{raw.name} filled the window; raise window height and rerun")
    im.crop(box).save(dest, "PNG", optimize=True)


def render(data: dict, out_dir: Path, only: set[int] | None) -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)
    title = data.get("title") or ""
    for block in data["days"]:
        day = int(block["day"])
        if only and day not in only:
            continue
        legacy = out_dir / f"day{day}.png"
        if legacy.exists():
            legacy.unlink()
        for kind, suffix in (("en", "en_cn"), ("zh", "cn_en")):
            html = WORK / f"day{day}-{suffix}.html"
            raw = WORK / f"day{day}-{suffix}-raw.png"
            html.write_text(build_html(title, day, block["items"], kind), encoding="utf-8")
            shot(html, raw, f"{day}-{suffix}")
            dest = out_dir / f"day{day}_{suffix}.png"
            crop(raw, dest)
            print(f"{dest.name} {Image.open(dest).size}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Render dictation-card PNGs")
    parser.add_argument("words_json", type=Path)
    parser.add_argument("out_dir", type=Path)
    parser.add_argument("--days", default="", help="Comma-separated day numbers, default all")
    args = parser.parse_args()
    data = json.loads(args.words_json.read_text(encoding="utf-8"))
    only = {int(x) for x in args.days.split(",") if x.strip()} or None
    render(data, args.out_dir, only)


if __name__ == "__main__":
    main()
