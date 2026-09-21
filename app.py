"""테마 수급 종목 분석기 UI (실데이터 기본)."""

from __future__ import annotations

import pandas as pd
import plotly.graph_objects as go
import streamlit as st
from plotly.subplots import make_subplots

from analyzer.data import build_stock_snapshot, scan_market
from analyzer.rules import action_comment
from analyzer.signals import beginner_explain
from analyzer.themes import list_themes
from analyzer.tiers import build_tiered_picks

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
    scan_limit = st.slider("전체 스캔 종목 수(유동성 상위)", 50, 300, 150, 10)
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
            scan_limit=int(scan_limit),
            full_market=True,
        )
        st.session_state.scan_mode = "demo" if demo else "live"

result = st.session_state.scan_result
regime = result["regime"]
regime_name = regime.get("regime", "중립")

if "short_buy" not in result:
    actioned = []
    for row in result.get("all") or []:
        item = dict(row)
        comment = action_comment(item, regime_name)
        item["action"] = comment["action"]
        item["reason"] = comment["reason"]
        explain = beginner_explain(item, regime_name)
        item["beginner_summary"] = explain["summary"]
        item["beginner_backtest"] = explain["backtest"]
        item["beginner_guide"] = explain["guide"]
        item["beginner_disclosure"] = explain.get("disclosure") or ""
        item["beginner_full"] = explain["full"]
        actioned.append(item)
    result.update(build_tiered_picks(actioned, regime=regime_name, top_n=pick_n))

picks = result.get("picks") or []
short_buy = result.get("short_buy") or []
short_watch = result.get("short_watch") or []
long_buy = result.get("long_buy") or []
long_watch = result.get("long_watch") or []
if picks and "selected_ticker" not in st.session_state:
    st.session_state.selected_ticker = picks[0]["ticker"]

c1, c2, c3, c4, c5 = st.columns(5)
c1.metric("시장 상태", regime_name)
c2.metric("코스피", f"{regime.get('kospi_price', 0):,.2f}")
c3.metric("코스피 등락(%)", regime.get("kospi_change_pct", 0))
c4.metric("매수/대기", f"{result.get('buy_count', 0)}/{result.get('watch_count', 0)}")
c5.metric("모드", result.get("mode", "-"))
st.caption(
    f"스캔시각 {result.get('scanned_at', '-')} · 데이터 {regime.get('data_source', '-')} · "
    f"장상태 {regime.get('market_status', '-')} · "
    f"시세 {result.get('quote_source', '-')} · 공시 {result.get('disclosure_source', '-')} · "
    f"유니버스 {result.get('universe_size', '-')} / 전종목 {result.get('market_total', '-')} · "
    f"providers {result.get('providers', {})}"
)
if result.get("defense_buys_blocked"):
    st.warning("방어장이라 오늘 매수 추천은 비활성화했어요. 대기 종목만 보세요.")
else:
    rules = result.get("tier_rules") or {}
    st.info(
        f"단기=예상 ≤{rules.get('short_within_days', 5)}거래일 · "
        f"매수=돌파액션+샘플≥{rules.get('buy_min_samples', 10)}"
        f"+승률≥{rules.get('buy_min_up_prob', 55)}%+기대>0 · 기대수익 순"
    )

with st.expander("초보자를 위한 읽는 법", expanded=False):
    st.markdown(
        """
1. **오늘 매수**: 조건이 강한 진입 후보 (없을 수 있음 = 정상)
2. **대기**: 관심은 가지만 아직 진입 전
3. **단기/장기**: 과거 유사셋업 반응 속도(예상 거래일) 기준
4. 과거 성적은 참고용이에요. 미래 보장이 아닙니다.
"""
    )


def _render_pick_row(title: str, rows: list) -> None:
    st.subheader(title)
    if not rows:
        st.caption("해당 없음")
        return
    cols = st.columns(min(len(rows), 5))
    for i, p in enumerate(rows[:5]):
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
                f"상승확률 {exp.get('up_prob_pct', exp.get('win_rate_pct', 0))}% · "
                f"약 {exp.get('likely_within_days', 0) or '-'}거래일 · "
                f"기대 {float(exp.get('expectancy_pct', 0)):+.1f}%"
            )
            if st.button("이 종목 상세", key=f"pick_{title}_{p['ticker']}"):
                st.session_state.selected_ticker = p["ticker"]


_render_pick_row(f"단기 매수 ({len(short_buy)})", short_buy)
_render_pick_row(f"단기 대기 ({len(short_watch)})", short_watch)
_render_pick_row(f"장기 매수 ({len(long_buy)})", long_buy)
_render_pick_row(f"장기 대기 ({len(long_watch)})", long_watch)

