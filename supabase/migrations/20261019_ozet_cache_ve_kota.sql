-- ==========================================================================
-- Acadex: Ozet cache'i + Lite/Premium kotasi (19.10.2026)
--
-- NEDEN: summarize-document her yuklemede belgeyi bastan modele gonderiyor.
-- Ogrenciler ayni ders kitabini / ayni slayti yukluyor; ayni dosya her
-- seferinde yeniden ucretlendiriliyor. Ucretli Gemini katmanina gecildiginde
-- (7.000 kullanici hedefi) faturayi en cok dusuren iki sey:
--
--   1. summary_cache — ayni dosya (SHA-256) + ayni ayarlar bir kez ozetlenir,
--      sonraki yuklemeler kaydi kopyalar. Model cagrisi yok, maliyet sifir.
--   2. Kota — Lite/Premium plana gore aylik sayfa ve belge basina sayfa
--      siniri. Limitler plan_limits tablosunda; degistirmek icin deploy
--      gerekmez, satiri guncellemek yeter.
--
-- Tum tablolar yalnizca edge function (service role) tarafindan yazilir.
-- Kullanici kendi planini/kullanimini OKUYABILIR ama DEGISTIREMEZ — plan
-- bilgisi bu yuzden profiles'a degil ayri tabloya kondu (profiles'i
-- kullanici kendisi guncelleyebiliyor).
--
-- Fonksiyon bu migration olmadan da calisir: tablo yoksa cache ve kota
-- adimlari loga uyari yazip atlanir (en iyi gayret).
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. Plan limitleri (yonetici ayarlar)
-- --------------------------------------------------------------------------
create table if not exists public.plan_limits (
  plan               text primary key,
  monthly_pages      integer not null,  -- ayda ozetlenebilecek toplam sayfa
  max_pages_per_doc  integer not null,  -- tek belgede izin verilen en fazla sayfa
  visual_analysis    boolean not null default false,
  updated_at         timestamptz not null default now()
);

insert into public.plan_limits (plan, monthly_pages, max_pages_per_doc, visual_analysis)
values
  ('lite',    300,  150,  false),
  ('premium', 5000, 1000, true)
on conflict (plan) do nothing;

alter table public.plan_limits enable row level security;

drop policy if exists "plan_limits herkese okunur" on public.plan_limits;
create policy "plan_limits herkese okunur"
  on public.plan_limits for select
  to authenticated
  using (true);

-- --------------------------------------------------------------------------
-- 2. Kullanicinin plani (satiri olmayan kullanici = lite)
-- --------------------------------------------------------------------------
create table if not exists public.user_plans (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  plan        text not null default 'lite' references public.plan_limits(plan),
  valid_until timestamptz,              -- null = suresiz; gecmisse lite sayilir
  updated_at  timestamptz not null default now()
);

alter table public.user_plans enable row level security;

drop policy if exists "user_plans kendi satirini okur" on public.user_plans;
create policy "user_plans kendi satirini okur"
  on public.user_plans for select
  to authenticated
  using (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- 3. Aylik kullanim
-- --------------------------------------------------------------------------
create table if not exists public.summary_usage (
  user_id      uuid not null references auth.users(id) on delete cascade,
  period       date not null,           -- ayin ilk gunu
  pages_used   integer not null default 0,
  docs_used    integer not null default 0,
  cache_hits   integer not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (user_id, period)
);

alter table public.summary_usage enable row level security;

drop policy if exists "summary_usage kendi satirini okur" on public.summary_usage;
create policy "summary_usage kendi satirini okur"
  on public.summary_usage for select
  to authenticated
  using (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- 4. Ozet cache'i
--
-- cache_key = sha256(dosya) : dil : stil : uzunluk : gorsel : surum
-- Surum (edge function'daki SUMMARY_CACHE_VERSION) prompt/hat degisince
-- arttirilir; eski kayitlar kendiliginden kullanilmaz hale gelir.
--
-- card: study_cards'a yazilan payload, belgeye/kullaniciya ozel alanlar
-- (document_id, user_id, course_tag) CIKARILMIS hali.
--
-- RLS acik ve hic policy yok: yalnizca service role okur/yazar. Bir
-- kullanici baskasinin ozetini ancak AYNI dosyayi yukleyerek alabilir.
-- --------------------------------------------------------------------------
create table if not exists public.summary_cache (
  cache_key     text primary key,
  content_hash  text not null,
  page_count    integer,
  card          jsonb not null,
  hit_count     integer not null default 0,
  created_at    timestamptz not null default now(),
  last_hit_at   timestamptz
);

create index if not exists summary_cache_content_hash_idx
  on public.summary_cache (content_hash);

alter table public.summary_cache enable row level security;

-- --------------------------------------------------------------------------
-- 5. RPC'ler (yalnizca service role cagirir)
-- --------------------------------------------------------------------------

-- Kullanicinin gecerli planini, limitlerini ve bu ayki kullanimini dondurur.
-- Belge yuklenmeden ONCE okunur; kullanim ancak ozet BASARIYLA kaydedilince
-- yazilir (record_summary_usage), boylece basarisiz kosu kotadan dusmez.
create or replace function public.get_summary_quota(p_user uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with plan_row as (
    select coalesce(
      (select up.plan from public.user_plans up
        where up.user_id = p_user
          and (up.valid_until is null or up.valid_until > now())),
      'lite'
    ) as plan
  )
  select jsonb_build_object(
    'plan',              pl.plan,
    'monthly_pages',     pl.monthly_pages,
    'max_pages_per_doc', pl.max_pages_per_doc,
    'visual_analysis',   pl.visual_analysis,
    'pages_used',        coalesce(su.pages_used, 0),
    'docs_used',         coalesce(su.docs_used, 0)
  )
  from plan_row pr
  join public.plan_limits pl on pl.plan = pr.plan
  left join public.summary_usage su
    on su.user_id = p_user
   and su.period = date_trunc('month', now())::date;
$$;

create or replace function public.record_summary_usage(
  p_user uuid,
  p_pages integer,
  p_cache_hit boolean default false
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.summary_usage (user_id, period, pages_used, docs_used, cache_hits)
  values (
    p_user,
    date_trunc('month', now())::date,
    greatest(p_pages, 0),
    1,
    case when p_cache_hit then 1 else 0 end
  )
  on conflict (user_id, period) do update
    set pages_used = public.summary_usage.pages_used + excluded.pages_used,
        docs_used  = public.summary_usage.docs_used + 1,
        cache_hits = public.summary_usage.cache_hits + excluded.cache_hits,
        updated_at = now();
$$;

create or replace function public.touch_summary_cache(p_key text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.summary_cache
     set hit_count = hit_count + 1,
         last_hit_at = now()
   where cache_key = p_key;
$$;

revoke all on function public.get_summary_quota(uuid) from public, anon, authenticated;
revoke all on function public.record_summary_usage(uuid, integer, boolean) from public, anon, authenticated;
revoke all on function public.touch_summary_cache(text) from public, anon, authenticated;
grant execute on function public.get_summary_quota(uuid) to service_role;
grant execute on function public.record_summary_usage(uuid, integer, boolean) to service_role;
grant execute on function public.touch_summary_cache(text) to service_role;
