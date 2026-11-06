/* ==========================================================================
   ACADEX — MEDICA "ÇAĞ ATLAMA" PAKETİ TESTLERİ (tests/klinik-canli.js), 06.11.2026

   NEDEN VAR: Acadex Medica muayene odası dört yeni katman kazandı:
     1) canlı hasta: vitaller zamanla akar; tedavisiz kötüleşir, doğru karar/müdahale düzeltir;
        NEWS2, kritik uyarı, vital seyri, "hasta güvenliği" puanı (labs/klinik/klinik-fizyoloji.js)
     2) elle muayene: steteskopla kalp/akciğer/karın sesleri (Web Audio sentezi), palpasyonda
        hassasiyet ve hastanın yüz tepkisi (labs/klinik/klinik-muayene.js)
     3) yapay zekâ hasta: serbest soru (yazı ya da ses), sunucuda senaryoya sadık cevap
        (supabase/functions/medica-hasta), yoksa yerel eşleme; puan hazır soru üzerinden
     4) sinematik hastane: kameranın hastaya yaklaşması, odaya süzülme, konuşana yakınlaşma,
        asansör yolculuğu, ortam sesi ve sesli anons, sesli sahne (konuşma sentezi)
   Çalıştırma:  node tests/klinik-canli.js
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
const F = require(path.join(ROOT, 'labs/klinik/klinik-fizyoloji.js'));
const ctx = { window: {} };
vm.runInNewContext(read('labs/diyet/data/who2007-bki.js'), ctx);
const M = require(path.join(ROOT, 'labs/diyet/diyet-model.js')); M.load(ctx.window.AXDB);
const SEN = {};
[require(path.join(ROOT, 'labs/klinik/senaryo-anatomi.js')), require(path.join(ROOT, 'labs/klinik/senaryo-fizyo.js')), require(path.join(ROOT, 'labs/klinik/senaryo-odyoloji.js')),
  require(path.join(ROOT, 'labs/klinik/senaryo-diyet.js'))(M), require(path.join(ROOT, 'labs/klinik/senaryo-dkt.js')),
  require(path.join(ROOT, 'labs/klinik/senaryo-eczacilik.js')), require(path.join(ROOT, 'labs/klinik/senaryo-hemsirelik.js'))].forEach((L) => L.forEach((s) => { SEN[s.id] = s; }));
const klinik = read('labs/klinik/klinik.js'), mua = read('labs/klinik/klinik-muayene.js'), med = read('labs/medica/medica.js'), html = read('labs/medica/index.html');

test('fizyoloji: NEWS2 resmî tabloyla aynı; eksik solunum örüntüden türetilir', () => {
  assert.equal(F.news2({ rr: 16, spo2: 97, sys: 120, hr: 80, ates: 36.8 }), 0);
  assert.equal(F.news2({ rr: 25, spo2: 91, sys: 90, hr: 131, ates: 39.2 }), 3 + 3 + 3 + 3 + 2);
  assert.equal(F.news2({ rr: 21, spo2: 94, sys: 105, hr: 95, ates: 38.5 }), 2 + 1 + 1 + 1 + 1, 'SpO₂ 94 → 1 puan');
  assert.equal(F.risk(7), 'yüksek'); assert.equal(F.risk(5), 'orta'); assert.equal(F.risk(0), 'yok');
  assert.equal(F.kur({ nabiz: 90, spo2: 89 }).rr, 26, 'hipoksik hasta hızlı solur');
  assert.equal(F.kur({ nabiz: 80, ta: '120/80', spo2: 98 }).rr, 16);
  assert.deepEqual(F.kur({ nabiz: 124, ta: '92/58', spo2: 89 }).orunt, ['hipoksi', 'sok']);
  assert.deepEqual(F.kur({ nabiz: 76, ta: '122/78', spo2: 98 }).orunt, [], 'stabil hasta kötüleşmez');
});
test('fizyoloji: tedavisiz kötüleşir, doğru müdahale düzeltir; sınırlar gerçekçi; stabil hasta sabit kalır', () => {
  const a = F.kur({ nabiz: 124, ta: '92/58', spo2: 89 }), ilk = F.news2(a);
  for (let i = 0; i < 180; i++) F.ilerle(a, 1);
  assert.ok(a.spo2 < 89 && a.sys < 92 && a.hr > 124, 'tedavisiz 3 dk');
  assert.ok(F.news2(a) >= ilk); assert.ok(a.kritikSn > 0, 'kritikte geçen süre sayılır (45 sn paydan sonra)');
  assert.equal(F.uygula(a, 'o2').uygun, true); assert.equal(F.uygula(a, 'sivi').uygun, true);
  assert.equal(F.uygula(a, 'o2').uygun, null, 'aynı müdahale iki kez sayılmaz');
  for (let i = 0; i < 180; i++) F.ilerle(a, 1);
  assert.ok(a.spo2 >= 94 && a.sys >= 100, 'tedaviyle düzelir: ' + JSON.stringify(F.vital(a)));
  const z = F.kur({ nabiz: 120, ta: '80/40', spo2: 80 }); for (let i = 0; i < 3600; i++) F.ilerle(z, 1);
  assert.ok(z.spo2 >= 78 && z.sys >= 62 && z.hr <= 170, 'kötüleşme sınırda durur (ölüm yok)');
  const s = F.kur({ nabiz: 76, ta: '122/78', spo2: 98 }); for (let i = 0; i < 600; i++) F.ilerle(s, 1);
  assert.deepEqual([Math.round(s.hr), Math.round(s.sys), Math.round(s.spo2)], [76, 122, 98]);
  assert.equal(F.uygula(s, 'o2').uygun, false, 'SpO₂ normalken O₂ gereksiz'); assert.equal(F.uygula(s, 'sivi').uygun, false);
  assert.ok(F.guvenlik(s) < 100, 'gereksiz müdahale güvenlik puanını düşürür');
  const k = F.kur({ nabiz: 118, ta: '96/60', spo2: 92 }); F.karar(k, false); assert.ok(k.hiz > 1, 'yanlış karar kötüleşmeyi hızlandırır'); F.karar(k, true); assert.ok(k.stabil.sok && k.stabil.hipoksi);
  const v = F.ayarla(F.kur({ nabiz: 80, ta: '120/80', spo2: 98 }), { spo2: 88 }); assert.ok(v.orunt.indexOf('hipoksi') >= 0, 'senaryo vitali değiştirince örüntü güncellenir');
});
test('bulgular: senaryo metninden; yanlış pozitif yok (nöral, krepitasyon, aritmi riski); açık muayene alanı geçerli', () => {
  const b = (id) => F.bulgular(SEN[id]);
  assert.equal(b('ana-apandisit').karin.hassas, 'sag-alt'); assert.equal(b('ana-apandisit').karin.tip, 'peritonit');
  assert.equal(b('ana-kot').akciger.sag, 'azalmis'); assert.equal(b('ana-kot').akciger.sol, 'normal', '“solunum” sözcüğü sol sayılmaz');
  assert.equal(b('ana-inme').kalp.tip, 'duzensiz');
  for (const id of ['fz-bel', 'ody-v-ani', 'ody-v-meniere', 'dyt-e-refeed']) { const x = b(id); assert.equal(x.akciger.tip + x.kalp.tip, 'normalnormal', id); }
  assert.equal(b('hem-pnomoni').akciger.sag, 'ral'); assert.equal(b('hem-kky').akciger.sol, 'ral');
  assert.equal(F.dinle(b('hem-pnomoni'), 'akc-sag-alt').tip, 'ral'); assert.equal(F.dinle(b('hem-pnomoni'), 'akc-sag-ust').tip, 'normal', 'raller bazalde');
  assert.equal(F.palpe(b('ana-apandisit'), 'sag-alt').agri, true); assert.equal(F.palpe(b('ana-apandisit'), 'sol-alt').rovsing, true, 'Rovsing');
  assert.equal(F.palpe(b('ana-apandisit'), 'sol-ust').agri, false);
  for (const z of Object.keys(F.BOLGE)) assert.ok(F.dinle(b('ana-radial'), z).metin, z);
  for (const s of Object.values(SEN)) assert.doesNotThrow(() => F.bulgular(s), s.id);
});
test('serbest soru: Türkçe eklere dayanıklı yerel eşleme; ilgisiz soruda eşleşme yok; iletişim türü', () => {
  const sor = SEN['ana-apandisit'].adimlar.filter((a) => a.tip === 'sor')[0].secenek;
  assert.equal(F.eslestir('Ağrınız nasıl başladı, anlatır mısınız?', sor).id, sor.filter((o) => /başladığı yerde/.test(o.t))[0].id);
  assert.equal(F.eslestir('Ateşiniz var mı?', sor).id, sor.filter((o) => /Ateş/.test(o.t))[0].id);
  assert.equal(F.eslestir('En sevdiğiniz renk hangisi?', sor), null);
  assert.equal(F.soruTuru('Ağrıyı biraz anlatır mısınız?'), 'acik'); assert.equal(F.soruTuru('Ateşiniz var mı?'), 'kapali'); assert.equal(F.soruTuru('Alkol aldınız değil mi?'), 'yonlendirici');
});
test('elle muayene: bölgeler, sesler sentez (dosya yok), klavye, hareket azaltma, yüz tepkisi', () => {
  for (const z of ['aort', 'pulmoner', 'trikuspit', 'mitral', 'akc-sag-ust', 'akc-sol-alt', 'epigastrium', 'sag-alt', 'sol-alt']) assert.ok(mua.includes("['" + z + "',"), z);
  assert.match(mua, /createBiquadFilter/); assert.doesNotMatch(mua, /\.(mp3|wav|ogg)\b/, 'ses dosyası yok');
  assert.match(mua, /r\.tip === 'duzensiz'\) per \*= 0\.6 \+ Math\.random\(\) \* 0\.8/, 'düzensiz ritim');
  assert.match(mua, /if \(r\.tip === 'wheezing'\)/); assert.match(mua, /if \(r\.tip === 'ral'\)/);
  assert.match(mua, /data-zb=/, 'klavye/dokunma için bölge düğmeleri');
  assert.match(mua, /@media \(prefers-reduced-motion:reduce\)\{\.axm2,\.axm2 \*\{animation:none!important/);
  assert.match(mua, /“Ah! Orası çok acıyor\.”/);
  assert.ok(html.indexOf('klinik-fizyoloji.js') < html.indexOf('klinik-muayene.js') && html.indexOf('klinik-muayene.js') < html.indexOf('../klinik/klinik.js'), 'betik sırası');
});
test('muayene odası: motor, müdahale, seyir, güvenlik, serbest soru, sesli sahne, kamera bağlı', () => {
  assert.match(klinik, /var FZ = W\.AXFIZ && sen\.vital \? W\.AXFIZ\.kur\(vit\) : null/);
  assert.match(klinik, /W\.AXFIZ\.ilerle\(FZ, 1\); fzSenk\(\); vitalYaz\(MON\.sonAlarm\); fzCiz\(\);/);
  assert.match(klinik, /if \(FZ\) \{ W\.AXFIZ\.karar\(FZ, !!o\.dogru\); fzCiz\(\); \}/, 'karar fizyolojiyi etkiler');
  assert.match(klinik, /R\.guvenlik = W\.AXFIZ\.guvenlik\(FZ\)/);
  assert.match(klinik, /clearInterval\(FZK && FZK\.iv\); if \(MU\) MU\.kapat\(\);/, 'kapanınca zamanlayıcı ve muayene temizlenir');
  assert.match(klinik, /if \(opt\.aiSor\) \{/); assert.match(klinik, /var zt = setTimeout\(function \(\) \{ cevapla\(null\); \}, 9000\);/, 'yapay zekâ gecikirse yerel eşleme');
  assert.match(klinik, /if \(o\) \{ SS\.isabet\+\+; kullan\.push\(o\.id\);/, 'denk gelen hazır soru kullanılmış sayılır (puan değişmez)');
  assert.match(klinik, /var dolu = a\.hak && kalan\(\) <= 0;/, 'hak sınırı serbest soruda da geçerli');
  assert.match(klinik, /u\.lang = 'tr-TR'/); assert.match(klinik, /kim === 'anlatici' \|\| kim === 'sen'\) return;/);
  assert.match(klinik, /if \(!sv \|\| RM \|\| W\.innerWidth < 900\) return;/, 'kamera hareket azaltmada ve dar ekranda yok');
  assert.match(klinik, /@media \(prefers-reduced-motion:reduce\)\{\.axk-scene svg\.room\{transition:none!important;animation:none!important;transform:none!important\}/);
  const K = require(path.join(ROOT, 'labs/klinik/klinik.js'));
  for (const s of Object.values(SEN)) assert.deepEqual(K.denetle(s), [], s.id + ' (muayene alanı denetimi bozmaz)');
});
test('yapay zekâ hasta: anahtar sunucuda, oturum şart, cevap senaryoya sınırlı; köprü yalnız MedLab içinde', () => {
  const fn = read('supabase/functions/medica-hasta/index.ts'), ac = read('js/acadex-medlab-acadia.js');
  assert.match(fn, /await userClient\.auth\.getUser\(\)/); assert.match(fn, /Deno\.env\.get\('GROQ_API_KEY'\)/);
  assert.match(fn, /response_format: \{ type: 'json_object' \}/); assert.match(fn, /yeni belirti, ilaç veya hastalık UYDURMA/); assert.match(fn, /tanı koyma/);
  assert.match(fn, /filter\(\(x: string\) => ids\.has\(x\)\)/, 'yalnız senaryodaki kimlikler döner');
  assert.doesNotMatch(klinik + med + ac + mua, /GROQ|gsk_|service_role/i, 'tarayıcıda anahtar yok');
  assert.match(med, /aiSor: EMB \? aiSor : null/); assert.match(med, /if \(d\.type === 'ai-hasta-cevap'\) \{ var cb = AIQ\[d\.id\];/);
  assert.match(ac, /cli\.functions\.invoke\('medica-hasta', \{ body: d\.req \}\)/);
});
test('sinematik hastane: kamera yaklaşır, asansör akar, ortam sesi isteğe bağlı ve sesli anons', () => {
  assert.match(med, /setTimeout\(function \(\) \{ sh\.classList\.add\('yaklas'\); \}, 350\);/); assert.match(med, /if \(sh && hb && !RM\)/);
  assert.match(med, /ov\.className = 'md-asansor ' \+ \(to < from \? 'asagi' : 'yukari'\);/);
  assert.match(html, /<i class="akis"><\/i>/); assert.match(html, /\.md-asansor\.asagi\.kapan:not\(\.acil\) \.akis\{animation-name:akis-a\}/);
  assert.match(html, /id="md-ort" aria-pressed="false"/); assert.match(med, /setTimeout\(function \(\) \{ anonsOku\(metin\); \}/);
  assert.match(med, /var ORT = \{ on: false/, 'ortam sesi kapalı başlar');
});
summary();
