-- ==========================================================================
-- Acadex: full-text search over document_chunks.
--
-- This migration is NOT applied automatically — run this file yourself via
-- one of:
--   1. Supabase Studio → SQL Editor → paste and run, or
--   2. `supabase db push` if you use the Supabase CLI with this repo linked.
--
-- RUN 20261003_add_document_chunks.sql FIRST — this migration extends that
-- table and will fail with a clear error if it is missing.
--
-- WHY THIS EXISTS
--
-- chat-with-document assembles a document's whole text and then cuts it at
-- 100,000 characters:
--
--     const MAX_CHARS = 100000
--     if (sourceText.length > MAX_CHARS) { ...truncating... }
--
-- At roughly 2,200 characters per dense academic page that is about 45
-- pages. On an 80-page lecture pack the file uploads fine and the study card
-- is produced, but a question about page 70 reaches a model that was never
-- shown page 70 — so it answers "this isn't in the source". The answer IS in
-- the source; it was cut off before the model saw it. That is the worst
-- possible failure mode for a grounded Q&A feature, because it is
-- indistinguishable from an honest "not found".
--
-- Sending more text is not the fix: the context window and the account's
-- tokens-per-minute cap both bite, and a bigger prompt is slower and dearer
-- for every single question. The fix is to stop sending the whole document
-- and send the part that answers the question.
--
-- WHY POSTGRES FULL-TEXT AND NOT EMBEDDINGS
--
-- Vector search would rank paraphrases better, but it needs an embedding API
-- for every chunk and every query — another provider, another key, another
-- per-document cost. Postgres full-text search is already inside the
-- database we query anyway, costs nothing per call, and for the actual job
-- here (a student asking about named concepts, formulas and terms that
-- appear verbatim in their own lecture notes) keyword matching with
-- stemming does most of the work. Embeddings remain the natural upgrade
-- later; this table and query shape do not have to change to add them.
--
-- WHY THE TURKISH CONFIGURATION
--
-- Turkish is agglutinative: "esneklik", "esnekliği", "esnekliğin" and
-- "esnekliğe" are the same concept, and an unstemmed index matches none of
-- them to each other. The snowball 'turkish' configuration strips those
-- suffixes. For an English document it mostly leaves words alone (English
-- text rarely carries Turkish suffixes), so it degrades gracefully rather
-- than breaking — and most of this portal's material is Turkish.
-- ==========================================================================

-- Fail loudly and early if prerequisites are missing, rather than part-way
-- through with a confusing error.
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'document_chunks'
  ) then
    raise exception
      'document_chunks tablosu yok. Once 20261003_add_document_chunks.sql migration ini calistirin.';
  end if;

  if not exists (select 1 from pg_ts_config where cfgname = 'turkish') then
    raise exception
      'PostgreSQL ''turkish'' text search konfigurasyonu bulunamadi. Bu migration onu gerektiriyor.';
  end if;
end
$$;

-- Generated column: the index is always consistent with `text`, with no
-- trigger to maintain and no way for application code to forget to update
-- it. The two-argument to_tsvector(regconfig, text) is IMMUTABLE, which is
-- what makes it legal in a generated column (the one-argument form is only
-- STABLE, because it reads default_text_search_config).
alter table public.document_chunks
  add column if not exists tsv tsvector
  generated always as (to_tsvector('turkish'::regconfig, coalesce(text, ''))) stored;

create index if not exists document_chunks_tsv_idx
  on public.document_chunks using gin (tsv);

-- ==========================================================================
-- search_document_chunks — rank a document's chunks against a query.
--
-- SECURITY INVOKER (the default) on purpose: called with the service role
-- from an edge function it sees everything, and called by a signed-in
-- student from the client it is still filtered by document_chunks' own
-- "select own documents" RLS policy. One function, safe from both sides.
--
-- p_tsquery is raw tsquery SYNTAX (e.g. 'esneklik | marjinal | maliyet'),
-- built by the caller. A malformed value raises inside to_tsquery, which is
-- caught here and turned into "no rows" so the caller can fall back to
-- sending the whole document instead of failing the student's question.
-- ==========================================================================
create or replace function public.search_document_chunks(
  p_document_ids uuid[],
  p_tsquery text,
  p_limit int default 24
)
returns table (
  id uuid,
  document_id uuid,
  chunk_index int,
  page_start int,
  page_end int,
  text text,
  rank real
)
language plpgsql
stable
as $$
declare
  q tsquery;
begin
  if p_document_ids is null or array_length(p_document_ids, 1) is null then
    return;
  end if;
  if p_tsquery is null or btrim(p_tsquery) = '' then
    return;
  end if;

  begin
    q := to_tsquery('turkish'::regconfig, p_tsquery);
  exception when others then
    -- Malformed query: no rows, caller falls back.
    return;
  end;

  return query
    select
      c.id,
      c.document_id,
      c.chunk_index,
      c.page_start,
      c.page_end,
      c.text,
      ts_rank_cd(c.tsv, q) as rank
    from public.document_chunks c
    where c.document_id = any(p_document_ids)
      and c.tsv @@ q
    -- chunk_index as the tie-break keeps results stable and, on equal
    -- relevance, prefers where a topic is first introduced.
    order by ts_rank_cd(c.tsv, q) desc, c.chunk_index asc
    limit greatest(1, least(coalesce(p_limit, 24), 200));
end;
$$;

comment on function public.search_document_chunks(uuid[], text, int) is
  'Rank one or more documents'' stored chunks against a tsquery. Used by chat-with-document to send only the passages relevant to a question instead of the whole document.';

grant execute on function public.search_document_chunks(uuid[], text, int) to authenticated;
grant execute on function public.search_document_chunks(uuid[], text, int) to service_role;
