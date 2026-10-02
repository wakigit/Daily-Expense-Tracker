# Daily Expense Tracker

A mobile-first daily expense tracker for spending in Singapore dollars. Log what
you spend in a few taps, set a budget per category, and ask questions about it in
plain English.

The wallpaper is a second reading of the budget: three live scenes — a moonlit
forest, a sunset beach and a rainy city — that shift when the month goes over.
The number and the status word are always on screen, so the scene never carries
information on its own.

## Running it

```sh
npm install
npm run dev     # local dev server
npm run build   # production build into dist/
npm run smoke   # render + logic tests
```

## How it is put together

React 19 and Vite, no UI framework, hand-rolled CSS driven entirely by custom
properties — which is what makes a theme swap cost nothing.

- `src/views/` — one file per screen. `src/components/` — the shared pieces.
- `src/lib/` — the logic, all of it pure and testable in Node: `stats.js` does
  every sum, `ask.js` turns a question into an answer, `parseUtterance.js` reads
  a spoken sentence, `status.js` decides budget status.
- `src/themes/` — `themes.js` holds the design tokens, `scenes.js` builds the
  wallpapers once and switches them with a single attribute.
- `src/lib/storage.js` is the only place the app touches persistence. Its
  functions are already `async` so a backend can replace it without rippling
  outward.

Data lives in `localStorage`. There is no account and no server.

## Docs

`docs/PRD.md` is the product spec. `docs/WALLPAPER-REDESIGN.md` is the design
spec for the current wallpaper and layout work.
