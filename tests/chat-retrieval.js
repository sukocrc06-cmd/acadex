/* ==========================================================================
   ACADEX — CHAT RETRIEVAL TESTLERI (tests/chat-retrieval.js)

   chat-with-document icindeki sorgu kurma ve pasaj birlestirme mantigini
   Groq'a ve Supabase'e hic cikmadan test eder. Fonksiyonlar kaynak dosyadan
   calisma aninda cikarilir (bkz. tests/_ts-extract.js).

   Calistirma:  node tests/chat-retrieval.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const { loadFromSource, makeRunner } = require('./_ts-extract.js');

const A = loadFromSource('supabase/functions/chat-with-document/index.ts', [
  // WHOLE_DOC_MAX_CHARS ve RETRIEVED_MAX_CHARS kaldirildi (05.10.2026):
  // ikisi de sabit 50.000'di ve hesabi hic tutmuyordu — bkz. asagidaki
  // "BUTCE TESTLERI" blogu. Yerlerini sourceBudgetChars aldi.
  'CHAT_TPM_LIMIT', 'CHAT_TPM_SAFETY', 'CHAT_MAX_COMPLETION',
  'CHARS_PER_TOKEN', 'IMAGE_TOKEN_RESERVE', 'SOURCE_MIN_CHARS',
  'sourceBudgetChars',
  'RETRIEVED_MAX_CHUNKS',
  'QUERY_STOPWORDS', 'buildChunkTsQuery', 'assembleRetrieved'
]);

const fs = require('node:fs');
const path = require('node:path');
const CHAT_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'supabase/functions/chat-with-document/index.ts'),
  'utf8'
);

const { test, summary } = makeRunner();

console.log('\nSORGU KURMA TESTLERI\n');

test('icerik kelimeleri OR ile birlestirilir', () => {
  const q = A.buildChunkTsQuery('marjinal maliyet egrisi');
  assert.equal(q, 'marjinal | maliyet | egrisi');
});

test('soru kaliplari (stopword) atilir', () => {
  const q = A.buildChunkTsQuery('Marjinal maliyet nedir, bana kisaca aciklar misin?');
  assert.ok(q.includes('marjinal'), 'anlamli terim kalmali');
  assert.ok(q.includes('maliyet'));
  assert.ok(!q.includes('nedir'), 'nedir atilmaliydi');
  assert.ok(!q.includes('bana'), 'bana atilmaliydi');
  assert.ok(!q.includes('kisaca'), 'kisaca atilmaliydi');
});

test('2 harften kisa kelimeler atilir', () => {
  const q = A.buildChunkTsQuery('bu ve de marjinal');
  assert.equal(q, 'marjinal');
});

test('tekrarlayan kelime bir kez gecer', () => {
  const q = A.buildChunkTsQuery('maliyet maliyet maliyet egrisi');
  assert.equal(q, 'maliyet | egrisi');
});

test('anlamli terim yoksa null doner (caller tum belgeye duser)', () => {
  assert.equal(A.buildChunkTsQuery('nedir bu?'), null);
  assert.equal(A.buildChunkTsQuery(''), null);
  assert.equal(A.buildChunkTsQuery('   '), null);
  assert.equal(A.buildChunkTsQuery('?! ...'), null);
});

// --- ENJEKSIYON GUVENLIGI: en kritik testler --------------------------------
// to_tsquery'ye operator sizmasi hem sorgunun anlamini degistirir hem de
// sorguyu patlatabilir. Harf/rakam disindaki her sey atildigi icin
// kullanicinin yazdigi hicbir sey operator olarak gecemez.

test('tsquery operatorleri sizdirilmaz (& | ! parantez)', () => {
  const q = A.buildChunkTsQuery('maliyet & egrisi | (sapma) ! deger');
  assert.ok(q, 'sorgu uretilmeliydi');
  // Tek izin verilen operator, bizim ekledigimiz ' | '
  const withoutOurOrs = q.split(' | ').join(' ');
  assert.ok(!/[&!()<>:*]/.test(withoutOurOrs),
    `operator sizdi: ${JSON.stringify(q)}`);
});

test('prefix/agirlik sozdizimi (:* :A) sizdirilmaz', () => {
  const q = A.buildChunkTsQuery('maliyet:* egrisi:A');
  assert.ok(!q.includes(':'), `iki nokta sizdi: ${q}`);
});

test('tek tirnak ve ters egik cizgi sizdirilmaz', () => {
  const q = A.buildChunkTsQuery("maliyet' or 1=1 -- \\ egrisi");
  assert.ok(!/['\\=-]/.test(q), `tehlikeli karakter sizdi: ${q}`);
});

test('fazla uzun soru terim sayisinda sinirlanir', () => {
  const many = Array.from({ length: 80 }, (_, i) => `terim${i}`).join(' ');
  const q = A.buildChunkTsQuery(many);
  assert.ok(q.split(' | ').length <= 24, 'terim sayisi 24 ile sinirli olmali');
});

test('Turkce karakterler korunur', () => {
  const q = A.buildChunkTsQuery('esneklik katsayısı öğrenme çıktısı');
  assert.ok(q.includes('katsayısı'), `Turkce karakter kaybolmus: ${q}`);
  assert.ok(q.includes('öğrenme'));
});

console.log('\nPASAJ BIRLESTIRME TESTLERI\n');

const row = (i, page, text) => ({ chunk_index: i, page_start: page, page_end: page, text });

test('secim alakaya gore ama metin OKUMA sirasina gore dizilir', () => {
  // RPC alaka sirasinda doner: 70, 12, 45
  const rows = [row(70, 71, 'yetmisinci chunk'), row(12, 13, 'onikinci chunk'), row(45, 46, 'kirkbesinci chunk')];
  const { text } = A.assembleRetrieved(rows, 100000);
  const order = [12, 45, 70].map(n => text.indexOf(
    n === 12 ? 'onikinci' : n === 45 ? 'kirkbesinci' : 'yetmisinci'));
  assert.ok(order[0] < order[1] && order[1] < order[2],
    'pasajlar okuma sirasinda olmaliydi (model karisik sirada mantik kuramaz)');
});

test('karakter butcesi asilmaz', () => {
  const rows = Array.from({ length: 20 }, (_, i) => row(i, i + 1, 'x'.repeat(1000)));
  const { text, used } = A.assembleRetrieved(rows, 5000);
  assert.ok(used <= 5000, `butce asildi: ${used}`);
  assert.ok(text.length > 0, 'bos donmemeli');
});

test('butce cok kucukse en alakali tek pasaj yine gonderilir', () => {
  const rows = [row(3, 4, 'y'.repeat(9000))];
  const { text, used } = A.assembleRetrieved(rows, 1000);
  assert.ok(used > 0 && text.length > 0, 'hic pasaj gonderilmemesi kabul edilemez');
});

test('sayfa etiketi eklenir ve sayfalar raporlanir', () => {
  const { text, pages } = A.assembleRetrieved([row(5, 12, 'icerik burada')], 10000);
  assert.ok(text.includes('[Sayfa 12]'), `sayfa etiketi yok: ${text}`);
  assert.deepEqual(pages, [12]);
});

test('coklu sayfa araligi dogru etiketlenir', () => {
  const r = { chunk_index: 1, page_start: 4, page_end: 6, text: 'uc sayfaya yayilan icerik' };
  const { text } = A.assembleRetrieved([r], 10000);
  assert.ok(text.includes('[Sayfa 4-6]'), `aralik etiketi yok: ${text}`);
});

test('sayfasiz chunk (DOCX) etiketsiz gecer, cokmez', () => {
  const r = { chunk_index: 0, page_start: null, page_end: null, text: 'sayfasiz icerik' };
  const { text, pages } = A.assembleRetrieved([r], 10000);
  assert.ok(text.includes('sayfasiz icerik'));
  assert.ok(!text.includes('[Sayfa'), 'sayfa kavrami yoksa etiket uydurulmamali');
  assert.deepEqual(pages, []);
});

test('bos / bozuk satirlar atlanir', () => {
  const rows = [row(1, 2, ''), { chunk_index: 2 }, row(3, 4, 'gercek icerik')];
  const { text } = A.assembleRetrieved(rows, 10000);
  assert.ok(text.includes('gercek icerik'));
  assert.ok(!text.includes('undefined'), 'undefined sizmamali');
});

test('bos satir listesi guvenli sekilde bos doner', () => {
  const { text, used, pages } = A.assembleRetrieved([], 10000);
  assert.equal(text, '');
  assert.equal(used, 0);
  assert.deepEqual(pages, []);
});

console.log('\nSABITLER\n');

console.log('\nBUTCE TESTLERI\n');

/* Bu blogun yerinde duran eski test soyleydi:

     assert.ok(A.RETRIEVED_MAX_CHARS < 100000,
       'retrieval butcesi eski kesmeden kucuk olmali, yoksa kazanc yok');

   Yani olcutu "eski kesmeden kucuk mu" idi — "gercek limite SIGIYOR mu"
   degil. 50.000 < 100.000 oldugu icin yesildi, ve 50.000 karakter aslinda
   dakikalik butcenin iki katiydi. Olu bolgeyi geciren muhakeme buydu.
   Olcut artik hesabin kendisi. */

