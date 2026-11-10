-- Acadex English · Speaking sınav simülatörü (07.11.2026)
-- ing_icerik havuzuna 'sinav' türü: alt = seviye:bölüm (kolay:isinma, kolay:gorus, orta:part1,
-- orta:part2, zor:tekrar, zor:mulakat). Üretim ve doğrulama ingilizce-hoca → URET.sinav / DOGRULA.sinav.
-- Önce 20261105_ingilizce_icerik_havuzu.sql çalışmış olmalı. Supabase SQL Editor'da elle çalıştırılır.

do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.ing_icerik'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%tur%sozluk%';
  if c is not null then execute format('alter table public.ing_icerik drop constraint %I', c); end if;
end $$;

alter table public.ing_icerik add constraint ing_icerik_tur_check
  check (tur in ('okuma', 'dikte', 'kelime', 'sohbet', 'yazi_konu', 'test', 'deste', 'sozluk', 'sinav'));
