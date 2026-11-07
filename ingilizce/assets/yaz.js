/* ==========================================================================
   ACADEX ENGLISH · yazma masası (assets/yaz.js), 07.11.2026
   Görev kütüphanesi (kategori × seviye × tür; banka → havuz), canlı yazım göstergeleri,
   kırmızı kalem değerlendirme (yerel kurallar + isteğe bağlı yapay zekâ, IELTS dört ölçüt
   tahmini band), taslak → son sürüm kaydırıcısı, defter / daktilo yazımı, günlük,
   cümle inşaatı ve paraphrase atölyesi.
   Depo: ACX.ls 'yaz' { v, sev, kat, tur, gor{}, taslak{id:metin}, gecmis[], gunluk{gün:{soru,metin}}, insa, mod, ses }
         'yazEk' (havuzdan gelen görevler, en çok 40)
   ========================================================================== */
(function () {
  'use strict';
  var W = window, D = W.document;
  var P = 'writing';
  var SEV = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  var BAGLAC = ['however', 'therefore', 'moreover', 'furthermore', 'in addition', 'although', 'though', 'because', 'since', 'as a result', 'consequently', 'for example', 'for instance', 'on the other hand', 'in contrast', 'whereas', 'while', 'firstly', 'secondly', 'finally', 'in conclusion', 'to conclude', 'overall', 'despite', 'nevertheless', 'otherwise', 'instead', 'similarly', 'in fact', 'as well as', 'not only', 'unless', 'so that', 'such as', 'on balance', 'admittedly'];
  var ISLEV = 'a an the of to in on at for from by with and or but so if as is are was were be been am do does did has have had it its this that these those there their they them he she we you i me my your our his her not no can could will would should may might must than then into up out about over just very also more most some any all many much one two'.split(' ');
  var KARMASIK = /\b(which|who|whom|whose|that|because|although|though|while|whereas|if|unless|when|since|so that|not only|despite|having)\b/i;

  /* ------------------------------------------------------------ saf yardımcılar (testli) */
  function cumleler(t) { return (String(t || '').replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+["”’)]*|[^.!?]+$/g) || []).map(function (c) { return c.trim(); }).filter(function (c) { return /[A-Za-z]/.test(c); }); }   /* lookbehind yok: eski Safari */
  function kelimeler(t) { return (String(t || '').toLowerCase().replace(/[’‘]/g, "'").match(/[a-z][a-z'\-]*/g) || []); }
  function olcum(t, zor) {
    var k = kelimeler(t), cs = cumleler(t), low = ' ' + k.join(' ') + ' ', say = {};
    k.forEach(function (w) { if (w.length > 3 && ISLEV.indexOf(w) < 0) say[w] = (say[w] || 0) + 1; });
    var tekrar = Object.keys(say).filter(function (w) { return say[w] >= 3; }).sort(function (a, b) { return say[b] - say[a]; }).map(function (w) { return { w: w, n: say[w] }; });
    var ust = []; if (zor) k.forEach(function (w) { if (zor[w] && ust.indexOf(w) < 0) ust.push(w); });
    var uz = cs.map(function (c) { return kelimeler(c).length; });
    return { kelime: k.length, cumle: cs.length, ort: uz.length ? Math.round(uz.reduce(function (a, b) { return a + b; }, 0) / uz.length * 10) / 10 : 0, cumleUz: uz,
      baglac: BAGLAC.filter(function (b) { return low.indexOf(' ' + b + ' ') >= 0; }), tekrar: tekrar, ust: ust,
      paragraf: String(t || '').split(/\n\s*\n/).filter(function (p) { return p.trim(); }).length || (k.length ? 1 : 0),
      cesit: k.length ? Math.round(new Set(k).size / k.length * 100) / 100 : 0, karmasik: cs.filter(function (c) { return KARMASIK.test(c); }).length };
  }

  /* kırmızı kalem: Türk öğrencilerin sık yaptığı, yanlış alarmı düşük hatalar */
  var KURAL = [
    { re: /\bi\b(?!\.)/g, tur: 'yazim', oneri: function () { return 'I'; }, not: '“I” her zaman büyük harf.' },
    { re: /\bI am (agree|disagree)\b/gi, tur: 'gramer', oneri: function (m) { return 'I ' + m[1].toLowerCase(); }, not: '“agree” fiildir: “I am agree” değil, “I agree”.' },
    { re: /\b(people|children|police|students|teachers|lecturers|parents|universities|companies|families|employees|tourists) (is|was|has)\b/gi, tur: 'gramer', oneri: function (m) { return m[1] + ' ' + ({ is: 'are', was: 'were', has: 'have' })[m[2].toLowerCase()]; }, not: 'Çoğul isim: fiil de çoğul.' },
    { re: /\b(they|we|you) (has|was|is|does)\b/gi, tur: 'gramer', oneri: function (m) { return m[1] + ' ' + ({ has: 'have', was: 'were', is: 'are', does: 'do' })[m[2].toLowerCase()]; }, not: 'They / we / you ile çoğul fiil.' },
    { re: /\ban (uni\w*|use\w*|usu\w*|eu\w*|one\b)/gi, tur: 'gramer', kosul: function (m) { return !/\w$/.test(m.input.slice(0, m.index)); }, oneri: function (m) { return 'a ' + m[1]; }, not: '“university, useful, one” “yu / va” sesiyle başlar: “a”.' },
    { re: /\b(he|she|it) (have|do|go|want|like|need|make|say|think|know|live|work|study)\b/gi, tur: 'gramer', kosul: function (m) { return !/\b(did|does|do|can|could|will|would|should|may|might|must|to|let|make|makes|help|helps|why|not)\s*$/i.test(m.input.slice(0, m.index)); }, oneri: function (m) { var v = m[2].toLowerCase(); return m[1] + ' ' + ({ have: 'has', do: 'does', go: 'goes', study: 'studies' }[v] || v + 's'); }, not: 'He / she / it ile geniş zamanda fiile -s.' },
    { re: /\bmore (better|worse|easier|harder|cheaper|bigger|smaller|faster|higher|lower)\b/gi, tur: 'gramer', oneri: function (m) { return m[1]; }, not: 'Kısa sıfat zaten -er almış; “more” fazladan.' },
    { re: /\baccording to me\b/gi, tur: 'kelime', oneri: function () { return 'in my opinion'; }, not: '“According to” bir kaynağa atıf içindir; kendi görüşün için “in my opinion”.' },
    { re: /\bdiscuss about\b/gi, tur: 'kelime', oneri: function () { return 'discuss'; }, not: '“discuss” edat almaz.' },
    { re: /\bexplain (me|us|him|her|them)\b/gi, tur: 'gramer', oneri: function (m) { return 'explain to ' + m[1]; }, not: '“explain to someone”.' },
    { re: /\b(informations|advices|equipments|knowledges|homeworks|researches|furnitures|evidences)\b/gi, tur: 'gramer', oneri: function (m) { return m[1].replace(/s$/i, ''); }, not: 'Sayılamayan isim: -s almaz.' },
    { re: /\bcan able to\b/gi, tur: 'gramer', oneri: function () { return 'can'; }, not: '“can” ya da “be able to”; ikisi birden olmaz.' },
    { re: /\bthe most of\b/gi, tur: 'gramer', oneri: function () { return 'most of'; }, not: '“most of the …” (the yok).' },
    { re: /\bin nowadays\b/gi, tur: 'gramer', oneri: function () { return 'nowadays'; }, not: '“nowadays” edat almaz.' },
    { re: /\bmake (a )?(research|homework)\b/gi, tur: 'kelime', oneri: function (m) { return 'do ' + m[2]; }, not: 'Doğru eşdizim: do research / do homework.' },
    { re: /\bdespite of\b/gi, tur: 'gramer', oneri: function () { return 'despite'; }, not: '“despite” ya da “in spite of”; “despite of” olmaz.' },
    { re: /\bsince (\d+|two|three|four|five|six|seven|eight|nine|ten|many|several) (years|months|weeks|days|hours)\b/gi, tur: 'gramer', oneri: function (m) { return 'for ' + m[1] + ' ' + m[2]; }, not: 'Süre için “for”, başlangıç anı için “since”.' },
    { re: /\bthere is (many|several|a lot of|lots of|some \w+s|two|three|\d+)\b/gi, tur: 'gramer', oneri: function (m) { return 'there are ' + m[1]; }, not: 'Çoğul için “there are”.' },
    { re: /\b(\w+) \1\b/gi, tur: 'yazim', kosul: function (m) { return !/^(that|had|very|ha|bye)$/i.test(m[1]); }, oneri: function (m) { return m[1]; }, not: 'Kelime iki kez yazılmış.' },
    { re: /\ba (?=(?!uni|use|usu|eu|one|once)[aeiou])(\w+)/gi, kosul: function (m) { return !/\w$/.test(m.input.slice(0, m.index)); }, tur: 'gramer', oneri: function (m) { return 'an ' + m[1]; }, not: 'Ünlü sesle başlayan kelimeden önce “an”.' },
    { re: /\ban (?=(?!hour|honest|honou?r|heir)[bcdfghjklmnpqrstvwxyz])(\w+)/gi, kosul: function (m) { return !/\w$/.test(m.input.slice(0, m.index)); }, tur: 'gramer', oneri: function (m) { return 'a ' + m[1]; }, not: 'Ünsüz sesle başlayan kelimeden önce “a”.' },
    { re: /\b(don't|can't|won't|isn't|aren't|doesn't|didn't|it's|I'm|they're|we're)\b/gi, tur: 'uslup', resmi: true, oneri: function (m) { return ({ "don't": 'do not', "can't": 'cannot', "won't": 'will not', "isn't": 'is not', "aren't": 'are not', "doesn't": 'does not', "didn't": 'did not', "it's": 'it is', "i'm": 'I am', "they're": 'they are', "we're": 'we are' })[m[1].toLowerCase().replace(/’/g, "'")]; }, not: 'Akademik yazıda kısaltma yerine açık hâl.' },
    { re: / +([,.;:!?])/g, tur: 'noktalama', oneri: function (m) { return m[1]; }, not: 'Noktalamadan önce boşluk olmaz.' }
  ];
  function kurallar(t, o) {
    o = o || {}; var out = [];
    KURAL.forEach(function (k) {
      if (k.resmi && !o.resmi) return; k.re.lastIndex = 0; var m;
      while ((m = k.re.exec(t))) {
        if (k.kosul && !k.kosul(m)) continue;
        var oneri = k.oneri(m); if (oneri == null || oneri === m[0]) continue;
        if (/^[A-Z]/.test(m[0]) && /^[a-z]/.test(oneri)) oneri = oneri.charAt(0).toUpperCase() + oneri.slice(1);   /* cümle başındaysa büyük harf korunur */
        out.push({ a: m.index, b: m.index + m[0].length, parca: m[0], oneri: oneri, tur: k.tur, not: k.not });
        if (m[0] === '') k.re.lastIndex++;
      }
    });
    /* cümle başı küçük harf (i hariç; o zaten yakalandı) */
    var re = /(^|[.!?]\s+)([a-z])/g, m2; while ((m2 = re.exec(t))) { var a = m2.index + m2[1].length; if (t[a] === 'i' && /\bi\b/.test(t.slice(a, a + 2))) continue; out.push({ a: a, b: a + 1, parca: m2[2], oneri: m2[2].toUpperCase(), tur: 'yazim', not: 'Cümle büyük harfle başlar.' }); }
    var son = t.trim(); if (son && /[A-Za-z0-9)”"]$/.test(son)) { var e = t.replace(/\s+$/, '').length; out.push({ a: e, b: e, parca: '', oneri: '.', tur: 'noktalama', not: 'Son cümle noktalama işaretiyle biter.' }); }
    /* cümle başındaki düzeltme büyük harfle başlar */
    out.forEach(function (d) { if (d.oneri && /^[a-z]/.test(d.oneri) && /(^|[.!?]\s+)$/.test(t.slice(0, d.a))) d.oneri = d.oneri.charAt(0).toUpperCase() + d.oneri.slice(1); });
    return cakismaz(out);
  }
  function cakismaz(l) { l.sort(function (x, y) { return x.a - y.a || (y.b - y.a) - (x.b - x.a); }); var s = [], son = -1; l.forEach(function (d) { if (d.a >= son || (d.a === d.b && d.a >= son)) { s.push(d); son = Math.max(son, d.b); } }); return s; }
  function uygula(t, l) { var o = '', i = 0; l.slice().sort(function (x, y) { return x.a - y.a; }).forEach(function (d) { if (d.a < i) return; o += t.slice(i, d.a) + d.oneri; i = d.b; }); return o + t.slice(i); }
  var yuvarla = function (x) { return Math.max(3.5, Math.min(8.5, Math.round(x * 2) / 2)); };
  /* yerel band tahmini (IELTS dört ölçüt). Kaba bir ölçüm: uzunluk, yapı, çeşitlilik, hata yoğunluğu */
  function band(t, gorev, ol, hatalar) {
    var hed = gorev && gorev.hedef || [80, 120], k = ol.kelime, oran = Math.min(1, k / hed[0]);
    var madde = gorev && gorev.maddeler ? gorev.maddeler.filter(function (m) { return kelimeler(m).filter(function (w) { return w.length > 3 && ISLEV.indexOf(w) < 0; }).some(function (w) { return kelimeler(t).indexOf(w) >= 0 || kelimeler(t).some(function (x) { return x.indexOf(w.slice(0, 5)) === 0; }); }); }).length / gorev.maddeler.length : .6;
    var hy = k ? hatalar.filter(function (h) { return h.tur !== 'uslup'; }).length / k * 100 : 10;
    var tr = 4 + oran * 2.5 + madde * 1.5 - (k > hed[1] * 1.6 ? .5 : 0);
    var cc = 4 + Math.min(3, ol.baglac.length * .6) + (ol.paragraf >= (hed[0] >= 150 ? 3 : 1) ? 1 : 0) - (ol.cumle && ol.ort > 32 ? .5 : 0);
    var lr = 4 + Math.min(2, Math.max(0, (ol.cesit - .45) * 8)) + Math.min(1.5, ol.ust.length * .3) - Math.min(1, ol.tekrar.length * .3);
    var gra = 7.5 - Math.min(3.5, hy * .7) + Math.min(1, ol.cumle ? ol.karmasik / ol.cumle * 2 : 0) - (ol.cumle && ol.ort < 7 ? .5 : 0);
    var r = { tr: yuvarla(tr), cc: yuvarla(cc), lr: yuvarla(lr), gra: yuvarla(gra) };
    r.genel = yuvarla((r.tr + r.cc + r.lr + r.gra) / 4);
    return r;
  }
  /* paraphrase: kaynakla ortak kelime üçlüsü oranı (kopya) ve anlam kavramlarının korunması */
  function uclu(k) { var o = []; for (var i = 0; i + 2 < k.length; i++) o.push(k[i] + ' ' + k[i + 1] + ' ' + k[i + 2]); return o; }
  function kopyaOrani(kaynak, yazi) { var a = uclu(kelimeler(kaynak)), b = uclu(kelimeler(yazi)); if (!b.length) return 0; var s = {}; a.forEach(function (x) { s[x] = 1; }); return Math.round(b.filter(function (x) { return s[x]; }).length / b.length * 100) / 100; }
  function anlamKorur(it, yazi) { var t = ' ' + kelimeler(yazi).join(' ') + ' '; var n = it.kavram.filter(function (g) { return g.some(function (w) { return t.indexOf(' ' + w.toLowerCase()) >= 0; }); }).length; return Math.round(n / it.kavram.length * 100) / 100; }
  function karistir(dizi, tohum) { var a = dizi.slice(), s = tohum || 1; for (var i = a.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; var j = Math.floor(s / 233280 * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } if (a.join() === dizi.join() && a.length > 1) a.push(a.shift()); return a; }
  function kartlar(en) { return en.replace(/[.!?]$/, '').split(/\s+/); }
  function insaDogru(it, dizi) { return dizi.join(' ').toLowerCase() === kartlar(it.en).join(' ').toLowerCase(); }
  function kalipTut(it, t) { return new RegExp(it.kalip, 'i').test(String(t || '').trim()) && kelimeler(t).length >= 5 && String(t).trim().toLowerCase().replace(/[.!?]$/, '') !== it.en.toLowerCase().replace(/[.!?]$/, ''); }
  /* Task 1 grafik verisi: tohuma göre, eğilime uygun */
  function grafikVeri(g, t) {
    var n = g.etiketler.length, lo = g.aralik[0], hi = g.aralik[1], s = t || 7, r = function () { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    return g.etiketler.map(function (_, i) {
      var x = n > 1 ? i / (n - 1) : 0, v = g.egilim === 'artis' ? lo + (hi - lo) * (.15 + .75 * x) : g.egilim === 'azalis' ? hi - (hi - lo) * (.1 + .75 * x) : lo + (hi - lo) * (.3 + .5 * Math.abs(Math.sin(i * 1.3 + s % 5)));
      v += (r() - .5) * (hi - lo) * .12; return Math.round(Math.max(lo, Math.min(hi, v)) * (hi - lo > 20 ? 1 : 10)) / (hi - lo > 20 ? 1 : 10);
    });
  }
  var TREND = /\b(rose|rise|risen|increase[sd]?|grew|grow|climb(ed)?|peak(ed)?|fell|fall(en)?|drop(ped)?|decline[sd]?|decrease[sd]?|remain(ed)?|stable|fluctuat\w*|doubled|halved|steady|steadily|sharp(ly)?|slight(ly)?|gradual(ly)?|dip(ped)?|recover(ed)?)\b/i;
  function task1Kontrol(g, v, t) {
    var max = v.indexOf(Math.max.apply(null, v)), min = v.indexOf(Math.min.apply(null, v)), low = String(t || '').toLowerCase();
    var sayilar = (low.match(/\d+(\.\d+)?/g) || []).map(Number), yakin = sayilar.some(function (x) { return v.some(function (y) { return Math.abs(x - y) <= Math.max(1, Math.abs(y) * .1); }); });
    return { ozet: /\b(overall|in general|generally|it is clear|the main)\b/.test(low), max: low.indexOf(g.etiketler[max].toLowerCase()) >= 0, min: low.indexOf(g.etiketler[min].toLowerCase()) >= 0, trend: TREND.test(low), sayi: yakin };
  }
  var YAZ = { cumleler: cumleler, kelimeler: kelimeler, olcum: olcum, kurallar: kurallar, uygula: uygula, band: band, kopyaOrani: kopyaOrani, anlamKorur: anlamKorur, karistir: karistir, kartlar: kartlar, insaDogru: insaDogru, kalipTut: kalipTut, grafikVeri: grafikVeri, task1Kontrol: task1Kontrol, BAGLAC: BAGLAC };
  W.YAZ = YAZ;

  /* ====================================================================== ekran */
  YAZ.kur = function (kok) {
    var A = W.ACX, esc = A.esc, BK = W.YAZ_BANKA, KB = W.KELIME_BANKA;
    var st = A.ls.al('yaz', null);
    if (!st || st.v !== 1) { var k0 = A.ls.al('kelime', null); st = { v: 1, sev: k0 && k0.sev || 'B1', kat: 'kampus', tur: 'hepsi', gor: {}, taslak: {}, gecmis: [], gunluk: {}, insa: 0, mod: 'defter', ses: false }; }
    var ekler = (A.ls.al('yazEk', []) || []).filter(gorevGecerli);
    var kaydet = function () { A.ls.yaz('yaz', st); };
    var bugun = function () { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
    var tum = function () { return BK.GOREV.concat(ekler); };
    var katAd = function (id) { var k = BK.KAT.filter(function (x) { return x.id === id; })[0]; return k ? k.ad : id; };
    var bandi = function (sev) { return 'ABC'.indexOf(String(sev)[0]) < 0 ? 1 : 'ABC'.indexOf(String(sev)[0]); };
    var hedefi = function (g) { return BK.HEDEF[g.tur][bandi(g.sev)]; };
    var zor = {}; if (KB && KB.sev) { var si = SEV.indexOf(st.sev); SEV.forEach(function (s, i) { if (i > si) (KB.sev[s] || []).forEach(function (x) { zor[x.split('|')[0]] = s; }); }); }
    function gorevGecerli(g) { return g && BK.TUR[g.tur] && typeof g.en === 'string' && g.en.length < 600 && Array.isArray(g.maddeler) && g.maddeler.length && Array.isArray(g.kelimeler) && (g.tur !== 'task1' || g.grafik && Array.isArray(g.grafik.etiketler) && g.grafik.etiketler.length >= 3); }

    var o = { g: null, veri: null, sonuc: null };
    kok.innerHTML =
      '<div class="yz-ust"><div class="kagit yz-gunluk" id="yz-gunluk"></div>' +
        '<div class="kagit ok-kitaplik"><div class="dn-sev" role="group" aria-label="Seviye">' + SEV.map(function (s) { return '<button type="button" data-sev="' + s + '">' + s + '</button>'; }).join('') + '</div>' +
          '<div class="dn-raf" role="group" aria-label="Kategori">' + BK.KAT.map(function (k) { return '<button type="button" data-kat="' + k.id + '"><span aria-hidden="true">' + k.ik + '</span>' + k.ad + '</button>'; }).join('') + '</div>' +
          '<div class="dn-sev yz-turler" role="group" aria-label="Tür"><button type="button" data-tur="hepsi">hepsi</button>' + Object.keys(BK.TUR).map(function (t) { return '<button type="button" data-tur="' + t + '">' + BK.TUR[t].ik + ' ' + BK.TUR[t].ad + '</button>'; }).join('') + '</div>' +
          '<div class="dn-liste" id="yz-liste"></div></div></div>' +
      '<div class="kagit yz-masa" id="yz-masa"></div>' +
      '<div class="yz-alis"><article class="kagit yz-insa" id="yz-insa"></article><article class="kagit yz-para" id="yz-para"></article></div>' +
      '<div class="dn-gorev">' + [['gorev', 'Bir görev teslimi'], ['gunluk', 'Günün sayfası'], ['insa', 'Üç cümle inşaatı'], ['para', 'Bir paraphrase üçlüsü']].map(function (g, i) {
        return '<article class="kagit alis dn-g" data-id="' + g[0] + '"><span class="etiket">görev ' + (i + 1) + '</span><b>' + g[1] + '</b><span class="tik" aria-label="tamamlandı">✓</span></article>';
      }).join('') + '</div>';
    var $ = function (s) { return kok.querySelector(s); };

    /* ---------- kütüphane ---------- */
    function listeCiz() {
      kok.querySelectorAll('[data-sev]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.sev === st.sev); });
      kok.querySelectorAll('[data-kat]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.kat === st.kat); });
      kok.querySelectorAll('[data-tur]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.tur === st.tur); });
      var l = tum().filter(function (g) { return g.kat === st.kat && (st.tur === 'hepsi' || g.tur === st.tur); }).sort(function (a, b) { return Math.abs(SEV.indexOf(a.sev) - SEV.indexOf(st.sev)) - Math.abs(SEV.indexOf(b.sev) - SEV.indexOf(st.sev)); });
      $('#yz-liste').innerHTML = l.map(function (g) {
        return '<button type="button" class="dn-ep' + (g.sev === st.sev ? ' uygun' : '') + (o.g && o.g.id === g.id ? ' acik' : '') + (st.gor[g.id] ? ' gordu' : '') + '" data-gorev="' + esc(g.id) + '"><span class="mono">' + BK.TUR[g.tur].ik + ' ' + BK.TUR[g.tur].ad + ' · ' + g.sev + '</span><b lang="en">' + esc(g.en.split(/[.?!]\s/)[0].slice(0, 90)) + '</b><small>' + hedefi(g).join('–') + ' kelime' + (st.taslak[g.id] ? ' · taslak var' : '') + '</small></button>';
      }).join('') + '<button type="button" class="dn-ep yeni" data-yeni><span class="mono">+</span><b>Yeni görevler getir</b><small>' + esc(katAd(st.kat)) + ' · ' + st.sev + ' · havuzdan</small></button>';
    }
    async function yeniGetir(b) {
      b.disabled = true; b.querySelector('small').textContent = 'getiriliyor…';
      var v = await A.icerik('yaz', st.kat + ':' + st.sev);
      var yeni = v && Array.isArray(v.gorevler) ? v.gorevler.map(function (g, i) { return Object.assign({}, g, { id: 'ek-' + st.kat + '-' + Date.now().toString(36) + i, kat: st.kat, sev: st.sev }); }).filter(gorevGecerli) : [];
      if (yeni.length) { ekler = ekler.concat(yeni).slice(-40); A.ls.yaz('yazEk', ekler); listeCiz(); A.sevin(); }
      else { A.soyle('Şu an yeni görev getiremedim; bankadaki görevler duruyor.', 4000); listeCiz(); }
    }

    /* ---------- grafik (Task 1) ---------- */
    function grafikSvg(g, v) {
      var W2 = 520, H2 = 240, sol = 44, alt = 34, ust = 24, mx = g.aralik[1], cizW = W2 - sol - 12, cizH = H2 - alt - ust, n = v.length;
      var y = function (x) { return ust + cizH - x / mx * cizH; }, xk = function (i) { return sol + (i + .5) * cizW / n; };
      var izgara = [0, .25, .5, .75, 1].map(function (f) { var val = Math.round(mx * f * 10) / 10; return '<line x1="' + sol + '" x2="' + (W2 - 12) + '" y1="' + y(val) + '" y2="' + y(val) + '"/><text x="' + (sol - 6) + '" y="' + (y(val) + 4) + '" text-anchor="end">' + val + '</text>'; }).join('');
      var ciz = g.tip === 'cizgi' ? '<polyline class="hat" pathLength="1" points="' + v.map(function (x, i) { return xk(i) + ',' + y(x); }).join(' ') + '"/>' + v.map(function (x, i) { return '<circle cx="' + xk(i) + '" cy="' + y(x) + '" r="4.5"/>'; }).join('')
        : v.map(function (x, i) { var bw = cizW / n * .6; return '<rect style="--i:' + i + '" x="' + (xk(i) - bw / 2) + '" y="' + y(x) + '" width="' + bw + '" height="' + (ust + cizH - y(x)) + '"/>'; }).join('');
      return '<figure class="yz-grafik"><figcaption>' + esc(g.baslik) + ' <span class="mono">(' + esc(g.birim) + ')</span></figcaption><svg viewBox="0 0 ' + W2 + ' ' + H2 + '" role="img" aria-label="' + esc(g.baslik + ': ' + g.etiketler.map(function (e, i) { return e + ' ' + v[i]; }).join(', ')) + '"><g class="iz">' + izgara + '</g>' + ciz +
        g.etiketler.map(function (e, i) { return '<text class="et" x="' + xk(i) + '" y="' + (H2 - 12) + '" text-anchor="middle">' + esc(e) + '</text>'; }).join('') + '</svg></figure>';
    }

    /* ---------- masa: görev, editör, canlı göstergeler ---------- */
    function yukle(g) {
      o.g = Object.assign({}, g, { hedef: hedefi(g) }); o.sonuc = null; st.gor[g.id] = 1; kaydet();
      o.veri = g.grafik ? grafikVeri(g.grafik, (Date.now() / 864e5 | 0) + g.id.length * 31) : null;
      var t = BK.TUR[g.tur];
      $('#yz-masa').innerHTML = '<header class="yz-bas"><span class="etiket">' + t.ik + ' ' + t.ad + ' · ' + esc(katAd(g.kat)) + ' · ' + g.sev + ' · hedef ' + o.g.hedef.join('–') + ' kelime</span>' +
          '<p class="yz-soru" lang="en">' + esc(g.en) + '</p><p class="yz-tr">' + esc(g.tr) + '</p>' +
          '<div class="yz-madde"><span class="etiket">değin</span>' + g.maddeler.map(function (m, i) { return '<span class="yz-m" data-m="' + i + '" lang="en">' + esc(m) + '</span>'; }).join('') + '</div>' +
          '<div class="yz-kel"><span class="etiket">işe yarar</span>' + g.kelimeler.map(function (k) { return '<button type="button" class="yz-k" data-ekle="' + esc(k) + '" lang="en">' + esc(k) + '</button>'; }).join('') + '</div></header>' +
        (g.grafik ? grafikSvg(g.grafik, o.veri) : '') +
        '<div class="yz-arac"><span class="dn-mod" role="group" aria-label="Kâğıt"><button type="button" data-mod="defter">✎ defter</button><button type="button" data-mod="daktilo">⌨ daktilo</button></span><button type="button" class="btn sm" data-ses aria-pressed="' + !!st.ses + '">' + (st.ses ? '🔊 tuş sesi' : '🔈 tuş sesi') + '</button></div>' +
        '<div class="yz-yazi"><div class="yz-kagit-k"><span class="yz-sapka" aria-hidden="true"></span><label class="gizli" for="yz-metin">Yazın</label><textarea id="yz-metin" class="yz-kagit" spellcheck="false" placeholder="Start writing here…" lang="en"></textarea></div>' +
          '<aside class="yz-canli" aria-live="off"></aside></div>' +
        '<div class="alt-satir"><span class="say">Taslak bu tarayıcıda kendiliğinden kaydedilir.</span><button type="button" class="btn ana" data-teslim>🖍 Kırmızı kaleme ver</button></div>' +
        '<div class="yz-sonuc" hidden></div>';
      var ta = $('#yz-metin'); ta.value = st.taslak[g.id] || ''; modCiz(); canli(); listeCiz();
      var m = $('#yz-masa'); m.classList.remove('gir'); void m.offsetWidth; m.classList.add('gir');
    }
    function modCiz() { var ta = $('#yz-metin'); if (!ta) return; ta.classList.toggle('daktilo', st.mod === 'daktilo'); $('#yz-masa').classList.toggle('daktilo', st.mod === 'daktilo'); kok.querySelectorAll('[data-mod]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.mod === st.mod); }); }
    var kayitZ = null;
    function canli() {
      var ta = $('#yz-metin'); if (!ta || !o.g) return; var t = ta.value, ol = olcum(t, zor), h = o.g.hedef, oran = Math.min(1, ol.kelime / h[0]);
      clearTimeout(kayitZ); kayitZ = setTimeout(function () { st.taslak[o.g.id] = t; kaydet(); }, 600);
      var tl = ' ' + kelimeler(t).join(' ') + ' ';
      kok.querySelectorAll('.yz-m').forEach(function (el) { var ws = kelimeler(el.textContent).filter(function (w) { return w.length > 3 && ISLEV.indexOf(w) < 0; }); el.classList.toggle('var', ws.some(function (w) { return tl.indexOf(' ' + w.slice(0, 5)) >= 0; })); });
      kok.querySelectorAll('.yz-k').forEach(function (el) { el.classList.toggle('var', tl.indexOf(' ' + kelimeler(el.dataset.ekle).join(' ') + ' ') >= 0); });
      var renk = ol.kelime > h[1] * 1.25 ? 'fazla' : ol.kelime >= h[0] ? 'tamam' : '';
      $('.yz-canli').innerHTML =
        '<div class="yz-halka ' + renk + '" style="--o:' + oran.toFixed(3) + '"><b>' + ol.kelime + '</b><small>/ ' + h[0] + '–' + h[1] + '</small></div>' +
        '<div class="yz-g"><span class="etiket">cümleler · ort. ' + ol.ort + '</span><div class="yz-cubuk">' + (ol.cumleUz.length ? ol.cumleUz.map(function (n) { return '<i class="' + (n < 6 ? 'kisa' : n > 30 ? 'uzun' : '') + '" style="--h:' + Math.min(1, n / 35) + '" title="' + n + ' kelime"></i>'; }).join('') : '<small class="say">henüz cümle yok</small>') + '</div></div>' +
        '<div class="yz-g"><span class="etiket">bağlaçlar · ' + ol.baglac.length + '</span><div class="yz-cip">' + (ol.baglac.length ? ol.baglac.map(function (b) { return '<span>' + esc(b) + '</span>'; }).join('') : '<small class="say">however, because, for example…</small>') + '</div></div>' +
        (ol.tekrar.length ? '<div class="yz-g uyar"><span class="etiket">tekrar eden</span><div class="yz-cip">' + ol.tekrar.slice(0, 5).map(function (x) { return '<span>' + esc(x.w) + ' ×' + x.n + '</span>'; }).join('') + '</div></div>' : '') +
        '<div class="yz-g"><span class="etiket">seviye üstü kelime · ' + ol.ust.length + '</span><div class="yz-cip">' + ol.ust.slice(0, 6).map(function (w) { return '<span class="yz-ustk">' + esc(w) + ' <small>' + zor[w] + '</small></span>'; }).join('') + '</div></div>' +
        (o.g.grafik ? task1Ciz(t) : '');
    }
    function task1Ciz(t) {
      var k = task1Kontrol(o.g.grafik, o.veri, t);
      return '<ul class="yz-t1">' + [['ozet', 'genel eğilim (overall…)'], ['max', 'en yüksek nokta'], ['min', 'en düşük nokta'], ['trend', 'eğilim fiili (rose, fell…)'], ['sayi', 'grafikteki bir sayı']].map(function (x) { return '<li class="' + (k[x[0]] ? 'var' : '') + '">' + x[1] + '</li>'; }).join('') + '</ul>';
    }

    /* daktilo / defter sesi: Web Audio, dosyasız */
    var actx = null;
    function tik(ding) {
      if (!st.ses || A.sakin || (A.sesAcik && !A.sesAcik())) return;
      try {
        actx = actx || new (W.AudioContext || W.webkitAudioContext)(); var t0 = actx.currentTime, g = actx.createGain(); g.connect(actx.destination);
        if (ding) { var o2 = actx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 1760; o2.connect(g); g.gain.setValueAtTime(.12, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + .6); o2.start(t0); o2.stop(t0 + .6); return; }
        var b = actx.createBuffer(1, 600, actx.sampleRate), d = b.getChannelData(0); for (var i = 0; i < 600; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / 600, 4);
        var s = actx.createBufferSource(); s.buffer = b; s.connect(g); g.gain.value = st.mod === 'daktilo' ? .35 : .12; s.start(t0);
      } catch (e) { /* ses yoksa sessiz */ }
    }

    /* ---------- kırmızı kalem ---------- */
    async function teslim(b) {
      var t = $('#yz-metin').value.trim(); if (kelimeler(t).length < 8) { A.soyle('Biraz daha yaz; en az birkaç cümle olsun.', 3500); return; }
      b.disabled = true; b.textContent = 'kırmızı kalem okuyor…';
      var resmi = ['task1', 'task2', 'gorus', 'eposta'].indexOf(o.g.tur) >= 0 && bandi(o.g.sev) > 0;
      var yerel = kurallar(t, { resmi: resmi }), ol = olcum(t, zor), bnd = band(t, o.g, ol, yerel), kaynak = 'yerel';
      var yz = await A.yz('kompozisyon', { gorev: o.g.en, tur: o.g.tur, sev: o.g.sev, metin: t.slice(0, 4000) }, 22000);
      var duz = yerel;
      if (yz && yz.band && yz.duzeltmeler) {
        var ek = [], p = 0; (yz.duzeltmeler || []).slice(0, 25).forEach(function (d) { var i = t.indexOf(String(d.parca || ''), 0); if (d.parca && i >= 0 && d.oneri != null && d.oneri !== d.parca) ek.push({ a: i, b: i + d.parca.length, parca: d.parca, oneri: String(d.oneri), tur: d.tur || 'gramer', not: String(d.not_tr || '') }); void p; });
        duz = cakismaz(yerel.concat(ek)); kaynak = 'yz';
        ['tr', 'cc', 'lr', 'gra'].forEach(function (k) { var v = +yz.band[k]; if (v >= 1 && v <= 9) bnd[k] = Math.round(v * 2) / 2; }); bnd.genel = yuvarla((bnd.tr + bnd.cc + bnd.lr + bnd.gra) / 4);
      }
      var son = uygula(t, duz), once = (st.gecmis || []).filter(function (x) { return x.id === o.g.id; }).slice(-1)[0];
      o.sonuc = { t: t, duz: duz, son: son, bnd: bnd, kaynak: kaynak, yorum: yz && yz.yorum_tr, once: once };
      st.gecmis = (st.gecmis || []).concat([{ t: Date.now(), id: o.g.id, tur: o.g.tur, kelime: ol.kelime, band: bnd.genel }]).slice(-40); kaydet();
      if (ol.kelime >= o.g.hedef[0] * .7 && A.bitir(P, 'gorev')) A.soyle('Görev teslim edildi; kırmızı kalem iş başında.', 3500);
      b.disabled = false; b.textContent = '🖍 Yeniden kırmızı kaleme ver';
      sonucCiz(); A.sesCal('tebesir');
    }
    var TUR_AD = { gramer: 'dilbilgisi', kelime: 'kelime', yazim: 'yazım', noktalama: 'noktalama', uslup: 'üslup' };
    function sonucCiz() {
      var s = o.sonuc, el = $('.yz-sonuc'); el.hidden = false;
      var parcalar = [], i = 0;
      s.duz.forEach(function (d, n) { parcalar.push(esc(s.t.slice(i, d.a))); parcalar.push('<span class="kk kk-' + d.tur + '" style="--i:' + n + '"><sup>' + (n + 1) + '</sup>' + (d.parca ? '<del>' + esc(d.parca) + '</del>' : '<span class="kk-ek">‸</span>') + '<ins>' + esc(d.oneri) + '</ins></span>'); i = d.b; });
      parcalar.push(esc(s.t.slice(i)));
      var olcut = [['tr', 'Görevi karşılama'], ['cc', 'Tutarlılık ve bağlantı'], ['lr', 'Kelime dağarcığı'], ['gra', 'Dilbilgisi çeşitliliği ve doğruluğu']];
      el.innerHTML = '<div class="yz-band"><div class="yz-genel"><small>tahmini band</small><b>' + s.bnd.genel.toFixed(1) + '</b>' + (s.once ? '<span class="mono">önceki ' + s.once.band.toFixed(1) + ' → ' + (s.bnd.genel >= s.once.band ? '▲' : '▼') + '</span>' : '') + '</div>' +
          olcut.map(function (x, k) { return '<div class="yz-olcut" style="--v:' + (s.bnd[x[0]] / 9).toFixed(3) + ';--d:' + (k * .12) + 's"><span>' + x[1] + '</span><i></i><b>' + s.bnd[x[0]].toFixed(1) + '</b></div>'; }).join('') +
          '<p class="say">' + (s.kaynak === 'yz' ? 'Puan ve düzeltmeler yapay zekâ + Acadex kurallarından.' : 'Bağlantı yok: puan Acadex’in yerel ölçümüyle (uzunluk, yapı, çeşitlilik, hata yoğunluğu); kaba bir tahmindir.') + ' Resmî IELTS puanı değildir.</p></div>' +
        '<div class="yz-kalem"><div class="yz-kalem-metin" lang="en">' + parcalar.join('').replace(/\n/g, '<br>') + '</div><ol class="yz-kenar">' + s.duz.map(function (d, n) { return '<li style="--i:' + n + '"><b>' + (n + 1) + '</b> <span class="mono">' + (TUR_AD[d.tur] || d.tur) + '</span> ' + esc(d.not || '') + '</li>'; }).join('') + (s.duz.length ? '' : '<li class="temiz">Kırmızı kalemin bulduğu bir şey yok. Yine de yüksek sesle bir kez oku.</li>') + '</ol></div>' +
        (s.yorum ? '<p class="yz-yorum el">' + esc(s.yorum) + '</p>' : '') +
        '<div class="yz-kaydir"><div class="yz-kat yz-son" lang="en">' + esc(s.son).replace(/\n/g, '<br>') + '</div><div class="yz-kat yz-tas" lang="en" aria-hidden="true">' + parcalar.join('').replace(/\n/g, '<br>') + '</div><span class="yz-cizgi" aria-hidden="true"></span>' +
          '<label class="yz-kaydir-l"><span>taslak</span><input type="range" min="0" max="100" value="50" data-kaydir aria-label="Taslak ile son sürüm arasında kaydır"><span>son sürüm</span></label></div>' +
        '<div class="alt-satir"><button type="button" class="btn" data-duzelt>✎ Taslağı kendim düzelteyim</button><button type="button" class="btn ana" data-sonal>Son sürümü kâğıda al</button></div>';
      el.classList.remove('gir'); void el.offsetWidth; el.classList.add('gir');
      el.scrollIntoView({ behavior: A.sakin ? 'auto' : 'smooth', block: 'start' });
    }

    /* ---------- günlük ---------- */
    function gunlukCiz() {
      var b = 'ABC'[bandi(st.sev)], l = BK.GUNLUK.filter(function (x) { return x[0] === b; }), gun = bugun(), h = 0; for (var i = 0; i < gun.length; i++) h = (h * 31 + gun.charCodeAt(i)) >>> 0;
      var soru = l[h % l.length], kayit = st.gunluk[gun], gecmis = Object.keys(st.gunluk).filter(function (k) { return k !== gun; }).sort().reverse().slice(0, 5);
      var seri = 0, c = new Date(); c.setHours(12); var key = function (d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
      if (!st.gunluk[key(c)]) c.setDate(c.getDate() - 1); while (st.gunluk[key(c)]) { seri++; c.setDate(c.getDate() - 1); }
      $('#yz-gunluk').innerHTML = '<div class="yz-gl-ust"><span class="etiket">günün sayfası · ' + new Date().toLocaleDateString('tr', { day: 'numeric', month: 'long', weekday: 'long' }) + '</span><span class="mono">' + (seri ? seri + ' günlük seri' : 'seri bugün başlar') + '</span></div>' +
        '<p class="yz-gl-soru" lang="en">' + esc(soru[1]) + '</p><p class="yz-tr">' + esc(soru[2]) + '</p>' +
        '<label class="gizli" for="yz-gl">Günlük</label><textarea id="yz-gl" class="yz-gl-kagit" rows="5" lang="en" spellcheck="false" placeholder="3–5 cümle…">' + esc(kayit ? kayit.metin : '') + '</textarea>' +
        '<div class="alt-satir"><span class="mono" data-gl-say></span><button type="button" class="btn ana sm" data-gl-kaydet>' + (kayit ? '✓ sayfa yazıldı · güncelle' : 'Sayfayı kaydet') + '</button></div>' +
        (gecmis.length ? '<div class="yz-gl-gecmis"><span class="etiket">önceki sayfalar</span>' + gecmis.map(function (k, i) { var x = st.gunluk[k]; return '<details class="yz-gl-s" style="--r:' + (i % 2 ? 1 : -1) + 'deg"><summary><b>' + new Date(k + 'T12:00').toLocaleDateString('tr', { day: 'numeric', month: 'short' }) + '</b> <span lang="en">' + esc(x.soru) + '</span></summary><p lang="en">' + esc(x.metin) + '</p></details>'; }).join('') + '</div>' : '');
      glSay(); o.glSoru = soru[1];
    }
    function glSay() { var ta = $('#yz-gl'), el = $('[data-gl-say]'); if (!ta || !el) return; var ol = olcum(ta.value); el.textContent = ol.cumle + ' cümle · ' + ol.kelime + ' kelime'; }

    /* ---------- cümle inşaatı ---------- */
    var ins = { i: 0, dizi: [], kalan: [], tamam: false };
    function insaListe() { var b = bandi(st.sev); return BK.INSA.filter(function (x) { return Math.abs(bandi(x.sev) - b) <= 1; }); }
    function insaYeni() { var l = insaListe(), it = l[ins.i % l.length]; ins.it = it; ins.dizi = []; ins.kalan = karistir(kartlar(it.en), ins.i + 3).map(function (w, k) { return { w: w, k: k }; }); ins.tamam = false; insaCiz(); }
    function insaCiz() {
      var it = ins.it;
      $('#yz-insa').innerHTML = '<div class="alis-u"><div><span class="etiket">cümle inşaatı · ' + it.sev + '</span><h3>Kartlardan cümle kur</h3><p class="yz-tr">' + esc(it.tr) + '</p></div><span class="tik" aria-hidden="true"></span></div>' +
        '<div class="yz-ray" aria-label="Kurduğun cümle">' + (ins.dizi.length ? ins.dizi.map(function (x, k) { return '<button type="button" class="yz-kart dizide" data-geri="' + k + '" lang="en">' + esc(x.w) + '</button>'; }).join('') : '<span class="say">kartlara sırayla dokun</span>') + '</div>' +
        '<div class="yz-havuz">' + ins.kalan.map(function (x, k) { return '<button type="button" class="yz-kart" data-al="' + k + '" lang="en" style="--r:' + ((x.k % 3) - 1) * 2 + 'deg">' + esc(x.w) + '</button>'; }).join('') + '</div>' +
        (ins.tamam ? '<div class="yz-insa-2"><p><b>Şimdi sen:</b> aynı kalıpla kendi cümleni yaz — <i>' + esc(it.kalip_ad) + '</i></p><label class="gizli" for="yz-insa-t">Kendi cümlen</label><input id="yz-insa-t" type="text" lang="en" spellcheck="false" autocomplete="off"><div class="alt-satir"><span class="mono" data-insa-not></span><button type="button" class="btn sm ana" data-insa-k>Kontrol et</button></div></div>' : '') +
        '<div class="alt-satir"><span class="mono">' + (st.insa || 0) + ' cümle kuruldu</span><button type="button" class="btn sm" data-insa-sonraki>Sonraki →</button></div>';
    }

    /* ---------- paraphrase ---------- */
    var pr = { i: 0 };
    function paraListe() { var b = bandi(st.sev); return BK.PARA.filter(function (x) { return Math.abs(bandi(x.sev) - b) <= 1; }); }
    function paraCiz() {
      var l = paraListe(), it = l[pr.i % l.length]; pr.it = it;
      $('#yz-para').innerHTML = '<div class="alis-u"><div><span class="etiket">paraphrase atölyesi · ' + it.sev + '</span><h3>Aynı fikir, üç yapı</h3></div><span class="tik" aria-hidden="true"></span></div>' +
        '<blockquote class="yz-kaynak" lang="en">' + esc(it.kaynak) + '</blockquote>' +
        [['es', 'Eş anlamlılarla', 'kelimeleri değiştir, yapı aynı kalabilir'], ['edilgen', 'Edilgen ya da farklı özne', 'be + V3, it is … that'], ['isim', 'İsim yapısıyla', 'fiili isme çevir: reduce → a reduction']].map(function (x) {
          return '<div class="yz-p" data-p="' + x[0] + '"><label for="yz-p-' + x[0] + '"><b>' + x[1] + '</b> <small>' + x[2] + '</small></label><input id="yz-p-' + x[0] + '" type="text" lang="en" spellcheck="false" autocomplete="off"><div class="yz-p-olc" data-po="' + x[0] + '"></div></div>';
        }).join('') + '<div class="alt-satir"><button type="button" class="btn sm" data-para-sonraki>Başka cümle →</button><button type="button" class="btn sm ana" data-para-k>Ölç</button></div><div class="yz-p-ornek" hidden></div>';
    }
    function paraOlc() {
      var it = pr.it, iyi = 0;
      ['es', 'edilgen', 'isim'].forEach(function (k) {
        var v = $('#yz-p-' + k).value, el = $('[data-po="' + k + '"]'); if (!v.trim()) { el.innerHTML = ''; return; }
        var kp = kopyaOrani(it.kaynak, v), an = anlamKorur(it, v), ok = kp < .5 && an >= .6 && kelimeler(v).length >= 4; if (ok) iyi++;
        el.innerHTML = '<span class="yz-olc"><i style="--v:' + kp + '" class="kopya"></i>kopya %' + Math.round(kp * 100) + '</span><span class="yz-olc"><i style="--v:' + an + '" class="anlam"></i>anlam %' + Math.round(an * 100) + '</span>' + (ok ? '<b class="ok">✓</b>' : '');
      });
      var or = $('.yz-p-ornek'); or.hidden = false; or.innerHTML = '<span class="etiket">örnek çözümler</span><p lang="en">' + esc(it.ornek.es) + '</p><p lang="en">' + esc(it.ornek.edilgen) + '</p><p lang="en">' + esc(it.ornek.isim) + '</p>';
      if (iyi === 3) { A.sevin(); if (A.bitir(P, 'para')) A.soyle('Üç farklı yapı, aynı anlam: paraphrase görevi tamam.', 3500); } else if (iyi) A.sevin(); else A.uz();
    }

    /* ---------- olaylar ---------- */
    kok.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.sev) { st.sev = b.dataset.sev; kaydet(); listeCiz(); gunlukCiz(); ins.i = 0; insaYeni(); pr.i = 0; paraCiz(); return; }
      if (b.dataset.kat) { st.kat = b.dataset.kat; kaydet(); listeCiz(); return; }
      if (b.dataset.tur) { st.tur = b.dataset.tur; kaydet(); listeCiz(); return; }
      if (b.dataset.gorev) { var g = tum().filter(function (x) { return x.id === b.dataset.gorev; })[0]; if (g) { yukle(g); $('#yz-masa').scrollIntoView({ behavior: A.sakin ? 'auto' : 'smooth', block: 'start' }); } return; }
      if (b.hasAttribute('data-yeni')) { yeniGetir(b); return; }
      if (b.dataset.mod) { st.mod = b.dataset.mod; kaydet(); modCiz(); return; }
      if (b.hasAttribute('data-ses')) { st.ses = !st.ses; kaydet(); b.setAttribute('aria-pressed', st.ses); b.textContent = st.ses ? '🔊 tuş sesi' : '🔈 tuş sesi'; tik(); return; }
      if (b.dataset.ekle) { var ta = $('#yz-metin'), p = ta.selectionStart || ta.value.length; ta.value = ta.value.slice(0, p) + (p && !/\s$/.test(ta.value.slice(0, p)) ? ' ' : '') + b.dataset.ekle + ' ' + ta.value.slice(p); ta.focus(); canli(); return; }
      if (b.hasAttribute('data-teslim')) { teslim(b); return; }
      if (b.hasAttribute('data-duzelt')) { var ta2 = $('#yz-metin'); ta2.value = o.sonuc.t; ta2.focus(); ta2.scrollIntoView({ behavior: A.sakin ? 'auto' : 'smooth', block: 'center' }); A.soyle('Kenar notlarına bakarak kendin düzelt, sonra yeniden kırmızı kaleme ver.', 4500); return; }
      if (b.hasAttribute('data-sonal')) { var ta3 = $('#yz-metin'); ta3.value = o.sonuc.son; canli(); ta3.scrollIntoView({ behavior: A.sakin ? 'auto' : 'smooth', block: 'center' }); return; }
      if (b.hasAttribute('data-gl-kaydet')) {
        var v = $('#yz-gl').value.trim(), ol = olcum(v); if (ol.cumle < 3 || ol.kelime < 20) { A.soyle('Günün sayfası için en az üç cümle (20+ kelime) yaz.', 3500); return; }
        st.gunluk[bugun()] = { soru: o.glSoru, metin: v.slice(0, 2000) }; kaydet(); gunlukCiz(); A.sesCal('sayfa'); if (A.bitir(P, 'gunluk')) A.soyle('Günün sayfası deftere işlendi.', 3000); return;
      }
      if (b.dataset.al != null) { var x = ins.kalan.splice(+b.dataset.al, 1)[0]; ins.dizi.push(x); tik(); if (!ins.kalan.length) { if (insaDogru(ins.it, ins.dizi.map(function (y) { return y.w; }))) { ins.tamam = true; st.insa = (st.insa || 0) + 1; kaydet(); A.sevin(); A.sesCal('dogru'); if (st.insa >= 3 && A.bitir(P, 'insa')) A.soyle('Üç cümle inşa ettin.', 3000); } else { A.uz(); $('#yz-insa').classList.add('sars'); setTimeout(function () { $('#yz-insa').classList.remove('sars'); }, 450); } } insaCiz(); return; }
      if (b.dataset.geri != null && !ins.tamam) { var y2 = ins.dizi.splice(+b.dataset.geri, 1)[0]; ins.kalan.push(y2); insaCiz(); return; }
      if (b.hasAttribute('data-insa-sonraki')) { ins.i++; insaYeni(); return; }
      if (b.hasAttribute('data-insa-k')) { var tt = $('#yz-insa-t').value, ok = kalipTut(ins.it, tt); $('[data-insa-not]').textContent = ok ? '✓ kalıp yerinde' : 'kalıp görünmüyor ya da cümle aynısı'; if (ok) A.sevin(); else A.uz(); return; }
      if (b.hasAttribute('data-para-sonraki')) { pr.i++; paraCiz(); return; }
      if (b.hasAttribute('data-para-k')) { paraOlc(); return; }
    });
    kok.addEventListener('input', function (e) {
      if (e.target.id === 'yz-metin') { canli(); var sapka = $('.yz-sapka'); if (sapka) { var sat = e.target.value.slice(0, e.target.selectionStart).split('\n').pop().length; sapka.style.setProperty('--sx', Math.min(1, sat / 70).toFixed(3)); } }
      if (e.target.id === 'yz-gl') glSay();
      if (e.target.matches('[data-kaydir]')) e.target.closest('.yz-kaydir').style.setProperty('--x', e.target.value + '%');
    });
    kok.addEventListener('keydown', function (e) {
      if (e.target.id !== 'yz-metin' && e.target.id !== 'yz-gl') return;
      if (e.key === 'Enter') { tik(true); var k = e.target.closest('.yz-kagit-k'); if (k && !A.sakin) { k.classList.remove('satir'); void k.offsetWidth; k.classList.add('satir'); } }
      else if (e.key.length === 1 || e.key === 'Backspace') tik();
    });

    listeCiz(); gunlukCiz(); insaYeni(); paraCiz();
    var ilk = tum().filter(function (g) { return g.kat === st.kat; }).sort(function (a, b) { return Math.abs(SEV.indexOf(a.sev) - SEV.indexOf(st.sev)) - Math.abs(SEV.indexOf(b.sev) - SEV.indexOf(st.sev)); })[0] || BK.GOREV[0];
    yukle(ilk); A.sayac();
    return { yukle: yukle, durum: o };
  };
})();
