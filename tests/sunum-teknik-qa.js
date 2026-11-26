/* ==========================================================================
   SUNUM — PHASE 4: TEKNİK DESTE DENETİMİ (26.11.2026)
   Kaynak: ACADEX-QA-TRANSFER #30 (denetim) ve #31 (uygulama).

   Sorun: içerik puanı (yönetmen qualityDeck) desteyi yalnız metinden puanlıyordu; yedek yoldan gelen deste ölçülmeden
   100/100 alıyordu (F1, T6: 4 boş asetatlı deste "geçti"), istenen sayfa sayısı hiç sınanmıyordu (F2), üretim yolu
   kaydedilmiyordu (F3), audit() hiçbir puana/kayda dokunmuyordu (F4), dışa aktarmada düşen fotoğraf/çizim/grafik/
   tablo hiçbir yere yazılmıyordu (F5).

   Çözüm (yalnız js/acadex-ink.js):
     - teknikQA(d, kapsam, ek): audit()'in yardımcılarıyla yapı + görsel + (doğrulanmış şablon yazısıyla) geometri
       denetimi. Desteyi DEĞİŞTİRMEZ; sonuç WeakMap'te. Sayısal teknik puan yok: durum + sayılar + kodlar.
     - D1: ≥ 1 teknik hata → etkin puan min(içerik, 59), pass:false. İçerik puanı quality_report.icerik'te kalır.
     - D2: kalite rozetinin yanında "teknik hata (N)" / "teknik uyarı (N)" → var olan Asetat denetimi.
     - F1: yönetmen 'generate' puanı nihai değildir (kaynakKalite); critique ölçer. F2: istenen sayı (yalnız eksik yön,
       normalizeDeck'in %75 eşiğinin altında kalacak biçimde) critique'e gider.

   A: kaynak kuralları · B: T6/F2 (yönetmenin GERÇEK qualityDeck'i) · C: tarayıcı (başsız Chrome, sahte hesap, ağ yok):
   açık/kapalı eşitliği, senaryolar, geometri, dışa aktarma, çapraz cihaz, süre.
   ========================================================================== */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFile, spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { makeRunner, loadFromSource } = require('./_ts-extract.js');
const { test, summary } = makeRunner();

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const ink = read('js/acadex-ink.js');
const cut = (a, b) => { const i = ink.indexOf(a); assert.ok(i >= 0, 'bulunamadı: ' + a); const j = ink.indexOf(b, i + a.length); assert.ok(j > i, 'son bulunamadı: ' + b); return ink.slice(i, j); };
const BLOK = cut('  var TEKNIK = {', '  var fixSlide = function');
const QA_FN = cut('  var teknikQA = function (d, kapsam, ek) {', '\n  };\n');

