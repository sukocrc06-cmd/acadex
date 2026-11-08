/* ==========================================================================
   ACADEX — KVKK METİNLERİ VE KAYIT ONAYLARI (tests/kvkk.js), 08.11.2026

   NEDEN VAR: Gizlilik politikası pilot döneminden kalmıştı (yalnız İşletme Fakültesi,
   geçersiz iletişim adresi, eksik hizmet sağlayıcılar); KVKK Aydınlatma Metni, Açık Rıza
   Metni, çerez politikası ve başvuru yolu yoktu; kayıtta tek kutu hem şartları kabul hem
   aydınlatmayı "kabul" ettiriyordu. KVK Kurulu'nun 24.03.2026 ilke kararına göre aydınlatma
   ve açık rıza ayrı olmalı, açık rıza hizmet şartına bağlanmamalı.
   Bu dosya metinlerin yerinde ve tutarlı olduğunu, kayıt ekranının ayrımı koruduğunu sınar.
   Metinler TASLAKTIR; yayından önce bir hukukçu okumalıdır.
   Çalıştırma:  node tests/kvkk.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();
const K = read('kvkk.html');

test('kvkk.html: dört bölüm, veri sorumlusu, sürüm, iletişim', () => {
  for (const id of ['aydinlatma', 'acik-riza', 'cerez', 'basvuru']) assert.match(K, new RegExp('<section id="' + id + '"'), id);
  assert.match(K, /Veri sorumlusu, Acadex'in kurucusu <strong>Şükrü Çerçi<\/strong>'dir/);
  assert.match(K, /Metin sürümü: 08\.11\.2026/);
  assert.match(K, /destek@acadex\.com\.tr/);
  assert.doesNotMatch(K, /pilot-admin|business\.edu/);
});

test('aydınlatma: md. 10 unsurları (amaç, hukuki sebep, aktarım, yöntem, haklar) ve tüm hizmet sağlayıcılar', () => {
  const a = K.slice(K.indexOf('<section id="aydinlatma"'), K.indexOf('<section id="acik-riza"'));
  for (const h of ['1. Veri sorumlusu', '2. İşlenen kişisel veriler', '3. İşleme amaçları ve hukuki sebepler', '4. Toplama yöntemi', '5. Aktarılan taraflar ve yurt dışına aktarım', '6. Saklama süresi', '7. Haklarınız']) assert.ok(a.includes(h), h);
  for (const s of ['Supabase', 'Vercel', 'Groq', 'Gemini', 'OpenAI', 'ElevenLabs', 'OCR.space', 'PDF.co', 'Tavily', 'Resend', 'iyzico']) assert.ok(a.includes(s), s);
  /* kodda kullanılan her dış yapay zekâ/servis metinde anılmalı */
  const fn = fs.readdirSync(path.join(ROOT, 'supabase/functions')).map((d) => { const f = path.join(ROOT, 'supabase/functions', d, 'index.ts'); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''; }).join('\n');
  const HARITA = { 'api.groq.com': 'Groq', 'generativelanguage.googleapis.com': 'Gemini', 'api.openai.com': 'OpenAI', 'api.elevenlabs.io': 'ElevenLabs', 'api.ocr.space': 'OCR.space', 'api.pdf.co': 'PDF.co', 'api.tavily.com': 'Tavily', 'api.resend.com': 'Resend', 'iyzipay.com': 'iyzico' };
  for (const [host, ad] of Object.entries(HARITA)) if (fn.includes(host)) assert.ok(a.includes(ad), host + ' kullanılıyor ama aydınlatmada yok');
  assert.match(a, /Fransa \(Paris, AB\)/, 'Supabase bölgesi eu-west-3');
  assert.match(a, /KVKK'nın 9\. maddesi/);
  assert.match(a, /Aydınlatma bir onay değildir/);
});

