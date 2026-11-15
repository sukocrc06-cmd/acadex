-- ============================================================================
-- Acadex Kids fiyat yapısı düzeltmesi, 15.11.2026 (20261115b_kids_gelir.sql'den SONRA çalıştırın)
-- Dönem indirimi artık yüzde değil: her paketin her dönem için kendi AYLIK fiyatı var.
--   Aylık plan 27.500 TL/ay · 6 aylık plan 25.500 TL/ay · yıllık plan 24.500 TL/ay (KDV hariç)
-- Teklifte liste fiyatı "aylık plan × ay"dır; seçilen dönemin farkı "dönem avantajı" satırı olarak düşer,
-- erken kayıt / referans / ek indirim (yüzde) ondan sonra uygulanır. kids_gelir_ayar.indirim_6ay ve
-- indirim_yil artık kullanılmaz (sütunlar duruyor).
-- ============================================================================
alter table public.kids_paketler add column if not exists alti_ay_kurus bigint not null default 0 check (alti_ay_kurus >= 0);
alter table public.kids_paketler add column if not exists yil_kurus bigint not null default 0 check (yil_kurus >= 0);
update public.kids_paketler set aylik_kurus = 2750000, alti_ay_kurus = 2550000, yil_kurus = 2450000 where kod in ('mini', 'standart', 'buyuk');

create or replace function public.kids_teklif_hesap(p jsonb)
returns json language plpgsql stable security definer set search_path = public as $$
declare a kids_gelir_ayar; k kids_paketler; ay int; aylik bigint; donem_aylik bigint; liste bigint; kalan numeric; ind jsonb := '[]'::jsonb;
  y numeric; tutar bigint; net bigint; kdv bigint; tk int; ref text := upper(trim(coalesce(p->>'ref_kod', ''))); tarih date := coalesce((p->>'tarih')::date, (now() at time zone 'Europe/Istanbul')::date);
  erken boolean := coalesce((p->>'erken')::boolean, false); ek numeric := coalesce(nullif(p->>'ek_yuzde', '')::numeric, 0);
begin
  perform public.kids_fin_guard();
  select * into a from kids_gelir_ayar where id = 1;
  select * into k from kids_paketler where kod = p->>'paket' and aktif;
  if k.kod is null then raise exception 'Paket bulunamadı.'; end if;
  ay := case p->>'donem' when 'aylik' then 1 when '6ay' then 6 when 'yil' then 12 else null end;
  if ay is null then raise exception 'Dönem aylık, 6 aylık ya da yıllık olmalı.'; end if;
  /* liste: aylık planın fiyatı × ay; 6 aylık / yıllık planın kendi aylık fiyatı "dönem avantajı" olarak düşülür */
  if k.ozel then
    aylik := coalesce(nullif(p->>'ozel_aylik_kurus', '')::bigint, 0); donem_aylik := aylik;
  else
    aylik := k.aylik_kurus; donem_aylik := case ay when 6 then k.alti_ay_kurus when 12 then k.yil_kurus else k.aylik_kurus end;
  end if;
  if aylik <= 0 then raise exception 'Kampüs paketi için aylık tutarı yazın.'; end if;
  liste := aylik * ay; kalan := liste;
  if donem_aylik < aylik then
    tutar := (aylik - donem_aylik) * ay; kalan := kalan - tutar;
    ind := ind || jsonb_build_object('ad', case ay when 6 then '6 aylık plan (ayda ' else 'Yıllık plan (ayda ' end || replace(to_char(donem_aylik / 100, 'FM999,999,999'), ',', '.') || ' TL)', 'yuzde', round((aylik - donem_aylik) * 100.0 / aylik, 1), 'kurus', tutar);
  end if;
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
    'donem', p->>'donem', 'ay', ay, 'aylik_kurus', aylik, 'donem_aylik_kurus', donem_aylik, 'liste_kurus', liste, 'indirimler', ind, 'net_kurus', net, 'kdv', a.kdv, 'kdv_kurus', kdv, 'toplam_kurus', net + kdv,
    'aylik_esdeger_kurus', round(net::numeric / ay), 'taksit', tk, 'erken', erken, 'ref_kod', ref, 'ek_yuzde', ek);
end $$;

drop function if exists public.kids_paket_kaydet(text, text, integer, bigint, boolean);
create or replace function public.kids_paket_kaydet(p_kod text, p_ad text, p_kota integer, p_aylik_kurus bigint, p_alti_ay_kurus bigint, p_yil_kurus bigint, p_aktif boolean)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.kids_fin_guard();
  if not exists (select 1 from kids_paketler where kod = p_kod and ozel) and (p_alti_ay_kurus > p_aylik_kurus or p_yil_kurus > p_alti_ay_kurus) then
    raise exception 'Uzun dönemin aylık fiyatı kısa dönemden yüksek olamaz (aylık ≥ 6 aylık ≥ yıllık).';
  end if;
  update kids_paketler set ad = trim(p_ad), kota = p_kota,
    aylik_kurus = case when ozel then 0 else p_aylik_kurus end, alti_ay_kurus = case when ozel then 0 else p_alti_ay_kurus end, yil_kurus = case when ozel then 0 else p_yil_kurus end, aktif = p_aktif
  where kod = p_kod;
  if not found then raise exception 'Paket bulunamadı.'; end if;
  perform public.fin_log('kids_paket', p_kod, jsonb_build_object('kota', p_kota, 'aylik', p_aylik_kurus, '6ay', p_alti_ay_kurus, 'yil', p_yil_kurus, 'aktif', p_aktif));
end $$;

revoke all on function public.kids_teklif_hesap(jsonb) from public, anon;
grant execute on function public.kids_teklif_hesap(jsonb) to authenticated;
revoke all on function public.kids_paket_kaydet(text, text, integer, bigint, bigint, bigint, boolean) from public, anon;
grant execute on function public.kids_paket_kaydet(text, text, integer, bigint, bigint, bigint, boolean) to authenticated;

notify pgrst, 'reload schema';
