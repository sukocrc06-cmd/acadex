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
   KONUŞMA ve İMMİTANS (29.10.2026, kabinin yeni modları — labs/odyoloji/odyo-kabin2.js):
     - SRT %50 noktası, konuşmada IA 40 dB ve maskeleme kuralı; maskesiz ölçüm gölge SRT verir
     - retrokoklear hastada yüksek seviyede SD düşer (rollover); yalancı kayıpta SRT, SSO ile uyumsuz
     - her hastanın timpanogramı vaka dosyasındaki klinik kayıtla aynı (tip ve kulak yolu hacmi)
     - akustik refleks kuralları: prob kulağında orta kulak sorunu → yok; retrokoklear uyaran → yok
     - kendi ölçümü vaka puanının %15'i; ölçümsüz vakalarda puan değişmez
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
    if (p.seviye === 3 && !p.gercek) assert.ok(need(p) >= 8, p.id);   /* yalancı kayıp: zorluk maskelemede değil yorumda */
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
test('vaka masası: 13 vaka; doğru cevaplar listede; puan gerekli/gereksiz testleri ayırır', () => {
  /* 31.10.2026: Acadex Medica için 4 yeni vaka (v-kerem, v-buson, v-ototoks, v-perfor) */
  assert.equal(A.CASES.length, 13);
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
test('konuşma: SRT %50 noktası, konuşmada çapraz işitme ve maskeleme (ani kayıp, sol kulak)', () => {
  const p = A.P.ani, st = (L, mask) => ({ ear: 'L', list: 'srt', L, mask: mask || { on: false } });
  assert.ok(Math.abs(A.speechEff(A.P.normal, { ear: 'R', list: 'srt', L: 5, mask: { on: false } }).p - 0.5) < 0.01, 'SRT seviyesinde %50');
  // maskesiz: 50 dB'de kelimeyi sağ kulak (SRT 10 + IA 40) duyar → gölge SRT 50
  assert.equal(A.srtUnmasked(p, 'L'), 50);
  const e1 = A.speechEff(p, st(50)); assert.equal(e1.via, 'cross'); assert.ok(Math.abs(e1.p - 0.5) < 0.01);
  // yeterli maske: 50 dB'de duymaz, gerçek SRT 65'te %50
  assert.ok(A.speechEff(p, st(50, { on: true, M: 45 })).p < 0.01);
  assert.ok(Math.abs(A.speechEff(p, st(65, { on: true, M: 45 })).p - 0.5) < 0.01);
  assert.equal(A.needMaskSpeech(p, 'L', 65), true); assert.equal(A.needMaskSpeech(p, 'R', 10), false);
  assert.equal(A.needMaskSpeech(A.P.kom, 'L', 65), true);
  // yanıt: doğruysa hedef kelime, değilse sık karıştırılan kelime / "anlamadım", çok düşükte sessizlik
  const w = ['kalem', 'kale'];
  assert.equal(A.speechRespond(p, st(65, { on: true, M: 45 }), w, fixed(0.1)).said, 'kalem');
  assert.equal(A.speechRespond(p, st(65, { on: true, M: 45 }), w, fixed(0.9)).said, 'anlamadım');
  assert.equal(A.speechRespond(p, st(20, { on: true, M: 45 }), w, fixed(0.5)).said, '');
  assert.ok(A.SPONDEE.length >= 15 && A.MONO.length >= 20 && A.SPONDEE.concat(A.MONO).every((x) => x.length === 2 && x[0] !== x[1]));
});
test('konuşma: SD, rollover, SRT–SSO uyumu ve puanlama', () => {
  const n = A.P.noroma, sd = (L) => A.speechEff(n, { ear: 'R', list: 'sd', L, mask: { on: true, M: L - 20 } }).p;
  assert.ok(Math.abs(sd(60) - 0.4) < 0.05, 'SRT+35 dB: SD ≈ %40'); assert.ok(sd(85) < sd(60) * 0.7, 'yüksek seviyede düşüş (rollover)');
  assert.ok(A.speechEff(A.P.normal, { ear: 'R', list: 'sd', L: 40, mask: { on: false } }).p > 0.95);
  for (const p of Object.values(A.P)) for (const e of ['R', 'L']) assert.equal(A.uyum(p, e), p.id === 'yalanci' ? 'uyumsuz' : 'uyumlu', p.id + ' ' + e);
  assert.equal(A.sdSinif(100), 'mukemmel'); assert.equal(A.sdSinif(84), 'iyi'); assert.equal(A.sdSinif(72), 'orta'); assert.equal(A.sdSinif(60), 'zayif'); assert.equal(A.sdSinif(40), 'cok_zayif');
  const p = A.P.ani, rec = {}, yor = {};
  for (const e of ['R', 'L']) {
    const L = p.srt[e] + 35, m = A.needMaskSpeech(p, e, L);
    rec[e] = { srt: { L: p.srt[e], masked: A.needMaskSpeech(p, e, p.srt[e]) }, sd: { L, pct: p.sd[e], n: 10, masked: m, judge: { ok: 10, total: 10 } } };
    yor[e] = { uyum: A.uyum(p, e), sinif: A.sdSinif(p.sd[e]) };
  }
  const g = A.gradeSpeech(p, rec, yor); assert.equal(g.puan, 100); assert.equal(g.olcum, 1);
  const sh = A.gradeSpeech(p, { L: { srt: { L: 50, masked: false } } }, {});
  assert.equal(sh.rows.find((r) => r.ear === 'L').srt, 'golge', 'maskesiz sol SRT gölge');
});
test('immitans: timpanogramlar vaka kayıtlarıyla aynı; Jerger tipi ve hacim ayrımı', () => {
  for (const c of A.CASES) if (c.hasta && c.sonuc.timpanometri) for (const e of ['R', 'L']) {
    const T = A.P[c.hasta].imm[e];
    assert.equal(T.tip, c.sonuc.timpanometri[e], c.id + ' ' + e + ' tip'); assert.equal(T.ecv, c.sonuc.timpanometri.ecv[e], c.id + ' ' + e + ' hacim');
  }
  assert.equal(A.tipKey(A.P.ome, 'R'), 'B_n'); assert.equal(A.tipKey(A.P.kom, 'L'), 'B_y'); assert.equal(A.tipKey(A.P.otoskleroz, 'R'), 'As'); assert.equal(A.tipKey(A.P.normal, 'L'), 'A');
  const T = A.P.normal.imm.R; assert.ok(Math.abs(A.tympY(T, T.tepe) - T.uyum) < 1e-9, 'tepe uyumu verir'); assert.ok(A.tympY(T, 200) < 0.01, '+200 daPa’da kompanse 0');
  assert.ok(Math.max(...[-400, -200, 0, 200].map((x) => A.tympY(A.P.ome.imm.R, x))) < 0.1, 'tip B düz');
  for (const p of Object.values(A.P)) for (const e of ['R', 'L']) {
    const t = p.imm[e]; assert.ok(A.TIPK[A.tipKey(p, e)], p.id);
    if (t.tip === 'A') assert.ok(t.tepe >= -100 && t.tepe <= 50 && t.uyum >= 0.3 && t.uyum <= 1.4, p.id + ' A normal sınırlarda');
    if (t.tip === 'As') assert.ok(t.uyum < 0.3, p.id);
    assert.ok(p.oto[e] && p.oto[e].t, p.id + ' otoskopi');
  }
  assert.equal(A.probeOk(A.P.ome, 'kucuk'), true); assert.equal(A.probeOk(A.P.ome, 'buyuk'), false); assert.equal(A.probeOk(A.P.normal, 'kucuk'), false);
});
test('akustik refleks: prob etkisi, iletim kaybı, rekrütman, retrokoklear ve yalancı kayıp', () => {
  const R = (id, probe, mode, f) => A.reflex(A.P[id], probe, mode, f);
  for (const f of A.REFL_F) {
    assert.equal(R('normal', 'R', 'ipsi', f), 85);
    for (const e of ['R', 'L']) for (const m of ['ipsi', 'contra']) { assert.equal(R('ome', e, m, f), null); assert.equal(R('otoskleroz', e, m, f), null); }
    assert.equal(R('noroma', 'R', 'ipsi', f), null, 'sağ uyaran: ipsi yok'); assert.equal(R('noroma', 'L', 'contra', f), null, 'sağ uyaran: kontra yok');
    assert.ok(R('noroma', 'L', 'ipsi', f) <= 90, 'sol uyaran normal');
    assert.equal(R('kom', 'L', 'ipsi', f), null, 'perforasyonlu prob kulağı');
    const y = R('yalanci', 'R', 'ipsi', f); assert.ok(y != null && y - A.P.yalanci.ac.R[f] <= 30, 'refleks, iddia edilen eşiğe çok yakın');
  }
  assert.ok(R('ani', 'L', 'ipsi', 1000) > R('ani', 'R', 'ipsi', 1000), 'koklear kayıpta eşik yükselir ama refleks var');
  assert.ok(R('kom', 'R', 'contra', 1000) >= R('kom', 'R', 'ipsi', 1000) + 25, 'uyaran kulağındaki iletim kaybı eşiği yükseltir');
});
test('immitans ve vaka puanı: kusursuz ölçüm 100; ölçüm kalitesi vaka puanının %15\'i', () => {
  const p = A.P.kom, rec = { refl: {} };
  for (const e of ['R', 'L']) { const T = p.imm[e]; rec[e] = { oto: true, tymp: { done: true, peak: T.tip === 'B' ? null : { p: T.tepe, c: T.uyum }, nopeak: T.tip === 'B', tip: A.tipKey(p, e) } }; }
  assert.equal(A.gradeImm(p, rec).puan, 100, 'refleks ölçülmeden');
  for (const e of ['R', 'L']) for (const m of ['ipsi', 'contra']) { const t = A.reflex(p, e, m, 1000); rec.refl[e + '.' + m + '.1000'] = t == null ? { nr: true } : { L: t }; }
  assert.equal(A.gradeImm(p, rec).puan, 100, 'refleksle');
  rec.L.tymp.tip = 'B_n'; rec.L.oto = false; assert.equal(A.gradeImm(p, rec).puan, 80, 'perforasyonu sıvı sanmak ve otoskopisiz ölçüm');
  const c = A.CASES.find((x) => x.id === 'v-kom');
  assert.equal(A.gradeCase(c, c.gerekli, c.dogru, c.dyon).puan, 100);
  assert.equal(A.gradeCase(c, c.gerekli, c.dogru, c.dyon, { timpanometri: 1 }).puan, 100);
  assert.equal(A.gradeCase(c, c.gerekli, c.dogru, c.dyon, { timpanometri: 0 }).puan, 85);
  assert.deepEqual(A.MEASURABLE, ['konusma', 'timpanometri', 'refleks']);
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
  for (const s of ['odyo-model.js', 'odyo-app.js', 'odyo-kulak.js', 'odyo-kabin2.js']) assert.ok(h.includes(s), s);
  assert.ok(h.indexOf('odyo-app.js') < h.indexOf('odyo-kabin2.js'), 'kabin2 çekirdekten sonra yüklenir');
  for (const m of ['ton', 'konusma', 'imm']) assert.match(h, new RegExp('data-km="' + m + '"'));
  for (const id of ['dm-kon', 'dm-imm', 'dmr-kon', 'dmr-imm', 'k2-go', 'ki-run', 'ki-g', 'kb-case']) assert.match(h, new RegExp('id="' + id + '"'), id);
  const k2 = read('labs/odyoloji/odyo-kabin2.js');
  assert.match(k2, /Math\.min\(hl, 90\)/);                                 /* refleks uyaranı 90 dB HL karşılığında kırpılır */
  assert.match(k2, /if \(!text \|\| !C\.snd\.on \|\| !C\.snd\.ok/);       /* konuşma sentezi de onaysız çalmaz */
  for (const hook of ['OL.k2.caseRep', 'OL.k2.olcum', 'OL.k2.mode()', 'OL.k2.ctx()', 'OL.core =']) assert.ok(app.includes(hook), hook);
  assert.match(app, /var amp = function \(hl\) \{ return Math\.min\(1,/); /* genlik üst sınırı */
  assert.match(app, /snd\.vol \/ 100 \* 0\.35/);                              /* ana kazanç üst sınırı */
  assert.match(app, /if \(!snd\.on \|\| !snd\.ok\) return;/);                 /* onaysız ses çalmaz */
});
test('MedLab: kart, katman kaydı ve Acadia köprüsü Odyoloji Lab\'i tanır', () => {
  assert.match(read('dashboard.html'), /data-medlab-open="odyoloji"/);
  assert.match(read('js/acadex-medlab.js'), /odyoloji: \{ t: 'Odyoloji Lab', src: 'labs\/odyoloji\/index\.html' \}/);
  const br = read('js/acadex-medlab-acadia.js');
  assert.match(br, /odyoloji: 'Odyoloji Lab'/); assert.match(br, /s\.about \?/);
  /* kapak: animasyonlu kulak maskotu (SVG), hareket azaltma tercihinde durur */
  const dash = read('dashboard.html'), css = read('css/acadex-medlab.css');
  const card = dash.slice(dash.indexOf('data-medlab-open="odyoloji"'), dash.indexOf('</li>', dash.indexOf('data-medlab-open="odyoloji"')));
  assert.match(card, /class="axm-cover axm-cover-ody" role="img" aria-label="[^"]+"/);
  assert.match(card, /<svg class="axm-ody"[^>]*aria-hidden="true"/);
  for (const k of ['ody-body', 'ody-eyes', 'ody-w w1', 'ody-w w3', 'ody-note']) assert.ok(card.includes(k), k);
  const rm = css.slice(css.indexOf('Odyoloji Lab kapağı'));
  const motion = rm.slice(rm.indexOf('@media (prefers-reduced-motion:no-preference)'), rm.indexOf('@keyframes'));
  assert.match(motion, /animation:ody-wave/); assert.match(motion, /animation:ody-hear/);
  assert.ok(!/animation:ody-/.test(rm.replace(motion, '')), 'animasyonlar yalnızca hareket tercihi açıkken');
  const app = read('labs/odyoloji/odyo-app.js');
  assert.match(app, /m\.src = 'axlab'; m\.lab = 'odyoloji'/); assert.match(app, /e\.origin !== ORG \|\| e\.source !== W\.parent/);
});
summary();
