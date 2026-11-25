/* ==========================================================================
   ACADEX KIDS · 3B GALAKSİ HARİTASI (kids/assets/kids-uzay3d.src.js), 19.11.2026
   Kaynak dosya. Tarayıcıya giden: kids/assets/kids-uzay3d.mjs (three.js'in yalnız kullanılan
   parçalarıyla tek dosya, dış bağlantı yok). Üretmek için (repo kökünde):
     npx esbuild kids/assets/kids-uzay3d.src.js --bundle --format=esm --minify --target=es2019 \
       --outfile=kids/assets/kids-uzay3d.mjs        (three@0.160.0, MedLab kampüsüyle aynı sürüm)

   Sahne: ortada parlayan güneş, çevresinde sarmal yıldız tozundan galaksi diski. Konular disk
   üstünde sarmal bir yol boyunca gezegen: konunun renginde, desenli, bazısı halkalı; çocuk
   ilerledikçe bayrak (1), dönen ay (2), altın halka (3). Kilitli gezegen renkli bulutsunun içinde;
   yeni açılınca bulut bir kez dağılır. Roket son gidilen gezegende bekler, uçuş oradan kalkar.
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
function galaksi(R, hafif) {
  const g = new Group();
  /* sarmal yıldız tozu: 3 kol */
  const n = hafif ? 2200 : 5200, poz = [], renk = [], r = rng(7), pal = ['#8E7CF0', '#FF7AA8', '#4AA8FF', '#FFD9F0', '#B8A8FF'].map((c) => new Color(c));
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
/* ---------------- bulutsu (22.11.2026): kilitli gezegeni saran renkli bulut kümeleri ---------------- */
let bulutTex = null;
function bulutDoku() {
  if (bulutTex) return bulutTex;
  const c = kanvas(256, 256), x = c.getContext('2d'), r = rng(5);
  for (let j = 0; j < 9; j++) {
    const cx = 70 + r() * 116, cy = 80 + r() * 96, rr = 38 + r() * 46, g = x.createRadialGradient(cx, cy, 0, cx, cy, rr);
    g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.55, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, rr, 0, TAU); x.fill();
  }
  bulutTex = dokuDan(c); return bulutTex;
}
const BULUT_RENK = ['#C9B8FF', '#FFC2E0', '#B8DCFF', '#E6DCFF', '#FFD9F0'];
function bulutsuKur(i) {
  const g = new Group(), r = rng(i * 13 + 2), puf = [];
  for (let j = 0; j < 9; j++) {
    const a = j / 9 * TAU + r() * 0.5, yr = PR * (0.95 + r() * 0.45), yy = (r() - 0.45) * PR * 1.3;
    const sp = new Sprite(new SpriteMaterial({ map: bulutDoku(), color: BULUT_RENK[(i + j) % BULUT_RENK.length], transparent: true, opacity: 0.78 + r() * 0.17, depthWrite: false }));
    const boy = PR * (1.5 + r() * 0.9); sp.scale.set(boy, boy * 0.78, 1);
    sp.position.set(Math.cos(a) * yr, yy, Math.sin(a) * yr); g.add(sp);
    puf.push({ sp, ev: sp.position.clone(), boy, op: sp.material.opacity, faz: r() * TAU });
  }
  /* önde yoğun bir perde: gezegen yalnız bulutların arasından seçilir */
  const on = new Sprite(new SpriteMaterial({ map: bulutDoku(), color: '#DCD2FF', transparent: true, opacity: 0.62, depthWrite: false }));
  on.scale.set(PR * 2.7, PR * 2.2, 1); on.position.set(0, -PR * 0.1, PR * 0.6); g.add(on);
  puf.push({ sp: on, ev: on.position.clone(), boy: PR * 2.7, op: 0.62, faz: 0 });
  return { g, puf };
}

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
  const ek = { ay: null, altin: null };
  /* kilitli: gezegen renkli bulutsunun içinde; yeni açılan gezegende bulut bir kez dağılır (bulutDagit) */
  if (kilit || k.yeniAcik) { const b = bulutsuKur(i); g.add(b.g); ek.bulut = b; if (k.yeniAcik) ek.bulut.dagit = { t0: 0 }; }
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
  const s = new Sprite(new SpriteMaterial({ map: svgDoku(simgeSvg, 256, false), transparent: true, opacity: kilit ? 0.3 : 1, depthWrite: false }));
  s.scale.set(1.9, 1.9, 1); s.position.y = PR + 0.75; g.add(s);
  if (k.bugun) {
    const halo = new Mesh(new RingGeometry(PR * 1.5, PR * 1.62, 64), new MeshBasicMaterial({ color: '#FFD23F', transparent: true, opacity: 0.9, side: DoubleSide }));
    halo.rotation.x = -Math.PI / 2; halo.position.y = -PR * 0.9; g.add(halo); ek.halo = halo;
    /* 21.11.2026: bugünün gezegeni — yukarı uzanan altın ışık sütunu ("Bugün" yazısı Acadia'nın balonunda) */
    const sc = kanvas(64, 256), sx = sc.getContext('2d'), sg = sx.createLinearGradient(0, 256, 0, 0);
    sg.addColorStop(0, 'rgba(255,214,90,.75)'); sg.addColorStop(0.35, 'rgba(255,214,90,.35)'); sg.addColorStop(1, 'rgba(255,214,90,0)');
    sx.fillStyle = sg; sx.fillRect(0, 0, 64, 256);
    const sutun = new Mesh(new CylinderGeometry(PR * 0.55, PR * 1.05, 16, 32, 1, true), new MeshBasicMaterial({ map: dokuDan(sc), transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide }));
    sutun.position.y = 8 - PR * 0.4; g.add(sutun); ek.sutun = sutun;
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

/* ---------------- roket (21.11.2026): çocuk gezegenler arasında roketle, yolu izleyerek uçar ---------------- */
function roketKur(yuzSvg) {
  const dis = new Group(), ic = new Group(); dis.add(ic);
  const beyaz = new MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.45 }), kirmizi = new MeshStandardMaterial({ color: '#FF6B5B', roughness: 0.5 }), lac = new MeshStandardMaterial({ color: '#23304D', roughness: 0.6 });
  const govde = new Mesh(new CylinderGeometry(0.34, 0.4, 1.3, 24), beyaz); ic.add(govde);
  const burun = new Mesh(new ConeGeometry(0.34, 0.62, 24), kirmizi); burun.position.y = 0.96; ic.add(burun);
  const kusak = new Mesh(new CylinderGeometry(0.41, 0.41, 0.12, 24), kirmizi); kusak.position.y = -0.42; ic.add(kusak);
  for (let k = 0; k < 3; k++) {
    const kanat = new Mesh(new BoxGeometry(0.06, 0.5, 0.36), kirmizi), a = k * TAU / 3;
    kanat.position.set(Math.sin(a) * 0.42, -0.5, Math.cos(a) * 0.42); kanat.rotation.y = a; ic.add(kanat);
  }
  const lule = new Mesh(new CylinderGeometry(0.2, 0.28, 0.2, 16), lac); lule.position.y = -0.75; ic.add(lule);
  /* pencere: çocuğun hayvan yüzü */
  const cerceve = new Mesh(new TorusGeometry(0.24, 0.05, 8, 24), lac); cerceve.position.set(0, 0.2, 0.36); ic.add(cerceve);
  const yuz = new Sprite(new SpriteMaterial({ map: svgDoku(yuzSvg, 256, true), transparent: true, depthWrite: false }));
  yuz.scale.set(0.46, 0.46, 1); yuz.position.set(0, 0.2, 0.42); ic.add(yuz);
  const alev = [];
  [[0.2, 0.9, '#FFB020'], [0.11, 0.55, '#FFF3B0']].forEach(([rr, h, c]) => {
    const m = new Mesh(new ConeGeometry(rr, h, 14), new MeshBasicMaterial({ color: c, transparent: true, opacity: 0.95 }));
    m.rotation.x = Math.PI; m.position.y = -0.85 - h / 2; ic.add(m); alev.push(m);
  });
  ic.rotation.x = Math.PI / 2;   /* burun +Z'ye: lookAt ile yol yönüne döner */
  dis.scale.setScalar(1.5); dis.visible = false;
  return { r: dis, alev };
}

