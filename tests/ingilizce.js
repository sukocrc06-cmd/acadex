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

/* Speaking sınav simülatörü (07.11.2026): kolay = hazırlık atlama mülakatı, orta = IELTS tarzı,
   zor = TOEFL iBT 2026 tarzı; pratik + sınav modu; puan yerel ölçüm + isteğe bağlı yapay zekâ,
   her zaman "tahmini". Resmî sınav adı yalnız "tarzı" ile geçer. */
function sinavYukle(icerik) {
  const depo = {};
  const ctx = { window: null, document: { body: { dataset: {} } }, console, matchMedia: () => ({ matches: false }), setTimeout, clearTimeout, Promise };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(read('ingilizce/assets/hoca.js'), ctx);
  ctx.ACX = { esc: (x) => String(x), ls: { al: (k, v) => (k in depo ? depo[k] : v), yaz: (k, v) => { depo[k] = v; } }, icerik: icerik || null, yz: async () => null, gunlukEkle() {} };
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
  assert.match(f, /alt = tur === 'test' \|\| tur === 'sinav' \? String\(b\.alt \?\? ''\) : ''/);
  assert.match(f, /\(tur === 'sinav' && !SINAV_ALT\[alt\]\)/);
  const m = read('supabase/migrations/20261107_ingilizce_sinav.sql');
  assert.match(m, /check \(tur in \('okuma', 'dikte', 'kelime', 'sohbet', 'yazi_konu', 'test', 'deste', 'sozluk', 'sinav'\)\)/);
});

summary();
