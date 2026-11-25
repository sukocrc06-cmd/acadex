-- ==========================================================================
-- Acadex Kids · kurum türü (22.11.2026)
-- Her okulun bir türü olur: kreş, anaokulu, ilkokul. Sınıfın yaş dünyası türe uymalı:
--   kreş      → Minikler (3-4) · Kâşifler (5-6)
--   anaokulu  → Minikler (3-4) · Kâşifler (5-6)
--   ilkokul   → Yıldızlar (7-10)   (sınıflar 2-A, 3-B… ; Kids'te Cümle Galaksisi açılır)
-- Var olan okullar "anaokulu" olur; içinde Yıldızlar sınıfı olan okul "ilkokul" yapılır
-- (yoksa kurala takılırdı). Türü değiştirirken uymayan sınıf varsa işlem durur.
-- 20261110 / 20261112c / 20261114 kids dosyalarından SONRA çalıştır. Tekrar çalıştırmak zarar vermez.
-- ==========================================================================

alter table public.kids_okullar add column if not exists tur text not null default 'anaokulu';
alter table public.kids_okullar drop constraint if exists kids_okullar_tur_kontrol;
alter table public.kids_okullar add constraint kids_okullar_tur_kontrol check (tur in ('kres', 'anaokulu', 'ilkokul'));

-- yalnız Yıldızlar sınıfı olan okullar ilkokuldur
update public.kids_okullar o set tur = 'ilkokul'
where tur = 'anaokulu' and exists (select 1 from public.kids_siniflar s where s.okul_id = o.id and s.bant = 'yildiz')
  and not exists (select 1 from public.kids_siniflar s where s.okul_id = o.id and s.bant <> 'yildiz');

create or replace function public.kids_tur_bant(p_tur text, p_bant text) returns boolean language sql immutable as $$
  select case p_tur when 'ilkokul' then p_bant = 'yildiz' else p_bant in ('minik', 'kasif') end
$$;

create or replace function public.kids_okul_json(p_okul uuid)
 returns json language sql stable security definer set search_path to 'public' as $function$
  select json_build_object('id', o.id, 'kod', o.kod, 'ad', o.ad, 'tur', o.tur, 'ilce', o.ilce, 'il', o.il, 'yetkili_ad', o.yetkili_ad, 'yetkili_tel', o.yetkili_tel,
    'lisans_bas', o.lisans_bas, 'lisans_bit', o.lisans_bit, 'kota', o.kota, 'ucret_kurus', o.ucret_kurus, 'odeme', o.odeme, 'notlar', o.notlar, 'aktif', o.aktif,
    'sifre_var', o.sifre_ozet is not null, 'yonetici_var', o.yonetici_ozet is not null, 'kaynak', o.kaynak, 'eposta', o.eposta, 'created_at', o.created_at,
    'ogrenci', (select count(*) from kids_ogrenciler g where g.okul_id = o.id and g.aktif),
    'sinif', (select count(*) from kids_siniflar s where s.okul_id = o.id),
    'ogretmen', (select count(*) from kids_ogretmenler t where t.okul_id = o.id and t.aktif))
  from kids_okullar o where o.id = p_okul
$function$;

create or replace function public.kids_okul_kaydet(p jsonb)
 returns json language plpgsql security definer set search_path to 'public' as $function$
declare v_id uuid := nullif(p->>'id', '')::uuid; v_kota int := coalesce((p->>'kota')::int, 100); n int; yeni boolean := v_id is null;
  v_tur text := coalesce(nullif(p->>'tur', ''), 'anaokulu');
begin
  perform public.admin_guard();
  if v_tur not in ('kres', 'anaokulu', 'ilkokul') then raise exception 'Kurum türü kreş, anaokulu ya da ilkokul olmalı.'; end if;
  if not yeni then
    select count(*) into n from kids_ogrenciler where okul_id = v_id and aktif;
    if n > v_kota then raise exception 'Bu okulda % etkin öğrenci var; kota % olamaz.', n, v_kota; end if;
    if exists (select 1 from kids_siniflar where okul_id = v_id and not public.kids_tur_bant(v_tur, bant)) then
      raise exception 'Bu okulda türe uymayan sınıflar var (ilkokulda yalnız Yıldızlar, kreş ve anaokulunda Minikler / Kâşifler). Önce sınıfları düzenleyin.';
    end if;
  end if;
  if yeni then
    insert into kids_okullar (kod, ad, tur, ilce, il, yetkili_ad, yetkili_tel, lisans_bas, lisans_bit, kota, ucret_kurus, odeme, notlar)
    values (upper(trim(p->>'kod')), trim(p->>'ad'), v_tur, coalesce(trim(p->>'ilce'), ''), coalesce(nullif(trim(p->>'il'), ''), 'Ankara'),
      coalesce(trim(p->>'yetkili_ad'), ''), coalesce(trim(p->>'yetkili_tel'), ''),
      coalesce((p->>'lisans_bas')::date, current_date), coalesce((p->>'lisans_bit')::date, current_date + 365),
      v_kota, coalesce((p->>'ucret_kurus')::bigint, 3490000), coalesce(p->>'odeme', 'bekliyor'), coalesce(p->>'notlar', ''))
    returning id into v_id;
  else
    update kids_okullar set kod = upper(trim(p->>'kod')), ad = trim(p->>'ad'), tur = v_tur, ilce = coalesce(trim(p->>'ilce'), ''), il = coalesce(nullif(trim(p->>'il'), ''), 'Ankara'),
      yetkili_ad = coalesce(trim(p->>'yetkili_ad'), ''), yetkili_tel = coalesce(trim(p->>'yetkili_tel'), ''),
      lisans_bas = (p->>'lisans_bas')::date, lisans_bit = (p->>'lisans_bit')::date, kota = v_kota,
      ucret_kurus = coalesce((p->>'ucret_kurus')::bigint, ucret_kurus), odeme = coalesce(p->>'odeme', odeme), notlar = coalesce(p->>'notlar', ''),
      aktif = coalesce((p->>'aktif')::boolean, aktif), updated_at = now()
    where id = v_id;
    if not found then raise exception 'Okul bulunamadı.'; end if;
  end if;
  perform public.admin_log(case when yeni then 'kids_okul_ekle' else 'kids_okul_guncelle' end, null, (select kod || ' · ' || ad from kids_okullar where id = v_id),
    jsonb_build_object('kota', v_kota, 'lisans_bit', p->>'lisans_bit', 'odeme', p->>'odeme', 'tur', v_tur));
  return public.kids_okul_json(v_id);
exception when unique_violation then raise exception 'Bu okul kodu başka bir okulda kullanılıyor.';
end $function$;

create or replace function public.kids_sinif_kaydet(p_okul uuid, p_id uuid, p_ad text, p_bant text)
 returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare v uuid := p_id; v_tur text;
begin
  perform public.admin_guard();
  select tur into v_tur from kids_okullar where id = p_okul;
  if v_tur is null then raise exception 'Okul bulunamadı.'; end if;
  if not public.kids_tur_bant(v_tur, p_bant) then
    raise exception '%', case when v_tur = 'ilkokul' then 'İlkokulda sınıflar Yıldızlar (7-10 yaş) yaş dünyasında olur.' else 'Kreş ve anaokulunda sınıflar Minikler ya da Kâşifler olur; Yıldızlar ilkokul içindir.' end;
  end if;
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
end $function$;

create or replace function public.kids_okul_bul(p_kod text)
 returns json language plpgsql security definer set search_path to 'public' as $function$
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
  return json_build_object('kod', o.kod, 'ad', o.ad, 'tur', o.tur, 'siniflar', coalesce((select json_agg(json_build_object('id', s.id, 'ad', s.ad, 'bant', s.bant,
      'ogr', coalesce((select json_agg(json_build_object('id', g.id, 'ad', g.ad, 'hayvan', g.hayvan, 'renk', g.renk) order by g.ad, g.no) from kids_ogrenciler g where g.sinif_id = s.id and g.aktif), '[]'::json))
    order by s.created_at) from kids_siniflar s where s.okul_id = o.id), '[]'::json));
end $function$;

create or replace function public.kids_durum(p_token text)
 returns json language plpgsql stable security definer set search_path to 'public' as $function$
declare o kids_oturumlar := public.kids_oturum(p_token, 'cocuk'); v_sinif uuid; b json;
begin
  select sinif_id into v_sinif from kids_ogrenciler where id = o.ogrenci_id;
  b := public.kids_gun_bilgi(v_sinif, (now() at time zone 'Europe/Istanbul')::date);
  return (select json_build_object('okul', json_build_object('kod', k.kod, 'ad', k.ad, 'tur', k.tur),
      'sinif', json_build_object('id', s.id, 'ad', s.ad, 'bant', s.bant),
      'ogr', json_build_object('id', g.id, 'ad', g.ad, 'hayvan', g.hayvan, 'renk', g.renk),
      'bugun', b->>'konu', 'etkinlik', b->>'etkinlik', 'set', b->'set',
      'ilerleme', (select i.veri from kids_ilerleme i where i.ogrenci_id = g.id))
    from kids_ogrenciler g join kids_siniflar s on s.id = g.sinif_id join kids_okullar k on k.id = g.okul_id where g.id = o.ogrenci_id);
end $function$;

-- kontrol: okul sayısı türlere göre
select tur, count(*) from public.kids_okullar group by tur order by tur;
