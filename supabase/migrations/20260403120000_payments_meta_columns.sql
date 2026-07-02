-- Idempotent: production DBs created before payments meta columns need this.
-- Fixes PostgREST: "Could not find the 'notes' column of 'payments' in the schema cache"
-- Mirrors web/supabase/schema.sql payments extensions.

alter table public.payments
add column if not exists payment_method text not null default 'online'
check (payment_method in ('online', 'transfer', 'cash', 'card', 'manual'));

alter table public.payments
add column if not exists updated_by uuid references public.profiles(id) on delete set null;

alter table public.payments
add column if not exists notes text;

alter table public.payments
add column if not exists status_changed_at timestamptz not null default now();

-- If errors persist until cache refreshes, run once: NOTIFY pgrst, 'reload schema';
