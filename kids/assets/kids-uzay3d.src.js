/* ==========================================================================
   ACADEX KIDS · 3B GALAKSİ HARİTASI (kids/assets/kids-uzay3d.src.js), 19.11.2026
   Kaynak dosya. Tarayıcıya giden: kids/assets/kids-uzay3d.mjs (three.js'in yalnız kullanılan
   parçalarıyla tek dosya, dış bağlantı yok). Üretmek için (repo kökünde):
     npx esbuild kids/assets/kids-uzay3d.src.js --bundle --format=esm --minify --target=es2019 \
       --outfile=kids/assets/kids-uzay3d.mjs        (three@0.160.0, MedLab kampüsüyle aynı sürüm)

   Sahne: ortada parlayan güneş, çevresinde sarmal yıldız tozundan galaksi diski. Konular disk
   üstünde sarmal bir yol boyunca gezegen: konunun renginde, desenli, bazısı halkalı; çocuk
   ilerledikçe bayrak (1), dönen ay (2), altın halka (3). Kilitli gezegen gri ve sisli.
   Gezegenleri ışıklı bir yol birbirine bağlar (sıra belli olsun). Kamera kampüsteki gibi
   yukarıdan eğik bakar; sürükleyince kayar, tekerlek/iki parmakla yaklaşır.
   Çocuk 3B astronot: kaskın camında kendi hayvanının yüzü, sırtında jetpack. Gezegene
   dokununca alevli jetpack'le kavis çizerek uçar, kamera peşinden gelir, sonra konu açılır.
   Adlar ve yıldız halkaları gerçek düğmeler (kids-app.js'in düğmeleri) olarak gezegenlerin
   üstünde durur: ekran okuyucu ve klavye aynen çalışır.
   Hareketi azalt: disk dönmez, astronot süzülmez, uçuş ve kamera geçişi anında.
   ========================================================================== */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, Points, Sprite, Vector3, Color,
  SphereGeometry, RingGeometry, TorusGeometry, CylinderGeometry, CapsuleGeometry, BoxGeometry, ConeGeometry,
  PlaneGeometry, BufferGeometry, Float32BufferAttribute, TubeGeometry, CatmullRomCurve3, QuadraticBezierCurve3,
  MeshStandardMaterial, MeshBasicMaterial, PointsMaterial, SpriteMaterial, CanvasTexture,
  AmbientLight, HemisphereLight, PointLight, DirectionalLight, AdditiveBlending, DoubleSide, SRGBColorSpace, MathUtils
} from 'three';

const TAU = Math.PI * 2;
const PR = 1.65;   /* gezegen yarıçapı */

function kanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function dokuDan(c) { const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4; return t; }
function karis(a, b, o) { return new Color(a).lerp(new Color(b), o).getStyle(); }
/* basit tekrarlanabilir rastgele */
function rng(t) { let s = t * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }

