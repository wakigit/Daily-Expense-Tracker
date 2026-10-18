/**
 * Wallpaper painting.
 *
 * Scenes (forest, beach, city) are the live wallpapers. Built ONCE and kept
 * mounted. Everything that changes with the budget is a CSS rule keyed on
 *     `data-decay` on the scene root — 0 healthy, 1 strained, 2 run down. No
 *     JavaScript touches the SVG after it is built, so no animation ever
 *     restarts mid-month.
 * Coordinates are the canvas reference verbatim: every scene is composed in a
 * 390x844 box and scaled to the viewport by `preserveAspectRatio="xMidYMin
 * slice"`. That is why nothing here reads the window size — a resize costs a
 * repaint of zero elements, which is what rule 3.4 is really asking for.
 *
 * The Y alignment is Min, not Mid, and that is load-bearing: the layout zones
 * in section 4 of the redesign spec are all measured down from the top of the
 * screen. Centring the overflow instead would crop roughly 80px off the top on
 * a 375x667 phone, dropping the deer, the sun and the train out of the focal
 * band and in behind the hero text.
 *
 * Kept as string generators rather than JSX on purpose: they are pure geometry
 * with no user input, and the #bg element they fill sits outside the React tree.
 */

/* ── Scene plumbing ────────────────────────────────────────────── */

/**
 * The two boxes a scene can be composed in. Nothing inside a composition reads
 * the viewport — the box is chosen once, at build, and the art is laid out in
 * its coordinates from there.
 *
 * The wide box is not the phone box stretched. A phone scene stacks its subject
 * down the middle because that is the only axis it has; a laptop has a left
 * rail, a centre column and a ledger sitting on top of the art, so the wide
 * compositions put their sky above the content and their focal band BELOW it,
 * in the band of the screen the UI leaves empty.
 */
const VB_W = 390;
const VB_H = 844;
const VW_W = 1440;
const VW_H = 900;

/** The width at or above which the laptop composition is used. Matches the
 *  layout breakpoint in app.css — one number, two files, so they cannot drift
 *  into a state where the wide art is drawn under the phone layout. */
export const WIDE_QUERY = '(min-width: 1024px)';

export const isWide = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(WIDE_QUERY).matches
    : false;

/**
 * One seed per page load. Within a session every rebuild draws exactly the same
 * scene — so a theme switch and back does not reshuffle the forest — but open
 * the app tomorrow and the stars, the fish and the crab have moved.
 */
const SEED = Math.random() * 997;

