/**
 * Wallpaper painting.
 *
 * Scenes (forest, beach, city) are the live wallpapers. Built ONCE and kept
 * mounted. Everything that changes with the budget is a CSS rule keyed on
 *     `data-over` on the scene root. No JavaScript touches the SVG after it is
 *     built, so no animation ever restarts mid-month.
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

/** The box every scene is composed in. Nothing here depends on the viewport. */
const VB_W = 390;
const VB_H = 844;

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
 * Every calm/over difference in the three scenes, as CSS.
 *
 * This is the whole point of the rewrite. The old engine re-serialised the SVG
 * whenever spending moved, which restarted every animation — log an expense and
 * the deer teleported back to the edge of the frame. Here the only thing that
 * changes is `data-over` on the root, and the cascade does the rest.
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

/* ── Calm, then the over overrides. ──
 *
 * Written as plain paired rules rather than custom properties read through
 * var(): the value a given element takes in each state is readable straight
 * off these two lines, and devtools shows which rule won. */

/* forest */
#bg .moon-shade{cx:392px}
#bg .moon-glow{opacity:1}
#bg .moon-reflect{opacity:0.4}
#bg .river-lines{opacity:0.55}
#bg .fish-group{opacity:1}
#bg .deer{transform:translateX(0);opacity:1}
#bg .scene[data-over="true"] .moon-shade{cx:322px}
#bg .scene[data-over="true"] .moon-glow{opacity:0.35}
#bg .scene[data-over="true"] .moon-reflect{opacity:0.12}
#bg .scene[data-over="true"] .river-lines{opacity:0.22}
#bg .scene[data-over="true"] .fish-group{opacity:0}
#bg .scene[data-over="true"] .deer{transform:translateX(-170px);opacity:0}

/* beach */
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
#bg .mouth-happy,#bg .mouth-sad{stroke:#B3261E}
#bg .mouth-happy{opacity:1}
#bg .mouth-sad{opacity:0}
#bg .scene[data-over="true"] .s0{stop-color:#0B1230}
#bg .scene[data-over="true"] .s1{stop-color:#23295A}
#bg .scene[data-over="true"] .s2{stop-color:#4B3F72}
#bg .scene[data-over="true"] .s3{stop-color:#8C6A8E}
#bg .scene[data-over="true"] .sun-edge{stop-color:#C9637A}
#bg .scene[data-over="true"] .sun,#bg .scene[data-over="true"] .sun-glow{cy:280px}
#bg .scene[data-over="true"] .sun{opacity:0.6}
#bg .scene[data-over="true"] .sea-top{stop-color:#4E4A72}
#bg .scene[data-over="true"] .waterline{fill:#9A93C0}
#bg .scene[data-over="true"] .sand-top{stop-color:#6E5470}
#bg .scene[data-over="true"] .cloud-col{fill:#5D5884}
#bg .scene[data-over="true"] .reflect{fill:#B79BC4;opacity:0.4}
#bg .scene[data-over="true"] .beach-stars{opacity:1}
#bg .scene[data-over="true"] .pennant-fill{fill:#E8D9E4}
#bg .scene[data-over="true"] .pennant-face{fill:#7A4A63}
#bg .scene[data-over="true"] .mouth-happy,#bg .scene[data-over="true"] .mouth-sad{stroke:#7A4A63}
#bg .scene[data-over="true"] .mouth-happy{opacity:0}
#bg .scene[data-over="true"] .mouth-sad{opacity:1}

/* city */
#bg .win-col{fill:#F6C27A}
#bg .win-stop{stop-color:#F6C27A}
#bg .lamp-col{fill:#F7B65E}
#bg .lamp-stop{stop-color:#F7B65E}
#bg .horizon-stop{stop-color:#6A4E62}
#bg .rain-layer{opacity:0.2}
#bg .rain-heavy{opacity:0}
#bg .street-ref{opacity:0.5}
#bg .face-happy{opacity:1}
#bg .face-sad{opacity:0}
#bg .scene[data-over="true"] .win-col{fill:#A9C1DE}
#bg .scene[data-over="true"] .win-stop{stop-color:#A9C1DE}
#bg .scene[data-over="true"] .lamp-col{fill:#D3E2F4}
#bg .scene[data-over="true"] .lamp-stop{stop-color:#D3E2F4}
#bg .scene[data-over="true"] .horizon-stop{stop-color:#334A68}
#bg .scene[data-over="true"] .rain-layer{opacity:0.6}
#bg .scene[data-over="true"] .rain-heavy{opacity:0.6}
#bg .scene[data-over="true"] .street-ref{opacity:0.9}
#bg .scene[data-over="true"] .face-happy{opacity:0}
#bg .scene[data-over="true"] .face-sad{opacity:1}

