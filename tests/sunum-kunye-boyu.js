/* ==========================================================================
   ACADEX — FOTOĞRAF KÜNYESİ YÜKSEKLİĞİ (tests/sunum-kunye-boyu.js)

   NEDEN VAR (27.11.2026, #43.1): künye kutusu tek satırlık sabitti (YUVA.kunye.h 22, çiftte 18, tam sayfada 18/20).
   Uzun fotoğrafçı adı + kaynak + lisans 300 px'te iki satıra kırılıyor (~30 px > 22 + 3), teknik denetim haklı olarak
   TEXT_OVERFLOW veriyordu (canlı destede 3, 4, 8. asetat). Düzeltme kaynağında: künye yerleşimden sonra ölçülür
   (kunyeUydur → kunyeBoy, Phase 6 onarımıyla aynı kural: ceil(ölçüm) + 4), sığan künye kompakt kalır; tam sayfa
   fotoğrafta alt kenardan yukarı uzar (kapak şeridi de onunla); 'yer' kutusunda fotoğraf küçülür; uzayan künye başka
   fotoğrafa binerse ya da asetattan taşarsa o yuva reddedilir (sıradaki biçim denenir). Künye kısaltılmaz, yazı
   küçültülmez, TEXT_OVERFLOW kuralı değişmez. Yazı doğrulanmadan ölçülmez (yaziSonra kuyruğu).

   Bölümler:  A kaynak kuralları · B gerçek pencere (başsız Chrome, gerçek CSS, gerçek teknikQA).
   Adlar sentetiktir.
   Çalıştırma:  node tests/sunum-kunye-boyu.js
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
const cut = (a, b) => { const i = ink.indexOf(a); assert.ok(i >= 0, 'bulunamadı: ' + a.slice(0, 60)); const j = ink.indexOf(b, i + a.length); assert.ok(j > i, 'son bulunamadı: ' + b.slice(0, 60)); return ink.slice(i, j); };

/* ---------- A: kaynak kuralları ---------- */
test('A1 kunyeBoy: yazı hazır değilse ölçmez; yalnız taşarsa uzar (ceil + 4, Phase 6 onarımıyla aynı); yazıya ve boyuta dokunmaz; asetat dışına uzamaz', () => {
  const k = cut('  var kunyeBoy = function (sl, c, taban) {', '  var kunyeSonra = function');
  assert.match(k, /if \(!c \|\| !c\.text \|\| !yaziHazirMi\(\)\) return 0;/);
  assert.match(k, /var mh = measureH\(c, sl\); if \(!\(mh > c\.h \+ 3\)\) return 0;/, 'sığan künye kompakt kalmalı; eşik overflows ile aynı');
  assert.match(k, /var h = Math\.ceil\(mh\) \+ 4/);
  assert.match(k, /if \(y < 0 \|\| y \+ h > H - 8\) return 0;/);
  assert.ok(!/\.size\s*=|\.text\s*=|\.slice\(|substr/.test(k), 'künye kısaltılmaz, yazı küçültülmez');
  assert.match(ink, /c\.y \+ mh \+ 4 <= H - 8\) c\.h = Math\.ceil\(mh\) \+ 4;/, 'Phase 6 onarım kuralı (aynı formül) yerinde');
});