const rnd = (i, s) => {
  const v = Math.sin((i + SEED) * 12.9898 + s * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

/** Random float in a range, from the per-load seed. */
const rr = (i, s, lo, hi) => lo + rnd(i, s) * (hi - lo);

/**
 * How far something has to travel to leave the frame, and how far back to park
 * it before it returns. Fed to the `--out` / `--in` custom properties the travel
 * keyframes read.
 *
 * This exists because the answer depends on three things the stylesheet cannot
 * see: the box the scene is composed in, where the element sits in it, and how
 * wide the element is. The first version of the widescreen scenes inherited the
 * phone's hard-coded numbers, so a car "exiting right" stopped at x 1150 in a
 * 1440 box and then jumped back to x 380 in full view — the loop reset while
 * the viewer was watching. One function, unit tested, instead of ten literals.
 *
 * `pad` keeps the reset well clear of the edge rather than exactly on it, so a
 * rounding error or a stroke overhang cannot put a sliver back on screen.
 */
export function travel(boxW, startX, elW, pad = 30) {
  return {
    out: Math.round(boxW - startX + pad),
    in: Math.round(-(startX + elW + pad)),
  };
}

/** The same, as the inline style the keyframes read. */
/**
 * The y of a cubic Bezier at a given t, and the x beside it.
 *
 * Added because the widescreen fish were positioned by eye against a river
 * drawn as a curve: the river's surface falls 178 units from right to left,
 * so a fish at a fixed y was in the water at one end of the frame and jumping
 * off dry land at the other. Anything that has to sit ON the water now asks
 * the water where it is.
 */
export function bezierAt(t, p0, p1, p2, p3) {
  const u = 1 - t;
  const b = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return {
    x: b[0] * p0[0] + b[1] * p1[0] + b[2] * p2[0] + b[3] * p3[0],
    y: b[0] * p0[1] + b[1] * p1[1] + b[2] * p2[1] + b[3] * p3[1],
  };
}

const travelStyle = (...args) => {
  const t = travel(...args);
  return `--out:${t.out}px;--in:${t.in}px`;
};

/**
 * Every calm/over difference in the three scenes, as CSS.
 *
 * This is the whole point of the rewrite. The old engine re-serialised the SVG
 * whenever spending moved, which restarted every animation — log an expense and
 * the deer teleported back to the edge of the frame. Here the only thing that
 * changes is `data-decay` on the root, and the cascade does the rest.
 *
 * `.a` marks an animated element (so loops can be paused or dropped as a set),
 * `.tr`/`.trc` mark the ones that ease between the two states.
 */
const SCENE_CSS = `
/* The scene keeps the 390x844 shape it was drawn in and is sized off the
   viewport HEIGHT, not stretched to the width. Filling the width instead meant
   that on any non-phone aspect ratio the art scaled up until only the top
   quarter was on screen — at 1512x836 that is a 3.9x zoom showing y 0..216, so
   the deer at y 292, the river and the whole treeline were simply gone. Sized
   this way the full composition is always visible; on a phone the width works
   out to the full screen anyway, and --ground covers any gap beside it. */
#bg .scene{position:fixed;top:0;left:50%;transform:translateX(-50%);height:100%;width:auto;aspect-ratio:390/844;min-width:100%;z-index:-1;pointer-events:none;display:block}

/* Only phones get the edge-to-edge treatment; wider screens let the scene sit
   as a tall panel so nothing in the focal band is cropped away. */
@media (min-aspect-ratio: 390/844){
  #bg .scene{min-width:0}
}

/* At laptop width a DIFFERENT composition is mounted — 1440x900, drawn for a
   screen with a rail and two columns on it — so it covers the viewport instead
   of sitting as a panel. The tall scene is never shown here and vice versa;
   only one is ever in the DOM. */
@media (min-width: 1024px){
  #bg .scene{left:0;transform:none;width:100%;height:100%;min-width:0;aspect-ratio:auto}
}

/* ── Healthy, then the strained and run-down overrides. ──
 *
 * Three states, not two. They are a projection of "budgetStatus().key" — see
 * "decayLevel()" in lib/status.js — so the scene cannot say "run down" while
 * the chip on top of it says "On track".
 *
 * Written as plain paired rules rather than custom properties read through
 * var(): the value a given element takes in each state is readable straight
 * off these lines, and devtools shows which rule won. Level 1 is the one that
 * has to work hardest — "level 0 with the brightness down" is not a state, so
 * every scene makes at least one STRUCTURAL change at level 1 (fog appears,
 * litter appears, windows go dark) rather than only shifting colour.
 *
 * Every property that differs between levels must also appear in the ".trc"
 * transition list below, or it snaps instead of easing. smoke.jsx asserts this. */

/* ── forest ── */
#bg .moon-0{opacity:1}
#bg .moon-1,#bg .moon-2{opacity:0}
#bg .moon-glow{opacity:1}
#bg .moon-reflect{opacity:0.4}
#bg .river-lines{opacity:0.55}
#bg .fish-group{opacity:1}
#bg .fish-b,#bg .fish-c{opacity:1}
#bg .deer{transform:translateX(0);opacity:1}
#bg .ridge-far{opacity:0.85}
#bg .fog{opacity:0}
#bg .leaf-drop{opacity:0}
#bg .deadfall{opacity:0}
#bg .bare{opacity:0}

#bg .scene[data-decay="1"] .moon-0{opacity:0}
#bg .scene[data-decay="1"] .moon-1{opacity:1}
#bg .scene[data-decay="1"] .moon-glow{opacity:0.66}
#bg .scene[data-decay="1"] .moon-reflect{opacity:0.24}
#bg .scene[data-decay="1"] .river-lines{opacity:0.36}
#bg .scene[data-decay="1"] .fish-b,#bg .scene[data-decay="1"] .fish-c{opacity:0}
#bg .scene[data-decay="1"] .ridge-far{opacity:0.5}
#bg .scene[data-decay="1"] .fog{opacity:0.32}
#bg .scene[data-decay="1"] .leaf-drop{opacity:0.75}
#bg .scene[data-decay="1"] .deadfall{opacity:0.45}
#bg .scene[data-decay="1"] .bare{opacity:0.35}

#bg .scene[data-decay="2"] .moon-0{opacity:0}
#bg .scene[data-decay="2"] .moon-2{opacity:1}
#bg .scene[data-decay="2"] .moon-glow{opacity:0.35}
#bg .scene[data-decay="2"] .moon-reflect{opacity:0.12}
#bg .scene[data-decay="2"] .river-lines{opacity:0.22}
#bg .scene[data-decay="2"] .fish-group{opacity:0}
#bg .scene[data-decay="2"] .deer{transform:translateX(-170px);opacity:0}
#bg .scene[data-decay="2"] .ridge-far{opacity:0.28}
#bg .scene[data-decay="2"] .fog{opacity:0.66}
/* Fewer leaves fall at level 2 than at level 1, which is not a typo: by then
   the branches they were falling from are bare. */
#bg .scene[data-decay="2"] .leaf-drop{opacity:0.45}
#bg .scene[data-decay="2"] .deadfall{opacity:0.85}
#bg .scene[data-decay="2"] .bare{opacity:0.85}

/* ── beach ── */
#bg .s0{stop-color:#3B2A5C}
#bg .s1{stop-color:#8E4466}
#bg .s2{stop-color:#E07A5F}
#bg .s3{stop-color:#F9B97F}
#bg .sun-edge{stop-color:#F29A5B}
#bg .sun,#bg .sun-glow{cy:230px}
#bg .sun{opacity:1}
#bg .sea-top{stop-color:#E59A72}
#bg .waterline{fill:#FFD9B4}
#bg .sand-top{stop-color:#D9A184}
#bg .cloud-col{fill:#F4B49A}
#bg .reflect{fill:#FFD7A1;opacity:0.9}
#bg .beach-stars{opacity:0}
#bg .pennant-fill{fill:#FFF1E2}
#bg .pennant-face{fill:#B3261E}
#bg .mouth-happy,#bg .mouth-flat,#bg .mouth-sad{stroke:#B3261E}
#bg .mouth-happy{opacity:1}
#bg .mouth-flat{opacity:0}
#bg .mouth-sad{opacity:0}
#bg .surf-wrap{opacity:1}
#bg .crab-wrap{opacity:1}
#bg .rocks{opacity:0.85}
#bg .litter{opacity:0}

#bg .scene[data-decay="1"] .s0{stop-color:#231E46}
#bg .scene[data-decay="1"] .s1{stop-color:#593760}
#bg .scene[data-decay="1"] .s2{stop-color:#965C69}
#bg .scene[data-decay="1"] .s3{stop-color:#C39287}
#bg .scene[data-decay="1"] .sun-edge{stop-color:#DE7F69}
#bg .scene[data-decay="1"] .sun,#bg .scene[data-decay="1"] .sun-glow{cy:255px}
#bg .scene[data-decay="1"] .sun{opacity:0.82}
#bg .scene[data-decay="1"] .sea-top{stop-color:#9A7272}
#bg .scene[data-decay="1"] .waterline{fill:#CCB6BA}
#bg .scene[data-decay="1"] .sand-top{stop-color:#A47B7A}
#bg .scene[data-decay="1"] .cloud-col{fill:#A8868F}
#bg .scene[data-decay="1"] .reflect{fill:#DBB9B3;opacity:0.65}
#bg .scene[data-decay="1"] .beach-stars{opacity:0.4}
#bg .scene[data-decay="1"] .pennant-fill{fill:#F3E5E3}
#bg .scene[data-decay="1"] .pennant-face{fill:#96383F}
#bg .scene[data-decay="1"] .mouth-happy,
#bg .scene[data-decay="1"] .mouth-flat,
#bg .scene[data-decay="1"] .mouth-sad{stroke:#96383F}
#bg .scene[data-decay="1"] .mouth-happy{opacity:0}
#bg .scene[data-decay="1"] .mouth-flat{opacity:1}
#bg .scene[data-decay="1"] .surf-wrap{opacity:0.55}
#bg .scene[data-decay="1"] .rocks{opacity:0.6}
#bg .scene[data-decay="1"] .litter{opacity:0.5}

#bg .scene[data-decay="2"] .s0{stop-color:#0B1230}
#bg .scene[data-decay="2"] .s1{stop-color:#23295A}
#bg .scene[data-decay="2"] .s2{stop-color:#4B3F72}
#bg .scene[data-decay="2"] .s3{stop-color:#8C6A8E}
#bg .scene[data-decay="2"] .sun-edge{stop-color:#C9637A}
#bg .scene[data-decay="2"] .sun,#bg .scene[data-decay="2"] .sun-glow{cy:280px}
#bg .scene[data-decay="2"] .sun{opacity:0.6}
#bg .scene[data-decay="2"] .sea-top{stop-color:#4E4A72}
#bg .scene[data-decay="2"] .waterline{fill:#9A93C0}
#bg .scene[data-decay="2"] .sand-top{stop-color:#6E5470}
#bg .scene[data-decay="2"] .cloud-col{fill:#5D5884}
#bg .scene[data-decay="2"] .reflect{fill:#B79BC4;opacity:0.4}
#bg .scene[data-decay="2"] .beach-stars{opacity:1}
#bg .scene[data-decay="2"] .pennant-fill{fill:#E8D9E4}
#bg .scene[data-decay="2"] .pennant-face{fill:#7A4A63}
#bg .scene[data-decay="2"] .mouth-happy,
#bg .scene[data-decay="2"] .mouth-flat,
#bg .scene[data-decay="2"] .mouth-sad{stroke:#7A4A63}
#bg .scene[data-decay="2"] .mouth-happy{opacity:0}
#bg .scene[data-decay="2"] .mouth-sad{opacity:1}
#bg .scene[data-decay="2"] .surf-wrap{opacity:0}
#bg .scene[data-decay="2"] .crab-wrap{opacity:0}
#bg .scene[data-decay="2"] .rocks{opacity:0.35}
#bg .scene[data-decay="2"] .litter{opacity:0.9}

/* ── city ── */
#bg .win-col{fill:#F6C27A}
#bg .win-stop{stop-color:#F6C27A}
#bg .lamp-col{fill:#F7B65E}
#bg .lamp-stop{stop-color:#F7B65E}
#bg .horizon-stop{stop-color:#6A4E62}
#bg .rain-layer{opacity:0.2}
#bg .rain-heavy{opacity:0}
#bg .street-ref{opacity:0.5}
#bg .face-happy{opacity:1}
#bg .face-flat{opacity:0}
#bg .face-sad{opacity:0}
#bg .win-dark{opacity:1}
#bg .viaduct-lamp{opacity:1}
#bg .skyline-far{opacity:0.7}
#bg .puddle-wide{opacity:0}

#bg .scene[data-decay="1"] .win-col{fill:#CFC2AC}
#bg .scene[data-decay="1"] .win-stop{stop-color:#CFC2AC}
#bg .scene[data-decay="1"] .lamp-col{fill:#E5CCA9}
#bg .scene[data-decay="1"] .lamp-stop{stop-color:#E5CCA9}
#bg .scene[data-decay="1"] .horizon-stop{stop-color:#4E4C65}
#bg .scene[data-decay="1"] .rain-layer{opacity:0.38}
#bg .scene[data-decay="1"] .rain-heavy{opacity:0.22}
#bg .scene[data-decay="1"] .street-ref{opacity:0.7}
#bg .scene[data-decay="1"] .face-happy{opacity:0}
#bg .scene[data-decay="1"] .face-flat{opacity:1}
/* Half the block goes dark. This is the structural level-1 change for the
   city — a colour shift alone read as "same picture, cooler". */
#bg .scene[data-decay="1"] .win-dark{opacity:0.3}
#bg .scene[data-decay="1"] .viaduct-lamp{opacity:0.45}
#bg .scene[data-decay="1"] .skyline-far{opacity:0.42}
#bg .scene[data-decay="1"] .puddle-wide{opacity:0.45}

#bg .scene[data-decay="2"] .win-col{fill:#A9C1DE}
#bg .scene[data-decay="2"] .win-stop{stop-color:#A9C1DE}
#bg .scene[data-decay="2"] .lamp-col{fill:#D3E2F4}
#bg .scene[data-decay="2"] .lamp-stop{stop-color:#D3E2F4}
#bg .scene[data-decay="2"] .horizon-stop{stop-color:#334A68}
#bg .scene[data-decay="2"] .rain-layer{opacity:0.6}
#bg .scene[data-decay="2"] .rain-heavy{opacity:0.6}
#bg .scene[data-decay="2"] .street-ref{opacity:0.9}
#bg .scene[data-decay="2"] .face-happy{opacity:0}
#bg .scene[data-decay="2"] .face-sad{opacity:1}
#bg .scene[data-decay="2"] .win-dark{opacity:0.06}
#bg .scene[data-decay="2"] .viaduct-lamp{opacity:0.12}
#bg .scene[data-decay="2"] .skyline-far{opacity:0.22}
#bg .scene[data-decay="2"] .puddle-wide{opacity:0.85}

/* ── The move between levels (3.8). Reversible by construction: spend more and
   it eases one way, delete the expense and it eases straight back. ── */
#bg .tr{transition:transform 3.2s cubic-bezier(0.45,0,0.55,1),opacity 1.4s ease 1.8s}
#bg .trc{transition:cx 2.4s cubic-bezier(0.16,1,0.3,1),cy 2.4s cubic-bezier(0.16,1,0.3,1),opacity 2s ease,fill 2s ease,stroke 2s ease,stop-color 2s ease}

/* ── Loops. Each ends exactly where it starts (3.7). ── */
#bg .tw{animation:w-tw 5s ease-in-out infinite}
@keyframes w-tw{0%,100%{opacity:.9}50%{opacity:.25}}
#bg .sway{transform-box:fill-box;transform-origin:50% 100%;animation:w-sway 7s ease-in-out infinite}
@keyframes w-sway{0%,100%{transform:rotate(-0.9deg)}50%{transform:rotate(0.9deg)}}
#bg .rustle{transform-box:fill-box;transform-origin:50% 50%;animation:w-rustle 4.2s ease-in-out infinite}
@keyframes w-rustle{0%,68%,100%{transform:rotate(0)}74%{transform:rotate(16deg)}80%{transform:rotate(-12deg)}86%{transform:rotate(6deg)}}
#bg .flow{animation:w-flow 5s linear infinite}
@keyframes w-flow{to{stroke-dashoffset:-48}}
/* The deer works the clearing rather than pacing: out, graze, further out,
   graze, turn, back, graze, home — ending on the opening pose so the 34s loop
   closes invisibly. The head keyframes share the duration so the grazes land
   while it is standing still. */
#bg .deerwalk{transform-box:fill-box;transform-origin:50% 50%;animation:w-deer 34s ease-in-out infinite}
@keyframes w-deer{
  0%,4%{transform:translateX(0) scaleX(1)}
  14%,24%{transform:translateX(calc(34px * var(--k,1))) scaleX(1)}
  34%,44%{transform:translateX(calc(74px * var(--k,1))) scaleX(1)}
  46%{transform:translateX(calc(74px * var(--k,1))) scaleX(-1)}
  58%,68%{transform:translateX(calc(40px * var(--k,1))) scaleX(-1)}
  80%{transform:translateX(0) scaleX(-1)}
  84%,100%{transform:translateX(0) scaleX(1)}
}
#bg .deerhead{transform-box:fill-box;transform-origin:0% 100%;animation:w-graze 34s ease-in-out infinite}
@keyframes w-graze{
  0%,16%{transform:rotate(0)}
  19%,23%{transform:rotate(68deg)}
  21%{transform:rotate(61deg)}
  26%,36%{transform:rotate(0)}
  39%,43%{transform:rotate(71deg)}
  41%{transform:rotate(64deg)}
  46%,60%{transform:rotate(0)}
  63%,67%{transform:rotate(66deg)}
  65%{transform:rotate(59deg)}
  70%,100%{transform:rotate(0)}
}

/* Traffic. One 24s cycle shared by the light and both cars, so they can't drift
   out of agreement: red 0-35%, green 35-85%, amber 85-92%, red again to the
   end. Starting and ending on red is what makes the loop close.
   The cars leave on green, exit right, and return from the left while entirely
   off-frame — the jump between those two positions happens outside the 0..390
   box, so nothing is seen teleporting. */
#bg .lamp-red{animation:w-red 24s steps(1) infinite}
@keyframes w-red{0%,35%{opacity:1}35.01%,91.99%{opacity:0.1}92%,100%{opacity:1}}
#bg .lamp-amber{animation:w-amber 24s steps(1) infinite}
@keyframes w-amber{0%,84.99%{opacity:0.1}85%,92%{opacity:1}92.01%,100%{opacity:0.1}}
#bg .lamp-green{animation:w-green 24s steps(1) infinite}
@keyframes w-green{0%,34.99%{opacity:0.1}35%,85%{opacity:1}85.01%,100%{opacity:0.1}}

/* Travel distances are NOT written here.
 *
 * Every keyframe below that carries something across the frame reads --out and
 * --in from the element itself, because how far "off the right edge" is depends
 * on the box the scene was composed in and on where the element starts — and
 * the builder is the only thing that knows both. Hard-coding them worked
 * exactly as long as there was one composition: the moment the 1440-wide scenes
 * landed, a car "exiting right" stopped at x 1150 and then jumped back to x 380
 * in full view. The fallbacks keep a scene honest if a var is ever missing. */
#bg .car-a{animation:w-car-a 24s linear infinite}
@keyframes w-car-a{
  0%,35%{transform:translateX(0)}
  60%{transform:translateX(var(--out,330px))}
  60.001%{transform:translateX(var(--in,-440px))}
  86%,100%{transform:translateX(0)}
}
#bg .car-b{animation:w-car-b 24s linear infinite}
@keyframes w-car-b{
  0%,38%{transform:translateX(0)}
  64%{transform:translateX(var(--out,340px))}
  64.001%{transform:translateX(var(--in,-440px))}
  90%,100%{transform:translateX(0)}
}

/* The plane crosses once a minute, pennant trailing. Parked off-frame at both
   ends of the loop so the reset is never seen. */
#bg .plane{animation:w-plane 58s linear infinite}
@keyframes w-plane{0%{transform:translateX(var(--in,-240px))}72%,100%{transform:translateX(var(--out,540px))}}
#bg .pennant{transform-box:fill-box;transform-origin:100% 50%;animation:w-flap 1.6s ease-in-out infinite}
@keyframes w-flap{0%,100%{transform:rotate(-1.6deg)}50%{transform:rotate(1.6deg)}}

/* The surfer.
 *
 * Travel alone made him a sticker sliding across a painting: the group moved,
 * nothing inside it did. The motion is layered instead, on four periods that
 * do not divide into each other (26s, 2.6s, 1.9s, 1.3s, 0.9s), so the
 * combination never repeats in a way the eye can latch onto.
 *   .surfer     — crosses the bay
 *   .surf-bob   — board and rider ride up and down the face, tilting with it
 *   .surf-crest — the wave body swells and leans
 *   .surf-curl  — the lip throws forward
 *   .surf-foam  — spray, fastest and least regular
 */
#bg .surfer{animation:w-surf 26s linear infinite}
@keyframes w-surf{
  0%{opacity:0;transform:translateX(var(--out,410px))}
  6%{opacity:1}
  94%{opacity:1}
  100%{opacity:0;transform:translateX(var(--in,-40px))}
}
#bg .surf-bob{transform-box:fill-box;transform-origin:50% 100%;animation:w-surfbob 2.6s ease-in-out infinite}
@keyframes w-surfbob{
  0%,100%{transform:translateY(1px) rotate(-5deg)}
  32%{transform:translateY(-4px) rotate(6deg)}
  64%{transform:translateY(3px) rotate(-2deg)}
}
#bg .surf-rider{transform-box:fill-box;transform-origin:50% 100%;animation:w-rider 2.6s ease-in-out infinite}
@keyframes w-rider{
  0%,100%{transform:rotate(4deg)}
  32%{transform:rotate(-5deg)}
  64%{transform:rotate(2deg)}
}
#bg .surf-crest{transform-box:fill-box;transform-origin:50% 100%;animation:w-crest 1.9s ease-in-out infinite}
@keyframes w-crest{0%,100%{transform:scaleY(1) skewX(0deg)}50%{transform:scaleY(1.12) skewX(-4deg)}}
#bg .surf-curl{transform-box:fill-box;transform-origin:100% 100%;animation:w-curl 1.3s ease-in-out infinite}
@keyframes w-curl{0%,100%{transform:translate(0,0) rotate(0deg)}50%{transform:translate(-3px,-2px) rotate(-8deg)}}
#bg .surf-foam{animation:w-foam 0.9s ease-in-out infinite}
@keyframes w-foam{0%,100%{opacity:0.4;transform:translate(0,0)}50%{opacity:0.95;transform:translate(-2px,-1.5px)}}

/* The crab works the sand sideways, the way crabs do, pausing to dig. */
#bg .crab{animation:w-crab 38s ease-in-out infinite}
@keyframes w-crab{
  0%,5%{transform:translateX(0)}
  22%,30%{transform:translateX(calc(58px * var(--k,1)))}
  48%,56%{transform:translateX(calc(126px * var(--k,1)))}
  72%,80%{transform:translateX(calc(64px * var(--k,1)))}
  96%,100%{transform:translateX(0)}
}
#bg .crab-leg{transform-box:fill-box;transform-origin:50% 0%;animation:w-scuttle 0.42s ease-in-out infinite}
@keyframes w-scuttle{0%,100%{transform:rotate(-13deg)}50%{transform:rotate(13deg)}}

/* Laptop legs share the 16-second patrol's rests; the phone loop is untouched. */
#bg .crab--wide .crab-leg{animation-name:w-scuttle-wide;animation-duration:16s;animation-timing-function:linear;animation-delay:0s !important;--leg-sign:1}
#bg .crab--wide .crab-leg:nth-child(even){--leg-sign:-1}
@keyframes w-scuttle-wide{
  0%,5%,22%,30%,48%,56%,72%,80%,96%,100%{transform:rotate(0deg)}
  7%,11%,15%,19%,32%,36%,40%,44%,58%,62%,66%,70%,82%,86%,90%,94%{transform:rotate(calc(26deg * var(--leg-sign)))}
  9%,13%,17%,21%,34%,38%,42%,46%,60%,64%,68%,84%,88%,92%{transform:rotate(calc(-26deg * var(--leg-sign)))}
}

/* A shooting star is almost all waiting. Opacity 0 at both ends of the loop is
   what lets it reset its position without anyone seeing the jump (§3.7). */
#bg .shoot{animation:w-shoot 1s linear infinite}
@keyframes w-shoot{
  0%,87%{opacity:0;transform:translate(0,0)}
  88.5%{opacity:0.95;transform:translate(-8px,5px)}
  96%{opacity:0.95;transform:translate(-96px,58px)}
  100%{opacity:0;transform:translate(-124px,75px)}
}
#bg .fish{opacity:0;transform-box:fill-box;transform-origin:50% 50%;animation:w-fish 11s ease-out infinite}
@keyframes w-fish{0%,84%{opacity:0;transform:translate(0,0) rotate(-40deg)}86%{opacity:1;transform:translate(-6px,-16px) rotate(-22deg)}90%{opacity:1;transform:translate(-13px,-22px) rotate(12deg)}94%{opacity:1;transform:translate(-20px,-6px) rotate(48deg)}96%,100%{opacity:0;transform:translate(-22px,0) rotate(60deg)}}
#bg .ripple{opacity:0;transform-box:fill-box;transform-origin:50% 50%;animation:w-ripple 11s ease-out infinite}
@keyframes w-ripple{0%,84%{opacity:0;transform:scale(.4)}85%{opacity:.7;transform:scale(.5)}89%{opacity:0;transform:scale(1.5)}94%{opacity:0;transform:scale(.4)}95%{opacity:.7;transform:scale(.5)}100%{opacity:0;transform:scale(1.7)}}
/* A leaf comes down, turning as it goes. Opacity 0 at both ends is what lets
   it reset its position unseen — the same trick the shooting star and the rain
   use. The decay level gates the parent group's opacity, and the two multiply,
   so this loop never has to know which state the scene is in. */
#bg .leaffall{transform-box:fill-box;transform-origin:50% 50%;animation:w-leaf 12s linear infinite}
@keyframes w-leaf{
  0%{opacity:0;transform:translate(0,0) rotate(0deg)}
  9%{opacity:1}
  84%{opacity:1}
  100%{opacity:0;transform:translate(-20px,108px) rotate(310deg)}
}
#bg .drift{animation:w-drift 90s ease-in-out infinite alternate}
@keyframes w-drift{from{transform:translateX(-26px)}to{transform:translateX(34px)}}
#bg .wave{animation:w-wave 30s linear infinite}
/* Closes only if the shift is a whole number of crest periods — 390/30 on the
   phone, 1440/40 wide. Wrong value and the sea visibly snaps once a cycle. */
@keyframes w-wave{from{transform:translateX(0)}to{transform:translateX(var(--wave,-390px))}}
#bg .shim{animation:w-tw 3.8s ease-in-out infinite}
#bg .lap{animation:w-lap 8s ease-in-out infinite}
@keyframes w-lap{0%,100%{transform:translateY(0)}50%{transform:translateY(4px)}}
#bg .glow{animation:w-glow 9s ease-in-out infinite}
@keyframes w-glow{0%,100%{opacity:.75}50%{opacity:1}}
#bg .train{animation:w-train 20s linear infinite}
@keyframes w-train{0%{transform:translateX(var(--in,-360px))}42%{transform:translateX(var(--out,430px))}100%{transform:translateX(var(--out,430px))}}
#bg .flick{animation:w-flick 13s steps(1) infinite}
@keyframes w-flick{0%,58%{opacity:1}60%,74%{opacity:.15}76%,100%{opacity:1}}
#bg .rain{animation:w-rain .95s linear infinite}
@keyframes w-rain{0%{opacity:0;transform:translate(4px,-70px)}12%{opacity:1}88%{opacity:1}100%{opacity:0;transform:translate(-8px,90px)}}
#bg .drip{transform-box:fill-box;transform-origin:50% 50%;animation:w-drip 2.6s ease-out infinite}
@keyframes w-drip{0%{opacity:.8;transform:scale(.2)}100%{opacity:0;transform:scale(1.6)}}

/* The one place a loop is allowed to stop rather than fade. Over budget stills
   the water rather than reversing it: a river that flows backwards reads as a
   bug, not as a mood.

   At level 1 only the deer's head stops — it lifts out of the graze and stands
   alert while the body still works the clearing. Note the asymmetry this
   creates: stopping is instant, but recovering restarts the loop from frame
   zero, so a deer that was mid-stride resumes standing. That is visible only
   at the moment a budget is edited back down, and it is the price of using
   "animation:none" at all. */
#bg .scene[data-decay="1"] .deerhead{animation:none}
#bg .scene[data-decay="2"] .flow,
#bg .scene[data-decay="2"] .deerwalk,
#bg .scene[data-decay="2"] .deerhead{animation:none}

/* ── 3.6 pause, 3.9 reduced motion ── */
#bg .scene.paused .a{animation-play-state:paused}
#bg .scene.still .a{animation:none !important}
#bg .scene.still .tr,#bg .scene.still .trc{transition:opacity .25s linear !important}
@media (prefers-reduced-motion: reduce){
  :root:not([data-motion="on"]) #bg .scene .a{animation:none !important}
  :root:not([data-motion="on"]) #bg .scene .tr,
  :root:not([data-motion="on"]) #bg .scene .trc{transition:opacity .25s linear !important}
}
`;

/* ── Moonlit forest ────────────────────────────────────────────── */

/**
 * One pine, as a single polygon: five tiers of branches down one side, the
 * trunk, then the same tiers mirrored back up the other. Drawn in one path so
 * a sway rotation moves the whole tree as one rigid body.
 */
function pine(x, base, h, w) {
  const T = 5, top = base - h, tt = base - h * 0.1, L = [[x, top]];
  for (let i = 1; i <= T; i++) {
    const y = top + (tt - top) * i / T;
    const wi = w * (0.22 + 0.78 * i / T);
    L.push([x - wi, y]);
    if (i < T) L.push([x - wi * 0.42, y - h * 0.035]);
  }
  const pts = L.slice();
  pts.push([x - 3, tt], [x - 3, base], [x + 3, base], [x + 3, tt]);
  for (let i = L.length - 1; i >= 1; i--) pts.push([2 * x - L[i][0], L[i][1]]);
  return pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
}

function forestScene() {
  // Stars skip the top-right corner — that is where the moon sits, and a star
  // inside the glow just looks like a speck of dust on the screen.
  const stars = [];
  for (let i = 0; i < 22; i++) {
    const x = Math.round(rnd(i, 1) * 380 + 5);
    const y = Math.round(rnd(i, 2) * 230 + 10);
    if (x > 270 && y < 140) continue;
    stars.push(`<circle class="a tw" cx="${x}" cy="${y}" r="${(0.6 + rnd(i, 7) * 0.9).toFixed(2)}" fill="#E8ECF5" style="animation-delay:${(-rnd(i, 8) * 5).toFixed(1)}s;animation-duration:${(3.5 + rnd(i, 9) * 4).toFixed(1)}s"/>`);
  }

  const tallPines = [[20, 560, 400, 30], [76, 520, 300, 25], [370, 560, 420, 32], [336, 500, 250, 23]]
    .map((d, i) => `<polygon class="a sway" points="${pine(...d)}" style="animation-duration:${(6.5 + i * 1.3).toFixed(1)}s;animation-delay:${(-i * 1.7).toFixed(1)}s"/>`)
    .join('');

  const ridgePines = Array.from({ length: 13 }, (_, i) =>
    `<polygon points="${pine(118 + i * 15 + rnd(i, 3) * 6, 292 + rnd(i, 4) * 10, 34 + rnd(i, 5) * 30, 9 + rnd(i, 6) * 5)}"/>`
  ).join('');

  const leaves = [[34, 300], [8, 330], [50, 360], [88, 312], [64, 380], [356, 330], [384, 300], [322, 352], [350, 392], [384, 420]]
    .map((p, i) => `<ellipse class="a rustle" cx="${p[0]}" cy="${p[1]}" rx="3.2" ry="1.5" style="animation-delay:${(-i * 0.9).toFixed(1)}s"/>`)
    .join('');

  // Three fish, each with its own interval, phase and size, so the river never
  // settles into a rhythm. The ripple shares the fish's timing — it is the same
  // event seen on the surface.
  // `which` tags each fish so level 1 can thin the shoal to one rather than
  // fading all three evenly — three half-transparent fish read as a rendering
  // bug, one fish reads as a river with less in it.
  const fish = (i) => {
    const which = ['fish-a', 'fish-b', 'fish-c'][i];
    const tx = rr(i, 41, 150, 350).toFixed(0);
    const ty = rr(i, 42, 344, 396).toFixed(0);
    const dur = rr(i, 43, 9, 17).toFixed(1);
    const delay = (-rr(i, 44, 0, 17)).toFixed(1);
    const sc = rr(i, 45, 0.78, 1.15).toFixed(2);
    const st = ` style="animation-duration:${dur}s;animation-delay:${delay}s"`;
    return `<g class="trc ${which}" transform="translate(${tx} ${ty}) scale(${sc})">` +
      `<ellipse class="a ripple" cx="0" cy="2" rx="9" ry="2.2" fill="none" stroke="#BFD2EA" stroke-width="0.9"${st}/>` +
      `<path class="a fish" d="M0,0 C4,-3 9,-3 12,0 C9,3 4,3 0,0 Z M12,0 L16,-3 L16,3 Z" fill="#C9D9EE"${st}/></g>`;
  };
  const fishes = [0, 1, 2].map(fish).join('');

  // One or two shooting stars, somewhere in the upper sky, on long lazy cycles
  // so they stay an event rather than a feature.
  /* ── Depth and decay material ──
     Two ridges further back than the original one, each smaller, paler and
     higher up the frame. They are what gives the treeline somewhere to recede
     TO when the scene runs down: a single ridge can only change colour, three
     can lose their distance. */
  const farRidge = (n, y, h, w, salt) => Array.from({ length: n }, (_, i) =>
    `<polygon points="${pine(100 + i * (300 / n) + rnd(i, salt) * 8, y + rnd(i, salt + 1) * 6, h + rnd(i, salt + 2) * 14, w + rnd(i, salt + 3) * 3)}"/>`
  ).join('');

  /* Bare branches, drawn over the tall pines and invisible until the month
     strains. Each is a few strokes from a trunk line, so at full opacity the
     silhouette reads as a dead tree beside the living ones rather than as a
     scribble. */
  const bareTree = (x, base, h) => {
    const top = base - h;
    let d = `M${x},${base} L${x},${top}`;
    for (let i = 1; i <= 5; i++) {
      const y = top + (h * 0.8) * i / 5;
      const len = 6 + i * 3.4;
      const dir = i % 2 ? 1 : -1;
      d += ` M${x},${y} L${x + len * dir},${y - len * 0.55}`;
    }
    return `<path d="${d}"/>`;
  };
  const bareTrees = [[48, 548, 150], [352, 544, 134], [96, 512, 104]]
    .map((t) => bareTree(...t)).join('');

  // Dead leaves on the near bank — above the river, above the card line.
  const deadLeaves = Array.from({ length: 26 }, (_, i) =>
    `<ellipse cx="${rr(i, 71, 4, 386).toFixed(0)}" cy="${rr(i, 72, 300, 326).toFixed(0)}" rx="${rr(i, 73, 1.6, 3.2).toFixed(1)}" ry="${rr(i, 74, 0.8, 1.5).toFixed(1)}" transform="rotate(${rr(i, 75, -40, 40).toFixed(0)} ${rr(i, 71, 4, 386).toFixed(0)} ${rr(i, 72, 300, 326).toFixed(0)})"/>`
  ).join('');

  // Leaves coming down. Each falls on its own clock and lands back where it
  // started, so the loop closes the way every other loop here does.
  const falling = Array.from({ length: 9 }, (_, i) =>
    `<ellipse class="a leaffall" cx="${rr(i, 76, 20, 370).toFixed(0)}" cy="${rr(i, 77, 262, 300).toFixed(0)}" rx="2.6" ry="1.2" style="animation-delay:${(-rr(i, 78, 0, 14)).toFixed(1)}s;animation-duration:${rr(i, 79, 9, 16).toFixed(1)}s"/>`
  ).join('');

  const shootCount = rnd(0, 51) > 0.45 ? 2 : 1;
  const shooting = Array.from({ length: shootCount }, (_, i) => {
    const x = rr(i, 52, 150, 360).toFixed(0);
    const y = rr(i, 53, 24, 150).toFixed(0);
    const len = rr(i, 54, 16, 30).toFixed(0);
    const dur = rr(i, 55, 26, 48).toFixed(0);
    const delay = (-rr(i, 56, 0, 40)).toFixed(0);
    return `<g class="a shoot" style="animation-duration:${dur}s;animation-delay:${delay}s">` +
      `<line x1="${x}" y1="${y}" x2="${Number(x) + Number(len)}" y2="${Number(y) - len * 0.6}" ` +
      `stroke="#F3F7FF" stroke-width="1.5" stroke-linecap="round"/></g>`;
  }).join('');

  return `<svg class="scene" data-decay="0" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMin slice" xmlns="http://www.w3.org/2000/svg">
<defs>
<linearGradient id="fsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050918"/><stop offset="0.16" stop-color="#0C1532"/><stop offset="0.33" stop-color="#1A2A4C"/><stop offset="0.42" stop-color="#16243F"/><stop offset="1" stop-color="#070C16"/></linearGradient>
<radialGradient id="fglow"><stop offset="0" stop-color="#F6E7B8" stop-opacity="0.5"/><stop offset="1" stop-color="#F6E7B8" stop-opacity="0"/></radialGradient>
<linearGradient id="friv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2C4A6E"/><stop offset="1" stop-color="#132338"/></linearGradient>
${[['0', 392], ['1', 356], ['2', 322]].map(([n, cx]) =>
  `<mask id="fmoon${n}"><rect x="250" y="40" width="130" height="130" fill="#fff"/><circle cx="${cx}" cy="94" r="29" fill="#000"/></mask>`
).join('')}
<linearGradient id="ffog" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9FB4CE" stop-opacity="0"/><stop offset="0.45" stop-color="#9FB4CE" stop-opacity="0.5"/><stop offset="1" stop-color="#9FB4CE" stop-opacity="0"/></linearGradient>
</defs>
<rect width="${VB_W}" height="${VB_H}" fill="url(#fsky)"/>
<g>${stars.join('')}</g>
${shooting}
<circle class="trc moon-glow" cx="310" cy="100" r="96" fill="url(#fglow)"/>
<!-- The moon's phase is three discs cross-faded, not one shade circle moved.
     Each mask is built with its shade already in place and never changes, because
     Chrome rasterises mask CONTENT once: a cx driven from CSS does move the
     element (getBBox reports it) without the mask being rebuilt, so the phase
     silently never rendered. Opacity on the masked disc has no such problem. -->
${['0', '1', '2'].map((n) =>
  `<circle class="trc moon-${n}" cx="310" cy="100" r="28" fill="#F4ECD2" mask="url(#fmoon${n})"/>`
).join('')}
<g class="trc ridge-far">
<g fill="#0D1526" opacity="0.75">${farRidge(16, 268, 20, 6, 81)}</g>
<g fill="#101A2E" opacity="0.85">${farRidge(14, 280, 26, 7, 85)}</g>
</g>
<path d="M0,282 C60,262 110,274 160,266 C220,256 280,272 330,262 C360,256 380,262 390,260 L390,340 L0,340 Z" fill="#121D33"/>
<g fill="#0F192B">${ridgePines}</g>
<g class="trc deadfall" fill="#4A3A26">${deadLeaves}</g>
<path d="M0,318 C120,306 260,324 390,312 L390,844 L0,844 Z" fill="#0B1422"/>
<path d="M390,330 C320,344 270,362 210,368 C140,375 80,392 0,410 L0,444 C90,424 150,406 214,400 C280,394 330,376 390,362 Z" fill="url(#friv)"/>
<ellipse class="trc moon-reflect" cx="296" cy="360" rx="16" ry="2.6" fill="#F4ECD2"/>
<g class="trc river-lines" fill="none" stroke="#A9C2E0" stroke-linecap="round">
<path class="a flow" d="M390,346 C320,360 270,378 210,384 C140,391 80,408 0,426" stroke-width="1.3" stroke-dasharray="7 17"/>
<path class="a flow" d="M390,354 C322,367 272,386 212,392 C142,399 82,416 0,434" stroke-width="1" stroke-dasharray="4 20" style="animation-duration:7s"/>
<path class="a flow" d="M390,339 C320,352 270,370 210,376 C140,383 80,400 0,418" stroke-width="0.9" stroke-dasharray="8 16" style="animation-duration:6s"/>
</g>
<g class="trc fish-group">${fishes}</g>
<g class="tr deer" style="--k:1">
<g transform="translate(118 292)">
<g class="a deerwalk" fill="#05090F" stroke="rgba(196,210,232,0.38)" stroke-width="0.6">
<path d="M0,13 L-4,10 L-1,17 Z"/>
<rect x="2" y="21" width="2.6" height="17"/><rect x="7" y="21" width="2.6" height="17"/>
<rect x="23" y="21" width="2.6" height="17"/><rect x="28" y="21" width="2.6" height="17"/>
<ellipse cx="16" cy="17" rx="16" ry="8"/>
<g class="a deerhead">
<polygon points="26,16 32,12 38,-4 33,-6"/>
<ellipse cx="39" cy="-7" rx="6.5" ry="3.6" transform="rotate(18 39 -7)"/>
<path d="M35,-9 L30,-15 L36,-11 Z"/>
<path d="M35,-10 L33,-22 M33.6,-16 L29,-19 M33,-22 L36,-27 M37,-10 L39,-21 M38.4,-16 L42,-19" fill="none" stroke="#05090F" stroke-width="1.2" stroke-linecap="round"/>
</g></g></g></g>
<g fill="#070D18">${tallPines}</g>
<g class="trc bare" fill="none" stroke="#1B2436" stroke-width="1.6" stroke-linecap="round">${bareTrees}</g>
<g class="trc leaf-drop" fill="#6B4A28">${falling}</g>
<g fill="#1E3046">${leaves}</g>
<!-- Fog sits over the river and under the foreground pines, so it reads as
     depth in the scene rather than as a wash laid on top of it. -->
<rect class="trc fog" x="-10" y="300" width="410" height="150" fill="url(#ffog)"/>
</svg>`;
}

/* ── Sunset beach ──────────────────────────────────────────────── */

function beachScene() {
  // Everything that matters has to live above y 392: the cards start there and
  // the scene is fixed, so no amount of scrolling reveals what is underneath.
  // Within that budget the sea gets twice the sand, per §13 — sea 296..360,
  // sand 360 down. The sun lifts to 230 so the plane and the surfer have room.
  const HORIZON = 296;
  const SHORE = 354;

  const stars = Array.from({ length: 22 }, (_, i) => {
    const x = Math.round(rr(i, 1, 5, 385));
    const y = Math.round(rr(i, 2, 10, 240));
    return `<circle class="a tw" cx="${x}" cy="${y}" r="${rr(i, 7, 0.6, 1.5).toFixed(2)}" fill="#F3EEF8" style="animation-delay:${(-rr(i, 8, 0, 5)).toFixed(1)}s;animation-duration:${rr(i, 9, 3.5, 7.5).toFixed(1)}s"/>`;
  }).join('');

  // Two wavelengths per screen width, so translating by exactly -390 lands on
  // an identical crest and the loop is invisible.
  const wavePath = (y, a) => {
    let d = `M0,${y}`;
    for (let x = 0; x < 780; x += 30) d += ` Q${x + 15},${y - a} ${x + 30},${y}`;
    return d;
  };

  const waves = [
    [306, 1.8, 1.0, 0.34, 30], [318, 2.1, 1.0, 0.30, 37], [332, 2.4, 1.0, 0.26, 44],
    [344, 2.7, 0.9, 0.22, 52], [354, 3.0, 0.9, 0.18, 61],
  ].map(([y, amp, w, op, dur]) =>
    `<path class="a wave" d="${wavePath(y, amp)}" stroke="#F7D2B4" stroke-width="${w}" opacity="${op}" style="--wave:-390px;animation-duration:${dur}s"/>`
  ).join('');

  const reflect = Array.from({ length: 9 }, (_, i) => {
    const w = 48 - i * 4;
    return `<rect class="a shim" x="${(290 - w / 2 + (rnd(i, 11) - 0.5) * 7).toFixed(1)}" y="${300 + i * 6}" width="${w}" height="2" rx="1" style="animation-delay:${(-rr(i, 12, 0, 4)).toFixed(1)}s"/>`;
  }).join('');

  // Sand grain: a scatter of dots and short strokes, denser near the water.
  const grains = Array.from({ length: 150 }, (_, i) => {
    const x = rr(i, 61, 0, 390).toFixed(1);
    const y = rr(i, 62, SHORE + 3, SHORE + 120).toFixed(1);
    const r = rr(i, 63, 0.4, 1.3).toFixed(2);
    const o = rr(i, 64, 0.06, 0.26).toFixed(2);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#FFF0DC" opacity="${o}"/>`;
  }).join('');

  const pebbles = Array.from({ length: 14 }, (_, i) =>
    `<ellipse cx="${rr(i, 65, 10, 380).toFixed(0)}" cy="${rr(i, 66, SHORE + 12, SHORE + 100).toFixed(0)}" rx="${rr(i, 67, 1.6, 3.4).toFixed(1)}" ry="${rr(i, 68, 1, 2).toFixed(1)}" fill="#3A2230" opacity="0.3"/>`
  ).join('');

  /* Midground rocks. Depth, and something for the tide line to sit against —
     the sand was a flat field of grain with nothing at any distance in it. */
  const rocks = [[64, 8, 5], [78, 5, 3.4], [296, 9.5, 6], [310, 6, 3.8], [188, 5.5, 3.4]]
    .map(([x, rx, ry], i) =>
      `<ellipse cx="${x}" cy="${(SHORE + 16 + i * 3).toFixed(0)}" rx="${rx}" ry="${ry}" fill="#4B2C3C"/>`
    ).join('');

  /* Litter and weed, invisible until the month strains. This is the beach's
     structural level-1 change: the palette cooling alone read as dusk, which
     is pretty, not worrying. */
  const litter = Array.from({ length: 16 }, (_, i) => {
    const x = rr(i, 81, 10, 380).toFixed(0);
    const y = rr(i, 82, SHORE + 6, SHORE + 34).toFixed(0);
    return rnd(i, 83) > 0.5
      ? `<path d="M${x},${y} q4,-3 8,0 q4,3 8,0" fill="none" stroke="#3E5340" stroke-width="1.3" stroke-linecap="round"/>`
      : `<rect x="${x}" y="${y}" width="${rr(i, 84, 3, 7).toFixed(1)}" height="2.2" rx="0.8" fill="#C9BFA8" transform="rotate(${rr(i, 85, -50, 50).toFixed(0)} ${x} ${y})"/>`;
  }).join('');

  const crabX = rr(0, 69, 30, 110).toFixed(0);
  const crabY = rr(0, 70, SHORE + 8, SHORE + 13).toFixed(0);
  const crabLeg = (x, d) =>
    `<line class="a crab-leg" x1="${x}" y1="0" x2="${x + d}" y2="5" stroke="#B3261E" stroke-width="1.4" stroke-linecap="round" style="animation-delay:${(-Math.abs(x) * 0.06).toFixed(2)}s"/>`;

  return `<svg class="scene" data-decay="0" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMin slice" xmlns="http://www.w3.org/2000/svg">
<defs>
<linearGradient id="bsky" x1="0" y1="0" x2="0" y2="1"><stop class="trc s0" offset="0"/><stop class="trc s1" offset="0.18"/><stop class="trc s2" offset="0.30"/><stop class="trc s3" offset="0.38"/><stop offset="1" stop-color="#1A1426"/></linearGradient>
<radialGradient id="bsun"><stop offset="0" stop-color="#FFF4D6"/><stop offset="0.6" stop-color="#FFD39A"/><stop class="trc sun-edge" offset="1"/></radialGradient>
<radialGradient id="bglow"><stop class="trc sun-edge" offset="0" stop-opacity="0.55"/><stop offset="1" stop-color="#F29A5B" stop-opacity="0"/></radialGradient>
<linearGradient id="bsea" x1="0" y1="0" x2="0" y2="1"><stop class="trc sea-top" offset="0"/><stop offset="0.04" stop-color="#C06A62"/><stop offset="0.14" stop-color="#2E5A6E"/><stop offset="1" stop-color="#0E2334"/></linearGradient>
<linearGradient id="bsand" x1="0" y1="0" x2="0" y2="1"><stop class="trc sand-top" offset="0"/><stop offset="1" stop-color="#4A2E3A"/></linearGradient>
<clipPath id="bclip"><rect x="0" y="0" width="${VB_W}" height="${HORIZON}"/></clipPath>
<clipPath id="bsandclip"><path d="M0,${SHORE} C130,${SHORE - 8} 250,${SHORE + 8} 390,${SHORE - 2} L390,844 L0,844 Z"/></clipPath>
</defs>
<rect width="${VB_W}" height="${VB_H}" fill="url(#bsky)"/>
<g class="trc beach-stars">${stars}</g>
<g class="trc cloud-col" opacity="0.62">
<g class="a drift"><ellipse cx="120" cy="112" rx="84" ry="6"/><ellipse cx="150" cy="104" rx="46" ry="5"/></g>
<g class="a drift" style="animation-duration:120s;animation-delay:-40s"><ellipse cx="300" cy="178" rx="76" ry="5"/><ellipse cx="270" cy="171" rx="40" ry="4"/></g>
<g class="a drift" style="animation-duration:105s;animation-delay:-70s"><ellipse cx="96" cy="236" rx="70" ry="4"/></g>
</g>
<g clip-path="url(#bclip)">
<circle class="a glow trc sun-glow" cx="290" r="120" fill="url(#bglow)"/>
<circle class="trc sun" cx="290" r="30" fill="url(#bsun)"/>
</g>

<!-- The plane tows a banner, not a slogan: the status is the chip's job.
     The banner is a rectangle with a swallowtail, not the wedge it started as.
     A wedge tapers, so the smile ran out through the underside of it — at the
     mouth's widest the banner was only 5 units deep and the curve dipped 7. -->
<g class="a plane" style="${travelStyle(VB_W, -136, 217)}">
<g transform="translate(0 176) scale(2.2)">
<path d="M0,0 L19,0 L25,-5 L29,-5 L26,0 L33,0 L37,4 L25,4 L19,4 Z" fill="#2E2235"/>
<path d="M12,0 L6,-9 L10,-9 L19,0 Z" fill="#3C2C44"/>
<path d="M1,1.5 L-5,0" stroke="#2E2235" stroke-width="1.1" opacity="0.8"/>
<g class="a pennant">
<path d="M-5,-9 L-55,-9 L-62,0 L-55,9 L-5,9 Z" class="trc pennant-fill"/>
<circle class="trc pennant-face" cx="-40" cy="-2" r="2"/>
<circle class="trc pennant-face" cx="-26" cy="-2" r="2"/>
<path class="trc mouth-happy" d="M-43,3 Q-33,8.5 -23,3" fill="none" stroke-width="1.8" stroke-linecap="round"/>
<path class="trc mouth-flat" d="M-43,5 L-23,5" fill="none" stroke-width="1.8" stroke-linecap="round"/>
<path class="trc mouth-sad" d="M-43,7 Q-33,1.5 -23,7" fill="none" stroke-width="1.8" stroke-linecap="round"/>
</g>
</g>
</g>

<rect x="0" y="${HORIZON}" width="${VB_W}" height="${844 - HORIZON}" fill="url(#bsea)"/>
<rect class="trc waterline" x="0" y="${HORIZON - 1}" width="${VB_W}" height="1.6" opacity="0.6"/>
<g class="trc reflect">${reflect}</g>
<g fill="none" stroke-linecap="round">${waves}</g>

<!-- Surfer on a breaking wave. Every part of this moves on its own clock; the
     group as a whole only supplies the travel across the bay. -->
<g class="trc surf-wrap">
<g class="a surfer" style="${travelStyle(VB_W, -80, 145)}">
<g transform="translate(0 322) scale(1.9)">

<g class="a surf-crest">
<path d="M-42,13 Q-24,11 -9,4 Q3,-3 14,-9 Q25,-15 30,-7 Q34,1 32,13 Z" fill="#4E97B0"/>
<path d="M-34,13 Q-18,11 -5,5 Q6,-1 15,-6 Q24,-11 28,-4 Q31,3 29,13 Z" fill="#7CBFD2" opacity="0.85"/>
<path d="M-20,13 Q-8,11 2,6 Q11,1 19,-2 Q26,-4 27,4 L27,13 Z" fill="#B6E2EC" opacity="0.55"/>
</g>

<g class="a surf-curl">
<path d="M14,-9 Q25,-15 30,-7 Q22,-12 13,-7 Q6,-4 1,-1 Q7,-6 14,-9 Z" fill="#FFFFFF"/>
<path d="M19,-9 Q27,-12 30,-7 Q25,-10 19,-9 Z" fill="#FFFFFF" opacity="0.8"/>
</g>

<g class="a surf-bob">
<g transform="translate(-7 3)">
<path d="M-13,4 Q0,9 14,3 Q0,7 -13,4 Z" fill="#FFF3DC"/>
<path d="M-13,4 Q0,9 14,3" fill="none" stroke="#C9A97E" stroke-width="0.7"/>
<g class="a surf-rider">
<path d="M0,3 L1,-9" stroke="#2E2235" stroke-width="2.6" stroke-linecap="round"/>
<circle cx="1.6" cy="-12.2" r="2.8" fill="#2E2235"/>
<path d="M0.8,-7 L8,-10.5 M0.8,-7 L-6,-11.5" stroke="#2E2235" stroke-width="1.7" stroke-linecap="round"/>
<path d="M0,3 L-3.4,7 M1,3 L4.4,7" stroke="#2E2235" stroke-width="1.8" stroke-linecap="round"/>
</g>
</g>
</g>

<g class="a surf-foam">
<path d="M1,-1 Q-7,3 -16,6 Q-25,9 -33,11" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" opacity="0.9"/>
<path d="M-30,13 Q-16,16 -2,13" fill="none" stroke="#FFF6EC" stroke-width="1.6" stroke-linecap="round"/>
<circle cx="-20" cy="7" r="1.1" fill="#FFFFFF"/>
<circle cx="-27" cy="10" r="0.8" fill="#FFFFFF"/>
<circle cx="-12" cy="5" r="0.7" fill="#FFFFFF"/>
<circle cx="26" cy="-9" r="1" fill="#FFFFFF"/>
<circle cx="30" cy="-12" r="0.7" fill="#FFFFFF"/>
</g>

</g>
</g>
</g>

<path d="M0,${SHORE} C130,${SHORE - 8} 250,${SHORE + 8} 390,${SHORE - 2} L390,844 L0,844 Z" fill="url(#bsand)"/>
<g clip-path="url(#bsandclip)">${grains}${pebbles}</g>
<g class="trc rocks">${rocks}</g>
<path class="a lap" d="M0,${SHORE - 1} C130,${SHORE - 9} 250,${SHORE + 7} 390,${SHORE - 3}" fill="none" stroke="#FFF1E2" stroke-width="1.8" opacity="0.6"/>

<g class="trc litter">${litter}</g>

<!-- Crab. Drawn after the sand so it is on the beach, not under it. The wrapper
     carries the decay opacity: the crab's own group is on a travel loop and a
     rule on it would be overridden by the keyframe. -->
<g class="trc crab-wrap">
<g class="a crab" style="--k:1">
<g transform="translate(${crabX} ${crabY})">
${crabLeg(-7, -4)}${crabLeg(-3, -3)}${crabLeg(3, 3)}${crabLeg(7, 4)}
<ellipse cx="0" cy="-2" rx="8" ry="5.4" fill="#D7372A"/>
<ellipse cx="0" cy="-3.4" rx="6" ry="3" fill="#E8564A" opacity="0.8"/>
<path d="M-8,-4 L-13,-8 L-10,-9 L-6,-6 Z" fill="#B3261E"/>
<path d="M8,-4 L13,-8 L10,-9 L6,-6 Z" fill="#B3261E"/>
<circle cx="-3" cy="-6.6" r="1.5" fill="#2B0F0C"/>
<circle cx="3" cy="-6.6" r="1.5" fill="#2B0F0C"/>
<circle cx="-2.6" cy="-7" r="0.5" fill="#fff"/>
<circle cx="3.4" cy="-7" r="0.5" fill="#fff"/>
</g>
</g>
</g>
</svg>`;
}

/* ── Rainy city ────────────────────────────────────────────────── */

function cityScene() {
  /* The tower's lit windows carry a face — §13, a face only: the grid is 8
     columns wide and "BELOW BUDGET" would need about 60. Rows 2..8 of columns
     0..6 are reserved for it; the random fill skips those cells but leaves them
     dimly lit, so the facade still reads as a building rather than a billboard
     with a hole punched in it. */
  const FACE_HAPPY = [
    '.......',
    '.XX.XX.',
    '.XX.XX.',
    '.......',
    'X.....X',
    '.X...X.',
    '..XXX..',
  ];
  /* The middle face. Not a frown — a flat mouth. The building stops smiling
     before it starts worrying, which is the whole shape of the three states. */
  const FACE_FLAT = [
    '.......',
    '.XX.XX.',
    '.XX.XX.',
    '.......',
    '.......',
    '.XXXXX.',
    '.......',
  ];
  const FACE_SAD = [
    '.......',
    '.XX.XX.',
    '.XX.XX.',
    '.......',
    '..XXX..',
    '.X...X.',
    'X.....X',
  ];
  /* The face is drawn on its OWN grid, wider-spaced and with bigger panes than
     the building's ordinary windows. Sharing the 17x12.5 grid made it the same
     visual weight as the random fill, so it read as texture rather than as a
     face. 20x16 with 11x7 panes is about twice the area and carries at phone
     size. The block it sits in is cleared across all 8 ordinary columns. */
  const FACE_X = 246, FACE_Y = 124, FDX = 20, FDY = 16;
  const DX = 17, DY = 12.5;
  const inFace = (r) => r >= 2 && r <= 11;

  const win = (x, y, opacity, cls = '', delay = '', w = 7, h = 4.5) =>
    `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="0.6" opacity="${opacity}"${delay}/>`;

  const windows = [];
  const grid = (x0, y0, cols, rows, dx, dy, base, salt, reserve = false) => {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const k = r * cols + c + salt * 100;
        // Reserved rows stay dark. A faint window in every spare cell read as a
        // lit block with holes in it rather than as a face.
        if (reserve && inFace(r)) continue;
        if (rnd(k, salt) < 0.4) continue;
        const flick = rnd(k, salt + 7) > 0.92 ? 'a flick' : '';
        const delay = ` style="animation-delay:${(-rr(k, salt + 5, 0, 12)).toFixed(1)}s"`;
        windows.push(win(x0 + c * dx, y0 + r * dy, (base * rr(k, salt + 3, 0.6, 1)).toFixed(2), flick, delay));
      }
    }
  };
  grid(250, 92, 8, 16, DX, DY, 0.95, 1, true);
  // The two shorter blocks are collected separately so they can be the ones
  // that go dark. Emptying the face tower instead would take the face with it.
  const towerCount = windows.length;
  grid(112, 160, 5, 10, 17, 13, 0.6, 2);
  grid(4, 210, 5, 6, 18, 13, 0.45, 3);
  const towerWindows = windows.slice(0, towerCount).join('');
  const blockWindows = windows.slice(towerCount).join('');

  /* A haze band of distant towers behind everything. Depth, and the first thing
     the weather takes away. */
  const farTowers = Array.from({ length: 11 }, (_, i) => {
    const x = (i * 36 + rnd(i, 95) * 10).toFixed(0);
    const h = (40 + rnd(i, 96) * 70).toFixed(0);
    return `<rect x="${x}" y="${(300 - h)}" width="${(20 + rnd(i, 97) * 12).toFixed(0)}" height="${h}"/>`;
  }).join('');

  // Lamps along the viaduct deck. The train already had its pylons; what it did
  // not have was anything on the deck to go out.
  const viaductLamps = Array.from({ length: 9 }, (_, i) =>
    `<rect x="${(10 + i * 44)}" y="295" width="2.6" height="5" rx="1"/>`
  ).join('');

  // Standing water. Separate from the reflections so it can spread on its own.
  const wide = [[20, 70], [136, 92], [262, 64], [338, 48]]
    .map(([x, w]) => `<ellipse cx="${x + w / 2}" cy="${374 + (x % 7)}" rx="${w / 2}" ry="5.5"/>`)
    .join('');

  // A couple of face windows still flicker — a perfectly steady face would read
  // as a sign rather than as a building that happens to look cheerful.
  const face = (pattern, cls) => pattern.flatMap((row, r) =>
    [...row].map((ch, c) => {
      if (ch !== 'X') return '';
      const flick = rnd(r * 7 + c, 91) > 0.86 ? ' a flick' : '';
      return win(FACE_X + c * FDX, FACE_Y + r * FDY, 1, `${cls}${flick}`,
        ` style="animation-delay:${(-rr(r * 7 + c, 92, 0, 12)).toFixed(1)}s"`, 11, 7);
    })
  ).join('');

  const streaks = (n, saltBase, len, drift, dur0, durSpan) =>
    Array.from({ length: n }, (_, i) => {
      const x = rnd(i, saltBase) * 400, y = rnd(i, saltBase + 1) * 820;
      return `<line class="a rain" x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x - drift).toFixed(1)}" y2="${(y + len).toFixed(1)}" style="animation-delay:${(-rnd(i, saltBase + 2)).toFixed(2)}s;animation-duration:${(dur0 + rnd(i, saltBase + 3) * durSpan).toFixed(2)}s"/>`;
    }).join('');

  const drips = [[60, 350], [150, 376], [232, 384], [318, 372], [368, 356], [96, 386]]
    .map((p, i) => `<ellipse class="a drip" cx="${p[0]}" cy="${p[1]}" rx="7" ry="1.8" style="animation-delay:${(-i * 0.45).toFixed(2)}s"/>`)
    .join('');

  const puddle = (x, w) => `<rect x="${x}" y="334" width="${w}" height="58" fill="url(#cref)"/>`;

  // Lane dashes. Static: the road is not moving, the traffic is.
  const laneDash = Array.from({ length: 13 }, (_, i) =>
    `<rect x="${i * 30}" y="384" width="17" height="2" rx="1" fill="#C9D6E8" opacity="0.22"/>`
  ).join('');

  // Both cars sit at the stop line and are driven by translateX from there.
  const car = (x, body, roof, cls) => `<g class="a ${cls}" style="${travelStyle(VB_W, x, 52)}">
<g transform="translate(${x} 352)">
<path d="M4,14 L8,4 Q10,1 14,1 L34,1 Q38,1 40,4 L45,14 Z" fill="${roof}"/>
<rect x="0" y="13" width="52" height="11" rx="4" fill="${body}"/>
<rect class="trc win-col" x="11" y="5" width="12" height="7" rx="1.5" opacity="0.75"/>
<rect class="trc win-col" x="26" y="5" width="12" height="7" rx="1.5" opacity="0.75"/>
<circle cx="12" cy="25" r="4.4" fill="#05070C"/><circle cx="40" cy="25" r="4.4" fill="#05070C"/>
<rect class="trc win-col" x="49" y="16" width="4" height="3" rx="1" opacity="0.9"/>
<rect x="-1" y="16" width="4" height="3" rx="1" fill="#C0392B" opacity="0.85"/>
</g></g>`;

  return `<svg class="scene" data-decay="0" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMin slice" xmlns="http://www.w3.org/2000/svg">
<defs>
<linearGradient id="csky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0E1424"/><stop offset="0.2" stop-color="#202A45"/><stop class="trc horizon-stop" offset="0.34"/><stop offset="0.36" stop-color="#151B29"/><stop offset="1" stop-color="#0A0D14"/></linearGradient>
<radialGradient id="clampg"><stop class="trc lamp-stop" offset="0" stop-opacity="0.6"/><stop offset="1" stop-color="#F7B65E" stop-opacity="0"/></radialGradient>
<linearGradient id="cref" x1="0" y1="0" x2="0" y2="1"><stop class="trc win-stop" offset="0" stop-opacity="0.55"/><stop class="trc win-stop" offset="1" stop-opacity="0"/></linearGradient>
</defs>
<rect width="${VB_W}" height="${VB_H}" fill="url(#csky)"/>
<g class="trc skyline-far" fill="#161D2E">${farTowers}</g>
<g fill="#1A2234"><rect x="0" y="176" width="38" height="124"/><rect x="40" y="208" width="30" height="92"/><rect x="150" y="160" width="26" height="140"/><rect x="178" y="190" width="40" height="110"/><rect x="210" y="132" width="24" height="168"/></g>
<rect x="104" y="150" width="96" height="150" fill="#131928"/>
<rect x="-6" y="200" width="104" height="100" fill="#121826"/>
<rect x="240" y="80" width="150" height="220" fill="#121826"/>
<rect x="240" y="80" width="150" height="4" fill="#1C2436"/>
<g class="trc win-col">${towerWindows}</g>
<g class="trc win-dark"><g class="trc win-col">${blockWindows}</g></g>
<g class="trc win-col face-happy">${face(FACE_HAPPY, 'face-happy')}</g>
<g class="trc win-col face-flat">${face(FACE_FLAT, 'face-flat')}</g>
<g class="trc win-col face-sad">${face(FACE_SAD, 'face-sad')}</g>

<rect x="0" y="300" width="${VB_W}" height="9" fill="#0B0F18"/>
<g class="trc viaduct-lamp"><g class="trc lamp-col">${viaductLamps}</g></g>
<g fill="#0B0F18"><rect x="56" y="308" width="10" height="24"/><rect x="186" y="308" width="10" height="24"/><rect x="316" y="308" width="10" height="24"/></g>
<g class="a train" style="${travelStyle(VB_W, 20, 252)}">
<rect x="20" y="280" width="252" height="19" rx="7" fill="#090D15"/>
<rect class="trc win-col" x="30" y="285" width="232" height="5.5" rx="2" opacity="0.85"/>
<rect x="88" y="284" width="3" height="8" fill="#090D15"/><rect x="150" y="284" width="3" height="8" fill="#090D15"/><rect x="212" y="284" width="3" height="8" fill="#090D15"/>
</g>

<rect x="0" y="330" width="${VB_W}" height="514" fill="#111622"/>
<line x1="0" y1="331" x2="${VB_W}" y2="331" stroke="#2A3348" stroke-width="1.4"/>
${laneDash}
<rect x="0" y="336" width="${VB_W}" height="1.4" fill="#C9D6E8" opacity="0.12"/>
<rect x="306" y="338" width="2.5" height="42" rx="1" fill="#C9D6E8" opacity="0.3"/>

<rect x="108" y="304" width="3" height="28" fill="#0B0F18"/>
<circle cx="110" cy="304" r="40" fill="url(#clampg)"/>
<circle class="trc lamp-col" cx="110" cy="304" r="3.2"/>

${car(232, '#2F6E9E', '#24567C', 'car-a')}
${car(150, '#8C5A2B', '#6E4621', 'car-b')}

<!-- Signal on the kerb, cars stop short of it. -->
<g>
<rect x="316" y="330" width="3" height="52" fill="#0B0F18"/>
<rect x="310" y="306" width="15" height="34" rx="4" fill="#0B0F18"/>
<circle class="a lamp-red" cx="317.5" cy="314" r="4" fill="#E2483C"/>
<circle class="a lamp-amber" cx="317.5" cy="323" r="4" fill="#E8B04F"/>
<circle class="a lamp-green" cx="317.5" cy="332" r="4" fill="#6FD39B"/>
</g>

<g class="trc puddle-wide" fill="#1A2334" opacity="0">${wide}</g>
<g class="street-ref">${puddle(104, 14)}${puddle(252, 9)}${puddle(300, 7)}${puddle(346, 10)}${puddle(30, 6)}</g>
<g class="rain-layer" fill="none" stroke="#B9C9DE" stroke-width="0.7">${drips}</g>
<g class="trc rain-layer" stroke="#C9D6E8" stroke-width="0.8" stroke-linecap="round">${streaks(60, 21, 13, 3, 0.8, 0.4)}</g>
<g class="trc rain-heavy" stroke="#D8E2F0" stroke-width="0.9" stroke-linecap="round">${streaks(46, 31, 18, 4, 0.6, 0.3)}</g>
</svg>`;
}


