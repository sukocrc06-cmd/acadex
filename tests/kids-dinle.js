/* ==========================================================================
   ACADEX — ACADEX KIDS: SESLİ CEVAP, SESLİ KOMUT, TÜRKÇE MASALLAR (tests/kids-dinle.js), 20.11.2026

   NEDEN VAR: Çocuk İngilizce kelimeyi söyler, Acadia anlar ("Aferin!"); Türkçe komutla gezinir;
   kitaplıkta her konuya Türkçe anlatılan, yalnız hedef kelimesi İngilizce olan bir masal var.
   kids/assets/kids-dinle.js, kids-masal.js, supabase/functions/kids-ses-tanima
   Bu dosya şunları korur:
     - çocuk telaffuzu esnek ama gevşek değil: "kar" = car, "blu" = blue, "3" = three; cat ≠ car
     - çok seçenekli cevapta en iyi aday net değilse seçim yapılmaz
     - Türkçe komutlar ("hayvanlara git", "sesi kapat" geri sayılmaz)
     - mikrofon veli açmadan hiç kullanılmaz; kayıt saklanmaz; sunucu yalnız Acadex adreslerine açık
     - 22 konunun her birine 6 sayfalık masal; her hedef kelime gerçek, resmi var, metinde işaretli
     - masalın her cümlesi ses kataloğunda
   Tarayıcıda (sahte ses tanıma + Chromium sahte mikrofon ile sunucu yolu) denendi.
   Çalıştırma:  node tests/kids-dinle.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();

function yukle(ls) {
  const depo = Object.assign({}, ls || {});
  const W = { document: { createElement: () => ({ getContext: () => null, style: {} }), addEventListener() { }, dispatchEvent() { }, documentElement: { classList: { add() { }, toggle() { } } } }, addEventListener() { }, matchMedia: () => ({ matches: false }), navigator: {}, console,
    localStorage: { getItem: (k) => (k in depo ? depo[k] : null), setItem: (k, v) => { depo[k] = String(v); }, removeItem: (k) => { delete depo[k]; } }, CustomEvent: function () { }, KIDS_SES: {} };
  W.window = W; vm.createContext(W);
  for (const f of ['kids-canli.js', 'kids-ciz.js', 'kids-resim.js', 'kids-resim2.js', 'kids-resim3.js', 'kids-hayvan.js', 'kids-veri.js', 'kids-konu.js', 'kids-temalar.js', 'kids-temalar2.js', 'kids-temalar3.js', 'kids-kitap.js', 'kids-masal.js', 'kids-dinle.js']) vm.runInContext(read('kids/assets/' + f), W, { filename: f });
  return W;
}
const W = yukle(), DN = W.KIDS_DINLE, MS = W.KIDS_MASAL, V = W.KIDS_VERI;

test('çocuk telaffuzu: esnek eşleştirme', () => {
  const evet = [['kar', 'car'], ['Car.', 'car'], ['the car', 'car'], ['blu', 'blue'], ['3', 'three'], ['tree', 'three'], ['ret', 'red'], ['yelo', 'yellow'], ['dok', 'dog'], ['katt', 'cat'], ['elefant', 'elephant'],
    ['epıl', 'apple'], ['fire engine', 'fire engine'], ['fireengine', 'fire engine'], ['bırd', 'bird'], ['grin', 'green'], ['orınç', 'orange'], ['I said car', 'car'], ['çiz', 'cheese'], ['hepi', 'happy'], ['bas', 'bus']];
  const hayir = [['cat', 'car'], ['red', 'bed'], ['hello', 'yellow'], ['sun', 'car'], ['', 'car'], ['blue', 'green'], ['pig', 'big'], ['kamyon', 'car']];
  const hata = [];
  for (const [h, t] of evet) if (!DN.eslesir(h, t, 'en').ok) hata.push('kabul edilmeli: ' + h + ' → ' + t);
  for (const [h, t] of hayir) if (DN.eslesir(h, t, 'en').ok) hata.push('reddedilmeli: ' + h + ' → ' + t);
  assert.equal(hata.join('\n'), '');
});

test('çok seçenekli cevap: net değilse seçmez', () => {
  assert.equal(DN.enIyi(['car'], ['car', 'cat', 'bus'], 'en'), 'car');
  assert.equal(DN.enIyi(['kar'], ['car', 'cat', 'bus'], 'en'), 'car');
  assert.equal(DN.enIyi(['bas'], ['car', 'cat', 'bus'], 'en'), 'bus');
  assert.equal(DN.enIyi(['merhaba'], ['car', 'cat', 'bus'], 'en'), null);
  assert.equal(DN.enIyi(['a', 'red'], ['red', 'blue'], 'en'), 'red', 'alternatiflerden biri yeter');
});

test('Türkçe komutlar', () => {
  const K = [{ id: 'animals', tr: 'Hayvanlar', en: 'Animals' }, { id: 'transport', tr: 'Taşıtlar', en: 'Transport' }, { id: 'colours', tr: 'Renkler', en: 'Colours' }];
  const c = (s) => { const x = DN.komut(s, K); return x ? x.tur + (x.id ? ':' + x.id : '') : null; };
  assert.equal(c('hayvanlara git'), 'konu:animals');
  assert.equal(c('Taşıtlar'), 'konu:transport');
  assert.equal(c('renklere gidelim'), 'konu:colours');
  assert.equal(c('kitaplığı aç'), 'kitap');
  assert.equal(c('geri dön'), 'geri');
  assert.equal(c('tekrar söyle'), 'tekrar');
  assert.equal(c('resim yapalım'), 'sahnekur');
  assert.equal(c('sesi kapat'), 'sesKapat', '"kapat" geri sayılmasın');
  assert.equal(c('merhaba'), null);
});

test('izin: veli açmadan mikrofon yok; ses saklanmaz', () => {
  const kapali = yukle().KIDS_DINLE;
  assert.equal(kapali.izin(), 'sor');
  assert.equal(kapali.hazir(), false);
  const ac = yukle({ 'kids.mik': 'acik' }).KIDS_DINLE;
  assert.equal(ac.izin(), 'acik');
  const js = read('kids/assets/kids-dinle.js');
  assert.match(js, /function dinle\(o\) \{\s*o = o \|\| \{\};\s*if \(izin\(\) !== 'acik'\) return Promise\.resolve\(\{ durum: 'kapali' \}\);/, 'dinle izinsiz hiçbir şey açmaz');
  assert.match(js, /if \(\+o\.querySelector\('input'\)\.value === a \+ b\) \{ izinVer\('acik'\)/, 'büyükler kapısı');
  assert.match(js, /if \(an && !konustu\) return coz\(\{ durum: 'sessiz'/, 'konuşma yoksa sunucuya hiçbir şey gitmez');
  assert.match(js, /akis\.getTracks\(\)\.forEach\(function \(t\) \{ t\.stop\(\); \}\)/, 'mikrofon kullanılmayınca kapanır');
  assert.doesNotMatch(js, /localStorage\.setItem\([^)]*(blob|ses|kayit)/i, 'ses cihazda da saklanmaz');
  const app = read('kids/assets/kids-app.js');
  assert.match(app, /data-vmik aria-pressed=/, 'veli köşesinden açılıp kapanır');
});

test('sunucu yedeği: yalnız Acadex adresleri, sınırlar, kayıt yok', () => {
  const f = read('supabase/functions/kids-ses-tanima/index.ts');
  assert.match(f, /acadex\\\.com\\\.tr/); assert.match(f, /acadex-4vp\\\.pages\\\.dev/);
  assert.match(f, /if \(!origin \|\| !IZINLI\.some\(\(r\) => r\.test\(origin\)\)\) return json\(\{ hata: 'izinsiz adres' \}, 403, h\)/);
  assert.match(f, /const EN_FAZLA = 600 \* 1024/); assert.match(f, /if \(sinirda\(ip\)\) return json/);
  assert.match(f, /Deno\.env\.get\('GROQ_API_KEY'\)/);
  assert.doesNotMatch(f, /storage|\.from\(|insert\(|writeFile/i, 'ses hiçbir yere yazılmaz');
  assert.doesNotMatch(f, /gsk_[A-Za-z0-9]{10}/, 'anahtar kodda yok');
  const js = read('kids/assets/kids-dinle.js');
  assert.match(js, /functions\/v1\/kids-ses-tanima/);
});

test('masallar: 22 konu, 6 sayfa, hedef kelimeler gerçek ve işaretli', () => {
  assert.equal(MS.LISTE.length, 22);
  const konular = new Set(MS.LISTE.map((b) => b.konu));
  assert.equal(konular.size, 22, 'her konuya bir masal');
  const R = W.KIDS_RESIM, H = W.KIDS_HAYVAN, resim = (id) => H.var(id) || R.var(id) || V.RENK.some((x) => x.id === id) || V.SAYI.some((x) => x.id === id);
  const hata = [];
  for (const b of MS.LISTE) {
    if (b.sayfalar.length !== 6) hata.push(b.id + ' sayfa ' + b.sayfalar.length);
    const H5 = MS.hedefler(b); if (H5.length < 5) hata.push(b.id + ' hedef ' + H5.length);
    b.sayfalar.forEach((s, i) => {
      if (s.k && !V.ogeBul(s.k)) hata.push(b.id + '#' + i + ' kelime yok: ' + s.k);
      if (s.k && !/\*[^*]+\*/.test(s.s)) hata.push(b.id + '#' + i + ' metinde işaret yok');
      [s.k].concat(s.r).filter(Boolean).forEach((r) => { if (!resim(r)) hata.push(b.id + '#' + i + ' resim yok: ' + r); });
      /* anlatım Türkçe: İngilizce kelime cümlede geçmez (Acadia onu ayrıca söyler); robot gibi aynı yazılanlar hariç */
      if (s.k) { const e = MS.en(s.k).toLowerCase(); if (e !== MS.trAd(s.k).toLocaleLowerCase('tr') && new RegExp('(^|[^a-zçğıöşü])' + e + '($|[^a-zçğıöşü])', 'i').test(MS.duzMetin(s.s))) hata.push(b.id + '#' + i + ' İngilizce kelime metinde: ' + e); }
    });
  }
  assert.equal(hata.join('\n'), '');
  assert.equal(MS.trAd('car') + ' → ' + MS.en('car'), 'Araba → car', 'kullanıcının örneği');
});

