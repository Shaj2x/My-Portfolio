# shajithsasikumar.com

Personal site for Shajith Sasikumar — Engineering Science + Ivey HBA at Western
University, and a practice building automated systems for small businesses.

## Design direction

**Technical Editorial.** Paper ground, a strict grid, hairline rules instead of
card chrome, and a single petrol accent spent sparingly. Monospace is reserved
for metadata — dates, organisations, languages, counts — and never used for
prose. The serif carries the reading text.

Two rules keep it coherent:

- **Everything is a ledger row.** Jobs, degrees, leadership roles and
  repositories share one structure (`LedgerRow`) rather than six variations on a
  card. Structure encodes what the content actually is.
- **One dark block per page.** The `ink` token set is the only dark surface on
  an otherwise paper site, and it marks where the practice begins. It carries
  its own colours in both themes so it never borrows the page ground.

Both themes are defined at token level in `src/index.css`: the bare `:root`
block is the complete light palette, and `.dark` redefines only the tokens.

## Routes

| Route    | Audience                        | Contents                                        |
| -------- | ------------------------------- | ----------------------------------------------- |
| `/`      | Recruiters, admissions, peers   | Masthead, about, GitHub work, record, toolkit   |
| `/build` | Small-business clients          | Offers, process, contact                        |
| `/play`  | Anyone                          | Pong and Snake, written from scratch on canvas  |

`/` ships eagerly; the other routes are code-split.

## Content

All copy — roles, dates, offers, project notes — lives in
`src/content/profile.ts`. Edit there, not in components.

## Stack

Vite · React · TypeScript · Tailwind · React Router · Supabase Edge Function
(contact form only, imported on submit so it stays out of the initial bundle).

Typefaces: Archivo (display), Source Serif 4 (body), IBM Plex Mono (metadata).

## Local development

```sh
npm install
npm run dev        # dev server
npm run build      # production build
npm run lint       # eslint
npm test           # vitest
```

## Social card

`public/og.png` is generated from `index.html`'s metadata design. Regenerate it
by rendering a 1200×630 page in the site's own type and palette; the referenced
URL in `index.html` must match wherever the site is deployed.
