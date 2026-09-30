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

function forestScene(health = 0) {
  const { w, h } = sceneBox();
  const hp = clamp01(health);
  const wide = w > PHONE_W;

  // 14 stars across 390px was the original density: one per ~28px.
  const starCount = wide ? Math.round(w / 28) : 14;
  const stars = Array.from({ length: starCount }).map((_, i) => {
    const x = (i * 37 + 13) % Math.round(w);
    const y = h * 0.02 + ((i * 53) % Math.round(h * 0.27));
    const r = (1 + ((i * 7) % 3) * 0.4).toFixed(1);
    const o = ((0.35 + ((i * 13) % 50) / 100) * lerp(1, 0.32, hp)).toFixed(2);
    const dur = (2.8 + ((i * 11) % 30) / 10).toFixed(1);
    const delay = ((i * 7) % 30) / 10;
    return `<circle cx="${x}" cy="${y.toFixed(0)}" r="${r}" fill="#fff" opacity="${o}"><animate attributeName="opacity" values="${o};${(o * 0.28).toFixed(2)};${o}" dur="${dur}s" begin="${delay}s" repeatCount="indefinite"/></circle>`;
  }).join('');

  // Capped so trees stay their intended size on a wide screen rather than
  // scaling up into giants.
  const treeScale = Math.min(w, PHONE_W) / 390;
  const pine = (xf, baseYf, sc) =>
    `<g transform="translate(${(xf * w).toFixed(0)} ${(baseYf * h).toFixed(0)}) scale(${(sc * treeScale).toFixed(3)})"><path d="M0,-64 L18,-22 L9,-22 L26,10 L14,10 L30,40 L-30,40 L-14,10 L-26,10 L-9,-22 L-18,-22 Z" fill="#0E1524"/></g>`;

  // One tree per ~39px, matching the original 10-across-390 density.
  // (Array.from's map fn gets (element, index) only — no third array arg —
  // so the count has to be its own binding.)
  const treeCount = Math.round(w / 39);
  const treeSpecs = wide
    ? Array.from({ length: treeCount }, (_, i) => [
        (i + 0.5) / treeCount + (rnd(i, 1) - 0.5) * (0.6 / treeCount),
        0.699 + rnd(i, 2) * 0.018,
        0.5 + rnd(i, 3) * 0.42,
      ])
    : FOREST_TREES;
  const trees = treeSpecs.map((t) => pine(...t)).join('');

  const moonR = Math.min(w, h) * 0.062 * lerp(1, 0.62, hp);
  const moonX = w * 0.75;
  // Only a slight sink: any further and the moon disappears behind the
  // summary card, hiding the most expressive part of the effect.
  const moonY = lerp(0.155, 0.172, hp) * h;
  // Past ~80% spent the moon turns; below that it just dims.
  const blood = clamp01((hp - 0.55) / 0.45);
  const moonCore = mix('#FFFBEF', '#FFD9B0', blood);
  const moonMid = mix('#F6E6B8', '#E8834A', blood);
  const moonEdge = mix('#E9CE8E', '#B23A22', blood);
  const glowOpacity = (0.22 * lerp(1, 0.45, hp)).toFixed(3);
  const skyTop = mix('#0A0F24', '#05060F', hp);
  const skyMid = mix('#182B4A', '#0D1626', hp);
  const skyLow = mix('#274566', '#132436', hp);
  const hill1Y = h * 0.663, hill2Y = h * 0.71, lakeY = h * 0.735;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="${SCENE_STYLE(w, h)}"><defs><linearGradient id="fSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${skyTop}"/><stop offset="55%" stop-color="${skyMid}"/><stop offset="100%" stop-color="${skyLow}"/></linearGradient><radialGradient id="fMoon" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${moonCore}"/><stop offset="70%" stop-color="${moonMid}"/><stop offset="100%" stop-color="${moonEdge}"/></radialGradient><linearGradient id="fLake" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#22405F"/><stop offset="100%" stop-color="#0A1526"/></linearGradient><linearGradient id="fGlow" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${moonMid}" stop-opacity="${(0.55 * lerp(1, 0.4, hp)).toFixed(3)}"/><stop offset="100%" stop-color="${moonMid}" stop-opacity="0"/></linearGradient><filter id="fBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter></defs><rect width="${w}" height="${h}" fill="url(#fSky)"/>${stars}<circle cx="${moonX}" cy="${moonY}" r="${moonR * 2.1}" fill="${moonMid}" opacity="${glowOpacity}" filter="url(#fBlur)"/><circle cx="${moonX}" cy="${moonY}" r="${moonR}" fill="url(#fMoon)"/><path d="M0,${hill1Y} Q${w * 0.25},${hill1Y - 40} ${w * 0.5},${hill1Y - 28} T${w},${hill1Y - 46} V${h} H0 Z" fill="#20385A" opacity="0.85"/><path d="M0,${hill2Y} Q${w * 0.28},${hill2Y - 34} ${w * 0.5},${hill2Y - 22} T${w},${hill2Y - 42} V${h} H0 Z" fill="#16223A"/>${trees}<rect x="0" y="${lakeY}" width="${w}" height="${h - lakeY}" fill="url(#fLake)"/><rect x="${moonX - moonR * 0.95}" y="${lakeY}" width="${moonR * 1.9}" height="${h - lakeY}" fill="url(#fGlow)" filter="url(#fBlur)"/></svg>`;
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
