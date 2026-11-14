/* ==========================================================================
   ACADEX — SUNUM: ARAŞTIRMA VE GÖRSEL MOTORU (tests/sunum-arastirma-gorsel.js)

   NEDEN VAR (14.11.2026, üçüncü canlı deste: "Yazılımın Tarihsel Gelişimi"):
   10 asetat, TEK fotoğraf yok; 2. ve 3. asetat aynı başlıklı ve yalnız "ana
   fikri yaz · bir örnek ver · neden önemli?" yer tutucusu taşıyor; sonuç
   asetatı üç tane "kaynağıyla birlikte bir sayı yaz" kutusu; notlar 14-20
   kelime. Deste buna rağmen 76/100 ile "geçti" almıştı. Kök sebepler:

     1) Araştırma tek Tavily sorgusuydu (konu cümlesinin kendisi) ve modele her
        kaynağın yalnız başı gidiyordu; Tavily düşerse araştırma tamamen ölüyordu.
     2) Görsel deste başına TEK aramaydı (destenin adı), asetatın konusuna
        bakılmıyordu; somut bir kişi/makine için bile stok fotoğraf aranıyordu.
     3) Boş şerit ("giriş ekle" Acadia yazamayınca) yer tutucuyla basılıyordu;
        aynı düğmeye iki kez basınca iki boş şerit oluşuyordu.
     4) Puanlayıcı boş asetatı ve görselsizliği hiç görmüyordu.
     5) Kapak ve kapanışın konuşma notu yoktu.

   Çalıştırma:  node tests/sunum-arastirma-gorsel.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const { test, summary } = makeRunner();

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const ink = read('js/acadex-ink.js');
const sr = read('supabase/functions/sunum-research/index.ts');
const dir = read('supabase/functions/acadia-presentation-director/index.ts');
const gsc = read('supabase/functions/generate-slide-content/index.ts');
const css = read('css/acadex-ink.css');

test('ARAŞTIRMA: konu birden çok sorguya açılır, paralel aranır', () => {
  assert.match(sr, /"queries":\["q1","q2","q3"\]/, 'sorgu planı yok — yine tek sorgu (konu cümlesi) aranır');
  assert.match(sr, /Promise\.all\(queries\.map\(\(q, i\) => tavily\(q, i === 0\)\)\)/, 'sorgular paralel aranmıyor');
  /* Kuru koşuda yakalandı: [konu, q1, q2, q3] ilk üçe kesilince İngilizce
     sorgu (q3) hiç aranmıyordu. q1 zaten konunun kendisidir; son ikisi alınır. */
  assert.match(sr, /queries = \[\.\.\.new Set\(\[topic, \.\.\.qs\.slice\(-2\)\]\)\]\.slice\(0, 3\)/,
    'konu + veri sorgusu + İngilizce sorgu aranmalı; en çok 3 sorgu (Tavily kredisi)');
  // Plan düşerse araştırma ölmez: yalnız konu aranır.
  assert.match(sr, /let queries: string\[\] = \[topic\]/, 'sorgu planı düşünce araştırma da düşer');
  assert.match(sr, /\(perHost\[h\] \|\| 0\) >= 2/, 'tek alan adı kaynakçayı doldurabilir');
});

