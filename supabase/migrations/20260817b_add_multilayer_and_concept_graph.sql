-- Migration: Multi-layer summary + concept graph (Madde 2)
--
-- summary_executive : 2-3 sentence ultra-short "30 second" overview
-- concept_graph     : { nodes: [{id, label, type}], edges: [{from, to, relation}] }
--
-- After applying, redeploy summarize-document.

alter table public.study_cards
  add column if not exists summary_executive text not null default '';

alter table public.study_cards
  add column if not exists concept_graph jsonb not null default '{"nodes":[],"edges":[]}'::jsonb;

comment on column public.study_cards.summary_executive is
  'Ultra-short 2-3 sentence executive overview of the document. Shown at the top of the study card for quick scanning.';

comment on column public.study_cards.concept_graph is
  'Knowledge graph extracted from the document: { nodes: [{ id, label, type }], edges: [{ from, to, relation }] }. type is usually "concept". relation examples: includes, is_a, causes, part_of, related_to, depends_on, contrasts_with. Empty graph is correct for very short/simple documents.';
