-- ==========================================================================
-- ACADEX SUNUM — #58 Phase 12.3: SÜRÜMLER + İNCELEME (gerçek zamanlı değil)
-- (28.11.2026)
--
-- Roller: sahip (presentations.user_id) · düzenleyici (editor) · inceleyici
-- (reviewer). Rol HER ZAMAN sunucuda sunum_rol() ile hesaplanır; istemcinin
-- söylediği rol hiçbir yerde kullanılmaz. İnceleyici öğretmen değildir: yalnız
-- okuyup yorum bırakan herhangi bir hesap (ürün kuralı: insan öğretmen yok).
--
-- * presentation_versions (zaten vardı, kullanılmıyordu): ad, açıklama, imza,
--   oluşturan sütunları eklenir; düzenleyici de okuyup sürüm ekleyebilir.
-- * presentation_review_links: sürüme bağlı, süreli (≤30 gün), geri alınabilir
--   bağlantı. Belirtecin KENDİSİ saklanmaz, yalnız sha256 özeti; belirteç tek
--   kez, oluşturulurken döner.
-- * presentation_members: bağlantıyı açan hesap. Bağlantı geri alınınca ya da
--   süresi dolunca üyelik geçersizdir (sunum_rol bağlantıyı da sınar), geri
--   almada satır silinir — erişim gerçekten kesilir.
-- * presentation_comments: deste / asetat / öğe yorumu. Yorum metne dokunmaz
--   (ayrı tablo). Çözme yalnız comment_resolve ile, sahip ve düzenleyici.
-- * İnceleyici tabloya erişmez: sürüm görüntüsünü review_open döndürür,
--   konuşmacı notları ve hedef kitle profili ÇIKARILMIŞ olarak (bağlantıda
--   açıkça "notlar dahil" seçilmediyse). share_snapshot / get_shared_presentation
--   değişmez.
-- * Sahip dışındaki biri presentations satırında user_id, share_token,
--   share_snapshot, shared_at alanlarını değiştiremez (tetikleyici eski değeri
--   korur); düzenleyici sunumu silemez, paylaşamaz.
-- * Misafir (anonim JWT) hiçbirini yapamaz: 20261111c deseni + RPC içi denetim.
--
-- Elle çalıştırılır (Supabase SQL Editor), 20261128_sunum_marka_kiti.sql'den
-- sonra. pgcrypto Supabase'de "extensions" şemasındadır.
-- Test: tests/sunum-surum-isbirligi.js (PGLITE_DIR ile gerçek Postgres + RLS).
-- ==========================================================================

-- ---------- sürümler ----------
alter table public.presentation_versions add column if not exists name text not null default '' check (char_length(name) <= 80);
alter table public.presentation_versions add column if not exists description text not null default '' check (char_length(description) <= 300);
alter table public.presentation_versions add column if not exists signature text not null default '' check (char_length(signature) <= 80);
alter table public.presentation_versions add column if not exists created_by uuid default auth.uid();
create index if not exists presentation_versions_sunum_idx on public.presentation_versions (presentation_id, version_no desc);

