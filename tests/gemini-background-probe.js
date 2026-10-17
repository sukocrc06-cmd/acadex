#!/usr/bin/env node
/* ==========================================================================
   ACADEX — GEMINI ARKA PLAN YURUTME SONDASI (tests/gemini-background-probe.js)

       GEMINI_API_KEY=... node tests/gemini-background-probe.js

   TEST DEGIL, komut satiri aracidir. Gunluk kotadan (RPD 20) TEK istek
   harcar ve tek bir soruyu yanitlar:

       Bu anahtarla, bu modelde, `background: true` KABUL EDILIYOR MU?

   NEDEN ONEMLI:
   Bugun ozet tek bir HTTP istegi icinde uretiliyor ve o istek Gemini'yi
   105 saniyeye kadar bekliyor. Olculen Gemini gecikmesi 67-111 saniye
   arasinda oynuyor, Supabase ise istegi ~150 saniyede kesiyor. Yani
   "baglanti koptu" dedigimiz sey bir ayar hatasi degil, aritmetik: bazi
   gunler Google yavas ve o kosu kaybediliyor.

   Arka plan yurutmesi bunu kokunden kaldirir: POST aninda bir interaction
   id doner, is Google tarafinda calisir, biz GET ile yoklariz. Hicbir
   baglanti uzun sure acik kalmaz — ne Gemini'ye, ne tarayicidan Supabase'e.

   AMA bir belirsizlik var: kaynaklar background yurutmesinin AJAN
   etkilesimlerinde kesin, duz MODEL etkilesimlerinde ise reddedilebilecegini
   soyluyor. Bunu tahminle degil, tek istekle ogrenmek gerekiyor — bu dosya
   onun icin var.

   CIKTI:
     KABUL  -> arka plan yolu yazilabilir; id ve durum basilir
     RED    -> hangi alanin reddedildigi basilir; plan buna gore degisir
   ========================================================================== */

'use strict';

const API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.7-flash';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
// Kodun bugun gondermedigi, dokumanlarda gecen surum basligi. Sondada
// ACIKCA deneniyor: reddedilirse bunu da ogrenmis oluruz.
const API_REVISION = process.env.GEMINI_API_REVISION || '2026-05-20';

if (!API_KEY) {
  console.error('GEMINI_API_KEY yok. Kullanim:\n  GEMINI_API_KEY=... node tests/gemini-background-probe.js');
  process.exit(2);
}

/* Istegi KUCUK tutuyoruz: amac ozet uretmek degil, alanin kabul edilip
   edilmedigini ogrenmek. Boylece istek saniyeler icinde doner ve kotadan
   yalnizca bir tane gider. */
const body = {
  model: MODEL,
  input: [{ type: 'text', text: 'Reply with the single word: ok' }],
  background: true
};

async function dene(baslikEkle) {
  const headers = { 'x-goog-api-key': API_KEY, 'Content-Type': 'application/json' };
  if (baslikEkle) headers['Api-Revision'] = API_REVISION;

  const t0 = Date.now();
  const res = await fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(body) });
  const ms = Date.now() - t0;
  const metin = await res.text();
  return { status: res.status, ms, metin };
}

(async () => {
  console.log(`Model: ${MODEL}`);
  console.log(`Api-Revision basligi: ${API_REVISION}\n`);

  const r = await dene(true);
  console.log(`POST ${r.status} — ${r.ms}ms`);
  console.log(r.metin.slice(0, 900));
  console.log();

  if (r.status >= 200 && r.status < 300) {
    let data = {};
    try { data = JSON.parse(r.metin); } catch (_e) { /* govde JSON degil */ }
    const id = data.id || data.name || null;
    const durum = data.status || '(durum alani yok)';
    console.log('SONUC: KABUL — arka plan yurutmesi bu anahtarla calisiyor.');
    console.log(`  interaction id : ${id || '(bulunamadi — govdeye bak)'}`);
    console.log(`  ilk durum      : ${durum}`);
    console.log(`  POST suresi    : ${r.ms}ms  (bugunku yol 67-111 SANIYE bekliyor)`);
    if (id) {
      console.log('\nYoklama komutu:');
      console.log(`  curl -s -H "x-goog-api-key: $GEMINI_API_KEY" -H "Api-Revision: ${API_REVISION}" \\`);
      console.log(`    ${ENDPOINT}/${id}`);
    }
    process.exit(0);
  }

  // 400'de hangi alanin reddedildigini ayirt et: background mi, baslik mi?
  const red = /Unknown (?:parameter|name|field)\s*['"`]?([A-Za-z0-9_.]+)/i.exec(r.metin);
  console.log('SONUC: RED.');
  if (red) console.log(`  reddedilen alan: ${red[1]}`);
  if (/Api-Revision/i.test(r.metin)) console.log('  Api-Revision basligi sorun cikarmis olabilir.');
  console.log('\n  Arka plan yolu bu haliyle yazilamaz. Bir sonraki secenek akis (stream)');
  console.log('  yurutmesi: baglanti acik kalir ama ilk byte saniyeler icinde gelir,');
  console.log('  yani sessiz 105 saniyelik bekleme ortadan kalkar ve yarim cikti');
  console.log('  kurtarilabilir hale gelir.');
  process.exit(1);
})().catch((e) => {
  console.error('Sonda calistirilamadi:', e && e.message ? e.message : e);
  process.exit(3);
});
