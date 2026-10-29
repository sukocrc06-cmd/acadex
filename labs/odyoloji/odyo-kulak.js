/* ==========================================================================
   ACADEX ODYOLOJİ LAB · 3B kulak ve işitme yolu (labs/odyoloji/odyo-kulak.js), 29.10.2026
   Veri: data/ax-kulak.js (Anatomi Lab verisinden süzülmüş; Z-Anatomy · BodyParts3D, CC BY-SA 4.0).
   Modelde kulak kepçesi, dış kulak yolu ve yarım daire kanalları ayrı parça olarak YOKTUR;
   "Olive" medulladaki olivadır (süperior olive kompleksi ayrı modellenmemiştir) — kartlarda belirtilir.
   window.OL.kulak: start, ctx, answer, classify, show, spot, tour (odyo-app.js köprüsü kullanır)
   ========================================================================== */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MeshoptDecoder } from './meshopt-decoder.js';

const OL = window.OL = window.OL || {};
const $ = s => document.querySelector(s);
const X = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const base = n => n.replace(/\.(l|r)$/, '');
const sideOf = n => /\.r$/.test(n) ? 'r' : /\.l$/.test(n) ? 'l' : 'm';

/* ---------- yapı bilgileri (eğitim amaçlı, özet) ---------- */
const S = {
  'Tympanic membrane': { g: 'orta', c: '#E79A9A', tr: 'Kulak zarı', la: 'Membrana tympanica', ad: ['kulak zari', 'timpanik membran', 'membrana tympanica'],
    is: 'Dış kulak yolundan gelen ses basıncıyla titreşir ve titreşimi malleusa aktarır. Zar alanının stapes tabanından yaklaşık 17 kat büyük olması, orta kulağın basınç kazancının ana kaynağıdır.',
    kl: 'Perforasyon iletim tipi kayıp yapar; timpanogram düz, kulak yolu hacmi yüksek çıkar. Orta kulakta sıvı varken zar mat ve hareketsizdir (Tip B).' },
  'Malleus': { g: 'orta', c: '#EFE4C8', tr: 'Çekiç kemiği', la: 'Malleus', ad: ['cekic', 'malleus'],
    is: 'Sapı kulak zarına yapışıktır; titreşimi inkusa aktarır.', kl: 'Kemikçik zincirinin kaldıraç etkisi basıncı yaklaşık 1,3 kat artırır. Zincir kopukluğunda timpanogram Ad tipidir.' },
  'Incus': { g: 'orta', c: '#E8DCBE', tr: 'Örs kemiği', la: 'Incus', ad: ['ors', 'incus', 'inkus'],
    is: 'Malleus ile stapes arasındaki halka; uzun kolu stapes başıyla eklem yapar.', kl: 'Uzun kol kronik orta kulak iltihabında erimeye en yatkın bölümdür; kopukluk iletim tipi kayıp yapar.' },
  'Stapes': { g: 'orta', c: '#F3EBD6', tr: 'Üzengi kemiği', la: 'Stapes', ad: ['uzengi', 'stapes'],
    is: 'Vücudun en küçük kemiği. Tabanı oval pencereye oturur ve titreşimi iç kulak sıvısına aktarır.', kl: 'Otosklerozda taban oval pencereye kaynar: iletim tipi kayıp, As timpanogram, alınamayan stapes refleksi. Tedavi stapes cerrahisi ya da işitme cihazı.' },
  'Auditory tube': { g: 'orta', c: '#C9A6D9', tr: 'Östaki borusu', la: 'Tuba auditiva', ad: ['ostaki', 'tuba auditiva', 'eustachian'],
    is: 'Orta kulağı burun arkasına (nazofarenks) bağlar; yutkunurken açılıp orta kulağı havalandırır ve basıncı eşitler.', kl: 'Çalışmazsa negatif basınç (Tip C) ve sıvı birikimi (Tip B) gelişir. Çocuklarda daha kısa ve yatay olduğu için sık görülür.' },
  'Chorda tympani': { g: 'orta', c: '#F2D04B', tr: 'Korda timpani', la: 'Chorda tympani', ad: ['korda timpani', 'chorda tympani'],
    is: 'Fasiyal sinirin dalı; orta kulaktan geçerek dilin ön üçte ikisinin tat duyusunu taşır.', kl: 'Orta kulak cerrahisinde zedelenebilir; tat değişikliği yapar.' },
  'Cochlea': { g: 'ic', c: '#F0B45A', tr: 'Koklea (salyangoz)', la: 'Cochlea', ad: ['koklea', 'salyangoz', 'cochlea'],
    is: 'İşitme organı. Baziler membran frekansa göre ayrışır: taban yüksek, tepe alçak frekanslara yanıt verir (tonotopi). İç tüy hücreleri sesi sinir sinyaline çevirir; dış tüy hücreleri yükseltir ve keskinleştirir.',
    kl: 'Gürültü ve yaşlanma önce tabandaki yüksek frekans bölgesini bozar (4 kHz çentik, düşen eğri). Otoakustik emisyon (OAE) dış tüy hücresi işlevini gösterir.' },
  'Vestibule': { g: 'ic', c: '#E3A86B', tr: 'Vestibül', la: 'Vestibulum', ad: ['vestibul', 'vestibulum'],
    is: 'Labirentin orta bölümü; utrikül ve sakkülü içerir, doğrusal ivmeyi ve baş eğimini algılar. Oval pencere buraya açılır.', kl: 'Ménière hastalığında endolenfatik hidrops işitme ve denge belirtilerini birlikte verir. Yarım daire kanalları bu modelde ayrı parça olarak yoktur.' },
  'Cochlear nerve': { g: 'ic', c: '#F2D04B', tr: 'Koklear sinir', la: 'Nervus cochlearis', ad: ['koklear sinir', 'nervus cochlearis', 'isitme siniri'],
    is: 'Spiral gangliondan çıkan işitme lifleri; sinyali beyin sapındaki koklear çekirdeklere taşır.', kl: 'İşitsel nöropatide OAE vardır ama ABR yoktur. Vestibüler schwannom bu sinire baskı yaparak asimetrik kayıp oluşturabilir.' },
  'Vestibular nerve': { g: 'ic', c: '#E8C23A', tr: 'Vestibüler sinir', la: 'Nervus vestibularis', ad: ['vestibuler sinir', 'nervus vestibularis', 'denge siniri'],
    is: 'Denge organlarından gelen bilgiyi vestibüler çekirdeklere taşır.', kl: 'Vestibüler nörit: ani başlayan, günlerce süren vertigo; işitme etkilenmez. Vestibüler schwannom çoğunlukla bu sinirden köken alır.' },
  'Vestibulocochlear nerve (VIII)': { g: 'ic', c: '#FFD86B', tr: 'VIII. kraniyal sinir', la: 'Nervus vestibulocochlearis', ad: ['8. kranial sinir', 'viii', 'vestibulokoklear sinir', 'nervus vestibulocochlearis', 'sekizinci kranyal sinir'],
    is: 'Koklear ve vestibüler sinirin iç kulak yolunda birleşmesiyle oluşur; ponto-serebellar köşeden beyin sapına girer.', kl: 'İç kulak yolu ve ponto-serebellar köşe tümörleri: tek taraflı kayıp, eşiklere göre düşük konuşma ayırt etme, uzamış ABR I–V aralığı. Kesin tanı MR ile konur.' },
  'Facial nerve (VII)': { g: 'ic', c: '#F5E08A', tr: 'Fasiyal sinir (VII)', la: 'Nervus facialis', ad: ['fasiyal sinir', 'yuz siniri', 'nervus facialis', '7. kranial sinir', 'vii'],
    is: 'Yüz kaslarını ve stapedius kasını uyarır; iç kulak yolunda VIII. sinirle yan yana seyreder.', kl: 'Stapes refleksinin motor kolu bu sinirdir: fasiyal paralizide o tarafta refleks alınamaz.' },
  'Anterior cochlear nucleus': { g: 'merkez', c: '#9B6BDA', tr: 'Ön koklear çekirdek', la: 'Nucleus cochlearis anterior', ad: ['on koklear cekirdek', 'nucleus cochlearis anterior', 'ventral koklear cekirdek'],
    is: 'İşitme yolunun beyin sapındaki ilk durağı; koklear sinir lifleri burada sinaps yapar.', kl: 'ABR\'nin erken dalgaları (II–III) koklear çekirdekler ve çevresinden kaynaklanır.' },
  'Posterior cochlear nucleus': { g: 'merkez', c: '#8A5CCB', tr: 'Arka koklear çekirdek', la: 'Nucleus cochlearis posterior', ad: ['arka koklear cekirdek', 'nucleus cochlearis posterior', 'dorsal koklear cekirdek'],
    is: 'Sesin spektral özelliklerini işler; liflerinin çoğu karşı tarafa geçer.', kl: 'Merkezi işitme yolu iki taraflı olduğundan tek taraflı beyin sapı lezyonu çoğu zaman saf ses eşiklerini bozmaz.' },
  'Olive': { g: 'merkez', c: '#B27BE0', tr: 'Olive (bölge göstergesi)', la: 'Oliva', ad: ['olive', 'oliva', 'superior olive', 'olivar kompleks'],
    is: 'Modeldeki parça medulla yüzeyindeki olivadır. İşitmede asıl iş yapan süperior olive kompleksi ponsun alt bölümünde, bu bölgenin hemen üstündedir: iki kulaktan gelen bilginin ilk birleştiği yer; ses yönünü kulaklar arası zaman ve şiddet farkından hesaplar.',
    kl: 'Süperior olive bağlantıları sayesinde stapes refleksi iki taraflıdır; kontralateral refleks bu yolla alınır.' },
  'Inferior colliculus': { g: 'merkez', c: '#C35CC0', tr: 'İnferior kollikulus', la: 'Colliculus inferior', ad: ['inferior kollikulus', 'colliculus inferior', 'alt tepecik'],
    is: 'Mezensefalondaki işitme merkezi; yükselen işitme liflerinin neredeyse tamamı burada toplanır.', kl: 'ABR dalga V\'in kaynağı lateral lemniskus ile inferior kollikulus bölgesidir.' },
  'Medial geniculate body': { g: 'merkez', c: '#D15A9A', tr: 'Medial genikulat cisim', la: 'Corpus geniculatum mediale', ad: ['medial genikulat', 'corpus geniculatum mediale', 'mgb'],
    is: 'Talamustaki işitme istasyonu; sinyali işitme korteksine iletir.', kl: 'Orta latans yanıtların (MLR) kaynaklarındandır.' },
  'Transverse temporal gyri': { g: 'merkez', c: '#E07AA0', tr: 'Heschl girusları', la: 'Gyri temporales transversi', ad: ['heschl', 'primer isitme korteksi', 'gyri temporales transversi', 'transvers temporal girus'],
    is: 'Primer işitme korteksi (Brodmann 41–42). Burada da tonotopik düzen sürer.', kl: 'Geç kortikal yanıtlar (P1–N1–P2) bu bölgeden kaydedilir; merkezi işitsel işlemleme bozukluklarında rol oynar.' },
  'Superior temporal gyrus (Lateral part)': { g: 'merkez', c: '#E89BB8', tr: 'Süperior temporal girus', la: 'Gyrus temporalis superior', ad: ['superior temporal girus', 'gyrus temporalis superior', 'wernicke'],
    is: 'İşitme çağrışım alanı; baskın hemisferde Wernicke alanı konuşmanın anlaşılmasında görev alır.', kl: 'Hasarında ses duyulur ama konuşma anlaşılmaz (Wernicke afazisi).' },
  'Vestibular nuclei': { g: 'denge', c: '#5BA7D8', tr: 'Vestibüler çekirdekler', la: 'Nuclei vestibulares', ad: ['vestibuler cekirdek', 'nuclei vestibulares'],
    is: 'Denge bilgisini göz kaslarına (vestibülo-oküler refleks) ve omuriliğe (vestibülospinal yollar) bağlar.', kl: 'Nistagmus vestibülo-oküler refleksten kaynaklanır; VNG ve video baş itme testi bu refleksi ölçer.' },
  'Temporal bone': { g: 'baglam', c: '#D9CFB8', tr: 'Temporal kemik', la: 'Os temporale', ad: ['temporal kemik', 'os temporale', 'sakak kemigi'],
    is: 'Orta ve iç kulağı barındıran kemik; petröz bölümü vücudun en sert kemiğidir. Kemik yolu ile verilen ses bu kemiği titreştirerek kokleaya doğrudan ulaşır.', kl: 'Kemik yolu iki kokleayı neredeyse eşit uyarır (kulaklar arası azalma ≈ 0 dB); bu yüzden kemik yolu ölçümünde maskeleme sık gerekir.' },
  'Pons': { g: 'baglam', c: '#9AA8C8', tr: 'Pons (köprü)', la: 'Pons', ad: ['pons', 'kopru'], is: 'Beyin sapının orta bölümü; koklear çekirdekler ve süperior olive kompleksi bu düzeydedir.', kl: '—' },
  'Medulla oblongata': { g: 'baglam', c: '#9AA8C8', tr: 'Medulla oblongata', la: 'Medulla oblongata', ad: ['medulla', 'sogan', 'medulla oblongata'], is: 'Beyin sapının alt bölümü; VIII. sinir ponto-medüller bileşkeden girer.', kl: '—' },
  'Midbrain': { g: 'baglam', c: '#9AA8C8', tr: 'Mezensefalon (orta beyin)', la: 'Mesencephalon', ad: ['mezensefalon', 'orta beyin', 'mesencephalon'], is: 'İnferior kollikulusları taşıyan beyin sapı bölümü.', kl: '—' }
};
const GROUPS = [['orta', 'Orta kulak'], ['ic', 'İç kulak ve sinirler'], ['merkez', 'Merkezi işitme yolu'], ['denge', 'Denge'], ['baglam', 'Bağlam']];
const SPOTABLE = Object.keys(S).filter(k => S[k].g !== 'baglam' || k === 'Temporal bone');

