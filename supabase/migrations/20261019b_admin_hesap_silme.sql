-- Acadex yönetim paneli: öğrenci hesabını kalıcı silme (admin.html → Kullanıcılar → öğrenci → "Hesabı kalıcı sil")
-- Supabase → SQL Editor'e yapıştırıp Run'a bas. Tekrar çalıştırmak zarar vermez.
-- Güvenlik: yalnız yönetici çağırabilir; kendi hesabını ve yönetici hesaplarını silemez;
-- silmeden önce öğrencinin e-postası birebir yazılmalı; işlem denetim kaydına geçer.
create or replace function public.admin_delete_user(p_id uuid, p_confirm_email text)
returns void language plpgsql security definer set search_path to 'public', 'auth', 'storage' as $$
declare em text; nm text; t record; n_docs int; n_cards int;
begin
  perform public.admin_guard();
  if p_id = auth.uid() then raise exception 'Kendi hesabını panelden silemezsin'; end if;
  select email, full_name into em, nm from public.profiles where id = p_id;
  if em is null then select email into em from auth.users where id = p_id; end if;
  if em is null then raise exception 'Kullanıcı bulunamadı'; end if;
  if exists (select 1 from public.profiles where id = p_id and is_admin) then raise exception 'Yönetici hesapları silinemez'; end if;
  if lower(trim(coalesce(p_confirm_email, ''))) <> lower(em) then raise exception 'Onay için yazılan e-posta hesabınkiyle aynı değil'; end if;
  select count(*) into n_docs from public.documents where user_id = p_id;
  select count(*) into n_cards from public.study_cards where user_id = p_id;
  perform public.admin_log('user_delete', p_id, coalesce(nm, em), json_build_object('email', em, 'docs', n_docs, 'cards', n_cards)::jsonb);
  update public.exams set teacher_reviewed_by = null where teacher_reviewed_by = p_id;
  update public.site_settings set updated_by = null where updated_by = p_id;
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'user_id' and tb.table_type = 'BASE TABLE'
  loop
    begin
      execute format('delete from public.%I where user_id = $1', t.table_name) using p_id;
    exception when others then null;
    end;
  end loop;
  begin
    delete from storage.objects where owner = p_id;
  exception when others then null;
  end;
  delete from public.profiles where id = p_id;
  delete from auth.users where id = p_id;
end $$;
