# Video 3 · Claude Rebuild (60s, 1080×1920, 60fps)

Source for `dl/Jerry-Video3-Claude-Rebuild.mp4`. Credit for the original reel: @nexusboxlab (Instagram).

- `sim2.js`: deterministic piston simulation (seed 2). Two pistons slam together; a ball hit or squeezed by a piston (against the other piston or the wall) splits in two until the arena holds 1400 balls.
- `render.html`: draws every frame (Jerry layout, titles, panels, terminal, arena).
- `capture.js`: renders all frames headless with Playwright, pipes them into ffmpeg, then muxes audio.
- `audio.js`: synthesizes the soundtrack from simulation events.

Render (needs `profile.jpg`, the screenshot of the @nexusboxlab profile, next to these files):

    node capture.js out.mp4

To use the real original clip in the left panel, extract frames at 60fps and pass the folder:

    ffmpeg -i original.mp4 -vf fps=60,scale=460:-2 frames/f_%05d.jpg
    node capture.js out.mp4 frames
