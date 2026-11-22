/* ==========================================================================
   ACADEX — ACADEX KIDS: KURUM TÜRÜ (tests/kids-kurum.js), 22.11.2026
   NEDEN VAR: "Örnek Anaokulu"nun içinde "2-A Sınıfı" duruyordu. Artık her okulun türü var
   (kreş, anaokulu, ilkokul); sınıfın yaş dünyası türe uyar (veritabanı denetler, yönetim formu
   yalnız uyanları gösterir). Örnek veri ikiye ayrıldı: ORNEK-2026 anaokulu, ORNEK-ILK ilkokul.
   Cümle Galaksisi ilkokulda açılır; sınıf adı "2-A" ise galaksi doğrudan 2. sınıfla başlar.
   Çalıştırma:  node tests/kids-kurum.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();
const sql = read('supabase/migrations/20261122_kids_kurum_turu.sql'), app = read('kids/assets/kids-app.js'), adm = read('js/admin-kids.js'), cumle = read('kids/assets/kids-cumle.js');
const W = { document: { createElement: () => ({}) }, localStorage: { getItem: () => null, setItem() { } } }; W.window = W; vm.createContext(W);
vm.runInContext(read('kids/assets/kids-veri.js'), W);
const V = W.KIDS_VERI;
const UYAR = { kres: ['minik', 'kasif'], anaokulu: ['minik', 'kasif'], ilkokul: ['yildiz'] };

test('örnek okullar türüne uygun sınıflarla', () => {
  assert.equal(V.OKUL.tur, 'anaokulu'); assert.equal(V.OKUL_ILK.tur, 'ilkokul');
  for (const o of V.ORNEKLER) for (const s of o.siniflar) assert.ok(UYAR[o.tur].includes(s.bant), o.ad + ' · ' + s.ad + ' (' + s.bant + ')');
  assert.ok(!V.OKUL.siniflar.some((s) => /^\d-/.test(s.ad)), 'anaokulunda 2-A gibi sınıf yok');
  assert.deepEqual(Array.from(V.OKUL_ILK.siniflar, (s) => V.ilkSinifAd(s.ad)), [2, 3, 4]);
  assert.equal(V.ornek('ORNEK-ILK'), V.OKUL_ILK); assert.equal(V.ornek('YOK-2026'), null);
  const ids = V.ORNEKLER.flatMap((o) => o.siniflar.map((s) => s.id)); assert.equal(new Set(ids).size, ids.length, 'sınıf kimlikleri tekil');
  assert.equal(V.ilkSinifAd('Papatyalar'), 0); assert.equal(V.ilkSinifAd('3-B'), 3); assert.equal(V.ilkSinifAd('4/C Sınıfı'), 4);
});
test('veritabanı: tür sütunu, kural fonksiyonu, kaydetmede denetim, uygulamaya giden yanıtlarda tür', () => {
  assert.match(sql, /add column if not exists tur text not null default 'anaokulu'/);
  assert.match(sql, /check \(tur in \('kres', 'anaokulu', 'ilkokul'\)\)/);
  assert.match(sql, /select case p_tur when 'ilkokul' then p_bant = 'yildiz' else p_bant in \('minik', 'kasif'\) end/);
  assert.match(sql, /if not public\.kids_tur_bant\(v_tur, p_bant\) then/);
  assert.match(sql, /not public\.kids_tur_bant\(v_tur, bant\)\) then\s*raise exception 'Bu okulda türe uymayan sınıflar var/);
  for (const fn of ['kids_okul_json', 'kids_okul_bul', 'kids_durum']) assert.match(sql.split('function public.' + fn)[1].split('$function$;')[0], /'tur', (o|k)\.tur/, fn + ' türü döndürür');
  assert.match(sql, /perform public\.admin_guard\(\);\s*select tur into v_tur/, 'sınıf kaydında yetki önce');
});
test('yönetim: okul formunda tür, sınıf formunda yalnız uyan yaş dünyaları', () => {
  assert.match(adm, /var TUR_BANT = \{ kres: \['minik', 'kasif'\], anaokulu: \['minik', 'kasif'\], ilkokul: \['yildiz'\] \};/);
  assert.match(adm, /name="tur" value="/); assert.match(adm, /tur: \(F\.querySelector\('\[name=tur\]:checked'\) \|\| \{\}\)\.value \|\| 'anaokulu'/);
  assert.match(adm, /TUR_BANT\[turu\(o\)\]\.map\(function \(k, i, L\)/);
});
test('Kids: örnek kodlar, tür bilgisi, galaksi ilkokulda', () => {
  assert.match(app, /data-ornek="' \+ V\.OKUL_ILK\.kod \+ '"/); assert.match(app, /if \(V\.ornek\(k\)\) \{ S\.okul = V\.ornek\(k\);/);
  assert.doesNotMatch(app, /=== V\.OKUL\.kod/, 'örnek okul kontrolleri iki okulu da tanır');
  assert.match(app, /tur: d\.okul\.tur \|\| null/); assert.match(read('kids/assets/kids-bulut.js'), /tur: o\.tur \|\| null/);
  assert.match(app, /function ilkokulMu\(\) \{ return S\.okul && S\.okul\.tur \? S\.okul\.tur === 'ilkokul'/);
  assert.match(app, /sinifAd: V\.ilkSinifAd\(S\.sinif && S\.sinif\.ad\)/);
  assert.match(cumle, /return oz && \(oz\.sinifAd === 2 \|\| oz\.sinifAd === 3 \|\| oz\.sinifAd === 4\) \? oz\.sinifAd : 0;/);
});
summary();
