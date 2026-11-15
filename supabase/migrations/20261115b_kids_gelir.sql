-- ============================================================================
-- Acadex Kids gelir modeli (yönetim paneli › Finans › Kids), 15.11.2026
--   * Kontenjan paketleri: Mini (30), Standart (60), Büyük (100), Kampüs (100+, özel fiyat)
--   * Dönem: aylık / 6 aylık / yıllık; dönem indirimi (varsayılan %10 / %20)
--   * Erken kayıt (bitiş tarihine kadar) ve referans indirimi (başka kreşin okul kodu)
--   * Teklif → protokol → imza (okul lisanslı açılır) → tahsilat takvimi (taksit) → ödendi
--   * Satış hunisi: istek (kids_basvurular) → arandı → teklif → imza → ödendi
--   * Aralık sonuna kadar yol haritası: fin_tasks'a "Kids · " önekiyle bir kez eklenir
-- Bütün tutarlar kuruş, KDV hariç (KDV ayrı hesaplanır). Erişim: fin_ok() (yönetici + finans ekibi).
-- Hesap sunucuda yapılır (kids_teklif_hesap); panel aynı formülle önizleme gösterir.
-- ============================================================================

create table if not exists public.kids_paketler (
  kod         text primary key check (kod ~ '^[a-z]{2,12}$'),
  ad          text not null check (char_length(ad) between 2 and 40),
  kota        integer not null check (kota between 1 and 5000),
  aylik_kurus bigint not null check (aylik_kurus >= 0),
  ozel        boolean not null default false,          -- kampüs: tutar teklifte elle girilir
  sira        integer not null default 0,
  aktif       boolean not null default true
);
insert into public.kids_paketler (kod, ad, kota, aylik_kurus, ozel, sira) values
  ('mini', 'Mini', 30, 149000, false, 1), ('standart', 'Standart', 60, 249000, false, 2),
  ('buyuk', 'Büyük', 100, 349000, false, 3), ('kampus', 'Kampüs', 300, 0, true, 4)
on conflict (kod) do nothing;

create table if not exists public.kids_gelir_ayar (
  id                  integer primary key default 1 check (id = 1),
  indirim_6ay         numeric(5,2) not null default 10 check (indirim_6ay between 0 and 60),
  indirim_yil         numeric(5,2) not null default 20 check (indirim_yil between 0 and 60),
  erken_yuzde         numeric(5,2) not null default 10 check (erken_yuzde between 0 and 50),
  erken_bitis         date not null default date '2026-12-31',
  referans_yuzde      numeric(5,2) not null default 10 check (referans_yuzde between 0 and 50),
  ek_indirim_ust      numeric(5,2) not null default 15 check (ek_indirim_ust between 0 and 50),
  kdv                 numeric(5,2) not null default 20 check (kdv between 0 and 50),
  hedef_tarih         date not null default date '2026-12-31',
  hedef_kres          integer not null default 10 check (hedef_kres between 0 and 100000),
  hedef_tahsilat_kurus bigint not null default 15000000 check (hedef_tahsilat_kurus >= 0),
  updated_at          timestamptz not null default now()
);
insert into public.kids_gelir_ayar (id) values (1) on conflict (id) do nothing;