/* ── Widescreen compositions ───────────────────────────────────────
 *
 * One per scene, drawn in the 1440x900 box. They reuse every class name the
 * tall scenes use, which is the whole reason this was affordable: the decay
 * stylesheet above is written against classes, not coordinates, so all three
 * levels work here without a single extra rule.
 *
 * Layout, from the laptop shell in app.css: a rail on the left, a centre column
 * and a ledger on the right, all opaque. What stays visible is the top strip,
 * the gutters either side, and the band below the centre column. So the sky
 * goes above the content and the focal band goes at y 560-900, under it.
 */

/** Sky scatter, shared by all three wide scenes. */
const wideStars = (n, salt, maxY, skip) => Array.from({ length: n }, (_, i) => {
  const x = Math.round(rr(i, salt, 8, VW_W - 8));
  const y = Math.round(rr(i, salt + 1, 10, maxY));
  if (skip && skip(x, y)) return '';
  return `<circle class="a tw" cx="${x}" cy="${y}" r="${rr(i, salt + 2, 0.6, 1.5).toFixed(2)}" fill="#E8ECF5" style="animation-delay:${(-rr(i, salt + 3, 0, 5)).toFixed(1)}s;animation-duration:${rr(i, salt + 4, 3.5, 7.5).toFixed(1)}s"/>`;
}).join('');

