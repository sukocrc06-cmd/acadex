/* ==========================================================================
   ACADEX — ACADEX KIDS KREŞLER İÇİN (tests/kids-kres.js), 14.11.2026

   NEDEN VAR: Kids binlerce kreşe satılacak. Bu turda:
     - kreşin günü: etkinlik takvimi (haftalık şablon + belirli gün ve haftalar), kreşin
       kelime seti (çocuk seti ayrı ada gibi oynar), "Bugün ne öğrendik?" veli kartı
     - kreş yöneticisi (#yonetim): sınıf, toplu öğrenci, öğretmen PIN'leri, kart basımı
     - evde devam: kartta QR (tarayıcıda üretilir, dış servise gitmez) → çocuğun resim adımı
     - yönetim panelinde kreş yönetici şifresi; tanıtım sayfasında tek giriş noktası (#giris, rol seçimi)
       (başvuru formu 14.11.2026'da kaldırıldı; sunucudaki başvuru fonksiyonları yerinde ama sitede çağrılmıyor)
   Bu dosya şunları korur:
     - SQL: her yeni fonksiyon ya iç yardımcı (kimseye açık değil) ya da yetki listesinde;
       yazma işlemleri lisans/deneme bitince kapanır; şifre ve PIN yalnız bcrypt özeti
     - QR: standart biçim (bulucu desenler, M düzeyi format bitleri, BCH doğrulaması)
     - günün bilgisi: açık plan > haftalık şablon (sunucudaki kids_gun_bilgi ile aynı sıra)
     - belirli günlerin tarihleri, hafta sonu → Cuma
     - set adası: bilinmeyen kelime atlanır, konu listesine (PAKET) girmez, kelimeler kendi
       konusunun cümleleriyle konuşur
     - veli kartında çocuk adı yok; yönetim kopyaları (js/) kids/assets ile aynı
     - davranış (gerçek Postgres, ACADEX_PG verilirse) → tests/sql/kids-kres.sql
   Tarayıcı ucu (yönetici → öğretmen → çocuk QR → başvuru, masaüstü + telefon) Playwright ile
   gerçek SQL'e karşı denendi.
   Çalıştırma:  node tests/kids-kres.js
                ACADEX_PG="-h /tmp/pg -p 5499 -U postgres" node tests/kids-kres.js
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
const SQL = 'supabase/migrations/20261114_kids_kres.sql';
const YUZ = 'supabase/migrations/20261114b_kids_yuz.sql';
const ISTEK = 'supabase/migrations/20261115_kids_istek.sql';
const yukle = (ek) => {
  const depo = {};
  const W = { document: {}, addEventListener() {}, matchMedia: () => ({ matches: false }), KIDS_SES: {}, navigator: {} };
  W.window = W;
  const ctx = vm.createContext({ window: W, localStorage: { getItem: (k) => (k in depo ? depo[k] : null), setItem: (k, v) => { depo[k] = String(v); } }, console });
  for (const f of ['kids-ciz.js', 'kids-qr.js', 'kids-kart.js', 'kids-resim.js', 'kids-resim2.js', 'kids-resim3.js', 'kids-hayvan.js', 'kids-veri.js', 'kids-konu.js', 'kids-temalar.js', 'kids-temalar2.js', 'kids-temalar3.js', 'kids-konusan.js', 'kids-kres.js'].concat(ek || [])) vm.runInContext(read('kids/assets/' + f), ctx);
  return W;
};

test('SQL: her yeni fonksiyon ya iç yardımcı ya da yetki listesinde; tablolar kapalı', () => {
  const sql = read(SQL);
  const fns = [...sql.matchAll(/create or replace function public\.(\w+)\(/g)].map((m) => m[1]);
  const kilit = sql.slice(sql.indexOf('-- iç yardımcılar'), sql.indexOf('-- kids sitesi (anon)'));
  const anon = sql.slice(sql.indexOf('-- kids sitesi (anon)'), sql.indexOf('-- yönetim paneli:'));
  const yon = sql.slice(sql.indexOf('-- yönetim paneli:'));
  for (const f of new Set(fns)) {
    const yer = [kilit, anon, yon].filter((b) => b.includes("'" + f + '(')).length;
    assert.equal(yer, 1, f + ' tam olarak bir yetki listesinde olmalı');
    const govde = sql.slice(sql.indexOf('function public.' + f + '('), sql.indexOf('$$;', sql.indexOf('function public.' + f + '(')));
    if (!/kids_konu_gecerli|kids_okunakli_sifre|kids_pin_uret/.test(f)) assert.match(govde, /security definer/, f);
  }
  for (const t of ['kids_ogretmenler', 'kids_setler', 'kids_hafta', 'kids_basvurular', 'kids_kres_log']) assert.ok(sql.includes("'" + t + "'"), t + ' RLS + revoke listesinde');
  assert.match(sql, /revoke all on public\.%I from anon, authenticated/);
  /* yönetim panelinin fonksiyonları admin_guard ile başlar */
  for (const f of ['kids_basvuru_liste', 'kids_basvuru_onayla', 'kids_basvuru_reddet', 'kids_okul_yonetici_sifre']) {
    const g = sql.slice(sql.indexOf('function public.' + f + '('));
    assert.match(g.slice(0, 900), /begin\s+perform public\.admin_guard\(\);/, f);
  }
  /* kreş yöneticisinin her yazma işlemi lisans kontrolünden geçer; okuma ve şifre değiştirme hariç */
  for (const f of fns.filter((x) => /^kids_yon_/.test(x) && !/oturum|yazma|sifre_degistir/.test(x))) {
    const g = sql.slice(sql.indexOf('function public.' + f + '('), sql.indexOf('$$;', sql.indexOf('function public.' + f + '(')));
    assert.match(g, /public\.kids_yon_yazma\(p_token\)/, f + ' lisans kapalıyken yazmamalı');
  }
  /* şifre ve PIN düz tutulmaz */
  assert.doesNotMatch(sql, /pin_ozet\s*=\s*s\b|yonetici_ozet\s*=\s*(ys|s)\b/);
  assert.equal((sql.match(/extensions\.crypt\((s|ys|os|p_yeni), extensions\.gen_salt\('bf'/g) || []).length, 7);
  /* öğretmen sınıf yetkisi: plan, gün, hafta, oturum kapatma */
  for (const f of ['kids_plan_koy', 'kids_gun_koy', 'kids_hafta_koy', 'kids_sinif_oturum_kapat']) assert.match(sql.slice(sql.indexOf('function public.' + f + '(')).slice(0, 700), /kids_sinif_yetki\(o\.okul_id, o\.ogretmen_id, p_sinif\)/, f);
  /* başvuru: KVKK onayı ve IP sınırı */
  assert.match(sql, /coalesce\(p->>'kvkk', ''\) <> 'true'/);
  assert.match(sql, /where ip = v_ip and created_at > now\(\) - interval '1 day'\) >= 3/);
});

