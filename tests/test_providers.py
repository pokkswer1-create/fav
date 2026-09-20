"""Free-API provider layer: KIS / DART / KRX / aikstockdata fallbacks."""

from __future__ import annotations

import json
from unittest.mock import patch

import pandas as pd
import pytest

from analyzer.providers import config
from analyzer.providers.aikstock import (
    fetch_daily_history,
    fetch_recent_disclosures_for_tickers,
    parse_history_payload,
    parse_disclosure_items,
)
from analyzer.providers.dart import parse_dart_list_payload, normalize_disclosure
from analyzer.providers.kis import parse_daily_price_payload, parse_price_quote
from analyzer.providers.krx import parse_krx_price_payload
from analyzer.providers.market import (
    fetch_daily_prices_cascaded,
    fetch_quotes_cascaded,
    provider_status,
)
from analyzer.signals import beginner_explain


def test_config_reads_env(monkeypatch):
    monkeypatch.setenv("KIS_APP_KEY", "k")
    monkeypatch.setenv("KIS_APP_SECRET", "s")
    monkeypatch.setenv("DART_API_KEY", "d" * 40)
    monkeypatch.setenv("KRX_SERVICE_KEY", "krx")
    monkeypatch.delenv("KIS_USE_MOCK", raising=False)
    assert config.kis_configured() is True
    assert config.dart_configured() is True
    assert config.krx_configured() is True
    assert config.kis_base_url().startswith("https://openapi")


def test_config_mock_base_url(monkeypatch):
    monkeypatch.setenv("KIS_APP_KEY", "k")
    monkeypatch.setenv("KIS_APP_SECRET", "s")
    monkeypatch.setenv("KIS_USE_MOCK", "1")
    assert "openapivts" in config.kis_base_url()


def test_parse_aikstock_history():
    payload = {
        "rows": [
            ["20260102", 10000, 1000],
            ["20260103", 10100, 1100],
        ]
    }
    df = parse_history_payload(payload)
    assert len(df) == 2
    assert float(df["종가"].iloc[-1]) == 10100
    assert "거래량" in df.columns


def test_parse_disclosure_items_filters_codes():
    payload = {
        "items": [
            {
                "code": "005930",
                "title": "사업보고서",
                "rcept_dt": "20260901",
                "url": "https://dart.fss.or.kr/x",
                "label": "실적",
                "fact": "매출 증가",
            },
            {
                "code": "000660",
                "title": "공급계약",
                "rcept_dt": "20260902",
                "url": "https://dart.fss.or.kr/y",
                "label": "계약",
                "fact": "대형 수주",
            },
        ]
    }
    by_code = parse_disclosure_items(payload, {"005930"})
    assert "005930" in by_code
    assert "000660" not in by_code
    assert by_code["005930"][0]["title"] == "사업보고서"


def test_fetch_recent_disclosures_uses_http(monkeypatch):
    payload = {
        "items": [
            {
                "code": "272210",
                "title": "공급계약",
                "rcept_dt": "20260911",
                "url": "https://dart.fss.or.kr/a",
                "label": "계약",
                "fact": "계약 체결",
            }
        ]
    }

    def fake_get(url, timeout=20):
        assert "disclosures_top100" in url
        return payload

    with patch("analyzer.providers.aikstock.get_json", side_effect=fake_get):
        out = fetch_recent_disclosures_for_tickers(["272210", "005930"])
    assert out["272210"][0]["label"] == "계약"
    assert out.get("005930", []) == []


def test_fetch_daily_history_maps_rows():
    payload = {"rows": [["20260917", 252500, 11827514]]}
    with patch("analyzer.providers.aikstock.get_json", return_value=payload):
        df = fetch_daily_history("005930", days=10)
    assert not df.empty
    assert float(df["종가"].iloc[-1]) == 252500


def test_kis_parse_quote_and_daily():
    quote = parse_price_quote(
        {
            "rt_cd": "0",
            "output": {
                "stck_prpr": "70000",
                "prdy_vrss": "1000",
                "prdy_ctrt": "1.45",
                "acml_vol": "12345",
                "hts_kor_isnm": "삼성전자",
            },
        }
    )
    assert quote["price"] == 70000
    assert quote["change_pct"] == 1.45

    daily = parse_daily_price_payload(
        {
            "rt_cd": "0",
            "output": [
                {
                    "stck_bsop_date": "20260917",
                    "stck_oprc": "69000",
                    "stck_hgpr": "71000",
                    "stck_lwpr": "68500",
                    "stck_clpr": "70000",
                    "acml_vol": "1000",
                }
            ],
        }
    )
    assert len(daily) == 1
    assert float(daily["종가"].iloc[0]) == 70000


