/* ==========================================================================
   ACADEX — ACADEX ŞİRKET (tests/sirket-lab.js)

   NEDEN VAR (29.10.2026): Acadex Finans paneline "genel müdürlük" bölümü
   eklendi; yedi katlı şirket yönetimi laboratuvarı labs/sirket/ altında
   (çekirdek ../finans/fn-app.js, FN_CONF ile). Bu test şunları tutar:
     - Bilanço terazisi: her olay kendi içinde dengeli; seçeneklerde tek
       doğru var; ay sonu aktif = pasif; gelir tablosu, doğrudan ve dolaylı
       nakit akışı birbirini tutar
     - Başabaş, hedef kâr, faaliyet kaldıracı, bütçe sapmaları
     - NBD/İVO/geri ödeme; bütçe içinde en yüksek toplam NBD
     - Kontrol alanı → kademe ve yönetici sayısı
     - Simülasyon: rastgele kararlarla her çeyrek aktif = pasif, kasa eksiye
       düşmez (acil kredi açılır), karne 0–100
     - Gerçek kurallar: TTK asgari sermaye (A.Ş. 250.000 TL, Ltd. 50.000 TL)
     - Hub bağlantısı: yedi kat düğmesi, açılış anahtarları, Acadia köprüsü

   Calistirma:  node tests/sirket-lab.js
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

const ctx = { window: {}, Math, JSON, isFinite, Number, String, Array, Object, parseFloat };
vm.createContext(ctx);
vm.runInContext(read('labs/sirket/sk-veri.js'), ctx);
vm.runInContext(read('labs/sirket/sk-model.js'), ctx);
const V = ctx.window.AXSK, M = ctx.window.SKM;
const nf = (v) => String(v);
ctx.window.FN = { st: {}, bridgeSend() {} };
ctx.window.FN.core = { V: {}, $: () => null, $$: () => [], X: (s) => s, ls: { get: (k, d) => d, set() {} }, nf, tl: nf, pct: nf, num: Number, clamp: (v, a, b) => Math.max(a, Math.min(b, v)), shuffle: (a) => a.slice(), RM: true, chart: () => '', tip: () => '', karne: () => '', hesi: () => '<svg></svg>', live() {}, toast() {}, setTab() {} };
const ST = ['terazi', 'tablolar', 'maliyet', 'yatirim', 'strateji', 'org', 'sim'];
vm.runInContext(read('labs/sirket/sk-app.js'), ctx);
ST.forEach((k) => vm.runInContext(read('labs/sirket/sk-' + k + '.js'), ctx));
const FN = ctx.window.FN;
const near = (a, b, e, m) => assert.ok(Math.abs(a - b) <= e, (m || '') + ' ' + a + ' ≠ ' + b);
const K = V.KALEM;

test('yedi kat kayıtlı; index.html hepsini ve ortak çekirdeği yüklüyor', () => {
  const html = read('labs/sirket/index.html');
  ST.forEach((k) => {
    assert.ok(FN.st[k] && typeof FN.st[k].init === 'function' && typeof FN.st[k].ctx === 'function', k);
    assert.match(html, new RegExp('<section class="pt-view" id="' + k + '"'));
    assert.match(html, new RegExp('<script src="sk-' + k + '\\.js"></script>'));
    assert.match(html, new RegExp('data-tab="' + k + '"'));
  });
  assert.ok(html.indexOf('window.FN_CONF') < html.indexOf('<script src="../finans/fn-app.js">'), 'FN_CONF çekirdekten önce tanımlanmalı');
  assert.ok(html.indexOf('sk-model.js') < html.indexOf('sk-app.js'));
  const all = ['veri', 'model', 'app'].concat(ST).map((f) => read('labs/sirket/sk-' + f + '.js')).join('\n');
  assert.doesNotMatch(all, /fetch\(|XMLHttpRequest|supabase/, 'lab ağ isteği yapmaz');
  const core = read('labs/finans/fn-app.js');
  assert.match(core, /var CONF = W\.FN_CONF \|\| \{\};/);
  assert.match(core, /m\.lab = LAB;/);
});

test('terazi: açılış ve her olay dengeli; ay sonu aktif = pasif', () => {
  assert.ok(M.balanced(V.ACILIS, K), 'açılış bilançosu');
  let b = V.ACILIS;
  V.OLAY.forEach((e) => { assert.ok(M.evBalanced(e, K), 'olay ' + e.id); b = M.apply(b, e); assert.ok(M.balanced(b, K), 'olay sonrası ' + e.id); });
  assert.equal(M.side(b, K, 'A'), 645);
  assert.equal(b.kasa, 270);
  assert.equal(V.OLAY.length, 12);
});

test('terazi: seçeneklerin tam biri doğru, çeldiriciler farklı; tek taraflı kayıt dengeyi bozar', () => {
  V.OLAY.forEach((e) => {
    const ops = FN.terazi.options(e), keys = ops.map((o) => JSON.stringify(Object.keys(o.fx).sort().map((k) => [k, o.fx[k]])));
    assert.equal(ops.filter((o) => o.ok).length, 1, 'olay ' + e.id);
    assert.ok(ops.length >= 3, 'en az iki çeldirici: olay ' + e.id);
    assert.equal(new Set(keys).size, keys.length, 'aynı seçenek iki kez: olay ' + e.id);
    ops.filter((o) => !o.ok).forEach((o) => assert.ok(o.why && o.why.length > 10));
    const one = ops.filter((o) => !o.ok && Object.keys(o.fx).length === 1)[0];
    if (one) assert.ok(!M.evBalanced({ fx: one.fx }, K), 'tek taraflı seçenek dengesiz olmalı: olay ' + e.id);
  });
  /* doğru seçenek hep aynı sırada durmasın */
  const pos = V.OLAY.map((e) => FN.terazi.options(e).findIndex((o) => o.ok));
  assert.ok(new Set(pos).size >= 3, 'doğru cevabın yeri: ' + pos.join(','));
});

