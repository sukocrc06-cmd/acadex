/* ==========================================================================
   ACADEX ECZACILIK LAB · ECZANE TEZGÂHI (labs/eczacilik/ecz-tezgah.js)
   Reçete gelir → geçerlilik → raftan doğru kutu → hasta profili (etkileşim,
   alerji, doz, reçete türü) → müdahale → danışmanlık → karne.
   Her açılışta hasta adı, yaşı ve hekim farklıdır (kişisel çeşitlilik).
   ========================================================================== */
(function () {
  'use strict';
  var EC = window.EC, C = EC.core, V = C.V, $ = C.$, X = C.X;
  var el = function () { return $('#tezgah'); };
  var DR = ['Dr. Aylin Kaya', 'Dr. Murat Şen', 'Dr. Ozan Tekin', 'Dr. Ebru Yıldız', 'Dr. Cem Uslu', 'Dr. Gizem Arı'];
  var r0 = C.rng(1), SIRA = C.shuffle(V.RECETE, r0);
  var KISI = {}, kullan = {}; SIRA.forEach(function (r, i) { var k = V.kisi(r.hasta, C.rng(10 + i)), dene = 0; while (kullan[k.ad] && dene++ < 20) k = V.kisi(r.hasta, C.rng(600 + i * 37 + dene)); kullan[k.ad] = 1; KISI[r.id] = k; KISI[r.id].dr = DR[Math.floor(C.rng(30 + i)() * DR.length)]; });
  var S = { i: 0, st: 0, sec: null, ipucu: false, done: C.ls.get('tz.done', {}) };
  var yeni = function () { S.st = 0; S.ipucu = false; S.sec = { gecerli: null, raf: [], sorun: null, mud: null, danisma: {} }; S.raf = null; S.danis = null; };
  yeni();
  var rec = function () { return SIRA[S.i]; };
  var bugun = new Date().toLocaleDateString('tr-TR');
  var turAd = { normal: 'Normal (beyaz) reçete', kirmizi: 'Kırmızı reçete', yesil: 'Yeşil reçete' };
  var turRenk = { normal: '#E8E3D8', kirmizi: '#C9483B', yesil: '#2E8E5B' };

  var rafKur = function (r) {
    if (S.raf) return S.raf;
    var dogru = r.satir.map(function (s) { return s[0]; }), set = {}, rr = C.rng(50 + S.i);
    dogru.forEach(function (id) { set[id] = 1; var il = V.ilac(id); V.ILAC.forEach(function (x) { if (x.id !== id && (x.grup === il.grup || x.ad[0] === il.ad[0]) && Object.keys(set).length < 6) set[x.id] = 1; }); });
    C.shuffle(V.ILAC, rr).forEach(function (x) { if (Object.keys(set).length < 15) set[x.id] = 1; });
    S.raf = C.shuffle(Object.keys(set), rr);
    return S.raf;
  };
  var danisKur = function (r) { if (!S.danis) S.danis = C.shuffle(r.danisma.map(function (d, i) { return [i, d[0], d[1]]; }), C.rng(70 + S.i)); return S.danis; };
  var steps = function () {
    var L = ['Reçete', 'Raf', 'Profil', 'Müdahale', 'Danışmanlık', 'Karne'];
    return '<div class="steps">' + L.map(function (l, i) { return '<span class="' + (i === S.st ? 'on' : i < S.st ? 'done' : '') + '">' + (i < S.st ? '✓ ' : (i + 1) + '. ') + l + '</span>'; }).join('') + '</div>';
  };
  var radio = function (name, list, sel, dogru, shown) {
    return '<div class="chk">' + list.map(function (o) {
      var on = sel === o[0], cls = shown ? (o[0] === dogru ? (on ? 'ok' : 'miss') : on ? 'no' : '') : '';
      return '<label class="' + cls + '"><input type="radio" name="' + name + '" value="' + X(o[0]) + '"' + (on ? ' checked' : '') + (shown ? ' disabled' : '') + '>' + X(o[1]) + '</label>';
    }).join('') + '</div>';
  };
  var receteHTML = function (r) {
    var k = KISI[r.id];
    return '<div class="recete" style="--rc:' + turRenk[r.tur] + '"><div class="ust"><div><span class="k">' + X(turAd[r.tur]) + ' · e-reçete</span><div style="margin-top:4px"><b>' + X(k.hitap) + '</b>, ' + k.yas + ' yaş' + (r.hasta.yas < 14 ? ' · ' + r.hasta.kilo + ' kg' : '') + '</div><div class="sub">Tanı: ' + X(r.tani) + '</div></div><span class="rx">℞</span></div>' +
      r.satir.map(function (s) { var il = V.ilac(s[0]); return '<div class="satir"><b>' + X(il.ad) + ' ' + X(il.guc) + '</b><span>' + X(s[1]) + '</span><span class="sub" style="margin-left:auto">' + s[2] + ' kutu</span></div>'; }).join('') +
      '<div class="sub" style="margin-top:8px">' + bugun + '</div><div class="imza">' + X(k.dr) + '</div><div class="muhur" aria-hidden="true">ACADEX<br>POLİKLİNİK</div></div>';
  };
  var profilHTML = function (r) {
    var k = KISI[r.id];
    return '<div class="profil"><b>Hasta profili · ' + X(k.hitap) + '</b>' +
      '<div><span class="sub">Bilinen durumlar:</span> ' + X(r.durum) + '</div>' +
      '<div><span class="sub">Düzenli ilaçlar:</span> ' + (r.mevcut.length ? r.mevcut.map(function (id) { return X(V.ilac(id).ad + ' ' + V.ilac(id).guc); }).join(', ') : 'yok') + '</div>' +
      '<div><span class="sub">Alerji:</span> ' + (r.alerji ? '<b style="display:inline;color:var(--bad);letter-spacing:0;text-transform:none;font-size:13.5px">' + X(r.alerji) + '</b>' : 'bilinen yok') + '</div>' +
      (r.not ? '<div><span class="sub">Not:</span> ' + X(r.not) + '</div>' : '') + '</div>';
  };
  var puanlar = function (r) {
    var dogru = r.satir.map(function (s) { return s[0]; }).sort().join(), sec = S.sec.raf.slice().sort().join();
    var raf = sec === dogru ? 1 : S.sec.raf.filter(function (x) { return dogru.split(',').indexOf(x) >= 0; }).length / Math.max(S.sec.raf.length, dogru.split(',').length);
    var need = r.danisma.filter(function (d) { return d[1]; }).length, tp = 0, fp = 0;
    r.danisma.forEach(function (d, i) { if (S.sec.danisma[i]) { if (d[1]) tp++; else fp++; } });
    var dn = Math.max(0, (tp - fp) / need);
    var p = { gecerli: S.sec.gecerli === r.gecerli ? 1 : 0, raf: raf, sorun: S.sec.sorun === r.sorun ? 1 : 0, mud: S.sec.mud === r.mudahale ? 1 : 0, dn: dn };
    p.pct = Math.max(0, Math.round((p.gecerli + p.raf + p.sorun * 1.5 + p.mud * 1.5 + p.dn) / 6 * 100) - (S.ipucu ? 10 : 0));
    return p;
  };
  var paint = function () {
    var r = rec(), h = '';
    h += '<div class="bas"><div><span class="k">eczane tezgâhı · reçete ' + (S.i + 1) + '/' + SIRA.length + '</span><h1>Sıradaki hasta tezgâhta</h1><p>Reçeteyi oku, raftan doğru kutuyu al, hasta profilini kontrol et, gerekiyorsa hekimle iletişime geç ve hastaya kullanımı anlat.</p></div>' +
      '<div class="row">' + SIRA.map(function (x, i) { var d = S.done[x.id]; return '<button type="button" class="btn" style="min-height:36px;padding:0 10px;' + (i === S.i ? 'border-width:2.5px' : 'border-color:var(--line-2)') + '" data-git="' + i + '" aria-label="Reçete ' + (i + 1) + (d != null ? ', %' + d : '') + '">' + (i + 1) + (d != null ? ' <span class="pill ' + (d >= 85 ? 'ok' : d >= 60 ? 'warn' : 'bad') + '">%' + d + '</span>' : '') + '</button>'; }).join('') + '</div></div>';
    h += '<div class="tz"><div>' + receteHTML(r) + (S.st >= 2 ? profilHTML(r) : '') + '</div><div class="card">' + steps();
    /* 1. geçerlilik */
    h += '<div class="q">1. Reçete geçerli mi?</div>' + radio('gecerli', V.GECERLI, S.sec.gecerli, r.gecerli, S.st > 0);
    if (S.st === 0) h += '<div class="row" style="margin-top:10px"><button type="button" class="btn pri" data-adim="1">Raftan ilacı al →</button></div>';
    /* 2. raf */
    if (S.st >= 1) {
      var dog = r.satir.map(function (s) { return s[0]; });
      h += '<div class="q">2. Raftan reçetedeki kutu(ları) seç</div><div class="raf" role="group" aria-label="İlaç rafı">';
      rafKur(r).forEach(function (id, i) {
        if (i && i % 5 === 0) h += '<span class="sira" aria-hidden="true"></span>';
        var il = V.ilac(id), on = S.sec.raf.indexOf(id) >= 0, cls = S.st > 1 ? (dog.indexOf(id) >= 0 ? (on ? 'ok' : 'no') : on ? 'no' : '') : '';
        h += '<button type="button" data-raf="' + id + '" aria-pressed="' + on + '" class="' + cls + '"' + (S.st > 1 ? ' disabled' : '') + ' aria-label="' + X(il.ad + ' ' + il.guc + ' ' + il.form) + '">' + C.kutu(il) + '<small>' + X(il.ad) + '</small></button>';
      });
      h += '<span class="sira" aria-hidden="true"></span></div>';
      if (S.st === 1) h += '<div class="row" style="margin-top:10px"><button type="button" class="btn pri" data-adim="2">Hasta profilini aç →</button><span class="sub">' + S.sec.raf.length + ' kutu seçildi</span></div>';
    }
    /* 3. profil */
    if (S.st >= 2) {
      h += '<div class="q">3. Profil kontrolünde ne buldun?</div>' + radio('sorun', V.SORUN_SEC(r), S.sec.sorun, r.sorun, S.st > 2);
      if (S.st === 2) h += '<div class="row" style="margin-top:10px"><button type="button" class="btn pri" data-adim="3">Kararı ver →</button>' + (S.ipucu ? '' : '<button type="button" class="btn" data-ipucu>Etkileşim veritabanına bak (−10)</button>') + '</div>';
      if (S.ipucu && S.st === 2) { var t = V.tara(r.satir.map(function (s) { return s[0]; }).concat(r.mevcut)); h += '<div class="find" style="margin-top:10px">' + (t.length ? t.map(function (e) { return '<b>' + X(V.DERECE[e.derece].ad) + ':</b> ' + X(V.dugum(e.a).ad + ' + ' + V.dugum(e.b).ad) + '. ' + X(e.mek); }).join('<br>') : 'Veritabanında ilaç-ilaç etkileşimi kaydı yok; alerji, doz, reçete türü ve besin etkileşimlerini kendin değerlendir.') + '</div>'; }
    }
    if (S.st >= 3) {
      h += '<div class="q">4. Ne yaparsın?</div>' + radio('mud', V.MUDAHALE, S.sec.mud, r.mudahale, S.st > 3);
      if (S.st === 3) h += '<div class="row" style="margin-top:10px"><button type="button" class="btn pri" data-adim="4">Hastayla konuş →</button></div>';
    }
    if (S.st >= 4) {
      h += '<div class="q">5. Hastaya neler söylersin? <span class="sub">(birden çok)</span></div><div class="chk">' + danisKur(r).map(function (d) {
        var on = !!S.sec.danisma[d[0]], cls = S.st > 4 ? (d[2] ? (on ? 'ok' : 'miss') : on ? 'no' : '') : '';
        return '<label class="' + cls + '"><input type="checkbox" name="danisma" value="' + d[0] + '"' + (on ? ' checked' : '') + (S.st > 4 ? ' disabled' : '') + '>' + X(d[1]) + '</label>';
      }).join('') + '</div>';
      if (S.st === 4) h += '<div class="row" style="margin-top:10px"><button type="button" class="btn grn" data-adim="5">Hastayı uğurla</button></div>';
    }
    if (S.st >= 5) {
      var p = puanlar(r), etk = /^etk:/.test(r.sorun) ? V.etkilesim.apply(null, r.sorun.slice(4).split('|')) : null;
      if (S.done[r.id] !== p.pct) { S.done[r.id] = p.pct; C.ls.set('tz.done', S.done); }
      var acik = r.sorun === 'alerji' ? 'Hasta profilinde ' + r.alerji + ' alerjisi var; reçetedeki ilaç aynı gruptan.' : r.sorun === 'doz' ? 'Doz: ' + V.mgKgDoz(20, 120, r.hasta.kilo) + ' mg/kg/doz; prospektüs aralığı 10–15 mg/kg/doz.' : r.sorun === 'tur' ? V.ilac(r.satir[0][0]).ad + ' ' + (V.ilac(r.satir[0][0]).rec === 'yesil' ? 'yeşil' : 'kırmızı') + ' reçeteyle verilir; normal reçeteyle verilemez.' : etk ? etk.mek + ' ' + etk.oneri : 'Önemli bir etkileşim ya da çelişki yok; danışmanlık belirleyici.';
      h += C.karne(p.pct, KISI[r.id].hitap + ' · tezgâh karnesi', [[p.gecerli === 1, 'Reçete geçerliliği'], [p.raf >= 0.99, 'Raftan doğru kutu: %' + Math.round(p.raf * 100)], [p.sorun === 1, 'Profil kontrolü'], [p.mud === 1, 'Müdahale: ' + X(V.MUDAHALE.filter(function (m) { return m[0] === r.mudahale; })[0][1])], [p.dn >= 0.99, 'Danışmanlık: %' + Math.round(p.dn * 100)]].concat(S.ipucu ? [[false, 'Veritabanı ipucu: −10']] : []), '<b>Neden?</b> ' + X(acik));
      h += '<div class="row" style="margin-top:12px"><button type="button" class="btn" data-bastan>Baştan çöz</button>' + (S.i < SIRA.length - 1 ? '<button type="button" class="btn pri" data-sonraki>Sıradaki hasta →</button>' : '') + '</div>';
    }
    h += '</div></div>';
    el().innerHTML = h;
  };
  var git = function (i) { S.i = i; yeni(); paint(); EC.bridgeSend(); };

  EC.st.tezgah = {
    init: function () {
      paint();
      el().addEventListener('change', function (e) {
        var t = e.target; if (!t.name) return;
        if (t.name === 'danisma') S.sec.danisma[t.value] = t.checked; else S.sec[t.name] = t.value;
      });
      el().addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-git]'))) { git(+b.getAttribute('data-git')); return; }
        if ((b = e.target.closest('[data-raf]'))) { if (S.st !== 1) return; var id = b.getAttribute('data-raf'), i = S.sec.raf.indexOf(id); if (i >= 0) S.sec.raf.splice(i, 1); else S.sec.raf.push(id); b.setAttribute('aria-pressed', String(i < 0)); var s = el().querySelector('[data-adim="2"] + .sub'); if (s) s.textContent = S.sec.raf.length + ' kutu seçildi'; return; }
        if (e.target.closest('[data-ipucu]')) { S.ipucu = true; paint(); return; }
        if (e.target.closest('[data-sonraki]')) { git(S.i + 1); el().scrollIntoView({ behavior: C.RM ? 'auto' : 'smooth', block: 'start' }); return; }
        if (e.target.closest('[data-bastan]')) { git(S.i); return; }
        if ((b = e.target.closest('[data-adim]'))) {
          var g = +b.getAttribute('data-adim');
          if (g === 1 && !S.sec.gecerli) { C.toast('Önce reçetenin geçerliliğine karar ver.'); return; }
          if (g === 2 && !S.sec.raf.length) { C.toast('Raftan en az bir kutu seç.'); return; }
          if (g === 3 && !S.sec.sorun) { C.toast('Profil kontrolünde ne bulduğunu seç.'); return; }
          if (g === 4 && !S.sec.mud) { C.toast('Ne yapacağını seç.'); return; }
          if (g === 5 && !Object.keys(S.sec.danisma).some(function (k) { return S.sec.danisma[k]; })) { C.toast('Hastaya söyleyeceklerini seç.'); return; }
          S.st = g; paint(); EC.bridgeSend();
          C.live(['', 'Raf açıldı', 'Hasta profili açıldı', 'Müdahale adımı', 'Danışmanlık adımı', 'Karne hazır'][g]);
        }
      });
    },
    ctx: function () {
      var r = rec(), k = KISI[r.id];
      return { sel: { key: 'ecz.tezgah.' + r.id + '.' + S.st, title: 'Tezgâh · ' + k.hitap, la: 'Eczane tezgâhı', rows: [['Reçete', r.satir.map(function (s) { return V.ilac(s[0]).ad + ' (' + s[1] + ')'; }).join(', ')], ['Tanı', r.tani]].concat(S.st >= 2 ? [['Düzenli ilaçlar', r.mevcut.map(function (id) { return V.ilac(id).ad; }).join(', ') || 'yok'], ['Alerji', r.alerji || 'yok']] : []),
        about: 'öğrenci Eczacılık Lab tezgâhında kurgusal bir reçeteyi karşılıyor (adım ' + (S.st + 1) + '/6). Karne açılmadan doğru cevabı söyleme; etkileşim, alerji, doz ve reçete türünü düşündüren sorular sor.' }, chips: [['ipucu', 'Bu adım için ipucu ver'], ['kontrol', 'Neleri kontrol etmeliyim?']] };
    },
    classify: function (q) { if (/ipucu/.test(q)) return 'ipucu'; if (/kontrol|neler/.test(q)) return 'kontrol'; return null; },
    answer: function (k) {
      if (k === 'kontrol') return 'Tezgâhta sırayla: reçete türü ve eksiksizliği (hasta, hekim, tarih, imza, doz, süre), doğru ilaç ve güç, hastanın diğer ilaçlarıyla etkileşim, alerji, yaşa/kiloya göre doz, böbrek-karaciğer, gebelik. Sonra hastaya nasıl ve ne zaman alacağını anlat.';
      if (S.st === 0) return 'İpucu: ilacın hangi reçete türüyle verildiğini düşün. Benzodiazepinler ve opioidler normal reçeteyle verilmez.';
      if (S.st === 1) return 'İpucu: kutudaki etken madde kadar güç (mg) de reçeteyle aynı olmalı. Aynı gruptan benzer kutular yan yana.';
      if (S.st === 2) return 'İpucu: profildeki her ilacı reçetedekiyle tek tek eşleştir; alerjiyi ve çocukta mg/kg dozu unutma.';
      if (S.st === 3) return 'İpucu: ciddi bir sorun varsa ilacı vermeden önce hekimle konuşup gerekçeli bir alternatif önermek eczacının görevidir.';
      return 'İpucu: danışmanlıkta ne zaman, nasıl, ne kadar süre ve hangi belirtide başvuracağı olmalı.';
    }
  };
})();