test('QR: standart yapı, M düzeyi format bitleri, evde devam bağlantısı', () => {
  const Q = yukle().KIDS_QR;
  const adres = Q.evAdres('ACA-2026', '3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b');
  assert.equal(adres, 'https://acadex.com.tr/kids/#ev=ACA-2026~3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b');
  const M = Q.matris(adres), n = M.length;
  assert.equal(n, 37, '75 bayt → sürüm 5 (37x37)');
  /* üç bulucu desen: 7x7 çerçeve + 3x3 göbek */
  for (const [x0, y0] of [[0, 0], [n - 7, 0], [0, n - 7]]) for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
    const d = Math.max(Math.abs(x - 3), Math.abs(y - 3)); assert.equal(M[y0 + y][x0 + x], d !== 2, 'bulucu ' + x0 + ',' + y0);
  }
  /* zamanlama çizgileri */
  for (let i = 8; i < n - 8; i++) { assert.equal(M[6][i], i % 2 === 0); assert.equal(M[i][6], i % 2 === 0); }
  /* format bitleri: iki kopya aynı, BCH(15,5) geçerli, düzey M (00) */
  const b = (x, y) => (M[y][x] ? 1 : 0);
  let f1 = 0; for (let i = 0; i <= 5; i++) f1 |= b(8, i) << i; f1 |= b(8, 7) << 6 | b(8, 8) << 7 | b(7, 8) << 8; for (let i = 9; i < 15; i++) f1 |= b(14 - i, 8) << i;
  let f2 = 0; for (let i = 0; i < 8; i++) f2 |= b(n - 1 - i, 8) << i; for (let i = 8; i < 15; i++) f2 |= b(8, n - 15 + i) << i;
  assert.equal(f1, f2, 'iki format kopyası');
  const v = f1 ^ 0x5412, veri = v >>> 10; let r = veri; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
  assert.equal(((veri << 10) | r) ^ 0x5412, f1, 'BCH');
  assert.equal(veri >>> 3, 0, 'hata düzeltme M');
  assert.equal(M[n - 8][8], true, 'karanlık modül');
  assert.deepEqual({ ...Q.evCoz('#ev=aca-2026~3F2A9C1E-5B7D-4E8F-9A0B-1C2D3E4F5A6B') }, { kod: 'ACA-2026', ogr: '3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b' });
  assert.equal(Q.evCoz('#ev=../x~y'), null); assert.equal(Q.evCoz('#oyna'), null);
  assert.throws(() => Q.matris('x'.repeat(300)), /çok uzun/);
  assert.match(Q.svg('A'), /^<svg[^>]+viewBox="0 0 29 29"/);
  assert.doesNotMatch(read('kids/assets/kids-qr.js') + read('kids/assets/kids-kart.js'), /qrserver|chart\.googleapis|https?:\/\/(?!acadex\.com\.tr|fonts\.g|www\.w3\.org\/2000\/svg)/, 'QR dış servise gitmez');
});

