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
  assert.match(sr, /queries = \[\.\.\.new Set\(\[topic, \.\.\.\(aq\.length > 3 \? \[aq\] : \[\]\), \.\.\.qs\.slice\(-2\)\]\.map\(\(q\) => tarihSorgu\(topic, q\)\)\)\]\.slice\(0, 4\)/,
    'konu + alt başlık + veri + İngilizce sorgu aranmalı; en çok 4 sorgu (Tavily kredisi)');
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
  assert.match(sr, /"openai\/gpt-oss-20b", sys, `TOPIC: \$\{topic\}\$\{plan\}\\n\\nSOURCES:\\n` \+ srcBlock\(9000\)/, 'yedek deneme aynı büyük istekle gidiyor');
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
  assert.match(ink, /s\.k !== 'cover' && s\.k !== 'end' && s\.k !== 'refs' && !notYeter\(s\.notes\)\) \{ AI\.note\(sl, true\)/, 'kaynakça notu listeyi okuyor');
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
  // Canlı deste 14.11.2026 (asgari ücret): tek maddelik asetatın komşuları kapak ve
  // zaman çizelgesiydi, asetat kaldı → en yakın listeye taşınır. Aynı destede kolon
  // düzeni hiç çıkmadı: yazar her asetata fotoğraf ipucu koyuyor, "!s.img" koşulu eliyordu.
  assert.match(sr, /Math\.abs\(j - i\)[^\n]*o\.y\.bullets\.length < 4\)\.sort/, 'tek madde yalnız bitişik listeye taşınıyor');
  const vs = ink.slice(ink.indexOf('var vSay = {}, vSec'), ink.indexOf('push(); var made = strips.map'));
  assert.ok(!/var kol = [^\n]*s\.img/.test(vs), 'fotoğraf ipucu kolon düzenini engelliyor');
  assert.match(vs, /if \(kol && !vSay\.kol\) \{ vSay\.kol = 1; return 7; \}/, 'art arda kolon sınırı yok');
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
  assert.match(sr, /\.map\(\(x: any\) => dropLead\(dropAttr\(dropDated\(cleanCite\(String\(x \|\| ""\)\)\)\)\)\)\.filter\(Boolean\)\.slice\(0, 6\)/, 'maddeler temizlenmiyor');
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
  assert.match(sr, /\+ trust\(hostOf\(b\.url\)\) \+ 0\.12 \* b\._asp - \(Number\(a\.score\) \|\| 0\) - trust\(hostOf\(a\.url\)\)/, 'sıralama kurumsal kaynağı öne almıyor');
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
  const { VARY, VSIRA, tarihBol, ikonSec, IKON } = new Function('E', 'head', 'statsOf', 'NAVY', 'BLUE', 'SOFT', 'statBoy', 'arr', 'chartVals', ink.slice(a, b) + ';return { VARY, VSIRA, tarihBol, ikonSec, IKON };')(E, head, statsOf, '#0D1838', '#2F6BFF', '#6A7593', (ss, o) => o[3], (x) => (Array.isArray(x) ? x : []), (d) => (d && Array.isArray(d.data) ? d.data : []));
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
  // 25.11.2026: uyarı hiçbir türü klasiğe kilitlemez (işaret her yazı öğesine çizilir)
  assert.doesNotMatch(ink, /arr\(s\.warnI\)\.length\) \{ vSay\.tek = 1;/, 'uyarı listeyi yine klasiğe kilitliyor');
  assert.match(ink, /if \(kind === 'list' && arr\(s\.b\)\.length && arr\(s\.b\)\.length <= 2 && !s\.img\) return vSay\.aile === LAILE\[6\] \? 0 : 6;/, 'ince asetat boş listeyle basılıyor');
  assert.match(ink, /arr\(d\.rows\)\.length <= 2 \? 27/, 'iki satırlık tablo küçük yazıyla basılıyor');
  assert.match(ink, /if \(yerTutucu\(sl\) \|\| sl\.v \|\|/, 'kartlı düzenin üstüne fotoğraf konuyor');
  assert.match(ink, /lay: sl\.lay \|\| null, v: sl\.v \|\| 0,/, 'çeşit kaydedilmiyor');
});

/* CANLI DESTE (14.11.2026, "Türkiye'de yenilenebilir enerji 2015–2025"):
   beş kaynağın dördü aynı AA haberinin kopyasıydı; deste iki rakamı (442,2 TWh,
   21,5 milyar $) beş asetatta tekrarladı, kurum adlarının listesini "alıntı"
   diye bastı, kaynakçaya adresteki yıl aralığından "(2015)" yazdı. Kalite
   puanı yine de 92 çıktı — yani bunu ölçen bir şey yoktu. */
