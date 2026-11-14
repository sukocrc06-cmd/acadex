/* ==========================================================================
   ACADEX — SUNUM: KALİTE KAYDI VE YÖNETMEN DAYANIKLILIĞI
   (tests/sunum-kalite-kaydi.js)

   NEDEN VAR (13.11.2026, veri taraması): canlıda 4 sunum, 24 asetat vardı ve
   ÜÇ ayrı şey bozuktu:

     1) presentations.quality_score / quality_report dört sunumda da BOŞTU.
        Yönetmen (acadia-presentation-director) 0-100 puan ve sorun listesi
        döndürüyor — tek gerçek ölçüm 96/100 idi — ama istemci yanıttaki
        quality alanını atıyordu. Puan ne kaydediliyor ne gösteriliyordu.
     2) Puanı göstermek tek başına yetmez: o 96 puanlı destede
        slide_count_mismatch sorunu vardı. Puan sorunlarla birlikte görünmeli,
        yoksa öğrenci "96 almışım" deyip eksik desteyi öyle bırakır.
     3) Üretimin 4 koşusunun 3'ü düşmüştü (2× AI_SERVICE_UNAVAILABLE,
        1× INCOMPLETE_PLAN). Üç deneme de AYNI modele gidiyordu ve taslak
        eşiği (%75) fazla katıydı.

   Çalıştırma:  node tests/sunum-kalite-kaydi.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const { test, summary } = makeRunner();

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const ink = read('js/acadex-ink.js');
const dir = read('supabase/functions/acadia-presentation-director/index.ts');
const html = read('dashboard.html');

test('KALİTE RAPORU DESTEYE KADAR GELİR (13.11.2026)', () => {
  assert.match(ink, /return \{ title: txt\(pres\.title\), items: out, quality: d && d\.quality/,
    'fromDirector kalite raporunu atıyor');
  assert.match(ink, /plotMeta\.quality = r\.quality \|\| null;/,
    'üretim yolunda kalite plotMeta’ya alınmıyor');
  assert.match(ink, /if \(plotMeta\.quality\) deck\.quality = plotMeta\.quality;/,
    'kalite desteye yazılmıyor');
});

test('KALİTE SUNUMA KAYDEDİLİR (13.11.2026)', () => {
  /* quality_score / quality_report sütunları 20260810 migration'ından beri
     vardı ama kodun hiçbir yerinde yazılmıyordu. */
  assert.match(ink, /row\.quality_score = Math\.max\(0, Math\.min\(100, Math\.round\(d\.quality\.score\)\)\)/,
    'quality_score kaydedilmiyor');
  assert.ok(ink.includes('row.quality_report = d.quality;'), 'quality_report kaydedilmiyor');
  assert.match(ink, /if \(d\.quality && typeof d\.quality\.score === 'number'\)/,
    'kalite yokken de yazmaya çalışıyor (elle yapılan destede alan boş kalmalı)');
});

test('PUAN SORUNLARIYLA BİRLİKTE GÖRÜNÜR (13.11.2026)', () => {
  /* Tek gerçek ölçüm 96/100 "geçti" idi ve aynı anda slide_count_mismatch
     bildiriyordu. Yalnız puan gösterilirse bu sorun görünmez kalır. */
  assert.match(ink, /Acadia kalite notu ' \+ Math\.round\(kq\.score\) \+ '\/100'/,
    'kalite notu ekranda gösterilmiyor');
  /* 14.11.2026: karşılıklar KALITE_TR'ye taşındı, üretim özeti kaliteYazi ile
     okur — ama sorunlar hâlâ puanın yanında görünmek zorunda. */
  assert.match(ink, /qi\.length \? ' — ' \+ qi\.join\(', '\) : ''/,
    'sorunlar puanın yanında gösterilmiyor');
  for (const k of ['slide_count_mismatch', 'duplicate_titles', 'weak_speaker_notes', 'dense_slides', 'visual_repetition', 'weak_grounding'])
    assert.ok(ink.includes(k + ':'), k + ' için Türkçe karşılık yok (ham anahtar görünür)');
});

