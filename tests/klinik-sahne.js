/* ==========================================================================
   ACADEX — KLİNİK SAHNE TESTLERİ (tests/klinik-sahne.js)

   NEDEN VAR (31.10.2026): MedLab vakaları animasyonlu bir odada (poliklinik, ameliyathane,
   acil/yoğun bakım, bölüm odaları) oynanabiliyor: labs/klinik/klinik.js ortak motor,
   senaryo-diyet.js (Diyet Lab, 14 vaka) ve senaryo-anatomi.js (Anatomi + Fizyo, 5 vaka).
     - Sahnedeki klinik veri lab'daki vakayla AYNI olmalı (yaş, ağırlık, biyokimya);
       senaryo ile model ayrışırsa öğrenci odada başka, formda başka hasta görür.
     - Her senaryo lab'daki bir vakaya bağlanmalı; devirde Diyet'te reçete/EP formu,
       Anatomi/Fizyo'da 3B vaka açılır.
     - Puanlama: kusursuz görüşme 100; yargılayıcı soru ve zararlı eylem puan düşürür.
     - Erişilebilirlik: diyalog rolü, Esc ile kapanma, hareket azaltma tercihinde animasyon yok.

   Calistirma:  node tests/klinik-sahne.js
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

const ctx = { window: {} };
vm.runInNewContext(read('labs/diyet/data/besin.js'), ctx);
vm.runInNewContext(read('labs/diyet/data/who2007-bki.js'), ctx);
const M = require(path.join(ROOT, 'labs/diyet/diyet-model.js')); M.load(ctx.window.AXDB);
const K = require(path.join(ROOT, 'labs/klinik/klinik.js'));
const DYT = require(path.join(ROOT, 'labs/klinik/senaryo-diyet.js'))(M);
const ANA = require(path.join(ROOT, 'labs/klinik/senaryo-anatomi.js'));
const kusursuz = (s) => {
  const sec = {};
  s.adimlar.forEach((a, i) => {
    if (a.tip === 'sor' || a.tip === 'eylem') { const pos = a.secenek.filter((o) => o.puan > 0).sort((x, y) => y.puan - x.puan); sec[i] = (a.hak ? pos.slice(0, a.hak) : pos).map((o) => o.id); }
    if (a.tip === 'karar') sec[i] = a.secenek.findIndex((o) => o.dogru);
  });
  return sec;
};

test('motor: şema denetimi bütün senaryolarda temiz', () => {
  const all = DYT.concat(ANA);
  assert.equal(all.length, 27);   /* 31.10.2026: Acadex Medica için Diyet +4, Anatomi +4 */
  for (const s of all) assert.deepEqual(K.denetle(s), [], s.id);
  assert.equal(new Set(all.map((s) => s.id)).size, all.length, 'benzersiz id');
});

test('puanlama: kusursuz 100, boş 0, yargılayıcı soru ve zararlı eylem puan düşürür', () => {
  for (const s of DYT.concat(ANA)) assert.equal(K.puanla(s, kusursuz(s)).puan, 100, s.id);
  const s = DYT.find((x) => x.id === 'dyt-v-dm');
  assert.equal(K.puanla(s, {}).puan, 0);
  const i = s.adimlar.findIndex((a) => a.tip === 'sor'), sec = kusursuz(s);
  sec[i] = sec[i].slice(0, 3).concat(['yargi']);
  assert.ok(K.puanla(s, sec).puan < 100, 'yargılayıcı soru');
  const inme = DYT.find((x) => x.id === 'dyt-e-inme'), j = inme.adimlar.findIndex((a) => a.tip === 'eylem'), s2 = kusursuz(inme);
  s2[j] = s2[j].concat(['bolus']);
  assert.ok(K.puanla(inme, s2).puan < 100, 'yoğun bakımda hızlı bolus');
  const r = K.puanla(s, Object.assign(kusursuz(s), { [i]: ['aile'] }));
  assert.ok(r.rows[0].kacan.length >= 2, 'kaçan önemli sorular listelenir');
});

test('Diyet: her vaka ve EP vakası sahnede; klinik veri modelle aynı', () => {
  const ids = new Set(DYT.map((s) => s.vaka));
  for (const v of M.VK) assert.ok(ids.has(v.id), 'sahnesi yok: ' + v.id);
  for (const c of M.EP) assert.ok(ids.has(c.id), 'sahnesi yok: ' + c.id);
  for (const s of DYT) {
    const v = M.VK.find((x) => x.id === s.vaka) || M.EP.find((x) => x.id === s.vaka);
    assert.equal(s.hasta.yas, v.yas, s.id + ' yaş'); assert.equal(s.hasta.cins, v.cins, s.id + ' cinsiyet');
    const ey = s.adimlar.find((a) => a.tip === 'eylem');
    const t = ey.secenek.find((o) => o.id === 'tarti'); if (t) assert.equal(t.deger, String(v.kg).replace('.', ',') + ' kg', s.id + ' tartı');
    const f = ey.secenek.find((o) => o.id === 'fis' || (o.id === 'lab' && v.lab));
    if (f && v.lab) for (const l of v.lab) assert.ok(f.sonuc.includes(l[0]), s.id + ' fişte ' + l[0]);
    assert.equal(s.adimlar[s.adimlar.length - 1].hedef, M.EP.includes(v) ? 'ep' : 'recete', s.id + ' devir');
  }
});