test('kart: 8 kart bir A4, her kartta QR, ad kaçışlı; yönetim kopyaları aynı', () => {
  const W = yukle(), KK = W.KIDS_KART;
  const g = (i) => ({ id: '3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a' + String(i).padStart(2, '0'), sinif_id: 's', kimlik: 'ACA-2026-' + String(i).padStart(3, '0'), ad: i === 1 ? '<b>x</b>' : 'Çocuk ' + i, hayvan: 'kedi', sifre: ['elma', 'top'] });
  const h = KK.sayfa({ kod: 'ACA-2026', ad: 'Acadia' }, Array.from({ length: 9 }, (_, i) => g(i + 1)), [{ id: 's', ad: 'Güneş' }]);
  assert.equal((h.match(/<section class="sayfa">/g) || []).length, 2);
  assert.equal((h.match(/<div class="kart">/g) || []).length, 9);
  assert.equal((h.match(/<span class="k-qr"><svg/g) || []).length, 9);
  assert.ok(!h.includes('<b>x</b>') && h.includes('&lt;b&gt;x&lt;/b&gt;'));
  for (const f of ['kids-qr.js', 'kids-kart.js', 'kids-ciz.js']) assert.equal(read('js/' + f).split('\n').slice(2).join('\n'), read('kids/assets/' + f).split('\n').slice(2).join('\n'), 'js/' + f + ' kopyası güncel değil');
  const html = read('admin.html'), i = (s) => html.indexOf(s);
  assert.ok(i('js/kids-ciz.js') < i('js/kids-qr.js') && i('js/kids-qr.js') < i('js/kids-kart.js') && i('js/kids-kart.js') < i('js/admin-kids.js'));
  assert.match(read('js/admin-kids.js'), /window\.KIDS_KART\.sayfa\(o, liste, siniflar\)/);
});

test('belirli günler: tarih kuralları, hafta sonu Cuma, yaklaşanlar sıralı', () => {
  const KR = yukle().KIDS_KRES, t = (ad, y) => { const d = KR.ozelTarih(KR.OZEL.find((o) => o.ad === ad), y); return [d.getFullYear(), d.getMonth() + 1, d.getDate()].join('-'); };
  assert.equal(t('Anneler Günü', 2027), '2027-5-9');            // Mayıs'ın 2. pazarı
  assert.equal(t('Babalar Günü', 2027), '2027-6-20');           // Haziran'ın 3. pazarı
  assert.equal(t('Kütüphaneler Haftası', 2027), '2027-3-29');   // Mart'ın son pazartesisi
  assert.equal(t('Enerji Tasarrufu Haftası', 2027), '2027-1-11');
  assert.equal(t('Trafik ve İlk Yardım Haftası', 2027), '2027-5-3');
  assert.equal(t('Hayvanları Koruma Günü', 2026), '2026-10-4');
  const cuma = KR.isGunu(new Date(2026, 9, 4));                 // 4 Ekim 2026 Pazar
  assert.equal(cuma.getDay(), 5); assert.equal(cuma.getDate(), 2);
  const l = KR.yaklasan(new Date(2026, 10, 14), 30);
  assert.ok(l.length >= 3 && l.every((x, i) => !i || l[i - 1].gun <= x.gun));
  assert.ok(l.some((x) => x.o.ad === 'Öğretmenler Günü'));
  const V = yukle().KIDS_VERI; for (const o of KR.OZEL.concat(KR.HAFTALIK)) { assert.ok(V.konuBul(o.konu), o.ad + ' konusu'); assert.ok(o.ad.length <= 40, o.ad + ' sunucuda en çok 40 harf'); }
});