/* yumuşak ışık lekesi (güneş parıltısı, yol ışıkları) */
function parilti(renk) {
  const c = kanvas(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, renk); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return dokuDan(c);
}
/* gezegen yüzeyi: bantlar + kraterler (equirect) */
function gezegenDoku(renk, i, kilit) {
  const c = kanvas(512, 256), x = c.getContext('2d'), r = rng(i + 3), taban = kilit ? '#6B7699' : renk;
  x.fillStyle = taban; x.fillRect(0, 0, 512, 256);
  for (let b = 0; b < 9; b++) {
    const y = r() * 256, h = 8 + r() * 30;
    x.fillStyle = r() < 0.5 ? karis(taban, '#ffffff', 0.18 + r() * 0.14) : karis(taban, '#0B1033', 0.12 + r() * 0.14);
    x.globalAlpha = 0.55; x.beginPath();
    x.moveTo(0, y);
    for (let k = 0; k <= 512; k += 32) x.lineTo(k, y + Math.sin(k / 60 + b) * 6);
    x.lineTo(512, y + h); for (let k = 512; k >= 0; k -= 32) x.lineTo(k, y + h + Math.sin(k / 50 + b) * 6);
    x.closePath(); x.fill();
  }
  x.globalAlpha = 1;
  for (let k = 0; k < 14; k++) {
    const cx = r() * 512, cy = 40 + r() * 176, rr = 5 + r() * 16;
    x.fillStyle = karis(taban, '#0B1033', 0.3); x.beginPath(); x.ellipse(cx, cy, rr, rr * 0.8, 0, 0, TAU); x.fill();
    x.strokeStyle = karis(taban, '#ffffff', 0.35); x.lineWidth = 2; x.beginPath(); x.ellipse(cx - 1, cy - 1, rr, rr * 0.8, 0, Math.PI * 1.05, Math.PI * 1.85); x.stroke();
  }
  return dokuDan(c);
}
/* SVG (konunun resmi, çocuğun yüzü) → doku */
function svgDoku(svg, boy, daire) {
  const c = kanvas(boy, boy), x = c.getContext('2d'), t = dokuDan(c), im = new Image();
  im.onload = () => {
    x.clearRect(0, 0, boy, boy);
    if (daire) { x.save(); x.beginPath(); x.arc(boy / 2, boy / 2, boy / 2, 0, TAU); x.clip(); x.fillStyle = '#BFE3FF'; x.fillRect(0, 0, boy, boy); x.drawImage(im, -boy * 0.06, -boy * 0.06, boy * 1.12, boy * 1.12); x.restore(); }
    else x.drawImage(im, 0, 0, boy, boy);
    t.needsUpdate = true;
  };
  let s = String(svg || '');
  if (!/xmlns=/.test(s)) s = s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  s = s.replace(/<svg([^>]*?)>/, (m, a) => /width=/.test(a) ? m : '<svg' + a + ' width="' + boy + '" height="' + boy + '">');
  im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  return t;
}

