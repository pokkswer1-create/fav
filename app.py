"""테마 수급 종목 분석기 UI (실데이터 기본)."""

from __future__ import annotations

import pandas as pd
import plotly.graph_objects as go
import streamlit as st
from plotly.subplots import make_subplots

from analyzer.data import build_stock_snapshot, scan_market
from analyzer.rules import action_comment
from analyzer.screener import pick_stocks
from analyzer.signals import beginner_explain
from analyzer.themes import list_themes

st.set_page_config(page_title="테마 수급 분석기", layout="wide")
st.title("테마 수급 종목 분석기")
st.caption(
    "초보자도 보기 쉽게: 큰손 돈의흐름 · 가격이 아직 안 오른지 · 고점 돌파 · "
    "과거 비슷한 경우의 평균 성적을 보여줍니다. 투자 권유가 아닙니다."
)

with st.sidebar:
    st.header("스캔 설정")
    live_mode = st.toggle("실시간 데이터", value=True, help="끄면 데모 샘플 데이터")
    demo = not live_mode
    auto_refresh = st.toggle("자동 새로고침(60초)", value=False)
    theme = st.selectbox("테마", ["전체", *list_themes()])
    lookback = st.slider("수급 룩백(거래일)", 10, 40, 20)
    pick_n = st.slider("추천 종목 수", 3, 10, 5)
    min_score = st.slider("후보 최소 점수", 0, 100, 20)
    leaders_only = st.checkbox("후보: 테마 대장만", value=False)
    flat_only = st.checkbox("후보: 수급↑·가격정체만", value=False)
    run = st.button("스캔 실행", type="primary")

if auto_refresh:
    st.query_params["refresh"] = "1"
    st.markdown('<meta http-equiv="refresh" content="60">', unsafe_allow_html=True)

need_scan = run or "scan_result" not in st.session_state or st.session_state.get("scan_mode") != (
    "demo" if demo else "live"
)
if need_scan:
    with st.spinner("실시간 데이터 수집/분석 중..."):
        st.session_state.scan_result = scan_market(
            theme=None if theme == "전체" else theme,
            lookback_days=lookback,
            min_score=float(min_score),
            leaders_only=leaders_only,
            flat_only=flat_only,
            demo=demo,
        )
        st.session_state.scan_mode = "demo" if demo else "live"

result = st.session_state.scan_result
regime = result["regime"]
regime_name = regime.get("regime", "중립")

picks = pick_stocks(result.get("all") or [], top_n=pick_n)
refreshed = []
for row in picks:
    item = dict(row)
    comment = action_comment(item, regime_name)
    item["action"] = comment["action"]
    item["reason"] = comment["reason"]
    explain = beginner_explain(item, regime_name)
    item["beginner_summary"] = explain["summary"]
    item["beginner_backtest"] = explain["backtest"]
    item["beginner_guide"] = explain["guide"]
    item["beginner_full"] = explain["full"]
    refreshed.append(item)
picks = refreshed
result["picks"] = picks
if picks and "selected_ticker" not in st.session_state:
    st.session_state.selected_ticker = picks[0]["ticker"]

c1, c2, c3, c4, c5 = st.columns(5)
c1.metric("시장 상태", regime_name)
c2.metric("코스피", f"{regime.get('kospi_price', 0):,.2f}")
c3.metric("코스피 등락(%)", regime.get("kospi_change_pct", 0))
c4.metric("오늘 추천", len(picks))
c5.metric("모드", result.get("mode", "-"))
st.caption(
    f"스캔시각 {result.get('scanned_at', '-')} · 데이터 {regime.get('data_source', '-')} · "
    f"장상태 {regime.get('market_status', '-')}"
)