test('masal sesleri katalogda; kitaplık ve akış bağlantıları', () => {
  const k = new Set(require(path.join(ROOT, 'kids/ses/katalog.js'))().map((x) => x.dil + ':' + x.metin));
  const C = MS.cumleler(), eksik = [];
  C.tr.forEach((m) => { if (!k.has('tr:' + m)) eksik.push('tr:' + m); });
  C.en.forEach((m) => { if (!k.has('en:' + m)) eksik.push('en:' + m); });
  DN.cumleler().forEach((m) => { if (!k.has('tr:' + m)) eksik.push('tr:' + m); });
  assert.equal(eksik.join('\n'), '');
  assert.ok(k.has('tr:Araba, İngilizce') && k.has('en:car!'));
  const kitap = read('kids/assets/kids-kitap.js'), anlat = read('kids/assets/kids-anlat.js'), app = read('kids/assets/kids-app.js'), b = read('kids/assets/birlestir.js');
  assert.match(kitap, /data-masal="' \+ b\.id/); assert.match(kitap, /L = o\.bant === 'minik' \? \[\] : kitaplar\(o\.bant\)/, 'Minikler yalnız masal');
  assert.match(anlat, /if \(DN && DN\.hazir\(\)\) \{ await DN\.tekrarla\(\{ en: r\.en/, 'İzle: senin sıran');
  assert.match(app, /SES\.soyle\('Say: ' \+ r\.en, 'en'\)\.then\(function \(\) \{ if \(DN && DN\.hazir\(\)\) anla\(\); \}\)/, 'Söyle durağı: söyleyince dinler');
  assert.match(app, /secenekler: oyunSecenekleri/, 'oyunda cevabı söyleyerek');
  for (const f of ["'kids-dinle.js'", "'kids-masal.js'", "'kids-dinle.css'", "'kids-masal.css'"]) assert.ok(b.includes(f), f);
  assert.ok(b.indexOf("'kids-dinle.js'") < b.indexOf("'kids-anlat.js'") && b.indexOf("'kids-masal.js'") > b.indexOf("'kids-kitap.js'"));
});

summary();
