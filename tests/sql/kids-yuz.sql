-- Acadex Kids: sınıfta eşsiz yüz (hayvan + renk) davranış testi (tests/kids-kres.js çalıştırır).
\set ON_ERROR_STOP 1
do $$
declare ok json; okul uuid; ys text; yt text; s1 uuid; s2 uuid; adlar text[]; v json; b json; g1 uuid; n int; yz record;
begin
  perform set_config('test.admin', '1', true);
  ok := kids_okul_kaydet('{"kod":"YZ-2026","ad":"Yüz Kreş","kota":200}'::jsonb); okul := (ok->>'id')::uuid;
  ys := kids_okul_yonetici_sifre(okul); yt := kids_yonetici_giris('YZ-2026', ys)->>'token';
  s1 := kids_yon_sinif_kaydet(yt, null, 'Kalabalık', 'kasif'); s2 := kids_yon_sinif_kaydet(yt, null, 'Küçük', 'minik');
  select array_agg('Çocuk ' || i) into adlar from generate_series(1, 30) i;
  perform kids_yon_ogrenci_ekle(yt, s1, adlar);
  -- yönetim panelindeki (admin) yol da aynı kuralı izler
  perform kids_ogrenci_ekle(s1, array['Admin Bir', 'Admin İki']);
  assert (select count(distinct (hayvan, renk)) from kids_ogrenciler where sinif_id = s1) = 32, '32 çocuk, 32 farklı yüz';
  assert (select count(distinct hayvan) from (select hayvan from kids_ogrenciler where sinif_id = s1 order by no limit 8) z) = 8, 'ilk 8 çocuk 8 ayrı hayvan';
  assert (select max(c) - min(c) from (select count(*) c from kids_ogrenciler where sinif_id = s1 group by hayvan) z) <= 1, 'hayvanlar dengeli';
  -- 64'e kadar eşsiz
  select array_agg('Ek ' || i) into adlar from generate_series(1, 32) i;
  perform kids_yon_ogrenci_ekle(yt, s1, adlar);
  assert (select count(distinct (hayvan, renk)) from kids_ogrenciler where sinif_id = s1) = 64, '64 çocuk, 64 farklı yüz';
  -- sınıf değiştiren çocuk, çakışırsa yeni yüz alır
  perform kids_yon_ogrenci_ekle(yt, s2, array['Küçük Bir']);
  select id, hayvan, renk into yz from kids_ogrenciler where sinif_id = s1 and hayvan = (select hayvan from kids_ogrenciler where sinif_id = s2) and renk = (select renk from kids_ogrenciler where sinif_id = s2);
  perform kids_yon_ogrenci_guncelle(yt, yz.id, jsonb_build_object('sinif_id', s2));
  assert (select count(distinct (hayvan, renk)) from kids_ogrenciler where sinif_id = s2) = 2, 'taşınan çocuk çakışmaz';
  -- ad değişikliği yüzü değiştirmez
  select id, hayvan, renk into yz from kids_ogrenciler where sinif_id = s1 order by no limit 1;
  perform kids_yon_ogrenci_guncelle(yt, yz.id, '{"ad":"Yeni Ad"}'::jsonb);
  assert (select hayvan = yz.hayvan and renk = yz.renk from kids_ogrenciler where id = yz.id), 'ad değişince yüz aynı';
  -- pasif çocuğun yerini yeni gelen alabilir; eski çocuk dönünce yeni yüz alır
  perform kids_yon_ogrenci_guncelle(yt, yz.id, '{"aktif":false}'::jsonb);
  perform kids_yon_ogrenci_ekle(yt, s1, array['Yeni Gelen']);
  assert (select count(distinct (hayvan, renk)) = count(*) from kids_ogrenciler where sinif_id = s1 and aktif), 'yeni gelen boş bir yüz alır';
  perform kids_yon_ogrenci_guncelle(yt, yz.id, '{"aktif":true}'::jsonb);
  assert (select count(*) from kids_ogrenciler where sinif_id = s1 and aktif) = 64, '64 etkin';
  assert (select count(distinct (hayvan, renk)) from kids_ogrenciler where sinif_id = s1 and aktif) = 64, 'dönen çocuk çakışmaz';
  -- çıktılarda renk var
  b := kids_okul_bul('YZ-2026');
  assert (b->'siniflar'->0->'ogr'->0)::jsonb ? 'renk', 'okul_bul renk';
  v := kids_yonetici_veri(yt);
  assert (v->'siniflar'->0->'ogr'->0)::jsonb ? 'renk', 'yonetici_veri renk';
  v := kids_okul_detay(okul);
  assert (v->'ogrenciler'->0)::jsonb ? 'renk', 'okul_detay renk';
  raise notice 'YUZ GECTI';
end $$;
