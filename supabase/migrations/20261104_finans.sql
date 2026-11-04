-- ==========================================================================
-- Acadex: Yönetim paneli · FİNANS bölümü ve "finans" rolü — 04.11.2026
--
-- Bu migration OTOMATİK UYGULANMAZ: Supabase Studio → SQL Editor'a yapıştırıp
-- çalıştırın. ÖNCE 20261028_odeme_iyzico.sql çalışmış olmalı (plan_prices,
-- payment_coupons, payment_orders tabloları). O dosya yalnızca tablo kurar;
-- ödeme almayı açmaz.
--
-- NE KURAR
--   1. staff_roles + fin_ok(): "finans" rolü. Finans rolündeki kişi yönetim
--      paneline girer ama yalnız Finans ve Acadex ekibi (salt okunur) bölümlerini
--      görür. Öğrencilerin kişisel verisine (ad, e-posta, belge) erişemez;
--      bütün sayılar toplu gelir. Yöneticiler (is_admin) her şeyi görür.
--   2. admin_whoami: rol bilgisi eklenir (is_admin davranışı değişmez).
--   3. Finans çalışma tabloları: gider defteri, aylık bütçe, maliyet kalemleri,
--      görevler, notlar, iş modeli senaryoları. Yalnız fin_ok() okur/yazar.
--   4. Fonksiyonlar: fin_overview (gelir/abone/kullanım panosu), fin_set_limit,
--      fin_set_price, fin_coupons, fin_upsert_coupon, fin_quota_watch,
--      fin_grant_plan (yalnız yönetici), fin_staff / fin_set_staff (yalnız yönetici).
--      Değişiklikler admin_audit_log'a yazılır.
--
-- Kişi/ekip verisi YOKTUR. Rol vermek için çalıştırdıktan sonra panelde
-- Finans → "Erişim" kutusundan e-posta ile verin ya da:
--   select public.fin_set_staff('kisi@ornek.com', true);
-- İki kez çalıştırılabilir (idempotent).
-- ==========================================================================

do $$ begin
  if to_regclass('public.plan_prices') is null or to_regclass('public.payment_orders') is null or to_regclass('public.payment_coupons') is null then
    raise exception 'Önce supabase/migrations/20261028_odeme_iyzico.sql dosyasını çalıştırın (plan_prices, payment_coupons, payment_orders).';
  end if;
end $$;

-- --------------------------------------------------------------------------
-- 1. Rol
-- --------------------------------------------------------------------------
create table if not exists public.staff_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('finans')),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now()
);
alter table public.staff_roles enable row level security;
-- politika yok: yalnız aşağıdaki SECURITY DEFINER fonksiyonlar okur/yazar

create or replace function public.current_is_finance()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_roles where user_id = auth.uid() and role = 'finans');
$$;
create or replace function public.fin_ok()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_is_admin() or public.current_is_finance();
$$;

create or replace function public.admin_whoami()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('is_admin', public.current_is_admin(), 'is_finance', public.current_is_finance(),
    'role', case when public.current_is_admin() then 'admin' when public.current_is_finance() then 'finans' else null end,
    'aal', coalesce(auth.jwt()->>'aal', 'aal1'),
    'name', (select full_name from public.profiles where id = auth.uid()), 'email', (select email from public.profiles where id = auth.uid()));
$$;

-- finans rolü ekip şemasını OKUYABİLİR (yazamaz)
drop policy if exists ax_teams_fin_read on public.ax_teams;
create policy ax_teams_fin_read on public.ax_teams for select to authenticated using (public.current_is_finance());
drop policy if exists ax_people_fin_read on public.ax_people;
create policy ax_people_fin_read on public.ax_people for select to authenticated using (public.current_is_finance());

