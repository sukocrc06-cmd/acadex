/* ==========================================================================
   ACADEX — SAYFA SAYISI TUTARLILIĞI VE GERÇEK PPTX DOĞRULAMASI (tests/sunum-pptx-tutarlilik.js)

   NEDEN VAR (27.11.2026, #45 Phase 7.3/7.4):
   - İstenen N sayfa = basılan asetat = küçük resim = PPTX asetatı = kayıttaki slide_count (kapak, gündem, kaynakça,
     kapanış dahil). Gündem kuralı tek yerde (gundemVar): öngörü (sayiAyarla), şerit sayacı (paintSayi) ve basım
     (printDeck) aynı kararı verir. Şerit penceresi "N şerit + 1 otomatik gündem = toplam" der; elle eklenen/silinen
     asetattan sonra deste N'e geri zorlanmaz.
   - PPTX'te hiçbir öğe sessizce düşmez: tanınmayan öğe türü EXPORT_ELEMENT_SKIPPED (uyarı) olur.
   - Editör = PowerPoint metrikleri: iç boşluk 0, satır aralığı punto olarak (gövde 1,25, başlık 1,08), madde girintisi
     1,1 em, punto çeyrek hassasiyette; fotoğraf hiçbir zaman gerilmez (kendi oranıyla "cover" kırpma).
   - 7.4 görünüm önerileri (LOW_CONTRAST, HIERARCHY_INVERTED, TITLE_SIZE_DRIFT) yalnız info; durum ve puan değişmez.

   DOĞRULAMA AYRIMI: C bölümü PPTX dosyasının XML/geometri doğrulamasıdır (ZIP, presentation.xml, rels, slide*.xml,
   medya, sıra, kutu sınırları, punto, satır aralığı, kırpma). Görsel çizim doğrulaması (PowerPoint/Keynote'ta
   açıp bakmak) DEĞİLDİR; ekrandaki görünüm D bölümünde başsız Chrome'da ölçülür.

   Gerçek kütüphane: üretimin CDN'den yüklediği pptxgenjs@3.12.0 paketi. Yol: PPTXGEN_BUNDLE ya da
   node_modules/pptxgenjs/dist/pptxgen.bundle.js. Yoksa C bölümü ATLANDI yazar ve GEÇTİ SAYILMAZ.
   Bölümler:  A kaynak kuralları · B 12 sentetik deste (sayı, yaşam döngüsü, kayıt) · C gerçek PPTX · D ekran genişlikleri
   (1440/1024/768/390/320) · E görünüm önerileri. Dış ağ, Groq/Gemini yok; adlar ve içerik sentetik.
   Çalıştırma:  node tests/sunum-pptx-tutarlilik.js     (EKRAN_DIR=klasör → ekran görüntüleri; DOKUM=dosya.json → ham ölçümler)
   ========================================================================== */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { execFile } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { makeRunner } = require('./_ts-extract.js');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const ink = read('js/acadex-ink.js');
const { test, summary } = makeRunner();
const cut = (a, b) => { const i = ink.indexOf(a); assert.ok(i >= 0, 'bulunamadı: ' + a.slice(0, 60)); const j = ink.indexOf(b, i + a.length); assert.ok(j > i, 'son bulunamadı: ' + b.slice(0, 60)); return ink.slice(i, j); };
const say = (s, x) => s.split(x).length - 1;

