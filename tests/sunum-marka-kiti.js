/* ==========================================================================
   ACADEX — SUNUM MARKA KİTİ (tests/sunum-marka-kiti.js)

   NEDEN VAR (28.11.2026, #58 Phase 12.1):
   - Marka kiti = ad/marka/açıklama + 9 HEX renk rolü + başlık/gövde (+isteğe bağlı vurgu) yazı tipi + 4 logo. Kullanıcı başına
     en çok 10 kit, tek varsayılan; içerik değişince sürüm artar. Yazı tipleri yalnız PowerPoint/sistem adları (FONT_ES).
   - Logo türü uzantıdan değil baytlardan anlaşılır; etkin içerikli SVG (betik, olay, dış bağlantı, varlık) reddedilir;
     her logo PNG'ye çizilerek saklanır (≤480 px, ≤350 KB). Boş / >2 MB / tanınmayan / aşırı oranlı dosya anlaşılır hatayla döner.
   - Uygulama: önce otomatik sürüm, tek geri al adımı; düzen (öğe geometrisi) değişmez; "tüm uygun asetatlar" kapsamında logo
     yalnız sağ üstte boş yer varsa eklenir, çakışan asetat listelenir; yeniden uygulamada logo çoğalmaz; hata → bütün deste geri.
   - Kiti düzenlemek ya da silmek desteleri kendiliğinden değiştirmez (deste kendi kopyasını taşır). Paylaşım görüntüsüne logo
     yalnız izinle (marka.paylas) girer. Kontrast (WCAG 4,5:1 / 3:1) ve renk körlüğü yalnız uyarıdır.
   - Migration: brand_kits / presentation_user_prefs yalnız sahibi, misafir yazamaz, anon erişemez, ≤10 tetikleyicide.

   Bölümler: A kaynak kuralları · B PGlite RLS (PGLITE_DIR yoksa ATLANDI) · C başsız Chrome birim senaryoları ·
   D gerçek PPTX yazı tipleri (PPTXGEN_BUNDLE yoksa ATLANDI) · E uçtan uca 1440/1024/390.
   Başsız Chrome pencereyi 500 px'in altına indirmez: 390 istenir, innerWidth ≤ 520 sınanır.
   Dış ağ yok (window.fetch kapalı, kayıtlar yerel sahte sunucuya), model yok, içerik sentetik.
   Çalıştırma:  node tests/sunum-marka-kiti.js
   ========================================================================== */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { makeRunner } = require('./_ts-extract.js');
const { CHROME, yeniSunucu, duzenek } = require('./_capraz-duzenek.js');
const { pgKur } = require('./_pglite-taban.js');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const ink = read('js/acadex-ink.js');
const { test, summary } = makeRunner();
const BLOK = (() => { const a = ink.indexOf('/* ---------- #58 (Phase 12)'), b = ink.indexOf('/* ---------- #58 son ---------- */'); return a > 0 && b > a ? ink.slice(a, b) : ''; })();
const MIG = ['20261128_sunum_marka_kiti.sql', '20261128b_sunum_inceleme.sql'];
const BUNDLE = [process.env.PPTXGEN_BUNDLE, path.join(ROOT, 'node_modules/pptxgenjs/dist/pptxgen.bundle.js')].filter(Boolean).find((p) => fs.existsSync(p)) || null;

