---
name: design-system
description: The monopo saigon design system this site is built to. Read this BEFORE writing or editing any component, CSS, Tailwind config, or page in this repo — including small changes like adding a button, a section, a card, or a colour. Also read it when asked to restyle, add a page, change spacing or type, or "make it look better". Covers the monochrome palette, the 0px/75px shape rule, the type scale and its weight limits, motion curves, and the mistakes that have already been made once.
---

# monopo saigon — the system this site is built to

Source: `styles.refero.design` (monopo saigon). The tokens live in
`src/index.css` and `tailwind.config.ts`. **Read the tokens there rather than
copying values into new code** — duplicated tokens drift.

## The five rules that are not negotiable

1. **No chromatic UI colour.** Black, white and greys are the entire
   interface palette. Tailwind's colour scale is replaced wholesale in
   `tailwind.config.ts`, so a coloured utility is not reachable — if you find
   yourself wanting one, the answer is a grey or an inverted band.
2. **One iridescent gesture per page, and it is media.** The sage → amber →
   oxblood gradient (`.iridescent`) is a backdrop behind text. Never a button,
   badge, border, or fill.
3. **Two shapes: 0px, or the 75px pill.** Nothing between. Pills are for
   buttons and tags only. Cards, images and inputs are sharp.
4. **No shadows.** The shadow scale is `none`. Surfaces separate by colour
   inversion (paper ↔ obsidian bands) and 1px hairline rules.
5. **Never bold above 45px.** Large type whispers at 300 or speaks at 400.

## Type

| Class          | Size          | Weight | Line height | Use                                   |
| -------------- | ------------- | ------ | ----------- | ------------------------------------- |
| `.t-display`   | up to 225px   | 400    | 0.76        | Hero name only                        |
| `.t-heading-lg`| up to 94px    | 400    | 0.76        | Short statements that fit two lines    |
| `.t-heading`   | up to 78px    | 300    | 1.1         | Sentences, manifesto, atmospheric      |
| `.t-subheading`| up to 39px    | 400    | 1.19        | Row titles                             |
| `.t-lead`      | up to 29px    | 300    | 1.58        | Lead paragraphs                        |
| `.t-body`      | 18px          | 400    | 1.21        | Body                                   |
| `.t-body-sm`   | 16px          | 400    | 1.5         | Secondary body                         |
| `.t-label`     | 11px          | 400    | 1.36        | Uppercase labels, metadata, nav        |

**The 0.76 line-height is a two-line device.** At three or more lines the
descenders collide with the next line's caps. If a heading needs three lines,
it is a sentence — use `.t-heading` (78px weight 300) instead.

## Layout

- `.shell` — 1078px max width, the site's single measure.
- `.band` / `.band-tight` — full-bleed horizontal sections. Alternate
  `tone="paper"` and `tone="obsidian"` via `<Band>`.
- Any dark section must carry `data-dark-region` so `SiteHeader` inverts over
  it. The header has no background fill; without this attribute its text
  disappears.
- Left-align everything except the hero. Never centre body copy, lists or
  addresses.

## Motion

`cubic-bezier(0.19, 1, 0.22, 1)` at 0.8s–1.25s. Elements glide; nothing snaps.
Use `duration-micro` (400ms) only for colour and opacity. Everything animated
must still be visible with JavaScript off — see `Reveal`, which arms itself at
mount rather than shipping hidden markup.

## Spacing — read this before adding a spacing token

Tailwind's default scale is **already 4px-based**, so it *is* this system's
scale. Only the steps it lacks are added: `11.5` (46px section gap), `17`, `38`.

**Do not override existing numeric keys.** Defining `8: "8px"` silently makes
every other undefined step fall back to rem defaults, so `px-20` becomes 80px
rather than 20px. This has already broken the hero on phones once.

Common values: `gap-2` 8px · `gap-3` 12px · `gap-3.5` 14px · `gap-7` 28px ·
`gap-10` 40px · `gap-11.5` 46px · `gap-12` 48px · `gap-16` 64px.

## Content

All copy — roles, dates, offers, project notes — lives in
`src/content/profile.ts`. Never hardcode Shajith's biography, dates or offer
text into a component.

## Typeface

Roobert is licensed commercially and is not in the repo. The site ships a
substitute declared once in `--font-roobert` (`src/index.css`). To change the
typeface, change that one line and the Google Fonts `@import` above it.

## Before you finish

Run `npm run lint` and `npm run build`. Both must pass clean. The build
enforces nothing about this system — you do.