function forestWide() {
  const HORIZON = 560;
  /* The moon sits in the sky window the Home grid reserves — the empty cell to
     the right of the hero and above both cards. Measured at 1280x800 and
     1440x900, that window is x 660..1400, y 90..380 in these units, and it is
     empty by design rather than by luck: see the `sky` area in app.css. */
  const MOON_X = 1040;
  const MOON_Y = 196;

  // The bank and water share this curve. Raising it opens a broad river;
  // fish and ripples derive their positions from the same geometry.
  const RIVER = [
    [[1440, 720], [1180, 738], [960, 750], [720, 766]],
    [[720, 766], [470, 780], [230, 792], [0, 802]],
  ];
  const riverAt = (t) => {
    // t runs 0..1 right-to-left across both segments.
    const seg = t < 0.5 ? RIVER[0] : RIVER[1];
    return bezierAt(t < 0.5 ? t * 2 : (t - 0.5) * 2, ...seg);
  };
  const riverPath = (dy = 0) =>
    `M${RIVER[0][0][0]},${RIVER[0][0][1] + dy} ` +
    RIVER.map(([, c1, c2, p]) =>
      `C${c1[0]},${(c1[1] + dy).toFixed(0)} ${c2[0]},${(c2[1] + dy).toFixed(0)} ${p[0]},${(p[1] + dy).toFixed(0)}`
    ).join(' ');
  const stars = wideStars(48, 101, 420, (x, y) => Math.abs(x - MOON_X) < 170 && y < 310);

  // Three ridges receding up the frame, then the framing pines at both edges.
  const ridge = (n, x0, span, y, h, w, salt) => Array.from({ length: n }, (_, i) =>
    `<polygon points="${pine(x0 + i * (span / n) + rnd(i, salt) * 10, y + rnd(i, salt + 1) * 8, h + rnd(i, salt + 2) * 22, w + rnd(i, salt + 3) * 4)}"/>`
  ).join('');

  const framing = [[40, 900, 560, 44], [128, 840, 400, 34], [1442, 900, 480, 24]]
    .map((d, i) => `<polygon class="a sway" points="${pine(...d)}" style="animation-duration:${(6.5 + i * 1.3).toFixed(1)}s;animation-delay:${(-i * 1.7).toFixed(1)}s"/>`)
    .join('');

  /* Each fish is placed by its position ALONG the river rather than by an x
     and a y, so it breaks the surface wherever the surface happens to be. The
     jump itself is the keyframe's -22 units of lift from here, so landing the
     origin on the water is the whole of the fix. */
  const fish = (i) => {
    const which = ['fish-a', 'fish-b', 'fish-c'][i];
    const st = ` style="animation-duration:${rr(i, 43, 9, 17).toFixed(1)}s;animation-delay:${(-rr(i, 44, 0, 17)).toFixed(1)}s"`;
    /* t runs right-to-left. The fish are kept in the right-hand half, which
       is the part of the water the dashboard leaves uncovered at both laptop
       sizes — the ledger now sits over the left bank. They are still placed
       ON the curve, so moving the window does not put them back on land. */
    const at = riverAt([0.035, 0.09, 0.16][i]);
    return `<g class="trc ${which}" transform="translate(${at.x.toFixed(0)} ${(at.y + 10).toFixed(0)}) scale(${rr(i, 45, 1.1, 1.7).toFixed(2)})">` +
      `<ellipse class="a ripple" cx="0" cy="2" rx="9" ry="2.2" fill="none" stroke="#BFD2EA" stroke-width="0.9"${st}/>` +
      `<path class="a fish" d="M0,0 C4,-3 9,-3 12,0 C9,3 4,3 0,0 Z M12,0 L16,-3 L16,3 Z" fill="#C9D9EE"${st}/></g>`;
  };

  const deadLeaves = Array.from({ length: 48 }, (_, i) =>
    `<ellipse cx="${rr(i, 171, 10, 1430).toFixed(0)}" cy="${rr(i, 172, 590, 700).toFixed(0)}" rx="${rr(i, 173, 2, 4).toFixed(1)}" ry="${rr(i, 174, 1, 1.9).toFixed(1)}"/>`
  ).join('');

  const falling = Array.from({ length: 16 }, (_, i) =>
    `<ellipse class="a leaffall" cx="${rr(i, 176, 40, 1400).toFixed(0)}" cy="${rr(i, 177, 470, 540).toFixed(0)}" rx="3.2" ry="1.5" style="animation-delay:${(-rr(i, 178, 0, 14)).toFixed(1)}s;animation-duration:${rr(i, 179, 9, 16).toFixed(1)}s"/>`
  ).join('');

  const bare = [[200, 900, 300], [1240, 890, 270], [96, 850, 210]].map(([x, base, h]) => {
    const top = base - h;
    let d = `M${x},${base} L${x},${top}`;
    for (let i = 1; i <= 5; i++) {
      const y = top + (h * 0.8) * i / 5, len = 10 + i * 6, dir = i % 2 ? 1 : -1;
      d += ` M${x},${y} L${x + len * dir},${y - len * 0.55}`;
    }
    return `<path d="${d}"/>`;
  }).join('');

  const shooting = Array.from({ length: 2 }, (_, i) => {
    const x = rr(i, 152, 500, 1300).toFixed(0), y = rr(i, 153, 40, 240).toFixed(0), len = rr(i, 154, 22, 40).toFixed(0);
    return `<g class="a shoot" style="animation-duration:${rr(i, 155, 26, 48).toFixed(0)}s;animation-delay:${(-rr(i, 156, 0, 40)).toFixed(0)}s">` +
      `<line x1="${x}" y1="${y}" x2="${Number(x) + Number(len)}" y2="${Number(y) - len * 0.6}" stroke="#F3F7FF" stroke-width="1.6" stroke-linecap="round"/></g>`;
  }).join('');

  return `<svg class="scene" data-decay="0" viewBox="0 0 ${VW_W} ${VW_H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
<defs>
<linearGradient id="fwsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050918"/><stop offset="0.22" stop-color="#0C1532"/><stop offset="0.48" stop-color="#1A2A4C"/><stop offset="0.62" stop-color="#16243F"/><stop offset="1" stop-color="#070C16"/></linearGradient>
<radialGradient id="fwglow"><stop offset="0" stop-color="#F6E7B8" stop-opacity="0.5"/><stop offset="1" stop-color="#F6E7B8" stop-opacity="0"/></radialGradient>
<linearGradient id="fwriv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2C4A6E"/><stop offset="1" stop-color="#132338"/></linearGradient>
<linearGradient id="fwfog" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9FB4CE" stop-opacity="0"/><stop offset="0.45" stop-color="#9FB4CE" stop-opacity="0.5"/><stop offset="1" stop-color="#9FB4CE" stop-opacity="0"/></linearGradient>
${[['0', 108], ['1', 56], ['2', 16]].map(([n, dx]) =>
  `<mask id="fwmoon${n}"><rect x="${MOON_X - 110}" y="${MOON_Y - 90}" width="220" height="220" fill="#fff"/><circle cx="${MOON_X + dx}" cy="${MOON_Y - 8}" r="42" fill="#000"/></mask>`
).join('')}
</defs>
<rect width="${VW_W}" height="${VW_H}" fill="url(#fwsky)"/>
<g>${stars}</g>
${shooting}
<circle class="trc moon-glow" cx="${MOON_X}" cy="${MOON_Y}" r="150" fill="url(#fwglow)"/>
${['0', '1', '2'].map((n) => `<circle class="trc moon-${n}" cx="${MOON_X}" cy="${MOON_Y}" r="41" fill="#F4ECD2" mask="url(#fwmoon${n})"/>`).join('')}

<g class="trc ridge-far">
<g fill="#0D1526" opacity="0.75">${ridge(30, 60, 1340, 470, 34, 10, 181)}</g>
<g fill="#101A2E" opacity="0.85">${ridge(26, 20, 1400, 500, 46, 12, 185)}</g>
</g>
<path d="M0,${HORIZON - 40} C260,${HORIZON - 80} 520,${HORIZON - 50} 760,${HORIZON - 70} C1000,${HORIZON - 88} 1240,${HORIZON - 48} 1440,${HORIZON - 64} L1440,${HORIZON + 60} L0,${HORIZON + 60} Z" fill="#121D33"/>
<g fill="#0F192B">${ridge(34, 40, 1380, 530, 56, 14, 191)}</g>
<path d="M0,${HORIZON + 30} C440,${HORIZON + 6} 980,${HORIZON + 54} 1440,${HORIZON + 24} L1440,900 L0,900 Z" fill="#0B1422"/>
<!-- A broad, muted green bank separates the hooves from the blue water.
     The waterline stays fixed, retaining the enlarged river and fish origins. -->
<path class="riverbank" d="${riverPath(-52)} L0,900 L1440,900 Z" fill="#1C2827"/>
<g class="trc deadfall" fill="#4A3A26">${deadLeaves}</g>

<path d="${riverPath()} L0,900 L1440,900 Z" fill="url(#fwriv)"/>
<ellipse class="trc moon-reflect" cx="${MOON_X}" cy="${(riverAt(0.27).y + 16).toFixed(0)}" rx="38" ry="5" fill="#F4ECD2"/>
<g class="trc river-lines" fill="none" stroke="#A9C2E0" stroke-linecap="round">
<path class="a flow" d="${riverPath(16)}" stroke-width="1.7" stroke-dasharray="9 22"/>
<path class="a flow" d="${riverPath(34)}" stroke-width="1.3" stroke-dasharray="5 26" style="animation-duration:7s"/>
<path class="a flow" d="${riverPath(6)}" stroke-width="1.1" stroke-dasharray="10 20" style="animation-duration:6s"/>
</g>
<g class="trc fish-group">${[0, 1, 2].map(fish).join('')}</g>

<g class="tr deer" style="--k:0.35">
<!-- Hooves sit roughly 40 units inland across the complete walking loop. -->
<g transform="translate(1330 642) scale(1.1)">
<g class="a deerwalk" fill="#05090F" stroke="rgba(196,210,232,0.38)" stroke-width="0.6">
<path d="M0,13 L-4,10 L-1,17 Z"/>
<rect x="2" y="21" width="2.6" height="17"/><rect x="7" y="21" width="2.6" height="17"/>
<rect x="23" y="21" width="2.6" height="17"/><rect x="28" y="21" width="2.6" height="17"/>
<ellipse cx="16" cy="17" rx="16" ry="8"/>
<g class="a deerhead">
<polygon points="26,16 32,12 38,-4 33,-6"/>
<ellipse cx="39" cy="-7" rx="6.5" ry="3.6" transform="rotate(18 39 -7)"/>
<path d="M35,-9 L30,-15 L36,-11 Z"/>
<path d="M35,-10 L33,-22 M33.6,-16 L29,-19 M33,-22 L36,-27 M37,-10 L39,-21 M38.4,-16 L42,-19" fill="none" stroke="#05090F" stroke-width="1.2" stroke-linecap="round"/>
</g></g></g></g>

<g fill="#070D18">${framing}</g>
<g class="trc bare" fill="none" stroke="#1B2436" stroke-width="2.2" stroke-linecap="round">${bare}</g>
<g class="trc leaf-drop" fill="#6B4A28">${falling}</g>
<rect class="trc fog" x="-20" y="640" width="1480" height="250" fill="url(#fwfog)"/>
</svg>`;
}

