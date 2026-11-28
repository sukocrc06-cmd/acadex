-- ==========================================================================
-- ACADEX SUNUM — #58 Phase 12.1 / 12.2: MARKA KİTLERİ + HEDEF KİTLE VARSAYILANI
-- (28.11.2026)
--
-- brand_kits: kullanıcının marka kitleri (≤10). Renk rolleri, yazı tipleri ve
-- logolar `veri` jsonb'sinde; logolar istemcide doğrulanmış (PNG/JPEG/WebP,
-- etkin içerikli SVG reddedilir, SVG de PNG'ye çevrilir) ≤480 px data URL. Ayrı depolama kovası yok — sunumdaki görseller de
-- data URL olarak saklanıyor (aynı desen, ikinci altyapı yok).
-- Kit silinince desteler etkilenmez: deste uyguladığı değerlerin kopyasını
-- (presentation_slides.content.marka + .tema) kendisi taşır; kit değişince
-- desteler kendiliğinden güncellenmez.
--
-- presentation_user_prefs: kullanıcının varsayılan hedef kitle profili
-- (isteğe bağlı). Deste profili ayrıca content.kitle'de; paylaşım görüntüsüne
-- (share_snapshot) girmez.
--
-- RLS: yalnız sahibi. Misafir (anonim JWT) yazamaz: 20261111c deseni.
-- Elle çalıştırılır (Supabase SQL Editor). Test: tests/sunum-marka-kiti.js
-- (PGLITE_DIR verilirse bu dosya gerçek Postgres'te RLS ile sınanır).
-- ==========================================================================

create table if not exists public.brand_kits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ad text not null check (char_length(btrim(ad)) between 1 and 60),
  marka text not null default '' check (char_length(marka) <= 60),
  aciklama text not null default '' check (char_length(aciklama) <= 300),
  varsayilan boolean not null default false,
  surum integer not null default 1 check (surum between 1 and 100000),
  veri jsonb not null default '{}'::jsonb check (jsonb_typeof(veri) = 'object' and octet_length(veri::text) <= 1500000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists brand_kits_user_idx on public.brand_kits (user_id, updated_at desc);
-- tek varsayılan kit
create unique index if not exists brand_kits_tek_varsayilan on public.brand_kits (user_id) where varsayilan;

-- kullanıcı başına en çok 10 kit; sahibi değiştirilemez
create or replace function public.brand_kits_sinir()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.brand_kits where user_id = new.user_id) >= 10 then
      raise exception 'brand_kits: en cok 10 kit' using errcode = 'check_violation';
    end if;
  elsif new.user_id is distinct from old.user_id then
    raise exception 'brand_kits: sahip degistirilemez' using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists brand_kits_sinir on public.brand_kits;
create trigger brand_kits_sinir before insert or update on public.brand_kits
  for each row execute function public.brand_kits_sinir();

alter table public.brand_kits enable row level security;
drop policy if exists brand_kits_sahip on public.brand_kits;
create policy brand_kits_sahip on public.brand_kits for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists zz_misafir_ekleyemez on public.brand_kits;
create policy zz_misafir_ekleyemez on public.brand_kits as restrictive for insert to authenticated with check (not public.misafir_mi());
drop policy if exists zz_misafir_degistiremez on public.brand_kits;
create policy zz_misafir_degistiremez on public.brand_kits as restrictive for update to authenticated using (not public.misafir_mi());
drop policy if exists zz_misafir_silemez on public.brand_kits;
create policy zz_misafir_silemez on public.brand_kits as restrictive for delete to authenticated using (not public.misafir_mi());

create table if not exists public.presentation_user_prefs (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  kitle jsonb check (kitle is null or (jsonb_typeof(kitle) = 'object' and octet_length(kitle::text) <= 4000)),
  updated_at timestamptz not null default now()
);
alter table public.presentation_user_prefs enable row level security;
drop policy if exists presentation_user_prefs_sahip on public.presentation_user_prefs;
create policy presentation_user_prefs_sahip on public.presentation_user_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists zz_misafir_ekleyemez on public.presentation_user_prefs;
create policy zz_misafir_ekleyemez on public.presentation_user_prefs as restrictive for insert to authenticated with check (not public.misafir_mi());
drop policy if exists zz_misafir_degistiremez on public.presentation_user_prefs;
create policy zz_misafir_degistiremez on public.presentation_user_prefs as restrictive for update to authenticated using (not public.misafir_mi());
drop policy if exists zz_misafir_silemez on public.presentation_user_prefs;
create policy zz_misafir_silemez on public.presentation_user_prefs as restrictive for delete to authenticated using (not public.misafir_mi());

revoke all on public.brand_kits, public.presentation_user_prefs from anon;
grant select, insert, update, delete on public.brand_kits, public.presentation_user_prefs to authenticated;
