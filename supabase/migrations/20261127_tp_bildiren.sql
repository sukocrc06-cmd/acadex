-- ==========================================================================
-- Test Paneli · "Bildiren" (27.11.2026)
-- Sorun: kayıt, o tarayıcıda acadex.com.tr'ye kim girmişse onun adına düşüyordu. Test ekibi
-- aynı cihazı paylaşınca (Şevval, Şükrü'nün tabletinde Kids'i test ediyor) kayıt yanlış kişiye
-- yazılıyordu. Artık Bildir penceresinde "Kim bildiriyor?" seçilir:
--   reporter_email : seçilen ekip üyesi (yalnız tp_members'taki bir e-posta olabilir; değilse
--                    hesabın sahibi yazılır). Panel kaydı bu adla gösterir.
--   author_email   : değişmedi — kaydı gönderen hesap (güvenlik ve "X hesabından" notu için).
-- Bildiren kişi kaydını kendi hesabından da düzenleyip silebilir.
-- Tekrar çalıştırmak zarar vermez.
-- ==========================================================================

alter table public.tp_items add column if not exists reporter_email text;

create or replace function public.tp_items_guard()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare me text := public.tp_my_email();
begin
  if tg_op = 'INSERT' then
    new.author_email := me; new.author_id := auth.uid();
    /* bildiren yalnız ekipten biri olabilir; boş ya da yabancıysa hesabın sahibi */
    new.reporter_email := lower(trim(coalesce(new.reporter_email, '')));
    if new.reporter_email = '' or not exists (select 1 from tp_members m where m.email = new.reporter_email) then
      new.reporter_email := me;
    end if;
    new.status := 'yeni'; new.status_by := null; new.status_at := null;
    new.created_at := now(); new.updated_at := now();
    return new;
  end if;
  new.author_email := old.author_email; new.author_id := old.author_id; new.created_at := old.created_at;
  new.reporter_email := old.reporter_email;
  if old.author_email <> me and coalesce(old.reporter_email, '') <> me and not public.tp_is_owner()
     and (new.kind, new.title, new.page, new.device, new.detail, new.shots)
         is distinct from (old.kind, old.title, old.page, old.device, old.detail, old.shots) then
    raise exception 'Bu kaydı yalnızca yazan kişi düzenleyebilir' using errcode = '42501';
  end if;
  new.updated_at := now();
  if new.status is distinct from old.status then
    new.status_by := me; new.status_at := now();
    insert into tp_history (item_id, actor_email, action, from_status, to_status) values (new.id, me, 'durum', old.status, new.status);
  elsif (new.kind, new.title, new.page, new.device, new.detail, new.shots)
        is distinct from (old.kind, old.title, old.page, old.device, old.detail, old.shots) then
    insert into tp_history (item_id, actor_email, action) values (new.id, me, 'duzenledi');
  end if;
  return new;
end $$;

/* geçmişte "oluşturdu" satırı bildiren kişinin adıyla görünür */
create or replace function public.tp_items_created()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into tp_history (item_id, actor_email, action, to_status) values (new.id, coalesce(new.reporter_email, new.author_email), 'olusturdu', new.status);
  return null;
end $$;

drop policy if exists tp_items_delete on public.tp_items;
create policy tp_items_delete on public.tp_items for delete to authenticated
  using (public.tp_is_member() and (author_email = public.tp_my_email() or reporter_email = public.tp_my_email() or public.tp_is_owner()));

-- kontrol
select (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'tp_items' and column_name = 'reporter_email') as bildiren_kolonu,
       (select count(*) from public.tp_members) as ekip;
