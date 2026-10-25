-- ==========================================================================
-- Acadex ekibi (yönetim paneli → "Acadex ekibi") · 24.10.2026
--   ax_teams  : ekipler (Yönetim, Test, Yazılım, UI/UX, Grafik, Video, Sosyal medya)
--   ax_people : kişiler, iş tanımı, sorumluluklar, iletişim, durum
-- Yalnızca yönetici (admin_ok: yönetici + iki adımlı doğrulama) okur ve yazar.
-- Supabase → SQL Editor'de bir kez çalıştır; tekrar çalıştırmak zarar vermez.
-- ==========================================================================

create table if not exists public.ax_teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (char_length(name) between 2 and 60),
  color       text not null default '#2F6BFF' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  description text not null default '',
  is_board    boolean not null default false,   -- şemada en üstte duran ekip (Yönetim)
  sort        int not null default 100,
  created_at  timestamptz not null default now()
);

create table if not exists public.ax_people (
  id               uuid primary key default gen_random_uuid(),
  full_name        text not null check (char_length(full_name) between 2 and 80),
  title            text not null default '',          -- rol / unvan
  team_id          uuid references public.ax_teams(id) on delete set null,
  is_lead          boolean not null default false,    -- ekip lideri
  job_description  text not null default '',
  responsibilities text not null default '',          -- her satır bir madde
  email            text not null default '',
  phone            text not null default '',
  start_date       date,
  status           text not null default 'aktif' check (status in ('aktif', 'yari', 'ayrildi')),
  sort             int not null default 100,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists ax_people_team_idx on public.ax_people (team_id, sort);

alter table public.ax_teams enable row level security;
alter table public.ax_people enable row level security;
drop policy if exists ax_teams_admin on public.ax_teams;
create policy ax_teams_admin on public.ax_teams for all to authenticated using (public.admin_ok()) with check (public.admin_ok());
drop policy if exists ax_people_admin on public.ax_people;
create policy ax_people_admin on public.ax_people for all to authenticated using (public.admin_ok()) with check (public.admin_ok());

create or replace function public.ax_people_touch()
returns trigger language plpgsql as $$
begin new.updated_at := now(); new.email := lower(trim(new.email)); return new; end $$;
drop trigger if exists ax_people_touch on public.ax_people;
create trigger ax_people_touch before insert or update on public.ax_people
  for each row execute function public.ax_people_touch();

-- ---------- hazır ekipler ----------
insert into public.ax_teams (name, color, description, is_board, sort) values
  ('Yönetim', '#1A2A5C', 'Ürün vizyonu, yol haritası, öncelikler ve ortaklık kararları.', true, 10),
  ('Test ekibi', '#E06AA0', 'Uygulamayı telefon, tablet ve bilgisayarda test eder; hata, tasarım eksiği ve önerileri Test Paneli''ne kaydeder, düzeltmeleri doğrular.', false, 20),
  ('Yazılım ekibi', '#2F6BFF', 'Uygulama, Supabase altyapısı, yapay zekâ özet ve sınav akışları; hataları düzeltir, yeni özellikleri geliştirir.', false, 30),
  ('UI/UX tasarım', '#8A5CF6', 'Ekranlar, kullanıcı akışları ve Acadex tasarım dili; test bulgularının tasarım tarafını çözer.', false, 40),
  ('Grafik ve marka', '#F08A24', 'Logo, görsel kimlik, sosyal medya görselleri ve sunum şablonları.', false, 50),
  ('Video ve içerik üretimi', '#C2417A', 'Tanıtım videoları, eğitim içerikleri ve kısa videolar.', false, 60),
  ('Sosyal medya ve topluluk', '#12A3A3', 'Instagram, TikTok ve LinkedIn yönetimi; öğrenci topluluğu ve kampüs elçileri.', false, 70)
on conflict (name) do nothing;

-- ---------- hazır kişiler (aynı adla kayıt varsa eklenmez) ----------
insert into public.ax_people (full_name, title, team_id, is_lead, job_description, responsibilities, email, status, sort)
select v.full_name, v.title, (select id from public.ax_teams where name = v.team), v.is_lead, v.job, v.resp, v.email, 'aktif', v.sort
from (values
  ('Şükrü', 'Kurucu & Product Owner', 'Yönetim', true,
   'Acadex''in ürün sahibi. Ürün vizyonunu ve yol haritasını belirler, öncelikleri sıralar, ekipleri koordine eder ve yayınlanacak işleri onaylar.',
   E'Ürün yol haritası ve öncelikler\nTest bulgularının önceliklendirilmesi\nEkiplerin koordinasyonu\nYayın (deploy) onayı', 'suko.crc06@gmail.com', 10),
  ('Serhat', 'Proje Ortağı', 'Yönetim', false,
   'Acadex''in proje ortağı. Ürün kararlarına ortak olur, uygulamayı test eder ve büyüme, iş birlikleri ve paketler tarafında katkı verir.',
   E'Ortak ürün kararları\nTest raporlarının hazırlanması\nPaketler ve iş birlikleri', '', 20),
  ('Şevval Aksakal', 'Test Birimi Koordinatörü', 'Test ekibi', true,
   'Test ekibini koordine eder; test planını ve rapor düzenini oluşturur, bulguları önceliklendirip Test Paneli''nde takip eder.',
   E'Test planı ve görev dağılımı\nRaporların derlenmesi\nDüzeltmelerin doğrulanması', '', 10),
  ('Asude', 'Test Uzmanı', 'Test ekibi', false,
   'Uygulamanın bölümlerini ayrıntılı test eder; hata, tasarım eksiği ve önerileri ekran görüntüleriyle Test Paneli''ne kaydeder.',
   E'Bölüm testleri\nEkran görüntülü kayıt\nDüzeltilen kayıtları doğrulama', '', 20),
  ('Cemre', 'Test Uzmanı', 'Test ekibi', false,
   'Uygulamanın bölümlerini ayrıntılı test eder; hata, tasarım eksiği ve önerileri ekran görüntüleriyle Test Paneli''ne kaydeder.',
   E'Bölüm testleri\nEkran görüntülü kayıt\nDüzeltilen kayıtları doğrulama', '', 30)
) as v(full_name, title, team, is_lead, job, resp, email, sort)
where not exists (select 1 from public.ax_people p where p.full_name = v.full_name);
