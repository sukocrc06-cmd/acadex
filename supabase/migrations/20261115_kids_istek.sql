-- Acadex Kids: "Kreşim için teklif al" istekleri (kids tanıtım sayfası → yönetim paneli › Kids › İstekler).
-- 20261114_kids_kres.sql'deki kids_basvurular tablosunu kullanır:
--   * e-posta artık zorunlu, telefon isteğe bağlı
--   * yeni durum 'arandi' (görüşüldü) ve yalnız yöneticinin gördüğü iç not
--   * kids_basvuru_durum: durum + not; kids_basvuru_reddet 'arandi' istekleri de reddedebilir

alter table public.kids_basvurular drop constraint if exists kids_basvurular_tel_check;
alter table public.kids_basvurular add constraint kids_basvurular_tel_check check (tel = '' or tel ~ '^[0-9 +()-]{10,20}$');
alter table public.kids_basvurular drop constraint if exists kids_basvurular_durum_check;
alter table public.kids_basvurular add constraint kids_basvurular_durum_check check (durum in ('bekliyor', 'arandi', 'onaylandi', 'reddedildi'));
alter table public.kids_basvurular add column if not exists ic_not text not null default '';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kids_basvurular_ic_not_check') then
    alter table public.kids_basvurular add constraint kids_basvurular_ic_not_check check (length(ic_not) <= 1000);
  end if;
  -- yeni istekler için e-posta zorunlu (eski kayıtlar etkilenmez)
  if not exists (select 1 from pg_constraint where conname = 'kids_basvurular_eposta_zorunlu') then
    alter table public.kids_basvurular add constraint kids_basvurular_eposta_zorunlu check (eposta <> '') not valid;
  end if;
end $$;

-- p: {kres_ad, yetkili_ad, eposta, tel?, il?, ilce?, ogrenci_sayi?, mesaj?, kvkk:true}
-- Sınır aşımında ve hatalı alanda HATA FIRLATMAZ, {tamam:false, mesaj} döner.
create or replace function public.kids_basvuru_yap(p jsonb)
returns json language plpgsql volatile security definer set search_path = public as $$
declare v_ip text := public.kids_istemci_ip(); v_tel text := regexp_replace(trim(coalesce(p->>'tel', '')), '\s+', ' ', 'g');
  v_ep text := lower(trim(coalesce(p->>'eposta', '')));
begin
  if coalesce(p->>'kvkk', '') <> 'true' then return json_build_object('tamam', false, 'mesaj', 'Aydınlatma metnini onaylamanız gerekiyor.'); end if;
  if length(trim(coalesce(p->>'kres_ad', ''))) < 2 then return json_build_object('tamam', false, 'alan', 'kres_ad', 'mesaj', 'Kreşinizin adını yazın.'); end if;
  if length(trim(coalesce(p->>'yetkili_ad', ''))) < 2 then return json_build_object('tamam', false, 'alan', 'yetkili_ad', 'mesaj', 'Yetkili kişinin adını yazın.'); end if;
  if v_ep !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_ep) > 120 then return json_build_object('tamam', false, 'alan', 'eposta', 'mesaj', 'Geçerli bir e-posta adresi yazın.'); end if;
  if v_tel <> '' and v_tel !~ '^[0-9 +()-]{10,20}$' then return json_build_object('tamam', false, 'alan', 'tel', 'mesaj', 'Telefonu 0 5xx xxx xx xx biçiminde yazın ya da boş bırakın.'); end if;
  if (select count(*) from kids_basvurular where ip = v_ip and created_at > now() - interval '1 day') >= 3 then
    return json_build_object('tamam', false, 'mesaj', 'Bugün bu bağlantıdan yeterince istek gönderildi. Yarın yeniden deneyin ya da destek@acadex.com.tr adresine yazın.');
  end if;
  if (select count(*) from kids_basvurular where created_at > now() - interval '1 day') >= 300 then
    return json_build_object('tamam', false, 'mesaj', 'Şu an çok yoğunuz. Lütfen biraz sonra yeniden deneyin.');
  end if;
  insert into kids_basvurular (kres_ad, il, ilce, yetkili_ad, tel, eposta, ogrenci_sayi, mesaj, ip)
  values (left(trim(p->>'kres_ad'), 120), left(trim(coalesce(p->>'il', '')), 40), left(trim(coalesce(p->>'ilce', '')), 60), left(trim(p->>'yetkili_ad'), 80),
    v_tel, v_ep, least(greatest(coalesce(nullif(trim(coalesce(p->>'ogrenci_sayi', '')), '')::int, 0), 0), 2000),
    left(trim(coalesce(p->>'mesaj', '')), 500), v_ip);
  return json_build_object('tamam', true);
