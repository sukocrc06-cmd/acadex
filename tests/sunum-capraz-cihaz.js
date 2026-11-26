/* ==========================================================================
   ACADEX — SUNUM ÇAPRAZ CİHAZ PAYLAŞIM BÜTÜNLÜĞÜ (tests/sunum-capraz-cihaz.js)

   NEDEN VAR (26.11.2026, 18A/18B):
     - #18'de paylaşılan deste yedek yazıdayken kaydedilince görüntü yazılmıyor, deste "bekliyor" işaretleniyordu;
       işaret yalnız o tarayıcıdaydı ve açılışta desteyi KAYDETTİRİYORDU (dirty). Hesap listesi geç gelince eski yerel
       kopya, başka cihazın yeni içeriğini hesaptan siliyordu (18A, gerçek profillerle 3/3).
     - 18B: açılış desteyi kaydetmez. İşaret ve içerik sürümü ilk asetatın content'inde taşınır; bekleyen görüntü
       yalnız share_snapshot olarak, hesaptaki içerik bu cihazdakiyle birebir aynıysa ve okunan sürüm (updated_at)
       hâlâ aynıysa yazılır; presentation_slides'a dokunulmaz.

   Düzenek: tests/_capraz-duzenek.js — her "cihaz" AYRI bir Chrome profili, gerçek sunum modülü; 127.0.0.1'de durumlu
   sahte hesap (updated_at tetikleyicisi, jsonb, koşullu UPDATE, get_shared_presentation). Dış ağ ve model çağrısı yok.
   Her görüntü yazımında değişmez denetlenir: görüntünün kurulduğu içerik sürümü = o anki içerik sürümü.
   Chrome yoksa testler AÇIKÇA atlanır (geçti sayılmaz).
   Çalıştırma:  node tests/sunum-capraz-cihaz.js
   ========================================================================== */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const ink = read('js/acadex-ink.js');
const { test, summary } = makeRunner();
const { CHROME, yeniSunucu, duzenek } = require('./_capraz-duzenek.js');

