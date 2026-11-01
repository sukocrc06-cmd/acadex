/* ==========================================================================
   ACADEX HEMŞİRELİK LAB · KLİNİK VAKA MASASI (labs/hemsirelik/hem-vaka.js)
   Acadex Medica'nın 7. katından (dahiliye servisi) gelen hastanın dosyası:
   değerlendirme → hemşirelik tanısı → girişimler → karne.
   Sonuç hastaneye bildirilir. Sekme yalnız ?medica=1 ile görünür.
   ========================================================================== */
(function () {
  'use strict';
  var HM = window.HM, C = HM.core, V = C.V, $ = C.$, X = C.X;
  /* Acadex Medica: hastanın dosyası ?vaka=<id> ile gelir; karne sonucu hastaneye bildirilir */
  var Q = new URLSearchParams(location.search), MV = C.MEDICA ? Q.get('vaka') : null;
  /* Acadex Medica her ziyarette hastaya yeni ad verir (?ad=): unvan (Bey/Hanım) korunur */
  var MAD = C.MEDICA ? Q.get('ad') : null;
  if (MV && MAD) V.VAKA.forEach(function (v) { if (v.id === MV) v.ad = MAD.slice(0, 30) + (/ (Bey|Hanım)$/.test(v.ad) ? ' ' + v.ad.split(' ').pop() : ''); });
  var S = { id: MV && V.VAKA.some(function (v) { return v.id === MV; }) ? MV : C.ls.get('vk.id', V.VAKA[0].id), st: 0, sel: { deg: {}, tani: null, terapi: {} }, done: C.ls.get('vk.done', {}) };
  var medica = function (pct) { if (!C.MEDICA || window.parent === window) return; try { window.parent.postMessage({ src: 'axmedica', type: 'sonuc', lab: 'hemsirelik', vaka: S.id, puan: pct, tamam: true }, location.origin); } catch (e) { /* hastane yok */ } };
  var vaka = function () { return V.VAKA.filter(function (v) { return v.id === S.id; })[0] || V.VAKA[0]; };
  var av = function (sz) { return '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="24" r="14" fill="#E8B48A" stroke="#0D1838" stroke-width="2"/><path d="M9 22 C9 8 35 8 35 22 C33 14 11 14 9 22 Z" fill="#7A5A3E"/><circle cx="17.5" cy="24" r="1.8" fill="#0D1838"/><circle cx="26.5" cy="24" r="1.8" fill="#0D1838"/><path d="M18 30 C20 32 24 32 26 30" stroke="#0D1838" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>'; };
  var chk = function (name, list, multi, sel, shown) {
    return '<div class="chk">' + list.map(function (o) {
      var on = multi ? !!sel[o[0]] : sel === o[0], cls = '';
      if (shown) { if (o[2] && on) cls = 'ok'; else if (!o[2] && on) cls = 'no'; else if (o[2] && !on) cls = 'miss'; }
      return '<label class="' + cls + '"><input type="' + (multi ? 'checkbox' : 'radio') + '" name="' + name + '" value="' + o[0] + '"' + (on ? ' checked' : '') + (shown ? ' disabled' : '') + '>' + X(o[1]) + '</label>';
    }).join('') + '</div>';
  };
  var scoreMulti = function (list, sel) { var need = list.filter(function (o) { return o[2]; }).length, tp = 0, fp = 0; list.forEach(function (o) { if (sel[o[0]]) { if (o[2]) tp++; else fp++; } }); return Math.max(0, (tp - fp) / need); };
  var paintList = function () {
    $('#vk-list').innerHTML = V.VAKA.map(function (v) { var d = S.done[v.id]; return '<button type="button" class="pc" data-v="' + v.id + '" aria-pressed="' + (v.id === S.id) + '" style="--ac:' + v.renk + '"><span class="av">' + av(40) + '</span><span><b>' + X(v.ad) + '</b><small>' + X(v.yas) + ' · ' + X(v.sikayet.slice(0, 44)) + '…</small></span>' + (d != null ? '<span class="pill ' + (d >= 85 ? 'ok' : d >= 60 ? 'warn' : 'bad') + '" style="margin-left:auto">%' + d + '</span>' : '') + '</button>'; }).join('');
  };
  var paint = function () {
    var v = vaka(), L = ['Değerlendirme', 'Hemşirelik tanısı', 'Girişimler', 'Karne'], h = '<div class="folder" style="--fc:' + v.renk + '">';
    h += '<div class="row" style="gap:14px"><span style="display:grid;place-items:center;width:64px;height:64px;border-radius:50%;background:' + v.renk + '">' + av(56) + '</span><div><span class="k">hemşire gözlem dosyası · kurgusal</span><h2 class="disp" style="margin:2px 0 0;font-size:24px">' + X(v.ad) + ', ' + X(v.yas) + '</h2></div></div>';
    h += '<div class="steps">' + L.map(function (l, i) { return '<span class="' + (i === S.st ? 'on' : i < S.st ? 'done' : '') + '">' + (i < S.st ? '✓ ' : (i + 1) + '. ') + l + '</span>'; }).join('') + '</div>';
    h += '<p style="font-size:14.5px;line-height:1.6;margin:0 0 6px"><b>Başvuru:</b> ' + X(v.sikayet) + '</p><p class="sub" style="font-size:13.5px">' + X(v.oyku) + '</p>';
    h += '<div class="q">1. Neleri değerlendirirsin? <span class="sub">(birden çok)</span></div>' + chk('deg', v.deg, true, S.sel.deg, S.st > 0);
    if (S.st === 0) h += '<div class="row" style="margin-top:12px"><button type="button" class="btn pri" data-go="1">Değerlendir</button></div>';
    if (S.st > 0) {
      h += '<div class="find" style="margin-top:12px"><b>Bulgular:</b> ' + X(v.bulgu) + '</div><div class="q">2. Öncelikli hemşirelik tanısı?</div>' + chk('tani', v.tani, false, S.sel.tani, S.st > 1);
      if (S.st === 1) h += '<div class="row" style="margin-top:12px"><button type="button" class="btn pri" data-go="2">Tanıyı kaydet</button></div>';
    }
    if (S.st > 1) {
      h += '<div class="q">3. Hemşirelik girişimleri <span class="sub">(birden çok)</span></div>' + chk('terapi', v.terapi, true, S.sel.terapi, S.st > 2);
      if (S.st === 2) h += '<div class="row" style="margin-top:12px"><button type="button" class="btn grn" data-go="3">Dosyayı kapat</button></div>';
    }
    if (S.st > 2) {
      var sd = scoreMulti(v.deg, S.sel.deg), st = v.tani.filter(function (o) { return o[2]; })[0][0] === S.sel.tani ? 1 : 0, sr = scoreMulti(v.terapi, S.sel.terapi), pct = Math.round((sd + st + sr) / 3 * 100);
      if (S.done[v.id] !== pct) { S.done[v.id] = pct; C.ls.set('vk.done', S.done); paintList(); }
      if (S.bildirildi !== v.id) { S.bildirildi = v.id; medica(pct); }
      h += C.karne(pct, v.ad + ' · vaka karnesi', [[sd >= 0.99, 'Değerlendirme: %' + Math.round(sd * 100)], [!!st, 'Tanı: ' + (st ? 'doğru' : 'doğrusu “' + X(v.tani.filter(function (o) { return o[2]; })[0][1]) + '”')], [sr >= 0.99, 'Girişimler: %' + Math.round(sr * 100)]], '<b>Neden?</b> ' + X(v.ozet));
      h += '<div class="row" style="margin-top:12px"><button type="button" class="btn" data-go="0">Vakayı baştan çöz</button></div>';
    }
    $('#vk-main').innerHTML = h + '</div>';
  };
  var open = function (id) { S.id = id; S.st = 0; S.sel = { deg: {}, tani: null, terapi: {} }; S.bildirildi = null; C.ls.set('vk.id', id); paintList(); paint(); HM.bridgeSend(); };
  HM.st.vaka = {
    init: function () {
      paintList(); paint();
      $('#vk-list').addEventListener('click', function (e) { var b = e.target.closest('[data-v]'); if (b) open(b.getAttribute('data-v')); });
      $('#vk-main').addEventListener('change', function (e) { var t = e.target; if (!t.name) return; if (t.name === 'tani') S.sel.tani = t.value; else S.sel[t.name][t.value] = t.checked; });
      $('#vk-main').addEventListener('click', function (e) {
        var b = e.target.closest('[data-go]'); if (!b) return;
        var g = +b.getAttribute('data-go');
        if (g === 1 && !Object.keys(S.sel.deg).some(function (k) { return S.sel.deg[k]; })) { C.toast('En az bir değerlendirme seç.'); return; }
        if (g === 2 && !S.sel.tani) { C.toast('Bir hemşirelik tanısı seç.'); return; }
        if (g === 3 && !Object.keys(S.sel.terapi).some(function (k) { return S.sel.terapi[k]; })) { C.toast('En az bir girişim seç.'); return; }
        if (g === 0) { S.sel = { deg: {}, tani: null, terapi: {} }; S.bildirildi = null; }
        S.st = g; paint(); HM.bridgeSend();
      });
    },
    ctx: function () {
      var v = vaka();
      return { sel: { key: 'hem.vaka.' + v.id + '.' + S.st, title: 'Vaka · ' + v.ad + ', ' + v.yas, la: 'Klinik vaka', rows: [['Başvuru', v.sikayet], ['Öykü', v.oyku]].concat(S.st > 0 ? [['Bulgular', v.bulgu]] : []), about: 'öğrenci Hemşirelik Lab klinik vaka masasında kurgusal bir servis hastasını değerlendiriyor. Karne açılmadan cevabı verme; düşündüren sorular sor.' }, chips: [['ipucu', 'Bu adım için ipucu ver']] };
    },
    classify: function (q) { return /ipucu/.test(q) ? 'ipucu' : null; },
    answer: function () {
      if (S.st === 0) return 'İpucu: hemşirelik değerlendirmesi sorunla ilgili gözlem ve ölçümlerdir (vital bulgular, NEWS2, ağrı, bilinç, aldığı-çıkardığı). Sorunla ilgisiz tetkikler puan kaybettirir.';
      if (S.st === 1) return 'İpucu: hemşirelik tanısı tıbbi tanı değildir; hastanın yaşadığı ya da risk altında olduğu sorunu (gaz değişimi, ağrı, düşme riski…) adlandırır.';
      return 'İpucu: girişimler bağımsız (pozisyon, izlem, eğitim) ve iş birliğine dayalı (hekime bildirim, istem uygulama) olabilir; hasta güvenliğini bozan seçeneklerden kaçın.';
    }
  };
})();