test('üç tablo: net kâr, doğrudan ve dolaylı işletme nakdi, kasa değişimi tutarlı', () => {
  const g = M.gelir(V.OLAY), n = M.nakit(V.OLAY), son = V.OLAY.reduce((b, e) => M.apply(b, e), V.ACILIS);
  assert.equal(g.sat, 170); assert.equal(g.smm, 105); assert.equal(g.net, -5);
  assert.equal(g.net, son.kar, 'net kâr bilançodaki dönem kârına eşit');
  assert.equal(n.net, son.kasa - V.ACILIS.kasa, 'nakit akışı = kasa değişimi');
  assert.deepEqual([n.isletme, n.yatirim, n.finansman], [60, -60, 120]);
  assert.equal(M.dolayli(V.ACILIS, son, g, 20), n.isletme, 'dolaylı yöntem doğrudanı tutmalı');
  assert.equal(M.ndd(60, 45, 30), 75);
});

test('maliyet: başabaş, hedef kâr, güvenlik marjı, faaliyet kaldıracı, sapmalar', () => {
  const U = V.URUN;
  assert.equal(M.bep(U.sabit, U.fiyat, U.degisken), 5000);
  assert.equal(M.hedefAdet(U.sabit, U.hedefKar, U.fiyat, U.degisken), 7000);
  assert.equal(M.kar(7000, U.sabit, U.fiyat, U.degisken), 72000);
  near(M.fk(7000, U.sabit, U.fiyat, U.degisken), 3.5, 1e-12, 'FK');
  near(M.guvenlik(7000, U.sabit, U.fiyat, U.degisken), 2 / 7, 1e-12, 'güvenlik');
  assert.equal(M.bep(1000, 50, 60), Infinity, 'fiyat < değişken: başabaş yok');
  const s = M.sapma(V.BUTCE);
  near(s.satFiyat, 36800, 1e-6); near(s.satHacim, -72000, 1e-6); near(s.mFiyat, 15824, 1e-6); near(s.mMiktar, -22080, 1e-6);
  /* gerçekleşen − bütçe katkısı sapmaların toplamı (gelir ve malzeme ayrı ayrı) */
  near(s.gelirG - s.gelirB, s.satFiyat + s.satHacim, 1e-6, 'gelir köprüsü');
  near(s.malzB - s.malzG, s.mFiyat + s.mMiktar + (V.BUTCE.b.adet - V.BUTCE.g.adet) * V.BUTCE.b.kg * V.BUTCE.b.kgFiyat, 1e-6, 'malzeme köprüsü');
});

