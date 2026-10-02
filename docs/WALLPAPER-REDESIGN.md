# Wallpaper redesign spec

**Status:** Approved design, ready to build in phases
**Source:** Design canvas "Wanli Wallet live wallpapers". Reference markup lives in `docs/design-canvas/` (see section 11).
**Last updated:** 2026-10-01

This replaces the current Pink Bow, Midnight, Moonlit Forest, Sunset Beach and Mahjong Fortune set with three scene themes that share one layout. Read the whole file before changing code. Build in the phase order in section 10.

---

## 1. Core rule

The wallpaper is a second reading of the budget, never the first. The number and the status words are always on screen, and they are what a screen reader announces. The scene layer is `aria-hidden`.

## 2. Budget state model

Computed from `spent` and `totalBudget` for the selected month.

| Spent | Label | Shape | Extra text | Scene |
|---|---|---|---|---|
| No budget set | No budget set | check | No bar | Calm |
| 0 to 74% | On track | check in circle | "S$X left this month", "About S$Y a day for the last N days" | Calm |
| 75 to 99% | Close to limit | half filled circle | Same as above | Calm |
| Exactly 100% | Budget reached | half filled circle | Full bar | Calm |
| Above 100% | Over budget | triangle with ! | "S$X over budget" | **Over** |

- The scene has exactly two states: `calm` and `over`. `isOver = totalBudget > 0 && spent > totalBudget`.
- The same thresholds apply per category on the Budget screen and per month on History.
- Status colour is the third cue after the word and the shape, never the only one.
- The hero status chip has `role="status"` and `aria-live="polite"`.
- The hero amount does **not** turn red when over. The chip carries the state.
- Setting **"Wallpaper reflects my budget"** (on the Budget screen, default on). When off, the scene stays calm all month.

## 3. Rendering rules (scene engine)

1. Build each scene SVG **once**, when the app opens (or when the theme changes). Keep it mounted.
2. Never rebuild with `innerHTML` when spending changes. The current `paintBackground(theme, health)` does this, and it restarts every animation.
3. Switch state by setting `data-over="true|false"` on the scene root. CSS handles every visual difference between calm and over.
4. Rebuild on resize only if the viewport width changes by more than a few px. iOS fires resize when the URL bar collapses.
5. Animate only `transform` and `opacity` (plus `stroke-dashoffset` for river lines).
6. Pause all loops (`animation-play-state: paused`) when not on the Home tab, and on `visibilitychange` when hidden.
7. Every loop must end exactly where it starts so the restart is invisible:
   - Translating patterns move by a whole number of pattern lengths (waves: 390 px with a 30 px period; river dashes: dasharray period 24, offset -48).
   - Things that reset position (rain, fish) fade to opacity 0 at both ends of the loop.
   - Walk cycles return to the start pose (the deer turns and walks back).
   - Give each element a different negative `animation-delay` so nothing pulses together.
8. The calm to over switch plays **once** (2 to 3 s). Going back to budget (for example after a refund) plays it in reverse.
9. Reduced motion (`prefers-reduced-motion: reduce`, plus an in-app switch): every loop stops on a composed frame, and the state switch becomes a 0.25 s opacity fade. The scene still shows the state.

## 4. Layout zones (phone, 390 x 844)

| Zone | y range | Contents |
|---|---|---|
| Header | 0 to 58 | Month picker (Home) or screen title, settings gear |
| Hero | 58 to 260, left 65% of width | Spent amount, budget, status chip, bar with 75% tick, left line, per day line |
| Top right corner | | Reserved for the moon or sky detail. No text. |
| Focal band | 260 to 392 | Deer, river, sun on horizon, train, street. **No text ever.** |
| Cards | 392 down | Opaque cards |
| Tab bar | bottom 84 | 95% opaque |

- Other tabs start cards at about y 70 and dim the scene with a full screen scrim (`--scrim-page`).
- Home scrim: a horizontal gradient (dark on the left behind the text, nearly clear on the right so the moon stays bright), masked to the top 46% of the screen:
  `mask-image: linear-gradient(180deg, #000 0%, #000 30%, transparent 46%)`.

