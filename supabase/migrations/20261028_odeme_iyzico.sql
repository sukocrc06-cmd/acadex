-- ==========================================================================
-- Acadex: Ödeme (iyzico Checkout Form) — paket fiyatları ve siparişler
-- 28.10.2026, test raporu R91 ("ödeme sayfası yok").
--
-- Bu migration OTOMATİK UYGULANMAZ: Supabase Studio → SQL Editor'a yapıştırıp
-- çalıştırın. 20261019_ozet_cache_ve_kota.sql'den SONRA çalışmalı
-- (plan_limits ve user_plans tablolarını kullanır).
--
-- MODEL: abonelik değil, ÖN ÖDEMELİ dönem. Kullanıcı 1 ay / 1 dönem / 1 yıl
-- (ya da 7 günlük sınav haftası) satın alır; ödeme doğrulanınca
-- user_plans.valid_until o kadar uzar. Süre bitince plan kendiliğinden
-- düşer (summarize-document zaten "valid_until geçmişse lite say" kuralını
-- uyguluyor). Otomatik yenileme (iyzico Abonelik ürünü) ayrıca açılabilir.
--
-- GÜVENLİK: fiyat TARAYICIDAN ALINMAZ; sunucu plan_prices'tan okur. Siparişleri
-- ve planı yalnızca `odeme` Edge Function'ı (service role) yazar. Kullanıcı
-- kendi siparişlerini OKUYABİLİR, değiştiremez.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. Ücretsiz plan (satış sayfasındaki "Ücretsiz" paket). user_plans satırı
--    olmayan kullanıcı bugün 'lite' sayılıyor; bu davranışa dokunulmadı.
--    Limitleri satış sayfasıyla eşitlemek bir İŞ KARARI olduğu için aşağıda
--    ayrı ve yorum satırında duruyor (bkz. bölüm 5).
-- --------------------------------------------------------------------------
insert into public.plan_limits (plan, monthly_pages, max_pages_per_doc, visual_analysis)
values ('free', 100, 25, false)
on conflict (plan) do nothing;

-- --------------------------------------------------------------------------
-- 2. Fiyat listesi (KDV dahil, kuruş). Değiştirmek için deploy gerekmez.
--    period: month | term | year | week ; days: valid_until'e eklenecek gün
-- --------------------------------------------------------------------------
create table if not exists public.plan_prices (
  plan          text not null references public.plan_limits(plan),
  period        text not null check (period in ('month', 'term', 'year', 'week')),
  amount_kurus  integer not null check (amount_kurus > 0),
  days          integer not null check (days > 0),
  active        boolean not null default true,
  updated_at    timestamptz not null default now(),
  primary key (plan, period)
);

insert into public.plan_prices (plan, period, amount_kurus, days) values
  ('lite',    'month',  11900,  30),
  ('lite',    'term',   41900, 120),
  ('lite',    'year',  106900, 365),
  ('premium', 'month',  22900,  30),
  ('premium', 'term',   79900, 120),
  ('premium', 'year',  204900, 365),
  ('premium', 'week',    5900,   7)
on conflict (plan, period) do nothing;

alter table public.plan_prices enable row level security;
drop policy if exists "plan_prices herkese okunur" on public.plan_prices;
create policy "plan_prices herkese okunur"
  on public.plan_prices for select
  to anon, authenticated
  using (true);

-- --------------------------------------------------------------------------
-- 3. İndirim kuponları (ör. beta kurucu üyeleri %50)
-- --------------------------------------------------------------------------
create table if not exists public.payment_coupons (
  code          text primary key,                 -- büyük harf, ör. KURUCU50
  percent_off   integer not null check (percent_off between 1 and 90),
  only_user     uuid references auth.users(id) on delete cascade,  -- null = herkes
  max_uses      integer,                          -- null = sınırsız
  used_count    integer not null default 0,
  valid_until   timestamptz,
  active        boolean not null default true
);
alter table public.payment_coupons enable row level security;
-- kimse doğrudan okuyamaz; kontrolü Edge Function yapar (kod listesi sızmasın)

-- --------------------------------------------------------------------------
-- 4. Siparişler
-- --------------------------------------------------------------------------
create table if not exists public.payment_orders (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  plan                text not null,
  period              text not null,
  days                integer not null,
  amount_kurus        integer not null,             -- indirimden sonra ödenecek
  list_kurus          integer not null,             -- liste fiyatı
  coupon              text,
  currency            text not null default 'TRY',
  locale              text not null default 'tr',
  provider            text not null default 'iyzico',
  provider_token      text unique,                  -- CF initialize token
  provider_payment_id text unique,                  -- ödeme başarılıysa
  status              text not null default 'pending'
                        check (status in ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  fail_reason         text,
  return_url          text,                         -- ödeme sonrası dönülecek site (izinli listeden)
  plan_from           timestamptz,                  -- uygulanan dönem
  plan_until          timestamptz,
  created_at          timestamptz not null default now(),
  paid_at             timestamptz
);
create index if not exists payment_orders_user_idx on public.payment_orders (user_id, created_at desc);

alter table public.payment_orders enable row level security;
drop policy if exists "payment_orders kendi siparisini okur" on public.payment_orders;
create policy "payment_orders kendi siparisini okur"
  on public.payment_orders for select
  to authenticated
  using (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- 5. (İSTEĞE BAĞLI — iş kararı) Limitleri satış sayfasıyla eşitle.
--    Satış sayfası: Ücretsiz 4 belge × 25 sayfa, Lite 20 × 60, Premium 50 × 150.
--    Bugünkü değerler: lite 300 sayfa/ay, belge başı 150; premium 5000 / 1000.
--    Aşağıyı açmak LİTE KULLANICILARIN belge başı sınırını 150'den 60'a indirir.
-- --------------------------------------------------------------------------
-- update public.plan_limits set monthly_pages = 1200, max_pages_per_doc = 60,  updated_at = now() where plan = 'lite';
-- update public.plan_limits set monthly_pages = 7500, max_pages_per_doc = 150, updated_at = now() where plan = 'premium';