/* ---------------- galaksi ---------------- */
function galaksi(R) {
  const g = new Group();
  /* sarmal yıldız tozu: 3 kol */
  const n = 5200, poz = [], renk = [], r = rng(7), pal = ['#8E7CF0', '#FF7AA8', '#4AA8FF', '#FFD9F0', '#B8A8FF'].map((c) => new Color(c));
  for (let i = 0; i < n; i++) {
    const kol = i % 3, t = Math.pow(r(), 0.75), rad = 2.5 + t * R * 1.15, a = kol * TAU / 3 + rad * 0.32 + (r() - 0.5) * (0.9 - t * 0.5);
    const yay = (r() - 0.5) * (1.4 - t);
    poz.push(Math.cos(a) * rad + (r() - 0.5) * 1.6, yay * 0.6 - 0.35, Math.sin(a) * rad + (r() - 0.5) * 1.6);
    const c = pal[(i * 7) % pal.length].clone().lerp(new Color('#ffffff'), r() * 0.35); renk.push(c.r, c.g, c.b);
  }
  const geo = new BufferGeometry(); geo.setAttribute('position', new Float32BufferAttribute(poz, 3)); geo.setAttribute('color', new Float32BufferAttribute(renk, 3));
  const toz = new Points(geo, new PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, blending: AdditiveBlending, map: parilti('rgba(255,255,255,.6)'), sizeAttenuation: true }));
  g.add(toz);
  /* diskin sisli zemini */
  const disk = new Mesh(new RingGeometry(1.5, R * 1.25, 96, 1), new MeshBasicMaterial({ map: (() => {
    const c = kanvas(512, 512), x = c.getContext('2d'), gr = x.createRadialGradient(256, 256, 20, 256, 256, 256);
    gr.addColorStop(0, 'rgba(255,214,120,.35)'); gr.addColorStop(0.3, 'rgba(142,124,240,.22)'); gr.addColorStop(0.7, 'rgba(74,168,255,.10)'); gr.addColorStop(1, 'rgba(11,16,51,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 512, 512); return dokuDan(c);
  })(), transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide }));
  disk.rotation.x = -Math.PI / 2; disk.position.y = -0.5;
  /* RingGeometry UV'si kare dokuyu doğru oturtur (merkezli) */
  g.add(disk);
  /* güneş */
  /* güneş: kaynayan yüzey dokusu + iki kat taç + yavaş dönen ışınlar */
  const gd = kanvas(256, 128), gx = gd.getContext('2d'), gr2 = rng(11);
  gx.fillStyle = '#FFC93C'; gx.fillRect(0, 0, 256, 128);
  for (let k = 0; k < 420; k++) { gx.fillStyle = gr2() < 0.5 ? 'rgba(255,240,170,.55)' : 'rgba(255,140,40,.35)'; gx.beginPath(); gx.arc(gr2() * 256, gr2() * 128, 1 + gr2() * 5, 0, TAU); gx.fill(); }
  const gunes = new Mesh(new SphereGeometry(1.7, 48, 32), new MeshBasicMaterial({ map: dokuDan(gd) }));
  gunes.position.y = 0.6; g.add(gunes);
  const isinC = kanvas(256, 256), ix = isinC.getContext('2d');
  ix.translate(128, 128);
  for (let k = 0; k < 16; k++) { ix.rotate(TAU / 16); const lg = ix.createLinearGradient(0, 0, 0, 128); lg.addColorStop(0, 'rgba(255,220,120,.55)'); lg.addColorStop(1, 'rgba(255,220,120,0)'); ix.fillStyle = lg; ix.beginPath(); ix.moveTo(-6, 0); ix.lineTo(0, k % 2 ? 90 : 124); ix.lineTo(6, 0); ix.fill(); }
  const isin = new Sprite(new SpriteMaterial({ map: dokuDan(isinC), transparent: true, depthWrite: false, blending: AdditiveBlending }));
  isin.scale.set(9, 9, 1); isin.position.copy(gunes.position); g.add(isin);
  const hale = new Sprite(new SpriteMaterial({ map: parilti('rgba(255,200,90,.85)'), transparent: true, depthWrite: false, blending: AdditiveBlending }));
  hale.scale.set(10, 10, 1); hale.position.copy(gunes.position); g.add(hale);
  return { g, toz, gunes, hale, isin };
}

