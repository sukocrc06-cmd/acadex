/* ==========================================================================
   ACADEX — TEKRAR KAYDI ŞEMASI (tests/tekrar-kaydi-semasi.js)

   NEDEN VAR (01.11.2026): public.card_item_confidence hiçbir migration'da
   tanımlı değildi — panelden elle kurulmuş, istemci kodu ondan sonra ayrışmış.
   Üç upsert yeri (js/dashboard.js, js/acadex-ink.js ×2) tabloda olmayan
   item_key / rating / updated_at kolonlarını gönderiyordu, onConflict ise
   var olmayan bir UNIQUE'e bakıyordu. Her yazma PostgREST'te düştü, okuma
   tarafı hatayı yuttuğu için (js/dashboard.js `if (!error)`) özellik ekranda
   çalışıyor göründü ve tablo iki ay boyunca 0 satır kaldı — SM-2'nin ürettiği
   tüm öğrenme sinyali kayboldu.

   Bu test o sessiz kaymayı bir daha mümkün kılmıyor: istemcinin gönderdiği ve
   okuduğu her kolon ile migration'ın kurduğu şema karşılaştırılır. İstemciye
   yeni bir kolon eklenirse migration güncellenmeden bu test düşer.

   PANEL_KOLONLARI, 01.11.2026'da canlı veritabanından okunmuştur
   (information_schema.columns); migration öncesi temel değerdir.

   Çalıştırma:  node tests/tekrar-kaydi-semasi.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const { test, summary } = makeRunner();

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

const MIG = 'supabase/migrations/20261101_tekrar_kaydi_semasi.sql';
const sql = read(MIG);
const dash = read('js/dashboard.js');
const ink = read('js/acadex-ink.js');
const login = read('login.html');

/* Migration öncesi canlı şema (ölçüldü 01.11.2026) */
const PANEL_KOLONLARI = [
  'id', 'user_id', 'study_card_id', 'item_type', 'item_index', 'confidence',
  'last_reviewed_at', 'next_review_at', 'ease_factor', 'interval_days',
  'repetitions', 'lapses', 'card_type', 'last_rating',
];
/* Bunlar panelde NOT NULL'dı; istemci göndermiyorsa migration gevşetmeli */
const PANEL_NOT_NULL = [
  'user_id', 'study_card_id', 'item_type', 'item_index', 'confidence',
  'ease_factor', 'interval_days', 'repetitions', 'lapses', 'card_type',
];
const ONCONFLICT = 'user_id,study_card_id,item_key';

