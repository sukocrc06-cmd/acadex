/* ==========================================================================
   ACADEX — BÖLÜM AKIŞI (tests/bolum-akisi.js)

   NEDEN VAR (13.11.2026): koridor panosu 1.000 satırlık bir özellikti ve tek
   testi yoktu. Denetimde çıkanlar ve Berkay'ın istekleri burada kilitlenir:

     1) Akış profilleri `profiles`ten okuyordu; o tablonun SELECT politikası
        yalnız "kendi satırın" olduğu için paylaşan herkes "Bir arkadaşın" +
        "?" görünüyordu. Aynı tuzak 10.11'de sandbox panelinde bulunmuş ve
        public_profiles görünümüyle çözülmüştü; akışa uygulanmamıştı.
     2) Görünme tercihi: isteyen adıyla, isteyen "Bir arkadaş" olarak.
     3) Bölüm sekmesi: hangi bölümden paylaşıldıysa oradan seçilip gezilir.
     4) Raptiyelerin SELECT politikası 'true' idi — kimin neyi raptiyelediği
        herkese açıktı. Sayılar görünümden, kimlikler yalnız ilgilisine.
     5) Pano süsü tek tek kaldırılamıyordu (yalnız klavye Delete); dokunmatikte
        tek yol hepsini silmekti.

   Çalıştırma:  node tests/bolum-akisi.js
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
const html = read('dashboard.html');
const sql = read('supabase/migrations/20261113b_akis_bolum_ve_gizlilik.sql');

test('PROFİL ADLARI: akış public_profiles okur, profiles DEĞİL (13.11.2026)', () => {
  /* profiles RLS'i yalnız kendi satırını verir → akıştaki herkes anonim
     görünürdü. public_profiles dar kolon listesiyle bu boşluğu kapatır. */
  const akis = ink.split('BÖLÜM AKIŞI · koridor panosu')[1] || '';
  assert.ok(akis, 'bölüm akışı bloğu bulunamadı');
  const feed = akis.split('POMODORO')[0];
  assert.ok(!/from\('profiles'\)\s*\.?\s*\n?\s*\.select\('id, full_name/.test(feed),
    'akış hâlâ profiles tablosundan ad okuyor — herkes "Bir arkadaşın" görünür');
  assert.equal((feed.match(/from\('public_profiles'\)/g) || []).length, 2,
    'iki profil sorgusunun ikisi de public_profiles olmalı (ön yükleme + eksikler)');
  assert.ok(feed.includes("select('id, full_name, avatar_url, department, gizli')"),
    'gizli bayrağı çekilmiyor — görünme tercihi istemcide bilinmez');
});

test('GÖRÜNME TERCİHİ: adımla / "Bir arkadaş" (13.11.2026)', () => {
  assert.match(sql, /add column if not exists akis_gizli boolean not null default false/,
    'akis_gizli kolonu yok');
  // Görünüm tercihe uymalı: gizli seçende ad ve avatar null döner.
  assert.match(sql, /case when coalesce\(akis_gizli, false\) then null else full_name end as full_name/,
    'public_profiles gizli tercihini yok sayıyor — ad yine görünür');
  assert.match(sql, /case when coalesce\(akis_gizli, false\) then null else avatar_url end/,
    'gizli seçende avatar hâlâ paylaşılıyor');
  assert.ok(!/email|student_number|is_admin/.test(sql.split('create or replace view public.public_profiles')[1].split(';')[0]),
    'public_profiles görünümüne e-posta/numara/admin eklenmiş — ASLA eklenmez');
  assert.ok(html.includes('data-gizli='), 'akış başlığında görünme tercihi düğmesi yok');
  assert.match(ink, /from\('profiles'\)\.update\(\{ akis_gizli: yeni \}\)\.eq\('id', u2\.id\)/,
    'tercih kaydedilmiyor');
  assert.match(ink, /gizliCiz\(yeni\);[\s\S]{0,200}POSTS = \[\]; load\(\);/,
    'tercih değişince akış tazelenmiyor');
});