/* ---------------- gezegen ---------------- */
function gezegenKur(k, i, simgeSvg) {
  const g = new Group(), kilit = !!k.kilit, renk = kilit ? '#6B7699' : k.renk;
  const govde = new Mesh(new SphereGeometry(PR, 48, 32), new MeshStandardMaterial({ map: gezegenDoku(k.renk, i, kilit), roughness: 0.82, metalness: 0.02, emissive: new Color(renk).multiplyScalar(0.12) }));
  govde.castShadow = false; g.add(govde);
  /* atmosfer parıltısı */
  const atm = new Sprite(new SpriteMaterial({ map: parilti(new Color(renk).getStyle().replace('rgb', 'rgba').replace(')', ',.55)')), transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: kilit ? 0.35 : 0.9 }));
  atm.scale.set(PR * 4.2, PR * 4.2, 1); g.add(atm);
  if (i % 3 === 1) {
    const h = new Mesh(new RingGeometry(PR * 1.35, PR * 1.95, 72), new MeshBasicMaterial({ color: kilit ? '#8A94B8' : '#FFE7A3', side: DoubleSide, transparent: true, opacity: 0.8 }));
    h.rotation.x = -Math.PI / 2 + 0.42; h.rotation.y = 0.25; g.add(h);
  }
  if (kilit) {
    const sis = new Mesh(new SphereGeometry(PR * 1.12, 32, 20), new MeshBasicMaterial({ color: '#D5DDF5', transparent: true, opacity: 0.22, depthWrite: false }));
    g.add(sis);
  }
  const ek = { ay: null, altin: null };
  if (!kilit && k.asama >= 1) {
    const b = new Group(), dir = new Mesh(new CylinderGeometry(0.035, 0.035, 0.9, 8), new MeshStandardMaterial({ color: '#23304D' }));
    dir.position.y = 0.45; b.add(dir);
    const bez = new Mesh(new PlaneGeometry(0.5, 0.3), new MeshStandardMaterial({ color: '#FF6B5B', side: DoubleSide }));
    bez.position.set(0.25, 0.75, 0); b.add(bez);
    b.position.set(PR * 0.55, PR * 0.78, PR * 0.2); b.rotation.z = -0.5; g.add(b); ek.bayrak = bez;
  }
  if (!kilit && k.asama >= 2) {
    const p = new Group(), ay = new Mesh(new SphereGeometry(0.28, 24, 16), new MeshStandardMaterial({ color: '#E9ECF6', roughness: 0.9 }));
    ay.position.set(PR * 2.0, 0.35, 0); p.add(ay); g.add(p); ek.ay = p;
  }
  if (!kilit && k.asama >= 3) {
    const t = new Mesh(new TorusGeometry(PR * 1.6, 0.05, 8, 96), new MeshStandardMaterial({ color: '#FFD23F', emissive: '#FFB020', emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.4 }));
    t.rotation.x = Math.PI / 2 - 0.25; g.add(t); ek.altin = t;
  }
  /* konunun resmi gezegenin üstünde, hep kameraya dönük */
  const s = new Sprite(new SpriteMaterial({ map: svgDoku(simgeSvg, 256, false), transparent: true, opacity: kilit ? 0.5 : 1, depthWrite: false }));
  s.scale.set(1.9, 1.9, 1); s.position.y = PR + 0.75; g.add(s);
  if (k.bugun) {
    const halo = new Mesh(new RingGeometry(PR * 1.5, PR * 1.62, 64), new MeshBasicMaterial({ color: '#FFD23F', transparent: true, opacity: 0.9, side: DoubleSide }));
    halo.rotation.x = -Math.PI / 2; halo.position.y = -PR * 0.9; g.add(halo); ek.halo = halo;
  }
  return { g, govde, ek };
}

