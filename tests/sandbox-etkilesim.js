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
  /* authenticated'dan revoke ŞART: Supabase varsayılanı görünüme ALL verir,
     grant'lar toplamalıdır ve bu görünüm otomatik güncellenebilir —
     security_invoker=off ile yazma profiles RLS'ini aşardı (canlıda ölçüldü:
     revoke öncesi ACL authenticated=arwdDxtm, sonrası =r). */
  assert.match(sql, /revoke all on public\.public_profiles from public, anon, authenticated/,
    'authenticated\'ın varsayılan ALL yetkisi geri alınmıyor — görünümden başkasının profili YAZILABİLİR');
  assert.match(sql, /grant select on public\.public_profiles to authenticated;/,
    'authenticated görünümü okuyamaz — panel yine boş kalır');
  assert.ok(!/grant (all|insert|update|delete)[^\n]*public_profiles[^\n]*authenticated/.test(sql),
    'görünümde authenticated\'a okuma dışı yetki verilmiş');
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
  assert.match(sql, /revoke execute on function public\.bump_sandbox_project_likes_count\(\)\s+from public, anon, authenticated/,
    'sayaç tetikleyicisinin EXECUTE yetkisi istemci rollerinden alınmıyor (advisor uyarısı)');
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

test('İNCELEME DÜZENLENEBİLİR: yalnız metin + updated_at, null = hiç düzenlenmedi', () => {
  /* Canlı denetimde Berkay'ın bulduğu boşluk: kendi incelemende "sil" var ama
     "düzenle" yoktu. Sunucu ayağı 20261110d; updated_at NULL kalırsa hiç
     düzenlenmemiş demektir (0/now() ile doldurulmaz — süre raporu dersi). */
  const mig = read('supabase/migrations/20261110d_inceleme_duzenleme.sql');
  assert.match(mig, /add column if not exists updated_at timestamptz/, 'updated_at kolonu yok');
  assert.match(mig, /for update\s+using \(auth\.uid\(\) = user_id\)\s+with check \(auth\.uid\(\) = user_id\)/,
    'update politikası kendi satırıyla sınırlı değil');
  assert.match(mig, /revoke update on public\.sandbox_project_comments from authenticated/,
    'tablo geneli update geri alınmıyor — kolon kısıtı etkisiz kalır');
  assert.match(mig, /grant update \(content, updated_at\)/,
    'kolon düzeyinde grant yok — sahibi parent_id/label/project_id değiştirebilir');

  // istemci: yalnız iki kolon gider, panel erişebilir
  assert.ok(ink.includes(".update({ content: text, updated_at: new Date().toISOString() }).eq('id', cid)"),
    'editComment content+updated_at dışında alan gönderiyor ya da yok');
  assert.ok(ink.includes('editComment: editComment'), 'editComment dışa açılmıyor — panel erişemez');
  assert.ok(ink.includes('e: !!c.updated_at'), 'düzenlenmişlik bayrağı satırdan eşlenmiyor');
  assert.ok(ink.includes("(c.e ? ' · düzenlendi' : '')"), 'ekranda " · düzenlendi" ibaresi yok');
  assert.ok(ink.includes('data-cedit="'), 'kendi incelemesinde düzenle düğmesi yok');
  assert.ok(ink.includes("eli.querySelector(':scope > p')"),
    'düzenleyici :scope > p kullanmıyor — üst yorumda yanıtın metni yakalanır');
  assert.ok(ink.includes('SBX.editComment(byId(eid2)'), 'panel editComment çağırmıyor');

  // CSS: düğme ve satır içi düzenleyici stilleri
  const css = read('css/acadex-ink.css');
  assert.ok(css.includes('.ef-c .edt{'), 'düzenle düğmesi stili yok');
  assert.ok(css.includes('.ef-c .edt~.del{margin-left:0}'),
    'sil düğmesinin auto marjı sıfırlanmıyor — düğmeler ayrışır');
  assert.ok(css.includes('.ef-ce input'), 'satır içi düzenleyici stili yok');
});

