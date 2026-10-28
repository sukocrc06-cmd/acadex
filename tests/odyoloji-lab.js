/* ==========================================================================
   ACADEX — MEDLAB ODYOLOJİ LAB TESTLERİ (tests/odyoloji-lab.js)

   NEDEN VAR (29.10.2026): MedLab'e Odyoloji Lab eklendi (labs/odyoloji/):
   sanal odyometri kabini, 3B kulak ve işitme yolu, klinik vaka masası.
   Klinik doğruluk bu testlerle korunur:
     - her sanal hastanın cevap anahtarı (tip, derece) modelin hesabıyla tutarlı
     - çapraz işitme (IA hava 40 / kemik 0 dB) ve maskeleme: maskesiz ölçüm gölge
       eğri verir, yeterli maske gerçek eşiği verir, aşırı maske işaretlenir
     - odyogram puanlama gölge eğriyi ayrı yakalar; vaka puanlama gerekli /
       gereksiz testleri ayırır
     - 3B veri yalnız kulak ve işitme yolu parçalarını içerir, lisans dosyası var
     - MedLab katmanı ve Acadia köprüsü labı tanır; ses uyarısı ve "kalibre değil"
       ibaresi sayfada
   Çalıştırma:  node tests/odyoloji-lab.js
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
const A = require(path.join(ROOT, 'labs/odyoloji/odyo-model.js'));
const fixed = (v) => () => v;

test('model: her hastanın cevap anahtarı SSO derecesi ve tip hesabıyla tutarlı', () => {
  const ids = Object.keys(A.P); assert.ok(ids.length >= 9);
  for (const id of ids) for (const e of ['R', 'L']) {
    const p = A.P[id];
    assert.equal(A.derece(A.sso(p.ac[e])), p.ans[e].derece, id + ' ' + e + ' derece');
    assert.equal(A.tip(p.ac[e], p.bc[e]), p.ans[e].tip, id + ' ' + e + ' tip');
    assert.ok(A.KONF[p.ans[e].konf], id + ' konfigürasyon etiketi');
    for (const f of A.BC_FREQS) assert.ok(p.bc[e][f] <= p.ac[e][f], id + ' ' + e + ' ' + f + ': kemik yolu havadan kötü olamaz');
  }
});
test('model: Clark sınırları ve tip kuralları', () => {
  assert.equal(A.derece(15), 'normal'); assert.equal(A.derece(16), 'cok_hafif'); assert.equal(A.derece(40), 'hafif');
  assert.equal(A.derece(55), 'orta'); assert.equal(A.derece(70), 'orta_ileri'); assert.equal(A.derece(90), 'ileri'); assert.equal(A.derece(91), 'cok_ileri');
  const r = (a) => ({ 500: a, 1000: a, 2000: a });
  assert.equal(A.tip(r(40), r(5)), 'iletim'); assert.equal(A.tip(r(40), r(35)), 'sensorinoral'); assert.equal(A.tip(r(60), r(30)), 'mikst'); assert.equal(A.tip(r(10), r(5)), 'normal');
});
test('model: çapraz işitme ve maskeleme (ani işitme kaybı, sol 1 kHz)', () => {
  const p = A.P.ani;
  // maskesiz: sol kulak eşiği 65, ama 50 dB'de sağ koklea (10) + IA 40 duyar → gölge eğri
  assert.equal(A.unmaskedSeen(p, 'L', 'ac', 1000), 50);
  const r1 = A.respond(p, { ear: 'L', mode: 'ac', f: 1000, L: 55, mask: { on: false } }, fixed(0.5));
  assert.equal(r1.heard, true); assert.equal(r1.via, 'cross');
  // yeterli maske (50 dB EM): 55'te duymaz, 70'te test kulağıyla duyar
  assert.equal(A.respond(p, { ear: 'L', mode: 'ac', f: 1000, L: 55, mask: { on: true, M: 50 } }, fixed(0.01)).heard, false);
  const r2 = A.respond(p, { ear: 'L', mode: 'ac', f: 1000, L: 70, mask: { on: true, M: 50 } }, fixed(0.99));
  assert.equal(r2.heard, true); assert.equal(r2.via, 'test');
  // aşırı maske: 110 dB EM test kokleasına geçer
  assert.equal(A.effective(p, { ear: 'L', mode: 'ac', f: 1000, L: 0, mask: { on: true, M: 110 } }).overmask, true);
  // kemik yolu: IA 0 → maskesiz kemik yanıtını iyi kulak verir
  assert.equal(A.unmaskedSeen(p, 'L', 'bc', 1000), 10);
  assert.equal(A.needMask(p, 'L', 'bc', 1000), true); assert.equal(A.needMask(p, 'L', 'ac', 1000), true); assert.equal(A.needMask(p, 'R', 'ac', 1000), false);
});
test('model: psikometrik yanıt eşik çevresinde kademeli, cihaz sınırında yanıt yok', () => {
  assert.equal(A.prob(5), 1); assert.equal(A.prob(0), 0.75); assert.equal(A.prob(-5), 0.15); assert.equal(A.prob(-10), 0);
  const p = A.P.normal;
  assert.equal(A.respond(p, { ear: 'R', mode: 'ac', f: 1000, L: -10, mask: { on: false } }, fixed(0)).heard, false);
  assert.equal(A.respond(p, { ear: 'R', mode: 'bc', f: 8000, L: 40, mask: { on: false } }).noStim, true, '8 kHz kemik yolu yok');
});
test('model: başlangıç hastalarında maskeleme gerekmez, ileri hastalarda gerekir', () => {
  const need = (p) => A.SCOPE.filter((s) => A.needMask(p, s[0], s[1], s[2])).length;
  for (const p of Object.values(A.P)) {
    if (p.seviye === 1) assert.equal(need(p), 0, p.id);
    if (p.seviye === 3) assert.ok(need(p) >= 8, p.id);
  }
});
test('puanlama: kusursuz odyogram %100; maskesiz gölge eğri ayrı yakalanır', () => {
  const p = A.P.ani, perfect = {}, shadow = {};
  A.SCOPE.forEach((s) => { const k = s.join('.'), t = A.truth(p, s[0], s[1], s[2]); perfect[k] = { L: t, masked: A.needMask(p, s[0], s[1], s[2]) }; shadow[k] = { L: A.needMask(p, s[0], s[1], s[2]) ? A.unmaskedSeen(p, s[0], s[1], s[2]) : t, masked: false }; });
  assert.equal(A.grade(p, perfect).pct, 100);
  const g = A.grade(p, shadow), gol = g.rows.filter((r) => r.res === 'golge');
  assert.ok(gol.length >= 8, 'gölge noktaları: ' + gol.length);
  assert.ok(gol.every((r) => r.ear === 'L'));
});
test('vaka masası: 9 vaka; doğru cevaplar listede; puan gerekli/gereksiz testleri ayırır', () => {
  assert.equal(A.CASES.length, 9);
  for (const c of A.CASES) {
    assert.ok(c.tani[c.dogru] && c.yon[c.dyon] && c.not, c.id);
    for (const t of (c.gerekli || []).concat(c.yararli || [], c.gereksiz || [])) assert.ok(A.TESTS[t], c.id + ' bilinmeyen test ' + t);
    if (c.hasta) assert.ok(A.P[c.hasta], c.id + ' hasta');
    if (c.sonuc.timpanometri) for (const e of ['R', 'L']) assert.ok(A.TIMP[c.sonuc.timpanometri[e]], c.id + ' timpanogram tipi');
    const full = A.gradeCase(c, c.gerekli, c.dogru, c.dyon); assert.equal(full.puan, 100, c.id);
    if (c.gereksiz && c.gereksiz.length) assert.ok(A.gradeCase(c, c.gerekli.concat(c.gereksiz), c.dogru, c.dyon).puan < 100, c.id + ' gereksiz test cezası');
    assert.ok(A.gradeCase(c, [], (c.dogru + 1) % 4, c.dyon).puan <= 25, c.id);
  }
  const ansd = A.CASES.find((c) => c.id === 'v-ansd');
  assert.deepEqual(ansd.gerekli.sort(), ['abr', 'oae'], 'işitsel nöropati: OAE + ABR şart');
});
test('3B veri: yalnız kulak ve işitme yolu parçaları; lisans ve kaynak notu', () => {
  const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'labs/odyoloji/data/ax-kulak.js'), 'utf8'), ctx);
  const AXD = ctx.window.AXD, buf = Buffer.from(AXD.kulak, 'base64'), jl = buf.readUInt32LE(0), items = JSON.parse(buf.subarray(4, 4 + jl).toString());
  const OK = /^(Malleus|Incus|Stapes|Temporal bone|Tympanic membrane|Cochlea|Vestibule|Auditory tube|Anterior cochlear nucleus|Posterior cochlear nucleus|Vestibular nuclei|Olive|Inferior colliculus|Medial geniculate body|Transverse temporal gyri|Superior temporal gyrus \(Lateral part\)|Pons|Medulla oblongata|Midbrain|Cochlear nerve|Chorda tympani|Facial nerve \(VII\)|Vestibular nerve|Vestibulocochlear nerve \(VIII\))(\.[lr])?$/;
  assert.ok(items.length >= 30); for (const it of items) assert.match(it.n, OK);
  for (const t of AXD.kulakTubes) assert.match(t.n, OK);
  assert.ok(fs.statSync(path.join(ROOT, 'labs/odyoloji/data/ax-kulak.js')).size < 300 * 1024, 'küçük kalmalı');
  assert.match(read('labs/odyoloji/data/LISANS.txt'), /CC BY-SA 4\.0/);
  assert.match(read('labs/odyoloji/index.html'), /Z-Anatomy · BodyParts3D \(DBCLS\) · CC BY-SA 4\.0/);
});
test('sayfa: kalibre değil uyarısı, ses onayı, üç sekme ve modül bağlantıları', () => {
  const h = read('labs/odyoloji/index.html'), app = read('labs/odyoloji/odyo-app.js');
  assert.match(h, /kalibre değil · eğitim amaçlı/); assert.match(h, /id="snd-modal"/); assert.match(h, /Bu bir işitme testi değil/);
  for (const t of ['kabin', 'kulak', 'vaka']) assert.match(h, new RegExp('data-tab="' + t + '"'));
  for (const s of ['odyo-model.js', 'odyo-app.js', 'odyo-kulak.js']) assert.ok(h.includes(s), s);
  assert.match(app, /var amp = function \(hl\) \{ return Math\.min\(1,/); /* genlik üst sınırı */
  assert.match(app, /snd\.vol \/ 100 \* 0\.35/);                              /* ana kazanç üst sınırı */
  assert.match(app, /if \(!snd\.on \|\| !snd\.ok\) return;/);                 /* onaysız ses çalmaz */
});
test('MedLab: kart, katman kaydı ve Acadia köprüsü Odyoloji Lab\'i tanır', () => {
  assert.match(read('dashboard.html'), /data-medlab-open="odyoloji"/);
  assert.match(read('js/acadex-medlab.js'), /odyoloji: \{ t: 'Odyoloji Lab', src: 'labs\/odyoloji\/index\.html' \}/);
  const br = read('js/acadex-medlab-acadia.js');
  assert.match(br, /odyoloji: 'Odyoloji Lab'/); assert.match(br, /s\.about \?/);
  assert.ok(fs.existsSync(path.join(ROOT, 'assets/medlab/odyoloji-lab-kapak.jpg')));
  const app = read('labs/odyoloji/odyo-app.js');
  assert.match(app, /m\.src = 'axlab'; m\.lab = 'odyoloji'/); assert.match(app, /e\.origin !== ORG \|\| e\.source !== W\.parent/);
});
summary();
