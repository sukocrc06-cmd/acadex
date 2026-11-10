/* ==========================================================================
   ACADEX — FORMULO TAMAMLAMA TESTLERİ (tests/formulo-bulut.js), 08.11.2026

   NEDEN VAR: Formulo entegrasyonunda iki iş yarım kalmıştı:
     1) "Acadia'ya sor" yapay zekâya bağlı değildi; öğrenciye "Tasarım sürümü…" bandı
        görünüyordu. Artık serbest sorular supabase/functions/formulo-hoca'ya gider;
        kesin işler (değerli hesap, örnek soru, ipucu modunda sonuç kontrolü) yerelde
        kalır; fonksiyon yoksa/geç kalırsa yerel cevaba düşer.
     2) Deste, hata defteri, skor, seri ve "kaldığın yer" yalnız tarayıcıdaydı. Artık
        formulo_ilerleme tablosunda hesaba yazılır (formulo/assets/formulo-bulut.js).
   Tarayıcı ucu (yapay zekâ cevabı, yedek cevap, iki cihaz arası deste, tablo yokken
   sessiz çalışma, masadaki kart) Playwright ile denendi.
   Çalıştırma:  node tests/formulo-bulut.js
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

/* bulut modülünü tarayıcısız yükle: yalnız saf birleştirme işlevleri sınanır */
function bulut() {
  const ls = {};
  const ctx = { window: {}, document: { readyState: 'loading', addEventListener() {}, dispatchEvent() {} }, localStorage: { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: (k) => { delete ls[k]; } }, setTimeout, clearTimeout, CustomEvent: function () {}, JSON, Date, Math, Array, Object };
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(read('formulo/assets/formulo-bulut.js'), ctx);
  return ctx.FOBULUT;
}
const J = (x) => JSON.parse(JSON.stringify(x));

test('birleştirme: ilk eşitlemede deste/hata/skor/seri/son kaybolmadan birleşir', () => {
  const B = bulut();
  const m = J(B.birlestir(
    { veri: { deste: ['a', 'b'], hata: [{ id: 'x', tip: 'kolay', ts: 5 }], skor: { calc1: { d: 2, t: 4, s: 1 } }, seri: { n: 2, gun: 'g1' }, son: { id: 'a', ts: 10 } }, zaman: {} },
    { veri: { deste: ['b', 'c'], hata: [{ id: 'y', tip: 'orta', ts: 9 }, { id: 'x', tip: 'kolay', ts: 5 }], skor: { calc1: { d: 5, t: 9, s: 0 }, fiz1: { d: 1, t: 1, s: 1 } }, seri: { n: 4, gun: 'g2' }, son: { id: 'c', ts: 20 } }, zaman: {} }));
  assert.deepEqual(m.veri.deste, ['a', 'b', 'c']);
  assert.deepEqual(m.veri.hata.map((h) => h.id), ['y', 'x'], 'tekrar yok, yeni önce');
  assert.equal(m.veri.skor.calc1.t, 9); assert.equal(m.veri.skor.fiz1.t, 1);
  assert.equal(m.veri.seri.n, 4); assert.equal(m.veri.son.id, 'c');
  for (const k of ['deste', 'hata', 'skor', 'seri', 'son']) assert.ok(m.zaman[k] > 0, k + ' zamanı');   /* iki tarafta da olmayan anahtar (istat, rozet…) zamansız kalır */
});

test('birleştirme: eşitlendikten sonra son değişen kazanır (silinen geri gelmez)', () => {
  const B = bulut();
  const m = J(B.birlestir({ veri: { deste: ['a'], hata: [] }, zaman: { deste: 200, hata: 50 } }, { veri: { deste: ['a', 'b'], hata: [{ id: 'z', tip: 'zor', ts: 1 }] }, zaman: { deste: 100, hata: 80 } }));
  assert.deepEqual(m.veri.deste, ['a'], 'yerelde silinen b geri gelmedi');
  assert.equal(m.veri.hata.length, 1, 'uzakta daha yeni hata defteri kazandı');
  const t = J(B.birlestir({ veri: {}, zaman: {} }, { veri: { deste: ['q'] }, zaman: { deste: 7 } }));
  assert.deepEqual(t.veri.deste, ['q'], 'yeni cihaz hesaptakini alır');
  const y = J(B.birlestir({ veri: { deste: ['w'] }, zaman: {} }, { veri: {}, zaman: {} }));
  assert.deepEqual(y.veri.deste, ['w'], 'hesap boşsa yerel kalır');
  assert.equal(J(B.ILK.hata(Array.from({ length: 50 }, (_, i) => ({ id: 'a' + i, tip: 't', ts: i })), Array.from({ length: 50 }, (_, i) => ({ id: 'b' + i, tip: 't', ts: 100 + i })))).length, 60, 'hata defteri 60 kayıt');
});

