create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key,
  full_name text not null,
  role text not null check (role in ('admin', 'teacher')),
  created_at timestamptz not null default now()
);

alter table public.profiles
add column if not exists email text;

alter table public.profiles
add column if not exists approved boolean not null default true;

alter table public.profiles
add column if not exists approved_at timestamptz;

alter table public.profiles
add column if not exists phone text;

alter table public.profiles
add column if not exists organization text;

alter table public.profiles
add column if not exists position text;

alter table public.profiles
add column if not exists approval_status text;

alter table public.profiles
add column if not exists approved_by uuid references public.profiles(id) on delete set null;

alter table public.profiles
add column if not exists rejection_reason text;

alter table public.profiles
add column if not exists reviewed_at timestamptz;

update public.profiles
set approval_status = case
  when approved = false then 'PENDING'
  else 'APPROVED'
end
where approval_status is null;

alter table public.profiles
alter column approval_status set default 'PENDING';

alter table public.profiles
alter column approval_status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_approval_status_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
    add constraint profiles_approval_status_check
    check (approval_status in ('PENDING', 'APPROVED', 'REJECTED'));
  end if;
end $$;

create index if not exists idx_profiles_approval_status_created_at
on public.profiles(approval_status, created_at desc);

create index if not exists idx_profiles_email_lower
on public.profiles((lower(email)));

create table if not exists public.user_approval_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  from_status text not null check (from_status in ('PENDING', 'APPROVED', 'REJECTED')),
  to_status text not null check (to_status in ('PENDING', 'APPROVED', 'REJECTED')),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_approval_events_user_created_at
on public.user_approval_events(user_id, created_at desc);

create table if not exists public.user_email_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  recipient_email text not null,
  template_kind text not null check (template_kind in ('submitted', 'approved', 'rejected')),
  status text not null default 'sent' check (status in ('sent', 'failed', 'skipped')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_email_notifications_user_created_at
on public.user_email_notifications(user_id, created_at desc);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  birth_date date,
  grade text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'withdrawn')),
  join_date date not null default current_date,
  parent_name text,
  parent_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.students
