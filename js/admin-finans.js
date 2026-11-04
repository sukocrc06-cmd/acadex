/* ==========================================================================
   Acadex · Yönetim paneli · FİNANS (js/admin-finans.js) — 04.11.2026
   "Planlar ve kota"nın yerini alır. Sekmeler: Pano · Planlar ve kota · Maliyet ·
   Gider · Simülatör · Görevler · Rapor.
   Yetki veritabanında: fin_* fonksiyonları ve tabloları yalnız yöneticiye ve
   "finans" rolüne açılır (supabase/migrations/20261104_finans.sql). Finans rolü
   öğrencilerin kişisel verisini görmez; gelen her sayı toplamdır.
   Para veritabanında KURUŞ (tam sayı) tutulur; ekranda TL gösterilir.
   ========================================================================== */
(function () {
  'use strict';
  var A = window.AXADM; if (!A) return;
  var X = A.X, NF = A.NF, DT = A.DT, $ = A.$, $$ = A.$$, rpc = A.rpc, sb = A.sb, toast = A.toast, errMsg = A.errMsg;

  /* ---------- yardımcılar ---------- */
  var TL = function (k, dec) { var v = Number(k || 0) / 100; return v.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: dec ? 2 : 0, maximumFractionDigits: dec ? 2 : 0 }); };
  var TLn = function (v, dec) { return TL(Math.round(Number(v || 0) * 100), dec); };
  var PCT = function (v, d) { return '%' + (Number(v || 0) * 100).toLocaleString('tr-TR', { maximumFractionDigits: d == null ? 1 : d }); };
  var kurus = function (v) { var n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? Math.round(n * 100) : NaN; };
  var ym = function (d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  var monthName = function (s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }); };
  var monthShort = function (s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, 1).toLocaleDateString('tr-TR', { month: 'short' }); };
  var addMonth = function (s, n) { var p = s.split('-'); return ym(new Date(+p[0], +p[1] - 1 + n, 1)); };
  var lsGet = function (k, d) { try { var v = localStorage.getItem('acadex.fin.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  var lsSet = function (k, v) { try { localStorage.setItem('acadex.fin.' + k, JSON.stringify(v)); } catch (e) {} };
  var isAdmin = function () { var m = A.me(); return !!(m && m.is_admin); };
  var q = async function (p) { var r = await p; if (r.error) throw r.error; return r.data; };

  var PLAN = { free: 'Ücretsiz', lite: 'Lite', premium: 'Premium' };
  var PER = { week: 'Haftalık', month: 'Aylık', term: 'Dönemlik', year: 'Yıllık' };
  var CAT = { altyapi: 'Altyapı ve sunucu', yapay_zeka: 'Yapay zekâ API', pazarlama: 'Pazarlama', etkinlik: 'Etkinlik', hukuk: 'Hukuk ve şirket', personel: 'Ekip ve personel', ekipman: 'Ekipman', diger: 'Diğer' };
  var CATC = { altyapi: '#2F6BFF', yapay_zeka: '#8A5CF6', pazarlama: '#E0892A', etkinlik: '#12A3A3', hukuk: '#5B6B8C', personel: '#1E8A55', ekipman: '#C9483B', diger: '#A39E8E' };
  var TST = { yapilacak: 'Yapılacak', suruyor: 'Sürüyor', bekliyor: 'Bekliyor', bitti: 'Bitti' };
  var ACT = { fin_limit: 'Kota değişti', fin_price: 'Fiyat değişti', fin_coupon: 'Kampanya kodu', fin_grant_plan: 'Plan verildi', fin_role_grant: 'Finans erişimi verildi', fin_role_revoke: 'Finans erişimi kaldırıldı' };

  var F = { tab: lsGet('tab', 'pano'), ov: null, costs: null, month: ym() };
  var TABS = [['pano', 'Pano'], ['planlar', 'Planlar ve kota'], ['maliyet', 'Maliyet'], ['gider', 'Gider'], ['sim', 'Simülatör'], ['gorev', 'Görevler'], ['rapor', 'Rapor']];

  var notReady = function (e) { return /fin_overview|fin_|plan_prices|payment_|does not exist|PGRST202|PGRST205|42883|42P01/i.test(String((e && (e.message + ' ' + e.code)) || '')); };
  var setupCard = function () {
    return '<div class="card ink fin-setup"><span class="hand">kurulum</span><h2 class="disp">Finans bölümü henüz kurulmadı</h2>' +
      '<p class="sub">Supabase → SQL Editor\'de sırayla çalıştır; bu sayfa kendiliğinden dolar:</p><ol><li><b>20261028_odeme_iyzico.sql</b> <span class="muted">(fiyat, kampanya kodu ve sipariş tabloları; ödeme almayı açmaz)</span></li><li><b>20261104_finans.sql</b> <span class="muted">(finans rolü, gider, bütçe, görev, not, senaryo)</span></li></ol></div>';
  };

  /* ---------- veriler ---------- */
  var loadOv = async function (force) { if (!F.ov || force) F.ov = await rpc('fin_overview'); return F.ov; };
  var loadCosts = async function (force) { if (!F.costs || force) F.costs = await q(sb.from('fin_costs').select('*').order('sort')); return F.costs; };
  var cost = function (key) { var c = (F.costs || []).filter(function (x) { return x.key === key; })[0]; return c ? Number(c.amount) : 0; };
  var fixedMonthly = function () { return (F.costs || []).reduce(function (s, c) { return s + (c.unit === 'TL/ay' ? Number(c.amount) : c.unit === 'TL/yıl' ? Number(c.amount) / 12 : 0); }, 0); };
  /* bir fiyatın 30 günlük karşılığı, KDV ve komisyon düşülmüş (TL) */
  var netMonthly = function (p) { var gross = p.amount_kurus / 100 * 30 / Math.max(1, p.days); return gross / (1 + cost('kdv') / 100) * (1 - cost('odeme_komisyon') / 100); };

  /* ---------- çerçeve ---------- */
  A.VIEWS.finans = async function (m) {
    try { await Promise.all([loadOv(true), loadCosts(true)]); }
    catch (e) { if (notReady(e)) { m.innerHTML = setupCard(); return; } throw e; }
    m.innerHTML = '<div class="fin-head"><div class="tabs fin-tabs" role="tablist" aria-label="Finans">' + TABS.map(function (t) { return '<button type="button" role="tab" data-ft="' + t[0] + '" aria-selected="' + (F.tab === t[0]) + '" aria-pressed="' + (F.tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<span class="fin-who">' + (A.finOnly() ? '<span class="pill blue">finans rolü</span>' : '<span class="pill">yönetici</span>') + '</span></div><div id="fin-body" class="fin-body"></div>';
    m.onclick = function (e) { var b = e.target.closest('[data-ft]'); if (b) { F.tab = b.getAttribute('data-ft'); lsSet('tab', F.tab); A.VIEWS.finans(m); } };
    var body = $('#fin-body', m);
    try { await (T[F.tab] || T.pano)(body); }
    catch (e) { if (notReady(e)) { body.innerHTML = setupCard(); return; } body.innerHTML = '<div class="card"><h2>Yüklenemedi</h2><p class="err">' + X(errMsg(e)) + '</p></div>'; }
  };
  var T = {};

  var kpi = function (label, val, sub, tone) { return '<div class="kpi fin-kpi' + (tone ? ' ' + tone : '') + '"><div class="k">' + label + '</div><div class="v">' + val + '</div><div class="s">' + (sub || '') + '</div></div>'; };

  /* çubuk grafik (aylar) */
  var barChart = function (rows, opt) {
    opt = opt || {}; var W = opt.W || 720, H = opt.H || 220, L = 58, R = 10, Tp = 12, B = 28, n = rows.length || 1;
    var max = Math.max.apply(null, rows.map(function (r) { return Math.max(r.a || 0, r.b || 0); }).concat([0]));
    if (!(max > 0)) return '<div class="empty fin-nochart"><span class="hand">henüz veri yok</span>' + X(opt.emptyText || 'ilk kayıtla grafik burada belirir') + '</div>';
    var mag = Math.pow(10, Math.floor(Math.log10(max))), top = Math.ceil(max / mag) * mag, step = top / 4;
    var x = function (i) { return L + (W - L - R) * (i + .5) / n; }, y = function (v) { return Tp + (H - Tp - B) * (1 - v / top); };
    var bw = Math.min(26, (W - L - R) / n * (opt.two ? .3 : .55));
    var g = ''; for (var k = 0; k <= 4; k++) { var gy = y(k * step); g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + gy + '" y2="' + gy + '" stroke="#E3DECF"/><text x="' + (L - 6) + '" y="' + (gy + 4) + '" text-anchor="end" font-size="11" fill="#6A7593">' + X(opt.fmt ? opt.fmt(k * step) : NF(k * step)) + '</text>'; }
    var bars = rows.map(function (r, i) {
      var s = '';
      if (opt.two) {
        s += '<rect class="fin-bar" x="' + (x(i) - bw - 1) + '" y="' + y(r.a || 0) + '" width="' + bw + '" height="' + (y(0) - y(r.a || 0)) + '" rx="2" fill="' + (opt.ca || '#2F6BFF') + '" style="--d:' + i * 40 + 'ms"><title>' + X(r.label + ': ' + (opt.fmt ? opt.fmt(r.a) : r.a) + ' ' + (opt.na || '')) + '</title></rect>';
        s += '<rect class="fin-bar" x="' + (x(i) + 1) + '" y="' + y(r.b || 0) + '" width="' + bw + '" height="' + (y(0) - y(r.b || 0)) + '" rx="2" fill="' + (opt.cb || '#E8B53A') + '" style="--d:' + i * 40 + 'ms"><title>' + X(r.label + ': ' + (opt.fmt ? opt.fmt(r.b) : r.b) + ' ' + (opt.nb || '')) + '</title></rect>';
      } else s += '<rect class="fin-bar" x="' + (x(i) - bw / 2) + '" y="' + y(r.a || 0) + '" width="' + bw + '" height="' + (y(0) - y(r.a || 0)) + '" rx="3" fill="' + (opt.ca || '#2F6BFF') + '" style="--d:' + i * 40 + 'ms"><title>' + X(r.label + ': ' + (opt.fmt ? opt.fmt(r.a) : r.a)) + '</title></rect>';
      return s + '<text x="' + x(i) + '" y="' + (H - 9) + '" text-anchor="middle" font-size="11" fill="#6A7593">' + X(r.short || r.label) + '</text>';
    }).join('');
    return '<svg class="chart fin-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + X(opt.aria || 'grafik') + '">' + g + bars + '</svg>';
  };
  var hbars = function (rows, fmt) {
    var max = Math.max(1, Math.max.apply(null, rows.map(function (r) { return r.v; })));
    return '<div class="bars">' + rows.map(function (r) { return '<div class="bar"><span title="' + X(r.label) + '">' + X(r.label) + '</span><span class="t"><i style="width:' + Math.round(r.v / max * 100) + '%;' + (r.c ? 'background:' + r.c : '') + '"></i></span><b>' + X(fmt ? fmt(r.v) : NF(r.v)) + '</b></div>'; }).join('') + '</div>';
  };

  /* =========================== PANO =========================== */
  T.pano = async function (box) {
    var o = F.ov, paid = o.active_paid || 0, tot = Math.max(1, o.users_total || 0);
    var monthPages = ((o.usage || []).filter(function (u) { return u.m === ym(); })[0] || {}).pages || 0;
    var aiCost = monthPages * cost('ai_sayfa'), fixed = fixedMonthly(), mrr = (o.mrr_kurus || 0) / 100;
    var netMrr = mrr / (1 + cost('kdv') / 100) * (1 - cost('odeme_komisyon') / 100), margin = netMrr - aiCost - fixed;
    var churnBase = paid + (o.lapsed_30 || 0);
    var live = (o.paying_users || 0) > 0;
    box.innerHTML = (live ? '' : '<div class="card fin-note"><b>Ödeme henüz açık değil.</b> Gelir rakamları ilk ödemeyle dolar; kullanım, kota ve maliyet tarafı şimdiden gerçek veriyle çalışır.</div>') +
      '<div class="kpis fin-kpis">' +
      kpi('Aylık yinelenen gelir', TLn(mrr), 'aktif aboneliklerin 30 günlük karşılığı (KDV dahil)') +
      kpi('Son 30 gün tahsilat', TL(o.revenue_30_kurus), NF(o.paid_30) + ' başarılı ödeme' + (o.failed_30 ? ' · <b class="neg">' + NF(o.failed_30) + ' başarısız</b>' : '')) +
      kpi('Ödeyen öğrenci', NF(paid), PCT(paid / tot) + ' dönüşüm · ' + NF(o.users_total) + ' öğrenciden') +
      kpi('Kayıp (30 gün)', NF(o.lapsed_30), churnBase ? PCT((o.lapsed_30 || 0) / churnBase) + ' abonelik yenilenmedi' : 'henüz abonelik yok', o.lapsed_30 ? 'alert' : '') +
      kpi('Bu ay özetlenen sayfa', NF(monthPages), NF(o.active_30) + ' aktif öğrenci (30 gün)') +
      kpi('Tahmini yapay zekâ maliyeti', TLn(aiCost), cost('ai_sayfa') ? TLn(cost('ai_sayfa'), 1) + ' / sayfa' : '<button type="button" class="lnk" data-ft="maliyet">sayfa maliyetini gir</button>') +
      kpi('Sabit gider (aylık)', TLn(fixed), 'Maliyet sekmesindeki kalemler') +
      kpi('Aylık katkı', TLn(margin), 'net gelir − yapay zekâ − sabit', margin < 0 ? 'neg-k' : 'pos-k') + '</div>' +
      '<div class="grid g-wide"><div class="card"><h2>Aylık tahsilat</h2><p class="sub">Son 12 ay · başarılı ödemeler ve iadeler</p>' +
      barChart((o.months || []).map(function (r) { return { label: monthName(r.m), short: monthShort(r.m), a: r.kurus / 100, b: (r.refund || 0) / 100 }; }), { two: true, fmt: function (v) { return TLn(v); }, na: 'tahsilat', nb: 'iade', cb: '#C9483B', aria: 'Son 12 ayın aylık tahsilatı' }) +
      '<div class="legend"><span><i style="background:#2F6BFF"></i>tahsilat</span><span><i style="background:#C9483B"></i>iade</span></div></div>' +
      '<div class="card"><h2>Plan dağılımı</h2><p class="sub">Geçerli planına göre öğrenciler</p>' + hbars((o.plans || []).map(function (p) { return { label: PLAN[p.plan] || p.plan, v: p.n, c: p.plan === 'premium' ? '#8A5CF6' : p.plan === 'lite' ? '#2F6BFF' : '#A39E8E' }; })) +
      '<h3 style="margin-top:18px">Bu ay plana göre kullanım</h3>' + hbars((o.usage_by_plan || []).map(function (p) { return { label: (PLAN[p.plan] || p.plan) + ' · ' + NF(p.users) + ' kişi', v: p.pages, c: p.plan === 'premium' ? '#8A5CF6' : '#2F6BFF' }; })) + '<p class="muted" style="margin:6px 0 0;font-size:12px">sayfa · bu ay</p></div></div>' +
      '<div class="grid g2" style="margin-top:16px"><div class="card"><h2>Kullanım eğilimi</h2><p class="sub">Son 6 ay · özetlenen sayfa ve belge</p>' +
      barChart((o.usage || []).map(function (u) { return { label: monthName(u.m), short: monthShort(u.m), a: u.pages, b: u.docs }; }), { two: true, na: 'sayfa', nb: 'belge', aria: 'Son 6 ayın kullanım eğilimi' }) +
      '<div class="legend"><span><i style="background:#2F6BFF"></i>sayfa</span><span><i style="background:#E8B53A"></i>belge</span></div></div>' +
      '<div class="card"><h2>Satış kırılımı</h2><p class="sub">Plan × süre · tüm zamanlar</p>' + ((o.by_period || []).length ? '<div class="tbl-w"><table><thead><tr><th>Plan</th><th>Süre</th><th>Adet</th><th>Tutar</th></tr></thead><tbody>' + o.by_period.map(function (r) { return '<tr><td>' + X(PLAN[r.plan] || r.plan) + '</td><td>' + X(PER[r.period] || r.period) + '</td><td>' + NF(r.n) + '</td><td>' + TL(r.kurus) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty"><span class="hand">henüz satış yok</span>ilk ödemeyle burada görünür</div>') + '</div></div>' +
      (isAdmin() ? '<div class="card" id="fin-access" style="margin-top:16px"><h2>Finans erişimi</h2><p class="sub">Yalnız yöneticiler görür. Finans rolündeki kişi bu paneli ve Acadex ekibini (salt okunur) görür; öğrenci listesine, belgelere ve destek mesajlarına erişemez.</p><div id="fin-staff" class="muted">yükleniyor…</div>' +
        '<form id="fin-staff-f" class="fin-inline" novalidate><label class="fld grow">E-posta (Acadex hesabı)<input class="in" type="email" name="e" placeholder="ornek@gmail.com" required></label><button class="btn blue sm" type="submit">Finans rolü ver</button></form></div>' : '');
    if (isAdmin()) staffBox(box);
  };
  var staffBox = async function (box) {
    var el = $('#fin-staff', box), f = $('#fin-staff-f', box);
    var paint = async function () {
      try { var r = await rpc('fin_staff'); el.innerHTML = r.length ? '<div class="fin-staff">' + r.map(function (s) { return '<div class="fin-st"><span><b>' + X(s.name || '—') + '</b> <span class="muted">' + X(s.email || '') + '</span></span><span class="pill blue">finans</span><span class="muted">' + DT(s.granted_at) + '</span><button type="button" class="lnk" data-rm="' + X(s.email) + '">kaldır</button></div>'; }).join('') + '</div>' : '<p class="muted" style="margin:0">Henüz kimseye finans rolü verilmedi.</p>'; }
      catch (e) { el.textContent = errMsg(e); }
    };
    el.onclick = async function (e) { var b = e.target.closest('[data-rm]'); if (!b || !A.confirmBox(b.getAttribute('data-rm') + ' için finans erişimi kaldırılsın mı?')) return; try { await rpc('fin_set_staff', { p_email: b.getAttribute('data-rm'), p_on: false }); toast('Erişim kaldırıldı.'); paint(); } catch (er) { toast(errMsg(er), true); } };
    f.onsubmit = async function (e) { e.preventDefault(); var v = f.e.value.trim(); if (!/^\S+@\S+\.\S+$/.test(v)) { toast('Geçerli bir e-posta yaz.', true); return; } var b = $('button', f); b.disabled = true; try { var r = await rpc('fin_set_staff', { p_email: v, p_on: true }); toast((r.name || v) + ' artık Finans panelini kullanabilir.'); f.reset(); paint(); } catch (er) { toast(errMsg(er), true); } b.disabled = false; };
    paint();
  };

  /* =========================== PLANLAR VE KOTA =========================== */
  T.planlar = async function (box) {
    var o = F.ov, res = await Promise.all([rpc('fin_coupons'), rpc('fin_quota_watch'), rpc('fin_history', { p_limit: 40 })]);
    var coupons = res[0] || [], watch = res[1] || [], hist = res[2] || [];
    var prices = o.prices || [], plans = (o.limits || []).map(function (l) { return l.plan; });
    box.innerHTML = '<div class="grid fin-pq"><div class="card"><h2>Kota</h2><p class="sub">Plan başına aylık sayfa ve tek belgede en çok sayfa. Değişiklik hemen geçerli olur ve kayda geçer.</p>' +
      '<div class="tbl-w"><table class="fin-edit fin-kota"><thead><tr><th>Plan</th><th>Aylık sayfa</th><th>Belge başına</th><th>Görsel analiz</th><th></th></tr></thead><tbody>' +
      (o.limits || []).map(function (l) { return '<tr data-plan="' + X(l.plan) + '"><td><b>' + X(PLAN[l.plan] || l.plan) + '</b></td><td><input class="in sm" type="number" min="0" max="100000" name="mp" value="' + l.monthly_pages + '" aria-label="' + X(l.plan) + ' aylık sayfa"></td><td><input class="in sm" type="number" min="1" max="5000" name="pd" value="' + l.max_pages_per_doc + '" aria-label="' + X(l.plan) + ' belge başına sayfa"></td><td><label class="switch"><input type="checkbox" name="va"' + (l.visual_analysis ? ' checked' : '') + '><i></i></label></td><td><button type="button" class="btn sm ghost" data-savelim>kaydet</button></td></tr>'; }).join('') + '</tbody></table></div></div>' +
      '<div class="card"><h2>Fiyatlar</h2><p class="sub">KDV dahil satış fiyatı. "Aylık karşılık" farklı süreleri karşılaştırmak için; "net" KDV ve ödeme komisyonu düşülmüş tutardır.</p>' +
      '<div class="tbl-w"><table class="fin-edit"><thead><tr><th>Plan · süre</th><th>Fiyat (TL)</th><th>Gün</th><th>Aylık karşılık</th><th>Satışta</th><th></th></tr></thead><tbody>' +
      prices.map(function (p) { return '<tr data-pp="' + X(p.plan) + '" data-per="' + X(p.period) + '"><td><b>' + X(PLAN[p.plan] || p.plan) + '</b> · ' + X(PER[p.period] || p.period) + '</td><td><input class="in sm" type="number" min="1" step="0.01" name="am" value="' + (p.amount_kurus / 100).toFixed(2) + '" aria-label="fiyat"></td><td><input class="in sm xs" type="number" min="1" max="730" name="dy" value="' + p.days + '" aria-label="gün"></td><td><span class="mono">' + TLn(p.amount_kurus / 100 * 30 / p.days) + '</span><small class="muted"> net ' + TLn(netMonthly(p)) + '</small></td><td><label class="switch"><input type="checkbox" name="ac"' + (p.active ? ' checked' : '') + '><i></i></label></td><td><button type="button" class="btn sm ghost" data-saveprice>kaydet</button></td></tr>'; }).join('') +
      '</tbody></table></div><details class="fin-more"><summary>Yeni fiyat satırı</summary><form id="fin-np" class="fin-inline" novalidate><label class="fld">Plan<select class="in" name="pl">' + plans.map(function (p) { return '<option value="' + X(p) + '">' + X(PLAN[p] || p) + '</option>'; }).join('') + '</select></label><label class="fld">Süre<select class="in" name="pe">' + Object.keys(PER).map(function (k) { return '<option value="' + k + '">' + PER[k] + '</option>'; }).join('') + '</select></label><label class="fld">Fiyat (TL)<input class="in" type="number" step="0.01" min="1" name="am" required></label><label class="fld">Gün<input class="in" type="number" min="1" max="730" name="dy" value="30" required></label><button class="btn blue sm" type="submit">Ekle</button></form></details></div></div>' +

      '<div class="card" style="margin-top:16px"><div class="fin-ch"><div><h2>Kampanya ve indirim kodları</h2><p class="sub">Kod, ödeme sayfasında girilir. Gelir ve verilen indirim başarılı ödemelerden hesaplanır.</p></div><button type="button" class="btn blue sm" id="fin-newc">+ Kod</button></div>' +
      (coupons.length ? '<div class="tbl-w"><table><thead><tr><th>Kod</th><th>Kampanya</th><th>İndirim</th><th>Kullanım</th><th>Bitiş</th><th>Gelir</th><th>Verilen indirim</th><th>Durum</th></tr></thead><tbody>' + coupons.map(function (c, i) {
        var exp = c.valid_until && new Date(c.valid_until) < new Date(), full = c.max_uses != null && c.used_count >= c.max_uses;
        return '<tr class="click" data-ci="' + i + '" tabindex="0"><td class="mono"><b>' + X(c.code) + '</b>' + (c.personal ? ' <span class="pill">kişiye özel</span>' : '') + '</td><td>' + X(c.label || '—') + '</td><td>%' + c.percent_off + '</td><td>' + NF(c.used_count) + (c.max_uses != null ? ' / ' + NF(c.max_uses) : '') + (c.max_uses ? '<span class="fin-mini"><i style="width:' + Math.min(100, Math.round(c.used_count / c.max_uses * 100)) + '%"></i></span>' : '') + '</td><td>' + (c.valid_until ? DT(c.valid_until) : 'süresiz') + '</td><td>' + TL(c.revenue_kurus) + '</td><td>' + TL(c.discount_kurus) + '</td><td>' + (!c.active ? '<span class="pill">kapalı</span>' : exp ? '<span class="pill warn">süresi doldu</span>' : full ? '<span class="pill warn">doldu</span>' : '<span class="pill ok">açık</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="empty"><span class="hand">henüz kod yok</span>kampüs elçisi, kulüp, sınav haftası kampanyaları için kod oluştur</div>') + '</div>' +

      '<div class="grid g2" style="margin-top:16px"><div class="card"><h2>Kotasının sınırına yaklaşanlar</h2><p class="sub">Bu ay kotasının %70\'ini geçenler. ' + (isAdmin() ? 'Yönetici olarak süreli plan verebilirsin.' : 'Kimlikler gizli: yalnız baş harfler görünür.') + '</p>' +
      (watch.length ? '<div class="tbl-w"><table><thead><tr><th>Öğrenci</th><th>Plan</th><th>Kullanım</th>' + (isAdmin() ? '<th></th>' : '') + '</tr></thead><tbody>' + watch.map(function (w) { return '<tr><td>' + X(w.who) + '</td><td>' + X(PLAN[w.plan] || w.plan) + '</td><td><span class="fin-q"><i style="width:' + Math.min(100, Math.round(w.ratio * 100)) + '%"' + (w.ratio >= 1 ? ' class="full"' : '') + '></i></span> ' + NF(w.pages_used) + ' / ' + NF(w.monthly_pages) + '</td>' + (isAdmin() && w.user_id ? '<td><button type="button" class="btn sm ghost" data-grant="' + X(w.user_id) + '" data-name="' + X(w.who) + '">plan ver</button></td>' : '') + '</tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty"><span class="hand">kimse sınırda değil</span>bu ay herkes kotasının %70\'inin altında</div>') + '</div>' +
      '<div class="card"><h2>Değişiklik geçmişi</h2><p class="sub">Kota, fiyat, kod ve erişim değişiklikleri: kim, ne zaman, önce → sonra</p>' + histList(hist) + '</div></div>';

    box.onclick = async function (e) {
      var b;
      if ((b = e.target.closest('[data-savelim]'))) {
        var tr = b.closest('tr'), mp = +$('[name=mp]', tr).value, pd = +$('[name=pd]', tr).value;
        if (!(mp >= 0 && pd >= 1)) { toast('Sayılar geçersiz.', true); return; }
        if (!A.confirmBox((PLAN[tr.getAttribute('data-plan')] || tr.getAttribute('data-plan')) + ' planı: aylık ' + NF(mp) + ' sayfa, belge başına ' + NF(pd) + ' sayfa. Hemen bütün öğrencilere uygulanır. Onaylıyor musun?')) return;
        b.disabled = true; try { await rpc('fin_set_limit', { p_plan: tr.getAttribute('data-plan'), p_monthly: mp, p_per_doc: pd, p_visual: $('[name=va]', tr).checked }); toast('Kota kaydedildi.'); await loadOv(true); T.planlar(box); } catch (er) { b.disabled = false; toast(errMsg(er), true); }
        return;
      }
      if ((b = e.target.closest('[data-saveprice]'))) {
        var r2 = b.closest('tr'), am = kurus($('[name=am]', r2).value), dy = +$('[name=dy]', r2).value;
        if (!(am >= 100 && dy >= 1)) { toast('Fiyat en az 1 TL, süre en az 1 gün olmalı.', true); return; }
        if (!A.confirmBox((PLAN[r2.getAttribute('data-pp')] || r2.getAttribute('data-pp')) + ' · ' + (PER[r2.getAttribute('data-per')] || '') + ': ' + TL(am, true) + ' / ' + dy + ' gün. Yeni ödemelerde geçerli olur. Onaylıyor musun?')) return;
        b.disabled = true; try { await rpc('fin_set_price', { p_plan: r2.getAttribute('data-pp'), p_period: r2.getAttribute('data-per'), p_amount_kurus: am, p_days: dy, p_active: $('[name=ac]', r2).checked }); toast('Fiyat kaydedildi.'); await loadOv(true); T.planlar(box); } catch (er) { b.disabled = false; toast(errMsg(er), true); }
        return;
      }
      if ((b = e.target.closest('[data-ci]'))) { couponForm(box, coupons[+b.getAttribute('data-ci')]); return; }
      if (e.target.closest('#fin-newc')) { couponForm(box, null); return; }
      if ((b = e.target.closest('[data-grant]'))) { grantForm(box, b.getAttribute('data-grant'), b.getAttribute('data-name')); }
    };
    box.onkeydown = function (e) { var r = e.target.closest && e.target.closest('tr[data-ci]'); if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); couponForm(box, coupons[+r.getAttribute('data-ci')]); } };
    $('#fin-np', box).onsubmit = async function (e) {
      e.preventDefault(); var f = this, am = kurus(f.am.value), dy = +f.dy.value;
      if (!(am >= 100 && dy >= 1)) { toast('Fiyat en az 1 TL, süre en az 1 gün olmalı.', true); return; }
      try { await rpc('fin_set_price', { p_plan: f.pl.value, p_period: f.pe.value, p_amount_kurus: am, p_days: dy, p_active: true }); toast('Fiyat eklendi.'); await loadOv(true); T.planlar(box); } catch (er) { toast(errMsg(er), true); }
    };
  };
  var histList = function (h) {
    if (!h.length) return '<div class="empty"><span class="hand">henüz değişiklik yok</span></div>';
    var KN = { kurus: 'fiyat', gun: 'gün', aktif: 'satışta', aylik: 'aylık sayfa', belge: 'belge başına', gorsel: 'görsel analiz', yuzde: 'indirim %', en_cok: 'en çok kullanım', bitis: 'bitiş', plan: 'plan', neden: 'neden' };
    var fmt = function (d) { if (!d) return ''; return Object.keys(d).map(function (k) { var v = d[k]; return (KN[k] || k) + ': ' + (v === true ? 'evet' : v === false ? 'hayır' : v == null ? '—' : k === 'kurus' ? TL(v, true) : k === 'bitis' ? DT(v) : v); }).join(', '); };
    var lab = function (r) { if (!r.label) return ''; if (r.action === 'fin_price' || r.action === 'fin_limit') return r.label.split(' · ').map(function (x) { return PLAN[x] || PER[x] || x; }).join(' · '); return r.label; };
    return '<ol class="fin-hist">' + h.map(function (r) { var d = r.details || {}; return '<li><span class="mono muted">' + DT(r.at, true) + '</span><b>' + X(ACT[r.action] || r.action) + '</b>' + (r.label ? ' · ' + X(lab(r)) : '') + ' <span class="muted">— ' + X(r.who || 'sistem') + '</span>' + (d.once || d.sonra ? '<div class="fin-diff">' + (d.once ? '<s>' + X(fmt(d.once)) + '</s> → ' : '') + X(fmt(d.sonra)) + '</div>' : (Object.keys(d).length ? '<div class="fin-diff">' + X(fmt(d)) + '</div>' : '')) + '</li>'; }).join('') + '</ol>';
  };
  var couponForm = function (box, c) {
    var v = c || { code: '', label: '', percent_off: 20, max_uses: null, valid_until: null, active: true };
    A.openDrawer(c ? 'Kod: ' + c.code : 'Yeni kampanya kodu', '<form id="fin-cf" class="fin-form" novalidate>' +
      '<label class="fld">Kod<input class="in mono" name="code" value="' + X(v.code) + '" maxlength="24" placeholder="KAMPUS25"' + (c ? ' readonly' : '') + ' required><small>3–24 harf ya da rakam; büyük harfe çevrilir.</small></label>' +
      '<label class="fld">Kampanya adı<input class="in" name="label" value="' + X(v.label || '') + '" maxlength="80" placeholder="Hacettepe kampüs elçisi"></label>' +
      '<label class="fld">İndirim yüzdesi: <b id="fin-pv">%' + v.percent_off + '</b><input type="range" name="pc" min="1" max="90" value="' + v.percent_off + '"></label>' +
      '<div class="fin-ex" id="fin-ex"></div>' +
      '<label class="fld">En çok kullanım<input class="in" type="number" min="1" name="mx" value="' + (v.max_uses == null ? '' : v.max_uses) + '" placeholder="boş = sınırsız"></label>' +
      '<label class="fld">Bitiş tarihi<input class="in" type="date" name="vu" value="' + (v.valid_until ? String(v.valid_until).slice(0, 10) : '') + '"><small>Boş = süresiz. Seçilen günün sonuna kadar geçerli.</small></label>' +
      '<label class="switch"><input type="checkbox" name="ac"' + (v.active ? ' checked' : '') + '><i></i>Açık</label>' +
      (c ? '<dl class="kv"><dt>Kullanım</dt><dd>' + NF(c.used_count) + '</dd><dt>Başarılı ödeme</dt><dd>' + NF(c.paid) + '</dd><dt>Gelir</dt><dd>' + TL(c.revenue_kurus) + '</dd><dt>Verilen indirim</dt><dd>' + TL(c.discount_kurus) + '</dd></dl>' : '') +
      '<div class="acts"><button class="btn blue" type="submit">Kaydet</button></div></form>');
    var f = $('#fin-cf'), ex = function () { var pc = +f.pc.value, lm = (F.ov.prices || []).filter(function (p) { return p.plan === 'lite' && p.period === 'month'; })[0]; $('#fin-pv').textContent = '%' + pc; $('#fin-ex').innerHTML = lm ? 'Örnek: Lite aylık ' + TL(lm.amount_kurus, true) + ' → <b>' + TL(Math.round(lm.amount_kurus * (100 - pc) / 100), true) + '</b>' : ''; };
    f.pc.addEventListener('input', ex); ex();
    f.onsubmit = async function (e) {
      e.preventDefault(); var code = f.code.value.trim().toUpperCase();
      if (!/^[A-Z0-9]{3,24}$/.test(code)) { toast('Kod 3–24 harf ya da rakam olmalı (Türkçe karakter ve boşluk yok).', true); return; }
      var mx = f.mx.value ? +f.mx.value : null, vu = f.vu.value ? new Date(f.vu.value + 'T23:59:59').toISOString() : null;
      try { await rpc('fin_upsert_coupon', { p_code: code, p_label: f.label.value.trim(), p_percent: +f.pc.value, p_max_uses: mx, p_valid_until: vu, p_active: f.ac.checked }); toast('Kod kaydedildi.'); A.closeDrawer(); T.planlar(box); } catch (er) { toast(errMsg(er), true); }
    };
  };
  var grantForm = function (box, uid, name) {
    A.openDrawer('Süreli plan ver', '<form id="fin-gf" class="fin-form" novalidate><p class="muted" style="margin:0"><b>' + X(name) + '</b> için. Mevcut süresinin üstüne eklenir ve denetim kaydına geçer.</p>' +
      '<label class="fld">Plan<select class="in" name="pl">' + (F.ov.limits || []).map(function (l) { return '<option value="' + X(l.plan) + '"' + (l.plan === 'premium' ? ' selected' : '') + '>' + X(PLAN[l.plan] || l.plan) + '</option>'; }).join('') + '</select></label>' +
      '<label class="fld">Gün<input class="in" type="number" min="1" max="365" name="dy" value="7"></label><label class="fld">Neden<input class="in" name="rs" maxlength="200" placeholder="sınav haftası desteği"></label><div class="acts"><button class="btn blue" type="submit">Planı ver</button></div></form>');
    $('#fin-gf').onsubmit = async function (e) { e.preventDefault(); var f = this; try { await rpc('fin_grant_plan', { p_user: uid, p_plan: f.pl.value, p_days: +f.dy.value, p_reason: f.rs.value.trim() }); toast('Plan verildi.'); A.closeDrawer(); await loadOv(true); T.planlar(box); } catch (er) { toast(errMsg(er), true); } };
  };

  /* =========================== MALİYET =========================== */
  T.maliyet = async function (box) {
    var o = F.ov, prices = (o.prices || []).filter(function (p) { return p.active; });
    var ppu = {}; (o.usage_by_plan || []).forEach(function (u) { ppu[u.plan] = u.users ? u.pages / u.users : 0; });
    var fixed = fixedMonthly(), ai = cost('ai_sayfa');
    var rows = prices.map(function (p) {
      var net = netMonthly(p), pages = ppu[p.plan] || 0, lim = ((o.limits || []).filter(function (l) { return l.plan === p.plan; })[0] || {}).monthly_pages || 0;
      return { p: p, net: net, aiAvg: pages * ai, aiMax: lim * ai, c: net - pages * ai, cMax: net - lim * ai };
    });
    var lm = rows.filter(function (r) { return r.p.plan === 'lite' && r.p.period === 'month'; })[0] || rows[0];
    var be = lm && lm.c > 0 ? Math.ceil(fixed / lm.c) : null;
    box.innerHTML = '<div class="grid g-wide"><div class="card"><h2>Maliyet kalemleri</h2><p class="sub">Bu rakamlar birim ekonomisini, panodaki maliyeti ve simülatörü besler. Gerçek faturalara göre güncel tut.</p>' +
      '<div class="tbl-w"><table class="fin-edit"><thead><tr><th>Kalem</th><th>Tutar</th><th>Birim</th><th></th></tr></thead><tbody>' + (F.costs || []).map(function (c) { return '<tr data-ck="' + X(c.key) + '"><td><b>' + X(c.label) + '</b>' + (c.note ? '<br><small class="muted">' + X(c.note) + '</small>' : '') + '</td><td><input class="in sm" type="number" min="0" step="any" name="am" value="' + Number(c.amount) + '" aria-label="' + X(c.label) + '"></td><td class="mono">' + X(c.unit) + '</td><td><button type="button" class="btn sm ghost" data-savecost>kaydet</button></td></tr>'; }).join('') + '</tbody></table></div>' +
      '<details class="fin-more"><summary>Yeni kalem</summary><form id="fin-nc" class="fin-inline" novalidate><label class="fld grow">Ad<input class="in" name="lb" maxlength="80" required></label><label class="fld">Tutar<input class="in" type="number" step="any" min="0" name="am" required></label><label class="fld">Birim<select class="in" name="un"><option>TL/ay</option><option>TL/yıl</option><option>TL/sayfa</option><option>%</option></select></label><button class="btn blue sm" type="submit">Ekle</button></form></details></div>' +
      '<div class="card ink fin-be"><h2>Başabaş noktası</h2><p class="sub">Sabit giderleri karşılamak için gereken aylık ödeyen öğrenci (Lite aylık, ortalama kullanımla)</p>' +
      '<div class="fin-big">' + (be == null ? '—' : NF(be)) + '<small> öğrenci</small></div><dl class="kv"><dt>Sabit gider</dt><dd>' + TLn(fixed) + ' / ay</dd><dt>Öğrenci başı katkı</dt><dd>' + (lm ? TLn(lm.c, 1) : '—') + '</dd><dt>Şu an ödeyen</dt><dd>' + NF(o.active_paid) + '</dd></dl>' +
      (be != null ? '<div class="fin-q big"><i style="width:' + Math.min(100, Math.round((o.active_paid || 0) / Math.max(1, be) * 100)) + '%"></i></div><p class="muted" style="margin:6px 0 0;font-size:12.5px">' + ((o.active_paid || 0) >= be ? 'Başabaş aşıldı: sabit giderler karşılanıyor.' : 'Başabaşa ' + PCT((o.active_paid || 0) / Math.max(1, be), 0) + ' yoldasın · ' + NF(be - (o.active_paid || 0)) + ' öğrenci kaldı') + '</p>' : '<p class="muted">Katkı sıfırın altında ya da fiyat yok: önce fiyat ve maliyetleri gir.</p>') + '</div></div>' +
      '<div class="card" style="margin-top:16px"><h2>Birim ekonomisi</h2><p class="sub">Her satış seçeneği için 30 günlük karşılık. Net = fiyat ÷ (1 + KDV) × (1 − komisyon). "En kötü durum" kotasının tamamını kullanan öğrencidir.</p>' +
      (rows.length ? '<div class="tbl-w"><table><thead><tr><th>Plan · süre</th><th>Net gelir / ay</th><th>Yapay zekâ (ortalama)</th><th>Katkı</th><th>Katkı oranı</th><th>En kötü durum</th></tr></thead><tbody>' + rows.map(function (r) { return '<tr><td><b>' + X(PLAN[r.p.plan] || r.p.plan) + '</b> · ' + X(PER[r.p.period] || r.p.period) + '</td><td>' + TLn(r.net, 1) + '</td><td>' + TLn(r.aiAvg, 1) + '</td><td class="' + (r.c < 0 ? 'neg' : 'pos') + '">' + TLn(r.c, 1) + '</td><td><span class="fin-q"><i style="width:' + Math.max(0, Math.min(100, Math.round(r.c / Math.max(.01, r.net) * 100))) + '%"></i></span> ' + PCT(r.net ? r.c / r.net : 0, 0) + '</td><td class="' + (r.cMax < 0 ? 'neg' : '') + '">' + TLn(r.cMax, 1) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty">Aktif fiyat yok.</div>') +
      (!ai ? '<p class="fin-note" style="margin-top:12px"><b>Yapay zekâ sayfa maliyeti 0 girili.</b> API faturasını o ay özetlenen sayfaya bölüp yukarıya gir; katkı rakamları gerçekçi olsun.</p>' : '') + '</div>';
    box.onclick = async function (e) {
      var b = e.target.closest('[data-savecost]'); if (!b) return; var tr = b.closest('tr'), v = parseFloat($('[name=am]', tr).value);
      if (!(v >= 0)) { toast('Tutar geçersiz.', true); return; }
      b.disabled = true; try { await q(sb.from('fin_costs').update({ amount: v, updated_at: new Date().toISOString() }).eq('key', tr.getAttribute('data-ck'))); toast('Kaydedildi.'); await loadCosts(true); T.maliyet(box); } catch (er) { b.disabled = false; toast(errMsg(er), true); }
    };
    $('#fin-nc', box).onsubmit = async function (e) {
      e.preventDefault(); var f = this, lb = f.lb.value.trim(), v = parseFloat(f.am.value);
      if (lb.length < 2 || !(v >= 0)) { toast('Ad ve tutar gerekli.', true); return; }
      var key = lb.toLocaleLowerCase('tr').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/[^a-z]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'kalem';
      if (key.length < 2) key = 'kalem_' + key;
      try { await q(sb.from('fin_costs').insert({ key: key, label: lb, amount: v, unit: f.un.value, sort: 200 })); toast('Kalem eklendi.'); await loadCosts(true); T.maliyet(box); } catch (er) { toast(/duplicate|23505/.test(String(er.message || er.code)) ? 'Bu adla bir kalem zaten var.' : errMsg(er), true); }
    };
  };

  /* =========================== GİDER =========================== */
  T.gider = async function (box) {
    var mo = F.month, from = mo + '-01', to = addMonth(mo, 1) + '-01';
    var res = await Promise.all([
      q(sb.from('fin_expenses').select('*').gte('spent_on', from).lt('spent_on', to).order('spent_on', { ascending: false })),
      q(sb.from('fin_budgets').select('*').eq('month', from)),
      q(sb.from('fin_expenses').select('spent_on,amount_kurus').gte('spent_on', addMonth(mo, -5) + '-01').lt('spent_on', to))
    ]);
    var ex = res[0] || [], bud = {}, six = res[2] || [];
    (res[1] || []).forEach(function (b) { bud[b.category] = b.amount_kurus; });
    var byCat = {}; ex.forEach(function (e) { byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount_kurus); });
    var total = ex.reduce(function (s, e) { return s + Number(e.amount_kurus); }, 0), budTot = Object.keys(bud).reduce(function (s, k) { return s + Number(bud[k]); }, 0);
    var trend = []; for (var i = 5; i >= 0; i--) { var mm = addMonth(mo, -i); trend.push({ label: monthName(mm), short: monthShort(mm), a: six.filter(function (e) { return String(e.spent_on).slice(0, 7) === mm; }).reduce(function (s, e) { return s + Number(e.amount_kurus); }, 0) / 100 }); }
    box.innerHTML = '<div class="tools fin-month"><button type="button" class="btn sm ghost" data-mo="-1" aria-label="önceki ay">‹</button><b class="disp">' + X(monthName(mo)) + '</b><button type="button" class="btn sm ghost" data-mo="1" aria-label="sonraki ay"' + (mo >= ym() ? ' disabled' : '') + '>›</button>' +
      '<span class="grow"></span><button type="button" class="btn ghost sm" id="fin-xcsv">CSV indir</button><button type="button" class="btn ghost sm" id="fin-copy">Tekrarlayanları bu aya kopyala</button><button type="button" class="btn blue sm" id="fin-newx">+ Gider</button></div>' +
      '<div class="kpis fin-kpis three">' + kpi('Bu ay harcanan', TL(total), NF(ex.length) + ' kayıt') + kpi('Bütçe', budTot ? TL(budTot) : '—', budTot ? PCT(total / budTot, 0) + ' kullanıldı' : 'aşağıdan kategori bütçesi gir', budTot && total > budTot ? 'alert' : '') + kpi('Kalan', budTot ? TL(budTot - total) : '—', budTot && total > budTot ? '<b class="neg">bütçe aşıldı</b>' : '', budTot && total > budTot ? 'neg-k' : '') + '</div>' +
      '<div class="grid g-wide"><div class="card"><h2>Kategoriye göre bütçe</h2><p class="sub">Çubuk harcananı, çizgi bütçeyi gösterir. Bütçeyi değiştirmek için tutara tıkla.</p><div class="fin-budget">' +
      Object.keys(CAT).map(function (k) { var sp = byCat[k] || 0, bd = bud[k] || 0, mx = Math.max(sp, bd, 1); return '<div class="fin-bk"><span><i style="background:' + CATC[k] + '"></i>' + CAT[k] + '</span><span class="fin-bt"><b style="width:' + Math.round(sp / mx * 100) + '%;background:' + CATC[k] + (bd && sp > bd ? ';box-shadow:inset 0 0 0 2px #C9483B' : '') + '"></b>' + (bd ? '<u style="left:' + Math.round(bd / mx * 100) + '%"></u>' : '') + '</span><span class="mono">' + TL(sp) + '</span><input class="in sm" type="number" min="0" step="1" data-bud="' + k + '" value="' + (bd ? bd / 100 : '') + '" placeholder="bütçe" aria-label="' + CAT[k] + ' bütçesi (TL)"></div>'; }).join('') + '</div></div>' +
      '<div class="card"><h2>Son 6 ay gider</h2><p class="sub">Bütün kategoriler toplamı</p>' + barChart(trend, { fmt: function (v) { return TLn(v); }, ca: '#E0892A', aria: 'Son 6 ayın gideri', W: 420, H: 260 }) + '</div></div>' +
      '<div class="card" style="margin-top:16px"><h2>Gider defteri</h2>' + (ex.length ? '<div class="tbl-w"><table><thead><tr><th>Tarih</th><th>Kategori</th><th>Kime</th><th>Not</th><th>Tutar</th><th></th></tr></thead><tbody>' + ex.map(function (e, i) { return '<tr class="click" data-xi="' + i + '" tabindex="0"><td>' + DT(e.spent_on) + '</td><td><span class="fin-dot" style="background:' + CATC[e.category] + '"></span>' + X(CAT[e.category] || e.category) + '</td><td>' + X(e.vendor || '—') + (e.recurring ? ' <span class="pill blue">her ay</span>' : '') + '</td><td class="muted">' + X(e.note || '') + '</td><td><b>' + TL(e.amount_kurus, true) + '</b></td><td></td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty"><span class="hand">bu ay gider yok</span>"+ Gider" ile ilk kaydı gir</div>') + '</div>';
    box.onclick = async function (e) {
      var b;
      if ((b = e.target.closest('[data-mo]'))) { F.month = addMonth(F.month, +b.getAttribute('data-mo')); T.gider(box); return; }
      if (e.target.closest('#fin-newx')) { expForm(box, null); return; }
      if ((b = e.target.closest('[data-xi]'))) { expForm(box, ex[+b.getAttribute('data-xi')]); return; }
      if (e.target.closest('#fin-xcsv')) { A.csv('acadex-gider-' + mo + '.csv', ['Tarih', 'Kategori', 'Kime', 'Not', 'Tutar (TL)', 'Her ay'], ex.map(function (x) { return [x.spent_on, CAT[x.category] || x.category, x.vendor || '', x.note || '', (x.amount_kurus / 100).toFixed(2).replace('.', ','), x.recurring ? 'evet' : '']; })); return; }
      if (e.target.closest('#fin-copy')) {
        try {
          var prev = await q(sb.from('fin_expenses').select('*').eq('recurring', true).gte('spent_on', addMonth(mo, -1) + '-01').lt('spent_on', from));
          var have = {}; ex.forEach(function (x) { have[(x.vendor || '') + '|' + x.category + '|' + x.amount_kurus] = 1; });
          var add = prev.filter(function (x) { return !have[(x.vendor || '') + '|' + x.category + '|' + x.amount_kurus]; }).map(function (x) { return { spent_on: mo + String(x.spent_on).slice(7), category: x.category, vendor: x.vendor, amount_kurus: x.amount_kurus, note: x.note, recurring: true }; });
          if (!add.length) { toast('Kopyalanacak yeni tekrarlayan gider yok.'); return; }
          if (!A.confirmBox(add.length + ' tekrarlayan gider ' + monthName(mo) + ' ayına kopyalansın mı?')) return;
          await q(sb.from('fin_expenses').insert(add)); toast(add.length + ' gider eklendi.'); T.gider(box);
        } catch (er) { toast(errMsg(er), true); }
      }
    };
    box.onkeydown = function (e) { var r = e.target.closest && e.target.closest('tr[data-xi]'); if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); expForm(box, ex[+r.getAttribute('data-xi')]); } };
    box.onchange = async function (e) {
      var inp = e.target.closest('[data-bud]'); if (!inp) return; var v = inp.value === '' ? 0 : Math.round(parseFloat(inp.value) * 100);
      if (!(v >= 0)) { toast('Bütçe geçersiz.', true); return; }
      try { await q(sb.from('fin_budgets').upsert({ month: from, category: inp.getAttribute('data-bud'), amount_kurus: v })); toast('Bütçe kaydedildi.'); T.gider(box); } catch (er) { toast(errMsg(er), true); }
    };
  };
  var expForm = function (box, x) {
    var v = x || { spent_on: F.month === ym() ? new Date().toISOString().slice(0, 10) : F.month + '-01', category: 'altyapi', vendor: '', amount_kurus: '', note: '', recurring: false };
    A.openDrawer(x ? 'Gideri düzenle' : 'Yeni gider', '<form id="fin-xf" class="fin-form" novalidate>' +
      '<label class="fld">Tarih<input class="in" type="date" name="d" value="' + X(v.spent_on) + '" required></label>' +
      '<label class="fld">Kategori<select class="in" name="c">' + Object.keys(CAT).map(function (k) { return '<option value="' + k + '"' + (k === v.category ? ' selected' : '') + '>' + CAT[k] + '</option>'; }).join('') + '</select></label>' +
      '<label class="fld">Tutar (TL, KDV dahil)<input class="in" type="number" min="0.01" step="0.01" name="a" value="' + (v.amount_kurus ? (v.amount_kurus / 100).toFixed(2) : '') + '" required></label>' +
      '<label class="fld">Kime / ne için<input class="in" name="v" maxlength="120" value="' + X(v.vendor || '') + '" placeholder="Vercel, afiş baskısı, …"></label>' +
      '<label class="fld">Not<textarea class="in" name="n" maxlength="500" placeholder="fatura no, kim ödedi, …">' + X(v.note || '') + '</textarea><small>Fatura ya da dekont dosyası buraya eklenmez; şirket klasöründe tutulur.</small></label>' +
      '<label class="switch"><input type="checkbox" name="r"' + (v.recurring ? ' checked' : '') + '><i></i>Her ay tekrarlıyor</label>' +
      '<div class="acts"><button class="btn blue" type="submit">Kaydet</button>' + (x ? '<button type="button" class="btn ghost" id="fin-xdel">Sil</button>' : '') + '</div></form>');
    var f = $('#fin-xf');
    f.onsubmit = async function (e) {
      e.preventDefault(); var a = kurus(f.a.value);
      if (!(a > 0) || !f.d.value) { toast('Tarih ve tutar gerekli.', true); return; }
      var row = { spent_on: f.d.value, category: f.c.value, amount_kurus: a, vendor: f.v.value.trim() || null, note: f.n.value.trim() || null, recurring: f.r.checked };
      try { await q(x ? sb.from('fin_expenses').update(row).eq('id', x.id) : sb.from('fin_expenses').insert(row)); toast('Kaydedildi.'); A.closeDrawer(); F.month = f.d.value.slice(0, 7); T.gider(box); } catch (er) { toast(errMsg(er), true); }
    };
    if (x) $('#fin-xdel').onclick = async function () { if (!A.confirmBox('Bu gider silinsin mi?')) return; try { await q(sb.from('fin_expenses').delete().eq('id', x.id)); toast('Silindi.'); A.closeDrawer(); T.gider(box); } catch (er) { toast(errMsg(er), true); } };
  };

  /* =========================== SİMÜLATÖR =========================== */
  var SIMK = [
    ['users', 'Başlangıç öğrenci sayısı', 0, 20000, 10, ''], ['growth', 'Aylık yeni öğrenci büyümesi', 0, 50, 1, '%'],
    ['conv', 'Ödeyene dönüşüm', 0, 40, .5, '%'], ['prem', 'Ödeyenler içinde Premium', 0, 100, 5, '%'],
    ['pLite', 'Lite aylık fiyat', 0, 1000, 5, 'TL'], ['pPrem', 'Premium aylık fiyat', 0, 2000, 5, 'TL'],
    ['churn', 'Aylık abonelik kaybı', 0, 40, 1, '%'], ['disc', 'Ortalama kampanya indirimi', 0, 60, 1, '%'],
    ['pages', 'Öğrenci başı aylık sayfa', 0, 1000, 10, 's.'], ['ai', 'Sayfa başı yapay zekâ maliyeti', 0, 2, .01, 'TL'],
    ['fixed', 'Sabit gider', 0, 200000, 500, 'TL/ay'], ['mkt', 'Aylık pazarlama bütçesi', 0, 100000, 500, 'TL']
  ];
  var simDefaults = function () {
    var o = F.ov, pr = function (pl) { var p = (o.prices || []).filter(function (x) { return x.plan === pl && x.period === 'month'; })[0]; return p ? p.amount_kurus / 100 : 0; };
    var u = (o.usage || []).filter(function (x) { return x.m === ym(); })[0];
    return { users: o.users_total || 100, growth: 10, conv: 5, prem: 25, pLite: pr('lite') || 119, pPrem: pr('premium') || 229, churn: 8, disc: 0, pages: u && u.users ? Math.round(u.pages / u.users) : 60, ai: cost('ai_sayfa') || 0.05, fixed: Math.round(fixedMonthly()), mkt: 0 };
  };
  var simRun = function (s) {
    var kdv = 1 + cost('kdv') / 100, kom = 1 - cost('odeme_komisyon') / 100, out = [], users = s.users, paying = users * s.conv / 100, cash = 0, beMonth = null;
    var arpu = ((1 - s.prem / 100) * s.pLite + s.prem / 100 * s.pPrem) * (1 - s.disc / 100);
    for (var i = 0; i < 12; i++) {
      if (i) { var nu = users * s.growth / 100; users += nu; paying = paying * (1 - s.churn / 100) + nu * s.conv / 100; }
      var rev = paying * arpu, net = rev / kdv * kom, ai = users * s.pages * s.ai, exp = ai + s.fixed + s.mkt, profit = net - exp; cash += profit;
      if (beMonth == null && profit >= 0) beMonth = i;
      out.push({ i: i, users: users, paying: paying, rev: rev, net: net, ai: ai, exp: exp, profit: profit, cash: cash });
    }
    return { rows: out, be: beMonth, arpu: arpu };
  };
  var simChart = function (r) {
    var W = 720, H = 240, L = 62, R = 12, Tp = 12, B = 28, n = r.rows.length;
    var vals = []; r.rows.forEach(function (x) { vals.push(x.net, x.exp, x.cash); });
    var mx = Math.max(1, Math.max.apply(null, vals)), mn = Math.min(0, Math.min.apply(null, vals));
    var x = function (i) { return L + (W - L - R) * i / (n - 1); }, y = function (v) { return Tp + (H - Tp - B) * (mx - v) / (mx - mn || 1); };
    var path = function (k) { return r.rows.map(function (d, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(d[k]).toFixed(1); }).join(' '); };
    var g = ''; for (var k = 0; k <= 4; k++) { var v = mn + (mx - mn) * k / 4; g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#E3DECF"/><text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="11" fill="#6A7593">' + X(TLn(v)) + '</text>'; }
    var zero = mn < 0 ? '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(0) + '" y2="' + y(0) + '" stroke="#0D1838" stroke-dasharray="3 3"/>' : '';
    var lbl = r.rows.map(function (d, i) { return '<text x="' + x(i) + '" y="' + (H - 9) + '" text-anchor="middle" font-size="11" fill="#6A7593">' + (i + 1) + '. ay</text>'; }).join('');
    var be = r.be != null ? '<circle cx="' + x(r.be) + '" cy="' + y(r.rows[r.be].net) + '" r="6" fill="#1E8A55" stroke="#fff" stroke-width="2"><title>başabaş: ' + (r.be + 1) + '. ay</title></circle>' : '';
    var area = 'M' + x(0) + ' ' + y(0) + ' ' + r.rows.map(function (d, i) { return 'L' + x(i).toFixed(1) + ' ' + y(d.cash).toFixed(1); }).join(' ') + ' L' + x(n - 1) + ' ' + y(0) + 'Z';
    return '<svg class="chart fin-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="12 aylık net gelir, gider ve kümülatif nakit projeksiyonu">' + g + '<path d="' + area + '" fill="rgba(138,92,246,.12)"/>' + zero +
      '<path class="fin-line" d="' + path('exp') + '" fill="none" stroke="#E0892A" stroke-width="2.5"/><path class="fin-line" d="' + path('net') + '" fill="none" stroke="#2F6BFF" stroke-width="2.5"/><path class="fin-line" d="' + path('cash') + '" fill="none" stroke="#8A5CF6" stroke-width="2" stroke-dasharray="5 4"/>' + be + lbl + '</svg>' +
      '<div class="legend"><span><i style="background:#2F6BFF"></i>net gelir</span><span><i style="background:#E0892A"></i>toplam gider</span><span><i style="background:#8A5CF6"></i>kümülatif nakit</span><span><i style="background:#1E8A55;border-radius:50%"></i>başabaş</span></div>';
  };
  T.sim = async function (box) {
    var sc = await q(sb.from('fin_scenarios').select('*').order('created_at', { ascending: false }).limit(30));
    var S = lsGet('sim', null) || simDefaults();
    SIMK.forEach(function (k) { if (S[k[0]] == null) S[k[0]] = simDefaults()[k[0]]; });
    var fmtv = function (k, v) { return k[5] === 'TL' || k[5] === 'TL/ay' ? TLn(v, k[4] < 1) + (k[5] === 'TL/ay' ? '/ay' : '') : k[5] === '%' ? '%' + Number(v).toLocaleString('tr-TR') : NF(v) + (k[5] ? ' ' + k[5] : ''); };
    box.innerHTML = '<div class="grid fin-sim"><div class="card"><div class="fin-ch"><h2>Varsayımlar</h2><button type="button" class="lnk" id="fin-sreset">gerçek verilerle doldur</button></div>' +
      SIMK.map(function (k) { return '<label class="fin-sl"><span>' + k[1] + '</span><output id="so-' + k[0] + '">' + X(fmtv(k, S[k[0]])) + '</output><input type="range" data-sk="' + k[0] + '" min="' + k[2] + '" max="' + Math.max(k[3], S[k[0]]) + '" step="' + k[4] + '" value="' + S[k[0]] + '" aria-label="' + k[1] + '"></label>'; }).join('') +
      '<form id="fin-ssave" class="fin-inline" novalidate><label class="fld grow">Senaryo adı<input class="in" name="n" maxlength="80" placeholder="Bahar dönemi · iyimser"></label><button class="btn blue sm" type="submit">Kaydet</button></form>' +
      (sc.length ? '<h3 style="margin-top:14px">Kayıtlı senaryolar</h3><div class="fin-scs">' + sc.map(function (s, i) { return '<span class="fin-sc"><button type="button" class="pill blue" data-sload="' + i + '">' + X(s.name) + '</button><button type="button" class="lnk" data-sdel="' + i + '" aria-label="' + X(s.name) + ' senaryosunu sil">×</button></span>'; }).join('') + '</div>' : '') + '</div>' +
      '<div><div class="kpis fin-kpis three" id="fin-sk"></div><div class="card"><h2>12 aylık projeksiyon</h2><p class="sub">KDV ve ödeme komisyonu Maliyet sekmesinden alınır.</p><div id="fin-sc"></div></div><div class="card" style="margin-top:16px"><h2>Ay ay</h2><div class="tbl-w" id="fin-st"></div></div></div></div>';
    var paint = function () {
      var r = simRun(S), last = r.rows[11];
      $('#fin-sk', box).innerHTML = kpi('Başabaş', r.be == null ? 'yok' : (r.be + 1) + '. ay', r.be == null ? '12 ayda kâra geçmiyor' : 'aylık net gelir gideri karşılıyor', r.be == null ? 'neg-k' : 'pos-k') + kpi('12. ay ödeyen', NF(Math.round(last.paying)), NF(Math.round(last.users)) + ' öğrenciden') + kpi('12 ay sonunda nakit', TLn(last.cash), 'öğrenci başı ortalama ' + TLn(r.arpu, 1) + ' / ay', last.cash < 0 ? 'neg-k' : 'pos-k');
      $('#fin-sc', box).innerHTML = simChart(r);
      $('#fin-st', box).innerHTML = '<table><thead><tr><th>Ay</th><th>Öğrenci</th><th>Ödeyen</th><th>Net gelir</th><th>Yapay zekâ</th><th>Toplam gider</th><th>Kâr / zarar</th><th>Kümülatif</th></tr></thead><tbody>' + r.rows.map(function (d) { return '<tr><td>' + (d.i + 1) + '</td><td>' + NF(Math.round(d.users)) + '</td><td>' + NF(Math.round(d.paying)) + '</td><td>' + TLn(d.net) + '</td><td>' + TLn(d.ai) + '</td><td>' + TLn(d.exp) + '</td><td class="' + (d.profit < 0 ? 'neg' : 'pos') + '">' + TLn(d.profit) + '</td><td class="' + (d.cash < 0 ? 'neg' : '') + '">' + TLn(d.cash) + '</td></tr>'; }).join('') + '</tbody></table>';
    };
    box.oninput = function (e) { var i = e.target.closest('[data-sk]'); if (!i) return; var k = SIMK.filter(function (x) { return x[0] === i.getAttribute('data-sk'); })[0]; S[k[0]] = +i.value; $('#so-' + k[0], box).textContent = fmtv(k, S[k[0]]); lsSet('sim', S); paint(); };
    box.onclick = async function (e) {
      var b;
      if (e.target.closest('#fin-sreset')) { S = simDefaults(); lsSet('sim', S); T.sim(box); return; }
      if ((b = e.target.closest('[data-sload]'))) { S = Object.assign(simDefaults(), sc[+b.getAttribute('data-sload')].params || {}); lsSet('sim', S); T.sim(box); toast('"' + sc[+b.getAttribute('data-sload')].name + '" yüklendi.'); return; }
      if ((b = e.target.closest('[data-sdel]'))) { var s = sc[+b.getAttribute('data-sdel')]; if (!A.confirmBox('"' + s.name + '" senaryosu silinsin mi?')) return; try { await q(sb.from('fin_scenarios').delete().eq('id', s.id)); T.sim(box); } catch (er) { toast(errMsg(er), true); } }
    };
    $('#fin-ssave', box).onsubmit = async function (e) { e.preventDefault(); var n = this.n.value.trim(); if (!n) { toast('Senaryoya bir ad ver.', true); return; } try { await q(sb.from('fin_scenarios').insert({ name: n, params: S })); toast('Senaryo kaydedildi.'); T.sim(box); } catch (er) { toast(errMsg(er), true); } };
    paint();
  };

  /* =========================== GÖREVLER + NOTLAR =========================== */
  T.gorev = async function (box) {
    var res = await Promise.all([q(sb.from('fin_tasks').select('*').order('due_on', { ascending: true, nullsFirst: false }).order('created_at')), q(sb.from('fin_notes').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(60))]);
    var tasks = res[0] || [], notes = res[1] || [], today = new Date().toISOString().slice(0, 10);
    var me = (A.me() || {}).name || '';
    box.innerHTML = '<div class="grid fin-work"><div><div class="fin-ch"><h2 class="disp" style="margin:0">Görevler</h2><button type="button" class="btn blue sm" id="fin-newt">+ Görev</button></div><div class="fin-kanban">' +
      Object.keys(TST).map(function (s) { var ts = tasks.filter(function (t) { return t.status === s; }); return '<section class="fin-col" data-col="' + s + '"><h3>' + TST[s] + ' <span class="muted">' + ts.length + '</span></h3>' + (ts.map(function (t) { var late = t.due_on && t.due_on < today && s !== 'bitti'; return '<article class="fin-task' + (late ? ' late' : '') + '" draggable="true" data-tid="' + X(t.id) + '" tabindex="0"><b>' + X(t.title) + '</b>' + (t.detail ? '<p>' + X(t.detail.slice(0, 140)) + '</p>' : '') + '<div class="fin-tm">' + (t.due_on ? '<span class="pill' + (late ? ' bad' : '') + '">' + DT(t.due_on) + '</span>' : '') + (t.assignee ? '<span class="muted">' + X(t.assignee) + '</span>' : '') + '</div></article>'; }).join('') || '<p class="fin-empty">sürükle bırak</p>') + '</section>'; }).join('') + '</div></div>' +
      '<div class="card fin-notes"><h2>Notlar</h2><form id="fin-nf" novalidate><textarea class="in" name="b" maxlength="4000" placeholder="Toplantı notu, fikir, hatırlatma…"></textarea><div class="acts" style="justify-content:space-between"><label class="switch"><input type="checkbox" name="p"><i></i>Sabitle</label><button class="btn blue sm" type="submit">Not ekle</button></div></form>' +
      '<div class="fin-nl">' + notes.map(function (n) { return '<div class="fin-n' + (n.pinned ? ' pin' : '') + '"><p>' + X(n.body) + '</p><div class="fin-tm"><span class="muted">' + X(n.author || '') + ' · ' + DT(n.created_at, true) + '</span><button type="button" class="lnk" data-npin="' + X(n.id) + '" data-v="' + (n.pinned ? 0 : 1) + '">' + (n.pinned ? 'sabitlemeyi kaldır' : 'sabitle') + '</button><button type="button" class="lnk" data-ndel="' + X(n.id) + '">sil</button></div></div>'; }).join('') + '</div></div></div>';
    var byId = function (id) { return tasks.filter(function (t) { return t.id === id; })[0]; };
    box.onclick = async function (e) {
      var b;
      if (e.target.closest('#fin-newt')) { taskForm(box, null); return; }
      if ((b = e.target.closest('[data-tid]'))) { taskForm(box, byId(b.getAttribute('data-tid'))); return; }
      if ((b = e.target.closest('[data-ndel]'))) { if (!A.confirmBox('Not silinsin mi?')) return; try { await q(sb.from('fin_notes').delete().eq('id', b.getAttribute('data-ndel'))); T.gorev(box); } catch (er) { toast(errMsg(er), true); } return; }
      if ((b = e.target.closest('[data-npin]'))) { try { await q(sb.from('fin_notes').update({ pinned: b.getAttribute('data-v') === '1' }).eq('id', b.getAttribute('data-npin'))); T.gorev(box); } catch (er) { toast(errMsg(er), true); } }
    };
    box.onkeydown = function (e) { var t = e.target.closest && e.target.closest('[data-tid]'); if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); taskForm(box, byId(t.getAttribute('data-tid'))); } };
    var drag = null;
    box.ondragstart = function (e) { var t = e.target.closest('[data-tid]'); if (!t) return; drag = t.getAttribute('data-tid'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', drag); } catch (er) {} t.classList.add('drag'); };
    box.ondragend = function () { drag = null; $$('.drag,.over', box).forEach(function (x) { x.classList.remove('drag', 'over'); }); };
    box.ondragover = function (e) { var c = e.target.closest('[data-col]'); if (c && drag) { e.preventDefault(); $$('.over', box).forEach(function (x) { if (x !== c) x.classList.remove('over'); }); c.classList.add('over'); } };
    box.ondrop = async function (e) {
      var c = e.target.closest('[data-col]'); if (!c || !drag) return; e.preventDefault(); var st = c.getAttribute('data-col'), t = byId(drag); if (!t || t.status === st) return;
      try { await q(sb.from('fin_tasks').update({ status: st, done_at: st === 'bitti' ? new Date().toISOString() : null }).eq('id', t.id)); T.gorev(box); } catch (er) { toast(errMsg(er), true); }
    };
    $('#fin-nf', box).onsubmit = async function (e) { e.preventDefault(); var v = this.b.value.trim(); if (!v) return; try { await q(sb.from('fin_notes').insert({ body: v, pinned: this.p.checked, author: me || null })); T.gorev(box); } catch (er) { toast(errMsg(er), true); } };
  };
  var taskForm = function (box, t) {
    var v = t || { title: '', detail: '', due_on: '', status: 'yapilacak', assignee: (A.me() || {}).name || '' };
    A.openDrawer(t ? 'Görev' : 'Yeni görev', '<form id="fin-tf" class="fin-form" novalidate><label class="fld">Başlık<input class="in" name="ti" maxlength="160" value="' + X(v.title) + '" required></label>' +
      '<label class="fld">Ayrıntı<textarea class="in" name="de" maxlength="1500">' + X(v.detail || '') + '</textarea></label>' +
      '<label class="fld">Son tarih<input class="in" type="date" name="du" value="' + X(v.due_on || '') + '"></label>' +
      '<label class="fld">Durum<select class="in" name="st">' + Object.keys(TST).map(function (k) { return '<option value="' + k + '"' + (k === v.status ? ' selected' : '') + '>' + TST[k] + '</option>'; }).join('') + '</select><small>Telefonda durum buradan değişir; bilgisayarda kartı sütunlar arasında sürükleyebilirsin.</small></label>' +
      '<label class="fld">Kimde<input class="in" name="as" maxlength="80" value="' + X(v.assignee || '') + '"></label>' +
      '<div class="acts"><button class="btn blue" type="submit">Kaydet</button>' + (t ? '<button type="button" class="btn ghost" id="fin-tdel">Sil</button>' : '') + '</div></form>');
    var f = $('#fin-tf');
    f.onsubmit = async function (e) {
      e.preventDefault(); var ti = f.ti.value.trim(); if (ti.length < 2) { toast('Başlık en az 2 harf.', true); return; }
      var row = { title: ti, detail: f.de.value.trim() || null, due_on: f.du.value || null, status: f.st.value, assignee: f.as.value.trim() || null, done_at: f.st.value === 'bitti' ? (t && t.done_at) || new Date().toISOString() : null };
      try { await q(t ? sb.from('fin_tasks').update(row).eq('id', t.id) : sb.from('fin_tasks').insert(row)); toast('Kaydedildi.'); A.closeDrawer(); T.gorev(box); } catch (er) { toast(errMsg(er), true); }
    };
    if (t) $('#fin-tdel').onclick = async function () { if (!A.confirmBox('Görev silinsin mi?')) return; try { await q(sb.from('fin_tasks').delete().eq('id', t.id)); A.closeDrawer(); T.gorev(box); } catch (er) { toast(errMsg(er), true); } };
  };

  /* =========================== AYLIK RAPOR =========================== */
  var libs = {};
  var lib = function (k, url, get) {
    if (libs[k]) return libs[k];
    libs[k] = new Promise(function (res, rej) { var s = document.createElement('script'); s.src = url; s.onload = function () { res(get()); }; s.onerror = function () { libs[k] = null; rej(new Error('Kütüphane yüklenemedi')); }; document.head.appendChild(s); });
    return libs[k];
  };
  T.rapor = async function (box) {
    var mo = F.month, from = mo + '-01', to = addMonth(mo, 1) + '-01', o = F.ov;
    var res = await Promise.all([
      q(sb.from('fin_expenses').select('*').gte('spent_on', from).lt('spent_on', to)),
      q(sb.from('fin_budgets').select('*').eq('month', from)),
      q(sb.from('fin_tasks').select('*')),
      q(sb.from('fin_notes').select('*').eq('pinned', true).limit(8)),
      rpc('fin_coupons')
    ]);
    var ex = res[0] || [], bud = {}, tasks = res[2] || [], notes = res[3] || [], coupons = res[4] || [];
    (res[1] || []).forEach(function (b) { bud[b.category] = Number(b.amount_kurus); });
    var mrow = (o.months || []).filter(function (r) { return r.m === mo; })[0] || { kurus: 0, n: 0, refund: 0 };
    var urow = (o.usage || []).filter(function (r) { return r.m === mo; })[0] || { pages: 0, docs: 0, users: 0 };
    var gross = mrow.kurus - (mrow.refund || 0), net = gross / (1 + cost('kdv') / 100) * (1 - cost('odeme_komisyon') / 100);
    var spent = ex.reduce(function (s, e) { return s + Number(e.amount_kurus); }, 0), ai = urow.pages * cost('ai_sayfa') * 100;
    var result = net - spent;
    var byCat = {}; ex.forEach(function (e) { byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount_kurus); });
    var done = tasks.filter(function (t) { return t.status === 'bitti' && t.done_at && String(t.done_at).slice(0, 7) === mo; }), open = tasks.filter(function (t) { return t.status !== 'bitti'; });
    var activeC = coupons.filter(function (c) { return c.active; });
    var me = A.me() || {};
    box.innerHTML = '<div class="tools fin-month"><button type="button" class="btn sm ghost" data-mo="-1" aria-label="önceki ay">‹</button><b class="disp">' + X(monthName(mo)) + '</b><button type="button" class="btn sm ghost" data-mo="1" aria-label="sonraki ay"' + (mo >= ym() ? ' disabled' : '') + '>›</button><span class="grow"></span><button type="button" class="btn blue sm" id="fin-pdf">PDF indir</button></div>' +
      '<div class="fin-paper" id="fin-paper"><header class="fin-ph"><div><span class="mono">ACADEX · FİNANS</span><h2 class="disp">Aylık finans raporu</h2><p>' + X(monthName(mo)) + '</p></div><div class="fin-pm"><span>Hazırlayan</span><b>' + X(me.name || me.email || '') + '</b><span>' + DT(new Date(), true) + '</span></div></header>' +
      '<div class="fin-pk"><div><span>Tahsilat (iade düşülmüş)</span><b>' + TL(gross) + '</b><small>' + NF(mrow.n) + ' ödeme</small></div><div><span>Net gelir</span><b>' + TL(net) + '</b><small>KDV ve komisyon sonrası</small></div><div><span>Gider</span><b>' + TL(spent) + '</b><small>' + NF(ex.length) + ' kayıt</small></div><div class="' + (result < 0 ? 'neg' : 'pos') + '"><span>Dönem sonucu</span><b>' + TL(result) + '</b><small>net gelir − gider</small></div></div>' +
      '<section><h3>Öğrenci ve kullanım</h3><dl class="kv"><dt>Toplam öğrenci</dt><dd>' + NF(o.users_total) + '</dd><dt>Aktif abonelik</dt><dd>' + NF(o.active_paid) + '</dd><dt>Aylık yinelenen gelir</dt><dd>' + TL(o.mrr_kurus) + '</dd><dt>Özetlenen sayfa</dt><dd>' + NF(urow.pages) + ' (' + NF(urow.users) + ' öğrenci, ' + NF(urow.docs) + ' belge)</dd><dt>Tahmini yapay zekâ maliyeti</dt><dd>' + TL(ai) + '</dd></dl></section>' +
      '<section><h3>Gider ve bütçe</h3>' + (Object.keys(byCat).length || Object.keys(bud).length ? '<table><thead><tr><th>Kategori</th><th>Bütçe</th><th>Harcanan</th><th>Fark</th></tr></thead><tbody>' + Object.keys(CAT).filter(function (k) { return byCat[k] || bud[k]; }).map(function (k) { var d = (bud[k] || 0) - (byCat[k] || 0); return '<tr><td>' + CAT[k] + '</td><td>' + (bud[k] ? TL(bud[k]) : '—') + '</td><td>' + TL(byCat[k] || 0) + '</td><td class="' + (bud[k] && d < 0 ? 'neg' : '') + '">' + (bud[k] ? TL(d) : '—') + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="muted">Bu ay gider ya da bütçe kaydı yok.</p>') + '</section>' +
      '<section><h3>Kampanyalar</h3>' + (activeC.length ? '<ul>' + activeC.map(function (c) { return '<li><b class="mono">' + X(c.code) + '</b> ' + X(c.label || '') + ' · %' + c.percent_off + ' · ' + NF(c.used_count) + ' kullanım · ' + TL(c.revenue_kurus) + ' gelir</li>'; }).join('') + '</ul>' : '<p class="muted">Açık kampanya kodu yok.</p>') + '</section>' +
      '<section><h3>İş takibi</h3><p>Bu ay biten: <b>' + done.length + '</b> · açık: <b>' + open.length + '</b></p>' + (done.length ? '<ul>' + done.map(function (t) { return '<li>✓ ' + X(t.title) + '</li>'; }).join('') + '</ul>' : '') + (open.length ? '<p class="muted" style="margin:8px 0 2px">Sıradaki</p><ul>' + open.slice(0, 8).map(function (t) { return '<li>' + X(t.title) + (t.due_on ? ' <span class="muted">· ' + DT(t.due_on) + '</span>' : '') + '</li>'; }).join('') + '</ul>' : '') + '</section>' +
      (notes.length ? '<section><h3>Öne çıkan notlar</h3>' + notes.map(function (n) { return '<blockquote>' + X(n.body) + '</blockquote>'; }).join('') + '</section>' : '') +
      '<section class="fin-yorum"><h3>Değerlendirme</h3><textarea class="in" id="fin-yorum" placeholder="Bu ay öne çıkanlar, riskler, gelecek ayın önceliği… (PDF\'e eklenir)">' + X(lsGet('yorum-' + mo, '')) + '</textarea><div class="fin-yorum-p" id="fin-yorum-p"></div></section>' +
      '<footer>Acadex · gizli · yalnız iç kullanım içindir. Rakamlar veritabanından otomatik toplanır; kişisel öğrenci verisi içermez.</footer></div>';
    box.onclick = async function (e) {
      var b;
      if ((b = e.target.closest('[data-mo]'))) { F.month = addMonth(F.month, +b.getAttribute('data-mo')); T.rapor(box); return; }
      if ((b = e.target.closest('#fin-pdf'))) {
        var el = $('#fin-paper', box), old = b.textContent; b.disabled = true; b.textContent = 'hazırlanıyor…';
        try {
          var h2c = await lib('h2c', 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', function () { return window.html2canvas; });
          var J = await lib('pdf', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', function () { return window.jspdf.jsPDF; });
          $('#fin-yorum-p', box).textContent = $('#fin-yorum', box).value; el.classList.add('fin-shot');
          var cv = await h2c(el, { scale: 2, backgroundColor: '#FFFFFF', width: el.scrollWidth, height: el.scrollHeight, logging: false });
          el.classList.remove('fin-shot');
          var doc = new J({ unit: 'mm', format: 'a4' }), pw = 190, ph = 277, sc = pw / cv.width, pagePx = Math.floor(ph / sc), y = 0, pg = 0;
          /* biraz taşıyorsa ikinci sayfaya kırıntı bırakma: tek sayfaya sığdır */
          if (cv.height <= pagePx * 1.15) { var r1 = Math.min(pw / cv.width, ph / cv.height); doc.addImage(cv.toDataURL('image/jpeg', 0.9), 'JPEG', 10 + (pw - cv.width * r1) / 2, 10, cv.width * r1, cv.height * r1); y = cv.height; }
          while (y < cv.height) {
            var h = Math.min(pagePx, cv.height - y), part = document.createElement('canvas'); part.width = cv.width; part.height = h;
            part.getContext('2d').drawImage(cv, 0, y, cv.width, h, 0, 0, cv.width, h);
            if (pg++) doc.addPage(); doc.addImage(part.toDataURL('image/jpeg', 0.9), 'JPEG', 10, 10, pw, h * sc); y += h;
          }
          doc.save('acadex-finans-raporu-' + mo + '.pdf'); toast('PDF indirildi.');
        } catch (er) { el.classList.remove('fin-shot'); toast(errMsg(er), true); }
        b.disabled = false; b.textContent = old;
      }
    };
    $('#fin-yorum', box).oninput = function () { lsSet('yorum-' + mo, this.value); };
  };
})();