test('yatırım: NBD/İVO/geri ödeme; bütçe içinde en iyi bileşim', () => {
  near(M.npv(0.10, [-100, 110]), 0, 1e-9, 'npv');
  V.PROJE.forEach((p) => { const i = M.irr(p.cf); near(M.npv(i, p.cf), 0, 1e-6, p.k + ' irr'); assert.ok(M.npv(0.30, p.cf) > 0, p.k + ' %30\'da artı'); });
  assert.equal(M.payback([-100, 50, 50, 50]), 2);
  near(M.payback([-100, 40, 40, 40]), 2.5, 1e-12);
  const best = M.best(0.30, V.PROJE, V.YATIRIM_BUTCE);
  assert.ok(best.cost <= V.YATIRIM_BUTCE);
  assert.deepEqual(Array.from(best.set).sort(), ['dijital', 'hat']);
  /* en yüksek İVO'lu projelerden bütçeye sığanları sırayla seçmek (açgözlü) daha düşük NBD verir mi? (öğretici tuzak) */
  const byIrr = V.PROJE.slice().sort((a, b) => M.irr(b.cf) - M.irr(a.cf)); let c = 0, v = 0;
  byIrr.forEach((p) => { if (c - p.cf[0] <= V.YATIRIM_BUTCE) { c -= p.cf[0]; v += M.npv(0.30, p.cf); } });
  assert.ok(best.npv >= v - 1e-9);
  assert.equal(M.best(0.45, V.PROJE, V.YATIRIM_BUTCE).set.length, 0, '%45\'te hiçbir proje değer yaratmaz');
});

test('organizasyon: kontrol alanı → kademe ve yönetici', () => {
  assert.deepEqual(Array.from(M.kademe(240, 6).seviye), [40, 7, 2, 1]);
  assert.equal(M.kademe(240, 6).yonetici, 50);
  assert.ok(M.kademe(1000, 4).kademe > M.kademe(1000, 12).kademe, 'dar alan daha çok kademe');
  /* TTK asgari sermaye (7887 sayılı CB Kararı, 1.1.2024) */
  const tur = V.TUR.map((t) => t.s).join(' ');
  assert.match(tur, /250\.000 TL/); assert.match(tur, /50\.000 TL/); assert.match(tur, /500\.000 TL/);
  assert.match(tur, /1–50 ortak/);
  V.TUR_SORU.forEach((q) => assert.ok(V.TUR.some((t) => t.k === q[1]), q[0]));
  V.YAPI_SORU.forEach((q) => assert.ok(V.YAPI.some((t) => t.k === q[1]), q[0]));
  const bcg = { Y: [1, 1], I: [0, 1], S: [1, 0], K: [0, 0] };
  V.BCG.forEach((p) => assert.deepEqual([p.g >= 10 ? 1 : 0, p.rp >= 1 ? 1 : 0], bcg[p.d], p.ad));
  assert.equal(V.SWOT.filter((c) => 'GZFT'.indexOf(c[1]) > -1).length, V.SWOT.length);
});

