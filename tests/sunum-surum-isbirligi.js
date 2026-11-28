/* ==========================================================================
   ACADEX — SUNUM SÜRÜMLERİ VE İNCELEME (tests/sunum-surum-isbirligi.js)

   NEDEN VAR (28.11.2026, #58 Phase 12.3b/c):
   - Sürüm elle kaydedilir; otomatik sürüm yalnız onaylanmış büyük değişiklikten (marka kiti, geri yükleme) önce alınır,
     her tuşta değil. Karşılaştırma asetat kimliğiyle; geri yükleme önce yedek alır, tek adımda geri alınır, hata olursa
     deste yerinde geri döner; metni değişen öğenin eski kanıt kontrolü taşınmaz. "Yeni sunum olarak aç" eskisini değiştirmez.
   - Roller (sahip / düzenleyici / inceleyici) SUNUCUDA hesaplanır (20261128b: sunum_rol, RLS, RPC). İstemci tarafı denetim
     tek başına paylaşımı tamamlanmış saymaz: B bölümü iki migration'ı gerçek Postgres'te (PGlite) RLS ile koşar.
   - İnceleme bağlantısı sürüme bağlı, süreli, geri alınabilir, salt okunur; belirteç yalnız sha256 özetiyle saklanır;
     geri alma üyeliği siler (erişim gerçekten kesilir). Yorum metne dokunmaz (ayrı tablo, güncelleme politikası yok).
   - Ortak destede çakışma: hesaptaki içerik sürümü bu cihazın bildiğinden farklıysa üzerine yazılmaz, yerel iş "çakışma
     kopyası" olur (ikisi de kalır). Erişimi kesilen ortak deste hesaptan çekilmez.

   Bölümler: A kaynak kuralları · B PGlite RLS (PGLITE_DIR yoksa ATLANDI) · C başsız Chrome birim · E uçtan uca 1440/1024/390 (+EN).
   Başsız Chrome 500 px altına inmez: 390'da innerWidth ≤ 520. Dış ağ yok, canlı model yok, içerik sentetik.
   PGlite taban şeması canlı Supabase şemasının taklididir (tests/_pglite-taban.js); canlı veritabanı değildir.
   Çalıştırma:  PGLITE_DIR=<@electric-sql/pglite bulunan node_modules> node tests/sunum-surum-isbirligi.js
   ========================================================================== */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { makeRunner } = require('./_ts-extract.js');
const { CHROME, yeniSunucu, duzenek } = require('./_capraz-duzenek.js');
const { pgKur } = require('./_pglite-taban.js');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const ink = read('js/acadex-ink.js');
const MIGB = read('supabase/migrations/20261128b_sunum_inceleme.sql');
const { test, summary } = makeRunner();
const SVB = (() => { const a = ink.indexOf('  /* ---- 12.3b sürümler'), b = ink.indexOf('  /* ---- pencere ---- */', a); return a > 0 && b > a ? ink.slice(a, b) : ''; })();
const GUVENLIK = { istemciRolu: 0, iptalSonrasiErisim: 0, inceleyiciYazdi: 0, yorumMetniDegistirdi: 0, belirtecAcik: 0, sessizUzerineYazma: 0, kayitsizSurum: 0, modelCagrisi: 0, disAg: 0 };
const MIG = ['20261128_sunum_marka_kiti.sql', '20261128b_sunum_inceleme.sql'];