/* ---------------- astronot ---------------- */
function astronotKur(yuzSvg) {
  const a = new Group(), beyaz = new MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.55 }), gri = new MeshStandardMaterial({ color: '#8E9BBF', roughness: 0.6 }), lac = new MeshStandardMaterial({ color: '#23304D', roughness: 0.7 });
  const govde = new Mesh(new CapsuleGeometry(0.42, 0.55, 8, 16), beyaz); govde.position.y = 0.75; a.add(govde);
  const panel = new Mesh(new BoxGeometry(0.42, 0.24, 0.08), new MeshStandardMaterial({ color: '#E9ECF6' })); panel.position.set(0, 0.85, 0.4); a.add(panel);
  ['#FF6B5B', '#FFD23F', '#4CC38A'].forEach((c, i) => { const d = new Mesh(new SphereGeometry(0.035, 10, 8), new MeshBasicMaterial({ color: c })); d.position.set(-0.11 + i * 0.11, 0.85, 0.45); a.add(d); });
  const kol = (x, rz) => { const k = new Mesh(new CapsuleGeometry(0.13, 0.42, 6, 10), beyaz); k.position.set(x, 0.8, 0); k.rotation.z = rz; a.add(k); return k; };
  const kL = kol(-0.52, 0.5), kR = kol(0.52, -0.5);
  [-0.18, 0.18].forEach((x) => { const b = new Mesh(new CapsuleGeometry(0.15, 0.32, 6, 10), beyaz); b.position.set(x, 0.12, 0); a.add(b); const ay = new Mesh(new BoxGeometry(0.3, 0.12, 0.36), new MeshStandardMaterial({ color: '#FF6B5B' })); ay.position.set(x, -0.12, 0.04); a.add(ay); });
  /* jetpack */
  const jet = new Mesh(new BoxGeometry(0.62, 0.7, 0.3), gri); jet.position.set(0, 0.85, -0.45); a.add(jet);
  const alevler = [];
  [-0.17, 0.17].forEach((x) => {
    const t = new Mesh(new CylinderGeometry(0.1, 0.12, 0.22, 12), lac); t.position.set(x, 0.42, -0.45); a.add(t);
    const al = new Mesh(new ConeGeometry(0.12, 0.6, 12), new MeshBasicMaterial({ color: '#FFB020', transparent: true, opacity: 0.95 }));
    al.rotation.x = Math.PI; al.position.set(x, 0.0, -0.45); al.visible = false; a.add(al); alevler.push(al);
    const ic = new Mesh(new ConeGeometry(0.06, 0.34, 10), new MeshBasicMaterial({ color: '#FFF3B0' })); ic.rotation.x = Math.PI; ic.position.set(x, 0.12, -0.45); ic.visible = false; a.add(ic); alevler.push(ic);
  });
  /* kask: yüz camın içinde, cam şeffaf */
  const yaka = new Mesh(new TorusGeometry(0.36, 0.09, 10, 28), beyaz); yaka.rotation.x = Math.PI / 2; yaka.position.y = 1.32; a.add(yaka);
  const yuz = new Sprite(new SpriteMaterial({ map: svgDoku(yuzSvg, 256, true), transparent: true }));
  yuz.scale.set(0.74, 0.74, 1); yuz.position.y = 1.72; yuz.renderOrder = 1; a.add(yuz);
  const cam = new Mesh(new SphereGeometry(0.5, 32, 24), new MeshStandardMaterial({ color: '#BFE3FF', transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1, depthWrite: false }));
  cam.position.y = 1.72; cam.renderOrder = 2; a.add(cam);
  const parla = new Mesh(new SphereGeometry(0.09, 10, 8), new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 }));
  parla.position.set(-0.2, 1.92, 0.36); a.add(parla);
  const anten = new Mesh(new CylinderGeometry(0.02, 0.02, 0.3, 6), lac); anten.position.set(0, 2.32, 0); a.add(anten);
  const top = new Mesh(new SphereGeometry(0.07, 10, 8), new MeshBasicMaterial({ color: '#FF6B5B' })); top.position.set(0, 2.5, 0); a.add(top);
  a.scale.setScalar(0.95);
  return { a, alevler, kL, kR };
}

/* ======================================================================
   kur({ kap, katman, konular:[{id, renk, simge(svg), kilit, asama, bugun, el}], yuz(svg), baslangic, sakin })
   ====================================================================== */
