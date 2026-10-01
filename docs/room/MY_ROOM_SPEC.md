# My room: spec for the rebuild

Built from four night photos (no measurements given yet). Every number is **estimated** unless marked
**measured**. Once confirmed, these values move into `src/components/room/roomLayout.ts`.

| Photo | What it shows |
|---|---|
| A | From the front-right, looking at the long left wall and the bed (headboard against the window wall) |
| B | From the front, looking at the window wall: bed, dresser, window, floor lamp, desk on the right wall |
| C | From the bed, looking into the back-right corner: floor lamp, desk, tapestry, monitor, laptop |
| D | Close-up of the dresser, perfume shelf, window sill plushies, lamp and rugs |
| E | From beside the desk, looking at the front wall: the entry door in its alcove and the closet |

## Coordinate convention

Same as the reference scene: metres, **y up**, **+z toward the doorway camera**, origin at the centre of the floor.

- **Back wall (z = −1.65)**: the window wall. The bed headboard, dresser and floor lamp stand against it.
- **Left wall (x = −1.50)**: the long blank wall. The bed runs along it.
- **Right wall (x = +1.50)**: the desk and the tapestry.
- **Front wall (z = +1.65)**: the entry door, in an alcove beside the desk wall, and the closet, which juts
  0.62 m into the room from the bed side of the wall up to that alcove (photo E).

## Dimensions

| | Value | Source |
|---|---|---|
| Width (left → right) | 3.00 m | estimated: bed 1.45 + walkway 0.90 + desk 0.60 |
| Depth (back → front) | 3.80 m | estimated, lengthened on request: about 1.2 m of open floor between the foot of the bed and the closet |
| Ceiling height | 2.44 m (8 ft) | estimated, standard. Textured "popcorn" ceiling |
| Window | 1.30 m wide × 1.03 m tall, sill at 1.02 m, from x −0.90 to +0.40 | estimated |
| Entry door | 0.81 m × 2.03 m, front wall, x +0.61 to +1.42, hinged on the desk-wall side | estimated from photo E |
| Closet | bump-out from x −1.50 to +0.52, 0.62 m deep; a pair of six-panel doors from x −1.00 to +0.22, 2.03 m tall | estimated from photo E |

## Surfaces

| Surface | Colour | Notes |
|---|---|---|
| Walls | `#dcdad4` | Cool light grey-white, eggshell. Warms to about `#d6cec1` in lamplight |
| Ceiling | `#e4e0d8` | Popcorn texture: canvas-painted bump/roughness noise |
| Baseboards | `#efede8` | White, profiled, 0.10 m tall |
| Carpet | `#34322f` with a `#262523` grid | Dark charcoal low-pile carpet with a fine woven check. Replaces the wood floor |
| Window frame and sill | `#e8e6e0` | White vinyl; drywall return around the opening |

## Wall-by-wall inventory

Positions are the object's centre on the floor (y = 0) unless a height is given.

### Back wall (window wall)

