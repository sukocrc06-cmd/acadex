-- Acadex Kids giriş davranış testi (tests/kids-giris.js çalıştırır). Sonunda GIRIS GECTI.
\set ON_ERROR_STOP 1
do $$
declare ct text; oid uuid; s1 uuid; s2 uuid; g1 uuid; g2 uuid; sf text[]; yanlis text[]; r json; tk text; ot text; d json; v json; hata text; n int; gun date := (now() at time zone 'Europe/Istanbul')::date;
begin
  perform set_config('test.admin', '1', true);
  oid := (public.kids_okul_kaydet('{"kod":"AY-2026","ad":"Ay Kreşi"}'::jsonb)->>'id')::uuid;
  s1 := public.kids_sinif_kaydet(oid, null, 'Papatyalar', 'minik');
  s2 := public.kids_sinif_kaydet(oid, null, '2-A', 'yildiz');
  perform public.kids_ogrenci_ekle(s1, array['Defne Kaya', 'Ali Yılmaz']);
  perform public.kids_ogrenci_ekle(s2, array['Kaan Tek']);
  select id, sifre into g1, sf from kids_ogrenciler where ad = 'Defne K.';
  select id into g2 from kids_ogrenciler where ad = 'Ali Y.';
  ot := public.kids_okul_sifre_yenile(oid);
  perform set_config('test.admin', '0', true);

  -- okul bul: kod büyük/küçük harf ve boşluk fark etmez; tam soyad ya da şifre dönmez
  r := public.kids_okul_bul('  ay-2026 ');
  if r->>'ad' <> 'Ay Kreşi' or json_array_length(r->'siniflar') <> 2 or json_array_length(r->'siniflar'->0->'ogr') <> 2 then raise exception 'okul bul: %', r; end if;
  if r::text ~ 'sifre|Kaya|kota|ucret|yetkili' then raise exception 'okul bul fazla veri döndü: %', r; end if;
  begin perform public.kids_okul_bul('YOK-2026'); raise exception 'BUL: olmayan kod'; exception when no_data_found then null; end;

  -- yanlış şifre: oturum yok; 5 yanlışta kilit, doğru şifre de bekler
  yanlis := array[sf[2], sf[1]];
  r := public.kids_giris(g1, yanlis);
  if (r->>'tamam')::boolean or r->>'token' is not null then raise exception 'yanlış şifre kabul edildi'; end if;
  for n in 1..4 loop r := public.kids_giris(g1, yanlis); end loop;
  if not (r->>'kilit')::boolean then raise exception 'kilit yok: %', r; end if;
  begin perform public.kids_giris(g1, sf); raise exception 'KİLİT: doğru şifre hemen kabul edildi'; exception when invalid_authorization_specification then hata := sqlerrm; end;
  if hata not like 'Biraz dinlenelim%' then raise exception 'kilit mesajı: %', hata; end if;
  update kids_ogrenciler set kilit_bitis = now() - interval '1 second' where id = g1;
  r := public.kids_giris(g1, sf);
  if not (r->>'tamam')::boolean or length(r->>'token') <> 64 then raise exception 'doğru şifre: %', r; end if;
  tk := r->>'token';
  if exists (select 1 from kids_oturumlar where ozet = tk) then raise exception 'anahtar düz saklandı'; end if;

  -- durum: plan yoksa bugun null; öğretmen planlayınca gelir
  d := public.kids_durum(tk);
  if d->'ogr'->>'ad' <> 'Defne K.' or d->'sinif'->>'bant' <> 'minik' or d->>'bugun' is not null then raise exception 'durum: %', d; end if;
  begin perform public.kids_durum('yanlis'); raise exception 'DURUM: sahte anahtar'; exception when invalid_authorization_specification then null; end;
  perform public.kids_ilerleme_koy(tk, '{"yildiz":{"colours":{"balon":3}},"son":1}');
  begin perform public.kids_ilerleme_koy(tk, '[1]'); raise exception 'İLERLEME: dizi'; exception when others then if sqlerrm not like '%nesne%' then raise; end if; end;
  begin perform public.kids_ilerleme_koy(tk, jsonb_build_object('x', repeat('a', 70000))); raise exception 'İLERLEME: boyut'; exception when check_violation then null; end;

  -- öğretmen girişi
  r := public.kids_ogretmen_giris('ay-2026', '000000x');
  if (r->>'tamam')::boolean then raise exception 'öğretmen yanlış şifre'; end if;
  r := public.kids_ogretmen_giris('AY-2026', ot);
  if not (r->>'tamam')::boolean then raise exception 'öğretmen giriş: %', r; end if;
  begin perform public.kids_plan_koy(tk, s1, gun, 'colours'); raise exception 'ÇOCUK plan yazdı'; exception when invalid_authorization_specification then null; end;
  tk := r->>'token';
  perform public.kids_plan_koy(tk, s1, gun, 'colours');
  perform public.kids_plan_koy(tk, s1, gun + 1, '');
  perform public.kids_plan_koy(tk, s1, gun + 1, 'animals');
  begin perform public.kids_plan_koy(tk, s1, gun, 'uzay'); raise exception 'PLAN: geçersiz konu'; exception when check_violation then null; end;
  begin perform public.kids_plan_koy(tk, s1, gun + 400, 'colours'); raise exception 'PLAN: uzak gün'; exception when others then if sqlerrm not like '%iki ay%' then raise; end if; end;
  v := public.kids_ogretmen_veri(tk, gun, gun + 4);
  if v->'siniflar'->0->'plan'->>(gun::text) <> 'colours' or v->'siniflar'->0->'plan'->>((gun + 1)::text) <> 'animals' then raise exception 'veri plan: %', v->'siniflar'->0->'plan'; end if;
  if (v->'siniflar'->0->'ogr'->1->'ilerleme'->'yildiz'->'colours'->>'balon')::int <> 3 then raise exception 'veri ilerleme: %', v->'siniflar'->0->'ogr'; end if;
  if v::text ~ 'sifre' then raise exception 'öğretmene resimli şifre gitti'; end if;
  ct := public.kids_giris(g2, (select sifre from kids_ogrenciler where id = g2))->>'token';
  if public.kids_durum(ct)->>'bugun' <> 'colours' then raise exception 'çocuk günün konusunu görmüyor'; end if;

  -- başka okulun sınıfı planlanamaz
  perform set_config('test.admin', '1', true);
  perform public.kids_okul_kaydet('{"kod":"GN-2026","ad":"Güneş"}'::jsonb);
  perform public.kids_sinif_kaydet((select id from kids_okullar where kod = 'GN-2026'), null, 'Lale', 'kasif');
  perform set_config('test.admin', '0', true);
  begin perform public.kids_plan_koy(tk, (select id from kids_siniflar where ad = 'Lale'), gun, 'colours'); raise exception 'PLAN: başka okul'; exception when insufficient_privilege then null; end;

  -- lisans kapanınca oturumlar da durur; pasif öğrenci giremez
  update kids_okullar set lisans_bit = current_date - 1, lisans_bas = current_date - 30 where id = oid;
  begin perform public.kids_ogretmen_veri(tk, gun, gun); raise exception 'LİSANS: kapalı okul'; exception when invalid_authorization_specification then null; end;
  begin perform public.kids_okul_bul('AY-2026'); raise exception 'LİSANS: kod'; exception when invalid_authorization_specification then null; end;
  update kids_okullar set lisans_bit = current_date + 300 where id = oid;
  update kids_ogrenciler set aktif = false where id = g2;
  begin perform public.kids_giris(g2, (select sifre from kids_ogrenciler where id = g2)); raise exception 'PASİF girdi'; exception when invalid_authorization_specification then null; end;

  -- öğretmen kilidi
  for n in 1..5 loop r := public.kids_ogretmen_giris('AY-2026', 'yanlis'); end loop;
  begin perform public.kids_ogretmen_giris('AY-2026', ot); raise exception 'ÖĞRETMEN KİLİT yok'; exception when invalid_authorization_specification then null; end;

  perform public.kids_cikis(tk);
  update kids_okullar set sifre_kilit = null where id = oid;
  begin perform public.kids_ogretmen_veri(tk, gun, gun); raise exception 'ÇIKIŞ: anahtar hâlâ geçerli'; exception when invalid_authorization_specification then null; end;
  raise notice 'GIRIS GECTI';
end $$;

set role anon;
do $$ begin
  begin perform 1 from public.kids_oturumlar; raise exception 'oturum tablosu açık'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.kids_ilerleme; raise exception 'ilerleme tablosu açık'; exception when insufficient_privilege then null; end;
  if has_function_privilege('anon', 'public.kids_oturum_ac(text, uuid, uuid, integer)', 'execute') or has_function_privilege('anon', 'public.kids_oturum(text, text)', 'execute') then raise exception 'oturum açıcı açık'; end if;
  if not has_function_privilege('anon', 'public.kids_giris(uuid, text[])', 'execute') then raise exception 'anon girişi çağıramıyor'; end if;
  raise notice 'ANON GIRIS GECTI';
end $$;
reset role;
