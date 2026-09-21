from analyzer.universe import parse_quotes_universe, select_scan_universe


def test_parse_quotes_universe_from_items():
    payload = {
        "items": [
            {
                "종목코드": "005930",
                "종목명": "삼성전자",
                "mrktCtg": "KOSPI",
                "trPrc": 1e12,
                "mrktTotAmt": 4e14,
                "clpr": 70000,
            },
            {
                "종목코드": "035420",
                "종목명": "NAVER",
                "mrktCtg": "KOSPI",
                "trPrc": 5e10,
                "mrktTotAmt": 3e13,
                "clpr": 200000,
            },
            ["000660", "SK하이닉스", "KOSPI"],
        ]
    }
    rows = parse_quotes_universe(payload)
    by = {r["ticker"]: r for r in rows}
    assert "005930" in by
    assert by["005930"]["name"] == "삼성전자"
    assert by["005930"]["theme"] == "KOSPI"
    assert by["005930"]["trade_value"] == 1e12
    assert "000660" in by


def test_select_scan_universe_orders_by_trade_value():
    rows = [
        {"ticker": "1", "name": "a", "theme": "KOSPI", "trade_value": 1e9, "market_cap": 1},
        {"ticker": "2", "name": "b", "theme": "KOSDAQ", "trade_value": 9e9, "market_cap": 1},
        {"ticker": "3", "name": "c", "theme": "KOSPI", "trade_value": 1e8, "market_cap": 1e12},
    ]
    selected = select_scan_universe(rows, limit=2, min_trade_value=1e9)
    assert [r["ticker"] for r in selected] == ["2", "1"]
