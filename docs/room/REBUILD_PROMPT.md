# Rebuilding the 3D room from your real room

This file has two parts:

1. **Before you start**: the photos and details to gather.
2. **The prompt**: paste everything between the two `=====` lines into a new Claude Code session on this
   repository, then attach your photos in the same message.

---

## 1. Before you start

### Photos (landscape, lights as you normally have them at night, plus a few by day)

| # | Shot | Why |
|---|------|-----|
| 1 | **The hero view**: standing in your doorway, the whole room in frame | The opening camera is matched to this photo |
| 2–5 | **Each wall straight on**, from the opposite side of the room | Positions and sizes of everything |
| 6 | **Each corner**, especially where the desk and bed are | How walls meet, depth |
| 7 | **Ceiling and every light source** (lamps, LED strips, fairy lights, screens) | Lighting design |
| 8 | **Window, from inside**, and **the view out of it**, once by day and once at night | Window view, what the telescope shows |
| 9 | **Desk close-up**, from above and from the chair | Desk objects and interactive props |
| 10 | **Bed, shelves, anything on the walls** (posters, corkboard, photos) | Details and textures |
| 11 | **Any object you want to be clickable**, close up | Interactive props |
| 12 | **The floor and a rug**, if any | Materials |
| 13 | **You at the desk from behind** (optional) and **any pet** (optional) | The figure and the pet |

### Details to type into the message

- **Rough measurements**, from a tape measure or by pacing: room width × depth × ceiling height, window width × height and
  height off the floor, desk length × depth × height, bed size.
- **What's really outside the window**, and whether the telescope should still look at Western (University College,
  Middlesex, Weldon) or something else.
- **What each clickable object should do**: for example, laptop → Projects, corkboard → Experience, phone → Contact,
  bookshelf → Skills, printer → Resume.
- **Anything to leave out**: for example, no cat, no telescope, different radio station text.

---

## 2. The prompt

=====

You are rebuilding an existing interactive three.js room so that it is **my actual bedroom**, recreated from the
photos attached to this message. The current room is a finished, working reference implementation. Keep every system
it has (lighting, animation, telescope, sound, weather, memory, UI) and replace the **room itself** (its shape,
furniture, props, colours and camera framing) to match my photos.

### 0. Setup

- Base your work on the branch that holds the reference implementation:
  `git fetch origin claude/exciting-hopper-kry2e8 && git checkout -B <your designated branch> origin/claude/exciting-hopper-kry2e8`
- Run `npm install`. The room lives at the `/room` route (lazy-loaded; see `src/App.tsx`).
- Read these files fully before changing anything, in this order:
  1. `src/components/room/createRoomScene.ts`: the scene. It holds the renderer and post-processing, the room
     geometry, lighting, views and the telescope sequence, input, the lighting settings, time of day and weather, and
     the animation loop.
  2. `src/components/room/createFigure.ts`: the sculpted seated person (typing, leaning, glances).
  3. `src/components/room/createDetails.ts`: steam, cat, phone notifications, wall clock and radio.
  4. `src/components/room/createCampus.ts`: Western's campus outside, seen only through the telescope, with
     day/night texture pairs and GPU rain and snow.
  5. `src/components/room/createAudio.ts`: all sound, synthesised with Web Audio (rain, wind, thunder, clicks,
     lo-fi radio).
  6. `src/components/room/roomMemory.ts`: remembered settings and the welcome-back note.
  7. `src/pages/Room.tsx` and `src/components/room/LightingPanel.tsx`: the on-screen controls.
  8. `tools/room/screenshot.cjs`, `tools/room/build-standalone.sh`, `tools/room/standalone/*`: checking and previewing.

### 1. First, study the photos and write a room spec. Then stop and ask me to confirm it.

Create `docs/room/MY_ROOM_SPEC.md` containing:

- **Dimensions** in metres (width, depth, ceiling height), taken from my measurements or estimated from the photos
  using known sizes (doors are about 2.0 m, desks about 0.75 m high, a standard single bed is about 0.9 × 1.9 m). Mark
  each value as *measured* or *estimated*.
