/* ==========================================================================
   ACADEX · ROZET VİTRİNİ (js/acadex-rozet.js + css/acadex-rozet.css), 03.11.2026
   Ana sayfadaki "rozetlerin" kartı bir madalya rafı olur:
     - kazanılan rozet: kademesine göre bronz / gümüş / altın madalya, arada parlar
     - kilitli rozet: gri siluet + ilerleme çubuğu (ör. "3 / 10 sayfa")
     - yeni kazanılan rozet rafa düşer, sallanır, ışıltı saçar (bir kez)
     - madalyaya dokununca küçük bilgi kartı: nasıl kazanılır, ne zaman kazandın
   Veri: achievements + user_achievements (eski ekranla aynı), ilerleme için yalnızca
   sayım sorguları (head: true). Veritabanındaki İngilizce açıklamalar yerine burada
   Türkçe metin var; veritabanı değişmez. renderStreakAndAchievements'ın yerine geçer.
   ========================================================================== */
(function () {
  'use strict';
  var W = window, D = document;
  var lsafe = function (fn, fb) { try { return fn(); } catch (e) { return fb; } };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var RM = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var MON = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  var dshort = function (s) { var d = new Date(s); return isNaN(d) ? '' : d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); };

  /* id: [başlık, nasıl kazanılır, sayaç, hedef, birim, kademe] — kademe: b bronz, s gümüş, g altın */
  var R = {
    first_upload: ['İlk Adım', 'İlk belgeni yükle.', 'docs', 1, 'belge', 'b'],
    first_summary: ['Özetleme Ustası', 'İlk bilgi kartını oluştur.', 'cards', 1, 'kart', 'b'],
    summary_10: ['Not Koleksiyoncusu', '10 bilgi kartı oluştur.', 'cards', 10, 'kart', 's'],
    summary_50: ['Bilgi Kütüphanesi', '50 bilgi kartı oluştur.', 'cards', 50, 'kart', 'g'],
    first_exam: ['Sınav Zamanı', 'İlk deneme sınavını tamamla.', 'exams', 1, 'sınav', 'b'],
    exam_10: ['Sınav Maratoncusu', '10 deneme sınavı tamamla.', 'exams', 10, 'sınav', 's'],
    perfect_score: ['Mükemmeliyetçi', 'Bir sınavda 100 / 100 al.', 'perfect', 1, 'tam puan', 's'],
    perfect_5: ['Kusursuzluk Ustası', '5 kez 100 / 100 al.', 'perfect', 5, 'tam puan', 'g'],
    first_notebook_save: ['Defter Tutkunu', 'İlk defter sayfanı kaydet.', 'pages', 1, 'sayfa', 'b'],
    notebook_10: ['Defter Ustası', '10 defter sayfası kaydet.', 'pages', 10, 'sayfa', 's'],
    first_share: ['Paylaşımcı', 'Bir bilgi kartını bölümünle paylaş.', 'shared', 1, 'paylaşım', 'b'],
    share_5: ['Cömert Paylaşımcı', 'Bölümünle 5 bilgi kartı paylaş.', 'shared', 5, 'paylaşım', 's'],
    streak_7: ['7 Günlük Seri', '7 gün üst üste çalış.', 'streak', 7, 'gün', 'b'],
    streak_30: ['30 Günlük Seri', '30 gün üst üste çalış.', 'streak', 30, 'gün', 's'],
    streak_100: ['Demir İrade', '100 gün üst üste çalış.', 'streak', 100, 'gün', 'g'],
    first_sandbox_project: ['Sandbox Kaşifi', 'Geliştirici sandbox’ta bir proje paylaş.', null, 1, '', 'b'],
    project_popular: ['Popüler Proje', 'Sandbox projelerinden biri 5 beğeni alsın.', null, 1, '', 'g']
  };
  var ORDER = Object.keys(R);
  var TIER = { b: 'bronz', s: 'gümüş', g: 'altın' };

  var counts = async function (uid) {
    var sb = lsafe(function () { return supabaseClient; }, null), out = {};
    out.streak = +lsafe(function () { return currentUserProfile.current_streak; }, 0) || 0;
    if (!sb || !uid) return out;
    var c = function (q) { return q.then(function (r) { return r && !r.error && typeof r.count === 'number' ? r.count : null; }, function () { return null; }); };
    var h = { count: 'exact', head: true };
    var res = await Promise.all([
      c(sb.from('documents').select('id', h).eq('user_id', uid)),
      c(sb.from('study_cards').select('id', h).eq('user_id', uid)),
      c(sb.from('exams').select('id', h).eq('user_id', uid).not('completed_at', 'is', null)),
      c(sb.from('exams').select('id', h).eq('user_id', uid).eq('grade', 100)),
      c(sb.from('notebooks').select('page_number', h).eq('user_id', uid)),
      c(sb.from('study_cards').select('id', h).eq('user_id', uid).eq('is_shared', true))
    ]);
    ['docs', 'cards', 'exams', 'perfect', 'pages', 'shared'].forEach(function (k, i) { if (res[i] != null) out[k] = res[i]; });
    return out;
  };

  var medalSvg = function (tier, on) {
    var g = { b: ['#E7B07A', '#B9783F', '#8E5A2B'], s: ['#F4F6FA', '#C3CAD8', '#8C96AA'], g: ['#FFE48A', '#F2B937', '#B8861B'] }[tier] || ['#E4E8F0', '#C9D0DE', '#9AA3B5'];
    if (!on) g = ['#EEF1F6', '#D7DCE6', '#B5BDCC'];
    var rib = on ? { b: ['#C9483B', '#2F6BFF'], s: ['#2F6BFF', '#1A2A5C'], g: ['#1E8A55', '#C9483B'] }[tier] : ['#CBD2DE', '#B8C0CF'];
    var id = 'rz' + Math.random().toString(36).slice(2, 7);
    return '<svg class="rz-svg" viewBox="0 0 64 88" aria-hidden="true"><defs><radialGradient id="' + id + '" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="' + g[0] + '"/><stop offset=".55" stop-color="' + g[1] + '"/><stop offset="1" stop-color="' + g[2] + '"/></radialGradient></defs>' +
      '<path d="M20 2 H30 L36 30 H26 Z" fill="' + rib[0] + '"/><path d="M34 2 H44 L38 30 H28 Z" fill="' + rib[1] + '"/>' +
      '<circle cx="32" cy="58" r="25" fill="url(#' + id + ')" stroke="' + g[2] + '" stroke-width="2"/>' +
      '<circle cx="32" cy="58" r="19.5" fill="none" stroke="' + (on ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.8)') + '" stroke-width="1.4" stroke-dasharray="2 2.6"/>' +
      '<rect x="27" y="28" width="10" height="7" rx="2" fill="' + g[2] + '"/></svg>';
  };

  var seenKey = function (uid) { return 'acadex.rozet.seen.' + (uid || 'x'); };
  var seenGet = function (uid) { return lsafe(function () { var v = localStorage.getItem(seenKey(uid)); return v == null ? null : JSON.parse(v); }, null); };
  var seenSet = function (uid, ids) { try { localStorage.setItem(seenKey(uid), JSON.stringify(ids)); } catch (e) {} };

  var tip = null;
  var closeTip = function () { if (tip) { tip.remove(); tip = null; } D.querySelectorAll('.rz-m[aria-expanded="true"]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); }); };
  D.addEventListener('pointerdown', function (e) { if (tip && !tip.contains(e.target) && !e.target.closest('.rz-m')) closeTip(); });
  D.addEventListener('keydown', function (e) { if (e.key === 'Escape' && tip) { var b = D.querySelector('.rz-m[aria-expanded="true"]'); closeTip(); if (b) b.focus(); } });

  var render = async function () {
    var box = D.getElementById('home-achievements-list'); if (!box) return;
    var uid = lsafe(function () { return currentUser.id; }, null), sb = lsafe(function () { return supabaseClient; }, null);
    box.classList.add('rz-shelf');
    if (!box.querySelector('.rz-m')) box.innerHTML = '<p class="rz-load hand">rozetler rafa diziliyor…</p>';
    var earned = new Map(), all = ORDER.slice(), cnt = {};
    try {
      var r = await Promise.all([
        sb ? sb.from('user_achievements').select('achievement_id, earned_at').eq('user_id', uid) : { data: [] },
        sb ? sb.from('achievements').select('id') : { data: [] },
        counts(uid)
      ]);
      (r[0].data || []).forEach(function (e) { earned.set(e.achievement_id, e.earned_at); });
      var extra = (r[1].data || []).map(function (a) { return a.id; }).filter(function (id) { return !R[id]; });
      all = all.concat(extra); cnt = r[2] || {};
    } catch (e) { console.warn('Rozetler yüklenemedi:', e); }
    var seen = seenGet(uid), fresh = [];
    var nEarned = all.filter(function (id) { return earned.has(id); }).length;
    /* sıradaki: kilitli rozetlerden en çok ilerlemiş olan */
    var next = null, best = -1;
    all.forEach(function (id) {
      var m = R[id]; if (!m || earned.has(id) || !m[2] || cnt[m[2]] == null || cnt[m[2]] >= m[3]) return;
      var p = Math.min(1, cnt[m[2]] / m[3]); if (p > best) { best = p; next = id; }
    });
    var head = '<div class="rz-head"><span class="rz-count"><b>' + nEarned + '</b> / ' + all.length + ' rozet</span>' +
      (next ? '<span class="rz-next">sıradaki: <b>' + esc(R[next][0]) + '</b> · ' + Math.max(1, R[next][3] - (cnt[R[next][2]] || 0)) + ' ' + esc(R[next][4]) + ' kaldı</span>' : '') + '</div>';
    var cells = all.map(function (id, i) {
      var m = R[id] || [id, '', null, 1, '', 'b'], on = earned.has(id), have = m[2] && cnt[m[2]] != null ? Math.min(cnt[m[2]], m[3]) : null;
      if (on && seen && seen.indexOf(id) < 0) fresh.push(id);
      /* hedef dolmuş ama rozet henüz yazılmamışsa (sonraki işlemde verilir) "hazır" der, "1 / 1" demez */
      var prog = !on && have != null ? '<span class="rz-prog" aria-hidden="true"><i style="width:' + Math.round(100 * have / m[3]) + '%"></i></span><small class="rz-pn' + (have >= m[3] ? ' ready' : '') + '">' + (have >= m[3] ? 'hazır ✓' : have + ' / ' + m[3]) + '</small>' : '';
      var lbl = m[0] + (on ? ', kazanıldı' : ', kilitli' + (have != null ? ', ' + have + ' / ' + m[3] + ' ' + m[4] : ''));
      return '<div class="rz-c" style="--i:' + i + '"><button type="button" class="rz-m rz-' + m[5] + (on ? ' on' : '') + '" data-rz="' + esc(id) + '" aria-expanded="false" aria-label="' + esc(lbl) + '">' +
        '<span class="rz-hang">' + medalSvg(m[5], on) + '<span class="rz-ic" aria-hidden="true">' + esc((W.ACHIEVEMENTS_LOOKUP && W.ACHIEVEMENTS_LOOKUP[id] && W.ACHIEVEMENTS_LOOKUP[id].icon) || '★') + '</span>' + (on ? '' : '<span class="rz-lock" aria-hidden="true"></span>') + '</span>' +
        '<span class="rz-t">' + esc(m[0]) + '</span>' + prog + '</button></div>';
    }).join('');
    box.innerHTML = head + '<div class="rz-rows">' + cells + '</div>';
    box.__rz = { earned: earned, cnt: cnt };
    /* yeni kazanılan rozet rafa düşer (ilk açılışta hepsi değil; yalnızca son ziyaretten beri gelenler) */
    if (!RM) fresh.forEach(function (id, k) {
      var b = box.querySelector('[data-rz="' + id + '"]'); if (!b) return;
      b.classList.add('rz-drop'); b.style.setProperty('--d', (k * 0.35) + 's');
      setTimeout(function () { b.classList.add('rz-glint'); }, 900 + k * 350);
      setTimeout(function () { b.classList.remove('rz-drop', 'rz-glint'); }, 2600 + k * 350);
    });
    if (fresh.length) setTimeout(function () { var t = box.querySelector('.rz-count'); if (t) { t.classList.remove('rz-pop'); void t.offsetWidth; t.classList.add('rz-pop'); } }, 700);
    seenSet(uid, all.filter(function (id) { return earned.has(id); }));
  };
  var showTip = function (b) {
    var box = b.closest('#home-achievements-list'), st = box && box.__rz; if (!st) return;
    var was = b.getAttribute('aria-expanded') === 'true'; closeTip(); if (was) return;
    var id = b.getAttribute('data-rz'), m = R[id] || [id, '', null, 1, '', 'b'], on = st.earned.has(id), have = m[2] && st.cnt[m[2]] != null ? Math.min(st.cnt[m[2]], m[3]) : null;
    tip = D.createElement('div'); tip.className = 'rz-tip rz-' + m[5]; tip.setAttribute('role', 'dialog'); tip.setAttribute('aria-label', m[0]);
    tip.innerHTML = '<b>' + esc(m[0]) + '</b><small class="rz-tier">' + TIER[m[5]] + ' madalya</small><p>' + esc(m[1]) + '</p>' +
      (on ? '<p class="rz-ok">kazandın · ' + esc(dshort(st.earned.get(id))) + '</p>' : have != null ? '<p class="rz-left">' + (have >= m[3] ? 'hedef tamam; rozet bir sonraki işleminde rafına gelir' : have + ' / ' + m[3] + ' ' + esc(m[4]) + ' · ' + (m[3] - have) + ' kaldı') + '</p>' : '<p class="rz-left">henüz kazanılmadı</p>');
    var c = b.closest('.rz-c'); c.appendChild(tip); b.setAttribute('aria-expanded', 'true');
    var r = tip.getBoundingClientRect(), br = box.getBoundingClientRect();
    if (r.right > br.right) tip.style.left = Math.max(-c.offsetLeft, (br.right - r.right) + tip.offsetLeft) + 'px';
    if (r.left < br.left) tip.style.left = (tip.offsetLeft + br.left - r.left) + 'px';
  };
  D.addEventListener('click', function (e) { var b = e.target.closest('#home-achievements-list .rz-m'); if (b) showTip(b); });

  if (typeof renderStreakAndAchievements === 'function') { try { renderStreakAndAchievements = render; } catch (e) {} }
  W.renderStreakAndAchievements = render;
  W.AXRozet = { render: render, meta: R };
})();
