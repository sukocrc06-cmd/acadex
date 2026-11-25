-- ==========================================================================
-- Acadex Görev (21.11.2026) — yönetim paneli → "Acadex Görev"
-- Birimlere iş görevi: başlık, açıklama, birim (ax_teams), isteğe bağlı kişi (ax_people),
-- teslim tarihi, durum, öncelik, bağlantı (ör. kreş araştırması Excel'i), not.
-- İlk tohum: Acadex Kids lansmanı (son teslim 10 Aralık 2026) için Test, Tasarım,
-- Pazarlama, Digital Marketing, Finans ve İş Modeli, Ürün ve Yazılım görevleri.
-- Yetki: yönetici (admin_ok) her şeyi yapar. Finans rolü hepsini okur, yalnız
-- Finans ve İş Modeli biriminin görevlerinde durum/not/bağlantı değiştirir.
-- 20261024e / 20261029c / 20261118 ekip dosyalarından SONRA çalıştır.
-- Tekrar çalıştırmak zarar vermez (tohum "kod" ile bir kez eklenir).
-- ==========================================================================

create table if not exists public.ax_gorev (
  id         uuid primary key default gen_random_uuid(),
  kod        text unique,                                   -- tohum görevlerinin sabit adı
  proje      text not null default 'kids',                  -- kids | acadex | genel
  baslik     text not null,
  aciklama   text not null default '',
  team_id    uuid references public.ax_teams(id) on delete set null,
  kisi_id    uuid references public.ax_people(id) on delete set null,
  teslim     date,
  durum      text not null default 'yapilacak',
  oncelik    text not null default 'orta',
  baglanti   text not null default '',
  notlar     text not null default '',
  sira       int not null default 100,
  bitti_at   timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ax_gorev_team_ix on public.ax_gorev (team_id, teslim);

alter table public.ax_gorev drop constraint if exists ax_gorev_kontrol;
alter table public.ax_gorev add constraint ax_gorev_kontrol check (
  char_length(trim(baslik)) between 3 and 160 and char_length(aciklama) <= 3000
  and char_length(notlar) <= 3000 and char_length(baglanti) <= 500
  and (baglanti = '' or baglanti ~* '^https://')
  and proje in ('kids', 'acadex', 'genel')
  and durum in ('yapilacak', 'suruyor', 'incelemede', 'bitti')
  and oncelik in ('yuksek', 'orta', 'dusuk'));

create or replace function public.ax_gorev_dokun() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.durum = 'bitti' and (tg_op = 'INSERT' or old.durum is distinct from 'bitti') then new.bitti_at := now(); end if;
  if new.durum <> 'bitti' then new.bitti_at := null; end if;
  /* finans rolü yalnız durum, not ve bağlantıyı değiştirebilir */
  if tg_op = 'UPDATE' and not public.current_is_admin() then
    if new.baslik is distinct from old.baslik or new.aciklama is distinct from old.aciklama or new.team_id is distinct from old.team_id
       or new.kisi_id is distinct from old.kisi_id or new.teslim is distinct from old.teslim or new.oncelik is distinct from old.oncelik
       or new.proje is distinct from old.proje or new.sira is distinct from old.sira or new.kod is distinct from old.kod then
      raise exception 'Finans rolü yalnız durum, not ve bağlantıyı değiştirebilir.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists ax_gorev_dokun on public.ax_gorev;
create trigger ax_gorev_dokun before insert or update on public.ax_gorev for each row execute function public.ax_gorev_dokun();

alter table public.ax_gorev enable row level security;
drop policy if exists ax_gorev_admin on public.ax_gorev;
create policy ax_gorev_admin on public.ax_gorev for all to authenticated using (public.admin_ok()) with check (public.admin_ok());
drop policy if exists ax_gorev_fin_oku on public.ax_gorev;
create policy ax_gorev_fin_oku on public.ax_gorev for select to authenticated using (public.current_is_finance());
drop policy if exists ax_gorev_fin_yaz on public.ax_gorev;
create policy ax_gorev_fin_yaz on public.ax_gorev for update to authenticated
  using (public.current_is_finance() and team_id in (select id from public.ax_teams where name = 'Finans ve İş Modeli'))
  with check (public.current_is_finance() and team_id in (select id from public.ax_teams where name = 'Finans ve İş Modeli'));
revoke all on public.ax_gorev from anon;
grant select, insert, update, delete on public.ax_gorev to authenticated;

-- ---------- tohum: Acadex Kids lansmanı (son teslim 10.12.2026) ----------
insert into public.ax_gorev (kod, proje, team_id, baslik, aciklama, teslim, oncelik, sira)
select v.kod, 'kids', t.id, v.baslik, v.aciklama, v.teslim::date, v.oncelik, v.sira
from (values
  -- TEST BİRİMİ: bulguların hepsi Kids'teki "Bildir" düğmesiyle Test paneline
  ('kids-test-1', 'Test Birimi', 'Kids test planı ve cihaz listesi', 'Kim hangi cihazda test ediyor: iPhone, Android telefon, tablet, bilgisayar (Chrome, Safari, Edge). Üç yaş grubu (3-5, 5-7, 7-10) için senaryo listesi. Plan dosyasının bağlantısını buraya ekleyin.', '2026-11-24', 'yuksek', 10),
  ('kids-test-2', 'Test Birimi', 'Giriş akışı testi', 'Okul kodu ve QR ile giriş, "Sen hangisisin?" ekranı, iki gizli resim, veli kartı. Yanlış resim, unutulan kod, aynı cihazda iki çocuk durumlarını deneyin.', '2026-11-27', 'yuksek', 20),
  ('kids-test-3', 'Test Birimi', '22 konu gezegeninin hepsi', 'Her konuda İzle, Şarkı, Oyunlar ve Söyle durakları; konudan çıkıp haritaya dönüş; kelime resimleri ve animasyonlar; Kelimelerim ve Dolabım.', '2026-12-02', 'yuksek', 30),
  ('kids-test-4', 'Test Birimi', 'Ses ve mikrofon testi', 'Mikrofon izni, Söyle durağı, sesli komutlar, masallarda "senin sıran" anı. Telefon, tablet ve bilgisayarda; sessiz ve gürültülü ortamda; çocuk sesiyle deneyin.', '2026-12-04', 'yuksek', 40),
  ('kids-test-5', 'Test Birimi', 'Tanıtım sayfası (uzay yolculuğu)', 'acadex.com.tr/kids tanıtım sayfası: masaüstü ve telefonda kaydırma animasyonları, balonlar, giriş kartı, teklif formu. Telefonda "hareketi azalt" açıkken de bakın.', '2026-12-05', 'orta', 50),
  ('kids-test-6', 'Test Birimi', 'Zayıf internet ve çevrimdışı', 'Yavaş bağlantıda açılış süresi, internet kesilince uygulamanın davranışı, sayfa yenileme, uzun kullanımda ısınma ve pil.', '2026-12-06', 'orta', 60),
  ('kids-test-7', 'Test Birimi', 'Doğrulama turu ve son test raporu', 'Düzeltilen bildirimleri tekrar deneyip kapatın. Açık kalan hataları önem sırasıyla listeleyen kısa son raporu Yönetim''e verin.', '2026-12-10', 'yuksek', 70),
  -- TASARIM (2 kişi)
  ('kids-tas-1', 'Tasarım', 'Kids Instagram görsel dili ve şablonlar', 'Post (1080×1350) ve story (1080×1920) şablonları; Kids renkleri, yazı tipleri, Acadia ve gezegen görselleri. Şablon dosyasının bağlantısını ekleyin.', '2026-11-26', 'yuksek', 10),
  ('kids-tas-2', 'Tasarım', 'Kreş panosu için tanıtım posteri (A3)', 'Velilere yönelik poster: "Okulda öğrendi, evde oynayarak pekiştiriyor" mesajı, QR kod (acadex.com.tr/kids), kreşin adını yazacak boş alan.', '2026-12-01', 'yuksek', 20),
  ('kids-tas-3', 'Tasarım', 'Broşürler: veli (A5) ve kreş yöneticisi (A4 üç kırım)', 'Veli broşürü: ne işe yarar, nasıl girilir, güvenlik (reklam yok). Yönetici broşürü: okul ve sınıf kurulumu, öğretmen paneli, teklif adımları. Metinleri Pazarlama ile netleştirin.', '2026-12-03', 'orta', 30),
  ('kids-tas-4', 'Tasarım', 'Lansman serisi: 9 gönderi + 6 story', 'Digital Marketing''in içerik takvimine göre ilk 9 gönderi ve 6 story. Ekran görüntüleri ve kısa animasyonlu kareler.', '2026-12-05', 'orta', 40),
  ('kids-tas-5', 'Tasarım', 'Reels / kısa tanıtım videosu (15-30 sn)', 'Uygulama ekran kaydı ve animasyonla kısa video: gezegene uçuş, kelimeyi söyleme, "Aferin!" anı.', '2026-12-08', 'orta', 50),
  ('kids-tas-6', 'Tasarım', 'Baskıya hazır dosyalar ve teslim', 'Poster ve broşürlerin baskı PDF''leri (taşma payı, CMYK). Pazarlama''ya ve baskı maliyeti için Finans''a iletin.', '2026-12-10', 'yuksek', 60),
  -- PAZARLAMA: kreş araştırması
  ('kids-paz-1', 'Pazarlama', 'Kreş araştırması Excel''i (en az 100 kreş)', 'Hedef ilçelerdeki kreş ve anaokulları. Sütunlar: ad, ilçe, tür (özel / resmî), yaş grubu, tahmini öğrenci sayısı, telefon, e-posta, web / Instagram, yetkili, aylık ücret bandı, not. Excel bağlantısını bu göreve ekleyin.', '2026-11-28', 'yuksek', 10),
  ('kids-paz-2', 'Pazarlama', 'Kreş verisini Finans birimine bildir', 'Excel''i Finans ve İş Modeli birimine iletin: kreş sayıları, öğrenci sayıları ve ücret bantları pazar büyüklüğü ve fiyat hesabına girecek.', '2026-11-29', 'yuksek', 20),
  ('kids-paz-3', 'Pazarlama', 'Önceliklendirme ve ilk 30 kreş listesi', 'Kreşleri A/B/C diye sıralayın (ulaşılabilirlik, büyüklük, ücret bandı). İlk 30 kreş için arama / ziyaret listesi.', '2026-12-01', 'orta', 30),
  ('kids-paz-4', 'Pazarlama', 'Kreş sunumu ve görüşme metni', 'Kreş yöneticisine 5 dakikalık anlatım ve sık sorulan sorular. Tasarım''ın broşürüyle birlikte kullanılacak.', '2026-12-03', 'orta', 40),
  ('kids-paz-5', 'Pazarlama', 'İlk temaslar: 30 kreş', 'Arama ve ziyaret sonuçlarını Excel''e işleyin. İlgilenen kreşlerin "teklif al" formunu doldurmasını sağlayın (Kids → İstekler''e düşer).', '2026-12-09', 'yuksek', 50),
  ('kids-paz-6', 'Pazarlama', 'Pilot kreş: en az 3 deneme sözü', 'Aralık sonuna kadar Kids''i denemeyi kabul eden en az 3 kreş. Yetkili, sınıf sayısı ve başlama tarihini not edin.', '2026-12-10', 'yuksek', 60),
  -- DIGITAL MARKETING
  ('kids-dm-1', 'Digital Marketing', 'Kids Instagram hesabı kurulumu', 'Hesap adı, biyografi, profil görseli, bağlantı (acadex.com.tr/kids), öne çıkanlar (Nasıl çalışır, Veliler, Kreşler).', '2026-11-26', 'yuksek', 10),
  ('kids-dm-2', 'Digital Marketing', 'Aralık içerik takvimi', 'Haftada 3 gönderi ve günlük story planı; hangi gün hangi görsel. Takvimi Tasarım ile paylaşın, bağlantısını ekleyin.', '2026-11-28', 'yuksek', 20),
  ('kids-dm-3', 'Digital Marketing', 'Hedef kitle, hashtag ve konum araştırması', 'İki kitle: veliler ve kreş yöneticileri. Hedef ilçelerin konum etiketleri, veli grupları ve hashtag listesi.', '2026-11-28', 'orta', 30),
  ('kids-dm-4', 'Digital Marketing', 'Lansman yayını ve küçük reklam testi', 'Lansman serisini yayınlayın. Reklam bütçesini önce Finans''tan onaylatın; iki farklı görselle küçük test yapın.', '2026-12-05', 'orta', 40),
  ('kids-dm-5', 'Digital Marketing', 'Ölçüm raporu', 'Erişim, takipçi, profil ziyareti, bağlantı tıklaması ve "teklif al" formu sayısı. Kısa raporu Yönetim ve Finans''a verin.', '2026-12-10', 'orta', 50),
  -- FİNANS VE İŞ MODELİ
  ('kids-fin-1', 'Finans ve İş Modeli', 'Kids paket ve fiyatlarının gözden geçirilmesi', 'Yönetim → Finans → Kids paketleri: kreş başı ve öğrenci başı fiyatlar, pilot kreş indirimi.', '2026-11-28', 'yuksek', 10),
  ('kids-fin-2', 'Finans ve İş Modeli', 'Basım ve reklam bütçesi', 'Poster ve broşür baskı teklifleri, Instagram reklam bütçesi. Onaylanan tutarları Tasarım ve Digital Marketing''e bildirin.', '2026-12-02', 'orta', 20),
  ('kids-fin-3', 'Finans ve İş Modeli', 'Kreş verisinden pazar ve gelir tahmini', 'Pazarlama''nın kreş Excel''inden: hedef kreş sayısı, öğrenci sayısı, olası aylık gelir (kötü / orta / iyi senaryo).', '2026-12-03', 'yuksek', 30),
  ('kids-fin-4', 'Finans ve İş Modeli', 'Pilot kreş teklif şablonu', 'Teklif belgesi: paket, süre, indirim, ödeme koşulları. Pazarlama ilk temaslarda kullanacak.', '2026-12-05', 'orta', 40),
  ('kids-fin-5', 'Finans ve İş Modeli', 'Aralık finans durum raporu', 'Gelir ve giderler, sunucu ve yapay zekâ maliyetleri (Supabase, Groq, Cloudflare), basım ve reklam harcamaları. Yönetim''e sunum.', '2026-12-10', 'yuksek', 50),
  -- ÜRÜN VE YAZILIM
  ('kids-yaz-1', 'Ürün ve Yazılım', 'Ses tanıma fonksiyonunu yayınla ve izle', 'kids-ses-tanima Edge Function''ı yayınlayın; ilk günlerde kayıtlardaki hataları ve süreleri izleyin.', '2026-11-24', 'yuksek', 10),
  ('kids-yaz-2', 'Ürün ve Yazılım', 'Kids test bildirimlerini her gün ele al', 'Test panelindeki Kids bildirimlerini her gün sınıflayın, düzeltin ve "doğrulanacak" diye Test Birimi''ne geri verin.', '2026-12-10', 'yuksek', 20),
  ('kids-yaz-3', 'Ürün ve Yazılım', 'Masal ve cümle seslerinin kaydı', 'Masallardaki Türkçe cümlelerin seslerini üretin (kids/ses), eksik sesleri tamamlayın.', '2026-12-01', 'orta', 30),
  ('kids-yaz-4', 'Ürün ve Yazılım', 'Pilot kreşler için kurulum', 'Pilot kreşlerin okul ve sınıf kayıtları, öğretmen şifreleri ve öğrenci kartları (yazdırılabilir QR).', '2026-12-08', 'orta', 40),
  ('kids-yaz-5', 'Ürün ve Yazılım', 'Lansman sürümü', 'Açık kritik hata kalmadığında son sürüm; sürüm notlarını Test Birimi''nin raporuyla birlikte Yönetim''e verin.', '2026-12-10', 'yuksek', 50)
) as v(kod, birim, baslik, aciklama, teslim, oncelik, sira)
left join public.ax_teams t on t.name = v.birim
on conflict (kod) do nothing;
