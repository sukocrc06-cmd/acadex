/* ==========================================================================
   ACADEX MEDLAB — ORTAK PROFİL, HASTANE KARİYERİ, KADIN ANATOMİSİ (tests/medlab-profil.js), 28.11.2026

   NEDEN VAR:
     - MedLab'de tek XP ve unvan (js/acadex-medlab-profil.js) lab'ların kendi kayıtlarından hesaplanır.
       Bir lab anahtarını değiştirirse XP sessizce sıfırlanır; formül ve basamaklar burada sabitlenir.
     - Medica kariyeri (labs/medica/medica-kariyer.js): kat kilidi yalnız asansörde, kendi kat ve
       bölümsüz öğrenci hiç kilitlenmez; nöbet türleri unvanla açılır; 20 başarım geçmişten hesaplanır.
     - Anatomi Lab'de Erkek/Kadın modeli: kadın organları (HRA, CC BY 4.0) ayrı veri dosyasında,
       kadında erkek organları gizlenir, her yeni yapının Türkçe kartı ve rafı var, kaynak yazılı.
   Calistirma:  node tests/medlab-profil.js
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

const depo = {};
const W = { localStorage: { getItem: (k) => (k in depo ? depo[k] : null), setItem: (k, v) => { depo[k] = String(v); } } };
W.window = W; vm.createContext(W);
vm.runInContext(read('js/acadex-medlab-profil.js'), W);
const P = W.AXPROFIL;
const kur = (o) => { for (const k of Object.keys(depo)) delete depo[k]; for (const k of Object.keys(o)) depo[k] = JSON.stringify(o[k]); };

test('XP formülü ve unvan basamakları', () => {
  assert.deepEqual(Array.from(P.UNVAN, (u) => u.ad), ['Stajyer', 'İntörn', 'Asistan', 'Uzman', 'Doçent', 'Profesör']);
  assert.deepEqual(Array.from(P.UNVAN, (u) => u.xp), [0, 300, 1000, 2500, 5000, 9000]);
  kur({}); assert.equal(P.hesap().xp, 0); assert.equal(P.hesap().unvan.id, 'stajyer');
  kur({
    'axAnat2.seen': Array(10).fill(0), 'axAnat2.ok': [1, 2], 'axAnat2.caseDone': [1],
    'acadex.medica.gorulen': { a: { sahne: 80, lab: 90 }, b: { sahne: 50 }, c: {} },
    'acadex.medica.defter': [{ hastalar: [{ sahne: 80, lab: null }, { sahne: 60, lab: null }], triyaj: { dogru: 3, toplam: 4 }, kod: { puan: 70 } }],
    'acadex.depo.gor': [1, 2, 3], 'acadex.depo.sim': { x: 7 }, 'acadex.diyet.gdone': { a: 1 }, 'acadex.odyo.vakaDone': { v: 1 }
  });
  const h = P.hesap();
  assert.equal(h.lab.anatomi, 10 * 2 + 2 * 5 + 25);
  assert.equal(h.lab.medica, (20 + 17) + (20 + 10) + 20 + (40 + 35) + 15 + 30, 'hasta 20+puan/5, nöbet 40+ort/2, triyaj 5×doğru, kod 30');
  assert.equal(h.lab.depo, 16); assert.equal(h.lab.diyet, 10); assert.equal(h.lab.odyo, 20);
  assert.equal(h.xp, Object.values(h.lab).reduce((a, b) => a + b, 0));
  kur({ 'axAnat2.seen': Array(5000).fill(0) }); assert.equal(P.hesap().xp, 1200, 'yapı inceleme en çok 600 yapı sayılır');
  assert.equal(P.unvanOf(299).id, 'stajyer'); assert.equal(P.unvanOf(300).id, 'intorn'); assert.equal(P.unvanOf(9000).id, 'profesor');
  assert.ok(P.enAz('intorn', { sira: 1 }) && !P.enAz('asistan', { sira: 1 }));
});

test('XP anahtarları lab kodunda gerçekten yazılıyor', () => {
  const lab = {
    'labs/anatomi/index.html': [/localStorage\.setItem\('axAnat2\.' \+ k/, /LS\.set\('seen'/, /LS\.set\('ok'/, /LS\.set\('caseDone'/],
    'labs/fizyo/index.html': [/LS\.set\('fzOsce'/, /LS\.set\('fzPrac'/],
    'labs/medica/medica.js': [/localStorage\.setItem\('acadex\.medica\.' \+ k/, /ls\.set\('gorulen', S\.gorulen\)/, /ls\.set\('defter'/],
    'labs/depo/depo.js': [/localStorage\.setItem\('acadex\.depo\.' \+ k/, /ls\.set\('gor', gor\)/, /ls\.set\('sim', simP\)/],
    'labs/diyet/diyet-app.js': [/localStorage\.setItem\('acadex\.diyet\.' \+ k/, /ls\.set\('gdone'/],
    'labs/diyet/diyet-klinik.js': [/ls\.set\('antroDone'/, /ls\.set\('epDone'/],
    'labs/odyoloji/odyo-app.js': [/localStorage\.setItem\('acadex\.odyo\.' \+ k/]
  };
  for (const [f, L] of Object.entries(lab)) { const s = read(f); for (const r of L) assert.match(s, r, f); }
  assert.match(read('labs/odyoloji/odyo-app.js') + read('labs/odyoloji/odyo-kabin2.js'), /ls\.set\('kabinDone'/);
  assert.match(read('labs/odyoloji/odyo-app.js') + read('labs/odyoloji/odyo-kabin2.js'), /ls\.set\('vakaDone'/);
});

test('dashboard profil kartı ve Medica bağlantısı', () => {
  const d = read('dashboard.html'), m = read('js/acadex-medlab.js'), mi = read('labs/medica/index.html');
  assert.match(d, /<section class="axm-profil land" data-medlab-profil=""/);
  assert.ok(d.indexOf('js/acadex-medlab-profil.js') > 0 && d.indexOf('js/acadex-medlab-profil.js') < d.indexOf('js/acadex-medlab.js"'));
  assert.match(d, /css\/acadex-medlab-profil\.css/);
  assert.match(m, /acadex:medlab-kapandi/, 'lab kapanınca kart yenilenir');
  assert.ok(mi.indexOf('../../js/acadex-medlab-profil.js') > 0 && mi.indexOf('medica-kariyer.js') > mi.indexOf('acadex-medlab-profil.js') && mi.indexOf('medica-kariyer.js') < mi.indexOf('src="medica.js"'));
  assert.match(mi, /id="md-kar"/); assert.match(mi, /medica-kariyer\.css/);
  for (const f of ['css/acadex-medlab-profil.css', 'labs/medica/medica-kariyer.css']) {
    const css = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]+\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '');
    for (const b of css.split(/(?=@media)/)) if (/animation:/.test(b) && !/^@media \(prefers-reduced-motion:no-preference\)/.test(b.trim())) for (const l of b.split('}')) if (/animation:/.test(l) && !/animation:none/.test(l)) assert.fail(f + ' korumasız animasyon: ' + l.trim().slice(0, 80));
  }
});

/* Medica kariyeri */
const MW = { localStorage: W.localStorage, AXPROFIL: P, console };
MW.window = MW; vm.createContext(MW);
vm.runInContext(read('labs/medica/medica-kariyer.js'), MW);
const KR = MW.AXKARIYER;
const V = require(path.join(ROOT, 'labs/medica/medica-veri.js'));

