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

test('KONSOL SÜZGECİ + CTRL+ENTER (10.11.2026)', () => {
  /* Sandbox geliştirme #3. 60+ kayıtlı konsolda hatayı bulmak zordu. */
  // (a) Süzgeç çipleri başlıkta, temizle sağda duruyor.
  assert.ok(html.includes('data-cfil="error"') && html.includes('data-cfil="warn"') && html.includes('data-cfil="log"'),
    'konsol tür süzgeci çipleri yok');
  assert.ok(html.includes('data-cclear=""'), 'temizle düğmesi kaybolmuş');
  // (b) sys satırları HER süzgeçte kalır: koşu sınırları olmadan hangi hata
  //     hangi koşunun bilinemez. İndeks i korunur: data-aierr konsolun tam
  //     dizisine işaret eder, süzgeç kaydırırsa YANLIŞ hata sorulur.
  assert.ok(ink.includes("if (consFiltre && c.t !== consFiltre && c.t !== 'sys') return '';"),
    'süzgeç sys satırlarını da gizliyor ya da yok');
  assert.ok(ink.includes('consEl.innerHTML = cons.map(function (c, i) {'),
    'süzgeç map indeksini bozmuş — Acadia düğmesi yanlış hataya işaret eder');
  // (c) Ctrl+Enter çalıştırır ve ipucu çubuğunda yazar.
  assert.ok(ink.includes("e.key === 'Enter') { e.preventDefault(); Q('[data-run]').click(); return; }"),
    'Ctrl+Enter kısayolu yok');
  assert.ok(html.includes('Ctrl+Enter çalıştır'), 'ipucu çubuğu kısayolu söylemiyor');
  // (d) Python hata satırı @dosya:satır biçiminde loglanıyor — "satıra git"
  //     doğru dosyayı açar (zaten vardı; bu test geri gitmesin diye).
  assert.ok(ink.includes("log('error', tail + (last ? ' @' + file + ':' + last : ''))"),
    'Python hatası dosya:satır eki taşımıyor');
});

test('PYTHON GRAFİK ÇIKTISI + PAKET HABERİ (10.11.2026)', () => {
  /* Sandbox geliştirme #4. loadPackagesFromImports zaten vardı (numpy/pandas
     çalışıyordu) ama paket inerken konsol sessizdi ve matplotlib figürü
     hiçbir yere çizilmiyordu. */
  // (a) Koşudan ÖNCE AGG arka ucu: matplotlib-pyodide'ın DOM arka ucuna
  //     düşerse figür ana sayfaya sızar; AGG ile belleğe çizilir.
  assert.ok(ink.includes('matplotlib\\nmatplotlib.use("AGG")'), 'AGG arka ucu seçilmiyor');
  // (b) Kuyruk yalnız matplotlib içe aktarıldıysa çalışır, figürleri base64
  //     toplar ve kapatır (ikinci koşuda birikme olmasın).
  assert.ok(ink.includes("'if \"matplotlib\" in sys.modules:\\n'"), 'grafik kuyruğu koşulsuz çalışıyor');
  assert.ok(ink.includes("plt.close(\"all\")"), 'figürler kapatılmıyor — ikinci koşuda birikir');
  // (c) Kuyruğun hatası öğrencinin koşusunu düşürmez; başarıda önizlemeye geçilir.
  assert.ok(ink.includes("function (e) { console.warn('grafik toplanamadı', e); }"),
    'kuyruk hatası koşuyu düşürür');
  assert.ok(ink.includes("log('sys', n + ' grafik önizlemede'); outTab('prev');"), 'grafik önizlemeye taşınmıyor');
  // (d) "önizleme yok" kaplaması grafik gelince kalkar — yoksa resim gizli kalır.
  assert.ok(ink.includes('noprev.hidden = true;\n    var pf'), 'noprev kaplaması grafiği örter');
  // (e) Paket haberi: öğrenci inen paketi görmeli, donmuş sanmamalı.
  assert.ok(ink.includes("log('sys', 'paketler hazırlanıyor: ' + pk.join(', ')"), 'paket haberi yok');
  assert.ok(ink.includes("['numpy', 'pandas', 'matplotlib', 'scipy', 'sympy', 'sklearn']"), 'bilinen paket listesi yok');
  // (f) PyProxy sızıntısı: dönüş değeri destroy edilir.
  assert.ok(ink.includes('if (v && v.destroy) { try { v.destroy(); } catch (e) {} }'), 'PyProxy destroy edilmiyor');
});

