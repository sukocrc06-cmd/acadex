/* ==========================================================================
   ACADEX ENGLISH · Defne Hoca (ingilizce/assets/hoca.js), 05.11.2026
   Acadex'in kendi karakteri; gerçek bir öğretmen değil, sınıf ya da ödev
   özelliği yok (CLAUDE.md ürün kuralı). İki dilli okutman: İngilizce konuşur, takılınca Türkçe açıklar.
   Acadia öğrencinin yanında; ipucunu hocaya çaktırmadan fısıldar.

     HOCA.sahne(el)                 karakter, tahta, konuşma balonu, gizli Acadia
       .soyle(en, tr, {gizli})      sesli konuşur, ağız sesle oynar (Promise)
       .tepki('dogru'|'kismen'|'yanlis')   yüz, el, tahta, ses
       .tahta(metin, renk)          tebeşirle yazar
       .fisilda(metin)              Acadia ipucu skeci (hoca bazen yakalar)
       .dusun(true|false)           yapay zekâ beklerken kalemle masaya vurur
     HOCA.degerlendir(cevap, kural) yerel ölçüt: anahtar fikir grupları
     HOCA.gramer(metin)             sık hatalar → [{parca, oneri, tr}]
     HOCA.yz(mod, veri)             supabase/functions/ingilizce-hoca; yoksa null
     HOCA.soruTuru / sohbet / yazi  panel oturumları
   Değerlendirme karma: hazır sorular önce yerel ölçütle; yerel "doğru" demezse
   ve fonksiyon yayındaysa yapay zekâ ikinci görüş verir. Fonksiyon yoksa
   (404, ağ, süre) bu oturumda bir daha denenmez, her şey yerel çalışır.
   ========================================================================== */
