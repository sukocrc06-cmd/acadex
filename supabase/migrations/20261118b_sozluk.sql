-- ==========================================================================
-- Acadex Sözlük (18.11.2026) — her panelden erişilen terim sözlüğü
-- Her terimde Türkçe ve İngilizce karşılık ile üç anlatım düzeyi:
--   sade      lise diliyle, kısa
--   akademik  ders kitabı tanımı
--   ornek     günlük hayattan / dersten bir örnek
-- Kaynaklar: Acadex'in kendi lab terimleri (bu dosyadaki ilk tohum: İstatistik Lab,
-- labs/istatistik/is-terim.js) ve Wikidata (CC0; yönetim panelinden terim terim
-- eşleştirilir). Akademik İçerik Kurulu yönetim panelinde (Yönetim → Sözlük) yazar ve onaylar.
-- Okuma: herkes (giriş yapmamış ziyaretçi de; lab sayfaları girişsiz açılabiliyor).
-- Yazma: yalnız admin_ok().
-- Tekrar çalıştırmak zarar vermez.
-- ==========================================================================

create table if not exists public.sozluk_terim (
  id uuid primary key default gen_random_uuid(),
  tr text not null,
  en text not null default '',
  es text[] not null default '{}',          -- aranacak diğer yazımlar / kısaltmalar
  alan text[] not null default '{}',        -- istatistik, finans, isletme, saglik …
  sade text not null default '',
  akademik text not null default '',
  ornek text not null default '',
  kaynak text not null default 'acadex',    -- acadex | lab | wikidata
  wikidata text not null default '',        -- Q kimliği (ör. Q159375)
  durum text not null default 'taslak',     -- taslak | onayli
  isaretle boolean not null default true,   -- metinlerde altı noktalı gösterilsin mi
  anahtar text generated always as (lower(trim(tr))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists sozluk_terim_anahtar_ux on public.sozluk_terim (anahtar);
create index if not exists sozluk_terim_guncel_ix on public.sozluk_terim (updated_at desc);

alter table public.sozluk_terim drop constraint if exists sozluk_terim_kontrol;
alter table public.sozluk_terim add constraint sozluk_terim_kontrol check (
  char_length(trim(tr)) between 2 and 120 and char_length(en) <= 160
  and char_length(sade) <= 1500 and char_length(akademik) <= 1500 and char_length(ornek) <= 1500
  and coalesce(array_length(es, 1), 0) <= 12 and coalesce(array_length(alan, 1), 0) <= 8
  and kaynak in ('acadex', 'lab', 'wikidata') and durum in ('taslak', 'onayli')
  and wikidata ~ '^(Q[0-9]{1,12})?$');

create or replace function public.sozluk_terim_dokun() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists sozluk_terim_dokun on public.sozluk_terim;
create trigger sozluk_terim_dokun before update on public.sozluk_terim for each row execute function public.sozluk_terim_dokun();

alter table public.sozluk_terim enable row level security;
drop policy if exists sozluk_terim_oku on public.sozluk_terim;
create policy sozluk_terim_oku on public.sozluk_terim for select to anon, authenticated using (true);
drop policy if exists sozluk_terim_yonet on public.sozluk_terim;
create policy sozluk_terim_yonet on public.sozluk_terim for all to authenticated using (public.admin_ok()) with check (public.admin_ok());
revoke all on public.sozluk_terim from anon;
grant select on public.sozluk_terim to anon;
grant select, insert, update, delete on public.sozluk_terim to authenticated;

-- tohum: İstatistik Lab terimleri (labs/istatistik/is-terim.js; Türkçe, İngilizce, kısa açıklama)
insert into public.sozluk_terim (tr, en, sade, alan, kaynak, durum)
select v.tr, v.en, v.sade, array['istatistik'], 'lab', 'onayli'
from (values
  ('değişken', 'variable', 'gözlemden gözleme değişen özellik'),
  ('nitel / nicel veri', 'qualitative / quantitative data', ''),
  ('sınıflayıcı ölçek', 'nominal scale', 'yalnız ad: cinsiyet, il'),
  ('sıralı ölçek', 'ordinal scale', 'sıra var, aralık anlamsız'),
  ('aralık ölçeği', 'interval scale', 'fark anlamlı, sıfır keyfî (°C)'),
  ('oran ölçeği', 'ratio scale', 'gerçek sıfır var (TL, kg)'),
  ('birincil / ikincil veri', 'primary / secondary data', 'kendin topladın / hazır kaynak'),
  ('frekans tablosu', 'frequency distribution', ''),
  ('pasta grafiği', 'pie chart', ''),
  ('sütun grafiği', 'bar chart', ''),
  ('birikimli frekans eğrisi', 'ogive', ''),
  ('dal-yaprak', 'stem-and-leaf display', ''),
  ('geometrik ortalama', 'geometric mean', 'büyüme oranlarında'),
  ('harmonik ortalama', 'harmonic mean', 'oranların ortalamasında (hız)'),
  ('kareli ortalama', 'quadratic mean (RMS)', ''),
  ('ortalama', 'mean', ''),
  ('medyan', 'median', ''),
  ('mod', 'mode', ''),
  ('aralık', 'range', ''),
  ('varyans', 'variance', ''),
  ('standart sapma', 'standard deviation', ''),
  ('değişim katsayısı', 'coefficient of variation', ''),
  ('çeyrek', 'quartile', ''),
  ('yüzdelik', 'percentile', ''),
  ('çeyrekler açıklığı', 'interquartile range (IQR)', ''),
  ('kutu grafiği', 'box plot', ''),
  ('aykırı değer', 'outlier', ''),
  ('çarpıklık', 'skewness', ''),
  ('basıklık', 'kurtosis', ''),
  ('oran', 'ratio', ''),
  ('yüzde değişim', 'percentage change', ''),
  ('yüzde puan', 'percentage point', ''),
  ('basit endeks', 'simple index', ''),
  ('bileşik endeks', 'aggregate index', ''),
  ('ağırlıklı endeks', 'weighted index', ''),
  ('baz dönem', 'base period', ''),
  ('zincirleme endeks', 'chain index', ''),
  ('Laspeyres / Paasche', 'Laspeyres / Paasche index', ''),
  ('reel değer', 'real value (deflated)', ''),
  ('fiyat deflatörü', 'price deflator', ''),
  ('TÜFE', 'consumer price index (CPI)', ''),
  ('deney', 'experiment', ''),
  ('örnek uzay', 'sample space', ''),
  ('olay', 'event', ''),
  ('koşullu olasılık', 'conditional probability', ''),
  ('bağımsız olaylar', 'independent events', ''),
  ('ayrık olaylar', 'mutually exclusive events', ''),
  ('Bayes teoremi', 'Bayes'' theorem', ''),
  ('kombinasyon / permütasyon', 'combination / permutation', ''),
  ('büyük sayılar yasası', 'law of large numbers', ''),
  ('rastlantı değişkeni', 'random variable', ''),
  ('beklenen değer', 'expected value', ''),
  ('olasılık fonksiyonu', 'probability (mass) function', ''),
  ('yoğunluk fonksiyonu', 'probability density function', ''),
  ('birikimli dağılım', 'cumulative distribution', ''),
  ('binom', 'binomial', ''),
  ('Poisson', 'Poisson', ''),
  ('normal / standart normal', 'normal / standard normal', ''),
  ('z puanı', 'z-score', ''),
  ('serbestlik derecesi', 'degrees of freedom', ''),
  ('ana kütle', 'population', ''),
  ('örneklem', 'sample', ''),
  ('parametre / istatistik', 'parameter / statistic', ''),
  ('örnekleme dağılımı', 'sampling distribution', ''),
  ('standart hata', 'standard error', ''),
  ('merkezî limit teoremi', 'central limit theorem', ''),
  ('basit rastgele örneklem', 'simple random sample', ''),
  ('nokta tahmini', 'point estimate', ''),
  ('güven aralığı', 'confidence interval', ''),
  ('güven düzeyi', 'confidence level', ''),
  ('hata payı', 'margin of error', ''),
  ('kritik değer', 'critical value', ''),
  ('örneklem büyüklüğü', 'sample size', ''),
  ('sıfır hipotezi', 'null hypothesis (H₀)', ''),
  ('alternatif hipotez', 'alternative hypothesis (H₁)', ''),
  ('anlamlılık düzeyi', 'level of significance (α)', ''),
  ('test istatistiği', 'test statistic', ''),
  ('p-değeri', 'p-value', ''),
  ('ret bölgesi', 'rejection region', ''),
  ('tek / çift yönlü', 'one-tailed / two-tailed', ''),
  ('I. tip hata', 'Type I error', ''),
  ('II. tip hata', 'Type II error', ''),
  ('testin gücü', 'power of the test', ''),
  ('bağımsız örneklemler', 'independent samples', ''),
  ('eşleştirilmiş örneklemler', 'matched (paired) samples', ''),
  ('ortak varyans', 'pooled variance', ''),
  ('Welch testi', 'Welch''s t test', ''),
  ('iki oran farkı', 'difference of two proportions', ''),
  ('parametrik olmayan', 'nonparametric', ''),
  ('sıra', 'rank', ''),
  ('işaret testi', 'sign test', ''),
  ('Wilcoxon işaretli sıralar', 'Wilcoxon signed-rank test', ''),
  ('Mann-Whitney U', 'Mann-Whitney U (Wilcoxon rank-sum)', ''),
  ('Spearman sıra korelasyonu', 'Spearman''s rank correlation', ''),
  ('Kruskal-Wallis', 'Kruskal-Wallis test', ''),
  ('gözlenen frekans', 'observed frequency', ''),
  ('beklenen frekans', 'expected frequency', ''),
  ('uyum iyiliği', 'goodness of fit', ''),
  ('bağımsızlık testi', 'test of independence', ''),
  ('çapraz tablo', 'contingency table', ''),
  ('varyans analizi', 'analysis of variance', ''),
  ('kareler toplamı', 'sum of squares', ''),
  ('kareler ortalaması', 'mean square', ''),
  ('F oranı', 'F ratio', ''),
  ('serpilme diyagramı', 'scatter diagram', ''),
  ('korelasyon katsayısı', 'correlation coefficient', ''),
  ('bağımlı / bağımsız değişken', 'dependent / independent variable', ''),
  ('en küçük kareler', 'least squares', ''),
  ('eğim / kesişim', 'slope / intercept', ''),
  ('kalıntı', 'residual', ''),
  ('belirlilik katsayısı', 'coefficient of determination (R²)', ''),
  ('eğimin standart hatası', 'standard error of the slope', ''),
  ('çoklu regresyon', 'multiple regression', ''),
  ('düzeltilmiş R²', 'adjusted R²', ''),
  ('çoklu doğrusallık', 'multicollinearity', ''),
  ('zaman serisi', 'time series', ''),
  ('trend / mevsimsellik', 'trend / seasonality', ''),
  ('üstel düzeltme', 'exponential smoothing', ''),
  ('hareketli ortalama', 'moving average', ''),
  ('öngörü hatası', 'forecast error', ''),
  ('ortalama mutlak sapma', 'mean absolute deviation (MAD)', ''),
  ('ortalama mutlak yüzde hata', 'mean absolute percentage error (MAPE)', ''),
  ('fiyat endeksi', 'price index', ''),
  ('kontrol kartı', 'control chart', ''),
  ('tabakalı örnekleme', 'stratified sampling', ''),
  ('küme örneklemesi', 'cluster sampling', ''),
  ('duyarlılık / özgüllük', 'sensitivity / specificity', ''),
  ('ROC eğrisi', 'ROC curve', '')
) as v(tr, en, sade)
on conflict (anahtar) do nothing;

notify pgrst, 'reload schema';
