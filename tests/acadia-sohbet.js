/* ==========================================================================
   ACADEX — ACADIA KAYNAKLA ÇALIŞ SOHBETİ (tests/acadia-sohbet.js), 18.11.2026

   NEDEN VAR: 18.11.2026'da öğrenci "örnek ver mnc tanımına" diye sordu; model
   doğru ve dipnotlu bir cevap yazdı ama JSON sarmalayıcısı olmadan. Sunucu bunu
   tanımadı ve ekrana "AI returned invalid JSON formatting" çıktı. Aynı gün
   kayıtlar ikinci sorunu da gösterdi: Groq'un dakikalık 8.000 token sınırında,
   32.000 karakterlik belgenin her soruda yalnız ~4.100 karakteri modele gidiyordu.
   Bu dosya şunları korur:
     - düz metin cevap kabul edilir, [n] işaretleri atıf olur; yarım JSON açılır
     - kısa devam soruları ("örnek ver") önceki cevabın konusuyla aranır
     - önce Gemini (belge bütün, sayfa etiketli), olmazsa eski Groq zinciri
     - Gemini konuşması rol sırasına uyar; görsel yalnız son kullanıcı turunda
     - sistem talimatı kısaldı (mandal: 7.000 karakter)
     - kart sorgusu is_quantitative ve worked_examples alanlarını gerçekten okur
     - cevapta model ve yol döner (geri bildirim kaydı için)
   Çalıştırma:  node tests/acadia-sohbet.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadFromSource, makeRunner } = require('./_ts-extract.js');
const { test, summary } = makeRunner();
const P = 'supabase/functions/chat-with-document/index.ts';
const SRC = fs.readFileSync(path.join(__dirname, '..', P), 'utf8');
const A = loadFromSource(P, ['QUERY_STOPWORDS', 'duzMetinCevap', 'takipSorgusu', 'geminiIcerik', 'geminiMetni',
  'GEMINI_SOHBET_MODELLERI', 'GEMINI_TAM_BELGE_SINIRI', 'GEMINI_RETRIEVAL_BUTCESI']);

test('düz metin cevap: 18.11.2026 olayındaki cevap artık gösterilir', () => {
  const ham = 'MNC, İngilizce “Multinational Corporation” ifadesinin kısaltmasıdır. Örneğin Seattle Co. Singapur’da bir şube açar. [1]';
  const c = A.duzMetinCevap(ham);
  assert.ok(c && c.answer.startsWith('MNC'));
  assert.deepEqual(c.citations, [{ id: 1, reference: 'Kaynak belge' }]);
});

test('yarım kalmış JSON açılır; öğrenci ham JSON görmez', () => {
  const c = A.duzMetinCevap('{"answer":"Vekâlet sorunu, yöneticilerin\\nhissedar çıkarına [2] aykırı');
  assert.equal(c.answer, 'Vekâlet sorunu, yöneticilerin\nhissedar çıkarına [2] aykırı');
  assert.deepEqual(c.citations.map((x) => x.id), [2]);
});

test('okunur metin yoksa null: hata öğrenciye dürüstçe gider', () => {
  assert.equal(A.duzMetinCevap(''), null);
  assert.equal(A.duzMetinCevap('  …  '), null);
  assert.equal(A.duzMetinCevap('{"citations":[]}'), null);
  assert.equal(A.duzMetinCevap('[1, 2]'), null);
});

test('devam sorusu önceki cevabın konusuyla aranır; uzun soru sulandırılmaz', () => {
  const kisa = A.takipSorgusu('örnek ver', 'MNC ne demek?', 'MNC, çok uluslu şirket demektir [1]. Birden fazla ülkede faaliyet gösterir.');
  assert.match(kisa, /çok uluslu şirket/);
  assert.ok(!/Birden fazla ülkede/.test(kisa), 'yalnız ilk cümle eklenir');
  assert.ok(!/\[1\]/.test(kisa));
  const uzun = A.takipSorgusu('ödemeler dengesi cari hesap sermaye hesabı finans hesabı nasıl ayrılır', '', 'MNC çok uluslu şirkettir.');
  assert.ok(!/çok uluslu/.test(uzun));
});

test('Gemini konuşması: ardışık aynı rol birleşir, model ile başlamaz, görsel son turda', () => {
  const c = A.geminiIcerik([
    { role: 'assistant', content: 'Merhaba' },
    { role: 'user', content: 'a' }, { role: 'user', content: 'b' },
    { role: 'assistant', content: 'c' }, { role: 'user', content: 'd' }
  ], 'data:image/png;base64,QUJD');
  assert.deepEqual(c.map((x) => x.role), ['user', 'model', 'user']);
  assert.equal(c[0].parts.length, 2);
  assert.deepEqual(c[2].parts[1], { inlineData: { mimeType: 'image/png', data: 'QUJD' } });
  assert.equal(A.geminiMetni({ candidates: [{ content: { parts: [{ text: 'düşünce', thought: true }, { text: 'cevap' }] } }] }), 'cevap');
});

test('sıra: önce Gemini, olmazsa Groq zinciri değişmeden', () => {
  const g = SRC.indexOf("const geminiAnahtar = Deno.env.get('GEMINI_API_KEY')");
  const r = SRC.indexOf('const textLanes = [');
  assert.ok(g > 0 && r > g, 'Gemini bloğu Groq zincirinden önce');
  assert.match(SRC, /return cevapUret\(g\.metin, gSayfalar, hasImage, g\.model, gYol\)/);
  assert.match(SRC, /return cevapUret\(rawContent, gonderilenSayfalar, visionUsed, kullanilanModel, strategy\)/);
  assert.match(SRC, /Groq zincirine iniliyor/);
  assert.match(SRC, /CHAT_GEMINI'\) \|\| ''\)\.trim\(\)\.toLowerCase\(\) !== 'kapali'/, 'acil kapatma anahtarı');
  assert.ok(A.GEMINI_TAM_BELGE_SINIRI >= 100000 && A.GEMINI_RETRIEVAL_BUTCESI >= 40000);
  assert.ok(A.GEMINI_SOHBET_MODELLERI.every((m) => /^gemini-[\d.]+-flash/.test(m)));
  assert.match(SRC, /generativelanguage\.googleapis\.com\/v1\/models'/, 'v1 yüzeyi (v1beta bu hesapta 404/503)');
});

test('sistem talimatı kısa (mandal 7.000) ve kurallar yerinde', () => {
  const bas = SRC.indexOf('return `You are a grounded document Q&A assistant');
  const son = SRC.indexOf('SOURCE TEXT:', bas);
  assert.ok(son - bas <= 7000, 'talimat ' + (son - bas) + ' karakter');
  const t = SRC.slice(bas, son);
  ['STRICT GROUNDING RULE', "COPY TERMS, DON'T RECALL THEM", 'CITATION RULE', 'FOLLOW-UPS', 'EXAMPLES', 'OUTPUT FORMAT'].forEach((k) => assert.ok(t.includes(k), k));
});

test('kart sorgusu sayısal alanları okur; cevapta model ve yol döner', () => {
  assert.match(SRC, /formulas, is_quantitative, worked_examples'\)/);
  assert.match(SRC, /model: kullanilanModel,\s*\n\s*yol: strategy/);
});

summary();