/* ── The one-off calm↔over move (3.8). Reversible by construction. ── */
#bg .tr{transition:transform 3.2s cubic-bezier(0.45,0,0.55,1),opacity 1.4s ease 1.8s}
#bg .trc{transition:cx 2.4s cubic-bezier(0.16,1,0.3,1),cy 2.4s cubic-bezier(0.16,1,0.3,1),opacity 2s ease,fill 2s ease,stop-color 2s ease}

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
  14%,24%{transform:translateX(34px) scaleX(1)}
  34%,44%{transform:translateX(74px) scaleX(1)}
  46%{transform:translateX(74px) scaleX(-1)}
  58%,68%{transform:translateX(40px) scaleX(-1)}
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

#bg .car-a{animation:w-car-a 24s linear infinite}
@keyframes w-car-a{
  0%,35%{transform:translateX(0)}
  60%{transform:translateX(330px)}
  60.001%{transform:translateX(-440px)}
  86%,100%{transform:translateX(0)}
}
#bg .car-b{animation:w-car-b 24s linear infinite}
@keyframes w-car-b{
  0%,38%{transform:translateX(0)}
  64%{transform:translateX(340px)}
  64.001%{transform:translateX(-440px)}
  90%,100%{transform:translateX(0)}
}

/* The plane crosses once a minute, pennant trailing. Parked off-frame at both
   ends of the loop so the reset is never seen. */
#bg .plane{animation:w-plane 58s linear infinite}
@keyframes w-plane{0%{transform:translateX(-200px)}72%,100%{transform:translateX(470px)}}
#bg .pennant{transform-box:fill-box;transform-origin:0% 50%;animation:w-flap 1.6s ease-in-out infinite}
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
  0%{opacity:0;transform:translateX(410px)}
  6%{opacity:1}
  94%{opacity:1}
  100%{opacity:0;transform:translateX(-40px)}
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
  22%,30%{transform:translateX(58px)}
  48%,56%{transform:translateX(126px)}
  72%,80%{transform:translateX(64px)}
  96%,100%{transform:translateX(0)}
}
#bg .crab-leg{transform-box:fill-box;transform-origin:50% 0%;animation:w-scuttle 0.42s ease-in-out infinite}
@keyframes w-scuttle{0%,100%{transform:rotate(-13deg)}50%{transform:rotate(13deg)}}

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
#bg .drift{animation:w-drift 90s ease-in-out infinite alternate}
@keyframes w-drift{from{transform:translateX(-26px)}to{transform:translateX(34px)}}
#bg .wave{animation:w-wave 30s linear infinite}
@keyframes w-wave{from{transform:translateX(0)}to{transform:translateX(-390px)}}
#bg .shim{animation:w-tw 3.8s ease-in-out infinite}
#bg .lap{animation:w-lap 8s ease-in-out infinite}
@keyframes w-lap{0%,100%{transform:translateY(0)}50%{transform:translateY(4px)}}
#bg .glow{animation:w-glow 9s ease-in-out infinite}
@keyframes w-glow{0%,100%{opacity:.75}50%{opacity:1}}
#bg .train{animation:w-train 20s linear infinite}
@keyframes w-train{0%{transform:translateX(-360px)}42%{transform:translateX(430px)}100%{transform:translateX(430px)}}
#bg .flick{animation:w-flick 13s steps(1) infinite}
@keyframes w-flick{0%,58%{opacity:1}60%,74%{opacity:.15}76%,100%{opacity:1}}
#bg .rain{animation:w-rain .95s linear infinite}
@keyframes w-rain{0%{opacity:0;transform:translate(4px,-70px)}12%{opacity:1}88%{opacity:1}100%{opacity:0;transform:translate(-8px,90px)}}
#bg .drip{transform-box:fill-box;transform-origin:50% 50%;animation:w-drip 2.6s ease-out infinite}
@keyframes w-drip{0%{opacity:.8;transform:scale(.2)}100%{opacity:0;transform:scale(1.6)}}

/* Over budget stills the water rather than reversing it: a river that flows
   backwards reads as a bug, not as a mood. */
