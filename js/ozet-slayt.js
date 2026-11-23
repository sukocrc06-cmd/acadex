/* ==========================================================================
   ACADEX — AKILLI ÇALIŞMA SLAYTLARI (js/ozet-slayt.js), 22.11.2026
   NEDEN VAR: Özeti PDF olarak indiren öğrenci, jsPDF'in düz A4 metin dökümünü
   alıyordu (appendStudyCardToDoc). Bu dosya özeti 16:9 "çalışma slaytı" olarak
   gösterir ve indirir: tek fikir = tek slayt, kartlar, tahmini önem yıldızı,
   İngilizce metnin altında kısa Türkçe satır, "sınavda böyle yaz" örnek cevabı,
   5 dakikalık son tekrar sayfası.
     - Slayt verisi (deste) sunucuda üretilir: supabase/functions/ozet-slayt
       (islem:'uret'), study_cards.slayt'ta saklanır; ikinci açılışta model yok.
     - Aynı HTML hem ekranda (görüntüleyici) hem PDF'te kullanılır.
     - PDF: sunucu Cloudflare Browser Run ile vektör PDF basar (islem:'pdf');
       sunucu kapalı / kota dolu ise tarayıcının "PDF olarak kaydet" penceresi.
     - Taşan slayt, gövdesi küçültülerek (zoom) sayfaya sığdırılır (sigdir).
   Dışa açılan: window.AcadexOzetSlayt = { ac, desteHtml, pdfBelgesi, normalize, CSS }
   Testler: tests/ozet-slayt.js
   ========================================================================== */
