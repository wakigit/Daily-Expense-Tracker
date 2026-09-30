/**
 * Wallpaper painting. These build SVG as strings and are injected into the
 * #bg element that sits behind the app at z-index -1.
 *
 * Kept as string generators rather than JSX on purpose: they are pure geometry
 * with no user input, they were already working, and rewriting 60 hand-tuned
 * path coordinates into JSX would risk the artwork for zero benefit.
 */

/* ── Pattern tiles ─────────────────────────────────────────────── */

function bow(cx, cy, hw, hh, item, rot) {
  const [fill, knot] = item;
  const g0 = rot ? `<g transform="rotate(${rot} ${cx} ${cy})">` : '<g>';
  const lw = `M${cx},${cy} Q${cx - hw * 0.38},${cy - hh} ${cx - hw},${cy} Q${cx - hw * 0.38},${cy + hh} ${cx},${cy}Z`;
  const rw = `M${cx},${cy} Q${cx + hw * 0.38},${cy - hh} ${cx + hw},${cy} Q${cx + hw * 0.38},${cy + hh} ${cx},${cy}Z`;
  const kr = Math.max(4, hh * 0.34);
  const dx = cx - hw * 0.55, dxr = cx + hw * 0.55, dy0 = cy - hh * 0.22, dy1 = cy + hh * 0.22;
  return `${g0}<path d="${lw}" fill="${fill}" opacity="0.9"/><path d="${rw}" fill="${fill}" opacity="0.9"/><circle cx="${dx}" cy="${dy0}" r="1.8" fill="white" opacity="0.62"/><circle cx="${dx}" cy="${dy1}" r="1.8" fill="white" opacity="0.62"/><circle cx="${dxr}" cy="${dy0}" r="1.8" fill="white" opacity="0.62"/><circle cx="${dxr}" cy="${dy1}" r="1.8" fill="white" opacity="0.62"/><circle cx="${cx}" cy="${cy}" r="${kr}" fill="${knot}"/></g>`;
}

function mahjongTile(cx, cy, hw, hh, type, rot) {
  const w = hw * 1.9, h = w * 1.32, x = cx - w / 2, y = cy - h / 2;
  const g0 = rot ? `<g transform="rotate(${rot} ${cx} ${cy})">` : '<g>';
  const body = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w * 0.14}" fill="#F6EBD9" stroke="#D8C39A" stroke-width="1.4"/><rect x="${x + w * 0.09}" y="${y + h * 0.09}" width="${w * 0.82}" height="${h * 0.82}" rx="${w * 0.1}" fill="none" stroke="#EAD9B8" stroke-width="1"/>`;
  let glyph;
  if (type === 'zhong') glyph = `<text x="${cx}" y="${cy + h * 0.17}" font-family="'PingFang SC','Microsoft YaHei','Heiti SC',sans-serif" font-size="${h * 0.6}" font-weight="700" fill="#B3222E" text-anchor="middle">中</text>`;
  else if (type === 'facai') glyph = `<text x="${cx}" y="${cy + h * 0.17}" font-family="'PingFang SC','Microsoft YaHei','Heiti SC',sans-serif" font-size="${h * 0.6}" font-weight="700" fill="#2E7D4F" text-anchor="middle">發</text>`;
  else glyph = `<rect x="${cx - w * 0.24}" y="${cy - h * 0.24}" width="${w * 0.48}" height="${h * 0.48}" fill="none" stroke="#2B4C7E" stroke-width="${w * 0.045}"/>`;
  return `${g0}${body}${glyph}</g>`;
}

