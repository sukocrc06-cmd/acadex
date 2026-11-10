/* ==========================================================================
   ACADEX — ACADEX MEDICA (tests/medica.js)

   NEDEN VAR (31.10.2026): MedLab'in içine "Acadex Medica" eğitim hastanesi eklendi
   (labs/medica/). Bütün klinik vakalar lab'lardan kaldırılıp hastaneye taşındı:
     giriş → rehber hekim (Uzm. Dr. Ela Altındağ) → bölüm seçimi → asansör → katın bekleme salonu →
     hasta odada (labs/klinik sahnesi) → lab'a devir (?medica=1&vaka=…) → sonuç hastaneye.
   Bu test şunları tutar:
     - Her kat (Tıp, Fizyoterapi, Odyoloji, Diyet, DKT) senaryolarını önekle toplar; hepsi
       şema denetiminden geçer, kusursuz görüşme 100 puan.
     - Yeni senaryolar lab'daki vakayla AYNI hastayı anlatır (Odyoloji: başlık ve otoskopi;
       DKT: ad ve yaş); Fizyo'da devir hedefi lab'da var olan test ya da protokoldür.
     - Lab'lar vaka sekmesini yalnız ?medica=1 ile gösterir ve sonucu hastaneye bildirir.
     - Nöbet ve hasta puanı saf fonksiyonlar; MedLab kartı ve Acadia köprüsü bağlı.
   31.10.2026 (2. tur): her kata +4 hasta (toplam 60, lab'da da karşılığıyla), canlı hastane
   (vakit, yürüyen personel, anons), canlı muayene odası (akan EKG/SpO₂, eşik alarmı, yüz ifadesi),
   nöbette triyaj masası ve süreli acil kod, katlar arası konsültasyon zincirleri.
   31.10.2026 (3. tur): Anatomi ve Fizyo'da lab işi bitince sonuç hastaya döner: bulgu formu
   ("Hastaya bildir"), Fizyo Lab'de kurulan ev programı, taburcu sahnesi. Lab'da rehber hekim
   Dr. Ela üç kademeli ipucu verir (5/10/20 puan).
   01.11.2026: 6. kat hastane eczanesi (Eczacılık Lab) ve 7. kat dahiliye servisi (Hemşirelik Lab):
   her biri 8 hasta, bölüme göre anamnez, acil kodda role özgü adımlar (eczacı acil ilaç, hemşire ilk
   müdahale), lab'a devir ve sonucun hastaneye dönmesi. Lab'ların kendi testleri: tests/eczacilik-hemsirelik.js.

   Calistirma:  node tests/medica.js
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
vm.runInNewContext(read('labs/diyet/data/who2007-bki.js'), ctx);
const M = require(path.join(ROOT, 'labs/diyet/diyet-model.js')); M.load(ctx.window.AXDB);
const K = require(path.join(ROOT, 'labs/klinik/klinik.js'));
const MV = require(path.join(ROOT, 'labs/medica/medica-veri.js'));
const SEN = {};
[require(path.join(ROOT, 'labs/klinik/senaryo-anatomi.js')), require(path.join(ROOT, 'labs/klinik/senaryo-fizyo.js')), require(path.join(ROOT, 'labs/klinik/senaryo-odyoloji.js')),
  require(path.join(ROOT, 'labs/klinik/senaryo-diyet.js'))(M), require(path.join(ROOT, 'labs/klinik/senaryo-dkt.js')),
  require(path.join(ROOT, 'labs/klinik/senaryo-eczacilik.js')), require(path.join(ROOT, 'labs/klinik/senaryo-hemsirelik.js'))].forEach((L) => L.forEach((s) => { assert.ok(!SEN[s.id], 'yinelenen ' + s.id); SEN[s.id] = s; }));
const kusursuz = (s) => {
  const sec = {};
  s.adimlar.forEach((a, i) => {
    if (a.tip === 'sor' || a.tip === 'eylem') { const pos = a.secenek.filter((o) => o.puan > 0).sort((x, y) => y.puan - x.puan); sec[i] = (a.hak ? pos.slice(0, a.hak) : pos).map((o) => o.id); }
    if (a.tip === 'karar') sec[i] = a.secenek.findIndex((o) => o.dogru);
  });
  return sec;
};
/* lab veri dosyaları: tarayıcı modülleri window'a yazar */
const veri = (p, ad) => { const c = { window: {} }; vm.runInNewContext(read(p), c); return c.window[ad]; };
const ODY = require(path.join(ROOT, 'labs/odyoloji/odyo-model.js'));
const DKT = veri('labs/dkt/dkt-veri.js', 'AXDKT');

test('katlar: yedi bölüm, her biri senaryolarını önekle toplar; toplam 83 hasta', () => {
  assert.deepEqual(MV.KAT.map((k) => k.id), ['tip', 'fizyo', 'odyo', 'diyet', 'dkt', 'ecz', 'hem']);
  assert.deepEqual(MV.KAT.map((k) => k.no), [1, 2, 3, 4, 5, 6, 7]);
  const say = Object.fromEntries(MV.KAT.map((k) => [k.id, MV.katHastalari(k, SEN).length]));
  assert.deepEqual(say, { tip: 10, fizyo: 16, odyo: 13, diyet: 18, dkt: 10, ecz: 8, hem: 8 });   /* 01.11.2026: +6 Fizyo, +1 Anatomi; Eczacılık ve Hemşirelik katları */
  assert.equal(Object.keys(SEN).length, 83);
  assert.equal(MV.katBul('ecz').lab, 'eczacilik'); assert.equal(MV.katBul('hem').lab, 'hemsirelik');
  assert.ok(SEN['hem-pnomoni'].oda === 'servis' && MV.yatan(SEN['hem-pnomoni']), 'servis hastası yatakta');
  for (const k of MV.KAT) for (const s of MV.katHastalari(k, SEN)) assert.equal(s.lab, k.lab, s.id + ' doğru kata');
});

