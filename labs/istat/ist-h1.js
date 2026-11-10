/* ==========================================================================
   ACADEX İSTATİSTİK · 1–4. haftalar (labs/istat/ist-h1.js), 11.11.2026
   1 Basic Outlook 1 · 2 Basic Outlook 2 · 3 Data · 4 Graphical Representation
   ========================================================================== */
(function () {
  'use strict';
  var IST = window.IST, V = IST.V, M = IST.M, nf = IST.nf, X = IST.X, PAL = V.PAL, d = V.d;

  /* ortak: ölçekler */
  var OLC = ['Sınıflama (nominal)', 'Sıralama (ordinal)', 'Aralık (interval)', 'Oran (ratio)'];
  var OLC_K = ['nominal', 'ordinal', 'aralık', 'oran'];
  var OLC_N = [
    'Değerler yalnızca etiket/ad; aralarında sıra yok.',
    'Etiketler arasında anlamlı bir sıra var ama farklar ölçülemez.',
    'Sıra ve sabit birimli farklar anlamlı; gerçek sıfır yok, oran kurulamaz.',
    'Aralığın tüm özellikleri + gerçek sıfır; "iki katı" demek anlamlı.'
  ];
  var DEGISKEN = [
    ['Kargo paketinin ağırlığı (kg)', 3], ['Müşteri memnuniyeti: çok kötü · kötü · orta · iyi · çok iyi', 1], ['Öğrencinin fakültesi (İİBF, Tıp, Hukuk…)', 0],
    ['Öğlen hava sıcaklığı (°C)', 2], ['Araç plakasındaki il kodu (06, 34, 35)', 0], ['Maratonda bitiriş sırası (1., 2., 3.…)', 1],
    ['Aylık reklam harcaması (TL)', 3], ['Takvim yılı (2019, 2024…)', 2], ['Kredi derecelendirme notu (AAA, AA, A, BBB)', 1],
    ['Çalışanın kıdemi (yıl)', 3], ['Kan grubu (A, B, AB, 0)', 0], ['Sınıf düzeyi (1. sınıf, 2. sınıf…)', 1],
    ['Bir dükkânın günlük müşteri sayısı', 3], ['Hisse senedinin işlem gördüğü borsa (BIST, NYSE, NASDAQ)', 0]
  ];

  /* ======================= 1. HAFTA ======================= */
  IST.hafta({
    id: 'g1', no: 1, renk: '#2F6FB0', tr: 'İstatistiğe giriş I: veri ve ölçekler', en: 'Basic Outlook to Statistics 1',
    sahneler: [
      {
        b: 'Büyük veri her yerde', terim: [['büyük veri', 'big data'], ['istatistik', 'statistics']],
        t: '<p>Sigorta şirketindeki her poliçe ve hasar, havayolundaki her uçuş ve yolcu, dünyadaki on binlerce hava istasyonunun ölçümleri, gen dizilemesinden gelen bilgi… Bugün veri <b>patlıyor</b>.</p><p><b>İstatistik</b>, bu veriyi <b>toplama, düzenleme, özetleme, analiz etme ve yorumlama</b> bilimidir. Amaç: belirsizlik altında daha iyi <b>karar</b> vermek.</p>',
        v: function () {
          var src = [['🛒', 'e-ticaret'], ['✈️', 'havayolu'], ['🧬', 'genetik'], ['🌦️', 'hava istasyonu'], ['🏦', 'sigorta']], s = '';
          src.forEach(function (e, i) {
            var y = 34 + i * 58, path = "M150 " + y + " C 220 " + y + ", 230 150, 300 150";
            s += '<path d="' + path + '" fill="none" stroke="#CFC6B3" stroke-width="2" stroke-dasharray="4 5"/>';
            for (var k = 0; k < 3; k++) s += '<circle class="op" r="5" fill="' + PAL[i] + '" style="offset-path:path(\'' + path + '\');--d:' + (i * 0.35 + k * 0.85).toFixed(2) + 's"/>';
            s += '<g class="pop" ' + d(i * 0.12) + '><circle cx="34" cy="' + y + '" r="22" fill="#fff" stroke="#0D1838" stroke-width="2"/><text x="34" y="' + (y + 7) + '" text-anchor="middle" font-size="19">' + e[0] + '</text></g><text class="lbl fd" ' + d(0.3 + i * 0.12) + ' x="62" y="' + (y + 4) + '">' + e[1] + '</text>';
          });
          s += '<g class="pop" ' + d(0.8) + '><rect x="300" y="112" width="120" height="76" rx="14" fill="#0D1838"/><text x="360" y="146" text-anchor="middle" fill="#fff" font-weight="800" font-size="15" font-family="Bricolage Grotesque,sans-serif">İSTATİSTİK</text><text x="360" y="166" text-anchor="middle" fill="#C9D0E4" font-size="11">topla · özetle · yorumla</text></g>';
          s += '<path class="dr" style="--len:80;--d:1.3s" d="M424 150h46" stroke="#0D1838" stroke-width="3" marker-end="url(#ok1)"/>';
          s += '<g class="pop" ' + d(1.7) + '><rect x="476" y="124" width="72" height="52" rx="26" fill="#E0A526" stroke="#0D1838" stroke-width="2"/><text x="512" y="155" text-anchor="middle" font-weight="800" font-size="14">KARAR</text></g>';
          return V.svg(560, 300, '<defs><marker id="ok1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#0D1838"/></marker></defs>' + s, 'veri kaynaklarından istatistiğe, oradan karara akış');
        }
      },
      {
        b: '“Algoritma” sana nasıl ürün önerir?', terim: [['veri tabanı', 'database'], ['demografik profil', 'demographic profile']],
        t: '<p>Hepsiburada gibi büyük bir siteden alışveriş yaptığını düşün. Sisteme girdiğin anda bilgin ve satın alma davranışın karmaşık bir istatistik sistemine (“algoritma”) katılır.</p><p>Aldığın ürünün türü not edilir; sana <b>benzer demografik profildeki</b> ve aynı ürünü alan tüketicilerle eşleştirilirsin. Onların aldığı başka ürünler ekranında belirmeye başlar.</p>',
        v: function () {
          return V.kart([
            { ic: '📝', b: '1. Kayıt', en: 'registration', p: 'Bilgin ve davranışın sisteme girer.' },
            { ic: '🏷️', b: '2. Ürün türü', en: 'usage algorithm', p: 'Kitap mı, telefon mu? Not edilir.' },
            { ic: '👥', b: '3. Eşleştirme', en: 'matching', p: 'Sana benzeyen müşterilerle eşleşirsin.' },
            { ic: '✨', b: '4. Öneri', en: 'pop-up products', p: 'Onların aldıkları sana önerilir.' }
          ]);
        }
      },
      {
        b: 'Veri seti: eleman, değişken, gözlem', terim: [['veri seti', 'data set'], ['eleman', 'element'], ['değişken', 'variable'], ['gözlem', 'observation']],
        t: '<p><b>Veri</b> (data): incelenen konu için toplanan, analiz edilen ve özetlenen olgu ve rakamlar. Bir çalışmanın tüm verisi <b>veri setini</b> oluşturur.</p><ul><li><b>Eleman:</b> veri toplanan birim (burada şirketler, satırlar).</li><li><b>Değişken:</b> elemanların ilgilenilen özelliği (sütunlar).</li><li><b>Gözlem:</b> bir eleman için elde edilen ölçümler kümesi (bir satırın değerleri).</li></ul><p>4 eleman × 3 değişken = <b>12 veri değeri</b>.</p>',
        v: function () {
          return V.tablo(['Şirket (eleman)', 'Borsa', 'Yıllık satış ($M)', 'Hisse başı kâr ($)'],
            [['Dataram', 'NQ', '73,1', '0,86'], ['EnergySouth', 'N', '74,0', '1,67'], ['Keystone', 'N', '365,7', '0,86'], ['LandCare', 'NQ', '111,4', '0,33']],
            { n: [2, 3], hi: { '0,0': 'hc', '1,0': 'hc', '2,0': 'hc', '3,0': 'hc', '2,1': 'hi', '2,2': 'hi', '2,3': 'hi' }, cap: 'Mavi: elemanlar · sarı satır: Keystone için bir gözlem · başlıklar: değişkenler', st: 0.25 });
        }
      },
      {
        b: 'Ölçme düzeyleri I: sınıflama ve sıralama', terim: [['sınıflama ölçeği', 'nominal scale'], ['sıralama ölçeği', 'ordinal scale']],
        t: '<p><b>Sınıflama (nominal):</b> veri, elemanın bir özelliğini tanımlayan etiket ya da addır. Sayısal kod da kullanılabilir (1 = İşletme, 2 = Beşeri Bilimler…), ama sayının büyüklüğü bir şey anlatmaz.</p><p><b>Sıralama (ordinal):</b> nominalin özellikleri + <b>sıra anlamlıdır</b>. Sınıf düzeyi: Freshman < Sophomore < Junior < Senior.</p>',
        v: function () {
          var s = '', fak = [['İşletme', 1], ['Beşeri', 2], ['Eğitim', 3]], sin = ['Freshman', 'Sophomore', 'Junior', 'Senior'];
          s += '<text class="lbb" x="20" y="24">Nominal: fakülte</text>';
          fak.forEach(function (f, i) { s += '<g class="pop" ' + d(0.2 + i * 0.2) + '><rect x="' + (20 + i * 170) + '" y="40" width="150" height="56" rx="12" fill="' + PAL[i] + '" stroke="#0D1838" stroke-width="2"/><text x="' + (95 + i * 170) + '" y="66" text-anchor="middle" fill="#fff" font-weight="700">' + f[0] + '</text><text x="' + (95 + i * 170) + '" y="85" text-anchor="middle" fill="#fff" font-size="12">kod ' + f[1] + '</text></g>'; });
          s += '<text class="lbl fd" ' + d(0.9) + ' x="20" y="118">kodlar yer değiştirse de bilgi değişmez: 3 > 1 bir anlam taşımaz</text>';
          s += '<text class="lbb" x="20" y="160">Ordinal: sınıf düzeyi</text>';
          sin.forEach(function (c, i) { var h = 30 + i * 26; s += '<rect class="gy" ' + d(1.1 + i * 0.2) + ' x="' + (20 + i * 128) + '" y="' + (290 - h) + '" width="112" height="' + h + '" rx="6" fill="#DDEBFA" stroke="#0D1838" stroke-width="2"/><text class="lbb fd" ' + d(1.3 + i * 0.2) + ' x="' + (76 + i * 128) + '" y="' + (282 - h) + '" text-anchor="middle">' + (i + 1) + '. ' + c + '</text>'; });
          s += '<path class="dr" style="--len:520;--d:2s" d="M20 300H520" stroke="#C8553D" stroke-width="3" marker-end="url(#ok2)"/><text class="lbl fd" ' + d(2.3) + ' x="520" y="318" text-anchor="end">sıra anlamlı, farkın büyüklüğü ölçülemez</text>';
          return V.svg(540, 324, '<defs><marker id="ok2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#C8553D"/></marker></defs>' + s, 'nominal ve ordinal ölçek örnekleri');
        }
      },
      {
        b: 'Ölçme düzeyleri II: aralık ve oran', terim: [['aralık ölçeği', 'interval scale'], ['oran ölçeği', 'ratio scale'], ['gerçek sıfır', 'true zero']],
        t: '<p><b>Aralık (interval):</b> sıra + sabit birimli farklar. New York 30°C, Londra 20°C → New York <b>10°C daha sıcak</b>. Ama 0°C “sıcaklık yok” demek değil; “1,5 kat sıcak” denemez.</p><p><b>Oran (ratio):</b> aralığın tüm özellikleri + <b>gerçek sıfır</b>. Melissa 36, Kevin 72 kredi → Kevin’in kredisi <b>iki katı</b>. Uzaklık, boy, ağırlık, süre, ücret oran ölçeğidir.</p>',
        v: function () {
          var s = '', th = function (x, t, lab, c, dd) {
            var h = t * 4;
            return '<g><rect x="' + x + '" y="40" width="26" height="180" rx="13" fill="#fff" stroke="#0D1838" stroke-width="2"/><rect class="gy" ' + d(dd) + ' x="' + (x + 6) + '" y="' + (214 - h) + '" width="14" height="' + h + '" rx="7" fill="' + c + '"/><circle cx="' + (x + 13) + '" cy="232" r="20" fill="' + c + '" stroke="#0D1838" stroke-width="2"/><text class="lbb" x="' + (x + 13) + '" y="270" text-anchor="middle">' + lab + '</text><text class="lbm fd" ' + d(dd + 0.6) + ' x="' + (x + 13) + '" y="' + (206 - h) + '" text-anchor="middle">' + t + '°C</text></g>';
          };
          s += th(40, 30, 'New York', PAL[1], 0.2) + th(130, 20, 'Londra', PAL[0], 0.4);
          s += '<g class="an" ' + d(1.2) + '><path d="M70 94h58" stroke="#0D1838" stroke-width="1.5" stroke-dasharray="3 3"/><text class="lbb" x="100" y="88" text-anchor="middle">+10°C ✓</text><text class="lbl" x="100" y="300" text-anchor="middle">“1,5 kat sıcak” ✗</text></g>';
          [['Melissa', 36], ['Kevin', 72]].forEach(function (p, i) { s += '<rect class="gx" ' + d(1.6 + i * 0.3) + ' x="290" y="' + (90 + i * 70) + '" width="' + p[1] * 3 + '" height="40" rx="6" fill="' + PAL[2 + i] + '" stroke="#0D1838" stroke-width="2"/><text class="lbb" x="290" y="' + (82 + i * 70) + '">' + p[0] + ' · ' + p[1] + ' kredi</text>'; });
          s += '<line x1="290" x2="290" y1="70" y2="240" stroke="#0D1838" stroke-width="2"/><text class="lbm" x="290" y="256" text-anchor="middle">0 = hiç kredi yok</text><text class="lbb fd" ' + d(2.4) + ' x="400" y="290" text-anchor="middle">72 / 36 = 2 → “iki katı” ✓</text>';
          return V.svg(540, 310, s, 'aralık ve oran ölçeği örnekleri');
        }
      },
      {
        b: 'Ölçek merdiveni: hangi işlem anlamlı?', terim: [['nitel veri', 'categorical data'], ['nicel veri', 'quantitative data']],
        t: '<p>Her basamak alttakinin tüm özelliklerini taşır ve bir yenisini ekler. Hangi istatistiği hesaplayabileceğini ölçek belirler.</p><ul><li>Nominal: yalnızca <b>= ≠</b> (sayma, mod)</li><li>Ordinal: + <b>&lt; &gt;</b> (medyan, sıralama)</li><li>Aralık: + <b>+ −</b> (fark, aritmetik ortalama)</li><li>Oran: + <b>× ÷</b> (“iki katı”, geometrik ortalama)</li></ul><p>Nominal ve ordinal veri <b>nitel</b> (kategorik), aralık ve oran veri <b>nicel</b> veridir.</p>',
        v: function () {
          var st = [['Nominal', '= ≠', PAL[0]], ['Ordinal', '< >', PAL[2]], ['Aralık', '+ −', PAL[3]], ['Oran', '× ÷', PAL[1]]], s = '';
          st.forEach(function (x, i) { var y = 250 - i * 58, w = 200 + i * 80; s += '<g class="dp" ' + d(i * 0.35) + '><rect x="20" y="' + y + '" width="' + w + '" height="48" rx="10" fill="' + x[2] + '" stroke="#0D1838" stroke-width="2"/><text x="36" y="' + (y + 30) + '" fill="#fff" font-weight="800" font-size="16">' + x[0] + '</text><text x="' + (w + 4) + '" y="' + (y + 31) + '" text-anchor="end" fill="#fff" font-family="JetBrains Mono,monospace" font-weight="700" font-size="17">' + x[1] + '</text></g>'; });
          s += '<g class="an" ' + d(1.6) + '><path d="M500 290V40" stroke="#0D1838" stroke-width="2.5" marker-end="url(#ok3)"/><text class="lbl" transform="translate(520 170) rotate(-90)" text-anchor="middle">daha çok bilgi</text></g>';
          s += '<text class="lbb fd" ' + d(1.8) + ' x="20" y="22">nitel: nominal, ordinal · nicel: aralık, oran</text>';
          return V.svg(540, 310, '<defs><marker id="ok3" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#0D1838"/></marker></defs>' + s, 'ölçek merdiveni');
        }
      }
    ],
    gorsel: {
      b: 'Ölçek ayırıcı', t: 'Her değişken için doğru ölçme düzeyini seç. Yanlışta kısa bir açıklama çıkar; doğruyu bulana kadar deneyebilirsin.',
      kur: function (el) {
        var list = DEGISKEN.slice(0, 10), ok = 0, tried = {};
        el.innerHTML = '<div class="at-out" style="margin:0 0 12px"><div><small>doğru</small><b data-ok>0 / ' + list.length + '</b></div><div><small>ipucu</small><b style="font-size:13px;font-family:inherit">Gerçek sıfır var mı? Sıra var mı?</b></div></div><div class="srt">' +
          list.map(function (v, i) { return '<div class="it" data-i="' + i + '"><div>' + X(v[0]) + '<small data-m></small></div><div class="seg">' + OLC_K.map(function (k, j) { return '<button type="button" data-j="' + j + '">' + k + '</button>'; }).join('') + '</div></div>'; }).join('') + '</div>';
        [].forEach.call(el.querySelectorAll('.it'), function (it) {
          var i = +it.getAttribute('data-i');
          [].forEach.call(it.querySelectorAll('[data-j]'), function (b) {
            b.onclick = function () {
              if (it.classList.contains('ok')) return;
              var j = +b.getAttribute('data-j'), good = j === list[i][1];
              it.classList.remove('no'); void it.offsetWidth;
              if (good) { it.classList.add('ok'); b.setAttribute('aria-pressed', 'true'); ok++; el.querySelector('[data-ok]').textContent = ok + ' / ' + list.length; it.querySelector('[data-m]').textContent = OLC[j] + ': ' + OLC_N[j]; }
              else { it.classList.add('no'); tried[i] = 1; it.querySelector('[data-m]').textContent = OLC_K[j] + ' değil: ' + OLC_N[j]; }
              if (ok === list.length) IST.toast('Tüm ölçekler yerinde!');
            };
          });
        });
      }
    },
    sorular: function (r) {
      var out = [];
      /* 1 senaryo: ölçek */
      var v = r.pick(DEGISKEN);
      out.push({ tag: 'senaryo', q: '<p>Bir araştırmacı şu değişkeni kaydediyor:</p><p><b>“' + X(v[0]) + '”</b></p><p>Bu değişken hangi ölçme düzeyindedir?</p>', o: OLC, a: v[1], n: OLC_N[v[1]],
        ip: 'Önce sıra anlamlı mı diye bak; sonra farklar sabit birimli mi; en son “sıfır = hiç yok” mu?', cz: ['Değerler arasında sıra var mı? ' + (v[1] >= 1 ? 'Evet.' : 'Hayır → nominal.'), v[1] >= 1 ? 'Farklar sabit birimle ölçülebiliyor mu? ' + (v[1] >= 2 ? 'Evet.' : 'Hayır → ordinal.') : 'Sadece ad/etiket olduğu için işlem yapılamaz.', v[1] >= 2 ? 'Gerçek sıfır var mı? ' + (v[1] === 3 ? 'Evet → oran.' : 'Hayır → aralık.') : 'Sonuç: <b>' + OLC[v[1]] + '</b>.', 'Cevap: <b>' + OLC[v[1]] + '</b>.'] });
      /* 2–4 aynı tablo */
      var adlar = r.shuf(['Mavi Liman', 'Doruk Gıda', 'Kuzey Enerji', 'Atlas Lojistik', 'Ege Tekstil', 'Toros Yapı', 'Pera Yazılım', 'Fırat Kimya']).slice(0, r.int(4, 7));
      var borsa = ['BIST', 'NYSE', 'NASDAQ'], not = ['AAA', 'AA', 'A', 'BBB'];
      var cols = [['Borsa', 0, function () { return r.pick(borsa); }], ['Kredi notu', 1, function () { return r.pick(not); }], ['Kuruluş yılı', 2, function () { return String(r.int(1955, 2018)); }], ['Yıllık satış (mn TL)', 3, function () { return nf(r.int(120, 4800) / 10, 1); }], ['Çalışan sayısı', 3, function () { return String(r.int(40, 2600)); }]];
      var kc = r.shuf(cols).slice(0, r.int(3, 4));
      var rows = adlar.map(function (a) { return [a].concat(kc.map(function (c) { return c[2](); })); });
      var tab = V.tablo(['Şirket'].concat(kc.map(function (c) { return c[0]; })), rows, { st: 0 });
      var nE = adlar.length, nV = kc.length;
      out.push({ tag: 'tablo okuma', q: '<p>Yandaki veri seti bir yatırım kulübünün izlediği şirketleri gösteriyor. Şirket adı, elemanı tanımlayan etikettir (değişken sayılmaz).</p><p>Bu veri setinde toplam kaç <b>veri değeri</b> (data value) vardır?</p>', g: tab, say: nE * nV, goster: String(nE * nV), tol: 0.01, ornek: '12',
        ip: 'Toplam veri değeri = eleman sayısı × değişken sayısı.', cz: ['Elemanlar satırlardır: <b>' + nE + '</b> şirket.', 'Değişkenler sütunlardır (şirket adı hariç): <b>' + nV + '</b>.', 'Veri değeri = ' + nE + ' × ' + nV + ' = <b>' + nE * nV + '</b>.'] });
      var kk = r.pick(kc);
      out.push({ tag: 'tablo okuma', q: '<p>Aynı tablodaki <b>“' + X(kk[0]) + '”</b> değişkeni hangi ölçme düzeyindedir?</p>', g: tab, o: OLC, a: kk[1], n: OLC_N[kk[1]],
        ip: kk[1] === 2 ? 'Yıl 0 “zaman yok” demek değil; yıllar arasındaki fark ise anlamlı.' : 'Sıra, sabit fark ve gerçek sıfır sorularını sırayla sor.', cz: ['Değişken: ' + X(kk[0]) + '.', OLC_N[kk[1]], 'Cevap: <b>' + OLC[kk[1]] + '</b>.'] });
      /* 4 aralık–oran */
      var t1 = r.int(24, 36), t2 = r.int(6, 14);
      out.push({ tag: 'yorum', q: '<p>Bugün İzmir’de sıcaklık <b>' + t1 + '°C</b>, Erzurum’da <b>' + t2 + '°C</b> ölçüldü. Hangi ifade istatistiksel olarak doğrudur?</p>',
        o: ['İzmir, Erzurum’dan ' + (t1 - t2) + '°C daha sıcaktır.', 'İzmir, Erzurum’dan ' + nf(t1 / t2, 1) + ' kat daha sıcaktır.', 'Sıcaklık sınıflama ölçeğinde olduğu için karşılaştırılamaz.', 'Erzurum’da 0°C olsaydı sıcaklık hiç olmazdı.'], a: 0,
        n: 'Santigrat sıcaklık aralık ölçeğindedir: farklar anlamlı, oranlar değil (0°C gerçek sıfır değildir).', yn: { 1: 'Oran kurmak için gerçek sıfır gerekir; °C’de 0 “sıcaklık yok” demek değildir.', 2: 'Sıcaklıkta sıra ve fark anlamlıdır; nominal değildir.', 3: '0°C suyun donma noktasıdır, sıcaklığın yokluğu değil.' },
        ip: 'Santigrat ölçeğinde 0 ne anlama geliyor?', cz: ['°C’de sıra ve sabit birimli fark anlamlı → en az aralık ölçeği.', '0°C gerçek sıfır değil (sıcaklığın yokluğu değil) → oran ölçeği değil.', 'Bu yüzden yalnızca fark yorumu doğru: ' + t1 + ' − ' + t2 + ' = <b>' + (t1 - t2) + '°C</b>.'] });
      /* 5 merdiven */
      var sk = r.int(0, 3), ops = ['Eşit mi, değil mi? (= ≠)', 'Hangisi büyük? (< >)', 'Aradaki fark kaç birim? (+ −)', 'Kaç katı? (× ÷)'];
      out.push({ tag: 'kavram', q: '<p>Veri <b>' + OLC[sk].toLowerCase() + '</b> ölçeğinde ölçülmüş. Aşağıdakilerden hangisi bu ölçekte anlamlı olan <b>en ileri</b> işlemdir?</p>', o: ops, a: sk, n: 'Her ölçek bir alttakinin işlemlerini de kapsar; ' + OLC_K[sk] + ' için en ileri işlem: ' + ops[sk] + '.',
        ip: 'Merdiven: nominal (= ≠) → ordinal (< >) → aralık (+ −) → oran (× ÷).', cz: ['Ölçek merdivenini hatırla: her basamak bir işlem ekler.', OLC[sk] + ' basamağında eklenen işlem: <b>' + ops[sk] + '</b>.'] });
      return out;
    }
  });

  /* ======================= 2. HAFTA ======================= */
  var HUDSON = [91, 78, 93, 57, 75, 52, 99, 80, 97, 62, 71, 69, 72, 89, 66, 75, 79, 75, 72, 76, 104, 74, 62, 68, 97, 105, 77, 65, 80, 109, 85, 97, 88, 68, 83, 68, 71, 69, 67, 74, 62, 82, 98, 101, 79, 105, 79, 69, 62, 73];
  IST.hafta({
    id: 'g2', no: 2, renk: '#1F8A7A', tr: 'İstatistiğe giriş II: veri türleri, anakütle ve örneklem', en: 'Basic Outlook to Statistics 2',
    sahneler: [
      {
        b: 'Nitel mi, nicel mi?', terim: [['nitel veri', 'qualitative data'], ['nicel veri', 'quantitative data'], ['kesikli', 'discrete'], ['sürekli', 'continuous']],
        t: '<p><b>Nitel (kategorik) veri:</b> etiket ya da adlar; nominal veya ordinal ölçek. Örnek: cinsiyet, kan grubu, memnuniyet düzeyi.</p><p><b>Nicel veri:</b> “ne kadar / kaç tane” sorusunun cevabı; aralık veya oran ölçeği.</p><ul><li><b>Kesikli:</b> sayılarak elde edilir (müşteri sayısı: 0, 1, 2…)</li><li><b>Sürekli:</b> ölçülerek elde edilir (ağırlık, süre: 2,47 kg)</li></ul>',
        v: function () {
          return V.kart([
            { ic: '🏷️', b: 'Nitel', en: 'qualitative / categorical', p: 'Kan grubu, marka, memnuniyet' },
            { ic: '🔢', b: 'Nicel · kesikli', en: 'quantitative · discrete', p: 'Günlük şikâyet sayısı: 0, 1, 2, 3…' },
            { ic: '📏', b: 'Nicel · sürekli', en: 'quantitative · continuous', p: 'Teslim süresi: 2,35 saat' }
          ]) + '<div style="margin-top:16px">' + V.dots({ v: [0, 1, 1, 2, 2, 2, 3, 3, 4], min: 0, max: 5, h: 150, xlab: 'kesikli: değerler arasında boşluk var', d: 0.6 }) + '</div>';
        }
      },
      {
        b: 'Kesit verisi ve zaman serisi', terim: [['kesit verisi', 'cross-sectional data'], ['zaman serisi', 'time series data']],
        t: '<p><b>Kesit verisi:</b> aynı ya da yaklaşık aynı <b>zaman noktasında</b> farklı elemanlardan toplanır. Örnek: Haziran ayında her ilçede verilen yapı ruhsatı sayısı.</p><p><b>Zaman serisi:</b> aynı eleman için <b>birçok dönem boyunca</b> toplanır. Örnek: tek bir ilçede son 12 ayda verilen ruhsatlar.</p>',
        v: function () {
          return V.ust(V.bars({ x: ['Çankaya', 'Keçiören', 'Yenimahalle', 'Etimesgut', 'Mamak'], y: [42, 35, 28, 31, 19], h: 190, fmt: function (v) { return nf(v, 0); }, label: 'kesit verisi: ilçelere göre ruhsat', xlab: 'Haziran · ilçeler (kesit)' }),
            V.xy({ x: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], y: [22, 25, 31, 36, 40, 42, 39, 37, 33, 30, 26, 24], line: true, h: 190, d: 1, renk: PAL[2], xt: [[1, 'Oca'], [3, 'Mar'], [5, 'May'], [7, 'Tem'], [9, 'Eyl'], [11, 'Kas']], xlab: 'Çankaya · 12 ay (zaman serisi)' }));
        }
      },
      {
        b: 'Veri nereden gelir? Deneysel ve gözlemsel çalışma', terim: [['deneysel çalışma', 'experimental study'], ['gözlemsel çalışma', 'observational study']],
        t: '<p>Veri ya <b>mevcut kaynaklardan</b> (şirket kayıtları, TÜİK, ticari veri tabanları) alınır ya da yeni bir <b>istatistiksel çalışma</b> ile toplanır.</p><p><b>Deneysel çalışmada</b> araştırmacı ilgilenilen değişkeni <b>kontrol eder</b> (yeni bir ilacın dozunu belirler). <b>Gözlemsel çalışmada</b> değişkenler kontrol edilmez, yalnızca gözlenir (anket, müşteri gözlemi).</p>',
        v: function () {
          var s = '<text class="lbb" x="20" y="26">Deneysel</text><text class="lbb" x="290" y="26">Gözlemsel</text>';
          s += '<g class="pop" ' + d(0.2) + '><rect x="20" y="40" width="240" height="210" rx="14" fill="#E3F4EA" stroke="#0D1838" stroke-width="2"/></g>';
          ['A grubu: yeni ilaç', 'B grubu: plasebo'].forEach(function (t, i) { s += '<g class="an" ' + d(0.5 + i * 0.3) + '><rect x="40" y="' + (64 + i * 70) + '" width="200" height="52" rx="10" fill="#fff" stroke="#0D1838" stroke-width="1.5"/><text class="lbb" x="140" y="' + (95 + i * 70) + '" text-anchor="middle">' + t + '</text></g>'; });
          s += '<text class="lbl fd" ' + d(1.2) + ' x="140" y="226" text-anchor="middle">araştırmacı atar ve kontrol eder</text>';
          s += '<g class="pop" ' + d(0.4) + '><rect x="290" y="40" width="240" height="210" rx="14" fill="#DDEBFA" stroke="#0D1838" stroke-width="2"/></g>';
          for (var i = 0; i < 12; i++) s += '<circle class="dp" ' + d(0.8 + i * 0.06) + ' cx="' + (320 + (i % 6) * 36) + '" cy="' + (100 + Math.floor(i / 6) * 50) + '" r="13" fill="' + (i % 3 ? PAL[0] : PAL[3]) + '" stroke="#0D1838"/>';
          s += '<text x="470" y="210" font-size="30" class="pop" ' + d(1.6) + '>🔍</text><text class="lbl fd" ' + d(1.6) + ' x="410" y="226" text-anchor="middle">yalnızca gözlenir, müdahale yok</text>';
          return V.svg(550, 262, s, 'deneysel ve gözlemsel çalışma');
        }
      },
      {
        b: 'Betimsel istatistik: Hudson Auto’nun 50 faturası', terim: [['betimsel istatistik', 'descriptive statistics'], ['frekans dağılımı', 'frequency distribution']],
        t: '<p>Hudson Auto’nun müdürü motor bakımında kullanılan parçaların maliyetini anlamak için <b>50 faturayı</b> inceliyor. 50 sayıyı tek tek okumak zor.</p><p><b>Betimsel istatistik</b> veriyi tablo, grafik ve sayısal ölçülerle <b>özetler</b>: maliyetler en çok 70–79 $ aralığında; ortalama ≈ <b>79 $</b>.</p>',
        v: function () {
          var e = [50, 60, 70, 80, 90, 100, 110], y = [0, 0, 0, 0, 0, 0];
          HUDSON.forEach(function (v) { y[Math.min(5, Math.floor((v - 50) / 10))]++; });
          return V.ust(V.hist({ edges: e, y: y, h: 220, xlab: 'parça maliyeti ($) · n = 50', hi: [2], every: 1 }),
            V.fx([{ s: 'aritmetik ortalama', h: 'x̄ = Σx / n = 3.949 / 50 = <b>78,98 $</b>', son: true }], 1.2));
        }
      },
      {
        b: 'Anakütle ve örneklem', terim: [['anakütle', 'population'], ['örneklem', 'sample'], ['parametre', 'parameter'], ['istatistik (değer)', 'statistic']],
        t: '<p><b>Anakütle:</b> ilgilenilen tüm elemanların kümesi. <b>Örneklem:</b> anakütlenin bir alt kümesi.</p><ul><li>AYBÜ öğrencilerinin ayakkabı numarası → anakütle tüm öğrenciler; örneklem rastgele 200 öğrenci.</li><li>Edirne’de vergi görüşü → 18 yaş üstü tüm Edirneliler; 500 kişilik rastgele örneklem.</li></ul><p>Anakütleyi betimleyen sayı <b>parametre</b> (μ), örneklemden hesaplanan sayı <b>istatistik</b> (x̄) adını alır.</p>',
        v: function () {
          var r = IST.rng(7), s = '', pick = r.shuf(Array.apply(null, Array(96)).map(function (_, i) { return i; })).slice(0, 14);
          for (var i = 0; i < 96; i++) { var inS = pick.indexOf(i) >= 0; s += '<circle class="pop" ' + d((i % 12) * 0.02 + Math.floor(i / 12) * 0.04) + ' cx="' + (30 + (i % 12) * 26) + '" cy="' + (40 + Math.floor(i / 12) * 28) + '" r="9" fill="' + (inS ? PAL[1] : '#DDEBFA') + '" stroke="#0D1838" stroke-width="' + (inS ? 2 : 1) + '"/>'; }
          s += '<rect x="12" y="20" width="320" height="236" rx="14" fill="none" stroke="#0D1838" stroke-width="2"/><text class="lbb" x="20" y="14">ANAKÜTLE (N) · parametre μ</text>';
          s += '<g class="an" ' + d(1.2) + '><path d="M340 140h40" stroke="#C8553D" stroke-width="3"/><rect x="384" y="80" width="150" height="120" rx="14" fill="#FBE6E1" stroke="#C8553D" stroke-width="2"/><text class="lbb" x="459" y="110" text-anchor="middle">ÖRNEKLEM (n = 14)</text><text x="459" y="150" text-anchor="middle" font-size="22" font-weight="800" font-family="JetBrains Mono,monospace">x̄</text><text class="lbl" x="459" y="178" text-anchor="middle">istatistik (statistic)</text></g>';
          return V.svg(550, 266, s, 'anakütle ve örneklem');
        }
      },
      {
        b: 'Çıkarımsal istatistik süreci', terim: [['çıkarımsal istatistik', 'statistical inference'], ['tahmin', 'estimate']],
        t: '<p>Anakütlenin tamamını incelemek çoğu zaman pahalı ya da imkânsızdır. <b>Çıkarımsal istatistik</b>, örneklemden elde edilen veriyle anakütle hakkında <b>tahmin</b> yapar ve hipotezleri sınar.</p><p>Örnek: Ankara’da iki döner zincirinin (A ve B) porsiyon gramajını karşılaştırmak için her birinden rastgele 200 döner alınır; sonuç tüm dönerler için genellenir.</p>',
        v: function () {
          return V.kart([
            { ic: '❓', b: '1. Soru', en: 'population of interest', p: 'Tüm Hudson bakımlarının ortalama parça maliyeti nedir?' },
            { ic: '🎯', b: '2. Örneklem', en: 'sample', p: '50 bakım faturası rastgele seçilir.' },
            { ic: '🧮', b: '3. Özet', en: 'sample statistic', p: 'Örneklem ortalaması x̄ = 79 $' },
            { ic: '📣', b: '4. Çıkarım', en: 'inference', p: 'Anakütle ortalaması μ ≈ 79 $ olarak tahmin edilir.' }
          ]);
        }
      }
    ],
    gorsel: {
      b: 'Örneklem çekme laboratuvarı', t: 'Bir döner zincirinin 400 porsiyonunun gramajı anakütleyi oluşturuyor (μ biliniyor). Örneklem büyüklüğünü seç, örneklem çek ve örneklem ortalamalarının μ etrafında nasıl dağıldığını izle.',
      kur: function (el) {
        var r = IST.rng(2026), pop = [];
        for (var i = 0; i < 400; i++) { var u = r() + r() + r() + r() - 2; pop.push(Math.round(150 + u * 22)); }
        var mu = M.mean(pop), means = [], n = 10, last = [];
        el.innerHTML = '<div class="at-g"><div class="at-k"><label><span>örneklem büyüklüğü n <output data-no>10</output></span><input type="range" min="2" max="100" value="10" data-n></label><div class="row"><button type="button" class="btn sm pri" data-c1>1 örneklem çek</button><button type="button" class="btn sm" data-c20>20 kez çek</button><button type="button" class="btn sm ghost" data-sil>sıfırla</button></div><div class="at-out" style="margin:0"><div><small>anakütle μ</small><b>' + nf(mu, 1) + ' g</b></div><div><small>son x̄</small><b data-xb>–</b></div><div><small>x̄’lerin yayılımı</small><b data-sp>–</b></div></div></div><div class="at-v"><div data-pop></div><div data-hist></div></div></div><div class="at-not" data-not>Küçük n ile çekilen örneklemlerin ortalamaları μ’den çok sapabilir. n’yi büyütüp tekrar dene.</div>';
        var popEl = el.querySelector('[data-pop]'), hEl = el.querySelector('[data-hist]');
        var drawPop = function () {
          var s = '';
          for (var i = 0; i < 400; i++) { var on = last.indexOf(i) >= 0; s += '<rect x="' + (4 + (i % 40) * 13) + '" y="' + (4 + Math.floor(i / 40) * 13) + '" width="10" height="10" rx="2" fill="' + (on ? PAL[1] : '#DDEBFA') + '"' + (on ? ' class="pop"' : '') + '/>'; }
          popEl.innerHTML = V.svg(528, 138, s, 'anakütle: 400 porsiyon, seçilenler kırmızı');
        };
        var drawH = function () {
          var e = [], y = []; for (var a = 120; a < 180; a += 3) { e.push(a); y.push(0); } e.push(180);
          means.forEach(function (m) { var k = Math.floor((m - 120) / 3); if (k >= 0 && k < y.length) y[k]++; });
          hEl.innerHTML = V.hist({ edges: e, y: y, h: 200, max: Math.max(5, V.nice(Math.max.apply(null, y))), val: false, every: 4, xlab: 'örneklem ortalamaları x̄ (g) · ' + means.length + ' örneklem', renk: PAL[2] }).replace('</svg>', '<line x1="' + (46 + (mu - 120) / 60 * 460).toFixed(1) + '" x2="' + (46 + (mu - 120) / 60 * 460).toFixed(1) + '" y1="10" y2="156" stroke="#C8553D" stroke-width="2.5" stroke-dasharray="5 4"/><text class="lbb" x="' + (46 + (mu - 120) / 60 * 460).toFixed(1) + '" y="10" text-anchor="middle" style="fill:#C8553D">μ</text></svg>');
          el.querySelector('[data-sp]').textContent = means.length > 1 ? '± ' + nf(M.sdS(means), 1) + ' g' : '–';
        };
        var cek = function (k) {
          for (var t = 0; t < k; t++) { last = IST.rng((Date.now() + t * 977 + means.length * 31) | 0).shuf(pop.map(function (_, i) { return i; })).slice(0, n); means.push(M.mean(last.map(function (i) { return pop[i]; }))); }
          el.querySelector('[data-xb]').textContent = nf(means[means.length - 1], 1) + ' g'; drawPop(); drawH();
          el.querySelector('[data-not]').innerHTML = 'Son örneklemde x̄ = <b>' + nf(means[means.length - 1], 1) + ' g</b>, μ = ' + nf(mu, 1) + ' g; fark ' + nf(Math.abs(means[means.length - 1] - mu), 1) + ' g. x̄ bir <b>istatistiktir</b>; her örneklemde değişir, μ ise sabit bir <b>parametredir</b>.';
        };
        el.querySelector('[data-n]').oninput = function () { n = +this.value; el.querySelector('[data-no]').textContent = n; means = []; drawH(); };
        el.querySelector('[data-c1]').onclick = function () { cek(1); };
        el.querySelector('[data-c20]').onclick = function () { cek(20); };
        el.querySelector('[data-sil]').onclick = function () { means = []; last = []; drawPop(); drawH(); el.querySelector('[data-xb]').textContent = '–'; };
        drawPop(); drawH();
      }
    },
    sorular: function (r) {
      var out = [];
      var tip = [['Bir kafede müşterinin seçtiği içecek boyu (küçük, orta, büyük)', 0], ['Bir çağrı merkezine bir saatte gelen arama sayısı', 1], ['Kargonun teslim süresi (saat)', 2], ['Müşterinin ödeme yöntemi (nakit, kart, havale)', 0], ['Bir ailedeki çocuk sayısı', 1], ['Bir şişedeki süt hacmi (ml)', 2], ['Bir sınıftaki devamsız öğrenci sayısı', 1], ['Çalışanın aylık brüt maaşı (kuruş hassasiyetinde)', 2]];
      var tp = r.pick(tip), TO = ['Nitel (kategorik)', 'Nicel · kesikli', 'Nicel · sürekli', 'Hem nitel hem nicel'];
      out.push({ tag: 'senaryo', q: '<p>Değişken: <b>' + X(tp[0]) + '</b></p><p>Bu değişkenin verisi hangi türdedir?</p>', o: TO, a: tp[1], n: ['Değerler kategori/etikettir.', 'Değerler sayılarak elde edilir.', 'Değerler ölçülerek elde edilir; iki değer arasında sonsuz değer olabilir.'][tp[1]],
        ip: 'Önce: cevap bir etiket mi, sayı mı? Sayıysa: sayılarak mı, ölçülerek mi elde ediliyor?', cz: ['Cevap bir sayı mı? ' + (tp[1] ? 'Evet → nicel.' : 'Hayır, etiket → nitel.'), tp[1] ? (tp[1] === 1 ? 'Sayma ile elde edilir (0, 1, 2…) → kesikli.' : 'Ölçme ile elde edilir → sürekli.') : 'Sonuç: nitel (kategorik).', 'Cevap: <b>' + TO[tp[1]] + '</b>.'] });
      var ks = [['2025 yılında 81 ilin her birinde kaydedilen işsizlik oranı', 0], ['Bir şirketin 2015–2025 arası yıllık satışları', 1], ['Geçen ay 300 müşteriye uygulanan memnuniyet anketi', 0], ['Bir hissenin son 60 işlem günündeki kapanış fiyatı', 1], ['Bugün 12 bankanın konut kredisi faiz oranı', 0], ['İstanbul’da son 24 ayda satılan konut sayısı', 1]];
      var k = r.pick(ks);
      out.push({ tag: 'senaryo', q: '<p><b>' + X(k[0]) + '</b></p><p>Bu veri hangi türdedir?</p>', o: ['Kesit verisi (cross-sectional)', 'Zaman serisi (time series)'], a: k[1], n: k[1] ? 'Aynı eleman, ardışık dönemler boyunca izleniyor.' : 'Farklı elemanlar aynı zaman noktasında ölçülüyor.',
        ip: 'Elemanlar mı değişiyor, zaman mı?', cz: ['Kesit: birçok eleman, tek zaman noktası.', 'Zaman serisi: tek eleman, birçok dönem.', 'Bu soruda: <b>' + (k[1] ? 'zaman serisi' : 'kesit verisi') + '</b>.'] });
      var ak = [
        { s: 'Bir giyim markası yeni kot pantolonun 10 yaş üstü Türk erkeklerince beğenilip beğenilmeyeceğini öğrenmek için rastgele 200 erkekle görüşüyor.', a: 'Türkiye’deki 10 yaş üstü tüm erkekler', o: ['Görüşülen 200 erkek', 'Kot pantolonu beğenenler', 'Markanın tüm müşterileri'] },
        { s: 'THY pilotlarının iş tatminini ölçmek için rastgele 100 pilota anket uygulanıyor.', a: 'Tüm THY pilotları', o: ['Ankete katılan 100 pilot', 'Türkiye’deki tüm havayolu çalışanları', 'Tatmin puanı yüksek pilotlar'] },
        { s: 'Edirne Belediyesi yeni bir vergi düzenlemesine destek düzeyini öğrenmek için 18 yaş üstü 500 Edirneliyi rastgele seçiyor.', a: 'Edirne’de yaşayan 18 yaş üstü herkes', o: ['Seçilen 500 kişi', 'Vergiyi destekleyenler', 'Türkiye’deki tüm vergi mükellefleri'] },
        { s: 'Bir dişli üreticisi yeni markanın dayanıklılığını test etmek için üretimden rastgele 300 dişli seçiyor.', a: 'Yeni markanın üretilen tüm dişlileri', o: ['Test edilen 300 dişli', 'Kusurlu dişliler', 'Fabrikadaki tüm makineler'] }
      ];
      var A = r.pick(ak);
      out.push({ tag: 'senaryo', q: '<p>' + X(A.s) + '</p><p>Bu çalışmada <b>anakütle</b> hangisidir?</p>', o: [A.a].concat(A.o), a: 0, n: 'Anakütle, sonucun genellenmek istendiği tüm elemanlardır; incelenen alt küme örneklemdir.', yn: { 1: 'Bu, verinin gerçekten toplandığı alt küme: örneklem.' },
        ip: 'Sonuç kimin için genellenmek isteniyor?', cz: ['Araştırmacının hakkında karar vermek istediği küme anakütledir.', 'Gerçekte ölçülen alt küme örneklemdir: ' + X(A.o[0]).toLowerCase() + '.', 'Anakütle: <b>' + X(A.a) + '</b>.'] });
      var smp = r.shuf(HUDSON).slice(0, r.int(5, 7)), mean = M.mean(smp);
      out.push({ tag: 'hesap', q: '<p>Hudson Auto’nun müdürü bu hafta rastgele seçtiği faturalarda şu parça maliyetlerini ($) buldu:</p><p class="mono" style="font-size:17px">' + smp.join(' · ') + '</p><p>Örneklem ortalaması <b>x̄</b> kaç dolardır? (iki ondalık)</p>', say: mean, goster: nf(mean, 2) + ' $', tol: 0.011, ornek: '78,98',
        ip: 'x̄ = (tüm değerlerin toplamı) / (değer sayısı).', cz: ['Toplam: ' + smp.join(' + ') + ' = <b>' + M.sum(smp) + '</b>.', 'n = <b>' + smp.length + '</b>.', 'x̄ = ' + M.sum(smp) + ' / ' + smp.length + ' = <b>' + nf(mean, 2) + ' $</b>. Bu değer bir istatistiktir (örneklemden).'] });
      var bet = r() < 0.5;
      out.push({ tag: 'yorum', q: bet ? '<p>Müdür 50 faturayı inceleyip “<b>bu 50 faturanın</b> ortalama parça maliyeti 78,98 $; en çok fatura 70–79 $ aralığında” diye rapor ediyor.</p><p>Bu hangi tür istatistiktir?</p>' : '<p>Müdür 50 faturadan yola çıkarak “<b>atölyemizdeki tüm bakımların</b> ortalama parça maliyeti yaklaşık 79 $’dır” diyor.</p><p>Bu hangi tür istatistiktir?</p>',
        o: ['Betimsel istatistik (descriptive)', 'Çıkarımsal istatistik (inferential)'], a: bet ? 0 : 1, n: bet ? 'Yalnızca eldeki 50 faturayı özetliyor; genelleme yok.' : 'Örneklemden tüm bakımlara (anakütleye) genelleme yapılıyor.',
        ip: 'İfade yalnızca eldeki veriyi mi anlatıyor, yoksa daha büyük bir kümeye mi genelliyor?', cz: ['Eldeki veriyi özetlemek → betimsel.', 'Örneklemden anakütleye genellemek → çıkarımsal.', 'Burada: <b>' + (bet ? 'betimsel' : 'çıkarımsal') + '</b>.'] });
      return out;
    }
  });

  /* ======================= 3. HAFTA ======================= */
  var KREM = [['Kesinlikle katılmıyorum', 4], ['Katılmıyorum', 5], ['Kararsızım', 12], ['Katılıyorum', 17], ['Kesinlikle katılıyorum', 14]];
  var MAAS = [['120–172', 2], ['172–224', 21], ['224–276', 8], ['276–328', 26], ['328–380', 11], ['380–432', 16], ['432–484', 4], ['484–536', 1], ['536–589', 1]];
  IST.hafta({
    id: 'g3', no: 3, renk: '#C8553D', tr: 'Veri: toplama, frekans tabloları', en: 'Data',
    sahneler: [
      {
        b: 'Veri setinin parçaları', terim: [['birim / vaka', 'case'], ['değişken', 'variable'], ['gözlem', 'observation']],
        t: '<p>Beş çalışanın kaydı. Her satır bir <b>birim</b> (case): Ali, Fatma… Her sütun bir <b>değişken</b>: cinsiyet, yaş, haftalık ücret.</p><p>Bir hücredeki değer bir <b>gözlemdir</b>: Hasan’ın yaşı 56. Cinsiyet <b>nitel</b>, yaş ve ücret <b>nicel</b> değişkendir.</p>',
        v: function () { return V.tablo(['Birim', 'Ad', 'Cinsiyet', 'Yaş', 'Haftalık ücret ($)'], [['1', 'Ali', 'Erkek', '34', '240'], ['2', 'Fatma', 'Kadın', '28', '225'], ['3', 'Hasan', 'Erkek', '56', '320'], ['4', 'Zeynep', 'Kadın', '22', '210'], ['5', 'Ahmet', 'Erkek', '38', '290']], { n: [0, 3, 4], hi: { '2,3': 'hi', '0,2': 'hc', '1,2': 'hc', '2,2': 'hc', '3,2': 'hc', '4,2': 'hc' }, rowc: {}, cap: 'Mavi sütun: nitel değişken · sarı hücre: Hasan’ın yaşı (bir gözlem)', st: 0.2 }); }
      },
      {
        b: 'Veri nasıl toplanır?', terim: [['birincil veri', 'primary data'], ['ikincil veri', 'secondary data'], ['anket', 'questionnaire'], ['Likert ölçeği', 'Likert scale']],
        t: '<p><b>Birincil veri</b> araştırmacının kendisinin topladığı, <b>ikincil veri</b> başkasının toplayıp yayımladığı veridir (TÜİK, şirket raporları).</p><p>Yöntemler: anket, yüz yüze/telefon görüşmesi, gözlem, deney. Anket soruları <b>açık uçlu</b> (serbest cevap) ya da <b>kapalı uçlu</b> (seçenekli) olur. Tutum ölçmek için 5’li <b>Likert</b> kullanılır.</p>',
        v: function () {
          return V.kart([{ ic: '📋', b: 'Anket', en: 'survey' }, { ic: '🗣️', b: 'Görüşme', en: 'interview' }, { ic: '👀', b: 'Gözlem', en: 'observation' }, { ic: '🧪', b: 'Deney', en: 'experiment' }]) +
            '<div class="an" ' + d(0.9) + ' style="margin-top:14px;padding:12px;border:2px solid #0D1838;border-radius:12px;background:#fff"><b>“Bu nemlendirici kremi tavsiye ederim.”</b><div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">' +
            ['Kesinlikle katılmıyorum', 'Katılmıyorum', 'Kararsızım', 'Katılıyorum', 'Kesinlikle katılıyorum'].map(function (t, i) { return '<span class="pop" ' + d(1.2 + i * 0.12) + ' style="padding:4px 8px;border:1.5px solid #0D1838;border-radius:999px;font-size:12px;background:' + (i === 3 ? '#FFF1C2' : '#fff') + '">' + (i + 1) + ' · ' + t + '</span>'; }).join('') + '</div></div>';
        }
      },
      {
        b: 'Ölçme hataları: rastgele ve sistematik', terim: [['rastgele hata', 'random error'], ['sistematik hata', 'systematic error'], ['yanlılık', 'bias']],
        t: '<p><b>Rastgele hata</b>: ölçümler gerçek değerin etrafında öngörülemez biçimde saçılır; çok sayıda ölçümde birbirini götürür.</p><p><b>Sistematik hata</b> (yanlılık): ölçümler hep <b>aynı yöne</b> kayar. Örnek: 0,5 kg fazla gösteren bir terazi; yönlendirici bir anket sorusu. Ölçüm sayısını artırmak bunu düzeltmez.</p>',
        v: function () {
          var tg = function (cx, pts, lab, dd) {
            var s = '';[60, 44, 28, 12].forEach(function (rr, i) { s += '<circle cx="' + cx + '" cy="130" r="' + rr + '" fill="' + (i % 2 ? '#fff' : '#FBE6E1') + '" stroke="#0D1838" stroke-width="1.5"/>'; });
            pts.forEach(function (p, i) { s += '<circle class="dp" ' + d(dd + i * 0.1) + ' cx="' + (cx + p[0]) + '" cy="' + (130 + p[1]) + '" r="5" fill="#0D1838"/>'; });
            return s + '<text class="lbb" x="' + cx + '" y="226" text-anchor="middle">' + lab + '</text>';
          };
          return V.svg(540, 240, tg(140, [[-30, 12], [22, -28], [8, 34], [-14, -18], [36, 6], [-4, 2], [18, 22], [-26, -36]], 'rastgele: merkez etrafında', 0.2) + tg(400, [[28, -24], [34, -16], [22, -30], [38, -28], [30, -18], [26, -22], [34, -34], [40, -22]], 'sistematik: hep aynı yöne', 1.2), 'rastgele ve sistematik hata hedef tahtası');
        }
      },
      {
        b: 'Frekans tablosu', terim: [['frekans', 'frequency'], ['göreli frekans', 'relative frequency'], ['yüzde', 'percent']],
        t: '<p>52 kişiye krem önermelerini sorduk. Her kategoride kaç kişi var? Bu sayı <b>frekanstır</b> (f).</p><p><b>Göreli frekans</b> = f / n; yüzde = göreli frekans × 100. “Katılıyorum”: 17 / 52 = 0,327 → <b>%32,7</b>.</p>',
        v: function () {
          var n = 52;
          return V.ust(V.tablo(['Kategori', 'x', 'f', 'f / n', '%'], KREM.map(function (k, i) { return [k[0], String(i + 1), String(k[1]), nf(k[1] / n, 3, false), nf(k[1] / n * 100, 1, false)]; }).concat([['<b>Toplam</b>', '', '<b>52</b>', '<b>1,000</b>', '<b>100</b>']]), { n: [1, 2, 3, 4], hi: { '3,2': 'hi', '3,3': 'hi', '3,4': 'hi' }, st: 0.15 }),
            V.bars({ x: ['1', '2', '3', '4', '5'], y: KREM.map(function (k) { return k[1]; }), h: 170, fmt: function (v) { return nf(v, 0); }, hi: [3], dim: false, d: 0.9 }));
        }
      },
      {
        b: 'Gruplanmış ve birikimli frekans', terim: [['sınıf aralığı', 'class interval'], ['birikimli frekans', 'cumulative frequency'], ['sınıf genişliği', 'class width']],
        t: '<p>Sayısal veri çok değer içeriyorsa <b>sınıflara</b> gruplanır. 90 çalışanın haftalık ücreti 9 sınıfta, genişlik ≈ 52 $.</p><p><b>Birikimli frekans</b> (F): o sınıfa kadarki tüm frekansların toplamı. 4. sınıf: 2 + 21 + 8 + 26 = <b>57</b> → ücretlerin %63,2’si 328 $’ın altında.</p>',
        v: function () {
          var F = 0;
          return V.tablo(['Sınıf ($)', 'f', 'F', 'F / n'], MAAS.map(function (m) { F += m[1]; return [m[0], String(m[1]), String(F), nf(F / 90, 3, false)]; }), { n: [1, 2, 3], hi: { '3,2': 'hi', '3,3': 'hi' }, st: 0.12, cap: 'n = 90 · sınıflar [alt sınır, üst sınır)' });
        }
      },
      {
        b: 'Çapraz tablo', terim: [['çapraz tablo', 'contingency table'], ['satır yüzdesi', 'row percentage']],
        t: '<p>İki nitel değişken birlikte incelenince <b>çapraz tablo</b> kurulur. 400 kişiye bir ürünü önerip önermeyecekleri soruldu.</p><p>Kadınların “evet” oranı: 60 / 175 = <b>%34,3</b>; erkeklerin: 110 / 225 = <b>%48,9</b>. Satır yüzdeleri grupları adil karşılaştırmayı sağlar.</p>',
        v: function () {
          return V.ust(V.tablo(['Cinsiyet', 'Evet', 'Hayır', 'Toplam'], [['Kadın', '60', '115', '175'], ['Erkek', '110', '115', '225'], ['<b>Toplam</b>', '<b>170</b>', '<b>230</b>', '<b>400</b>']], { n: [1, 2, 3], hi: { '0,1': 'hi', '0,3': 'hc', '1,1': 'hi', '1,3': 'hc' }, st: 0.2 }),
            V.bars({ x: ['Kadın · evet %', 'Erkek · evet %'], y: [60 / 175 * 100, 110 / 225 * 100], max: 60, h: 170, fmt: function (v) { return nf(v, 1); }, renk: [PAL[5], PAL[0]], d: 0.8 }));
        }
      }
    ],
    gorsel: {
      b: 'Frekans tablosu kurucu', t: '40 çalışanın haftalık ücreti ($) için sınıf sayısını değiştir. Sınıf genişliği, frekanslar, birikimli frekanslar ve histogram anında yeniden kurulur.',
      kur: function (el) {
        var r = IST.rng(33), data = []; for (var i = 0; i < 40; i++) data.push(Math.round(180 + (r() + r() + r()) / 3 * 300));
        var mn = Math.min.apply(null, data), mx = Math.max.apply(null, data);
        el.innerHTML = '<div class="at-g"><div class="at-k"><label><span>sınıf sayısı k <output data-ko>6</output></span><input type="range" min="3" max="10" value="6" data-k></label><div class="at-out" style="margin:0"><div><small>en küçük</small><b>' + mn + '</b></div><div><small>en büyük</small><b>' + mx + '</b></div><div><small>genişlik h</small><b data-h></b></div></div><div class="at-not" style="margin:0" data-hf></div></div><div class="at-v"><div data-t></div><div data-g style="margin-top:12px"></div></div></div>';
        var draw = function (k) {
          var h = Math.ceil((mx - mn + 1) / k), e = [], f = [];
          for (var j = 0; j <= k; j++) e.push(mn + j * h);
          for (j = 0; j < k; j++) f.push(data.filter(function (v) { return v >= e[j] && v < e[j + 1]; }).length);
          var F = 0;
          el.querySelector('[data-h]').textContent = h;
          el.querySelector('[data-hf]').innerHTML = 'h = ⌈(maks − min + 1) / k⌉ = ⌈(' + mx + ' − ' + mn + ' + 1) / ' + k + '⌉ = <b>' + h + '</b>. Çok az sınıf ayrıntıyı gizler, çok fazla sınıf ise boş sınıflar üretir; genellikle 5–10 sınıf kullanılır.';
          el.querySelector('[data-t]').innerHTML = V.tablo(['Sınıf', 'f', 'f / n', 'F'], f.map(function (x, j) { F += x; return ['[' + e[j] + ', ' + e[j + 1] + ')', String(x), nf(x / 40, 3, false), String(F)]; }), { n: [1, 2, 3], st: 0.03 });
          el.querySelector('[data-g]').innerHTML = V.hist({ edges: e, y: f, h: 200, xlab: 'haftalık ücret ($)', every: k > 7 ? 2 : 1 });
        };
        el.querySelector('[data-k]').oninput = function () { el.querySelector('[data-ko]').textContent = this.value; draw(+this.value); };
        draw(6);
      }
    },
    sorular: function (r) {
      var out = [];
      var f = KREM.map(function () { return r.int(3, 30); }), n = M.sum(f), ki = r.int(0, 4), pc = f[ki] / n * 100;
      var tab = V.tablo(['Kategori', 'f'], KREM.map(function (k, i) { return [k[0], String(f[i])]; }).concat([['<b>Toplam</b>', '<b>' + n + '</b>']]), { n: [1], st: 0 });
      out.push({ tag: 'tablo okuma', q: '<p>Bir kozmetik firması yeni şampuanı için “Bu ürünü tavsiye ederim” ifadesini ' + n + ' müşteriye sordu.</p><p><b>“' + KREM[ki][0] + '”</b> cevabının yüzdesi kaçtır? (bir ondalık)</p>', g: tab, say: pc, goster: '%' + nf(pc, 1), tol: 0.06, ornek: '32,7',
        ip: 'Yüzde = (f / n) × 100.', cz: ['f = <b>' + f[ki] + '</b>, n = <b>' + n + '</b>.', 'Göreli frekans = ' + f[ki] + ' / ' + n + ' = ' + nf(f[ki] / n, 4) + '.', 'Yüzde = <b>%' + nf(pc, 1) + '</b>.'] });
      var lo = r.step(100, 200, 10), h = r.pick([20, 25, 40, 50]), k = 6, ff = []; for (var i = 0; i < k; i++) ff.push(r.int(2, 18));
      var upto = r.int(2, 4), Fv = M.sum(ff.slice(0, upto + 1)), nn = M.sum(ff);
      var t2 = V.tablo(['Sınıf (TL)', 'f'], ff.map(function (x, j) { return ['[' + (lo + j * h) + ', ' + (lo + (j + 1) * h) + ')', String(x)]; }), { n: [1], st: 0 });
      out.push({ tag: 'tablo okuma', q: '<p>Bir markette ' + nn + ' alışverişin sepet tutarları gruplanmış.</p><p>Sepet tutarı <b>' + (lo + (upto + 1) * h) + ' TL’den az</b> olan kaç alışveriş vardır?</p>', g: t2, say: Fv, goster: String(Fv), tol: 0.01, ornek: '25',
        ip: 'Bu, ' + (lo + (upto + 1) * h) + ' TL’de biten sınıfın birikimli frekansıdır.', cz: ['Üst sınırı ' + (lo + (upto + 1) * h) + ' olan sınıfa kadarki tüm sınıfları topla.', ff.slice(0, upto + 1).join(' + ') + ' = <b>' + Fv + '</b>.'] });
      var mn = r.int(12, 60), k3 = r.pick([5, 6, 7, 8]), mx = mn + r.int(k3 * 8, k3 * 25), w = Math.ceil((mx - mn) / k3);
      out.push({ tag: 'hesap', q: '<p>Bir kargo firmasında günlük teslimat sayıları en az <b>' + mn + '</b>, en çok <b>' + mx + '</b>. Veri <b>' + k3 + ' sınıfa</b> gruplanacak.</p><p>Yaklaşık sınıf genişliği kaçtır? (tam sayıya yukarı yuvarla)</p>', say: w, goster: String(w), tol: 0.01, ornek: '9',
        ip: 'Genişlik ≈ (en büyük − en küçük) / sınıf sayısı; sonra yukarı yuvarla ki son değer de bir sınıfa girsin.', cz: ['Açıklık = ' + mx + ' − ' + mn + ' = <b>' + (mx - mn) + '</b>.', (mx - mn) + ' / ' + k3 + ' = ' + nf((mx - mn) / k3, 2) + '.', 'Yukarı yuvarla: <b>' + w + '</b>.'] });
      var a = r.int(30, 90), b = r.int(60, 140), c = r.int(50, 130), e = r.int(60, 140), gr = r.pick([['Kadın', 'Erkek'], ['Öğrenci', 'Çalışan'], ['Ankara', 'İzmir']]), sor = r.int(0, 1);
      var ct = V.tablo(['Grup', 'Evet', 'Hayır', 'Toplam'], [[gr[0], String(a), String(b), String(a + b)], [gr[1], String(c), String(e), String(c + e)], ['<b>Toplam</b>', String(a + c), String(b + e), String(a + b + c + e)]], { n: [1, 2, 3], st: 0 });
      var yp = sor ? c / (c + e) * 100 : a / (a + b) * 100, ss = sor ? [c, c + e] : [a, a + b];
      out.push({ tag: 'tablo okuma', q: '<p>Bir bankanın mobil uygulamasını “arkadaşına önerir misin?” sorusunun cevapları yandaki çapraz tabloda.</p><p><b>' + gr[sor] + '</b> grubunda “evet” diyenlerin yüzdesi kaçtır? (bir ondalık)</p>', g: ct, say: yp, goster: '%' + nf(yp, 1), tol: 0.06, ornek: '34,3',
        ip: 'Yalnızca ' + gr[sor] + ' satırına bak: evet / satır toplamı.', yanlis: function (v) { return Math.abs(v - ss[0] / (a + b + c + e) * 100) < 0.1 ? 'Genel toplama böldün; soru yalnızca ' + gr[sor] + ' grubunu soruyor (satır yüzdesi).' : 'Payda satır toplamı olmalı.'; },
        cz: ['Satır: ' + gr[sor] + ' → evet = <b>' + ss[0] + '</b>, satır toplamı = <b>' + ss[1] + '</b>.', ss[0] + ' / ' + ss[1] + ' × 100 = <b>%' + nf(yp, 1) + '</b>.'] });
      var hata = r.pick([['Bir market terazisi her tartımda 50 g fazla gösteriyor.', 1], ['Aynı paketi 5 kez tartan çalışan 498, 503, 501, 497, 502 g okuyor; fark terazinin titreşiminden.', 0], ['Anket sorusu “Bu harika ürünü beğendiniz mi?” şeklinde soruluyor.', 1], ['Bir kronometreyi elle başlatan hakemlerin ölçtüğü süreler bazen biraz uzun bazen biraz kısa çıkıyor.', 0]]);
      out.push({ tag: 'senaryo', q: '<p>' + X(hata[0]) + '</p><p>Bu durum hangi ölçme hatasına örnektir?</p>', o: ['Rastgele hata (random error)', 'Sistematik hata (systematic error / bias)'], a: hata[1], n: hata[1] ? 'Ölçümler hep aynı yöne kayıyor; ölçüm sayısını artırmak düzeltmez.' : 'Ölçümler gerçek değerin etrafında iki yöne de saçılıyor.',
        ip: 'Hata hep aynı yönde mi, yoksa iki yöne de mi?', cz: ['Aynı yöne sürekli kayma → sistematik.', 'Rastgele iki yöne saçılma → rastgele.', 'Cevap: <b>' + (hata[1] ? 'sistematik hata' : 'rastgele hata') + '</b>.'] });
      return out;
    }
  });

  /* ======================= 4. HAFTA ======================= */
  var KITA = [['Avrupa', 5], ['Asya', 4], ['Amerika', 3], ['Afrika', 2], ['Okyanusya', 1]];
  var BALIK = [4, 6, 5, 3, 2, 1, 3, 5, 7, 8, 6, 4, 3, 5, 6, 9, 10, 8, 7, 6, 5, 4, 6];
  IST.hafta({
    id: 'g4', no: 4, renk: '#E0A526', tr: 'Verinin grafikle gösterimi', en: 'Graphical Representation',
    sahneler: [
      {
        b: 'Neden grafik? Nokta grafiği', terim: [['nokta grafiği', 'dot plot'], ['dağılımın şekli', 'shape of distribution']],
        t: '<p>İyi bir grafik, tabloda kaybolan <b>şekli</b>, <b>merkezi</b> ve <b>uç değerleri</b> bir bakışta gösterir.</p><p><b>Nokta grafiği</b> küçük veri setleri (≈ 50’den az) için idealdir: her gözlem sayı doğrusunda bir nokta; aynı değerler üst üste biner. Böylece veri zaten sıralanmış olur.</p>',
        v: function () { return V.dots({ v: [17, 19, 12, 12, 20, 20, 14, 16, 12, 17, 20, 14, 13, 14, 17, 14, 16, 22, 14, 17, 9, 18, 11, 18, 14, 15, 12, 17, 13, 16], min: 8, max: 23, h: 250, r: 8, stag: 0.05, xlab: 'günlük müşteri şikâyeti (30 gün)' }); }
      },
      {
        b: 'Sütun grafikleri: basit, yığılmış, gruplanmış', terim: [['sütun grafiği', 'bar chart'], ['yığılmış', 'stacked'], ['gruplanmış', 'clustered']],
        t: '<p><b>Basit sütun grafiği</b> tek bir nitel değişkenin frekanslarını gösterir; sütunlar arasında boşluk bırakılır.</p><p>İki nitel değişken için: <b>yığılmış</b> sütunlarda alt gruplar üst üste (toplamı görürsün), <b>gruplanmış</b> sütunlarda yan yana (alt grupları karşılaştırırsın). Örnek: cinsiyete göre “öneririm” cevapları.</p>',
        v: function () {
          var s = '', ys = V.sc(0, 240, 250, 30);
          s += V.axes({}, 40, 520, 250, 30, 240, function (v) { return nf(v, 0); }, 4);
          [[60, 115], [110, 115]].forEach(function (p, i) {
            var x = 70 + i * 110;
            s += '<rect class="gy" ' + d(0.1 + i * 0.2) + ' x="' + x + '" y="' + ys(p[0]) + '" width="70" height="' + (250 - ys(p[0])) + '" fill="' + PAL[2] + '" stroke="#0D1838"/>';
            s += '<rect class="gy" ' + d(0.5 + i * 0.2) + ' x="' + x + '" y="' + ys(p[0] + p[1]) + '" width="70" height="' + (ys(p[0]) - ys(p[0] + p[1])) + '" fill="' + PAL[1] + '" stroke="#0D1838"/>';
            s += '<text class="lbl" x="' + (x + 35) + '" y="268" text-anchor="middle">' + ['Kadın', 'Erkek'][i] + '</text>';
            var gx = 320 + i * 110;
            s += '<rect class="gy" ' + d(1.1 + i * 0.2) + ' x="' + gx + '" y="' + ys(p[0]) + '" width="38" height="' + (250 - ys(p[0])) + '" fill="' + PAL[2] + '" stroke="#0D1838"/>';
            s += '<rect class="gy" ' + d(1.2 + i * 0.2) + ' x="' + (gx + 40) + '" y="' + ys(p[1]) + '" width="38" height="' + (250 - ys(p[1])) + '" fill="' + PAL[1] + '" stroke="#0D1838"/>';
            s += '<text class="lbl" x="' + (gx + 39) + '" y="268" text-anchor="middle">' + ['Kadın', 'Erkek'][i] + '</text>';
          });
          s += '<text class="lbb" x="140" y="20" text-anchor="middle">yığılmış</text><text class="lbb" x="410" y="20" text-anchor="middle">gruplanmış</text>';
          s += '<g class="fd" ' + d(1.6) + '><rect x="200" y="282" width="12" height="12" fill="' + PAL[2] + '"/><text class="lbl" x="216" y="292">evet</text><rect x="260" y="282" width="12" height="12" fill="' + PAL[1] + '"/><text class="lbl" x="276" y="292">hayır</text></g>';
          return V.svg(540, 300, s, 'yığılmış ve gruplanmış sütun grafiği');
        }
      },
      {
        b: 'Histogram ve frekans poligonu', terim: [['histogram', 'histogram'], ['frekans poligonu', 'frequency polygon'], ['sınıf orta noktası', 'class midpoint']],
        t: '<p><b>Histogram</b> sayısal (sürekli) veri içindir: sütunlar <b>bitişiktir</b> çünkü sınıflar kesintisiz bir sayı doğrusunu böler.</p><p><b>Frekans poligonu</b> sütun tepelerinin orta noktalarını birleştirir; iki ucu bir önceki ve sonraki boş sınıfın ortasında eksene iner. İki dağılımı üst üste karşılaştırmak için kullanışlıdır.</p>',
        v: function () { return V.hist({ edges: [120, 172, 224, 276, 328, 380, 432, 484, 536, 588], y: MAAS.map(function (m) { return m[1]; }), h: 270, poly: true, xlab: 'haftalık ücret ($) · n = 90', every: 1 }); }
      },
      {
        b: 'Pasta grafiği: dilim açısı', terim: [['pasta grafiği', 'pie chart'], ['merkez açı', 'central angle']],
        t: '<p>15 kişinin en son ziyaret ettiği kıta. Her dilimin açısı: <b>açı = (f / n) × 360°</b>.</p><p>Avrupa: 5 / 15 × 360° = <b>120°</b>. Pasta grafiği bir bütünün parçalarını gösterir; çok kategori varsa okunması zorlaşır, o zaman sütun grafiği tercih edilir.</p>',
        v: function () { return V.ust(V.pie({ v: KITA.map(function (k) { return k[1]; }), l: KITA.map(function (k) { return k[0]; }), h: 270 }), V.fx([{ s: 'Avrupa', h: '5 / 15 × 360° = <b>120°</b>' }], 1.4)); }
      },
      {
        b: 'Çizgi grafiği', terim: [['çizgi grafiği', 'line chart'], ['eğilim', 'trend']],
        t: '<p><b>Çizgi grafiği</b> zaman serisi içindir: yatay eksen zaman, dikey eksen değişken. Noktaları birleştiren çizgi <b>eğilimi</b> (trend) ve <b>mevsimselliği</b> gösterir.</p><p>Örnek: bir dondurma üreticisinin aylık satışları yazın zirve yapıyor.</p>',
        v: function () { return V.xy({ x: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], y: [12, 14, 20, 28, 40, 55, 62, 60, 42, 26, 16, 13], line: true, h: 270, xt: [[1, 'Oca'], [3, 'Mar'], [5, 'May'], [7, 'Tem'], [9, 'Eyl'], [11, 'Kas']], ylab: 'satış (bin adet)', renk: PAL[1] }); }
      },
      {
        b: 'Serpilme grafiği: iki sayısal değişken', terim: [['serpilme grafiği', 'scatter plot'], ['ilişki', 'relationship']],
        t: '<p><b>Serpilme grafiği</b> iki nicel değişken arasındaki ilişkiyi gösterir. Balıkesir’de 1–23 Ocak arası günlük sıcaklıklar: x ekseni gün, y ekseni sıcaklık.</p><p>Noktalar sağa doğru yükseliyorsa <b>pozitif</b>, iniyorsa <b>negatif</b> ilişki; belirli bir yön yoksa <b>ilişki yok</b>.</p>',
        v: function () { return V.xy({ x: BALIK.map(function (_, i) { return i + 1; }), y: BALIK, h: 270, stag: 0.06, xt: [[1, '1'], [5, '5'], [10, '10'], [15, '15'], [20, '20'], [23, '23']], xlab: 'gün (Ocak)', ylab: 'sıcaklık (°C)', ymax: 12, renk: PAL[4] }); }
      }
    ],
    gorsel: {
      b: 'Doğru grafiği seç', t: 'Bir veri seti seç, sonra grafik türlerini dene. Grafik hemen çizilir; altında bu veri için uygun olup olmadığı yazar.',
      kur: function (el) {
        var DS = {
          kan: { ad: 'Kan grupları (500 kişi)', tur: 'nitel', l: ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', '0+', '0−'], v: [190, 20, 70, 10, 35, 5, 150, 20], iyi: ['sutun', 'pasta'] },
          ay: { ad: 'Aylık satışlar (12 ay)', tur: 'zaman', l: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'], v: [12, 14, 20, 28, 40, 55, 62, 60, 42, 26, 16, 13], iyi: ['cizgi', 'sutun'] },
          hud: { ad: 'Hudson parça maliyetleri (50)', tur: 'sürekli', v: HUDSON, iyi: ['hist'] },
          rek: { ad: 'Reklam (bin TL) ve satış (bin adet)', tur: 'ikili', x: [5, 8, 10, 12, 15, 18, 20, 24, 27, 30], v: [22, 25, 31, 30, 38, 41, 47, 49, 55, 58], iyi: ['serp'] }
        };
        var GT = [['sutun', 'sütun'], ['pasta', 'pasta'], ['cizgi', 'çizgi'], ['hist', 'histogram'], ['serp', 'serpilme']];
        var NED = {
          sutun: { nitel: 'Kategorilerin frekanslarını karşılaştırmak için ideal.', zaman: 'Olur ama eğilimi çizgi daha iyi gösterir.', 'sürekli': 'Her farklı değer ayrı sütun olur; sürekli veride önce sınıflara ayırıp histogram çiz.', ikili: 'İki sayısal değişkenin ilişkisi sütunla görünmez.' },
          pasta: { nitel: 'Bütünün parçaları; 8 dilimde okumak zorlaşıyor, küçük dilimler kayboluyor.', zaman: 'Aylar bir bütünün parçası değil; sıra/eğilim kaybolur.', 'sürekli': 'Sayısal dağılım pastayla gösterilmez.', ikili: 'İlişki pastayla gösterilemez.' },
          cizgi: { nitel: 'Kategoriler arasında doğal bir sıra yok; çizgi yanıltıcı bir eğilim çizer.', zaman: 'Zaman serisinde eğilim ve mevsimselliği en iyi bu gösterir.', 'sürekli': 'Gözlem sırası anlamsız; çizgi bir şey anlatmaz.', ikili: 'Noktaları birleştirmek ilişki için gereksiz; serpilme yeter.' },
          hist: { nitel: 'Histogram sayısal veri içindir; kategorilerde sütun grafiği kullan.', zaman: 'Zaman sırası kaybolur.', 'sürekli': 'Sürekli verinin şeklini (çarpıklık, tepe) en iyi bu gösterir.', ikili: 'Tek değişkenin dağılımını gösterir; ilişkiyi göstermez.' },
          serp: { nitel: 'Serpilme için iki sayısal değişken gerekir.', zaman: 'Olur (zaman–değer), ama çizgi grafiği daha okunaklı.', 'sürekli': 'Tek değişken var; ikinci eksen yok.', ikili: 'İki nicel değişkenin ilişkisini en iyi bu gösterir: pozitif ilişki.' }
        };
        var ds = 'kan', gt = 'sutun';
        el.innerHTML = '<div class="at-g"><div class="at-k"><b style="font-size:13px">1 · veri seti</b><div class="seg" data-ds>' + Object.keys(DS).map(function (k) { return '<button type="button" data-k="' + k + '" aria-pressed="' + (k === ds) + '">' + DS[k].ad + '</button>'; }).join('') + '</div><b style="font-size:13px">2 · grafik türü</b><div class="seg" data-gt>' + GT.map(function (g) { return '<button type="button" data-k="' + g[0] + '" aria-pressed="' + (g[0] === gt) + '">' + g[1] + '</button>'; }).join('') + '</div></div><div class="at-v"><div data-c></div><div class="at-not" data-n></div></div></div>';
        var draw = function () {
          var D = DS[ds], h = '';
          if (gt === 'sutun') h = D.l ? V.bars({ x: D.l, y: D.v, h: 280, fmt: function (v) { return nf(v, 0); } }) : D.x ? V.bars({ x: D.x.map(String), y: D.v, h: 280, fmt: function (v) { return nf(v, 0); } }) : V.bars({ x: D.v.slice(0, 50).map(String), y: D.v.map(function () { return 1; }), h: 280, val: false, max: 2 });
          else if (gt === 'pasta') h = V.pie({ v: D.v.slice(0, D.l ? 12 : 10), l: (D.l || D.v.map(String)).slice(0, 12), h: 300 });
          else if (gt === 'cizgi') h = V.xy({ x: (D.x || D.v.map(function (_, i) { return i + 1; })), y: D.v, line: true, h: 280, xt: D.l && D.tur === 'zaman' ? [[1, 'Oca'], [4, 'Nis'], [7, 'Tem'], [10, 'Eki']] : [] });
          else if (gt === 'hist') { var e = [50, 60, 70, 80, 90, 100, 110], vals = D.tur === 'sürekli' ? D.v : D.v; var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), st = V.nice((mx - mn) / 6); e = []; for (var a = Math.floor(mn / st) * st; a <= mx + st; a += st) e.push(a); var y = e.slice(0, -1).map(function (lo, i) { return vals.filter(function (v) { return v >= lo && v < e[i + 1]; }).length; }); h = V.hist({ edges: e, y: y, h: 280, xlab: D.tur === 'nitel' ? 'frekanslar (kategori adları kayboldu!)' : '' }); }
          else h = D.x ? V.xy({ x: D.x, y: D.v, h: 280, xlab: 'reklam (bin TL)', ylab: 'satış (bin adet)' }) : V.xy({ x: D.v.map(function (_, i) { return i + 1; }), y: D.v, h: 280, xlab: 'gözlem sırası' });
          el.querySelector('[data-c]').innerHTML = h;
          var iyi = D.iyi.indexOf(gt) === 0, olur = D.iyi.indexOf(gt) > 0;
          el.querySelector('[data-n]').innerHTML = (iyi ? '✅ <b>En uygun seçim.</b> ' : olur ? '🟡 <b>Olur, ama en iyisi değil.</b> ' : '❌ <b>Bu veri için uygun değil.</b> ') + NED[gt][D.tur];
        };
        var bind = function (sel, set) { [].forEach.call(el.querySelectorAll(sel + ' [data-k]'), function (b) { b.onclick = function () { [].forEach.call(el.querySelectorAll(sel + ' [data-k]'), function (x) { x.setAttribute('aria-pressed', String(x === b)); }); set(b.getAttribute('data-k')); draw(); }; }); };
        bind('[data-ds]', function (k) { ds = k; }); bind('[data-gt]', function (k) { gt = k; });
        draw();
      }
    },
    sorular: function (r) {
      var out = [];
      var kat = r.pick([['Hafta içi', 'Cumartesi', 'Pazar'], ['Kredi kartı', 'Nakit', 'Mobil ödeme', 'Havale'], ['Kahve', 'Çay', 'Meyve suyu', 'Su']]);
      var fv = kat.map(function () { return r.int(2, 12); }), n = M.sum(fv), ki = r.int(0, kat.length - 1), ang = fv[ki] / n * 360;
      out.push({ tag: 'hesap', q: '<p>Bir kafede ' + n + ' siparişin dağılımı yanda. Pasta grafiğinde <b>“' + kat[ki] + '”</b> diliminin merkez açısı kaç derece olur? (bir ondalık)</p>', g: V.tablo(['Kategori', 'f'], kat.map(function (k, i) { return [k, String(fv[i])]; }), { n: [1], st: 0 }), say: ang, goster: nf(ang, 1) + '°', tol: 0.06, ornek: '120',
        ip: 'Açı = (f / n) × 360°.', cz: ['f = ' + fv[ki] + ', n = ' + n + '.', '(' + fv[ki] + ' / ' + n + ') × 360° = <b>' + nf(ang, 1) + '°</b>.'] });
      var g1 = [], g2 = [], lab = ['Oca', 'Şub', 'Mar', 'Nis'];
      for (var i = 0; i < 4; i++) { g1.push(r.int(2, 9) * 10); g2.push(r.int(2, 9) * 10); }
      var ai = r.int(0, 3), s = '', mxv = 100, ys = V.sc(0, mxv, 220, 20);
      s += V.axes({}, 40, 500, 220, 20, mxv, function (v) { return nf(v, 0); }, 10);
      lab.forEach(function (l, j) { var x = 70 + j * 110; s += '<rect x="' + x + '" y="' + ys(g1[j]) + '" width="36" height="' + (220 - ys(g1[j])) + '" fill="' + PAL[0] + '" stroke="#0D1838"/><rect x="' + (x + 38) + '" y="' + ys(g2[j]) + '" width="36" height="' + (220 - ys(g2[j])) + '" fill="' + PAL[3] + '" stroke="#0D1838"/><text class="lbl" x="' + (x + 37) + '" y="238" text-anchor="middle">' + l + '</text>'; });
      s += '<rect x="170" y="248" width="12" height="12" fill="' + PAL[0] + '"/><text class="lbl" x="186" y="258">Şube A</text><rect x="260" y="248" width="12" height="12" fill="' + PAL[3] + '"/><text class="lbl" x="276" y="258">Şube B</text>';
      var df = Math.abs(g1[ai] - g2[ai]);
      out.push({ tag: 'grafik okuma', q: '<p>Gruplanmış sütun grafiği iki şubenin aylık yeni müşteri sayılarını gösteriyor (ızgara çizgileri 10’ar artar).</p><p><b>' + lab[ai] + '</b> ayında iki şube arasındaki fark kaç müşteridir?</p>', g: V.svg(510, 266, s, 'iki şubenin aylık müşteri sayıları'), say: df, goster: String(df), tol: 0.01, ornek: '20',
        ip: lab[ai] + ' ayındaki iki sütunun tepesini ızgara çizgileriyle oku, büyükten küçüğü çıkar.', cz: ['Şube A, ' + lab[ai] + ': <b>' + g1[ai] + '</b>.', 'Şube B, ' + lab[ai] + ': <b>' + g2[ai] + '</b>.', 'Fark = <b>' + df + '</b>.'] });
      var e = [0, 10, 20, 30, 40, 50], hy = e.slice(0, -1).map(function () { return r.int(2, 14); }), cut = r.pick([20, 30, 40]), below = M.sum(hy.slice(0, cut / 10));
      out.push({ tag: 'grafik okuma', q: '<p>Histogram bir kütüphanede ödünç alınan kitapların kaç günde iade edildiğini gösteriyor.</p><p>Kaç kitap <b>' + cut + ' günden önce</b> iade edilmiştir?</p>', g: V.hist({ edges: e, y: hy, h: 220, xlab: 'iade süresi (gün)' }), say: below, goster: String(below), tol: 0.01, ornek: '25',
        ip: cut + '’dan önce biten tüm sütunların yüksekliklerini topla.', cz: ['[0,10)' + (cut > 10 ? ', [10,20)' : '') + (cut > 20 ? ', [20,30)' : '') + (cut > 30 ? ', [30,40)' : '') + ' sınıfları.', hy.slice(0, cut / 10).join(' + ') + ' = <b>' + below + '</b>.'] });
      var GS = ['Sütun grafiği', 'Pasta grafiği', 'Çizgi grafiği', 'Histogram', 'Serpilme grafiği'];
      var sc = r.pick([['Bir şirket son 36 ayın aylık ciro eğilimini yönetim kuruluna göstermek istiyor.', 2], ['Bir araştırmacı 200 öğrencinin günlük ekran süresinin (dakika) dağılım şeklini görmek istiyor.', 3], ['Pazarlama ekibi reklam bütçesi ile satış miktarı arasında ilişki olup olmadığını görmek istiyor.', 4], ['Bir anket, katılımcıların tercih ettiği 4 telefon markasının frekanslarını karşılaştırıyor.', 0], ['Bir belediye bütçesinin harcama kalemlerine göre bütünün içindeki paylarını göstermek istiyor.', 1]]);
      out.push({ tag: 'senaryo', q: '<p>' + X(sc[0]) + '</p><p>En uygun grafik hangisidir?</p>', o: GS, a: sc[1], n: ['Nitel değişkenin kategori frekansları karşılaştırılır.', 'Bütünün parçaları gösterilir.', 'Zaman serisinde eğilim görünür.', 'Sürekli sayısal verinin şekli görünür.', 'İki nicel değişkenin ilişkisi görünür.'][sc[1]],
        ip: 'Kaç değişken var? Nitel mi, nicel mi? Zaman var mı?', cz: ['Değişken türünü belirle.', ['Tek nitel değişken → sütun.', 'Bütünün payları → pasta.', 'Zamana göre değişim → çizgi.', 'Tek sürekli değişkenin dağılımı → histogram.', 'İki nicel değişken → serpilme.'][sc[1]], 'Cevap: <b>' + GS[sc[1]] + '</b>.'] });
      var yon = r.int(0, 2), xs = [], ysv = [];
      for (i = 0; i < 14; i++) { var x = r.int(1, 30); xs.push(x); ysv.push(Math.max(1, Math.round(yon === 0 ? 10 + x * 1.4 + (r() - 0.5) * 12 : yon === 1 ? 55 - x * 1.4 + (r() - 0.5) * 12 : 15 + r() * 40))); }
      out.push({ tag: 'grafik okuma', q: '<p>Serpilme grafiği ' + ['bir mağazanın günlük ziyaretçi sayısı ile satışları', 'bir ürünün fiyatı ile satış adedi', 'çalışanların ayakkabı numarası ile performans puanı'][yon] + ' arasındaki ilişkiyi gösteriyor.</p><p>Grafiğe göre ilişki nasıldır?</p>', g: V.xy({ x: xs, y: ysv, h: 230, ymax: 70, xmin: 0, xmax: 31 }), o: ['Pozitif ilişki', 'Negatif ilişki', 'Belirgin ilişki yok'], a: yon,
        n: ['x arttıkça y de artıyor.', 'x arttıkça y azalıyor.', 'Noktalar belirli bir yön izlemiyor.'][yon], ip: 'Soldan sağa giderken noktalar genel olarak yükseliyor mu, alçalıyor mu?', cz: ['Noktaların genel eğilimine bak (tek tek noktalara değil).', 'Cevap: <b>' + ['pozitif', 'negatif', 'ilişki yok'][yon] + '</b>.'] });
      return out;
    }
  });
})();
