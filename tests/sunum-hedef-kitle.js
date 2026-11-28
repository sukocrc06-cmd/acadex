/* ==========================================================================
   ACADEX — SUNUM HEDEF KİTLE PROFİLİ (tests/sunum-hedef-kitle.js)

   NEDEN VAR (28.11.2026, #58 Phase 12.2):
   - Destede tek hedef kitle profili (deck.kitle): 9 sabit alan (dinleyici, bilgi düzeyi, amaç, ton, derinlik, örnek, terim,
     yoğunluk, üslup) + ≤200 harf serbest not. Seçenekler istemcide ve sunucuda aynı SD_PROFIL'dir (H1). Hassas kişisel
     özellik çıkarımı yok: serbest not din/etnik köken/sağlık/cinsellik/siyaset taşıyorsa kaydedilmez.
   - Profili kaydetmek ya da değiştirmek hiçbir metni kendiliğinden yeniden yazmaz, model çağırmaz, geri al yığınına girmez.
     Profil Groq'a yalnız "gönderim izni" işaretliyse ve yalnız onaylanan #55 isteğinde gider (izin alanı gitmez).
   - Beş iş (uyarla/derin/yalin/terimac/akis) ikinci bir sistem değildir: hkKomut #55 sohbet editörüne komut yazar
     (HK.zorla işi sabitler); önizleme, onay, #53/#55 güvenlik denetimi, atomik uygulama, tek geri al #55'indir.
     Sayı/tarih/birim/atıf/olumsuzluk/neden/koşul/karşılaştırma/kesinlik düşüren öneri uygulanmaz; denetimden geçip de
     önemli bir ad düşüren öneride önizleme "çıkan önemli bilgi" listesini gösterir (hkCikan). Değişen iddia unverified olur,
     eski kontrol sonucu taşınmaz. Profil paylaşım görüntüsüne ve PPTX'e girmez; varsayılan profil hesaba yalnız izinle yazılır,
     izin kalkınca hesaptaki kopya boşaltılır.

   Bölümler: A kaynak kuralları · H sunucu (TypeScript'ten derlenmiş sdIstekTemizle/sdGovde/sohbetDuzenle, sahte Groq) ·
   C başsız Chrome birim senaryoları · E uçtan uca 1440/1024/390 (+EN). Başsız Chrome 500 px altına inmez: 390'da innerWidth ≤ 520.
   Dış ağ yok, canlı model yok, içerik sentetik. Çalıştırma:  node tests/sunum-hedef-kitle.js
   ========================================================================== */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { pathToFileURL } = require('node:url');
const { readSource, sliceDeclaration, makeRunner } = require('./_ts-extract.js');
const { CHROME, yeniSunucu, duzenek } = require('./_capraz-duzenek.js');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const ink = read('js/acadex-ink.js');
const SRV_PATH = 'supabase/functions/sunum-research/index.ts';
const { test, summary } = makeRunner();
const BLOK = (() => { const a = ink.indexOf('/* ---------- #58 (Phase 12)'), b = ink.indexOf('/* ---------- #58 son ---------- */'); return a > 0 && b > a ? ink.slice(a, b) : ''; })();
const HKB = (() => { const a = BLOK.indexOf('/* ---- 12.2 hedef kitle'), b = BLOK.indexOf('/* ---- 12.3', a); return a > 0 ? BLOK.slice(a, b > a ? b : BLOK.length) : ''; })();
const BUNDLE = [process.env.PPTXGEN_BUNDLE, path.join(ROOT, 'node_modules/pptxgenjs/dist/pptxgen.bundle.js')].filter(Boolean).find((p) => fs.existsSync(p)) || null;
const GUVENLIK = { uygulananTehlikeli: 0, izinsizProfil: 0, izinAlaniGitti: 0, otomatikYazim: 0, profilSizinti: 0, disAg: 0 };

const kopya = (x) => JSON.parse(JSON.stringify(x));
let AG = 0; global.fetch = () => { AG++; return Promise.reject(new Error('ağ yok')); };

/* ---------- sunucu: TypeScript'ten derlenmiş gerçek bildirimler ---------- */
const SRV_AD = ['GUVENSIZ', 'ID_MODEL', 'ID_UC', 'ID_ZAMAN_MS', 'ID_KULLANICI_N', 'ID_KULLANICI_MS', 'ID_GERI_MS', 'ID_KONTROL', 'idHash', 'idAcik', 'idBayt',
  'ON_ATIF', 'onSayilar', 'onAtiflar', 'ON_KAT', 'onKat', 'ON_OLUMSUZ', 'ON_FIIL', 'ON_FIIL_ES', 'ON_EK_UYARI', 'onSay', 'onFiiller', 'onKokler', 'onOlumlu', 'onKutup',
  'SD_KOMUT_BOY', 'SD_MAX_CIFT', 'SD_CIFT_BOY', 'SD_MAX_HEDEF', 'SD_MAX_AS', 'SD_AS_OGE', 'SD_HEDEF_BOY', 'SD_MAX_BASLIK', 'SD_BASLIK_BOY', 'SD_MAX_PARCA', 'SD_PARCA_BOY', 'SD_MAX_BULGU', 'SD_MAX_BAYT', 'SD_YENI_BOY', 'SD_MAX_YANIT',
  'SD_IS', 'SD_PROFIL', 'SD_NIYET', 'SD_KAPSAM', 'SD_ID', 'SD_TUR', 'SD_SISTEM', 'sdIstekTemizle', 'sdGovde', 'sdDogrula', 'sdDurum', 'sohbetDuzenle'];
