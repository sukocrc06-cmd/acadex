-- Acadex Kids: her çocuğa sınıfında eşsiz bir "yüz" (hayvan + renk).
-- 8 hayvan × 8 renk = 64 farklı yüz; aynı sınıfta iki çocuk aynı yüzü almaz (64 kişiye kadar).
-- Atama tetikleyiciyle yapılır: yönetim paneli ve kreş yöneticisi hangi yoldan eklerse eklesin aynı kural.
-- Var olan çocukların hayvanı DEĞİŞMEZ; yalnızca renk verilir (sınıfta aynı hayvandan olanlara sırayla).

alter table public.kids_ogrenciler add column if not exists renk smallint not null default 0;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kids_ogrenciler_renk_aralik') then
    alter table public.kids_ogrenciler add constraint kids_ogrenciler_renk_aralik check (renk between 0 and 7);
  end if;
end $$;

-- sınıfta en az kullanılan yüz: önce hiç kullanılmamış (hayvan, renk), sonra az kullanılan hayvan, sonra az kullanılan renk
create or replace function public.kids_yuz_sec(p_sinif uuid, p_haric uuid)
returns table (hayvan text, renk smallint) language sql stable set search_path = public as $$
  with g as (select o.hayvan, o.renk from kids_ogrenciler o where o.sinif_id = p_sinif and o.aktif and o.id is distinct from p_haric)
  select h.hv, r.rk::smallint
  from unnest(array['tavsan', 'ayi', 'kedi', 'civciv', 'panda', 'kurbaga', 'tilki', 'kopek']) with ordinality h(hv, i)
  cross join generate_series(0, 7) r(rk)
  order by (select count(*) from g where g.hayvan = h.hv and g.renk = r.rk),
           (select count(*) from g where g.hayvan = h.hv),
           (select count(*) from g where g.renk = r.rk),
           h.i, r.rk
  limit 1
$$;

create or replace function public.kids_yuz_tetik()
returns trigger language plpgsql set search_path = public as $$
declare y record;
begin
  if tg_op = 'UPDATE' then
    if not new.aktif or (new.sinif_id is not distinct from old.sinif_id and old.aktif) then return new; end if;
    -- sınıf değişti ya da yeniden etkinleşti: yüzü çakışmıyorsa olduğu gibi kalır
    if not exists (select 1 from kids_ogrenciler g where g.sinif_id = new.sinif_id and g.aktif and g.id <> new.id
                   and g.hayvan = new.hayvan and g.renk = new.renk) then return new; end if;
  end if;
  perform pg_advisory_xact_lock(hashtext('kids_yuz:' || new.sinif_id::text));
  select * into y from public.kids_yuz_sec(new.sinif_id, new.id);
  new.hayvan := y.hayvan; new.renk := y.renk;
  return new;
end $$;

drop trigger if exists kids_ogrenciler_yuz on public.kids_ogrenciler;
create trigger kids_ogrenciler_yuz before insert or update of sinif_id, aktif on public.kids_ogrenciler
  for each row execute function public.kids_yuz_tetik();

-- var olanlar: hayvan aynı kalır, sınıfta aynı hayvandan olanlara 0,1,2… renk
update public.kids_ogrenciler g set renk = x.rk
from (select id, ((row_number() over (partition by sinif_id, hayvan order by aktif desc, no) - 1) % 8)::smallint rk from public.kids_ogrenciler) x
where x.id = g.id and g.renk is distinct from x.rk;

revoke all on function public.kids_yuz_sec(uuid, uuid) from public;
revoke all on function public.kids_yuz_tetik() from public;
do $$ begin
  execute 'revoke all on function public.kids_yuz_sec(uuid, uuid) from anon, authenticated';
  execute 'revoke all on function public.kids_yuz_tetik() from anon, authenticated';
exception when undefined_object then null; end $$;

-- renk alanını döndüren fonksiyonlar (gövdeler önceki sürümlerle aynı, yalnız 'renk' eklendi)
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
      'ogr', coalesce((select json_agg(json_build_object('id', g.id, 'ad', g.ad, 'hayvan', g.hayvan, 'renk', g.renk) order by g.ad, g.no) from kids_ogrenciler g where g.sinif_id = s.id and g.aktif), '[]'::json))
    order by s.created_at) from kids_siniflar s where s.okul_id = o.id), '[]'::json));
end $$;

