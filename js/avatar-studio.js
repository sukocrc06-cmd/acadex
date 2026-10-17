/* ==========================================================================
   Acadex · Avatar stüdyosu
   Bitmoji tarzı kişisel avatar editörü (DiceBear "avataaars", Pablo Stanley,
   ticari kullanım dahil ücretsiz).

   - Ayarlar → "Avatarını oluştur" eski "Emoji avatar" penceresinin yerine geçer
     (window.openAvatarBuilder bu dosyada yeniden tanımlanır).
   - Avatar tarayıcıda DiceBear kütüphanesiyle çizilir; kütüphane yüklenemezse
     DiceBear'ın kendi sunucusu (api.dicebear.com) kullanılır.
   - Kaydet: avatar 512×512 PNG'ye çevrilir ve Supabase Storage'daki "avatars"
     bucket'ına (<kullanıcı id>/avatar-studio.png) yüklenir. Seçimler,
     profiles.avatar_url adresinin sonundaki "acx" parametresinde saklanır;
     veritabanında yeni sütun gerekmez.
   - İfade seti: aynı avatarın mutlu / düşünceli / şaşkın ... halleri.
     Acadia önerisinde ve başarı bildirimlerinde sticker olarak görünür.
   ========================================================================== */
(function () {
  'use strict';

  var CDN_CORE = 'https://cdn.jsdelivr.net/npm/@dicebear/core@9.2.2/+esm';
  var CDN_STYLE = 'https://cdn.jsdelivr.net/npm/@dicebear/avataaars@9.2.2/+esm';
  var API = 'https://api.dicebear.com/9.x/avataaars/svg';
  var FILE = 'avatar-studio.png';

  /* ---------- seçenekler (Türkçe adlarıyla) ---------- */
  var SKIN = [['ffdbb4', 'açık'], ['edb98a', 'buğday'], ['f8d25c', 'sarı'], ['fd9841', 'bronz'], ['d08b5b', 'esmer'], ['ae5d29', 'koyu'], ['614335', 'çok koyu']];
  var HAIR_C = [['2c1b18', 'siyah'], ['4a312c', 'koyu kahve'], ['724133', 'kahve'], ['a55728', 'kestane'], ['b58143', 'açık kahve'], ['d6b370', 'sarı'], ['ecdcbf', 'platin'], ['c93305', 'kızıl'], ['e8e1e1', 'gri'], ['f59797', 'pembe']];
  var CLOTH_C = [['262e33', 'siyah'], ['3c4f5c', 'antrasit'], ['929598', 'gri'], ['e6e6e6', 'açık gri'], ['ffffff', 'beyaz'], ['25557c', 'lacivert'], ['5199e4', 'mavi'], ['65c9ff', 'açık mavi'], ['b1e2ff', 'buz mavisi'], ['a7ffc4', 'mint'], ['ffffb1', 'limon'], ['ffafb9', 'pudra'], ['ff488e', 'pembe'], ['ff5c5c', 'kırmızı']];
  var HAT_C = CLOTH_C.concat([['ffdeb5', 'bej']]);
  var BG = [['b6e3f4', 'gök'], ['c0aede', 'lila'], ['d1d4f9', 'lavanta'], ['ffd5dc', 'pembe'], ['ffdfbf', 'şeftali'], ['fff1b8', 'fosfor'], ['e7f6ec', 'nane'], ['dbe6ff', 'acadex mavisi'], ['0d1838', 'gece'], ['transparent', 'şeffaf']];
  var TOPS = [
    ['Uzun', [['straight01', 'düz uzun'], ['straight02', 'düz uzun 2'], ['straightAndStrand', 'perçemli'], ['longButNotTooLong', 'omuz boyu'], ['bob', 'küt'], ['bun', 'topuz'], ['curly', 'kıvırcık'], ['curvy', 'dalgalı'], ['bigHair', 'gür'], ['miaWallace', 'kâküllü'], ['frida', 'örgülü taç'], ['fro', 'afro'], ['froBand', 'bantlı afro'], ['dreads', 'rasta'], ['shaggy', 'katlı'], ['shaggyMullet', 'mullet'], ['frizzle', 'kabarık']]],
    ['Kısa', [['shortFlat', 'kısa düz'], ['shortRound', 'kısa yuvarlak'], ['shortWaved', 'kısa dalgalı'], ['shortCurly', 'kısa kıvırcık'], ['theCaesar', 'sezar'], ['theCaesarAndSidePart', 'yandan ayrık'], ['sides', 'yanlar'], ['shavedSides', 'yanları kazınmış'], ['dreads01', 'kısa rasta'], ['dreads02', 'kısa rasta 2'], ['', 'saçsız']]],
    ['Örtü ve şapka', [['hijab', 'başörtüsü'], ['turban', 'türban'], ['hat', 'şapka'], ['winterHat1', 'bere'], ['winterHat02', 'ponponlu bere'], ['winterHat03', 'kulaklı bere'], ['winterHat04', 'kar beresi']]]
  ];
  var COVERS = { hijab: 1, turban: 1, hat: 1, winterHat1: 1, winterHat02: 1, winterHat03: 1, winterHat04: 1 };
  var EYES = [['default', 'normal'], ['happy', 'mutlu'], ['wink', 'göz kırpan'], ['squint', 'kısık'], ['side', 'yana bakan'], ['surprised', 'şaşkın'], ['closed', 'kapalı'], ['hearts', 'kalpli'], ['eyeRoll', 'devirmiş'], ['winkWacky', 'şaşı kırpan']];
  var BROWS = [['defaultNatural', 'doğal'], ['default', 'ince'], ['flatNatural', 'düz'], ['raisedExcitedNatural', 'kalkık'], ['raisedExcited', 'çok kalkık'], ['upDownNatural', 'tek kalkık'], ['sadConcernedNatural', 'endişeli'], ['frownNatural', 'çatık'], ['angryNatural', 'kızgın'], ['unibrowNatural', 'bitişik']];
  var MOUTH = [['smile', 'gülümseme'], ['default', 'normal'], ['twinkle', 'tatlı'], ['tongue', 'dil çıkaran'], ['serious', 'ciddi'], ['concerned', 'endişeli'], ['disbelief', 'inanamayan'], ['sad', 'üzgün'], ['eating', 'yiyor'], ['grimace', 'sırıtan']];
  var BEARD = [['', 'yok'], ['beardLight', 'hafif sakal'], ['beardMedium', 'sakal'], ['beardMajestic', 'gür sakal'], ['moustacheFancy', 'kıvrık bıyık'], ['moustacheMagnum', 'kalın bıyık']];
  var GLASS = [['', 'yok'], ['prescription01', 'numaralı'], ['prescription02', 'numaralı 2'], ['round', 'yuvarlak'], ['wayfarers', 'kemik'], ['sunglasses', 'güneş'], ['kurt', 'büyük güneş']];
  var CLOTH = [['hoodie', 'kapüşonlu'], ['shirtCrewNeck', 'tişört'], ['shirtVNeck', 'v yaka'], ['shirtScoopNeck', 'geniş yaka'], ['graphicShirt', 'baskılı tişört'], ['collarAndSweater', 'yakalı kazak'], ['blazerAndShirt', 'ceket gömlek'], ['blazerAndSweater', 'ceket kazak'], ['overall', 'salopet']];

  var EXPR = [
    { k: 'mutlu', label: 'mutlu', eyes: 'happy', eyebrows: 'defaultNatural', mouth: 'smile' },
    { k: 'dusunceli', label: 'düşünceli', eyes: 'side', eyebrows: 'upDownNatural', mouth: 'serious' },
    { k: 'saskin', label: 'şaşkın', eyes: 'surprised', eyebrows: 'raisedExcitedNatural', mouth: 'disbelief' },
    { k: 'kirpan', label: 'göz kırpan', eyes: 'wink', eyebrows: 'defaultNatural', mouth: 'twinkle' },
    { k: 'heyecanli', label: 'heyecanlı', eyes: 'hearts', eyebrows: 'raisedExcited', mouth: 'smile' }
  ];

  var PRESETS = {
    kiz: { top: 'straight01', hairColor: '4a312c', eyes: 'default', eyebrows: 'defaultNatural', mouth: 'smile', facialHair: '', accessories: '', clothing: 'shirtScoopNeck', clothesColor: 'ff488e', bg: 'ffd5dc' },
    erkek: { top: 'shortFlat', hairColor: '2c1b18', eyes: 'default', eyebrows: 'defaultNatural', mouth: 'smile', facialHair: '', accessories: '', clothing: 'hoodie', clothesColor: '25557c', bg: 'b6e3f4' }
  };
  var DEF = { skinColor: 'edb98a', top: 'shortFlat', hairColor: '2c1b18', hatColor: '25557c', eyes: 'default', eyebrows: 'defaultNatural', mouth: 'smile', facialHair: '', facialHairColor: '2c1b18', accessories: '', accessoriesColor: '262e33', clothing: 'hoodie', clothesColor: '25557c', clothingGraphic: 'bear', bg: 'b6e3f4' };

  var KEYS = Object.keys(DEF);
  var assign = function (a) { for (var i = 1; i < arguments.length; i++) { var b = arguments[i]; if (b) for (var k in b) if (Object.prototype.hasOwnProperty.call(b, k)) a[k] = b[k]; } return a; };
  var clean = function (c) { var o = {}; KEYS.forEach(function (k) { o[k] = c && typeof c[k] === 'string' ? c[k] : DEF[k]; }); return o; };

  /* ---------- seçimleri adreste taşımak ---------- */
  var b64e = function (s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  var b64d = function (s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return decodeURIComponent(escape(atob(s))); };
  var encodeCfg = function (c) { var short = {}; KEYS.forEach(function (k) { if (c[k] !== DEF[k]) short[k] = c[k]; }); return b64e(JSON.stringify(short)); };
  var cfgFromUrl = function (url) {
    if (!url) return null;
    var m = String(url).match(/[?&]acx=([A-Za-z0-9_-]+)/);
    if (!m) return null;
    try { return clean(assign({}, DEF, JSON.parse(b64d(m[1])))); } catch (e) { return null; }
  };

  /* ---------- çizim: önce kütüphane, olmazsa DiceBear sunucusu ---------- */
  var lib = null, libP = null;
  var loadLib = function () {
    if (libP) return libP;
    libP = Promise.all([import(CDN_CORE), import(CDN_STYLE)]).then(function (m) {
      if (!m[0] || typeof m[0].createAvatar !== 'function') throw new Error('dicebear core');
      lib = { create: m[0].createAvatar, style: m[1] };
      return lib;
    }).catch(function (e) { if (window.console) console.warn('Avatar kütüphanesi yüklenemedi, DiceBear sunucusu kullanılacak.', e); lib = false; return false; });
    return libP;
  };
  var opts = function (c) {
    var o = {
      seed: 'acadex', skinColor: [c.skinColor], nose: ['default'],
      eyes: [c.eyes], eyebrows: [c.eyebrows], mouth: [c.mouth],
      top: [c.top || 'shortFlat'], topProbability: c.top ? 100 : 0,
      hairColor: [c.hairColor], hatColor: [c.hatColor],
      facialHair: [c.facialHair || 'beardLight'], facialHairProbability: c.facialHair ? 100 : 0, facialHairColor: [c.facialHairColor],
      accessories: [c.accessories || 'round'], accessoriesProbability: c.accessories ? 100 : 0, accessoriesColor: [c.accessoriesColor],
      clothing: [c.clothing], clothesColor: [c.clothesColor], clothingGraphic: [c.clothingGraphic],
      backgroundColor: [c.bg], backgroundType: ['solid']
    };
    return o;
  };
  var apiUrl = function (c) {
    var o = opts(c), q = [];
    Object.keys(o).forEach(function (k) { var v = o[k]; q.push(encodeURIComponent(k) + '=' + encodeURIComponent(Array.isArray(v) ? v.join(',') : String(v))); });
    return API + '?' + q.join('&');
  };
  var svgOf = function (c) { return lib ? lib.create(lib.style, opts(c)).toString() : null; };
  var srcOf = function (c) {
    if (lib) { try { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgOf(c)); } catch (e) { /* düşerse sunucu */ } }
    return apiUrl(c);
  };
  var withExpr = function (c, ex) { return assign({}, c, { eyes: ex.eyes, eyebrows: ex.eyebrows, mouth: ex.mouth }); };

  /* PNG: SVG'yi tuvale çiz (kütüphane yoksa SVG'yi sunucudan al) */
  var pngOf = function (c, size) {
    size = size || 512;
    var svgP = lib ? Promise.resolve(svgOf(c)) : fetch(apiUrl(c)).then(function (r) { if (!r.ok) throw new Error('svg ' + r.status); return r.text(); });
    return svgP.then(function (svg) {
      return new Promise(function (res, rej) {
        var im = new Image();
        im.onload = function () {
          try {
            var cv = document.createElement('canvas'); cv.width = size; cv.height = size;
            cv.getContext('2d').drawImage(im, 0, 0, size, size);
            cv.toBlob(function (b) { b ? res(b) : rej(new Error('png')); }, 'image/png');
          } catch (e) { rej(e); }
        };
        im.onerror = function () { rej(new Error('svg image')); };
        im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      });
    });
  };

  /* ---------- global erişim (dashboard.js'teki let/const'lar) ---------- */
  var g = function (name) { try { return (0, eval)(name); } catch (e) { return undefined; } };
  var alertMsg = function (type, msg) { var f = window.showDashboardAlert || g('showDashboardAlert'); if (typeof f === 'function') f(type, msg); };
  var profile = function () { return g('currentUserProfile') || null; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); };
  var lsGet = function () { try { var v = localStorage.getItem('acx-avatar-cfg'); return v ? clean(JSON.parse(v)) : null; } catch (e) { return null; } };
  var lsSet = function (c) { try { localStorage.setItem('acx-avatar-cfg', JSON.stringify(c)); } catch (e) { /* özel pencere vb. */ } };

  /* ---------- stil ---------- */
  var css = [
    '.avs-back{position:fixed;inset:0;z-index:1000000;background:rgba(13,24,56,0.55);display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box}',
    '.avs-back[hidden]{display:none}',
    '.avs{position:relative;width:min(960px,100%);height:min(720px,calc(100vh - 36px));display:flex;flex-direction:column;background:#FFFEFB;color:#0D1838;border-radius:8px;box-shadow:0 1px 0 #E6E2D6,0 40px 80px -40px rgba(13,24,56,0.7);overflow:hidden;font-family:"Instrument Sans",system-ui,sans-serif}',
    '.avs-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;padding:22px 26px 14px;border-bottom:1px solid #E6E2D6}',
    '.avs-eyb{display:block;font-family:Caveat,"Segoe Print",cursive;font-size:22px;color:#2F6BFF;transform:rotate(-2deg);transform-origin:0 100%;line-height:1}',
    '.avs-head h2{margin:4px 0 0;font-family:"Bricolage Grotesque",system-ui,sans-serif;font-size:28px;font-weight:800;letter-spacing:-0.02em;line-height:1.05}',
    '.avs-x{border:0;background:none;font-size:28px;line-height:1;color:#5B6787;cursor:pointer;width:44px;height:44px;border-radius:50%}',
    '.avs-x:hover{background:#EEF1F6}',
    '.avs-body{display:grid;grid-template-columns:290px minmax(0,1fr);min-height:0;flex:1}',
    '.avs-side{padding:22px 24px;border-right:1px solid #E6E2D6;display:flex;flex-direction:column;gap:16px;overflow-y:auto}',
    '.avs-prev{position:relative;width:220px;height:220px;margin:0 auto;border-radius:28px;overflow:hidden;background:#F3F5FA;box-shadow:0 1px 0 #DDE2EC,0 24px 34px -26px rgba(13,24,56,0.55)}',
    '.avs-prev img{width:100%;height:100%;display:block}',
    '.avs-start{display:flex;gap:8px;justify-content:center}',
    '.avs-chip{border:1.6px solid #1A2A5C;background:#FFFFFF;color:#1A2A5C;border-radius:999px;padding:8px 16px;min-height:40px;font:inherit;font-weight:600;font-size:14px;cursor:pointer}',
    '.avs-chip:hover{background:#FFF3C2}',
    '.avs-lbl{font-family:Caveat,"Segoe Print",cursive;font-size:21px;color:#5B6787;line-height:1}',
    '.avs-ex{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}',
    '.avs-ex figure{margin:0;text-align:center}',
    '.avs-ex img{width:100%;aspect-ratio:1;display:block;filter:drop-shadow(1.5px 0 0 #fff) drop-shadow(-1.5px 0 0 #fff) drop-shadow(0 1.5px 0 #fff) drop-shadow(0 -1.5px 0 #fff) drop-shadow(0 4px 5px rgba(13,24,56,0.25))}',
    '.avs-ex figcaption{font-size:11px;color:#5B6787;margin-top:2px;line-height:1.2}',
    '.avs-dl{border:1.6px solid #1A2A5C;background:#FFFFFF;color:#1A2A5C;border-radius:999px;padding:10px 16px;min-height:44px;font:inherit;font-weight:600;font-size:14px;cursor:pointer}',
    '.avs-dl:hover{background:#EEF1F6}',
    '.avs-main{display:flex;flex-direction:column;min-width:0;min-height:0}',
    '.avs-tabs{display:flex;flex-wrap:wrap;gap:6px;padding:16px 22px 10px;flex:none}',
    '.avs-tab{flex:none;border:1px solid #D3D9E6;background:#FFFFFF;color:#33405F;border-radius:999px;padding:7px 14px;min-height:38px;font:inherit;font-size:14px;font-weight:600;cursor:pointer}',
    '.avs-tab[aria-selected="true"]{background:#0D1838;border-color:#0D1838;color:#FFFFFF}',
    '.avs-panel{padding:6px 22px 22px;overflow-y:auto;min-height:0;flex:1}',
    '.avs-sub{margin:14px 0 8px;font-family:Caveat,"Segoe Print",cursive;font-size:22px;color:#1A2A5C;line-height:1}',
    '.avs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:10px}',
    '.avs-opt{position:relative;border:1.6px solid #DDE2EC;background:#FFFFFF;border-radius:12px;padding:6px 4px 6px;cursor:pointer;font:inherit;color:#33405F;display:flex;flex-direction:column;align-items:center;gap:2px;transition:border-color .15s,transform .15s}',
    '.avs-opt:hover{border-color:#9DB8FF;transform:translateY(-1px)}',
    '.avs-opt[aria-pressed="true"]{border-color:#2F6BFF;box-shadow:0 0 0 3px rgba(47,107,255,0.18)}',
    '.avs-opt img{width:64px;height:64px;display:block;border-radius:10px;background:#F3F5FA}',
    '.avs-opt span{font-size:11.5px;line-height:1.2;text-align:center}',
    '.avs-sw{display:flex;flex-wrap:wrap;gap:8px}',
    '.avs-swb{width:36px;height:36px;border-radius:50%;border:2px solid #FFFFFF;box-shadow:0 0 0 1.5px #C9D1E1;cursor:pointer;padding:0}',
    '.avs-swb[aria-pressed="true"]{box-shadow:0 0 0 2.5px #2F6BFF}',
    '.avs-swb.t{background-image:linear-gradient(45deg,#DDE2EC 25%,transparent 25%,transparent 75%,#DDE2EC 75%),linear-gradient(45deg,#DDE2EC 25%,#FFFFFF 25%,#FFFFFF 75%,#DDE2EC 75%);background-size:10px 10px;background-position:0 0,5px 5px}',
    '.avs-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 22px;border-top:1px solid #E6E2D6;background:#FFFEFB;flex:none}',
    '.avs-rm{border:0;background:none;color:#B4351F;font:inherit;font-size:14px;cursor:pointer;text-decoration:underline;text-underline-offset:3px;padding:10px 4px;min-height:44px}',
    '.avs-acts{display:flex;gap:8px}',
    '.avs-no{border:1.6px solid #C9D1E1;background:#FFFFFF;color:#33405F;border-radius:999px;padding:10px 18px;min-height:44px;font:inherit;font-weight:600;cursor:pointer}',
    '.avs-ok{border:0;background:#2F6BFF;color:#FFFFFF;border-radius:999px;padding:10px 22px;min-height:44px;font:inherit;font-weight:700;cursor:pointer;box-shadow:0 12px 22px -12px rgba(47,107,255,0.8)}',
    '.avs-ok:hover{background:#1F5FD6}.avs-ok:disabled{opacity:.6;cursor:default}',
    '.avs button:focus-visible{outline:2px solid #2F6BFF;outline-offset:2px}',
    '@media (max-width:760px){.avs-back{padding:0;align-items:stretch}.avs{max-height:none;height:100%;border-radius:0}.avs-head{padding:16px 16px 10px}.avs-head h2{font-size:23px}.avs-body{grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr)}.avs-side{border-right:0;border-bottom:1px solid #E6E2D6;padding:12px 16px;display:grid;grid-template-columns:116px minmax(0,1fr);gap:8px 14px;align-items:center;overflow:visible}.avs-prev{width:116px;height:116px;border-radius:20px;grid-row:span 3}.avs-start{justify-content:flex-start}.avs-chip{padding:6px 12px;min-height:36px}.avs-lbl{display:none}.avs-dl{justify-self:start;min-height:36px;padding:6px 12px}.avs-tabs{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:thin;padding:10px 16px 6px}.avs-panel{padding:4px 16px 16px}.avs-grid{grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:8px}.avs-opt img{width:54px;height:54px}.avs-foot{padding:10px 16px}.avs-ex{grid-column:2}}',
    /* sticker'lar */
    '.avs-st{pointer-events:none;filter:drop-shadow(1.5px 0 0 #fff) drop-shadow(-1.5px 0 0 #fff) drop-shadow(0 1.5px 0 #fff) drop-shadow(0 -1.5px 0 #fff) drop-shadow(0 5px 6px rgba(13,24,56,0.3))}',
    '.axa-hint .avs-st{position:absolute;left:-34px;top:-30px;width:54px;height:54px;transform:rotate(-8deg)}',
    '.achievement-toast .avs-st{position:absolute;right:-14px;top:-26px;width:62px;height:62px;transform:rotate(8deg)}',
    '@media (prefers-reduced-motion:no-preference){.avs-st{animation:avsPop .45s cubic-bezier(.3,1.5,.5,1) both}@keyframes avsPop{from{opacity:0;scale:.6}to{opacity:1;scale:1}}}'
  ].join('\n');
  var injectCss = function () {
    if (document.getElementById('avs-css')) return;
    var st = document.createElement('style'); st.id = 'avs-css'; st.textContent = css; document.head.appendChild(st);
  };

  /* ---------- editör ---------- */
  var TABS = [
    { id: 'ten', label: 'Ten' }, { id: 'sac', label: 'Saç' }, { id: 'goz', label: 'Gözler' }, { id: 'kas', label: 'Kaşlar' },
    { id: 'agiz', label: 'Ağız' }, { id: 'sakal', label: 'Sakal' }, { id: 'gozluk', label: 'Gözlük' }, { id: 'kiyafet', label: 'Kıyafet' }, { id: 'arka', label: 'Arka plan' }
  ];
  var cfg = null, tab = 'sac', back = null, lastFocus = null, busy = false;

  var build = function () {
    injectCss();
    back = document.createElement('div');
    back.className = 'avs-back'; back.hidden = true;
    back.innerHTML =
      '<div class="avs" role="dialog" aria-modal="true" aria-labelledby="avs-title">' +
        '<div class="avs-head"><div><span class="avs-eyb">avatar stüdyosu</span><h2 id="avs-title">Avatarını oluştur</h2></div>' +
        '<button type="button" class="avs-x" data-avs-close aria-label="Kapat">×</button></div>' +
        '<div class="avs-body">' +
          '<div class="avs-side">' +
            '<div class="avs-prev"><img alt="Avatar önizlemesi" data-avs-prev></div>' +
            '<div class="avs-start" role="group" aria-label="Hızlı başlangıç"><button type="button" class="avs-chip" data-avs-preset="kiz">Kız ile başla</button><button type="button" class="avs-chip" data-avs-preset="erkek">Erkek ile başla</button></div>' +
            '<span class="avs-lbl">ifadelerin</span>' +
            '<div class="avs-ex" data-avs-ex aria-label="İfade seti"></div>' +
            '<button type="button" class="avs-dl" data-avs-dl>PNG indir</button>' +
          '</div>' +
          '<div class="avs-main">' +
            '<div class="avs-tabs" role="tablist" aria-label="Avatar parçaları">' + TABS.map(function (t) { return '<button type="button" class="avs-tab" role="tab" id="avs-t-' + t.id + '" aria-controls="avs-panel" data-avs-tab="' + t.id + '">' + t.label + '</button>'; }).join('') + '</div>' +
            '<div class="avs-panel" id="avs-panel" role="tabpanel" data-avs-panel></div>' +
          '</div>' +
        '</div>' +
        '<div class="avs-foot"><button type="button" class="avs-rm" data-avs-rm>Avatarı kaldır</button>' +
          '<div class="avs-acts"><button type="button" class="avs-no" data-avs-close>Vazgeç</button><button type="button" class="avs-ok" data-avs-save>Kaydet</button></div></div>' +
      '</div>';
    document.body.appendChild(back);

    back.addEventListener('click', function (e) {
      var t = e.target;
      if (t === back || t.closest('[data-avs-close]')) { close(); return; }
      var tb = t.closest('[data-avs-tab]'); if (tb) { tab = tb.getAttribute('data-avs-tab'); renderTabs(); renderPanel(); return; }
      var pr = t.closest('[data-avs-preset]'); if (pr) { cfg = clean(assign({}, cfg, PRESETS[pr.getAttribute('data-avs-preset')], { skinColor: cfg.skinColor })); refresh(); return; }
      var op = t.closest('[data-k]'); if (op) {
        var k = op.getAttribute('data-k'), v = op.getAttribute('data-v');
        cfg[k] = v; refresh(op.getAttribute('data-k') + '|' + v); return;
      }
      if (t.closest('[data-avs-dl]')) { download(); return; }
      if (t.closest('[data-avs-save]')) { save(); return; }
      if (t.closest('[data-avs-rm]')) { removeIt(); return; }
    });
    back.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === 'Tab') { /* odak pencerede kalsın */
        var f = Array.prototype.slice.call(back.querySelectorAll('button:not([disabled])')).filter(function (b) { return b.offsetParent !== null; });
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
      var tb = e.target.closest && e.target.closest('[data-avs-tab]');
      if (tb && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        var i = TABS.findIndex(function (x) { return x.id === tab; }), n = TABS.length;
        tab = TABS[(i + (e.key === 'ArrowRight' ? 1 : n - 1)) % n].id; renderTabs(); renderPanel();
        back.querySelector('[data-avs-tab="' + tab + '"]').focus();
      }
    });
  };

  var renderTabs = function () {
    Array.prototype.forEach.call(back.querySelectorAll('[data-avs-tab]'), function (b) {
      var on = b.getAttribute('data-avs-tab') === tab;
      b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1;
    });
    back.querySelector('[data-avs-panel]').setAttribute('aria-labelledby', 'avs-t-' + tab);
  };

  var optGrid = function (key, list, title) {
    return (title ? '<h3 class="avs-sub">' + esc(title) + '</h3>' : '') + '<div class="avs-grid">' + list.map(function (o) {
      var c = assign({}, cfg); c[key] = o[0];
      return '<button type="button" class="avs-opt" data-k="' + key + '" data-v="' + esc(o[0]) + '" aria-pressed="' + (cfg[key] === o[0]) + '" aria-label="' + esc(o[1]) + '">' +
        '<img alt="" loading="lazy" src="' + esc(srcOf(c)) + '"><span>' + esc(o[1]) + '</span></button>';
    }).join('') + '</div>';
  };
  var swatches = function (key, list, title) {
    return '<h3 class="avs-sub">' + esc(title) + '</h3><div class="avs-sw">' + list.map(function (o) {
      var t = o[0] === 'transparent';
      return '<button type="button" class="avs-swb' + (t ? ' t' : '') + '" data-k="' + key + '" data-v="' + o[0] + '" aria-pressed="' + (cfg[key] === o[0]) + '" aria-label="' + esc(o[1]) + '" title="' + esc(o[1]) + '"' + (t ? '' : ' style="background:#' + o[0] + '"') + '></button>';
    }).join('') + '</div>';
  };
  var renderPanel = function () {
    var p = back.querySelector('[data-avs-panel]'), h = '';
    if (tab === 'ten') h = swatches('skinColor', SKIN, 'ten rengi');
    else if (tab === 'sac') {
      h = TOPS.map(function (gr) { return optGrid('top', gr[1], gr[0].toLocaleLowerCase('tr')); }).join('');
      h = (COVERS[cfg.top] ? swatches('hatColor', HAT_C, 'örtü / şapka rengi') : swatches('hairColor', HAIR_C, 'saç rengi')) + h;
    }
    else if (tab === 'goz') h = optGrid('eyes', EYES, '');
    else if (tab === 'kas') h = optGrid('eyebrows', BROWS, '');
    else if (tab === 'agiz') h = optGrid('mouth', MOUTH, '');
    else if (tab === 'sakal') h = optGrid('facialHair', BEARD, '') + (cfg.facialHair ? swatches('facialHairColor', HAIR_C, 'sakal rengi') : '');
    else if (tab === 'gozluk') h = optGrid('accessories', GLASS, '') + (cfg.accessories ? swatches('accessoriesColor', HAT_C, 'çerçeve rengi') : '');
    else if (tab === 'kiyafet') h = optGrid('clothing', CLOTH, '') + swatches('clothesColor', CLOTH_C, 'kıyafet rengi');
    else if (tab === 'arka') h = swatches('bg', BG, 'arka plan');
    p.innerHTML = h;
  };
  var renderSide = function () {
    back.querySelector('[data-avs-prev]').src = srcOf(cfg);
    back.querySelector('[data-avs-ex]').innerHTML = EXPR.map(function (ex) {
      return '<figure><img alt="' + esc(ex.label) + ' ifadesi" src="' + esc(srcOf(assign(withExpr(cfg, ex), { bg: 'transparent' }))) + '"><figcaption>' + esc(ex.label) + '</figcaption></figure>';
    }).join('');
  };
  var refresh = function (focusKey) {
    renderSide(); renderPanel();
    if (focusKey) {
      var parts = focusKey.split('|'), el = back.querySelector('[data-k="' + parts[0] + '"][data-v="' + (window.CSS && CSS.escape ? CSS.escape(parts[1]) : parts[1]) + '"]');
      if (el) el.focus();
    }
  };

  var open = function () {
    if (!back) build();
    lastFocus = document.activeElement;
    var p = profile();
    cfg = clean(cfgFromUrl(p && p.avatar_url) || lsGet() || DEF);
    tab = 'sac';
    back.hidden = false; document.documentElement.style.overflow = 'hidden';
    renderTabs(); refresh();
    back.querySelector('[data-avs-tab="sac"]').focus();
    loadLib().then(function (ok) { if (ok && !back.hidden) refresh(); });
  };
  var close = function () {
    if (!back || back.hidden) return;
    back.hidden = true; document.documentElement.style.overflow = '';
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* yok */ } }
  };

  var download = function () {
    loadLib().then(function () { return pngOf(cfg, 512); }).then(function (blob) {
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'acadex-avatar.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    }).catch(function (e) { console.error('avatar png', e); alertMsg('error', 'PNG hazırlanamadı. Biraz sonra tekrar dener misin?'); });
  };

  var save = function () {
    if (busy) return;
    var sb = g('supabaseClient'), user = g('currentUser'), p = profile();
    if (!sb || !user || !user.id) { alertMsg('error', 'Oturum bulunamadı, sayfayı yenileyip tekrar dener misin?'); return; }
    busy = true;
    var okBtn = back.querySelector('[data-avs-save]'); okBtn.disabled = true; okBtn.textContent = 'Kaydediliyor…';
    var tag = encodeCfg(cfg), saved = assign({}, cfg);
    var finish = function (url, note) {
      return sb.from('profiles').update({ avatar_url: url }).eq('id', user.id).then(function (r) {
        if (r && r.error) throw r.error;
        if (p) p.avatar_url = url;
        lsSet(saved);
        var up = window.updateAllAvatarDisplays || g('updateAllAvatarDisplays'); if (typeof up === 'function') up();
        alertMsg('success', note || 'Avatarın kaydedildi.');
        close();
      });
    };
    loadLib().then(function () { return pngOf(cfg, 512); }).then(function (blob) {
      var path = user.id + '/' + FILE;
      return sb.storage.from('avatars').upload(path, blob, { upsert: true, cacheControl: '3600', contentType: 'image/png' }).then(function (r) {
        if (r && r.error) throw r.error;
        var pub = sb.storage.from('avatars').getPublicUrl(path);
        var base = pub && pub.data && pub.data.publicUrl;
        if (!base) throw new Error('public url');
        return finish(base + '?v=' + Date.now() + '&acx=' + tag);
      });
    }).catch(function (err) {
      /* depoya yüklenemezse: DiceBear adresiyle kaydet ki avatar yine de görünsün */
      console.warn('Avatar depoya yüklenemedi, DiceBear adresiyle kaydediliyor.', err);
      return finish(apiUrl(cfg) + '&acx=' + tag, 'Avatarın kaydedildi (sunucuya yüklenemediği için geçici bağlantıyla).');
    }).catch(function (err) {
      console.error('Avatar kaydedilemedi', err);
      alertMsg('error', 'Avatar kaydedilemedi: ' + ((err && err.message) || 'bilinmeyen hata'));
    }).then(function () { busy = false; okBtn.disabled = false; okBtn.textContent = 'Kaydet'; });
  };

  var removeIt = function () {
    var f = g('removeAvatar');
    if (typeof f === 'function') { f(); close(); }
  };

  /* ---------- sticker'lar: Acadia önerisi + başarı bildirimi ---------- */
  var stickerSrc = function (key) {
    var p = profile(), c = cfgFromUrl(p && p.avatar_url);
    if (!c) return null; /* fotoğraf ya da eski avatar: sticker yok */
    var ex = EXPR.filter(function (x) { return x.k === key; })[0] || EXPR[0];
    return srcOf(assign(withExpr(c, ex), { bg: 'transparent' }));
  };
  var addSticker = function (host, key) {
    if (!host || host.querySelector(':scope > .avs-st')) return;
    var src = stickerSrc(key); if (!src) return;
    injectCss();
    var im = document.createElement('img'); im.className = 'avs-st'; im.alt = ''; im.setAttribute('aria-hidden', 'true'); im.src = src;
    im.onerror = function () { im.remove(); };
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.insertBefore(im, host.firstChild);
  };
  var watchHint = function (el) {
    if (!el || el.__avs) return; el.__avs = true;
    var put = function () { if (!el.hidden) addSticker(el, 'dusunceli'); };
    new MutationObserver(put).observe(el, { childList: true, attributes: true, attributeFilter: ['hidden'] });
    put();
  };
  var watchToasts = function (box) {
    if (!box || box.__avs) return; box.__avs = true;
    new MutationObserver(function (ms) {
      ms.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1 && n.classList.contains('achievement-toast')) addSticker(n, 'heyecanli'); }); });
    }).observe(box, { childList: true });
  };
  var hookStickers = function () {
    var tries = 0;
    var look = function () {
      watchHint(document.querySelector('.axa-hint'));
      watchToasts(document.getElementById('achievement-toast-container'));
      if (!document.querySelector('.axa-hint') && ++tries < 30) setTimeout(look, 1000);
    };
    look();
    /* bildirim kutusu ilk başarıda oluşturulur: gövdeye eklenen doğrudan çocukları izle */
    new MutationObserver(function (ms) {
      ms.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1) { if (n.id === 'achievement-toast-container') watchToasts(n); if (n.classList && n.classList.contains('axa-hint')) watchHint(n); } }); });
    }).observe(document.body, { childList: true });
    /* sticker gerekecekse kütüphaneyi önceden hazırla */
    var p = profile(); if (cfgFromUrl(p && p.avatar_url)) loadLib();
  };

  /* ---------- dışarıya açılan ---------- */
  window.openAvatarBuilder = open;
  window.closeAvatarBuilder = close;
  window.AcxAvatar = { open: open, close: close, sticker: stickerSrc, expressions: EXPR.map(function (x) { return x.k; }) };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hookStickers);
  else hookStickers();
})();