test('A2 TEXT_OVERFLOW zayıflamadı: overflows aynı, künyeler denetimden muaf değil', () => {
  assert.match(ink, /var overflows = function \(e, sl\) \{ var h = measureH\(e, sl\); return h > 0 && h > e\.h \+ 3; \};/);
  assert.match(ink, /if \(\(e\.type === 'ul' \|\| e\.type === 't' \|\| e\.type === 'h'\) && e\.text && overflows\(e, s\)\) add\('TEXT_OVERFLOW', null, n, e\.id\);/);
  const tt = cut('  var teknikGeo = function', '  var teknikQA = function'), sat = tt.split('\n').filter((l) => /TEXT_OVERFLOW/.test(l));
  assert.equal(sat.length, 1); assert.ok(!/creditId|kunye|kun\[/.test(sat[0]), 'teknik denetim künyeyi ayırmamalı');
});

test('A3 yerleşim işlevleri saf geometri kalır; boy yerleşimden sonra verilir (yuvaDene, elle ekleme, değiştirme, düzen değişimi, yeniden boyutlama)', () => {
  const pl = cut('  var placePair = function', '  /* ---------- FOTOĞRAF YUVASI MOTORU');
  assert.ok(!/kunyeBoy|kunyeUydur/.test(pl), 'placePair/placeTam/placePhoto ölçüm yapmaz (G2 birebir eşitlik)');
  assert.ok(!/kunyeBoy/.test(cut('  var placeYan = function', '  var placeYer = function')));
  assert.match(cut('  var placeYer = function', '  var yuvaDene = function'), /for \(var g = 0; g < 3; g\+\+\) \{[^\n]*kunyeBoy\(sl, cr\)/, 'yer kutusu künyeyi içeriden paylaşır');
  const yd = cut('  var yuvaDene = function', '  var gorselSec = function');
  assert.match(yd, /fitSlide\(d\); kunyeUydur\(d\);/);
  assert.match(yd, /if \(measureH\(ce, d\) > ce\.h \+ 3 \|\| ce\.y < 0 \|\| ce\.y \+ ce\.h > H - 2\) return null;/, 'sığmayan künye yuvayı kapatır');
  assert.match(ink, /x\.y = old\.y \+ old\.h \+ 4; kunyeSonra\(s0, x\);/, 'fotoğraf değiştirme');
  assert.match(ink, /im = placePhoto\(s0, p, imQ\.value\.trim\(\)\); yaziFit\(s0\); kunyeSonra\(s0, kunyesi\(s0, im\)\);/, 'serbest ekleme');
  assert.match(ink, /kc\.text = kun0\[j\]; kunyeUydur\(s, kc\);/, 'düzen değişiminde eski künye metni geri yazılınca');
  assert.match(cut('  var kunyeKaydir = function', '\n  };'), /if \(o\.w !== ow\) kunyeBoy\(s, c\);[^\n]*\n[^\n]*ce\.style\.height = c\.h \+ 'px';/);
  assert.match(cut('  var kunyeSonra = function', '\n'), /yaziSonra\(function \(hemen\) \{[^\n]*'kunye:' \+ c\.id\)/, 'yazı yaşam döngüsü: aynı anahtarlı işten sonuncusu');
  assert.equal(ink.split('fitSlide(').length - 1, 5, 'yeni fitSlide çağrısı yok');
  assert.deepEqual(Object.keys(eval('(' + cut('  var YUVA = ', ';\n').slice('  var YUVA = '.length) + ')')).sort(), ['iki', 'kapak', 'kunye', 'orta', 'sag', 'sol', 'tam', 'yan', 'yer']);
  assert.match(ink, /kunye: \{ h: 22, ara: 4, boy: 12 \}/, 'tek satırlık kompakt boy korunur; kör 34 px yok');
});

test('A4 kayıtlı sunumlar otomatik onarılmaz: açılış ve yükleme yolunda künye boylaması yok', () => {
  const uses = ink.split('\n').filter((l) => /kunyeUydur\(|kunyeSonra\(|kunyeBoy\(/.test(l) && !/var kunye(Uydur|Sonra|Boy) = function/.test(l));
  assert.equal(uses.length, 7, 'çağrı yerleri: ' + uses.map((l) => l.trim().slice(0, 70)).join(' || '));
  uses.forEach((l) => assert.ok(!/yaziUyum|loadDeck|openDeck|syncList|fromRow/.test(l), l.trim().slice(0, 80)));
});

/* ---------- B: gerçek pencere ---------- */
const { CHROME, yeniSunucu, duzenek } = require('./_capraz-duzenek.js');
const tarayici = () => {
  if (!CHROME) { console.log('  ATLANDI  B1–B6 (başsız Chrome): Chrome bulunamadı — CHROME_BIN ile yol verin. Bu testler GEÇTİ sayılmadı.'); return Promise.resolve(); }
  const { sayfa, kos, temizle } = duzenek();
  const KANCA = `  window.__K = { newSlide: newSlide, yuvaDene: yuvaDene, gorselSec: gorselSec, placePhoto: placePhoto, kunyeUydur: kunyeUydur, kunyeBoy: kunyeBoy, kunyeSonra: kunyeSonra, kunyesi: kunyesi, measureH: measureH, teknikQA: teknikQA, credText: credText, hazir: yaziHazirMi, YUVA: YUVA,
    yaziTut: function () { var e = fontDurum, ac; fontDurum = { k: e.k, p: new Promise(function (r) { ac = function () { fontDurum = e; r({ ok: true }); }; }), bitti: false, ok: true }; return function () { ac(); }; } };\n`;
  const STR = [{ k: 'cover', t: 'Künye', b: [] }, { k: 'list', t: 'Bir', b: ['Kısa bir madde burada', 'İkinci kısa madde', 'Üçüncü kısa madde'] }, { k: 'end', t: 'Teşekkürler', b: [] }];
  const govde = `
    await sakin(); d.querySelector('[data-newdeck]').click(); S.temaSec(TEMA);
    S.set(${JSON.stringify(STR)}, { title: 'Kunye', sub: 't', lang: 'tr', source: 'topic', sourceId: null, yol: { k: 'research', yedek: 0 }, sources: [], istek: 3 }); S.bas('new'); await sakin(); await bekle(1500); await dur(800);
    var K = window.__K, D = S.deck(), Hh = 540, Ww = 960;
    var P = function (ad, kay, lis, w, h) { return { large: 'https://img.invalid/' + encodeURIComponent(ad) + (w || 1200) + '.jpg', thumb: 'https://img.invalid/t.jpg', alt: 'x', photographer: ad, page: 'https://img.invalid/p/' + encodeURIComponent(ad), source: kay, id: 'i' + ad.length + (w || 1200), license: lis, license_url: '', w: w || 1200, h: h || 800 }; };
    var AD = { bir: P('A. Kaya', 'Unsplash', ''), iki: P('Aleksandra Konstantinopolitanova Yıldırımoğlu', 'Wikimedia Commons', 'CC BY-SA 4.0'),
      uc: P('Maximiliana Theodora Konstantinopolitanova Yıldırımoğlu ve Bartholomew Alexander Featherstonehaugh-Montgomery', 'Wikimedia Commons', 'CC BY-SA 4.0'),
      kelime: P('Wolfeschlegelsteinhausenbergerdorffvoralternwaren', 'Wikimedia Commons', 'CC BY-SA 4.0') };
    var MAD = ['Kentlerde çatı bahçeleri artıyor', 'Yerel üretim taşımayı kısaltıyor', 'Gençler küçük girişim kuruyor'];
    var yap = { liste: function () { return K.newSlide('list', 'Kent bahçeleri', MAD, { v: 0, zorla: 1 }); }, cesit: function () { return K.newSlide('list', 'Kent bahçeleri', MAD, { v: 2, zorla: 1 }); },
      kapak: function () { var s = K.newSlide('cover', 'Kent bahçeleri ve yerel üretim', [], {}); s.bg = 'navy'; return s; },
      alinti: function () { return K.newSlide('quote', 'Bir gönüllü', ['Bahçe bize komşuluğu yeniden öğretti, her hafta yeni biri katılıyor.'], { v: 0 }); },
      cizim: function () { return K.newSlide('viz', 'Bahçe düzeni', ['Kısa açıklama'], {}); },
      bos: function () { return { id: 'bos' + Math.random().toString(36).slice(2, 7), lay: 'list', v: 0, bg: 'clear', els: [] }; } };
    /* biçim → (asetat, form, fotoğraflar); 'orta' serbest eklemedir (yuvasız asetat), kapak yanı dikey fotoğrafla */
    var BIC = [['sag', 'liste', ''], ['sol', 'liste', 'sol'], ['yan', 'cesit', 'yan'], ['kapakYan', 'kapak', 'tam', 'dik'], ['kapakTam', 'kapak', 'tam'], ['alintiTam', 'alinti', 'tam'], ['iki', 'liste', 'iki'], ['yer', 'cizim', 'yer'], ['orta', 'bos', null]];
    var kutu = function (e, sl) { return { x: e.x, y: e.y, w: e.w, h: e.h, mh: K.measureH(e, sl), boy: e.size }; };
    var cakis = function (a, b, bh) { return a.x < b.x + b.w - 1 && a.x + a.w > b.x + 1 && a.y < b.y + (bh || b.h) - 1 && a.y + a.h > b.y + 1; };
    var incele = function (sl) {
      var imgs = sl.els.filter(function (e) { return e.type === 'img' && e.src; }), kun = {}; imgs.forEach(function (e) { kun[e.creditId] = e; });
      return sl.els.filter(function (e) { return kun[e.id]; }).map(function (c) { var o = kun[c.id], k = kutu(c, sl);
        k.tam = o.x === 0 && o.y === 0 && o.w === Ww && o.h === Hh; k.text = c.text;
        k.foto = imgs.filter(function (g) { return g !== o && !(g.x === 0 && g.y === 0 && g.w === Ww && g.h === Hh) && cakis(c, g); }).length;
        k.yazi = sl.els.filter(function (e) { return e !== c && /^(h|t|ul)$/.test(e.type) && e.text && !e.muted && !e.dz && !kun[e.id] && cakis(c, e, K.measureH(e, sl)); }).length;
        k.kendi = !k.tam && cakis(c, o) ? 1 : 0;
        var bant = sl.els.filter(function (r) { return r.type === 'rect' && r.dz && r.x <= c.x && r.x + r.w >= c.x + c.w && r.y <= c.y && r.y + r.h >= c.y + c.h; });
        k.bant = bant.length; return k; });
    };
    R.hazir = K.hazir(); R.B = {};
    Object.keys(AD).forEach(function (ad) { BIC.forEach(function (b) {
      var sl = yap[b[1]](), p = b[3] === 'dik' ? Object.assign({}, AD[ad], { w: 800, h: 1200 }) : AD[ad], r = null, form = b[2];
      var yer0 = b[1] === 'cizim' ? sl.els.filter(function (e) { return e.type === 'img' && !e.src; })[0] : null, yerK = yer0 ? { x: yer0.x, y: yer0.y, w: yer0.w, h: yer0.h } : null;
      if (form === null) { K.placePhoto(sl, p, 'x'); K.kunyeUydur(sl); r = { els: sl.els, form: 'orta' }; }
      else r = K.yuvaDene(sl, form, form === 'iki' ? [p, AD.bir] : [p], 'x');
      var s2 = r ? { id: sl.id, lay: sl.lay, v: sl.v, bg: sl.bg, els: r.els } : null;
      var o = { kabul: !!r, form: r ? r.form : null, k: s2 ? incele(s2) : [], yerK: yerK };
      if (s2 && yerK) { var im = s2.els.filter(function (e) { return e.type === 'img' && e.src; })[0], c = K.kunyesi(s2, im); o.yerIc = im.y >= yerK.y && c.y + c.h <= yerK.y + yerK.h + 1 && im.x >= yerK.x && im.x + im.w <= yerK.x + yerK.w; }
      if (s2 && b[0] === 'kapakTam') { var rb = s2.els.filter(function (e) { return e.type === 'rect' && e.dz && e.y > 400; })[0], c2 = o.k[0]; o.bantRect = rb ? { y: rb.y, h: rb.h } : null; o.bantAlt = rb ? rb.y + rb.h : null; o.kunyeAlt = c2 ? c2.y + c2.h : null; }
      if (!r && form) { var g = K.gorselSec(sl, form === 'iki' ? [p, AD.bir] : [p], form, 'x'); o.yedek = g ? g.form : null; o.yedekK = g ? incele({ id: sl.id, lay: sl.lay, v: sl.v, bg: sl.bg, els: g.els }) : []; }
      R.B[ad + ':' + b[0]] = o;
    }); });
    /* teknik denetim: kabul edilen yerleşimler canlı desteye konur, gerçek teknikQA koşar */
    var asl = []; Object.keys(AD).forEach(function (ad) { BIC.forEach(function (b) {
      var sl = yap[b[1]](), p = b[3] === 'dik' ? Object.assign({}, AD[ad], { w: 800, h: 1200 }) : AD[ad], r = b[2] === null ? null : K.gorselSec(sl, b[2] === 'iki' ? [p, AD.bir] : [p], b[2], 'x');
      if (b[2] === null) { K.placePhoto(sl, p, 'x'); K.kunyeUydur(sl); } else if (r) sl.els = r.els; else return;
      sl.notes = ''; asl.push(sl); }); });
    var ilk = D.slides[0], son = D.slides[D.slides.length - 1]; D.slides = [ilk].concat(asl, [son]);
    var to = function () { return K.teknikQA(D, 'deste').issues.filter(function (x) { return x.code === 'TEXT_OVERFLOW'; }).map(function (x) { return x.slide + ':' + x.element; }); };
    var q = K.teknikQA(D, 'deste'); R.geo = q.olcum.geometri; R.tasma = to(); R.n = asl.length;
    /* gerçek taşma hâlâ yakalanır: uzamış künye eski tek satırlık kutuya geri çekilir; gövde yazısı da */
    var uz = null, uzI = 0; asl.forEach(function (s, i) { s.els.forEach(function (e) { if (!uz && e.type === 't' && e.h > 30 && s.els.some(function (g) { return g.creditId === e.id; })) { uz = e; uzI = i; } }); });
    R.uzVar = !!uz; if (uz) { var h0 = uz.h; uz.h = 22; R.geri = to(); R.beklenen = (uzI + 2) + ':' + uz.id; uz.h = h0; }
    var gv = asl[0].els.filter(function (e) { return e.type === 'ul' || (e.type === 't' && !asl[0].els.some(function (g) { return g.creditId === e.id; })); })[0], gh = gv.h; gv.h = 4; R.govde = to(); R.govdeBek = '2:' + gv.id; gv.h = gh;
    R.sonTasma = to();
    /* yazı doğrulanmadan: ölçüm yok, kutu kompakt; iş kuyruğa girer, yazı gelince bir kez boylanır */
    var sl = yap.bos(); K.placePhoto(sl, AD.iki, 'x'); D.slides.splice(1, 0, sl); var im = sl.els.filter(function (e) { return e.type === 'img'; })[0], c = K.kunyesi(sl, im);
    var ac = K.yaziTut(); R.tut = { hazir: K.hazir(), boy: K.kunyeBoy(sl, c), sec: K.gorselSec(yap.liste(), [AD.iki], '', 'x'), h0: c.h };
    K.kunyeSonra(sl, c); K.kunyeSonra(sl, c); R.tut.kuyruk = S.kuyruk(); R.tut.h1 = c.h;
    ac(); await sakin(); await bekle(200); R.tut.h2 = c.h; R.tut.mh = K.measureH(c, sl); R.tut.kuyruk2 = S.kuyruk();
    R.ozgun = { h: K.YUVA.kunye.h, boy: K.YUVA.kunye.boy };`;
  return (async () => {
    const Hs = yeniSunucu({ senkron: true }); await new Promise((r) => Hs.srv.listen(0, '127.0.0.1', r));
    let R;
    try { let h = sayfa('ok', Hs.srv.address().port, 0, govde); assert.equal(h.split('  window.__S = { set:').length, 2); h = h.replace('  window.__S = { set:', () => KANCA + '  window.__S = { set:'); R = await kos('kunye-b.html', 'kunye-b', h); }
    finally { Hs.srv.close(); temizle(); }
    const B = R.B || {};
    const satir = (k) => Math.round(k.mh / (k.boy * 1.25));

    test('B1 tek satırlık künye kompakt kalır (22 / 18 / 20 px, ölçüm eşiğin altında), her biçimde', () => {
      assert.ok(!R.hata, R.hata); assert.equal(R.hazir, true, 'yazı doğrulanmış olmalı');
      ['sag', 'sol', 'yan', 'kapakYan', 'kapakTam', 'alintiTam', 'iki', 'yer', 'orta'].forEach((b) => {
        const o = B['bir:' + b]; assert.ok(o && o.kabul, b + ' kabul edilmeli');
        o.k.forEach((k) => { assert.equal(satir(k), 1, b + ' tek satır'); assert.ok([18, 20, 22].includes(k.h), b + ' kompakt: ' + k.h); assert.ok(k.mh <= k.h + 3, b); });
      });
    });

    test('B2 iki satırlık künye (canlı destedeki 4/8 gibi): kutu ölçülen yüksekliğe uzar, 12 px yazı korunur, metin kısalmaz', () => {
      ['sag', 'sol', 'yan', 'kapakYan', 'yer', 'orta'].forEach((b) => {
        const o = B['iki:' + b]; assert.ok(o && o.kabul, b + ' kabul edilmeli'); const k = o.k[0];
        assert.ok(satir(k) >= 2, b + ' en az iki satır (ölçüm ' + k.mh + ')'); assert.equal(k.boy, 12);
        assert.equal(k.h, Math.ceil(k.mh) + 4, b + ' boy = ceil(ölçüm)+4'); if (k.w >= 300) assert.equal(k.h, 34, b + ' iki satır 34 px: ' + k.h);
        assert.match(k.text, /Aleksandra Konstantinopolitanova Yıldırımoğlu \/ Wikimedia Commons · CC BY-SA 4\.0$/, 'kaynak ve lisans tam');
      });
      assert.equal(B['iki:yan'].k[0].w, 300, 'canlı destedeki yan künye genişliği');
    });

    test('B3 ikiden çok satır ve uzun tek kelimeli ad ölçülür (iki satır varsayılmaz); kaynak ve lisans yerinde', () => {
      ['sag', 'sol', 'yan', 'yer'].forEach((b) => {
        const k = B['uc:' + b].k[0]; assert.ok(B['uc:' + b].kabul, b); assert.ok(satir(k) >= 3, b + ' ' + satir(k) + ' satır'); assert.ok(k.mh <= k.h + 3, b + ' sığar'); assert.match(k.text, /· CC BY-SA 4\.0$/);
      });
      Object.keys(B).filter((x) => x.startsWith('kelime:') && B[x].kabul).forEach((x) => B[x].k.forEach((k) => assert.ok(k.mh <= k.h + 3, x + ' sığar')));
      assert.ok(B['kelime:sag'].kabul && B['kelime:yan'].kabul);
      /* kapak yanında fotoğraf altı dar: üç satırlık künye asetattan taşacaksa yuva kapanır (fotoğraf konmaz, künye kesilmez) */
      const ky = B['uc:kapakYan']; assert.ok(ky.kabul ? ky.k[0].mh <= ky.k[0].h + 3 : ky.yedek === null, 'kapak yanı: ' + JSON.stringify(ky));
    });

    test('B4 tam sayfa fotoğraf: künye alt kenardan yukarı uzar, kapak şeridi künyeyi örter; alıntıda pano içinde kalır', () => {
      ['iki', 'uc'].forEach((ad) => {
        const o = B[ad + ':kapakTam']; assert.ok(o.kabul, ad + ' kapak'); const k = o.k[0];
        assert.ok(k.tam && k.mh <= k.h + 3, ad + ' sığar'); assert.equal(o.kunyeAlt, 530, ad + ' alt kenar sabit (512 + 18)'); assert.ok(o.bantRect.y <= k.y - 4 && o.bantAlt === 534, ad + ' şerit: ' + JSON.stringify(o.bantRect)); assert.equal(k.bant, 1);
        const q = B[ad + ':alintiTam']; if (q.kabul) { const c = q.k[0]; assert.ok(c.mh <= c.h + 3 && c.y + c.h === 494 && c.y >= 268, ad + ' alıntı künyesi panoda'); assert.equal(c.yazi, 0); }
        else assert.equal(q.yedek, null, 'alıntının tek yuvası tam');
      });
      assert.equal(B['bir:kapakTam'].bantRect.y, 508, 'tek satırda şerit değişmez');
    });

    test('B5 çakışma yok: künye fotoğrafına, öteki fotoğrafa, yazıya binmez, asetat içinde; çiftte uzayan künye ikinci fotoğrafa binecekse "iki" reddedilir, sıradaki biçim gelir', () => {
      Object.keys(B).forEach((x) => { const o = B[x]; o.k.concat(o.yedekK || []).forEach((k) => {
        assert.equal(k.foto, 0, x + ' öteki fotoğrafa biniyor'); assert.equal(k.yazi, 0, x + ' yazıya biniyor'); assert.equal(k.kendi, 0, x + ' kendi fotoğrafına biniyor');
        assert.ok(k.y >= 0 && k.y + k.h <= 538 && k.x >= 0 && k.x + k.w <= 961, x + ' asetat dışı'); assert.ok(k.mh <= k.h + 3, x + ' künye taşıyor'); }); });
      assert.equal(B['bir:iki'].form, 'iki'); assert.ok(B['iki:iki'].kabul === false, 'iki satırlık çift künyesi 2. fotoğrafa biner');
      assert.ok(B['iki:iki'].yedek != null && B['iki:iki'].yedek !== 'iki', 'yedek biçim: ' + B['iki:iki'].yedek);
      ['bir', 'iki', 'uc'].forEach((ad) => assert.ok(B[ad + ':yer'].yerIc, ad + ' yer kutusunun içinde'));
      assert.ok(B['uc:yer'].k[0].y + B['uc:yer'].k[0].h <= B['uc:yer'].yerK.y + B['uc:yer'].yerK.h + 1);
    });

    test('B6 gerçek teknikQA: sığan künyelerde TEXT_OVERFLOW yok; künye eski kutuya çekilince ya da gövde taşınca yine yakalanır; yazı doğrulanmadan ölçüm yok, sonra bir kez boylanır', () => {
      assert.equal(R.geo, 'tamam'); assert.ok(R.n >= 30, 'asetat ' + R.n); assert.deepEqual(R.tasma, [], 'yeni TEXT_OVERFLOW: ' + JSON.stringify(R.tasma));
      assert.ok(R.uzVar); assert.deepEqual(R.geri, [R.beklenen], 'gerçek künye taşması yakalanmalı');
      assert.ok(R.govde.includes(R.govdeBek), 'gövde taşması yakalanmalı: ' + JSON.stringify(R.govde)); assert.deepEqual(R.sonTasma, []);
      const t = R.tut; assert.equal(t.hazir, false); assert.equal(t.boy, 0); assert.equal(t.sec, null, 'yuva motoru yazısız ölçmez');
      assert.equal(t.h0, 22); assert.equal(t.h1, 22, 'yazı yokken kutu kompakt'); assert.equal(t.kuyruk, 1, 'aynı anahtar tek iş');
      assert.equal(t.kuyruk2, 0); assert.ok(t.h2 > 22 && t.mh <= t.h2 + 3, 'yazı gelince boylandı: ' + t.h2 + ' / ' + t.mh);
      assert.deepEqual(R.ozgun, { h: 22, boy: 12 });
    });
  })().catch((e) => { test('B başsız Chrome koşusu', () => { throw e; }); });
};

tarayici().then(() => summary());
