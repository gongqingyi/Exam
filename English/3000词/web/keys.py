"""Load DeepSeek (OpenAI-compatible) credentials from Exam/config/key.yaml."""

from __future__ import annotations

from pathlib import Path
from typing import Dict

import yaml

# web/ -> 3000词 -> English -> Exam/config/key.yaml
KEY_PATH = Path(__file__).resolve().parents[3] / "config" / "key.yaml"


def load_key() -> Dict[str, str]:
    data = yaml.safe_load(KEY_PATH.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not data.get("api_key"):
        raise RuntimeError("missing api_key in {0}".format(KEY_PATH))
    return {
        "api_key": str(data["api_key"]),
        "api_base": str(data.get("api_base") or "https://api.deepseek.com").rstrip("/"),
        "model": str(data.get("model") or "deepseek-chat"),
    }