const ICON_LAYOUT = [[58, 52, 23, 15, 0], [188, 30, 18, 11, 15], [316, 68, 23, 15, -10], [82, 155, 21, 13, 5], [230, 130, 26, 16, 0], [350, 195, 20, 13, -15], [132, 238, 22, 14, 10], [275, 250, 20, 12, 0], [162, 108, 17, 11, -20], [360, 138, 21, 13, 6], [14, 198, 18, 11, 12], [205, 200, 20, 12, -8], [22, 88, 16, 10, -5], [378, 30, 17, 11, 8]];
const MAHJONG_LAYOUT = [[45, 60, 16, 0, -4], [150, 40, 18, 0, 5], [260, 55, 15, 0, -6], [350, 80, 17, 0, 4], [90, 150, 19, 0, -3], [210, 140, 16, 0, 6], [330, 175, 15, 0, -5], [55, 230, 17, 0, 3], [170, 225, 18, 0, -4], [290, 245, 16, 0, 5]];

/* ── Full scenes ───────────────────────────────────────────────── */

/* ── Budget-reactive colour ────────────────────────────────────────
 *
 * `health` runs 0 (budget untouched) → 1 (budget spent or blown). The scenes
 * read it to darken: the forest moon wanes toward a blood moon, the beach sun
 * sinks and reddens. It's ambient feedback — you register how the month is
 * going before you read a single number.
 */

const clamp01 = (n) => Math.max(0, Math.min(1, Number(n) || 0));

const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