const SRV_JS = ts.transpileModule(readSource(SRV_PATH), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const SRV_BAS = SRV_AD.filter((n) => new RegExp('(const\\s+' + n + '\\s*=|function\\s+' + n + '\\s*\\()').test(SRV_JS));
const sunucu = () => new Function(SRV_BAS.map((n) => sliceDeclaration(SRV_JS, n)).join('\n\n') + '\nreturn { ' + SRV_AD.join(', ') + ' };')();
const sahteFetch = (yanit) => { const f = async (url, init) => { f.n++; const g = JSON.parse(init.body); f.govde.push(g); return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: yanit(JSON.parse(g.messages[1].content), g) } }] }) }; }; f.n = 0; f.govde = []; return f; };
const ortam = (fetch, o) => Object.assign({ env: (k) => (k === 'GROQ_API_KEY' ? 'test-anahtar' : undefined), fetch, acik: async () => true, simdi: Date.now, rid: () => 'rid000000001' }, o || {});
const plan = (g, f) => JSON.stringify({ intent: 'edit_proposal', assistant_message: 'Öneri hazır.', clarification: null, proposal: { scope: 'element', targets: g.targets.map((t) => ({ slide_id: t.slide_id, element_id: t.element_id, expected_text_hash: t.hash, operation: 'replace_text', replacement_text: f(t.text), reason: 'Sade.' })).filter((x, i) => x.replacement_text !== g.targets[i].text), evidence: [], limitations: [] } });
const HSH = sunucu().idHash, hed = (metin) => [{ slide_id: 's2', element_id: 'e1', hash: HSH(metin), tur: 't', metin }];
const govde = (o) => Object.assign({ action: 'sohbet_duzenle', v: 1, dil: 'tr', is: 'yalin', komut: '2. slaytı teknik dili sadeleştir', gecmis: [], hedefler: hed('Ankara ofisi hızla büyüdü.'), basliklar: [{ slide_id: 's2', no: 2, baslik: 'Liste' }], parcalar: [], bulgular: [], onceki: [] }, o || {});
const istemciProfil = () => { const m = ink.match(/  var SD_PROFIL = (\{[\s\S]*?\});\n/); assert.ok(m, 'istemci SD_PROFIL'); return new Function('return ' + m[1])(); };
const istemciSozluk = (ad) => { const m = ink.match(new RegExp('  var ' + ad + ' = (\\{[\\s\\S]*?\\});\\n')); assert.ok(m, ad); return new Function('return ' + m[1])(); };