with st.expander("초보자를 위한 읽는 법", expanded=True):
    st.markdown(
        """
1. **액션**만 먼저 보세요
   - `매수관심`: 조건+돌파 → 관심 매수 후보
   - `분할관심`: 상위+돌파근접 → 소액으로 나눠 사기만 검토
   - `돌파대기`: 조건은 좋은데 고점 돌파 전 → **그 순간을 노리세요**
   - `관심목록` / `회피`: 우선순위 낮음
2. **왜?** 는 쉬운 말로 적혀 있어요.
3. **과거 성적**은 참고용이에요. 미래 보장이 아닙니다.
4. 전부 ‘지켜보기’가 아닙니다. 상위 종목은 **돌파대기/분할관심**으로 다음 행동이 나와요.
"""
    )

st.subheader("오늘 데이터 기반 골라준 종목")
st.caption(
    "큰손 유입 · 가격 정체 · 테마 대장 · 연속 수급 · 돌파 · 과거 기대값을 합쳐 "
    f"Top {len(picks) or pick_n}을 고릅니다."
)
if not picks:
    st.warning("스캔된 종목이 없어 추천을 만들 수 없습니다.")
else:
    cols = st.columns(min(len(picks), 5))
    for i, p in enumerate(picks[:5]):
        with cols[i % len(cols)]:
            exp = p.get("expectancy") or {}
            st.markdown(f"### {p.get('pick_label', f'{i+1}위')} · {p['name']}")
            st.metric(
                "현재가",
                f"{p.get('latest_close', 0):,.0f}",
                f"{p.get('realtime_change_pct', 0):+.2f}%",
            )
            st.write(f"**{p.get('action', '-')}** — {p.get('reason', '')}")
            st.caption(p.get("beginner_summary") or p.get("pick_why") or "")
            st.write(
                f"돌파: {'O' if p.get('is_breakout') else 'X'} · "
                f"기대수익 {float(exp.get('expectancy_pct', 0)):+.1f}% "
                f"(승률 {exp.get('win_rate_pct', 0)}% / 표본 {exp.get('sample_size', 0)})"
            )
            if st.button("이 종목 상세", key=f"pick_{p['ticker']}"):
                st.session_state.selected_ticker = p["ticker"]

    pick_rows = []
    for p in picks:
        exp = p.get("expectancy") or {}
        pick_rows.append(
            {
                "순위": p.get("pick_rank", 0),
                "종목": p["name"],
                "테마": p["theme"],
                "액션": p.get("action", ""),
                "초보 한줄": p.get("beginner_summary", ""),
                "돌파": "O" if p.get("is_breakout") else "",
                "기대수익%": exp.get("expectancy_pct", 0),
                "승률%": exp.get("win_rate_pct", 0),
                "표본": exp.get("sample_size", 0),
                "추천점수": p.get("pick_score", 0),
                "현재가": p.get("latest_close", 0),
                "큰손(억)": round(float(p.get("smart_money_net", 0)) / 1e8, 1),
                "기간%": p.get("price_change_pct", 0),
                "고른이유": p.get("pick_why", ""),
            }
        )
    st.dataframe(pd.DataFrame(pick_rows), use_container_width=True, hide_index=True)

st.subheader("돈이 몰리는 테마")
theme_df = pd.DataFrame(result["theme_top"])
if not theme_df.empty:
    theme_df["스마트머니(억)"] = (theme_df["smart_money_net"] / 1e8).round(1)
    st.dataframe(theme_df[["theme", "스마트머니(억)"]], use_container_width=True, hide_index=True)
else:
    st.info("테마 집계 없음")

st.subheader("종목 상세 (3개월 / 6개월)")
options = [f"{r['name']} ({r['ticker']})" for r in result["all"]]
if not options:
    st.stop()

default_ticker = st.session_state.get("selected_ticker")
if not default_ticker and picks:
    default_ticker = picks[0]["ticker"]
default_label = None
for r in result["all"]:
    if r["ticker"] == default_ticker:
        default_label = f"{r['name']} ({r['ticker']})"
        break