add column if not exists father_phone text,
add column if not exists mother_phone text;

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  teacher_name text not null,
  class_type text not null default 'regular' check (class_type in ('regular', 'trial', 'oneday')),
  class_category text not null default 'general' check (class_category in ('general', 'elite', 'tryout')),
  days_of_week text[] not null default '{}',
  start_time time not null,
  end_time time not null,
  fee_mode text not null default 'monthly_fixed' check (fee_mode in ('monthly_fixed', 'per_session')),
  fee_per_session integer not null default 0,
  monthly_fee integer not null default 0,
  monthly_sessions integer not null default 0,
  capacity integer not null default 0,
  is_active boolean not null default true,
  class_status text not null default 'active' check (class_status in ('active', 'ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.classes
add column if not exists class_status text not null default 'active'
check (class_status in ('active', 'ended'));

alter table public.classes
add column if not exists class_category text not null default 'general'
check (class_category in ('general', 'elite', 'tryout'));

alter table public.classes
add column if not exists fee_mode text not null default 'monthly_fixed'
check (fee_mode in ('monthly_fixed', 'per_session'));

alter table public.classes
add column if not exists fee_per_session integer not null default 0;

alter table public.classes
add column if not exists is_active boolean not null default true;

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  monthly_fee integer not null default 0,
  discount_type text not null default 'none' check (discount_type in ('none', 'amount', 'percent')),
  discount_value integer not null default 0,
  discount_reason text,
  discount_start_date date,
  discount_end_date date,
  final_fee integer not null default 0,
  start_date date not null default current_date,
  enrolled_at timestamptz not null default now(),
  unique(student_id, class_id)
);

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

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  class_date date not null,
  status text not null check (status in ('present', 'absent', 'late', 'early_leave', 'makeup')),
  reason text,
  makeup_status text check (makeup_status in ('waiting', 'scheduled', 'completed')),
  makeup_scheduled_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_audit_log (
  id uuid primary key default gen_random_uuid(),
  attendance_record_id uuid references public.attendance_records(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  student_id uuid references public.students(id) on delete set null,
  old_status text,
  new_status text not null,
  instructor_id text,
  logged_at_time timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.makeup_tickets (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  month_key text not null,
  total_count integer not null default 3,
  used_count integer not null default 0,
  carry_over_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique(student_id, month_key)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  month_key text not null,
  amount_due integer not null default 0,
  amount_paid integer not null default 0,
  status text not null default 'pending' check (status in ('paid', 'pending', 'unpaid', 'refunded')),
  payment_method text not null default 'online' check (payment_method in ('online', 'transfer', 'cash', 'card', 'manual')),
  updated_by uuid references public.profiles(id) on delete set null,
  notes text,
  status_changed_at timestamptz not null default now(),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique(student_id, month_key)
);

alter table public.payments
add column if not exists payment_method text not null default 'online'
check (payment_method in ('online', 'transfer', 'cash', 'card', 'manual'));

alter table public.payments
add column if not exists updated_by uuid references public.profiles(id) on delete set null;

alter table public.payments
add column if not exists notes text;

alter table public.payments
add column if not exists status_changed_at timestamptz not null default now();

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

create table if not exists public.payment_reminders (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('first', 'second', 'third', 'manual')),
  sent_at timestamptz not null default now(),
  message text
);

create table if not exists public.teacher_journals (
  id uuid primary key default gen_random_uuid(),
  teacher_profile_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('class', 'counsel', 'meeting', 'other')),
  content text not null,
  tagged_student_id uuid references public.students(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  amount integer not null,
  expense_date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position text not null,
  employment_type text not null check (employment_type in ('full_time', 'part_time', 'freelancer')),
  phone text,
  bank_account text,
  salary_type text not null check (salary_type in ('monthly', 'hourly', 'freelance')),
  monthly_fee integer not null default 0,
  hourly_rate integer not null default 0,
  freelance_fee integer not null default 0,
  monthly_work_hours integer not null default 40,
  tax_rate numeric(5, 2) not null default 3.30,
  insurances text[] not null default '{}',
  work_days text[] not null default '{}',
  start_date date not null default current_date,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.employees
add column if not exists monthly_work_hours integer not null default 40;

alter table public.employees
add column if not exists tax_rate numeric(5, 2) not null default 3.30;

alter table public.employees
add column if not exists pension_rate numeric(5, 2) not null default 4.50;

alter table public.employees
add column if not exists health_insurance_rate numeric(5, 2) not null default 3.55;

alter table public.employees
add column if not exists long_term_care_rate numeric(5, 2) not null default 0.91;

alter table public.employees
add column if not exists employment_insurance_rate numeric(5, 2) not null default 0.90;

create table if not exists public.salary_runs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  month_key text not null,
  base_salary integer not null default 0,
  bonus integer not null default 0,
  deductions integer not null default 0,
  net_salary integer not null default 0,
  paid_status text not null default 'pending' check (paid_status in ('pending', 'paid')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique(employee_id, month_key)
);

alter table public.salary_runs
add column if not exists deduction_pension integer not null default 0;

alter table public.salary_runs
add column if not exists deduction_health integer not null default 0;

alter table public.salary_runs
add column if not exists deduction_long_term_care integer not null default 0;

alter table public.salary_runs
add column if not exists deduction_employment integer not null default 0;

alter table public.salary_runs
add column if not exists deduction_other integer not null default 0;

create table if not exists public.salary_payments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  month_key text not null,
  amount integer not null,
  method text not null default 'manual',
  receipt_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.member_histories (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  action text not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.salary_policies (
  id uuid primary key default gen_random_uuid(),
  teacher_profile_id uuid not null references public.profiles(id) on delete cascade,
  base_salary integer not null default 0,
  class_bonus_per_record integer not null default 0,
  journal_bonus_per_record integer not null default 0,
  deduction_rate numeric(5, 2) not null default 5.00,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(teacher_profile_id)
);

create table if not exists public.salary_statements (
  id uuid primary key default gen_random_uuid(),
  teacher_profile_id uuid not null references public.profiles(id) on delete cascade,
  month_key text not null,
  base_salary integer not null default 0,
  bonus_amount integer not null default 0,
  deduction_amount integer not null default 0,
  net_salary integer not null default 0,
  status text not null default 'calculated' check (status in ('calculated', 'paid')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique(teacher_profile_id, month_key)
);

create table if not exists public.naver_class_listings (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.classes(id) on delete set null,
  naver_class_id text unique,
  naver_display_name text not null,
  naver_description text,
  naver_price integer not null default 0,
  available_times text[] not null default '{}',
  available_days text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- SMS 발송 큐: 안드로이드 폰이 polling 하여 실제 문자 발송
create table if not exists public.sms_queue (
  id uuid primary key default gen_random_uuid(),
  to_phone text not null,
  message text not null,
  meta jsonb default '{}'::jsonb,
  status text not null default 'pending', -- pending | sent | failed
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.sms_queue enable row level security;

create table if not exists public.naver_reservations (
  id uuid primary key default gen_random_uuid(),
  naver_reservation_id text unique not null,
  naver_place_id text,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  reservation_date date not null,
  reservation_time time not null,
  class_type text,
  number_of_people integer not null default 1,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'no_show', 'converted')),
  student_id uuid references public.students(id) on delete set null,
  is_converted boolean not null default false,
  notes text,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.kakao_class_listings (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.classes(id) on delete set null,
  kakao_class_id text unique,
  kakao_display_name text not null,
  kakao_description text,
  kakao_price integer not null default 0,
  available_times text[] not null default '{}',
  available_days text[] not null default '{}',
  rich_menu_button_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.kakao_reservations (
  id uuid primary key default gen_random_uuid(),
  kakao_reservation_id text unique not null,
  kakao_channel_id text,
  kakao_user_id text not null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  reservation_date date not null,
  reservation_time time not null,
  class_type text,
  number_of_people integer not null default 1,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'no_show', 'converted')),
  kakao_message_id text,
  student_id uuid references public.students(id) on delete set null,
  is_converted boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.external_notices (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  title text not null,
  link text not null,
  original_date timestamptz,
  author text,
  scraped_at timestamptz not null default now(),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(source, link)
);

create table if not exists public.instagram_posts (
  id uuid primary key default gen_random_uuid(),
  instagram_post_id text unique,
  account_type text not null check (account_type in ('own', 'reference')),
  account_id text,
  account_name text,
  account_avatar text,
  caption text,
  image_url text,
  media_type text not null default 'IMAGE' check (media_type in ('IMAGE', 'VIDEO', 'CAROUSEL')),
  like_count integer not null default 0,
  comment_count integer not null default 0,
  view_count integer not null default 0,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_scheduled boolean not null default false,
  scheduled_time timestamptz,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published')),
  hashtags text[] not null default '{}',
  location text
);

create table if not exists public.instagram_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.instagram_posts(id) on delete cascade,
  instagram_comment_id text unique,
  author text not null,
  author_avatar text,
  content text not null,
  like_count integer not null default 0,
  posted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.post_internal_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.instagram_posts(id) on delete cascade,
  user_id text not null,
  user_name text,
  comment text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.reference_accounts (
  id uuid primary key default gen_random_uuid(),
  instagram_username text unique not null,
  account_id text unique,
  category text not null,
  is_following boolean not null default false,
  added_at timestamptz not null default now()
);

-- 학원(프로필)별 인스타그램 비즈니스 계정 연동
create table if not exists public.instagram_links (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  instagram_business_id text not null,
  access_token text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_profile_id)
);

alter table public.instagram_links enable row level security;

create table if not exists public.shuttle_routes (
  id uuid primary key default gen_random_uuid(),
  day_of_week text not null,
  class_name text not null,
  start_time time not null,
  end_time time not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.shuttle_registrations (
  id uuid primary key default gen_random_uuid(),
  shuttle_route_id uuid not null references public.shuttle_routes(id) on delete cascade,
  member_id uuid references public.students(id) on delete set null,
  student_name text not null,
  pickup_location text not null,
  dropoff_location text,
  parent_phone1 text not null,
  parent_phone2 text,
  parent_name text,
  special_notes text,
  registered_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'inactive', 'paused'))
);

create table if not exists public.shuttle_attendance (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.shuttle_registrations(id) on delete cascade,
  date date not null,
  arrival_time time,
  has_boarded boolean not null default false,
  recorded_at timestamptz not null default now(),
  recorded_by_instructor_id text,
  notes text,
  unique(registration_id, date)
);

create table if not exists public.shuttle_drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  license_number text,
  license_expiry date,
  car_info text,
  insurance text,
  insurance_expiry date,
  status text not null default 'active' check (status in ('active', 'inactive', 'retired')),
  created_at timestamptz not null default now()
);

create table if not exists public.shuttle_schedules (
  id uuid primary key default gen_random_uuid(),
  shuttle_route_id uuid not null references public.shuttle_routes(id) on delete cascade,
  driver_id uuid not null references public.shuttle_drivers(id) on delete cascade,
  assigned_date date not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.class_announcements (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.classes(id) on delete set null,
  class_name text not null,
  title text not null,
  content text not null,
  navercafe_url text,
  open_chat_urls jsonb not null default '[]'::jsonb,
  kakao_group_urls jsonb not null default '[]'::jsonb,
  location text,
  address text,
  map_link text,
  preparation_items jsonb not null default '[]'::jsonb,
  shuttle_info jsonb not null default '{}'::jsonb,
  tuition_info jsonb not null default '{}'::jsonb,
  refund_policy text,
  agreement_items jsonb not null default '{}'::jsonb,
  agreement_description text,
  payment_guide text,
  makeup_policy text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_admin_id text
);

create table if not exists public.class_application_links (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.class_announcements(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  link_token text unique not null,
  short_url text,
  external_form_url text,
  is_active boolean not null default true,
  expiry_date date,
  created_at timestamptz not null default now(),
  unique(announcement_id)
);

create table if not exists public.announcement_send_logs (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.class_announcements(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  member_ids jsonb not null default '[]'::jsonb,
  sent_at timestamptz not null default now(),
  channel text not null,
  sent_count integer not null default 0,
  fail_count integer not null default 0,
  sent_by_admin_id text
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique(user_id, endpoint)
);

create table if not exists public.push_dispatch_log (
  id uuid primary key default gen_random_uuid(),
  dispatch_key text not null unique,
  dispatch_type text not null,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_students_updated_at on public.students;
create trigger trg_students_updated_at
before update on public.students
for each row execute function public.touch_updated_at();

drop trigger if exists trg_classes_updated_at on public.classes;
create trigger trg_classes_updated_at
before update on public.classes
for each row execute function public.touch_updated_at();

drop trigger if exists trg_salary_policies_updated_at on public.salary_policies;
create trigger trg_salary_policies_updated_at
before update on public.salary_policies
for each row execute function public.touch_updated_at();

drop trigger if exists trg_employees_updated_at on public.employees;
create trigger trg_employees_updated_at
before update on public.employees
for each row execute function public.touch_updated_at();

drop trigger if exists trg_instagram_posts_updated_at on public.instagram_posts;
create trigger trg_instagram_posts_updated_at
before update on public.instagram_posts
for each row execute function public.touch_updated_at();

drop trigger if exists trg_class_announcements_updated_at on public.class_announcements;
create trigger trg_class_announcements_updated_at
before update on public.class_announcements
for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.classes enable row level security;
alter table public.enrollments enable row level security;
alter table public.attendance_records enable row level security;
alter table public.makeup_tickets enable row level security;
alter table public.payments enable row level security;
alter table public.payment_reminders enable row level security;
alter table public.teacher_journals enable row level security;
alter table public.expenses enable row level security;
alter table public.salary_policies enable row level security;
alter table public.salary_statements enable row level security;
alter table public.naver_class_listings enable row level security;
alter table public.naver_reservations enable row level security;
alter table public.kakao_class_listings enable row level security;
alter table public.kakao_reservations enable row level security;
alter table public.attendance_audit_log enable row level security;
alter table public.expense_categories enable row level security;
alter table public.employees enable row level security;
alter table public.salary_runs enable row level security;
alter table public.salary_payments enable row level security;
alter table public.member_histories enable row level security;
alter table public.member_change_logs enable row level security;
alter table public.payment_change_logs enable row level security;
alter table public.external_notices enable row level security;
alter table public.instagram_posts enable row level security;
alter table public.instagram_comments enable row level security;
alter table public.post_internal_comments enable row level security;
alter table public.reference_accounts enable row level security;
alter table public.shuttle_routes enable row level security;
alter table public.shuttle_registrations enable row level security;
alter table public.shuttle_attendance enable row level security;
alter table public.shuttle_drivers enable row level security;
alter table public.shuttle_schedules enable row level security;
alter table public.class_announcements enable row level security;
alter table public.class_application_links enable row level security;
alter table public.announcement_send_logs enable row level security;
alter table public.user_approval_events enable row level security;
alter table public.user_email_notifications enable row level security;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and approval_status = 'APPROVED'
$$;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
using (id = auth.uid());

drop policy if exists "profiles_upsert_admin" on public.profiles;
create policy "profiles_upsert_admin"
on public.profiles for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
with check (id = auth.uid());

drop policy if exists "profiles_update_own_limited" on public.profiles;
create policy "profiles_update_own_limited"
on public.profiles for update
using (false)
with check (false);

drop policy if exists "user_approval_events_admin_all" on public.user_approval_events;
create policy "user_approval_events_admin_all"
on public.user_approval_events for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "user_email_notifications_admin_all" on public.user_email_notifications;
create policy "user_email_notifications_admin_all"
on public.user_email_notifications for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "students_teacher_admin_read" on public.students;
create policy "students_teacher_admin_read"
on public.students for select
using (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "students_admin_write" on public.students;
create policy "students_admin_write"
on public.students for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "classes_teacher_admin_read" on public.classes;
create policy "classes_teacher_admin_read"
on public.classes for select
using (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "classes_admin_write" on public.classes;
create policy "classes_admin_write"
on public.classes for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "enrollments_teacher_admin_read" on public.enrollments;
create policy "enrollments_teacher_admin_read"
on public.enrollments for select
using (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "enrollments_admin_write" on public.enrollments;
create policy "enrollments_admin_write"
on public.enrollments for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "attendance_teacher_admin_read" on public.attendance_records;
create policy "attendance_teacher_admin_read"
on public.attendance_records for select
using (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "attendance_teacher_admin_write" on public.attendance_records;
create policy "attendance_teacher_admin_write"
on public.attendance_records for all
using (public.current_user_role() in ('admin', 'teacher'))
with check (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "payments_teacher_admin_read" on public.payments;
create policy "payments_teacher_admin_read"
on public.payments for select
using (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "payments_admin_write" on public.payments;
create policy "payments_admin_write"
on public.payments for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "payment_reminders_admin_read_write" on public.payment_reminders;
create policy "payment_reminders_admin_read_write"
on public.payment_reminders for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "teacher_journals_teacher_admin_read" on public.teacher_journals;
create policy "teacher_journals_teacher_admin_read"
on public.teacher_journals for select
using (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "teacher_journals_teacher_admin_write" on public.teacher_journals;
create policy "teacher_journals_teacher_admin_write"
on public.teacher_journals for all
using (
  public.current_user_role() = 'admin'
  or teacher_profile_id = auth.uid()
)
with check (
  public.current_user_role() = 'admin'
  or teacher_profile_id = auth.uid()
);

drop policy if exists "expenses_admin_all" on public.expenses;
create policy "expenses_admin_all"
on public.expenses for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "salary_policies_admin_all" on public.salary_policies;
create policy "salary_policies_admin_all"
on public.salary_policies for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "salary_statements_admin_all" on public.salary_statements;
create policy "salary_statements_admin_all"
on public.salary_statements for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "salary_statements_teacher_read_own" on public.salary_statements;
create policy "salary_statements_teacher_read_own"
on public.salary_statements for select
using (
  public.current_user_role() = 'admin'
  or teacher_profile_id = auth.uid()
);

drop policy if exists "naver_class_listings_admin_teacher_read" on public.naver_class_listings;
create policy "naver_class_listings_admin_teacher_read"
on public.naver_class_listings for select
using (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "naver_class_listings_admin_write" on public.naver_class_listings;
create policy "naver_class_listings_admin_write"
on public.naver_class_listings for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "naver_reservations_admin_teacher_read" on public.naver_reservations;
create policy "naver_reservations_admin_teacher_read"
on public.naver_reservations for select
using (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "naver_reservations_admin_write" on public.naver_reservations;
create policy "naver_reservations_admin_write"
on public.naver_reservations for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "kakao_class_listings_admin_teacher_read" on public.kakao_class_listings;
create policy "kakao_class_listings_admin_teacher_read"
on public.kakao_class_listings for select
using (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "kakao_class_listings_admin_write" on public.kakao_class_listings;
create policy "kakao_class_listings_admin_write"
on public.kakao_class_listings for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "kakao_reservations_admin_teacher_read" on public.kakao_reservations;
create policy "kakao_reservations_admin_teacher_read"
on public.kakao_reservations for select
using (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "kakao_reservations_admin_write" on public.kakao_reservations;
create policy "kakao_reservations_admin_write"
on public.kakao_reservations for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "attendance_audit_admin_teacher_read" on public.attendance_audit_log;
create policy "attendance_audit_admin_teacher_read"
on public.attendance_audit_log for select
using (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "attendance_audit_admin_teacher_write" on public.attendance_audit_log;
create policy "attendance_audit_admin_teacher_write"
on public.attendance_audit_log for all
using (public.current_user_role() in ('admin', 'teacher'))
with check (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "expense_categories_admin_all" on public.expense_categories;
create policy "expense_categories_admin_all"
on public.expense_categories for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "employees_admin_all" on public.employees;
create policy "employees_admin_all"
on public.employees for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "salary_runs_admin_all" on public.salary_runs;
create policy "salary_runs_admin_all"
on public.salary_runs for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "salary_payments_admin_all" on public.salary_payments;
create policy "salary_payments_admin_all"
on public.salary_payments for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "member_histories_admin_teacher_read" on public.member_histories;
create policy "member_histories_admin_teacher_read"
on public.member_histories for select
using (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "member_histories_admin_write" on public.member_histories;
create policy "member_histories_admin_write"
on public.member_histories for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "member_change_logs_admin_teacher_read" on public.member_change_logs;
create policy "member_change_logs_admin_teacher_read"
on public.member_change_logs for select
using (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "member_change_logs_admin_write" on public.member_change_logs;
create policy "member_change_logs_admin_write"
on public.member_change_logs for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "payment_change_logs_admin_teacher_read" on public.payment_change_logs;
create policy "payment_change_logs_admin_teacher_read"
on public.payment_change_logs for select
using (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "payment_change_logs_admin_write" on public.payment_change_logs;
create policy "payment_change_logs_admin_write"
on public.payment_change_logs for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "external_notices_admin_teacher_read" on public.external_notices;
create policy "external_notices_admin_teacher_read"
on public.external_notices for select
using (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "external_notices_admin_write" on public.external_notices;
create policy "external_notices_admin_write"
on public.external_notices for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "instagram_posts_admin_teacher_read" on public.instagram_posts;
create policy "instagram_posts_admin_teacher_read"
on public.instagram_posts for select
using (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "instagram_posts_admin_write" on public.instagram_posts;
create policy "instagram_posts_admin_write"
on public.instagram_posts for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "instagram_comments_admin_teacher_read" on public.instagram_comments;
create policy "instagram_comments_admin_teacher_read"
on public.instagram_comments for select
using (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "instagram_comments_admin_write" on public.instagram_comments;
create policy "instagram_comments_admin_write"
on public.instagram_comments for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "instagram_links_admin_teacher_own" on public.instagram_links;
create policy "instagram_links_admin_teacher_own"
on public.instagram_links for all
using (
  public.current_user_role() in ('admin', 'teacher')
  and owner_profile_id = auth.uid()
)
with check (
  public.current_user_role() in ('admin', 'teacher')
  and owner_profile_id = auth.uid()
);

drop policy if exists "post_internal_comments_admin_teacher_read" on public.post_internal_comments;
create policy "post_internal_comments_admin_teacher_read"
on public.post_internal_comments for select
using (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "post_internal_comments_admin_teacher_write" on public.post_internal_comments;
create policy "post_internal_comments_admin_teacher_write"
on public.post_internal_comments for all
using (public.current_user_role() in ('admin', 'teacher'))
with check (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "reference_accounts_admin_teacher_read" on public.reference_accounts;
create policy "reference_accounts_admin_teacher_read"
on public.reference_accounts for select
using (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "reference_accounts_admin_write" on public.reference_accounts;
create policy "reference_accounts_admin_write"
on public.reference_accounts for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "shuttle_routes_admin_teacher_read" on public.shuttle_routes;
create policy "shuttle_routes_admin_teacher_read"
on public.shuttle_routes for select
using (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "shuttle_routes_admin_write" on public.shuttle_routes;
create policy "shuttle_routes_admin_write"
on public.shuttle_routes for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "shuttle_registrations_admin_teacher_read" on public.shuttle_registrations;
create policy "shuttle_registrations_admin_teacher_read"
on public.shuttle_registrations for select
using (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "shuttle_registrations_admin_teacher_write" on public.shuttle_registrations;
create policy "shuttle_registrations_admin_teacher_write"
on public.shuttle_registrations for all
using (public.current_user_role() in ('admin', 'teacher'))
with check (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "shuttle_attendance_admin_teacher_read" on public.shuttle_attendance;
create policy "shuttle_attendance_admin_teacher_read"
on public.shuttle_attendance for select
using (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "shuttle_attendance_admin_teacher_write" on public.shuttle_attendance;
create policy "shuttle_attendance_admin_teacher_write"
on public.shuttle_attendance for all
using (public.current_user_role() in ('admin', 'teacher'))
with check (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "shuttle_drivers_admin_teacher_read" on public.shuttle_drivers;
create policy "shuttle_drivers_admin_teacher_read"
on public.shuttle_drivers for select
using (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "shuttle_drivers_admin_write" on public.shuttle_drivers;
create policy "shuttle_drivers_admin_write"
on public.shuttle_drivers for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "shuttle_schedules_admin_teacher_read" on public.shuttle_schedules;
create policy "shuttle_schedules_admin_teacher_read"
on public.shuttle_schedules for select
using (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "shuttle_schedules_admin_write" on public.shuttle_schedules;
create policy "shuttle_schedules_admin_write"
on public.shuttle_schedules for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "class_announcements_admin_teacher_read" on public.class_announcements;
create policy "class_announcements_admin_teacher_read"
on public.class_announcements for select
using (public.current_user_role() in ('admin', 'teacher'));

drop policy if exists "class_announcements_public_read_active" on public.class_announcements;
create policy "class_announcements_public_read_active"
on public.class_announcements for select
using (is_active = true);

drop policy if exists "class_announcements_admin_write" on public.class_announcements;
create policy "class_announcements_admin_write"
on public.class_announcements for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "class_application_links_public_read" on public.class_application_links;
create policy "class_application_links_public_read"
on public.class_application_links for select
using (is_active = true);

drop policy if exists "class_application_links_admin_write" on public.class_application_links;
create policy "class_application_links_admin_write"
on public.class_application_links for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "announcement_send_logs_admin_read_write" on public.announcement_send_logs;
create policy "announcement_send_logs_admin_read_write"
on public.announcement_send_logs for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "push_subscriptions_own_all" on public.push_subscriptions;
create policy "push_subscriptions_own_all"
on public.push_subscriptions for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- 학부모 공개 사이트: 설정·공지·신청 (요율표는 JSON, 실제 결제는 추후 연동)
alter table public.classes
add column if not exists makeup_capacity integer not null default 0;

create table if not exists public.academy_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  setting_value jsonb not null default '{}'::jsonb,
  category text not null,
  last_updated_at timestamptz not null default now(),
  last_updated_by_admin_id uuid references public.employees(id) on delete set null
);

create index if not exists idx_academy_settings_category on public.academy_settings(category);

create table if not exists public.public_notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  category text not null default 'announcement',
  image_url text,
  is_published boolean not null default true,
  published_at timestamptz not null default now(),
  expiry_date date,
  created_by_admin_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_public_notices_published_at on public.public_notices(published_at desc);

create table if not exists public.trial_class_applications (
  id uuid primary key default gen_random_uuid(),
  student_name text not null,
  age integer,
  phone text not null,
  school text,
  parent_phone text not null,
  parent_name text,
  agree_personal_info boolean not null default false,
  agree_refund_policy boolean not null default false,
  application_date timestamptz not null default now(),
  status text not null default 'pending',
  applied_class_id uuid references public.classes(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  payment_status text,
  notes text
);

create index if not exists idx_trial_apps_date on public.trial_class_applications(application_date desc);

create table if not exists public.regular_class_applications (
  id uuid primary key default gen_random_uuid(),
  student_name text not null,
  age integer,
  phone text not null,
  school text,
  parent_phone text not null,
  parent_name text,
  address text,
  needs_shuttle boolean not null default false,
  agree_personal_info boolean not null default false,
  agree_refund_policy boolean not null default false,
  applied_class_id uuid references public.classes(id) on delete set null,
  application_date timestamptz not null default now(),
  status text not null default 'pending',
  counseling_date timestamptz,
  counseling_notes text,
  payment_id uuid references public.payments(id) on delete set null,
  payment_status text,
  enrollment_date date,
  notes text
);

create index if not exists idx_regular_apps on public.regular_class_applications(application_date desc, status);

create table if not exists public.elite_team_applications (
  id uuid primary key default gen_random_uuid(),
  student_name text not null,
  age integer,
  phone text not null,
  school text,
  parent_phone text not null,
  parent_name text,
  agree_personal_info boolean not null default false,
  agree_activity_consent boolean not null default false,
  test_date date,
  test_time time,
  test_location text,
  application_date timestamptz not null default now(),
  status text not null default 'pending',
  test_result text,
  payment_id uuid references public.payments(id) on delete set null,
  payment_status text,
  notes text
);

create index if not exists idx_elite_apps on public.elite_team_applications(application_date desc);

create table if not exists public.makeup_class_applications (
  id uuid primary key default gen_random_uuid(),
  student_name text not null,
  age integer,
  phone text not null,
  parent_phone text not null,
  makeup_class_id uuid references public.classes(id) on delete set null,
  preferred_date date,
  preferred_time time,
  agree_personal_info boolean not null default false,
  agree_guideline_consent boolean not null default false,
  application_date timestamptz not null default now(),
  status text not null default 'pending',
  approved_date date,
  approved_time time,
  notes text
);

create index if not exists idx_makeup_apps on public.makeup_class_applications(application_date desc, makeup_class_id);

alter table public.academy_settings enable row level security;
alter table public.public_notices enable row level security;
alter table public.trial_class_applications enable row level security;
alter table public.regular_class_applications enable row level security;
alter table public.elite_team_applications enable row level security;
alter table public.makeup_class_applications enable row level security;

drop policy if exists "academy_settings_admin_all" on public.academy_settings;
create policy "academy_settings_admin_all"
on public.academy_settings for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "academy_settings_public_read" on public.academy_settings;
create policy "academy_settings_public_read"
on public.academy_settings for select
using (true);

drop policy if exists "public_notices_admin_all" on public.public_notices;
create policy "public_notices_admin_all"
on public.public_notices for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "public_notices_public_read" on public.public_notices;
create policy "public_notices_public_read"
on public.public_notices for select
using (is_published = true and (expiry_date is null or expiry_date >= current_date));

drop policy if exists "trial_apps_admin_all" on public.trial_class_applications;
create policy "trial_apps_admin_all"
on public.trial_class_applications for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "regular_apps_admin_all" on public.regular_class_applications;
create policy "regular_apps_admin_all"
on public.regular_class_applications for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "elite_apps_admin_all" on public.elite_team_applications;
create policy "elite_apps_admin_all"
on public.elite_team_applications for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "makeup_apps_admin_all" on public.makeup_class_applications;
create policy "makeup_apps_admin_all"
on public.makeup_class_applications for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

-- 직원 달력 수동 일정 (홈/달력 메뉴)
create table if not exists public.staff_calendar_events (
  id uuid primary key default gen_random_uuid(),
  event_date date not null,
  category text not null default '기타',
  student_name text,
  class_name text,
  event_time time,
  note text,
  created_at timestamptz not null default now(),
  created_by_profile_id uuid references public.profiles(id) on delete set null
);

create index if not exists idx_staff_calendar_events_date on public.staff_calendar_events(event_date);
create index if not exists idx_students_status_name on public.students(status, name);
create index if not exists idx_enrollments_class_student on public.enrollments(class_id, student_id);
create index if not exists idx_payments_student_month_status on public.payments(student_id, month_key, status);

alter table public.staff_calendar_events enable row level security;

drop policy if exists "staff_calendar_events_teacher_admin" on public.staff_calendar_events;
create policy "staff_calendar_events_teacher_admin"
on public.staff_calendar_events for all
using (public.current_user_role() in ('admin', 'teacher'))
with check (public.current_user_role() in ('admin', 'teacher'));
