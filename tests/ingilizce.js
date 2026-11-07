/* ==========================================================================
   ACADEX — ACADEX ENGLISH (tests/ingilizce.js)

   NEDEN VAR (05.11.2026): İngilizce bölümü panelde değil; landing'den açılan
   ayrı bir yer (ingilizce/). Kendi giriş ya da kayıt ekranı yok; yalnız
   oturumu açık ve kapalı betada erişimi olan Acadex hesapları görür.
     - Her sayfa <html class="kapi"> ile görünmez başlar; assets/kapi.js
       oturumu ve acadexAccess.check'i denetleyip açar.
     - Supabase yüklenemezse sayfa kilitli kalır (açık kapı yok).
     - Sayfalarda kayıt bağlantısı ya da fiyat yok; kilit kartı yalnız
       ../login.html'e götürür.
     - Landing'den üç yerden girilir: üst menü, yapışkan menü, alt menü.
   Tarayıcı ucu (sahte Supabase ile: oturum yok / izinsiz / izinli / CDN yok)
   scratchpad e2e ile denendi.
   Calistirma:  node tests/ingilizce.js
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
const SAYFALAR = ['index', 'vocab', 'listening', 'reading', 'speaking', 'writing'];

for (const s of SAYFALAR) {
  test(`ingilizce/${s}.html: kapı sırası, noindex, kayıt yok`, () => {
    const h = read(`ingilizce/${s}.html`);
    assert.match(h, /^<!doctype html>\n<html lang="tr" class="kapi">/, 'ilk boyamada gizli');
    assert.match(h, /<meta name="robots" content="noindex">/);
    const sira = ['supabase-js@2/dist/umd/supabase.min.js', '../js/supabase-config.js', '../js/acadex-erisim.js', 'assets/kapi.js', 'assets/ing.js'].map((x) => h.indexOf('src="' + (x.startsWith('supabase') ? 'https://cdn.jsdelivr.net/npm/@supabase/' : '') + x + '"'));
    /* son 30 dk'da doğrulanmışsa açık başlar (sayfa çevirme geçişi boş kâğıt göstermesin); kapi.js yine denetler */
    assert.match(h, /<meta name="robots" content="noindex">\n<script>[^<]*sessionStorage\.getItem\('acx\.kapi'\)\|\|0\)<18e5\)document\.documentElement\.classList\.remove\('kapi'\)/);
    assert.ok(sira.every((x, i) => x > 0 && (i === 0 || x > sira[i - 1])), 'betik sırası: ' + sira);
    assert.doesNotMatch(h, /register\.html|Ücretsiz başla|Bir kahve parasına|<h3>Pro<\/h3>/i, 'kayıt ya da satış yok');
    assert.doesNotMatch(h, /src="assets\/acadex-logo|url\(fonts\//, 'logo ve fontlar landing varlıklarından');
    for (const ad of SAYFALAR.slice(1)) assert.match(h, new RegExp(`href="${ad}\\.html"`), `${ad} sekmesi`);
  });
}