- **A wall-by-wall inventory**: every object with its position (x, y, z in the scene's convention: metres, y up,
  +z toward the doorway camera), its size, and its main colours as hex values sampled from the photos.
- **Light sources**: type, colour temperature, brightness and position, and which of them the lighting panel should
  control.
- **The window**: size, position, and what's outside it by day and by night.
- **The hero camera**: position and look-at point that reproduce photo #1.
- **Interactive objects**: what each one does when clicked.
- **Differences from the reference room**: what gets removed, added or moved.
- **Open questions** for anything the photos don't show.

**Stop after the spec and ask me to confirm or correct it before building.** A wrong layout is far more expensive
to fix once geometry exists.

### 2. Architecture changes

- Move the room's layout into a data file, `src/components/room/roomLayout.ts`: room dimensions, window and door
  openings, and a list of furniture and props with positions, sizes and colours. Build the geometry from it, so I can
  nudge something later by editing one number.
- Keep the existing module split. Put new furniture builders in their own module (for example
  `createFurniture.ts`) rather than growing `createRoomScene.ts` further.
- Model everything procedurally, as the reference does: primitives, lofted and tapered tubes, `RoundedBoxGeometry`,
  instancing for repeats (books, bulbs, leaves) and canvas-painted textures (posters, screens, fabric). Don't
  download models or images. If a real texture would matter a lot (for example my actual poster), ask me for the
  image and inline it.
- Re-anchor every system to its new location: the laptop key light, bedside lamp, light switch, telescope and its
  eyepiece pose, radio, wall clock, phone, mug and steam, candle, fairy lights, window lights, the hallway light,
  the explore-view clamp bounds, and the telescope camera just outside my window.

### 3. Build in milestones. Screenshot, commit and push after each one.

1. Shell: walls, floor, ceiling, window and door openings, and the hero camera matching photo #1.
2. Big furniture: desk, bed, shelves, wardrobe, and so on.
3. Props and wall details.
4. Lighting to match my night photos, then re-tune the day, sunset, snow and clear-sky variants.
5. Re-wire interactivity: clickable props, the lighting panel, the telescope sequence and its landmarks.
6. The person and the pet. Adjust or remove them to match what I say.
7. A final pass: performance, phone layout, reduced motion, and a published preview.

### 4. Everything that must still work (acceptance checklist)