/* ---------- A: kaynak kuralları ---------- */
test('A1 12.2 bölümü #58 bloğunda; lookbehind ve \\u kaçışı yok; doğrudan ağ/Groq/Tavily/Gemini/mikrofon yok', () => {
  assert.ok(HKB.length > 3000, '12.2 bölümü bulunamadı');
  assert.equal(/\(\?<[=!]/.test(HKB), false, 'lookbehind'); assert.equal(/\\u[0-9a-fA-F]{4}/.test(HKB), false, '\\u');
  for (const y of ['fetch(', 'XMLHttpRequest', 'functions.invoke', 'tavily', 'gemini', 'getUserMedia', 'MediaRecorder', 'SpeechRecognition']) assert.equal(HKB.toLowerCase().includes(y.toLowerCase()), false, y);
});

test('A2 profil kaydı yeniden yazım tetiklemez: hkKaydet/hkVarsayilanYaz gövdesinde sdGonder/hkKomut/undo yok; #55 bağlantıları tek yerde', () => {
  const g = (ad) => { const i = HKB.indexOf('  var ' + ad + ' = '); assert.ok(i >= 0, ad); return HKB.slice(i, HKB.indexOf('\n  var ', i + 5)); };
  for (const ad of ['hkKaydet', 'hkVarsayilanYaz', 'hkTemiz']) for (const y of ['sdGonder', 'hkKomut', 'undoPush', 'snapPush', 'fn(']) assert.equal(g(ad).includes(y), false, ad + ' → ' + y);
  assert.equal((ink.match(/HK\.zorla\)/g) || []).length, 1, 'sdAnla HK.zorla bağı tek'); assert.ok(/var pf = typeof hkGonder === 'function' && hkGonder\(d\); if \(pf\) gov\.profil = pf;/.test(ink), '#55 isteği profili hkGonder ile alır');
  assert.ok(/hkCikanHTML\(K, d\)/.test(ink) && /hkOnayHTML\(/.test(ink), '#55 kartlarına satır eklenir');
});

/* ---------- H: sunucu ---------- */
test('H1 SD_PROFIL istemci = sunucu; ≥6 dinleyici, ≥8 üslup; her değerin TR/EN adı, her alanın TR/EN etiketi; beş iş iki tarafta', () => {
  const S = sunucu(), C = istemciProfil(), AD = istemciSozluk('HK_AD'), AL = istemciSozluk('HK_ALAN'), IS = istemciSozluk('HK_IS');
  assert.deepEqual(C, JSON.parse(JSON.stringify(S.SD_PROFIL)));
  assert.equal(Object.keys(C).length, 9); assert.ok(C.kitle.length >= 6, 'kitle ' + C.kitle.length); assert.ok(C.uslup.length >= 8, 'üslup ' + C.uslup.length);
  for (const k of Object.keys(C)) { assert.equal(AL[k].length, 2, k); for (const v of C[k]) assert.ok(AD[v] && AD[v][0] && AD[v][1], 'ad ' + v); }
  assert.deepEqual(Object.keys(IS).sort(), ['akis', 'derin', 'terimac', 'uyarla', 'yalin']);
  for (const is of Object.keys(IS)) { assert.ok(S.SD_IS.includes(is), 'sunucu SD_IS ' + is); assert.ok(IS[is][0] && IS[is][1], 'TR/EN komut ' + is); }
  assert.ok(/SD_KANITLI = \{[^}]*uyarla: 1, derin: 1, yalin: 1, terimac: 1, akis: 1/.test(ink), 'istemci işleri model yolunda (SD_KANITLI)');
});

test('H2 sunucu sdIstekTemizle profil: yok → null; geçerli → normalize; bilinmeyen alan/değer, >200 serbest, görünmez karakter, izin alanı → reddedilir', () => {
  const S = sunucu(), T = (p) => S.sdIstekTemizle(govde(p === undefined ? {} : { profil: p }));
  assert.equal(T().profil, null); assert.equal(T(null).profil, null);
  assert.deepEqual(T({ kitle: 'yonetici', uslup: 'kurumsal', serbest: '  Kısa olsun ' }).profil, { kitle: 'yonetici', uslup: 'kurumsal', serbest: 'Kısa olsun' });
  for (const k of ['kitle', 'seviye', 'amac', 'ton', 'derinlik', 'ornek', 'terim', 'yogunluk', 'uslup']) assert.equal(T({ [k]: S.SD_PROFIL[k][0] }).profil[k], S.SD_PROFIL[k][0], k);
  for (const p of [{ izin: true, kitle: 'genel' }, { yas: 30 }, { kitle: 'cocuk' }, { uslup: 'mizah' }, { serbest: 'x'.repeat(201) }, { serbest: 'a​b' }, { kitle: null }, [], 'genel'])
    assert.deepEqual(T(p), { hata: 'profil' }, JSON.stringify(p));
  for (const is of ['uyarla', 'derin', 'yalin', 'terimac', 'akis']) assert.equal(S.sdIstekTemizle(govde({ is })).is, is);
  assert.deepEqual(S.sdIstekTemizle(govde({ is: 'hepsini_yaz' })), { hata: 'is' });
  const ic = JSON.parse(JSON.parse(S.sdGovde(S.sdIstekTemizle(govde({ profil: { kitle: 'juri', serbest: 'Net' } })))).messages[1].content);
  assert.deepEqual(ic.profile, { kitle: 'juri', serbest: 'Net' }); assert.equal(ic.task, 'yalin');
  assert.equal(JSON.parse(JSON.parse(S.sdGovde(S.sdIstekTemizle(govde()))).messages[1].content).profile, null);
  const sis = S.SD_SISTEM('tr'); assert.ok(/"profile"[^\n]*never permits a new fact, number/.test(sis), 'sistem iletisi profil kuralı'); for (const is of ['uyarla', 'derin', 'yalin', 'terimac', 'akis']) assert.ok(sis.includes('"' + is + '"'), is);
});

test('H3 sunucu sohbetDuzenle (sahte Groq): profil Groq kullanıcı içeriğinde; profil yeni sayıya izin vermez (red); düşen sayı/neden istemci denetimine kalır (C10); ifade değişikliği geçer', async () => {
  const S = sunucu(), b = govde({ profil: { kitle: 'yonetici', seviye: 'baslangic' }, hedefler: hed('Gelir 2024 yılında %12 arttı çünkü fiyat yükseldi.') });
  const f1 = sahteFetch((g) => plan(g, (t) => t.replace('yükseldi', '%40 yükseldi'))), r1 = await S.sohbetDuzenle(kopya(b), 'kullanici-1', ortam(f1));
  assert.equal(f1.n, 1); assert.deepEqual(JSON.parse(f1.govde[0].messages[1].content).profile, { kitle: 'yonetici', seviye: 'baslangic' });
  assert.notEqual(r1.yanit.durum, 'tamam', 'profil varken yeni sayı sunucuda geçmemeli: ' + JSON.stringify(r1.yanit).slice(0, 200)); if (r1.yanit.durum === 'tamam') GUVENLIK.uygulananTehlikeli++;
  const f2 = sahteFetch((g) => plan(g, (t) => t.replace(' %12', ''))), r2 = await sunucu().sohbetDuzenle(kopya(b), 'kullanici-1', ortam(f2));
  assert.equal(r2.yanit.durum, 'tamam', 'sunucu yalnız yeni sayıyı reddeder; düşen sayı istemcide (C10)');
  const f3 = sahteFetch((g) => plan(g, (t) => t.replace('yükseldi', 'arttı'))), r3 = await sunucu().sohbetDuzenle(kopya(b), 'kullanici-1', ortam(f3));
  assert.equal(r3.yanit.durum, 'tamam', JSON.stringify(r3.yanit).slice(0, 300)); assert.equal(r3.yanit.plan.proposal.targets.length, 1);
  const f4 = sahteFetch(() => { throw new Error('çağrılmamalı'); }), r4 = await sunucu().sohbetDuzenle(govde({ profil: { izin: true } }), 'kullanici-1', ortam(f4));
  assert.equal(f4.n, 0, 'geçersiz profilde Groq çağrılmaz'); assert.notEqual(r4.yanit.durum, 'tamam');
  for (const r of [r1, r2, r3, r4]) assert.equal(/Kısa|yonetici|baslangic|Gelir/.test(JSON.stringify(r.log || {})), false, 'günlükte profil/metin yok');
  assert.equal(AG, 0);
});

/* ---------- C–E: başsız Chrome ---------- */
const STRIPS = [{ k: 'cover', t: 'Kapak', b: [] }, { k: 'list', t: 'Liste', b: ['Gelir 2024 yılında %12 arttı [1].', 'Gider düşmedi çünkü maliyet arttı.', 'Ankara ofisi hızla büyüdü.'] }, { k: 'end', t: 'Son', b: [] }];
const STRIPS_EN = [{ k: 'cover', t: 'Cover', b: [] }, { k: 'list', t: 'List', b: ['Revenue rose 12% in 2024 [1].', 'Costs did not fall because prices rose.', 'Ankara office grew quickly.'] }, { k: 'end', t: 'End', b: [] }];
const PM = (en) => ({ title: 'P', sub: 't', lang: en ? 'en' : 'tr', source: 'topic', sourceId: null, cited: [{ id: 1, title: 'TÜİK', url: 'https://www.tuik.gov.tr/a', site: 'tuik.gov.tr', date: '2024', parca: [{ pid: 'p1', metin: en ? 'Revenue rose 12% in 2024.' : 'Gelir 2024 yılında %12 arttı.', tur: 'pasaj' }] }], sources: [] });
/* sahte #55 sunucusu: window.__mod öneriyi seçer (her biri sabit dönüşüm); gövde window.__govde'de */
const MODLAR = `window.__inv = []; window.__govde = null; window.__mod = 'ad';
  var MOD = { sayi: [[' %12', ''], [' 12%', '']], yeniSayi: [['hızla', '%40 hızla'], ['quickly', '40% quickly']], neden: [[' çünkü', ';'], [' because', ';']], olumsuz: [['düşmedi', 'düştü'], ['did not fall', 'fell']],
    atif: [[' [1]', '']], ad: [['Ankara ofisi', 'Ofis'], ['Ankara office', 'Office']], temiz: [['hızla büyüdü', 'hızlı büyüdü'], ['grew quickly', 'grew fast']] };
  window.supabaseClient.functions.invoke = function (name, opt) { var b = (opt && opt.body) || {}; window.__inv.push(name + ':' + (b.action || 'research'));
    if (b.action === 'critique') return Promise.resolve({ data: { version: 11, quality: { score: 81, issues: [], pass: true } } });
    if (b.action !== 'sohbet_duzenle') return Promise.resolve({ data: { durum: 'kapali' } });
    window.__govde = JSON.parse(JSON.stringify(b));
    var T = b.hedefler.map(function (h) { var y = h.metin; MOD[window.__mod].forEach(function (z) { y = y.split(z[0]).join(z[1]); }); return { slide_id: h.slide_id, element_id: h.element_id, expected_text_hash: h.hash, operation: 'replace_text', replacement_text: y, reason: 'Sade.' }; }).filter(function (x, i) { return x.replacement_text !== b.hedefler[i].metin; });
    return Promise.resolve({ data: { v: 1, durum: 'tamam', rid: 'r', model: 'm', ms: 5, istek: 1, plan: { intent: 'edit_proposal', assistant_message: 'Öneri hazır.', clarification: null, proposal: { scope: 'slide', targets: T, evidence: [], limitations: [] } } } }); };`;
const TOHUM = (en) => MODLAR + `
  ${en ? "localStorage.setItem('acadexUILang', 'en'); window.AX_EN = { t: { 'Kaynak': 'Source' } };" : ''}
  await sakin(); d.querySelector('[data-newdeck]').click(); S.temaSec(TEMA); S.set(${JSON.stringify(en ? STRIPS_EN : STRIPS)}, ${JSON.stringify(PM(en))}); S.bas('new'); await sakin(); await dur(3000);
  var P = S.p12(), D = function () { return S.deck(); }, J = function (x) { return JSON.stringify(x); };
  window.__hata = []; var ce = console.error; console.error = function () { window.__hata.push(Array.prototype.slice.call(arguments).map(String).join(' ').slice(0, 200)); return ce.apply(console, arguments); };
  window.addEventListener('error', function (e) { window.__hata.push('onerror ' + (e.message || '')); }); window.addEventListener('unhandledrejection', function (e) { window.__hata.push('unhandled ' + String(e.reason && e.reason.message || e.reason)); });
  var SH = function () { return d.querySelector('[data-sh]'); }, st = function () { return SH().getAttribute('data-sh-st'); }, shq = function (s) { var L = SH().querySelectorAll(s); return L[L.length - 1] || null; };      /* panel geçmişi eski kartları tutar: son kart */
  var metin = function () { return D().slides[1].els.filter(function (e) { return (e.type === 't' || e.type === 'ul') && String(e.text || '').length > 3; }).map(function (e) { return e.text; }); };
  var cikan = function () { var x = shq('[data-hk-cikan]'), c = x && (x.closest('div[data-hk-cikan]') || x); return { n: x ? x.getAttribute('data-hk-cikan') : null, tur: Array.prototype.map.call(c ? c.querySelectorAll('[data-hk-cikan-tur]') : [], function (y) { return y.getAttribute('data-hk-cikan-tur'); }) }; };
  var sh = function () { return window.__inv.filter(function (x) { return /sohbet_duzenle/.test(x); }).length; };
  var onayla = async function () { var b = shq('[data-sh-onay]'); if (!b) return false; b.click(); for (var k = 0; k < 40 && st() === 'confirming'; k++) await bekle(100); await bekle(300); return true; };
  var vazgec = async function () { var b = shq('[data-sh-vazgec]'); if (b) { b.click(); await bekle(300); } };`;

const BIRIM = TOHUM(false) + `
  var T = P.hkTemiz, H = P.hkHassas;
  R.t = { bos: T(null), dizi: T([]), gecersiz: T({ kitle: 'cocuk', yas: 9 }), tam: T({ kitle: 'yonetici', seviye: 'ileri', amac: 'karar', ton: 'resmi', derinlik: 'yuksek', ornek: 'az', terim: 'alan', yogunluk: 'seyrek', uslup: 'kurumsal', serbest: ' <b>Net</b>\\u0007 ol ', izin: 1 }),
    uzun: T({ serbest: 'x'.repeat(260) }).serbest.length, hassas: T({ kitle: 'genel', serbest: 'Dinleyiciler hamile' }), yalnizHassas: T({ serbest: 'Kürt öğrenciler' }), izinsiz: T({ kitle: 'genel' }) };
  R.h = { pos: ['Kürt öğrenciler', 'hamile kadınlar', 'LGBT+ kulübü', 'health issues', 'political views', 'din dersi', 'Engelli bireyler', 'ETHNIC groups'].map(H), neg: ['dinamik ekip', 'dinleyiciler', 'ırmak kenarı', 'Kısa ve net', 'gayret', 'yatırımcı sunumu'].map(H) };
  var s0 = J(D().slides), n0 = P.undoN(), i0 = window.__inv.length, prof = { kitle: 'yonetici', seviye: 'baslangic', uslup: 'yonetici', serbest: 'Kısa ve net olsun', izin: true };
  R.kay = { ok: P.hkKaydet(prof), kitle: D().kitle, ayni: J(D().slides) === s0, undo: P.undoN() - n0 };
  P.hkKaydet({ kitle: 'uzman', izin: true }); R.kay2 = { kitle: D().kitle, ayni: J(D().slides) === s0, undo: P.undoN() - n0 }; P.hkKaydet(null); R.kay3 = 'kitle' in D(); await dur(1500); R.kayInv = window.__inv.slice(i0);
  R.g = { yok: P.hkGonder(D()), izinsiz: (D().kitle = { kitle: 'genel', izin: false }, P.hkGonder(D())), izinli: (D().kitle = { kitle: 'genel', ton: 'samimi', izin: true }, P.hkGonder(D())) }; delete D().kitle;
  R.oz = P.hkOzet({ kitle: 'yatirimci', ton: 'resmi', serbest: 'Kısa' });
  R.v1 = await P.hkVarsayilanYaz({ kitle: 'juri', uslup: 'akademik', izin: true }); R.vOku = P.hkVarsayilan(); await bekle(300);
  R.v2 = await P.hkVarsayilanYaz({ kitle: 'juri', izin: false }); R.vOku2 = P.hkVarsayilan();
  /* hkKomut sınırları: geçersiz iş, >5 asetat aralığı (8 asetatlık geçici deste) */
  R.k = { gecersiz: P.hkKomut('hepsini', 2, 2), zorla: P.HK.zorla };
  var D8 = D(); var s8 = D8.slides.slice(); for (var q = 0; q < 5; q++) D8.slides.push(JSON.parse(JSON.stringify(D8.slides[1]))); R.k.genis = P.hkKomut('yalin', 1, 6); R.k.zorla2 = P.HK.zorla; R.k.inv = sh(); D8.slides.length = 0; s8.forEach(function (x) { D8.slides.push(x); }); P.renderAll();
  /* hkCikan saf karşılaştırma (deste üzerinde, değiştirmeden) */
  var sl = D().slides[1], E = sl.els.filter(function (e) { return e.type === 't'; }), K = function (i, y) { return P.hkCikan({ hedefler: [{ slide_id: sl.id, element_id: E[i].id, replacement_text: y }] }, D()); };
  var tl = function (L) { return L.map(function (x) { return x.tur + (x.v ? ':' + x.v : ''); }); };
  R.c = { sayi: tl(K(0, 'Gelir 2024 yılında arttı [1].')), atif: tl(K(0, 'Gelir 2024 yılında %12 arttı.')), ad: tl(K(2, 'Ofis hızla büyüdü.')), olumsuz: tl(K(1, 'Gider düştü çünkü maliyet arttı.')), neden: tl(K(1, 'Gider düşmedi; maliyet arttı.')),
    adres: tl(P.hkCikan({ hedefler: [{ slide_id: sl.id, element_id: E[2].id, replacement_text: 'Ofis' }] }, { slides: [{ id: sl.id, els: [{ id: E[2].id, type: 't', text: 'Bkz. https://ornek.org/a' }] }] })),
    kosul: tl(P.hkCikan({ hedefler: [{ slide_id: 'x', element_id: 'y', replacement_text: 'Fiyat artar.' }] }, { slides: [{ id: 'x', els: [{ id: 'y', type: 't', text: 'Fiyat, eğer talep artarsa, artar.' }] }] })),
    karsi: tl(P.hkCikan({ hedefler: [{ slide_id: 'x', element_id: 'y', replacement_text: 'A hızlı.' }] }, { slides: [{ id: 'x', els: [{ id: 'y', type: 't', text: 'A, B’den daha hızlı.' }] }] })),
    kesin: tl(P.hkCikan({ hedefler: [{ slide_id: 'x', element_id: 'y', replacement_text: 'Bu doğru.' }] }, { slides: [{ id: 'x', els: [{ id: 'y', type: 't', text: 'Bu kesinlikle doğru.' }] }] })),
    ayni: tl(K(2, 'Ankara ofisi hızlı büyüdü.')), yok: tl(P.hkCikan({ hedefler: [{ slide_id: 'yok', element_id: 'yok', replacement_text: 'x' }] }, D())) };
  /* profil paylaşım görüntüsüne ve PPTX'e girmez */
  P.hkKaydet(prof); R.snap = J(P.snapKur(D())); R.pptx = null;
  if (window.PptxGenJS) { window.__pptx = []; window.PptxGenJS.prototype.writeFile = function (o) { return this.write({ outputType: 'base64' }).then(function (b) { window.__pptx.push(b); return o && o.fileName; }); }; await P.exportPptx(null); R.pptx = window.__pptx[window.__pptx.length - 1] || ''; }
  /* beş iş #55 üzerinden: iş, komut, profil (izinsiz alan yok), onay kartında profil satırı; öneri seçilmeden vazgeç */
  window.__mod = 'temiz'; R.isler = [];
  for (var w of ['uyarla', 'derin', 'yalin', 'terimac', 'akis']) { var ok = P.hkKomut(w, 2, 2); await bekle(400); var r = { is: w, ok: !!ok, st: st(), kart: !!shq('[data-hk-gonder]') }; await onayla(); var g = window.__govde || {}; r.st2 = st(); r.gIs = g.is; r.komut = g.komut; r.profil = g.profil; r.cikan = cikan(); r.ayni = J(metin()) === J(${JSON.stringify(STRIPS[1].b)}); r.zorla = P.HK.zorla; await vazgec(); R.isler.push(r); }
  /* güvenlik senaryoları: her biri onaylanır; tehlikeli olan uygulanmaz, deste aynı kalır */
  R.sen = [];
  for (var m of ['sayi', 'yeniSayi', 'neden', 'olumsuz', 'atif', 'ad', 'temiz']) { window.__mod = m; var m0 = J(D().slides); P.hkKomut('uyarla', 2, 2); await bekle(400); await onayla(); var x = { mod: m, st: st(), uygula: !!shq('[data-sh-uygula]'), cikan: cikan(), ayni: J(D().slides) === m0, hata: (shq('[data-sh-hata]') || {}).textContent || '' }; await vazgec(); x.ayni2 = J(D().slides) === m0; R.sen.push(x); }
  /* izinsiz profil: istek gövdesinde profil yok, onay kartında profil satırı yok */
  D().kitle = { kitle: 'genel', izin: false }; window.__mod = 'temiz'; P.hkKomut('uyarla', 2, 2); await bekle(400); R.izinsiz = { kart: !!shq('[data-hk-gonder]') }; await onayla(); R.izinsiz.profil = (window.__govde || {}).profil; await vazgec(); P.hkKaydet(prof);
  /* uygula + iddia + geri al: ad düşüren (denetimden geçen) öneri; önceki kontrol sonucu taşınmaz */
  var hed = D().slides[1].els.filter(function (e) { return /Ankara/.test(e.text || ''); })[0]; (hed.iddia || [])[0] && (hed.iddia[0].kontrol = { sonuc: 'supported' });
  window.__mod = 'ad'; var a0 = J(D().slides), u0 = P.undoN(); P.hkKomut('uyarla', 2, 2); await bekle(400); await onayla(); R.uyg = { st: st(), cikan: cikan() };
  var ub = shq('[data-sh-uygula]'); if (ub) { ub.click(); await bekle(800); } var yeni = D().slides[1].els.filter(function (e) { return e.id === hed.id; })[0];
  R.uyg.st2 = st(); R.uyg.son = !!shq('[data-sh-son="ok"]'); R.uyg.metin = yeni && yeni.text; R.uyg.iddia = (yeni && yeni.iddia || []).filter(function (q) { return q.text === yeni.text; }).map(function (q) { return { durum: q.durum, kontrol: !!q.kontrol }; });
  R.uyg.digerAyni = J(D().slides[1].els.filter(function (e) { return e.id !== hed.id; }).map(function (e) { return [e.id, e.text]; })) === J(JSON.parse(a0)[1].els.filter(function (e) { return e.id !== hed.id; }).map(function (e) { return [e.id, e.text]; }));
  var gb = shq('[data-sh-geri]'); if (gb) { gb.click(); await bekle(600); } R.uyg.geri = J(D().slides) === a0; R.uyg.kitle = D().kitle;
  R.hataK = window.__hata;
`;

const pqOlc = `var olc = function () { var D0 = d.querySelector('dialog.pq-dlg'), r = D0.getBoundingClientRect();
    return { en: innerWidth, acik: D0.open, sol: Math.round(r.left), sag: Math.round(r.right), dYatay: D0.scrollWidth - D0.clientWidth,
      tasan: Array.prototype.filter.call(D0.querySelectorAll('*'), function (x) { var b = x.getBoundingClientRect(); return b.width && x.offsetParent !== null && (b.right > r.right + 1 || b.left < r.left - 1); }).map(function (x) { return x.tagName + '.' + x.className; }).slice(0, 5) }; };
  var shOlc = function () { var p = SH(), r = p.getBoundingClientRect(); return { sol: Math.round(r.left), sag: Math.round(r.right), en: innerWidth, dYatay: p.scrollWidth - p.clientWidth }; };`;

const E2E = (en) => TOHUM(en) + pqOlc + `
  var Q = function (s) { return d.querySelector('dialog.pq-dlg ' + s); }, tik = async function (s) { var b = Q(s); if (!b) throw new Error('yok: ' + s); b.click(); await bekle(300); };
  var sec = function (k, v) { var x = Q('[data-hk="' + k + '"]'); x.value = v; x.dispatchEvent(new Event('change', { bubbles: true })); };
  d.querySelector('[data-pq-ac]').click(); await bekle(300); await tik('[data-pq-tab="hk"]'); R.olc0 = olc(); R.alan = Array.prototype.map.call(d.querySelectorAll('dialog.pq-dlg [data-hk]'), function (x) { return x.getAttribute('data-hk') + ':' + x.options.length; });
  R.isPasif = Array.prototype.every.call(d.querySelectorAll('dialog.pq-dlg [data-hk-is]'), function (b) { return b.disabled; });
  /* hassas serbest not reddedilir, hiçbir şey kaydedilmez */
  sec('kitle', 'yatirimci'); Q('[data-hk-serbest]').value = 'Dinleyiciler hamile ve engelli'; Q('[data-hk-izin]').checked = true; await tik('[data-hk-kaydet]'); R.hassas = { kitle: 'kitle' in D(), dur: Q('[data-pq-dur]').textContent };
  var s0 = J(D().slides), i0 = sh(); sec('seviye', 'baslangic'); sec('uslup', 'yatirimci'); sec('ton', 'resmi'); Q('[data-hk-serbest]').value = ${JSON.stringify(en ? 'Short and clear' : 'Kısa ve net olsun')};
  await tik('[data-hk-kaydet]'); R.kay = { kitle: D().kitle, ayni: J(D().slides) === s0, dur: Q('[data-pq-dur]').textContent, inv: sh() - i0 }; R.olc1 = olc();
  R.isAktif = Array.prototype.map.call(d.querySelectorAll('dialog.pq-dlg [data-hk-is]'), function (b) { return b.getAttribute('data-hk-is') + ':' + !b.disabled; });
  window.__mod = 'ad'; Q('[data-hk-a]').value = 2; Q('[data-hk-b]').value = 2; await tik('[data-hk-is="yalin"]'); R.dlgKapali = !d.querySelector('dialog.pq-dlg').open;
  R.panel = { acik: !SH().hidden, st: st(), kart: !!shq('[data-hk-gonder]'), kartMetin: (shq('[data-hk-gonder]') || {}).textContent || '', inv: sh() - i0 }; R.sh0 = shOlc();
  await onayla(); R.oneri = { st: st(), cikan: cikan(), gIs: (window.__govde || {}).is, profil: (window.__govde || {}).profil, ayni: J(D().slides) === s0, metin: SH().textContent.slice(-700) }; R.sh1 = shOlc();
  var ub = shq('[data-sh-uygula]'); if (ub) { ub.click(); await bekle(800); } R.uyg = { st: st(), son: !!shq('[data-sh-son="ok"]'), metin: metin() };
  var gb = shq('[data-sh-geri]'); if (gb) { gb.click(); await bekle(600); } R.geri = J(D().slides) === s0;
  R.hataK = window.__hata;
`;

const VT = '--virtual-time-budget=600000';
let KROM = null;
const krom = () => KROM || (KROM = (async () => {
  if (!CHROME) return null;
  const H = yeniSunucu(); await new Promise((r) => H.srv.listen(0, '127.0.0.1', r)); const port = H.srv.address().port;
  const { sayfa, kos, temizle } = duzenek();
  const paket = (h) => (BUNDLE ? h.replace('<pre id="diag"></pre>', '<script src="' + pathToFileURL(BUNDLE).href + '"></script>\n<pre id="diag"></pre>') : h);
  try {
    const out = { B: await kos('hk-birim.html', 'hk-b', paket(sayfa('ok', port, 0, BIRIM)), ['--window-size=1440,900', VT]), PREF: JSON.parse(JSON.stringify(H.DB.presentation_user_prefs)), LOG: H.LOG.filter((x) => x.t === 'presentation_user_prefs'), E: {} };
    for (const [ad, en, w] of [['1440', false, 1440], ['1024', false, 1024], ['390', false, 390], ['en', true, 1440]]) out.E[ad] = await kos('hk-e2e-' + ad + '.html', 'hk-e' + ad, sayfa('ok', port, 0, E2E(en)), ['--window-size=' + w + ',900', VT]);
    return out;
  } finally { H.srv.close(); temizle(); }
})());
const yok = (ad) => console.log('  ATLANDI  ' + ad + ': Chrome bulunamadı. Bu test GEÇTİ sayılmadı.');
const unzip = (buf) => {
  const out = {}; let e = buf.length - 22; while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--; assert.ok(e >= 0, 'ZIP sonu yok');
  const n = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16);
  for (let i = 0; i < n; i++) {
    const m = buf.readUInt16LE(p + 10), cs = buf.readUInt32LE(p + 20), fl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), kl = buf.readUInt16LE(p + 32), lo = buf.readUInt32LE(p + 42);
    const ad = buf.toString('utf8', p + 46, p + 46 + fl), lf = buf.readUInt16LE(lo + 26), lx = buf.readUInt16LE(lo + 28), d = buf.subarray(lo + 30 + lf + lx, lo + 30 + lf + lx + cs);
    out[ad] = m === 8 ? zlib.inflateRawSync(d) : Buffer.from(d); p += 46 + fl + xl + kl;
  }
  return out;
};

