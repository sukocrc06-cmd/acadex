-- Acadex English · Konuşma atölyesi (07.11.2026)
-- ing_icerik havuzuna 'konusma' türü: alt = etkinlik:kategori:seviye
-- (ör. munazara:spor:B2, taboo:yemek:A1). Üretim ve doğrulama ingilizce-hoca →
-- URET.konusma / DOGRULA.konusma. Aynı dosya 'dinle' türünü de ekler (dinleme stüdyosu,
-- alt = kategori:seviye, ör. kampus:B2; URET.dinle / DOGRULA.dinle) ve 'oku' türünü (okuma masası, aynı alt biçimi; URET.oku / DOGRULA.oku), 'yaz' türünü (yazma masası görevleri; URET.yaz / DOGRULA.yaz). Önce 20261105 ve 20261107 dosyaları çalışmış olmalı.

do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.ing_icerik'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%tur%sozluk%';
  if c is not null then execute format('alter table public.ing_icerik drop constraint %I', c); end if;
end $$;

alter table public.ing_icerik add constraint ing_icerik_tur_check
  check (tur in ('okuma', 'dikte', 'kelime', 'sohbet', 'yazi_konu', 'test', 'deste', 'sozluk', 'sinav', 'konusma', 'dinle', 'oku', 'yaz'));
