/* ==========================================================================
   ACADEX KIDS · konuşan kelimeler ve mini hikâyeler (kids/assets/kids-konusan.js), 13.11.2026
   Her kelime kendini tanıtır: köpek "Woof, woof! I'm a dog!", çilek "Hi! I'm a strawberry!".
   İzle durağında Acadia ile küçük bir diyalog kurulur:
     Acadia: "Who are you?"  →  kelime: "Woof, woof! I'm a dog!"  →  Acadia: "Hello, dog!"
     → mini hikâye: sahneye bir eşya gelir (top, sepet, tabak, yol…), kelime onunla oynar,
       Acadia hikâye cümlesini söyler ("The dog plays with a ball!").
   replik(konu, oge) → {soru, ben, selam, hikaye, sahne}; boş alanlar atlanır.
   Bütün cümleler ses kataloğuna (kids/ses/katalog.js) eklenir.
   26.11.2026: hayvanlar dışındaki 15 konuda da her kelimenin kendi cümlesi, eşyası ve hareketi var
   (kids-hikaye.js; yoksa aşağıdaki konu kalıbı yedek). replik → {…, grup, fx}.
   ========================================================================== */
(function (W) {
  'use strict';
  var COGUL = ' eyes ears hands feet arms legs fingers toes teeth shoulders knees cheeks eyebrows lips nails blocks bubbles marbles shoes socks gloves trousers boots shorts pyjamas sunglasses sandals jeans slippers stairs curtains crayons scissors paints grapes cherries blueberries chips sweets parents grandparents twins children people ';
  var THE = ' sun moon night sky weekend ';
  var SAYILAMAZ = ' rain snow wind lightning ice thunder hail glue chalk paper tape ';
  var BUYUK = { mum: 'Mum', dad: 'Dad', grandma: 'Grandma', grandpa: 'Grandpa' };
  var SIFAT = ' sunny rainy cloudy windy snowy hot cold stormy foggy warm wet ';
  var GUN = ' monday tuesday wednesday thursday friday saturday sunday ';
  var MEVSIM = ' spring summer autumn winter ';

  function cogulMu(r) { return COGUL.indexOf(' ' + r.en + ' ') >= 0; }
  function sayilamaz(r) { return (r.bir && r.bir === r.en && !cogulMu(r)) || SAYILAMAZ.indexOf(' ' + r.en + ' ') >= 0; }
  /* "a dog", "an owl", "grapes", "bread", "the sun" */
  function adli(r) {
    if (cogulMu(r) || sayilamaz(r)) return r.en;
    if (THE.indexOf(' ' + r.en + ' ') >= 0 || r.en === 'night sky') return 'the ' + r.en;
    if (r.bir === 'a' || r.bir === 'an') return r.bir + ' ' + r.en;
    if (r.bir) return r.bir;
    return (/^[aeiou]/i.test(r.en) ? 'an ' : 'a ') + r.en;
  }
  function an(s) { return (/^[aeiou]/i.test(s) ? 'an ' : 'a ') + s; }
  function sesTekrar(s) { return s.indexOf(',') >= 0 || s.indexOf(' ') >= 0 ? s : s + ', ' + s.toLowerCase(); }
  function benim(r) { return cogulMu(r) ? 'We are ' + adli(r) + '!' : 'I\'m ' + adli(r) + '!'; }
  function bas(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function the(r) { return cogulMu(r) || sayilamaz(r) ? bas(r.en) : 'The ' + r.en; }

  /* konu → mini hikâye eşyası ve cümlesi */
  var HIKAYE = {
    /* 22.11.2026: her hayvan kendi işini yapar (tavşan havuç yer, köpek kemik getirir…); listede yoksa topla oynar */
    animals: { sahne: function (r) { return (HAYVAN_IS[r.id] || HAYVAN_IS._)[0]; }, c: function (r) { var x = HAYVAN_IS[r.id]; return x ? x[1] : 'The ' + r.en + ' plays with a ball!'; } },
    sea: { sahne: 'kabarcik', c: function (r) { return 'Look! ' + bas(adli(r)) + ' under the sea!'; } },
    family: { sahne: 'kalp', c: function (r) { return r.id === 'me' ? null : /^(boy|girl|man|woman|people)$/.test(r.id) ? 'Hello, friend!' : 'I love my ' + r.en + '!'; } },
    body: { sahne: 'el', c: function (r) { return 'Touch your ' + r.en + '!'; } },
    food: { sahne: 'tabak', c: function (r) { return 'Mmm! I like ' + (r.cok || r.en) + '!'; } },
    fruits: { sahne: 'sepet', c: function (r) { return the(r) + (cogulMu(r) ? ' jump' : ' jumps') + ' into the basket!'; } },
    toys: { sahne: 'kutu', c: function (r) { return 'Let\'s play with the ' + r.en + '!'; } },
    transport: { sahne: 'yol', c: function (r) { return 'Off we go! Bye-bye, ' + r.en + '!'; } },
    shapes: { sahne: 'buyutec', c: function (r) { return 'Can you find ' + adli(r) + '?'; } },
    jobs: { sahne: 'kalp', c: function (r) { return 'Thank you, ' + r.en + '!'; } },
    colours: { sahne: 'boya', c: function (r) { return 'Splash! Everything is ' + r.en + '!'; } },
    feelings: { sahne: 'ayna', c: function (r) { return 'Let\'s make ' + an(r.en) + ' face!'; } },
    actions: { sahne: 'pirilti', c: function (r) { return r.id === 'cry' ? 'Oh no! Don\'t cry!' : r.id === 'sleep' ? 'Shh! Let\'s sleep!' : 'Let\'s ' + r.en + ' together!'; } },
    seasons: { sahne: 'pirilti', c: function (r) { return MEVSIM.indexOf(' ' + r.id + ' ') >= 0 ? 'I love ' + r.en + '!' : null; } }
  };
  /* hayvan → [eşya, cümle]. Eşyanın davranış grubu ESYA_GRUP'ta (kids-canli.css: .kn-hg-…) */
  var HAYVAN_IS = {
    _: ['top'], cat: ['yumak', 'The cat plays with yarn!'], dog: ['kemik', 'The dog gets a bone!'], fish: ['kabarcik', 'The fish blows bubbles!'],
    bird: ['nota', 'The bird sings a song!'], rabbit: ['havuc', 'The rabbit eats a carrot!'], frog: ['sinek', 'The frog catches a fly!'],
    cow: ['ot', 'The cow eats grass!'], chick: ['tohum', 'The chick eats seeds!'], lion: ['kukre', 'The lion says roar!'], bear: ['bal', 'The bear eats honey!'],
    horse: ['elma', 'The horse eats an apple!'], pig: ['camur', 'The pig plays in the mud!'], sheep: ['ot', 'The sheep eats grass!'],
    duck: ['su', 'The duck swims in the pond!'], monkey: ['muz', 'The monkey eats a banana!'], elephant: ['damla', 'The elephant sprays water!'],
    giraffe: ['yaprak', 'The giraffe eats leaves!'], tiger: ['top', 'The tiger plays with a ball!'], mouse: ['peynir', 'The mouse eats cheese!'],
    snake: ['sss', 'The snake says hiss!'], penguin: ['buz', 'The penguin slides on the ice!'], owl: ['nota', 'The owl says hoo-hoo!'],
    bee: ['cicek', 'The bee loves flowers!'], butterfly: ['cicek', 'The butterfly flies to a flower!'], zebra: ['ot', 'The zebra eats grass!'],
    panda: ['bambu', 'The panda eats bamboo!'], fox: ['top', 'The fox plays with a ball!'], goat: ['ot', 'The goat eats grass!'], hen: ['tohum', 'The hen eats seeds!'],
    crocodile: ['su', 'The crocodile swims!'], hippo: ['su', 'The hippo swims in the water!'], squirrel: ['findik', 'The squirrel eats a nut!']
  };
  var ESYA_GRUP = { havuc: 'yem', kemik: 'yem', muz: 'yem', bal: 'yem', ot: 'yem', peynir: 'yem', yaprak: 'yem', findik: 'yem', elma: 'yem', bambu: 'yem',
    tohum: 'gagala', top: 'oyun', yumak: 'oyun', nota: 'ses', kukre: 'ses', sss: 'ses', su: 'su', damla: 'puskur', sinek: 'sinek', cicek: 'cicek', camur: 'camur', buz: 'buz' };
  /* uçuşan küçük kopyalar (kn-ucus) çıkan eşyalar */
  var UCAN = { kalp: 1, kabarcik: 1, pirilti: 1, nota: 1, kukre: 1, sss: 1, damla: 1 };
  function grup(ad) { return ESYA_GRUP[ad] || ''; }
  /* gr: kelimeye özel davranış (kids-hikaye); buhar, uyku, köpük, kalp, dalış, damla… kopyalar uçar/yağar */
  function ucar(ad, gr) { var HK = W.KIDS_HIKAYE; return !!UCAN[ad] || !!(gr && HK && HK.UCAN_GRUP[gr]); }

  /* konu → Acadia'nın sorusu */
  var SORU = {
    colours: 'What colour are you?', numbers: 'What number are you?', alphabet: 'What letter are you?', feelings: 'How do you feel?',
    actions: 'What can you do?', jobs: 'What\'s your job?'
  };
  var SELAMSIZ = { feelings: 1, actions: 1, jobs: 1, numbers: 1, weather: 1, days: 1 };

  /* kreşin kelime setinde (kid 'set-…') her kelime kendi konusunun cümlesiyle konuşur */
  function asil(kid, r, P) { if (!/^set-/.test(kid || '') || !W.KIDS_VERI) return [kid, P]; var k = W.KIDS_VERI.ogeKonu(r.id); return k ? [k, W.KIDS_KONU.al(k)] : [kid, P]; }
  function ben(kid, r, P) {
    var a0 = asil(kid, r, P); kid = a0[0]; P = a0[1];
    var c = P && P.izleCumle ? P.izleCumle(r) : '';
    switch (kid) {
      /* hayvanlar: "Meow" artık öğretmen sesiyle söylenmez; önce çizgi film efekti çalar (kids-ses hayvan), sonra tanıtım */
      case 'animals': case 'sea': return 'Hi! ' + benim(r);
      case 'transport': return r.ses ? sesTekrar(r.ses) + '! I\'m ' + adli(r) + '!' : 'Hi! ' + benim(r);
      case 'colours': return 'Hi! I\'m ' + r.en + '!';
      case 'numbers': return 'Hi! I\'m number ' + r.en + '!';
      case 'alphabet': return 'Hi! I\'m the letter ' + r.en + '!';
      case 'family': return r.id === 'me' ? 'Hi! It\'s me!' : r.id === 'family' ? 'Hi! We are a family!' : BUYUK[r.id] ? 'Hi! I\'m ' + BUYUK[r.id] + '!' : 'Hi! ' + benim(r);
      case 'body': return 'Hi! ' + (cogulMu(r) ? 'We are your ' : 'I\'m your ') + r.en + '!';
      case 'feelings': return 'I feel ' + r.en + '!';
      case 'actions': return 'I can ' + r.en + '!';
      case 'jobs': return 'I\'m ' + an(r.en) + '!';
      case 'weather': return SIFAT.indexOf(' ' + r.en + ' ') >= 0 ? c : 'Hi! ' + benim(r);
      case 'days': return GUN.indexOf(' ' + r.id.toLowerCase() + ' ') >= 0 ? c : 'Hi! I\'m ' + (r.id === 'weekend' ? 'the weekend' : r.id === 'week' ? 'a week' : r.en) + '!';
      case 'seasons': return MEVSIM.indexOf(' ' + r.id + ' ') >= 0 ? 'Hi! I\'m ' + r.en + '!' : 'Hi! ' + benim(r);
      case 'places': return null;
      default: return 'Hi! ' + benim(r);
    }
  }
  function replik(kid, r, P) {
    var a0 = asil(kid, r, P); kid = a0[0]; P = a0[1];
    var b = ben(kid, r, P); if (!b) return null;
    var soru = SORU[kid] || 'Who are you?';
    if (kid === 'weather' && SIFAT.indexOf(' ' + r.en + ' ') >= 0) soru = 'What\'s the weather like?';
    if (kid === 'days' && GUN.indexOf(' ' + r.id.toLowerCase() + ' ') >= 0) soru = 'What day is it?';
    var selam = SELAMSIZ[kid] ? null : 'Hello, ' + (BUYUK[r.id] || r.en) + '!';
    /* kelimeye özel hikâye (kids-hikaye.js) */
    var oz = W.KIDS_HIKAYE && W.KIDS_HIKAYE.al(kid, r.id);
    if (oz) return { soru: soru, ben: b, selam: selam, hikaye: oz.c, sahne: oz.e, grup: oz.g, fx: oz.fx };
    var H = HIKAYE[kid], hk = H ? H.c(r) : null, eski = P && P.izleCumle ? P.izleCumle(r) : null;
    if (!hk && eski && eski !== b) hk = eski;
    var sh = H && hk && hk !== eski ? (typeof H.sahne === 'function' ? H.sahne(r) : H.sahne) : (hk ? 'pirilti' : null);
    return { soru: soru, ben: b, selam: selam, hikaye: hk, sahne: sh, grup: sh ? grup(sh) : '', fx: null };
  }

  /* hikâye eşyaları (küçük satır içi çizimler) */
  var M = '#23304D';
  function svg(ic, ek) { return '<svg viewBox="0 0 100 100"' + (ek || '') + ' class="kc" aria-hidden="true">' + ic + '</svg>'; }
  var ESYA = {
    top: svg('<circle cx="50" cy="50" r="30" fill="#E5484D" stroke="' + M + '" stroke-width="4"/><path d="M22 44 q28 14 56 0" fill="none" stroke="#fff" stroke-width="7"/><path d="M50 20 q-12 30 0 60" fill="none" stroke="#FFD23F" stroke-width="6"/>'),
    sepet: svg('<path d="M14 46 h72 l-9 38 h-54 z" fill="#D9A35E" stroke="' + M + '" stroke-width="4" stroke-linejoin="round"/><path d="M24 46 q26 -40 52 0" fill="none" stroke="' + M + '" stroke-width="5"/><path d="M20 60 h60 M23 72 h54" stroke="#B07A40" stroke-width="4"/>'),
    tabak: svg('<ellipse cx="50" cy="64" rx="42" ry="14" fill="#fff" stroke="' + M + '" stroke-width="4"/><ellipse cx="50" cy="62" rx="28" ry="8" fill="#EAF2FF"/>'),
    kalp: svg('<path d="M50 82 C14 58 18 26 38 26 c7 0 10 4 12 8 c2 -4 5 -8 12 -8 c20 0 24 32 -12 56z" fill="#FF6B8A" stroke="' + M + '" stroke-width="4" stroke-linejoin="round"/>'),
    kabarcik: svg('<circle cx="35" cy="60" r="14" fill="#BFE6FF" stroke="' + M + '" stroke-width="3"/><circle cx="62" cy="38" r="10" fill="#BFE6FF" stroke="' + M + '" stroke-width="3"/><circle cx="70" cy="70" r="7" fill="#BFE6FF" stroke="' + M + '" stroke-width="3"/><circle cx="31" cy="55" r="4" fill="#fff"/>'),
    el: svg('<path d="M30 86 v-36 q0 -6 6 -6 q6 0 6 6 v-20 q0 -6 6 -6 q6 0 6 6 v16 q0 -5 6 -5 q6 0 6 6 v8 q0 -5 6 -5 q6 0 6 6 v16 q0 14 -16 14 z" fill="#FFD9B8" stroke="' + M + '" stroke-width="4" stroke-linejoin="round"/>'),
    kutu: svg('<path d="M12 44 h76 v40 h-76 z" fill="#4AA8FF" stroke="' + M + '" stroke-width="4" stroke-linejoin="round"/><path d="M8 34 h84 v12 h-84 z" fill="#2E7DD8" stroke="' + M + '" stroke-width="4" stroke-linejoin="round"/><circle cx="50" cy="64" r="8" fill="#FFD23F" stroke="' + M + '" stroke-width="3"/>'),
    yol: svg('<rect x="0" y="62" width="100" height="22" fill="#5B6478"/><path d="M6 73 h14 M34 73 h14 M62 73 h14 M90 73 h10" stroke="#FFD23F" stroke-width="4"/>', ' preserveAspectRatio="none"'),
    buyutec: svg('<circle cx="42" cy="42" r="24" fill="#DFF3FF" stroke="' + M + '" stroke-width="6"/><path d="M60 60 l24 24" stroke="' + M + '" stroke-width="10" stroke-linecap="round"/>'),
    boya: svg('<g fill="var(--r,#E5484D)"><circle cx="50" cy="50" r="30"/><circle cx="18" cy="30" r="9"/><circle cx="84" cy="24" r="7"/><circle cx="86" cy="70" r="10"/><circle cx="20" cy="78" r="7"/><circle cx="50" cy="10" r="5"/><circle cx="52" cy="92" r="6"/><path d="M50 50 L14 40 L22 52z M50 50 L88 46 L80 58z M50 50 L40 88 L54 84z M50 50 L60 14 L46 18z"/></g>'),
    ayna: svg('<ellipse cx="50" cy="44" rx="28" ry="34" fill="#DFF3FF" stroke="' + M + '" stroke-width="6"/><path d="M50 78 v14 M36 92 h28" stroke="' + M + '" stroke-width="6" stroke-linecap="round"/><path d="M36 30 l10 -10" stroke="#fff" stroke-width="5" stroke-linecap="round"/>'),
    pirilti: svg('<path d="M50 8 l8 30 l30 8 l-30 8 l-8 30 l-8 -30 l-30 -8 l30 -8 z" fill="#FFD23F" stroke="' + M + '" stroke-width="4" stroke-linejoin="round"/>'),
    /* 22.11.2026: hayvanların kendi eşyaları */
    havuc: svg('<path d="M30 30 L78 84 Q84 90 78 92 L20 40 Q24 30 30 30z" fill="#FF8A3D" stroke="' + M + '" stroke-width="4" stroke-linejoin="round"/><path d="M40 52 l8 -4 M52 64 l7 -4 M62 76 l6 -3" stroke="#D96520" stroke-width="3.5" stroke-linecap="round"/><path d="M26 34 q-10 -18 -4 -26 q8 6 8 20 q4 -16 14 -18 q2 12 -8 22 q14 -6 20 0 q-8 8 -22 6" fill="#4CC36B" stroke="' + M + '" stroke-width="3.5" stroke-linejoin="round"/>'),
    kemik: svg('<path d="M30 40 L70 60" stroke="' + M + '" stroke-width="20" stroke-linecap="round"/><path d="M30 40 L70 60" stroke="#FFF8E7" stroke-width="12" stroke-linecap="round"/><g fill="#FFF8E7" stroke="' + M + '" stroke-width="4"><circle cx="22" cy="32" r="10"/><circle cx="18" cy="48" r="10"/><circle cx="82" cy="52" r="10"/><circle cx="78" cy="68" r="10"/></g><path d="M28 40 L72 60" stroke="#FFF8E7" stroke-width="10" stroke-linecap="round"/>'),
    yumak: svg('<circle cx="50" cy="54" r="30" fill="#FF6B8A" stroke="' + M + '" stroke-width="4"/><path d="M26 44 q24 -14 48 4 M24 60 q26 -16 52 4 M34 80 q14 -30 40 -46 M30 32 q14 34 4 52" fill="none" stroke="#C8426A" stroke-width="3.5"/><path d="M78 66 q14 6 12 20 q-2 10 8 12" fill="none" stroke="#FF6B8A" stroke-width="4" stroke-linecap="round"/>'),
    muz: svg('<path d="M22 30 Q20 76 66 80 Q86 80 88 70 Q60 72 46 54 Q34 40 34 26 Z" fill="#FFD84A" stroke="' + M + '" stroke-width="4" stroke-linejoin="round"/><path d="M30 34 Q32 62 64 74" fill="none" stroke="#E0B22A" stroke-width="3.5"/><path d="M22 30 l4 -10 l8 2 l0 6" fill="#8A6A2A" stroke="' + M + '" stroke-width="3.5" stroke-linejoin="round"/>'),
    bal: svg('<path d="M24 40 q-6 44 26 46 q32 -2 26 -46z" fill="#E8A93A" stroke="' + M + '" stroke-width="4" stroke-linejoin="round"/><rect x="20" y="30" width="60" height="12" rx="5" fill="#C78420" stroke="' + M + '" stroke-width="4"/><path d="M30 42 q0 12 6 14 q6 -2 4 -14 M58 42 q0 18 6 18 q5 -2 3 -18" fill="#FFC94A" stroke="' + M + '" stroke-width="3"/><text x="50" y="74" text-anchor="middle" font-family="Baloo 2,sans-serif" font-weight="800" font-size="16" fill="' + M + '">HONEY</text>'),
    ot: svg('<g fill="#4CC36B" stroke="' + M + '" stroke-width="3.5" stroke-linejoin="round"><path d="M20 88 q-4 -30 6 -50 q4 26 4 50z"/><path d="M34 88 q0 -40 14 -62 q0 34 -4 62z"/><path d="M52 88 q4 -36 22 -54 q-6 30 -10 54z"/><path d="M68 88 q8 -24 20 -34 q-4 20 -8 34z"/></g><path d="M12 88 h80" stroke="' + M + '" stroke-width="4" stroke-linecap="round"/>'),
    peynir: svg('<path d="M14 70 L80 30 L90 70 Z" fill="#FFD23F" stroke="' + M + '" stroke-width="4" stroke-linejoin="round"/><path d="M14 70 h76 v10 h-76z" fill="#F2B300" stroke="' + M + '" stroke-width="4" stroke-linejoin="round"/><g fill="#F2B300"><circle cx="56" cy="56" r="6"/><circle cx="74" cy="46" r="4"/><circle cx="38" cy="62" r="4"/></g>'),
    yaprak: svg('<path d="M10 80 Q46 60 90 20" fill="none" stroke="#8A5A2A" stroke-width="6" stroke-linecap="round"/><g fill="#5CCB72" stroke="' + M + '" stroke-width="3.5" stroke-linejoin="round"><path d="M34 66 q-14 -24 6 -36 q10 20 -6 36z"/><path d="M56 50 q2 -28 24 -30 q0 24 -24 30z"/><path d="M48 60 q20 4 26 22 q-22 0 -26 -22z"/></g>'),
    findik: svg('<path d="M24 46 q-2 40 26 42 q28 -2 26 -42z" fill="#C98A4A" stroke="' + M + '" stroke-width="4" stroke-linejoin="round"/><path d="M18 46 q32 -30 64 0 z" fill="#8A5A2A" stroke="' + M + '" stroke-width="4" stroke-linejoin="round"/><path d="M50 22 v-10" stroke="' + M + '" stroke-width="5" stroke-linecap="round"/><path d="M36 58 q4 14 14 18" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".5"/>'),
    elma: svg('<path d="M50 32 c-30 -14 -46 12 -36 34 c8 18 24 24 36 18 c12 6 28 0 36 -18 c10 -22 -6 -48 -36 -34z" fill="#E5484D" stroke="' + M + '" stroke-width="4" stroke-linejoin="round"/><path d="M50 32 q2 -14 10 -20" fill="none" stroke="' + M + '" stroke-width="4" stroke-linecap="round"/><path d="M54 22 q14 -12 24 -2 q-12 8 -24 2z" fill="#4CC36B" stroke="' + M + '" stroke-width="3"/><path d="M28 48 q-2 10 4 18" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".55"/>'),
    bambu: svg('<g stroke="' + M + '" stroke-width="4" stroke-linejoin="round"><rect x="40" y="8" width="16" height="86" rx="6" fill="#7BD389"/><path d="M40 34 h16 M40 62 h16" /><path d="M56 30 q20 -12 30 -4 q-14 10 -30 4z" fill="#5CCB72"/><path d="M40 58 q-20 -10 -28 0 q14 8 28 0z" fill="#5CCB72"/></g>'),
    tohum: svg('<g fill="#E8B04A" stroke="' + M + '" stroke-width="2.6"><ellipse cx="22" cy="80" rx="7" ry="4.5" transform="rotate(-20 22 80)"/><ellipse cx="40" cy="86" rx="7" ry="4.5" transform="rotate(15 40 86)"/><ellipse cx="58" cy="78" rx="7" ry="4.5" transform="rotate(-8 58 78)"/><ellipse cx="74" cy="86" rx="7" ry="4.5" transform="rotate(25 74 86)"/><ellipse cx="50" cy="70" rx="6" ry="4" transform="rotate(10 50 70)"/></g>'),
    nota: svg('<path d="M38 74 V22 l40 -10 v50" fill="none" stroke="' + M + '" stroke-width="6" stroke-linejoin="round"/><ellipse cx="30" cy="76" rx="11" ry="8" fill="#8E5CF6" stroke="' + M + '" stroke-width="4"/><ellipse cx="70" cy="64" rx="11" ry="8" fill="#4AA8FF" stroke="' + M + '" stroke-width="4"/>'),
    kukre: svg('<path d="M20 30 q-14 20 0 40 M34 22 q-20 28 0 56 M48 14 q-26 36 0 72" fill="none" stroke="#FF8A3D" stroke-width="7" stroke-linecap="round"/><text x="72" y="60" text-anchor="middle" font-family="Baloo 2,sans-serif" font-weight="800" font-size="22" fill="#FF6B5B" stroke="' + M + '" stroke-width="1.5">R!</text>'),
    sss: svg('<text x="50" y="66" text-anchor="middle" font-family="Baloo 2,sans-serif" font-weight="800" font-size="46" fill="#4CC36B" stroke="' + M + '" stroke-width="2.5">sss</text>'),
    damla: svg('<path d="M50 10 C34 38 24 52 24 66 a26 26 0 0 0 52 0 C76 52 66 38 50 10z" fill="#7FC4FF" stroke="' + M + '" stroke-width="4" stroke-linejoin="round"/><path d="M38 64 q0 12 10 16" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/>'),
    sinek: svg('<ellipse cx="38" cy="34" rx="16" ry="11" fill="#DDF1FF" stroke="' + M + '" stroke-width="3.5" opacity=".95" transform="rotate(-25 38 34)"/><ellipse cx="62" cy="34" rx="16" ry="11" fill="#DDF1FF" stroke="' + M + '" stroke-width="3.5" opacity=".95" transform="rotate(25 62 34)"/><ellipse cx="50" cy="56" rx="14" ry="18" fill="#3A4466" stroke="' + M + '" stroke-width="3.5"/><circle cx="44" cy="44" r="4" fill="#E5484D"/><circle cx="56" cy="44" r="4" fill="#E5484D"/>'),
    cicek: svg('<path d="M50 92 V50" stroke="#3FB86A" stroke-width="6" stroke-linecap="round"/><path d="M50 74 q-18 -4 -20 -16 q14 0 20 16z" fill="#4CC36B" stroke="' + M + '" stroke-width="3"/><g fill="#FF8FB1" stroke="' + M + '" stroke-width="3.5"><circle cx="50" cy="20" r="12"/><circle cx="70" cy="34" r="12"/><circle cx="62" cy="56" r="12"/><circle cx="38" cy="56" r="12"/><circle cx="30" cy="34" r="12"/></g><circle cx="50" cy="40" r="11" fill="#FFD23F" stroke="' + M + '" stroke-width="3.5"/>'),
    camur: svg('<path d="M6 70 q10 -16 40 -14 q30 -6 46 8 q10 12 -6 18 q-30 10 -62 4 q-24 -4 -18 -16z" fill="#8A5A3A" stroke="' + M + '" stroke-width="4" stroke-linejoin="round"/><ellipse cx="34" cy="66" rx="10" ry="3.5" fill="#A87450"/><ellipse cx="66" cy="72" rx="8" ry="3" fill="#A87450"/>', ' preserveAspectRatio="none"'),
    su: svg('<ellipse cx="50" cy="66" rx="48" ry="20" fill="#7FC4FF" stroke="' + M + '" stroke-width="4"/><path d="M20 64 q8 -5 16 0 q8 5 16 0 M52 72 q8 -5 16 0 q8 5 16 0" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>', ' preserveAspectRatio="none"'),
    buz: svg('<path d="M2 64 L98 64 L92 84 L8 84 Z" fill="#CFEFFF" stroke="' + M + '" stroke-width="4" stroke-linejoin="round"/><path d="M14 70 l18 0 M58 74 l22 0" stroke="#fff" stroke-width="4" stroke-linecap="round"/>', ' preserveAspectRatio="none"')
  };
  /* eşya: 'r:<id>' kelime resmi (KIDS_RESIM), 's:<ad>' arayüz simgesi (KIDS_CIZ), düz ad çizim */
  function esya(ad) {
    ad = String(ad || '');
    if (ad.indexOf('r:') === 0) return W.KIDS_RESIM && W.KIDS_RESIM.var(ad.slice(2)) ? W.KIDS_RESIM.ciz(ad.slice(2)) : ESYA.pirilti;
    if (ad.indexOf('s:') === 0) return W.KIDS_CIZ ? W.KIDS_CIZ.simge(ad.slice(2)) : ESYA.pirilti;
    return ESYA[ad] || (W.KIDS_HIKAYE && W.KIDS_HIKAYE.ESYA[ad]) || '';
  }

  /* hangi hayvan sesi çalınır (kids-ses.js FX.hayvan) */
  var HAYVAN = { cat: 1, dog: 1, bird: 1, frog: 1, cow: 1, chick: 1, lion: 1, horse: 1, pig: 1, sheep: 1, duck: 1, monkey: 1, elephant: 1, mouse: 1, snake: 1, owl: 1, bee: 1, goat: 1, hen: 1, crocodile: 1, whale: 1, dolphin: 1, seal: 1, walrus: 1, tiger: 1, bear: 1, rabbit: 1,
    /* 26.11.2026 deniz: her canlının kendi sesi (kids/ses/efektler.js, yedeği kids-ses.js) */
    octopus: 1, crab: 1, turtle: 1, starfish: 1, shark: 1, jellyfish: 1, seahorse: 1, shell: 1, squid: 1, lobster: 1, coral: 1, seaweed: 1, stingray: 1, swordfish: 1, clownfish: 1, pufferfish: 1, eel: 1, anchor: 1 };
  function hayvanSesi(r) { return r && HAYVAN[r.id] ? r.id : null; }

  W.KIDS_KONUSAN = { replik: replik, ben: ben, esya: esya, grup: grup, ucar: ucar, hayvanSesi: hayvanSesi, ESYA: ESYA, HAYVAN_IS: HAYVAN_IS, adli: adli };
})(window);
