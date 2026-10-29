/* ==========================================================================
   ACADEX — ACADEX FİNANS (tests/finans-lab.js)

   NEDEN VAR (29.10.2026): Dashboard'a MedLab benzeri "Acadex Finans" hub'ı
   eklendi (#finans-view, js/acadex-finans.js) ve sekiz istasyonlu "ticaret
   limanı" laboratuvarı (labs/finans/). Bu test, istasyonlardaki hesapların ve
   gerçek kural setlerinin kodda bozulmadığını tutar:
     - Paranın zaman değeri: bileşik faiz, efektif faiz, NBD, İVO, anüite
     - Muhasebe: her fiş dengeli; ay sonu KDV mahsubu; bilanço denk
     - Incoterms® 2020: 11 kural, 4'ü yalnız deniz; CIF'te ICC (C), CIP'te ICC (A)
       (sigorta satıcıda), DPU tek boşaltan, DDP ithalat vergisi satıcıda
     - Portföy: kurgusal veri hedef ortalama/sapma/betaya oturur
     - Forward: örtülü faiz paritesi · Black–Scholes: alım-satım paritesi
     - Kişisel finans: asgari ödeme > sabit ödeme faizi; Fisher
   Ayrıca hub bağlantısı: kenar menü, kartlar, Acadia köprüsü, menüler.

   Calistirma:  node tests/finans-lab.js
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

/* labı DOM'suz yükle: çekirdek (fn-app) yerine küçük bir taklit; istasyonların hesap fonksiyonları FN.<ad> altında */
const ctx = { window: {}, Math, JSON, isFinite, Number, String, Array, Object, parseFloat };
ctx.window.FN = { st: {} };
vm.createContext(ctx);
vm.runInContext(read('labs/finans/fn-veri.js'), ctx);
const V = ctx.window.AXFIN;
const nf = (v) => String(v);
ctx.window.FN.core = { V, $: () => null, $$: () => [], X: (s) => s, ls: { get: (k, d) => d, set() {} }, nf, tl: nf, pct: nf, num: Number, clamp: (v, a, b) => Math.max(a, Math.min(b, v)), shuffle: (a) => a.slice(), RM: true, chart: () => '', tip: () => '', karne: () => '', hesi: () => '', live() {}, toast() {} };
['zaman', 'muhasebe', 'borsa', 'dis', 'analiz', 'makro', 'turev', 'kisisel'].forEach((f) => vm.runInContext(read('labs/finans/fn-' + f + '.js'), ctx));
const FN = ctx.window.FN;
const near = (a, b, e, m) => assert.ok(Math.abs(a - b) <= e, (m || '') + ' ' + a + ' ≠ ' + b);
const dash = read('dashboard.html');

