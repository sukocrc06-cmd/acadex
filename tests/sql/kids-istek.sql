-- Acadex Kids: "Kreşim için teklif al" istekleri davranış testi (tests/kids-kres.js çalıştırır; ACADEX_PG gerekir).
-- Akış: sayfadan istek (e-posta zorunlu, telefon isteğe bağlı, KVKK onayı) → yönetim panelinde liste
-- → durum "arandı" + iç not → okul aç (deneme) ya da reddet → anon yetkileri.
\set ON_ERROR_STOP 1
reset role;
do $$
declare r json; l json; id1 uuid; id2 uuid; e text; o json;
begin
  perform set_config('test.admin', '1', true);
  delete from kids_basvurular;
  r := kids_basvuru_yap('{"kres_ad":"Lale Kreşi","yetkili_ad":"Ayşe K.","kvkk":true}'::jsonb);
  assert (r->>'tamam')::boolean = false and r->>'alan' = 'eposta', 'e-posta zorunlu: ' || r::text;
  r := kids_basvuru_yap('{"kres_ad":"Lale Kreşi","yetkili_ad":"Ayşe K.","eposta":"ayse@ornek","kvkk":true}'::jsonb);
  assert r->>'alan' = 'eposta', 'geçersiz e-posta';
  r := kids_basvuru_yap('{"kres_ad":"L","yetkili_ad":"Ayşe K.","eposta":"a@b.co","kvkk":true}'::jsonb);
  assert r->>'alan' = 'kres_ad', 'kreş adı';
  r := kids_basvuru_yap('{"kres_ad":"Lale Kreşi","yetkili_ad":"Ayşe K.","eposta":"a@b.co","tel":"12","kvkk":true}'::jsonb);
  assert r->>'alan' = 'tel', 'telefon biçimi';
  r := kids_basvuru_yap('{"kres_ad":"Lale Kreşi","yetkili_ad":"Ayşe K.","eposta":"a@b.co","ogrenci_sayi":"otuz","kvkk":true}'::jsonb);
  assert r->>'alan' = 'ogrenci_sayi', 'öğrenci sayısı';
  r := kids_basvuru_yap('{"kres_ad":"Lale Kreşi","yetkili_ad":"Ayşe K.","eposta":"a@b.co","kvkk":false}'::jsonb);
  assert (r->>'tamam')::boolean = false, 'kvkk şart';
  -- telefonsuz geçerli istek; e-posta küçük harfe çevrilir
  r := kids_basvuru_yap('{"kres_ad":"  Lale Kreşi ","yetkili_ad":"Ayşe Kaya","eposta":" Ayse@Ornek.COM ","kvkk":true}'::jsonb);
  assert (r->>'tamam')::boolean, 'telefonsuz istek: ' || r::text;
  r := kids_basvuru_yap('{"kres_ad":"Gül Kreşi","yetkili_ad":"Can D.","eposta":"can@gul.com","tel":"0532 111 22 33","il":"Ankara","ilce":"Çankaya","ogrenci_sayi":"45","mesaj":"Eylülde başlamak istiyoruz","kvkk":true}'::jsonb);
  assert (r->>'tamam')::boolean;
  l := kids_basvuru_liste();
  assert json_array_length(l) = 2;
  select (x->>'id')::uuid into id1 from json_array_elements(l) x where x->>'kres_ad' = 'Lale Kreşi';
  select (x->>'id')::uuid into id2 from json_array_elements(l) x where x->>'kres_ad' = 'Gül Kreşi';
  assert (select eposta = 'ayse@ornek.com' and tel = '' and durum = 'bekliyor' from kids_basvurular where id = id1), 'kayıt biçimi';
  -- arandı + not; sıralamada bekleyenler önce
  perform kids_basvuru_durum(id1, 'arandi', 'Salı 14:00 demo sözü verildi');
  assert (select durum = 'arandi' and ic_not like 'Salı%' from kids_basvurular where id = id1);
  l := kids_basvuru_liste(); assert l->0->>'kres_ad' = 'Gül Kreşi' and l->1->>'durum' = 'arandi' and l->1->>'ic_not' like 'Salı%', 'sıra ve not';
  perform kids_basvuru_durum(id1, null, 'Not güncellendi');
  assert (select durum = 'arandi' and ic_not = 'Not güncellendi' from kids_basvurular where id = id1), 'yalnız not';
  begin perform kids_basvuru_durum(id1, 'onaylandi', null); e := 'yok'; exception when others then e := sqlerrm; end;
  assert e like 'Durum geçersiz%', 'onay yalnız okul açarak';
  -- arandı istekten okul açılır
  o := kids_basvuru_onayla(id1, 'LALE-2026', 14, 40);
  assert o->'okul'->>'kod' = 'LALE-2026' and (select durum = 'onaylandi' from kids_basvurular where id = id1);
  assert (select eposta from kids_okullar where kod = 'LALE-2026') = 'ayse@ornek.com', 'okula e-posta geçer';
  begin perform kids_basvuru_durum(id1, 'bekliyor', null); e := 'yok'; exception when others then e := sqlerrm; end;
  assert e like 'Okulu açılmış%', 'açılan isteğin durumu değişmez';
  perform kids_basvuru_durum(id2, 'arandi', null); perform kids_basvuru_reddet(id2);
  assert (select durum from kids_basvurular where id = id2) = 'reddedildi', 'arandı istek reddedilir';
  raise notice 'ISTEK AKIS GECTI';
end $$;
set role anon;
do $$ declare e text; begin
  begin perform kids_basvuru_durum(gen_random_uuid(), 'arandi', ''); e := 'yok'; exception when insufficient_privilege then e := 'izin yok'; end; assert e = 'izin yok', 'anon durum değiştiremez';
  begin perform kids_basvuru_liste(); e := 'yok'; exception when insufficient_privilege then e := 'izin yok'; end; assert e = 'izin yok', 'anon liste göremez';
  assert has_function_privilege('anon', 'public.kids_basvuru_yap(jsonb)', 'execute'), 'anon istek gönderebilir';
  raise notice 'ISTEK YETKI GECTI';
end $$;
reset role;