/* ---------- durum ---------- */
const K = { started: false, ready: false, side: 'r', bone: true, sel: null, meshes: [], byBase: new Map(), tour: null, spot: null, spotRes: null };
let renderer, scene, camera, controls, pulse, raf = 0, need = true;
const el = { box: $('#ku'), load: $('#ku-load'), list: $('#ku-list'), card: $('#ku-card'), tour: $('#ku-tour'), spot: $('#ku-spot') };

const loadScript = src => new Promise((res, rej) => { if (window.AXD && window.AXD.kulak) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('veri')); document.head.appendChild(s); });
const b64 = s => fetch('data:application/octet-stream;base64,' + s).then(r => r.arrayBuffer());

function matFor(name) {
  const info = S[base(name)] || { g: 'baglam', c: '#9AA8C8' };
  const ctx = info.g === 'baglam';
  const m = new THREE.MeshStandardMaterial({ color: info.c, roughness: ctx ? 0.8 : 0.55, metalness: 0.02, transparent: ctx, opacity: ctx ? (base(name) === 'Temporal bone' ? 0.16 : 0.22) : 1, depthWrite: !ctx, side: base(name) === 'Tympanic membrane' ? THREE.DoubleSide : THREE.FrontSide });
  m.userData.base = { color: m.color.clone(), opacity: m.opacity };
  return m;
}
function addMesh(geo, name) {
  geo.computeVertexNormals(); geo.computeBoundingBox(); geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, matFor(name)); m.name = name; m.userData.side = sideOf(name); m.userData.base = base(name);
  scene.add(m); K.meshes.push(m);
  if (!K.byBase.has(m.userData.base)) K.byBase.set(m.userData.base, []); K.byBase.get(m.userData.base).push(m);
  if (S[m.userData.base] && S[m.userData.base].g === 'baglam') m.renderOrder = 2;
}
async function build() {
  await loadScript('data/ax-kulak.js');
  const AXD = window.AXD; await MeshoptDecoder.ready;
  const buf = new Uint8Array(await b64(AXD.kulak)), dv = new DataView(buf.buffer), jl = dv.getUint32(0, true);
  const items = JSON.parse(new TextDecoder().decode(buf.subarray(4, 4 + jl))), off = 4 + jl + ((4 - (4 + jl) % 4) % 4);
  for (const it of items) {
    const Qv = new Uint16Array(it.nv * 4); MeshoptDecoder.decodeVertexBuffer(new Uint8Array(Qv.buffer), it.nv, 8, buf.subarray(off + it.vo, off + it.vo + it.vl));
    const I = new Uint32Array(it.ni); MeshoptDecoder.decodeIndexBuffer(new Uint8Array(I.buffer), it.ni, 4, buf.subarray(off + it.io, off + it.io + it.il));
    const P = new Float32Array(it.nv * 3); for (let v = 0; v < it.nv; v++) for (let k = 0; k < 3; k++) P[v * 3 + k] = it.mn[k] + Qv[v * 4 + k] / 65535 * it.ex[k];
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setIndex(new THREE.BufferAttribute(it.nv > 65535 ? I : new Uint16Array(I), 1));
    addMesh(g, it.n);
  }
  for (const t of AXD.kulakTubes || []) {
    const geos = t.p.filter(p => p.length > 1).map(path => {
      const curve = new THREE.CatmullRomCurve3(path.map(p => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal');
      const r = path.reduce((a, p) => a + p[3], 0) / path.length;
      return new THREE.TubeGeometry(curve, Math.max(8, Math.min(120, Math.ceil(curve.getLength() / 0.003))), Math.min(0.0011, Math.max(0.0005, r)), 8, false);
    });
    geos.forEach((g, i) => addMesh(g, t.n + (geos.length > 1 && i ? '' : '')));
  }
}
function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(36, 1, 0.001, 20);
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
  catch (e) { el.load.innerHTML = '<div class="ku-msg"><b>Bu cihazda 3B açılamadı.</b><br>Tarayıcın WebGL desteklemiyor. Kabin ve vaka masası çalışmaya devam eder.</div>'; return false; }
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.box.insertBefore(renderer.domElement, el.box.firstChild);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334466, 1.1));
  const d1 = new THREE.DirectionalLight(0xffffff, 1.6); d1.position.set(1, 2, 2); scene.add(d1);
  const d2 = new THREE.DirectionalLight(0xffe2b8, 0.6); d2.position.set(-2, -1, -1); scene.add(d2);
  controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.addEventListener('change', () => { need = true; });
  pulse = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xFFD86B, transparent: true, opacity: 0.95, depthTest: false })); pulse.renderOrder = 9; pulse.visible = false; scene.add(pulse);
  const ro = new ResizeObserver(resize); ro.observe(el.box); resize();
  let down = null;
  renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => { if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return; pickAt(e); });
  loop(); return true;
}
function resize() { if (!renderer) return; const w = el.box.clientWidth, h = el.box.clientHeight; renderer.setSize(w, h, false); renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px'; camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); need = true; }
let anim = null;
function loop(t) {
  raf = requestAnimationFrame(loop);
  if (!document.getElementById('kulak').classList.contains('on')) return;
  if (anim) { anim(t || performance.now()); need = true; }
  if (controls.update() || need) { renderer.render(scene, camera); need = false; }
}

/* ---------- görünürlük, seçim, kadraj ---------- */
const visible = m => {
  const b = m.userData.base, info = S[b] || {}, s = m.userData.side;
  if (b === 'Temporal bone') return K.bone && K.side !== 'b' && s === K.side;
  if (K.side === 'b') return true;
  if (info.g === 'merkez' || (info.g === 'baglam' && b !== 'Temporal bone') || b === 'Vestibular nuclei') return false;
  return s === 'm' || s === K.side;
};
function applyVis() { K.meshes.forEach(m => { m.visible = visible(m); }); need = true; }
function highlight(names) {
  const set = new Set(names);
  K.meshes.forEach(m => {
    const mt = m.material, ctxPart = (S[m.userData.base] || {}).g === 'baglam', on = set.has(m.userData.base) || set.has(m.name), dim = set.size && !on && !ctxPart;
    mt.emissive = new THREE.Color(on ? 0x7A5200 : 0x000000); mt.emissiveIntensity = on ? 0.8 : 0;
    mt.color.copy(mt.userData.base.color); if (dim) mt.color.lerp(new THREE.Color(0x5B6787), 0.45);
    /* seçili yapı öne çıksın: öbür parçalar yarı saydam (kalın sinir tüpleri önünü kapatmasın) */
    if (!ctxPart) { mt.transparent = !!dim; mt.opacity = dim ? 0.28 : 1; mt.depthWrite = !dim; m.renderOrder = dim ? 1 : 0; }
    mt.needsUpdate = true;
  });
  need = true;
}
function boxOf(ms) { const b = new THREE.Box3(); ms.forEach(m => { if (m.visible) b.expandByObject(m); }); return b; }
function frame(ms, k = 1.6, dirV) {
  const b = boxOf(ms); if (b.isEmpty()) return;
  const c = b.getCenter(new THREE.Vector3()), r = Math.max(0.0045, b.getSize(new THREE.Vector3()).length() / 2);
  const dir = dirV || (K.side === 'l' ? new THREE.Vector3(-1, 0.25, 0.35) : K.side === 'r' ? new THREE.Vector3(1, 0.25, 0.35) : new THREE.Vector3(0.55, 0.35, 1)).normalize();
  const dist = r * k / Math.tan(camera.fov * Math.PI / 360);
  const from = camera.position.clone(), to = c.clone().add(dir.multiplyScalar(dist)), tf = controls.target.clone(), t0 = performance.now(), D = 700;
  anim = t => { let u = Math.min(1, (t - t0) / D); u = u * u * (3 - 2 * u); camera.position.lerpVectors(from, to, u); controls.target.lerpVectors(tf, c, u); if (u >= 1) anim = pulseAnim; };
}
const vis = () => K.meshes.filter(m => m.visible);
function setSide(s) {
  K.side = s; document.querySelectorAll('.ku-bar [data-side]').forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute('data-side') === s)));
  applyVis(); frame(vis().filter(m => (S[m.userData.base] || {}).g !== 'baglam' || m.userData.base === 'Temporal bone'), K.side === 'b' ? 1.25 : 1.5);
  paintList(); OL.bridgeSend && OL.bridgeSend();
}
function select(b, fit = true) {
  K.sel = b; highlight(b ? [b] : []);
  if (b) {
    const ms = (K.byBase.get(b) || []).filter(m => m.visible);
    if (!ms.length) { const info = S[b]; if (info && info.g === 'merkez') setSide('b'); else if (K.side === 'b') setSide('r'); }
    if (fit) frame((K.byBase.get(b) || []).filter(m => m.visible), 4.2);
  }
  paintCard(); paintList(); OL.bridgeSend && OL.bridgeSend();
}
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pickAt(e) {
  if (K.spot) return;
  const r = renderer.domElement.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(vis(), false).filter(h => (S[h.object.userData.base] || {}).g !== 'baglam' || h.object.userData.base === 'Temporal bone');
  const h = hits.find(x => x.object.userData.base !== 'Temporal bone') || hits[0];
  select(h ? h.object.userData.base : null, false);
}

