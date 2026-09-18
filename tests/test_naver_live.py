from analyzer.naver_live import _to_float, fetch_investor_trend


def test_to_float_parses_kr_number_formats():
    assert _to_float("1,234") == 1234.0
    assert _to_float("+3,531,147") == 3531147.0
    assert _to_float("-2,208,594") == -2208594.0
    assert _to_float(None) == 0.0


def test_live_investor_trend_has_required_columns():
    df = fetch_investor_trend("005930", days=30)
    assert not df.empty
    for col in ["외국인합계", "기관합계", "개인"]:
        assert col in df.columns
    assert len(df) >= 10