test('günün bilgisi: açık plan > haftalık şablon; hafta sonu şablon yok', () => {
  const W = yukle(), KR = W.KIDS_KRES;
  const set = { id: 'k1', ad: 'Sonbahar', kelimeler: ['leaf', 'rain', 'autumn'] };
  const sinif = { id: 's', plan: { '2026-11-17': 'colours' }, gunler: { '2026-11-16': { konu: 'fruits', etkinlik: 'Meyve günü', set: 'k1' } }, hafta: { 3: { konu: 'seasons', etkinlik: 'Bahçe günü', set: null } } };
  const o = { bulut: true, setler: [set] }, g = (d) => KR.gunBilgi(sinif, new Date(d + 'T12:00:00'), o);
  assert.deepEqual([g('2026-11-16').konu, g('2026-11-16').etkinlik, g('2026-11-16').set.ad, g('2026-11-16').kaynak], ['fruits', 'Meyve günü', 'Sonbahar', 'plan']);
  assert.deepEqual([g('2026-11-17').konu, g('2026-11-17').kaynak], ['colours', 'plan'], 'eski konu planı');
  assert.deepEqual([g('2026-11-18').etkinlik, g('2026-11-18').kaynak], ['Bahçe günü', 'hafta'], 'Çarşamba şablonu');
  assert.equal(g('2026-11-25').etkinlik, 'Bahçe günü', 'her hafta tekrar eder');
  assert.equal(g('2026-11-21').kaynak, null, 'Cumartesi');
  /* örnek okul: bu tarayıcıda */
  W.KIDS_VERI.koy('kres.ORNEK-2026', { setler: [set], gunler: {}, hafta: { papatya: { 5: { konu: 'toys', etkinlik: 'Oyuncak günü', set: 'k1' } } } });
  const y = KR.gunBilgi({ id: 'papatya' }, new Date('2026-11-20T12:00:00'), { bulut: false, setler: [set] });
  assert.deepEqual([y.konu, y.etkinlik, y.set.ad, y.kaynak], ['toys', 'Oyuncak günü', 'Sonbahar', 'hafta']);
});

