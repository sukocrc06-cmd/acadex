-- ==========================================================================
-- ACADEX — DERS KODUYLA MİSAFİR GİRİŞİ (İstatistik ders yolu)
--
-- NEDEN VAR (11.11.2026, Berkay'ın isteği): hoca derste bir kod veriyor;
-- öğrenciler o kodla hesap açmadan giriyor, DASHBOARD'U GÖRÜYOR ama yalnız
-- İstatistik ders yolunu (labs/istat) KULLANABİLİYOR. Admin panelden kod
-- yönetilir ve "kaç kişi girdi, kaç hafta bitirdi" sayılır.
--
-- MEKANİZMA: Supabase ANONİM oturumu (panelden Authentication → Anonymous
-- sign-ins AÇILMALI). Oturumdaki is_anonymous bayrağı istemcide "misafir
-- modu"nu açar. Kod, anonim oturum AÇILMADAN önce ders_kodu_dogrula ile
-- doğrulanır; oturum açılınca misafir_kaydet kod↔kullanıcı bağını kurar.
--
-- GÜVENLİK SINIRLARI (bilinçli):
--  * Kapalı beta tetikleyicisi (gate_new_auth_user) anonim kullanıcıya
--    istisna tanır; anonim profil access_allowed=false doğar — beta
--    izinleriyle İŞİ YOKTUR, tam hesaba yükseltilirse normal kurallar işler.
--  * Kod doğrulama kaba kuvvete karşı KOD BAŞINA kilitlenir: 20 yanlış
--    denemede 10 dakika (deneme sayacı kodun kendi satırında).
--  * İlerleme verisi 16 KB ile sınırlı; konuk yalnız kendi satırını yazar.
--  * access_allowed bugün yalnız kayıtta denetlendiği için misafir kilidi
--    v1'de istemcidedir; summarize-document ayrıca sunucuda is_anonymous
--    reddeder (ayrı iş). Diğer fonksiyonlar başka sahiplerin alanı.
--
-- Teste bağlı: tests/ders-kodu-misafir.js
-- ==========================================================================

-- 1) Kapalı beta kapısı: anonim kullanıcıya istisna --------------------------
create or replace function public.gate_new_auth_user()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  /* Anonim (misafir) kullanıcı kayıt dondurmasından muaf: e-postası yoktur,
     davet listesine giremez; erişim izni zaten false doğar (aşağıya bakın).
     is_anonymous sütunu Supabase'in anonim girişiyle gelir. */
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;
  if public.registration_frozen()
     and not exists (select 1 from access_invites where email = lower(coalesce(new.email, ''))) then
    raise exception 'ACADEX_KAYIT_KAPALI' using errcode = '42501',
      hint = 'Acadex şu an geliştirme aşamasında; yeni kayıtlar kapalı.';
  end if;
  return new;
end $$;

-- 2) Kodlar ve konuklar ------------------------------------------------------
create table if not exists public.ders_kodlari (
  id           uuid primary key default gen_random_uuid(),
  kod          text not null unique
               check (kod = upper(kod) and kod ~ '^[A-Z0-9]{4,24}$'),
  ders         text not null default 'istat' check (ders in ('istat')),
  not_metni    text not null default '',
  aktif        boolean not null default true,
  son_tarih    date,                                   -- null = süresiz
  hata_sayi    integer not null default 0,             -- kaba kuvvet sayacı
  kilit_bitis  timestamptz,
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null
);

create table if not exists public.ders_konuklari (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  kod_id     uuid not null references public.ders_kodlari(id) on delete cascade,
  rumuz      text not null default '',
  ilerleme   jsonb,                                    -- lab'ın progress mesajı
  giris_sayi integer not null default 1,
  created_at timestamptz not null default now(),
  son_giris  timestamptz not null default now()
);
create index if not exists ders_konuklari_kod on public.ders_konuklari (kod_id);

-- Tablolar dışarıya kapalı; her şey fonksiyonlardan geçer (kids kalıbı).
alter table public.ders_kodlari  enable row level security;
alter table public.ders_konuklari enable row level security;
revoke all on public.ders_kodlari  from anon, authenticated;
revoke all on public.ders_konuklari from anon, authenticated;

