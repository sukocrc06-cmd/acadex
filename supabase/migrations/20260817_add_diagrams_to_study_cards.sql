-- Migration: Add diagrams column to study_cards for Mermaid-reconstructed
-- process flows, hierarchies, comparisons and other visual structures that
-- the summarizer extracts / reconstructs from the source document.
--
-- Part of Ozet System Madde 1: Layout + Formül + Diyagram çıkarımı.
--
-- After applying this migration, redeploy summarize-document (and merge-summarize
-- if it also writes study cards) so the new field is populated.

alter table public.study_cards
  add column if not exists diagrams jsonb not null default '[]'::jsonb;

comment on column public.study_cards.diagrams is
  'Array of { title, mermaid, description } objects. Each entry is an AI-reconstructed diagram (flowchart, sequence, mindmap, graph, etc.) derived from the source document''s visual or structural content. mermaid is valid Mermaid.js source that the frontend renders client-side. Empty array is correct when the document has no reconstructible diagrams.';
