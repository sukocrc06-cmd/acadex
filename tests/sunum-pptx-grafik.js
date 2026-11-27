/* ==========================================================================
   ACADEX — PPTX YERLİ GRAFİK DOĞRULAMASI (tests/sunum-pptx-grafik.js)

   NEDEN VAR (27.11.2026, #47 Track B): #45/#46 destelerinde "grafik" şeritleri sayı verisi taşımadığı için liste
   düzenine dönüştü; PPTX'te tek bir ppt/charts/ parçası yoktu, yani exportPptx'in yerli grafik dalı hiç koşmadı.
   Bu dosya o dalı üretim yolundan koşturur ve sonucu XML düzeyinde doğrular.

   GRAFİK TÜRLERİ (kaynakta ne var):
   - Yerli PowerPoint grafiği: editörde type:'chart' öğesi. chart.type 'bar' | 'line' | 'pie' | 'doughnut' →
     pptxgenjs addChart (bar/line/pie/doughnut); 'ring' (sayı kartındaki tek yüzde) → doughnut, iki dilim [v, 100−v].
     Üreten yollar: LAY.chart, VARY.chart[0] (grafik + çıkarımlar), VARY.stat halkalar (yüzde), özet kartı cardVisuals.
   - SVG/resim: viz, mmd (diyagram) → PPTX'e resim olarak gider, grafik değildir.
   - Şekil infografiği / liste-sayı düzeni (stat daireler/satırlar, list) → yazı + şekil; grafik değildir.

   SENTETİK VERİ: Tüm sayılar ve etiketler uydurma test verisidir; gerçek bir araştırma iddiası değildir.
   DOĞRULAMA AYRIMI: XML/ilişki/geometri doğrulamasıdır. PowerPoint/Keynote'ta görsel çizim burada ölçülmez.
   Gerçek kütüphane: PPTXGEN_BUNDLE ya da node_modules/pptxgenjs/dist/pptxgen.bundle.js; yoksa C ATLANDI (GEÇTİ sayılmaz).
   Çalıştırma: node tests/sunum-pptx-grafik.js   (PPTX_DIR=klasör → üretilen .pptx dosyası yazılır)
   ========================================================================== */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { execFile } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { makeRunner } = require('./_ts-extract.js');
const { ROOT, read, CHROME, yeniSunucu, duzenek } = require('./_capraz-duzenek.js');

const ink = read('js/acadex-ink.js');
const { test, summary } = makeRunner();
const cut = (a, b) => { const i = ink.indexOf(a); assert.ok(i >= 0, 'bulunamadı: ' + a.slice(0, 60)); const j = ink.indexOf(b, i + a.length); assert.ok(j > i, 'son bulunamadı'); return ink.slice(i, j); };

