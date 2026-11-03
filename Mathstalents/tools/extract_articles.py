#!/usr/bin/env python3
"""Extract captured WeChat article data and download full-resolution paper images."""

from __future__ import annotations

import json
import re
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urldefrag


ROOT = Path(__file__).resolve().parents[1]
CAPTURES = {
    "paper5": Path(
        "/Users/gongqingyi/.cursor/browser-logs/"
        "cdp-response-Runtime.evaluate-2026-09-23T04-36-36-372Z.json"
    ),
    "paper4": Path(
        "/Users/gongqingyi/.cursor/browser-logs/"
        "cdp-response-Runtime.evaluate-2026-09-23T04-36-58-326Z.json"
    ),
    "paper3": Path(
        "/Users/gongqingyi/.cursor/browser-logs/"
        "cdp-response-Runtime.evaluate-2026-09-23T04-37-08-523Z.json"
    ),
}


class ImageTagParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.images: list[dict[str, str]] = []

    def handle_starttag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        if tag == "img":
            self.images.append({key: value or "" for key, value in attrs})


def full_resolution(url: str) -> str:
    url = urldefrag(url)[0].replace("&amp;", "&")
    return re.sub(r"/640(?=\?)", "/0", url)


def download(url: str, destination: Path) -> None:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 Chrome/140 Safari/537.36"
            ),
            "Referer": "https://mp.weixin.qq.com/",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        destination.write_bytes(response.read())


def main() -> None:
    for paper, capture_path in CAPTURES.items():
        payload = json.loads(capture_path.read_text(encoding="utf-8"))
        article = payload["result"]["value"]

        source_dir = ROOT / "source" / paper
        asset_dir = ROOT / paper / "assets" / "original"
        source_dir.mkdir(parents=True, exist_ok=True)
        asset_dir.mkdir(parents=True, exist_ok=True)

        (source_dir / "article.html").write_text(article["html"], encoding="utf-8")
        (source_dir / "article.txt").write_text(article["text"], encoding="utf-8")
        (source_dir / "capture.json").write_text(
            json.dumps(article, ensure_ascii=False, indent=2), encoding="utf-8"
        )

        parser = ImageTagParser()
        parser.feed(article["html"])
        pages: list[dict[str, object]] = []
        for image in article["imgs"]:
            tag = parser.images[image["i"]] if image["i"] < len(parser.images) else {}
            raw_url = image.get("dataSrc") or image.get("src") or ""
            image_type = str(image.get("type") or "")
            data_width = int(image.get("dataWidth") or tag.get("data-w") or 0)
            ratio = float(image.get("ratio") or tag.get("data-ratio") or 0)
            if image_type != "png" or data_width < 900 or ratio < 0.5:
                continue

            page_number = len(pages) + 1
            filename = f"page-{page_number:02d}.png"
            url = full_resolution(str(raw_url))
            destination = asset_dir / filename
            if not destination.exists():
                print(f"{paper}: downloading {filename}")
                download(url, destination)

            pages.append(
                {
                    "page": page_number,
                    "filename": filename,
                    "source_index": image["i"],
                    "url": url,
                    "declared_width": data_width,
                    "ratio_height_over_width": ratio,
                }
            )

        (source_dir / "manifest.json").write_text(
            json.dumps(
                {
                    "paper": paper,
                    "title": article["title"],
                    "url": article["url"],
                    "pages": pages,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        print(f"{paper}: {len(pages)} paper images")


if __name__ == "__main__":
    main()
