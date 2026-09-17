# 테마 수급 종목 분석기

기획서(`docs/종목분석기-기획서.md`)의 Phase 1 MVP 구현입니다.

## 기능
- **오늘 데이터 기반 추천 Top-N** (스마트머니·가격정체·테마대장·연속수급 합산)
- 테마별 외인/기관/개인 수급 스캔
- 수급 유입 + 가격 정체 엄격 후보(선택 필터)
- 테마 대장·연속 수급·유동성 반영
- 종목 3개월/6개월 가격·누적수급 차트
- 유사 구간 기반 +5% 도달 확률(참고용)
- 손절/익절/시간손절·비중 가이드
- 매수관심/관망축소/관심목록/회피 코멘트

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
