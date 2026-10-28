-- ==========================================================================
-- Acadex: Sınav Platformu — Faz 6.3b: gizli cevapların açılma zamanı
-- 28.10.2026 · 20261028b_sinav_faz6_ogrenci.sql'den SONRA çalıştır. Tekrar
-- çalıştırmak zarar vermez.
--
-- Sorun: exam_hidden_results.reveal_at teslim anında yazılıyordu. Öğretmen
-- son teslimi uzatırsa erken teslim eden öğrenci cevapları, diğerleri hâlâ
-- çözerken görebilirdi. Artık karar ödevin GÜNCEL durumundan verilir:
--   "son teslimden sonra": teslim penceresi bitince ya da ödev kapanınca
--   "hiç": asla
-- Ödev silinmişse (exams.assignment_id null) eski reveal_at geçerli.
-- ==========================================================================

create or replace function public.exam_hidden_revealed(p_exam uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce(
    (select case when a.settings->>'show_answers' = 'never' then false
                 else a.status = 'closed' or now() >= public.assignment_window_end(a) end
       from exams e join assignments a on a.id = e.assignment_id where e.id = p_exam),
    (select h.reveal_at is not null and h.reveal_at <= now() from exam_hidden_results h where h.exam_id = p_exam),
    false);
$$;
revoke all on function public.exam_hidden_revealed(uuid) from public, anon;
grant execute on function public.exam_hidden_revealed(uuid) to authenticated;

drop policy if exists "exam_hidden_results_revealed" on public.exam_hidden_results;
create policy "exam_hidden_results_revealed" on public.exam_hidden_results for select to authenticated
  using (user_id = auth.uid() and public.exam_hidden_revealed(exam_id));
