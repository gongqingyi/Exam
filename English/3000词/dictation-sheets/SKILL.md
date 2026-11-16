---
name: dictation-sheets
description: >-
  Build printable English–Chinese dictation cards (默写条) from vocabulary
  screenshots such as 15天背完初中3500词. Use when the user asks for 默写、默写条、
  day1_en_cn.png、day1_cn_en.png, or to turn a 3000词 words folder (under a
  category such as 高频常用 / 重点必背 / 拓展补充, batches 1-5d, 6-10d, 11-15d)
  into printable PNG cards, including when they add missing pages and ask to
  update a day.
---

# 默写条

从单词截图生成可打印默写卡片。词表是 JSON，图片由 `English/3000词/build_dictation.py` 渲染。不印音标。

## 版式

每天两张图，都是两列。词条先排满左列，再排右列，两列词数最多差 1。类别名留在它后面的词前面（浅绿底 `#e7f0ea`，深绿 `#1f4e45` 黑体加粗），不编号。

- `dayN_en_cn.png`：给英文，横线默写中文
- `dayN_cn_en.png`：给中文，横线默写英文

同一列里文字左对齐，横线左右两端对齐。按该列最长的提示调整列宽或横线长度，提示不换行。N 用书上的「第 N 天」，6-10 天就是 `day6_en_cn.png`，不要从 1 重编。各大类各自独立计天（每类都有第 1–15 天）。

## 目录

先按大类分组，大类下批次结构相同：

```
English/3000词/
  1.高频常用/
  2.重点必背/
  3.拓展补充/
    <批次>/                 如 1-5d、6-10d、11-15d
      words/                手机截图，按文件名排序
      默写/words.json
      默写/dayN_en_cn.png
      默写/dayN_cn_en.png
```

脚本和本说明在 `English/3000词/`：

- `build_dictation.py`
- `ocr_screenshot.swift`
- `dictation-sheets/SKILL.md`

```bash
cd "English/3000词"
swiftc -O -o /tmp/ocr_screenshot ocr_screenshot.swift
/tmp/ocr_screenshot "1.高频常用/1-5d/words/IMG_0297.PNG"
python3 build_dictation.py "1.高频常用/1-5d/默写/words.json" "1.高频常用/1-5d/默写"
python3 build_dictation.py "2.重点必背/6-10d/默写/words.json" "2.重点必背/6-10d/默写" --days 6
python3 build_dictation.py "3.拓展补充/11-15d/默写/words.json" "3.拓展补充/11-15d/默写"
```

Chrome：`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`。需要 Pillow。渲染会删掉旧的单张 `dayN.png`。

`words.json` 的 `title` 建议带上大类，例如 `15天背完初中3500词 · 重点必背`，卡片页眉会显示它。

## 从截图到词表

按大类逐个处理；同一大类内再按批次 / 天。

1. 按文件名排序读 `words/`。
2. OCR 每张，用「第 N 天」归天。同一天可以跨多张图。
3. 看图核对英文和中文。OCR 会读错音标；默写条不印音标，中文以看图为准。复数注释放在中文里时去掉音标，例如 `狼（pl. wolves）`。
4. 顺序：文件名顺序。普通双栏页先左栏自上而下、再右栏。思维导图先页顶词条，再导图左侧自上而下、中间、右侧、底部。同一个词画了两次，只留一条。
5. 纯中文分类写成 `{"type":"sec","text":"颜色"}`。词条写成 `{"type":"w","en":"colour","zh":"颜色"}`。短语也是词条。同一英文、不同义项各留一行。
6. 补图：只读新图，追加到对应的天，再渲染那一天或全部。

```json
{
  "title": "15天背完初中3500词 · 高频常用",
  "days": [
    {"day": 1, "items": [
      {"type": "sec", "text": "颜色"},
      {"type": "w", "en": "colour", "zh": "颜色"}
    ]}
  ]
}
```

## 核对

打开 `dayN_en_cn.png` 和 `dayN_cn_en.png`：没有音标；没有提示换行；同一列横线两端对齐；左右列词数差不多；类别条是浅绿底、深绿粗体；最后一行没有被截掉。脚本若报窗口被撑满，把 `build_dictation.py` 里的窗口高度加大再跑。
