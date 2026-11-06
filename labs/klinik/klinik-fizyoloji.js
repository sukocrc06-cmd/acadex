/* ==========================================================================
   ACADEX KLİNİK · canlı hasta fizyolojisi, muayene bulguları ve serbest soru eşleme
   (labs/klinik/klinik-fizyoloji.js), 06.11.2026 · DOM'suz, saf fonksiyonlar (node'da test edilir)

   1) Fizyoloji: vaka başındaki vitallerden (nabız, TA, SpO₂, varsa solunum ve ateş) bir durum kurar.
      Hasta tedavisiz kalırsa örüntüsüne göre (hipoksi, şok, taşikardi/ağrı, ateş) yavaşça kötüleşir;
      doğru karar ve endikasyonu olan müdahale (O₂, sıvı, analjezi, ateş düşürücü, pozisyon) hastayı
      hedefe doğru düzeltir. Sınırlar gerçekçi tutulur; ölüm yok, "kritik" eşiğinde uyarı verilir.
      NEWS2 (Royal College of Physicians, 2017) puanı her an hesaplanır.
   2) Bulgular: senaryonun kendi metninden (muayene sonuçları, cevaplar) oskültasyon ve palpasyon
      bulgusu çıkarır: üfürüm, düzensiz ritim, ral, wheezing, azalmış ses, karın kadranı hassasiyeti.
   3) Serbest soru: öğrencinin kendi yazdığı/söylediği soruyu senaryonun hazır sorularıyla eşler
      (yapay zekâ yokken ya da yanıt gelmezse yedek; puanlama aynı kalır).
   Eğitim amaçlıdır; tanı ve tedavi önerisi değildir.
   ========================================================================== */
