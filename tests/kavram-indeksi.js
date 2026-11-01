/* ==========================================================================
   ACADEX — KAVRAM İNDEKSİ (tests/kavram-indeksi.js)

   NEDEN VAR (01.11.2026): public.user_concept_index 17.08.2026'da kuruldu ve
   **iki buçuk ay boyunca 0 satır** kaldı. Sebebi kırık bir yazıcı değil, hiç
   yazıcı olmamasıydı: tabloya değen tek satır kendi migration'ındaydı, o da
   "Optional: run a nightly job or 'Refresh graph' button" diyordu. Kavramlar
   üretiliyordu ama yalnız kartın JSON'unun içinde kalıyordu, yani SQL'den
   sorgulanamıyordu.

   20261101b_kavram_indeksi.sql tetikleyici + geriye doldurma ile bunu kapatır.
   Bu test iki şeyi kilitler:
     1) SICAK YOL KORUMASI — tetikleyici study_cards'ın yazma yoluna takılı
        (summarize-document kartı oraya yazar). Gövde exception ile sarılı
        olmalı; indeks hatası kart yazmasını ASLA düşürmemeli.
     2) İSTEMCİ SÖZLEŞMESİ — SQL, concept_graph'ı istemcinin okuduğu gibi
        okumalı (g.nodes, n.label). İstemci yapıyı değiştirirse bu test düşer
        ve SQL'in de güncellenmesi gerektiğini söyler.

   ÖLÇÜLEN KAYNAK VERİ (01.11.2026, 107 kart): key_terms 106 kartta 1.474 öğe
   (ort. 13,8, hepsinin 'term' alanı dolu); concept_graph yalnız 12 kartta,
   toplam 85 düğüm, tek düğüm türü 'concept'. İndeksin gövdesi key_terms'ten
   gelir — bu yüzden iki kaynak da şart.

   Çalıştırma:  node tests/kavram-indeksi.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const { test, summary } = makeRunner();

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

const MIG = 'supabase/migrations/20261101b_kavram_indeksi.sql';
const sql = read(MIG);
const tabloSql = read('supabase/migrations/20260817d_cross_doc_knowledge_graph.sql');
const ink = read('js/acadex-ink.js');

test('tabloyu YENİDEN KURMUYOR — yalnız doldurma mantığı ekliyor', () => {
  assert.ok(!/create table[\s\S]{0,40}user_concept_index/i.test(sql),
    'migration tabloyu yeniden kurmaya çalışıyor; tanım 20260817d içinde kalmalı');
  assert.ok(!/drop table/i.test(sql), 'migration tablo düşürüyor');
});

test('concept_key_of: küçük harf + boşluk sadeleştirme + kırpma, IMMUTABLE', () => {
  const blok = sql.slice(sql.indexOf('function public.concept_key_of'),
                         sql.indexOf('create or replace function public.rebuild_card_concept_index'));
  assert.match(blok, /\bimmutable\b/i, 'IMMUTABLE değil — sorguda/indekste kullanılamaz');
  assert.match(blok, /lower\(/, 'küçük harfe çevirmiyor');
  assert.match(blok, /regexp_replace\(.*'\\s\+'.*' '/s, 'iç boşlukları sadeleştirmiyor');
  assert.match(blok, /btrim\(/, 'kırpmıyor');
  assert.match(blok, /nullif\(/, 'boş etiketi null yapmıyor — NOT NULL kolona boş anahtar girer');
});

test('SICAK YOL: tetikleyici hatası kart yazmasını düşürmez', () => {
  const tg = sql.slice(sql.indexOf('function public.study_cards_concept_index_tg'),
                       sql.indexOf('drop trigger if exists'));
  assert.match(tg, /exception\s+when\s+others\s+then/i,
    'tetikleyici gövdesi exception ile sarılı değil — indeks hatası kartı düşürür');
  assert.match(tg, /raise warning/i, 'hata sessiz yutuluyor; uyarı basmalı');
  assert.ok(/begin[\s\S]*perform public\.rebuild_card_concept_index\(new\.id\)[\s\S]*exception/i.test(tg),
    'rebuild çağrısı korumalı blok içinde değil');
});

test('tetikleyici: study_cards üzerinde, doğru kolonlarda, AFTER', () => {
  const m = sql.match(/create trigger trg_study_cards_concept_index\s*\n\s*after ([^\n]+)\n\s*on public\.study_cards/);
  assert.ok(m, 'tetikleyici study_cards üzerinde AFTER olarak kurulmuyor');
  for (const kol of ['concept_graph', 'key_terms', 'course_tag', 'document_id']) {
    assert.ok(m[1].includes(kol), `tetikleyici ${kol} değişiminde çalışmıyor`);
  }
  assert.match(sql, /drop trigger if exists trg_study_cards_concept_index/,
    'tekrar koşuda çift tetikleyici kurar');
});

test('İSTEMCİ SÖZLEŞMESİ: SQL, concept_graph\'ı istemcinin okuduğu gibi okuyor', () => {
  // js/acadex-ink.js -> netData: g.nodes ve n.label
  assert.match(ink, /arr\(g\.nodes\)\.map/, 'istemci artık g.nodes okumuyor — SQL de değişmeli');
  assert.match(ink, /String\(n\.label \|\| n\.id\)/, 'istemci düğüm etiketini n.label\'dan almıyor');
  assert.match(sql, /k\.concept_graph->'nodes'/, 'SQL nodes dizisini okumuyor');
  assert.match(sql, /n->>'label'/, 'SQL düğüm etiketini label alanından almıyor');
  assert.match(sql, /coalesce\(n->>'type', 'concept'\) = 'concept'/,
    'düğüm türü süzgeci yok');
});

test('iki kaynak da indeksleniyor ve değerler tablonun izin verdikleri', () => {
  assert.match(sql, /'concept_graph'::text as source/, 'concept_graph kaynağı yok');
  assert.match(sql, /'key_term'::text/, 'key_term kaynağı yok — indeksin gövdesi bu');
  assert.match(sql, /t->>'term'/, 'key_terms öğesini term alanından okumuyor');
  // 20260817d: source text not null default 'concept_graph', -- concept_graph | key_term
  const izinli = (tabloSql.match(/--\s*(concept_graph \| key_term)/) || [])[1];
  assert.equal(izinli, 'concept_graph | key_term', 'tablo tanımındaki kaynak kümesi değişmiş');
});

test('çakışma kuralı tablonun GERÇEK UNIQUE kısıtıyla aynı', () => {
  const kisit = (tabloSql.match(/unique \(([^)]+)\)/) || [])[1];
  assert.ok(kisit, '20260817d içinde UNIQUE kısıtı bulunamadı');
  const bekleven = kisit.split(',').map((s) => s.trim()).join(', ');
  const m = sql.match(/on conflict \(([^)]+)\) do nothing/);
  assert.ok(m, 'on conflict yok — ikinci koşuda tetikleyici hata verir');
  assert.equal(m[1].split(',').map((s) => s.trim()).join(', '), bekleven,
    'on conflict kolonları tablodaki UNIQUE ile uyuşmuyor');
  assert.match(sql, /distinct on \(public\.concept_key_of\(label\)\)/,
    'kart içi tekilleştirme yok — aynı anahtar iki kaynaktan gelirse çakışır');
});

test('SECURITY DEFINER fonksiyonunda sahiplik kapısı ve search_path var', () => {
  const fn = sql.slice(sql.indexOf('function public.rebuild_card_concept_index'),
                       sql.indexOf('function public.study_cards_concept_index_tg'));
  assert.match(fn, /security definer/i, 'SECURITY DEFINER değil');
  assert.match(fn, /set search_path = public, pg_temp/, 'search_path sabitlenmemiş');
  assert.match(fn, /auth\.uid\(\) is not null and auth\.uid\(\) <> v_user/,
    'sahiplik kapısı yok — başka kullanıcının kartına indeks yazılabilir');
  assert.match(fn, /raise exception/i, 'sahiplik ihlalinde hata fırlatmıyor');
});

test('yetkiler: anon çağıramaz, geriye doldurma var', () => {
  for (const f of ['concept_key_of(text)', 'rebuild_card_concept_index(uuid)',
                   'study_cards_concept_index_tg()']) {
    assert.ok(sql.includes(`revoke all on function public.${f} from public`),
      `${f}: public yetkisi geri alınmıyor`);
  }
  assert.match(sql, /grant execute on function public\.rebuild_card_concept_index\(uuid\) to authenticated, service_role/,
    '"Grafiği yenile" yolu için yetki verilmiyor');
  assert.match(sql, /for r in select id from public\.study_cards loop/,
    'mevcut kartlar için geriye doldurma yok — tetikleyici yalnız yeni kartları yakalar');
  assert.match(sql, /raise notice 'user_concept_index dolduruldu/,
    'doldurma sonucu loglanmıyor — sessiz bir iş doğrulanamaz');
});

summary();