test('YÖNETMEN: model şeridi ve yumuşak taslak eşiği (13.11.2026)', () => {
  /* 3 denemenin 3'ü de aynı modele gidiyordu: model meşgulse tekrar denemek
     işe yaramıyordu. Son deneme ayrı kotası olan küçük modele düşer. */
  assert.match(dir, /const lane = \[primary, primary, fallback\]/, 'model şeridi yok');
  assert.match(dir, /model: lane\[attempt\] \|\| primary,/, 'istek hâlâ tek modele gidiyor');
  assert.match(dir, /GROQ_PRESENTATION_MODEL_FALLBACK/, 'yedek model ortam değişkeni yok');
  assert.match(dir, /if \(outlineRaw\.length < Math\.max\(3, Math\.ceil\(slideCount \* 0\.5\)\)\) throw new Error\('INCOMPLETE_PLAN'\)/,
    'taslak eşiği hâlâ %75 — 10 asetatlık istekte 7 başlık gelince üretim tamamen düşer');
});

test('HER ÜRETİM YOLU PUANLANIR (13.11.2026, canlı ölçüm)', () => {
  /* 12.11 akşamı üretilen "Kuramsal Yaklaşımlar ve Hemşirelik Süreci" sunumu
     quality_score'suz kaydedildi ve presentation_generation_runs'a hiç satır
     düşmedi: source_type 'topic' olduğu için akış sunum-research'ten geçti,
     yönetmene hiç uğramadı. Kalite yalnız yönetmen yanıtından okunursa en çok
     kullanılan yolda puan hiç oluşmaz. Çözüm: deste basıldıktan sonra
     yönetmenin 'critique' eylemi (üretim yapmaz) desteyi puanlar. */
  assert.match(ink, /var kaliteOlc = function/, 'hazır desteyi puanlayan yol yok');
  assert.match(ink, /action: 'critique', presentation: \{ title: d\.title \|\| '', slides: sl \}/,
    'critique eylemi çağrılmıyor');
  assert.match(ink, /if \(mode !== 'append' && !deck\.quality && deck\.slides\.length\) kaliteOlc\(deck\);/,
    'deste basılınca puanlama tetiklenmiyor');
  assert.match(ink, /if \(!q \|\| typeof q\.score !== 'number' \|\| d !== deck\) \{ paintKalite\(\); return; \}/,
    'yanıt geldiğinde deste değişmiş olabilir — eski puan yeni desteye yazılmamalı');
  // critique üretim yapmaz: yönetmende kaynak yüklemeden önce döner.
  assert.match(dir, /if \(action === 'critique'\)[\s\S]{0,700}const source = await loadSource/,
    'critique kaynak yüklemesinden sonra çalışıyor — gereksiz yere pahalı');
});

/* --------------------------------------------------------------------------
   14.11.2026 — "Chp 7 Attitudes" destesinin canlı ölçümü. 13 asetat, puan
   boş, iki asetat aynı başlıklı, iki asetat boş görsel çerçevesi, 9 asetatın
   konuşma notu 16-23 kelime. Dördü de ayrı kök sebep:
     a) kaliteOlc yalnız printDeck'ten çağrılıyordu → kütüphaneden açılan
        desteye ulaşan yol yoktu.
     b) quality_report yazılıyor ama fetchDeck hiç okumuyordu → buluttan gelen
        her deste puansız görünüyordu.
     c) kurgu şeridinde tablo/diyagram türü veri olmadan seçilebiliyordu →
        LAY.table "başlık | başlık" yer tutucusunu, LAY.diagram boş kutuyu
        perdeye basıyordu.
     d) AI.note yalnız `ul` maddelerine bakıyordu → tablo/diyagram/alıntı
        asetatlarında şablon cümleye düşüyordu.
   -------------------------------------------------------------------------- */

