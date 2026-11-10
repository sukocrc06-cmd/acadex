#!/usr/bin/env node
/* ==========================================================================
   ACADEX KIDS · seslendirme üretici (kids/ses/uret.js), 10.11.2026
   ElevenLabs ile sitenin bütün cümlelerini bir kez MP3'e çevirir:
     kids/ses/en/*.mp3  · İngilizce kelimeler, oyun cümleleri, şarkılar (İngilizce kadın öğretmen sesi)
     kids/ses/tr/*.mp3  · Türkçe yönergeler (Türk kadın öğretmen sesi)
     kids/ses/liste.json · "dil:metin" → dosya eşlemesi (site bunu okur)
     kids/ses/kayit-metni.csv · stüdyo seslendirmeni için kayıt listesi (aynı dosya adları)
   Stüdyo kaydı gelince MP3'ler AYNI ADLA değiştirilir; kod değişmez.

   API anahtarı yalnız ortam değişkeninden okunur, hiçbir dosyaya yazılmaz.

   Kullanım (proje klasöründe, PowerShell):
     $env:ELEVENLABS_API_KEY = "anahtarın"
     node kids/ses/uret.js sesler                 # hesabındaki sesleri listeler (ad, id, aksan, yaş)
     node kids/ses/uret.js dene <ses_id> en       # kids/ses/_deneme/ altına dinlemek için örnek üretir (tr da olur)
     $env:ELEVEN_SES_EN = "<İngilizce ses id>"; $env:ELEVEN_SES_TR = "<Türkçe ses id>"
     node kids/ses/uret.js kuru                   # kaç cümle / karakter üretileceğini gösterir, API'ye gitmez
     node kids/ses/uret.js uret                   # eksik dosyaları üretir (ses id değişen dili baştan üretir)
     node kids/ses/uret.js uret --hepsi           # hepsini baştan üretir
   İsteğe bağlı: $env:ELEVEN_MODEL (varsayılan eleven_multilingual_v2)
   ========================================================================== */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const katalog = require('./katalog.js');
const KOK = __dirname, LISTE = path.join(KOK, 'liste.json'), API = 'https://api.elevenlabs.io';
const ANAHTAR = process.env.ELEVENLABS_API_KEY || '';
const MODEL = process.env.ELEVEN_MODEL || 'eleven_multilingual_v2';
const BICIM = 'mp3_44100_64';
/* çocuklar için: biraz yavaş, sıcak, tutarlı */
const AYAR = { en: { stability: 0.55, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true, speed: 0.9 }, tr: { stability: 0.5, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true, speed: 0.95 } };

const KATLA = { ç: 'c', ğ: 'g', ı: 'i', İ: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a' };
function dosyaAdi(dil, metin) {
  const slug = metin.toLowerCase().replace(/[çğıİöşüâ]/g, (c) => KATLA[c] || c).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'ses';
  return dil + '/' + slug + '-' + crypto.createHash('sha1').update(dil + ':' + metin).digest('hex').slice(0, 6) + '.mp3';
}
function listeOku() { try { return JSON.parse(fs.readFileSync(LISTE, 'utf8')); } catch (e) { return { surum: 1, ses: {}, model: '', sesler: {} }; } }
function anahtarGerek() { if (!ANAHTAR) { console.error('ELEVENLABS_API_KEY ortam değişkeni yok. PowerShell: $env:ELEVENLABS_API_KEY = "anahtarın"'); process.exit(1); } }
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

async function seslendir(ses, metin, dil) {
  for (let deneme = 1; deneme <= 5; deneme++) {
    const r = await fetch(API + '/v1/text-to-speech/' + encodeURIComponent(ses) + '?output_format=' + BICIM, {
      method: 'POST', headers: { 'xi-api-key': ANAHTAR, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text: metin, model_id: MODEL, voice_settings: AYAR[dil], seed: 2026 })
    });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    const govde = await r.text();
    if (r.status === 429 || r.status >= 500) { await bekle(1500 * deneme); continue; }
    throw new Error('ElevenLabs ' + r.status + ': ' + govde.slice(0, 300));
  }
  throw new Error('ElevenLabs yanıt vermedi (5 deneme).');
}

async function sesler() {
  anahtarGerek();
  const r = await fetch(API + '/v1/voices', { headers: { 'xi-api-key': ANAHTAR } });
  if (!r.ok) throw new Error('ElevenLabs ' + r.status + ': ' + (await r.text()).slice(0, 300));
  const j = await r.json();
  for (const v of j.voices || []) {
    const l = v.labels || {};
    console.log(v.voice_id.padEnd(24) + ' ' + String(v.name).padEnd(28) + ' ' + [l.gender, l.accent, l.age, l.descriptive || l.description, l.use_case].filter(Boolean).join(' · '));
  }
  console.log('\nKadın, sıcak, "narrative/educational" etiketli sesleri `dene` ile dinleyin. Ses Kütüphanesi\'nden (Voice Library) eklediğiniz sesler de burada çıkar.');
}