test('ARAŞTIRMA: Wikipedia anahtarsız kaynak, alakasız sayfa giremez', () => {
  assert.match(sr, /async function wikiPages\(lang: string, q: string, n: number\)/, 'Wikipedia kaynağı yok');
  assert.ok(!/if \(!tKey && !docText\) return J\(\{ error: "TAVILY_API_KEY/.test(sr),
    'Tavily anahtarı yokken araştırma hiç denenmiyor — Wikipedia tek başına da kaynak olabilir');
  /* Canlı deneme: "Yazılımın tarihsel gelişimi" araması tr.wikipedia'da
     "Diyalektik ve Tarihsel Materyalizm" sayfasını döndürdü. */
  assert.match(sr, /const onTopic = \(w: Wiki\) =>/, 'Wikipedia sayfasının konuyla ilgisi denetlenmiyor');
  assert.match(sr, /k\.length > 0 && k\.every\(\(x\) => low\.includes\(x\)\)/, 'ilgi denetimi tüm ayırt edici sözcükleri aramıyor');
  assert.match(sr, /for \(const w of \[\.\.\.wTr, \.\.\.wEn\]\.filter\(onTopic\)\)/, 'denetim uygulanmıyor');
  assert.match(sr, /if \(text\.length < 400\) return null;/, 'taslak / anlam ayrımı sayfası kaynak oluyor');
  assert.match(sr, /"User-Agent": "AcadexSunum/, 'Wikimedia User-Agent ister; yoksa istek reddedilir');
});

test('ARAŞTIRMA: modele kaynağın başı değil, konuyla örtüşen paragraflar gider', () => {
  assert.match(sr, /const pickPassages = \(text: string, keys: string\[\], budget: number\)/, 'paragraf seçimi yok');
  assert.match(sr, /pickPassages\(s\.text, keys, per\) \|\| s\.snippet/, 'yazar hâlâ kaynağın ilk karakterlerini okuyor');
  assert.ok(!sr.includes('s.text.slice(0, 900)'), 'eski "ilk 900 karakter" kesimi duruyor');
  // Yedek model yarı bütçeyle denenir: aynı isteği yinelemek token sınırını aşmaz.
  assert.match(sr, /"openai\/gpt-oss-20b", sys, `TOPIC: \$\{topic\}\\n\\nSOURCES:\\n` \+ srcBlock\(9000\)/, 'yedek deneme aynı büyük istekle gidiyor');
});

test('YAZAR: dolu not, gerçek giriş ve sonuç, asetat başına görsel ipucu', () => {
  assert.match(sr, /3-4 natural spoken sentences, 45-80 words/, 'not uzunluğu istenmiyor (canlıda 14-20 kelime geliyordu)');
  assert.match(sr, /kind "list" with exactly 3 takeaway bullets/, 'sonuç asetatı tarif edilmiyor');
  assert.match(sr, /never leave bullets empty/, 'boş asetat yasağı yok');
  assert.match(sr, /"image":\{"q":"","entity":""\}/, 'asetat başına görsel ipucu istenmiyor');
  assert.match(sr, /"cover_image":\{"q":"","entity":""\}/, 'kapak görseli ipucu istenmiyor');
  assert.match(sr, /image: imgOf\(s\.image\)/, 'ipucu istemciye taşınmıyor');
  // İçeriksiz asetat kurguya girmez.
  assert.match(sr, /if \(!x\.title \|\| \(!x\.bullets\.length && !x\.stats\.length && !x\.chart && !x\.table\)\) dropAt\(i\)/,
    'içeriği olmayan asetat istemciye gidiyor ve yer tutucuyla basılıyor');
});

test('GÖRSEL: somut konu Wikipedia’dan (yalnız özgür lisans), kavram stoktan, hepsi düşerse Commons', () => {
  assert.match(sr, /async function wikiImage\(entity: string\)/, 'Wikipedia görseli yok');
  assert.match(sr, /pilicense=free/, 'adil kullanım görselleri (logo, afiş) sunuma taşınabilir — yalnız özgür lisans');
  assert.match(sr, /async function commonsSearch\(q: string, per: number\)/, 'anahtarsız yedek (Commons) yok');
  assert.match(sr, /if \(\(ii\.width \|\| 0\) < 700 \|\| \(ii\.height \|\| 0\) < 400\) continue;/, 'küçük görsel perdede bulanır');
  assert.match(sr, /const UNSPLASH_MAX = 5;/, 'Unsplash arama sayısı sınırsız — ücretsiz katman saatte 50 istek');
  assert.match(sr, /!used\.has\(x\.large\)/, 'aynı görsel iki asetata konabilir');
  assert.match(sr, /if \(action === "illustrate"\)/, 'asetat başına görsel eylemi yok');
  // "görsel ara" stok arşivler boşken de sonuç vermeli.
  assert.match(sr, /if \(!photos\.length\) photos = await commonsSearch\(q, 12\);/, '"görsel ara" Unsplash sınırı dolunca tamamen kapanıyor');
});

test('İSTEMCİ: her aday asetat kendi ipucuyla görsel alır', () => {
  assert.match(ink, /var illustrate = function \(made, topic\)/, 'asetat başına görsel yolu yok');
  assert.match(ink, /if \(wantPh && wantPh\.checked\) illustrate\(made, plotMeta\.title \|\| deck\.title\);/, 'basımda hâlâ tek aramalı yol çağrılıyor');
  assert.match(ink, /img: x\.image && \(x\.image\.q \|\| x\.image\.entity\)/, 'yazarın görsel ipucu şeride taşınmıyor');
  assert.match(ink, /if \(s\.k === 'cover' && plotMeta\.cover && \(plotMeta\.cover\.q \|\| plotMeta\.cover\.entity\)\) sl\.imgq = plotMeta\.cover; else if \(s\.img\) sl\.imgq = s\.img;/,
    'ipucu asetata taşınmıyor');
  assert.match(ink, /var cap = Math\.min\(8, Math\.max\(3, Math\.ceil\(made\.length \* 0\.4\)\)\);/, 'görsel sayısı destenin boyuna göre değil');
  // Sunucuya ulaşılamazsa ya da hiç görsel dönmezse eski yol yedek kalır.
  assert.match(ink, /if \(!n\) \{ autoPhotos\(made, topic\); return; \}/, 'yedek yol yok');
  assert.match(ink, /console\.warn\('acadex-sunum: görsel yerleştirme', e\); autoPhotos\(made, topic\);/, 'hata hâlinde yedek yol yok');
  assert.match(ink, /\(sl\.lay === 'quote' && e\.type === 'h' && e\.text\.length > 1\)/, 'alıntı asetatında büyük yazı fotoğrafın altında kalır');
  assert.match(ink, /\(p\.photographer \? p\.photographer \+ ' \/ ' : ''\) \+ src/, 'fotoğrafçısız kaynak "Wikimedia Commons / Wikimedia Commons" diye yazılıyor');
});

test('BOŞ ŞERİT: basmadan önce yazılır, çift tık ikinci boş şerit eklemez', () => {
  assert.match(ink, /var hazirla = function \(\)/, 'basım öncesi doldurma yok');
  assert.match(ink, /if \(!bos\.length \|\| plotMeta\.via === 'skeleton'\) return Promise\.resolve\(0\);/,
    'iskelet yolunda soluk yerler bilerek kullanıcıya bırakılır; ona dokunulmamalı');
  assert.match(ink, /if \(x\.k === 'stat' && statsOf\(x\.b, \{ data: x\.data \}\)\.length < 3\) x\.k = 'list';/,
    '3 sayısı olmayan "3 sayı" asetatı "—" kutularıyla basılıyor');
  assert.match(ink, /else bas\('replace'\); \}\);/, 'ilk basım doldurmadan geçiyor');
  assert.match(ink, /bas\(plot\.querySelector\('input\[name=pl-mode\]:checked'\)\.value\)/, 'ikinci adımdaki basım doldurmadan geçiyor');
  assert.match(ink, /' ' \+ kalanBos \+ ' asetatı Acadia yazamadı/, 'boş kalan asetat söylenmiyor');
  assert.match(ink, /if \(flowEl\.getAttribute\('aria-busy'\) === 'true'\) return;/, 'giriş/sonuç yazılırken ikinci tık engellenmiyor');
  // Küçük modele yedek: büyük model meşgulken şerit boş kalmasın.
  assert.match(gsc, /callGroq\('4-6', Deno\.env\.get\('GROQ_SLIDE_MODEL_FALLBACK'\) \|\| 'openai\/gpt-oss-20b'\)/, 'generate-slide-content tek modele bağlı');
  assert.match(gsc, /model: model \|\| "openai\/gpt-oss-120b"/, 'yedek model isteğe geçmiyor');
});

test('KALİTE: boş asetat ve görselsizlik ölçülür, yer tutucu perdeye çıkmaz', () => {
  assert.match(dir, /issues\.push\('empty_slides'\)/, 'puanlayıcı boş asetatı görmüyor');
  assert.match(dir, /issues\.push\('few_visuals'\)/, 'puanlayıcı görselsizliği görmüyor');
  assert.match(dir, /const measured = deck\.slides\.some\(slide => typeof slide\.content\?\.has_visual === 'boolean'\)/,
    'alanlar gelmeyince (yönetmenin kendi üretimi) ölçüt yanlış ceza keser');
  assert.match(ink, /has_visual: gorselVar\(x\), placeholder: yerTutucu\(x\)/, 'istemci ölçüm alanlarını göndermiyor');
  assert.ok(ink.includes("empty_slides: 'boş ya da doldurulmamış asetat var'"), 'empty_slides Türkçe karşılığı yok');
  assert.ok(ink.includes('few_visuals:'), 'few_visuals Türkçe karşılığı yok');
  assert.match(ink, /if \(bos\.length\) iss\.unshift\('doldurulmamış yer: ' \+ bos\.join\('\., '\) \+ '\. asetat'\)/,
    'rozet doldurulmamış asetatı numarasıyla söylemiyor');
  assert.match(css, /\.sx-pr \.sx-el\.muted,\.sx-print \.sx-el\.muted\{visibility:hidden\}/, 'yer tutucu sunumda ve PDF’te görünüyor');
});

test('KAPAK VE KAPANIŞ NOTU destenin kendi başlıklarından yazılır', () => {
  assert.match(ink, /if \(sl\.lay === 'cover'\) sl\.notes = ENn/, 'kapak notu yok (0 kelime)');
  assert.match(ink, /else if \(sl\.lay === 'end'\) sl\.notes = ENn/, 'kapanış notu yok (0 kelime)');
  assert.match(ink, /if \(sl\.notes\) return;/, 'var olan not eziliyor');
});

test('UYDURMA ALINTI VE NOTTA KAYNAK ETİKETİ (14.11.2026, dördüncü canlı deste)', () => {
  /* 89/100 alan destede: (1) bir kaynak özeti tırnak içinde Margaret
     Hamilton'a atfedilmişti; (2) notlar "Kaynak1 ve 3'e göre", "(Kaynak1,5)"
     diye yazılmıştı — yüksek sesle okunan metinde anlamsız; (3) Kaynakça notu
     kaynak listesini baştan okuyordu. Temizleyiciler gerçek kodla koşulur. */
  const ts = require('typescript');
  const a = sr.indexOf('const cleanNote'), a2 = sr.indexOf('async function groq'), b0 = sr.indexOf('const flat = (t: string)'), b = sr.indexOf('const slides = out.slides');
  assert.ok(a > 0 && a2 > a && b0 > a2 && b > b0, 'cleanNote / safeQuote bulunamadı');
  const js = ts.transpileModule(sr.slice(a, a2) + sr.slice(b0, b), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const srcs = [{ text: 'Hamilton said: There was no choice but to be pioneers.', snippet: '' }];
  const f = new Function('srcs', js + ';return { cleanNote, safeQuote };')(srcs);
  assert.equal(f.cleanNote('İlk programdan bahsediyoruz. Kaynak1 ve 3’e göre, Tom Kilburn yazdı.'),
    'İlk programdan bahsediyoruz. Tom Kilburn yazdı.');
  assert.equal(f.cleanNote('Diller geliştirmeyi hızlandırdı (Kaynak1,5). Fortran öne çıktı [1, 5].'),
    'Diller geliştirmeyi hızlandırdı. Fortran öne çıktı.');
  assert.equal(f.cleanNote('According to Source 2, DevOps grew (Sources 2 and 4).'), 'DevOps grew.');
  assert.equal(f.cleanNote('1948 yılında 17 komut çalıştı.'), '1948 yılında 17 komut çalıştı.', 'sayılar silinmemeli');
  assert.equal(f.safeQuote('"Yazılım mühendisliği bir disiplin haline geldi" – Margaret Hamilton (Kaynak3)'),
    'Yazılım mühendisliği bir disiplin haline geldi', 'kaynakta geçmeyen söz kişiye atfediliyor');
  assert.equal(f.safeQuote('"There was no choice but to be pioneers." — Margaret Hamilton'),
    '"There was no choice but to be pioneers." — Margaret Hamilton', 'kaynakta harfi harfine geçen alıntı korunmalı');
  assert.match(sr, /if \(kind === "quote" && bullets\.length\) bullets\[0\] = safeQuote\(bullets\[0\]\)/, 'alıntı denetimi çağrılmıyor');
  assert.match(sr, /notes: cleanNote\(s\.notes\)/, 'not temizlenmeden dönüyor');
  assert.match(ink, /s\.k !== 'cover' && s\.k !== 'end' && s\.k !== 'refs'\) AI\.note\(sl, true\)/, 'kaynakça notu listeyi okuyor');
  assert.match(ink, /else if \(sl\.lay === 'refs'\) sl\.notes = ENn/, 'kaynakça notu yok');
});

test('KAYNAKSIZ DOLDURMA KAPALI, KAPSAM İSKELETİ, ANLAM DENETİMİ (14.11.2026, Apollo 11 destesi)', () => {
  /* 89/100 alan destede: "giriş ekle" şeridi kaynaksız yazıldı ve "12.000 metre
     yürüdü", "0,24 kg örnek" uydurdu (doğrusu ~1 km, 21,5 kg); deste yalnız sayı
     sıraladı (mürettebat, kronoloji, bağlam yok); "21,5 saat yürüdüler" notu ve
     yanlış etiketli grafik sayı kaynakta geçtiği için denetimden geçti; tek
     maddelik asetat ve "Astronaut Assignments Chart.png" görseli basıldı. */
  // 1) kaynaklı doldurma
  assert.match(sr, /if \(action === "fill"\)/, 'fill eylemi yok');
  assert.match(sr, /!numTokens\(b\)\.length \|\| verified\(b, idxF\)/, 'fill: kaynakta geçmeyen sayılı madde atılmıyor');
  assert.match(sr, /apa: apa\(s, lang, accessed\), ctx: s\.snippet\.slice\(0, 1200\)/, 'kaynak paragrafı istemciye dönmüyor');
  assert.match(ink, /if \(kaynakli\(\)\) return fn\('sunum-research', \{ action: 'fill'/, 'araştırmalı destede şerit kaynaksız yazılıyor');
  assert.equal((ink.match(/action: 'enrich', language: curLang\(\), topic: topic, slideTitle: ns\.t/g) || []).length, 1,
    'kaynaksız zenginleştirme tek yerde (doldur) kalmalı');
  assert.match(ink, /if \(kalan && kaynakli\(\)\) for \(var i = strips\.length - 1; i >= 0; i--\) if \(bosSerit\(strips\[i\]\)\) strips\.splice\(i, 1\)/,
    'kaynaklardan yazılamayan şerit yer tutucuyla basılıyor');
  assert.match(ink, /if \(plotMeta\.via !== 'research' && !body\.slice\(0, 2\)\.some/, 'araştırmalı destede ikinci giriş öneriliyor');
  // 2) kapsam
  assert.ok(sr.includes('- COVERAGE: before writing, plan the deck'), 'yazara kapsam iskeleti verilmiyor');
  assert.ok(sr.includes('never write a slide with a single bullet'), 'tek maddelik asetat yasağı yok');
  // 3) anlam: grafik + not
  assert.match(sr, /claims\.push\(\{ k: `\$\{si\}\.c\$\{bi\}`/, 'grafik değerleri anlam denetimine girmiyor');
  assert.match(sr, /claims\.push\(\{ k: `\$\{si\}\.n\$\{bi\}`/, 'notlardaki sayılı cümleler denetlenmiyor');
  assert.match(sr, /if \(s\._cw && s\.chart\)/, 'etiketi yanlış grafik yine çiziliyor');
  // 4) ince asetat + fotoğraf olmayan görsel
  assert.match(sr, /if \(!plain\(x\) \|\| x\.bullets\.length !== 1\) continue;/, 'tek maddelik asetat birleştirilmiyor');
  assert.match(sr, /const dropAt = /, 'düşen asetata kurulan köprü cümlesi notta kalıyor');
  const m = sr.match(/const NOT_PHOTO = (\/.+\/i);/);
  assert.ok(m, 'NOT_PHOTO yok');
  const re = eval(m[1]);
  assert.ok(re.test('File:Astronaut Assignments Chart.png'), 'çizelge dosyası fotoğraf sayılıyor');
  assert.ok(!re.test('File:Aldrin Apollo 11 original.jpg'), 'gerçek fotoğraf eleniyor');
  assert.match(sr, /String\(ii\.mime \|\| ""\) !== "image\/jpeg"/, 'Commons aramasında PNG (çizelge/şema) kabul ediliyor');
});

summary();
