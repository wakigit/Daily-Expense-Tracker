/** Category swatch palette offered when creating a custom category. */
export const PALETTE = [
  '#D85A30', '#1D9E75', '#378ADD', '#7F77DD', '#BA7517', '#888780', '#D4537E',
  '#639922', '#E24B4A', '#5DCAA5', '#EF9F27', '#534AB7', '#E8709A', '#60B0E0',
];

export const DEF_CATS = [
  { id: 'food',  label: 'Food',             color: '#D85A30' },
  { id: 'hire',  label: 'Private hire',     color: '#1D9E75' },
  { id: 'pub',   label: 'Public transport', color: '#378ADD' },
  { id: 'shop',  label: 'Shopping',         color: '#7F77DD' },
  { id: 'needs', label: 'Needs',            color: '#BA7517' },
  { id: 'misc',  label: 'Miscellaneous',    color: '#888780' },
];

/**
 * Three scene themes, each a complete set of CSS custom properties applied to
 * document.documentElement. Nothing in the app hardcodes a colour — every
 * component reads var(--foo) — which is what makes a theme swap cost nothing.
 *
 * Token values are §7 of the redesign spec verbatim. Contrast was checked
 * against the card composited over the brightest scene colour that can sit
 * behind it, and every text token passes 4.5:1. If you change one, recheck it.
 *
 * `--accent-rgb` and `--st-over-rgb` are not in §7. They are the same colours
 * as --accent and --st-over, as bare triplets, because focus rings and error
 * glows need rgba() with a varying alpha and CSS cannot take a hex apart.
 *
 * `title` is the empty-state heading from §9; it belongs to the theme because
 * it names the scene the reader is looking at.
 */
export const THEMES = [
  {
    id: 'forest',
    name: 'Moonlit Forest',
    title: 'A quiet clearing',
    bgKind: 'scene',
    scene: 'forest',
    preview: ['#0A111F', '#E2B866'],
    vars: {
      '--ground': '#0A111F',
      '--card': 'rgba(13,21,37,0.8)',
      '--card-line': 'rgba(176,196,226,0.16)',
      '--tx': '#F2EEE3', '--tx-sub': '#BAC4D2', '--tx-muted': '#93A1B4',
      '--on-scene': '#F8F3E6', '--on-scene-sub': '#D5DCE6',
      '--accent': '#E2B866', '--accent-rgb': '226,184,102', '--on-accent': '#1A1405',
      '--st-calm': '#8FD9B0', '--st-watch': '#E8B04F', '--st-over': '#F07F6E',
      '--st-over-rgb': '240,127,110',
      '--hb-calm': '#8FD9B0', '--hb-watch': '#E8B04F', '--hb-over': '#F07F6E',
      '--track': 'rgba(255,255,255,0.13)', '--track-scene': 'rgba(255,255,255,0.24)',
      '--nav-bg': 'rgba(9,14,26,0.95)', '--nav-line': 'rgba(176,196,226,0.14)',
      '--chip': 'rgba(255,255,255,0.07)',
      '--field': 'rgba(255,255,255,0.06)', '--field-line': 'rgba(176,196,226,0.24)',
      '--scrim-home': 'linear-gradient(90deg,rgba(5,9,20,0.66) 0%,rgba(5,9,20,0.5) 55%,rgba(5,9,20,0.06) 80%,rgba(5,9,20,0) 100%)',
      '--scrim-page': 'rgba(6,10,20,0.66)',
    },
  },
  {
    id: 'beach',
    name: 'Sunset Beach',
    title: 'Calm water',
    bgKind: 'scene',
    scene: 'beach',
    preview: ['#E07A5F', '#B04419'],
    vars: {
      '--ground': '#2A1A2E',
      '--card': 'rgba(255,248,242,0.8)',
      '--card-line': 'rgba(201,140,120,0.34)',
      '--tx': '#3A1F2B', '--tx-sub': '#6E4655', '--tx-muted': '#7E5866',
      '--on-scene': '#FFF7EE', '--on-scene-sub': '#FBE6D8',
      '--accent': '#B04419', '--accent-rgb': '176,68,25', '--on-accent': '#FFFFFF',
      '--st-calm': '#276B4C', '--st-watch': '#8A560B', '--st-over': '#A3322A',
      '--st-over-rgb': '163,50,42',
      '--hb-calm': '#BDF0D2', '--hb-watch': '#FFD58A', '--hb-over': '#FFB4A4',
      '--track': 'rgba(58,31,43,0.12)', '--track-scene': 'rgba(255,255,255,0.3)',
      '--nav-bg': 'rgba(255,246,239,0.97)', '--nav-line': 'rgba(201,140,120,0.3)',
      '--chip': 'rgba(58,31,43,0.06)',
      '--field': 'rgba(255,255,255,0.9)', '--field-line': 'rgba(201,140,120,0.5)',
      '--scrim-home': 'linear-gradient(90deg,rgba(38,14,34,0.6) 0%,rgba(38,14,34,0.42) 55%,rgba(38,14,34,0.06) 80%,rgba(38,14,34,0) 100%)',
      '--scrim-page': 'rgba(40,18,34,0.58)',
    },
  },
  {
    id: 'city',
    name: 'Rainy City',
    title: 'Quiet streets',
    bgKind: 'scene',
    scene: 'city',
    preview: ['#0D1119', '#F2A65A'],
    vars: {
      '--ground': '#0D1119',
      '--card': 'rgba(17,22,33,0.8)',
      '--card-line': 'rgba(160,180,210,0.16)',
      '--tx': '#EEF1F5', '--tx-sub': '#B5BFCC', '--tx-muted': '#919DAD',
      '--on-scene': '#F4F6FA', '--on-scene-sub': '#D2D9E3',
      '--accent': '#F2A65A', '--accent-rgb': '242,166,90', '--on-accent': '#1B1208',
      '--st-calm': '#7FD8B4', '--st-watch': '#E7B85A', '--st-over': '#EE8C7A',
      '--st-over-rgb': '238,140,122',
      '--hb-calm': '#7FD8B4', '--hb-watch': '#E7B85A', '--hb-over': '#EE8C7A',
      '--track': 'rgba(255,255,255,0.12)', '--track-scene': 'rgba(255,255,255,0.24)',
      '--nav-bg': 'rgba(11,14,21,0.95)', '--nav-line': 'rgba(160,180,210,0.14)',
      '--chip': 'rgba(255,255,255,0.07)',
      '--field': 'rgba(255,255,255,0.06)', '--field-line': 'rgba(160,180,210,0.24)',
      '--scrim-home': 'linear-gradient(90deg,rgba(7,10,17,0.7) 0%,rgba(7,10,17,0.5) 55%,rgba(7,10,17,0.2) 80%,rgba(7,10,17,0.14) 100%)',
      '--scrim-page': 'rgba(7,10,17,0.66)',
    },
  },
];

export const DEFAULT_THEME = 'forest';

/**
 * Falls back to the forest rather than throwing. A saved id can outlive the
 * theme it names — Pink Bow, Midnight and Mahjong Fortune were all removed in
 * the redesign, and anyone who had one selected has it in localStorage.
 */
export const themeById = (id) => THEMES.find((t) => t.id === id) || THEMES[0];

/** True only for ids this build can actually render. */
export const isKnownTheme = (id) => THEMES.some((t) => t.id === id);