/* ---------- A: kaynak — yerli grafik dalı var ve tür eşlemesi ---------- */
test('A1 exportPptx yerli grafik dalı: bar/line/pie/doughnut addChart, ring → doughnut [v, 100−v], veri yoksa EXPORT_CHART_SKIPPED; çubuk/çizgide ondalık etiket (#47)', () => {
  const ex = cut('  var exportPptx = async function', '\n  };\n');
  assert.ok(/else if \(e\.type === 'chart'\) \{/.test(ex));
  assert.ok(ex.includes("var ct = /doughnut/.test(ty) ? pp.ChartType.doughnut : /pie|pasta/.test(ty) ? pp.ChartType.pie : /line|çizgi/.test(ty) ? pp.ChartType.line : pp.ChartType.bar;"));
  assert.ok(ex.includes("sl.addChart(pp.ChartType.doughnut, [{ name: titleOf(s) || 'Oran', labels: ['', ''], values: [rv0, 100 - rv0] }]"));
  assert.ok(ex.includes("if (!vals.length) { qaK.push(['EXPORT_CHART_SKIPPED', si, e.id]); continue; }"));
  assert.ok(ex.includes("ond ? { dataLabelFormatCode: '#,##0.' + '0'.repeat(ond) } : {}") && /var ond = ct === pp\.ChartType\.bar \|\| ct === pp\.ChartType\.line \?/.test(ex), '#47 ondalık etiket');
  assert.ok(/LAY\.chart = \{ l: 'grafik', f: function \(t, b, c\) \{ var d = \(c && c\.data\) \|\| \{\}; return head\(t\)\.concat\(\[E\('chart'/.test(ink));
});

/* ---------- Node: ZIP okuyucu (bağımlılıksız; sunum-pptx-tutarlilik.js ile aynı) ---------- */
const unzip = (buf) => {
  const out = {}; let e = buf.length - 22; while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--; assert.ok(e >= 0, 'ZIP sonu yok');
  const n = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16);
  for (let i = 0; i < n; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50, 'merkez dizin bozuk');
    const m = buf.readUInt16LE(p + 10), cs = buf.readUInt32LE(p + 20), fl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), kl = buf.readUInt16LE(p + 32), lo = buf.readUInt32LE(p + 42);
    const ad = buf.toString('utf8', p + 46, p + 46 + fl), lf = buf.readUInt16LE(lo + 26), lx = buf.readUInt16LE(lo + 28), d = buf.subarray(lo + 30 + lf + lx, lo + 30 + lf + lx + cs);
    out[ad] = m === 8 ? zlib.inflateRawSync(d) : Buffer.from(d); p += 46 + fl + xl + kl;
  }
  return out;
};
const xs = (z, k) => (z[k] ? z[k].toString('utf8') : '');
const rels = (x) => { const o = {}; x.replace(/<Relationship ([^>]+?)\/?>/g, (m, a) => { o[(a.match(/Id="([^"]+)"/) || [])[1]] = { t: (a.match(/Target="([^"]+)"/) || [])[1], tip: ((a.match(/Type="([^"]+)"/) || [])[1] || '').split('/').pop() }; return m; }); return o; };
const yol = (dosya, hedef) => (hedef.startsWith("/") ? hedef.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(dosya), hedef)));      /* OPC: "/ppt/charts/…" paket köküne göredir (pptxgenjs asetat→grafik bağını böyle yazar) */
const relsOf = (z, dosya) => rels(xs(z, path.posix.join(path.posix.dirname(dosya), '_rels', path.posix.basename(dosya) + '.rels')));
const ptler = (x) => { const o = []; x.replace(/<c:pt idx="(\d+)">\s*<c:v>([^<]*)<\/c:v>/g, (m, i, v) => { o[+i] = v; return m; }); return o; };
const unesc = (t) => String(t).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const EMU = 9525, SW = 9144000, SH = 5143500;
/* asetat → grafik çerçeveleri: r:id → ppt/charts/chartN.xml → seri, kategori, değer, tür, gömülü çalışma kitabı */
const grafikler = (z) => {
  const P = xs(z, 'ppt/presentation.xml'), PR = relsOf(z, 'ppt/presentation.xml'), CT = xs(z, '[Content_Types].xml'), ids = [];
  P.replace(/<p:sldId id="\d+" r:id="([^"]+)"\/>/g, (m, r) => { ids.push(r); return m; });
  return ids.map((rid) => {
    const t = yol('ppt/presentation.xml', PR[rid].t), x = xs(z, t), rr = relsOf(z, t);
    return x.split('<p:graphicFrame>').slice(1).map((b) => b.split('</p:graphicFrame>')[0]).filter((b) => /<c:chart /.test(b)).map((b) => {
      const r = (b.match(/<c:chart [^>]*r:id="([^"]+)"/) || [])[1], rel = rr[r] || {}, cp = rel.t ? yol(t, rel.t) : '', cx = xs(z, cp), cr = cp ? relsOf(z, cp) : {};
      const emb = Object.values(cr).find((v) => /package|oleObject/.test(v.tip)), ep = emb ? yol(cp, emb.t) : '';
      const xf = (b.match(/<p:xfrm>\s*<a:off x="(-?\d+)" y="(-?\d+)"\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\/>/) || []).slice(1).map(Number);
      const sers = cx.split('<c:ser>').slice(1).map((s) => s.split('</c:ser>')[0]);
      return { asetat: t, rid: r, relTip: rel.tip, parca: cp, var: !!z[cp], ct: CT.includes('PartName="/' + cp + '"') && /drawingml\.chart\+xml/.test(CT.split('PartName="/' + cp + '"')[1] || ''),
        tur: ((cx.match(/<c:(barChart|lineChart|pieChart|doughnutChart|areaChart|scatterChart)>/) || [])[1]) || '', barDir: (cx.match(/<c:barDir val="(\w+)"/) || [])[1] || '',
        hole: +((cx.match(/<c:holeSize val="(\d+)"/) || [])[1] || 0), seri: sers.length, ad: unesc((sers[0] && (sers[0].match(/<c:tx>[\s\S]*?<c:v>([^<]*)<\/c:v>/) || [])[1]) || ''),
        kat: sers[0] ? ptler((sers[0].match(/<c:cat>[\s\S]*?<\/c:cat>/) || [''])[0]).map(unesc) : [], deger: sers[0] ? ptler((sers[0].match(/<c:val>[\s\S]*?<\/c:val>/) || [''])[0]).map(Number) : [],
        showVal: /<c:showVal val="1"\/>/.test(cx), etiket: unesc((sers[0] && (sers[0].match(/<c:dLbls>(?:\s*<c:dLbl>\s*<c:idx val="0"\/>)?\s*<c:numFmt formatCode="([^"]*)"/) || [])[1]) || ''), ext: (cx.match(/<c:externalData r:id="([^"]+)"/) || [])[1] || '', embTip: emb && emb.tip, gomu: ep, gomuVar: !!z[ep], gomuZip: z[ep] ? z[ep].readUInt32LE(0) === 0x04034b50 : false, kitap: z[ep] ? (() => { const w = unzip(z[ep]); return xs(w, "xl/sharedStrings.xml") + xs(w, "xl/worksheets/sheet1.xml"); })() : "", xf };
    });
  });
};

/* ---------- B–C: başsız Chrome, üretim exportPptx ---------- */
const BUNDLE = [process.env.PPTXGEN_BUNDLE, path.join(ROOT, 'node_modules/pptxgenjs/dist/pptxgen.bundle.js')].filter(Boolean).find((p) => fs.existsSync(p)) || null;
const CDN = (ink.match(/cdn\.jsdelivr\.net\/npm\/pptxgenjs@([\d.]+)\/dist\/pptxgen\.bundle\.js/) || [])[1];
const KANCA = `  window.__K = { hazirla: function () { plotHazir = true; paintStrips(); }, exp: exportPptx, teknikQA: teknikQA, chartSVG: chartSVG, renderAll: function () { renderAll(); } };\n`;

/* SENTETİK: etiketler ve sayılar test için uydurulmuştur */
const GRAFIK = [
  { k: 'chart', t: 'Sentetik çubuk grafik', b: ['Sentetik veri, yalnız test için'], data: { type: 'bar', labels: ['Alfa', 'Beta', 'Gama', 'Delta'], data: [12, 30, 18, 24.5] } },
  { k: 'chart', t: 'Sentetik çizgi grafik', b: ['Sentetik veri, yalnız test için'], data: { type: 'line', labels: ['Ç1', 'Ç2', 'Ç3', 'Ç4', 'Ç5'], data: [5, 8, 6, 11, 14] } },
  { k: 'chart', t: 'Sentetik pasta grafik', b: ['Sentetik veri, yalnız test için'], data: { type: 'pie', labels: ['Birinci', 'İkinci', 'Üçüncü'], data: [50, 30, 20] } },
  { k: 'chart', t: 'Sentetik halka grafik', b: ['Sentetik veri, yalnız test için'], data: { type: 'doughnut', labels: ['P', 'R', 'S', 'T'], data: [40, 25, 20, 15] } },
  { k: 'chart', t: 'Sentetik çıkarımlı grafik', b: ['Sentetik çıkarım bir: en yüksek değer Beta', 'Sentetik çıkarım iki: Gama ile Delta yakın'], data: { type: 'bar', labels: ['Alfa', 'Beta', 'Gama'], data: [7, 19, 11] } },
];

const sayfaGovde = () => `
  await sakin(); window.__pptx = []; R.S = [];
  var K = window.__K, P0 = window.PptxGenJS; if (P0) P0.prototype.writeFile = function (o) { var me = this; return me.write({ outputType: 'base64' }).then(function (b) { window.__pptx.push(b); return o && o.fileName; }); };
  d.querySelector('[data-newdeck]').click(); await bekle(50); S.temaSec(null);
  var G = ${JSON.stringify(GRAFIK)};
  var out = [{ k: 'cover', t: 'Sentetik grafik destesi', b: [] }].concat(G).concat([{ k: 'end', t: 'Teşekkürler', b: [] }]);
  S.set(out, { title: out[0].t, sub: 't', lang: 'tr', source: 'topic', sourceId: null }); K.hazirla();
  S.bas('new'); await sakin(); await bekle(1500); await dur(800);
  var D = S.deck();
  /* sayı kartındaki halka (ring): elle eklenen öğe, üretimdeki VARY.stat halkasıyla aynı biçim */
  var hs = D.slides[D.slides.length - 2]; hs.els.push({ id: 'halka1', type: 'chart', x: 600, y: 300, w: 150, h: 150, chart: { type: 'ring', labels: ['Sentetik oran'], data: [62] } }); K.renderAll(); await dur(300);
  D.slides.forEach(function (s, i) { R.S.push({ lay: s.lay + ':' + (s.v || 0), baslik: (s.els.filter(function (e) { return e.type === 'h' && e.text; })[0] || {}).text || '',
    g: s.els.filter(function (e) { return e.type === 'chart' && !e.muted; }).map(function (e) { var svg = K.chartSVG(e.chart || {}, e.w, e.h);
      return { id: e.id, tip: e.chart.type, labels: e.chart.labels, data: e.chart.data, kutu: [e.x, e.y, e.w, e.h], svgSekil: (svg.match(/<(rect|path|circle)\\b/g) || []).length, svgYazi: (svg.match(/<text\\b/g) || []).length, bos: /grafik verisi yok/.test(svg) }; }) }); });
  var n0 = window.__pptx.length; await K.exp(null); if (window.__pptx.length === n0) await K.exp(null);
  R.b64 = window.__pptx[window.__pptx.length - 1] || null;
  R.qa = K.teknikQA(D, 'deste').issues.map(function (z) { return z.code + '@' + z.slide; });
  R.ag = window.__ag;
`;

const kos = (W, dosya, icerik) => new Promise((res, rej) => {
  fs.writeFileSync(path.join(W, dosya), icerik);
  execFile(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + path.join(W, 'prof-grafik'), '--allow-file-access-from-files', '--virtual-time-budget=120000', '--dump-dom', pathToFileURL(path.join(W, dosya)).href],
    { maxBuffer: 128 * 1024 * 1024, timeout: 600000 }, (e, out) => {
      if (e) return rej(e); const m = String(out).match(/<pre id="diag">([\s\S]*?)<\/pre>/); if (!m) return rej(new Error('diag yok'));
      res(JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&')));
    });
});

const tarayici = async () => {
  if (!CHROME) { console.log('  ATLANDI  B–C (başsız Chrome): Chrome bulunamadı — CHROME_BIN ile yol verin. Bu testler GEÇTİ sayılmadı.'); return; }
  const { W, sayfa, temizle } = duzenek();
  const Hs = yeniSunucu({ senkron: true }); await new Promise((r) => Hs.srv.listen(0, '127.0.0.1', r));
  let R;
  try {
    let h = sayfa('ok', Hs.srv.address().port, 0, sayfaGovde());
    assert.equal(h.split('  window.__S = { set:').length, 2); h = h.replace('  window.__S = { set:', () => KANCA + '  window.__S = { set:');
    if (BUNDLE) h = h.replace('<pre id="diag"></pre>', '<script src="' + pathToFileURL(BUNDLE).href + '"></script>\n<pre id="diag"></pre>');
    R = await kos(W, 'grafik.html', h);
  } finally { Hs.srv.close(); temizle(); }
  if (R.hata) throw new Error('sayfa hatası: ' + R.hata);
  const ED = R.S.flatMap((s, i) => s.g.map((g) => Object.assign({ asetat: i }, g)));

  test('B1 editör: beş grafik şeridi yerli grafik öğesi olarak basılır (bar, line, pie, doughnut, bar+çıkarım), halka eklenir; SVG boş değil', () => {
    assert.deepEqual(ED.map((g) => g.tip), ['bar', 'line', 'pie', 'doughnut', 'bar', 'ring'], R.S.map((s) => s.lay).join(' '));
    GRAFIK.forEach((x, i) => { assert.deepEqual(ED[i].data, x.data.data, x.t); assert.deepEqual(ED[i].labels, x.data.labels, x.t); });
    ED.forEach((g) => { assert.ok(!g.bos && g.svgSekil >= (g.tip === 'ring' ? 2 : g.data.length), g.tip + ' SVG şekil ' + g.svgSekil); if (g.tip !== 'ring') assert.ok(g.svgYazi >= g.data.length, g.tip + ' SVG etiket'); });
    assert.ok(R.S.some((s) => s.lay === 'chart:1'), 'grafik + çıkarım çeşidi de denendi: ' + R.S.map((s) => s.lay).join(' '));
    assert.deepEqual(R.ag, []);
  });

  if (!BUNDLE) { console.log('  ATLANDI  C1–C3 (gerçek PPTX): pptxgenjs paketi yok — PPTXGEN_BUNDLE ile yol verin. Bu testler GEÇTİ sayılmadı.'); return; }
  const ver = (fs.readFileSync(BUNDLE, 'utf8').slice(0, 200).match(/PptxGenJS ([\d.]+)/) || [])[1];
  assert.ok(R.b64, 'PPTX üretilmedi');
  if (process.env.PPTX_DIR) { fs.mkdirSync(process.env.PPTX_DIR, { recursive: true }); fs.writeFileSync(path.join(process.env.PPTX_DIR, 'sentetik-grafik.pptx'), Buffer.from(R.b64, 'base64')); }
  const z = unzip(Buffer.from(R.b64, 'base64')), GX = grafikler(z), PX = GX.flatMap((g, i) => g.map((x) => Object.assign({ sira: i }, x)));

  test('C1 her grafik asetattan doğru bağlanır: graphicFrame r:id → chart ilişkisi → ppt/charts/chartN.xml (Content_Types) → gömülü .xlsx', () => {
    assert.equal(ver, CDN, 'test paketi üretimin CDN sürümü olmalı (' + ver + ' / ' + CDN + ')');
    assert.equal(GX.length, R.S.length, 'asetat sayısı');
    assert.deepEqual(GX.map((g) => g.length), R.S.map((s) => s.g.length), 'asetat başına grafik sayısı editörle aynı');
    const parcalar = Object.keys(z).filter((k) => /^ppt\/charts\/chart\d+\.xml$/.test(k));
    assert.equal(parcalar.length, ED.length, 'ZIP\'teki grafik parçası = editördeki grafik öğesi');
    assert.equal(new Set(PX.map((p) => p.parca)).size, PX.length, 'her çerçeve ayrı parçaya bağlı');
    PX.forEach((p, i) => { const at = ED[i].tip + ' (asetat ' + (p.sira + 1) + ')';
      assert.equal(p.relTip, 'chart', at + ' ilişki türü'); assert.ok(p.var && p.ct, at + ' parça/Content_Types ' + p.parca);
      assert.ok(p.ext && p.gomuVar && p.gomuZip && /\.xlsx$/.test(p.gomu), at + ' gömülü çalışma kitabı ' + p.gomu); });
    assert.ok(!R.qa.some((c) => /^EXPORT_/.test(c)), R.qa.join(' '));
  });

  test('C2 grafik içeriği editörle aynı: tür, tek seri, kategoriler, değerler; ring → doughnut [v, 100−v]; değer etiketi açık, ondalık yuvarlanmaz; gömülü çalışma kitabı aynı veriyi taşır', () => {
    const TUR = { bar: 'barChart', line: 'lineChart', pie: 'pieChart', doughnut: 'doughnutChart', ring: 'doughnutChart' };
    PX.forEach((p, i) => { const e = ED[i], at = e.tip + ' (asetat ' + (p.sira + 1) + ')';
      assert.equal(p.tur, TUR[e.tip], at + ' tür'); assert.equal(p.seri, 1, at + ' seri sayısı');
      if (e.tip === 'bar') assert.equal(p.barDir, 'col', at + ' sütun');
      if (e.tip === 'ring') { assert.deepEqual(p.deger, [e.data[0], 100 - e.data[0]], at); assert.equal(p.hole, 78, at + ' delik'); return; }
      assert.deepEqual(p.kat, e.labels, at + ' kategoriler'); assert.deepEqual(p.deger, e.data, at + ' değerler');
      assert.equal(p.ad, R.S[p.sira].baslik, at + ' seri adı = asetat başlığı'); assert.ok(p.showVal, at + ' değer etiketi');
      /* #47: çubuk/çizgi etiketi ondalığı yuvarlamaz (24,5 → "25" değil); tam sayılı seri "#,##0", pasta/halka General kalır */
      assert.equal(p.etiket, /pie|doughnut/.test(e.tip) ? 'General' : e.data.some((v) => !Number.isInteger(v)) ? '#,##0.0' : '#,##0', at + ' etiket biçimi');
      e.labels.forEach((l) => assert.ok(p.kitap.includes('>' + l + '<'), at + ' çalışma kitabında etiket ' + l)); e.data.forEach((v) => assert.ok(p.kitap.includes('<v>' + v + '</v>'), at + ' çalışma kitabında değer ' + v)); });
  });

  test('C3 geometri: grafik çerçevesi editördeki kutuyla aynı (EMU, ±1 px) ve asetat sınırları içinde', () => {
    PX.forEach((p, i) => { const k = ED[i].kutu, at = ED[i].tip + ' (asetat ' + (p.sira + 1) + ') ' + p.xf;
      assert.equal(p.xf.length, 4, at); k.forEach((v, j) => assert.ok(Math.abs(p.xf[j] - v * EMU) <= EMU, at + ' kutu ' + k));
      assert.ok(p.xf[0] >= 0 && p.xf[1] >= 0 && p.xf[0] + p.xf[2] <= SW && p.xf[1] + p.xf[3] <= SH, at + ' asetat dışı'); });
  });
};

tarayici().catch((e) => { test('B–C başsız Chrome koşusu', () => { throw e; }); }).then(() => summary());
