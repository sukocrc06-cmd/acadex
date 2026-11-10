/* ==========================================================================
   ACADEX — YENİ LOGO + GOOGLE'DA LOGO TESTLERİ (tests/logo-seo.js), 07.11.2026

   NEDEN VAR: logo değişti (kep + "A" + açık kitap). Eski dosya adları korunarak yenilendi
   (sayfa kodu değişmeden her yerde yeni logo). Google arama sonucunda logonun görünmesi için:
     - kökte /favicon.ico ve 48'in katı boyutlarda PNG ikonlar (Google favicon kuralı)
     - her sayfada aynı ikon etiketleri
     - ana sayfada Organization (logo) + WebSite (site adı) yapılandırılmış verisi
     - mutlak adresli paylaşım görseli, canonical, robots.txt ve sitemap.xml
   Çalıştırma:  node tests/logo-seo.js
   ========================================================================== */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeRunner } = require('./_ts-extract.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const { test, summary } = makeRunner();
const U = 'https://www.acadex.com.tr';

/* PNG başlığından boyut (bağımlılıksız) */
const pngBoyut = (p) => { const b = fs.readFileSync(path.join(ROOT, p)); assert.equal(b.toString('ascii', 1, 4), 'PNG', p + ' PNG değil'); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('ikon dosyaları var ve Google kuralına uygun (kare, 48 katı)', () => {
  for (const n of [48, 96, 192]) assert.deepEqual(pngBoyut('assets/icons/favicon-' + n + '.png'), [n, n]);
  const ico = fs.readFileSync(path.join(ROOT, 'favicon.ico'));
  assert.equal(ico.readUInt16LE(0), 0); assert.equal(ico.readUInt16LE(2), 1, 'ICO türü');
  const sayi = ico.readUInt16LE(4); assert.ok(sayi >= 3, 'favicon.ico 16/32/48 içerir');
  const boy = []; for (let i = 0; i < sayi; i++) boy.push(ico[6 + i * 16] || 256);
  assert.ok(boy.includes(48), 'ICO içinde 48 px');
  for (const [p, n] of [['assets/logo.png', 1024], ['assets/logo-icon-only.png', 512], ['assets/landing/acadex-logo.png', 256], ['assets/pwa/icon-192.png', 192], ['assets/pwa/icon-512.png', 512], ['assets/pwa/maskable-512.png', 512], ['assets/pwa/apple-touch-icon.png', 180], ['assets/pwa/badge-96.png', 96]]) assert.deepEqual(pngBoyut(p), [n, n], p);
  assert.deepEqual(pngBoyut('assets/og-acadex.png'), [1200, 630]);
  for (const f of ['assets/landing/acadex-logo.webp', 'assets/landing/acadex-logo.avif']) assert.ok(fs.statSync(path.join(ROOT, f)).size > 1000, f);
});

test('her sayfada aynı ikon etiketleri, eski tek PNG ikon kalmadı', () => {
  const sayfalar = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).concat(fs.readdirSync(path.join(ROOT, 'ingilizce')).filter((f) => f.endsWith('.html')).map((f) => 'ingilizce/' + f));
  let n = 0;
  for (const f of sayfalar) {
    const h = read(f); if (!/rel="icon"/.test(h)) continue; n++;
    assert.match(h, /<link rel="icon" href="\/favicon\.ico" sizes="any">/, f);
    assert.match(h, /<link rel="icon" type="image\/png" sizes="48x48" href="\/assets\/icons\/favicon-48\.png">/, f);
    assert.match(h, /<link rel="icon" type="image\/png" sizes="192x192" href="\/assets\/icons\/favicon-192\.png">/, f);
    assert.match(h, /rel="apple-touch-icon"/, f);
    assert.doesNotMatch(h, /<link rel="icon" type="image\/png" href=/, f + ': eski ikon etiketi');
  }
  assert.ok(n >= 18, 'ikonlu sayfa sayısı ' + n);
});

test('ana sayfa: Google site adı + logo yapılandırılmış verisi ve paylaşım görseli', () => {
  const h = read('index.html');
  const j = JSON.parse(h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const org = j['@graph'].find((x) => x['@type'] === 'Organization'), site = j['@graph'].find((x) => x['@type'] === 'WebSite');
  assert.equal(org.name, 'Acadex'); assert.equal(org.url, U + '/'); assert.equal(org.logo.url, U + '/assets/logo.png'); assert.ok(org.logo.width >= 112);
  assert.equal(site.name, 'Acadex'); assert.equal(site.url, U + '/');
  assert.ok(!JSON.stringify(j).includes('@gmail'), 'kişisel e-posta yapılandırılmış veride yok');
  assert.match(h, new RegExp('<meta property="og:image" content="' + U.replace(/\./g, '\\.') + '/assets/og-acadex\\.png">'));
  assert.match(h, /<link rel="canonical" href="https:\/\/www\.acadex\.com\.tr\/">/);
  assert.match(h, /<meta property="og:site_name" content="Acadex">/);
});

test('robots.txt ve sitemap.xml: ana sayfa taranabilir, yönetim sayfaları kapalı', () => {
  const r = read('robots.txt'), s = read('sitemap.xml');
  assert.match(r, /User-agent: \*\nAllow: \//); assert.match(r, /Disallow: \/admin/); assert.match(r, /Sitemap: https:\/\/www\.acadex\.com\.tr\/sitemap\.xml/);
  assert.doesNotMatch(r, /Disallow: \/assets|Disallow: \/favicon/, 'ikonlar Googlebot\'a açık');
  assert.match(s, /<loc>https:\/\/www\.acadex\.com\.tr\/<\/loc>/);
  assert.doesNotMatch(s, /admin|panel|dashboard/);
  assert.ok(read('manifest.webmanifest').includes('/assets/pwa/maskable-512.png'));
});

summary();
