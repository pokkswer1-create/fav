# FAV Scout

배구 경기 기록을 넣으면 **전력분석**을 하고, 경기 영상에서 클립을 골라 **하이라이트 MP4**를 만드는 웹 앱입니다.

## 기능

- **스코어시트 입력**: 선수별 공격/블로킹/서브/리시브 폼 입력 (JSON 모드 병행)
- **전력분석**: 팀 등급, 강약, 매치업 노트, 코칭 플랜
- **코트 히트맵**: 포지션·기록 기반 6구역 활동 히트맵
- **영상 편집**: 타임라인 클립 → ffmpeg 하이라이트 MP4
- **자동 장면 감지**: 오디오 침묵/피크 구간으로 후보 클립 자동 제안
- **선수 트래킹 컷**: 등번호 OCR(+기록 타임라인 보조)로 선수별 하이라이트 구간 생성
- **FAV 브랜딩**: 저지 앞면용 마젠타 날개 로고를 UI 전반에 고정

## 실행

```bash
npm install
npm run dev
```

- 홈: http://localhost:3000
- 전력분석: http://localhost:3000/analyze
- 영상편집: http://localhost:3000/editor

## 보안

로컬 기본 API 키는 `fav-local-dev-key`입니다. 배포 전에는 `.env`에서 변경하세요.

```bash
cp .env.example .env.local
```

적용된 보호:
- API 키 (`x-fav-api-key` 또는 `?key=`)
- IP rate limit / 무거운 작업 동시성 제한
- 업로드 magic-byte + ffprobe 포맷·길이 검증
- Zod 스키마(경기 JSON·클립·로스터)
- 임시파일 TTL 스윕 + 작업 후 삭제
- ffmpeg/OCR 타임아웃, 클라이언트 에러 마스킹
- 보안 응답 헤더(CSP 등)

## 테스트

```bash
npm test
npm run build
```

영상 편집·장면 감지·선수 트래킹 API는 서버에 `ffmpeg` / `ffprobe` / `tesseract` / Python OpenCV가 필요합니다.