(function (root, factory) {
  var F = factory();
  if (typeof module === 'object' && module.exports) module.exports = F; else root.AXFIZ = F;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var F = {};
  var kis = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var sayi = function (v) { var n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : null; };

  /* ---------------- 1) fizyoloji ---------------- */
  F.NORMAL = { hr: 82, sys: 120, dia: 76, spo2: 97, rr: 16, ates: 36.8 };
  F.SINIR = { hr: [30, 170], sys: [62, 220], spo2: [78, 100], rr: [6, 38], ates: [34.5, 41.2] };

  F.kur = function (vital) {
    vital = vital || {};
    var ta = String(vital.ta || '').split('/'), sys = sayi(ta[0]), dia = sayi(ta[1]);
    var st = {
      hr: sayi(vital.nabiz), sys: sys, dia: dia, spo2: sayi(vital.spo2), rr: sayi(vital.solunum != null ? vital.solunum : vital.ss),
      ates: sayi(vital.ates), ritim: vital.ritim === 'duzensiz' ? 'duzensiz' : 'duzenli',
      stabil: {}, kritikSn: 0, sure: 0, uygun: 0, uygunsuz: 0, yapilan: {}, hiz: 1
    };
    /* eksik değerler örüntüden türetilir: hipoksik hasta hızlı solur, ağır taşikardide solunum da artar */
    if (st.rr == null) st.rr = st.spo2 != null && st.spo2 < 92 ? 26 : st.spo2 != null && st.spo2 < 95 ? 21 : st.hr != null && st.hr > 120 ? 22 : 16;
    if (st.ates == null) st.ates = F.NORMAL.ates;
    if (st.dia == null && st.sys != null) st.dia = Math.round(st.sys * 0.62);
    st.ilk = { hr: st.hr, sys: st.sys, spo2: st.spo2, rr: st.rr, ates: st.ates };
    st.orunt = F.oruntu(st);
    return st;
  };

  /* hangi yöne kötüleşir: en ağır sorun önce */
  F.oruntu = function (st) {
    var o = [];
    if (st.spo2 != null && st.spo2 < 94) o.push('hipoksi');
    if (st.sys != null && (st.sys < 100 || (st.hr != null && st.hr > 110 && st.sys < 115))) o.push('sok');
    if (st.ates >= 38.3) o.push('ates');
    if (st.hr != null && st.hr > 110 && o.indexOf('sok') < 0) o.push('tasikardi');
    if (st.sys != null && st.sys >= 180) o.push('hipertansiyon');
    if (st.hr != null && st.hr < 50) o.push('bradikardi');
    return o;
  };

  /* NEWS2: solunum, SpO₂ (ölçek 1), sistolik TA, nabız, ateş (bilinç ve O₂ desteği burada yok) */
  F.news2 = function (st) {
    var p = 0, rr = st.rr, s = st.spo2, sb = st.sys, hr = st.hr, t = st.ates;
    if (rr != null) p += rr <= 8 ? 3 : rr <= 11 ? 1 : rr <= 20 ? 0 : rr <= 24 ? 2 : 3;
    if (s != null) p += s <= 91 ? 3 : s <= 93 ? 2 : s <= 95 ? 1 : 0;
    if (sb != null) p += sb <= 90 ? 3 : sb <= 100 ? 2 : sb <= 110 ? 1 : sb <= 219 ? 0 : 3;
    if (hr != null) p += hr <= 40 ? 3 : hr <= 50 ? 1 : hr <= 90 ? 0 : hr <= 110 ? 1 : hr <= 130 ? 2 : 3;
    if (t != null) p += t <= 35 ? 3 : t <= 36 ? 1 : t <= 38 ? 0 : t <= 39 ? 1 : 2;
    return p;
  };
  F.risk = function (p) { return p >= 7 ? 'yüksek' : p >= 5 ? 'orta' : p >= 1 ? 'düşük' : 'yok'; };
  F.kritik = function (st) { return F.news2(st) >= 9 || (st.spo2 != null && st.spo2 < 86) || (st.sys != null && st.sys < 80) || (st.hr != null && st.hr > 150); };

  var yaklas = function (st, k, hedef, dt, tau) { if (st[k] == null) return; st[k] += (hedef - st[k]) * (1 - Math.exp(-dt / tau)); };
  /* dt: saniye. Tedavisiz örüntü kötüleşir (dakikada birkaç birim); düzeltilen örüntü hedefe yaklaşır. */
  F.ilerle = function (st, dt) {
    dt = (dt || 1) * (st.hiz || 1); st.sure += dt;
    var d = dt / 60, has = function (k) { return st.orunt.indexOf(k) >= 0 && !st.stabil[k]; };
    if (has('hipoksi')) { st.spo2 -= 1.1 * d; st.rr += 1.4 * d; st.hr += 2.2 * d; }
    if (has('sok')) { st.sys -= 3.2 * d; st.dia -= 1.8 * d; st.hr += 3 * d; st.rr += 0.8 * d; }
    if (has('ates')) { st.ates += 0.08 * d; st.hr += 1 * d; }
    if (has('tasikardi')) { st.hr += 1.2 * d; }
    if (has('hipertansiyon')) { st.sys += 1.5 * d; }
    /* düzeltilenler: hedefe üstel yaklaşma (≈ yarım dakikada belirgin) */
    var S = st.stabil;
    if (S.hipoksi) { yaklas(st, 'spo2', S.hipoksi, dt, 30); yaklas(st, 'rr', 18, dt, 45); }
    if (S.sok) { yaklas(st, 'sys', S.sok, dt, 40); yaklas(st, 'dia', Math.round(S.sok * 0.62), dt, 40); yaklas(st, 'hr', Math.min(st.hr, 98), dt, 50); }
    if (S.ates) { yaklas(st, 'ates', 37.4, dt, 90); }
    if (S.tasikardi) { yaklas(st, 'hr', S.tasikardi, dt, 40); }
    if (S.hipertansiyon) { yaklas(st, 'sys', 158, dt, 60); }
    ['hr', 'sys', 'spo2', 'rr', 'ates'].forEach(function (k) { if (st[k] != null) st[k] = kis(st[k], F.SINIR[k][0], F.SINIR[k][1]); });
    if (st.dia != null) st.dia = kis(st.dia, 34, 130);
    if (F.kritik(st) && st.sure > 45) st.kritikSn += dt;           /* ilk 45 sn değerlendirme payı */
    return st;
  };

  /* vaka adımları vitali açıkça değiştirirse durum ona uyar */
  F.ayarla = function (st, vital) {
    var y = F.kur(Object.assign({ nabiz: st.hr, ta: st.sys != null ? Math.round(st.sys) + '/' + Math.round(st.dia) : null, spo2: st.spo2, solunum: st.rr, ates: st.ates }, vital || {}));
    ['hr', 'sys', 'dia', 'spo2', 'rr', 'ates', 'ritim'].forEach(function (k) { st[k] = y[k]; });
    st.orunt = F.oruntu(st); return st;
  };
  /* doğru klinik karar: tüm örüntüler kısmen düzelir; yanlış karar: kötüleşme hızlanır */
  F.karar = function (st, dogru) {
    if (dogru) { st.orunt.forEach(function (k) { if (!st.stabil[k]) st.stabil[k] = HEDEF[k]; }); st.hiz = 1; }
    else st.hiz = Math.min(2.2, (st.hiz || 1) + 0.6);
    return st;
  };
  var HEDEF = { hipoksi: 95, sok: 108, ates: 1, tasikardi: 96, hipertansiyon: 1, bradikardi: 1 };

  F.MUDAHALE = [
    { k: 'o2', ad: 'O₂ ver', uzun: 'Nazal kanül / maske ile oksijen' },
    { k: 'sivi', ad: 'Damar yolu + sıvı', uzun: 'Damar yolu aç, izotonik sıvı bolus' },
    { k: 'analjezi', ad: 'Analjezi', uzun: 'Ağrı kesici (hekim istemiyle)' },
    { k: 'ates', ad: 'Ateş düşürücü', uzun: 'Antipiretik + soğuk uygulama' },
    { k: 'poz', ad: 'Yarı oturur pozisyon', uzun: 'Yatak başını 30–45° kaldır' }
  ];
  /* müdahale: endikasyonu varsa etki + olumlu geri bildirim; yoksa gereksiz (puan cezası) */
  F.uygula = function (st, k, o) {
    o = o || {};
    if (st.yapilan[k]) return { uygun: null, mesaj: 'Bu müdahale zaten yapıldı; etkisini monitörden izle.' };
    st.yapilan[k] = st.sure;
    var r;
    if (k === 'o2') r = st.spo2 != null && st.spo2 < 94 ? (st.stabil.hipoksi = 96, { uygun: true, mesaj: 'Oksijen başladı. SpO₂ hedefi %94–98 (KOAH varsa %88–92).' }) : { uygun: false, mesaj: 'SpO₂ normalken oksijen gereksiz; hiperoksi de zararlıdır.' };
    else if (k === 'sivi') r = st.sys != null && (st.sys < 100 || (st.hr > 110 && st.sys < 115)) ? (st.stabil.sok = 110, { uygun: true, mesaj: 'Damar yolu açıldı, sıvı bolusu gidiyor. TA ve nabzı yeniden değerlendir.' }) : { uygun: false, mesaj: 'Hemodinami stabil; sıvı bolusu bu hastada endike değil (kalp yetmezliğinde zararlı olabilir).' };
    else if (k === 'analjezi') r = o.agri ? (st.stabil.tasikardi = Math.min(st.hr, 92), { uygun: true, mesaj: 'Ağrı kesici verildi; ağrıya bağlı taşikardi geriliyor. Ağrıyı ölçekle yeniden sor.' }) : { uygun: false, mesaj: 'Belirgin ağrı yokken analjezi gereksiz; bulguları maskeleyebilir.' };
    else if (k === 'ates') r = st.ates >= 38 ? (st.stabil.ates = 1, { uygun: true, mesaj: 'Antipiretik verildi; ateşin nedenini (enfeksiyon odağı) araştırmayı unutma.' }) : { uygun: false, mesaj: 'Ateş yokken antipiretik gereksiz.' };
    else if (k === 'poz') r = (st.spo2 != null && st.spo2 < 95) || st.rr > 22 ? (st.spo2 = Math.min(100, st.spo2 + 1), st.rr = Math.max(12, st.rr - 2), { uygun: true, mesaj: 'Yarı oturur pozisyon solunumu rahatlattı.' }) : { uygun: true, notr: true, mesaj: 'Hasta rahat; pozisyon değişikliği zarar vermez.' };
    else r = { uygun: false, mesaj: 'Bilinmeyen müdahale.' };
    if (r.uygun && !r.notr) st.uygun++; else if (r.uygun === false) st.uygunsuz++;
    return r;
  };
  /* hasta güvenliği puanı: kritik geçen süre ve gereksiz müdahaleler düşürür, uygun müdahale artırır */
  F.guvenlik = function (st) {
    var p = 100 - Math.round(st.kritikSn / 6) - st.uygunsuz * 10 + Math.min(10, st.uygun * 4);
    var son = F.news2(st), ilk = F.news2(Object.assign({}, st, st.ilk));
    if (son > ilk) p -= (son - ilk) * 5; else p += Math.min(10, (ilk - son) * 3);
    return kis(Math.round(p), 0, 100);
  };
  /* monitöre yazılacak değerler */
  F.vital = function (st) {
    return { nabiz: st.hr != null ? Math.round(st.hr) : null, ta: st.sys != null ? Math.round(st.sys) + '/' + Math.round(st.dia) : null, spo2: st.spo2 != null ? Math.round(st.spo2) : null, solunum: Math.round(st.rr), ates: Math.round(st.ates * 10) / 10, ritim: st.ritim };
  };

  /* ---------------- 2) bulgular ---------------- */
  var metin = function (sen) {
    var t = [sen.baslik || '', sen.odaAd || ''];
    (sen.adimlar || []).forEach(function (a) {
      if (a.metin) t.push(a.metin); if (a.soru) t.push(a.soru);
      (a.secenek || []).forEach(function (o) { t.push(o.t || '', o.cevap || '', o.sonuc || '', o.geri || ''); });
    });
    return t.join(' \n ').toLocaleLowerCase('tr');
  };
  F.bulgular = function (sen) {
    var t = metin(sen), v = sen.vital || {}, has = function (re) { return re.test(t); };
    var b = { kalp: { tip: 'normal' }, akciger: { sag: 'normal', sol: 'normal', tip: 'normal' }, karin: { hassas: null, tip: 'normal' } };
    if (v.ritim === 'duzensiz' || has(/atriyal fibrilasyon|(^|[^a-zçğıöşü])af([^a-zçğıöşü]|$)|düzensiz (nabız|ritim)|nabız düzensiz/)) b.kalp.tip = 'duzensiz';
    if (has(/üfürüm|stenoz|yetmezliği üfür|ejeksiyon sesi/)) { b.kalp.ufurum = true; b.kalp.odak = has(/aort/) ? 'aort' : has(/mitral/) ? 'mitral' : has(/pulmon(er|ik) (kapak|stenoz)/) ? 'pulmoner' : 'mitral'; }
    var SAG = /(^|[^a-zçğıöşü])sağ(da|daki|ında)?([^a-zçğıöşü]|$)/, SOL = /(^|[^a-zçğıöşü])sol(da|daki|unda)?([^a-zçğıöşü]|$)/;
    var yon = function (re) { var m = t.match(re); if (!m) return null; var s = m[0], a = SAG.test(s), c = SOL.test(s); return a && c ? 'iki' : a ? 'sag' : c ? 'sol' : 'iki'; };
    var akc = function (tip, re) { var y = yon(re); if (y == null) return; b.akciger.tip = tip; if (y === 'sag' || y === 'iki') b.akciger.sag = tip; if (y === 'sol' || y === 'iki') b.akciger.sol = tip; };
    akc('wheezing', /[^.\n]{0,60}(wheez|hışıltı|ronküs|sibilan)[^.\n]{0,60}/);
    akc('ral', /[^.\n]{0,60}(raller|ince ral|kaba ral|bazal ral|krepitan ral|akciğerde krepitan)[^.\n]{0,60}/);
    akc('azalmis', /[^.\n]{0,60}(solunum sesleri? azal|ses(ler)?i azalmış|sessiz akciğer|pnömotoraks|plevral efüzyon)[^.\n]{0,60}/);
    var kad = [['sag-alt', /sağ alt kadran|mcburney|apandis/], ['sag-ust', /sağ üst kadran|murphy|safra kesesi|kolesist/], ['epigastrium', /epigastri|pankreat|peptik/], ['sol-alt', /sol alt kadran|divertikül/], ['sol-ust', /sol üst kadran|dalak/], ['yaygin', /yaygın (karın )?hassasiyet|peritonit|defans|rebound/]];
    for (var i = 0; i < kad.length; i++) if (has(kad[i][1])) { b.karin.hassas = kad[i][0]; b.karin.tip = has(/defans|rebound|peritonit/) ? 'peritonit' : 'hassas'; break; }
    if (has(/barsak sesleri (azal|yok)|ileus/)) b.karin.ses = 'azalmis'; else if (has(/barsak sesleri art|hiperaktif/)) b.karin.ses = 'artmis';
    /* senaryo açıkça yazdıysa o geçerli: muayene: { kalp:{…}, akciger:{sag, sol}, karin:{hassas, tip, ses} } */
    var m = sen.muayene; if (m) ['kalp', 'akciger', 'karin'].forEach(function (k) { if (m[k]) Object.assign(b[k], m[k]); });
    if (m && m.akciger) b.akciger.tip = b.akciger.sag !== 'normal' ? b.akciger.sag : b.akciger.sol;
    return b;
  };
  /* bir odak/bölge için okunabilir bulgu satırı */
  F.BOLGE = {
    aort: 'Aort odağı', pulmoner: 'Pulmoner odak', trikuspit: 'Triküspit odağı', mitral: 'Mitral odak',
    'akc-sag-ust': 'Sağ akciğer üst zon', 'akc-sol-ust': 'Sol akciğer üst zon', 'akc-sag-alt': 'Sağ akciğer alt zon', 'akc-sol-alt': 'Sol akciğer alt zon',
    'sag-ust': 'Sağ üst kadran', 'sol-ust': 'Sol üst kadran', epigastrium: 'Epigastrium', 'sag-alt': 'Sağ alt kadran', 'sol-alt': 'Sol alt kadran'
  };
  F.dinle = function (b, z) {
    if (/^(aort|pulmoner|trikuspit|mitral)$/.test(z)) {
      var k = b.kalp, s = k.tip === 'duzensiz' ? 'S1–S2 düzensiz aralıklarla, nabız defisiti olabilir' : 'S1–S2 ritmik, ek ses yok';
      if (k.ufurum) s += z === k.odak ? '; bu odakta en iyi duyulan sistolik üfürüm (2–3/6)' : '; uzaktan hafif sistolik üfürüm';
      return { ses: 'kalp', tip: k.tip, ufurum: !!k.ufurum && (z === k.odak ? 1 : 0.35), metin: s };
    }
    if (/^akc-/.test(z)) {
      var taraf = /sag/.test(z) ? 'sag' : 'sol', alt = /alt/.test(z), tip = b.akciger[taraf];
      if (tip === 'ral' && !alt) tip = 'normal';                       /* raller çoğunlukla bazallerde */
      var M = { normal: 'Veziküler solunum sesi, ek ses yok', wheezing: 'Ekspiryumda yaygın sibilan ronküs (wheezing), ekspiryum uzamış', ral: 'İnspiryum sonunda ince raller (krepitan)', azalmis: 'Solunum sesleri belirgin azalmış' };
      return { ses: 'akciger', tip: tip, metin: M[tip] };
    }
    var ka = b.karin;
    return { ses: 'karin', tip: ka.ses || 'normal', metin: ka.ses === 'azalmis' ? 'Barsak sesleri azalmış' : ka.ses === 'artmis' ? 'Barsak sesleri artmış (hiperaktif)' : 'Barsak sesleri normoaktif' };
  };
  F.palpe = function (b, z) {
    var h = b.karin.hassas, tam = h === z || h === 'yaygin' || (h === 'sag-alt' && z === 'sag-alt');
    if (!/^(sag-ust|sol-ust|epigastrium|sag-alt|sol-alt)$/.test(z)) return { agri: false, metin: 'Bu bölge palpasyonla değerlendirilmez; karın kadranlarını dene.' };
    if (tam) return { agri: true, siddet: b.karin.tip === 'peritonit' ? 2 : 1, metin: b.karin.tip === 'peritonit' ? 'Belirgin hassasiyet, istemsiz defans ve rebound; hasta yüzünü buruşturdu.' : 'Derin palpasyonla hassasiyet; defans yok. Hasta ağrıyla irkildi.' };
    if (h && h !== z) return { agri: false, metin: 'Yumuşak; bu kadranda hassasiyet yok' + (h === 'sag-alt' && z === 'sol-alt' ? ' ama bastırınca sağ altta ağrı oluyor (Rovsing)' : '') + '.', rovsing: h === 'sag-alt' && z === 'sol-alt' };
    return { agri: false, metin: 'Karın yumuşak, hassasiyet ve organomegali yok.' };
  };

  /* ---------------- 3) serbest soru eşleme ---------------- */
  var NORM = function (s) {
    return String(s || '').toLocaleLowerCase('tr').replace(/[’'`´]/g, ' ').replace(/[^a-zçğıöşü0-9 ]+/g, ' ')
      .replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ö/g, 'o').replace(/ü/g, 'u');
  };
  var BOS = { mi: 1, mu: 1, misiniz: 1, musunuz: 1, var: 1, ve: 1, ile: 1, bir: 1, bu: 1, su: 1, ne: 1, nasil: 1, nedir: 1, sizin: 1, siz: 1, sen: 1, acaba: 1, peki: 1, olarak: 1, icin: 1, da: 1, de: 1, ki: 1, hic: 1, oldu: 1, oluyor: 1, mudur: 1, midir: 1, sey: 1, gibi: 1, daha: 1, ya: 1, ben: 1, size: 1, sorabilir: 1, miyim: 1 };
  /* Türkçe ekler yüzünden kök: ilk 4 harf (ağrı/ağrınız, başladı/başladığı aynı köke düşer) */
  var kok = function (w) { return w.length > 4 ? w.slice(0, 4) : w; };
  F.kelimeler = function (s) { return NORM(s).split(/\s+/).filter(function (w) { return w.length > 1 && !BOS[w]; }).map(kok); };
  F.eslestir = function (soru, secenek) {
    var q = F.kelimeler(soru); if (!q.length) return null;
    var en = null;
    (secenek || []).forEach(function (o) {
      var w = F.kelimeler(o.t + ' ' + (o.anahtar || '')); if (!w.length) return;
      var ortak = q.filter(function (x) { return w.indexOf(x) >= 0; }).length;
      var skor = ortak / Math.sqrt(q.length * w.length);
      if (!en || skor > en.skor) en = { id: o.id, skor: skor, ortak: ortak };
    });
    return en && en.ortak >= 1 && en.skor >= 0.3 ? en : null;
  };
  /* iletişim geri bildirimi (OSCE): açık uçlu mu, kapalı mı, yönlendirici mi */
  F.soruTuru = function (soru) {
    var s = NORM(soru).trim();
    if (/^(neden|nasil|ne zaman|nerede|anlat|tarif|biraz|bana|ne gibi|neler|hangi)/.test(s) || /\banlat|\btarif/.test(s)) return 'acik';
    if (/\b(degil mi|oyle degil|herhalde|kesin)\b/.test(s)) return 'yonlendirici';
    return 'kapali';
  };
  return F;
});
