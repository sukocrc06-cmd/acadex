-- ==========================================================================
-- ACADEX — MİSAFİRİN RUMUZU GÖRÜNEN AD OLUR (11.11.2026)
-- Girişte yazılan ad yalnız ders_konuklari'na gidiyordu; panel "Merhaba
-- Misafir" diyordu. misafir_kaydet artık profiles.full_name'i de rumuzla
-- günceller (boşsa 'Misafir' kalır). SECURITY DEFINER olduğu için genel
-- yazma kilidine (zz_misafir_*) takılmaz — bilinçli tek istisna yoludur.
-- Teste bağlı: tests/ders-kodu-misafir.js
-- ==========================================================================
create or replace function public.misafir_kaydet(p_kod text, p_rumuz text default '')
returns boolean language plpgsql security definer set search_path to 'public' as $$
declare v_kod ders_kodlari%rowtype; v_anon boolean; v_ad text;
begin
  select coalesce(is_anonymous, false) into v_anon from auth.users where id = auth.uid();
  if auth.uid() is null or not v_anon then return false; end if;
  select * into v_kod from ders_kodlari
   where kod = upper(trim(coalesce(p_kod, ''))) and aktif
     and (son_tarih is null or son_tarih >= current_date);
  if not found then return false; end if;
  v_ad := left(trim(coalesce(p_rumuz, '')), 40);
  insert into ders_konuklari (user_id, kod_id, rumuz)
  values (auth.uid(), v_kod.id, v_ad)
  on conflict (user_id) do update
    set giris_sayi = ders_konuklari.giris_sayi + 1, son_giris = now(),
        rumuz = case when excluded.rumuz <> '' then excluded.rumuz else ders_konuklari.rumuz end;
  if v_ad <> '' then
    update profiles set full_name = v_ad where id = auth.uid();
  end if;
  return true;
end $$;
