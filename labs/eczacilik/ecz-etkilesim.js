/* ==========================================================================
   ACADEX ECZACILIK LAB · ETKİLEŞİM VE FARMAKOLOJİ (labs/eczacilik/ecz-etkilesim.js)
   Üç görünüm: etkileşim ağı (dokun, kenarları gör), çift testi (10 soru, derece
   seç) ve ilaç kartları (grup, mekanizma, enzim, uyarı; çevirerek tekrar).
   ========================================================================== */
(function () {
  'use strict';
  var EC = window.EC, C = EC.core, V = C.V, $ = C.$, X = C.X;
  var el = function () { return $('#etk'); };
  var S = { mod: 'ag', secD: null, secK: null, filtre: { kontrendike: true, ciddi: true, orta: true }, test: null, ara: '' };
  var DUG = V.AG.map(function (id) { return V.dugum(id); }).sort(function (a, b) { return (a.besin - b.besin) || a.ad.localeCompare(b.ad, 'tr'); });
  var POS = {}; (function () { var n = DUG.length; DUG.forEach(function (d, i) { var a = -Math.PI / 2 + i / n * Math.PI * 2; POS[d.id] = { x: 400 + 250 * Math.cos(a), y: 380 + 250 * Math.sin(a), a: a }; }); })();
  var ekey = function (e) { return e.a + '|' + e.b; };

  var agSVG = function () {
    var s = '<svg viewBox="0 0 800 760" role="img" aria-label="İlaç etkileşim ağı: ' + DUG.length + ' düğüm, ' + V.ETK.length + ' etkileşim">';
    s += '<circle cx="400" cy="380" r="250" fill="none" stroke="#E6DDF0" stroke-width="2" stroke-dasharray="4 8"/>';
    V.ETK.forEach(function (e) {
      if (!S.filtre[e.derece]) return;
      var p = POS[e.a], q = POS[e.b], mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2, cx = 400 + (mx - 400) * 0.35, cy = 380 + (my - 380) * 0.35;
      var akt = (S.secD && (e.a === S.secD || e.b === S.secD)) || (S.secK === ekey(e));
      s += '<path class="kenar' + (akt ? ' aktif' : '') + '" data-k="' + ekey(e) + '" d="M' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ' Q' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + q.x.toFixed(1) + ' ' + q.y.toFixed(1) + '" stroke="' + V.DERECE[e.derece].renk + '" stroke-width="' + (e.derece === 'kontrendike' ? 4.5 : e.derece === 'ciddi' ? 3.5 : 2.5) + '" fill="none"' + (e.derece === 'orta' ? ' stroke-dasharray="7 5"' : '') + '><title>' + X(V.dugum(e.a).ad + ' + ' + V.dugum(e.b).ad + ': ' + V.DERECE[e.derece].ad) + '</title></path>';
    });
    DUG.forEach(function (d) {
      var p = POS[d.id], sag = Math.cos(p.a) >= 0, lx = 400 + 268 * Math.cos(p.a), ly = 380 + 268 * Math.sin(p.a);
      var akt = S.secD === d.id || (S.secD && V.etkilesim(S.secD, d.id)) || (S.secK && S.secK.split('|').indexOf(d.id) >= 0);
      s += '<g class="dg' + (akt ? ' aktif' : '') + '" data-d="' + d.id + '" tabindex="0" role="button" aria-label="' + X(d.ad) + '"><circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + (S.secD === d.id ? 13 : 9) + '" fill="' + (d.besin ? '#E8A93A' : '#7A4FA8') + '" stroke="#0D1838" stroke-width="2.4"/>' +
        '<text x="' + lx.toFixed(1) + '" y="' + (ly + 4).toFixed(1) + '" text-anchor="' + (Math.abs(Math.cos(p.a)) < 0.2 ? 'middle' : sag ? 'start' : 'end') + '" font-family="Instrument Sans,sans-serif" font-size="13" font-weight="' + (akt ? 800 : 600) + '" fill="#0D1838">' + X(d.ad.length > 22 ? d.ad.slice(0, 21) + '…' : d.ad) + '</text></g>';
    });
    return s + '</svg>';
  };
  var detay = function () {
    if (S.secK) { var p = S.secK.split('|'), e = V.etkilesim(p[0], p[1]); return '<div class="etk-k"><span class="pill" style="background:' + V.DERECE[e.derece].renk + ';color:#fff">' + X(V.DERECE[e.derece].ad) + '</span><h4 style="margin-top:8px">' + X(V.dugum(e.a).ad) + ' + ' + X(V.dugum(e.b).ad) + '</h4><p><b>Mekanizma.</b> ' + X(e.mek) + '</p><p><b>Eczacı ne yapar?</b> ' + X(e.oneri) + '</p></div>'; }
    if (S.secD) {
      var d = V.dugum(S.secD), il = V.ilac(S.secD), L = V.ETK.filter(function (e) { return e.a === S.secD || e.b === S.secD; }).sort(function (x, y) { return V.DERECE[x.derece].sira - V.DERECE[y.derece].sira; });
      return '<div class="etk-k"><span class="k">' + (d.besin ? 'besin / alışkanlık' : X(il.grup)) + '</span><h4>' + X(d.ad) + '</h4>' + (il ? '<p class="sub" style="margin:0 0 8px">' + X(il.mek) + (il.cyp !== '—' ? ' · ' + X(il.cyp) : '') + '</p>' : '') +
        L.map(function (e) { var o = e.a === S.secD ? e.b : e.a; return '<button type="button" class="btn" style="width:100%;justify-content:flex-start;margin-top:6px;min-height:40px;border-color:' + V.DERECE[e.derece].renk + '" data-k2="' + ekey(e) + '"><span class="pill" style="background:' + V.DERECE[e.derece].renk + ';color:#fff">' + X(V.DERECE[e.derece].ad) + '</span> ' + X(V.dugum(o).ad) + '</button>'; }).join('') + '</div>';
    }
    return '<div class="etk-k"><h4>Bir ilaca ya da çizgiye dokun</h4><p>Çizginin rengi etkileşimin derecesini gösterir. Bir ilaç seçince yalnız onun etkileşimleri parlar; bir çizgiye dokununca mekanizma ve eczacının yapacağı açılır.</p><p class="sub">Turuncu düğümler besin ya da alışkanlık.</p></div>';
  };
  var testKur = function () {
    var r = C.rng(Date.now() % 99991), var_ = C.shuffle(V.ETK, r).slice(0, 7).map(function (e) { return { a: e.a, b: e.b, d: e.derece, e: e }; }), ids = V.ILAC.map(function (x) { return x.id; }), yok = [];
    var g = 0; while (yok.length < 3 && g++ < 200) { var a = ids[Math.floor(r() * ids.length)], b = ids[Math.floor(r() * ids.length)]; if (a !== b && !V.etkilesim(a, b) && !yok.some(function (y) { return (y.a === a && y.b === b) || (y.a === b && y.b === a); })) yok.push({ a: a, b: b, d: 'yok', e: null }); }
    S.test = { L: C.shuffle(var_.concat(yok), r), i: 0, cev: [] };
  };
  var testHTML = function () {
    var T = S.test; if (!T) { testKur(); T = S.test; }
    if (T.i >= T.L.length) {
      var d = T.cev.filter(function (c) { return c; }).length, pct = Math.round(d / T.L.length * 100);
      return '<div class="card" style="max-width:760px">' + C.karne(pct, 'Çift testi karnesi', T.L.map(function (q, i) { return [T.cev[i], X(V.dugum(q.a).ad + ' + ' + V.dugum(q.b).ad) + ': ' + X(V.DERECE[q.d].ad)]; }), 'Etkileşimi olmayan çiftleri de tanımak önemlidir: gereksiz uyarı hastayı ilaçtan soğutur.') + '<div class="row" style="margin-top:12px"><button type="button" class="btn pri" data-yenitest>Yeni test</button></div></div>';
    }
    var q = T.L[T.i], c = T.cev[T.i];
    return '<div class="card" style="max-width:760px"><span class="k">soru ' + (T.i + 1) + '/' + T.L.length + '</span><div class="seri" aria-hidden="true">' + T.L.map(function (x, i) { return '<i class="' + (T.cev[i] === true ? 'ok' : T.cev[i] === false ? 'no' : i === T.i ? 'on' : '') + '"></i>'; }).join('') + '</div>' +
      '<div class="cift"><div class="kt">' + X(V.dugum(q.a).ad) + '</div><div class="art">+</div><div class="kt">' + X(V.dugum(q.b).ad) + '</div></div><div class="q">Birlikte kullanılırsa?</div>' +
      '<div class="derece">' + ['kontrendike', 'ciddi', 'orta', 'yok'].map(function (k) { return '<button type="button" data-der="' + k + '" style="--dc:' + V.DERECE[k].renk + '" class="' + (c != null && T.sec === k ? 'sec' : '') + '"' + (c != null ? ' disabled' : '') + '>' + X(V.DERECE[k].ad) + '</button>'; }).join('') + '</div>' +
      (c != null ? '<div class="find ' + (c ? 'ok' : 'no') + '" style="margin-top:12px">' + (c ? '<b>Doğru.</b> ' : '<b>Doğrusu: ' + X(V.DERECE[q.d].ad) + '.</b> ') + (q.e ? X(q.e.mek) + ' <i>' + X(q.e.oneri) + '</i>' : 'Bu iki ilaç arasında klinik açıdan önemli bir etkileşim bilinmiyor; yine de hastanın diğer ilaçları taranmalı.') + '</div><div class="row" style="margin-top:12px"><button type="button" class="btn pri" data-sonrakiq>' + (T.i < T.L.length - 1 ? 'Sonraki çift →' : 'Karneyi gör') + '</button></div>' : '') + '</div>';
  };
  var kartHTML = function () {
    var q = S.ara.toLocaleLowerCase('tr'), L = V.ILAC.filter(function (x) { return !q || (x.ad + ' ' + x.grup).toLocaleLowerCase('tr').indexOf(q) >= 0; });
    return '<div class="row" style="margin-bottom:12px"><label class="vh" for="ik-ara">İlaç ara</label><input class="ara" id="ik-ara" type="search" placeholder="ilaç ya da grup ara…" value="' + X(S.ara) + '"><span class="sub">' + L.length + ' kart · karta dokun, arkasını çevir</span></div><div class="kartlar">' +
      L.map(function (x) {
        return '<div class="ikart"><button type="button" data-cev aria-label="' + X(x.ad) + ' kartı, çevir"><div class="yz">' + C.kutu(x) + '<h4>' + X(x.ad) + '</h4><span class="pill">' + X(x.grup) + '</span>' + (x.rec !== 'normal' ? ' <span class="pill ' + (x.rec === 'kirmizi' ? 'bad' : 'ok') + '">' + (x.rec === 'kirmizi' ? 'kırmızı reçete' : 'yeşil reçete') + '</span>' : '') + '<p class="sub" style="margin:8px 0 0">Mekanizması ve uyarısı ne?</p></div>' +
          '<div class="yz ar"><b>Mekanizma:</b> ' + X(x.mek) + '<br><b>Enzim:</b> ' + X(x.cyp) + '<br><b>Uyarı:</b> ' + X(x.uyari) + '<br><b>Danışmanlık:</b> ' + X(x.kullanim) + '</div></button></div>';
      }).join('') + '</div>';
  };
  var paint = function () {
    var h = '<div class="bas"><div><span class="k">etkileşim ve farmakoloji</span><h1>' + (S.mod === 'ag' ? 'Etkileşim ağı' : S.mod === 'test' ? 'Çift testi' : 'İlaç kartları') + '</h1><p>' + (S.mod === 'ag' ? V.ETK.length + ' etkileşim, ' + DUG.length + ' düğüm. Statin, antikoagülan, serotonerjik ve emilim etkileşimleri en sık eczane sorunları.' : S.mod === 'test' ? 'İki ilacı birlikte kullanırsa ne olur? Derecesini seç; etkileşimi olmayan çiftler de var.' : 'Grubu, mekanizması, enzim ilişkisi ve hastaya söylenecek en önemli cümle.') + '</p></div>' +
      '<div class="seg" role="group" aria-label="Görünüm">' + [['ag', 'Ağ haritası'], ['test', 'Çift testi'], ['kart', 'İlaç kartları']].map(function (o) { return '<button type="button" data-mod="' + o[0] + '" aria-pressed="' + (S.mod === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div></div>';
    if (S.mod === 'ag') {
      h += '<div class="et"><div class="card ag' + (S.secD || S.secK ? ' secili' : '') + '"><div class="lejant" style="margin-bottom:6px">' + ['kontrendike', 'ciddi', 'orta'].map(function (k) { return '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" data-filtre="' + k + '"' + (S.filtre[k] ? ' checked' : '') + '><i style="background:' + V.DERECE[k].renk + '"></i>' + X(V.DERECE[k].ad) + '</label>'; }).join('') + (S.secD || S.secK ? '<button type="button" class="btn" style="min-height:32px;padding:0 10px" data-temizle>Seçimi temizle</button>' : '') + '</div>' + agSVG() + '</div><div>' + detay() + '</div></div>';
    } else if (S.mod === 'test') h += testHTML();
    else h += kartHTML();
    el().innerHTML = h;
  };
  EC.st.etk = {
    init: function () {
      paint();
      el().addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-mod]'))) { S.mod = b.getAttribute('data-mod'); paint(); EC.bridgeSend(); return; }
        if (e.target.closest('[data-temizle]')) { S.secD = S.secK = null; paint(); return; }
        if ((b = e.target.closest('[data-k],[data-k2]'))) { S.secK = b.getAttribute('data-k') || b.getAttribute('data-k2'); S.secD = null; paint(); EC.bridgeSend(); return; }
        if ((b = e.target.closest('[data-d]'))) { var id = b.getAttribute('data-d'); S.secD = S.secD === id ? null : id; S.secK = null; paint(); EC.bridgeSend(); return; }
        if ((b = e.target.closest('[data-der]'))) { var T = S.test, q = T.L[T.i]; T.sec = b.getAttribute('data-der'); T.cev[T.i] = T.sec === q.d; paint(); return; }
        if (e.target.closest('[data-sonrakiq]')) { S.test.i++; S.test.sec = null; paint(); return; }
        if (e.target.closest('[data-yenitest]')) { testKur(); paint(); return; }
        if ((b = e.target.closest('[data-cev]'))) { b.classList.toggle('cev'); }
      });
      el().addEventListener('change', function (e) { var f = e.target.getAttribute('data-filtre'); if (f) { S.filtre[f] = e.target.checked; paint(); } });
      el().addEventListener('input', function (e) { if (e.target.id === 'ik-ara') { S.ara = e.target.value; var pos = e.target.selectionStart; paint(); var i = $('#ik-ara'); i.focus(); try { i.setSelectionRange(pos, pos); } catch (er) { /* tarayıcı desteklemiyor */ } } });
      el().addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-d]')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
    },
    ctx: function () {
      var rows = [], t = 'Etkileşim ağı';
      if (S.secK) { var p = S.secK.split('|'), e = V.etkilesim(p[0], p[1]); rows = [['Çift', V.dugum(e.a).ad + ' + ' + V.dugum(e.b).ad], ['Derece', V.DERECE[e.derece].ad], ['Mekanizma', e.mek]]; t = 'Etkileşim · ' + rows[0][1]; }
      else if (S.secD) { rows = [['Seçili', V.dugum(S.secD).ad]]; }
      if (S.mod === 'test' && S.test && S.test.L[S.test.i]) { var q = S.test.L[S.test.i]; rows = [['Soru', V.dugum(q.a).ad + ' + ' + V.dugum(q.b).ad]]; t = 'Çift testi'; }
      return { sel: { key: 'ecz.etk.' + S.mod + '.' + (S.secK || S.secD || ''), title: t, la: 'Etkileşim ve farmakoloji', rows: rows, about: 'öğrenci Eczacılık Lab etkileşim istasyonunda (' + S.mod + '). Testte cevabı söyleme; mekanizmayı (CYP inhibisyonu/indüksiyonu, farmakodinamik toplam etki, şelasyon) düşündür.' }, chips: [['cyp', 'CYP etkileşimleri nasıl olur?'], ['ipucu', 'Bu çift için ipucu ver']] };
    },
    classify: function (q) { if (/cyp|enzim/.test(q)) return 'cyp'; if (/ipucu/.test(q)) return 'ipucu'; return null; },
    answer: function (k) {
      if (k === 'cyp') return 'Bir ilaç, başka bir ilacı yıkan enzimi (ör. CYP3A4) baskılarsa ikincinin düzeyi yükselir (klaritromisin → simvastatin); enzimi indüklerse düzeyi düşer (rifampisin → oral kontraseptif). Farmakodinamik etkileşimde ise iki ilaç aynı yöne etki eder (iki serotonerjik, iki potasyum tutucu).';
      if (S.mod === 'test' && S.test && S.test.L[S.test.i]) { var q = S.test.L[S.test.i], a = V.ilac(q.a), b = V.ilac(q.b); return 'İpucu: ' + [a, b].filter(Boolean).map(function (x) { return x.ad + ' (' + x.grup + (x.cyp !== '—' ? ', ' + x.cyp : '') + ')'; }).join(' ve ') + '. Ortak bir enzim, aynı yöne etki ya da emilim sorunu var mı?'; }
      return 'İpucu: önce enzim ilişkisine (inh/ind/sub), sonra iki ilacın aynı yöne etkisine (kanama, potasyum, serotonin, solunum), en son emilime bak.';
    }
  };
})();
