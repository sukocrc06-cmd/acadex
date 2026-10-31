/* ==========================================================================
   ACADEX KLİNİK · ortak sahne motoru (labs/klinik/klinik.js), 31.10.2026
   MedLab vakalarını animasyonlu bir odada oynatır: hasta + mentor (doktor / diyetisyen),
   seçmeli diyalogla anamnez, ölçüm ve muayene, klinik karar, ardından lab'ın kendi
   formuna devir (reçete, 3B modelde yapı bulma …). Puanlama saf fonksiyon: puanla().

   Odalar (SVG/CSS çizim): poliklinik, ameliyathane, acil (acil + yoğun bakım + servis),
   diyet (diyet polikliniği), odyo (odyometri kabini), dkt (terapi odası), fizyo (fizyoterapi salonu).
   Hareket azaltma tercihinde tüm animasyonlar durur. Senaryolar: senaryo-*.js (AXKLINIK.ekle).

   Senaryo biçimi:
     { id, lab, oda, odaAd, baslik, hasta:{ad, hitap, yas, cins:'K'|'E', gorunum:'cocuk'|'genc'|'yetiskin'|'yasli',
       sac, kiyafet, poz:'otur'|'yat', ifade:'normal'|'agri'|'uzgun'|'uyku', gozluk, gebe},
       refakat?:{ad, cins, gorunum, kiyafet, sac}, mentor:{ad, unvan, cins}, vital?:{nabiz, ta, spo2, ates},
       adimlar:[ {tip:'konus', kim:'hasta'|'mentor'|'refakat'|'anlatici', metin},
                 {tip:'sor', baslik, hak, yonerge, secenek:[{id, t, cevap, kim?, not?, puan, geri?}]},
                 {tip:'eylem', baslik, yonerge, secenek:[{id, t, sonuc, anim?, deger?, puan, geri?, vital?}]},
                 {tip:'karar', baslik, soru, secenek:[{t, dogru, geri}]},
                 {tip:'devir', metin, dugme, hedef} ] }
   ========================================================================== */