test('kayıt kancası: koy() üç betikte de bulutu haberdar eder; açılış sırası doğru', () => {
  for (const f of ['formulo/assets/formulo.js', 'formulo/assets/formulo-soru.js', 'formulo/assets/formulo-kart.js'])
    assert.match(read(f), /function koy\(k, v\) \{ try \{ localStorage\.setItem\('formulo\.' \+ k, JSON\.stringify\(v\)\); \} catch \(e\) \{ \} if \(W\.FOBULUT\) W\.FOBULUT\.degisti\(k\); \}/, f);
  const fo = read('formulo/assets/formulo.js');
  assert.match(fo, /function kur\(\) \{\n    deste = al\('deste', \[\]\);/, 'birleşme formulo.js yüklenirken olmuş olabilir');
  assert.match(fo, /D\.addEventListener\('formulo:bulut', function \(\) \{/);
  assert.match(read('formulo/assets/formulo-kart.js'), /D\.addEventListener\('formulo:bulut', function \(\) \{ sonYaz\(\); seriYaz\(\); \}\);/);
  const h = read('formulo/index.html'), dash = read('dashboard.html');
  assert.ok(h.indexOf('assets/formulo-bulut.js') > h.indexOf('assets/kapi.js') && h.indexOf('assets/formulo-bulut.js') < h.indexOf('assets/formulo.js'));
  assert.ok(dash.indexOf('formulo/assets/formulo-bulut.js') > 0 && dash.indexOf('formulo/assets/formulo-bulut.js') < dash.indexOf('<script src="formulo/assets/formulo-kart.js"'));
  assert.ok(dash.indexOf('js/supabase-config.js') < dash.indexOf('formulo/assets/formulo-bulut.js'));
});

test('tablo: yalnız kendi satırı (RLS), hesap silinince silinir, boyut sınırı', () => {
  const s = read('supabase/migrations/20261108_formulo_ilerleme.sql');
  assert.match(s, /user_id\s+uuid primary key references auth\.users\(id\) on delete cascade/);
  assert.match(s, /enable row level security/);
  for (const p of ['for select to authenticated using \\(auth\\.uid\\(\\) = user_id\\)', 'for insert to authenticated with check \\(auth\\.uid\\(\\) = user_id\\)', 'for update to authenticated using \\(auth\\.uid\\(\\) = user_id\\) with check \\(auth\\.uid\\(\\) = user_id\\)']) assert.match(s, new RegExp(p));
  assert.match(s, /revoke all on public\.formulo_ilerleme from anon;/);
  assert.match(s, /pg_column_size\(veri\) < 262144/);
  assert.doesNotMatch(s, /for delete|for all/, 'istemci satır silemez');
  assert.match(read('formulo/assets/formulo-bulut.js'), /var TABLO = 'formulo_ilerleme';/);
});

test('Acadia’ya sor: tasarım bandı kalktı; kesin işler yerelde, serbest soru yapay zekâya', () => {
  const s = read('formulo/assets/formulo-sor.js');
  assert.doesNotMatch(s, /Tasarım sürümü|Design build|Siteye eklenince|Once integrated/);
  assert.match(s, /sb\.functions\.invoke\('formulo-hoca', \{ body: body \}\)/);
  assert.match(s, /setTimeout\(function \(\) \{ r\(null\); \}, 9000\)/, '9 sn sonra yerel cevaba düşer');
  assert.match(s, /else bitir\(yanitla\(metin, d\.id, ipucu, durum\)\);/, 'yapay zekâ yoksa yerel cevap');
  /* yönlendirme: formulo-sor.js'i yükleyip yerelMi'yi gerçek veriyle dene */
  const ctx = { window: {}, document: { createElement: () => ({ set innerHTML(v) { this._h = v; }, querySelector: () => null, textContent: '' }) }, Math, JSON, Object, Array, String, Number, parseFloat, isFinite, Promise, setTimeout };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(read('formulo/assets/formulo-veri.js'), ctx); vm.runInContext(read('formulo/assets/formulo-veri-ek.js'), ctx);
  vm.runInContext(s, ctx);
  const S = ctx.FORMULO_SOR, menzil = ctx.FORMULO.formuller.find((f) => f.id === 'menzil');
  assert.equal(S.yerelMi('v0=20 th=45 için menzil hesapla', 'fiz1', {}), true, 'değerli hesap yerelde');
  assert.equal(S.yerelMi('bana örnek bir soru ver', 'fiz1', {}), true, 'örnek soru yerelde');
  assert.equal(S.yerelMi('12,5', 'fiz1', { bekleyen: { f: menzil, r: 12.5 } }), true, 'ipucu modunda sonuç kontrolü yerelde');
  assert.equal(S.yerelMi('menzil neden 45 derecede en büyük?', 'fiz1', {}), false, 'kavram sorusu yapay zekâya');
  assert.equal(S.yerelMi('kısmi integrasyonda u yu nasıl seçerim', 'calc2', {}), false);
});

test('formulo-hoca: oturum, karakter kuralları, model ve sınırlar', () => {
  const f = read('supabase/functions/formulo-hoca/index.ts');
  assert.match(f, /await uc\.auth\.getUser\(\)/); assert.match(f, /if \(!auth\) return json\(\{ error: 'Oturum yok\.' \}, 401\)/);
  assert.match(f, /Deno\.env\.get\('GROQ_API_KEY'\)/);
  assert.match(f, /model, temperature: 0\.3, max_completion_tokens: 900, reasoning_effort: 'low', response_format: \{ type: 'json_object' \}/);
  assert.match(f, /run\('openai\/gpt-oss-120b'\)/); assert.match(f, /run\('openai\/gpt-oss-20b'\)/);
  assert.match(f, /İPUCU MODU AÇIK: cevabı ya da sonucu söyleme/);
  assert.match(f, /öğretmen, sınıf, ödev, not ya da birine iletme lafı etme/, 'ürün kuralı: insan öğretmen yok');
  assert.match(f, /Sayısal sonucu kendin hesaplama/);
  assert.match(f, /const fid = typeof out\.formul_id === 'string' && ids\.has\(out\.formul_id\)/, 'yalnız gönderilen formül kimliği kabul');
  assert.match(f, /\.slice\(0, 6\)\.map\(\(f: any\)/); assert.match(f, /kes\(b\.soru, 400\)/);
  assert.doesNotMatch(f, /SERVICE_ROLE/, 'veri tabanına yazmaz');
});

summary();
