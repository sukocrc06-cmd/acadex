/* ==========================================================================
   ACADEX — SUNUM ŞABLON TESTLERİ (tests/sunum-sablon.js)

   NEDEN VAR (14.11.2026): sunumlar hep aynı lacivert-beyaz görünümdeydi.
   Şablon (tema) sistemi eklendi: 16 hazır şablon (reveal.js ve Marp, MIT),
   kullanıcının kendi .pptx dosyasından renk/yazı tipi çıkarma ve 162 Lucide
   simgesi (ISC). Buradaki kurallar o sistemin bozulmaması gereken yanları:
     - Şablon öğeleri DEĞİŞTİRMEZ, yalnız çizim anında renk eşler; "Acadex"e
       dönünce her şey eskisi gibi olmalı (temaRenk şablonsuzken dokunmaz).
     - Şablon nesnesi style özniteliğine yazılır ve paylaşım sayfasında
       başkasının tarayıcısında çizilir; temaKur her alanı süzmek zorunda.
     - Okunmayan şablon çıkmamalı: yazı/zemin kontrastı düşükse düzeltilir.
     - Canva / Google Slides çıktılarında tema dosyası varsayılan kalır, asıl
       renkler asetatlardadır; temaCikar ikisini birlikte sayar.

   Çalıştırma:  node tests/sunum-sablon.js
   ========================================================================== */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const ink = read('js/acadex-ink.js');
const { test, summary } = makeRunner();

/* Modül bir IIFE; şablon motoru saf fonksiyonlardan oluştuğu için ilgili
   dilimler kesilip küçük bir kapsamda çalıştırılır. */
const dilim = (bas, son) => { const a = ink.indexOf(bas), b = ink.indexOf(son, a); assert.ok(a > 0 && b > a, 'dilim bulunamadı: ' + bas); return ink.slice(a, b); };
const src = "var NAVY='#0D1838',BLUE='#2F6BFF',SOFT='#6A7593',TINT=['#DCE6FF','#D9EFE3','#F6E7C4','#F4DDDA'],deck={tema:null};" +
  dilim('  var rgb3 = ', '  var fontYuklu = ') + dilim('  var temaCikar = ', '  var zipLib = ') + dilim('  var IKON = {', '  var ikonSec = ') + dilim('  var ikonSec = ', '\n') +
  ';return {TEMALAR,temaKur,temaRenk,temaSty,temaCls,temaDekor,temaAlt,kutuCizgi,temaCikar,kontrast,IKON,IKON_L,IKON_RE,ikonSec,set:function(t){deck.tema=t;},deste:function(d){Object.assign(deck,d);}};';
const M = new Function('arr', src)((x) => (Array.isArray(x) ? x : []));

test('hazır şablonlar: 18 tane, kimlikleri benzersiz, hepsi okunaklı', () => {
  assert.equal(M.TEMALAR.length, 18);
  assert.equal(new Set(M.TEMALAR.map((t) => t.id)).size, 18);
  for (const t of M.TEMALAR) {
    assert.ok(M.kontrast(t.ink, t.bg.clear) >= 4, t.id + ' gövde yazısı zeminde okunmuyor');
    assert.ok(M.kontrast(t.head, t.bg.clear) >= 3, t.id + ' başlık zeminde okunmuyor');
    assert.ok(M.kontrast(t.acc, t.bg.clear) >= 2.2, t.id + ' vurgu rengi zeminde görünmüyor');
    assert.equal(t.tint.length, 4);
    /* renkli kutuların içindeki yazı da gövde rengiyle yazılır */
    for (const c of t.tint) assert.ok(M.kontrast(t.ink, c) >= 3, t.id + ' kutu içi yazı okunmuyor: ' + c);
    /* ax-*: Acadex'in kendi şablonu; dışarıdan alınan her şablon lisansını yazar */
    assert.match(t.src, t.id.indexOf('ax-') === 0 ? /özgün/ : /MIT/, t.id + ' kaynağı/lisansı yazmalı');
  }
});

test('şablon yokken temaRenk hiçbir rengi değiştirmez (Acadex görünümü aynı kalır)', () => {
  M.set(null);
  for (const c of ['#0D1838', '#2F6BFF', '#DCE6FF', '#FFFFFF', '#2F6BFF33']) assert.equal(M.temaRenk(c, 'h'), c);
  assert.equal(M.temaSty({ bg: 'clear' }), '');
  assert.equal(M.temaCls({ bg: 'blue' }), 'sx-slide bg-blue');
});

