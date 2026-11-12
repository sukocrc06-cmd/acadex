/* ACADEX KIDS · tek dosya üretici (kids/assets/birlestir.js), 10.11.2026
   assets/sayfa.html şablonuna stilleri, betikleri ve yazı tiplerini gömer → kids/index.html
   Çalıştırma: node assets/birlestir.js   (kids klasöründe) */
const fs = require('fs'), path = require('path'), A = __dirname;
const oku = (f) => fs.readFileSync(path.join(A, f), 'utf8');
const CSS = ['kids.css', 'kids-tema.css', 'kids-landing.css', 'kids-gun.css', 'kids-ogretmen.css', 'kids-tahta.css'], JS = ['kids-ciz.js', 'kids-resim.js', 'kids-resim2.js', 'kids-veri.js', 'kids-konu.js', 'kids-temalar.js', 'kids-temalar2.js', 'kids-ses.js', 'kids-odul.js', 'kids-bulut.js', 'kids-pwa.js', 'kids-oyun.js', 'kids-oyun2.js', 'kids-kitap.js', 'kids-yazdir.js', 'kids-app.js', 'kids-tahta.js', 'kids-ogretmen.js', 'kids-landing.js', 'kids-gun.js', 'kids-yon.js'];
let css = CSS.map(oku).join('\n').replace(/url\(fonts\/([\w.-]+\.woff2)\)/g, (_, f) => 'url(data:font/woff2;base64,' + fs.readFileSync(path.join(A, 'fonts', f)).toString('base64') + ')');
let js = JS.map((f) => '/* ---- ' + f + ' ---- */\n' + oku(f)).join('\n');
if (/<\/script/i.test(js)) throw new Error('betik içinde </script> var');
let html = oku('sayfa.html').replace('<!--CSS-->', () => '<style>\n' + css + '\n</style>').replace('<!--JS-->', () => '<script>\n' + js + '\n</script>');
if (/<!--(CSS|JS)-->/.test(html)) throw new Error('şablon işareti kaldı');
fs.writeFileSync(path.join(A, '..', 'index.html'), html);
console.log('index.html', Math.round(html.length / 1024) + ' KB');
