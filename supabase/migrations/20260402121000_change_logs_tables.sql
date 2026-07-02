-- Idempotent: run in Supabase SQL Editor to ensure change-log tables exist.
-- Required for:
-- - /api/students/change-logs
-- - /api/payments/change-logs

create table if not exists public.member_change_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  reason text,
  before_data jsonb not null default '{}'::jsonb,
  after_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_member_change_logs_student_created
on public.member_change_logs(student_id, created_at desc);

create table if not exists public.payment_change_logs (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.payments(id) on delete set null,
  student_id uuid references public.students(id) on delete set null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  month_key text not null,
  from_status text,
  to_status text not null,
  amount_due integer not null default 0,
  amount_paid integer not null default 0,
  reason text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_change_logs_student_month
on public.payment_change_logs(student_id, month_key, created_at desc);

