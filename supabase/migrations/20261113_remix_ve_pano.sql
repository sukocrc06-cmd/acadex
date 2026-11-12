-- ==========================================================================
-- ACADEX — PROJEYİ KURCALA (remix) + MİSAFİR SINIF PANOSU (13.11.2026)
-- Tekrar çalıştırmak güvenlidir.
--
-- 1) REMIX: panelde bir projeyi görmek yetmiyordu; öğrenmenin hızlı yolu
--    başkasının kodunu açıp kurcalamak. Dosya ağacı zaten sunucuda
--    (sandbox_workspaces.files) ve gönderi ona workspace_id ile bağlı, ama
--    RLS başkasının çalışma alanını okutmaz. sandbox_remix definer olarak
--    yalnız YAYINDAKİ bir gönderiye bağlı dosyaları döndürür; görünürlük
--    kuralı gönderinin SELECT politikasının aynısıdır (giriş yapmış olmak +
--    gizlenmemiş olmak). Kopyalama sayısı gönderide tutulur: paylaşan
--    öğrenci emeğinin karşılığını görsün.
--
-- 2) SINIF PANOSU: misafir kendi ilerlemesini görüyor ama sınıfın neresinde
--    olduğunu bilmiyordu. misafir_pano yalnız KENDİ ders kodunun toplamlarını
--    döndürür — isim yok, kimlik yok, sayı var. Hafta "bitti" ölçütü lab ile
--    birebir aynı: anlatım + görsel + sınav >= 60 (labs/istat ist-core
--    IST.parts). Misafir yazamaz ama OKUYABİLİR; bu fonksiyon da yalnız okur.
--
-- Teste bağlı: tests/sandbox-etkilesim.js, tests/ders-kodu-misafir.js
-- ==========================================================================

-- 1) REMIX ------------------------------------------------------------------
alter table public.sandbox_projects
  add column if not exists remix_sayi integer not null default 0;

create or replace function public.sandbox_remix(p_post uuid)
returns json language plpgsql volatile security definer set search_path to 'public' as $$
declare v_ws text; v_ad text; v_sahip uuid; v_files jsonb;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli.' using errcode = '28000';
  end if;
  -- Misafir (ders kodu oturumu) kendi tahtasına sahip değildir; kopyalayamaz.
  if public.misafir_mi() then
    raise exception 'Misafir girişi proje kopyalayamaz.' using errcode = '42501';
  end if;
  -- Görünürlük: gönderinin SELECT politikasıyla aynı kural.
  select p.workspace_id, p.title, p.user_id into v_ws, v_ad, v_sahip
    from sandbox_projects p
   where p.id = p_post and (not coalesce(p.hidden, false) or p.user_id = auth.uid());
  if v_ws is null then return null; end if;          -- gönderi yok ya da sandbox projesi bağlı değil
  select w.files into v_files from sandbox_workspaces w where w.id = v_ws;
  if v_files is null or jsonb_typeof(v_files) <> 'object' then return null; end if;
  -- Kendi projeni kopyalamak sayacı şişirmesin.
  if v_sahip <> auth.uid() then
    update sandbox_projects set remix_sayi = remix_sayi + 1 where id = p_post;
  end if;
  return json_build_object('ad', v_ad, 'files', v_files, 'sahip', v_sahip);
end $$;
revoke all on function public.sandbox_remix(uuid) from public;
grant execute on function public.sandbox_remix(uuid) to authenticated;

-- 2) SINIF PANOSU -----------------------------------------------------------
create or replace function public.misafir_pano()
returns json language plpgsql stable security definer set search_path to 'public' as $$
declare v_kod uuid; v_ben integer;
begin
  select kod_id into v_kod from ders_konuklari where user_id = auth.uid();
  if v_kod is null then return null; end if;
  return (
    with sayim as (
      select k.user_id,
             (select count(*) from jsonb_each(coalesce(k.ilerleme, '{}'::jsonb)) e
               where e.key ~ '^g[0-9]+$'
                 and coalesce(e.value->>'a', '') not in ('', 'false', '0')
                 and coalesce(e.value->>'g', '') not in ('', 'false', '0')
                 and coalesce(e.value->>'s', '') ~ '^[0-9]+(\.[0-9]+)?$'
                 and (e.value->>'s')::numeric >= 60) as bitmis
        from ders_konuklari k where k.kod_id = v_kod
    )
    select json_build_object(
      'toplam',    (select count(*) from sayim),
      'oynayan',   (select count(*) from sayim where bitmis > 0),
      'ben',       coalesce((select bitmis from sayim where user_id = auth.uid()), 0),
      'ort',       coalesce((select round(avg(bitmis), 1) from sayim), 0),
      'gerisinde', (select count(*) from sayim
                     where bitmis < coalesce((select bitmis from sayim where user_id = auth.uid()), 0)))
  );
end $$;
revoke all on function public.misafir_pano() from public;
grant execute on function public.misafir_pano() to authenticated;

notify pgrst, 'reload schema';
