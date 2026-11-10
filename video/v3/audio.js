// Synthesizes the soundtrack: soft pings for spawns/conversions, typing ticks, UI blips, a win chord.
const fs = require('fs');
const [,, evFile, outFile] = process.argv;
const SR = 44100, DUR = 60, buf = new Float32Array(SR * DUR);
const NOTES = [523.25, 659.25, 783.99, 880.0]; // C5 E5 G5 A5 per color
function tone(t, f, amp, dec, harm = 0.25) {
  const s0 = Math.floor(t * SR), len = Math.floor(dec * 6 * SR);
  for (let i = 0; i < len && s0 + i < buf.length; i++) {
    const x = i / SR, e = Math.exp(-x / dec) * Math.min(1, i / 40);
    buf[s0 + i] += amp * e * (Math.sin(2 * Math.PI * f * x) + harm * Math.sin(4 * Math.PI * f * x));
  }
}
function click(t, amp, f = 2400) { tone(t, f, amp, 0.006, 0.6); }
const ev = JSON.parse(fs.readFileSync(evFile));
// bucket events per 1/60s frame, cap density so it stays pleasant
const byFrame = new Map();
for (const e of ev) { const k = Math.floor(e.t * 60); if (!byFrame.has(k)) byFrame.set(k, []); byFrame.get(k).push(e); }
for (const [k, list] of byFrame) {
  const t = k / 60;
  const spawns = list.filter(e => e.type === 'spawn'), conv = list.filter(e => e.type === 'convert'), arc = list.filter(e => e.type === 'arc');
  spawns.slice(0, 2).forEach((e, j) => tone(t + j * 0.004, NOTES[e.c] * 2, 0.07, 0.07));
  if (conv.length) { const e = conv[0]; tone(t, NOTES[e.c], 0.05 * Math.min(2.2, 1 + Math.log10(conv.length)), 0.05, 0.5); }
  if (arc.length && k % 2 === 0) click(t, 0.025 * Math.min(2, arc.length), 1500);
  const win = list.find(e => e.type === 'win');
  if (win) [0, 0.09, 0.18, 0.3].forEach((d, j) => tone(t + d, NOTES[j % 4] * (j === 3 ? 2 : 1), 0.22, 0.5, 0.3));
}
// typing ticks while the prompt is typed (3.4s - 6.4s)
for (let t = 3.4; t < 6.4; t += 0.035 + 0.02 * Math.abs(Math.sin(t * 37))) click(t, 0.06, 3000 + 800 * Math.sin(t * 91));
// step lines blips
[6.9, 7.4, 7.9, 8.4, 8.9].forEach(t => tone(t, 1046.5, 0.08, 0.04));
tone(9.4, 1318.5, 0.12, 0.12); tone(9.5, 1568, 0.12, 0.15);
// whooshes on scene changes (filtered noise)
let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
for (const t of [2.85, 9.9, 52.0, 57.0]) {
  const s0 = Math.floor(t * SR), len = Math.floor(0.45 * SR); let lp = 0;
  for (let i = 0; i < len; i++) { const x = i / len, env = Math.sin(Math.PI * x) ** 2; lp += (rnd() - lp) * (0.05 + 0.25 * x); buf[s0 + i] += 0.18 * env * lp; }
}
// hook "pop" when the view counter gets highlighted
tone(1.7, 880, 0.15, 0.08); tone(1.78, 1318.5, 0.15, 0.12);
// soft limiter + fade out
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
fs.writeFileSync(outFile, Buffer.concat([h, pcm]));
console.log('audio peak', peak.toFixed(2), 'events', ev.length);