test('senaryolar: şema temiz, kusursuz görüşme 100, yargılayıcı soru puan düşürür', () => {
  for (const s of Object.values(SEN)) {
    assert.deepEqual(K.denetle(s), [], s.id);
    assert.equal(K.puanla(s, kusursuz(s)).puan, 100, s.id);
  }
  for (const id of ['ody-v-oto', 'dkt-kek', 'fz-bel']) {
    const s = SEN[id], i = s.adimlar.findIndex((a) => a.tip === 'sor'), sec = kusursuz(s);
    sec[i] = sec[i].slice(0, s.adimlar[i].hak - 1).concat(['yargi']);
    assert.ok(K.puanla(s, sec).puan < 100, id);
  }
});

test('Odyoloji: 13 vakanın hepsi sahnede; başlık ve otoskopi bulgusu vaka dosyasıyla aynı', () => {
  const L = Object.values(SEN).filter((s) => s.lab === 'odyoloji');
  assert.deepEqual(L.map((s) => s.vaka).sort(), ODY.CASES.map((c) => c.id).sort());
  for (const s of L) {
    const c = ODY.CASES.find((x) => x.id === s.vaka);
    assert.equal(s.baslik, c.baslik, s.id);
    const oto = s.adimlar.flatMap((a) => a.secenek || []).find((o) => o.id === 'otoskopi');
    assert.ok(oto, s.id + ' otoskopi');
    assert.equal(oto.sonuc, c.sonuc.otoskopi, s.id + ' otoskopi bulgusu');
    assert.equal(s.adimlar[s.adimlar.length - 1].hedef, 'vaka');
    /* karar tanıyı söylemez: doğru seçenekte vakanın doğru tanısı geçmez */
    const dogru = s.adimlar.find((a) => a.tip === 'karar').secenek.find((o) => o.dogru).t;
    assert.ok(!dogru.includes(c.tani[c.dogru].split(' (')[0]), s.id + ' karar tanıyı vermemeli');
  }
});

test('DKT: 10 vakanın hepsi sahnede; ad ve yaş vaka dosyasıyla aynı, tanısal izlenim söylenmez', () => {
  const L = Object.values(SEN).filter((s) => s.lab === 'dkt');
  assert.equal(L.map((s) => s.vaka).sort().join(), DKT.VAKA.map((v) => v.id).sort().join());
  for (const s of L) {
    const v = DKT.VAKA.find((x) => x.id === s.vaka);
    assert.equal(s.hasta.ad, v.ad, s.id); assert.equal(s.hasta.yas, v.yas, s.id);
    const dogru = s.adimlar.find((a) => a.tip === 'karar').secenek.find((o) => o.dogru).t;
    assert.ok(!dogru.includes(v.tani.find((t) => t[2])[1].split(' (')[0]), s.id + ' karar tanısal izlenimi vermemeli');
  }
});

