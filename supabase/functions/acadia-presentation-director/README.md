# Acadia Presentation Director V11

`acadia-presentation-director` is the multi-pass academic presentation engine used by Acadex Presentation Studio V11.

## Pipeline

1. Source analysis
2. Presentation brief + narrative plan
3. Evidence map
4. Slide Writer + Visual Planner
5. Academic Critic / repair pass
6. Save + citation lineage

The function supports `topic`, `study_card`, and `document` sources and the presentation modes `academic`, `thesis_defense`, `research`, `lecture`, and `business`.

## Database dependency

No additional V11 migration is required. V11 reuses the Presentation Intelligence V10 tables created by:

`supabase/migrations/20260810_presentation_intelligence_v10.sql`

In particular it writes best-effort telemetry to `presentation_generation_runs`; the browser client persists source/citation lineage through `presentation_sources` and `presentation_slide_citations`.

## Required secrets

The project must already provide:

- `GROQ_API_KEY`

Optional:

- `GROQ_PRESENTATION_MODEL` — defaults to `openai/gpt-oss-120b`

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are provided by the Supabase Functions runtime.

## Deploy

From the repository root with the Supabase CLI authenticated and the project linked:

```bash
supabase functions deploy acadia-presentation-director
```

If the repo is not linked yet:

```bash
supabase link --project-ref <PROJECT_REF>
supabase functions deploy acadia-presentation-director
```

## Client fallback

The V11 browser client performs a health check before using the new function. If this function has not been deployed yet, Presentation Studio keeps working and falls back to the existing `generate-presentation` function. The V11 dialog labels this state as `LEGACY FALLBACK` rather than silently pretending the multi-pass pipeline is active.

## Actions

- `health` — deployment/version check
- `plan` — brief, narrative arc, outline and evidence map
- `compose` — slide writing + visual planning + critic repair from an approved plan
- `generate` — plan and compose in one server call
- `critique` — deterministic deck quality check

All user-owned source reads use the caller JWT and existing Supabase RLS policies.