**Views**
- **Doorway view**: cursor parallax and a slow idle drift.
- **"Step inside"**: an eased camera move into orbit controls clamped inside the room.
- **Telescope**: click it, press T or use the button. The camera glides to just above and behind the eyepiece, then
  cuts to a camera outside the glass (near plane about 3 m, so the rain beside the window doesn't block the view).
  It then zooms from about 58° to 9° while the round eyepiece mask closes in. After that: drag to aim, scroll to zoom
  (2.5–18°), a landmark label follows the centre of the view, and Esc returns you to where you were.

**Lighting**
- Laptop key light with shadows, screen glow, window light, moon or sun, and warm hallway light through the door.
- Fairy lights with instanced HDR bulbs that bloom and breathe, backed by a few real point lights.
- Bedside lamp: click, L, or the button; fades like a real bulb.
- Candle flicker.
- Ceiling light.
- A wall light switch that opens the Lighting & weather panel:
  - presets;
  - dimmers;
  - fairy light colours, including rainbow;
  - colour temperature;
  - candle toggle;
  - time of day: your local time, Day, Sunset or Night;
  - weather: Rain, Snow or Clear.
- Every change fades smoothly.

**Life**
- The person types in bursts, leans, and glances at the window and at the phone when it buzzes.
- The pet breathes, flicks its tail, twitches an ear, and stirs when clicked.
- Steam rises from the mug.
- The phone shows lock-screen notifications.
- The wall clock ticks in real time.
- Dust motes drift in the light.
- Rain runs down the glass, with drops and streaks.
- Lightning comes with delayed thunder.

**Outside**
- The window from inside shows a soft backdrop repainted for time and weather.
- Western's campus is visible only through the telescope and changes between day and night.
- Snow cover, stars and the moon appear when the weather calls for them.

**Sound**
- Rain and wind, thunder, clicks, and the lo-fi radio on a shelf.
- A mute button and the M key.
- Sound starts only after the first click or key press.

**Memory**
- Lighting, weather, time mode and mute are restored on the next visit.
- A welcome-back note appears on the door.

**Rendering**
- ACES tone mapping; a HalfFloat, 4× MSAA composer with bloom.
- A finish pass for vignette, grain, fades, the eyepiece and colour temperature.
- VSM shadows refreshed about 10 times a second.
- `compileAsync` before the first frame.
- Adaptive pixel ratio.
- Frame-rate-independent damping.
- `prefers-reduced-motion` respected.

### 5. Lessons already learned (don't repeat these bugs)

**Performance**
- Never set `ctx.filter = "blur()"` and then draw many shapes. Filtering every draw call froze the GPU process.
  Draw into a scratch canvas and composite it once with the blur.
- Every real light costs every material. Bake outdoor lighting into unlit (`MeshBasicMaterial`) canvas textures, and
  keep indoor point lights few, with no shadows except on the key lights.
- Use `InstancedMesh` for anything repeated.

**Shadows and geometry**
- Shadow maps don't update automatically. The loop refreshes them every 6 frames and on view changes. Big leafy
  props near a spotlight throw ugly blob shadows, so set `castShadow = false` on them.
- Coplanar faces flicker (z-fighting). Keep glowing edges and trims slightly inset and thinner than what they sit on.

**Camera**
- The telescope's end-of-glide pose must look over the tube, not straight into its back. Otherwise the tube fills
  the screen.

**UI**
- `tailwindcss-animate` entrance animations override `transform`. Keep centring, rotation and the animation on
  separate elements.
- Start "hide after N seconds" timers when something actually appears, not when the page loads. Slow devices
  otherwise hide it before it's seen.

**Audio**
- Disconnect shared LFOs from oscillators in `onended`, or the audio graph leaks.

**Naming**
- A local helper named `pick` already exists in the scene file. Name new helpers distinctly.

### 6. How to check your work

**Local checks**
- Run `npx tsc -p tsconfig.app.json --noEmit`, `npx eslint src/components/room src/pages/Room.tsx`,
  `npm run build` and `npm test`.
- The five lint errors elsewhere in the repo are older than this work.

**Dev server**
- Run `VITE_SUPABASE_URL=http://x.invalid VITE_SUPABASE_PUBLISHABLE_KEY=x npx vite --host 127.0.0.1 --port 8080`.
- Bind to IPv4; the default `::` fails in the sandbox.
- The placeholder variables replace a `.env` that isn't committed.

**Screenshots**
- `node tools/room/screenshot.cjs http://127.0.0.1:8080/room <out-prefix> [steps.json]`. The file header explains
  the steps format.
- The headless browser renders on the CPU. A frame can take seconds, so wait about 30 s after load and about 60 s
  after entering the telescope.
- Judge layout, colour and lighting, not smoothness.
- Compare the hero screenshot side by side with photo #1 and iterate until they match.
- Also check at 390 × 780 (phone) with the panel open.

**Preview**
- Run `tools/room/build-standalone.sh <file>.html` to produce one self-contained page.
- Load the `artifact-design` skill, then publish that file with the Artifact tool so I can open it in a browser.
- To update my existing page instead of creating a new one, pass `url: https://claude.ai/artifact/AdBXMm4ytSNcCsvaCxriUu`.
- If you change the page's controls or callbacks, update `tools/room/standalone/entry.ts` and `head.html` to match.

### 7. Skills and tools to use

- **`artifact-design`**, before publishing the preview page.
- **`run`**, if you need to launch and drive the app beyond the screenshot script.
- **`anthropic-skills:animate`**, before designing any new motion (new props, zooms into objects).
- **`simplify`**, then **`code-review`**, at the end, on the full diff.
- **Git:** commit after each milestone with a clear message, and push to your branch. Don't open a pull request
  unless I ask.

### 8. What I want from you at the end

- A short summary of what changed from the reference room.
- Screenshots of the hero view (night), a daytime view, the telescope, and the phone layout.
- The preview link.
- A list of anything you guessed that I should check against my real room.

=====
