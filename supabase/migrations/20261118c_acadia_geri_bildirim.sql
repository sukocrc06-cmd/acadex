-- ==========================================================================
-- ACADIA GERİ BİLDİRİM (20261118c_acadia_geri_bildirim.sql), 18.11.2026
--
-- Kaynakla çalış sohbetinde (chat-with-document) her cevabın altında 👍 / 👎 var;
-- cevap veremediği sorular da (sunucu hatası) kendiliğinden buraya düşer.
-- Yönetim paneli → "Acadia geri bildirim" bu tabloyu listeler; amaç Acadia'nın
-- neyi cevaplayamadığını görüp iyileştirmek.
--
-- Yetki:
--   öğrenci  : yalnız KENDİ satırını ekler, görür, puanını değiştirir
--   yönetici : hepsini görür ve siler (admin_ok())
-- Saklama: soru 2.000, cevap 4.000 karakterle sınırlı; 180 günden eski satırlar
-- acadia_geri_bildirim_temizle() ile silinir (yönetim panelindeki düğme çağırır).
--
-- Tekrar çalıştırılabilir (if not exists / create or replace / drop policy if exists).
-- ==========================================================================

create table if not exists public.acadia_geri_bildirim (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  study_card_id uuid references public.study_cards(id) on delete set null,
  kaynak        text not null default 'kaynak' check (kaynak in ('kaynak', 'kart')),
  soru          text not null check (char_length(soru) between 1 and 2000),
  cevap         text check (cevap is null or char_length(cevap) <= 4000),
  puan          smallint check (puan is null or puan in (-1, 1)),
  hata          text check (hata is null or char_length(hata) <= 500),
  model         text check (model is null or char_length(model) <= 80),
  yol           text check (yol is null or char_length(yol) <= 80),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint acadia_gb_icerik check (puan is not null or hata is not null)
);

create index if not exists acadia_gb_zaman on public.acadia_geri_bildirim (created_at desc);
create index if not exists acadia_gb_kullanici on public.acadia_geri_bildirim (user_id, created_at desc);

alter table public.acadia_geri_bildirim enable row level security;

drop policy if exists acadia_gb_ekle on public.acadia_geri_bildirim;
create policy acadia_gb_ekle on public.acadia_geri_bildirim
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists acadia_gb_oku on public.acadia_geri_bildirim;
create policy acadia_gb_oku on public.acadia_geri_bildirim
  for select to authenticated
  using (user_id = auth.uid() or public.admin_ok());

drop policy if exists acadia_gb_puan on public.acadia_geri_bildirim;
create policy acadia_gb_puan on public.acadia_geri_bildirim
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists acadia_gb_sil on public.acadia_geri_bildirim;
create policy acadia_gb_sil on public.acadia_geri_bildirim
  for delete to authenticated
  using (public.admin_ok());

-- öğrenci yalnız puanı değiştirebilir; soru, cevap, sahip ve tarih sabit kalır
create or replace function public.acadia_gb_koru()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.admin_ok() then
    new.user_id := old.user_id;
    new.study_card_id := old.study_card_id;
    new.kaynak := old.kaynak;
    new.soru := old.soru;
    new.cevap := old.cevap;
    new.hata := old.hata;
    new.model := old.model;
    new.yol := old.yol;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists acadia_gb_koru on public.acadia_geri_bildirim;
create trigger acadia_gb_koru
  before update on public.acadia_geri_bildirim
  for each row execute function public.acadia_gb_koru();

-- 180 günden eski satırları siler; yalnız yönetici
create or replace function public.acadia_geri_bildirim_temizle()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  if not public.admin_ok() then
    raise exception 'yalnız yönetici' using errcode = '42501';
  end if;
  delete from public.acadia_geri_bildirim where created_at < now() - interval '180 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.acadia_geri_bildirim_temizle() from public, anon;
grant execute on function public.acadia_geri_bildirim_temizle() to authenticated;

grant select, insert, update, delete on public.acadia_geri_bildirim to authenticated;
revoke all on public.acadia_geri_bildirim from anon;