test('PYTHON PROJESİ PANELE GÖNDERİLEBİLİR: son koşudan analiz kartı (11.11.2026)', () => {
  /* Canlı bulgu (Berkay): "panele gönder deyince GitHub reposu istiyor".
     buildSingle sayfasız projede boş döner, hasSrc düşer, öğrenci bağlantıya
     zorlanırdı. Çözüm: son Python koşusunun grafikleri + çıktısı meta'ya
     yazılır (sonKosu), composer bundan snapshot üretir. */
  // (a) Koşu kaydı sınırlı: en çok 2 grafik (<140 KB) ve 30 satır (200 krk) —
  //     sandbox_workspaces.meta şişmemeli.
  assert.ok(ink.includes('var k0 = cons.length;'), 'koşu başlangıç işaretçisi yok');
  assert.ok(ink.includes("String(x.a).slice(0, 200); }).slice(0, 30)"), 'çıktı sınırı yok');
  assert.ok(ink.includes('b.length < 140000; }).slice(0, 2)'), 'grafik boyut/adet sınırı yok');
  assert.ok(ink.includes('P.sonKosu = { at: Date.now(), out: sOut, imgs: sImg }; dirty(); saveNow();'),
    'son koşu kaydedilmiyor');
  // (b) Kalıcılık: meta üzerinden gider-gelir.
  assert.ok(ink.includes("sonKosu: m.sonKosu || null"), 'fromRow sonKosu okumuyor');
  assert.ok(ink.includes("sonKosu: p.sonKosu || null"), 'toRow sonKosu yazmıyor');
  // (c) Composer: sayfa snapshot'ı yoksa analiz kartına düşer; hiç koşu yoksa
  //     boş döner ve eski davranış (bağlantı/kapak iste) değişmez.
  assert.ok(ink.includes('(buildSingle(pr.files) || pySnap(pr))'), 'fillFrom analiz kartına düşmüyor');
  assert.ok(ink.includes("if (!sk || (!(sk.imgs || []).length && !(sk.out || []).length)) return '';"),
    'boş koşuda pySnap boş dönmüyor — davranış değişir');
  // (d) Çıktı KAÇIRILARAK gömülür (öğrenci çıktısı HTML taşıyabilir).
  assert.ok(ink.includes("'<pre>' + X((sk.out || []).join('\\n')) + '</pre>'"),
    'konsol çıktısı kaçırılmadan snapshot HTML\'ine giriyor');
  // (e) EX DALI DA DÜŞER (11.11 canlı bulgusu #2): daha önce paylaşılmış ya da
  //     TASLAĞI olan proje ex dalına girer; orada yalnız buildSingle vardı —
  //     ilk hatada taslak kaydeden öğrenci kalıcı kilitleniyordu.
  assert.ok(ink.includes('ETK.buildSingle(pr.files) || ETK.pySnap(pr) || ex.snap'),
    'shareProject ex dalı analiz kartına düşmüyor');
  assert.ok(ink.includes('pySnap: pySnap'), 'pySnap dışa açılmıyor — ex dalı erişemez');
  // (f) Hata mesajı yol gösterir: sandbox projesi seçiliyken "bir kez çalıştır" der.
  assert.ok(ink.includes("cur.projId ? 'Önizleme için projeyi sandbox\\'ta bir kez çalıştır"),
    'sayfasız projede hata mesajı yol göstermiyor');
});

test('SENKRON SERTLEŞTİ + YENİ ŞABLONLAR (11.11.2026)', () => {
  /* Tam tarama bulguları. Senkron: eski wsSync ilk hatada break yapıyordu —
     tek bozuk proje, listede arkasında duran HER projenin buluta yazılmasını
     sonsuza dek kesiyordu ve hata yalnız console'a gidiyordu (sessiz kayıp). */
  assert.ok(ink.includes("ws.err = (p.name || 'proje') + ': ' + String(r.error.message || r.error.code || 'hata').slice(0, 120); continue;"),
    'senkron hatasında continue yok — baş-blokaj geri gelmiş');
  assert.ok(ink.includes('if (missing(r.error)) { feat.ws = false; break; }'),
    'şema hatasında (missing) durulmuyor — her projede boşa istek atılır');
  assert.ok(ink.includes("cloudEl.textContent = 'buluta yazılamadı — projeler bu tarayıcıda güvende'"),
    'senkron hatası öğrenciye gösterilmiyor');
  // download: her indirme bir objectURL askıda bırakıyordu.
  assert.ok(ink.includes('setTimeout(function () { URL.revokeObjectURL(u); }, 4000)'),
    'indirme URL\'i geri bırakılmıyor');
  // Otomatik önizleme ZATEN VARDI (autoRun, 450 ms) — özellik sanılıp
  // yeniden yazılmasın, kaldırılırsa da bilerek kaldırılsın.
  assert.ok(ink.includes('if (autoRun) refreshPreview(false); }, 450)'),
    'autoRun canlı önizleme kalkmış');
  // Yeni şablonlar: grafik (matplotlib yolunu sergiler) + kredi (annüite).
  // kredi.py yerelde KOŞULDU: 100.000 TL, %36, 12 ay -> taksit 10.046,21 TL.
  assert.ok(ink.includes("grafik: { l: 'Python grafik'"), 'grafik şablonu yok');
  assert.ok(ink.includes('plt.bar(aylar, gelir'), 'grafik şablonu matplotlib kullanmıyor');
  assert.ok(ink.includes("kredi: { l: 'kredi taksit tablosu'"), 'kredi şablonu yok');
  assert.ok(ink.includes('taksit = anapara * r / (1 - (1 + r) ** -vade_ay)'),
    'annüite formülü değişmiş — README ve kontrol satırıyla çelişir');
  assert.ok(ink.includes('taksit ~10.046,21 TL'), 'kontrol satırı yok — formül bozulursa fark edilmez');
  // Vitrin (11.11, Berkay'ın isteği: "örnek setlerde görünmüyor"): şablonlar
  // yalnız "yeni proje" penceresinde değil, örnek vitrininde de tek tıkla açılır.
  assert.ok(html.includes('data-tplopen="grafik"') && html.includes('data-tplopen="kredi"'),
    'vitrinde şablon kartları yok');
  assert.ok(html.includes('örnek veri setleri ve şablonlar'), 'bölüm başlığı şablonları kapsamıyor');
  assert.ok(ink.includes("tb.getAttribute('data-tplopen'), tt = DV_TPLS[tk]"),
    'vitrin kartının tek-tık işleyicisi yok');
  // Veri setlerinden sonra gelsinler: csv kartlarıyla karışmasın.
  assert.ok(html.indexOf('Müşteri kaybı (churn)') < html.indexOf('Aylık gelir-gider grafiği'),
    'şablon kartları veri setlerinin arasına girmiş');
});

summary();
