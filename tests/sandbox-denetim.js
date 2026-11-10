/* ==========================================================================
   ACADEX — GELİŞTİRİCİ SANDBOX DENETİMİ (tests/sandbox-denetim.js)

   NEDEN VAR (03.11.2026): sandbox tarayıcıda 55 adımlık bir denetimden geçti (yeni proje,
   5 şablon, düzenleme, dosya ekle / çoğalt / yeniden adlandır / sil + geri al, bul-değiştir,
   çalıştır + konsol, durak + fark, zip ve tek HTML dışa aktarma, ders / teslim, kart zip /
   sil + geri al, veri setleri, Python onayı ve Pyodide inmezse hata, dosya / zip yükleme,
   Acadia düğmeleri, teslim, yenileyince kalıcılık, telefonda taşma). Bulunan üç sorun
   düzeltildi; bu test onların geri gelmemesi için:
     1. Yeni dosyada "yeni.js" yazınca "yeni.js.js" oluyordu (yalnızca ad seçiliydi).
        Uzantısız ad yazılırsa .js eklenir.
     2. 2 MB'ı aşan bir metin dosyası "okunabilir dosya bulamadım" diyordu; artık sınırı söyler.
     3. Etkileşim panelinde canlı bağlantı Acadex'in kendi adresiyse önizlenmez
        (allow-same-origin + allow-scripts aynı kökende kum havuzunu etkisiz bırakırdı).
     Ayrıca: proje önizlemesi allow-same-origin almadan çalışır.
   Çalıştırma:  node tests/sandbox-denetim.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();
const ink = read('js/acadex-ink.js'), html = read('dashboard.html');

test('yeni dosya: uzantıyı öğrenci seçer, uzantısız ada .js eklenir', () => {
  assert.match(ink, /inp\.setSelectionRange\(0, \(p && inp\.value\.lastIndexOf\('\.'\) > 0 \? inp\.value\.lastIndexOf\('\.'\) : inp\.value\.length\)\);/);
  assert.match(ink, /renameInline\(null, function \(v\) \{ if \(!\/\\\.\[a-z0-9\]\+\$\/i\.test\(base\(v\)\)\) v \+= '\.js';/);
});

test('2 MB sınırı ayrıca söylenir', () => {
  assert.match(ink, /big\.push\(it\.path\.split\('\/'\)\.pop\(\)\)/);
  assert.match(ink, /'Dosya çok büyük: bir projede toplam 2 MB\\'a kadar kod ve metin olabilir\.'/);
});

test('önizleme kum havuzunda; canlı bağlantı Acadex\'in kendi adresi olamaz', () => {
  assert.match(html, /<iframe class="dv-frame" data-frame="" title="Proje önizlemesi" sandbox="allow-scripts allow-modals"><\/iframe>/);
  assert.doesNotMatch(html.match(/<iframe class="dv-frame"[^>]*>/)[0], /allow-same-origin/);
  assert.match(ink, /return lu\.origin === location\.origin \? '' : lu\.href;/);
});

test('TESLİM DENETİMİ: teslimden önce kod gerçekten çalıştırılır (10.11.2026)', () => {
  /* Eski teslim öz-beyandı: düğme yalnızca status='teslim' yazıyordu. Artık
     teslimden önce proje çalıştırılıp rapor çıkar; öğrenci geçti/kaldı +
     nedenini görür, rapor meta.denetim'de saklanır, rafta rozet olur. */
  // (a) Doğrudan işaretleyen eski yol KALKTI, denetim araya girdi.
  assert.ok(!ink.includes("addEventListener('click', function () { commitTyping(); var last = P.versions[P.versions.length - 1]; if (!last || changedSince(last)) commit('teslim');"),
    'eski öz-beyan teslim yolu geri gelmiş');
  assert.ok(ink.includes('teslimDenetimi().then(function (sn)'), 'teslim düğmesi denetimi beklemiyor');
  assert.ok(ink.includes("tsDlg.returnValue === 'ok' && P) teslimEt()"), 'rapor onaylanmadan teslim edilmemeli');
  // (b) Konsol kancası: denetim penceresi açıkken olaylar kayda da düşer.
  assert.ok(ink.includes('if (TSD.kayit) TSD.kayit.push('), 'log() denetim kancası taşımıyor');
  // (c) Beklenen değerler ÖLÇÜLDÜ (başlangıç çözümleri gerçek CSV'lere karşı
  //     koşturuldu, korelasyon elle doğrulandı) — değişirse bilerek değişsin.
  assert.ok(ink.includes('deger: [120, 81745, 75795, 68720, 52335]'), 'sales beklenenleri değişmiş');
  assert.ok(ink.includes('deger: [120, 15.88, 74.08, 0.968]'), 'student beklenenleri değişmiş');
  assert.ok(ink.includes('deger: [57.1, 5.3, 12.1]'), 'churn beklenenleri değişmiş');
  // (d) Tolerans: 0.968'i 0.97 yazan öğrenci geçmeli, 57 de 57.1'i karşılamalı.
  const tolSrc = ink.match(/var degerVar = function \(nums, v\) \{ (.*?) \};/);
  assert.ok(tolSrc, 'degerVar yok');
  const degerVar = new Function('nums', 'v', tolSrc[1].replace(/^var tol/, 'var tol') + '');
  assert.ok(degerVar([0.97], 0.968), '0.97 yuvarlaması 0.968 için kabul edilmiyor');
  assert.ok(degerVar([57], 57.1), '57, %57.1 için kabul edilmiyor');
  assert.ok(!degerVar([81000], 81745), '81000 yanlış değeri 81745 sayılıyor — tolerans fazla gevşek');
  // (e) İki para biçimi de okunur: 81,745.00 ve 81.745,00.
  const cekSrc = ink.match(/var sayilariCek = function \(metin\) \{([\s\S]*?)\n  \};/);
  assert.ok(cekSrc, 'sayilariCek yok');
  const sayilariCek = new Function('metin', cekSrc[1] + '\n return out;');
  assert.ok(sayilariCek('toplam 81,745.00 TL').includes(81745), 'EN biçimi okunmuyor');
  assert.ok(sayilariCek('toplam 81.745,00 TL').includes(81745), 'TR biçimi okunmuyor');
  // (f) Rapor saklanır ve rafta görünür.
  assert.ok(ink.includes("denetim: m.denetim || null"), 'fromRow denetimi okumuyor');
  assert.ok(ink.includes("denetim: p.denetim || null"), 'toRow denetimi yazmıyor');
  assert.ok(ink.includes('teslim denetiminden geçti'), 'raf rozeti yok');
  // (g) Rapor penceresi dashboard.html'de.
  assert.ok(html.includes('data-tsdlg=""'), 'teslim denetimi penceresi yok');
  assert.ok(html.includes('data-tsgo=""'), 'teslim et düğmesi yok');
  assert.ok(html.includes('data-tslist=""'), 'rapor listesi yok');
});

