/* ==========================================================================
   ACADEX — YÖNETİM PANELİ · FİNANS TESTLERİ (tests/finans-panel.js)

   NEDEN VAR (04.11.2026): "Planlar ve kota" (yakında kartı) yerini Finans
   bölümüne bıraktı: Pano · Planlar ve kota · Maliyet · Gider · Simülatör ·
   Görevler · Rapor. Finans ekibi (Sudegül Kurt) için "finans" rolü açıldı:
   yönetici değildir; yalnız Finans ve Acadex ekibini (salt okunur) görür,
   öğrencilerin kişisel verisine erişemez.
     - Yetki veritabanındadır (fin_ok / current_is_admin); panel yalnız gösterir.
     - Migration iyzico tabloları yoksa durur (önce 20261028_odeme_iyzico.sql).
   Davranış (gerçek Postgres; ACADEX_PG verilirse):
     ACADEX_PG="-h /tmp/pg -p 5499 -U postgres" node tests/finans-panel.js
   Çalıştırma:  node tests/finans-panel.js
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
const MIG = 'supabase/migrations/20261104_finans.sql', IYZ = 'supabase/migrations/20261028_odeme_iyzico.sql';
const sql = read(MIG), adm = read('js/admin-app.js'), fin = read('js/admin-finans.js'), html = read('admin.html'), css = read('css/admin-finans.css');

test('migration: iyzico tabloları yoksa durur; kişi verisi ve gizli anahtar yok', () => {
  assert.match(sql, /to_regclass\('public\.plan_prices'\) is null[\s\S]*raise exception 'Önce supabase\/migrations\/20261028_odeme_iyzico\.sql/);
  assert.doesNotMatch(sql, /service_role|sk_live|@gmail|@acadex/i);
  assert.doesNotMatch(sql, /insert into public\.staff_roles \(user_id, role, granted_by\) values \('/); // rol elle verilir, dosyada kimse yok
  assert.match(sql, /role in \('finans'\)/);
  assert.match(sql, /alter table public\.staff_roles enable row level security/);
});
test('migration: her fin_* fonksiyonu yetkiyi kendisi denetler; yönetici-özel olanlar current_is_admin ister', () => {
  const fns = [...sql.matchAll(/create or replace function public\.(fin_[a-z_]+)\(/g)].map((m) => m[1]);
  for (const f of ['fin_overview', 'fin_set_limit', 'fin_set_price', 'fin_coupons', 'fin_upsert_coupon', 'fin_quota_watch', 'fin_history', 'fin_grant_plan', 'fin_staff', 'fin_set_staff']) assert.ok(fns.includes(f), f);
  const body = (f) => sql.slice(sql.indexOf('function public.' + f + '('), sql.indexOf('end $$;', sql.indexOf('function public.' + f + '(')));
  for (const f of ['fin_overview', 'fin_set_limit', 'fin_set_price', 'fin_coupons', 'fin_upsert_coupon', 'fin_quota_watch', 'fin_history']) assert.match(body(f), /if not public\.fin_ok\(\) then raise exception 'yetki yok'/, f);
  for (const f of ['fin_grant_plan', 'fin_staff', 'fin_set_staff']) assert.match(body(f), /if not public\.current_is_admin\(\) then raise exception 'yetki yok'/, f);
  // finans rolü öğrencinin adını görmez: baş harfler
  assert.match(body('fin_quota_watch'), /case when adm then p\.full_name else regexp_replace/);
  assert.match(body('fin_quota_watch'), /case when adm then s\.user_id end/);
  // tablolar: yalnız fin_ok; anon hiçbir şey
  for (const t of ['fin_costs', 'fin_expenses', 'fin_budgets', 'fin_tasks', 'fin_notes', 'fin_scenarios']) assert.ok(sql.includes("'" + t + "'"), t);
  assert.match(sql, /using \(public\.fin_ok\(\)\) with check \(public\.fin_ok\(\)\)/);
  assert.match(sql, /revoke all on public\.%I from anon/);
  assert.match(sql, /revoke all on function public\.fin_log\(text, text, jsonb\) from public, anon, authenticated/);
  // ekip şeması: finans yalnız okur
  assert.match(sql, /create policy ax_teams_fin_read on public\.ax_teams for select/);
  assert.doesNotMatch(sql, /on public\.ax_(teams|people) for (all|insert|update|delete)/);
});
test('panel: "Planlar ve kota" yerine Finans; eski #plans bağlantısı Finans\'a gider', () => {
  assert.doesNotMatch(adm, /k: 'plans'/);
  assert.match(adm, /\{ g: 'ACADEX' \}, \{ k: 'finans', t: 'Finans' \}/);
  assert.match(adm, /if \(k === 'plans'\) k = 'finans';/);
  assert.doesNotMatch(adm, /VIEWS\.plans = /);
  assert.ok(html.indexOf('js/admin-app.js') < html.indexOf('js/admin-finans.js'), 'finans dosyası admin-app.js\'ten sonra yüklenir');
  assert.match(html, /css\/admin-finans\.css/);
  // boot, admin-finans.js yüklendikten sonra (DOMContentLoaded) başlar; yoksa finans görünümü kayıtlı olmadan açılır
  assert.match(adm, /if \(document\.readyState === 'loading'\) document\.addEventListener\('DOMContentLoaded', boot\); else boot\(\);/);
  assert.match(adm, /window\.AXADM = \{ VIEWS: VIEWS/);
  for (const t of ['pano', 'planlar', 'maliyet', 'gider', 'sim', 'gorev', 'rapor']) assert.match(fin, new RegExp("\\['" + t + "', '"), t);
});
test('panel: finans rolü yalnız Finans + Acadex ekibi; yönetici RPC\'leri çağrılmaz; ekip düğmeleri gizli', () => {
  assert.match(adm, /if \(!who \|\| !\(who\.is_admin \|\| who\.is_finance\)\) \{ notAdminView/);
  assert.match(adm, /var FIN_NAV = \{ finans: 1, ekip: 1 \};/);
  assert.match(adm, /if \(FIN_ONLY\(\) && !FIN_NAV\[k\]\) k = 'finans';/);
  // start(): finans rolünde admin_settings / refreshCounts / supPulse çağrılmadan döner
  const st = adm.slice(adm.indexOf('var start = function'), adm.indexOf("document.addEventListener('click'", adm.indexOf('var start = function')));
  assert.ok(st.indexOf('if (FIN_ONLY()) {') > -1 && st.indexOf('if (FIN_ONLY()) {') < st.indexOf("rpc('admin_settings')"));
  assert.match(adm, /if \(ME && !FIN_ONLY\(\)\) supPulse\(\);/);
  for (const id of ['#ek-newp', '#ek-newt', '#ekc-edit', '#ekt-edit', '#ekt-addp', '#ekt-del', '#ekp-del']) assert.ok(css.includes('body.fin-only ' + id), id);
});
test('panel: para kuruş olarak yazılır; yüzde Türkçe biçimde (%7,5)', () => {
  const ctx = {}; vm.createContext(ctx);
  const pick = (a, b) => fin.slice(fin.indexOf(a), fin.indexOf(b, fin.indexOf(a)));
  vm.runInContext(pick('  var TL = ', '  var ym = '), ctx);
  assert.equal(vm.runInContext("kurus('119.90')", ctx), 11990);
  assert.equal(vm.runInContext("kurus('119,9')", ctx), 11990);
  assert.ok(Number.isNaN(vm.runInContext("kurus('abc')", ctx)));
  assert.equal(vm.runInContext('PCT(0.075)', ctx), '%7,5');
  assert.match(vm.runInContext('TL(11990, true)', ctx), /119,90/);
});
test('simülatör: büyüme, kayıp ve başabaş doğru hesaplanır', () => {
  const ctx = { cost: (k) => ({ kdv: 20, odeme_komisyon: 0 })[k] || 0 }; vm.createContext(ctx);
  vm.runInContext(fin.slice(fin.indexOf('  var simRun = '), fin.indexOf('  var simChart = ')), ctx);
  const base = { users: 1000, growth: 0, conv: 10, prem: 0, pLite: 120, pPrem: 0, churn: 0, disc: 0, pages: 0, ai: 0, fixed: 5000, mkt: 0 };
  let r = vm.runInContext('simRun(' + JSON.stringify(base) + ')', ctx);
  assert.equal(r.rows.length, 12);
  assert.equal(Math.round(r.rows[0].net), 10000); // 100 ödeyen × 120 TL ÷ 1,20
  assert.equal(r.be, 0);
  assert.equal(Math.round(r.rows[11].cash), 60000);
  r = vm.runInContext('simRun(' + JSON.stringify(Object.assign({}, base, { conv: 4 })) + ')', ctx); // 40 × 100 = 4000 < 5000
  assert.equal(r.be, null);
  r = vm.runInContext('simRun(' + JSON.stringify(Object.assign({}, base, { conv: 4, growth: 10 })) + ')', ctx);
  assert.ok(r.be > 0 && r.be < 12, 'büyüyünce başabaşa ulaşır');
  r = vm.runInContext('simRun(' + JSON.stringify(Object.assign({}, base, { churn: 50 })) + ')', ctx);
  assert.equal(Math.round(r.rows[1].paying), 50);
});
test('davranış: öğrenci giremez, finans rolü panoyu görür ama rol veremez ve plan veremez', () => {
  const pg = process.env.ACADEX_PG;
  if (!pg) { console.log('    (ACADEX_PG yok: davranış testi atlandı)'); return; }
  const P = 'psql ' + pg + ' -q -v ON_ERROR_STOP=1', db = 'ax_finans';
  execSync(P + ' -d postgres -c "drop database if exists ' + db + '" -c "create database ' + db + '"', { stdio: 'pipe' });
  const run = (s, ok = true) => { try { return execSync(P + ' -d ' + db + ' -At -f -', { input: s, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim(); } catch (e) { if (ok) throw new Error(String(e.stderr)); return 'HATA:' + String(e.stderr); } };
  const as = (uid, s) => 'set role authenticated; set t.uid = \'' + uid + '\'; ' + s;
  const A = '00000000-0000-0000-0000-00000000000a', FN = '00000000-0000-0000-0000-00000000000f', S = '00000000-0000-0000-0000-000000000001';
  try {
    run(`do $$ begin create role anon; exception when others then null; end $$; do $$ begin create role authenticated; exception when others then null; end $$;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('t.uid', true), '')::uuid $f$;
      create function auth.jwt() returns jsonb language sql stable as $f$ select '{}'::jsonb $f$;
      create extension if not exists pgcrypto;
      create table public.profiles(id uuid primary key references auth.users, email text, full_name text, department text, created_at timestamptz default now(), last_active_date date, is_admin boolean default false);
      create table public.plan_limits(plan text primary key, monthly_pages int, max_pages_per_doc int, visual_analysis bool, updated_at timestamptz default now());
      insert into plan_limits values ('lite', 300, 150, false), ('premium', 5000, 1000, true);
      create table public.user_plans(user_id uuid primary key, plan text references plan_limits, valid_until timestamptz, updated_at timestamptz default now());
      create table public.summary_usage(user_id uuid, period date, pages_used int, docs_used int, cache_hits int, updated_at timestamptz default now(), primary key(user_id, period));
      create table public.admin_audit_log(id uuid primary key default gen_random_uuid(), actor_id uuid, actor_name text, action text, target_user_id uuid, target_label text, details jsonb, created_at timestamptz default now());
      create function public.current_is_admin() returns boolean language sql stable security definer as $f$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $f$;
      create function public.admin_ok() returns boolean language sql stable as $f$ select public.current_is_admin() $f$;
      create table public.ax_teams(id serial primary key, name text); create table public.ax_people(id serial primary key, full_name text);
      alter table ax_teams enable row level security; alter table ax_people enable row level security;
      grant usage on schema public, auth to authenticated; grant select on ax_teams, ax_people to authenticated;
      insert into auth.users values ('${A}'), ('${FN}'), ('${S}');
      insert into profiles(id, email, full_name, is_admin, last_active_date) values ('${A}', 'adm@ornek.test', 'Yönetici', true, current_date), ('${FN}', 'fin@ornek.test', 'Finans Kişi', false, current_date), ('${S}', 'ogr@ornek.test', 'Ayşe Nur Yılmaz', false, current_date);
      insert into summary_usage values ('${S}', date_trunc('month', now())::date, 280, 9, 2);`);
    assert.match(run('', true) + execSync(P + ' -d ' + db + ' -f ' + JSON.stringify(path.join(ROOT, MIG)) + ' 2>&1 || true', { stdio: 'pipe' }).toString(), /Önce supabase\/migrations\/20261028_odeme_iyzico\.sql/);
    for (const f of [IYZ, MIG, MIG]) execSync(P + ' -d ' + db + ' -f ' + JSON.stringify(path.join(ROOT, f)), { stdio: 'pipe' });
    // öğrenci
    assert.match(run(as(S, 'select fin_overview();'), false), /yetki yok/);
    assert.match(run(as(S, "insert into fin_expenses(category, amount_kurus) values ('diger', 100);"), false), /row-level security/);
    assert.match(run(as(S, "select fin_set_staff('fin@ornek.test', true);"), false), /yetki yok/);
    // yönetici rol verir
    assert.match(run(as(A, "select fin_set_staff('fin@ornek.test', true);")), /Finans Kişi/);
    assert.match(run(as(A, "select fin_set_staff('yok@ornek.test', true);"), false), /kayıtlı bir Acadex hesabı yok/);
    // finans rolü
    assert.match(run(as(FN, 'select admin_whoami();')), /"is_admin" : false, "is_finance" : true, "role" : "finans"/);
    assert.match(run(as(FN, 'select fin_overview();')), /"users_total" : 3/);
    assert.match(run(as(FN, 'select fin_quota_watch();')), /"user_id":null,"who":"A\. N\. Y\."/);
    assert.equal(run(as(FN, "insert into fin_expenses(category, amount_kurus, vendor) values ('altyapi', 125000, 'Vercel'); select count(*) from fin_expenses;")), '1');
    run(as(FN, "select fin_set_limit('lite', 320, 150, false); select fin_set_price('lite', 'month', 12900, 30, true); select fin_upsert_coupon('kampus25', 'Kampüs', 25, 100, null, true);"));
    assert.match(run(as(FN, 'select fin_coupons();')), /"code" : "KAMPUS25"/);
    assert.match(run(as(FN, "select fin_upsert_coupon('kampüs', '', 25, null, null, true);"), false), /kod 3–24/);
    assert.match(run(as(FN, "select fin_grant_plan('" + S + "', 'premium', 7, 'x');"), false), /yetki yok/);
    assert.match(run(as(FN, 'select fin_staff();'), false), /yetki yok/);
    assert.match(run(as(FN, "insert into ax_teams(name) values ('x');"), false), /permission denied|row-level security/);
    assert.match(run(as(FN, 'select fin_history();')), /"action" : "fin_price"[\s\S]*"once": \{"gun": 30, "aktif": true, "kurus": 11900\}/);
    assert.equal(run('select count(*) from admin_audit_log;'), '4');
    // rol geri alınınca erişim biter
    run(as(A, "select fin_set_staff('fin@ornek.test', false);"));
    assert.match(run(as(FN, 'select fin_overview();'), false), /yetki yok/);
  } finally {
    execSync(P + ' -d postgres -c "drop database if exists ' + db + '"', { stdio: 'pipe' });
  }
});
test('hesap açma (05.11.2026): yalnız sunucuda, yönetici şartı, şifre saklanmaz, ilk girişte değişir', () => {
  const fn = read('supabase/functions/staff-create-account/index.ts');
  assert.match(fn, /if \(!me\?\.is_admin\) return json\(\{ error: 'Yetki yok/);
  assert.match(fn, /email_confirm: true/);
  assert.match(fn, /must_change_password: true/);
  // davet ve rol çağıranın oturumuyla: yetki ve denetim kaydı veritabanından geçer
  assert.match(fn, /userClient\.rpc\('admin_invite_add'/); assert.match(fn, /userClient\.rpc\('fin_set_staff'/);
  assert.doesNotMatch(fn, /details: \{[^}]*password/, 'şifre kayda yazılmaz');
  assert.doesNotMatch(fn, /console\.(log|error)\([^)]*password/, 'şifre loga yazılmaz');
  assert.match(fn, /crypto\.getRandomValues/); assert.doesNotMatch(fn, /Math\.random/);
  // tarayıcı: gizli anahtar yok, işlev adıyla çağrılır, şifre bir kez gösterilir
  assert.doesNotMatch(fin + adm, /service_role|SERVICE_ROLE/);
  assert.match(fin, /sb\.functions\.invoke\('staff-create-account'/);
  assert.match(fin, /Bu şifre bir daha gösterilmez\./);
  assert.match(fin, /d\.password = null;/);
  // ilk giriş: geçici şifre değişmeden panel açılmaz
  const boot = adm.slice(adm.indexOf('var boot = async function'), adm.indexOf('ME = who; start();'));
  assert.match(boot, /must_change_password\) \{ pwChangeView\(who\); return; \}/);
  assert.match(adm, /sb\.auth\.updateUser\(\{ password: p, data: \{ must_change_password: false \} \}\)/);
});
summary();
