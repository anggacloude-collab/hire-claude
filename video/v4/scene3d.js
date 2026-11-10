// 3D "chain-mail drop" scene: a verlet cloth rendered as chrome chain links drops onto a marble ball on a stone box.
import * as THREE from 'three';
import { RoomEnvironment } from './node_modules/three/examples/jsm/environments/RoomEnvironment.js';

const W = 940, H = 1000;
const BALL = { x: 0, y: 2.22, z: 0, r: 0.8 };
const BOX = { hw: 0.95, top: 1.9 };
const CLOTH = 3.3;            // cloth side length
const G = -9.8;

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function createScene() {
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.85;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  // warm studio backdrop
  scene.background = canvasTex(512, 512, (g, w, h) => {
    const gr = g.createRadialGradient(w * 0.5, h * 0.42, 20, w * 0.5, h * 0.5, w * 0.78);
    gr.addColorStop(0, '#B08A5A'); gr.addColorStop(0.55, '#7A5934'); gr.addColorStop(1, '#3A2916');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });

  const camera = new THREE.PerspectiveCamera(31, W / H, 0.1, 100);

  // lights
  const key = new THREE.DirectionalLight(0xfff1dc, 2.6);
  key.position.set(3.5, 7, 4.5); key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536); key.shadow.camera.left = -3; key.shadow.camera.right = 3; key.shadow.camera.top = 4; key.shadow.camera.bottom = -2;
  key.shadow.bias = -0.0004; key.shadow.radius = 4;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffd9a8, 1.2); rim.position.set(-4, 4, -3); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xfff3e0, 0x3a2916, 0.5));

  // floor (shadow catcher)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.35 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  // stone box with an opening on top
  const r = rng(11);
  const stone = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#8C8883'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 120000; i++) { const v = 50 + r() * 170 | 0; g.fillStyle = `rgba(${v},${v - 4},${v - 8},${0.25 + r() * 0.5})`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3); }
  });
  const stoneMat = new THREE.MeshStandardMaterial({ map: stone, roughness: 0.85, metalness: 0 });
  const innerMat = new THREE.MeshStandardMaterial({ map: stone, roughness: 0.9, color: 0x77736e });
  const wall = 0.26, hw = BOX.hw, top = BOX.top;
  const box = new THREE.Group();
  for (const [x, z, sx, sz] of [[0, hw - wall / 2, hw * 2, wall], [0, -hw + wall / 2, hw * 2, wall], [hw - wall / 2, 0, wall, hw * 2 - 2 * wall], [-hw + wall / 2, 0, wall, hw * 2 - 2 * wall]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, top, sz), stoneMat); m.position.set(x, top / 2, z); m.castShadow = m.receiveShadow = true; box.add(m);
  }
  const inner = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 - 2 * wall, 0.05, hw * 2 - 2 * wall), innerMat); inner.position.y = top - 0.7; inner.receiveShadow = true; box.add(inner);
  scene.add(box);

  // red marble ball
  const marble = canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = '#A3101F'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 140; k++) {
      g.strokeStyle = `rgba(${255},${120 + r() * 80 | 0},${130 + r() * 60 | 0},${0.05 + r() * 0.18})`; g.lineWidth = 0.5 + r() * 2.5;
      g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y);
      for (let s = 0; s < 14; s++) { x += (r() - 0.5) * 70; y += (r() - 0.5) * 40; g.lineTo(x, y); } g.stroke();
    }
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(40,0,6,${r() * 0.25})`; g.fillRect(r() * w, r() * h, 2, 2); }
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL.r, 96, 64),
    new THREE.MeshPhysicalMaterial({ map: marble, roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06 }));
  ball.position.set(BALL.x, BALL.y, BALL.z); ball.castShadow = ball.receiveShadow = true; scene.add(ball);

  // chain material (chrome -> gold)
  const chainMat = new THREE.MeshStandardMaterial({ color: 0xAEB4BC, metalness: 1, roughness: 0.28, envMapIntensity: 1.0 });
  const CHROME = new THREE.Color(0xAEB4BC), GOLD = new THREE.Color(0xFFC35A);

  const S = { canvas, renderer, scene, camera, cloth: null, t: 0, faces: 0, gold: 0, goldTarget: 0 };

  // ---------- cloth ----------
  function makeCloth(n, seed) {
    const np = n + 1, N = np * np, sp = CLOTH / n;
    const pos = new Float32Array(N * 3), prev = new Float32Array(N * 3);
    const rr = rng(seed), tilt = (rr() - 0.5) * 0.25, tilt2 = (rr() - 0.5) * 0.25, off = (rr() - 0.5) * 0.12;
    for (let j = 0; j < np; j++) for (let i = 0; i < np; i++) {
      const k = (j * np + i) * 3, x = -CLOTH / 2 + i * sp + off, z = -CLOTH / 2 + j * sp;
      pos[k] = x; pos[k + 1] = 4.6 + x * tilt + z * tilt2; pos[k + 2] = z;
      prev[k] = x; prev[k + 1] = pos[k + 1] + 0.004; prev[k + 2] = z;
    }
    const edges = [];
    for (let j = 0; j < np; j++) for (let i = 0; i < np; i++) {
      const a = j * np + i;
      if (i < n) edges.push(a, a + 1);
      if (j < n) edges.push(a, a + np);
    }
    const E = new Uint32Array(edges), ne = E.length / 2;
    const linkR = Math.max(0.0042, Math.min(0.045, sp * (n > 100 ? 0.14 : 0.2)));
    const cyl = new THREE.CylinderGeometry(1, 1, 1, n > 70 ? 4 : n > 40 ? 6 : 8, 1, true);
    const links = new THREE.InstancedMesh(cyl, chainMat, ne); links.castShadow = true; links.receiveShadow = true;
    const knots = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, n > 40 ? 0 : 1), chainMat, N); knots.castShadow = false;
    links.frustumCulled = knots.frustumCulled = false;
    scene.add(links); if (n <= 64) scene.add(knots);
    const iters = Math.max(6, Math.round(n / 5));
    return { n, np, N, sp, pos, prev, E, ne, linkR, links, knots, iters, age: 0 };
  }
  function disposeCloth(c) {
    scene.remove(c.links); scene.remove(c.knots);
    c.links.geometry.dispose(); c.knots.geometry.dispose(); c.links.dispose(); c.knots.dispose();
  }

  function collide(c) {
    const p = c.pos, q = c.prev, th = c.linkR * 1.6 + 0.01;
    for (let i = 0; i < c.N; i++) {
      const k = i * 3; let x = p[k], y = p[k + 1], z = p[k + 2];
      // ball
      const dx = x - BALL.x, dy = y - BALL.y, dz = z - BALL.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz), R = BALL.r + th;
      if (d < R) {
        const s = R / d; x = BALL.x + dx * s; y = BALL.y + dy * s; z = BALL.z + dz * s;
        // friction: damp tangential motion so the net grips the ball
        q[k] = x + (q[k] - x) * 0.25 + (x - p[k]) * 0; q[k + 1] = y + (q[k + 1] - y) * 0.25; q[k + 2] = z + (q[k + 2] - z) * 0.25;
        q[k] = p[k] + (q[k] - p[k]); // keep
      }
      // box (solid block below the top)
      const bh = BOX.hw + th;
      if (y < BOX.top + th && Math.abs(x) < bh && Math.abs(z) < bh) {
        const py = BOX.top + th - y, px = bh - Math.abs(x), pz = bh - Math.abs(z);
        if (py < px && py < pz) { y = BOX.top + th; q[k] = x + (q[k] - x) * 0.4; q[k + 2] = z + (q[k + 2] - z) * 0.4; }
        else if (px < pz) x = Math.sign(x) * bh; else z = Math.sign(z) * bh;
      }
      if (y < th) { y = th; q[k] = x + (q[k] - x) * 0.3; q[k + 2] = z + (q[k + 2] - z) * 0.3; }
      p[k] = x; p[k + 1] = y; p[k + 2] = z;
    }
  }

  function stepCloth(c, dt) {
    const p = c.pos, q = c.prev, g = G * dt * dt, damp = 0.993;
    for (let i = 0; i < c.N * 3; i += 3) {
      const x = p[i], y = p[i + 1], z = p[i + 2];
      p[i] += (x - q[i]) * damp; p[i + 1] += (y - q[i + 1]) * damp + g; p[i + 2] += (z - q[i + 2]) * damp;
      q[i] = x; q[i + 1] = y; q[i + 2] = z;
    }
    const E = c.E, rest = c.sp;
    for (let it = 0; it < c.iters; it++) {
      for (let e = 0; e < E.length; e += 2) {
        const a = E[e] * 3, b = E[e + 1] * 3;
        const dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        if (d <= rest) continue;                 // chain: resists stretch only
        const f = (d - rest) / d * 0.5;
        p[a] += dx * f; p[a + 1] += dy * f; p[a + 2] += dz * f;
        p[b] -= dx * f; p[b + 1] -= dy * f; p[b + 2] -= dz * f;
      }
      if (it % 2 === 0 || it === c.iters - 1) collide(c);
    }
  }

  const m4 = new THREE.Matrix4(), qn = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), mid = new THREE.Vector3(), scl = new THREE.Vector3();
  function updateMeshes(c) {
    const p = c.pos, E = c.E, r = c.linkR;
    for (let e = 0, k = 0; e < E.length; e += 2, k++) {
      const a = E[e] * 3, b = E[e + 1] * 3;
      v.set(p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]);
      const len = v.length(); v.multiplyScalar(1 / (len || 1));
      qn.setFromUnitVectors(up, v);
      mid.set((p[a] + p[b]) / 2, (p[a + 1] + p[b + 1]) / 2, (p[a + 2] + p[b + 2]) / 2);
      scl.set(r, len, r); m4.compose(mid, qn, scl); c.links.setMatrixAt(k, m4);
    }
    qn.identity(); scl.set(r * 1.7, r * 1.7, r * 1.7);
    if (c.n <= 64) for (let i = 0; i < c.N; i++) { mid.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]); m4.compose(mid, qn, scl); c.knots.setMatrixAt(i, m4); }
    c.links.instanceMatrix.needsUpdate = true; c.knots.instanceMatrix.needsUpdate = true;
  }

  S.drop = function (n, seed) {
    if (S.cloth) disposeCloth(S.cloth);
    S.cloth = makeCloth(n, seed || n * 7 + 3); S.faces = n * n; S.dropT = S.t;
  };
  S.setGold = function () { S.goldTarget = 1; };
  // advance physics by one video frame (1/60 s)
  S.step = function () {
    const sub = 4, dt = 1 / 60 / sub;
    S.t += 1 / 60;
    if (S.cloth) { for (let s = 0; s < sub; s++) stepCloth(S.cloth, dt); S.cloth.age += 1 / 60; }
    S.gold += (S.goldTarget - S.gold) * 0.06;
  };
  S.render = function (t) {
    if (S.cloth) updateMeshes(S.cloth);
    chainMat.color.copy(CHROME).lerp(GOLD, S.gold);
    chainMat.roughness = 0.2 + 0.05 * S.gold;
    const a = 0.32 * Math.sin(t * 0.25) + 0.15, dist = 8.2;
    camera.position.set(Math.sin(a) * dist, 3.55, Math.cos(a) * dist);
    camera.lookAt(0, 1.95, 0);
    renderer.render(scene, camera);
    return canvas;
  };
  return S;
}
