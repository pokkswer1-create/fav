from analyzer.themes import THEMES, list_themes, stocks_for_theme


def test_theme_universe_expanded():
    themes = list_themes()
    assert len(themes) >= 15
    assert "방산/우주" in themes
    assert "조선/해운" in themes
    assert "엔터/미디어" in themes
    assert "수소/신재생" in themes
    stocks = stocks_for_theme()
    assert len(stocks) >= 80
    for name, rows in THEMES.items():
        assert len(rows) >= 4, name
        for row in rows:
            assert row["ticker"] and row["name"]
