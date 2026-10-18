-- ==========================================================================
-- Acadex: yeni yönetim paneli (admin.html) + Google girişi + hoca sistemi kaldırıldı
-- 19.10.2026'da Supabase'e doğrudan uygulandı (Claude, şükrü'nün onayıyla).
-- Bu dosya kayıt içindir; tekrar çalıştırmak zarar vermez (if not exists / or replace).
--
-- Fonksiyonlar (hepsi SECURITY DEFINER, search_path=public; her biri
-- admin_guard() ile "yönetici + iki adımlı doğrulama (aal2)" kontrolü yapar
-- ve değişiklikleri admin_audit_log'a yazar):
--   okuma : admin_whoami, admin_overview, admin_users, admin_user_detail,
--           admin_reports, admin_content, admin_messages, admin_announcements,
--           admin_audit, admin_settings
--   yazma : admin_set_suspended, admin_note_password_reset, admin_resolve_report,
--           admin_set_hidden, admin_message_read, admin_set_setting,
--           admin_announce_save, admin_announce_archive
--   yardım: admin_ok, admin_guard, admin_log
-- Tam tanımlar: Supabase → Database → Functions (ya da pg_get_functiondef).
-- ==========================================================================

-- Google ile ilk giriş: bölüm başta boş ('' = henüz seçilmedi)
alter table public.profiles drop constraint if exists profiles_department_check;
alter table public.profiles add constraint profiles_department_check check (department = any (array[''::text, 'Management Information Systems', 'Business Administration', 'International Trade and Business', 'Banking and Finance']));

-- Yetki alanlarını yalnız yönetici ve sunucu değiştirebilir (protect_profile_flags tetikleyicisi)
-- create trigger protect_profile_flags before insert or update on public.profiles for each row execute function public.protect_profile_flags();

-- Şikâyet durumları ve içerik gizleme
alter table public.sandbox_reports add column if not exists status text not null default 'open';
alter table public.sandbox_reports add column if not exists resolved_at timestamptz;
alter table public.sandbox_reports add column if not exists resolved_by uuid;
alter table public.sandbox_reports add column if not exists resolution text;
alter table public.study_card_reports add column if not exists status text not null default 'open';
alter table public.study_card_reports add column if not exists resolved_at timestamptz;
alter table public.study_card_reports add column if not exists resolved_by uuid;
alter table public.study_card_reports add column if not exists resolution text;
alter table public.sandbox_projects add column if not exists hidden boolean not null default false;
alter table public.announcements add column if not exists archived boolean not null default false;

-- Politikalar
alter policy "Anyone can view sandbox projects" on public.sandbox_projects using ((not hidden) or auth.uid() = user_id or public.current_is_admin());
alter policy site_settings_admin_write on public.site_settings using (public.admin_ok()) with check (public.admin_ok());
alter policy announcements_admin_all on public.announcements using (public.admin_ok()) with check (public.admin_ok());
alter policy profiles_admin_update_all on public.profiles using (public.admin_ok()) with check (public.admin_ok());
alter policy admin_audit_log_admin_insert on public.admin_audit_log with check (public.admin_ok() and actor_id = auth.uid());
-- hoca sistemi kaldırıldı
alter policy announcements_teacher_manage_own_dept on public.announcements using (false) with check (false);
alter policy profiles_teacher_select_dept_students on public.profiles using (false);
