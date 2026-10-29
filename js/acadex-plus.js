/* ==========================================================================
   Acadex · panel eklentileri (acadex-plus.js)
   dashboard.js ve acadex-ink.js'e dokunmadan, onların açtığı kapılardan
   (window.__axaTools, axLabOpen, axSinavPrepare, jumpToFootnote ...) çalışır.

   - Bugün: "bugünün tek işi" — sınav takvimi, tekrar kutusu ve zayıf
     konulardan tek bir görev seçer; "başla" Pomodoro'yu açar ve işi başlatır.
   - Kaynakla çalış: özetteki bir cümleye dokun → "kaynağında gör": cümlenin
     geldiği kaynak cümle ve sayfa; tek tuşla belgede o sayfaya gider.
   - Bilgi kartları: "yazarak cevapla" modu (yazım farklarına toleranslı
     karşılaştırma, önerilen not) ve uzak/yakın kalınan kartlardan
     kendiliğinden oluşan "zor kartlar" destesi.
   - Sınav platformu: hata defterinde her dersin "yanlışlarımdan deneme"si;
     deneme o derste yanlış yaptığın kavramlara odaklanır.
   - Acadex sunum, prova: asetat başı süre bütçesi, "planın önünde/gerisinde",
     son 1 dakika uyarısı, karnede geçen provayla karşılaştırma.
   - Ctrl+K: aramaya Türkçe komutlar (git, başlat, hazırla, Acadia'ya sor...)
     ve ok tuşlarıyla gezinme.
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- ortak ---------- */
  var g = function (name) { try { return (0, eval)(name); } catch (e) { return undefined; } };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var X = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var ls = {
    get: function (k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* özel pencere */ } }
  };
  var me = function () { return g('currentUser') || window.currentUser || null; };
  var uid = function () { var u = me(); return (u && u.id) || 'anon'; };
  var sb = function () { return g('supabaseClient') || null; };
  var tools = function () { return window.__axaTools || null; };
  var go = function (v) { var f = window.switchDashboardView || g('switchDashboardView'); if (typeof f === 'function') f(v); };
  var alertMsg = function (t, m) { var f = window.showDashboardAlert || g('showDashboardAlert'); if (typeof f === 'function') f(t, m); };
  var reduce = function () { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var run = function (name, args) {
    var T = tools(); if (!T || !T[name]) return Promise.resolve(null);
    return Promise.race([Promise.resolve().then(function () { return T[name].run(args || {}); }), sleep(9000).then(function () { return null; })]).catch(function () { return null; });
  };
  var norm = function (t) {
    return String(t || '').toLocaleLowerCase('tr').replace(/[ıİ]/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  };
  var baseName = function (n) { n = String(n || '').replace(/\.[a-z0-9]{2,5}$/i, ''); var m = n.match(/^\d{10,}_(?:\d{10,}_)?(.+)$/); if (m) n = m[1]; return n.replace(/_+/g, ' ').trim() || 'İsimsiz belge'; };
  var cut = function (t, n) { t = String(t || ''); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t; };
  var mmss = function (s) { s = Math.max(0, Math.round(s)); return ('0' + Math.floor(s / 60)).slice(-2) + ':' + ('0' + (s % 60)).slice(-2); };
  var parseMs = function (t) { var m = String(t || '').match(/(\d+):(\d\d)/); return m ? (+m[1] * 60 + +m[2]) : 0; };

  var css = [
    /* bugünün tek işi */
    '.axt{position:relative;margin:18px auto 6px;max-width:min(1180px,calc(100% - 40px));box-sizing:border-box;background:#FFFEFB;color:#0D1838;border-radius:6px;padding:18px 22px 18px 26px;box-shadow:0 1px 0 #E6E2D6,0 22px 34px -26px rgba(13,24,56,.55);display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 22px;align-items:center;transform:rotate(-.25deg)}',
    '.axt::before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:4px;border-radius:2px;background:#2F6BFF}',
    '.axt-k{grid-column:1/-1;font-family:Caveat,"Segoe Print",cursive;font-size:22px;color:#2F6BFF;line-height:1}',
    '.axt-t{margin:0;font-family:"Bricolage Grotesque",system-ui,sans-serif;font-size:clamp(20px,2.2vw,26px);font-weight:800;letter-spacing:-.01em;line-height:1.15}',
    '.axt-w{margin:4px 0 0;font-size:14.5px;color:#4B5675;line-height:1.45}',
    '.axt-m{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}',
    '.axt-m span{font-family:"JetBrains Mono",monospace;font-size:11.5px;letter-spacing:.04em;color:#33405F;background:#EEF1F6;border-radius:999px;padding:3px 9px}',
    '.axt-a{display:flex;flex-direction:column;align-items:stretch;gap:6px}',
    '.axt-go{border:0;background:#2F6BFF;color:#fff;border-radius:999px;padding:12px 26px;min-height:48px;font:inherit;font-weight:700;font-size:16px;cursor:pointer;box-shadow:0 12px 22px -12px rgba(47,107,255,.8)}',
    '.axt-go:hover{background:#1F5FD6}.axt-go:disabled{opacity:.6;cursor:default}',
    '.axt-alt{border:0;background:none;color:#4B5675;font:inherit;font-size:14px;cursor:pointer;text-decoration:underline;text-underline-offset:3px;min-height:40px}',
    '.axt-load .axt-t{color:#8A93AB}',
    '.ax-dark .axt{background:#151C33;color:#E8ECF6;box-shadow:0 1px 0 #26304F,0 22px 34px -26px rgba(0,0,0,.8)}.ax-dark .axt-w{color:#AEB8D3}.ax-dark .axt-m span{background:#222B48;color:#C9D1E8}.ax-dark .axt-alt{color:#AEB8D3}',
    '@media (max-width:700px){.axt{grid-template-columns:minmax(0,1fr);margin:14px 12px 4px;max-width:none;padding:16px 16px 16px 20px}.axt-a{flex-direction:row;align-items:center}.axt-go{flex:1}}',
    /* kaynağında gör */
    '.axs-src{position:fixed;z-index:10050;width:min(380px,calc(100vw - 24px));box-sizing:border-box;background:#FFFEFB;color:#0D1838;border-radius:6px;padding:14px 16px 12px;box-shadow:0 1px 0 #E6E2D6,0 26px 44px -22px rgba(13,24,56,.6);font-size:14.5px;line-height:1.5}',
    '.axs-src[hidden]{display:none}',
    '.axs-src .k{display:block;font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:.08em;color:#6A7593;margin-bottom:6px}',
    '.axs-src blockquote{margin:0 0 10px;padding:8px 10px;border-left:3px solid #FFD966;background:#FFF8D9;border-radius:0 4px 4px 0;color:#1E2747}',
    '.axs-src .r{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}',
    '.axs-src button{border:1.5px solid #1A2A5C;background:#fff;color:#1A2A5C;border-radius:999px;padding:6px 14px;min-height:38px;font:inherit;font-weight:600;cursor:pointer}',
    '.axs-src button.p{background:#1A2A5C;color:#fff}',
    '.axs-src .n{color:#6A7593;font-size:13px;margin:0 0 8px}',
    '#sourcehub-view .sn.axs-hit{background:rgba(255,217,102,.45);border-radius:3px}',
    /* yazarak cevapla */
    '.axw-tg{display:inline-flex;align-items:center;gap:8px;margin:8px 0 0;font-size:14px;color:#33405F;cursor:pointer;min-height:40px;user-select:none}',
    '.axw-tg input{width:18px;height:18px;accent-color:#2F6BFF}',
    '.axw{margin:10px auto 0;max-width:560px;display:flex;flex-direction:column;gap:8px}',
    '.axw[hidden]{display:none}',
    '.axw-row{display:flex;gap:8px}.axw-row[hidden]{display:none}',
    '.axw-row input{flex:1;min-width:0;min-height:46px;padding:8px 14px;border:1.6px solid #C9D1E1;border-radius:8px;background:#fff;color:#0D1838;font:inherit;font-size:16px}',
    '.axw-row input:focus{outline:none;border-color:#2F6BFF;box-shadow:0 0 0 3px rgba(47,107,255,.18)}',
    '.axw-row button{border:0;background:#1A2A5C;color:#fff;border-radius:8px;padding:0 16px;min-height:46px;font:inherit;font-weight:700;cursor:pointer}',
    '.axw-v{margin:0;font-size:14.5px;line-height:1.45;color:#33405F}',
    '.axw-v b.ok{color:#1E8A55}.axw-v b.mid{color:#B7791F}.axw-v b.no{color:#C9483B}',
    '.axw-v s{color:#8A93AB}',
    '.axw-sug{box-shadow:0 0 0 3px #FFD966 !important}',
    '.axw-hard{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:14px;color:#4B5675}',
    '.axw-hard button{border:1.5px dashed #9DA8C3;background:#FBFAF6;color:#1A2A5C;border-radius:999px;padding:6px 14px;min-height:38px;font:inherit;font-weight:600;cursor:pointer}',
    '.axh-back{position:fixed;inset:0;z-index:10060;background:rgba(13,24,56,.55);display:flex;align-items:center;justify-content:center;padding:16px}',
    '.axh-back[hidden]{display:none}',
    '.axh{width:min(560px,100%);background:#FFFEFB;color:#0D1838;border-radius:8px;padding:20px 22px;box-shadow:0 40px 80px -40px rgba(13,24,56,.7);display:flex;flex-direction:column;gap:12px}',
    '.axh h2{margin:0;font-family:"Bricolage Grotesque",system-ui,sans-serif;font-size:22px;font-weight:800}',
    '.axh .k{font-family:Caveat,"Segoe Print",cursive;font-size:20px;color:#2F6BFF}',
    '.axh .q{margin:0;font-size:18px;line-height:1.45;padding:14px 16px;border:1px solid #E6E2D6;border-radius:6px;background:#fff}',
    '.axh .a{margin:0;font-size:15px;line-height:1.5;color:#1E2747;padding:10px 14px;background:#EEF3FF;border-radius:6px}',
    '.axh .r{display:flex;gap:8px;justify-content:space-between;align-items:center;flex-wrap:wrap}',
    '.axh .r button{border:1.5px solid #C9D1E1;background:#fff;color:#33405F;border-radius:999px;padding:8px 16px;min-height:42px;font:inherit;font-weight:600;cursor:pointer}',
    '.axh .r button.p{border-color:#1A2A5C;background:#1A2A5C;color:#fff}',
    /* yanlışlarımdan deneme */
    '.axe-b{border:1.5px solid #C9483B !important;background:#FFF5F3 !important;color:#8E2B20 !important}',
    '.axe-note{margin:8px 0 0;padding:8px 12px;border-radius:6px;background:#FFF5F3;color:#8E2B20;font-size:14px;line-height:1.4}.axe-note[hidden]{display:none}',
    /* prova */
    '.axr-pace{font-family:"JetBrains Mono",monospace;font-size:12.5px;letter-spacing:.03em;color:#C9D1E8;white-space:nowrap}',
    '.axr-pace.ahead{color:#7FE3B5}.axr-pace.behind{color:#FFB4A8}',
    '.axr-bud{display:block;font-family:"JetBrains Mono",monospace;font-size:12px;color:#6A7593;margin-top:-2px}',
    '.sx-rh-st.axr-over{color:#C9483B !important}',
    '.sx-rh.axr-last .sx-rh-t{animation:axrPulse 1s ease-in-out 3}',
    '@keyframes axrPulse{50%{color:#FFD966;transform:scale(1.08)}}',
    '.axr-cmp{margin:6px 0 0;font-size:14px;color:#33405F}',
    '.axr-d{font-family:"JetBrains Mono",monospace;font-size:11px;margin-left:6px}.axr-d.up{color:#C9483B}.axr-d.dn{color:#1E8A55}',
    /* komutlar */
    '.axk-kbd{font-family:"JetBrains Mono",monospace;font-size:11px;color:#6A7593;border:1px solid #DDE2EC;border-radius:4px;padding:1px 5px;margin-left:auto}',
    '#global-search-results .search-result-item.axk-on{outline:2px solid #2F6BFF;outline-offset:-2px;border-radius:6px}',
    '.axk-hint{font-size:12.5px;color:#6A7593;padding:6px 12px 2px}'
  ].join('\n');
  var injectCss = function () { if ($('#axp-css')) return; var st = document.createElement('style'); st.id = 'axp-css'; st.textContent = css; document.head.appendChild(st); };

  /* Pomodoro: Study Lab'in kendi düğmesiyle başlat (zaten sürüyorsa dokunma) */
  var pomRunning = function () { var c = document.getElementById('axl-chip'); return !!(c && !c.hidden); };
  var startPom = function (cardId) {
    if (pomRunning() || typeof window.axLabOpen !== 'function') return Promise.resolve(false);
    return window.axLabOpen('pomodoro', cardId || null).then(function () {
      return sleep(250).then(function () { var b = $('#studylab-view [data-pgo]'); if (b && !pomRunning()) b.click(); return true; });
    }).catch(function () { return false; });
  };

  /* ======================================================================
     1 · BUGÜNÜN TEK İŞİ
     ====================================================================== */
  var todayAt = 0, todayList = [], todayI = 0, todayBusy = false;
  var examsDetail = function () {
    var c = sb(), u = me(); if (!c || !u) return Promise.resolve([]);
    return Promise.resolve(c.from('exams').select('id, grade, completed_at, study_card_id, question_results, source_type, course_code, study_cards(course_tag, documents(file_name))').eq('user_id', u.id).not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(15))
      .then(function (r) { return (r && r.data) || []; }).catch(function () { return []; });
  };
  /* kavram → ortalama, hangi özetten */
  var weakFrom = function (exams) {
    var st = {};
    exams.forEach(function (e) {
      (Array.isArray(e.question_results) ? e.question_results : []).forEach(function (q) {
        var k = String(q.concept || '').trim(); if (!k) return;
        var o = st[k] = st[k] || { c: k, t: 0, n: 0, wrong: 0, card: e.study_card_id || null, name: e.study_cards && e.study_cards.documents ? baseName(e.study_cards.documents.file_name) : (e.course_code || '') };
        o.t += +q.score || 0; o.n++; if ((+q.score || 0) < 50) o.wrong++;
      });
    });
    return Object.keys(st).map(function (k) { var o = st[k]; o.avg = Math.round(o.t / o.n); return o; }).filter(function (o) { return o.avg < 70; }).sort(function (a, b) { return a.avg - b.avg; });
  };
  var daysTo = function (d) { var a = new Date(); a.setHours(0, 0, 0, 0); var b = new Date(d + 'T00:00:00'); return Math.round((b - a) / 864e5); };
  var buildToday = function () {
    var t0 = new Date(), iso = function (d) { var z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
    var to = new Date(t0.getTime() + 14 * 864e5);
    return Promise.all([
      run('list_planner_events', { from: iso(t0), to: iso(to) }),
      run('get_due_reviews'),
      examsDetail(),
      run('list_study_cards', {}),
      run('list_documents', {})
    ]).then(function (r) {
      var evs = (r[0] && r[0].events) || [], due = r[1] || {}, weak = weakFrom(r[2] || []), cards = (r[3] && r[3].study_cards) || [], docs = (r[4] && r[4].documents) || [];
      var exam = evs.filter(function (e) { return e.type === 'exam'; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0] || null;
      var dleft = exam ? daysTo(exam.date) : null;
      var soon = exam ? (dleft <= 0 ? exam.title + ' bugün' : exam.title + ' sınavına ' + dleft + ' gün') : '';
      var L = [];
      var dueN = due.total_due || 0, topDue = (due.cards || [])[0];
      var w = weak[0];
      var review = dueN ? { k: 'review', t: dueN + ' kartı tekrar et', w: (topDue && topDue.name ? 'En çok bekleyen: ' + topDue.name + '. ' : '') + 'Bugün sorulması gereken kartlar bunlar; aralıklı tekrar unutmadan önce yakalar.', mins: Math.max(5, Math.min(25, Math.round(dueN * 0.6))), card: topDue && topDue.card_id, act: function () { return run('start_smart_review', { card_id: topDue && topDue.card_id }); } } : null;
      var wrongs = w && w.card ? { k: 'wrongs', t: 'Yanlışlarından 6 soruluk deneme', w: '“' + w.c + '” kavramında ortalaman %' + w.avg + (soon ? ' · ' + soon + ' var.' : '.') + ' Deneme yalnızca yanlış yaptığın kavramlara odaklanır.', mins: 15, card: w.card, act: function () { return wrongsExam(w.card, w.name, weak.filter(function (x) { return x.card === w.card; }).map(function (x) { return x.c; })); } } : null;
      var feyn = w ? { k: 'feynman', t: '“' + cut(w.c, 48) + '” konusunu kendine anlat', w: 'Denemelerde bu kavramda %' + w.avg + ' aldın. Feynman yöntemiyle sade bir dille anlatmaya çalış; takıldığın yer, eksiğin.', mins: 25, card: w.card, act: function () { return run('open_study_method', { method: 'feynman', card_id: w.card || null }); } } : null;
      var last = cards[0];
      var read = last ? { k: 'read', t: '“' + cut(last.name, 52) + '” özetini oku', w: 'En son özetin bu. Okurken anlamadığın cümleye "? sorum var" işareti koy; sonra kartlarına geç.', mins: 20, card: last.id, act: function () { return run('open_study_card', { card_id: last.id }); } } : null;
      var cardsFirst = last && !dueN && !(due.cards || []).length ? { k: 'firstcards', t: 'Kart desteni ilk kez çevir', w: '“' + cut(last.name, 52) + '” özetinden kartların hazır; ilk turda nerede olduğunu görürsün.', mins: 15, card: last.id, act: function () { return run('start_smart_review', { card_id: last.id }); } } : null;
      if (dleft != null && dleft <= 7) [wrongs, review, feyn, read].forEach(function (x) { if (x) L.push(x); });
      else [dueN >= 5 ? review : null, wrongs, dueN < 5 ? review : null, feyn, cardsFirst, read].forEach(function (x) { if (x) L.push(x); });
      if (!L.length) L.push(docs.length
        ? { k: 'summarize', t: 'Bir belgeni özetle', w: 'Belgelerin hazır ama henüz özetin yok. Özet çıkınca kartların ve denemen de hazırlanabilir.', mins: 5, nopom: true, act: function () { go('docs'); return Promise.resolve(true); } }
        : { k: 'upload', t: 'İlk belgeni yükle', w: 'Bir ders slaytı ya da notun yeter; Acadex özetini, kartlarını ve denemeni hazırlar.', mins: 2, nopom: true, act: function () { go('docs'); return Promise.resolve(true); } });
      if (soon && L[0] && L[0].w.indexOf(soon) < 0) L[0].w = soon + ' var. ' + L[0].w;
      return L;
    });
  };
  var todayEl = null;
  var paintToday = function () {
    if (!todayEl) return;
    var it = todayList[todayI % Math.max(1, todayList.length)];
    if (!it) { todayEl.classList.add('axt-load'); $('.axt-t', todayEl).textContent = 'bakıyorum…'; return; }
    todayEl.classList.remove('axt-load');
    $('.axt-t', todayEl).textContent = it.t;
    $('.axt-w', todayEl).textContent = it.w;
    $('.axt-m', todayEl).innerHTML = '<span>~' + it.mins + ' DK</span>' + (it.nopom ? '' : '<span>25 DK POMODORO İLE</span>');
    var alt = $('.axt-alt', todayEl); alt.hidden = todayList.length < 2;
    $('.axt-go', todayEl).textContent = it.nopom ? 'git' : 'başla';
  };
  var mountToday = function () {
    var home = document.getElementById('home-view'), grid = home && $('.grid', home);
    if (!grid) return false;
    if (!todayEl || !document.contains(todayEl)) {
      injectCss();
      todayEl = document.createElement('section'); todayEl.className = 'axt axt-load'; todayEl.setAttribute('aria-labelledby', 'axt-t');
      todayEl.innerHTML = '<span class="axt-k">bugünün tek işi</span><div><h2 class="axt-t" id="axt-t">bakıyorum…</h2><p class="axt-w"></p><div class="axt-m"></div></div>' +
        '<div class="axt-a"><button type="button" class="axt-go">başla</button><button type="button" class="axt-alt" hidden>başka bir şey öner</button></div>';
      grid.parentNode.insertBefore(todayEl, grid);
      var fit = function () {
        if (!document.contains(todayEl) || !grid.offsetWidth) return;
        var first = $('.card', grid) || grid, fr = first.getBoundingClientRect(), pr = todayEl.parentNode.getBoundingClientRect(), last = $$('.card', grid).reduce(function (m, c) { var r = c.getBoundingClientRect(); return Math.max(m, r.right); }, fr.right);
        if (innerWidth <= 700) { todayEl.style.marginLeft = todayEl.style.marginRight = ''; return; }
        todayEl.style.maxWidth = 'none'; todayEl.style.marginLeft = Math.max(12, fr.left - pr.left) + 'px'; todayEl.style.marginRight = Math.max(12, pr.right - last) + 'px';
      };
      setTimeout(fit, 60); window.addEventListener('resize', fit, { passive: true });
      $('.axt-alt', todayEl).addEventListener('click', function () { todayI++; paintToday(); });
      $('.axt-go', todayEl).addEventListener('click', function () {
        var it = todayList[todayI % Math.max(1, todayList.length)]; if (!it || todayBusy) return;
        todayBusy = true; var b = this; b.disabled = true;
        (it.nopom ? Promise.resolve() : startPom(it.card)).then(function () { return sleep(it.nopom ? 0 : 300); }).then(function () { return it.act(); })
          .catch(function (e) { console.warn('bugünün işi', e); alertMsg('error', 'Bu iş şu an başlatılamadı; biraz sonra tekrar dener misin?'); })
          .then(function () { todayBusy = false; b.disabled = false; });
      });
    }
    return true;
  };
  var refreshToday = function (force) {
    if (!mountToday()) return;
    if (!force && Date.now() - todayAt < 120000 && todayList.length) { paintToday(); return; }
    todayAt = Date.now();
    if (!me() || !tools()) { setTimeout(function () { refreshToday(true); }, 1500); return; }
    buildToday().then(function (L) { todayList = L; todayI = 0; paintToday(); }).catch(function () { todayList = []; paintToday(); });
  };

  /* ======================================================================
     2 · ÖZETTEN KAYNAĞA ATLA (Kaynakla çalış)
     ====================================================================== */
  var srcPop = null, lastSn = null, lastPt = null;
  var activeCard = function () {
    var cs = g('sourceHubCards') || [], id = g('sourceHubActiveCardId');
    for (var i = 0; i < cs.length; i++) if (cs[i].id === id) return cs[i];
    return null;
  };
  var words = function (t) { return norm(t).split(' ').filter(function (w) { return w.length > 2; }); };
  var overlap = function (a, b) {
    var A = words(a), B = words(b); if (!A.length || !B.length) return 0;
    var bs = {}; B.forEach(function (w) { bs[w.slice(0, 6)] = 1; });
    var hit = A.filter(function (w) { return bs[w.slice(0, 6)]; }).length;
    return hit / Math.min(A.length, 14);
  };
  var findSource = function (sn) {
    var marks = $$('sup.footnote-marker', sn), card = activeCard(), fns = (card && Array.isArray(card.footnotes) ? card.footnotes : []);
    var byId = function (id) { for (var i = 0; i < fns.length; i++) if (String(fns[i].id) === String(id)) return fns[i]; return null; };
    var out = [];
    /* birden çok dipnotlu paragrafta: dokunulan yerden sonraki ilk dipnot o cümlenin kaynağıdır */
    if (marks.length > 1 && lastPt && document.caretRangeFromPoint) {
      try {
        var cr = document.caretRangeFromPoint(lastPt.x, lastPt.y);
        if (cr && sn.contains(cr.startContainer)) {
          var after = marks.filter(function (m) { return cr.comparePoint(m, 0) >= 0; });
          if (after.length) marks = [after[0]];
        }
      } catch (e) { /* hepsini göster */ }
    }
    marks.forEach(function (m) {
      var id = (m.textContent.match(/\d+/) || [])[0], f = id && byId(id);
      out.push({ id: +id, ref: (f && f.reference) || m.getAttribute('data-fn-ref') || '', page: f && f.page != null ? +f.page : null });
    });
    if (out.length) return { list: out, how: 'dipnot' };
    /* dipnotsuz cümle: kaynak cümlelerinden en çok örtüşeni bul */
    var text = sn.textContent, best = null, bs = 0;
    fns.forEach(function (f) { var s = overlap(text, f.reference || ''); if (s > bs) { bs = s; best = f; } });
    if (best && bs >= 0.34) return { list: [{ id: +best.id, ref: best.reference || '', page: best.page != null ? +best.page : null }], how: 'benzerlik' };
    /* aynı paragraftaki en yakın dipnot */
    var p = sn.closest('p, li'), pm = p && $('sup.footnote-marker', p);
    if (pm) { var pid = (pm.textContent.match(/\d+/) || [])[0], pf = byId(pid); return { list: [{ id: +pid, ref: (pf && pf.reference) || pm.getAttribute('data-fn-ref') || '', page: pf && pf.page != null ? +pf.page : null }], how: 'paragraf' }; }
    return null;
  };
  var hideSrc = function () { if (srcPop) srcPop.hidden = true; $$('#sourcehub-view .sn.axs-hit').forEach(function (s) { s.classList.remove('axs-hit'); }); };
  var showSrc = function (sn) {
    injectCss();
    if (!srcPop) {
      srcPop = document.createElement('div'); srcPop.className = 'axs-src'; srcPop.setAttribute('role', 'dialog'); srcPop.setAttribute('aria-label', 'Cümlenin kaynağı'); srcPop.hidden = true;
      document.body.appendChild(srcPop);
      srcPop.addEventListener('click', function (e) {
        var j = e.target.closest('[data-jump]');
        if (j) { var fnJ = window.jumpToFootnote || g('jumpToFootnote'); var pg = j.getAttribute('data-page'); if (typeof fnJ === 'function') fnJ(+j.getAttribute('data-jump'), j.getAttribute('data-ref') || '', pg === '' ? null : +pg); hideSrc(); return; }
        if (e.target.closest('[data-x]')) hideSrc();
      });
      document.addEventListener('click', function (e) { if (srcPop && !srcPop.hidden && !e.target.closest('.axs-src') && !e.target.closest('[data-axsrc]')) hideSrc(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && srcPop && !srcPop.hidden) hideSrc(); });
      window.addEventListener('scroll', function () { if (srcPop && !srcPop.hidden) hideSrc(); }, { passive: true, capture: true });
    }
    var s = findSource(sn), h = '<span class="k">KAYNAĞI</span>';
    if (!s) h += '<p class="n">Bu cümle için belgede işaretli bir kaynak bulamadım. Özet bu bölümü genel olarak anlatıyor olabilir.</p><div class="r"><button type="button" data-x="">tamam</button></div>';
    else {
      h += s.list.slice(0, 3).map(function (f) { return '<blockquote>' + X(cut(f.ref || 'kaynak cümlesi kayıtlı değil', 420)) + '</blockquote>'; }).join('');
      var f0 = s.list[0];
      h += '<p class="n">' + (f0.page != null ? 'belgede sayfa ' + f0.page : 'sayfa bilgisi yok') + (s.how === 'benzerlik' ? ' · cümleye en çok benzeyen kaynak' : s.how === 'paragraf' ? ' · aynı paragrafın kaynağı' : '') + '</p>' +
        '<div class="r"><button type="button" data-x="">kapat</button>' + (f0.page != null ? '<button type="button" class="p" data-jump="' + f0.id + '" data-page="' + f0.page + '" data-ref="' + X(cut(f0.ref, 200)) + '">belgede bu sayfayı aç (s. ' + f0.page + ')</button>' : '') + '</div>';
    }
    srcPop.innerHTML = h; srcPop.hidden = false;
    $$('#sourcehub-view .sn.axs-hit').forEach(function (x) { x.classList.remove('axs-hit'); }); sn.classList.add('axs-hit');
    var r = sn.getBoundingClientRect(), w = srcPop.offsetWidth, hh = srcPop.offsetHeight;
    srcPop.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left)) + 'px';
    srcPop.style.top = (r.bottom + 10 + hh < innerHeight ? r.bottom + 10 : Math.max(12, r.top - hh - 10)) + 'px';
    var f = $('button.p', srcPop) || $('button', srcPop); if (f) f.focus();
  };
  var srcWire = function () {
    var root = document.getElementById('sourcehub-view'), mpop = root && $('[data-mpop]', root), sum = document.getElementById('sourcehub-summary-text');
    if (!mpop || !sum || mpop.__axp) return;
    mpop.__axp = true; injectCss();
    var b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-axsrc', ''); b.textContent = '↪ kaynağında gör';
    mpop.appendChild(b);
    sum.addEventListener('click', function (e) { var s = e.target.closest('.sn'); if (s) { lastSn = s; lastPt = { x: e.clientX, y: e.clientY }; } }, true);
    sum.addEventListener('keydown', function (e) { var s = e.target.closest && e.target.closest('.sn'); if (s) { lastSn = s; lastPt = null; } }, true);
    b.addEventListener('click', function (e) { e.stopPropagation(); var s = lastSn; mpop.hidden = true; if (s && document.contains(s)) showSrc(s); });
  };

  /* ======================================================================
     3 · YAZARAK CEVAPLA + ZOR KARTLAR (Bilgi kartları)
     ====================================================================== */
  var lev = function (a, b) {
    if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
    var v0 = [], v1 = [], i, j; for (i = 0; i <= b.length; i++) v0[i] = i;
    for (i = 0; i < a.length; i++) { v1[0] = i + 1; for (j = 0; j < b.length; j++) v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + (a[i] === b[j] ? 0 : 1)); for (j = 0; j <= b.length; j++) v0[j] = v1[j]; }
    return v0[b.length];
  };
  /* 0..1: kısa cevapta harf benzerliği, uzunda (yazım hatalı) kelime örtüşmesi */
  var similar = function (typed, answer) {
    var a = norm(typed), b = norm(answer); if (!a) return 0; if (a === b) return 1;
    var r1 = 1 - lev(a, b) / Math.max(a.length, b.length);
    var A = a.split(' '), B = b.split(' ').filter(function (w) { return w.length > 1; });
    var near = function (w, list) { for (var i = 0; i < list.length; i++) { var x = list[i]; if (x === w) return true; if (w.length > 3 && x.length > 3 && 1 - lev(w, x) / Math.max(w.length, x.length) >= 0.75) return true; if (w.length >= 5 && x.length >= 5 && w.slice(0, 5) === x.slice(0, 5)) return true; /* Türkçe ekler: aynı kök */ } return false; };
    var hitA = A.filter(function (w) { return near(w, B); }).length, hitB = B.filter(function (w) { return near(w, A); }).length;
    var prec = A.length ? hitA / A.length : 0, rec = B.length ? hitB / B.length : 0, f1 = prec + rec ? 2 * prec * rec / (prec + rec) : 0;
    /* cevabın tamamını yazmasa da ana kelimeleri yazdıysa */
    var core = B.length > 6 ? Math.min(1, rec * 1.6) * prec : 0;
    return Math.max(r1, f1, core);
  };
  var HKEY = function () { return 'acadex.plus.hard.' + uid(); };
  var hardList = function () { return ls.get(HKEY(), []); };
  var hardSave = function (l) { ls.set(HKEY(), l.slice(-80)); };
  var hardAdd = function (front, back) { var l = hardList().filter(function (x) { return x.f !== front; }); l.push({ f: front, b: back, at: Date.now() }); hardSave(l); };
  var hardDrop = function (front) { hardSave(hardList().filter(function (x) { return x.f !== front; })); };
  var cardsWire = function () {
    var root = document.getElementById('cards-view'), table = document.getElementById('ktable'), big = root && $('[data-big]', root), bigIn = root && $('[data-big-in]', root);
    if (!root || !table || !big || !bigIn || table.__axp) return;
    table.__axp = true; injectCss();
    var on = !!ls.get('acadex.plus.typing', false);
    var modes = $('[data-mode]', root) && $('[data-mode]', root).parentNode;
    var tg = document.createElement('label'); tg.className = 'axw-tg'; tg.innerHTML = '<input type="checkbox"' + (on ? ' checked' : '') + '> yazarak cevapla';
    if (modes && modes.parentNode) modes.parentNode.insertBefore(tg, modes.nextSibling);
    var box = document.createElement('div'); box.className = 'axw'; box.hidden = true;
    box.innerHTML = '<div class="axw-row"><input type="text" autocomplete="off" spellcheck="false" placeholder="cevabını yaz, Enter ile kontrol et" aria-label="Cevabını yaz"><button type="button">kontrol et</button></div><p class="axw-v" aria-live="polite"></p><div class="axw-hard"></div>';
    table.parentNode.insertBefore(box, table.nextSibling);
    var inp = $('input', box), chk = $('.axw-row button', box), verdict = $('.axw-v', box), hardEl = $('.axw-hard', box);
    var state = { front: '', typed: '', checked: false };
    var paintHard = function () {
      var n = hardList().length;
      hardEl.innerHTML = n ? '<span>yazarken zorlandığın <b>' + n + '</b> kart birikti.</span><button type="button" data-hard="">zor kartları çalış</button>' : '';
    };
    var clearSug = function () { $$('.axw-sug', root).forEach(function (x) { x.classList.remove('axw-sug'); }); };
    var sync = function () {
      var q = $('.q', bigIn), a = $('.a', bigIn), flipped = big.classList.contains('back');
      if (!on) { box.hidden = true; return; }
      if (!flipped && q) {
        var f = q.textContent.trim();
        if (f !== state.front) { state = { front: f, typed: '', checked: false }; inp.value = ''; verdict.textContent = ''; clearSug(); }
        box.hidden = false; $('.axw-row', box).hidden = false;
      } else if (flipped && a && state.checked) {
        box.hidden = false; $('.axw-row', box).hidden = true;
      } else if (!q && !a) { box.hidden = !hardList().length; $('.axw-row', box).hidden = true; verdict.textContent = ''; }
      else { box.hidden = true; }
      paintHard();
    };
    var check = function () {
      if (!state.front || state.checked) return;
      state.typed = inp.value.trim(); state.checked = true;
      if (!big.classList.contains('back')) big.click();
      setTimeout(function () {
        var a = $('.a', bigIn), ans = a ? a.textContent.trim() : '';
        var s = similar(state.typed, ans), lvl = !state.typed ? 'no' : s >= 0.8 ? 'ok' : s >= 0.5 ? 'mid' : 'no';
        verdict.innerHTML = (state.typed ? 'yazdığın: <s>' + X(cut(state.typed, 120)) + '</s> · ' : '') +
          (lvl === 'ok' ? '<b class="ok">doğru</b> — küçük yazım farkları sayılmadı.' : lvl === 'mid' ? '<b class="mid">yakın</b> — ana fikir var, eksik ya da farklı kısımlar var.' : '<b class="no">' + (state.typed ? 'uzak' : 'boş bıraktın') + '</b> — bu kart zor kartlara eklendi.');
        if (lvl === 'ok') hardDrop(state.front); else hardAdd(state.front, ans);
        /* önerilen not: akıllı tekrarda 4'lü, diğerlerinde ikili düğmeler */
        clearSug();
        var smart = !$('[data-judge4]', root).hidden;
        var sel = smart ? (lvl === 'ok' ? '[data-r="good"]' : lvl === 'mid' ? '[data-r="hard"]' : '[data-r="again"]') : (lvl === 'no' ? '[data-j="0"]' : '[data-j="1"]');
        var sb2 = $(sel, root); if (sb2) { sb2.classList.add('axw-sug'); try { sb2.focus({ preventScroll: true }); } catch (e) { sb2.focus(); } }
        sync();
      }, reduce() ? 30 : 260);
    };
    chk.addEventListener('click', check);
    inp.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); check(); } });
    $('input', tg).addEventListener('change', function () { on = this.checked; ls.set('acadex.plus.typing', on); sync(); if (on && !box.hidden) inp.focus(); });
    root.addEventListener('click', function (e) { if (e.target.closest('[data-j], [data-r]')) clearSug(); if (e.target.closest('[data-hard]')) openHard(); });
    new MutationObserver(function () { requestAnimationFrame(sync); }).observe(bigIn, { childList: true, subtree: true });
    new MutationObserver(function () { requestAnimationFrame(sync); }).observe(big, { attributes: true, attributeFilter: ['class'] });
    sync();
  };
  /* zor kartlar: küçük bir çalışma penceresi (SM-2 kaydını değiştirmez; doğru yazınca listeden çıkar) */
  var hardBack = null;
  var openHard = function () {
    injectCss();
    var list = hardList().slice().reverse(); if (!list.length) return;
    if (!hardBack) {
      hardBack = document.createElement('div'); hardBack.className = 'axh-back'; hardBack.hidden = true;
      hardBack.innerHTML = '<div class="axh" role="dialog" aria-modal="true" aria-labelledby="axh-t"><span class="k">zor kartlar</span><h2 id="axh-t"></h2><p class="q"></p>' +
        '<div class="axw-row"><input type="text" autocomplete="off" spellcheck="false" placeholder="cevabını yaz" aria-label="Cevabını yaz"><button type="button" data-hc="">kontrol et</button></div>' +
        '<p class="axw-v" aria-live="polite"></p><p class="a" hidden></p><div class="r"><button type="button" data-hx="">kapat</button><button type="button" class="p" data-hn="">sonraki</button></div></div>';
      document.body.appendChild(hardBack);
      hardBack.addEventListener('click', function (e) { if (e.target === hardBack || e.target.closest('[data-hx]')) closeHard(); else if (e.target.closest('[data-hc]')) hcCheck(); else if (e.target.closest('[data-hn]')) hcNext(); });
      hardBack.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Escape') closeHard(); if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); hcCheck(); } });
    }
    var H = { list: list, i: 0, done: false }; hardBack.__H = H;
    var paint = function () {
      var it = H.list[H.i]; H.done = false;
      $('#axh-t', hardBack).textContent = (H.i + 1) + ' / ' + H.list.length;
      $('.q', hardBack).textContent = it.f; $('.a', hardBack).hidden = true; $('.a', hardBack).textContent = it.b;
      $('.axw-v', hardBack).textContent = ''; var inp = $('input', hardBack); inp.value = ''; $('.axw-row', hardBack).hidden = false; inp.focus();
      $('[data-hn]', hardBack).textContent = H.i + 1 < H.list.length ? 'sonraki' : 'bitir';
    };
    hardBack.__paint = paint; hardBack.hidden = false; document.documentElement.style.overflow = 'hidden'; paint();
  };
  var hcCheck = function () {
    var H = hardBack.__H, it = H.list[H.i]; if (H.done) { hcNext(); return; }
    var typed = $('input', hardBack).value.trim(), s = similar(typed, it.b), lvl = !typed ? 'no' : s >= 0.8 ? 'ok' : s >= 0.5 ? 'mid' : 'no';
    H.done = true; $('.a', hardBack).hidden = false; $('.axw-row', hardBack).hidden = true;
    $('.axw-v', hardBack).innerHTML = lvl === 'ok' ? '<b class="ok">doğru</b> — bu kart zor kartlardan çıktı.' : lvl === 'mid' ? '<b class="mid">yakın</b> — listede kalıyor, bir daha sorarım.' : '<b class="no">uzak</b> — cevabı oku, sonra kendi cümlenle tekrar et.';
    if (lvl === 'ok') hardDrop(it.f);
    $('[data-hn]', hardBack).focus();
  };
  var hcNext = function () { var H = hardBack.__H; if (H.i + 1 >= H.list.length) { closeHard(); return; } H.i++; hardBack.__paint(); };
  var closeHard = function () { if (!hardBack) return; hardBack.hidden = true; document.documentElement.style.overflow = ''; var t = document.getElementById('ktable'); if (t && t.__axp) { var ev = new Event('axp-sync'); t.dispatchEvent(ev); } var hb = $('.axw-hard'); if (hb) { var n = hardList().length; hb.innerHTML = n ? '<span>yazarken zorlandığın <b>' + n + '</b> kart birikti.</span><button type="button" data-hard="">zor kartları çalış</button>' : ''; } };

  /* ======================================================================
     4 · YANLIŞLARIMDAN DENEME (Sınav platformu)
     ====================================================================== */
  var wrongFocus = null; /* { text, until } — bir sonraki generate-exam isteğine eklenir */
  var fetchWrapped = false;
  var wrapFetch = function () {
    if (fetchWrapped || typeof window.fetch !== 'function') return; fetchWrapped = true;
    var of = window.fetch;
    window.fetch = function (input, init) {
      try {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        if (wrongFocus && wrongFocus.until > Date.now() && /\/functions\/v1\/generate-exam/.test(url) && init && typeof init.body === 'string') {
          var b = JSON.parse(init.body);
          if (!b.focusConcept) { b.focusConcept = wrongFocus.text; init = Object.assign({}, init, { body: JSON.stringify(b) }); }
          wrongFocus = null;
        }
      } catch (e) { /* olduğu gibi gönder */ }
      return of.apply(this, [input, init]);
    };
  };
  var focusText = function (concepts) {
    var t = ''; (concepts || []).forEach(function (c) { c = String(c || '').trim(); if (!c) return; var n = t ? t + ', ' + c : c; if (n.length <= 112) t = n; });
    return t ? 'yanlış yaptığı kavramlar: ' + t : '';
  };
  var builderNote = function (text) {
    var n = $('[data-bd-note]'), d = n && n.closest('dialog'); if (!n) return;
    var p = d && $('.axe-note', d);
    if (!p) { p = document.createElement('p'); p.className = 'axe-note'; n.parentNode.insertBefore(p, n); }
    p.textContent = '🎯 Odak: ' + text; p.hidden = false;
    if (d && !d.__axp) {
      d.__axp = true;
      d.addEventListener('close', function () { setTimeout(function () { if (wrongFocus && !wrongFocus.sent) wrongFocus = null; var q = $('.axe-note', d); if (q && !wrongFocus) q.hidden = true; }, 1500); });
    }
  };
  /* özet kaynaklı deneme: formu hazırla, odak metnini iste */
  var wrongsExam = function (cardId, cardName, concepts) {
    var ft = focusText(concepts); if (!ft) ft = 'yanlış yaptığı sorular';
    wrapFetch();
    if (typeof window.axSinavPrepare !== 'function') { go('exams'); return Promise.resolve(false); }
    return window.axSinavPrepare({ cardId: cardId, cardName: cardName, count: 6 }).then(function () {
      wrongFocus = { text: ft, until: Date.now() + 15 * 60e3 };
      builderNote(ft.replace(/^yanlış yaptığı kavramlar: /, 'yanlış yaptığın kavramlar — '));
      return true;
    });
  };
  var errsWire = function () {
    var box = $('[data-errs]'); if (!box || box.__axp) return; box.__axp = true; injectCss();
    var deco = function () {
      $$('.sn-eg', box).forEach(function (g0) {
        var h = $('.sn-eg-h', g0); if (!h || $('[data-axe]', h)) return;
        var con = $$('.axs-wk span', g0).map(function (s) { var t = s.cloneNode(true); $$('b', t).forEach(function (x) { x.remove(); }); return t.textContent.trim(); }).filter(Boolean);
        if (!con.length) return;
        var b = document.createElement('button'); b.type = 'button'; b.className = 'btn axe-b'; b.setAttribute('data-axe', ''); b.textContent = 'yanlışlarımdan deneme';
        b.title = 'Odak: ' + con.join(', ');
        h.appendChild(b);
        b.addEventListener('click', function (e) {
          e.stopPropagation(); wrapFetch();
          var ft = focusText(con);
          var pr = $('[data-practice]', h), re = $('[data-retry]', h);
          if (pr) { pr.setAttribute('data-concept', ft.replace(/^yanlış yaptığı kavramlar: /, '')); pr.click(); return; }
          if (re) { re.click(); setTimeout(function () { wrongFocus = { text: ft, until: Date.now() + 15 * 60e3 }; builderNote(ft.replace(/^yanlış yaptığı kavramlar: /, 'yanlış yaptığın kavramlar — ')); }, 450); }
        });
      });
    };
    new MutationObserver(deco).observe(box, { childList: true });
    deco();
    document.addEventListener('click', function (e) { if (e.target.closest('#btn-generate-exam') && wrongFocus) wrongFocus.sent = true; }, true);
  };

  /* ======================================================================
     5 · PROVA: süre bütçesi, plana göre durum, son dakika, geçen provayla karşılaştırma
     ====================================================================== */
  var rhWire = function () {
    var rh = $('.sx-rh[data-rh]'); if (!rh || rh.__axp) return; rh.__axp = true; injectCss();
    var top = $('.sx-rh-top', rh), totEl = $('[data-rh-total]', rh), slEl = $('[data-rh-slide]', rh), posEl = $('[data-rh-pos]', rh), goalEl = $('[data-rh-goal]', rh), card = $('[data-rh-card]', rh);
    var pace = document.createElement('span'); pace.className = 'axr-pace'; pace.setAttribute('aria-live', 'off');
    if (totEl) totEl.parentNode.insertBefore(pace, totEl.nextSibling);
    var bud = document.createElement('span'); bud.className = 'axr-bud';
    if (slEl) slEl.parentNode.insertBefore(bud, slEl.nextSibling);
    var prev = null, tick = 0, warned = false;
    var beep = function () {
      try { var A = window.AudioContext || window.webkitAudioContext; if (!A) return; var ac = beep.ac || (beep.ac = new A()), t = ac.currentTime, o = ac.createOscillator(), gn = ac.createGain();
        o.type = 'sine'; o.frequency.value = 740; gn.gain.setValueAtTime(.0001, t); gn.gain.exponentialRampToValueAtTime(.12, t + .02); gn.gain.exponentialRampToValueAtTime(.0001, t + .4); o.connect(gn); gn.connect(ac.destination); o.start(t); o.stop(t + .45); } catch (e) { /* ses yok */ }
    };
    var loop = function () {
      if (rh.hidden || (card && !card.hidden)) return;
      var tot = parseMs(totEl.textContent), sl = parseMs(slEl.textContent), m = String(posEl.textContent).match(/(\d+)\s*\/\s*(\d+)/);
      var goal = (+goalEl.value || 10) * 60; if (!m) return;
      var i = +m[1] - 1, n = +m[2], per = goal / Math.max(1, n);
      bud.textContent = 'bütçe ' + mmss(per);
      slEl.classList.toggle('axr-over', sl > per * 1.15);
      var expected = i * per + Math.min(sl, per), diff = Math.round(expected - tot);
      if (tot < 5) { pace.textContent = ''; pace.className = 'axr-pace'; }
      else if (Math.abs(diff) < 8) { pace.textContent = 'planla aynı hızdasın'; pace.className = 'axr-pace'; }
      else if (diff > 0) { pace.textContent = 'planın ' + mmss(diff) + ' önündesin'; pace.className = 'axr-pace ahead'; }
      else { pace.textContent = 'planın ' + mmss(-diff) + ' gerisindesin'; pace.className = 'axr-pace behind'; }
      if (!warned && goal - tot <= 60 && goal - tot > 0) { warned = true; rh.classList.remove('axr-last'); void rh.offsetWidth; rh.classList.add('axr-last'); beep(); pace.textContent = 'son 1 dakika'; }
    };
    var karne = function () {
      if (!card || card.hidden || card.__axp === card.innerHTML.length) return;
      var now = ls.get('acadex.sunum.lastRehearsal', null);
      if (!prev || !now || !prev.per || !now.per) { card.__axp = card.innerHTML.length; return; }
      var d = Math.round((now.total - prev.total) / 1000);
      var p = document.createElement('p'); p.className = 'axr-cmp';
      p.textContent = Math.abs(d) < 3 ? 'Geçen provayla hemen hemen aynı sürede bitirdin.' : 'Geçen provadan ' + mmss(Math.abs(d)) + (d < 0 ? ' kısa' : ' uzun') + ' sürdü.';
      var big = $('.big', card); if (big) big.parentNode.insertBefore(p, big.nextSibling);
      if (prev.per.length === now.per.length) {
        $$('ol > li', card).forEach(function (li, i) {
          var dd = Math.round((now.per[i] - prev.per[i]) / 1000); if (Math.abs(dd) < 3) return;
          var s = $('.s', li); if (!s) return; var sp = document.createElement('span'); sp.className = 'axr-d ' + (dd > 0 ? 'up' : 'dn'); sp.textContent = (dd > 0 ? '+' : '−') + mmss(Math.abs(dd)); s.appendChild(sp);
        });
      }
      card.__axp = card.innerHTML.length;
    };
    new MutationObserver(function () {
      if (!rh.hidden && !tick) { prev = ls.get('acadex.sunum.lastRehearsal', null); warned = false; tick = setInterval(loop, 250); }
      if (rh.hidden && tick) { clearInterval(tick); tick = 0; rh.classList.remove('axr-last'); }
    }).observe(rh, { attributes: true, attributeFilter: ['hidden'] });
    if (card) new MutationObserver(function () { if (!card.hidden) setTimeout(karne, 30); else card.__axp = 0; }).observe(card, { attributes: true, attributeFilter: ['hidden'], childList: true });
    /* tekrar prova: yeni karşılaştırma temeli */
    rh.addEventListener('click', function (e) { if (e.target.closest('[data-rh-again]')) { setTimeout(function () { prev = ls.get('acadex.sunum.lastRehearsal', null); warned = false; }, 0); } }, true);
  };

  /* ======================================================================
     6 · Ctrl+K: Türkçe komutlar ve ok tuşlarıyla gezinme
     ====================================================================== */
  var CMDS = [
    { t: 'Bugün', s: 'ana sayfa, bugünün tek işi', k: 'ana sayfa home bugun masa', v: 'home' },
    { t: 'Çalışma planlayıcı', s: 'takvim ve sınav tarihleri', k: 'planlayici takvim plan etkinlik', v: 'planner' },
    { t: 'Çalışma defteri', s: 'yaz, çiz, sakla', k: 'defter not kalem', v: 'notebook' },
    { t: 'Bilgi kartları', s: 'desteler ve tekrar kutusu', k: 'kart deste tekrar flashcard', v: 'cards' },
    { t: 'Kaynakla çalış', s: 'belge, özet ve Acadia yan yana', k: 'kaynak ozet belge oku', v: 'sourcehub' },
    { t: 'Acadex Study Lab', s: 'çalışma yöntemleri', k: 'study lab yontem pomodoro feynman', v: 'studylab' },
    { t: 'Acadex MedLab', s: 'tıp öğrencileri için laboratuvarlar', k: 'medlab tip anatomi lab 3b model spot', v: 'medlab' },
    { t: 'Acadex Finans', s: 'finans, muhasebe, dış ticaret istasyonları', k: 'finans muhasebe borsa portfoy dis ticaret incoterms kur faiz opsiyon butce', v: 'finans' },
    { t: 'Belgelerim', s: 'yüklediğin dosyalar', k: 'belge dosya pdf yukle', v: 'docs' },
    { t: 'Bölüm akışı', s: 'arkadaşlarının özetleri', k: 'akis bolum pano arkadas', v: 'feed' },
    { t: 'Acadex sunum', s: 'asetatlar ve prova', k: 'sunum slayt prova', v: 'acadexsunum' },
    { t: 'Sınav platformu', s: 'denemeler, hata defteri, karne', k: 'sinav deneme hata defteri karne', v: 'exams' },
    { t: 'Ayarlar', s: 'profil, görünüm, bildirimler', k: 'ayarlar profil sifre tema', v: 'settings' },
    { t: 'Sandbox etkileşim paneli', s: 'bölümün projeleri', k: 'sandbox proje etkilesim', v: 'sandbox-interaction' },
    { t: 'Geliştirici sandbox', s: 'kendi projelerin', k: 'gelistirici sandbox kod', v: 'sandbox' },
    { t: 'Pomodoro başlat', s: '25 dakika odak', k: 'pomodoro odak zamanlayici basla', a: function () { startPom(null).then(function (ok) { if (!ok) alertMsg('info', pomRunning() ? 'Pomodoro zaten sürüyor.' : 'Pomodoro açılamadı.'); }); } },
    { t: 'Akıllı tekrarı başlat', s: 'bugün sorulacak kartlar', k: 'akilli tekrar kart review', a: function () { run('start_smart_review', {}); } },
    { t: 'Yeni deneme sınavı hazırla', s: 'özetinden ya da dersten', k: 'yeni sinav deneme hazirla olustur', a: function () { if (typeof window.axSinavPrepare === 'function') window.axSinavPrepare({}); else go('exams'); } },
    { t: 'Planlayıcıya etkinlik ekle', s: 'sınav, ödev ya da çalışma', k: 'etkinlik ekle planla odev', a: function () { go('planner'); setTimeout(function () { if (typeof window.acxPlanOpen === 'function') window.acxPlanOpen(); }, 250); } },
    { t: 'Belge yükle', s: 'PDF, Word, PowerPoint', k: 'belge yukle dosya pdf', a: function () { go('docs'); } },
    { t: 'Bugünün tek işini aç', s: 'ne çalışacağına birlikte karar verelim', k: 'bugun tek is ne calisayim', a: function () { go('home'); setTimeout(function () { if (todayEl) todayEl.scrollIntoView({ block: 'center', behavior: reduce() ? 'auto' : 'smooth' }); }, 300); } },
    { t: 'Avatarını düzenle', s: 'avatar stüdyosu', k: 'avatar profil foto studyo', a: function () { if (typeof window.openAvatarBuilder === 'function') window.openAvatarBuilder(); } },
    { t: 'Temayı değiştir', s: 'açık · gece masası · saate göre', k: 'tema karanlik gece acik', a: function () { var b = document.getElementById('ax-theme'); if (b) b.click(); } }
  ];
  var cmdMatch = function (q) {
    var n = norm(q); if (!n) return CMDS.slice();
    var ws = n.split(' ');
    var score = function (c) { var t = norm(c.t); if (t.indexOf(n) === 0) return 0; if (ws.every(function (w) { return t.indexOf(w) > -1; })) return 1; return 2; };
    return CMDS.filter(function (c) { var hay = norm(c.t + ' ' + c.s + ' ' + c.k); return ws.every(function (w) { return hay.indexOf(w) > -1; }); })
      .map(function (c, i) { return { c: c, s: score(c), i: i }; }).sort(function (a, b) { return a.s - b.s || a.i - b.i; }).map(function (x) { return x.c; });
  };
  var ICON = '<div class="search-result-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="color:#2F6BFF"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>';
  var askHtml = function (q) {
    if (!q || q.trim().length < 3) return '';
    return '<div data-axk=""><div class="search-results-group-title">Acadia</div><ul class="search-results-list"><li><a class="search-result-item" href="#" data-axk-i="ask" data-axk-q="' + X(q.trim()) + '">' + ICON + '<div class="search-result-text"><span>' + X('Acadia’ya sor: “' + cut(q.trim(), 60) + '”') + '</span><span class="search-result-subtext">cevabı sağdaki panelde yazar</span></div></a></li></ul></div>';
  };
  var cmdHtml = function (q, list) {
    var all = list; if (!all.length) return '';
    return '<div data-axk=""><div class="search-results-group-title">Komutlar ve sayfalar (' + all.length + ')</div><ul class="search-results-list">' + all.map(function (c, i) {
      var idx = c.ask ? 'ask' : CMDS.indexOf(c);
      return '<li><a class="search-result-item" href="#" data-axk-i="' + idx + '"' + (c.ask ? ' data-axk-q="' + X(c.ask) + '"' : '') + '>' + ICON + '<div class="search-result-text"><span>' + X(c.t) + '</span><span class="search-result-subtext">' + X(c.s) + '</span></div>' + (i === 0 ? '<span class="axk-kbd">Enter</span>' : '') + '</a></li>';
    }).join('') + '</ul></div>';
  };
  var paletteWire = function () {
    var ov = document.getElementById('global-search-overlay'), inp = document.getElementById('global-search-input'), res = document.getElementById('global-search-results');
    if (!ov || !inp || !res || ov.__axp) return; ov.__axp = true; injectCss();
    inp.setAttribute('placeholder', 'ara ya da komut yaz: belge, kart, “pomodoro”, “yeni sınav”…');
    var orig = window.executeGlobalSearch;
    if (typeof orig === 'function') {
      var wrapped = function (query, container) {
        return Promise.resolve(orig.apply(this, arguments)).then(function () {
          try {
            $$('.search-results-group-title', container).forEach(function (t) { if (/Quick Actions/i.test(t.textContent)) t.parentNode.remove(); });
            var empty = $('.search-empty-state', container), h = cmdHtml(query, cmdMatch(query)), ask = askHtml(query);
            if (empty) container.innerHTML = (h || '') + (ask || '') || '<div class="search-empty-state">Eşleşen bir şey bulamadım.</div>';
            else { if (h) container.insertAdjacentHTML('afterbegin', h); if (ask) container.insertAdjacentHTML('beforeend', ask); }
            /* aramanın İngilizce başlıkları */
            var TR = { 'documents': 'Belgeler', 'study cards': 'Özetler', 'exams': 'Denemeler', 'exam results': 'Denemeler', 'completed exams': 'Çözülen denemeler' };
            $$('.search-results-group-title', container).forEach(function (t) { var m = t.textContent.match(/^\s*([A-Za-z ]+?)\s*(\(\d+\))?\s*$/); if (m && TR[m[1].toLowerCase()]) t.textContent = TR[m[1].toLowerCase()] + (m[2] ? ' ' + m[2] : ''); });
            $$('.search-result-subtext', container).forEach(function (t) { t.textContent = t.textContent.replace(/\s*•\s*Size:\s*NaN KB/, '').replace(/^Status:\s*summarized/, 'özetlendi').replace(/^Status:\s*/, 'durum: '); });
            mark(0);
          } catch (e) { /* aramanın kendisi çalışmaya devam eder */ }
        });
      };
      window.executeGlobalSearch = wrapped;
    }
    var showAll = function () { res.innerHTML = '<p class="axk-hint">yazmaya başla ya da bir komut seç · ↑ ↓ ile gez, Enter ile aç</p>' + cmdHtml('', CMDS.filter(function (c) { return c.a; }).concat(CMDS.filter(function (c) { return c.v; }))); mark(0); };
    new MutationObserver(function () { if (ov.classList.contains('active') && !inp.value.trim()) setTimeout(showAll, 0); }).observe(ov, { attributes: true, attributeFilter: ['class'] });
    inp.addEventListener('input', function () { if (!inp.value.trim()) setTimeout(showAll, 0); });
    var items = function () { return $$('.search-result-item', res); };
    var cur = 0;
    var mark = function (i) { var l = items(); if (!l.length) return; cur = (i + l.length) % l.length; l.forEach(function (x, j) { x.classList.toggle('axk-on', j === cur); }); var el = l[cur]; if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' }); };
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); mark(cur + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); mark(cur - 1); }
      else if (e.key === 'Enter' && !e.isComposing) { var l = items(); if (l[cur]) { e.preventDefault(); l[cur].click(); } }
    });
    res.addEventListener('click', function (e) {
      var a = e.target.closest('[data-axk-i]'); if (!a) return;
      e.preventDefault(); e.stopPropagation(); ov.classList.remove('active');
      var i = a.getAttribute('data-axk-i');
      if (i === 'ask') { if (typeof window.axAcadiaAsk === 'function') window.axAcadiaAsk(a.getAttribute('data-axk-q')); return; }
      var c = CMDS[+i]; if (!c) return;
      if (c.v) go(c.v); else if (c.a) c.a();
    });
  };

  /* ---------- açılış ---------- */
  var wireAll = function () { srcWire(); cardsWire(); errsWire(); rhWire(); paletteWire(); };
  var boot = function () {
    injectCss();
    var tries = 0;
    var tick = function () { wireAll(); if (document.getElementById('home-view') && document.getElementById('home-view').classList.contains('active')) refreshToday(false); if (++tries < 20) setTimeout(tick, 1000); };
    tick();
    var sw = window.switchDashboardView;
    if (typeof sw === 'function' && !sw.__axp) {
      var w = function (v) { var r = sw.apply(this, arguments); setTimeout(function () { wireAll(); if (v === 'home') refreshToday(false); }, 120); return r; };
      w.__axp = true; window.switchDashboardView = w;
    }
    /* bir şey bitince (özet, sınav, kart kaydı) bugünün işi yeniden düşünülsün */
    var al = window.showDashboardAlert;
    if (typeof al === 'function' && !al.__axp) { var wa = function (t) { if (t === 'success') todayAt = 0; return al.apply(this, arguments); }; wa.__axp = true; wa.__avs = al.__avs; window.showDashboardAlert = wa; }
    wrapFetch();
  };
  window.AcxPlus = { today: function () { refreshToday(true); }, wrongsExam: wrongsExam, similar: similar };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