test('set adası: geçici paket, bilinmeyen kelime atlanır, kelime kendi konusunun cümlesiyle konuşur', () => {
  const W = yukle(), KR = W.KIDS_KRES, K = W.KIDS_KONU, V = W.KIDS_VERI, KS = W.KIDS_KONUSAN;
  const kid = KR.setKaydet({ id: 'db168e23-c71d-4b49-9be2-64dac2ff8d06', ad: 'Karışık', kelimeler: ['red', 'dog', 'apple', 'yok-boyle-kelime', 'leaf'] });
  assert.equal(kid, 'set-db168e23c7'); assert.match(kid, /^[a-z0-9@_-]{1,40}$/, 'ilerleme anahtarı biçimi');
  const P = K.al(kid);
  assert.deepEqual([...P.liste.map((x) => x.id)], ['red', 'dog', 'apple', 'leaf']);
  assert.equal(P.oyun3, null); assert.equal(P.sarki, null); assert.equal(K.oyunSay(kid), 3); assert.equal(K.yildizMax(kid), 9);
  assert.ok(!K.PAKET.includes(kid), 'konu listesine girmez'); assert.equal(V.ogeKonu('dog'), 'animals', 'kelimenin konusu değişmez');
  assert.ok(V.konuBul(kid).sinifSeti); assert.ok(!V.KONU.some((k) => k.id === kid), 'haritada ada olmaz');
  const x = (id) => P.liste.find((o) => o.id === id);
  assert.equal(KS.replik(kid, x('red'), P).ben, 'Hi! I\'m red!');
  assert.equal(KS.replik(kid, x('dog'), P).ben, 'Hi! I\'m a dog!');
  assert.match(P.gorsel(x('red')), /<svg/); assert.match(P.balon.soz(x('apple')), /apple/i);
  assert.equal(KR.setKaydet({ id: 'x', ad: 'az', kelimeler: ['red', 'yok'] }), null, '3 kelimeden az');
  const app = read('kids/assets/kids-app.js');
  assert.match(app, /Pk\.sarki \? \[\{ id: 'sarki'/); assert.match(app, /if \(\(V\.konuBul\(kid\) \|\| \{\}\)\.sinifSeti\) return setBitti\(kid\);/);
  assert.match(app, /data-setoyna/); assert.match(app, /S\.etkinlik = d\.etkinlik \|\| ''; S\.set = d\.set \|\| null;/);
  const kat = require(path.join(ROOT, 'kids/ses/katalog.js'))(), en = new Set(kat.filter((k) => k.dil === 'en').map((k) => k.metin)), tr = new Set(kat.filter((k) => k.dil === 'tr').map((k) => k.metin));
  for (const m of [P.izleGiris, P.bitis, P.hafiza.soz]) assert.ok(en.has(m), 'katalogda yok: ' + m);
  assert.ok(tr.has(P.dokunYon));
});

test('veli kartı: günün kelimeleri, iki soru, çocuk adı yok; yönetici yardımcıları', () => {
  const W = yukle(['kids-bulut.js', 'kids-yonetici.js']), KR = W.KIDS_KRES, Y = W.KIDS_YONETICI;
  const set = { id: 'k1', ad: 'Sonbahar', kelimeler: ['leaf', 'rain', 'autumn', 'pumpkin'] };
  const ctx = { bulut: true, setler: () => [set], okul: { ad: 'Acadia Kreş', kod: 'ACA-2026' }, sinif: { id: 's', ad: 'Güneş', bant: 'kasif', gunler: { '2026-11-16': { konu: 'seasons', etkinlik: 'Bahçe günü', set: 'k1' } }, ogr: [['Ada K.', 'kedi', 'id1']] } };
  const v = KR.kartVeri(ctx, new Date('2026-11-16T12:00:00')), m = KR.kartMetin(v);
  assert.equal(v.kelimeler.length, 4); assert.equal(v.sorular.length, 2);
  assert.match(m, /Bugün: Bahçe günü/); assert.match(m, /• leaf \(yaprak\)/); assert.match(m, /acadex\.com\.tr\/kids/);
  assert.ok(!m.includes('Ada'), 'kartta çocuk adı yok');
  const k2 = KR.kartVeri({ ...ctx, sinif: { ...ctx.sinif, gunler: { '2026-11-16': { konu: 'animals', etkinlik: '', set: null } } } }, new Date('2026-11-16T12:00:00'));
  assert.equal(k2.kelimeler.length, Math.min(10, W.KIDS_KONU.al('animals').ogeler(W.KIDS_VERI.BANT.kasif).length), 'konu: sınıfın yaş dünyası kadar kelime (en çok 10)');
  /* toplu öğrenci: Excel yapıştırması ve KVKK kısaltması (yönetim paneliyle aynı) */
  assert.deepEqual([...Y.adlariAyikla('1. Ada Kaya\nMert\tYılmaz\n\n  Elif  Sarı ; 5 yaş\n123\nCan\t5')], ['Ada Kaya', 'Mert Yılmaz', 'Elif Sarı', 'Can']);
  assert.equal(Y.adKisalt('  Ayşe   Nur  Kaya '), 'Ayşe Nur K.'); assert.equal(Y.adKisalt('ali özdemir'), 'ali Ö.'); assert.equal(Y.adKisalt('Defne'), 'Defne');
  assert.equal(Y.kalanYazi({ acik: false, odeme: 'deneme' }), 'Deneme süreniz bitti'); assert.equal(Y.kalanYazi({ acik: true, kalan_gun: 9 }), '9 gün kaldı');
});

test('bağlantılar: yönlendirme, öğretmen paneli, başvuru formu, paket', () => {
  const yon = read('kids/assets/kids-yon.js'), og = read('kids/assets/kids-ogretmen.js'), b = read('kids/assets/birlestir.js'), html = read('kids/index.html'), sayfa = read('kids/assets/sayfa.html');
  assert.match(yon, /h === 'oyna' \|\| \/\^ev=\/\.test\(h\) \? 'oyna'/); assert.match(yon, /h === 'yonetim' \? 'yonetim'/);
  assert.match(og, /W\.KIDS_KRES\.bolum\(kresCtx\(sinif\)\)/); assert.match(og, /W\.KIDS_KRES\.konuKoy\(kresCtx\(sinif\), gun, konu, mesaj\)/);
  assert.match(og, /h\[0\]\.getDate\(\) \+ 61/, 'iki aylık plan yüklenir (sunucu en çok 62 gün)');
  for (const f of ['kids-qr.js', 'kids-kart.js', 'kids-kres.js', 'kids-yonetici.js', 'kids-kres.css']) assert.ok(b.includes("'" + f + "'"), f + ' paketlenmiyor');
  assert.ok(b.indexOf("'kids-kres.js'") > b.indexOf("'kids-konusan.js'") && b.indexOf("'kids-kres.js'") < b.indexOf("'kids-app.js'"));
  for (const s of ['KIDS_KRES', 'KIDS_YONETICI', 'KIDS_QR', 'KIDS_KART', 'id="kids-yonetim"', 'id="kids-giris"']) assert.ok(html.includes(s), 'index.html yeniden üretilmeli: ' + s);
  /* 14.11.2026 (2): demo ve eski başvuru formu kaldırıldı; giriş #giris (rol seçimi).
     15.11.2026: kreş istekleri "Kreşim için teklif al" penceresinden (kids-teklif.js, tests/kids-teklif.js); #basvuru/#demo da onu açar. */
  assert.doesNotMatch(sayfa, /Demo isteyin|data-basvuru-form|id="basvuru"|href="#demo"|href="#basvuru"/);
  assert.match(sayfa, /<a class="kl-dugme kl-dugme-k kl-dugme-b kl-giris-ust" href="#giris">Giriş yap<\/a>/);
  assert.match(yon, /h === 'giris' \? 'giris' : 'tanitim'/);
  for (const r of ['#oyna', '#ogretmen', '#yonetim']) assert.ok(yon.includes("['" + r + "'"), 'giriş ekranında ' + r);
  assert.doesNotMatch(read('kids/assets/kids-landing.js'), /kids_basvuru_yap|KIDS_BULUT\.basvuru/);
  const bulut = read('kids/assets/kids-bulut.js');
  for (const fn of ['kids_gun_koy', 'kids_hafta_koy', 'kids_set_kaydet', 'kids_set_sil', 'kids_yonetici_giris', 'kids_yonetici_veri']) { assert.ok(bulut.includes("'" + fn + "'"), fn); assert.ok(read(SQL).includes('function public.' + fn + '('), fn + ' SQL'); }
  const yonJs = read('kids/assets/kids-yonetici.js');
  for (const fn of [...yonJs.matchAll(/yaz\('(\w+)'/g)].map((m) => m[1]).concat(['sifre_degistir'])) assert.ok(read(SQL).includes('function public.kids_yon_' + fn + '('), 'kids_yon_' + fn + ' SQL');
});

test('davranış (gerçek Postgres): yönetici, PIN, set, takvim, çocuk, başvuru, deneme, yetki', () => {
  const pg = process.env.ACADEX_PG;
  if (!pg) { console.log('    (ACADEX_PG yok: davranış testi atlandı)'); return; }
  const P = 'psql ' + pg + ' -q -v ON_ERROR_STOP=1', q = (f) => JSON.stringify(path.join(ROOT, f));
  execSync(P + ' -d postgres -c "drop database if exists ax_kres" -c "create database ax_kres"', { stdio: 'pipe' });
  try {
    for (const f of ['tests/sql/kids-yonetim-stub.sql', 'supabase/migrations/20261110_kids_yonetim.sql', 'supabase/migrations/20261110b_kids_giris.sql',
      'supabase/migrations/20261112c_kids_temalar_ve_sertlestirme.sql', 'supabase/migrations/20261112d_kids_oturum_yonetimi.sql', SQL, SQL, YUZ, YUZ]) execSync(P + ' -d ax_kres -f ' + q(f), { stdio: 'pipe' });
    const out = execSync(P + ' -d ax_kres -f ' + q('tests/sql/kids-kres.sql') + ' 2>&1').toString();
    assert.match(out, /KRES AKIS GECTI/); assert.match(out, /KRES YETKI GECTI/);
    assert.match(execSync(P + ' -d ax_kres -f ' + q('tests/sql/kids-yuz.sql') + ' 2>&1').toString(), /YUZ GECTI/);
    /* 15.11.2026: istekler (e-posta zorunlu, telefon isteğe bağlı, durum + not); var olan başvurular üzerinde iki kez */
    for (const f of [ISTEK, ISTEK]) execSync(P + ' -d ax_kres -f ' + q(f), { stdio: 'pipe' });
    const ist = execSync(P + ' -d ax_kres -f ' + q('tests/sql/kids-istek.sql') + ' 2>&1').toString();
    assert.match(ist, /ISTEK AKIS GECTI/); assert.match(ist, /ISTEK YETKI GECTI/);
  } finally { execSync(P + ' -d postgres -c "drop database if exists ax_kres"', { stdio: 'pipe' }); }
});

summary();
