/* ==========================================================================
   ACADEX — HESABA ULAŞMAMIŞ YEREL DÜZENLEMENİN KORUNMASI (tests/sunum-yerel-koruma.js)

   NEDEN VAR (26.11.2026, 18C):
     - saveLocal yerel kaydı yapınca store.dirty kalkıyordu; hesaba gönderim başarısız olsa (sunucu hatası, çevrimdışı)
       bile syncList yalnız saat karşılaştırmasına bakıp (hesap updated_at > yerel + 2 sn) hesaptaki kopyayı açıyor,
       openDeck yerel kopyanın üzerine yazıyordu. 18B'nin yalnız görüntü yenilemesi de presentations_set_updated_at
       tetikleyicisiyle updated_at'i ilerletir: başka bir cihazın görüntü yenilemesi bu cihazdaki gönderilmemiş işi
       sessizce siliyordu.
     - Düzeltme: hesaba ulaşmamış yerel iş meta'da işaretlenir (bekleyen), hesaptaki kopya onun üzerine açılmaz;
       hesaptaki içerik sürümü bu cihazın son eşitlendiği sürümle aynıysa (yalnız görüntü/updated_at değiştiyse) yerel
       iş yeniden gönderilir, değilse gönderilmez ve kullanıcıya söylenir (iki taraf da korunur).

   Senaryolar (her biri ayrı Chrome profilleri; iki hata türü × normal/geç hesap listesi):
     L  gönderilmemiş yerel düzenleme + başka cihazın görüntü yenilemesi → yerel iş korunur ve hesaba ulaşır
     R  yerel düzenleme yokken başka cihazın içerik güncellemesi → hesaptaki kopya açılır (eski davranış)
     P  başarılı yerel kayıt + başka cihazın görüntü yenilemesi → içerik korunur, gereksiz yazma yok
     G  görüntü yenilemesi sırasında yerel düzenleme + gönderim hatası + sürüm çakışması → çakışma kurtarması yerel
        işi ezmez; sonraki açılışta da hesaptaki başka içerik yerel işin üzerine yazılmaz, yerel iş de onun üzerine
   Düzenek: tests/_capraz-duzenek.js (senkron saat açık). Chrome yoksa testler AÇIKÇA atlanır.
   Çalıştırma:  node tests/sunum-yerel-koruma.js
   ========================================================================== */
'use strict';

const assert = require('node:assert/strict');
const { makeRunner } = require('./_ts-extract.js');
const { CHROME, read, yeniSunucu, duzenek } = require('./_capraz-duzenek.js');

const ink = read('js/acadex-ink.js');
const { test, summary } = makeRunner();

