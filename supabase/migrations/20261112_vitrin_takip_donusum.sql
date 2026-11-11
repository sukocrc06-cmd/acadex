-- ==========================================================================
-- ACADEX — PANEL VİTRİNİ + MİSAFİR DÖNÜŞÜMÜ + MİSAFİR TEMİZLİĞİ (12.11.2026)
--
-- Üç özellik tek migration'da (aynı günün öneri paketi, Berkay: "hepsini
-- yapalım"):
--  1) HAFTANIN PROJESİ: sandbox_projects.vitrin + admin_sandbox_vitrin RPC.
--     Tek proje vitrinde olur; panel onu rozetle en üste alır. Yetki
--     veritabanında (current_is_admin), istemcideki yıldız yalnız kısayoldur.
--  2) MİSAFİR → GERÇEK HESAP: misafir_tamamla RPC. Anonim oturum e-posta +
--     şifreyle kalıcılaşınca (auth.updateUser) çağrılır; ders konuğu olanlara
--     otomatik davet + erişim açar. İlerleme zaten taşınır — uid değişmez.
--     protect_profile_flags access_allowed'ı yöneticiye saklıyordu; bu RPC
--     işlem-yerel 'acadex.gorevli' bayrağıyla geçer (bayrağı yalnız bizim
--     definer fonksiyonlarımız kurabilir; istemciden set_config çağrılamaz).
--  3) ESKİ MİSAFİR TEMİZLİĞİ: admin_misafir_temizle RPC. p_gun günden eski,
--     o süredir derse de girmemiş anonim hesapları siler (önce p_dene=true
--     ile sayım). Misafir yazamadığı için başka tabloda izi yoktur;
--     ders_konuklari auth.users silinince cascade ile düşer.
--
-- Teste bağlı: tests/sandbox-etkilesim.js (vitrin), tests/ders-kodu-misafir.js
-- (dönüşüm + temizlik).
-- ==========================================================================

-- 1) HAFTANIN PROJESİ -------------------------------------------------------
alter table public.sandbox_projects
  add column if not exists vitrin boolean not null default false;

create or replace function public.admin_sandbox_vitrin(p_id uuid, p_on boolean)
returns boolean language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.current_is_admin() then
    raise exception 'yetki yok' using errcode = '42501';
  end if;
  -- Vitrin teklidir: yenisi girince eskisi kendiliğinden iner.
  if p_on then
    update sandbox_projects set vitrin = false where vitrin and id <> p_id;
  end if;
  update sandbox_projects set vitrin = p_on where id = p_id;
  return found;
end $$;
revoke all on function public.admin_sandbox_vitrin(uuid, boolean) from public;
grant execute on function public.admin_sandbox_vitrin(uuid, boolean) to authenticated;

-- 2) MİSAFİR → GERÇEK HESAP -------------------------------------------------
-- protect_profile_flags (20261029d ile aynı gövde) + işlem-yerel görevli
-- bayrağı: misafir_tamamla gibi definer fonksiyonlarımız korumalı alanları
-- kendi işlemi içinde güncelleyebilsin. İstemci set_config çalıştıramaz;
-- bayrak yalnız SQL'den, yalnız bu işlem süresince kurulabilir.
create or replace function public.protect_profile_flags()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if coalesce(auth.role(), '') <> 'authenticated' or public.current_is_admin()
     or coalesce(current_setting('acadex.gorevli', true), '') = '1' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.is_admin := false; new.is_suspended := false;
    return new;
  end if;
  if new.id is distinct from old.id
     or new.is_admin is distinct from old.is_admin
     or new.is_suspended is distinct from old.is_suspended
     or new.access_allowed is distinct from old.access_allowed then
    raise exception 'Bu alanlar yalnızca yönetici tarafından değiştirilebilir' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.misafir_tamamla()
returns boolean language plpgsql security definer set search_path to 'public' as $$
declare v_email text; v_anon boolean;
begin
  select lower(u.email), coalesce(u.is_anonymous, false) into v_email, v_anon
    from auth.users u where u.id = auth.uid();
  -- Yalnız dönüşümü BİTMİŞ hesap: e-postası bağlanmış, artık anonim değil.
  if auth.uid() is null or v_anon or coalesce(v_email, '') = '' then return false; end if;
  -- Yalnız ders konukları otomatik izin alır (kapalı beta kuralı: kod
  -- üzerinden gelen öğrenci davetli sayılır; dışarıdan hesap bu kapıdan giremez).
  if not exists (select 1 from ders_konuklari where user_id = auth.uid()) then return false; end if;
  insert into access_invites (email, note)
  values (v_email, 'Misafir dönüşümü (ders kodu, ' || to_char(now(), 'DD.MM.YYYY') || ')')
  on conflict do nothing;
  perform set_config('acadex.gorevli', '1', true);
  -- onboarding_completed=false: sihirbaz açılır — bölüm/numara ve asıl
  -- önemlisi KVKK onayı gerçek hesapta alınmak zorunda.
  update profiles
     set email = coalesce(nullif(email, ''), v_email),
         access_allowed = true,
         onboarding_completed = false
   where id = auth.uid();
  return true;
end $$;
revoke all on function public.misafir_tamamla() from public;
grant execute on function public.misafir_tamamla() to authenticated;

-- 3) ESKİ MİSAFİR TEMİZLİĞİ --------------------------------------------------
create or replace function public.admin_misafir_temizle(p_gun integer default 30, p_dene boolean default true)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_ids uuid[]; v_n integer;
begin
  if not public.current_is_admin() then
    raise exception 'yetki yok' using errcode = '42501';
  end if;
  if p_gun < 7 then
    raise exception 'en az 7 gün: ders arası tatilde ilerleme silinmesin';
  end if;
  select coalesce(array_agg(u.id), '{}') into v_ids
    from auth.users u
   where coalesce(u.is_anonymous, false)
     and u.created_at < now() - make_interval(days => p_gun)
     and not exists (select 1 from ders_konuklari k
                      where k.user_id = u.id
                        and k.son_giris > now() - make_interval(days => p_gun));
  v_n := coalesce(array_length(v_ids, 1), 0);
  if p_dene or v_n = 0 then return v_n; end if;
  delete from public.profiles where id = any(v_ids);
  delete from auth.users where id = any(v_ids);  -- ders_konuklari cascade ile düşer
  return v_n;
end $$;
revoke all on function public.admin_misafir_temizle(integer, boolean) from public;
grant execute on function public.admin_misafir_temizle(integer, boolean) to authenticated;