test('HATAYI ACADIA\'YA TAŞIMA: konsol hatası tek tıkla bağlamıyla sorulur (10.11.2026)', () => {
  /* Sandbox geliştirme #2. Konsoldaki her error satırına "Acadia'ya sor"
     eklenir; tıklayınca hata metni + ilgili dosya içeriği Acadia sekmesine
     taşınır. Dosya tahmini önce "@dosya:satır" ekinden, yoksa açık dosyadan. */
  // (a) Düğme YALNIZ hata satırında — log/warn/sys satırına eklenmez.
  assert.ok(ink.includes("var sor = c.t === 'error' ? ' <button type=\"button\" data-aierr=\"' + i + '\">Acadia’ya sor</button>' : ''"),
    'Acadia düğmesi hata satırına özgü değil ya da yok');
  assert.ok(ink.includes('consEl.innerHTML = cons.map(function (c, i) {'),
    'paintCons indeks taşımıyor — düğme hangi hatayı soracağını bilemez');
  // (b) Tıklama: dosya tahmini + kod bağlamı + aiAsk ile aynı dil kuralı.
  const blok = ink.match(/var b = e\.target\.closest\('\[data-aierr\]'\);[\s\S]{0,2200}aiErrBusy = false/);
  assert.ok(blok, 'data-aierr işleyicisi yok');
  assert.ok(blok[0].includes("P.files.hasOwnProperty(m[1]) ? m[1] : P.cur"),
    'dosya tahmini @dosya:satır ekini kullanmıyor');
  assert.ok(blok[0].includes('codeFor({ text: kod })'), 'kod bağlamı sınırsız gidiyor (codeFor yok)');
  assert.ok(blok[0].includes('aksiyon bloğu ekleme'),
    'istem aksiyon bloğunu yasaklamıyor — aiAsk kalıplarıyla tutarsız');
  assert.ok(blok[0].includes("outTab('aca')"), 'Acadia sekmesine geçmiyor');
  assert.ok(blok[0].includes('SBX.acadia(soru)'), 'Acadia çağrısı yok');
  // (c) Çifte tıklama koruması ve dürüstlük notu.
  assert.ok(ink.includes('var aiErrBusy = false;'), 'meşgul bayrağı yok');
  assert.ok(blok[0].includes('Acadia hata yapabilir'), 'dürüstlük notu yok — öbür Acadia yollarıyla tutarsız');
});

summary();
