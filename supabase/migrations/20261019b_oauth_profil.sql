-- Google / Apple ile giriş (OAuth): ilk kez gelen kullanıcıda öğrenci no ve bölüm yok.
-- Profil satırı yine de oluşsun: öğrenci no benzersiz olduğu için geçici 'oauth-<id>' konur,
-- bölüm boş kalır. Panelde js/profile-complete.js "profilini tamamla" penceresiyle ikisini ister.
-- (Bu değişiklik Supabase projesine 19.10.2026'da uygulandı: handle_new_user_oauth_friendly.)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, student_number, email, department, full_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'student_number'), ''), 'oauth-' || new.id::text),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'department', ''),
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), nullif(trim(new.raw_user_meta_data->>'name'), ''))
  );
  return new;
end;
$function$;