test('C1 hkTemiz: yalnız sabit seçenekler; serbest not temizlenir (denetim karakteri, <>, boşluk), ≤200; hassas not düşer; izin bool; boşsa null', async () => {
  const K = await krom(); if (!K) return yok('C1'); const t = K.B.t;
  assert.equal(t.bos, null); assert.equal(t.dizi, null); assert.equal(t.gecersiz, null); assert.equal(t.yalnizHassas, null, 'yalnız hassas not → profil yok');
  assert.deepEqual(t.tam, { kitle: 'yonetici', seviye: 'ileri', amac: 'karar', ton: 'resmi', derinlik: 'yuksek', ornek: 'az', terim: 'alan', yogunluk: 'seyrek', uslup: 'kurumsal', serbest: 'b Net /b ol', izin: true });
  assert.equal(t.uzun, 200); assert.deepEqual(t.hassas, { kitle: 'genel', izin: false }, 'hassas not saklanmaz'); assert.deepEqual(t.izinsiz, { kitle: 'genel', izin: false });
});

test('C2 hkHassas: din/etnik/sağlık/engellilik/cinsellik/siyaset (TR/EN, büyük harf) yakalanır; "dinamik", "dinleyiciler", "gayret" yanlış pozitif değil', async () => {
  const K = await krom(); if (!K) return yok('C2');
  assert.deepEqual(K.B.h.pos, Array(8).fill(true)); assert.deepEqual(K.B.h.neg, Array(6).fill(false));
});