const tokensOf = (chars) => chars / A.CHARS_PER_TOKEN;

test('butce, istegin tamamini TPM tavaninin altinda tutuyor', () => {
  const tavan = A.CHAT_TPM_LIMIT * A.CHAT_TPM_SAFETY;
  // Gercekci bir yuk: ~4.500 krk sistem prompt + buyuyen sohbet gecmisi.
  for (const overhead of [4500, 8000, 15000, 30000]) {
    const butce = A.sourceBudgetChars(overhead, false);
    const toplam = tokensOf(butce) + tokensOf(overhead) + A.CHAT_MAX_COMPLETION;
    // Taban devreye girdiginde tavan asilabilir — ama o duruma GELINMEMELI:
    // cagiran taraf once eski sohbet turlarini dusurerek overhead'i
    // kuculturuyor (asagidaki teste bak). Burada sadece tabanin ustundeki
    // normal aralikta hesabin tuttugunu dogruluyoruz.
    if (butce > A.SOURCE_MIN_CHARS) {
      assert.ok(toplam <= tavan,
        `overhead=${overhead}: toplam ${Math.round(toplam)} token > tavan ${tavan}`);
    }
  }
});

test('gercek belgeler: kucuk sigar, buyuk retrieval a duser', () => {
  // 05.10.2026 kosularindan gercek boyutlar.
  const butce = A.sourceBudgetChars(4500, false);
  const ekonomi = 11050;         // economy chapter 20
  const bilissel = 31817;        // Cognitive Dissonance
  assert.ok(ekonomi <= butce,
    `ekonomi belgesi (${ekonomi}) butceye (${butce}) sigmali — once de calisiyordu`);
  assert.ok(bilissel > butce,
    `Cognitive Dissonance (${bilissel}) butceyi (${butce}) asmali ki retrieval devreye girsin`);
});