function beachWide() {
  // A visible sand strip and room for the entire wave below the horizon.
  // The crab patrols the open right bank, within both laptop crops.
  const HORIZON = 650;
  const SHORE = 790;
  /* The sand is a curve, not a line: it rises to SHORE-14 around x 480. The
     surfer's lowest point has to clear the HIGHEST sand, not the average one,
     or it beaches itself a third of the way across the frame. */
  const SURF_Y = 724;
  const stars = wideStars(44, 201, 440);
  /* Same reserved window the forest's moon uses. */
  const SUN_X = 1040;

  const wavePath = (y, a) => {
    let d = `M0,${y}`;
    for (let x = 0; x < 2880; x += 40) d += ` Q${x + 20},${y - a} ${x + 40},${y}`;
    return d;
  };
  const waves = [[660, 2.4, 1.2, 0.34, 34], [685, 2.8, 1.2, 0.3, 42], [710, 3.2, 1.1, 0.26, 50], [740, 3.6, 1.1, 0.22, 58], [770, 4, 1, 0.18, 68]]
    // 1440 / 40 = 36 whole crest periods, so the shift is invisible.
    .map(([y, amp, w, op, dur]) => `<path class="a wave" d="${wavePath(y, amp)}" stroke="#F7D2B4" stroke-width="${w}" opacity="${op}" style="--wave:-1440px;animation-duration:${dur}s"/>`)
    .join('');

  /* The sun's glitter on the water.

     It used to be twelve near-identical bars of the same opacity marching down
     the sea, which read as a ladder of stray marks rather than as light. A
     glitter path is widest and brightest where it meets the horizon under the
     sun and breaks up as it comes towards the viewer, so the marks now taper
     in width AND fade, and each one is jittered off the centre line. */
  const reflect = Array.from({ length: 16 }, (_, i) => {
    const f = i / 15;
    const w = (96 - 78 * f) * rr(i, 213, 0.72, 1.12);
    const op = (0.5 - 0.4 * f) * rr(i, 214, 0.65, 1.15);
    const jitter = (rnd(i, 211) - 0.5) * (10 + 26 * f);
    /* The taper rides on a wrapper group: `w-tw` animates opacity on the rect
       itself, and a CSS animation beats a presentation attribute, so putting
       the fade on the rect would simply be overwritten. On the group the two
       multiply, which is the twinkle happening *within* the fade. */
    return `<g opacity="${op.toFixed(2)}"><rect class="a shim" x="${(SUN_X - w / 2 + jitter).toFixed(1)}" y="${(HORIZON + 6 + i * 6.4).toFixed(1)}" width="${w.toFixed(1)}" height="${(2.6 - 0.9 * f).toFixed(1)}" rx="1.3" style="animation-delay:${(-rr(i, 212, 0, 4)).toFixed(1)}s"/></g>`;
  }).join('');

  const grains = Array.from({ length: 420 }, (_, i) =>
    `<circle cx="${rr(i, 261, 0, VW_W).toFixed(1)}" cy="${rr(i, 262, SHORE + 4, 900).toFixed(1)}" r="${rr(i, 263, 0.5, 1.6).toFixed(2)}" fill="#FFF0DC" opacity="${rr(i, 264, 0.06, 0.26).toFixed(2)}"/>`
  ).join('');
  const pebbles = Array.from({ length: 34 }, (_, i) =>
    `<ellipse cx="${rr(i, 265, 10, 1430).toFixed(0)}" cy="${rr(i, 266, SHORE + 14, 880).toFixed(0)}" rx="${rr(i, 267, 2, 4.6).toFixed(1)}" ry="${rr(i, 268, 1.2, 2.6).toFixed(1)}" fill="#3A2230" opacity="0.3"/>`
  ).join('');
  const rocks = [[180, 16, 10], [214, 10, 6.4], [1140, 19, 12], [1180, 12, 7.4], [640, 11, 6.6]]
    .map(([x, rx, ry], i) => `<ellipse cx="${x}" cy="${SHORE + 30 + i * 5}" rx="${rx}" ry="${ry}" fill="#4B2C3C"/>`).join('');
  const litter = Array.from({ length: 34 }, (_, i) => {
    const x = rr(i, 281, 20, 1420).toFixed(0), y = rr(i, 282, SHORE + 10, SHORE + 90).toFixed(0);
    return rnd(i, 283) > 0.5
      ? `<path d="M${x},${y} q6,-4 12,0 q6,4 12,0" fill="none" stroke="#3E5340" stroke-width="1.7" stroke-linecap="round"/>`
      : `<rect x="${x}" y="${y}" width="${rr(i, 284, 5, 11).toFixed(1)}" height="3" rx="1" fill="#C9BFA8" transform="rotate(${rr(i, 285, -50, 50).toFixed(0)} ${x} ${y})"/>`;
  }).join('');

  const crabLeg = (x, d) => `<line class="a crab-leg" x1="${x}" y1="0" x2="${x + d}" y2="5" stroke="#B3261E" stroke-width="1.4" stroke-linecap="round" style="animation-delay:${(-Math.abs(x) * 0.06).toFixed(2)}s"/>`;

  return `<svg class="scene" data-decay="0" viewBox="0 0 ${VW_W} ${VW_H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
<defs>
<linearGradient id="bwsky" x1="0" y1="0" x2="0" y2="1"><stop class="trc s0" offset="0"/><stop class="trc s1" offset="0.3"/><stop class="trc s2" offset="0.47"/><stop class="trc s3" offset="0.58"/><stop offset="1" stop-color="#1A1426"/></linearGradient>
<radialGradient id="bwsun"><stop offset="0" stop-color="#FFF4D6"/><stop offset="0.6" stop-color="#FFD39A"/><stop class="trc sun-edge" offset="1"/></radialGradient>
<radialGradient id="bwglow"><stop class="trc sun-edge" offset="0" stop-opacity="0.55"/><stop offset="1" stop-color="#F29A5B" stop-opacity="0"/></radialGradient>
<linearGradient id="bwsea" x1="0" y1="0" x2="0" y2="1"><stop class="trc sea-top" offset="0"/><stop offset="0.05" stop-color="#C06A62"/><stop offset="0.2" stop-color="#2E5A6E"/><stop offset="1" stop-color="#0E2334"/></linearGradient>
<linearGradient id="bwsand" x1="0" y1="0" x2="0" y2="1"><stop class="trc sand-top" offset="0"/><stop offset="1" stop-color="#4A2E3A"/></linearGradient>
<clipPath id="bwclip"><rect x="0" y="0" width="${VW_W}" height="${HORIZON}"/></clipPath>
<clipPath id="bwsandclip"><path d="M0,${SHORE} C480,${SHORE - 14} 940,${SHORE + 14} 1440,${SHORE - 4} L1440,900 L0,900 Z"/></clipPath>
</defs>
<rect width="${VW_W}" height="${VW_H}" fill="url(#bwsky)"/>
<g class="trc beach-stars">${stars}</g>
<g class="trc cloud-col" opacity="0.62">
<g class="a drift"><ellipse cx="320" cy="180" rx="150" ry="10"/><ellipse cx="376" cy="166" rx="84" ry="8"/></g>
<g class="a drift" style="animation-duration:120s;animation-delay:-40s"><ellipse cx="1100" cy="300" rx="140" ry="9"/><ellipse cx="1046" cy="288" rx="72" ry="7"/></g>
<g class="a drift" style="animation-duration:105s;animation-delay:-70s"><ellipse cx="240" cy="408" rx="128" ry="7"/></g>
<g class="a drift" style="animation-duration:132s;animation-delay:-20s"><ellipse cx="1240" cy="140" rx="104" ry="7"/></g>
</g>
<g clip-path="url(#bwclip)">
<circle class="a glow trc sun-glow" cx="${SUN_X}" r="220" fill="url(#bwglow)"/>
<circle class="trc sun" cx="${SUN_X}" r="54" fill="url(#bwsun)"/>
</g>

<!-- The banner was crossing at y 300, which at laptop width is the band the
     dashboard's first card row occupies: it was behind a card for all but a
     sliver of its flight. It now flies through the same reserved sky window
     the sun sits in, so the face on the banner is readable for most of the
     crossing rather than for a moment at each edge. -->
<g class="a plane" style="${travelStyle(VW_W, -211, 337, 60)}">
<g transform="translate(0 150) scale(3.4)">
<path d="M0,0 L19,0 L25,-5 L29,-5 L26,0 L33,0 L37,4 L25,4 L19,4 Z" fill="#2E2235"/>
<path d="M12,0 L6,-9 L10,-9 L19,0 Z" fill="#3C2C44"/>
<path d="M1,1.5 L-5,0" stroke="#2E2235" stroke-width="1.1" opacity="0.8"/>
<g class="a pennant">
<path d="M-5,-9 L-55,-9 L-62,0 L-55,9 L-5,9 Z" class="trc pennant-fill"/>
<circle class="trc pennant-face" cx="-40" cy="-2" r="2"/>
<circle class="trc pennant-face" cx="-26" cy="-2" r="2"/>
<path class="trc mouth-happy" d="M-43,3 Q-33,8.5 -23,3" fill="none" stroke-width="1.8" stroke-linecap="round"/>
<path class="trc mouth-flat" d="M-43,5 L-23,5" fill="none" stroke-width="1.8" stroke-linecap="round"/>
<path class="trc mouth-sad" d="M-43,7 Q-33,1.5 -23,7" fill="none" stroke-width="1.8" stroke-linecap="round"/>
</g>
</g>
</g>

<rect x="0" y="${HORIZON}" width="${VW_W}" height="${900 - HORIZON}" fill="url(#bwsea)"/>
<rect class="trc waterline" x="0" y="${HORIZON - 1}" width="${VW_W}" height="2.4" opacity="0.6"/>
<g class="trc reflect">${reflect}</g>
<g fill="none" stroke-linecap="round">${waves}</g>

<g class="trc surf-wrap">
<g class="a surfer" style="${travelStyle(VW_W, -134, 243, 60)}">
<!-- scale 2.6: at 3.2 the wave stood 90 units tall and could not fit between
     the waterline and the sand without one end or the other leaving the sea. -->
<g transform="translate(0 ${SURF_Y}) scale(2.2)">
<g class="a surf-crest">
<path d="M-42,13 Q-24,11 -9,4 Q3,-3 14,-9 Q25,-15 30,-7 Q34,1 32,13 Z" fill="#4E97B0"/>
<path d="M-34,13 Q-18,11 -5,5 Q6,-1 15,-6 Q24,-11 28,-4 Q31,3 29,13 Z" fill="#7CBFD2" opacity="0.85"/>
<path d="M-20,13 Q-8,11 2,6 Q11,1 19,-2 Q26,-4 27,4 L27,13 Z" fill="#B6E2EC" opacity="0.55"/>
</g>
<g class="a surf-curl">
<path d="M14,-9 Q25,-15 30,-7 Q22,-12 13,-7 Q6,-4 1,-1 Q7,-6 14,-9 Z" fill="#FFFFFF"/>
<path d="M19,-9 Q27,-12 30,-7 Q25,-10 19,-9 Z" fill="#FFFFFF" opacity="0.8"/>
</g>
<g class="a surf-bob">
<g transform="translate(-7 3)">
<path d="M-13,4 Q0,9 14,3 Q0,7 -13,4 Z" fill="#FFF3DC"/>
<path d="M-13,4 Q0,9 14,3" fill="none" stroke="#C9A97E" stroke-width="0.7"/>
<g class="a surf-rider">
<path d="M0,3 L1,-9" stroke="#2E2235" stroke-width="2.6" stroke-linecap="round"/>
<circle cx="1.6" cy="-12.2" r="2.8" fill="#2E2235"/>
<path d="M0.8,-7 L8,-10.5 M0.8,-7 L-6,-11.5" stroke="#2E2235" stroke-width="1.7" stroke-linecap="round"/>
<path d="M0,3 L-3.4,7 M1,3 L4.4,7" stroke="#2E2235" stroke-width="1.8" stroke-linecap="round"/>
</g>
</g>
</g>
<g class="a surf-foam">
<path d="M1,-1 Q-7,3 -16,6 Q-25,9 -33,11" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" opacity="0.9"/>
<path d="M-30,13 Q-16,16 -2,13" fill="none" stroke="#FFF6EC" stroke-width="1.6" stroke-linecap="round"/>
<circle cx="-20" cy="7" r="1.1" fill="#FFFFFF"/><circle cx="-27" cy="10" r="0.8" fill="#FFFFFF"/>
<circle cx="-12" cy="5" r="0.7" fill="#FFFFFF"/><circle cx="26" cy="-9" r="1" fill="#FFFFFF"/>
</g>
</g>
</g>
</g>

<path d="M0,${SHORE} C480,${SHORE - 14} 940,${SHORE + 14} 1440,${SHORE - 4} L1440,900 L0,900 Z" fill="url(#bwsand)"/>
<g clip-path="url(#bwsandclip)">${grains}${pebbles}</g>
<g class="trc rocks">${rocks}</g>
<path class="a lap" d="M0,${SHORE - 2} C480,${SHORE - 16} 940,${SHORE + 12} 1440,${SHORE - 6}" fill="none" stroke="#FFF1E2" stroke-width="2.4" opacity="0.6"/>
<g class="trc litter">${litter}</g>

<g class="trc crab-wrap">
<!-- Wider patrol and a 1.8x larger crab. Its full body stays below the
     dashboard, on sand, with a margin inside both reference laptop crops. -->
<g class="a crab crab--wide" style="--k:0.86;animation-duration:16s">
<g transform="translate(1282 ${(SHORE + 84).toFixed(0)}) scale(2.34)">
${crabLeg(-7, -4)}${crabLeg(-3, -3)}${crabLeg(3, 3)}${crabLeg(7, 4)}
<ellipse cx="0" cy="-2" rx="8" ry="5.4" fill="#D7372A"/>
<ellipse cx="0" cy="-3.4" rx="6" ry="3" fill="#E8564A" opacity="0.8"/>
<path d="M-8,-4 L-13,-8 L-10,-9 L-6,-6 Z" fill="#B3261E"/>
<path d="M8,-4 L13,-8 L10,-9 L6,-6 Z" fill="#B3261E"/>
<circle cx="-3" cy="-6.6" r="1.5" fill="#2B0F0C"/><circle cx="3" cy="-6.6" r="1.5" fill="#2B0F0C"/>
<circle cx="-2.6" cy="-7" r="0.5" fill="#fff"/><circle cx="3.4" cy="-7" r="0.5" fill="#fff"/>
</g>
</g>
</g>
</svg>`;
}

