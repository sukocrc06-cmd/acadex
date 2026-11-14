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
  ';return {TEMALAR,temaKur,temaRenk,temaSty,temaCls,temaCikar,kontrast,IKON,IKON_L,IKON_RE,ikonSec,set:function(t){deck.tema=t;}};';
const M = new Function('arr', src)((x) => (Array.isArray(x) ? x : []));

test('hazır şablonlar: 16 tane, kimlikleri benzersiz, hepsi okunaklı', () => {
  assert.equal(M.TEMALAR.length, 16);
  assert.equal(new Set(M.TEMALAR.map((t) => t.id)).size, 16);
  for (const t of M.TEMALAR) {
    assert.ok(M.kontrast(t.ink, t.bg.clear) >= 4, t.id + ' gövde yazısı zeminde okunmuyor');
    assert.ok(M.kontrast(t.head, t.bg.clear) >= 3, t.id + ' başlık zeminde okunmuyor');
    assert.ok(M.kontrast(t.acc, t.bg.clear) >= 2.2, t.id + ' vurgu rengi zeminde görünmüyor');
    assert.equal(t.tint.length, 4);
    /* renkli kutuların içindeki yazı da gövde rengiyle yazılır */
    for (const c of t.tint) assert.ok(M.kontrast(t.ink, c) >= 3, t.id + ' kutu içi yazı okunmuyor: ' + c);
    assert.match(t.src, /MIT/, t.id + ' kaynağı/lisansı yazmalı');
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

summary();
