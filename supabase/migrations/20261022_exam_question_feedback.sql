-- ==========================================================================
-- Acadex: Sınav Platformu — Faz 2b: itiraz ve "bu soru hatalı" bildirimi
--
-- This migration is NOT applied automatically -- run it yourself via:
--   1. Supabase Studio -> SQL Editor -> paste and run, or
--   2. `supabase db push` if you use the Supabase CLI with this repo linked.
--
-- 20261014_exam_integrity.sql ve 20261014b_exam_engine.sql'den SONRA
-- çalıştırılmalı. İki kez çalıştırmak güvenli.
--
-- Ne yapıyor:
--   public.exam_question_feedback — tamamlanmış bir sınavdaki bir soru için
--   öğrencinin geri bildirimi:
--     kind = 'appeal'  itiraz: soru daha güçlü ayarlarla yeniden puanlanır
--                      (exam-appeal edge function). Puan asla düşmez.
--     kind = 'report'  "bu soru hatalı" bildirimi (anahtar yanlış, soru
--                      belirsiz, kaynakta yok, yazım hatası...). Puanı
--                      değiştirmez; soru kalitesini izlemek için.
--   Her soru için her türden en fazla bir kayıt.
--   Öğrenci yalnızca kendi kayıtlarını OKUYABİLİR; yazma yalnızca
--   exam-appeal (service role) üzerinden — puanı değiştiren tek yol orası.
--
-- Not: exams.id'nin tipi (uuid / bigint) repo dışında belirlendiği için
-- tablo aynı tipi dinamik olarak kullanıyor (20261014b ile aynı düzen).
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
    create table if not exists public.exam_question_feedback (
      id bigint generated always as identity primary key,
      exam_id %s not null references public.exams(id) on delete cascade,
      question_id integer not null,
      user_id uuid not null,
      kind text not null check (kind in ('appeal', 'report')),
      category text,
      reason text,
      status text not null default 'open'
        check (status in ('open', 'accepted', 'rejected', 'escalated', 'resolved')),
      old_score integer,
      new_score integer,
      details jsonb,
      created_at timestamptz not null default now(),
      resolved_at timestamptz,
      unique (exam_id, question_id, kind)
    )
  $f$, id_type);
end
$$;

create index if not exists exam_question_feedback_user_created_idx
  on public.exam_question_feedback (user_id, created_at desc);

create index if not exists exam_question_feedback_status_idx
  on public.exam_question_feedback (kind, status);

-- RLS: öğrenci kendi kayıtlarını okur; kimse tarayıcıdan yazamaz.
alter table public.exam_question_feedback enable row level security;

drop policy if exists "exam_question_feedback_owner_select" on public.exam_question_feedback;
create policy "exam_question_feedback_owner_select"
  on public.exam_question_feedback for select
  to authenticated
  using (user_id = auth.uid());

grant select on public.exam_question_feedback to authenticated;
