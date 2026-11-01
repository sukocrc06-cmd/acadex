/* ==========================================================================
   ACADEX — ÇALIŞMA DEFTERİ+ TESTLERİ (tests/defter-gorsel.js)

   NEDEN VAR (02.11.2026): defterin tasarım kabuğunun üstüne js/acadex-defter-plus.js geldi:
   sayfa çevirme + kapak, kalemlik ve masa, çıkartmalar (bant/damga/post-it), ders sekmeleri,
   kement / şekil düzeltme / cetvel, sayfa başlığı-tarih-ders, sıralama ve arama, şablon
   galerisi, odak modu (pomodoro) ve bütün defteri PDF indirme.
     - VERİ: hepsi sayfanın "elements" dizisine yeni öğe türleri olarak yazılır
       (meta = sayfa bilgisi, deco = çıkartma / şablon çerçevesi). notebooks tablosunda
       şema değişikliği yok; eski sayfalar ve eski motor aynen çalışır.
     - Geri al başlangıcı artık sayfanın kayıtlı verisi: sayfa değişince yeni sayfada
       geri al ESKİ sayfanın çizimini ve notlarını getiriyordu (kaydedilince oraya yazılıyordu).
     - Akıllı şekil el yazısını bozmamalı: harf boyundaki halkalar ve çizgiler düzeltilmez.
     - Hareket azaltma tercihinde sayfa çevirme, kapak ve çıkartma animasyonları yok.
   Çalıştırma:  node tests/defter-gorsel.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();
const html = read('dashboard.html');
const js = read('js/acadex-defter-plus.js');
const css = read('css/acadex-defter-plus.css');
const dash = read('js/dashboard.js');
const slice = (a, b) => { const i = js.indexOf(a), j = js.indexOf(b, i); assert.ok(i > 0 && j > i, a + ' … ' + b); return js.slice(i, j); };

/* şekil tanıyıcı, sayfasız */
const R = new Function(slice('  var dist = function', '  var pathOf = function') + '; return recognize;')();
const jit = (() => { let s = 7; return () => { s = (s * 9301 + 49297) % 233280; return (s / 233280) * 4 - 2; }; })();
const ring = (cx, cy, rx, ry, n) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n * Math.PI * 2; return { x: cx + rx * Math.cos(t) + jit(), y: cy + ry * Math.sin(t) + jit() }; });
const poly = (pts, per) => { const a = []; for (let s = 0; s < pts.length - 1; s++) for (let i = 0; i < per; i++) a.push({ x: pts[s][0] + (pts[s + 1][0] - pts[s][0]) * i / per + jit(), y: pts[s][1] + (pts[s + 1][1] - pts[s][1]) * i / per + jit() }); return a; };

test('sayfaya bağlı: stil ve betik defter kabuğundan sonra, çeviriden önce', () => {
  assert.match(html, /<link rel="stylesheet" href="css\/acadex-ink\.css">\n<link rel="stylesheet" href="css\/acadex-defter-plus\.css">/);
  const at = (f) => html.indexOf('src="js/' + f + '"');
  assert.ok(at('acadex-ink.js') > 0 && at('acadex-ink.js') < at('acadex-defter-plus.js') && at('acadex-defter-plus.js') < at('acadex-i18n.js'));
  assert.match(js, /if \(!root \|\| !root\.classList\.contains\('axn'\)\) return;/);
});