| Object | Position (x, y, z) | Size (w × h × d) | Colours | Notes |
|---|---|---|---|---|
| Bed headboard | −0.77, 0.52, −1.63 | 1.45 × 1.04 (top at 1.04) × 0.03 | maple `#c8955f` | Flat laminated panel, residence style |
| Bed frame | −0.79, 0, −0.66 | 1.40 × 0.33 × 1.95 | black steel `#1c1c1e` | Low platform frame: four square legs, slats visible at the side |
| Mattress + fitted sheet | −0.79, 0.33→0.53, −0.66 | 1.37 × 0.20 × 1.91 (double) | red `#9e2427` | Wrinkled satin sheet with folds near the pillow |
| Pillow | −0.55, 0.58, −1.40 | 0.66 × 0.12 × 0.45 | satin peach `#d99a6c`, brown print `#5a3226` | Slightly off-centre toward the window side |
| Throw blanket | −0.60, 0.55, −0.35 | about 1.2 × 1.4 heap | red `#c8161c`, black-red stripes `#3a080c`, pink florals `#e46a8a` | Bunched on the front half and spilling over the right edge toward the floor |
| Dresser (two stacked two-drawer units) | +0.28, 0, −1.42 | 0.55 × 0.78 × 0.45 | maple `#d2a877`, black recessed pulls `#141414` | Top holds the perfume shelf and clutter |
| Perfume riser | +0.26, 0.78, −1.55 | 0.40 × 0.26 × 0.20 (3 steps) | black `#161616` | About 25 bottles, instanced from 6 shapes: square, round, tall, cap-heavy, gold `#c9a24a`, navy `#2a3560`, amber glass `#c98a3c` |
| LED pillar candle | +0.05, 0.78, −1.30 | 0.08 Ø × 0.10 | ivory `#f1e7d2` | Warm flicker |
| Dresser clutter | +0.30, 0.78, −1.25 | | purple lanyard `#6a4aa0`, black wallet, chrome watch, keys, blue lighter `#2a9ad8`, AirPods case | Small flat meshes, no shadows |
| Window roller blind | −0.25, 1.53, −1.62 | 1.28 × 1.00 | blackout black `#18191b` | Fully down in every photo. White cassette `#ecebe6` at 2.10 m |
| Window-sill row | on the sill, y 1.02 | | | Left to right: plant in black pot (x −0.80), cow plush "Eat mor chikin" (−0.64), Spider-Ham plush `#c4151c` (−0.44), crying-cat plush `#e0b9a0` (−0.24), small blue bird plush `#3a6fb8` (−0.06), plant in black pot (+0.10), white blind remote (+0.30) |
| Floor lamp | +0.78, 0, −1.40 | base 0.28 Ø, pole to 1.62, drum shade 0.30 Ø × 0.22 at 1.48 | black pole `#141414`, linen shade `#f4eee2` | The shade hangs from a short hook at the top of the pole. This is the room's main light |
| Double outlet with 6-way tap | +0.60, 0.42, −1.64 | | white | The lamp and dresser cables run to it |
| Ceiling sprinkler / smoke detector | +0.30, 2.44, −0.95 | 0.14 Ø | white | |

### Right wall (desk wall)

| Object | Position (x, y, z) | Size | Colours | Notes |
|---|---|---|---|---|
| Desk | +1.20, 0, −0.72 | 1.20 long (z) × 0.60 deep (x) × 0.75 high | top oak `#b89a78`, steel frame `#1a1a1c` | Square-tube frame with a lower rail |
| Tapestry | +1.49, 1.72, −0.62 | 1.30 × 1.20, top at 2.32 | black `#1c1b1c`, chalky white text `#e8e4dc` | "IF YOURE / READING / THIS ITS / TOO LATE" in the scratchy hand-drawn lettering, with the small praying-hands mark near the bottom. Canvas-painted; slight hang ripple |
| Curved monitor | +1.30, 0.75, −0.38 | about 32″: 0.71 × 0.42 screen on a white V-stand | back `#141416`, stand `#e8e8ea` | Turned about 30° to face the chair. Screen shows the PS5 "Welcome back to PlayStation" user picker `#1d5ab4` → `#0b1d4a` |
| Blue under-glow | +1.30, 0.76, −0.38 | | `#2a44ff` | LED under the monitor stand. Blooms |
| Laptop on a stand | +1.25, 0.75, −1.05 | 0.36 wide, raised about 15° on a silver stand | silver `#c9cacc` | Screen shows a dark browser page. It stays the key light |
| Keyboard | +1.08, 0.76, −0.75 | 0.36 × 0.13 | case `#d8dade`, keycaps grey-white `#c9ccd3` with slate-blue mods `#4d5a78` | 75 % layout |
| Desk mat | +1.12, 0.751, −0.72 | 0.80 (z) × 0.35 (x) | black `#1a1a1c` | |
| Mouse | +1.12, 0.76, −0.35 | | black | |
| DualSense controller | +1.10, 0.76, −1.10 | | white `#f2f2f2`, black centre | |
| Black mug | +1.35, 0.75, −1.22 | 0.08 Ø × 0.10 | `#161616` | Steam rises from it |
| Digital alarm clock | +1.36, 0.75, −1.12 | 0.10 × 0.06 | white, grey face | Shows real time; stands in for the wall clock |
| Gooseneck desk lamp | +1.40, 0.75, −1.28 | round head 0.14 Ø at 1.15 | white `#ecedef` | Off in the photos |
| Ring light on a clamp arm | +1.42, 0.75, −1.30 | 0.30 Ø ring at 1.48 | black | Off in the photos |
| Bluetooth speaker | +1.36, 0.75, −0.58 | 0.20 × 0.07 × 0.09 | black `#1a1a1a` | Becomes the **lo-fi radio** |
| Small round speaker | +1.36, 0.75, −0.18 | 0.07 Ø | black with blue ring | |
| PC tower | +1.25, 0, −0.10 | 0.20 × 0.45 × 0.42 | black, blue LED `#3050ff` | Under the front end of the desk |
| Power bar | +1.49, 0.30, −0.05 | | white | Cables run up to the desk |