test('HAZIR DESTE AÇILINCA PUANLANIR (14.11.2026)', () => {
  assert.match(ink, /if \(!deck\.quality && deck\.slides\.length > 2\) kaliteOlc\(deck\);/,
    'kütüphaneden açılan puansız deste ölçülmüyor — printDeck dışında kaliteye ulaşan yol yok');
  assert.ok(ink.includes("var kalBtn = Q('[data-kalite]');"),
    'elle yeniden ölçme düğmesi yok (deste düzenlenince puan bayatlar)');
  assert.match(ink, /deck\.quality = null;\s*\n?\s*\/\* elle istenen ölçüm/,
    'elle ölçüm eski puanı temizlemiyor — kaliteOlc hemen döner');
  assert.match(ink, /if \(kaliteBusy\) return;/, 'çift ölçüm engeli yok');
  assert.ok(html.includes('data-kalite='), 'sunum başlığında kalite rozeti yok');
});

test('KAYDEDİLEN KALİTE RAPORU GERİ OKUNUR (14.11.2026)', () => {
  /* quality_report 13.11'de yazılmaya başladı ama fetchDeck yalnız
     presentation_slides çekiyordu: puan buluttan dönmüyordu. */
  assert.match(ink, /select\('quality_report,source_type,source_id'\)\.eq\('id', m\.dbId\)/,
    'fetchDeck kalite raporunu çekmiyor — her açılışta boşuna yeniden ölçülür');
  assert.match(ink, /if \(qq && typeof qq\.score === 'number'\) d\.quality = qq;/,
    'rapor desteye yazılmıyor');
  assert.match(ink, /d\.source = pr\.data\.source_type \|\| 'blank'; d\.sourceId = pr\.data\.source_id \|\| null;/,
    'kaynak bağı buluttan dönmüyor — critique sourceType’ı yanlış gider');
});