## 5. Navigation

Tabs: **Home, History, Add, Ask, Budget**. Add is a raised 46 px accent circle in the centre. Settings moves to a gear button in the header. Budgets move out of Settings into the Budget tab. All targets are at least 44 px.

## 6. Shared tokens (never change per theme)

```css
--r-card: 22px; --r-ctl: 14px; --r-pill: 999px; --r-sheet: 28px;
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
```

Type (load from Google Fonts: `Caprasimo`, `Figtree:wght@400;500;600;700`):

| Use | Font | Size |
|---|---|---|
| Hero amount | Caprasimo | 46 / 1.05 |
| Screen title | Caprasimo | 24 |
| Card title | Caprasimo | 16 to 20 |
| Body | Figtree 400 | 15 / 1.45 |
| Status, labels | Figtree 700 | 14 |
| Caption | Figtree | 13 |
| Tab label | Figtree 700 | 11 |

All money uses `font-variant-numeric: tabular-nums`. Minimum readable size is 13 px (11 px only for tab labels).

Card: fill at the theme opacity, `backdrop-filter: blur(18px) saturate(1.3)`, 1 px `--card-line` border, radius 22, padding 18.

## 7. Theme tokens

### Moonlit Forest (`forest`)

```css
--ground:#0A111F; --card:rgba(13,21,37,0.9); --card-line:rgba(176,196,226,0.16);
--tx:#F2EEE3; --tx-sub:#BAC4D2; --tx-muted:#93A1B4;
--on-scene:#F8F3E6; --on-scene-sub:#D5DCE6;
--accent:#E2B866; --on-accent:#1A1405;
--st-calm:#8FD9B0; --st-watch:#E8B04F; --st-over:#F07F6E;
--track:rgba(255,255,255,0.13); --track-scene:rgba(255,255,255,0.24);
--nav-bg:rgba(9,14,26,0.95); --nav-line:rgba(176,196,226,0.14);
--chip:rgba(255,255,255,0.07); --field:rgba(255,255,255,0.06); --field-line:rgba(176,196,226,0.24);
--scrim-home:linear-gradient(90deg,rgba(5,9,20,0.66) 0%,rgba(5,9,20,0.5) 55%,rgba(5,9,20,0.06) 80%,rgba(5,9,20,0) 100%);
--scrim-page:rgba(6,10,20,0.66);
```

Scene colours: sky top `#050918`, sky at ridge `#1A2A4C`, moon `#F4ECD2`, river `#2C4A6E`, silhouettes `#070D18`.

### Sunset Beach (`beach`)

```css
--ground:#2A1A2E; --card:rgba(255,248,242,0.95); --card-line:rgba(201,140,120,0.34);
--tx:#3A1F2B; --tx-sub:#6E4655; --tx-muted:#7E5866;
--on-scene:#FFF7EE; --on-scene-sub:#FBE6D8;
--accent:#B04419; --on-accent:#FFFFFF;
--st-calm:#276B4C; --st-watch:#8A560B; --st-over:#A3322A;
--hb-calm:#BDF0D2; --hb-watch:#FFD58A; --hb-over:#FFB4A4; /* hero bar fills on the scene */
--track:rgba(58,31,43,0.12); --track-scene:rgba(255,255,255,0.3);
--nav-bg:rgba(255,246,239,0.97); --nav-line:rgba(201,140,120,0.3);
--chip:rgba(58,31,43,0.06); --field:rgba(255,255,255,0.9); --field-line:rgba(201,140,120,0.5);
--scrim-home:linear-gradient(90deg,rgba(38,14,34,0.6) 0%,rgba(38,14,34,0.42) 55%,rgba(38,14,34,0.06) 80%,rgba(38,14,34,0) 100%);
--scrim-page:rgba(40,18,34,0.58);
```

Scene colours, calm then over: sky top `#3B2A5C` then `#0B1230`, sky mid `#E07A5F` then `#4B3F72`, horizon `#F9B97F` then `#8C6A8E`, sun edge `#F29A5B` then `#C9637A`, sea top `#E59A72` then `#4E4A72`.

### Rainy City (`city`)