exception
  when check_violation or not_null_violation then return json_build_object('tamam', false, 'mesaj', 'Lütfen kreş adını, yetkili adını ve e-postayı doğru yazın.');
  when invalid_text_representation then return json_build_object('tamam', false, 'alan', 'ogrenci_sayi', 'mesaj', 'Öğrenci sayısı rakam olmalı.');
end $$;

create or replace function public.kids_basvuru_liste()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_guard();
  return coalesce((select json_agg(json_build_object('id', b.id, 'kres_ad', b.kres_ad, 'il', b.il, 'ilce', b.ilce, 'yetkili_ad', b.yetkili_ad, 'tel', b.tel,
      'eposta', b.eposta, 'ogrenci_sayi', b.ogrenci_sayi, 'mesaj', b.mesaj, 'durum', b.durum, 'ic_not', b.ic_not, 'okul_id', b.okul_id, 'okul_kod', o.kod,
      'created_at', b.created_at, 'karar_at', b.karar_at)
      order by case b.durum when 'bekliyor' then 0 when 'arandi' then 1 else 2 end, b.created_at desc)
    from (select * from kids_basvurular order by created_at desc limit 500) b left join kids_okullar o on o.id = b.okul_id), '[]'::json);
end $$;

-- durum (bekliyor | arandi | reddedildi) ve iç not; 'onaylandi' yalnız kids_basvuru_onayla ile olur
create or replace function public.kids_basvuru_durum(p_id uuid, p_durum text, p_not text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare b kids_basvurular;
begin
  perform public.admin_guard();
  select * into b from kids_basvurular where id = p_id for update;
  if b.id is null then raise exception 'İstek bulunamadı.'; end if;
  if p_durum is not null and p_durum not in ('bekliyor', 'arandi', 'reddedildi') then raise exception 'Durum geçersiz.'; end if;
  if p_durum is not null and b.durum = 'onaylandi' then raise exception 'Okulu açılmış isteğin durumu değişmez.'; end if;
  update kids_basvurular set durum = coalesce(p_durum, durum), ic_not = case when p_not is null then ic_not else left(trim(p_not), 1000) end,
    karar_at = case when p_durum is not null and p_durum <> b.durum then now() else karar_at end
  where id = p_id;
  perform public.admin_log('kids_basvuru_durum', null, b.kres_ad, jsonb_build_object('durum', coalesce(p_durum, b.durum), 'not', p_not is not null));
end $$;

create or replace function public.kids_basvuru_reddet(p_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.admin_guard();
  update kids_basvurular set durum = 'reddedildi', karar_at = now() where id = p_id and durum in ('bekliyor', 'arandi');
  if not found then raise exception 'Bekleyen istek bulunamadı.'; end if;
  perform public.admin_log('kids_basvuru_reddet', null, null, jsonb_build_object('id', p_id));
end $$;

revoke all on function public.kids_basvuru_yap(jsonb) from public;
grant execute on function public.kids_basvuru_yap(jsonb) to anon, authenticated;
do $$ declare f text; begin
  foreach f in array array['kids_basvuru_liste()', 'kids_basvuru_durum(uuid, text, text)', 'kids_basvuru_reddet(uuid)'] loop
    execute 'revoke all on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;

notify pgrst, 'reload schema';