-- ---------- üyelik + bağlantı + yorum ----------
create table if not exists public.presentation_review_links (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.presentations(id) on delete cascade,
  version_id uuid references public.presentation_versions(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  role text not null check (role in ('reviewer', 'editor')),
  notlar boolean not null default false,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  check (expires_at > created_at and expires_at <= created_at + interval '30 days'),
  check (role = 'editor' or version_id is not null)
);
create index if not exists presentation_review_links_sunum_idx on public.presentation_review_links (presentation_id);

create table if not exists public.presentation_members (
  presentation_id uuid not null references public.presentations(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('editor', 'reviewer')),
  link_id uuid references public.presentation_review_links(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (presentation_id, user_id)
);
create index if not exists presentation_members_user_idx on public.presentation_members (user_id);

create table if not exists public.presentation_comments (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.presentations(id) on delete cascade,
  version_id uuid references public.presentation_versions(id) on delete set null,
  scope text not null check (scope in ('deck', 'slide', 'element')),
  slide_id text check (slide_id is null or slide_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  element_id text check (element_id is null or element_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  parent_id uuid references public.presentation_comments(id) on delete cascade,
  author_id uuid not null default auth.uid(),
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz not null default now(),
  check ((scope = 'deck' and slide_id is null and element_id is null) or (scope = 'slide' and slide_id is not null and element_id is null) or (scope = 'element' and slide_id is not null and element_id is not null))
);
create index if not exists presentation_comments_sunum_idx on public.presentation_comments (presentation_id, created_at);

-- ---------- rol: tek doğruluk kaynağı ----------
create or replace function public.sunum_rol(p uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null or public.misafir_mi() then null
    when exists (select 1 from public.presentations x where x.id = p and x.user_id = auth.uid()) then 'owner'
    else (select m.role from public.presentation_members m
            left join public.presentation_review_links l on l.id = m.link_id
           where m.presentation_id = p and m.user_id = auth.uid()
             and (m.link_id is null or (l.revoked_at is null and l.expires_at > now()))
           limit 1)
  end
$$;
revoke all on function public.sunum_rol(uuid) from public, anon;
grant execute on function public.sunum_rol(uuid) to authenticated;

-- ---------- düzenleyici: sunum + asetat + sürüm ----------
drop policy if exists presentations_select_editor on public.presentations;
create policy presentations_select_editor on public.presentations for select to authenticated using (public.sunum_rol(id) = 'editor');
drop policy if exists presentations_update_editor on public.presentations;
create policy presentations_update_editor on public.presentations for update to authenticated
  using (public.sunum_rol(id) = 'editor') with check (public.sunum_rol(id) = 'editor');

drop policy if exists presentation_slides_editor on public.presentation_slides;
create policy presentation_slides_editor on public.presentation_slides for all to authenticated
  using (public.sunum_rol(presentation_id) = 'editor') with check (public.sunum_rol(presentation_id) = 'editor');

drop policy if exists presentation_versions_editor_select on public.presentation_versions;
create policy presentation_versions_editor_select on public.presentation_versions for select to authenticated using (public.sunum_rol(presentation_id) = 'editor');
drop policy if exists presentation_versions_editor_insert on public.presentation_versions;
create policy presentation_versions_editor_insert on public.presentation_versions for insert to authenticated
  with check (public.sunum_rol(presentation_id) = 'editor' and created_by = auth.uid());

-- sahip dışındaki biri sahipliği ve paylaşımı değiştiremez
create or replace function public.presentations_koru()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and old.user_id is distinct from auth.uid() then
    new.user_id := old.user_id; new.share_token := old.share_token;
    new.share_snapshot := old.share_snapshot; new.shared_at := old.shared_at;
  end if;
  return new;
end $$;
drop trigger if exists presentations_koru on public.presentations;
create trigger presentations_koru before update on public.presentations
  for each row execute function public.presentations_koru();

-- ---------- RLS: yeni tablolar ----------
alter table public.presentation_review_links enable row level security;
alter table public.presentation_members enable row level security;
alter table public.presentation_comments enable row level security;

drop policy if exists review_links_sahip_okur on public.presentation_review_links;
create policy review_links_sahip_okur on public.presentation_review_links for select to authenticated using (public.sunum_rol(presentation_id) = 'owner');
-- ekleme/geri alma yalnız RPC ile (yazma politikası yok)

drop policy if exists members_okur on public.presentation_members;
create policy members_okur on public.presentation_members for select to authenticated
  using (user_id = auth.uid() or public.sunum_rol(presentation_id) = 'owner');
drop policy if exists members_sahip_siler on public.presentation_members;
create policy members_sahip_siler on public.presentation_members for delete to authenticated using (public.sunum_rol(presentation_id) = 'owner');

drop policy if exists comments_okur on public.presentation_comments;
create policy comments_okur on public.presentation_comments for select to authenticated using (public.sunum_rol(presentation_id) is not null);
drop policy if exists comments_ekler on public.presentation_comments;
create policy comments_ekler on public.presentation_comments for insert to authenticated
  with check (public.sunum_rol(presentation_id) is not null and author_id = auth.uid() and resolved_at is null and resolved_by is null);
drop policy if exists comments_siler on public.presentation_comments;
create policy comments_siler on public.presentation_comments for delete to authenticated
  using (author_id = auth.uid() or public.sunum_rol(presentation_id) = 'owner');
-- güncelleme politikası yok: yorum metni değişmez, çözme comment_resolve ile

-- yanıt aynı sunumdaki yoruma bağlanır
create or replace function public.presentation_comments_ust()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.parent_id is not null and not exists (select 1 from public.presentation_comments c where c.id = new.parent_id and c.presentation_id = new.presentation_id) then
    raise exception 'yorum: ust yorum baska sunumda' using errcode = 'check_violation';
  end if;
  if new.version_id is not null and not exists (select 1 from public.presentation_versions v where v.id = new.version_id and v.presentation_id = new.presentation_id) then
    raise exception 'yorum: surum baska sunumda' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists presentation_comments_ust on public.presentation_comments;
create trigger presentation_comments_ust before insert on public.presentation_comments
  for each row execute function public.presentation_comments_ust();

do $$
declare t text;
begin
  foreach t in array array['presentation_review_links', 'presentation_members', 'presentation_comments'] loop
    execute format('drop policy if exists zz_misafir_ekleyemez on public.%I', t);
    execute format('create policy zz_misafir_ekleyemez on public.%I as restrictive for insert to authenticated with check (not public.misafir_mi())', t);
    execute format('drop policy if exists zz_misafir_degistiremez on public.%I', t);
    execute format('create policy zz_misafir_degistiremez on public.%I as restrictive for update to authenticated using (not public.misafir_mi())', t);
    execute format('drop policy if exists zz_misafir_silemez on public.%I', t);
    execute format('create policy zz_misafir_silemez on public.%I as restrictive for delete to authenticated using (not public.misafir_mi())', t);
  end loop;
end $$;

revoke all on public.presentation_review_links, public.presentation_members, public.presentation_comments from anon;
grant select on public.presentation_review_links to authenticated;
grant select, delete on public.presentation_members to authenticated;
grant select, insert, delete on public.presentation_comments to authenticated;

-- ---------- RPC: bağlantı oluştur (belirteç yalnız burada, bir kez döner) ----------
create or replace function public.review_link_create(p_presentation uuid, p_role text, p_version uuid, p_days integer, p_notlar boolean default false)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_token text; v_id uuid; v_exp timestamptz;
begin
  if public.sunum_rol(p_presentation) is distinct from 'owner' then raise exception 'yetki' using errcode = '42501'; end if;
  if p_role not in ('reviewer', 'editor') or p_days is null or p_days < 1 or p_days > 30 then raise exception 'gecersiz' using errcode = '22023'; end if;
  if p_version is not null and not exists (select 1 from public.presentation_versions v where v.id = p_version and v.presentation_id = p_presentation) then raise exception 'gecersiz' using errcode = '22023'; end if;
  if p_role = 'reviewer' and p_version is null then raise exception 'gecersiz' using errcode = '22023'; end if;
  v_token := encode(gen_random_bytes(24), 'hex'); v_exp := now() + make_interval(days => p_days);
  insert into public.presentation_review_links (presentation_id, version_id, token_hash, role, notlar, expires_at)
  values (p_presentation, p_version, encode(digest(v_token, 'sha256'), 'hex'), p_role, coalesce(p_notlar, false), v_exp)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'token', v_token, 'expires_at', v_exp);
end $$;

-- ---------- RPC: bağlantıyı geri al (üyelikler silinir → erişim kesilir) ----------
create or replace function public.review_link_revoke(p_link uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_p uuid;
begin
  select presentation_id into v_p from public.presentation_review_links where id = p_link;
  if v_p is null or public.sunum_rol(v_p) is distinct from 'owner' then raise exception 'yetki' using errcode = '42501'; end if;
  update public.presentation_review_links set revoked_at = coalesce(revoked_at, now()) where id = p_link;
  delete from public.presentation_members where link_id = p_link;
  return true;
end $$;

-- ---------- RPC: bağlantıyı aç (oturum açmış, misafir olmayan hesap) ----------
create or replace function public.review_open(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare l public.presentation_review_links%rowtype; v public.presentation_versions%rowtype; v_rol text; v_snap jsonb; v_title text;
begin
  if auth.uid() is null or public.misafir_mi() then raise exception 'oturum' using errcode = '42501'; end if;
  if p_token is null or p_token !~ '^[0-9a-f]{48}$' then raise exception 'gecersiz' using errcode = '22023'; end if;
  select * into l from public.presentation_review_links where token_hash = encode(digest(p_token, 'sha256'), 'hex');
  -- bulunamadı / geri alındı / süresi doldu: aynı yanıt (hangisi olduğu sızmaz)
  if l.id is null or l.revoked_at is not null or l.expires_at <= now() then raise exception 'gecersiz' using errcode = '22023'; end if;
  if exists (select 1 from public.presentations x where x.id = l.presentation_id and x.user_id = auth.uid()) then v_rol := 'owner';
  else
    insert into public.presentation_members (presentation_id, user_id, role, link_id) values (l.presentation_id, auth.uid(), l.role, l.id)
    on conflict (presentation_id, user_id) do update
      set role = case when presentation_members.role = 'editor' and excluded.role = 'reviewer' then presentation_members.role else excluded.role end,
          link_id = case when presentation_members.role = 'editor' and excluded.role = 'reviewer' then presentation_members.link_id else excluded.link_id end;
    v_rol := public.sunum_rol(l.presentation_id);
  end if;
  select title into v_title from public.presentations where id = l.presentation_id;
  if l.version_id is not null then
    select * into v from public.presentation_versions where id = l.version_id;
    v_snap := v.snapshot #- '{deste,kitle}';
    -- marka logoları (öğede mrk) yalnız sahip destede paylaşıma izin verdiyse görüntüye girer
    if coalesce(v_snap->'deste'->'marka'->>'paylas', '') not in ('true', '1') then
      v_snap := jsonb_set(v_snap, '{deste,slides}', coalesce((select jsonb_agg(case when jsonb_typeof(s.value->'els') = 'array' then jsonb_set(s.value, '{els}', coalesce((select jsonb_agg(e.value order by e.ordinality) from jsonb_array_elements(s.value->'els') with ordinality e where not (e.value ? 'mrk')), '[]'::jsonb)) else s.value end order by s.ordinality) from jsonb_array_elements(v_snap->'deste'->'slides') with ordinality s), '[]'::jsonb));
    end if;
    if not l.notlar then
      v_snap := jsonb_set(v_snap, '{deste,slides}', coalesce((select jsonb_agg(s.value - 'notes' order by s.ordinality) from jsonb_array_elements(v_snap->'deste'->'slides') with ordinality s), '[]'::jsonb));
    end if;
  end if;
  return jsonb_build_object('presentation_id', l.presentation_id, 'role', v_rol, 'link_role', l.role, 'title', v_title, 'expires_at', l.expires_at, 'notlar', l.notlar,
    'version', case when v.id is null then null else jsonb_build_object('id', v.id, 'version_no', v.version_no, 'name', v.name, 'created_at', v.created_at, 'signature', v.signature, 'snapshot', v_snap) end);
end $$;

-- ---------- RPC: yorumu çöz / yeniden aç (sahip, düzenleyici) ----------
create or replace function public.comment_resolve(p_id uuid, p_cozuldu boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_p uuid;
begin
  select presentation_id into v_p from public.presentation_comments where id = p_id;
  if v_p is null or coalesce(public.sunum_rol(v_p), '') not in ('owner', 'editor') then raise exception 'yetki' using errcode = '42501'; end if;
  update public.presentation_comments set resolved_at = case when p_cozuldu then now() else null end, resolved_by = case when p_cozuldu then auth.uid() else null end where id = p_id;
  return true;
end $$;

revoke all on function public.review_link_create(uuid, text, uuid, integer, boolean) from public, anon;
revoke all on function public.review_link_revoke(uuid) from public, anon;
revoke all on function public.review_open(text) from public, anon;
revoke all on function public.comment_resolve(uuid, boolean) from public, anon;
grant execute on function public.review_link_create(uuid, text, uuid, integer, boolean) to authenticated;
grant execute on function public.review_link_revoke(uuid) to authenticated;
grant execute on function public.review_open(text) to authenticated;
grant execute on function public.comment_resolve(uuid, boolean) to authenticated;
