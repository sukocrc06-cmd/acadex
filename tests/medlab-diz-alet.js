/* ==========================================================================
   tests/medlab-diz-alet.js · 27.11.2026
   - Anatomi Lab "Diz": iskelet modelindeki kemikler rafa dizilir; sayım 206'ya çıkar
     (göğüs kemiği 3 parça = 1 kemik, ayak sesamoidleri sayılmaz, dişler ve kıkırdaklar dizilmez)
   - Klinik karakterleri: gerçek göz (.bebek), her çizimin kendi gradyan kimliği, eski sınıflar duruyor
   - Sesli görüşme: hasta konuşurken mikrofon açılmaz; hata mesajları Türkçe
   - Medica alet dolabı: 8 muayene aleti, çizim + numaralı parçalar çizim içinde, adımlar, sınav soruları
   Çalıştırma:  node tests/medlab-diz-alet.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();

const anat = read('labs/anatomi/index.html');
const kemikAdlari = () => {
  const ctx = { window: {} }; new Function('window', read('labs/anatomi/data/ax-iskelet.js'))(ctx.window);
  const b = Buffer.from(ctx.window.AXD.iskelet, 'base64'), jl = b.readUInt32LE(0);
  return JSON.parse(b.subarray(4, 4 + jl).toString()).map(i => i.n);
};
const dizKurali = () => {
  const a = anat.indexOf('const DIZ_RAF = ['), b = anat.indexOf('const dizRaf = ');
  assert.ok(a > 0 && b > a, 'DIZ_RAF tanımı bulunamadı');
  const DIZ = { kume: 'iskelet' };
  return Object.assign(new Function('DIZ', anat.slice(a, b) + '\nreturn { DIZ_RAF, DIZ_DISI, dizAgirlik, KUME };')(DIZ), { DIZ });
};
const adlar = (sys) => {
  const ctx = { window: {} }; new Function('window', read('labs/anatomi/data/ax-' + sys + '.js'))(ctx.window);
  const b = Buffer.from(ctx.window.AXD[sys], 'base64'), jl = b.readUInt32LE(0);
  return JSON.parse(b.subarray(4, 4 + jl).toString()).map(i => i.n);
};

test('Diz: modeldeki kemikler 9 rafa dağılır ve sayım tam 206', () => {
  const { DIZ_RAF, DIZ_DISI, dizAgirlik } = dizKurali(), adlar = kemikAdlari();
  const rafli = adlar.filter(n => !DIZ_DISI.test(n));
  const yersiz = rafli.filter(n => DIZ_RAF.findIndex(r => r[1].test(n)) < 0);
  assert.deepEqual(yersiz, [], 'rafı olmayan kemik');
  const iki = rafli.filter(n => DIZ_RAF.filter(r => r[1].test(n)).length > 1);
  const ilk = n => DIZ_RAF.findIndex(r => r[1].test(n));
  assert.ok(iki.every(n => ilk(n) >= 0));
  assert.equal(rafli.reduce((t, n) => t + dizAgirlik(n), 0), 206);
  const say = DIZ_RAF.map((r, i) => rafli.filter(n => ilk(n) === i).reduce((t, n) => t + dizAgirlik(n), 0));
  assert.deepEqual(say, [8, 14, 7, 26, 25, 10, 54, 10, 52], 'raf sayıları (kafatası 8, yüz 14, kulak+dil 7, omurga 26, göğüs 25, omuz-kol 10, el 54, leğen-bacak 10, ayak 52)');
  assert.ok(adlar.filter(n => DIZ_DISI.test(n)).every(n => /tooth|incisor|canine|premolar|cartilage|Sinus|cells of ethmoid/.test(n)));
});

test('Organ dizilimi: 55 parça 8 sisteme dağılır; zarlar ve karaciğer segmentleri dizilmez', () => {
  const { KUME, DIZ } = dizKurali(), K = KUME.organ, A = adlar('organ'); DIZ.kume = 'organ';
  const rafli = A.filter(n => !K.disi.test(n)), ilk = n => K.raf.findIndex(r => r[1].test(n));
  assert.deepEqual(rafli.filter(n => ilk(n) < 0), [], 'sistemi olmayan organ');
  assert.deepEqual(K.raf.map((r, i) => rafli.filter(n => ilk(n) === i).length), [9, 3, 7, 3, 8, 5, 10, 10]);
  assert.ok(A.filter(n => /segment of liver/.test(n)).every(n => K.disi.test(n)), 'segmentler tüm karaciğerle çakışmasın');
  assert.ok(['Liver', 'Stomach', 'Trachea', 'Kidney.l', 'Thyroid gland'].every(n => ilk(n) >= 0));
});

test('Yerine koy oyunu: sürükleme yalnız raftaki parçada, doğru bırakma ekran uzaklığıyla; ikinci hatada ipucu', () => {
  assert.match(anat, /if \(!DIZ\.on \|\| !DIZ\.oyun \|\| e\.button !== 0 \|\| e\.target !== el\) return;/);
  assert.match(anat, /if \(!h \|\| !DIZ\.rafta\.has\(h\.mesh\) \|\| DIZ\.ucan\.has\(h\.mesh\)\) return;/);
  assert.match(anat, /e\.stopPropagation\(\); e\.preventDefault\(\);/, 'sürüklerken kamera dönmez');
  assert.match(anat, /if \(d <= tol\) \{/); assert.match(anat, /if \(n >= 2\) \{ dizIpucu\(hedef\);/);
  assert.match(anat, /controls\.enabled = true; dizIpucu\(null\);/, 'kapanınca kamera serbest');
  assert.match(anat, /applyVis\(\); dizBar\(\);   \/\* solma yok/, 'yeni görünen organlar hemen tıklanabilir (solma sırasında pickables dışında kalıyordu)');
});

test('Diz: düğme, tıklama kancası, görünürlük kancası ve kapanışta konumlar sıfırlanır', () => {
  assert.match(anat, /<button id="dizBtn" aria-pressed="false"[^>]*>Diz<\/button>/); assert.match(anat, /data-kume="iskelet"[\s\S]*data-kume="organ"/);
  assert.match(anat, /if \(window\.__axDiz && window\.__axDiz\.on && window\.__axDiz\.tik\(h\)\) return;/);
  assert.match(anat, /if \(window\.__axDiz && window\.__axDiz\.on\) \{ if \(window\.__axDiz\.set\.has\(m\)\) \{ on = true; a = 1; \} else on = false; \}/);
  assert.match(anat, /DIZ\.list\.forEach\(m => \{ m\.position\.set\(0, 0, 0\); m\.scale\.setScalar\(1\); m\.userData\._diz = null; \}\);/);
  assert.match(anat, /if \(on && DIZ\.on\) return;/, 'dizilim açıkken Patlat çalışmaz');
  assert.match(anat, /if \(DIZ\.maxD\) controls\.maxDistance = DIZ\.maxD;/, 'kamera sınırı geri gelir');
  assert.doesNotMatch(anat, /window\.__cam|window\.__proj/, 'test yardımcıları kalmamalı');
});

/* çizim fonksiyonları tarayıcı dalında: en küçük belge taklidiyle yüklenir */
const K = (() => { const W = { matchMedia: () => ({ matches: false }) }, D = { createElement: () => ({ set textContent(v) {} }), head: { appendChild() {} }, getElementById: () => null };
  const self = {}; new Function('self', 'window', 'document', 'module', read('labs/klinik/klinik.js'))(self, W, D, undefined); return self.AXKLINIK; })();
