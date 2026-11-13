/* ==========================================================================
   ACADEX KIDS · konuşan kelimeler ve mini hikâyeler (kids/assets/kids-konusan.js), 13.11.2026
   Her kelime kendini tanıtır: köpek "Woof, woof! I'm a dog!", çilek "Hi! I'm a strawberry!".
   İzle durağında Acadia ile küçük bir diyalog kurulur:
     Acadia: "Who are you?"  →  kelime: "Woof, woof! I'm a dog!"  →  Acadia: "Hello, dog!"
     → mini hikâye: sahneye bir eşya gelir (top, sepet, tabak, yol…), kelime onunla oynar,
       Acadia hikâye cümlesini söyler ("The dog plays with a ball!").
   replik(konu, oge) → {soru, ben, selam, hikaye, sahne}; boş alanlar atlanır.
   Bütün cümleler ses kataloğuna (kids/ses/katalog.js) eklenir.
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
    animals: { sahne: 'top', c: function (r) { return 'The ' + r.en + ' plays with a ball!'; } },
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
  /* konu → Acadia'nın sorusu */
  var SORU = {
    colours: 'What colour are you?', numbers: 'What number are you?', alphabet: 'What letter are you?', feelings: 'How do you feel?',
    actions: 'What can you do?', jobs: 'What\'s your job?'
  };
  var SELAMSIZ = { feelings: 1, actions: 1, jobs: 1, numbers: 1, weather: 1, days: 1 };

  function ben(kid, r, P) {
    var c = P && P.izleCumle ? P.izleCumle(r) : '';
    switch (kid) {
      case 'animals': case 'sea': case 'transport': return r.ses ? sesTekrar(r.ses) + '! I\'m ' + adli(r) + '!' : 'Hi! ' + benim(r);
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
    var b = ben(kid, r, P); if (!b) return null;
    var soru = SORU[kid] || 'Who are you?';
    if (kid === 'weather' && SIFAT.indexOf(' ' + r.en + ' ') >= 0) soru = 'What\'s the weather like?';
    if (kid === 'days' && GUN.indexOf(' ' + r.id.toLowerCase() + ' ') >= 0) soru = 'What day is it?';
    var H = HIKAYE[kid], hk = H ? H.c(r) : null, eski = P && P.izleCumle ? P.izleCumle(r) : null;
    if (!hk && eski && eski !== b) hk = eski;
    return { soru: soru, ben: b, selam: SELAMSIZ[kid] ? null : 'Hello, ' + (BUYUK[r.id] || r.en) + '!', hikaye: hk, sahne: H && hk && hk !== eski ? H.sahne : (hk ? 'pirilti' : null) };
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
    pirilti: svg('<path d="M50 8 l8 30 l30 8 l-30 8 l-8 30 l-8 -30 l-30 -8 l30 -8 z" fill="#FFD23F" stroke="' + M + '" stroke-width="4" stroke-linejoin="round"/>')
  };
  function esya(ad) { return ESYA[ad] || ''; }

  /* hangi hayvan sesi çalınır (kids-ses.js FX.hayvan) */
  var HAYVAN = { cat: 1, dog: 1, bird: 1, frog: 1, cow: 1, chick: 1, lion: 1, horse: 1, pig: 1, sheep: 1, duck: 1, monkey: 1, elephant: 1, mouse: 1, snake: 1, owl: 1, bee: 1, goat: 1, hen: 1, crocodile: 1, whale: 1, dolphin: 1, seal: 1, walrus: 1, tiger: 1, bear: 1 };
  function hayvanSesi(r) { return r && HAYVAN[r.id] ? r.id : null; }

  W.KIDS_KONUSAN = { replik: replik, ben: ben, esya: esya, hayvanSesi: hayvanSesi, ESYA: ESYA, adli: adli };
})(window);