test('ing.css: kapı kuralı ve fontlar landing klasöründen', () => {
  const c = read('ingilizce/assets/ing.css');
  assert.match(c, /html\.kapi body>\*:not\(#kilit\)\{visibility:hidden\}/);
  assert.match(c, /url\(\.\.\/\.\.\/assets\/landing\/fonts\/bricolage-latin\.woff2\)/);
  assert.ok(fs.existsSync(path.join(ROOT, 'assets/landing/fonts/bricolage-latin.woff2')));
  assert.ok(fs.existsSync(path.join(ROOT, 'assets/landing/acadex-logo.png')));
});

/* kapi.js sahte DOM'da: dört durum */
function kos(oturum, izin, istemciYok) {
  const sinif = new Set(['kapi']), eklenen = [];
  const el = () => { const e = { id: '', innerHTML: '', children: [], setAttribute() {}, remove() { e.silindi = true; }, querySelector: () => ({ textContent: '', focus() {} }) }; return e; };
  const D = { dispatchEvent() {}, readyState: 'complete', documentElement: { classList: { add: (c) => sinif.add(c), remove: (c) => sinif.delete(c), contains: (c) => sinif.has(c) } }, body: { appendChild: (e) => eklenen.push(e) }, createElement: el, addEventListener() {} };
  const depo = {}; const ctx = { Event: class { constructor(t) { this.type = t; } }, document: D, window: { addEventListener() {} }, console, sessionStorage: { getItem: (k) => depo[k] || null, setItem: (k, v) => { depo[k] = v; }, removeItem: (k) => { delete depo[k]; } } };
  ctx.window.acadexAccess = { check: async () => ({ ok: izin }) };
  if (!istemciYok) ctx.supabaseClient = { auth: { getSession: async () => ({ data: { session: oturum ? { user: { id: 'u' } } : null } }), onAuthStateChange() {} } };
  vm.createContext(ctx);
  vm.runInContext(read('ingilizce/assets/kapi.js'), ctx);
  return new Promise((r) => setTimeout(() => r({ kilitli: sinif.has('kapi'), kart: eklenen.map((e) => e.innerHTML).join('') }), 20));
}
test('kapi.js: oturum yok → kilit ve giriş bağlantısı; izinsiz → kilit; izinli → açık; istemci yok → kilit', async () => {
  let r = await kos(false, true); assert.ok(r.kilitli); assert.match(r.kart, /href="\.\.\/login\.html\?sonra=ingilizce"/); assert.doesNotMatch(r.kart, /register/);
  r = await kos(true, false); assert.ok(r.kilitli); assert.doesNotMatch(r.kart, /login\.html/);
  r = await kos(true, true); assert.ok(!r.kilitli);
  r = await kos(true, true, true); assert.ok(r.kilitli, 'Supabase yoksa açık kapı yok');
});

test('landing: English bağlantısı üst menü, yapışkan menü ve alt menüde', () => {
  const h = read('index.html');
  assert.match(h, /<a href="#medlab" data-sec="medlab">MedLab<\/a>\n<a href="ingilizce\/">English<\/a>/);
  assert.match(h, /<a href="ingilizce\/" style="color: #C5CFE6; text-decoration: none">English<\/a>/);
  assert.match(h, /<a href="ingilizce\/" style="color: #B4C0DA; text-decoration: none">Acadex English<\/a>/);
  assert.doesNotMatch(read('dashboard.html'), /ingilizce\//, 'panelde değil');
});

/* auth.js: ?sonra=ingilizce → girişten sonra panel değil ingilizce/ (Google dönüşü sessionStorage ile) */
function hedef(arama, izin) {
  const a = read('js/auth.js'), i = a.indexOf('const SONRA_HEDEF'), j = a.indexOf('/* GERI TUSU');
  assert.ok(i > 0 && j > i, 'SONRA bloğu getPostLoginDestination ile birlikte');
  const depo = {};
  const ctx = { window: { location: { search: arama }, acadexAccess: { check: async () => ({ ok: izin }) } }, sessionStorage: { getItem: (k) => (k in depo ? depo[k] : null), setItem: (k, v) => { depo[k] = String(v); }, removeItem: (k) => { delete depo[k]; } }, supabaseClient: { auth: { signOut: async () => {} } }, URLSearchParams, console };
  vm.createContext(ctx); vm.runInContext(a.slice(i, j) + '\nthis.git = getPostLoginDestination;', ctx);
  return { git: () => ctx.git('u'), depo, ctx };
}
test('auth.js: sonra=ingilizce girişten sonra ingilizce/e, bir kez; bilinmeyen hedef ve izinsiz hesap yok sayılır', async () => {
  let h = hedef('?sonra=ingilizce', true); assert.equal(await h.git(), 'ingilizce/'); assert.equal(await h.git(), 'dashboard.html', 'bir kez kullanılır');
  h = hedef('', true); assert.equal(await h.git(), 'dashboard.html');
  h = hedef('?sonra=https://kotu.site', true); assert.equal(await h.git(), 'dashboard.html', 'açık yönlendirme yok');
  h = hedef('?sonra=ingilizce', false); assert.equal(await h.git(), 'login.html?erisim=yok');
  /* Google dönüşü: login.html parametresiz açılır, hedef oturum deposundan gelir */
  h = hedef('?sonra=ingilizce', true); const kayit = Object.assign({}, h.depo); const g = hedef('', true); Object.assign(g.depo, kayit); assert.equal(await g.git(), 'ingilizce/');
});

test('kapi.js: doğrulanınca 30 dk izi ve acx:acik olayı; kilitlenince iz silinir', () => {
  const k = read('ingilizce/assets/kapi.js');
  assert.match(k, /function ac\(\) \{[^\n]*iz\(true\);[^\n]*D\.dispatchEvent\(new Event\('acx:acik'\)\)/);
  assert.match(k, /function kilit\(baslik, metin, giris\) \{\n    iz\(false\);/);
});

test('ing.js: görsel ve hareket katmanı (ışık, ses, ödül, parallax, karalama, kapak, şimdi, hafta)', () => {
  const j = read('ingilizce/assets/ing.js'), c = read('ingilizce/assets/ing.css');
  /* ışık: 05–11 sabah, 11–17 öğle, 17–20 akşam, gerisi gece */
  const isikAd = new Function(j.match(/function isikAd\(saat\) \{[^\n]+\}/)[0] + '; return isikAd;')();
  assert.deepEqual([3, 6, 12, 18, 22].map(isikAd), ['gece', 'sabah', 'ogle', 'aksam', 'gece']);
  assert.match(c, /html\[data-isik=gece\] body\{background-color:#17203E/);
  /* ses dosyasız (Web Audio), kapatılabilir; titreşim yalnız dokunmatikte */
  assert.match(j, /var sesAcik = ls\.al\('sesAcik', true\)/); assert.match(j, /pointer:coarse/); assert.doesNotMatch(j, /\.mp3|\.wav|new Audio\(/);
  /* ödül yalnız ilk bitirişte; rozet dört alıştırma bitince */
  assert.match(j, /if \(el && yeni\) odul\(el\);/); assert.match(j, /if \(tum\.length && n === tum\.length\) rozet\(\);/);
  /* hareket azaltılmışsa parallax, kırpıntı ve kapak yok */
  assert.match(j, /function parallax\(\) \{\n    if \(sakin\) return;/); assert.match(j, /if \(!yer \|\| sakin\) return;/);
  assert.match(c, /@media \(prefers-reduced-motion:reduce\)\{::view-transition-old\(root\),::view-transition-new\(root\)\{animation:none\}\}/);
  assert.match(c, /@view-transition\{navigation:auto\}/);
  /* her panelin kendi kostümü */
  for (const p of ['vocab', 'listening', 'reading', 'speaking', 'writing', 'hub']) assert.match(j, new RegExp('\\n    ' + p + ": '<g class=\"kos\">"));
  /* hub: kapak kapıdan sonra, şimdiki durak ve takvim kutuları */
  const h = read('ingilizce/index.html');
  assert.match(h, /<body data-panel="" data-sayfa="hub"/); assert.match(h, /id="simdi"/); assert.match(h, /<section class="serit-sahne" id="hafta" data-yirtik>/);
  assert.match(j, /kapiSonra\(kapak\)/);
});

/* haftalık seri: eski kayıtlar (bitti zaman damgaları) da takvime düşer */
test('ing.js gunluk(): gunluk kaydı ve bitti damgaları birleşir', () => {
  const j = read('ingilizce/assets/ing.js');
  const f = j.match(/function gunAnahtar\(d\) \{[^\n]+\}\n  function gunluk\(\) \{[\s\S]*?\n  \}/)[0];
  const ls = { al: (k, v) => ({ gunluk: { '2026-11-03': { vocab: 1 } }, bitti: { writing: { hata: new Date(2026, 10, 5, 22).getTime() } } }[k] || v) };
  const g = new Function('ls', f + '; return gunluk();')(ls);
  assert.deepEqual(g, { '2026-11-03': { vocab: 1 }, '2026-11-05': { writing: 1 } });
});

/* Defne Hoca (05.11.2026): Acadex'in kendi karakteri; yerel ölçüt + isteğe bağlı yapay zekâ */
function hocaYukle() {
  const ctx = { window: null, document: { body: { dataset: {} } }, console, matchMedia: () => ({ matches: false }), setTimeout, clearTimeout };
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(read('ingilizce/assets/hoca.js'), ctx); return ctx.HOCA;
}
for (const s of ['reading', 'listening', 'vocab', 'speaking', 'writing']) {
  test(`${s}: hoca bölümü alıştırmalardan önce, hoca.js ing.js'ten sonra`, () => {
    const h = read(`ingilizce/${s}.html`);
    const i = h.indexOf('<section class="bolum" id="hoca"'), c = h.indexOf('<section class="bolum" id="calis"');
    assert.ok(i > 0 && i < c);
    assert.ok(h.indexOf('<script src="assets/hoca.js">') > h.indexOf('<script src="assets/ing.js">'));
    assert.match(h, /<div class="kagit hoca-kart" data-gir="yukari"><div id="hoca-oturum"><\/div><\/div>/);
  });
}
test('HOCA.degerlendir: doğru / kısmen / yanlış, ters cevap ve "less, not more"', () => {
  const H = hocaYukle();
  const k1 = { g: [{ ad: 'duygu', t: ['feeling', 'anxiety', 'unpleasant'] }, { ad: 'kaçmak', t: ['avoid', 'escape'] }] };
  assert.equal(H.degerlendir('To avoid unpleasant feelings.', k1).sonuc, 'dogru');
  const r = H.degerlendir('Because they feel anxiety.', k1); assert.equal(r.sonuc, 'kismen'); assert.deepEqual([...r.eksik], ['kaçmak']);
  assert.equal(H.degerlendir('They are lazy.', k1).sonuc, 'yanlis');
  const k5 = { yanlis: ['more'], g: [{ ad: 'az', t: ['less', 'fewer'] }] };
  assert.equal(H.degerlendir('More.', k5).sonuc, 'yanlis'); assert.ok(H.degerlendir('More.', k5).ters);
  assert.equal(H.degerlendir('Less, not more.', k5).sonuc, 'dogru');
  assert.equal(H.degerlendir('One small step', { herhangi: true, g: [{ ad: 'a', t: ['small'] }, { ad: 'b', t: ['kind'] }] }).sonuc, 'dogru');
  /* isteğe bağlı grup (z:false) eksikse yine doğru */
  assert.equal(H.degerlendir('It is emotional.', { g: [{ ad: 'duygu', t: ['emotion'] }, { ad: 'telefon', t: ['phone'], z: false }] }).sonuc, 'dogru');
});
test('HOCA.gramer, dikte, kelime ve cümle denetimi', () => {
  const H = hocaYukle();
  const g = (s) => [...H.gramer(s)].map((x) => x.oneri);
  assert.deepEqual(g('People is busy and I am agree.'), ['people are', 'I agree']);
  assert.deepEqual(g('She likes tea. Does she go there?'), [], 'soru ve doğru çekim yakalanmaz');
  assert.ok(g('She go to school.').includes('fiil + s'));
  const d = H.dikteDegerlendir('the seminar has moved to thursday', 'The seminar has been moved to Thursday afternoon.');
  assert.equal(d.sonuc, 'kismen'); assert.deepEqual([...d.kacan], ['been', 'afternoon']);
  const s = { kelime: 'thrive', ornek: 'Small businesses thrive near universities.' };
  assert.equal(H.kelimeDegerlendir('I thrive.', s).sonuc, 'kismen');
  assert.equal(H.kelimeDegerlendir('Students thrive when they sleep well before exams.', s).sonuc, 'dogru');
  assert.equal(H.kelimeDegerlendir('Small businesses thrive near universities.', s).sonuc, 'kismen', 'örneği kopyalamak');
  assert.equal(H.kelimeDegerlendir('I like my new university a lot.', s).sonuc, 'yanlis');
  assert.equal(H.cumleDenetle('Because students are adults.', null).sonuc, 'kismen', '“Because …” tek başına cümle değil');
  assert.equal(H.cumleDenetle('I believe attendance should not be compulsory.', { r: /should/ }).sonuc, 'dogru');
});
test('ingilizce-hoca fonksiyonu: JWT zorunlu, yalnız beş mod, veri tabanına yazmaz, karar doğrulanır', () => {
  const f = read('supabase/functions/ingilizce-hoca/index.ts');
  assert.match(f, /const \{ data: \{ user \}, error \} = await sb\.auth\.getUser\(\)/);
  for (const m of ['degerlendir', 'kelime', 'sohbet', 'yazi', 'nasil']) assert.match(f, new RegExp('\\n  ' + m + ': \\(b\\) =>'));
  /* değerlendirme modları hiçbir şey yazmaz; yazma yalnız içerik havuzuna (ing_icerik, ing_gorulen) */
  assert.deepEqual([...new Set([...f.matchAll(/\.from\('([a-z_]+)'\)/g)].map((m) => m[1]))].sort(), ['ing_gorulen', 'ing_icerik']);
  assert.doesNotMatch(f, /\.update\(|\.delete\(|\.upsert\(/);
  assert.match(f, /if \(b\.mod !== 'nasil' && !\/\^\(dogru\|kismen\|yanlis\)\$\/\.test\(out\.sonuc\)\)/);
  const j = read('ingilizce/assets/hoca.js'), ij = read('ingilizce/assets/ing.js');
  assert.match(ij, /if \(r\.status === 404\) \{ yzKapali = true; return null; \}/, 'fonksiyon yayında değilse yerel ölçüt');
  assert.match(ij, /setTimeout\(function \(\) \{ ac\.abort\(\); \}, ms \|\| 9000\)/);
  assert.match(j, /function yz\(mod, veri, ms\) \{ return W\.ACX && W\.ACX\.yz \? W\.ACX\.yz\(mod, veri, ms\) : Promise\.resolve\(null\); \}/);
  /* ürün kuralı: gerçek öğretmen sistemi yok */
  for (const src of [f, j]) assert.doesNotMatch(src, /öğretmene ilet|is_teacher|assignment|my_classes/i);
});

/* sınırsız içerik (05.11.2026): yapay zekâ üretir, ortak havuzda birikir, herkes görmediğini alır */
test('havuz SQL: RLS, okuma herkese, yazma yok; ing_icerik_al çağıranın görmediğini verir ve işaretler', () => {
  const q = read('supabase/migrations/20261105_ingilizce_icerik_havuzu.sql');
  assert.match(q, /alter table public\.ing_icerik enable row level security;/); assert.match(q, /alter table public\.ing_gorulen enable row level security;/);
  assert.match(q, /create policy ing_icerik_oku on public\.ing_icerik for select to authenticated using \(true\);/);
  assert.doesNotMatch(q, /on public\.ing_icerik for (insert|update|delete|all)/, 'istemci havuza yazamaz');
  assert.match(q, /not exists \(select 1 from ing_gorulen g where g\.user_id = v_uid and g\.icerik_id = i\.id\)/);
  assert.match(q, /insert into ing_gorulen \(user_id, icerik_id\) values \(v_uid, v_id\) on conflict do nothing;/);
  assert.match(q, /grant execute on function public\.ing_icerik_al\(text, text, text\) to authenticated;/);
  assert.match(q, /create unique index if not exists ing_icerik_sozluk_tek on public\.ing_icerik \(alt\) where tur = 'sozluk';/);
});
test('fonksiyon: içerik önce havuzdan; yoksa üret, doğrula, service role ile yaz; günlük sınır', () => {
  const f = read('supabase/functions/ingilizce-hoca/index.ts');
  assert.match(f, /const \{ data: hazir, error: e1 \} = await sb\.rpc\('ing_icerik_al'/);
  assert.match(f, /if \(await gunlukDoldu\(admin, uid\)\) return json\(\{ error: 'limit' \}, 429\)/);
  assert.match(f, /if \(!v \|\| !DOGRULA\[tur\]\(v, alt\)\) return json\(\{ error: 'Unparseable' \}, 502\)/);
  assert.match(f, /const GUNLUK_URETIM = 30/);
  for (const t of ['okuma', 'dikte', 'kelime', 'deste', 'sohbet', 'yazi_konu', 'test']) { assert.match(f, new RegExp('\\n  ' + t + ': \\(')); }
  /* sayfadaki her alıştırma kimliğinin üretim tarifi var (okuma hızı soruları sabit metne bağlı: yeniYok) */
  assert.doesNotMatch(read('ingilizce/reading.html'), /id: 'hiz', yeniYok/, 'okuma hızı artık okuma masasında (assets/oku.js), makaleye bağlı');
  for (const s of ['vocab', 'listening', 'reading', 'speaking', 'writing']) {
    const h = read(`ingilizce/${s}.html`);
    for (const m of h.matchAll(/\{ panel: P, id: '([a-z]+)'/g)) if (m[1] !== 'deste' && m[1] !== 'hiz') assert.match(f, new RegExp(`'${s}:${m[1]}': '`), `${s}:${m[1]} tarifi`);
  }
});
test('ACX.test: şıklar karışır (True/False/Not Given hariç), "Yeni sorular" havuzdan gelir; yapay zekâ metninde yalnız b/i/u', () => {
  const j = read('ingilizce/assets/ing.js');
  const ctx = { console }; vm.createContext(ctx);
  vm.runInContext(j.match(/var esc = function[^\n]+/)[0] + '\n' + j.match(/  function karistir\(s\) \{[\s\S]*?\n  \}/)[0] + '\n' + j.match(/  function temizHtml\(t\) \{[^\n]+/)[0] + '\nthis.k = karistir; this.t = temizHtml;', ctx);
  for (let n = 0; n < 20; n++) { const r = ctx.k({ sec: ['a', 'b', 'c', 'd'], d: 2 }); assert.equal(r.sec[r.d], 'c'); }
  assert.deepEqual([...ctx.k({ sec: ['True', 'False', 'Not Given'], d: 1 }).sec], ['True', 'False', 'Not Given']);
  assert.equal(ctx.t('<b>ok</b><img src=x onerror=alert(1)><u>u</u>'), '<b>ok</b>&lt;img src=x onerror=alert(1)&gt;<u>u</u>');
  assert.match(j, /var v = await icerik\('test', o\.panel \+ ':' \+ o\.id\);/);
  assert.match(j, /async function icerik\(tur, alt\) \{ var j = await yz\('icerik', \{ tur: tur, alt: alt \|\| '' \}, 30000\);/);
});
test('hoca oturumları: ilk tur sayfadaki set, sonrakiler havuzdan (Reading, Listening, Vocab, Speaking); Writing yeni konu', () => {
  const j = read('ingilizce/assets/hoca.js');
  assert.match(j, /if \(!o\.yeniGetir \|\| !gordu\(\)\) return false;/);
  for (const [s, t] of [['reading', 'okuma'], ['listening', 'dikte'], ['vocab', 'kelime'], ['speaking', 'sohbet']]) assert.match(read(`ingilizce/${s}.html`), new RegExp(`await ACX\\.icerik\\('${t}'\\)`));
  assert.match(j, /var v = await W\.ACX\.icerik\('yazi_konu'\);/);
  assert.match(read('ingilizce/assets/kelime.js'), /var v = await A\.icerik\('deste', st\.sev \|\| 'B1'\)/);
});
test('gezgin Acadia: menü (ipucu, sayfa, defter, kelime), başlığa konma, seçili kelime kartı ve desteye ekleme', () => {
  const j = read('ingilizce/assets/ing.js');
  for (const k of ['ipucu', 'sayfa', 'defter', 'kelime']) assert.match(j, new RegExp('data-ym="' + k + '"'));
  assert.match(j, /D\.querySelectorAll\('\.kah h1, \.bolum-b h2, \.alis-u h3, \.hoca-ust, \.sonraki b'\)/);
  assert.match(j, /if \(!n \|\| n\.closest\('textarea,input,\.acadia,\.kelime-kart,\.ust'\)\) return null;/, 'yazı alanında seçim kart açmaz');
  assert.match(j, /var j = await yz\('sozluk', \{ kelime: k \}, 12000\);/);
  assert.match(j, /ls\.yaz\('desteEk', e2\)/); assert.match(read('ingilizce/assets/kelime.js'), /W\.ACX_DESTE_YENILE = function/);
  /* "bir şıkkı ele" ipucu doğru şıkkı asla elemez */
  assert.match(j, /return !b\.disabled && \+b\.dataset\.k !== \+t\.dataset\.dogru;/);
});
test('hoca 2.5B: gradyanlı hacim, göz ve baş takibi, hareket azaltılınca takip yok', () => {
  const j = read('ingilizce/assets/hoca.js');
  for (const id of ['dh-ten', 'dh-sac', 'dh-ceket', 'dh-iris', 'dh-golge']) assert.match(j, new RegExp('id="' + id + '"'));
  assert.match(j, /<g class="bas"><g class="bas-takip">/); assert.match(j, /class="bebek"/);
  assert.match(j, /if \(!sakin\) \{\n      if \(W\.matchMedia\('\(pointer:fine\)'\)\.matches\)/);
});

/* Speaking sınav simülatörü (07.11.2026): kolay = hazırlık atlama mülakatı, orta = IELTS tarzı,
   zor = TOEFL iBT 2026 tarzı; pratik + sınav modu; puan yerel ölçüm + isteğe bağlı yapay zekâ,
   her zaman "tahmini". Resmî sınav adı yalnız "tarzı" ile geçer. */
function sinavYukle(icerik) {
  const depo = {};
  const ctx = { window: null, document: { body: { dataset: {} } }, console, matchMedia: () => ({ matches: false }), setTimeout, clearTimeout, Promise };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(read('ingilizce/assets/hoca.js'), ctx);
  ctx.ACX = { esc: (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'), ls: { al: (k, v) => (k in depo ? depo[k] : v), yaz: (k, v) => { depo[k] = v; } }, icerik: icerik || null, yz: async () => null, gunlukEkle() {} };
  vm.runInContext(read('ingilizce/assets/sinav-banka.js'), ctx);
  vm.runInContext(read('ingilizce/assets/sinav.js'), ctx);
  return { S: ctx.SINAV, B: ctx.SINAV_BANKA, depo };
}
test('speaking: sınav odası #hoca içinde, betik sırası, serbest sohbet korunur', () => {
  const h = read('ingilizce/speaking.html');
  const i = h.indexOf('<section class="bolum" id="hoca"'), c = h.indexOf('<section class="bolum" id="calis"');
  assert.ok(h.indexOf('id="sinav-oda"') > i && h.indexOf('id="sinav-oda"') < c);
  const sira = ['assets/ing.js', 'assets/hoca.js', 'assets/sinav-banka.js', 'assets/sinav.js'].map((x) => h.indexOf('<script src="' + x + '">'));
  assert.ok(sira.every((x, k) => x > 0 && (k === 0 || x > sira[k - 1])), 'sıra: ' + sira);
  assert.match(h, /SINAV\.kur\(document\.getElementById\('sinav-oda'\)\)/);
  assert.match(h, /<details class="serbest"/);
});
test('soru bankası: seviye başına yeterli ve biçimi doğru; dinle-tekrarla cümleleri uzar', () => {
  const { B } = sinavYukle();
  assert.ok(B.kolay.isinma.length >= 12 && B.kolay.gorus.length >= 8 && B.kolay.resim.length >= 4);
  assert.ok(B.orta.part1.length >= 8 && B.orta.part2.length >= 10);
  for (const k of B.orta.part2) { assert.equal(k.maddeler.length, 4); assert.match(k.maddeler[3], /^and explain/); assert.equal(k.part3.length, 4); }
  for (const t of B.zor.tekrar) { assert.equal(t.cumleler.length, 7); const n = t.cumleler.map((c) => c.split(' ').length); assert.ok(n.every((x, i) => !i || x >= n[i - 1]), t.baglam + ': ' + n); assert.ok(n[6] >= 12); }
  for (const m of B.zor.mulakat) assert.equal(m.sorular.length, 4);
});
test('plan: kolay ısınma → resim → görüş + takip; orta Part 1 → 2 (1 dk + 2 dk) → 3; zor 7 tekrar + 4 × 45 sn', async () => {
  const { S } = sinavYukle();
  const k = await S.planKur('kolay', 'sinav');
  assert.deepEqual([...new Set(k.map((a) => a.b))], ['isinma', 'resim', 'gorus']);
  assert.ok(k.find((a) => a.tip === 'resim').sure === 60 && k.filter((a) => a.b === 'gorus').length === 2);
  const o = await S.planKur('orta', 'sinav');
  const kart = o.find((a) => a.tip === 'kart');
  assert.deepEqual([kart.hazirlik, kart.sure], [60, 120]);
  assert.deepEqual([...new Set(o.map((a) => a.b))], ['part1', 'part2', 'part3']);
  const z = await S.planKur('zor', 'sinav');
  assert.equal(z.filter((a) => a.tip === 'tekrar').length, 7);
  assert.deepEqual(JSON.parse(JSON.stringify(z.filter((a) => a.b === 'mulakat').map((a) => [a.sure, a.hazirlik || 0]))), [[45, 0], [45, 0], [45, 0], [45, 0]]);
  const p = await S.planKur('orta', 'pratik', 'part3');
  assert.ok(p.length === 4 && p.every((a) => a.b === 'part3'), 'pratik tek bölüm');
});
test('plan: havuz seti geçerliyse kullanılır, bozuksa bankaya düşer; yalnız altı bölüm havuzdan istenir', async () => {
  const istenen = [];
  const { S } = sinavYukle(async (tur, alt) => { istenen.push(tur + '/' + alt); return alt === 'zor:mulakat' ? { konu: 'campus food', sorular: ['q1?', 'q2?', 'q3?', 'q4?'] } : alt === 'zor:tekrar' ? { baglam: 'x', cumleler: ['a'] } : null; });
  const z = await S.planKur('zor', 'sinav');
  assert.deepEqual([...z.filter((a) => a.b === 'mulakat').map((a) => a.soru)], ['q1?', 'q2?', 'q3?', 'q4?']);
  assert.equal(z.filter((a) => a.tip === 'tekrar').length, 7, 'bozuk havuz → banka');
  await S.planKur('orta', 'sinav'); await S.planKur('kolay', 'sinav');
  assert.deepEqual(istenen.sort(), ['sinav/kolay:gorus', 'sinav/kolay:isinma', 'sinav/orta:part1', 'sinav/orta:part2', 'sinav/zor:mulakat', 'sinav/zor:tekrar']);
});
test('ölçüm ve yerel puan: dolu, bağlaçlı cevap boş cevaptan yüksek; ölçekler 20 / band 9 / 6', () => {
  const { S } = sinavYukle();
  const a = { b: 'part3', tip: 'soru', soru: 'Should cities spend more money on public spaces?', sure: 45 };
  const iyi = 'Well, I think cities should spend more money on public spaces because parks and squares make people healthier. For example, in my hometown the new park is always full, although it was quite expensive. However, the money should also go to transport.';
  const c1 = { adim: a, metin: iyi, sn: 42, guven: .9 }; c1.olcum = S.olc(c1, a);
  const c2 = { adim: a, metin: 'um yes', sn: 6, guven: .5 }; c2.olcum = S.olc(c2, a);
  assert.ok(c1.olcum.wpm > 50 && c1.olcum.bag >= 4 && c1.olcum.yan >= 2);
  assert.equal(c2.olcum.dolgu, 1);
  const y1 = S.kriterYerel('orta', [c1]), y2 = S.kriterYerel('orta', [c2]);
  for (const k of ['akici', 'kelime', 'dogru', 'telaffuz']) assert.ok(y1[k] > y2[k], k);
  const O = S.OLCEK;
  assert.equal(O.kolay.genel({ a: 4, b: 4, c: 4, d: 4, e: 4 }), 20);
  assert.equal(O.orta.cevir(1), 9); assert.equal(O.orta.cevir(0), 2.5); assert.equal(O.orta.genel({ a: 6, b: 6.5, c: 7, d: 6 }), 6.5);
  assert.equal(O.zor.cevir(1), 6); assert.equal(O.zor.cevir(0), 1);
  const t = { b: 'tekrar', tip: 'tekrar', hedef: 'The library is on your left.', soru: '', sure: 9 };
  const c3 = { adim: t, metin: 'the library is on the left', sn: 4 }; c3.olcum = S.olc(c3, t);
  assert.ok(c3.olcum.isabet > .6 && c3.olcum.isabet < 1); assert.deepEqual([...c3.olcum.kacan], ['your']);
});
test('sinav.js: seviye kuralları, rapor "tahmini" ve resmî değil, kayıt cihazda; geçmiş grafiği', () => {
  const j = read('ingilizce/assets/sinav.js');
  assert.match(j, /kural: \{ ipucu: \{ pratik: true, sinav: true \}, tekrar: \{ pratik: 9, sinav: 9 \}/, 'kolay: her şey serbest');
  assert.match(j, /kural: \{ ipucu: \{ pratik: true, sinav: false \}, tekrar: \{ pratik: 9, sinav: 1 \}/, 'orta: sınavda bir tekrar');
  assert.match(j, /kural: \{ ipucu: \{ pratik: false, sinav: false \}, tekrar: \{ pratik: 9, sinav: 0 \}/, 'zor: ipucu yok');
  assert.match(j, /Bu bir resmî sınav sonucu değildir/);
  assert.match(j, /Ses kayıtları yalnız bu sekmede durur/);
  assert.match(j, /A\.ls\.yaz\('spGecmis', g\.slice\(-60\)\)/);
  assert.match(j, /A\.yz\('sinav', \{ seviye: lv/);
  assert.doesNotMatch(j, /\(\?<[=!]/, 'lookbehind yok (eski Safari)');
  assert.match(read('ingilizce/assets/hoca.js'), /<g class="gz">/);
  assert.match(read('ingilizce/assets/ing.css'), /svg\.hoca\.gozetmen \.gz\{display:inline\}svg\.hoca\.gozetmen \.kupa\{display:none\}/);
});
test('fonksiyon: sinav modu ölçek dışı puanı reddeder; havuzda sinav türü altı bölümle; migration tur kısıtını genişletir', () => {
  const f = read('supabase/functions/ingilizce-hoca/index.ts');
  assert.match(f, /if \(b && b\.mod === 'sinav'\) return await sinavPuan\(b\)/);
  assert.match(f, /if \(!isFinite\(x\) \|\| x < 0 \|\| x > O\.max\) return json\(\{ error: 'Bad score' \}, 502\)/);
  for (const a of ['kolay:isinma', 'kolay:gorus', 'orta:part1', 'orta:part2', 'zor:tekrar', 'zor:mulakat']) assert.ok(f.includes(`'${a}': '`), a);
  assert.match(f, /alt = tur === 'test' \|\| tur === 'sinav' \|\| tur === 'konusma' \|\| tur === 'dinle' \|\| tur === 'oku' \? String\(b\.alt \?\? ''\) : ''/);
  assert.match(f, /\(tur === 'sinav' && !SINAV_ALT\[alt\]\)/);
  const m = read('supabase/migrations/20261107_ingilizce_sinav.sql');
  assert.match(m, /check \(tur in \('okuma', 'dikte', 'kelime', 'sohbet', 'yazi_konu', 'test', 'deste', 'sozluk', 'sinav'\)\)/);
});

/* Speaking geliştirme (07.11.2026): canlı ses dalgası, dinleyen hoca, sınav giriş/çıkış sahnesi,
   rapor sinematiği, renkli transkript, model cevap karşılaştırma */
test('renkli transkript: bağlaç, güçlü kelime, dolgu ve düzeltme işaretlenir; HTML kaçar', () => {
  const { S } = sinavYukle();
  const h = S.renkle('Um, I think it is very important because cities are expensive, however <b>parks</b> are beneficial.', [{ parca: 'very important', tr: 'daha güçlü kelime', oneri: 'crucial' }]);
  assert.match(h, /<span class="t-dolgu"[^>]*>Um<\/span>/);
  assert.match(h, /<span class="t-hata" title="daha güçlü kelime → crucial">very important<\/span>/);
  assert.match(h, /<span class="t-bag"[^>]*>because<\/span>/); assert.match(h, /<span class="t-bag"[^>]*>however<\/span>/);
  assert.match(h, /<span class="t-guclu"[^>]*>expensive<\/span>/); assert.match(h, /<span class="t-guclu"[^>]*>beneficial<\/span>/);
  assert.doesNotMatch(h, /<b>/, 'öğrenci metni kaçar'); assert.match(h, /&lt;b&gt;/);
  assert.doesNotMatch(h, /t-guclu"[^>]*>important</, 'işaretli düzeltmenin içi ikinci kez boyanmaz');
});
test('model cevap: eksik kalıplar bulunur; yapay zekâ yoksa yapı iskeleti, her bölüm için', () => {
  const { S } = sinavYukle();
  const e = [...S.eksikler('I like parks because they are nice.', 'On the other hand, parks are essential because they reduce pollution; for example, ...')];
  assert.ok(e.includes('On the other hand') && e.includes('essential') && e.includes('pollution') && e.includes('for example'));
  assert.ok(!e.includes('because'), 'zaten kullandığı bağlaç sayılmaz');
  for (const b of ['isinma', 'resim', 'gorus', 'part1', 'part2', 'part3', 'mulakat']) assert.ok(S.ISKELET[b].length >= 3, b);
  const j = read('ingilizce/assets/sinav.js');
  assert.match(j, /A\.yz\('sinav_model', \{ seviye: lv, bolum: c\.adim\.b, soru: c\.adim\.soru/);
  assert.match(j, /A\.ls\.yaz\('spModel', modelBellek\)/, 'aynı soru için ikinci istek yok');
  const f = read('supabase/functions/ingilizce-hoca/index.ts');
  assert.match(f, /if \(b && b\.mod === 'sinav_model'\) return await sinavModel\(b\)/);
  assert.match(f, /if \(!v \|\| !metin\(v\.model_en, 1600\)\) return json\(\{ error: 'Unparseable' \}, 502\)/);
});
test('canlı dalga, dinleyen hoca, sahne ve sinematik: hareket azaltılınca kapalı', () => {
  const j = read('ingilizce/assets/sinav.js'), c = read('ingilizce/assets/ing.css');
  assert.match(j, /actx\.createMediaStreamSource\(akis\); an = actx\.createAnalyser\(\)/);
  assert.match(j, /var dinleyenHoca = function \(now, sessiz\) \{[^\n]*\n      if \(A\.sakin\) return;/);
  assert.match(j, /if \(durum\.mod === 'sinav'\) await perde\('giris'\)/);
  assert.match(j, /if \(durum\.mod === 'sinav' && !durum\.iptal\) await perde\('cikis'\)/);
  assert.match(j, /if \(A\.sakin\) \{ el\.textContent = O\.yaz\(hedef\); return; \}/);
  assert.match(j, /duraks: olcer \? duraks : null/);
  assert.match(c, /@media \(prefers-reduced-motion:reduce\)\{\.sv-perde,\.sv-perde \*,\.sv-rapor-kart\.zarftan/);
});

/* Speaking 3. tur (07.11.2026): karaoke altyazı, konuşma zaman şeridi, ikinci şans, hedef ve sınav tarihi planı */
test('zaman şeridi: konuşma / sessizlik / uzun duraksama blokları, 10 sn hız, hız düşüşü notu', () => {
  const { S } = sinavYukle();
  const x = [];
  for (let i = 0; i < 40; i++) x.push([1, Math.round(i * 0.5)]);          /* 10 sn, 20 kelime → 120 k/dk */
  for (let i = 0; i < 16; i++) x.push([0, 20]);                             /* 4 sn duraksama */
  for (let i = 0; i < 24; i++) x.push([(i + 1) % 2, 20 + Math.round(i * 0.2)]);   /* yavaşlama */
  x.push([1, 25]);
  const h = S.seritCiz({ serit: x });
  assert.match(h, /<i class="k" style="flex:40"/);
  assert.match(h, /<i class="d" style="flex:16" title="uzun duraksama · 4\.0 sn"><b>4 sn<\/b><\/i>/);
  assert.match(h, /hız 120 · \d+ k\/dk/);
  assert.match(h, /Hız 120 → \d+ kelime\/dk düştü/);
  assert.equal(S.seritCiz({ serit: null }), '');
});
test('hedef planı: tam sınav yoksa önce tam sınav; son günlerde prova; zayıf kritere göre bölüm pratiği; tarih geçince uyarı', () => {
  const { S } = sinavYukle();
  const gun = 864e5, simdi = new Date(2026, 10, 7, 12).getTime(), tarih = (d) => { const t = new Date(simdi + d * gun); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };
  const hd = (d) => ({ puan: 7, tarih: tarih(d) });
  assert.equal(S.planOneri('orta', hd(20), [], simdi).mod, 'sinav');
  const g = [{ t: simdi - gun, lv: 'orta', genel: 6, k: { akici: 6.5, kelime: 5.5, dogru: 6, telaffuz: 6.5 }, kismi: false }];
  const p1 = S.planOneri('orta', hd(20), g, simdi);
  assert.deepEqual([p1.mod, p1.tek, p1.kalan, p1.bugun], ['pratik', 'part3', 20, false], 'kelime zayıf → Part 3');
  assert.equal(S.planOneri('orta', hd(2), g, simdi).etiket, 'Tam prova');
  const eski = [{ ...g[0], t: simdi - 5 * gun }];
  assert.equal(S.planOneri('orta', hd(20), eski, simdi).mod, 'sinav', '4 günden eski tam sınav → yeni tam sınav');
  assert.equal(S.planOneri('orta', hd(-1), g, simdi).mod, null);
  assert.equal(S.planOneri('zor', hd(20), [{ t: simdi, lv: 'zor', genel: 4, k: { tekrar: 3, akici: 4.5, kelime: 4, telaffuz: 4 } }], simdi).tek, 'tekrar');
});
test('karaoke altyazı ve ikinci şans: kelimeler sesle yanar, boundary yoksa tahmin; ikinci deneme ilkiyle karşılaştırılır', () => {
  const j = read('ingilizce/assets/hoca.js'), sv = read('ingilizce/assets/sinav.js');
  assert.match(j, /u\.onboundary = function \(e\) \{ if \(e\.name && e\.name !== 'word'\) return; sinirGeldi = true;/);
  assert.match(j, /tahminZ = setTimeout\(function \(\) \{ if \(!sinirGeldi && !son\) \{ yak\(0\); tahmin\(o\.hiz \|\| \.95\); \} \}, 600\)/);
  assert.match(j, /var kelimeler = \[\], kar = !o\.gizli && en && sesVar && sesAcik\(\) && !sakin;/, 'gizli cümle (dinle-tekrarla) ve hareket azaltma: karaoke yok');
  assert.match(sv, /var a2 = Object\.assign\(\{\}, c\.adim, \{ giris: '', giris_tr: '' \}\); c2 = await adimSor\(a2, 0, 1\)/);
  assert.match(sv, /k1 = kriterYerel\(lv, \[c1\]\), k2 = kriterYerel\(lv, \[c2\]\)/);
  assert.match(sv, /'<button type="button" class="btn sm" data-ikinci>İkinci şans<\/button>/);
});

/* Konuşma atölyesi (07.11.2026): 14 kategori × A1–C2 × 7 etkinlik; yerel banka + havuz */
function atolyeYukle() {
  const depo = {};
  const ctx = { window: null, document: { body: { dataset: {} } }, console, matchMedia: () => ({ matches: false }), setTimeout, clearTimeout, Promise };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(read('ingilizce/assets/hoca.js'), ctx);
  ctx.ACX = { esc: (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'), ls: { al: (k, v) => (k in depo ? depo[k] : v), yaz: (k, v) => { depo[k] = v; } }, icerik: null, yz: async () => null, gunlukEkle() {} };
  for (const f of ['sinav-banka', 'sinav', 'konusma-banka', 'konusma']) vm.runInContext(read(`ingilizce/assets/${f}.js`), ctx);
  return { K: ctx.KONUSMA, B: ctx.KONUSMA_BANKA };
}
test('atölye bankası: 14 kategori, her biri A1–C2 için konu ve kelime, yedi etkinliğin içeriği', () => {
  const { B } = atolyeYukle();
  assert.equal(B.kategoriler.length, 14);
  assert.deepEqual(B.seviyeler.map((s) => s[0]).join(','), 'A1,A2,B1,B2,C1,C2');
  const kelimeler = new Set();
  for (const k of B.kategoriler) {
    for (const sv of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
      const c = k.seviye[sv]; assert.ok(c && c.konular.length >= 2 && c.kelimeler.length >= 6, k.id + ' ' + sv);
      for (const t of c.konular) { assert.equal(t.length, 3); assert.ok(t.every((x) => typeof x === 'string' && x.length > 2)); }
    }
    assert.ok(k.munazara.length >= 3 && k.munazara.every((m) => m.iddia && m.lehte.length >= 2 && m.aleyhte.length >= 2), k.id + ' münazara');
    assert.ok(k.taboo.length >= 6 && k.taboo.every((t) => t[1].length === 4 && /^(A1|A2|B1|B2)$/.test(t[2])), k.id + ' taboo');
    assert.ok(k.rol.replikler.length >= 4 && k.rol.hedefler.length === 3 && k.rol.kaliplar.length >= 3, k.id + ' rol');
    assert.ok(k.grafik.length >= 1 && k.grafik.every((g) => g.etiketler.length >= 4 && g.aralik[1] > g.aralik[0]), k.id + ' grafik');
    assert.ok(k.hikaye.length >= 2 && k.roportaj.cevaplar.length >= 6, k.id + ' hikâye/röportaj');
    k.taboo.forEach((t) => kelimeler.add(t[0]));
  }
  assert.ok(kelimeler.size >= 80, 'anlat-buldur kartı sayısı: ' + kelimeler.size);
});
test('atölye: seviye kilidi, seviyeye en yakın içerik, üretilen grafik verisi ve örnek anlatım', () => {
  const { K } = atolyeYukle();
  assert.deepEqual(K.ETK.map((e) => e.id).join(','), 'dakika,munazara,taboo,rol,grafik,hikaye,roportaj');
  assert.equal(K.ETK.find((e) => e.id === 'munazara').min, 'A2');
  const m = [{ sev: 'A2' }, { sev: 'B1' }, { sev: 'C1' }];
  assert.deepEqual([...K.yakinSev(m, (x) => x.sev, 'B2')].map((x) => x.sev), ['A2', 'B1'], 'B2: altındaki en yakın iki seviye');
  assert.deepEqual([...K.yakinSev(m, (x) => x.sev, 'C2')].map((x) => x.sev), ['C1']);
  assert.deepEqual([...K.yakinSev(m, (x) => x.sev, 'A1')].map((x) => x.sev), ['A2', 'B1'], 'altı yoksa en yakın üst');
  const g = { baslik: 'Test', birim: '%', tip: 'cizgi', etiketler: ['a', 'b', 'c', 'd', 'e', 'f'], aralik: [10, 60], egilim: 'artis' };
  for (let i = 0; i < 20; i++) { const v = K.veriUret(g); assert.equal(v.length, 6); assert.ok(v[5] > v[0], 'artış: ' + v); assert.ok(v.every((x) => x >= 9 && x <= 60)); }
  const d = K.veriUret({ ...g, egilim: 'azalis', aralik: [1.5, 7] }); assert.ok(d[0] > d[5] && d.some((x) => !Number.isInteger(x)), 'küçük aralıkta ondalık');
  const ma = K.modelAnlatim(g, [10, 20, 30, 40, 50, 60]);
  assert.match(ma, /^The chart shows test\. Overall, the figures rose from 10 to 60 %\. The highest figure was for f, at 60 %, while the lowest was a, with only 10\./);
});
test('atölye: soru tipi ve soru dilbilgisi (röportaj), yasaklı kelime yakalama (anlat-buldur)', () => {
  const { K } = atolyeYukle();
  assert.equal(K.soruTuru('Why did you start running'), 'wh');
  assert.equal(K.soruTuru('Have you ever been injured'), 'yn');
  assert.equal(K.soruTuru('Could you tell me how you train'), 'dolayli');
  assert.equal(K.soruTuru('I like running'), '');
  assert.match(K.soruHatasi('Why you started running')[0], /Yardımcı fiil eksik/);
  assert.match(K.soruHatasi('Does he likes it')[0], /yalın/);
  assert.equal(K.soruHatasi('What do you eat before a race'), null);
  assert.ok(K.icerir('You kick the ball into the net', 'ball'));
  assert.ok(K.icerir('We play football every week', 'football'));
  assert.ok(!K.icerir('It is a big round thing', 'ball'));
  assert.ok(K.icerir('How much does it cost?', 'how much'));
});
test('atölye sayfası ve fonksiyon: bölüm, betik sırası; konusma havuzu ve etkinlik modu; migration', () => {
  const h = read('ingilizce/speaking.html');
  assert.ok(h.indexOf('id="atolye"') > h.indexOf('id="hoca"') && h.indexOf('id="atolye"') < h.indexOf('id="calis"'));
  const sira = ['assets/sinav.js', 'assets/konusma-banka.js', 'assets/konusma.js'].map((x) => h.indexOf('<script src="' + x + '">'));
  assert.ok(sira.every((x, i) => x > 0 && (i === 0 || x > sira[i - 1])));
  assert.match(h, /KONUSMA\.kur\(document\.getElementById\('konusma-atolye'\)\)/);
  const f = read('supabase/functions/ingilizce-hoca/index.ts');
  assert.match(f, /const KONUSMA_RE = \/\^\(dakika\|munazara\|taboo\|rol\|grafik\|hikaye\|roportaj\):\(\[a-z\]\+\):\(A1\|A2\|B1\|B2\|C1\|C2\)\$\//);
  assert.match(f, /if \(b && b\.mod === 'etkinlik'\) return await etkinlikTur\(b\)/);
  assert.match(f, /\(tur === 'konusma' && !konusmaAlt\(alt\)\)/);
  for (const t of ['munazara', 'rol', 'hikaye', 'roportaj', 'taboo']) assert.ok(f.includes(`tip === '${t}'`), t);
  assert.match(read('supabase/migrations/20261107b_ingilizce_konusma.sql'), /'sinav', 'konusma', 'dinle', 'oku'\)\)/);
  const j = read('ingilizce/assets/konusma.js');
  assert.match(j, /A\.icerik\('konusma', etk \+ ':' \+ durum\.kat \+ ':' \+ durum\.sev\)/);
  assert.match(j, /if \(liste\.length && g\.length < liste\.length\) return yerelSec\(anahtar, liste\)\.veri;/, 'önce görülmemiş yerel, sonra havuz');
});

/* Çay soğumadan dört tur (07.11.2026): her gün yeni set, dört aile, otomatik seviye */
function cayYukle(depoIlk) {
  const depo = Object.assign({}, depoIlk || {});
  const ctx = { window: null, document: { body: { dataset: {} } }, console, matchMedia: () => ({ matches: false }), setTimeout, clearTimeout, Promise, Math, Date };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(read('ingilizce/assets/hoca.js'), ctx);
  ctx.ACX = { esc: (x) => String(x), ls: { al: (k, v) => (k in depo ? depo[k] : v), yaz: (k, v) => { depo[k] = JSON.parse(JSON.stringify(v)); } }, icerik: null, yz: async () => null, gunlukEkle() {} };
  for (const f of ['sinav-banka', 'sinav', 'konusma-banka', 'cay-banka', 'cay']) vm.runInContext(read(`ingilizce/assets/${f}.js`), ctx);
  return { C: ctx.CAY, B: ctx.CAY_BANKA, depo };
}
test('çay: banka her seviyede yeterli; vurgu indeksleri geçerli; tür ailelerinin hepsinin koşucusu var', () => {
  const { C, B } = cayYukle();
  for (const sv of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
    const c = B.sev[sv];
    assert.ok(c.vurgu.length >= 6 && c.vurgu.every((v) => v[2] >= 0 && v[2] < v[1].length && v[1].join('').toLowerCase() === v[0].replace(/[^a-z]/gi, '').toLowerCase().slice(0, v[1].join('').length)), sv + ' vurgu');
    assert.ok(c.golge.length >= 6 && c.baglanti.length >= 3 && c.ifade.length >= 6 && c.kalip.length >= 3 && c.uzat.length >= 3, sv);
    assert.ok(c.baglanti.every((x) => x.includes('‿')), sv + ' bağlantı işareti');
  }
  assert.ok(B.ciftler.length >= 20 && B.tonlama.length >= 12 && B.gecis.length >= 12 && B.tekerleme.length >= 10);
  for (const a of C.AILE) for (const t of a.turler) assert.equal(typeof C.KOS[t], 'function', t);
  assert.deepEqual(C.AILE.map((a) => a.id).join(','), 'telaffuz,akicilik,dinle,kalip');
});
test('çay: aynı gün aynı set, ertesi gün farklı; her gün dört aile birer kez; 12 günde bütün türler', () => {
  const { C } = cayYukle();
  const p1 = C.gunPlani('2026-11-07', 'B1'), p1b = C.gunPlani('2026-11-07', 'B1'), p2 = C.gunPlani('2026-11-08', 'B1');
  assert.deepEqual(p1.map((p) => p.tur), p1b.map((p) => p.tur));
  assert.notDeepEqual(p1.map((p) => p.aile.id + p.tur), p2.map((p) => p.aile.id + p.tur));
  const gor = new Set();
  for (let d = 1; d <= 12; d++) { const p = C.gunPlani('2026-12-' + String(d).padStart(2, '0'), 'B1'); assert.equal(new Set(p.map((x) => x.aile.id)).size, 4); p.forEach((x) => gor.add(x.tur)); }
  assert.equal(gor.size, 13, [...gor].join(','));
  const r1 = C.tohum('a'), r2 = C.tohum('a'); assert.equal(r1(), r2());
});
test('çay: otomatik seviye: başlangıç atölye seviyesinden; gün içinde sabit, başarı ertesi günü değiştirir', () => {
  const { C, depo } = cayYukle({ 'akSev': 'B2' });
  const v = C.veriAl(new Date(2026, 10, 7, 10));
  assert.equal(v.gunler['2026-11-07'].sev, 'B2');
  for (let i = 0; i < 4; i++) C.seviyeGuncelle(v, 1);
  assert.equal(v.gunler['2026-11-07'].sev, 'B2', 'gün içinde değişmez');
  assert.ok(v.sev >= 3.85 && v.sev < 4, 'yarın C1’e yakın: ' + v.sev);
  C.seviyeGuncelle(v, 1); depo.cay = v;
  assert.equal(C.veriAl(new Date(2026, 10, 8, 9)).gunler['2026-11-08'].sev, 'C1');
  const d = { sev: 0.1, gunler: {} }; C.seviyeGuncelle(d, 0); assert.equal(d.sev, 0, 'A1’in altına inmez');
});
test('çay sayfası: eski dört alıştırma kalktı, #calis içinde günlük set; betik sırası', () => {
  const h = read('ingilizce/speaking.html');
  assert.match(h, /<div class="calis cay" id="cay-gun"><\/div>/);
  assert.doesNotMatch(h, /id="t-vurgu"|id="t-gecis"|id="golge"|id="kart-bas"/);
  const sira = ['assets/konusma-banka.js', 'assets/cay-banka.js', 'assets/cay.js'].map((x) => h.indexOf('<script src="' + x + '">'));
  assert.ok(sira.every((x, i) => x > 0 && (i === 0 || x > sira[i - 1])));
  assert.match(h, /CAY\.kur\(D\.getElementById\('cay-gun'\)\)/);
  assert.match(read('ingilizce/assets/cay.js'), /if \(gun\.en\[i\] >= GECER\) A\.bitir\(P, 'cay-' \+ an \+ '-' \+ i\)/, 'en az %40 alan tur günlük sayaca ve mühüre girer');
  assert.match(read('ingilizce/assets/cay.js'), /if \(ilk\) \{ gun\.puan\[i\] = puan; seviyeGuncelle\(v, puan\); \}/, 'seviyeyi yalnız ilk deneme oynatır');
});

/* Kişisel deste (07.11.2026): seviye testi, kişisel havuz, aralıklı tekrar, oyunlar, bahçe */
function kelimeYukle() {
  const ctx = { window: null, document: { body: { dataset: {} }, addEventListener() {} }, console, Math, Date };
  ctx.window = ctx; vm.createContext(ctx);
  ctx.ACX = { esc: (x) => String(x), ls: { al: (k, v) => v, yaz() {} } };
  for (const f of ['kelime-banka', 'kelime']) vm.runInContext(read(`ingilizce/assets/${f}.js`), ctx);
  return { K: ctx.KELIME, B: ctx.KELIME_BANKA };
}
test('kelime havuzu: her seviyede 60 benzersiz kelime, dört alan, örnekte kelime geçer; sahte kelimeler havuzda yok', () => {
  const { K, B } = kelimeYukle();
  const tum = new Set();
  for (const sv of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
    assert.equal(B.sev[sv].length, 60, sv);
    for (const s of B.sev[sv]) { const p = s.split('|'); assert.equal(p.length, 4, s); assert.match(p[1], /^(n|v|adj|adv|phr)$/, s); assert.ok(!tum.has(p[0]), 'tekrar: ' + p[0]); tum.add(p[0]); assert.ok(new RegExp(p[0].slice(0, Math.max(3, p[0].length - 3)), 'i').test(p[3]), 'örnekte yok: ' + p[0]); }
  }
  assert.equal(Object.keys(K.BANKA).length, 360);
  assert.ok(B.sahte.length >= 16 && B.sahte.every((w) => !tum.has(w)));
});
test('aralıklı tekrar: Tekrar 10 dk; İyi 1 → 3 → aralık × kolaylık; Kolay daha uzun; Zor kolaylığı düşürür; evreler', () => {
  const { K } = kelimeYukle();
  const t0 = new Date(2026, 10, 7, 12).getTime();
  let c = { n: 0, iv: 0, ef: 2.5, d: 0, hata: 0, son: 0 };
  const iyi1 = K.hesapla(c, 2, t0); assert.equal(iyi1.iv, 1);
  const iyi2 = K.hesapla(iyi1, 2, t0); assert.equal(iyi2.iv, 3);
  const iyi3 = K.hesapla(iyi2, 2, t0); assert.equal(iyi3.iv, 8);
  assert.ok(K.hesapla(iyi2, 3, t0).iv > iyi3.iv, 'kolay daha uzun');
  const zor = K.hesapla(iyi2, 1, t0); assert.ok(zor.ef < iyi2.ef && zor.iv >= 1);
  const unut = K.hesapla(iyi3, 0, t0); assert.deepEqual([unut.iv, unut.n, unut.hata, unut.d - t0], [0, 0, 1, 600000]);
  assert.equal(K.evre({ son: 0 }), 'tohum'); assert.equal(K.evre({ son: 1, iv: 1 }), 'filiz'); assert.equal(K.evre({ son: 1, iv: 8 }), 'yaprak'); assert.equal(K.evre({ son: 1, iv: 21 }), 'cicek');
});
test('seviye testi: uydurma kelimeye “biliyorum” tahmini düşürür; seviye ilk %70 altı bant; güvenilirlik eşiği', () => {
  const { K } = kelimeYukle();
  const og = [], cv = [];
  const ekle = (sev, n, bil) => { for (let i = 0; i < n; i++) { og.push({ k: sev + i, sev }); cv.push(i < bil ? 1 : 0); } };
  ekle('A1', 5, 5); ekle('A2', 5, 5); ekle('B1', 5, 4); ekle('B2', 5, 2); ekle('C1', 5, 1); ekle('C2', 5, 0);
  for (let i = 0; i < 10; i++) { og.push({ k: 's' + i, sahte: true }); cv.push(0); }
  const r = K.testSonuc(og, cv);
  assert.equal(r.sev, 'B2'); assert.ok(r.guvenilir); assert.equal(r.tahmin, Math.round((600 + 900 + 1500 * .8 + 2000 * .4 + 2500 * .2) / 50) * 50);
  const cv2 = cv.slice(); for (let i = 30; i < 34; i++) cv2[i] = 1;   /* 4/10 sahte "biliyorum" */
  const r2 = K.testSonuc(og, cv2); assert.ok(!r2.guvenilir && r2.tahmin < r.tahmin && r2.sahteBil === 4);
});
test('vocab sayfası: eski sabit deste kalktı, kişisel deste #calis içinde; betik sırası', () => {
  const h = read('ingilizce/vocab.html');
  assert.match(h, /<article class="kagit alis kel-alis" data-id="deste"/);
  assert.doesNotMatch(h, /id="dkk"|var KELIME = \[/);
  const sira = ['assets/hoca.js', 'assets/kelime-banka.js', 'assets/kelime.js'].map((x) => h.indexOf('<script src="' + x + '">'));
  assert.ok(sira.every((x, i) => x > 0 && (i === 0 || x > sira[i - 1])));
  assert.match(h, /KELIME\.kur\(D\.getElementById\('kelime-app'\)\)/);
  const j = read('ingilizce/assets/kelime.js');
  assert.match(j, /YENI_GUNLUK = 10/); assert.match(j, /tohum: Math\.floor\(Math\.random\(\) \* 4294967295\)/, 'öğrenciye özel sıra');
  assert.match(read('supabase/functions/ingilizce-hoca/index.ts'), /const sev = tur === 'deste' && \/\^\(A1\|A2\|B1\|B2\|C1\|C2\)\$\/\.test/);
});


/* hub (07.11.2026): defter açılış sahnesi, beceri puanı/ağacı/radar, harita, yatay şerit, kalem çizgisi */
function hubYukle() { const ctx = { window: null, console, Math, Date, Object }; ctx.window = ctx; vm.createContext(ctx); vm.runInContext(read('ingilizce/assets/hub.js'), ctx); return ctx.HUB; }
test('hub: beceri puanı yalnız kayıtlardan; boş tarayıcıda hepsi 0, ağaç tohum', () => {
  const H = hubYukle(), s = H.beceriler({}, new Date(2026, 10, 7).getTime());
  assert.deepEqual(JSON.parse(JSON.stringify(H.BECERI.map((b) => s[b.id].puan))), [0, 0, 0, 0, 0]);
  for (const b of H.BECERI) { const d = H.agac(b.id, s[b.id]); assert.equal(d.length, 5); assert.equal(H.rozet(d), 'tohum'); }
});
test('hub: ortak 60 + özel 40; özel verisi olmayan beceri 100e ölçeklenir; 14 gün dışı etkin sayılmaz', () => {
  const H = hubYukle(), simdi = new Date(2026, 10, 7, 12).getTime(), N = Date.now();
  const v = { bitti: { reading: { a: N, b: N, c: N, d: N } }, hoca: { reading: N }, hocaTur: { reading: 3 }, gunluk: { '2026-11-07': { reading: 1 }, '2026-11-06': { reading: 1 }, '2026-10-01': { reading: 1 } } };
  const s = H.beceriler(v, simdi);
  /* 25 + 10 + 5 + 2/7*20 = 45.71 → /60*100 = 76 */
  assert.equal(s.reading.puan, 76); assert.equal(s.reading.gun, 3); assert.equal(s.reading.etkin, 2);
  const d = H.agac('reading', s.reading); assert.deepEqual(JSON.parse(JSON.stringify(d.map((x) => x.acik))), [true, true, true, true, false]); assert.equal(H.rozet(d), 'gelişiyor');
  /* vocab: seviye C2 (20) + 30 çiçek (20) = özel 40 */
  const kart = {}; for (let i = 0; i < 30; i++) kart['w' + i] = { iv: 30, son: N };
  const k = H.beceriler({ kelime: { sev: 'C2', kart } }, simdi).vocab; assert.equal(k.puan, 40); assert.equal(k.cicek, 30);
  /* speaking: kısmi (pratik) sınav sayılmaz; orta 9/9 → 20 */
  assert.equal(H.beceriler({ spGecmis: [{ lv: 'orta', genel: 9, kismi: true }] }, simdi).speaking.puan, 0);
  assert.equal(H.beceriler({ spGecmis: [{ lv: 'orta', genel: 9, kismi: false }] }, simdi).speaking.puan, 20);
});
test('hub: radar köşeleri üstten saat yönünde, puanla ölçekli', () => {
  const H = hubYukle(), n = H.radarNokta([100, 0, 0, 0, 0], 100, 0, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(n[0])), [0, -100]); assert.ok(Math.hypot(n[1][0], n[1][1]) < 5, 'sıfır puan merkeze yakın');
});
test('hub sayfası: sahne sırası, hub.js ing.js sonrası, şimdiki durak rota sahnesine bağlı', () => {
  const h = read('ingilizce/index.html'), c = read('ingilizce/assets/ing.css'), j = read('ingilizce/assets/hub.js');
  const sira = ['<section class="kah">', 'id="ac" data-adim="6"', 'id="beceri"', 'id="rota"', 'id="hafta"'].map((x) => h.indexOf(x));
  assert.ok(sira.every((x, i) => x > 0 && (i === 0 || x > sira[i - 1])), 'kapak → defter → radar → harita → şerit');
  assert.ok(h.indexOf('assets/hub.js') > h.indexOf('assets/ing.js'));
  assert.match(h, /D\.getElementById\('rota'\)\.addEventListener\('adim'/, 'ilk .sahne artık defter sahnesi');
  assert.doesNotMatch(c, /\.ac-kapak \.on\b/, '.on sınıfı içindekiler li.on ile çakışır');
  assert.match(c, /\.ac-kitap\{--ac:clamp\(0,calc\(var\(--p,0\) \* 6\),1\)/);
  assert.match(j, /var tk = el\.querySelector\('\.takvim'\)|serit-iz/);
  assert.match(read('ingilizce/assets/ing.js'), /var tk = el\.querySelector\('\.takvim'\); if \(tk\) tk\.innerHTML = hucre;/);
});


/* dinleme stüdyosu (07.11.2026): banka, hizalama, kulak haritası, günün bölümü, havuz doğrulaması */
function dinleYukle() {
  const ctx = { window: null, console, Math, Date, Object, JSON }; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(read('ingilizce/assets/dinle-banka.js'), ctx); vm.runInContext(read('ingilizce/assets/dinle.js'), ctx);
  return { D: ctx.DINLE, B: ctx.DINLE_BANKA };
}
test('dinle: her kategoride A, B ve C bandından bölüm; harita dışı bölümler havuz doğrulamasından geçer', () => {
  const { D, B } = dinleYukle();
  assert.equal(B.KAT.length, 8);
  for (const k of B.KAT) {
    const sev = B.BOLUM.filter((b) => b.kat === k.id).map((b) => b.sev[0]);
    for (const band of 'ABC') assert.ok(sev.includes(band), k.id + ' ' + band);
  }
  assert.equal(new Set(B.BOLUM.map((b) => b.id)).size, B.BOLUM.length, 'id tekil');
  for (const b of B.BOLUM) if (!b.harita) assert.ok(D.dogrula(b), b.id);
  assert.ok(B.BOLUM.filter((b) => b.harita).length >= 2);
  assert.ok(B.NIYET.length >= 10 && B.NIYET.every((n) => n.d < n.sec.length && n.neden));
});
test('dinle: her not cevabı metinde geçer; harita harfleri haritada; niyet satırı var', () => {
  const { D, B } = dinleYukle();
  for (const b of B.BOLUM) {
    const tum = ' ' + D.norm(b.s.map((x) => x[1]).join(' ')).join(' ') + ' ';
    for (const q of b.q) {
      if (q.t === 'not') assert.ok(q.c.some((c) => tum.includes(' ' + D.norm(c).join(' ') + ' ') || /^[\d.,]+$/.test(c.replace(/,/g, ''))), b.id + ': ' + q.c[0]);
      if (q.t === 'harita') { assert.ok(b.harita); for (const y of q.yer) assert.ok(b.harita.harf[y[1]], b.id + ' ' + y[0]); assert.equal(new Set(q.yer.map((y) => y[1])).size, q.yer.length, 'harf tekrar etmez'); }
      if (q.t === 'sec') assert.ok(q.d >= 0 && q.d < q.sec.length);
      if (q.t === 'esle') assert.ok(q.d.length === q.sol.length && q.d.every((x) => x < q.sag.length));
    }
    for (const n of b.n || []) assert.ok(b.s[n.s], b.id + ' niyet');
  }
});
test('dinle: hizalama (havent = haven’t, 14th = fourteenth, ek kelime üstü çizili), kulak kategorisi', () => {
  const { D } = dinleYukle();
  let k = D.karsilastir('Okay, the presentation is on the fourteenth.', 'okay the presentation is on 14');
  assert.equal(k.isabet, 6); assert.equal(k.toplam, 7); assert.deepEqual(JSON.parse(JSON.stringify(k.kacan)), [{ w: 'the', i: 5 }]);
  k = D.karsilastir('We still haven’t chosen.', 'we still havent really chosen'); assert.equal(k.oran, 1); assert.deepEqual(JSON.parse(JSON.stringify(k.ek)), ['really']);
  assert.equal(D.cevapDogru({ t: 'not', c: ['5000', '5,000'] }, '5,000'), true);
  assert.equal(D.cevapDogru({ t: 'not', c: ['3', 'three'] }, 'Three '), true);
  assert.equal(D.cevapDogru({ t: 'not', c: ['fridge'] }, 'the fridge'), false, 'fazla kelime yanlış');
  const kat = (w, ilk) => D.kategori(w, ilk);
  assert.deepEqual([kat('fourteenth,'), kat('haven’t'), kat('Ghent'), kat('Okay', true), kat('the'), kat('presentation'), kat('chosen'), kat('rested'), kat('room')], ['sayi', 'kisalt', 'ozel', 'icerik', 'islev', 'uzun', 'icerik', 'ek', 'icerik']);
});
test('dinle: günün bölümü aynı gün sabit, görülmemiş öncelikli, seviyeye en yakın; radyo serisi', () => {
  const { D, B } = dinleYukle();
  const a = D.gunSec('2026-11-07', 'B1', B.BOLUM, {}), b = D.gunSec('2026-11-07', 'B1', B.BOLUM, {});
  assert.equal(a.id, b.id); assert.equal(a.sev, 'B1');
  assert.equal(D.gunSec('2026-11-07', 'C2', B.BOLUM, {}).sev, 'C1', 'C2 yoksa C1');
  assert.equal(D.yakin('A1', ['A2', 'B1']), 'A2'); assert.equal(D.yakin('B2', ['B1', 'C1']), 'B1', 'eşitse alttaki');
  const gor = {}; B.BOLUM.filter((x) => x.sev === 'B1').slice(0, -1).forEach((x) => { gor[x.id] = 1; });
  assert.ok(!gor[D.gunSec('2026-11-07', 'B1', B.BOLUM, gor).id], 'görülmemiş kalan seçilir');
  const r = { '2026-11-07': { ok: 1 }, '2026-11-06': { ok: 1 }, '2026-11-04': { ok: 1 } };
  assert.equal(D.seri(r, new Date(2026, 10, 7, 9).getTime()), 2); assert.equal(D.seri(r, new Date(2026, 10, 8, 9).getTime()), 2, 'bugün henüz yoksa dünden sayar');
});
test('dinle sayfası: eski dört alıştırma kalktı, stüdyo ve hoca dikte duruyor; sunucu ve migration dinle türünü tanır', () => {
  const h = read('ingilizce/listening.html');
  assert.match(h, /<div class="calis dn" id="dinle-app"><\/div>/); assert.match(h, /id="hoca-oturum"/);
  assert.doesNotMatch(h, /id="t-sayi"|id="t-cift"|id="t-diyalog"|<div class="dikte-s"/);
  const sira = ['assets/ing.js', 'assets/hoca.js', 'assets/dinle-banka.js', 'assets/dinle.js'].map((x) => h.indexOf('<script src="' + x + '">'));
  assert.ok(sira.every((x, i) => x > 0 && (i === 0 || x > sira[i - 1])));
  assert.match(h, /DINLE\.kur\(document\.getElementById\('dinle-app'\)\)/);
  const j = read('ingilizce/assets/dinle.js');
  assert.match(j, /var gizle = o\.sinav && o\.sinavBitti !== true \|\| o\.sekme === 'dikte';/, 'dikte ve sınavda metin gizli');
  assert.match(j, /A\.icerik\('dinle', st\.kat \+ ':' \+ st\.sev\)/);
  assert.match(j, /var ep = r && tum\(\)\.filter\(function \(b\) \{ return b\.id === r\.id; \}\)\[0\] \|\| gunSec/, 'dinlenince radyo başka bölüme atlamaz');
  assert.match(read('ingilizce/assets/ing.js'), /kelimeAc: kelimeAc/);
  const t = read('supabase/functions/ingilizce-hoca/index.ts');
  assert.match(t, /tur === 'konusma' \|\| tur === 'dinle' \|\| tur === 'oku' \? String\(b\.alt/); assert.match(t, /\(\(tur === 'dinle' \|\| tur === 'oku'\) && !dinleAlt\(alt\)\)/); assert.match(t, /  dinle: \(v\) => DINLE_DOGRULA\(v\),/);
  assert.match(read('supabase/migrations/20261107b_ingilizce_konusma.sql'), /'sinav', 'konusma', 'dinle', 'oku'\)\);/);
  assert.match(read('ingilizce/assets/ing.css'), /\.sahne\{position:relative;height:calc\(var\(--adim,4\) \* 85vh \+ 30vh\);overflow-x:clip\}/);
});


/* okuma masası (07.11.2026): banka, tarama, fosfor, hız, günün makalesi, havuz doğrulaması */
function okuYukle() {
  const ctx = { window: null, console, Math, Date, Object, JSON, Set }; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(read('ingilizce/assets/oku-banka.js'), ctx); vm.runInContext(read('ingilizce/assets/oku.js'), ctx);
  return { O: ctx.OKU, B: ctx.OKU_BANKA };
}
test('oku: her kategoride A, B ve C bandından makale; hepsi havuz doğrulamasından geçer; roller tanımlı', () => {
  const { O, B } = okuYukle();
  assert.equal(B.KAT.length, 8);
  for (const k of B.KAT) { const s = B.MAKALE.filter((m) => m.kat === k.id).map((m) => m.sev[0]); for (const band of 'ABC') assert.ok(s.includes(band), k.id + ' ' + band); }
  assert.equal(new Set(B.MAKALE.map((m) => m.id)).size, B.MAKALE.length);
  for (const m of B.MAKALE) {
    assert.ok(O.dogrula(m), m.id);
    for (const r of m.g) assert.ok(B.ROL[r], m.id + ' rol ' + r);
    assert.ok(m.q.some((q) => q.t === 'tfng' && q.d === 'NG'), m.id + ' en az bir NOT GIVEN');
  }
  assert.equal(O.dogrula(Object.assign({}, B.MAKALE[0], { tara: [{ soru: 'x?', c: ['uydurma'] }] })), false, 'tarama cevabı metinde geçmeli');
});
test('oku: tarama dokunuşu, tamamlama, normalizasyon (FitzGerald’s, gut–brain), hız yardımcıları', () => {
  const { O } = okuYukle();
  assert.equal(O.taraDogru({ c: ['eight hundred'] }, 'hundred,'), true); assert.equal(O.taraDogru({ c: ['2009'] }, '2010'), false);
  assert.equal(O.tamamDogru({ c: ['good enough'] }, ' Good  enough '), true); assert.equal(O.tamamDogru({ c: ['fun'] }, 'fun fun'), false);
  assert.deepEqual(JSON.parse(JSON.stringify(O.norm('FitzGerald’s gut–brain axis.'))), ['fitzgerald', 'gut-brain', 'axis']);
  assert.equal(O.wpmHesap(300, 60000), 300); assert.equal(O.wpmHesap(150, 30000), 300);
  assert.equal(O.odak('reading'), 2); assert.equal(O.odak('a'), 0);
  assert.deepEqual(JSON.parse(JSON.stringify(O.obekle(['a', 'b', 'c', 'd'], 3))), ['a b c', 'd']);
});
test('oku: fosfor aralıkları birleşir ve sıralanır; not korunur', () => {
  const { O } = okuYukle();
  let l = O.fosEkle([], { p: 1, a: 7, b: 3 }); assert.deepEqual(JSON.parse(JSON.stringify(l)), [{ p: 1, a: 3, b: 7, not: '' }]);
  l[0].not = 'kanıt'; l = O.fosEkle(l, { p: 1, a: 8, b: 10 }); assert.deepEqual(JSON.parse(JSON.stringify(l)), [{ p: 1, a: 3, b: 10, not: 'kanıt' }], 'bitişik aralık birleşir');
  l = O.fosEkle(l, { p: 0, a: 2, b: 2 }); assert.equal(l.length, 2); assert.equal(l[0].p, 0);
});
test('oku: günün makalesi aynı gün sabit, seviyeye en yakın; okuma serisi; süre tahmini', () => {
  const { O, B } = okuYukle();
  const a = O.gunSec('2026-11-07', 'B2', B.MAKALE, {}); assert.equal(a.id, O.gunSec('2026-11-07', 'B2', B.MAKALE, {}).id); assert.equal(a.sev, 'B2');
  assert.equal(O.gunSec('2026-11-07', 'A1', B.MAKALE, {}).sev, 'A2');
  const g = { '2026-11-06': { ok: 1 }, '2026-11-05': { ok: 1 }, '2026-11-07': { ok: 0 } };
  assert.equal(O.seri(g, new Date(2026, 10, 7, 10).getTime()), 2);
  const m = { p: ['one two three', 'four five'] }; assert.equal(O.sayKelime(m), 5); assert.equal(O.sure({ p: [Array(400).fill('w').join(' ')] }, 200), 2);
});
test('reading sayfası: eski dört alıştırma kalktı, masa ve hoca duruyor; sunucu oku türünü tanır; eski kimlikler 4/4 üstüne çıkmaz', () => {
  const h = read('ingilizce/reading.html');
  assert.match(h, /<div class="calis okm" id="oku-app"><\/div>/); assert.match(h, /id="hoca"/);
  assert.doesNotMatch(h, /id="t-ana"|id="t-tfng"|id="t-baglam"|id="t-hiz"|\.parca\{/);
  const sira = ['assets/ing.js', 'assets/hoca.js', 'assets/kelime-banka.js', 'assets/oku-banka.js', 'assets/oku.js'].map((x) => h.indexOf('<script src="' + x + '">'));
  assert.ok(sira.every((x, i) => x > 0 && (i === 0 || x > sira[i - 1])));
  assert.match(h, /OKU\.kur\(document\.getElementById\('oku-app'\)\)/);
  const j = read('ingilizce/assets/oku.js');
  assert.match(j, /A\.icerik\('oku', st\.kat \+ ':' \+ st\.sev\)/);
  assert.match(j, /if \(tr\.aktif != null\) \{ taraDokun\(k\); return; \}/, 'tarama sırasında dokunuş cevaptır');
  assert.doesNotMatch(j, /\(\?<=/, 'lookbehind yok');
  const t = read('supabase/functions/ingilizce-hoca/index.ts');
  assert.match(t, /  oku: \(v\) => OKU_DOGRULA\(v\),/); assert.match(t, /  oku: \(alt\) => OKU_URET\(alt\),/);
  assert.match(read('ingilizce/index.html'), /var kac = function \(p\) \{ return Math\.min\(4, Object\.keys/);
  assert.match(read('ingilizce/assets/ing.css'), /\.ok-p:has\(\.ok-pop\)\{z-index:8\}/, 'not kutusu sonraki paragrafın altında kalmasın');
});

summary();