index = options.index(default_label) if default_label in options else 0
choice = st.selectbox("종목 선택", options, index=index)
base = next(r for r in result["all"] if f"{r['name']} ({r['ticker']})" == choice)
st.session_state.selected_ticker = base["ticker"]

selected = build_stock_snapshot(
    base["ticker"],
    base["name"],
    base["theme"],
    lookback_days=lookback,
    demo=demo,
    regime=regime_name,
)
for r in picks + result["candidates"] + result["all"]:
    if r["ticker"] == selected["ticker"] and r.get("is_theme_leader"):
        selected["is_theme_leader"] = True
        break
selected.update(action_comment(selected, regime_name))
explain = beginner_explain(selected, regime_name)
selected.update(
    {
        "beginner_summary": explain["summary"],
        "beginner_backtest": explain["backtest"],
        "beginner_guide": explain["guide"],
        "beginner_full": explain["full"],
    }
)

st.info(selected.get("beginner_full") or selected.get("beginner_summary") or "")

period = st.radio("분석 기간", ["3개월", "6개월"], horizontal=True)
analysis = selected["analysis_3m"] if period == "3개월" else selected["analysis_6m"]
exp = selected.get("expectancy") or {}
prob = selected.get("probability") or {}
risk = selected.get("risk") or {}

m1, m2, m3, m4, m5 = st.columns(5)
m1.metric("현재가", f"{selected.get('latest_close', 0):,.0f}", f"{selected.get('realtime_change_pct', 0):+.2f}%")
m2.metric("기간 수익률%", analysis.get("price_change_pct", 0))
m3.metric("큰손(억)", round(float(analysis.get("smart_money_net", 0)) / 1e8, 1))
m4.metric("돌파", "예" if selected.get("is_breakout") else "아니오")
m5.metric("기대수익%", exp.get("expectancy_pct", 0))

st.markdown(
    f"**액션:** {selected.get('action')} — {selected.get('reason')}  \n"
    f"**과거 유사셋업:** 승률 {exp.get('win_rate_pct', 0)}% · "
    f"평균익 {exp.get('avg_win_pct', 0)}% · 평균손 {exp.get('avg_loss_pct', 0)}% · "
    f"표본 {exp.get('sample_size', 0)}  \n"
    f"**+5% 확률(참고):** {prob.get('prob_target_pct', 0)}% (표본 {prob.get('sample_size', 0)})  \n"
    f"**리스크 가이드:** 손절 {risk.get('stop_price')} / 1차익절 {risk.get('take1_price')} / "
    f"2차익절 {risk.get('take2_price')} / 시간손절 {risk.get('time_stop_days')}일 / "
    f"계좌리스크 {risk.get('account_risk_pct')}%"
)

if analysis.get("dates"):
    fig = make_subplots(rows=2, cols=1, shared_xaxes=True, row_heights=[0.6, 0.4], vertical_spacing=0.08)
    fig.add_trace(go.Scatter(x=analysis["dates"], y=analysis["closes"], name="종가"), row=1, col=1)
    fig.add_trace(go.Scatter(x=analysis["dates"], y=analysis["cum_smart"], name="누적 큰손"), row=2, col=1)
    fig.add_trace(
        go.Scatter(x=analysis["dates"], y=analysis["cum_foreign"], name="누적 외인", line=dict(dash="dot")),
        row=2,
        col=1,
    )
    fig.add_trace(
        go.Scatter(
            x=analysis["dates"],
            y=analysis["cum_institution"],
            name="누적 기관",
            line=dict(dash="dash"),
        ),
        row=2,
        col=1,
    )
    fig.update_layout(height=560, margin=dict(l=10, r=10, t=30, b=10), legend=dict(orientation="h"))
    st.plotly_chart(fig, use_container_width=True)

if result["errors"]:
    with st.expander(f"데이터 오류 ({len(result['errors'])})"):
        st.dataframe(pd.DataFrame(result["errors"]), use_container_width=True)
