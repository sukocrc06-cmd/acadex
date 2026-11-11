-- ==========================================================================
-- ACADEX — MİSAFİR DÖNÜŞÜMÜ SUNUCUDA BİTER (12.11.2026, tarama bulgusu)
--
-- NEDEN VAR: Supabase anonim kullanıcıya şifreyi ancak e-posta doğrulandıktan
-- sonra ekletir. E-posta onayı açıksa kullanıcı onay bağlantısını çoğu zaman
-- başka sekmede/telefonda tıklar; o anda hesap artık anonim değildir ama
-- access_allowed=false'tur → kapalı beta kapısı (js/acadex-erisim.js) onu
-- "erisim=yok" ile dışarı atar ve istemcideki misafir_tamamla hiç çağrılmaz.
-- Bu tetikleyici dönüşümü auth.users güncellemesine bağlar: anonimlik
-- düştüğü anda, ders konuğuysa, davet + erişim + sihirbaz bayrağı açılır.
-- misafir_tamamla (20261112) yerinde kalır; ikisi aynı sonucu yazar (eş güçlü).
--
-- Not: GoTrue bağlantısında JWT yoktur → protect_profile_flags'te
-- auth.role() boş döner ve güncelleme geçer; görevli bayrağına gerek yok.
-- Teste bağlı: tests/ders-kodu-misafir.js
-- ==========================================================================

create or replace function public.misafir_donusum_tg()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(old.is_anonymous, false) and not coalesce(new.is_anonymous, false)
     and coalesce(new.email, '') <> ''
     and exists (select 1 from ders_konuklari where user_id = new.id) then
    insert into access_invites (email, note)
    values (lower(new.email), 'Misafir dönüşümü (ders kodu, ' || to_char(now(), 'DD.MM.YYYY') || ')')
    on conflict do nothing;
    update profiles
       set email = coalesce(nullif(email, ''), lower(new.email)),
           access_allowed = true,
           onboarding_completed = false
     where id = new.id;
  end if;
  return new;
end $$;
revoke all on function public.misafir_donusum_tg() from public, anon, authenticated;

drop trigger if exists misafir_donusum on auth.users;
create trigger misafir_donusum
  after update of is_anonymous, email on auth.users
  for each row execute function public.misafir_donusum_tg();
