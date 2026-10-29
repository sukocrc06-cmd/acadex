/* ==========================================================================
   ACADEX — SINAV KAYDI KORUMASI VE ÖĞRETMENSİZ ŞEMA (tests/sinav-kaydi-koruma.js)

   Platformda insan öğretmen yok (29.10.2026): sınıf, ödev, öğretmen yetkisi,
   öğretmen notu, "öğretmene ilet" itirazı ve Campuso girişi tamamen kaldırıldı.
   Bu dosya iki şeyi tutar:
     - exams satırı koruması (20261028d): öğrenci kendi satırında puanlama
       alanlarını, süre/gerçek sınav ayarını ve sahibini değiştiremez
     - kaldırma (20261029d) hem temiz hem eski şemada hatasız, tekrar
       çalıştırılabilir; kalan yönetim fonksiyonları silinen sütunlara dokunmaz
     - kodda öğretmen sisteminin izi kalmaz (geri gelmesin diye)

   Davranış testi: tests/sql/sinav-kaydi-koruma.sql (ACADEX_PG verilirse)
   Çalıştırma:  node tests/sinav-kaydi-koruma.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { readSource, makeRunner } = require('./_ts-extract.js');
const { test, summary } = makeRunner();

const ROOT = path.join(__dirname, '..');
const GUARD = 'supabase/migrations/20261028d_sinav_kaydi_koruma.sql';
const REMOVE = 'supabase/migrations/20261029d_ogretmen_sistemi_kaldir.sql';

test('koruma: süre, gerçek sınav ayarı ve sahip de yalnızca sunucuda', () => {
  const mig = readSource(GUARD);
  for (const c of ['grade', 'answers', 'question_results', 'scoring', 'user_id', 'is_simulation', 'time_limit_seconds'])
    assert.match(mig, new RegExp('or new\\.' + c + ' is distinct from old\\.' + c + '|new\\.' + c + ' is distinct from old\\.' + c), c);
  assert.doesNotMatch(mig, /assignment|attempt_no|teacher/);
});

test('kaldırma: tek işlem, kalan fonksiyonlar önce yeniden tanımlanır, sonunda iz denetimi', () => {
  const sql = readSource(REMOVE);
  assert.match(sql, /^begin;$/m); assert.match(sql, /^commit;$/m);
  const at = s => sql.indexOf(s);
  for (const fn of ['exams_guard_grading_fields', 'protect_profile_flags', 'admin_delete_user', 'admin_announce_save'])
    assert.ok(at('create or replace function public.' + fn) > 0 && at('create or replace function public.' + fn) < at('drop column if exists is_teacher'), fn + ' sütunlar silinmeden önce');
  for (const t of ['classes', 'class_members', 'class_join_fails', 'assignments', 'assignment_gen_log', 'exam_hidden_results', 'teacher_materials'])
    assert.match(sql, new RegExp('drop table if exists public\\.' + t + ' cascade'), t);
  assert.match(sql, /check \(status in \('open', 'accepted', 'rejected'\)\)/);
  assert.match(sql, /Öğretmen sisteminden iz kaldı/);
});

test('kodda öğretmen sistemi izi yok', () => {
  const files = ['js/acadex-ink.js', 'js/dashboard.js', 'js/exam-engine.js', 'js/auth.js', 'js/i18n.js', 'js/site-status.js', 'dashboard.html', 'login.html', 'css/acadex-ink.css',
    'supabase/functions/generate-exam/index.ts', 'supabase/functions/grade-exam/index.ts', 'supabase/functions/exam-appeal/index.ts'];
  const bad = /is_teacher|teacher_materials|teacher_note|teacher_review|my_classes|my_assignments|assignmentStart|assignmentDraft|assignment_id|exam_hidden_results|campuso|data-fb="escalate"|'escalate'|öğretmene ilet|register-academic|sso-callback|teacher\.html/i;
  for (const f of files) {
    const src = readSource(f), m = src.match(bad);
    assert.equal(m, null, f + ': ' + (m && m[0]));
  }
  // yönetim paneli: öğretmen yetkisi düğmesi yok (denetim kaydındaki eski eylem adları yalnızca etiket)
  assert.doesNotMatch(readSource('js/admin-app.js'), /admin_set_teacher|admin_teacher_status|d-teach/);
  for (const f of ['teacher.html', 'register-academic.html', 'sso-callback.html', 'js/teacher.js', 'js/admin.js', 'supabase/functions/campuso-sso', 'supabase/functions/notify-role-change'])
    assert.equal(fs.existsSync(path.join(ROOT, f)), false, f + ' silinmiş olmalı');
});

test('Postgres: koruma ve öğretmensiz şema (iki kez kaldırma)', () => {
  const pg = process.env.ACADEX_PG;
  if (!pg) { console.log('    (ACADEX_PG yok: davranış testi atlandı)'); return; }
  const P = 'psql ' + pg + ' -q -v ON_ERROR_STOP=1';
  execSync(P + ' -d postgres -c "drop database if exists ax_guard" -c "create database ax_guard"', { stdio: 'pipe' });
  try {
    for (const f of ['tests/sql/_supabase-stub.sql', GUARD, GUARD, REMOVE, REMOVE])
      execSync(P + ' -d ax_guard -f ' + JSON.stringify(path.join(ROOT, f)), { stdio: 'pipe' });
    const out = execSync(P + ' -d ax_guard -f ' + JSON.stringify(path.join(ROOT, 'tests/sql/sinav-kaydi-koruma.sql')), { stdio: 'pipe' }).toString();
    assert.match(out, /HEPSI GECTI/);
  } finally { execSync(P + ' -d postgres -c "drop database if exists ax_guard"', { stdio: 'pipe' }); }
});

summary();
