/* ==========================================================================
   ACADEX HEMŞİRELİK LAB · SERVİS VARDİYASI (labs/hemsirelik/hem-servis.js)
   08:00 devir: beş hastalık panodan öncelik sırası → gün içindeki üç olay →
   en riskli hasta için SBAR bildirimi → vardiya karnesi. Her vardiyada hasta
   karması değişir.
   ========================================================================== */
(function () {
  'use strict';
  var HM = window.HM, C = HM.core, V = C.V, $ = C.$, X = C.X;
  var el = function () { return $('#servis'); };
  var S = null, en = C.ls.get('sv.en', null);
  var yeni = function () {
    var r = C.rng(Date.now() % 88883), ids = C.shuffle(V.SERVIS.map(function (x) { return x.id; }), r).slice(0, 5);
    var olay = C.shuffle(ids, r).slice(0, 3).map(function (id, i) { var o = V.servis(id).olay; return { id: id, saat: ['09:30', '11:45', '14:10'][i], kar: C.shuffle(o.o.map(function (x, k) { return [k, x[0], x[1]]; }), r) }; });
    var hedef = V.dogruSira(ids)[0], sbar = {};
    ['S', 'B', 'A', 'R'].forEach(function (L) { var dog = V.servis(hedef).sbar[L], diger = C.shuffle(V.SERVIS.filter(function (x) { return x.id !== hedef; }), r).slice(0, 2).map(function (x) { return x.sbar[L]; }); sbar[L] = C.shuffle([[dog, true]].concat(diger.map(function (t) { return [t, false]; })), r); });
    S = { st: 0, ids: ids, sira: [], olay: olay, oc: {}, hedef: hedef, sbar: sbar, sc: {} };
  };
  yeni();
  var ADLAR = { S: 'Durum (Situation)', B: 'Öykü (Background)', A: 'Değerlendirme (Assessment)', R: 'Öneri (Recommendation)' };
  var paint = function () {
    var h = '<div class="bas"><div><span class="k">servis vardiyası · 08:00 devir</span><h1>Bugünkü hastaların</h1><p>Önce kime gideceğine karar ver: hastalara öncelik sırasıyla dokun. Sonra gün içindeki olaylara yanıt ver ve en riskli hastayı hekime SBAR ile bildir.</p></div><button type="button" class="btn" data-yeni>Yeni vardiya</button></div>';
    var L = ['Öncelik', 'Olaylar', 'SBAR', 'Karne'];
    h += '<div class="steps">' + L.map(function (l, i) { return '<span class="' + (i === S.st ? 'on' : i < S.st ? 'done' : '') + '">' + (i < S.st ? '✓ ' : (i + 1) + '. ') + l + '</span>'; }).join('') + '</div>';
    var dog = V.dogruSira(S.ids);
    h += '<div class="pano" role="group" aria-label="Hasta panosu">' + S.ids.map(function (id) {
      var x = V.servis(id), n = S.sira.indexOf(id);
      return '<button type="button" class="hk' + (n >= 0 ? ' sec' : '') + '" data-hk="' + id + '"' + (S.st > 0 ? ' disabled' : '') + '>' + (n >= 0 ? '<span class="sira">' + (n + 1) + '</span>' : '') + '<span class="no">oda ' + x.oda + '</span><b>' + X(x.ad) + ', ' + x.yas + '</b><span class="pill">' + X(x.tani) + '</span><p>' + X(x.ozet) + '</p>' + (S.st > 0 ? '<p><span class="pill ' + (dog.indexOf(id) === n ? 'ok' : 'warn') + '">doğru sıra: ' + (dog.indexOf(id) + 1) + '</span></p>' : '') + '</button>';
    }).join('') + '</div>';
    if (S.st === 0) h += '<div class="row" style="margin-top:12px"><button type="button" class="btn" data-sifirla>Sırayı sıfırla</button>' + (S.sira.length === S.ids.length ? '<button type="button" class="btn pri" data-adim="1">Önceliği kaydet →</button>' : '<span class="sub">' + S.sira.length + '/' + S.ids.length + ' hasta sıralandı</span>') + '</div>';
    if (S.st >= 1) {
      h += '<div class="card" style="margin-top:16px"><div class="q">Gün içinde</div><div class="zaman">' + S.olay.map(function (o, i) {
        var x = V.servis(o.id), sec = S.oc[i];
        return '<div class="olay"><span class="sa">' + o.saat + '</span><div><b>' + X(x.ad) + ' (oda ' + x.oda + '):</b> ' + X(x.olay.metin) + '<div class="chk" style="margin-top:8px">' + o.kar.map(function (k) { var on = sec === k[0], cls = S.st > 1 ? (k[2] ? (on ? 'ok' : 'miss') : on ? 'no' : '') : ''; return '<label class="' + cls + '"><input type="radio" name="o' + i + '" data-olay="' + i + '" value="' + k[0] + '"' + (on ? ' checked' : '') + (S.st > 1 ? ' disabled' : '') + '>' + X(k[1]) + '</label>'; }).join('') + '</div></div></div>';
      }).join('') + '</div>';
      if (S.st === 1) h += '<div class="row" style="margin-top:12px"><button type="button" class="btn pri" data-adim="2">SBAR’a geç →</button></div>';
      h += '</div>';
    }
    if (S.st >= 2) {
      var hx = V.servis(S.hedef);
      h += '<div class="card" style="margin-top:16px"><div class="q">Hekime telefon: ' + X(hx.ad) + ' (oda ' + hx.oda + ')</div><p class="sub" style="margin:0 0 8px">Her harf için doğru cümleyi seç.</p><div class="sbar">' + ['S', 'B', 'A', 'R'].map(function (Lt) {
        return '<fieldset><legend><b>' + Lt + '</b>' + X(ADLAR[Lt]) + '</legend><div class="chk">' + S.sbar[Lt].map(function (o, k) { var on = S.sc[Lt] === k, cls = S.st > 2 ? (o[1] ? (on ? 'ok' : 'miss') : on ? 'no' : '') : ''; return '<label class="' + cls + '"><input type="radio" name="sb' + Lt + '" data-sb="' + Lt + '" value="' + k + '"' + (on ? ' checked' : '') + (S.st > 2 ? ' disabled' : '') + '>' + X(o[0]) + '</label>'; }).join('') + '</div></fieldset>';
      }).join('') + '</div>';
      if (S.st === 2) h += '<div class="row" style="margin-top:12px"><button type="button" class="btn grn" data-adim="3">Vardiyayı devret</button></div>';
      h += '</div>';
    }
    if (S.st >= 3) {
      var sp = V.siraPuan(S.sira), op = S.olay.filter(function (o, i) { return S.oc[i] != null && V.servis(o.id).olay.o[S.oc[i]][1]; }).length / S.olay.length;
      var sb = ['S', 'B', 'A', 'R'].filter(function (Lt) { return S.sc[Lt] != null && S.sbar[Lt][S.sc[Lt]][1]; }).length / 4, pct = Math.round((sp + op * 1.5 + sb) / 3.5 * 100);
      if (en == null || pct > en) { en = pct; C.ls.set('sv.en', pct); }
      h += '<div style="max-width:820px">' + C.karne(pct, 'Vardiya karnesi', [[sp >= 0.99, 'Öncelik sırası: %' + Math.round(sp * 100)], [op >= 0.99, 'Olaylara yanıt: ' + Math.round(op * 3) + '/3'], [sb >= 0.99, 'SBAR: ' + Math.round(sb * 4) + '/4']], 'Öncelik: önce havayolu-solunum-dolaşım tehdidi (düşen SpO₂, transfüzyon reaksiyonu), sonra hızla kötüleşebilecek durumlar (hipoglisemi, sıvı yüklenmesi), sonra konfor ve güvenlik, en son planlı işler (taburculuk eğitimi). En iyi vardiyan: %' + en + '.') + '<div class="row" style="margin-top:12px"><button type="button" class="btn pri" data-yeni>Yeni vardiya</button></div></div>';
    }
    el().innerHTML = h;
  };
  HM.st.servis = {
    init: function () {
      paint();
      el().addEventListener('change', function (e) { var t = e.target, o = t.getAttribute('data-olay'), s = t.getAttribute('data-sb'); if (o != null) S.oc[o] = +t.value; if (s) S.sc[s] = +t.value; });
      el().addEventListener('click', function (e) {
        var b;
        if (e.target.closest('[data-yeni]')) { yeni(); paint(); HM.bridgeSend(); return; }
        if ((b = e.target.closest('[data-hk]'))) { if (S.st) return; var id = b.getAttribute('data-hk'), i = S.sira.indexOf(id); if (i >= 0) S.sira.splice(i, 1); else S.sira.push(id); paint(); return; }
        if (e.target.closest('[data-sifirla]')) { S.sira = []; paint(); return; }
        if ((b = e.target.closest('[data-adim]'))) {
          var g = +b.getAttribute('data-adim');
          if (g === 2 && S.olay.some(function (o, i) { return S.oc[i] == null; })) { C.toast('Her olaya bir yanıt seç.'); return; }
          if (g === 3 && ['S', 'B', 'A', 'R'].some(function (Lt) { return S.sc[Lt] == null; })) { C.toast('SBAR’ın dört harfini de doldur.'); return; }
          S.st = g; paint(); HM.bridgeSend();
        }
      });
    },
    ctx: function () {
      return { sel: { key: 'hem.servis.' + S.st, title: 'Servis vardiyası', la: 'Servis vardiyası', rows: S.ids.map(function (id) { var x = V.servis(id); return [x.ad + ' (' + x.oda + ')', x.ozet]; }), about: 'öğrenci Hemşirelik Lab servis vardiyasında önceliklendirme ve SBAR yapıyor. Sıralamayı doğrudan verme; ABC ve kötüleşme riskini düşündür.' }, chips: [['oncelik', 'Önceliği nasıl belirlerim?'], ['sbar', 'SBAR nedir?']] };
    },
    classify: function (q) { if (/öncelik|sıra/.test(q)) return 'oncelik'; if (/sbar/.test(q)) return 'sbar'; return null; },
    answer: function (k) {
      if (k === 'sbar') return 'SBAR yapılandırılmış bildirimdir: S (durum) şu an ne oluyor; B (öykü) tanı ve ilgili geçmiş; A (değerlendirme) senin klinik yorumun, skor ve bulgular; R (öneri) hekimden ne istediğin. Kısa, ölçülebilir ve net olmalı.';
      return 'Önceliklendirmede önce yaşamı tehdit eden ABC sorunları (havayolu, solunum, dolaşım), sonra hızla kötüleşebilecek durumlar, sonra güvenlik ve konfor, en son planlı işler gelir. Sayısal bulgular (SpO₂, kan şekeri, ateş) yol gösterir.';
    }
  };
})();