/* ---------- A: kaynak kuralları ---------- */
test('A1 #58 bloğu var; ileri bakış (lookbehind) ve \\u kaçışı yok (kod stili)', () => {
  assert.ok(BLOK.length > 20000, '#58 bloğu bulunamadı');
  assert.equal(/\(\?<[=!]/.test(BLOK), false, 'lookbehind');
  assert.equal(/\\u[0-9a-fA-F]{4}/.test(BLOK), false, '\\u kaçışı');
});

test('A2 kamera/mikrofon/ses kaydı yok; blokta doğrudan ağ, Tavily, Gemini, Edge Function çağrısı yok', () => {
  for (const y of ['getUserMedia', 'MediaRecorder', 'SpeechRecognition', 'tavily', 'gemini', 'fetch(', 'XMLHttpRequest', 'functions.invoke', 'invoke(']) assert.equal(BLOK.toLowerCase().includes(y.toLowerCase()), false, y);
});

test('A3 yeni Edge Function yok: supabase/functions dizinleri HEAD ile aynı', () => {
  const head = execFileSync('git', ['ls-tree', '-d', '--name-only', 'HEAD', 'supabase/functions/'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').map((x) => path.basename(x)).sort();
  const simdi = fs.readdirSync(path.join(ROOT, 'supabase/functions'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  assert.deepEqual(simdi, head);
});

test('A4 ürün kuralı: öğretmen/sınıf/ödev sözcükleri #58 bloğunda ve migration\'larda yok', () => {
  const kotu = ['is_teacher', 'teacher_materials', 'teacher_note', 'teacher_review', 'my_classes', 'my_assignments', 'assignment_id', 'campuso', "'escalate'", 'öğretmene ilet'];
  for (const s of [BLOK].concat(MIG.map((f) => read('supabase/migrations/' + f)))) for (const k of kotu) assert.equal(s.toLowerCase().includes(k.toLowerCase()), false, k);
});

test('A5 var olan prova koçu ve mikrofon düğmesi satırları dokunulmadan duruyor (HEAD satırları hâlâ var)', () => {
  const head = execFileSync('git', ['show', 'HEAD:js/acadex-ink.js'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 }).replace(/\r\n/g, '\n').split('\n');
  const simdi = new Set(ink.split('\n')), satir = head.filter((l) => /data-rh-mic|\bcoach\b/.test(l));
  assert.ok(satir.length > 0, 'HEAD satırı bulunamadı');
  for (const l of satir) assert.ok(simdi.has(l), 'değişmiş: ' + l.trim().slice(0, 100));
});

test('A6 migration: RLS açık, sahip politikası, kısıtlayıcı misafir politikaları, anon erişimi geri alındı, ≤10 tetikleyicisi', () => {
  const m = read('supabase/migrations/20261128_sunum_marka_kiti.sql');
  for (const t of ['brand_kits', 'presentation_user_prefs']) {
    assert.ok(m.includes(`alter table public.${t} enable row level security`), t + ' RLS');
    for (const op of ['insert', 'update', 'delete']) assert.ok(new RegExp(`on public\\.${t} as restrictive for ${op} to authenticated`).test(m), t + ' misafir ' + op);
  }
  assert.ok(/revoke all on public\.brand_kits, public\.presentation_user_prefs from anon/.test(m));
  assert.ok(/>= 10 then/.test(m) && /sahip degistirilemez/.test(m));
  assert.ok(/brand_kits_tek_varsayilan on public\.brand_kits \(user_id\) where varsayilan/.test(m));
});

/* ---------- B: PGlite (gerçek Postgres + RLS) ---------- */
const U1 = '11111111-1111-4111-8111-111111111111', U2 = '22222222-2222-4222-8222-222222222222', UM = '33333333-3333-4333-8333-333333333333';
let PG = null;
const pg = async () => PG || (PG = await pgKur(MIG));
const atla = (ad) => console.log('  ATLANDI  ' + ad + ': PGlite yok — PGLITE_DIR ile @electric-sql/pglite bulunan node_modules yolunu verin. Bu test GEÇTİ sayılmadı.');

test('B1 brand_kits RLS: sahip ekler/okur, yabancı göremez ve değiştiremez, misafir ekleyemez, anon tabloya erişemez', async () => {
  const P = await pg(); if (!P) return atla('B1');
  await P.kok(`insert into auth.users values ('${U1}'), ('${U2}'), ('${UM}')`);
  const a = P.kim(U1), b = P.kim(U2), mf = P.kim(UM, { misafir: true }), an = P.kim(null, { anon: true });
  const r = await a("insert into public.brand_kits (ad, veri) values ('Acme', '{\"renk\":{}}') returning id"); assert.ok(r.rows && r.rows.length === 1, JSON.stringify(r));
  const id = r.rows[0].id;
  assert.equal((await a('select id from public.brand_kits')).rows.length, 1);
  assert.equal((await b('select id from public.brand_kits')).rows.length, 0, 'yabancı görmemeli');
  assert.equal((await b("update public.brand_kits set ad = 'x' returning id")).rows.length, 0, 'yabancı değiştirememeli');
  assert.ok((await b(`insert into public.brand_kits (user_id, ad) values ('${U1}', 'sızma')`)).hata, 'başkası adına ekleme reddedilmeli');
  assert.ok((await mf("insert into public.brand_kits (ad) values ('misafir')")).hata, 'misafir ekleyememeli');
  assert.ok((await an('select id from public.brand_kits')).hata, 'anon erişememeli');
  assert.equal((await a(`update public.brand_kits set user_id = '${U2}' where id = '${id}' returning id`)).hata !== undefined, true, 'sahip değiştirilemez');
});

test('B2 brand_kits: kullanıcı başına en çok 10 kit (tetikleyici), tek varsayılan (benzersiz dizin), presentation_user_prefs yalnız sahibi', async () => {
  const P = await pg(); if (!P) return atla('B2');
  const a = P.kim(U1), b = P.kim(U2);
  for (let i = 0; i < 9; i++) { const r = await a("insert into public.brand_kits (ad) values ('k" + i + "') returning id"); assert.ok(r.rows, JSON.stringify(r)); }
  const on1 = await a("insert into public.brand_kits (ad) values ('on birinci')"); assert.equal(on1.hata, '23514', '11. kit reddedilmeli: ' + JSON.stringify(on1));
  assert.ok((await b("insert into public.brand_kits (ad) values ('b') returning id")).rows, 'öteki kullanıcının sınırı ayrı');
  assert.ok((await a("update public.brand_kits set varsayilan = true where ad = 'k0' returning id")).rows.length === 1);
  assert.equal((await a("update public.brand_kits set varsayilan = true where ad = 'k1'")).hata, '23505', 'ikinci varsayılan reddedilmeli');
  assert.ok((await a(`insert into public.presentation_user_prefs (user_id, kitle) values ('${U1}', '{"kitle":"uzman"}') returning user_id`)).rows);
  assert.equal((await b('select * from public.presentation_user_prefs')).rows.length, 0, 'tercih yabancıya görünmemeli');
  assert.ok((await P.kim(UM, { misafir: true })(`insert into public.presentation_user_prefs (user_id, kitle) values ('${UM}', '{}')`)).hata, 'misafir tercih yazamaz');
});

/* ---------- C–E: başsız Chrome ---------- */
const STRIPS = [{ k: 'cover', t: 'Kapak', b: [] }, { k: 'list', t: 'Liste', b: ['Gelir 2024 yılında %12 arttı [1].', 'İki madde', 'Üç madde'] }, { k: 'end', t: 'Son', b: [] }];
const TOHUM = `await sakin(); d.querySelector('[data-newdeck]').click(); S.temaSec(TEMA); S.set(${JSON.stringify(STRIPS)}, { title: 'P', sub: 't', lang: 'tr', source: 'topic', sourceId: null }); S.bas('new'); await sakin(); await dur(3000);
  var P = S.p12(), D = function () { return S.deck(); }, J = function (x) { return JSON.stringify(x); };
  window.__hata = []; var ce = console.error; console.error = function () { window.__hata.push(Array.prototype.slice.call(arguments).map(String).join(' ').slice(0, 200)); return ce.apply(console, arguments); };
  window.addEventListener('error', function (e) { window.__hata.push('onerror ' + (e.message || '')); }); window.addEventListener('unhandledrejection', function (e) { window.__hata.push('unhandled ' + String(e.reason && e.reason.message || e.reason)); });
  /* gerçek saat: görsel çözme / toBlob sürerken yerel sunucuda bekleyen istek sanal saati durdurur */
  var agBekle = function (ms) { return new Promise(function (r) { var x = new XMLHttpRequest(); x.open('POST', window.__SRV); x.onloadend = r; x.send(JSON.stringify({ bekle: ms })); }); };
  var gercek = async function (p) { var son = 0, v, h; p.then(function (x) { son = 1; v = x; }, function (e) { son = 2; h = e; }); for (var k = 0; k < 1200 && !son; k++) await agBekle(50); if (son === 2) throw h; return v; };
  var tohum = 7; var rnd = function () { tohum = (tohum * 1103515245 + 12345) % 2147483648; return tohum / 2147483648; };
  var ciz = function (w, h, tur, ad, gurultu) { return new Promise(function (ok) { var c = d.createElement('canvas'); c.width = w; c.height = h; var x = c.getContext('2d');
    if (gurultu) { var im = x.createImageData(w, h); for (var i = 0; i < im.data.length; i++) im.data[i] = i % 4 === 3 ? 255 : (rnd() * 256) | 0; x.putImageData(im, 0, 0); } else { x.fillStyle = '#C0392B'; x.fillRect(0, 0, w, h); x.fillStyle = '#FFFFFF'; x.fillRect(w / 4, h / 4, w / 2, h / 2); }
    c.toBlob(function (b) { ok(new File([b], ad, { type: b ? b.type : '' })); }, tur, .92); }); };
  var oku = async function (f) { R.oku = f.name; try { var o = await gercek(P.mkLogoOku(f)); return { ok: 1, w: o.w, h: o.h, png: /^data:image\\/png;base64,/.test(o.src), bayt: Math.floor(o.src.split(',')[1].length * 3 / 4), o: o }; } catch (e) { return { hata: e.message }; } };
  var geo = function () { return D().slides.map(function (s) { return s.els.filter(function (e) { return !e.mrk; }).map(function (e) { return [e.id, e.type, e.x, e.y, e.w, e.h, e.text || ''].join('|'); }).join(';'); }); };
  var mrk = function () { return D().slides.map(function (s) { return s.els.filter(function (e) { return e.mrk; }).length; }); };
`;

const BIRIM = TOHUM + `
  R.p = !!P; R.dbId = !!D().dbId;
  R.adim = "C1"; /* C1 doğrulayıcılar */
  R.hex = [P.mkHex('#abc'), P.mkHex('#A1B2C3'), P.mkHex('red'), P.mkHex('#12345'), P.mkHex(' #fff '), P.mkHex(null), P.mkHex('#GGGGGG')];
  R.fontlar = P.MK_FONT; R.font = [P.mkFont('Georgia', 1), P.mkFont('Evil<script>', 1), P.mkFont('Evil', 0), P.mkFont('Verdana', 0), P.mkFont(null, 0)];
  var t0 = P.mkTemiz({ ad: '  Uzun   ' + 'x'.repeat(80), id: '../kacis', renk: { acc: '#12AB', bg: '#000' }, font: { baslik: 'Comic Sans', govde: 'Verdana', vurgu: 'Yok' }, logo: { ana: { hash: 'sahte', w: 10, h: 10 } }, gorsel: { sahte: 'data:image/png;base64,AAAA' }, surum: 1e9 });
  R.temiz = { bos: P.mkTemiz({}), bosluk: P.mkTemiz({ ad: '   ' }), adBoy: t0.ad.length, adBas: t0.ad.slice(0, 6), id: t0.id !== '../kacis' && /^[A-Za-z0-9_-]+$/.test(t0.id), acc: t0.renk.acc, bg: t0.renk.bg, roller: Object.keys(t0.renk), font: t0.font, logo: Object.keys(t0.logo).length, surum: t0.surum,
    svgLogo: Object.keys(P.mkTemiz({ ad: 'a', logo: { ana: { hash: 'h', w: 10, h: 10 } }, gorsel: { h: 'data:image/svg+xml;base64,PHN2Zz4=' } }).logo).length };
  var bt = function (s) { return new Uint8Array(s.split('').map(function (c) { return c.charCodeAt(0); })); };
  R.tur = [P.mkTur(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0])), P.mkTur(new Uint8Array([255, 216, 255, 224, 0])), P.mkTur(bt('RIFF\\0\\0\\0\\0WEBPVP8 ')), P.mkTur(new Uint8Array([239, 187, 191].concat(Array.prototype.slice.call(bt('  <svg xmlns="x"></svg>'))))), P.mkTur(bt('merhaba dünya')), P.mkTur(bt('<html><body></body></html>'))];
  var KOTU = ['<svg><script>alert(1)<\\/script></svg>', '<svg onload="x()"></svg>', '<svg><foreignObject><div></div></foreignObject></svg>', '<svg><a href="javascript:alert(1)"><text>x</text></a></svg>',
    '<!DOCTYPE svg [<!ENTITY x "y">]><svg></svg>', '<svg><image href="http://kotu.example/x.png"/></svg>', '<svg style="background:url(http://kotu.example/x)"></svg>', '<svg><style>@import url(x.css)</style></svg>',
    '<svg><set attributeName="href" to="x"/></svg>', '<svg><use xlink:href="dis.svg#a"/></svg>', '<svg><text>&#106;avascript</text></svg>', '<svg><iframe src="x"></iframe></svg>', '<svg><animate attributeName="x"/></svg>', '<svg><image href=x.png /></svg>', '<svg/onload=alert(1)>', '<svg><a href="VBScript:x">a</a></svg>'];
  var IYI = ['<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><rect width="64" height="32" fill="#2F6BFF"/></svg>', '<svg width="10" height="10"><use href="#a"/><defs><g id="a"><circle r="4" fill="url(#g)"/></g></defs></svg>', '<svg viewBox="0 0 10 10"><image href="data:image/png;base64,iVBORw0KGgo=" width="10" height="10"/></svg>'];
  R.svgKotu = KOTU.map(P.mkSvgGuvenli); R.svgIyi = IYI.map(P.mkSvgGuvenli);
  R.olcu = [P.mkOlcu(10, 10), P.mkOlcu(4000, 100), P.mkOlcu(8001, 100), P.mkOlcu(960, 480), P.mkOlcu(100, 50), P.mkOlcu('a', 5)];
  R.adim = "C2"; /* C2 logo okuma (gerçek dosya yolu: FileReader → bayt türü → SVG denetimi → Image → PNG tuval) */
  var png = await gercek(ciz(200, 80, 'image/png', 'logo.png')), L = {};
  L.png = await oku(png); L.jpeg = await oku(await gercek(ciz(300, 120, 'image/jpeg', 'logo.jpg'))); L.webp = await oku(await gercek(ciz(120, 120, 'image/webp', 'logo.webp')));
  L.svg = await oku(new File([IYI[0]], 'logo.svg', { type: 'image/svg+xml' }));
  L.svgBetik = await oku(new File([KOTU[0].replace('<svg>', '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">')], 'kotu.svg', { type: 'image/svg+xml' }));
  L.svgOlay = await oku(new File([KOTU[1]], 'kotu2.svg', { type: 'image/svg+xml' }));
  L.svgDis = await oku(new File([KOTU[5]], 'kotu3.svg', { type: 'image/svg+xml' }));
  L.svgUtf = await oku(new File([new Uint8Array(Array.prototype.slice.call(bt('<svg width="20" height="20">')).concat([255, 254]).concat(Array.prototype.slice.call(bt('</svg>'))))], 'u.svg'));
  L.metinPng = await oku(new File(['bu bir resim değil'], 'sahte.png', { type: 'image/png' }));
  L.bos = await oku(new File([], 'bos.png', { type: 'image/png' }));
  L.buyuk = await oku(new File([new Uint8Array(2000001)], 'buyuk.png', { type: 'image/png' }));
  L.oran = await oku(await gercek(ciz(4000, 100, 'image/png', 'serit.png')));
  L.uzanti = await oku(new File([png], 'aslinda-png.svg', { type: 'image/svg+xml' }));
  var gr = await gercek(ciz(640, 640, 'image/png', 'gurultu.png', 1)); R.gurultuBoy = gr.size; L.gurultu = await oku(gr);
  L.buyukBoy = await oku(await gercek(ciz(1200, 600, 'image/png', 'genis.png')));
  R.logo = {}; Object.keys(L).forEach(function (k) { var x = Object.assign({}, L[k]); delete x.o; R.logo[k] = x; });
  var LG = L.png.o;
  R.adim = "C3"; /* C3 kontrast + renk körlüğü (yalnız uyarı) */
  var V = P.mkTemiz({ ad: 'v' }).renk; R.kontrastVars = P.mkKontrast(V);
  R.kontrastZayif = P.mkKontrast(Object.assign({}, V, { ink: '#777777' }));
  R.korVars = P.mkRenkKor(V); R.korKY = P.mkRenkKor(Object.assign({}, V, { acc: '#D62728', acc2: '#2CA02C' })); R.korKY2 = P.mkRenkKor(Object.assign({}, V, { acc: '#C0392B', acc2: '#1E8A55' })); R.korMor = P.mkRenkKor(Object.assign({}, V, { acc2: '#7B3FE4' }));
  R.zayifKayit = P.mkKaydet({ ad: 'Zayıf kontrast', renk: { ink: '#777777' } }).ok; P.mkSil(P.mkListe()[0].id); await bekle(300);
  R.adim = "C4"; /* C4 saklama: ≤10, ad zorunlu, tek varsayılan, sürüm, kopya, sil, hesap satırları */
  var ks = []; for (var i = 0; i < 10; i++) { var r = P.mkKaydet({ ad: 'Kit ' + i, marka: 'M' + i }); ks.push(r.ok ? r.kit.id : null); }
  R.on = ks.filter(Boolean).length; R.onbir = P.mkKaydet({ ad: 'Kit 10' }); R.adsiz = P.mkKaydet({ ad: '   ' });
  R.kopya10 = P.mkKopya(ks[0]); await bekle(600);
  var k1 = P.mkBul(ks[1]), k2 = P.mkBul(ks[2]);
  P.mkKaydet(Object.assign({}, k1, { varsayilan: true })); P.mkKaydet(Object.assign({}, P.mkBul(ks[2]), { varsayilan: true }));
  R.varsayilan = P.mkListe().filter(function (k) { return k.varsayilan; }).map(function (k) { return k.id === ks[2]; });
  P.mkVarsayilan(ks[2]); R.varsayilanKapat = P.mkListe().filter(function (k) { return k.varsayilan; }).length;
  var s0 = P.mkBul(ks[3]).surum; P.mkKaydet(P.mkBul(ks[3])); var s1 = P.mkBul(ks[3]).surum; P.mkKaydet(Object.assign({}, P.mkBul(ks[3]), { renk: Object.assign({}, P.mkBul(ks[3]).renk, { acc: '#123456' }) })); var s2 = P.mkBul(ks[3]).surum;
  R.surum = [s0, s1, s2];
  R.sil = P.mkSil(ks[9]); R.silSonra = P.mkListe().length; await bekle(600);
  var kp = P.mkKopya(ks[4]); R.kopya = kp.ok ? { ad: kp.kit.ad, surum: kp.kit.surum, varsayilan: kp.kit.varsayilan, yeniId: kp.kit.id !== ks[4], renk: J(kp.kit.renk) === J(P.mkBul(ks[4]).renk) } : kp;
  await bekle(800); R.dbIdler = P.mkListe().filter(function (k) { return k.dbId; }).length;
  var hedef = P.mkBul(ks[5]); await window.supabaseClient.from('brand_kits').update({ surum: 50, ad: 'Hesaptan gelen ad' }).eq('id', hedef.dbId);
  R.cek = await P.mkCek(); var hc = P.mkBul(ks[5]); R.cekSonra = { ad: hc.ad, surum: hc.surum, toplam: P.mkListe().length, varsayilan: P.mkListe().filter(function (k) { return k.varsayilan; }).length };
  R.adim = "C5"; /* C5 genel tema uygulama: otomatik sürüm, tek geri al, düzen aynı */
  var kit = { ad: 'Acme', marka: 'Acme', renk: { acc: '#C0392B', head: '#222222' }, font: { baslik: 'Georgia', govde: 'Verdana' } };
  var g0 = geo(), u0 = P.undoN(), v0 = P.svListe(D()).length, j0 = J(D().slides), tm0 = J(D().tema), m0 = J(D().marka || null);
  var r1 = P.mkUygula(kit, 'genel');
  R.genel = { ok: r1.ok, undo: P.undoN() - u0, surum: P.svListe(D()).length - v0, geo: J(geo()) === J(g0), acc: D().tema.acc, hf: D().tema.hfP, bf: D().tema.bfP, hfE: D().tema.hf, kapsam: D().marka.kapsam, logo: mrk().reduce(function (a, b) { return a + b; }, 0), sonOto: (P.svListe(D())[0] || {}).oto };
  P.undo(); R.genelGeri = { slaytlar: J(D().slides) === j0, tema: J(D().tema) === tm0, marka: J(D().marka || null) === m0, undo: P.undoN() - u0 };
  R.adim = "C6"; /* C6 tüm uygun asetatlar + logo: çakışan asetat listelenir, logo çoğalmaz, IMG_DUPLICATE yok */
  var kitL = { ad: 'Logolu', marka: 'Logolu A.Ş.', renk: { acc: '#1E8A55' }, font: { baslik: 'Calibri', govde: 'Calibri' }, logo: { ana: { hash: LG.hash, w: LG.w, h: LG.h } }, gorsel: {} }; kitL.gorsel[LG.hash] = LG.src;
  var yer = P.mkYer(D().slides[1], { l: { w: LG.w, h: LG.h } }); R.yerBos = !!yer;
  var engel = Object.assign(JSON.parse(J(D().slides[1].els.filter(function (e) { return e.type === 't' || e.type === 'h'; })[0])), { id: 'engel1', x: yer.x, y: yer.y, w: yer.w, h: yer.h, text: 'Engel' }); D().slides[1].els.push(engel); P.renderAll();
  g0 = geo(); u0 = P.undoN();
  var r2 = P.mkUygula(kitL, 'tum');
  R.tum = { ok: r2.ok, uygun: r2.uygun, uygunsuz: r2.uygunsuz, logosuz: r2.logosuz, mrk: mrk(), geo: J(geo()) === J(g0), undo: P.undoN() - u0, src: D().slides.every(function (s) { return s.els.filter(function (e) { return e.mrk; }).every(function (e) { return e.src === LG.src && e.mrk === P.mkTemiz(kitL).id || e.src === LG.src; }); }),
    logolu: D().marka.logolu, qa: P.qaListe(D()).bulgu.map(function (b) { return b.kod || b.code || b.k; }) };
  var r3 = P.mkUygula(kitL, 'tum'); R.tumTekrar = { ok: r3.ok, mrk: mrk() };
  R.adim = "C7"; /* C7 elle renk: geçerli olan alınır, geçersiz yok sayılır */
  var r4 = P.mkUygula(kit, 'genel', { acc: '#123456', bg: 'kirmizi', soft: '#ABC' }); R.elle = { ok: r4.ok, acc: D().tema.acc, elle: D().marka.elle };
  R.adim = "C8"; /* C8 hata yolu: bütün deste yedekten geri, geri al yığını aynı */
  var jH = J({ s: D().slides, t: D().tema, m: D().marka }), uH = P.undoN(); P.uygulaHata(1); var r5 = P.mkUygula(kitL, 'tum');
  R.hataYolu = { ok: r5.ok, hata: r5.hata, ayni: J({ s: D().slides, t: D().tema, m: D().marka }) === jH, undo: P.undoN() - uH };
  R.adim = "C9"; /* C9 kit düzenle/sil → deste değişmez; durum "yeni sürüm var" / "kit silindi" der */
  var kS = P.mkKaydet({ ad: 'Deste kiti', renk: { acc: '#334455' } }).kit; R.kSkayit = !!kS;
  P.mkSil(ks[6]); kS = kS || P.mkKaydet({ ad: 'Deste kiti', renk: { acc: '#334455' } }).kit;
  P.mkUygula(kS, 'genel'); var jd = J({ s: D().slides, t: D().tema, m: D().marka }); R.durum0 = P.mkDurum(D());
  P.mkKaydet(Object.assign({}, P.mkBul(kS.id), { renk: Object.assign({}, kS.renk, { acc: '#998877' }) })); R.duzenleAyni = J({ s: D().slides, t: D().tema, m: D().marka }) === jd; R.durum1 = P.mkDurum(D());
  P.mkSil(kS.id); R.silAyni = J({ s: D().slides, t: D().tema, m: D().marka }) === jd; R.durum2 = P.mkDurum(D());
  R.adim = "C10"; /* C10 paylaşım görüntüsü: logo yalnız izinle */
  P.mkUygula(kitL, 'tum'); var parca = LG.src.slice(-60), sk = function () { return J(P.snapKur(D())); };
  R.pay = { izinsiz: sk().indexOf(parca) >= 0, mkPay: P.mkPay(D(), D().slides[0].els).filter(function (e) { return e.mrk; }).length };
  D().marka.paylas = true; R.pay.izinli = sk().indexOf(parca) >= 0; R.pay.mkPay2 = P.mkPay(D(), D().slides[0].els).filter(function (e) { return e.mrk; }).length; D().marka.paylas = false;
  R.adim = "C11"; /* C11 önizleme: örnek kapak + içerik, logo boşsa eklenir */
  var orn = P.mkOrnekler(P.mkTemiz(kitL), {}, D()); R.ornek = { n: orn.slides.length, kinds: orn.slides.map(function (s) { return s.k || s.kind || s.type || ''; }), logo: orn.slides.map(function (s) { return s.els.filter(function (e) { return e.mrk; }).length; }), acc: orn.tema.acc };
  R.adim = "D:"; /* D: PPTX yazı tipleri (paket varsa) */
  R.pptx = null; if (window.PptxGenJS) { window.__pptx = []; window.PptxGenJS.prototype.writeFile = function (o) { return this.write({ outputType: 'base64' }).then(function (b) { window.__pptx.push(b); return o && o.fileName; }); };
    P.mkUygula(kit, 'genel'); await P.exportPptx(null); if (!window.__pptx.length) await P.exportPptx(null); R.pptx = window.__pptx[window.__pptx.length - 1] || ''; R.pptxTema = { hf: D().tema.hfP, bf: D().tema.bfP }; }
  R.hataK = window.__hata;
`;

const pqOlc = `var olc = function () { var D0 = d.querySelector('dialog.pq-dlg'), r = D0.getBoundingClientRect();
    return { en: innerWidth, acik: D0.open, sol: Math.round(r.left), sag: Math.round(r.right), gen: Math.round(r.width), dYatay: D0.scrollWidth - D0.clientWidth,
      tasan: Array.prototype.filter.call(D0.querySelectorAll('*'), function (x) { var b = x.getBoundingClientRect(); return b.width && x.offsetParent !== null && (b.right > r.right + 1 || b.left < r.left - 1); }).map(function (x) { return x.tagName + '.' + x.className + '[' + Math.round(x.getBoundingClientRect().right) + ']'; }).slice(0, 5) }; };`;

const E2E = TOHUM + pqOlc + `
  var Q = function (s) { return d.querySelector('dialog.pq-dlg ' + s); }, tik = async function (s) { var b = Q(s); if (!b) throw new Error('yok: ' + s); b.click(); await bekle(250); };
  var yaz = function (s, v) { var x = Q(s); x.value = v; x.dispatchEvent(new Event('input', { bubbles: true })); x.dispatchEvent(new Event('change', { bubbles: true })); };
  R.acc0 = D().tema.acc; d.querySelector('[data-pq-ac]').click(); await bekle(300); R.olc0 = olc(); R.sekme = (Q('[data-pq-tab][aria-selected="true"]') || {}).getAttribute ? Q('[data-pq-tab][aria-selected="true"]').getAttribute('data-pq-tab') : null;
  await tik('[data-mk-yeni]'); yaz('[data-mk-ad]', 'Uçtan uca kit'); yaz('[data-mk-marka]', 'Örnek Marka');
  var hx = Q('[data-mk-hex="acc"]'); if (hx) yaz('[data-mk-hex="acc"]', '#C0392B');
  var lg = await gercek(ciz(200, 80, 'image/png', 'logo.png')), inp = Q('[data-mk-dosya="ana"]'), dt = new DataTransfer(); dt.items.add(lg); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
  for (var k = 0; k < 3000 && !Q('[data-mk-logo="ana"] img') && !(Q('[data-mk-hata]') || {}).textContent; k++) await agBekle(20); R.logoHata = (Q('[data-mk-hata]') || {}).textContent || '';
  R.logoOnizleme = !!Q('[data-mk-logo="ana"] img'); R.ornek = Array.prototype.map.call(d.querySelectorAll('dialog.pq-dlg [data-mk-ornek]'), function (b) { return b.innerHTML.length > 50; });
  R.kontrast = !!Q('[data-mk-kor]') || !!Q('[data-mk-kontrast]') || /kontrast/i.test(Q('[role="tabpanel"]').textContent); R.olc1 = olc();
  await tik('[data-mk-kaydet]'); R.liste = P.mkListe().map(function (k) { return { ad: k.ad, acc: k.renk.acc, logo: Object.keys(k.logo) }; });
  var g0 = geo(), u0 = P.undoN(); await tik('[data-mk-uygula]'); var rd = Q('[name="mk-k"][value="tum"]'); rd.checked = true; rd.dispatchEvent(new Event('change', { bubbles: true })); await bekle(200); R.olc2 = olc();
  R.uygunListe = !!Q('[data-mk-uygun]') || !!Q('[data-mk-uygunsuz]');
  await tik('[data-mk-uygulaok]'); R.son = !!Q('[data-mk-son]'); R.dur = (Q('[data-pq-dur]') || {}).textContent || ''; R.mrk = mrk(); R.geo = J(geo()) === J(g0); R.undo = P.undoN() - u0; R.acc = D().tema.acc; R.olc3 = olc();
  await tik('[data-pq-geri]'); R.geri = { mrk: mrk(), acc: D().tema.acc, marka: !!D().marka };
  R.hataK = window.__hata;
`;

/* Görsel çözme / toBlob gerçek saatte sürer; sanal saat boşta ileri sıçradığı için bütçe 600 sn (son değer geçerli). */
const VT = '--virtual-time-budget=600000';
let KROM = null;
const krom = () => KROM || (KROM = (async () => {
  if (!CHROME) return null;
  const H = yeniSunucu(); await new Promise((r) => H.srv.listen(0, '127.0.0.1', r)); const port = H.srv.address().port;
  const { sayfa, kos, temizle } = duzenek();
  const paket = (h) => (BUNDLE ? h.replace('<pre id="diag"></pre>', '<script src="' + pathToFileURL(BUNDLE).href + '"></script>\n<pre id="diag"></pre>') : h);
  try {
    const out = { B: await kos('mk-birim.html', 'mk-b', paket(sayfa('ok', port, 0, BIRIM)), ['--window-size=1440,900', VT]), DB: JSON.parse(JSON.stringify(H.DB.brand_kits)), E: {} };
    for (const en of [1440, 1024, 390]) H.DB.brand_kits.length = 0, out.E[en] = await kos('mk-e2e-' + en + '.html', 'mk-e' + en, sayfa('ok', port, 0, E2E), ['--window-size=' + en + ',900', VT]);
    return out;
  } finally { H.srv.close(); temizle(); }
})());
const yok = (ad) => console.log('  ATLANDI  ' + ad + ': Chrome bulunamadı. Bu test GEÇTİ sayılmadı.');

test('C1 doğrulayıcılar: HEX, yazı tipi (yalnız sistem/PPTX), kit temizliği, bayt türü, SVG etkin içerik, ölçü sınırı', async () => {
  const K = await krom(); if (!K) return yok('C1'); const R = K.B;
  assert.equal(R.p, true, 'p12 kancası yok');
  assert.deepEqual(R.hex, ['#AABBCC', '#A1B2C3', null, null, '#FFFFFF', null, null]);
  assert.ok(R.fontlar.includes('Calibri') && R.fontlar.includes('Arial') && R.fontlar.includes('Georgia'));
  assert.deepEqual(R.font, ['Georgia', 'Arial', null, 'Verdana', null]);
  const T = R.temiz; assert.equal(T.bos, null); assert.equal(T.bosluk, null); assert.equal(T.adBoy, 60); assert.equal(T.adBas, 'Uzun x'); assert.equal(T.id, true);
  assert.equal(T.acc, '#2F6BFF', 'geçersiz HEX varsayılana düşer'); assert.equal(T.bg, '#000000'); assert.deepEqual(T.roller, ['bg', 'ink', 'head', 'acc', 'acc2', 'soft', 'surf', 'line', 'navy']);
  assert.deepEqual(T.font, { baslik: 'Arial', govde: 'Verdana', vurgu: null }); assert.equal(T.logo, 0, 'özeti tutmayan logo atılır'); assert.equal(T.svgLogo, 0, 'saklanan logo yalnız PNG'); assert.equal(T.surum, 100000);
  assert.deepEqual(R.tur, ['png', 'jpeg', 'webp', 'svg', null, null]);
  assert.ok(R.svgKotu.length >= 15); R.svgKotu.forEach((v, i) => assert.equal(v, false, 'kötü SVG #' + i + ' kabul edildi'));
  assert.deepEqual(R.svgIyi, [true, true, true]);
  assert.deepEqual(R.olcu, [null, null, null, { w: 480, h: 240 }, { w: 100, h: 50 }, null]);
});

test('C2 logo dosyaları: PNG/JPEG/WebP/güvenli SVG → PNG; betikli/olaylı/dış bağlantılı SVG, sahte PNG, boş, >2 MB, aşırı oran reddedilir; büyük logo küçültülür', async () => {
  const K = await krom(); if (!K) return yok('C2'); const L = K.B.logo;
  for (const k of ['png', 'jpeg', 'webp', 'svg', 'uzanti']) { assert.equal(L[k].ok, 1, k + ': ' + JSON.stringify(L[k])); assert.equal(L[k].png, true, k + ' PNG olarak saklanmalı'); }
  assert.deepEqual([L.png.w, L.png.h], [200, 80]); assert.deepEqual([L.svg.w, L.svg.h], [64, 32]);
  assert.deepEqual([L.svgBetik.hata, L.svgOlay.hata, L.svgDis.hata, L.svgUtf.hata], ['svg', 'svg', 'svg', 'svg']);
  assert.equal(L.metinPng.hata, 'tur'); assert.equal(L.bos.hata, 'bos'); assert.equal(L.buyuk.hata, 'buyuk'); assert.equal(L.oran.hata, 'olcu');
  assert.ok(K.B.gurultuBoy > 350000 && K.B.gurultuBoy <= 2000000, 'gürültülü kaynak 350 KB üstünde olmalı: ' + K.B.gurultuBoy);
  assert.equal(L.gurultu.ok, 1, JSON.stringify(L.gurultu)); assert.ok(L.gurultu.bayt <= 350000, 'saklanan ≤350 KB: ' + L.gurultu.bayt); assert.ok(L.gurultu.w < 480 && L.gurultu.w === L.gurultu.h, 'küçültülmeli: ' + L.gurultu.w);
  assert.deepEqual([L.buyukBoy.w, L.buyukBoy.h], [480, 240], 'uzun kenar 480');
});

test('C3 kontrast ve renk körlüğü yalnız uyarı: varsayılan kit geçer, #777 metin 4,5:1 altında işaretlenir ama kayıt yapılır; kırmızı/yeşil vurgu uyarılır', async () => {
  const K = await krom(); if (!K) return yok('C3'); const R = K.B;
  assert.ok(R.kontrastVars.every((x) => x.ok), JSON.stringify(R.kontrastVars.filter((x) => !x.ok)));
  const z = R.kontrastZayif.find((x) => x.a === 'ink' && x.b === 'bg'); assert.equal(z.ok, false); assert.equal(z.esik, 4.5); assert.ok(z.oran < 4.5 && z.oran > 4.4);
  assert.equal(R.zayifKayit, true, 'kontrast uyarısı kaydı engellememeli');
    const ay = (L) => L.filter((x) => x.kod === 'vurgu_ayrim').map((x) => x.tur).sort();
  assert.deepEqual(ay(R.korVars), [], 'varsayılan mavi/yeşil vurgu ayırt edilir: ' + JSON.stringify(R.korVars));
  assert.deepEqual(ay(R.korKY), ['deutan'], JSON.stringify(R.korKY)); assert.deepEqual(ay(R.korKY2), ['protan'], JSON.stringify(R.korKY2));
  assert.deepEqual(ay(R.korMor), ['deutan', 'protan'], 'mavi/mor kırmızı-yeşil körlüğünde birleşir');
});

test('C4 kit yönetimi: en çok 10, ad zorunlu, tek varsayılan, sürüm yalnız içerik değişince artar, kopya/sil, hesaba yazım ve hesaptan birleştirme', async () => {
  const K = await krom(); if (!K) return yok('C4'); const R = K.B;
  assert.equal(R.on, 10); assert.deepEqual(R.onbir, { ok: false, hata: 'sinir' }); assert.deepEqual(R.adsiz, { ok: false, hata: 'ad' }); assert.deepEqual(R.kopya10, { ok: false, hata: 'sinir' });
  assert.deepEqual(R.varsayilan, [true], 'tek varsayılan, sonuncusu'); assert.equal(R.varsayilanKapat, 0);
  assert.equal(R.surum[1], R.surum[0], 'aynı içerik sürümü artırmaz'); assert.equal(R.surum[2], R.surum[0] + 1, 'değişen içerik +1');
  assert.equal(R.sil, true); assert.equal(R.silSonra, 9);
  assert.equal(R.kopya.ad, 'Kit 4 (kopya)'); assert.equal(R.kopya.surum, 1); assert.equal(R.kopya.varsayilan, false); assert.equal(R.kopya.yeniId, true); assert.equal(R.kopya.renk, true);
  assert.equal(R.dbIdler, 10, 'her kit hesaba yazılıp dbId almalı');
  assert.equal(R.cek, true); assert.deepEqual([R.cekSonra.ad, R.cekSonra.surum], ['Hesaptan gelen ad', 50], 'daha yeni hesap sürümü alınır'); assert.ok(R.cekSonra.toplam <= 10); assert.ok(R.cekSonra.varsayilan <= 1);
  const veri = K.DB.map((r) => Object.keys(r.veri || {}).sort().join(',')); assert.ok(veri.every((v) => v === 'font,gorsel,id,logo,renk'), JSON.stringify(veri));
  assert.ok(K.DB.every((r) => r.user_id === 'u-capraz'));
});

test('C5 genel tema: otomatik sürüm + tek geri al adımı, öğe geometrisi aynı, yazı tipi ve renk uygulanır; geri al deste/tema/markayı birebir döndürür', async () => {
  const K = await krom(); if (!K) return yok('C5'); const G = K.B.genel, B = K.B.genelGeri;
  assert.equal(G.ok, true); assert.equal(G.undo, 1); assert.equal(G.surum, 1); assert.ok(G.sonOto, 'otomatik sürüm işareti'); assert.equal(G.geo, true);
  assert.deepEqual([G.acc, G.hf, G.bf, G.kapsam, G.logo], ['#C0392B', 'Georgia', 'Verdana', 'genel', 0]); assert.equal(G.hfE, 'Gelasio', 'ekranda metrik eşdeğer');
  assert.deepEqual(B, { slaytlar: true, tema: true, marka: true, undo: 0 });
});

test('C6 tüm uygun asetatlar: logo yalnız boş sağ üst köşeye, çakışan asetat listelenir, düzen aynı, yeniden uygulama logoyu çoğaltmaz, IMG_DUPLICATE yok', async () => {
  const K = await krom(); if (!K) return yok('C6'); const T = K.B.tum;
  assert.equal(K.B.yerBos, true); assert.equal(T.ok, true); assert.deepEqual(T.uygun, [0, 2]); assert.deepEqual(T.uygunsuz, [{ i: 1, neden: 'cakisma' }]); assert.equal(T.logosuz, 0);
  assert.deepEqual(T.mrk, [1, 0, 1]); assert.equal(T.geo, true); assert.equal(T.undo, 1); assert.equal(T.src, true); assert.equal(T.logolu, 2);
  assert.equal(T.qa.includes('IMG_DUPLICATE'), false, JSON.stringify(T.qa));
  assert.deepEqual(K.B.tumTekrar, { ok: true, mrk: [1, 0, 1] });
});

test('C7 elle renk geçersizi yok sayar; C8 hata yolunda deste/tema/marka birebir geri, geri al yığını değişmez', async () => {
  const K = await krom(); if (!K) return yok('C7');
  assert.deepEqual(K.B.elle, { ok: true, acc: '#123456', elle: { acc: '#123456', soft: '#AABBCC' } });
  assert.deepEqual(K.B.hataYolu, { ok: false, hata: 'hata', ayni: true, undo: 0 });
});

test('C9 kiti düzenlemek/silmek desteyi değiştirmez; durum "yeni sürüm" ve "silindi" der', async () => {
  const K = await krom(); if (!K) return yok('C9'); const R = K.B;
  assert.ok(R.durum0 && R.durum0.yeni === false && R.durum0.silindi === false, JSON.stringify(R.durum0));
  assert.equal(R.duzenleAyni, true); assert.equal(R.durum1.yeni, true);
  assert.equal(R.silAyni, true); assert.equal(R.durum2.silindi, true);
});

test('C10 paylaşım görüntüsü (snapKur): logo izinsiz çıkarılır, izinle girer; C11 önizleme kapak + içerik asetatı çizer', async () => {
  const K = await krom(); if (!K) return yok('C10'); const P = K.B.pay;
  assert.deepEqual(P, { izinsiz: false, mkPay: 0, izinli: true, mkPay2: 1 });
  assert.equal(K.B.ornek.n, 2); assert.deepEqual(K.B.ornek.logo, [1, 1]); assert.equal(K.B.ornek.acc, '#1E8A55');
  assert.deepEqual(K.B.hataK, [], 'konsol hatası: ' + JSON.stringify(K.B.hataK));
  assert.deepEqual(K.B.ag, [], 'dış ağ isteği');
});

/* ---------- D: gerçek PPTX ---------- */
const unzip = (buf) => {
  const out = {}; let e = buf.length - 22; while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--; assert.ok(e >= 0, 'ZIP sonu yok');
  const n = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16);
  for (let i = 0; i < n; i++) {
    const m = buf.readUInt16LE(p + 10), cs = buf.readUInt32LE(p + 20), fl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), kl = buf.readUInt16LE(p + 32), lo = buf.readUInt32LE(p + 42);
    const ad = buf.toString('utf8', p + 46, p + 46 + fl), lf = buf.readUInt16LE(lo + 26), lx = buf.readUInt16LE(lo + 28), d = buf.subarray(lo + 30 + lf + lx, lo + 30 + lf + lx + cs);
    out[ad] = m === 8 ? zlib.inflateRawSync(d) : Buffer.from(d); p += 46 + fl + xl + kl;
  }
  return out;
};

test('D1 gerçek PPTX: kitin başlık/gövde yazı tipi adıyla yazılır (Georgia/Verdana), yedek ad değil', async () => {
  const K = await krom(); if (!K) return yok('D1');
  if (!BUNDLE) return console.log('  ATLANDI  D1: pptxgenjs paketi yok — PPTXGEN_BUNDLE ile pptxgen.bundle.js yolunu verin. Bu test GEÇTİ sayılmadı.');
  assert.ok(K.B.pptx, 'PPTX üretilmedi'); assert.deepEqual(K.B.pptxTema, { hf: 'Georgia', bf: 'Verdana' });
  const z = unzip(Buffer.from(K.B.pptx, 'base64')), yaz = Object.keys(z).filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k)).map((k) => z[k].toString('utf8')).join('\n');
  const tf = new Set(); yaz.replace(/<a:latin typeface="([^"]+)"/g, (m, a) => { tf.add(a); return m; });
  assert.ok(tf.has('Georgia') && tf.has('Verdana'), [...tf].join(','));
  assert.equal(tf.has('Gelasio') || tf.has('Open Sans'), false, 'ekran yedeği PPTX\'e yazılmamalı');
});

