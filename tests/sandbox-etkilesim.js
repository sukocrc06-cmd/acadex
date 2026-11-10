/* ==========================================================================
   ACADEX — SANDBOX ETKİLEŞİM PANELİ DENETİMİ (tests/sandbox-etkilesim.js)

   NEDEN VAR (10.11.2026): panel ilk kez uçtan uca tarandı (JS + HTML + RLS)
   ve tablo o güne dek fiilen boş olduğu için hiç görülmemiş kusurlar çıktı.
   En önemlisi: profiles'ın tek SELECT politikası (auth.uid() = id) olduğu
   için panel diğer kullanıcıların adını HATASIZ ama BOŞ okuyordu — herkes
   "Bir öğrenci" + "?" olacaktı. Bu dosya o taramada yapılan düzeltmeleri
   kilitler; biri geri alınırsa düşer.

   Düzeltmelerin kaydı: 20261110c_panel_profil_guvenlik.sql (sunucu) ve
   js/acadex-ink.js ETK/panel blokları (istemci).

   Çalıştırma:  node tests/sandbox-etkilesim.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const { test, summary } = makeRunner();

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const ink = read('js/acadex-ink.js');
const sql = read('supabase/migrations/20261110c_panel_profil_guvenlik.sql');
const kez = (h, n) => h.split(n).length - 1;

test('public_profiles görünümü DAR: dokuz herkese açık kolon, gizli kolon yok', () => {
  /* profiles email ve student_number taşıyor; "authenticated herkes okusun"
     politikası o kolonları bütün öğrencilere açardı. Çözüm bilerek görünüm. */
  const m = sql.match(/create or replace view public\.public_profiles[\s\S]*?from public\.profiles/);
  assert.ok(m, 'public_profiles görünümü yok');
  const govde = m[0];
  for (const kol of ['id', 'full_name', 'department', 'avatar_url', 'banner_url',
    'bio', 'github_url', 'linkedin_url', 'website_url']) {
    assert.ok(govde.includes(kol), 'görünümde ' + kol + ' yok — panel o alanı kaybeder');
  }
  for (const gizli of ['email', 'student_number', 'is_admin', 'notification_prefs', 'day_memo']) {
    assert.ok(!govde.includes(gizli), 'GİZLİ KOLON görünümde: ' + gizli);
  }
  assert.match(govde, /security_invoker = off/,
    'security_invoker=off değil — görünüm profiles RLS\'ine takılır ve yine boş döner');
  assert.match(sql, /coalesce\(is_suspended, false\) = false/, 'askıya alınan hesap süzülmüyor');
  assert.match(sql, /revoke all on public\.public_profiles from public, anon/, 'anon görünümü okuyabilir');
  assert.match(sql, /grant select on public\.public_profiles to authenticated, service_role/,
    'authenticated görünümü okuyamaz — panel yine boş kalır');
});

test('anon kapatıldı: SELECT politikaları giriş şartına bağlı, yetkiler geri alınmış', () => {
  /* Üç politika adında "authenticated" yazarken koşulu true idi; anon anahtarı
     herkese açık olduğundan giriş yapmadan bütün inceleme/tepki/takip verisi
     çekilebiliyordu. */
  assert.equal(kez(sql, 'using (auth.uid() is not null)'), 3,
    'comments/likes/follows SELECT politikalarının üçü de giriş şartında değil');
  assert.ok(!/using \(true\)/.test(sql), 'migration hâlâ using (true) içeriyor');
  assert.match(sql, /using \(auth\.uid\(\) is not null\n\s+and \(\(not hidden\) or auth\.uid\(\) = user_id or current_is_admin\(\)\)\)/,
    'sandbox_projects SELECT\'i hem giriş şartı hem gizleme kuralını birlikte taşımıyor');
  for (const t of ['sandbox_projects', 'sandbox_project_comments', 'sandbox_project_likes',
    'sandbox_follows', 'sandbox_reports', 'sandbox_workspaces']) {
    assert.ok(new RegExp('revoke all on public\\.' + t + '\\s+from anon').test(sql),
      t + ' için anon yetkisi geri alınmıyor');
  }
  assert.match(sql, /create policy sandbox_project_likes_update_own[\s\S]*?for update[\s\S]*?using \(auth\.uid\(\) = user_id\)[\s\S]*?with check \(auth\.uid\(\) = user_id\)/,
    'likes UPDATE politikası yok — tepki değiştirme upsert\'i RLS\'e takılır');
});

test('profil okuması public_profiles üzerinden, profiles yedeği duruyor', () => {
  /* Doğrudan profiles sorgusu hata vermeden boş döner (RLS yalnız kendi satırı)
     ve PPL dolmaz: her gönderi sahibi "Bir öğrenci" olur. */
  const i = ink.indexOf("from('public_profiles')");
  assert.ok(i > -1, 'panel public_profiles görünümünü sorgulamıyor — herkes "Bir öğrenci" olur');
  const blok = ink.slice(i, i + 700);
  assert.ok(blok.includes("pq = await sb().from('profiles')"),
    'görünüm yoksa (migration koşmadıysa) profiles yedeği yok — panel beklemeden bozulur');
  assert.ok(ink.indexOf("from('public_profiles')") < ink.indexOf(blok.slice(blok.indexOf("from('profiles')"))) + i,
    'önce görünüm denenmeli, yedek sonra gelmeli');
});

