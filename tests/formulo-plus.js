/* ==========================================================================
   ACADEX — FORMULO: SINAV, TÜRETME, ROZET/SERİ, HATA BİLDİR (tests/formulo-plus.js), 08.11.2026

   NEDEN VAR: Formulo paneline dört özellik eklendi (formulo/assets/formulo-plus.js,
   formulo-turet.js, formulo-plus.css):
     1) Sınav modu: ders sayfasında 10/20 soruluk, süreli, karışık seviyeli deneme;
        sınavda geri bildirim yok, sonunda puan + konu dökümü + adım adım çözüm.
     2) "Nereden geliyor?": 16 temel formülün türetmesi tahtada adım adım.
     3) Rozet ve seri: seri bir gün atlanınca sıfırlanır (eskiden hiç sıfırlanmıyordu),
        12 rozet, paftalarda ilerleme çubuğu. Yeni anahtarlar hesaba eşitlenir.
     4) Hata bildir: kartın ⚑ düğmesi, canlı destek RPC'leriyle yönetim paneline düşer.
   Tarayıcı ucu (sınav akışı, türetme tahtası, bildirim RPC'leri, rozet bildirimi,
   telefon görünümü) Playwright ile denendi.
   Çalıştırma:  node tests/formulo-plus.js
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
const J = (x) => JSON.parse(JSON.stringify(x));

/* veri + türetme + plus modülünü tarayıcısız yükle */
function yukle(ek) {
  const ls = {}, olay = {};
  const document = {
    readyState: 'complete', body: { appendChild() {}, classList: { add() {}, remove() {} } },
    addEventListener(n, f) { (olay[n] = olay[n] || []).push(f); }, dispatchEvent(e) { (olay[e.type] || []).forEach((f) => f(e)); },
    querySelector() { return null; }, querySelectorAll() { return []; }, createElement() { return { innerHTML: '', querySelector() { return null; } }; }
  };
  const ctx = Object.assign({
    document, localStorage: { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: (k) => { delete ls[k]; } },
    matchMedia: () => ({ matches: false }), setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    CustomEvent: function (type, o) { this.type = type; this.detail = o && o.detail; }, location: { pathname: '/formulo/index.html', hash: '#/fiz1' },
    crypto: { getRandomValues: (a) => { for (let i = 0; i < a.length; i++) a[i] = i * 7 % 256; return a; } },
    JSON, Date, Math, Array, Object, String, Number, Uint8Array, Promise, Error, RegExp
  }, ek || {});
  ctx.window = ctx; vm.createContext(ctx);
  ['formulo/assets/formulo-veri.js', 'formulo/assets/formulo-veri-ek.js', 'formulo/assets/formulo-turet.js', 'formulo/assets/formulo-plus.js'].forEach((f) => vm.runInContext(read(f), ctx));
  return { W: ctx, P: ctx.FOPLUS, ls };
}
const al = (ls, k) => JSON.parse(ls['formulo.' + k] || 'null');

test('seri: aynı gün artmaz, ertesi gün artar, gün atlanınca 1’den başlar', () => {
  const { P } = yukle();
  assert.deepEqual(J(P.seriSonraki(null, 'G3', 'G2')), { n: 1, gun: 'G3', en: 1 });
  assert.deepEqual(J(P.seriSonraki({ n: 4, gun: 'G3', en: 6 }, 'G3', 'G2')), { n: 4, gun: 'G3', en: 6 }, 'aynı gün ikinci doğru seriyi artırmaz');
  assert.deepEqual(J(P.seriSonraki({ n: 4, gun: 'G2', en: 4 }, 'G3', 'G2')), { n: 5, gun: 'G3', en: 5 });
  assert.deepEqual(J(P.seriSonraki({ n: 9, gun: 'G0', en: 9 }, 'G3', 'G2')), { n: 1, gun: 'G3', en: 9 }, 'kopan seri sıfırlanır, en uzun kalır');
  assert.equal(P.seriGor({ n: 5, gun: 'G2' }, 'G3', 'G2'), 5, 'dün çözüldüyse seri hâlâ ayakta');
  assert.equal(P.seriGor({ n: 5, gun: 'G1' }, 'G3', 'G2'), 0, 'iki gün önce: kopmuş');
  const bd = P.bugunDun(new Date(2026, 2, 1, 10).getTime());
  assert.equal(bd[1], new Date(2026, 1, 28).toDateString(), 'ay başında dün = önceki ayın son günü');
});

