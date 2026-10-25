-- ==========================================================================
-- Yarinki sana not hesapta (test raporu R8) . 25.10.2026
--   profiles.day_memo = { t: not metni, d: yazildigi gun YYYY-MM-DD, at: ms }
--   Eskiden not yalnizca tarayicida duruyordu; telefonda yazilan not
--   bilgisayarda gorunmuyordu. Kendi satirini guncelleme izni zaten var
--   ("Users can update own profile"); yeni politika gerekmez.
-- Supabase -> SQL Editor'de bir kez calistir; tekrar calistirmak zarar vermez.
-- ==========================================================================
alter table public.profiles add column if not exists day_memo jsonb;
