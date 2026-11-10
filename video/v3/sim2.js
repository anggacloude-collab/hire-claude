// Deterministic "piston split" arena: two pistons slam together from left and right.
// A ball squeezed between a piston and the other piston (or the outer wall) splits in two.
(function (root) {
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const COLORS = ['#35D46A', '#9B5CFF', '#FFC83D', '#3B8BFF', '#FF4D8D', '#FF8A2B'];
  const NAMES = ['GREEN', 'PURPLE', 'YELLOW', 'BLUE', 'PINK', 'ORANGE'];

  function createSim(opts) {
    opts = opts || {};
    const R = 1000, SPEED = 480; let BR = opts.br || 16, CAP = opts.cap || 1400;
    const HEAD_W = 150, HEAD_H = opts.headH || 300, ROD_H = 44, GMIN = 4, GMAX = 800;
    const rand = rng(opts.seed || 7);
    const balls = [];
    const S = {
      t: 0, balls, events: [], R, BR, CAP, COLORS, NAMES, counts: COLORS.map(() => 0),
      HEAD_W, HEAD_H, ROD_H, gap: GMAX, splits: 0, slams: 0, full: false, fullTime: 0,
      phase: 0, period: opts.period0 || 2.6, shake: 0, gapV: 2000, vertOn: false, vertAppear: 0, splitCd: 0.35, hitV: opts.hitV || 500, hitP: opts.hitP || 0.6, pressP: opts.pressP || 0.5,
    };
    function add(x, y, vx, vy, c) { const b = { x, y, vx, vy, c, cd: 0.3, flash: 0 }; balls.push(b); S.counts[c]++; return b; }
    for (let c = 0; c < COLORS.length; c++) {
      for (let k = 0; k < (opts.per || 4); k++) {
        const a = rand() * Math.PI * 2, d = 300 + rand() * 550, va = rand() * Math.PI * 2;
        add(Math.cos(a) * d, Math.sin(a) * d * 0.9, Math.cos(va) * SPEED, Math.sin(va) * SPEED, c);
      }
    }
    function split(b, pnx, pny) {
      let px = -pny, py = pnx;              // split perpendicular to the squeeze
      if (Math.abs(pnx) > 0.7 && Math.abs(b.y) > 1) { py = Math.sign(b.y); px = 0; } // pop out of the jaws
      else if (Math.abs(pny) > 0.7 && Math.abs(b.x) > 1) { px = Math.sign(b.x); py = 0; }
      const nb = add(b.x + px * BR, b.y + py * BR, px * SPEED * 1.1, py * SPEED * 1.1, b.c);
      b.x -= px * BR; b.y -= py * BR; b.vx = -px * SPEED * 1.1; b.vy = -py * SPEED * 1.1;
      b.cd = nb.cd = S.splitCd; b.flash = nb.flash = 0.3;
      S.splits++; emit('split', b.c);
    }
    function emit(type, c, mag) { S.events.push({ t: S.t, type, c, mag: mag || 1 }); }

    // piston inner-face offset from centre (the gap is 2*g). Slam: accelerate in, hold, ease back out.
    function pistonG(p) {
      if (p < 0.38) { const k = p / 0.38; return GMAX - (GMAX - GMIN) * k * k; }
      if (p < 0.48) return GMIN;
      const k = (p - 0.48) / 0.52; return GMIN + (GMAX - GMIN) * (k * k * (3 - 2 * k));
    }
    // boxes: [xmin, xmax, ymin, ymax, vx]
    function boxes(g, vg, gv, vgv) {
      const out = [
        [-g - HEAD_W, -g, -HEAD_H / 2, HEAD_H / 2, -vg, 0], [-1200, -g - HEAD_W, -ROD_H / 2, ROD_H / 2, -vg, 0],
        [g, g + HEAD_W, -HEAD_H / 2, HEAD_H / 2, vg, 1], [g + HEAD_W, 1200, -ROD_H / 2, ROD_H / 2, vg, 1],
      ];
      if (S.vertOn) out.push(  // [xmin, xmax, ymin, ymax, vx, id, vy]
        [-HEAD_H / 2, HEAD_H / 2, -gv - HEAD_W, -gv, 0, 2, -vgv], [-ROD_H / 2, ROD_H / 2, -1200 - gv, -gv - HEAD_W, 0, 2, -vgv],
        [-HEAD_H / 2, HEAD_H / 2, gv, gv + HEAD_W, 0, 3, vgv], [-ROD_H / 2, ROD_H / 2, gv + HEAD_W, 1200 + gv, 0, 3, vgv]);
      return out;
    }

    const CELL = (opts.maxBr || 30) * 2.2, GW = Math.ceil((2 * R) / CELL) + 4;
    const grid = new Map();

    function step(dt) {
      S.t += dt;
      if (S.targetBR && Math.abs(S.targetBR - BR) > 0.01) { BR += (S.targetBR - BR) * Math.min(1, dt * 5); S.BR = BR; }
      S.period = Math.max(opts.periodMin || 1.05, (opts.period0 || 2.6) - S.t * (opts.periodRate || 0.04));
      const prevPhase = S.phase;
      S.phase = (S.phase + dt / S.period) % 1;
      if (prevPhase < 0.38 && S.phase >= 0.38) { S.slams++; S.shake = 1; emit('slam', 0); }
      if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 5);
      const gOld = S.gap, g = pistonG(S.phase);
      const vg = (g - gOld) / dt; // >0 opening
      S.gap = g;
      let gv = S.gapV, vgv = 0;
      if (S.vertOn) {
        S.vertAppear = Math.min(1, S.vertAppear + dt / 0.6);
        const pv = (S.phase + 0.5) % 1, pvPrev = (prevPhase + 0.5) % 1;
        if (pvPrev < 0.38 && pv >= 0.38) { S.slams++; S.shake = 1; emit('slam', 0); }
        const a = 1 - S.vertAppear; gv = pistonG(pv) + a * a * 900;
        vgv = (gv - S.gapV) / dt; S.gapV = gv;
      }
      const B = boxes(g, vg, gv, vgv);
      for (let i = 0; i < balls.length; i++) {
        const b = balls[i];
        b.x += b.vx * dt; b.y += b.vy * dt;
        b.cd -= dt; if (b.flash > 0) b.flash -= dt;
        const sp = Math.hypot(b.vx, b.vy) || 1;
        const f = 1 + (SPEED - sp) / sp * Math.min(1, dt * 1.2);
        b.vx *= f; b.vy *= f;
        let pist = -1, pnx = 0, pny = 0, other = false, onx = 0, ony = 0;
        // pistons
        for (const bx of B) {
          const cx = Math.max(bx[0], Math.min(bx[1], b.x)), cy = Math.max(bx[2], Math.min(bx[3], b.y));
          let dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy), nx, ny, pen;
          if (d === 0) { // centre inside the box: push out along the shortest axis
            const l = b.x - bx[0], r = bx[1] - b.x, dn = b.y - bx[2], up = bx[3] - b.y, m = Math.min(l, r, dn, up);
            if (m === l) { nx = -1; ny = 0; } else if (m === r) { nx = 1; ny = 0; } else if (m === dn) { nx = 0; ny = -1; } else { nx = 0; ny = 1; }
            pen = m + BR;
          } else { if (d >= BR) continue; nx = dx / d; ny = dy / d; pen = BR - d; }
          b.x += nx * pen; b.y += ny * pen;
          const bvy = bx[6] || 0, rvx = b.vx - bx[4], rvy = b.vy - bvy, vn = rvx * nx + rvy * ny;
          if (vn < 0) { b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny; }
          // a hard hit from the moving piston also splits the ball
          if (bx[4] * nx + bvy * ny > S.hitV && b.cd <= 0 && balls.length < CAP && rand() < S.hitP) { split(b, nx, ny); continue; }
          if (pist >= 0 && bx[5] !== pist) { other = true; onx = nx; ony = ny; }
          else if (pist < 0) { pist = bx[5]; pnx = nx; pny = ny; }
        }
        // outer wall
        const d = Math.hypot(b.x, b.y);
        if (d > R - BR) {
          const nx = -b.x / d, ny = -b.y / d;
          b.x = -nx * (R - BR); b.y = -ny * (R - BR);
          const vn = b.vx * nx + b.vy * ny;
          if (vn < 0) { b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny; }
          if (pist >= 0 && !other) { other = true; onx = nx; ony = ny; }
        }
        // squeeze -> split in two
        if (pist >= 0 && other && pnx * onx + pny * ony < -0.2 && b.cd <= 0 && balls.length < CAP) {
          split(b, pnx, pny);
        }
        b.press = (pist >= 0 && b.cd <= 0) ? [pnx, pny] : null;
      }
      // ball-ball collisions
      grid.clear();
      for (let i = 0; i < balls.length; i++) {
        const b = balls[i], key = Math.floor((b.x + R) / CELL + 2) * GW + Math.floor((b.y + R) / CELL + 2);
        let arr = grid.get(key); if (!arr) { arr = []; grid.set(key, arr); } arr.push(i);
      }
      for (let i = 0; i < balls.length; i++) {
        const a = balls[i], gx = Math.floor((a.x + R) / CELL + 2), gy = Math.floor((a.y + R) / CELL + 2);
        for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
          const arr = grid.get((gx + ox) * GW + gy + oy); if (!arr) continue;
          for (const j of arr) {
            if (j <= i) continue;
            const b = balls[j], dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy, md = BR * 2;
            if (d2 >= md * md || d2 === 0) continue;
            const dd = Math.sqrt(d2), nx = dx / dd, ny = dy / dd, pen = (md - dd) / 2;
            a.x -= nx * pen; a.y -= ny * pen; b.x += nx * pen; b.y += ny * pen;
            const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (rv < 0) { a.vx += rv * nx; a.vy += rv * ny; b.vx -= rv * nx; b.vy -= rv * ny; }
            if (balls.length < CAP && rand() < S.pressP) {
              if (a.press && a.cd <= 0 && nx * a.press[0] + ny * a.press[1] > 0.5) { split(a, a.press[0], a.press[1]); a.press = null; }
              else if (b.press && b.cd <= 0 && -(nx * b.press[0] + ny * b.press[1]) > 0.5) { split(b, b.press[0], b.press[1]); b.press = null; }
            }
          }
        }
      }
      if (!S.full && balls.length >= CAP) { S.full = true; S.fullTime = S.t; emit('full', 0); }
    }
    // live revision: grow the balls and lower the cap so the arena still fills up
    S.addVertical = function () { S.vertOn = true; };
    S.setBall = function (br, cap) { S.targetBR = br; CAP = cap; S.CAP = cap; };
    S.step = step;
    return S;
  }
  root.createSim = createSim;
  if (typeof module !== 'undefined') module.exports = { createSim };
})(typeof window !== 'undefined' ? window : globalThis);
