# Video 3 · Claude Rebuild (34s, 1080×1920, 60fps)

Source for `dl/Jerry-Video3-Claude-Rebuild.mp4`. Credit for the original reel: @nexusboxlab (Instagram).

- `sim2.js`: deterministic piston simulation (seed 2). Two pistons slam together; a ball hit or squeezed by a piston (against the other piston or the wall) splits in two until the arena holds 1400 balls.
- `render.html`: draws every frame (Jerry layout, titles, panels, terminal, arena).
- `capture.js`: renders all frames headless with Playwright, pipes them into ffmpeg, then muxes audio.
- `audio.js`: synthesizes the soundtrack from simulation events.

Render (needs `profile.jpg`, the screenshot of the @nexusboxlab profile, next to these files):

    node capture.js out.mp4

The left panel uses the original reel (screen recording) at 1.5× speed. Extract frames and pass the folder:

    ffmpeg -ss 0.3 -i original.mov -vf "setpts=PTS/1.5,fps=60,crop=480:700:0:200,scale=640:-2" -q:v 3 frames/f_%05d.jpg
    node capture.js out.mp4 frames
