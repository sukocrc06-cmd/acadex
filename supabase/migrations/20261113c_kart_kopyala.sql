-- ==========================================================================
-- ACADEX — PANODAKİ ÖZETİ KENDİ KARTLARIMA KOPYALA (13.11.2026)
-- Tekrar çalıştırmak güvenlidir.
--
-- NEDEN VAR: sandbox panelindeki "kurcala"nın bölüm akışındaki karşılığı.
-- Panoda işine yarayan bir özet görüyorsun ama yapabildiğin tek şey okumak;
-- kendi kart destende tutamıyorsun. Kopyalama istemciden tek tek kolon
-- yazarak yapılamaz (kart 36 kolonlu, biri eklenince kopya sessizce eksilir),
-- bu yüzden sunucuda tek fonksiyon: study_card_kopyala.
--
-- Kurallar:
--   * Yalnız PAYLAŞILMIŞ kart kopyalanır (kartın SELECT politikasıyla aynı).
--   * Kopya seni sahibi yapar, kapalı doğar (is_shared=false) — kimse senin
--     adına yeniden paylaşmış olmaz.
--   * document_id boş bırakılır: kaynak belge karşı tarafın dosyasıdır,
--     kopyanın ona bağlanması belge erişimini sızdırırdı.
--   * kaynak_kart ile atıf kalır; "bu kart <kişi>nin panosundan" denebilir.
--   * Misafir kopyalayamaz (kendi kart destesi yoktur).
--   * Aynı kartı iki kez kopyalamak yeni kopya üretmez; var olanı döndürür.
--
-- Teste bağlı: tests/bolum-akisi.js
-- ==========================================================================

alter table public.study_cards
  add column if not exists kaynak_kart uuid references public.study_cards(id) on delete set null;

create index if not exists study_cards_kaynak_kart_idx on public.study_cards (kaynak_kart);

create or replace function public.study_card_kopyala(p_card uuid)
returns uuid language plpgsql volatile security definer set search_path to 'public' as $$
declare v_yeni uuid; v_sahip uuid;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli.' using errcode = '28000';
  end if;
  if public.misafir_mi() then
    raise exception 'Misafir girişi kart kopyalayamaz.' using errcode = '42501';
  end if;
  select user_id into v_sahip from study_cards where id = p_card and is_shared = true;
  if v_sahip is null then return null; end if;                    -- yok ya da paylaşılmamış
  if v_sahip = auth.uid() then return null; end if;               -- kendi kartın zaten sende
  -- İkinci kez kopyalama yeni kart üretmesin.
  select id into v_yeni from study_cards
   where user_id = auth.uid() and kaynak_kart = p_card limit 1;
  if v_yeni is not null then return v_yeni; end if;

  insert into study_cards (
    user_id, document_id, kaynak_kart, is_shared, shared_at, department,
    summary, key_terms, key_points, quiz_questions, summary_style, summary_language,
    course_tag, is_merged, source_documents, document_type, summary_length,
    visual_analysis, tables, charts, footnotes, suggested_course_tag, formulas,
    worked_examples, is_quantitative, chat_attachments, sections, diagrams,
    summary_executive, concept_graph, cloze_cards, outline, quality_meta,
    podcast_script, share_meta)
  select
    auth.uid(), null, c.id, false, null, null,
    c.summary, c.key_terms, c.key_points, c.quiz_questions, c.summary_style, c.summary_language,
    c.course_tag, c.is_merged, c.source_documents, c.document_type, c.summary_length,
    c.visual_analysis, c.tables, c.charts, c.footnotes, c.suggested_course_tag, c.formulas,
    c.worked_examples, c.is_quantitative, c.chat_attachments, c.sections, c.diagrams,
    c.summary_executive, c.concept_graph, c.cloze_cards, c.outline, c.quality_meta,
    c.podcast_script, c.share_meta
    from study_cards c where c.id = p_card
  returning id into v_yeni;
  return v_yeni;
end $$;
revoke all on function public.study_card_kopyala(uuid) from public;
grant execute on function public.study_card_kopyala(uuid) to authenticated;

notify pgrst, 'reload schema';