test('Fizyo: devir hedefleri Fizyo Lab’de var olan özel test ya da protokol', () => {
  const h = read('labs/fizyo/index.html');
  const blok = (bas) => { const i = h.indexOf(bas); return h.slice(i, h.indexOf('\n];', i)); };
  const testler = new Set([...blok('const FZ_TESTS = [').matchAll(/\{ id: '([A-Za-z]+)', ad:/g)].map((m) => m[1]));
  const prot = new Set([...blok('const FZ_PROT = [').matchAll(/\{ id: '([a-z]+)', ad:/g)].map((m) => m[1]));
  const L = Object.values(SEN).filter((s) => s.lab === 'fizyo');
  assert.equal(L.length, 16);
  for (const s of L) {
    const [tip, id] = s.adimlar[s.adimlar.length - 1].hedef.split(':');
    assert.ok(tip === 'test' ? testler.has(id) : tip === 'prot' && prot.has(id), s.id + ' → ' + tip + ':' + id);
    assert.match(MV.devirAdres(s, tip + ':' + id), new RegExp('^\\.\\./fizyo/index\\.html\\?medlab=1&medica=1&fz=' + tip + '%3A' + id + '&hasta='));
  }
});

test('yeni hastalar: her kata 4, lab’da karşılığı var', () => {
  const yeni = { tip: ['ana-inme', 'ana-kalca', 'ana-apandisit', 'ana-kot'], fizyo: ['fz-kalca', 'fz-tenis', 'fz-asil', 'fz-tda'], odyo: ['ody-v-kerem', 'ody-v-buson', 'ody-v-ototoks', 'ody-v-perfor'],
    diyet: ['dyt-v-dash', 'dyt-v-onko', 'dyt-v-osteo', 'dyt-e-peg'], dkt: ['dkt-osman', 'dkt-kerem', 'dkt-yarik', 'dkt-ykek'] };
  for (const [kat, ids] of Object.entries(yeni)) for (const id of ids) { assert.ok(SEN[id], id); assert.equal(MV.katOf(id).id, kat, id); }
  const ana = read('labs/anatomi/index.html');
  for (const v of ['inme', 'kalca', 'apandisit', 'kot']) assert.match(ana, new RegExp("\\{ id: '" + v + "',[^\\n]*? ad: "), 'Anatomi CASES ' + v);
  assert.ok(M.VK.some((v) => v.id === 'v-onko') && M.EP.some((c) => c.id === 'e-peg'));
  assert.ok(ODY.P.buson.oto.R.g === 'buson' && /g === 'buson'/.test(read('labs/odyoloji/odyo-kabin2.js')), 'otoskopta buşon çizimi');
});

test('triyaj: renkler, gerekçe, puan ve sıra; düşük önceliklendirme işaretlenir', () => {
  for (const id of Object.keys(MV.TRIYAJ)) { assert.ok(SEN[id], id); assert.ok(MV.TRIYAJ_RENK[MV.TRIYAJ[id][0]], id); }
  assert.equal(MV.triyaj(SEN['ana-kot']).renk, 'kirmizi'); assert.equal(MV.triyaj(SEN['dkt-ssd']).renk, 'yesil');
  for (const s of Object.values(SEN)) if (s.vital && s.vital.spo2 != null && s.vital.spo2 < 92) assert.equal(MV.triyaj(s).renk, 'kirmizi', s.id + ': SpO₂ < 92 kırmızı');
  const ids = ['dkt-ssd', 'ana-kot', 'ana-kalca', 'ana-pterion'];
  assert.deepEqual(MV.triyajSira(ids, SEN), ['ana-kot', 'ana-pterion', 'ana-kalca', 'dkt-ssd']);
  const r = MV.triyajPuan(ids, { 'dkt-ssd': 'yesil', 'ana-kot': 'kirmizi', 'ana-kalca': 'sari', 'ana-pterion': 'yesil' }, SEN);
  assert.deepEqual([r.dogru, r.toplam, r.puan], [3, 4, 75]);
  assert.equal(r.satir.find((x) => x.id === 'ana-pterion').eksikTriyaj, true, 'kırmızıyı yeşil saymak en riskli hata');
  const ib = MV.ilkBakis(SEN['ana-kot']); assert.equal(ib.gelis, 'sedyede'); assert.match(ib.vital, /SpO₂ %89/);
});

test('acil kod: kat başına olaylar, plan ve puan', () => {
  for (const k of MV.KAT) for (const t of MV.KOD_KAT[k.id]) { const K0 = MV.KOD[t]; assert.ok(K0 && K0.adimlar.length >= 4 && K0.sure >= 30 && K0.not, k.id + ' ' + t); }
  assert.match(MV.KOD.mavi.adimlar[2], /30:2/); assert.match(MV.KOD.hipo.adimlar[1], /15 g/);
  /* role özgü adımlar: eczacı acil ilaçları hazırlar, hemşire ilk müdahaleyi yapar; rolü olmayan kat genel adımları alır */
  assert.equal(MV.kodAdim('mavi', 'tip').rol, null); assert.deepEqual(MV.kodAdim('mavi', 'tip').adimlar, MV.KOD.mavi.adimlar);
  assert.match(MV.kodAdim('mavi', 'ecz').rol, /Eczacı/); assert.ok(MV.kodAdim('mavi', 'ecz').adimlar.some((a) => /Adrenalin 1 mg/.test(a)));
  assert.ok(MV.kodAdim('anafilaksi', 'ecz').adimlar.some((a) => /0,5 mg/.test(a)), 'eczacı IM adrenalin dozunu hesaplar');
  assert.match(MV.kodAdim('mavi', 'hem').rol, /Hemşire/); assert.match(MV.kodAdim('mavi', 'hem').adimlar[2], /30:2/);
  for (const k of ['ecz', 'hem']) for (const t of Object.keys(MV.KOD_ROL[k]).filter((x) => x !== 'rol')) { const a = MV.kodAdim(t, k); assert.ok(a.adimlar.length >= 5 && a.not, k + ' ' + t); }
  assert.match(read('labs/medica/medica.js'), /KA = V\.kodAdim\(n\.kod\.tip, n\.kat\)/);
  assert.equal(MV.kodPlan('tip', 1), null, 'tek hastalı nöbette kod yok');
  const p = MV.kodPlan('diyet', 4, () => 0.99); assert.ok(MV.KOD_KAT.diyet.includes(p.tip)); assert.ok(p.i >= 1 && p.i <= 3, 'hastalar arasında');
  assert.equal(MV.kodPuan(0, false), 100); assert.equal(MV.kodPuan(2, false), 70); assert.equal(MV.kodPuan(1, true), 55); assert.equal(MV.kodPuan(9, true), 0);
  const o = MV.nobetOzet({ hastalar: [{ sahne: 80 }], triyaj: { puan: 75 }, kod: { puan: 85 } }); assert.deepEqual([o.triyaj, o.kod], [75, 85]);
});

test('konsültasyon: zincirler aynı hastayı anlatır, sevk sorusu bir sonraki katı ister', () => {
  for (const z of MV.KONSULT) {
    assert.equal(z.sevk.length, z.zincir.length - 1, z.id);
    const ilk = SEN[z.zincir[0]].hasta;
    const ad = (h) => String(h.ad).split(' ')[0];
    for (const id of z.zincir) { const h = SEN[id].hasta; assert.equal(ad(h), ad(ilk), id + ' aynı hasta'); assert.equal(parseInt(h.yas, 10), parseInt(ilk.yas, 10), id + ' aynı yaş'); }
    for (let i = 0; i < z.zincir.length - 1; i++) {
      const q = MV.sevkSoru(z.zincir[i]); assert.equal(q.hedef, MV.katOf(z.zincir[i + 1]).id, z.id + ' ' + i);
      assert.ok(q.secenek.includes(q.hedef) && q.secenek.includes('yok') && !q.secenek.includes(MV.katOf(z.zincir[i]).id));
    }
    assert.equal(MV.sevkSoru(z.zincir[z.zincir.length - 1]), null, 'son halkadan sevk yok');
    assert.equal(MV.konsultNotu(z.zincir[0]), null); assert.match(MV.konsultNotu(z.zincir[1]), /^Konsültasyon notu · \d\. kat/);
  }
  assert.deepEqual(MV.KONSULT.find((z) => z.id === 'inme').zincir, ['ana-inme', 'dkt-osman', 'dyt-e-inme']);
});

test('canlı hastane: vakit, anons, yürüyen personel; hareket azaltmada gizli', () => {
  assert.deepEqual([MV.vakit(7 * 60), MV.vakit(12 * 60), MV.vakit(18 * 60), MV.vakit(23 * 60), MV.vakit(3 * 60)], ['sabah', 'gunduz', 'aksam', 'gece', 'gece']);
  for (const k of MV.KAT) assert.ok(MV.ANONS[k.id] && MV.ANONS[k.id].length, k.id);
  const js = read('labs/medica/medica.js'), h = read('labs/medica/index.html');
  assert.match(js, /data-vakit="' \+ V\.vakit\(vakitDk\(\)\) \+ '"/); assert.match(js, /canliKat\(kat, false\)/); assert.match(js, /if \(yat\.length\) s \+= sedye\(/);
  assert.match(h, /\.sahne\[data-vakit="gece"\]\{--gok1:/); assert.match(h, /@media \(prefers-reduced-motion:reduce\)\{[^}]*\}\.sahne \.yuru\{display:none\}\}/);
  assert.match(h, /id="md-kon" aria-label="Konsültasyonlar"/); assert.match(h, /id="md-saat"/);
  /* karar pencereleri (triyaj, sevk) dışına tıklayarak ya da Esc ile kapanmaz */
  assert.match(js, /if \(\(e\.target === w && !zor\) \|\| e\.target\.closest\('\[data-kapat\]'\)\) kapatModal\(\);/);
  assert.match(js, /!\$\('\.md-modal\[data-zorunlu\]'\)/);
});

test('canlı muayene odası: akan EKG/SpO₂, eşik alarmı, ses isteğe bağlı, yüz ifadesi', () => {
  const k = read('labs/klinik/klinik.js');
  assert.match(k, /class="mon-ekg"/); assert.match(k, /class="mon-ple"/);
  assert.match(k, /nabiz: vit\.nabiz != null && \(vit\.nabiz > 120 \|\| vit\.nabiz < 50\), spo2: vit\.spo2 != null && vit\.spo2 < 92/);
  assert.match(k, /MON\.ses = W\.localStorage\.getItem\('axk\.ses'\) === '1'/, 'ses varsayılan kapalı, kullanıcı açar');
  assert.match(k, /if \(!MON\.ses \|\| RM\) return;/);
  assert.match(k, /if \(sen\.vital && !ov\.querySelector\('#axk-mon'\)\)/, 'monitörü olmayan odada taşınabilir monitör');
  for (const y of ['normal', 'agri', 'uzgun', 'endise', 'rahat']) assert.match(k, new RegExp('\\n    ' + y + ': KAS\\('), 'yüz: ' + y);
  assert.match(k, /if \(MON\.raf\) W\.cancelAnimationFrame\(MON\.raf\)/, 'kapanınca döngü durur');
  assert.equal(SEN['ana-inme'].vital.ritim, 'duzensiz', 'bilinen düzensiz ritim monitörde de düzensiz');
});

test('hastaya bildir: Anatomi ve Fizyo hastalarının hepsinde bulgu formu; egzersizler Fizyo Lab’de var', () => {
  const h = read('labs/fizyo/index.html'), i = h.indexOf('const FZ_EX = ['), ex = new Set([...h.slice(i, h.indexOf('\n];', i)).matchAll(/\{ id: '([A-Za-z]+)', ad:/g)].map((m) => m[1]));
  for (const s of Object.values(SEN).filter((x) => x.lab === 'anatomi' || x.lab === 'fizyo')) {
    assert.ok(s.sonu && s.sonu.sorular.length, s.id + ' sonu');
    for (const q of s.sonu.sorular) { assert.equal(q.secenek.filter((o) => o[1]).length, 1, s.id + ' tek doğru: ' + q.s); for (const o of q.secenek) assert.ok(o[2], s.id + ' geri bildirim'); }
    const pr = s.sonu.program;
    if (pr) { for (const id of pr.oner.concat(pr.kacin.map((k) => k[0]))) assert.ok(ex.has(id), s.id + ' egzersiz yok: ' + id); assert.ok(pr.bos || pr.oner.length >= pr.en, s.id); assert.ok(!pr.oner.some((x) => pr.kacin.some((k) => k[0] === x)), s.id + ' önerilen ve kaçınılan çakışmaz'); }
    if (s.lab === 'fizyo' && s.adimlar[s.adimlar.length - 1].hedef.startsWith('test:')) assert.ok(s.sonu.gozlem, s.id + ' test gözlemi');
  }
  /* protokol hastalarında önerilen egzersizler protokolün 1. fazıyla aynı */
  for (const [sid, pid] of [['fz-ocb', 'ocb'], ['fz-tda', 'tda'], ['fz-ayak', 'ank']]) {
    const b = h.indexOf("{ id: '" + pid + "', ad:"), egz = h.slice(b, h.indexOf('kriter', b)).match(/egz: \[([^\]]+)\]/)[1].match(/'(\w+)'/g).map((x) => x.slice(1, -1));
    assert.deepEqual(SEN[sid].sonu.program.oner.slice().sort(), egz.slice().sort(), sid);
  }
});

test('hastaya bildir: puanlama (form, ev programı, cerrah ipucu)', () => {
  const ocb = SEN['fz-ocb'].sonu, dogru = (q) => q.secenek.findIndex((o) => o[1]);
  assert.equal(MV.sonuPuan(ocb, { sorular: ocb.sorular.map(dogru), program: ['quadset', 'slrEx', 'heelslide'] }).puan, 100);
  const r = MV.sonuPuan(ocb, { sorular: ocb.sorular.map(dogru), program: ['quadset', 'hamcurl'] });
  assert.deepEqual(r.program.yanlis, ['hamcurl'], 'hamstring grefti: erken dirençli hamstring yanlış'); assert.ok(r.puan < 70);
  assert.equal(MV.sonuPuan(ocb, { sorular: ocb.sorular.map(dogru), program: [] }).program.puan, 0, 'program verilmedi');
  const asil = SEN['fz-asil'].sonu.program;
  assert.equal(MV.programPuan(asil, []).puan, 100, 'Aşil yırtığı: ortopediden önce program verilmez'); assert.equal(MV.programPuan(asil, ['calfstretch']).puan, 0);
  assert.deepEqual(MV.IPUCU_CEZA, [5, 10, 20]); assert.equal(MV.ipucuCeza(3), 20);
  assert.equal(MV.labSonPuan(90, 100, 15), 78, 'Anatomi: %70 model + %30 anlatım − ipucu'); assert.equal(MV.labSonPuan(null, 80, 5), 75); assert.equal(MV.labSonPuan(10, 0, 50), 0);
  assert.match(read('labs/medica/medica-cerrah.js'), /var CEZA = \[5, 10, 20\];/, 'cerrah ve hastane aynı cezayı kullanır');
});

test('lab’lar: Fizyo açılınca “tamamlandı” demez, ev programı hastaya gider; cerrah ipucu bağlı', () => {
  const fz = read('labs/fizyo/index.html'), an = read('labs/anatomi/index.html'), c = read('labs/medica/medica-cerrah.js'), js = read('labs/medica/medica.js');
  assert.match(fz, /medicaBildir\(\{ vaka: t\.id, type: 'hazir', tamam: false, exAd \}\)/);
  assert.match(fz, /const saveProg = \(\) => \{ if \(MEDICA\) \{ medicaProg\(\); return; \} LS\.set\('fzProg', FZS\.prog\); \};/, 'öğrencinin kendi programı ezilmez');
  assert.match(an, /sc\.src = '\.\.\/medica\/medica-cerrah\.js'/); assert.match(an, /function medicaCerrah\(o\) \{ if \(window\.AXCERRAH\) \{ window\.AXCERRAH\.kur\(o\); return; \}/, '06.11.2026: Dr. Ela tek başına Anatomi Lab’da da');
  assert.ok(!/medicaCerrah/.test(fz), 'rehber cerrah yalnız Anatomi vakalarında (01.11.2026 seçimi)');
  /* Anatomi: önce ekibe ilk plan, sonra hastaya anlatım (taburcuda son sorudaki seçim söylenir) */
  for (const s of Object.values(SEN).filter((x) => x.lab === 'anatomi')) { assert.equal(s.sonu.sorular.length, 2, s.id); assert.match(s.sonu.sorular[0].s, /İlk plan/, s.id); }
  assert.match(an, /kademe: vkIpucu, etiket: VK_ETIKET/, 'kademeler tests/anatomi-vaka.js içinde sınanır');
  assert.match(c, /class="axc-agiz"/); assert.match(c, /<b>Uzm\. Dr\. Ela Altındağ<\/b>/); assert.match(c, /type: 'ipucu', lab: o\.lab, kademe: n, ceza: CEZA\[n - 1\]/); assert.match(c, /e\.key === 'Escape'/);
  assert.match(js, /if \(S\.aktif\.sen\.sonu\) \{ if \(typeof d\.puan === 'number'\) S\.aktif\.cerceve = Math\.round\(d\.puan\); bildirHazir\(/);
  assert.match(js, /if \(d\.type === 'program' && Array\.isArray\(d\.items\)\) \{ S\.aktif\.program = d\.items\.slice\(0, 12\)/);
  assert.match(js, /anim: 'cik'/); assert.match(read('labs/klinik/klinik.js'), /cik: function \(\) \{/);
  assert.match(read('labs/medica/index.html'), /id="md-mu-bildir" hidden disabled>Hastaya bildir →<\/button>/);
});

test('her girişte farklı hastalar: yeni ad ve görünüm, ekler bozulmaz, zincir hastası her katta aynı', () => {
  const a = MV.ziyaret(SEN, 'ziyaret-1'), b = MV.ziyaret(SEN, 'ziyaret-2');
  const ad = (Z, id) => Z.sen[id] && Z.sen[id].hasta.ad;
  const farkli = Object.keys(a.sen).filter((id) => b.sen[id] && ad(a, id) !== ad(b, id)).length;
  assert.ok(farkli > 20, 'iki ziyarette hastaların çoğu farklı adla gelir: ' + farkli);
  assert.deepEqual(MV.ziyaret(SEN, 'ziyaret-1').sen['fz-tenis'].hasta, a.sen['fz-tenis'].hasta, 'aynı tohum aynı hasta');
  for (const s of Object.values(a.sen)) {
    const o = SEN[s.id];
    assert.equal(s.hasta.yas, o.hasta.yas, s.id + ' yaş değişmez (lab hesapları)'); assert.equal(s.hasta.cins, o.hasta.cins, s.id + ' cinsiyet değişmez');
    assert.equal(MV.imza(s.kimlik.ad), MV.imza(s.kimlik.eski), s.id + ' ek uyumu: ' + s.kimlik.eski + ' → ' + s.kimlik.ad);
    if (s.kimlik.ad !== s.kimlik.eski) assert.ok(!JSON.stringify(s.adimlar).match(new RegExp('(^|[^A-Za-zÇĞİÖŞÜçğıöşü])' + s.kimlik.eski + '(?![A-Za-zÇĞİÖŞÜçğıöşü])')), s.id + ' eski ad metinde kalmadı');
    assert.deepEqual(s.mentor, o.mentor, 'mentora dokunulmaz');
    assert.deepEqual(K.denetle(s), [], s.id);
  }
  for (const z of MV.KONSULT) { const L = z.zincir.filter((id) => a.sen[id]).map((id) => a.sen[id].kimlik.ad); assert.equal(new Set(L).size, 1, z.id + ' zincir hastası her katta aynı adla'); }
  assert.match(MV.devirAdres(a.sen['dkt-pd'], 'vaka'), /&ad=/, 'lab dosyası hastanedeki adı gösterir');
  for (const [p, r] of [['labs/diyet/diyet-klinik.js', /if \(MV && MAD\) M\.VK\.concat\(M\.EP\)/], ['labs/dkt/dkt-vaka.js', /if \(MV && MAD\) V\.VAKA\.forEach/], ['labs/odyoloji/odyo-app.js', /A\.P\[caseOf\(mv\)\.hasta\]\.ad = mad/]]) assert.match(read(p), r, p);
});

test('aynı yakınma, farklı tanı: her ziyarette grubun bir üyesi, tanıyı ele vermeyen yakınmayla', () => {
  for (const g of MV.GRUP) { assert.ok(g.uyeler.length >= 2, g.id); for (const id of g.uyeler) { assert.ok(SEN[id], id); assert.ok(!MV.zincir(id), id + ' zincirde değil'); } assert.equal(new Set(g.uyeler.map((id) => MV.katOf(id).id)).size, 1, g.id + ' tek katta'); }
  const gorulen = {};
  for (let t = 0; t < 40; t++) {
    const Z = MV.ziyaret(SEN, 't' + t);
    for (const g of MV.GRUP) { const var_ = g.uyeler.filter((id) => Z.sen[id]); assert.equal(var_.length, 1, g.id); const s = Z.sen[var_[0]]; assert.equal(s.baslik, g.yakinma); assert.equal(s.tani, SEN[var_[0]].baslik); (gorulen[g.id] = gorulen[g.id] || new Set()).add(var_[0]); }
  }
  for (const g of MV.GRUP) assert.equal(gorulen[g.id].size, g.uyeler.length, g.id + ': 40 ziyarette her tanı en az bir kez');
  /* farklı tanı = farklı lab işi */
  assert.notEqual(SEN['fz-omuz'].adimlar.at(-1).hedef, SEN['fz-omuz-yirtik'].adimlar.at(-1).hedef);
});

test('sistematik anamnez: bölüme göre sorular, senaryoda sorulan tekrar sorulmaz, yanıtlar profilden', () => {
  for (const s of Object.values(SEN)) {
    const a = MV.anamnez(s); if (!a) continue;
    const var_ = new Set(s.adimlar.filter((x) => x.tip === 'sor').flatMap((x) => x.secenek.map((o) => o.id)));
    for (const o of a.secenek) { assert.ok(o.cevap && o.t, s.id + ' ' + o.id); assert.ok(o.puan >= 1); }
    if (var_.has('ilac')) assert.ok(!a.secenek.some((o) => o.id === 'anm-ilac'), s.id + ' ilaç tekrar sorulmaz');
    if (var_.has('aile')) assert.ok(!a.secenek.some((o) => o.id === 'anm-soy'), s.id + ' soygeçmiş tekrar sorulmaz');
    const e = MV.anamnezEkle(s), i = e.adimlar.findIndex((x) => x.anamnez); assert.equal(e.adimlar[i + 1].tip, 'sor', s.id + ' ilk sorudan hemen önce');
    assert.equal(K.puanla(e, kusursuz(e)).puan, 100, s.id);
  }
  const id = (s, k) => MV.anamnez(SEN[s]).secenek.map((o) => o.id).includes('anm-' + k);
  assert.ok(id('fz-tenis', 'agri') && id('fz-tenis', 'onceki'), 'Fizyo: ağrı şiddeti ve önceki tedavi');
  assert.match(MV.anamnez(SEN['dyt-v-dm']).secenek.find((o) => o.id === 'anm-boykilo').cevap, /172 cm.*92 kg/, 'Diyet: boy-kilo tartıyla aynı');
  assert.ok(id('ody-v-presbi', 'ototoks') && id('ana-apandisit', 'sonyemek') && id('dkt-yarik', 'gelisim'));
  assert.ok(!id('dkt-pd', 'gelisim') && id('dkt-pd', 'egitim'), 'DKT: yetişkinde gelişim değil eğitim');
  assert.equal(MV.anamnez(SEN['ana-inme']).secenek.find((o) => o.id === 'anm-oz').kim, 'refakat', 'konuşamayan hastada yakını yanıtlar');
  assert.match(MV.anamnez(SEN['ana-inme']).secenek.find((o) => o.id === 'anm-oz').cevap, /tansiyon/i, 'profil öyküyle tutarlı');
});

test('devir adresleri: her lab hastanın vakasını ?medica=1 ile açar', () => {
  assert.equal(MV.devirAdres(SEN['ana-radial'], 'model'), '../anatomi/index.html?medlab=1&medica=1&vaka=radial');
  assert.equal(MV.devirAdres(SEN['dyt-v-dm'], 'recete'), '../diyet/index.html?medlab=1&medica=1&tab=vaka&vaka=v-dm');
  assert.equal(MV.devirAdres(SEN['dyt-e-inme'], 'ep'), '../diyet/index.html?medlab=1&medica=1&tab=ep&vaka=e-inme');
  assert.equal(MV.devirAdres(SEN['ody-v-ome'], 'vaka'), '../odyoloji/index.html?medlab=1&medica=1&tab=vaka&vaka=v-ome');
  assert.equal(MV.devirAdres(SEN['dkt-pd'], 'vaka'), '../dkt/index.html?medlab=1&medica=1&tab=vaka&vaka=pd');
  assert.equal(MV.devirAdres(SEN['ecz-klaritro'], 'vaka'), '../eczacilik/index.html?medlab=1&medica=1&tab=vaka&vaka=klaritro');
  assert.equal(MV.devirAdres(SEN['hem-sepsis'], 'vaka'), '../hemsirelik/index.html?medlab=1&medica=1&tab=vaka&vaka=sepsis');
  for (const s of Object.values(SEN)) assert.ok(MV.devirAdres(s, s.adimlar[s.adimlar.length - 1].hedef), s.id);
});

test('lab’lar: vaka sekmesi yalnız ?medica=1 ile görünür, sonuç hastaneye bildirilir', () => {
  const axmd = /if\(\/\[\?&\]medica=1\(&\|\$\)\/\.test\(location\.search\)\)document\.documentElement\.classList\.add\('axmd'\)/;
  for (const p of ['labs/anatomi/index.html', 'labs/fizyo/index.html', 'labs/diyet/index.html', 'labs/odyoloji/index.html', 'labs/dkt/index.html', 'labs/eczacilik/index.html', 'labs/hemsirelik/index.html']) assert.match(read(p), axmd, p);
  assert.match(read('labs/eczacilik/index.html'), /html:not\(\.axmd\) \.ec-tabs \[data-tab="vaka"\]\{display:none\}/);
  assert.match(read('labs/hemsirelik/index.html'), /html:not\(\.axmd\) \.hm-tabs \[data-tab="vaka"\]\{display:none\}/);
  assert.match(read('labs/anatomi/index.html'), /html:not\(\.axmd\) \.modes button\[data-mode=vaka\]\{display:none\}/);
  assert.match(read('labs/diyet/index.html'), /html:not\(\.axmd\) \.dl-tabs \[data-tab="vaka"\],html:not\(\.axmd\) \.dl-tabs \[data-tab="ep"\]\{display:none\}/);
  assert.match(read('labs/odyoloji/index.html'), /html:not\(\.axmd\) \.ol-tabs \[data-tab="vaka"\]\{display:none\}/);
  assert.match(read('labs/dkt/index.html'), /html:not\(\.axmd\) \.tk-tabs \[data-tab="vaka"\]\{display:none\}/);
  /* sekme seçimi de korunur: eski kayıtlı "vaka" sekmesi hastane dışında açılmaz */
  assert.match(read('labs/diyet/diyet-app.js'), /\(!MEDICA && \(k === 'vaka' \|\| k === 'ep'\)\)\) k = 'tabak'/);
  assert.match(read('labs/odyoloji/odyo-app.js'), /if \(k === 'vaka' && !MEDICA\) k = 'kabin';/);
  assert.match(read('labs/dkt/dkt-app.js'), /var TABS = MEDICA \? \[[^\]]+'vaka'\] : \['sesletim', 'ses', 'akicilik', 'yutma', 'dil'\];/);
  /* sonuç bildirimi */
  for (const [p, lab] of [['labs/diyet/diyet-klinik.js', 'diyet'], ['labs/odyoloji/odyo-app.js', 'odyoloji'], ['labs/dkt/dkt-vaka.js', 'dkt'], ['labs/eczacilik/ecz-vaka.js', 'eczacilik'], ['labs/hemsirelik/hem-vaka.js', 'hemsirelik'], ['labs/anatomi/index.html', 'anatomi'], ['labs/fizyo/index.html', 'fizyo']]) {
    const s = read(p); assert.match(s, /src: 'axmedica', type: 'sonuc', lab: '/, p); assert.ok(s.includes("lab: '" + lab + "'"), p);
  }
  assert.match(read('labs/diyet/diyet-klinik.js'), /if \(C\.MEDICA \|\| !sahneVar\(id\)\) return '';/, 'hastanede görüşme tekrar sorulmaz');
});

test('hasta ve nöbet puanı', () => {
  assert.equal(MV.hastaPuan({ sahne: 80 }), 80);
  assert.equal(MV.hastaPuan({ sahne: 80, lab: 61 }), 71);
  assert.equal(MV.hastaPuan({}), null);
  const o = MV.nobetOzet({ hastalar: [{ sahne: 90, lab: 70 }, { sahne: 60 }, { sahne: null }] });
  assert.deepEqual([o.gorulen, o.toplam, o.ort], [2, 3, 70]);
  assert.equal(MV.saat(MV.NOBET_BASLA + 3 * MV.NOBET_DK), '10:15');
  assert.equal(MV.sira(MV.KAT[2], 0), '301');
  assert.ok(MV.yatan(SEN['dyt-e-inme']) && !MV.yatan(SEN['dyt-v-dm']));
});

test('rehber hekim (06.11.2026): Uzm. Dr. Ela Altındağ; kapak, hol ve köşe rehberi aynı çizim; açılış hareket azaltmaya uyar', () => {
  const V = require(path.join(ROOT, 'labs/medica/medica-veri.js'));
  assert.deepEqual(V.REHBER, { ad: 'Ela Altındağ', unvan: 'Uzm. Dr.', brans: 'acil tıp' });
  assert.match(V.TANITIM[0], /Ben Uzm\. Dr\. Ela Altındağ/);
  const js = read('labs/medica/medica.js'), dash = read('dashboard.html'), c = read('labs/medica/medica-cerrah.js');
  for (const f of [js, c, dash, read('labs/medica/index.html'), read('labs/medica/medica-veri.js')]) assert.doesNotMatch(f.replace(/medica-cerrah|AXCERRAH|medicaCerrah|cerrahi değerlendirme|Acil ve cerrahi|'cerrah'\]/g, ''), /Kaan Arslan|maskeli|rehber cerrah/i);
  /* pano kapağındaki Dr. Ela, hol çiziminin aynısı (ela fonksiyonundan üretilir) */
  const a = js.indexOf('  var ela = function (o) {'), b = js.indexOf('  var bitki = function');
  const ela = new Function(js.slice(a, b) + '; return ela;')();
  const i = dash.indexOf('<g class="dr med-dr"'), cover = dash.slice(i, dash.indexOf('<g class="med-bub">', i)).trim();
  assert.equal(cover, ela({ x: 748, y: 330, sc: 0.8, cls: 'med-dr' }));
  for (const k of ['dr-salla', 'dr-goz', 'dr-bebek', 'dr-agiz', 'dr-at', 'dr-nefes']) assert.ok(cover.includes('class="' + k + '"'), k);
  assert.match(cover, /stroke="#0D1838" stroke-width="3.5"/, 'steteskop');
  assert.match(dash, /aria-label="Acadex Medica eğitim hastanesi: kapıda beyaz önlüklü, steteskoplu rehber hekim Uzm\. Dr\. Ela Altındağ/);
  /* sinematik açılış: JS yoksa ya da hareket azaltılmışsa son kare; yalnız ilk görünüşte bir kez */
  const css = read('css/acadex-medlab.css'), mj = read('js/acadex-medlab.js');
  const nm = css.slice(css.indexOf('@media (prefers-reduced-motion:no-preference){', css.indexOf('rehber hekim Uzm. Dr. Ela')));
  assert.ok(nm.indexOf('.med-bekle .med-amb') > -1 && nm.indexOf('.med-bekle .med-amb') < nm.indexOf('\n}\n'), 'bekleme durumu yalnız hareket serbestken');
  assert.match(mj, /if \(!calm && typeof IntersectionObserver === 'function'\) \{\n      svg\.classList\.add\('med-bekle'\);/);
  assert.match(mj, /io\.disconnect\(\); svg\.classList\.remove\('med-bekle'\); svg\.classList\.add\('med-oyna'\);/);
  assert.match(mj, /var MET = \{ gel: 'hoş geldin!', buyur: 'buyur, gir!' \};/);
  assert.match(css, /button\.axm-labb:is\(:hover,:focus-visible\) \.axm-med \.dr-salla\{animation:none;transform:rotate\(-84deg\)\}/, 'kartta kapıyı gösterir');
});

test('hastane sayfası: betik sırası, rehber hekim, asansör, erişilebilirlik', () => {
  const h = read('labs/medica/index.html'), at = (f) => h.indexOf('src="' + f + '"');
  assert.ok(at('../diyet/diyet-model.js') < at('../klinik/klinik.js'));
  assert.ok(at('../klinik/klinik.js') < at('../klinik/senaryo-diyet.js') && at('../klinik/senaryo-dkt.js') < at('medica-veri.js') && at('medica-veri.js') < at('medica.js'));
  assert.ok(at('../klinik/klinik.js') < at('../klinik/senaryo-eczacilik.js') && at('../klinik/senaryo-hemsirelik.js') < at('medica-veri.js'), 'yeni katların senaryoları');
  assert.match(h, /<iframe title="Lab: vaka formu" allow="fullscreen; microphone" allowfullscreen><\/iframe>/, 'DKT ses laboratuvarı mikrofonu');
  assert.match(h, /@media \(prefers-reduced-motion:reduce\)/);
  const js = read('labs/medica/medica.js');
  assert.match(js, /if \(RM\) \{ git\(\); live\(/, 'hareket azaltmada asansör animasyonu yok');
  assert.match(js, /setAttribute\('role', 'dialog'\)/); assert.match(js, /e\.key === 'Escape'/);
  /* iç çerçeve aktarımı: lab mesajları 'medica' adıyla, yalnız aynı kaynaktan */
  assert.match(js, /m\.lab = 'medica'/); assert.match(js, /if \(e\.origin !== ORG\) return;/); assert.match(js, /e\.source === f\.contentWindow/);
  assert.match(read('labs/klinik/klinik.js'), /api\.kisi = kisi; api\.yatan = yatan;/);
});

test('MedLab: hastane kartı, lab kaydı ve Acadia köprüsü', () => {
  const d = read('dashboard.html');
  assert.match(d, /<li class="axm-lab axm-lab-wide"[^>]*>\n<button type="button" class="axm-labb" data-medlab-open="medica"/);
  assert.ok(d.indexOf('data-medlab-open="medica"') < d.indexOf('data-medlab-open="anatomi"'), 'hastane rafın başında');
  for (const t of ['Klinik vakalar Acadex Medica’da', 'Hastalar Acadex Medica’da', 'Hastalar ve enteral-parenteral plan Acadex Medica’da']) assert.ok(d.includes(t), t);
  assert.match(read('js/acadex-medlab.js'), /medica: \{ t: 'Acadex Medica', src: 'labs\/medica\/index\.html' \}/);
  /* canlı lab kartları (01.11.2026): her lab kapağında lab'in kendi işi; hareket azaltmada durur */
  for (const k of ['ana', 'fiz', 'ody', 'dyt', 'dkt', 'ecz', 'hem']) assert.match(d, new RegExp('<g class="axm-canli canli-' + k + '" aria-hidden="true">'), 'canlı katman: ' + k);
  for (const k of ['eczacilik', 'hemsirelik']) { assert.ok(d.includes('data-medlab-open="' + k + '"'), 'kart ' + k); assert.match(read('js/acadex-medlab.js'), new RegExp(k + ": \\{ t: '[^']+', src: 'labs/" + k + "/index\\.html' \\}")); assert.ok(read('js/acadex-medlab-acadia.js').includes(k + ": '"), 'Acadia adı ' + k); }
  assert.match(read('css/acadex-medlab.css'), /@media \(prefers-reduced-motion:no-preference\)\{\n  #medlab-view \.canli-ana \.ca-don/);
  const a = read('js/acadex-medlab-acadia.js');
  assert.match(a, /medica: 'Acadex Medica'/); assert.match(a, /medica: 'sağlık bilimleri öğrencisine'/);
});

summary();