### Floor and middle of the room

| Object | Position (x, y, z) | Size | Colours | Notes |
|---|---|---|---|---|
| Office chair | +0.55, 0, −0.75 | seat at 0.48, back to 1.00 | black mesh `#1a1a1c`, grey X-base on castors `#8a8a8e` | Faces the desk (+x) |
| Spider-web rug | +0.72, 0.004, −0.95 | about 0.75 Ø, irregular web edge | black `#1e1e22`, white web `#e6e6e6` | Partly under the chair |
| Cartoon rug | +0.45, 0.004, −1.25 | about 0.70 × 0.40 | cream body `#f3e2cf`, orange hands `#f28a45`, olive hat `#6e7a3c`, maroon shoes `#6a2a30` | A character lying on its back |
| Ceiling light | −0.20, 2.44, +0.45 | 0.33 Ø flush dome | brushed nickel ring `#9c9fa3`, frosted diffuser `#f4f1ea` | Off in the photos |

### Left and front walls

| Object | Position | Notes |
|---|---|---|
| Duplex outlet | −1.49, 0.35, +1.10 | Otherwise the left wall is bare |
| Entry door | x +0.61 to +1.42 in the alcove | White slab with faint panels, satin-nickel lever, round deadbolt above it, hinges on the desk-wall side |
| Closet doors | x −1.00 to +0.22, front face at z +1.03 | Two white six-panel leaves with textured grain, levers at the centre seam, hinges at the outer edges, white casing |
| Light switch | closet side face, facing the alcove, 1.2 m up | |

## Light sources

| Light | Type | Colour | Brightness at night | Position | Panel control |
|---|---|---|---|---|---|
| Floor lamp | point light inside the shade (shadows) + an emissive shade + an up/down bounce | 3000 K `#ffd6a0` | **Main light, on** | shade at +0.78, 1.48, −1.40 | Replaces the bedside lamp: click it, press L or use the button. Dimmer |
| Monitor | rect-area-style spot + emissive screen | cool blue `#4a8ef0` | medium; lights the chair side and the tapestry | +1.30, 0.97, −0.38 | Follows the "screens" dimmer |
| Laptop | key spot with shadows + screen glow | 6500 K `#cfe0ff` | low-medium | +1.25, 0.95, −1.05 | Existing laptop dimmer |
| Blue LEDs (monitor stand, PC tower) | emissive, bloom only | `#2a44ff` | small | as above | Follows "screens" |
| LED candle | small point light, flicker | 2200 K `#ffb46a` | small | +0.05, 0.90, −1.30 | Candle toggle |
| Ceiling dome | point light + emissive diffuser | 4000 K `#fff1dc` | off | −0.20, 2.40, +0.45 | Ceiling dimmer |
| Gooseneck lamp | spot, down onto the desk | 4000 K | off | +1.40, 1.15, −1.28 | Proposed new dimmer (or left decorative) |
| Ring light | ring emissive + soft point light | 5000 K | off | +1.42, 1.48, −1.30 | Proposed: toggled by clicking it |
| Window | backdrop + cool fill | by time of day | only when the blind is up | window | Time of day and weather |
| Hallway | spot through the door | warm | as the reference | front wall | Unchanged |

The night photos read as: the floor lamp is the main source, a cool blue wash comes from the monitor, the ceiling is
dim, and the room falls off toward the front wall. The lamp throws a bright scallop up the back-right corner.

## The window

- **Size and position**: 1.30 × 1.03 m, sill at 1.02 m, x −0.90 to +0.40 on the back wall. White vinyl frame, a
  single vertical mullion is likely but hidden by the blind.
- **What the photos show**: a blackout roller blind, fully down.
- **Proposal**: open with the blind about **two-thirds up** so the rain, backdrop, moon and window light still read,
  and make the blind clickable to roll up or down. The existing curtains are removed.
- **Outside**: unknown. See open questions.

## The hero camera

Photo B is the best whole-room view, so the hero view reproduces **photo B** rather than photo A.

- **Position**: (+0.30, 1.55, +1.95), standing in the doorway just behind the front wall.
- **Look-at**: (−0.15, 1.05, −1.65).
- **Field of view**: the photos are portrait at about 69° vertical. The page is landscape, so the view uses about
  52° vertical and keeps the same content: bed on the left, window and dresser in the centre, lamp, desk and
  tapestry on the right.