export function kur(o) {
  const kap = o.kap, sakin = !!o.sakin;
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.6 : 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const cv = renderer.domElement; cv.className = 'kz3-tuval'; cv.setAttribute('aria-hidden', 'true');
  kap.insertBefore(cv, kap.firstChild);
  const sahne = new Scene(), kam = new PerspectiveCamera(40, 1, 0.1, 400);

  /* yerleşim: Arşimet sarmalı, yol boyunca EŞİT aralık (ADIM). Kollar arası 2π·B ≈ 9.4 birim,
     ardışık gezegenler arası ADIM: hiçbir gezegen (halkası ve adı dahil) ötekinin üstüne binmez. */
  const N = o.konular.length, R0 = 9.5, B = 1.55, ADIM = 8;
  let th = 0;
  const yerler = o.konular.map((k, i) => {
    const r = R0 + B * th, a = th - 0.5, v = new Vector3(Math.cos(a) * r, Math.sin(i * 1.7) * 0.3, Math.sin(a) * r);
    th += ADIM / Math.hypot(r, B);
    return v;
  });
  const R = yerler.reduce((m, v) => Math.max(m, Math.hypot(v.x, v.z)), R0) + 2;
  const G = galaksi(R); sahne.add(G.g);
  sahne.add(new AmbientLight('#B8C4FF', 0.55));
  sahne.add(new HemisphereLight('#E8ECFF', '#3A2A7A', 0.65));
  const isik = new PointLight('#FFF1D0', 2.6, 0, 0); isik.position.set(0, 1.5, 0); sahne.add(isik);
  const yan = new DirectionalLight('#ffffff', 0.55); yan.position.set(-10, 18, 14); sahne.add(yan);

  /* ışıklı yol: gezegenleri sırayla bağlar */
  if (N > 1) {
    const egri = new CatmullRomCurve3(yerler.map((v) => v.clone().setY(v.y - 0.9)));
    const yol = new Mesh(new TubeGeometry(egri, N * 24, 0.05, 6, false), new MeshBasicMaterial({ color: '#BFE3FF', transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false }));
    sahne.add(yol);
    const noktalar = [], adim = 1 / (N * 6);
    for (let t = 0; t <= 1; t += adim) { const p = egri.getPointAt(t); noktalar.push(p.x, p.y + 0.02, p.z); }
    const ng = new BufferGeometry(); ng.setAttribute('position', new Float32BufferAttribute(noktalar, 3));
    sahne.add(new Points(ng, new PointsMaterial({ size: 0.42, color: '#FFFFFF', map: parilti('rgba(191,227,255,.9)'), transparent: true, depthWrite: false, blending: AdditiveBlending })));
  }

  const G2 = o.konular.map((k, i) => { const p = gezegenKur(k, i, k.simge); p.g.position.copy(yerler[i]); sahne.add(p.g); return p; });
  const A = astronotKur(o.yuz); sahne.add(A.a);
  const idx = (kid) => o.konular.findIndex((k) => k.id === kid);
  let suan = Math.max(0, idx(o.baslangic));
  const astYeri = (i) => yerler[i].clone().add(new Vector3(-PR * 1.35, PR * 0.35, PR * 0.95));
  A.a.position.copy(astYeri(suan)); A.a.rotation.y = 0.5;

  /* kamera: eğik bakış, hedef kaydırılabilir */
  const hedef = yerler[suan].clone().setY(0), hedefSon = hedef.clone();
  let uzak = 46, uzakSon = 46;
  /* ~38° eğik bakış: disk elips görünür, kampüsteki gibi derinlik */
  /* ~48° eğik bakış: derinlik kalır, yakın kollar ekranda birbirine girmez */
  const ofs = new Vector3(0, 0.74, 0.67).normalize();
  const sinir = R + 2;
  function kamYerlestir() { kam.position.copy(hedef).addScaledVector(ofs, uzak); kam.lookAt(hedef); }

  /* boyut */
  let gw = 1, gh = 1;
  function boyut() {
    gw = Math.max(1, kap.clientWidth); gh = Math.max(1, kap.clientHeight);
    renderer.setSize(gw, gh, false); kam.aspect = gw / gh;
    uzakSon = MathUtils.clamp(uzakSon, 12, 80); kam.updateProjectionMatrix();
  }
  boyut();
  if (gw < 600) { uzak = uzakSon = 34; }
  const ro = window.ResizeObserver ? new ResizeObserver(boyut) : null; if (ro) ro.observe(kap);

  /* sürükle: kaydır; tekerlek / iki parmak: yaklaş */
  const isaret = new Map(); let ilkMesafe = 0, ilkUzak = 0;
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); isaret.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (isaret.size === 2) { const [p, q] = [...isaret.values()]; ilkMesafe = Math.hypot(p.x - q.x, p.y - q.y); ilkUzak = uzakSon; } });
  cv.addEventListener('pointermove', (e) => {
    const p = isaret.get(e.pointerId); if (!p) return;
    if (isaret.size === 1) {
      const k = uzak / gh * 1.15;
      hedefSon.x -= (e.clientX - p.x) * k; hedefSon.z -= (e.clientY - p.y) * k * 1.25;
      const l = Math.hypot(hedefSon.x, hedefSon.z); if (l > sinir) hedefSon.multiplyScalar(sinir / l);
    } else if (isaret.size === 2) {
      p.x = e.clientX; p.y = e.clientY; const [a, b] = [...isaret.values()], m = Math.hypot(a.x - b.x, a.y - b.y);
      if (ilkMesafe > 0) uzakSon = MathUtils.clamp(ilkUzak * ilkMesafe / m, 12, 80); return;
    }
    p.x = e.clientX; p.y = e.clientY;
  });
  const birak = (e) => { isaret.delete(e.pointerId); ilkMesafe = 0; };
  cv.addEventListener('pointerup', birak); cv.addEventListener('pointercancel', birak);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); uzakSon = MathUtils.clamp(uzakSon * (e.deltaY > 0 ? 1.1 : 0.9), 12, 80); }, { passive: false });

  /* etiket katmanı: kids-app'in düğmeleri gezegenlerin üstünde */
  const v = new Vector3();
  function etiketler() {
    for (let i = 0; i < N; i++) {
      const el = o.konular[i].el; if (!el) continue;
      v.copy(yerler[i]).project(kam);
      const x = (v.x * 0.5 + 0.5) * gw, y = (-v.y * 0.5 + 0.5) * gh;
      /* gezegenin ekrandaki çapı */
      const d = yerler[i].distanceTo(kam.position), cap = Math.max(44, Math.min(190, (PR * 2.5) / (2 * d * Math.tan(MathUtils.degToRad(kam.fov / 2))) * gh));
      const gor = v.z < 1 && x > -cap && x < gw + cap && y > -cap && y < gh + cap;
      el.style.visibility = gor ? '' : 'hidden';
      if (gor) { el.style.setProperty('--w', cap.toFixed(0) + 'px'); el.style.transform = 'translate(' + (x - cap / 2).toFixed(1) + 'px,' + (y - cap / 2).toFixed(1) + 'px)'; el.style.zIndex = String(1000 - Math.round(d * 10)); }
    }
  }

  /* dalış: kamera gezegene doğru iner, atmosfer parlar, gezegen ekranı kaplar; sonra konu açılır
     (kids-app'in renk perdesi gezegenin ortasından, gezegenin renginde açılır: geçiş kesintisiz) */
  let dalis = null;
  const harita = kap.parentNode;
  function dal(i, sonra) {
    if (sakin) return sonra();
    if (harita) harita.classList.add('kz3-dal');
    dalis = { i, t0: performance.now(), sure: 950, h0: hedef.clone(), u0: uzak, sonra };
  }

  /* uçuş */
  let ucus = null;
  function uc(kid, sonra) {
    const i = idx(kid); if (i < 0) return sonra();
    if (ucus || dalis) return;
    hedefSon.copy(yerler[i]).setY(0);
    if (sakin) { suan = i; A.a.position.copy(astYeri(i)); hedef.copy(hedefSon); return setTimeout(sonra, 0); }
    if (i === suan) { A.a.position.copy(astYeri(i)); return dal(i, sonra); }
    const a = A.a.position.clone(), b = astYeri(i), m = a.clone().lerp(b, 0.5); m.y += 4 + a.distanceTo(b) * 0.18;
    ucus = { egri: new QuadraticBezierCurve3(a, m, b), t0: performance.now(), sure: 950 + Math.min(700, a.distanceTo(b) * 35), sonra, i };
    A.alevler.forEach((x) => { x.visible = true; });
    const yon = b.clone().sub(a); A.a.rotation.y = Math.atan2(yon.x, yon.z);
  }

  /* döngü */
  let raf = 0, gorunur = true, son = performance.now(), yok = false;
  const io = window.IntersectionObserver ? new IntersectionObserver((g) => { gorunur = g[0].isIntersecting; if (gorunur) basla(); }) : null; if (io) io.observe(kap);
  function kare(now) {
    raf = 0;
    if (yok) return;
    if (!kap.isConnected) { temizle(); return; }
    const dt = Math.min(0.05, (now - son) / 1000); son = now; const t = now / 1000;
    if (!sakin) {
      G.toz.rotation.y += dt * 0.025; G.hale.material.opacity = 0.85 + Math.sin(t * 1.6) * 0.12; G.isin.material.rotation += dt * 0.12; G.gunes.rotation.y += dt * 0.1;
      G2.forEach((p, i) => { p.govde.rotation.y += dt * (0.18 + (i % 4) * 0.04); if (p.ek.ay) p.ek.ay.rotation.y += dt * 0.9; if (p.ek.altin) p.ek.altin.rotation.z += dt * 0.4; if (p.ek.bayrak) p.ek.bayrak.rotation.y = Math.sin(t * 4 + i) * 0.35; if (p.ek.halo) p.ek.halo.scale.setScalar(1 + Math.sin(t * 3) * 0.06); });
    }
    if (ucus) {
      const u = Math.min(1, (now - ucus.t0) / ucus.sure), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      A.a.position.copy(ucus.egri.getPoint(e));
      A.alevler.forEach((x, j) => { x.scale.y = 0.8 + Math.random() * 0.5; });
      A.kL.rotation.z = 1.2; A.kR.rotation.z = -1.2;
      if (u >= 1) { const s = ucus.sonra; suan = ucus.i; ucus = null; A.alevler.forEach((x) => { x.visible = false; }); A.kL.rotation.z = 0.5; A.kR.rotation.z = -0.5; A.a.rotation.y = 0.5; dal(suan, s); }
    } else if (!sakin) {
      A.a.position.y = astYeri(suan).y + Math.sin(t * 1.8) * 0.12; A.a.rotation.z = Math.sin(t * 1.2) * 0.08;
    }
    const k = sakin ? 1 : 1 - Math.pow(0.002, dt);
    if (dalis) {
      const u = Math.min(1, (now - dalis.t0) / dalis.sure), e = u * u * u * (u * (u * 6 - 15) + 10), p = G2[dalis.i];
      hedef.copy(dalis.h0).lerp(yerler[dalis.i], e); uzak = dalis.u0 + (PR * 1.25 - dalis.u0) * e;
      const atm = p.g.children[1]; if (atm && atm.material) { atm.material.opacity = 0.9 + e * 0.1; atm.scale.setScalar(PR * (4.2 + e * 3)); }
      p.govde.rotation.y += dt * (0.4 + e * 2);
      A.a.visible = u < 0.45;
      if (u >= 1) {
        const s = dalis.sonra, d = dalis; dalis = null; s();
        /* konu kids-app'te harita üstünde açılır: perde kapattıktan sonra sahneyi eski haline getir,
           konu kapanınca harita gezegenin başında, adlar yerinde bekler */
        setTimeout(() => {
          if (yok) return;
          const atm = p.g.children[1]; if (atm && atm.material) { atm.material.opacity = 0.9; atm.scale.setScalar(PR * 4.2); }
          hedef.copy(yerler[d.i]).setY(0); hedefSon.copy(hedef); uzak = uzakSon = d.u0; A.a.visible = true;
          if (harita) harita.classList.remove('kz3-dal');
          basla();
        }, 700);
      }
    } else { hedef.lerp(hedefSon, k); uzak += (uzakSon - uzak) * k; }
    kamYerlestir();
    renderer.render(sahne, kam);
    etiketler();
    if (gorunur && !document.hidden) raf = requestAnimationFrame(kare);
  }
  function basla() { if (!raf && !yok) { son = performance.now(); raf = requestAnimationFrame(kare); } }
  const gor = () => { if (!document.hidden) basla(); };
  document.addEventListener('visibilitychange', gor);
  function temizle() {
    if (yok) return; yok = true; if (raf) cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange', gor); if (ro) ro.disconnect(); if (io) io.disconnect();
    sahne.traverse((n) => { if (n.geometry) n.geometry.dispose(); if (n.material) { if (n.material.map) n.material.map.dispose(); n.material.dispose(); } });
    renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss();
  }
  kamYerlestir(); basla();
  return { uc, temizle, odak: (kid) => { const i = idx(kid); if (i >= 0) hedefSon.copy(yerler[i]).setY(0); } };
}