test('BÖLÜM SEKMESİ: hangi bölümden paylaşıldıysa seçilebilir (13.11.2026)', () => {
  /* Akış yalnız kendi bölümünü gösteriyordu. Artık paylaşılan kart giriş
     yapmış herkese açık; sekmeden bölüm seçiliyor. */
  assert.match(sql, /create policy study_cards_select_shared on public\.study_cards[\s\S]{0,120}using \(is_shared = true\)/,
    'paylaşılan kartlar bölümler arası görünür değil');
  assert.match(sql, /drop policy if exists "Users can view shared study cards in their department"/,
    'eski bölüm kilitli politika düşürülmüyor — iki politika OR’lanır, sorun olmaz ama kafa karıştırır');
  assert.ok(html.includes('data-bolumler='), 'bölüm sekmesi kabı yok');
  assert.match(ink, /var paintBolumler = function/, 'bölüm sekmesi çizilmiyor');
  assert.match(ink, /if \(F\.bolum !== '\*'\) qb = qb\.eq\('department', F\.bolum \|\| pf\.department\)/,
    'sorgu seçili bölüme göre süzülmüyor');
  assert.match(ink, /F\.bolum = yeni;[\s\S]{0,120}POSTS = \[\]; load\(\);/,
    'bölüm değişince sunucudan yeniden çekilmiyor');
  assert.match(ink, /if \(F\.bolum && F\.bolum !== '\*' && \(p\.dept \|\| ''\) !== F\.bolum\) return false;/,
    '"hepsi" seçiliyken istemci süzgeci her şeyi gizler');
  assert.match(ink, /dept: c\.department \|\| '',/, 'gönderiye bölüm taşınmıyor');
});

test('RAPTİYE GİZLİLİĞİ: sayı herkese, kim olduğu ilgilisine (13.11.2026)', () => {
  /* Eski politika 'true' idi: giriş yapan herkes KİMİN neyi raptiyelediğini
     okuyabiliyordu, üstelik bölüm farkı gözetmeden. */
  assert.match(sql, /drop policy if exists study_card_votes_select_authenticated/,
    'herkese açık raptiye politikası düşürülmüyor');
  assert.match(sql, /create policy study_card_votes_select_own_or_owner[\s\S]{0,260}auth\.uid\(\) = user_id/,
    'ham raptiye satırları hâlâ herkese açık');
  assert.match(sql, /create or replace view public\.study_card_pin_counts[\s\S]{0,200}count\(\*\)::integer as n/,
    'raptiye sayısı görünümü yok — sayılar kaybolur');
  assert.ok(!/user_id/.test(sql.split('study_card_pin_counts')[1].split('comment on view')[0]),
    'sayı görünümü user_id sızdırıyor');
  assert.match(ink, /var pinSay = function/, 'görünen raptiye sayısı görünümden okunmuyor');
  assert.match(ink, /btn\.querySelector\('\.n'\)\.textContent = pinSay\(p\);/,
    'raptiye takınca sayı güncellenmiyor');
  assert.match(ink, /pp\.pinN = Math\.max\(0, \(pp\.pinN \|\| 0\) \+ \(on \? 1 : -1\)\)/,
    'kendi raptiyen toplam sayıya yansımıyor');
});