-- 3) Kod doğrulama (anon çağırır; oturum açılmadan ÖNCE) ---------------------
create or replace function public.ders_kodu_dogrula(p_kod text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v ders_kodlari%rowtype;
begin
  select * into v from ders_kodlari where kod = upper(trim(coalesce(p_kod, '')));
  if not found then
    return jsonb_build_object('ok', false, 'neden', 'kod');
  end if;
  if v.kilit_bitis is not null and v.kilit_bitis > now() then
    return jsonb_build_object('ok', false, 'neden', 'kilit');
  end if;
  if not v.aktif or (v.son_tarih is not null and v.son_tarih < current_date) then
    /* Pasif/süresi dolmuş kod da deneme sayar — sayaç kodun satırında.
       (Var olmayan kod satırsızdır, sayılamaz; gerçek kaba kuvvet savunması
       kodu 6+ karakter seçmektir — IP bazlı sınırı SQL koyamaz.) */
    update ders_kodlari set
      kilit_bitis = case when hata_sayi + 1 >= 20 then now() + interval '10 minutes' else kilit_bitis end,
      hata_sayi   = case when hata_sayi + 1 >= 20 then 0 else hata_sayi + 1 end
      where id = v.id;
    return jsonb_build_object('ok', false, 'neden', 'pasif');
  end if;
  update ders_kodlari set hata_sayi = 0 where id = v.id;
  return jsonb_build_object('ok', true, 'ders', v.ders);
end $$;

-- 4) Misafir kaydı (anonim oturum AÇILDIKTAN sonra) --------------------------
create or replace function public.misafir_kaydet(p_kod text, p_rumuz text default '')
returns boolean language plpgsql security definer set search_path to 'public' as $$
declare v_kod ders_kodlari%rowtype; v_anon boolean;
begin
  select coalesce(is_anonymous, false) into v_anon from auth.users where id = auth.uid();
  if auth.uid() is null or not v_anon then return false; end if;
  select * into v_kod from ders_kodlari
   where kod = upper(trim(coalesce(p_kod, ''))) and aktif
     and (son_tarih is null or son_tarih >= current_date);
  if not found then return false; end if;
  insert into ders_konuklari (user_id, kod_id, rumuz)
  values (auth.uid(), v_kod.id, left(trim(coalesce(p_rumuz, '')), 40))
  on conflict (user_id) do update
    set giris_sayi = ders_konuklari.giris_sayi + 1, son_giris = now();
  return true;
end $$;

-- 5) İlerleme (lab'ın progress mesajı; 16 KB sınır) --------------------------
create or replace function public.misafir_ilerleme_koy(p_veri jsonb)
returns boolean language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null or length(coalesce(p_veri::text, '')) > 16384 then return false; end if;
  update ders_konuklari set ilerleme = p_veri, son_giris = now() where user_id = auth.uid();
  return found;
end $$;

-- 6) Yönetici RPC'leri (admin paneli "Ders kodları" bölümü) ------------------
create or replace function public.admin_ders_kodlari()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.current_is_admin() then raise exception 'yetki yok' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', k.id, 'kod', k.kod, 'ders', k.ders, 'not', k.not_metni,
      'aktif', k.aktif, 'son_tarih', k.son_tarih, 'created_at', k.created_at,
      'giris', (select count(*) from ders_konuklari g where g.kod_id = k.id),
      'son_giris', (select max(g.son_giris) from ders_konuklari g where g.kod_id = k.id)
    ) order by k.created_at desc) from ders_kodlari k), '[]'::jsonb);
end $$;

create or replace function public.admin_ders_kodu_koy(
  p_kod text, p_not text default '', p_aktif boolean default true, p_son_tarih date default null)
returns boolean language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.current_is_admin() then raise exception 'yetki yok' using errcode = '42501'; end if;
  insert into ders_kodlari (kod, not_metni, aktif, son_tarih, created_by)
  values (upper(trim(p_kod)), coalesce(p_not, ''), coalesce(p_aktif, true), p_son_tarih, auth.uid())
  on conflict (kod) do update
    set not_metni = excluded.not_metni, aktif = excluded.aktif, son_tarih = excluded.son_tarih;
  return true;
end $$;

create or replace function public.admin_ders_konuk_ozet(p_kod_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.current_is_admin() then raise exception 'yetki yok' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'rumuz', g.rumuz, 'giris_sayi', g.giris_sayi, 'son_giris', g.son_giris,
      'ilerleme', g.ilerleme) order by g.son_giris desc)
    from ders_konuklari g where g.kod_id = p_kod_id), '[]'::jsonb);
end $$;

-- Yetkiler: doğrulama anon'a açık (girişten önce), kalanı oturumlu/yönetici.
revoke all on function public.ders_kodu_dogrula(text) from public;
grant execute on function public.ders_kodu_dogrula(text) to anon, authenticated;
revoke all on function public.misafir_kaydet(text, text) from public, anon;
grant execute on function public.misafir_kaydet(text, text) to authenticated;
revoke all on function public.misafir_ilerleme_koy(jsonb) from public, anon;
grant execute on function public.misafir_ilerleme_koy(jsonb) to authenticated;
revoke all on function public.admin_ders_kodlari() from public, anon;
grant execute on function public.admin_ders_kodlari() to authenticated;
revoke all on function public.admin_ders_kodu_koy(text, text, boolean, date) from public, anon;
grant execute on function public.admin_ders_kodu_koy(text, text, boolean, date) to authenticated;
revoke all on function public.admin_ders_konuk_ozet(uuid) from public, anon;
grant execute on function public.admin_ders_konuk_ozet(uuid) to authenticated;