create table if not exists public.kids_teklifler (
  id            uuid primary key default gen_random_uuid(),
  no            bigserial,
  basvuru_id    uuid references public.kids_basvurular(id) on delete set null,
  okul_id       uuid references public.kids_okullar(id) on delete set null,
  kres_ad       text not null check (char_length(kres_ad) between 2 and 120),
  yetkili_ad    text not null default '' check (char_length(yetkili_ad) <= 80),
  eposta        text not null default '' check (char_length(eposta) <= 120),
  tel           text not null default '' check (char_length(tel) <= 20),
  il            text not null default '' check (char_length(il) <= 40),
  ilce          text not null default '' check (char_length(ilce) <= 60),
  paket         text not null references public.kids_paketler(kod),
  donem         text not null check (donem in ('aylik', '6ay', 'yil')),
  ogrenci       integer not null default 0 check (ogrenci between 0 and 5000),
  kota          integer not null check (kota between 1 and 5000),
  taksit        integer not null default 1 check (taksit between 1 and 3),
  aylik_kurus   bigint not null check (aylik_kurus >= 0),
  liste_kurus   bigint not null,                       -- aylık × ay
  indirimler    jsonb not null default '[]'::jsonb,    -- [{ad, yuzde, kurus}]
  net_kurus     bigint not null,                       -- KDV hariç
  kdv_kurus     bigint not null,
  toplam_kurus  bigint not null,
  erken         boolean not null default false,
  ref_kod       text not null default '',
  ek_yuzde      numeric(5,2) not null default 0,
  baslangic     date not null,
  bitis         date not null,
  durum         text not null default 'taslak' check (durum in ('taslak', 'gonderildi', 'imzalandi', 'kaybedildi', 'iptal')),
  notlar        text not null default '' check (char_length(notlar) <= 1000),
  created_at    timestamptz not null default now(),
  gonderim_at   timestamptz,
  imza_at       timestamptz
);
create index if not exists kids_teklifler_durum on public.kids_teklifler (durum, created_at desc);

create table if not exists public.kids_tahsilatlar (
  id          uuid primary key default gen_random_uuid(),
  teklif_id   uuid not null references public.kids_teklifler(id) on delete cascade,
  sira        integer not null check (sira between 1 and 12),
  vade        date not null,
  tutar_kurus bigint not null check (tutar_kurus >= 0),   -- KDV dahil
  odendi_at   timestamptz,
  yontem      text not null default '' check (yontem in ('', 'havale', 'kart', 'nakit', 'diger')),
  unique (teklif_id, sira)
);