/* ---------- A: kaynak kuralları ---------- */
test('A1 12.3b/c istemci: ağ/model yok, yalnız 5 RPC; rol istemciden gönderilmez; belirteç adres çubuğundan istekten önce silinir; günlükte yalnız kod', () => {
  assert.ok(SVB.length > 8000, '12.3b/c bölümü bulunamadı');
  for (const y of ['fetch(', 'XMLHttpRequest', 'functions.invoke', 'groq', 'tavily', 'gemini']) assert.equal(SVB.toLowerCase().includes(y), false, y);
  const rpc = [...SVB.matchAll(/\.rpc\('([a-z_]+)'/g)].map((m) => m[1]).sort(); assert.deepEqual([...new Set(rpc)], ['comment_resolve', 'review_link_create', 'review_link_revoke', 'review_open', 'sunum_rol']);
  assert.equal(/p_rol\b|role: *IB\.rol/.test(SVB), false, 'istemci rolü sunucuya taşımamalı'); assert.ok(SVB.includes("p_role: rol === 'editor' ? 'editor' : 'reviewer'"), 'bağlantı rolü beyaz liste');
  const boot = SVB.slice(SVB.indexOf('var ibBoot = '), SVB.indexOf('var ibDlg')); assert.ok(boot.indexOf('history.replaceState') > 0 && boot.indexOf('history.replaceState') < boot.indexOf("rpc('review_open'"), 'belirteç istekten önce silinmeli');
  assert.ok(/\^\[0-9a-f\]\{48\}\$/.test(boot), 'belirteç biçimi denetlenir');
  assert.deepEqual([...SVB.matchAll(/console\.(?:log|warn|error)\(([^;]*)\)/g)].map((m) => m[1]), ["'acadex-sunum: sürüm hesaba yazılamadı', e && e.code"]);
  assert.equal(/\(\?<[=!]/.test(SVB), false, 'lookbehind'); assert.equal(/\\u[0-9a-fA-F]{4}/.test(SVB), false, '\\u');
});

test('A2 migration 20261128b: yeni tablolarda RLS; anon yetkisi yok; yorum güncelleme politikası yok; belirteç düz saklanmaz; definer işlevlerde search_path; share_snapshot RPC değişmez', () => {
  for (const t of ['presentation_review_links', 'presentation_members', 'presentation_comments']) assert.ok(MIGB.includes('alter table public.' + t + ' enable row level security'), t);
  assert.equal(/ to anon\b/.test(MIGB.replace(/revoke[^;]*;/g, '')), false, 'anon\'a izin verilmemeli');
  assert.equal(/on public\.presentation_comments for update/.test(MIGB), false, 'yorum güncellenemez'); assert.equal(/grant[^;]*update[^;]*presentation_comments/.test(MIGB), false);
  assert.ok(/token_hash text not null unique/.test(MIGB) && !/\btoken text\b/.test(MIGB), 'belirteç yalnız özet');
  const definer = MIGB.match(/security definer[^$]*\$\$/g) || []; assert.ok(definer.length >= 7); for (const x of definer) assert.ok(/set search_path = public/.test(x), x.slice(0, 60));
  for (const f of ['sunum_rol(uuid)', 'review_link_create(uuid, text, uuid, integer, boolean)', 'review_link_revoke(uuid)', 'review_open(text)', 'comment_resolve(uuid, boolean)']) assert.ok(MIGB.includes('revoke all on function public.' + f + ' from public, anon'), f);
  assert.equal(/get_shared_presentation/.test(MIGB.replace(/^--.*$/gm, '')), false, 'paylaşım görüntüsü RPC\'si değişmez');
  for (const y of ['is_teacher', 'teacher_', 'my_classes', 'my_assignments', 'assignment_id', 'öğretmene ilet']) assert.equal(MIGB.includes(y) || SVB.includes(y), false, y);
});

test('A3 mimari: yeni Edge Function yok; svOtomatik yalnız onaylı iki büyük değişiklikte; Phase 11 asetat gezinmesi (curSakla) sürüm/hesap yazmaz', () => {
  const izsiz = execFileSync('git', ['status', '--porcelain', '--', 'supabase/functions'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  assert.deepEqual(izsiz.filter((l) => l.startsWith('??')), [], 'yeni Edge Function dizini'); assert.ok(izsiz.every((l) => /sunum-research\/index\.ts$/.test(l)), izsiz.join(','));
  const cagri = [...ink.matchAll(/svOtomatik\(pqT\('([^']+)'/g)].map((m) => m[1]); assert.deepEqual(cagri, ['Marka kiti öncesi', 'Geri yükleme öncesi']);
  const cs = ink.slice(ink.indexOf('curSakla = function'), ink.indexOf('\n', ink.indexOf('curSakla = function'))); assert.ok(cs.length > 20 && !/sv[A-Z]|dirty\(|queueCloud/.test(cs), cs);
});

/* ---------- B: PGlite RLS ---------- */
const [U1, U2, U3, U4, UM] = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444', '55555555-5555-4555-8555-555555555555'];
let PG = null;
const pg = async () => PG || (PG = await (async () => {
  const P = await pgKur(MIG); if (!P) return null;
  await P.kok(`insert into auth.users values ('${U1}'), ('${U2}'), ('${U3}'), ('${U4}'), ('${UM}')`);
  const a = P.kim(U1);
  const p1 = (await a(`insert into public.presentations (user_id, title, share_token, share_snapshot) values ('${U1}', 'Sunum', 'tok-paylasim-1234567890ab', '{"slides":[]}') returning id`)).rows[0].id;
  const p2 = (await a(`insert into public.presentations (user_id, title) values ('${U1}', 'Öteki') returning id`)).rows[0].id;
  await a(`insert into public.presentation_slides (presentation_id, order_index, content, speaker_notes) values ('${p1}', 0, '{"surum":"s1"}', 'gizli not')`);
  const snap = { v: 1, deste: { title: 'Sunum', kitle: { kitle: 'yatirimci' }, marka: { ad: 'Acme', paylas: false }, slides: [{ id: 's1', notes: 'gizli konuşmacı notu', els: [{ id: 'e1', type: 'h', text: 'Başlık' }, { id: 'lg', type: 'img', mrk: 'logo', src: 'data:image/png;base64,AAAA' }] }] } };
  const v1 = (await a(`insert into public.presentation_versions (presentation_id, version_no, snapshot, name, signature) values ('${p1}', 1, $1, 'Sürüm 1', 'imza1') returning id`, [JSON.stringify(snap)])).rows[0].id;
  const v2 = (await a(`insert into public.presentation_versions (presentation_id, version_no, snapshot, name) values ('${p2}', 1, '{"deste":{"slides":[]}}', 'Öteki') returning id`)).rows[0].id;
  return Object.assign(P, { p1, p2, v1, v2, a, rev: P.kim(U2), ed: P.kim(U3), yab: P.kim(U4), mis: P.kim(UM, { misafir: true }), an: P.kim(null, { anon: true }) });
})());
const atla = (ad) => console.log('  ATLANDI  ' + ad + ': PGlite yok — PGLITE_DIR ile @electric-sql/pglite bulunan node_modules yolunu verin. Bu test GEÇTİ sayılmadı.');
const tek = (r) => { assert.ok(r.rows, JSON.stringify(r)); return r.rows[0]; };
const fn = (r) => Object.values(tek(r))[0];
const LINK = {};

test('B1 bağlantı oluşturma yalnız sahip; gün 1–30; inceleyici sürümsüz olmaz; başka sunumun sürümü reddedilir; belirteç yalnız özetiyle saklanır', async () => {
  const P = await pg(); if (!P) return atla('B1');
  const r = fn(await P.a(`select public.review_link_create('${P.p1}', 'reviewer', '${P.v1}', 7, false)`)); assert.match(r.token, /^[0-9a-f]{48}$/); LINK.rev = r;
  const sakl = await P.kok('select token_hash, to_jsonb(l)::text as satir from public.presentation_review_links l where id = $1', [r.id]);
  assert.equal(sakl[0].token_hash, crypto.createHash('sha256').update(r.token).digest('hex')); assert.equal(sakl[0].satir.includes(r.token), false, 'belirteç düz saklandı'); if (sakl[0].satir.includes(r.token)) GUVENLIK.belirtecAcik++;
  LINK.ed = fn(await P.a(`select public.review_link_create('${P.p1}', 'editor', null, 30, false)`)); LINK.not = fn(await P.a(`select public.review_link_create('${P.p1}', 'reviewer', '${P.v1}', 1, true)`));
  for (const [k, sql] of [['0 gün', `'${P.p1}', 'reviewer', '${P.v1}', 0, false`], ['31 gün', `'${P.p1}', 'reviewer', '${P.v1}', 31, false`], ['sürümsüz inceleyici', `'${P.p1}', 'reviewer', null, 7, false`], ['başka sunumun sürümü', `'${P.p1}', 'reviewer', '${P.v2}', 7, false`], ['bilinmeyen rol', `'${P.p1}', 'owner', '${P.v1}', 7, false`]])
    assert.equal((await P.a(`select public.review_link_create(${sql})`)).hata, '22023', k);
  for (const [k, q] of [['yabancı', P.yab], ['misafir', P.mis]]) assert.equal((await q(`select public.review_link_create('${P.p1}', 'reviewer', '${P.v1}', 7, false)`)).hata, '42501', k);
  assert.equal((await P.an(`select public.review_link_create('${P.p1}', 'reviewer', '${P.v1}', 7, false)`)).hata, '42501', 'anon çalıştıramaz');
  assert.equal((await P.yab('select id from public.presentation_review_links')).rows.length, 0, 'yabancı bağlantıları göremez');
  assert.equal((await P.a(`insert into public.presentation_review_links (presentation_id, token_hash, role, expires_at) values ('${P.p1}', '${'a'.repeat(64)}', 'editor', now() + interval '1 day')`)).hata, '42501', 'bağlantı yalnız RPC ile');
});

test('B2 inceleyici: review_open sürüm görüntüsünü notsuz, profilsiz, logosuz döner; tablolara erişemez, yazamaz, sürüm ekleyemez, yorumu çözemez', async () => {
  const P = await pg(); if (!P) return atla('B2');
  const o = fn(await P.rev(`select public.review_open('${LINK.rev.token}')`)); assert.equal(o.role, 'reviewer'); assert.equal(o.presentation_id, P.p1);
  const D = o.version.snapshot.deste; assert.equal('kitle' in D, false, 'profil'); assert.equal('notes' in D.slides[0], false, 'not'); assert.deepEqual(D.slides[0].els.map((e) => e.id), ['e1'], 'paylaşılmayan logo');
  assert.equal(fn(await P.rev(`select public.sunum_rol('${P.p1}')`)), 'reviewer');
  for (const t of ['presentations', 'presentation_slides', 'presentation_versions', 'presentation_review_links']) assert.equal((await P.rev('select * from public.' + t)).rows.length, 0, t);
  const yaz = [await P.rev(`update public.presentation_slides set content = '{"x":1}' returning 1`), await P.rev(`update public.presentations set title = 'x' returning 1`), await P.rev(`insert into public.presentation_versions (presentation_id, version_no, snapshot, created_by) values ('${P.p1}', 9, '{}', '${U2}')`), await P.rev(`delete from public.presentations returning 1`)];
  const yazdi = yaz.filter((r) => r.rows && r.rows.length).length; assert.equal(yazdi, 0, JSON.stringify(yaz)); assert.ok(yaz[2].hata, 'sürüm eklenemez'); GUVENLIK.inceleyiciYazdi += yazdi;
  assert.equal((await P.kok(`select title from public.presentations where id = '${P.p1}'`))[0].title, 'Sunum');
  const y = tek(await P.rev(`insert into public.presentation_comments (presentation_id, scope, slide_id, element_id, body, version_id) values ('${P.p1}', 'element', 's1', 'e1', 'Bu cümle net değil', '${P.v1}') returning id`)); LINK.yorum = y.id;
  assert.ok((await P.rev(`insert into public.presentation_comments (presentation_id, scope, body, resolved_at) values ('${P.p1}', 'deck', 'çözülmüş gibi', now())`)).hata, 'çözülmüş yorum eklenemez');
  assert.ok((await P.rev(`insert into public.presentation_comments (presentation_id, scope, body, author_id) values ('${P.p1}', 'deck', 'başkası adına', '${U1}')`)).hata, 'başkası adına yorum');
  assert.equal((await P.rev(`select public.comment_resolve('${y.id}', true)`)).hata, '42501', 'inceleyici çözemez');
  assert.equal((await P.rev(`select count(*)::int n from public.presentation_members`)).rows[0].n, 1, 'yalnız kendi üyeliği');
});

test('B3 yorum metne dokunmaz: güncelleme yok (yazar ve sahip dahil); çözme yalnız sahip/düzenleyici RPC ile; üst yorum ve sürüm aynı sunumdan', async () => {
  const P = await pg(); if (!P) return atla('B3');
  const once = await P.kok('select body, resolved_at from public.presentation_comments where id = $1', [LINK.yorum]);
  for (const [k, q] of [['yazar', P.rev], ['sahip', P.a]]) { const r = await q(`update public.presentation_comments set body = 'değişti' where id = '${LINK.yorum}' returning 1`); assert.ok(r.hata || !r.rows.length, k + ' yorum metnini değiştirdi'); if (r.rows && r.rows.length) GUVENLIK.yorumMetniDegistirdi++; }
  assert.equal((await P.kok('select body from public.presentation_comments where id = $1', [LINK.yorum]))[0].body, once[0].body);
  const sl0 = await P.kok(`select content::text c from public.presentation_slides where presentation_id = '${P.p1}'`);
  assert.equal(fn(await P.a(`select public.comment_resolve('${LINK.yorum}', true)`)), true); assert.ok((await P.kok('select resolved_at from public.presentation_comments where id = $1', [LINK.yorum]))[0].resolved_at);
  assert.equal(fn(await P.a(`select public.comment_resolve('${LINK.yorum}', false)`)), true); assert.equal((await P.kok('select resolved_at from public.presentation_comments where id = $1', [LINK.yorum]))[0].resolved_at, null);
  assert.deepEqual(await P.kok(`select content::text c from public.presentation_slides where presentation_id = '${P.p1}'`), sl0, 'yorum/çözme içeriği değiştirdi');
  const z = await P.kok(`select id from public.presentation_comments where presentation_id = '${P.p1}' limit 1`);
  assert.equal((await P.a(`insert into public.presentation_comments (presentation_id, scope, body, parent_id) values ('${P.p2}', 'deck', 'yanıt', '${z[0].id}')`)).hata, '23514', 'üst yorum başka sunumda');
  assert.equal((await P.a(`insert into public.presentation_comments (presentation_id, scope, body, version_id) values ('${P.p1}', 'deck', 'x', '${P.v2}')`)).hata, '23514', 'sürüm başka sunumda');
  assert.ok((await P.a(`insert into public.presentation_comments (presentation_id, scope, slide_id, body) values ('${P.p1}', 'slide', 'a b', 'x')`)).hata, 'asetat kimliği biçimi');
  assert.ok((await P.yab(`insert into public.presentation_comments (presentation_id, scope, body) values ('${P.p1}', 'deck', 'yabancı')`)).hata, 'yabancı yorum yazamaz');
  assert.ok((await P.mis(`insert into public.presentation_comments (presentation_id, scope, body) values ('${P.p1}', 'deck', 'misafir')`)).hata, 'misafir yorum yazamaz');
  assert.equal((await P.yab(`select id from public.presentation_comments`)).rows.length, 0, 'yabancı yorum okuyamaz');
});

test('B4 düzenleyici: okur ve düzenler; sahipliği/paylaşımı değiştiremez (tetikleyici), silemez, bağlantı kuramaz; inceleyici bağlantısı onu düşürmez; çözebilir', async () => {
  const P = await pg(); if (!P) return atla('B4');
  assert.equal(fn(await P.ed(`select public.review_open('${LINK.ed.token}')`)).role, 'editor');
  assert.equal((await P.ed('select id from public.presentations')).rows.length, 1, 'yalnız ortak sunum'); assert.equal((await P.ed('select id from public.presentation_slides')).rows.length, 1);
  assert.equal((await P.ed(`update public.presentation_slides set content = '{"surum":"s2"}' where presentation_id = '${P.p1}' returning 1`)).rows.length, 1, 'düzenleyici asetat yazar');
  const u = tek(await P.ed(`update public.presentations set title = 'Ortak', user_id = '${U3}', share_token = 'ele-gecirildi-0000000000', share_snapshot = '{"slides":["x"]}' where id = '${P.p1}' returning title, user_id, share_token, share_snapshot::text s`));
  assert.deepEqual([u.title, u.user_id, u.share_token, u.s], ['Ortak', U1, 'tok-paylasim-1234567890ab', '{"slides": []}'], 'sahiplik/paylaşım korunmalı');
  assert.equal((await P.ed(`delete from public.presentations where id = '${P.p1}' returning 1`)).rows.length, 0, 'düzenleyici silemez');
  assert.equal((await P.ed(`select public.review_link_create('${P.p1}', 'reviewer', '${P.v1}', 7, false)`)).hata, '42501', 'düzenleyici bağlantı kuramaz');
  assert.equal((await P.ed('select id from public.presentation_review_links')).rows.length, 0, 'düzenleyici bağlantıları göremez');
  assert.ok(tek(await P.ed(`insert into public.presentation_versions (presentation_id, version_no, snapshot, name) values ('${P.p1}', 2, '{"deste":{"slides":[]}}', 'Ed') returning id`)), 'düzenleyici sürüm ekler');
  assert.ok((await P.ed(`insert into public.presentation_versions (presentation_id, version_no, snapshot, created_by) values ('${P.p1}', 3, '{}', '${U1}')`)).hata, 'başkası adına sürüm');
  assert.equal(fn(await P.ed(`select public.review_open('${LINK.rev.token}')`)).role, 'editor', 'inceleyici bağlantısı düzenleyiciyi düşürmez');
  assert.equal(fn(await P.ed(`select public.comment_resolve('${LINK.yorum}', true)`)), true);
  assert.equal((await P.ed('select * from public.presentations where id = $1', [P.p2])).rows.length, 0, 'öteki sunum görünmez');
  const s = tek(await P.a(`update public.presentations set share_token = 'sahip-yeni-000000000000' where id = '${P.p1}' returning share_token`)); assert.equal(s.share_token, 'sahip-yeni-000000000000', 'sahip paylaşımı değiştirebilir');
});

test('B5 sahip kendi bağlantısını açınca üyelik yazılmaz; notlar dahil bağlantı notu verir ama profili yine vermez; yabancı/misafir/anon/yanlış belirteç', async () => {
  const P = await pg(); if (!P) return atla('B5');
  const o = fn(await P.a(`select public.review_open('${LINK.rev.token}')`)); assert.equal(o.role, 'owner'); assert.equal((await P.kok(`select count(*)::int n from public.presentation_members where user_id = '${U1}'`))[0].n, 0);
  const n = fn(await P.yab(`select public.review_open('${LINK.not.token}')`)); assert.equal(n.version.snapshot.deste.slides[0].notes, 'gizli konuşmacı notu'); assert.equal('kitle' in n.version.snapshot.deste, false);
  assert.equal(fn(await P.yab(`select public.sunum_rol('${P.p1}')`)), 'reviewer'); await P.kok(`delete from public.presentation_members where user_id = '${U4}'`);
  assert.equal(fn(await P.yab(`select public.sunum_rol('${P.p1}')`)), null, 'üyeliği silinen yabancı');
  assert.equal((await P.mis(`select public.review_open('${LINK.rev.token}')`)).hata, '42501', 'misafir'); assert.equal(fn(await P.mis(`select public.sunum_rol('${P.p1}')`)), null);
  assert.equal((await P.an(`select public.review_open('${LINK.rev.token}')`)).hata, '42501', 'anon');
  for (const t of ['b'.repeat(48), 'kisa', LINK.rev.token.toUpperCase(), "' or 1=1 --"]) assert.equal((await P.yab('select public.review_open($1)', [t])).hata, '22023', t);
});

test('B6 geri alma ve süre dolumu erişimi SUNUCUDA keser: üyelik silinir, rol null, belirteç geçersiz, düzenleyici artık yazamaz; geri almayı yalnız sahip yapar', async () => {
  const P = await pg(); if (!P) return atla('B6');
  assert.equal((await P.ed(`select public.review_link_revoke('${LINK.ed.id}')`)).hata, '42501', 'düzenleyici geri alamaz'); assert.equal((await P.rev(`select public.review_link_revoke('${LINK.rev.id}')`)).hata, '42501');
  assert.equal(fn(await P.a(`select public.review_link_revoke('${LINK.ed.id}')`)), true);
  assert.equal((await P.kok(`select count(*)::int n from public.presentation_members where link_id = '${LINK.ed.id}'`))[0].n, 0, 'üyelik silinmeli');
  const ed = [fn(await P.ed(`select public.sunum_rol('${P.p1}')`)), (await P.ed('select id from public.presentations')).rows.length, (await P.ed(`update public.presentation_slides set content = '{"surum":"s3"}' returning 1`)).rows.length, (await P.ed(`select public.review_open('${LINK.ed.token}')`)).hata];
  assert.deepEqual(ed, [null, 0, 0, '22023'], 'geri alınan düzenleyici: ' + JSON.stringify(ed)); if (ed[0] || ed[1] || ed[2]) GUVENLIK.iptalSonrasiErisim++;
  assert.equal((await P.kok(`select content->>'surum' s from public.presentation_slides where presentation_id = '${P.p1}'`))[0].s, 's2');
  /* süre dolumu: satır kalır, sunum_rol bağlantıyı sınar */
  assert.equal(fn(await P.rev(`select public.sunum_rol('${P.p1}')`)), 'reviewer');
  await P.kok(`update public.presentation_review_links set created_at = now() - interval '10 days', expires_at = now() - interval '1 second' where id = '${LINK.rev.id}'`);
  const rv = [fn(await P.rev(`select public.sunum_rol('${P.p1}')`)), (await P.rev(`select public.review_open('${LINK.rev.token}')`)).hata, (await P.rev(`insert into public.presentation_comments (presentation_id, scope, body) values ('${P.p1}', 'deck', 'süre doldu')`)).hata ? 1 : 0, (await P.rev('select id from public.presentation_comments')).rows.length];
  assert.deepEqual(rv, [null, '22023', 1, 0], 'süresi dolan inceleyici: ' + JSON.stringify(rv)); if (rv[0] || !rv[2] || rv[3]) GUVENLIK.iptalSonrasiErisim++;
  assert.ok((await P.kok(`update public.presentation_review_links set expires_at = created_at + interval '31 days' where id = '${LINK.not.id}'`).catch((e) => ({ hata: e.code }))).hata, '30 günden uzun bağlantı');
});

/* ---------- C–E: başsız Chrome ---------- */
const STRIPS = [{ k: 'cover', t: 'Yerel Enerji', b: [] },
  { k: 'list', t: 'Gelir artışı', b: ['Gelir 2024 yılında %12 arttı [1].', 'Gider düşmedi çünkü maliyet arttı.'] },
  { k: 'list', t: 'Şebeke dengesi', b: ['Fotovoltaik paneller gündüz üretir.', 'Depolama akşam talebini karşılar.'] },
  { k: 'list', t: 'Maliyet', b: ['Kurulum maliyeti 3 yılda geri döner.', 'Bakım gideri düşüktür.'] },
  { k: 'end', t: 'Teşekkürler', b: [] }];
const STRIPS_EN = [{ k: 'cover', t: 'Local Energy', b: [] }, { k: 'list', t: 'Revenue growth', b: ['Revenue rose 12% in 2024 [1].', 'Costs did not fall.'] }, { k: 'list', t: 'Grid balance', b: ['Panels produce by day.', 'Storage covers evening demand.'] }, { k: 'end', t: 'Thanks', b: [] }];
const PM = (en) => ({ title: 'P', sub: 't', lang: en ? 'en' : 'tr', source: 'topic', sourceId: null, cited: [{ id: 1, title: 'TÜİK', url: 'https://www.tuik.gov.tr/a', site: 'tuik.gov.tr', date: '2024', parca: [{ pid: 'p1', metin: en ? 'Revenue rose 12% in 2024.' : 'Gelir 2024 yılında %12 arttı.', tur: 'pasaj' }] }], sources: [] });
const TOHUM = (en) => `window.__inv = [];
  window.supabaseClient.functions.invoke = function (name, opt) { var b = (opt && opt.body) || {}; window.__inv.push(name + ':' + (b.action || 'research')); if (b.action === 'critique') return Promise.resolve({ data: { version: 11, quality: { score: 81, issues: [], pass: true } } }); return Promise.resolve({ data: { durum: 'kapali' } }); };
  ${en ? "localStorage.setItem('acadexUILang', 'en'); window.AX_EN = { t: { 'Kaynak': 'Source' } };" : ''}
  var c = window.supabaseClient, ayar = function (o) { return c.rpc('__ayar', o); }; await ayar({ rol: 'editor', acik: null, hataKod: null });
  await sakin(); d.querySelector('[data-newdeck]').click(); S.temaSec(TEMA); S.set(${JSON.stringify(en ? STRIPS_EN : STRIPS)}, ${JSON.stringify(PM(en))}); S.bas('new'); await sakin(); await dur(3000);
  var P = S.p12(), D = function () { return S.deck(); }, J = function (x) { return JSON.stringify(x); };
  window.__hata = []; var ce = console.error; console.error = function () { window.__hata.push(Array.prototype.slice.call(arguments).map(String).join(' ').slice(0, 200)); return ce.apply(console, arguments); };
  window.addEventListener('error', function (e) { window.__hata.push('onerror ' + (e.message || '')); }); window.addEventListener('unhandledrejection', function (e) { window.__hata.push('unhandled ' + String(e.reason && e.reason.message || e.reason)); });
  var ul = function (i) { return D().slides[i].els.filter(function (e) { return /^(ul|t)$/.test(e.type) && !e.muted && String(e.text || '').trim().length > 8; })[0]; }, hd = function (i) { return D().slides[i].els.filter(function (e) { return e.type === 'h'; })[0]; };
  var surumSay = async function () { var r = await c.from('presentation_versions').select('id').eq('presentation_id', D().dbId); return (r.data || []).length; };
  R.dbId = !!D().dbId; var inv0 = window.__inv.length;`;

const BIRIM = TOHUM(false) + `
  /* kanıt kontrolü işaretli iki iddia: biri metni değişecek öğede, biri değişmeyecek */
  [1, 2].forEach(function (i) { var e = ul(i); e.iddia = (e.iddia || []).concat([{ cid: 'cx' + i, text: e.text.split('\\n')[0], h: 'hx' + i, tur: 'madde', durum: 'unverified', kanit: [], kontrol: { karar: 'supported', t: 1 } }]); });
  P.renderAll(); S.dirty(); await dur(1500);
  /* her tuşta sürüm yok */
  R.oto0 = { liste: P.svListe(D()).length, hesap: await surumSay() }; ul(3).text += ' Ek.'; P.renderAll(); S.dirty(); await dur(1500); ul(3).text += ' Bir daha.'; S.dirty(); await dur(1500);
  R.oto1 = { liste: P.svListe(D()).length, hesap: await surumSay() };
  R.imza = { ayni: P.svSnap(D()).imza === P.svSnap(D()).imza, notGirer: J(P.svSnap(D()).deste.slides).indexOf('"notes"') };
  /* elle kayıt */
  var k1 = await P.svKaydet('  Sürüm   bir  ', 'ilk taslak'), V1 = k1.v; R.k1 = { ok: k1.ok, bulut: k1.bulut, no: V1.no, ad: V1.ad, oto: V1.oto, db: !!V1.dbId };
  var eskiMetin = ul(1).text; ul(1).text = 'Gelir değişti.'; P.renderAll(); S.dirty(); await dur(1200);
  var k2 = await P.svKaydet('x'.repeat(100), ''); R.k2 = { no: k2.v.no, adUz: k2.v.ad.length, imzaFarkli: k2.v.imza !== V1.imza };
  var bosAd = await P.svKaydet('   ', ''); R.bosAd = bosAd.v.ad;
  R.hesap = (await c.from('presentation_versions').select('version_no,reason,name,created_by,signature').eq('presentation_id', D().dbId).order('version_no', { ascending: true })).data;
  R.bulut = (await P.svBulut(D())).map(function (v) { return v.no; });
  /* karşılaştırma */
  var A = P.svSnap(D()).deste, K = function (f) { var B = JSON.parse(J(A)); f(B); return P.svFark(A, B); };
  R.fark = { ayni: K(function () {}).ayni, ekle: K(function (B) { B.slides.push({ id: 'yeni', els: [] }); }).eklenen, sil: K(function (B) { B.slides.splice(2, 1); }).silinen,
    baslik: K(function (B) { B.slides[1].els.filter(function (e) { return e.type === 'h'; })[0].text = 'Başka'; }), metin: K(function (B) { B.slides[2].els.filter(function (e) { return /^(ul|t)$/.test(e.type) && !e.muted && String(e.text || '').trim().length > 8; })[0].text = 'Başka'; }).metin,
    sira: K(function (B) { var x = B.slides[2]; B.slides[2] = B.slides[3]; B.slides[3] = x; }).sira, kaynak: K(function (B) { B.kaynaklar = (A.kaynaklar || []).concat([{ sid: 'z' }]); }).kaynak,
    iddia: K(function (B) { var x = B.slides[3].els.filter(function (e) { return /^(ul|t)$/.test(e.type) && !e.muted && String(e.text || '').trim().length > 8; })[0]; x.iddia = (x.iddia || []).concat([{ cid: 'n' }]); }).iddia, tema: K(function (B) { B.tema = { id: 'baska' }; }).tema, marka: K(function (B) { B.marka = { ad: 'Acme' }; }).marka };
  R.fark.baslik = { b: R.fark.baslik.baslik, m: R.fark.baslik.metin };
  /* geri yükleme */
  ul(3).text += ' Geri öncesi.'; P.renderAll(); S.dirty(); await dur(1200); var once = J(D().slides), u0 = P.undoN(), L0 = P.svListe(D()).length;
  var g = P.svGeriYukle(V1), idd = function (i) { return (ul(i).iddia || []).filter(function (r) { return r.cid === 'cx' + i; })[0] || {}; };
  R.g = { ok: g.ok, metin: ul(1).text === eskiMetin, k1: !!idd(1).kontrol, k2: !!idd(2).kontrol, undo: P.undoN() - u0, yeniSurum: P.svListe(D()).length - L0, otoAd: P.svListe(D()).slice(-1)[0].ad, oto: P.svListe(D()).slice(-1)[0].oto };
  P.undo(); await bekle(200); R.g.geri = J(D().slides) === once;
  P.uygulaHata(1); var s1 = J(D().slides), u1 = P.undoN(), gh = P.svGeriYukle(V1); R.gh = { ok: gh.ok, ayni: J(D().slides) === s1, undo: P.undoN() - u1 };
  var s2 = J(D().slides); R.bozuk = [P.svGeriYukle({ snapshot: { deste: { slides: 'x' } } }).hata, P.svGeriYukle(null).hata, P.svGeriYukle({ snapshot: { deste: { slides: [{ id: 'a' }] } } }).hata, J(D().slides) === s2];
  /* otomatik sürüm: aynı hâl ikinci kez alınmaz, en çok 3 otomatik, elle olanlar kalır */
  var o1 = P.svOtomatik('a'), o2 = P.svOtomatik('b'); R.otoAyni = o1.id === o2.id;
  for (var oi = 0; oi < 5; oi++) { ul(3).text += ' ' + oi; P.svOtomatik('t' + oi); }
  R.otoSay = P.svListe(D()).filter(function (v) { return v.oto; }).length; R.elleSay = P.svListe(D()).filter(function (v) { return !v.oto; }).length;
  /* bağlantı */
  var bk = await P.ibBaglantiKur('reviewer', V1.dbId, 99, false), be = await P.ibBaglantiKur('editor', null, -5, true), bv = await P.ibBaglantiKur('reviewer', V1.dbId, 0, false);
  R.bk = { ok: bk.ok && bv.ok, url: /[?]inceleme=[0-9a-f]{48}$/.test(bk.url), be: be.ok, ortak: S.store.meta(D().id).ortak };
  await ayar({ hataKod: '42501' }); R.byetki = (await P.ibBaglantiKur('reviewer', V1.dbId, 7)).hata; await ayar({ hataKod: '22023' }); R.bgec = (await P.ibBaglantiKur('reviewer', V1.dbId, 7)).hata; await ayar({ hataKod: null });
  var cu = window.currentUser; window.currentUser = { id: 'u-capraz', is_anonymous: true }; var nR = window.__rpcSay;
  R.mis = [(await P.ibBaglantiKur('reviewer', V1.dbId, 7)).hata, (await P.ibYorumYaz(D().dbId, { body: 'x' })).hata, (await P.ibGeriAl(bk.id)).hata, (await P.ibCoz(bk.id, true)).hata]; window.currentUser = cu;
  var db0 = D().dbId; D().dbId = null; R.kayitsiz = (await P.ibBaglantiKur('reviewer', null, 7)).hata; D().dbId = db0;
  R.liste = [(await P.ibListe(D())).ok, P.IB.baglanti.length]; R.geriAl = (await P.ibGeriAl(bk.id)).ok; await P.ibListe(D()); R.geriAlindi = !!P.IB.baglanti.filter(function (l) { return l.id === bk.id; })[0].revoked_at;
  /* yorum metne dokunmaz */
  var t0 = J(D().slides), s = D().slides[1];
  R.y = [(await P.ibYorumYaz(D().dbId, { body: '  Bu cümle net değil.  ', slide_id: s.id, element_id: ul(1).id, version_id: V1.dbId })).ok, (await P.ibYorumYaz(D().dbId, { body: 'Genel', version_id: 'bozuk' })).ok, (await P.ibYorumYaz(D().dbId, { body: '   ' })).hata, (await P.ibYorumYaz(D().dbId, { body: 'u'.repeat(2500), slide_id: s.id })).ok];
  await P.ibYorumlar(D().dbId); R.yorum = P.IB.yorum.map(function (y) { return [y.scope, y.body.length, !!y.version_id, y.slide_id === s.id, y.element_id === ul(1).id]; });
  R.coz = (await P.ibCoz(P.IB.yorum[0].id, true)).ok; await P.ibYorumlar(D().dbId); R.cozuldu = !!P.IB.yorum[0].resolved_at; R.yorumAyni = J(D().slides) === t0;
  /* erişim: rol sunucudan; kesilince hesaptan çekilmez */
  await ayar({ rol: null }); var m = { id: 'yok', dbId: 'd', ortak: 'editor', remote: 1 }; R.er0 = [await P.ibErisim(m), m.dbId, m.ortak, (d.querySelector('[data-toast-t]') || {}).textContent || ''];
  await ayar({ rol: 'editor' }); R.er1 = await P.ibErisim({ id: 'yok2', dbId: 'd', ortak: 'editor' }); R.er2 = await P.ibErisim({ id: 'yok3', dbId: 'd', ortak: 'owner' });
  /* çakışma: içerik sürümü aynıysa yazılır, farklıysa çakışma kopyası (ikisi de kalır) */
  var mm = S.store.meta(D().id); mm.ortak = 'editor'; R.cak0 = await P.ibCakisma(c, D());
  var uzak = async function () { var r = await c.from('presentation_slides').select('content').eq('presentation_id', D().dbId); return J((r.data || []).map(function (x) { var y = Object.assign({}, x.content); delete y.surum; return y; })); };
  var u0s = await uzak(), idO = D().id; mm.surum = 'eski-surum'; ul(1).text = 'Çakışan yerel değişiklik.'; P.renderAll(); S.dirty(); await dur(2500);
  var kop = S.store.list.filter(function (x) { return /çakışma kopyası/.test(x.title || ''); })[0];
  var u1s = await uzak(); R.cak = { uzakAyni: u1s === u0s && u1s.indexOf('Çakışan yerel') < 0, kopya: !!kop, kopyaDb: kop ? kop.dbId : 'yok', kopyaBekleyen: kop ? kop.bekleyen : 0, kopyaMetin: kop ? (localStorage.getItem(S.store.k('d.' + kop.id)) || '').indexOf('Çakışan yerel değişiklik.') >= 0 : false };
  await dur(1500); R.cak.acilan = D().id === idO && J(D().slides).indexOf('Çakışan yerel') < 0;
  /* inceleyici görünümü: belirteç adres çubuğundan silinir, salt okunur, yorum yazılır, deste değişmez */
  var sn = P.svSnap(D()); sn.deste.slides.forEach(function (x) { delete x.notes; });
  await ayar({ acik: { presentation_id: D().dbId, role: 'reviewer', link_role: 'reviewer', title: 'P', notlar: false, version: { id: V1.dbId, version_no: 1, name: 'Sürüm bir', snapshot: sn } } });
  history.replaceState(null, '', location.pathname + '?x=1&inceleme=' + 'ab'.repeat(24)); var tb = J(D().slides), ny = P.IB.yorum.length;
  await P.ibBoot(); await bekle(800); var ib = d.querySelector('[data-ib-sahne]'), dl = ib && ib.closest('dialog');
  R.boot = { url: location.search, acik: !!(dl && dl.open), sahne: ib ? ib.textContent.slice(0, 200) : '', coz: dl ? dl.querySelectorAll('[data-ib-coz]').length : -1, no: dl ? dl.querySelector('[data-ib-no]').textContent : '', rol: dl ? dl.querySelector('.sxd-sub').textContent : '' };
  if (dl) { dl.querySelector('[data-ib-as="1"]').click(); await bekle(500); R.boot.no2 = dl.querySelector('[data-ib-no]').textContent; dl.querySelector('[data-ib-metin]').value = 'İnceleyici notu'; dl.querySelector('[data-ib-yaz]').click(); await bekle(800); }
  await P.ibYorumlar(D().dbId); var son = P.IB.yorum[P.IB.yorum.length - 1]; R.boot.yorum = [P.IB.yorum.length - ny, son.body, son.version_id === V1.dbId, son.slide_id === D().slides[1].id]; R.boot.deste = J(D().slides) === tb;
  R.inv = window.__inv.slice(inv0); R.hataK = window.__hata;
`;

/* geçersiz biçimli belirteç: sunucuya gitmez, adresten silinir */
const BOOT2 = TOHUM(false) + `
  history.replaceState(null, '', location.pathname + '?inceleme=ZZZ' + '&y=2'); await P.ibBoot(); await bekle(500);
  R.url = location.search; R.toast = (d.querySelector('[data-toast-t]') || {}).textContent || ''; R.dlg = !!d.querySelector('[data-ib-sahne]'); R.inv = window.__inv.slice(inv0); R.hataK = window.__hata;
`;
/* geri alınmış/süresi dolmuş bağlantı: sunucu "gecersiz" der, görünüm açılmaz */
const BOOT3 = TOHUM(false) + `
  await ayar({ acik: null }); history.replaceState(null, '', location.pathname + '?inceleme=' + 'cd'.repeat(24)); await P.ibBoot(); await bekle(500);
  R.url = location.search; R.toast = (d.querySelector('[data-toast-t]') || {}).textContent || ''; R.dlg = !!d.querySelector('[data-ib-sahne]'); R.inv = window.__inv.slice(inv0); R.hataK = window.__hata;
`;

const pqOlc = `var olc = function () { var D0 = d.querySelector('dialog.pq-dlg'), r = D0.getBoundingClientRect();
    return { en: innerWidth, acik: D0.open, sol: Math.round(r.left), sag: Math.round(r.right), dYatay: D0.scrollWidth - D0.clientWidth,
      tasan: Array.prototype.filter.call(D0.querySelectorAll('*'), function (x) { var b = x.getBoundingClientRect(); return b.width && x.offsetParent !== null && (b.right > r.right + 1 || b.left < r.left - 1); }).map(function (x) { return x.tagName + '.' + x.className; }).slice(0, 5) }; };`;

const E2E = (en) => TOHUM(en) + pqOlc + `
  window.confirm = function () { return true; };
  var Q = function (s) { return d.querySelector('dialog.pq-dlg ' + s); }, QA = function (s) { return d.querySelectorAll('dialog.pq-dlg ' + s); }, tik = async function (s) { var b = Q(s); if (!b) throw new Error('yok: ' + s); b.click(); await bekle(500); }, dur0 = function () { return Q('[data-pq-dur]').textContent; };
  d.querySelector('[data-pq-ac]').click(); await bekle(300); await tik('[data-pq-tab="sv"]'); R.olc0 = olc(); R.bos = !!Q('[data-sv-bos]'); R.giris = Q('[role="tabpanel"]').textContent.slice(0, 300);
  Q('[data-sv-ad]').value = 'Taslak 1'; await tik('[data-sv-kaydet]'); R.kay = { li: QA('[data-sv-liste] > li').length, dur: dur0(), metin: Q('[data-sv-liste]').textContent };
  var eski = ul(1).text; ul(1).text = 'Yeni metin satırı.'; P.renderAll();
  await tik('[data-sv-karsi="0"]'); var fk = Q('[data-sv-fark]'); R.fark = { n: fk ? fk.getAttribute('data-sv-fark') : null, metin: fk ? fk.textContent : '' };
  var s0 = J(D().slides); await tik('[data-sv-geri="0"]'); R.geri = { metin: ul(1).text === eski, dur: dur0(), li: QA('[data-sv-liste] > li').length, oto: Q('[data-sv-liste]').textContent };
  d.querySelector('[data-undo]').click(); await bekle(400); R.geriAl = J(D().slides) === s0;
  /* inceleme bağlantısı: sürümsüz inceleyici reddedilir; sürüme bağlı bağlantı; geri al */
  await tik('[data-pq-tab="sv"]'); Q('[data-ib-rol-sec]').value = 'reviewer'; Q('[data-ib-surum]').value = ''; await tik('[data-ib-kur]'); R.surumsuz = { dur: dur0(), link: !!Q('[data-ib-url]') };
  var op = Array.prototype.filter.call(QA('[data-ib-surum] option'), function (o) { return o.value; }); R.surumSecenek = op.length; Q('[data-ib-surum]').value = op[0] ? op[0].value : '';
  await tik('[data-ib-kur]'); var iu = Q('[data-ib-url] input'); R.link = { url: iu ? iu.value : '', li: QA('[data-ib-baglantilar] > li').length, dur: dur0() }; R.olc1 = olc();
  await tik('[data-ib-geri]'); R.iptal = { coz: QA('[data-ib-baglantilar] > li.coz').length, buton: QA('[data-ib-geri]').length, url: !!Q('[data-ib-url]'), dur: dur0() };
  /* yeni sunum olarak aç: eski deste değişmez */
  var idEski = D().id, mEski = S.store.meta(idEski), metinEski = ul(1).text, li = Array.prototype.filter.call(QA('[data-sv-liste] > li'), function (x) { return /Taslak 1/.test(x.textContent); })[0];
  li.querySelector('[data-sv-yeni]').click(); await bekle(800);
  var yerel = JSON.parse(localStorage.getItem(S.store.k('d.' + idEski)) || '{}'); R.yeni = { farkli: D().id !== idEski, baslik: /Taslak 1/.test(D().title), dur: dur0(), eskiMetin: (yerel.slides || [])[1] && yerel.slides[1].els.filter(function (e) { return /^(ul|t)$/.test(e.type) && !e.muted && String(e.text || '').trim().length > 8; })[0].text === metinEski, eskiListede: S.store.list.some(function (x) { return x.id === idEski; }), kontrol: J(D().slides).indexOf('"kontrol"') };
  R.olc2 = olc(); R.inv = window.__inv.slice(inv0); R.hataK = window.__hata;
`;

const VT = '--virtual-time-budget=600000';
let KROM = null;
const krom = () => KROM || (KROM = (async () => {
  if (!CHROME) return null;
  const H = yeniSunucu(), ST = { rol: 'editor', acik: null, hataKod: null }, simdi = () => new Date().toISOString();
  const hataV = (code) => ({ data: null, error: { code, message: code === '42501' ? 'yetki' : 'gecersiz' } });
  /* sahte RPC: yetki burada sınanmaz (B bölümü); yalnız istemci yolunu besler */
  H.AYAR.rpc = {
    __ayar: (a) => { Object.assign(ST, a); return { data: true, error: null }; },
    sunum_rol: () => ({ data: ST.rol, error: null }),
    review_link_create: (a, DB) => {
      if (ST.hataKod) return hataV(ST.hataKod); if (!(a.p_days >= 1 && a.p_days <= 30) || !['reviewer', 'editor'].includes(a.p_role)) return hataV('22023');
      const token = crypto.randomBytes(24).toString('hex'), l = { id: crypto.randomUUID(), presentation_id: a.p_presentation, role: a.p_role, version_id: a.p_version, notlar: !!a.p_notlar, expires_at: new Date(Date.now() + a.p_days * 864e5).toISOString(), revoked_at: null, created_at: simdi(), token_hash: crypto.createHash('sha256').update(token).digest('hex') };
      DB.presentation_review_links.push(l); return { data: { id: l.id, token, expires_at: l.expires_at }, error: null };
    },
    review_link_revoke: (a, DB) => { const l = DB.presentation_review_links.find((x) => x.id === a.p_link); if (!l) return hataV('42501'); l.revoked_at = l.revoked_at || simdi(); DB.presentation_members = DB.presentation_members.filter((m) => m.link_id !== a.p_link); return { data: true, error: null }; },
    review_open: () => (ST.acik ? { data: ST.acik, error: null } : hataV('22023')),
    comment_resolve: (a, DB) => { const y = DB.presentation_comments.find((x) => x.id === a.p_id); if (!y) return hataV('42501'); y.resolved_at = a.p_cozuldu ? simdi() : null; return { data: true, error: null }; },
  };
  await new Promise((r) => H.srv.listen(0, '127.0.0.1', r)); const port = H.srv.address().port;
  const { sayfa, kos, temizle } = duzenek();
  const rpcLog = (n0) => H.LOG.slice(n0).filter((x) => x.rpc && x.rpc !== '__ayar');
  try {
    let n0 = H.LOG.length; const out = { B: await kos('sv-birim.html', 'sv-b', sayfa('ok', port, 0, BIRIM), ['--window-size=1440,900', VT]), E: {} };
    out.B.rpc = rpcLog(n0); out.B.DB = JSON.parse(JSON.stringify({ v: H.DB.presentation_versions.length, c: H.DB.presentation_comments.map((y) => y.body) }));
    for (const [ad, g] of [['b2', BOOT2], ['b3', BOOT3]]) { n0 = H.LOG.length; out[ad] = await kos('sv-' + ad + '.html', 'sv-' + ad, sayfa('ok', port, 0, g), ['--window-size=1440,900', VT]); out[ad].rpc = rpcLog(n0); }
    for (const [ad, en, w] of [['1440', false, 1440], ['1024', false, 1024], ['390', false, 390], ['en', true, 1440]]) { n0 = H.LOG.length; out.E[ad] = await kos('sv-e2e-' + ad + '.html', 'sv-e' + ad, sayfa('ok', port, 0, E2E(en)), ['--window-size=' + w + ',900', VT]); out.E[ad].rpc = rpcLog(n0); }
    return out;
  } finally { H.srv.close(); temizle(); }
})());
const yok = (ad) => console.log('  ATLANDI  ' + ad + ': Chrome bulunamadı. Bu test GEÇTİ sayılmadı.');
const temiz = (R, ad) => { assert.equal(R.hata, undefined, ad + ' sayfa hatası: ' + R.hata); assert.deepEqual(R.inv, [], ad + ' model çağrısı'); if (R.inv.length) GUVENLIK.modelCagrisi++; assert.deepEqual(R.ag, [], ad + ' dış ağ'); if (R.ag.length) GUVENLIK.disAg++; assert.deepEqual(R.hataK, [], ad + ' konsol ' + JSON.stringify(R.hataK)); };

test('C1 sürüm elle: her tuşta/kayıtta sürüm yok; ad 80 karakter, boş ad "Adsız sürüm"; hesapta artan numara, manual_snapshot; görüntüye konuşmacı notu girer (yalnız sahip görür)', async () => {
  const K = await krom(); if (!K) return yok('C1'); const B = K.B; temiz(B, 'birim'); assert.equal(B.dbId, true);
  assert.deepEqual(B.oto0, { liste: 0, hesap: 0 }); assert.deepEqual(B.oto1, { liste: 0, hesap: 0 }, 'düzenleme sürüm üretti'); if (B.oto1.liste || B.oto1.hesap) GUVENLIK.kayitsizSurum++;
  assert.equal(B.imza.ayni, true); assert.ok(B.imza.notGirer > 0, 'sürüm notu da saklar');
  assert.deepEqual(B.k1, { ok: true, bulut: true, no: 1, ad: 'Sürüm bir', oto: 0, db: true }); assert.deepEqual(B.k2, { no: 2, adUz: 80, imzaFarkli: true }); assert.equal(B.bosAd, 'Adsız sürüm');
  assert.deepEqual(B.hesap.map((r) => [r.version_no, r.reason, r.created_by]), [[1, 'manual_snapshot', 'u-capraz'], [2, 'manual_snapshot', 'u-capraz'], [3, 'manual_snapshot', 'u-capraz']]); assert.ok(B.hesap.every((r) => r.signature));
  assert.deepEqual(B.bulut, [3, 2, 1]);
});

test('C2 svFark: aynı / eklenen / silinen / başlık (metin değil) / metin / sıra / kaynak / iddia / şablon / marka ayrı ayrı görülür', async () => {
  const K = await krom(); if (!K) return yok('C2'); const f = K.B.fark;
  assert.equal(f.ayni, true); assert.deepEqual(f.ekle, [5]); assert.deepEqual(f.sil, [2]); assert.deepEqual(f.baslik, { b: [1], m: [] }); assert.deepEqual(f.metin, [2]);
  assert.equal(f.sira, true); assert.equal(f.kaynak, 1); assert.equal(f.iddia, 1); assert.equal(f.tema, true); assert.equal(f.marka, true);
});

test('C3 geri yükleme: önce otomatik sürüm, tek geri al, metni değişen öğenin kontrolü düşer / değişmeyeninki kalır; hata ve bozuk sürümde deste birebir aynı', async () => {
  const K = await krom(); if (!K) return yok('C3'); const g = K.B.g;
  assert.deepEqual([g.ok, g.metin, g.k1, g.k2, g.undo, g.yeniSurum, g.otoAd, g.oto], [true, true, false, true, 1, 1, 'Geri yükleme öncesi', 1], JSON.stringify(g)); assert.equal(g.geri, true, 'geri al birebir');
  assert.deepEqual(K.B.gh, { ok: false, ayni: true, undo: 0 }, 'hata yolunda deste geri dönmeli'); assert.deepEqual(K.B.bozuk, ['bozuk', 'bozuk', 'hata', true]);
});

test('C4 otomatik sürüm: aynı hâl iki kez alınmaz; en çok 3 otomatik; elle sürümler silinmez', async () => {
  const K = await krom(); if (!K) return yok('C4'); assert.equal(K.B.otoAyni, true); assert.equal(K.B.otoSay, 3); assert.equal(K.B.elleSay, 3);
});

test('C5 bağlantı istemcisi: gün 1–30 sıkıştırılır (boş/0 → 7 varsayılan); rol yalnız reviewer/editor; hata kodları çevrilir; misafir ve kaydedilmemiş deste için sunucuya gidilmez; geri alma listede görünür', async () => {
  const K = await krom(); if (!K) return yok('C5'); const B = K.B;
  assert.deepEqual(B.bk, { ok: true, url: true, be: true, ortak: 'owner' }); assert.equal(B.byetki, 'yetki'); assert.equal(B.bgec, 'gecersiz');
  assert.deepEqual(B.mis, ['misafir', 'misafir', 'misafir', 'misafir']); assert.equal(B.kayitsiz, 'kayit'); assert.deepEqual(B.liste, [true, 3]); assert.equal(B.geriAl, true); assert.equal(B.geriAlindi, true);
  const cr = B.rpc.filter((x) => x.rpc === 'review_link_create'); assert.deepEqual(cr.slice(0, 3).map((x) => [x.a.p_role, x.a.p_days, x.a.p_notlar]), [['reviewer', 30, false], ['editor', 1, true], ['reviewer', 7, false]]); assert.equal(cr.length, 5, 'misafir/kayıtsız istek göndermemeli');
  for (const x of B.rpc) { const s = JSON.stringify(x.a || {}); assert.equal(/"(rol|role)"\s*:/.test(s), false, 'istemci rolü gönderildi: ' + s); if (/"(rol|role)"\s*:/.test(s)) GUVENLIK.istemciRolu++; }
});

test('C6 yorum: metne dokunmaz; kapsam deste/asetat/öğe; boş yorum gönderilmez; 2000 karakter; geçersiz sürüm kimliği gönderilmez; çözme RPC ile', async () => {
  const K = await krom(); if (!K) return yok('C6'); const B = K.B;
  assert.deepEqual(B.y, [true, true, 'bos', true]); assert.deepEqual(B.yorum.slice(0, 3), [['element', 19, true, true, true], ['deck', 5, false, false, false], ['slide', 2000, false, true, false]]);
  assert.equal(B.coz, true); assert.equal(B.cozuldu, true); assert.equal(B.yorumAyni, true, 'yorum deste metnini değiştirdi'); if (!B.yorumAyni) GUVENLIK.yorumMetniDegistirdi++;
});

test('C7 erişim ve çakışma: rol sunucudan; kesilen ortak deste hesaptan çekilmez; farklı içerik sürümünde hesaba yazılmaz, yerel iş çakışma kopyası olur (ikisi de kalır)', async () => {
  const K = await krom(); if (!K) return yok('C7'); const B = K.B;
  assert.deepEqual(B.er0.slice(0, 3), [false, null, null]); assert.match(B.er0[3], /erişimin kaldırıldı/); assert.equal(B.er1, true); assert.equal(B.er2, true);
  assert.equal(B.rpc.filter((x) => x.rpc === 'sunum_rol').length >= 2, true); assert.equal(B.cak0, false, 'aynı sürümde çakışma yok');
  assert.deepEqual([B.cak.uzakAyni, B.cak.kopya, B.cak.kopyaDb, B.cak.kopyaBekleyen, B.cak.kopyaMetin], [true, true, null, 1, true], JSON.stringify(B.cak)); if (!B.cak.uzakAyni) GUVENLIK.sessizUzerineYazma++;
  assert.equal(B.cak.acilan, true, 'çakışmadan sonra hesaptaki sürüm açılmalı');
});

test('C8 inceleme bağlantısı açılışı: belirteç adresten silinir; salt okunur görünüm, çözme düğmesi yok; yorum sürüme ve asetata bağlı; deste değişmez; geçersiz/geri alınmış bağlantı açılmaz', async () => {
  const K = await krom(); if (!K) return yok('C8'); const b = K.B.boot;
  assert.equal(b.url, '?x=1'); assert.equal(b.acik, true); assert.match(b.sahne, /Yerel Enerji/); assert.equal(b.coz, 0); assert.equal(b.no, '1 / 5'); assert.equal(b.no2, '2 / 5'); assert.match(b.rol, /Salt okunur sürüm: Sürüm bir · rol: inceleyici/);
  assert.deepEqual(b.yorum, [1, 'İnceleyici notu', true, true]); assert.equal(b.deste, true); if (!b.deste) GUVENLIK.inceleyiciYazdi++;
  assert.equal(K.B.rpc.filter((x) => x.rpc === 'review_open').length, 1);
  for (const [ad, beklenen] of [['b2', 0], ['b3', 1]]) { const X = K[ad]; temiz(X, ad); assert.equal(X.url, ad === 'b2' ? '?y=2' : '', ad + ' adres'); assert.equal(X.dlg, false, ad); assert.match(X.toast, /geçersiz, süresi dolmuş ya da geri alınmış/, ad); assert.equal(X.rpc.filter((x) => x.rpc === 'review_open').length, beklenen, ad + ' istek'); }
});

/* ---------- E: uçtan uca ---------- */
test('E1 uçtan uca 1440/1024/390 + EN: sürüm kaydet, karşılaştır, geri yükle + geri al, sürümsüz inceleyici reddi, bağlantı oluştur/geri al, yeni sunum olarak aç; taşma yok', async () => {
  const K = await krom(); if (!K) return yok('E1');
  for (const ad of ['1440', '1024', '390', 'en']) {
    const E = K.E[ad], en = ad === 'en', t = (m) => ad + ': ' + m; temiz(E, ad);
    if (ad === '390') assert.ok(E.olc0.en <= 520, t('dar ' + E.olc0.en)); else assert.equal(E.olc0.en, ad === '1024' ? 1024 : 1440);
    assert.equal(E.bos, true, t('boş liste')); assert.ok(en ? /no per-keystroke autosave/.test(E.giris) : /her tuşta otomatik kayıt yok/.test(E.giris), t(E.giris));
    assert.equal(E.kay.li, 1); assert.ok(en ? /Version saved \(in account\)/.test(E.kay.dur) : /Sürüm kaydedildi \(hesapta\)/.test(E.kay.dur), t(E.kay.dur)); assert.ok(en ? /in account/.test(E.kay.metin) : /hesapta/.test(E.kay.metin));
    assert.equal(E.fark.n, '1', t('fark ' + E.fark.metin)); assert.ok(en ? /text differs: 2/.test(E.fark.metin) : /metni farklı: 2/.test(E.fark.metin), t(E.fark.metin));
    assert.equal(E.geri.metin, true, t('geri yükleme')); assert.equal(E.geri.li, 2, t('otomatik sürüm')); assert.ok(en ? /automatic/.test(E.geri.oto) && /Version restored/.test(E.geri.dur) : /otomatik/.test(E.geri.oto) && /Sürüm geri yüklendi/.test(E.geri.dur), t(E.geri.dur));
    assert.equal(E.geriAl, true, t('geri al'));
    assert.equal(E.surumsuz.link, false, t('sürümsüz inceleyici bağlantısı')); assert.ok(E.surumsuz.dur.length > 10, t('sürümsüz uyarı'));
    assert.equal(E.surumSecenek, 1, t('yalnız hesaptaki sürüm seçilebilir')); assert.match(E.link.url, /[?]inceleme=[0-9a-f]{48}$/, t('bağlantı')); assert.equal(E.link.li, 1);
    assert.deepEqual([E.iptal.coz, E.iptal.buton, E.iptal.url], [1, 0, false], t('geri alma ' + JSON.stringify(E.iptal))); assert.ok(en ? /revoked/.test(E.iptal.dur) : /geri alındı; erişim kesildi/.test(E.iptal.dur), t(E.iptal.dur));
    assert.equal(E.rpc.filter((x) => x.rpc === 'review_link_create').length, 1, t('sürümsüz istek gönderilmemeli'));
    assert.deepEqual([E.yeni.farkli, E.yeni.baslik, E.yeni.eskiMetin, E.yeni.eskiListede], [true, true, true, true], t('yeni deste ' + JSON.stringify(E.yeni))); assert.equal(E.yeni.kontrol, -1);
    for (const o of [E.olc0, E.olc1, E.olc2]) { assert.ok(o.dYatay <= 1, t('yatay kaydırma')); assert.ok(o.sol >= -1 && o.sag <= o.en + 1, t('pencere taşıyor ' + JSON.stringify(o))); assert.deepEqual(o.tasan, [], t('taşan öğe')); }
  }
});

test('Z güvenlik sayımı: hepsi 0', async () => {
  console.log('  GÜVENLİK ' + JSON.stringify(GUVENLIK)); assert.deepEqual(Object.values(GUVENLIK), Object.keys(GUVENLIK).map(() => 0));
});

(async () => { await summary(); })();
