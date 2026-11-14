-- ==========================================================================
-- ACADEX KIDS — KREŞLER İÇİN: ETKİNLİK TAKVİMİ, KELİME SETLERİ, KREŞ YÖNETİCİSİ,
-- ÖĞRETMEN PIN'LERİ, BAŞVURU + DENEME (14.11.2026)
-- Önce 20261110_kids_yonetim.sql, 20261110b_kids_giris.sql, 20261112c ve 20261112d
-- çalışmış olmalı. Supabase SQL Editor'da elle çalıştırılır; tekrar çalıştırmak güvenlidir.
--
-- NEDEN: Kids binlerce kreşe satılacak. Her okulu yönetim panelinden elle kurmak
-- ölçeklenmez ve her kreşin kendi haftası var ("Pazartesi bahçe günü", 23 Nisan…).
--
-- 1) ETKİNLİK TAKVİMİ: kids_plan'a günün etkinliği (etiket) ve kelime seti eklenir.
--    kids_hafta haftalık şablondur (Pazartesi-Cuma). Bir gün için açık plan varsa o,
--    yoksa haftanın şablonu geçerlidir (kids_gun_bilgi). Öğretmen içerik YAZMAZ:
--    etiket hazır katalogdan seçilir (istemci), kelimeler hazır 510 kelimeden.
-- 2) KELİME SETLERİ: okulun kendi seti (3-20 kelime kimliği). Çocuk o gün seti
--    ayrı bir ada gibi oynar. Kelime kimlikleri istemcideki kelime listesindendir;
--    sunucu yalnız biçimi doğrular, bilinmeyen kimliği istemci atlar.
-- 3) KREŞ YÖNETİCİSİ (müdür): okul kodu + yönetici şifresiyle kendi okulunu yönetir:
--    sınıf, toplu öğrenci, öğretmen PIN'leri, kart yazdırma. Lisans/deneme bitince
--    giriş yapabilir ve kayıtları görür ama değiştiremez (veri silinmez).
-- 4) ÖĞRETMEN PIN'LERİ: her öğretmenin 6 haneli kişisel PIN'i ve (isteğe bağlı) kendi
--    sınıfları olur. Okulun ortak öğretmen şifresi çalışmaya devam eder (geriye uyum).
--    PIN'le giren öğretmen yalnız kendi sınıflarını görür ve planlar.
-- 5) BAŞVURU + DENEME: kreş tanıtım sayfasından başvurur (anon, IP başına günde 3),
--    yönetici panelden onaylanır: okul "deneme" olarak 14 gün açılır, yönetici ve
--    öğretmen şifreleri yalnız onay yanıtında bir kez döner.
--
-- Güvenlik: tablolar dışarıya kapalı; her şey fonksiyonlardan geçer. Şifre/PIN'lerin
-- yalnız bcrypt özeti tutulur. Yönetici kilidi öğretmenle aynı katlanan kalıptadır.
-- KVKK: başvuruda çocuk verisi yok; yetkili adı/telefonu/e-postası tutulur ve açık
-- rıza (kvkk=true) olmadan başvuru alınmaz.
-- Teste bağlı: tests/kids-kres.js
-- ==========================================================================

create extension if not exists pgcrypto;

-- --------------------------------------------------------------------------
-- 0) yardımcılar
-- --------------------------------------------------------------------------
create or replace function public.kids_konu_gecerli(p text)
returns boolean language sql immutable set search_path = public as $$
  select coalesce(p, '') in ('',
    'colours', 'numbers', 'animals', 'family', 'body', 'food', 'toys', 'clothes', 'home', 'school', 'weather', 'feelings',
    'fruits', 'transport', 'shapes', 'sea', 'jobs', 'actions', 'seasons', 'days', 'places', 'alphabet')
$$;

-- okunaklı şifre: karışan harfler yok (0/O, 1/l/I)
create or replace function public.kids_okunakli_sifre(n integer)
returns text language sql volatile set search_path = public, extensions as $$
  select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', (get_byte(b, i) % 31) + 1, 1), '' order by i)
  from (select extensions.gen_random_bytes(n) b) x, generate_series(0, n - 1) i
$$;

create or replace function public.kids_pin_uret()
returns text language sql volatile set search_path = public, extensions as $$
  select lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0')
$$;

-- --------------------------------------------------------------------------
-- 1) okul: yönetici şifresi, kaynak, e-posta
-- --------------------------------------------------------------------------
alter table public.kids_okullar add column if not exists yonetici_ozet text;
alter table public.kids_okullar add column if not exists yonetici_hata integer not null default 0;
alter table public.kids_okullar add column if not exists yonetici_kilit timestamptz;
alter table public.kids_okullar add column if not exists yonetici_kilit_say integer not null default 0;
alter table public.kids_okullar add column if not exists kaynak text not null default 'admin';
alter table public.kids_okullar add column if not exists eposta text not null default '';
alter table public.kids_okullar drop constraint if exists kids_okullar_kaynak_check;
alter table public.kids_okullar add constraint kids_okullar_kaynak_check check (kaynak in ('admin', 'basvuru'));

-- --------------------------------------------------------------------------
-- 2) öğretmenler (kişisel PIN) ve oturum türleri
-- --------------------------------------------------------------------------
create table if not exists public.kids_ogretmenler (
  id         uuid primary key default gen_random_uuid(),
  okul_id    uuid not null references public.kids_okullar(id) on delete cascade,
  ad         text not null check (length(trim(ad)) between 2 and 40),
  pin_ozet   text not null,
  siniflar   uuid[] not null default '{}',     -- boş = bütün sınıflar
  aktif      boolean not null default true,
  created_at timestamptz not null default now(),
  unique (okul_id, ad)
);

alter table public.kids_oturumlar drop constraint if exists kids_oturumlar_tur_check;
alter table public.kids_oturumlar add constraint kids_oturumlar_tur_check check (tur in ('cocuk', 'ogretmen', 'yonetici'));
alter table public.kids_oturumlar add column if not exists ogretmen_id uuid references public.kids_ogretmenler(id) on delete cascade;

