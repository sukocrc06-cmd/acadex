-- Acadex English içerik havuzu (05.11.2026)
-- Defne Hoca ve alıştırmalar için yapay zekânın ürettiği metin, soru seti, dikte
-- cümlesi, kelime ve sözlük kartları burada birikir. Herkes önce görmediğini alır;
-- havuz büyüdükçe Groq'a daha az gidilir (ücretsiz katman korunur).
-- Yazma yalnız supabase/functions/ingilizce-hoca (service role) üzerinden.
-- Supabase SQL Editor'de bir kez çalıştır; tekrar çalıştırmak zararsız.

create table if not exists public.ing_icerik (
  id uuid primary key default gen_random_uuid(),
  tur text not null check (tur in ('okuma', 'dikte', 'kelime', 'sohbet', 'yazi_konu', 'test', 'deste', 'sozluk')),
  alt text not null default '',          -- test için alıştırma kimliği (ör. writing:hata), sözlük için kelime
  seviye text not null default 'B1-B2',
  veri jsonb not null,
  olusturan uuid references auth.users(id) on delete set null,
  kullanim integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ing_icerik_tur_alt on public.ing_icerik (tur, alt, seviye);
create unique index if not exists ing_icerik_sozluk_tek on public.ing_icerik (alt) where tur = 'sozluk';
create index if not exists ing_icerik_olusturan_gun on public.ing_icerik (olusturan, created_at);

create table if not exists public.ing_gorulen (
  user_id uuid not null references auth.users(id) on delete cascade,
  icerik_id uuid not null references public.ing_icerik(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, icerik_id)
);

alter table public.ing_icerik enable row level security;
alter table public.ing_gorulen enable row level security;

drop policy if exists ing_icerik_oku on public.ing_icerik;
create policy ing_icerik_oku on public.ing_icerik for select to authenticated using (true);

drop policy if exists ing_gorulen_kendi on public.ing_gorulen;
create policy ing_gorulen_kendi on public.ing_gorulen for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- çağıranın görmediği bir içerik: seçer, "görüldü" işaretler, kullanım sayar
create or replace function public.ing_icerik_al(p_tur text, p_alt text default '', p_seviye text default 'B1-B2')
returns table (id uuid, veri jsonb)
language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; v_veri jsonb; v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  select i.id, i.veri into v_id, v_veri
    from ing_icerik i
   where i.tur = p_tur and i.alt = coalesce(p_alt, '') and i.seviye = coalesce(p_seviye, 'B1-B2')
     and not exists (select 1 from ing_gorulen g where g.user_id = v_uid and g.icerik_id = i.id)
   order by random() limit 1;
  if v_id is null then return; end if;
  insert into ing_gorulen (user_id, icerik_id) values (v_uid, v_id) on conflict do nothing;
  update ing_icerik set kullanim = kullanim + 1 where ing_icerik.id = v_id;
  return query select v_id, v_veri;
end $$;
revoke all on function public.ing_icerik_al(text, text, text) from public;
grant execute on function public.ing_icerik_al(text, text, text) to authenticated;
