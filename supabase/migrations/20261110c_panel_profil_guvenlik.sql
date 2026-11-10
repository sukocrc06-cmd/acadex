-- ==========================================================================
-- ACADEX — SANDBOX ETKİLEŞİM PANELİ: PROFİL GÖRÜNÜMÜ + ANON KAPATMA
--
-- NEDEN VAR (10.11.2026, panel denetimi):
--
-- 1) PANEL KİMSEYİ TANIMIYORDU. js/acadex-ink.js -> SBX.loadPosts diğer
--    kullanıcıların adını/fotoğrafını profiles'tan çekiyor, ama profiles'ın
--    tek SELECT politikası (auth.uid() = id). Sorgu hata VERMİYOR, sessizce
--    boş dönüyor; PPL dolmuyor ve her gönderi sahibi ekranda "Bir öğrenci"
--    + "?" avatarıyla çıkıyor. Bugüne dek görülmedi çünkü tabloda tek
--    gönderi vardı ve o da bakan kişinin kendisiydi (PPL.me ayrı yoldan,
--    myProf() ile doluyor).
--
--    ÇÖZÜM BİLEREK GÖRÜNÜM, POLİTİKA DEĞİL: profiles email ve
--    student_number taşıyor. "authenticated herkes profiles'ı okusun"
--    politikası o kolonları da bütün öğrencilere açardı. public_profiles
--    yalnızca panelin kullandığı dokuz herkese açık kolonu gösterir.
--    security_invoker = off BİLEREK: görünüm sahibinin (postgres)
--    yetkisiyle çalışır, yani profiles RLS'ini bu dar kolon listesi için
--    atlar — Supabase lint'i bunu uyarır, burada tam da istenen davranış.
--    Askıya alınan hesap listelenmez.
--
-- 2) ANON PANELİN TAMAMINI OKUYABİLİYORDU. Üç politika adında
--    "authenticated" yazarken koşulu düpedüz true idi (comments, likes,
--    follows); sandbox_projects de (NOT hidden) ile anon'a açıktı. anon
--    anahtarı herkese açık olduğundan giriş yapmadan curl ile bütün
--    incelemeler, tepkiler ve takip grafiği çekilebiliyordu (isimler değil:
--    profiles zaten kilitli, satırlar UUID taşıyor). Panel girişin
--    arkasında; anon'un bu tablolarda hiçbir işi yok. Koşullar
--    auth.uid() is not null oldu ve anon'un tablo yetkileri geri alındı.
--
-- 3) LIKES'A UPDATE POLİTİKASI: tepki değiştirme istemcide sil + ekle
--    diye iki adımdı; ikinci adım düşerse eski tepki sunucudan da gitmiş
--    oluyordu. İstemci artık tek adımda upsert yapıyor
--    (onConflict: project_id,user_id — tekil kısıt 20260830c'de var);
--    upsert'ün çakışma dalı UPDATE olduğu için bu politika şart.
--
-- Teste bağlı: tests/sandbox-etkilesim.js
-- ==========================================================================

-- 1) Herkese açık profil görünümü ---------------------------------------
create or replace view public.public_profiles
with (security_invoker = off) as
  select id, full_name, department, avatar_url, banner_url, bio,
         github_url, linkedin_url, website_url
    from public.profiles
   where coalesce(is_suspended, false) = false;

comment on view public.public_profiles is
  'Panelde gösterilen herkese açık profil kolonları. security_invoker=off '
  'bilerek: profiles RLS''i yalnız bu dar kolon listesi için aşılır. '
  'email / student_number / is_admin BU GÖRÜNÜME ASLA EKLENMEZ.';

/* authenticated'DAN DA REVOKE ŞART (10.11.2026'da canlıda ölçüldü):
   Supabase'in varsayılan ayrıcalıkları görünüm OLUŞURKEN authenticated'a
   ALL veriyor ve grant'lar toplamalı — yalnız "grant select" yazmak ALL'u
   GERİ ALMAZ. Bu görünüm tek tablolu + basit WHERE olduğu için otomatik
   güncellenebilir; security_invoker=off ile içinden geçen yazma postgres
   yetkisiyle, profiles RLS'ini aşarak işlerdi. Yani revoke olmadan giriş
   yapmış herkes başkasının adını/bio'sunu değiştirebilirdi. */
revoke all on public.public_profiles from public, anon, authenticated;
grant select on public.public_profiles to authenticated;
grant select on public.public_profiles to service_role;

-- 2) "true" politikaları giriş şartına çekilir ---------------------------
drop policy if exists sandbox_project_comments_select_authenticated
  on public.sandbox_project_comments;
create policy sandbox_project_comments_select_authenticated
  on public.sandbox_project_comments for select
  using (auth.uid() is not null);

drop policy if exists sandbox_project_likes_select_authenticated
  on public.sandbox_project_likes;
create policy sandbox_project_likes_select_authenticated
  on public.sandbox_project_likes for select
  using (auth.uid() is not null);

drop policy if exists sandbox_follows_select on public.sandbox_follows;
create policy sandbox_follows_select
  on public.sandbox_follows for select
  using (auth.uid() is not null);

drop policy if exists "Anyone can view sandbox projects" on public.sandbox_projects;
create policy "Anyone can view sandbox projects"
  on public.sandbox_projects for select
  using (auth.uid() is not null
         and ((not hidden) or auth.uid() = user_id or current_is_admin()));

-- anon'un tablo yetkileri geri alınır (politika + yetki, iki kat)
revoke all on public.sandbox_projects         from anon;
revoke all on public.sandbox_project_comments from anon;
revoke all on public.sandbox_project_likes    from anon;
revoke all on public.sandbox_follows          from anon;
revoke all on public.sandbox_reports          from anon;
revoke all on public.sandbox_workspaces       from anon;

/* Tetikleyici fonksiyonu yalnız tetikleyici olarak çalışır; doğrudan
   çağrılamasa da anon/authenticated'daki EXECUTE yetkisinin işi yok
   (Supabase security advisor uyarısı, 10.11.2026). */
revoke execute on function public.bump_sandbox_project_likes_count()
  from public, anon, authenticated;

-- 3) Tepki upsert'ü için UPDATE politikası -------------------------------
drop policy if exists sandbox_project_likes_update_own
  on public.sandbox_project_likes;
create policy sandbox_project_likes_update_own
  on public.sandbox_project_likes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