function cityWide() {
  const FACE_HAPPY = ['.......', '.XX.XX.', '.XX.XX.', '.......', 'X.....X', '.X...X.', '..XXX..'];
  const FACE_FLAT = ['.......', '.XX.XX.', '.XX.XX.', '.......', '.......', '.XXXXX.', '.......'];
  const FACE_SAD = ['.......', '.XX.XX.', '.XX.XX.', '.......', '..XXX..', '.X...X.', 'X.....X'];
  /* The face used to sit at y 212..386 on a tower starting at y 150 — the
     exact rectangle the old laptop layout put the Budget by category card in,
     so the one subject that reacts to the budget was invisible at every budget
     state. Tower and face now start high enough to land inside the sky window
     the Home grid reserves (x 660..1400, y 90..380 in these units). */
  const TOWER_X = 990, TOWER_Y = 64, TOWER_W = 300;
  const FACE_X = 1016, FACE_Y = 116, FDX = 34, FDY = 27;

  const win = (x, y, o, cls = '', delay = '', w = 11, h = 7) =>
    `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="0.8" opacity="${o}"${delay}/>`;

  const out = [];
  const grid = (x0, y0, cols, rows, dx, dy, base, salt, reserve = false) => {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const k = r * cols + c + salt * 100;
      if (reserve && r >= 1 && r <= 13) continue;
      if (rnd(k, salt) < 0.4) continue;
      const flick = rnd(k, salt + 7) > 0.92 ? 'a flick' : '';
      out.push(win(x0 + c * dx, y0 + r * dy, (base * rr(k, salt + 3, 0.6, 1)).toFixed(2), flick,
        ` style="animation-delay:${(-rr(k, salt + 5, 0, 12)).toFixed(1)}s"`));
    }
  };
  /* reserve skips the rows the face occupies, so no ordinary lit window is
     drawn underneath it. Face rows run y 116..368; this grid starts at 84
     with a 21 pitch, so those are rows 2..13. */
  grid(1000, 84, 9, 22, 29, 21, 0.95, 1, true);
  const towerCount = out.length;
  grid(620, 280, 7, 11, 29, 22, 0.6, 2);
  grid(250, 330, 6, 9, 30, 22, 0.5, 3);
  grid(40, 380, 5, 7, 30, 22, 0.42, 4);
  const towerWindows = out.slice(0, towerCount).join('');
  const blockWindows = out.slice(towerCount).join('');

  const face = (pattern, cls) => pattern.flatMap((row, r) => [...row].map((ch, c) => {
    if (ch !== 'X') return '';
    const flick = rnd(r * 7 + c, 91) > 0.86 ? ' a flick' : '';
    return win(FACE_X + c * FDX, FACE_Y + r * FDY, 1, `${cls}${flick}`,
      ` style="animation-delay:${(-rr(r * 7 + c, 92, 0, 12)).toFixed(1)}s"`, 19, 12);
  })).join('');

  const farTowers = Array.from({ length: 26 }, (_, i) => {
    const x = (i * 56 + rnd(i, 95) * 16).toFixed(0), h = (70 + rnd(i, 96) * 130).toFixed(0);
    return `<rect x="${x}" y="${560 - h}" width="${(32 + rnd(i, 97) * 20).toFixed(0)}" height="${h}"/>`;
  }).join('');

  const streaks = (n, saltBase, len, drift, dur0, durSpan) => Array.from({ length: n }, (_, i) => {
    const x = rnd(i, saltBase) * 1480, y = rnd(i, saltBase + 1) * 880;
    return `<line class="a rain" x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x - drift).toFixed(1)}" y2="${(y + len).toFixed(1)}" style="animation-delay:${(-rnd(i, saltBase + 2)).toFixed(2)}s;animation-duration:${(dur0 + rnd(i, saltBase + 3) * durSpan).toFixed(2)}s"/>`;
  }).join('');

  const drips = [[180, 812], [460, 836], [760, 848], [1060, 832], [1310, 818], [300, 854]]
    .map((p, i) => `<ellipse class="a drip" cx="${p[0]}" cy="${p[1]}" rx="11" ry="2.6" style="animation-delay:${(-i * 0.45).toFixed(2)}s"/>`).join('');

  const puddle = (x, w) => `<rect x="${x}" y="812" width="${w}" height="80" fill="url(#cwref)"/>`;
  const wide = [[70, 240], [470, 300], [900, 220], [1200, 180]]
    .map(([x, w]) => `<ellipse cx="${x + w / 2}" cy="${868 + (x % 9)}" rx="${w / 2}" ry="9"/>`).join('');
  const laneDash = Array.from({ length: 24 }, (_, i) => `<rect x="${i * 62}" y="880" width="34" height="3" rx="1.5" fill="#C9D6E8" opacity="0.22"/>`).join('');
  const viaductLamps = Array.from({ length: 22 }, (_, i) => `<rect x="${20 + i * 66}" y="588" width="4" height="8" rx="1.5"/>`).join('');

  // Scaled 1.9x, so the body is ~99 wide rather than 52.
  const car = (x, body, roof, cls) => `<g class="a ${cls}" style="${travelStyle(VW_W, x, 99, 60)}">
<g transform="translate(${x} 822) scale(1.55)">
<path d="M4,14 L8,4 Q10,1 14,1 L34,1 Q38,1 40,4 L45,14 Z" fill="${roof}"/>
<rect x="0" y="13" width="52" height="11" rx="4" fill="${body}"/>
<rect class="trc win-col" x="11" y="5" width="12" height="7" rx="1.5" opacity="0.75"/>
<rect class="trc win-col" x="26" y="5" width="12" height="7" rx="1.5" opacity="0.75"/>
<circle cx="12" cy="25" r="4.4" fill="#05070C"/><circle cx="40" cy="25" r="4.4" fill="#05070C"/>
<rect class="trc win-col" x="49" y="16" width="4" height="3" rx="1" opacity="0.9"/>
<rect x="-1" y="16" width="4" height="3" rx="1" fill="#C0392B" opacity="0.85"/>
</g></g>`;

  return `<svg class="scene" data-decay="0" viewBox="0 0 ${VW_W} ${VW_H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
<defs>
<linearGradient id="cwsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0E1424"/><stop offset="0.28" stop-color="#202A45"/><stop class="trc horizon-stop" offset="0.6"/><stop offset="0.64" stop-color="#151B29"/><stop offset="1" stop-color="#0A0D14"/></linearGradient>
<radialGradient id="cwlampg"><stop class="trc lamp-stop" offset="0" stop-opacity="0.6"/><stop offset="1" stop-color="#F7B65E" stop-opacity="0"/></radialGradient>
<linearGradient id="cwref" x1="0" y1="0" x2="0" y2="1"><stop class="trc win-stop" offset="0" stop-opacity="0.55"/><stop class="trc win-stop" offset="1" stop-opacity="0"/></linearGradient>
</defs>
<rect width="${VW_W}" height="${VW_H}" fill="url(#cwsky)"/>
<g class="trc skyline-far" fill="#161D2E">${farTowers}</g>
<g fill="#1A2234"><rect x="0" y="360" width="70" height="200"/><rect x="74" y="420" width="56" height="140"/><rect x="560" y="330" width="48" height="230"/><rect x="820" y="390" width="74" height="170"/><rect x="900" y="270" width="44" height="290"/></g>
<rect x="240" y="320" width="196" height="240" fill="#131928"/>
<rect x="610" y="266" width="220" height="294" fill="#121826"/>
<rect x="30" y="368" width="180" height="192" fill="#121826"/>
<rect x="${TOWER_X}" y="${TOWER_Y}" width="${TOWER_W}" height="${560 - TOWER_Y}" fill="#121826"/>
<rect x="${TOWER_X}" y="${TOWER_Y}" width="${TOWER_W}" height="7" fill="#1C2436"/>
<g class="trc win-col">${towerWindows}</g>
<g class="trc win-dark"><g class="trc win-col">${blockWindows}</g></g>
<g class="trc win-col face-happy">${face(FACE_HAPPY, 'face-happy')}</g>
<g class="trc win-col face-flat">${face(FACE_FLAT, 'face-flat')}</g>
<g class="trc win-col face-sad">${face(FACE_SAD, 'face-sad')}</g>

<rect x="0" y="560" width="${VW_W}" height="16" fill="#0B0F18"/>
<g class="trc viaduct-lamp"><g class="trc lamp-col">${viaductLamps}</g></g>
<g fill="#0B0F18"><rect x="180" y="576" width="18" height="48"/><rect x="620" y="576" width="18" height="48"/><rect x="1080" y="576" width="18" height="48"/></g>
<g class="a train" style="${travelStyle(VW_W, 40, 470, 60)}">
<rect x="40" y="520" width="470" height="36" rx="13" fill="#090D15"/>
<rect class="trc win-col" x="58" y="530" width="434" height="10" rx="4" opacity="0.85"/>
<rect x="170" y="528" width="5" height="15" fill="#090D15"/><rect x="286" y="528" width="5" height="15" fill="#090D15"/><rect x="402" y="528" width="5" height="15" fill="#090D15"/>
</g>

<g transform="translate(0 -160)">
<!-- The road sits in the strip the dashboard leaves clear, so the cars that
     cross it are actually on screen rather than under the centre column. -->
<rect x="0" y="790" width="${VW_W}" height="270" fill="#111622"/>
<line x1="0" y1="792" x2="${VW_W}" y2="792" stroke="#2A3348" stroke-width="2"/>
${laneDash}
<rect x="0" y="802" width="${VW_W}" height="2" fill="#C9D6E8" opacity="0.12"/>

<rect x="224" y="768" width="5" height="40" fill="#0B0F18"/>
<circle cx="226" cy="766" r="72" fill="url(#cwlampg)"/>
<circle class="trc lamp-col" cx="226" cy="766" r="5"/>
<rect x="1180" y="768" width="5" height="40" fill="#0B0F18"/>
<circle cx="1182" cy="766" r="72" fill="url(#cwlampg)"/>
<circle class="trc lamp-col" cx="1182" cy="766" r="5"/>

${car(820, '#2F6E9E', '#24567C', 'car-a')}
${car(600, '#8C5A2B', '#6E4621', 'car-b')}

<g>
<rect x="1096" y="846" width="5" height="34" fill="#0B0F18"/>
<rect x="1086" y="786" width="26" height="60" rx="7" fill="#0B0F18"/>
<circle class="a lamp-red" cx="1099" cy="800" r="7" fill="#E2483C"/>
<circle class="a lamp-amber" cx="1099" cy="816" r="7" fill="#E8B04F"/>
<circle class="a lamp-green" cx="1099" cy="832" r="7" fill="#6FD39B"/>
</g>

<g class="trc puddle-wide" fill="#1A2334" opacity="0">${wide}</g>
<g class="street-ref">${puddle(240, 30)}${puddle(640, 20)}${puddle(900, 16)}${puddle(1240, 22)}${puddle(90, 14)}</g>
<g class="rain-layer" fill="none" stroke="#B9C9DE" stroke-width="0.7">${drips}</g>
</g>
<g class="trc rain-layer" stroke="#C9D6E8" stroke-width="0.9" stroke-linecap="round">${streaks(130, 21, 18, 4, 0.8, 0.4)}</g>
<g class="trc rain-heavy" stroke="#D8E2F0" stroke-width="1.1" stroke-linecap="round">${streaks(100, 31, 24, 5, 0.6, 0.3)}</g>
</svg>`;
}

