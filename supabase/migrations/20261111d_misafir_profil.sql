-- ==========================================================================
-- ACADEX — MİSAFİR PROFİLİ: sihirbaz çıkmaz, adı "Misafir" doğar
--
-- NEDEN VAR (11.11.2026, canlı deneme): ders koduyla giren misafirin profili
-- onboarding_completed=false doğuyordu — dashboard profil tanımlama
-- sihirbazını açıyordu; misafirin dolduracağı bir profili YOKTUR.
-- profiles_access_default (kapalı beta, 20261024) anonim dal kazanır:
--   * onboarding_completed := true  → sihirbaz hiç açılmaz
--   * access_allowed := false       → beta izinlerine dokunmaz; kapıdaki
--     istisna istemcidedir (js/acadex-erisim.js, is_anonymous)
--   * full_name boşsa 'Misafir'     → panellerde boş ad görünmez
-- Teste bağlı: tests/ders-kodu-misafir.js
-- ==========================================================================

create or replace function public.profiles_access_default()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if (select coalesce(u.is_anonymous, false) from auth.users u where u.id = new.id) then
    new.onboarding_completed := true;
    new.access_allowed := false;
    new.full_name := coalesce(nullif(trim(new.full_name), ''), 'Misafir');
    return new;
  end if;
  new.access_allowed := (not public.registration_frozen())
    or exists (select 1 from access_invites where email = lower(coalesce(new.email, '')));
  return new;
end $$;

-- Daha önce açılmış misafir profilleri de düzeltilir (deneme hesapları).
update public.profiles p
   set onboarding_completed = true,
       full_name = coalesce(nullif(trim(p.full_name), ''), 'Misafir')
  from auth.users u
 where u.id = p.id and coalesce(u.is_anonymous, false)
   and (p.onboarding_completed is distinct from true or nullif(trim(p.full_name), '') is null);