def test_dart_parse_list():
    payload = {
        "status": "000",
        "list": [
            {
                "corp_name": "삼성전자",
                "stock_code": "005930",
                "report_nm": "분기보고서",
                "rcept_dt": "20260910",
                "rcept_no": "20260910000001",
            }
        ],
    }
    rows = parse_dart_list_payload(payload, stock_code="005930")
    assert len(rows) == 1
    norm = normalize_disclosure(rows[0])
    assert "분기보고서" in norm["title"]
    assert "dart.fss.or.kr" in norm["url"]


def test_krx_parse_price():
    payload = {
        "response": {
            "body": {
                "items": {
                    "item": [
                        {
                            "basDt": "20260917",
                            "srtnCd": "005930",
                            "mkp": "69000",
                            "hipr": "71000",
                            "lopr": "68500",
                            "clpr": "70000",
                            "trqu": "1000",
                        }
                    ]
                }
            }
        }
    }
    df = parse_krx_price_payload(payload)
    assert float(df["종가"].iloc[0]) == 70000


def test_daily_prices_cascaded_prefers_naver_then_aikstock():
    empty = pd.DataFrame()
    aik = pd.DataFrame(
        {
            "시가": [100],
            "고가": [110],
            "저가": [90],
            "종가": [105],
            "거래량": [1],
            "거래대금": [105],
        },
        index=pd.to_datetime(["2026-09-17"]),
    )
    with patch("analyzer.providers.market.naver_fetch_daily_prices", return_value=empty), patch(
        "analyzer.providers.market.kis_fetch_daily_prices", return_value=empty
    ), patch(
        "analyzer.providers.market.aik_fetch_daily_history", return_value=aik
    ), patch(
        "analyzer.providers.market.krx_fetch_daily_prices", return_value=empty
    ):
        df, source = fetch_daily_prices_cascaded("005930", days=5)
    assert source == "aikstock"
    assert float(df["종가"].iloc[-1]) == 105


def test_quotes_cascaded_falls_back_to_kis():
    kis_q = {"005930": {"price": 70000.0, "change_pct": 1.0, "volume": 1.0, "name": "삼성전자"}}
    with patch("analyzer.providers.market.naver_fetch_realtime_quotes", return_value={}), patch(
        "analyzer.providers.market.kis_fetch_quotes", return_value=kis_q
    ), patch("analyzer.providers.config.kis_configured", return_value=True):
        out, source = fetch_quotes_cascaded(["005930"])
    assert source == "kis"
    assert out["005930"]["price"] == 70000


def test_provider_status_shape(monkeypatch):
    monkeypatch.delenv("KIS_APP_KEY", raising=False)
    monkeypatch.delenv("DART_API_KEY", raising=False)
    monkeypatch.delenv("KRX_SERVICE_KEY", raising=False)
    st = provider_status()
    assert st["naver"] is True
    assert st["aikstock"] is True
    assert st["kis"] is False
    assert "dart" in st


def test_beginner_explain_includes_disclosure():
    row = {
        "name": "한화시스템",
        "theme": "방산/우주",
        "smart_money_net": 1e9,
        "price_change_pct": 2.0,
        "action": "돌파대기",
        "is_breakout": False,
        "is_near_breakout": False,
        "is_flat_setup": True,
        "expectancy": {"sample_size": 0},
        "risk": {"stop_pct": 6, "take1_pct": 8, "stop_price": 100, "take1_price": 110},
        "disclosures": [
            {
                "title": "단일판매ㆍ공급계약체결",
                "label": "계약",
                "fact": "계약금액 3.66조원",
                "date": "20260911",
            }
        ],
    }
    exp = beginner_explain(row, "중립")
    assert "공시" in exp["full"] or "계약" in exp["full"]
    assert "3.66" in exp["full"] or "공급" in exp["full"]
