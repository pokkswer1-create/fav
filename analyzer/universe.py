"""전 종목 유니버스 로더 (aikstockdata quotes / search index)."""

from __future__ import annotations

import time
from typing import Any

from analyzer.providers.http_util import get_json

_CACHE: dict[str, Any] = {"ts": 0.0, "rows": []}
_CACHE_TTL = 6 * 3600


def _normalize_code(code: Any) -> str:
    return str(code or "").zfill(6)


def parse_quotes_universe(payload: dict[str, Any]) -> list[dict[str, Any]]:
    items = payload.get("items") or payload.get("rows") or []
    out: list[dict[str, Any]] = []
    for row in items:
        if isinstance(row, (list, tuple)) and len(row) >= 2:
            code, name = row[0], row[1]
            market = str(row[2] if len(row) > 2 else "KOSPI")
            out.append(
                {
                    "ticker": _normalize_code(code),
                    "name": str(name),
                    "theme": market,
                    "market": market,
                    "trade_value": 0.0,
                    "market_cap": 0.0,
                    "close": 0.0,
                }
            )
            continue
        if not isinstance(row, dict):
            continue
        code = row.get("종목코드") or row.get("code") or row.get("ticker")
        name = row.get("종목명") or row.get("name") or row.get("name_ko") or ""
        market = str(row.get("mrktCtg") or row.get("market") or "전체")
        out.append(
            {
                "ticker": _normalize_code(code),
                "name": str(name),
                "theme": market,
                "market": market,
                "trade_value": float(row.get("trPrc") or row.get("trade_value") or 0),
                "market_cap": float(row.get("mrktTotAmt") or row.get("market_cap") or 0),
                "close": float(row.get("clpr") or row.get("close") or 0),
            }
        )
    # de-dupe by ticker keeping higher trade_value
    best: dict[str, dict[str, Any]] = {}
    for row in out:
        t = row["ticker"]
        if len(t) != 6 or not t.isdigit():
            continue
        prev = best.get(t)
        if not prev or float(row.get("trade_value") or 0) >= float(prev.get("trade_value") or 0):
            best[t] = row
    return list(best.values())


def load_full_universe(force: bool = False) -> list[dict[str, Any]]:
    now = time.time()
    if not force and _CACHE["rows"] and now - float(_CACHE["ts"]) < _CACHE_TTL:
        return list(_CACHE["rows"])

    rows: list[dict[str, Any]] = []
    try:
        payload = get_json("https://aikstockdata.com/data/public/quotes.json", timeout=40)
        if isinstance(payload, dict):
            rows = parse_quotes_universe(payload)
    except Exception:  # noqa: BLE001
        rows = []

    if not rows:
        try:
            payload = get_json(
                "https://aikstockdata.com/data/public/search_index_rows.json", timeout=40
            )
            if isinstance(payload, dict):
                rows = parse_quotes_universe(payload)
        except Exception:  # noqa: BLE001
            rows = []

    _CACHE["rows"] = rows
    _CACHE["ts"] = now
    return list(rows)


def select_scan_universe(
    rows: list[dict[str, Any]],
    *,
    limit: int = 150,
    min_trade_value: float = 1e9,
) -> list[dict[str, Any]]:
    """Deep-scan 대상: 거래대금 상위 + 최소 유동성."""
    liquid = [
        r
        for r in rows
        if float(r.get("trade_value") or 0) >= min_trade_value
        or float(r.get("market_cap") or 0) >= 5e11
    ]
    if not liquid:
        liquid = list(rows)
    liquid.sort(
        key=lambda r: (
            float(r.get("trade_value") or 0),
            float(r.get("market_cap") or 0),
        ),
        reverse=True,
    )
    return liquid[: max(1, int(limit))]