test('C3 hkKaydet: deck.kitle yazılır, metin/not aynı, geri al yığını değişmez, model çağrısı yok; null profili siler', async () => {
  const K = await krom(); if (!K) return yok('C3'); const B = K.B;
  assert.equal(B.kay.ok, true); assert.deepEqual(B.kay.kitle, { kitle: 'yonetici', seviye: 'baslangic', uslup: 'yonetici', serbest: 'Kısa ve net olsun', izin: true });
  for (const k of [B.kay, B.kay2]) { assert.equal(k.ayni, true, 'metin değişti'); assert.equal(k.undo, 0, 'geri al adımı eklendi'); if (!k.ayni) GUVENLIK.otomatikYazim++; }
  assert.deepEqual(B.kay2.kitle, { kitle: 'uzman', izin: true }); assert.equal(B.kay3, false, 'null profili silmeli');
  assert.equal(B.kayInv.filter((x) => /sohbet_duzenle/.test(x)).length, 0, 'profil değişikliği model çağırdı');
});

test('C4 hkGonder: profil yok/izinsiz → null; izinli → izin alanı olmadan kopya; hkOzet seçili dilde', async () => {
  const K = await krom(); if (!K) return yok('C4'); const g = K.B.g;
  assert.equal(g.yok, null); assert.equal(g.izinsiz, null); assert.deepEqual(g.izinli, { kitle: 'genel', ton: 'samimi' });
  assert.equal(K.B.oz, 'Dinleyici: yatırımcı · Ton: resmî · “Kısa”');
});