test('veri: şema değişikliği yok; meta ve deco öğeleri yakalanır ve geri çizilir', () => {
  assert.match(js, /arr\.push\(\{ type: 'meta', id: 'meta', content: JSON\.parse\(JSON\.stringify\(state\.meta\)\) \}\)/);
  assert.match(js, /\$\$\('\.dp-deco', o\)\.forEach\(function \(el\) \{ arr\.push\(decoData\(el\)\); \}\)/);
  assert.match(js, /if \(it && it\.type === 'deco'\) addDeco\(it, false\)/);
  assert.match(js, /upsert\(\{ user_id: u\.id, page_number: p\.page_number, canvas_data: p\.canvas_data \|\| null, elements: p\.elements \|\| \[\], updated_at: new Date\(\)\.toISOString\(\) \}, \{ onConflict: 'user_id,page_number' \}\)/);
  assert.match(js, /if \(!p \|\| p\.is_shared\) return false;/, 'paylaşılan sayfa arka planda yazılmaz');
  assert.doesNotMatch(js, /SERVICE_ROLE|service_role/);
  /* eski motor bilinmeyen türü atlar: render dalı ve yakalama dalı yalnızca kendi türlerini işler */
  assert.doesNotMatch(dash, /item\.type === 'deco'|item\.type === 'meta'/);
});

test('geri al başlangıcı sayfanın kendi verisi (eski sayfa yeni sayfaya taşınmaz)', () => {
  assert.match(js, /notebookUndoStack = \[\{ canvasDataURL: p\.canvas_data \|\| null, elements: \(p\.elements \|\| \[\]\)\.slice\(\) \}\];/);
  assert.match(js, /W\.resetNotebookHistory = resetNotebookHistory;/);
  /* motorda hâlâ "önce geçmiş, sonra çiz" sırası var: düzeltme bu sıraya bağlı */
  assert.match(dash, /resetNotebookHistory\(\);\n  renderCurrentPageData\(\);/);
});

test('akıllı şekil: daire, elips, çizgi, ok, dikdörtgen, üçgen tanınır', () => {
  const c = R(ring(300, 300, 80, 76, 44)); assert.equal(c.t, 'ellipse'); assert.ok(c.circle);
  assert.equal(R(ring(300, 300, 140, 60, 44)).t, 'ellipse');
  assert.equal(R(Array.from({ length: 31 }, (_, i) => ({ x: 100 + i * 10 + jit(), y: 300 + i * 3 + jit() }))).t, 'line');
  const ar = Array.from({ length: 31 }, (_, i) => ({ x: 100 + i * 10 + jit(), y: 300 + jit() })).concat([{ x: 385, y: 285 }, { x: 400, y: 300 }, { x: 385, y: 315 }]);
  assert.equal(R(ar).t, 'arrow');
  assert.equal(R(poly([[100, 100], [300, 100], [300, 250], [100, 250], [100, 102]], 15)).t, 'rect');
  const tr = R(poly([[100, 250], [200, 100], [300, 250], [100, 248]], 15)); assert.equal(tr.t, 'poly'); assert.equal(tr.pts.length, 3);
});

test('akıllı şekil el yazısını bozmaz: küçük halka, kısa çizgi, dalga, yazı düzeltilmez', () => {
  assert.equal(R(ring(200, 200, 12, 14, 24)), null, 'harf boyunda "o"');
  assert.equal(R(Array.from({ length: 12 }, (_, i) => ({ x: 100 + i * 4, y: 200 }))), null, 'kısa çizgi');
  assert.equal(R(Array.from({ length: 40 }, (_, i) => ({ x: 100 + i * 8, y: 300 + Math.sin(i / 3) * 40 }))), null, 'dalga');
  assert.equal(R(Array.from({ length: 30 }, (_, i) => ({ x: 100 + i * 6, y: 300 + (i % 6 < 3 ? i % 6 : 6 - i % 6) * 9 }))), null, 'zikzak el yazısı');
  /* düzeltme tek adımda geri alınır, ham çizgi geçmişte kalmaz */
  assert.match(js, /if \(notebookUndoStack\.length > s\.n\) notebookUndoStack\.pop\(\);/);
  assert.match(js, /store\.set\('shapeFix', fixOn \? '1' : '0'\)/, 'açılıp kapatılabilir ve hatırlanır');
  assert.match(js, /if \(e\.pointerType === 'touch' && store\.get\('penOnly'\) === '1'\) return;/, 'kaydıran parmak çizgi sayılmaz');
});