if (!CHROME) {
  console.log('  ATLANDI  Y1–Y6 (yerel iş koruması, gerçek Chrome profilleri): Chrome bulunamadı — CHROME_BIN ile yol verin. Bu testler GEÇTİ sayılmadı.');
  summary();
} else (async () => {
  const { sayfa, kos, temizle } = duzenek();
  const STRIPS = JSON.stringify([{ k: 'cover', t: 'Yerel koruma', b: [] }, { k: 'list', t: 'Liste', b: ['Bir madde', 'İki madde', 'Üç madde'] }, { k: 'end', t: 'Son', b: [] }]);
  const ekle = (iz, once) => `await dur(800); ${once || ''} yazi().text += '\\n${iz}'; S.dirty(); await bekle(4500); R.sonra = durum();`;
  const adimlar = (tur) => {
    const kopuk = tur === 'cevrimdisi' ? 'window.__cevrimdisi = true;' : '';
    return [
      ['L0', 'A', 'ok', `await sakin(); d.querySelector('[data-newdeck]').click(); S.temaSec(TEMA); S.set(${STRIPS}, { title: 'Yerel', sub: 't', lang: 'tr', source: 'topic', sourceId: null }); S.bas('new'); await sakin();
        await bekle(3000); d.querySelector('[data-sh-on]').click(); await bekle(2500); R.sonra = durum();`],
      ['L1', 'A', 'cdn', ekle('MADDE-A1')],                                             /* yedek yazı: görüntü bekler */
      ['L2', 'A', 'cdn', ekle('MADDE-YEREL', kopuk), 'pushHata'],                        /* gönderim başarısız: iş yalnız bu cihazda */
      ['L3', 'B-L3', 'ok', `await dur(4000); R.sonra = durum();`],                       /* başka cihaz: yalnız görüntü yeniler → updated_at ilerler */
      ['L4', 'A', 'ok', `await dur(6000); R.sonra = durum();`, 'gecik'],                 /* A yeniden eşitlenir */
      ['R1', 'B-R1', 'ok', ekle('MADDE-R')],                                             /* başka cihaz içerik değiştirir */
      ['R2', 'A', 'ok', `await dur(6000); R.sonra = durum();`, 'gecik'],                 /* A'da yerel iş yok: hesaptaki kopya açılır */
      ['P1', 'A', 'cdn', ekle('MADDE-P')],                                               /* başarılı kayıt (görüntü bekler) */
      ['P2', 'B-P2', 'ok', `await dur(4000); R.sonra = durum();`],
      ['P3', 'A', 'ok', `await dur(6000); R.sonra = durum();`, 'gecik'],
      ['G1', 'A', 'cdn', ekle('MADDE-G')],
      /* G cihazı hesaptan açar, görüntüyü yenilerken (koşullu yazım gönderilmeden hemen önce) yerel düzenleme yapılır,
         gönderimi başarısız olur; aynı anda C cihazı kaydeder → sürüm çakışması */
      ['G2', 'G', 'ok', `window.__casOnce = async function () { yazi().text += '\\nMADDE-G-YEREL'; ${kopuk} S.saveNow(); clearTimeout(S.store.timer); S.store.timer = 0; await S.store.push(S.deck()); window.__cevrimdisi = false; };
        await dur(6000); R.sonra = durum();`, 'araya' + (tur === 'hata' ? '+pushHata' : '')],
      ['G3', 'G', 'ok', `await dur(6000); R.sonra = durum();`, 'gecik'],                 /* G yeniden açılır: hesapta C'nin içeriği */
      /* K: kayıt sürerken yeni yerel düzenleme kaydedilir; o kayıt başarılı biter ama sonraki gönderim başarısız olur
         (çevrimdışı). Bekleyen işaret ilk kaydın başarısıyla kalkmamalı. */
      ['K0', 'K', 'ok', `await dur(1500); R.sonra = durum();`, 'gecik'],                 /* K cihazı hesaptan açar (G3'teki işi taşımaz) */
      ['K1', 'K', 'ok', `await dur(800); window.__pushOnce = function () { yazi().text += '\\nMADDE-K'; S.saveNow(); window.__sonraCevrimdisi = true; }; yazi().text += '\\nMADDE-K0'; S.dirty(); await bekle(6000); R.sonra = durum();`],
      ['K2', 'N'],                                                                        /* yalnız updated_at ilerler */
      ['K3', 'K', 'ok', `await dur(6000); R.sonra = durum();`, 'gecik'],
    ];
  };
  const kosu = async (tur, gecikmeli) => {
    const H = yeniSunucu({ senkron: true }); await new Promise((r) => H.srv.listen(0, '127.0.0.1', r)); const port = H.srv.address().port, OUT = {};
    try {
      for (const [ad, prof, font, govde, ozel] of adimlar(tur)) {
        const n0 = H.LOG.length, y0 = H.YAZIM.length, sl0 = H.slayt();
        H.AYAR.pushHata = /pushHata/.test(ozel || '') && tur === 'hata';      /* çevrimdışı türünde gönderimi sayfa keser */
        if (/araya/.test(ozel || '')) H.AYAR.araya = () => H.cKaydet('MADDE-C2');
        const r = prof === 'N' ? (H.dokun(), {}) : await kos(tur + gecikmeli + ad + '.html', tur + gecikmeli + prof, sayfa(font, port, /gecik/.test(ozel || '') && gecikmeli ? 3000 : 0, govde));
        H.AYAR.pushHata = false; H.AYAR.araya = null;
        const log = H.LOG.slice(n0).filter((x) => x.op && x.op !== 'select');
        OUT[ad] = Object.assign(r, { yazmalar: log.map((x) => x.t + ':' + x.op + (x.keys ? '[' + x.keys.sort().join(',') + ']' : '') + (x.f.includes('updated_at') ? '?surum' : '')), yazim: H.YAZIM.slice(y0), slayt: H.slayt(), slaytDegisti: H.slayt() !== sl0 });
      }
    } finally { H.srv.close(); }
    return OUT;
  };
  const KOSULAR = [['hata', 0], ['hata', 1], ['cevrimdisi', 0], ['cevrimdisi', 1]], SON = {};
  let hata = null;
  try { for (const [t, g] of KOSULAR) SON[t + (g ? '+gecik' : '')] = await kosu(t, g); } catch (e) { hata = e; }
  temizle();
  const has = (s, x) => String(s || '').includes(x);
  const Y = (name, fn) => test(name, () => { if (hata) throw hata; Object.keys(SON).forEach((k) => { Object.keys(SON[k]).forEach((a) => { if (SON[k][a].hata) throw new Error(k + ' ' + a + ': ' + SON[k][a].hata); }); try { fn(SON[k], k); } catch (e) { e.message = '[' + k + '] ' + e.message; throw e; } }); });

  Y('Y1 gönderilmemiş yerel düzenleme + başka cihazın yalnız görüntü yenilemesi: yerel iş SİLİNMEZ ve hesaba ulaşır', (R) => {
    assert.ok(has(R.L2.sonra.metin, 'MADDE-YEREL') && !has(R.L2.slayt, 'MADDE-YEREL'), 'L2: düzenleme yalnız yerelde olmalı (gönderim başarısız)');
    assert.ok(R.L3.yazmalar.includes('presentations:update[share_snapshot]?surum'), 'L3: başka cihaz görüntüyü yenilemeli (updated_at ilerler): ' + R.L3.yazmalar.join(' '));
    assert.ok(has(R.L4.sonra.metin, 'MADDE-YEREL'), 'L4: yerel düzenleme ekranda kalmalı'); assert.ok(has(R.L4.sonra.yerelMetin, 'MADDE-YEREL'), 'L4: yerel kayıtta kalmalı');
    assert.ok(has(R.L4.slayt, 'MADDE-YEREL') && has(R.L4.slayt, 'MADDE-A1'), 'L4: yerel iş hesaba ulaşmalı, hesaptaki önceki içerik de durmalı');
    assert.equal(R.L4.sonra.bekleyen, null, 'L4: gönderim başarılı → bekleyen işaret kalkar');
  });
  Y('Y2 yerel düzenleme yokken başka cihazın içerik güncellemesi: hesaptaki kopya açılır (eski davranış)', (R) => {
    assert.ok(has(R.R1.slayt, 'MADDE-R')); assert.ok(has(R.R2.sonra.metin, 'MADDE-R'), 'R2: A hesaptaki yeni içeriği görmeli');
    assert.ok(!R.R2.yazmalar.some((y) => /^presentation_slides:/.test(y)), 'R2: A yazmamalı: ' + R.R2.yazmalar.join(' '));
  });
  Y('Y3 başarılı yerel kayıt + başka cihazın görüntü yenilemesi: içerik korunur, A gereksiz kayıt yapmaz', (R) => {
    assert.ok(has(R.P1.slayt, 'MADDE-P')); assert.ok(R.P2.yazmalar.includes('presentations:update[share_snapshot]?surum'), R.P2.yazmalar.join(' '));
    assert.ok(has(R.P3.sonra.metin, 'MADDE-P') && has(R.P3.slayt, 'MADDE-P')); assert.equal(R.P3.slaytDegisti, false); assert.ok(!R.P3.yazmalar.some((y) => /^presentation_slides:/.test(y)), R.P3.yazmalar.join(' '));
  });
  Y('Y4 çakışma kurtarması: görüntü yenilemesi sırasında yapılan ve gönderilemeyen yerel düzenleme ezilmez', (R) => {
    assert.ok(R.G2.yazmalar.filter((y) => /\?surum$/.test(y)).length >= 1, 'G2: koşullu yazım denenmeli'); assert.equal(R.G2.yazim.filter((x) => x.kaynak === 'yalniz').length, 0, 'G2: sürüm çakışmalı, görüntü yazılmamalı');
    assert.ok(has(R.G2.slayt, 'MADDE-C2') && !has(R.G2.slayt, 'MADDE-G-YEREL'), 'G2: hesapta C\'nin içeriği, G\'nin işi gönderilemedi');
    assert.ok(has(R.G2.sonra.metin, 'MADDE-G-YEREL') && has(R.G2.sonra.yerelMetin, 'MADDE-G-YEREL'), 'G2: yerel düzenleme ekranda ve yerel kayıtta kalmalı');
  });
  Y('Y5 sonraki açılış: hesapta başka cihazın içeriği varken gönderilmemiş yerel iş ne silinir ne de hesaptakinin üzerine kendiliğinden yazılır', (R) => {
    assert.ok(has(R.G3.sonra.metin, 'MADDE-G-YEREL') && has(R.G3.sonra.yerelMetin, 'MADDE-G-YEREL'), 'G3: yerel iş korunmalı');
    assert.ok(has(R.G3.slayt, 'MADDE-C2') && !has(R.G3.slayt, 'MADDE-G-YEREL'), 'G3: hesaptaki C içeriği ezilmemeli'); assert.equal(R.G3.slaytDegisti, false);
    assert.equal(R.G3.sonra.bekleyen, 1, 'G3: iş hâlâ gönderilmedi'); assert.match(R.G3.sonra.not, /başka bir cihazda/, 'G3: kullanıcıya söylenmeli');
  });
  Y('Y7 kayıt sürerken kaydedilen yerel düzenleme: kayıt başarılı bitse de iş "bekleyen" kalır; sonraki gönderim başarısızsa yeniden eşitlemede silinmez ve gönderilir', (R) => {
    assert.ok(has(R.K1.slayt, 'MADDE-K0') && !R.K1.slayt.replace(/MADDE-K0/g, '').includes('MADDE-K'), 'K1: ilk kayıt yalnız MADDE-K0 taşımalı');
    assert.ok(has(R.K1.sonra.yerelMetin, 'MADDE-K0') && R.K1.sonra.yerelMetin.replace(/MADDE-K0/g, '').includes('MADDE-K'), 'K1: ikinci düzenleme yerelde'); assert.equal(R.K1.sonra.bekleyen, 1, 'K1: iş hâlâ bekliyor');
    assert.ok(R.K3.sonra.metin.replace(/MADDE-K0/g, '').includes('MADDE-K'), 'K3: yerel düzenleme silinmemeli'); assert.ok(R.K3.slayt.replace(/MADDE-K0/g, '').includes('MADDE-K'), 'K3: hesaba ulaşmalı');
  });
  test('Y6 kaynak: hesaba ulaşmamış iş işaretlenir; hesaptaki kopya onun üzerine açılmaz; yeniden gönderim içerik sürümüne bakar', () => {
    assert.ok(/m\.updated = d\.updated; m\.bekleyen = 1;/.test(ink), 'saveLocal bekleyen işaretler');
    assert.ok(/if \(m && d\.updated === u0\) delete m\.bekleyen;/.test(ink), 'push yalnız değişmemişse işareti kaldırır');
    assert.ok(/if \(m && m\.dbId && store\.cloud && !\(m\.bekleyen && d\) && \(hesaptan \|\| !d \|\| \(m\.remote \|\| 0\) > \(m\.updated \|\| 0\) \+ 2000\)\) \{/.test(ink), 'openDeck bekleyen yerel kopyanın üzerine açmaz');
    assert.ok(/\(m0 && !m0\.bekleyen && !store\.dirty && \(m0\.remote \|\| 0\) > \(m0\.updated \|\| 0\) \+ 2000\)\) openDeck/.test(ink), 'syncList bekleyen kopyayı yeniden açmaz');
    assert.ok(/if \(uzak === \(m\.surum \|\| null\)\) \{ store\.queueCloud\(\); return 'gonder'; \}/.test(ink), 'yeniden gönderim içerik sürümüne bakar');
  });
  summary();
})();
