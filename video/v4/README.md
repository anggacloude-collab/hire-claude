# Video 4 · Claude 3D Cloth (34s, 1080×1920, 60fps)

Source for `dl/Jerry-Video4-Claude-3D-Cloth.mp4`. Credit for the original reel: @morp.hik3d (Instagram).

- `scene3d.js`: Three.js scene. Verlet cloth rendered as instanced chrome chain links, red marble ball, stone box, studio lights and soft shadows.
- `render.html`: draws each frame (Jerry layout, titles, original vs. Claude panels, live-fix chat boxes, face counter).
- `capture4.js`: renders frames with 4 parallel headless browsers (3D at 30fps), then encodes with ffmpeg.
- `audio3d.js`: synthesizes the soundtrack (typing, whooshes, chain jingles, gold shimmer).

Render (needs `profile.jpg` and `leftframes/` from the original screen recording next to these files):

    npm install
    ffmpeg -ss 0.3 -i original.mov -vf "setpts=PTS/1.5,fps=60,crop=480:840:0:40,scale=640:-2" -q:v 3 leftframes/f_%05d.jpg
    node capture4.js out.mp4
