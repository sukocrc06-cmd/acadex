-- Acadex Kids · çocuk ve öğretmen girişi, günün konusu, ilerleme (10.11.2026)
-- acadex.com.tr/kids bu fonksiyonları Supabase hesabı OLMADAN (anon) çağırır.
-- Önce 20261110_kids_yonetim.sql çalışmış olmalı.
--
-- Akış:
--   Çocuk:    kids_okul_bul(kod) → sınıfını ve resmini seçer → kids_giris(öğrenci, 2 resim)
--             → oturum anahtarı (90 gün) → kids_durum / kids_ilerleme_koy
--   Öğretmen: kids_ogretmen_giris(kod, şifre) → oturum anahtarı (14 gün)
--             → kids_ogretmen_veri (sınıflar, plan, ilerleme) / kids_plan_koy
-- Kurallar:
--   * Oturum anahtarının yalnız SHA-256 özeti saklanır.
--   * Deneme sınırı: çocukta 5 yanlışta 5 dakika, öğretmende 5 yanlışta 15 dakika kilit.
--   * Lisansı kapalı ya da süresi dolmuş okul giremez; pasif öğrenci giremez.
--   * Öğretmen yalnız kendi okulunun sınıflarını görür; ilerleme verisi 64 KB ile sınırlı.
--   * Tablolar dışarıya kapalı; her şey fonksiyonlardan geçer.
-- Supabase SQL Editor'da elle çalıştırılır; tekrar çalıştırmak güvenlidir.

alter table public.kids_ogrenciler add column if not exists hata_sayi integer not null default 0;
alter table public.kids_ogrenciler add column if not exists kilit_bitis timestamptz;
alter table public.kids_okullar add column if not exists sifre_hata integer not null default 0;
alter table public.kids_okullar add column if not exists sifre_kilit timestamptz;

create table if not exists public.kids_oturumlar (
  ozet         text primary key,                    -- sha256(anahtar), hex
  tur          text not null check (tur in ('cocuk', 'ogretmen')),
  okul_id      uuid not null references public.kids_okullar(id) on delete cascade,
  ogrenci_id   uuid references public.kids_ogrenciler(id) on delete cascade,
  son_kullanma timestamptz not null,
  created_at   timestamptz not null default now(),
  constraint kids_oturum_tur check ((tur = 'cocuk') = (ogrenci_id is not null))
);
create index if not exists kids_oturumlar_son on public.kids_oturumlar (son_kullanma);

create table if not exists public.kids_plan (
  sinif_id  uuid not null references public.kids_siniflar(id) on delete cascade,
  gun       date not null,
  konu      text not null check (konu in ('', 'colours', 'numbers', 'animals', 'family', 'body', 'food', 'toys', 'clothes', 'home', 'school', 'weather', 'feelings')),   -- '' = serbest gün
  updated_at timestamptz not null default now(),
  primary key (sinif_id, gun)
);

create table if not exists public.kids_ilerleme (
  ogrenci_id uuid primary key references public.kids_ogrenciler(id) on delete cascade,
  veri       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint kids_ilerleme_boyut check (pg_column_size(veri) < 65536)
);

do $$ declare t text; begin
  foreach t in array array['kids_oturumlar', 'kids_plan', 'kids_ilerleme'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- --------------------------------------------------------------------------
-- yardımcılar (dışarıya kapalı)
-- --------------------------------------------------------------------------
create or replace function public.kids_ozet(p text)
returns text language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(coalesce(p, ''), 'sha256'), 'hex')
$$;

create or replace function public.kids_okul_acik(p_okul uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from kids_okullar where id = p_okul and aktif and current_date <= lisans_bit)
$$;

create or replace function public.kids_oturum_ac(p_tur text, p_okul uuid, p_ogrenci uuid, p_gun integer)
returns text language plpgsql volatile security definer set search_path = public, extensions as $$
declare a text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  delete from kids_oturumlar where son_kullanma < now();
  insert into kids_oturumlar (ozet, tur, okul_id, ogrenci_id, son_kullanma) values (public.kids_ozet(a), p_tur, p_okul, p_ogrenci, now() + make_interval(days => p_gun));
  return a;
end $$;

-- geçerli oturumun satırı; yoksa ya da okul kapalıysa hata
create or replace function public.kids_oturum(p_token text, p_tur text)
returns public.kids_oturumlar language plpgsql stable security definer set search_path = public as $$
declare o kids_oturumlar;
begin
  select * into o from kids_oturumlar where ozet = public.kids_ozet(p_token) and tur = p_tur and son_kullanma > now();
  if o.ozet is null then raise exception 'oturum yok' using errcode = '28000', hint = 'oturum'; end if;
  if not public.kids_okul_acik(o.okul_id) then raise exception 'Okulunuzun Acadex Kids lisansı açık değil.' using errcode = '28000', hint = 'lisans'; end if;
  if p_tur = 'cocuk' and not exists (select 1 from kids_ogrenciler where id = o.ogrenci_id and aktif) then raise exception 'oturum yok' using errcode = '28000', hint = 'oturum'; end if;
  return o;
