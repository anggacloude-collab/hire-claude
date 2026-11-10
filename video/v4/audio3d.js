// Soundtrack for the 3D cloth video: typing, UI blips, whooshes, chain jingles on every landing, a gold shimmer.
const fs = require('fs');
const SR = 44100, DUR = 34, buf = new Float32Array(SR * DUR);
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function tone(t, f, amp, dec, harm = 0.25) {
  const s0 = Math.floor(t * SR), len = Math.floor(dec * 6 * SR);
  for (let i = 0; i < len && s0 + i < buf.length; i++) {
    const x = i / SR, e = Math.exp(-x / dec) * Math.min(1, i / 40);
    buf[s0 + i] += amp * e * (Math.sin(2 * Math.PI * f * x) + harm * Math.sin(4 * Math.PI * f * x));
  }
}
const click = (t, amp, f = 2400) => tone(t, f, amp, 0.006, 0.6);
function whoosh(t, amp = 0.18, len = 0.45) {
  const s0 = Math.floor(t * SR), L = Math.floor(len * SR); let lp = 0;
  for (let i = 0; i < L && s0 + i < buf.length; i++) { const x = i / L, env = Math.sin(Math.PI * x) ** 2; lp += ((rnd() * 2 - 1) - lp) * (0.05 + 0.25 * x); buf[s0 + i] += amp * env * lp; }
}
// metallic chain jingle: many tiny high pings spread over ~0.6s, denser for finer nets
function jingle(t, count, amp) {
  for (let k = 0; k < count; k++) {
    const dt = Math.pow(rnd(), 1.8) * 0.65, f = 2600 + rnd() * 5200;
    tone(t + dt, f, amp * (0.4 + rnd() * 0.6) * Math.exp(-dt * 3), 0.012 + rnd() * 0.02, 0.15);
  }
}
const typing = (a, b) => { for (let t = a; t < b; t += 0.035 + 0.015 * Math.abs(Math.sin(t * 37))) click(t, 0.06, 3000 + 800 * Math.sin(t * 91)); };
// hook
tone(1.7, 880, 0.15, 0.08); tone(1.78, 1318.5, 0.15, 0.12);
// first prompt
typing(3.3, 4.8);
[5.0, 5.3, 5.6, 5.9, 6.2].forEach(t => tone(t, 1046.5, 0.08, 0.04));
tone(6.5, 1318.5, 0.12, 0.12); tone(6.6, 1568, 0.12, 0.15);
// drops: whoosh on release, jingle on landing (~0.55s later)
for (const [t, n] of [[7.0, 4], [8.5, 8], [10.0, 16], [11.5, 32], [13.0, 64], [18.6, 128]]) {
  whoosh(t, 0.12, 0.5);
  const lvl = Math.log2(n) - 1;       // 1..6
  jingle(t + 0.55, 14 + lvl * 14, 0.05 + 0.006 * lvl);
  tone(t + 0.55, 90, 0.18, 0.08, 0.1); // soft thud
}
// live fixes
for (const [ty, ed, dn] of [[16.9, 17.9, 18.4], [21.9, 22.9, 23.4]]) {
  typing(ty, ed - 0.15); tone(ed, 1046.5, 0.08, 0.04); tone(dn, 1318.5, 0.12, 0.12); tone(dn + 0.1, 1568, 0.12, 0.15);
}
// gold shimmer
for (let k = 0; k < 7; k++) tone(23.45 + k * 0.06, [1568, 1760, 2093, 2349, 2637, 3136, 3520][k], 0.07, 0.25, 0.2);
// scene whooshes
for (const t of [2.85, 6.9, 16.4, 21.4, 28.0, 31.0]) whoosh(t);
// limiter + fade
let peak = 0; for (const v of buf) peak = Math.max(peak, Math.abs(v));
const g = 0.9 / Math.max(0.3, Math.tanh(peak));
const pcm = Buffer.alloc(buf.length * 2);
for (let i = 0; i < buf.length; i++) {
  const fade = Math.min(1, (buf.length - i) / (SR * 0.6));
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, Math.tanh(buf[i]) * g * fade)) * 32767), i * 2);
}
const h = Buffer.alloc(44);
h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28);
h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
fs.writeFileSync(process.argv[2] || 'audio.wav', Buffer.concat([h, pcm]));
console.log('audio peak', peak.toFixed(2));