test('canlı önizleme kum havuzundan POPUP KAÇIRMAZ ve tam ekranla aynı seviyede', () => {
  /* allow-popups-to-escape-sandbox, öğrencinin yazdığı rastgele adresin tam
     yetkili pencere açmasına izin veriyordu; openFull zaten vermiyordu. */
  assert.ok(!ink.includes('allow-popups-to-escape-sandbox'),
    'kaçış izni geri gelmiş');
  assert.ok(ink.includes('sandbox="allow-scripts allow-same-origin allow-forms allow-popups"'),
    'satır içi canlı iframe izin kümesi değişmiş — bkz. liveUrl aynı kökeni zaten reddeder');
  assert.ok(ink.includes("fullF.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups')"),
    'tam ekran canlı iframe izin kümesi değişmiş');
  assert.ok(ink.includes("fullF.setAttribute('sandbox', 'allow-scripts')"),
    'tam ekran snapshot iframe\'i yalnız allow-scripts olmalı');
});

test('listede olmayan tür "undefined" BASMAZ (üç yer korumalı)', () => {
  assert.ok(ink.includes("(KINDS[p.kind] || X(p.kind))"), 'postHTML tür etiketi korumasız');
  assert.ok(ink.includes('bits.push(ETK.KINDS[F.kind] || F.kind)'), 'süzgeç özeti korumasız');
  assert.ok(ink.includes("data-fk=\"' + X(k) + '\""), 'süzgeç düğmesinin data-fk değeri kaçırılmıyor');
  assert.ok(ink.includes("(k ? ETK.KINDS[k] || X(k) : 'hepsi')"), 'süzgeç düğmesi etiketi korumasız');
});

test('tepki değişimi TEK adım (upsert); sil+ekle yolu kalktı', () => {
  /* Eski yol: önce sil, sonra ekle. Ekleme düşünce eski tepki sunucudan da
     gitmiş oluyordu. upsert (onConflict: project_id,user_id — tekil kısıt
     20260830c'de) bunu tek adıma indirir. */
  assert.equal(kez(ink, "from('sandbox_project_likes').upsert(row, { onConflict: 'project_id,user_id'"), 2,
    'upsert iki dalda da (reaction kolonlu/kolonsuz) kullanılmıyor');
  assert.equal(kez(ink, "from('sandbox_project_likes').insert("), 0,
    'likes tablosuna hâlâ düz insert var — sil+ekle yolu geri gelmiş olabilir');
  const r = ink.match(/var react = async function[\s\S]*?\n  };/);
  assert.ok(r, 'react fonksiyonu bulunamadı');
  const silIdx = r[0].indexOf(".delete()");
  const wasEsit = r[0].indexOf('if (was === k) {');
  assert.ok(wasEsit > -1 && silIdx > wasEsit,
    'silme yalnız "aynı tepkiyi kaldırma" dalında olmalı');
});

test('kırılganlık korumaları yerinde (seçici, h3, reload, bölüm etiketi)', () => {
  // data-ft ile aynı deyim: DB değeri seçiciye gömülmez
  assert.ok(ink.includes("QA('[data-fk]').filter(function (x) { return x.getAttribute('data-fk') === F.kind; })[0]"),
    'data-fk odağı hâlâ seçiciyle aranıyor — tırnaklı tür değeri patlatır');
  // h3 korumaları (postHTML değişirse panel atmasın)
  assert.ok(ink.includes("var h = el.querySelector('h3'); if (h) { h.setAttribute('tabindex', '-1'); setTimeout(function () { h.focus({ preventScroll: true }); }, 300); }"),
    'afterCompose h3 koruması yok');
  assert.ok(ink.includes("var h = el.querySelector('h3'); if (h) { h.setAttribute('tabindex', '-1'); setTimeout(function () { h.focus({ preventScroll: true }); }, calm ? 0 : 450); }"),
    'goTo h3 koruması yok');
  // reload her durumda Promise döndürür (loadSandboxProjects return ediyor)
  assert.ok(ink.includes("if (loading) return Promise.resolve(); loading = true; if (!SBX.st.loaded)"),
    'reload yüklenme sırasında undefined döndürüyor');
  // bölüm etiketi: option bulunamazsa patlamasın
  assert.ok(ink.includes('bits.push(dop ? dop.textContent : F.dept)'), 'bölüm etiketi koruması yok');
});

test('ölü kod geri gelmedi, cm korumaları duruyor', () => {
  assert.equal(kez(ink, 'withMine'), 0, 'withMine kimlik fonksiyonu geri gelmiş');
  assert.equal(kez(ink, 'ETK.watchFrames(el); ETK.watchFrames(el)'), 0, 'çift watchFrames geri gelmiş');
  assert.ok(ink.includes('if (rs && (p.cm || []).length >= 2)'), 'decorate cm koruması yok');
  assert.ok(ink.includes('var cm = p.cm || [], box = el.querySelector'), 'paintCms cm koruması yok');
  const ret = ink.match(/return \{ frameCheck: frameCheck,[^\n]*/);
  assert.ok(ret && !/mine: mine|saveMine|upsert: upsert/.test(ret[0]),
    'ETK ölü dışa açımları (mine/saveMine/upsert) geri gelmiş');
});

test('panel düzeltmeleri PANEL DIŞINA taşmadı', () => {
  /* 10.11 düzeltmesi sırasında iki genel desen bir kez panel dışındaki koda
     (bölüm akışı ve başka bir yükleyici) uygulanıp geri alındı. Bu test o
     sınırı tutar: panel dışı kod kendi sahibinindir (CLAUDE.md kapsam kuralı). */
  assert.equal(kez(ink, 'if (loading) return; loading = true;'), 1,
    'panel dışı yükleyicinin dönüşü değiştirilmiş');
  assert.ok(ink.includes("block: 'center' }); var h = el.querySelector('h3'); h.setAttribute"),
    'bölüm akışındaki h3 satırına dokunulmuş');
});

summary();