create or replace function public.kids_okul_detay(p_okul uuid)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_guard();
  if not exists (select 1 from kids_okullar where id = p_okul) then raise exception 'Okul bulunamadı.'; end if;
  return json_build_object('okul', public.kids_okul_json(p_okul),
    'siniflar', coalesce((select json_agg(json_build_object('id', s.id, 'ad', s.ad, 'bant', s.bant,
        'ogrenci', (select count(*) from kids_ogrenciler g where g.sinif_id = s.id and g.aktif)) order by s.created_at) from kids_siniflar s where s.okul_id = p_okul), '[]'::json),
    'ogrenciler', coalesce((select json_agg(json_build_object('id', g.id, 'sinif_id', g.sinif_id, 'no', g.no, 'kimlik', o.kod || '-' || lpad(g.no::text, 3, '0'),
        'ad', g.ad, 'hayvan', g.hayvan, 'renk', g.renk, 'sifre', g.sifre, 'aktif', g.aktif) order by g.no)
      from kids_ogrenciler g join kids_okullar o on o.id = g.okul_id where g.okul_id = p_okul), '[]'::json));
end $$;

create or replace function public.kids_durum(p_token text)
returns json language plpgsql stable security definer set search_path = public as $$
declare o kids_oturumlar := public.kids_oturum(p_token, 'cocuk'); v_sinif uuid; b json;
begin
  select sinif_id into v_sinif from kids_ogrenciler where id = o.ogrenci_id;
  b := public.kids_gun_bilgi(v_sinif, (now() at time zone 'Europe/Istanbul')::date);
  return (select json_build_object('okul', json_build_object('kod', k.kod, 'ad', k.ad),
      'sinif', json_build_object('id', s.id, 'ad', s.ad, 'bant', s.bant),
      'ogr', json_build_object('id', g.id, 'ad', g.ad, 'hayvan', g.hayvan, 'renk', g.renk),
      'bugun', b->>'konu', 'etkinlik', b->>'etkinlik', 'set', b->'set',
      'ilerleme', (select i.veri from kids_ilerleme i where i.ogrenci_id = g.id))
    from kids_ogrenciler g join kids_siniflar s on s.id = g.sinif_id join kids_okullar k on k.id = g.okul_id where g.id = o.ogrenci_id);
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
        'ogr', coalesce((select json_agg(json_build_object('id', g.id, 'ad', g.ad, 'hayvan', g.hayvan, 'renk', g.renk, 'ilerleme', i.veri) order by g.ad, g.no)
          from kids_ogrenciler g left join kids_ilerleme i on i.ogrenci_id = g.id where g.sinif_id = s.id and g.aktif), '[]'::json),
        'plan', coalesce((select json_object_agg(p.gun::text, p.konu) from kids_plan p where p.sinif_id = s.id and p.gun between p_bas and p_bit), '{}'::json),
        'gunler', coalesce((select json_object_agg(p.gun::text, json_build_object('konu', p.konu, 'etkinlik', p.etkinlik, 'set', p.set_id)) from kids_plan p where p.sinif_id = s.id and p.gun between p_bas and p_bit), '{}'::json),
        'hafta', coalesce((select json_object_agg(h.hafta_gunu::text, json_build_object('konu', h.konu, 'etkinlik', h.etkinlik, 'set', h.set_id)) from kids_hafta h where h.sinif_id = s.id), '{}'::json))
      order by s.created_at) from kids_siniflar s where s.okul_id = k.id and public.kids_sinif_yetki(k.id, o.ogretmen_id, s.id)), '[]'::json))
    from kids_okullar k where k.id = o.okul_id);
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
        'ogr', coalesce((select json_agg(json_build_object('id', g.id, 'no', g.no, 'kimlik', k.kod || '-' || lpad(g.no::text, 3, '0'), 'ad', g.ad, 'hayvan', g.hayvan, 'renk', g.renk, 'sifre', g.sifre, 'aktif', g.aktif) order by g.ad, g.no)
          from kids_ogrenciler g where g.sinif_id = s.id), '[]'::json)) order by s.created_at) from kids_siniflar s where s.okul_id = k.id), '[]'::json),
    'ogretmenler', coalesce((select json_agg(json_build_object('id', t.id, 'ad', t.ad, 'siniflar', t.siniflar, 'aktif', t.aktif) order by t.ad) from kids_ogretmenler t where t.okul_id = k.id), '[]'::json))
    from kids_okullar k where k.id = o.okul_id);
end $$;

notify pgrst, 'reload schema';