#bg .scene[data-over="true"] .flow,
#bg .scene[data-over="true"] .deerwalk,
#bg .scene[data-over="true"] .deerhead{animation:none}

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
  const fish = (i) => {
    const tx = rr(i, 41, 150, 350).toFixed(0);
    const ty = rr(i, 42, 344, 396).toFixed(0);
    const dur = rr(i, 43, 9, 17).toFixed(1);
    const delay = (-rr(i, 44, 0, 17)).toFixed(1);
    const sc = rr(i, 45, 0.78, 1.15).toFixed(2);
    const st = ` style="animation-duration:${dur}s;animation-delay:${delay}s"`;
    return `<g transform="translate(${tx} ${ty}) scale(${sc})">` +
      `<ellipse class="a ripple" cx="0" cy="2" rx="9" ry="2.2" fill="none" stroke="#BFD2EA" stroke-width="0.9"${st}/>` +
      `<path class="a fish" d="M0,0 C4,-3 9,-3 12,0 C9,3 4,3 0,0 Z M12,0 L16,-3 L16,3 Z" fill="#C9D9EE"${st}/></g>`;
  };
  const fishes = [0, 1, 2].map(fish).join('');

  // One or two shooting stars, somewhere in the upper sky, on long lazy cycles
  // so they stay an event rather than a feature.
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

  return `<svg class="scene" data-over="false" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMin slice" xmlns="http://www.w3.org/2000/svg">
<defs>
<linearGradient id="fsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050918"/><stop offset="0.16" stop-color="#0C1532"/><stop offset="0.33" stop-color="#1A2A4C"/><stop offset="0.42" stop-color="#16243F"/><stop offset="1" stop-color="#070C16"/></linearGradient>
<radialGradient id="fglow"><stop offset="0" stop-color="#F6E7B8" stop-opacity="0.5"/><stop offset="1" stop-color="#F6E7B8" stop-opacity="0"/></radialGradient>
<linearGradient id="friv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2C4A6E"/><stop offset="1" stop-color="#132338"/></linearGradient>
<mask id="fmoon"><rect x="250" y="40" width="130" height="130" fill="#fff"/><circle class="trc moon-shade" cy="94" r="29" fill="#000"/></mask>
</defs>
<rect width="${VB_W}" height="${VB_H}" fill="url(#fsky)"/>
<g>${stars.join('')}</g>
${shooting}
<circle class="trc moon-glow" cx="310" cy="100" r="96" fill="url(#fglow)"/>
<circle cx="310" cy="100" r="28" fill="#F4ECD2" mask="url(#fmoon)"/>
<path d="M0,282 C60,262 110,274 160,266 C220,256 280,272 330,262 C360,256 380,262 390,260 L390,340 L0,340 Z" fill="#121D33"/>
<g fill="#0F192B">${ridgePines}</g>
<path d="M0,318 C120,306 260,324 390,312 L390,844 L0,844 Z" fill="#0B1422"/>
<path d="M390,330 C320,344 270,362 210,368 C140,375 80,392 0,410 L0,444 C90,424 150,406 214,400 C280,394 330,376 390,362 Z" fill="url(#friv)"/>
<ellipse class="trc moon-reflect" cx="296" cy="360" rx="16" ry="2.6" fill="#F4ECD2"/>
<g class="trc river-lines" fill="none" stroke="#A9C2E0" stroke-linecap="round">
<path class="a flow" d="M390,346 C320,360 270,378 210,384 C140,391 80,408 0,426" stroke-width="1.3" stroke-dasharray="7 17"/>
<path class="a flow" d="M390,354 C322,367 272,386 212,392 C142,399 82,416 0,434" stroke-width="1" stroke-dasharray="4 20" style="animation-duration:7s"/>
<path class="a flow" d="M390,339 C320,352 270,370 210,376 C140,383 80,400 0,418" stroke-width="0.9" stroke-dasharray="8 16" style="animation-duration:6s"/>
</g>
<g class="trc fish-group">${fishes}</g>
<g class="tr deer">
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
<g fill="#1E3046">${leaves}</g>
</svg>`;
}

/* ── Sunset beach ──────────────────────────────────────────────── */