/* ---------- E: uçtan uca ---------- */
test('E1 uçtan uca 1440/1024/390: arayüzden kit oluştur (logo dosyasıyla), önizle, tüm asetatlara uygula, tek adımda geri al; pencere yatay taşmaz', async () => {
  const K = await krom(); if (!K) return yok('E1');
  for (const en of [1440, 1024, 390]) {
    const E = K.E[en], t = (m) => en + ': ' + m;
    if (en === 390) assert.ok(E.olc0.en <= 520, t('dar pencere ' + E.olc0.en)); else assert.equal(E.olc0.en, en, t('genişlik'));
    assert.equal(E.olc0.acik, true, t('pencere açılmadı')); assert.equal(E.sekme, 'mk', t('ilk sekme'));
    assert.equal(E.logoHata, '', t('logo hatası')); assert.equal(E.logoOnizleme, true, t('logo önizlemesi')); assert.equal(E.kontrast, true, t('erişilebilirlik bölümü')); assert.equal(E.uygunListe, true, t('uygun asetat listesi')); assert.deepEqual(E.ornek, [true, true], t('örnek kapak + içerik'));
    assert.equal(E.liste.length, 1, t('kit kaydı')); assert.equal(E.liste[0].ad, 'Uçtan uca kit'); assert.deepEqual(E.liste[0].logo, ['ana']);
    assert.equal(E.son, true, t('sonuç kartı')); assert.equal(E.geo, true, t('düzen değişti')); assert.equal(E.undo, 1, t('tek geri al'));
    assert.ok(E.mrk.reduce((a, b) => a + b, 0) >= 1, t('logo eklenmedi ' + JSON.stringify(E.mrk)));
    assert.deepEqual(E.geri.mrk, [0, 0, 0], t('geri al logoları kaldırmalı')); assert.equal(E.geri.marka, false, t('geri al marka kaydını kaldırmalı')); assert.equal(E.geri.acc, E.acc0, t('geri al teması')); assert.equal(E.acc, '#C0392B', t('kit rengi'));
    for (const o of [E.olc0, E.olc1, E.olc2, E.olc3]) { assert.ok(o.dYatay <= 1, t('pencere içi yatay kaydırma ' + o.dYatay)); assert.ok(o.sol >= -1 && o.sag <= o.en + 1, t('pencere ekrandan taşıyor ' + JSON.stringify(o))); assert.deepEqual(o.tasan, [], t('taşan öğe')); }
    assert.deepEqual(E.hataK, [], t('konsol hatası ' + JSON.stringify(E.hataK))); assert.deepEqual(E.ag, [], t('dış ağ'));
  }
});

(async () => { await summary(); })();