test('sayfa çevirme ve kapak; hareket azaltmada animasyon yok', () => {
  assert.match(js, /navigateNotebookPage = function \(dir\)/); assert.match(js, /W\.navigateNotebookPage = navigateNotebookPage;/);
  assert.match(js, /var makeSheet = function \(\) \{\n    if \(RM\) return null;/);
  assert.match(css, /@keyframes dp-flipup\{0%\{transform:rotateX\(0\)\}100%\{transform:rotateX\(-172deg\)/);
  assert.match(css, /@keyframes dp-flipdown\{0%\{rotate:x -150deg/, 'sayfanın transform:none!important kuralına takılmaz');
  assert.match(css, /\.nbook\.dp-flipping \.spiral\{animation:dp-sway/);
  assert.match(js, /var maybeCover = function \(\) \{ if \(!sget\('coverSeen'\) && root\.classList\.contains\('active'\)\) showCover\(\); \};/, 'kapak oturumda bir kez');
  assert.match(js, /setPageMeta\(pages\(\)\[0\], \{ cover: d \}, true\)/, 'kapak buluta da yazılır');
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{#notebook-view\.axn \.dp-deco,#notebook-view\.axn \.dp-sheet,#notebook-view\.axn \.dp-cover \*/);
});

test('çıkartmalar: bant, damga, post-it; sürüklenir, silinir, post-it yazılır', () => {
  for (const k of ['kraft', 'nokta', 'cizgi', 'kare', 'mint', 'lila']) assert.match(js, new RegExp(k + ": '#[0-9A-F]{6}'"));
  for (const k of ['yildiz', 'onemli', 'sinav', 'tekrar', 'tamam', 'calistin']) assert.match(js, new RegExp('\\b' + k + ': \\{ t:'));
  assert.match(js, /makeElementDraggable\(el\)/); assert.match(js, /onclick="removeOverlayElement\(\\''/);
  assert.match(js, /pt\.contentEditable = 'true'/);
  assert.match(js, /if \(e\.detail === 0\) \{ var s = freeSpot\(\); makeDeco\(k, v, s\.x, s\.y\); return; \}/, 'klavyeyle de eklenir');
  assert.match(css, /@keyframes dp-stick\{/); assert.match(css, /@keyframes dp-unroll\{/);
});

test('kement ve cetvel: kalem olayları motordan önce yakalanır; kayıttan önce seçim yapıştırılır', () => {
  assert.match(js, /vp\(\)\.addEventListener\('pointerdown', function \(e\) \{[\s\S]{0,1600}\}, true\);/);
  assert.match(js, /var stop = function \(e\) \{ e\.preventDefault\(\); e\.stopPropagation\(\);/);
  assert.match(js, /var plusSave = async function \(\) \{ commitSel\(\); return origSave\.apply\(this, arguments\); \};/);
  assert.match(js, /if \(saveB\) saveB\.addEventListener\('pointerdown', commitSel, true\);/);
  assert.match(js, /\(e\.ctrlKey \|\| e\.metaKey\) && \(k === 'z' \|\| k === 'y'\)\) \{ e\.preventDefault\(\); e\.stopImmediatePropagation\(\); cancelSel\(\);/);
  assert.match(js, /rEl\.setAttribute\('role', 'slider'\)/); assert.match(js, /k === 'ArrowLeft' \|\| k === 'ArrowRight'/, 'cetvel klavyeyle döner');
});

test('sayfa bilgisi, ders bölümleri, sıralama ve arama', () => {
  for (const k of ['title', 'course', 'date']) assert.match(js, new RegExp('data-m="' + k + '"'));
  assert.match(js, /var keyOf = function \(p\) \{ var o = metaOf\(p\)\.ord;/);
  assert.match(js, /setPageMeta\(p, \{ ord: i \}, true\)/, 'sıra buluta yazılır, sayfa "kaydedilmedi"ye düşmez');
  assert.match(js, /openNotebookPagesOverview = openOverview;/);
  const norm = new Function('return ' + slice('var norm = function', ';\n').replace('var norm = ', ''))();
  assert.equal(norm('İKTİSAT Işık'), norm('iktisat isik'), 'Türkçe büyük/küçük harf ve noktasız ı');
  assert.match(js, /ovGrid\.addEventListener\('keydown'/, 'sıralama klavyeyle de yapılır');
});

test('şablon galerisi: 9 şablon (5 yeni), başlangıç öğeleri eski motorun türleri', () => {
  const gal = [...js.matchAll(/\{ k: '(\w+)', n: '/g)].map((m) => m[1]);
  assert.deepEqual(gal, ['blank', 'cornell', 'mindmap', 'swot', 'timeline', 'karsilastirma', 'formul', 'haftalik', 'kavram']);
  const ctx = new Function('var uid = function (p) { return p + "-x"; };' + slice('  var TPL = {', '  var tplSvg = function') + slice('  var T_ = function', '  var PAPER = {') + 'return STARTERS;')();
  for (const k of ['timeline', 'karsilastirma', 'formul', 'haftalik', 'kavram']) {
    const els = ctx[k](1);
    assert.ok(els.length >= 3, k);
    for (const e of els) {
      assert.ok(['text', 'table', 'deco'].includes(e.type), k + ' türü ' + e.type);
      assert.ok(e.left >= 0 && e.top >= 0 && e.left + (e.width || 0) <= 740, k + ' sayfaya sığar');
      if (e.type === 'table') assert.equal(e.content.cells.length, +e.content.rows * +e.content.cols, k + ' tablo hücreleri');
    }
  }
  assert.match(js, /openTemplatePickerModal = openGallery;/);
  assert.match(dash, /type === 'circle' \|\| type === 'ellipse'/, 'zihin haritası balonları görünür');
  assert.match(dash, /\(trT \? 'Alt konu 4' : 'Sub-topic 4'\)/);
});

test('odak modu: pomodoro, "bugün çalıştın" damgası, tam ekran yoksa sabit katman', () => {
  assert.match(js, /addMin\(pomo\.work\); stampToday\(pomo\.work\);/);
  assert.match(js, /makeDeco\('stamp', 'calistin'/);
  assert.match(js, /nb\.requestFullscreen\(\)\.catch\(fail\)/);
  assert.match(js, /pomo\.end - Date\.now\(\) <= 0/, 'süre saatten hesaplanır, sekme uyurken kaymaz');
  assert.match(css, /\.nb\.dp-focus-fixed\{position:fixed;inset:0;z-index:9000/);
});

test('PDF: ekranı değiştirmeden sayfaları çizer, kapak ekler, bir dersi ayrı verir', () => {
  assert.match(js, /W\.loadScript\('https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/jspdf\/2\.5\.1\/jspdf\.umd\.min\.js'\)/);
  const rp = slice('var renderPage = async function', 'var renderCover');
  assert.doesNotMatch(rp, /currentNotebookPageNumber\s*=|renderCurrentPageData\(/, 'sayfa çizimi açık sayfayı değiştirmez');
  assert.match(js, /if \(withCover\)/); assert.match(js, /!course \|\| courseOf\(p\)\.toLocaleLowerCase\('tr'\) === course\.toLocaleLowerCase\('tr'\)/);
  assert.match(js, /if \(b\.getAttribute\('data-dl'\) === 'png'\) \{ closeDl\(\); commitSel\(\); if \(typeof downloadNotebook === 'function'\) downloadNotebook\(\);/, 'eski "sayfayı indir" duruyor');
});

test('İngilizce arayüz: yeni yazılar sözlükte', () => {
  const d = read('js/i18n-en.js');
  for (const k of ['kement', 'cetvel', 'çıkartma', 'tüm sayfalar', 'yeni sayfa · şablon seç', 'odaktan çık', 'PDF oluştur', 'defteri aç', 'zaman çizelgesi']) assert.match(d, new RegExp('\\n"' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '": "'), k);
});

summary();
