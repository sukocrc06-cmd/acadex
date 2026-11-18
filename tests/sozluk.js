/* ==========================================================================
   ACADEX — SÖZLÜK (tests/sozluk.js), 18.11.2026

   NEDEN VAR: Acadex Sözlük her panelde (dashboard, özet kartları, lab'lar) aynı pencereyle açılır;
   terimlerin Türkçe + İngilizce karşılığı ve üç anlatımı (Sade · Akademik · Örnekle) vardır.
   Metinlerdeki terimlerin altı noktalıdır; sınav salonunda işaretleme kapalıdır (kopya olmasın).
   Kaynaklar: Acadex'in kendi lab terimleri ve Wikidata (CC0; yalnız yönetim panelinden).
   Bu dosya şunları korur:
     - veritabanı: herkes okur, yalnız yönetici yazar; terim büyük/küçük harfe bakmadan tektir
     - tohum İstatistik Lab'ın terim listesiyle aynı (is-terim.js)
     - eşleşme kuralları: "varyansı" bulunur, "model" içinde "mod", İngilizce "mean" bulunmaz
     - öğrenci dosyası yalnız Acadex'in Supabase'ine gider; Wikidata yalnız yönetim panelinde
   Tarayıcıda (Playwright, masaüstü + telefon) denendi.
   Davranış:  ACADEX_PG="-h /tmp/pg -p 5499 -U postgres" node tests/sozluk.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execSync } = require('node:child_process');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();
const MIG = 'supabase/migrations/20261118b_sozluk.sql', sql = read(MIG), cli = read('js/acadex-sozluk.js'), adm = read('js/admin-sozluk.js');

const istemci = () => {
  const ctx = { document: { readyState: 'loading', addEventListener() {} }, localStorage: { getItem: () => null, setItem() {} }, NodeFilter: {}, console, setTimeout, clearTimeout };
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(cli, ctx); return ctx.AXSOZ._test;
};
const T = (id, tr, en, x) => Object.assign({ id, tr, en, es: [], alan: [], sade: '', akademik: '', ornek: '', durum: 'onayli', isaretle: true }, x || {});

test('veritabanı: herkes okur, yalnız yönetici yazar; tekil terim; sınırlar', () => {
  assert.match(sql, /enable row level security/);
  assert.match(sql, /for select to anon, authenticated using \(true\)/);
  assert.match(sql, /for all to authenticated using \(public\.admin_ok\(\)\) with check \(public\.admin_ok\(\)\)/);
  assert.match(sql, /revoke all on public\.sozluk_terim from anon;\s*grant select on public\.sozluk_terim to anon;/);
  assert.match(sql, /anahtar text generated always as \(lower\(trim\(tr\)\)\) stored/);
  assert.match(sql, /create unique index if not exists sozluk_terim_anahtar_ux on public\.sozluk_terim \(anahtar\)/);
  assert.match(sql, /durum in \('taslak', 'onayli'\)/);
  assert.match(sql, /on conflict \(anahtar\) do nothing/, 'tekrar çalıştırmak zarar vermez');
});
test('tohum: İstatistik Lab terim listesiyle aynı', () => {
  const w = { FN: {} }; vm.runInNewContext(read('labs/istatistik/is-terim.js'), { window: w });
  const g = w.FN.is.GLOSS, tek = new Set();
  Object.keys(g).forEach((k) => g[k].forEach((x) => tek.add(x[0].toLocaleLowerCase('tr'))));
  const tohum = sql.slice(sql.indexOf('from (values'), sql.indexOf(') as v(tr, en, sade)'));
  const satir = tohum.split('\n').filter((s) => /^\s*\('/.test(s));
  assert.equal(satir.length, tek.size);
  assert.ok(tohum.includes("('standart sapma', 'standard deviation', '')"));
});
test('davranış (gerçek Postgres): anonim okur ama yazamaz; yönetici yazar; harf büyüklüğü fark etmez', () => {
  const pg = process.env.ACADEX_PG;
  if (!pg) { console.log('    (ACADEX_PG yok: davranış testi atlandı)'); return; }
  const P = 'psql ' + pg + ' -q -v ON_ERROR_STOP=1';
  execSync(P + ' -d postgres -c "drop database if exists ax_sozluk" -c "create database ax_sozluk"', { stdio: 'pipe' });
  try {
    const run = (s) => execSync(P + ' -d ax_sozluk -At -f -', { input: s, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
    run("do $$ begin if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if; if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if; end $$;" +
      " create function public.admin_ok() returns boolean language sql as $f$ select coalesce(current_setting('test.admin', true), '0') = '1' $f$; grant usage on schema public to anon, authenticated;");
    for (let i = 0; i < 2; i++) execSync(P + ' -d ax_sozluk -f ' + JSON.stringify(path.join(ROOT, MIG)), { stdio: 'pipe' });
    assert.equal(run('select count(*) from sozluk_terim'), '128');
    assert.equal(run("set role anon; select count(*) from sozluk_terim;"), '128', 'girişsiz okur (lab sayfaları)');
    assert.throws(() => run("set role anon; insert into sozluk_terim (tr) values ('deneme');"), 'anonim yazamaz');
    assert.throws(() => run("set role authenticated; insert into sozluk_terim (tr) values ('deneme');"), 'öğrenci yazamaz');
    assert.equal(run("set role authenticated; set test.admin = '0'; update sozluk_terim set sade = 'x' where tr = 'medyan' returning 1;"), '', 'öğrenci güncelleyemez (satır görünmez)');
    run("set role authenticated; set test.admin = '1'; insert into sozluk_terim (tr, en, alan) values ('amortisman', 'depreciation', '{muhasebe}');");
    assert.throws(() => run("set role authenticated; set test.admin = '1'; insert into sozluk_terim (tr) values ('  Amortisman ');"), 'aynı terim büyük harfle de eklenmez');
    run("set role authenticated; set test.admin = '1'; insert into sozluk_terim (tr) values ('amortisman'), ('likidite') on conflict (anahtar) do nothing;");
    assert.equal(run("select count(*) from sozluk_terim where tr in ('amortisman', 'likidite')"), '2');
    assert.throws(() => run("set test.admin = '1'; update sozluk_terim set durum = 'yayinda' where tr = 'likidite';"));
    assert.throws(() => run("set test.admin = '1'; update sozluk_terim set wikidata = 'javascript:1' where tr = 'likidite';"));
    const once = run("select updated_at from sozluk_terim where tr = 'likidite'");
    run("select pg_sleep(0.01); update sozluk_terim set sade = 'Paraya kolay dönebilme.' where tr = 'likidite';");
    assert.notEqual(run("select updated_at from sozluk_terim where tr = 'likidite'"), once, 'güncelleme zamanı (istemci önbelleği buna bakar)');
  } finally {
    execSync(P + ' -d postgres -c "drop database if exists ax_sozluk"', { stdio: 'pipe' });
  }
});
test('eşleşme: Türkçe ek alır, kısa terim ve İngilizce fiil karışmaz', () => {
  const o = istemci();
  o.kur([T('1', 'varyans', 'variance'), T('2', 'mod', 'mode'), T('3', 'standart sapma', 'standard deviation'), T('4', 'ortalama', 'mean'), T('5', 'nitel / nicel veri', 'qualitative / quantitative data'),
    T('6', 'oran', 'ratio'), T('7', 'medyan', 'median', { isaretle: false }), T('8', 'İstatistik', 'statistics')]);
  const bul = (s) => JSON.parse(JSON.stringify(o.eslesmeler(s).map((m) => s.substr(m.i, m.n) + '>' + m.id)));
  assert.deepEqual(bul('Varyansın karekökü standart sapmadır.'), ['Varyans>1', 'standart sapma>3']);
  assert.deepEqual(bul('Bu model mod içermez'), [], '3 harfli terim metinde işaretlenmez; "model" içinde "mod" aranmaz');
  assert.deepEqual(bul('Bu modeller varyansla'), ['varyans>1'], '"modeller" içinde terim yok, "varyansla" var');
  assert.deepEqual(bul('What does it mean? The mean is 5.'), [], 'İngilizce kısa terim (mean) işaretlenmez');
  assert.deepEqual(bul('Standard deviations differ'), ['Standard deviation>3'], 'İngilizce çoğul eki');
  assert.deepEqual(bul('oranlama ve oran'), ['oran>6'], '5 harften kısa Türkçe terim ek almaz');
  assert.deepEqual(bul('nicel veriler ve nitel veri'), ['nicel veri>5', 'nitel>5'], '"/" ile ayrılan yazımlar ("nitel" ve "nicel veri")');
  assert.deepEqual(bul('medyan'), [], 'işaretle kapalıysa metinde aranmaz');
  assert.deepEqual(bul('İSTATİSTİK dersi'), ['İSTATİSTİK>8'], 'Türkçe büyük İ');
  assert.equal(o.ara('medyan')[0].id, '7', 'işaretsiz terim aramada çıkar');
  assert.equal(o.ara('SD').length, 0); o.kur([T('3', 'standart sapma', 'standard deviation', { es: ['SD', 'std. sapma'] })]);
  assert.deepEqual(JSON.parse(JSON.stringify(o.ara('sd').map((t) => t.id))), ['3'], 'diğer yazımlar aranır');
  assert.equal(o.ara('deviation')[0].id, '3', 'İngilizceden aranır');
});
test('kart: üç anlatım, boş düzeyde dürüst not, metin kaçışlı', () => {
  const o = istemci();
  const h = o.kartHtml(T('9', '<b>x</b>', 'y', { sade: '', akademik: 'Tanım <script>', durum: 'taslak' }), false);
  assert.ok(!h.includes('<b>x</b>') && h.includes('&lt;b&gt;x&lt;/b&gt;') && h.includes('Tanım &lt;script&gt;'));
  assert.match(h, /data-asz-sv="sade"[^>]*>Sade<\/button>/); assert.match(h, /data-asz-sv="akademik" aria-selected="true"/, 'seçili düzey boşsa dolu olan gösterilir');
  assert.match(h, /Sade anlatım henüz yok; bunu gösteriyorum\./); assert.match(h, /taslak · kurul onayı bekliyor/);
});
test('entegrasyon: dashboard ve bütün lab sayfaları; sınavda kapalı; yalnız Acadex sunucusu', () => {
  assert.ok(read('dashboard.html').includes('<script src="js/acadex-sozluk.js"></script>'));
  const labs = fs.readdirSync(path.join(ROOT, 'labs')).filter((d) => fs.existsSync(path.join(ROOT, 'labs', d, 'index.html')));
  /* Anatomi ve Fizyo Lab tek dosya olarak kopyalanıp kendi başına çalışır (tests/medlab.js): yerel betik almaz */
  const TEK = ['anatomi', 'fizyo'];
  assert.ok(labs.length >= 13);
  for (const d of labs) assert.equal(read('labs/' + d + '/index.html').includes('<script src="../../js/acadex-sozluk.js" defer></script>'), !TEK.includes(d), d);
  assert.match(cli, /function kapali\(\) \{ return D\.body\.classList\.contains\('axs-hall-on'\)/);
  assert.match(cli, /#exam-active-screen, #exam-questions-container, \.sn-room/);
  assert.match(cli, /body\.axs-hall-on \.asz-fab/);
  const hostlar = [...cli.matchAll(/https?:\/\/[^'"\s)]+/g)].map((m) => m[0]).filter((u) => !/w3\.org/.test(u));
  assert.deepEqual([...new Set(hostlar.map((u) => new URL(u).host))], ['yrcdvcsowblzmkpbmkut.supabase.co']);
  assert.doesNotMatch(cli, /wikidata\.org/); assert.match(adm, /https:\/\/www\.wikidata\.org\/w\/api\.php\?format=json&origin=\*/);
  assert.match(cli, /if \(!genel && \(e\.ctrlKey \|\| e\.metaKey\)/, 'dashboard\'daki Ctrl+K genel aramaya dokunulmaz');
  assert.doesNotMatch(cli, /innerHTML = [^;]*\+ t\.(tr|en|sade|akademik|ornek)\b/, 'terim metni kaçışsız yazılmaz');
});
test('yönetim: Sözlük sekmesi; toplu ekleme ayrıştırıcısı', () => {
  assert.match(read('js/admin-app.js'), /\{ k: 'sozluk', t: 'Sözlük' \}/);
  const h = read('admin.html'); assert.ok(h.includes('<script src="js/admin-sozluk.js"></script>') && h.includes('href="css/admin-sozluk.css"'));
  const w = { AXADM: { VIEWS: {}, X: (s) => s, $: () => null, $$: () => [] } }; w.window = w; vm.runInNewContext(adm, w);
  const o = w.AXSOZ_ADMIN_TEST;
  const c = o.topluCoz('amortisman ; depreciation ; muhasebe\nLikidite\tliquidity\tfinans, ekonomi\n\namortisman ; x\nxy ; y ; uzay');
  assert.deepEqual(JSON.parse(JSON.stringify(c.satir.map((r) => [r.tr, r.en, r.alan.join('+'), r.durum]))), [['amortisman', 'depreciation', 'muhasebe', 'taslak'], ['Likidite', 'liquidity', 'finans+ekonomi', 'taslak']]);
  assert.equal(c.hata.length, 1); assert.match(c.hata[0], /5\. satır: bilinmeyen alan "uzay"/);
  assert.deepEqual(JSON.parse(JSON.stringify(o.eksikler({ sade: 'a', akademik: ' ', ornek: '' }))), ['akademik', 'ornek']);
  assert.deepEqual(JSON.parse(JSON.stringify(o.wdOzet({ id: 'Q1', labels: { en: { value: 'variance' } }, descriptions: { en: { value: 'measure of dispersion' } } }))), { id: 'Q1', tr: '', en: 'variance', aciklama: 'measure of dispersion', dil: 'en' });
  assert.match(adm, /upsert\(c\.satir, \{ onConflict: 'anahtar', ignoreDuplicates: true \}\)/);
});
test('pencere: kapatınca gerçekten gizlenir ([hidden], display:flex kuralını ezer)', () => {
  const js = read('js/acadex-sozluk.js');
  assert.match(js, /\.asz-ort\[hidden\],\.asz-p\[hidden\],\.asz-p \[hidden\],\.asz-pop\[hidden\]\{display:none!important\}/);
  assert.ok(js.indexOf('.asz-ort[hidden]') < js.indexOf(".asz-p{position:fixed"), 'gizleme kuralı listede');
});

summary();