all_tier_rows = short_buy + long_buy + short_watch + long_watch
if all_tier_rows:
    pick_rows = []
    for p in all_tier_rows:
        exp = p.get("expectancy") or {}
        risk = p.get("risk") or {}
        pick_rows.append(
            {
                "구분": f"{p.get('horizon_label', '')}/{p.get('trade_tier_label', '')}",
                "순위": p.get("pick_rank", 0),
                "종목": p["name"],
                "테마": p["theme"],
                "액션": p.get("action", ""),
                "현재가": p.get("latest_close", 0),
                "손절가": risk.get("stop_price", 0),
                "1차익절": risk.get("take1_price", 0),
                "2차익절": risk.get("take2_price", 0),
                "상승확률%": exp.get("up_prob_pct", exp.get("win_rate_pct", 0)),
                "예상일수": exp.get("likely_within_days", 0),
                "기대수익%": exp.get("expectancy_pct", 0),
                "초보 한줄": p.get("beginner_summary", ""),
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
    f"**과거 유사셋업:** 상승확률 {exp.get('up_prob_pct', exp.get('win_rate_pct', 0))}% · "
    f"1차익절 도달 {exp.get('hit_take_prob_pct', 0)}% · "
    f"오른 경우 중간 약 {exp.get('likely_within_days', 0)}거래일 "
    f"(최대 {exp.get('horizon_days', 10)}거래일) · "
    f"평균익 {exp.get('avg_win_pct', 0)}% · 평균손 {exp.get('avg_loss_pct', 0)}% · "
    f"표본 {exp.get('sample_size', 0)}  \n"
    f"**+5% 확률(단순 전방수익률 참고):** {prob.get('prob_target_pct', 0)}% (표본 {prob.get('sample_size', 0)})  \n"
    f"**리스크 가이드:** 손절 {risk.get('stop_price')} / 1차익절 {risk.get('take1_price')} / "
    f"2차익절 {risk.get('take2_price')} / 시간손절 {risk.get('time_stop_days')}일 / "
    f"계좌리스크 {risk.get('account_risk_pct')}%"
)

if analysis.get("dates"):
    fig = make_subplots(rows=2, cols=1, shared_xaxes=True, row_heights=[0.65, 0.35], vertical_spacing=0.08)
    fig.add_trace(go.Scatter(x=analysis["dates"], y=analysis["closes"], name="종가", line=dict(color="#4aa3ff", width=2)), row=1, col=1)
    # 손절/익절/현재가 수평선
    x0, x1 = analysis["dates"][0], analysis["dates"][-1]
    entry = float(selected.get("latest_close") or 0)
    shapes = []
    annotations = []
    levels = [
        ("손절", risk.get("stop_price"), "#d66a6a", "dash"),
        ("현재가", entry, "#eef3f7", "solid"),
        ("1차익절", risk.get("take1_price"), "#5ec28a", "dash"),
        ("2차익절", risk.get("take2_price"), "#2bb0a6", "dot"),
    ]
    for label, y, color, dash in levels:
        if not y:
            continue
        yv = float(y)
        shapes.append(
            dict(
                type="line",
                xref="x",
                yref="y",
                x0=x0,
                x1=x1,
                y0=yv,
                y1=yv,
                line=dict(color=color, width=1.5, dash=dash),
            )
        )
        annotations.append(
            dict(
                xref="paper",
                yref="y",
                x=1.01,
                y=yv,
                text=f"{label} {yv:,.0f}",
                showarrow=False,
                font=dict(size=11, color=color),
                xanchor="left",
            )
        )
    if selected.get("breakout", {}).get("lookback_high"):
        bh = float(selected["breakout"]["lookback_high"])
        shapes.append(
            dict(
                type="line",
                xref="x",
                yref="y",
                x0=x0,
                x1=x1,
                y0=bh,
                y1=bh,
                line=dict(color="#e0a45a", width=1, dash="dashdot"),
            )
        )
        annotations.append(
            dict(
                xref="paper",
                yref="y",
                x=1.01,
                y=bh,
                text=f"돌파기준 {bh:,.0f}",
                showarrow=False,
                font=dict(size=11, color="#e0a45a"),
                xanchor="left",
            )
        )
    fig.add_trace(go.Scatter(x=analysis["dates"], y=analysis["cum_smart"], name="누적 큰손", line=dict(color="#2bb0a6")), row=2, col=1)
    fig.add_trace(
        go.Scatter(x=analysis["dates"], y=analysis["cum_foreign"], name="누적 외인", line=dict(dash="dot", color="#93a4b3")),
        row=2,
        col=1,
    )
    fig.add_trace(
        go.Scatter(
            x=analysis["dates"],
            y=analysis["cum_institution"],
            name="누적 기관",
            line=dict(dash="dash", color="#e0a45a"),
        ),
        row=2,
        col=1,
    )
    fig.update_layout(
        height=620,
        margin=dict(l=10, r=110, t=30, b=10),
        legend=dict(orientation="h"),
        shapes=shapes,
        annotations=annotations,
    )
    st.caption("차트 가로선: 손절(빨강) · 현재가(흰) · 1차익절(연녹) · 2차익절(청녹) · 돌파기준(주황)")
    st.plotly_chart(fig, use_container_width=True)

if result["errors"]:
    with st.expander(f"데이터 오류 ({len(result['errors'])})"):
        st.dataframe(pd.DataFrame(result["errors"]), use_container_width=True)
