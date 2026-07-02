-- Idempotent: run in Supabase SQL Editor if production DB predates discount columns.
-- Mirrors web/supabase/schema.sql enrollments extensions.

alter table public.enrollments
add column if not exists discount_type text not null default 'none'
check (discount_type in ('none', 'amount', 'percent'));

alter table public.enrollments
add column if not exists discount_value integer not null default 0;

alter table public.enrollments
add column if not exists discount_reason text;

alter table public.enrollments
add column if not exists discount_start_date date;

alter table public.enrollments
add column if not exists discount_end_date date;

alter table public.enrollments
add column if not exists final_fee integer not null default 0;

alter table public.enrollments
add column if not exists start_date date not null default current_date;