-- --------------------------------------------------------------------------
-- 2. Çalışma tabloları
-- --------------------------------------------------------------------------
create table if not exists public.fin_costs (
  key        text primary key check (key ~ '^[a-z_]{2,30}$'),
  label      text not null check (char_length(label) <= 80),
  amount     numeric(14,4) not null default 0 check (amount >= 0),
  unit       text not null check (unit in ('TL/ay', 'TL/yıl', 'TL/sayfa', '%')),
  note       text check (char_length(note) <= 300),
  sort       integer not null default 100,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.fin_costs (key, label, amount, unit, note, sort) values
  ('ai_sayfa', 'Yapay zekâ özet maliyeti', 0, 'TL/sayfa', 'özetlenen her sayfa için ortalama API maliyeti', 10),
  ('supabase', 'Supabase (veritabanı, depolama)', 0, 'TL/ay', null, 20),
  ('vercel', 'Vercel (barındırma)', 0, 'TL/ay', null, 30),
  ('alan_adi', 'Alan adı (acadex.com.tr)', 0, 'TL/yıl', null, 40),
  ('odeme_komisyon', 'Ödeme kuruluşu komisyonu', 0, '%', 'iyzico işlem komisyonu', 50),
  ('kdv', 'KDV (fiyatlara dahil)', 20, '%', 'satış fiyatları KDV dahil; net gelir = brüt / 1,20', 60)
on conflict (key) do nothing;

create table if not exists public.fin_expenses (
  id           uuid primary key default gen_random_uuid(),
  spent_on     date not null default current_date,
  category     text not null check (category in ('altyapi', 'yapay_zeka', 'pazarlama', 'etkinlik', 'hukuk', 'personel', 'ekipman', 'diger')),
  vendor       text check (char_length(vendor) <= 120),
  amount_kurus bigint not null check (amount_kurus > 0 and amount_kurus < 100000000000),
  note         text check (char_length(note) <= 500),
  recurring    boolean not null default false,
  created_by   uuid default auth.uid() references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists fin_expenses_day_idx on public.fin_expenses (spent_on desc);

create table if not exists public.fin_budgets (
  month        date not null check (extract(day from month) = 1),
  category     text not null check (category in ('altyapi', 'yapay_zeka', 'pazarlama', 'etkinlik', 'hukuk', 'personel', 'ekipman', 'diger')),
  amount_kurus bigint not null check (amount_kurus >= 0),
  primary key (month, category)
);

create table if not exists public.fin_tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 2 and 160),
  detail      text check (char_length(detail) <= 1500),
  due_on      date,
  status      text not null default 'yapilacak' check (status in ('yapilacak', 'suruyor', 'bekliyor', 'bitti')),
  assignee    text check (char_length(assignee) <= 80),
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  done_at     timestamptz
);

