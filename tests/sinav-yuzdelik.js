/* ==========================================================================
   ACADEX — SINAV YÜZDELİĞİ (tests/sinav-yuzdelik.js)

   NEDEN VAR (30.10.2026): karnede ders başına "yüzdelik sıran" (örnek UWorld /
   BoardVitals). supabase/migrations/20261030b_sinav_yuzdelik.sql:
     - ders anahtarı karneyle aynı (ders ağacında ders kodu, kartta ders etiketi)
     - ölçüt dersteki tamamlanmış denemelerin ortalaması; ikinci şans sayılmaz
     - gizlilik: 20 öğrenci altında yüzdelik yok; 5'in katına yuvarlanır;
       yalnızca çağıranın kendi dersleri döner; anon çağıramaz

   Çalıştırma:  ACADEX_PG="-h /tmp/pg -p 5499 -U postgres" node tests/sinav-yuzdelik.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { makeRunner } = require('./_ts-extract.js');
const { test, summary } = makeRunner();

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const MIG = 'supabase/migrations/20261030b_sinav_yuzdelik.sql';

test('kaynak: karne kancası ve gizlilik ilkeleri', () => {
  const sql = read(MIG), ink = read('js/acadex-ink.js'), html = read('dashboard.html');
  assert.match(sql, /security definer/);
  assert.match(sql, />= 20 then/);
  assert.match(sql, /\/ 5\) \* 5\)/);
  assert.match(sql, /revoke all on function public\.exam_peer_percentiles\(\) from public, anon;/);
  assert.doesNotMatch(sql, /returns table \([^)]*user_id/, 'kullanıcı kimliği dönmez');
  assert.match(ink, /sb\(\)\.rpc\('exam_peer_percentiles'\)/);
  assert.match(ink, /loadPeer\(\); paintPeer\(\);/);
  // ders anahtarı karneyle aynı: ders ağacı kodu, yoksa kart etiketi; büyük harf
  assert.match(ink, /if \(e\.source_type === 'course' && e\.course_code\) return 'c:' \+ String\(e\.course_code\)\.toUpperCase\(\);/);
  assert.match(sql, /upper\(btrim\(case when e\.source_type = 'course'/);
  assert.match(html, /<p class="sn-tnote sn-peer" data-peer="" hidden><\/p>/);
});

const SETUP = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
end $$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create table public.study_cards (id uuid primary key, course_tag text);
create table public.exams (id uuid primary key default gen_random_uuid(), user_id uuid, grade numeric, completed_at timestamptz,
  source_type text, course_code text, study_card_id uuid, scoring jsonb);
grant usage on schema public, auth to anon, authenticated;
`;
const u = (n) => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');

test('davranış (gerçek Postgres): yüzdelik, eşik, ikinci şans, kart etiketi, gizlilik', () => {
  const pg = process.env.ACADEX_PG;
  if (!pg) { console.log('    (ACADEX_PG yok: davranış testi atlandı)'); return; }
  const P = 'psql ' + pg + ' -q -v ON_ERROR_STOP=1 -t -A';
  const run = (s) => execSync(P + ' -d ax_pct', { input: s, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
  execSync(P + ' -d postgres -c "drop database if exists ax_pct" -c "create database ax_pct"', { stdio: 'pipe' });
  try {
    run(SETUP);
    execSync(P + ' -d ax_pct -f ' + JSON.stringify(path.join(ROOT, MIG)), { stdio: 'pipe' });
    execSync(P + ' -d ax_pct -f ' + JSON.stringify(path.join(ROOT, MIG)), { stdio: 'pipe' });
    // ITB101: 25 öğrenci, ortalamaları 4, 8, …, 100 (öğrenci n: 4n). Öğrenci 18 iki denemeyle 72 ortalama.
    const rows = [];
    for (let n = 1; n <= 25; n++) {
      if (n === 18) rows.push(`('${u(n)}', 60, now(), 'course', 'itb101'), ('${u(n)}', 84, now(), 'course', 'ITB101 ')`);
      else rows.push(`('${u(n)}', ${4 * n}, now(), 'course', 'ITB101')`);
    }
    run(`insert into exams (user_id, grade, completed_at, source_type, course_code) values ${rows.join(', ')};`);
    // ikinci şans (sayılmaz), bitmemiş (sayılmaz)
    run(`insert into exams (user_id, grade, completed_at, source_type, course_code, scoring) values ('${u(18)}', 0, now(), 'course', 'ITB101', '{"retry":[]}'), ('${u(18)}', 0, null, 'course', 'ITB101', '{}');`);
    // BF202: kart etiketiyle 3 öğrenci (eşik altı)
    run(`insert into study_cards values ('${u(900)}', ' bf202 '), ('${u(901)}', 'BF202');
insert into exams (user_id, grade, completed_at, source_type, study_card_id) values ('${u(18)}', 90, now(), 'study_card', '${u(900)}'), ('${u(2)}', 50, now(), 'study_card', '${u(901)}'), ('${u(3)}', 40, now(), 'study_card', '${u(901)}');`);
    const as = (n) => run(`set test.uid = '${u(n)}'; set role authenticated; select course || '|' || students || '|' || coalesce(percentile::text, '-') from public.exam_peer_percentiles();`).split('\n').filter(Boolean);
    // öğrenci 18: ortalama 72; öteki 24 öğrencinin 17'si (4..68) altında, eşit yok → 17/24 = %70,8 → 70
    assert.deepEqual(as(18), ['BF202|3|-', 'ITB101|25|70']);
    assert.deepEqual(as(25), ['ITB101|25|100'], 'en yüksek');
    assert.deepEqual(as(1), ['ITB101|25|0'], 'en düşük');
    assert.deepEqual(as(99), [], 'sınavı olmayan hiçbir ders görmez');
    // 20 eşiği: 6 öğrenci çıkınca 19 kalır → yüzdelik yok
    run(`delete from exams where user_id in ('${u(20)}','${u(21)}','${u(22)}','${u(23)}','${u(24)}','${u(25)}');`);
    assert.deepEqual(as(18), ['BF202|3|-', 'ITB101|19|-']);
    // anon çağıramaz
    assert.throws(() => run(`set role anon; select * from public.exam_peer_percentiles();`), /permission denied/);
  } finally {
    execSync(P + ' -d postgres -c "drop database if exists ax_pct"', { stdio: 'pipe' });
  }
});

summary();
