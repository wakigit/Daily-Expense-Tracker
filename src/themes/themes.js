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
 * Each theme is a complete set of CSS custom properties, applied to
 * document.documentElement. Nothing in the app hardcodes a colour — every
 * component reads var(--foo) — which is what makes 5 themes cost nothing.
 *
 * bgKind 'pattern' tiles small SVG icons; 'scene' paints a full illustration.
 */
export const THEMES = [
  {
    id: 'pink', name: 'Pink Bow', emoji: '🎀', bgKind: 'pattern', iconType: 'bow',
    dot: 'rgba(255,255,255,0.38)', preview: ['#FFB3CE', '#E8709A'],
    vars: {
      '--bg': '#FFB3CE', '--surface-rgb': '255,255,255', '--tint-rgb': '255,228,238', '--border-rgb': '222,162,182',
      '--text': '#3A1A2E', '--text-sub': '#8A5870', '--text-muted': '#C09AAA', '--text-faint': '#B07090',
      '--label': '#C0708A', '--heading-sub': '#7A4060', '--chevron': '#D4A0B8', '--nav-arrow': '#C08098',
      '--accent': '#E8709A', '--accent-rgb': '232,112,154', '--accent-hover': '#D96090', '--on-accent': '#fff',
      '--success': '#2D8B60', '--danger': '#C04040', '--danger-rgb': '192,64,64', '--danger-border': '#E8A0B0',
      '--overlay': 'rgba(58,26,46,0.4)', '--on-wallpaper': '#3A1A2E',
    },
    items: [['#A8D8F0', '#78B8D4'], ['#F7E8A0', '#D4C060'], ['#E8C0F0', '#B890D4'], ['#B8F0C8', '#78D490'], ['#F0B8C8', '#D480A8']],
  },
  {
    id: 'midnight', name: 'Midnight', emoji: '🌙', bgKind: 'pattern', iconType: 'bow',
    dot: 'rgba(255,255,255,0.08)', preview: ['#1B1626', '#E8709A'],
    vars: {
      '--bg': '#1B1626', '--surface-rgb': '58,46,74', '--tint-rgb': '45,34,58', '--border-rgb': '130,110,150',
      '--text': '#F3E8EF', '--text-sub': '#C9AFC4', '--text-muted': '#8C7C93', '--text-faint': '#A78FA0',
      '--label': '#E39BC2', '--heading-sub': '#D48DB2', '--chevron': '#B98CA6', '--nav-arrow': '#A97C98',
      '--accent': '#E8709A', '--accent-rgb': '232,112,154', '--accent-hover': '#F189AC', '--on-accent': '#fff',
      '--success': '#4ECB92', '--danger': '#FF6B6B', '--danger-rgb': '255,107,107', '--danger-border': '#7A3A4A',
      '--overlay': 'rgba(0,0,0,0.6)', '--on-wallpaper': '#F3E8EF',
    },
    items: [['#3D3050', '#2E2440'], ['#4A2438', '#391C2B'], ['#213B48', '#182C38'], ['#2E4438', '#20302A'], ['#453A2A', '#332B1E']],
  },
  {
    id: 'forest', name: 'Moonlit Forest', emoji: '🌲', bgKind: 'scene', scene: 'forest',
    preview: ['#0A0F24', '#C9973E'],
    vars: {
      '--bg': '#16223F', '--surface-rgb': '255,255,255', '--tint-rgb': '225,235,245', '--border-rgb': '190,205,220',
      '--text': '#16223F', '--text-sub': '#3E5570', '--text-muted': '#8FA3B8', '--text-faint': '#6C8299',
      '--label': '#C9973E', '--heading-sub': '#2E4566', '--chevron': '#A9BED0', '--nav-arrow': '#7C93AA',
      '--accent': '#C9973E', '--accent-rgb': '201,151,62', '--accent-hover': '#AD7F2F', '--on-accent': '#16223F',
      '--success': '#3E8F5C', '--danger': '#C0453F', '--danger-rgb': '192,69,63', '--danger-border': '#E3A79E',
      '--overlay': 'rgba(8,12,24,0.55)', '--on-wallpaper': '#F5EFDF',
    },
  },
  {
    id: 'beach', name: 'Sunset Beach', emoji: '🌅', bgKind: 'scene', scene: 'beach',
    preview: ['#3B2A5C', '#F0925A'],
    vars: {
      '--bg': '#B4506B', '--surface-rgb': '255,250,246', '--tint-rgb': '255,232,218', '--border-rgb': '232,178,155',
      '--text': '#4A2438', '--text-sub': '#7A4256', '--text-muted': '#C58B93', '--text-faint': '#A9647A',
      '--label': '#D9673F', '--heading-sub': '#7A3B2E', '--chevron': '#E3A98E', '--nav-arrow': '#C9836A',
      '--accent': '#F2784B', '--accent-rgb': '242,120,75', '--accent-hover': '#D9602F', '--on-accent': '#fff',
      '--success': '#3E8F6E', '--danger': '#C0392B', '--danger-rgb': '192,57,43', '--danger-border': '#E8A99A',
      '--overlay': 'rgba(40,15,30,0.5)', '--on-wallpaper': '#FFF2E4',
    },
  },
  {
    id: 'mahjong', name: 'Mahjong Fortune', emoji: '🀄', bgKind: 'pattern', iconType: 'mahjong',
    dot: 'rgba(255,255,255,0)', preview: ['#7D2436', '#C9982E'],
    vars: {
      '--bg': '#7D2436', '--surface-rgb': '255,248,235', '--tint-rgb': '250,235,205', '--border-rgb': '200,160,90',
      '--text': '#3A1520', '--text-sub': '#6B2E33', '--text-muted': '#B58A72', '--text-faint': '#8F5C4A',
      '--label': '#B4222F', '--heading-sub': '#6B2027', '--chevron': '#C99A6A', '--nav-arrow': '#A97A4A',
      '--accent': '#C9982E', '--accent-rgb': '201,152,46', '--accent-hover': '#A97A1F', '--on-accent': '#3A1520',
      '--success': '#3E8F5C', '--danger': '#C0392B', '--danger-rgb': '192,57,43', '--danger-border': '#E0A8A0',
      '--overlay': 'rgba(40,10,16,0.55)', '--on-wallpaper': '#F6EBD9',
    },
    items: ['zhong', 'facai', 'baiban'],
  },
];

export const themeById = (id) => THEMES.find((t) => t.id === id) || THEMES[0];
