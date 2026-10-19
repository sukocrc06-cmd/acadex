-- Acadex Sunum: salt-okunur paylaşım bağlantısı
-- Sahibi sunumu paylaşınca share_token (tahmin edilemez, 32 karakter) ve
-- share_snapshot (asetatların görüntülenecek kopyası, konuşmacı notu YOK) yazar.
-- Bağlantıyı bilen herkes yalnızca get_shared_presentation(token) ile o kopyayı okur.
-- Tablo okuma kuralları (RLS) değişmez.
alter table public.presentations
  add column if not exists share_token text,
  add column if not exists share_snapshot jsonb,
  add column if not exists shared_at timestamptz;

create unique index if not exists presentations_share_token_key
  on public.presentations (share_token) where share_token is not null;

alter table public.presentations
  drop constraint if exists presentations_share_token_len;
alter table public.presentations
  add constraint presentations_share_token_len
  check (share_token is null or share_token ~ '^[A-Za-z0-9_-]{24,64}$') not valid;

create or replace function public.get_shared_presentation(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'title', p.title,
    'language', p.language,
    'shared_at', p.shared_at,
    'slides', coalesce(p.share_snapshot -> 'slides', '[]'::jsonb)
  )
  from public.presentations p
  where p_token ~ '^[A-Za-z0-9_-]{24,64}$'
    and p.share_token = p_token
    and p.share_snapshot is not null
  limit 1;
$$;

revoke all on function public.get_shared_presentation(text) from public;
grant execute on function public.get_shared_presentation(text) to anon, authenticated;
