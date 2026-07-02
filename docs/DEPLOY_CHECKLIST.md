# Academy Manager MVP - Deploy Checklist

## 1. Supabase
- [ ] 프로젝트 생성 완료
- [ ] `supabase/schema.sql` 실행
- [ ] `supabase/seed.sql` 실행(선택)
- [ ] Auth `Site URL` 설정 (`https://<vercel-domain>`)
- [ ] Auth `Redirect URLs` 설정 (`https://<vercel-domain>/auth/callback`)

## 2. Vercel Environment Variables
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `CRON_SECRET` (선택)
- [ ] `NAVER_WEBHOOK_SECRET` (선택)
- [ ] `KAKAO_WEBHOOK_SECRET` (선택)

## 3. Vercel Deploy
- [ ] GitHub 저장소 연결
- [ ] 첫 배포 성공 확인
- [ ] `/dashboard` 페이지 로딩 확인
- [ ] `/students`에서 회원 등록 확인
- [ ] `/classes`에서 수업 생성/수강등록 확인
- [ ] `/attendance`에서 결석 등록 시 `makeup_status=waiting` 확인
- [ ] `/payments`에서 미납/완료 처리 확인
- [ ] `/naver-reservations`에서 예약 확정/취소/회원전환 확인
- [ ] `/kakao-reservations`에서 예약 확정/취소/회원전환/메시지 발송 확인

## 4. Cron Verification
- [ ] `/api/batch/monthly-makeup-tickets` 수동 호출 성공
- [ ] `/api/batch/daily-payment-reminders` 수동 호출 성공
- [ ] `payment_reminders` 데이터 생성 확인
- [ ] `/api/webhooks/naver-reservation` 테스트 호출 성공
- [ ] `/api/webhooks/kakao-reservation` 테스트 호출 성공

## 5. Security
- [ ] `service_role` 키 클라이언트 노출 없음 확인
- [ ] RLS 정책 적용 확인
- [ ] 배치 엔드포인트 `CRON_SECRET` 검증 확인
