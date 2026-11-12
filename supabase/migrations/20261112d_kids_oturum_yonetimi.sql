-- ==========================================================================
-- ACADEX KIDS — ÖĞRETMEN KİLİDİ + SINIF OTURUMLARINI KAPATMA (12.11.2026)
-- Önce 20261110b_kids_giris.sql ve 20261112c çalışmış olmalı.
-- Tekrar çalıştırmak güvenlidir.
--
-- 1) ÖĞRETMEN ŞİFRE KİLİDİ KATLANIR: şifre 6 haneli rakam (1.000.000 ihtimal),
--    5 yanlışta 15 dk kilit vardı ama sayaç her kilitten sonra sıfırlanıyordu.
--    Pratikte kırılamaz ama çocuk kilidiyle aynı kalıp uygulanır:
--    15, 30, 60 … en çok 1440 dk; doğru girişte sıfırlanır.
--
-- 2) SINIF OTURUMLARINI KAPATMA: çocuk oturumu 90 gün açık kalır (her gün
--    şifre sorulmasın diye). Paylaşımlı tablet elden ele geçtiğinde öğretmenin
--    bunu sıfırlayacak bir yolu yoktu. kids_sinif_oturum_kapat yalnız
--    öğretmenin KENDİ okulundaki bir sınıfın ÇOCUK oturumlarını siler;
--    öğretmenin kendi oturumuna ve başka sınıflara dokunmaz. Veri silinmez,
--    çocuk resimli şifresiyle yeniden girer ve ilerlemesi yerinde durur.
--
-- Teste bağlı: tests/kids-giris.js
-- ==========================================================================

-- 1) KATLANAN ÖĞRETMEN KİLİDİ ----------------------------------------------
alter table public.kids_okullar add column if not exists sifre_kilit_say integer not null default 0;

create or replace function public.kids_ogretmen_giris(p_kod text, p_sifre text)
returns json language plpgsql volatile security definer set search_path = public, extensions as $$
declare o kids_okullar; v_kilit boolean;
begin
  select * into o from kids_okullar where kod = upper(trim(coalesce(p_kod, ''))) for update;
  if o.id is null or o.sifre_ozet is null then return json_build_object('tamam', false); end if;
  if not public.kids_okul_acik(o.id) then raise exception 'Okulunuzun Acadex Kids lisansı açık değil.' using errcode = '28000', hint = 'lisans'; end if;
  if o.sifre_kilit > now() then raise exception 'Çok fazla hatalı deneme. Biraz sonra yeniden deneyin.' using errcode = '28000', hint = 'kilit'; end if;
  if extensions.crypt(coalesce(p_sifre, ''), o.sifre_ozet) <> o.sifre_ozet then
    v_kilit := o.sifre_hata + 1 >= 5;
    update kids_okullar set
      sifre_hata = case when v_kilit then 0 else sifre_hata + 1 end,
      sifre_kilit = case when v_kilit then now() + make_interval(mins => least(15 * power(2, sifre_kilit_say)::int, 1440)) else sifre_kilit end,
      sifre_kilit_say = case when v_kilit then least(sifre_kilit_say + 1, 7) else sifre_kilit_say end
    where id = o.id;
    return json_build_object('tamam', false);
  end if;
  update kids_okullar set sifre_hata = 0, sifre_kilit = null, sifre_kilit_say = 0 where id = o.id;
  return json_build_object('tamam', true, 'token', public.kids_oturum_ac('ogretmen', o.id, null, 14));
end $$;

-- 2) SINIF OTURUMLARINI KAPATMA ---------------------------------------------
create or replace function public.kids_sinif_oturum_kapat(p_token text, p_sinif uuid)
returns integer language plpgsql volatile security definer set search_path = public as $$
declare o kids_oturumlar := public.kids_oturum(p_token, 'ogretmen'); n integer;
begin
  if not exists (select 1 from kids_siniflar where id = p_sinif and okul_id = o.okul_id) then
    raise exception 'Bu sınıf okulunuza ait değil.' using errcode = '42501';
  end if;
  delete from kids_oturumlar k
   where k.tur = 'cocuk'
     and k.ogrenci_id in (select g.id from kids_ogrenciler g where g.sinif_id = p_sinif);
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.kids_ogretmen_giris(text, text) from public;
grant execute on function public.kids_ogretmen_giris(text, text) to anon, authenticated;
revoke all on function public.kids_sinif_oturum_kapat(text, uuid) from public;
grant execute on function public.kids_sinif_oturum_kapat(text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
