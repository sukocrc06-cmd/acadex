/* ==========================================================================
   ACADEX — SINIFLAR TESTLERİ (tests/exam-classes.js)

   Faz 6.1 (27.10.2026): öğretmen yetkisi, sınıf, katılım kodu.
   Hoca paneli 19.10.2026'da kaldırılmıştı; öğretmen DAR yetkiyle döndü:
     - 2026-07'den kalan geniş öğretmen politikaları kaldırılır (canlıda hâlâ
       duruyorlardı: her öğretmen tüm öğrencilerin kartlarını okuyabiliyordu)
     - sınıf tablolarına doğrudan yazma yok; yalnızca fonksiyonlar
     - öğretmen kadroda e-posta görmez; oauth- yer tutucu numara gizli
     - yanlış kod denemesi hata FIRLATMAZ, döndürür (fırlatılırsa deneme
       kaydı da geri alınır ve saatte 20 sınırı hiç dolmaz)
     - ön yüzün çağırdığı her fonksiyon ve parametre adı migration'da var

   Davranış testi (gerçek Postgres, RLS ile): tests/sql/faz6-siniflar.sql
   ACADEX_PG ortam değişkeni psql bağlantı argümanlarını verirse koşar, yoksa atlanır:
     ACADEX_PG="-h /var/tmp/axpg -p 5499 -U postgres" node tests/exam-classes.js

   Çalıştırma:  node tests/exam-classes.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { readSource, makeRunner } = require('./_ts-extract.js');

const { test, summary } = makeRunner();
const MIG = 'supabase/migrations/20261027_sinav_faz6_siniflar.sql';
const sql = readSource(MIG);
const ink = readSource('js/acadex-ink.js');
const admin = readSource('js/admin-app.js');
const html = readSource('dashboard.html');

const fnBody = (name) => {
  const i = sql.indexOf('function public.' + name + '(');
  assert.ok(i >= 0, name + ' tanımı yok');
  const j = sql.indexOf('end $$;', i);
  return sql.slice(i, j < 0 ? undefined : j);
};
const defined = [...sql.matchAll(/create or replace function public\.([a-z_]+)\(([^)]*)\)/g)]
  .map(m => ({ name: m[1], params: m[2].split(',').map(p => p.trim().split(/\s+/)[0]).filter(Boolean) }));

test('eski geniş öğretmen politikaları kaldırılıyor', () => {
  for (const [pol, tbl] of [['study_cards_teacher_select_dept', 'study_cards'], ['exams_teacher_select_dept', 'exams'],
    ['exams_teacher_update_dept', 'exams'], ['documents_teacher_select_dept', 'documents'], ['teacher_materials_teacher_manage_own', 'teacher_materials']]) {
    assert.ok(sql.includes(`drop policy if exists "${pol}" on public.${tbl};`), pol);
  }
});

test('sınıf tablolarında yalnızca okuma politikası; yazma yetkisi yok', () => {
  const pols = [...sql.matchAll(/create policy "[^"]+" on public\.(classes|class_members|class_join_fails) for (\w+)/g)];
  assert.ok(pols.length >= 2);
  for (const p of pols) assert.equal(p[2], 'select', p[0]);
  assert.match(sql, /revoke all on public\.classes, public\.class_members, public\.class_join_fails from anon, authenticated;/);
  assert.match(sql, /grant select on public\.classes, public\.class_members to authenticated;/);
  for (const t of ['classes', 'class_members', 'class_join_fails']) assert.match(sql, new RegExp('alter table public\\.' + t + ' enable row level security'));
});

test('her fonksiyon security definer + sabit search_path', () => {
  const heads = [...sql.matchAll(/create or replace function public\.([a-z_]+)\([^)]*\)\s*returns[^$]*?as \$\$/g)];
  assert.ok(heads.length >= 14);
  for (const h of heads) {
    assert.match(h[0], /security definer/, h[1]);
    assert.match(h[0], /set search_path to 'public'/, h[1]);
  }
});

test('çağrılabilir fonksiyonlar yalnızca authenticated; kod üreteci kimseye açık değil', () => {
  const grantList = sql.slice(sql.indexOf('foreach f in array array['), sql.indexOf('loop', sql.indexOf('foreach f in array array[')));
  for (const f of defined) {
    if (f.name === 'class_gen_code') continue;
    assert.ok(grantList.includes("'" + f.name + '('), f.name + ' yetki listesinde yok');
  }
  assert.match(sql, /revoke all on function public\.class_gen_code\(\) from public, anon, authenticated;/);
  assert.match(sql, /revoke all on function public\.%s from public, anon/);
});

test('öğretmen işlemleri sınıf sahipliği + etkin öğretmen ister', () => {
  for (const n of ['class_update', 'class_new_code', 'class_roster', 'class_remove_member']) {
    assert.match(fnBody(n), /if not public\.is_class_teacher\(p_class\) then raise exception/, n);
  }
  assert.match(fnBody('class_create'), /if not public\.current_is_active_teacher\(\) then raise exception/);
  assert.match(fnBody('is_class_teacher'), /current_is_active_teacher\(\)\s+and exists \(select 1 from public\.classes where id = p_class and teacher_id = auth\.uid\(\)\)/);
  assert.match(fnBody('current_is_active_teacher'), /is_teacher and not is_suspended/);
});

test('yönetici fonksiyonları admin_guard ve denetim kaydı', () => {
  assert.match(fnBody('admin_set_teacher'), /perform public\.admin_guard\(\);/);
  assert.match(fnBody('admin_set_teacher'), /admin_log\('set_is_teacher'/);
  assert.match(fnBody('admin_set_teacher'), /if not p_value then update classes set join_open = false where teacher_id = p_id/);
  assert.match(fnBody('admin_teacher_status'), /perform public\.admin_guard\(\);/);
});

test('kadro: e-posta yok, oauth yer tutucu numara gizli', () => {
  const b = fnBody('class_roster');
  assert.ok(!/email/.test(b));
  assert.match(b, /case when p\.student_number like 'oauth-%' then null else p\.student_number end/);
});

test('yanlış kod: deneme kaydı tutulur, hata döndürülür (fırlatılmaz), saatte 20 sınırı', () => {
  const b = fnBody('class_join');
  const miss = b.slice(b.indexOf('insert into class_join_fails'), b.indexOf('end if;', b.indexOf('insert into class_join_fails')));
  assert.match(miss, /return json_build_object\('error',/);
  assert.ok(!/raise exception/.test(miss));
  assert.match(b, /interval '1 hour'\) >= 20 then/);
  assert.match(b, /upper\(regexp_replace\(coalesce\(p_code, ''\), '\[\^A-Za-z0-9\]', '', 'g'\)\)/);
  assert.match(b, /k\.teacher_id = auth\.uid\(\) then raise exception/);
});

test('katılım kodu: 32 karakterli alfabe (I, O, 0, 1 yok), 6 hane, rastgele bayttan', () => {
  const b = fnBody('class_gen_code');
  const alpha = b.match(/alpha constant text := '([A-Z0-9]+)'/)[1];
  assert.equal(alpha.length, 32);
  assert.ok(!/[IO01]/.test(alpha));
  assert.match(b, /for i in 0\.\.5 loop/);
  assert.match(b, /get_byte\(b, i\) % 32/);
  assert.match(sql, /join_code ~ '\^\[A-HJ-NP-Z2-9\]\{6\}\$'/);
});

test('ön yüzün çağırdığı her fonksiyon ve parametre migration ile uyumlu', () => {
  const start = ink.indexOf('/* ---------- FAZ 6.1: sınıflar');
  assert.ok(start > 0);
  const block = ink.slice(start, ink.indexOf('var paintAll = function () { paintCal();', start));
  const calls = [...block.matchAll(/(?:rpc|run)\('([a-z_]+)'(?:, (?:to \? )?\{([^}]*)\})?/g)];
  assert.ok(calls.length >= 9, 'çağrı sayısı ' + calls.length);
  const seen = new Set();
  for (const c of calls) {
    const def = defined.find(d => d.name === c[1]);
    assert.ok(def, c[1] + ' migration\'da yok');
    seen.add(c[1]);
    const keys = [...String(c[2] || '').matchAll(/(p_[a-z_]+):/g)].map(m => m[1]);
    for (const k of keys) assert.ok(def.params.includes(k), c[1] + ' parametresi yok: ' + k);
  }
  for (const n of ['my_classes', 'class_join', 'class_create', 'class_update', 'class_new_code', 'class_roster', 'class_remove_member', 'class_leave', 'class_set_share']) assert.ok(seen.has(n), n + ' çağrılmıyor');
});

test('ön yüz: SQL yoksa bölüm gizli kalır; öğrenci onayı varsayılan kapalı', () => {
  assert.match(html, /<section class="sn-cls" aria-labelledby="cls-t" data-classes="" hidden>/);
  assert.match(html, /<dialog class="sn-dlg" data-clsdlg=""/);
  assert.match(ink, /if \(r\.error\) \{ if \(!rpcMissing\(r\.error\)\) console\.warn\('acadex-ink: sınıflar yüklenemedi', r\.error\); clsEl\.hidden = true; return; \}/);
  assert.match(sql, /share_mastery boolean not null default false/);
  assert.match(ink, /data-cl-share=""' \+ \(k\.share_mastery \? ' checked' : ''\)/);
});

test('yönetim paneli öğretmen yetkisini ayrı RPC ile verir', () => {
  assert.match(admin, /rpc\('admin_teacher_status', \{ p_id: p\.id \}\)/);
  assert.match(admin, /rpc\('admin_set_teacher', \{ p_id: p\.id, p_value: !on \}\)/);
  assert.match(admin, /set_is_teacher: 'Öğretmen yetkisi'/);
});

test('davranış testi (Postgres + RLS)', () => {
  const pg = process.env.ACADEX_PG;
  if (!pg) { console.log('    (ACADEX_PG yok: davranış testi atlandı)'); return; }
  const root = path.join(__dirname, '..');
  const P = 'psql ' + pg + ' -q -v ON_ERROR_STOP=1';
  execSync(P + ' -d postgres -c "drop database if exists ax_t6" -c "create database ax_t6"', { stdio: 'pipe' });
  try {
    execSync(P + ' -d ax_t6 -f ' + JSON.stringify(path.join(root, 'tests/sql/_supabase-stub.sql')), { stdio: 'pipe' });
    execSync(P + ' -d ax_t6 -f ' + JSON.stringify(path.join(root, MIG)), { stdio: 'pipe' });
    execSync(P + ' -d ax_t6 -f ' + JSON.stringify(path.join(root, MIG)), { stdio: 'pipe' }); // iki kez: zararsız
    const out = execSync(P + ' -d ax_t6 -f ' + JSON.stringify(path.join(root, 'tests/sql/faz6-siniflar.sql')), { stdio: 'pipe' }).toString();
    assert.match(out, /HEPSI GECTI/);
  } finally {
    execSync(P + ' -d postgres -c "drop database if exists ax_t6"', { stdio: 'pipe' });
  }
});

summary();
