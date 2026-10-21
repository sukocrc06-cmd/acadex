-- ==========================================================================
-- Acadex: Sınav Platformu — Faz 1 (soru motoru) tabloları
--
-- This migration is NOT applied automatically -- run it yourself via:
--   1. Supabase Studio -> SQL Editor -> paste and run, or
--   2. `supabase db push` if you use the Supabase CLI with this repo linked.
--
-- 20261014_exam_integrity.sql'den SONRA çalıştırılmalı (exam_answer_keys
-- ve exams.hints_used onda). İki kez çalıştırmak güvenli.
--
-- Ne yapıyor:
--   1. public.question_attempts — her tamamlanmış sınavdaki HER SORU için
--      bir satır: soru, öğrencinin cevabı, puan, ipucu alındı mı, işaretli
--      miydi. grade-exam (service role) yazar. Hata defteri, konu ustalığı
--      ve aralıklı tekrar (Faz 7) bu tablodan beslenecek; Zayıf Konular
--      paneli de ileride JSONB yerine buradan okuyacak.
--      Öğrenci yalnızca kendi satırlarını OKUYABİLİR; yazamaz. Satırlarda
--      cevap anahtarı da var, ama yalnızca TAMAMLANMIŞ sınavlar için
--      yazıldığından öğrenci bunları sonuç ekranında zaten gördü.
--   2. public.exam_drafts — devam eden bir sınavın otomatik kaydı
--      (cevaplar, işaretli sorular, kalınan soru). Tarayıcı birkaç saniyede
--      bir yazar; sayfa yenilenirse ya da kapanırsa sınav kaldığı yerden
--      açılır. Öğrenci yalnızca kendi taslaklarını görür/yazar, ve yalnızca
--      kendisine ait, TAMAMLANMAMIŞ bir sınav için taslak açabilir.
--      grade-exam sınav puanlanınca taslağı siler.
--
-- Not: exams.id'nin tipi (uuid / bigint) repo dışında belirlendiği için
-- tablolar aynı tipi dinamik olarak kullanıyor.
-- ==========================================================================

do $$
declare
  id_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into id_type
  from pg_attribute a
  where a.attrelid = 'public.exams'::regclass
    and a.attname = 'id'
    and not a.attisdropped;

  if id_type is null then
    raise exception 'public.exams.id bulunamadi — exams tablosu beklenen yapida degil.';
  end if;

  execute format($f$
    create table if not exists public.question_attempts (
      id bigint generated always as identity primary key,
      user_id uuid not null,
      exam_id %s not null references public.exams(id) on delete cascade,
      question_id integer not null,
      question_type text not null,
      concept text,
      course_code text,
      study_card_id text,
      language text,
      difficulty text,
      question jsonb not null,
      answer_key jsonb,
      student_answer text,
      score integer,
      is_correct boolean,
      hint_used boolean not null default false,
      flagged boolean not null default false,
      created_at timestamptz not null default now(),
      unique (exam_id, question_id)
    )
  $f$, id_type);

  execute format($f$
    create table if not exists public.exam_drafts (
      exam_id %s primary key references public.exams(id) on delete cascade,
      user_id uuid not null default auth.uid(),
      answers jsonb not null default '{}'::jsonb,
      flags jsonb not null default '[]'::jsonb,
      current_index integer not null default 0,
      view_mode text,
      updated_at timestamptz not null default now()
    )
  $f$, id_type);
end $$;

create index if not exists question_attempts_user_created_idx on public.question_attempts (user_id, created_at desc);
create index if not exists question_attempts_user_concept_idx on public.question_attempts (user_id, concept);
create index if not exists exam_drafts_user_updated_idx on public.exam_drafts (user_id, updated_at desc);

-- RLS: question_attempts — öğrenci kendi satırlarını okur, kimse tarayıcıdan yazamaz.
alter table public.question_attempts enable row level security;

drop policy if exists "question_attempts_owner_select" on public.question_attempts;
create policy "question_attempts_owner_select"
  on public.question_attempts for select
  to authenticated
  using (user_id = auth.uid());

-- RLS: exam_drafts — öğrenci yalnızca kendi, tamamlanmamış sınavının taslağını yönetir.
alter table public.exam_drafts enable row level security;

drop policy if exists "exam_drafts_owner_select" on public.exam_drafts;
create policy "exam_drafts_owner_select"
  on public.exam_drafts for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "exam_drafts_owner_insert" on public.exam_drafts;
create policy "exam_drafts_owner_insert"
  on public.exam_drafts for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.exams e
      where e.id = exam_drafts.exam_id
        and e.user_id = auth.uid()
        and e.completed_at is null
    )
  );

drop policy if exists "exam_drafts_owner_update" on public.exam_drafts;
create policy "exam_drafts_owner_update"
  on public.exam_drafts for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.exams e
      where e.id = exam_drafts.exam_id
        and e.user_id = auth.uid()
        and e.completed_at is null
    )
  );

drop policy if exists "exam_drafts_owner_delete" on public.exam_drafts;
create policy "exam_drafts_owner_delete"
  on public.exam_drafts for delete
  to authenticated
  using (user_id = auth.uid());

grant select on public.question_attempts to authenticated;
grant select, insert, update, delete on public.exam_drafts to authenticated;

comment on table public.question_attempts is
  'Tamamlanmış sınavlarda soru bazında deneme kaydı (grade-exam yazar). Hata defteri, konu ustalığı ve aralıklı tekrar bu tablodan beslenir.';
comment on table public.exam_drafts is
  'Devam eden sınavın otomatik kaydı (cevaplar, işaretler, kalınan soru). Sınav puanlanınca grade-exam siler.';

-- ==========================================================================
-- Kontrol (isteğe bağlı):
--   select tablename, policyname, cmd from pg_policies
--   where tablename in ('question_attempts', 'exam_drafts') order by 1, 2;
--   -- question_attempts: 1 politika (SELECT), exam_drafts: 4 politika
-- ==========================================================================
