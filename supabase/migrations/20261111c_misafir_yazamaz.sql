-- ==========================================================================
-- ACADEX — MİSAFİR VERİTABANINDA HİÇBİR ŞEY YAZAMAZ (genel kilit)
--
-- NEDEN VAR (11.11.2026, Berkay: "istatistik hariç hepsinde engellensin,
-- diğerlerine bu işi bırakmayalım"): misafir kilidi istemcideydi; API'yi
-- doğrudan çağıran bir misafir, yazma politikası açık tablolara yazabilirdi.
-- Bu migration İŞİ KÖKTEN çözer: anonim JWT ile gelen HER insert/update/
-- delete veritabanında reddedilir — hangi sayfadan, hangi edge
-- fonksiyonundan gelirse gelsin (kullanıcı yetkisiyle yazan her yol).
--
-- NASIL: RLS'in KISITLAYICI (restrictive) politikaları. Normal (permissive)
-- politikalara DOKUNMAZ, onlarla VE'lenir: izinli kullanıcıda koşul true
-- olduğundan hiçbir davranış değişmez; misafirde false olduğundan yazma düşer.
-- OKUMA serbest kalır ("sadece görsünler") — taze anonim hesabın verisi
-- zaten boştur.
--
-- BİLİNÇLİ İSTİSNALAR / SINIRLAR:
--  * SECURITY DEFINER fonksiyonlar tablo sahibiyle çalışır, RLS'e takılmaz —
--    misafir_kaydet / misafir_ilerleme_koy bu yüzden ÇALIŞMAYA DEVAM EDER
--    (İstatistik ilerlemesi tek izinli yazma yoludur ve o kapıdan geçer).
--  * Yalnız RLS'i AÇIK public tabloları kapsar (bugün hepsi açık; RLS'siz
--    tablo açan olursa bu migration yeniden koşulmalı). storage.objects da
--    kapsanır: misafir dosya yükleyemez/silemez.
--  * is_anonymous bayrağı taşımayan eski JWT'lerde coalesce false döner —
--    gerçek kullanıcı asla yanlışlıkla kilitlenmez.
--
-- Teste bağlı: tests/ders-kodu-misafir.js
-- ==========================================================================

create or replace function public.misafir_mi()
returns boolean language sql stable as $$
  select coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
$$;
revoke all on function public.misafir_mi() from public;
grant execute on function public.misafir_mi() to anon, authenticated, service_role;

-- RLS'i açık her public tabloya üç kısıtlayıcı politika (varsa tazelenir).
do $$
declare r record;
begin
  for r in select tablename from pg_tables
            where schemaname = 'public' and rowsecurity
  loop
    execute format('drop policy if exists zz_misafir_ekleyemez on public.%I', r.tablename);
    execute format('create policy zz_misafir_ekleyemez on public.%I as restrictive for insert to authenticated with check (not public.misafir_mi())', r.tablename);
    execute format('drop policy if exists zz_misafir_degistiremez on public.%I', r.tablename);
    execute format('create policy zz_misafir_degistiremez on public.%I as restrictive for update to authenticated using (not public.misafir_mi())', r.tablename);
    execute format('drop policy if exists zz_misafir_silemez on public.%I', r.tablename);
    execute format('create policy zz_misafir_silemez on public.%I as restrictive for delete to authenticated using (not public.misafir_mi())', r.tablename);
  end loop;
end $$;

-- Depolama: misafir dosya yükleyemez, değiştiremez, silemez (okuma serbest;
-- herkese açık kovalar zaten RLS'siz servis edilir).
drop policy if exists zz_misafir_ekleyemez on storage.objects;
create policy zz_misafir_ekleyemez on storage.objects as restrictive
  for insert to authenticated with check (not public.misafir_mi());
drop policy if exists zz_misafir_degistiremez on storage.objects;
create policy zz_misafir_degistiremez on storage.objects as restrictive
  for update to authenticated using (not public.misafir_mi());
drop policy if exists zz_misafir_silemez on storage.objects;
create policy zz_misafir_silemez on storage.objects as restrictive
  for delete to authenticated using (not public.misafir_mi());