const toHex = (n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');

/** Blend two hex colours. t=0 returns `a`, t=1 returns `b`. */
const mix = (a, b, t) => {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const k = clamp01(t);
  return `#${toHex(r1 + (r2 - r1) * k)}${toHex(g1 + (g2 - g1) * k)}${toHex(b1 + (b2 - b1) * k)}`;
};

/** Linear interpolation for plain numbers. */
const lerp = (a, b, t) => a + (b - a) * clamp01(t);

/**
 * Scene sizing.
 *
 * These used to be capped at 430px wide and centred, which is why a laptop
 * showed a narrow strip of artwork with empty gutters either side. The scenes
 * now span the full viewport.
 *
 * clientWidth (not innerWidth) excludes any vertical scrollbar, so the SVG
 * can't overflow and create a horizontal scrollbar of its own.
 *
 * PHONE_W is the width the artwork was originally composed at. Up to that
 * size the hand-tuned layouts are used verbatim so phones look exactly as
 * before; beyond it, element counts scale with width to hold the same visual
 * density instead of stretching a phone-sized composition across a desktop.
 */
const PHONE_W = 440;

const sceneBox = () => ({
  w: document.documentElement?.clientWidth || window.innerWidth,
  h: window.innerHeight,
});

const SCENE_STYLE = (w, h) =>
  `position:fixed;top:0;left:0;width:${w}px;height:${h}px;z-index:-1;pointer-events:none`;

/** Deterministic 0–1 pseudo-random, so a repaint never reshuffles the scene. */
const rnd = (i, salt) => {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return ((v % 1) + 1) % 1;
};

/* Original hand-tuned tree layout: [xFraction, baseYFraction, scale]. */
const FOREST_TREES = [
  [0.05, 0.71, 0.55], [0.13, 0.706, 0.7], [0.23, 0.716, 0.5], [0.33, 0.702, 0.85],
  [0.43, 0.71, 0.6], [0.54, 0.704, 0.75], [0.65, 0.714, 0.55], [0.75, 0.699, 0.9],
  [0.85, 0.709, 0.62], [0.94, 0.716, 0.5],
];


/**
 * Motion is opt-out. Everything animated below is omitted entirely — not just
 * paused — when the OS asks for reduced motion, so no timers run at all.
 */
const stillMode = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/**
 * A deer silhouette, side on. Drawn in a ~36x50 unit box with the origin at
 * the shoulder, hooves at y=30.
 *
 * Order matters: legs first so the body covers where they meet it, then the
 * barrel, then neck and head on top.
 */
function deer(colour, still) {
  // The rotate animation must sit on its OWN group. animateTransform replaces
  // the transform attribute it animates, so putting it beside the translate
  // discards that translate and collapses every leg onto the origin.
  const leg = (x, delay, from, to) =>
    `<g transform="translate(${x} 14)"><g>` +
    (still ? '' : `<animateTransform attributeName="transform" type="rotate" values="${from};${to};${from}" dur="0.48s" begin="${delay}s" repeatCount="indefinite"/>`) +
    `<path d="M-1.3,0 L1.3,0 L1.7,15 L-0.9,15 Z"/></g></g>`;

  return `<g fill="${colour}">
    ${leg(12, 0.24, '-16 0 0', '16 0 0')}
    ${leg(25, 0.24, '14 0 0', '-14 0 0')}
    ${leg(10, 0, '17 0 0', '-17 0 0')}
    ${leg(27, 0, '-15 0 0', '15 0 0')}
    <ellipse cx="19" cy="11.5" rx="11" ry="6"/>
    <ellipse cx="27" cy="11" rx="5" ry="5.6"/>
    <path d="M9.5,7.5 Q5.5,5 6,9.5 Q7.5,11 10,9.8 Z"/>
    <path d="M25.5,9 Q29.5,2 32.5,-4.2 L35.6,-2.6 Q32.5,2.2 29.5,10.5 Z"/>
    <ellipse cx="37" cy="-6.2" rx="4.3" ry="2.7" transform="rotate(-20 37 -6.2)"/>
    <path d="M40.6,-7.8 Q42.4,-7.4 41.9,-6.2 Q40.8,-5.8 40,-6.6 Z"/>
    <path d="M34.6,-8.4 Q33.2,-11 34.8,-11.6 Q36,-10.6 35.6,-8.6 Z"/>
    <path d="M35.4,-9.6 L34.2,-17.4 L35.5,-17.6 L36.6,-10.4 Z"/>
    <path d="M34.7,-14 L31.4,-16.6 L32.2,-17.7 L35.3,-15.3 Z"/>
    <path d="M38.3,-9.2 L39.2,-17.2 L40.5,-17 L39.6,-9.8 Z"/>
    <path d="M38.9,-14.2 L42,-17 L42.9,-16 L39.6,-13.4 Z"/>
  </g>`;
}

/** One falling, swaying leaf. Two nested groups so drift and spin don't clash. */
function leaf(x, y, size, colour, delay, dur, still) {
  const drift = still
    ? ''
    : `<animateTransform attributeName="transform" type="translate" values="0,0; ${(size * 2.4).toFixed(1)},${(size * 9).toFixed(1)}; ${(-size * 1.6).toFixed(1)},${(size * 18).toFixed(1)}" dur="${dur}s" begin="${delay}s" repeatCount="indefinite"/>`;
  const spin = still
    ? ''
    : `<animateTransform attributeName="transform" type="rotate" values="0;170;360" dur="${(dur * 0.55).toFixed(1)}s" begin="${delay}s" repeatCount="indefinite"/>`;
  const fade = still
    ? ''
    : `<animate attributeName="opacity" values="0;0.85;0" dur="${dur}s" begin="${delay}s" repeatCount="indefinite"/>`;

  // The base position lives on the outer group; the animation drives an inner
  // group that starts at 0,0. animateTransform REPLACES the transform it
  // animates, so a drift starting at "0,0" on the positioned group would
  // teleport the leaf to the top-left corner of the screen.
  return `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)})"><g>${drift}<g opacity="0.8">${fade}<path d="M0,0 q${size},${-size * 0.8} ${size * 2},0 q${-size},${size * 0.8} ${-size * 2},0Z" fill="${colour}">${spin}</path></g></g></g>`;
}

function forestScene(health = 0) {
  const { w, h } = sceneBox();
  const hp = clamp01(health);
  const wide = w > PHONE_W;
  const still = stillMode();

  // How alive the scene is. Leaves and the deer thin out well before the
  // budget is fully gone, so the change is visible while it still matters.
  const lush = clamp01(1 - hp / 0.85);
  const deerAlpha = clamp01((0.7 - hp) / 0.25);
  const flowing = hp < 0.8;

  const starCount = wide ? Math.round(w / 28) : 14;
  const stars = Array.from({ length: starCount }).map((_, i) => {
    const x = (i * 37 + 13) % Math.round(w);
    const y = h * 0.02 + ((i * 53) % Math.round(h * 0.27));
    const r = (1 + ((i * 7) % 3) * 0.4).toFixed(1);
    const o = ((0.35 + ((i * 13) % 50) / 100) * lerp(1, 0.32, hp)).toFixed(2);
    const dur = (2.8 + ((i * 11) % 30) / 10).toFixed(1);
    const delay = ((i * 7) % 30) / 10;
    const tw = still ? '' : `<animate attributeName="opacity" values="${o};${(o * 0.28).toFixed(2)};${o}" dur="${dur}s" begin="${delay}s" repeatCount="indefinite"/>`;
    return `<circle cx="${x}" cy="${y.toFixed(0)}" r="${r}" fill="#fff" opacity="${o}">${tw}</circle>`;
  }).join('');

  const treeScale = Math.min(w, PHONE_W) / 390;
  const treeCount = Math.round(w / 39);
  const treeSpecs = wide
    ? Array.from({ length: treeCount }, (_, i) => [
        (i + 0.5) / treeCount + (rnd(i, 1) - 0.5) * (0.6 / treeCount),
        0.699 + rnd(i, 2) * 0.018,
        0.5 + rnd(i, 3) * 0.42,
      ])
    : FOREST_TREES;

  // Bare trunk and branches sit underneath; the canopy fades away on top of
  // it, so an overspent month leaves a visibly dead winter forest.
  const tree = (xf, baseYf, sc, i) => {
    const sway = still || lush < 0.15
      ? ''
      : `<animateTransform attributeName="transform" type="rotate" values="-1.4 0 40;1.4 0 40;-1.4 0 40" dur="${(4 + (i % 5) * 0.7).toFixed(1)}s" repeatCount="indefinite"/>`;
    return `<g transform="translate(${(xf * w).toFixed(0)} ${(baseYf * h).toFixed(0)}) scale(${(sc * treeScale).toFixed(3)})">` +
      `<path d="M-3,40 L-2,-10 L2,-10 L3,40 Z" fill="#090E18"/>` +
      `<path d="M0,2 L-14,-14 M0,8 L13,-8 M0,-6 L-11,-22" stroke="#090E18" stroke-width="2.4" fill="none" opacity="${(1 - lush).toFixed(2)}"/>` +
      `<g opacity="${lush.toFixed(3)}"><path d="M0,-64 L18,-22 L9,-22 L26,10 L14,10 L30,40 L-30,40 L-14,10 L-26,10 L-9,-22 L-18,-22 Z" fill="#0E1524"/>${sway}</g>` +
      `</g>`;
  };
  const trees = treeSpecs.map((t, i) => tree(...t, i)).join('');

  // Leaves come loose from the canopy and spiral down.
  const leafCount = Math.round(lush * (wide ? 16 : 9));
  const leaves = Array.from({ length: leafCount }, (_, i) =>
    leaf(
      rnd(i, 11) * w,
      h * (0.56 + rnd(i, 12) * 0.12),
      3.4 + rnd(i, 13) * 2.6,
      ['#4C7A4E', '#6B8F45', '#8A9350'][i % 3],
      Number((rnd(i, 14) * 9).toFixed(1)),
      Number((7 + rnd(i, 15) * 6).toFixed(1)),
      still
    )
  ).join('');

  const moonR = Math.min(w, h) * 0.062 * lerp(1, 0.62, hp);
  const moonX = w * 0.75;
  // Only a slight sink: any further and the moon disappears behind the
  // summary card, hiding the most expressive part of the effect.
  const moonY = lerp(0.155, 0.172, hp) * h;
  const blood = clamp01((hp - 0.55) / 0.45);
  const moonCore = mix('#FFFBEF', '#FFD9B0', blood);
  const moonMid = mix('#F6E6B8', '#E8834A', blood);
  const moonEdge = mix('#E9CE8E', '#B23A22', blood);
  const glowOpacity = (0.22 * lerp(1, 0.45, hp)).toFixed(3);
  const skyTop = mix('#0A0F24', '#05060F', hp);
  const skyMid = mix('#182B4A', '#0D1626', hp);
  const skyLow = mix('#274566', '#132436', hp);

  // The moon wanes to a crescent: a shadow disc slides across it. At full
  // health the shadow sits clear of the moon entirely.
  const shadowDx = moonR * lerp(2.3, 1.02, hp);

  const hill1Y = h * 0.663, hill2Y = h * 0.71, lakeY = h * 0.735;

  // River ripples: a periodic wave translated by exactly one wavelength, so
  // the loop is seamless. When the budget is gone the water stops moving.
  const WAVE = 64;
  const ripple = (yOff, opacity, dur) => {
    const y = lakeY + yOff;
    let d = `M-${WAVE},${y.toFixed(1)}`;
    for (let x = -WAVE; x < w + WAVE * 2; x += WAVE) {
      d += ` q${WAVE / 4},-6 ${WAVE / 2},0 q${WAVE / 4},6 ${WAVE / 2},0`;
    }
    const flow = still || !flowing
      ? ''
      : `<animateTransform attributeName="transform" type="translate" values="0,0;${WAVE},0" dur="${dur}s" repeatCount="indefinite"/>`;
    const op = (opacity * (flowing ? 1 : 0.45)).toFixed(3);
    return `<path d="${d}" fill="none" stroke="${moonMid}" stroke-width="1.4" opacity="${op}" stroke-linecap="round">${flow}</path>`;
  };
  const river = [
    ripple((h - lakeY) * 0.18, 0.3, 7),
    ripple((h - lakeY) * 0.42, 0.22, 9.5),
    ripple((h - lakeY) * 0.68, 0.16, 12),
  ].join('');

  // The deer trots across the hill in FRONT of the treeline — drawn after the
  // trees, or they paint straight over it.
  //
  // The animateTransform has to be a direct child of the element whose
  // transform it drives, and it replaces that transform wholesale while
  // running — so the scale lives on a nested group, not alongside it.
  // Silhouetted on the ridge against the sky, not down among the trees —
  // a dark deer on a dark treeline is invisible, which is exactly how the
  // first attempt looked. Hooves sit at y=30 in the deer's own units, so the
  // origin is backed off the ridge line by that much.
  const deerSc = 1.05 * treeScale;
  const deerY = h * 0.658 - 30 * deerSc;
  const deerScale = deerSc.toFixed(3);
  const deerInner = `<g transform="scale(${deerScale})">${deer('#070C14', still)}</g>`;
  const deerGroup = deerAlpha > 0.02
    ? `<g opacity="${deerAlpha.toFixed(3)}">` +
      (still
        ? `<g transform="translate(${(w * 0.16).toFixed(0)} ${deerY.toFixed(0)})">${deerInner}</g>`
        : `<g transform="translate(-60 ${deerY.toFixed(0)})"><animateTransform attributeName="transform" type="translate" values="-60,${deerY.toFixed(0)}; ${(w + 60).toFixed(0)},${deerY.toFixed(0)}" dur="16s" repeatCount="indefinite"/>${deerInner}</g>`) +
      `</g>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="${SCENE_STYLE(w, h)}"><defs><linearGradient id="fSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${skyTop}"/><stop offset="55%" stop-color="${skyMid}"/><stop offset="100%" stop-color="${skyLow}"/></linearGradient><radialGradient id="fMoon" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${moonCore}"/><stop offset="70%" stop-color="${moonMid}"/><stop offset="100%" stop-color="${moonEdge}"/></radialGradient><mask id="fPhase"><rect width="${w}" height="${h}" fill="black"/><circle cx="${moonX}" cy="${moonY}" r="${moonR}" fill="white"/><circle cx="${(moonX + shadowDx).toFixed(1)}" cy="${(moonY - moonR * 0.18).toFixed(1)}" r="${(moonR * 1.04).toFixed(1)}" fill="black"/></mask><linearGradient id="fLake" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#22405F"/><stop offset="100%" stop-color="#0A1526"/></linearGradient><linearGradient id="fGlow" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${moonMid}" stop-opacity="${(0.55 * lerp(1, 0.4, hp)).toFixed(3)}"/><stop offset="100%" stop-color="${moonMid}" stop-opacity="0"/></linearGradient><filter id="fBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter></defs><rect width="${w}" height="${h}" fill="url(#fSky)"/>${stars}<circle cx="${moonX}" cy="${moonY}" r="${moonR * 2.1}" fill="${moonMid}" opacity="${glowOpacity}" filter="url(#fBlur)"/><circle cx="${moonX}" cy="${moonY}" r="${moonR}" fill="url(#fMoon)" mask="url(#fPhase)"/><path d="M0,${hill1Y} Q${w * 0.25},${hill1Y - 40} ${w * 0.5},${hill1Y - 28} T${w},${hill1Y - 46} V${h} H0 Z" fill="#20385A" opacity="0.85"/><path d="M0,${hill2Y} Q${w * 0.28},${hill2Y - 34} ${w * 0.5},${hill2Y - 22} T${w},${hill2Y - 42} V${h} H0 Z" fill="#16223A"/>${trees}${deerGroup}${leaves}<rect x="0" y="${lakeY}" width="${w}" height="${h - lakeY}" fill="url(#fLake)"/><rect x="${moonX - moonR * 0.95}" y="${lakeY}" width="${moonR * 1.9}" height="${h - lakeY}" fill="url(#fGlow)" filter="url(#fBlur)"/>${river}</svg>`;
}


/* Original hand-tuned clouds: [xF, yF, rxF, ryF, opacity]. */
const BEACH_CLOUDS = [
  [0.28, 0.178, 0.18, 0.028, 0.28],
  [0.77, 0.249, 0.14, 0.021, 0.22],
];

function beachScene(health = 0) {
  const { w, h } = sceneBox();
  const hp = clamp01(health);
  const wide = w > PHONE_W;
  const horizonY = h * 0.557;

  const cloudCount = Math.max(2, Math.round(w / 320));
  const cloudSpecs = wide
    ? Array.from({ length: cloudCount }, (_, i) => [
        (i + 0.5) / cloudCount + (rnd(i, 5) - 0.5) * (0.5 / cloudCount),
        0.13 + rnd(i, 6) * 0.14,
        0.10 + rnd(i, 7) * 0.08,
        0.018 + rnd(i, 8) * 0.012,
        0.18 + rnd(i, 9) * 0.12,
      ])
    : BEACH_CLOUDS;
  const clouds = cloudSpecs.map(([xf, yf, rxf, ryf, op]) =>
    `<ellipse cx="${(w * xf).toFixed(0)}" cy="${(h * yf).toFixed(0)}" rx="${(w * rxf).toFixed(0)}" ry="${(h * ryf).toFixed(0)}" fill="#E9BFD2" opacity="${op.toFixed(2)}" filter="url(#bBlur)"/>`
  ).join('');

  const sunR = Math.min(w, h) * 0.159 * lerp(1, 0.84, hp);
  // The sun slides below the horizon line as the budget goes.
  const sunY = horizonY + sunR * lerp(0, 0.72, hp);
  const sunCore = mix('#FFF7DE', '#FFD9B4', hp);
  const sunMid = mix('#FDCB7C', '#EE7A45', hp);
  const sunEdge = mix('#F79B5C', '#B8402B', hp);
  const skyA = mix('#3B2A5C', '#1B1430', hp);
  const skyB = mix('#B4506B', '#6E2B45', hp);
  const skyC = mix('#F0925A', '#B8532F', hp);
  const skyD = mix('#FBCB82', '#D98A4E', hp);

  const wave = (yf, c, o) =>
    `<path d="M0,${h * yf} Q${w * 0.167},${h * yf - 14} ${w * 0.333},${h * yf} T${w * 0.667},${h * yf} T${w},${h * yf - 6} V${h} H0 Z" fill="${c}" opacity="${o}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="${SCENE_STYLE(w, h)}"><defs><linearGradient id="bSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${skyA}"/><stop offset="45%" stop-color="${skyB}"/><stop offset="75%" stop-color="${skyC}"/><stop offset="100%" stop-color="${skyD}"/></linearGradient><radialGradient id="bSun" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${sunCore}"/><stop offset="60%" stop-color="${sunMid}"/><stop offset="100%" stop-color="${sunEdge}"/></radialGradient><linearGradient id="bSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#F0925A"/><stop offset="18%" stop-color="#C97A6E"/><stop offset="55%" stop-color="#2F6E79"/><stop offset="100%" stop-color="#123240"/></linearGradient><linearGradient id="bGlow" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${sunMid}" stop-opacity="${(0.6 * lerp(1, 0.42, hp)).toFixed(3)}"/><stop offset="100%" stop-color="${sunMid}" stop-opacity="0"/></linearGradient><filter id="bBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16"/></filter></defs><rect width="${w}" height="${h}" fill="url(#bSky)"/>${clouds}<circle cx="${w * 0.5}" cy="${sunY}" r="${Math.min(w, h) * 0.28}" fill="${sunMid}" opacity="${(0.28 * lerp(1, 0.6, hp)).toFixed(3)}" filter="url(#bBlur)"><animate attributeName="opacity" values="0.28;0.4;0.28" dur="7s" repeatCount="indefinite"/></circle><circle cx="${w * 0.5}" cy="${sunY}" r="${sunR}" fill="url(#bSun)"/><rect y="${horizonY}" width="${w}" height="${h - horizonY}" fill="url(#bSea)"/><rect x="${w * 0.5 - sunR * 1.05}" y="${horizonY}" width="${sunR * 2.1}" height="${h - horizonY}" fill="url(#bGlow)" filter="url(#bBlur)"/>${wave(0.9, '#1C4C58', 0.85)}${wave(0.947, '#153B45', 0.9)}</svg>`;
}

/* ── Entry point ───────────────────────────────────────────────── */

export function paintBackground(theme, health = 0) {
  const bgEl = document.getElementById('bg');
  if (!bgEl) return;

  const hp = clamp01(health);

  if (theme.bgKind === 'scene') {
    bgEl.innerHTML = theme.scene === 'forest' ? forestScene(hp) : beachScene(hp);
    return;
  }

  const isMahjong = theme.iconType === 'mahjong';
  const drawIcon = isMahjong ? mahjongTile : bow;
  const layout = isMahjong ? MAHJONG_LAYOUT : ICON_LAYOUT;
  const icons = layout
    .map((pos, i) => drawIcon(pos[0], pos[1], pos[2], pos[3], theme.items[i % theme.items.length], pos[4]))
    .join('');

  // Keep this subtle: a tiled pattern can't tell a story, so it only recedes.
  const iconOpacity = lerp(1, 0.55, hp).toFixed(3);

  bgEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none"><defs><pattern id="pk" x="10" y="10" width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="15" cy="15" r="2.8" fill="${theme.dot}"/></pattern><pattern id="mp" x="0" y="0" width="390" height="285" patternUnits="userSpaceOnUse"><rect width="390" height="285" fill="${theme.vars['--bg']}"/><rect width="390" height="285" fill="url(#pk)"/><g opacity="${iconOpacity}">${icons}</g></pattern></defs><rect width="100%" height="100%" fill="url(#mp)"/></svg>`;
}
