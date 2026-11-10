-- Acadex Kids · yönetim (10.11.2026)
-- Kids'i satın alan okullar, lisansları, sınıfları ve öğrenci kimlikleri.
-- İstemci: js/admin-kids.js (yönetim paneli → "Acadex Kids").
--
-- Kurallar:
--   * Tablolara doğrudan erişim YOK (anon ve authenticated için kapalı); her şey
--     yönetici fonksiyonlarından geçer. Fonksiyonlar admin_guard() ile yönetici +
--     iki adımlı doğrulama ister ve her değişikliği admin_audit_log'a yazar.
--   * KVKK: çocuğun yalnız adı ve soyadının baş harfi tutulur ("Defne K.").
--     Sunucu da kısaltır; istemci tam adı gönderse bile tam soyad kaydedilmez.
--   * Resimli şifre kartta basılı olduğundan düz tutulur (9 resimden 2'si);
--     okulun öğretmen şifresi yalnız özet (bcrypt) olarak tutulur, düz hâli bir
--     kez gösterilir.
--   * Kota: bir okulda etkin öğrenci sayısı lisans kotasını (varsayılan 100) aşamaz.
--   * Bu dosyada çocuk uygulamasının girişi YOK; o sonraki adım (kids_giris).
-- Supabase SQL Editor'da elle çalıştırılır; tekrar çalıştırmak güvenlidir.

create extension if not exists pgcrypto;

create table if not exists public.kids_okullar (
  id            uuid primary key default gen_random_uuid(),
  kod           text not null unique check (kod ~ '^[A-Z0-9]{2,8}-[0-9]{4}$'),
  ad            text not null check (length(trim(ad)) between 2 and 120),
  ilce          text not null default '',
  il            text not null default 'Ankara',
  yetkili_ad    text not null default '',
  yetkili_tel   text not null default '',
  lisans_bas    date not null default current_date,
  lisans_bit    date not null default (current_date + 365),
  kota          integer not null default 100 check (kota between 1 and 5000),
  ucret_kurus   bigint not null default 3490000 check (ucret_kurus >= 0),   -- 34.900 TL + KDV
  odeme         text not null default 'bekliyor' check (odeme in ('bekliyor', 'odendi', 'deneme')),
  sifre_ozet    text,            -- öğretmen şifresinin bcrypt özeti
  notlar        text not null default '',
  aktif         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint kids_okullar_tarih check (lisans_bit >= lisans_bas)
);

create table if not exists public.kids_siniflar (
  id          uuid primary key default gen_random_uuid(),
  okul_id     uuid not null references public.kids_okullar(id) on delete cascade,
  ad          text not null check (length(trim(ad)) between 1 and 60),
  bant        text not null check (bant in ('minik', 'kasif', 'yildiz')),   -- Minikler 3-4 · Kâşifler 5-6 · Yıldızlar 7-10
  created_at  timestamptz not null default now(),
  unique (okul_id, ad)
);

create table if not exists public.kids_ogrenciler (
  id          uuid primary key default gen_random_uuid(),
  okul_id     uuid not null references public.kids_okullar(id) on delete cascade,
  sinif_id    uuid not null references public.kids_siniflar(id) on delete cascade,
  no          integer not null check (no > 0),            -- okul içinde sıra no → kimlik: AY-2026-007
  ad          text not null check (length(ad) between 1 and 40),
  hayvan      text not null check (hayvan in ('tavsan', 'ayi', 'kedi', 'civciv', 'panda', 'kurbaga', 'tilki', 'kopek')),
  sifre       text[] not null check (array_length(sifre, 1) = 2),
  aktif       boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (okul_id, no)
);
create index if not exists kids_ogrenciler_sinif on public.kids_ogrenciler (sinif_id);

do $$ declare t text; begin
  foreach t in array array['kids_okullar', 'kids_siniflar', 'kids_ogrenciler'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- --------------------------------------------------------------------------
-- yardımcılar
-- --------------------------------------------------------------------------
-- "Ayşe Nur Kaya" → "Ayşe Nur K." ; "Defne" → "Defne"
create or replace function public.kids_ad_kisalt(p text)
returns text language sql immutable set search_path = public as $$
  with w as (select regexp_split_to_array(regexp_replace(trim(coalesce(p, '')), '\s+', ' ', 'g'), ' ') a)
  select left(case when coalesce(array_length(a, 1), 0) <= 1 then a[1]
    else array_to_string(a[1:array_length(a, 1) - 1], ' ') || ' ' || upper(left(a[array_length(a, 1)], 1)) || '.' end, 40)
  from w
$$;

create or replace function public.kids_sifre_uret()
returns text[] language sql volatile set search_path = public as $$
  select array_agg(r) from (select r from unnest(array['kedi', 'elma', 'top', 'balik', 'cicek', 'ay', 'araba', 'kus', 'cilek']) r order by random() limit 2) x
$$;

create or replace function public.kids_okul_json(p_okul uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('id', o.id, 'kod', o.kod, 'ad', o.ad, 'ilce', o.ilce, 'il', o.il, 'yetkili_ad', o.yetkili_ad, 'yetkili_tel', o.yetkili_tel,
    'lisans_bas', o.lisans_bas, 'lisans_bit', o.lisans_bit, 'kota', o.kota, 'ucret_kurus', o.ucret_kurus, 'odeme', o.odeme, 'notlar', o.notlar, 'aktif', o.aktif,
    'sifre_var', o.sifre_ozet is not null, 'created_at', o.created_at,
    'ogrenci', (select count(*) from kids_ogrenciler g where g.okul_id = o.id and g.aktif),
    'sinif', (select count(*) from kids_siniflar s where s.okul_id = o.id))
  from kids_okullar o where o.id = p_okul
$$;

-- --------------------------------------------------------------------------
-- okullar ve lisans
-- --------------------------------------------------------------------------
create or replace function public.kids_okul_liste()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_guard();
  return coalesce((select json_agg(public.kids_okul_json(id) order by aktif desc, ad) from kids_okullar), '[]'::json);
end $$;

-- p: {id?, kod, ad, ilce, il, yetkili_ad, yetkili_tel, lisans_bas, lisans_bit, kota, ucret_kurus, odeme, notlar, aktif}
create or replace function public.kids_okul_kaydet(p jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p->>'id', '')::uuid; v_kota int := coalesce((p->>'kota')::int, 100); n int; yeni boolean := v_id is null;
begin
  perform public.admin_guard();
  if not yeni then
    select count(*) into n from kids_ogrenciler where okul_id = v_id and aktif;
    if n > v_kota then raise exception 'Bu okulda % etkin öğrenci var; kota % olamaz.', n, v_kota; end if;
  end if;
  if yeni then
    insert into kids_okullar (kod, ad, ilce, il, yetkili_ad, yetkili_tel, lisans_bas, lisans_bit, kota, ucret_kurus, odeme, notlar)
    values (upper(trim(p->>'kod')), trim(p->>'ad'), coalesce(trim(p->>'ilce'), ''), coalesce(nullif(trim(p->>'il'), ''), 'Ankara'),
      coalesce(trim(p->>'yetkili_ad'), ''), coalesce(trim(p->>'yetkili_tel'), ''),
      coalesce((p->>'lisans_bas')::date, current_date), coalesce((p->>'lisans_bit')::date, current_date + 365),
      v_kota, coalesce((p->>'ucret_kurus')::bigint, 3490000), coalesce(p->>'odeme', 'bekliyor'), coalesce(p->>'notlar', ''))
    returning id into v_id;
  else
    update kids_okullar set kod = upper(trim(p->>'kod')), ad = trim(p->>'ad'), ilce = coalesce(trim(p->>'ilce'), ''), il = coalesce(nullif(trim(p->>'il'), ''), 'Ankara'),
      yetkili_ad = coalesce(trim(p->>'yetkili_ad'), ''), yetkili_tel = coalesce(trim(p->>'yetkili_tel'), ''),
      lisans_bas = (p->>'lisans_bas')::date, lisans_bit = (p->>'lisans_bit')::date, kota = v_kota,
      ucret_kurus = coalesce((p->>'ucret_kurus')::bigint, ucret_kurus), odeme = coalesce(p->>'odeme', odeme), notlar = coalesce(p->>'notlar', ''),
      aktif = coalesce((p->>'aktif')::boolean, aktif), updated_at = now()
    where id = v_id;
    if not found then raise exception 'Okul bulunamadı.'; end if;
  end if;
  perform public.admin_log(case when yeni then 'kids_okul_ekle' else 'kids_okul_guncelle' end, null, (select kod || ' · ' || ad from kids_okullar where id = v_id),
    jsonb_build_object('kota', v_kota, 'lisans_bit', p->>'lisans_bit', 'odeme', p->>'odeme'));
  return public.kids_okul_json(v_id);
exception when unique_violation then raise exception 'Bu okul kodu başka bir okulda kullanılıyor.';
end $$;

-- okulun öğretmen şifresini üretir (6 hane); düz hâli yalnız bu yanıtta döner
create or replace function public.kids_okul_sifre_yenile(p_okul uuid)
returns text language plpgsql volatile security definer set search_path = public, extensions as $$
declare s text := lpad((floor(random() * 1000000))::int::text, 6, '0');
begin
  perform public.admin_guard();
  update kids_okullar set sifre_ozet = extensions.crypt(s, extensions.gen_salt('bf')), updated_at = now() where id = p_okul;
  if not found then raise exception 'Okul bulunamadı.'; end if;
  perform public.admin_log('kids_okul_sifre', null, (select kod from kids_okullar where id = p_okul), '{}'::jsonb);
  return s;
end $$;

-- --------------------------------------------------------------------------
-- okul ayrıntısı, sınıflar, öğrenciler
-- --------------------------------------------------------------------------
create or replace function public.kids_okul_detay(p_okul uuid)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_guard();
  if not exists (select 1 from kids_okullar where id = p_okul) then raise exception 'Okul bulunamadı.'; end if;
  return json_build_object('okul', public.kids_okul_json(p_okul),
    'siniflar', coalesce((select json_agg(json_build_object('id', s.id, 'ad', s.ad, 'bant', s.bant,
        'ogrenci', (select count(*) from kids_ogrenciler g where g.sinif_id = s.id and g.aktif)) order by s.created_at) from kids_siniflar s where s.okul_id = p_okul), '[]'::json),
    'ogrenciler', coalesce((select json_agg(json_build_object('id', g.id, 'sinif_id', g.sinif_id, 'no', g.no, 'kimlik', o.kod || '-' || lpad(g.no::text, 3, '0'),
        'ad', g.ad, 'hayvan', g.hayvan, 'sifre', g.sifre, 'aktif', g.aktif) order by g.no)
      from kids_ogrenciler g join kids_okullar o on o.id = g.okul_id where g.okul_id = p_okul), '[]'::json));
end $$;

create or replace function public.kids_sinif_kaydet(p_okul uuid, p_id uuid, p_ad text, p_bant text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid := p_id;
begin
  perform public.admin_guard();
  if v is null then
    insert into kids_siniflar (okul_id, ad, bant) values (p_okul, trim(p_ad), p_bant) returning id into v;
  else
    update kids_siniflar set ad = trim(p_ad), bant = p_bant where id = v and okul_id = p_okul;
    if not found then raise exception 'Sınıf bulunamadı.'; end if;
  end if;
  perform public.admin_log(case when p_id is null then 'kids_sinif_ekle' else 'kids_sinif_guncelle' end, null,
    (select kod from kids_okullar where id = p_okul) || ' · ' || trim(p_ad), jsonb_build_object('bant', p_bant));
  return v;
exception when unique_violation then raise exception 'Bu okulda aynı adlı bir sınıf zaten var.';
end $$;

create or replace function public.kids_sinif_sil(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare lbl text; n int;
begin
  perform public.admin_guard();
  select o.kod || ' · ' || s.ad, (select count(*) from kids_ogrenciler g where g.sinif_id = s.id) into lbl, n
    from kids_siniflar s join kids_okullar o on o.id = s.okul_id where s.id = p_id;
  if lbl is null then raise exception 'Sınıf bulunamadı.'; end if;
  delete from kids_siniflar where id = p_id;
  perform public.admin_log('kids_sinif_sil', null, lbl, jsonb_build_object('ogrenci', n));
end $$;

-- toplu öğrenci: her ada sıra no, hayvan (sınıfta en az kullanılandan) ve resimli şifre verilir
create or replace function public.kids_ogrenci_ekle(p_sinif uuid, p_adlar text[])
returns json language plpgsql security definer set search_path = public as $$
declare v_okul uuid; v_kota int; v_kod text; n_aktif int; n_yeni int; v_no int; a text; h text; ids uuid[] := '{}'; yid uuid;
begin
  perform public.admin_guard();
  select s.okul_id, o.kota, o.kod into v_okul, v_kota, v_kod from kids_siniflar s join kids_okullar o on o.id = s.okul_id where s.id = p_sinif for update of o;
  if v_okul is null then raise exception 'Sınıf bulunamadı.'; end if;
  select array_agg(x) into p_adlar from (select public.kids_ad_kisalt(t) x from unnest(p_adlar) with ordinality u(t, i) where length(trim(coalesce(t, ''))) > 0 order by i) z;
  n_yeni := coalesce(array_length(p_adlar, 1), 0);
  if n_yeni = 0 then raise exception 'Eklenecek ad yok.'; end if;
  if n_yeni > 200 then raise exception 'Tek seferde en çok 200 öğrenci eklenir.'; end if;
  select count(*) into n_aktif from kids_ogrenciler where okul_id = v_okul and aktif;
  if n_aktif + n_yeni > v_kota then raise exception 'Kota yetmiyor: % etkin öğrenci var, % eklenmek isteniyor, kota %.', n_aktif, n_yeni, v_kota; end if;
  select coalesce(max(no), 0) into v_no from kids_ogrenciler where okul_id = v_okul;
  foreach a in array p_adlar loop
    v_no := v_no + 1;
    select hv into h from unnest(array['tavsan', 'ayi', 'kedi', 'civciv', 'panda', 'kurbaga', 'tilki', 'kopek']) with ordinality x(hv, i)
      order by (select count(*) from kids_ogrenciler g where g.sinif_id = p_sinif and g.hayvan = x.hv), i limit 1;
    insert into kids_ogrenciler (okul_id, sinif_id, no, ad, hayvan, sifre) values (v_okul, p_sinif, v_no, a, h, public.kids_sifre_uret()) returning id into yid;
    ids := ids || yid;
  end loop;
  perform public.admin_log('kids_ogrenci_ekle', null, v_kod || ' · ' || (select ad from kids_siniflar where id = p_sinif), jsonb_build_object('adet', n_yeni));
  return json_build_object('adet', n_yeni, 'ids', ids);
end $$;

-- p: {ad?, aktif?, sinif_id?}
create or replace function public.kids_ogrenci_guncelle(p_id uuid, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare g kids_ogrenciler; v_kota int; n int;
begin
  perform public.admin_guard();
  select * into g from kids_ogrenciler where id = p_id;
  if g.id is null then raise exception 'Öğrenci bulunamadı.'; end if;
  if (p->>'aktif')::boolean is true and not g.aktif then
    select kota into v_kota from kids_okullar where id = g.okul_id for update;
    select count(*) into n from kids_ogrenciler where okul_id = g.okul_id and aktif;
    if n + 1 > v_kota then raise exception 'Kota dolu (%/%).', n, v_kota; end if;
  end if;
  if p ? 'sinif_id' and not exists (select 1 from kids_siniflar where id = (p->>'sinif_id')::uuid and okul_id = g.okul_id) then raise exception 'Sınıf bu okula ait değil.'; end if;
  update kids_ogrenciler set ad = case when length(trim(coalesce(p->>'ad', ''))) > 0 then public.kids_ad_kisalt(p->>'ad') else ad end, aktif = coalesce((p->>'aktif')::boolean, aktif),
    sinif_id = coalesce((p->>'sinif_id')::uuid, sinif_id) where id = p_id;
  perform public.admin_log('kids_ogrenci_guncelle', null, (select kod from kids_okullar where id = g.okul_id) || '-' || lpad(g.no::text, 3, '0'), p - 'ad');
end $$;

create or replace function public.kids_ogrenci_sifre_yenile(p_ids uuid[])
returns integer language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform public.admin_guard();
  update kids_ogrenciler set sifre = public.kids_sifre_uret() where id = any(p_ids);
  get diagnostics n = row_count;
  perform public.admin_log('kids_sifre_yenile', null, null, jsonb_build_object('adet', n));
  return n;
end $$;

create or replace function public.kids_ogrenci_sil(p_ids uuid[])
returns integer language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform public.admin_guard();
  delete from kids_ogrenciler where id = any(p_ids);
  get diagnostics n = row_count;
  perform public.admin_log('kids_ogrenci_sil', null, null, jsonb_build_object('adet', n));
  return n;
end $$;

-- --------------------------------------------------------------------------
-- yetkiler: yalnız oturum açmış kullanıcı çağırabilir; içeride admin_guard() yöneticiyi ister
-- --------------------------------------------------------------------------
revoke all on function public.kids_okul_json(uuid) from public, anon, authenticated;
revoke all on function public.kids_sifre_uret() from public, anon, authenticated;
revoke all on function public.kids_ad_kisalt(text) from public, anon, authenticated;
do $$ declare f text; begin
  foreach f in array array['kids_okul_liste()', 'kids_okul_kaydet(jsonb)', 'kids_okul_sifre_yenile(uuid)', 'kids_okul_detay(uuid)',
    'kids_sinif_kaydet(uuid, uuid, text, text)', 'kids_sinif_sil(uuid)', 'kids_ogrenci_ekle(uuid, text[])', 'kids_ogrenci_guncelle(uuid, jsonb)',
    'kids_ogrenci_sifre_yenile(uuid[])', 'kids_ogrenci_sil(uuid[])'] loop
    execute 'revoke all on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;

notify pgrst, 'reload schema';