/* ======================================================================
   kur({ kap, katman, konular:[{id, renk, simge(svg), kilit, asama, bugun, el}], yuz(svg), baslangic, sakin })
   ====================================================================== */
export function kur(o) {
  const kap = o.kap, sakin = !!o.sakin;
  /* 22.11.2026 hafif mod: zayıf cihazda (az çekirdek / bellek ya da önceki açılışta kare hızı düştüyse)
     kenar yumuşatma kapalı, çözünürlük 1x, galaksi tozu az, iz kısa */
  const hafif = !!o.hafif;
  const renderer = new WebGLRenderer({ antialias: !hafif, alpha: true, powerPreference: hafif ? 'low-power' : 'high-performance' });
  let pr = hafif ? 1 : Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.6 : 2);
  renderer.setPixelRatio(pr);
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
  const G = galaksi(R, hafif); sahne.add(G.g);
  sahne.add(new AmbientLight('#B8C4FF', 0.55));
  sahne.add(new HemisphereLight('#E8ECFF', '#3A2A7A', 0.65));
  const isik = new PointLight('#FFF1D0', 2.6, 0, 0); isik.position.set(0, 1.5, 0); sahne.add(isik);
  const yan = new DirectionalLight('#ffffff', 0.55); yan.position.set(-10, 18, 14); sahne.add(yan);

  /* uzay yolu (21.11.2026): gezegenleri sırayla bağlar. Bronzu bitmiş gezegenden sonraki bölüm altın
     renginde parlar ve üstünde ışık topları akar; henüz gidilmeyen bölümler soluk, noktalı kalır. */
  const egri = N > 1 ? new CatmullRomCurve3(yerler.map((v) => v.clone().setY(v.y - 0.9))) : null;
  const tNo = (i) => (N > 1 ? i / (N - 1) : 0);
  const akanlar = [];
  if (egri) {
    const yanik = o.konular.map((k) => !k.kilit && (k.asama || 0) >= 2);
    const acikDot = [], solukDot = [];
    for (let s2 = 0; s2 < N - 1; s2++) {
      const ps = []; for (let j = 0; j <= 16; j++) ps.push(egri.getPoint(Math.min(1, tNo(s2) + (tNo(s2 + 1) - tNo(s2)) * j / 16)));
      const bol = new CatmullRomCurve3(ps), lit = yanik[s2];
      sahne.add(new Mesh(new TubeGeometry(bol, 32, lit ? 0.09 : 0.04, 6, false), new MeshBasicMaterial({ color: lit ? '#FFD23F' : '#8E9AD6', transparent: true, opacity: lit ? 0.95 : 0.35, blending: AdditiveBlending, depthWrite: false })));
      for (let j = 0; j < 8; j++) { const p = bol.getPointAt(j / 8); (lit ? acikDot : solukDot).push(p.x, p.y + 0.02, p.z); }
      if (lit && !sakin) {
        const ak = new Sprite(new SpriteMaterial({ map: parilti('rgba(255,230,140,.95)'), transparent: true, depthWrite: false, blending: AdditiveBlending }));
        ak.scale.set(0.9, 0.9, 1); sahne.add(ak); akanlar.push({ s: ak, egri: bol, faz: (s2 * 0.37) % 1 });
      }
    }
    const nokta = (arr, boy, rk, op) => { if (!arr.length) return; const ng = new BufferGeometry(); ng.setAttribute('position', new Float32BufferAttribute(arr, 3)); sahne.add(new Points(ng, new PointsMaterial({ size: boy, color: rk, map: parilti('rgba(255,255,255,.9)'), transparent: true, opacity: op, depthWrite: false, blending: AdditiveBlending }))); };
    nokta(acikDot, 0.5, '#FFE9A0', 1); nokta(solukDot, 0.3, '#BFC8F0', 0.5);
  }

  const G2 = o.konular.map((k, i) => { const p = gezegenKur(k, i, k.simge); p.g.position.copy(yerler[i]); sahne.add(p.g); return p; });
  if (sakin) G2.forEach((p) => { if (p.ek.bulut && p.ek.bulut.dagit) { p.ek.bulut.g.visible = false; p.ek.bulut = null; } });
  const A = astronotKur(o.yuz); sahne.add(A.a);
  const RK = roketKur(o.yuz); sahne.add(RK.r);
  /* roketin ardındaki yıldız izi: küçük parıltı havuzu */
  const iz = Array.from({ length: hafif ? 18 : 36 }, () => { const sp = new Sprite(new SpriteMaterial({ map: parilti('rgba(255,210,120,.95)'), transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 })); sp.visible = false; sahne.add(sp); return { sp, yas: 9 }; });
  let izSira = 0;
  /* kalkış dumanı (yumuşak bulut parçacıkları) ve iniş tozu halkası */
  const duman = Array.from({ length: hafif ? 8 : 16 }, () => { const sp = new Sprite(new SpriteMaterial({ map: bulutDoku(), color: '#E9ECF6', transparent: true, depthWrite: false, opacity: 0 })); sp.visible = false; sahne.add(sp); return { sp, yas: 1, v: new Vector3() }; });
  let dumanSira = 0;
  function dumanAt(p, guc) {
    const d = duman[dumanSira++ % duman.length]; d.sp.visible = true; d.yas = 0; d.sp.position.copy(p);
    d.v.set((Math.random() - 0.5) * 1.6, -0.2 + Math.random() * 0.5, (Math.random() - 0.5) * 1.6).multiplyScalar(guc || 1);
  }
  const toz = new Mesh(new RingGeometry(0.5, 0.9, 40), new MeshBasicMaterial({ color: '#FFF1C9', transparent: true, opacity: 0, side: DoubleSide, depthWrite: false, blending: AdditiveBlending }));
  toz.rotation.x = -Math.PI / 2; toz.visible = false; sahne.add(toz); let tozYas = 1;
  /* geri sayım ve hız çizgileri: haritanın üstünde HTML (kids-uzay.css .kz3-geri / .kz3-hiz) */
  const harita0 = kap.parentNode, geri = document.createElement('div'), hizK = document.createElement('div');
  geri.className = 'kz3-geri'; geri.setAttribute('aria-hidden', 'true'); hizK.className = 'kz3-hiz'; hizK.setAttribute('aria-hidden', 'true');
  if (harita0) { harita0.appendChild(geri); harita0.appendChild(hizK); }
  function geriGoster(n) { geri.textContent = n; geri.classList.remove('kz3-geri-on'); void geri.offsetWidth; geri.classList.add('kz3-geri-on'); }
  const idx = (kid) => o.konular.findIndex((k) => k.id === kid);
  let suan = Math.max(0, idx(o.baslangic));
  const astYeri = (i) => yerler[i].clone().add(new Vector3(-PR * 1.35, PR * 0.35, PR * 0.95));
  A.a.position.copy(astYeri(suan)); A.a.rotation.y = 0.5;
  /* 22.11.2026: roket son gidilen gezegende, astronotun yanında dik bekler; uçuş oradan kalkar */
  const rokYeri = (i) => yerler[i].clone().add(new Vector3(PR * 1.5, PR * 0.15, PR * 0.85));
  function park(i) { RK.r.visible = true; RK.r.position.copy(rokYeri(i)); RK.r.rotation.set(-Math.PI / 2, 0, 0.12); RK.alev.forEach((x) => { x.visible = false; }); }
  park(suan);

  /* kamera: eğik bakış, hedef kaydırılabilir */
  /* harita açılınca kamera bugünün gezegenine bakar (astronot son gittiği yerde bekler) */
  const bugunI = o.konular.findIndex((k) => k.bugun);
  const hedef = yerler[bugunI >= 0 ? bugunI : suan].clone().setY(0), hedefSon = hedef.clone();
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
      if (gor) { el.style.setProperty('--w', cap.toFixed(0) + 'px'); el.style.transform = 'translate(' + (x - cap / 2).toFixed(1) + 'px,' + (y - cap / 2).toFixed(1) + 'px)'; el.style.zIndex = String(1000 - Math.round(d * 10) + (o.konular[i].bugun ? 600 : 0)); }
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
  function uc(kid, sonra, ucarken) {
    const i = idx(kid); if (i < 0) return sonra();
    if (ucus || dalis) return;
    if (i !== suan && ucarken) ucarken();
    hedefSon.copy(yerler[i]).setY(0);
    if (sakin) { suan = i; A.a.position.copy(astYeri(i)); park(i); hedef.copy(hedefSon); return setTimeout(sonra, 0); }
    if (i === suan) { A.a.position.copy(astYeri(i)); return dal(i, sonra); }
    if (egri) {
      /* roket: astronot rokete biner, gezegenler arasındaki yolu izleyerek uçar */
      const fark = Math.abs(i - suan);
      /* 22.11.2026: üç bölüm. KALK: astronot rokete zıplar, geri sayım, sarsıntı ve duman · UC: yol boyunca uçuş,
         kamera yaklaşır, görüş açısı genişler, hız çizgileri · IN: roket yavaşlayıp oturur, toz halkası, astronot iner ve el sallar */
      ucus = { roket: true, ta: tNo(suan), tb: tNo(i), t0: performance.now(), kalk0: 1050, sure: Math.min(3000, Math.max(1300, 900 + fark * 220)), in0: 750, sonra, i, kalk: rokYeri(suan), uzak0: uzakSon, sayi: 0 };
      RK.r.visible = true; RK.r.position.copy(ucus.kalk);
      return;
    }
    const a = A.a.position.clone(), b = astYeri(i), m = a.clone().lerp(b, 0.5); m.y += 4 + a.distanceTo(b) * 0.18;
    ucus = { egri: new QuadraticBezierCurve3(a, m, b), t0: performance.now(), sure: 950 + Math.min(700, a.distanceTo(b) * 35), sonra, i };
    A.alevler.forEach((x) => { x.visible = true; });
    const yon = b.clone().sub(a); A.a.rotation.y = Math.atan2(yon.x, yon.z);
  }

  /* döngü */
  let raf = 0, gorunur = true, son = performance.now(), yok = false, olcum = sakin ? null : { t0: performance.now(), son: performance.now(), n: 0, top: 0 };
  const io = window.IntersectionObserver ? new IntersectionObserver((g) => { gorunur = g[0].isIntersecting; if (gorunur) basla(); }) : null; if (io) io.observe(kap);
  function kare(now) {
    raf = 0;
    if (yok) return;
    if (!kap.isConnected) { temizle(); return; }
    const dt = Math.min(0.05, (now - son) / 1000); son = now; const t = now / 1000;
    /* kare hızı gözcüsü: ilk saniyelerde ortalama 30 fps'in altındaysa çözünürlüğü düşür, bir dahaki açılışta hafif mod */
    if (olcum && !ucus && !dalis) {
      if (now - olcum.t0 > 1200) { olcum.n++; olcum.top += (now - olcum.son); }
      olcum.son = now;
      if (olcum.n >= 60) {
        const ort = olcum.top / olcum.n; olcum = null;
        if (ort > 34 && pr > 1) { pr = 1; renderer.setPixelRatio(1); boyut(); try { localStorage.setItem('kids.hafif', '1'); } catch (e2) { } }
        else if (ort > 40) { try { localStorage.setItem('kids.hafif', '1'); } catch (e2) { } }
      }
    }
    if (!sakin) {
      G.toz.rotation.y += dt * 0.025; G.hale.material.opacity = 0.85 + Math.sin(t * 1.6) * 0.12; G.isin.material.rotation += dt * 0.12; G.gunes.rotation.y += dt * 0.1;
      G2.forEach((p, i) => { p.govde.rotation.y += dt * (0.18 + (i % 4) * 0.04); if (p.ek.ay) p.ek.ay.rotation.y += dt * 0.9; if (p.ek.altin) p.ek.altin.rotation.z += dt * 0.4; if (p.ek.bayrak) p.ek.bayrak.rotation.y = Math.sin(t * 4 + i) * 0.35; if (p.ek.halo) p.ek.halo.scale.setScalar(1 + Math.sin(t * 3) * 0.06); });
    }
    if (!sakin) {
      akanlar.forEach((x) => { const f = (t * 0.35 + x.faz) % 1; x.egri.getPointAt(f, x.s.position); x.s.position.y += 0.05; x.s.material.opacity = Math.sin(f * Math.PI); });
      G2.forEach((p, i) => {
        const b = p.ek.bulut; if (!b) return;
        b.g.rotation.y += dt * 0.07;
        if (b.dagit) {
          /* yeni açılan gezegen: bulutlar dışa savrulup söner, gezegen ortaya çıkar */
          if (!b.dagit.t0) b.dagit.t0 = now + 900;
          const u = MathUtils.clamp((now - b.dagit.t0) / 1800, 0, 1), e = 1 - Math.pow(1 - u, 3);
          b.puf.forEach((x) => { x.sp.position.copy(x.ev).multiplyScalar(1 + e * 2.2); x.sp.position.y += e * 1.2; x.sp.material.opacity = x.op * (1 - e); x.sp.scale.set(x.boy * (1 + e * 0.8), x.boy * 0.78 * (1 + e * 0.8), 1); });
          if (u >= 1) { b.g.visible = false; p.ek.bulut = null; }
        } else b.puf.forEach((x) => { x.sp.position.y = x.ev.y + Math.sin(t * 0.8 + x.faz) * 0.12; });
      });
      G2.forEach((p) => { if (p.ek.sutun) { p.ek.sutun.material.opacity = 0.75 + Math.sin(t * 2.2) * 0.25; p.ek.sutun.rotation.y += dt * 0.6; } });
    }
    iz.forEach((z) => { if (z.yas < 1) { z.yas += dt * 1.6; z.sp.material.opacity = 1 - z.yas; z.sp.scale.setScalar(0.55 * (1 - z.yas) + 0.1); if (z.yas >= 1) z.sp.visible = false; } });
    duman.forEach((d) => { if (d.yas < 1) { d.yas += dt * 0.9; d.sp.position.addScaledVector(d.v, dt); d.sp.material.opacity = 0.75 * (1 - d.yas); d.sp.scale.setScalar(0.6 + d.yas * 2.4); if (d.yas >= 1) d.sp.visible = false; } });
    if (tozYas < 1) { tozYas += dt * 1.4; toz.scale.setScalar(1 + tozYas * 3.5); toz.material.opacity = 0.8 * (1 - tozYas); if (tozYas >= 1) toz.visible = false; }
    const ge = ucus && ucus.roket ? now - ucus.t0 : 0;
    if (ucus && ucus.roket && ge < ucus.kalk0) {
      /* KALK */
      const q = ge / ucus.kalk0, bas = rokYeri(suan);
      if (q < 0.36) { const qq = q / 0.36; A.a.visible = true; A.a.position.lerpVectors(astYeri(suan), bas, qq); A.a.position.y += Math.sin(qq * Math.PI) * 1.3; A.a.scale.setScalar(1 - qq * 0.85); A.a.rotation.y = 0.5 + qq * 2; }
      else { A.a.visible = false; A.a.scale.setScalar(1); }
      const sayi = q < 0.36 ? 0 : q < 0.57 ? 3 : q < 0.78 ? 2 : 1;
      if (sayi && sayi !== ucus.sayi) { ucus.sayi = sayi; geriGoster(sayi); }
      const sars = q > 0.36 ? (q - 0.36) * 0.16 : 0;
      RK.r.position.copy(bas); RK.r.position.x += (Math.random() - 0.5) * sars; RK.r.position.z += (Math.random() - 0.5) * sars; RK.r.rotation.set(-Math.PI / 2, 0, 0.12);
      RK.alev.forEach((x) => { x.visible = q > 0.5; x.scale.set(1, 0.4 + q * 0.6 + Math.random() * 0.3, 1); });
      if (q > 0.45 && Math.random() < (hafif ? 0.35 : 0.7)) dumanAt(bas.clone().add(new Vector3(0, -1.2, 0)), 1);
      hedefSon.copy(bas).setY(0);
    } else if (ucus && ucus.roket && ge < ucus.kalk0 + ucus.sure) {
      /* UC */
      if (!ucus.ucuyor) { ucus.ucuyor = true; uzakSon = Math.max(12, ucus.uzak0 * 0.72); RK.alev.forEach((x) => { x.visible = true; }); }
      const u = Math.min(1, (ge - ucus.kalk0) / ucus.sure), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      if (!sakin) { kam.fov = 40 + Math.sin(u * Math.PI) * 9; kam.updateProjectionMatrix(); }
      if (harita0) harita0.classList.toggle('kz3-hizli', u > 0.18 && u < 0.82);
      if (u < 0.12 && Math.random() < 0.6) dumanAt(RK.r.position.clone(), 0.6);
      const yolNokta = (uu) => { const p = egri.getPoint(MathUtils.clamp(ucus.ta + (ucus.tb - ucus.ta) * uu, 0, 1));   /* kayan nokta 1'i aşmasın */ p.y += 1.6 + Math.sin(uu * Math.PI) * 2.2; return p; };
      /* kalkış ve iniş astronotun durduğu yerden: ilk ve son %12'de yola karışır */
      const p = yolNokta(e), kal = Math.max(0, 1 - e / 0.12), in_ = Math.max(0, (e - 0.88) / 0.12);
      if (kal > 0) p.lerp(ucus.kalk, kal * kal);
      if (in_ > 0) p.lerp(rokYeri(ucus.i), in_ * in_);
      const ileri = yolNokta(Math.min(1, e + 0.02));
      RK.r.position.copy(p); if (ileri.distanceToSquared(p) > 1e-4) RK.r.lookAt(ileri);
      RK.alev.forEach((x, j) => { x.scale.set(1, 0.75 + Math.random() * 0.55, 1); });
      hedefSon.copy(p).setY(0);
      const z = iz[izSira++ % iz.length]; z.sp.visible = true; z.yas = 0; z.sp.position.copy(p).addScaledVector(RK.r.getWorldDirection(v).normalize(), -0.95);
    } else if (ucus && ucus.roket) {
      /* IN */
      const q = Math.min(1, (ge - ucus.kalk0 - ucus.sure) / ucus.in0), hedefY = rokYeri(ucus.i);
      if (!ucus.indi) {
        ucus.indi = true; suan = ucus.i; park(suan); kam.fov = 40; kam.updateProjectionMatrix(); uzakSon = ucus.uzak0;
        if (harita0) harita0.classList.remove('kz3-hizli');
        toz.visible = true; tozYas = 0; toz.position.copy(hedefY).add(new Vector3(0, -0.9, 0));
        for (let j = 0; j < (hafif ? 3 : 6); j++) dumanAt(hedefY.clone().add(new Vector3(0, -0.9, 0)), 1.4);
      }
      /* roket hafifçe sekip oturur; astronot kapıdan çıkıp yanına zıplar ve el sallar */
      RK.r.position.copy(hedefY); RK.r.position.y += Math.max(0, Math.sin(q * Math.PI * 2) * (1 - q) * 0.35);
      const aq = Math.max(0, (q - 0.25) / 0.75);
      A.a.visible = aq > 0; A.a.scale.setScalar(0.15 + aq * 0.85);
      A.a.position.lerpVectors(hedefY, astYeri(suan), aq); A.a.position.y += Math.sin(aq * Math.PI) * 1.1; A.a.rotation.y = 0.5;
      A.kR.rotation.z = -0.5 - Math.max(0, Math.sin(aq * Math.PI * 4)) * 1.6;
      if (q >= 1) { const s = ucus.sonra; ucus = null; A.a.scale.setScalar(1); A.a.position.copy(astYeri(suan)); A.a.visible = true; A.kR.rotation.z = -0.5; dal(suan, s); }
    } else if (ucus) {
      const u = Math.min(1, (now - ucus.t0) / ucus.sure), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      A.a.position.copy(ucus.egri.getPoint(e));
      A.alevler.forEach((x, j) => { x.scale.y = 0.8 + Math.random() * 0.5; });
      A.kL.rotation.z = 1.2; A.kR.rotation.z = -1.2;
      if (u >= 1) { const s = ucus.sonra; suan = ucus.i; ucus = null; A.alevler.forEach((x) => { x.visible = false; }); A.kL.rotation.z = 0.5; A.kR.rotation.z = -0.5; A.a.rotation.y = 0.5; dal(suan, s); }
    } else if (!sakin) {
      A.a.position.y = astYeri(suan).y + Math.sin(t * 1.8) * 0.12; A.a.rotation.z = Math.sin(t * 1.2) * 0.08;
      RK.r.position.y = rokYeri(suan).y + Math.sin(t * 1.4 + 1.3) * 0.08;
    }
    const k = sakin ? 1 : 1 - Math.pow(0.002, dt);
    if (dalis) {
      const u = Math.min(1, (now - dalis.t0) / dalis.sure), e = u * u * u * (u * (u * 6 - 15) + 10), p = G2[dalis.i];
      hedef.copy(dalis.h0).lerp(yerler[dalis.i], e); uzak = dalis.u0 + (PR * 1.25 - dalis.u0) * e;
      const atm = p.g.children[1]; if (atm && atm.material) { atm.material.opacity = 0.9 + e * 0.1; atm.scale.setScalar(PR * (4.2 + e * 3)); }
      p.govde.rotation.y += dt * (0.4 + e * 2);
      A.a.visible = u < 0.45; RK.r.visible = u < 0.45;
      if (u >= 1) {
        const s = dalis.sonra, d = dalis; dalis = null; s();
        /* konu kids-app'te harita üstünde açılır: perde kapattıktan sonra sahneyi eski haline getir,
           konu kapanınca harita gezegenin başında, adlar yerinde bekler */
        setTimeout(() => {
          if (yok) return;
          const atm = p.g.children[1]; if (atm && atm.material) { atm.material.opacity = 0.9; atm.scale.setScalar(PR * 4.2); }
          hedef.copy(yerler[d.i]).setY(0); hedefSon.copy(hedef); uzak = uzakSon = d.u0; A.a.visible = true; park(suan);
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
    document.removeEventListener('visibilitychange', gor); if (ro) ro.disconnect(); if (io) io.disconnect(); geri.remove(); hizK.remove();
    sahne.traverse((n) => { if (n.geometry) n.geometry.dispose(); if (n.material) { if (n.material.map) n.material.map.dispose(); n.material.dispose(); } });
    renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss();
  }
  kamYerlestir(); basla();
  return { uc, temizle, odak: (kid) => { const i = idx(kid); if (i >= 0) hedefSon.copy(yerler[i]).setY(0); } };
}