const SR = require('./_ts-extract.js').loadFromSource('supabase/functions/sunum-research/index.ts', ['numTokens', 'pctOf', 'sigNums', 'sameStory', 'dropRepeats', 'isSentence', 'seriesOf', 'timeOk', 'trDec', 'AY', 'findYear']);

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
  assert.match(sr, /const yaz = \(t: string\) => yazim\(t, lang\);/);
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
  assert.match(ink, /every\(function \(x\) \{ return \/\^\[\^:\]\{3,36\}:\\s\+\.\{20,\}\$\/\.test\(String\(x\)\); \}\);\s+if \(kol && !vSay\.kol\)/, 'kolon düzeni içerikten seçilmeli');
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
test('YAZIM: kesilmez tire, ISO tarih, yüzde işareti; başlıksız "two" listeye iner; aralık sayı diye bölünmez', () => {
  // Canlı deste 14.11.2026 (asgari ücret, ikinci): sayı asetatı "%1 | ‑2 — Enflasyon artışı"
  // diye basıldı, çizelge "2016‑01‑01" yazdı, sınırlılıklar "birinci taraf / ikinci taraf" çıktı.
  const { yazim } = require('./_ts-extract.js').loadFromSource('supabase/functions/sunum-research/index.ts', ['AYLAR', 'trDec', 'yazim']);
  assert.strictEqual(yazim('%1\u20112 puan', 'tr'), '%1-2 puan');
  assert.strictEqual(yazim('2016\u201101\u201101: zam', 'tr'), '1 Ocak 2016: zam');
  assert.strictEqual(yazim('2016-12-31', 'en'), '31 December 2016');
  assert.strictEqual(yazim('10% zam, 0.11-0.27% GSYİH', 'tr'), '%10 zam, %0,11-0,27 GSYİH');
  assert.strictEqual(yazim('%10 zam ve 2005-2024 dönemi', 'tr'), '%10 zam ve 2005-2024 dönemi');
  assert.strictEqual(yazim('10% rise', 'en'), '10% rise');
  assert.match(sr, /if \(k === "two" && \(!Array\.isArray\(s\.heads\)[^\n]*k = "list";/, 'taraf adı olmayan "two" yer tutucuyla basılıyor');
  assert.ok(sr.includes('never invent a day or month'), 'çizelgede uydurma gün/ay yasağı yok');
  assert.match(ink, /\|\| \/\^\\s\*\[-‑–—\]\\s\*\\d\/\.test\(m\[3\]\)\) return null;/, 'aralık sayı ve etiket diye bölünüyor');
});

test('KURGU: iki kolonda madde kendi tarafına dizilir; "nasıl/yolları" konusu yanıtlanır', () => {
  // Canlı deste 14.11.2026 ("Parayı Enflasyona Ezdirmeme Yolları"): "2023: …" ve "2026: …"
  // ikisi de sol kolona düştü; destede tek bir "yol" yoktu, hepsi enflasyon verisiydi.
  const { sidesOf } = require('./_ts-extract.js').loadFromSource('supabase/functions/sunum-research/index.ts', ['sidesOf']);
  const r = sidesOf(['2023: Ortalama %65', '2026: Ekimde %29,77', 'Fark: 35 puan'], ['2023', '2026'], [2]);
  assert.deepStrictEqual(r.bullets, ['2023: Ortalama %65', 'Fark: 35 puan', '2026: Ekimde %29,77']);
  assert.deepStrictEqual(r.warn, [1], 'uyarı maddesiyle birlikte taşınmalı');
  const same = ['Enflasyon düştü', 'Faiz arttı'];
  assert.strictEqual(sidesOf(same, ['TCMB', 'SBB'], []).bullets, same, 'öneki olmayan maddelere dokunulmamalı');
  assert.ok(sr.includes('ANSWER THE TOPIC AS PHRASED'), 'kurgu istemi konunun sorduğunu yanıtlatmıyor');
  assert.ok(sr.includes('must search for those ways themselves'), 'sorgu planı yöntemleri aramıyor');
});

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


test('KALİTE ÖLÇÜMÜ CANLI YOLDAN GEÇER: critique normalize sonrası ölçülen alanları geri koyar', () => {
  // Canlı 14.11.2026: art arda dört deste 92 aldı, hepsinde tek sorun visual_repetition.
  // normalizeSlide 'list'/'two'/'time' adını 'section' yapıyor, has_visual ve placeholder
  // alanlarını atıyordu: ölçülen dal hiç çalışmadı, her deste "üç section art arda" sayıldı.
  // Önceki test qualityDeck'i doğrudan çağırdığı için bunu göremedi; bu test gerçek yoldan gider.
  const D = require('./_ts-extract.js').loadFromSource('supabase/functions/acadia-presentation-director/index.ts', ['allowedLayouts', 'allowedVariants', 'allowedVisuals', 'allowedChartTypes', 'allowedDiagramTypes', 'cleanText', 'words', 'repeatedFacts', 'normalizeTable', 'normalizeChart', 'normalizeCards', 'normalizeSteps', 'normalizeDiagram', 'normalizeSlide', 'normalizeDeck', 'restoreMeasured', 'qualityDeck']);
  const not = 'Bu asetatta konuyu ayrıntılı biçimde anlatan, dinleyiciye örnek veren ve sonraki asetata köprü kuran yeterince uzun bir konuşma notu bulunuyor; kısa sayılmamalı.';
  const dolu = 'Şebeke esnekliği: depolama ve talep yönetimi olmadan güneş üretimi öğle saatlerinde kesintiye uğrar ve yatırım geri dönüşü uzar.';
  const S = (lay, v, text, vis) => ({ title: lay + v + text.length + Math.random(), speaker_notes: not, content: { text, design_variant: lay, look: lay + ':' + v, has_visual: !!vis, placeholder: false } });
  const olc = (slides) => { const raw = { title: 'x', slides }; const d = D.normalizeDeck(raw, slides.length, 'topic'); D.restoreMeasured(d, raw); return D.qualityDeck(d, slides.length, 'topic'); };
  const iyi = olc([S('cover', 0, '', 1), S('list', 7, dolu, 0), S('time', 2, dolu, 1), S('two', 1, dolu, 0), S('stat', 1, '6,81 puan gıda', 1), S('list', 1, dolu, 0), S('refs', 0, 'kaynak', 0), S('end', 0, '', 0)]);
  assert.ok(!iyi.issues.includes('visual_repetition'), 'çeşitli düzenli deste yineleme sayılıyor (' + iyi.issues + ')');
  const ayni = olc([S('cover', 0, '', 1), S('list', 0, dolu, 1), S('list', 0, dolu, 1), S('list', 0, dolu, 1), S('stat', 1, '6,81 puan', 1), S('end', 0, '', 0)]);
  assert.ok(ayni.issues.includes('visual_repetition'), 'üç klasik liste art arda yinelemedir');
  const cesit = olc([S('cover', 0, '', 1), S('list', 0, dolu, 1), S('list', 7, dolu, 1), S('list', 1, dolu, 1), S('stat', 1, '6,81 puan', 1), S('end', 0, '', 0)]);
  assert.ok(!cesit.issues.includes('visual_repetition'), 'aynı tür ama farklı çeşit yineleme değildir');
  const ince = olc([S('cover', 0, '', 0), S('list', 0, 'kısa madde [1]', 0), S('list', 7, dolu, 0), S('two', 1, dolu, 0), S('time', 2, dolu, 0), S('end', 0, '', 0)]);
  assert.ok(ince.issues.includes('thin_slides') && ince.issues.includes('few_visuals'), 'ölçülen dal canlı yolda çalışmıyor (' + ince.issues + ')');
  assert.match(ink, /look: \(x\.lay \|\| 'section'\) \+ ':' \+ \(x\.v \|\| 0\)/, 'istemci düzen çeşidini göndermiyor');
});

test('ATIF: madde sonundaki kaynak adı atılır, asetatta tek "[n]" kalır', () => {
  // Canlı deste 14.11.2026: "… yükselmiştir (SBB ölçümü). [1, 3]", "(Devlet). [2, 4]" — her
  // maddede hem parantezli ad hem aynı etiket vardı.
  assert.match(sr, /const dropAttr = \(b: string\) =>/, 'kaynak adı süzgeci yok');
  assert.ok(sr.includes('Never put a source name in parentheses') && sr.includes('Never compute a number yourself'), 'istemde parantezli kaynak / hesaplanmış sayı yasağı yok');
  const flat = (t) => t.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const srcs = [{ site: 'sbb.gov.tr', title: 'Enflasyon' }, { site: 'npr.org', title: 'Turks often keep gold' }, { site: 'worldbank.org', title: 'Report' }];
  const body = sr.match(/const srcWords = [^\n]+\n\s*const dropAttr = [^\n]+/)[0].replace(/: string/g, '').replace(/\(x\) =>/, '(x) =>');
  const dropAttr = new Function('flat', 'srcs', body + '; return dropAttr;')(flat, srcs);
  assert.equal(dropAttr('TÜFE %29,77 oldu (SBB).'), 'TÜFE %29,77 oldu.');
  assert.equal(dropAttr('Zam uygulandı (World Bank)'), 'Zam uygulandı');
  assert.equal(dropAttr('Program yayımlandı (Devlet).'), 'Program yayımlandı.');
  assert.equal(dropAttr('Tüketici Fiyat Endeksi (TÜFE).'), 'Tüketici Fiyat Endeksi (TÜFE).', 'kısaltma açıklaması kalmalı');
  assert.equal(dropAttr('Etki sınırlı (önemsiz)'), 'Etki sınırlı (önemsiz)');
  const cm = ink.match(/var cite = function \(st, srcs\) \{[\s\S]*?\n  \};/)[0];
  const cite = new Function('arr', 'curLang', cm + '; return cite;')((x) => Array.isArray(x) ? x : [], () => 'tr');
  const st = [{ k: 'time', src: ['a', 'b'], b: ['2023: faiz arttı', '2024: program', '2026: tahmin %29,5'] }, { k: 'stat', src: ['a'], b: ['6,81 — gıda', '6,10 — ulaştırma', '4,71 — konut'] }, { k: 'list', src: ['b'], b: ['Terim: açıklama', 'Öteki: açıklama'] }];
  cite(st, [{ id: 'a' }, { id: 'b' }]);
  st.forEach((s) => assert.equal(s.b.join(' ').split('[').length - 1, 1, s.k + ': atıf bir kez basılmalı (' + s.b.join(' | ') + ')'));
  assert.ok(/\[1, 2\]$/.test(st[0].b[2]) && /\[2\]$/.test(st[2].b[1]));
});

test('GÖRSEL BİÇİMİ: kutu fotoğrafın oranına uyar, bayrak/SVG fotoğraf sayılmaz, seçili görselde "resmi değiştir" çıkar', () => {
  // Canlı deste 14.11.2026 ("Türkiye'de Parayı Enflasyona Ezdirmeme Yolları"): kapağa Wikipedia'nın
  // "Turkey" maddesinden Flag_of_Turkey.svg geldi ve sabit 340×400 dik kutuda kırpıldı (ay-yıldız yarım).
  // Kullanıcı ayrıca beğenmediği resmi üstüne basıp değiştirmek istedi.
  const fk = ink.match(/var fotoKutu = function \(p, mw, mh\) \{[^\n]+\};/)[0];
  const fotoKutu = new Function(fk + '; return fotoKutu;')();
  assert.deepEqual(fotoKutu({ w: 1200, h: 800 }, 340, 400), { w: 340, h: 227 }, 'yatay görsel dik kutuya kırpılmamalı');
  assert.deepEqual(fotoKutu({ w: 800, h: 1200 }, 340, 400), { w: 267, h: 400 }, 'dik görsel yüksekliğe sığmalı');
  assert.ok(!/sl\.lay === 'cover'\) \{ w = 340; h = 400;/.test(ink), 'kapak kutusu yine sabit 340×400');
  assert.match(ink, /var k = fotoKutu\(p, old\.w,[\s\S]{0,400}x\.y = old\.y \+ old\.h \+ 4/, 'fotoğraf değişince kutu ve künye yeni orana taşınmıyor');
  const W = require('./_ts-extract.js').loadFromSource('supabase/functions/sunum-research/index.ts', ['NOT_PHOTO', 'wikiNotPhoto']);
  assert.equal(W.wikiNotPhoto('Flag_of_Turkey.svg', 'https://upload.wikimedia.org/x/Flag_of_Turkey.svg/1200px-Flag_of_Turkey.svg.png'), true);
  assert.equal(W.wikiNotPhoto('Coat_of_arms_of_X.png', 'https://upload.wikimedia.org/x.png'), true);
  assert.equal(W.wikiNotPhoto('Ada_Lovelace_portrait.jpg', 'https://upload.wikimedia.org/a.jpg'), false);
  assert.match(sr, /if \(wikiNotPhoto\(String\(pg\.pageimage \|\| ""\), String\(th\.source\)\)\) continue;/, 'madde görseli süzülmüyor');
  // "resmi değiştir": yalnız düzenleme sahnesinde ve seçiliyken; basınca sürükleme başlamaz, arama penceresi açılır
  assert.match(ink, /edit && e\.type === 'img' && e\.src \? '<b class="sx-chg" data-imchg="">resmi değiştir<\/b>'/, 'düğme yok ya da küçük resimlere/yansıya da basılıyor');
  assert.match(ink, /if \(e\.target\.closest\('\[data-imchg\]'\)\) \{ imOpen\(el\); return; \}\s*drag = /, 'düğmeye basınca pencere açılmıyor / sürükleme başlıyor');
  assert.match(css, /\.sx-el\.sel > \.sx-chg\{display:block\}/, 'düğme seçiliyken görünmüyor');
  // grafikten listeye düşen maddeler de yazım kuralından geçer ("2025: 15.2 %" basılmıştı)
  const Y = require('./_ts-extract.js').loadFromSource('supabase/functions/sunum-research/index.ts', ['AYLAR', 'trDec', 'yazim']);
  assert.equal(Y.yazim('2025: 15.2%', 'tr'), '2025: %15,2');
  assert.match(sr, /s\.bullets\.push\(yazim\(`\$\{s\.chart\.labels\[i\] \|\| ""\}: \$\{v\}\$\{s\.chart\.unit === "%" \? "%" :/, 'grafik yedeği yazım kuralından geçmiyor');
});

test('KONUYA SADAKAT: araştırma konunun alt başlıklarını arar, kaynağı ona göre seçer, yazara plan olarak verir', () => {
  // Canlı deste 14.11.2026, "Türkiye'de Parayı Enflasyona Ezdirmeme Yolları": dört kaynağın dördü de
  // enflasyon verisi/hükümet programıydı (sbb.gov.tr, aa.com.tr, tbmm.gov.tr, tradingeconomics). Deste
  // "sıkı para politikası, mali disiplin" anlattı; altın, mevduat, döviz, fon TEK kez geçmedi. Kök sebep
  // yazım değil araştırmaydı: planın q1'i atılıyor, q2 "konunun verisi" (= enflasyon rakamı) arıyor,
  // kurumsal kaynak önceliği de bireysel yatırım yazılarını eliyordu.
  assert.ok(sr.includes('"aspects":["a1","a2","a3","a4","a5"]') && sr.includes('"aq":'), 'sorgu planı alt başlık çıkarmıyor');
  assert.match(sr, /queries = \[\.\.\.new Set\(\[topic, \.\.\.\(aq\.length > 3 \? \[aq\] : \[\]\), \.\.\.qs\.slice\(-2\)\]\.map\(\(q\) => tarihSorgu\(topic, q\)\)\)\]\.slice\(0, 4\)/, 'alt başlık sorgusu aranmıyor');
  assert.match(sr, /r\._asp >= 2 \|\| all\.filter/, 'alt başlıkları taşıyan kaynak kurumsal sınıra takılıyor');
  assert.match(sr, /keysOf\(\[topic, topicEn, \.\.\.queries, \.\.\.aspects\]/, 'paragraf seçimi alt başlıkları bilmiyor');
  assert.ok(sr.includes('AUDIENCE EXPECTS and ASPECTS') && sr.includes('They are NOT facts'), 'yazar plana uymuyor ya da planı olgu sanabilir');
  assert.match(sr, /engine: \{ \.\.\.engine, focus \}/, 'odak ölçümü dönmüyor');
  assert.match(sr, /console\.log\(`sunum arastirma: /, 'teşhis satırı yok');
  const { aspHit } = require('./_ts-extract.js').loadFromSource('supabase/functions/sunum-research/index.ts', ['aspHit']);
  const asp = ['altın', 'mevduat faizi', 'döviz', 'yatırım fonu'];
  assert.equal(aspHit(asp, 'TÜFE yıllık %29,77 oldu; Merkez Bankası politika faizini artırdı. Altı ayda bütçe açığı daraldı.'), 0, 'veri sayfası alt başlık taşımaz ("altı" ≠ "altın", "faiz" tek başına yetmez)');
  assert.equal(aspHit(asp, 'Altının yıllık getirisi enflasyonu aştı; mevduat faizleri ise geride kaldı. Dövizde ve yatırım fonlarında tablo karışık.'), 4);
});

test('CANLI DESTE 14.11 (irade): madde içi kaynak girişi, yayın yılı öneki, başlıksız "two", kapanış notu', () => {
  // "İradeyi Güçlendirme Nasıl Başlar?": maddeler "Kaynaklar (hiwellapp.com, 2018) gösteriyor ki, …"
  // diye başlıyordu; 7. asetat "birinci taraf / ikinci taraf" yer tutucusuyla basıldı ve üç maddesi de
  // "2016 – …" ile açılıyordu (2016 olay tarihi değil, kaynağın yayın yılı); kapanış asetatı ilk üç
  // başlığı listelerken notu son üçünü sayıyordu.
  const body = sr.match(/const dropLead = [\s\S]+?\n    const dropYear = [^\n]+/)[0].replace(/\((b|bs): string(\[\])?\)/g, '($1)');
  const { dropLead, dropYear } = new Function('lang', body + '; return { dropLead, dropYear };')('tr');
  assert.equal(dropLead('Kaynaklar (hiwellapp.com, 2018) gösteriyor ki, küçük hedefler iradeyi güçlendirir.'), 'Küçük hedefler iradeyi güçlendirir.');
  assert.equal(dropLead('Kaynak (acikbeyin.com) bildiriyor ki, meditasyon dikkati artırır.'), 'Meditasyon dikkati artırır.');
  assert.equal(dropLead('Kaynaklara göre irade bir kas gibi çalışır.'), 'İrade bir kas gibi çalışır.');
  assert.equal(dropLead('Uyku düzeni öz denetimi etkiler (sciencefocus.com).'), 'Uyku düzeni öz denetimi etkiler.');
  // kişi + yıl atfı ve sıradan madde değişmez
  for (const b of ['Tim Bono (2016) vurgular: küçük adımlar kalıcıdır.', 'Kaynak suyu şişelenirken (pH 7,2) ölçülür.', 'TÜFE (2003=100) yıllık %29,77 oldu.']) assert.equal(dropLead(b), b);
  assert.deepEqual(dropYear(['2016 – şeker reddi iradeyi yorar', '2016 – telefon bildirimleri dikkati böler']), ['Şeker reddi iradeyi yorar', 'Telefon bildirimleri dikkati böler']);
  const cizelge = ['1998 – ilk deney yapıldı', '2007 – glikoz çalışması', '2016 – tekrar çalışması'];
  assert.deepEqual(dropYear(cizelge), cizelge, 'gerçek zaman çizelgesi bozulmaz');
  assert.deepEqual(dropYear(['2016 – tek madde']), ['2016 – tek madde']);
  assert.match(sr, /dropYear\(\(Array\.isArray\(s\.bullets\)[^\n]+dropLead\(dropAttr\(dropDated\(cleanCite\(/, 'süzgeçler maddelere uygulanmıyor');
  assert.ok(sr.includes('never write a domain name') && sr.includes('never the publication year of the source'), 'istemde alan adı / yayın yılı yasağı yok');
  // taraf adı harf/rakam taşımıyorsa ("—", "…") "two" listeye iner — sunucuda da istemcide de
  assert.match(sr, /s\.heads\.slice\(0, 2\)\.filter\(\(h: any\) => \/\[\\p\{L\}\\d\]\/u\.test\(String\(h \|\| ""\)\)\)\.length < 2\)\) k = "list"/);
  const fr = new Function('arr', 'txt', ink.slice(ink.indexOf('  var fromResearch = '), ink.indexOf('  var smartKind = ')) + '; return fromResearch;')((x) => (Array.isArray(x) ? x : []), (x) => String(x == null ? '' : x).trim());
  const tur = (heads) => fr({ slides: [{ title: 'Karşılaştırma', kind: 'two', bullets: ['a maddesi', 'b maddesi'], heads }] }).items[0].k;
  assert.equal(tur(['Kısa vade', 'Uzun vade']), 'two'); assert.equal(tur([]), 'list'); assert.equal(tur(['—', '']), 'list'); assert.equal(tur(undefined), 'list');
  // kapanış notu asetatta yazan maddeleri sayar
  assert.match(ink, /var sonB = function \(sl\) \{ var u = sl\.els\.filter\(function \(e\) \{ return e\.type === 'ul' && !e\.muted && e\.text; \}\)\[0\];/);
  assert.equal(ink.split("sonB(sl).join(', ')").length - 1, 2, 'TR ve EN kapanış notu aynı kaynaktan yazılmalı');
});

test('CANLI DESTE 14.11 (zaman yönetimi) — sunucu: "(src1)", uydurma sayı asetatı, yinelenen fikir, nota uymayan cümle', () => {
  /* Destede: maddelerde ve alıntıda "(src1)" / "(src2, src4)"; Pomodoro'nun 25 ve
     5 dakikası "Sabah: dakika · Öğle: dakika · Akşam: dakika" diye günlük rutin
     sayıları olarak basıldı; "araç seçimi: dijital ya da fiziksel planlayıcı"
     üç asetatta yinelendi; notlar "Bu slide", "Udemy kaynağı…" diyor ve listeye
     inmiş asetat için "bu çizgi grafikte" diye anlatıyordu. */
  const pick = (a, b) => { const i = sr.indexOf(a), j = sr.indexOf(b, i); assert.ok(i > 0 && j > i, a + ' bulunamadı'); return sr.slice(i, j); };
  const ts = require('typescript');
  const js = ts.transpileModule(pick('const keysOf', 'const aspHit') + pick('const dropEchoes', '/* "Alıntı" bir cümledir') + pick('const cleanCite', 'async function groq'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const f = new Function(js + ';return { cleanCite, statOdd, noteFit, dropEchoes };')();
  assert.equal(f.cleanCite('Pomodoro odaklanmayı artırır (src1). Bitti [src 2, src4]'), 'Pomodoro odaklanmayı artırır. Bitti');
  assert.equal(f.cleanCite('Öncelik matrisi (src2, src4) işleri ayırır (Kaynak 3)'), 'Öncelik matrisi işleri ayırır');
  assert.equal(f.cleanCite('Kaynak yönetimi (2023) önemlidir'), 'Kaynak yönetimi (2023) önemlidir', 'yıl ve düz sözcük silinmemeli');
  assert.equal(f.statOdd([{ value: '25', label: 'Sabah: dakika' }, { value: '5', label: 'Öğle: dakika' }, { value: '25', label: 'Akşam: dakika' }]), 2, '"ad: birim" etiketli dizi uydurmadır');
  assert.equal(f.statOdd([{ value: '%25', label: 'kadın' }, { value: '%25', label: 'erkek' }, { value: '%3', label: 'öteki' }]), 1, 'yinelenen değer listeye iner');
  assert.equal(f.statOdd([{ value: '%19', label: 'Eylül 2021' }, { value: '%85', label: 'Ekim 2022' }, { value: '%61,5', label: '2023 üçüncü çeyrek: yıllık enflasyon oranı' }]), 0, 'sağlam sayı asetatı elenmemeli');
  assert.match(sr, /if \(k === "stat" && statOdd\(stats\)\) \{ k = "list"; if \(statOdd\(stats\) === 2\) stats = \[\]; \}/, 'uydurma dizi maddeye çevrilmemeli');
  const not = f.noteFit({ notes: 'Bu slide’da üç araç var. Bu çizgi grafikte sabah saatleri görülüyor. Udemy kaynağı bunu doğruluyor. Sonuç slide’ı önemli. Slide bitti.' }, 'tr');
  assert.equal(not, 'Bu slaytta üç araç var. Sonuç slaytı önemli. Slayt bitti.');
  assert.match(f.noteFit({ notes: 'Bu grafikte artış görülüyor. Sonra tabloya bakalım.', chart: {}, table: {} }, 'tr'), /grafikte.*tabloya/, 'grafiği/tablosu olan asetatın notu kırpılmamalı');
  assert.equal(f.noteFit({ notes: 'This slide shows three tools.' }, 'en'), 'This slide shows three tools.', 'İngilizce notta "slide" doğru sözcük');
  assert.equal(f.noteFit({ notes: 'Udemy kaynağı bunu doğruluyor.' }, 'tr'), 'Udemy kaynağı bunu doğruluyor.', 'tek cümlelik not boşaltılmamalı');
  const d = [
    { kind: 'list', bullets: ['Zaman yönetimi neden önemlidir sorusunun yanıtı verimlilik ve iyi oluşta saklıdır'], warn: [] },
    { kind: 'list', bullets: ['Araç seçimi: dijital veya fiziksel planlayıcı kullanmak alışkanlığı kalıcı kılar', 'Pomodoro tekniği odaklanmayı artırır ve molaları düzenler'], warn: [1] },
    { kind: 'list', bullets: ['Araç uyumu: dijital ya da fiziksel planlayıcı seçimi alışkanlığı kalıcı yapar', 'Uyku düzeni dikkat süresini uzattığı için verimliliği doğrudan belirler'], warn: [1] },
    { kind: 'list', bullets: ['Araç seçimi: dijital veya fiziksel planlayıcı kullanmak alışkanlığı kalıcı kılar'], warn: [] },
  ];
  assert.equal(f.dropEchoes(d), 1);
  assert.deepEqual(d[2].bullets, ['Uyku düzeni dikkat süresini uzattığı için verimliliği doğrudan belirler']);
  assert.deepEqual(d[2].warn, [0], 'uyarı sırası kayan maddeyle birlikte kaymalı');
  assert.equal(d[3].bullets.length, 1, 'son asetat özettir, yineleyebilir');
  assert.ok(sr.indexOf('dropEchoes(slides);') > sr.indexOf('dropRepeats(slides);') && sr.indexOf('dropEchoes(slides);') < sr.indexOf('const dropAt ='), 'boşalan asetatı düşüren adım sonra çalışmalı');
  assert.match(sr, /slides\.forEach\(\(x: any\) => \{ x\.notes = noteFit\(x, lang\); \}\);/);
  assert.ok(sr.includes('"(src2)"') && sr.includes('In Turkish say "slayt"') && sr.includes('"Sabah: dakika"'), 'istemde yeni yasaklar yok');
  // üst üste iki fotoğraf: aynı sorgu ikinci kez Unsplash'e gitmez, ikinci fotoğraf aynı "i" ile döner
  assert.match(sr, /if \(!p && q && memo\.has\(q\)\) p = take\(memo\.get\(q\) \|\| \[\], q\);/);
  assert.match(sr, /if \(cift\.has\(x\.i\) && x\.q\) hints\.push\(\{ i: x\.i, q: x\.q, entity: "" \}\);/);
});

test('ÇEŞİTLİLİK 14.11: her türün en az 3-4 hâli, aynı aile art arda gelmez, fotoğraf üç biçimde, gündem, tablo başlığı', () => {
  /* Berkay: "genel yapının çok aynı olması… her şeyin en az 3-4 farklı hâli
     olmalı". Canlı destede 7, 9 ve 10. asetat üç sütunluk aynı karttı (kolon
     çeşidi kartlarla aynı görünüyordu), 2, 3 ve 5. asetat "liste + sağda
     fotoğraf"tı. */
  const a = ink.indexOf("var TINT = ['#DCE6FF'"), b = ink.indexOf('/* ---------- özetten taşınan zenginlik');
  let id = 0;
  const E = (type, x, y, w, h, o) => Object.assign({ id: ++id, type, x, y, w, h, text: '', size: 24 }, o);
  const head = (t) => [E('h', 70, 46, 820, 74, { text: t, size: 42 }), E('mark', 70, 118, 190, 16, {})];
  const statsOf = (bb) => (bb || []).map((x) => { const m = String(x).split(' — '); return m.length > 1 ? { value: m[0], label: m[1] } : null; }).filter(Boolean);
  const { VARY, VSIRA, LAILE, TINT } = new Function('E', 'head', 'statsOf', 'NAVY', 'BLUE', 'SOFT', 'statBoy', ink.slice(a, b) + ';return { VARY, VSIRA, LAILE, TINT };')(E, head, statsOf, '#0D1838', '#2F6BFF', '#6A7593', (ss, o) => o[3]);
  // klasik + çeşitler: her türde en az 4 görünüm
  /* grafik veri türüdür: klasik + çıkarımlı iki hâli yeter (25.11.2026) */
  Object.keys(VARY).filter((k) => k !== 'chart').forEach((k) => assert.ok(new Set(VSIRA[k]).size >= 4, k + ': ' + new Set(VSIRA[k]).size + ' görünüm var, en az 4 olmalı'));
  assert.ok(VARY.list.length >= 10 && VARY.stat.length >= 4 && VARY.two.length >= 3 && VARY.quote.length >= 3);
  // kolon çeşidi artık kart değil: büyük renkli kutusu yok, kart çeşidinin var
  const KOL = ['Pomodoro: 25 dakika odak ve 5 dakika mola döngüsüyle çalışılır', 'Eisenhower: işler önem ve aciliyete göre dörde ayrılır', 'Pareto: sonuçların çoğu işlerin küçük bir bölümünden gelir'];
  const buyukKutu = (els) => els.filter((e) => e.type === 'rect' && e.w >= 60 && e.h >= 60).length;
  assert.equal(buyukKutu(VARY.list[6]('B', KOL, {})), 0, 'kolon çeşidi kartlarla aynı görünüyor');
  assert.ok(buyukKutu(VARY.list[0]('B', KOL, {})) >= 3);
  // gündem: 8 kısa başlık iki kolona sığar, uzun başlıkla kurulmaz
  const G8 = ['Giriş', 'Temel kavramlar', 'Öncelik belirleme', 'Pomodoro tekniği', 'Araçlar', 'Sık yapılan hatalar', 'Uygulama planı', 'Sonuç'];
  const g = VARY.list[9]('Gündem', G8, {});
  assert.ok(g && g.every((e) => e.x >= 0 && e.y >= 0 && e.x + e.w <= 960 && e.y + e.h <= 540), 'gündem asetata sığmıyor');
  G8.forEach((x) => assert.ok(g.some((e) => e.type === 't' && e.text === x), 'gündemde başlık eksik: ' + x));
  assert.ok(new Set(g.filter((e) => e.type === 't').map((e) => e.x)).size === 2, '5 başlıktan çoğu iki kolona bölünmeli');
  assert.equal(VARY.list[9]('Gündem', ['x'.repeat(80), 'b', 'c'], {}), null);
  // sıra: gerçek vSec + newSlide ile 8 liste — aynı aile art arda gelmez, en az 5 ayrı görünüm
  const arr = (x) => (Array.isArray(x) ? x : []);
  const vs = ink.slice(ink.indexOf('var vSay = {}, vSec'), ink.indexOf('push(); var made = strips.map'));
  const ns = ink.slice(ink.indexOf('  var newSlide = function (kind, t, b, c) {'), ink.indexOf('  /* ---------- rendering ---------- */'));
  const kur = new Function('VSIRA', 'VARY', 'LAILE', 'arr', 'LAY', 'uid', vs + ns + ';return function (s, kind) { var cx = { heads: s.heads }; cx.v = vSec(s, kind); cx.aile = vSay.aile || ""; cx.tek = vSay.tek; var sl = newSlide(kind, s.t, s.b, cx); if (kind === "list") vSay.aile = LAILE[sl.v || 0] || ""; return sl; };');
  const LAY = { list: { f: (t, bb) => head(t).concat([E('ul', 90, 160, 780, 340, { text: bb.join('\n') })]) }, quote: { f: (t, bb) => [E('h', 150, 150, 700, 210, { text: bb[0] }), E('t', 150, 396, 700, 40, { text: t })] } };
  const yeni = () => kur(VSIRA, VARY, LAILE, arr, LAY, () => ++id);
  const DUZ = ['Planlama güne başlamadan önce yapılırsa öncelikler netleşir', 'Kesintileri azaltmak odak süresini belirgin biçimde uzatır', 'Haftalık gözden geçirme sapmaları erken gösterir'];
  let bas = yeni();
  const seri = [KOL, DUZ, KOL, DUZ, KOL, DUZ, DUZ, DUZ].map((bb) => bas({ t: 'Başlık', b: bb }, 'list').v || 0);
  seri.forEach((v, i) => { if (i) assert.notEqual(LAILE[v], LAILE[seri[i - 1]], 'aynı aile art arda: ' + seri.join(',')); });
  assert.ok(new Set(seri).size >= 5, 'sekiz listede yalnız ' + new Set(seri).size + ' ayrı görünüm: ' + seri.join(','));
  assert.equal(seri.filter((v) => LAILE[v] === 's').length <= 3, true, 'üç sütunlu aile baskın: ' + seri.join(','));
  // canlı destenin dizilişi: kolon, düz, kolon — üçü birden sütun ailesinden olamaz
  bas = yeni();
  const canli = [KOL, KOL, KOL].map((bb) => bas({ t: 'B', b: bb }, 'list').v || 0);
  assert.ok(canli.filter((v) => LAILE[v] === 's').length <= 2 && LAILE[canli[0]] !== LAILE[canli[1]] && LAILE[canli[1]] !== LAILE[canli[2]], 'kolon maddeleri üç kez aynı aileyle basıldı: ' + canli.join(','));
  // fotoğraf ipucu olan ilk alıntı klasik kalır (tam sayfa fotoğrafa aday), ikincisi kutulu çeşit alır
  bas = yeni();
  const Q = { t: 'Peter Drucker', b: ['Ölçemediğiniz şeyi yönetemezsiniz.'], img: { q: 'clock desk' } };
  assert.equal(bas(Q, 'quote').v || 0, 0); assert.ok(bas(Q, 'quote').v > 0);

  /* CANLI DESTE 14.11 (etkili ders çalışma): beş listenin beşi de uyarılıydı ve hepsi
     aynı düzenle basıldı. 14.11'de klasik ↔ bölünmüş dönüşüme açıldı; 25.11 "History of
     Money" destesinde 9 listenin 6'sı yine yalnız bu iki görünümdeydi. Artık uyarılı liste
     de bütün çeşitleri dolaşır; uyarı işareti madde listesine ve kart yazılarına çizilir. */
  bas = yeni();
  const uyarili = [DUZ, DUZ, DUZ, DUZ, DUZ].map((bb) => bas({ t: 'Başlık', b: bb, warnI: [1] }, 'list').v || 0);
  assert.ok(new Set(uyarili).size >= 4, 'uyarılı listeler az görünümde kalıyor: ' + uyarili.join(','));
  const uyarEs = new Function(ink.match(/var uyarEs = function \(w, t\) \{.*\};/)[0] + 'return uyarEs;')();
  assert.equal(uyarEs('Store of value: Accepted as a claim on future purchasing power', 'Accepted as a claim on future purchasing power'), true, 'kolondaki açıklama uyarılı maddeyle eşleşmiyor');
  assert.equal(uyarEs('Store of value: Accepted as a claim', 'Store'), false, 'kısa terim uyarılı sayılmamalı');
  assert.match(ink, /else if \(e\.type === 't' && !e\.dz && e\.text\) \{ var w0 = wl\.filter\(function \(w\) \{ return uyarEs\(w, e\.text\); \}\)\[0\];/, 'uyarı kart yazısına taşınmıyor');
  assert.match(ink, /if \(e\.type === 't' && e\.warn && e\.warn\.indexOf\(e\.text\) >= 0\) \{ var wy0 = /, 'kart yazısında uyarı çizilmiyor');
  /* CANLI DESTE 14.11 (kanın fizyolojik özellikleri): 14 listenin 9'u tek cümle
     kutusuyla (v6) basıldı. Sebep zincirdi: akış kontrolü dört maddelik, 420+
     karakterlik listeye "kalabalık" dedi, "ikiye böl" iki maddelik çiftler üretti,
     her biri ince asetat kutusuna düştü. Kutu art arda gelmez; eşik 560'a çıktı;
     gündem "(devam)" başlıklarını saymaz. */
  bas = yeni();
  const ince = [0, 1, 2, 3, 4, 5].map(() => bas({ t: 'B', b: DUZ.slice(0, 2) }, 'list').v || 0);
  assert.deepEqual(ince, [6, 0, 6, 0, 6, 0], 'ince asetat kutusu art arda geliyor: ' + ince.join(','));
  assert.match(ink, /s\.k === 'list' && \(b\.length > 5 \|\| len > 560\)/, 'dört orta boy madde yine "kalabalık" sayılıyor');
  assert.match(ink, /var gb = govde\.filter\(function \(x\) \{ return !\/\\\(\(devam\|cont\\\.\)\\\)\\s\*\$\/i\.test\(x\); \}\)\.slice\(0, 8\)/, 'gündem "(devam)" başlıklarını listeliyor');
  // aynı destede 5. asetat "birinci taraf / ikinci taraf" ile basıldı: taraf adı yoksa liste
  assert.match(ink, /if \(kind === 'two' && arr\(s\.b\)\.length && arr\(s\.heads\)\.filter\(function \(h\) \{ return \/\\S\/\.test\(String\(h \|\| ''\)\); \}\)\.length < 2\) kind = 'list';/);
  // aynı destede "red pen writing on book" aramasından oje süren kadın fotoğrafı geldi: sorguyla ortak sözcüğü olan öne alınır
  const G = require('./_ts-extract.js').loadFromSource('supabase/functions/sunum-research/index.ts', ['keysOf', 'GORSEL_BOS', 'gorselKok', 'gorselUyar']);
  const SQ = G.gorselKok('person holding on red pen while writing on book');
  const uyar = (alt) => G.gorselUyar(SQ, alt);
  assert.equal(uyar('woman putting on nail polish on her finger'), false);
  assert.equal(uyar('person writing on white notebook'), true);
  /* 25.11.2026 (History of Money): "ancient greek silver coin" aramasına kahve kupası geldi —
     uyan yoksa ilk sonuç ALINMAZ; "coin"/"coins" aynı kök; "close", "photo" sayılmaz. */
  const CQ = G.gorselKok('ancient greek silver coins museum close up');
  assert.equal(G.gorselUyar(CQ, 'A ceramic mug with a spoon inside on a green marble surface'), false);
  assert.equal(G.gorselUyar(CQ, 'close-up photo of a mug'), false, '"close" / "photo" eşleşme sayılıyor');
  assert.equal(G.gorselUyar(CQ, 'Silver coin of Athens with owl'), true);
  const rsrc = require('fs').readFileSync(require('path').join(__dirname, '..', 'supabase/functions/sunum-research/index.ts'), 'utf8');
  assert.match(rsrc, /const p = qk\.length \? ok\.find\(\(x\) => gorselUyar\(qk, x\.alt\)\) \|\| null : ok\[0\] \|\| null;/, 'uyan fotoğraf yoksa ilgisiz ilk sonuç alınıyor');
  assert.match(rsrc, /p = take\(u\.photos, q\);/);

  // ---- fotoğraf biçimleri: gerçek placePhoto / placePair / placeTam ----
  const fa = ink.indexOf('  var fotoImg = function'), fb = ink.indexOf('\n  };', ink.indexOf('  var placePhoto = function (sl, p, alt, bicim) {'));
  assert.ok(fa > 0 && fb > fa, 'fotoğraf yerleştirme bloğu bulunamadı');
  const izler = [];
  const F = new Function('E', 'W', 'H', 'SOFT', 'TINT', 'credText', 'fn', 'fotoKutu', ink.slice(fa, fb) + '\n  };return { placePhoto, placePair, placeTam };')(E, 960, 540, '#6A7593', TINT, (p) => 'Fotoğraf: ' + p.photographer, (n, o) => { izler.push(o); return Promise.resolve(); }, (p, mw, mh) => ({ w: mw, h: Math.min(mh, Math.round(mw * p.h / p.w)) }));
  const P = (n) => ({ large: 'https://images.example/' + n + '.jpg', w: 1600, h: 1000, photographer: 'A' + n, page: 'https://example/' + n, track: 'https://track/' + n, alt: 'alt' + n });
  const liste = () => ({ lay: 'list', els: head('Başlık').concat([E('ul', 90, 160, 780, 340, { text: 'a\nb\nc' })]) });
  const icinde = (sl) => sl.els.forEach((e) => assert.ok(e.x >= 0 && e.y >= 0 && e.x + e.w <= 960 && e.y + e.h <= 540, 'taşan öğe: ' + e.type));
  const ust = (sl) => { const u = sl.els.find((e) => e.type === 'ul'); sl.els.filter((e) => e.type === 'img').forEach((im) => assert.ok(im.x >= u.x + u.w || im.x + im.w <= u.x, 'fotoğraf maddelerin üstüne biniyor')); };
  const sag = liste(); F.placePhoto(sag, P(1), 'x'); icinde(sag); ust(sag);
  const sol = liste(); F.placePhoto(sol, P(2), 'x', 'sol'); icinde(sol); ust(sol);
  assert.ok(sol.els.find((e) => e.type === 'img').x < 100 && sag.els.find((e) => e.type === 'img').x > 500, 'sol biçim fotoğrafı sola almıyor');
  const iki = liste(); F.placePair(iki, P(3), P(4)); icinde(iki); ust(iki);
  const ims = iki.els.filter((e) => e.type === 'img');
  assert.equal(ims.length, 2); assert.ok(ims[1].y >= ims[0].y + ims[0].h, 'iki fotoğraf üst üste dizilmeli');
  assert.ok(ims.every((e) => e.kap === 1 && e.oran === 1.6), 'kırparak dolduran fotoğraf oranını taşımalı (PPTX)');
  assert.equal(iki.els.filter((e) => e.type === 't' && /^Fotoğraf: A[34]$/.test(e.text)).length, 2, 'iki fotoğrafın da atfı yazılmalı');
  assert.ok(iki.els.every((e) => e.y + e.h <= 504), 'alt bilgi şeridine taşıyor');
  const alinti = () => ({ lay: 'quote', els: [E('h', 70, 40, 120, 150, { text: '“' }), E('h', 150, 150, 700, 210, { text: 'Ölçemediğiniz şeyi yönetemezsiniz.' }), E('mark', 150, 370, 160, 16, {}), E('t', 150, 396, 700, 40, { text: 'Peter Drucker' })] });
  const tam = alinti(); F.placePhoto(tam, P(5), 'x', 'tam'); icinde(tam);
  assert.deepEqual([tam.els[0].type, tam.els[0].w, tam.els[0].h, tam.els[1].type], ['img', 960, 540, 'rect'], 'tam sayfa fotoğraf + metin panosu kurulmadı');
  assert.equal(tam.els[1].fill, '#EEF3FF', 'pano çizgili şablonlarda saydamlaşan renklerden olmamalı');
  assert.equal(tam.els.filter((e) => e.type === 't')[0].text, 'Peter Drucker', 'ilk metin öğesi atıf kalmalı (titleOf)');
  const pano = tam.els[1]; tam.els.filter((e) => e.type === 'h' || e.type === 't').forEach((e) => assert.ok(e.x >= pano.x && e.y >= pano.y - 10 && e.x + e.w <= pano.x + pano.w && e.y + e.h <= pano.y + pano.h, 'yazı panonun dışında, fotoğrafın üstünde kalıyor'));
  const dik = alinti(); F.placePhoto(dik, Object.assign(P(6), { w: 1000, h: 1600 }), 'x', 'tam'); assert.ok(dik.els[0].type !== 'img', 'dikey fotoğraf tam sayfa yapılmamalı');
  assert.equal(izler.length, 6, 'her fotoğrafın izleme çağrısı yapılmalı (Unsplash koşulu)');
  assert.match(ink, /\['', 'iki', 'sol'\]\[li\+\+ % 3\]/, 'liste fotoğrafları biçim değiştirmiyor');
  assert.match(ink, /iki: bic\[i\] === 'iki' \? 1 : 0/);
  assert.match(ink, /sizing: \{ type: e\.kap \? 'cover' : 'contain', w: box\.w, h: box\.h \}/, 'PPTX kırpılan fotoğrafı sıkıştırarak basar');
  // gündem ve kapanış notu
  assert.match(ink, /var gs = newSlide\('list', ENn \? 'Agenda' : 'Gündem', gb, \{ v: 10 \}\);/);
  assert.match(ink, /made\[0\]\.lay === 'cover' && govde\.length >= 5 &&/);
  assert.match(ink, /String\(tt\.text\)\.split\(' · '\)\.filter\(Boolean\)\.slice\(0, 3\) : govde\.slice\(-3\)/, 'kapanış notu asetattaki maddeleri okumuyor');
  // tablo: başlık satırı vurgu rengiyle dolu — ekranda ve PPTX'te
  assert.match(ink, /var ac = temaRenk\(BLUE\), th = '<th style="background:' \+ ac/);
  assert.match(ink, /fill: \{ color: hex\(temaRenk\(BLUE\)\) \}/);
});

test('CANLI DESTE 14.11 (etkili ders çalışma) — notlar: aynı dolgu cümlesi yinelenmez, not "slayt" der', () => {
  /* Üç not "…zaman yönetimi ve aktif öğrenme teknikleriyle desteklenmelidir"
     dolgusuyla bitiyordu; kaynakça notu "asetat", yazarın notları "slayt" diyordu. */
  const { noteEchoes } = require('./_ts-extract.js').loadFromSource('supabase/functions/sunum-research/index.ts', ['keysOf', 'noteEchoes']);
  const S = [
    { notes: 'Biyolojik ritme uygun saatlerde çalışmak verimliliği artırır. Boş zamanları planlamak uzun vadeli başarı için kritiktir. Bu yaklaşım, zaman yönetimi ve aktif öğrenme tekniklerini destekler.' },
    { notes: 'Bireysel çalışma kendi hızında ilerleme avantajı sağlar. Grup çalışması farklı bakış açıları kazandırır. Her iki yaklaşım da zaman yönetimi ve aktif öğrenme teknikleriyle desteklenmelidir.' },
    { notes: 'Bu yaklaşım zaman yönetimi ve aktif öğrenme tekniklerini destekler. Tek özgün cümle burada.' },
  ];
  assert.equal(noteEchoes(S), 1);
  assert.match(S[0].notes, /destekler\.$/, 'ilk geçiş kalır');
  assert.doesNotMatch(S[1].notes, /desteklenmelidir/); assert.match(S[1].notes, /Grup çalışması/);
  assert.match(S[2].notes, /destekler/, 'notta iki cümleden az kalacaksa atılmaz');
  const sr = require('fs').readFileSync(require('path').join(__dirname, '..', 'supabase/functions/sunum-research/index.ts'), 'utf8');
  assert.match(sr, /x\.notes = noteFit\(x, lang\); \}\); noteEchoes\(slides\);/);
  assert.match(sr, /closing summary slide states conclusions in new words/);
  assert.doesNotMatch(ink, /kapanış asetatına geç|sıradaki asetata bağla|b\.push\('asetatta /, 'konuşmacı notu "slayt" demeli');
});

/* CANLI DESTE 14.11 (kanın fizyolojik özellikleri): belge/kart yolunda 18 notun
   18'i şablondu ("“X” konusunu anlatıyorum. İlk olarak … Son olarak …"), tablo
   notu satır adlarını saydı, formül notuna değişken listesi satır satır düştü;
   20 asetatta yalnız kapak fotoğraf aldı. Şablon notu basımdan sonra Acadia
   asetatın kendi içeriğinden yeniden yazar; elle değişen nota dokunulmaz. */
test('CANLI DESTE 14.11 (kanın fizyolojik özellikleri) — şablon notu yeniden yazılır, dört maddelik liste fotoğrafa aday', () => {
  const ink = read('js/acadex-ink.js'), ts = read('supabase/functions/sunum-research/index.ts');
  assert.match(ink, /\{ AI\.note\(sl, true\); taslak\.push\(\{ sl: sl, n: sl\.notes \}\); \}/, 'şablon notu alan asetat kaydedilmiyor');
  assert.match(ink, /if \(plotMeta\.via !== 'skeleton'\) notlariYaz\(taslak, /, 'basımdan sonra notlar yeniden yazdırılmıyor');
  assert.match(ink, /String\(x\.sl\.notes \|\| ''\)\.indexOf\(x\.n\) !== 0\) return;/, 'kullanıcının değiştirdiği not eziliyor');
  assert.match(ink, /x\.sl\.notes = String\(r\.notes\)\.trim\(\) \+ x\.sl\.notes\.slice\(x\.n\.length\)/, '"Asetata sığmayanlar" eki kayboluyor');
  assert.match(ink, /b\.push\(e\.text\.replace\(\/\\s\*\\n\\s\*\/g, '; '\)\);/, 'nota ham satır sonu düşüyor');
  assert.match(ink, /length <= 4 && t\.length < 430;/, 'dört maddelik liste fotoğrafa aday değil');
  // sunucu: yalnız asetatta yazandan; asetatta geçmeyen sayı taşıyan cümle atılır, kısa kalan not dönmez
  const blok = ts.slice(ts.indexOf('if (action === "notes") {'), ts.indexOf('// ---------------- prova yorumu'));
  assert.ok(blok.length > 500, '"notes" eylemi yok');
  assert.match(blok, /never add a number, date, name or fact that is not in its text/);
  assert.match(blok, /Never start with "This slide", "Bu slaytta", "… konusunu anlatıyorum"/);
  assert.match(blok, /idxN = buildNumIndex\(x\.title \+ " " \+ x\.text\)/);
  assert.match(blok, /filter\(\(t\) => !numTokens\(t\)\.length \|\| verified\(t, idxN\)\)/);
  assert.match(blok, /noteEchoes\(outN\);/);
  assert.match(blok, /length >= 2 && x\.notes\.split\(\/\\s\+\/\)\.length >= 20/);
  const { numTokens, buildNumIndex, verified } = require('./_ts-extract.js').loadFromSource('supabase/functions/sunum-research/index.ts', ['numTokens', 'variants', 'buildNumIndex', 'verified']);
  const idx = buildNumIndex('Kanın viskozitesi suyun 4,5 katıdır');
  assert.ok(verified('Kan sudan 4,5 kat daha akışmazdır.', idx));
  assert.ok(numTokens('Viskozite 37 derecede ölçülür.').length && !verified('Viskozite 37 derecede ölçülür.', idx), 'asetatta olmayan sayı notta kalıyor');
});

/* CANLI DESTE 14.11 (ruh sağlığı hemşireliği, yönetmen yolu): sekiz asetat art
   arda alıntı düzeniyle basıldı; yönetmenin yazdığı notlar şablonla ezildi;
   tablo/diyagram başlıklarında "Tablo 1. … (Slide 2)" kaldı. */
test('CANLI DESTE 14.11 (ruh sağlığı hemşireliği) — alıntı art arda gelmez, Acadia notu ezilmez, görsel başlığı temizlenir', () => {
  const ink = read('js/acadex-ink.js');
  const al = (re) => { const m = ink.match(re); assert.ok(m, 'bulunamadı: ' + re); return m[0]; };
  const vTur = new Function('vSay', al(/var vTur = function \(kind\) \{.*\};/) + 'return vTur;')({});
  const seri = ['quote', 'quote', 'quote', 'quote', 'quote', 'quote', 'quote', 'quote'].map(vTur);
  assert.deepEqual(seri, ['quote', 'list', 'quote', 'list', 'list', 'list', 'list', 'list']);
  const vT2 = new Function('vSay', al(/var vTur = function \(kind\) \{.*\};/) + 'return vTur;')({});
  assert.deepEqual(['quote', 'list', 'table', 'quote', 'time'].map(vT2), ['quote', 'list', 'table', 'quote', 'time'], 'aralıklı alıntıya dokunulmaz');
  assert.match(ink, /length < 2\) kind = 'list';\n\s+kind = vTur\(kind\);/, 'alıntı tayını basım yoluna bağlı değil');
  const notYeter = new Function('langOf', 'curLang', al(/var notYeter = function \(n\) \{.*\};/) + 'return notYeter;')((t) => (/\bthe\b/i.test(t) ? 'en' : 'tr'), () => 'tr');
  assert.equal(notYeter('Peplau, Orlando ve Travelbee kuramlarının ortak noktası hemşire ile hasta arasındaki ilişkiyi bakımın merkezine koymalarıdır; bunu bir örnekle açıklayın.'), true);
  assert.equal(notYeter('Kısa bir not.'), false);
  assert.equal(notYeter('The three theories share one idea and the presenter should explain how the nurse and the patient relate to each other here.'), false, 'başka dildeki not kalıyor');
  assert.match(ink, /s\.k !== 'refs' && !notYeter\(s\.notes\)\) \{ AI\.note\(sl, true\); taslak\.push/);
  const gorselAd = new Function('txt', al(/var gorselAd = function \(t\) \{.*\};/) + 'return gorselAd;')((x) => String(x || ''));
  assert.equal(gorselAd('Tablo 1. Psikiyatri Hemşireliği İçin Oluşturulan Kuramsal Çerçeveler (Slide 2)'), 'Psikiyatri Hemşireliği İçin Oluşturulan Kuramsal Çerçeveler');
  assert.equal(gorselAd('TABLO 1: Uluslararası standartların genel yapısı (Slide 3)'), 'Uluslararası standartların genel yapısı');
  assert.equal(gorselAd('Extremum pattern (Slide 27/28)'), 'Extremum pattern');
  assert.equal(gorselAd('Tablo ve grafik okuma (2024)'), 'Tablo ve grafik okuma (2024)', 'gerçek başlık kırpılıyor');
  assert.equal((ink.match(/t: gorselAd\((?:x|d)\.title\)/g) || []).length, 3);
  assert.match(ink, /\(titleOf\(x\.sl\) \+ notOzu\(x\.sl\)\)\.length > 40/, 'alıntı asetatının notu yeniden yazılmıyor');
  assert.match(read('supabase/functions/acadia-presentation-director/index.ts'), /console\.log\(`Director deste: \$\{deck\.slides\.length\} asetat, metin kelime \[/);
});

/* CANLI DESTE 25.11 (History of Money): alt sorgular ve alt başlıklar İspanyolca
   üretildi (kaynakların yarısı Latin Amerika sitesi, asetatta "Banco de Estocolmo",
   odak 0/5); 2009/2015/2026'ya birer "milestone" çizen grafik "2009: 1 milestone"
   maddelerine indi; "%80 nakit" dört asetatta yinelendi; İngilizce destenin
   kapanışında "Sorular?" yazdı. */
test('CANLI DESTE 25.11 (History of Money) — sorgu dili, sabit grafik, yinelenen yüzde, kapanış dili', () => {
  const ink = read('js/acadex-ink.js'), ts = read('supabase/functions/sunum-research/index.ts');
  assert.match(ts, /The deck is written in \$\{lang === "en" \? "English" : "Turkish"\}: "the topic's language" above means/, 'sorgu planı deste dilini bilmiyor');
  assert.match(ts, /a history topic is not ongoing and gets no year/);
  const R = require('./_ts-extract.js').loadFromSource('supabase/functions/sunum-research/index.ts', ['numTokens', 'pctOf', 'sigNums', 'flatChart', 'dropRepeats']);
  assert.equal(R.flatChart([1, 1, 1]), true);
  assert.equal(R.flatChart([2009, 2015]), false);
  assert.match(ts, /if \(flatChart\(vals\)\) \{ chart = null; chartOk = false; \}/, 'sabit değerli grafik maddeye iniyor');
  assert.match(ts, /if \(ser && !flatChart\(ser\.values\)\)/);
  assert.ok(R.sigNums('Over 80% of transactions use cash').includes('80'), '%80 anlamlı sayı değil');
  assert.ok(!R.sigNums('80 kişi katıldı').includes('80'), 'yüzdesiz iki haneli sayı yinelenme sayılmamalı');
  const S = (kind, bullets, stats = []) => ({ kind, bullets, warn: [], stats, table: null });
  const deste = [S('list', ['Paper dominance: Over 80% of transactions in emerging economies still use cash']), S('stat', [], [{ value: '80%' }]), S('list', ['Cash resilience: 80% usage in emerging economies suggests infrastructure gaps', 'CBDC uncertainty: still experimental']), S('list', ['Özet'])];
  R.dropRepeats(deste);
  assert.deepEqual(deste[2].bullets, ['CBDC uncertainty: still experimental'], 'yinelenen %80 maddesi kaldı');
  assert.match(ink, /text: typeof curLang === 'function' && curLang\(\) === 'en' \? 'Questions\?' : 'Sorular\?'/, 'İngilizce kapanışta "Sorular?" yazıyor');
});

/* CANLI DESTE 25.11 (History of Guns): kaynakçada "•" ile "[n]" üst üste;
   iki Commons görselinde "Unknown author Unknown author"; dil düzeldi ama
   sorguya yine "2026" eklendi; eleştiri asetatı konunun değil kaynakların
   eksiğini anlattı ("not provided in the sources"). */
test('CANLI DESTE 25.11 (History of Guns) — kaynakça ızgarası, Commons yazar adı, tarih sorgusunda yıl, eleştiri asetatı', () => {
  const ink = read('js/acadex-ink.js'), css = read('css/acadex-ink.css'), ts = read('supabase/functions/sunum-research/index.ts');
  const ks = new Function(ink.match(/var kaynakSatir = function \(t\) \{.*\};/)[0] + 'return kaynakSatir;')();
  assert.equal(ks('[1] history.com. (n.d.). Firearms.\n[2] pbs.org. (n.d.). Guns.'), true);
  assert.equal(ks('Matchlock emergence: 1400s\n[2] not a ref'), false, 'karışık liste kaynakça sayılıyor');
  assert.match(ink, /if \(e\.type === 'ul' && kaynakSatir\(e\.text\)\) return '<ul class="sx-refs">'/);
  assert.match(ink, /bullet: kaynakSatir\(e\.text\) \? false : \{ code: '25AA' \}/, 'PPTX kaynakçasında madde işareti kaldı');
  assert.match(css, /\.sx-el ul\.sx-refs\{list-style:none;padding:0\}/);
  assert.match(css, /\.sx-refs li\{display:grid;grid-template-columns:2\.4em 1fr;gap:\.35em;overflow-wrap:anywhere\}/);
  const R = require('./_ts-extract.js').loadFromSource('supabase/functions/sunum-research/index.ts', ['stripTags', 'artistOf', 'TARIH', 'tarihSorgu']);
  assert.equal(R.artistOf('<span>Unknown author</span> <span>Unknown author</span>'), '');
  assert.equal(R.artistOf('George Henry Taggart'), 'George Henry Taggart');
  assert.equal(R.artistOf('Mathew Brady Mathew Brady'), 'Mathew Brady');
  const yil = String(new Date().getFullYear());
  assert.equal(R.tarihSorgu('History Of Guns', 'history of firearms ' + yil), 'history of firearms');
  assert.equal(R.tarihSorgu('Kripto para piyasası', 'kripto para verileri ' + yil), 'kripto para verileri ' + yil, 'güncel konunun yılı atılıyor');
  assert.equal(R.tarihSorgu('Elektrikli araçların gelişimi 2020-' + yil, 'ev satışları ' + yil), 'ev satışları ' + yil, 'konu yıl taşıyorsa sorgunun yılı kalmalı');
  assert.match(ts, /\.\.\.qs\.slice\(-2\)\]\.map\(\(q\) => tarihSorgu\(topic, q\)\)\)\]/);
  assert.match(ts, /it never lists what the sources fail to provide/);
});

/* CANLI DESTE 25.11 (History of Money, ikinci): kapanışa ilk üç başlık basıldı
   ("sızıntı"); 9 listenin 6'sı iki görünümde kaldı; iki sütunda madde yanlış
   tarafa düştü; maddelerde "(Bank of England, 2018)" atıfı kaldı. Eksik şablonlar
   (bento, süreç okları, grafik+çıkarım, matris rozetleri, editoryal kapak) mevcut
   öğe sistemine çeşit olarak eklendi: ekran, PDF ve PPTX aynı öğeleri basar. */
test('CANLI DESTE 25.11 (History of Money 2) — kapanış, yeni düzenler, iki sütun sınırı, rozet, kapak, yazar-tarih atıfı', () => {
  const ink = read('js/acadex-ink.js'), css = read('css/acadex-ink.css'), ts = read('supabase/functions/sunum-research/index.ts');
  // kapanış: önceki başlıklar basılmaz
  assert.match(ink, /concat\(\[\{ t: 'Teşekkürler', k: 'end', b: \[\] \}\]\)/, 'kapanış şeridine başlıklar konuyor');
  assert.doesNotMatch(ink, /text: b\.join\(' · '\), size: 18, color: SOFT, align: 'center'/, 'kapanış düzeni hâlâ başlık satırı basıyor');
  // yeni çeşitler gerçek kodla kurulur, asetattan taşmaz
  const a = ink.indexOf("var TINT = ['#DCE6FF'"), b = ink.indexOf('/* ---------- özetten taşınan zenginlik');
  let id = 0; const E = (type, x, y, w, h, o) => Object.assign({ id: ++id, type, x, y, w, h, text: '', size: 24 }, o);
  const head = (t) => [E('h', 70, 46, 820, 74, { text: t, size: 42 }), E('mark', 70, 118, 190, 16, {})];
  const M = new Function('E', 'head', 'statsOf', 'NAVY', 'BLUE', 'SOFT', 'statBoy', 'arr', 'chartVals', ink.slice(a, b) + ';return { VARY, VSIRA, LAILE, SUREC, ikiBol };')(E, head, () => [], '#0D1838', '#2F6BFF', '#6A7593', (ss, o) => o[3], (x) => (Array.isArray(x) ? x : []), (d) => (d && Array.isArray(d.data) ? d.data : []));
  const icinde = (els, ad) => els.forEach((e) => assert.ok(e.x >= 0 && e.y >= 0 && e.x + e.w <= 960 && e.y + e.h <= 540, ad + ' taşıyor: ' + e.type));
  const B = ['Barter: goods were swapped directly when both sides wanted what the other had', 'Commodity money: grain and shells carried value because people needed them', 'Coins: standard weights of metal made counting and carrying easier for traders'];
  const bento = M.VARY.list[10]('Forms of money', B); assert.ok(bento, 'bento kurulmadı'); icinde(bento, 'bento');
  assert.equal(M.VARY.list[10]('X', B.concat(['Paper money: notes promised metal held by a bank, travelled more easily than coins and soon replaced heavy metal in long-distance trade'])), null, '4 uzun madde bento kutusuna sığmaz');
  assert.equal(M.VARY.list[11]('Forms of money', B), null, 'sıra bildirmeyen içerikte süreç okları çizilmemeli');
  const sur = M.VARY.list[11]('From Barter to Digital Money', B); assert.ok(sur, 'süreç okları kurulmadı'); icinde(sur, 'süreç'); assert.equal(sur.filter((e) => e.type === 'arrow').length, 2);
  assert.ok(M.SUREC.test("Takastan dijital paraya: paranın evrimi"), 'Türkçe "evrim" süreç sayılmıyor');
  assert.equal(M.SUREC.test('Neden para var? Bir tarih okuması'), false, '"neden" süreç sayılıyor');
  const ch = M.VARY.chart[0]('Paper money share', ['Cash still dominates in emerging markets', 'Card payments grew fastest after 2015'], { data: { type: 'bar', labels: ['2010', '2015', '2020'], data: [80, 70, 55] } });
  assert.ok(ch && ch.some((e) => e.type === 'chart') && ch.filter((e) => e.type === 't').length === 2, 'grafik + çıkarım kurulmadı'); icinde(ch, 'grafik+çıkarım');
  assert.equal(M.VARY.chart[0]('X', ['tek çıkarım'], { data: { data: [1, 2] } }), null);
  assert.deepEqual(M.VSIRA.chart, [1, 0]);
  [11, 12].forEach((v) => assert.ok(M.VSIRA.list.includes(v) && M.LAILE[v], v + '. çeşit sırada/ailede yok'));
  // iki sütun sınırı: yazarın n1'i, yoksa orta
  assert.equal(M.ikiBol(['a', 'b', 'c'], { split: 1 }), 1);
  assert.equal(M.ikiBol(['a', 'b', 'c'], { split: 3 }), 2, 'geçersiz sınır ortaya düşmeli');
  assert.equal(M.ikiBol(['a', 'b', 'c'], {}), 2);
  assert.equal((ink.match(/var h = ikiBol\(b, c\)/g) || []).length, 3, 'iki sütun çizimlerinin biri hâlâ ortadan bölüyor');
  assert.match(ink, /s\.k = 'two'; s\.heads = arr\(x\.heads\)\.map\(txt\); s\.split = \+x\.split \|\| 0;/);
  assert.match(ink, /cx\.heads = s\.heads; cx\.split = s\.split;/);
  assert.match(ts, /"n1" = how many bullets belong to side one/);
  assert.match(ts, /split: k === "two" \? Math\.max\(0, Math\.min\(bullets\.length - 1, Number\(s\.n1\) \|\| 0\)\) : 0,/);
  assert.match(ts, /if \(sd\.bullets\.some\(\(b, i\) => b !== bullets\[i\]\)\) s\.n1 = 0;/, 'sidesOf dizdiğinde yazarın sınırı geçersiz kalmalı');
  // matris rozetleri
  const rz = new Function('X', ink.match(/var ROZET = \[.*\];/)[0] + ink.match(/var rozet = function \(c\) \{.*\};/)[0] + 'return rozet;')((x) => String(x));
  assert.match(rz('✓'), /sx-pill-ok/); assert.match(rz('No'), /sx-pill-no/); assert.match(rz('Yüksek'), /sx-pill-hi/); assert.match(rz('Medium'), /sx-pill-mid/);
  assert.equal(rz('Bank of England'), 'Bank of England', 'düz metin rozet olmamalı');
  assert.match(ink, /r\.map\(function \(c, ci\) \{ return '<td>' \+ \(ci \? rozet\(c\) : X\(c\)\) \+ '<\/td>'; \}\)/, 'ölçüt sütunu da rozetleniyor');
  assert.match(css, /\.sx-pill-ok\{background:#D9EFE3;color:#1D6B43\}/);
  assert.match(ts, /write a feature matrix: headers = \["Criterion", item1, item2\(, item3\)\]/);
  // editoryal kapak
  assert.match(ink, /bic\[made\.indexOf\(sl\)\] = sl\.lay === 'cover' \? 'tam'/);
  assert.match(ink, /if \(sl\.lay === 'cover'\) \{\n\s+if \(\(p\.w \|\| 3\) < \(p\.h \|\| 2\) \* 1\.2\) return null;/, 'dikey fotoğraf kapağı kaplamamalı');
  // yazar-tarih atıfı
  const { dropDated } = require('./_ts-extract.js').loadFromSource('supabase/functions/sunum-research/index.ts', ['dropDated']);
  assert.equal(dropDated('Money’s forms span roughly 11,000 years (Bank of England, 2018).'), 'Money’s forms span roughly 11,000 years.');
  assert.equal(dropDated('Store of value: accepted as a claim on future purchasing power (Wikipedia, 25 November 2026)'), 'Store of value: accepted as a claim on future purchasing power');
  assert.equal(dropDated('Mesopotamian shekel (c. 2150 BC) was linked to barley'), 'Mesopotamian shekel (c. 2150 BC) was linked to barley', 'tarih ayracı atılıyor');
  // görsel sorgusu somut
  assert.match(ts, /"ancient greek silver coin museum", not "ancient greece" or "economy"/);
});

summary();
