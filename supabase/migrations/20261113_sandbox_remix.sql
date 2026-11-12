-- ==========================================================================
-- ACADEX — PROJEYİ KURCALA (remix), 13.11.2026
-- Tekrar çalıştırmak güvenlidir.
--
-- NEDEN VAR: panelde bir projeyi görmek yetmiyordu; öğrenmenin hızlı yolu
-- başkasının kodunu açıp kurcalamak. Dosya ağacı zaten sunucuda
-- (sandbox_workspaces.files) ve gönderi ona workspace_id ile bağlı, ama RLS
-- başkasının çalışma alanını okutmaz. sandbox_remix definer olarak yalnız
-- YAYINDAKİ bir gönderiye bağlı dosyaları döndürür; görünürlük kuralı
-- gönderinin SELECT politikasının aynısıdır (giriş yapmış olmak + gizlenmemiş
-- olmak). Kopyalama sayısı gönderide tutulur: paylaşan öğrenci emeğinin
-- karşılığını görsün.
--
-- Teste bağlı: tests/sandbox-etkilesim.js
-- ==========================================================================

-- Sınıf panosu aynı gün denendi ve geri alındı (Berkay); canlıda kalan
-- fonksiyon temizlenir. Kullanan hiçbir yer yoktur.
drop function if exists public.misafir_pano();

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

notify pgrst, 'reload schema';
