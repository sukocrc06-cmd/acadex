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
  assert.match(h, /<body data-panel="" data-sayfa="hub"/); assert.match(h, /id="simdi"/); assert.match(h, /<section class="bolum" id="hafta" data-yirtik>/);
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
  assert.match(read('ingilizce/reading.html'), /\], \{ panel: P, id: 'hiz', yeniYok: true,/);
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
  assert.match(read('ingilizce/vocab.html'), /var v = await ACX\.icerik\('deste'\)/);
});
test('gezgin Acadia: menü (ipucu, sayfa, defter, kelime), başlığa konma, seçili kelime kartı ve desteye ekleme', () => {
  const j = read('ingilizce/assets/ing.js');
  for (const k of ['ipucu', 'sayfa', 'defter', 'kelime']) assert.match(j, new RegExp('data-ym="' + k + '"'));
  assert.match(j, /D\.querySelectorAll\('\.kah h1, \.bolum-b h2, \.alis-u h3, \.hoca-ust, \.sonraki b'\)/);
  assert.match(j, /if \(!n \|\| n\.closest\('textarea,input,\.acadia,\.kelime-kart,\.ust'\)\) return null;/, 'yazı alanında seçim kart açmaz');
  assert.match(j, /var j = await yz\('sozluk', \{ kelime: k \}, 12000\);/);
  assert.match(j, /ls\.yaz\('desteEk', e2\)/); assert.match(read('ingilizce/vocab.html'), /window\.ACX_DESTE_YENILE = function/);
  /* "bir şıkkı ele" ipucu doğru şıkkı asla elemez */
  assert.match(j, /return !b\.disabled && \+b\.dataset\.k !== \+t\.dataset\.dogru;/);
});
test('hoca 2.5B: gradyanlı hacim, göz ve baş takibi, hareket azaltılınca takip yok', () => {
  const j = read('ingilizce/assets/hoca.js');
  for (const id of ['dh-ten', 'dh-sac', 'dh-ceket', 'dh-iris', 'dh-golge']) assert.match(j, new RegExp('id="' + id + '"'));
  assert.match(j, /<g class="bas"><g class="bas-takip">/); assert.match(j, /class="bebek"/);
  assert.match(j, /if \(!sakin\) \{\n      if \(W\.matchMedia\('\(pointer:fine\)'\)\.matches\)/);
});

summary();