test('şablon varken temel palet eşlenir, yabancı renk ve beyaz yazı korunur', () => {
  const T = M.TEMALAR.find((t) => t.id === 'rv-dracula'); M.set(T);
  assert.equal(M.temaRenk('#0D1838', 'h'), T.head);
  assert.equal(M.temaRenk('#0D1838', 't'), T.ink);
  assert.equal(M.temaRenk('#2F6BFF'), T.acc);
  assert.equal(M.temaRenk('#2F6BFF33'), T.acc + '33', 'saydamlık eki korunmalı');
  assert.equal(M.temaRenk('#D9EFE3'), T.tint[1]);
  assert.equal(M.temaRenk('#FFFFFF'), '#FFFFFF');
  assert.equal(M.temaRenk('#123456'), '#123456', 'kullanıcının elle seçtiği renk değişmemeli');
  /* koyu şablonda tablo/çizim yazıları "gece" kurallarını kullanır */
  assert.equal(M.temaCls({ bg: 'clear' }), 'sx-slide bg-clear bg-navy');
  assert.match(M.temaSty({ bg: 'clear' }), /^background:#282A36;color:#F8F8F2/);
  M.set(null);
});

test('temaKur: style özniteliğine sızabilecek her şeyi süzer', () => {
  const T = M.temaKur({ id: 'x"><script>', ad: 'A', bg: 'red;background:url(//k.com)', ink: '#12345G', acc: '"onload=', accs: ['javascript:1', '#abc'], hf: 'Lato";}body{display:none', bf: "X',url(//k)" });
  M.set(T);
  const hepsi = [T.bg.clear, T.bg.blue, T.bg.navy, T.ink, T.head, T.acc, T.soft].concat(T.tint);
  for (const c of hepsi) assert.match(c, /^#[0-9A-F]{6}$/);
  assert.match(T.hf, /^[A-Za-z0-9 \-]*$/); assert.match(T.bf, /^[A-Za-z0-9 \-]*$/);
  assert.match(T.id, /^[\w\-]*$/);
  /* paylaşım sayfasının (izle.html) kabul ettiği kalıpla aynı */
  assert.match(M.temaSty({ bg: 'clear' }), /^[#A-Za-z0-9 ,:;'\-]{0,220}$/);
  assert.equal(M.temaKur(null), null); assert.equal(M.temaKur('x'), null);
  M.set(null);
});

test('temaKur: okunmayan birleşimi düzeltir (açık zeminde açık yazı, sarı vurgu)', () => {
  const T = M.temaKur({ bg: '#FFFFFF', ink: '#EEEEEE', head: '#FAFAFA', acc: '#FFFF66', accs: ['#1155CC'] });
  assert.ok(M.kontrast(T.ink, '#FFFFFF') >= 4);
  assert.equal(T.head, T.ink);
  assert.equal(T.acc, '#1155CC', 'zeminde görünmeyen vurgu atlanıp sıradaki seçilmeli');
  /* kaydedilen tanım yeniden kurulunca aynı şablon çıkmalı (bulut gidiş-dönüşü) */
  assert.deepEqual(M.temaKur(T.def), T);
});

/* BİÇİM (14.11.2026): "şablonlar çalışıyor ama desenler hâlâ aynı" — şablon
   yalnız renk değiştiriyordu, her deste aynı kutularla çıkıyordu. Şablon artık
   zemin deseni + kutu biçimi + köşe yarıçapı da taşır; renk gibi yalnız çizimde
   uygulanır. */
test('biçim: her hazır şablonun yapısı var, en az 6 ayrı desen kullanılıyor', () => {
  const dz = new Set(M.TEMALAR.map((t) => t.bic.dz));
  assert.ok(dz.size >= 6, 'şablonlar birbirinden yapıca ayrışmalı: ' + [...dz]);
  assert.ok(M.TEMALAR.some((t) => t.bic.kutu === 'cizgi') && M.TEMALAR.some((t) => t.bic.kutu === 'dolu'));
  /* biçim alanı olmadan kaydedilmiş eski deste de hazır şablonun biçimini alır */
  const T = M.TEMALAR.find((t) => t.id === 'mp-uncover-k'), eski = Object.assign({}, T.def); delete eski.bic;
  assert.deepEqual(M.temaKur(eski).bic, T.bic);
  /* kendi dosyasından gelen şablon: biçim kimlikten türetilir, hep aynı çıkar */
  assert.deepEqual(M.temaKur({ id: 'u-abc123', bg: '#FFFFFF' }).bic, M.temaKur({ id: 'u-abc123', bg: '#FFFFFF' }).bic);
  assert.deepEqual(M.temaKur({ id: 'x', bic: { dz: '"><img>', kutu: 'x', r: 9999 } }).bic, { dz: 'yok', kutu: 'dolu', r: 28 });
});

test('biçim: desen kenar boşluğunda kalır, öğelere yazılmaz, şablonsuzken yoktur', () => {
  M.set(null); assert.deepEqual(M.temaDekor({ bg: 'clear' }), []);
  for (const T of M.TEMALAR) {
    M.set(T); const s = { bg: 'clear', els: [] }, d = M.temaDekor(s);
    assert.equal(s.els.length, 0, 'desen asetatın öğelerine eklenmemeli');
    assert.ok(T.bic.dz === 'yok' ? d.length === 0 : d.length > 0, T.id);
    for (const e of d) {
      assert.ok(e.dz && (e.type === 'rect' || e.type === 'ellipse')); assert.match(e.fill, /^#[0-9A-F]{6}$/);
      /* dolu (vurgu rengi) desen içerik alanına (70–890 × 46–510) giremez; soluk daireler girebilir */
      if (e.fill === T.acc) assert.ok(e.x + e.w <= 70 || e.x >= 890 || e.y + e.h <= 46 || e.y >= 510, T.id + ' deseni içeriğin üstüne biniyor');
    }
  }
  M.set(null);
});

test('biçim: çizgili kutu yalnız büyük renkli kutulara uygulanır', () => {
  M.set(M.TEMALAR.find((t) => t.bic.kutu === 'cizgi'));
  assert.match(M.kutuCizgi({ type: 'rect', fill: '#DCE6FF', w: 260, h: 280 }), /^#[0-9A-F]{6}$/);
  assert.equal(M.kutuCizgi({ type: 'rect', fill: '#DCE6FF', w: 8, h: 100 }), '', 'ince bant dolu kalır');
  assert.equal(M.kutuCizgi({ type: 'rect', fill: '#2F6BFF', w: 260, h: 280 }), '', 'vurgu renkli kutu dolu kalır');
  assert.equal(M.kutuCizgi({ type: 'rect', fill: '#DCE6FF', w: 260, h: 280, dz: 1 }), '');
  M.set(M.TEMALAR.find((t) => t.bic.kutu === 'dolu'));
  assert.equal(M.kutuCizgi({ type: 'rect', fill: '#DCE6FF', w: 260, h: 280 }), '');
  M.set(null);
  /* desen ekranda, paylaşımda ve PPTX'te aynı listeden basılır */
  assert.ok(ink.split('temaDekor(s)').length - 1 >= 4, 'slideHTML, sahne, snapOf ve exportPptx deseni basmalı');
});

test('PowerPoint yazı tipleri açık karşılıklarına çevrilir', () => {
  const T = M.temaKur({ bg: '#FFFFFF', ink: '#000000', acc: '#0055AA', hf: 'Calibri Light', bf: 'Times New Roman' });
  assert.equal(T.hf, 'Carlito'); assert.equal(T.bf, 'Tinos');
});

const THEME = '<a:theme name="Kurum"><a:clrScheme name="K"><a:dk1><a:sysClr val="windowText" lastClr="111111"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F3864"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2><a:accent1><a:srgbClr val="C00000"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2><a:accent3><a:srgbClr val="70AD47"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4><a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="7030A0"/></a:accent6></a:clrScheme><a:fontScheme><a:majorFont><a:latin typeface="Montserrat"/></a:majorFont><a:minorFont><a:latin typeface="Open Sans"/></a:minorFont></a:fontScheme></a:theme>';
const MASTER = '<p:sldMaster><p:cSld><p:bg><p:bgPr><a:solidFill><a:schemeClr val="bg1"/></a:solidFill></p:bgPr></p:bg></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2"/><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr><a:solidFill><a:schemeClr val="tx2"/></a:solidFill></a:defRPr></a:lvl1pPr></p:titleStyle></p:txStyles></p:sldMaster>';

test('temaCikar: klasik PowerPoint şablonu — tema dosyasından okur', () => {
  const d = M.temaCikar(THEME, MASTER, [], 'Kurum Şablonu.potx');
  assert.equal(d.ad, 'Kurum Şablonu');
  assert.equal(d.bg, '#FFFFFF'); assert.equal(d.ink, '#111111');
  assert.equal(d.head, '#1F3864', 'başlık rengi ana asetatın başlık stilinden (tx2 → dk2)');
  assert.equal(d.acc, '#C00000'); assert.equal(d.hf, 'Montserrat'); assert.equal(d.bf, 'Open Sans');
  assert.match(d.id, /^u-[0-9a-z]+$/);
  assert.ok(M.temaKur(d));
});

test('temaCikar: Canva/Google Slides çıktısı — renk ve yazı tipi asetatlardan sayılır', () => {
  const run = (t, sz, renk, f) => '<a:r><a:rPr lang="tr" sz="' + sz + '"><a:solidFill><a:srgbClr val="' + renk + '"/></a:solidFill><a:latin typeface="' + f + '"/></a:rPr><a:t>' + t + '</a:t></a:r>';
  const slide = '<p:sld><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="10203A"/></a:solidFill></p:bgPr></p:bg><p:sp><p:spPr><a:solidFill><a:srgbClr val="FF6B35"/></a:solidFill></p:spPr></p:sp>' +
    run('Büyük Başlık', 6000, 'FFFFFF', 'Playfair Display') + run('Gövde metni burada epey uzun bir cümle olarak durur ve en çok yeri kaplar.', 1800, 'F2F2F2', 'Poppins Medium') + '</p:cSld></p:sld>';
  const d = M.temaCikar(THEME, MASTER, [slide, slide, slide], 'canva.pptx');
  assert.equal(d.bg, '#10203A', 'asetatların çoğu açıkça zemin veriyorsa tema zemini ezilir');
  assert.equal(d.ink, '#F2F2F2');
  assert.equal(d.bf, 'Poppins', 'ağırlık eki (Medium) addan atılır');
  assert.equal(d.hf, 'Playfair Display');
  assert.equal(d.acc, '#FF6B35');
  assert.equal(M.temaKur(d).dark, true);
});

test('temaCikar: boş ya da bozuk girdiyle çökmez, kullanılabilir şablon verir', () => {
  const T = M.temaKur(M.temaCikar('', '', ['<bozuk'], ''));
  assert.ok(T && M.kontrast(T.ink, T.bg.clear) >= 4);
  assert.equal(T.ad, 'Şablonum');
});

test('simgeler: Lucide seti yüklü, yollar öznitelik içine güvenle yazılır', () => {
  assert.ok(Object.keys(M.IKON_L).length >= 150);
  assert.ok(Object.keys(M.IKON).length >= 170, 'kendi 16 simgemiz + Lucide');
  for (const k of Object.keys(M.IKON)) { assert.match(k, /^[a-z0-9\-]+$/); assert.match(M.IKON[k], /^[MmLlHhVvCcSsQqTtAaZz0-9 .,\-e]+$/, k + ' yolunda beklenmeyen karakter'); }
  /* kendi çizimlerimiz Lucide tarafından ezilmez */
  assert.equal(M.IKON.check, 'M12 3 A9 9 0 1 0 12 21 A9 9 0 1 0 12 3 M8 12 L11 15 L16 9');
  for (const r of M.IKON_RE) assert.ok(M.IKON[r[0]], 'IKON_RE olmayan simgeyi gösteriyor: ' + r[0]);
});

test('ikonSec: konuya göre simge — sağlık, hukuk, yapay zekâ, eğitim', () => {
  assert.equal(M.ikonSec('Sağlık harcamaları arttı', 0), 'heart-pulse');
  assert.equal(M.ikonSec('Anayasa Mahkemesi kararı', 0), 'gavel');
  assert.equal(M.ikonSec('Yapay zekâ modelleri', 0), 'bot');
  assert.equal(M.ikonSec('Üniversite öğrencileri', 0), 'graduation-cap');
  assert.equal(M.ikonSec('Enflasyon yükseldi', 0), 'trend');
});

test('kaynak bağları: çizim, PPTX, bulut kaydı ve paylaşım şablonu taşır', () => {
  assert.match(ink, /color:' \+ temaRenk\(e\.color, e\.type\)/, 'elHTML rengi şablondan geçirmeli');
  assert.match(ink, /rows\[0\]\.content\.tema = d\.tema\.def/, 'şablon ilk asetatın content alanına yazılır');
  assert.match(ink, /d\.tema = c0 && c0\.tema \? temaKur\(c0\.tema\) : null/, 'buluttan gelen şablon temaKur ile süzülmeli');
  assert.match(ink, /st: temaSty\(s\)/, 'paylaşım görüntüsü şablon stilini taşımalı');
  assert.match(ink, /e\.type === 'viz' \|\| e\.type === 'mmd' \|\| e\.type === 'icon'/, 'simgeler PPTX\'e görsel olarak çıkar');
  const izle = read('izle.html');
  assert.match(izle, /\^\[#A-Za-z0-9 ,:;'\\-\]\{0,220\}\$/, 'izle.html şablon stilini dar kalıpla doğrulamalı');
  const html = read('dashboard.html');
  for (const a of ['data-temalar', 'data-temapptx', 'data-temabilgi', 'data-ikonlar', 'data-add="icon"']) assert.ok(html.includes(a), 'dashboard.html eksik: ' + a);
  const lis = read('THIRD-PARTY-LICENSES.md');
  for (const a of ['Lucide', 'ISC License', 'Hakim El Hattab', 'Marp team']) assert.ok(lis.includes(a), 'lisans metni eksik: ' + a);
});

/* Hazır taslaklardan alınan iki zemin iskeleti: pano ve halka (14.11.2026). */
test('BİÇİM: pano ve halka desenleri çizilir, içerik alanını örtmez', () => {
  const T = M.temaKur({ id: 'x', bg: '#FFFFFF', acc: '#2F6BFF', bic: { dz: 'pano', kutu: 'dolu', r: 8 } });
  M.set(T); const p = M.temaDekor({ bg: 'clear' });
  assert.equal(p.length, 2); assert.equal(p[1].fill.toUpperCase(), T.bg.clear.toUpperCase(), 'pano asetat zemini renginde olmalı (yazı kontrastı değişmesin)');
  assert.ok(p[1].x <= 70 && p[1].x + p[1].w >= 890 && p[1].y <= 46 && p[1].y + p[1].h >= 510, 'içerik panonun içinde kalmalı');
  M.set(M.temaKur({ id: 'x', bg: '#FFFFFF', acc: '#2F6BFF', bic: { dz: 'halka', kutu: 'cizgi', r: 8 } }));
  const h = M.temaDekor({ bg: 'clear' }); assert.ok(h.length >= 3 && h.every((e) => e.type === 'ellipse' && e.dz === 1));
  assert.equal(M.temaKur({ id: 'mp-default', bg: '#FFFFFF' }).bic.dz, 'pano'); assert.equal(M.temaKur({ id: 'rv-moon', bg: '#002B36' }).bic.dz, 'halka');
  M.set(null);
});

/* PROFESYONEL GÖRÜNÜM (14.11.2026). Canlı deste "İradeyi Güçlendirme Nasıl
   Başlar?" tema:null ile basılmıştı: zemin deseni, yazı tipi, alt bilgi yoktu.
   Hazır PowerPoint taslaklarından alınan üç kalıp: (1) iki tonlu çerçeve + pano,
   (2) köşelerde pastel daire/halka/nokta, (3) her içerik asetatında deste adı +
   sayfa numarası. Yalnız yerleşim alındı; görsel alınmadı. */
test('profesyonel görünüm: iki özgün şablon, alt bilgi ve varsayılan şablon', () => {
  const P = M.TEMALAR.find((t) => t.id === 'ax-pastel'), F = M.TEMALAR.find((t) => t.id === 'ax-memfis');
  assert.equal(P.bic.dz, 'gecis'); assert.equal(F.bic.dz, 'memfis');
  M.set(P); const g = M.temaDekor({ bg: 'clear' });
  assert.ok(new Set(g.slice(0, 6).map((e) => e.fill)).size >= 4, 'çerçeve kademeli geçmeli');
  const pano = g[g.length - 1]; assert.equal(pano.fill, P.bg.clear); assert.ok(pano.x <= 70 && pano.x + pano.w >= 890 && pano.y <= 46 && pano.y + pano.h >= 510, 'içerik panonun içinde kalmalı');
  M.set(F); assert.ok(new Set(M.temaDekor({ bg: 'clear' }).map((e) => e.fill)).size >= 4, 'memfis en az üç renk + zemin kullanır');
  /* alt bilgi: kapakta ve kapanışta yok, içerikte deste adı + sayfa numarası */
  const kapak = { lay: 'cover', els: [] }, ic = { lay: 'list', els: [{ y: 206, h: 290 }] }, dolu = { lay: 'refs', els: [{ x: 70, w: 820, y: 146, h: 370 }] }, son = { lay: 'end', els: [] };
  M.deste({ title: 'İradeyi güçlendirme', lang: 'tr', slides: [kapak, ic, dolu, son] });
  assert.deepEqual(M.temaAlt(kapak), []); assert.deepEqual(M.temaAlt(son), []);
  const a = M.temaAlt(ic); assert.equal(a.length, 2); assert.equal(a[0].text, 'İRADEYİ GÜÇLENDİRME'); assert.equal(a[1].text, '2');
  for (const e of a) { assert.equal(e.type, 't'); assert.ok(e.dz && e.y >= 504 && e.y + e.h <= 520 && e.x >= 70 && e.x + e.w <= 890); }
  /* 25.11.2026: öğe alt satıra inince yalnız deste adı düşer; numara plakayla kalır
     ("History of Guns" destesinde 12 içerik asetatının 5'i numarasızdı). */
  const d = M.temaAlt(dolu);
  assert.ok(!d.some((e) => e.text === 'İRADEYİ GÜÇLENDİRME'), 'alt satıra inen öğenin üstüne deste adı basılıyor');
  assert.equal(d[d.length - 1].text, '3', 'sayfa numarası düştü');
  assert.ok(d.some((e) => e.type === 'rect' && e.dz && e.x <= 850 && e.x + e.w >= 890), 'numaranın altında zemin plakası yok');
  const yan = { lay: 'list', els: [{ x: 70, w: 400, y: 300, h: 230 }] }; M.deste({ title: 'İradeyi güçlendirme', lang: 'tr', slides: [kapak, ic, yan, son] });
  const y2 = M.temaAlt(yan); assert.deepEqual(y2.map((e) => e.type + ':' + (e.text || '')), ['t:3'], 'sol yarıya inen öğe: deste adı düşer, numara plakasız kalır');
  M.deste({ title: 'İradeyi güçlendirme', lang: 'tr', slides: [kapak, ic, dolu, son] });
  assert.match(ink, /temaDekor\(s\)\.concat\(s\.els, temaAlt\(s\)\)\.map\(function \(e\) \{ return elHTML\(e, false\); \}\)\.join\(''\) \+ '<\/div>'; \};/, 'alt bilgi öğelerin altına çiziliyor (slideHTML)');
  assert.match(ink, /var pels = temaDekor\(s\)\.concat\(s\.els, temaAlt\(s\)\);/, 'alt bilgi öğelerin altına çiziliyor (PPTX)');
  assert.match(ink, /s\.els\.map\(function \(e\) \{ return elHTML\(e, true\); \}\)\.join\(''\) \+ temaAlt\(s\)\.map/, 'alt bilgi öğelerin altına çiziliyor (sahne)');
  assert.equal(ic.els.length, 1, 'alt bilgi öğelere yazılmaz');
  M.set(null); assert.deepEqual(M.temaAlt(ic), [], 'şablonsuzken alt bilgi yok');
  /* dört çizim yolu da alt bilgiyi basar */
  assert.ok(ink.split('temaAlt(s)').length - 1 >= 4, 'alt bilgi ekran/küçük resim/PPTX/paylaşımda aynı olmalı');
  /* üretilen deste şablonsuz kalmaz; "Şablonsuz" seçimi ezilmez */
  assert.match(ink, /mode !== 'append' && !deck\.tema && !deck\.temaEl/);
  assert.match(ink, /var temaSec = function \(T\) \{ deck\.temaEl = 1;/);
  const V = /var VARSAYILAN_TEMA = \[([^\]]+)\]/.exec(ink)[1].split(',').map((x) => x.trim().replace(/'/g, ''));
  assert.ok(V.length >= 4 && V.includes('ax-pastel') && V.includes('ax-memfis'));
  for (const id of V) { const t = M.TEMALAR.find((x) => x.id === id); assert.ok(t && !t.dark, id + ' varsayılan şablon açık zeminli olmalı'); }
});

summary();
