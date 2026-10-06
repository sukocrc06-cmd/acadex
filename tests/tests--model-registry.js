#!/usr/bin/env node
/* ==========================================================================
   ACADEX — MODEL KAYIT TESTLERI (tests/model-registry.js)

       node tests/model-registry.js

   NEDEN VAR:
   06.10.2026'da get-exam-hint'in llama-3.1-8b-instant cagirdigi bulundu.
   Groq o modeli 2026-08-16'da KAPATTI — llama-3.3-70b-versatile ile ayni
   gun. Repo o gun 70b'den tasindi, ama bu fonksiyon atlandi: yani sinav
   ipucu dugmesi yaklasik yedi haftadir her basista "AI hint service failed"
   donuyordu ve bunu kimse gormedi, cunku hicbir test model adlarina
   bakmiyordu.

   Asil hata "yanlis model secildi" degil, "17 fonksiyonluk bir gocte biri
   atlandi ve bunu soyleyecek kimse yoktu". Bu yuzden bu dosya tek bir
   fonksiyonu degil, BUTUN edge function'lari tarar.

   Uc sey kontrol edilir:
     1. Kapatilmis model adi, gercek bir `model:` degeri olarak hicbir yerde
        gecmemeli (yorumlarda gecebilir — gocu anlatan yorumlar degerlidir).
     2. reasoning_effort model ailesine uymali: gpt-oss "none"u 400 ile
        reddeder, qwen tam da onu ister.
     3. max_completion_tokens borcu BUYUMEMELI. Bugun 10 fonksiyon bunu
        gondermiyor; bu bir mandal (ratchet), onbirincisi testi dusurur.
   ========================================================================== */

'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');

const FN_DIR = path.join(__dirname, '..', 'supabase', 'functions');

/* Yorumlari atan kopya. Kapatilmis bir modelin adi, NEDEN kapatildigini
   anlatan yorumda gecmeye devam etmeli — o yorumlar bu testin varlik
   sebebini anlatiyor. Aranan sey KOD: `model:` satirinda gecen ad. */
