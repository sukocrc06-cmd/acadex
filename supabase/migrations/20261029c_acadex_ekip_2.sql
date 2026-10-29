-- ==========================================================================
-- Acadex ekibi · 2. adım (29.10.2026) — "Organizasyon Şeması ve Görev Tanımları"
-- belgesindeki yapıyı panelde tutabilmek için ek alanlar. YALNIZ YAPI: bu dosyada
-- kişi/ekip verisi yoktur (belge gizli; veri SQL Editor'de ayrıca girilir).
--
-- ax_people
--   authority   yetkiler (serbest metin)
--   kpis        başarı göstergeleri (serbest metin)
--   reports_to  bağlı olduğu kişi/rol (serbest metin; ör. "Test Ekip Koordinatörü")
--   status      + yeni (yeni katıldı), aday (görüşme aşamasında), acik (açık pozisyon)
--               açık pozisyonda full_name pozisyonun adıdır; panel "açık pozisyon" yazar.
-- ax_teams
--   purpose     birimin amacı
--   duties      ortak / planlanan görevler (her satır bir madde)
--   rules       karar usulü, çalışma kuralı
--   outputs     çıktılar
--   coordinator lider / koordinasyon (serbest metin)
--   state       kuruldu | kuruluyor | acik (kurulacak) | dis (dış destek)
--   priority    yuksek | orta | dusuk (boş olabilir)
--   is_advisory danışma kutusu (şemada ayrı sırada durur)
-- Güvenlik: mevcut politikalar geçerli (yalnız admin_ok okur/yazar).
-- Tekrar çalıştırmak zarar vermez. 20261024e_acadex_ekip.sql'den SONRA çalıştır.
-- ==========================================================================

alter table public.ax_people add column if not exists authority  text not null default '';
alter table public.ax_people add column if not exists kpis       text not null default '';
alter table public.ax_people add column if not exists reports_to text not null default '';
alter table public.ax_people drop constraint if exists ax_people_status_check;
alter table public.ax_people add constraint ax_people_status_check
  check (status in ('aktif', 'yeni', 'yari', 'aday', 'acik', 'ayrildi'));

alter table public.ax_teams add column if not exists purpose     text not null default '';
alter table public.ax_teams add column if not exists duties      text not null default '';
alter table public.ax_teams add column if not exists rules       text not null default '';
alter table public.ax_teams add column if not exists outputs     text not null default '';
alter table public.ax_teams add column if not exists coordinator text not null default '';
alter table public.ax_teams add column if not exists state       text not null default 'kuruldu';
alter table public.ax_teams add column if not exists priority    text;
alter table public.ax_teams add column if not exists is_advisory boolean not null default false;
alter table public.ax_teams drop constraint if exists ax_teams_state_check;
alter table public.ax_teams add constraint ax_teams_state_check check (state in ('kuruldu', 'kuruluyor', 'acik', 'dis'));
alter table public.ax_teams drop constraint if exists ax_teams_priority_check;
alter table public.ax_teams add constraint ax_teams_priority_check check (priority is null or priority in ('yuksek', 'orta', 'dusuk'));

-- uzun metinler için makul sınırlar
alter table public.ax_teams drop constraint if exists ax_teams_len_check;
alter table public.ax_teams add constraint ax_teams_len_check check (
  char_length(purpose) <= 1500 and char_length(duties) <= 4000 and char_length(rules) <= 2000
  and char_length(outputs) <= 1000 and char_length(coordinator) <= 200 and char_length(description) <= 1500);
alter table public.ax_people drop constraint if exists ax_people_len_check;
alter table public.ax_people add constraint ax_people_len_check check (
  char_length(job_description) <= 2000 and char_length(responsibilities) <= 4000 and char_length(authority) <= 2000
  and char_length(kpis) <= 1500 and char_length(reports_to) <= 200 and char_length(title) <= 160);
