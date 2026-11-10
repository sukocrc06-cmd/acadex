-- Acadex Kids yönetim davranış testi (tests/admin-kids.js çalıştırır). Hata olursa exception; sonunda HEPSI GECTI.
\set ON_ERROR_STOP 1
do $$
declare o json; oid uuid; s1 uuid; s2 uuid; d json; r json; n int; t text; hata text; sf text;
begin
  -- yönetici değilken her şey kapalı
  perform set_config('test.admin', '0', true);
  begin perform public.kids_okul_liste(); raise exception 'KORUMA: yönetici olmayan listeyi gördü'; exception when insufficient_privilege then null; end;
  perform set_config('test.admin', '1', true);

  -- ad kısaltma (KVKK)
  if public.kids_ad_kisalt('  Ayşe   Nur  Kaya ') <> 'Ayşe Nur K.' then raise exception 'kisalt 1: %', public.kids_ad_kisalt('  Ayşe   Nur  Kaya '); end if;
  if public.kids_ad_kisalt('Defne') <> 'Defne' then raise exception 'kisalt 2'; end if;
  if public.kids_ad_kisalt('ali özdemir') <> 'ali Ö.' then raise exception 'kisalt 3: %', public.kids_ad_kisalt('ali özdemir'); end if;

  -- okul ekle
  o := public.kids_okul_kaydet('{"kod":"ay-2026","ad":"Ay Kreşi","ilce":"Çankaya","kota":5}'::jsonb); oid := (o->>'id')::uuid;
  if o->>'kod' <> 'AY-2026' or (o->>'kota')::int <> 5 or (o->>'ucret_kurus')::bigint <> 3490000 or o->>'odeme' <> 'bekliyor' then raise exception 'okul: %', o; end if;
  if (o->>'lisans_bit')::date <> current_date + 365 then raise exception 'lisans bitişi'; end if;
  begin perform public.kids_okul_kaydet('{"kod":"AY-2026","ad":"Başka"}'::jsonb); raise exception 'KOD: aynı kod kabul edildi'; exception when others then hata := sqlerrm; end;
  if hata not like '%kod%' then raise exception 'kod hatası: %', hata; end if;
  begin perform public.kids_okul_kaydet('{"kod":"bozuk kod","ad":"X Okulu"}'::jsonb); raise exception 'KOD: biçim'; exception when check_violation then null; end;

  -- sınıflar
  s1 := public.kids_sinif_kaydet(oid, null, 'Papatyalar', 'minik');
  s2 := public.kids_sinif_kaydet(oid, null, '2-A', 'yildiz');
  begin perform public.kids_sinif_kaydet(oid, null, 'Papatyalar', 'kasif'); raise exception 'SINIF: aynı ad'; exception when others then hata := sqlerrm; end;
  if hata not like '%aynı adlı%' then raise exception 'sınıf hatası: %', hata; end if;

  -- toplu öğrenci: boş satırlar atlanır, soyad kısaltılır, hayvanlar dağılır
  r := public.kids_ogrenci_ekle(s1, array['Defne Kaya', '', '  ', 'Ali Yılmaz', 'Zeynep Ak']);
  if (r->>'adet')::int <> 3 then raise exception 'ekle adet: %', r; end if;
  select count(distinct hayvan) into n from kids_ogrenciler where sinif_id = s1;
  if n <> 3 then raise exception 'hayvanlar dağılmadı: %', n; end if;
  select count(*) into n from kids_ogrenciler where ad like '%Kaya%' or ad like '%Yılmaz%';
  if n <> 0 then raise exception 'tam soyad kaydedildi'; end if;
  select count(*) into n from kids_ogrenciler where array_length(sifre, 1) <> 2 or sifre[1] = sifre[2];
  if n <> 0 then raise exception 'resimli şifre bozuk'; end if;

  -- kota: 5'te 3 dolu, 3 daha eklenemez, 2 eklenir
  begin perform public.kids_ogrenci_ekle(s2, array['A B', 'C D', 'E F']); raise exception 'KOTA aşıldı'; exception when others then hata := sqlerrm; end;
  if hata not like 'Kota yetmiyor%' then raise exception 'kota hatası: %', hata; end if;
  perform public.kids_ogrenci_ekle(s2, array['Kaan T', 'Mira S']);
  -- kota düşürülemez (5 etkin öğrenci varken 4)
  begin perform public.kids_okul_kaydet(jsonb_build_object('id', oid, 'kod', 'AY-2026', 'ad', 'Ay Kreşi', 'kota', 4, 'lisans_bas', current_date, 'lisans_bit', current_date + 365)); raise exception 'KOTA düştü'; exception when others then hata := sqlerrm; end;
  if hata not like '%kota 4 olamaz%' then raise exception 'kota düşürme: %', hata; end if;

  -- ayrıntı: kimlikler sıralı, okul kodu ile
  d := public.kids_okul_detay(oid);
  if json_array_length(d->'ogrenciler') <> 5 or json_array_length(d->'siniflar') <> 2 then raise exception 'detay: %', d; end if;
  if (d->'ogrenciler'->0->>'kimlik') <> 'AY-2026-001' or (d->'ogrenciler'->4->>'kimlik') <> 'AY-2026-005' then raise exception 'kimlik: %', d->'ogrenciler'; end if;
  if (d->'okul'->>'ogrenci')::int <> 5 then raise exception 'sayım'; end if;

  -- pasif öğrenci kotadan düşer; yeniden etkinleştirme kota doluysa reddedilir
  perform public.kids_ogrenci_guncelle((d->'ogrenciler'->0->>'id')::uuid, '{"aktif":false}');
  perform public.kids_ogrenci_ekle(s2, array['Yeni Çocuk']);
  begin perform public.kids_ogrenci_guncelle((d->'ogrenciler'->0->>'id')::uuid, '{"aktif":true}'); raise exception 'KOTA: pasif geri döndü'; exception when others then hata := sqlerrm; end;
  if hata not like 'Kota dolu%' then raise exception 'pasif: %', hata; end if;
  -- yeni öğrenci no 6 alır (silinen/pasif numara tekrar kullanılmaz)
  if not exists (select 1 from kids_ogrenciler where okul_id = oid and no = 6 and ad = 'Yeni Ç.') then raise exception 'no 6'; end if;
  -- ad güncelleme yine kısaltılır; boş ad yok sayılır
  perform public.kids_ogrenci_guncelle((d->'ogrenciler'->1->>'id')::uuid, '{"ad":"Ali Veli Kara"}');
  perform public.kids_ogrenci_guncelle((d->'ogrenciler'->1->>'id')::uuid, '{"ad":"  "}');
  if (select ad from kids_ogrenciler where id = (d->'ogrenciler'->1->>'id')::uuid) <> 'Ali Veli K.' then raise exception 'ad güncelle'; end if;
  -- başka okulun sınıfına taşınamaz
  perform public.kids_okul_kaydet('{"kod":"GN-2026","ad":"Güneş Anaokulu"}'::jsonb);
  perform public.kids_sinif_kaydet((select id from kids_okullar where kod = 'GN-2026'), null, 'Lale', 'kasif');
  begin perform public.kids_ogrenci_guncelle((d->'ogrenciler'->1->>'id')::uuid, jsonb_build_object('sinif_id', (select id from kids_siniflar where ad = 'Lale'))); raise exception 'TAŞIMA'; exception when others then hata := sqlerrm; end;
  if hata not like '%bu okula ait değil%' then raise exception 'taşıma: %', hata; end if;

  -- resimli şifre yenile, öğretmen şifresi özetli
  if public.kids_ogrenci_sifre_yenile(array[(d->'ogrenciler'->2->>'id')::uuid]) <> 1 then raise exception 'şifre yenile'; end if;
  sf := public.kids_okul_sifre_yenile(oid);
  if sf !~ '^[0-9]{6}$' then raise exception 'öğretmen şifresi: %', sf; end if;
  select sifre_ozet into t from kids_okullar where id = oid;
  if t = sf or t <> extensions.crypt(sf, t) then raise exception 'şifre özeti'; end if;
  if (public.kids_okul_json(oid)->>'sifre_var')::boolean is not true then raise exception 'sifre_var'; end if;

  -- sınıf silinince öğrencileri de gider
  perform public.kids_sinif_sil(s2);
  select count(*) into n from kids_ogrenciler where okul_id = oid;
  if n <> 3 then raise exception 'sınıf silme: %', n; end if;
  if public.kids_ogrenci_sil(array[(d->'ogrenciler'->2->>'id')::uuid]) <> 1 then raise exception 'sil'; end if;

  -- liste ve denetim kaydı
  if json_array_length(public.kids_okul_liste()) <> 2 then raise exception 'liste'; end if;
  select count(*) into n from admin_audit_log where action like 'kids_%';
  if n < 12 then raise exception 'denetim kaydı az: %', n; end if;
  raise notice 'HEPSI GECTI';
end $$;

-- tablolar doğrudan okunamaz
set role authenticated;
do $$ begin
  begin perform 1 from public.kids_ogrenciler limit 1; raise exception 'DOĞRUDAN OKUMA açık'; exception when insufficient_privilege then null; end;
  begin perform public.kids_okul_json(gen_random_uuid()); raise exception 'yardımcı açık'; exception when insufficient_privilege then null; end;
  raise notice 'RLS GECTI';
end $$;
reset role;
set role anon;
do $$ begin
  if exists (select 1 from pg_proc where proname like 'kids\_%' and pronamespace = 'public'::regnamespace and has_function_privilege('anon', oid, 'execute')) then raise exception 'ANON fonksiyon çağırabiliyor'; end if;
  begin perform public.kids_okul_liste(); raise exception 'ANON çağırdı'; exception when insufficient_privilege then null; end;
  raise notice 'ANON GECTI';
end $$;
reset role;