test('C5 varsayılan profil: yerelde okunur; hesaba yalnız izinle upsert (user_id çakışma anahtarı), izin kalkınca hesaptaki kopya boşaltılır', async () => {
  const K = await krom(); if (!K) return yok('C5'); const B = K.B;
  assert.equal(B.v1, true); assert.deepEqual(B.vOku, { kitle: 'juri', uslup: 'akademik', izin: true }); assert.deepEqual(B.vOku2, { kitle: 'juri', izin: false });
  const ops = K.LOG.map((x) => x.op); assert.deepEqual(ops, ['upsert', 'update'], JSON.stringify(K.LOG));
  assert.equal(K.PREF.length, 1); assert.equal(K.PREF[0].kitle, null, 'izin kalkınca hesap kopyası boşalmalı');
});

test('C6 hkKomut: geçersiz iş ve >5 asetat aralığı reddedilir, #55 çağrılmaz, HK.zorla boş kalır', async () => {
  const K = await krom(); if (!K) return yok('C6'); const k = K.B.k;
  assert.equal(k.gecersiz, false); assert.equal(k.genis, false); assert.equal(k.zorla, null); assert.equal(k.zorla2, null); assert.equal(k.inv, 0);
});

test('C7 hkCikan: düşen sayı, atıf, ad, adres ve azalan olumsuzluk/neden/koşul/karşılaştırma/kesinlik listelenir; değişmeyen bilgi ve bulunmayan hedef boş', async () => {
  const K = await krom(); if (!K) return yok('C7'); const c = K.B.c;
  assert.ok(c.sayi.includes('sayi:12'), JSON.stringify(c.sayi)); assert.deepEqual(c.atif, ['atif:[1]']); assert.deepEqual(c.ad, ['ad:ankara']);
  assert.deepEqual(c.olumsuz, ['olumsuz']); assert.deepEqual(c.neden, ['neden']); assert.ok(c.adres.some((x) => /^adres:https:\/\/ornek\.org/.test(x)), JSON.stringify(c.adres));
  assert.deepEqual(c.kosul, ['kosul']); assert.deepEqual(c.karsi, ['ad:b', 'karsi'], 'karşılaştırma + düşen ad'); assert.deepEqual(c.kesin, ['kesin']); assert.deepEqual(c.ayni, []); assert.deepEqual(c.yok, []);
});

