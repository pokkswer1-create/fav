# 테마 수급 종목 분석기

기획서(`docs/종목분석기-기획서.md`)의 Phase 1 MVP 구현입니다.

## 기능
- **오늘 데이터 기반 추천 Top-N** (큰손 유입·가격정체·테마대장·연속수급·돌파·기대값)
- **초보자용 쉬운 설명** (왜 골랐는지 / 과거 성적 / 지금 어떻게 하면 되는지)
- **매수관심은 고점 돌파 확인 후**에만 승격 (그 전에는 관망)
- 테마별 외인/기관/개인 수급 스캔
- 유사 셋업 **백테스트 기대값**(승률·평균손익·기대수익, 참고용)
- 종목 3개월/6개월 가격·누적수급 차트
- 손절/익절/시간손절·비중 가이드
- 매수관심/관망/관심목록/회피 코멘트

## 공개 웹 (영구)

### A. Vercel (이미 배포됨)
- URL: https://theme-flow-analyzer-pokkswer1-4079s-projects.vercel.app
- 보호 설정: https://vercel.com/pokkswer1-4079s-projects/theme-flow-analyzer/settings/deployment-protection
- **Vercel Authentication 을 Off** 하면 로그인 없이 영구 공개됩니다.

### B. Render (원클릭, 무료·공개)
1. PR을 `main`에 머지하거나 이 브랜치를 Render에 연결
2. [Render에 배포](https://render.com/deploy?repo=https://github.com/pokkswer1-create/fav)
3. `render.yaml` 기준 Streamlit 웹 서비스가 생성됩니다.

### C. Streamlit Community Cloud
1. https://share.streamlit.io 로그인
2. GitHub `pokkswer1-create/fav` 연결
3. Branch: `cursor/stock-analyzer-plan-4be7` (또는 `main`), Main file: `app.py`

## 로컬 실행 (Streamlit)

```bash
pip install -r requirements.txt
PYTHONPATH=. streamlit run app.py
```

기본값은 **실시간 데이터(네이버 증권)** 입니다.
- 실시간 시세: polling API
- 일봉/수급: stock.naver.com API (외인·기관·개인 순매수)
- 사이드바에서 실시간 토글을 끄면 데모 샘플 데이터로 전환됩니다.
- 장중에는 자동 새로고침(60초)을 켤 수 있습니다.

## 테스트

```bash
PYTHONPATH=. pytest -q
```

## 주의
교육·참고용 스크리너입니다. 투자 권유/수익 보장이 아닙니다.
