// Renders render.html frame by frame into an MP4, then builds the soundtrack from sim events.
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const FPS = 60, DUR = 60, N = FPS * DUR;
const out = process.argv[2] || 'out.mp4';
const leftDir = process.argv[3]; // optional: folder of left-panel frames f_00001.jpg... (60fps, starting at video t=3.4s)
(async () => {
  const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file://' + path.resolve('render.html'));
  await p.evaluate(() => window.ready);
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', String(FPS), 'video_only.mp4'], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    if (leftDir) {
      const t = i / FPS, k = Math.floor((t - 3.4) * FPS) + 1;
      const files = fs.readdirSync(leftDir).length;
      const f = path.resolve(leftDir, `f_${String(((Math.max(k, 1) - 1) % files) + 1).padStart(5, '0')}.jpg`);
      await p.evaluate(src => new Promise(r => { const im = new Image(); im.onload = () => { window.leftImg = im; r(); }; im.src = 'file://' + src; }), f);
    }
    const d = await p.evaluate(i => { window.renderFrame(i); return document.getElementById('c').toDataURL('image/jpeg', 0.93); }, i);
    if (!ff.stdin.write(Buffer.from(d.slice(d.indexOf(',') + 1), 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 600 === 0) console.log(`frame ${i}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  const events = await p.evaluate(() => window.simEvents);
  fs.writeFileSync('events.json', JSON.stringify(events));
  await b.close();
  execFileSync('node', ['audio.js', 'events.json', 'audio.wav'], { stdio: 'inherit' });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', 'video_only.mp4', '-i', 'audio.wav', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
  console.log('done', out, ((Date.now() - t0) / 1000).toFixed(0) + 's');
})();
