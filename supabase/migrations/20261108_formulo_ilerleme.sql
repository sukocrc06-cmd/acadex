-- Formulo · hesaba kayıt (08.11.2026)
-- Deste, hata defteri, soru havuzu skoru, seri ve "kaldığın yer" öğrencinin hesabında tutulur;
-- telefonla bilgisayar arasında taşınır. İstemci: formulo/assets/formulo-bulut.js
-- Satır başına bir öğrenci; veri = {veri:{deste,hata,skor,seri,son}, zaman:{anahtar: ms}, surum}.
-- Her öğrenci yalnız kendi satırını görür ve yazar (RLS). Hesap silinince satır da silinir.
-- Supabase SQL Editor'da elle çalıştırılır; tekrar çalıştırmak güvenlidir.

create table if not exists public.formulo_ilerleme (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  veri       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint formulo_ilerleme_boyut check (pg_column_size(veri) < 262144)   -- 256 KB üst sınır (hata defteri 60 kayıtla sınırlı)
);

alter table public.formulo_ilerleme enable row level security;

drop policy if exists formulo_ilerleme_oku on public.formulo_ilerleme;
create policy formulo_ilerleme_oku on public.formulo_ilerleme
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists formulo_ilerleme_ekle on public.formulo_ilerleme;
create policy formulo_ilerleme_ekle on public.formulo_ilerleme
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists formulo_ilerleme_guncelle on public.formulo_ilerleme;
create policy formulo_ilerleme_guncelle on public.formulo_ilerleme
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.formulo_ilerleme from anon;
grant select, insert, update on public.formulo_ilerleme to authenticated;
