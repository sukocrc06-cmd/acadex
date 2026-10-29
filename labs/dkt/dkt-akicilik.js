/* ==========================================================================
   ACADEX DKT LAB · AKICILIK MASASI (labs/dkt/dkt-akicilik.js), 29.10.2026
   Konuşma örneğinde akıcısızlık işaretleme, %TH (takılmalı hece yüzdesi)
   hesabı, cevap anahtarıyla karşılaştırma; hece hızı ayarlayıcı (şekillendirme).
   ========================================================================== */
(function () {
  'use strict';
  var DK = window.DK, C = DK.core, V = C.V, $ = C.$, $$ = C.$$, X = C.X, tr = C.tr;
  var MC = { ses: '#E0705A', soz: '#5B3FA0', uzatma: '#2457C5', blok: '#0D1838', ara: '#B9821F', rev: '#1F7A5C', obek: '#B4602F' };
  var KISA = { ses: 'ST', soz: 'ST', uzatma: 'UZ', blok: 'BL', ara: 'AR', rev: 'DÜ', obek: 'ÖT' };
  var TIP = {}; V.TIP.forEach(function (t) { TIP[t[0]] = t; });
  var S = { o: C.ls.get('ak.o', V.ORNEK[0].id), tip: 'ses', marks: C.ls.get('ak.m', {}), checked: false, pc: null };
  var ornek = function () { return V.ORNEK.filter(function (o) { return o.id === S.o; })[0] || V.ORNEK[0]; };
  var mk = function () { return S.marks[S.o] || (S.marks[S.o] = {}); };
  var save = function () { C.ls.set('ak.m', S.marks); };
  var heceTop = function (o) { return o.toks.reduce(function (a, t) { return a + V.hece(t[2] !== undefined ? t[2] : t[0]); }, 0); };
  var isKO = function (k) { return !!(TIP[k] && TIP[k][2]); };

  var paintPal = function () {
    $('#ak-pal').innerHTML = V.TIP.map(function (t) { return '<button type="button" data-tp="' + t[0] + '" aria-pressed="' + (t[0] === S.tip) + '" style="--mc:' + MC[t[0]] + '"><i></i>' + X(t[1]) + ' <small>' + X(t[3]) + '</small></button>'; }).join('');
  };
  var paintTxt = function () {
    var o = ornek(), m = mk();
    $('#ak-t').textContent = o.t; $('#ak-kim').textContent = o.kim;
    $('#ak-txt').innerHTML = o.toks.map(function (t, i) {
      var k = m[i], cls = 'tok';
      if (S.checked) { var key = t[1] || null; if (key && k === key) cls += ' res-ok'; else if (k && k !== key) cls += ' res-no'; else if (key && !k) cls += ' res-miss'; }
      return '<button type="button" class="' + cls + '" data-i="' + i + '"' + (k ? ' data-m="' + k + '" style="--mc:' + MC[k] + '"' : '') + ' aria-label="' + X(t[0]) + (k ? ', işaretli: ' + TIP[k][1] : '') + '">' + X(t[0]) + (k ? '<sup>' + KISA[k] + '</sup>' : '') + '</button>';
    }).join(' ');
    paintCnt();
  };
  var paintCnt = function () {
    var o = ornek(), m = mk(), n = heceTop(o), sl = 0, ot = 0;
    Object.keys(m).forEach(function (i) { if (isKO(m[i])) sl++; else ot++; });
    $('#ak-cnt').innerHTML = '<div>toplam hece<b>' + n + '</b></div><div>kekemeliğe özgü<b>' + sl + '</b></div><div>%TH (senin)<b>' + tr(n ? sl / n * 100 : 0, 1) + '</b></div>';
  };
  var check = function () {
    var o = ornek(), m = mk(), n = heceTop(o), ok = 0, keyN = 0, wrong = [], miss = [], keySl = 0;
    o.toks.forEach(function (t, i) {
      var key = t[1] || null, k = m[i] || null;
      if (key) { keyN++; if (isKO(key)) keySl++; }
      if (key && k === key) ok++;
      else if (key && !k) miss.push('<b>' + X(t[0]) + '</b> (' + X(TIP[key][1]) + ')');
      else if (k) wrong.push('<b>' + X(t[0]) + '</b>: ' + (key ? X(TIP[k][1]) + ' değil, ' + X(TIP[key][1]) : 'akıcı, işaret gerekmez'));
    });
    var pct = keyN ? ok / (keyN + wrong.filter(function () { return true; }).length) * 100 : 0;
    var mySl = Object.keys(m).filter(function (i) { return isKO(m[i]); }).length;
    S.checked = true; paintTxt();
    var items = [[ok === keyN, 'Doğru işaretlenen: ' + ok + ' / ' + keyN]];
    if (miss.length) items.push([false, 'Kaçırılan: ' + miss.join(', ')]);
    if (wrong.length) items.push([false, 'Yanlış: ' + wrong.join('; ')]);
    items.push([Math.abs(mySl - keySl) < 0.5, '%TH: senin ' + tr(n ? mySl / n * 100 : 0, 1) + ', anahtar ' + tr(n ? keySl / n * 100 : 0, 1) + ' (' + keySl + ' kekemeliğe özgü / ' + n + ' hece)']);
    $('#ak-karne').innerHTML = C.karne(pct, o.t + ' · değerlendirme', items, 'Yeşil: doğru · kırmızı: yanlış tür ya da gereksiz işaret · sarı kesik çizgi: kaçırılan. Ara söz, düzeltme ve öbek tekrarı da işaretlenir ama %TH\'ye katılmaz.');
    DK.bridgeSend();
  };

  /* ---------- hece hızı ayarlayıcı ---------- */
  var METIN = 'Bu sabah erkenden kalktım. Pencereyi açtım ve derin bir nefes aldım. Kahvaltıdan sonra yavaşça okula yürüdüm. Yolda arkadaşımla karşılaştım ve birlikte sohbet ettik.';
  var VOW = /[aeıioöuüâîû]/i;
  var heceler = function (w) {
    var L = w.toLocaleLowerCase('tr'), v = [], i;
    for (i = 0; i < L.length; i++) if (VOW.test(L[i])) v.push(i);
    if (v.length < 2) return [w];
    var cut = [];
    for (i = 0; i < v.length - 1; i++) {
      var k = 0; for (var j = v[i] + 1; j < v[i + 1]; j++) if (/[a-zçğışöü]/i.test(L[j])) k++;
      cut.push(k === 0 ? v[i + 1] : v[i + 1] - 1);
    }
    var out = [], st = 0; cut.forEach(function (c) { out.push(w.slice(st, c)); st = c; }); out.push(w.slice(st));
    return out;
  };
  var SYL = []; METIN.split(/\s+/).forEach(function (w, wi) { heceler(w).forEach(function (h, i, a) { SYL.push({ h: h, end: i === a.length - 1, w: wi }); }); });
  var pcStop = function () { if (S.pc) { clearInterval(S.pc.iv); S.pc = null; } $('#pc-go').textContent = 'Başlat'; };
  var pcStart = function () {
    pcStop(); var spm = +$('#pc-r').value, i = 0, trail = [];
    S.pc = { iv: setInterval(function () {
      if (i >= SYL.length) { pcStop(); $('#pc-syl').textContent = 'bitti'; return; }
      var s = SYL[i++], el = $('#pc-syl'); el.textContent = s.h; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
      trail.push(s.h + (s.end ? ' ' : '-')); $('#pc-tr').textContent = trail.join('').slice(-60);
    }, 60000 / spm) };
    $('#pc-go').textContent = 'Durdur';
  };

  DK.st.akicilik = {
    init: function () {
      $('#ak-ornek').innerHTML = V.ORNEK.map(function (o) { return '<button type="button" data-o="' + o.id + '" aria-pressed="' + (o.id === S.o) + '">' + X(o.t) + '</button>'; }).join('');
      paintPal(); paintTxt();
      $('#ak-ornek').addEventListener('click', function (e) { var b = e.target.closest('[data-o]'); if (!b) return; S.o = b.getAttribute('data-o'); S.checked = false; $('#ak-karne').innerHTML = ''; C.ls.set('ak.o', S.o); $$('#ak-ornek [data-o]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); paintTxt(); DK.bridgeSend(); });
      $('#ak-pal').addEventListener('click', function (e) { var b = e.target.closest('[data-tp]'); if (!b) return; S.tip = b.getAttribute('data-tp'); paintPal(); });
      $('#ak-txt').addEventListener('click', function (e) {
        var b = e.target.closest('[data-i]'); if (!b) return;
        var i = b.getAttribute('data-i'), m = mk();
        if (m[i] === S.tip) delete m[i]; else m[i] = S.tip;
        S.checked = false; $('#ak-karne').innerHTML = ''; save(); paintTxt(); C.live(m[i] ? TIP[S.tip][1] + ' işaretlendi' : 'işaret kaldırıldı'); DK.bridgeSend();
      });
      $('#ak-chk').addEventListener('click', check);
      $('#ak-clr').addEventListener('click', function () { S.marks[S.o] = {}; S.checked = false; $('#ak-karne').innerHTML = ''; save(); paintTxt(); });
      $('#pc-r').addEventListener('input', function () { $('#pc-v').textContent = this.value + ' hece/dk'; if (S.pc) pcStart(); });
      $('#pc-go').addEventListener('click', function () { if (S.pc) pcStop(); else pcStart(); });
    },
    hide: function () { pcStop(); },
    ctx: function () {
      var o = ornek(), m = mk(), n = heceTop(o), sl = Object.keys(m).filter(function (i) { return isKO(m[i]); }).length;
      return { sel: { key: 'dkt.ak.' + o.id, title: 'Akıcılık · ' + o.t, la: 'Akıcılık', rows: [['Örnek', o.kim], ['Toplam hece', String(n)], ['İşaretlenen kekemeliğe özgü', String(sl)], ['Seçili tür', TIP[S.tip][1]]],
          about: 'öğrenci DKT Lab akıcılık masasında kurgusal bir konuşma örneğinde akıcısızlıkları işaretleyip %TH hesaplıyor. Cevap anahtarını doğrudan söyleme; türleri ayırt etmeyi öğret.' },
        chips: [['ayir', 'Tekrar ile öbek tekrarı nasıl ayrılır?'], ['blok', 'Blok nasıl anlaşılır?'], ['pct', '%TH nasıl hesaplanır?']] };
    },
    classify: function (q) { if (/öbek|ayr/.test(q)) return 'ayir'; if (/blok/.test(q)) return 'blok'; if (/%th|yüzde|hesap/.test(q)) return 'pct'; return null; },
    answer: function (k) {
      if (k === 'ayir') return 'Ses/hece tekrarında sözcüğün bir parçası tekrarlanır (b-b-bugün). Tek heceli sözcük tekrarında sözcüğün tamamı (ben ben ben) tekrarlanır; ikisi de kekemeliğe özgüdür. Öbek tekrarında birden çok sözcük ya da çok heceli bir sözcük tekrarlanır (eve dönerken, eve dönerken); bu herkeste görülen bir akıcısızlıktır ve %TH\'ye katılmaz.';
      if (k === 'blok') return 'Blokta ses akışı durur: ağız konumu alınmış ama ses çıkmaz, gerilimli bir sessizlik olur; çoğunlukla göz kırpma, yüzde gerginlik gibi eşlik eden davranışlar görülür. Yazıya dökülmüş örnekte ‖ işaretiyle gösterildi.';
      if (k === 'pct') { var o = ornek(); return '%TH = kekemeliğe özgü akıcısızlık sayısı ÷ toplam hece × 100. Bu örnekte toplam hece ' + heceTop(o) + '. Tekrarlanan fazladan heceler ve ara sözler toplam heceye eklenmez; her takılma bir kez sayılır.'; }
      return null;
    }
  };
})();
