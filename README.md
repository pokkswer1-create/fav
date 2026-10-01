# 테마 수급 종목 분석기

기획서(`docs/종목분석기-기획서.md`)의 Phase 1 MVP 구현입니다.

## 기능
- **오늘 데이터 기반 추천 Top-N** (큰손 유입·가격정체·테마대장·연속수급·돌파·기대값)
- **초보자용 쉬운 설명** (왜 골랐는지 / 과거 성적 / 지금 어떻게 하면 되는지)
- **매수관심은 고점 돌파 확인 후**에만 승격 (그 전에는 관망)
- 테마별 외인/기관/개인 수급 스캔
- **전체 종목 모드**: 상장 ~2,700+ 종목 중 거래대금 상위 N개를 스캔 (Vercel 기본 80, Streamlit 슬라이더)
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

## 무료 API 폴백 (선택)

네이버가 막히거나 공시를 붙이고 싶을 때 `.env` / Vercel 환경변수로 켭니다. 키가 없어도 **aikstockdata**(T+1 종가·공시 보조)는 자동 사용됩니다.

| 우선순위 | 용도 | 환경변수 |
|---|---|---|
| 네이버 | 실시간·일봉·수급 (기본) | 없음 |
| 한국투자증권 Open API | 시세/일봉 백업 | `KIS_APP_KEY`, `KIS_APP_SECRET` (`KIS_USE_MOCK=1` 모의) |
| aikstockdata | 일봉·공시 보조 (키 없음) | 없음 (비상업·출처 표기) |
| OpenDART | 공시 보강 | `DART_API_KEY` |
| 공공데이터포털 KRX | 일봉 백업 | `KRX_SERVICE_KEY` |

예시 파일: `.env.example`

폴백 순서
- 일봉: 네이버 → 한투 → aikstockdata → KRX
- 시세: 네이버 → 한투
- 공시: aikstockdata → (키 있으면) DART 병합

## 테스트

```bash
PYTHONPATH=. pytest -q
```

## 주의
교육·참고용 스크리너입니다. 투자 권유/수익 보장이 아닙니다.


## 째깍 온라인 타이머

`online-timer/` — Instagram 릴에서 말한 저관여 카운트다운 타이머(프리셋·알람·광고 슬롯).
