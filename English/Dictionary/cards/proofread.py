"""校对辨析框正文：繁体转简体，并修正已核对过的扫描错字。

生成卡片时会再跑一遍 normalize()，所以这里的替换都写成改完就不再命中。
"""

from __future__ import annotations

import json
from pathlib import Path

import zhconv

# 先按原文（含繁体、错字）替换，再做简体转换。长的放前面。
REPLACEMENTS = [
    (
        "（for 某人以某种知识、\n"
        "A•+be Famous 技能或特征出名\n"
        "ias 某人以某种身分出名\n"
        "Einstein was famous\n"
        "」 for his Theory of Relativity.\n"
        "爱因斯坦以他的相对论而闻名。\n"
        "as a great scientist.\n"
        "（爱因斯坦以一位伟大的科学家著称。\n"
        "（for 以某种特产而出\n"
        "地方+be famous as 以什么样的产地\n"
        "或地方而出名\n"
        "The area is famous\n"
        "（for its green tea\n"
        "这个地区以绿茶而出名\n"
        "1as a green tea producing place.\n"
        "（这个地区产绿茶的地区。",
        "人 + be famous for 以某种知识、技能或特征出名\n"
        "人 + be famous as 以某种身份出名\n"
        "Einstein was famous for his Theory of Relativity.\n"
        "爱因斯坦以他的相对论而闻名。\n"
        "Einstein was famous as a great scientist.\n"
        "爱因斯坦以一位伟大的科学家著称。\n"
        "地方 + be famous for 以某种特产而出名\n"
        "地方 + be famous as 以什么样的产地或地方而出名\n"
        "The area is famous for its green tea.\n"
        "这个地区以绿茶而出名。\n"
        "The area is famous as a green tea producing place.\n"
        "这个地区作为绿茶产地而出名。",
    ),
    (
        "問：，意思上：放弃，让步\n"
        "②形式上：作不及物动词使用他终于\n"
        "投降了。\n"
        "｛ at lasts\n"
        "He gave\n"
        "昇：D意思上：give up~放弃\n"
        "give in-屈服\n"
        "②形式上：give up 可作及物动词，后\n"
        "接名词或动名词而 give in 只作不及\n"
        "物动词.后不接宾语她将放弃这次旅\n"
        "行。",
        "give in\n"
        "①意思上：放弃，让步\n"
        "②形式上：作不及物动词\n"
        "他终于投降了。\n"
        "At last he gave in.\n"
        "give up\n"
        "①意思上：放弃\n"
        "give in 意思上：屈服\n"
        "②形式上：give up 可作及物动词，后接名词或动名词；give in 只作不及物动词，后不接宾语\n"
        "她将放弃这次旅行。",
    ),
    (
        "相同点：表示“想”，“希望”；宾语可为\n不可是v.-ing：",
        "相同点：表示“想”，“希望”；宾语可以是 to-v.，不可以是 v.-ing：",
    ),
    ("Il be~\nsee over 是“见下页”", "see below 是“见下文”\nsee over 是“见下页”"),
    ("事水、自由、真理、权利等面斗争（战\n", "事业、自由、真理、权利等方面斗争：\n"),
    ("并润战\n斗•但这次他们却和意大利打起米了", "并肩战斗，但这次他们却和意大利打起来了"),
    ("情況下人\n胆无畏", "情况下大胆无畏"),
    ("常引导\n寫行\n虚拟语气", "常引导虚拟语气"),
    ("unusual\n丿而值得注意", "unusual 不寻常而值得注意"),
    ("情况 完\n成工作", "情况下完成工作"),
    ("没法完\n成了工作", "设法完成了工作"),
    ("centre\nIn.\n则只用于空间观念", "centre 则只用于空间观念"),
    ("所付的—-\n切代价", "所付的一切代价"),
    ("而且永；\n远不变", "而且永远不变"),
    ("of+ U\nlarge number of+FCi〉", "of+［U］\na large number of+［C］"),
    ("可限\nfor+名词", "可跟 for+名词"),
    ("灭”灯，火签慈！其后须跟名词作宾", "灭灯、火等，其后须跟名词作宾语"),
    ("恶心的，眼；\n吐的", "恶心的，呕吐的"),
    ("多病的.！\n不健康的", "多病的，不健康的"),
    ("𨰫谷机把米和镰分开", "碾谷机把米和糠分开"),
    ("The medical bills diminished my sav-\nsavings.", "The medical bills diminished my savings."),
    ("对方—-岡做某事", "对方一同做某事"),
    ("解出身体的—-部分", "露出身体的一部分"),
    ("“—-件衣服”", "“一件衣服”"),
    ("Dwish +錠+10-v.", "①wish + sb. + to-v."),
    ("照到身愛危险", "感到身受危险"),
    ("不是駛读", "不是默读"),
    ("用来读預期", "用来谈预期"),
    ("事情為令人不\n快", "多为令人不快"),
    ("事情为令人不\n快", "多为令人不快"),
    ("这家商店出妇女服装", "这家商店出售妇女服装"),
    ("就教敏、份量", "就数量、分量"),
    ("与large一-样", "与 large 一样"),
    ("“E大、伟大、重要”", "“长大、伟大、重要”"),
    ("旁边「比near 较近）", "旁边（比 near 较近）"),
    ("（并肩）战汁", "（并肩）战斗"),
    ("visible看见大海", "可以看见大海"),
    ("可见看见大海", "可以看见大海"),
    ("书镇也称作", "小镇也称作"),
    ("匀速地球", "匀速地"),
    ("偏煎质量", "偏重质量"),
    ("事情可宴的", "可喜的"),
    ("很宽炳", "很宽阔"),
    ("覆遵在上", "覆盖在上"),
    ("日头用语", "口头用语"),
    ("尚（米）", "尚（未）"),
    ("茶还改凉", "茶还没凉"),
    ("喧叫", "喧闹"),
    ("水刘便利", "水利便利"),
    ("The meadow: is", "The meadow is"),
    ("are gazing in", "are grazing in"),
    ("差不求", "差不多"),
    ("习住，停留", "暂住，停留"),
    ("習住，停留", "暂住，停留"),
    ("丙：我…定想办法来", "丙：我一定想办法来"),
    ("He manage to", "He managed to"),
    ("explosing", "explosion"),
    ("有用的——般事物", "有用的一般事物"),
    ("4在某些习语中", "▲在某些习语中"),
    ("不-一定", "不一定"),
    ("一-棵", "一棵"),
    ("一-样", "一样"),
    ("［U］｝", "［U］"),
    ("［C］/", "［C］"),
    ("②2）hope", "②hope"),
    ("（3 hope", "③hope"),
    ("②2sick", "②sick"),
    ("shall we！", "shall we?"),
    ("以某种知识、技能或特征出名\n", "以某种知识、技能或特征出名：\n"),
    ("以某种身份出名\n", "以某种身份出名：\n"),
    ("以某种特产而出名\n", "以某种特产而出名：\n"),
    ("以什么样的产地或地方而出名\n", "以什么样的产地或地方而出名：\n"),
    ("②形式上：作不及物动词\n", "②形式上：作不及物动词。\n"),
    ("后不接宾语\n她将放弃这次旅行。", "后不接宾语。\n她将放弃这次旅行。"),
    ("行动：|", "行动："),
    ("\n，action 指", "\naction 指"),
    ("！告诉孩子把火熄灭。", "告诉孩子把火熄灭。"),
    ("坏的.恶劣的“", "坏的、恶劣的"),
    ("（Aloud除作副词外还", "（aloud 除作副词外还"),
]


def normalize(text: str) -> str:
    for old, new in REPLACEMENTS:
        text = text.replace(old, new)
    return zhconv.convert(text, "zh-cn")


def unused_replacements(text: str) -> list[str]:
    """Return snippets that never occur, so a typo in the table is visible."""
    missing = []
    for old, _new in REPLACEMENTS:
        if old not in text:
            missing.append(old.split("\n", 1)[0][:40])
    return missing


def fix_sources(json_path: Path, md_path: Path) -> None:
    raw_json = json_path.read_text(encoding="utf-8")
    raw_md = md_path.read_text(encoding="utf-8")
    combined = raw_json + "\n" + raw_md
    missed = unused_replacements(combined)
    if missed:
        print("WARNING replacements not found:")
        for item in missed:
            print("  -", item)

    data = json.loads(raw_json)
    for box in data["boxes"]:
        box["title"] = normalize(box["title"])
        box["content"] = normalize(box["content"])
    json_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8",
    )
    md_path.write_text(normalize(raw_md), encoding="utf-8")
    print("updated", json_path.name)
    print("updated", md_path.name)
