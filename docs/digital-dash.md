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
| navigation | `show(view)` switches between the 5 views. Navigation is a floating dock (`.rail`) at the bottom centre; brand, sync, sounds mini-player, install and search buttons sit in `.topbar` |
| CLOCKS | Flip, Digital, Analog, Words, Progress rings, Focus timer (chime; custom timers via the + button: `useTimer`, `addTimer`, `removeTimer`; focus timers log a session, breaks don't) |
| TASKS | Urgency 0 to 3 (Critical, High, Medium, Low), due dates with optional time (`dueTime`), sort by urgency then due |
| deadline pressure | `pressing(now)` picks tasks due within `PRESS_WIN` (3h); `updatePressure()` tints the clock stage (`#pressure`, weighted by `URG_W`), draws due ticks on the day line and shows a live countdown on the now-task pill; one toast at 15 minutes left |
| CALENDAR | Month grid, events plus tasks with due dates. `#cal-mode` switches to the week review |
| week review | `weekStats(start, upTo)`, `renderWeek()`: KPIs (focus time, sessions, tasks finished, net worth change, streak) compared with the same point last week, bar charts with tooltips and an `sr-only` table. Route `#week` |
| calendar import | `parseICS` / `expandICS` (RRULE daily/weekly/monthly/yearly, INTERVAL, COUNT, UNTIL, EXDATE, TZID) / `importICS`. File upload or URL (webcal is rewritten to https; many hosts block CORS, the error says so). Imported events carry `src`; re-importing replaces them. Colours `CAL_SLOTS` were checked with the dataviz palette validator |
| jukebox | Ambient sounds made live with Web Audio (no files): rain, waves, wind, fire, cafe, brown, pink, white noise, binaural. `jbPlay`, `jbPause`, mixes in `JB_MIXES`; optional auto mode plays during focus timers (`jbTimerSync`) |
| instruments | `INST` synth voices (epiano, piano, bass, pad, bell, kalimba, marimba, music box, lead, brass, drums). Each takes an AudioContext, so the music player and timer share them |
| study music | Music channels in `JBS` (`music:true`): lo-fi beats, soft piano, ambient drift, kalimba. `musBuild` registers a step function with the conductor `MUS`, which schedules swung 16ths at 74 bpm on the audio clock over shared chord progressions (`PROGS`), so layers stay in key. Shared reverb `jbVerb()`, a compressor on the master |
| Spotify now playing | `WT.spotify` widget. Signs in with Spotify using Authorization Code + PKCE (no secret, no server): `npConnect` sends you to Spotify, `npCallback` swaps the `?code=` for tokens, `npAccess` refreshes them. Scopes: `user-read-currently-playing user-read-playback-state`. Polls `/me/player/currently-playing` every 5s while visible; `npPaint` moves the progress bar locally between polls. Tokens are kept in localStorage key `digitaldash.spotify`, never in `S`. Each person registers their own Spotify app and pastes its Client ID; the redirect URI must match the page address exactly. Signing in does not work inside an iframe preview such as claude.ai |
| timer sounds | `TS_FX` synthesized end sounds: tones (chime, bell, marimba, harp, gong, birds, digital, soft swell) and melodies in `MELO` (sunrise, wake up, music box, piano, lo-fi keys, synth pop, fanfare, dream), picked from a dropdown with a preview button, chosen separately for focus and break in the timer editor (`settings.ts`). `tsPlay` ducks the jukebox while it rings (`jbDuck`); optional ring 3 times, a cue at 1 minute left, and ticking |
| live backgrounds | `LIVE` scenes drawn on `#bg-live` (aurora, sunset, lagoon, starfield, waves, fireflies). Soft scenes render at 1/10 or 1/2 size and scale up. 30fps, 15fps under glass refraction, paused when hidden, one still frame with reduced motion. `settings.bg.live`, `bg.speed`, `bg.grain` (film grain overlay on `#bg-dim::after`) |
| glass hover | `LG_LEAN`, `LG_NUDGE`, `LG_LIT` list what leans, nudges and catches the light. Aim is measured against the box at hover entry (`restRect`) so a moving piece does not chase Chrome's synthetic mousemoves. Pressing any of them in glass mode spreads a ripple (`.lg-rip`) |
| command bar | `<dialog id="cmd">`, Ctrl/Cmd+K or `/`. `cmdResults(q)` builds rows; `parseTask` / `parseWhen` understand things like "gym tomorrow 5pm high", "essay sep 30 !!!", "timer 40", "play rain", "theme midnight", "done lab", "tfsa 13000", "week". A bare time already past rolls to tomorrow |
| NET WORTH | Assets and debts accounts, daily history snapshots, SVG line chart, privacy eye (`setPrivacy()`: masks every amount, shows growth as a percentage; stored as `settings.hideNw`) |
| mini stats | Widget system (`WT` registry, `renderWidgets`, widget config forms) |
| focus controls | Clock picker, 24h and seconds toggles, zen mode |
| editable subtitles | Any element with `data-sub="key"` becomes inline editable; saved to `S.settings.subs` |

## State

Everything is in one object `S`, saved as JSON:

```
S = {
  tasks:    [{id, title, urg, due:"YYYY-MM-DD", dueTime:"HH:MM"?, done, doneAt, created}],
  events:   [{id, date, time, title, src?}],          // src = imported calendar id
  calendars:[{id, name, url?, slot, count, at}],     // imported .ics calendars
  accounts: [{id, name, kind:"asset"|"debt", cat, value}],
  history:  [{d:"YYYY-MM-DD", v:netWorth}],        // one point per day
  sessions: {"YYYY-MM-DD": count},                  // finished focus timers
  focusLog: {"YYYY-MM-DD": seconds},                // focus time, for the week review
  timers:   [{id, name, sec, kind:"focus"|"break"}],  // Focus timer choices (settings.timerId = last used)
  schemes:  [{id, name, c:{bg,panel,ink,accent,card,cardInk}}],
  widgets:  [{id, type, size:"s"|"w", title?, cfg?}],
  settings: {
    skin, accent, uiFont, clockFont, clock, h24, secs, currency, hideNw, surface:"solid"|"glass",
    radius, clockScale, subs:{}, refract,
    jb:    {vol, on:[soundIds], lv:{id:level}, auto},
    bg:    {type:"none"|"color"|"gradient"|"image", color, grad, image, iw, ih, dim, blur, match, pal},
    stage: {type:"theme"|"color"|"gradient"|"image"|"glass", color, grad, image, iw, ih, dim, ink}
  }
}
```

`merge()` fills in defaults for any missing keys, so adding a new setting only needs a default in `DEFAULT`.

## Installable app (PWA)

- `public/digital-dash.webmanifest` (scope `/digital-dash`, standalone, shortcuts to Tasks, Week review and Calendar) and icons `public/digital-dash-*.png`.
- `public/digital-dash-sw.js`: network first for the app, cache fallback so it opens offline; Google Fonts cache first. Bump `CACHE` when the precache list changes.
- The Install button appears when the browser fires `beforeinstallprompt`; on iPhone, Your data shows the Share, Add to Home Screen steps.

## Accounts (Supabase)

Optional sign-in so data saves to the cloud and follows you across devices. Signed out, everything works as before and saves in the browser.

**How it works**
- Sign in with an email magic link or Google (Supabase Auth, implicit flow). The redirect lands back on `digital-dash.html#access_token=...`; `acBoot()` takes the token out of the address bar before the router reads the hash.
- The whole state `S` is one row in `public.dash_state` (`user_id`, `data` jsonb, `rev`, `device`, `updated_at`). Row level security: only the owner can read or write their row.
- Each `save()` marks the device dirty (`digitaldash.acct` in localStorage) and pushes about 1.2 s later. An update only lands if `rev` still matches the last one this device saw. If another device saved first, the newer version is loaded and the toast offers Undo to put this device's version back. The app also checks for newer saves when the tab regains focus and every 60 s.
- First sign-in on a device: no row yet, so this device's data is uploaded. Device empty: account data is loaded. Both have data: a dialog asks which to keep.
- Photos go to the private `dash-images` storage bucket under `<user id>/<image key>` and download on demand on other devices.
- The account dialog (top bar avatar, `Account` in the command bar, or Themes, Your data) shows sync status, counts, presets, colour schemes, timers and imported calendars, plus Download backup, Sign out (optionally clearing this device) and Delete account (`delete_my_dash_account()` RPC after removing the user's photos).
- Spotify tokens are kept out of `S`, so they never reach the account.

**Config**: `vite.config.ts` has a small plugin that writes `/digital-dash-config.js` (`window.DASH_CONFIG = {supabaseUrl, supabaseKey}`) from `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, the same publishable values the React app uses. In dev it's served by middleware; in builds it's emitted as an asset. Without it, the account dialog says the site isn't connected yet. supabase-js loads from jsDelivr only when the config exists.

**One-time setup**
1. Run `supabase/migrations/20261001120000_digital_dash_accounts.sql` on the project: either let Lovable apply the migration, or paste it into the Supabase SQL editor and run it. It creates `dash_state`, its policies, the `dash-images` bucket with policies, and `delete_my_dash_account()`.
2. Supabase, Authentication, URL Configuration: add the dashboard's full address (for example `https://your-site/digital-dash.html`) to Redirect URLs. Also add the preview or local address you test on (`http://localhost:8080/digital-dash.html`).
3. Email sign-in works with Supabase's built-in mailer for testing (it is rate limited). For real use, set up custom SMTP under Authentication, Emails.
4. Google (optional): in Google Cloud create an OAuth client (Web), add `https://<project>.supabase.co/auth/v1/callback` as an authorized redirect URI, then paste the client ID and secret into Supabase, Authentication, Sign In / Providers, Google. Until then the Google button explains that it isn't turned on.

**Testing checklist**
- Sign in by email on a laptop with some tasks; the row appears in `dash_state` with `rev` 1.
- Add a task; `rev` goes up and the avatar dot turns green.
- Sign in on a phone; the laptop's data loads. Edit on the phone, come back to the laptop tab; it updates.
- Edit on both before syncing to see the "Loaded newer changes" toast and Undo.
- Upload a background photo; it shows on the other device.
- Delete the account and confirm the row and files are gone.

## Recurring tasks and checklists

- `t.rep = {f, n, days}`: `f` is `d` (every n days), `wd` (weekdays), `w` (weekly on `days`, Sunday = 0, every `n` weeks) or `m` (monthly). Set from the task form (Repeat + day buttons) or the command bar: "gym every mon wed fri 6pm", "problem set every friday", "readings weekdays", "rent monthly", "water plants every other day", "review notes every 2 weeks".
- Ticking a repeating task keeps it as done and adds the next one (`spawnNext`, `nextDate`); if it was finished late, the next one lands on the next date still ahead. Unticking removes that next one again. With no date given, the first one lands on the next matching day (`firstDue`).
- `t.steps = [{id, t, done}]` is the checklist, opened with the list button on a task. The row shows a progress bar; finishing every step offers to tick off the task. The AI helper's "Add as checklist" puts its steps here.

## Study tracking

- `t.course` (task form Course field with suggestions, or `#ES1050` in the command bar).
- The focus timer's "Working on" picker (`settings.tmTag`: `t:<task id>`, `c:<course>` or nothing) tags each finished focus session in `S.focusTags = [{d, sec, task, course}]`.
- Tasks show "3 sessions · 1h 15m". The week review adds "Time by course" (sorted bars, one hue, value on every row, with untagged focus time shown separately so totals still add up) and "Most time on".

## Reminders (Web Push)

Phone and computer notifications, even when Digital Dash is closed: a task's due time (15 min to 1 day before), a morning summary of what's due, calendar events 15 minutes before, and "Focus session done".

How it works:
- Themes, Reminders, "Turn on reminders for this device" asks for permission, subscribes with the VAPID public key from `dash-push` (`{action:"key"}`) and saves the subscription with `dash_push_register()`.
- The app works out the next 7 days of reminders (`remBuild`) and keeps them in `dash_reminders` (ids are `<user>:<tag>:<time>`, so every device writes the same rows; stale ones are deleted). It re-syncs about 4 seconds after changes. The focus timer's reminder is written when it starts and removed when paused.
- `dash-push` with `{action:"run"}` (every minute from pg_cron, with the `x-cron-secret` header) sends what's due, marks it sent, skips anything more than 30 minutes stale and drops subscriptions the push service reports as gone. It encrypts with `web-push` and delivers with `fetch`.
- `digital-dash-sw.js` shows the notification and opens or focuses the app at the right page when it's tapped.
- Signing out turns reminders off on that device.
- iPhone and iPad (iOS 16.4 or later) only allow web notifications for apps added to the Home Screen; the panel explains this when needed.

**One-time setup**
1. Run `supabase/migrations/20261001140000_digital_dash_push.sql`.
2. Make VAPID keys: `npx web-push generate-vapid-keys`. Add secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:you@example.com`) and a long random `CRON_SECRET`.
3. Deploy: `supabase functions deploy dash-push` (`verify_jwt = false` is set in `supabase/config.toml`, because the cron call uses the secret instead).
4. Open `supabase/digital-dash-reminders-cron.sql`, put in your project ref and the same `CRON_SECRET`, and run it in the SQL editor. It enables `pg_cron` and `pg_net` and calls `dash-push` every minute.
5. On your phone: open the site, add it to the Home Screen (needed on iPhone), open it from there, sign in, then Themes, Reminders, turn on, and press "Send a test".

## Study rooms (Supabase Realtime)

Focus with friends: see who's in a session and start a shared timer. No tables; a room is the Realtime channel `dash-room-<CODE>`.

- **Create or join**: Focus page, Study room card. Codes are 6 characters (`K86-VZ7`); "Copy invite" gives `digital-dash.html?room=CODE`, which joins straight away (asking for a display name first if you're signed out). The last room is rejoined on reload; Leave forgets it.
- **Presence** carries `{id, name, status: focus|break|idle, ends, len, task, group}`. It comes from your own focus timer, and is re-sent only when it changes (`rmPush`).
- **Room timer** (`group`): "Start together" broadcasts `{kind, len, ends, started, by, name}`; anyone with "Run it on my timer" on gets the same end time on their focus timer (`T.id = "room"`). Late joiners pick it up from presence (newest `started` wins). "End for everyone" broadcasts a stop.
- **Reactions** (👏 🔥 💪 ☕) are broadcasts with a floating emoji and a toast. "Show my top task while I focus" is off by default.
- Signed in, your account name is used; signed out, you type a name and a random id stays on the device (`digitaldash.room`).
- **Setup**: nothing beyond the account setup, as long as Realtime allows public channels (Supabase, Project Settings, Realtime; on by default). Anyone with a code can join that room, so codes are random and unlisted.

## AI helper (Supabase Edge Function + Claude)

Two actions, both previews you confirm before anything changes:
- **Break it down**: the sparkle button on a task (or "break down chem" in the command bar). Returns 3 to 8 steps with time estimates and dates before the deadline. You can untick or edit steps; picked ones are added as tasks named `Parent: step` with Undo.
- **Plan my week**: button on the Tasks page (or "plan my week"). Sends open tasks and the next 7 days of calendar events, gets back timed focus sessions plus warnings, and adds the ones you keep as calendar events with `src: "ai"` (shown as "AI plan"). A new plan replaces earlier AI sessions from today on; Undo restores.

How it works:
- `supabase/functions/dash-ai/index.ts` (Deno) checks the caller is signed in, counts the request with `dash_ai_take()` (per-user daily limit, default 25, env `DASH_AI_DAILY_LIMIT`), then calls Claude with the official SDK (`npm:@anthropic-ai/sdk`): model `claude-opus-5-5`, `effort: "medium"`, structured JSON output (`output_config.format` json_schema), and `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) so a declined request is retried on Anthropic's recommended fallback model. Refusals, truncation and API errors become friendly messages.
- The browser calls it with `AC.sb.functions.invoke("dash-ai", ...)`, so the API key never leaves the server. The client re-checks every returned date, time and task id before showing it.

**One-time setup**
1. Run `supabase/migrations/20261001130000_digital_dash_ai.sql` (usage table and `dash_ai_take`).
2. Add the secret: `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...` (or in Supabase, Edge Functions, Secrets). Optional: `DASH_AI_DAILY_LIMIT`.
3. Deploy: `supabase functions deploy dash-ai` (Lovable may deploy functions in `supabase/functions` for you). `verify_jwt = true` is set in `supabase/config.toml`.
4. Cost: each request is one Claude call. The daily limit caps it per person; lower it if you share the app widely.

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
- Mobile: below 720px the dock stretches edge to edge with stacked icon and label; the search button shrinks to an icon and keyboard hints hide on touch screens.

## Ideas for next steps

- Move to a real stack (for example Vite + React or Next.js) and split sections into modules.
- Real accounts and sync (Supabase or Firebase) to replace the claude.ai runtime.
- Import bank balances automatically, recurring tasks, calendar sync with Google Calendar.
- Drag and drop for widgets instead of arrow buttons.
- Two-way Google Calendar sync (needs OAuth and a backend; today's import is read-only).
