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

test('ASETATTA "(Kaynak 2, 8)" KALMAZ, UYDURMA GRAFİK, ÇİFT SONUÇ (14.11.2026, ikinci Apollo destesi)', () => {
  /* Kapsam düzeldi (kronoloji, mürettebat, alıntı, 4 kaynak) ama: maddeler
     "(Kaynak 2, 8)" taşıdı; 31 tur "Gün 1: 10, Gün 2: 10, Gün 3: 11" diye
     uydurma bir grafiğe bölündü; "sonuç ekle" ikinci bir sonuç asetatı ekledi. */
  const ts = require('typescript');
  const a = sr.indexOf('const cleanCite'), b = sr.indexOf('async function groq');
  const f = new Function(ts.transpileModule(sr.slice(a, b), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + ';return cleanCite;')();
  assert.equal(f('Collins Columbia’da yörüngede kaldı (Kaynak 1, 2, 8)'), 'Collins Columbia’da yörüngede kaldı');
  assert.equal(f('650 milyon izleyici (NASA tahmini)'), '650 milyon izleyici (NASA tahmini)', 'kurum adı silinmemeli');
  assert.match(sr, /\.map\(\(x: any\) => cleanCite\(String\(x \|\| ""\)\)\)\.filter\(Boolean\)\.slice\(0, 6\)/, 'maddeler temizlenmiyor');
  assert.ok(sr.includes('Never split a total into parts the sources do not give'), 'yazara uydurma dağılım yasağı yok');
  assert.ok(sr.includes('a total divided into parts the source does not state is "unsupported"'), 'denetçi uydurma dağılımı geçiriyor');
  assert.match(ink, /if \(plotMeta\.via !== 'research' && !body\.slice\(-2\)\.some/, 'araştırmalı destede ikinci sonuç öneriliyor');
});

test('KALAN KUSURLAR: kısa not, mutlak iddia, zayıf kaynak, kaynakça notu (14.11.2026)', () => {
  /* İkinci Apollo destesinde kalanlar: notlar 38-45 kelime; "insanlık
     tarihindeki en hızlı uzay yolculuğu" kaynaksız; dört kaynaktan biri siyasi
     haber sitesi ve saati yanlış veriyor; 11 kelimelik kaynakça notu puanlayıcıda
     "kısa not" sayılıyor (eşik 22); "3 mesaj" başlığı altında 4 madde. */
  const ts = require('typescript');
  const a = sr.indexOf('const TRUSTED'), b = sr.indexOf('const blocked');
  const trust = new Function(ts.transpileModule(sr.slice(a, b), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + ';return trust;')();
  ['www.lpi.usra.edu', 'airandspace.si.edu', 'nasa.gov', 'data.tuik.gov.tr', 'metu.edu.tr'].forEach((h) => assert.ok(trust(h) > 0, h + ' kurumsal sayılmıyor'));
  ['ulkucudunya.com', 'ornekblog.net', 'educationsite.com'].forEach((h) => assert.equal(trust(h), 0, h + ' kurumsal sayılıyor'));
  assert.match(sr, /\+ trust\(hostOf\(b\.url\)\) - \(Number\(a\.score\) \|\| 0\) - trust\(hostOf\(a\.url\)\)/, 'sıralama kurumsal kaynağı öne almıyor');
  const m = sr.match(/const ABSOLUTE = (\/.+\/i);/); assert.ok(m, 'ABSOLUTE yok');
  const abs = eval(m[1]);
  assert.ok(abs.test('Bu, insanlık tarihindeki en hızlı uzay yolculuğu olarak kayda geçti.'), 'mutlak iddia yakalanmıyor');
  assert.ok(abs.test('Örnekler yaşamın yokluğunu kanıtladı.'), '"kanıtladı" yakalanmıyor');
  assert.ok(!abs.test('Collins yörüngede kalıp ekibi bekledi.'), 'sıradan cümle denetime giriyor');
  assert.match(sr, /if \(numTokens\(t\)\.length \|\| ABSOLUTE\.test\(t\)\) claims\.push/, 'mutlak iddialı not cümlesi denetlenmiyor');
  assert.match(sr, /filter\(\(x: any\) => wc\(x\.s\.notes\) < 45\)/, 'kısa notlar uzatılmıyor');
  assert.match(sr, /if \(wc\(nt\) > wc\(s\.notes\) && wc\(nt\) <= 110 && \(verified\(nt, allIdx\) \|\| !numTokens\(nt\)\.length\)\) s\.notes = nt;/,
    'uzatılmış not sayı denetiminden geçmeden yazılıyor');
  const refs = ink.match(/'(Listeyi sesli okuma\. Sunumdaki her bilgi[^']+)'/);
  assert.ok(refs && refs[1].split(/\s+/).length >= 22, 'kaynakça notu puanlayıcı eşiğinin (22 kelime) altında');
  assert.match(ink, /if \(it\.fix === 'outro'\) ns\.b = ns\.b\.slice\(0, 3\);/, '"3 mesaj" altında 4 madde basılıyor');
});

test('KARIŞIK BİRİMLİ GRAFİK, NOTTA SİTE ADI, KAYNAK KARIŞIMI (14.11.2026, üçüncü Apollo destesi)', () => {
  /* Deste sunulabilir hâle geldi ama: "10 mil · 7 km · 20 saniye" tek çubuk
     grafikte çizildi; not "bu söz bilimup.com'da tam olarak bu ifadeyle yer
     alıyor" dedi; iniş saati uydurma "EEZ" dilimiyle yazıldı; üç kişilik
     mürettebat iki kolona sıkıştı (Aldrin yok). */
  const ts = require('typescript');
  const pick = (from, to) => ts.transpileModule(sr.slice(sr.indexOf(from), sr.indexOf(to)), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const f = new Function(pick('const cleanNote', 'const ABSOLUTE') + pick('const mixedUnits', 'const cleanCite') + ';return { cleanNote, mixedUnits };')();
  assert.ok(f.mixedUnits(['Planlanan yükseklik (mil)', 'İniş hatası (km)', 'Kalan yakıt (saniye)']), 'karışık birim yakalanmıyor');
  assert.ok(!f.mixedUnits(['2019 (milyar $)', '2020 (milyar $)']), 'tek birimli grafik eleniyor');
  assert.ok(!f.mixedUnits(['Gün 1', 'Gün 2']), 'birimsiz etiketler eleniyor');
  assert.equal(f.cleanNote('Armstrong bu sözü Ay’da söyledi. Bu söz, bilimup.com’da tam olarak bu ifadeyle yer alıyor. Şimdi mirasa bakalım.'),
    'Armstrong bu sözü Ay’da söyledi. Şimdi mirasa bakalım.');
  assert.equal(f.cleanNote('Görev 8,5 gün sürdü. ABD’de izlenme yüksekti.'), 'Görev 8,5 gün sürdü. ABD’de izlenme yüksekti.', 'ondalık ya da kısaltma cümleyi düşürmemeli');
  assert.match(sr, /if \(chart && mixedUnits\(chart\.labels\)\) chartOk = false;/, 'karışık birimli grafik çiziliyor');
  assert.match(sr, /if \(k === "list" && kind === "chart" && chart && !bullets\.length\)/, 'listeye inen grafik asetatı boş kalıp düşüyor');
  assert.ok(sr.includes('never invent or translate a time-zone abbreviation'), 'uydurma saat dilimi yasağı yok');
  assert.ok(sr.includes('three or more people, items or groups go in a "list" or "table"'), 'üç kişi iki kolona sıkışıyor');
  assert.match(sr, /return \+\+untrusted <= 2;/, 'kurumsal kaynak yeterliyken zayıf kaynak sınırlanmıyor');
});

test('TOKEN BÜTÇESİ: anlam denetimi ve büyük model sınıra takılmaz (14.11.2026, canlı log)', () => {
  /* Enflasyon destesinin logu: "meaning check 413" — genişlettiğim denetim
     (70 iddia × 1100 karakter) Groq'un dakikada 8000 token sınırını aştı ve o
     destede HİÇBİR iddia denetlenmedi ("%85 enflasyon (2023)" yanlış yılla
     geçti). Aynı logda yazar da 8282 token ile 413 alıp küçük modele düşmüştü. */
  assert.match(sr, /srcBlock\(13000\);/, 'yazarın kaynak bloğu 8000 token sınırını aşıyor');
  assert.ok(!/srcBlock\(18000\)/.test(sr), '18 bin karakterlik blok geri gelmiş');
  assert.match(sr, /if \(!g\.ok && g\.status === 413\) g = await groq\(gKey, "openai\/gpt-oss-120b"/, '413\'te büyük model küçük blokla yeniden denenmiyor');
  assert.match(sr, /let payload = pack\(10000\);/, 'denetim yükü karakter bütçesiyle kesilmiyor');
  assert.match(sr, /payload = pack\(4500\);/, 'yedek model yarım yükle denenmiyor');
  assert.match(sr, /source: c\.ctx\.slice\(0, 420\)/, 'iddia başına kaynak parçası kısaltılmıyor');
  // Öncelik sırası gerçek kodla: sayı kutusu ve grafik, sayısız maddeden önce gider.
  const ts = require('typescript');
  const a = sr.indexOf('const rank = '), b = sr.indexOf('let payload = pack');
  const numTokens = (t) => t.match(/\d+/g) || [];
  const claims = [{ k: '0.b0', text: 'sayısız uzun bir madde', ctx: 'x'.repeat(900) }, { k: '0.n1', text: 'not 5', ctx: 'y' }, { k: '1.s0', text: '%85', ctx: 'z' }, { k: '2.c0', text: 'g: 3', ctx: 'w' }, { k: '0.b1', text: 'madde 7', ctx: 'q' }];
  const pack = new Function('claims', 'numTokens', ts.transpileModule(sr.slice(a, b), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + ';return pack;')(claims, numTokens);
  assert.deepEqual(pack(10000).map((x) => x.k), ['1.s0', '2.c0', '0.b1', '0.n1', '0.b0']);
  assert.deepEqual(pack(200).map((x) => x.k), ['1.s0', '2.c0', '0.b1', '0.n1'], 'bütçe dolunca en önemsiz iddia dışarıda kalmalı');
  assert.ok(pack(10000)[4].source.length === 420, 'kaynak parçası 420 karaktere inmiyor');
  // Güncellik ve biçim kuralları
  assert.ok(sr.includes('q2 must ask for the latest data and include the current year'), 'güncel konuda güncel veri aranmıyor');
  assert.ok(sr.includes('Never present old data as the present situation'), 'eski veri bugünmüş gibi sunulabiliyor');
  assert.ok(sr.includes('EACH starting with its own date or period'), 'tarihsiz maddeler zaman çizelgesine giriyor');
});

test('DÜZEN ÇEŞİTLERİ: aynı tür art arda farklı görünümle basılır (14.11.2026)', () => {
  /* Berkay: "hep aynı kalıpları kullanıyor" — enflasyon destesinde iki zaman
     çizelgesi birebir aynıydı. Çeşitler gerçek kodla kurulur ve ölçülür:
     her öğe 960×540 asetatın içinde kalmalı, içerik uymuyorsa null dönmeli. */
  const a = ink.indexOf("var TINT = ['#DCE6FF'"), b = ink.indexOf('/* ---------- özetten taşınan zenginlik');
  assert.ok(a > 0 && b > a, 'VARY bloğu bulunamadı');
  let id = 0;
  const E = (type, x, y, w, h, o) => Object.assign({ id: ++id, type, x, y, w, h, text: '', size: 24 }, o);
  const head = (t) => [E('h', 70, 46, 820, 74, { text: t, size: 42 }), E('mark', 70, 118, 190, 16, {})];
  const statsOf = (bb) => (bb || []).map((x) => { const m = String(x).split(' — '); return m.length > 1 ? { value: m[0], label: m[1] } : null; }).filter(Boolean);
  const { VARY, VSIRA, tarihBol, ikonSec, IKON } = new Function('E', 'head', 'statsOf', 'NAVY', 'BLUE', 'SOFT', 'statBoy', ink.slice(a, b) + ';return { VARY, VSIRA, tarihBol, ikonSec, IKON };')(E, head, statsOf, '#0D1838', '#2F6BFF', '#6A7593', (ss, o) => o[3]);
  const B3 = ['Eylül 2021: Enflasyon %19 iken faiz indirimleri başladı', '2022 – Enflasyon %85 seviyesine yükseldi', '2023: Seçim sonrası politika değişti'];
  const B5 = B3.concat(['2024: Sıkılaşma sürdü', '2025: Dezenflasyon']);
  const icinde = (els, ad) => els.forEach((e) => assert.ok(e.x >= 0 && e.y >= 0 && e.x + e.w <= 960 && e.y + e.h <= 540, ad + ': öğe asetatın dışına taşıyor (' + e.type + ' ' + e.x + ',' + e.y + ' ' + e.w + '×' + e.h + ')'));
  let kurulan = 0;
  Object.keys(VARY).forEach((k) => VARY[k].forEach((f, i) => {
    [B3.slice(0, 1), B3.slice(0, 2), B3, B3.concat(['Dördüncü kısa madde']), B5].forEach((bb) => {
      const veri = k === 'stat' ? ['%19 — Eylül 2021', '%85 — Ekim 2022', '%61,5 — 2023 Ç3'] : bb;
      const els = f('Başlık', veri, { heads: ['Önce', 'Sonra'] });
      if (!els) return;
      kurulan++; icinde(els, k + ' çeşit ' + (i + 1));
      if (k !== 'quote') assert.equal(els[0].type, 'h', 'başlık ilk öğe olmalı (titleOf ilk h\'yi okur)');
      else assert.equal(els.filter((e) => e.type === 't')[0].text, 'Başlık', 'alıntıda ilk metin öğesi atıf olmalı (titleOf onu okur)');
      assert.ok(!els.some((e) => e.muted), 'çeşit yer tutucu basmamalı');
      const yazi = els.filter((e) => e.type === 't' || e.type === 'ul' || e.type === 'h').map((e) => e.text).join(' ');
      els.filter((e) => e.type === 'icon').forEach((e) => assert.ok(IKON[e.icon], 'tanımsız simge: ' + e.icon));
      if (k !== 'stat') (k === 'quote' ? veri.slice(0, 1) : veri).forEach((x) => { const d = k === 'time' ? tarihBol(x) : null; assert.ok(yazi.includes(d ? d[1] : x), k + ' çeşit ' + (i + 1) + ': madde kayboldu'); });
    });
    assert.equal(f('Başlık', [], {}), null, k + ' çeşit ' + (i + 1) + ': boş içerikle klasik düzene dönmeli');
    /* iki kolon çeşidi klasikle aynı madde listesini kullanır; uzun metni otomatik sığdırma küçültür */
    if (k !== 'stat' && k !== 'two') assert.equal(f('Başlık', ['x'.repeat(400), 'y', 'z'], {}), null, 'uzun metin kartlara sıkıştırılmamalı');
  }));
  assert.ok(kurulan >= 24, 'çeşitler kurulmuyor (' + kurulan + ')');
  assert.ok(Object.keys(VARY).reduce((n, k) => n + VARY[k].length, 0) >= 13, 'en az 13 düzen çeşidi olmalı');
  assert.equal(ikonSec('Enflasyon %85 seviyesine yükseldi', 0), 'trend');
  assert.equal(ikonSec('Merkez Bankası kararı', 0), 'bank');
  assert.ok(IKON[ikonSec('hiçbir anahtar sözcük yok', 2)], 'eşleşmeyen madde nötr simge almalı');
  // İki kolon: başlığı yineleyen önek atılır, tek madde büyük metin olur.
  const iki = VARY.two[0]('B', ['Unorthodox: 2021’de faiz indirimleri yapıldı', 'Orthodox: 2023’te faiz yükseltildi'], { heads: ['Unorthodox (faiz indirimi)', 'Orthodox (faiz artırımı)'] });
  assert.ok(iki.some((e) => e.type === 't' && e.text === '2021’de faiz indirimleri yapıldı'), 'başlığı yineleyen önek duruyor');
  assert.ok(!iki.some((e) => e.type === 'ul'), 'tek maddelik kolon madde imiyle basılıyor');
  assert.deepEqual(tarihBol('Eylül 2021: faiz indirimi başladı'), ['Eylül 2021', 'faiz indirimi başladı']);
  assert.deepEqual(tarihBol('16 Temmuz 1969 – Saturn V fırlatıldı'), ['16 Temmuz 1969', 'Saturn V fırlatıldı']);
  assert.equal(tarihBol('Bu değişim eş zamanlı gerçekleşti'), null, 'tarihsiz cümle tarih diye bölünmemeli');
  // Zaman çizelgesi: ilk iki asetat klasik OLMAYAN iki ayrı görünüm alır.
  assert.deepEqual(VSIRA.time.slice(0, 2), [2, 1]);
  assert.match(ink, /if \(!VSIRA\[kind\] \|\| \(kind === 'list' && arr\(s\.warnI\)\.length\) \|\|/,
    'uyarı yalnız listeyi klasikte tutmalı (zaman çizelgesi uyarı yüzünden klasiğe düşüyordu)');
  assert.match(ink, /if \(kind === 'list' && arr\(s\.b\)\.length && arr\(s\.b\)\.length <= 2 && !s\.img\) return 6;/, 'ince asetat boş listeyle basılıyor');
  assert.match(ink, /arr\(d\.rows\)\.length <= 2 \? 27/, 'iki satırlık tablo küçük yazıyla basılıyor');
  assert.match(ink, /if \(yerTutucu\(sl\) \|\| sl\.v \|\|/, 'kartlı düzenin üstüne fotoğraf konuyor');
  assert.match(ink, /lay: sl\.lay \|\| null, v: sl\.v \|\| 0,/, 'çeşit kaydedilmiyor');
});

/* CANLI DESTE (14.11.2026, "Türkiye'de yenilenebilir enerji 2015–2025"):
   beş kaynağın dördü aynı AA haberinin kopyasıydı; deste iki rakamı (442,2 TWh,
   21,5 milyar $) beş asetatta tekrarladı, kurum adlarının listesini "alıntı"
   diye bastı, kaynakçaya adresteki yıl aralığından "(2015)" yazdı. Kalite
   puanı yine de 92 çıktı — yani bunu ölçen bir şey yoktu. */
const SR = require('./_ts-extract.js').loadFromSource('supabase/functions/sunum-research/index.ts', ['numTokens', 'sigNums', 'sameStory', 'dropRepeats', 'isSentence', 'seriesOf', 'timeOk', 'trDec', 'AY', 'findYear']);

test('KAYNAK: aynı ajans haberinin kopyası ikinci kaynak sayılmaz', () => {
  const aa = 'Türkiye 10 yılda güneş ve rüzgardan 442,2 teravatsaat elektrik üretti. 21,5 milyar dolar ithalat önlendi, 354 milyon ton emisyon engellendi.';
  const kopya = 'Güneş ve rüzgarla 21.5 milyar $ cepte kaldı. On yılda 442,2 TWh üretim; 354 milyon ton karbon salımı önlendi. Kurulu güç 36.000 MW.';
  const baska = 'SHURA raporuna göre 2017 sonunda kurulu güç 85 GW idi; rüzgâr 6.516 MW, güneş 3.421 MW. Hedef yüzde 50.';
  assert.equal(SR.sameStory(aa, kopya), true);
  assert.equal(SR.sameStory(aa, baska), false);
  assert.equal(SR.sameStory('2015 yılında başladı, 2025 yılında bitti.', '2015 ve 2025 arasında.'), false, 'yalnız yıllar ortaksa aynı haber denmez');
  assert.match(sr, /\.filter\(\(r: any, i: number, all: any\[\]\) => !all\.slice\(0, i\)\.some\(\(x\) => sameStory\(/, 'kopyalar 7 kaynaklık kesimden ÖNCE düşmeli ki yerlerine başka kaynak girsin');
});

test('KURGU: aynı rakam ikinci kez madde olmaz; özet asetatı hariç', () => {
  const S = (kind, bullets) => ({ kind, bullets, warn: [], stats: [], table: null });
  const d = [S('list', ['442,2 TWh üretildi', '21,5 milyar $ tasarruf', 'Dış ticarete katkı']), S('list', ['Üretilen 442,2 TWh fosil ihtiyacını azaltır', 'İthalat 21,5 milyar $ düştü', 'Maliyetlerde istikrar']), S('time', ['2015: başlangıç', '2025: 442,2 TWh']), S('list', ['442,2 TWh ve 21,5 milyar $ özet'])];
  d[1].warn = [2];
  assert.equal(SR.dropRepeats(d), 1);
  assert.deepEqual(d[1].bullets, ['Maliyetlerde istikrar']); assert.deepEqual(d[1].warn, [0], 'uyarı sırası kalan maddeye kaymalı');
  assert.equal(d[2].bullets.length, 2, 'zaman çizelgesi bozulmaz'); assert.equal(d[3].bullets.length, 1, 'son asetat özet: tekrar serbest');
  assert.ok(sr.indexOf('dropRepeats(slides);') < sr.indexOf('const dropAt ='), 'tek maddeye inen asetatı komşuya taşıyan adım sonra çalışmalı');
});

test('KURGU: alıntı bir cümledir; ad listesi alıntı diye basılmaz', () => {
  assert.equal(SR.isSentence('SHURA Enerji Dönüşümü Merkezi – Avrupa Climate Foundation, Agora Energiewende, Sabancı Üniversitesi ortaklığı'), false);
  assert.equal(SR.isSentence('“Bu, bir insan için küçük bir adım.”'), true);
  assert.match(sr, /if \(k === "quote" && bullets\.length && !isSentence\(bullets\[0\]\)\) k = "list";/);
  assert.match(ink, /b\[0\]\.length < 220 && \/\[\.!\?…\]/, 'istemcinin akıllı düzeni de tek maddeyi cümle değilse alıntıya çevirmemeli');
});

test('KAYNAKÇA: adresteki yıl aralığı yayın yılı değildir', () => {
  assert.equal(SR.findYear('', 'https://www.sondakika.com/guncel/haber-turkiye-2015-2025-te-yenilenebilir-20348209'), '');
  assert.equal(SR.findYear('', 'https://ornek.org/wp-content/uploads/2018/10/rapor.pdf'), '2018');
});

/* Canlı deste (14.11.2026, "Türkiye'de Yenilenebilir Enerji: 2023-2026"):
   sayı asetatındaki %5,7 ve %3,4 iki maddelik ayrı bir asetat olarak yinelendi,
   yıl serisi fotoğraflı liste oldu, çizelgede aynı tarih iki kez basıldı. */
test('KURGU: ondalıklı kısa sayı da tekrar sayılır', () => {
  assert.deepEqual(SR.sigNums('%5,7 güneş'), ['57']);
  assert.deepEqual(SR.sigNums('12 ülke, 2023 yılı'), [], 'iki haneli tam sayı ve yıl ayırt edici değil');
  const S = (kind, bullets, stats) => ({ kind, bullets, warn: [], stats: stats || [], table: null });
  const d = [S('stat', [], [{ value: '%42' }, { value: '%5,7' }, { value: '%3,4' }]), S('list', ['%5,7 güneş', '%3,4 jeotermal', 'Şebeke yatırımı gerekiyor']), S('list', ['özet'])];
  SR.dropRepeats(d);
  assert.deepEqual(d[1].bullets, ['Şebeke yatırımı gerekiyor']);
});

test('KURGU: yıl etiketli çıplak sayılar grafik olur', () => {
  const g = SR.seriesOf(['2000: 27.3 GW', '2023: 110.9 GW', '2024-Kasım: 115 GW']);
  assert.deepEqual(g, { labels: ['2000', '2023', '2024-Kasım'], values: [27.3, 110.9, 115], unit: 'GW' });
  assert.deepEqual(SR.seriesOf(['2021: %19', '2022: %85', '2023: %61,5']).values, [19, 85, 61.5]);
  assert.deepEqual(SR.seriesOf(['2021: 1.250 MW', '2022: 1.900 MW', '2023: 2.400 MW']).values, [1250, 1900, 2400], 'binlik nokta ondalık değil');
  assert.equal(SR.seriesOf(['2000: 27 GW', '2023: 110 TWh', '2024: 115 GW']), null, 'birimler karışıksa grafik olmaz');
  assert.equal(SR.seriesOf(['2021: faiz indirimi başladı', '2022: enflasyon %85', '2023: politika değişti']), null, 'cümle seri değildir');
  assert.equal(SR.seriesOf(['2000: 27 GW', '2023: 110 GW']), null, 'iki nokta grafik etmez');
  assert.match(sr, /const ser = k === "list" && !warn\.length \? seriesOf\(bullets\) : null;/, 'doğrulanamayan sayı grafiğe taşınmaz');
});

test('KURGU: zaman çizelgesinde her durağın kendi tarihi olur', () => {
  assert.equal(SR.timeOk(['2023: kurulu güç arttı', '2035: hedef %53', '2035: yatırım planı']), false);
  assert.equal(SR.timeOk(['Eylül 2021: indirim', '2022 – zirve', '2023: dönüş']), true);
  assert.match(sr, /if \(k === "time" && !timeOk\(bullets\)\) k = "list";/);
});

test('KURGU: Türkçe destede ondalık virgülle yazılır; tarih ve binlik bozulmaz', () => {
  assert.equal(SR.trDec('27.3 GW ve %5.75'), '27,3 GW ve %5,75');
  assert.equal(SR.trDec('14.11.2026 tarihinde 1.250 MW'), '14.11.2026 tarihinde 1.250 MW');
  assert.equal(SR.trDec('Sürüm 1.2.3'), 'Sürüm 1.2.3');
  assert.match(sr, /const yaz = \(t: string\) => lang === "en" \? t : trDec\(t\);/);
});

test('KURGU: istem akademik derinlik ister (kavram, neden, karşılaştırma, sınırlılık)', () => {
  assert.match(sr, /ACADEMIC DEPTH:/); assert.match(sr, /limitations, risks, open debates/);
  assert.match(sr, /A bullet is an analytical statement, not a label: 12-22 words/);
  assert.match(sr, /start each bullet with a 2-4 word key term and a colon/, 'kolonlu düzen bu biçime bağlı');
});

/* Hazır PowerPoint taslaklarından alınan iskeletler (14.11.2026). */
test('DÜZEN: kolonlu içerik, almaşık çizelge, tek punto sayılar', () => {
  const a = ink.indexOf('  var tarihBol = '), b = ink.indexOf('  var VSIRA = ');
  let id = 0; const E = (type, x, y, w, h, o) => Object.assign({ id: ++id, type, x, y, w, h, text: '', size: 24 }, o), head = (t) => [E('h', 70, 46, 820, 74, { text: t, size: 42 })];
  const statsOf = (bb) => bb.map((x) => { const m = String(x).split(' — '); return { value: m[0], label: m[1] }; });
  const sb = ink.match(/var statBoy = function[^\n]+/)[0];
  const { VARY, statBoy } = new Function('E', 'head', 'statsOf', 'NAVY', 'BLUE', 'SOFT', 'TINT', 'ikonSec', 'kisa', sb + ';' + ink.slice(a, b).replace(/var (ikonSec|kisa) = /g, 'var _$1 = ') + ';return { VARY, statBoy };')(E, head, statsOf, '#0', '#1', '#2', ['a', 'b', 'c', 'd'], () => 'check', (bb, lo, hi, max) => bb && bb.length >= lo && bb.length <= hi && bb.every((x) => String(x).length <= max));
  const K = ['Şebeke esnekliği: depolama ve talep yönetimi olmadan güneş üretimi öğle saatinde kesilir', 'Finansman maliyeti: yüksek faiz, sermaye yoğun rüzgâr projelerini geciktirir', 'İthalat bağımlılığı: panel ve türbin tedariki döviz kuruna duyarlıdır'];
  const kol = VARY.list[6]('B', K);
  assert.equal(kol.filter((e) => e.bold).length, 3, 'her kolonun alt başlığı olmalı');
  assert.ok(kol.some((e) => e.text === 'Şebeke esnekliği') && kol.some((e) => /^Depolama ve talep/.test(e.text)), 'terim başlığa, açıklama gövdeye');
  assert.equal(VARY.list[6]('B', ['Düz bir madde, iki nokta yok burada hiç', K[1], K[2]]), null, 'terimsiz madde kolon olmaz');
  assert.match(ink, /every\(function \(x\) \{ return \/\^\[\^:\]\{3,36\}:\\s\+\.\{20,\}\$\/\.test\(String\(x\)\); \}\)\) return 7;/, 'kolon düzeni içerikten seçilmeli');
  const cz = VARY.time[3]('B', ['2021: faiz indirimi başladı', '2022: enflasyon zirve yaptı', '2023: politika değişti', '2024: sıkılaşma sürdü']);
  const ys = cz.filter((e) => e.bold).map((e) => e.y);
  assert.ok(ys[0] < 322 && ys[1] > 322 && ys[2] < 322 && ys[3] > 322, 'duraklar eksenin üstünde ve altında sırayla durmalı');
  cz.forEach((e) => assert.ok(e.x >= 0 && e.y >= 0 && e.x + e.w <= 960 && e.y + e.h <= 540));
  assert.equal(VARY.time[3]('B', ['tarihsiz bir adım cümlesi', '2022: b adımı burada', '2023: c adımı burada']), null);
  assert.equal(statBoy([{ value: '%5,7' }, { value: '115 GW' }, { value: '21,5 milyar $' }], [36, 48, 58, 72]), 36, 'en uzun sayı puntoyu belirler');
  const st = VARY.stat[0]('B', ['%5,7 — a', '115 GW — b', '21,5 milyar $ — c']).filter((e) => e.type === 'h' && e.text !== 'B');
  assert.equal(new Set(st.map((e) => e.size)).size, 1, 'aynı sıradaki sayılar farklı puntoda');
});

/* 92/100 alan canlı deste (14.11.2026) kullanıcıya "çok basit ve boş" göründü:
   puanlayıcı ince asetatı ve yinelenen rakamı görmüyordu. */
test('KALİTE: ince asetat ve yinelenen rakam puandan düşer', () => {
  const D = require('./_ts-extract.js').loadFromSource('supabase/functions/acadia-presentation-director/index.ts', ['cleanText', 'words', 'repeatedFacts', 'qualityDeck']);
  const not = 'Bu asetatta konuyu ayrıntılı biçimde anlatan, dinleyiciye örnek veren ve sonraki asetata köprü kuran yeterince uzun bir konuşma notu bulunuyor; kısa sayılmamalı.';
  const S = (v, text, vis) => ({ title: 'B' + Math.random(), speaker_notes: not, content: { text, design_variant: v, has_visual: !!vis, placeholder: false } });
  const dolu = 'Şebeke esnekliği: depolama ve talep yönetimi olmadan güneş üretimi öğle saatlerinde kesintiye uğrar ve yatırım geri dönüşü uzar.';
  const iyi = { title: 'x', slides: [S('cover', '', 1), S('stat', '%5,7 güneş %3,4 jeotermal 115 GW', 0), S('list', dolu, 1), S('chart', '', 1), S('list', dolu + ' 115 GW.', 0), S('end', '', 0)] };
  const q1 = D.qualityDeck(iyi, 6, 'topic');
  assert.ok(!q1.issues.includes('thin_slides') && !q1.issues.includes('repeated_facts'), 'sayı asetatı ince sayılmaz; sonuç asetatı rakamı yineleyebilir (' + q1.issues + ')');
  const kotu = { title: 'x', slides: [S('cover', '', 1), S('stat', '%5,7 güneş %3,4 jeotermal 115 GW', 0), S('list', '%5,7 güneş [1]\n%3,4 jeotermal [1]', 0), S('list', dolu, 1), S('list', dolu, 1), S('end', '', 0)] };
  const q2 = D.qualityDeck(kotu, 6, 'topic');
  assert.ok(q2.issues.includes('thin_slides'), 'iki kısa maddelik asetat ince'); assert.ok(q2.issues.includes('repeated_facts'), 'aynı iki rakam iki asetatta');
  assert.ok(q2.score <= q1.score - 12, 'puan belirgin düşmeli (' + q1.score + ' → ' + q2.score + ')');
  assert.equal(D.repeatedFacts(['2023 yılında 12 ülke', '2023 yılında 12 şirket']), 0, 'yıl ve küçük tam sayı yineleme değil');
  assert.ok(ink.includes("thin_slides: 'bazı asetatlar çok ince") && ink.includes('repeated_facts:'), 'yeni sorunların Türkçe karşılığı yok');
});

summary();
