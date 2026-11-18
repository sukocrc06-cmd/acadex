/* ==========================================================================
   ACADEX · ACADIA GERİ BİLDİRİM (js/acadex-acadia-geri.js), 18.11.2026
   Kaynakla çalış sohbetinde Acadia'nın her cevabının altına 👍 / 👎 koyar.
   Cevaplanamayan sorular (sunucu hatası) dashboard.js'ten AXGERI.hata ile gelir.
   Hepsi public.acadia_geri_bildirim tablosuna yazılır
   (supabase/migrations/20261118c_acadia_geri_bildirim.sql); yönetim paneli
   "Acadia geri bildirim" listesinde görünür (js/admin-acadia.js).
   Tablo henüz kurulmadıysa hiçbir şey bozulmaz: düğme yine işaretlenir,
   kayıt sessizce atlanır.
   ========================================================================== */
(function () {
  'use strict';
  var W = window, D = document;
  var root = D.getElementById('sourcehub-view');
  if (!root) return;
  var g = function (n) { try { return (0, eval)(n); } catch (e) { return undefined; } };
  var sb = function () { return g('supabaseClient') || null; };
  var kes = function (t, n) { t = String(t == null ? '' : t); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
  /* alıntı iliştirilmiş soruda (“...”\n\nsoru) alıntıyı da sakla ama sınırla */
  var temizSoru = function (t) { return kes(String(t || '').trim(), 2000); };
  var tabloYok = false;

  var yaz = async function (satir) {
    var c = sb(); if (!c || tabloYok) return null;
    try {
      var r = await c.from('acadia_geri_bildirim').insert(satir).select('id').single();
      if (r.error) throw r.error;
      return r.data && r.data.id;
    } catch (e) {
      if (/acadia_geri_bildirim|does not exist|PGRST20|42P01/i.test(String((e && (e.message || e.code)) || ''))) tabloYok = true;
      if (W.console) console.warn('Acadia geri bildirim yazılamadı:', (e && e.message) || e);
      return null;
    }
  };
  var guncelle = async function (id, puan) {
    var c = sb(); if (!c || !id) return false;
    try { var r = await c.from('acadia_geri_bildirim').update({ puan: puan }).eq('id', id); return !r.error; } catch (e) { return false; }
  };

  /* --- cevaplanamayan soru --- */
  W.AXGERI = {
    hata: function (kart, soru, mesaj) {
      if (!soru) return;
      yaz({ study_card_id: kart || null, kaynak: 'kaynak', soru: temizSoru(soru), hata: kes(mesaj || 'bilinmeyen hata', 500) });
    }
  };

  /* --- 👍 / 👎 --- */
  var dugmeler = function (bub, meta, cevap) {
    if (!bub || !meta || !meta.soru || bub.querySelector('.agb')) return;
    var row = bub.querySelector('.acts');
    if (!row) { row = D.createElement('div'); row.className = 'acts'; bub.appendChild(row); }
    var k = D.createElement('span'); k.className = 'agb'; k.setAttribute('role', 'group'); k.setAttribute('aria-label', 'Bu cevap işine yaradı mı?');
    k.innerHTML = '<button type="button" data-agb="1" aria-pressed="false" aria-label="İşime yaradı" title="İşime yaradı">👍</button><button type="button" data-agb="-1" aria-pressed="false" aria-label="İşime yaramadı" title="İşime yaramadı">👎</button><span class="agb-n" aria-live="polite"></span>';
    row.appendChild(k);
    var id = null, puan = 0, mesgul = false;
    k.addEventListener('click', async function (e) {
      var b = e.target.closest('[data-agb]'); if (!b || mesgul) return;
      var p = +b.getAttribute('data-agb'); if (p === puan) return;
      mesgul = true; puan = p;
      k.querySelectorAll('[data-agb]').forEach(function (x) { x.setAttribute('aria-pressed', String(+x.getAttribute('data-agb') === p)); });
      k.querySelector('.agb-n').textContent = p > 0 ? 'teşekkürler' : 'not aldık; Acadia\'yı bununla geliştireceğiz';
      if (id) await guncelle(id, p);
      else id = await yaz({ study_card_id: meta.kart || null, kaynak: 'kaynak', soru: temizSoru(meta.soru), cevap: kes(cevap, 4000), puan: p, model: kes(meta.model || '', 80) || null, yol: kes(meta.yol || '', 80) || null });
      mesgul = false;
    });
  };

  var asil = g('renderSourceHubChatMessage');
  if (typeof asil === 'function') {
    var feed = D.getElementById('sourcehub-chat-messages');
    var yeni = function (role, text) {
      var once = feed && feed.lastElementChild, meta = W.__acadiaSon;
      var r = asil.apply(this, arguments);
      try { var bub = feed && feed.lastElementChild; if (role === 'assistant' && meta && bub && bub !== once) dugmeler(bub, meta, text); } catch (e) { /* süs */ }
      return r;
    };
    W.__agbRSM = yeni; try { (0, eval)('renderSourceHubChatMessage = window.__agbRSM'); } catch (e) { /* yok */ }
    W.renderSourceHubChatMessage = yeni;
  }

  var st = D.createElement('style');
  st.textContent = '#sourcehub-view .agb{display:inline-flex;align-items:center;gap:2px;margin-left:auto}' +
    '#sourcehub-view .agb button{min-width:36px;min-height:32px;padding:2px 6px;border:1.2px solid transparent;border-radius:8px;background:none;font-size:16px;line-height:1;cursor:pointer;filter:grayscale(1);opacity:.65}' +
    '#sourcehub-view .agb button:hover{opacity:1;filter:none}' +
    '#sourcehub-view .agb button[aria-pressed="true"]{opacity:1;filter:none;border-color:#C9D1E1;background:#fff}' +
    '#sourcehub-view .agb button:focus-visible{outline:2px solid #2F6BFF;outline-offset:1px}' +
    '#sourcehub-view .agb-n{font-size:12px;color:#6A7593;margin-left:4px}';
  D.head.appendChild(st);
})();
