-- Acadex Kids kreş davranış testi (tests/kids-kres.js çalıştırır; ACADEX_PG gerekir). Hata olursa exception.
-- Akış: yönetim panelinden okul + yönetici şifresi → kreş yöneticisi (sınıf, toplu öğrenci, öğretmen PIN'i)
-- → PIN'li öğretmen (yalnız kendi sınıfı, kelime seti, günün etkinliği, haftalık şablon) → çocuk durumu
-- → okul ortak şifresi → kapatılan öğretmenin oturumu → başvuru (IP sınırı, KVKK onayı) → onay ve deneme
-- → deneme bitince salt okunur yönetici → yönetici kilidi → anon yetkileri (Supabase varsayılan yetkileriyle).
\set ON_ERROR_STOP 1
do $$
declare ok json; okul uuid; ys text; yt text; v json; s1 uuid; s2 uuid; r json; pin text; ot text; st json; ogr uuid; sf text[]; ct text; d json; e text; bv json; bid uuid;
begin
  perform set_config('test.admin', '1', true);
  ok := kids_okul_kaydet('{"kod":"AK-2026","ad":"Acadia Kreş","kota":40}'::jsonb); okul := (ok->>'id')::uuid;
  ys := kids_okul_yonetici_sifre(okul);
  assert length(ys) = 8, 'yönetici şifresi 8';
  assert (kids_yonetici_giris('AK-2026', 'yanlis')->>'tamam')::boolean = false;
  r := kids_yonetici_giris('ak-2026', ys); yt := r->>'token'; assert yt is not null, 'yönetici token';
  s1 := kids_yon_sinif_kaydet(yt, null, 'Güneş Sınıfı', 'kasif'); s2 := kids_yon_sinif_kaydet(yt, null, 'Ay Sınıfı', 'minik');
  r := kids_yon_ogrenci_ekle(yt, s1, array['Ada Kaya', 'Mert Yılmaz', 'Elif Sarı']); assert (r->>'adet')::int = 3;
  perform kids_yon_ogrenci_ekle(yt, s2, array['Can Demir']);
  v := kids_yonetici_veri(yt);
  assert json_array_length(v->'siniflar') = 2 and (v->'okul'->>'ogrenci')::int = 4 and (v->'okul'->>'acik')::boolean;
  assert (select ad from kids_ogrenciler where okul_id = okul and no = 1) = 'Ada K.', 'KVKK kısaltma';
  r := kids_yon_ogretmen_kaydet(yt, null, 'Ayşe Öğretmen', array[s1], null); pin := r->>'pin'; assert pin ~ '^[0-9]{6}$', 'pin';
  ot := (kids_ogretmen_giris('AK-2026', pin))->>'token'; assert ot is not null, 'pin ile giriş';
  v := kids_ogretmen_veri(ot, current_date - 7, current_date + 7);
  assert json_array_length(v->'siniflar') = 1 and v->>'ogretmen' = 'Ayşe Öğretmen', 'yalnız kendi sınıfı';
  st := kids_set_kaydet(ot, null, 'Sonbahar projemiz', array['leaf', 'pumpkin', 'rain', 'leaf', 'BAD ID', 'umbrella']);
  assert json_array_length(st->'kelimeler') = 4, 'tekrar ve geçersiz kimlik atılır: ' || st::text;
  d := kids_gun_koy(ot, s1, (now() at time zone 'Europe/Istanbul')::date, 'seasons', (st->>'id')::uuid, 'Bahçe günü');
  assert d->>'kaynak' = 'plan' and d->'set'->>'ad' = 'Sonbahar projemiz';
  perform kids_hafta_koy(ot, s1, 3, 'fruits', null, 'Meyve günü');
  d := kids_gun_bilgi(s1, date '2026-11-18');   -- Çarşamba
  assert d->>'etkinlik' = 'Meyve günü' and d->>'kaynak' = 'hafta', 'haftalık şablon: ' || d::text;
  d := kids_gun_bilgi(s1, date '2026-11-21');   -- Cumartesi
  assert d->>'kaynak' is null;
  begin perform kids_gun_koy(ot, s2, current_date, 'colours', null, ''); e := 'yok'; exception when others then e := sqlerrm; end;
  assert e like 'Bu sınıf size ait değil%', 'başka sınıf: ' || e;
  begin perform kids_gun_koy(ot, s1, current_date, 'hacker', null, ''); e := 'yok'; exception when others then e := sqlerrm; end;
  assert e = 'Konu geçersiz.';
  -- çocuk
  select id, sifre into ogr, sf from kids_ogrenciler where okul_id = okul and no = 1;
  ct := (kids_giris(ogr, sf))->>'token'; d := kids_durum(ct);
  assert d->>'bugun' = 'seasons' and d->>'etkinlik' = 'Bahçe günü' and d->'set'->>'ad' = 'Sonbahar projemiz', 'çocuk durumu: ' || d::text;
  -- okul ortak şifresi hâlâ çalışır ve hepsini görür
  e := kids_yon_okul_sifre(yt); assert e <> pin;
  ot := (kids_ogretmen_giris('AK-2026', e))->>'token'; assert ot is not null, 'okul şifresiyle giriş';
  v := kids_ogretmen_veri(ot, current_date, current_date + 1);
  ot := (kids_ogretmen_giris('AK-2026', pin))->>'token';
  assert json_array_length(v->'siniflar') = 2 and v->>'ogretmen' is null, 'okul şifresi bütün sınıflar';
  -- öğretmen kapatılınca oturumu düşer
  perform kids_yon_ogretmen_kaydet(yt, (r->>'id')::uuid, 'Ayşe Öğretmen', array[s1], false);
  begin perform kids_ogretmen_veri(ot, current_date, current_date); e := 'yok'; exception when others then e := sqlerrm; end;
  assert e = 'oturum yok', 'kapalı öğretmen: ' || e;
  -- başvuru: IP başına günde 3
  for i in 1..3 loop assert (kids_basvuru_yap(('{"kres_ad":"Papatya Kreşi","yetkili_ad":"Zehra Y.","tel":"0532 000 00 0' || i || '","kvkk":true,"ogrenci_sayi":"30"}')::jsonb)->>'tamam')::boolean, 'başvuru ' || i; end loop;
  assert (kids_basvuru_yap('{"kres_ad":"X Kreşi","yetkili_ad":"A B","tel":"05320000000","kvkk":true}'::jsonb)->>'tamam')::boolean = false, 'IP sınırı';
  delete from kids_basvurular where kres_ad = 'X Kreşi';
  assert (kids_basvuru_yap('{"kres_ad":"Y","yetkili_ad":"A B","tel":"05320000000","kvkk":false}'::jsonb)->>'tamam')::boolean = false, 'kvkk şart';
  bv := kids_basvuru_liste(); assert json_array_length(bv) = 3;
  bid := (bv->0->>'id')::uuid;
  r := kids_basvuru_onayla(bid, 'PK-2026', 14, 40);
  assert r->'okul'->>'odeme' = 'deneme' and length(r->>'yonetici_sifre') = 8 and r->>'ogretmen_sifre' ~ '^[0-9]{6}$';
  assert (r->'okul'->>'lisans_bit')::date = current_date + 14 and r->'okul'->>'kaynak' = 'basvuru';
  yt := (kids_yonetici_giris('PK-2026', r->>'yonetici_sifre'))->>'token'; assert yt is not null, 'yeni kreş yöneticisi girer';
  assert (kids_ogretmen_giris('PK-2026', r->>'ogretmen_sifre')->>'tamam')::boolean;
  begin perform kids_basvuru_onayla(bid, 'PK2-2026', 14, 40); e := 'yok'; exception when others then e := sqlerrm; end;
  assert e = 'Bu başvuru zaten onaylandı.';
  -- deneme bitti: yönetici görür ama değiştiremez
  update kids_okullar set lisans_bas = current_date - 20, lisans_bit = current_date - 1 where kod = 'PK-2026';
  v := kids_yonetici_veri(yt); assert (v->'okul'->>'acik')::boolean = false and (v->'okul'->>'kalan_gun')::int = -1;
  begin perform kids_yon_sinif_kaydet(yt, null, 'A', 'minik'); e := 'yok'; exception when others then e := sqlerrm; end;
  assert e like 'Lisans ya da deneme süreniz bitti%', 'süre bitti: ' || e;
  -- kilit: 5 yanlışta kilitlenir
  for i in 1..5 loop perform kids_yonetici_giris('AK-2026', 'yanlis' || i); end loop;
  begin perform kids_yonetici_giris('AK-2026', ys); e := 'yok'; exception when others then e := sqlerrm; end;
  assert e like 'Çok fazla hatalı%', 'yönetici kilidi: ' || e;
  raise notice 'KRES AKIS GECTI';
end $$;
-- yetkiler: anon iç yardımcıları ve yönetim fonksiyonlarını çağıramaz
set role anon;
do $$ declare e text; begin
  begin perform kids_basvuru_liste(); e := 'yok'; exception when insufficient_privilege then e := 'izin yok'; end; assert e = 'izin yok', 'anon başvuru listesi';
  begin perform kids_gun_bilgi(null, current_date); e := 'yok'; exception when insufficient_privilege then e := 'izin yok'; end; assert e = 'izin yok', 'anon iç fonksiyon';
  begin perform kids_okunakli_sifre(8); e := 'yok'; exception when insufficient_privilege then e := 'izin yok'; end; assert e = 'izin yok';
  begin perform count(*) from kids_setler; e := 'yok'; exception when insufficient_privilege then e := 'izin yok'; end; assert e = 'izin yok', 'tablo kapalı';
  raise notice 'KRES YETKI GECTI';
end $$;