/* ---------- liste + kart ---------- */
function paintList() {
  el.list.innerHTML = GROUPS.map(([g, t]) => {
    const items = Object.keys(S).filter(k => S[k].g === g && K.byBase.has(k));
    if (!items.length) return '';
    return '<h3>' + t + '</h3>' + items.map(k => '<button type="button" data-k="' + X(k) + '" aria-pressed="' + (K.sel === k) + '"><i style="background:' + S[k].c + '"></i>' + X(S[k].tr) + '</button>').join('');
  }).join('');
}
el.list.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b && !K.spot) select(b.getAttribute('data-k')); });
function paintCard() {
  const s = S[K.sel]; if (!s) { el.card.hidden = true; return; }
  el.card.hidden = false;
  el.card.innerHTML = '<span class="k">' + X((GROUPS.find(g => g[0] === s.g) || [, ''])[1]) + '</span><h2>' + X(s.tr) + '</h2><p class="la">' + X(s.la) + '</p><p>' + X(s.is) + '</p>' + (s.kl && s.kl !== '—' ? '<p class="clin"><b>Klinikte:</b> ' + X(s.kl) + '</p>' : '');
}

/* ---------- sesin yolculuğu ---------- */
const TOUR = [
  { side: 'r', on: ['Tympanic membrane'], t: 'Kulak zarı', p: 'Ses dış kulak yolundan gelip kulak zarını titreştirir. (Kulak kepçesi ve dış kulak yolu bu modelde yok.) Zar, basınç dalgasını mekanik titreşime çevirir.' },
  { side: 'r', on: ['Malleus', 'Incus', 'Stapes'], t: 'Kemikçik zinciri', p: 'Malleus → inkus → stapes. Havadan sıvıya geçerken kaybolacak enerjiyi kurtarmak için empedans uydurur: zar/oval pencere alan oranı (~17) ve kaldıraç etkisi (~1,3) yaklaşık 25–30 dB kazanç sağlar.' },
  { side: 'r', on: ['Stapes', 'Cochlea', 'Vestibule'], t: 'Oval pencere ve koklea', p: 'Stapes tabanı oval pencereyi iter; iç kulak sıvısında yürüyen dalga oluşur. Baziler membranın tabanı yüksek, tepesi alçak frekanslarda en çok titreşir (tonotopi).' },
  { side: 'r', on: ['Cochlear nerve', 'Vestibulocochlear nerve (VIII)'], t: 'VIII. kraniyal sinir', p: 'İç tüy hücreleri titreşimi sinir sinyaline çevirir; koklear sinir lifleri iç kulak yolundan beyin sapına girer. ABR\'de dalga I buradan (sinirin distal kısmından) kaynaklanır.' },
  { side: 'b', on: ['Anterior cochlear nucleus', 'Posterior cochlear nucleus'], t: 'Koklear çekirdekler', p: 'İlk merkezi durak, aynı taraftadır. Buradan sonra lifler iki tarafa dağılır; bu yüzden tek taraflı merkezi lezyon saf ses eşiklerini nadiren bozar.' },
  { side: 'b', on: ['Olive'], t: 'Süperior olive (bölge)', p: 'İki kulaktan gelen bilgi ilk kez burada buluşur; ses kaynağının yönü kulaklar arası zaman ve şiddet farkından çıkarılır. (Gösterilen parça medulladaki olivadır; süperior olive kompleksi hemen üstündeki ponstadır.)' },
  { side: 'b', on: ['Inferior colliculus'], t: 'İnferior kollikulus', p: 'Lateral lemniskus ile yükselen lifler mezensefalonda toplanır. ABR\'nin en belirgin dalgası olan dalga V bu bölgeden kaynaklanır.' },
  { side: 'b', on: ['Medial geniculate body'], t: 'Medial genikulat cisim', p: 'Talamustaki işitme istasyonu; sinyali kortekse yollar.' },
  { side: 'b', on: ['Transverse temporal gyri', 'Superior temporal gyrus (Lateral part)'], t: 'İşitme korteksi', p: 'Heschl girusları primer işitme korteksidir; tonotopi burada da sürer. Hemen yanındaki süperior temporal girus (baskın hemisferde Wernicke alanı) konuşmanın anlaşılmasına katılır.' }
];
const centerOf = names => { const b = boxOf(names.flatMap(n => K.byBase.get(n) || []).filter(m => m.visible)); return b.isEmpty() ? null : b.getCenter(new THREE.Vector3()); };
let pulseAnim = null;
function tourGo(i) {
  if (!K.ready) return; const st = TOUR[i]; if (!st) { tourEnd(); return; }
  const prevC = K.tour && K.tour.c ? K.tour.c.clone() : null;
  K.tour = { i }; if (K.side !== st.side) { K.side = st.side; document.querySelectorAll('.ku-bar [data-side]').forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute('data-side') === st.side))); applyVis(); }
  highlight(st.on); K.sel = st.on[0]; paintCard(); paintList();
  const ms = st.on.flatMap(n => K.byBase.get(n) || []).filter(m => m.visible);
  frame(st.side === 'b' ? vis().filter(m => (S[m.userData.base] || {}).g === 'merkez' || /Pons|Midbrain|Medulla/.test(m.userData.base)) : ms.concat((K.byBase.get('Cochlea') || []).filter(m => m.visible)), st.side === 'b' ? 1.25 : 2.4);
  const c = centerOf(st.on); K.tour.c = c;
  if (c) {
    const a = prevC && prevC.distanceTo(c) < 0.25 ? prevC : c, t0 = performance.now(), sz = st.side === 'b' ? 0.0028 : 0.0007;
    pulse.visible = true; pulse.scale.setScalar(sz);
    pulseAnim = t => { const u = ((t - t0) % 1600) / 1600; pulse.position.lerpVectors(a, c, Math.min(1, u * 1.6)); pulse.material.opacity = 0.95 - Math.max(0, u - 0.6) * 2; };
  }
  el.tour.hidden = false;
  el.tour.innerHTML = '<span class="k">sesin yolculuğu · ' + (i + 1) + '/' + TOUR.length + '</span><h3>' + X(st.t) + '</h3><p>' + X(st.p) + '</p><div class="row"><button type="button" class="btn" data-tour="prev"' + (i ? '' : ' disabled') + '>Geri</button><button type="button" class="btn" data-tour="end">Bitir</button><button type="button" class="btn pri" data-tour="next">' + (i === TOUR.length - 1 ? 'Bitir' : 'İleri') + '</button></div>';
  OL.bridgeSend && OL.bridgeSend();
}
function tourEnd() { K.tour = null; el.tour.hidden = true; pulse.visible = false; pulseAnim = null; highlight(K.sel ? [K.sel] : []); need = true; }
el.tour.addEventListener('click', e => { const b = e.target.closest('[data-tour]'); if (!b || !K.tour) return; const a = b.getAttribute('data-tour'); if (a === 'next') tourGo(K.tour.i + 1); else if (a === 'prev') tourGo(K.tour.i - 1); else tourEnd(); });

