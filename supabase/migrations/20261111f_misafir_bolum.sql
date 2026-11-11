-- ==========================================================================
-- ACADEX — MİSAFİR GİRİŞİNDE BÖLÜM (11.11.2026)
-- Giriş formu rumuzun yanında bölüm de sorar (isteğe bağlı); hoca konuk
-- listesinde görür, panel başlıkları da bölümü gösterebilir
-- (profiles.department'a da yazılır). misafir_kaydet'in imzası değiştiği
-- için eski 2 parametreli sürüm DÜŞÜRÜLÜR — iki aşırı yükleme kalırsa
-- PostgREST rpc çağrısı belirsizlik hatası verir.
-- Teste bağlı: tests/ders-kodu-misafir.js
-- ==========================================================================
alter table public.ders_konuklari add column if not exists bolum text not null default '';

drop function if exists public.misafir_kaydet(text, text);
create or replace function public.misafir_kaydet(p_kod text, p_rumuz text default '', p_bolum text default '')
returns boolean language plpgsql security definer set search_path to 'public' as $$
declare v_kod ders_kodlari%rowtype; v_anon boolean; v_ad text; v_bolum text;
begin
  select coalesce(is_anonymous, false) into v_anon from auth.users where id = auth.uid();
  if auth.uid() is null or not v_anon then return false; end if;
  select * into v_kod from ders_kodlari
   where kod = upper(trim(coalesce(p_kod, ''))) and aktif
     and (son_tarih is null or son_tarih >= current_date);
  if not found then return false; end if;
  v_ad := left(trim(coalesce(p_rumuz, '')), 40);
  v_bolum := left(trim(coalesce(p_bolum, '')), 60);
  insert into ders_konuklari (user_id, kod_id, rumuz, bolum)
  values (auth.uid(), v_kod.id, v_ad, v_bolum)
  on conflict (user_id) do update
    set giris_sayi = ders_konuklari.giris_sayi + 1, son_giris = now(),
        rumuz = case when excluded.rumuz <> '' then excluded.rumuz else ders_konuklari.rumuz end,
        bolum = case when excluded.bolum <> '' then excluded.bolum else ders_konuklari.bolum end;
  if v_ad <> '' then update profiles set full_name = v_ad where id = auth.uid(); end if;
  if v_bolum <> '' then update profiles set department = v_bolum where id = auth.uid(); end if;
  return true;
end $$;
revoke all on function public.misafir_kaydet(text, text, text) from public, anon;
grant execute on function public.misafir_kaydet(text, text, text) to authenticated;

-- Konuk özetine bölüm de girer.
create or replace function public.admin_ders_konuk_ozet(p_kod_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.current_is_admin() then raise exception 'yetki yok' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'rumuz', g.rumuz, 'bolum', g.bolum, 'giris_sayi', g.giris_sayi,
      'son_giris', g.son_giris, 'ilerleme', g.ilerleme) order by g.son_giris desc)
    from ders_konuklari g where g.kod_id = p_kod_id), '[]'::jsonb);
end $$;
