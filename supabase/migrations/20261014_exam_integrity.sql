-- ==========================================================================
-- Acadex: Sınav Platformu — Faz 0 bütünlük düzeltmeleri
--
-- This migration is NOT applied automatically -- run it yourself via:
--   1. Supabase Studio -> SQL Editor -> paste and run, or
--   2. `supabase db push` if you use the Supabase CLI with this repo linked.
--
-- ÖNCE BU MIGRATION, SONRA generate-exam / grade-exam / get-exam-hint deploy.
-- (Fonksiyonlar migration yoksa da çalışır ama cevap anahtarını gizleyemez —
-- loglarda "exam_answer_keys" uyarısı görürsün.)
--
-- Ne yapıyor:
--   1. public.exam_answer_keys — her sınavın cevap anahtarı (doğru cevap,
--      çözüm adımları, tolerans, ipucu, kabul edilen alternatif cevaplar)
--      artık AYRI bir tabloda. RLS açık ve HİÇBİR politika yok: öğrenci,
--      öğretmen ve admin bu tabloyu tarayıcıdan okuyamaz; yalnızca
--      service-role kullanan edge function'lar (generate-exam, grade-exam,
--      get-exam-hint) okur/yazar. Böylece sınav sırasında doğru cevaplar
--      geliştirici araçlarından görülemez.
--      Sınav tamamlandıktan sonra doğru cevaplar zaten exams.question_results
--      içinde öğrenciye gösteriliyor; bu değişmedi.
--   2. exams.started_at — sınavın başladığı an. grade-exam simülasyon
--      süresini artık sunucuda bununla kontrol ediyor.
--   3. exams.hints_used — hangi sorularda ipucu alındığı (soru id dizisi).
--   4. exams.created_at — yoksa eklenir (generate-exam'deki kullanıcı başına
--      üretim limiti bununla sayıyor). Varsa dokunulmaz.
--   5. Koruma tetikleyicisi: tarayıcıdan gelen (authenticated/anon rolü)
--      bir istek exams satırındaki puanlama alanlarını (grade, answers,
--      question_results, completed_at, questions, started_at, hints_used)
--      DEĞİŞTİREMEZ. Öğretmenin teacher_note / teacher_reviewed güncellemesi
--      etkilenmez. exams tablosu repo dışında oluşturulduğu için mevcut RLS
--      politikalarını buradan göremiyoruz; tetikleyici, olası bir "sahibi
--      kendi satırını güncelleyebilir" politikası olsa bile notun elle
--      değiştirilmesini engeller.
--
-- Eski sınavlar: anahtar tablosunda satırı olmayan eski sınavlar, cevapları
-- hâlâ exams.questions içinde taşıdıkları için grade-exam tarafından eskisi
-- gibi puanlanır (geriye dönük uyumlu).
-- ==========================================================================

-- 1. Cevap anahtarı tablosu. exams.id'nin tipi (uuid / bigint) repo dışında
-- belirlendiği için dinamik olarak aynı tip kullanılıyor.
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
    create table if not exists public.exam_answer_keys (
      exam_id %s primary key references public.exams(id) on delete cascade,
      user_id uuid not null,
      keys jsonb not null,
      created_at timestamptz not null default now()
    )
  $f$, id_type);
end $$;

alter table public.exam_answer_keys enable row level security;
-- Bilerek HİÇBİR politika yok: service role RLS'i atlar, diğer herkes için
-- tablo boş görünür.

comment on table public.exam_answer_keys is
  'Sınav cevap anahtarları (soru id -> correct_answer, solution_steps, tolerance_percent, hint, accepted_answers). Yalnızca edge function''lar (service role) erişir; tarayıcıya hiç gönderilmez.';

-- 2-4. Yeni kolonlar
alter table public.exams add column if not exists started_at timestamptz;
alter table public.exams add column if not exists hints_used jsonb not null default '[]'::jsonb;
alter table public.exams add column if not exists created_at timestamptz not null default now();

create index if not exists exams_user_created_idx on public.exams (user_id, created_at desc);

-- 5. Puanlama alanlarını tarayıcıdan korunan hale getir.
create or replace function public.exams_guard_grading_fields()
returns trigger
language plpgsql
as $$
declare
  jwt_role text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
begin
  -- service_role (edge function'lar) ve SQL Editor (jwt yok) serbest.
  if jwt_role not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.grade is not null or new.completed_at is not null or new.question_results is not null then
      raise exception 'Sinav sonuclari yalnizca sunucu tarafindan yazilabilir.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.grade is distinct from old.grade
     or new.answers is distinct from old.answers
     or new.question_results is distinct from old.question_results
     or new.completed_at is distinct from old.completed_at
     or new.questions is distinct from old.questions
     or new.started_at is distinct from old.started_at
     or new.hints_used is distinct from old.hints_used then
    raise exception 'Sinav puanlama alanlari yalnizca sunucu tarafindan degistirilebilir.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists exams_guard_grading_fields on public.exams;
create trigger exams_guard_grading_fields
  before insert or update on public.exams
  for each row execute function public.exams_guard_grading_fields();

-- ==========================================================================
-- Kontrol (isteğe bağlı, migration'dan sonra SQL Editor'de çalıştır):
--
--   -- Tablo var mı, RLS açık mı, politikası yok mu?
--   select relrowsecurity from pg_class where oid = 'public.exam_answer_keys'::regclass;  -- true
--   select count(*) from pg_policies where tablename = 'exam_answer_keys';               -- 0
--
--   -- exams tablosundaki mevcut politikalar (öğrencinin UPDATE politikası var mı?)
--   select policyname, cmd, roles from pg_policies where tablename = 'exams';
-- ==========================================================================