/* ---------- spot sınav ---------- */
const norm = s => String(s || '').toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const lev = (a, b) => { const m = a.length, n = b.length; if (!m || !n) return m + n; const d = Array.from({ length: m + 1 }, (_, i) => [i]); for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; };
export const isCorrect = (k, ans) => { const a = norm(ans); if (a.length < 3) return false; const keys = [S[k].tr, S[k].la].concat(S[k].ad).map(norm); return keys.some(x => x === a || (a.length >= 5 && x.includes(a)) || (x.length >= 5 && a.includes(x)) || lev(x, a) <= (x.length > 8 ? 2 : 1)); };
function spotStart() {
  if (!K.ready) return; tourEnd();
  const pool = SPOTABLE.filter(k => K.byBase.has(k)).sort(() => Math.random() - 0.5).slice(0, 8);
  K.spot = { q: pool, i: 0, res: [] }; K.spotRes = null; spotAsk();
}
function spotAsk() {
  const sp = K.spot, k = sp.q[sp.i]; if (!k) { spotEnd(); return; }
  const info = S[k], side = info.g === 'merkez' || k === 'Vestibular nuclei' ? 'b' : (Math.random() < 0.5 ? 'r' : 'l');
  K.side = side; applyVis(); K.sel = null; el.card.hidden = true; highlight([k]);
  frame((K.byBase.get(k) || []).filter(m => m.visible), side === 'b' ? 3.5 : 3.6);
  el.spot.hidden = false;
  el.spot.innerHTML = '<span class="k">spot sınav · ' + (sp.i + 1) + '/' + sp.q.length + '</span><div style="font-weight:700">Işıklanan yapının adı ne?</div><form id="ku-sf" autocomplete="off"><input id="ku-si" aria-label="Yapının adı" placeholder="Türkçe ya da Latince" enterkeyhint="send"><button class="btn pri">Cevapla</button><button type="button" class="btn" id="ku-skip">Atla</button></form>';
  const f = $('#ku-sf'), inp = $('#ku-si'); setTimeout(() => inp.focus(), 50);
  const go = ans => { sp.res.push({ k, ok: isCorrect(k, ans), ans }); sp.i++; spotAsk(); };
  f.addEventListener('submit', e => { e.preventDefault(); go(inp.value); });
  $('#ku-skip').addEventListener('click', () => go(''));
  OL.bridgeSend && OL.bridgeSend();
}
function spotEnd() {
  const r = K.spot.res, ok = r.filter(x => x.ok).length;
  K.spotRes = r.map(x => ({ tr: S[x.k].tr, la: S[x.k].la, ok: x.ok, ans: String(x.ans || '').slice(0, 80) }));
  K.spot = null; highlight([]);
  el.spot.innerHTML = '<span class="k">spot sınav bitti</span><div style="font-weight:800;font-size:18px">' + ok + ' / ' + r.length + ' doğru</div><ul style="margin:6px 0;padding-left:18px;font-size:13.5px">' + r.map(x => '<li>' + (x.ok ? '✓ ' : '✗ ') + X(S[x.k].tr) + ' <i style="color:var(--muted)">(' + X(S[x.k].la) + ')</i>' + (x.ok || !x.ans ? '' : ' · senin cevabın: ' + X(x.ans)) + '</li>').join('') + '</ul><div class="row" style="gap:8px"><button type="button" class="btn pri" id="ku-again">Yeni tur</button><button type="button" class="btn" id="ku-close">Kapat</button></div>';
  $('#ku-again').onclick = spotStart; $('#ku-close').onclick = () => { el.spot.hidden = true; K.spotRes = null; OL.bridgeSend && OL.bridgeSend(); };
  OL.bridgeSend && OL.bridgeSend();
  setTimeout(() => { K.spotRes = null; }, 500);
}

