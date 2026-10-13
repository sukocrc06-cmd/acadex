-- ==========================================================================
-- Acadex: Ayarlar > Tehlikeli bölge > "Hesabımı kalıcı olarak sil"
--
-- Supabase SQL Editor'da bir kez çalıştır. Kullanıcının YALNIZCA KENDİ
-- hesabını silebileceği bir fonksiyon ekler (auth.uid() ile sınırlı).
-- Çalıştırılmazsa silme düğmesi "sunucuda kurulmamış" uyarısı verir ve
-- hiçbir şey silinmez.
--
-- Ne siler: public şemasında user_id sütunu olan tablolardaki o kullanıcıya
-- ait satırlar, profili, depodaki dosya kayıtları ve auth kullanıcısı.
-- ==========================================================================

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth, storage
as $$
declare
  uid uuid := auth.uid();
  t record;
begin
  if uid is null then
    raise exception 'oturum yok';
  end if;

  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'user_id' and tb.table_type = 'BASE TABLE'
  loop
    begin
      execute format('delete from public.%I where user_id = $1', t.table_name) using uid;
    exception when others then
      null; -- bir tablo silinemezse diğerlerine devam et; auth silinince cascade tamamlar
    end;
  end loop;

  begin
    delete from storage.objects where owner = uid;
  exception when others then
    null;
  end;

  delete from public.profiles where id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
