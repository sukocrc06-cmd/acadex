-- ==========================================================================
-- Acadex: Sınav Platformu — Faz 4c: dosyadaki grafik sorularına göre sınav
--
-- This migration is NOT applied automatically -- run it yourself via:
--   1. Supabase Studio -> SQL Editor -> paste and run, or
--   2. `supabase db push` if you use the Supabase CLI with this repo linked.
--
-- İki kez çalıştırmak güvenli.
--
-- Ne yapıyor:
--   public.document_chart_scans — bir belgenin grafik taraması (bir kez,
--     sınav kurulurken; extract-chart-items edge function sayfa sayfa
--     ilerletir). pages: taranacak sayfalar (1'den başlayan), image_urls:
--     PDF.co'nun ürettiği sayfa görüntüleri (geçici, ~1 saat), next_index:
--     sıradaki sayfanın pages içindeki yeri.
--   public.document_chart_items — taramada bulunan her grafik: YAPISI
--     (tür, kategoriler, seriler, birim, eksen başlıkları) ve yanındaki
--     örnek sorunun BİÇİMİ (hangisi söylenebilir, öncüllü, D/Y, değer,
--     yorum, boşluk) ile sorduğu beceriler. Sınavda bu grafiğe benzer,
--     sayıları farklı yeni grafik çizilir ve aynı biçimde yeni soru sorulur
--     (generate-exam, kodla; yapay zekâ yok).
--   Öğrenci yalnızca kendi kayıtlarını OKUYABİLİR; yazma yalnızca edge
--   function (service role) üzerinden.
-- ==========================================================================

create table if not exists public.document_chart_scans (
  document_id uuid primary key references public.documents(id) on delete cascade,
  user_id uuid not null,
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  pages integer[] not null default '{}',
  image_urls text[] not null default '{}',
  next_index integer not null default 0,
  found integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_chart_items (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null,
  page integer not null,
  chart jsonb not null,
  example jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.document_chart_scans add column if not exists image_urls text[] not null default '{}';

create index if not exists document_chart_items_document_idx on public.document_chart_items (document_id, page);

alter table public.document_chart_scans enable row level security;
alter table public.document_chart_items enable row level security;

drop policy if exists document_chart_scans_select_own on public.document_chart_scans;
create policy document_chart_scans_select_own on public.document_chart_scans
  for select using (user_id = auth.uid());

drop policy if exists document_chart_items_select_own on public.document_chart_items;
create policy document_chart_items_select_own on public.document_chart_items
  for select using (user_id = auth.uid());

-- Yazma politikası YOK: insert/update/delete yalnızca service role
-- (extract-chart-items). Tarayıcı taramayı ya da grafikleri değiştiremez.