if (!CHROME) {
  console.log('  ATLANDI  X1–X11 (çapraz cihaz, gerçek Chrome profilleri): Chrome bulunamadı — CHROME_BIN ile yol verin. Bu testler GEÇTİ sayılmadı.');
  summary();
} else (async () => {
  const { sayfa, sayfaV, kos, temizle } = duzenek();

  const STRIPS = JSON.stringify([{ k: 'cover', t: 'Çapraz cihaz', b: [] }, { k: 'list', t: 'Liste', b: ['Bir madde', 'İki madde', 'Üç madde'] }, { k: 'end', t: 'Son', b: [] }]);
  const ekle = (iz) => `await sakin(); await bekle(800); yazi().text += '\\n${iz}'; S.dirty(); await bekle(4500); R.sonra = durum();`;
  const ADIM = [
    ['A1', 'A', 'ok', `await sakin(); d.querySelector('[data-newdeck]').click(); S.temaSec(TEMA); S.set(${STRIPS}, { title: 'Capraz', sub: 't', lang: 'tr', source: 'topic', sourceId: null }); S.bas('new'); await sakin();
      await bekle(3000); d.querySelector('[data-sh-on]').click(); await bekle(2500); R.sonra = durum();`],
    ['A2', 'A', 'cdn', ekle('MADDE-A2')],                                   /* yedek yazı: görüntü yazılmaz, işaret hesaba */
    ['B1', 'B', 'ok', `await dur(4000); R.sonra = durum();`],              /* temiz profil, düzenleme YOK */
    ['V1', 'V'],
    ['B2', 'B', 'ok', ekle('MADDE-B2')],
    ['A3', 'A', 'ok', `await dur(6000); R.sonra = durum();`],              /* eski yerel kopya + işaret; hesapta B'nin içeriği */
    ['V2', 'V'],
    /* sonraki adımlar temiz profillerle ("başka cihaz"): başsız Chrome'un sanal saati gerçek saatin önüne geçer; eski
       profil hesaptaki yeni sürümü syncList'in saat karşılaştırmasıyla fark etmeyebilir (gerçek cihaz saat kaymasıyla aynı, mevcut davranış) */
    ['A4', 'A4', 'cdn', `await dur(1500);` + ekle('MADDE-A4')],             /* yeniden bekleyen görüntü */
    ['B3', 'B3', 'ok', `await dur(6000); R.sonra = durum();`, 'araya'],    /* yenileme sırasında C kaydeder */
    ['V3', 'V'],
    ['A5', 'A5', 'cdn', `await dur(1500);` + ekle('MADDE-A5')],
    ['B4', 'B4', 'ok', `await dur(4000); R.sonra = durum();`, 'hata'],     /* sunucu görüntü yazımını reddeder */
    ['B5', 'B4', 'ok', `await dur(4000); R.sonra = durum();`],             /* aynı cihaz, tekrar: başarılı */
    ['V4', 'V'],
    /* eski yerel kopya + işaret, hesapta BAŞKA bir bekleyen içerik: eski kopyadan görüntü kurulmaz (ayniIcerik) */
    ['P1', 'P', 'cdn', `await dur(1500);` + ekle('MADDE-P')],
    ['Q1', 'Q', 'cdn', `await dur(1500);` + ekle('MADDE-Q')],
    ['P2', 'P', 'ok', `await dur(6000); R.sonra = durum();`],
    ['V5', 'V'],
  ];
  const kosu = async (mod) => {
    const H = yeniSunucu(); await new Promise((r) => H.srv.listen(0, '127.0.0.1', r)); const port = H.srv.address().port, OUT = {};
    const P = () => H.DB.presentations[0] || {}, SL = () => JSON.stringify(H.DB.presentation_slides.filter((r) => r.presentation_id === P().id).sort((a, b) => a.order_index - b.order_index).map((r) => r.content));
    try {
      for (const [ad, prof, font, govde, ozel] of ADIM) {
        const n0 = H.LOG.length, y0 = H.YAZIM.length, sl0 = SL(), u0 = P().updated_at, snap0 = JSON.stringify(P().share_snapshot || null);
        if (ozel === 'araya') H.AYAR.araya = () => H.cKaydet('MADDE-C');
        H.AYAR.hata = ozel === 'hata';
        const r = prof === 'V' ? await kos(mod + ad + '.html', mod + 'V' + ad, sayfaV(port, P().share_token)) : await kos(mod + ad + '.html', mod + prof, sayfa(font, port, ad === 'A3' && mod === 'gecik' ? 3000 : 0, govde));
        H.AYAR.hata = false; H.AYAR.araya = null;
        const log = H.LOG.slice(n0).filter((x) => x.op && x.op !== 'select');
        OUT[ad] = Object.assign(r, { yazmalar: log.map((x) => x.t + ':' + x.op + (x.keys ? '[' + x.keys.sort().join(',') + ']' : '') + (x.f.includes('updated_at') ? '?surum' : '')), yazim: H.YAZIM.slice(y0),
          slaytDegisti: SL() !== sl0, slayt: SL(), snapDegisti: JSON.stringify(P().share_snapshot || null) !== snap0, snap: JSON.stringify(P().share_snapshot || null), snapSurum: (P().share_snapshot || {}).surum || null,
          icerikSurum: (H.DB.presentation_slides.find((x) => x.presentation_id === P().id && x.order_index === 0) || { content: {} }).content.surum || null, u0, u1: P().updated_at });
      }
    } finally { H.srv.close(); }
    OUT.YAZIM = H.YAZIM; return OUT;
  };
  let RN = null, RG = null, hata = null;
  try { RN = await kosu('normal'); RG = await kosu('gecik'); } catch (e) { hata = e; }
  temizle();
  const X = (name, fn) => test(name, () => { if (hata) throw hata; [RN, RG].forEach((R) => Object.keys(R).forEach((k) => { if (R[k] && R[k].hata) throw new Error(k + ': ' + R[k].hata); })); fn(RN, 'normal'); fn(RG, 'gecik'); });
  const has = (s, x) => String(s || '').includes(x);
  const yalniz = (R, ad) => R[ad].yazmalar.filter((y) => /^presentations:update\[share_snapshot\]\?surum$/.test(y)).length;
  const fontBoy = (snap, id) => { const m = String(snap).match(new RegExp('data-id=\\\\"' + id + '\\\\"[^>]*font-size:(\\d+)px')); return m ? +m[1] : null; };

  X('X1 yedek yazıyla kayıt: görüntü yazılmaz, işaret ve içerik sürümü hesaba (ilk asetat) gider; yeni sütun yok', (R) => {
    assert.equal(R.A1.sonra.share, true); assert.ok(R.A1.snapSurum, 'normal paylaşımda görüntü içerik sürümünü taşır');
    assert.equal(R.A2.sonra.yedek, 1); assert.equal(R.A2.snapDegisti, false, 'yedek yazıda görüntü değişmemeli'); assert.ok(has(R.A2.slayt, 'MADDE-A2'));
    assert.ok(has(R.A2.slayt, '"snapBekle":1')); assert.notEqual(R.A2.icerikSurum, R.A2.snapSurum); assert.equal(R.A2.sonra.yerelBekle, 1);
  });
  X('X2 B (temiz profil) düzenleme YAPMADAN bekleyen görüntüyü yeniler: share_token ve işaret hesaptan, yalnız share_snapshot, koşullu', (R) => {
    assert.equal(R.B1.sonra.share, true, 'fetchDeck share_token okumalı'); assert.equal(R.B1.sonra.yedek, 0);
    assert.equal(yalniz(R, 'B1'), 1, R.B1.yazmalar.join(' ')); assert.deepEqual(R.B1.yazmalar, ['presentations:update[share_snapshot]?surum'], 'başka yazma olmamalı');
    assert.ok(has(R.B1.snap, 'MADDE-A2')); assert.equal(R.B1.snapSurum, R.B1.icerikSurum); assert.equal(R.B1.sonra.snapBekle, null); assert.equal(R.B1.sonra.yerelBekle, null);
    /* görüntü B'nin şablon yazısıyla sığdırılmış ekran boyutlarını taşır */
    R.B1.sonra.ekran.forEach((s) => s.forEach(([id, sz]) => assert.equal(fontBoy(R.B1.snap, id), sz, 'öğe ' + id)));
    assert.ok(has(R.V1.metin, 'MADDE-A2'), 'izleyici güncel içeriği görmeli');
  });
  X('X3 görüntü yenilemesi presentation_slides\'a dokunmaz; içerik sürümü değişmez (updated_at tetikleyiciyle değişir)', (R) => {
    ['B1', 'B3', 'B5'].forEach((ad) => { assert.equal(R[ad].slaytDegisti && ad !== 'B3', false, ad + ': asetatlar değişti'); assert.ok(!R[ad].yazmalar.some((y) => /^presentation_slides:/.test(y)), ad + ': ' + R[ad].yazmalar.join(' ')); });
    assert.notEqual(R.B1.u1, R.B1.u0, 'tablo tetikleyicisi updated_at\'i değiştirir (bilinen sınır)');
  });
  X('X4 A eski yerel kopyayla (işaretli) yeniden açılır — liste geç gelse bile — hesaba normal kayıt yapmaz, B\'nin içeriği korunur', (R) => {
    assert.ok(has(R.B2.slayt, 'MADDE-B2'));
    assert.ok(!R.A3.yazmalar.some((y) => /^presentation_slides:|slide_count/.test(y)), R.A3.yazmalar.join(' ')); assert.equal(R.A3.slaytDegisti, false); assert.ok(has(R.A3.slayt, 'MADDE-B2'), 'B\'nin içeriği hesapta kalmalı');
    assert.ok(has(R.V2.metin, 'MADDE-B2'));
  });
  X('X5 yenileme sırasında başka cihaz kaydeder: eski görüntü yazılmaz; güncel sürüm okunur, sığdırılır, yeniden denenir', (R) => {
    const y = R.B3.yazim.filter((x) => x.kaynak === 'yalniz'); assert.ok(y.length >= 1, 'yeniden deneme yazmadı: ' + R.B3.yazmalar.join(' '));
    assert.ok(R.B3.yazmalar.filter((x) => /\?surum$/.test(x)).length >= 2, 'ilk koşullu yazım çakışmalı, ikincisi yazmalı'); y.forEach((x) => { assert.ok(has(x.metin, 'MADDE-C')); });
    assert.ok(has(R.B3.snap, 'MADDE-C') && has(R.B3.snap, 'MADDE-A4')); assert.equal(R.B3.snapSurum, R.B3.icerikSurum); assert.ok(has(R.V3.metin, 'MADDE-C'));
  });
  X('X6 DEĞİŞMEZ: her görüntü yazımı o anki içerik sürümünden kurulmuş (eski görüntü hiç yazılmadı)', (R) => {
    /* "bağlantı oluştur" görüntüsü yerel kopyadan kurulur ve hemen ardından kayıtla (sürümlü) yenilenir: değişmezin dışında */
    const y = R.YAZIM.filter((x) => x.kaynak !== 'baglanti'); assert.ok(y.length >= 4); y.forEach((x, i) => assert.equal(x.surum, x.icerik, 'yazım ' + i + ' (' + x.kaynak + ')'));
  });
  X('X7 görüntü yazımı başarısız: işaret (yerel ve hesap) kalır; sonra yeniden denenir ve temizlenir', (R) => {
    assert.equal(R.B4.snapDegisti, false); assert.equal(R.B4.sonra.snapBekle, 1); assert.equal(R.B4.sonra.yerelBekle, 1); assert.notEqual(R.B4.snapSurum, R.B4.icerikSurum);
    assert.equal(yalniz(R, 'B5'), 1, R.B5.yazmalar.join(' ')); assert.ok(has(R.B5.snap, 'MADDE-A5')); assert.equal(R.B5.snapSurum, R.B5.icerikSurum); assert.equal(R.B5.sonra.snapBekle, null); assert.equal(R.B5.sonra.yerelBekle, null);
    assert.ok(has(R.V4.metin, 'MADDE-A5'));
  });
  X('X8 normal paylaşım ve kayıt: güncel görüntü normal kayıtla yazılır; içerikte sürüm, işaret yalnız atlanınca', (R) => {
    assert.ok(R.A1.yazmalar.some((y) => /share_snapshot,share_token/.test(y))); assert.ok(R.B2.yazim.some((x) => x.kaynak === 'push' && has(x.metin, 'MADDE-B2')), 'B artık paylaşımı bilir: düzenlemesi görüntüyü de yeniler');
    assert.ok(!has(R.B2.slayt, '"snapBekle":1')); assert.equal(R.B2.snapSurum, R.B2.icerikSurum);
  });
  X('X11 eski yerel kopya (işaretli) ve hesapta başka bekleyen içerik: eski kopyadan görüntü yazılmaz, asetatlara dokunulmaz', (R) => {
    assert.ok(has(R.Q1.slayt, 'MADDE-Q') && has(R.Q1.slayt, 'MADDE-P')); assert.ok(!R.P2.yazmalar.some((y) => /^presentation_slides:|slide_count/.test(y)), R.P2.yazmalar.join(' ')); assert.equal(R.P2.slaytDegisti, false);
    R.P2.yazim.forEach((x) => assert.ok(has(x.metin, 'MADDE-Q'), 'eski kopyadan görüntü yazıldı')); assert.ok(R.P2.sonra.metin.includes('MADDE-P'));
    if (!has(R.V5.metin, 'MADDE-Q')) assert.ok(!has(R.V5.metin, 'MADDE-P') || R.P2.yazim.length === 0, 'izleyici ya eski geçerli görüntüyü ya güncel içeriği görmeli');
  });
  X('X9 ağ: dış istek yok (yalnız yerel sahte hesap)', (R) => { Object.keys(R).filter((k) => R[k] && R[k].ag).forEach((k) => assert.deepEqual(R[k].ag, [], k)); });
  test('X10 kaynak: açılış kaydetmez; yenileme yalnız share_snapshot; var olan destede satır asetatlardan sonra; fetchDeck paylaşım ve işaret okur', () => {
    const i = ink.indexOf('  var yaziUyum = function () {'), yu = ink.slice(i, ink.indexOf('\n  };\n', i));
    assert.ok(!/dirty\(\)|saveNow\(\)|store\.push/.test(yu));
    assert.ok(ink.includes("var sh = await c.from('presentations').select('share_token').eq('id', m.dbId).maybeSingle(); if (!sh.error && sh.data && sh.data.share_token) d.share = sh.data.share_token;"));
    assert.ok(ink.includes('if (c0 && c0.snapBekle) d.snapBekle = 1;'));
    assert.ok(ink.includes('rows[0].content.surum = surum; if (!sn && d.share && d.dbId) rows[0].content.snapBekle = 1;'));
    let st = ''; try { st = require('node:child_process').execFileSync('git', ['status', '--porcelain', '--', 'supabase'], { cwd: ROOT }).toString(); } catch (e) { st = 'git yok'; }
    assert.equal(st, '', 'supabase/ (migration, fonksiyon) değişmemeli');
  });
  summary();
})();