function beachScene() {
  // Everything that matters has to live above y 392: the cards start there and
  // the scene is fixed, so no amount of scrolling reveals what is underneath.
  // Within that budget the sea gets twice the sand, per §13 — sea 296..360,
  // sand 360 down. The sun lifts to 230 so the plane and the surfer have room.
  const HORIZON = 296;
  const SHORE = 360;

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
    `<path class="a wave" d="${wavePath(y, amp)}" stroke="#F7D2B4" stroke-width="${w}" opacity="${op}" style="animation-duration:${dur}s"/>`
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

  const crabX = rr(0, 69, 30, 110).toFixed(0);
  const crabY = rr(0, 70, SHORE + 13, SHORE + 21).toFixed(0);
  const crabLeg = (x, d) =>
    `<line class="a crab-leg" x1="${x}" y1="0" x2="${x + d}" y2="5" stroke="#B3261E" stroke-width="1.4" stroke-linecap="round" style="animation-delay:${(-Math.abs(x) * 0.06).toFixed(2)}s"/>`;

  return `<svg class="scene" data-over="false" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMin slice" xmlns="http://www.w3.org/2000/svg">
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

<!-- The plane tows a pennant, not a slogan: the status is the chip's job. -->
<g class="a plane">
<g transform="translate(0 50) scale(1.8)">
<path d="M0,0 L19,0 L25,-5 L29,-5 L26,0 L33,0 L37,4 L25,4 L19,4 Z" fill="#2E2235"/>
<path d="M12,0 L6,-9 L10,-9 L19,0 Z" fill="#3C2C44"/>
<g class="a pennant">
<path d="M0,1 L-46,-5 L-46,8 Z" class="trc pennant-fill"/>
<circle class="trc pennant-face" cx="-30" cy="1.5" r="1.5"/>
<circle class="trc pennant-face" cx="-22" cy="1.5" r="1.5"/>
<path class="trc mouth-happy" d="M-32,5 Q-26,9.5 -20,5" fill="none" stroke-width="1.3" stroke-linecap="round"/>
<path class="trc mouth-sad" d="M-32,7.5 Q-26,3 -20,7.5" fill="none" stroke-width="1.3" stroke-linecap="round"/>
</g>
</g>
</g>

<rect x="0" y="${HORIZON}" width="${VB_W}" height="${844 - HORIZON}" fill="url(#bsea)"/>
<rect class="trc waterline" x="0" y="${HORIZON - 1}" width="${VB_W}" height="1.6" opacity="0.6"/>
<g class="trc reflect">${reflect}</g>
<g fill="none" stroke-linecap="round">${waves}</g>

<path d="M0,${SHORE} C130,${SHORE - 8} 250,${SHORE + 8} 390,${SHORE - 2} L390,844 L0,844 Z"/></clipPath>
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

<!-- The plane tows a pennant, not a slogan: the status is the chip's job. -->
<g class="a plane">
<g transform="translate(0 50) scale(1.8)">
<path d="M0,0 L19,0 L25,-5 L29,-5 L26,0 L33,0 L37,4 L25,4 L19,4 Z" fill="#2E2235"/>
<path d="M12,0 L6,-9 L10,-9 L19,0 Z" fill="#3C2C44"/>
<g class="a pennant">
<path d="M0,1 L-46,-5 L-46,8 Z" class="trc pennant-fill"/>
<circle class="trc pennant-face" cx="-30" cy="1.5" r="1.5"/>
<circle class="trc pennant-face" cx="-22" cy="1.5" r="1.5"/>
<path class="trc mouth-happy" d="M-32,5 Q-26,9.5 -20,5" fill="none" stroke-width="1.3" stroke-linecap="round"/>
<path class="trc mouth-sad" d="M-32,7.5 Q-26,3 -20,7.5" fill="none" stroke-width="1.3" stroke-linecap="round"/>
</g>
</g>
</g>

<rect x="0" y="${HORIZON}" width="${VB_W}" height="${844 - HORIZON}" fill="url(#bsea)"/>
<rect class="trc waterline" x="0" y="${HORIZON - 1}" width="${VB_W}" height="1.6" opacity="0.6"/>
<g class="trc reflect">${reflect}</g>
<g fill="none" stroke-linecap="round">${waves}</g>

<!-- Surfer on a breaking wave. Every part of this moves on its own clock; the
     group as a whole only supplies the travel across the bay. -->
<g class="a surfer">
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

<path d="M0,${SHORE} C130,${SHORE - 8} 250,${SHORE + 8} 390,${SHORE - 2} L390,844 L0,844 Z" fill="url(#bsand)"/>
<g clip-path="url(#bsandclip)">${grains}${pebbles}</g>
<path class="a lap" d="M0,${SHORE - 1} C130,${SHORE - 9} 250,${SHORE + 7} 390,${SHORE - 3}" fill="none" stroke="#FFF1E2" stroke-width="1.8" opacity="0.6"/>

<!-- Crab. Drawn after the sand so it is on the beach, not under it. -->
<g class="a crab">
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
  grid(112, 160, 5, 10, 17, 13, 0.6, 2);
  grid(4, 210, 5, 6, 18, 13, 0.45, 3);

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
  const car = (x, body, roof, cls) => `<g class="a ${cls}">
<g transform="translate(${x} 352)">
<path d="M4,14 L8,4 Q10,1 14,1 L34,1 Q38,1 40,4 L45,14 Z" fill="${roof}"/>
<rect x="0" y="13" width="52" height="11" rx="4" fill="${body}"/>
<rect class="trc win-col" x="11" y="5" width="12" height="7" rx="1.5" opacity="0.75"/>
<rect class="trc win-col" x="26" y="5" width="12" height="7" rx="1.5" opacity="0.75"/>
<circle cx="12" cy="25" r="4.4" fill="#05070C"/><circle cx="40" cy="25" r="4.4" fill="#05070C"/>
<rect class="trc win-col" x="49" y="16" width="4" height="3" rx="1" opacity="0.9"/>
<rect x="-1" y="16" width="4" height="3" rx="1" fill="#C0392B" opacity="0.85"/>
</g></g>`;

  return `<svg class="scene" data-over="false" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMin slice" xmlns="http://www.w3.org/2000/svg">
<defs>
<linearGradient id="csky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0E1424"/><stop offset="0.2" stop-color="#202A45"/><stop class="trc horizon-stop" offset="0.34"/><stop offset="0.36" stop-color="#151B29"/><stop offset="1" stop-color="#0A0D14"/></linearGradient>
<radialGradient id="clampg"><stop class="trc lamp-stop" offset="0" stop-opacity="0.6"/><stop offset="1" stop-color="#F7B65E" stop-opacity="0"/></radialGradient>
<linearGradient id="cref" x1="0" y1="0" x2="0" y2="1"><stop class="trc win-stop" offset="0" stop-opacity="0.55"/><stop class="trc win-stop" offset="1" stop-opacity="0"/></linearGradient>
</defs>
<rect width="${VB_W}" height="${VB_H}" fill="url(#csky)"/>
<g fill="#1A2234"><rect x="0" y="176" width="38" height="124"/><rect x="40" y="208" width="30" height="92"/><rect x="150" y="160" width="26" height="140"/><rect x="178" y="190" width="40" height="110"/><rect x="210" y="132" width="24" height="168"/></g>
<rect x="104" y="150" width="96" height="150" fill="#131928"/>
<rect x="-6" y="200" width="104" height="100" fill="#121826"/>
<rect x="240" y="80" width="150" height="220" fill="#121826"/>
<rect x="240" y="80" width="150" height="4" fill="#1C2436"/>
<g class="trc win-col">${windows.join('')}</g>
<g class="trc win-col face-happy">${face(FACE_HAPPY, 'face-happy')}</g>
<g class="trc win-col face-sad">${face(FACE_SAD, 'face-sad')}</g>

<rect x="0" y="300" width="${VB_W}" height="9" fill="#0B0F18"/>
<g fill="#0B0F18"><rect x="56" y="308" width="10" height="24"/><rect x="186" y="308" width="10" height="24"/><rect x="316" y="308" width="10" height="24"/></g>
<g class="a train">
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

<g class="street-ref">${puddle(104, 14)}${puddle(252, 9)}${puddle(300, 7)}${puddle(346, 10)}${puddle(30, 6)}</g>
<g class="rain-layer" fill="none" stroke="#B9C9DE" stroke-width="0.7">${drips}</g>
<g class="trc rain-layer" stroke="#C9D6E8" stroke-width="0.8" stroke-linecap="round">${streaks(60, 21, 13, 3, 0.8, 0.4)}</g>
<g class="trc rain-heavy" stroke="#D8E2F0" stroke-width="0.9" stroke-linecap="round">${streaks(46, 31, 18, 4, 0.6, 0.3)}</g>
</svg>`;
}

const SCENES = { forest: forestScene, beach: beachScene, city: cityScene };

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
  const build = SCENES[theme?.scene] || SCENES.forest;
  bgEl.innerHTML = build();
}

/**
 * The only thing spending is allowed to change. One attribute; CSS does the
 * rest, and the transition runs once in whichever direction it was given.
 */
export function setSceneOver(isOver) {
  const el = sceneEl();
  if (el) el.setAttribute('data-over', isOver ? 'true' : 'false');
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