```css
--ground:#0D1119; --card:rgba(17,22,33,0.9); --card-line:rgba(160,180,210,0.16);
--tx:#EEF1F5; --tx-sub:#B5BFCC; --tx-muted:#919DAD;
--on-scene:#F4F6FA; --on-scene-sub:#D2D9E3;
--accent:#F2A65A; --on-accent:#1B1208;
--st-calm:#7FD8B4; --st-watch:#E7B85A; --st-over:#EE8C7A;
--track:rgba(255,255,255,0.12); --track-scene:rgba(255,255,255,0.24);
--nav-bg:rgba(11,14,21,0.95); --nav-line:rgba(160,180,210,0.14);
--chip:rgba(255,255,255,0.07); --field:rgba(255,255,255,0.06); --field-line:rgba(160,180,210,0.24);
--scrim-home:linear-gradient(90deg,rgba(7,10,17,0.7) 0%,rgba(7,10,17,0.5) 55%,rgba(7,10,17,0.2) 80%,rgba(7,10,17,0.14) 100%);
--scrim-page:rgba(7,10,17,0.66);
```

Scene colours, calm then over: windows `#F6C27A` then `#A9C1DE`, lamp `#F7B65E` then `#D3E2F4`, horizon glow `#6A4E62` then `#334A68`. Rain opacity 0.2 then 0.6, with a second heavier rain layer at 0.6 when over.

Contrast was checked against the card composited over the brightest scene colour that can sit behind it. All text tokens pass 4.5:1. If you change a token, recheck it.

## 8. Scene layers

**State** layers repeat what the label already says. **Decorative** layers carry no money information.

### Moonlit Forest

| Element | Role | Calm | Over | Reduced motion |
|---|---|---|---|---|
| Deer | State | Walks a few steps, lowers head to graze, turns and walks back (24 s loop) | Turns and walks out of frame over 3.2 s, stays gone | Standing still. Over: absent |
| Moon | State | Full, soft glow | Crescent (mask circle slides in), glow 35% | Same two phases, no slide |
| River and fish | State | Ripple lines flow; a fish jumps about every 11 s | Ripple lines stop and dim to 22%, no fish | Static lines, no fish |
| Pines | Decorative | Sway about 0.9 deg on 6.5 to 10.4 s loops, out of phase | Unchanged | Static |
| Leaves | Decorative | Rustle bursts every 4.2 s | Unchanged | Static |
| Stars | Decorative | Twinkle 3.5 to 7.5 s | Unchanged | Static |

### Sunset Beach

| Element | Role | Calm | Over | Reduced motion |
|---|---|---|---|---|
| Sky gradient | State | Golden sunset | Eases to twilight over 2 s | Swap with 0.25 s fade |
| Sun | State | Above horizon (y 280) | Settles on horizon (y 324), 60% opacity | Same positions |
| Stars | State | Hidden | Fade in | Static |
| Waves | Decorative | Two lines roll on 30 s and 44 s loops | Unchanged | Static |
| Clouds | Decorative | Drift about 30 px over 90 to 120 s | Recolour with sky | Static |
| Water light | Decorative | Reflection shimmer 3.8 s, foam laps 8 s | Cools and dims | Static |

### Rainy City

| Element | Role | Calm | Over | Reduced motion |
|---|---|---|---|---|
| Window light | State | Warm amber | Cools to blue white over 2 s | Same colours |
| Rain | State | Light drizzle | Heavier, second layer fades in | Static streaks, same density |
| Street reflections | State | Warm streaks | Brighter and cooler | Static |
| Train | Decorative | Crosses viaduct every 20 s, inside the focal band | Unchanged | Parked mid frame |
| Bus | Decorative | Passes every 26 s | Unchanged | Parked |
| Ripples and flicker | Decorative | Puddle rings 2.6 s; about 8% of windows dim briefly | Ripples follow rain | Static, no flicker |

Over budget should feel atmospheric, never like an alarm: no red scene colours, no flashing, no shake, no lightning.

## 9. Screens