create table if not exists public.fin_notes (
  id          uuid primary key default gen_random_uuid(),
  body        text not null check (char_length(body) between 1 and 4000),
  pinned      boolean not null default false,
  author      text check (char_length(author) <= 80),
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.fin_scenarios (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  params      jsonb not null default '{}'::jsonb check (pg_column_size(params) < 8000),
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['fin_costs', 'fin_expenses', 'fin_budgets', 'fin_tasks', 'fin_notes', 'fin_scenarios'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_fin', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.fin_ok()) with check (public.fin_ok())', t || '_fin', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- kupona kampanya adı (ör. "Hacettepe kampüs elçisi")
alter table public.payment_coupons add column if not exists label text check (char_length(label) <= 80);
alter table public.payment_coupons add column if not exists created_at timestamptz not null default now();

-- --------------------------------------------------------------------------
-- 3. Değişiklik kaydı yardımcısı
-- --------------------------------------------------------------------------
create or replace function public.fin_log(p_action text, p_label text, p_details jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.admin_audit_log (actor_id, actor_name, action, target_label, details)
  values (auth.uid(), (select full_name from public.profiles where id = auth.uid()), p_action, p_label, p_details);
$$;

-- finans işlemlerinin geçmişi (kim, ne zaman, önce/sonra): yalnız fin_* kayıtları
create or replace function public.fin_history(p_limit integer default 60)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.fin_ok() then raise exception 'yetki yok' using errcode = '42501'; end if;
  return coalesce((select json_agg(json_build_object('at', a.created_at, 'who', a.actor_name, 'action', a.action,
      'label', case when a.action = 'fin_grant_plan' and not public.current_is_admin() then null else a.target_label end, 'details', a.details) order by a.created_at desc)
    from (select * from public.admin_audit_log where action like 'fin\_%' order by created_at desc limit least(greatest(p_limit, 1), 200)) a), '[]'::json);
end $$;

-- --------------------------------------------------------------------------
-- 4. Pano: gelir, abone, kullanım (kişisel veri yok, yalnız toplamlar)
-- --------------------------------------------------------------------------
create or replace function public.fin_overview()
returns json language plpgsql stable security definer set search_path = public as $$
declare r json;
begin
  if not public.fin_ok() then raise exception 'yetki yok' using errcode = '42501'; end if;
  select json_build_object(
    'users_total', (select count(*) from public.profiles),
    'active_30', (select count(*) from public.profiles where last_active_date >= current_date - 30),
    'new_users_30', (select count(*) from public.profiles where created_at >= now() - interval '30 days'),
    'plans', coalesce((select json_agg(json_build_object('plan', plan, 'n', n) order by plan) from (
        select coalesce((select up.plan from public.user_plans up where up.user_id = pr.id and (up.valid_until is null or up.valid_until > now())), 'lite') plan, count(*) n
        from public.profiles pr group by 1) x), '[]'::json),
    'paying_users', (select count(distinct user_id) from public.payment_orders where status = 'paid'),
    'active_paid', (select count(distinct user_id) from public.payment_orders where status = 'paid' and plan_until > now()),
    'mrr_kurus', coalesce((select round(sum(amount_kurus::numeric * 30 / greatest(days, 1))) from public.payment_orders where status = 'paid' and plan_until > now()), 0),
    'paid_30', (select count(*) from public.payment_orders where status = 'paid' and paid_at >= now() - interval '30 days'),
    'revenue_30_kurus', coalesce((select sum(amount_kurus) from public.payment_orders where status = 'paid' and paid_at >= now() - interval '30 days'), 0),
    'lapsed_30', (select count(distinct o.user_id) from public.payment_orders o where o.status = 'paid' and o.plan_until between now() - interval '30 days' and now()
                    and not exists (select 1 from public.payment_orders o2 where o2.user_id = o.user_id and o2.status = 'paid' and o2.plan_until > now())),
    'failed_30', (select count(*) from public.payment_orders where status = 'failed' and created_at >= now() - interval '30 days'),
    'months', coalesce((select json_agg(json_build_object('m', to_char(m, 'YYYY-MM'), 'kurus', coalesce(k, 0), 'n', coalesce(n, 0), 'refund', coalesce(rf, 0)) order by m) from (
        select g.m, sum(o.amount_kurus) filter (where o.status = 'paid') k, count(o.*) filter (where o.status = 'paid') n, sum(o.amount_kurus) filter (where o.status = 'refunded') rf
        from generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') g(m)
        left join public.payment_orders o on date_trunc('month', coalesce(o.paid_at, o.created_at)) = g.m
        group by g.m) y), '[]'::json),
    'by_period', coalesce((select json_agg(json_build_object('plan', plan, 'period', period, 'n', n, 'kurus', k)) from (
        select plan, period, count(*) n, sum(amount_kurus) k from public.payment_orders where status = 'paid' group by plan, period) z), '[]'::json),
    'usage', coalesce((select json_agg(json_build_object('m', to_char(period, 'YYYY-MM'), 'pages', p, 'docs', d, 'cache', c, 'users', u) order by period) from (
        select period, sum(pages_used) p, sum(docs_used) d, sum(cache_hits) c, count(*) u from public.summary_usage
        where period >= (date_trunc('month', now()) - interval '5 months')::date group by period) w), '[]'::json),
    'usage_by_plan', coalesce((select json_agg(json_build_object('plan', plan, 'pages', p, 'users', u)) from (
        select coalesce(case when up.valid_until is null or up.valid_until > now() then up.plan end, 'lite') plan, sum(s.pages_used) p, count(*) u
        from public.summary_usage s left join public.user_plans up on up.user_id = s.user_id
        where s.period = date_trunc('month', now())::date group by 1) v), '[]'::json),
    'limits', coalesce((select json_agg(row_to_json(l) order by l.monthly_pages) from public.plan_limits l), '[]'::json),
    'prices', coalesce((select json_agg(row_to_json(p) order by p.plan, p.days) from public.plan_prices p), '[]'::json)
  ) into r;
  return r;
end $$;

-- --------------------------------------------------------------------------
-- 5. Plan sınırları ve fiyatlar (finans ve yönetici değiştirebilir, kayda geçer)
-- --------------------------------------------------------------------------
create or replace function public.fin_set_limit(p_plan text, p_monthly integer, p_per_doc integer, p_visual boolean)
returns void language plpgsql security definer set search_path = public as $$
declare o record;
begin
  if not public.fin_ok() then raise exception 'yetki yok' using errcode = '42501'; end if;
  if p_monthly < 0 or p_monthly > 100000 or p_per_doc < 1 or p_per_doc > 5000 then raise exception 'sınır değeri geçersiz'; end if;
  select * into o from public.plan_limits where plan = p_plan; if not found then raise exception 'plan yok: %', p_plan; end if;
  update public.plan_limits set monthly_pages = p_monthly, max_pages_per_doc = p_per_doc, visual_analysis = p_visual, updated_at = now() where plan = p_plan;
  perform public.fin_log('fin_limit', p_plan, json_build_object('once', json_build_object('aylik', o.monthly_pages, 'belge', o.max_pages_per_doc, 'gorsel', o.visual_analysis), 'sonra', json_build_object('aylik', p_monthly, 'belge', p_per_doc, 'gorsel', p_visual))::jsonb);
end $$;

create or replace function public.fin_set_price(p_plan text, p_period text, p_amount_kurus integer, p_days integer, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
declare o record;
begin
  if not public.fin_ok() then raise exception 'yetki yok' using errcode = '42501'; end if;
  if p_amount_kurus < 100 or p_amount_kurus > 10000000 or p_days < 1 or p_days > 730 then raise exception 'fiyat ya da süre geçersiz'; end if;
  select * into o from public.plan_prices where plan = p_plan and period = p_period;
  insert into public.plan_prices (plan, period, amount_kurus, days, active, updated_at) values (p_plan, p_period, p_amount_kurus, p_days, p_active, now())
  on conflict (plan, period) do update set amount_kurus = excluded.amount_kurus, days = excluded.days, active = excluded.active, updated_at = now();
  perform public.fin_log('fin_price', p_plan || ' · ' || p_period, json_build_object('once', case when o is null then null else json_build_object('kurus', o.amount_kurus, 'gun', o.days, 'aktif', o.active) end, 'sonra', json_build_object('kurus', p_amount_kurus, 'gun', p_days, 'aktif', p_active))::jsonb);
end $$;

-- --------------------------------------------------------------------------
-- 6. Kampanya kodları
-- --------------------------------------------------------------------------
create or replace function public.fin_coupons()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.fin_ok() then raise exception 'yetki yok' using errcode = '42501'; end if;
  return coalesce((select json_agg(json_build_object('code', c.code, 'label', c.label, 'percent_off', c.percent_off, 'max_uses', c.max_uses, 'used_count', c.used_count,
      'valid_until', c.valid_until, 'active', c.active, 'personal', c.only_user is not null, 'created_at', c.created_at,
      'paid', (select count(*) from public.payment_orders o where o.coupon = c.code and o.status = 'paid'),
      'revenue_kurus', coalesce((select sum(o.amount_kurus) from public.payment_orders o where o.coupon = c.code and o.status = 'paid'), 0),
      'discount_kurus', coalesce((select sum(o.list_kurus - o.amount_kurus) from public.payment_orders o where o.coupon = c.code and o.status = 'paid'), 0))
    order by c.created_at desc) from public.payment_coupons c), '[]'::json);
end $$;

create or replace function public.fin_upsert_coupon(p_code text, p_label text, p_percent integer, p_max_uses integer, p_valid_until timestamptz, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v text := upper(trim(p_code));
begin
  if not public.fin_ok() then raise exception 'yetki yok' using errcode = '42501'; end if;
  if v !~ '^[A-Z0-9]{3,24}$' then raise exception 'kod 3–24 harf/rakam olmalı'; end if;
  if p_percent < 1 or p_percent > 90 then raise exception 'indirim %%1–90 arası olmalı'; end if;
  insert into public.payment_coupons (code, label, percent_off, max_uses, valid_until, active) values (v, nullif(trim(p_label), ''), p_percent, p_max_uses, p_valid_until, p_active)
  on conflict (code) do update set label = excluded.label, percent_off = excluded.percent_off, max_uses = excluded.max_uses, valid_until = excluded.valid_until, active = excluded.active;
  perform public.fin_log('fin_coupon', v, json_build_object('yuzde', p_percent, 'en_cok', p_max_uses, 'bitis', p_valid_until, 'aktif', p_active)::jsonb);
end $$;

-- --------------------------------------------------------------------------
-- 7. Sınıra yaklaşanlar: finans rolü kimliği görmez (baş harfler), yönetici görür
-- --------------------------------------------------------------------------
create or replace function public.fin_quota_watch()
returns json language plpgsql stable security definer set search_path = public as $$
declare adm boolean := public.current_is_admin();
begin
  if not public.fin_ok() then raise exception 'yetki yok' using errcode = '42501'; end if;
  return coalesce((select json_agg(x order by x.ratio desc) from (
    select case when adm then s.user_id end as user_id,
      case when adm then p.full_name else regexp_replace(coalesce(p.full_name, '?'), '(\S)\S*', '\1.', 'g') end as who,
      p.department, pl.plan, s.pages_used, l.monthly_pages, round(s.pages_used::numeric / nullif(l.monthly_pages, 0), 3) ratio
    from public.summary_usage s
    join public.profiles p on p.id = s.user_id
    cross join lateral (select coalesce((select up.plan from public.user_plans up where up.user_id = s.user_id and (up.valid_until is null or up.valid_until > now())), 'lite') plan) pl
    join public.plan_limits l on l.plan = pl.plan
    where s.period = date_trunc('month', now())::date and l.monthly_pages > 0 and s.pages_used >= 0.7 * l.monthly_pages
    order by ratio desc limit 50) x), '[]'::json);
end $$;

-- yalnız YÖNETİCİ: bir öğrenciye N gün plan ver/uzat (sınav haftası desteği, hata telafisi)
create or replace function public.fin_grant_plan(p_user uuid, p_plan text, p_days integer, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare cur timestamptz;
begin
  if not public.current_is_admin() then raise exception 'yetki yok' using errcode = '42501'; end if;
  if p_days < 1 or p_days > 365 then raise exception 'gün 1–365 arası olmalı'; end if;
  if not exists (select 1 from public.plan_limits where plan = p_plan) then raise exception 'plan yok'; end if;
  select valid_until into cur from public.user_plans where user_id = p_user and plan = p_plan;
  insert into public.user_plans (user_id, plan, valid_until, updated_at) values (p_user, p_plan, greatest(coalesce(cur, now()), now()) + make_interval(days => p_days), now())
  on conflict (user_id) do update set plan = excluded.plan, valid_until = excluded.valid_until, updated_at = now();
  insert into public.admin_audit_log (actor_id, actor_name, action, target_user_id, target_label, details)
  values (auth.uid(), (select full_name from public.profiles where id = auth.uid()), 'fin_grant_plan', p_user, (select full_name from public.profiles where id = p_user),
    json_build_object('plan', p_plan, 'gun', p_days, 'neden', left(coalesce(p_reason, ''), 200))::jsonb);
end $$;

-- --------------------------------------------------------------------------
-- 8. Finans erişimi (yalnız yönetici)
-- --------------------------------------------------------------------------
create or replace function public.fin_staff()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.current_is_admin() then raise exception 'yetki yok' using errcode = '42501'; end if;
  return coalesce((select json_agg(json_build_object('user_id', r.user_id, 'name', p.full_name, 'email', p.email, 'role', r.role, 'granted_at', r.granted_at) order by r.granted_at)
    from public.staff_roles r left join public.profiles p on p.id = r.user_id), '[]'::json);
end $$;

create or replace function public.fin_set_staff(p_email text, p_on boolean)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid; nm text;
begin
  if not public.current_is_admin() then raise exception 'yetki yok' using errcode = '42501'; end if;
  select id, full_name into uid, nm from public.profiles where lower(email) = lower(trim(p_email)) limit 1;
  if uid is null then raise exception 'Bu e-postayla kayıtlı bir Acadex hesabı yok. Kişi önce acadex.com.tr''de hesap açmalı.'; end if;
  if p_on then
    insert into public.staff_roles (user_id, role, granted_by) values (uid, 'finans', auth.uid()) on conflict (user_id) do update set role = 'finans', granted_by = auth.uid(), granted_at = now();
  else
    delete from public.staff_roles where user_id = uid;
  end if;
  insert into public.admin_audit_log (actor_id, actor_name, action, target_user_id, target_label, details)
  values (auth.uid(), (select full_name from public.profiles where id = auth.uid()), case when p_on then 'fin_role_grant' else 'fin_role_revoke' end, uid, nm, '{}'::jsonb);
  return json_build_object('user_id', uid, 'name', nm);
end $$;

-- --------------------------------------------------------------------------
-- 9. Yetkiler
-- --------------------------------------------------------------------------
revoke all on function public.current_is_finance() from public, anon;
revoke all on function public.fin_ok() from public, anon;
revoke all on function public.fin_log(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.fin_overview() from public, anon;
revoke all on function public.fin_history(integer) from public, anon;
revoke all on function public.fin_set_limit(text, integer, integer, boolean) from public, anon;
revoke all on function public.fin_set_price(text, text, integer, integer, boolean) from public, anon;
revoke all on function public.fin_coupons() from public, anon;
revoke all on function public.fin_upsert_coupon(text, text, integer, integer, timestamptz, boolean) from public, anon;
revoke all on function public.fin_quota_watch() from public, anon;
revoke all on function public.fin_grant_plan(uuid, text, integer, text) from public, anon;
revoke all on function public.fin_staff() from public, anon;
revoke all on function public.fin_set_staff(text, boolean) from public, anon;
grant execute on function public.current_is_finance(), public.fin_ok(), public.fin_overview(), public.fin_history(integer), public.fin_set_limit(text, integer, integer, boolean),
  public.fin_set_price(text, text, integer, integer, boolean), public.fin_coupons(), public.fin_upsert_coupon(text, text, integer, integer, timestamptz, boolean),
  public.fin_quota_watch(), public.fin_grant_plan(uuid, text, integer, text), public.fin_staff(), public.fin_set_staff(text, boolean) to authenticated;