test('karakter: gerçek göz, ayrı gradyan kimlikleri, eski sınıflar', () => {
  const a = K.kisi({ x: 0, y: 0, cins: 'K', ifade: 'agri' }), b = K.kisi({ x: 0, y: 0, rol: 'mentor', cins: 'E', ic: '#2F6BFF', flip: true });
  for (const s of [a, b]) {
    for (const c of ['class="kisi', 'class="breath"', 'class="kolL"', 'class="kolR"', 'class="bas"', 'class="blink"', 'class="bebek"', 'class="mouth"', 'data-yz="normal"', 'data-yz="agri"']) assert.ok(s.includes(c), c);
  }
  const ids = s => [...s.matchAll(/id="(kq\d+)t"/g)].map(m => m[1]);
  assert.equal(ids(a).length, 1); assert.notEqual(ids(a)[0], ids(b)[0], 'her çizimin kendi gradyanı');
  assert.ok(a.includes('url(#' + ids(a)[0] + 't)'));
  assert.match(a, /data-yz="agri">/); assert.match(a, /data-yz="normal" display="none"/);
  const y = K.yatan({ x: 0, y: 0, ifade: 'normal' }); assert.ok(y.includes('class="bebek"'));
  assert.ok(!K.yatan({ x: 0, y: 0, ifade: 'uyku' }).includes('class="bebek"'), 'uyuyan hastanın gözü kapalı');
});