test('doğru cevap olayı: sayaç, çalışılan formül, seri ve rozet', () => {
  const { W, P, ls } = yukle();
  W.document.dispatchEvent(new W.CustomEvent('formulo:dogru', { detail: { id: 'menzil', d: 'fiz1', sev: 'zor', kaynak: 'havuz' } }));
  W.document.dispatchEvent(new W.CustomEvent('formulo:dogru', { detail: { id: 'menzil', d: 'fiz1', sev: 'kolay', kaynak: 'dene' } }));
  const x = al(ls, 'istat');
  assert.equal(x.dogru, 2); assert.equal(x.zor, 1);
  assert.deepEqual(al(ls, 'calisilan'), ['menzil'], 'aynı formül bir kez sayılır');
  assert.equal(al(ls, 'seri').n, 1);
  assert.ok(al(ls, 'rozet').ilk, 'ilk doğruda "İlk adım" rozeti');
  assert.equal(al(ls, 'rozet').on, undefined, '10 doğru olmadan "Isınma" yok');
  P.dogruKaydet({ id: 'coulomb', sev: 'kolay' }); P.dogruKaydet({ id: 'turev-tanim', sev: 'kolay' }); P.dogruKaydet({ id: 'det2', sev: 'kolay' });
  assert.ok(al(ls, 'rozet').kasif, '4 farklı derste doğru: Kâşif');
});

test('rozetler: 12 rozet, eşikler sayaçlardan okunur', () => {
  const { P, ls } = yukle();
  assert.equal(P.ROZET.length, 12);
  assert.equal(new Set(P.ROZET.map((r) => r.id)).size, 12, 'kimlikler tekil');
  ls['formulo.istat'] = JSON.stringify({ dogru: 49, zor: 5, turetme: 2, sinav: 1, tam: 0, ogrendim: 5 });
  ls['formulo.seri'] = JSON.stringify({ n: 1, gun: 'x', en: 7 });
  const d = Object.fromEntries(P.rozetDurum().map((r) => [r.r.id, r.tamam]));
  assert.equal(d.on, true); assert.equal(d.elli, false); assert.equal(d.zor5, true); assert.equal(d.seri7, true, 'en uzun seri sayılır');
  assert.equal(d.turet3, false); assert.equal(d.sinav1, true); assert.equal(d.tam, false); assert.equal(d.ogrendim5, true);
  P.ROZET.forEach((r) => { assert.ok(r.tr && r.en && r.trA && r.enA, r.id + ' iki dilde'); });
});

test('türetmeler: 16 formül, her ders için en az iki, kimlikler veride var', () => {
  const { W, P } = yukle();
  const T = W.FORMULO_TURET, ids = Object.keys(T);
  assert.equal(ids.length, 16);
  ids.forEach((id) => {
    const f = W.FORMULO.formuller.find((x) => x.id === id);
    assert.ok(f, id + ' formül verisinde yok');
    assert.ok(T[id].length >= 4 && T[id].length <= 6, id + ' 4-6 adım');
    T[id].forEach((a, i) => { assert.ok(a.tr && a.en && a.m, id + ' adım ' + (i + 1) + ' eksik'); if (Array.isArray(a.m)) assert.equal(a.m.length, 2); });
    assert.equal(P.turetVar(id), true);
  });
  const ders = {}; ids.forEach((id) => { const d = W.FORMULO.formuller.find((x) => x.id === id).d; ders[d] = (ders[d] || 0) + 1; });
  W.FORMULO.dersler.forEach((d) => assert.ok(ders[d.id] >= 2, d.id + ' dersinde türetme az'));
  assert.equal(P.turetVar('olmayan-formul'), false);
});