(function () {
  'use strict';
  var D = document, W = window;
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sakin = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var bekle = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var rasgele = function (a) { return a[Math.floor(Math.random() * a.length)]; };
  var INK = '#1A2A5C', TEN = '#EDBE97', SAC = '#3B2416', CEKET = '#5B7FB5';

  /* ---------- karakter ---------- */
  var SVG = '<svg class="hoca" viewBox="0 0 300 280" role="img" aria-label="Defne Hoca">' +
    '<g class="kupa"><path d="M50 204 h32 v26 a9 9 0 0 1 -9 9 h-14 a9 9 0 0 1 -9 -9 z" fill="#F5EFE2" stroke="' + INK + '" stroke-width="3"/><path d="M82 210 a8 8 0 0 1 0 16" fill="none" stroke="' + INK + '" stroke-width="3"/><rect x="56" y="214" width="20" height="10" rx="2" fill="#FFD86B" stroke="' + INK + '" stroke-width="1.5"/>' +
      '<path class="buhar" d="M60 198 c-5 -8 5 -12 0 -20 M70 198 c-5 -8 5 -12 0 -20" fill="none" stroke="#8A93AE" stroke-width="2.5" stroke-linecap="round"/></g>' +
    '<g class="govde"><path d="M104 120 C100 70 130 52 152 52 C182 52 204 74 200 124 C198 150 196 168 186 178 L118 178 C108 168 104 150 104 120Z" fill="' + SAC + '"/>' +
      '<rect x="140" y="148" width="22" height="34" fill="' + TEN + '" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M62 282 C64 232 84 198 120 188 L151 204 L182 188 C218 198 238 232 240 282 Z" fill="' + CEKET + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M120 188 L151 216 L182 188 L172 184 L151 200 L130 184 Z" fill="#F5EFE2" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="M120 188 L132 230 M182 188 L170 230" stroke="' + INK + '" stroke-width="2.5" fill="none"/><circle cx="104" cy="250" r="3" fill="#F5EFE2" stroke="' + INK + '" stroke-width="1.5"/><circle cx="198" cy="250" r="3" fill="#F5EFE2" stroke="' + INK + '" stroke-width="1.5"/></g>' +
    '<g class="bas">' +
      '<ellipse cx="111" cy="117" rx="6" ry="9" fill="' + TEN + '" stroke="' + INK + '" stroke-width="2.5"/><ellipse cx="191" cy="117" rx="6" ry="9" fill="' + TEN + '" stroke="' + INK + '" stroke-width="2.5"/><circle cx="191" cy="130" r="3" fill="#FFD86B" stroke="' + INK + '" stroke-width="1.5"/>' +
      '<ellipse cx="151" cy="112" rx="40" ry="47" fill="' + TEN + '" stroke="' + INK + '" stroke-width="3"/>' +
      '<path d="M110 106 C110 72 134 58 156 60 C180 62 196 80 194 106 C184 92 168 84 150 88 C138 90 124 98 110 106Z" fill="' + SAC + '" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="M110 104 C104 128 108 152 118 170" fill="none" stroke="' + SAC + '" stroke-width="9" stroke-linecap="round"/><path d="M193 104 C198 128 194 152 186 170" fill="none" stroke="' + SAC + '" stroke-width="9" stroke-linecap="round"/>' +
      '<g class="kalem-kulak"><path d="M182 96 L214 80 L217 86 L185 102 Z" fill="#C93B2B" stroke="' + INK + '" stroke-width="2"/><path d="M214 80 L222 79 L217 86 Z" fill="#F5EFE2" stroke="' + INK + '" stroke-width="1.5"/></g>' +
      '<path class="kas k1" d="M127 99 Q136 93 145 98" fill="none" stroke="' + INK + '" stroke-width="3.4" stroke-linecap="round"/><path class="kas k2" d="M157 98 Q166 93 175 99" fill="none" stroke="' + INK + '" stroke-width="3.4" stroke-linecap="round"/>' +
      '<g class="gozler"><g class="goz g1"><ellipse cx="136" cy="113" rx="4.4" ry="5.8" fill="' + INK + '"/><circle cx="137.6" cy="111" r="1.4" fill="#fff"/></g><g class="goz g2"><ellipse cx="166" cy="113" rx="4.4" ry="5.8" fill="' + INK + '"/><circle cx="167.6" cy="111" r="1.4" fill="#fff"/></g>' +
        '<path class="kirpik" d="M160 114 Q166 108 172 114" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/></g>' +
      '<path d="M151 117 q-3 9 2 11" fill="none" stroke="' + INK + '" stroke-width="2.2" stroke-linecap="round"/>' +
      '<ellipse cx="127" cy="129" rx="7" ry="3.5" fill="#F29C94" opacity=".55"/><ellipse cx="175" cy="129" rx="7" ry="3.5" fill="#F29C94" opacity=".55"/>' +
      '<g class="agiz">' +
        '<path class="a-kapali" d="M141 135 Q151 142 161 135" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>' +
        '<path class="a-gulus" d="M139 133 Q151 150 163 133 Z" fill="#7A2E2E" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>' +
        '<ellipse class="a-acik" cx="151" cy="138" rx="7" ry="5.5" fill="#7A2E2E" stroke="' + INK + '" stroke-width="2.2"/>' +
        '<ellipse class="a-o" cx="151" cy="138" rx="4.2" ry="5" fill="#7A2E2E" stroke="' + INK + '" stroke-width="2"/>' +
        '<path class="a-duz" d="M143 137 L159 137" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>' +
        '<path class="a-egik" d="M142 138 Q153 141 161 132" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>' +
      '</g></g>' +
    '<path d="M0 238 H300 V280 H0 Z" fill="#C9A57A" stroke="' + INK + '" stroke-width="3"/><path d="M0 246 H300" stroke="#B48C5E" stroke-width="2"/>' +
    '<g class="kol-sag"><path d="M90 214 C76 226 72 236 80 242 L106 242 C102 234 100 226 106 218" fill="' + CEKET + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/><ellipse cx="86" cy="234" rx="10" ry="7" fill="' + TEN + '" stroke="' + INK + '" stroke-width="2.5"/></g>' +
    '<g class="kol k-masa"><path d="M212 214 C226 226 230 236 222 242 L196 242 C200 234 204 226 198 218" fill="' + CEKET + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/><path d="M206 236 L234 222" stroke="#C93B2B" stroke-width="4" stroke-linecap="round"/><ellipse cx="210" cy="234" rx="10" ry="7" fill="' + TEN + '" stroke="' + INK + '" stroke-width="2.5"/></g>' +
    '<g class="kol k-tikla"><path d="M212 214 C226 226 230 236 222 242 L196 242 C200 234 204 226 198 218" fill="' + CEKET + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/><g class="kalem-vur"><path d="M210 232 L238 214" stroke="#C93B2B" stroke-width="4" stroke-linecap="round"/></g><ellipse cx="210" cy="232" rx="10" ry="7" fill="' + TEN + '" stroke="' + INK + '" stroke-width="2.5"/></g>' +
    '<g class="kol k-bas"><path d="M200 200 C228 196 244 176 240 158 L224 156 C226 174 218 186 196 192Z" fill="' + CEKET + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/><circle cx="232" cy="150" r="11" fill="' + TEN + '" stroke="' + INK + '" stroke-width="2.5"/><path d="M230 141 v-13 a4.5 4.5 0 0 1 9 0 v13" fill="' + TEN + '" stroke="' + INK + '" stroke-width="2.5"/></g>' +
    '<g class="kol k-salla"><path d="M200 200 C228 196 244 176 240 160 L224 158 C226 174 218 186 196 192Z" fill="' + CEKET + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/><g class="avuc"><ellipse cx="234" cy="146" rx="12" ry="14" fill="' + TEN + '" stroke="' + INK + '" stroke-width="2.5"/><path d="M226 136 v-8 M232 133 v-10 M238 133 v-10 M244 137 v-7" stroke="' + INK + '" stroke-width="2.2" stroke-linecap="round"/></g></g>' +
    '</svg>';

  /* ---------- ses: hoca sesi (kadın, İngiliz ya da Amerikan) ---------- */
  var sesVar = 'speechSynthesis' in W;
  function hocaSesi() {
    if (!sesVar) return null; var v = speechSynthesis.getVoices();
    return v.find(function (x) { return /^en/.test(x.lang) && /female|libby|sonia|serena|samantha|karen|moira|tessa|hazel|susan|zira|aria|jenny|google uk english female/i.test(x.name); }) || v.find(function (x) { return /en-GB/.test(x.lang); }) || v.find(function (x) { return /^en/.test(x.lang); }) || null;
  }
  if (sesVar) { speechSynthesis.getVoices(); try { speechSynthesis.addEventListener('voiceschanged', function () { speechSynthesis.getVoices(); }); } catch (e) {} }
  var sesAcik = function () { return !W.ACX || !W.ACX.sesAcik || W.ACX.sesAcik(); };

  function sahne(kok) {
    kok.classList.add('hoca-sahne');
    kok.innerHTML = '<div class="tahta" aria-hidden="true"><div class="tahta-ic"></div><span class="tebesir"></span></div>' +
      '<div class="hoca-kis">' + SVG + '<div class="gizli-acadia" aria-hidden="true">' + (W.ACX && W.ACX.acadiaSvg ? W.ACX.acadiaSvg(D.body.dataset.panel) : '') + '</div><div class="fisilti" role="status" aria-live="polite"></div></div>' +
      '<div class="hoca-soz kagit" aria-live="polite"><span class="kim">Defne Hoca</span><p class="en" lang="en"></p><p class="tr"></p></div>';
    var svg = kok.querySelector('svg.hoca'), soz = kok.querySelector('.hoca-soz'), enEl = soz.querySelector('.en'), trEl = soz.querySelector('.tr');
    var kis = kok.querySelector('.hoca-kis'), fis = kok.querySelector('.fisilti'), tahtaIc = kok.querySelector('.tahta-ic');
    var konusuyor = null, durum = { ifade: 'normal', kol: 'masa' };
    svg.dataset.agiz = 'kapali'; svg.dataset.kol = 'masa'; svg.dataset.ifade = 'normal';
    var agizIfade = { normal: 'kapali', gulum: 'gulus', dusun: 'egik', kas: 'duz', sasir: 'o', kirp: 'egik' };
    function ifade(x) { durum.ifade = x; svg.dataset.ifade = x; if (!konusuyor) svg.dataset.agiz = agizIfade[x] || 'kapali'; }
    function kol(x) { durum.kol = x; svg.dataset.kol = x; }
    /* göz kırpma */
    (function kirp() { if (!sakin) { svg.classList.add('kirpis'); setTimeout(function () { svg.classList.remove('kirpis'); }, 140); } setTimeout(kirp, 2600 + Math.random() * 3200); })();

    function soyle(en, tr, o) {
      o = o || {};
      if (konusuyor) konusuyor();
      enEl.innerHTML = o.gizli ? '<span class="dinle-isaret">🔊 dinle…</span>' : esc(en); trEl.textContent = tr || ''; trEl.hidden = !tr;
      soz.classList.remove('yeni'); void soz.offsetWidth; soz.classList.add('yeni');
      return new Promise(function (bitti) {
        var dongu = null, son = false;
        var kapat = function () { if (son) return; son = true; clearInterval(dongu); konusuyor = null; svg.dataset.agiz = agizIfade[durum.ifade] || 'kapali'; bitti(); };
        konusuyor = kapat;
        if (!sakin) dongu = setInterval(function () { svg.dataset.agiz = rasgele(['acik', 'o', 'kapali', 'acik']); }, 120);
        var tahmini = Math.max(1200, String(en).split(/\s+/).length * 330 / (o.hiz || .95));
        if (sesVar && sesAcik() && en) {
          try {
            speechSynthesis.cancel();
            var u = new SpeechSynthesisUtterance(en); u.lang = 'en-GB'; var v = hocaSesi(); if (v) u.voice = v; u.rate = o.hiz || .95; u.pitch = 1.08;
            u.onend = kapat; u.onerror = kapat; speechSynthesis.speak(u);
            setTimeout(kapat, tahmini * 2.2 + 1500);   /* bazı tarayıcılar onend göndermez */
          } catch (e) { setTimeout(kapat, tahmini); }
        } else setTimeout(kapat, Math.min(tahmini, 2600));
      });
    }
    var tekrarla = null;
    function tepki(sonuc) {
      clearTimeout(tekrarla);
      if (sonuc === 'dogru') { ifade('gulum'); kol('bas'); tahta('✓ ' + rasgele(['nice', 'yes!', 'good']), 'yesil'); if (W.ACX) W.ACX.sevin(); }
      else if (sonuc === 'kismen') { ifade('dusun'); kol('salla'); tahta('~ almost', 'sari'); if (W.ACX) { W.ACX.sesCal('kismen'); } }
      else { ifade('kas'); kol('tikla'); tahta('✗ again', 'kirmizi'); if (W.ACX) W.ACX.uz(); }
      tekrarla = setTimeout(function () { kol('masa'); ifade('normal'); }, 2200);
    }
    function tahta(metin, renk) {
      var s = D.createElement('div'); s.className = 'tahta-satir ' + (renk || ''); s.textContent = metin; tahtaIc.appendChild(s);
      while (tahtaIc.children.length > 4) tahtaIc.firstChild.remove();
      if (W.ACX && !sakin) W.ACX.sesCal('tebesir');
    }
    function temizle() { tahtaIc.innerHTML = ''; }
    var fisZ = null;
    function fisilda(metin, zorla) {
      clearTimeout(fisZ); kis.classList.remove('fisilda', 'yakalandi'); void kis.offsetWidth;
      fis.innerHTML = '<span class="el">psst…</span> ' + esc(metin); kis.classList.add('fisilda');
      var yakala = zorla != null ? zorla : Math.random() < .3;
      return new Promise(function (r) {
        fisZ = setTimeout(function () {
          svg.dataset.bak = 'sag';
          if (yakala) {
            kis.classList.add('yakalandi'); svg.classList.add('goz-kirp'); ifade('kirp');
            soyle('I saw that, Acadia.', 'Gördüm ama sorun değil; ipucu da öğrenmenin parçası.', { hiz: 1.05 });
          }
          fisZ = setTimeout(function () { delete svg.dataset.bak; svg.classList.remove('goz-kirp'); ifade('normal'); kis.classList.remove('yakalandi'); r(yakala); }, yakala ? 2600 : 900);
        }, 1300);
        setTimeout(function () { kis.classList.remove('fisilda'); }, yakala ? 5200 : 4800);
      });
    }
    function dusun(on) { if (on) { ifade('dusun'); kol('tikla'); } else { kol('masa'); ifade('normal'); } }
    return { soyle: soyle, tepki: tepki, tahta: tahta, temizle: temizle, fisilda: fisilda, dusun: dusun, ifade: ifade, kol: kol, svg: svg };
  }

  /* ---------- yerel değerlendirme ---------- */
  function norm(s) { return ' ' + String(s || '').toLowerCase().replace(/[’`]/g, "'").replace(/[^a-z0-9%' ]+/g, ' ').replace(/\s+/g, ' ').trim() + ' '; }
  function var_(n, t) { return n.indexOf(' ' + norm(t).trim()) > -1; }   /* kelime başından önek: emotion → emotional */
  function kelimeSay(s) { var n = norm(s).trim(); return n ? n.split(' ').length : 0; }
  function degerlendir(cevap, k) {
    var n = norm(cevap), say = kelimeSay(cevap);
    if (say < (k.min || 1)) return { sonuc: 'yanlis', eksik: [], bulunan: [], kisa: true };
    var g = k.g || [], bul = g.filter(function (x) { return x.t.some(function (t) { return var_(n, t); }); });
    /* ters cevap: yalnız doğru fikir hiç yoksa ("less, not more" doğru sayılır) */
    if (!bul.length && k.yanlis && k.yanlis.some(function (t) { return var_(n, t); })) return { sonuc: 'yanlis', eksik: [], bulunan: [], ters: true };
    var zor = g.filter(function (x) { return x.z !== false; });
    if (k.herhangi) return { sonuc: bul.length ? 'dogru' : 'yanlis', eksik: bul.length ? [] : g.map(function (x) { return x.ad; }), bulunan: bul.map(function (x) { return x.ad; }) };
    var eksik = zor.filter(function (x) { return bul.indexOf(x) < 0; });
    return { sonuc: !eksik.length ? 'dogru' : bul.length ? 'kismen' : 'yanlis', eksik: eksik.map(function (x) { return x.ad; }), bulunan: bul.map(function (x) { return x.ad; }) };
  }
  var GRAMER = [
    [/\bi is\b/i, 'I am', '“I” ile “am” kullanılır.'],
    [/\b(he|she|it) don'?t\b/i, "doesn't", 'he / she / it ile “doesn’t”.'],
    [/\bpeople is\b/i, 'people are', '“people” çoğul.'],
    [/\bmore (better|easier|cheaper|bigger|faster|worse|smaller|harder)\b/i, '-er yeter', 'Kısa sıfatta “more” fazla.'],
    [/\b(i|we|they) am agree\b|\bi am agree\b|\bam agree\b/i, 'I agree', '“agree” fiil; “am” gerekmez.'],
    [/\bdiscuss about\b/i, 'discuss', '“discuss” edat almaz.'],
    [/\binformations\b/i, 'information', 'Sayılamaz; çoğul olmaz.'],
    [/\bdespite of\b/i, 'despite', '“despite” yanına “of” almaz.'],
    [/\bmake (a )?research\b/i, 'do research', 'research ile “do” kullanılır.'],
    [/\bvery (fantastic|amazing|perfect|excellent|huge|terrible)\b/i, 'absolutely …', 'Güçlü sıfat “very” almaz.'],
    [/\bin the other hand\b/i, 'on the other hand', 'Kalıp “on the other hand”.'],
    [/\b(a|an) (advice|information|furniture|homework|equipment)\b/i, 'some …', 'Sayılamayan isim “a” almaz.'],
    [/\bstudents? (is|was) /i, null, null]   /* yer tutucu: aşağıda filtrelenir */
  ].filter(function (x) { return x[1]; });
  /* 3. tekil şahıs -s: soru ve yardımcı fiil sonrası hariç (lookbehind eski Safari'de yok; o zaman bu kural atlanır) */
  try { GRAMER.push([new RegExp("(?<!\\b(?:does|did|do|can|will|would|should|could|may|might|must|let|make|to|help|let's|lets)\\s)\\b(he|she|it) (go|have|do|want|like|think|need|study|work|live|say|know)\\b(?!\\w)", 'i'), 'fiil + s', '3. tekil şahısta fiil -s alır (she likes).']); } catch (e) { /* desteklenmiyor */ }
  function gramer(metin) {
    var out = [];
    GRAMER.forEach(function (g) { var m = String(metin).match(g[0]); if (m) out.push({ parca: m[0], oneri: g[1], tr: g[2] }); });
    return out;
  }

  /* ---------- yapay zekâ istemcisi ---------- */
  var yzKapali = false;
  async function yz(mod, veri) {
    if (yzKapali) return null;
    var url, anahtar, sb;
    try { url = SUPABASE_URL; anahtar = SUPABASE_ANON_KEY; sb = supabaseClient; } catch (e) { return null; }
    try {
      var s = await sb.auth.getSession(), tok = s && s.data && s.data.session && s.data.session.access_token; if (!tok) return null;
      var ac = new AbortController(), zaman = setTimeout(function () { ac.abort(); }, 9000);
      var r = await fetch(url + '/functions/v1/ingilizce-hoca', { method: 'POST', signal: ac.signal, headers: { Authorization: 'Bearer ' + tok, apikey: anahtar, 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ mod: mod }, veri)) });
      clearTimeout(zaman);
      if (r.status === 404) { yzKapali = true; return null; }
      if (!r.ok) return null;
      var j = await r.json(); return j && typeof j === 'object' && !j.error ? j : null;
    } catch (e) { return null; }
  }

  /* ---------- ortak parçalar ---------- */
  function yildizCiz(n, top) { var s = ''; for (var i = 0; i < top; i++) s += n >= i + 1 ? '★' : n >= i + .5 ? '⯪' : '☆'; return s; }
  function bitti(panel, el) {
    var h = W.ACX ? W.ACX.ls.al('hoca', {}) : {}; var yeni = !h[panel]; h[panel] = Date.now(); if (W.ACX) { W.ACX.ls.yaz('hoca', h); W.ACX.gunlukEkle(panel); if (el && yeni) W.ACX.odul(el); }
  }
  var dinleVar = !!(W.SpeechRecognition || W.webkitSpeechRecognition);
  function dinle(input, bitince) {
    var SR = W.SpeechRecognition || W.webkitSpeechRecognition; if (!SR) return null;
    var r = new SR(); r.lang = 'en-GB'; r.interimResults = true; r.maxAlternatives = 1; var son = '';
    r.onresult = function (e) { var t = ''; for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; input.value = t; son = t; };
    r.onend = function () { bitince(son.trim()); };
    r.onerror = function () { bitince(''); };
    try { r.start(); } catch (e) { return null; }
    return r;
  }

  /* ==========================================================================
     OTURUM 1 · soru turu (Reading, Listening dikte, Vocab cümle)
     o = { panel, baslik, sorular:[{soru_en, soru_tr, kural, ornek, ipucu:[..3], ipucuEl, tip:'acik'|'dikte'|'kelime', dikte, kelime}], metin }
     ========================================================================== */
  function soruTuru(el, o) {
    el.innerHTML = '<div class="hoca-duzen"><div class="hoca-sahne-yer"></div><div class="hoca-is kagit"><div class="hoca-ust"><span class="etiket">' + esc(o.baslik) + '</span><span class="yildiz" aria-live="polite"></span></div><div class="hoca-govde"></div></div></div>';
    var h = sahne(el.querySelector('.hoca-sahne-yer')), govde = el.querySelector('.hoca-govde'), yEl = el.querySelector('.yildiz');
    var i = 0, puan = [], ipucuNo = 0, deneme = 0, s = null;
    function yildizGoster() { var top = 0; puan.forEach(function (p) { top += p; }); yEl.textContent = yildizCiz(top / Math.max(1, puan.length || 1), 3) + '  ' + puan.length + '/' + o.sorular.length; }
    function baslat() {
      govde.innerHTML = '<p class="hoca-giris">' + esc(o.giris_tr || '') + '</p><button class="btn ana" type="button">Başlayalım</button>';
      govde.querySelector('button').onclick = function () { soruCiz(); };
      h.soyle(o.giris_en || "Hi, I'm Defne. Ready?", o.giris_tr2 || '');
    }
    function soruCiz() {
      if (i >= o.sorular.length) return kapanis();
      s = o.sorular[i]; ipucuNo = 0; deneme = 0; h.temizle(); temizleIsaret();
      var kayit = s.tip === 'dikte' || s.tip === 'kelime';
      govde.innerHTML = '<div class="soru-u"><span class="say">soru ' + (i + 1) + ' / ' + o.sorular.length + '</span><span class="yarim">' + yildizCiz(3, 3) + '</span></div>' +
        '<p class="soru-en" lang="en">' + (s.tip === 'dikte' ? 'Hocanın okuduğu cümleyi yaz.' : esc(s.soru_en)) + '</p>' + (s.soru_tr ? '<p class="soru-tr">' + esc(s.soru_tr) + '</p>' : '') +
        (s.tip === 'dikte' ? '<p class="dugmeler" style="gap:8px"><button class="btn sm" type="button" data-tekrar>▶ Tekrar oku</button><button class="btn sm" type="button" data-yavas>Yavaş oku</button></p>' : '') +
        '<label class="gizli" for="hc-' + i + '">Cevabın</label><textarea id="hc-' + i + '" rows="2" lang="en" spellcheck="true" placeholder="' + (s.tip === 'kelime' ? 'cümleni yaz…' : 'cevabını yaz…') + '"></textarea>' +
        '<div class="ipucu-kutu" hidden></div>' +
        '<div class="alt-satir"><button class="btn sm acadia-btn" type="button" data-ipucu>Acadia’dan fısıltı al <small>−½ ★</small></button><button class="btn sm ana" type="button" data-gonder>Cevapla</button></div>';
      var ta = govde.querySelector('textarea');
      govde.querySelector('[data-gonder]').onclick = cevapla;
      ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); cevapla(); } });
      govde.querySelector('[data-ipucu]').onclick = ipucu;
      if (s.tip === 'dikte') {
        govde.querySelector('[data-tekrar]').onclick = function () { h.soyle(s.dikte, '', { gizli: true, hiz: .9 }); };
        govde.querySelector('[data-yavas]').onclick = function () { h.soyle(s.dikte, '', { gizli: true, hiz: .68 }); };
        h.soyle(s.dikte, 'Dinle ve yaz.', { gizli: true, hiz: .9 });
      } else h.soyle(s.soru_en, s.soru_tr);
      ta.focus({ preventScroll: true });
    }
    function temizleIsaret() { if (o.metin) o.metin.querySelectorAll('.hoca-isaret,.hoca-fosfor').forEach(function (x) { x.classList.remove('hoca-isaret', 'hoca-fosfor'); }); }
    function ipucu() {
      if (!s || ipucuNo >= 3) return;
      var metin = s.ipucu[ipucuNo], kutu = govde.querySelector('.ipucu-kutu');
      if (o.metin && s.paragraf != null && ipucuNo === 0) { var p = o.metin.querySelectorAll('p')[s.paragraf]; if (p) { p.classList.add('hoca-isaret'); p.scrollIntoView({ block: 'nearest', behavior: sakin ? 'auto' : 'smooth' }); } }
      if (o.metin && s.fosfor && ipucuNo === 1) { var f = o.metin.querySelector('[data-f="' + s.fosfor + '"]'); if (f) f.classList.add('hoca-fosfor'); }
      ipucuNo++; kutu.hidden = false; kutu.insertAdjacentHTML('beforeend', '<p><span class="el">Acadia:</span> ' + esc(metin) + '</p>');
      h.fisilda(metin); if (ipucuNo >= 3) govde.querySelector('[data-ipucu]').disabled = true;
      govde.querySelector('.yarim').textContent = yildizCiz(Math.max(0, 3 - ipucuNo * .5 - deneme * .5), 3);
    }
    async function cevapla() {
      var ta = govde.querySelector('textarea'), cevap = ta.value.trim(); if (!cevap) { ta.focus(); return; }
      var btn = govde.querySelector('[data-gonder]'); btn.disabled = true;
      var r;
      if (s.tip === 'dikte') r = dikteDegerlendir(cevap, s.dikte);
      else if (s.tip === 'kelime') r = kelimeDegerlendir(cevap, s);
      else r = degerlendir(cevap, s.kural);
      var geri = yerelGeri(r, s);
      if (r.sonuc !== 'dogru' && s.tip !== 'dikte' && !(r.eksikKelime)) {
        h.dusun(true); h.soyle('Hmm, let me think…', '');
        var ai = await yz(s.tip === 'kelime' ? 'kelime' : 'degerlendir', { soru: s.soru_en, metin: o.metinYazi || '', ornek: s.ornek || '', kelime: s.kelime || '', anlam: s.anlam || '', cevap: cevap });
        h.dusun(false);
        if (ai && /^(dogru|kismen|yanlis)$/.test(ai.sonuc)) { r = Object.assign({}, r, { sonuc: ai.sonuc }); geri = { en: ai.tepki_en || geri.en, tr: ai.geri_tr || ai.tr_not || geri.tr, duzeltme: ai.duzeltme || '' }; }
      }
      deneme += r.sonuc === 'dogru' ? 0 : 1;
      h.tepki(r.sonuc);
      var sonDeneme = r.sonuc === 'dogru' || deneme >= 2;
      var kutu = D.createElement('div'); kutu.className = 'geri acik hoca-geri ' + r.sonuc;
      kutu.innerHTML = '<span class="el">' + ({ dogru: 'Doğru. ', kismen: 'Kısmen. ', yanlis: 'Olmadı. ' })[r.sonuc] + '</span>' + esc(geri.tr) + (geri.fark ? '<div class="fark">' + geri.fark + '</div>' : '') + (geri.duzeltme ? '<div class="duzelt" lang="en">→ ' + esc(geri.duzeltme) + '</div>' : '') +
        (sonDeneme && r.sonuc !== 'dogru' && (s.ornek || s.dikte) ? '<div class="duzelt" lang="en"><b>Örnek cevap:</b> ' + esc(s.ornek || s.dikte) + '</div>' : '');
      var eski = govde.querySelector('.hoca-geri'); if (eski) eski.remove();
      govde.querySelector('.alt-satir').before(kutu);
      await h.soyle(geri.en, '');
      if (sonDeneme) {
        var p = Math.max(0, 3 - ipucuNo * .5 - (deneme ? (r.sonuc === 'dogru' ? .5 : 1.5) : 0)); if (r.sonuc === 'kismen' && deneme >= 2) p = Math.max(p, 1);
        puan.push(p); yildizGoster();
        var as = govde.querySelector('.alt-satir'); as.innerHTML = '<span class="say">' + yildizCiz(p, 3) + '</span><button class="btn sm ana" type="button">' + (i + 1 < o.sorular.length ? 'Sonraki soru →' : 'Bitir') + '</button>';
        as.querySelector('button').onclick = function () { i++; soruCiz(); }; as.querySelector('button').focus({ preventScroll: true });
      } else { btn.disabled = false; ta.focus({ preventScroll: true }); ta.select(); }
    }
    function yerelGeri(r, s) {
      if (s.tip === 'dikte') return r.geri;
      if (s.tip === 'kelime') return r.geri;
      if (r.sonuc === 'dogru') return { en: rasgele(['Exactly.', 'Spot on.', "That's it.", 'Yes, well done.']), tr: s.dogru_tr || 'Metindeki fikri yakaladın.' };
      if (r.sonuc === 'kismen') return { en: rasgele(['Almost there.', 'Nearly. Something is missing.', 'Good start, but not complete.']), tr: 'Eksik kalan: ' + r.eksik.join(', ') + '. Bir daha dene.' };
      return { en: r.ters ? "Hmm, the text says the opposite." : r.kisa ? 'Tell me a little more.' : 'Not quite. Look at the text again.', tr: r.ters ? 'Metin tam tersini söylüyor.' : r.kisa ? 'Biraz daha açık yaz.' : (s.paragraf != null ? (s.paragraf + 1) + '. paragrafa bir daha bak.' : 'Metne bir daha bak.') };
    }
    function kapanis() {
      var top = 0; puan.forEach(function (p) { top += p; }); var ort = top / Math.max(1, puan.length);
      h.temizle(); h.tahta(yildizCiz(ort, 3), 'sari');
      var en = ort >= 2.5 ? 'Excellent work today.' : ort >= 1.5 ? 'Good job. A bit more practice and you are there.' : "We'll get there. Let's try again tomorrow.";
      var tr = ort >= 2.5 ? 'Bugün çok iyiydin.' : ort >= 1.5 ? 'İyi gidiyor; biraz daha pratikle oturacak.' : 'Sorun değil, yarın bir tur daha.';
      h.ifade(ort >= 1.5 ? 'gulum' : 'normal'); h.soyle(en, tr);
      govde.innerHTML = '<p class="el" style="font-size:28px;margin:0 0 6px;color:var(--c)">' + yildizCiz(ort, 3) + ' · ' + esc(tr) + '</p><button class="btn sm" type="button">Baştan</button>';
      govde.querySelector('button').onclick = function () { i = 0; puan = []; yildizGoster(); soruCiz(); };
      if (ort >= 1.5) bitti(o.panel, el.closest('.hoca-kart') || el);
    }
    yildizGoster(); baslat();
    return h;
  }
  function dikteDegerlendir(cevap, hedef) {
    var a = norm(hedef).trim().split(' '), y = norm(cevap).trim().split(' '), j = 0, isabet = 0, out = [], kacan = [];
    a.forEach(function (w) { var k = y.indexOf(w, j); if (k > -1 && k - j < 3) { out.push('<span class="ok">' + esc(w) + '</span>'); isabet++; j = k + 1; } else { out.push('<span class="yok">' + esc(w) + '</span>'); kacan.push(w); } });
    var oran = isabet / a.length, sonuc = oran === 1 ? 'dogru' : oran >= .7 ? 'kismen' : 'yanlis';
    return { sonuc: sonuc, kacan: kacan, geri: { en: sonuc === 'dogru' ? 'Perfect dictation.' : sonuc === 'kismen' ? 'Close. You missed a few words.' : "Let's listen once more.", tr: Math.round(oran * 100) + '% doğru.' + (kacan.length ? ' Kaçanlar: ' + kacan.join(', ') + '.' : ''), fark: out.join(' ') } };
  }
  function kelimeDegerlendir(cevap, s) {
    var n = norm(cevap), kok = norm(s.kelime).trim().slice(0, Math.max(4, s.kelime.length - 2)), say = kelimeSay(cevap);
    if (n.indexOf(' ' + kok) < 0) return { sonuc: 'yanlis', eksikKelime: true, geri: { en: 'I can’t see the word ' + s.kelime + ' in your sentence.', tr: '“' + s.kelime + '” cümlede yok.' } };
    var g = gramer(cevap);
    if (say < 6) return { sonuc: 'kismen', geri: { en: 'Good, but make it longer.', tr: 'Kelime doğru yerde; cümleyi biraz uzat (en az 6 kelime).' } };
    if (s.ornek && benzer(cevap, s.ornek) > .75) return { sonuc: 'kismen', geri: { en: 'That is my example! Try your own.', tr: 'Örneğe çok benziyor; kendi cümleni kur.' } };
    if (g.length) return { sonuc: 'kismen', geri: { en: 'Nice use of the word. One small grammar point.', tr: g[0].tr, duzeltme: g[0].parca + ' → ' + g[0].oneri } };
    return { sonuc: 'dogru', geri: { en: rasgele(['Lovely sentence.', 'Natural and correct.', 'Great, that sounds natural.']), tr: '“' + s.kelime + '” yerinde kullanılmış.' } };
  }
  function benzer(a, b) { var x = norm(a).trim().split(' '), y = norm(b).trim().split(' '), ort = x.filter(function (w) { return y.indexOf(w) > -1; }).length; return ort / Math.max(x.length, y.length); }

  /* ==========================================================================
     OTURUM 2 · sesli sohbet (Speaking)
     ========================================================================== */
  var BAGLAC = /\b(because|since|so|that's why|for example|for instance|however|although|also|but|and then|actually)\b/i;
  var DOLGU = /\b(um+|uh+|erm|like|you know)\b/gi;
  function sohbet(el, o) {
    el.innerHTML = '<div class="hoca-duzen"><div class="hoca-sahne-yer"></div><div class="hoca-is kagit"><div class="hoca-ust"><span class="etiket">' + esc(o.baslik) + '</span><span class="say tur"></span></div><div class="sohbet-log" aria-live="polite"></div><div class="sohbet-giris"></div></div></div>';
    var h = sahne(el.querySelector('.hoca-sahne-yer')), log = el.querySelector('.sohbet-log'), giris = el.querySelector('.sohbet-giris'), turEl = el.querySelector('.tur');
    var gecmis = [], cevaplar = [], tur = 0, soru = '', TUR = o.tur || 5, dinleyici = null;
    function yaz(kim, metin, ek) { var d = D.createElement('div'); d.className = 'msj ' + kim; d.innerHTML = '<span class="kim">' + (kim === 'hoca' ? 'Defne Hoca' : 'Sen') + '</span><p lang="en">' + esc(metin) + '</p>' + (ek || ''); log.appendChild(d); log.scrollTop = log.scrollHeight; return d; }
    function girisCiz() {
      giris.innerHTML = '<label class="gizli" for="sh-in">Cevabın</label><textarea id="sh-in" rows="2" lang="en" placeholder="' + (dinleVar ? 'mikrofona bas ya da yaz…' : 'cevabını yaz…') + '"></textarea>' +
        '<div class="alt-satir">' + (dinleVar ? '<button class="btn sm mik" type="button" data-mik aria-pressed="false">● Konuş</button>' : '') + '<button class="btn sm acadia-btn" type="button" data-ipucu>Acadia: nasıl başlarım?</button><button class="btn sm ana" type="button" data-gonder>Gönder</button></div>';
      var ta = giris.querySelector('textarea');
      giris.querySelector('[data-gonder]').onclick = function () { gonder(ta.value.trim()); };
      ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); gonder(ta.value.trim()); } });
      giris.querySelector('[data-ipucu]').onclick = function () { var ip = (o.ipucu && o.ipucu[Math.min(tur, o.ipucu.length - 1)]) || 'Önce kısa cevap ver, sonra “because …” ile bir neden ekle.'; h.fisilda(ip); };
      var mik = giris.querySelector('[data-mik]');
      if (mik) mik.onclick = function () {
        if (dinleyici) { try { dinleyici.stop(); } catch (e) {} return; }
        if (W.speechSynthesis) speechSynthesis.cancel();
        mik.setAttribute('aria-pressed', 'true'); mik.textContent = '■ Bitir'; el.classList.add('dinliyor');
        dinleyici = dinle(ta, function (t) { dinleyici = null; mik.setAttribute('aria-pressed', 'false'); mik.textContent = '● Konuş'; el.classList.remove('dinliyor'); if (t) gonder(t); else ACX.soyle('Sesini alamadım; mikrofon iznini kontrol et ya da yaz.', 4000); });
        if (!dinleyici) { mik.textContent = '● Konuş'; el.classList.remove('dinliyor'); }
      };
    }
    async function sor(metin, tr) { soru = metin; gecmis.push({ rol: 'hoca', metin: metin }); yaz('hoca', metin, tr ? '<small>' + esc(tr) + '</small>' : ''); turEl.textContent = 'tur ' + Math.min(tur + 1, TUR) + ' / ' + TUR; await h.soyle(metin, tr); }
    function yerel(cevap) {
      var say = kelimeSay(cevap), g = gramer(cevap), neden = BAGLAC.test(cevap);
      if (say < 5) return { sonuc: 'yanlis', tepki_en: 'That’s a bit short. Can you tell me more?', tr_not: 'Çok kısa kaldı; en az bir neden ekle.' };
      if (g.length) return { sonuc: 'kismen', tepki_en: 'I see. Just one small thing.', duzeltme: g[0].parca + ' → ' + g[0].oneri, tr_not: g[0].tr };
      if (!neden || say < 10) return { sonuc: 'kismen', tepki_en: 'Okay. Why is that?', tr_not: 'Fikir iyi; “because …” ile nedenini de söyle, cevabı uzat.' };
      return { sonuc: 'dogru', tepki_en: rasgele(['That’s interesting.', 'Nice answer, very natural.', 'I like that.', 'Good, you explained it well.']), tr_not: 'Akıcı ve gerekçeli bir cevap.' };
    }
    async function gonder(cevap) {
      if (!cevap) return;
      var ta = giris.querySelector('textarea'); ta.value = ''; giris.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
      yaz('ogr', cevap); gecmis.push({ rol: 'ogrenci', metin: cevap }); cevaplar.push(cevap); tur++;
      h.dusun(true);
      var ai = await yz('sohbet', { gecmis: gecmis.slice(-8), soru: soru, cevap: cevap, tur: tur, toplam: TUR });
      h.dusun(false);
      var r = ai && /^(dogru|kismen|yanlis)$/.test(ai.sonuc) ? ai : yerel(cevap);
      h.tepki(r.sonuc);
      var son = log.lastElementChild; son.classList.add(r.sonuc);
      if (r.duzeltme || r.tr_not) son.insertAdjacentHTML('beforeend', '<div class="hoca-not">' + (r.duzeltme ? '<span lang="en">→ ' + esc(r.duzeltme) + '</span>' : '') + (r.tr_not ? '<small>' + esc(r.tr_not) + '</small>' : '') + '</div>');
      await bekle(400);
      if (tur >= TUR) { await h.soyle(r.tepki_en || 'Thank you.', ''); return karne(); }
      var sonraki = (ai && ai.sonraki_soru) || (r.sonuc === 'kismen' && !r.duzeltme && cevaplar.filter(function (c) { return c === cevap; }).length === 1 && !BAGLAC.test(cevap) ? 'Why do you think so?' : o.sorular[Math.min(tur, o.sorular.length - 1)]);
      await h.soyle(r.tepki_en || '', '');
      await sor(sonraki);
      giris.querySelectorAll('button').forEach(function (b) { b.disabled = false; });
    }
    function karne() {
      var hepsi = cevaplar.join(' '), kel = norm(hepsi).trim().split(' ').filter(Boolean), tek = {};
      kel.forEach(function (w) { tek[w] = 1; });
      var ort = kel.length / Math.max(1, cevaplar.length), cesit = Object.keys(tek).length / Math.max(1, kel.length), bag = (hepsi.match(new RegExp(BAGLAC.source, 'gi')) || []).length, dol = (hepsi.match(DOLGU) || []).length, gh = gramer(hepsi).length;
      var akici = Math.min(5, Math.max(1, Math.round(ort / 4))), kelime = Math.min(5, Math.max(1, Math.round(cesit * 5 + bag * .3))), dilbil = Math.max(1, 5 - gh);
      var bar = function (ad, n, not) { return '<div class="kb"><span>' + ad + '</span><i style="--w:' + n * 20 + '%"></i><b>' + n + '/5</b><small>' + esc(not) + '</small></div>'; };
      giris.innerHTML = '<div class="karne">' + bar('Akıcılık', akici, 'cevap başına ~' + Math.round(ort) + ' kelime' + (dol ? ', ' + dol + ' dolgu sesi' : '')) + bar('Kelime', kelime, bag + ' bağlaç, ' + Math.round(cesit * 100) + '% çeşitlilik') + bar('Dilbilgisi', dilbil, gh ? gh + ' düzeltme' : 'hata görmedim') +
        '<div class="alt-satir"><span class="el">' + (akici + kelime + dilbil >= 11 ? 'Bugün iyi konuştun.' : 'Bir tur daha konuşalım mı?') + '</span><button class="btn sm" type="button">Yeni sohbet</button></div></div>';
      giris.querySelector('button').onclick = basla;
      h.soyle(akici + kelime + dilbil >= 11 ? 'That was a great conversation. Well done.' : 'Thanks for talking with me. Let’s practise again soon.', 'Karnen aşağıda.');
      if (cevaplar.length >= TUR) bitti(o.panel, el.closest('.hoca-kart') || el);
    }
    async function basla() { log.innerHTML = ''; gecmis = []; cevaplar = []; tur = 0; girisCiz(); await sor(o.sorular[0], o.ilk_tr); }
    giris.innerHTML = '<p class="hoca-giris">' + esc(o.giris_tr) + '</p><button class="btn ana" type="button">Sohbete başla</button>';
    giris.querySelector('button').onclick = basla;
    h.soyle(o.giris_en, '');
    return h;
  }

  /* ==========================================================================
     OTURUM 3 · birlikte yazma (Writing)
     ========================================================================== */
  var SOZLUK = [
    ['bence', 'In my view, …'], ['bana göre', 'In my opinion, …'], ['katılıyorum', 'I agree that …'], ['katılmıyorum', 'I disagree that …'],
    ['örneğin', 'For example, …'], ['mesela', 'For instance, …'], ['ayrıca', 'In addition, …'], ['bunun yanı sıra', 'Moreover, …'],
    ['öte yandan', 'On the other hand, …'], ['ancak', 'However, …'], ['fakat', 'However, …'], ['rağmen', 'Although …'], ['bu yüzden', 'Therefore, …'],
    ['bu nedenle', 'For this reason, …'], ['sonuç olarak', 'In conclusion, …'], ['kısacası', 'In short, …'], ['birçok kişi', 'Many people …'], ['çoğu öğrenci', 'Most students …'],
    ['önemli', 'It is important to …'], ['gerekli', 'It is essential to …'], ['zorunlu', 'compulsory'], ['devam zorunluluğu', 'compulsory attendance'], ['derse katılmak', 'attend classes'],
    ['etkilemek', 'have an effect on …'], ['fayda', 'benefit / advantage'], ['zarar', 'disadvantage / drawback'], ['özgürlük', 'freedom to choose'], ['sorumluluk', 'responsibility'],
    ['notlar', 'grades'], ['sınav', 'exam'], ['ders kaydı', 'lecture recording'], ['yüz yüze', 'face-to-face'], ['çevrimiçi', 'online'], ['zaman kazanmak', 'save time'], ['para', 'money / cost']
  ];
  var nrmTr = function (s) { return String(s || '').toLocaleLowerCase('tr').replace(/[^a-zçğıöşü ]/g, ' ').replace(/\s+/g, ' ').trim(); };
  var ADIM = [
    { ad: 'konu cümlesi', en: 'Start with a topic sentence. Tell me your position clearly.', tr: 'Görüşünü açıkça söyleyen bir konu cümlesiyle başla.', r: /\b(should|shouldn't|agree|disagree|believe|in my (view|opinion)|i think|it is (better|essential|unfair|important|wrong|right))\b/i, eksik: 'Tarafını açıkça söyle: should / I believe / In my view…' },
    { ad: 'birinci gerekçe', en: 'Good. Now give me your first reason.', tr: 'İlk gerekçeni yaz.', r: /\b(because|since|one reason|firstly|first of all|the main reason|as a result)\b/i, eksik: 'Gerekçe bağlacı kullan: because, since, Firstly…' },
    { ad: 'örnek', en: 'Support it with an example.', tr: 'Bir örnekle destekle.', r: /\b(for example|for instance|such as|to illustrate)\b/i, eksik: '“For example” ya da “For instance” ile başla.' },
    { ad: 'ikinci gerekçe ya da karşı görüş', en: 'Add a second reason, or mention the other side.', tr: 'İkinci bir gerekçe ekle ya da karşı görüşe değin.', r: /\b(moreover|in addition|furthermore|also|however|on the other hand|although|while|secondly|another)\b/i, eksik: 'Moreover / In addition / However ile bağla.' },
    { ad: 'sonuç', en: 'Finish with a concluding sentence.', tr: 'Bir sonuç cümlesiyle bitir.', r: /\b(therefore|in conclusion|overall|to sum up|for these reasons|thus|this is why|in short)\b/i, eksik: 'In conclusion / Therefore / Overall ile toparla.' }
  ];
  function cumleDenetle(c, adim) {
    var notlar = [], say = kelimeSay(c);
    if (say < 4) return { sonuc: 'yanlis', notlar: [{ parca: c, tr: 'Çok kısa; tam bir cümle kur.' }] };
    if (adim && !adim.r.test(c)) notlar.push({ parca: '', tr: adim.eksik, isaret: true });
    gramer(c).forEach(function (g) { notlar.push({ parca: g.parca, tr: g.tr, oneri: g.oneri }); });
    if (/^\s*because\b/i.test(c) && c.indexOf(',') < 0) notlar.push({ parca: c.trim().split(' ')[0], tr: '“Because …” tek başına cümle olmaz; önceki cümleye bağla ya da “One reason is that …” ile başla.', oneri: 'One reason is that …' });
    if (!/^[A-Z“"']/.test(c.trim())) notlar.push({ parca: c.trim().split(' ')[0], tr: 'Cümle büyük harfle başlar.' });
    if (!/[.!?]["”']?$/.test(c.trim())) notlar.push({ parca: '', tr: 'Sonuna nokta koy.' });
    if (say > 35) notlar.push({ parca: '', tr: 'Çok uzun; iki cümleye böl.' });
    var very = (c.match(/\bvery\b/gi) || []).length; if (very) notlar.push({ parca: 'very', tr: '“very” yerine daha net bir kelime: very important → crucial.', oneri: 'crucial / significant' });
    return { sonuc: !notlar.length ? 'dogru' : notlar.some(function (n) { return n.isaret; }) || notlar.length > 1 ? 'kismen' : 'kismen', notlar: notlar };
  }
  function yazi(el, o) {
    el.innerHTML = '<div class="hoca-duzen"><div class="hoca-sahne-yer"></div><div class="hoca-is kagit yazi-is"><div class="hoca-ust"><span class="etiket">' + esc(o.baslik) + '</span><span class="say adim-say"></span></div>' +
      '<div class="konu-sec"></div><div class="defter-sayfa" lang="en"></div><div class="yazi-giris"></div>' +
      '<details class="nasil"><summary>Acadia: “Bunu İngilizce nasıl derim?”</summary><div class="nasil-ic"><label class="gizli" for="nsl">Türkçe ifade</label><input type="text" id="nsl" placeholder="örn. bence, devam zorunluluğu, öte yandan…"><button class="btn sm" type="button">Sor</button></div><div class="nasil-sonuc"></div></details></div></div>';
    var h = sahne(el.querySelector('.hoca-sahne-yer')), sayfa = el.querySelector('.defter-sayfa'), giris = el.querySelector('.yazi-giris'), adimSay = el.querySelector('.adim-say'), konuEl = el.querySelector('.konu-sec');
    var ki = 0, adim = 0, cumleler = [], sonuclar = [], yeniden = null, taslak1 = null;
    function konuCiz() { konuEl.innerHTML = '<p><b>Konu:</b> <span lang="en">' + esc(o.konular[ki]) + '</span> <button class="btn sm" type="button">Başka konu</button></p>'; konuEl.querySelector('button').onclick = function () { ki = (ki + 1) % o.konular.length; baslat(); }; }
    function sayfaCiz() {
      sayfa.innerHTML = cumleler.map(function (c, i) {
        var r = sonuclar[i] || { notlar: [] }, metin = esc(c);
        r.notlar.forEach(function (n) { if (n.parca && n.parca.length < c.length) metin = metin.replace(esc(n.parca), '<u class="hata-alt">' + esc(n.parca) + '</u>'); });
        return '<span class="cumle ' + (r.sonuc || '') + (yeniden === i ? ' secili' : '') + '" data-i="' + i + '">' + metin + '<sup>' + (i + 1) + '</sup></span>';
      }).join(' ') + (cumleler.length ? '' : '<span class="bos">Paragrafın burada birikecek.</span>');
      var notlar = []; sonuclar.forEach(function (r, i) { (r.notlar || []).forEach(function (n) { notlar.push('<li><b>' + (i + 1) + '</b>' + esc(n.tr) + (n.oneri ? ' <span lang="en">→ ' + esc(n.oneri) + '</span>' : '') + '</li>'); }); });
      if (notlar.length) sayfa.insertAdjacentHTML('beforeend', '<ul class="kenar-not">' + notlar.join('') + '</ul>');
    }
    function girisCiz(yer) {
      giris.innerHTML = '<label class="gizli" for="yz-in">Cümlen</label><textarea id="yz-in" rows="2" lang="en" spellcheck="true" placeholder="' + esc(yer) + '"></textarea><div class="alt-satir"><span class="say">' + (yeniden != null ? 'yeniden yazım' : 'cümle ' + (adim + 1) + ' / ' + ADIM.length) + '</span><button class="btn sm ana" type="button">Hocaya göster</button></div>';
      var ta = giris.querySelector('textarea'); giris.querySelector('button').onclick = function () { gonder(ta.value.trim()); };
      ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); gonder(ta.value.trim()); } });
      ta.focus({ preventScroll: true });
    }
    async function adimBaslat() { var a = ADIM[adim]; adimSay.textContent = a.ad; girisCiz(a.ad + '…'); h.tahta((adim + 1) + '. ' + a.ad, ''); await h.soyle(a.en, a.tr); }
    async function gonder(c) {
      if (!c) return; giris.querySelectorAll('button,textarea').forEach(function (b) { b.disabled = true; });
      var a = yeniden != null ? ADIM[Math.min(yeniden, ADIM.length - 1)] : ADIM[adim], r = cumleDenetle(c, a);
      if (r.sonuc !== 'yanlis') {
        h.dusun(true);
        var ai = await yz('yazi', { gorev: o.konular[ki], adim: a.ad, onceki: cumleler.slice(0, yeniden != null ? yeniden : cumleler.length), cumle: c });
        h.dusun(false);
        if (ai && /^(dogru|kismen|yanlis)$/.test(ai.sonuc)) {
          var ek = (ai.notlar || []).slice(0, 3).map(function (n) { return { parca: String(n.parca || ''), tr: String(n.not_tr || n.tr || ''), oneri: String(n.oneri || '') }; }).filter(function (n) { return n.tr; });
          r = { sonuc: ai.sonuc, notlar: ek.length || ai.sonuc === 'dogru' ? ek : r.notlar, en: ai.tepki_en };
        }
      }
      h.tepki(r.sonuc);
      if (yeniden != null) return yenidenBitti(c, r);
      cumleler.push(c); sonuclar.push(r); sayfaCiz();
      await h.soyle(r.en || (r.sonuc === 'dogru' ? rasgele(['Nice sentence.', 'Good, that works.', 'Clear and correct.']) : r.sonuc === 'kismen' ? 'Okay. Look at my note in the margin.' : 'Let’s write a full sentence.'), r.notlar.length ? 'Kenara not düştüm.' : '');
      if (r.sonuc === 'yanlis') { cumleler.pop(); sonuclar.pop(); sayfaCiz(); girisCiz(a.ad + '…'); giris.querySelector('textarea').value = c; return; }
      adim++;
      if (adim < ADIM.length) return adimBaslat();
      /* yeniden yazdırma: en çok notu olan cümle */
      var en = 0; sonuclar.forEach(function (x, i) { if ((x.notlar || []).length > (sonuclar[en].notlar || []).length) en = i; });
      yeniden = en; taslak1 = cumleler.slice(); sayfaCiz(); adimSay.textContent = 'yeniden yazım';
      girisCiz('', true); giris.querySelector('textarea').value = cumleler[en];
      h.temizle(); h.tahta('rewrite #' + (en + 1), 'sari');
      await h.soyle('Now, let’s improve sentence ' + (en + 1) + '. Rewrite it.', (en + 1) + '. cümleyi notlara bakarak yeniden yaz.');
    }
    async function yenidenBitti(c, r) {
      var i = yeniden; cumleler[i] = c; sonuclar[i] = r; yeniden = null; sayfaCiz();
      var once = taslak1.map(function (x, k) { return k === i ? '<del>' + esc(x) + '</del>' : esc(x); }).join(' '), sonra = cumleler.map(function (x, k) { return k === i ? '<ins>' + esc(x) + '</ins>' : esc(x); }).join(' ');
      giris.innerHTML = '<div class="taslaklar"><div><span class="etiket">1. taslak</span><p lang="en">' + once + '</p></div><div><span class="etiket">2. taslak</span><p lang="en">' + sonra + '</p></div></div><div class="alt-satir"><span class="el">' + (r.sonuc === 'dogru' ? 'Daha güçlü oldu.' : 'Bir kez daha denemek ister misin?') + '</span><button class="btn sm" type="button">Yeni paragraf</button></div>';
      giris.querySelector('button').onclick = baslat;
      await h.soyle(r.sonuc === 'dogru' ? 'Much better. Compare the two drafts.' : 'Better, but still one thing to fix.', 'İki taslağı yan yana koydum.');
      bitti(o.panel, el.closest('.hoca-kart') || el);
    }
    var nasil = el.querySelector('.nasil'), nIn = nasil.querySelector('input'), nOut = nasil.querySelector('.nasil-sonuc');
    async function nasilSor() {
      var q = nrmTr(nIn.value); if (!q) return;
      var bul = SOZLUK.filter(function (x) { return q.indexOf(x[0]) > -1 || x[0].indexOf(q) > -1; }).slice(0, 4).map(function (x) { return { en: x[1], tr: x[0] }; });
      if (!bul.length) { nOut.innerHTML = '<p class="say">Acadia düşünüyor…</p>'; var ai = await yz('nasil', { tr: nIn.value.trim() }); if (ai && Array.isArray(ai.oneriler)) bul = ai.oneriler.slice(0, 4).map(function (x) { return { en: String(x.en || ''), tr: String(x.not_tr || '') }; }).filter(function (x) { return x.en; }); }
      nOut.innerHTML = bul.length ? bul.map(function (x) { return '<button type="button" class="oneri" lang="en" data-en="' + esc(x.en) + '">' + esc(x.en) + (x.tr ? ' <small>' + esc(x.tr) + '</small>' : '') + '</button>'; }).join('') : '<p class="say">Bunu bulamadım; daha kısa yazmayı dene.</p>';
      if (bul.length) h.fisilda(bul[0].en, false);
    }
    nasil.querySelector('button').onclick = nasilSor; nIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); nasilSor(); } });
    nOut.addEventListener('click', function (e) { var b = e.target.closest('.oneri'); if (!b) return; var ta = giris.querySelector('textarea'); if (ta && !ta.disabled) { ta.value = (ta.value ? ta.value.replace(/\s*$/, ' ') : '') + b.dataset.en.replace(/…/g, '').trim() + ' '; ta.focus(); } });
    function baslat() { cumleler = []; sonuclar = []; adim = 0; yeniden = null; h.temizle(); konuCiz(); sayfaCiz(); adimBaslat(); }
    giris.innerHTML = '<p class="hoca-giris">' + esc(o.giris_tr) + '</p><button class="btn ana" type="button">Birlikte yazalım</button>';
    giris.querySelector('button').onclick = baslat; konuCiz(); sayfaCiz();
    h.soyle(o.giris_en, '');
    return h;
  }

  W.HOCA = { sahne: sahne, degerlendir: degerlendir, gramer: gramer, yz: yz, soruTuru: soruTuru, sohbet: sohbet, yazi: yazi, dikteDegerlendir: dikteDegerlendir, kelimeDegerlendir: kelimeDegerlendir, cumleDenetle: cumleDenetle, norm: norm, _yzKapat: function () { yzKapali = true; } };
})();