end $$;

-- --------------------------------------------------------------------------
-- çocuk
-- --------------------------------------------------------------------------
create or replace function public.kids_okul_bul(p_kod text)
returns json language plpgsql stable security definer set search_path = public as $$
declare o kids_okullar;
begin
  select * into o from kids_okullar where kod = upper(trim(coalesce(p_kod, '')));
  if o.id is null then raise exception 'Bu kodu bulamadım.' using errcode = 'P0002', hint = 'yok'; end if;
  if not public.kids_okul_acik(o.id) then raise exception 'Okulunuzun Acadex Kids lisansı açık değil.' using errcode = '28000', hint = 'lisans'; end if;
  return json_build_object('kod', o.kod, 'ad', o.ad, 'siniflar', coalesce((select json_agg(json_build_object('id', s.id, 'ad', s.ad, 'bant', s.bant,
      'ogr', coalesce((select json_agg(json_build_object('id', g.id, 'ad', g.ad, 'hayvan', g.hayvan) order by g.ad, g.no) from kids_ogrenciler g where g.sinif_id = s.id and g.aktif), '[]'::json))
    order by s.created_at) from kids_siniflar s where s.okul_id = o.id), '[]'::json));
end $$;

create or replace function public.kids_giris(p_ogrenci uuid, p_sifre text[])
returns json language plpgsql volatile security definer set search_path = public as $$
declare g kids_ogrenciler;
begin
  select * into g from kids_ogrenciler where id = p_ogrenci and aktif for update;
  if g.id is null or not public.kids_okul_acik(g.okul_id) then raise exception 'Giriş yapılamadı.' using errcode = '28000', hint = 'yok'; end if;
  if g.kilit_bitis > now() then raise exception 'Biraz dinlenelim; birkaç dakika sonra yeniden dene.' using errcode = '28000', hint = 'kilit'; end if;
  if p_sifre is distinct from g.sifre then
    update kids_ogrenciler set hata_sayi = case when hata_sayi + 1 >= 5 then 0 else hata_sayi + 1 end,
      kilit_bitis = case when hata_sayi + 1 >= 5 then now() + interval '5 minutes' else kilit_bitis end where id = g.id;
    return json_build_object('tamam', false, 'kilit', g.hata_sayi + 1 >= 5);
  end if;
  update kids_ogrenciler set hata_sayi = 0, kilit_bitis = null where id = g.id;
  return json_build_object('tamam', true, 'token', public.kids_oturum_ac('cocuk', g.okul_id, g.id, 90));
end $$;

create or replace function public.kids_durum(p_token text)
returns json language plpgsql stable security definer set search_path = public as $$
declare o kids_oturumlar := public.kids_oturum(p_token, 'cocuk');
begin
  return (select json_build_object('okul', json_build_object('kod', k.kod, 'ad', k.ad),
      'sinif', json_build_object('id', s.id, 'ad', s.ad, 'bant', s.bant),
      'ogr', json_build_object('id', g.id, 'ad', g.ad, 'hayvan', g.hayvan),
      'bugun', (select p.konu from kids_plan p where p.sinif_id = s.id and p.gun = (now() at time zone 'Europe/Istanbul')::date),
      'ilerleme', (select i.veri from kids_ilerleme i where i.ogrenci_id = g.id))
    from kids_ogrenciler g join kids_siniflar s on s.id = g.sinif_id join kids_okullar k on k.id = g.okul_id where g.id = o.ogrenci_id);
end $$;

create or replace function public.kids_ilerleme_koy(p_token text, p_veri jsonb)
returns void language plpgsql volatile security definer set search_path = public as $$
declare o kids_oturumlar := public.kids_oturum(p_token, 'cocuk');
begin
  if jsonb_typeof(p_veri) is distinct from 'object' then raise exception 'veri nesne olmalı'; end if;
  insert into kids_ilerleme (ogrenci_id, veri, updated_at) values (o.ogrenci_id, p_veri, now())
  on conflict (ogrenci_id) do update set veri = excluded.veri, updated_at = now();
end $$;

create or replace function public.kids_cikis(p_token text)
returns void language sql volatile security definer set search_path = public as $$
  delete from kids_oturumlar where ozet = public.kids_ozet(p_token)
$$;

