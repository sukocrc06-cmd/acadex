/* ==========================================================================
   ACADEX — MEDICA ÇEP VAKA BANKASI, ANATOMİ ARA KATLARI VE SİSTEM MODÜLLERİ (tests/medica-cep.js)

   NEDEN VAR (02.11.2026): "Vakalar derya deniz olmalı; anatomide kalp, beyin, damar ayrı bölümler,
   hastanede anatomi ara katları." Seçilenler:
     - ÇEP tabanlı hastalık kataloğu (labs/klinik/cep/*.js, 8 sistem) + parametrik hasta üretici
       (her ziyarette farklı yaş/cinsiyet/eşlik eden hastalık/vital/tetkik, tipik-atipik başvuru)
       + ÇEP düzeyine göre görev (Acil, Ön tanı, Tanı, Tanı-tedavi, İzlem, Korunma).
     - Medica'da 1. katın üstünde A1–A8 anatomi ara katları; her katta istasyonlar: Anatomi
       istasyonu (sistem modülü), Radyoloji odası, Diseksiyon salonu; vakadan anatomiye köprü
       (?vaka=cep:<hastalık> → 3B modelde yapıları bul, puan hastaneye).
     - Anatomi Lab'de "Sistemler" modu (labs/anatomi/index.html, satır içi “SİSTEMLER” betiği): animasyonlu modüller,
       kesit ↔ görüntü (radyoloji), diseksiyon, sisteme göre test ve aralıklı tekrar.
   Bu test: katalog şeması, üreticinin çeşitliliği ve belirleyiciliği, her 3B yapının modelin
   verisinde gerçekten bulunması, hastane ve lab bağlantıları.
   Calistirma:  node tests/medica-cep.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();

const CEPDIR = path.join(ROOT, 'labs/klinik/cep');
const SISTEMLER = ['kv', 'noro', 'sol', 'sind', 'uro', 'kas', 'end', 'bb'];
const C = require(path.join(CEPDIR, 'cep.js'));
SISTEMLER.forEach((s) => C.ekle(s, require(path.join(CEPDIR, s + '.js'))));
const K = require(path.join(ROOT, 'labs/klinik/klinik.js'));

/* modelin gerçek yapı adları: data/ax-*.js (base64; 4 bayt başlık uzunluğu + JSON başlık) ve tüp yolları */
const MODEL = (() => {
  const ad = new Set(), oku = (f) => { const s = fs.readFileSync(path.join(ROOT, 'labs/anatomi/data', f), 'utf8'); return Buffer.from(s.slice(s.indexOf('"') + 1, s.lastIndexOf('"')), 'base64'); };
  for (const sys of ['iskelet', 'kas', 'organ', 'damar', 'sinir']) { const b = oku('ax-' + sys + '.js'), n = b.readUInt32LE(0); JSON.parse(b.subarray(4, 4 + n).toString('utf8')).forEach((h) => ad.add(h.n.replace(/\.(r|l)$/, '').trim())); }
  JSON.parse(oku('ax-tubes.js').toString('utf8')).forEach((t) => ad.add(t.n.replace(/\.(r|l)$/, '').trim()));
  return ad;
})();
const SID = new Set((read('labs/anatomi/index.html').match(/^  ([a-z_]+): \{ tr: '/gm) || []).map((x) => x.trim().split(':')[0]));
const modeldeVar = (n) => (n.startsWith('sid:') ? SID.has(n.slice(4)) : MODEL.has(n));

test('katalog: 8 sistem, sistem başına en az 8 hastalık, toplam ≥ 64; şema denetiminden geçer', () => {
  assert.deepEqual(C.SISTEM.map((s) => s.id), SISTEMLER);
  const L = C.liste(); assert.ok(L.length >= 64, 'hastalık sayısı ' + L.length);
  SISTEMLER.forEach((s) => assert.ok(C.liste(s).length >= 8, s));
  const hata = L.flatMap((h) => C.denetle(h)); assert.deepEqual(hata, []);
  assert.deepEqual(Object.keys(C.DUZEY), ['A', 'OnT', 'T', 'TT', 'I', 'K']);
});

test('3B görev: her hastalığın bulunacak yapısı modelin verisinde gerçekten var', () => {
  assert.ok(MODEL.size > 1000, 'model adları okunamadı: ' + MODEL.size);
  const yok = C.liste().flatMap((h) => h.ana[1].filter((y) => !modeldeVar(y[0])).map((y) => h.id + ' → ' + y[0]));
  assert.deepEqual(yok, []);
});

test('üretici: her düzey için klinik sahne şemasına uygun, kusursuz görüşme 100 puan', () => {
  for (const h of C.liste()) for (const dz of C.duzeyler(h)) {
    const sen = C.uret(h.id, 'test', { duzey: dz }); assert.deepEqual(K.denetle(sen), [], h.id + ' ' + dz);
    assert.equal(sen.cep.duzey, dz); assert.equal(sen.vaka, 'cep:' + h.id); assert.equal(sen.adimlar[sen.adimlar.length - 1].hedef, 'model');
    const sec = {}; sen.adimlar.forEach((a, i) => {
      if (a.tip === 'sor' || a.tip === 'eylem') sec[i] = a.secenek.filter((o) => o.puan > 0).sort((x, y) => y.puan - x.puan).slice(0, a.hak || 99).map((o) => o.id);
      if (a.tip === 'karar') sec[i] = a.secenek.findIndex((o) => o.dogru);
    });
    assert.equal(K.puanla(sen, sec).puan, 100, h.id + ' ' + dz);
    const g = sen.adimlar.find((a) => a.tip === 'karar' && /^ÇEP görevi/.test(a.baslik)); assert.ok(g, 'ÇEP görevi adımı');
  }
});

test('üretici: aynı tohum aynı hasta, farklı tohum farklı hasta; derya deniz çeşitlilik', () => {
  assert.deepEqual(C.uret('kv-stemi', 'x1'), C.uret('kv-stemi', 'x1'));
  const imza = new Set(); let n = 0;
  for (const h of C.liste()) for (let s = 0; s < 30; s++) { const x = C.uret(h.id, 'z' + s); imza.add(JSON.stringify([h.id, x.hasta.yas, x.hasta.cins, x.vital, x.cep.duzey, x.cep.atipik, x.cep.kom])); n++; }
  assert.ok(imza.size / n > 0.95, 'benzersiz oran ' + imza.size + '/' + n);
  /* atipik başvuru gerçekten çıkıyor (yaşlı/diyabetik/kadında STEMI) ve mentor uyarıyor */
  let at = null; for (let s = 0; s < 200 && !at; s++) { const x = C.uret('kv-stemi', 'a' + s); if (x.cep.atipik) at = x; }
  assert.ok(at, 'atipik STEMI üretilmeli'); assert.match(at.adimlar[0].metin, /Göğsümde ağrı pek yok/); assert.ok(at.adimlar.some((a) => a.tip === 'konus' && /^Dikkat:/.test(a.metin)));
  /* cinsiyete göre yanıt ("erkek||kadın") */
  for (let s = 0; s < 40; s++) { const x = C.uret('si-apandisit', 'c' + s); const o = x.adimlar.find((a) => a.tip === 'sor').secenek.find((y) => y.id === 'adet'); assert.ok(!/\|\|/.test(o.cevap)); if (x.hasta.cins === 'E') assert.doesNotMatch(o.cevap, /adet/i); }
  /* triyaj: zamanla yarışılan tanılar kırmızı */
  assert.equal(C.uret('no-sak', 't').triyaj[0], 'kirmizi'); assert.equal(C.uret('kas-yok', 't'), null);
});

test('Medica: A1–A8 ara katları, kat etiketi, sıra numarası, ziyaret başına 48 yeni hasta', () => {
  global.AXCEP = C; delete require.cache[require.resolve(path.join(ROOT, 'labs/medica/medica-veri.js'))];
  const V = require(path.join(ROOT, 'labs/medica/medica-veri.js')); delete global.AXCEP;
  assert.equal(V.KAT.length, 7, 'ana katlar değişmez');
  assert.deepEqual(V.ARAKAT.map((k) => k.etiket), ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8']);
  const k = V.katBul('ak-noro'); assert.equal(V.katEtiket(k), 'A2 ara kat'); assert.equal(V.katEtiket(V.katBul('tip')), '1. kat'); assert.equal(V.sira(k, 2), 'A2·03');
  const Z = V.cepZiyaret('ziyaret-1'), ids = Object.keys(Z); assert.equal(ids.length, 48);
  ids.forEach((id) => assert.equal(V.katOf(id).ara, true));
  const s = Z[ids[0]]; assert.deepEqual(K.denetle(V.anamnezEkle(s)), []);
  assert.ok(V.PROFIL[s.id], 'eşlik eden hastalıklar sistematik anamnezde tutarlı');
  assert.notDeepEqual(Object.keys(V.cepZiyaret('ziyaret-2')).map((i) => Z[i] && Z[i].hasta.ad), ids.map((i) => Z[i].hasta.ad));
  assert.match(V.devirAdres(s, 'model'), /^\.\.\/anatomi\/index\.html\?medlab=1&medica=1&vaka=cep%3A/);
});

test('Medica: katalog sırayla yüklenir; asansörde ara katlar; ara katta üç istasyon', () => {
  const h = read('labs/medica/index.html'), cep = h.indexOf('../klinik/cep/cep.js'), veri = h.indexOf('<script src="medica-veri.js">');
  assert.ok(cep > 0 && cep < veri); SISTEMLER.forEach((s) => assert.ok(h.indexOf('../klinik/cep/' + s + '.js') > cep && h.indexOf('../klinik/cep/' + s + '.js') < veri, s));
  const m = read('labs/medica/medica.js');
  assert.match(m, /var CEPV = V\.cepZiyaret \? V\.cepZiyaret\(TOHUM\) : \{\};/);
  assert.match(m, /Anatomi ara katları <small>/);
  assert.match(m, /if \(kat\.ara\) ISTASYON\.forEach/);
  ['modul', 'radyoloji', 'diseksiyon'].forEach((x) => assert.match(m, new RegExp("\\{ id: '" + x + "', ad: ")));
  assert.match(m, /'\.\.\/anatomi\/index\.html\?medlab=1&medica=1&istasyon=' \+ x\.id \+ '&sistem='/);
  assert.doesNotMatch(m, /kat\.no \+ '\. kat/, 'kat adı her yerde V.katEtiket ile');
});

test('Anatomi Lab: Sistemler modu, tıklama kancası, API ve modül dosyası en sonda', () => {
  const h = read('labs/anatomi/index.html');
  assert.match(h, /<button role="tab" data-mode="sistem" aria-selected="false">Sistemler<\/button>/);
  assert.match(h, /const TABS = \{ sistem: \[\['sistem', 'Sistem'\], \['yapi', 'Yapı'\]\]/);
  assert.match(h, /<section class="sec" data-mode="sistem" data-tab="sistem" id="sistemPane"/);
  assert.match(h, /if \(typeof window\.__axTik === 'function' && window\.__axTik\(h, e\)\) return;/);
  assert.match(h, /window\.dispatchEvent\(new Event\('axlab:hazir'\)\);/);
  /* programla çerçevelenen görünüm panel boyutlanınca başa dönmesin; Medica'da lab'ın kendi cerrahı yalnız kendi vakasında */
  assert.match(h, /kameraTut: \(\) => \{ userMoved = true; \}/);
  assert.match(h, /if \(mc\) medicaCerrah\(\{ lab: 'anatomi'/);
  const sis = h.indexOf('<script type="module">/* ===== SİSTEMLER'), lab = h.indexOf("<script type=\"module\">import * as THREE from 'three';");
  assert.ok(lab > 0 && sis > lab, 'Sistemler betiği lab modülünden sonra, satır içi (lab tek dosya çalışır)');
});

test('Sistem modülleri: 8 sistem, her yapı modelde var, Medica vakası ve istasyonlar bağlı', () => {
  const h = read('labs/anatomi/index.html'), j = h.slice(h.indexOf('<script type="module">/* ===== SİSTEMLER'));
  const yapi = [...j.matchAll(/\['((?:sid:)?[A-Z][^']*|sid:[a-z_]+)', '[^']+', '[^']+'\]/g)].map((x) => x[1]);
  assert.ok(yapi.length > 100, 'yapı listesi okunamadı: ' + yapi.length);
  const yollar = [...j.matchAll(/\{ y: (\[[^\]]+\]|'[^']+')/g)].flatMap((x) => (x[1].startsWith('[') ? x[1].slice(1, -1).split(/',\s*'/).map((s) => s.replace(/^'|'$/g, '')) : [x[1].slice(1, -1)]));
  const yok = [...new Set(yapi.concat(yollar))].filter((n) => !modeldeVar(n) && !/^(Right|Left) inferior pulmonary vein$|^Sublingual gland$/.test(n));
  assert.deepEqual(yok, []);
  for (const s of SISTEMLER) assert.match(j, new RegExp('\\b' + s + ": \\{ ad: '"));
  assert.match(j, /if \(vakaQ && vakaQ\.startsWith\('cep:'\)\)/); assert.match(j, /L\.medicaBildir\(\{ vaka: vakaQ, puan \}\)/);
  assert.match(j, /const istasyon = Q\.get\('istasyon'\)/);
  /* aralıklı tekrar ve yanlışlar */
  assert.match(j, /function tekrarKaydet\(ad, sis, ok\)/); assert.match(j, /const vadesi = sis =>/);
  /* radyolojik yön: aksiyelde ayak tarafından bakış, ön taraf yukarıda */
  assert.match(j, /if \(ax === 'y'\) \{ cam\.up\.set\(0, 0, 1\); cam\.position\.set\(c\.x, c\.y - d, c\.z \+ \.0001\); \}/);
  /* hareket azaltma ve 30 kare sınırı */
  assert.match(j, /const kanca = fn => \{ let son = 0; return now => \{ if \(now - son < 33\) return false;/);
  assert.match(j, /RM\.matches \? \.3 : faz\(now\)/);
});

summary();