do $$ declare t text; begin
  foreach t in array array['kids_paketler', 'kids_gelir_ayar', 'kids_teklifler', 'kids_tahsilatlar'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- teklifle açılan okul
alter table public.kids_okullar drop constraint if exists kids_okullar_kaynak_check;
alter table public.kids_okullar add constraint kids_okullar_kaynak_check check (kaynak in ('admin', 'basvuru', 'teklif'));
-- huni: "teklif gönderildi" durumu istekte de görünsün
alter table public.kids_basvurular drop constraint if exists kids_basvurular_durum_check;
alter table public.kids_basvurular add constraint kids_basvurular_durum_check check (durum in ('bekliyor', 'arandi', 'teklif', 'onaylandi', 'reddedildi'));

-- istek reddi "teklif gönderildi" durumundaki istekte de çalışsın
create or replace function public.kids_basvuru_reddet(p_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.admin_guard();
  update kids_basvurular set durum = 'reddedildi', karar_at = now() where id = p_id and durum in ('bekliyor', 'arandi', 'teklif');
  if not found then raise exception 'Bekleyen istek bulunamadı.'; end if;
  perform public.admin_log('kids_basvuru_reddet', null, null, jsonb_build_object('id', p_id));
end $$;

create or replace function public.kids_fin_guard()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.fin_ok() then raise exception 'Bu işlem için finans yetkisi gerekiyor.' using errcode = '42501'; end if;
end $$;

-- fiyat hesabı (tek kaynak). p: {paket, donem, ogrenci?, taksit?, ozel_aylik_kurus?, erken?, ref_kod?, ek_yuzde?, tarih?}
create or replace function public.kids_teklif_hesap(p jsonb)
returns json language plpgsql stable security definer set search_path = public as $$
declare a kids_gelir_ayar; k kids_paketler; ay int; aylik bigint; liste bigint; kalan numeric; ind jsonb := '[]'::jsonb;
  y numeric; tutar bigint; net bigint; kdv bigint; tk int; ref text := upper(trim(coalesce(p->>'ref_kod', ''))); tarih date := coalesce((p->>'tarih')::date, (now() at time zone 'Europe/Istanbul')::date);
  erken boolean := coalesce((p->>'erken')::boolean, false); ek numeric := coalesce(nullif(p->>'ek_yuzde', '')::numeric, 0);
begin
  perform public.kids_fin_guard();
  select * into a from kids_gelir_ayar where id = 1;
  select * into k from kids_paketler where kod = p->>'paket' and aktif;
  if k.kod is null then raise exception 'Paket bulunamadı.'; end if;
  ay := case p->>'donem' when 'aylik' then 1 when '6ay' then 6 when 'yil' then 12 else null end;
  if ay is null then raise exception 'Dönem aylık, 6 aylık ya da yıllık olmalı.'; end if;
  aylik := case when k.ozel then coalesce(nullif(p->>'ozel_aylik_kurus', '')::bigint, 0) else k.aylik_kurus end;
  if aylik <= 0 then raise exception 'Kampüs paketi için aylık tutarı yazın.'; end if;
  liste := aylik * ay; kalan := liste;
  y := case ay when 6 then a.indirim_6ay when 12 then a.indirim_yil else 0 end;
  if y > 0 then tutar := round(kalan * y / 100); kalan := kalan - tutar; ind := ind || jsonb_build_object('ad', case ay when 6 then '6 aylık dönem' else 'Yıllık dönem' end, 'yuzde', y, 'kurus', tutar); end if;
  if erken and tarih <= a.erken_bitis and a.erken_yuzde > 0 then
    tutar := round(kalan * a.erken_yuzde / 100); kalan := kalan - tutar; ind := ind || jsonb_build_object('ad', 'Erken kayıt (' || to_char(a.erken_bitis, 'DD.MM.YYYY') || '''e kadar)', 'yuzde', a.erken_yuzde, 'kurus', tutar);
  elsif erken then erken := false;
  end if;
  if ref <> '' then
    if not exists (select 1 from kids_okullar where kod = ref) then raise exception 'Referans okul kodu bulunamadı: %', ref; end if;
    tutar := round(kalan * a.referans_yuzde / 100); kalan := kalan - tutar; ind := ind || jsonb_build_object('ad', 'Referans (' || ref || ')', 'yuzde', a.referans_yuzde, 'kurus', tutar);
  end if;
  if ek < 0 or ek > a.ek_indirim_ust then raise exception 'Ek indirim en çok %% % olabilir.', a.ek_indirim_ust; end if;
  if ek > 0 then tutar := round(kalan * ek / 100); kalan := kalan - tutar; ind := ind || jsonb_build_object('ad', 'Ek indirim', 'yuzde', ek, 'kurus', tutar); end if;
  net := round(kalan); kdv := round(net * a.kdv / 100);
  tk := least(greatest(coalesce(nullif(p->>'taksit', '')::int, 1), 1), case ay when 12 then 3 else 1 end);
  return json_build_object('paket', k.kod, 'paket_ad', k.ad, 'kota', case when k.ozel then greatest(coalesce(nullif(p->>'ogrenci', '')::int, 0), k.kota) else k.kota end,
    'donem', p->>'donem', 'ay', ay, 'aylik_kurus', aylik, 'liste_kurus', liste, 'indirimler', ind, 'net_kurus', net, 'kdv', a.kdv, 'kdv_kurus', kdv, 'toplam_kurus', net + kdv,
    'aylik_esdeger_kurus', round(net::numeric / ay), 'taksit', tk, 'erken', erken, 'ref_kod', ref, 'ek_yuzde', ek);
end $$;

-- tahsilat takvimi: taksitler eşit, kalan kuruş sonuncuya; vadeler başlangıçtan itibaren aylık ya da dönem içine yayılır
create or replace function public.kids_takvim_kur(p_teklif uuid)
returns void language plpgsql security definer set search_path = public as $$
declare t kids_teklifler; i int; parca bigint; aralik int;
begin
  select * into t from kids_teklifler where id = p_teklif;
  delete from kids_tahsilatlar where teklif_id = p_teklif and odendi_at is null;
  if exists (select 1 from kids_tahsilatlar where teklif_id = p_teklif) then return; end if;   -- ödeme başlamışsa dokunma
  parca := t.toplam_kurus / t.taksit; aralik := case t.taksit when 2 then 6 when 3 then 4 else 0 end;
  for i in 1..t.taksit loop
    insert into kids_tahsilatlar (teklif_id, sira, vade, tutar_kurus)
    values (p_teklif, i, t.baslangic + make_interval(months => aralik * (i - 1))::interval, case when i = t.taksit then t.toplam_kurus - parca * (t.taksit - 1) else parca end);
  end loop;
end $$;

-- teklif kaydet (yeni ya da taslak/gönderilmiş güncelle). p: hesap alanları + {id?, basvuru_id?, kres_ad, yetkili_ad, eposta, tel, il, ilce, baslangic, notlar}
create or replace function public.kids_teklif_kaydet(p jsonb)
returns json language plpgsql volatile security definer set search_path = public as $$
declare h json; v uuid := nullif(p->>'id', '')::uuid; bas date := coalesce(nullif(p->>'baslangic', '')::date, (now() at time zone 'Europe/Istanbul')::date); o kids_teklifler; b kids_basvurular;
begin
  perform public.kids_fin_guard();
  if v is not null then
    select * into o from kids_teklifler where id = v for update;
    if o.id is null then raise exception 'Teklif bulunamadı.'; end if;
    if o.durum not in ('taslak', 'gonderildi') then raise exception 'İmzalanmış ya da kapanmış teklif değiştirilemez; yenisini oluşturun.'; end if;
  end if;
  if length(trim(coalesce(p->>'kres_ad', ''))) < 2 then raise exception 'Kreş adını yazın.'; end if;
  h := public.kids_teklif_hesap(p || jsonb_build_object('tarih', coalesce(o.created_at::date, (now() at time zone 'Europe/Istanbul')::date)));
  if v is null then
    insert into kids_teklifler (basvuru_id, kres_ad, yetkili_ad, eposta, tel, il, ilce, paket, donem, ogrenci, kota, taksit, aylik_kurus, liste_kurus, indirimler, net_kurus, kdv_kurus, toplam_kurus, erken, ref_kod, ek_yuzde, baslangic, bitis, notlar)
    values (nullif(p->>'basvuru_id', '')::uuid, trim(p->>'kres_ad'), left(trim(coalesce(p->>'yetkili_ad', '')), 80), lower(left(trim(coalesce(p->>'eposta', '')), 120)), left(trim(coalesce(p->>'tel', '')), 20),
      left(trim(coalesce(p->>'il', '')), 40), left(trim(coalesce(p->>'ilce', '')), 60), h->>'paket', h->>'donem', coalesce(nullif(p->>'ogrenci', '')::int, 0), (h->>'kota')::int, (h->>'taksit')::int,
      (h->>'aylik_kurus')::bigint, (h->>'liste_kurus')::bigint, (h->'indirimler')::jsonb, (h->>'net_kurus')::bigint, (h->>'kdv_kurus')::bigint, (h->>'toplam_kurus')::bigint,
      (h->>'erken')::boolean, h->>'ref_kod', (h->>'ek_yuzde')::numeric, bas, (bas + make_interval(months => (h->>'ay')::int) - interval '1 day')::date, left(coalesce(p->>'notlar', ''), 1000))
    returning id into v;
  else
    update kids_teklifler set kres_ad = trim(p->>'kres_ad'), yetkili_ad = left(trim(coalesce(p->>'yetkili_ad', '')), 80), eposta = lower(left(trim(coalesce(p->>'eposta', '')), 120)), tel = left(trim(coalesce(p->>'tel', '')), 20),
      il = left(trim(coalesce(p->>'il', '')), 40), ilce = left(trim(coalesce(p->>'ilce', '')), 60), paket = h->>'paket', donem = h->>'donem', ogrenci = coalesce(nullif(p->>'ogrenci', '')::int, 0), kota = (h->>'kota')::int,
      taksit = (h->>'taksit')::int, aylik_kurus = (h->>'aylik_kurus')::bigint, liste_kurus = (h->>'liste_kurus')::bigint, indirimler = (h->'indirimler')::jsonb, net_kurus = (h->>'net_kurus')::bigint,
      kdv_kurus = (h->>'kdv_kurus')::bigint, toplam_kurus = (h->>'toplam_kurus')::bigint, erken = (h->>'erken')::boolean, ref_kod = h->>'ref_kod', ek_yuzde = (h->>'ek_yuzde')::numeric,
      baslangic = bas, bitis = (bas + make_interval(months => (h->>'ay')::int) - interval '1 day')::date, notlar = left(coalesce(p->>'notlar', ''), 1000)
    where id = v;
  end if;
  perform public.kids_takvim_kur(v);
  perform public.fin_log('kids_teklif', trim(p->>'kres_ad'), jsonb_build_object('paket', h->>'paket', 'donem', h->>'donem', 'net', h->>'net_kurus'));
  return (select row_to_json(x) from kids_teklifler x where x.id = v);
end $$;

-- durum: gonderildi / kaybedildi / iptal (imza ayrı fonksiyonda)
create or replace function public.kids_teklif_durum(p_id uuid, p_durum text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare t kids_teklifler;
begin
  perform public.kids_fin_guard();
  if p_durum not in ('taslak', 'gonderildi', 'kaybedildi', 'iptal') then raise exception 'Durum geçersiz.'; end if;
  select * into t from kids_teklifler where id = p_id for update;
  if t.id is null then raise exception 'Teklif bulunamadı.'; end if;
  if t.durum = 'imzalandi' then raise exception 'İmzalanmış teklifin durumu buradan değişmez.'; end if;
  update kids_teklifler set durum = p_durum, gonderim_at = case when p_durum = 'gonderildi' then coalesce(gonderim_at, now()) else gonderim_at end where id = p_id;
  if p_durum = 'gonderildi' and t.basvuru_id is not null then update kids_basvurular set durum = 'teklif' where id = t.basvuru_id and durum in ('bekliyor', 'arandi'); end if;
  perform public.fin_log('kids_teklif_durum', t.kres_ad, jsonb_build_object('durum', p_durum));
end $$;

-- imza: okul lisanslı açılır (dönem tarihleri, paket kotası, ücret); şifreler YALNIZ bu yanıtta döner
create or replace function public.kids_teklif_imzala(p_id uuid, p_kod text)
returns json language plpgsql volatile security definer set search_path = public, extensions as $$
declare t kids_teklifler; v_okul uuid; ys text := public.kids_okunakli_sifre(8); os text := public.kids_pin_uret(); k text := upper(trim(coalesce(p_kod, '')));
begin
  perform public.kids_fin_guard();
  select * into t from kids_teklifler where id = p_id for update;
  if t.id is null then raise exception 'Teklif bulunamadı.'; end if;
  if t.durum not in ('taslak', 'gonderildi') then raise exception 'Bu teklif imzaya açık değil.'; end if;
  if k !~ '^[A-Z0-9]{2,8}-[0-9]{4}$' then raise exception 'Okul kodu AY-2026 biçiminde olmalı.'; end if;
  insert into kids_okullar (kod, ad, ilce, il, yetkili_ad, yetkili_tel, eposta, lisans_bas, lisans_bit, kota, ucret_kurus, odeme, kaynak, sifre_ozet, yonetici_ozet, notlar)
  values (k, t.kres_ad, t.ilce, coalesce(nullif(t.il, ''), 'Ankara'), t.yetkili_ad, t.tel, t.eposta, t.baslangic, t.bitis, t.kota, t.net_kurus, 'bekliyor', 'teklif',
    extensions.crypt(os, extensions.gen_salt('bf')), extensions.crypt(ys, extensions.gen_salt('bf', 8)),
    'Teklif #' || t.no || ' · ' || (select ad from kids_paketler where kod = t.paket) || ' · ' || case t.donem when 'aylik' then 'aylık' when '6ay' then '6 aylık' else 'yıllık' end)
  returning id into v_okul;
  update kids_teklifler set durum = 'imzalandi', imza_at = now(), okul_id = v_okul where id = p_id;
  if t.basvuru_id is not null then update kids_basvurular set durum = 'onaylandi', okul_id = v_okul, karar_at = now() where id = t.basvuru_id; end if;
  perform public.fin_log('kids_teklif_imza', k || ' · ' || t.kres_ad, jsonb_build_object('net', t.net_kurus, 'donem', t.donem));
  return json_build_object('okul_kod', k, 'yonetici_sifre', ys, 'ogretmen_sifre', os);
exception when unique_violation then raise exception 'Bu okul kodu başka bir okulda kullanılıyor.';
end $$;

-- tahsilat işaretle; bütün taksitler ödenince okulun ödeme durumu "ödendi"
create or replace function public.kids_tahsilat_isaretle(p_id uuid, p_odendi boolean, p_yontem text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare th kids_tahsilatlar; t kids_teklifler;
begin
  perform public.kids_fin_guard();
  select * into th from kids_tahsilatlar where id = p_id for update;
  if th.id is null then raise exception 'Tahsilat bulunamadı.'; end if;
  select * into t from kids_teklifler where id = th.teklif_id;
  if t.durum <> 'imzalandi' then raise exception 'Önce teklif imzalanmalı.'; end if;
  update kids_tahsilatlar set odendi_at = case when p_odendi then coalesce(odendi_at, now()) else null end,
    yontem = case when p_odendi then coalesce(nullif(p_yontem, ''), 'havale') else '' end where id = p_id;
  if t.okul_id is not null then
    update kids_okullar set odeme = case when not exists (select 1 from kids_tahsilatlar where teklif_id = t.id and odendi_at is null) then 'odendi' else 'bekliyor' end, updated_at = now() where id = t.okul_id;
  end if;
  perform public.fin_log('kids_tahsilat', t.kres_ad, jsonb_build_object('sira', th.sira, 'odendi', p_odendi, 'tutar', th.tutar_kurus));
end $$;

create or replace function public.kids_gelir_ayar_kaydet(p jsonb)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.kids_fin_guard();
  update kids_gelir_ayar set
    indirim_6ay = coalesce((p->>'indirim_6ay')::numeric, indirim_6ay), indirim_yil = coalesce((p->>'indirim_yil')::numeric, indirim_yil),
    erken_yuzde = coalesce((p->>'erken_yuzde')::numeric, erken_yuzde), erken_bitis = coalesce((p->>'erken_bitis')::date, erken_bitis),
    referans_yuzde = coalesce((p->>'referans_yuzde')::numeric, referans_yuzde), ek_indirim_ust = coalesce((p->>'ek_indirim_ust')::numeric, ek_indirim_ust),
    kdv = coalesce((p->>'kdv')::numeric, kdv), hedef_tarih = coalesce((p->>'hedef_tarih')::date, hedef_tarih), hedef_kres = coalesce((p->>'hedef_kres')::int, hedef_kres),
    hedef_tahsilat_kurus = coalesce((p->>'hedef_tahsilat_kurus')::bigint, hedef_tahsilat_kurus), updated_at = now()
  where id = 1;
  perform public.fin_log('kids_gelir_ayar', null, p);
end $$;

create or replace function public.kids_paket_kaydet(p_kod text, p_ad text, p_kota integer, p_aylik_kurus bigint, p_aktif boolean)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.kids_fin_guard();
  update kids_paketler set ad = trim(p_ad), kota = p_kota, aylik_kurus = case when ozel then 0 else p_aylik_kurus end, aktif = p_aktif where kod = p_kod;
  if not found then raise exception 'Paket bulunamadı.'; end if;
  perform public.fin_log('kids_paket', p_kod, jsonb_build_object('kota', p_kota, 'aylik', p_aylik_kurus, 'aktif', p_aktif));
end $$;

-- panelin tek okuması: ayarlar, paketler, teklifler + tahsilatlar, istekler, okullar
create or replace function public.kids_gelir_ozet()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  perform public.kids_fin_guard();
  return json_build_object(
    'bugun', (now() at time zone 'Europe/Istanbul')::date,
    'ayar', (select row_to_json(a) from kids_gelir_ayar a where id = 1),
    'paketler', coalesce((select json_agg(row_to_json(k) order by k.sira) from kids_paketler k), '[]'::json),
    'teklifler', coalesce((select json_agg(json_build_object('t', row_to_json(t), 'okul_kod', o.kod,
        'tahsilat', coalesce((select json_agg(row_to_json(h) order by h.sira) from kids_tahsilatlar h where h.teklif_id = t.id), '[]'::json)) order by t.created_at desc)
      from kids_teklifler t left join kids_okullar o on o.id = t.okul_id), '[]'::json),
    'istekler', coalesce((select json_agg(json_build_object('id', b.id, 'kres_ad', b.kres_ad, 'yetkili_ad', b.yetkili_ad, 'eposta', b.eposta, 'tel', b.tel, 'il', b.il, 'ilce', b.ilce,
        'ogrenci_sayi', b.ogrenci_sayi, 'durum', b.durum, 'created_at', b.created_at) order by b.created_at desc) from (select * from kids_basvurular order by created_at desc limit 300) b), '[]'::json),
    'okullar', coalesce((select json_agg(json_build_object('id', o.id, 'kod', o.kod, 'ad', o.ad, 'aktif', o.aktif, 'lisans_bas', o.lisans_bas, 'lisans_bit', o.lisans_bit, 'odeme', o.odeme, 'kaynak', o.kaynak,
        'ucret_kurus', o.ucret_kurus, 'kota', o.kota, 'ogrenci', (select count(*) from kids_ogrenciler g where g.okul_id = o.id and g.aktif))) from kids_okullar o), '[]'::json),
    'gorevler', coalesce((select json_agg(row_to_json(f) order by f.due_on nulls last, f.created_at) from fin_tasks f where f.title like 'Kids · %'), '[]'::json));
end $$;

-- Aralık sonuna kadar yol haritası (bir kez; aynı başlık varsa eklenmez)
create or replace function public.kids_gelir_yol_kur()
returns integer language plpgsql volatile security definer set search_path = public as $$
declare n int := 0; r record;
begin
  perform public.kids_fin_guard();
  for r in select * from (values
    ('Kids · Paket fiyatlarını onayla (Mini, Standart, Büyük, Kampüs)', 'Finans › Kids › Ayarlar. Rakamlar KDV hariç. Rakip ve maliyetle karşılaştır; kurucuyla kesinleştir.', date '2026-11-18', 'Sudegül'),
    ('Kids · Dönem, erken kayıt ve referans oranlarını kesinleştir', '6 aylık / yıllık indirim, erken kayıt bitişi (31.12.2026), referans oranı, ek indirim üst sınırı.', date '2026-11-19', 'Sudegül'),
    ('Kids · Fatura ve KDV sürecini muhasebeyle netleştir', 'e-Fatura / e-Arşiv, fatura kesim anı (imza mı ödeme mi), KDV oranı teyidi.', date '2026-11-20', 'Sudegül'),
    ('Kids · Tahsilat kanalını belirle', 'Havale/EFT için şirket IBAN''ı ve açıklama formatı (teklif no). Kart ile tahsilat ileride.', date '2026-11-21', 'Sudegül'),
    ('Kids · Protokol taslağını hukuk kontrolüne gönder', 'Panelden "Protokol yazdır" ile örnek çıkar. KVKK, veri işleme, iptal, yenileme maddeleri hukukçuya.', date '2026-11-22', 'Sudegül'),
    ('Kids · Ankara hedef kreş listesi (50 kreş)', 'İlçe, öğrenci sayısı tahmini, yetkili, iletişim. Satış hunisine istek olarak girilecek adaylar.', date '2026-11-26', 'Satış'),
    ('Kids · 3 örnek teklifle şablonu dene', 'Mini aylık, Standart 6 aylık, Büyük yıllık 3 taksit. Tutar ve takvim kontrolü.', date '2026-11-27', 'Sudegül'),
    ('Kids · Referans programı kurallarını yaz', 'Getiren ve gelen kreşe indirim; okul koduyla takip; kötüye kullanım sınırı.', date '2026-11-28', 'Sudegül'),
    ('Kids · İlk 15 kreşe ulaş, tanıtım görüşmesi planla', 'Gelen istekler + hedef liste. Her görüşme sonrası istek durumunu "arandı" yap.', date '2026-12-03', 'Satış'),
    ('Kids · Protokolün son hâli imzaya hazır', 'Hukuk dönüşleri işlendi; panel şablonu güncellendi.', date '2026-12-05', 'Sudegül'),
    ('Kids · 5 teklif gönder', 'Teklifler › Gönderildi. Erken kayıt avantajını vurgula.', date '2026-12-06', 'Satış'),
    ('Kids · İlk 3 imza ve okul kurulumu', 'İmza → okul lisanslı açılır; sınıf, öğrenci listesi, kart baskısı.', date '2026-12-13', 'Sudegül'),
    ('Kids · İlk tahsilatları al ve işaretle', 'Tahsilat sekmesinde ödendi işaretle; vadesi geçenleri ara.', date '2026-12-15', 'Sudegül'),
    ('Kids · 6 imzaya ulaş, aylık planları yenileme takvimine al', 'Aylık planların bir sonraki ay teklifini hazırla.', date '2026-12-20', 'Satış'),
    ('Kids · Erken kayıt son hatırlatması', 'Teklif almış ama imzalamamış kreşlere 31 Aralık hatırlatması.', date '2026-12-24', 'Satış'),
    ('Kids · 10 imza hedefi', 'Aralık sonu kreş hedefi (Ayarlar › Hedef).', date '2026-12-28', 'Sudegül'),
    ('Kids · Aralık kapanış raporu ve Ocak planı', 'Gelir panosu: imza, tahsilat, bekleyen; 2027 fiyat ve hedef gözden geçirme.', date '2026-12-31', 'Sudegül')
  ) v(title, detail, due_on, assignee) loop
    if not exists (select 1 from fin_tasks where title = r.title) then
      insert into fin_tasks (title, detail, due_on, assignee) values (r.title, r.detail, r.due_on, r.assignee); n := n + 1;
    end if;
  end loop;
  perform public.fin_log('kids_yol_haritasi', null, jsonb_build_object('eklenen', n));
  return n;
end $$;

do $$ declare f text; begin
  foreach f in array array['kids_fin_guard()', 'kids_takvim_kur(uuid)'] loop
    execute 'revoke all on function public.' || f || ' from public, anon, authenticated';
  end loop;
  foreach f in array array['kids_teklif_hesap(jsonb)', 'kids_teklif_kaydet(jsonb)', 'kids_teklif_durum(uuid, text)', 'kids_teklif_imzala(uuid, text)',
    'kids_tahsilat_isaretle(uuid, boolean, text)', 'kids_gelir_ayar_kaydet(jsonb)', 'kids_paket_kaydet(text, text, integer, bigint, boolean)', 'kids_gelir_ozet()', 'kids_gelir_yol_kur()'] loop
    execute 'revoke all on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;

notify pgrst, 'reload schema';
