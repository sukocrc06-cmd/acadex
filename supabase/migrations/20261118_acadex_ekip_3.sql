-- ==========================================================================
-- Acadex ekibi · 3. adım (18.11.2026) — çatı birim
-- Bir birim başka bir birimin altında durabilir (ör. "Marka ve Pazarlama" çatısı altında
-- Tasarım, Pazarlama, Digital Marketing). Şemada çatı geniş bir kutu olur, alt birimler
-- içinde yan yana durur. Tek kademe: çatının kendisi başka bir çatının altına giremez.
-- YALNIZ YAPI: bu dosyada kişi/ekip verisi yoktur (belge gizli; veri SQL Editor'de girilir).
-- Güvenlik: mevcut politikalar geçerli (yalnız admin_ok okur/yazar).
-- Tekrar çalıştırmak zarar vermez. 20261029c_acadex_ekip_2.sql'den SONRA çalıştır.
-- ==========================================================================

alter table public.ax_teams add column if not exists parent_id uuid references public.ax_teams(id) on delete set null;
create index if not exists ax_teams_parent_idx on public.ax_teams (parent_id);
alter table public.ax_teams drop constraint if exists ax_teams_parent_self_check;
alter table public.ax_teams add constraint ax_teams_parent_self_check check (parent_id is null or parent_id <> id);

-- tek kademe; yönetim ve danışma kutuları çatı olamaz, altına da girmez
create or replace function public.ax_teams_parent_guard() returns trigger language plpgsql set search_path = public as $$
declare up ax_teams;
begin
  if new.parent_id is null then return new; end if;
  if new.is_board or new.is_advisory then raise exception 'Yönetim ve danışma bir çatının altına alınamaz.'; end if;
  select * into up from ax_teams where id = new.parent_id;
  if up.id is null then raise exception 'Çatı birim bulunamadı.'; end if;
  if up.parent_id is not null then raise exception 'Çatı birimin kendisi başka bir çatının altında; tek kademe olabilir.'; end if;
  if up.is_board or up.is_advisory then raise exception 'Yönetim ve danışma çatı olamaz.'; end if;
  if exists (select 1 from ax_teams where parent_id = new.id) then raise exception 'Bu birimin altında birimler var; önce onları çıkarın.'; end if;
  return new;
end $$;
drop trigger if exists ax_teams_parent_guard on public.ax_teams;
create trigger ax_teams_parent_guard before insert or update of parent_id, is_board, is_advisory on public.ax_teams
  for each row execute function public.ax_teams_parent_guard();

notify pgrst, 'reload schema';