test('açık rıza: ayrı, isteğe bağlı, geri alınabilir, hizmete şart değil', () => {
  const r = K.slice(K.indexOf('<section id="acik-riza"'), K.indexOf('<section id="cerez"'));
  assert.match(r, /isteğe bağlıdır/); assert.match(r, /Rıza vermeseniz de Acadex'in tüm özelliklerini aynı şekilde kullanırsınız/);
  assert.match(r, /geri alabilirsiniz/); assert.match(r, /6563 sayılı Kanun/);
});

test('çerez: reklam/izleme yok; sitede üçüncü taraf analiz betiği yok', () => {
  assert.match(K, /reklam, izleme ya da pazarlama çerezi <strong>kullanmaz<\/strong>/);
  for (const f of fs.readdirSync(ROOT).filter((x) => x.endsWith('.html'))) assert.doesNotMatch(read(f), /googletagmanager|gtag\(|google-analytics|hotjar|clarity\.ms|connect\.facebook\.net/, f + ': politika "izleme yok" diyor');
});

test('başvuru: md. 11 dokuz hak, 30 gün, Kurul’a şikâyet', () => {
  const b = K.slice(K.indexOf('<section id="basvuru"'));
  assert.equal((b.slice(b.indexOf('<ol>'), b.indexOf('</ol>')).match(/<li>/g) || []).length, 9);
  assert.match(b, /en geç <strong>30 gün<\/strong>/); assert.match(b, /Kişisel Verileri Koruma Kurulu'na şikâyet/);
});

test('kayıt: şartlar zorunlu, aydınlatma bilgi (kutu yok), açık rıza ayrı ve işaretsiz; sürüm hesaba yazılır', () => {
  const r = read('register.html');
  assert.match(r, /<input type="checkbox" id="legal-agree" name="legal_agree">.*Kullanım Şartları<\/a>'nı okudum ve kabul ediyorum/);
  assert.match(r, /<p class="kvkk kvkk-bilgi">Kişisel verilerin hizmetin sunulması için <a href="kvkk\.html#aydinlatma"/);
  assert.match(r, /<input type="checkbox" id="acik-riza" name="acik_riza">/);
  assert.doesNotMatch(r, /id="acik-riza"[^>]*checked/, 'açık rıza önceden işaretli olamaz');
  assert.doesNotMatch(r, /Gizlilik Politikası<\/a>'nı ve <a href="legal\.html#terms"[^>]*>Kullanım Şartları<\/a>'nı okudum, kabul ediyorum/, 'eski birleşik kutu kalktı');
  assert.match(r, /<p class="kvkk kvkk-sso">Google ile devam edersen/);
  const a = read('js/auth.js');
  assert.match(a, /const LEGAL_SURUM = '2026-11-08';/);
  assert.match(a, /acik_riza_eposta: !!\(document\.getElementById\('acik-riza'\) && document\.getElementById\('acik-riza'\)\.checked\)/);
  assert.ok(K.includes('Metin sürümü: 08.11.2026'), 'auth.js sürümü ile metin sürümü aynı');
});

test('diğer sayfalar: iletişim formunda "kabul" kutusu yok, bağlantılar kvkk.html’e, gizlilik güncel', () => {
  const i = read('index.html');
  assert.doesNotMatch(i, /KVKK Aydınlatma Metni<\/a>'ni okudum, sorumu yanıtlamak için iletişim bilgilerimin kullanılmasını kabul ediyorum/);
  assert.match(i, /<p class="ask-kvkk"/); assert.match(i, /<a href="kvkk\.html" style="color: #B4C0DA; text-decoration: none">KVKK<\/a>/);
  assert.match(read('login.html'), /<a href="kvkk\.html">KVKK<\/a>/);
  const l = read('legal.html');
  assert.doesNotMatch(l, /pilot-admin@business\.edu|Llama 3\.3|Faculty of Business\. All rights/);
  assert.match(l, /Son güncelleme: 8 Kasım 2026/); assert.match(l, /<a href="kvkk\.html" class="legal-nav-link">KVKK Aydınlatma<\/a>/);
  assert.match(read('sitemap.xml'), /kvkk\.html/);
});

summary();