test('"d" İLE BAŞLAYAN UUID TASLAK SAYILMAZ: düzenleme kopya üretmez', () => {
  /* Canlı ölçüm (10.11.2026): Berkay'ın d1bb5e77-... kimlikli gönderisinde
     "düzenle" yeni bir gönderi yayınladı, eskisi panelde kaldı. Sebep:
     taslak ayrımı yalnız /^d/ idi; taslak kimliği 'd'+Date.now().toString(36)
     ama gerçek UUID de 16'da 1 olasılıkla 'd' ile başlar. Kimlik silinince
     savePost isNew sayıp INSERT ediyordu. */
  assert.ok(ink.includes("wasDraft = /^d/.test(p.id) && !/^[0-9a-f-]{36}$/i.test(p.id) ? p.id : ''"),
    'taslak ayrımı UUID dışlaması taşımıyor — d ile başlayan gönderiyi düzenlemek kopya üretir');
  // Ayrımın iki yanı da gerçek biçimlerle çalışmalı:
  const taslakMi = (id) => /^d/.test(id) && !/^[0-9a-f-]{36}$/i.test(id);
  assert.ok(taslakMi('d' + Date.now().toString(36)), 'gerçek taslak kimliği taslak sayılmıyor');
  assert.ok(!taslakMi('d1bb5e77-d7df-4334-a9ae-4f4e0316ce78'), 'd ile başlayan UUID hâlâ taslak sanılıyor');
  assert.ok(!taslakMi('a1bb5e77-d7df-4334-a9ae-4f4e0316ce78'), 'sıradan UUID taslak sanılıyor');
  // savePost tarafındaki isNew ayrımı aynı UUID kalıbını kullanmaya devam etmeli
  assert.ok(ink.includes("var isNew = !p.id || !/^[0-9a-f-]{36}$/i.test(p.id);"),
    'savePost isNew ayrımı değişmiş — iki ayrım birbirinden koparsa bu sınıf hata geri gelir');
});

test('TESLİM ROZETİ PANELE TAŞINIR: yalnız olumlu, yalnız ok+at (11.11.2026)', () => {
  /* Köprü adımı: sandbox_workspaces RLS'i herkese kendi satırı olduğundan
     rozet yayın anında gönderi satırına kopyalanır (sandbox_projects.denetim). */
  const mig = read('supabase/migrations/20261111_panel_denetim_rozeti.sql');
  assert.match(mig, /add column if not exists denetim jsonb/, 'denetim kolonu yok');
  assert.match(mig, /check \(denetim is null or \(denetim->>'ok'\) = 'true'\)/,
    'olumlu-tek kısıtı yok — panelde "eksikli" damgası mümkün olur');

  // İstemci: yalnız { ok, at } gider, tam rapor (hata metinleri) kamuya çıkmaz.
  assert.ok(ink.includes("wsDen = { ok: true, at: w.denetim.at || Date.now() }"),
    'rozet ok+at dışında alan taşıyor ya da yok');
  assert.ok(!/extra\.denetim = w\.denetim/.test(ink), 'TAM rapor gönderi satırına kopyalanıyor — hata metni kamuya çıkar');
  // Geçemeyen denetim yazılmaz; eski rozet yeniden yayında temizlenir.
  assert.ok(ink.includes('else if (!wsDen) extra.denetim = null;'),
    'bayat rozet yeniden yayında temizlenmiyor');
  // Kademeli yedek: kolon yokken YALNIZ denetim düşer (px yedeği kind/tech'i de götürürdü).
  assert.ok(ink.includes("'denetim' in extra) { feat.dn = false; delete extra.denetim;"),
    'kolon-yok yedeği denetime özgü değil — ilk hatada kind/tech de kaybolur');
  // Okuma + çizim: yalnız ok olan rozet çipe dönüşür.
  assert.ok(ink.includes("denetim: r.denetim && r.denetim.ok ? r.denetim : null"),
    'toPost olumsuz/bozuk rozeti süzmüyor');
  assert.ok(ink.includes('p.denetim && p.denetim.ok ? \'<span class="dnt"'),
    'rozet çipi koşulsuz ya da yok');
  const css = read('css/acadex-ink.css');
  assert.ok(css.includes('.ek-tags .dnt{'), 'rozet çipinin stili yok');
});

