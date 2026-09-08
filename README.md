# FAV Scout

배구 경기 기록을 넣으면 **전력분석**을 하고, 경기 영상에서 클립을 골라 **하이라이트 MP4**를 만드는 웹 앱입니다.

## 기능

- **전력분석**: 선수별 공격/블로킹/서브/리시브 통계 → 팀 등급, 강약, 매치업 노트, 코칭 플랜
- **영상 편집**: 타임라인 클립(킬·블로킹·에이스 등) → ffmpeg로 잘라 이어붙인 하이라이트 다운로드
- **FAV 브랜딩**: 저지 앞면용 마젠타 날개 로고를 UI 전반에 고정

## 실행

```bash
npm install
npm run dev
```

- 홈: http://localhost:3000
- 전력분석: http://localhost:3000/analyze
- 영상편집: http://localhost:3000/editor

## 테스트

```bash
npm test
npm run build
```

영상 편집 API는 서버에 `ffmpeg`가 필요합니다.
