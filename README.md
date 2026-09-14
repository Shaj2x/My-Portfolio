# shajithsasikumar.com

Personal site for Shajith Sasikumar — Engineering Science + Ivey HBA at Western
University, and a practice building automated systems for small businesses.

## Design direction

Built to the **monopo saigon** design system (`styles.refero.design`). The
source tokens are reproduced in `src/index.css`; the rules below are the ones
that actually shape the code.

- **Radical monochrome.** Black, white and whisper-thin greys are the entire
  interface palette. There is no chromatic UI colour anywhere — Tailwind's
  colour scale is replaced wholesale in `tailwind.config.ts` so a coloured
  utility is not even reachable.
- **One iridescent gesture per page.** Sage dissolving through molten amber
  into deep oxblood, treated as a liquid rather than a flat gradient. It is
  media, never a UI fill, and it appears once — behind the home hero.
- **Two shapes only.** 0px everywhere; 75px full pill on buttons and tags.
  Nothing between. The radius scale enforces this.
- **No elevation.** The shadow scale is `none`. Surfaces separate by colour
  inversion — full-bleed paper and obsidian bands — and by hairline 1px rules.
- **Type sets the temperature.** Weight 300 at 78px whispers, weight 400 at
  94px with 0.76 line-height locks lines into a typographic block, and weight
  400 at 11px uppercase labels everything else. Never bold above 45px.
- **Patient motion.** `cubic-bezier(0.19, 1, 0.22, 1)` at 0.8s–1.25s.
  Elements glide; nothing snaps.

### Two deliberate departures

- **Typeface.** Roobert is licensed commercially, so the site ships Inter —
  the substitute the source DESIGN.md names. To swap it in, self-host Roobert
  and put it first in `--font-roobert`; nothing else changes.
- **Single theme.** The source system is light-only, and it uses black as an
  inverse *section* colour. A user-controlled dark mode would invert the white
  bands and destroy that alternation, so the theme toggle was removed.

## Routes

| Route    | Audience                       | Opens on                        |
| -------- | ------------------------------ | ------------------------------- |
| `/`      | Recruiters, admissions, peers  | Full-viewport iridescent hero   |
| `/build` | Small-business clients         | Obsidian band, offer-led        |
| `/play`  | Anyone                         | Pong and Snake on canvas        |

`/` ships eagerly; the other routes are code-split.

## Content

All copy — roles, dates, offers, project notes — lives in
`src/content/profile.ts`. Edit there, not in components.

## Spacing

Tailwind's default scale is already 4px-based, so it *is* the system's scale.
Only the three steps it lacks are added (`11.5` = 46px section gap, `17`, `38`).
Do not override existing numeric keys — that silently changes every default
utility that uses them.

## Stack

Vite · React · TypeScript · Tailwind · React Router · Supabase Edge Function
(contact form only, imported on submit so it stays out of the initial bundle).

## Local development

```sh
npm install
npm run dev        # dev server
npm run build      # production build
npm run lint       # eslint
npm test           # vitest
```

## Social card

`public/og.png` is a 1200×630 render in the site's own palette and type. The
URL referenced in `index.html` must match wherever the site is deployed.