test('gorsel eklenince butce kuculuyor', () => {
  const butceli = A.sourceBudgetChars(4500, true);
  const butcesiz = A.sourceBudgetChars(4500, false);
  assert.ok(butceli < butcesiz, 'gorsel token harciyor, kaynak payi azalmali');
  assert.equal(
    butcesiz - butceli,
    A.IMAGE_TOKEN_RESERVE * A.CHARS_PER_TOKEN,
    'fark tam olarak ayrilan gorsel payi kadar olmali'
  );
});

test('uzun sohbet gecmisi kaynak penceresini daraltiyor', () => {
  const kisa = A.sourceBudgetChars(4500, false);
  const uzun = A.sourceBudgetChars(4500 + 20000, false);
  assert.ok(uzun < kisa, 'gecmis buyurken kaynak payi kucumeli');
});

test('asiri yuk altinda bile taban kadar kaynak gonderiliyor', () => {
  // Overhead tek basina butun butceyi yerse matematik negatife duser.
  // O durumda bos prompt gondermek yerine tabana oturuyoruz.
  const butce = A.sourceBudgetChars(500000, false);
  assert.equal(butce, A.SOURCE_MIN_CHARS, 'taban devreye girmeli');
  assert.ok(butce > 0, 'asla sifir kaynak gonderilmemeli');
});

