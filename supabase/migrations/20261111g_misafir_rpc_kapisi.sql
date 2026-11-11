-- ==========================================================================
-- ACADEX — MİSAFİR RPC KAPISI: definer yan kapıları kapanır (güvenlik taraması)
--
-- NEDEN VAR (12.11.2026 taraması): 20261111c'nin genel kilidi RLS'tir;
-- SECURITY DEFINER fonksiyonlar RLS'e takılmaz (bilinçli — misafir_kaydet /
-- misafir_ilerleme_koy o kapıdan çalışır). Taramada misafirin konsoldan
-- çağırabileceği, iç koruması OLMAYAN iki definer yazıcı bulundu:
--   * push_subscribe   → misafir kendi cihazına push aboneliği açabilirdi
--   * ing_icerik_al    → ing_gorulen + kullanim sayacına iz bırakabilirdi
-- İkisi de kendi uid'iyle sınırlı (başkasının verisine dokunamaz) ama
-- "misafir hiçbir şey yazamaz" sözünü deler. Gövdeler pg_get_functiondef
-- çıktısının birebir aynısıdır; tek fark başa eklenen misafir bekçisi —
-- gerçek kullanıcı için davranış değişmez.
-- (support_* zaten oturumsuz ziyaretçiye açık token'lı yüzeydir, misafir yeni
-- bir şey kazanmaz; fin_*/admin_* iç koruma taşır; delete_my_account misafirin
-- KENDİ hesabını siler, serbest kalması sorun değil.)
--
-- Ayrıca: misafir_mi() için search_path sabitlenir (Supabase danışman uyarısı;
-- gövde zaten şema nitelikli, davranış değişmez).
--
-- Teste bağlı: tests/ders-kodu-misafir.js
-- ==========================================================================

alter function public.misafir_mi() set search_path to '';

create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_ua text default null::text)
returns json language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid();
begin
  if public.misafir_mi() then raise exception 'PUSH_GIRIS'; end if;
  if uid is null then raise exception 'PUSH_GIRIS'; end if;
  if not public.push_endpoint_ok(p_endpoint) then raise exception 'PUSH_ADRES'; end if;
  if not public.push_key_ok(p_p256dh, 60, 120) or not public.push_key_ok(p_auth, 12, 48) then raise exception 'PUSH_ANAHTAR'; end if;
  delete from public.push_subscriptions where id in (
    select id from public.push_subscriptions where user_id = uid and endpoint <> p_endpoint
    order by updated_at desc offset 9);
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, ua)
  values (uid, p_endpoint, p_p256dh, p_auth, left(p_ua, 200))
  on conflict (endpoint) do update set user_id = uid, p256dh = excluded.p256dh, auth = excluded.auth,
    ua = excluded.ua, fails = 0, updated_at = now();
  return json_build_object('ok', true);
end $$;

create or replace function public.ing_icerik_al(p_tur text, p_alt text default ''::text, p_seviye text default 'B1-B2'::text)
returns table(id uuid, veri jsonb) language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; v_veri jsonb; v_uid uuid := auth.uid();
begin
  if public.misafir_mi() then return; end if;
  if v_uid is null then return; end if;
  select i.id, i.veri into v_id, v_veri
    from ing_icerik i
   where i.tur = p_tur and i.alt = coalesce(p_alt, '') and i.seviye = coalesce(p_seviye, 'B1-B2')
     and not exists (select 1 from ing_gorulen g where g.user_id = v_uid and g.icerik_id = i.id)
   order by random() limit 1;
  if v_id is null then return; end if;
  insert into ing_gorulen (user_id, icerik_id) values (v_uid, v_id) on conflict do nothing;
  update ing_icerik set kullanim = kullanim + 1 where ing_icerik.id = v_id;
  return query select v_id, v_veri;
end $$;
