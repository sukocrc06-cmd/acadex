/* ==========================================================================
   ACADEX — ÖDEV HAZIRLAMA TESTLERİ (tests/exam-assignments.js)

   Faz 6.2 (27.10.2026): öğretmen ödev taslağı, düzenleme, yayın.
     - generate-exam { assignmentDraft: true }: sınav kaydı AÇMAZ, öğrenci
       sınav sınırına sayılmaz, yalnızca etkin öğretmene (assignment_gen_take),
       akıllı deneme ve süreli prova kapalı
     - öğrenci ödev tablosunu okuyamaz (sorular cevap anahtarı taşır)
     - yayınlanan ödevin soruları kilitli; yalnızca tarih ve kapatma
     - ayarlar sunucuda sınırlara çekilir (bilinmeyen anahtar atılır)
     - kodun hesapladığı sorular (hesap, ifade, çizim, grafikli) elle düzenlenmez
     - ön yüzün çağırdığı fonksiyon ve parametre adları migration ile aynı

   Davranış testi: tests/sql/faz6-odevler.sql (ACADEX_PG verilirse)
   Çalıştırma:  node tests/exam-assignments.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { readSource, makeRunner } = require('./_ts-extract.js');

const { test, summary } = makeRunner();
const MIG = 'supabase/migrations/20261027b_sinav_faz6_odevler.sql';
const sql = readSource(MIG);
const gen = readSource('supabase/functions/generate-exam/index.ts');
const ink = readSource('js/acadex-ink.js');
const dash = readSource('js/dashboard.js');
const html = readSource('dashboard.html');
const fnBody = (name) => { const i = sql.indexOf('function public.' + name + '('); assert.ok(i >= 0, name); return sql.slice(i, sql.indexOf('end $$;', i)); };
const defined = [...sql.matchAll(/create or replace function public\.([a-z_]+)\(([^)]*)\)/g)]
  .map(m => ({ name: m[1], params: m[2].split(',').map(p => p.trim().split(/\s+/)[0]).filter(Boolean) }));

test('taslak kipi: sınav kaydı yok, öğretmen kapısı, öğrenci sınırına sayılmaz', () => {
  assert.match(gen, /const draftMode = assignmentDraft === true/);
  assert.match(gen, /const adaptive = draftMode \? null : adaptiveRaw/);
  assert.match(gen, /const resolvedIsSimulation = !draftMode && !!isSimulation/);
  assert.match(gen, /if \(draftMode\) \{\s*const \{ data: okTake, error: takeErr \} = await userClient\.rpc\('assignment_gen_take'\)/);
  assert.match(gen, /if \(!draftMode\) try \{/);
  const i = gen.indexOf('// FAZ 6.2: ödev taslağı — kayıt yok');
  const j = gen.indexOf('const examInsertPayload');
  assert.ok(i > 0 && i < j, 'taslak dönüşü sınav kaydından önce');
  const block = gen.slice(i, j);
  assert.match(block, /draft: true,\s*questions: finalQuestions/);
  assert.ok(!/\.insert\(/.test(block));
});

test('ödev tablosu: öğrenciye kapalı, yazma yalnızca fonksiyonla', () => {
  assert.match(sql, /revoke all on public\.assignments, public\.assignment_gen_log from anon, authenticated;/);
  assert.match(sql, /grant select on public\.assignments to authenticated;/);
  const pols = [...sql.matchAll(/create policy "[^"]+" on public\.assignments for (\w+) to authenticated\s+using \(([^;]+)\);/g)];
  assert.equal(pols.length, 1);
  assert.equal(pols[0][1], 'select');
  assert.match(pols[0][2], /public\.is_class_teacher\(class_id\) or public\.current_is_admin\(\)/);
});

test('öğretmen işlemleri sınıf sahipliği ister; yayın sonrası sorular kilitli', () => {
  for (const n of ['assignment_save', 'assignment_publish', 'assignment_set_dates', 'assignment_close', 'assignment_delete']) {
    assert.match(fnBody(n), /if a\.id is null or not public\.is_class_teacher\(a\.class_id\) then raise exception/, n);
  }
  assert.match(fnBody('assignment_create'), /if not public\.is_class_teacher\(p_class\) then raise exception/);
  assert.match(fnBody('assignment_save'), /if a\.status <> 'draft' then raise exception/);
  assert.match(fnBody('assignment_delete'), /if a\.status <> 'draft' then raise exception/);
  assert.match(fnBody('assignment_gen_take'), /if not public\.current_is_active_teacher\(\) then return false; end if;/);
  assert.match(fnBody('assignment_gen_take'), />= 20 then return false/);
});

test('yayın denetimi: metin, şık, doğru cevap, son teslim', () => {
  const ans = fnBody('assignment_check_answers');
  assert.match(ans, /sorunun metni boş/);
  assert.match(ans, /doğru şık seçilmedi/);
  assert.match(ans, /aynı şık iki kez var/);
  assert.match(ans, /çizim sorusunun cevabı yok/);
  assert.match(ans, /elsif t <> 'open_ended' and ca = '' then/);
  assert.match(fnBody('assignment_publish'), /a\.due_at < now\(\) \+ interval '10 minutes'/);
  assert.match(fnBody('assignment_check_questions'), /jsonb_array_length\(q\) > 40/);
});

test('ayarlar sınırlara çekilir', () => {
  const b = fnBody('assignment_clean_settings');
  assert.match(b, /'attempts', least\(greatest\(at, 1\), 3\)/);
  assert.match(b, /'time_limit_minutes', case when tl is null or tl <= 0 then null else least\(greatest\(tl, 5\), 300\) end/);
  assert.match(b, /'late_penalty_pct', least\(greatest\(lp, 1\), 50\)/);
  assert.match(b, /'show_answers', case when s->>'show_answers' in \('after_submit', 'after_due', 'never'\)/);
  assert.match(b, /return jsonb_build_object\(/); // yalnızca bilinen anahtarlar
});

test('ön yüz: taslak kancası sınavı başlatmaz', () => {
  assert.match(dash, /const asgDraft = window\.__examAssignmentDraft && typeof window\.__examAssignmentDraft\.done === 'function'/);
  assert.match(dash, /requestBody\.assignmentDraft = true;\s*requestBody\.isSimulation = false;\s*delete requestBody\.adaptive;/);
  const i = dash.indexOf('if (asgDraft) {\n      if (data && data.draft');
  const j = dash.indexOf("showDashboardAlert('success', 'Sınav başarıyla oluşturuldu!');");
  assert.ok(i > 0 && i < j, 'taslak dalı sınav başlatmadan önce dönüyor');
  assert.match(dash.slice(i, j), /return;/);
  assert.match(html, /<p class="sn-asg-ban" data-asg-ban="" hidden><\/p>/);
  assert.match(html, /<dialog class="sn-dlg sn-wide sn-asg-dlg" data-asgdlg=""/);
  assert.match(ink, /window\.__examAssignmentDraft = on \? \{ done: onDraft \} : null;/);
  assert.match(ink, /bdDlg\.addEventListener\('close', function \(\) \{ if \(asgMode\) \{ asgMode = null; asgUi\(false\); \} \}\);/);
});

test('kodun hesapladığı sorular elle düzenlenmez', () => {
  assert.match(ink, /var EDITABLE = \{ multiple_choice: 1, true_false: 1, fill_blank: 1, open_ended: 1 \};/);
  assert.match(ink, /var ed = !locked && EDITABLE\[q\.type\] && !q\.chart/);
});

test('ön yüzün çağırdığı ödev fonksiyonları ve parametreleri migration ile uyumlu', () => {
  const start = ink.indexOf('/* ---------- FAZ 6.2: ödev hazırlama');
  const block = ink.slice(start, ink.indexOf('var paintAll = function () { paintCal();', start));
  const calls = [...block.matchAll(/rpc\('([a-z_]+)', (?:asgPayload\(\)|\{([^}]*)\})/g)];
  const seen = new Set();
  for (const c of calls) {
    const def = defined.find(d => d.name === c[1]); assert.ok(def, c[1]);
    seen.add(c[1]);
    for (const k of [...String(c[2] || '').matchAll(/(p_[a-z_]+):/g)].map(m => m[1])) assert.ok(def.params.includes(k), c[1] + ': ' + k);
  }
  for (const n of ['assignment_create', 'assignment_save', 'assignment_publish', 'assignment_set_dates', 'assignment_close', 'assignment_delete']) assert.ok(seen.has(n), n);
  const payload = block.slice(block.indexOf('var asgPayload'), block.indexOf('var saveAsg'));
  const keys = [...payload.matchAll(/(p_[a-z_]+):/g)].map(m => m[1]);
  assert.deepEqual(keys, defined.find(d => d.name === 'assignment_save').params);
});

test('rubrik ayrıştırma 100\'e ölçekler (sunucudaki normalizeRubric gibi)', () => {
  const src = ink.slice(ink.indexOf('var parseRubric = function'), ink.indexOf('var genOne = async function'));
  const parseRubric = new Function(src + '; return parseRubric;')();
  assert.deepEqual(parseRubric('3 | Tanım\n1 | Örnek\nsaçma'), [{ criterion: 'Tanım', points: 75 }, { criterion: 'Örnek', points: 25 }]);
  assert.equal(parseRubric('5 | tek madde'), null);
  const r = parseRubric('1 | a\n1 | b\n1 | c');
  assert.equal(r.reduce((s, x) => s + x.points, 0), 100);
});

test('davranış testi (Postgres + RLS)', () => {
  const pg = process.env.ACADEX_PG;
  if (!pg) { console.log('    (ACADEX_PG yok: davranış testi atlandı)'); return; }
  const root = path.join(__dirname, '..');
  const P = 'psql ' + pg + ' -q -v ON_ERROR_STOP=1';
  execSync(P + ' -d postgres -c "drop database if exists ax_t62" -c "create database ax_t62"', { stdio: 'pipe' });
  try {
    for (const f of ['tests/sql/_supabase-stub.sql', 'supabase/migrations/20261027_sinav_faz6_siniflar.sql', MIG, MIG]) execSync(P + ' -d ax_t62 -f ' + JSON.stringify(path.join(root, f)), { stdio: 'pipe' });
    const out = execSync(P + ' -d ax_t62 -f ' + JSON.stringify(path.join(root, 'tests/sql/faz6-odevler.sql')), { stdio: 'pipe' }).toString();
    assert.match(out, /HEPSI GECTI/);
  } finally { execSync(P + ' -d postgres -c "drop database if exists ax_t62"', { stdio: 'pipe' }); }
});

summary();
