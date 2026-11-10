// Parallel renderer: W browser workers each render every W-th pair of frames to JPEGs, then ffmpeg + audio.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const FPS = 60, DUR = 34, N = FPS * DUR, W = +(process.env.W || 4);
const out = process.argv[2] || 'out.mp4', leftDir = path.resolve('leftframes');
const leftCount = fs.readdirSync(leftDir).length;
fs.rmSync('frames', { recursive: true, force: true }); fs.mkdirSync('frames');
async function worker(w) {
  const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('pageerror', e => console.log('ERR', w, e.message));
  await p.goto('file://' + path.resolve('render.html'));
  await p.waitForFunction(() => window.ready && window.renderFrame);
  await p.evaluate(() => window.ready);
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const mine = ((i >> 1) % W) === w;
    if (!mine) { await p.evaluate(i => window.renderFrame(i, false), i); continue; }
    const t = i / FPS, k = Math.floor((t - 3.4) * FPS) + 1;
    const f = path.join(leftDir, `f_${String(((Math.max(k, 1) - 1) % leftCount) + 1).padStart(5, '0')}.jpg`);
    await p.evaluate(src => new Promise(r => { const im = new Image(); im.onload = () => { window.leftImg = im; r(); }; im.src = 'file://' + src; }), f);
    const d = await p.evaluate(i => { window.renderFrame(i); return document.getElementById('c').toDataURL('image/jpeg', 0.93); }, i);
    fs.writeFileSync(`frames/${String(i).padStart(5, '0')}.jpg`, Buffer.from(d.slice(d.indexOf(',') + 1), 'base64'));
    if (w === 0 && i % 240 === 0) console.log(`worker0 frame ${i}/${N} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  await b.close();
}
(async () => {
  const t0 = Date.now();
  await Promise.all([...Array(W).keys()].map(worker));
  console.log('frames done', ((Date.now() - t0) / 1000).toFixed(0) + 's');
  execFileSync('node', ['audio3d.js', 'audio.wav'], { stdio: 'inherit' });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', 'frames/%05d.jpg', '-i', 'audio.wav',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
  console.log('done', out, ((Date.now() - t0) / 1000).toFixed(0) + 's');
})();