/* ---------- köprü arayüzü ---------- */
OL.kulak = {
  async start() {
    if (K.started) return; K.started = true;
    if (!init()) return;
    try { await build(); } catch (e) { el.load.innerHTML = '<div class="ku-msg"><b>3B kulak verisi yüklenemedi.</b><br>Bağlantını kontrol edip sayfayı yenile.</div>'; return; }
    K.ready = true; el.load.remove(); applyVis(); paintList();
    const all = vis().filter(m => (S[m.userData.base] || {}).g !== 'baglam' || m.userData.base === 'Temporal bone');
    const b = boxOf(all), c = b.getCenter(new THREE.Vector3()); controls.target.copy(c); camera.position.copy(c).add(new THREE.Vector3(0.06, 0.02, 0.03)); setSide('r');
  },
  ctx() {
    const o = { sel: null, chips: [], spot: !!K.spot, spotRes: K.spotRes };
    if (K.sel && S[K.sel] && !K.spot) {
      const s = S[K.sel];
      o.sel = { key: 'kulak.' + K.sel, title: '3B Kulak · ' + s.tr, la: s.la, rows: [['İşlev', s.is], ['Klinik', s.kl]], about: 'öğrenci 3B kulak modelinde "' + s.tr + '" (' + s.la + ') yapısına bakıyor.' };
      o.chips = [['islev', 'Bu yapı ne işe yarar?'], ['klinik', 'Klinikte neden önemli?'], ['yol', 'Sesin yolculuğunu başlat']];
    } else if (!K.spot) o.chips = [['yol', 'Sesin yolculuğunu başlat']];
    return o;
  },
  classify(q) { if (/yolculu|ses nasıl|yol(u|unu)? göster/.test(q)) return 'yol'; if (/klinik|hastal|neden önemli/.test(q)) return 'klinik'; if (/ne işe|işlev|görev|ne yapar/.test(q)) return 'islev'; return null; },
  answer(kind) {
    if (kind === 'yol') return 'Sesin yolculuğunu başlattım: kulak zarından işitme korteksine dokuz adım. Alttaki kutudan ilerleyebilirsin.';
    const s = S[K.sel]; if (!s) return null;
    if (kind === 'islev') return s.tr + ' (' + s.la + '): ' + s.is;
    if (kind === 'klinik') return s.kl && s.kl !== '—' ? s.tr + ' klinikte: ' + s.kl : null;
    return null;
  },
  show(n) { const b = base(String(n || '')); if (S[b]) { this.start().then(() => select(b)); } },
  spot() { this.start().then(spotStart); },
  tour() { this.start().then(() => tourGo(0)); },
  _S: S, _isCorrect: isCorrect
};
document.querySelectorAll('.ku-bar [data-side]').forEach(b => b.addEventListener('click', () => { if (K.ready && !K.spot) { tourEnd(); setSide(b.getAttribute('data-side')); } }));
$('#ku-bone').addEventListener('change', e => { K.bone = e.target.checked; applyVis(); });
$('#ku-tour-b').addEventListener('click', () => OL.kulak.tour());
$('#ku-spot-b').addEventListener('click', () => OL.kulak.spot());
if (OL.kulakWanted || document.getElementById('kulak').classList.contains('on')) OL.kulak.start();