test('OLU BOLGE yok: her boyut ya sigar ya retrieval a duser', () => {
  /* Asil regresyon testi. Eskiden uc ayri sabit vardi ve uyusmuyorlardi:
       retrieval tetigi ....... 50.000
       retrieval kirpmasi ..... 50.000
       tam-belge kirpmasi .... 100.000
     Ucu de tek bir butceden gelmeli; aksi halde aralarinda yine "komple
     gonderilen ama sigmayan" bir aralik acilir. */
  for (const site of [
    'totalChunkChars > SOURCE_BUDGET',        // retrieval tetigi
    'assembleRetrieved(rows, SOURCE_BUDGET)', // retrieval kirpmasi
    'sourceText.length > SOURCE_BUDGET'       // tam-belge kirpmasi
  ]) {
    assert.ok(CHAT_SRC.includes(site), `bu karar noktasi butceyi kullanmiyor: ${site}`);
  }
  // Ve eski sabitlerden hicbiri geri sizmamali.
  for (const eski of ['WHOLE_DOC_MAX_CHARS', 'RETRIEVED_MAX_CHARS', 'MAX_CHARS = 100000']) {
    assert.ok(!CHAT_SRC.includes(eski), `eski sabit geri gelmis: ${eski}`);
  }
});

test('butce tabana dayaninca GECMIS kirpiliyor, belge degil', () => {
  /* Taban (SOURCE_MIN_CHARS) bos prompt gondermeyi engelliyor ama tek
     basina yetmiyor: 10 tur × 3.000 krk = 30.000 krk gecmis, belge daha
     hesaba katilmadan ~9.400 token eder. Taban o durumda toplami tavanin
     USTUNE itiyor ve ogrenci yine hata goruyor — bos prompt yerine
     "Request too large". Harcanabilir olan gecmis, belge degil.

     Burada cagiran taraftaki donguyu birebir taklit ediyoruz. */
  const basePrompt = 4500;
  const turlar = Array.from({ length: 10 }, () => ({ content: 'x'.repeat(3000) }));
  const toplamKrk = (a) => a.reduce((n, m) => n + m.content.length, 0);

  let dusen = 0;
  while (turlar.length > 1 &&
         A.sourceBudgetChars(basePrompt + toplamKrk(turlar), false) <= A.SOURCE_MIN_CHARS) {
    turlar.shift(); dusen++;
  }
  assert.ok(dusen > 0, 'uzun gecmiste tur dusurulmeliydi');
  assert.ok(turlar.length >= 1, 'guncel soru asla dusurulmemeli');

  const butce = A.sourceBudgetChars(basePrompt + toplamKrk(turlar), false);
  const toplam = tokensOf(butce) + tokensOf(basePrompt + toplamKrk(turlar)) + A.CHAT_MAX_COMPLETION;
  assert.ok(toplam <= A.CHAT_TPM_LIMIT * A.CHAT_TPM_SAFETY,
    `kirpmadan sonra bile tavan asiliyor: ${Math.round(toplam)}`);
  assert.ok(butce > A.SOURCE_MIN_CHARS, 'kirpma sonrasi belgeye tabandan fazlasi kalmali');
});

test('kirpma dongusu kaynakta gercekten var', () => {
  assert.ok(/while \(\s*safeMessages\.length > 1 &&/.test(CHAT_SRC),
    'gecmis kirpma dongusu kaldirilmis');
  assert.ok(CHAT_SRC.includes('safeMessages.shift()'), 'eski turlar dusurulmeli');
});

test('sistem prompt u olculebiliyor (sabit sayiya guvenilmiyor)', () => {
  // Butce, prompt'un GERCEK uzunlugundan cikariliyor. Bunun icin prompt bir
  // fonksiyon olmak zorunda; inline template'e donerse butce sessizce yanlis
  // hesaplanir ve olu bolge geri gelir.
  assert.ok(
    /function buildSystemPrompt\(sourceText: string, isRetrieval: boolean\)/.test(CHAT_SRC),
    'buildSystemPrompt fonksiyon olarak durmali'
  );
  assert.ok(
    /buildSystemPrompt\(''\s*,\s*true\)\.length/.test(CHAT_SRC),
    'overhead bos kaynakla OLCULMELI, tahmin edilmemeli'
  );
});

summary().then(() => process.exit(process.exitCode || 0));