test('sekiz istasyon kayıtlı ve index.html hepsini yüklüyor', () => {
  const html = read('labs/finans/index.html');
  ['zaman', 'muhasebe', 'borsa', 'dis', 'analiz', 'makro', 'turev', 'kisisel'].forEach((k) => {
    assert.ok(FN.st[k] && typeof FN.st[k].init === 'function' && typeof FN.st[k].ctx === 'function', k);
    assert.match(html, new RegExp('<section class="pt-view" id="' + k + '"'));
    assert.match(html, new RegExp('<script src="fn-' + k + '\\.js"></script>'));
  });
  const all = ['veri', 'app', 'zaman', 'muhasebe', 'borsa', 'dis', 'analiz', 'makro', 'turev', 'kisisel'].map((f) => read('labs/finans/fn-' + f + '.js')).join('\n');
  assert.doesNotMatch(all, /fetch\(|XMLHttpRequest|supabase/, 'lab ağ isteği yapmaz');
});

test('zaman değeri: bileşik faiz, efektif faiz, NBD, İVO, anüite', () => {
  const Z = FN.zaman;
  near(Z.fv(1000, 0.10, 2, 1), 1210, 1e-9, 'fv');
  near(Z.eff(0.12, 12), 0.126825, 1e-6, 'efektif');
  near(Z.eff(0.10, 0), Math.exp(0.1) - 1, 1e-12, 'sürekli');
  const cf = [-1000, 300, 350, 400, 300, 200];
  near(Z.npv(0.15, cf), 59.5, 0.1, 'npv');
  const i = Z.irr(cf); near(Z.npv(i, cf), 0, 1e-6, 'irr npv=0'); near(i, 0.176, 0.001, 'irr');
  assert.equal(Z.irr([100, 100]), null, 'işaret değişmezse İVO yok');
  const p = Z.plan(100000, 0.032, 12, 'anuite');
  near(p[0][1], 10166.52, 0.01, 'taksit'); near(p[11][4], 0, 1e-6, 'son kalan');
  near(p.reduce((a, r) => a + r[3], 0), 100000, 1e-6, 'anapara toplamı');
  const e = Z.plan(100000, 0.032, 12, 'esit');
  assert.ok(e.reduce((a, r) => a + r[2], 0) < p.reduce((a, r) => a + r[2], 0), 'eşit anaparada faiz daha az');
});

test('muhasebe: her fiş dengeli, ay sonu KDV mahsubu ve bilanço denk', () => {
  const codes = new Set(V.HESAP.map((h) => h[0]));
  V.ISLEM.forEach((is) => {
    let b = 0, a = 0; is.s.forEach((l) => { assert.ok(codes.has(l[0]), is.id + ' ' + l[0]); if (l[2] === 'B') b += l[1]; else a += l[1]; });
    assert.equal(b, a, 'fiş ' + is.id + ' dengesiz');
    const o = FN.muhasebe.options(is);
    assert.ok(o.length >= 3, 'fiş ' + is.id + ' en az 3 seçenek');
    assert.equal(o.filter((x) => x.ok).length, 1, 'fiş ' + is.id + ' tek doğru');
  });
  const f = FN.muhasebe.finals();
  assert.equal(JSON.stringify(f.kdv), JSON.stringify([['391', 30000, 'B'], ['190', 17600, 'B'], ['191', 47600, 'A']]));
  assert.equal(f.gt.net, 51000);
  assert.equal(f.A, f.P); assert.equal(f.A, 787000);
  /* ihracat KDV'siz (istisna), yurt içi satış %20 KDV */
  const ih = V.ISLEM.find((x) => x.s.some((l) => l[0] === '601'));
  assert.ok(!ih.s.some((l) => l[0] === '391'));
  const yi = V.ISLEM.find((x) => x.s.some((l) => l[0] === '600'));
  assert.equal(yi.s.find((l) => l[0] === '391')[1], yi.s.find((l) => l[0] === '600')[1] * 0.20);
});

test('Incoterms 2020: 11 kural, deniz kuralları, sigorta ve boşaltma yükümlülükleri', () => {
  const I = Object.fromEntries(V.INCO.map((r) => [r.k, r]));
  assert.equal(V.INCO.map((r) => r.k).join(), 'EXW,FCA,FAS,FOB,CFR,CIF,CPT,CIP,DAP,DPU,DDP');
  assert.equal(V.INCO.filter((r) => r.mod === 'deniz').map((r) => r.k).join(), 'FAS,FOB,CFR,CIF');
  V.INCO.forEach((r) => assert.match(r.m, /^[SAsa]{10}$/, r.k));
  /* 5: ana taşıma sigortası, 4: navlun, 8: ithalat vergisi, 9: alıcı deposunda boşaltma, 1: ihracat gümrüğü */
  assert.equal(I.CIF.m[5], 'S'); assert.equal(I.CIP.m[5], 'S');
  V.INCO.filter((r) => r.k !== 'CIF' && r.k !== 'CIP').forEach((r) => assert.equal(r.m[5], r.m[5].toLowerCase(), r.k + ' sigorta zorunlu değil'));
  assert.match(I.CIF.not, /ICC \(C\)/); assert.match(I.CIP.not, /ICC \(A\)/);
  assert.equal(I.EXW.m[1], 'A'); assert.equal(I.FCA.m[1], 'S');
  ['CFR', 'CIF', 'CPT', 'CIP'].forEach((k) => assert.equal(I[k].m[4], 'S', k + ' navlun satıcıda'));
  ['FOB', 'CFR', 'CIF'].forEach((k) => assert.equal(I[k].risk, 2, k + ' risk gemide'));
  assert.equal(V.INCO.filter((r) => r.m[9] === 'S').map((r) => r.k).join(), 'DPU');
  assert.equal(V.INCO.filter((r) => r.m[8] === 'S').map((r) => r.k).join(), 'DDP');
  V.INCO_SORU.forEach((q) => assert.ok(I[q.k], q.k));
  assert.match(V.LC_ADIM[6][3], /UCP 600: en çok 5 iş günü/);
  const L = FN.dis.landed({ fob: 20000, nav: 1800, sig: 0.3, kur: 40, gv: 8, dig: 12000 });
  near(L.cif, 21871.94, 0.01, 'cif'); near(L.kdv, (L.kiy + L.gv + 12000) * 0.2, 1e-6, 'kdv matrahı');
});

test('portföy: kurgusal veri hedefe oturur, istatistikler tutarlı', () => {
  const B = FN.borsa;
  near(B.MUM, V.ENDEKS.mu, 1e-9, 'endeks ortalaması');
  V.HISSE.forEach((h, i) => { near(B.BETA[i], h.beta, 1e-9, h.k + ' beta'); near(B.MU[i], V.RF + h.alfa + h.beta * (V.ENDEKS.mu - V.RF), 1e-9, h.k + ' getiri'); });
  const eq = B.stats([0.2, 0.2, 0.2, 0.2, 0.2]), avg = [0, 1, 2, 3, 4].reduce((a, i) => a + 0.2 * Math.sqrt(B.SIG[i][i]), 0);
  assert.ok(eq.sd < avg, 'çeşitlendirme riski düşürür');
  assert.ok(B.minV.sd <= eq.sd && B.maxS.sh >= eq.sh);
  assert.equal(B.growth([1, 0, 0, 0, 0]).p.length, V.AY + 1);
});

test('forward faiz paritesi, Fisher, Black–Scholes paritesi', () => {
  near(FN.makro.fwd(40, 0.36, 0.045, 90), 43.11, 0.005, 'forward');
  near(FN.makro.fisher(0.45, 0.33), 0.0902, 0.0001, 'fisher');
  const r = FN.turev.bs(100, 100, 0.25, 0.05, 0.2);
  near(r.c, 4.615, 0.002, 'call'); /* Hull örneği: S=K=100, T=.25, r=5%, σ=20% */
  near(r.c - r.p, 100 - 100 * Math.exp(-0.05 * 0.25), 1e-9, 'parite');
  near(FN.turev.ncdf(1.96), 0.975, 1e-4, 'N(1.96)');
  const st = Object.fromEntries(V.STRAT.map((s) => [s.k, s]));
  const lc = FN.turev.info(st.lcall.bac); assert.equal(lc.max, Infinity); near(lc.min, -6, 1e-9); near(lc.be[0], 106, 0.2);
  const sc = FN.turev.info(st.scall.bac); assert.equal(sc.min, -Infinity);
  const bu = FN.turev.info(st.bull.bac); near(bu.max, 15 - 5.5, 1e-6); near(bu.min, -5.5, 1e-6);
});

test('kişisel finans: asgari ödeme pahalı, birikim hedefi tutar', () => {
  const K = FN.kisisel, a = K.card(30000, 0.0425, 0.2, 0), s = K.card(30000, 0.0425, 0, 6000);
  assert.ok(a.tf > s.tf && a.m > s.m);
  assert.equal(K.card(30000, 0.05, 0, 1000).m, Infinity, 'faizi karşılamayan ödeme bitmez');
  const g = K.goal(150000, 3, 0.40, 0.30); let bal = 0; for (let i = 0; i < g.n; i++) bal = bal * (1 + g.rm) + g.pmt;
  near(bal, 150000, 0.01, 'hedefe ulaşılır');
});

test('analiz: firma bilançoları denk, soruların cevabı veriden çıkar', () => {
  V.FIRMA.forEach((f) => assert.equal(f.hz + f.ala + f.sto + f.dv, f.kv + f.uv + f.oz, f.k));
  const ans = FN.analiz.QS.map((q) => FN.analiz.winner(q[1], q[2]));
  assert.equal(ans.join(), 'pamuk,pamuk,yesil,yesil');
});

test('hub: kenar menü, sekiz kart, katman, Acadia köprüsü ve menüler', () => {
  assert.match(dash, /<li class="sidebar-item" id="side-finans"><a href="#finans" onclick="switchDashboardView\('finans'\)">/);
  assert.match(dash, /<section id="finans-view" class="dashboard-view-section axd axf">/);
  const keys = [...dash.matchAll(/data-finans-open="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(keys, ['zaman', 'muhasebe', 'borsa', 'dis', 'analiz', 'makro', 'turev', 'kisisel']);
  assert.match(dash, /<link rel="stylesheet" href="css\/acadex-finans\.css">/);
  assert.ok(dash.indexOf('js/acadex-finans.js') < dash.indexOf('js/acadex-medlab-acadia.js'), 'finans köprüden önce yüklenir');
  const js = read('js/acadex-finans.js');
  assert.match(js, /\?hub=1&tab=/); assert.match(js, /axMedLabHook\('finans', frame\)/); assert.match(js, /type: 'tab'/);
  const ac = read('js/acadex-medlab-acadia.js');
  assert.match(ac, /finans: 'Acadex Finans'/); assert.match(ac, /finans: 'işletme, iktisat, muhasebe ve uluslararası ticaret öğrencisine'/);
  assert.match(read('labs/finans/fn-app.js'), /m\.lab = 'finans'/);
  assert.match(read('js/acadex-ink.js'), /finans: 'Acadex Finans'/);
  assert.match(read('js/acadex-plus.js'), /v: 'finans' \}/);
});

summary();
