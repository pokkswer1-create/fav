"""테마 수급 종목 분석기 UI (실데이터 기본)."""

from __future__ import annotations

import pandas as pd
import plotly.graph_objects as go
import streamlit as st
from plotly.subplots import make_subplots

from analyzer.data import build_stock_snapshot, scan_market
from analyzer.rules import action_comment
from analyzer.themes import list_themes

st.set_page_config(page_title="테마 수급 분석기", layout="wide")
st.title("테마 수급 종목 분석기")
st.caption(
    "네이버 증권 실시간 시세 + 외인/기관/개인 수급으로 "
    "오늘 고를 종목을 데이터 기준으로 뽑아줍니다. 투자 권유가 아닙니다."
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
    st.markdown(
        """
        <meta http-equiv="refresh" content="60">
        """,
        unsafe_allow_html=True,
    )

need_scan = run or "scan_result" not in st.session_state or st.session_state.get("scan_mode") != (
    "demo" if demo else "live"
)
if need_scan:
    with st.spinner("실시간 데이터 수집/분석 중..."):
        result = scan_market(
            theme=None if theme == "전체" else theme,
            lookback_days=lookback,
            min_score=float(min_score),
            leaders_only=leaders_only,
            flat_only=flat_only,
            demo=demo,
        )
        # re-pick with UI count (scan always returns top 5; re-rank from all)
        from analyzer.screener import pick_stocks

        picks = pick_stocks(result["all"], top_n=pick_n)
        refreshed = []
        for row in picks:
            comment = action_comment(row, result["regime"].get("regime", "중립"))
            item = dict(row)
            item["action"] = comment["action"]
            item["reason"] = comment["reason"]
            refreshed.append(item)
        result["picks"] = refreshed
        st.session_state.scan_result = result
        st.session_state.scan_mode = "demo" if demo else "live"
        if refreshed:
            st.session_state.selected_ticker = refreshed[0]["ticker"]

result = st.session_state.scan_result
regime = result["regime"]
picks = result.get("picks") or []

c1, c2, c3, c4, c5 = st.columns(5)
c1.metric("시장 상태", regime.get("regime", "-"))
c2.metric("코스피", f"{regime.get('kospi_price', 0):,.2f}")
c3.metric("코스피 등락(%)", regime.get("kospi_change_pct", 0))
c4.metric("오늘 추천", len(picks))
c5.metric("모드", result.get("mode", "-"))
st.caption(
    f"스캔시각 {result.get('scanned_at', '-')} · 데이터 {regime.get('data_source', '-')} · "
    f"장상태 {regime.get('market_status', '-')}"
)

st.subheader("오늘 데이터 기반 골라준 종목")
st.caption(
    "필터와 무관하게 스마트머니·가격정체·테마대장·연속수급을 합산해 "
    f"상대 우량 Top {len(picks) or pick_n}을 고릅니다."
)
if not picks:
    st.warning("스캔된 종목이 없어 추천을 만들 수 없습니다.")
else:
    cols = st.columns(min(len(picks), 5))
    for i, p in enumerate(picks[:5]):
        with cols[i % len(cols)]:
            st.markdown(f"### {p.get('pick_label', f'{i+1}위')} · {p['name']}")
            st.metric(
                "현재가",
                f"{p.get('latest_close', 0):,.0f}",
                f"{p.get('realtime_change_pct', 0):+.2f}%",
            )
            st.write(
                f"**{p.get('action', '-')}**  \n"
                f"추천점수 {p.get('pick_score', 0)} · 셋업점수 {p.get('score', 0)}  \n"
                f"스마트머니 {float(p.get('smart_money_net', 0))/1e8:.1f}억 · "
                f"기간 {p.get('price_change_pct', 0):+.1f}%  \n"
                f"{p.get('pick_why', '')}"
            )
            if st.button("이 종목 상세", key=f"pick_{p['ticker']}"):
                st.session_state.selected_ticker = p["ticker"]

    pick_rows = []
    for p in picks:
        prob = p.get("probability") or {}
        pick_rows.append(
            {
                "순위": p.get("pick_rank", 0),
                "종목": p["name"],
                "코드": p["ticker"],
                "테마": p["theme"],
                "액션": p.get("action", ""),
                "추천점수": p.get("pick_score", 0),
                "현재가": p.get("latest_close", 0),
                "실시간%": p.get("realtime_change_pct", 0),
                "기간%": p.get("price_change_pct", 0),
                "스마트머니(억)": round(float(p.get("smart_money_net", 0)) / 1e8, 1),
                "외인(억)": round(float(p.get("foreign_net", 0)) / 1e8, 1),
                "기관(억)": round(float(p.get("institution_net", 0)) / 1e8, 1),
                "연속수급": p.get("consecutive_smart_days", 0),
                "대장": "Y" if p.get("is_theme_leader") else "",
                "+5%확률": prob.get("prob_target_pct", 0),
                "고른이유": p.get("pick_why", ""),
                "액션사유": p.get("reason", ""),
            }
        )
    st.dataframe(pd.DataFrame(pick_rows), use_container_width=True, hide_index=True)

st.subheader("돈이 몰리는 테마")
theme_df = pd.DataFrame(result["theme_top"])
if not theme_df.empty:
    theme_df["smart_money_억"] = (theme_df["smart_money_net"] / 1e8).round(1)
    st.dataframe(theme_df[["theme", "smart_money_억"]], use_container_width=True, hide_index=True)
else:
    st.info("테마 집계 없음")

with st.expander("엄격 필터 후보 (선택)", expanded=False):
    rows = []
    for r in result["candidates"]:
        prob = r.get("probability", {})
        rows.append(
            {
                "종목": r["name"],
                "코드": r["ticker"],
                "테마": r["theme"],
                "점수": r.get("score", 0),
                "현재가": r.get("latest_close", 0),
                "기간수익률%": r.get("price_change_pct", 0),
                "스마트머니(억)": round(float(r.get("smart_money_net", 0)) / 1e8, 1),
                "연속수급일": r.get("consecutive_smart_days", 0),
                "대장": "Y" if r.get("is_theme_leader") else "",
                "+5%확률%": prob.get("prob_target_pct", 0),
                "액션": r.get("action", ""),
                "사유": r.get("reason", ""),
            }
        )
    cand_df = pd.DataFrame(rows)
    if cand_df.empty:
        st.info("엄격 조건 후보는 없습니다. 위 추천 Top-N을 우선 보세요.")
    else:
        st.dataframe(cand_df, use_container_width=True, hide_index=True)

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
    regime=regime.get("regime", "중립"),
)
for r in picks + result["candidates"] + result["all"]:
    if r["ticker"] == selected["ticker"]:
        if r.get("is_theme_leader"):
            selected["is_theme_leader"] = True
        if r.get("pick_score") is not None:
            selected["pick_score"] = r.get("pick_score")
            selected["pick_why"] = r.get("pick_why")
            selected["pick_rank"] = r.get("pick_rank")
        break
