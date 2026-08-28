-- ==========================================================================
-- Acadex: catalog-level "is this course quantitative?" flag.
--
-- This migration is NOT applied automatically -- run it yourself via:
--   1. Supabase Studio -> SQL Editor -> paste and run, or
--   2. `supabase db push` if you use the Supabase CLI with this repo linked.
--
-- Bug this fixes: the Sınav Platformu's "Hesaplama Sınavı" (calculation
-- exam) type was UNCONDITIONALLY greyed out for course-sourced exams
-- (Ders Ağacı -> "Sınav Oluştur" / picking "Ders" as the source in the
-- exam setup screen), regardless of whether the selected course actually
-- involves calculations. Courses like Financial Management are inherently
-- calculation-heavy (NPV/IRR, time value of money, ratio analysis, etc.)
-- and students reported their real professors frequently ask calculation
-- questions on these courses' actual exams -- so locking this option out
-- for every course-sourced exam directly undermined the exam platform's
-- "help with real vize/final/büt" goal.
--
-- Previously, "is this quantitative?" was only known per individual
-- study_card (an AI-assigned flag from summarize-document/merge-summarize
-- based on that specific document's content). That's a fine signal once
-- students have shared notes for a course, but it says nothing before any
-- notes exist yet -- exactly the case in the bug report (BF202 had no
-- shared summary yet).
--
-- This adds a courses.is_quantitative column: a catalog-level judgment
-- about the COURSE itself (curated below via a name-keyword heuristic
-- covering common Turkish business-faculty course names in English and
-- Turkish), independent of whether any student has shared material for it
-- yet. The app now OR's this catalog flag together with any pooled shared
-- card's own is_quantitative flag (see generate-exam/index.ts), so either
-- signal is enough to unlock the calculation exam type.
--
-- The keyword list below is a best-effort default, not a perfect
-- classification -- admins can correct individual courses afterwards with:
--   update public.courses set is_quantitative = true  where course_code = 'XXX000';
--   update public.courses set is_quantitative = false where course_code = 'XXX000';
-- ==========================================================================

alter table public.courses add column if not exists is_quantitative boolean not null default false;

update public.courses
set is_quantitative = true
where is_quantitative = false
  and (
    course_name ilike any (array[
      -- Finance / accounting / investment
      '%financ%', '%accounting%', '%muhasebe%', '%finans%',
      '%investment%', '%yatırım%', '%portfolio%', '%portföy%',
      '%corporate finance%', '%valuation%', '%budget%', '%bütçe%',
      '%taxation%', '%tax %', '%vergi%', '%audit%', '%denetim%',
      '%risk management%', '%risk yönetimi%', '%derivative%', '%türev%',
      '%actuarial%', '%aktüerya%',
      -- Economics / statistics / quantitative methods
      '%economic%', '%ekonomi%', '%econometric%', '%ekonometri%',
      '%statistic%', '%istatistik%', '%quantitative%', '%sayısal%',
      '%probability%', '%olasılık%', '%calculus%', '%mathematic%', '%matematik%',
      '%algebra%', '%cebir%',
      -- Operations / production
      '%operations research%', '%yöneylem%', '%operations management%',
      '%production management%', '%üretim yönetimi%', '%supply chain%', '%tedarik zinciri%'
    ])
  );
