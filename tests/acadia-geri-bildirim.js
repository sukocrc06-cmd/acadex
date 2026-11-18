/* ==========================================================================
   ACADEX — ACADIA GERİ BİLDİRİM (tests/acadia-geri-bildirim.js), 18.11.2026

   NEDEN VAR: Kaynakla çalış sohbetinde her cevabın altında 👍 / 👎 var; Acadia'nın
   cevaplayamadığı sorular da kendiliğinden kaydolur. Yönetim paneli bunları
   listeler ki neyi cevaplayamadığını görüp düzeltelim.
   Bu dosya şunları korur:
     - öğrenci yalnız kendi satırını ekler/görür; başkasınınkini göremez
     - öğrenci yalnız puanı değiştirebilir (soru, cevap, sahip sabit)
     - yalnız yönetici hepsini görür, siler, 180 günden eskileri temizler
     - boş kayıt yok: ya puan ya hata olmalı; uzunluk sınırları
     - öğrenci tarafı tablo yokken bozulmaz; panel süzgeçleri doğru sayar
   Davranış:  ACADEX_PG="-h /tmp/pg -p 5499 -U postgres" node tests/acadia-geri-bildirim.js
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
const MIG = 'supabase/migrations/20261118c_acadia_geri_bildirim.sql';
const sql = read(MIG), ogr = read('js/acadex-acadia-geri.js'), adm = read('js/admin-acadia.js'), dash = read('dashboard.html'), admh = read('admin.html'), dj = read('js/dashboard.js');

test('bağlı: sohbet düğmeleri dashboard\'da, liste yönetim panelinde', () => {
  assert.ok(dash.indexOf('src="js/acadex-ink.js"') < dash.indexOf('src="js/acadex-acadia-geri.js"'), 'ink sarmalayıcısından sonra');
  assert.ok(admh.indexOf('src="js/admin-app.js"') < admh.indexOf('src="js/admin-acadia.js"'));
  assert.match(read('js/admin-app.js'), /\{ k: 'acadia', t: 'Acadia geri bildirim' \}/);
  assert.match(dj, /window\.AXGERI\.hata\(cardId, text, errMsg\)/, 'sunucu hatası kaydolur');
  assert.match(dj, /window\.__acadiaSon = \{ kart: cardId, soru: text, model: data\.model/);
});

test('öğrenci tarafı: tablo yoksa sessiz; yalnız kendi tablosuna yazar', () => {
  assert.match(ogr, /tabloYok = true/);
  assert.ok(!/service_role|SERVICE_ROLE/.test(ogr));
  assert.equal((ogr.match(/from\('([a-z_]+)'\)/g) || []).filter((x) => !/acadia_geri_bildirim/.test(x)).length, 0);
});

test('panel süzgeçleri ve özet', () => {
  const win = { AXADM: { VIEWS: {}, X: (s) => String(s), NF: String, $: () => null, sb: {}, toast() {}, errMsg: String } };
  const ctx = { window: win }; vm.createContext(ctx); vm.runInContext(adm, ctx);
  const T = win.AXACADIA_ADMIN_TEST;
  const l = [{ puan: 1, soru: 'MNC nedir', model: 'gemini-3.5-flash-lite' }, { puan: -1, soru: 'örnek ver' }, { hata: 'kota', soru: 'FIFO' }, { puan: 1, soru: 'x', model: 'gemini-3.5-flash-lite' }];
  assert.equal(T.suz(l, 'sorun').length, 2);
  assert.equal(T.suz(l, 'hata').length, 1);
  assert.equal(T.suz(l, 'hepsi', 'örnek').length, 1);
  const o = T.ozet(l);
  assert.equal(o.memnun, 67); assert.equal(o.hata, 1); assert.equal(o.model['gemini-3.5-flash-lite'], 2);
});

test('davranış (gerçek Postgres): sahiplik, yalnız puan değişir, yönetici temizler', () => {
  const pg = process.env.ACADEX_PG;
  if (!pg) { console.log('    (ACADEX_PG yok: davranış testi atlandı)'); return; }
  const P = 'psql ' + pg + ' -q -v ON_ERROR_STOP=1';
  execSync(P + ' -d postgres -c "drop database if exists ax_agb" -c "create database ax_agb"', { stdio: 'pipe' });
  try {
    const run = (s) => execSync(P + ' -d ax_agb -At -f -', { input: s, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
    run("do $$ begin if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if; if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if; end $$;" +
      " create schema auth; create table auth.users (id uuid primary key);" +
      " create function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('test.uid', true), '')::uuid $f$;" +
      " grant usage on schema auth to authenticated, anon; grant select on auth.users to authenticated;" +
      " create table public.study_cards (id uuid primary key); grant select on public.study_cards to authenticated;" +
      " create function public.admin_ok() returns boolean language sql as $f$ select coalesce(current_setting('test.admin', true), '0') = '1' $f$; grant usage on schema public to anon, authenticated;" +
      " insert into auth.users values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');");
    for (let i = 0; i < 2; i++) execSync(P + ' -d ax_agb -f ' + JSON.stringify(path.join(ROOT, MIG)), { stdio: 'pipe' });
    const A = "set role authenticated; set test.admin = '0'; set test.uid = '00000000-0000-0000-0000-00000000000a';";
    const B = "set role authenticated; set test.admin = '0'; set test.uid = '00000000-0000-0000-0000-00000000000b';";
    const id = run(A + " insert into acadia_geri_bildirim (soru, cevap, puan) values ('MNC nedir', 'çok uluslu şirket', 1) returning id;");
    run(A + " insert into acadia_geri_bildirim (soru, hata) values ('örnek ver', 'AI returned invalid JSON formatting');");
    assert.throws(() => run(A + " insert into acadia_geri_bildirim (soru) values ('boş');"), 'puan ya da hata şart');
    assert.throws(() => run(A + " insert into acadia_geri_bildirim (soru, puan) values ('x', 5);"), 'puan yalnız -1/1');
    assert.throws(() => run(A + " insert into acadia_geri_bildirim (user_id, soru, puan) values ('00000000-0000-0000-0000-00000000000b', 'x', 1);"), 'başkası adına yazılmaz');
    assert.throws(() => run("set role anon; insert into acadia_geri_bildirim (soru, puan) values ('x', 1);"), 'girişsiz yazılmaz');
    assert.equal(run(A + ' select count(*) from acadia_geri_bildirim;'), '2');
    assert.equal(run(B + ' select count(*) from acadia_geri_bildirim;'), '0', 'başkasının kaydı görünmez');
    run(A + ` update acadia_geri_bildirim set puan = -1, soru = 'değişti', cevap = 'değişti' where id = '${id}';`);
    assert.equal(run(`select puan || '|' || soru || '|' || cevap from acadia_geri_bildirim where id = '${id}'`), '-1|MNC nedir|çok uluslu şirket', 'yalnız puan değişir');
    assert.equal(run(B + ` update acadia_geri_bildirim set puan = 1 where id = '${id}' returning 1;`), '', 'başkası puanlayamaz');
    assert.equal(run(A + ` delete from acadia_geri_bildirim where id = '${id}' returning 1;`), '', 'öğrenci silemez');
    assert.throws(() => run(A + ' select acadia_geri_bildirim_temizle();'), 'temizlik yalnız yönetici');
    assert.equal(run("set role authenticated; set test.admin = '1'; set test.uid = '00000000-0000-0000-0000-00000000000b'; select count(*) from acadia_geri_bildirim;"), '2', 'yönetici hepsini görür');
    run(`set test.admin = '1'; update acadia_geri_bildirim set created_at = now() - interval '200 days' where id = '${id}'`);
    assert.equal(run("set role authenticated; set test.admin = '1'; select acadia_geri_bildirim_temizle();"), '1');
    assert.equal(run('select count(*) from acadia_geri_bildirim'), '1');
    run("delete from auth.users where id = '00000000-0000-0000-0000-00000000000a'");
    assert.equal(run('select count(*) from acadia_geri_bildirim'), '0', 'hesap silinince kayıtları da silinir');
  } finally {
    execSync(P + ' -d postgres -c "drop database if exists ax_agb"', { stdio: 'pipe' });
  }
});

summary();