function yorumsuz(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/([^:"'`])\/\/[^\n"'`]*$/gm, '$1');
}

function edgeFunctions() {
  return fs.readdirSync(FN_DIR)
    .map(ad => ({ ad, p: path.join(FN_DIR, ad, 'index.ts') }))
    .filter(x => fs.existsSync(x.p))
    .map(x => ({ ...x, src: fs.readFileSync(x.p, 'utf8') }))
    .map(x => ({ ...x, kod: yorumsuz(x.src) }));
}

const FNS = edgeFunctions();
const GROQ_FNS = FNS.filter(f => /api\.groq\.com/.test(f.kod));

/* console.groq.com/docs/deprecations, 06.10.2026'da okundu.
   Kapanis tarihi gecmis olanlar — bunlar artik CAGRILAMAZ. */
const KAPATILDI = {
  'llama-3.1-8b-instant': '2026-08-16',
  'llama-3.3-70b-versatile': '2026-08-16',
  'qwen/qwen3.6-27b': '2026-09-14',
  'qwen/qwen3-32b': '2026-07-17',
  'meta-llama/llama-4-scout-17b-16e-instruct': '2026-07-17',
  'groq/compound': '2026-09-21',
  'groq/compound-mini': '2026-09-21',
};

/* Bugun max_completion_tokens gondermeyen fonksiyonlar. Liste KISALMALI,
   uzamamali. Her biri 8.000 TPM'e karsi Groq'un buyuk varsayilan completion
   rezervini birakiyor: istek kucukken bile "Request too large" alabilir. */
const BUTCESIZ_BORC = [
  'acadia-assistant',
  'acadia-chat',
  'compare-documents',
  'generate-exam',
  'generate-podcast-script',
  'generate-presentation',
  'generate-section-visual',
  'generate-slide-content',
  'grade-exam',
  'regenerate-section',
];

const { test, summary } = makeRunner();

console.log('\nMODEL KAYIT TESTLERI\n');

test('edge function taramasi gercekten dosya buluyor', () => {
  // Bu testin en sinsi basarisizligi: klasor yapisi degisir, FNS bos kalir,
  // ve butun testler "hicbir sey bulunamadi" diye YESIL gecer.
  assert.ok(FNS.length >= 20, `beklenmeyecek kadar az fonksiyon: ${FNS.length}`);
  assert.ok(GROQ_FNS.length >= 15, `Groq cagiran fonksiyon az: ${GROQ_FNS.length}`);
});

test('kapatilmis model hicbir yerde CAGRILMIYOR', () => {
  const bulunan = [];
  for (const f of GROQ_FNS) {
    for (const m of Object.keys(KAPATILDI)) {
      // Sadece gercek bir model degeri: model: "..." veya const X = "..."
      const re = new RegExp(`["'\`]${m.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&')}["'\`]`);
      if (re.test(f.kod)) bulunan.push(`${f.ad} → ${m} (kapanis ${KAPATILDI[m]})`);
    }
  }
  assert.deepEqual(bulunan, [],
    'Groq tarafindan kapatilmis model cagriliyor:\n  ' + bulunan.join('\n  '));
});

test('kapatilmis model listesi yorumlarda gecmeye devam EDEBILIR', () => {
  // Bu testin kendisi bir tuzaga dusmesin: gocu anlatan yorumlar silinmeye
  // zorlanmamali. Tersini dogrular — en az bir fonksiyon eski modelin adini
  // yorumda tasiyor olmali, cunku o yorum neden tasindigini anlatiyor.
  const yorumda = FNS.filter(f =>
    /llama-3\.(1|3)/.test(f.src) && !/llama-3\.(1|3)/.test(f.kod));
  assert.ok(yorumda.length >= 1,
    'gocu anlatan yorumlarin hepsi silinmis — tarih kayboluyor');
});

test('reasoning_effort model ailesine uygun', () => {
  /* gpt-oss low/medium/high disinda bir sey kabul etmiyor; "none" HARD 400.
     qwen ise tam tersine "none" istiyor, yoksa <think> blogu uretip hem
     JSON ayristirmayi hem butceyi bozuyor. 509bd5f'te review calisma
     aninda serit secmeye baslayinca her gpt-oss cagrisi 400 verdi. */
  /* DALA GORE, PENCEREYE GORE DEGIL. Ilk surum her "none" icin 400
     karakterlik bir pencerede "qwen" kelimesi ariyordu. O pencere
     `lane.includes('qwen') ? {..."none"} : {..."none"}` yazarsa IKI kolu da
     qwen baglami sayar — yani tam da yakalamasi gereken hatayi kacirir.
     Mutasyon testinde oyle oldu: gpt-oss koluna "none" verildi, test yesil
     gecti. (06.10.2026)

     Dogru soru "yakinlarda qwen yaziyor mu" degil, "bu deger ternary'nin
     HANGI kolunda". Her degerin oncesinde bosluk ve '{' atlanarak ilk
     anlamli isaret bulunur: '?' ise dogru kol (qwen), ':' ise yanlis kol
     (gpt-oss). */
  const kolBul = (kod, idx) => {
    let i = idx - 1;
    while (i >= 0 && /[\s{(]/.test(kod[i])) i--;
    if (kod[i] === '?') return { kol: 'dogru', isaret: i };
    if (kod[i] === ':') return { kol: 'yanlis', isaret: i };
    return { kol: 'duz', isaret: i };   // ternary icinde degil
  };

  let kontrolEdilen = 0;
  for (const f of GROQ_FNS) {
    for (const m of f.kod.matchAll(/reasoning_effort: *["'](\w+)["']/g)) {
      kontrolEdilen++;
      const deger = m[1];
      const { kol, isaret } = kolBul(f.kod, m.index);

      // Kosul metni: ternary'nin '?' isaretinden once gelen kisim.
      const oncesi = f.kod.slice(Math.max(0, isaret - 300), isaret);
      const qwenKolu = kol === 'dogru' && /qwen/.test(oncesi);

      if (kol === 'duz') {
        /* Iki ayri kalip, ve ikisini de tanimak zorunda:

           a) Sabit modele civili cagri — modeli ayni blokta ara:
                model: "qwen/qwen3.8-27b", ... reasoning_effort: "none"

           b) Modele gore parametre donduren YARDIMCI — blokta hic `model:`
              yok, kosul degerin kendi satirinda:
                if (id.includes('qwen')) return { reasoning_effort: "none" }

              Ilk surum sadece (a)'yi biliyordu ve summarize-document'in
              reasoningParamsFor'unu hatali olarak "gpt-oss'a none verilmis"
              diye bildirdi. Dogru kodu hatali gostermek, hatali kodu
              kacirmak kadar kotu: bir daha ki gercek alarma kimse
              inanmaz. (06.10.2026) */
        const satirBasi = f.kod.lastIndexOf('\n', m.index) + 1;
        const satirSonu = f.kod.indexOf('\n', m.index);
        const satir = f.kod.slice(satirBasi, satirSonu === -1 ? undefined : satirSonu);
        const blok = f.kod.slice(Math.max(0, m.index - 600), m.index + 300);
        const qwenSabit = /qwen/.test(satir) || /model: *["'][^"']*qwen/.test(blok);
        if (qwenSabit) {
          assert.equal(deger, 'none',
            `${f.ad}: qwen "none" ister, "${deger}" verilmis — <think> blogu JSON'u bozar`);
        } else {
          assert.ok(['low', 'medium', 'high'].includes(deger),
            `${f.ad}: gpt-oss reasoning_effort "${deger}" kabul etmez (low/medium/high) — HARD 400`);
        }
        continue;
      }

      if (qwenKolu) {
        assert.equal(deger, 'none',
          `${f.ad}: qwen kolunda "${deger}" var, "none" olmali`);
      } else {
        // qwen OLMAYAN kol = gpt-oss kolu.
        assert.ok(['low', 'medium', 'high'].includes(deger),
          `${f.ad}: gpt-oss kolunda reasoning_effort "${deger}" — gpt-oss bunu 400 ile reddeder`);
      }
    }
  }
  assert.ok(kontrolEdilen >= 4,
    `cok az reasoning_effort bulundu (${kontrolEdilen}) — tarama bozulmus olabilir`);
});

test('max_completion_tokens borcu BUYUMUYOR', () => {
  /* Groq, bu alan yoksa 8.000 TPM'e karsi buyuk bir varsayilan completion
     rezervi ayiriyor — kucuk bir istek bile "Request too large" alabilir.
     summarize-document ve chat-with-document bu dersi pahaliya ogrendi.

     Bu test borcu KAPATMIYOR, donduruyor: listedeki 10 fonksiyon bilinen
     borc, onbirincisi bu testi dusurur. */
  const butcesiz = GROQ_FNS
    .filter(f => !/max_completion_tokens/.test(f.kod))
    .map(f => f.ad)
    .sort();

  const yeni = butcesiz.filter(a => !BUTCESIZ_BORC.includes(a));
  assert.deepEqual(yeni, [],
    'max_completion_tokens gondermeyen YENI fonksiyon(lar): ' + yeni.join(', ') +
    '\n  Groq varsayilan rezervi 8.000 TPM butcesini tek basina doldurabilir.');

  // Borc kapandikca liste guncellenmek ZORUNDA olsun, yoksa bu test
  // kapanmis borcu korumaya devam eder ve anlamsizlasir.
  const duzelen = BUTCESIZ_BORC.filter(a => !butcesiz.includes(a));
  assert.deepEqual(duzelen, [],
    'Bu fonksiyon(lar) artik butce gonderiyor — BUTCESIZ_BORC listesinden ' +
    'cikarilmali: ' + duzelen.join(', '));
});

test('get-exam-hint canli bir modele ve serit zincirine sahip', () => {
  // Bu dosyanin dogdugu hata. Ayrica: ipucu cagrisi response_format
  // KULLANMIYOR, yani chat-with-document'te gpt-oss-120b'yi bos icerik
  // donduren promptla ayni sekilde. Bos icerik serit hatasi sayilmali.
  const f = FNS.find(x => x.ad === 'get-exam-hint');
  assert.ok(f, 'get-exam-hint bulunamadi');
  assert.ok(!/llama-3\.1-8b-instant/.test(f.kod), 'kapatilmis model hala cagriliyor');
  assert.ok(/hintLanes/.test(f.kod), 'serit zinciri yok — tek modele civili');
  assert.ok(/max_completion_tokens: *\d+/.test(f.kod), 'TPM korumasi yok');
  assert.ok(/BOS icerik dondu/.test(f.kod), 'bos icerik serit hatasi sayilmiyor');
});

test('gpt-oss-120b yuku sayiliyor (tek kovada kac fonksiyon)', () => {
  /* Groq TPD'yi MODEL BASINA sayiyor: 200.000 token/gun. Ayni modeli
     cagiran her fonksiyon ayni kovadan iciyor. Bu test bir seyi
     yasaklamiyor — sayiyi GORUNUR kiliyor, cunku "neden bugun hicbir sey
     calismiyor" sorusunun cevabi genellikle burada. */
  const yuk = {};
  for (const f of GROQ_FNS) {
    for (const m of new Set([...f.kod.matchAll(/["'](openai\/gpt-oss-\d+b|qwen\/qwen[\d.]+-\d+b)["']/g)].map(x => x[1]))) {
      (yuk[m] = yuk[m] || []).push(f.ad);
    }
  }
  const satir = Object.entries(yuk)
    .map(([m, l]) => `${m}: ${l.length} fonksiyon`)
    .join(', ');
  console.log(`        ${satir || '(model adi sabit gecen cagri yok)'}`);
  assert.ok(Object.keys(yuk).length >= 2,
    'tek modele bagimlilik: o modelin gunu bitince HICBIR sey calismaz');
});

summary().then(() => process.exit(process.exitCode || 0));