/* ---------- A: kaynak kuralları ---------- */
test('A1 gündem kuralı tek yerde: gundemVar öngörü, sayaç ve basımda; başka yerde "≥ 5 başlık" gündem koşulu yok', () => {
  assert.equal(say(ink, '  var gundemVar = function'), 1);
  const kul = ink.split('\n').filter((l) => /gundemVar\(/.test(l) && !/var gundemVar = function/.test(l));
  assert.equal(kul.length, 3, kul.map((l) => l.trim().slice(0, 70)).join(' || '));
  assert.ok(/pm\.gundem = b >= 5 && gundemVar\(/.test(cut('  var sayiAyarla = function', '\n  };\n')), 'sayiAyarla');
  assert.ok(/gundemVar\(bas0\[0\]\.k, seritGovde\(bas0\), plotMeta\)/.test(cut('  var paintSayi = function', '\n  };\n')), 'paintSayi');
  assert.ok(ink.includes("made[0].lay === 'cover' && gundemVar(strips[0].k, seritGovde(strips), plotMeta)"), 'printDeck');
  assert.ok(!/govde\.length >= 5 &&/.test(ink), 'eski çift kural kalmış');
  assert.ok(/paintSayi\(\);\n    if \(!plotHazir\)/.test(ink), 'paintFlow sayacı her boyamada günceller');
});

test('A2 PPTX: iç boşluk 0, satır aralığı punto, madde girintisi 1,1 em, çeyrek punto; fotoğraf hep cover; tanınmayan öğe kayda geçer', () => {
  const ex = cut('  var exportPptx = async function', '\n  };\n');
  assert.ok(!/margin: 2/.test(ex), 'eski 2 pt iç boşluk');
  assert.ok(/PT = function \(v\) \{ return Math\.round\(\(v \|\| 20\) \* 3\) \/ 4; \}/.test(ex));
  assert.ok(/inset: 0, fit: 'shrink', lineSpacing: Math\.round\(p \* \(h \? 1\.08 : 1\.25\) \* 100\) \/ 100/.test(ex));
  assert.ok(/indent: Math\.round\(up \* 1\.1 \* 100\) \/ 100/.test(ex) && /paraSpaceAfter: Math\.round\(up \* 0\.45 \* 100\) \/ 100/.test(ex));
  assert.ok(!/'contain'/.test(ex), 'contain fotoğrafı geriyordu');
  assert.ok(/sizing: \{ type: 'cover', w: box\.w, h: box\.h \}/.test(ex));
  assert.equal(say(ex, "qaK.push(['EXPORT_ELEMENT_SKIPPED', si, e.id])"), 2, 'formül + tanınmayan tür');
  assert.ok(/else \{ oge\+\+; qaK\.push\(\['EXPORT_ELEMENT_SKIPPED', si, e\.id\]\); \}/.test(ex), 'zincirin son dalı');
  ['EXPORT_ELEMENT_SKIPPED: [\'warning\'', 'EXPORT_ELEMENT_SKIPPED: [\'Öğeyi'].forEach((k) => assert.equal(say(ink, k), 1, k));
  assert.ok(!/EXPORT_ELEMENT_SKIPPED/.test(cut('  var QA_KRITIK = ', ';')), 'uyarıdır, kritik değil');
});

test('A3 korunanlar: FMIN aynı, #43.1 (fitSlide 5 kez, künye çağrıları 7), şablon renkleri denetimde değişmez', () => {
  assert.ok(ink.includes('FMIN = { h: 22, t: 12, ul: 13 }'));
  assert.equal(say(ink, 'fitSlide('), 5);
  assert.equal(ink.split('\n').filter((l) => /kunyeUydur\(|kunyeSonra\(|kunyeBoy\(/.test(l) && !/var kunye(Uydur|Sonra|Boy) = function/.test(l)).length, 7);
  const g = cut('  var qaGorunum = function', '\n  };\n');
  assert.ok(!/\b(s|e|a|d|deck|T)\.[\w$]+\s*=(?!=)/.test(g) && !/\.(splice|unshift|pop|shift)\(/.test(g) && !/\b(s|e|d|deck)\.els\.push\(/.test(g), 'qaGorunum desteye yazıyor');
  assert.ok(!/fetch\(|invoke|setTimeout|localStorage|saveNow|dirty\(|temaSec|push\(\)/.test(g), 'qaGorunum yan etkili');
  assert.ok(/finally \{ zeminKoyu = z0; \}/.test(g), 'zeminKoyu geri konur');
  ['LOW_CONTRAST', 'HIERARCHY_INVERTED', 'TITLE_SIZE_DRIFT'].forEach((k) => { assert.ok(new RegExp(k + ": \\['info', '").test(ink), k + ' info'); assert.ok(new RegExp('    ' + k + ": \\['[A-ZÇĞİÖŞÜ]").test(ink), k + ' önerisi'); });
  assert.ok(ink.includes('K.content.bulgu = K.content.bulgu.concat(qaGorunum(d));'), 'içerik kaynağına eklenir (yeni pencere/kayıt yok)');
  assert.ok(ink.indexOf('K.content.bulgu = K.content.bulgu.concat(qaGorunum(d))') > ink.indexOf('content: qaIcerik(d)'), 'içerik durumu önceden hesaplanır');
});

/* ---------- Node: PPTX (ZIP) okuyucu — bağımlılıksız ---------- */
const unzip = (buf) => {
  const out = {}; let e = buf.length - 22; while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--; assert.ok(e >= 0, 'ZIP sonu yok');
  const n = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16);
  for (let i = 0; i < n; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50, 'merkez dizin bozuk');
    const m = buf.readUInt16LE(p + 10), cs = buf.readUInt32LE(p + 20), fl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), kl = buf.readUInt16LE(p + 32), lo = buf.readUInt32LE(p + 42);
    const ad = buf.toString('utf8', p + 46, p + 46 + fl), lf = buf.readUInt16LE(lo + 26), lx = buf.readUInt16LE(lo + 28), d = buf.subarray(lo + 30 + lf + lx, lo + 30 + lf + lx + cs);
    out[ad] = m === 8 ? zlib.inflateRawSync(d) : Buffer.from(d); p += 46 + fl + xl + kl;
  }
  return out;
};
const xs = (z, k) => (z[k] ? z[k].toString('utf8') : '');
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const EMU = 9525, SW = 9144000, SH = 5143500, TOL = 3 * EMU;
/* asetat XML'i → yazı kutuları (satır aralığı olan p:sp), resimler, kutu sınırları */
const asetatOku = (x) => {
  const sps = x.split('<p:sp>').slice(1).map((b) => b.split('</p:sp>')[0]).filter((b) => /<a:lnSpc>/.test(b)).map((b) => ({
    sz: +((b.match(/ sz="(\d+)"/) || [])[1] || 0), ln: +((b.match(/<a:lnSpc><a:spcPts val="(\d+)"/) || [])[1] || 0),
    ins: /lIns="0" tIns="0" rIns="0" bIns="0"/.test(b), spc: +((b.match(/ spc="(-?\d+)"/) || [])[1] || 0),
    marL: +((b.match(/marL="(\d+)"/) || [])[1] || 0), bul: /<a:buChar/.test(b), latin: (b.match(/<a:latin typeface="([^"]+)"/) || [])[1] || '' }));
  const XF = /<a:off x="(-?\d+)" y="(-?\d+)"\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\/>/;
  const pics = x.split('<p:pic>').slice(1).map((b) => ({ emb: (b.match(/r:embed="([^"]+)"/) || [])[1], src: (b.match(/<a:srcRect([^/]*)\/>/) || [])[1] || '', xf: (b.match(XF) || []).slice(1).map(Number) }));
  const geo = []; x.replace(new RegExp(XF.source, 'g'), (m, a, b, c, d) => { geo.push([+a, +b, +c, +d]); return m; });
  return { sps, pics, geo };
};
const rels = (x) => { const o = {}; x.replace(/<Relationship ([^>]+?)\/?>/g, (m, a) => { const id = (a.match(/Id="([^"]+)"/) || [])[1], t = (a.match(/Target="([^"]+)"/) || [])[1]; o[id] = t; return m; }); return o; };
const pptxIncele = (b64) => {
  const z = unzip(Buffer.from(b64, 'base64')), P = xs(z, 'ppt/presentation.xml'), PR = rels(xs(z, 'ppt/_rels/presentation.xml.rels')), CT = xs(z, '[Content_Types].xml');
  const ids = []; P.replace(/<p:sldId id="(\d+)" r:id="([^"]+)"\/>/g, (m, a, b) => { ids.push(b); return m; });
  const sl = ids.map((rid, i) => {
    const t = 'ppt/' + PR[rid], x = xs(z, t), rr = rels(xs(z, t.replace('slides/', 'slides/_rels/') + '.rels')), a = asetatOku(x);
    a.dosya = t; a.ok = !!x; a.ct = CT.includes('PartName="/' + t + '"'); a.xml = x;
    a.medya = a.pics.map((p) => { const tg = rr[p.emb]; return tg ? !!z[path.posix.normalize(path.posix.join(path.posix.dirname(t), tg))] : false; });
    const nt = Object.values(rr).find((v) => /notesSlide/.test(v)); a.not = nt ? xs(z, path.posix.normalize(path.posix.join(path.posix.dirname(t), nt))) : '';
    a.sira = i; return a;
  });
  return { z, sl, ids, boyut: P.match(/<p:sldSz cx="(\d+)" cy="(\d+)"/) };
};

/* ---------- B–E: başsız Chrome ---------- */
const { CHROME, yeniSunucu, duzenek } = require('./_capraz-duzenek.js');
const BUNDLE = [process.env.PPTXGEN_BUNDLE, path.join(ROOT, 'node_modules/pptxgenjs/dist/pptxgen.bundle.js')].filter(Boolean).find((p) => fs.existsSync(p)) || null;
const CDN = (ink.match(/cdn\.jsdelivr\.net\/npm\/pptxgenjs@([\d.]+)\/dist\/pptxgen\.bundle\.js/) || [])[1];

const KANCA = `  window.__K = { sayiAyarla: sayiAyarla, gundemVar: gundemVar, hazirla: function () { plotHazir = true; paintStrips(); }, exp: exportPptx, teknikQA: teknikQA, liste: qaListe, gorunum: qaGorunum,
    icerik: qaIcerik, temaDekor: temaDekor, temaAlt: temaAlt, kaynakSatir: kaynakSatir, newSlide: newSlide, renderAll: function () { renderAll(); },
    ac: function () { if (!plot.open) plot.showModal(); step(2); }, kapat: function () { if (plot.open) plot.close(); } };\n`;

/* 12 sentetik deste: [ad, dil, N, tema ('yok' | 'sahte' | sıra), gövde şeritleri, kaynak sayısı] */
const L = (t, b, k) => ({ k: k || 'list', t, b });
const DESTE = [
  ['akademik', 'tr', 10, 'sahte', [L('Araştırma sorusu', ['Kentsel ısı adaları gece sıcaklığını artırıyor', 'Yeşil alan payı ile sıcaklık ters orantılı', 'Ölçüm 12 istasyonda iki yıl sürdü']), L('Yöntem', ['Uydu verisi ve yer istasyonları birlikte kullanıldı', 'Regresyon modeli mevsim etkisini ayırdı', 'Hata payı istasyon başına hesaplandı']), L('Bulgular', ['Yeşil alan yüzde 10 artınca gece 0,8 derece düştü', 'Etki yoğun yapılaşmada daha güçlü', 'Sonuç iki yılda tutarlı kaldı']), L('Tartışma', ['Bulgular önceki çalışmalarla uyumlu', 'Gölge etkisi ayrı ölçülmedi', 'Örneklem tek kentle sınırlı']), L('Sınırlılıklar', ['Kış ayları eksik ölçüldü', 'İstasyonların ikisi taşındı', 'Uydu çözünürlüğü 30 metre']), L('Sonuç', ['Yeşil alan ucuz bir serinletme aracıdır', 'Planlama kararlarına girdi olabilir', 'Çok kentli çalışma gerekli'])], 2],
  ['kurumsal strateji', 'tr', 8, 0, [L('Pazar durumu', ['Pazar yılda yüzde 6 büyüyor', 'Üç büyük rakip payın yarısını tutuyor', 'Müşteri sadakati düşük']), L('Hedefler', ['Üç yılda payı iki katına çıkarmak', 'Kârlılığı korumak', 'Yeni bölgeye açılmak'], 'two'), L('Girişimler', ['Abonelik modeline geçiş', 'Kurumsal satış ekibi', 'Ortaklık ağı']), L('Riskler', ['Fiyat savaşı', 'Tedarik gecikmesi', 'Yetenek kaybı']), L('Yol haritası', ['2026: pilot bölge', '2027: ulusal yayılım', '2028: ihracat'], 'time'), L('Bütçe', ['Pazarlama 40', 'Ürün 35', 'Operasyon 25'], 'chart')], 0],
  ['tarihsel zaman çizelgesi', 'tr', 7, 'yok', [L('Erken dönem', ['1839: fotoğrafın icadı duyuruldu', '1888: ilk el kamerası satışa çıktı', '1900: ucuz kutu kamera yaygınlaştı'], 'time'), L('Renkli fotoğraf', ['1907: ilk ticari renkli yöntem', '1935: renkli film', '1963: anında renkli baskı'], 'time'), L('Sayısal dönem', ['1975: ilk sayısal kamera denemesi', '1991: ticari sayısal kamera', '2000: telefon kamerası'], 'time'), L('Bugün', ['Telefonlar yılda trilyonlarca fotoğraf çekiyor', 'Hesaplamalı fotoğraf yaygın', 'Arşivleme yeni sorun']), L('Etkiler', ['Gazetecilik dönüştü', 'Aile albümü buluta taşındı', 'Görsel kanıtın değeri tartışılıyor'])], 0],
  ['teknoloji karşılaştırması', 'en', 9, 2, [L('Two runtimes', ['Both target server workloads', 'One uses a garbage collector', 'The other uses ownership rules'], 'two'), L('Performance', ['Startup time differs by an order of magnitude', 'Throughput is close under load', 'Memory use favours ownership']), L('Developer experience', ['Tooling is mature on both sides', 'Error messages differ in tone', 'Learning curve is steeper for ownership']), L('Ecosystem', ['Package counts differ', 'Web frameworks exist for both', 'Embedded support favours one']), L('Benchmarks', ['Latency 12', 'Latency 9', 'Latency 15'], 'chart'), L('When to choose which', ['Pick the collector for rapid delivery', 'Pick ownership for tight memory budgets', 'Mixed teams can use both'])], 3],
  ['bilimsel grafikli', 'tr', 8, 'sahte', [L('Deney düzeneği', ['Üç farklı sıcaklıkta büyüme ölçüldü', 'Her koşul beş tekrar', 'Ölçüm optik yoğunlukla']), L('Büyüme hızı', ['20 derece: 0,4', '30 derece: 0,9', '40 derece: 0,3'], 'chart'), L('Verim', ['A suşu: 62', 'B suşu: 48', 'C suşu: 71'], 'chart'), L('Karşılaştırma', ['Suş | Hız | Verim', 'A | 0,9 | 62', 'B | 0,7 | 48'], 'table'), L('Yorum', ['En yüksek hız 30 derecede', 'C suşu verimde öne çıkıyor', 'Sıcaklık yükselince hız çöküyor'])], 1],
  ['veri yoğun', 'en', 11, 0, [L('Revenue by region', ['North: 42', 'South: 31', 'East: 18', 'West: 9'], 'chart'), L('Quarterly trend', ['Q1: 20', 'Q2: 24', 'Q3: 27', 'Q4: 31'], 'chart'), L('Cost structure', ['Item | Share', 'Staff | 48', 'Cloud | 22', 'Other | 30'], 'table'), L('Key ratios', ['Margin 18 percent', 'Churn 4 percent', 'Payback 11 months'], 'stat'), L('Cohorts', ['2024 cohort retained 71 percent', '2025 cohort retained 76 percent', 'Retention improves each year']), L('Unit economics', ['Acquisition cost fell by a fifth', 'Lifetime value rose', 'Ratio now above three']), L('Forecast', ['Base case 12 percent growth', 'Upside 18 percent', 'Downside 5 percent']), L('Sensitivity', ['Price is the strongest lever', 'Volume follows', 'Cost is least sensitive'])], 2],
  ['görsel yoğun', 'tr', 7, 2, [L('Kıyı manzaraları', ['Kayalık kıyılar dalgayı kırar', 'Kumsallar mevsimle yer değiştirir', 'Sulak alanlar kuşlara yuva']), L('Dağ ekosistemi', ['Yükseldikçe ağaç sınırı belirginleşir', 'Kar örtüsü su deposudur', 'Endemik bitkiler yaygın']), L('Bozkır', ['Yağış az, otlar derin köklü', 'Rüzgar erozyonu önemli', 'Otlatma dengesi kritik']), L('Orman', ['Katmanlı yapı türleri ayırır', 'Ölü odun yaşam alanıdır', 'Yangın döngüsü doğaldır'])], 0],
  ['alıntı ve ana mesaj', 'tr', 6, 'sahte', [L('Bir düşünür', ['Merak, ders kitabının bitirdiği yerde başlar.'], 'quote'), L('Ana mesaj', ['Soru sormayı öğreten okul, cevabı ezberleten okuldan daha uzun yaşar.']), L('Bir öğrenci', ['Yanlış yaptığımda bana neden diye sordular, aferin demediler.'], 'quote'), L('Kapanış düşüncesi', ['Öğrenme bir varış değil, bir yolculuk biçimidir.'])], 0],
  ['eğitsel', 'tr', 12, 4, [L('Hücre nedir', ['Canlının en küçük yapı birimi', 'Zarı, sitoplazması ve kalıtım maddesi var', 'Tek ya da çok hücreli canlılar']), L('Hücre zarı', ['Seçici geçirgendir', 'Madde alışverişini düzenler', 'Yağ ve proteinden oluşur']), L('Çekirdek', ['Kalıtım maddesini taşır', 'Hücre bölünmesini yönetir', 'Çift zarla çevrilidir']), L('Mitokondri', ['Enerji üretim merkezidir', 'Kendi kalıtım maddesi vardır', 'Kas hücresinde çoktur']), L('Bitki hücresi', ['Hücre duvarı vardır', 'Kloroplast fotosentez yapar', 'Büyük koful su depolar'], 'two'), L('Hayvan hücresi', ['Hücre duvarı yoktur', 'Sentrozom bölünmede görev alır', 'Kofullar küçüktür']), L('Taşıma', ['Difüzyon enerji harcamaz', 'Aktif taşıma enerji ister', 'Osmoz suyun geçişidir']), L('Bölünme', ['Mitoz büyümeyi sağlar', 'Mayoz üreme hücresi oluşturur', 'Kromozom sayısı korunur'], 'time'), L('Özet', ['Hücre yaşamın temel birimidir', 'Organeller iş bölümü yapar', 'Zar ve çekirdek merkezi rol oynar'])], 3],
  ['yoğun metin', 'en', 8, 'yok', [L('Context', ['Municipal water systems built in the twentieth century are now reaching the end of their design life across most regions', 'Replacement budgets have not kept pace with deterioration, and leakage rates above a quarter of supply are common', 'Climate variability adds pressure on both supply and treatment capacity']), L('Problem statement', ['Utilities lack reliable condition data for buried assets, so replacement is driven by failures rather than by risk', 'Emergency repairs cost several times more than planned renewal and disrupt service for longer periods', 'Customers see rising bills without visible improvement in reliability or quality']), L('Approach', ['Combine acoustic leak detection with pipe age, material and soil data to estimate failure risk for each segment', 'Rank renewal candidates by risk per unit cost and coordinate with road works to share excavation', 'Publish a rolling five year plan so that funding and procurement can be scheduled in advance']), L('Expected outcomes', ['Leakage could fall by a third within five years if the highest risk segments are renewed first', 'Planned work replaces a large share of emergency repairs, lowering average cost per kilometre', 'Transparent plans improve public trust and support for tariff decisions']), L('Open questions', ['How accurate are risk scores where historical failure records are incomplete or inconsistent', 'Which financing models suit small utilities with limited borrowing capacity', 'How should equity concerns shape the order of renewal across neighbourhoods'])], 0],
  ['Türkçe uzun sözcük', 'tr', 9, 'sahte', [L('Çekoslovakyalılaştıramadıklarımızdan mısınız', ['Muvaffakiyetsizleştiricileştiriveremeyebileceklerimizden biri', 'Şişeğiçöğüşİığ özel karakterleri: ç ğ ı İ ö ş ü Ç Ğ Ö Ş Ü', 'Afyonkarahisarlılaştırabildiklerimizden misiniz']), L('Göç ve kültürel etkileşim', ['Anadolu’da yüzyıllardır süren göçler dili zenginleştirdi', 'Ödünç sözcükler ses uyumuna uyarlandı', 'Yerel ağızlar bu izleri hâlâ taşıyor']), L('Yazım kuralları', ['Büyük İ ile küçük ı ayrı harflerdir', 'Şapkalı â ve î anlam ayırır: kâr / kar', 'Kesme işareti özel adlarda kullanılır: İstanbul’un']), L('Örnek cümleler', ['Öğretmenlerimizden öğrendiklerimizi uygulayabileceğiz', 'Gözlükçülerdeki çeşitlilik şaşırtıcıydı', 'Üşüdüğümüz için içeri girdik']), L('Sözcük türetme', ['Ekler sözcüğe yeni anlam katar', 'Bir kökten onlarca sözcük türer', 'Sondan eklemeli yapı uzun sözcük üretir']), L('Sonuç', ['Uzun sözcükler dilin esnekliğini gösterir', 'Yazım tutarlılığı okumayı kolaylaştırır', 'Özel karakterler doğru basılmalıdır'])], 0],
  ['English long headings', 'en', 10, 1, [L('Why distributed teams need explicit written decision records to stay aligned', ['Decisions made in calls are forgotten within weeks', 'New members cannot reconstruct the reasoning', 'Written records reduce repeated debates']), L('A lightweight template for recording architectural and product decisions consistently', ['Context, options, decision and consequences', 'One page per decision', 'Linked from the code that implements it']), L('How to review and supersede earlier decisions without losing the historical context', ['Never edit an accepted record', 'Write a new record that supersedes it', 'Keep both searchable']), L('Measuring whether decision records actually improve delivery speed and quality', ['Track time to onboard new engineers', 'Count reopened design discussions', 'Survey perceived clarity each quarter']), L('Common pitfalls when introducing decision records into an existing engineering organisation', ['Too much ceremony kills adoption', 'Records written after the fact lack honesty', 'No owner means no upkeep']), L('Recommendations and next steps for teams starting this practice in the coming quarter', ['Start with three recent decisions', 'Review records in the weekly meeting', 'Revisit the template after two months'])], 2]
];

/* görsel yoğun destede yerel (data:) fotoğraflar: bilinen oran → bilinen kutu; beklenen cover kırpması */
const FOTO = [[400, 200, 300, 300], [200, 400, 300, 300], [300, 300, 400, 200], [1600, 900, 320, 180]];

const sayfaGovde = (deste) => `
  await sakin(); window.__pptx = []; R.D = [];
  var K = window.__K, P0 = window.PptxGenJS; if (P0) P0.prototype.writeFile = function (o) { var me = this; return me.write({ outputType: 'base64' }).then(function (b) { window.__pptx.push({ ad: o && o.fileName, b64: b }); return o && o.fileName; }); };
  var tost = function () { return (d.querySelector('[data-toast-t]') || {}).textContent || ''; };
  var foto = function (w, h, c) { var cv = d.createElement('canvas'); cv.width = w; cv.height = h; var x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.fillRect(w / 4, h / 4, w / 2, h / 2); return cv.toDataURL('image/png'); };
  var bekleyen = function (D) { return D.slides.map(function (s) { var pe = K.temaDekor(s).concat(s.els, K.temaAlt(s)), yz = [], res = 0, tas = [];
    pe.forEach(function (e) { if (!e || e.muted) return; if (e.x < -3 || e.y < -3 || e.x + e.w > 963 || e.y + e.h > 543) tas.push([e.x, e.y, e.w, e.h, e.type]);
      if ((e.type === 'h' || e.type === 't') && e.text) yz.push({ tip: e.type, size: e.size });
      else if (e.type === 'ul' && String(e.text || '').split('\\n').some(function (x) { return x.trim(); })) yz.push({ tip: 'ul', size: e.size, kay: K.kaynakSatir(e.text) });
      else if ((e.type === 'img' && e.src) || /^(viz|mmd|icon)$/.test(e.type)) res++; });
    return { yazi: yz, resim: res, tas: tas, notes: s.notes || '', baslik: (s.els.filter(function (e) { return e.type === 'h' && e.text && !e.muted; })[0] || {}).text || '' }; }); };
  var dis = async function () { var n0 = window.__pptx.length, uy = false; await K.exp(null); if (window.__pptx.length === n0) { uy = true; await K.exp(null); } return { uy: uy, son: window.__pptx[window.__pptx.length - 1], tost: tost() }; };
  var DESTE = ${JSON.stringify(deste)}, FOTO = ${JSON.stringify(FOTO)};
  for (var di = 0; di < DESTE.length; di++) {
    var B = DESTE[di], ad = B[0], dil = B[1], N = B[2], tm = B[3], en = dil === 'en';
    d.querySelector('[data-newdeck]').click(); await bekle(50);
    var T = tm === 'sahte' ? TEMA : typeof tm === 'number' ? { def: S.TEMALAR[tm % S.TEMALAR.length].def } : null; S.temaSec(T);      /* 'yok' = şablon seçicide boş seçim (temel palet, Arial) */
    var srcs = []; for (var q = 0; q < B[5]; q++) srcs.push({ id: 's' + q, url: 'https://ornek.invalid/' + q, apa: 'Yazar, A. (2024). Sentetik kaynak ' + (q + 1) + '.' });
    var out = [{ k: 'cover', t: ad.charAt(0).toUpperCase() + ad.slice(1), b: [] }].concat(JSON.parse(JSON.stringify(B[4])).map(function (s, i) { s.src = srcs.length ? [srcs[i % srcs.length].id] : []; s.notes = (en ? 'Speaker note for ' : 'Konuşma notu: ') + s.t + '.'; return s; })).concat([{ k: 'end', t: en ? 'Thank you' : 'Teşekkürler', b: [] }]);
    var pm = { title: out[0].t, sub: 't', lang: dil, source: 'topic', sourceId: null, yol: { k: 'research', yedek: 0 }, sources: srcs, istek: N };
    var t0 = performance.now(); K.sayiAyarla(out, N, pm, srcs.length ? 1 : 0); var tSay = performance.now() - t0;
    if (srcs.length) out.splice(out.length - 1, 0, { t: en ? 'References' : 'Kaynakça', k: 'refs', b: srcs.map(function (x, i) { return '[' + (i + 1) + '] ' + x.apa; }), notes: '' });
    S.set(out, pm); t0 = performance.now(); K.hazirla(); var tBoya = performance.now() - t0;
    var sy = d.querySelector('[data-pl-sayi]'), sayac = sy ? sy.textContent : '', oto = d.querySelectorAll('[data-strips] .sx-strip-oto').length, seritN = d.querySelectorAll('[data-strips] .sx-strip').length;
    var ikinci = (d.querySelector('[data-strips] .sx-strip-oto') || {}).previousElementSibling === d.querySelector('[data-strips] .sx-strip');
    S.bas('new'); await sakin(); await bekle(1500); await dur(800);
    var D = S.deck(), ids = D.slides.map(function (s) { return s.id; });
    var row = { ad: ad, N: N, sayi: pm.sayi, gundem: pm.gundem, sayac: sayac, oto: oto, ikinci: ikinci, seritN: seritN, n: D.slides.length, thumbs: d.querySelectorAll('[data-thumbs] .sx-th').length,
      lay: D.slides.map(function (s) { return s.lay + ':' + (s.v || 0); }), gun: D.slides.filter(function (s) { return s.lay === 'list' && s.v === 10; }).length,
      tekil: ids.filter(function (x, i) { return ids.indexOf(x) === i; }).length, tSay: tSay, tBoya: tBoya, tema: D.tema ? { hf: D.tema.hf, bf: D.tema.bf } : null };
    if (ad === 'görsel yoğun') {      /* kullanıcının yüklediği (data:) fotoğraflar: bilinen oran, bilinen kutu, kapsız */
      row.foto = []; FOTO.forEach(function (f, i) { var s = D.slides[1 + i], im = { id: 'ft' + i, type: 'img', x: 520, y: 150, w: f[2], h: f[3], src: foto(f[0], f[1], ['#a33', '#3a3', '#33a', '#aa3'][i]) }; s.els.push(im); row.foto.push([s.id, f]); });
      K.renderAll(); await dur(400);
    }
    var tq = K.teknikQA(D, 'deste'), t1 = performance.now(), x = await dis(); row.tDis = performance.now() - t1;
    var tq2 = K.teknikQA(D, 'deste');
    row.bek = bekleyen(D); row.uyari = x.uy; row.tost = x.tost; row.b64 = x.son ? x.son.b64 : null;
    row.qa = tq2 ? tq2.issues.map(function (z) { return z.code + '@' + z.slide; }) : null; row.qaDurum = tq2 && tq2.status;
    var t2 = performance.now(), gr = K.gorunum(D); row.tGor = performance.now() - t2; row.gor = gr.map(function (z) { return z.code + '@' + z.slide + ':' + z.why; });
    row.icerikDurum = K.icerik(D).durum; row.listeIcerik = K.liste(D).bulgu.filter(function (z) { return z.source === 'content' || z.sources.indexOf('content') >= 0; }).map(function (z) { return z.code + ':' + z.severity; });
    await S.saveNow(); await dur(300); row.dbId = D.dbId || null;
    if (ad === 'eğitsel') {      /* yaşam döngüsü: çoğalt, sil, taşı, boş ekle — deste N'e geri zorlanmaz */
      var th = d.querySelector('[data-thumbs]');
      th.querySelector('[data-tdup="3"]').click(); await bekle(200);
      th.querySelector('[data-tdel="5"]').click(); await bekle(200);
      var g2 = th.querySelector('[data-go="2"]'); g2.focus(); g2.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true })); await bekle(200);
      var bl = d.querySelector('[data-blank]'); if (bl) bl.click(); await bekle(200);
      var nb = D.slides.length; await dur(2500);
      var ids2 = D.slides.map(function (s) { return s.id; });
      row.yasam = { once: row.n, hemen: nb, sonra: D.slides.length, thumbs: d.querySelectorAll('[data-thumbs] .sx-th').length, gun: D.slides.filter(function (s) { return s.lay === 'list' && s.v === 10; }).length,
        tekil: ids2.filter(function (x, i) { return ids2.indexOf(x) === i; }).length, ilk: D.slides[0].lay, son: D.slides[D.slides.length - 1].lay };
      var tqy = K.teknikQA(D, 'deste'); row.yasam.qa = tqy.issues.map(function (z) { return z.code; }).filter(function (c) { return /SLIDE_COUNT/.test(c); });
      var xy = await dis(); row.yasam.b64 = xy.son ? xy.son.b64 : null; await S.saveNow(); await dur(300);
    }
    if (di === 0) {      /* tanınmayan öğe türü: PPTX'te sessizce düşmez; kaldırılınca kayıt bir sonraki aktarımla silinir */
      D.slides[2].els.push({ id: 'yabanci1', type: 'yabanci', x: 40, y: 460, w: 120, h: 40 }); K.renderAll(); await dur(300);
      var xa = await dis(), qa1 = K.teknikQA(D, 'deste');
      row.yab = { tost: xa.tost, qa: qa1.issues.filter(function (z) { return z.code === 'EXPORT_ELEMENT_SKIPPED'; }).map(function (z) { return [z.slide, z.element, z.severity]; }), b64: xa.son ? xa.son.b64 : null, durum: qa1.status };
      D.slides[2].els = D.slides[2].els.filter(function (e) { return e.id !== 'yabanci1'; }); K.renderAll(); await dur(300);
      var xb = await dis(); row.yab.sonra = K.teknikQA(D, 'deste').issues.filter(function (z) { return z.code === 'EXPORT_ELEMENT_SKIPPED'; }).length; row.yab.tost2 = xb.tost;
    }
    R.D.push(row);
  }
  /* E: görünüm önerileri — elle kurulan uç durumlar (yalnız info, deste değişmez, durum değişmez) */
  d.querySelector('[data-newdeck]').click(); await bekle(50);
  S.set([{ k: 'cover', t: 'Görünüm', b: [] }, L1('Bir', ['Kısa madde bir', 'Kısa madde iki', 'Kısa madde üç']), L1('İki', ['Kısa madde bir', 'Kısa madde iki', 'Kısa madde üç']), L1('Üç', ['Kısa madde bir', 'Kısa madde iki', 'Kısa madde üç']), { k: 'end', t: 'Son', b: [] }], { title: 'Görünüm', sub: 't', lang: 'tr', source: 'topic', sourceId: null });
  S.bas('new'); await sakin(); await bekle(800); await dur(500);
  var G = S.deck(), h1 = G.slides[1].els.filter(function (e) { return e.type === 'h'; })[0], u1 = G.slides[1].els.filter(function (e) { return e.type === 'ul'; })[0];
  R.E = { once: K.gorunum(G).map(function (z) { return z.code; }), durum0: K.icerik(G).durum };
  var once = JSON.stringify(G.slides), soluk = { id: 'soluk', type: 't', x: 520, y: 505, w: 400, h: 26, size: 16, text: 'Soluk bir açıklama satırı', color: '#C9CED8', align: 'left' };
  G.slides[2].els.push(soluk); h1.size = 48; u1.size = 50; G.slides[3].els.filter(function (e) { return e.type === 'h'; })[0].size = 22;
  var on1 = JSON.stringify(G.slides), gr2 = K.gorunum(G);
  R.E.sonra = gr2.map(function (z) { return [z.code, z.slide, z.el, z.severity, z.why]; }); R.E.degismedi = JSON.stringify(G.slides) === on1; R.E.durum1 = K.icerik(G).durum;
  R.E.liste = K.liste(G).bulgu.filter(function (z) { return /LOW_CONTRAST|HIERARCHY_INVERTED|TITLE_SIZE_DRIFT/.test(z.code); }).map(function (z) { return [z.code, z.severity, z.priority, z.repairable, z.message, z.recommendation]; });
  R.E.koyu = (function () { var s = G.slides[2], b0 = s.bg; s.bg = 'navy'; var r = K.gorunum(G).filter(function (z) { return z.el === 'soluk'; }); s.bg = b0; return r.length; })();
  R.E.digerDeste = K.gorunum(JSON.parse(once)).length;
  R.ag = window.__ag;
`;

/* bir sayfa için yardımcı: başsız Chrome'u pencere boyutu ve (isteğe bağlı) ekran görüntüsüyle koşturur */
const kosX = (W, dosya, prof, icerik, ek) => new Promise((res, rej) => {
  fs.writeFileSync(path.join(W, dosya), icerik);
  execFile(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars', '--user-data-dir=' + path.join(W, 'prof-' + prof), '--allow-file-access-from-files', '--virtual-time-budget=' + ((ek && ek.butce) || 60000)].concat(ek && ek.ekran ? [] : ['--dump-dom'], (ek && ek.arg) || [], [pathToFileURL(path.join(W, dosya)).href]),
    { maxBuffer: 256 * 1024 * 1024, timeout: 900000 }, (e, out) => {
      if (e) return rej(e); if (ek && ek.ekran) return res({});
      const m = String(out).match(/<pre id="diag">([\s\S]*?)<\/pre>/); if (!m) return rej(new Error(dosya + ': diag yok'));
      res(JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&')));
    });
});

/* Ekran genişlikleri ve gerçek süre DevTools protokolüyle (sunum-teknik-qa kosGercek ile aynı yöntem): sanal saatte
   performance.now() eşzamanlı kodda ilerlemez, --window-size 500 px'in altına inmez; Emulation gerçek 320 px verir. */
const GENISLIK = [1440, 1024, 768, 390, 320];
const olcGovde = (deste) => `
  await sakin(); var K = window.__K; window.__pptx = []; var P0 = window.PptxGenJS; if (P0) P0.prototype.writeFile = function (o) { return this.write({ outputType: 'base64' }).then(function (b) { window.__pptx.push(b.length); return o && o.fileName; }); };
  d.querySelector('[data-newdeck]').click(); S.temaSec(TEMA);
  var out = [{ k: 'cover', t: 'Çekoslovakyalılaştıramadıklarımızdan mısınız', b: [] }].concat(['Araştırma sorusu', 'Yöntem ve veri kaynakları', 'Bulgular', 'Tartışma', 'Sınırlılıklar', 'Sonuç ve öneriler', 'Ek okuma'].map(function (t) { return { k: 'list', t: t, b: ['Bir madde', 'İkinci madde', 'Üçüncü madde'] }; })).concat([{ k: 'end', t: 'Teşekkürler', b: [] }]);
  var pm = { title: out[0].t, sub: 't', lang: 'tr', source: 'topic', sourceId: null, istek: 8 }; K.sayiAyarla(out, 8, pm, 0); out.splice(3, 0, { k: 'list', t: '', b: [] });
  S.set(out, pm); K.ac(); K.hazirla(); await bekle(400);
  window.__olc = function () { var O = {}, r = function (el) { if (!el) return null; var b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), sw: el.scrollWidth, cw: el.clientWidth }; };
    var dl = d.querySelector('[data-plotdlg]'), sy = d.querySelector('[data-pl-sayi]'), oto = d.querySelector('[data-strips] .sx-strip-oto'), li = d.querySelector('[data-strips] .sx-strip');
    O.vw = innerWidth; O.dlg = r(dl); O.sayi = r(sy); O.oto = r(oto); O.ilk = r(li); O.metin = sy && sy.textContent; O.gizli = sy && sy.hidden; O.akis = (d.querySelector('[data-flow]') || {}).textContent || ''; O.satir = Array.prototype.map.call(d.querySelectorAll('[data-strips] > li'), function (e) { return e.className.indexOf('sx-strip-oto') >= 0 ? 'oto' : (e.querySelector('input,[contenteditable]') || {}).value || ''; });
    O.dokSw = d.documentElement.scrollWidth; O.dlgSw = dl.scrollWidth; O.dlgCw = dl.clientWidth; O.tasan = Array.prototype.slice.call(d.querySelectorAll('body *')).filter(function (e) { var b = e.getBoundingClientRect(); return b.width && b.right > innerWidth + 1 && !e.closest('[data-plotdlg]'); }).slice(0, 4).map(function (e) { return e.tagName + '.' + String(e.className).slice(0, 40) + ':' + Math.round(e.getBoundingClientRect().right); }); O.otoNo = oto ? getComputedStyle(oto, '::before').content : null; O.otoKucuk = oto ? r(oto.querySelector('small')) : null; O.ag = window.__ag.slice();
    return JSON.stringify(O); };
  window.__sure = async function () { var DESTE = ${JSON.stringify(deste)}, U = {}, en = function (k, v) { U[k] = Math.max(U[k] || 0, v); }, ort = function (f, n) { var t = performance.now(); for (var i = 0; i < n; i++) f(); return (performance.now() - t) / n; };
    K.kapat();
    for (var di = 0; di < DESTE.length; di++) { var B = DESTE[di];
      d.querySelector('[data-newdeck]').click(); await bekle(50); S.temaSec(TEMA);
      var srcs = []; for (var q = 0; q < B[5]; q++) srcs.push({ id: 's' + q, url: 'https://ornek.invalid/' + q, apa: 'Yazar, A. (2024). Sentetik kaynak ' + (q + 1) + '.' });
      var kur = function () { return [{ k: 'cover', t: B[0], b: [] }].concat(JSON.parse(JSON.stringify(B[4]))).concat([{ k: 'end', t: 'Son', b: [] }]); }, pm2 = null, o2 = null;
      en('sayim', ort(function () { o2 = kur(); pm2 = { title: B[0], sub: 't', lang: B[1], source: 'topic', sourceId: null, sources: srcs, istek: B[2] }; K.sayiAyarla(o2, B[2], pm2, srcs.length ? 1 : 0); }, 200));
      S.set(o2, pm2); en('sayac', ort(function () { K.hazirla(); }, 20));
      var t0 = performance.now(); S.bas('new'); en('basim', performance.now() - t0); await sakin(); await dur(400);
      var D = S.deck(); en('gorunum', ort(function () { K.gorunum(D); }, 20)); en('liste', ort(function () { K.liste(D); }, 5)); en('teknik', ort(function () { K.teknikQA(D, 'deste'); }, 5));
      var n0 = window.__pptx.length; t0 = performance.now(); await K.exp(null); if (window.__pptx.length === n0) await K.exp(null); en('pptx', performance.now() - t0); U.n = Math.max(U.n || 0, D.slides.length); }
    return JSON.stringify(U); };
`;

/* DevTools protokolü: sayfa gerçek saatte açılır; adim(gonder) hazır sayfada ölçer */
const kosCDP = async (W, dosya, prof, icerik, adim) => {
  const { spawn } = require('node:child_process');
  fs.writeFileSync(path.join(W, dosya), icerik);
  const bekle = (ms) => new Promise((r) => setTimeout(r, ms)), prd = path.join(W, 'prof-' + prof), dosyaP = path.join(prd, 'DevToolsActivePort');
  let ws = null; const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars', '--user-data-dir=' + prd, '--allow-file-access-from-files', '--remote-debugging-port=0', 'about:blank'], { stdio: 'ignore' });
  try {
    let tgt = null, port = 0;
    for (let k = 0; k < 150 && !tgt; k++) { await bekle(100); try { port = port || +fs.readFileSync(dosyaP, 'utf8').split('\n')[0]; if (port) tgt = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()).find((x) => x.type === 'page'); } catch (e) { /* Chrome açılıyor */ } }
    if (!tgt) throw new Error('CDP hedefi yok');
    ws = new WebSocket(tgt.webSocketDebuggerUrl); let id = 0; const bek = {};
    const gonder = (method, params) => new Promise((r) => { const i = ++id; bek[i] = r; ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && bek[m.id]) { bek[m.id](m.result || m); delete bek[m.id]; } };
    await new Promise((r) => { ws.onopen = r; });
    await gonder('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await gonder('Page.navigate', { url: pathToFileURL(path.join(W, dosya)).href });
    let txt = '';
    for (let k = 0; k < 240 && !txt; k++) { await bekle(250); const r = await gonder('Runtime.evaluate', { expression: 'document.getElementById("diag") ? document.getElementById("diag").textContent : ""', returnByValue: true }); txt = r.result && r.result.value; }
    if (!txt) throw new Error(dosya + ': diag yok');
    const R0 = JSON.parse(txt); if (R0.hata) throw new Error('sayfa hatası: ' + R0.hata);
    const out = await adim(gonder, bekle);
    await Promise.race([gonder('Browser.close'), bekle(2000)]);
    return out;
  } finally {      /* Chrome kapanmadan çıkılmaz: SIGTERM her zaman yetmiyor */
    try { if (ws) ws.close(); } catch (e) { /* kapalı */ }
    const bitti = new Promise((r) => { if (ch.exitCode !== null || ch.signalCode) r(); else ch.once('exit', r); });
    ch.kill(); if (await Promise.race([bitti.then(() => 1), bekle(3000).then(() => 0)]) === 0) { ch.kill('SIGKILL'); await Promise.race([bitti, bekle(2000)]); }
  }
};

const tarayici = () => {
  if (!CHROME) { console.log('  ATLANDI  B–E (başsız Chrome): Chrome bulunamadı — CHROME_BIN ile yol verin. Bu testler GEÇTİ sayılmadı.'); return Promise.resolve(); }
  const { W, sayfa, temizle } = duzenek();
  const hazir = (h) => {
    assert.equal(h.split('  window.__S = { set:').length, 2);
    h = h.replace('  window.__S = { set:', () => KANCA + '  window.__S = { set:');
    assert.equal(h.split('var S = window.__S, R = {}, d = document,').length, 2);
    h = h.replace('var S = window.__S, R = {}, d = document,', 'var L1 = function (t, b, k) { return { k: k || \'list\', t: t, b: b }; }, S = window.__S, R = {}, d = document,');
    return BUNDLE ? h.replace('<pre id="diag"></pre>', '<script src="' + pathToFileURL(BUNDLE).href + '"></script>\n<pre id="diag"></pre>') : h;
  };
  return (async () => {
    const Hs = yeniSunucu({ senkron: true }); await new Promise((r) => Hs.srv.listen(0, '127.0.0.1', r));
    let R, OLC = [], SURE = null, tDuvar = Date.now();
    try {
      R = await kosX(W, 'tutar.html', 'tutar', hazir(sayfa('ok', Hs.srv.address().port, 0, sayfaGovde(DESTE))), { butce: 400000 });
      tDuvar = Date.now() - tDuvar;
      const EK = process.env.EKRAN_DIR; if (EK) fs.mkdirSync(EK, { recursive: true });
      const SUREDESTE = DESTE.filter((x) => /^(veri yoğun|eğitsel|English long headings)$/.test(x[0]));
      SURE = await kosCDP(W, 'olc.html', 'olc', hazir(sayfa('ok', Hs.srv.address().port, 0, olcGovde(SUREDESTE))), async (gonder, bekle) => {
        for (const g of GENISLIK) {
          await gonder('Emulation.setDeviceMetricsOverride', { width: g, height: 900, deviceScaleFactor: 1, mobile: false }); await bekle(500);
          const r = await gonder('Runtime.evaluate', { expression: 'window.__olc()', returnByValue: true }); OLC.push(JSON.parse(r.result.value));
          if (EK) { const sh = await gonder('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(EK, 'serit-penceresi-' + g + '.png'), Buffer.from(sh.data, 'base64')); }
        }
        await gonder('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
        const r = await gonder('Runtime.evaluate', { expression: 'window.__sure()', awaitPromise: true, returnByValue: true });
        if (!r.result || typeof r.result.value !== 'string') throw new Error('süre ölçümü: ' + JSON.stringify(r).slice(0, 300));
        return JSON.parse(r.result.value);
      });
    } finally { Hs.srv.close(); temizle(); }
    if (R.hata) throw new Error('sayfa hatası: ' + R.hata);
    const D = R.D;
    if (process.env.DOKUM) fs.writeFileSync(process.env.DOKUM, JSON.stringify({ R, OLC, SURE }, null, 1));

    test('B1 12 deste: sayaç = basılan = küçük resim = istek (olanaklıysa); gündem tam bir kez, 2. sırada; kapak ilk, kaynakça kapanıştan önce', () => {
      assert.equal(D.length, 12);
      D.forEach((r) => {
        const m = String(r.sayac).match(/Basılınca (\d+) sayfa: (\d+) şerit( \+ 1 otomatik gündem)?/); assert.ok(m, r.ad + ' sayaç: ' + r.sayac);
        assert.equal(+m[1], r.n, r.ad + ': sayaç ' + m[1] + ' ≠ basılan ' + r.n);
        assert.equal(r.thumbs, r.n, r.ad + ' küçük resim'); assert.equal(r.tekil, r.n, r.ad + ' kimlik tekrarı');
        assert.equal(r.n, r.sayi.toplam, r.ad + ' öngörü'); if (!r.sayi.eksik && !r.sayi.imkansiz) assert.equal(r.n, r.N, r.ad + ': istenen ' + r.N + ', basılan ' + r.n);
        assert.equal(r.gun, r.gundem, r.ad + ' gündem sayısı'); assert.equal(!!m[3], !!r.gundem, r.ad + ' sayaç gündemi'); assert.equal(r.oto, r.gundem, r.ad + ' otomatik satır');
        if (r.gundem) { assert.equal(r.lay[1], 'list:10', r.ad + ' gündem 2. sırada'); assert.ok(r.ikinci, r.ad + ' otomatik satır kapaktan hemen sonra'); }
        assert.equal(r.lay[0].split(':')[0], 'cover'); assert.equal(r.lay[r.n - 1].split(':')[0], 'end');
        const ri = r.lay.findIndex((x) => x.startsWith('refs:')); if (ri >= 0) assert.equal(ri, r.n - 2, r.ad + ' kaynakça kapanıştan önce');
        const sc = r.qa.filter((c) => /SLIDE_COUNT/.test(c)); assert.deepEqual(sc, r.sayi.eksik ? ['SLIDE_COUNT_UNDER@null'] : [], r.ad + ' sayı uyarısı: ' + sc.join(' '));      /* içerik yetmezse eksik sessiz kalmaz, dolgu uydurulmaz */
      });
      assert.ok(D.some((r) => r.gundem) && D.some((r) => !r.gundem), 'gündemli ve gündemsiz deste var');
      assert.ok(D.some((r) => r.sayi.kesilen > 0) && D.some((r) => r.sayi.eksik > 0), 'kesilen ve eksik kalan deste var');
    });

    test('B2 kayıt: slide_count = asetat satırı = deste; elle düzenlenen deste N\'e geri zorlanmaz, gündem yine tek, sayı uyarısı yok', () => {
      const P = Hs.DB.presentations;
      D.forEach((r) => { const row = P.find((p) => p.id === r.dbId) || P.find((p) => p.title === r.sayac && 0); assert.ok(row, r.ad + ' kaydı yok'); const rs = Hs.DB.presentation_slides.filter((x) => x.presentation_id === row.id);
        const bek = r.yasam ? r.yasam.sonra : r.n; assert.equal(row.slide_count, bek, r.ad + ' slide_count'); assert.equal(rs.length, bek, r.ad + ' satır');
        assert.equal(new Set(rs.map((x) => x.order_index)).size, rs.length, r.ad + ' sıra tekrarı'); });
      const y = D.find((r) => r.yasam).yasam;
      assert.equal(y.hemen, y.once + 1, 'çoğalt + sil + taşı + boş = +1'); assert.equal(y.sonra, y.hemen, 'deste geri zorlandı'); assert.equal(y.thumbs, y.sonra);
      assert.equal(y.gun, 1); assert.equal(y.tekil, y.sonra); assert.equal(y.ilk, 'cover'); assert.deepEqual(y.qa, [], 'elle düzenlemede sayı uyarısı');
    });

    if (!BUNDLE) { console.log('  ATLANDI  C1–C5 (gerçek PPTX): pptxgenjs paketi yok — PPTXGEN_BUNDLE ile pptxgen.bundle.js yolunu verin. Bu testler GEÇTİ sayılmadı.'); }
    else {
      const ver = (fs.readFileSync(BUNDLE, 'utf8').slice(0, 200).match(/PptxGenJS ([\d.]+)/) || [])[1];
      const PX = D.map((r) => (r.b64 ? pptxIncele(r.b64) : null));
      test('C1 gerçek PPTX (XML): ZIP, presentation.xml sırası, rels, slide*.xml, Content_Types, medya, notlar; asetat sayısı = deste; sıra = başlık sırası', () => {
        assert.equal(ver, CDN, 'test paketi üretimin CDN sürümü olmalı (' + ver + ' / ' + CDN + ')');
        D.forEach((r, i) => { const X = PX[i]; assert.ok(X, r.ad + ' PPTX üretilmedi'); assert.equal(X.sl.length, r.n, r.ad + ' asetat');
          assert.deepEqual(X.boyut.slice(1).map(Number), [SW, SH]);
          X.sl.forEach((s, k) => { assert.ok(s.ok && s.ct, r.ad + ' ' + s.dosya); assert.ok(s.medya.every(Boolean), r.ad + ' kopuk medya ' + (k + 1));
            const b = r.bek[k]; if (b.baslik) assert.ok(s.xml.includes(esc(b.baslik.split('\n')[0].slice(0, 30))), r.ad + ' sıra/başlık ' + (k + 1));
            if (b.notes) assert.ok(s.not.includes(esc(b.notes.slice(0, 24))), r.ad + ' not ' + (k + 1)); });
          const nums = X.sl.map((s) => +s.dosya.match(/slide(\d+)\.xml/)[1]); assert.deepEqual(nums, nums.slice().sort((a, b) => a - b), r.ad + ' dosya sırası'); });
      });
      test('C2 hiçbir öğe sessizce düşmez: yazı kutusu ve resim sayısı ekrandakiyle aynı; kutular asetat içinde', () => {
        let tasan = 0;
        D.forEach((r, i) => PX[i].sl.forEach((s, k) => { const b = r.bek[k];
          assert.equal(s.sps.length, b.yazi.length, r.ad + ' ' + (k + 1) + '. asetat yazı kutusu');
          assert.equal(s.pics.length, b.resim, r.ad + ' ' + (k + 1) + '. asetat resim');
          /* asetat dışına taşan kutu yalnız editörde de taşan öğe olabilir (şablon dekoru kenardan taşar; ekranda da kırpılır) */
          s.geo.filter((g) => !(g[0] >= -TOL && g[1] >= -TOL && g[0] + g[2] <= SW + TOL && g[1] + g[3] <= SH + TOL)).forEach((g) => { tasan++;
            assert.ok(b.tas.some((t) => Math.abs(t[0] * EMU - g[0]) <= TOL && Math.abs(t[2] * EMU - g[2]) <= TOL), r.ad + ' ' + (k + 1) + '. asetatta sınır dışı kutu ' + g + ' (editörde içerideydi)'); }); }));
        D.forEach((r) => assert.ok(!r.qa.some((c) => /^EXPORT_/.test(c)), r.ad + ' aktarım kaydı: ' + r.qa.join(' ')));
        const y = D[0].yab; assert.deepEqual(y.qa.map((x) => [x[0], x[1], x[2]]), [[3, 'yabanci1', 'warning']]); assert.equal(y.durum, 'warn');
        assert.ok(/1 öğe PowerPoint’e aktarılamadı; denetim penceresinde görünür\./.test(y.tost), y.tost); assert.equal(pptxIncele(y.b64).sl.length, D[0].n, 'öğe düşse de asetat sayısı aynı');
        assert.equal(y.sonra, 0, 'öğe kaldırılınca kayıt kalkar'); assert.ok(!/öğe/.test(y.tost2));
      });
      test('C3 editör = PowerPoint metrikleri: iç boşluk 0, punto çeyrek tam, satır aralığı 1,25/1,08, başlık harf aralığı, madde girintisi 1,1 em, yazı tipi', () => {
        const PT = (v) => Math.round((v || 20) * 3) / 4;
        D.forEach((r, i) => PX[i].sl.forEach((s, k) => s.sps.forEach((p, j) => { const e = r.bek[k].yazi[j], pt = PT(e.size), at = r.ad + ' ' + (k + 1) + '/' + j;
          assert.ok(p.ins, at + ' iç boşluk'); assert.equal(p.sz, Math.round(pt * 100), at + ' punto');
          assert.equal(p.ln, Math.round(Math.round(pt * (e.tip === 'h' ? 1.08 : 1.25) * 100)), at + ' satır aralığı');
          if (e.tip === 'h') assert.ok(p.spc < 0, at + ' harf aralığı');
          if (e.tip === 'ul' && !e.kay) { assert.ok(p.bul, at + ' madde işareti'); assert.ok(Math.abs(p.marL - pt * 1.1 * 12700) <= 12700 * 0.02, at + ' girinti ' + p.marL); }
          const izin = r.tema ? [r.tema.hf, r.tema.bf, 'Arial'] : ['Arial']; assert.ok(izin.includes(p.latin), at + ' yazı tipi ' + p.latin); })));
        assert.ok(D.filter((r) => !r.tema).length && D.filter((r) => r.tema).length, 'temalı ve temasız deste');
      });
      test('C4 fotoğraf gerilmez: kendi oranıyla cover kırpma (srcRect), kutu boyu korunur', () => {
        const r = D.find((x) => x.foto), X = PX[D.indexOf(r)];
        r.foto.forEach(([sid, f], i) => { const s = X.sl[1 + i], p = s.pics[s.pics.length - 1], a = {}; p.src.replace(/(\w)="(\d+)"/g, (m, k, v) => { a[k] = +v; return m; });
          const io = f[0] / f[1], bo = f[2] / f[3], kes = io > bo ? (1 - bo / io) / 2 : (1 - io / bo) / 2, yan = io > bo ? ['l', 'r'] : ['t', 'b'];
          if (Math.abs(io - bo) < 1e-6) assert.ok(!a.l && !a.r && !a.t && !a.b, 'aynı oran kırpılmaz: ' + p.src);
          else yan.forEach((k) => assert.ok(Math.abs((a[k] || 0) - kes * 100000) <= 300, 'foto ' + i + ' ' + k + '=' + a[k] + ' beklenen ' + Math.round(kes * 100000)));
          assert.ok(Math.abs(p.xf[2] - f[2] * EMU) <= EMU && Math.abs(p.xf[3] - f[3] * EMU) <= EMU && Math.abs(p.xf[0] - 520 * EMU) <= EMU && Math.abs(p.xf[1] - 150 * EMU) <= EMU, 'kutu korunmadı: foto ' + i + ' ' + p.xf); });
      });
      const y = D.find((r) => r.yasam).yasam;
      test('C5 elle düzenlenen deste: PPTX asetat sayısı = yeni deste (N\'e zorlanmaz)', () => { assert.equal(pptxIncele(y.b64).sl.length, y.sonra); });
    }

    test('D1 ekran genişlikleri 1440/1024/768/390/320: sayaç ve otomatik gündem satırı pencerede, pencerede yatay taşma yok, numaralı satır', () => {
      OLC.forEach((o, i) => { const g = GENISLIK[i], at = g + ' px';
        assert.ok(!o.hata, at + ' ' + o.hata); assert.equal(o.gizli, false, at + ' sayaç görünmeli');
        assert.ok(/^Basılınca 8 sayfa: 7 şerit \+ 1 otomatik gündem · başlığı boş 1 şerit basılmaz · istediğin 8\.$/.test(o.metin), at + ' ' + o.metin);
        /* belge genişliği ölçülmez: düzenek sayfasında dashboard yerleşim CSS'i yok (gövde 8 px kenar boşluğu, editör kesiti); ölçülen şerit penceresidir */
        assert.ok(o.dlgSw <= o.dlgCw + 1, at + ' pencere yatay kayıyor ' + o.dlgSw + '/' + o.dlgCw); assert.ok(!o.tasan.some((t) => /sx-pl|sx-strip|plotdlg/.test(t)), at + ' ' + o.tasan.join(' '));
        [o.sayi, o.oto, o.ilk].forEach((b, k) => { assert.ok(b && b.w > 0, at + ' ölçü ' + k); assert.ok(b.x >= o.dlg.x - 1 && b.x + b.w <= o.dlg.x + o.dlg.w + 1, at + ' pencere dışında ' + k); assert.ok(b.sw <= b.cw + 1, at + ' içerik taşıyor ' + k); });
        assert.ok(o.oto.y >= o.ilk.y + o.ilk.h - 1, at + ' otomatik satır kapaktan sonra'); assert.ok(o.otoKucuk.w > 0 && o.otoKucuk.x + o.otoKucuk.w <= o.oto.x + o.oto.w + 1, at + ' açıklama');
        assert.ok(o.dlg.x >= 0 && o.dlg.x + o.dlg.w <= o.vw, at + ' pencere ekrandan taşıyor');
        assert.equal(o.otoNo, 'counter(sp)'); assert.equal(o.vw, g, at + ' görüntü alanı');
        /* akış kontrolü pencerenin gösterdiği numarayı söyler (CSS sayacı = satır sırası; gündem 2. satır): şerit 2–4 → satır 3–5 */
        const m = /(\d+)–(\d+)\. asetatların hepsi madde listesi/.exec(o.akis); assert.ok(m, at + ' akış ' + o.akis); assert.deepEqual([+m[1], +m[2]], [3, 5], at + ' ' + m[0]);
        assert.equal(o.satir[1], 'oto'); assert.deepEqual(o.satir.slice(+m[1] - 1, +m[2]).map((t) => t === 'oto'), [false, false, false]); });
    });

    test('E1 görünüm önerileri: ölçülür, yalnız info, onarımsız, deste ve içerik durumu değişmez; koyu zeminde soluk yazı bulgusu düşer; yalnız ekrandaki deste', () => {
      const E = R.E; assert.deepEqual(E.once, [], 'temiz deste: ' + E.once.join(' '));
      const kod = E.sonra.map((x) => x[0] + '@' + x[1]);
      assert.ok(kod.includes('LOW_CONTRAST@3') && E.sonra.find((x) => x[0] === 'LOW_CONTRAST' && x[1] === 3)[2] === 'soluk', kod.join(' '));
      assert.ok(kod.includes('HIERARCHY_INVERTED@2'), kod.join(' ')); assert.ok(kod.includes('TITLE_SIZE_DRIFT@4'), kod.join(' '));
      E.sonra.forEach((x) => assert.equal(x[3], 'info')); assert.ok(/:1 < 4.5:1$/.test(E.sonra.find((x) => x[0] === 'LOW_CONTRAST')[4]));
      assert.ok(E.degismedi, 'deste değişti'); assert.equal(E.durum1, E.durum0, 'içerik durumu değişti');
      assert.deepEqual([...new Set(E.liste.map((x) => x[0]))].sort(), ['HIERARCHY_INVERTED', 'LOW_CONTRAST', 'TITLE_SIZE_DRIFT']); E.liste.forEach((x) => { assert.equal(x[1], 'info'); assert.equal(x[2], 'dusuk'); assert.equal(x[3], false); assert.ok(x[4] && x[5] && !/^[A-Z_]+$/.test(x[4])); });
      assert.equal(E.koyu, 0, 'koyu zeminde açık renk yazı karşıtlığı yüksek'); assert.equal(E.digerDeste, 0, 'ekranda olmayan deste ölçülmez');
      D.forEach((r) => { assert.equal(r.icerikDurum === 'not_checked' || r.icerikDurum === 'passed' || r.icerikDurum === 'warning', true, r.ad + ' ' + r.icerikDurum);
        r.listeIcerik.filter((c) => /LOW_CONTRAST|HIERARCHY_INVERTED|TITLE_SIZE_DRIFT/.test(c)).forEach((c) => assert.ok(/:info$/.test(c), c)); });
    });

    test('F1 gerçek saatte süre (en kötü deste, ' + (SURE && SURE.n) + ' asetat): sayım < 2 ms, sayaç < 30 ms, görünüm denetimi < 25 ms; hiçbir dış istek yok', () => {
      assert.ok(SURE && SURE.n >= 10, 'süre ölçülmedi');
      assert.ok(SURE.sayim < 2, 'sayım ' + SURE.sayim); assert.ok(SURE.sayac < 30, 'sayaç ' + SURE.sayac); assert.ok(SURE.gorunum < 25, 'görünüm ' + SURE.gorunum);
      assert.deepEqual(R.ag, []); OLC.forEach((o) => assert.deepEqual(o.ag, []));
      const f = (v) => (v == null ? '—' : v.toFixed(v < 10 ? 2 : 0));
      console.log('        süre (ms, gerçek saat, en kötü): sayım ' + f(SURE.sayim) + ' · sayaç boyama ' + f(SURE.sayac) + ' · basım ' + f(SURE.basim) + ' · görünüm denetimi ' + f(SURE.gorunum) + ' · birleşik liste ' + f(SURE.liste) + ' · teknik QA ' + f(SURE.teknik) + ' · PPTX ' + f(SURE.pptx) + ' · 12 deste sanal koşu duvar saati ' + tDuvar + ' ms');
      console.log('        tablo: ' + D.map((r) => r.ad + ' N' + r.N + '→' + r.n + (r.gundem ? '+g' : '') + (r.sayi.kesilen ? ' −' + r.sayi.kesilen : '') + (r.sayi.eksik ? ' eksik' + r.sayi.eksik : '') + ' [' + r.gor.map((g) => g.split(':')[0]).join(',') + ']').join(' | '));
    });
  })().catch((e) => { test('B–F başsız Chrome koşusu', () => { throw e; }); });
};

tarayici().then(() => summary());