const keysOf = (body) => [...new Set(
  (body.match(/(?:^|[{,\s])([a-z_][a-z0-9_]*)\s*:/gi) || [])
    .map((s) => s.replace(/[^a-z0-9_]/gi, '')),
)];

/* from('card_item_confidence').upsert({ ... }, { onConflict: '...' }) */
function yerindeUpsert(src) {
  const out = [];
  const re = /card_item_confidence'\)[\s\S]{0,60}?\.upsert\(\{([\s\S]*?)\},\s*\{\s*onConflict:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(src))) out.push({ keys: keysOf(m[1]), onConflict: m[2] });
  return out;
}
/* var row = { ... }; … from('card_item_confidence').upsert(row, { onConflict: '...' }) */
function rowUpsert(src) {
  const out = [];
  const re = /card_item_confidence'\)\s*\.upsert\(row,\s*\{\s*onConflict:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(src))) {
    const s = src.lastIndexOf('var row = {', m.index);
    assert.ok(s > -1, 'upsert(row) öncesinde row tanımı bulunamadı');
    out.push({ keys: keysOf(src.slice(s + 11, src.indexOf('};', s))), onConflict: m[1] });
  }
  return out;
}
/* .from('card_item_confidence').select('a, b, c') */
function secilenKolonlar(src) {
  const out = [];
  const re = /card_item_confidence'\)[\s\S]{0,120}?\.select\('([^']+)'/g;
  let m;
  while ((m = re.exec(src))) out.push(m[1].split(',').map((s) => s.trim()).filter(Boolean));
  return out;
}

const eklenen = (sql.match(/add column if not exists\s+([a-z_]+)/g) || [])
  .map((s) => s.replace(/.*\s/, ''));
const SONRASI = new Set([...PANEL_KOLONLARI, ...eklenen]);

test('migration eksik üç kolonu ekler: item_key, rating, updated_at', () => {
  assert.deepEqual(eklenen.sort(), ['item_key', 'rating', 'updated_at']);
  assert.match(sql, /add column if not exists updated_at timestamptz not null default now\(\)/);
});

test('istemcinin yazdığı her kolon migration sonrası şemada var', () => {
  const yerler = [
    ['js/dashboard.js', yerindeUpsert(dash)],
    ['js/acadex-ink.js', rowUpsert(ink)],
  ];
  let sayac = 0;
  for (const [dosya, bloklar] of yerler) {
    assert.ok(bloklar.length, `${dosya}: card_item_confidence upsert bulunamadı`);
    for (const b of bloklar) {
      sayac++;
      for (const k of b.keys) {
        assert.ok(SONRASI.has(k), `${dosya}: '${k}' kolonu şemada yok (migration güncellenmeli)`);
      }
      assert.ok(b.keys.includes('item_key'), `${dosya}: item_key gönderilmiyor`);
      assert.equal(b.onConflict, ONCONFLICT, `${dosya}: onConflict kısıtla uyuşmuyor`);
    }
  }
  assert.equal(sayac, 3, 'üç upsert yeri bekleniyor (dashboard 1, acadex-ink 2)');
});

test('istemcinin okuduğu her kolon da şemada var (sessiz boş harita kusuru)', () => {
  const okumalar = [
    ...secilenKolonlar(dash).map((c) => ['js/dashboard.js', c]),
    ...secilenKolonlar(ink).map((c) => ['js/acadex-ink.js', c]),
    ...secilenKolonlar(login).map((c) => ['login.html', c]),
  ];
  assert.ok(okumalar.length >= 4, 'okuma yerleri bulunamadı');
  for (const [dosya, kolonlar] of okumalar) {
    for (const k of kolonlar) {
      assert.ok(SONRASI.has(k), `${dosya}: select('${k}') şemada olmayan kolonu istiyor`);
    }
  }
});

test('onConflict için UNIQUE indeks tam o üç kolonda kurulur', () => {
  const m = sql.match(/create unique index if not exists\s+\S+\s*\n?\s*on public\.card_item_confidence \(([^)]+)\)/);
  assert.ok(m, 'UNIQUE indeks kurulmuyor — upsert ON CONFLICT çıkarımı başarısız olur');
  assert.equal(m[1].split(',').map((s) => s.trim()).join(','), ONCONFLICT);
});

test('istemcinin göndermediği NOT NULL kolonların zorunluluğu kaldırılır', () => {
  const gonderilen = new Set([
    ...yerindeUpsert(dash).flatMap((b) => b.keys),
    ...rowUpsert(ink).flatMap((b) => b.keys),
  ]);
  const gevsemesi = PANEL_NOT_NULL.filter((k) => !gonderilen.has(k));
  assert.deepEqual(gevsemesi, ['item_type', 'item_index', 'confidence']);
  for (const k of gevsemesi) {
    assert.ok(
      sql.includes(`alter column ${k}  drop not null`) || sql.includes(`alter column ${k} drop not null`),
      `${k}: NOT NULL kaldırılmıyor — istemci göndermediği için her yazma düşer`,
    );
  }
});

test('rating CHECK kümesi computeSm2\'nin ürettiği değerleri kapsar', () => {
  const i = dash.indexOf('function computeSm2');
  assert.ok(i > -1, 'computeSm2 bulunamadı');
  const govde = dash.slice(i, dash.indexOf('\n}', i));
  const uretilen = [...new Set((govde.match(/rating === '([a-z]+)'/g) || [])
    .map((s) => s.replace(/.*'([a-z]+)'/, '$1')))];
  assert.deepEqual(uretilen.sort(), ['again', 'easy', 'good', 'hard']);
  const check = sql.match(/rating in \(([^)]+)\)/);
  assert.ok(check, 'rating CHECK kısıtı yok');
  const izinli = check[1].split(',').map((s) => s.trim().replace(/'/g, ''));
  for (const r of uretilen) {
    assert.ok(izinli.includes(r), `CHECK '${r}' derecesini reddediyor`);
  }
});

summary();