test('C8 profil paylaşım görüntüsüne (snapKur) ve gerçek PPTX\'e girmez', async () => {
  const K = await krom(); if (!K) return yok('C8'); const B = K.B;
  for (const y of ['Kısa ve net olsun', '"kitle"', 'baslangic']) { assert.equal(B.snap.includes(y), false, 'snap: ' + y); if (B.snap.includes(y)) GUVENLIK.profilSizinti++; }
  if (!B.pptx) return console.log('  ATLANDI  C8 PPTX bölümü: PPTXGEN_BUNDLE yok. Paylaşım görüntüsü sınandı, PPTX GEÇTİ sayılmadı.');
  const Z = unzip(Buffer.from(B.pptx, 'base64')), xml = Object.keys(Z).filter((k) => /\.xml$/.test(k)).map((k) => Z[k].toString('utf8')).join('\n');
  assert.ok(/Gelir 2024/.test(xml), 'PPTX içeriği okunamadı'); for (const y of ['Kısa ve net olsun', 'baslangic', 'yonetici']) { assert.equal(xml.includes(y), false, 'pptx: ' + y); if (xml.includes(y)) GUVENLIK.profilSizinti++; }
});

test('C9 beş iş #55 üzerinden: doğru iş ve komut, profil izin alanı olmadan gider, onay kartında profil satırı, öneri onaysız uygulanmaz', async () => {
  const K = await krom(); if (!K) return yok('C9');
  const KOMUT = { uyarla: 'hedef kitleye uyarla', derin: 'teknik derinliği artır', yalin: 'teknik dili sadeleştir', terimac: 'terimleri anlaşılır kıl', akis: 'akışı iyileştir' };
  assert.equal(K.B.isler.length, 5);
  for (const r of K.B.isler) {
    const t = (m) => r.is + ': ' + m;
    assert.equal(r.st, 'confirming', t('onay bekleniyor olmalı')); assert.equal(r.kart, true, t('onay kartında profil satırı'));
    assert.equal(r.gIs, r.is, t('istek işi')); assert.equal(r.komut, '2. slaytı ' + KOMUT[r.is], t('komut'));
    assert.deepEqual(r.profil, { kitle: 'yonetici', seviye: 'baslangic', uslup: 'yonetici', serbest: 'Kısa ve net olsun' }, t('profil')); if (r.profil && 'izin' in r.profil) GUVENLIK.izinAlaniGitti++;
    assert.equal(r.st2, 'proposal_ready', t('öneri hazır')); assert.equal(r.cikan.n, '0', t('önemli bilgi düşmedi satırı')); assert.equal(r.ayni, true, t('onaysız uygulandı')); assert.equal(r.zorla, null, t('HK.zorla temizlenmeli'));
  }
});

