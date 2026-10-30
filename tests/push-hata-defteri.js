/* ==========================================================================
   ACADEX — HATA DEFTERİ TELEFON HATIRLATMASI (tests/push-hata-defteri.js)

   NEDEN VAR (30.10.2026): zamanı gelen yanlışlar yalnızca bildirim çanında
   görünüyordu. supabase/migrations/20261030_push_hata_defteri.sql push_daily'ye
   hata defteri dalı ekler; takvimi SQL'de (exam_mistakes_due) yeniden yazar.
     - SQL takvimi js/exam-engine.js mistakeStates ile AYNI sayıyı vermeli
       (aynı sınavlar, birçok "şimdi" anında karşılaştırılır).
     - Günde bir hatırlatma kuralı: seri notu gittiyse hata defteri notu gitmez;
       yalnızca son 24 saatte zamanı gelen yanlış varsa gider; "study" kapalıysa
       gitmez.

   Çalıştırma:  ACADEX_PG="-h /tmp/pg -p 5499 -U postgres" node tests/push-hata-defteri.js
   (ACADEX_PG yoksa yalnızca kaynak denetimleri koşar.)
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
const MIG = 'supabase/migrations/20261030_push_hata_defteri.sql';
const MIG_DONE = 'supabase/migrations/20261030c_hata_defteri_ogrendim.sql';
const sql = read(MIG);
const E = require(path.join(ROOT, 'js', 'exam-engine.js'));

test('kaynak: push_daily 20261029 sürümünün aynısı + hata defteri dalı; yetkiler kapalı', () => {
  const old = read('supabase/migrations/20261029_web_push.sql');
  const body = (s) => s.slice(s.indexOf('create or replace function public.push_daily()'), s.indexOf('end $$;', s.indexOf('create or replace function public.push_daily()')));
  const strip = (s) => body(s).replace(/\n\s*mis_due int; mis_fresh int;/, '').replace(/\n\s*-- 30\.10\.2026: hata defterinde[\s\S]*?\n    end if;\n(?=    if k = 0 and due >=)/, '\n');
  assert.equal(strip(sql), body(old), 'push_daily yalnızca hata defteri dalıyla farklı');
  assert.match(sql, /when 'exam' then 'study' when 'mistakes' then 'study'/);
  assert.match(sql, /revoke all on function public\.exam_mistakes_due\(uuid, timestamptz\), public\.push_pref_ok\(uuid, text\), public\.push_daily\(\)\n\s+from public, anon, authenticated;/);
  assert.match(read('js/admin-app.js'), /mistakes: 'Hata defteri'/, 'yönetim paneli türü tanır');
});

test('"öğrendim" (30.10.2026): takvim, eski tarayıcı kaydı, hazırlık, çan ve salon kancaları', () => {
  const ex = [{ id: 'e1', completed_at: '2026-10-20T10:00:00Z', question_results: [{ question_id: 5, score: 0 }, { question_id: 9, score: 20 }, { question_id: 2, score: 100 }] }];
  assert.deepEqual(Object.keys(E.mistakeStates(ex)).sort(), ['e1:5', 'e1:9']);
  assert.deepEqual(Object.keys(E.mistakeStates(ex, { done: ['e1:9'] })), ['e1:5']);
  // eski kayıt sıra numarasıyla: "e1:1" → 2. sonuç → soru 9
  assert.deepEqual(E.learnedKeys(ex, ['e1:1', 'yok:0', 'bozuk'], [{ exam_id: 'e2', question_id: 3 }]).sort(), ['e1:9', 'e2:3']);
  const R = E.examReadiness(ex, ex, 5, { done: ['e1:5', 'e1:9'], now: Date.parse('2026-10-25T10:00:00Z') });
  assert.equal(R.mistakes, 0, 'hazırlık kartı öğrenilenleri açık yanlış saymaz');
  const dash = read('js/dashboard.js'), ink = read('js/acadex-ink.js'), mig = read(MIG_DONE);
  assert.match(dash, /E\.mistakeReminder\(E\.mistakeStates\(exs, \{ done: learned \}\)/);
  assert.match(ink, /learnSave\(id, true\)/);
  assert.match(ink, /learnSave\(id, false\)/);
  assert.match(ink, /E\.examReadiness\(d\.ex, EX, n, \{ done: learnedList\(\) \}\)/);
  assert.match(mig, /with check \(user_id = auth\.uid\(\) and exists \(select 1 from public\.exams e where e\.id = exam_id and e\.user_id = auth\.uid\(\)\)\)/);
  // exam_mistakes_due: önceki sürümün aynısı + öğrendim koşulu
  const fn = (t) => t.slice(t.indexOf('create or replace function public.exam_mistakes_due'), t.indexOf('$$;', t.indexOf('create or replace function public.exam_mistakes_due')));
  assert.equal(fn(mig).replace(/\n\s+and not exists \(select 1 from public\.exam_mistakes_done d\n[^\n]*\)/, ''), fn(sql));
});

// ---------------------------------------------------------------------------
// Senaryo: JS ile aynı sınavlar
// ---------------------------------------------------------------------------
const D = 86400000, T0 = Date.parse('2026-10-20T09:00:00Z');
const at = (d) => new Date(T0 + d * D).toISOString();
const UID = 'aaaaaaaa-0000-0000-0000-000000000001', OTHER = 'bbbbbbbb-0000-0000-0000-000000000002';
const uuid = (n) => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');
const src = (n, day, scores, extra) => Object.assign({ id: uuid(n), completed_at: at(day), scoring: { option_count: 4 },
  question_results: scores.map((s, i) => ({ question_id: i + 1, type: 'multiple_choice', score: s })) }, extra || {});
const retry = (n, day, items, scores) => ({ id: uuid(n), completed_at: at(day), scoring: { retry: items.map(([e, q]) => ({ exam_id: uuid(e), question_id: q })) },
  question_results: scores.map((s, i) => ({ question_id: i + 1, type: 'multiple_choice', score: s })) });
const EXAMS = [
  src(1, 0, [0, 100, 40, null, 70]),               // yanlış: 1, 3, 4 (puansız)
  src(2, 2, [20, 0]),                              // yanlış: 1, 2
  retry(10, 1.5, [[1, 1], [1, 3]], [100, 30]),     // 1:1 doğru, 1:3 yanlış
  retry(11, 4.6, [[1, 1], [2, 1]], [90, 100]),     // 1:1 ikinci doğru → kazanıldı; 2:1 doğru
  retry(12, 5, [[1, 3]], [79]),                    // 79 doğru sayılmaz
  src(3, 6, [100, 100]),                           // yanlışsız
  { id: uuid(4), completed_at: null, scoring: {}, question_results: [{ question_id: 1, score: 0 }] } // bitmemiş
];
const NOWS = [0.5, 1.2, 2.4, 3.1, 4.7, 5.9, 6.2, 7.8, 9];

function jsCounts(nowDay) {
  const now = T0 + nowDay * D;
  const done = EXAMS.filter(e => e.completed_at && Date.parse(e.completed_at) <= now);
  const st = E.mistakeStates(done, { now });
  let due = 0, fresh = 0;
  Object.keys(st).forEach(k => {
    const m = st[k];
    if (m.won) return;
    const ripe = m.attempts.length ? m.dueAt : m.at + D;
    if (ripe <= now) { due++; if (ripe > now - D) fresh++; }
  });
  return { due, fresh };
}

const lit = (v) => v == null ? 'null' : "'" + String(typeof v === 'string' ? v : JSON.stringify(v)).replace(/'/g, "''") + "'";
const insertExams = (list, maxDay) => list.filter(e => !e.completed_at || Date.parse(e.completed_at) <= T0 + maxDay * D)
  .map(e => `insert into public.exams (id, user_id, completed_at, scoring, question_results) values (${lit(e.id)}, '${UID}', ${e.completed_at ? lit(e.completed_at) : 'null'}, ${lit(e.scoring)}::jsonb, ${lit(e.question_results)}::jsonb);`).join('\n');

test('davranış (gerçek Postgres): SQL takvimi JS ile aynı; push_daily günde bir, yeni yanlışta, tercihe uyar', () => {
  const pg = process.env.ACADEX_PG;
  if (!pg) { console.log('    (ACADEX_PG yok: davranış testi atlandı)'); return; }
  const P = 'psql ' + pg + ' -q -v ON_ERROR_STOP=1 -t -A', q = (f) => JSON.stringify(path.join(ROOT, f));
  const run = (s) => execSync(P + ' -d ax_mist', { input: s, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
  execSync(P + ' -d postgres -c "drop database if exists ax_mist" -c "create database ax_mist"', { stdio: 'pipe' });
  try {
    for (const f of ['tests/sql/web-push-stub.sql', 'supabase/migrations/20261028_canli_destek.sql', 'supabase/migrations/20261029_web_push.sql', MIG, MIG, MIG_DONE, MIG_DONE]) execSync(P + ' -d ax_mist -f ' + q(f), { stdio: 'pipe' });
    run(`insert into auth.users values ('${UID}'); insert into profiles (id, full_name) values ('${UID}', 'Ayşe');`);
    // Her "şimdi" anında yalnızca o ana kadar biten sınavlar (JS ile aynı).
    for (const d of NOWS) {
      run('delete from public.exams;\n' + insertExams(EXAMS, d));
      const [due, fresh] = run(`select due || ',' || fresh from public.exam_mistakes_due('${UID}', ${lit(at(d))}::timestamptz);`).split(',').map(Number);
      assert.deepEqual({ due, fresh }, jsCounts(d), `gün ${d}`);
    }

    // push_daily: abonelik + şimdiki saat; bugün gelmiş (seri notu yok), kart yok
    run(`delete from public.exams;
insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ('${UID}', 'https://fcm.googleapis.com/fcm/send/M1', repeat('B',87), repeat('a',22));
update profiles set last_active_date = (now() at time zone 'Europe/Istanbul')::date,
  notification_prefs = jsonb_build_object('study_hour', extract(hour from now() at time zone 'Europe/Istanbul')::int) where id = '${UID}';`);
    const daily = () => { run('delete from push_outbox; select public.push_daily();'); return run("select coalesce(string_agg(kind || '|' || title, ';'), '') from push_outbox;"); };
    // 1) yanlış yok → hiçbir şey
    assert.equal(daily(), '');
    // 2) 30 saat önce biten sınavda 2 yanlış (6 saat önce zamanı geldi) → hata defteri notu
    run(`insert into public.exams (user_id, completed_at, scoring, question_results) values ('${UID}', now() - interval '30 hours', '{}', '[{"question_id":1,"score":0},{"question_id":2,"score":20},{"question_id":3,"score":100}]');`);
    assert.equal(daily(), 'mistakes|Hata defterinde 2 yanlış tekrar zamanında');
    assert.equal(run("select url from push_outbox;"), '/dashboard.html?tab=exams#hata-defteri');
    // 3) aynı gün ikinci çalıştırma: gönderilmiş satır tekrar kuyruğa girmez
    run("update push_outbox set sent_at = now(); select public.push_daily();");
    assert.equal(run("select count(*) from push_outbox;"), '1');
    // 4) zamanı 24 saatten eski yanlışlar her gün çalmaz
    run(`update public.exams set completed_at = now() - interval '3 days';`);
    assert.equal(daily(), '');
    // 5) seri notu gidecekse (dün gelmiş) hata defteri notu gitmez
    run(`update public.exams set completed_at = now() - interval '30 hours';
update profiles set last_active_date = (now() at time zone 'Europe/Istanbul')::date - 1, current_streak = 4 where id = '${UID}';`);
    assert.equal(daily(), 'study|4 günlük serin bu gece biter');
    // 6) study kapalı → hiçbiri
    run(`update profiles set last_active_date = (now() at time zone 'Europe/Istanbul')::date, notification_prefs = notification_prefs || '{"study":false}' where id = '${UID}';`);
    assert.equal(daily(), '');
    // 7) "öğrendim": 2 yanlıştan biri işaretlenince bildirim 1 der; öğrenci yalnızca kendi sınavını işaretler
    run(`update profiles set notification_prefs = jsonb_build_object('study_hour', extract(hour from now() at time zone 'Europe/Istanbul')::int) where id = '${UID}';
insert into auth.users values ('${OTHER}');
insert into public.exams (id, user_id, completed_at, scoring, question_results) values ('${uuid(77)}', '${OTHER}', now() - interval '30 hours', '{}', '[{"question_id":1,"score":0}]');
grant select on public.exams to authenticated;`);
    const myExam = run(`select id from public.exams where user_id = '${UID}' limit 1;`);
    run(`set test.uid = '${UID}'; set role authenticated; insert into public.exam_mistakes_done (exam_id, question_id) values ('${myExam}', 2);`);
    assert.equal(daily(), 'mistakes|Hata defterinde 1 yanlış tekrar zamanında');
    assert.throws(() => run(`set test.uid = '${UID}'; set role authenticated; insert into public.exam_mistakes_done (exam_id, question_id) values ('${uuid(77)}', 1);`), /row-level security/, 'başkasının sınavı');
    run(`insert into public.exam_mistakes_done (user_id, exam_id, question_id) values ('${OTHER}', '${uuid(77)}', 1);`);
    assert.equal(run(`set test.uid = '${UID}'; set role authenticated; select count(*) from public.exam_mistakes_done;`), '1', 'yalnızca kendi satırları');
    assert.throws(() => run(`set role anon; select * from public.exam_mistakes_done;`), /permission denied/);
    // ikisi de öğrenildi → bildirim yok
    run(`set test.uid = '${UID}'; set role authenticated; insert into public.exam_mistakes_done (exam_id, question_id) values ('${myExam}', 1);`);
    assert.equal(daily(), '');
    // 8) yetki: istemci çağıramaz
    assert.throws(() => run(`set role authenticated; select * from public.exam_mistakes_due('${UID}');`), /permission denied/);
  } finally {
    execSync(P + ' -d postgres -c "drop database if exists ax_mist"', { stdio: 'pipe' });
  }
});

summary();
