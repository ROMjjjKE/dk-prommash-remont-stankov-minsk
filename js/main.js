import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

/* ---------- nav / UI ---------- */
const burger = document.querySelector('.burger');
const nav = document.querySelector('nav');
burger?.addEventListener('click', () => nav.classList.toggle('open'));

const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add('in')), { threshold: .15 });
document.querySelectorAll('.rv').forEach(el => io.observe(el));

// tilt cards
document.querySelectorAll('.card').forEach(c => {
  c.addEventListener('mousemove', e => {
    const r = c.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    c.style.transform = `perspective(900px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateZ(6px)`;
  });
  c.addEventListener('mouseleave', () => c.style.transform = '');
});

/* ---------- 3D: токарный станок / заготовка ---------- */
function buildLathe(scene, big = false) {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa1aa, metalness: .9, roughness: .32 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2d32, metalness: .7, roughness: .55 });
  const hot = new THREE.MeshStandardMaterial({ color: 0xffb81c, metalness: .4, roughness: .35, emissive: 0x552a00, emissiveIntensity: .4 });

  // станина
  const bed = new THREE.Mesh(new THREE.BoxGeometry(5.2, .5, 1.6), dark);
  bed.position.y = -1.6; g.add(bed);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(.4, 1.6, 1.4), dark); legL.position.set(-2.2, -2.4, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 2.2; g.add(legR);

  // шпиндельная бабка
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.8, 1.3), dark);
  head.position.set(-1.9, -.2, 0); g.add(head);

  // патрон
  const chuck = new THREE.Group();
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(.75, .75, .6, 48), hot);
  cyl.rotation.z = Math.PI / 2; chuck.add(cyl);
  for (let i = 0; i < 3; i++) {
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(.5, .25, .18), steel);
    const a = i / 3 * Math.PI * 2;
    jaw.position.set(.38, Math.cos(a) * .48, Math.sin(a) * .48);
    jaw.rotation.x = a; chuck.add(jaw);
  }
  chuck.position.set(-1.1, -.2, 0); g.add(chuck);

  // заготовка (ступенчатый вал) — вращается
  const profile = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const r = t < .5 ? .42 : (t < .8 ? .32 : .52 + Math.sin(t * 12) * .02);
    profile.push(new THREE.Vector2(r, t * 4.2));
  }
  const part = new THREE.Mesh(new THREE.LatheGeometry(profile, 64), steel);
  part.rotation.z = Math.PI / 2; part.position.set(-.8, -.2, 0);
  const wire = new THREE.LineSegments(new THREE.WireframeGeometry(part.geometry),
    new THREE.LineBasicMaterial({ color: 0xffb81c, transparent: true, opacity: .08 }));
  wire.rotation.copy(part.rotation); wire.position.copy(part.position);
  const spindle = new THREE.Group(); spindle.add(part, wire); g.add(spindle);
  g.userData.spindle = spindle; g.userData.chuck = chuck;

  // резец
  const tool = new THREE.Mesh(new THREE.BoxGeometry(.9, .18, .18), hot);
  tool.position.set(1.4, .4, .6); g.add(tool);

  // стружка
  const N = big ? 260 : 140, pos = new Float32Array(N * 3), vel = [];
  const chipGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const chips = new THREE.Points(chipGeo, new THREE.PointsMaterial({ color: 0xffb81c, size: .05, transparent: true, opacity: .9 }));
  for (let i = 0; i < N; i++) { vel.push(new THREE.Vector3()); respawn(i); }
  function respawn(i) {
    pos[i * 3] = 1.3 + Math.random() * .2; pos[i * 3 + 1] = .45 + Math.random() * .1; pos[i * 3 + 2] = .6 + Math.random() * .1;
    vel[i].set(Math.random() * .8 + .3, Math.random() * 1.2 + .4, Math.random() * .6 - .1);
  }
  g.userData.chips = { pts: chips, pos, vel, respawn, N };
  g.add(chips);
  return g;
}

function mountScene(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(38, 1, .1, 100);
  cam.position.set(0, 1.2, 9);
  scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x222222, .9));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(4, 6, 5); scene.add(key);
  const rim = new THREE.PointLight(0xffb81c, 6, 14); rim.position.set(-3, 2, 3); scene.add(rim);

  const lathe = buildLathe(scene, opts.big);
  lathe.scale.setScalar(opts.scale ?? 1);
  scene.add(lathe);

  // сетка пола
  const grid = new THREE.GridHelper(30, 30, 0x2a2d32, 0x1c1f23);
  grid.position.y = -3.1; scene.add(grid);

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  };
  resize(); addEventListener('resize', resize);

  let mx = 0, my = 0;
  if (opts.mouse) addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; });

  const clock = new THREE.Clock();
  let visible = true;
  new IntersectionObserver(([e]) => visible = e.isIntersecting).observe(canvas);

  (function loop() {
    requestAnimationFrame(loop);
    if (!visible) return;
    const t = clock.getElapsedTime();
    lathe.userData.spindle.rotation.x = t * 2.4;
    lathe.userData.chuck.rotation.x = t * 2.4;
    // стружка
    const { pts, pos, vel, respawn, N } = lathe.userData.chips;
    for (let i = 0; i < N; i++) {
      vel[i].y -= .025;
      pos[i * 3] += vel[i].x * .02; pos[i * 3 + 1] += vel[i].y * .02; pos[i * 3 + 2] += vel[i].z * .02;
      if (pos[i * 3 + 1] < -3) respawn(i);
    }
    pts.geometry.attributes.position.needsUpdate = true;
    lathe.rotation.y += ((mx * .5) - lathe.rotation.y) * .03 + Math.sin(t * .4) * .0005;
    lathe.rotation.x += ((my * .2) - lathe.rotation.x) * .03;
    cam.position.x += (mx * 1.2 - cam.position.x) * .03;
    cam.lookAt(0, -.2, 0);
    renderer.render(scene, cam);
  })();
}

const hero = document.getElementById('hero3d');
if (hero) mountScene(hero, { big: true, mouse: true, scale: 1.15 });
['machine3d', 'machine3d2'].forEach((id, i) => {
  const el = document.getElementById(id);
  if (el) mountScene(el, { scale: i ? .95 : 1.05 });
});
