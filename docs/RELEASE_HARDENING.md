# Release Hardening

운영 배포 전 반드시 아래 순서로 수행합니다.

## 1) 인증 우회 제거
- `.env.local` 및 배포 환경변수에서 `NEXT_PUBLIC_BYPASS_AUTH`를 `false`로 변경
- 브라우저 캐시를 비우고 `/api/*` 호출 시 권한 체크가 정상 작동하는지 확인

## 2) 테스트 오픈 RLS 정책 제거
- `supabase/security/disable_test_open_policies.sql` 실행
- 기본 RLS 정책만 남아있는지 확인

## 3) 운영용 검증
- admin 계정: 전체 CRUD 확인
- teacher 계정: 허용된 읽기/기록만 가능한지 확인
- 익명 사용자: 보호 API 접근 차단 확인

## 4) 체크리스트
- 결제 일괄 발송 API 권한 확인
- 예약 웹훅 시크릿(`NAVER_WEBHOOK_SECRET`, `KAKAO_WEBHOOK_SECRET`) 확인
- cron 시크릿(`CRON_SECRET`) 확인