test('sınav: seviye dağılımı ve tekrarsız soru seçimi', () => {
  const { W, P } = yukle();
  const say = (a) => a.reduce((o, s) => ((o[s] = (o[s] || 0) + 1), o), {});
  assert.deepEqual(say(J(P.sevSira(10))), { kolay: 4, orta: 4, zor: 2 });
  assert.deepEqual(say(J(P.sevSira(20))), { kolay: 8, orta: 8, zor: 4 });
  /* sahte soru üretici: hep aynı soruyu döndürse bile sınav sonsuz döngüye girmez */
  let n = 0;
  W.FORMULO_SORU = { uret: () => ({ tip: 'kolay', f: W.FORMULO.formuller[0], dogru: 1, s: 'x', birim: '' }), soruMetni: () => 'ayni', verilenler: () => '' };
  const qs = P.sorular(W.FORMULO.dersler[0], '', 10); assert.equal(qs.length, 10);
  W.FORMULO_SORU = { uret: () => ({ tip: 'orta', f: W.FORMULO.formuller[n % 5], dogru: 1, s: 'x', birim: '' }), soruMetni: () => 'q' + (n++), verilenler: () => '' };
  const q2 = P.sorular(W.FORMULO.dersler[0], '', 10);
  assert.equal(new Set(q2.map((q) => W.FORMULO_SORU.soruMetni.call(null, q))).size, 10);
  W.FORMULO_SORU = { uret: () => ({ yok: true }) };
  assert.equal(P.sorular(W.FORMULO.dersler[0], 'bos', 10).length, 0, 'soru yoksa boş döner');
});

test('hata bildir: canlı destek RPC’leri, oturum bilgisi ve gövde', async () => {
  const cagri = [];
  const sb = { auth: { getSession: async () => ({ data: { session: { user: { email: 'o@ornek.com', user_metadata: { full_name: 'Öğrenci Adı' } } } } }) }, rpc: async (n, a) => { cagri.push([n, a]); return { data: { id: 1 }, error: null }; } };
  const { W, P } = yukle({ supabaseClient: sb });
  const f = W.FORMULO.formuller.find((x) => x.id === 'menzil');
  await P.bildirGonder(f, 'Formül yanlış', 'kısa not');
  assert.deepEqual(cagri.map((c) => c[0]), ['support_open', 'support_send']);
  const o = cagri[0][1], s = cagri[1][1];
  assert.match(o.p_token, /^[0-9a-f]{48}$/, '48 karakterlik jeton (RPC 32-128 ister)');
  assert.equal(s.p_token, o.p_token);
  assert.equal(o.p_topic, 'Formulo hata'); assert.equal(o.p_email, 'o@ornek.com'); assert.equal(o.p_name, 'Öğrenci Adı');
  assert.ok(o.p_page.length <= 300 && /menzil/.test(o.p_page));
  assert.match(s.p_body, /Tür: Formül yanlış/); assert.match(s.p_body, /Formül: menzil · Eğik atış menzili/); assert.match(s.p_body, /Not: kısa not/);
  assert.ok(s.p_body.length <= 2000);
  assert.equal(s.p_bot, undefined, 'öğrenci mesajı olarak gider');
  const hatali = yukle({ supabaseClient: { auth: sb.auth, rpc: async () => ({ data: null, error: { message: 'DESTEK_SINIR' } }) } });
  await assert.rejects(hatali.P.bildirGonder(f, 'Diğer', ''), (e) => /DESTEK_SINIR/.test(e.message), 'sınır hatası yukarı iletilir (ekranda "biraz sonra dene")');
});

