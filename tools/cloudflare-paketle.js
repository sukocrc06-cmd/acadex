/* ==========================================================================
   ACADEX · Cloudflare Pages paketi (tools/cloudflare-paketle.js), 19.11.2026
   Cloudflare Pages ayarı:  Build command:  node tools/cloudflare-paketle.js
                            Build output directory:  dist
   Sitede yayınlanan dosyaları dist/ klasörüne kopyalar; testler, Supabase kaynakları,
   node_modules, notlar ve araçlar yayına girmez. _headers ve _redirects (vercel.json'ın
   karşılığı) dist/ köküne gider.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const KOK = path.join(__dirname, '..');
const HEDEF = path.join(KOK, 'dist');
/* yayına girmeyenler (kök düzeyinde ad) */
const DISARI = new Set(['dist', 'node_modules', 'tests', 'supabase', 'tools', '.git', '.github', 'Claude outputs',
  'package.json', 'package-lock.json', 'vercel.json', '.gitignore', '.gitattributes', '.vercelignore']);
const disariMi = (ad) => DISARI.has(ad) || /\.(md|ps1)$/i.test(ad) || /^Yeni Metin Belgesi/i.test(ad);

fs.rmSync(HEDEF, { recursive: true, force: true });
fs.mkdirSync(HEDEF);
let n = 0, boyut = 0;
const kopyala = (k, h) => {
  const st = fs.statSync(k);
  if (st.isDirectory()) { fs.mkdirSync(h, { recursive: true }); for (const a of fs.readdirSync(k)) kopyala(path.join(k, a), path.join(h, a)); return; }
  if (st.size > 25 * 1024 * 1024) throw new Error('Cloudflare Pages dosya başına 25 MB sınırı: ' + path.relative(KOK, k));
  fs.copyFileSync(k, h); n++; boyut += st.size;
};
for (const ad of fs.readdirSync(KOK)) { if (!disariMi(ad)) kopyala(path.join(KOK, ad), path.join(HEDEF, ad)); }
for (const f of ['_headers', '_redirects']) if (!fs.existsSync(path.join(HEDEF, f))) throw new Error(f + ' eksik');
if (n > 20000) throw new Error('Cloudflare Pages 20.000 dosya sınırı aşıldı: ' + n);
console.log('dist/ hazır: ' + n + ' dosya, ' + (boyut / 1048576).toFixed(1) + ' MB');