- **Home:** hero (section 4), "Where it went" card (donut plus top 4 categories), "Recent" card (4 rows, "See all").
- **Ask:** chat over real stats from `lib/ask.js` and `lib/stats.js`. Add a caption: "Figures are calculated from your N logged expenses, not estimated." Suggestion chips stay.
- **Add:** a segmented control with **Type | Speak | Receipt**.
  - Type: amount first (large field), then description, category chips, date.
  - Speak: the existing VoiceButton flow, with a parsed preview before saving.
  - Receipt: OCR then a review screen. It shows the total read (marked "Total read clearly" when confidence is high), the merchant field (highlighted with "Partly blurry, please check" when confidence is low), a suggested category chip, line items, date, and the primary button "Add S$X". Plus a Retake link.
- **History:** a summary card (average month, months over budget), then month rows with total, bar, status word and "% of budget" or "S$X over".
- **Budget:** monthly budget with Edit, Spent / Left (or Over by) / per day, a status line, the "Wallpaper reflects my budget" switch, and per-category rows with status.
- **Empty states** (no data this month): Home shows S$0.00 of the budget and a card with the theme title plus "Nothing logged for October yet. Add what you spend as you go and this page fills in." and the button "Add your first expense" (opens Add in Type mode). Theme titles: Forest "A quiet clearing", Beach "Calm water", City "Quiet streets". History, Ask and Budget each show a one-line reason and no fake data.
- Remove emoji from all UI copy.

## 10. Build phases

1. **Scene engine:** render once, `data-over`, seamless loops, pausing, reduced motion. Touch only `src/themes/scenes.js`, `src/hooks/useTheme.js` and the minimum needed in `src/App.jsx`.
2. **Tokens and layout:** fonts, theme tokens, cards, scrim, hero zones, the new tab bar, settings in the header. Remove the old themes.
3. **Screens:** the Budget tab, History status rows, Ask caption, empty states, the Add segmented control (Type and Speak).
4. **OCR receipts:** see section 12.

After each phase: `npm run dev` at 390 px width, `npm run smoke`, then commit.

## 11. Reference markup

`docs/design-canvas/*.dc.html` is the canvas source. It is **not** runnable in this app (it uses the canvas runtime's `{{ }}` holes, `<sc-if>` and `<sc-for>`). Use it for exact SVG coordinates, keyframes and CSS:

- `Phone.dc.html`: all three scene SVGs, the keyframes, the token CSS, and every screen's markup. `renderVals()` holds the tree, star, window and rain generators.
- `Forest.dc.html`: the theme board (it also renders Beach and City through a `theme` prop).
- `System.dc.html`: the shared rules. `Main.dc.html`: the interactive prototype.

## 12. OCR receipts

- This is a change to the PRD. Update the non-goal "No ML categorisation" to allow receipt OCR plus a suggested category.
- The app is a static GitHub Pages PWA. **Never put a cloud OCR API key in frontend code.** It would be public.
- Option A: on-device OCR with Tesseract.js. Free, works offline, the photo never leaves the phone. Accuracy on thermal receipts is uncertain, so test it with real receipts before committing to it.
- Option B: a cloud receipt API called through a serverless function that holds the key.
- Either way, nothing saves until the user taps "Add S$X" on the review screen. Low-confidence fields must be highlighted, never silently accepted.

---

## 13. Amendments — round two

Decisions taken 2026-10-02, after the first build was reviewed on screen.

**Scenes stay wordless.** The plane tows a smiley/frown pennant and the city
lights form a face; neither spells the status out. §1 stands: the wallpaper is a
second reading, never the first.

**The city face is a face only.** The tower's window grid is 8 columns wide;
"BELOW BUDGET" needs roughly 60. A 7x7 face reads at phone size, the rest of the
grid stays random, and the flicker continues.

**Scenes are seeded fresh on every load.** Element positions and timings differ
each time the app opens. One fixed loop per session, so §3.7 still holds.

**Cards drop to 0.80 opacity** so the wallpaper reads through them. §7's
contrast was verified at 0.90/0.95; 0.80 keeps body text clear of 4.5:1.

**History becomes Overview**, gains an add-to-this-month action, and makes the
month rows visibly tappable. **Budget's tab becomes Settings**, and the header
gear goes with it.
