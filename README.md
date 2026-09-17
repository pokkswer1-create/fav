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

## 공개 웹 (Vercel)

브라우저용 배포본은 `web/` 입니다.

- 프로덕션: https://theme-flow-analyzer-pokkswer1-4079s-projects.vercel.app
- Vercel 팀 기본 **Deployment Protection(SSO)** 이 켜져 있으면 로그인 화면이 뜹니다.  
  프로젝트 Settings → Deployment Protection → Vercel Authentication 을 끄면 누구나 볼 수 있습니다.

```bash
cd web && npx vercel --prod
```

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
