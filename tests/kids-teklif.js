/* ==========================================================================
   ACADEX — ACADEX KIDS: "KREŞİM İÇİN TEKLİF AL" (tests/kids-teklif.js), 15.11.2026

   NEDEN VAR: Kids tanıtım sayfasının üst barında müşteri çeken parlayan bir düğme var;
   kreş adı + yetkili + e-posta (zorunlu), telefon ve diğerleri (isteğe bağlı) bırakılır,
   istek yönetim paneli › Acadex Kids › İstekler'e düşer. Bu dosya şunları korur:
     - düğme üst barda, giriş düğmesinden daha belirgin; dar ekranda "Teklif al"; hareket azaltılınca durur
     - pencere: zorunlu alanlar, KVKK onayı, tarayıcı denetimi sunucuyla aynı kurallar
     - #teklif (ve eski #basvuru/#demo) pencereyi açar; çocuk verisi yok
     - panel: Okullar | İstekler sekmesi, menüde bekleyen sayısı, durum + iç not, okul aç
     - SQL: e-posta zorunlu, telefon isteğe bağlı, 'arandi' durumu, iç not (davranışı tests/sql/kids-istek.sql)
   Çalıştırma:  node tests/kids-teklif.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();
const MIG = 'supabase/migrations/20261115_kids_istek.sql';

test('üst bar: parlayan "Kreşim için teklif al", giriş düğmesi sade; dar ekranda kısa ad', () => {
  const s = read('kids/assets/sayfa.html'), ust = s.slice(s.indexOf('<header class="kl-ust">'), s.indexOf('</header>'));
  assert.match(ust, /<a class="kl-teklif" href="#teklif" data-teklif>/);
  assert.match(ust, /<span class="kl-teklif-u">Kreşim için teklif al<\/span><span class="kl-teklif-k" aria-hidden="true">Teklif al<\/span>/);
  assert.ok(ust.indexOf('kl-teklif') > ust.indexOf('Giriş yap'), 'teklif en sağda');
  assert.match(ust, /kl-dugme-b kl-giris-ust/, 'giriş beyaz kalır, göz teklife gider');
  assert.match(s, /kt2-cta"><a class="kl-teklif kt2-dugme" href="#teklif" data-teklif>/, '"Kreşinize özel teklif" sahnesinde de (15.11.2026: fiyat kartı kalktı)');
  const css = read('kids/assets/kids-landing.css');
  assert.match(css, /\.kl-teklif\{[^}]*background:linear-gradient\(180deg,#FF8A5B,var\(--mercan\)\)/);
  assert.match(css, /\.kl-teklif::after\{[^}]*animation:klTeklifIsik/, 'ışık süzülür');
  assert.match(css, /@media \(max-width:560px\)\{\s*\.kl-teklif\{[\s\S]*?\.kl-teklif-u\{display:none\}\.kl-teklif-k\{display:inline\}/);
  assert.match(css, /prefers-reduced-motion: reduce\)\{\.kl-teklif,\.kl-teklif::after,\.kl-teklif-y\{animation:none\}/);
});

test('pencere: alanlar, KVKK, denetim; yalnız kreş yetkilisinin bilgisi', () => {
  const j = read('kids/assets/kids-teklif.js');
  for (const a of ["alan('kres_ad'", "alan('yetkili_ad'", "alan('eposta'"]) assert.match(j, new RegExp(a.replace(/[()]/g, '\\$&') + "[^\\n]*\\}, true\\)"), a + ' zorunlu');
  for (const a of ['tel', 'ogrenci_sayi', 'il', 'ilce', 'mesaj']) assert.match(j, new RegExp("alan\\('" + a + "'[^\\n]*\\}, false\\)"), a + ' isteğe bağlı');
  assert.match(j, /href="\/kvkk\.html"/); assert.match(j, /role="dialog" aria-modal="true" aria-labelledby="ktf-baslik"/);
  assert.match(j, /e\.key === 'Escape'/); assert.match(j, /HASH = \/\^#\\\/\?\(teklif\|basvuru\|demo\)\$\//);
  assert.doesNotMatch(j, /ogrenci_id|cocuk|hayvan/i, 'çocuk verisi yok');
  const c = { window: null, document: { readyState: 'complete', addEventListener() {}, removeEventListener() {} }, location: { hash: '' }, addEventListener() {} };
  c.window = c; vm.createContext(c); vm.runInContext(j, c);
  const d = c.KIDS_TEKLIF.denetle, iyi = { kres_ad: 'Lale Kreşi', yetkili_ad: 'Ayşe K.', eposta: 'a@b.co', tel: '', ogrenci_sayi: '', kvkk: true };
  assert.deepEqual(Object.keys(d(iyi)), []);
  assert.deepEqual(Object.keys(d({ ...iyi, eposta: 'ayse@ornek' })), ['eposta']);
  assert.deepEqual(Object.keys(d({ ...iyi, tel: '12' })), ['tel']);
  assert.deepEqual(Object.keys(d({ ...iyi, tel: '0532 111 22 33' })), []);
  assert.deepEqual(Object.keys(d({ ...iyi, ogrenci_sayi: 'otuz' })), ['ogrenci_sayi']);
  assert.deepEqual(Object.keys(d({ ...iyi, kvkk: false })), ['genel']);
  assert.deepEqual(Object.keys(d({ kres_ad: '', yetkili_ad: '', eposta: '', tel: '', ogrenci_sayi: '', kvkk: true })), ['kres_ad', 'yetkili_ad', 'eposta']);
  assert.match(read('kids/assets/kids-bulut.js'), /teklif: function \(p\) \{ return rpc\('kids_basvuru_yap', \{ p: p \}\); \}/);
});

test('paket ve yönlendirme: kids-teklif.js paketlenir; #teklif tanıtımda kalır', () => {
  const b = read('kids/assets/birlestir.js'), html = read('kids/index.html'), yon = read('kids/assets/kids-yon.js');
  assert.ok(b.indexOf("'kids-teklif.js'") > b.indexOf("'kids-landing.js'") && b.indexOf("'kids-teklif.js'") < b.indexOf("'kids-yon.js'"));
  assert.ok(html.includes(read('kids/assets/kids-teklif.js').trim().slice(0, 3000)), 'index.html eski: node kids/assets/birlestir.js');
  assert.ok(html.includes('Kreşim için teklif al'));
  assert.match(yon, /h === 'giris' \? 'giris' : 'tanitim'/, '#teklif/#basvuru/#demo tanıtım sayfasında açılır');
  assert.match(yon, /<a href="#teklif" data-teklif>Kreşim için teklif al<\/a>/, 'giriş ekranında kayıtsız kreş için');
});

test('panel: Okullar | İstekler, menü rozeti, durum + not, okul aç', () => {
  const k = read('js/admin-kids.js'), app = read('js/admin-app.js');
  assert.match(app, /badge: 'kids_istek'/); assert.match(app, /o\.kids_istek = \(ki \|\| \[\]\)\.filter\(function \(x\) \{ return x\.durum === 'bekliyor'; \}\)\.length/);
  assert.match(app, /sayac: function \(k, n\) \{ COUNTS\[k\] = n; paintNav\(\); \}/);
  assert.match(k, /data-kdsek="istekler"/); assert.match(k, /if \(A\.sayac\) A\.sayac\('kids_istek', bekleyen\)/);
  assert.match(k, /rpc\('kids_basvuru_durum', \{ p_id: id, p_durum: yeni, p_not: null \}\)/);
  assert.match(k, /rpc\('kids_basvuru_durum', \{ p_id: bv\.id, p_durum: null, p_not: e\.target\.not\.value \}\)/);
  assert.match(k, /href="mailto:' \+ X\(b\.eposta\)/); assert.match(k, /href="tel:'/);
  /* görünüm */
  const c = { console, AXADM: { VIEWS: {}, X: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])), NF: (n) => String(n), DT: (d) => d, $: () => null, $$: () => [] }, KIDS_CIZ: null };
  c.window = c; vm.createContext(c); vm.runInContext(read('js/admin-kids.js'), c);
  const H = c.AXKIDS_TEST.basvuruHTML;
  const L = [{ id: 'a', kres_ad: 'Lale', il: 'Ankara', ilce: 'Çankaya', yetkili_ad: 'Ayşe', tel: '0532 111 22 33', eposta: 'a@b.co', ogrenci_sayi: 30, mesaj: 'Eylül', ic_not: 'Salı arandı', durum: 'arandi', created_at: '2026-11-15T09:00:00Z' },
    { id: 'b', kres_ad: 'Gül', il: '', ilce: '', yetkili_ad: 'Can', tel: '', eposta: 'c@d.co', ogrenci_sayi: 0, mesaj: '', ic_not: '', durum: 'bekliyor', created_at: '2026-11-15T10:00:00Z' },
    { id: 'c', kres_ad: 'Nar', il: '', ilce: '', yetkili_ad: 'E', tel: '', eposta: 'e@f.co', ogrenci_sayi: 0, mesaj: '', ic_not: '', durum: 'reddedildi', created_at: '2026-11-14T10:00:00Z' }];
  const h = H(L, 'acik');
  assert.equal((h.match(/data-bonay=/g) || []).length, 2, 'yeni ve arandı isteklerde okul aç');
  assert.equal((h.match(/data-bdurum=/g) || []).length, 2); assert.doesNotMatch(h, /Nar/, 'reddedilen açık filtrede yok');
  assert.match(h, /✎ Salı arandı/); assert.match(h, /href="tel:05321112233"/); assert.match(h, /class="kd-yeni"/);
  assert.match(h, /data-kdfil="acik" aria-pressed="true">Açık <span>2<\/span>/);
  assert.match(H(L, 'reddedildi'), /Nar/);
});

test('SQL: e-posta zorunlu, telefon isteğe bağlı, arandı durumu, iç not, yetkiler', () => {
  const m = read(MIG);
  assert.match(m, /check \(tel = '' or tel ~ /);
  assert.match(m, /check \(durum in \('bekliyor', 'arandi', 'onaylandi', 'reddedildi'\)\)/);
  assert.match(m, /add column if not exists ic_not text not null default ''/);
  assert.match(m, /check \(eposta <> ''\) not valid/, 'eski kayıtlar bozulmaz');
  assert.match(m, /function public\.kids_basvuru_durum\(p_id uuid, p_durum text, p_not text\)[\s\S]*?perform public\.admin_guard\(\);/);
  assert.match(m, /grant execute on function public\.kids_basvuru_yap\(jsonb\) to anon, authenticated/);
  assert.match(m, /'kids_basvuru_durum\(uuid, text, text\)'[\s\S]*?from public, anon[\s\S]*?to authenticated/);
  assert.match(read('tests/kids-kres.js'), /kids-istek\.sql/, 'davranış testi çalışıyor');
});

summary();