test('hesaba kayıt: yeni anahtarlar eşitlenir ve doğru birleşir', () => {
  const ls = {};
  const ctx = { window: {}, document: { readyState: 'loading', addEventListener() {}, dispatchEvent() {} }, localStorage: { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: (k) => { delete ls[k]; } }, setTimeout, clearTimeout, CustomEvent: function () {}, JSON, Date, Math, Array, Object };
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(read('formulo/assets/formulo-bulut.js'), ctx);
  const B = ctx.FOBULUT;
  ['istat', 'calisilan', 'rozet', 'sinavlar'].forEach((k) => assert.ok(B.ANAH.includes(k), k + ' eşitlenmiyor'));
  const m = J(B.birlestir(
    { veri: { istat: { dogru: 5, zor: 3 }, calisilan: ['a'], rozet: { ilk: 50 }, sinavlar: [{ ts: 1, d: 'x', n: 10, dogru: 5 }], seri: { n: 2, gun: 'g', en: 8 } }, zaman: {} },
    { veri: { istat: { dogru: 9, zor: 1 }, calisilan: ['a', 'b'], rozet: { ilk: 20, on: 30 }, sinavlar: [{ ts: 2, d: 'x', n: 10, dogru: 7 }, { ts: 1, d: 'x', n: 10, dogru: 5 }], seri: { n: 4, gun: 'h', en: 4 } }, zaman: {} }));
  assert.deepEqual(m.veri.istat, { dogru: 9, zor: 3 }, 'sayaçlarda büyük olan');
  assert.deepEqual(m.veri.calisilan, ['a', 'b']);
  assert.deepEqual(m.veri.rozet, { ilk: 20, on: 30 }, 'rozet ilk kazanıldığı anla kalır');
  assert.deepEqual(m.veri.sinavlar.map((s) => s.ts), [2, 1], 'tekrar yok, yeni önce');
  assert.equal(m.veri.seri.n, 4); assert.equal(m.veri.seri.en, 8, 'en uzun seri kaybolmaz');
});

test('bağlantılar: betik sırası, kart düğmeleri, olaylar', () => {
  const html = read('formulo/index.html');
  const i = (s) => html.indexOf(s);
  assert.ok(i('assets/formulo-plus.css') > i('assets/formulo-hoca.css'));
  assert.ok(i('<script src="assets/formulo-turet.js">') > -1 && i('<script src="assets/formulo-turet.js">') < i('<script src="assets/formulo-plus.js">'));
  assert.ok(i('<script src="assets/formulo-plus.js">') < i('<script src="assets/formulo.js">'), 'formulo.js çizerken W.FOPLUS hazır olmalı');
  const app = read('formulo/assets/formulo.js');
  assert.match(app, /data-bildir aria-label="' \+ W\.FOPLUS\.T\('bildir'\)/);
  assert.match(app, /W\.FOPLUS && W\.FOPLUS\.turetVar\(f\.id\)\) h \+= '<button type="button" class="fo-btn fo-btn-ince fo-btn-turet" data-turet>/);
  assert.match(app, /W\.FOPLUS\.sinavBarHTML\(d\)/); assert.match(app, /W\.FOPLUS\.rafHTML\(\)/); assert.match(app, /W\.FOPLUS\.paftaHTML\(d\)/);
  assert.match(app, /if \(ok && !sayildi\) \{ sayildi = true; D\.dispatchEvent\(new CustomEvent\('formulo:dogru'/, 'kendini dene: soru başına bir kez');
  const soru = read('formulo/assets/formulo-soru.js');
  assert.match(soru, /puanYaz\(\); if \(ok\) D\.dispatchEvent\(new CustomEvent\('formulo:dogru', \{ detail: \{ id: q\.f\.id, d: q\.f\.d, sev: q\.sev \|\| q\.tip, kaynak: 'havuz' \} \}\)\); \}/, 'soru havuzu: yalnız ilk cevap sayılır');
  assert.match(soru, /hataEkle: hataEkle/, 'sınav yanlışları hata defterine yazabilmeli');
  const kart = read('formulo/assets/formulo-kart.js');
  assert.match(kart, /s\.n = s\.gun === g\[1\] \? \(s\.n \|\| 0\) \+ 1 : 1/, 'masadaki kart da seriyi aynı kuralla tutar');
});

test('ürün kuralı: öğretmen, sınıf, ödev yok', () => {
  const t = read('formulo/assets/formulo-plus.js') + read('formulo/assets/formulo-turet.js');
  assert.doesNotMatch(t, /öğretmen|ödev|teacher|homework|sınıfın/i);
});

summary();
