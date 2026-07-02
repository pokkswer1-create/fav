# Academy Manager MVP (Next.js + Supabase + Vercel)

학원 관리 시스템 1차 MVP입니다. 아래 기능을 포함합니다.

- 회원 관리: 등록/검색/상태변경/상세 조회
- 수업 관리: 수업 생성/수강 등록
- 출석 관리: 출석 기록, 결석 시 보강 대기 자동 생성
- 결제 관리: 월별 결제 상태/미납 현황/Mock 결제 링크
- 업무일지: 카테고리별 기록/집계
- 급여 관리: 월별 일괄 계산/지급 처리
- 네이버 예약: 웹훅 수신/확정/취소/회원 전환
- 카카오 예약: 웹훅 수신/확정/취소/회원 전환/메시지 발송
- 대시보드: 매출/미납/출석률/보강대기 요약
- 자동화 배치: 월별 보강권 생성, 일별 미납 독촉(Mock)

## 1) Install dependencies

```bash
npm install
```

## 2) Set environment variables

Copy the template and fill your values:

```bash
copy .env.example .env.local
```

Required keys:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional server-only key:

- `SUPABASE_SERVICE_ROLE_KEY` (never expose in client components)
- `CRON_SECRET` (optional, Vercel cron endpoint 보호)
- `NAVER_WEBHOOK_SECRET` (optional, 네이버 웹훅 엔드포인트 보호)
- `KAKAO_WEBHOOK_SECRET` (optional, 카카오 웹훅 엔드포인트 보호)

## 2-1) Supabase schema 적용

Supabase SQL Editor에서 아래 파일을 순서대로 실행:

1. `supabase/schema.sql`
2. `supabase/seed.sql` (선택, 샘플 데이터)

## 3) Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

주요 화면:

- [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
- [http://localhost:3000/students](http://localhost:3000/students)
- [http://localhost:3000/classes](http://localhost:3000/classes)
- [http://localhost:3000/attendance](http://localhost:3000/attendance)
- [http://localhost:3000/payments](http://localhost:3000/payments)
- [http://localhost:3000/journals](http://localhost:3000/journals)
- [http://localhost:3000/payroll](http://localhost:3000/payroll)
- [http://localhost:3000/naver-reservations](http://localhost:3000/naver-reservations)
- [http://localhost:3000/kakao-reservations](http://localhost:3000/kakao-reservations)
- [http://localhost:3000/auth](http://localhost:3000/auth)

## 4) Connect Vercel

1. Push this project to GitHub.
2. Import repository in Vercel.
3. In Vercel `Project Settings -> Environment Variables`, add the same variables from `.env.local`.
4. Deploy.
5. (선택) `CRON_SECRET`을 Vercel 환경변수로 등록.

## 4-1) Vercel cron

`vercel.json`에 배치가 등록되어 있음:

- 매월 1일 00:00: `/api/batch/monthly-makeup-tickets`
- 매일 08:00: `/api/batch/daily-payment-reminders`

`CRON_SECRET`을 사용하면 cron 호출 시 Authorization 헤더를 검증합니다.

## 5) Supabase auth redirect settings (if using Auth)

In Supabase dashboard:

- `Authentication -> URL Configuration -> Site URL`:
  - `https://<your-vercel-domain>`
- `Redirect URLs`:
  - `https://<your-vercel-domain>/auth/callback`

## API 요약

- `GET/POST /api/students`
- `GET/PATCH /api/students/:id`
- `GET/POST /api/classes`
- `POST/DELETE /api/enrollments`
- `GET/POST /api/attendance`
- `GET/POST /api/payments`
- `PATCH /api/payments/:id`
- `GET /api/dashboard`
- `GET/POST /api/journals`
- `GET /api/payroll`
- `POST /api/payroll/calculate`
- `POST /api/payroll/:id/pay`
- `POST /api/webhooks/naver-reservation`
- `GET /api/naver-reservations`
- `GET /api/naver-reservations/:id`
- `POST /api/naver-reservations/:id/confirm`
- `POST /api/naver-reservations/:id/convert-to-member`
- `POST /api/naver-reservations/:id/cancel`
- `GET/POST /api/naver-class-listings`
- `POST /api/webhooks/kakao-reservation`
- `GET /api/kakao-reservations`
- `GET /api/kakao-reservations/:id`
- `POST /api/kakao-reservations/:id/confirm`
- `POST /api/kakao-reservations/:id/send-message`
- `POST /api/kakao-reservations/:id/convert-to-member`
- `POST /api/kakao-reservations/:id/cancel`
- `GET/POST /api/kakao-class-listings`
- `POST /api/batch/monthly-makeup-tickets`
- `POST /api/batch/daily-payment-reminders`

## 권한 모델

- `admin`: 회원/수업/결제/등록 수정 가능
- `teacher`: 조회 + 출석 입력 가능
- API 레벨에서 `src/lib/auth/guards.ts`로 역할 검증 수행
- DB 레벨에서 `supabase/schema.sql`의 RLS 정책으로 이중 보호

## Notes

- 환경변수가 없으면 앱이 시작 시점에 명확한 에러를 표시합니다.
- 결제 링크/알림은 1차에서 Mock provider를 사용합니다.