selected.update(action_comment(selected, regime.get("regime", "중립")))

if selected.get("pick_rank"):
    st.success(
        f"오늘 추천 {selected['pick_rank']}위 · {selected.get('pick_why', '')}"
    )

period = st.radio("분석 기간", ["3개월", "6개월"], horizontal=True)
analysis = selected["analysis_3m"] if period == "3개월" else selected["analysis_6m"]

m1, m2, m3, m4, m5 = st.columns(5)
m1.metric("현재가", f"{selected.get('latest_close', 0):,.0f}", f"{selected.get('realtime_change_pct', 0):+.2f}%")
m2.metric("기간 수익률%", analysis.get("price_change_pct", 0))
m3.metric("스마트머니(억)", round(float(analysis.get("smart_money_net", 0)) / 1e8, 1))
m4.metric("외인(억)", round(float(analysis.get("foreign_net", 0)) / 1e8, 1))
m5.metric("기관(억)", round(float(analysis.get("institution_net", 0)) / 1e8, 1))

prob = selected.get("probability", {})
risk = selected.get("risk", {})
st.markdown(
    f"**액션:** {selected.get('action')} — {selected.get('reason')}  \n"
    f"**데이터:** {selected.get('data_source')} · 체결시각 {selected.get('local_traded_at') or '-'}  \n"
    f"**+5% 확률:** {prob.get('prob_target_pct', 0)}% "
    f"(표본 {prob.get('sample_size', 0)} | "
    f"P25 {prob.get('p25', 0)}% / P50 {prob.get('p50', 0)}% / P75 {prob.get('p75', 0)}%)  \n"
    f"**리스크 가이드:** 손절 {risk.get('stop_price')} / 1차익절 {risk.get('take1_price')} / "
    f"2차익절 {risk.get('take2_price')} / 시간손절 {risk.get('time_stop_days')}일 / "
    f"계좌리스크 {risk.get('account_risk_pct')}%"
)

if analysis.get("dates"):
    fig = make_subplots(rows=2, cols=1, shared_xaxes=True, row_heights=[0.6, 0.4], vertical_spacing=0.08)
    fig.add_trace(go.Scatter(x=analysis["dates"], y=analysis["closes"], name="종가"), row=1, col=1)
    fig.add_trace(go.Scatter(x=analysis["dates"], y=analysis["cum_smart"], name="누적 스마트머니"), row=2, col=1)
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