test('BOŞ GÖRSEL ÇERÇEVESİ BASILMAZ (14.11.2026)', () => {
  assert.match(ink, /var dataKind = function \(s, k\)/, 'veri denetimi yok');
  assert.match(ink, /if \(k === 'table'\) return !!\(s\.data && arr\(s\.data\.rows\)\.some/,
    'tabloda dolu hücre aranmıyor — "başlık | başlık" yer tutucusu geçer');
  assert.match(ink, /if \(k === 'diagram'\) return !!\(s\.data && \(s\.data\.svg \|\| s\.data\.mermaid\)\)/,
    'boş diyagram kutusu geçer');
  // Şeritte seçilemez olmalı; seçili tür devre dışı bırakılmamalı (yoksa select kilitlenir).
  assert.match(ink, /var ok = k === s\.k \|\| dataKind\(s, k\);/,
    'veri gerektiren tür veri yokken de seçilebiliyor');
  assert.ok(ink.includes("(ok ? '' : ' (veri yok)')"), 'seçilemeyen türün nedeni yazılmıyor');
  // Son savunma: AI veri olmadan o türü döndürse bile basılmaz.
  assert.match(ink, /var kind = s\.k; if \(!dataKind\(s, kind\)\) \{ kind = 'list'; bosCerceve\+\+; \}/,
    'basarken maddeye düşürme yok — AI veri yollamazsa boş çerçeve perdeye çıkar');
  assert.match(ink, /bosCerceve \? ' ' \+ bosCerceve \+ ' asetatın tablo\/diyagram verisi gelmediği için madde düzenine alındı\.' : ''/,
    'düşürme kullanıcıya söylenmiyor');
});

test('KONUŞMA NOTU ASETATIN İÇERİĞİNDEN YAZILIR (14.11.2026)', () => {
  /* Ölçüm: maddeli iki asetatın notu 37 ve 44 kelime, tablo/diyagram/alıntı
     asetatlarının notu 16-23 — hepsi aynı şablon cümle. */
  assert.match(ink, /var t = titleOf\(s\), b = noteBits\(s, t\);/, 'AI.note hâlâ yalnız ul maddelerine bakıyor');
  assert.match(ink, /if \(b\.length\) return b;/, 'madde varken fazladan malzeme toplanıyor');
  assert.match(ink, /if \(!rows\.length\) return;\s+\/\* boş yer tutucu tablo/,
    'boş yer tutucu tablo "tabloda başlık ile başlık karşılaştırılıyor" notunu doğurur');
  assert.match(ink, /b\.push\('şemanın adımları: ' \+ lb\.join\(' → '\)\)/,
    'diyagram düğümleri nota girmiyor');
  assert.match(ink, /e\.text\.length > 24 && e\.text !== skip/,
    'başlığın kendisi nota ikinci kez giriyor (alıntı asetatında başlık = alıntı)');
  assert.match(ink, /var mmdLabels = function/, 'mermaid düğüm adlarını okuyan yol yok');
  /* Alıntı düzeninde tek yazı başlığın kendisi olduğu için ilk tur boş döner;
     "3 sayı"/SWOT/zaman çizelgesinde ise içerik kısa kutulara dağılmıştır. */
  assert.match(ink, /if \(s\.els\.some\(function \(e\) \{ return e\.type === 'h' && e\.text === '“'; \}\)\)/,
    'alıntı asetatı için not yolu yok (başlık = alıntı, b boş kalır)');
  assert.match(ink, /b\.push\('asetatta ' \+ kisa\.slice\(0, 6\)\.join\(', '\) \+ ' var; her birini bir cümleyle açıkla'\)/,
    '3 sayı / SWOT / zaman çizelgesi asetatları hâlâ şablon nota düşüyor');
  /* Canlı ölçüm (14.11.2026, "Chp 7 Attitudes"): tablo asetatı 23 → 53 kelime,
     diyagram 20 → 52, alıntı 23 → 36. Yerel koşu: tests/_not-olcum yoktur,
     ölçüm elle yapıldı; buradaki kilit, malzeme toplayan dalların durması. */
});

test('ÇİFT BAŞLIK YERELDE, ASETAT NUMARASIYLA BULUNUR (14.11.2026)', () => {
  /* Yönetmenin duplicate_titles sorunu hangi asetat olduğunu söylemiyor;
     üstelik Acadia'ya sormadan da bulunabilir. "Chp 7 Attitudes"te kopyalar
     çoğalt (⧉) düğmesiyle elde oluşmuştu, üretimde değil. */
  assert.match(ink, /var ciftBasliklar = function/, 'yerel çift başlık denetimi yok');
  assert.match(ink, /out\.push\(\(seen\[k\] \+ 1\) \+ '\. ve ' \+ \(i \+ 1\) \+ '\. asetat'\)/,
    'çift başlık asetat numarasıyla bildirilmiyor');
  assert.match(ink, /if \(cift\.length\) iss\.unshift\('aynı başlık: ' \+ cift\.join\(', '\)\)/,
    'rozet yerel bulguyu göstermiyor');
  assert.match(ink, /el\.classList\.toggle\('warn', !busy && !!iss\.length\)/,
    'sorun varken rozet uyarmıyor');
  const css = read('css/acadex-ink.css');
  assert.match(css, /\.sx-kal\.warn\{color:/, 'uyarı rozetinin stili yok');
});

test('KALİTE KARŞILIKLARI TEK YERDE (14.11.2026)', () => {
  /* Aynı Türkçe karşılık listesi hem üretim özetinde hem rozette gerekiyordu;
     iki kopya zamanla ayrışır. */
  assert.match(ink, /var KALITE_TR = \{ slide_count_mismatch:/, 'ortak karşılık tablosu yok');
  assert.equal((ink.match(/slide_count_mismatch: 'slayt sayısı/g) || []).length, 1,
    'karşılık tablosu iki yerde kopyalanmış');
  assert.match(ink, /var qi = kaliteYazi\(kq\);/, 'üretim özeti ortak tabloyu kullanmıyor');
});

summary();