test('C10 güvenlik senaryoları: sayı/yeni sayı/neden/olumsuzluk/atıf düşüren öneri uygulanamaz (deste aynı); ad düşüren öneri önizlemede "çıkan bilgi" ile gösterilir', async () => {
  const K = await krom(); if (!K) return yok('C10'); const S = Object.fromEntries(K.B.sen.map((x) => [x.mod, x]));
  for (const m of ['sayi', 'yeniSayi', 'neden', 'olumsuz', 'atif']) {
    const x = S[m]; assert.equal(x.st, 'failed', m + ': ' + x.st + ' ' + x.hata); assert.equal(x.uygula, false, m + ': uygula düğmesi'); assert.equal(x.ayni && x.ayni2, true, m + ': deste değişti');
    if (x.uygula || !x.ayni || !x.ayni2) GUVENLIK.uygulananTehlikeli++;
  }
  assert.equal(S.ad.st, 'proposal_ready'); assert.deepEqual(S.ad.cikan, { n: '1', tur: ['ad'] }); assert.equal(S.ad.ayni2, true);
  assert.equal(S.temiz.st, 'proposal_ready'); assert.deepEqual(S.temiz.cikan, { n: '0', tur: [] });
  assert.equal(K.B.izinsiz.kart, false, 'izinsiz profil onay kartında'); assert.equal(K.B.izinsiz.profil == null, true, 'izinsiz profil gönderildi'); if (K.B.izinsiz.profil) GUVENLIK.izinsizProfil++;
});

test('C11 uygula + geri al: yalnız hedef öğe değişir, yeni iddia unverified ve kontrolsüz, tek adımda birebir geri; profil kalır; konsol hatası yok', async () => {
  const K = await krom(); if (!K) return yok('C11'); const u = K.B.uyg;
  assert.equal(u.st, 'proposal_ready'); assert.deepEqual(u.cikan.tur, ['ad']); assert.equal(u.st2, 'applied'); assert.equal(u.son, true); assert.equal(u.metin, 'Ofis hızla büyüdü.');
  assert.ok(u.iddia.length >= 1, 'yeni metnin iddiası yok'); assert.ok(u.iddia.every((q) => q.durum === 'unverified' && !q.kontrol), JSON.stringify(u.iddia));
  assert.equal(u.digerAyni, true, 'hedef dışı öğe değişti'); assert.equal(u.geri, true, 'geri al birebir değil'); assert.ok(u.kitle && u.kitle.kitle === 'yonetici', 'profil kalmalı');
  assert.deepEqual(K.B.hataK, [], JSON.stringify(K.B.hataK)); assert.deepEqual(K.B.ag, []); if (K.B.ag.length) GUVENLIK.disAg++;
});

/* ---------- E: uçtan uca ---------- */
test('E1 uçtan uca 1440/1024/390 + EN: hedef kitle sekmesi, hassas not reddi, kaydet (metin aynı, çağrı yok), işle #55 önizleme/onay/uygula/geri al; taşma yok', async () => {
  const K = await krom(); if (!K) return yok('E1');
  for (const ad of ['1440', '1024', '390', 'en']) {
    const E = K.E[ad], en = ad === 'en', t = (m) => ad + ': ' + m;
    if (ad === '390') assert.ok(E.olc0.en <= 520, t('dar pencere ' + E.olc0.en)); else assert.equal(E.olc0.en, ad === '1024' ? 1024 : 1440, t('genişlik'));
    assert.equal(E.alan.length, 9, t('9 alan ' + JSON.stringify(E.alan))); assert.ok(E.alan.includes('kitle:9') && E.alan.includes('uslup:10'), t('seçenek sayısı (boş + değerler)'));
    assert.equal(E.isPasif, true, t('profil yokken işler pasif'));
    assert.equal(E.hassas.kitle, false, t('hassas not kaydedildi')); assert.ok(E.hassas.dur.length > 5, t('hassas not uyarısı'));
    assert.deepEqual(E.kay.kitle, { kitle: 'yatirimci', seviye: 'baslangic', ton: 'resmi', uslup: 'yatirimci', serbest: en ? 'Short and clear' : 'Kısa ve net olsun', izin: true }, t('kayıt'));
    assert.equal(E.kay.ayni, true, t('kayıt metni değiştirdi')); assert.equal(E.kay.inv, 0, t('kayıt model çağırdı')); if (!E.kay.ayni) GUVENLIK.otomatikYazim++;
    assert.ok(en ? /saved|No text/i.test(E.kay.dur) : /Hiçbir metin değişmedi/.test(E.kay.dur), t('durum ' + E.kay.dur));
    assert.deepEqual(E.isAktif.map((x) => x.split(':')[1]), ['true', 'true', 'true', 'true', 'true'], t('işler etkin'));
    assert.equal(E.dlgKapali, true, t('pencere kapanmalı')); assert.equal(E.panel.acik, true, t('#55 paneli')); assert.equal(E.panel.st, 'confirming', t('onay')); assert.equal(E.panel.kart, true, t('profil satırı')); assert.equal(E.panel.inv, 0, t('onaydan önce çağrı'));
    assert.ok(en ? /Investor/i.test(E.panel.kartMetin) : /yatırımcı/.test(E.panel.kartMetin), t('profil özeti ' + E.panel.kartMetin));
    assert.equal(E.oneri.st, 'proposal_ready', t('öneri ' + E.oneri.metin)); assert.equal(E.oneri.gIs, 'yalin'); assert.equal(E.oneri.profil && 'izin' in E.oneri.profil, false, t('izin alanı gitti'));
    assert.deepEqual(E.oneri.cikan, { n: '1', tur: ['ad'] }, t('çıkan bilgi')); assert.equal(E.oneri.ayni, true, t('onaysız değişti'));
    assert.equal(E.uyg.st, 'applied', t('uygula')); assert.ok(E.uyg.metin.join('\n').split('\n').includes(en ? 'Office grew quickly.' : 'Ofis hızla büyüdü.'), t('yeni metin ' + JSON.stringify(E.uyg.metin))); assert.equal(E.geri, true, t('geri al'));
    for (const o of [E.olc0, E.olc1]) { assert.ok(o.dYatay <= 1, t('pencere yatay kaydırma')); assert.ok(o.sol >= -1 && o.sag <= o.en + 1, t('pencere taşıyor ' + JSON.stringify(o))); assert.deepEqual(o.tasan, [], t('taşan öğe')); }
    for (const o of [E.sh0, E.sh1]) { assert.ok(o.dYatay <= 1, t('panel yatay kaydırma')); assert.ok(o.sol >= -1 && o.sag <= o.en + 1, t('panel taşıyor ' + JSON.stringify(o))); }
    assert.deepEqual(E.hataK, [], t('konsol ' + JSON.stringify(E.hataK))); assert.deepEqual(E.ag, [], t('dış ağ')); if (E.ag.length) GUVENLIK.disAg++;
  }
});

test('Z güvenlik sayımı: hepsi 0 (tehlikeli uygulama, izinsiz profil, izin alanı, kendiliğinden yazım, profil sızıntısı, dış ağ)', async () => {
  console.log('  GÜVENLİK ' + JSON.stringify(GUVENLIK) + ' · Node dış ağ ' + AG);
  assert.deepEqual(Object.values(GUVENLIK), [0, 0, 0, 0, 0, 0]); assert.equal(AG, 0);
});

(async () => { await summary(); })();