/* ------------------------------ A: kaynak kuralları ------------------------------ */
test('T1 teknikQA yalnız okur: kaydettirmez, çizmez, sığdırmaz, bildirim göstermez, hesaba yazmaz', () => {
  const yasak = /dirty\(|saveNow|store\.|snapTazele|\bsay\(|render(All|Stage|Thumbs)\(|fitSlide|fitEl\(|settle\(|kaliteOlc\(|queueCloud|localStorage/;
  assert.ok(!yasak.test(BLOK), 'teknik blokta yan etkili çağrı: ' + (BLOK.match(yasak) || [])[0]);
  assert.ok(/teknikIz\.set\(d, \{ anahtar: anahtar/.test(QA_FN), 'sonuç WeakMap dışına yazılıyor');
  /* alan yazımı yalnız yeni nesnelere: x (önbellek kaydı), r (yeni rapor), tkBtn (rozet düğmesi); deste/asetat/öğeye hiç */
  const hedef = [...BLOK.matchAll(/\b([A-Za-z_$][\w$]*)\.[\w$.]+(\[[^\]]*\])?\s*=(?!=)/g)].map((m) => m[1]);
  assert.ok(hedef.length && hedef.every((h) => /^(x|r|tkBtn)$/.test(h)), 'teknik blok nesne alanına yazıyor: ' + hedef.join(','));
  assert.ok(!/\b(d|s|e|sl|els|q|t|tq|deck)\[[^\]]*\]\s*=(?!=)/.test(BLOK), 'teknik blok desteye yazıyor');
  const au = cut('  var audit = function', '\n  };\n'); assert.ok(!/teknik/.test(au), 'audit() değişti');
});

test('T2 kodlar tek tabloda: kullanılan her kod TEKNIK\'te, TEKNIK\'teki her kod bir yerde üretiliyor; sayısal teknik puan yok', () => {
  const tablo = Object.keys(Function('return ' + BLOK.slice(BLOK.indexOf('{'), BLOK.indexOf('\n  };\n') + 4))());
  assert.equal(tablo.length, 27);
  const govde = ink.replace(BLOK.slice(0, BLOK.indexOf('\n  };\n')), '');
  const kullanilan = new Set((govde.match(/'([A-Z][A-Z_]{4,})'/g) || []).map((x) => x.slice(1, -1)).filter((x) => /_/.test(x) && tablo.includes(x) || /^(DECK|SLIDE|PLACEHOLDER|EL|LAYOUT|CHART|TABLE|IMG|CREDIT|TEXT|FONT|REFS|FALLBACK|SNAPSHOT|EXPORT|PDF)_/.test(x)));
  kullanilan.forEach((k) => assert.ok(tablo.includes(k), 'tabloda olmayan kod: ' + k));
  tablo.forEach((k) => assert.ok(kullanilan.has(k), 'hiç üretilmeyen kod: ' + k));
  const oz = cut('  var teknikOzet = function (d) {', '\n  };\n');
  assert.match(oz, /return \{ v: 1, status: r\.status, errors: r\.summary\.errors, warnings: r\.summary\.warnings, codes: codes \};/);
  assert.ok(!/score/.test(QA_FN), 'teknik sonuçta sayısal puan');
});

test('T3 çalışma noktaları: basım (A), açılış (C), PPTX başarı+hata ve PDF (D) — her kayıt öncekinin yerine; her kayıtta yeniden denetim yok (E)', () => {
  assert.ok(ink.includes("if (mode !== 'append' && !deck.quality && deck.slides.length) kaliteOlc(deck);\n    teknikQA(deck, 'deste');"), 'basımda denetim yok');
  assert.equal(ink.split("teknikDisaKaydet(d0, 'pptx', qaK);").length - 1, 1);
  assert.equal(ink.split("teknikDisaKaydet(d0, 'pptx', [['EXPORT_FAILED', null, null]]);").length - 1, 1);
  assert.ok(ink.includes("teknikDisaKaydet(deck, 'pdf', printBox.children.length !== deck.slides.length ? [['PDF_PAGE_MISMATCH', null, null]] : []);"));
  assert.ok(ink.includes('renderAll(); paintHist(); paintDecks(); teknikPlanla();'), 'açılışta denetim yok');
  ['EXPORT_IMG_DROPPED', 'EXPORT_CHART_SKIPPED', 'EXPORT_TABLE_SKIPPED', 'EXPORT_DRAWING_DROPPED'].forEach((k) => assert.equal(ink.split("qaK.push(['" + k + "', si, e.id])").length - 1, 1, k));
  assert.match(QA_FN, /x\.tur\[ek\.tur\] = arr\(ek\.kayit\)\.map/, 'aktarım kaydı eklemeli (append) olmamalı');
  const sv = cut('    saveLocal: function (d) {', '\n    },\n'); assert.ok(!/teknik/.test(sv), 'her yerel kayıtta denetim (E)');
  const yu = cut('  var yaziUyum = function () {', '\n  };\n'); assert.ok(!/teknik/.test(yu), 'kesilen dilimde (yaziUyum) teknik çağrı: düzenekler kırılır');
  /* dışa aktarmanın kendisi ve bildirimleri değişmez (Phase 2 hoşgörüsü) */
  assert.ok(ink.includes("say('PowerPoint dosyası indirildi.' + (skipped ? ' ' + skipped + ' çizim aktarılamadı; PDF çıktısında görünür.' : '') + (atlanan ? ' ' + atlanan + ' fotoğraf açılamadığı için dosyaya konmadı (bağlantısı artık çalışmıyor).' : ''));"));
  assert.match(ink, /if \(e\.src && !isrc\) \{ atlanan\+\+; continue; \}/);
});

test('T4 D1 kalıcılık: etkin puan quality_score\'a, içerik puanı icerik\'e, teknik yalnız {v,status,errors,warnings,codes}; açılışta içerik puanı geri gelir', () => {
  assert.ok(ink.includes('if (row.quality_report) { var tq = teknikOzet(d), et = etkinKalite(d.quality, tq); row.quality_score = Math.max(0, Math.min(100, Math.round(et.score))); row.quality_report = teknikRapor(d, tq) || d.quality; }'));
  assert.ok(ink.includes("if (qq && qq.icerik && typeof qq.icerik.score === 'number') {"), 'eski etkin puan içerik puanı sanılır');
  const et = cut('  var etkinKalite = function (q, t) {', '\n  };\n');
  assert.ok(et.includes('score: hata ? Math.min(q.score, 59) : q.score, pass: hata ? false : ip'));
  assert.ok(et.includes("var hata = !!(t && t.status === 'error')"), 'uyarı/bilgi puanı düşürmemeli');
});

test('T5 F1/F2/F3 kaynakta: yönetmen puanı nihai değil, istek eksik yönde ve sınırlı, üretim yolu ayrı alanda (via değişmez)', () => {
  assert.ok(ink.includes('if (plotMeta.yolDir) { plotMeta.kaynakKalite = plotMeta.quality; plotMeta.quality = null; }'));
  assert.ok(ink.includes("plotMeta.yol = plotMeta.yolDir ? { k: 'director', yedek: 1 } : { k: 'legacy', yedek: plotMeta.webFail ? 1 : 0 };"));
  assert.ok(ink.includes('plotMeta.istek = o.n > 0 ? +o.n : 0;'));
  assert.ok(ink.includes("slideCount: ist > uretilen ? Math.min(sl.length + (ist - uretilen), Math.floor(sl.length * 4 / 3)) : sl.length }"));
  assert.deepEqual(ink.match(/plotMeta\.via = '\w+'/g), ['ai', 'docstory', 'local', 'research', 'ai', 'skeleton'].map((v) => "plotMeta.via = '" + v + "'"), 'via değiştirildi (Phase 4 ayrı alan kullanır)');
});

/* ------------------------------ B: T6 + F2, yönetmenin gerçek qualityDeck'i ------------------------------ */
const DIR = loadFromSource('supabase/functions/acadia-presentation-director/index.ts', ['allowedVisuals', 'allowedVariants', 'allowedLayouts', 'allowedDiagramTypes', 'cleanText', 'words', 'repeatedFacts', 'clampInt',
  'normalizeCards', 'normalizeChart', 'normalizeDiagram', 'normalizeSteps', 'normalizeTable', 'normalizeSlide', 'normalizeDeck', 'restoreMeasured', 'qualityDeck']);
/* critique eylemi (index.ts 662) birebir: sayı → normalizeDeck → restoreMeasured → qualityDeck */
const critique = (body) => { const raw = body.presentation, count = DIR.clampInt(body.slideCount ?? raw.slides.length, 1, 30, raw.slides.length || 1), deck = DIR.normalizeDeck(raw, count, 'topic'); DIR.restoreMeasured(deck, raw); return DIR.qualityDeck(deck, count, 'topic'); };
const istemciSayi = Function('ist', 'uretilen', 'sl', 'return ' + ink.match(/slideCount: (ist > uretilen \? Math\.min\(sl\.length \+ \(ist - uretilen\), Math\.floor\(sl\.length \* 4 \/ 3\)\) : sl\.length) \}/)[1] + ';');
const T6 = [48, 46, 0, 15, 0, 17, 0, 37, 0, 0, 6, 37];
const kelime = (n) => Array.from({ length: n }, (_, i) => ['enerji', 'verim', 'şehir', 'ölçüm', 'kaynak', 'yatırım', 'iklim', 'uyum'][i % 8] + (i + 1)).join(' ');
const t6Govde = (olcumlu) => ({ title: 'T6', slides: T6.map((n, i) => ({ title: 'Asetat ' + (i + 1), speaker_notes: kelime(30), content: Object.assign({ text: kelime(n), design_variant: i === 0 ? 'cover' : 'list', look: (i === 0 ? 'cover' : 'list') + ':' + (i % 3) }, olcumlu ? { has_visual: false, placeholder: false } : {}) })) });

test('T6 (verbatim [48,46,0,15,0,17,0,37,0,0,6,37]): ölçümsüz yönetmen yolu 100 verirdi; critique ≤ 59 ve geçmez; D1 tavanı tek başına da 59', () => {
  /* generate yolu: aynı deste, yönetmenin kendi düzen adlarıyla ama has_visual/placeholder ölçümü OLMADAN */
  const g = t6Govde(false), gd = DIR.normalizeDeck(g, 12, 'topic'); DIR.restoreMeasured(gd, g); const eski = DIR.qualityDeck(gd, 12, 'topic');
  assert.equal(eski.score, 100, 'yeniden üretim: ölçümsüz yol'); assert.equal(eski.pass, true);
  const q = critique({ presentation: t6Govde(true), slideCount: 12 });
  assert.ok(q.score <= 59 && q.pass === false, JSON.stringify(q)); assert.ok(q.issues.includes('empty_slides'), JSON.stringify(q));
});

test('T7 F2: istenen sayı yalnız eksikte gider, normalizeDeck eşiğini (INCOMPLETE_PRESENTATION) aşmaz, slide_count_mismatch üretir', () => {
  const sl = (n) => Array.from({ length: n }, (_, i) => ({ title: 'A' + i, speaker_notes: kelime(30), content: { text: kelime(30), design_variant: 'list', look: 'list:' + (i % 4), has_visual: true, placeholder: false } }));
  assert.equal(istemciSayi(0, 8, sl(8)), 8, 'istek bilinmiyorsa uydurulmaz'); assert.equal(istemciSayi(6, 8, sl(8)), 8, 'fazlası eksiklik değil');
  assert.equal(istemciSayi(12, 8, sl(8)), 10, '4/3 sınırı');
  assert.throws(() => critique({ presentation: { title: 'x', slides: sl(8) }, slideCount: 12 }), /INCOMPLETE_PRESENTATION/, 'sınırsız sayı puanı hiç oluşturmazdı');
  for (let n = 4; n <= 20; n++) for (let ist = 0; ist <= 30; ist++) { const c = istemciSayi(ist, n, sl(n)); assert.doesNotThrow(() => critique({ presentation: { title: 'x', slides: sl(n) }, slideCount: c }), 'n=' + n + ' ist=' + ist); }
  const q = critique({ presentation: { title: 'x', slides: sl(8) }, slideCount: istemciSayi(12, 8, sl(8)) });
  assert.ok(q.issues.includes('slide_count_mismatch'), JSON.stringify(q));
});

/* ------------------------------ C: tarayıcı ------------------------------ */
const { CHROME, yeniSunucu, duzenek } = require('./_capraz-duzenek.js');
if (!CHROME) {
  console.log('  ATLANDI  T8–T16 (başsız Chrome: açık/kapalı eşitliği, senaryolar, geometri, dışa aktarma, çapraz cihaz, süre): Chrome bulunamadı — CHROME_BIN ile yol verin. Bu testler GEÇTİ sayılmadı.');
  summary();
} else (async () => {
  const { W, sayfa, kos, temizle } = duzenek();
  const KANCA_QA = `  window.__QA = { qa: teknikQA, taze: teknikTazeSonuc, ozet: teknikOzet, etkin: etkinKalite, rapor: teknikRapor, sure: function () { return teknikSure; }, exportPptx: exportPptx, FMIN: FMIN, snapHazir: snapHazir };\n`;
  const qaSayfa = (port, govde, kapali) => {
    let h = sayfa('ok', port, 0, govde); const r = (a, b) => { assert.equal(h.split(a).length, 2, 'sayfa: ' + a.slice(0, 50)); h = h.replace(a, () => b); };
    r('  window.__S = { set:', KANCA_QA + '  window.__S = { set:');
    if (kapali) {      /* KAPALI: teknikQA'nın gövdesi HİÇ çalışmaz (boş sonuç önbelleğe yazılır); açık koşu desteye dokunursa eşitlik bozulur */
      r('  var teknikQA = function (d, kapsam, ek) {\n    if (!d) return null;\n', "  var teknikQA = function (d, kapsam, ek) {\n    if (!d) return null;\n    var bos = { v: 1, status: 'pass', olcum: { geometri: 'skipped', yazi: 'bekliyor' }, summary: { errors: 0, warnings: 0, info: 0, checkedSlides: 0, skipped: ['geometri'] }, issues: [] };\n    teknikIz.set(d, { anahtar: teknikAnahtar(d), olc: snapHazir(d) ? yaziIz() : 'skip', sonuc: bos }); return bos;\n");
    }
    return h;
  };
  /* uzun koşu (çok basım): duzenek.kos ile aynı, daha geniş sanal süre */
  const kosUzun = (dosya, prof, icerik) => new Promise((res, rej) => {
    fs.writeFileSync(path.join(W, dosya), icerik);
    execFile(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + path.join(W, 'prof-' + prof), '--allow-file-access-from-files', '--virtual-time-budget=240000', '--dump-dom', pathToFileURL(path.join(W, dosya)).href], { maxBuffer: 64 << 20, timeout: 300000 }, (e, out) => {
      if (e) return rej(e); const m = String(out).match(/<pre id="diag">([\s\S]*?)<\/pre>/); if (!m) return rej(new Error(dosya + ': diag yok'));
      res(JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&')));
    });
  });
  const STRIPS = [{ k: 'cover', t: 'Sürdürülebilir şehirler', b: [] },
    { k: 'list', t: 'Şehirler neden kilit?', b: ['Dünya nüfusunun yarısından fazlası şehirlerde yaşıyor', 'Enerji tüketiminin yaklaşık üçte ikisi kentlerden', 'İklim uyumu kararları yerel yönetimlerde veriliyor'] },
    { k: 'list', t: 'Kentsel ısı adası', b: ['Asfalt ve beton gündüz ısıyı depolayıp gece salıyor', 'Şehir merkezi kırsala göre 3–5 °C daha sıcak olabiliyor', 'En çok etkilenenler yaşlılar ve dış mekân çalışanları'] },
    { k: 'two', t: 'Ağaç mı beyaz çatı mı?', b: ['Gölge yaratır', 'Nemi artırır', 'Hızlı uygulanır', 'Ucuzdur'], heads: ['Ağaç', 'Beyaz çatı'], split: 2 },
    { k: 'stat', t: 'Ulaşım rakamları', b: ['%18 — toplu taşıma artışı', '410 km — bisiklet yolu', '%11 — trafik azalışı'], data: { stats: [{ value: '%18', label: 'toplu taşıma artışı' }, { value: '410 km', label: 'bisiklet yolu' }, { value: '%11', label: 'trafik azalışı' }] } },
    { k: 'time', t: 'Kent planının tarihçesi', b: ['1985: ilk yeşil alan yönetmeliği', '2004: bisiklet yolu planı', '2019: ısı haritası', '2023: iklim uyum eylem planı'] },
    { k: 'list', t: 'Sonuç ve öneriler', b: ['Isı haritası olmadan yatırım önceliklendirilmemeli', 'Gölge ve su çözümleri birlikte planlanmalı', 'Her proje ölçümle izlenmeli'] },
    { k: 'end', t: 'Teşekkürler', b: [] }];
  const PM = { title: 'Teknik', sub: 't', lang: 'tr', source: 'topic', sourceId: null, yol: { k: 'research', yedek: 0 }, sources: [], istek: 7 };
  const KALITE = { version: 11, quality: { score: 84, issues: ['weak_speaker_notes'], pass: true } };
  const ONCU = (kalite) => `
    window.__inv = []; window.__body = []; window.__hata = []; window.__toast = []; window.__say = { save: 0, push: 0 }; window.__print = 0; var QA = window.__QA;
    var ce = console.error; console.error = function () { window.__hata.push(Array.prototype.slice.call(arguments).map(String).join(' ').slice(0, 200)); return ce.apply(console, arguments); };
    window.addEventListener('error', function (e) { window.__hata.push('onerror ' + (e.message || '')); });
    window.addEventListener('unhandledrejection', function (e) { window.__hata.push('unhandled ' + String(e.reason && e.reason.message || e.reason)); });
    window.print = function () { window.__print++; };
    window.supabaseClient.functions.invoke = function (name, opt) { var b = (opt && opt.body) || {}; window.__inv.push(name + ':' + (b.action || 'research'));
      if (b.action === 'critique') { window.__body.push(JSON.parse(JSON.stringify(b))); return Promise.resolve({ data: JSON.parse(${JSON.stringify(JSON.stringify(kalite))}) }); }
      if (b.action === 'plan') return Promise.resolve({ data: { plan: null, durum: 'kapali', rid: 'abcdef012345' } });
      return Promise.resolve({ data: {} }); };
    var PPTX = []; var vekil = function (ad) { return new Proxy(function () {}, { get: function (t, k) { if (k === 'then') return undefined; return vekil(ad + '.' + String(k)); }, apply: function (t, s, a) { PPTX.push([ad, JSON.parse(JSON.stringify(a))]); return vekil(ad + '()'); }, set: function (t, k, v) { PPTX.push([ad + '.' + String(k) + '=', JSON.parse(JSON.stringify(v))]); return true; } }); };
    var sahtePptx = function () { var o = { ShapeType: new Proxy({}, { get: function (t, k) { return 'shape:' + String(k); } }), ChartType: new Proxy({}, { get: function (t, k) { return 'chart:' + String(k); } }),
      addSlide: function () { return vekil('slide'); }, writeFile: function (x) { PPTX.push(['writeFile', x && x.fileName]); return Promise.resolve(); } };
      return new Proxy(o, { set: function (t, k, v) { PPTX.push(['pp.' + String(k) + '=', v]); t[k] = v; return true; } }); };
    window.PptxGenJS = sahtePptx;
    new MutationObserver(function () { var t = (d.querySelector('[data-toast-t]') || {}).textContent || ''; if (t && window.__toast[window.__toast.length - 1] !== t) window.__toast.push(t); }).observe(d.body, { subtree: true, childList: true, characterData: true });
    var rozet = function () { var b = d.querySelector('[data-teknik]'), k = d.querySelector('[data-kalite]'); return { teknik: b ? (b.hidden ? null : b.textContent) : 'yok', baslik: b && !b.hidden ? b.title : null, kalite: k ? k.textContent : null }; };
    var kodlar = function (r) { return r ? r.issues.map(function (z) { return z.code + '@' + z.slide + (z.severity === 'error' ? '!' : z.severity === 'warning' ? '?' : '.'); }) : null; };
    await sakin();
  `;
  const bas = (strips, pm) => `S.set(${JSON.stringify(strips)}, ${JSON.stringify(pm)}); S.bas('new'); await sakin();`;

  /* 1) Ana akış: basım → kalite → paylaşım → PPTX → PDF. Açık ×2 ve kapalı. */
  const ANA = ONCU(KALITE) + `
    var s0 = S.store.saveLocal, p0 = S.store.push;
    S.store.saveLocal = function () { window.__say.save++; return s0.apply(this, arguments); }; S.store.push = function () { window.__say.push++; return p0.apply(this, arguments); };
    d.querySelector('[data-newdeck]').click(); S.temaSec(TEMA); ${bas(STRIPS, PM)}
    await bekle(4000); await dur(1500);
    d.querySelector('[data-sh-on]').click(); await bekle(2500); await dur(1500);
    d.querySelector('[data-pptx]').click(); await bekle(1500);
    d.querySelector('[data-pdf]').click(); await bekle(800); window.dispatchEvent(new Event('afterprint')); await bekle(1500); await dur(1500);
    var temiz = function (k, v) { return /^(id|creditId|sid|updated|surum|dbId)$/.test(k) ? undefined : v; };
    R.slaytlar = JSON.stringify(S.deck().slides, temiz);
    R.html = Array.prototype.slice.call(d.querySelectorAll('.sx-thv')).map(function (x) { return x.innerHTML.replace(/ data-id="[^"]*"/g, ''); }).join('\\n');
    R.pptx = JSON.stringify(PPTX); R.say = window.__say; R.inv = window.__inv; R.hata = window.__hata; R.toast = window.__toast; R.print = window.__print;
    R.yerel = (localStorage.getItem(S.store.k('d.' + S.deck().id)) || '').replace(/"(id|creditId|updated|surum|dbId|share)":("[^"]*"|\\d+),?/g, '').replace(/"uret":\\[[^\\]]*\\]/, '"uret":[]');      /* uret: rastgele asetat kimlikleri */
    R.kalite = S.deck().quality; R.yol = S.deck().yol; R.teknik = QA.taze(S.deck()); R.rozet = rozet(); R.body = window.__body;
  `;
  const temizDB = (x) => JSON.parse(JSON.stringify(x, (k, v) => (/^(id|presentation_id|user_id|updated_at|created_at|surum|share_token|creditId|dbId)$/.test(k) ? undefined : typeof v === 'string' ? v.replace(/ data-id="[^"]*"/g, '') : v)));
  const anaKos = async (ad, kapali) => {
    const H = yeniSunucu({ senkron: true }); await new Promise((r) => H.srv.listen(0, '127.0.0.1', r));
    try {
      const port = H.srv.address().port, r = await kos('qa-' + ad + '.html', 'qa-' + ad, qaSayfa(port, ANA, kapali));
      const P = H.DB.presentations[0] || {};
      r.satirlar = JSON.stringify(temizDB(H.DB.presentation_slides.filter((x) => x.presentation_id === P.id).sort((a, b) => a.order_index - b.order_index)));
      r.goruntu = JSON.stringify(temizDB(P.share_snapshot || null)); r.yazma = H.LOG.filter((x) => x.op && x.op !== 'select').length;
      r.satir = temizDB(Object.assign({}, P, { share_snapshot: undefined }));
      if (!kapali) {      /* aynı hesap: B temiz profil (başka cihaz), A aynı profil (yerel kopya) */
        const ACIK = ONCU(KALITE) + `await dur(4000); await bekle(2500); await dur(500); R.kalite = S.deck().quality; R.yol = S.deck().yol; R.teknik = QA.taze(S.deck()); R.rozet = rozet(); R.inv = window.__inv; R.hata = window.__hata;`;
        r.B = await kos('qa-' + ad + '-B.html', 'qa-' + ad + '-B', qaSayfa(port, ACIK)); r.A2 = await kos('qa-' + ad + '-A2.html', 'qa-' + ad, qaSayfa(port, ACIK));
        r.yazmaSonra = H.LOG.filter((x) => x.op && x.op !== 'select').length;
      }
      return r;
    } finally { H.srv.close(); }
  };

  /* 2) Senaryolar: geçerli deste, yapı fikstürleri, geometri, dışa aktarma, T6, 20 asetat süresi */
  const T6S = [{ k: 'cover', t: 'Yenilenebilir enerji', b: [] }].concat(T6.slice(1).map((n, i) => ({ k: 'list', t: 'Bölüm ' + (i + 1), b: n ? kelime(n).split(' ').reduce((a, w, j) => { if (j % 8 === 0) a.push(w); else a[a.length - 1] += ' ' + w; return a; }, []) : [] })));
  const YOGUN = [{ k: 'cover', t: 'Yoğun deste', b: [] }, { k: 'list', t: 'Ayrıntılı açıklamalar', b: Array.from({ length: 8 }, (_, i) => kelime(34 + i)) }, { k: 'end', t: 'Teşekkürler', b: [] }];
  const YIRMI = [STRIPS[0]].concat(Array.from({ length: 18 }, (_, i) => Object.assign({}, STRIPS[1 + (i % 6)], { t: STRIPS[1 + (i % 6)].t + ' ' + (i + 1) })), [STRIPS[7]]);
  const SEN = ONCU({ version: 11, quality: { score: 100, issues: [], pass: true } }) + `
    var D = function () { return S.deck(); }, kopya = function () { return JSON.parse(JSON.stringify(D())); };
    var icerik = function (c) { for (var i = 1; i < c.slides.length - 1; i++) if (!/^(cover|end|refs)$/.test(c.slides[i].lay || '')) return c.slides[i]; };
    var yazi = function (s) { return s.els.filter(function (e) { return (e.type === 't' || e.type === 'ul') && e.text && !e.muted; })[0]; };
    var s0 = S.store.saveLocal, p0 = S.store.push;
    S.store.saveLocal = function () { window.__say.save++; return s0.apply(this, arguments); }; S.store.push = function () { window.__say.push++; return p0.apply(this, arguments); };
    d.querySelector('[data-newdeck]').click(); S.temaSec(TEMA); ${bas(STRIPS, PM)} await bekle(3000); await dur(1500);
    /* geçerli deste + değişmezlik + belirlenimcilik */
    var once = JSON.stringify(D()), sv = window.__say.save, yr = localStorage.getItem(S.store.k('d.' + D().id));
    var g1 = JSON.stringify(QA.qa(D(), 'deste')), g2 = JSON.stringify(QA.qa(D(), 'deste')), g3 = JSON.stringify(QA.qa(D(), 'deste'));
    R.gecerli = JSON.parse(g1); R.belirli = g1 === g2 && g2 === g3; R.degismedi = once === JSON.stringify(D()) && yr === localStorage.getItem(S.store.k('d.' + D().id)); R.snapHazir = QA.snapHazir(D());
    var ck = kopya(), ck0 = JSON.stringify(ck); QA.qa(ck, 'deste'); QA.qa(ck, 'yapi'); QA.ozet(ck); R.kopyaDegismedi = ck0 === JSON.stringify(ck);
    var say0 = JSON.stringify(window.__say); QA.taze(D()); QA.ozet(D()); await bekle(2500); R.kayitYok = say0 === JSON.stringify(window.__say);      /* boşta denetim kaydettirmez */
    R.rozetGecerli = rozet();
    /* yapı fikstürleri (kopya: geometri atlanır) */
    var F = {}, fx = function (ad, fn) { var c = kopya(); fn(c); var r = QA.qa(c, 'deste'); F[ad] = { status: r.status, kod: kodlar(r), geo: r.olcum.geometri, tam: r.issues.map(function (z) { return z.code + '|' + z.slide + '|' + z.element; }) }; };
    fx('kopya', function () {});
    fx('bos', function (c) { c.slides = []; });
    fx('baslikYok', function (c) { icerik(c).els = []; });
    fx('yerTutucu', function (c) { var h = icerik(c).els.filter(function (e) { return e.type === 'h'; })[0]; h.text = 'başlık'; h.muted = true; });
    fx('grafik', function (c) { icerik(c).els.push({ id: 'qa-g', type: 'chart', x: 520, y: 300, w: 300, h: 180, chart: { type: 'bar', values: [] } }); });
    fx('tablo', function (c) { icerik(c).els.push({ id: 'qa-t', type: 'table', x: 520, y: 300, w: 300, h: 180, table: { headers: [], rows: [] } }); });
    fx('kunye', function (c) { icerik(c).els.push({ id: 'qa-i', type: 'img', x: 600, y: 300, w: 200, h: 150, src: 'https://upload.wikimedia.org/qa.jpg' }); });
    fx('kunyeVar', function (c) { var s = icerik(c); s.els.push({ id: 'qa-i', type: 'img', x: 600, y: 300, w: 200, h: 150, src: 'https://upload.wikimedia.org/qa.jpg', creditId: 'qa-k' }, { id: 'qa-k', type: 't', x: 600, y: 452, w: 200, h: 16, text: 'Foto: QA · CC BY', size: 10 }); });
    fx('yukleme', function (c) { icerik(c).els.push({ id: 'qa-i', type: 'img', x: 600, y: 300, w: 200, h: 150, src: 'data:image/png;base64,iVBORw0KGgo=' }); });
    fx('kimlik', function (c) { var s = icerik(c); s.els[1].id = s.els[0].id; });
    fx('asetatKimlik', function (c) { c.slides[2].id = c.slides[1].id; });
    fx('duzen', function (c) { icerik(c).lay = 'yok-boyle'; });
    fx('serbest', function (c) { delete icerik(c).lay; });
    fx('olcu', function (c) { icerik(c).els[0].w = null; });
    fx('adres', function (c) { icerik(c).els.push({ id: 'qa-i', type: 'img', x: 600, y: 300, w: 200, h: 150, src: 'javascript:alert(1)' }); });
    fx('cerceve', function (c) { icerik(c).els.push({ id: 'qa-i', type: 'img', x: 600, y: 300, w: 200, h: 150, src: '' }); });
    fx('ikiFoto', function (c) { c.slides[1].els.push({ id: 'qa-a', type: 'img', x: 600, y: 300, w: 200, h: 150, src: 'data:image/png;base64,QUFB' }); c.slides[2].els.push({ id: 'qa-b', type: 'img', x: 600, y: 300, w: 200, h: 150, src: 'data:image/png;base64,QUFB' }); });
    fx('iskelet', function (c) { c.yol.k = 'skeleton'; c.yol.yedek = 1; c.slides.forEach(function (s, i) { if (i && i < c.slides.length - 1) s.els.forEach(function (e) { if (e.type === 'ul' || e.type === 't') { e.text = 'ana fikri yaz'; e.muted = true; } }); }); });
    fx('yedek', function (c) { c.yol.yedek = 1; });
    fx('kaynakca', function (c) { c.yol.kaynak = 3; });
    fx('kaynakcaVar', function (c) { c.yol.kaynak = 3; c.slides.splice(c.slides.length - 1, 0, { id: 'qa-r', lay: 'refs', bg: 'clear', els: [{ id: 'qa-rh', type: 'h', x: 70, y: 46, w: 820, h: 74, text: 'Kaynaklar', size: 42 }, { id: 'qa-ru', type: 'ul', x: 70, y: 150, w: 820, h: 300, text: 'Kaynak 1', size: 18 }] }); c.yol.uret.push('qa-r'); });
    fx('goruntu', function (c) { c.share = 'qa-token'; c.snapBekle = 1; });
    fx('elle', function (c) { c.slides.splice(2, 0, { id: 'qa-elle', bg: 'clear', els: [{ id: 'qa-eh', type: 'h', x: 70, y: 46, w: 820, h: 74, text: 'başlık', muted: true, size: 42 }] }); });
    fx('elleDuzenli', function (c) { c.slides.splice(2, 0, { id: 'qa-elle', lay: 'list', bg: 'clear', els: [{ id: 'qa-eh', type: 'h', x: 70, y: 46, w: 820, h: 74, text: 'Başlık', muted: true, size: 42 }, { id: 'qa-eu', type: 'ul', x: 70, y: 150, w: 820, h: 300, text: 'ana fikri yaz', muted: true, size: 22 }] }); });
    fx('yolsuz', function (c) { delete c.yol; var h = icerik(c).els.filter(function (e) { return e.type === 'h'; })[0]; h.muted = true; });
    R.F = F;
    /* geometri: canlı destede (doğrulanmış yazı), değiştir → ölç → geri al; arada zamanlayıcı yok */
    var G = {}, gx = function (ad, fn) { var s = icerik(D()), yedek = JSON.stringify(s.els); fn(s); var r = QA.qa(D(), 'deste'); G[ad] = { status: r.status, kod: kodlar(r), geo: r.olcum.geometri }; s.els = JSON.parse(yedek); };
    gx('disari', function (s) { var e = yazi(s); e.x = 900; });
    gx('ust', function (s) { var t = s.els.filter(function (e) { return (e.type === 't' || e.type === 'ul' || e.type === 'h') && e.text && !e.muted; }); var b = t[t.length - 1]; s.els.push({ id: 'qa-ust', type: 't', x: b.x, y: b.y, w: b.w, h: b.h, text: 'çakışan kutu', size: 18 }); });
    gx('tasma', function (s) { var e = yazi(s); e.size = QA.FMIN[e.type]; e.text = new Array(40).join(e.text + ' ') ; });
    gx('halka', function (s) { var h = s.els.filter(function (e) { return e.type === 'h'; })[0]; s.els = [h, { id: 'qa-ring', type: 'chart', x: 400, y: 182, w: 150, h: 150, chart: { type: 'ring', labels: ['oran'], data: [42] } }, { id: 'qa-rv', type: 'h', x: 400, y: 232, w: 150, h: 50, text: '%42', size: 32, align: 'center' }]; });
    gx('halkaDisi', function (s) { var h = s.els.filter(function (e) { return e.type === 'h'; })[0]; s.els = [h, { id: 'qa-ring', type: 'chart', x: 400, y: 182, w: 150, h: 150, chart: { type: 'bar', labels: ['a'], data: [42] } }, { id: 'qa-rv', type: 'h', x: 400, y: 232, w: 150, h: 50, text: '%42', size: 32 }]; });
    gx('turkce', function (s) { var e = yazi(s); e.text = 'Işığın ğüşıİçö ÇĞÜŞÖİ çağrışımı'; });
    R.G = G; R.sonra = JSON.stringify(QA.qa(D(), 'deste')) === g1; R.degismedi2 = once === JSON.stringify(D());
    /* dışa aktarma: ulaşılamayan fotoğraf, çizilemeyen diyagram, boş grafik, boş tablo; iki kez; sonra istisna */
    var X = {}, s2 = icerik(D()), yedek2 = JSON.stringify(s2.els);
    s2.els.push({ id: 'qa-xi', type: 'img', x: 700, y: 380, w: 160, h: 100, src: 'https://unreachable.invalid/qa.jpg', creditId: 'qa-xk' }, { id: 'qa-xk', type: 't', x: 700, y: 482, w: 160, h: 14, text: 'Foto: QA', size: 10 },
      { id: 'qa-xm', type: 'mmd', x: 40, y: 470, w: 120, h: 60, svg: '', code: '' }, { id: 'qa-xc', type: 'chart', x: 520, y: 470, w: 80, h: 60, chart: { type: 'bar', values: [] } }, { id: 'qa-xt', type: 'table', x: 620, y: 470, w: 60, h: 60, table: { headers: [], rows: [] } });
    window.__toast = []; PPTX.length = 0; await QA.exportPptx(); X.bir = kodlar(QA.taze(D())); X.pptx1 = JSON.stringify(PPTX); X.toast1 = window.__toast.slice();
    window.__toast = []; PPTX.length = 0; await QA.exportPptx(); X.iki = kodlar(QA.taze(D())); X.pptx2 = JSON.stringify(PPTX); X.toast2 = window.__toast.slice();
    window.PptxGenJS = function () { throw new Error('test: pptx bozuk'); }; window.__toast = []; await QA.exportPptx(); X.hata = kodlar(QA.taze(D())); X.toast3 = window.__toast.slice(); window.PptxGenJS = sahtePptx;
    d.querySelector('[data-pdf]').click(); await bekle(300); window.dispatchEvent(new Event('afterprint')); X.pdf = kodlar(QA.taze(D()));
    s2.els = JSON.parse(yedek2); X.geriAlindi = kodlar(QA.qa(D(), 'deste')); X.rozet = rozet(); R.X = X;
    /* T6: yönetmen yedeği sonrası plotMeta (F1: puan kaynakKalite'de, quality yok) */
    window.__body = []; d.querySelector('[data-newdeck]').click(); S.temaSec(TEMA);
    ${bas(T6S, { title: 'T6', sub: 't', lang: 'tr', source: 'topic', sourceId: null, yol: { k: 'director', yedek: 1 }, sources: [], istek: 12, quality: null, kaynakKalite: { score: 100, issues: [], pass: true } })}
    await bekle(3000); await dur(1500);
    var t6 = QA.qa(D(), 'deste'); R.T6 = { kod: kodlar(t6), status: t6.status, yol: D().yol, body: window.__body[0] || null, etkin: QA.etkin({ score: 100, pass: true }, t6), kalite: D().quality, n: D().slides.length, rozet: rozet() };
    /* sığdırmanın en küçük boyuta indirdiği yoğun asetat (FONT_AT_MIN; taşıyorsa TEXT_OVERFLOW da) */
    d.querySelector('[data-newdeck]').click(); S.temaSec(TEMA); ${bas(YOGUN, PM)} await bekle(3000); await dur(1500);
    var ry = QA.qa(D(), 'deste'); R.yogun = { kod: kodlar(ry), geo: ry.olcum.geometri, boy: D().slides.map(function (s) { return s.els.filter(function (e) { return (e.type === 'ul' || e.type === 't') && !e.muted; }).map(function (e) { return e.type + ':' + e.size; }); }) };
    R.etkin = { uyari: QA.etkin({ score: 100, pass: true }, { status: 'warn' }), bilgi: QA.etkin({ score: 80 }, { status: 'pass' }), yok: QA.etkin({ score: 64 }, null), dusuk: QA.etkin({ score: 40, pass: false }, { status: 'error' }), puansiz: QA.etkin(null, { status: 'error' }) };
    R.rapor = QA.rapor({ quality: { score: 84, issues: ['weak_speaker_notes'], pass: true, v: 11 }, yol: D().yol }, QA.ozet(D()));
    R.hata = window.__hata; R.inv = window.__inv;
  `;
  /* 3) Süre: sanal saat (--virtual-time-budget) eşzamanlı kodda ilerlemez, ölçüm 0 çıkar. Bu koşu GERÇEK saatle,
     DevTools protokolüyle sürülür (ACADEX-QA-TRANSFER impl-prod-harness'in yavaş kipiyle aynı yöntem); yavas = CPU kısma oranı. */
  const SURE = ONCU({ version: 11, quality: { score: 84, issues: [], pass: true } }) + `
    d.querySelector('[data-newdeck]').click(); S.temaSec(TEMA); ${bas(YIRMI, PM)} await bekle(3000); await dur(1500);
    var ms = [], r20 = null; for (var k = 0; k < 7; k++) { r20 = QA.qa(S.deck(), 'deste'); ms.push(QA.sure()); }
    R.sure = { n: S.deck().slides.length, ms: ms, geo: r20.olcum.geometri, kod: kodlar(r20) }; R.hata = window.__hata;
  `;
  const kosGercek = async (dosya, prof, icerik, yavas) => {
    fs.writeFileSync(path.join(W, dosya), icerik);
    /* port Chrome'a seçtirilir (0 → DevToolsActivePort): sabit/rastgele port başka bir Chrome'a bağlanabilirdi */
    const bekle = (ms) => new Promise((r) => setTimeout(r, ms)), prd = path.join(W, 'prof-' + prof), dosyaP = path.join(prd, 'DevToolsActivePort');
    try { fs.rmSync(dosyaP, { force: true }); } catch (e) { /* yok */ }
    let ws = null; const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + prd, '--allow-file-access-from-files', '--remote-debugging-port=0', 'about:blank'], { stdio: 'ignore' });
    try {
      let tgt = null, port = 0;
      for (let k = 0; k < 150 && !tgt; k++) { await bekle(100); try { port = port || +fs.readFileSync(dosyaP, 'utf8').split('\n')[0]; if (port) tgt = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()).find((x) => x.type === 'page'); } catch (e) { /* Chrome açılıyor */ } }
      if (!tgt) throw new Error('CDP hedefi yok');
      ws = new WebSocket(tgt.webSocketDebuggerUrl); let id = 0; const bek = {};
      const gonder = (method, params) => new Promise((r) => { const i = ++id; bek[i] = r; ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
      ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && bek[m.id]) { bek[m.id](m.result || m); delete bek[m.id]; } };
      await new Promise((r) => { ws.onopen = r; });
      if (yavas) await gonder('Emulation.setCPUThrottlingRate', { rate: yavas });
      await gonder('Page.navigate', { url: pathToFileURL(path.join(W, dosya)).href });
      let txt = '';
      for (let k = 0; k < 240 && !txt; k++) {      /* en çok 60 sn */ await bekle(250); const r = await gonder('Runtime.evaluate', { expression: 'document.getElementById("diag") ? document.getElementById("diag").textContent : ""', returnByValue: true }); txt = r.result && r.result.value; }
      await Promise.race([gonder('Browser.close'), bekle(2000)]);
      if (!txt) throw new Error(dosya + ': diag yok'); return JSON.parse(txt);
    } finally {      /* Chrome kapanmadan çıkılmaz: SIGTERM her zaman yetmiyor (kalan süreç sonraki koşuları kilitliyordu) */
      try { if (ws) ws.close(); } catch (e) { /* kapalı */ }
      const bitti = new Promise((r) => { if (ch.exitCode !== null || ch.signalCode) r(); else ch.once('exit', r); });
      ch.kill(); if (await Promise.race([bitti.then(() => 1), bekle(3000).then(() => 0)]) === 0) { ch.kill('SIGKILL'); await Promise.race([bitti, bekle(2000)]); }
    }
  };
  const senKos = async (ad) => {
    const H = yeniSunucu({ senkron: true }); await new Promise((r) => H.srv.listen(0, '127.0.0.1', r));
    try { return await kosUzun('qa-' + ad + '.html', 'qa-' + ad, qaSayfa(H.srv.address().port, SEN)); } finally { H.srv.close(); }
  };

  const A = {};
  for (const [ad, kapali] of [['acik', 0], ['kapali', 1], ['acik2', 0]]) A[ad] = await anaKos(ad, kapali);
  const SN = await senKos('sen'), SN2 = await senKos('sen2');
  const SR = {};
  for (const y of [0, 4]) { const H = yeniSunucu({ senkron: true }); await new Promise((r) => H.srv.listen(0, '127.0.0.1', r)); try { SR[y] = await kosGercek('qa-sure' + y + '.html', 'qa-sure' + y, qaSayfa(H.srv.address().port, SURE), y); } finally { H.srv.close(); } }
  temizle();
  if (process.env.QA_DOKUM) fs.writeFileSync(process.env.QA_DOKUM, JSON.stringify({ A, SN, SN2, SR }));      /* rapor için ham sonuçlar (isteğe bağlı) */

  const esit = (a, b, ad) => { if (a === b) return; let i = 0; while (i < a.length && a[i] === b[i]) i++; assert.fail(ad + ' farklı @' + i + ': …' + String(a).slice(Math.max(0, i - 80), i + 80) + '… ≠ …' + String(b).slice(Math.max(0, i - 80), i + 80) + '…'); };
  const kod = (r) => (r.kod || r).map((x) => x.replace(/@.*$/, ''));

  test('T8 Denetim açık ↔ kapalı: asetat JSON, küçük resim HTML, hesap satırları, görüntü, PPTX çağrıları, yerel kopya, kayıt/push/yazma sayıları, bildirimler, sunucu çağrıları, konsol AYNI; fark yalnız quality_report teknik/icerik + etkin puan + rozet', () => {
    const K = A.kapali; assert.ok(K.slaytlar.length > 1000 && K.html.length > 1000 && K.satirlar.length > 500 && K.pptx.length > 500, 'temel koşu boş');
    assert.ok(K.goruntu !== 'null', 'paylaşım görüntüsü yok'); assert.ok(K.say.save > 0 && K.say.push > 0); assert.equal(K.print, 1, 'PDF yazdırma çağrılmadı');
    ['acik', 'acik2'].forEach((ad) => { const R = A[ad];
      assert.deepEqual(R.hata, [], ad + ' konsol hatası'); ['slaytlar', 'html', 'satirlar', 'goruntu', 'pptx', 'yerel'].forEach((k) => esit(R[k], K[k], ad + ': ' + k));
      assert.deepEqual(R.say, K.say, ad + ': kayıt/push'); assert.equal(R.yazma, K.yazma, ad + ': hesaba yazma'); assert.deepEqual(R.toast, K.toast, ad + ': bildirimler'); assert.deepEqual(R.inv, K.inv, ad + ': sunucu çağrıları');
      assert.deepEqual(R.kalite, K.kalite, ad + ': deck.quality (içerik puanı) değişmemeli');
      assert.deepEqual(Object.assign({}, R.yol, { uret: R.yol.uret.length }), Object.assign({}, K.yol, { uret: K.yol.uret.length }), ad + ': üretim yolu'); assert.deepEqual(R.body, K.body, ad + ': critique gövdesi');
      const a = Object.assign({}, R.satir, { quality_report: undefined, quality_score: undefined, shared_at: !!R.satir.shared_at }), b = Object.assign({}, K.satir, { quality_report: undefined, quality_score: undefined, shared_at: !!K.satir.shared_at });      /* shared_at: saat */
      assert.deepEqual(a, b, ad + ': presentations satırının öteki sütunları'); });
    assert.deepEqual(A.kapali.hata, []);
  });

  test('T9 Kalıcı rapor (D1): içerik raporu korunur, icerik ayrı, teknik yalnız {v,status,errors,warnings,codes}, yol kodları; geçerli destede etkin puan = içerik puanı', () => {
    const q = A.acik.satir.quality_report, s = A.acik.satir.quality_score;
    assert.deepEqual(Object.keys(q.teknik).sort(), ['codes', 'errors', 'status', 'v', 'warnings']);
    assert.equal(q.teknik.v, 1); assert.equal(q.teknik.errors, 0); assert.notEqual(q.teknik.status, 'error');
    assert.deepEqual(q.icerik, { score: 84, pass: true, issues: ['weak_speaker_notes'] }); assert.equal(q.score, 84); assert.equal(s, 84); assert.deepEqual(q.issues, ['weak_speaker_notes']); assert.equal(q.pass, true);
    assert.deepEqual(Object.keys(q.yol).sort(), ['istek', 'k', 'kaynak', 'uret', 'yedek']); assert.equal(q.yol.k, 'research'); assert.equal(q.yol.istek, 7); assert.equal(q.yol.uret.length, A.acik.yol.uret.length);
    assert.ok(!/https?:|Şehir|şehir/.test(JSON.stringify(q.teknik) + JSON.stringify(q.yol)), 'teknik özette kullanıcı metni/URL');
    const k = A.kapali.satir.quality_report; assert.deepEqual(k.teknik, { v: 1, status: 'pass', errors: 0, warnings: 0, codes: [] }); assert.equal(A.kapali.satir.quality_score, 84);
    assert.equal(A.acik.rozet.kalite, 'kalite 84/100');
  });

  test('T10 Çapraz cihaz ve yerel kopya: içerik puanı (etkin değil) ve üretim yolu geri gelir; yeniden ölçüm yok; yapı kodları kaynak cihazla aynı; açılış hesaba yazmaz', () => {
    ['B', 'A2'].forEach((c) => { const R = A.acik[c];
      assert.deepEqual(R.hata, [], c + ' konsol'); assert.equal(R.kalite.score, 84, c + ': içerik puanı'); assert.ok(!R.kalite.icerik && !R.kalite.teknik, c + ': rapor iç içe geçti');
      assert.deepEqual(R.yol, A.acik.yol, c + ': üretim yolu'); assert.ok(!R.inv.some((x) => /critique/.test(x)), c + ': gereksiz yeniden puanlama');
      assert.ok(R.teknik, c + ': açılışta denetim yok'); assert.deepEqual(kod(R.teknik.issues.map((z) => z.code)), A.acik.teknik.issues.map((z) => z.code), c + ': kodlar');
      assert.deepEqual(R.rozet, A.acik.rozet, c + ': rozet'); });
    assert.equal(A.acik.yazmaSonra, A.acik.yazma, 'açılış hesaba yazdı');
  });

  test('T11 Geçerli deste: 0 sorun, geometri doğrulanmış yazıyla ölçüldü, desteyi ve yerel kopyayı değiştirmez, 3 koşu bayt bayt aynı (iki ayrı sayfa da aynı)', () => {
    [SN, SN2].forEach((R, i) => {
      assert.deepEqual(R.hata, [], 'konsol ' + i); assert.equal(R.snapHazir, true); assert.equal(R.gecerli.olcum.geometri, 'tamam'); assert.equal(R.gecerli.olcum.yazi, 'sablon');
      assert.deepEqual(R.gecerli.issues, [], JSON.stringify(R.gecerli.issues)); assert.equal(R.gecerli.status, 'pass'); assert.deepEqual(R.gecerli.summary.skipped, []);
      assert.equal(R.belirli, true); assert.equal(R.degismedi, true); assert.equal(R.kopyaDegismedi, true, 'denetim desteyi değiştirdi'); assert.equal(R.kayitYok, true, 'denetim kayıt/push tetikledi'); assert.equal(R.degismedi2, true); assert.equal(R.sonra, true, 'geri alınca sonuç eskisine dönmedi');
      assert.deepEqual(R.rozetGecerli.teknik, null, 'geçerli destede rozet görünüyor'); });
    const yalin = (F) => JSON.parse(JSON.stringify(F, (k, v) => (k === 'tam' ? undefined : v)));      /* tam: rastgele öğe kimlikleri */
    assert.deepEqual(SN.gecerli, SN2.gecerli); assert.deepEqual(yalin(SN.F), yalin(SN2.F)); assert.deepEqual(SN.G, SN2.G); assert.deepEqual(SN.X, SN2.X);
  });

  test('T12 Yapı fikstürleri: her kod kendi fikstüründe, doğru önemde; istisnalar (serbest düzen, yüklenen görsel, künye, kaynakça, elle eklenen, elle kurulan) hata değil', () => {
    const F = SN.F, has = (ad, k) => assert.ok(F[ad].kod.some((x) => x.startsWith(k)), ad + ' → ' + k + ' yok: ' + JSON.stringify(F[ad]));
    assert.deepEqual(F.kopya.kod, []); assert.equal(F.kopya.geo, 'skipped', 'açık olmayan deste geometrisi ölçüldü');
    assert.deepEqual(F.bos.kod, ['DECK_EMPTY@null!']);
    has('baslikYok', 'SLIDE_EMPTY@2!'); has('yerTutucu', 'PLACEHOLDER_LEFT@2'); assert.ok(F.yerTutucu.kod.includes(F.yerTutucu.kod.find((x) => x.startsWith('PLACEHOLDER_LEFT')).replace(/.$/, '!')));
    has('grafik', 'CHART_EMPTY@2!'); has('tablo', 'TABLE_EMPTY@2!'); has('kunye', 'CREDIT_MISSING@2!'); has('kimlik', 'EL_ID_DUP@2!'); has('asetatKimlik', 'SLIDE_ID_DUP@3!');
    has('duzen', 'LAYOUT_INVALID@2!'); has('olcu', 'EL_GEOMETRY_INVALID@2!'); has('adres', 'IMG_SRC_INVALID@2!'); has('cerceve', 'IMG_NO_SRC@2?'); has('ikiFoto', 'IMG_DUPLICATE@3?');
    has('iskelet', 'DECK_SKELETON@null!'); has('iskelet', 'FALLBACK_PATH@null?'); assert.equal(F.iskelet.status, 'error');
    assert.deepEqual(F.yedek.kod, ['FALLBACK_PATH@null?']); assert.equal(F.yedek.status, 'warn');
    assert.deepEqual(F.kaynakca.kod, ['REFS_MISSING@null?']); assert.deepEqual(F.kaynakcaVar.kod, []);
    assert.deepEqual(F.goruntu.kod, ['SNAPSHOT_PENDING@null.']); assert.equal(F.goruntu.status, 'pass', 'bilgi durumu değiştirdi');
    assert.deepEqual(F.serbest.kod, []); assert.deepEqual(F.yukleme.kod, []); assert.deepEqual(F.kunyeVar.kod, []);
    assert.deepEqual(F.elle.kod, ['PLACEHOLDER_LEFT@3?', 'SLIDE_EMPTY@3?'], 'elle eklenen boş asetat hata sayıldı'); assert.ok(F.elleDuzenli.kod.every((x) => /\?$/.test(x)), JSON.stringify(F.elleDuzenli));
    assert.ok(F.yolsuz.kod.length && F.yolsuz.kod.every((x) => /\?$/.test(x)), 'elle kurulan destede yer tutucu hata sayıldı');
    /* sıra: asetat → kod → öğe; tekrarsız */
    Object.keys(F).forEach((ad) => { const k = F[ad].tam; assert.equal(new Set(k).size, k.length, ad + ' tekrar'); });
  });

  test('T13 Geometri doğrulanmış şablon yazısıyla: kutu dışı (hata), çakışma (uyarı), taşma (hata), en küçük boyut (uyarı); Türkçe harfler sahte taşma üretmez; halka + ortadaki sayı istisnası dar', () => {
    const G = SN.G; Object.keys(G).forEach((k) => assert.equal(G[k].geo, 'tamam', k));
    assert.ok(G.disari.kod.some((x) => /^EL_OUT_OF_BOUNDS@2!$/.test(x)), JSON.stringify(G.disari));
    assert.ok(G.ust.kod.includes('EL_OVERLAP@2?') && G.ust.status === 'warn', JSON.stringify(G.ust));
    assert.ok(G.tasma.kod.includes('TEXT_OVERFLOW@2!'), JSON.stringify(G.tasma));
    assert.deepEqual(G.turkce.kod, [], JSON.stringify(G.turkce));
    assert.deepEqual(G.halka.kod, [], 'halka grafiğin ortasındaki sayı (stat:5) çakışma sayıldı: ' + JSON.stringify(G.halka));
    /* FN3 (#30): sığdırma en küçük boyutta durup taşmayı bıraktığında artık söylenir — uyarı (boyut) + hata (taşma) */
    assert.deepEqual(SN.yogun.kod, ['FONT_AT_MIN@2?', 'TEXT_OVERFLOW@2!'], JSON.stringify(SN.yogun)); assert.equal(SN.yogun.geo, 'tamam');
    assert.ok(SN.yogun.boy[1].includes('ul:13'), 'liste en küçük boyuta inmedi: ' + JSON.stringify(SN.yogun.boy)); assert.deepEqual(SN2.yogun, SN.yogun);
    assert.deepEqual(G.halkaDisi.kod, ['EL_OVERLAP@2?'], 'istisna halka dışına genişledi: ' + JSON.stringify(G.halkaDisi));
  });

  test('T14 Dışa aktarma: ulaşılamayan fotoğraf, çizilemeyen diyagram, boş grafik/tablo kaydedilir; ikinci aktarım aynı (eklenmez); istisna öncekinin yerine; PDF; dosya ve bildirim aynı; geri alınınca temiz', () => {
    const X = SN.X;
    ['EXPORT_IMG_DROPPED@2!', 'EXPORT_DRAWING_DROPPED@2?', 'EXPORT_CHART_SKIPPED@2!', 'EXPORT_TABLE_SKIPPED@2!', 'CHART_EMPTY@2!', 'TABLE_EMPTY@2!'].forEach((k) => assert.ok(X.bir.includes(k), k + ' yok: ' + JSON.stringify(X.bir)));
    const pp = (t) => t.filter((x) => /PowerPoint/.test(x)).slice(-1);      /* gözlemci önceki bildirimi de yakalayabilir: sonuncusu */
    assert.deepEqual(X.iki, X.bir, 'yeniden aktarım sonucu değişti'); assert.equal(X.pptx2, X.pptx1, 'aktarım çıktısı değişti'); assert.deepEqual(pp(X.toast2), pp(X.toast1));
    assert.deepEqual(pp(X.toast1), ['PowerPoint dosyası indirildi. 1 çizim aktarılamadı; PDF çıktısında görünür. 1 fotoğraf açılamadığı için dosyaya konmadı (bağlantısı artık çalışmıyor).']);
    assert.ok(X.hata.includes('EXPORT_FAILED@null!') && !X.hata.some((x) => /^EXPORT_(IMG|DRAWING|CHART|TABLE)/.test(x)), JSON.stringify(X.hata));
    assert.deepEqual(pp(X.toast3), ['PowerPoint dosyası hazırlanamadı: test: pptx bozuk. PDF indirmeyi deneyebilirsin.']);
    assert.deepEqual(X.pdf, X.hata, 'PDF sayfa sayısı tutarken sorun eklendi');
    assert.deepEqual(X.geriAlindi, [], 'içerik değişince eski aktarım kaydı yeni desteye yapıştı');
  });

  test('T15 T6 tarayıcıda: yönetmen yedeğinden gelen deste ölçülür (critique), istek 12 sınırlı gider, teknik hata → etkin ≤ 59; D1 tablosu; kalıcı rapor biçimi', () => {
    const T = SN.T6;
    assert.ok(T.body, 'critique çağrılmadı (F1)'); assert.equal(T.body.action, 'critique');
    assert.equal(T.yol.k, 'director'); assert.equal(T.yol.yedek, 1); assert.equal(T.yol.istek, 12);
    assert.equal(T.body.slideCount, istemciSayi(12, T.body.presentation.slides.filter((x) => !/^refs:/.test(x.content.look) && x.content.look !== 'list:10').length, T.body.presentation.slides));
    const q = critique(T.body); assert.ok(q.score <= 59 && q.pass === false, 'gerçek critique: ' + JSON.stringify(q));
    assert.equal(T.status, 'error', JSON.stringify(T.kod)); assert.ok(T.kod.includes('FALLBACK_PATH@null?'));
    assert.deepEqual(T.etkin, { score: 59, pass: false }, 'ölçümsüz 100 bile tavanı aşmamalı');
    assert.ok(/^teknik hata \(\d+\)$/.test(T.rozet.teknik), JSON.stringify(T.rozet)); assert.ok(/Teknik denetim/.test(T.rozet.baslik));
    const E = SN.etkin; assert.deepEqual(E.uyari, { score: 100, pass: true }); assert.deepEqual(E.bilgi, { score: 80, pass: true }); assert.deepEqual(E.yok, { score: 64, pass: false });
    assert.deepEqual(E.dusuk, { score: 40, pass: false }); assert.equal(E.puansiz, null);
    const P = SN.rapor; assert.equal(P.v, 11); assert.deepEqual(P.icerik, { score: 84, pass: true, issues: ['weak_speaker_notes'] }); assert.equal(P.score, 59); assert.equal(P.pass, false); assert.equal(P.teknik.status, 'error');
  });

  test('T16 Süre (gerçek saat): ≥ 20 asetat, geometri dahil, en kötü ≤ 150 ms; CPU ×4 yalnız raporlanır; sonuç 0 sorun', () => {
    [0, 4].forEach((y) => { const R = SR[y], m = R.sure.ms.slice().sort((a, b) => a - b), med = m[Math.floor(m.length / 2)];
      console.log('        süre (' + R.sure.n + ' asetat, CPU ×' + (y || 1) + ', ms): ' + R.sure.ms.map((x) => x.toFixed(1)).join(' ') + ' · medyan ' + med.toFixed(1) + ' · en kötü ' + m[m.length - 1].toFixed(1));
      assert.deepEqual(R.hata, []); assert.ok(R.sure.n >= 20, 'asetat ' + R.sure.n); assert.equal(R.sure.geo, 'tamam'); assert.deepEqual(R.sure.kod, [], JSON.stringify(R.sure.kod)); assert.ok(m[0] > 0, 'süre ölçülmedi (sanal saat?)');
      if (!y) assert.ok(m[m.length - 1] <= 150, 'en kötü ' + m[m.length - 1]); });
  });
  summary();
})().catch((e) => { console.error(e); process.exitCode = 1; });