- **Explore view**: (+0.1, 1.5, +1.0) looking at (+0.9, 0.95, −1.0), toward the desk. Orbit is clamped to the new
  room bounds.

## Interactive objects

| Object | Click does | Status |
|---|---|---|
| Floor lamp | Toggles the lamp (was: bedside lamp); key L | proposed |
| Light switch (front wall, by the door) | Opens the Lighting & weather panel | proposed |
| Bluetooth speaker | Plays or stops the lo-fi radio | proposed |
| Window blind | Rolls up or down | new, proposed |
| Telescope | Starts the telescope sequence; key T | needs your answer (see below) |
| Laptop | Projects | **needs your answer**; the reference has no page links yet |
| Monitor | For example About or Games | **needs your answer** |
| Tapestry | For example About | **needs your answer** |
| Phone | Contact | **needs your answer**; no phone is in the photos |
| Perfume shelf | For example Skills, one bottle per skill | **needs your answer** |
| Plushies | A small squash-and-bounce | proposed, decorative |

## Differences from the reference room

**Removed**
- Wood floor → dark charcoal carpet.
- Bookshelf, corkboard, poster, the wall clock on the wall, curtains and rod, the trailing and potted floor plants,
  the book stack, the pencil cup, and the nightstand with its bedside lamp.
- Fairy lights (none in the real room; see open questions).
- The cat (none in the photos; see open questions).

**Added**
- Double bed with a maple headboard, a black steel frame, a red sheet and a zebra-stripe throw.
- Maple two-unit dresser with a perfume riser, an LED candle and clutter.
- Arched floor lamp with a drum shade, as the main light.
- Black-steel desk with a curved monitor (PS5 screen), a laptop on a stand, a keyboard, a controller, a gooseneck
  lamp, a ring light, a digital clock and speakers. Office chair and a PC tower.
- The "If you're reading this it's too late" tapestry.
- Blackout roller blind with a sill row of plushies and two small plants.
- Spider-web rug and cartoon rug.
- Flush ceiling dome and a sprinkler head; a popcorn ceiling texture; outlets.

**Moved or re-anchored**
- The room shrinks from 8.5 × 7.2 × 3.2 m to 3.0 × 3.3 × 2.44 m. Every position, the clamp bounds, the dust
  volume and the shadow cameras shrink with it.
- The desk moves from the back wall to the right wall. The figure sits facing +x, seen from the doorway in
  three-quarter back view.
- Laptop key light → the right-wall desk. Mug and steam → beside the laptop.
- Wall clock → the digital clock on the desk. Radio → the Bluetooth speaker. Candle → the LED candle on the dresser.
- Window → the smaller window over the bed head and dresser. The telescope camera sits just outside it.

## Open questions

1. **Measurements.** Please measure, even roughly: room width × depth × ceiling height; window width × height and
   sill height; bed size (single, double or queen); desk length × depth. The estimates above could be off by 20 %.
2. ~~**Door and closet.**~~ Answered by photo E. Still to check: the closet's depth (0.62 m estimated) and how far
   its doors are from the bed-side wall.
3. **Hero view.** Match photo B (whole room from the door), as proposed, or photo A?
4. **Blind.** Open about two-thirds by default and clickable, as proposed, or kept down with the room lit only from
   inside?
5. **Outside.** What is really outside the window (another residence, trees, a parking lot, a road)? Should the
   telescope still look at Western (University College, Middlesex, Weldon)?
6. **Telescope.** There isn't one in the room. Options: (a) a small tabletop telescope on the window sill, where the
   blind rolls up when you use it (recommended); (b) a tripod telescope squeezed beside the dresser; (c) no physical
   telescope, so T simply zooms through the window.
7. **Fairy lights.** None are in the real room. Drop them, or add a string along the blind cassette or the headboard?
8. **Person and pet.** Keep a seated figure at the desk (you)? If so, what hair and clothing? Drop the cat?
9. **Clickable links.** What should the laptop, monitor, tapestry, perfume shelf and phone open (Projects,
   Experience, Contact, Skills, Resume)?
10. **Monitor screen.** Keep the PlayStation welcome screen, or show something else (code, a game, the portfolio)?
    The PSN avatar and username in the photo will **not** be copied.
11. **Photos in the repo.** Should I commit your four photos under `docs/room/photos/` so later sessions can compare
    against them? The repo may be public, so they are not committed by default.