const SCENES = {
  forest: { tall: forestScene, wide: forestWide },
  beach: { tall: beachScene, wide: beachWide },
  city: { tall: cityScene, wide: cityWide },
};

/* ── Entry points ──────────────────────────────────────────────── */

/** The stylesheet is shared by all three scenes, so it is injected once. */
function ensureSceneCss() {
  if (document.getElementById('scene-css')) return;
  const style = document.createElement('style');
  style.id = 'scene-css';
  style.textContent = SCENE_CSS;
  document.head.appendChild(style);
}

const sceneEl = () => document.querySelector('#bg .scene');

/**
 * Builds the wallpaper. Call this when the app opens and when the THEME
 * changes — never when spending changes. `setOver` handles that.
 */
export function paintBackground(theme) {
  const bgEl = document.getElementById('bg');
  if (!bgEl) return;

  ensureSceneCss();
  const set = SCENES[theme?.scene] || SCENES.forest;
  bgEl.innerHTML = (isWide() ? set.wide : set.tall)();
}

/**
 * The only thing spending is allowed to change: how run-down the world looks,
 * 0 to 2. One attribute; CSS does the rest, and the transition runs once in
 * whichever direction it was given — so recovering is the same move backwards.
 *
 * Clamped rather than trusted. A level outside 0..2 would match no rule at all
 * and leave the scene stuck on whatever it was showing, which is a far more
 * confusing failure than snapping to a valid neighbour.
 */
export function setSceneDecay(level) {
  const el = sceneEl();
  if (!el) return;
  const n = Math.min(2, Math.max(0, Math.round(Number(level) || 0)));
  el.setAttribute('data-decay', String(n));
}

/** Rule 3.6: loops only run on Home, and only while the page is visible. */
export function setScenePaused(paused) {
  const el = sceneEl();
  if (el) el.classList.toggle('paused', !!paused);
}

/**
 * Rule 3.9. The media query in SCENE_CSS already covers the OS setting; this
 * is the hook for the in-app switch, which phase 3 adds to Settings.
 */
export function setSceneStill(still) {
  const el = sceneEl();
  if (el) el.classList.toggle('still', !!still);
}
