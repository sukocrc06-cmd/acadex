/* ==========================================================================
   ACADEX — ACADEX MEDICA (tests/medica.js)

   NEDEN VAR (31.10.2026): MedLab'in içine "Acadex Medica" eğitim hastanesi eklendi
   (labs/medica/). Bütün klinik vakalar lab'lardan kaldırılıp hastaneye taşındı:
     giriş → maskeli rehber cerrah → bölüm seçimi → asansör → katın bekleme salonu →
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
  require(path.join(ROOT, 'labs/klinik/senaryo-diyet.js'))(M), require(path.join(ROOT, 'labs/klinik/senaryo-dkt.js'))].forEach((L) => L.forEach((s) => { assert.ok(!SEN[s.id], 'yinelenen ' + s.id); SEN[s.id] = s; }));
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

test('katlar: beş bölüm, her biri senaryolarını önekle toplar; toplam 60 hasta', () => {
  assert.deepEqual(MV.KAT.map((k) => k.id), ['tip', 'fizyo', 'odyo', 'diyet', 'dkt']);
  assert.deepEqual(MV.KAT.map((k) => k.no), [1, 2, 3, 4, 5]);
  const say = Object.fromEntries(MV.KAT.map((k) => [k.id, MV.katHastalari(k, SEN).length]));
  assert.deepEqual(say, { tip: 9, fizyo: 10, odyo: 13, diyet: 18, dkt: 10 });
  assert.equal(Object.keys(SEN).length, 60);
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
  assert.equal(L.length, 10);
  for (const s of L) {
    const [tip, id] = s.adimlar[s.adimlar.length - 1].hedef.split(':');
    assert.ok(tip === 'test' ? testler.has(id) : tip === 'prot' && prot.has(id), s.id + ' → ' + tip + ':' + id);
    assert.match(MV.devirAdres(s, tip + ':' + id), new RegExp('^\\.\\./fizyo/index\\.html\\?medlab=1&medica=1&fz=' + tip + '%3A' + id + '$'));
  }
});

test('yeni hastalar: her kata 4, lab’da karşılığı var', () => {
  const yeni = { tip: ['ana-inme', 'ana-kalca', 'ana-apandisit', 'ana-kot'], fizyo: ['fz-kalca', 'fz-tenis', 'fz-asil', 'fz-tda'], odyo: ['ody-v-kerem', 'ody-v-buson', 'ody-v-ototoks', 'ody-v-perfor'],
    diyet: ['dyt-v-dash', 'dyt-v-onko', 'dyt-v-osteo', 'dyt-e-peg'], dkt: ['dkt-osman', 'dkt-kerem', 'dkt-yarik', 'dkt-ykek'] };
  for (const [kat, ids] of Object.entries(yeni)) for (const id of ids) { assert.ok(SEN[id], id); assert.equal(MV.katOf(id).id, kat, id); }
  const ana = read('labs/anatomi/index.html');
  for (const v of ['inme', 'kalca', 'apandisit', 'kot']) assert.match(ana, new RegExp("\\{ id: '" + v + "', ad: "), 'Anatomi CASES ' + v);
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

test('devir adresleri: her lab hastanın vakasını ?medica=1 ile açar', () => {
  assert.equal(MV.devirAdres(SEN['ana-radial'], 'model'), '../anatomi/index.html?medlab=1&medica=1&vaka=radial');
  assert.equal(MV.devirAdres(SEN['dyt-v-dm'], 'recete'), '../diyet/index.html?medlab=1&medica=1&tab=vaka&vaka=v-dm');
  assert.equal(MV.devirAdres(SEN['dyt-e-inme'], 'ep'), '../diyet/index.html?medlab=1&medica=1&tab=ep&vaka=e-inme');
  assert.equal(MV.devirAdres(SEN['ody-v-ome'], 'vaka'), '../odyoloji/index.html?medlab=1&medica=1&tab=vaka&vaka=v-ome');
  assert.equal(MV.devirAdres(SEN['dkt-pd'], 'vaka'), '../dkt/index.html?medlab=1&medica=1&tab=vaka&vaka=pd');
  for (const s of Object.values(SEN)) assert.ok(MV.devirAdres(s, s.adimlar[s.adimlar.length - 1].hedef), s.id);
});

test('lab’lar: vaka sekmesi yalnız ?medica=1 ile görünür, sonuç hastaneye bildirilir', () => {
  const axmd = /if\(\/\[\?&\]medica=1\(&\|\$\)\/\.test\(location\.search\)\)document\.documentElement\.classList\.add\('axmd'\)/;
  for (const p of ['labs/anatomi/index.html', 'labs/fizyo/index.html', 'labs/diyet/index.html', 'labs/odyoloji/index.html', 'labs/dkt/index.html']) assert.match(read(p), axmd, p);
  assert.match(read('labs/anatomi/index.html'), /html:not\(\.axmd\) \.modes button\[data-mode=vaka\]\{display:none\}/);
  assert.match(read('labs/diyet/index.html'), /html:not\(\.axmd\) \.dl-tabs \[data-tab="vaka"\],html:not\(\.axmd\) \.dl-tabs \[data-tab="ep"\]\{display:none\}/);
  assert.match(read('labs/odyoloji/index.html'), /html:not\(\.axmd\) \.ol-tabs \[data-tab="vaka"\]\{display:none\}/);
  assert.match(read('labs/dkt/index.html'), /html:not\(\.axmd\) \.tk-tabs \[data-tab="vaka"\]\{display:none\}/);
  /* sekme seçimi de korunur: eski kayıtlı "vaka" sekmesi hastane dışında açılmaz */
  assert.match(read('labs/diyet/diyet-app.js'), /\(!MEDICA && \(k === 'vaka' \|\| k === 'ep'\)\)\) k = 'tabak'/);
  assert.match(read('labs/odyoloji/odyo-app.js'), /if \(k === 'vaka' && !MEDICA\) k = 'kabin';/);
  assert.match(read('labs/dkt/dkt-app.js'), /var TABS = MEDICA \? \[[^\]]+'vaka'\] : \['sesletim', 'ses', 'akicilik', 'yutma', 'dil'\];/);
  /* sonuç bildirimi */
  for (const [p, lab] of [['labs/diyet/diyet-klinik.js', 'diyet'], ['labs/odyoloji/odyo-app.js', 'odyoloji'], ['labs/dkt/dkt-vaka.js', 'dkt'], ['labs/anatomi/index.html', 'anatomi'], ['labs/fizyo/index.html', 'fizyo']]) {
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

test('hastane sayfası: betik sırası, rehber cerrah, asansör, erişilebilirlik', () => {
  const h = read('labs/medica/index.html'), at = (f) => h.indexOf('src="' + f + '"');
  assert.ok(at('../diyet/diyet-model.js') < at('../klinik/klinik.js'));
  assert.ok(at('../klinik/klinik.js') < at('../klinik/senaryo-diyet.js') && at('../klinik/senaryo-dkt.js') < at('medica-veri.js') && at('medica-veri.js') < at('medica.js'));
  assert.match(h, /<iframe title="Lab: vaka formu" allow="fullscreen; microphone" allowfullscreen><\/iframe>/, 'DKT ses laboratuvarı mikrofonu');
  assert.match(h, /@media \(prefers-reduced-motion:reduce\)/);
  const js = read('labs/medica/medica.js');
  assert.match(js, /class="maske"/, 'rehber cerrah maskeli'); assert.match(js, /eldiven/);
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
  const a = read('js/acadex-medlab-acadia.js');
  assert.match(a, /medica: 'Acadex Medica'/); assert.match(a, /medica: 'sağlık bilimleri öğrencisine'/);
});

summary();
