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

/** Deterministic 0–1 pseudo-random, so a rebuild never reshuffles the scene. */
const rnd = (i, s) => {
  const v = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

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
#bg .sun,#bg .sun-glow{cy:280px}
#bg .sun{opacity:1}
#bg .sea-top{stop-color:#E59A72}
#bg .sand-top{stop-color:#D9A184}
#bg .cloud-col{fill:#F4B49A}
#bg .reflect{fill:#FFD7A1;opacity:0.9}
#bg .beach-stars{opacity:0}
#bg .scene[data-over="true"] .s0{stop-color:#0B1230}
#bg .scene[data-over="true"] .s1{stop-color:#23295A}
#bg .scene[data-over="true"] .s2{stop-color:#4B3F72}
#bg .scene[data-over="true"] .s3{stop-color:#8C6A8E}
#bg .scene[data-over="true"] .sun-edge{stop-color:#C9637A}
#bg .scene[data-over="true"] .sun,#bg .scene[data-over="true"] .sun-glow{cy:324px}
#bg .scene[data-over="true"] .sun{opacity:0.6}
#bg .scene[data-over="true"] .sea-top{stop-color:#4E4A72}
#bg .scene[data-over="true"] .sand-top{stop-color:#6E5470}
#bg .scene[data-over="true"] .cloud-col{fill:#5D5884}
#bg .scene[data-over="true"] .reflect{fill:#B79BC4;opacity:0.4}
#bg .scene[data-over="true"] .beach-stars{opacity:1}

/* city */
#bg .win-col{fill:#F6C27A}
#bg .win-stop{stop-color:#F6C27A}
#bg .lamp-col{fill:#F7B65E}
#bg .lamp-stop{stop-color:#F7B65E}
#bg .horizon-stop{stop-color:#6A4E62}
#bg .rain-layer{opacity:0.2}
#bg .rain-heavy{opacity:0}
#bg .street-ref{opacity:0.5}
#bg .scene[data-over="true"] .win-col{fill:#A9C1DE}
#bg .scene[data-over="true"] .win-stop{stop-color:#A9C1DE}
#bg .scene[data-over="true"] .lamp-col{fill:#D3E2F4}
#bg .scene[data-over="true"] .lamp-stop{stop-color:#D3E2F4}
#bg .scene[data-over="true"] .horizon-stop{stop-color:#334A68}
#bg .scene[data-over="true"] .rain-layer{opacity:0.6}
#bg .scene[data-over="true"] .rain-heavy{opacity:0.6}
#bg .scene[data-over="true"] .street-ref{opacity:0.9}

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
#bg .deerwalk{transform-box:fill-box;transform-origin:50% 50%;animation:w-deer 24s ease-in-out infinite}
@keyframes w-deer{0%,6%{transform:translateX(0) scaleX(1)}20%{transform:translateX(24px) scaleX(1)}60%{transform:translateX(24px) scaleX(1)}62%{transform:translateX(24px) scaleX(-1)}78%{transform:translateX(0) scaleX(-1)}80%,100%{transform:translateX(0) scaleX(1)}}
#bg .deerhead{transform-box:fill-box;transform-origin:0% 100%;animation:w-graze 24s ease-in-out infinite}
@keyframes w-graze{0%,22%{transform:rotate(0)}28%,50%{transform:rotate(70deg)}34%{transform:rotate(64deg)}42%{transform:rotate(72deg)}56%,100%{transform:rotate(0)}}
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
#bg .bus{animation:w-bus 26s linear infinite}
@keyframes w-bus{0%,30%{transform:translateX(240px)}62%{transform:translateX(-380px)}100%{transform:translateX(-380px)}}
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

  // Both fish share one shape; the second is half a loop out of phase so they
  // never jump together.
  const fish = (tx, ty, delay) =>
    `<g transform="translate(${tx} ${ty})">` +
    `<ellipse class="a ripple" cx="0" cy="2" rx="9" ry="2.2" fill="none" stroke="#BFD2EA" stroke-width="0.9"${delay}/>` +
    `<path class="a fish" d="M0,0 C4,-3 9,-3 12,0 C9,3 4,3 0,0 Z M12,0 L16,-3 L16,3 Z" fill="#C9D9EE"${delay}/></g>`;

  return `<svg class="scene" data-over="false" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMin slice" xmlns="http://www.w3.org/2000/svg">
<defs>
<linearGradient id="fsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050918"/><stop offset="0.16" stop-color="#0C1532"/><stop offset="0.33" stop-color="#1A2A4C"/><stop offset="0.42" stop-color="#16243F"/><stop offset="1" stop-color="#070C16"/></linearGradient>
<radialGradient id="fglow"><stop offset="0" stop-color="#F6E7B8" stop-opacity="0.5"/><stop offset="1" stop-color="#F6E7B8" stop-opacity="0"/></radialGradient>
<linearGradient id="friv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2C4A6E"/><stop offset="1" stop-color="#132338"/></linearGradient>
<mask id="fmoon"><rect x="250" y="40" width="130" height="130" fill="#fff"/><circle class="trc moon-shade" cy="94" r="29" fill="#000"/></mask>
</defs>
<rect width="${VB_W}" height="${VB_H}" fill="url(#fsky)"/>
<g>${stars.join('')}</g>
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
<g class="trc fish-group">${fish(332, 350, '')}${fish(228, 386, ' style="animation-delay:-5.5s"')}</g>
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
  const stars = Array.from({ length: 22 }, (_, i) => {
    const x = Math.round(rnd(i, 1) * 380 + 5);
    const y = Math.round(rnd(i, 2) * 230 + 10);
    return `<circle class="a tw" cx="${x}" cy="${y}" r="${(0.6 + rnd(i, 7) * 0.9).toFixed(2)}" fill="#F3EEF8" style="animation-delay:${(-rnd(i, 8) * 5).toFixed(1)}s;animation-duration:${(3.5 + rnd(i, 9) * 4).toFixed(1)}s"/>`;
  }).join('');

  // Two wavelengths of path for one screen width, so translating by exactly
  // -390px lands on an identical crest and the loop is invisible.
  const wavePath = (y, a) => {
    let s = `M0,${y}`;
    for (let x = 0; x < 780; x += 30) s += ` Q${x + 15},${y - a} ${x + 30},${y}`;
    return s;
  };

  const reflect = Array.from({ length: 9 }, (_, i) => {
    const w = 46 - i * 4;
    return `<rect class="a shim" x="${(290 - w / 2 + (rnd(i, 11) - 0.5) * 6).toFixed(1)}" y="${334 + i * 4}" width="${w}" height="2" rx="1" style="animation-delay:${(-i * 0.4).toFixed(1)}s"/>`;
  }).join('');

  return `<svg class="scene" data-over="false" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMin slice" xmlns="http://www.w3.org/2000/svg">
<defs>
<linearGradient id="bsky" x1="0" y1="0" x2="0" y2="1"><stop class="trc s0" offset="0"/><stop class="trc s1" offset="0.18"/><stop class="trc s2" offset="0.32"/><stop class="trc s3" offset="0.39"/><stop offset="1" stop-color="#1A1426"/></linearGradient>
<radialGradient id="bsun"><stop offset="0" stop-color="#FFF4D6"/><stop offset="0.6" stop-color="#FFD39A"/><stop class="trc sun-edge" offset="1"/></radialGradient>
<radialGradient id="bglow"><stop class="trc sun-edge" offset="0" stop-opacity="0.55"/><stop offset="1" stop-color="#F29A5B" stop-opacity="0"/></radialGradient>
<linearGradient id="bsea" x1="0" y1="0" x2="0" y2="1"><stop class="trc sea-top" offset="0"/><stop offset="0.5" stop-color="#2E5A6E"/><stop offset="1" stop-color="#12283A"/></linearGradient>
<linearGradient id="bsand" x1="0" y1="0" x2="0" y2="1"><stop class="trc sand-top" offset="0"/><stop offset="1" stop-color="#4A2E3A"/></linearGradient>
<clipPath id="bclip"><rect x="0" y="0" width="${VB_W}" height="330"/></clipPath>
</defs>
<rect width="${VB_W}" height="${VB_H}" fill="url(#bsky)"/>
<g class="trc beach-stars">${stars}</g>
<g class="trc cloud-col" opacity="0.62">
<g class="a drift"><ellipse cx="120" cy="128" rx="84" ry="6"/><ellipse cx="150" cy="120" rx="46" ry="5"/></g>
<g class="a drift" style="animation-duration:120s;animation-delay:-40s"><ellipse cx="300" cy="196" rx="76" ry="5"/><ellipse cx="270" cy="189" rx="40" ry="4"/></g>
<g class="a drift" style="animation-duration:105s;animation-delay:-70s"><ellipse cx="96" cy="246" rx="70" ry="4"/></g>
</g>
<g clip-path="url(#bclip)">
<circle class="a glow trc sun-glow" cx="290" r="120" fill="url(#bglow)"/>
<circle class="trc sun" cx="290" r="30" fill="url(#bsun)"/>
</g>
<rect x="0" y="330" width="${VB_W}" height="514" fill="url(#bsea)"/>
<g class="trc reflect">${reflect}</g>
<g fill="none" stroke-linecap="round">
<path class="a wave" d="${wavePath(346, 2.5)}" stroke="#F7D2B4" stroke-width="1" opacity="0.32"/>
<path class="a wave" d="${wavePath(358, 2)}" stroke="#F7D2B4" stroke-width="0.8" opacity="0.22" style="animation-duration:44s"/>
</g>
<path d="M0,372 C130,364 250,380 390,370 L390,844 L0,844 Z" fill="url(#bsand)"/>
<path class="a lap" d="M0,371 C130,363 250,379 390,369" fill="none" stroke="#FFF1E2" stroke-width="1.6" opacity="0.55"/>
</svg>`;
}

/* ── Rainy city ────────────────────────────────────────────────── */

function cityScene() {
  // Lit windows, skipped at random so the blocks don't read as graph paper.
  // About one in twelve flickers, which is what makes the city feel occupied.
  const windows = [];
  const grid = (x0, y0, cols, rows, dx, dy, base, salt) => {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const k = r * cols + c + salt * 100;
        if (rnd(k, salt) < 0.4) continue;
        const flick = rnd(k, salt + 7) > 0.92 ? 'a flick' : '';
        windows.push(`<rect class="${flick}" x="${x0 + c * dx}" y="${y0 + r * dy}" width="7" height="4.5" rx="0.6" opacity="${(base * (0.6 + rnd(k, salt + 3) * 0.4)).toFixed(2)}" style="animation-delay:${(-rnd(k, salt + 5) * 12).toFixed(1)}s"/>`);
      }
    }
  };
  grid(250, 92, 8, 16, 17, 12.5, 0.95, 1);
  grid(112, 160, 5, 10, 17, 13, 0.6, 2);
  grid(4, 210, 5, 6, 18, 13, 0.45, 3);

  // Rain fades to nothing at both ends of its loop, so a drop never visibly
  // teleports back to the top of the screen.
  const streaks = (n, saltBase, len, drift, dur0, durSpan) =>
    Array.from({ length: n }, (_, i) => {
      const x = rnd(i, saltBase) * 400, y = rnd(i, saltBase + 1) * 820;
      return `<line class="a rain" x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x - drift).toFixed(1)}" y2="${(y + len).toFixed(1)}" style="animation-delay:${(-rnd(i, saltBase + 2)).toFixed(2)}s;animation-duration:${(dur0 + rnd(i, saltBase + 3) * durSpan).toFixed(2)}s"/>`;
    }).join('');

  const drips = [[60, 350], [150, 376], [232, 384], [318, 372], [368, 356], [96, 386]]
    .map((p, i) => `<ellipse class="a drip" cx="${p[0]}" cy="${p[1]}" rx="7" ry="1.8" style="animation-delay:${(-i * 0.45).toFixed(2)}s"/>`)
    .join('');

  const puddle = (x, w) => `<rect x="${x}" y="334" width="${w}" height="58" fill="url(#cref)"/>`;

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
<rect x="0" y="300" width="${VB_W}" height="9" fill="#0B0F18"/>
<g fill="#0B0F18"><rect x="56" y="308" width="10" height="24"/><rect x="186" y="308" width="10" height="24"/><rect x="316" y="308" width="10" height="24"/></g>
<g class="a train">
<rect x="20" y="280" width="252" height="19" rx="7" fill="#090D15"/>
<rect class="trc win-col" x="30" y="285" width="232" height="5.5" rx="2" opacity="0.85"/>
<rect x="88" y="284" width="3" height="8" fill="#090D15"/><rect x="150" y="284" width="3" height="8" fill="#090D15"/><rect x="212" y="284" width="3" height="8" fill="#090D15"/>
</g>
<rect x="0" y="330" width="${VB_W}" height="514" fill="#111622"/>
<line x1="0" y1="331" x2="${VB_W}" y2="331" stroke="#2A3348" stroke-width="1.4"/>
<rect x="108" y="304" width="3" height="28" fill="#0B0F18"/>
<circle cx="110" cy="304" r="40" fill="url(#clampg)"/>
<circle class="trc lamp-col" cx="110" cy="304" r="3.2"/>
<g class="a bus">
<rect x="210" y="340" width="122" height="24" rx="5" fill="#070A11"/>
<rect class="trc win-col" x="218" y="345" width="100" height="7" rx="2" opacity="0.7"/>
<circle cx="232" cy="365" r="5" fill="#05070C"/><circle cx="310" cy="365" r="5" fill="#05070C"/>
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
