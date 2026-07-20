-- Migration: Add visual_analysis column to public.study_cards
alter table public.study_cards add column if not exists visual_analysis boolean default false;
