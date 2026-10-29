/* ==========================================================================
   ACADEX DKT LAB · KLİNİK VAKA MASASI (labs/dkt/dkt-vaka.js), 29.10.2026
   Kurgusal vaka dosyası: öykü → değerlendirme seç → bulgular → tanısal
   izlenim → terapi yaklaşımı → karne. Doğru/yanlış gerekçesiyle.
   ========================================================================== */
(function () {
  'use strict';
  var DK = window.DK, C = DK.core, V = C.V, $ = C.$, $$ = C.$$, X = C.X;
  var S = { id: C.ls.get('vk.id', V.VAKA[0].id), st: 0, sel: { deg: {}, tani: null, terapi: {} }, sc: {}, done: C.ls.get('vk.done', {}) };
  var vaka = function () { return V.VAKA.filter(function (v) { return v.id === S.id; })[0] || V.VAKA[0]; };
  var av = function (v, sz) {
    var kid = v.ikon === 'cocuk';
    return '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="24" r="' + (kid ? 13 : 14) + '" fill="#F4C9A8" stroke="#0D1838" stroke-width="2"/>' +
      (kid ? '<path d="M10 20 C12 8 32 8 34 20 C28 15 16 15 10 20 Z" fill="#7A5230"/>' : '<path d="M9 22 C9 8 35 8 35 22 C33 14 11 14 9 22 Z" fill="#B9B4A8"/>') +
      '<circle cx="17.5" cy="24" r="1.8" fill="#0D1838"/><circle cx="26.5" cy="24" r="1.8" fill="#0D1838"/><path d="M18 30 C20 32 24 32 26 30" stroke="#0D1838" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>';
  };
  var paintList = function () {
    $('#vk-list').innerHTML = V.VAKA.map(function (v) {
      var d = S.done[v.id];
      return '<button type="button" class="pc" data-v="' + v.id + '" aria-pressed="' + (v.id === S.id) + '" style="--ac:' + v.renk + '"><span class="av">' + av(v, 40) + '</span><span><b>' + X(v.ad) + '</b><small>' + X(v.yas) + ' · ' + X(v.sikayet.split('.')[0].slice(0, 46)) + '…</small></span>' + (d != null ? '<span class="done pill ' + (d >= 85 ? 'ok' : d >= 60 ? 'warn' : 'bad') + '">%' + d + '</span>' : '') + '</button>';
    }).join('');
  };
  var steps = function () {
    var L = ['Öykü ve değerlendirme', 'Tanısal izlenim', 'Terapi', 'Karne'];
    return '<div class="vk-steps">' + L.map(function (l, i) { return '<span class="' + (i === S.st ? 'on' : i < S.st ? 'done' : '') + '">' + (i < S.st ? '✓ ' : (i + 1) + '. ') + l + '</span>'; }).join('') + '</div>';
  };
  var chk = function (name, list, multi, sel, shown) {
    return '<div class="chk">' + list.map(function (o) {
      var on = multi ? !!sel[o[0]] : sel === o[0], cls = '';
      if (shown) { if (o[2] && on) cls = 'ok'; else if (!o[2] && on) cls = 'no'; else if (o[2] && !on) cls = 'miss'; }
      return '<label class="' + cls + '"><input type="' + (multi ? 'checkbox' : 'radio') + '" name="' + name + '" value="' + o[0] + '"' + (on ? ' checked' : '') + (shown ? ' disabled' : '') + '>' + X(o[1]) + (shown && o[2] ? ' <span class="pill ok" style="margin-left:auto">uygun</span>' : '') + '</label>';
    }).join('') + '</div>';
  };
  var scoreMulti = function (list, sel) {
    var need = list.filter(function (o) { return o[2]; }).length, tp = 0, fp = 0;
    list.forEach(function (o) { if (sel[o[0]]) { if (o[2]) tp++; else fp++; } });
    return Math.max(0, (tp - fp) / need);
  };
  var paint = function () {
    var v = vaka(), h = '<div class="folder" style="--fc:' + v.renk + '">';
    h += '<div class="row" style="gap:14px;align-items:center"><span style="display:grid;place-items:center;width:64px;height:64px;border-radius:50%;background:' + v.renk + '">' + av(v, 56) + '</span><div><span class="k">vaka dosyası · kurgusal</span><h2 class="disp" style="margin:2px 0 0;font-size:24px">' + X(v.ad) + ', ' + X(v.yas) + '</h2></div></div>';
    h += steps();
    h += '<p style="font-size:14.5px;line-height:1.6;margin:0 0 6px"><b>Başvuru:</b> ' + X(v.sikayet) + '</p><p class="sub" style="font-size:13.5px">' + X(v.oyku) + '</p>';
    h += '<div class="vk-q">1. Hangi değerlendirmeleri yaparsın? <span class="sub">(birden çok)</span></div>' + chk('deg', v.deg, true, S.sel.deg, S.st > 0);
    if (S.st === 0) h += '<div class="row" style="margin-top:12px"><button type="button" class="btn pri" data-go="1">Değerlendirmeyi yap</button></div>';
    if (S.st > 0) {
      h += '<div class="find" style="margin-top:12px"><b>Bulgular:</b> ' + X(v.bulgu) + '</div>';
      h += '<div class="vk-q">2. Tanısal izlenimin ne?</div>' + chk('tani', v.tani, false, S.sel.tani, S.st > 1);
      if (S.st === 1) h += '<div class="row" style="margin-top:12px"><button type="button" class="btn pri" data-go="2">İzlenimi kaydet</button></div>';
    }
    if (S.st > 1) {
      h += '<div class="vk-q">3. Hangi terapi yaklaşımları uygun? <span class="sub">(birden çok)</span></div>' + chk('terapi', v.terapi, true, S.sel.terapi, S.st > 2);
      if (S.st === 2) h += '<div class="row" style="margin-top:12px"><button type="button" class="btn cor" data-go="3">Vakayı kapat</button></div>';
    }
    if (S.st > 2) {
      var sd = scoreMulti(v.deg, S.sel.deg), stn = v.tani.filter(function (o) { return o[2]; })[0][0] === S.sel.tani ? 1 : 0, sr = scoreMulti(v.terapi, S.sel.terapi), pct = Math.round((sd + stn + sr) / 3 * 100);
      if (S.done[v.id] !== pct) { S.done[v.id] = pct; C.ls.set('vk.done', S.done); paintList(); }
      h += C.karne(pct, v.ad + ' · vaka karnesi', [[sd >= 0.99, 'Değerlendirme: %' + Math.round(sd * 100)], [!!stn, 'Tanısal izlenim: ' + (stn ? 'doğru' : 'doğrusu "' + X(v.tani.filter(function (o) { return o[2]; })[0][1]) + '"')], [sr >= 0.99, 'Terapi: %' + Math.round(sr * 100)]], '<b>Neden?</b> ' + X(v.ozet));
      h += '<div class="row" style="margin-top:12px"><button type="button" class="btn" data-go="0">Vakayı baştan çöz</button>' + (nextId() ? '<button type="button" class="btn pri" data-next="1">Sıradaki vaka</button>' : '') + '</div>';
    }
    h += '</div>';
    $('#vk-main').innerHTML = h;
  };
  var nextId = function () { var i = V.VAKA.indexOf(vaka()); return V.VAKA[i + 1] ? V.VAKA[i + 1].id : null; };
  var open = function (id) { S.id = id; S.st = 0; S.sel = { deg: {}, tani: null, terapi: {} }; C.ls.set('vk.id', id); paintList(); paint(); DK.bridgeSend(); };

  DK.st.vaka = {
    init: function () {
      paintList(); paint();
      $('#vk-list').addEventListener('click', function (e) { var b = e.target.closest('[data-v]'); if (b) open(b.getAttribute('data-v')); });
      $('#vk-main').addEventListener('change', function (e) {
        var t = e.target; if (!t.name) return;
        if (t.name === 'tani') S.sel.tani = t.value;
        else S.sel[t.name][t.value] = t.checked;
      });
      $('#vk-main').addEventListener('click', function (e) {
        var n = e.target.closest('[data-next]'); if (n) { open(nextId()); $('#vk-main').scrollIntoView({ behavior: C.RM ? 'auto' : 'smooth', block: 'start' }); return; }
        var b = e.target.closest('[data-go]'); if (!b) return;
        var g = +b.getAttribute('data-go');
        if (g === 1 && !Object.keys(S.sel.deg).some(function (k) { return S.sel.deg[k]; })) { C.toast('En az bir değerlendirme seç.'); return; }
        if (g === 2 && !S.sel.tani) { C.toast('Bir tanısal izlenim seç.'); return; }
        if (g === 3 && !Object.keys(S.sel.terapi).some(function (k) { return S.sel.terapi[k]; })) { C.toast('En az bir terapi yaklaşımı seç.'); return; }
        if (g === 0) { S.sel = { deg: {}, tani: null, terapi: {} }; }
        S.st = g; paint(); DK.bridgeSend();
      });
    },
    ctx: function () {
      var v = vaka();
      return { sel: { key: 'dkt.vaka.' + v.id + '.' + S.st, title: 'Vaka · ' + v.ad + ', ' + v.yas, la: 'Klinik vaka', rows: [['Başvuru', v.sikayet], ['Öykü', v.oyku]].concat(S.st > 0 ? [['Bulgular', v.bulgu]] : []).concat([['Adım', ['değerlendirme', 'tanısal izlenim', 'terapi', 'karne'][S.st]]]),
          about: 'öğrenci DKT Lab klinik vaka masasında kurgusal bir vakayı çözüyor (adım: ' + ['değerlendirme seçimi', 'tanısal izlenim', 'terapi seçimi', 'karne'][S.st] + '). Karne açılmadan cevabı doğrudan verme; düşünmesini sağlayan sorular sor ve gerekçelendir.' },
        chips: [['ipucu', 'Bu adım için ipucu ver'], ['neden', 'Hangi bulgu en önemli?']] };
    },
    classify: function (q) { if (/ipucu/.test(q)) return 'ipucu'; if (/bulgu|önemli/.test(q)) return 'neden'; return null; },
    answer: function (k) {
      var v = vaka();
      if (k === 'ipucu') {
        if (S.st === 0) return 'İpucu: önce şikâyetin hangi alana ait olduğunu belirle (sesletim, akıcılık, dil, ses, yutma). Sonra o alanı değerlendiren aracı ve mutlaka dışlanması gereken durumları (örneğin çocukta işitme) düşün. Başka alanın testleri bu vakaya bir şey katmaz.';
        if (S.st === 1) return 'İpucu: bulgulardaki örüntüye bak. Hata tek bir sese mi, bir ses sınıfına mı yayılmış? Akıcılık, anlama, tekrar nasıl? Ses kalitesi ya da şiddet mi bozuk? Yutmada madde nereye kadar iniyor?';
        if (S.st === 2) return 'İpucu: seçtiğin izlenime yönelik, kanıtı olan yaklaşımları düşün; vakanın yaşına ve yaşam koşullarına (aile, iş, yatak başı) uygun olmalı. Başka bir bozukluğun terapisi buraya uymaz.';
        return v.ozet;
      }
      if (k === 'neden') return S.st > 0 ? 'Bulgularda öne çıkan: ' + v.bulgu : 'Önce değerlendirmeleri seç; bulgular ondan sonra açılır.';
      return null;
    }
  };
})();