-- --------------------------------------------------------------------------
-- öğretmen
-- --------------------------------------------------------------------------
create or replace function public.kids_ogretmen_giris(p_kod text, p_sifre text)
returns json language plpgsql volatile security definer set search_path = public, extensions as $$
declare o kids_okullar;
begin
  select * into o from kids_okullar where kod = upper(trim(coalesce(p_kod, ''))) for update;
  if o.id is null or o.sifre_ozet is null then return json_build_object('tamam', false); end if;
  if not public.kids_okul_acik(o.id) then raise exception 'Okulunuzun Acadex Kids lisansı açık değil.' using errcode = '28000', hint = 'lisans'; end if;
  if o.sifre_kilit > now() then raise exception 'Çok fazla hatalı deneme. 15 dakika sonra yeniden deneyin.' using errcode = '28000', hint = 'kilit'; end if;
  if extensions.crypt(coalesce(p_sifre, ''), o.sifre_ozet) <> o.sifre_ozet then
    update kids_okullar set sifre_hata = case when sifre_hata + 1 >= 5 then 0 else sifre_hata + 1 end,
      sifre_kilit = case when sifre_hata + 1 >= 5 then now() + interval '15 minutes' else sifre_kilit end where id = o.id;
    return json_build_object('tamam', false);
  end if;
  update kids_okullar set sifre_hata = 0, sifre_kilit = null where id = o.id;
  return json_build_object('tamam', true, 'token', public.kids_oturum_ac('ogretmen', o.id, null, 14));
end $$;

create or replace function public.kids_ogretmen_veri(p_token text, p_bas date, p_bit date)
returns json language plpgsql stable security definer set search_path = public as $$
declare o kids_oturumlar := public.kids_oturum(p_token, 'ogretmen');
begin
  if p_bit < p_bas or p_bit - p_bas > 62 then raise exception 'tarih aralığı geçersiz'; end if;
  return (select json_build_object('okul', json_build_object('kod', k.kod, 'ad', k.ad),
    'bugun', (now() at time zone 'Europe/Istanbul')::date,
    'siniflar', coalesce((select json_agg(json_build_object('id', s.id, 'ad', s.ad, 'bant', s.bant,
        'ogr', coalesce((select json_agg(json_build_object('id', g.id, 'ad', g.ad, 'hayvan', g.hayvan, 'ilerleme', i.veri) order by g.ad, g.no)
          from kids_ogrenciler g left join kids_ilerleme i on i.ogrenci_id = g.id where g.sinif_id = s.id and g.aktif), '[]'::json),
        'plan', coalesce((select json_object_agg(p.gun::text, p.konu) from kids_plan p where p.sinif_id = s.id and p.gun between p_bas and p_bit), '{}'::json))
      order by s.created_at) from kids_siniflar s where s.okul_id = k.id), '[]'::json))
    from kids_okullar k where k.id = o.okul_id);
end $$;

create or replace function public.kids_plan_koy(p_token text, p_sinif uuid, p_gun date, p_konu text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare o kids_oturumlar := public.kids_oturum(p_token, 'ogretmen');
begin
  if not exists (select 1 from kids_siniflar where id = p_sinif and okul_id = o.okul_id) then raise exception 'Bu sınıf okulunuza ait değil.' using errcode = '42501'; end if;
  if abs(p_gun - (now() at time zone 'Europe/Istanbul')::date) > 60 then raise exception 'Yalnız iki ay içindeki günler planlanabilir.'; end if;
  insert into kids_plan (sinif_id, gun, konu, updated_at) values (p_sinif, p_gun, coalesce(p_konu, ''), now())
  on conflict (sinif_id, gun) do update set konu = excluded.konu, updated_at = now();
end $$;

-- --------------------------------------------------------------------------
-- yetkiler
-- --------------------------------------------------------------------------
do $$ declare f text; begin
  foreach f in array array['kids_ozet(text)', 'kids_okul_acik(uuid)', 'kids_oturum_ac(text, uuid, uuid, integer)', 'kids_oturum(text, text)'] loop
    execute 'revoke all on function public.' || f || ' from public, anon, authenticated';
  end loop;
  foreach f in array array['kids_okul_bul(text)', 'kids_giris(uuid, text[])', 'kids_durum(text)', 'kids_ilerleme_koy(text, jsonb)', 'kids_cikis(text)',
    'kids_ogretmen_giris(text, text)', 'kids_ogretmen_veri(text, date, date)', 'kids_plan_koy(text, uuid, date, text)'] loop
    execute 'revoke all on function public.' || f || ' from public';
    execute 'grant execute on function public.' || f || ' to anon, authenticated';
  end loop;
end $$;

notify pgrst, 'reload schema';