test('PANO SÜSÜ TEK TEK KALDIRILIR (13.11.2026)', () => {
  /* Canlı bulgu: süs eklenince geri alınamıyordu; tek yol "ilk hâline döndür"
     ve o hepsini siliyordu. Klavye Delete vardı ama dokunmatikte yok. */
  assert.ok(ink.includes('data-stk-sil='), 'süsün kendi kaldırma düğmesi yok');
  assert.match(ink, /var o = stkById\(x\.getAttribute\('data-stk-sil'\)\);[\s\S]{0,200}say\('Süs kaldırıldı\.'/,
    'kaldırma geri alınabilir değil');
  assert.match(ink, /if \(e\.target\.closest\('\[data-stk-sil\]'\)\) return;\s*\n?\s*\/\* kaldırma düğmesi sürüklemeyi başlatmasın \*\//,
    'kaldırma düğmesi sürüklemeyi tetikler');
  const css = read('css/acadex-ink.css');
  assert.ok(css.includes('.bp-stk-x{'), 'kaldırma düğmesinin stili yok');
  assert.match(css, /body\.axb-deco[^{]*\.bp-stk-x[^{]*\{display:flex\}/,
    'kaldırma düğmesi yalnız süsleme modunda görünmeli');
});

test('KARTLARIMA AL + ARAMA + HAFTANIN KÂĞIDI + NOT BİLDİRİMİ (13.11.2026)', () => {
  /* Panodaki özeti yalnız okuyabiliyordun. Kopya SUNUCUDA üretilir: kart 36
     kolonlu, istemci tek tek yazarsa yeni kolon eklendiğinde kopya sessizce
     eksilir. */
  const kop = read('supabase/migrations/20261113c_kart_kopyala.sql');
  assert.match(kop, /where id = p_card and is_shared = true/, 'paylaşılmamış kart da kopyalanabiliyor');
  assert.match(kop, /if v_sahip = auth\.uid\(\) then return null/, 'kendi kartını kopyalamak engellenmiyor');
  assert.match(kop, /where user_id = auth\.uid\(\) and kaynak_kart = p_card limit 1/,
    'ikinci kez kopyalamak yeni kart üretiyor');
  assert.match(kop, /auth\.uid\(\), null, c\.id, false, null, null,/,
    'kopya: sahibi sen, belge bağı YOK, kapalı doğmalı (belge erişimi sızmasın)');
  assert.match(kop, /if public\.misafir_mi\(\) then/, 'misafir kart kopyalayabiliyor');
  assert.ok(ink.includes("data-a=\"kopya\""), 'panoda "kartlarıma al" düğmesi yok');
  assert.match(ink, /\(own \? '' :/, 'kendi kâğıdında da kopyala düğmesi çıkıyor');
  assert.match(ink, /rpc\('study_card_kopyala', \{ p_card: id \}\)/, 'kopyalama sunucuya gitmiyor');
  /* Arama: başlık, madde, etiket, kişi; Türkçe harf katlamalı. */
  assert.ok(html.includes('data-ara='), 'panoda arama kutusu yok');
  assert.match(ink, /var araUyar = function/, 'arama süzgeci yok');
  assert.match(ink, /if \(F\.q && !araUyar\(p, F\.q\)\) return false;/, 'arama listeyi süzmüyor');
  assert.match(ink, /toLocaleLowerCase\('tr'\)/, 'arama Türkçe harfleri katlamıyor (İSTATİSTİK bulunmaz)');
  /* Haftanın kâğıdı: son 7 gün, en az 2 raptiye, süzgeç açıkken gizli. */
  assert.match(ink, /var haftaninKarti = function/, 'haftanın kâğıdı yok');
  assert.match(ink, /n >= 2 && \(!en \|\| n > pinSay\(en\)\)/, 'tek raptiyeyle "haftanın kâğıdı" olmamalı');
  assert.match(ink, /\(F\.tag \|\| F\.who \|\| F\.mode \|\| F\.q\) \? null : haftaninKarti\(\)/,
    'süzgeç/arama açıkken haftanın kâğıdı gizlenmiyor');
  /* Kendi kâğıdına not düşülünce bildirim (raptiye bildirimi zaten vardı). */
  const dash = read('js/dashboard.js');
  assert.ok(dash.includes("'Kâğıdına kenar notu düşüldü'"), 'kenar notu bildirimi yok');
  assert.match(dash, /from\('study_card_notes'\)[\s\S]{0,260}\.neq\('user_id', currentUser\.id\)/,
    'kendi notların da bildiriliyor');
  assert.match(dash, /from\('study_cards'\)\s*\n\s*\.select\('id'\)\s*\n\s*\.eq\('user_id', currentUser\.id\)\s*\n\s*\.eq\('is_shared', true\)/,
    'bildirim yalnız kendi PAYLAŞILAN kâğıtların için olmalı');
});

summary();
