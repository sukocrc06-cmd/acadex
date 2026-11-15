-- Acadex Kids gelir testi için finans iskeleti (yalnız test): fin_ok, fin_log, fin_tasks (20261104_finans.sql'in küçük kopyası)
create or replace function public.fin_ok() returns boolean language sql stable as $$ select current_setting('test.fin', true) = '1' or current_setting('test.admin', true) = '1' $$;
create table if not exists public.fin_log_t (action text, label text, details jsonb, at timestamptz default now());
create or replace function public.fin_log(p_action text, p_label text, p_details jsonb) returns void language sql security definer set search_path = public as $$ insert into fin_log_t (action, label, details) values (p_action, p_label, p_details) $$;
create table if not exists public.fin_tasks (id uuid primary key default gen_random_uuid(), title text not null, detail text, due_on date, status text not null default 'yapilacak', assignee text, created_by uuid, created_at timestamptz not null default now(), done_at timestamptz);
