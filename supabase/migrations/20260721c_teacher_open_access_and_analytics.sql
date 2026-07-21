-- ==========================================================================
-- Acadex: Open teacher access to all departments + school-wide analytics
--
-- Run this AFTER 20260719_admin_teacher_portals.sql and
-- 20260719b_admin_teacher_enhancements.sql — it replaces policies those
-- files created, so it must run after them (safe to run standalone if
-- those two are already applied; it will error if they aren't, since the
-- policies/functions it depends on won't exist yet).
--
-- Context: until now, a hoca could only see the students, documents, study
-- cards, and exams of their OWN department (RLS filtered on
-- `department = current_department()`). Per product decision, every
-- teacher account should now be able to reach every student across every
-- department — this migration removes that department filter from the
-- teacher-facing RLS policies. Admin-only policies are untouched.
--
-- What this adds/changes:
--   1. profiles_teacher_select_dept_students → any teacher can see any
--      student profile (still excludes other teachers/admins).
--   2. exams_teacher_select_dept / exams_teacher_update_dept → any teacher
--      can view and leave review feedback on any student's exam.
--   3. documents_teacher_select_dept → any teacher can see any student's
--      uploaded documents (needed for the "Öğrenci Detayı" view).
--   4. study_cards_teacher_select_dept (from 20260719b) → any teacher can
--      see any student's study card history.
--   5. announcements_teacher_manage_own_dept → a teacher can now target an
--      announcement at ANY department, or leave audience_department null
--      to reach every student (previously locked to their own department).
--   6. get_teacher_report() — a new RPC (mirrors the shape of the existing
--      admin get_admin_report(), but teacher-appropriate: no contact-message
--      counts) powering the new "Analitik" tab in teacher.html. Callable by
--      any teacher OR admin; anyone else gets an exception.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. profiles — teachers see every student, not just their own department
-- --------------------------------------------------------------------------
drop policy if exists "profiles_teacher_select_dept_students" on public.profiles;
create policy "profiles_teacher_select_dept_students"
  on public.profiles for select
  to authenticated
  using (
    public.current_is_teacher()
    and is_admin = false
    and is_teacher = false
  );

-- --------------------------------------------------------------------------
-- 2. exams — teachers can view/review any student's exam
-- --------------------------------------------------------------------------
drop policy if exists "exams_teacher_select_dept" on public.exams;
create policy "exams_teacher_select_dept"
  on public.exams for select
  to authenticated
  using (
    public.current_is_teacher()
    and exists (
      select 1 from public.profiles p
      where p.id = exams.user_id
        and p.is_admin = false
        and p.is_teacher = false
    )
  );

drop policy if exists "exams_teacher_update_dept" on public.exams;
create policy "exams_teacher_update_dept"
  on public.exams for update
  to authenticated
  using (
    public.current_is_teacher()
    and exists (
      select 1 from public.profiles p
      where p.id = exams.user_id
        and p.is_admin = false
        and p.is_teacher = false
    )
  )
  with check (
    public.current_is_teacher()
    and exists (
      select 1 from public.profiles p
      where p.id = exams.user_id
        and p.is_admin = false
        and p.is_teacher = false
    )
  );

-- --------------------------------------------------------------------------
-- 3. documents — teachers can see any student's uploaded documents
-- --------------------------------------------------------------------------
drop policy if exists "documents_teacher_select_dept" on public.documents;
create policy "documents_teacher_select_dept"
  on public.documents for select
  to authenticated
  using (
    public.current_is_teacher()
    and exists (
      select 1 from public.profiles p
      where p.id = documents.user_id
        and p.is_admin = false
        and p.is_teacher = false
    )
  );

-- --------------------------------------------------------------------------
-- 4. study_cards — teachers can see any student's study card history
-- --------------------------------------------------------------------------
drop policy if exists "study_cards_teacher_select_dept" on public.study_cards;
create policy "study_cards_teacher_select_dept"
  on public.study_cards for select
  to authenticated
  using (
    public.current_is_teacher()
    and exists (
      select 1 from public.profiles p
      where p.id = study_cards.user_id
        and p.is_admin = false
        and p.is_teacher = false
    )
  );

-- --------------------------------------------------------------------------
-- 5. announcements — a teacher can target any department, or null for all
-- --------------------------------------------------------------------------
drop policy if exists "announcements_teacher_manage_own_dept" on public.announcements;
create policy "announcements_teacher_manage_own_dept"
  on public.announcements for all
  to authenticated
  using (
    public.current_is_teacher()
    and created_by = auth.uid()
  )
  with check (
    public.current_is_teacher()
    and created_by = auth.uid()
  );

-- --------------------------------------------------------------------------
-- 6. get_teacher_report() — school-wide analytics for the teacher panel
-- --------------------------------------------------------------------------
create or replace function public.get_teacher_report()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  result jsonb;
begin
  if not (public.current_is_teacher() or public.current_is_admin()) then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'total_students', (select count(*) from public.profiles where is_admin = false and is_teacher = false),
    'total_documents', (select count(*) from public.documents),
    'total_study_cards', (select count(*) from public.study_cards),
    'total_exams_taken', (select count(*) from public.exams where completed_at is not null),
    'avg_exam_score', (select round(avg(grade)::numeric, 1) from public.exams where completed_at is not null and grade is not null),
    'total_shared_cards', (select count(*) from public.study_cards where is_shared = true),
    'top_departments', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select
          p.department as department,
          count(distinct p.id) as student_count,
          count(distinct d.id) as document_count,
          count(distinct sc.id) as card_count
        from public.profiles p
        left join public.documents d on d.user_id = p.id
        left join public.study_cards sc on sc.user_id = p.id
        where p.is_admin = false and p.is_teacher = false and p.department is not null
        group by p.department
        order by student_count desc
        limit 6
      ) t
    ),
    'top_courses', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select course_tag, count(*) as card_count
        from public.study_cards
        where course_tag is not null and course_tag <> ''
        group by course_tag
        order by card_count desc
        limit 8
      ) t
    ),
    'weakest_topics', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select
          sc.course_tag as course_tag,
          round(avg(e.grade)::numeric, 1) as avg_grade,
          count(*) as exam_count
        from public.exams e
        join public.study_cards sc on sc.id = e.study_card_id
        where e.completed_at is not null
          and e.grade is not null
          and sc.course_tag is not null
          and sc.course_tag <> ''
        group by sc.course_tag
        having count(*) >= 3
        order by avg_grade asc
        limit 8
      ) t
    )
  ) into result;

  return result;
end;
$$;

grant execute on function public.get_teacher_report() to authenticated;

-- ==========================================================================
-- After running this file, the "Analitik" tab in teacher.html and the
-- unrestricted student/exam/document/study-card visibility in teacher.html
-- will work immediately — no Edge Function redeploys needed for this one.
-- ==========================================================================
