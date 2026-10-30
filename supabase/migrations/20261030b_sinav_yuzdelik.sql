-- ============================================================================
-- ACADEX — SINAV YÜZDELİĞİ (30.10.2026)
-- Karnede ders başına "bu dersi çözen N öğrencinin %X'inden yüksek ortalama"
-- (örnek: UWorld / BoardVitals yüzdelik sırası).
--
-- Gizlilik:
--   * Yalnızca çağıran öğrencinin kendi dersleri; başka öğrencinin adı, puanı
--     ya da ortalaması asla dönmez.
--   * Bir derste en az 20 farklı öğrenci yoksa yüzdelik dönmez (yalnızca
--     öğrenci sayısı); yüzdelik 5'in katına yuvarlanır.
-- Ders anahtarı karneyle aynı (js/acadex-ink.js keyOfExam): ders ağacı
-- sınavında ders kodu, kart sınavında kartın ders etiketi; büyük harf, boşluksuz.
-- Ölçüt: öğrencinin o dersteki tamamlanmış denemelerinin not ortalaması;
-- ikinci şans sınavları (scoring.retry) sayılmaz.
-- Bu dosya SQL Editor'de bir kez çalıştırılır; tekrar çalıştırmak güvenlidir.
-- ============================================================================

create or replace function public.exam_peer_percentiles()
returns table (course text, students int, percentile int)
language sql stable security definer set search_path = public as $$
  with keyed as (
    select e.user_id,
           upper(btrim(case when e.source_type = 'course' and nullif(btrim(e.course_code), '') is not null then e.course_code else c.course_tag end)) as course,
           e.grade::numeric as grade
    from public.exams e
    left join public.study_cards c on c.id = e.study_card_id
    where e.completed_at is not null and e.grade is not null and e.user_id is not null
      and jsonb_typeof(e.scoring -> 'retry') is distinct from 'array'
  ),
  avgs as (
    select course, user_id, avg(grade) as a
    from keyed where course is not null and course <> ''
    group by course, user_id
  ),
  mine as (
    select course, a from avgs where user_id = auth.uid()
  )
  select m.course,
         (select count(*) from avgs x where x.course = m.course)::int as students,
         case when (select count(*) from avgs x where x.course = m.course) >= 20 then
           (round((select (count(*) filter (where x.a < m.a) + 0.5 * count(*) filter (where x.a = m.a))
                     / nullif(count(*), 0) * 100
                   from avgs x where x.course = m.course and x.user_id <> auth.uid()) / 5) * 5)::int
         end as percentile
  from mine m
  order by m.course
$$;

revoke all on function public.exam_peer_percentiles() from public, anon;
grant execute on function public.exam_peer_percentiles() to authenticated;