test('Diyet: mentor kararları kılavuzlarla uyumlu', () => {
  const dogru = (id) => DYT.find((s) => s.id === id).adimlar.find((a) => a.tip === 'karar').secenek.find((o) => o.dogru).t;
  assert.match(dogru('dyt-v-nefrotik'), /0,8–1,0 g\/kg/);
  assert.match(dogru('dyt-v-hd'), /1,0–1,2 g\/kg/);
  assert.match(dogru('dyt-v-siroz'), /1,2–1,5 g\/kg/);
  assert.match(dogru('dyt-v-gdm'), /175 g/);
  assert.match(dogru('dyt-v-ped-osteo'), /%13/);
  assert.match(dogru('dyt-e-refeed'), /10 kcal\/kg/);
  assert.match(dogru('dyt-v-colyak'), /ömür boyu/);
});

test('Anatomi/Fizyo: senaryolar iki sayfadaki CASES ile eşleşir, devir 3B modele', () => {
  for (const p of ['labs/anatomi/index.html', 'labs/fizyo/index.html']) {
    const h = read(p), i = h.indexOf('const CASES = ['), cases = [...h.slice(i, h.indexOf('];', i)).matchAll(/\{ id: '([a-z]+)'/g)].map((m) => m[1]);
    assert.deepEqual(ANA.map((s) => s.vaka).sort(), cases.slice().sort(), p);
    /* sayfa kendi başına çalışmalı (tests/medlab.js): motor src= ile değil, varsa JS ile yüklenir */
    assert.match(h, /var y = \['\.\.\/klinik\/klinik\.js', '\.\.\/klinik\/senaryo-anatomi\.js'\]/, p + ' motor sırayla yüklenir');
    assert.match(h, /s\.onerror = function \(\) \{\}/, p + ' motor yoksa sessiz');
    assert.match(h, /window\.addEventListener\('axklinik:hazir', \(\) => renderCases\(\)\)/, p + ' yüklenince liste tazelenir');
    assert.match(h, /data-sahne-case="\$\{c\.id\}"/, p + ' vaka listesinde sahne düğmesi');
    assert.match(h, /AXKLINIK\.open\('ana-' \+ c\.id, \{ onDevir: async \(\) => \{ await startCase\(c\); CASE\.sahne = true; \} \}\)/);
    assert.match(h, /if \(CASE\.sahne\) \{ CASE\.sahne = false; kapanis\(CASE\.c\); \}/, p + ' çözünce kapanış');
  }
  for (const s of ANA) assert.equal(s.adimlar[s.adimlar.length - 1].hedef, 'model');
});

test('Diyet Lab sayfası: betik sırası ve sahne çağrısı', () => {
  const h = read('labs/diyet/index.html'), at = (f) => h.indexOf('src="' + f + '"');
  assert.ok(at('diyet-model.js') < at('../klinik/klinik.js') && at('../klinik/klinik.js') < at('../klinik/senaryo-diyet.js') && at('../klinik/senaryo-diyet.js') < at('diyet-klinik.js'));
  const k = read('labs/diyet/diyet-klinik.js');
  assert.match(k, /W\.AXKLINIK\.open\('dyt-' \+ id,/); assert.match(k, /sahneBtn\(v\.id\)/); assert.match(k, /sahneBtn\(c\.id\)/);
  assert.match(k, /ls\.set\('sahneDone', sahneDone\)/);
});

test('odalar ve erişilebilirlik', () => {
  const src = read('labs/klinik/klinik.js');
  for (const o of ['poliklinik', 'ameliyathane', 'acil', 'diyet', 'odyo', 'dkt', 'fizyo']) assert.match(src, new RegExp('\\n    ' + o + ': function \\(\\) \\{'), 'oda: ' + o);
  assert.match(src, /setAttribute\('role', 'dialog'\)/); assert.match(src, /setAttribute\('aria-modal', 'true'\)/);
  assert.match(src, /e\.key === 'Escape'/); assert.match(src, /aria-live="polite"/);
  assert.match(src, /@media \(prefers-reduced-motion:reduce\)\{\.axk,\.axk \*\{animation:none!important;transition:none!important\}\}/);
  assert.match(src, /if \(RM\) \{ bitir\(\); return box; \}/, 'hareket azaltmada daktilo efekti yok');
});

summary();