test('kat kilidi: kendi kat, bölümsüz ve Tıp ara katları açık; diğerleri İntörn', () => {
  kur({});
  const kat = (id) => V.katBul(id) || { id, ara: /^ak-/.test(id) };
  assert.ok(KR.katAcik(kat('fizyo'), null), 'bölüm seçilmemiş');
  assert.ok(KR.katAcik(kat('fizyo'), 'fizyo'), 'kendi katı');
  assert.ok(!KR.katAcik(kat('tip'), 'fizyo'), 'Stajyer başka kata asansörle gidemez');
  assert.ok(KR.katAcik({ id: 'ak-kv', ara: true }, 'tip') && !KR.katAcik({ id: 'ak-kv', ara: true }, 'diyet'));
  kur({ 'axAnat2.seen': Array(150).fill(0) });
  assert.ok(KR.katAcik(kat('tip'), 'fizyo'), 'İntörn bütün katlara');
  const md = read('labs/medica/medica.js');
  assert.match(md, /var b = e\.target\.closest\('\[data-kat\]'\); if \(!b \|\| b\.disabled\) return;/, 'kilitli düğme tıklanmaz');
  assert.match(md, /var katAc = function \(k\) \{ return !W\.AXKARIYER \|\| W\.AXKARIYER\.katAcik\(k, S\.bolum\); \};/);
  assert.doesNotMatch(md, /var asansor = function \(katId, sonra\) \{\s*if \(!katAc/, 'konsültasyon yolu (asansor) kilitlenmez');
});

test('nöbet türleri unvanla açılır ve kayda geçer', () => {
  assert.deepEqual(Array.from(KR.NOBET, (t) => [t.id, t.hasta, t.basla, t.unvan]), [['gunduz', 4, 480, 'stajyer'], ['gece', 5, 1200, 'intorn'], ['yogun', 7, 480, 'asistan']]);
  assert.equal(KR.NOBET[0].hasta, V.NOBET_HASTA); assert.equal(KR.NOBET[0].basla, V.NOBET_BASLA);
  const md = read('labs/medica/medica.js');
  assert.match(md, /if \(!tur && KR && KR\.enAz\('intorn'\)\) \{ nobetSec\(kat\); return; \}/);
  assert.match(md, /S\.nobet = \{ kat: kat\.id, tur: T\.id, bas: T\.basla, basla: Date\.now\(\), saat: T\.basla,/);
  assert.match(md, /V\.saat\(n\.bas != null \? n\.bas : V\.NOBET_BASLA\)/, 'karne nöbetin kendi başlangıç saatini yazar');
  kur({}); const h = KR.nobetSecHtml({ katAd: 'X', hastaSay: 3 });
  assert.match(h, /data-nobet-tur="gece" disabled/); assert.match(h, /3 hasta/, 'katta az hasta varsa o kadar');
});

test('20 başarım: geçmişten hesaplanır, ilk açılışta bildirim yağmuru yok', () => {
  assert.equal(KR.BASARIM.length, 20); assert.equal(new Set(KR.BASARIM.map((b) => b.id)).size, 20);
  for (const b of KR.BASARIM) assert.ok(b.ad && b.t && b.s && typeof b.k === 'function', b.id);
  kur({});
  const S = { bolum: 'fizyo', gorulen: { 'fz-1': { sahne: 92, lab: 90 } }, defter: [{ kat: 'fizyo', tur: 'gece', hastalar: [{ sahne: 90, lab: 88 }, { sahne: 86, lab: null }], triyaj: { dogru: 3, toplam: 3 }, kod: { puan: 100 } }], sevk: { inme: { acik: 1, sec: {} } } };
  const c = { S, V, hastalar: (k) => [{ id: k.id === 'fizyo' ? 'fz-1' : 'yok' }] };
  assert.equal(KR.kontrol(c).length, 0, 'ilk hesap sessiz');
  const kz = KR.kazanilan();
  for (const id of ['ilk-hasta', 'lab-devir', 'ornek', 'ilk-nobet', 'nobet-85', 'triyaj', 'kod', 'kod-100', 'gece', 'katim', 'konsult']) assert.ok(kz[id], id);
  for (const id of ['on-hasta', 'yogun', 'tur', 'u-intorn']) assert.ok(!kz[id], id);
  S.gorulen.x = { sahne: 50 }; for (let i = 0; i < 9; i++) S.gorulen['y' + i] = { sahne: 40 };
  assert.deepEqual(Array.from(KR.kontrol(c), (b) => b.id), ['on-hasta'], 'sonra yalnız yeni kazanılan bildirilir');
  assert.equal(KR.kontrol(c).length, 0);
});

/* Anatomi: kadın modeli */
const an = read('labs/anatomi/index.html');
test('kadın organları verisi: HRA dosyası çözülür, hepsinin adı ve kartı var', () => {
  const js = read('labs/anatomi/data/ax-kadin.js');
  assert.match(js, /Human Reference Atlas/); assert.match(js, /CC BY 4\.0/);
  const b = Buffer.from(js.split('"')[1], 'base64'), n = b.readUInt32LE(0), items = JSON.parse(b.subarray(4, 4 + n).toString());
  const adlar = items.map((x) => x.n).sort();
  assert.deepEqual(adlar, ['Ampulla of uterine tube.l', 'Ampulla of uterine tube.r', 'Base of urinary bladder (female)', 'Body of uterus', 'Cervix of uterus', 'Fimbriae of uterine tube.l', 'Fimbriae of uterine tube.r', 'Fundus of uterus', 'Infundibulum of uterine tube.l', 'Infundibulum of uterine tube.r', 'Isthmus of uterine tube.l', 'Isthmus of uterine tube.r', 'Isthmus of uterus', 'Neck of urinary bladder (female)', 'Ovary.l', 'Ovary.r', 'Urinary bladder (female)']);
  const base = 4 + n + ((4 - (4 + n) % 4) % 4); let son = 0;
  for (const it of items) { assert.ok(it.nv > 50 && it.ni % 3 === 0, it.n); son = Math.max(son, it.io + it.il); assert.equal(it.io, it.vo + it.vl, it.n);
    /* kalça kemiği kutusunun içinde (Z-Anatomy: x ±0,135, y 0,797–1,012, z −0,087–0,056) */
    for (let k = 0; k < 3; k++) { const lo = [-0.14, 0.79, -0.09][k], hi = [0.14, 1.02, 0.065][k]; assert.ok(it.mn[k] >= lo && it.mn[k] + it.ex[k] <= hi, it.n + ' ekseni ' + k); } }
  assert.equal(son, b.length - base, 'ikili blok tam');
  /* adlar ve Türkçe kartlar */
  const blok = an.slice(an.indexOf('const KADIN_AD'), an.indexOf('const CINS_NOT'));
  const KA = vm.runInNewContext(blok.slice(0, blok.indexOf('Object.assign(TR')).replace('const KADIN_AD =', 'KADIN_AD =') + '; KADIN_AD', {});
  assert.deepEqual(Object.keys(KA).sort(), adlar, 'her mesh için ad kaydı');
  for (const a of adlar) assert.equal(KA[a].cins, 'k', a);
  for (const la of ['Fundus uteri', 'Corpus uteri', 'Isthmus uteri', 'Cervix uteri', 'Ampulla tubae uterinae', 'Isthmus tubae uterinae', 'Infundibulum tubae uterinae', 'Fimbriae tubae uterinae', 'Ovarium']) assert.match(blok, new RegExp("'" + la + "': \\{ t: '[^']+\\(", 'u'), 'TR kartı: ' + la);
});

test('Erkek/Kadın düğmesi: gizleme, raf, seçim ve kaynak', () => {
  assert.match(an, /<div class="seg2" id="cinsSec" role="group" aria-label="Model cinsiyeti"><button data-cins="e"/);
  assert.match(an, /cins: LS\.get\('cins', 'e'\) === 'k' \? 'k' : 'e'/);
  assert.match(an, /if \(u\.cins && u\.cins !== st\.cins\) on = false;/);
  assert.match(an, /for \(const key of sys === 'organ' \? \['organ', 'kadin'\] : \[sys\]\)/);
  assert.match(an, /kadin: 'data\/ax-kadin\.js'/);
  assert.match(an, /NAMES = Object\.assign\(meta\.names, KADIN_AD\)/);
  assert.match(an, /\['Kadın üreme', \/of uterus\$\|of uterine tube\|\^Ovary\/, 'k'\]/);
  assert.match(an, /get raf\(\) \{ return ORG_RAF\.filter\(r => !r\[2\] \|\| r\[2\] === st\.cins\); \}/);
  assert.match(an, /setCins\(ms0\[0\]\.userData\.cins, true\)/, 'öteki cinsiyetin yapısı seçilince model geçer');
  assert.match(an, /kadın üreme organları: <a href="https:\/\/humanatlas\.io"[^>]*>Human Reference Atlas<\/a> \(NIH 3D\) · CC BY 4\.0/);
  /* erkek organ deseni: hangi adlar erkekte kalır */
  const rx = new RegExp(an.match(/const ERKEK_RX = \/(.+)\/i;/)[1], 'i');
  for (const n of ['Testis.l', 'Prostate', 'Glans penis', 'Corpus spongiosum of penis', 'Urinary bladder', 'Deep artery of penis.r', 'Left testicular vein', 'Right testicular artery.r']) assert.ok(rx.test(n), n);
  for (const n of ['Urinary bladder (female)', 'Kidney.l', 'Internal pudendal artery.l', 'Pudendal nerve.l', 'Ovary.l']) assert.ok(!rx.test(n), n);
  assert.match(read('labs/anatomi/data/LISANS.txt'), /Human Reference Atlas[\s\S]*CC BY 4\.0/);
  assert.match(read('THIRD-PARTY-LICENSES.md'), /Human Reference Atlas/);
});

summary();