(function (root, factory) {
  var K = factory();
  if (typeof module === 'object' && module.exports) module.exports = K; else root.AXKLINIK = K;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* =========================== puanlama (DOM'suz) =========================== */
  var GENEL = {
    iyi: 'Yerinde bir soru; bu bilgi kararını doğrudan etkiliyor.',
    bos: 'Bu bilgi bu vakada kararını değiştirmez; görüşme süresi kısıtlı, önceliği belirle.',
    kotu: 'Yargılayıcı ya da yönlendirici soru hastayı savunmaya iter. Açık uçlu ve tarafsız sor.'
  };
  /* sec: {adimIndex: [seçilen id'ler] | seçilen karar indeksi} */
  var puanla = function (sen, sec) {
    var rows = [], got = 0, max = 0;
    (sen.adimlar || []).forEach(function (a, i) {
      var s = sec && sec[i];
      if (a.tip === 'sor' || a.tip === 'eylem') {
        var pos = a.secenek.map(function (o) { return o.puan || 0; }).filter(function (p) { return p > 0; }).sort(function (x, y) { return y - x; });
        var m = (a.hak ? pos.slice(0, a.hak) : pos).reduce(function (x, y) { return x + y; }, 0);
        var ids = Array.isArray(s) ? s : [], g = 0, kacan = [];
        a.secenek.forEach(function (o) { if (ids.indexOf(o.id) >= 0) g += o.puan || 0; });
        a.secenek.forEach(function (o) { if ((o.puan || 0) >= 2 && ids.indexOf(o.id) < 0) kacan.push(o.t); });
        g = Math.max(0, Math.min(g, m));
        rows.push({ t: a.baslik || (a.tip === 'sor' ? 'Anamnez' : 'Muayene'), got: g, max: m, ok: m ? g / m >= 0.75 : true, kacan: kacan });
        got += g; max += m;
      } else if (a.tip === 'karar') {
        var d = a.secenek[s], ok = !!(d && d.dogru);
        rows.push({ t: a.baslik || 'Klinik karar', got: ok ? 3 : 0, max: 3, ok: ok, kacan: ok ? [] : a.secenek.filter(function (o) { return o.dogru; }).map(function (o) { return o.t; }) });
        got += ok ? 3 : 0; max += 3;
      }
    });
    return { puan: max ? Math.round(got / max * 100) : 0, rows: rows };
  };
  /* senaryo şeması denetimi (testler ve geliştirme için) */
  var denetle = function (sen) {
    var e = [], ODA = ['poliklinik', 'ameliyathane', 'acil', 'diyet', 'odyo', 'dkt', 'fizyo'];
    if (!sen.id) e.push('id yok');
    if (ODA.indexOf(sen.oda) < 0) e.push(sen.id + ': oda geçersiz ' + sen.oda);
    if (!sen.hasta || !sen.hasta.ad || !sen.mentor) e.push(sen.id + ': hasta/mentor eksik');
    var tipler = (sen.adimlar || []).map(function (a) { return a.tip; });
    if (tipler.indexOf('sor') < 0) e.push(sen.id + ': anamnez adımı yok');
    if (tipler[tipler.length - 1] !== 'devir') e.push(sen.id + ': son adım devir olmalı');
    (sen.adimlar || []).forEach(function (a, i) {
      if (a.tip === 'sor' || a.tip === 'eylem') {
        var ids = {};
        a.secenek.forEach(function (o) { if (!o.id || ids[o.id]) e.push(sen.id + ' #' + i + ': yinelenen/eksik id ' + o.id); ids[o.id] = 1; if (a.tip === 'sor' && !o.cevap) e.push(sen.id + ' #' + i + ': cevap yok ' + o.id); if (a.tip === 'eylem' && !o.sonuc) e.push(sen.id + ' #' + i + ': sonuç yok ' + o.id); });
        if (!a.secenek.some(function (o) { return (o.puan || 0) > 0; })) e.push(sen.id + ' #' + i + ': puanlı seçenek yok');
        if (a.hak && a.hak > a.secenek.length) e.push(sen.id + ' #' + i + ': hak > seçenek');
      }
      if (a.tip === 'karar' && a.secenek.filter(function (o) { return o.dogru; }).length !== 1) e.push(sen.id + ' #' + i + ': tek doğru olmalı');
    });
    return e;
  };

  var SEN = {};
  var ekle = function (list) { (list || []).forEach(function (s) { SEN[s.id] = s; }); };
  var api = { puanla: puanla, denetle: denetle, ekle: ekle, SEN: SEN, GENEL: GENEL };
  if (typeof document === 'undefined') return api;

  /* =========================== tarayıcı: sahne =========================== */
  var D = document, W = window;
  var RM = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var X = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  var CSS = [
    '.axk{position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;background:#0F1A33;color:#0D1838;font-family:"Instrument Sans",system-ui,sans-serif;animation:axk-in .35s ease both}',
    '@keyframes axk-in{from{opacity:0}}',
    '.axk *{box-sizing:border-box}',
    '.axk-top{display:flex;align-items:center;gap:12px;padding:10px 16px;background:#16233F;color:#F3EFE6}',
    '.axk-top .t{min-width:0}',
    '.axk-top b{display:block;font-family:"Bricolage Grotesque",system-ui,sans-serif;font-size:17px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.axk-top small{display:block;font-size:12.5px;color:#BFC9DD}',
    '.axk-steps{display:flex;gap:4px;margin-left:auto;flex-wrap:wrap;justify-content:flex-end}',
    '.axk-steps span{padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;background:rgba(255,255,255,.08);color:#C9D2E4;white-space:nowrap}',
    '.axk-steps span.on{background:#F3EFE6;color:#0D1838}.axk-steps span.done{background:rgba(94,170,120,.25);color:#BFEACB}',
    '.axk-x,.axk-nb{flex:none;min-width:40px;min-height:40px;border:0;border-radius:10px;background:rgba(255,255,255,.1);color:#fff;font-size:15px;font-weight:700;cursor:pointer;padding:0 12px}',
    '.axk-x{font-size:22px;padding:0}',
    '.axk-x:hover,.axk-nb:hover{background:rgba(255,255,255,.18)}',
    '.axk-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 300px}',
    '.axk-stage{position:relative;min-height:0;display:flex;flex-direction:column;background:#E9E2D4}',
    '.axk-scene{flex:1;min-height:200px;position:relative;overflow:hidden;background:linear-gradient(180deg,#E3DCCD 0 76%,#BFAF93 76% 100%)}',
    '.axk-scene svg.room{position:absolute;inset:0;width:100%;height:100%}',
    '.axk-panel{flex:none;max-height:46%;overflow-y:auto;padding:12px 18px 16px;background:#FFFDF8;border-top:3px solid #0D1838;box-shadow:0 -18px 30px -24px rgba(0,0,0,.6)}',
    '.axk-say{display:flex;gap:12px;align-items:flex-start;min-height:54px}',
    '.axk-say .who{flex:none;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:.02em;background:#0D1838;color:#fff;margin-top:2px;white-space:nowrap}',
    '.axk-say .who.hasta{background:#C8573A}.axk-say .who.mentor{background:#2F6BFF}.axk-say .who.refakat{background:#7A4FA8}.axk-say .who.sen{background:#2E8E5B}.axk-say .who.anlatici{background:#6A7593}',
    '.axk-say p{margin:0;font-size:16.5px;line-height:1.55;flex:1}',
    '.axk-say p .cur{display:inline-block;width:8px;height:1.05em;background:#0D1838;vertical-align:-2px;margin-left:2px;animation:axk-blink .8s steps(2) infinite}',
    '@keyframes axk-blink{50%{opacity:0}}',
    '.axk-h{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:12px 0 6px}',
    '.axk-h b{font-family:"Bricolage Grotesque",system-ui,sans-serif;font-size:16px}',
    '.axk-h small{color:#6A7593;font-size:13px}',
    '.axk-ch{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px}',
    '.axk-ch button{position:relative;text-align:left;min-height:48px;padding:10px 12px;border:1.5px solid #CFC6B5;border-radius:12px;background:#fff;font:inherit;font-size:14.5px;font-weight:600;color:#0D1838;cursor:pointer;transition:transform .15s,border-color .15s,background .15s}',
    '.axk-ch button:hover:not(:disabled){border-color:#0D1838;transform:translateY(-1px)}',
    '.axk-ch button:disabled{cursor:default;opacity:.55}',
    '.axk-ch button.used{opacity:1;background:#F1EDE4;border-style:dashed}',
    '.axk-ch button.used::after{content:"✓";position:absolute;right:10px;top:9px;color:#2E8E5B;font-weight:800}',
    '.axk-ch button.ok{border-color:#2E8E5B;background:#E3F4EA}.axk-ch button.no{border-color:#C9483B;background:#FBE9E6}',
    '.axk-row{display:flex;gap:8px;align-items:center;justify-content:flex-end;flex-wrap:wrap;margin-top:10px}',
    '.axk-btn{min-height:42px;padding:0 18px;border:1.5px solid #0D1838;border-radius:999px;background:#fff;color:#0D1838;font:inherit;font-weight:700;font-size:14.5px;cursor:pointer}',
    '.axk-btn.pri{background:#0D1838;color:#fff}.axk-btn.pri:hover{background:#1A2A5C}',
    '.axk-fb{margin:10px 0 0;padding:10px 12px;border-radius:10px;font-size:14.5px;line-height:1.5;background:#EEF3FF;border-left:4px solid #2F6BFF}',
    '.axk-fb.ok{background:#E3F4EA;border-color:#2E8E5B}.axk-fb.no{background:#FBE9E6;border-color:#C9483B}',
    '.axk-side{min-height:0;overflow-y:auto;padding:14px;background:#F6F1E6;border-left:1px solid #DCD2BE}',
    '.axk-side h3{margin:0 0 2px;font-family:"Bricolage Grotesque",system-ui,sans-serif;font-size:16px}',
    '.axk-side .k{font-family:"JetBrains Mono",monospace;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:#6A7593}',
    '.axk-side ul{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:6px}',
    '.axk-side li{padding:8px 10px;border-radius:8px;background:#fff;font-size:13.5px;line-height:1.45;border:1px solid #E8DFCC;animation:axk-pop .3s ease both}',
    '.axk-side li b{display:block;font-size:11.5px;color:#6A7593;font-weight:700;text-transform:uppercase;letter-spacing:.04em}',
    '@keyframes axk-pop{from{opacity:0;transform:translateY(6px)}}',
    '.axk-side .empty{color:#6A7593;font-size:13.5px}',
    '.axk-karne{margin-top:4px;padding:12px 14px;border-radius:10px;background:#fff;border:1px solid #E1D8C4}',
    '.axk-karne .p{font-family:"Bricolage Grotesque",system-ui,sans-serif;font-size:30px;font-weight:800}',
    '.axk-karne li{margin:4px 0;font-size:14px}',
    '.axk-karne small{color:#6A7593}',
    /* sahne hareketleri */
    '.axk .blink{animation:axk-eye 4.6s infinite;transform-box:fill-box;transform-origin:center}',
    '@keyframes axk-eye{0%,93%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}',
    '.axk .breath{animation:axk-br 3.6s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 100%}',
    '@keyframes axk-br{50%{transform:scaleY(1.015)}}',
    '.axk .talk .mouth{animation:axk-talk .22s ease-in-out infinite alternate;transform-box:fill-box;transform-origin:center}',
    '@keyframes axk-talk{to{transform:scaleY(.25)}}',
    '.axk .walk{animation:axk-walk 1.3s cubic-bezier(.2,.8,.2,1) both}',
    '@keyframes axk-walk{from{transform:translateX(-260px);opacity:0}to{transform:none;opacity:1}}',
    '.axk .glow{animation:axk-glow 1.2s ease-in-out 3}',
    '@keyframes axk-glow{50%{filter:drop-shadow(0 0 12px #FFD45A) brightness(1.08)}}',
    '.axk .ecg{stroke-dasharray:420;animation:axk-ecg 1.6s linear infinite}',
    '@keyframes axk-ecg{from{stroke-dashoffset:420}to{stroke-dashoffset:0}}',
    '.axk .alarm{animation:axk-al .7s steps(2) infinite}',
    '@keyframes axk-al{50%{fill:#FF6B5A}}',
    '.axk .lamp{animation:axk-lamp 5s ease-in-out infinite}',
    '@keyframes axk-lamp{50%{opacity:.75}}',
    '.axk .drip{animation:axk-drip 1.8s ease-in infinite}',
    '@keyframes axk-drip{0%{transform:translateY(0);opacity:0}20%{opacity:1}100%{transform:translateY(26px);opacity:0}}',
    '.axk .sway{animation:axk-sway 6s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 100%}',
    '@keyframes axk-sway{50%{transform:rotate(2deg)}}',
    '.axk .gest{animation:axk-gest .9s ease-in-out 2 alternate;transform-box:fill-box;transform-origin:15% 10%}',
    '@keyframes axk-gest{to{transform:rotate(-18deg)}}',
    '.axk-pop{position:absolute;left:50%;top:14px;transform:translateX(-50%);padding:10px 16px;border-radius:12px;background:#FFFDF8;border:2px solid #0D1838;box-shadow:0 14px 28px -14px rgba(0,0,0,.5);font-weight:700;font-size:15px;max-width:min(90%,520px);text-align:center;animation:axk-pop .35s ease both}',
    '.axk-pop small{display:block;font-weight:500;color:#46506A;font-size:13px;margin-top:2px}',
    '@media (max-width:900px){.axk-body{grid-template-columns:minmax(0,1fr)}.axk-side{display:none}.axk-side.on{display:block;position:absolute;inset:auto 0 0 0;max-height:60%;z-index:3;border-top:3px solid #0D1838}.axk-steps{display:none}.axk-panel{max-height:none;flex:1}.axk-scene{flex:none;min-height:0;aspect-ratio:1000/560}}',
    '@media (min-width:901px){.axk-nb{display:none}}',
    '@media (prefers-reduced-motion:reduce){.axk,.axk *{animation:none!important;transition:none!important}}'
  ].join('\n');

  /* ----------------------------- karakterler ----------------------------- */
  var TEN = ['#F2C7A1', '#E8B48A', '#D49A6A', '#B97E52'];
  var kisi = function (o) {
    /* ayakta / oturan figür; ayaklar (0,0), yetişkin ≈ 300 birim */
    var g = o.gorunum || 'yetiskin', k = o.cins === 'K', sc = g === 'cocuk' ? (o.yas && o.yas < 7 ? 0.58 : 0.72) : g === 'genc' ? 0.95 : 1;
    var ten = o.ten || TEN[0], sac = o.sac || (g === 'yasli' ? '#C9C4BA' : k ? '#5A3A22' : '#2E241C'), kiy = o.kiyafet || (k ? '#C8573A' : '#4E7AA8');
    var otur = o.poz === 'otur', ifade = o.ifade || 'normal', doktor = o.rol === 'mentor';
    var s = '<g class="kisi ' + (o.cls || '') + '" transform="translate(' + o.x + ' ' + o.y + ') scale(' + (o.flip ? -sc : sc) + ' ' + sc + ')">';
    /* bacaklar */
    if (otur) s += '<rect x="-34" y="-136" width="112" height="26" rx="12" fill="#2A3554"/><rect x="-30" y="-130" width="112" height="24" rx="11" fill="#2E3A5C"/><rect x="56" y="-120" width="22" height="110" rx="10" fill="#2A3554"/><rect x="62" y="-118" width="22" height="108" rx="10" fill="#2E3A5C"/><rect x="58" y="-14" width="40" height="12" rx="6" fill="#1D2438"/>';
    else s += '<rect x="-30" y="-130" width="24" height="122" rx="10" fill="' + (doktor ? '#2E3A5C' : '#2E3A5C') + '"/><rect x="6" y="-130" width="24" height="122" rx="10" fill="#2E3A5C"/><rect x="-36" y="-14" width="32" height="12" rx="6" fill="#1D2438"/><rect x="4" y="-14" width="32" height="12" rx="6" fill="#1D2438"/>';
    /* gövde */
    var bel = o.gebe ? '<ellipse cx="6" cy="-150" rx="40" ry="34" fill="' + kiy + '"/>' : '';
    s += '<g class="breath"><path d="M-42 -230 C-44 -250 44 -250 42 -230 L46 -128 C46 -120 -46 -120 -46 -128 Z" fill="' + (doktor ? '#FFFFFF' : kiy) + '" stroke="' + (doktor ? '#D5DCE8' : 'none') + '" stroke-width="2"/>' + bel;
    if (doktor) s += '<path d="M-14 -246 L0 -206 L14 -246" fill="' + (o.ic || '#7FA6E0') + '"/><path d="M-20 -240 C-26 -200 -10 -186 4 -186 C18 -186 22 -200 20 -214" fill="none" stroke="#2E3A5C" stroke-width="4" stroke-linecap="round"/><circle cx="20" cy="-214" r="6" fill="#9AA6BC" stroke="#2E3A5C" stroke-width="2"/><rect x="18" y="-206" width="16" height="22" rx="3" fill="#F1F4FA" stroke="#C7CFDD"/><path d="M0 -246 V-130" stroke="#E2E7F0" stroke-width="2"/>';
    s += '</g>';
    /* kollar */
    var kol = doktor ? '#FFFFFF' : kiy;
    s += '<g class="kolL"><path d="M-42 -232 C-62 -220 -64 -170 -58 -140" stroke="' + kol + '" stroke-width="20" stroke-linecap="round" fill="none"/><circle cx="-58" cy="-134" r="10" fill="' + ten + '"/></g>';
    s += '<g class="kolR"><path d="M42 -232 C62 -220 64 -170 58 -140" stroke="' + kol + '" stroke-width="20" stroke-linecap="round" fill="none"/><circle cx="58" cy="-134" r="10" fill="' + ten + '"/></g>';
    /* boyun ve baş */
    s += '<rect x="-9" y="-262" width="18" height="20" fill="' + ten + '"/>';
    s += '<g class="bas">';
    if (k && g !== 'cocuk') s += '<path d="M-38 -304 C-48 -272 -46 -244 -34 -236 L-24 -240 C-30 -262 -30 -284 -26 -304 Z M38 -304 C48 -272 46 -244 34 -236 L24 -240 C30 -262 30 -284 26 -304 Z" fill="' + sac + '"/>';
    if (k && g === 'cocuk') s += '<circle cx="-38" cy="-300" r="12" fill="' + sac + '"/><circle cx="38" cy="-300" r="12" fill="' + sac + '"/>';
    s += '<ellipse cx="0" cy="-294" rx="34" ry="38" fill="' + ten + '"/>';
    s += k ? '<path d="M-36 -296 C-38 -340 38 -340 36 -296 C30 -318 10 -324 -6 -316 C-18 -312 -30 -306 -36 -296 Z" fill="' + sac + '"/>' : (g === 'yasli' ? '<path d="M-34 -300 C-34 -316 -26 -326 -14 -330 M14 -330 C26 -326 34 -316 34 -300" stroke="' + sac + '" stroke-width="9" fill="none" stroke-linecap="round"/>' : '<path d="M-35 -298 C-38 -338 38 -338 35 -298 C30 -314 14 -318 0 -316 C-14 -318 -30 -314 -35 -298 Z" fill="' + sac + '"/>');
    if (doktor && o.bone) s += '<path d="M-37 -306 C-37 -344 37 -344 37 -306 Z" fill="' + o.bone + '"/>';
    /* yüz */
    var gy = -292;
    if (ifade === 'uyku') s += '<path d="M-19 ' + gy + ' q7 5 14 0 M5 ' + gy + ' q7 5 14 0" stroke="#0D1838" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
    else s += '<g class="blink"><ellipse cx="-12" cy="' + gy + '" rx="3.6" ry="4.6" fill="#0D1838"/><ellipse cx="12" cy="' + gy + '" rx="3.6" ry="4.6" fill="#0D1838"/></g>';
    if (ifade === 'agri') s += '<path d="M-20 -304 l12 4 M20 -304 l-12 4" stroke="#0D1838" stroke-width="2.6" stroke-linecap="round"/>';
    else if (ifade === 'uzgun') s += '<path d="M-20 -302 l12 -3 M20 -302 l-12 -3" stroke="#0D1838" stroke-width="2.4" stroke-linecap="round"/>';
    else s += '<path d="M-20 -304 q8 -4 14 -1 M20 -304 q-8 -4 -14 -1" stroke="#0D1838" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
    if (o.gozluk || g === 'yasli') s += '<g fill="none" stroke="#2E3A5C" stroke-width="2.2"><circle cx="-12" cy="' + gy + '" r="9"/><circle cx="12" cy="' + gy + '" r="9"/><path d="M-3 ' + gy + ' h6"/></g>';
    s += '<ellipse cx="-22" cy="-280" rx="5" ry="3" fill="#E89A8A" opacity=".45"/><ellipse cx="22" cy="-280" rx="5" ry="3" fill="#E89A8A" opacity=".45"/>';
    var mth = ifade === 'agri' || ifade === 'uzgun' ? 'M-9 -270 q9 -6 18 0' : ifade === 'uyku' ? 'M-6 -272 h12' : 'M-10 -274 q10 9 20 0';
    s += '<path class="mouth" d="' + mth + '" stroke="#7A2E22" stroke-width="3" fill="' + (ifade === 'normal' ? '#B5463A' : 'none') + '" stroke-linecap="round"/>';
    if (doktor && o.maske) s += '<path d="M-26 -286 h52 v20 c0 12 -52 12 -52 0 z" fill="' + o.maske + '"/>';
    s += '</g></g>';
    return s;
  };
  /* yatan hasta (yan görünüş): baş solda, beden çarşaf altında */
  var yatan = function (o) {
    var ten = o.ten || TEN[0], sac = o.sac || '#5A3A22', sc = o.gorunum === 'cocuk' ? 0.75 : 1;
    var s = '<g class="kisi" transform="translate(' + o.x + ' ' + o.y + ') scale(' + sc + ')">';
    s += '<ellipse cx="0" cy="-6" rx="46" ry="16" fill="#FFFFFF" stroke="#DCE2EC" stroke-width="2"/>';                 /* yastık */
    s += '<ellipse cx="6" cy="-26" rx="30" ry="27" fill="' + ten + '"/><path d="M-22 -36 C-18 -62 26 -64 34 -40 C20 -50 0 -50 -22 -36 Z" fill="' + sac + '"/>';
    s += (o.ifade === 'uyku' || o.uyutuldu) ? '<path d="M14 -30 q6 4 12 0" stroke="#0D1838" stroke-width="2.4" fill="none" stroke-linecap="round"/>' : '<g class="blink"><ellipse cx="20" cy="-30" rx="3" ry="4" fill="#0D1838"/></g>';
    s += '<path class="mouth" d="M24 -14 q5 3 9 0" stroke="#7A2E22" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
    if (o.ng) s += '<path d="M34 -24 C46 -22 48 -8 60 2 C90 24 120 40 150 40" stroke="#E7B14A" stroke-width="3" fill="none"/>';
    if (o.maske) s += '<path d="M20 -20 h22 v14 h-22z" fill="#9FD8D0" opacity=".8"/>';
    s += '<g class="breath"><path d="M36 -12 C60 -50 120 -46 170 -40 L420 -36 C440 -36 446 -6 430 0 L36 0 Z" fill="' + (o.ortu || '#9CC6E8') + '"/><path d="M60 -30 C120 -38 260 -34 420 -30" stroke="rgba(255,255,255,.55)" stroke-width="3" fill="none"/></g>';
    if (o.kol !== false) s += '<path d="M120 -20 C150 -10 190 -10 220 -16" stroke="' + ten + '" stroke-width="14" stroke-linecap="round" fill="none"/>';
    s += '</g>';
    return s;
  };

  /* ----------------------------- odalar ----------------------------- */
  var duvar = function (c1, c2) { return '<defs><linearGradient id="axk-w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient><linearGradient id="axk-f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#CDBFA6"/><stop offset="1" stop-color="#B8A88C"/></linearGradient></defs><rect width="1000" height="430" fill="url(#axk-w)"/><rect y="430" width="1000" height="130" fill="url(#axk-f)"/><rect y="424" width="1000" height="8" fill="#A8977A"/>'; };
  var pencere = function (x, y) { return '<g><rect x="' + x + '" y="' + y + '" width="170" height="130" rx="6" fill="#BFE0F5" stroke="#FFFFFF" stroke-width="10"/><circle class="lamp" cx="' + (x + 120) + '" cy="' + (y + 40) + '" r="18" fill="#FFE7A0"/><path d="M' + (x + 10) + ' ' + (y + 112) + ' q40 -40 80 -10 q30 -26 70 4 v14 h-150z" fill="#9CC79A"/><path d="M' + (x + 85) + ' ' + y + ' v130 M' + x + ' ' + (y + 65) + ' h170" stroke="#FFFFFF" stroke-width="6"/></g>'; };
  var saat = function (x, y) { return '<g><circle cx="' + x + '" cy="' + y + '" r="24" fill="#fff" stroke="#2E3A5C" stroke-width="4"/><path d="M' + x + ' ' + y + ' v-14 M' + x + ' ' + y + ' h10" stroke="#2E3A5C" stroke-width="3" stroke-linecap="round"/></g>'; };
  var bitki = function (x, y) { return '<g class="sway"><path d="M' + x + ' ' + (y - 40) + ' c-30 -30 -40 -70 -10 -90 c10 30 14 60 10 90 m0 0 c20 -40 50 -60 70 -50 c-10 30 -40 46 -70 50 m0 0 c-8 -40 6 -80 40 -100 c4 40 -14 76 -40 100" fill="#5E8F4A"/></g><path d="M' + (x - 26) + ' ' + (y - 42) + ' h52 l-8 42 h-36z" fill="#C9734B"/>'; };
  var kapi = function (x) { return '<g><rect x="' + x + '" y="230" width="110" height="196" rx="4" fill="#C7A27A" stroke="#9A7650" stroke-width="4"/><rect x="' + (x + 14) + '" y="246" width="82" height="70" rx="3" fill="#D9BC98"/><circle cx="' + (x + 92) + '" cy="336" r="6" fill="#6E4A26"/></g>'; };
  var masa = function (x, y, ekran) {
    return '<g><rect x="' + x + '" y="' + y + '" width="250" height="16" rx="4" fill="#8A6A4A"/><rect x="' + (x + 10) + '" y="' + (y + 16) + '" width="14" height="' + (426 - y - 16) + '" fill="#6E5236"/><rect x="' + (x + 226) + '" y="' + (y + 16) + '" width="14" height="' + (426 - y - 16) + '" fill="#6E5236"/>' +
      (ekran !== false ? '<rect x="' + (x + 140) + '" y="' + (y - 86) + '" width="96" height="66" rx="6" fill="#1D2438"/><rect x="' + (x + 146) + '" y="' + (y - 80) + '" width="84" height="54" rx="3" fill="#2F6BFF" opacity=".85"/><path d="M' + (x + 152) + ' ' + (y - 60) + ' h40 M' + (x + 152) + ' ' + (y - 48) + ' h60 M' + (x + 152) + ' ' + (y - 36) + ' h30" stroke="#DCE6FF" stroke-width="4" stroke-linecap="round"/><rect x="' + (x + 182) + '" y="' + (y - 20) + '" width="12" height="20" fill="#1D2438"/>' : '') +
      '<rect x="' + (x + 30) + '" y="' + (y - 10) + '" width="60" height="10" rx="2" fill="#F3EFE6"/><rect x="' + (x + 36) + '" y="' + (y - 16) + '" width="50" height="6" rx="2" fill="#FFFFFF"/></g>';
  };
  var sandalye = function (x, y) { return '<g><rect x="' + (x - 54) + '" y="' + (y - 236) + '" width="14" height="124" rx="6" fill="#4E5E86"/><rect x="' + (x - 54) + '" y="' + (y - 118) + '" width="110" height="12" rx="5" fill="#4E5E86"/><rect x="' + (x - 48) + '" y="' + (y - 106) + '" width="8" height="106" fill="#3A4566"/><rect x="' + (x + 42) + '" y="' + (y - 106) + '" width="8" height="106" fill="#3A4566"/></g>'; };
  var monitor = function (x, y, id) {
    return '<g id="' + id + '"><rect x="' + x + '" y="' + y + '" width="190" height="122" rx="10" fill="#1D2438" stroke="#38425C" stroke-width="4"/><rect x="' + (x + 8) + '" y="' + (y + 8) + '" width="174" height="106" rx="4" fill="#0B1222"/>' +
      '<path class="ecg" d="M' + (x + 12) + ' ' + (y + 40) + ' h30 l6 -10 l6 20 l6 -34 l6 30 l6 -6 h40 l6 -10 l6 20 l6 -34 l6 30 l6 -6 h32" stroke="#4BE08A" stroke-width="2.4" fill="none"/>' +
      '<text x="' + (x + 14) + '" y="' + (y + 78) + '" font-family="JetBrains Mono,monospace" font-size="11" fill="#4BE08A">NABIZ</text><text data-v="nabiz" x="' + (x + 14) + '" y="' + (y + 104) + '" font-family="JetBrains Mono,monospace" font-size="24" font-weight="700" fill="#4BE08A">—</text>' +
      '<text x="' + (x + 74) + '" y="' + (y + 78) + '" font-family="JetBrains Mono,monospace" font-size="11" fill="#FFD45A">TA</text><text data-v="ta" x="' + (x + 74) + '" y="' + (y + 104) + '" font-family="JetBrains Mono,monospace" font-size="17" font-weight="700" fill="#FFD45A">—</text>' +
      '<text x="' + (x + 140) + '" y="' + (y + 78) + '" font-family="JetBrains Mono,monospace" font-size="11" fill="#66C7FF">SpO₂</text><text data-v="spo2" x="' + (x + 140) + '" y="' + (y + 104) + '" font-family="JetBrains Mono,monospace" font-size="20" font-weight="700" fill="#66C7FF">—</text></g>';
  };
  var serum = function (x, y) { return '<g><rect x="' + x + '" y="' + y + '" width="6" height="' + (426 - y) + '" fill="#9AA6BC"/><path d="M' + (x - 30) + ' ' + (y + 4) + ' h66" stroke="#9AA6BC" stroke-width="5"/><rect x="' + (x - 34) + '" y="' + (y + 10) + '" width="34" height="56" rx="8" fill="#E8F4FF" stroke="#9FB8D6" stroke-width="2"/><rect x="' + (x - 30) + '" y="' + (y + 34) + '" width="26" height="28" rx="5" fill="#BFE0F5"/><circle class="drip" cx="' + (x - 17) + '" cy="' + (y + 74) + '" r="3" fill="#7DB7E8"/><path d="M' + (x - 17) + ' ' + (y + 70) + ' C' + (x - 17) + ' ' + (y + 160) + ' ' + (x - 90) + ' ' + (y + 170) + ' ' + (x - 130) + ' ' + (y + 190) + '" stroke="#B9D4EE" stroke-width="3" fill="none"/></g>'; };
  var yatak = function (x, y, w) { return '<g><rect x="' + x + '" y="' + y + '" width="' + w + '" height="22" rx="8" fill="#F1F4FA" stroke="#C7CFDD" stroke-width="3"/><rect x="' + (x - 6) + '" y="' + (y - 60) + '" width="12" height="' + (426 - y + 60) + '" rx="5" fill="#9AA6BC"/><rect x="' + (x + w - 6) + '" y="' + (y - 30) + '" width="12" height="' + (426 - y + 30) + '" rx="5" fill="#9AA6BC"/><rect x="' + (x + 10) + '" y="' + (y + 22) + '" width="' + (w - 20) + '" height="10" fill="#C7CFDD"/><circle cx="' + (x + 30) + '" cy="420" r="8" fill="#38425C"/><circle cx="' + (x + w - 30) + '" cy="420" r="8" fill="#38425C"/></g>'; };
  var perde = function (x) { return '<g opacity=".9"><path d="M' + x + ' 40 h4 v380 h-4z" fill="#9AA6BC"/><path d="M' + (x + 4) + ' 46 c20 60 -10 120 14 190 c18 60 -8 120 10 180 h70 c-10 -60 14 -120 -4 -180 c-20 -70 10 -130 -10 -190z" fill="#A8D1C9"/></g>'; };
  var afis = function (x, y, ic) { return '<g><rect x="' + x + '" y="' + y + '" width="110" height="140" rx="4" fill="#FFFDF8" stroke="#CFC6B5" stroke-width="3"/>' + ic + '</g>'; };
  var insanAfis = function (x, y) { return afis(x, y, '<g transform="translate(' + (x + 55) + ' ' + (y + 20) + ')" fill="none" stroke="#C8573A" stroke-width="3"><circle cy="10" r="10"/><path d="M0 20 v50 M-26 34 h52 M0 70 l-18 44 M0 70 l18 44"/><path d="M-10 30 c6 10 14 10 20 0" stroke="#2F6BFF"/></g>'); };
  var tabakAfis = function (x, y) { return afis(x, y, '<g transform="translate(' + (x + 55) + ' ' + (y + 70) + ')"><circle r="42" fill="#fff" stroke="#2E3A5C" stroke-width="3"/><path d="M0 0 V-42 A42 42 0 0 1 36 21 Z" fill="#9CC79A"/><path d="M0 0 L36 21 A42 42 0 0 1 -36 21 Z" fill="#E7B14A"/><path d="M0 0 L-36 21 A42 42 0 0 1 0 -42 Z" fill="#D9472B"/></g><text x="' + (x + 55) + '" y="' + (y + 132) + '" text-anchor="middle" font-size="11" font-weight="700" fill="#46506A" font-family="Instrument Sans,sans-serif">dengeli tabak</text>'); };
  var tarti = function (x) { return '<g id="axk-tarti"><rect x="' + x + '" y="406" width="110" height="20" rx="6" fill="#E4E9F2" stroke="#9AA6BC" stroke-width="3"/><rect x="' + (x + 30) + '" y="410" width="50" height="12" rx="3" fill="#1D2438"/><text data-v="kg" x="' + (x + 55) + '" y="420" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#4BE08A">0.0</text></g>'; };
  var boyolcer = function (x) { var s = '<g id="axk-boy"><rect x="' + x + '" y="110" width="22" height="316" fill="#F3EFE6" stroke="#CFC6B5" stroke-width="2"/>'; for (var i = 0; i < 15; i++) s += '<path d="M' + x + ' ' + (130 + i * 20) + ' h' + (i % 5 ? 8 : 14) + '" stroke="#6A7593" stroke-width="2"/>'; return s + '<rect data-v="kafa" x="' + (x - 6) + '" y="120" width="44" height="8" rx="3" fill="#2F6BFF"/></g>'; };

  var ODA = {
    poliklinik: function () { return duvar('#EEF2F2', '#DDE5E4') + pencere(420, 70) + saat(640, 70) + insanAfis(700, 110) + kapi(40) + perde(830) + masa(330, 300) + bitki(940, 426) + '<rect x="840" y="330" width="150" height="24" rx="6" fill="#F1F4FA" stroke="#C7CFDD" stroke-width="3"/><rect x="850" y="354" width="10" height="72" fill="#9AA6BC"/><rect x="970" y="354" width="10" height="72" fill="#9AA6BC"/>'; },
    diyet: function () { return duvar('#F7F0E2', '#ECE1CB') + pencere(420, 70) + saat(640, 70) + tabakAfis(700, 110) + kapi(40) + masa(330, 300) + boyolcer(880) + tarti(860) + bitki(960, 426) + '<g><rect x="200" y="170" width="120" height="10" fill="#8A6A4A"/><circle cx="220" cy="160" r="10" fill="#D9472B"/><circle cx="244" cy="160" r="10" fill="#E7B14A"/><rect x="262" y="146" width="18" height="24" rx="3" fill="#9CC79A"/><ellipse cx="300" cy="164" rx="14" ry="6" fill="#F3EFE6" stroke="#CFC6B5"/></g>'; },
    acil: function () { return duvar('#E6EEF3', '#D3DEE6') + perde(60) + '<rect x="610" y="70" width="140" height="40" rx="6" fill="#C7D3E0"/><circle cx="640" cy="90" r="8" fill="#2E8E5B"/><circle cx="670" cy="90" r="8" fill="#2F6BFF"/><circle cx="700" cy="90" r="8" fill="#E7B14A"/>' + monitor(770, 120, 'axk-mon') + serum(740, 150) + saat(520, 80); },
    ameliyathane: function () { return duvar('#D9EAE6', '#C3DAD5') + '<g class="lamp"><ellipse cx="500" cy="70" rx="120" ry="28" fill="#F3F7F7" stroke="#9AA6BC" stroke-width="4"/><ellipse cx="500" cy="76" rx="84" ry="16" fill="#FFF6D6"/><path d="M500 0 v42" stroke="#9AA6BC" stroke-width="8"/></g><path d="M380 90 L300 330 H700 L620 90 Z" fill="#FFF6D6" opacity=".25"/>' + monitor(780, 110, 'axk-mon') + '<g><rect x="60" y="230" width="120" height="196" rx="8" fill="#B9C7CC"/><rect x="72" y="244" width="96" height="60" rx="4" fill="#1D2438"/><path d="M80 284 h20 l6 -14 l8 26 l6 -12 h50" stroke="#66C7FF" stroke-width="2" fill="none" class="ecg"/><circle cx="96" cy="340" r="14" fill="#E4E9F2" stroke="#7A8AA0" stroke-width="3"/><circle cx="144" cy="340" r="14" fill="#E4E9F2" stroke="#7A8AA0" stroke-width="3"/></g><g><rect x="760" y="300" width="160" height="12" rx="4" fill="#C7CFDD"/><rect x="834" y="312" width="12" height="114" fill="#9AA6BC"/><path d="M780 296 h30 M820 296 l20 -6 M860 294 h36" stroke="#7A8AA0" stroke-width="4" stroke-linecap="round"/></g>'; },
    odyo: function () { return duvar('#EFEDF6', '#DEDAEC') + '<rect x="560" y="80" width="400" height="346" rx="10" fill="#C9C2DE" stroke="#9E95C2" stroke-width="6"/><rect x="600" y="120" width="180" height="120" rx="6" fill="#BFE0F5" stroke="#fff" stroke-width="8"/><g fill="#B3AAD1">' + (function () { var s = ''; for (var i = 0; i < 6; i++) for (var j = 0; j < 4; j++) s += '<rect x="' + (800 + j * 38) + '" y="' + (110 + i * 48) + '" width="30" height="40" rx="4"/>'; return s; })() + '</g>' + masa(250, 300) + kapi(40) + saat(460, 80) + '<g><rect x="300" y="262" width="110" height="38" rx="6" fill="#2E3A5C"/><circle cx="330" cy="281" r="9" fill="#E7B14A"/><circle cx="360" cy="281" r="9" fill="#66C7FF"/><rect x="376" y="272" width="24" height="18" rx="3" fill="#4BE08A"/></g>'; },
    dkt: function () { return duvar('#F6EEF4', '#EADDE7') + pencere(400, 70) + kapi(40) + '<rect x="660" y="90" width="120" height="170" rx="60" fill="#DCE9F6" stroke="#B9C7D8" stroke-width="6"/><path d="M690 140 q30 -20 60 0" stroke="#fff" stroke-width="6" fill="none" opacity=".7"/>' + masa(320, 320, false) + '<g><rect x="360" y="296" width="40" height="24" rx="4" fill="#D9472B"/><rect x="408" y="290" width="30" height="30" rx="4" fill="#2F6BFF"/><circle cx="470" cy="306" r="14" fill="#E7B14A"/></g>' + afis(820, 120, '<g transform="translate(875 190)" font-family="Instrument Sans,sans-serif" font-weight="800" text-anchor="middle"><text y="-20" font-size="22" fill="#D9472B">a</text><text y="10" font-size="22" fill="#2F6BFF">ba</text><text y="40" font-size="22" fill="#2E8E5B">top</text></g>') + bitki(960, 426); },
    fizyo: function () { return duvar('#EEF3EA', '#DCE6D6') + pencere(380, 70) + kapi(40) + saat(600, 80) + '<g stroke="#9A7650" stroke-width="10" stroke-linecap="round"><path d="M680 300 h260 M680 340 h260"/><path d="M690 300 v126 M930 300 v126" stroke="#7A8AA0"/></g><circle cx="300" cy="380" r="46" fill="#2F6BFF" opacity=".85"/><rect x="430" y="408" width="200" height="18" rx="9" fill="#5E8F4A"/><g stroke="#C9A27A" stroke-width="8">' + (function () { var s = ''; for (var i = 0; i < 6; i++) s += '<path d="M' + (820 + i * 26) + ' 90 v190"/>'; return s; })() + '<path d="M810 100 h150 M810 160 h150 M810 220 h150"/></g>'; }
  };
  var YAKIN = { acil: [190, 60, 790, 440], ameliyathane: [190, 40, 790, 450], odyo: [60, 80, 720, 430], dkt: [40, 80, 720, 430], fizyo: [60, 80, 720, 430] };
  var DUVAR = { poliklinik: '#EEF2F2', diyet: '#F7F0E2', acil: '#E6EEF3', ameliyathane: '#D9EAE6', odyo: '#EFEDF6', dkt: '#F6EEF4', fizyo: '#EEF3EA' };
  /* oda yerleşimi: hasta / mentor / refakat konumları */
  var YER = {
    poliklinik: { hasta: [280, 426], mentor: [640, 426], refakat: [170, 426] },
    diyet: { hasta: [280, 426], mentor: [640, 426], refakat: [170, 426] },
    odyo: { hasta: [200, 426], mentor: [470, 426], refakat: [120, 426] },
    dkt: { hasta: [300, 426], mentor: [600, 426], refakat: [120, 426] },
    fizyo: { hasta: [250, 426], mentor: [560, 426], refakat: [150, 426] },
    acil: { yatak: [270, 340], mentor: [690, 426], refakat: [150, 426] },
    ameliyathane: { yatak: [270, 340], mentor: [640, 300], refakat: [200, 426] }
  };

  var sahneSVG = function (sen) {
    var oda = sen.oda, Y = YER[oda], h = sen.hasta, s = '<svg class="room" viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + X(sen.odaAd || oda) + ': ' + X(h.ad) + '">';
    s += ODA[oda]();
    var yat = h.poz === 'yat' || oda === 'acil' || oda === 'ameliyathane';
    if (sen.refakat) s += '<g data-who="refakat" class="walk">' + kisi(Object.assign({ x: Y.refakat[0], y: Y.refakat[1], rol: 'refakat' }, sen.refakat)) + '</g>';
    var m = sen.mentor, mx = Y.mentor, cerrah = oda === 'ameliyathane';
    var mentorSVG = '<g data-who="mentor">' + kisi({ x: mx[0], y: mx[1] + (cerrah ? 126 : 0), rol: 'mentor', cins: m.cins || 'K', ten: m.ten || TEN[1], sac: m.sac || '#2E241C', ic: cerrah ? '#3E8E7E' : '#7FA6E0', bone: cerrah ? '#3E8E7E' : null, maske: cerrah ? '#9FD8D0' : null, flip: true }) + '</g>';
    if (cerrah) s += mentorSVG;                                                    /* cerrah masanın arkasında */
    if (yat) s += yatak(Y.yatak[0] - 30, 330, 480);
    if (yat) s += '<g data-who="hasta">' + yatan(Object.assign({ x: Y.yatak[0] + 30, y: Y.yatak[1], ortu: oda === 'ameliyathane' ? '#7FB8A8' : '#9CC6E8', uyutuldu: oda === 'ameliyathane' && !h.uyanik }, h)) + '</g>';
    else s += '<g data-who="hasta" class="walk">' + (oda !== 'fizyo' && h.poz !== 'ayakta' ? sandalye(Y.hasta[0], Y.hasta[1]) : '') + kisi(Object.assign({ x: Y.hasta[0], y: Y.hasta[1], poz: 'otur' }, h, { poz: h.poz === 'ayakta' ? 'ayakta' : 'otur' })) + '</g>';
    if (!cerrah) s += mentorSVG;
    s += '</svg>';
    return s;
  };

  /* ----------------------------- oynatıcı ----------------------------- */
  var ACIK = null;
  var ADIM_AD = { sor: 'Anamnez', eylem: 'Muayene', karar: 'Karar', devir: 'Plan' };
  var open = function (sen, opt) {
    if (typeof sen === 'string') sen = SEN[sen];
    if (!sen) return null;
    opt = opt || {};
    if (ACIK) ACIK.kapat(true);
    if (!D.getElementById('axk-css')) { var st = D.createElement('style'); st.id = 'axk-css'; st.textContent = CSS; D.head.appendChild(st); }
    var prevFocus = D.activeElement, ov = D.createElement('div');
    ov.className = 'axk'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', (sen.odaAd || '') + ' · ' + sen.baslik);
    var asamalar = []; sen.adimlar.forEach(function (a) { var n = a.baslik && a.tip !== 'devir' ? a.baslik : ADIM_AD[a.tip]; if (n && asamalar.indexOf(n) < 0) asamalar.push(n); });
    ov.innerHTML = '<div class="axk-top"><div class="t"><b>' + X(sen.odaAd || '') + ' · ' + X(sen.hasta.hitap || sen.hasta.ad) + '</b><small>' + X(sen.baslik) + '</small></div>' +
      '<div class="axk-steps">' + asamalar.map(function (n) { return '<span data-as="' + X(n) + '">' + X(n) + '</span>'; }).join('') + '</div>' +
      '<button type="button" class="axk-nb" data-k="not">Dosya</button><button type="button" class="axk-x" data-k="x" aria-label="Sahneyi kapat">×</button></div>' +
      '<div class="axk-body"><div class="axk-stage"><div class="axk-scene">' + sahneSVG(sen) + '</div><div class="axk-panel" aria-live="polite"></div></div>' +
      '<aside class="axk-side" aria-label="Hasta dosyası"><span class="k">hasta dosyası</span><h3>' + X(sen.hasta.ad) + ', ' + X(sen.hasta.yas) + '</h3><ul data-notlar><li class="empty" style="background:none;border:0;padding:0">Görüşmede öğrendiklerin burada birikir.</li></ul></aside></div>';
    D.body.appendChild(ov);
    var $ = function (q) { return ov.querySelector(q); };
    var panel = $('.axk-panel'), scene = $('.axk-scene');
    scene.style.background = 'linear-gradient(180deg,' + (DUVAR[sen.oda] || '#E3DCCD') + ' 0 76.8%,#BFAF93 76.8% 100%)';
    /* dar ekranda sahneyi karakterlere yaklaştır */
    if (W.innerWidth < 700) { var vb = YAKIN[sen.oda] || [90, 80, 720, 430], sv = scene.querySelector('svg.room'); sv.setAttribute('viewBox', vb.join(' ')); scene.style.aspectRatio = vb[2] + '/' + vb[3]; }
    var S = { i: -1, sec: {}, yaz: null };
    var notlar = [];
    var not = function (b, t) {
      notlar.push([b, t]);
      $('[data-notlar]').innerHTML = notlar.map(function (n) { return '<li><b>' + X(n[0]) + '</b>' + X(n[1]) + '</li>'; }).join('');
    };
    /* monitör */
    var vit = Object.assign({}, sen.vital || {});
    var vitalYaz = function (alarm) {
      var mon = ov.querySelector('#axk-mon'); if (!mon) return;
      ['nabiz', 'ta', 'spo2'].forEach(function (k) { var t = mon.querySelector('[data-v="' + k + '"]'); if (t) { t.textContent = vit[k] != null ? vit[k] + (k === 'spo2' ? '%' : '') : '—'; t.classList.toggle('alarm', !!(alarm && alarm[k])); } });
    };
    vitalYaz();
    var konusan = function (kim, on) { var g = ov.querySelector('[data-who="' + kim + '"]'); if (g) g.classList.toggle('talk', !!on); };
    var KIM = { hasta: sen.hasta.hitap || sen.hasta.ad, mentor: (sen.mentor.unvan ? sen.mentor.unvan + ' ' : '') + sen.mentor.ad, refakat: sen.refakat ? sen.refakat.ad : 'Refakatçi', sen: 'Sen', anlatici: 'Sahne' };
    /* konuşma balonu: daktilo efekti; tıklayınca tamamlanır */
    var soyle = function (kim, metin, sonra) {
      clearInterval(S.yaz); ['hasta', 'mentor', 'refakat'].forEach(function (k) { konusan(k, false); });
      var box = D.createElement('div'); box.className = 'axk-say';
      box.innerHTML = '<span class="who ' + kim + '">' + X(KIM[kim] || kim) + '</span><p></p>';
      panel.innerHTML = ''; panel.appendChild(box);
      var p = box.querySelector('p'), i = 0, bitti = false;
      var bitir = function () { if (bitti) return; bitti = true; clearInterval(S.yaz); p.textContent = metin; konusan(kim, false); if (sonra) sonra(); };
      konusan(kim, true);
      if (RM) { bitir(); return box; }
      S.yaz = setInterval(function () { i += 2; p.innerHTML = X(metin.slice(0, i)) + '<span class="cur"></span>'; if (i >= metin.length) bitir(); }, 22);
      box.addEventListener('click', bitir);
      S.bitir = bitir;
      return box;
    };
    var asama = function (n) { Array.prototype.forEach.call(ov.querySelectorAll('[data-as]'), function (el) { var idx = asamalar.indexOf(el.getAttribute('data-as')), cur = asamalar.indexOf(n); el.className = idx === cur ? 'on' : idx < cur ? 'done' : ''; }); };
    var devam = function (lbl) { var r = D.createElement('div'); r.className = 'axk-row'; r.innerHTML = '<button type="button" class="axk-btn pri" data-k="ileri">' + X(lbl || 'Devam') + '</button>'; panel.appendChild(r); var b = r.querySelector('button'); setTimeout(function () { try { b.focus({ preventScroll: true }); } catch (e) {} }, 30); return b; };
    var popup = function (t, alt) { var old = scene.querySelector('.axk-pop'); if (old) old.remove(); var d = D.createElement('div'); d.className = 'axk-pop'; d.innerHTML = X(t) + (alt ? '<small>' + X(alt) + '</small>' : ''); scene.appendChild(d); clearTimeout(S.pt); S.pt = setTimeout(function () { d.remove(); }, 4200); };
    var parlat = function (sel) { var el = ov.querySelector(sel); if (!el) return; el.classList.remove('glow'); void el.getBoundingClientRect(); el.classList.add('glow'); };
    var ANIM = {
      tarti: function (o) { parlat('#axk-tarti'); var t = ov.querySelector('[data-v="kg"]'); if (t && o.deger) { var hedef = parseFloat(String(o.deger).replace(',', '.')) || 0, n = 0, st = RM ? 1 : 18; var iv = setInterval(function () { n++; t.textContent = (hedef * n / st).toFixed(1); if (n >= st) clearInterval(iv); }, 40); } },
      boy: function () { parlat('#axk-boy'); },
      monitor: function () { parlat('#axk-mon'); },
      mentor: function () { var g = ov.querySelector('[data-who="mentor"] .kolL'); if (g) { g.classList.remove('gest'); void g.getBoundingClientRect(); g.classList.add('gest'); } },
      hasta: function () { parlat('[data-who="hasta"]'); }
    };
    var git = function () {
      S.i++;
      var a = sen.adimlar[S.i];
      if (!a) return;
      var n = a.baslik && a.tip !== 'devir' ? a.baslik : ADIM_AD[a.tip]; if (n) asama(n);
      if (a.tip === 'konus') { soyle(a.kim, a.metin, function () { devam().onclick = git; }); if (a.anim && ANIM[a.anim]) ANIM[a.anim](a); }
      else if (a.tip === 'sor' || a.tip === 'eylem') secimAdim(a);
      else if (a.tip === 'karar') kararAdim(a);
      else if (a.tip === 'devir') devirAdim(a);
    };
    var secimAdim = function (a) {
      var kullan = [], kalan = function () { return a.hak ? a.hak - kullan.length : null; };
      var ciz = function (son) {
        var box = son || D.createElement('div');
        var h = '<div class="axk-h"><b>' + X(a.baslik || (a.tip === 'sor' ? 'Anamnez' : 'Muayene')) + '</b><small>' + X(a.yonerge || '') + (a.hak ? ' · ' + kalan() + ' hak' : '') + '</small></div><div class="axk-ch">' +
          a.secenek.map(function (o) { var used = kullan.indexOf(o.id) >= 0; return '<button type="button" data-o="' + X(o.id) + '" class="' + (used ? 'used' : '') + '"' + (used || (a.hak && kalan() <= 0) ? ' disabled' : '') + '>' + X(o.t) + '</button>'; }).join('') + '</div>';
        box.innerHTML = h;
        var r = D.createElement('div'); r.className = 'axk-row'; r.innerHTML = '<button type="button" class="axk-btn' + ((a.hak && kalan() <= 0) || kullan.length === a.secenek.length ? ' pri' : '') + '" data-k="bitti">' + (kullan.length ? 'Yeterli, devam' : 'Atla') + '</button>'; box.appendChild(r);
        return box;
      };
      var liste = function () { var w = D.createElement('div'); panel.appendChild(ciz(w)); w.addEventListener('click', tik); };
      var tik = function (e) {
        var b = e.target.closest('[data-o]'); if (b && !b.disabled) {
          var o = a.secenek.filter(function (x) { return x.id === b.getAttribute('data-o'); })[0]; kullan.push(o.id);
          var son = function () {
            var fb = o.geri || (o.puan >= 2 ? GENEL.iyi : o.puan < 0 ? GENEL.kotu : (o.puan > 0 ? '' : GENEL.bos));
            if (fb) { var f = D.createElement('p'); f.className = 'axk-fb ' + (o.puan >= 2 ? 'ok' : o.puan < 0 ? 'no' : ''); f.innerHTML = '<b>' + X(KIM.mentor) + ':</b> ' + X(fb); panel.appendChild(f); }
            liste();
          };
          if (a.tip === 'sor') {
            soyle('sen', o.t, function () {
              setTimeout(function () {
                soyle(o.kim || (sen.hasta.konusamaz && sen.refakat ? 'refakat' : 'hasta'), o.cevap, function () { if (o.not || o.puan > 0) not(o.not ? o.not.split('|')[0] : 'Anamnez', o.not ? (o.not.split('|')[1] || o.cevap) : o.cevap); son(); });
              }, RM ? 0 : 260);
            });
          } else {
            if (o.anim && ANIM[o.anim]) ANIM[o.anim](o); else ANIM.hasta();
            if (o.vital) { Object.assign(vit, o.vital); vitalYaz(o.alarm); }
            popup(o.t, o.deger || '');
            soyle(o.kim || 'anlatici', o.sonuc, function () { not(o.t, o.sonuc); son(); });
          }
          return;
        }
        if (e.target.closest('[data-k="bitti"]')) {
          S.sec[S.i] = kullan.slice();
          var kac = a.secenek.filter(function (x) { return (x.puan || 0) >= 2 && kullan.indexOf(x.id) < 0; });
          var msg = kac.length ? 'Atladığın önemli ' + (a.tip === 'sor' ? 'soru' : 'adım') + (kac.length > 1 ? 'lar' : '') + ': ' + kac.map(function (x) { return '“' + x.t + '”'; }).join(', ') + '.' : (a.tip === 'sor' ? 'Görüşmede kritik bilgilerin hepsini topladın.' : 'Gerekli değerlendirmelerin hepsini yaptın.');
          ANIM.mentor();
          soyle('mentor', (a.ozet ? a.ozet + ' ' : '') + msg, function () { devam().onclick = git; });
        }
      };
      panel.innerHTML = ''; if (a.giris) soyle('mentor', a.giris, liste); else liste();
    };
    var kararAdim = function (a) {
      var goster = function () {
        var w = D.createElement('div');
        w.innerHTML = '<div class="axk-h"><b>' + X(a.baslik || 'Klinik karar') + '</b><small>tek seçenek</small></div><div class="axk-ch">' + a.secenek.map(function (o, i) { return '<button type="button" data-c="' + i + '">' + X(o.t) + '</button>'; }).join('') + '</div>';
        panel.appendChild(w);
        w.addEventListener('click', function (e) {
          var b = e.target.closest('[data-c]'); if (!b || S.sec[S.i] != null) return;
          var i = +b.getAttribute('data-c'), o = a.secenek[i]; S.sec[S.i] = i;
          Array.prototype.forEach.call(w.querySelectorAll('[data-c]'), function (x, j) { x.disabled = true; if (a.secenek[j].dogru) x.classList.add('ok'); else if (j === i) x.classList.add('no'); });
          if (o.vital) { Object.assign(vit, o.vital); vitalYaz(o.alarm); }
          ANIM.mentor();
          var f = D.createElement('p'); f.className = 'axk-fb ' + (o.dogru ? 'ok' : 'no'); f.innerHTML = '<b>' + X(KIM.mentor) + ':</b> ' + X(o.geri || (o.dogru ? 'Doğru.' : 'Bu seçenek uygun değil.')); panel.appendChild(f);
          devam().onclick = git;
        });
      };
      soyle(a.kim || 'mentor', a.soru, goster);
    };
    var devirAdim = function (a) {
      var R = puanla(sen, S.sec);
      var kutu = function () {
        if (!R.rows.length) { var r0 = D.createElement('div'); r0.className = 'axk-row'; r0.innerHTML = '<button type="button" class="axk-btn pri" data-k="devir">' + X(a.dugme || 'Kapat') + '</button>'; panel.appendChild(r0); r0.firstChild.onclick = function () { kapat(true); if (opt.onDevir) opt.onDevir(R, a.hedef); }; return; }
        var w = D.createElement('div'); w.className = 'axk-karne';
        w.innerHTML = '<div style="display:flex;align-items:baseline;gap:10px"><span class="p">' + R.puan + '</span><small>/ 100 · klinik görüşme puanı</small></div><ul style="margin:6px 0 0;padding-left:18px">' +
          R.rows.map(function (r) { return '<li>' + (r.ok ? '✓ ' : '• ') + X(r.t) + ': ' + r.got + ' / ' + r.max + (r.kacan.length ? ' <small>(kaçan: ' + X(r.kacan.slice(0, 3).join('; ')) + ')</small>' : '') + '</li>'; }).join('') + '</ul>';
        panel.appendChild(w);
        var r = D.createElement('div'); r.className = 'axk-row';
        r.innerHTML = '<button type="button" class="axk-btn" data-k="tekrar">Baştan oyna</button><button type="button" class="axk-btn pri" data-k="devir">' + X(a.dugme || 'Devam') + '</button>';
        panel.appendChild(r);
        r.querySelector('[data-k="tekrar"]').onclick = function () { open(sen, opt); };
        var db = r.querySelector('[data-k="devir"]'); db.onclick = function () { kapat(true); if (opt.onDevir) opt.onDevir(R, a.hedef); };
        setTimeout(function () { try { db.focus({ preventScroll: true }); } catch (e) {} }, 30);
        if (opt.onSonuc) opt.onSonuc(R);
      };
      ANIM.mentor();
      soyle('mentor', a.metin, kutu);
    };
    var kapat = function (sessiz) {
      clearInterval(S.yaz); clearTimeout(S.pt);
      D.removeEventListener('keydown', key, true);
      if (ov.parentNode) ov.parentNode.removeChild(ov);
      ACIK = null;
      if (prevFocus && prevFocus.focus) try { prevFocus.focus({ preventScroll: true }); } catch (e) {}
      if (!sessiz && opt.onKapat) opt.onKapat();
    };
    var key = function (e) {
      if (e.key === 'Escape') { e.preventDefault(); kapat(); return; }
      if (e.key === 'Tab') {
        var f = Array.prototype.filter.call(ov.querySelectorAll('button:not(:disabled)'), function (b) { return b.offsetParent !== null; });
        if (!f.length) return; var i = f.indexOf(D.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    };
    D.addEventListener('keydown', key, true);
    ov.querySelector('[data-k="x"]').onclick = function () { kapat(); };
    ov.querySelector('[data-k="not"]').onclick = function () { $('.axk-side').classList.toggle('on'); };
    ACIK = { kapat: kapat, sen: sen };
    setTimeout(git, RM ? 0 : 500);
    setTimeout(function () { try { ov.querySelector('[data-k="x"]').focus({ preventScroll: true }); } catch (e) {} }, 40);
    return ACIK;
  };

  api.open = open;
  api.acik = function () { return ACIK; };
  api.ODALAR = Object.keys(ODA);
  return api;
});
