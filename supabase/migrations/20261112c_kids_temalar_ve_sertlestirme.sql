-- ==========================================================================
-- ACADEX KIDS — 22 TEMA + GİRİŞ SERTLEŞTİRME (12.11.2026)
-- Önce 20261110_kids_yonetim.sql ve 20261110b_kids_giris.sql çalışmış olmalı.
-- Tekrar çalıştırmak güvenlidir.
--
-- 1) YENİ TEMALAR (hata): kids-temalar2.js ile tema sayısı 12'den 22'ye çıktı,
--    öğretmen paneli hepsini günün konusu olarak seçtiriyor; kids_plan'ın konu
--    kuralı ise eski 12'de kalmıştı. Fruits/Transport/… seçen öğretmen kayıt
--    hatası alıyordu. Kural istemcideki V.KONU ile eşitlenir.
--
-- 2) OKUL KODU TARAMASI (güvenlik): okul kodu okul adından türetiliyor
--    (Mavi Bulut → MB-2026; veli kolay yazsın diye bilinçli). kids_okul_bul
--    sınırsız çağrılabildiği için doğru kodu bulan biri okuldaki BÜTÜN
--    çocukların adını çekebiliyordu (KVKK: reşit olmayan veri). Artık IP
--    başına 10 dakikada 30 başarısız arama. Başarısız arama HATA FIRLATMAZ,
--    JSON döner — fırlatsaydı sayaç işlemle birlikte geri alınır, sınır hiç
--    dolmazdı. İstemci (kids-bulut.js) iki biçimi de tanır.
--
-- 3) ÇOCUK KİLİDİ (güvenlik): resimli şifre 9 resimden 2'li sıra = 72 ihtimal.
--    5 yanlışta 5 dk kilit vardı ama sayaç her kilitten sonra sıfırlanıyordu,
--    yani tüm havuz ~1 saatte denenebiliyordu. Kilit artık katlanıyor
--    (5, 10, 20 … en çok 1440 dk); doğru girişte sıfırlanır. Normal kullanan
--    çocuk etkilenmez: üst üste 5 yanlış yapmadıkça kilit hiç kurulmaz.
--
-- Teste bağlı: tests/kids-giris.js
-- ==========================================================================

-- 1) 22 TEMA ---------------------------------------------------------------
alter table public.kids_plan drop constraint if exists kids_plan_konu_check;
alter table public.kids_plan add constraint kids_plan_konu_check check (konu in (
  '',                                                                                  -- serbest gün
  'colours', 'numbers', 'animals', 'family', 'body', 'food', 'toys', 'clothes',
  'home', 'school', 'weather', 'feelings',                                             -- ilk on iki
  'fruits', 'transport', 'shapes', 'sea', 'jobs', 'actions', 'seasons', 'days',
  'places', 'alphabet'                                                                 -- 12.11'de eklenen on
));

-- 2) OKUL KODU ARAMASI ------------------------------------------------------
create table if not exists public.kids_kod_deneme (
  ip      text primary key,
  sayi    integer not null default 0,
  pencere timestamptz not null default now()
);
alter table public.kids_kod_deneme enable row level security;
revoke all on public.kids_kod_deneme from anon, authenticated;

-- İstemci IP'si PostgREST istek başlıklarından (Cloudflare önce).
create or replace function public.kids_istemci_ip()
returns text language sql stable set search_path = public as $$
  select coalesce(
    nullif(current_setting('request.headers', true)::json->>'cf-connecting-ip', ''),
    nullif(trim(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1)), ''),
    'bilinmiyor')
$$;
revoke all on function public.kids_istemci_ip() from public, anon, authenticated;

create or replace function public.kids_okul_bul(p_kod text)
returns json language plpgsql volatile security definer set search_path = public as $$
declare o kids_okullar; v_ip text := public.kids_istemci_ip(); d kids_kod_deneme;
begin
  select * into d from kids_kod_deneme where ip = v_ip;
  if d.ip is not null and d.pencere > now() - interval '10 minutes' and d.sayi >= 30 then
    return json_build_object('hata', 'kilit', 'mesaj', 'Çok fazla deneme oldu. Birkaç dakika sonra yeniden dene.');
  end if;
  select * into o from kids_okullar where kod = upper(trim(coalesce(p_kod, '')));
  if o.id is null then
    insert into kids_kod_deneme (ip, sayi, pencere) values (v_ip, 1, now())
    on conflict (ip) do update set
      sayi = case when kids_kod_deneme.pencere > now() - interval '10 minutes' then kids_kod_deneme.sayi + 1 else 1 end,
      pencere = case when kids_kod_deneme.pencere > now() - interval '10 minutes' then kids_kod_deneme.pencere else now() end;
    delete from kids_kod_deneme where pencere < now() - interval '1 day';
    return json_build_object('hata', 'yok', 'mesaj', 'Bu kodu bulamadım.');
  end if;
  if not public.kids_okul_acik(o.id) then raise exception 'Okulunuzun Acadex Kids lisansı açık değil.' using errcode = '28000', hint = 'lisans'; end if;
  return json_build_object('kod', o.kod, 'ad', o.ad, 'siniflar', coalesce((select json_agg(json_build_object('id', s.id, 'ad', s.ad, 'bant', s.bant,
      'ogr', coalesce((select json_agg(json_build_object('id', g.id, 'ad', g.ad, 'hayvan', g.hayvan) order by g.ad, g.no) from kids_ogrenciler g where g.sinif_id = s.id and g.aktif), '[]'::json))
    order by s.created_at) from kids_siniflar s where s.okul_id = o.id), '[]'::json));
end $$;

-- 3) KATLANAN ÇOCUK KİLİDİ --------------------------------------------------
alter table public.kids_ogrenciler add column if not exists kilit_say integer not null default 0;

create or replace function public.kids_giris(p_ogrenci uuid, p_sifre text[])
returns json language plpgsql volatile security definer set search_path = public as $$
declare g kids_ogrenciler; v_kilit boolean;
begin
  select * into g from kids_ogrenciler where id = p_ogrenci and aktif for update;
  if g.id is null or not public.kids_okul_acik(g.okul_id) then raise exception 'Giriş yapılamadı.' using errcode = '28000', hint = 'yok'; end if;
  if g.kilit_bitis > now() then raise exception 'Biraz dinlenelim; birkaç dakika sonra yeniden dene.' using errcode = '28000', hint = 'kilit'; end if;
  if p_sifre is distinct from g.sifre then
    v_kilit := g.hata_sayi + 1 >= 5;
    update kids_ogrenciler set
      hata_sayi = case when v_kilit then 0 else hata_sayi + 1 end,
      kilit_bitis = case when v_kilit then now() + make_interval(mins => least(5 * power(2, kilit_say)::int, 1440)) else kilit_bitis end,
      kilit_say = case when v_kilit then least(kilit_say + 1, 9) else kilit_say end
    where id = g.id;
    return json_build_object('tamam', false, 'kilit', v_kilit);
  end if;
  update kids_ogrenciler set hata_sayi = 0, kilit_bitis = null, kilit_say = 0 where id = g.id;
  return json_build_object('tamam', true, 'token', public.kids_oturum_ac('cocuk', g.okul_id, g.id, 90));
end $$;

-- yetkiler (yeniden oluşturulan fonksiyonlar için)
revoke all on function public.kids_okul_bul(text) from public;
grant execute on function public.kids_okul_bul(text) to anon, authenticated;
revoke all on function public.kids_giris(uuid, text[]) from public;
grant execute on function public.kids_giris(uuid, text[]) to anon, authenticated;

notify pgrst, 'reload schema';