const kl = read('labs/klinik/klinik.js');
test('sesli görüşme: hasta konuşurken mikrofon açılmaz, ağız ses bitene kadar oynar, Türkçe hata', () => {
  assert.match(kl, /if \(\(W\.speechSynthesis && \(W\.speechSynthesis\.speaking \|\| W\.speechSynthesis\.pending\)\) \|\| n\+\+ < 3\) return;/);
  assert.match(kl, /'not-allowed': 'Mikrofon izni yok\./);
  assert.match(kl, /'no-speech': 'Sesini duyamadım\./);
  assert.match(kl, /S\.sesli = u; u\.onend = u\.onerror = sus;/);
  assert.match(kl, /if \(!u\) konusan\(kim, false\);/);
  assert.match(kl, /clearInterval\(S\.sgT\); clearTimeout\(BAK\.z\);/, 'kapanınca dinleme ve bakış zamanlayıcıları durur');
  assert.match(kl, /W\.localStorage\.getItem\('axk\.sesgor'\) === '1'/);
});

test('Medica: hastane içindeki Aletler paneli kaldırıldı; aletler Cihaz Deposu’nda', () => {
  const med = read('labs/medica/index.html');
  assert.doesNotMatch(med, /id="md-alet"/); assert.doesNotMatch(med, /medica-alet\.js/);
});

/* ---------------- Cihaz Deposu ---------------- */
const DEPO_JS = ['depo-veri.js', 'depo-muayene.js', 'depo-ek-1.js', 'depo-ek-2.js', 'depo-ek-3.js', 'depo-ek-4.js', 'depo-sim.js'];
const depoYukle = () => { const W = {}; new Function('window', 'globalThis', DEPO_JS.map(f => read('labs/depo/' + f)).join('\n'))(W, W); return W; };
test('Cihaz Deposu: 11 bölüm, 250 cihaz; her cihazın içeriği ve parçaları çizimin içinde', () => {
  const W = depoYukle(), V = W.AXDEPO;
  assert.equal(V.BOLUM.length, 11); assert.equal(V.CIHAZ.length, 250);
  const ids = new Set(); V.CIHAZ.forEach(c => {
    assert.ok(!ids.has(c.id), 'tekrar: ' + c.id); ids.add(c.id); assert.match(c.id, /^[a-z0-9-]+$/, 'url için güvenli kimlik: ' + c.id);
    assert.ok(V.BOLUM.some(b => b.id === c.b), c.id + ' bölüm');
    assert.ok(c.ciz && c.ciz.length > 80 && !/undefined|NaN/.test(c.ciz) && c.ne.length > 60 && c.adim.length >= 3 && c.dikkat.length >= 1, c.id + ' içerik');
    (c.parca || []).forEach(p => assert.ok(p[1] >= 4 && p[1] <= 236 && p[2] >= 4 && p[2] <= 158, c.id + ' parça konumu ' + p[0]));
  });
  V.BOLUM.forEach(b => assert.ok(V.CIHAZ.filter(c => c.b === b.id).length >= 12, b.id + ' en az 12 cihaz'));
  const sims = V.CIHAZ.filter(c => c.sim).map(c => c.sim).sort();
  assert.deepEqual(sims, ['defib', 'enj', 'gluko', 'gonyo', 'odyo', 'pompa', 'vent']);
  sims.forEach(s => assert.equal(typeof W.DEPOSIM[s].baslat, 'function'));
  const html = read('labs/depo/index.html'), sira = DEPO_JS.map(f => html.indexOf('<script src="' + f + '"></script>'));
  assert.ok(sira.every((v, i) => v > 0 && (i === 0 || v > sira[i - 1])), 'depo betikleri sırayla yüklenir');
});

test('Cihaz Deposu simülasyon hesapları: İVA, hız, damla, hacim, enjektör, fleksiyon', () => {
  const H = depoYukle().DEPOSIM.hesap;
  assert.equal(H.iva('E', 180), 75.1); assert.equal(H.iva('K', 160), 52.4);
  assert.equal(H.hiz(1000, 8), 125); assert.equal(H.hiz(100, 0.5), 200);
  assert.equal(H.damla(1000, 480, 20), 42); assert.equal(H.damla(500, 360, 60), 83);
  assert.equal(H.hacim(750, 250), 3); assert.equal(H.hacim(300, 24), 12.5); assert.equal(H.hacim(4, 10), 0.4);
  assert.equal(H.enjektor(0.4), 1); assert.equal(H.enjektor(2), 3); assert.equal(H.enjektor(12.5), 20);
  assert.equal(H.fleksiyon([80, 150], [250, 150], [410, 150]), 0, 'düz diz 0°');
  assert.equal(H.fleksiyon([80, 150], [250, 150], [250, 310]), 90);
});

test('Cihaz Deposu MedLab’e bağlı: kart, lab kaydı, kampüs turu durağı', () => {
  const dash = read('dashboard.html'), ml = read('js/acadex-medlab.js'), idx = read('index.html');
  assert.match(dash, /data-medlab-open="depo"/); assert.match(ml, /depo: \{ t: 'Cihaz Deposu', src: 'labs\/depo\/index\.html' \}/);
  assert.match(idx, /<article class="kt-st" data-st="dpo"/); assert.match(idx, /data-kt-git="9" aria-label="Acadex Medica durağına git"/);
  const sim = read('labs/depo/depo-sim.js'); assert.doesNotMatch(sim, /data-c[ =]/, 'depo.js [data-c] ile kart açar; simülasyon bu adı kullanmamalı');
  assert.doesNotMatch(read('labs/depo/index.html'), /medica-alet\.js/);
  assert.match(dash, /250 alet ve cihaz/); assert.match(idx, /<li>250 alet ve cihaz, 11 bölüm<\/li>/);
});

summary();
