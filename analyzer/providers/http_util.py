from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

DEFAULT_UA = "theme-flow-analyzer/1.0 (+https://github.com/pokkswer1-create/fav)"


def get_json(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: int = 20,
    method: str = "GET",
    body: bytes | None = None,
) -> Any:
    hdrs = {"User-Agent": DEFAULT_UA, "Accept": "application/json"}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, data=body, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as exc:
        raw = exc.read() if exc.fp else b""
        raise RuntimeError(f"HTTP {exc.code} for {url}: {raw[:200]!r}") from exc
    text = raw.decode("utf-8", "ignore")
    if not text.strip():
        return {}
    return json.loads(text)


def url_with_query(base: str, params: dict[str, str]) -> str:
    return f"{base}?{urllib.parse.urlencode(params)}"
