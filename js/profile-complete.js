/* ==========================================================================
   Acadex · "profilini tamamla" (profile-complete.js)
   Google / Apple ile ilk kez gelen öğrencinin profilinde bölüm ve öğrenci
   numarası yoktur (veritabanı geçici 'oauth-<id>' numarası koyar). Panel
   açılınca bu pencere ikisini ve KVKK onayını ister; kaydedince sayfa
   yenilenir ve panel bölüme göre dolar. E-postayla kayıt olanlar bu
   pencereyi hiç görmez.
   ========================================================================== */
(function () {
  'use strict';
  var g = function (n) { try { return (0, eval)(n); } catch (e) { return undefined; } };
  var DEPTS = [
    ['Management Information Systems', 'Yönetim Bilişim Sistemleri'],
    ['Business Administration', 'İşletme'],
    ['International Trade and Business', 'Uluslararası Ticaret ve İşletmecilik'],
    ['Banking and Finance', 'Bankacılık ve Finans']
  ];
  var needs = function (p) { return !!p && (!p.department || /^oauth-/.test(String(p.student_number || ''))); };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var css = [
    '.pcx-back{position:fixed;inset:0;z-index:1000002;background:rgba(13,24,56,.62);display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto}',
    '.pcx{width:min(480px,100%);background:#FFFEFB;color:#0D1838;border-radius:8px;padding:24px 24px 20px;box-shadow:0 40px 80px -40px rgba(13,24,56,.75);font-family:"Instrument Sans",system-ui,sans-serif}',
    '.pcx .k{display:block;font-family:Caveat,"Segoe Print",cursive;font-size:22px;color:#2F6BFF;line-height:1;transform:rotate(-2deg);transform-origin:0 100%}',
    '.pcx h2{margin:6px 0 4px;font-family:"Bricolage Grotesque",system-ui,sans-serif;font-size:26px;font-weight:800;letter-spacing:-.02em}',
    '.pcx p.s{margin:0 0 16px;font-size:15px;line-height:1.5;color:#4B5675}',
    '.pcx label.f{display:block;margin:0 0 14px;font-size:14px;font-weight:600;color:#1A2A5C}',
    '.pcx label.f input,.pcx label.f select{display:block;width:100%;box-sizing:border-box;margin-top:6px;min-height:46px;padding:8px 12px;border:1.6px solid #C9D1E1;border-radius:8px;background:#fff;color:#0D1838;font:inherit;font-size:16px;font-weight:400}',
    '.pcx label.f input:focus,.pcx label.f select:focus{outline:none;border-color:#2F6BFF;box-shadow:0 0 0 3px rgba(47,107,255,.18)}',
    '.pcx .ok{display:flex;gap:10px;align-items:flex-start;margin:4px 0 16px;font-size:14px;line-height:1.45;color:#33405F;cursor:pointer}',
    '.pcx .ok input{width:20px;height:20px;margin:1px 0 0;flex:none;accent-color:#2F6BFF}',
    '.pcx .ok a{color:#1F5FD6}',
    '.pcx .err{margin:0 0 12px;padding:8px 12px;border-radius:6px;background:#FFF5F3;color:#8E2B20;font-size:14px}',
    '.pcx .err[hidden]{display:none}',
    '.pcx .r{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}',
    '.pcx .go{border:0;background:#2F6BFF;color:#fff;border-radius:999px;padding:12px 24px;min-height:48px;font:inherit;font-weight:700;font-size:16px;cursor:pointer;box-shadow:0 12px 22px -12px rgba(47,107,255,.8)}',
    '.pcx .go:disabled{opacity:.6;cursor:default}',
    '.pcx .out{border:0;background:none;color:#4B5675;font:inherit;font-size:14px;text-decoration:underline;text-underline-offset:3px;cursor:pointer;min-height:44px}',
    '.pcx button:focus-visible{outline:2px solid #2F6BFF;outline-offset:2px}'
  ].join('\n');

  var open = function (p, u) {
    if (document.querySelector('.pcx-back')) return;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var prov = (u && u.app_metadata && u.app_metadata.provider) || '';
    var via = prov === 'google' ? 'Google' : prov === 'apple' ? 'Apple' : '';
    var back = document.createElement('div'); back.className = 'pcx-back';
    back.innerHTML = '<form class="pcx" role="dialog" aria-modal="true" aria-labelledby="pcx-t" novalidate>' +
      '<span class="k">hoş geldin</span><h2 id="pcx-t">Profilini tamamla</h2>' +
      '<p class="s">' + (via ? via + ' ile girdin. ' : '') + 'Acadex\'i bölümüne göre hazırlamamız için iki bilgi lazım; bir kez sorarız.</p>' +
      '<label class="f">Ad soyad<input name="ad" type="text" autocomplete="name" maxlength="80" required value="' + esc(p.full_name || '') + '"></label>' +
      '<label class="f">Bölüm<select name="bolum" required>' + (window.AX_BOLUM ? window.AX_BOLUM.options(p.department || '', 'bölümünü seç') : '<option value="">bölümünü seç</option>' + DEPTS.map(function (d) { return '<option value="' + d[0] + '"' + (p.department === d[0] ? ' selected' : '') + '>' + d[1] + '</option>'; }).join('')) + '</select></label>' +
      '<label class="f">Öğrenci numarası<input name="no" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="12" autocomplete="off" placeholder="6–12 rakam" required value="' + esc(/^oauth-/.test(String(p.student_number || '')) ? '' : (p.student_number || '')) + '"></label>' +
      '<label class="ok"><input type="checkbox" name="kvkk"><span><a href="legal.html#privacy" target="_blank" rel="noopener">KVKK aydınlatma metnini</a> ve <a href="legal.html#terms" target="_blank" rel="noopener">kullanım şartlarını</a> okudum, kabul ediyorum.</span></label>' +
      '<p class="err" role="alert" hidden></p>' +
      '<div class="r"><button type="button" class="out">çıkış yap</button><button type="submit" class="go">Kaydet ve başla</button></div></form>';
    document.body.appendChild(back);
    document.documentElement.style.overflow = 'hidden';
    var f = back.querySelector('form'), err = back.querySelector('.err'), go = back.querySelector('.go');
    var no = f.elements.no;
    no.addEventListener('input', function () { var d = no.value.replace(/\D/g, ''); if (d !== no.value) no.value = d; });
    var fail = function (m, el) { err.textContent = m; err.hidden = false; if (el) el.focus(); };
    back.querySelector('.out').addEventListener('click', function () {
      var sb = g('supabaseClient'); var done = function () { location.replace('login.html'); };
      if (sb) Promise.resolve(sb.auth.signOut()).then(done, done); else done();
    });
    back.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var l = Array.prototype.slice.call(back.querySelectorAll('input, select, button, a')).filter(function (x) { return !x.disabled && x.offsetParent !== null; });
      if (e.shiftKey && document.activeElement === l[0]) { e.preventDefault(); l[l.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === l[l.length - 1]) { e.preventDefault(); l[0].focus(); }
    });
    f.addEventListener('submit', function (e) {
      e.preventDefault(); err.hidden = true;
      var ad = f.elements.ad.value.replace(/\s+/g, ' ').trim(), bol = f.elements.bolum.value, num = no.value.trim();
      if (ad.length < 3) return fail('Adını ve soyadını yazar mısın?', f.elements.ad);
      if (!bol) return fail('Bölümünü seç.', f.elements.bolum);
      if (!/^\d{6,12}$/.test(num)) return fail('Öğrenci numarası 6–12 rakam olmalı.', no);
      if (!f.elements.kvkk.checked) return fail('Devam etmek için KVKK metnini ve kullanım şartlarını onaylaman gerekiyor.', f.elements.kvkk);
      var sb = g('supabaseClient'); if (!sb || !u) return fail('Oturum bulunamadı; sayfayı yenileyip tekrar dener misin?');
      go.disabled = true; go.textContent = 'Kaydediliyor…';
      Promise.resolve(sb.from('profiles').update({ full_name: ad, department: bol, student_number: num }).eq('id', u.id)).then(function (r) {
        if (r && r.error) {
          var dup = r.error.code === '23505' || /duplicate|unique/i.test(r.error.message || '');
          fail(dup ? 'Bu öğrenci numarası başka bir hesapta kayıtlı. Numaranı kontrol et; doğruysa bize yaz.' : 'Kaydedilemedi: ' + (r.error.message || 'bilinmeyen hata'), dup ? no : null);
          go.disabled = false; go.textContent = 'Kaydet ve başla'; return;
        }
        location.reload();
      }, function () { fail('Bağlantı kurulamadı; biraz sonra tekrar dener misin?'); go.disabled = false; go.textContent = 'Kaydet ve başla'; });
    });
    setTimeout(function () { var first = !f.elements.ad.value ? f.elements.ad : !f.elements.bolum.value ? f.elements.bolum : no; first.focus(); }, 50);
  };

  var tries = 0;
  var check = function () {
    var p = g('currentUserProfile') || window.currentUserProfile, u = g('currentUser') || window.currentUser;
    if (p && u) { if (needs(p)) open(p, u); return; }
    if (++tries < 60) setTimeout(check, 500);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', check); else check();
})();
