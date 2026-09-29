# Digital Dash

A personal productivity dashboard: live clocks to stay motivated while working, a to-do list with urgency levels, a calendar, a net worth tracker, and deep visual customization (themes, custom colour schemes, backgrounds, fonts, widgets).

Originally built as a claude.ai artifact (it was called "Grindboard" at first). Everything lives in a single self-contained file, `public/digital-dash.html` (served at `/digital-dash.html` by the portfolio), with inline CSS and JS and no build step.

## Running it

Open `public/digital-dash.html` in a browser, or serve the folder:

```
npx serve public    # then open /digital-dash.html
```

## How the file is organized

The file has three parts: `<style>`, the markup, and one IIFE `<script>`. The script is split into sections with comment banners (`/* ---------- NAME ---------- */`):

| Section | What it does |
|---|---|
| persistence | Global state `S`, `DEFAULT`, `merge()`, `save()`, `connect()` |
| theme | Skins, fonts (`UIF`, `CLF`), gradients (`GRADS`), custom schemes, backgrounds, clock stage background, image storage helpers, background colour matching |
| motion | `anim()`, `vt()`, `flipRender()`, `initSeg()`/`glide()`, `moveInd()`, `tweenNum()` (see Motion below) |
| navigation | `show(view)` switches between the 5 tabs |
| CLOCKS | Flip, Digital, Analog, Words, Progress rings, Focus timer (chime; custom timers via the + button: `useTimer`, `addTimer`, `removeTimer`; focus timers log a session, breaks don't) |
| TASKS | Urgency 0 to 3 (Critical, High, Medium, Low), due dates, sort by urgency then due |
| CALENDAR | Month grid, events plus tasks with due dates |
| NET WORTH | Assets and debts accounts, daily history snapshots, SVG line chart, privacy eye (`setPrivacy()`: masks every amount, shows growth as a percentage; stored as `settings.hideNw`) |
| mini stats | Widget system (`WT` registry, `renderWidgets`, widget config forms) |
| focus controls | Clock picker, 24h and seconds toggles, zen mode |
| editable subtitles | Any element with `data-sub="key"` becomes inline editable; saved to `S.settings.subs` |

## State

Everything is in one object `S`, saved as JSON:

```
S = {
  tasks:    [{id, title, urg, due:"YYYY-MM-DD", done, doneAt, created}],
  events:   [{id, date, time, title}],
  accounts: [{id, name, kind:"asset"|"debt", cat, value}],
  history:  [{d:"YYYY-MM-DD", v:netWorth}],        // one point per day
  sessions: {"YYYY-MM-DD": count},                  // finished focus timers
  timers:   [{id, name, sec, kind:"focus"|"break"}],  // Focus timer choices (settings.timerId = last used)
  schemes:  [{id, name, c:{bg,panel,ink,accent,card,cardInk}}],
  widgets:  [{id, type, size:"s"|"w", title?, cfg?}],
  settings: {
    skin, accent, uiFont, clockFont, clock, h24, secs, currency, hideNw, surface:"solid"|"glass",
    radius, clockScale, subs:{},
    bg:    {type:"none"|"color"|"gradient"|"image", color, grad, image, iw, ih, dim, blur, match, pal},
    stage: {type:"theme"|"color"|"gradient"|"image"|"glass", color, grad, image, iw, ih, dim, ink}
  }
}
```

`merge()` fills in defaults for any missing keys, so adding a new setting only needs a default in `DEFAULT`.

## Storage

- `localStorage` key `grindboard.v1` holds `S` (kept for backward compatibility with the old name).
- Background photo: `localStorage` key `digitaldash.bgimg`. Other images: `digitaldash.img.<key>`.
- Image `src` values: `"local"` (page background), `"local:<key>"` (stage or widget image), or `"/_blob/<id>"` (claude.ai asset store).
- `connect()` and `storeImage()` try the claude.ai artifact runtime (`window.claude.use("db" | "user" | "assets")`). Outside claude.ai that runtime does not exist, so the app silently falls back to localStorage. Nothing breaks, but data only lives in that browser.

## Theming

- Colours are CSS variables on `:root`: `--bg --panel --panel2 --ink --muted --line --accent --accent-ink --card --card-ink`, plus urgency colours `--u0` to `--u3`.
- Built-in skins are `html:root[data-skin="..."]` blocks (the `:root` part is needed so they beat the dark mode media query).
- Custom schemes and background matching set the variables inline via `setScheme()`; `--panel2`, `--line`, `--muted` and `--accent-ink` are derived automatically.
- Background matching: `computePal()` reads the background (photo pixels sampled on a 48x48 canvas, or gradient/solid hex values) into `{base, vivid}`, and `deriveScheme()` turns that into a light or dark scheme. It is on by default and turns off when the user picks a fixed theme.
- Fonts load on demand from Google Fonts via `loadFonts()`. Clock fonts carry a digit width (`--dw`) so flip cards fit wide fonts; `--fs` scales the flip clock down for them.

## Widgets

Registry `WT` in the widgets section. Each type has `name`, `title`, `desc`, and optional default `cfg`. To add one: add an entry to `WT`, a `case` in `wBody()`, and any settings fields in `wCfgForm()`. Current types: open, today, sessions, networth, toptasks, upcoming, countdown, quote, note, world, progress, image, donewk.

## Motion

The goal is that nothing teleports and nothing waits on you. Rules the code follows:

- **Tokens** live on `:root`: `--ease-out` `cubic-bezier(0.23,1,0.32,1)` for entering and leaving, `--ease-in-out` `cubic-bezier(0.77,0,0.175,1)` for things moving on screen, `--ease-drawer` for the zen morph, and durations `--t-press` 120ms, `--t-fast` 160ms, `--t-ui` 220ms, `--t-move` 260ms. `EASE_OUT` and `EASE_IO` mirror them for WAAPI. Reuse these, don't add new curves.
- **Only `transform`, `opacity` and `clip-path` animate.** The day line and progress bars use `scaleX`, not `width`.
- **Clocks run off the main thread.** Analog hands are infinite linear CSS spins phase-locked to the wall clock with a negative `animation-delay` (`syncAnalog()`). The flip leaf is a CSS keyframe that accelerates over the hinge, overshoots slightly and settles, with shading on both faces. The JS tick runs once per second, aligned to the second boundary, not a 60fps rAF loop.
- **Lists re-render with `flipRender(container, render, mode)`.** Rows keyed by `data-id` slide from their old position, new rows fade in with a short stagger, and removed rows fade out as ghosts. Pass `"plain"` when the whole list swaps (task filters, another day). Used for tasks, widgets, day items and accounts.
- **Segmented controls** get a thumb that glides to the pressed option by animating `clip-path: inset()`. A MutationObserver on `aria-pressed` moves it, so code only has to set `aria-pressed`. Call `initSeg()` on any new `.seg`.
- **Tabs**: one rail indicator slides between them (`moveInd()`); views fade and rise 8px in.
- **Feedback**: buttons scale to .97 on press; task checks draw their tick and strike through the title before the row moves, which is why toggles wait 420ms (`afterTaskChange`).
- **View transitions** (`vt()`) morph the clock stage into zen mode and crossfade theme swaps. Browsers without the API just switch instantly.
- **Toasts** use transitions, not keyframes, so rapid toasts retarget instead of restarting.
- **Hover motion** is gated behind `(hover: hover) and (pointer: fine)`.
- **Liquid glass** (`S.settings.surface = "glass"`, class `lg` on `<html>`), modelled on the Liquid Glass Room artifact. In Chromium (class `lgr`, toggle `settings.refract`) each pane gets real refraction: an SVG filter used as its `backdrop-filter`, whose `feDisplacementMap` reads a map drawn from the rounded rectangle's signed distance field (convex squircle bezel, pointing inward). Filters are cached per kind and size (`lgFilter`); big panes use one displacement pass with no frost, small pieces (segmented controls, toast) split R/G/B for a colour fringe. Other browsers fall back to `blur() saturate()`. The material is `--rim` (inset highlights lit from the top-left) plus `--lift` (two-layer shadow), and a screen-blended `::after` sheen whose hotspot follows the cursor (`--lx/--ly`, faded by the registered `--hov`). `prefers-reduced-transparency` and `prefers-contrast: more` fall back to solid panels.
- **Droplets** (glass mode): the selected-tab highlight (`.seg .thumb`, `.rail .ind`) and a fainter hover bead (`.hbead`) are boxes whose four edges run on springs; along the direction of travel the leading edge is stiffer, so the droplet stretches toward the new tab and then catches up (`dropTo`). `glide()` and `moveInd()` hand over to them when `lg` is on; `lgModeChanged()` swaps back.
- **Glass hover** (mouse only): the "liquid glass engine" section. Widgets, theme cards and task rows lean up to ~6px toward the cursor and bulge that way (scaled down for big panes), with a ripple on entry and a flick outward on exit so they wobble back; buttons get half the lean on the `translate` property so `:active` scale still composes. One passive `pointermove` listener, one rAF loop that sleeps at rest. Reduced motion keeps the hotspot and drops the movement.
- **Presets** (`S.presets`, Themes > Presets): named copies of `PRESET_KEYS` (scheme, accent, fonts, radius, clock size and style, surface, refraction, background, clock background). Photos are copied to their own image keys (`p<id>bg`, `p<id>st`) and a custom scheme is stored with the preset. Apply runs as a view transition; the preset matching the current look shows "In use".
- **Select menus**: where `appearance: base-select` is supported they are drawn in theme colours (glass in glass mode) and open from the trigger in 180ms. Elsewhere `color-scheme`, set from the theme's `--bg` in `applyTheme()`, keeps native menus and date pickers light or dark to match.
- **Font fitting** (`fitFonts()`): after the chosen fonts load, a canvas measures the clock font's widest digit, average capital, colon ink and where digits sit in the line box, and the text font's average lowercase width, all relative to the defaults (Big Shoulders, Bricolage). It sets `--hs` (headings, brand, section titles, Words clock), `--fs`/`--ns` (clocks and big numbers), `--dw` (flip card width), `--cw`/`--kx`/`--ky` (colon width and dot centring), `--dy` (vertical centring of digits) and `--us` (body text), on soft power curves so wide faces shrink without looking tiny. `fitClock()` then scales the clock (`--fk`) if it is still wider than the stage, and font-picker and preset previews size to their tiles. Measurements are cached only once the real face has loaded. The 12-hour flip clock hides its empty leading card.
- **Clock colour guard** (`applyStage()`): if the digit colour (chosen or from the scheme) is below 4.5:1 against the clock background, it is pushed toward white or black until it reads, and a note appears under "Clock digit colour".
- **Reduced motion** means gentler, not none: movement is dropped and fades are kept. `anim()` strips transforms automatically; the analog second hand ticks with `steps(60)`.

## UI/UX baseline (from the ui-ux-pro-max guidelines)

- **Targets**: every control is at least 24×24px with a mouse (WCAG 2.2 AA) and 44px on touch (`@media (pointer: coarse)`). Small visuals that must stay small, like the task tick, get an invisible hit area (`.check::after`).
- **Text**: nothing below 12px; form fields are 16px on phones so iOS doesn't zoom on focus.
- **Contrast**: all built-in themes pass 4.5:1 for text, including muted text on `--panel2`. Custom schemes derive `--muted` and step it toward `--ink` until it passes (`setScheme`). Clock digits have their own guard (`applyStage`).
- **Recoverable deletes**: deleting a task, event, account, widget or widget image shows a toast with Undo for 5 s (`toast(msg,{run,done})`); images are only discarded in `done`, after Undo expires.
- **Deep links and Back**: each tab is a URL hash (`#tasks`, `#calendar`, `#money`, `#themes`); tab clicks push history, `popstate` switches tabs, and loading with a hash opens that tab.

## Conventions

- UI copy is plain, friendly, sentence case, and uses no em dashes.
- Keep it one file with no framework unless we deliberately decide to migrate.
- Respect `prefers-reduced-motion`. Every animation has a reduced variant (see Motion).
- Mobile: below 720px the sidebar becomes a bottom tab bar.

## Ideas for next steps

- Move to a real stack (for example Vite + React or Next.js) and split sections into modules.
- Real accounts and sync (Supabase or Firebase) to replace the claude.ai runtime.
- Import bank balances automatically, recurring tasks, calendar sync with Google Calendar.
- Drag and drop for widgets instead of arrow buttons.
- Package as a PWA so it installs on a phone.
