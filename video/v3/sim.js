// Deterministic "color takeover" arena simulation.
// Works in Node (for tuning / audio events) and in the browser (for rendering).
(function (root) {
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const COLORS = ['#35D46A', '#9B5CFF', '#FFC83D', '#3B8BFF'];
  const NAMES = ['GREEN', 'PURPLE', 'YELLOW', 'BLUE'];

  function createSim(opts) {
    opts = opts || {};
    const R = 1000, BR = 19, CAP = opts.cap || 760;
    const ARC_R = 430, ARC_HT = 16, ARC_SPAN = Math.PI * 1.15;
    const SPEED = 520;
    const rand = rng(opts.seed || 7);
    const balls = [];
    const S = { t: 0, balls, arcAngle: 0, arcOmega: 0.9, events: [], winner: -1, R, BR, ARC_R, ARC_HT, ARC_SPAN, COLORS, NAMES, counts: [0, 0, 0, 0] };

    function add(x, y, vx, vy, c) {
      balls.push({ x, y, vx, vy, c, cd: 0.5, flash: 0 });
      S.counts[c]++;
    }
    for (let c = 0; c < 4; c++) {
      for (let k = 0; k < 2; k++) {
        const a = c * Math.PI / 2 + Math.PI / 4 + (k - 0.5) * 0.35;
        const d = 760;
        const va = rand() * Math.PI * 2;
        add(Math.cos(a) * d, Math.sin(a) * d, Math.cos(va) * SPEED, Math.sin(va) * SPEED, c);
      }
    }

    const CELL = BR * 2.2, GW = Math.ceil((2 * R) / CELL) + 2;
    const grid = new Map();

    function emit(type, c, mag) { S.events.push({ t: S.t, type, c, mag: mag || 1 }); }

    function convertProb() {
      // ramps up over time so the battle resolves near the end of the split-screen section
      const t = S.t;
      if (t < 8) return 0.0;
      if (t < 36) return 0.03 + (t - 8) * 0.002;
      return 0.086 + (t - 36) * 0.05;
    }

    function step(dt) {
      S.t += dt;
      // spinning arc speeds up over time
      S.arcOmega = 0.9 + Math.min(S.t, 42) * 0.05;
      S.arcAngle += S.arcOmega * dt;
      const n = balls.length;
      for (let i = 0; i < n; i++) {
        const b = balls[i];
        b.x += b.vx * dt; b.y += b.vy * dt;
        b.cd -= dt; if (b.flash > 0) b.flash -= dt;
        // keep a lively constant speed
        const sp = Math.hypot(b.vx, b.vy) || 1;
        const f = 1 + (SPEED - sp) / sp * Math.min(1, dt * 1.5);
        b.vx *= f; b.vy *= f;
        // outer wall
        const d = Math.hypot(b.x, b.y);
        if (d > R - BR) {
          const nx = b.x / d, ny = b.y / d;
          b.x = nx * (R - BR); b.y = ny * (R - BR);
          const vn = b.vx * nx + b.vy * ny;
          if (vn > 0) {
            b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny;
            if (balls.length < CAP && b.cd <= 0) {
              b.cd = 1.3;
              const ta = Math.atan2(b.vy, b.vx) + (rand() - 0.5) * 1.2;
              add(nx * (R - BR * 3.2), ny * (R - BR * 3.2), Math.cos(ta) * SPEED, Math.sin(ta) * SPEED, b.c);
              balls[balls.length - 1].flash = 0.25;
              emit('spawn', b.c);
            } else if (vn > 200) {
              emit('wall', b.c, Math.min(1, vn / SPEED));
            }
          }
        }
        // rotating arc (a thick C-shaped ring)
        const r = Math.hypot(b.x, b.y);
        if (Math.abs(r - ARC_R) < BR + ARC_HT + 2) {
          let th = Math.atan2(b.y, b.x) - S.arcAngle;
          th = ((th % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
          if (th < ARC_SPAN) {
            const nx = b.x / r, ny = b.y / r;
            const side = r > ARC_R ? 1 : -1;
            const pen = BR + ARC_HT - Math.abs(r - ARC_R);
            if (pen > 0) {
              b.x += nx * side * pen; b.y += ny * side * pen;
              // relative velocity vs moving arc surface
              const ux = -S.arcOmega * b.y, uy = S.arcOmega * b.x;
              const rvx = b.vx - ux, rvy = b.vy - uy;
              const vn = (rvx * nx + rvy * ny) * side;
              if (vn < 0) {
                b.vx -= 2 * vn * nx * side; b.vy -= 2 * vn * ny * side;
                if (-vn > 250) emit('arc', b.c, Math.min(1, -vn / SPEED));
              }
            }
          }
          // end caps
          for (const ea of [S.arcAngle, S.arcAngle + ARC_SPAN]) {
            const ex = Math.cos(ea) * ARC_R, ey = Math.sin(ea) * ARC_R;
            const dx = b.x - ex, dy = b.y - ey, dd = Math.hypot(dx, dy);
            if (dd < BR + ARC_HT && dd > 0) {
              const nx = dx / dd, ny = dy / dd;
              b.x = ex + nx * (BR + ARC_HT); b.y = ey + ny * (BR + ARC_HT);
              const vn = b.vx * nx + b.vy * ny;
              if (vn < 0) { b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny; }
            }
          }
        }
      }
      // ball-ball collisions via uniform grid
      grid.clear();
      for (let i = 0; i < balls.length; i++) {
        const b = balls[i];
        const gx = Math.floor((b.x + R) / CELL), gy = Math.floor((b.y + R) / CELL);
        const key = gx * GW + gy;
        let arr = grid.get(key); if (!arr) { arr = []; grid.set(key, arr); }
        arr.push(i);
      }
      const pc = convertProb();
      const total = balls.length;
      for (let i = 0; i < balls.length; i++) {
        const a = balls[i];
        const gx = Math.floor((a.x + R) / CELL), gy = Math.floor((a.y + R) / CELL);
        for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
          const arr = grid.get((gx + ox) * GW + gy + oy); if (!arr) continue;
          for (const j of arr) {
            if (j <= i) continue;
            const b = balls[j];
            const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy, md = BR * 2;
            if (d2 >= md * md || d2 === 0) continue;
            const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, pen = (md - d) / 2;
            a.x -= nx * pen; a.y -= ny * pen; b.x += nx * pen; b.y += ny * pen;
            const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (rv < 0) {
              a.vx += rv * nx; a.vy += rv * ny; b.vx -= rv * nx; b.vy -= rv * ny;
              if (a.c !== b.c && pc > 0 && rand() < pc) {
                // bigger team tends to win the contact -> snowball to one winner
                const ex = S.t < 36 ? 0.4 : 2.5;
                const wa = Math.pow(S.counts[a.c] / total, ex), wb = Math.pow(S.counts[b.c] / total, ex);
                const loser = rand() < wa / (wa + wb) ? b : a, winner = loser === a ? b : a;
                S.counts[loser.c]--; S.counts[winner.c]++;
                loser.c = winner.c; loser.flash = 0.3;
                emit('convert', winner.c);
              }
            }
          }
        }
      }
      if (S.winner < 0) {
        for (let c = 0; c < 4; c++) if (S.counts[c] === balls.length && balls.length >= CAP) { S.winner = c; S.winTime = S.t; emit('win', c); }
      }
    }
    S.step = step;
    return S;
  }
  root.createSim = createSim;
  if (typeof module !== 'undefined') module.exports = { createSim };
})(typeof window !== 'undefined' ? window : globalThis);