test('MOBİL: panel telefon genişliğinde taşmaz (11.11.2026)', () => {
  /* Kod üzerinden mobil denetim. Temel zaten vardı (760px blokları, tepki
     etiketleri gizli, kompozer 900'de tek sütun) — bunlar kilitlenir,
     taramada bulunan iki boşluk kapatılır. */
  const css = read('css/acadex-ink.css');
  assert.ok(css.includes('.ek-r span{position:absolute;width:1px'), 'telefonda tepki etiketleri gizlenmiyor — beş düğme sığmaz');
  assert.ok(css.includes('.ek-devs{display:none}'), 'telefonda masaüstü/telefon önizleme düğmeleri gizlenmiyor');
  assert.ok(css.includes('.ef-ce{flex-wrap:wrap}'), 'inceleme düzenleyicisi dar ekranda sarmıyor');
  assert.ok(css.includes('.ef-ce input{flex:1 1 100%}'), 'düzenleyici girişi tam satıra yayılmıyor');
  assert.ok(css.includes('.ef-full-bar [data-full-t]{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis'),
    'tam ekran çubuğunda uzun başlık taşar');
});

test('VİTRİN + TAKİP BİLDİRİMİ + ACADIA ÖN BAKIŞI (12.11.2026)', () => {
  /* Öneri paketi: (1) haftanın projesi — yetki veritabanında, panel rozet +
     en üste alma; (2) takip edilen kişinin yeni projesi bildirim çanına
     düşer; (3) paylaşmadan önce Acadia ön bakışı (başarısızlık paylaşımı
     engellemez). */
  const ink = read('js/acadex-ink.js');
  assert.ok(ink.includes('vitrin: !!r.vitrin'), 'vitrin alanı gönderiye taşınmıyor');
  assert.ok(ink.includes('★ haftanın projesi'), 'vitrin rozeti çizilmiyor');
  assert.match(ink, /list\.filter\(function \(p\) \{ return p\.vitrin; \}\)\.concat/,
    'vitrindeki proje en üste alınmıyor');
  assert.match(ink, /admin_sandbox_vitrin', \{ p_id: vid, p_on: !vp\.vitrin \}/,
    'yıldız düğmesi sunucu RPC’sine gitmiyor');
  const mig = read('supabase/migrations/20261112_vitrin_takip_donusum.sql');
  assert.match(mig, /update sandbox_projects set vitrin = false where vitrin and id <> p_id/,
    'vitrin tekliği sunucuda değil — iki “haftanın projesi” olabilir');
  assert.match(mig, /admin_sandbox_vitrin[\s\S]*?current_is_admin/, 'vitrin RPC’sinde yönetici kapısı yok');
  const dash = read('js/dashboard.js');
  assert.ok(dash.includes("from('sandbox_follows')"), 'bildirim çanı takip listesini okumuyor');
  assert.ok(dash.includes("switchDashboardView('sandbox-interaction')"),
    'takip bildirimi paneli açmıyor');
  assert.ok(ink.includes("mode: 'sbx_review'"), 'compose Acadia ön bakışına gitmiyor');
  assert.ok(ink.includes('paylaşmana engel değil'), 'Acadia hatası paylaşımı engelliyor gibi durur');
  const fn = read('supabase/functions/acadia-assistant/index.ts');
  assert.ok(fn.includes("body?.mode === 'sbx_review'"), 'sunucuda sbx_review modu yok');
  assert.ok(fn.includes('is_anonymous'), 'acadia-assistant misafiri reddetmiyor — model masrafı açık');
});

summary();