async function dene(ses, dil) {
  anahtarGerek();
  if (!ses) throw new Error('Kullanım: node kids/ses/uret.js dene <ses_id> en|tr');
  dil = dil === 'tr' ? 'tr' : 'en';
  const ornek = dil === 'tr' ? 'Merhaba! Ben öğretmenin. Gizli iki resmine sırayla dokun. Hadi birlikte şarkı söyleyelim!' : 'Hello! Let\'s learn colours. Red. It\'s red! Pop the yellow balloon! Well done!';
  const d = path.join(KOK, '_deneme'); fs.mkdirSync(d, { recursive: true });
  const f = path.join(d, ses + '-' + dil + '.mp3'); fs.writeFileSync(f, await seslendir(ses, ornek, dil));
  console.log('Dinle: ' + path.relative(process.cwd(), f) + '   (_deneme klasörü yayına gitmez; .gitignore\'da)');
}

async function uret(hepsi, kuru) {
  const L = katalog(), eski = listeOku(), ses = { en: process.env.ELEVEN_SES_EN || '', tr: process.env.ELEVEN_SES_TR || '' };
  const yeni = { surum: 1, uretildi: new Date().toISOString(), model: MODEL, ses: { en: ses.en || (eski.ses || {}).en || '', tr: ses.tr || (eski.ses || {}).tr || '' }, sesler: {} };
  const is = [];
  for (const x of L) {
    const ad = dosyaAdi(x.dil, x.metin), tam = path.join(KOK, ad), anahtar = x.dil + ':' + x.metin;
    const sesDegisti = ses[x.dil] && (eski.ses || {})[x.dil] && eski.ses[x.dil] !== ses[x.dil];
    if (hepsi || sesDegisti || !fs.existsSync(tam)) is.push({ x, ad, tam, anahtar }); else yeni.sesler[anahtar] = ad;
  }
  const kar = is.reduce((t, i) => t + i.x.metin.length, 0);
  console.log(L.length + ' cümle; üretilecek ' + is.length + ' dosya, ' + kar + ' karakter (en ' + is.filter((i) => i.x.dil === 'en').length + ', tr ' + is.filter((i) => i.x.dil === 'tr').length + ').');
  fs.writeFileSync(path.join(KOK, 'kayit-metni.csv'), '﻿dosya;dil;metin;nerede\n' + L.map((x) => [dosyaAdi(x.dil, x.metin), x.dil, '"' + x.metin.replace(/"/g, '""') + '"', x.not].join(';')).join('\n') + '\n');
  if (kuru) return;
  if (!is.length) { fs.writeFileSync(LISTE, JSON.stringify(yeni, null, 1)); return console.log('Hepsi hazır. liste.json güncellendi.'); }
  anahtarGerek();
  for (const d of ['en', 'tr']) if (is.some((i) => i.x.dil === d) && !yeni.ses[d]) throw new Error((d === 'en' ? 'ELEVEN_SES_EN' : 'ELEVEN_SES_TR') + ' ortam değişkeni yok (ses id). Önce: node kids/ses/uret.js sesler');
  fs.mkdirSync(path.join(KOK, 'en'), { recursive: true }); fs.mkdirSync(path.join(KOK, 'tr'), { recursive: true });
  let n = 0, hata = 0;
  const isci = async () => {
    for (let i = is.shift(); i; i = is.shift()) {
      try { fs.writeFileSync(i.tam, await seslendir(yeni.ses[i.x.dil], i.x.metin, i.x.dil)); yeni.sesler[i.anahtar] = i.ad; n++; }
      catch (e) { hata++; console.error('✗ ' + i.anahtar + ' → ' + e.message); if (/401|403|quota|credits/i.test(e.message)) { is.length = 0; } }
      if (n % 20 === 0 && n) process.stdout.write('  ' + n + ' dosya\n');
    }
  };
  await Promise.all([isci(), isci(), isci()]);
  fs.writeFileSync(LISTE, JSON.stringify(yeni, null, 1));
  console.log('Bitti: ' + n + ' dosya üretildi' + (hata ? ', ' + hata + ' hata (yeniden çalıştırınca yalnız eksikler üretilir)' : '') + '. liste.json güncellendi.');
  console.log('Sıradaki adım: kids/sw.js içindeki SURUM satırını değiştirip push edin.');
}

const [, , komut, a1, a2] = process.argv;
if (require.main === module) (async () => {
  if (komut === 'sesler') return sesler();
  if (komut === 'dene') return dene(a1, a2);
  if (komut === 'kuru') return uret(false, true);
  if (komut === 'uret') return uret(process.argv.includes('--hepsi'), false);
  console.log('Komutlar: sesler · dene <ses_id> en|tr · kuru · uret [--hepsi]   (ayrıntı dosyanın başında)');
})().catch((e) => { console.error(e.message); process.exit(1); });

module.exports = { dosyaAdi };