test('simülasyon: rastgele kararlarla her çeyrek aktif = pasif, kasa eksiye düşmez, karne 0–100', () => {
  const C = V.SIM;
  assert.equal(M.aktif(M.simBas(C)), M.pasif(M.simBas(C)), 'açılış dengeli');
  assert.equal(C.vergi, 0.25);
  let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  let acilGordu = false;
  for (let run = 0; run < 40; run++) {
    let s = M.simBas(C);
    for (let q = 0; q < C.ceyrek; q++) {
      const g = V.GUNDEM[q], opt = g.s[Math.floor(rnd() * g.s.length)];
      const d = { fiyat: 250 + Math.round(rnd() * 46) * 5, uretim: Math.round(rnd() * 200000), vade: [0, 30, 60, 90][Math.floor(rnd() * 4)], pazarlama: Math.round(rnd() * 24) * 250000, isci: Math.round(rnd() * 90) - 30, kredi: (Math.round(rnd() * 20) - 8) * 2500000 };
      const o = M.ceyrek(s, d, C, opt.fx); s = o.s;
      near(o.r.aktif, o.r.pasif, 1e-3, 'run ' + run + ' ç' + o.r.q + ' A=P');
      assert.ok(s.kasa >= 0, 'kasa eksi olamaz');
      assert.ok(s.kredi >= 0 && s.acil >= 0 && s.isci >= 20 && s.stokAdet >= 0);
      assert.ok(o.r.gelirT.vergi >= 0 && o.r.op.satis <= o.r.op.talep && o.r.op.uretim <= o.r.op.kapasite);
      near(o.r.nakitT.net, o.r.bil.kasa - (q ? s.gecmis[q - 1].bil.kasa : C.acilis.kasa), 1e-3, 'nakit akışı = kasa değişimi');
      if (s.acil > 0) acilGordu = true;
    }
    const k = M.karne(s, C); assert.ok(k.puan >= 0 && k.puan <= 100, 'karne ' + k.puan);
    if (k.iflas) assert.ok(k.puan <= 10);
  }
  assert.ok(acilGordu, 'kötü kararlarda acil kredi devreye girmeli');
});

test('simülasyon: makul bir yönetim zarar ettirmez, aşırı ucuz fiyat batırır', () => {
  const C = V.SIM;
  const oyna = (kar) => { let s = M.simBas(C); for (let q = 0; q < 8; q++) { const o = M.ceyrek(s, kar(s, q), C, V.GUNDEM[q].s[q === 1 ? 1 : 0].fx); s = o.s; } return M.karne(s, C); };
  const iyi = oyna((s, q) => { const f = [340, 345, 360, 370, 375, 375, 380, 380][q], isci = [6, 10, 6, 0, 0, 0, 0, 0][q]; const a = M.cekim(s, C, f, 30, 2e6), pay = a / (a + C.rakipCekim);
    return { fiyat: f, uretim: Math.max(0, M.pazar(s, C) * pay * 1.05 - s.stokAdet), vade: 30, pazarlama: 2e6, isci, kredi: 0 }; });
  assert.ok(!iyi.iflas && iyi.top > 0, 'makul yönetim kâr etmeli: ' + iyi.top);
  const kotu = oyna(() => ({ fiyat: 250, uretim: 200000, vade: 90, pazarlama: 6e6, isci: 30, kredi: 0 }));
  assert.ok(kotu.top < 0 && kotu.puan < iyi.puan, 'zararına satış kötü karne almalı');
});

test('hub: yedi kat düğmesi, açılış anahtarları, Acadia köprüsü, arama', () => {
  const dash = read('dashboard.html'), fin = read('js/acadex-finans.js'), aca = read('js/acadex-medlab-acadia.js'), plus = read('js/acadex-plus.js');
  const hq = dash.slice(dash.indexOf('class="axf-hq'), dash.indexOf('</section>', dash.indexOf('class="axf-hq')));
  ST.forEach((k) => assert.match(hq, new RegExp('data-finans-open="sirket-' + k + '"'), k));
  ST.forEach((k) => assert.match(fin, new RegExp('\\b' + k + ": '"), 'SK haritası: ' + k));
  assert.match(fin, /src: 'labs\/sirket\/index\.html'/);
  assert.match(fin, /curLab !== I\.lab/, 'farklı lab açılınca iframe yeniden yüklenmeli');
  assert.match(fin, /axMedLabHook\(I\.lab, frame\)/);
  assert.match(aca, /sirket: 'Acadex Şirket'/);
  assert.match(plus, /t: 'Acadex Şirket'[^}]+v: 'finans' \}/);
  assert.match(read('css/acadex-finans.css'), /\.axf-hq\{/);
});

summary();