(function (W) {
  'use strict';
  if (W.AcadexOzetSlayt) return;

  var D = W.document;
  var GEN = 1280, YUK = 720;
  var FONT_URL = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Color+Emoji&display=swap';
  var TURLER = ['harita', 'kartlar', 'surec', 'tablo', 'ornek', 'sorular', 'tekrar'];
  var RENKLER = ['lacivert', 'turuncu', 'yesil', 'kirmizi'];
  var TUR_RENK = { harita: 'lacivert', kartlar: 'lacivert', surec: 'kirmizi', tablo: 'turuncu', ornek: 'yesil', sorular: 'kirmizi', tekrar: 'kirmizi' };

  /* ---------------- yardımcılar ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  /* **kalın** dışında biçim yok; önce kaçış, sonra işaret */
  function yaz(s) { return esc(s).replace(/\*\*([^*]+?)\*\*/g, '<b>$1</b>'); }
  function str(v, n) { return typeof v === 'string' ? v.trim().slice(0, n || 400) : (typeof v === 'number' ? String(v) : ''); }
  function dizi(v, n) { return Array.isArray(v) ? v.slice(0, n) : []; }
  function yildizSay(v) { var n = Math.round(+v || 0); return n < 0 ? 0 : (n > 3 ? 3 : n); }
  /* İngilizce parça İngilizce kuralla, Türkçe parça Türkçe kuralla büyür: CSS text-transform
     sayfa dili tr iken "MARKETİNG" yazıyordu. */
  function buyuk(en, trc) { return [String(en || '').toUpperCase(), String(trc || '').toLocaleUpperCase('tr')].filter(Boolean).join(' · '); }
  function yildiz(n) { n = yildizSay(n); return n ? ' <span class="oz-y" aria-label="' + n + ' yıldız">' + new Array(n + 1).join('⭐') + '</span>' : ''; }

  /* Model çıktısı bozuk gelse de çizim patlamasın: türü bilinmeyen slayt atılır,
     dizi alanları kırpılır, metinler dizgeye çevrilir. Sunucudaki normalize ile
     aynı sınırlar (supabase/functions/ozet-slayt/index.ts → desteNormalize). */
  function normalize(d) {
    d = d && typeof d === 'object' ? d : {};
    var not_ = function (n) { return n && typeof n === 'object' && str(n.metin) ? { tur: /^(uyari|bilgi)$/.test(n.tur) ? n.tur : 'ipucu', simge: str(n.simge, 8), baslik: str(n.baslik, 60), metin: str(n.metin, 360), tr: str(n.tr, 300) } : null; };
    var kart = function (k) { return { simge: str(k && k.simge, 8), baslik: str(k && k.baslik, 80), alt: str(k && k.alt, 40), maddeler: dizi(k && k.maddeler, 5).map(function (m) { return str(m, 160); }).filter(Boolean), metin: str(k && k.metin, 320), tr: str(k && k.tr, 220) }; };
    var out = {
      surum: 1,
      ders: str(d.ders, 80), baslik: str(d.baslik, 140) || 'Study Slides', baslik_tr: str(d.baslik_tr, 140),
      alt: str(d.alt, 140), simge: str(d.simge, 8) || '📘', ikidil: d.ikidil !== false, kaynak: str(d.kaynak, 140),
      slaytlar: []
    };
    dizi(d.slaytlar, 24).forEach(function (s) {
      if (!s || TURLER.indexOf(s.tur) < 0) return;
      var x = {
        tur: s.tur, renk: RENKLER.indexOf(s.renk) >= 0 ? s.renk : TUR_RENK[s.tur],
        etiket: str(s.etiket, 50), etiket_tr: str(s.etiket_tr, 50), baslik: str(s.baslik, 110), baslik_tr: str(s.baslik_tr, 140),
        yildiz: yildizSay(s.yildiz), not: not_(s.not)
      };
      if (s.tur === 'harita') x.ogeler = dizi(s.ogeler, 9).map(function (o) { return { simge: str(o && o.simge, 8), baslik: str(o && o.baslik, 70), tr: str(o && o.tr, 90), yildiz: yildizSay(o && o.yildiz) }; }).filter(function (o) { return o.baslik; });
      if (s.tur === 'kartlar') { x.kartlar = dizi(s.kartlar, 4).map(kart).filter(function (k) { return k.baslik; }); x.ornek = str(s.ornek, 420); }
      if (s.tur === 'surec') { x.adimlar = dizi(s.adimlar, 6).map(function (a) { return { baslik: str(a && a.baslik, 50), metin: str(a && a.metin, 160), tr: str(a && a.tr, 90), vurgu: !!(a && a.vurgu) }; }).filter(function (a) { return a.baslik; }); x.kartlar = dizi(s.kartlar, 2).map(kart).filter(function (k) { return k.baslik; }); }
      if (s.tur === 'tablo') {
        x.sutunlar = dizi(s.sutunlar, 4).map(function (c) { return str(c, 50); });
        var n = x.sutunlar.length || 2;
        x.satirlar = dizi(s.satirlar, 8).map(function (r) { return dizi(r, n).map(function (c) { return str(c, 150); }); }).filter(function (r) { return r.length && r[0]; });
        x.satir_tr = dizi(s.satir_tr, 8).map(function (t) { return str(t, 90); });
      }
      if (s.tur === 'ornek') {
        x.metin = str(s.metin, 1600);
        x.yan = s.yan && typeof s.yan === 'object' && (str(s.yan.baslik) || dizi(s.yan.maddeler, 1).length) ? { simge: str(s.yan.simge, 8), baslik: str(s.yan.baslik, 60), maddeler: dizi(s.yan.maddeler, 6).map(function (m) { return str(m, 120); }).filter(Boolean), tr: str(s.yan.tr, 200) } : null;
        x.ek = str(s.ek, 300);
      }
      if (s.tur === 'sorular') x.sorular = dizi(s.sorular, 6).map(function (q) { return { soru: str(q && q.soru, 220), tr: str(q && q.tr, 200), ipucu: str(q && q.ipucu, 200), yildiz: yildizSay(q && q.yildiz) }; }).filter(function (q) { return q.soru; });
      if (s.tur === 'tekrar') x.kutular = dizi(s.kutular, 12).map(function (k) { return { simge: str(k && k.simge, 8), baslik: str(k && k.baslik, 40), metin: str(k && k.metin, 170), tr: str(k && k.tr, 110) }; }).filter(function (k) { return k.baslik; });
      var bos = (x.tur === 'harita' && !x.ogeler.length) || (x.tur === 'kartlar' && !x.kartlar.length) || (x.tur === 'surec' && !x.adimlar.length) ||
        (x.tur === 'tablo' && !x.satirlar.length) || (x.tur === 'ornek' && !x.metin) || (x.tur === 'sorular' && !x.sorular.length) || (x.tur === 'tekrar' && !x.kutular.length);
      if (!bos && x.baslik) out.slaytlar.push(x);
    });
    return out;
  }

  /* ---------------- slayt parçaları ---------------- */
  function tr(t, iki) { return iki && t ? '<p class="oz-tr">' + yaz(t) + '</p>' : ''; }
  function notHtml(n, iki) {
    if (!n) return '';
    var simge = n.simge || (n.tur === 'uyari' ? '⚠️' : n.tur === 'bilgi' ? 'ℹ️' : '🎯');
    return '<div class="oz-not oz-not-' + n.tur + '"><span class="oz-not-s">' + esc(simge) + '</span><div><p>' + (n.baslik ? '<b>' + esc(n.baslik) + ':</b> ' : '') + yaz(n.metin) + '</p>' + tr(n.tr, iki) + '</div></div>';
  }
  function kartHtml(k, i, iki) {
    return '<article class="oz-kart oz-r-' + RENKLER[i % RENKLER.length] + '"><h3>' + (k.simge ? '<span class="oz-em">' + esc(k.simge) + '</span> ' : '') + yaz(k.baslik) + '</h3>' +
      (k.alt ? '<span class="oz-rozet">' + esc(k.alt) + '</span>' : '') +
      (k.metin ? '<p class="oz-m">' + yaz(k.metin) + '</p>' : '') +
      (k.maddeler.length ? '<ul>' + k.maddeler.map(function (m) { return '<li>' + yaz(m) + '</li>'; }).join('') + '</ul>' : '') +
      tr(k.tr, iki) + '</article>';
  }
  function paragraflar(metin) {
    return String(metin || '').split(/\n{2,}/).map(function (p) { return p.trim(); }).filter(Boolean).map(function (p) { return '<p>' + yaz(p).replace(/\n/g, '<br>') + '</p>'; }).join('');
  }

  var GOVDE = {
    harita: function (s, iki) {
      var n = s.ogeler.length, kol = n <= 4 ? 2 : (n <= 6 ? 3 : (n === 9 ? 3 : 4));
      return '<div class="oz-harita" style="grid-template-columns:repeat(' + kol + ',1fr)">' + s.ogeler.map(function (o, i) {
        return '<div class="oz-hk oz-r-' + RENKLER[i % RENKLER.length] + '"><span class="oz-hk-no">' + (i + 1) + '</span>' + (o.simge ? '<span class="oz-hk-s">' + esc(o.simge) + '</span>' : '') +
          '<div><b>' + yaz(o.baslik) + '</b>' + yildiz(o.yildiz) + tr(o.tr, iki) + '</div></div>';
      }).join('') + '</div>';
    },
    kartlar: function (s, iki) {
      return '<div class="oz-kartlar" style="grid-template-columns:repeat(' + s.kartlar.length + ',1fr)">' + s.kartlar.map(function (k, i) { return kartHtml(k, i, iki); }).join('') + '</div>' +
        (s.ornek ? '<div class="oz-ornek oz-ornek-kisa"><p>' + yaz(s.ornek) + '</p></div>' : '');
    },
    surec: function (s, iki) {
      return '<div class="oz-surec">' + s.adimlar.map(function (a, i) {
        return (i ? '<span class="oz-ok" aria-hidden="true">→</span>' : '') + '<div class="oz-adim' + (a.vurgu ? ' oz-vurgu' : '') + '"><h4><span class="oz-no">' + (i + 1) + '</span> ' + yaz(a.baslik) + (a.vurgu ? ' ⭐' : '') + '</h4>' +
          (a.metin ? '<p>' + yaz(a.metin) + '</p>' : '') + tr(a.tr, iki) + '</div>';
      }).join('') + '</div>' +
        (s.kartlar.length ? '<div class="oz-kartlar oz-kartlar-alt" style="grid-template-columns:repeat(' + s.kartlar.length + ',1fr)">' + s.kartlar.map(function (k, i) { return kartHtml(k, i + 3, iki); }).join('') + '</div>' : '');
    },
    tablo: function (s, iki) {
      return '<table class="oz-tablo"><thead><tr>' + s.sutunlar.map(function (c) { return '<th>' + yaz(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        s.satirlar.map(function (r, i) {
          return '<tr>' + r.map(function (c, j) { return '<td>' + (j ? yaz(c) : '<b>' + yaz(c) + '</b>' + (iki && s.satir_tr[i] ? '<small class="oz-tr">' + yaz(s.satir_tr[i]) + '</small>' : '')) + '</td>'; }).join('') + '</tr>';
        }).join('') + '</tbody></table>';
    },
    ornek: function (s, iki) {
      var yan = s.yan ? '<aside class="oz-yan"><h4>' + (s.yan.simge ? esc(s.yan.simge) + ' ' : '🧩 ') + yaz(s.yan.baslik) + '</h4>' + s.yan.maddeler.map(function (m) { return '<p>' + yaz(m) + '</p>'; }).join('') + tr(s.yan.tr, iki) + '</aside>' : '';
      var ek = s.ek ? '<div class="oz-ek">' + yaz(s.ek) + '</div>' : '';
      return '<div class="oz-ornek-izgara' + (yan || ek ? ' oz-iki' : '') + '"><div class="oz-ornek">' + paragraflar(s.metin) + '</div>' + (yan || ek ? '<div class="oz-yan-k">' + yan + ek + '</div>' : '') + '</div>';
    },
    sorular: function (s, iki) {
      return '<ol class="oz-sorular' + (s.sorular.length > 3 ? ' oz-iki' : '') + '">' + s.sorular.map(function (q, i) {
        return '<li><span class="oz-no">' + (i + 1) + '</span><div><p class="oz-soru">' + yaz(q.soru) + yildiz(q.yildiz) + '</p>' + tr(q.tr, iki) + (q.ipucu ? '<p class="oz-ipucu">💡 ' + yaz(q.ipucu) + '</p>' : '') + '</div></li>';
      }).join('') + '</ol>';
    },
    tekrar: function (s, iki) {
      var n = s.kutular.length, kol = n <= 6 ? 3 : 4, satirRenk = ['kirmizi', 'turuncu', 'sari'];
      return '<div class="oz-tekrar" style="grid-template-columns:repeat(' + kol + ',1fr)">' + s.kutular.map(function (k, i) {
        var son = i === n - 1 && n > 3;
        return '<div class="oz-tk oz-r-' + (son ? 'koyu' : satirRenk[Math.floor(i / kol) % 3]) + '"><h4>' + (k.simge ? esc(k.simge) + ' ' : '') + yaz(k.baslik) + '</h4><p>' + yaz(k.metin) + '</p>' + tr(k.tr, iki) + '</div>';
      }).join('') + '</div>';
    }
  };

  function slaytHtml(s, no, iki) {
    var etiket = buyuk(s.etiket, iki ? s.etiket_tr : '');
    var kucukBaslik = s.tur === 'tekrar';
    return '<section class="oz-s oz-t-' + s.tur + (kucukBaslik ? ' oz-kb' : '') + '" data-no="' + no + '">' +
      '<header class="oz-bas">' + (etiket ? '<span class="oz-etiket oz-e-' + s.renk + '">' + esc(etiket) + '</span>' : '') +
      (kucukBaslik ? '' : '<h2>' + yaz(s.baslik) + yildiz(s.yildiz) + '</h2>' + tr(s.baslik_tr, iki).replace('oz-tr', 'oz-alt')) + '</header>' +
      '<div class="oz-govde">' + GOVDE[s.tur](s, iki) + notHtml(s.not, iki) + '</div>' +
      '<span class="oz-sayfa">' + no + '</span></section>';
  }

  function kapakHtml(d) {
    var iki = d.ikidil;
    var efs = iki ? [['⭐⭐⭐', 'core idea / sınavda çok olası'], ['⭐⭐', 'important / önemli'], ['⭐', 'know the basics / temeli bil']]
      : [['⭐⭐⭐', 'sınavda çok olası'], ['⭐⭐', 'önemli'], ['⭐', 'temeli bil']];
    return '<section class="oz-s oz-kapak" data-no="1"><div class="oz-kapak-ic">' +
      '<p class="oz-k-ust">' + esc(iki ? buyuk([d.ders, 'Smart Study Slides'].filter(Boolean).join(' · ')) : buyuk('', [d.ders, 'Akıllı Çalışma Slaytları'].filter(Boolean).join(' · '))) + '</p>' +
      '<h1>' + yaz(d.baslik) + '</h1>' + (iki && d.baslik_tr ? '<p class="oz-k-tr">' + yaz(d.baslik_tr) + '</p>' : '') +
      (d.alt ? '<p class="oz-k-alt">' + yaz(d.alt) + '</p>' : '') +
      '<p class="oz-k-not">' + (iki ? 'Basit İngilizce + Türkçe · Tahmini önem yıldızlı · Örnek cevaplı' : 'Kısa ve net · Tahmini önem yıldızlı · Örnek cevaplı') + '</p></div>' +
      '<div class="oz-k-simge" aria-hidden="true">' + esc(d.simge) + '</div>' +
      '<div class="oz-k-efs">' + efs.map(function (e) { return '<span>' + e[0] + ' = ' + esc(e[1]) + '</span>'; }).join('') + '</div>' +
      '<p class="oz-k-kaynak">' + esc((d.kaynak ? 'Kaynak: ' + d.kaynak + ' · ' : '') + 'Acadex · Yıldızlar tahminidir, hocanın vurgusuna göre değişebilir.') + '</p></section>';
  }

  function desteHtml(d) {
    d = normalize(d);
    return kapakHtml(d) + d.slaytlar.map(function (s, i) { return slaytHtml(s, i + 2, d.ikidil); }).join('');
  }

  /* ---------------- stil (ekran + PDF aynı) ---------------- */
  var CSS = [
    '.oz-s{--lac:#1E2A4A;--tur:#E8743B;--yes:#127A5A;--kir:#D2475A;--sar:#F0B43C;--zem:#FAF7F0;--k:1;position:relative;box-sizing:border-box;width:1280px;height:720px;overflow:hidden;background:var(--zem);color:var(--lac);',
    "font-family:Inter,'Noto Color Emoji',system-ui,-apple-system,'Segoe UI',sans-serif;padding:44px 56px 40px;display:block;-webkit-print-color-adjust:exact;print-color-adjust:exact}",
    '.oz-s *{box-sizing:border-box}.oz-s p,.oz-s h1,.oz-s h2,.oz-s h3,.oz-s h4,.oz-s ul,.oz-s ol{margin:0;padding:0}.oz-s b{font-weight:700}',
    '.oz-bas{flex:none}.oz-etiket{display:inline-block;padding:6px 13px;border-radius:999px;color:#fff;font-size:12.5px;font-weight:800;letter-spacing:.12em;background:var(--kir)}',
    '.oz-e-lacivert{background:var(--lac)}.oz-e-turuncu{background:var(--tur)}.oz-e-yesil{background:var(--yes)}',
    '.oz-bas h2{margin-top:14px;font-size:40px;line-height:1.12;font-weight:800;letter-spacing:-.025em}.oz-y{font-size:.8em;letter-spacing:-.05em;white-space:nowrap}',
    '.oz-alt{margin-top:6px;font-size:21px;font-weight:500;color:var(--yes)}',
    '.oz-govde{margin-top:24px;zoom:var(--k)}',
    '.oz-tr{margin-top:6px;font-size:13.5px;line-height:1.45;color:var(--yes)}',
    /* kartlar */
    '.oz-kartlar{display:grid;gap:18px;align-items:stretch}.oz-kartlar-alt{margin-top:18px}',
    '.oz-kart{background:#fff;border-radius:14px;border-top:6px solid var(--lac);box-shadow:0 1px 3px rgba(30,42,74,.07);padding:18px 22px 20px}',
    '.oz-r-turuncu{border-top-color:var(--tur)}.oz-r-yesil{border-top-color:var(--yes)}.oz-r-kirmizi{border-top-color:var(--kir)}.oz-r-sari{border-top-color:var(--sar)}',
    '.oz-kart h3{font-size:19.5px;line-height:1.25;font-weight:800}.oz-em{font-weight:400}',
    '.oz-rozet{display:inline-block;margin-top:8px;padding:3px 9px;border-radius:6px;background:#EEF0F5;font-size:12.5px;font-weight:700}',
    '.oz-m{margin-top:8px;font-size:15.5px;line-height:1.5}',
    '.oz-kart ul{list-style:none;margin-top:9px}.oz-kart li{position:relative;padding-left:15px;font-size:15.5px;line-height:1.45;margin-top:4px}',
    '.oz-kart li:before{content:"";position:absolute;left:0;top:.62em;width:6px;height:6px;border-radius:50%;background:var(--tur)}',
    '.oz-ornek{background:#fff;border-radius:14px;border-left:6px solid var(--yes);box-shadow:0 1px 3px rgba(30,42,74,.07);padding:18px 24px;font-size:15.5px;line-height:1.65}',
    '.oz-ornek p+p{margin-top:12px}.oz-ornek-kisa{margin-top:18px}',
    /* not kutusu */
    '.oz-not{display:flex;gap:16px;align-items:center;margin-top:18px;padding:15px 20px;border:2px dashed var(--sar);background:#FFF6DC;border-radius:14px;font-size:15.5px;line-height:1.5}',
    '.oz-not-s{font-size:30px;line-height:1;flex:none}.oz-not .oz-tr{font-size:14.5px;margin-top:2px}',
    '.oz-not-uyari{border-color:var(--kir);background:#FDECEE}.oz-not-bilgi{border:none;background:#E4F3EC;color:#0D5A43}',
    /* harita */
    '.oz-harita{display:grid;gap:14px}.oz-hk{display:flex;gap:12px;align-items:flex-start;background:#fff;border-radius:14px;border-top:5px solid var(--lac);padding:16px 18px;box-shadow:0 1px 3px rgba(30,42,74,.07);font-size:16.5px;line-height:1.35}',
    '.oz-hk-no{flex:none;width:28px;height:28px;border-radius:50%;background:var(--lac);color:#fff;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center}.oz-hk-s{font-size:26px;line-height:1}',
    /* süreç */
    '.oz-surec{display:flex;align-items:stretch;gap:8px}.oz-ok{flex:none;align-self:center;font-size:24px;color:#8A93A8}',
    '.oz-adim{flex:1;background:#fff;border-radius:14px;border-top:6px solid #CBD2DF;padding:14px 15px;box-shadow:0 1px 3px rgba(30,42,74,.07);font-size:14.5px;line-height:1.45}',
    '.oz-adim h4{font-size:16px;line-height:1.25;font-weight:800;margin-bottom:6px}.oz-vurgu{border-top-color:var(--kir);background:#FFF5F6}',
    '.oz-no{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:var(--lac);color:#fff;font-size:12.5px;font-weight:800;vertical-align:1px}',
    /* tablo */
    '.oz-tablo{width:100%;border-collapse:separate;border-spacing:0;border-radius:14px;overflow:hidden;background:#fff;box-shadow:0 1px 3px rgba(30,42,74,.07);font-size:15px;line-height:1.45}',
    '.oz-tablo th{background:var(--lac);color:#fff;text-align:left;padding:12px 16px;font-weight:700}.oz-tablo td{padding:9px 16px;border-top:1px solid #E8EBF1;vertical-align:top}',
    '.oz-tablo tbody tr:nth-child(even) td{background:#F7F8FB}.oz-tablo small.oz-tr{display:block;font-size:12.5px;font-weight:400}',
    /* örnek cevap */
    '.oz-ornek-izgara.oz-iki{display:grid;grid-template-columns:1.65fr 1fr;gap:18px;align-items:start}.oz-yan-k{display:grid;gap:14px}',
    '.oz-yan{background:#fff;border-radius:14px;border-top:6px solid var(--lac);padding:16px 20px;box-shadow:0 1px 3px rgba(30,42,74,.07);font-size:15px;line-height:1.55}.oz-yan h4{font-size:18px;font-weight:800;margin-bottom:8px}.oz-yan p+p{margin-top:7px}',
    '.oz-ek{background:#E4F3EC;color:#0D5A43;border-radius:14px;padding:16px 20px;font-size:14.5px;line-height:1.55}',
    /* sorular */
    '.oz-sorular{list-style:none;display:grid;gap:14px}.oz-sorular.oz-iki{grid-template-columns:1fr 1fr}',
    '.oz-sorular li{display:flex;gap:14px;background:#fff;border-radius:14px;padding:16px 20px;box-shadow:0 1px 3px rgba(30,42,74,.07);border-left:6px solid var(--kir)}',
    '.oz-sorular .oz-no{flex:none;width:30px;height:30px;font-size:14px;background:var(--kir)}.oz-soru{font-size:16.5px;line-height:1.4;font-weight:700}',
    '.oz-ipucu{margin-top:7px;font-size:13.5px;line-height:1.45;color:#5B6478}',
    /* son tekrar */
    '.oz-kb .oz-govde{margin-top:20px}.oz-tekrar{display:grid;gap:14px}',
    '.oz-tk{background:#fff;border-radius:14px;border-top:6px solid var(--kir);padding:14px 18px;box-shadow:0 1px 3px rgba(30,42,74,.07);font-size:14.5px;line-height:1.45}',
    '.oz-tk h4{font-size:17.5px;font-weight:800;margin-bottom:6px}.oz-tk .oz-tr{font-size:12.5px}',
    '.oz-r-koyu{background:var(--lac);color:#fff;border-top-color:var(--lac)}.oz-r-koyu h4{color:var(--sar)}.oz-r-koyu .oz-tr{color:#8FE0CB}',
    /* kapak */
    '.oz-kapak{background:var(--lac);color:#fff;padding:84px 88px 40px}.oz-kapak-ic{max-width:860px}',
    '.oz-k-ust{color:var(--sar);font-size:17px;font-weight:800;letter-spacing:.16em}',
    '.oz-kapak h1{margin-top:26px;font-size:58px;line-height:1.08;font-weight:800;letter-spacing:-.03em}.oz-k-tr{margin-top:12px;color:var(--sar);font-size:44px;line-height:1.12;font-weight:800;letter-spacing:-.025em}',
    '.oz-k-alt{margin-top:26px;font-size:22px;color:#DCE2EE}.oz-k-not{margin-top:10px;font-size:20px;color:#8FE0CB}',
    '.oz-k-simge{position:absolute;right:96px;top:110px;font-size:150px;line-height:1}',
    '.oz-k-efs{position:absolute;left:88px;bottom:68px;display:flex;gap:16px}.oz-k-efs span{padding:11px 16px;border-radius:10px;background:rgba(255,255,255,.1);font-size:15px}',
    '.oz-k-kaynak{position:absolute;left:88px;bottom:30px;font-size:13px;color:#98A2B8}',
    '.oz-sayfa{position:absolute;right:30px;bottom:20px;font-size:13px;color:#7A8296}.oz-kapak .oz-sayfa{display:none}'
  ].join('\n');

  var SAYFA_CSS = '@page{size:' + GEN + 'px ' + YUK + 'px;margin:0}html,body{margin:0;padding:0;background:#fff}.oz-s{break-after:page;page-break-after:always}.oz-s:last-child{break-after:auto;page-break-after:auto}';

  /* Taşan slayt: gövde zoom'la küçülür (1 → 0.7). Yarısı boş kalan slayt en çok 1.2'ye
     büyür (alttan 48px pay bırakarak): az içerikli slayt da sayfayı doldurur.
     Ölçüm için slayt çizilmiş olmalı (display:none olmamalı). */
  var K_EN_AZ = 0.7, K_EN_COK = 1.2, PAY = 48;
  function bosluk(s) { var g = s.querySelector('.oz-govde'); return s.clientHeight - 40 - (g.getBoundingClientRect().bottom - s.getBoundingClientRect().top); }
  function sigdir(kok) {
    Array.prototype.forEach.call(kok.querySelectorAll('.oz-s'), function (s) {
      var g = s.querySelector('.oz-govde'); if (!g) return;
      var k = 1, kur = function (v) { k = Math.round(v * 100) / 100; s.style.setProperty('--k', String(k)); };
      s.style.removeProperty('--k');
      while (s.scrollHeight > s.clientHeight + 1 && k > K_EN_AZ) kur(k - 0.05);
      if (k === 1) {
        while (k < K_EN_COK && bosluk(s) > PAY + 60) { kur(k + 0.05); if (bosluk(s) < PAY || s.scrollHeight > s.clientHeight + 1) { kur(k - 0.05); break; } }
      }
      if (k === 1) s.style.removeProperty('--k');
    });
  }

  function stilKur() {
    if (!D.getElementById('oz-slayt-font')) { var l = D.createElement('link'); l.id = 'oz-slayt-font'; l.rel = 'stylesheet'; l.href = FONT_URL; D.head.appendChild(l); }
    if (!D.getElementById('oz-slayt-css')) { var st = D.createElement('style'); st.id = 'oz-slayt-css'; st.textContent = CSS + '\n' + GORUNTU_CSS; D.head.appendChild(st); }
  }

  /* Ekran dışında çizer, fontları bekler, sığdırır: hem görüntüleyici hem PDF bunu kullanır. */
  function cizVeSigdir(deste) {
    stilKur();
    var kap = D.createElement('div');
    kap.setAttribute('aria-hidden', 'true');
    kap.style.cssText = 'position:fixed;left:-20000px;top:0;width:' + GEN + 'px;pointer-events:none';
    kap.innerHTML = desteHtml(deste);
    D.body.appendChild(kap);
    var fonts = D.fonts && D.fonts.ready ? D.fonts.ready : Promise.resolve();
    return Promise.race([fonts, new Promise(function (r) { setTimeout(r, 2500); })]).then(function () { sigdir(kap); return kap; });
  }

  function pdfBelgesi(govdeHtml, baslik, yazdir) {
    return '<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>' + esc(baslik) + '</title>' +
      '<link rel="stylesheet" href="' + FONT_URL + '"><style>' + CSS + '\n' + SAYFA_CSS + '</style></head><body>' + govdeHtml +
      (yazdir ? '<script>window.onload=function(){(document.fonts?document.fonts.ready:Promise.resolve()).then(function(){setTimeout(function(){window.print()},300)})}<\/script>' : '') +
      '</body></html>';
  }

  /* ---------------- sunucu ---------------- */
  function ucNokta() { return (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '') + '/functions/v1/ozet-slayt'; }
  function oturumBasligi() {
    var c = typeof supabaseClient !== 'undefined' ? supabaseClient : null;
    if (!c) return Promise.resolve({});
    return c.auth.getSession().then(function (r) {
      var t = r && r.data && r.data.session && r.data.session.access_token;
      var h = { 'Content-Type': 'application/json' };
      if (t) h.Authorization = 'Bearer ' + t;
      if (typeof SUPABASE_ANON_KEY !== 'undefined') h.apikey = SUPABASE_ANON_KEY;
      return h;
    });
  }
  function istek(govde) {
    return oturumBasligi().then(function (h) { return fetch(ucNokta(), { method: 'POST', headers: h, body: JSON.stringify(govde) }); });
  }
  function desteGetir(kart, yenile) {
    return istek({ islem: 'uret', kartId: kart.id, yenile: !!yenile }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || !j.deste) { var e = new Error(j.mesaj || j.error || ('Slaytlar hazırlanamadı (' + r.status + ')')); e.durum = r.status; throw e; }
        kart.slayt = { deste: j.deste, uretildi: j.uretildi, model: j.model };
        return j.deste;
      });
    });
  }

  function dosyaAdi(kart, deste) {
    var ad = (typeof axDocTitle === 'function' && kart.documentFileName ? axDocTitle(kart.documentFileName) : '') || deste.baslik || 'Acadex';
    return String(ad).replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 80) + ' - Çalışma Slaytları.pdf';
  }
  function indir(blob, ad) {
    var a = D.createElement('a'); a.href = URL.createObjectURL(blob); a.download = ad; D.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  function yazdirPenceresi(govdeHtml, baslik) {
    var w = W.open('', '_blank');
    if (!w) return false;
    w.document.open(); w.document.write(pdfBelgesi(govdeHtml, baslik, true)); w.document.close();
    return true;
  }

  /* PDF: önce sunucu (vektör, tek tık), olmazsa yazdır penceresi. Döner: 'sunucu' | 'yazdir' | 'engel' */
  function pdfIndir(kart, deste, durum) {
    return cizVeSigdir(deste).then(function (kap) {
      var govde = kap.innerHTML; kap.remove();
      var baslik = dosyaAdi(kart, deste).replace(/\.pdf$/, '');
      var html = pdfBelgesi(govde, baslik, false);
      if (durum) durum('PDF hazırlanıyor…');
      return istek({ islem: 'pdf', kartId: kart.id, html: html }).then(function (r) {
        var ct = r.headers.get('Content-Type') || '';
        if (r.ok && /pdf/i.test(ct)) return r.blob().then(function (b) { indir(b, baslik + '.pdf'); return 'sunucu'; });
        throw new Error('pdf ' + r.status);
      }).catch(function (e) {
        console.warn('Slayt PDF sunucusu kullanılamadı, yazdır penceresine geçiliyor:', e && e.message);
        return yazdirPenceresi(govde, baslik) ? 'yazdir' : 'engel';
      });
    });
  }

  /* ---------------- görüntüleyici ---------------- */
  var GORUNTU_CSS = [
    '.ozv{position:fixed;inset:0;z-index:100000;background:rgba(14,20,38,.94);display:flex;flex-direction:column;color:#fff;font-family:Inter,system-ui,sans-serif}',
    '.ozv-ust{display:flex;align-items:center;gap:10px;padding:12px 16px;flex-wrap:wrap}.ozv-ad{flex:1;min-width:160px;font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.ozv button{font:inherit;font-size:14px;font-weight:600;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);color:#fff;border-radius:10px;padding:8px 14px;cursor:pointer}',
    '.ozv button:hover{background:rgba(255,255,255,.16)}.ozv button[disabled]{opacity:.5;cursor:default}.ozv .ozv-ana{background:#F0B43C;border-color:#F0B43C;color:#1E2A4A}',
    '.ozv-sahne{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:6px 16px;overflow:hidden}',
    '.ozv-olcek{width:1280px;height:720px;flex:none;transform-origin:center center;box-shadow:0 18px 60px rgba(0,0,0,.45);border-radius:6px;overflow:hidden}',
    '.ozv-olcek .oz-s{display:none}.ozv-olcek .oz-s.ozv-on{display:block}',
    '.ozv-alt{display:flex;align-items:center;justify-content:center;gap:14px;padding:10px 16px 16px}.ozv-say{min-width:70px;text-align:center;font-variant-numeric:tabular-nums}',
    '.ozv-bekle{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:24px;font-size:16px;line-height:1.5}',
    '.ozv-don{width:42px;height:42px;border-radius:50%;border:4px solid rgba(255,255,255,.2);border-top-color:#F0B43C;animation:ozvDon 1s linear infinite}',
    '@keyframes ozvDon{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.ozv-don{animation:none}}',
    '.ozv-bilgi{font-size:13px;color:#C9D1E3;padding:0 16px 6px;text-align:center}'
  ].join('\n');

  var acik = null;

  function ac(kart, secenek) {
    secenek = secenek || {};
    if (!kart || !kart.id) { if (typeof showDashboardAlert === 'function') showDashboardAlert('error', 'Önce bir özet aç.'); return; }
    stilKur();
    if (acik) kapat();
    var kok = D.createElement('div');
    kok.className = 'ozv'; kok.setAttribute('role', 'dialog'); kok.setAttribute('aria-modal', 'true'); kok.setAttribute('aria-label', 'Çalışma slaytları');
    kok.innerHTML = '<div class="ozv-ust"><span class="ozv-ad">Akıllı Çalışma Slaytları</span>' +
      '<button type="button" class="ozv-ana" data-ozv-pdf disabled>PDF indir</button><button type="button" data-ozv-klasik>Klasik A4 PDF</button>' +
      '<button type="button" data-ozv-yenile disabled>Yeniden üret</button><button type="button" data-ozv-kapat aria-label="Kapat">✕</button></div>' +
      '<div class="ozv-bekle"><div class="ozv-don"></div><p data-ozv-msj>Slaytlar hazırlanıyor…<br><small>İlk seferde 20-60 saniye sürebilir; sonra hep hazır.</small></p></div>';
    D.body.appendChild(kok);
    acik = { kok: kok, kart: kart, i: 0, n: 0 };
    var b = function (s) { return kok.querySelector(s); };
    b('[data-ozv-kapat]').onclick = kapat;
    b('[data-ozv-klasik]').onclick = function () {
      if (typeof exportStudyCardToPDF === 'function') exportStudyCardToPDF(kart).catch(function (e) { console.error(e); });
    };
    b('[data-ozv-yenile]').onclick = function () { yukle(true); };
    b('[data-ozv-pdf]').onclick = function () { pdf(); };
    D.addEventListener('keydown', tus);
    W.addEventListener('resize', olcekle);

    function yukle(yenile) {
      var hazir = !yenile && kart.slayt && kart.slayt.deste;
      bekle(yenile ? 'Slaytlar yeniden hazırlanıyor…' : 'Slaytlar hazırlanıyor…');
      (hazir ? Promise.resolve(kart.slayt.deste) : desteGetir(kart, yenile)).then(function (deste) {
        if (!acik || acik.kok !== kok) return;
        return cizVeSigdir(deste).then(function (kap) {
          if (!acik || acik.kok !== kok) { kap.remove(); return; }
          goster(kap, deste);
          if (secenek.indir) { secenek.indir = false; pdf(); }
        });
      }).catch(function (e) {
        if (!acik || acik.kok !== kok) return;
        bekle(esc(e.message || 'Slaytlar hazırlanamadı.') + '<br><small>Biraz sonra yeniden dene ya da Klasik A4 PDF\'i kullan.</small>', true);
      });
    }
    yukle(false);
  }

  function bekle(msj, hata) {
    var kok = acik && acik.kok; if (!kok) return;
    ['.ozv-sahne', '.ozv-alt', '.ozv-bilgi'].forEach(function (s) { var x = kok.querySelector(s); if (x) x.remove(); });
    var w = kok.querySelector('.ozv-bekle');
    if (!w) { w = D.createElement('div'); w.className = 'ozv-bekle'; kok.appendChild(w); }
    w.innerHTML = (hata ? '<div style="font-size:34px">😕</div>' : '<div class="ozv-don"></div>') + '<p>' + msj + '</p>';
    kok.querySelector('[data-ozv-pdf]').disabled = true;
    kok.querySelector('[data-ozv-yenile]').disabled = !hata;
  }

  function goster(kap, deste) {
    var kok = acik.kok;
    var w = kok.querySelector('.ozv-bekle'); if (w) w.remove();
    var sahne = D.createElement('div'); sahne.className = 'ozv-sahne';
    var olcek = D.createElement('div'); olcek.className = 'ozv-olcek';
    while (kap.firstChild) olcek.appendChild(kap.firstChild);
    kap.remove();
    sahne.appendChild(olcek);
    var alt = D.createElement('div'); alt.className = 'ozv-alt';
    alt.innerHTML = '<button type="button" data-ozv-geri aria-label="Önceki slayt">←</button><span class="ozv-say" aria-live="polite"></span><button type="button" data-ozv-ileri aria-label="Sonraki slayt">→</button>';
    var bilgi = D.createElement('p'); bilgi.className = 'ozv-bilgi';
    bilgi.textContent = W.innerWidth < W.innerHeight ? 'Yıldızlar tahminidir · Büyük görmek için telefonu yan çevir · kaydırarak gezin' : 'Yıldızlar tahminidir · ← → tuşlarıyla gezin';
    kok.appendChild(sahne); kok.appendChild(alt); kok.appendChild(bilgi);
    acik.deste = deste; acik.n = olcek.children.length; acik.i = 0; acik.olcek = olcek;
    alt.querySelector('[data-ozv-geri]').onclick = function () { git(acik.i - 1); };
    alt.querySelector('[data-ozv-ileri]').onclick = function () { git(acik.i + 1); };
    var bas = 0; sahne.addEventListener('touchstart', function (e) { bas = e.touches[0].clientX; }, { passive: true });
    sahne.addEventListener('touchend', function (e) { var dx = e.changedTouches[0].clientX - bas; if (Math.abs(dx) > 40) git(acik.i + (dx < 0 ? 1 : -1)); });
    kok.querySelector('[data-ozv-pdf]').disabled = false;
    kok.querySelector('[data-ozv-yenile]').disabled = false;
    kok.querySelector('.ozv-ad').textContent = deste.baslik || 'Akıllı Çalışma Slaytları';
    git(0); olcekle();
  }

  function git(i) {
    if (!acik || !acik.olcek) return;
    i = Math.max(0, Math.min(acik.n - 1, i)); acik.i = i;
    Array.prototype.forEach.call(acik.olcek.children, function (s, j) { s.classList.toggle('ozv-on', j === i); });
    acik.kok.querySelector('.ozv-say').textContent = (i + 1) + ' / ' + acik.n;
  }
  function olcekle() {
    if (!acik || !acik.olcek) return;
    var s = acik.olcek.parentNode, k = Math.min((s.clientWidth - 8) / GEN, (s.clientHeight - 8) / YUK);
    acik.olcek.style.transform = 'scale(' + Math.max(0.15, k) + ')';
  }
  function tus(e) {
    if (!acik) return;
    if (e.key === 'Escape') kapat();
    else if (e.key === 'ArrowRight' || e.key === 'PageDown') git(acik.i + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') git(acik.i - 1);
  }
  function kapat() {
    if (!acik) return;
    acik.kok.remove(); acik = null;
    D.removeEventListener('keydown', tus); W.removeEventListener('resize', olcekle);
  }
  function pdf() {
    if (!acik || !acik.deste) return;
    var dugme = acik.kok.querySelector('[data-ozv-pdf]'), eski = dugme.textContent;
    dugme.disabled = true; dugme.textContent = 'PDF hazırlanıyor…';
    pdfIndir(acik.kart, acik.deste).then(function (yol) {
      var al = typeof showDashboardAlert === 'function' ? showDashboardAlert : function () { };
      if (yol === 'sunucu') al('success', 'Çalışma slaytları indirildi.');
      else if (yol === 'yazdir') al('success', 'Açılan pencerede "PDF olarak kaydet"i seç.');
      else al('error', 'Açılır pencere engellendi. Tarayıcıda bu siteye açılır pencere izni ver.');
    }).catch(function (e) { console.error('Slayt PDF hatası:', e); }).then(function () {
      if (acik) { dugme.disabled = false; dugme.textContent = eski; }
    });
  }

  /* DÜĞMELER BU DOSYADAN DA BAĞLANIR (24.11.2026). Canlıda dashboard.html yeniydi ama
     tarayıcı dashboard.js'in 4 saat önbellekteki ESKİ kopyasını kullandı: "slaytlar"
     düğmesinin dinleyicisi yoktu, "PDF" eski A4 dökümü indirdi. Yakalama evresinde
     (capture) dinlenince hangi dashboard.js yüklü olursa olsun iki düğme de slayta gider. */
  function aktifKart() {
    try { return typeof currentActiveStudyCard !== 'undefined' ? currentActiveStudyCard : null; } catch (e) { return null; }
  }
  W.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('#btn-study-slides, #btn-export-pdf') : null;
    if (!b) return;
    var kart = aktifKart();
    if (!kart || !kart.id) return; // kart yoksa dashboard.js kendi uyarısını versin
    e.preventDefault(); e.stopImmediatePropagation();
    ac(kart, b.id === 'btn-export-pdf' ? { indir: true } : {});
  }, true);

  W.AcadexOzetSlayt = { ac: ac, kapat: kapat, desteHtml: desteHtml, pdfBelgesi: pdfBelgesi, normalize: normalize, sigdir: sigdir, CSS: CSS, _esc: esc, _yaz: yaz };
})(window);
