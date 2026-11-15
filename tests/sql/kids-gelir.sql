-- Acadex Kids gelir modeli davranış testi (tests/kids-gelir.js çalıştırır; ACADEX_PG gerekir). Hata olursa exception.
-- Akış: hesap (dönem, erken kayıt, referans, ek indirim, KDV) → teklif → gönder (istek "teklif") → imza (okul lisanslı)
-- → taksitli tahsilat → hepsi ödenince okul "ödendi" → yol haritası bir kez → yetkiler.
\set ON_ERROR_STOP 1
do $$
declare h json; t json; tid uuid; tid2 uuid; bid uuid; r json; o kids_okullar; e text; n int; ok json;
begin
  perform set_config('test.fin', '1', true);
  -- hesap (20261115c): Mini yıllık. Liste aylık plan 27.500 × 12 = 330.000 TL; yıllık plan ayda 24.500 → dönem avantajı 36.000 TL;
  -- erken %10 → 264.600 TL; KDV %20
  h := kids_teklif_hesap('{"paket":"mini","donem":"yil","erken":true,"tarih":"2026-12-01","taksit":3}'::jsonb);
  assert (h->>'liste_kurus')::bigint = 33000000, 'liste: ' || h::text;
  assert (h->'indirimler'->0->>'kurus')::bigint = 3600000 and h->'indirimler'->0->>'ad' = 'Yıllık plan (ayda 24.500 TL)', 'dönem avantajı: ' || (h->'indirimler')::text;
  assert (h->>'net_kurus')::bigint = 26460000, 'net: ' || (h->>'net_kurus');
  assert (h->>'kdv_kurus')::bigint = 5292000 and (h->>'toplam_kurus')::bigint = 31752000, 'kdv';
  assert json_array_length(h->'indirimler') = 2 and (h->>'taksit')::int = 3;
  -- erken kayıt bitişten sonra uygulanmaz; aylıkta taksit 1'e iner; dönem avantajı yok
  h := kids_teklif_hesap('{"paket":"mini","donem":"aylik","erken":true,"tarih":"2027-01-05","taksit":3}'::jsonb);
  assert (h->>'net_kurus')::bigint = 2750000 and (h->>'erken')::boolean = false and (h->>'taksit')::int = 1 and json_array_length(h->'indirimler') = 0, 'aylık: ' || h::text;
  -- 6 aylık: ayda 25.500
  h := kids_teklif_hesap('{"paket":"mini","donem":"6ay"}'::jsonb);
  assert (h->>'net_kurus')::bigint = 2550000 * 6, '6 aylık';
  -- kampüs: özel tutar şart; kota öğrenci sayısına göre
  begin perform kids_teklif_hesap('{"paket":"kampus","donem":"yil"}'::jsonb); e := 'yok'; exception when others then e := sqlerrm; end; assert e like 'Kampüs%', e;
  h := kids_teklif_hesap('{"paket":"kampus","donem":"aylik","ozel_aylik_kurus":"800000","ogrenci":"420"}'::jsonb);
  assert (h->>'net_kurus')::bigint = 800000 and (h->>'kota')::int = 420;
  -- ek indirim üst sınırı ve referans kodu
  begin perform kids_teklif_hesap('{"paket":"mini","donem":"aylik","ek_yuzde":"40"}'::jsonb); e := 'yok'; exception when others then e := sqlerrm; end; assert e like 'Ek indirim%', e;
  begin perform kids_teklif_hesap('{"paket":"mini","donem":"aylik","ref_kod":"YOK-2026"}'::jsonb); e := 'yok'; exception when others then e := sqlerrm; end; assert e like 'Referans%', e;
  perform set_config('test.admin', '1', true);
  ok := kids_okul_kaydet('{"kod":"REF-2026","ad":"Referans Kreş","kota":40}'::jsonb);
  h := kids_teklif_hesap('{"paket":"mini","donem":"aylik","ref_kod":"ref-2026"}'::jsonb);
  assert (h->>'net_kurus')::bigint = 2475000 and h->>'ref_kod' = 'REF-2026', 'referans %10: ' || h::text;
  -- istekten teklif
  insert into kids_basvurular (kres_ad, yetkili_ad, tel, eposta, ip) values ('Lale Kreşi', 'Ayşe K.', '', 'ayse@lale.com', 'x') returning id into bid;
  t := kids_teklif_kaydet(jsonb_build_object('basvuru_id', bid, 'kres_ad', 'Lale Kreşi', 'yetkili_ad', 'Ayşe K.', 'eposta', 'AYSE@lale.com', 'paket', 'buyuk', 'donem', 'yil', 'taksit', 3, 'baslangic', '2026-12-01', 'ogrenci', 85));
  tid := (t->>'id')::uuid;
  assert t->>'durum' = 'taslak' and t->>'bitis' = '2027-11-30' and t->>'eposta' = 'ayse@lale.com', 'teklif: ' || t::text;
  assert (select count(*) from kids_tahsilatlar where teklif_id = tid) = 3, '3 taksit';
  assert (select sum(tutar_kurus) from kids_tahsilatlar where teklif_id = tid) = (t->>'toplam_kurus')::bigint, 'taksitler toplamı';
  assert (select array_agg(vade order by sira)::text from kids_tahsilatlar where teklif_id = tid) = '{2026-12-01,2027-04-01,2027-08-01}', 'vadeler';
  -- güncelle: 2 taksit → takvim yeniden kurulur
  t := kids_teklif_kaydet(jsonb_build_object('id', tid, 'kres_ad', 'Lale Kreşi', 'paket', 'buyuk', 'donem', 'yil', 'taksit', 2, 'baslangic', '2026-12-01'));
  assert (select count(*) from kids_tahsilatlar where teklif_id = tid) = 2;
  -- gönder: istek "teklif" olur
  perform kids_teklif_durum(tid, 'gonderildi');
  assert (select durum from kids_basvurular where id = bid) = 'teklif', 'istek teklif aşamasında';
  -- imzadan önce tahsilat işaretlenmez
  begin perform kids_tahsilat_isaretle((select id from kids_tahsilatlar where teklif_id = tid and sira = 1), true, 'havale'); e := 'yok'; exception when others then e := sqlerrm; end;
  assert e like 'Önce teklif%', e;
  -- imza: okul lisanslı açılır, şifreler döner, istek onaylandı
  begin perform kids_teklif_imzala(tid, 'kötü kod'); e := 'yok'; exception when others then e := sqlerrm; end; assert e like 'Okul kodu%', e;
  r := kids_teklif_imzala(tid, 'lale-2026');
  assert length(r->>'yonetici_sifre') = 8 and r->>'ogretmen_sifre' ~ '^[0-9]{6}$';
  select * into o from kids_okullar where kod = 'LALE-2026';
  assert o.lisans_bas = '2026-12-01' and o.lisans_bit = '2027-11-30' and o.kota = 100 and o.kaynak = 'teklif' and o.odeme = 'bekliyor' and o.ucret_kurus = (t->>'net_kurus')::bigint, 'okul';
  assert (select durum = 'onaylandi' and okul_id = o.id from kids_basvurular where id = bid), 'istek onaylandı';
  begin perform kids_teklif_kaydet(jsonb_build_object('id', tid, 'kres_ad', 'X', 'paket', 'mini', 'donem', 'aylik')); e := 'yok'; exception when others then e := sqlerrm; end; assert e like 'İmzalanmış%', e;
  -- tahsilat: biri ödendi → hâlâ bekliyor; ikisi → okul ödendi; geri alınca bekliyor
  perform kids_tahsilat_isaretle((select id from kids_tahsilatlar where teklif_id = tid and sira = 1), true, 'havale');
  assert (select odeme from kids_okullar where id = o.id) = 'bekliyor';
  perform kids_tahsilat_isaretle((select id from kids_tahsilatlar where teklif_id = tid and sira = 2), true, '');
  assert (select odeme from kids_okullar where id = o.id) = 'odendi', 'hepsi ödendi';
  assert (select yontem from kids_tahsilatlar where teklif_id = tid and sira = 2) = 'havale', 'varsayılan havale';
  perform kids_tahsilat_isaretle((select id from kids_tahsilatlar where teklif_id = tid and sira = 2), false, '');
  assert (select odeme from kids_okullar where id = o.id) = 'bekliyor';
  -- kaybedilen teklif; özet; ayar ve paket
  t := kids_teklif_kaydet('{"kres_ad":"Nar Kreşi","paket":"mini","donem":"aylik"}'::jsonb); tid2 := (t->>'id')::uuid;
  perform kids_teklif_durum(tid2, 'kaybedildi');
  r := kids_gelir_ozet();
  assert json_array_length(r->'teklifler') = 2 and json_array_length(r->'paketler') = 4 and (r->'ayar'->>'hedef_kres')::int = 10;
  perform kids_gelir_ayar_kaydet('{"indirim_yil":"25","hedef_kres":"12"}'::jsonb);
  assert (select indirim_yil = 25 and hedef_kres = 12 and indirim_6ay = 10 from kids_gelir_ayar), 'ayar';
  perform kids_paket_kaydet('mini', 'Mini', 35, 2900000, 2700000, 2600000, true);
  assert (select kota = 35 and aylik_kurus = 2900000 and alti_ay_kurus = 2700000 and yil_kurus = 2600000 from kids_paketler where kod = 'mini');
  begin perform kids_paket_kaydet('mini', 'Mini', 35, 2000000, 2700000, 2600000, true); e := 'yok'; exception when others then e := sqlerrm; end; assert e like 'Uzun dönemin%', e;
  -- yol haritası bir kez
  n := kids_gelir_yol_kur(); assert n = 17, 'görev: ' || n;
  n := kids_gelir_yol_kur(); assert n = 0, 'ikinci kez eklenmez';
  assert (select count(*) from fin_tasks where title like 'Kids · %' and due_on <= '2026-12-31') = 17;
  -- yetki: finans değilse
  perform set_config('test.fin', '0', true); perform set_config('test.admin', '0', true);
  begin perform kids_gelir_ozet(); e := 'yok'; exception when others then e := sqlerrm; end; assert e like '%finans yetkisi%', e;
  raise notice 'GELIR AKIS GECTI';
end $$;
set role anon;
do $$ declare e text; begin
  begin perform kids_gelir_ozet(); e := 'yok'; exception when insufficient_privilege then e := 'izin yok'; end; assert e = 'izin yok', 'anon özet';
  begin perform count(*) from kids_teklifler; e := 'yok'; exception when insufficient_privilege then e := 'izin yok'; end; assert e = 'izin yok', 'tablo kapalı';
  raise notice 'GELIR YETKI GECTI';
end $$;
reset role;