-- --------------------------------------------------------------------------
-- 3) kelime setleri, günün etkinliği, haftalık şablon
-- --------------------------------------------------------------------------
create table if not exists public.kids_setler (
  id         uuid primary key default gen_random_uuid(),
  okul_id    uuid not null references public.kids_okullar(id) on delete cascade,
  ad         text not null check (length(trim(ad)) between 1 and 40),
  kelimeler  text[] not null check (cardinality(kelimeler) between 3 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (okul_id, ad)
);

alter table public.kids_plan add column if not exists set_id uuid references public.kids_setler(id) on delete set null;
alter table public.kids_plan add column if not exists etkinlik text not null default '';
alter table public.kids_plan drop constraint if exists kids_plan_etkinlik_check;
alter table public.kids_plan add constraint kids_plan_etkinlik_check check (length(etkinlik) <= 40);

create table if not exists public.kids_hafta (
  sinif_id   uuid not null references public.kids_siniflar(id) on delete cascade,
  hafta_gunu smallint not null check (hafta_gunu between 1 and 5),     -- 1 Pazartesi … 5 Cuma
  konu       text not null default '' check (public.kids_konu_gecerli(konu)),
  set_id     uuid references public.kids_setler(id) on delete set null,
  etkinlik   text not null default '' check (length(etkinlik) <= 40),
  updated_at timestamptz not null default now(),
  primary key (sinif_id, hafta_gunu)
);

-- --------------------------------------------------------------------------
-- 4) başvurular ve kreş işlem kaydı
-- --------------------------------------------------------------------------
create table if not exists public.kids_basvurular (
  id           uuid primary key default gen_random_uuid(),
  kres_ad      text not null check (length(trim(kres_ad)) between 2 and 120),
  il           text not null default '' check (length(il) <= 40),
  ilce         text not null default '' check (length(ilce) <= 60),
  yetkili_ad   text not null check (length(trim(yetkili_ad)) between 2 and 80),
  tel          text not null check (tel ~ '^[0-9 +()-]{10,20}$'),
  eposta       text not null default '' check (eposta = '' or eposta ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  ogrenci_sayi integer not null default 0 check (ogrenci_sayi between 0 and 2000),
  mesaj        text not null default '' check (length(mesaj) <= 500),
  ip           text not null default '',
  durum        text not null default 'bekliyor' check (durum in ('bekliyor', 'onaylandi', 'reddedildi')),
  okul_id      uuid references public.kids_okullar(id) on delete set null,
  created_at   timestamptz not null default now(),
  karar_at     timestamptz
);
create index if not exists kids_basvurular_ip on public.kids_basvurular (ip, created_at);

create table if not exists public.kids_kres_log (
  id         bigserial primary key,
  okul_id    uuid not null references public.kids_okullar(id) on delete cascade,
  kim        text not null,                 -- 'yonetici' | 'ogretmen'
  olay       text not null,
  ayrinti    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists kids_kres_log_okul on public.kids_kres_log (okul_id, created_at desc);

do $$ declare t text; begin
  foreach t in array array['kids_ogretmenler', 'kids_setler', 'kids_hafta', 'kids_basvurular', 'kids_kres_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- --------------------------------------------------------------------------
-- 5) oturumlar: öğretmen PIN'i kapatılınca oturumu da düşer; yönetici oturumu
-- --------------------------------------------------------------------------
create or replace function public.kids_oturum_ac2(p_tur text, p_okul uuid, p_ogrenci uuid, p_ogretmen uuid, p_gun integer)
returns text language plpgsql volatile security definer set search_path = public, extensions as $$
declare a text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  delete from kids_oturumlar where son_kullanma < now();
  insert into kids_oturumlar (ozet, tur, okul_id, ogrenci_id, ogretmen_id, son_kullanma)
  values (public.kids_ozet(a), p_tur, p_okul, p_ogrenci, p_ogretmen, now() + make_interval(days => p_gun));
  return a;
end $$;

create or replace function public.kids_oturum(p_token text, p_tur text)
returns public.kids_oturumlar language plpgsql stable security definer set search_path = public as $$
declare o kids_oturumlar;
begin
  select * into o from kids_oturumlar where ozet = public.kids_ozet(p_token) and tur = p_tur and son_kullanma > now();
  if o.ozet is null then raise exception 'oturum yok' using errcode = '28000', hint = 'oturum'; end if;
  if not public.kids_okul_acik(o.okul_id) then raise exception 'Okulunuzun Acadex Kids lisansı açık değil.' using errcode = '28000', hint = 'lisans'; end if;
  if p_tur = 'cocuk' and not exists (select 1 from kids_ogrenciler where id = o.ogrenci_id and aktif) then raise exception 'oturum yok' using errcode = '28000', hint = 'oturum'; end if;
  if o.ogretmen_id is not null and not exists (select 1 from kids_ogretmenler where id = o.ogretmen_id and aktif) then raise exception 'oturum yok' using errcode = '28000', hint = 'oturum'; end if;
  return o;
end $$;

-- yönetici: lisans kapalıyken de girer (kayıtları görür); değişiklik için kids_yon_yazma
create or replace function public.kids_yon_oturum(p_token text)
returns public.kids_oturumlar language plpgsql stable security definer set search_path = public as $$
declare o kids_oturumlar;
begin
  select * into o from kids_oturumlar where ozet = public.kids_ozet(p_token) and tur = 'yonetici' and son_kullanma > now();
  if o.ozet is null or not exists (select 1 from kids_okullar where id = o.okul_id and aktif) then
    raise exception 'oturum yok' using errcode = '28000', hint = 'oturum';
  end if;
  return o;
end $$;

create or replace function public.kids_yon_yazma(p_token text)
returns public.kids_oturumlar language plpgsql stable security definer set search_path = public as $$
declare o kids_oturumlar := public.kids_yon_oturum(p_token);
begin
  if not public.kids_okul_acik(o.okul_id) then
    raise exception 'Lisans ya da deneme süreniz bitti. Kayıtlarınız duruyor; devam etmek için Acadex ile iletişime geçin.' using errcode = '28000', hint = 'lisans';
  end if;
  return o;
end $$;

-- öğretmen bu sınıfa erişebilir mi? (PIN'li öğretmen yalnız kendi sınıfları; liste boşsa hepsi)
create or replace function public.kids_sinif_yetki(p_okul uuid, p_ogretmen uuid, p_sinif uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from kids_siniflar s where s.id = p_sinif and s.okul_id = p_okul)
     and (p_ogretmen is null or exists (select 1 from kids_ogretmenler t where t.id = p_ogretmen and t.aktif
           and (cardinality(t.siniflar) = 0 or p_sinif = any(t.siniflar))))
$$;

create or replace function public.kids_log(p_okul uuid, p_kim text, p_olay text, p_ayrinti jsonb)
returns void language sql volatile security definer set search_path = public as $$
  insert into kids_kres_log (okul_id, kim, olay, ayrinti) values (p_okul, p_kim, p_olay, coalesce(p_ayrinti, '{}'::jsonb))
$$;

-- --------------------------------------------------------------------------
-- 6) günün bilgisi: açık plan > haftalık şablon
-- --------------------------------------------------------------------------
create or replace function public.kids_set_json(p_set uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('id', s.id, 'ad', s.ad, 'kelimeler', s.kelimeler) from kids_setler s where s.id = p_set
$$;

create or replace function public.kids_gun_bilgi(p_sinif uuid, p_gun date)
returns json language plpgsql stable security definer set search_path = public as $$
declare p kids_plan; h kids_hafta; g int := extract(isodow from p_gun)::int;
begin
  select * into p from kids_plan where sinif_id = p_sinif and gun = p_gun;
  if p.sinif_id is not null then
    return json_build_object('konu', p.konu, 'etkinlik', p.etkinlik, 'set', public.kids_set_json(p.set_id), 'kaynak', 'plan');
  end if;
  if g between 1 and 5 then
    select * into h from kids_hafta where sinif_id = p_sinif and hafta_gunu = g;
    if h.sinif_id is not null then
      return json_build_object('konu', h.konu, 'etkinlik', h.etkinlik, 'set', public.kids_set_json(h.set_id), 'kaynak', 'hafta');
    end if;
  end if;
  return json_build_object('konu', '', 'etkinlik', '', 'set', null, 'kaynak', null);
end $$;

-- çocuk: bugün (konu + etkinlik + set) eklendi; eski alanlar aynı
create or replace function public.kids_durum(p_token text)
returns json language plpgsql stable security definer set search_path = public as $$
declare o kids_oturumlar := public.kids_oturum(p_token, 'cocuk'); v_sinif uuid; b json;
begin
  select sinif_id into v_sinif from kids_ogrenciler where id = o.ogrenci_id;
  b := public.kids_gun_bilgi(v_sinif, (now() at time zone 'Europe/Istanbul')::date);
  return (select json_build_object('okul', json_build_object('kod', k.kod, 'ad', k.ad),
      'sinif', json_build_object('id', s.id, 'ad', s.ad, 'bant', s.bant),
      'ogr', json_build_object('id', g.id, 'ad', g.ad, 'hayvan', g.hayvan),
      'bugun', b->>'konu', 'etkinlik', b->>'etkinlik', 'set', b->'set',
      'ilerleme', (select i.veri from kids_ilerleme i where i.ogrenci_id = g.id))
    from kids_ogrenciler g join kids_siniflar s on s.id = g.sinif_id join kids_okullar k on k.id = g.okul_id where g.id = o.ogrenci_id);
end $$;

-- --------------------------------------------------------------------------
-- 7) öğretmen: giriş (okul şifresi ya da kişisel PIN), veri, plan, set
-- --------------------------------------------------------------------------
create or replace function public.kids_ogretmen_giris(p_kod text, p_sifre text)
returns json language plpgsql volatile security definer set search_path = public, extensions as $$
declare o kids_okullar; v_kilit boolean; v_t kids_ogretmenler;
begin
  select * into o from kids_okullar where kod = upper(trim(coalesce(p_kod, ''))) for update;
  if o.id is null then return json_build_object('tamam', false); end if;
  if not public.kids_okul_acik(o.id) then raise exception 'Okulunuzun Acadex Kids lisansı açık değil.' using errcode = '28000', hint = 'lisans'; end if;
  if o.sifre_kilit > now() then raise exception 'Çok fazla hatalı deneme. Biraz sonra yeniden deneyin.' using errcode = '28000', hint = 'kilit'; end if;
  if o.sifre_ozet is not null and extensions.crypt(coalesce(p_sifre, ''), o.sifre_ozet) = o.sifre_ozet then
    update kids_okullar set sifre_hata = 0, sifre_kilit = null, sifre_kilit_say = 0 where id = o.id;
    return json_build_object('tamam', true, 'token', public.kids_oturum_ac2('ogretmen', o.id, null, null, 14));
  end if;
  select * into v_t from kids_ogretmenler t where t.okul_id = o.id and t.aktif and extensions.crypt(coalesce(p_sifre, ''), t.pin_ozet) = t.pin_ozet limit 1;
  if v_t.id is not null then
    update kids_okullar set sifre_hata = 0, sifre_kilit = null, sifre_kilit_say = 0 where id = o.id;
    return json_build_object('tamam', true, 'ogretmen', v_t.ad, 'token', public.kids_oturum_ac2('ogretmen', o.id, null, v_t.id, 14));
  end if;
  v_kilit := o.sifre_hata + 1 >= 5;
  update kids_okullar set
    sifre_hata = case when v_kilit then 0 else sifre_hata + 1 end,
    sifre_kilit = case when v_kilit then now() + make_interval(mins => least(15 * power(2, sifre_kilit_say)::int, 1440)) else sifre_kilit end,
    sifre_kilit_say = case when v_kilit then least(sifre_kilit_say + 1, 7) else sifre_kilit_say end
  where id = o.id;
  return json_build_object('tamam', false);
end $$;

create or replace function public.kids_ogretmen_veri(p_token text, p_bas date, p_bit date)
returns json language plpgsql stable security definer set search_path = public as $$
declare o kids_oturumlar := public.kids_oturum(p_token, 'ogretmen');
begin
  if p_bit < p_bas or p_bit - p_bas > 62 then raise exception 'tarih aralığı geçersiz'; end if;
  return (select json_build_object('okul', json_build_object('kod', k.kod, 'ad', k.ad),
    'bugun', (now() at time zone 'Europe/Istanbul')::date,
    'ogretmen', (select t.ad from kids_ogretmenler t where t.id = o.ogretmen_id),
    'setler', coalesce((select json_agg(json_build_object('id', st.id, 'ad', st.ad, 'kelimeler', st.kelimeler) order by st.ad) from kids_setler st where st.okul_id = k.id), '[]'::json),
    'siniflar', coalesce((select json_agg(json_build_object('id', s.id, 'ad', s.ad, 'bant', s.bant,
        'ogr', coalesce((select json_agg(json_build_object('id', g.id, 'ad', g.ad, 'hayvan', g.hayvan, 'ilerleme', i.veri) order by g.ad, g.no)
          from kids_ogrenciler g left join kids_ilerleme i on i.ogrenci_id = g.id where g.sinif_id = s.id and g.aktif), '[]'::json),
        'plan', coalesce((select json_object_agg(p.gun::text, p.konu) from kids_plan p where p.sinif_id = s.id and p.gun between p_bas and p_bit), '{}'::json),
        'gunler', coalesce((select json_object_agg(p.gun::text, json_build_object('konu', p.konu, 'etkinlik', p.etkinlik, 'set', p.set_id)) from kids_plan p where p.sinif_id = s.id and p.gun between p_bas and p_bit), '{}'::json),
        'hafta', coalesce((select json_object_agg(h.hafta_gunu::text, json_build_object('konu', h.konu, 'etkinlik', h.etkinlik, 'set', h.set_id)) from kids_hafta h where h.sinif_id = s.id), '{}'::json))
      order by s.created_at) from kids_siniflar s where s.okul_id = k.id and public.kids_sinif_yetki(k.id, o.ogretmen_id, s.id)), '[]'::json))
    from kids_okullar k where k.id = o.okul_id);
end $$;

create or replace function public.kids_plan_koy(p_token text, p_sinif uuid, p_gun date, p_konu text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare o kids_oturumlar := public.kids_oturum(p_token, 'ogretmen');
begin
  if not public.kids_sinif_yetki(o.okul_id, o.ogretmen_id, p_sinif) then raise exception 'Bu sınıf size ait değil.' using errcode = '42501'; end if;
  if abs(p_gun - (now() at time zone 'Europe/Istanbul')::date) > 60 then raise exception 'Yalnız iki ay içindeki günler planlanabilir.'; end if;
  insert into kids_plan (sinif_id, gun, konu, updated_at) values (p_sinif, p_gun, coalesce(p_konu, ''), now())
  on conflict (sinif_id, gun) do update set konu = excluded.konu, updated_at = now();
end $$;

-- günün konusu + etkinlik + set birlikte; üçü de boşsa satır silinir (şablona döner)
create or replace function public.kids_gun_koy(p_token text, p_sinif uuid, p_gun date, p_konu text, p_set uuid, p_etkinlik text)
returns json language plpgsql volatile security definer set search_path = public as $$
declare o kids_oturumlar := public.kids_oturum(p_token, 'ogretmen'); v_k text := coalesce(p_konu, ''); v_e text := left(trim(coalesce(p_etkinlik, '')), 40);
begin
  if not public.kids_sinif_yetki(o.okul_id, o.ogretmen_id, p_sinif) then raise exception 'Bu sınıf size ait değil.' using errcode = '42501'; end if;
  if abs(p_gun - (now() at time zone 'Europe/Istanbul')::date) > 60 then raise exception 'Yalnız iki ay içindeki günler planlanabilir.'; end if;
  if not public.kids_konu_gecerli(v_k) then raise exception 'Konu geçersiz.'; end if;
  if p_set is not null and not exists (select 1 from kids_setler where id = p_set and okul_id = o.okul_id) then raise exception 'Kelime seti bulunamadı.'; end if;
  if v_k = '' and p_set is null and v_e = '' then
    delete from kids_plan where sinif_id = p_sinif and gun = p_gun;
  else
    insert into kids_plan (sinif_id, gun, konu, set_id, etkinlik, updated_at) values (p_sinif, p_gun, v_k, p_set, v_e, now())
    on conflict (sinif_id, gun) do update set konu = excluded.konu, set_id = excluded.set_id, etkinlik = excluded.etkinlik, updated_at = now();
  end if;
  return public.kids_gun_bilgi(p_sinif, p_gun);
end $$;

create or replace function public.kids_hafta_koy(p_token text, p_sinif uuid, p_hafta_gunu integer, p_konu text, p_set uuid, p_etkinlik text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare o kids_oturumlar := public.kids_oturum(p_token, 'ogretmen'); v_k text := coalesce(p_konu, ''); v_e text := left(trim(coalesce(p_etkinlik, '')), 40);
begin
  if not public.kids_sinif_yetki(o.okul_id, o.ogretmen_id, p_sinif) then raise exception 'Bu sınıf size ait değil.' using errcode = '42501'; end if;
  if p_hafta_gunu not between 1 and 5 then raise exception 'Hafta günü 1-5 olmalı.'; end if;
  if not public.kids_konu_gecerli(v_k) then raise exception 'Konu geçersiz.'; end if;
  if p_set is not null and not exists (select 1 from kids_setler where id = p_set and okul_id = o.okul_id) then raise exception 'Kelime seti bulunamadı.'; end if;
  if v_k = '' and p_set is null and v_e = '' then
    delete from kids_hafta where sinif_id = p_sinif and hafta_gunu = p_hafta_gunu;
  else
    insert into kids_hafta (sinif_id, hafta_gunu, konu, set_id, etkinlik, updated_at) values (p_sinif, p_hafta_gunu, v_k, p_set, v_e, now())
    on conflict (sinif_id, hafta_gunu) do update set konu = excluded.konu, set_id = excluded.set_id, etkinlik = excluded.etkinlik, updated_at = now();
  end if;
end $$;

create or replace function public.kids_set_kaydet(p_token text, p_id uuid, p_ad text, p_kelimeler text[])
returns json language plpgsql volatile security definer set search_path = public as $$
declare o kids_oturumlar := public.kids_oturum(p_token, 'ogretmen'); v uuid := p_id; k text[];
begin
  select array_agg(x order by i) into k from (select distinct on (x) x, i from unnest(p_kelimeler) with ordinality u(x, i) where x ~ '^[a-z0-9_-]{1,30}$' order by x, i) z;
  if coalesce(cardinality(k), 0) < 3 then raise exception 'Bir sette en az 3 kelime olmalı.'; end if;
  if cardinality(k) > 20 then raise exception 'Bir sette en çok 20 kelime olur.'; end if;
  if v is null then
    if (select count(*) from kids_setler where okul_id = o.okul_id) >= 60 then raise exception 'Bir okulda en çok 60 set olur.'; end if;
    insert into kids_setler (okul_id, ad, kelimeler) values (o.okul_id, trim(p_ad), k) returning id into v;
  else
    update kids_setler set ad = trim(p_ad), kelimeler = k, updated_at = now() where id = v and okul_id = o.okul_id;
    if not found then raise exception 'Kelime seti bulunamadı.'; end if;
  end if;
  perform public.kids_log(o.okul_id, 'ogretmen', case when p_id is null then 'set_ekle' else 'set_guncelle' end, jsonb_build_object('ad', trim(p_ad), 'adet', cardinality(k)));
  return public.kids_set_json(v);
exception when unique_violation then raise exception 'Bu adla bir set zaten var.';
end $$;

create or replace function public.kids_set_sil(p_token text, p_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
declare o kids_oturumlar := public.kids_oturum(p_token, 'ogretmen');
begin
  delete from kids_setler where id = p_id and okul_id = o.okul_id;
  if not found then raise exception 'Kelime seti bulunamadı.'; end if;
  perform public.kids_log(o.okul_id, 'ogretmen', 'set_sil', '{}'::jsonb);
end $$;

create or replace function public.kids_sinif_oturum_kapat(p_token text, p_sinif uuid)
returns integer language plpgsql volatile security definer set search_path = public as $$
declare o kids_oturumlar := public.kids_oturum(p_token, 'ogretmen'); n integer;
begin
  if not public.kids_sinif_yetki(o.okul_id, o.ogretmen_id, p_sinif) then raise exception 'Bu sınıf size ait değil.' using errcode = '42501'; end if;
  delete from kids_oturumlar k where k.tur = 'cocuk' and k.ogrenci_id in (select g.id from kids_ogrenciler g where g.sinif_id = p_sinif);
  get diagnostics n = row_count;
  return n;
end $$;

-- --------------------------------------------------------------------------
-- 8) kreş yöneticisi (müdür)
-- --------------------------------------------------------------------------
create or replace function public.kids_yonetici_giris(p_kod text, p_sifre text)
returns json language plpgsql volatile security definer set search_path = public, extensions as $$
declare o kids_okullar; v_kilit boolean;
begin
  select * into o from kids_okullar where kod = upper(trim(coalesce(p_kod, ''))) and aktif for update;
  if o.id is null or o.yonetici_ozet is null then return json_build_object('tamam', false); end if;
  if o.yonetici_kilit > now() then raise exception 'Çok fazla hatalı deneme. Biraz sonra yeniden deneyin.' using errcode = '28000', hint = 'kilit'; end if;
  if extensions.crypt(coalesce(p_sifre, ''), o.yonetici_ozet) <> o.yonetici_ozet then
    v_kilit := o.yonetici_hata + 1 >= 5;
    update kids_okullar set
      yonetici_hata = case when v_kilit then 0 else yonetici_hata + 1 end,
      yonetici_kilit = case when v_kilit then now() + make_interval(mins => least(15 * power(2, yonetici_kilit_say)::int, 1440)) else yonetici_kilit end,
      yonetici_kilit_say = case when v_kilit then least(yonetici_kilit_say + 1, 7) else yonetici_kilit_say end
    where id = o.id;
    return json_build_object('tamam', false);
  end if;
  update kids_okullar set yonetici_hata = 0, yonetici_kilit = null, yonetici_kilit_say = 0 where id = o.id;
  perform public.kids_log(o.id, 'yonetici', 'giris', '{}'::jsonb);
  return json_build_object('tamam', true, 'token', public.kids_oturum_ac2('yonetici', o.id, null, null, 30));
end $$;

create or replace function public.kids_yonetici_veri(p_token text)
returns json language plpgsql stable security definer set search_path = public as $$
declare o kids_oturumlar := public.kids_yon_oturum(p_token);
begin
  return (select json_build_object(
    'okul', json_build_object('kod', k.kod, 'ad', k.ad, 'il', k.il, 'ilce', k.ilce, 'yetkili_ad', k.yetkili_ad, 'lisans_bas', k.lisans_bas, 'lisans_bit', k.lisans_bit,
      'kota', k.kota, 'odeme', k.odeme, 'acik', public.kids_okul_acik(k.id), 'kalan_gun', k.lisans_bit - (now() at time zone 'Europe/Istanbul')::date,
      'ogretmen_sifre_var', k.sifre_ozet is not null,
      'ogrenci', (select count(*) from kids_ogrenciler g where g.okul_id = k.id and g.aktif)),
    'siniflar', coalesce((select json_agg(json_build_object('id', s.id, 'ad', s.ad, 'bant', s.bant,
        'ogr', coalesce((select json_agg(json_build_object('id', g.id, 'no', g.no, 'kimlik', k.kod || '-' || lpad(g.no::text, 3, '0'), 'ad', g.ad, 'hayvan', g.hayvan, 'sifre', g.sifre, 'aktif', g.aktif) order by g.ad, g.no)
          from kids_ogrenciler g where g.sinif_id = s.id), '[]'::json)) order by s.created_at) from kids_siniflar s where s.okul_id = k.id), '[]'::json),
    'ogretmenler', coalesce((select json_agg(json_build_object('id', t.id, 'ad', t.ad, 'siniflar', t.siniflar, 'aktif', t.aktif) order by t.ad) from kids_ogretmenler t where t.okul_id = k.id), '[]'::json))
    from kids_okullar k where k.id = o.okul_id);
end $$;

create or replace function public.kids_yon_sinif_kaydet(p_token text, p_id uuid, p_ad text, p_bant text)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare o kids_oturumlar := public.kids_yon_yazma(p_token); v uuid := p_id;
begin
  if p_bant not in ('minik', 'kasif', 'yildiz') then raise exception 'Yaş grubu geçersiz.'; end if;
  if v is null then
    if (select count(*) from kids_siniflar where okul_id = o.okul_id) >= 40 then raise exception 'Bir okulda en çok 40 sınıf olur.'; end if;
    insert into kids_siniflar (okul_id, ad, bant) values (o.okul_id, trim(p_ad), p_bant) returning id into v;
  else
    update kids_siniflar set ad = trim(p_ad), bant = p_bant where id = v and okul_id = o.okul_id;
    if not found then raise exception 'Sınıf bulunamadı.'; end if;
  end if;
  perform public.kids_log(o.okul_id, 'yonetici', case when p_id is null then 'sinif_ekle' else 'sinif_guncelle' end, jsonb_build_object('ad', trim(p_ad), 'bant', p_bant));
  return v;
exception when unique_violation then raise exception 'Bu okulda aynı adlı bir sınıf zaten var.';
end $$;

create or replace function public.kids_yon_sinif_sil(p_token text, p_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
declare o kids_oturumlar := public.kids_yon_yazma(p_token); n int;
begin
  select count(*) into n from kids_ogrenciler where sinif_id = p_id;
  delete from kids_siniflar where id = p_id and okul_id = o.okul_id;
  if not found then raise exception 'Sınıf bulunamadı.'; end if;
  update kids_ogretmenler set siniflar = array_remove(siniflar, p_id) where okul_id = o.okul_id;
  perform public.kids_log(o.okul_id, 'yonetici', 'sinif_sil', jsonb_build_object('ogrenci', n));
end $$;

-- toplu öğrenci (yönetim panelindeki kids_ogrenci_ekle ile aynı kurallar: ad kısaltılır, kota, hayvan, resimli şifre)
create or replace function public.kids_yon_ogrenci_ekle(p_token text, p_sinif uuid, p_adlar text[])
returns json language plpgsql volatile security definer set search_path = public as $$
declare o kids_oturumlar := public.kids_yon_yazma(p_token); v_kota int; n_aktif int; n_yeni int; v_no int; a text; h text; ids uuid[] := '{}'; yid uuid;
begin
  if not exists (select 1 from kids_siniflar where id = p_sinif and okul_id = o.okul_id) then raise exception 'Sınıf bulunamadı.'; end if;
  select kota into v_kota from kids_okullar where id = o.okul_id for update;
  select array_agg(x) into p_adlar from (select public.kids_ad_kisalt(t) x from unnest(p_adlar) with ordinality u(t, i) where length(trim(coalesce(t, ''))) > 0 order by i) z;
  n_yeni := coalesce(array_length(p_adlar, 1), 0);
  if n_yeni = 0 then raise exception 'Eklenecek ad yok.'; end if;
  if n_yeni > 100 then raise exception 'Tek seferde en çok 100 öğrenci eklenir.'; end if;
  select count(*) into n_aktif from kids_ogrenciler where okul_id = o.okul_id and aktif;
  if n_aktif + n_yeni > v_kota then raise exception 'Kota yetmiyor: % etkin öğrenci var, % eklenmek isteniyor, kota %.', n_aktif, n_yeni, v_kota; end if;
  select coalesce(max(no), 0) into v_no from kids_ogrenciler where okul_id = o.okul_id;
  foreach a in array p_adlar loop
    v_no := v_no + 1;
    select hv into h from unnest(array['tavsan', 'ayi', 'kedi', 'civciv', 'panda', 'kurbaga', 'tilki', 'kopek']) with ordinality x(hv, i)
      order by (select count(*) from kids_ogrenciler g where g.sinif_id = p_sinif and g.hayvan = x.hv), i limit 1;
    insert into kids_ogrenciler (okul_id, sinif_id, no, ad, hayvan, sifre) values (o.okul_id, p_sinif, v_no, a, h, public.kids_sifre_uret()) returning id into yid;
    ids := ids || yid;
  end loop;
  perform public.kids_log(o.okul_id, 'yonetici', 'ogrenci_ekle', jsonb_build_object('adet', n_yeni));
  return json_build_object('adet', n_yeni, 'ids', ids);
end $$;

-- p: {ad?, aktif?, sinif_id?}
create or replace function public.kids_yon_ogrenci_guncelle(p_token text, p_id uuid, p jsonb)
returns void language plpgsql volatile security definer set search_path = public as $$
declare o kids_oturumlar := public.kids_yon_yazma(p_token); g kids_ogrenciler; v_kota int; n int;
begin
  select * into g from kids_ogrenciler where id = p_id and okul_id = o.okul_id;
  if g.id is null then raise exception 'Öğrenci bulunamadı.'; end if;
  if (p->>'aktif')::boolean is true and not g.aktif then
    select kota into v_kota from kids_okullar where id = g.okul_id for update;
    select count(*) into n from kids_ogrenciler where okul_id = g.okul_id and aktif;
    if n + 1 > v_kota then raise exception 'Kota dolu (%/%).', n, v_kota; end if;
  end if;
  if p ? 'sinif_id' and not exists (select 1 from kids_siniflar where id = (p->>'sinif_id')::uuid and okul_id = g.okul_id) then raise exception 'Sınıf bu okula ait değil.'; end if;
  update kids_ogrenciler set ad = case when length(trim(coalesce(p->>'ad', ''))) > 0 then public.kids_ad_kisalt(p->>'ad') else ad end, aktif = coalesce((p->>'aktif')::boolean, aktif),
    sinif_id = coalesce((p->>'sinif_id')::uuid, sinif_id) where id = p_id;
  perform public.kids_log(o.okul_id, 'yonetici', 'ogrenci_guncelle', p - 'ad');
end $$;

create or replace function public.kids_yon_ogrenci_sifre_yenile(p_token text, p_ids uuid[])
returns integer language plpgsql volatile security definer set search_path = public as $$
declare o kids_oturumlar := public.kids_yon_yazma(p_token); n int;
begin
  update kids_ogrenciler set sifre = public.kids_sifre_uret() where id = any(p_ids) and okul_id = o.okul_id;
  get diagnostics n = row_count;
  delete from kids_oturumlar where tur = 'cocuk' and ogrenci_id = any(p_ids) and okul_id = o.okul_id;
  perform public.kids_log(o.okul_id, 'yonetici', 'sifre_yenile', jsonb_build_object('adet', n));
  return n;
end $$;

create or replace function public.kids_yon_ogrenci_sil(p_token text, p_ids uuid[])
returns integer language plpgsql volatile security definer set search_path = public as $$
declare o kids_oturumlar := public.kids_yon_yazma(p_token); n int;
begin
  delete from kids_ogrenciler where id = any(p_ids) and okul_id = o.okul_id;
  get diagnostics n = row_count;
  perform public.kids_log(o.okul_id, 'yonetici', 'ogrenci_sil', jsonb_build_object('adet', n));
  return n;
end $$;

-- PIN üretir; okulda başka bir öğretmenin PIN'i ya da okul şifresiyle çakışmaz
create or replace function public.kids_pin_bos(p_okul uuid, p_haric uuid)
returns text language plpgsql volatile security definer set search_path = public, extensions as $$
declare s text; k kids_okullar; i int := 0;
begin
  select * into k from kids_okullar where id = p_okul;
  loop
    s := public.kids_pin_uret(); i := i + 1;
    exit when (k.sifre_ozet is null or extensions.crypt(s, k.sifre_ozet) <> k.sifre_ozet)
      and not exists (select 1 from kids_ogretmenler t where t.okul_id = p_okul and t.id is distinct from p_haric and extensions.crypt(s, t.pin_ozet) = t.pin_ozet);
    if i > 20 then raise exception 'PIN üretilemedi, yeniden deneyin.'; end if;
  end loop;
  return s;
end $$;

-- yeni öğretmende PIN yalnız bu yanıtta döner
create or replace function public.kids_yon_ogretmen_kaydet(p_token text, p_id uuid, p_ad text, p_siniflar uuid[], p_aktif boolean)
returns json language plpgsql volatile security definer set search_path = public, extensions as $$
declare o kids_oturumlar := public.kids_yon_yazma(p_token); v uuid := p_id; s text; sn uuid[];
begin
  select coalesce(array_agg(x), '{}') into sn from unnest(coalesce(p_siniflar, '{}')) x where exists (select 1 from kids_siniflar c where c.id = x and c.okul_id = o.okul_id);
  if v is null then
    if (select count(*) from kids_ogretmenler where okul_id = o.okul_id) >= 50 then raise exception 'Bir okulda en çok 50 öğretmen olur.'; end if;
    s := public.kids_pin_bos(o.okul_id, null);
    insert into kids_ogretmenler (okul_id, ad, pin_ozet, siniflar) values (o.okul_id, trim(p_ad), extensions.crypt(s, extensions.gen_salt('bf', 8)), sn) returning id into v;
  else
    update kids_ogretmenler set ad = trim(p_ad), siniflar = sn, aktif = coalesce(p_aktif, aktif) where id = v and okul_id = o.okul_id;
    if not found then raise exception 'Öğretmen bulunamadı.'; end if;
    if p_aktif is false then delete from kids_oturumlar where ogretmen_id = v; end if;
  end if;
  perform public.kids_log(o.okul_id, 'yonetici', case when p_id is null then 'ogretmen_ekle' else 'ogretmen_guncelle' end, jsonb_build_object('sinif', cardinality(sn)));
  return json_build_object('id', v, 'pin', s);
exception when unique_violation then raise exception 'Bu adla bir öğretmen zaten var.';
end $$;

create or replace function public.kids_yon_ogretmen_pin(p_token text, p_id uuid)
returns text language plpgsql volatile security definer set search_path = public, extensions as $$
declare o kids_oturumlar := public.kids_yon_yazma(p_token); s text;
begin
  if not exists (select 1 from kids_ogretmenler where id = p_id and okul_id = o.okul_id) then raise exception 'Öğretmen bulunamadı.'; end if;
  s := public.kids_pin_bos(o.okul_id, p_id);
  update kids_ogretmenler set pin_ozet = extensions.crypt(s, extensions.gen_salt('bf', 8)) where id = p_id;
  delete from kids_oturumlar where ogretmen_id = p_id;
  perform public.kids_log(o.okul_id, 'yonetici', 'ogretmen_pin', '{}'::jsonb);
  return s;
end $$;

create or replace function public.kids_yon_ogretmen_sil(p_token text, p_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
declare o kids_oturumlar := public.kids_yon_yazma(p_token);
begin
  delete from kids_ogretmenler where id = p_id and okul_id = o.okul_id;
  if not found then raise exception 'Öğretmen bulunamadı.'; end if;
  perform public.kids_log(o.okul_id, 'yonetici', 'ogretmen_sil', '{}'::jsonb);
end $$;

-- okulun ortak öğretmen şifresi (6 hane); düz hâli yalnız bu yanıtta döner
create or replace function public.kids_yon_okul_sifre(p_token text)
returns text language plpgsql volatile security definer set search_path = public, extensions as $$
declare o kids_oturumlar := public.kids_yon_yazma(p_token); s text; i int := 0;
begin
  loop
    s := public.kids_pin_uret(); i := i + 1;
    exit when not exists (select 1 from kids_ogretmenler t where t.okul_id = o.okul_id and extensions.crypt(s, t.pin_ozet) = t.pin_ozet);
    if i > 20 then raise exception 'Şifre üretilemedi, yeniden deneyin.'; end if;
  end loop;
  update kids_okullar set sifre_ozet = extensions.crypt(s, extensions.gen_salt('bf')), updated_at = now() where id = o.okul_id;
  delete from kids_oturumlar where okul_id = o.okul_id and tur = 'ogretmen' and ogretmen_id is null;
  perform public.kids_log(o.okul_id, 'yonetici', 'okul_sifre', '{}'::jsonb);
  return s;
end $$;

create or replace function public.kids_yon_sifre_degistir(p_token text, p_eski text, p_yeni text)
returns void language plpgsql volatile security definer set search_path = public, extensions as $$
declare o kids_oturumlar := public.kids_yon_oturum(p_token); k kids_okullar;
begin
  select * into k from kids_okullar where id = o.okul_id for update;
  if extensions.crypt(coalesce(p_eski, ''), k.yonetici_ozet) <> k.yonetici_ozet then raise exception 'Mevcut şifre yanlış.'; end if;
  if length(coalesce(p_yeni, '')) < 8 then raise exception 'Yeni şifre en az 8 karakter olmalı.'; end if;
  update kids_okullar set yonetici_ozet = extensions.crypt(p_yeni, extensions.gen_salt('bf', 8)), updated_at = now() where id = o.okul_id;
  delete from kids_oturumlar where okul_id = o.okul_id and tur = 'yonetici' and ozet <> o.ozet;
  perform public.kids_log(o.okul_id, 'yonetici', 'sifre_degistir', '{}'::jsonb);
end $$;

-- --------------------------------------------------------------------------
-- 9) başvuru (anon) ve yönetim panelinden onay
-- --------------------------------------------------------------------------
-- p: {kres_ad, il, ilce, yetkili_ad, tel, eposta, ogrenci_sayi, mesaj, kvkk:true}
-- Sınır aşımında hata FIRLATMAZ, {tamam:false, mesaj} döner (kids_okul_bul ile aynı kalıp).
create or replace function public.kids_basvuru_yap(p jsonb)
returns json language plpgsql volatile security definer set search_path = public as $$
declare v_ip text := public.kids_istemci_ip();
begin
  if coalesce(p->>'kvkk', '') <> 'true' then return json_build_object('tamam', false, 'mesaj', 'Aydınlatma metnini onaylamanız gerekiyor.'); end if;
  if (select count(*) from kids_basvurular where ip = v_ip and created_at > now() - interval '1 day') >= 3 then
    return json_build_object('tamam', false, 'mesaj', 'Bugün bu bağlantıdan yeterince başvuru yapıldı. Yarın yeniden deneyin ya da bizi arayın.');
  end if;
  if (select count(*) from kids_basvurular where created_at > now() - interval '1 day') >= 300 then
    return json_build_object('tamam', false, 'mesaj', 'Şu an çok yoğunuz. Lütfen biraz sonra yeniden deneyin.');
  end if;
  insert into kids_basvurular (kres_ad, il, ilce, yetkili_ad, tel, eposta, ogrenci_sayi, mesaj, ip)
  values (trim(p->>'kres_ad'), left(trim(coalesce(p->>'il', '')), 40), left(trim(coalesce(p->>'ilce', '')), 60), trim(p->>'yetkili_ad'),
    trim(p->>'tel'), lower(trim(coalesce(p->>'eposta', ''))), least(greatest(coalesce((p->>'ogrenci_sayi')::int, 0), 0), 2000),
    left(trim(coalesce(p->>'mesaj', '')), 500), v_ip);
  return json_build_object('tamam', true);
exception
  when check_violation or not_null_violation then return json_build_object('tamam', false, 'mesaj', 'Lütfen kreş adını, yetkili adını ve telefonu doğru yazın.');
  when invalid_text_representation then return json_build_object('tamam', false, 'mesaj', 'Öğrenci sayısı rakam olmalı.');
end $$;

create or replace function public.kids_basvuru_liste()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_guard();
  return coalesce((select json_agg(json_build_object('id', b.id, 'kres_ad', b.kres_ad, 'il', b.il, 'ilce', b.ilce, 'yetkili_ad', b.yetkili_ad, 'tel', b.tel,
      'eposta', b.eposta, 'ogrenci_sayi', b.ogrenci_sayi, 'mesaj', b.mesaj, 'durum', b.durum, 'okul_id', b.okul_id, 'okul_kod', o.kod,
      'created_at', b.created_at, 'karar_at', b.karar_at) order by (b.durum = 'bekliyor') desc, b.created_at desc)
    from (select * from kids_basvurular order by created_at desc limit 300) b left join kids_okullar o on o.id = b.okul_id), '[]'::json);
end $$;

-- onay: okul 'deneme' olarak açılır; yönetici şifresi (8 harf) ve öğretmen şifresi (6 hane) YALNIZ bu yanıtta döner
create or replace function public.kids_basvuru_onayla(p_id uuid, p_kod text, p_gun integer, p_kota integer)
returns json language plpgsql volatile security definer set search_path = public, extensions as $$
declare b kids_basvurular; v_okul uuid; ys text := public.kids_okunakli_sifre(8); os text := public.kids_pin_uret();
begin
  perform public.admin_guard();
  select * into b from kids_basvurular where id = p_id for update;
  if b.id is null then raise exception 'Başvuru bulunamadı.'; end if;
  if b.durum = 'onaylandi' then raise exception 'Bu başvuru zaten onaylandı.'; end if;
  insert into kids_okullar (kod, ad, ilce, il, yetkili_ad, yetkili_tel, eposta, lisans_bas, lisans_bit, kota, ucret_kurus, odeme, kaynak, sifre_ozet, yonetici_ozet, notlar)
  values (upper(trim(p_kod)), b.kres_ad, b.ilce, coalesce(nullif(b.il, ''), 'Ankara'), b.yetkili_ad, b.tel, b.eposta,
    current_date, current_date + least(greatest(coalesce(p_gun, 14), 1), 60), least(greatest(coalesce(p_kota, 40), 1), 5000), 0, 'deneme', 'basvuru',
    extensions.crypt(os, extensions.gen_salt('bf')), extensions.crypt(ys, extensions.gen_salt('bf', 8)),
    'Başvuru: ' || to_char(b.created_at at time zone 'Europe/Istanbul', 'DD.MM.YYYY') || coalesce(nullif(' · ' || b.mesaj, ' · '), ''))
  returning id into v_okul;
  update kids_basvurular set durum = 'onaylandi', okul_id = v_okul, karar_at = now() where id = p_id;
  perform public.admin_log('kids_basvuru_onayla', null, upper(trim(p_kod)) || ' · ' || b.kres_ad, jsonb_build_object('gun', p_gun, 'kota', p_kota));
  return json_build_object('okul', public.kids_okul_json(v_okul), 'yonetici_sifre', ys, 'ogretmen_sifre', os);
exception when unique_violation then raise exception 'Bu okul kodu başka bir okulda kullanılıyor.';
end $$;

create or replace function public.kids_basvuru_reddet(p_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.admin_guard();
  update kids_basvurular set durum = 'reddedildi', karar_at = now() where id = p_id and durum = 'bekliyor';
  if not found then raise exception 'Bekleyen başvuru bulunamadı.'; end if;
  perform public.admin_log('kids_basvuru_reddet', null, null, jsonb_build_object('id', p_id));
end $$;

-- yönetim panelinden kurulan okullar için (örn. Acadia Kreş) yönetici şifresi üretir; düz hâli bir kez döner
create or replace function public.kids_okul_yonetici_sifre(p_okul uuid)
returns text language plpgsql volatile security definer set search_path = public, extensions as $$
declare s text := public.kids_okunakli_sifre(8);
begin
  perform public.admin_guard();
  update kids_okullar set yonetici_ozet = extensions.crypt(s, extensions.gen_salt('bf', 8)), yonetici_hata = 0, yonetici_kilit = null, yonetici_kilit_say = 0, updated_at = now() where id = p_okul;
  if not found then raise exception 'Okul bulunamadı.'; end if;
  delete from kids_oturumlar where okul_id = p_okul and tur = 'yonetici';
  perform public.admin_log('kids_okul_yonetici_sifre', null, (select kod from kids_okullar where id = p_okul), '{}'::jsonb);
  return s;
end $$;

-- okul özeti: yönetici şifresi var mı, kaynak, e-posta eklendi
create or replace function public.kids_okul_json(p_okul uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('id', o.id, 'kod', o.kod, 'ad', o.ad, 'ilce', o.ilce, 'il', o.il, 'yetkili_ad', o.yetkili_ad, 'yetkili_tel', o.yetkili_tel,
    'lisans_bas', o.lisans_bas, 'lisans_bit', o.lisans_bit, 'kota', o.kota, 'ucret_kurus', o.ucret_kurus, 'odeme', o.odeme, 'notlar', o.notlar, 'aktif', o.aktif,
    'sifre_var', o.sifre_ozet is not null, 'yonetici_var', o.yonetici_ozet is not null, 'kaynak', o.kaynak, 'eposta', o.eposta, 'created_at', o.created_at,
    'ogrenci', (select count(*) from kids_ogrenciler g where g.okul_id = o.id and g.aktif),
    'sinif', (select count(*) from kids_siniflar s where s.okul_id = o.id),
    'ogretmen', (select count(*) from kids_ogretmenler t where t.okul_id = o.id and t.aktif))
  from kids_okullar o where o.id = p_okul
$$;

-- --------------------------------------------------------------------------
-- 10) yetkiler
-- --------------------------------------------------------------------------
do $$ declare f text; begin
  -- iç yardımcılar: kimse doğrudan çağıramaz
  foreach f in array array['kids_konu_gecerli(text)', 'kids_okunakli_sifre(integer)', 'kids_pin_uret()', 'kids_oturum_ac2(text, uuid, uuid, uuid, integer)',
    'kids_oturum(text, text)', 'kids_yon_oturum(text)', 'kids_yon_yazma(text)', 'kids_sinif_yetki(uuid, uuid, uuid)', 'kids_log(uuid, text, text, jsonb)',
    'kids_set_json(uuid)', 'kids_gun_bilgi(uuid, date)', 'kids_pin_bos(uuid, uuid)', 'kids_okul_json(uuid)'] loop
    execute 'revoke all on function public.' || f || ' from public, anon, authenticated';
  end loop;
  -- kids sitesi (anon): oturum anahtarıyla
  foreach f in array array['kids_durum(text)', 'kids_ogretmen_giris(text, text)', 'kids_ogretmen_veri(text, date, date)', 'kids_plan_koy(text, uuid, date, text)',
    'kids_gun_koy(text, uuid, date, text, uuid, text)', 'kids_hafta_koy(text, uuid, integer, text, uuid, text)', 'kids_set_kaydet(text, uuid, text, text[])',
    'kids_set_sil(text, uuid)', 'kids_sinif_oturum_kapat(text, uuid)',
    'kids_yonetici_giris(text, text)', 'kids_yonetici_veri(text)', 'kids_yon_sinif_kaydet(text, uuid, text, text)', 'kids_yon_sinif_sil(text, uuid)',
    'kids_yon_ogrenci_ekle(text, uuid, text[])', 'kids_yon_ogrenci_guncelle(text, uuid, jsonb)', 'kids_yon_ogrenci_sifre_yenile(text, uuid[])',
    'kids_yon_ogrenci_sil(text, uuid[])', 'kids_yon_ogretmen_kaydet(text, uuid, text, uuid[], boolean)', 'kids_yon_ogretmen_pin(text, uuid)',
    'kids_yon_ogretmen_sil(text, uuid)', 'kids_yon_okul_sifre(text)', 'kids_yon_sifre_degistir(text, text, text)', 'kids_basvuru_yap(jsonb)'] loop
    execute 'revoke all on function public.' || f || ' from public';
    execute 'grant execute on function public.' || f || ' to anon, authenticated';
  end loop;
  -- yönetim paneli: oturum açmış kullanıcı; içeride admin_guard() yöneticiyi ister
  foreach f in array array['kids_basvuru_liste()', 'kids_basvuru_onayla(uuid, text, integer, integer)', 'kids_basvuru_reddet(uuid)', 'kids_okul_yonetici_sifre(uuid)'] loop
    execute 'revoke all on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;

notify pgrst, 'reload schema';
